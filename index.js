const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

// Read the profile key from CLI args: node index.js mernstack
const profileKey = process.argv[2];

if (!profileKey) {
  console.error('ERROR: No profile specified. Usage: node index.js <profileKey>');
  process.exit(1);
}

// Read URLs from config.json for the chosen profile
const CONFIG_FILE = path.join(__dirname, 'config.json');
let urlsToScrape = [];
let profileLabel = profileKey;

try {
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  const profile = config.profiles && config.profiles[profileKey];
  if (!profile) {
    console.error(`ERROR: Profile "${profileKey}" not found in config.json`);
    console.error('Available profiles:', Object.keys(config.profiles || {}).join(', '));
    process.exit(1);
  }
  urlsToScrape = profile.urls || [];
  profileLabel = profile.label || profileKey;
} catch (err) {
  console.error('Could not read config.json:', err.message);
  process.exit(1);
}

if (urlsToScrape.length === 0) {
  console.error(`ERROR: No URLs found for profile "${profileKey}".`);
  process.exit(1);
}

console.log(`Profile: ${profileLabel} (${urlsToScrape.length} URLs)`);

(async () => {
  // Read existing jobs — keep applied and rejected, clear new ones for this profile
  let existingJobs = [];
  try {
    if (fs.existsSync('jobs.json')) {
      existingJobs = JSON.parse(fs.readFileSync('jobs.json', 'utf-8'));
    }
  } catch (err) {
    console.error('Could not read existing jobs.json, starting fresh.', err);
  }

  // Keep only jobs that are applied or rejected — new jobs for this profile are cleared
  const preservedJobs = existingJobs.filter(j => j.applied || j.rejected);
  console.log(`Cleared ${existingJobs.length - preservedJobs.length} old new-jobs. Kept ${preservedJobs.length} applied/rejected jobs.`);

  // Create a Set of existing links to avoid duplicates with preserved jobs
  const existingLinks = new Set(preservedJobs.map(job => job.link));

  // Launch browser in visible mode
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to the first URL for manual login...');
  await page.goto(urlsToScrape[0]);

  console.log('\n=======================================');
  console.log('            MANUAL ACTION REQUIRED');
  console.log('=======================================');
  console.log('1. A browser window has opened.');
  console.log('2. Please log into LinkedIn manually if prompted.');
  console.log('3. Ensure the page fully loads.');
  console.log('=======================================\n');

  // Server will write '\n' to stdin when user clicks "I'm Logged In" in the UI
  await askQuestion('Press ENTER (or click "I\'m Logged In" in the dashboard) when ready...');

  let newJobsCount = 0;
  const freshJobs = [];

  for (let i = 0; i < urlsToScrape.length; i++) {
    const url = urlsToScrape[i];
    console.log(`\n[${i + 1}/${urlsToScrape.length}] Scraping: ${url}`);

    if (i !== 0) {
      await page.goto(url);
    }

    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    const jobsOnPage = await page.evaluate((pKey) => {
      const jobCards = document.querySelectorAll('.job-card-container, .base-search-card');
      const data = [];

      jobCards.forEach(card => {
        const titleEl    = card.querySelector('.job-card-list__title, .artdeco-entity-lockup__title, .base-search-card__title');
        const companyEl  = card.querySelector('.job-card-container__primary-description, .artdeco-entity-lockup__subtitle, .base-search-card__subtitle');
        const locationEl = card.querySelector('.job-card-container__metadata-item, .job-card-container__metadata-wrapper, .job-search-card__location');
        const timeEl     = card.querySelector('time');
        const linkEl     = card.querySelector('a.job-card-list__title, a.job-card-container__link, a.base-card__full-link');

        if (titleEl) {
          let link = linkEl ? linkEl.href : '';
          if (link.includes('?')) link = link.split('?')[0];

          data.push({
            id:       Date.now().toString() + Math.random().toString(36).substr(2, 9),
            title:    titleEl.innerText.trim(),
            company:  companyEl  ? companyEl.innerText.trim()  : 'Unknown',
            location: locationEl ? locationEl.innerText.trim() : 'Unknown',
            time:     timeEl     ? timeEl.innerText.trim()     : '',
            link,
            applied:  false,
            rejected: false,
            profile:  pKey
          });
        }
      });
      return data;
    }, profileKey);

    console.log(`Found ${jobsOnPage.length} jobs on this page.`);

    for (const job of jobsOnPage) {
      if (!existingLinks.has(job.link)) {
        job.id = job.link.split('-').pop() || Date.now().toString();
        freshJobs.push(job);
        existingLinks.add(job.link);
        newJobsCount++;
      }
    }
  }

  // Merge: fresh jobs first, then preserved applied/rejected jobs
  const finalJobs = [...freshJobs, ...preservedJobs];

  console.log(`\nFinished scraping! Added ${newJobsCount} NEW jobs.`);
  fs.writeFileSync('jobs.json', JSON.stringify(finalJobs, null, 2));
  console.log('Saved updated list to jobs.json');

  await browser.close();
  rl.close();
})();
