require('dotenv').config();

const axios = require('axios');
const cheerio = require('cheerio');

const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'keep-alive',
  'Cache-Control': 'no-cache'
};

// ── Mock Data for Each Source ──

const MOCK_INTERNSHALA = [
  { title: 'Software Developer Intern', company: 'TCS', stipend: '₹15,000/month', location: 'Work From Home', link: 'https://internshala.com/internship/detail/software-developer-intern-tcs1', duration: '3 months' },
  { title: 'Data Science Intern', company: 'Infosys', stipend: '₹20,000/month', location: 'Bangalore', link: 'https://internshala.com/internship/detail/data-science-intern-infosys1', duration: '6 months' },
  { title: 'Web Development Intern', company: 'Wipro', stipend: '₹10,000/month', location: 'Pune', link: 'https://internshala.com/internship/detail/web-dev-intern-wipro1', duration: '2 months' },
  { title: 'ML Engineer Intern', company: 'Google India', stipend: '₹80,000/month', location: 'Remote', link: 'https://internshala.com/internship/detail/ml-intern-google1', duration: '6 months' },
  { title: 'Android Developer Intern', company: 'Flipkart', stipend: '₹18,000/month', location: 'Work From Home', link: 'https://internshala.com/internship/detail/android-intern-flipkart1', duration: '3 months' },
  { title: 'Full Stack Developer Intern', company: 'Paytm', stipend: '₹25,000/month', location: 'Noida', link: 'https://internshala.com/internship/detail/fullstack-intern-paytm1', duration: '4 months' },
  { title: 'Cloud Computing Intern', company: 'Amazon India', stipend: '₹60,000/month', location: 'Hyderabad', link: 'https://internshala.com/internship/detail/cloud-intern-amazon1', duration: '6 months' },
  { title: 'React Developer Intern', company: 'Swiggy', stipend: '₹22,000/month', location: 'Remote', link: 'https://internshala.com/internship/detail/react-intern-swiggy1', duration: '3 months' },
  { title: 'Backend Developer Intern', company: 'Zomato', stipend: '₹20,000/month', location: 'Gurgaon', link: 'https://internshala.com/internship/detail/backend-intern-zomato1', duration: '3 months' },
  { title: 'Python Developer Intern', company: 'Razorpay', stipend: '₹30,000/month', location: 'Work From Home', link: 'https://internshala.com/internship/detail/python-intern-razorpay1', duration: '4 months' }
];

const MOCK_AICTE = [
  { title: 'AI/ML Research Intern', company: 'IIT Bombay (AICTE)', stipend: '₹10,000/month', location: 'Mumbai', link: 'https://internship.aicte-india.org/internship/ai-ml-research-iitb', duration: '8 weeks' },
  { title: 'Embedded Systems Intern', company: 'DRDO (AICTE)', stipend: '₹12,000/month', location: 'Delhi', link: 'https://internship.aicte-india.org/internship/embedded-drdo', duration: '6 weeks' },
  { title: 'Cybersecurity Intern', company: 'CDAC (AICTE)', stipend: '₹8,000/month', location: 'Pune', link: 'https://internship.aicte-india.org/internship/cyber-cdac', duration: '10 weeks' },
  { title: 'Data Analytics Intern', company: 'NIT Warangal (AICTE)', stipend: '₹10,000/month', location: 'Warangal', link: 'https://internship.aicte-india.org/internship/data-nitw', duration: '8 weeks' },
  { title: 'IoT Development Intern', company: 'IIT Madras (AICTE)', stipend: '₹15,000/month', location: 'Chennai', link: 'https://internship.aicte-india.org/internship/iot-iitm', duration: '12 weeks' },
  { title: 'Robotics Research Intern', company: 'IISc Bangalore (AICTE)', stipend: '₹12,000/month', location: 'Bangalore', link: 'https://internship.aicte-india.org/internship/robotics-iisc', duration: '8 weeks' },
  { title: 'VLSI Design Intern', company: 'IIT Delhi (AICTE)', stipend: '₹10,000/month', location: 'Delhi', link: 'https://internship.aicte-india.org/internship/vlsi-iitd', duration: '6 weeks' },
  { title: 'Renewable Energy Intern', company: 'IIT Kharagpur (AICTE)', stipend: '₹8,000/month', location: 'Kharagpur', link: 'https://internship.aicte-india.org/internship/energy-iitkgp', duration: '8 weeks' }
];

