const SPEAK_OVERRIDES = { api: "A P I", url: "U R L", html: "H T M L", css: "C S S", js: "J S", json: "J S O N", xml: "X M L", svg: "S V G", gui: "G U I", dns: "D N S", http: "H T T P", https: "H T T P S", smtp: "S M T P", imap: "I M A P", ssl: "S S L", tls: "T L S", ssh: "S S H", vpn: "V P N", ip: "I P", db: "D B", pid: "P I D", ocr: "O C R", hwnd: "H W N D", sku: "S K U", csrf: "C S R F", oauth: "O Auth", ngrok: "N G rok", nginx: "engine X", venv: "V env", sqlite: "S Q Lite", mysql: "My S Q L", asyncio: "a sync I O", kwargs: "K W args", douyin: "Dou Yin", xiaohongshu: "Xiao Hong Shu", kuaishou: "Kuai Shou", feishu: "Fei Shu", playwright: "Playwright" };
const audioCache = new Map();

function fallbackSpeak(text) { 
  if (!('speechSynthesis' in window)) return; 
  const u = new SpeechSynthesisUtterance(text); 
  u.lang = 'en-US'; u.rate = 0.85; 
  window.speechSynthesis.cancel(); 
  window.speechSynthesis.speak(u); 
}

export async function speak(text) {
  if (!text) return; 
  const spoken = SPEAK_OVERRIDES[text.toLowerCase()] || text;
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
    audioCache.set(spoken, a); 
    await a.play();
  } catch { 
    fallbackSpeak(spoken); 
  }
}