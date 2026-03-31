function extractStipendValue(stipend = '') {
  try {
    const normalized = String(stipend).replace(/,/g, '').toLowerCase();

    if (!normalized || normalized.includes('unpaid') || normalized.includes('0')) {
      const numbers = normalized.match(/\d+/g);
      if (!numbers || numbers.every((value) => Number(value) === 0)) {
        return 0;
      }
    }

    const matches = normalized.match(/\d+/g);
    if (!matches) {
      return 0;
    }

    return Math.max(...matches.map((value) => Number(value)));
  } catch (error) {
    console.error('[scorer] Failed to extract stipend value:', error.message);
    return 0;
  }
}

function getRoleScore(title = '') {
  const normalized = String(title).toLowerCase();

  const groups = [
    { keywords: ['software', 'developer', 'engineer', 'full stack'], score: 35 },
    { keywords: ['data', 'ml', 'ai', 'machine learning'], score: 35 },
    { keywords: ['web', 'frontend', 'backend', 'react', 'node'], score: 30 },
    { keywords: ['python', 'java', 'android', 'ios'], score: 25 },
    { keywords: ['design', 'ui', 'ux'], score: 20 },
    { keywords: ['marketing', 'content', 'social media'], score: 10 },
    { keywords: ['hr', 'finance', 'operations'], score: 5 }
  ];

  for (const group of groups) {
    if (group.keywords.some((keyword) => normalized.includes(keyword))) {
      return group.score;
    }
  }

  return 0;
}

function getLocationScore(location = '') {
  const normalized = String(location).toLowerCase();

  if (normalized.includes('work from home') || normalized.includes('remote')) {
    return { score: 20, isRemote: 1 };
  }

  if (normalized.includes('nagpur')) {
    return { score: 15, isRemote: 0 };
  }

  if (
    normalized.includes('pune') ||
    normalized.includes('mumbai') ||
    normalized.includes('bangalore') ||
    normalized.includes('hyderabad')
  ) {
    return { score: 10, isRemote: 0 };
  }

  if (normalized.trim()) {
    return { score: 5, isRemote: 0 };
  }

  return { score: 0, isRemote: 0 };
}

function getRecencyScore(dateScraped) {
  try {
    const scrapedAt = new Date(dateScraped || new Date().toISOString());
    if (Number.isNaN(scrapedAt.getTime())) {
      return 0;
    }

    const now = new Date();
    const diffMs = now.getTime() - scrapedAt.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const sameDay = now.toISOString().slice(0, 10) === scrapedAt.toISOString().slice(0, 10);

    if (sameDay) {
      return 15;
    }

    if (diffDays <= 3) {
      return 10;
    }

    if (diffDays <= 7) {
      return 5;
    }

    return 0;
  } catch (error) {
    console.error('[scorer] Failed to calculate recency score:', error.message);
    return 0;
  }
}

function getStipendScore(stipendValue) {
  if (stipendValue >= 20000) {
    return 30;
  }

  if (stipendValue >= 15000) {
    return 25;
  }

  if (stipendValue >= 10000) {
    return 20;
  }

  if (stipendValue >= 5000) {
    return 10;
  }

  return 0;
}

function calculateScore(internship = {}) {
  try {
    const stipendValue = extractStipendValue(internship.stipend);
    const roleScore = getRoleScore(internship.title);
    const locationDetails = getLocationScore(internship.location);
    const recencyScore = getRecencyScore(internship.date_scraped);
    const stipendScore = getStipendScore(stipendValue);

    const score = Math.min(100, stipendScore + roleScore + locationDetails.score + recencyScore);

    return {
      score,
      stipend_value: stipendValue,
      is_remote: locationDetails.isRemote
    };
  } catch (error) {
    console.error('[scorer] Failed to calculate score:', error.message);
    return {
      score: 0,
      stipend_value: 0,
      is_remote: 0
    };
  }
}

module.exports = {
  calculateScore
};
