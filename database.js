require('dotenv').config();

const { createClient } = require('@libsql/client');

console.log('[database] Initializing Turso (libSQL) database...');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:internai.db',
  authToken: process.env.TURSO_AUTH_TOKEN || undefined
});

// ── Row Serialization Helpers ──
// libSQL Row objects are array-like and don't serialize as plain objects.
// These helpers convert them to standard JS objects safe for JSON.
function rowsToPlain(result) {
  const cols = result.columns;
  return result.rows.map(row => {
    const obj = {};
    cols.forEach((col, i) => {
      const val = row[i];
      obj[col] = typeof val === 'bigint' ? Number(val) : val;
    });
    return obj;
  });
}

function rowToPlain(result) {
  if (!result || !result.rows.length) return null;
  return rowsToPlain(result)[0];
}

// ── Schema Init ──

async function initDatabase() {
  try {
    await db.executeMultiple(`
      CREATE TABLE IF NOT EXISTS internships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        company TEXT,
        stipend TEXT,
        stipend_value INTEGER DEFAULT 0,
        location TEXT,
        link TEXT UNIQUE,
        apply_link TEXT,
        source TEXT DEFAULT 'Internshala',
        score INTEGER DEFAULT 0,
        is_remote INTEGER DEFAULT 0,
        duration TEXT,
        posted_date TEXT,
        date_scraped TEXT,
        status TEXT DEFAULT 'New'
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        avatar_color TEXT DEFAULT '#7c3aed',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        internship_id INTEGER NOT NULL,
        applied_at TEXT DEFAULT (datetime('now')),
        status TEXT DEFAULT 'Applied',
        notes TEXT DEFAULT '',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (internship_id) REFERENCES internships(id) ON DELETE CASCADE,
        UNIQUE(user_id, internship_id)
      );

      CREATE INDEX IF NOT EXISTS idx_internships_score ON internships(score DESC);
      CREATE INDEX IF NOT EXISTS idx_internships_date ON internships(date_scraped DESC);
      CREATE INDEX IF NOT EXISTS idx_internships_source ON internships(source);
      CREATE INDEX IF NOT EXISTS idx_internships_remote ON internships(is_remote);
      CREATE INDEX IF NOT EXISTS idx_internships_stipend ON internships(stipend_value DESC);
      CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id);
      CREATE INDEX IF NOT EXISTS idx_applications_internship ON applications(internship_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    // Add columns to existing tables if missing (ignore errors if they exist)
    const alterCols = [
      'ALTER TABLE internships ADD COLUMN apply_link TEXT',
      'ALTER TABLE internships ADD COLUMN duration TEXT',
      'ALTER TABLE internships ADD COLUMN posted_date TEXT'
    ];
    for (const sql of alterCols) {
      try { await db.execute(sql); } catch (_) { /* column already exists */ }
    }

    console.log('[database] Database ready with all tables and indexes.');
  } catch (error) {
    console.error('[database] Failed to initialize database:', error.message);
  }
}

// Run init immediately (top-level await workaround for CommonJS)
const dbReady = initDatabase();

// ── Internship Functions ──

async function insertInternship(data) {
  try {
    await dbReady;
    const result = await db.execute({
      sql: `INSERT OR IGNORE INTO internships
        (title, company, stipend, stipend_value, location, link, apply_link,
         source, score, is_remote, duration, posted_date, date_scraped, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        data.title || 'Untitled Internship',
        data.company || 'Unknown Company',
        data.stipend || 'Not specified',
        Number.isFinite(data.stipend_value) ? data.stipend_value : 0,
        data.location || 'Not specified',
        data.link,
        data.apply_link || data.link || '',
        data.source || 'Internshala',
        Number.isFinite(data.score) ? data.score : 0,
        data.is_remote ? 1 : 0,
        data.duration || '',
        data.posted_date || '',
        data.date_scraped || new Date().toISOString(),
        data.status || 'New'
      ]
    });
    return { changes: Number(result.rowsAffected) };
  } catch (error) {
    console.error('[database] Failed to insert internship:', error.message);
    return { changes: 0 };
  }
}

