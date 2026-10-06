export async function onRequest(context) {
  const templateUrl = new URL("/article-template.html", context.request.url);

  const response = await context.env.ASSETS.fetch(templateUrl);

  if (!response.ok) {
    return new Response("Article template not found", {
      status: 500,
      headers: {
        "content-type": "text/plain; charset=UTF-8"
      }
    });
  }

  const url = new URL(context.request.url);

  const canonicalUrl = `${url.origin}${url.pathname.replace(/\/+$/, "")}`;

  let html = await response.text();

  html = html.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${canonicalUrl}">`
  );

  html = html.replace(
    /(<meta[^>]+property="og:url"[^>]+content=")[^"]*(")/i,
    `$1${canonicalUrl}$2`
  );

  html = html.replace(
    /(<meta[^>]+name="twitter:url"[^>]+content=")[^"]*(")/i,
    `$1${canonicalUrl}$2`
  );

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=UTF-8",
      "cache-control": "no-cache"
    }
  });
}
