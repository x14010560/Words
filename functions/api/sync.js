// functions/api/sync.js
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 获取指定的同步码参数
  const syncKey = url.searchParams.get("key");
  if (!syncKey) {
    return new Response(JSON.stringify({ error: "Missing sync key" }), { status: 400, headers: corsHeaders });
  }

  // 获取云端数据 (根据 syncKey)
  if (request.method === "GET") {
    try {
      const dataStr = await env.WORD_KV.get(`data_${syncKey}`);
      return new Response(dataStr || "{}", {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }

  // 上传数据到云端
  if (request.method === "POST") {
    try {
      const body = await request.json();
      
      // 存入 KV 数据库
      await env.WORD_KV.put(`data_${syncKey}`, JSON.stringify(body));
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
}