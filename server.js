require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { startScheduler } = require('./scheduler');
const { scrapeInternships } = require('./scraper');
const { calculateScore } = require('./scorer');
const {
  insertInternship, getAllInternships, getInternshipById, getStats,
  deleteInternship, clearAll,
  createUser, findUserByEmail, getUserById,
  addApplication, removeApplication, getUserApplications,
  getUserApplicationIds, getApplicationCount
} = require('./database');
const { sendTelegramNotification } = require('./notifier');
const { hashPassword, comparePassword, generateToken, authMiddleware, optionalAuth } = require('./auth');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// ── Security & Performance Middleware ──
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts. Please try again later.' }
});

const scrapeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  message: { success: false, message: 'Scrape rate limit reached. Please wait.' }
});

app.use('/api/', apiLimiter);

// Static files with caching
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: 0,         // no browser caching — always serve fresh files
  etag: false
}));

// ── Health ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ── Auth Routes ──
app.post('/api/auth/register', authLimiter, (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format.' });
    }

    const existing = findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const password_hash = hashPassword(password);
    const result = createUser({ name: name.trim(), email: email.trim(), password_hash });

    if (result.error) {
      return res.status(409).json({ success: false, message: result.error });
    }

    const user = getUserById(result.id);
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: { id: user.id, name: user.name, email: user.email, avatar_color: user.avatar_color }
    });
  } catch (error) {
    console.error('[server] Registration failed:', error.message);
    res.status(500).json({ success: false, message: 'Registration failed.' });
  }
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!comparePassword(password, user.password_hash)) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: { id: user.id, name: user.name, email: user.email, avatar_color: user.avatar_color }
    });
  } catch (error) {
    console.error('[server] Login failed:', error.message);
    res.status(500).json({ success: false, message: 'Login failed.' });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  try {
    const user = getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const applicationCount = getApplicationCount(user.id);

    res.json({
      success: true,
      user: { ...user, applicationCount }
    });
  } catch (error) {
    console.error('[server] Get user failed:', error.message);
    res.status(500).json({ success: false, message: 'Failed to get user data.' });
  }
});

// ── Internship Routes ──
app.get('/api/internships', optionalAuth, (req, res) => {
  try {
    const result = getAllInternships({
      location: req.query.location,
      min_score: req.query.min_score,
      search: req.query.search,
      source: req.query.source,
      sort: req.query.sort || 'score',
      page: req.query.page,
      limit: req.query.limit
    });

    // If user is logged in, mark which ones they've applied to
    if (req.user) {
      const appliedIds = getUserApplicationIds(req.user.id);
      result.internships = result.internships.map(i => ({
        ...i,
        has_applied: appliedIds.includes(i.id)
      }));
    }

    res.json(result);
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

app.post('/api/scrape', scrapeLimiter, async (req, res) => {
  try {
    console.log('[server] Manual scrape triggered.');
    const internships = await scrapeInternships();
    const enrichedInternships = internships.map((internship) => {
      const scoring = calculateScore(internship);
      return { ...internship, ...scoring };
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
      inserted: insertedCount,
      message: `Scrape completed. Processed ${enrichedInternships.length} internships and inserted ${insertedCount} new records.`
    });
  } catch (error) {
    console.error('[server] Manual scrape failed:', error.message);
    res.status(500).json({ success: false, count: 0, message: 'Scrape failed. Check server logs.' });
  }
});

app.delete('/api/internships/:id', authMiddleware, (req, res) => {
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

app.delete('/api/clear', authMiddleware, (req, res) => {
  try {
    clearAll();
    res.json({ success: true, message: 'All internships cleared successfully' });
  } catch (error) {
    console.error('[server] Failed to clear internships:', error.message);
    res.status(500).json({ success: false, message: 'Failed to clear internships' });
  }
});

// ── Profile / Application Routes ──
app.post('/api/applications/:internshipId', authMiddleware, (req, res) => {
  try {
    const internship = getInternshipById(req.params.internshipId);
    if (!internship) {
      return res.status(404).json({ success: false, message: 'Internship not found.' });
    }

    const result = addApplication(req.user.id, internship.id, req.body.notes || '');
    if (result.error) {
      return res.status(409).json({ success: false, message: result.error });
    }

    res.status(201).json({ success: true, message: 'Application tracked!', applicationId: result.id });
  } catch (error) {
    console.error('[server] Failed to track application:', error.message);
    res.status(500).json({ success: false, message: 'Failed to track application.' });
  }
});

app.delete('/api/applications/:internshipId', authMiddleware, (req, res) => {
  try {
    const result = removeApplication(req.user.id, req.params.internshipId);
    if (!result.changes) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    res.json({ success: true, message: 'Application removed.' });
  } catch (error) {
    console.error('[server] Failed to remove application:', error.message);
    res.status(500).json({ success: false, message: 'Failed to remove application.' });
  }
});

app.get('/api/applications', authMiddleware, (req, res) => {
  try {
    const applications = getUserApplications(req.user.id);
    res.json({ success: true, applications });
  } catch (error) {
    console.error('[server] Failed to get applications:', error.message);
    res.status(500).json({ success: false, message: 'Failed to get applications.' });
  }
});

// ── SPA Fallback ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ──
app.listen(PORT, () => {
  console.log(`[server] InternAI server listening on http://localhost:${PORT}`);
  startScheduler();
});
