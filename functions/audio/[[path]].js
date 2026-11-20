const CACHE = 'public, max-age=31536000, immutable';

function baseHeaders(obj) {
  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set('etag', obj.httpEtag);
  h.set('Accept-Ranges', 'bytes');
  return h;
}

export async function onRequest(context) {
  const { params, env, request } = context;
  const sub = Array.isArray(params.path) ? params.path.join('/') : params.path;
  const key = `audio/${sub}`;
  const rangeHdr = request.headers.get('range');

  // 无 Range：整体返回
  if (!rangeHdr) {
    const obj = await env.AUDIO.get(key);
    if (!obj) return new Response('Not Found', { status: 404 });

    const headers = baseHeaders(obj);
    headers.set('Content-Length', String(obj.size));
    headers.set('Cache-Control', CACHE);
    return new Response(request.method === 'HEAD' ? null : obj.body, { headers });
  }

  // 有 Range：返回 206 分片
  const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHdr.trim());
  if (!m) return new Response('Bad Range', { status: 416, headers: { 'Cache-Control': 'no-store' } });

  const meta = await env.AUDIO.head(key);
  if (!meta) return new Response('Not Found', { status: 404 });
  const size = meta.size;

  let start = m[1] === '' ? size - Number(m[2]) : Number(m[1]);
  let end = (m[1] === '' || m[2] === '') ? size - 1 : Number(m[2]);
  if (!Number.isFinite(start) || start < 0) start = 0;
  if (!Number.isFinite(end) || end >= size) end = size - 1;

  if (start > end || start >= size) {
    return new Response('Range Not Satisfiable', {
      status: 416,
      headers: { 'Content-Range': `bytes */${size}`, 'Cache-Control': 'no-store' },
    });
  }

  const obj = await env.AUDIO.get(key, { range: { offset: start, length: end - start + 1 } });
  if (!obj) return new Response('Not Found', { status: 404 });

  const headers = baseHeaders(obj);
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  headers.set('Cache-Control', CACHE);
  return new Response(obj.body, { status: 206, headers });
}
