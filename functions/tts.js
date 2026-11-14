// functions/tts.js
export async function onRequestPost(context) {
  // 你的真实 Worker 地址
  const workerUrl = 'https://edge-tts.x14010560.workers.dev/v1/audio/speech';
  const request = context.request;

  try {
    // 将前端的 POST 请求原样转发给你的 Worker
    const response = await fetch(workerUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body
    });

    // 返回音频流，并允许跨域
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    return newResponse;
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' 
      } 
    });
  }
}