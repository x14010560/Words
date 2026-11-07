import { Storage } from '../storage.js';
import { speak } from './audio.js';
import { triggerAutoSync } from './sync.js';

const state = { queue: [], index: 0, current: null, input: "", locked: false, waitingForRetry: false };let currentLibData = [];
let els = {};

export function setLibData(data) {
  currentLibData = data;
  window.currentLibDataCache = data; // 供错题本渲染使用
}

export function initPractice(elements) {
  els = elements;
  
  // 劫持 Storage.record 触发同步
  const originalRecord = Storage.record;
  Storage.record = function(...args) {
    const res = originalRecord.apply(Storage, args);
    triggerAutoSync();
    return res;
  };
  
  const originalSaveSettings = Storage.saveSettings;
  Storage.saveSettings = function(...args) {
    const res = originalSaveSettings.apply(Storage, args);
    triggerAutoSync();
    return res;
  };

    // 点击整个练习区域，让隐藏的 input 聚焦（方便手机弹键盘）
  const viewPractice = document.getElementById('view-practice');
  if (viewPractice) {
    viewPractice.addEventListener('click', (e) => {
      // 如果点的是按钮，就不聚焦了
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
      els.input.focus();
    });
  };

  // 绑定事件
  els.input.addEventListener("input", handlePhysicalInput);
  document.addEventListener("keydown", handleGlobalKeyDown);
  els.nextBtn.addEventListener("click", () => state.locked ? nextWord() : (state.input.length > 0 && judge()));
  els.skipBtn.addEventListener("click", handleSkip);
  els.speakBtn.addEventListener("click", () => state.current && speak(state.current.word));
  
  els.prevWordBtn.addEventListener("click", () => { if (state.index > 0) { state.index -= 1; renderCurrent(); } });
  els.nextWordBtn.addEventListener("click", () => { if (state.index < state.queue.length - 1) { state.index += 1; renderCurrent(); } });
}

export function restartPractice() {
  state.queue = buildQueue();
  state.index = 0;
  renderCurrent();
}

function buildQueue() {
  const reviewWords = []; 
  const newWords = [];    
  currentLibData.forEach(w => {
    const status = Storage.getStatus(w.word);
    if (status.isWrongBook || status.stage === 2 || status.stage === 3) reviewWords.push(w);
    else if (status.stage === 1) newWords.push(w);
  });

  const settings = Storage.getSettings();
  const dailyGoal = settings.dailyGoal || 20;
  const learnedToday = Storage.getDailyStats().learnedWords.length;
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
    // 改为显示 meaning（释义）
    els.prevWordBtn.querySelector("span").textContent = state.queue[state.index - 1].meaning;
  } else {
    els.prevWordBtn.disabled = true;
    els.prevWordBtn.querySelector("span").textContent = "无";
  }
  if (state.index < state.queue.length - 1 && state.queue[state.index + 1]) {
    els.nextWordBtn.disabled = false;
    // 改为显示 meaning（释义）
    els.nextWordBtn.querySelector("span").textContent = state.queue[state.index + 1].meaning;
  } else {
    els.nextWordBtn.disabled = true;
    els.nextWordBtn.querySelector("span").textContent = "无";
  }
}

