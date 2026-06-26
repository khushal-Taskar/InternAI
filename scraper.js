require('dotenv').config();

const axios = require('axios');

// ── Mock Data Fallback (used if API key missing or rate limited) ──

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

// ── Helper ──

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

// ── JSearch API (RapidAPI) ──

/**
 * Converts a JSearch API job result to our internship schema.
 * Tries to extract stipend from salary fields.
 */
function mapJSearchJob(job, source) {
  const title = job.job_title || 'Internship';
  const company = job.employer_name || 'Company';
  const location = job.job_is_remote
    ? 'Remote'
    : [job.job_city, job.job_state, job.job_country].filter(Boolean).join(', ') || 'India';

  // Stipend / salary
  let stipend = 'Not disclosed';
  if (job.job_min_salary && job.job_max_salary) {
    const currency = job.job_salary_currency || 'INR';
    const period = job.job_salary_period || 'MONTH';
    const periodLabel = period === 'MONTH' ? '/month' : period === 'YEAR' ? '/year' : '';
    stipend = `${currency} ${Math.round(job.job_min_salary).toLocaleString()}–${Math.round(job.job_max_salary).toLocaleString()}${periodLabel}`;
  } else if (job.job_min_salary) {
    stipend = `INR ${Math.round(job.job_min_salary).toLocaleString()}/month`;
  }

  const link = job.job_apply_link || job.job_google_link || '#';

  return {
    title,
    company,
    stipend,
    location,
    link,
    apply_link: link,
    source,
    duration: '',
    date_scraped: new Date().toISOString(),
    status: 'New'
  };
}

/**
 * Fetches internships from JSearch API using a given query.
 * Returns array of mapped internship objects, or null on failure.
 */
async function fetchJSearch(query, source) {
  const apiKey = process.env.RAPIDAPI_KEY;

  if (!apiKey || apiKey === 'your_rapidapi_key_here') {
    console.log(`[scraper] RAPIDAPI_KEY not set — skipping JSearch for "${query}"`);
    return null;
  }

  try {
    console.log(`[scraper] JSearch query: "${query} internship"`);
    const response = await axios.get('https://jsearch.p.rapidapi.com/search-v2', {
      params: {
        query: `${query} internship`,
        page: '1',
        num_pages: '1',
        country: 'in',
        language: 'en'
      },
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
      },
      timeout: 20000
    });

    // /search-v2 returns: { status, request_id, parameters, data: { jobs: [...] } }
    const rawData = response.data;
    const jobs = Array.isArray(rawData?.data?.jobs)
      ? rawData.data.jobs
      : Array.isArray(rawData?.data)
      ? rawData.data
      : Array.isArray(rawData?.jobs)
      ? rawData.jobs
      : Array.isArray(rawData)
      ? rawData
      : [];

    console.log(`[scraper] JSearch "${query}": ${jobs.length} results`);
    if (jobs.length === 0) {
      console.warn('[scraper] JSearch returned 0 jobs. Response keys:', Object.keys(rawData || {}));
    }
    return jobs.map(job => mapJSearchJob(job, source));
  } catch (error) {
    const status = error.response?.status;
    const msg = error.response?.data?.message || error.message;

    if (status === 429) {
      console.warn('[scraper] JSearch rate limit hit (429). Falling back to mock data.');
    } else if (status === 403) {
      console.warn('[scraper] JSearch API key invalid or not subscribed (403).');
    } else {
      console.error(`[scraper] JSearch API error for "${query}":`, msg);
    }
    return null;
  }
}

// ── Source-specific scrapers using JSearch ──

async function scrapeInternshala() {
  const results = await fetchJSearch('software developer India', 'Internshala');
  if (results && results.length > 0) return results;
  return buildMockResults(MOCK_INTERNSHALA, 'Internshala');
}

async function scrapeAICTE() {
  const results = await fetchJSearch('data science ML India', 'AICTE');
  if (results && results.length > 0) return results;
  return buildMockResults(MOCK_AICTE, 'AICTE');
}

async function scrapeNaukri() {
  const results = await fetchJSearch('remote work from home India', 'Naukri');
  if (results && results.length > 0) return results;
  return buildMockResults(MOCK_NAUKRI, 'Naukri');
}

// ── Combined Scraper ──

async function scrapeInternships() {
  const apiKey = process.env.RAPIDAPI_KEY;
  const isVercel = !!(process.env.VERCEL || process.env.VERCEL_ENV);

  // On Vercel without API key, use mock instantly (no scraping overhead)
  if (isVercel && (!apiKey || apiKey === 'your_rapidapi_key_here')) {
    console.log('[scraper] Vercel env + no API key — using mock data.');
    return [
      ...buildMockResults(MOCK_INTERNSHALA, 'Internshala'),
      ...buildMockResults(MOCK_AICTE, 'AICTE'),
      ...buildMockResults(MOCK_NAUKRI, 'Naukri')
    ];
  }

  console.log('[scraper] Starting JSearch multi-query scrape...');

  try {
    const allResults = [];
    const seenLinks = new Set();

    const addResults = (items) => {
      for (const item of items) {
        if (!seenLinks.has(item.link)) {
          seenLinks.add(item.link);
          allResults.push(item);
        }
      }
    };

    // Run sequentially with small delay to avoid 429 rate limiting
    const internshalaResults = await scrapeInternshala();
    addResults(internshalaResults);

    await new Promise(r => setTimeout(r, 1500));

    const aicteResults = await scrapeAICTE();
    addResults(aicteResults);

    await new Promise(r => setTimeout(r, 1500));

    const naukriResults = await scrapeNaukri();
    addResults(naukriResults);

    console.log(`[scraper] JSearch scrape done: ${allResults.length} total unique internships`);
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
      if (results.length > 0) {
        console.log('\nSample result:');
        console.log(JSON.stringify(results[0], null, 2));
      }
    })
    .catch((error) => {
      console.error('[scraper] Standalone run failed:', error.message);
    });
}
