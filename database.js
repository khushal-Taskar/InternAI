const Database = require('better-sqlite3');

console.log('[database] Initializing SQLite database...');

const db = new Database('internai.db');

try {
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS internships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      company TEXT,
      stipend TEXT,
      stipend_value INTEGER,
      location TEXT,
      link TEXT UNIQUE,
      source TEXT DEFAULT 'Internshala',
      score INTEGER DEFAULT 0,
      is_remote INTEGER DEFAULT 0,
      date_scraped TEXT,
      status TEXT DEFAULT 'New'
    )
  `);
  console.log('[database] Database ready.');
} catch (error) {
  console.error('[database] Failed to initialize database:', error.message);
}

function insertInternship(data) {
  try {
    const statement = db.prepare(`
      INSERT OR IGNORE INTO internships (
        title,
        company,
        stipend,
        stipend_value,
        location,
        link,
        source,
        score,
        is_remote,
        date_scraped,
        status
      ) VALUES (
        @title,
        @company,
        @stipend,
        @stipend_value,
        @location,
        @link,
        @source,
        @score,
        @is_remote,
        @date_scraped,
        @status
      )
    `);

    const payload = {
      title: data.title || 'Untitled Internship',
      company: data.company || 'Unknown Company',
      stipend: data.stipend || 'Not specified',
      stipend_value: Number.isFinite(data.stipend_value) ? data.stipend_value : 0,
      location: data.location || 'Not specified',
      link: data.link,
      source: data.source || 'Internshala',
      score: Number.isFinite(data.score) ? data.score : 0,
      is_remote: data.is_remote ? 1 : 0,
      date_scraped: data.date_scraped || new Date().toISOString(),
      status: data.status || 'New'
    };

    const result = statement.run(payload);
    console.log(`[database] Inserted internship: ${payload.title} (${result.changes ? 'new' : 'duplicate'})`);
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

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const allowedSorts = {
      score: 'score DESC, date_scraped DESC',
      date: 'date_scraped DESC, score DESC',
      stipend: 'stipend_value DESC, score DESC'
    };
    const sortKey = String(filters.sort || 'score').toLowerCase();
    const orderBy = allowedSorts[sortKey] || allowedSorts.score;

    const query = `
      SELECT *
      FROM internships
      ${whereClause}
      ORDER BY ${orderBy}
    `;

    return db.prepare(query).all(params);
  } catch (error) {
    console.error('[database] Failed to fetch internships:', error.message);
    return [];
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

    return {
      total: Number(stats.total || 0),
      avgScore: Number(stats.avgScore || 0),
      remoteCount: Number(stats.remoteCount || 0),
      todayCount: Number(stats.todayCount || 0)
    };
  } catch (error) {
    console.error('[database] Failed to fetch stats:', error.message);
    return {
      total: 0,
      avgScore: 0,
      remoteCount: 0,
      todayCount: 0
    };
  }
}

function deleteInternship(id) {
  try {
    const result = db.prepare('DELETE FROM internships WHERE id = ?').run(id);
    console.log(`[database] Deleted internship id=${id}, changes=${result.changes}`);
    return result;
  } catch (error) {
    console.error('[database] Failed to delete internship:', error.message);
    return { changes: 0 };
  }
}

function clearAll() {
  try {
    const result = db.prepare('DELETE FROM internships').run();
    console.log(`[database] Cleared internships table, deleted=${result.changes}`);
    return result;
  } catch (error) {
    console.error('[database] Failed to clear internships:', error.message);
    return { changes: 0 };
  }
}

module.exports = {
  insertInternship,
  getAllInternships,
  getStats,
  deleteInternship,
  clearAll
};
