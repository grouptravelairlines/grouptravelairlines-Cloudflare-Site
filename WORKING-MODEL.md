# Group Travel Airlines — Cloudflare Working Model

## Public URLs

- Homepage: https://grouptravelairlines.pages.dev/
- Blog: https://grouptravelairlines.pages.dev/blog
- Article: https://grouptravelairlines.pages.dev/blog/{slug}

Article URLs intentionally have **no trailing slash**.

## Deployment

GitHub repository:
`grouptravelairlines/grouptravelairlines-Cloudflare-Site`

Production branch:
`main`

Cloudflare Pages project:
`grouptravelairlines`

Build:
- Framework preset: None
- Build command: `exit 0`
- Build output directory: repository root (`.`)

## Site rules

1. Top navigation contains only Home and Blog.
2. Request a Quote CTA points directly to `https://www.grouptravelairlines.com/`.
3. Homepage article cards are not hard-coded.
4. Homepage fetches `/blog/posts.json` and shows the latest published posts only when posts exist.
5. Blog listing also reads `/blog/posts.json`.
6. Article links use `/blog/{slug}`.
7. `_redirects` maps clean article URLs to their `.html` files while preserving the clean URL in the browser.
8. Trailing-slash article URLs are permanently redirected to the clean no-slash URL.
9. Canonicals should always use the clean no-slash URL.
10. Do not add About/Contact to the main navigation unless explicitly requested.

## Branding

Primary navy: `#122171`
White logo: `/assets/logo-white.png`
Favicon: `/assets/favicon.png`

## Asset policy

The asset folder contains the supplied logo/favicon plus crops extracted from the approved homepage reference. These are source/reference assets; replace them later with full-resolution originals when available, without changing filenames unless the HTML is updated.

## Blog data format

`/blog/posts.json` can be either:
- an array of post objects, or
- `{ "posts": [ ... ] }`

Recommended post fields:
- `slug`
- `title`
- `date`
- `excerpt`
- `image`

Example:
```json
[
  {
    "slug": "how-to-book-an-air-transat-group-flight",
    "title": "How To Book An Air Transat Group Flight?",
    "date": "2026-09-29",
    "excerpt": "Practical information for organizing a group flight.",
    "image": "/assets/blog-group-flights.jpg"
  }
]
```

When an article HTML file is created at `blog/how-to-book-an-air-transat-group-flight.html`, the public URL is:
`/blog/how-to-book-an-air-transat-group-flight`