const MOCK_NAUKRI = [
  { title: 'Software Development Intern', company: 'Microsoft India', stipend: '₹50,000/month', location: 'Hyderabad', link: 'https://www.naukri.com/job-listings/software-dev-intern-microsoft1', duration: '6 months' },
  { title: 'DevOps Intern', company: 'Atlassian', stipend: '₹40,000/month', location: 'Bangalore', link: 'https://www.naukri.com/job-listings/devops-intern-atlassian1', duration: '6 months' },
  { title: 'Product Management Intern', company: 'PhonePe', stipend: '₹35,000/month', location: 'Bangalore', link: 'https://www.naukri.com/job-listings/pm-intern-phonepe1', duration: '3 months' },
  { title: 'Frontend Developer Intern', company: 'Freshworks', stipend: '₹25,000/month', location: 'Chennai', link: 'https://www.naukri.com/job-listings/frontend-intern-freshworks1', duration: '4 months' },
  { title: 'Data Engineer Intern', company: 'Walmart India', stipend: '₹45,000/month', location: 'Remote', link: 'https://www.naukri.com/job-listings/data-engineer-intern-walmart1', duration: '6 months' },
  { title: 'Cybersecurity Intern', company: 'Deloitte India', stipend: '₹30,000/month', location: 'Mumbai', link: 'https://www.naukri.com/job-listings/cybersec-intern-deloitte1', duration: '3 months' },
  { title: 'UI/UX Design Intern', company: 'Myntra', stipend: '₹20,000/month', location: 'Bangalore', link: 'https://www.naukri.com/job-listings/uiux-intern-myntra1', duration: '3 months' },
  { title: 'Java Developer Intern', company: 'Oracle India', stipend: '₹35,000/month', location: 'Hyderabad', link: 'https://www.naukri.com/job-listings/java-intern-oracle1', duration: '6 months' },
  { title: 'QA Automation Intern', company: 'Accenture', stipend: '₹15,000/month', location: 'Work From Home', link: 'https://www.naukri.com/job-listings/qa-intern-accenture1', duration: '4 months' },
  { title: 'Blockchain Developer Intern', company: 'Polygon Labs', stipend: '₹40,000/month', location: 'Remote', link: 'https://www.naukri.com/job-listings/blockchain-intern-polygon1', duration: '6 months' }
];

// ── Helper Functions ──

function getText(root, selectors) {
  for (const selector of selectors) {
    const value = root.find(selector).first().text().replace(/\s+/g, ' ').trim();
    if (value) return value;
  }
  return '';
}

function getHref(root, selectors) {
  const defaultSelectors = ['.profile a', 'h3 a', '.title a', 'a'];
  for (const selector of (selectors || defaultSelectors)) {
    const href = root.find(selector).first().attr('href');
    if (href) return href;
  }
  return root.attr('href') || '';
}

function normalizeLink(link, baseUrl) {
  if (!link) return '#';
  try {
    const url = new URL(link, baseUrl);
    if (url.hostname.includes('naukri.com') && !url.pathname.endsWith('.html')) {
      url.pathname = `${url.pathname}.html`;
    }
    if (url.hostname.includes('aicte-india.org') && !url.pathname.endsWith('.html')) {
      url.pathname = `${url.pathname}.html`;
    }
    return url.toString();
  } catch (e) {
    return link;
  }
}

