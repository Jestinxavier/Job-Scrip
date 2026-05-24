const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const JOBS_FILE   = path.join(__dirname, 'jobs.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');

// ── File helpers ──────────────────────────────────────────────────────────────
function readJobs() {
  if (!fs.existsSync(JOBS_FILE)) return [];
  return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8'));
}
function writeJobs(jobs) {
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
}
function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return { profiles: {} };
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
}
function writeConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// ── Scraper state ─────────────────────────────────────────────────────────────
let scrapeChild = null;
let scrapeState = { status: 'idle', logs: [], newCount: 0, error: null, profile: null };

// ── Job endpoints ─────────────────────────────────────────────────────────────
app.get('/api/jobs', (req, res) => res.json(readJobs()));

app.post('/api/jobs/apply', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Job ID is required' });
  const jobs = readJobs();
  let found = false;
  const updated = jobs.map(job => {
    if (job.id === id || job.link === id) { found = true; return { ...job, applied: true, rejected: false }; }
    return job;
  });
  if (!found) return res.status(404).json({ error: 'Job not found.' });
  writeJobs(updated);
  res.json({ success: true });
});

app.post('/api/jobs/reject', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Job ID is required' });
  const jobs = readJobs();
  let found = false;
  const updated = jobs.map(job => {
    if (job.id === id || job.link === id) { found = true; return { ...job, rejected: true, applied: false }; }
    return job;
  });
  if (!found) return res.status(404).json({ error: 'Job not found.' });
  writeJobs(updated);
  res.json({ success: true });
});

app.post('/api/jobs/restore', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Job ID is required' });
  const jobs = readJobs();
  let found = false;
  const updated = jobs.map(job => {
    if (job.id === id || job.link === id) { found = true; return { ...job, rejected: false, applied: false }; }
    return job;
  });
  if (!found) return res.status(404).json({ error: 'Job not found.' });
  writeJobs(updated);
  res.json({ success: true });
});

// ── Config / Profile endpoints ────────────────────────────────────────────────

// Get all profiles
app.get('/api/config', (req, res) => res.json(readConfig()));

// Save URLs for a specific profile
app.post('/api/config/profile/:key/urls', (req, res) => {
  const { key } = req.params;
  const { urls } = req.body;
  if (!Array.isArray(urls)) return res.status(400).json({ error: 'urls must be an array' });

  const config = readConfig();
  if (!config.profiles[key]) return res.status(404).json({ error: `Profile "${key}" not found` });

  config.profiles[key].urls = urls.filter(u => u && u.trim());
  writeConfig(config);
  res.json({ success: true, count: config.profiles[key].urls.length });
});

// ── Scraper control ───────────────────────────────────────────────────────────

// Start scraping for a specific profile
app.post('/api/scrape/start', (req, res) => {
  const { profile } = req.body;
  if (!profile) return res.status(400).json({ error: 'profile key is required' });
  if (scrapeChild) return res.status(400).json({ error: 'Scraping is already in progress.' });

  const config = readConfig();
  if (!config.profiles[profile]) {
    return res.status(404).json({ error: `Profile "${profile}" not found in config.` });
  }

  const profileLabel = config.profiles[profile].label || profile;
  scrapeState = {
    status: 'waiting-login',
    logs: [`🚀 Launching browser for profile: ${profileLabel}...`],
    newCount: 0,
    error: null,
    profile
  };

  scrapeChild = spawn('node', ['index.js', profile], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  scrapeChild.stdout.on('data', (data) => {
    const text = data.toString().trim();
    if (!text) return;
    text.split('\n').forEach(line => {
      if (line.trim()) scrapeState.logs.push(line.trim());
    });

    if (text.includes('MANUAL ACTION REQUIRED') || text.includes('log into LinkedIn')) {
      scrapeState.status = 'waiting-login';
    }
    if (text.includes('Scraping:')) {
      scrapeState.status = 'running';
    }
    if (text.includes('Finished scraping!')) {
      const match = text.match(/Added (\d+) NEW jobs/);
      if (match) scrapeState.newCount = parseInt(match[1]);
    }
    if (text.includes('Saved updated list')) {
      scrapeState.status = 'done';
      scrapeChild = null;
    }
  });

  scrapeChild.stderr.on('data', (data) => {
    const text = data.toString().trim();
    if (text) scrapeState.logs.push('⚠️ ' + text);
  });

  scrapeChild.on('close', (code) => {
    scrapeChild = null;
    if (scrapeState.status !== 'done') {
      scrapeState.status = code === 0 ? 'done' : 'error';
      if (code !== 0) scrapeState.error = `Process exited with code ${code}`;
    }
  });

  res.json({ success: true, profile, label: profileLabel });
});

// Confirm login — sends Enter to child process stdin
app.post('/api/scrape/confirm', (req, res) => {
  if (!scrapeChild) return res.status(400).json({ error: 'No scraping session in progress.' });
  scrapeState.status = 'running';
  scrapeState.logs.push('✅ Login confirmed — starting scrape...');
  scrapeChild.stdin.write('\n');
  res.json({ success: true });
});

// Stop scraping
app.post('/api/scrape/stop', (req, res) => {
  if (scrapeChild) { scrapeChild.kill(); scrapeChild = null; }
  scrapeState.status = 'idle';
  scrapeState.logs.push('🛑 Scraping stopped by user.');
  res.json({ success: true });
});

// Poll scrape status
app.get('/api/scrape/status', (req, res) => res.json(scrapeState));

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n==============================================`);
  console.log(`🚀 Server running at: http://localhost:${PORT}`);
  console.log(`==============================================\n`);
});
