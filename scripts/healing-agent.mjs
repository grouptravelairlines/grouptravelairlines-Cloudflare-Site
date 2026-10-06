import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from 'playwright';

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const SITE_URL = (process.env.SITE_URL || 'https://grouptravelairlines.pages.dev').replace(/\/$/, '');
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || '';
const REPORT_PATH = path.join(ROOT, 'healing-report.json');

const report = {
  timestamp: new Date().toISOString(),
  site: SITE_URL,
  ok: true,
  checks: [],
  repairs: [],
  warnings: [],
  failures: []
};

function addCheck(name, ok, details = {}) {
  report.checks.push({ name, ok, ...details });
  if (!ok) {
    report.ok = false;
    report.failures.push({ name, ...details });
  }
}

function addWarning(name, details = {}) {
  report.warnings.push({ name, ...details });
}

function addRepair(message) {
  report.repairs.push(message);
}

function absoluteUrl(input) {
  return new URL(input, SITE_URL + '/').toString();
}

function cleanArticleUrl(slug) {
  const cleanSlug = String(slug || '').trim().replace(/^\/+|\/+$/g, '');
  return `${SITE_URL}/blog/${encodeURIComponent(cleanSlug)}`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function extractMeta(html, pattern) {
  const match = html.match(pattern);
  return match ? match[1].trim() : '';
}

function extractCanonical(html) {
  return extractMeta(
    html,
    /<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i
  );
}

function extractOgUrl(html) {
  return (
    extractMeta(
      html,
      /<meta\s+[^>]*property=["']og:url["'][^>]*content=["']([^"']*)["'][^>]*>/i
    ) ||
    extractMeta(
      html,
      /<meta\s+[^>]*content=["']([^"']*)["'][^>]*property=["']og:url["'][^>]*>/i
    )
  );
}

function extractTwitterUrl(html) {
  return (
    extractMeta(
      html,
      /<meta\s+[^>]*name=["']twitter:url["'][^>]*content=["']([^"']*)["'][^>]*>/i
    ) ||
    extractMeta(
      html,
      /<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']twitter:url["'][^>]*>/i
    )
  );
}

function extractTitle(html) {
  return extractMeta(html, /<title[^>]*>([\s\S]*?)<\/title>/i).replace(/\s+/g, ' ');
}

function hasBlogPostingSchema(html) {
  const matches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of matches) {
    try {
      const json = JSON.parse(match[1].trim());
      const entries = Array.isArray(json) ? json : [json];
      if (entries.some(item => item && item['@type'] === 'BlogPosting')) return true;
      if (entries.some(item => Array.isArray(item?.['@graph']) && item['@graph'].some(node => node?.['@type'] === 'BlogPosting'))) return true;
    } catch {
      // Ignore malformed/non-JSON-LD script blocks.
    }
  }
  return false;
}

function extractH1(html) {
  return extractMeta(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchText(url, options = {}, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20000);
    try {
      const response = await fetch(url, {
        redirect: options.redirect || 'follow',
        headers: {
          'user-agent': 'GTA-Healing-Agent/3.0',
          'accept': options.accept || 'text/html,application/json,text/plain,*/*',
          ...(options.headers || {})
        },
        signal: controller.signal
      });
      const text = await response.text();
      return { response, text };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 750 * attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

async function getSupabasePosts() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    addWarning('Supabase post discovery skipped', { reason: 'Supabase secrets are not configured.' });
    return [];
  }

  const params = new URLSearchParams({
    select: 'id,title,slug,published,published_at',
    published: 'eq.true',
    order: 'published_at.desc',
    limit: '20'
  });

  try {
    const { response, text } = await fetchText(
      `${SUPABASE_URL}/rest/v1/blog_posts?${params}`,
      {
        accept: 'application/json',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        },
        timeoutMs: 12000
      }
    );

    if (!response.ok) {
      addWarning('Supabase public post discovery unavailable', {
        status: response.status,
        message: text.slice(0, 300)
      });
      return [];
    }

    const posts = JSON.parse(text);
    addCheck('Supabase published-post discovery', true, { count: posts.length });
    return Array.isArray(posts) ? posts : [];
  } catch (error) {
    addWarning('Supabase connection warning', {
      message: error?.cause?.message || error?.message || String(error)
    });
    return [];
  }
}

async function discoverPublicPosts(page) {
  const url = `${SITE_URL}/blog`;
  let response;

  try {
    response = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  } catch (error) {
    addCheck('Public blog page loads', false, {
      status: 0,
      url,
      message: error?.message || String(error)
    });
    return [];
  }

  const status = response?.status() ?? 0;
  addCheck('Public blog page loads', status === 200, { status, url });
  if (status !== 200) return [];

  const blogInfo = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href]')]
      .map(link => ({ href: link.href, text: link.textContent?.trim() || '' }))
      .filter(item => {
        try {
          const pathName = new URL(item.href).pathname.replace(/\/+$/, '');
          return pathName.startsWith('/blog/') && pathName !== '/blog';
        } catch {
          return false;
        }
      });

    const unique = [];
    const seen = new Set();
    for (const item of links) {
      const url = new URL(item.href);
      const slug = url.pathname.replace(/^\/blog\//, '').replace(/\/+$/, '');
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      unique.push({ slug, title: item.text });
    }

    return {
      articleLinks: unique.slice(0, 20),
      cardCount: document.querySelectorAll('#blogGrid article.card, #blogGrid .card').length,
      bodyText: document.body.innerText || ''
    };
  });

  addCheck('Blog renders published article links for anonymous visitors', blogInfo.articleLinks.length > 0, {
    count: blogInfo.articleLinks.length
  });

  if (blogInfo.articleLinks.length > 0) return blogInfo.articleLinks;
  return [];
}

async function checkHome() {
  const url = `${SITE_URL}/`;
  try {
    const { response, text } = await fetchText(url);
    addCheck('Homepage HTTP 200', response.ok && response.status === 200, {
      status: response.status,
      url
    });
    const canonical = extractCanonical(text);
    const ogUrl = extractOgUrl(text);
    addCheck('Homepage canonical exact', canonical === url, { canonical, expectedCanonical: url });
    addCheck('Homepage og:url exact', ogUrl === url, { ogUrl, expectedOgUrl: url });
    addCheck('Homepage has title', Boolean(extractTitle(text)), { title: extractTitle(text) });
  } catch (error) {
    addCheck('Homepage request', false, { url, message: error?.message || String(error) });
  }
}

async function checkBlogRaw() {
  const url = `${SITE_URL}/blog`;
  try {
    const { response, text } = await fetchText(url);
    addCheck('Blog raw HTTP 200', response.ok && response.status === 200, {
      status: response.status,
      url
    });
    const canonical = extractCanonical(text);
    const ogUrl = extractOgUrl(text);
    const twitterUrl = extractTwitterUrl(text);
    addCheck('Blog canonical exact', canonical === url, {
      canonical,
      expectedCanonical: url
    });
    addCheck('Blog og:url exact', ogUrl === url, {
      ogUrl,
      expectedOgUrl: url
    });
    addCheck('Blog twitter:url exact', twitterUrl === url, {
      twitterUrl,
      expectedTwitterUrl: url
    });
    addCheck('Blog has title', Boolean(extractTitle(text)), { title: extractTitle(text) });
  } catch (error) {
    addCheck('Blog raw request', false, { url, message: error?.message || String(error) });
  }
}

async function checkArticle(page, post) {
  const slug = String(post.slug || '').trim().replace(/^\/+|\/+$/g, '');
  if (!slug) return;

  const url = cleanArticleUrl(slug);

  try {
    const { response, text } = await fetchText(url);
    addCheck(`Article ${slug} HTTP 200`, response.ok && response.status === 200, {
      status: response.status,
      url
    });

    const canonical = extractCanonical(text);
    const ogUrl = extractOgUrl(text);
    const twitterUrl = extractTwitterUrl(text);
    const title = extractTitle(text);

    addCheck(`Article ${slug} canonical exact`, canonical === url, {
      canonical,
      expectedCanonical: url
    });

    addCheck(`Article ${slug} og:url exact`, ogUrl === url, {
      ogUrl,
      expectedOgUrl: url
    });

    addCheck(`Article ${slug} twitter:url exact`, twitterUrl === url, {
      twitterUrl,
      expectedTwitterUrl: url
    });

    addCheck(`Article ${slug} has title`, Boolean(title), { title });
    addCheck(`Article ${slug} BlogPosting schema`, hasBlogPostingSchema(text), {});
    addCheck(`Article ${slug} has h1`, Boolean(extractH1(text)), { h1: extractH1(text) });
  } catch (error) {
    addCheck(`Article ${slug} raw request`, false, {
      url,
      message: error?.message || String(error)
    });
    return;
  }

  try {
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    const status = response?.status() ?? 0;
    addCheck(`Article ${slug} browser load`, status === 200, { status, url });

    const articleInfo = await page.evaluate(() => ({
      title: document.querySelector('#articleTitle')?.textContent?.trim() || '',
      contentLength: document.querySelector('#articleContent')?.textContent?.trim().length || 0,
      errorText: document.querySelector('#articleRoot .error')?.textContent?.trim() || ''
    }));

    addCheck(`Article ${slug} renders title`, Boolean(articleInfo.title), articleInfo);
    addCheck(`Article ${slug} renders content`, articleInfo.contentLength > 100 && !articleInfo.errorText, articleInfo);
  } catch (error) {
    addCheck(`Article ${slug} browser request`, false, {
      url,
      message: error?.message || String(error)
    });
  }
}

async function checkSitemap(posts) {
  const url = `${SITE_URL}/sitemap.xml`;
  try {
    const { response, text } = await fetchText(url, { accept: 'application/xml,text/xml,text/plain,*/*' });
    addCheck('Sitemap HTTP 200', response.ok && response.status === 200, {
      status: response.status,
      url
    });

    const required = [`${SITE_URL}/`, `${SITE_URL}/blog`, ...posts.map(post => cleanArticleUrl(post.slug))];
    for (const requiredUrl of required) {
      addCheck(`Sitemap contains ${requiredUrl}`, text.includes(`<loc>${escapeXml(requiredUrl)}</loc>`), {
        url: requiredUrl
      });
    }
  } catch (error) {
    addCheck('Sitemap request', false, { url, message: error?.message || String(error) });
  }
}

async function healStaticFiles(posts) {
  const requiredUrls = [
    `${SITE_URL}/`,
    `${SITE_URL}/blog`,
    ...posts.map(post => cleanArticleUrl(post.slug))
  ];

  const sitemapPath = path.join(ROOT, 'sitemap.xml');
  let sitemap = '';
  try {
    sitemap = await fs.readFile(sitemapPath, 'utf8');
  } catch {
    sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n`;
    addRepair('Created sitemap.xml.');
  }

  if (!/<urlset\b/i.test(sitemap)) {
    sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n`;
    addRepair('Rebuilt malformed sitemap.xml container.');
  }

  for (const url of requiredUrls) {
    const loc = `<loc>${escapeXml(url)}</loc>`;
    if (sitemap.includes(loc)) continue;
    sitemap = sitemap.replace(/<\/urlset>/i, `  <url>\n    ${loc}\n  </url>\n</urlset>`);
    addRepair(`Added ${url} to sitemap.xml.`);
  }

  await fs.writeFile(sitemapPath, sitemap, 'utf8');

  const robotsPath = path.join(ROOT, 'robots.txt');
  let robots = '';
  try {
    robots = await fs.readFile(robotsPath, 'utf8');
  } catch {
    robots = `User-agent: *\nAllow: /\n`;
    addRepair('Created robots.txt.');
  }

  const sitemapLine = `Sitemap: ${SITE_URL}/sitemap.xml`;
  if (!robots.split(/\r?\n/).some(line => line.trim().toLowerCase() === sitemapLine.toLowerCase())) {
    robots = `${robots.trimEnd()}\n${sitemapLine}\n`;
    addRepair('Added live sitemap URL to robots.txt.');
  }

  await fs.writeFile(robotsPath, robots, 'utf8');
}

async function main() {
  let browser;
  try {
    await checkHome();
    await checkBlogRaw();

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      userAgent: 'GTA-Healing-Agent/3.0 anonymous-public-check'
    });

    const publicPosts = await discoverPublicPosts(page);
    const supabasePosts = await getSupabasePosts();

    const merged = new Map();
    for (const post of supabasePosts) {
      if (post?.slug) merged.set(String(post.slug).replace(/^\/+|\/+$/g, ''), post);
    }
    for (const post of publicPosts) {
      if (post?.slug && !merged.has(post.slug)) merged.set(post.slug, { ...post, published: true });
    }

    const posts = [...merged.values()]
      .filter(post => post?.slug)
      .slice(0, 10);

    addCheck('Published article discovery', posts.length > 0, {
      count: posts.length,
      source: supabasePosts.length > 0 ? 'Supabase + public site' : 'public site fallback'
    });

    await healStaticFiles(posts);
    await checkSitemap(posts);

    for (const post of posts) {
      await checkArticle(page, post);
    }
  } catch (error) {
    report.ok = false;
    report.failures.push({
      name: 'Healing agent failure',
      message: error?.stack || error?.message || String(error)
    });
  } finally {
    if (browser) await browser.close();

    report.ok = report.failures.length === 0;
    await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(report, null, 2));

    process.exitCode = report.failures.length > 0 ? 1 : 0;
  }
}

await main();