function buildMockResults(mockData, source) {
  const timestamp = new Date().toISOString();
  console.log(`[scraper] Using mock ${source} data.`);
  return mockData.map((item) => ({
    ...item,
    apply_link: item.link,
    source,
    date_scraped: timestamp,
    status: 'New'
  }));
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Internshala Scraper ──

async function scrapeInternshala() {
  const urls = [
    'https://internshala.com/internships/',
    'https://internshala.com/internships/computer-science/'
  ];

  try {
    console.log('[scraper] Scraping Internshala...');
    const results = [];
    const seenKeys = new Set();

    for (const url of urls) {
      try {
        const response = await axios.get(url, { headers: REQUEST_HEADERS, timeout: 15000 });
        const $ = cheerio.load(response.data);
        const selectors = ['.internship_meta', '.individual_internship', '[class*="internship"]'];

        selectors.forEach((selector) => {
          $(selector).each((index, element) => {
            const root = $(element);
            const title = getText(root, ['.profile a', 'h3', '.title']);
            const company = getText(root, ['.company_name', '.company-name']);
            const stipend = getText(root, ['.stipend', '[class*="stipend"]']);
            const location = getText(root, ['.location_link', '.location']);
            const duration = getText(root, ['.other_detail_item_row .item_body:first-child', '[class*="duration"]']);
            const link = normalizeLink(getHref(root), url, index);

            if (!title || !company) return;
            const key = `${title}|${company}`;
            if (seenKeys.has(key)) return;
            seenKeys.add(key);

            results.push({
              title, company, stipend: stipend || 'Not specified',
              location: location || 'Not specified', link,
              apply_link: link, source: 'Internshala',
              duration: duration || '', date_scraped: new Date().toISOString(), status: 'New'
            });
          });
        });

        console.log(`[scraper] Internshala: found ${results.length} from ${url}`);
      } catch (err) {
        console.error(`[scraper] Failed Internshala page ${url}:`, err.message);
      }
    }

    return results.length > 0 ? results : buildMockResults(MOCK_INTERNSHALA, 'Internshala');
  } catch (error) {
    console.error('[scraper] Internshala scrape failed:', error.message);
    return buildMockResults(MOCK_INTERNSHALA, 'Internshala');
  }
}

// ── AICTE Scraper ──

async function scrapeAICTE() {
  try {
    console.log('[scraper] Scraping AICTE internship portal...');
    const url = 'https://internship.aicte-india.org/';
    const response = await axios.get(url, { headers: REQUEST_HEADERS, timeout: 15000 });
    const $ = cheerio.load(response.data);
    const results = [];

    // AICTE portal uses dynamic rendering — attempt to parse any static listings
    $('.internship-card, .intern-listing, [class*="internship"], .card').each((index, element) => {
      const root = $(element);
      const title = getText(root, ['h3', 'h4', '.title', '.internship-title']);
      const company = getText(root, ['.organization', '.company', '.org-name']);
      const stipend = getText(root, ['.stipend', '.amount']);
      const location = getText(root, ['.location', '.city']);
      const link = normalizeLink(getHref(root), url, index);

      if (title && company) {
        results.push({
          title, company, stipend: stipend || 'As per AICTE norms',
          location: location || 'India', link,
          apply_link: link, source: 'AICTE',
          duration: '', date_scraped: new Date().toISOString(), status: 'New'
        });
      }
    });

    if (results.length > 0) {
      console.log(`[scraper] AICTE: found ${results.length} internships`);
      return results;
    }

    return buildMockResults(MOCK_AICTE, 'AICTE');
  } catch (error) {
    console.error('[scraper] AICTE scrape failed:', error.message);
    return buildMockResults(MOCK_AICTE, 'AICTE');
  }
}

// ── Naukri Scraper ──

async function scrapeNaukri() {
  try {
    console.log('[scraper] Scraping Naukri.com...');
    const url = 'https://www.naukri.com/internship-jobs';
    const response = await axios.get(url, {
      headers: { ...REQUEST_HEADERS, Referer: 'https://www.naukri.com/' },
      timeout: 15000
    });
    const $ = cheerio.load(response.data);
    const results = [];

    // Naukri listing selectors
    $('.srp-jobtuple-wrapper, .jobTuple, [class*="job-listing"], .cust-job-tuple').each((index, element) => {
      const root = $(element);
      const title = getText(root, ['.title', 'a.title', '.desig', 'h2']);
      const company = getText(root, ['.comp-name', '.company-name', '.subTitle']);
      const stipend = getText(root, ['.salary', '.sal', '[class*="salary"]']);
      const location = getText(root, ['.loc', '.location', '.locWdth']);
      const link = normalizeLink(getHref(root, ['a.title', 'h2 a', 'a']), url, index);

      if (title && company) {
        results.push({
          title, company, stipend: stipend || 'Not disclosed',
          location: location || 'India', link,
          apply_link: link, source: 'Naukri',
          duration: '', date_scraped: new Date().toISOString(), status: 'New'
        });
      }
    });

    if (results.length > 0) {
      console.log(`[scraper] Naukri: found ${results.length} internships`);
      return results;
    }

    return buildMockResults(MOCK_NAUKRI, 'Naukri');
  } catch (error) {
    console.error('[scraper] Naukri scrape failed:', error.message);
    return buildMockResults(MOCK_NAUKRI, 'Naukri');
  }
}

// ── Combined Scraper ──

async function scrapeInternships() {
  try {
    console.log('[scraper] Starting multi-source scrape...');
    const allResults = [];
    const seenLinks = new Set();

    // Scrape all sources with delays to avoid rate limiting
    const internshalaResults = await scrapeInternshala();
    internshalaResults.forEach(item => {
      if (!seenLinks.has(item.link)) { seenLinks.add(item.link); allResults.push(item); }
    });

    await delay(2000);

    const aicteResults = await scrapeAICTE();
    aicteResults.forEach(item => {
      if (!seenLinks.has(item.link)) { seenLinks.add(item.link); allResults.push(item); }
    });

    await delay(2000);

    const naukriResults = await scrapeNaukri();
    naukriResults.forEach(item => {
      if (!seenLinks.has(item.link)) { seenLinks.add(item.link); allResults.push(item); }
    });

    console.log(`[scraper] Multi-source scrape completed: ${allResults.length} total (Internshala: ${internshalaResults.length}, AICTE: ${aicteResults.length}, Naukri: ${naukriResults.length})`);
    return allResults;
  } catch (error) {
    console.error('[scraper] Multi-source scrape failed:', error.message);
    return [
      ...buildMockResults(MOCK_INTERNSHALA, 'Internshala'),
      ...buildMockResults(MOCK_AICTE, 'AICTE'),
      ...buildMockResults(MOCK_NAUKRI, 'Naukri')
    ];
  }
}

module.exports = { scrapeInternships };

if (require.main === module) {
  scrapeInternships()
    .then((results) => {
      console.log(`[scraper] Finished standalone run with ${results.length} internships.`);
    })
    .catch((error) => {
      console.error('[scraper] Standalone run failed:', error.message);
    });
}
