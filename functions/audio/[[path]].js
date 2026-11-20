const CACHE = 'public, max-age=31536000, immutable';

function baseHeaders(obj) {
  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set('etag', obj.httpEtag);
  h.set('Accept-Ranges', 'bytes');
  h.set('Cache-Control', CACHE);
  return h;
}

// Workers 不允许手写 Content-Length，用定长流让运行时自动带上
function fixedStream(obj, length) {
  const { readable, writable } = new FixedLengthStream(length);
  obj.body.pipeTo(writable).catch(() => {});
  return readable;
}

export async function onRequest(context) {
  const { params, env, request } = context;

  // 绑定名兼容大小写，任一存在即可
  const bucket = env.AUDIO || env.audio;
  if (!bucket) return new Response('R2 binding missing', { status: 500 });

  const sub = Array.isArray(params.path) ? params.path.join('/') : params.path;
  const key = `audio/${sub}`;
  const rangeHdr = request.headers.get('range');

  if (!rangeHdr) {
    const obj = await bucket.get(key);
    if (!obj) return new Response('Not Found', { status: 404 });
    const headers = baseHeaders(obj);
    if (request.method === 'HEAD') return new Response(null, { headers });
    return new Response(fixedStream(obj, obj.size), { headers });
  }

  const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHdr.trim());
  if (!m) {
    return new Response('Bad Range', { status: 416, headers: { 'Cache-Control': 'no-store' } });
  }

  const meta = await bucket.head(key);
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

  const len = end - start + 1;
  const obj = await bucket.get(key, { range: { offset: start, length: len } });
  if (!obj) return new Response('Not Found', { status: 404 });

  const headers = baseHeaders(obj);
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  return new Response(fixedStream(obj, len), { status: 206, headers });
}
