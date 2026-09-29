# Group Travel Airlines CMS V2 — Supabase Edition

## Backend already prepared
The Supabase project should contain:
- admin_profiles
- site_settings
- homepage_content
- blog_page
- blog_posts
- public Storage bucket: gta-media
- Storage upload/update/delete policies restricted to admin_profiles.role = admin

## Frontend connection
`supabase-config.js` contains the project's public Supabase URL and publishable key. A publishable key is intended for browser-side applications; never place a Supabase secret/service-role key in this repository.

## Cloudflare Pages deployment
Repository root should receive:
- index.html
- blog.html
- article-template.html
- supabase-config.js
- _redirects
- robots.txt
- sitemap.xml
- blog/posts.json
- js/
- admin/
- assets/ (keep your existing images/logo/favicon)

Cloudflare Pages Build command: `exit 0`
Build output directory: `.`

## Admin
Open: https://grouptravelairlines.pages.dev/admin
Use the Supabase Authentication email/password account that has a matching row in `admin_profiles` with role `admin`.

## Editing
Homepage editor writes to `homepage_content.content` JSONB and `site_settings`.
Blog page editor writes to `blog_page`.
Article editor writes to `blog_posts`.
Featured published posts are shown on the homepage (maximum 3).

## Images
The dashboard uploads images to the `gta-media` bucket. Public URLs are saved to the corresponding content record.

## Clean article URLs
Published article URLs are `/blog/<slug>` with no trailing slash. `_redirects` serves `/article-template.html` while the browser keeps the clean URL.

## Existing assets
Do not remove `assets/logo-white.png`, `assets/favicon.png`, or the existing high-resolution travel images from the repository.
