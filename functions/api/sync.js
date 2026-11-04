// functions/api/sync.js
export async function onRequest(context) {
  const { request, env } = context;
  
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 获取云端数据
  if (request.method === "GET") {
    try {
      const customLibStr = await env.WORD_KV.get("custom_lib");
      const progressStr = await env.WORD_KV.get("all_progress");
      
      return new Response(JSON.stringify({
        customLib: customLibStr ? JSON.parse(customLibStr) : [],
        progress: progressStr ? JSON.parse(progressStr) : null
      }), {
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
      
      // 简单的密码校验，防止别人乱改（你可以把 "123456" 改成你自己的密码）
      if (body.password !== "123456") {
        return new Response(JSON.stringify({ error: "密码错误" }), { status: 401, headers: corsHeaders });
      }

      if (body.customLib) {
        await env.WORD_KV.put("custom_lib", JSON.stringify(body.customLib));
      }
      if (body.progress) {
        await env.WORD_KV.put("all_progress", JSON.stringify(body.progress));
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
}