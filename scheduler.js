require('dotenv').config();

const cron = require('node-cron');
const { scrapeInternships } = require('./scraper');
const { calculateScore } = require('./scorer');
const { insertInternship } = require('./database');
const { sendTelegramNotification } = require('./notifier');

async function runScheduledScrape() {
  try {
    console.log('[scheduler] Running scheduled multi-source scrape job...');
    const internships = await scrapeInternships();
    const enrichedInternships = internships.map((internship) => {
      const scoring = calculateScore(internship);
      return { ...internship, ...scoring };
    });

    let insertedCount = 0;
    for (const internship of enrichedInternships) {
      const result = await insertInternship(internship);
      insertedCount += result.changes || 0;
    }

    console.log(`[scheduler] Processed ${enrichedInternships.length} internships, inserted ${insertedCount} new records.`);
    await sendTelegramNotification(enrichedInternships);
  } catch (error) {
    console.error('[scheduler] Scheduled scrape job failed:', error.message);
  }
}

function startScheduler() {
  // Vercel serverless functions are ephemeral — cron cannot run persistently.
  // Scraping is available on-demand via POST /api/scrape from the dashboard.
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    console.log('[scheduler] Vercel environment detected — skipping cron scheduler. Use "Scrape Now" in the dashboard.');
    return;
  }

  try {
    const intervalHours = Number(process.env.SCRAPE_INTERVAL_HOURS) || 6;
    const safeInterval = intervalHours > 0 ? intervalHours : 6;
    const cronExpression = `0 */${safeInterval} * * *`;

    console.log(`[scheduler] Starting cron scheduler: every ${safeInterval}h (${cronExpression})`);
    console.log(`[scheduler] Scraping sources: Internshala, AICTE, Naukri`);

    cron.schedule(cronExpression, () => {
      console.log(`[scheduler] Cron triggered at ${new Date().toISOString()}`);
      runScheduledScrape();
    });
  } catch (error) {
    console.error('[scheduler] Failed to start scheduler:', error.message);
  }
}

module.exports = { startScheduler };
