const Database = require('better-sqlite3');

console.log('[database] Initializing SQLite database...');

const db = new Database('internai.db');

try {
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000');
  db.pragma('busy_timeout = 5000');

  db.exec(`
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
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_color TEXT DEFAULT '#7c3aed',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
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
    )
  `);

  // Performance indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_internships_score ON internships(score DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_internships_date ON internships(date_scraped DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_internships_source ON internships(source)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_internships_remote ON internships(is_remote)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_internships_stipend ON internships(stipend_value DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_applications_internship ON applications(internship_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);

  // Add new columns to existing tables if they don't exist
  try { db.exec(`ALTER TABLE internships ADD COLUMN apply_link TEXT`); } catch (e) { /* column exists */ }
  try { db.exec(`ALTER TABLE internships ADD COLUMN duration TEXT`); } catch (e) { /* column exists */ }
  try { db.exec(`ALTER TABLE internships ADD COLUMN posted_date TEXT`); } catch (e) { /* column exists */ }

  console.log('[database] Database ready with all tables and indexes.');
} catch (error) {
  console.error('[database] Failed to initialize database:', error.message);
}

// ── Internship Functions ──

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO internships (
    title, company, stipend, stipend_value, location, link, apply_link,
    source, score, is_remote, duration, posted_date, date_scraped, status
  ) VALUES (
    @title, @company, @stipend, @stipend_value, @location, @link, @apply_link,
    @source, @score, @is_remote, @duration, @posted_date, @date_scraped, @status
  )
`);

function insertInternship(data) {
  try {
    const payload = {
      title: data.title || 'Untitled Internship',
      company: data.company || 'Unknown Company',
      stipend: data.stipend || 'Not specified',
      stipend_value: Number.isFinite(data.stipend_value) ? data.stipend_value : 0,
      location: data.location || 'Not specified',
      link: data.link,
      apply_link: data.apply_link || data.link || '',
      source: data.source || 'Internshala',
      score: Number.isFinite(data.score) ? data.score : 0,
      is_remote: data.is_remote ? 1 : 0,
      duration: data.duration || '',
      posted_date: data.posted_date || '',
      date_scraped: data.date_scraped || new Date().toISOString(),
      status: data.status || 'New'
    };

    const result = insertStmt.run(payload);
    return result;
  } catch (error) {
    console.error('[database] Failed to insert internship:', error.message);
    return { changes: 0 };
  }
}

function getAllInternships(filters = {}) {
  try {
    const conditions = [];
    const params = {};

    if (filters.location && String(filters.location).toLowerCase() === 'remote') {
      conditions.push('is_remote = 1');
    }

    if (filters.min_score) {
      const minScore = Number(filters.min_score);
      if (!Number.isNaN(minScore)) {
        conditions.push('score >= @min_score');
        params.min_score = minScore;
      }
    }

    if (filters.search) {
      conditions.push('(LOWER(title) LIKE @search OR LOWER(company) LIKE @search)');
      params.search = `%${String(filters.search).toLowerCase()}%`;
    }

    if (filters.source && filters.source !== 'all') {
      conditions.push('LOWER(source) = @source');
      params.source = String(filters.source).toLowerCase();
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const allowedSorts = {
      score: 'score DESC, date_scraped DESC',
      date: 'date_scraped DESC, score DESC',
      stipend: 'stipend_value DESC, score DESC'
    };
    const sortKey = String(filters.sort || 'score').toLowerCase();
    const orderBy = allowedSorts[sortKey] || allowedSorts.score;

    // Pagination
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const offset = (page - 1) * limit;

    const countQuery = `SELECT COUNT(*) as total FROM internships ${whereClause}`;
    const total = db.prepare(countQuery).get(params).total;

    const query = `
      SELECT *
      FROM internships
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `;

    const internships = db.prepare(query).all(params);
    return {
      internships,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('[database] Failed to fetch internships:', error.message);
    return { internships: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
  }
}

function getInternshipById(id) {
  try {
    return db.prepare('SELECT * FROM internships WHERE id = ?').get(id);
  } catch (error) {
    console.error('[database] Failed to get internship:', error.message);
    return null;
  }
}

function getStats() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const stats = db.prepare(`
      SELECT
        COUNT(*) AS total,
        ROUND(COALESCE(AVG(score), 0), 2) AS avgScore,
        SUM(CASE WHEN is_remote = 1 THEN 1 ELSE 0 END) AS remoteCount,
        SUM(CASE WHEN substr(date_scraped, 1, 10) = @today THEN 1 ELSE 0 END) AS todayCount
      FROM internships
    `).get({ today });

    const sourceCounts = db.prepare(`
      SELECT source, COUNT(*) as count FROM internships GROUP BY source
    `).all();

    return {
      total: Number(stats.total || 0),
      avgScore: Number(stats.avgScore || 0),
      remoteCount: Number(stats.remoteCount || 0),
      todayCount: Number(stats.todayCount || 0),
      sources: sourceCounts
    };
  } catch (error) {
    console.error('[database] Failed to fetch stats:', error.message);
    return { total: 0, avgScore: 0, remoteCount: 0, todayCount: 0, sources: [] };
  }
}

function deleteInternship(id) {
  try {
    const result = db.prepare('DELETE FROM internships WHERE id = ?').run(id);
    return result;
  } catch (error) {
    console.error('[database] Failed to delete internship:', error.message);
    return { changes: 0 };
  }
}

function clearAll() {
  try {
    const result = db.prepare('DELETE FROM internships').run();
    return result;
  } catch (error) {
    console.error('[database] Failed to clear internships:', error.message);
    return { changes: 0 };
  }
}

// ── User Functions ──

const createUserStmt = db.prepare(`
  INSERT INTO users (name, email, password_hash, avatar_color) VALUES (@name, @email, @password_hash, @avatar_color)