function renderSlots(showHint = false, isJudged = false) {
  const target = state.current.word;
  const parts = window.Typing.compare(target, state.input);
  els.slots.innerHTML = "";
  
  parts.forEach((p, i) => {
    const div = document.createElement("div");
    let displayStatus = p.status;
    let isHint = false;
    
    if (!isJudged && (p.status === "correct" || p.status === "wrong")) {
      displayStatus = "typing";
      // 如果是空格，显示一个特殊符号
      div.textContent = state.input[i] === " " ? "␣" : state.input[i]; 
    } else if (isJudged && (p.status === "correct" || p.status === "wrong")) {
      div.textContent = target[i] === " " ? "␣" : target[i]; 
    } else if (showHint && (p.status === "pending" || p.status === "active")) {
      div.textContent = target[i] === " " ? "␣" : target[i]; 
      isHint = true; 
    } else {
      div.textContent = "";
    }
    
    div.className = "slot " + displayStatus;
    // 如果这个格子是空格，加上特殊样式
    if (target[i] === " ") div.classList.add("slot-space");
    if (isHint) div.classList.add("slot-hint");
    
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

export function renderCurrent() {
  if (state.index >= state.queue.length) {
    els.modeTag.textContent = "🎉 全部完成";
    els.meaning.textContent = "恭喜，当前词库已全部掌握！";
    els.phonetic.textContent = ""; els.slots.innerHTML = ""; els.hint.textContent = "";
    els.nextBtn.disabled = true; renderProgress();
    return;
  }
  state.current = state.queue[state.index];
  const status = Storage.getStatus(state.current.word);

  state.input = ""; 
  els.input.value = ""; 
  state.locked = false;
  state.waitingForRetry = false; // 👈 关键：必须加上这一行重置状态
  
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
  
  if (window.innerWidth > 768) setTimeout(() => els.input.focus(), 50);
}

function judge() {
  const target = state.current.word;
  const ok = window.Typing.isExact(target, state.input);
  const oldStatus = Storage.getStatus(target);
  const newStatus = Storage.record(target, ok);
  
  state.locked = true;
  els.meaning.textContent = state.current.meaning;
  els.phonetic.textContent = state.current.phonetic || "";

  if (ok) {
    els.hint.textContent = "✅ 正确！"; 
    els.hint.style.color = "var(--correct)";
    els.nextBtn.disabled = false;
    renderSlots(false, true); 
    renderProgress(); 
  } else {
    els.hint.textContent = `❌ 拼写错误 (正确答案: ${target})`; 
    els.hint.style.color = "var(--wrong)";
    if (newStatus.isWrongBook && !oldStatus.isWrongBook) els.hint.textContent += " | 已加入错题本！";
    
    els.nextBtn.disabled = false; 
    renderSlots(false, true); 
    renderProgress(); 

    // 👇 修改这里：不是听写/默写，或者已经在错题本里，就不需要重打，直接等下一个
    // 如果是听写/默写模式打错了，标记为等待重试，展示正确答案
    if (oldStatus.stage > 1) {
      state.waitingForRetry = true;
    }
  }
}

function handleInput(val) {
  // 如果处于等待重试状态，用户的输入会触发重置
  if (state.locked) {
    if (state.waitingForRetry) {
      state.locked = false;
      state.waitingForRetry = false;
      
      // 👇 核心修复：彻底抛弃之前长串的错误拼写，只保留用户最新按下的那一个字母
      const lastChar = val.slice(-1);
      val = /^[a-zA-Z]$/.test(lastChar) ? lastChar.toLowerCase() : "";
      
      state.input = val;
      els.input.value = val;
      els.nextBtn.disabled = !val;
      els.hint.textContent = "请重新拼写正确的单词"; 
      els.hint.style.color = "var(--primary)";
      renderSlots(false, false); // 隐藏正确答案
      
      if (!val) return; // 如果没有输入有效字母，终止
    } else {
      // 正确状态下按了键，保持锁定并回退
      els.input.value = state.input;
      return;
    }
  }

  // 下面是正常的输入处理逻辑
  const target = state.current.word;
  if (val.length > target.length) val = val.slice(0, target.length);
  const status = Storage.getStatus(state.current.word);

  // 学习模式拦截错误
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

  if (status.stage === 1 && window.Typing.isComplete(target, val)) {
    judge(); 
  } else if (status.stage > 1 && window.Typing.isComplete(target, val) && !state.locked) {
    els.hint.textContent = "按 回车 键 检查"; 
    els.hint.style.color = "var(--primary)";
  } else if (!state.locked) {
    els.hint.textContent = "输入对应的英文单词"; 
    els.hint.style.color = "var(--muted)";
  }
}

function handlePhysicalInput(e) {
  if (state.locked) { els.input.value = state.input; return; }
  
  // 👇 放宽限制：允许英文字母、数字、空格、点、横杠
  let val = els.input.value.toLowerCase().replace(/[^a-z0-9\s\.\-]/g, "");
  if (val === state.input) return;
  
  handleInput(val);
}

function handleGlobalKeyDown(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    if (e.target.id !== 'hiddenInput' && e.target.id !== 'syncKeyInput') {
      return;
    }
  }

  if (e.key === "Enter") {
    e.preventDefault(); 
    if (state.locked) {
      nextWord();
    } else if (state.input.length > 0) {
      judge();
    }
    return;
  }

  if (e.key === "Backspace") {
    if (!state.locked && state.input.length > 0) {
      e.preventDefault();
      handleInput(state.input.slice(0, -1));
    }
    return;
  }

  // 👇 允许捕获字母、数字、空格、点、横杠
  if (/^[a-zA-Z0-9\s\.\-]$/.test(e.key)) {
    if (state.locked && !state.waitingForRetry) return;
    e.preventDefault();
    
    // 如果是等待重打状态，且按的是空格，直接忽略，避免误触
    if (state.locked && state.waitingForRetry && e.key === " ") return;
    
    handleInput(state.input + e.key.toLowerCase());
  }
}

function handleSkip() {
  if (state.locked) return;
  const target = state.current.word;
  const oldStatus = Storage.getStatus(target);
  const newStatus = Storage.record(target, false);
  els.hint.textContent = `⏭ 已跳过，答案是 ${target}`; els.hint.style.color = "var(--wrong)";
  if (newStatus.isWrongBook && !oldStatus.isWrongBook) els.hint.textContent += " | 已加入错题本！";
  state.locked = true; els.nextBtn.disabled = false;
  renderSlots(false, true); 
  renderProgress();
}

export function nextWord() {
  state.waitingForRetry = false;
  if (state.queue.length === 0) return;
  if (state.current) Storage.addDailyLearnedWord(state.current.word);
  const status = Storage.getStatus(state.current.word);
  
  // 微循环插入
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