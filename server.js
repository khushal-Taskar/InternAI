require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const { startScheduler } = require('./scheduler');
const { scrapeInternships } = require('./scraper');
const { calculateScore } = require('./scorer');
const { insertInternship, getAllInternships, getStats, deleteInternship, clearAll } = require('./database');
const { sendTelegramNotification } = require('./notifier');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  try {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[server] /health failed:', error.message);
    res.status(500).json({ status: 'error', message: 'Health check failed' });
  }
});

app.get('/api/internships', (req, res) => {
  try {
    const internships = getAllInternships({
      location: req.query.location,
      min_score: req.query.min_score,
      search: req.query.search,
      sort: req.query.sort || 'score'
    });

    res.json(internships);
  } catch (error) {
    console.error('[server] Failed to fetch internships:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch internships' });
  }
});

app.get('/api/stats', (req, res) => {
  try {
    res.json(getStats());
  } catch (error) {
    console.error('[server] Failed to fetch stats:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

app.post('/api/scrape', async (req, res) => {
  try {
    console.log('[server] Manual scrape triggered.');
    const internships = await scrapeInternships();
    const enrichedInternships = internships.map((internship) => {
      const scoring = calculateScore(internship);
      return {
        ...internship,
        ...scoring
      };
    });

    let insertedCount = 0;
    enrichedInternships.forEach((internship) => {
      const result = insertInternship(internship);
      insertedCount += result.changes || 0;
    });

    await sendTelegramNotification(enrichedInternships);

    res.json({
      success: true,
      count: enrichedInternships.length,
      message: `Scrape completed. Processed ${enrichedInternships.length} internships and inserted ${insertedCount} new records.`
    });
  } catch (error) {
    console.error('[server] Manual scrape failed:', error.message);
    res.status(500).json({
      success: false,
      count: 0,
      message: 'Scrape failed. Check server logs for details.'
    });
  }
});

app.delete('/api/internships/:id', (req, res) => {
  try {
    const result = deleteInternship(req.params.id);
    if (!result.changes) {
      return res.status(404).json({ success: false, message: 'Internship not found' });
    }

    res.json({ success: true, message: 'Internship deleted successfully' });
  } catch (error) {
    console.error('[server] Failed to delete internship:', error.message);
    res.status(500).json({ success: false, message: 'Failed to delete internship' });
  }
});

app.delete('/api/clear', (req, res) => {
  try {
    clearAll();
    res.json({ success: true, message: 'All internships cleared successfully' });
  } catch (error) {
    console.error('[server] Failed to clear internships:', error.message);
    res.status(500).json({ success: false, message: 'Failed to clear internships' });
  }
});

app.listen(PORT, () => {
  console.log(`[server] InternAI server listening on http://localhost:${PORT}`);
  startScheduler();
});
