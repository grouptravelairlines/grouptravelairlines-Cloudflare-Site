function escapeHtml(value = "") {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function readAttribute(attributes, name) {
  const pattern = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i"
  );
  const match = attributes.match(pattern);
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : "";
}

function sanitizeContent(value = "") {
  let html = String(value ?? "");

  html = html.replace(
    /<(script|style|iframe|object|embed|svg|math|form|button|textarea|video|audio)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    ""
  );

  html = html.replace(
    /<\/?(?:script|style|iframe|object|embed|svg|math|form|button|textarea|video|audio)\b[^>]*>/gi,
    ""
  );

  const allowed = new Set([
    "p", "br", "h2", "h3", "ul", "ol", "li",
    "strong", "em", "b", "i", "a", "blockquote", "img"
  ]);

  return html.replace(/<[^>]*>/g, (token) => {
    const match = token.match(
      /^<\s*(\/?)\s*([a-z0-9]+)\b([^>]*)>$/i
    );

    if (!match) return "";

    const closing = Boolean(match[1]);
    const tag = match[2].toLowerCase();
    const attributes = match[3] || "";

    if (!allowed.has(tag)) return "";

    if (closing) {
      return tag === "br" || tag === "img" ? "" : `</${tag}>`;
    }

    if (tag === "br") return "<br>";

    if (tag === "a") {
      const href = readAttribute(attributes, "href").trim();

      if (!/^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(href)) {
        return "<a>";
      }

      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">`;
    }

    if (tag === "img") {
      const src = readAttribute(attributes, "src").trim();
      const alt = readAttribute(attributes, "alt").trim();

      if (!/^(https?:\/\/|\/(?!\/))/i.test(src)) return "";

      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy">`;
    }

    return `<${tag}>`;
  });
}

function replaceElementInner(html, tagName, id, innerHtml) {
  const pattern = new RegExp(
    `(<${tagName}\\b(?=[^>]*\\bid="${id}")[^>]*>)[\\s\\S]*?(<\\/${tagName}\\s*>)`,
    "i"
  );

  return html.replace(
    pattern,
    (_match, opening, closing) => `${opening}${innerHtml}${closing}`
  );
}

function setMetaById(html, id, attribute, content) {
  const tag = `<meta id="${id}" ${attribute} content="${escapeHtml(content)}">`;
  const pattern = new RegExp(
    `<meta\\b(?=[^>]*\\bid="${id}")[^>]*>`,
    "i"
  );

  if (pattern.test(html)) {
    return html.replace(pattern, () => tag);
  }

  return html.replace(
    /<\/head>/i,
    () => `${tag}\n</head>`
  );
}

