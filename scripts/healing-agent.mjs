import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from './healing-agent/node_modules/playwright/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = (process.env.SITE_URL || 'https://grouptravelairlines.pages.dev').replace(/\/$/, '');
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || '';

const report = {
  timestamp: new Date().toISOString(),
  site: SITE_URL,
  ok: true,
  checks: [],
  repairs: [],
  failures: []
};

function addCheck(name, ok, details = {}) {
  report.checks.push({ name, ok, ...details });
  if (!ok) {
    report.ok = false;
    report.failures.push({ name, ...details });
  }
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'GTA-Healing-Agent/2.0',
      accept: 'text/html,application/json,text/plain,*/*',
      ...(options.headers || {})
    },
    redirect: 'manual',
    ...options
  });
  return { response, text: await response.text() };
}

function normalizeSlug(value) {
  return String(value || '').trim().replace(/^\/+|\/+$/g, '');
}

function extractTitle(html) {
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '';
}

function extractMeta(html, key, value) {
  const patterns = [
    new RegExp(`<meta[^>]+${key}=["']${value}["'][^>]*content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*${key}=["']${value}["'][^>]*>`, 'i')
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function extractCanonical(html) {
  return html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i)?.[1]?.trim()
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i)?.[1]?.trim()
    || '';
}

async function queryPublishedPosts() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    addCheck('Supabase published-post discovery', false, {
      error: 'SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is not configured in GitHub Actions.'
    });
    return [];
  }

  const query = new URLSearchParams({
    select: 'id,title,slug,published,published_at',
    published: 'eq.true',
    order: 'published_at.desc',
    limit: '10'
  });

  const { response, text } = await fetchText(`${SUPABASE_URL}/rest/v1/blog_posts?${query}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    }
  });

  addCheck('Supabase public published-post API', response.ok, {
    status: response.status
  });

  if (!response.ok) {
    throw new Error(`Supabase API error: HTTP ${response.status} ${text}`);
  }

  return JSON.parse(text);
}

async function checkPage(page, url, label, expectedText = '') {
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });
  const status = response?.status() ?? 0;
  const finalUrl = page.url();
  const body = await page.locator('body').innerText().catch(() => '');

  addCheck(`${label} HTTP 200`, status === 200, { url, status });
  addCheck(`${label} exact public URL`, finalUrl === url, { url, finalUrl });

  if (expectedText) {
    addCheck(`${label} contains expected content`, body.includes(expectedText), {
      expectedText
    });
  }

  for (const phrase of [
    'permission denied for function is_admin',
    'This article could not be found.',
    'Unable to load this article.',
    'ERR_TOO_MANY_REDIRECTS'
  ]) {
    addCheck(`${label} free of runtime error: ${phrase}`, !body.includes(phrase), {});
  }

  return { body };
}

async function checkSeo(url, label, expectedCanonical) {
  const { response, text } = await fetchText(url);
  addCheck(`${label} HTML HTTP 200`, response.status === 200, { status: response.status });
  if (!response.ok) return;

  const title = extractTitle(text);
  const description = extractMeta(text, 'name', 'description');
  const robots = extractMeta(text, 'name', 'robots');
  const canonical = extractCanonical(text);
  const ogUrl = extractMeta(text, 'property', 'og:url');

  addCheck(`${label} title exists`, Boolean(title), { title });
  addCheck(`${label} meta description exists`, Boolean(description), {});
  addCheck(`${label} canonical exact`, canonical === expectedCanonical, {
    canonical,
    expectedCanonical
  });
  addCheck(`${label} og:url exact`, ogUrl === expectedCanonical, {
    ogUrl,
    expectedCanonical
  });
  addCheck(`${label} robots index/follow`, /index\s*,\s*follow/i.test(robots), { robots });

  return text;
}

async function checkArticleSchema(url, label) {
  const { response, text } = await fetchText(url);
  if (!response.ok) return;
  addCheck(`${label} BlogPosting schema`, /application\/ld\+json[\s\S]*BlogPosting/i.test(text), {});
}

function desiredSitemap(posts) {
  const urls = [
    `${SITE_URL}/`,
    `${SITE_URL}/blog`,
    ...posts
      .map(post => normalizeSlug(post.slug))
      .filter(Boolean)
      .map(slug => `${SITE_URL}/blog/${slug}`)
  ];

  const unique = [...new Set(urls)];
  const rows = unique.map(url => `  <url>\n    <loc>${url}</loc>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`;
}

async function healStaticFiles(posts) {
  const sitemapPath = path.join(ROOT, 'sitemap.xml');
  const robotsPath = path.join(ROOT, 'robots.txt');

  const sitemap = desiredSitemap(posts);
  let currentSitemap = '';
  try { currentSitemap = await fs.readFile(sitemapPath, 'utf8'); } catch {}

  if (currentSitemap.trim() !== sitemap.trim()) {
    await fs.writeFile(sitemapPath, sitemap, 'utf8');
    report.repairs.push('Updated sitemap.xml with current published article URLs.');
  }

  const robots = `User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
  let currentRobots = '';
  try { currentRobots = await fs.readFile(robotsPath, 'utf8'); } catch {}

  if (currentRobots.trim() !== robots.trim()) {
    await fs.writeFile(robotsPath, robots, 'utf8');
    report.repairs.push('Updated robots.txt to the live site sitemap.');
  }
}

