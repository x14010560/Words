(function () {
  const els = {
    navBtns: document.querySelectorAll(".nav-btn"),
    views: document.querySelectorAll(".view"),
    sidebar: document.getElementById("sidebar"),
    toggleSidebar: document.getElementById("toggleSidebar"),
    
    // 练习区
    modeTag: document.getElementById("modeTag"),
    progress: document.getElementById("progress"),
    dailyProgress: document.getElementById("dailyProgress"),
    accuracy: document.getElementById("accuracy"),
    meaning:  document.getElementById("meaning"),
    phonetic: document.getElementById("phonetic"),
    speakBtn: document.getElementById("speakBtn"),
    slots:    document.getElementById("slots"),
    input:    document.getElementById("hiddenInput"),
    hint:     document.getElementById("hint"),
    skipBtn:  document.getElementById("skipBtn"),
    nextBtn:  document.getElementById("nextBtn"),
    prevWordBtn: document.getElementById("prevWordBtn"),
    nextWordBtn: document.getElementById("nextWordBtn"),
    virtualKeyboard: document.getElementById("virtualKeyboard"),
    
    // 列表区
    wrongbookList: document.getElementById("wrongbookList"),
    masteredList: document.getElementById("masteredList"),

    // 设置弹窗
    settingsModal: document.getElementById("settingsModal"),
    openSettingsBtn: document.getElementById("openSettingsBtn"),
    cancelSettingsBtn: document.getElementById("cancelSettingsBtn"),
    saveSettingsBtn: document.getElementById("saveSettingsBtn"),
    goalInput: document.getElementById("goalInput"),
    exportBtn: document.getElementById("exportBtn"),
    importBtn: document.getElementById("importBtn")
  };

  const state = {
    queue: [],
    index: 0,
    current: null,
    input: "",
    locked: false,
  };

  const SPEAK_OVERRIDES = { api: "A P I", url: "U R L", html: "H T M L", css: "C S S", js: "J S", json: "J S O N", xml: "X M L", svg: "S V G", gui: "G U I", dns: "D N S", http: "H T T P", https: "H T T P S", smtp: "S M T P", imap: "I M A P", ssl: "S S L", tls: "T L S", ssh: "S S H", vpn: "V P N", ip: "I P", db: "D B", pid: "P I D", ocr: "O C R", hwnd: "H W N D", sku: "S K U", csrf: "C S R F", oauth: "O Auth", ngrok: "N G rok", nginx: "engine X", venv: "V env", sqlite: "S Q Lite", mysql: "My S Q L", asyncio: "a sync I O", kwargs: "K W args", douyin: "Dou Yin", xiaohongshu: "Xiao Hong Shu", kuaishou: "Kuai Shou", feishu: "Fei Shu", playwright: "Playwright" };
  const audioCache = new Map();
  
  function fallbackSpeak(text) { 
    if (!('speechSynthesis' in window)) return; 
    const u = new SpeechSynthesisUtterance(text); 
    u.lang = 'en-US'; u.rate = 0.85; 
    window.speechSynthesis.cancel(); 
    window.speechSynthesis.speak(u); 
  }

  async function speak(text) {
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

  // ============ 侧边栏 & 设置弹窗 ============
  els.toggleSidebar.addEventListener("click", () => els.sidebar.classList.toggle("collapsed"));
  els.navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      els.navBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const targetId = btn.getAttribute("data-target");
      if (targetId) {
        els.views.forEach(v => v.classList.remove("active"));
        document.getElementById(targetId).classList.add("active");
        if (targetId === "view-wrongbook") renderList("wrongbook");
        if (targetId === "view-mastered") renderList("mastered");
      }
    });
  });

  els.openSettingsBtn.addEventListener("click", () => {
    const settings = Storage.getSettings();
    els.goalInput.value = settings.dailyGoal;
    els.settingsModal.classList.add("show");
  });
  els.cancelSettingsBtn.addEventListener("click", () => els.settingsModal.classList.remove("show"));
  els.saveSettingsBtn.addEventListener("click", () => {
    const val = parseInt(els.goalInput.value, 10);
    if (val > 0) {
      Storage.saveSettings({ dailyGoal: val });
      renderProgress(); 
    }
    els.settingsModal.classList.remove("show");
  });

  // ============ 同步功能 (导出/导入) ============
  els.exportBtn.addEventListener("click", () => {
    const data = {
      progress: localStorage.getItem("typing_words_progress_v2"),
      settings: localStorage.getItem("typing_words_settings"),
      daily: localStorage.getItem("typing_words_daily")
    };
    const str = btoa(encodeURIComponent(JSON.stringify(data)));
    navigator.clipboard.writeText(str).then(() => {
      alert("学习进度已复制到剪贴板！\n请发送到另一台设备并在那里选择“导入进度”。");
    }).catch(() => {
      prompt("复制失败，请手动复制以下代码：", str);
    });
  });

  els.importBtn.addEventListener("click", () => {
    const str = prompt("请粘贴另一台设备导出的进度代码：");
    if (!str) return;
    try {
      const data = JSON.parse(decodeURIComponent(atob(str)));
      if (data.progress) localStorage.setItem("typing_words_progress_v2", data.progress);
      if (data.settings) localStorage.setItem("typing_words_settings", data.settings);
      if (data.daily) localStorage.setItem("typing_words_daily", data.daily);
      alert("导入成功！页面将刷新。");
      location.reload();
    } catch (e) {
      alert("导入失败，代码格式不正确或已损坏。");
    }
  });

  // ============ 列表 ============
  function renderList(type) {
    const container = type === "wrongbook" ? els.wrongbookList : els.masteredList;
    const words = type === "wrongbook" ? Storage.getWrongBookWords() : Storage.getMasteredWords();
    container.innerHTML = "";
    if (words.length === 0) { container.innerHTML = `<p style="color:var(--muted);text-align:center;padding:20px;">暂无单词</p>`; return; }
    words.forEach(w => {
      const div = document.createElement("div");
      div.className = "list-item";
      div.innerHTML = `<div class="list-info"><span class="list-word">${w.word}</span><span class="list-meaning">${w.meaning}</span></div><button class="btn">🔊</button>`;
      div.querySelector("button").addEventListener("click", () => speak(w.word));
      container.appendChild(div);
    });
  }

  // ============ 练习核心 ============
  function buildQueue() {
    const allWords = [...WORD_DATA];
    const reviewWords = []; 
    const newWords = [];    
    allWords.forEach(w => {
      const status = Storage.getStatus(w.word);
      if (status.isWrongBook || status.stage === 2 || status.stage === 3) reviewWords.push(w);
      else if (status.stage === 1) newWords.push(w);
    });

    const settings = Storage.getSettings();
    const dailyGoal = settings.dailyGoal || 20;
    const dailyStats = Storage.getDailyStats();
    const learnedToday = dailyStats.learnedWords.length;

    const remainingNew = Math.max(0, dailyGoal - learnedToday);
    const pickedNewWords = newWords.sort(() => Math.random() - 0.5).slice(0, remainingNew);
    reviewWords.sort(() => Math.random() - 0.5);
    
    let finalQueue = [];
    let rIndex = 0, nIndex = 0;
    while (rIndex < reviewWords.length || nIndex < pickedNewWords.length) {
      if (rIndex < reviewWords.length) finalQueue.push(reviewWords[rIndex++]);
      if (rIndex < reviewWords.length && Math.random() > 0.5) finalQueue.push(reviewWords[rIndex++]);
      if (nIndex < pickedNewWords.length) finalQueue.push(pickedNewWords[nIndex++]);
    }
    return finalQueue;
  }

  function renderTopNav() {
    if (state.index > 0 && state.queue[state.index - 1]) {
      els.prevWordBtn.disabled = false;
      els.prevWordBtn.querySelector("span").textContent = state.queue[state.index - 1].word;
    } else {
      els.prevWordBtn.disabled = true;
      els.prevWordBtn.querySelector("span").textContent = "无";
    }
    if (state.index < state.queue.length - 1 && state.queue[state.index + 1]) {
      els.nextWordBtn.disabled = false;
      els.nextWordBtn.querySelector("span").textContent = state.queue[state.index + 1].word;
    } else {
      els.nextWordBtn.disabled = true;
      els.nextWordBtn.querySelector("span").textContent = "无";
    }
  }

  // 🎯 修复渲染逻辑，增强对比度
  function renderSlots(showHint = false, isJudged = false) {
    const target = state.current.word;
    const parts = Typing.compare(target, state.input);
    els.slots.innerHTML = "";
    
    parts.forEach((p, i) => {
      const div = document.createElement("div");
      let displayStatus = p.status;
      
      if (!isJudged && (p.status === "correct" || p.status === "wrong")) {
        // 已经敲击了字母（无论对错，在未判定前都显示为深蓝）
        displayStatus = "typing";
        div.textContent = state.input[i]; 
      } 
      else if (isJudged && (p.status === "correct" || p.status === "wrong")) {
        // 判定后，全部显示正确单词的字母（打错的格子会变红）
        div.textContent = target[i]; 
      } 
      else if (showHint && (p.status === "pending" || p.status === "active")) {
        // 学习模式：未输入的部分显示浅灰色的提示字母
        div.textContent = target[i]; 
        div.classList.add("slot-hint");
      } 
      else {
        div.textContent = "";
      }
      
      div.className = "slot " + displayStatus;
      els.slots.appendChild(div);
    });
  }

  function renderProgress() {
    const stats = Storage.getStats();
    els.progress.textContent = `已掌握: ${stats.mastered} | 错题: ${stats.wrongBook}`;
    els.accuracy.textContent = `剩余: ${Math.max(0, state.queue.length - state.index)}`;

    const settings = Storage.getSettings();
    const daily = Storage.getDailyStats();
    const todayLearned = daily.learnedWords.length;
    const goal = settings.dailyGoal;
    
    if (todayLearned >= goal) {
      els.dailyProgress.textContent = `🎉 今日任务已完成 (${todayLearned}/${goal})`;
      els.dailyProgress.style.color = "var(--correct)";
    } else {
      els.dailyProgress.textContent = `今日: ${todayLearned} / ${goal}`;
      els.dailyProgress.style.color = "var(--primary)";
    }
  }

  function renderCurrent() {
    if (state.index >= state.queue.length) {
      els.modeTag.textContent = "🎉 全部完成";
      els.meaning.textContent = "恭喜，当前词库已全部掌握！";
      els.phonetic.textContent = ""; els.slots.innerHTML = ""; els.hint.textContent = "";
      els.nextBtn.disabled = true; renderProgress();
      return;
    }
    state.current = state.queue[state.index];
    const status = Storage.getStatus(state.current.word);

    state.input = ""; els.input.value = ""; state.locked = false;
    els.hint.textContent = "输入对应的英文单词"; els.hint.style.color = "var(--muted)";
    els.nextBtn.disabled = true;

    if (status.isWrongBook) {
      els.modeTag.textContent = `错题复习 (连对${status.consecutiveCorrect}/3)`;
      els.modeTag.className = "mode-tag review";
      els.meaning.textContent = state.current.meaning; els.phonetic.textContent = ""; speak(state.current.word); 
    } else if (status.stage === 1) {
      els.modeTag.textContent = "第一遍：学习模式"; els.modeTag.className = "mode-tag";
      els.meaning.textContent = state.current.meaning; els.phonetic.textContent = state.current.phonetic || ""; speak(state.current.word); 
    } else if (status.stage === 2) {
      els.modeTag.textContent = "第二遍：听写模式"; els.modeTag.className = "mode-tag listen";
      els.meaning.textContent = "🎧 听发音拼写"; els.phonetic.textContent = ""; speak(state.current.word); 
    } else if (status.stage === 3) {
      els.modeTag.textContent = "第三遍：默写模式"; els.modeTag.className = "mode-tag write";
      els.meaning.textContent = state.current.meaning; els.phonetic.textContent = "";
    }

    renderSlots(status.stage === 1, false);
    renderProgress();
    renderTopNav();
    
    if (window.innerWidth > 768) {
      setTimeout(() => els.input.focus(), 50);
    }
  }

  // 🎯 修复问题 2：判定后展示完整的音标和释义
  function judge() {
    const target = state.current.word;
    const ok = Typing.isExact(target, state.input);
    const oldStatus = Storage.getStatus(target);
    const newStatus = Storage.record(target, ok);
    
    state.locked = true;
    
    // 判定后，无论听写还是默写，都把正确的音标和释义亮出来让用户核对
    els.meaning.textContent = state.current.meaning;
    els.phonetic.textContent = state.current.phonetic || "";

    if (ok) {
      els.hint.textContent = "✅ 正确！"; els.hint.style.color = "var(--correct)";
    } else {
      els.hint.textContent = `❌ 拼写错误 (正确答案: ${target})`; els.hint.style.color = "var(--wrong)";
      if (newStatus.isWrongBook && !oldStatus.isWrongBook) els.hint.textContent += " | 已加入错题本！";
    }
    
    els.nextBtn.disabled = false;
    renderSlots(false, true); 
    renderProgress(); 
  }

  // ============ 输入逻辑 ============
  function handleInput(val) {
    if (state.locked) return;
    const target = state.current.word;
    if (val.length > target.length) val = val.slice(0, target.length);
    
    const status = Storage.getStatus(state.current.word);

    if (status.stage === 1 && val.length > state.input.length) {
      const newChar = val[val.length - 1];
      const targetChar = target[val.length - 1];
      if (newChar !== targetChar) {
        els.input.value = state.input; 
        els.hint.textContent = "❌ 输入错误，请重试";
        els.hint.style.color = "var(--wrong)";
        setTimeout(() => {
          if (!state.locked && status.stage === 1) {
            els.hint.textContent = "输入对应的英文单词";
            els.hint.style.color = "var(--muted)";
          }
        }, 800);
        return; 
      }
    }

    state.input = val;
    els.input.value = val; 
    renderSlots(status.stage === 1, false); 

    if (val.length > 0) els.nextBtn.disabled = false;

    if (status.stage === 1 && Typing.isComplete(target, val)) {
      judge(); 
    } else if (status.stage > 1 && Typing.isComplete(target, val) && !state.locked) {
      els.hint.textContent = "按 空格/回车 键 检查";
      els.hint.style.color = "var(--primary)";
    } else if (!state.locked) {
      els.hint.textContent = "输入对应的英文单词";
      els.hint.style.color = "var(--muted)";
    }
  }

  // 物理键盘
  els.input.addEventListener("input", () => {
    if (state.locked) { els.input.value = state.input; return; }
    let val = els.input.value.toLowerCase().replace(/[^a-z]/g, "");
    handleInput(val);
  });

  els.input.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault(); 
      if (state.locked) nextWord();
      else if (state.input.length > 0) judge();
    }
  });

  // 虚拟键盘
  if (els.virtualKeyboard) {
    els.virtualKeyboard.addEventListener("click", (e) => {
      const btn = e.target.closest(".vk-key");
      if (!btn) return;
      const key = btn.getAttribute("data-key");

      if (key === "Backspace") {
        if (!state.locked && state.input.length > 0) {
          handleInput(state.input.slice(0, -1));
        }
      } else if (key === "Enter") {
        if (state.locked) nextWord();
        else if (state.input.length > 0) judge();
      } else {
        if (!state.locked) {
          handleInput(state.input + key);
        }
      }
    });
  }

  els.nextBtn.addEventListener("click", () => {
    if (state.locked) nextWord();
    else if (state.input.length > 0) judge();
  });

  els.skipBtn.addEventListener("click", () => {
    if (state.locked) return;
    const target = state.current.word;
    const oldStatus = Storage.getStatus(target);
    const newStatus = Storage.record(target, false);
    els.hint.textContent = `⏭ 已跳过，答案是 ${target}`; els.hint.style.color = "var(--wrong)";
    if (newStatus.isWrongBook && !oldStatus.isWrongBook) els.hint.textContent += " | 已加入错题本！";
    state.locked = true; els.nextBtn.disabled = false;
    renderSlots(false, true); 
    renderProgress();
  });

  els.speakBtn.addEventListener("mousedown", (e) => e.preventDefault());
  els.speakBtn.addEventListener("click", () => { if (state.current) speak(state.current.word); });

  els.prevWordBtn.addEventListener("click", () => { if (state.index > 0) { state.index -= 1; renderCurrent(); } });
  els.nextWordBtn.addEventListener("click", () => { if (state.index < state.queue.length - 1) { state.index += 1; renderCurrent(); } });

  function nextWord() {
    if (state.queue.length === 0) return;
    if (state.current) Storage.addDailyLearnedWord(state.current.word);
    const status = Storage.getStatus(state.current.word);
    
    if (status.stage === 2 && !status.isWrongBook) {
       const insertPos = Math.min(state.queue.length, state.index + 3 + Math.floor(Math.random() * 2));
       state.queue.splice(insertPos, 0, state.current);
    } else if (status.stage === 3 && !status.isWrongBook) {
       const insertPos = Math.min(state.queue.length, state.index + 6 + Math.floor(Math.random() * 3));
       state.queue.splice(insertPos, 0, state.current);
    }
    state.index += 1;
    if (state.index >= state.queue.length) { state.queue = buildQueue(); state.index = 0; }
    renderCurrent();
  }

  function start() { state.queue = buildQueue(); state.index = 0; renderCurrent(); }
  start();
})();