function textResponse(message, status) {
  return new Response(message, {
    status,
    headers: {
      "content-type": "text/plain; charset=UTF-8",
      "cache-control": "no-store"
    }
  });
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const requestUrl = new URL(request.url);

  const slug = String(params?.slug ?? "")
    .trim()
    .replace(/^\/+|\/+$/g, "");

  if (!slug || slug.includes("/")) {
    return textResponse("Article not found", 404);
  }

  const supabaseUrl = String(env.SUPABASE_URL ?? "")
    .replace(/\/+$/, "");

  const supabaseKey = String(
    env.SUPABASE_PUBLISHABLE_KEY ?? ""
  ).trim();

  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase environment variables are missing.");
    return textResponse("Server configuration error", 500);
  }

  try {
    const templateUrl = new URL(
      "/article-template.html",
      requestUrl.origin
    );

    const templateResponse = await env.ASSETS.fetch(templateUrl);

    if (!templateResponse.ok) {
      return textResponse("Article template not found", 500);
    }

    const apiUrl = new URL("/rest/v1/blog_posts", supabaseUrl);

    apiUrl.searchParams.set(
      "select",
      "id,title,slug,published,published_at,updated_at,seo_title,meta_description,excerpt,author,display_date,featured_image_url,image_alt,content_html"
    );

    apiUrl.searchParams.set("slug", `eq.${slug}`);
    apiUrl.searchParams.set("published", "eq.true");
    apiUrl.searchParams.set("limit", "1");

    const articleResponse = await fetch(apiUrl.toString(), {
      headers: {
        apikey: supabaseKey,
        accept: "application/json"
      }
    });

    if (!articleResponse.ok) {
      console.error(
        "Supabase article lookup failed:",
        articleResponse.status
      );
      return textResponse("Unable to load article", 502);
    }

    const posts = await articleResponse.json();
    const post = Array.isArray(posts) ? posts[0] : null;

    if (!post) {
      return textResponse("Article not found", 404);
    }

    let html = await templateResponse.text();

    const canonicalUrl =
      `${requestUrl.origin}/blog/${encodeURIComponent(slug)}`;

    const title = String(
      post.seo_title || post.title || "Group Travel Airlines"
    );

    const description = String(
      post.meta_description || post.excerpt || ""
    );

    const imageUrl = String(
      post.featured_image_url || ""
    ).trim();

    const safeImageUrl =
      /^(https?:\/\/|\/(?!\/))/i.test(imageUrl)
        ? imageUrl
        : "";

    const dateText =
      post.display_date ||
      (post.published_at
        ? new Date(post.published_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
          })
        : "");

    const author = post.author
      ? `By ${String(post.author)}`
      : "";

    // Set the article's canonical URL and description.
    html = html.replace(
      /<link\b(?=[^>]*\bid="canonical")[^>]*>/i,
      () => `<link id="canonical" rel="canonical" href="${escapeHtml(canonicalUrl)}">`
    );

    html = html.replace(
      /<meta\b(?=[^>]*\bname="description")[^>]*>/i,
      () => `<meta name="description" content="${escapeHtml(description)}">`
    );

    // Set the page title and social metadata.
    html = replaceElementInner(
      html, "title", "pageTitle", escapeHtml(title)
    );

    html = setMetaById(html, "ogTitle", 'property="og:title"', title);
    html = setMetaById(html, "ogDescription", 'property="og:description"', description);
    html = setMetaById(html, "ogUrl", 'property="og:url"', canonicalUrl);
    html = setMetaById(html, "ogImage", 'property="og:image"', safeImageUrl);

    html = setMetaById(html, "twTitle", 'name="twitter:title"', title);
    html = setMetaById(html, "twDescription", 'name="twitter:description"', description);
    html = setMetaById(html, "twImage", 'name="twitter:image"', safeImageUrl);
    html = setMetaById(html, "twUrl", 'name="twitter:url"', canonicalUrl);

    // Mark the article as server-rendered for article-runtime.js.
    html = html.replace(
      /<article\b(?=[^>]*\bid="articleRoot")[^>]*>/i,
      (tag) => {
        const cleanTag = tag.replace(/\sdata-ssr="[^"]*"/i, "");
        return cleanTag.replace(/>$/, ' data-ssr="true">');
      }
    );

    // Insert the real article content before sending HTML to the browser.
    html = replaceElementInner(
      html, "div", "articleDate", escapeHtml(dateText)
    );

    html = replaceElementInner(
      html, "h1", "articleTitle", escapeHtml(post.title || "")
    );

    html = replaceElementInner(
      html, "p", "articleExcerpt", escapeHtml(post.excerpt || "")
    );

    html = replaceElementInner(
      html, "p", "articleByline", escapeHtml(author)
    );

    html = replaceElementInner(
      html, "div", "articleContent",
      sanitizeContent(post.content_html || "")
    );

    const imageTag = safeImageUrl
      ? `<img id="articleImage" class="hero-img" src="${escapeHtml(safeImageUrl)}" alt="${escapeHtml(post.image_alt || post.title || "")}">`
      : '<img id="articleImage" class="hero-img" src="/assets/blog-default.jpg" alt="" hidden>';

    html = html.replace(
      /<img\b(?=[^>]*\bid="articleImage")[^>]*>/i,
      () => imageTag
    );

    // Add article structured data to the initial HTML.
    const schema = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: String(post.title || ""),
      description,
      datePublished: post.published_at || "",
      dateModified: post.updated_at || post.published_at || "",
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": canonicalUrl
      },
      image: safeImageUrl ? [safeImageUrl] : [],
      author: {
        "@type": "Organization",
        name: "Group Travel Airlines"
      },
      publisher: {
        "@type": "Organization",
        name: "Group Travel Airlines"
      }
    };

    const jsonLd = JSON.stringify(schema).replace(/</g, "\\u003c");

    html = html.replace(
      /<\/head>/i,
      () => `<script type="application/ld+json">${jsonLd}</script>\n</head>`
    );

    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=UTF-8",
        "cache-control": "no-store, max-age=0",
        "x-content-type-options": "nosniff"
      }
    });
  } catch (error) {
    console.error("Server-side article rendering failed:", error);
    return textResponse("Unable to load article", 502);
  }
}