async function checkStaticFiles(posts) {
  const { response: robotsResponse, text: robots } = await fetchText(`${SITE_URL}/robots.txt`);
  addCheck('robots.txt public', robotsResponse.status === 200, { status: robotsResponse.status });
  addCheck('robots.txt sitemap URL', robots.includes(`${SITE_URL}/sitemap.xml`), {});

  const { response: sitemapResponse, text: sitemap } = await fetchText(`${SITE_URL}/sitemap.xml`);
  addCheck('sitemap.xml public', sitemapResponse.status === 200, { status: sitemapResponse.status });

  for (const post of posts) {
    const slug = normalizeSlug(post.slug);
    if (!slug) continue;
    const url = `${SITE_URL}/blog/${slug}`;
    addCheck(`sitemap contains ${slug}`, sitemap.includes(`<loc>${url}</loc>`), { url });
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();

  page.on('console', message => {
    if (message.type() === 'error') {
      report.ok = false;
      report.failures.push({ name: 'browser console error', message: message.text() });
    }
  });
  page.on('pageerror', error => {
    report.ok = false;
    report.failures.push({ name: 'browser page error', message: error.message });
  });

  try {
    const posts = await queryPublishedPosts();
    await healStaticFiles(posts);

    await checkPage(page, `${SITE_URL}/`, 'Homepage');
    await checkSeo(`${SITE_URL}/`, 'Homepage SEO', `${SITE_URL}/`);

    const blog = await checkPage(
      page,
      `${SITE_URL}/blog`,
      'Blog page',
      posts[0]?.title || ''
    );

    if (posts.length > 0) {
      addCheck('Blog contains at least one published article', /Read article|Latest|Travel Insights|Group Travel/i.test(blog.body), {});
    }

    await checkSeo(`${SITE_URL}/blog`, 'Blog SEO', `${SITE_URL}/blog`);

    for (const post of posts.slice(0, 5)) {
      const slug = normalizeSlug(post.slug);
      if (!slug) continue;
      const articleUrl = `${SITE_URL}/blog/${slug}`;
      await checkPage(page, articleUrl, `Article ${slug}`, post.title);
      await checkSeo(articleUrl, `Article ${slug} SEO`, articleUrl);
      await checkArticleSchema(articleUrl, `Article ${slug}`);
    }

    await checkStaticFiles(posts);
  } catch (error) {
    report.ok = false;
    report.failures.push({
      name: 'Healing agent failure',
      message: error.stack || error.message
    });
  } finally {
    await browser.close();
  }

  await fs.writeFile(
    path.join(ROOT, 'HEALING-REPORT.json'),
    JSON.stringify(report, null, 2),
    'utf8'
  );

  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.ok ? 0 : 1;
}

main();

