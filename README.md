# 💼 AutoJobApply — LinkedIn Job Scraper & Dashboard

A personal job application tracker that **automatically scrapes LinkedIn job listings** and displays them in a beautiful dashboard. Manage jobs by profile, filter by recency, track applications, and reject unwanted listings — all from your browser.

---

## 📸 What It Does

```
LinkedIn → Playwright Scraper → jobs.json → Express Server → Dashboard UI
```

1. You define **search profiles** (e.g. MERN Stack, Data Analyst) with LinkedIn search URLs
2. Click **"🔄 Scrape Jobs"** in the dashboard → a real browser opens LinkedIn
3. Log in to LinkedIn → click **"I'm Logged In"** in the dashboard
4. The scraper auto-visits all your URLs, collects job listings, and saves them
5. The dashboard refreshes instantly with new jobs, sorted by recency

---

## 🗂 Project Structure

```
AutoJobApply/
├── server.js          # Express API server — serves the dashboard & manages data
├── index.js           # Playwright scraper — opens browser, logs in, scrapes jobs
├── config.json        # Your search profiles and LinkedIn URLs (editable from UI)
├── jobs.json          # All scraped jobs with their status (applied / rejected)
├── package.json       # Dependencies
└── public/
    └── index.html     # The dashboard frontend (single HTML file)
```

---

## ⚙️ How to Set Up

### 1. Install Dependencies

```bash
npm install
```

### 2. Install Playwright Browsers

```bash
npx playwright install chromium
```

### 3. Start the Server

```bash
npm start
```

The dashboard opens at → **http://localhost:3000**

---

## 🖥️ Dashboard Features

### Tabs
| Tab | Description |
|---|---|
| **New** | Fresh jobs ready to apply to |
| **Applied** | Jobs you've clicked "Apply Now" on |
| **Rejected** | Jobs you dismissed (with option to restore) |

### Filter Bar (below tabs)
| Filter | Description |
|---|---|
| 🔥 **Hot** | Posted in the last **1 hour** |
| ⚡ **Today** | Posted in the last **24 hours** |
| 📅 **Week** | Posted in the last **7 days** |
| 🗓 **Month** | Posted in the last **30 days** |
| 📆 **2 Months** | Posted in the last **60 days** |
| **All** | Show everything (default) |
| 🔍 **Search** | Filter by job title, company, or location |

### Job Cards
Each card shows:
- **Profile chip** — which profile the job belongs to (e.g. 🧑‍💻 MERN Stack)
- **Priority badge** — 🔥 Hot / ⚡ Today / 📅 New based on posting time
- **Apply Now** → opens job on LinkedIn + marks as Applied
- **✕ Reject** → moves job to Rejected tab
- **✕ Remove** (Applied tab) → removes from Applied to Rejected
- **↩ Restore** (Rejected tab) → moves job back to New

---

## 🔄 Scraping Jobs (Step-by-Step)

1. Click **"🔄 Scrape Jobs"** button in the top-right of the dashboard
2. The scrape modal opens with 3 steps:

### Step 1 — Choose a Profile
Click a profile card (e.g. **🧑‍💻 MERN Stack** or **📊 Data Analyst**)

### Step 2 — Manage URLs
- See all LinkedIn search URLs for that profile
- **Add** new URLs by pasting and clicking `+ Add`
- **Delete** URLs with the ✕ button
- **Save** changes with `💾 Save URLs`

### Step 3 — Start Scraping
- Click **🚀 Start Scraping**
  - A real Chrome browser window opens automatically
  - A yellow banner appears: **"Log into LinkedIn then click when ready"**
- Log into LinkedIn in the browser (if not already logged in)
- Click **✅ I'm Logged In** in the dashboard
- The scraper visits all URLs, collects jobs, and saves them
- Live logs stream in the dark console below
- When done → dashboard auto-refreshes with new jobs

> ⚠️ **Important:** Scraping will **delete all existing "New" jobs** and replace them with fresh results. Applied and Rejected jobs are **always preserved**.

---

## 📋 Managing Search Profiles (`config.json`)

Profiles are stored in `config.json`:

```json
{
  "profiles": {
    "mernstack": {
      "label": "MERN Stack",
      "icon": "🧑‍💻",
      "urls": [
        "https://www.linkedin.com/jobs/search/?keywords=react&sortBy=DD",
        "https://www.linkedin.com/jobs/search/?keywords=mern+stack&sortBy=DD"
      ]
    },
    "dataanalyst": {
      "label": "Data Analyst",
      "icon": "📊",
      "urls": [
        "https://www.linkedin.com/jobs/search/?keywords=data+analyst&sortBy=DD"
      ]
    }
  }
}
```

### Adding a New Profile
1. Open `config.json` and add a new key under `"profiles"`
2. Give it a `label`, `icon`, and `urls` array
3. Restart the server → the new profile card appears in the scrape modal

### Useful LinkedIn URL Parameters
| Parameter | Meaning |
|---|---|
| `keywords=react` | Search keyword |
| `location=India` | Location filter |
| `sortBy=DD` | Sort by **Date** (most recent first) |
| `f_WT=2` | Remote jobs only |
| `f_E=1` | Internship level |
| `f_E=2` | Entry level |
| `f_TPR=r86400` | Posted in last **24 hours** |
| `f_TPR=r604800` | Posted in last **7 days** |
| `f_TPR=r2592000` | Posted in last **30 days** |

---

## 🔌 API Reference

The Express server exposes these endpoints:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/jobs` | Get all jobs |
| `POST` | `/api/jobs/apply` | Mark a job as applied `{ id }` |
| `POST` | `/api/jobs/reject` | Mark a job as rejected `{ id }` |
| `POST` | `/api/jobs/restore` | Restore a rejected job `{ id }` |
| `GET` | `/api/config` | Get all profiles and URLs |
| `POST` | `/api/config/profile/:key/urls` | Save URLs for a profile `{ urls[] }` |
| `POST` | `/api/scrape/start` | Start scraping a profile `{ profile }` |
| `POST` | `/api/scrape/confirm` | Confirm LinkedIn login (sends Enter to scraper) |
| `POST` | `/api/scrape/stop` | Kill the scraper process |
| `GET` | `/api/scrape/status` | Poll scraping status and live logs |

---

## 📦 Dependencies

| Package | Purpose |
|---|---|
| `express` | Web server & API |
| `cors` | Cross-origin request support |
| `playwright` | Headless/headed browser automation for scraping |

---

## 💡 Tips

- **LinkedIn login is persistent** — once you log in during a scrape session, LinkedIn usually keeps you logged in for future scrapes (cookies are stored in the Playwright browser context).
- **Scrape frequently** — run scrapes daily with the 🔥 Hot / ⚡ Today filters to catch the freshest jobs.
- **Add `f_TPR=r86400`** to your URLs to tell LinkedIn to only show jobs posted in the last 24 hours, making scraping faster and more focused.
- **Apply fast** — jobs posted in the last hour (🔥 Hot) have much less competition.

---

## 🛠 Troubleshooting

| Problem | Solution |
|---|---|
| Dashboard shows "Error loading jobs" | Make sure the server is running: `npm start` |
| Profile chip shows profile key instead of label | Hard-refresh the browser (`Cmd+Shift+R`) |
| Scraper says "No URLs found" | Open Scrape modal → select profile → save URLs |
| Browser doesn't open | Run `npx playwright install chromium` |
| Jobs not updating after scrape | Hard-refresh the browser after scraping completes |
