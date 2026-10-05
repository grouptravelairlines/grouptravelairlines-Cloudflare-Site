export async function onRequestGet(context) {
  const templateUrl = new URL("/article-template", context.request.url);

  const response = await context.env.ASSETS.fetch(templateUrl);

  if (!response.ok) {
    return new Response("Article template not found", {
      status: 500,
      headers: {
        "content-type": "text/plain; charset=UTF-8"
      }
    });
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=UTF-8",
      "cache-control": "no-cache"
    }
  });
}
