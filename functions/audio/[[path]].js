export async function onRequest(context) {
  const { params, env } = context;
  const sub = Array.isArray(params.path) ? params.path.join('/') : params.path;
  const key = `audio/${sub}`;

  const obj = await env.audio.get(key);
  if (!obj) return new Response('Not Found', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(obj.body, { headers });
}
