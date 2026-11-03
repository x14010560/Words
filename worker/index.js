export default {
  async fetch(request, env, ctx) {
    // 处理浏览器的 CORS 预检请求
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    const url = new URL(request.url);
    const text = url.searchParams.get("text");

    if (!text) {
      return new Response("Missing 'text' parameter", { 
        status: 400, 
        headers: { "Access-Control-Allow-Origin": "*" } 
      });
    }

    try {
      // 这是微软 Edge TTS 的接口地址
      // 注意：在实际使用中，建议使用一个更健壮的库来做这件事
      // 比如在 Worker 中通过 npm 安装 `msedge-tts` 并使用它。
      // 为了让代码直接跑通，这里提供一个最基础的 WebSocket 转发思路，
      // 但由于 Cloudflare Worker 对 WebSocket 的支持方式比较特殊，
      // 这里建议你直接使用现成的 Worker 模板。
      
      // 为了让你马上能跑通，这里先返回一个占位说明，
      // 建议你去 GitHub 搜 "edge-tts-worker" 找一个现成的代理代码替换这个 index.js。
      return new Response("Please replace this with a working Edge TTS proxy logic.", {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*" }
      });

    } catch (error) {
      return new Response("Error: " + error.message, {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }
  },
};