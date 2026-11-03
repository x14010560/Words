// Cloudflare Pages Function: 代理 TTS 请求
export async function onRequestPost(context) {
  // 这里填入你真实的 Worker 地址
  const workerUrl = 'https://edge-tts.x14010560.workers.dev/v1/audio/speech';
  const request = context.request;

  // 将请求原样转发给 Worker
  const response = await fetch(workerUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body
  });

  // 返回音频数据，并允许跨域
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Access-Control-Allow-Origin', '*');
  return newResponse;
}
