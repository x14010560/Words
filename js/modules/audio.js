const SPEAK_OVERRIDES = { api: "A P I", url: "U R L", html: "H T M L", css: "C S S", js: "J S", json: "J S O N", xml: "X M L", svg: "S V G", gui: "G U I", dns: "D N S", http: "H T T P", https: "H T T P S", smtp: "S M T P", imap: "I M A P", ssl: "S S L", tls: "T L S", ssh: "S S H", vpn: "V P N", ip: "I P", db: "D B", pid: "P I D", ocr: "O C R", hwnd: "H W N D", sku: "S K U", csrf: "C S R F", oauth: "O Auth", ngrok: "N G rok", nginx: "engine X", venv: "V env", sqlite: "S Q Lite", mysql: "My S Q L", asyncio: "a sync I O", kwargs: "K W args", douyin: "Dou Yin", xiaohongshu: "Xiao Hong Shu", kuaishou: "Kuai Shou", feishu: "Fei Shu", playwright: "Playwright" };
const audioCache = new Map();
const localAudioAvailability = new Map();

function fallbackSpeak(text) { 
  if (!('speechSynthesis' in window)) return; 
  const u = new SpeechSynthesisUtterance(text); 
  u.lang = 'en-US'; u.rate = 0.85; 
  window.speechSynthesis.cancel(); 
  window.speechSynthesis.speak(u); 
}

// 本地音频按原始词条命名（小写 .wav），不受 TTS 发音替换影响
function localAudioUrl(text) {
  return `./audio/${encodeURIComponent(String(text).trim().toLowerCase())}.wav`;
}

// 每个词只探测一次，结果缓存；没有本地文件的词直接走 TTS
async function hasLocalAudio(url) {
  if (localAudioAvailability.has(url)) return localAudioAvailability.get(url);
  let ok = false;
  try {
    const res = await fetch(url, { method: 'HEAD' });
    const type = res.headers.get('content-type') || '';
    ok = res.ok && (!type || type.includes('audio') || type.includes('octet-stream'));
  } catch {}
  localAudioAvailability.set(url, ok);
  return ok;
}

export async function speak(text) {
  if (!text) return; 
  const spoken = SPEAK_OVERRIDES[text.toLowerCase()] || text;

  // 1) 优先播放随词库提供的本地音频
  const localUrl = localAudioUrl(text);
  if (await hasLocalAudio(localUrl)) {
    const key = `local:${localUrl}`;
    try {
      let a = audioCache.get(key);
      if (a) {
        a.currentTime = 0;
        await a.play();
      } else {
        a = new Audio(localUrl);
        await a.play();
        audioCache.set(key, a);
      }
      return;
    } catch (e) {
      console.warn('本地音频播放失败，改用在线 TTS', e);
    }
  }

  // 2) 没有本地音频时，走原来的 TTS
  if (audioCache.has(spoken)) { 
    const a = audioCache.get(spoken); 
    a.currentTime = 0; 
    a.play().catch(e => console.warn(e)); 
    return; 
  }
  
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const apiUrl = isLocal ? 'https://edge-tts.x14010560.workers.dev/v1/audio/speech' : '/tts';

  try {
    const res = await fetch(apiUrl, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ model: 'tts-1', input: spoken, voice: 'en-US-AvaMultilingualNeural' }) 
    });
    if (!res.ok) throw new Error(); 
    const blob = await res.blob(); 
    const a = new Audio(URL.createObjectURL(blob)); 
    await a.play();
    audioCache.set(spoken, a); 
  } catch { 
    fallbackSpeak(spoken); 
  }
}