`);

function createUser(data) {
  try {
    const colors = ['#7c3aed', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const result = createUserStmt.run({
      name: data.name,
      email: data.email.toLowerCase(),
      password_hash: data.password_hash,
      avatar_color: randomColor
    });
    return { id: result.lastInsertRowid, changes: result.changes };
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return { error: 'Email already registered', changes: 0 };
    }
    console.error('[database] Failed to create user:', error.message);
    return { error: error.message, changes: 0 };
  }
}

function findUserByEmail(email) {
  try {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  } catch (error) {
    console.error('[database] Failed to find user:', error.message);
    return null;
  }
}

function getUserById(id) {
  try {
    return db.prepare('SELECT id, name, email, avatar_color, created_at FROM users WHERE id = ?').get(id);
  } catch (error) {
    console.error('[database] Failed to get user:', error.message);
    return null;
  }
}

// ── Application Functions ──

const addApplicationStmt = db.prepare(`
  INSERT OR IGNORE INTO applications (user_id, internship_id, status, notes)
  VALUES (@user_id, @internship_id, @status, @notes)
`);

function addApplication(userId, internshipId, notes = '') {
  try {
    const result = addApplicationStmt.run({
      user_id: userId,
      internship_id: internshipId,
      status: 'Applied',
      notes: notes
    });
    return { id: result.lastInsertRowid, changes: result.changes };
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return { error: 'Already applied to this internship', changes: 0 };
    }
    console.error('[database] Failed to add application:', error.message);
    return { error: error.message, changes: 0 };
  }
}

function removeApplication(userId, internshipId) {
  try {
    return db.prepare('DELETE FROM applications WHERE user_id = ? AND internship_id = ?').run(userId, internshipId);
  } catch (error) {
    console.error('[database] Failed to remove application:', error.message);
    return { changes: 0 };
  }
}

function getUserApplications(userId) {
  try {
    return db.prepare(`
      SELECT a.id as application_id, a.applied_at, a.status, a.notes,
             i.id, i.title, i.company, i.stipend, i.location, i.link, i.apply_link,
             i.source, i.score, i.is_remote, i.duration
      FROM applications a
      JOIN internships i ON a.internship_id = i.id
      WHERE a.user_id = ?
      ORDER BY a.applied_at DESC
    `).all(userId);
  } catch (error) {
    console.error('[database] Failed to get user applications:', error.message);
    return [];
  }
}

function isApplied(userId, internshipId) {
  try {
    const row = db.prepare('SELECT 1 FROM applications WHERE user_id = ? AND internship_id = ?').get(userId, internshipId);
    return !!row;
  } catch (error) {
    return false;
  }
}

function getUserApplicationIds(userId) {
  try {
    const rows = db.prepare('SELECT internship_id FROM applications WHERE user_id = ?').all(userId);
    return rows.map(r => r.internship_id);
  } catch (error) {
    return [];
  }
}

function getApplicationCount(userId) {
  try {
    const row = db.prepare('SELECT COUNT(*) as count FROM applications WHERE user_id = ?').get(userId);
    return row.count;
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
  isApplied,
  getUserApplicationIds,
  getApplicationCount
};
