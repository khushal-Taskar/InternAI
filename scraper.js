require('dotenv').config();

const axios = require('axios');
const cheerio = require('cheerio');

const SCRAPE_URLS = [
  'https://internshala.com/internships/',
  'https://internshala.com/internships/computer-science/'
];

const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9'
};

const MOCK_DATA = [
  {
    title: 'Software Developer Intern',
    company: 'TCS',
    stipend: '₹15,000/month',
    location: 'Work From Home',
    link: 'https://internshala.com?mock=1'
  },
  {
    title: 'Data Science Intern',
    company: 'Infosys',
    stipend: '₹20,000/month',
    location: 'Bangalore',
    link: 'https://internshala.com?mock=2'
  },
  {
    title: 'Web Development Intern',
    company: 'Wipro',
    stipend: '₹10,000/month',
    location: 'Pune',
    link: 'https://internshala.com?mock=3'
  },
  {
    title: 'ML Engineer Intern',
    company: 'Google',
    stipend: '₹25,000/month',
    location: 'Remote',
    link: 'https://internshala.com?mock=4'
  },
  {
    title: 'Android Developer Intern',
    company: 'Flipkart',
    stipend: '₹18,000/month',
    location: 'Work From Home',
    link: 'https://internshala.com?mock=5'
  }
];

function getText(root, selectors) {
  for (const selector of selectors) {
    const value = root.find(selector).first().text().replace(/\s+/g, ' ').trim();
    if (value) {
      return value;
    }
  }
  return '';
}

function getHref(root) {
  const selectors = ['.profile a', 'h3 a', '.title a', 'a'];
  for (const selector of selectors) {
    const href = root.find(selector).first().attr('href');
    if (href) {
      return href;
    }
  }
  return root.attr('href') || '';
}

function normalizeLink(link, fallbackUrl, index) {
  if (!link) {
    return `${fallbackUrl}#listing-${index}`;
  }

  if (link.startsWith('http://') || link.startsWith('https://')) {
    return link;
  }

  if (link.startsWith('//')) {
    return `https:${link}`;
  }

  if (link.startsWith('/')) {
    return `https://internshala.com${link}`;
  }

  return `https://internshala.com/${link.replace(/^\.?\//, '')}`;
}

function buildMockResults() {
  const timestamp = new Date().toISOString();
  console.log('[scraper] Using mock internship data.');

  return MOCK_DATA.map((item) => ({
    ...item,
    source: 'Internshala',
    date_scraped: timestamp,
    status: 'New'
  }));
}

async function scrapePage(url) {
  try {
    console.log(`[scraper] Fetching ${url}`);
    const response = await axios.get(url, {
      headers: REQUEST_HEADERS,
      timeout: 15000
    });

    console.log(`[scraper] Received response from ${url} with status ${response.status}`);
    const $ = cheerio.load(response.data);
    const selectors = [
      '.internship_meta',
      '.individual_internship',
      '.internship-listing',
      '[class*="internship"]'
    ];
    const results = [];
    const seenKeys = new Set();
    const timestamp = new Date().toISOString();

    selectors.forEach((selector) => {
      $(selector).each((index, element) => {
        const root = $(element);
        const title = getText(root, ['.profile a', 'h3', '.title']);
        const company = getText(root, ['.company_name', '.company-name']);
        const stipend = getText(root, ['.stipend', '[class*="stipend"]']);
        const location = getText(root, ['.location_link', '.location']);
        const link = normalizeLink(getHref(root), url, index);

        if (!title || !company) {
          return;
        }

        const dedupeKey = `${title}|${company}|${link}`;
        if (seenKeys.has(dedupeKey)) {
          return;
        }

        seenKeys.add(dedupeKey);
        results.push({
          title,
          company,
          stipend: stipend || 'Not specified',
          location: location || 'Not specified',
          link,
          source: 'Internshala',
          date_scraped: timestamp,
          status: 'New'
        });
      });
    });

    console.log(`[scraper] Parsed ${results.length} internships from ${url}`);
    return results;
  } catch (error) {
    console.error(`[scraper] Failed to scrape ${url}:`, error.message);
    return [];
  }
}

async function scrapeInternships() {
  try {
    console.log('[scraper] Starting internship scrape...');
    const combinedResults = [];
    const seenLinks = new Set();

    for (const url of SCRAPE_URLS) {
      const pageResults = await scrapePage(url);

      pageResults.forEach((internship) => {
        if (!seenLinks.has(internship.link)) {
          seenLinks.add(internship.link);
          combinedResults.push(internship);
        }
      });
    }

    if (combinedResults.length === 0) {
      console.log('[scraper] No internships found from live scrape. Falling back to mock data.');
      return buildMockResults();
    }

    console.log(`[scraper] Scrape completed with ${combinedResults.length} unique internships.`);
    return combinedResults;
  } catch (error) {
    console.error('[scraper] Scrape failed. Falling back to mock data:', error.message);
    return buildMockResults();
  }
}

module.exports = {
  scrapeInternships
};

if (require.main === module) {
  scrapeInternships()
    .then((results) => {
      console.log(`[scraper] Finished standalone run with ${results.length} internships.`);
    })
    .catch((error) => {
      console.error('[scraper] Standalone run failed:', error.message);
    });
}
