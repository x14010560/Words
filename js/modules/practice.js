import { Storage } from '../storage.js';
import { speak } from './audio.js';
import { triggerAutoSync } from './sync.js';

const state = { queue: [], index: 0, current: null, input: "", locked: false };
let currentLibData = [];
let els = {};
let resetTimer = null;

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

  // 绑定事件
  els.input.addEventListener("input", handlePhysicalInput);
  els.input.addEventListener("keydown", handleKeyDown);
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
      div.textContent = state.input[i]; 
    } else if (isJudged && (p.status === "correct" || p.status === "wrong")) {
      div.textContent = target[i]; 
    } else if (showHint && (p.status === "pending" || p.status === "active")) {
      div.textContent = target[i]; 
      isHint = true; 
    } else {
      div.textContent = "";
    }
    
    div.className = "slot " + displayStatus;
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
    
    els.nextBtn.disabled = false; // 依然允许直接点击下一个跳过重打
    renderSlots(false, true); 
    renderProgress(); 

    // 👇 新增：如果是听写/默写模式，1.5秒后自动清空，让用户重新输入
    if (oldStatus.stage > 1 && !oldStatus.isWrongBook) {
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        state.locked = false;
        state.input = "";
        els.input.value = "";
        els.hint.textContent = "请重新拼写正确的单词"; 
        els.hint.style.color = "var(--primary)";
        els.nextBtn.disabled = true; // 必须重新打对才能过
        renderSlots(false, false); // 恢复未输入状态
        if (window.innerWidth > 768) els.input.focus();
      }, 1500); // 停顿 1.5 秒
    }
  }
}

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
      els.hint.textContent = "❌ 输入错误，请重试"; els.hint.style.color = "var(--wrong)";
      setTimeout(() => {
        if (!state.locked && status.stage === 1) {
          els.hint.textContent = "输入对应的英文单词"; els.hint.style.color = "var(--muted)";
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
    els.hint.textContent = "按 空格/回车 键 检查"; els.hint.style.color = "var(--primary)";
  } else if (!state.locked) {
    els.hint.textContent = "输入对应的英文单词"; els.hint.style.color = "var(--muted)";
  }
}

function handlePhysicalInput() {
  if (state.locked) { els.input.value = state.input; return; }
  let val = els.input.value.toLowerCase().replace(/[^a-z0-9.\-\s]/g, "");
  handleInput(val);
}

function handleKeyDown(e) {
  if (e.key === "Enter") {
    e.preventDefault(); 
    if (state.locked) {
      nextWord();
    } else if (state.input.length > 0) {
      judge();
    }
  }
}

function handleVirtualKeyboard(e) {
  const btn = e.target.closest(".vk-key");
  if (!btn) return;
  const key = btn.getAttribute("data-key");

  if (key === "Backspace") {
    if (!state.locked && state.input.length > 0) handleInput(state.input.slice(0, -1));
  } else if (key === "Enter") {
    if (state.locked) nextWord();
    else if (state.input.length > 0) judge();
  } else {
    if (!state.locked) handleInput(state.input + key);
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
  clearTimeout(resetTimer);
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