async function getAllInternships(filters = {}) {
  try {
    await dbReady;
    const conditions = [];
    const args = [];

    if (filters.location && String(filters.location).toLowerCase() === 'remote') {
      conditions.push('is_remote = 1');
    }

    if (filters.min_score) {
      const minScore = Number(filters.min_score);
      if (!Number.isNaN(minScore)) {
        conditions.push('score >= ?');
        args.push(minScore);
      }
    }

    if (filters.search) {
      conditions.push('(LOWER(title) LIKE ? OR LOWER(company) LIKE ?)');
      const term = `%${String(filters.search).toLowerCase()}%`;
      args.push(term, term);
    }

    if (filters.source && filters.source !== 'all') {
      conditions.push('LOWER(source) = ?');
      args.push(String(filters.source).toLowerCase());
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const allowedSorts = {
      score: 'score DESC, date_scraped DESC',
      date: 'date_scraped DESC, score DESC',
      stipend: 'stipend_value DESC, score DESC'
    };
    const sortKey = String(filters.sort || 'score').toLowerCase();
    const orderBy = allowedSorts[sortKey] || allowedSorts.score;

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const offset = (page - 1) * limit;

    const countResult = await db.execute({
      sql: `SELECT COUNT(*) as total FROM internships ${whereClause}`,
      args
    });
    const total = Number(countResult.rows[0].total);

    const dataResult = await db.execute({
      sql: `SELECT * FROM internships ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      args: [...args, limit, offset]
    });

    return {
      internships: rowsToPlain(dataResult),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  } catch (error) {
    console.error('[database] Failed to fetch internships:', error.message);
    return { internships: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
  }
}

async function getInternshipById(id) {
  try {
    await dbReady;
    const result = await db.execute({ sql: 'SELECT * FROM internships WHERE id = ?', args: [id] });
    return rowToPlain(result);
  } catch (error) {
    console.error('[database] Failed to get internship:', error.message);
    return null;
  }
}

async function getStats() {
  try {
    await dbReady;
    const today = new Date().toISOString().slice(0, 10);
    const statsResult = await db.execute({
      sql: `SELECT
        COUNT(*) AS total,
        ROUND(COALESCE(AVG(score), 0), 2) AS avgScore,
        SUM(CASE WHEN is_remote = 1 THEN 1 ELSE 0 END) AS remoteCount,
        SUM(CASE WHEN substr(date_scraped, 1, 10) = ? THEN 1 ELSE 0 END) AS todayCount
      FROM internships`,
      args: [today]
    });
    const stats = rowToPlain(statsResult) || {};

    const sourceResult = await db.execute('SELECT source, COUNT(*) as count FROM internships GROUP BY source');

    return {
      total: Number(stats.total || 0),
      avgScore: Number(stats.avgScore || 0),
      remoteCount: Number(stats.remoteCount || 0),
      todayCount: Number(stats.todayCount || 0),
      sources: rowsToPlain(sourceResult)
    };
  } catch (error) {
    console.error('[database] Failed to fetch stats:', error.message);
    return { total: 0, avgScore: 0, remoteCount: 0, todayCount: 0, sources: [] };
  }
}

async function deleteInternship(id) {
  try {
    await dbReady;
    const result = await db.execute({ sql: 'DELETE FROM internships WHERE id = ?', args: [id] });
    return { changes: Number(result.rowsAffected) };
  } catch (error) {
    console.error('[database] Failed to delete internship:', error.message);
    return { changes: 0 };
  }
}

async function clearAll() {
  try {
    await dbReady;
    const result = await db.execute('DELETE FROM internships');
    return { changes: Number(result.rowsAffected) };
  } catch (error) {
    console.error('[database] Failed to clear internships:', error.message);
    return { changes: 0 };
  }
}

// ── User Functions ──

async function createUser(data) {
  try {
    await dbReady;
    const colors = ['#7c3aed', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const result = await db.execute({
      sql: 'INSERT INTO users (name, email, password_hash, avatar_color) VALUES (?, ?, ?, ?)',
      args: [data.name, data.email.toLowerCase(), data.password_hash, randomColor]
    });
    return { id: Number(result.lastInsertRowid), changes: Number(result.rowsAffected) };
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return { error: 'Email already registered', changes: 0 };
    }
    console.error('[database] Failed to create user:', error.message);
    return { error: error.message, changes: 0 };
  }
}

async function findUserByEmail(email) {
  try {
    await dbReady;
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email.toLowerCase()] });
    return rowToPlain(result);
  } catch (error) {
    console.error('[database] Failed to find user:', error.message);
    return null;
  }
}

async function getUserById(id) {
  try {
    await dbReady;
    const result = await db.execute({
      sql: 'SELECT id, name, email, avatar_color, created_at FROM users WHERE id = ?',
      args: [id]
    });
    return rowToPlain(result);
  } catch (error) {
    console.error('[database] Failed to get user:', error.message);
    return null;
  }
}

// ── Application Functions ──

async function addApplication(userId, internshipId, notes = '') {
  try {
    await dbReady;
    const result = await db.execute({
      sql: 'INSERT OR IGNORE INTO applications (user_id, internship_id, status, notes) VALUES (?, ?, ?, ?)',
      args: [userId, internshipId, 'Applied', notes]
    });
    return { id: Number(result.lastInsertRowid), changes: Number(result.rowsAffected) };
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return { error: 'Already applied to this internship', changes: 0 };
    }
    console.error('[database] Failed to add application:', error.message);
    return { error: error.message, changes: 0 };
  }
}

async function removeApplication(userId, internshipId) {
  try {
    await dbReady;
    const result = await db.execute({
      sql: 'DELETE FROM applications WHERE user_id = ? AND internship_id = ?',
      args: [userId, internshipId]
    });
    return { changes: Number(result.rowsAffected) };
  } catch (error) {
    console.error('[database] Failed to remove application:', error.message);
    return { changes: 0 };
  }
}

async function getUserApplications(userId) {
  try {
    await dbReady;
    const result = await db.execute({
      sql: `SELECT a.id as application_id, a.applied_at, a.status, a.notes,
               i.id, i.title, i.company, i.stipend, i.location, i.link, i.apply_link,
               i.source, i.score, i.is_remote, i.duration
            FROM applications a
            JOIN internships i ON a.internship_id = i.id
            WHERE a.user_id = ?
            ORDER BY a.applied_at DESC`,
      args: [userId]
    });
    return rowsToPlain(result);
  } catch (error) {
    console.error('[database] Failed to get user applications:', error.message);
    return [];
  }
}

async function getUserApplicationIds(userId) {
  try {
    await dbReady;
    const result = await db.execute({
      sql: 'SELECT internship_id FROM applications WHERE user_id = ?',
      args: [userId]
    });
    return rowsToPlain(result).map(r => Number(r.internship_id));
  } catch (error) {
    return [];
  }
}

async function getApplicationCount(userId) {
  try {
    await dbReady;
    const result = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM applications WHERE user_id = ?',
      args: [userId]
    });
    const row = rowToPlain(result);
    return row ? Number(row.count) : 0;
  } catch (error) {
    return 0;
  }
}

module.exports = {
  insertInternship,
  getAllInternships,
  getInternshipById,
  getStats,
  deleteInternship,
  clearAll,
  createUser,
  findUserByEmail,
  getUserById,
  addApplication,
  removeApplication,
  getUserApplications,
  getUserApplicationIds,
  getApplicationCount
};
