import { Storage } from '../storage.js';
import { speak } from './audio.js';
import { triggerAutoSync } from './sync.js';

const state = { queue: [], index: 0, current: null, input: "", locked: false, waitingForRetry: false };
let wordsSinceLastSync = 0; // 距离上次同步学了多少个词
let currentLibData = [];
let els = {};

export function setLibData(data) {
  currentLibData = data;
  window.currentLibDataCache = data;
}

export function initPractice(elements) {
  els = elements;

  const originalSaveSettings = Storage.saveSettings;
  Storage.saveSettings = function(...args) {
    const res = originalSaveSettings.apply(Storage, args);
    triggerAutoSync();
    return res;
  };

  els.input.addEventListener("input", handlePhysicalInput);
  document.addEventListener("keydown", handleGlobalKeyDown);

  if (els.nextBtn) els.nextBtn.addEventListener("click", () => state.locked ? nextWord() : (state.input.length > 0 && judge()));
  if (els.skipBtn) els.skipBtn.addEventListener("click", handleSkip);
  if (els.speakBtn) els.speakBtn.addEventListener("click", () => state.current && speak(state.current.word));

  if (els.prevWordBtn) {
    els.prevWordBtn.addEventListener("click", () => {
      if (state.index > 0) { state.index -= 1; renderCurrent(); }
    });
  }
  if (els.nextWordBtn) {
    els.nextWordBtn.addEventListener("click", () => {
      if (state.index < state.queue.length - 1) { state.index += 1; renderCurrent(); }
    });
  }
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

function setMode(text, mode = "learn") {
  els.modeTag.textContent = text;
  els.modeTag.dataset.mode = mode;
}

function setHint(text, tone = "") {
  els.hint.textContent = text;
  if (tone) els.hint.dataset.tone = tone;
  else delete els.hint.dataset.tone;
}

function renderTopNav() {
  if (!els.prevWordBtn || !els.nextWordBtn) return;
  if (state.index > 0 && state.queue[state.index - 1]) {
    els.prevWordBtn.disabled = false;
    els.prevWordBtn.querySelector("span").textContent = state.queue[state.index - 1].meaning;
  } else {
    els.prevWordBtn.disabled = true;
    els.prevWordBtn.querySelector("span").textContent = "—";
  }
  if (state.index < state.queue.length - 1 && state.queue[state.index + 1]) {
    els.nextWordBtn.disabled = false;
    els.nextWordBtn.querySelector("span").textContent = state.queue[state.index + 1].meaning;
  } else {
    els.nextWordBtn.disabled = true;
    els.nextWordBtn.querySelector("span").textContent = "—";
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
    if (target[i] === " ") div.classList.add("slot-space");
    if (isHint) div.classList.add("slot-hint");

    els.slots.appendChild(div);
  });
}

function renderProgress() {
  const stats = Storage.getStats();
  els.progress.textContent = String(stats.mastered);
  els.wrongCount.textContent = String(stats.wrongBook);
  els.accuracy.textContent = String(Math.max(0, state.queue.length - state.index));

  const settings = Storage.getSettings();
  const daily = Storage.getDailyStats();
  const todayLearned = daily.learnedWords.length;
  const goal = settings.dailyGoal || 20;

  els.dailyProgress.textContent = `${todayLearned} / ${goal}`;
  els.dailyTrack.style.setProperty("--progress", Math.min(1, goal > 0 ? todayLearned / goal : 0));
}

export function renderCurrent() {
  if (state.index >= state.queue.length) {
    setMode("今日练习已完成", "done");
    els.meaning.textContent = "当前词库已全部掌握";
    els.phonetic.textContent = "";
    els.slots.innerHTML = "";
    setHint("");
    els.stageSteps.dataset.stage = "0";
    els.nextBtn.disabled = true;
    renderProgress();
    return;
  }
  state.current = state.queue[state.index];
  const status = Storage.getStatus(state.current.word);

  state.input = "";
  els.input.value = "";
  state.locked = false;
  state.waitingForRetry = false;

  setHint("输入对应的英文单词");
  els.nextBtn.disabled = true;

  if (status.isWrongBook) {
    setMode(`错题复习 · 连对 ${status.consecutiveCorrect}/3`, "review");
    els.stageSteps.dataset.stage = "0";
    els.meaning.textContent = state.current.meaning;
    els.phonetic.textContent = "";
    speak(state.current.word);
  } else if (status.stage === 1) {
    setMode("学习 · 第 1 遍", "learn");
    els.stageSteps.dataset.stage = "1";
    els.meaning.textContent = state.current.meaning;
    els.phonetic.textContent = state.current.phonetic || "";
    speak(state.current.word);
  } else if (status.stage === 2) {
    setMode("听写 · 第 2 遍", "listen");
    els.stageSteps.dataset.stage = "2";
    els.meaning.textContent = "听发音拼写";
    els.phonetic.textContent = "";
    speak(state.current.word);
  } else if (status.stage === 3) {
    setMode("默写 · 第 3 遍", "write");
    els.stageSteps.dataset.stage = "3";
    els.meaning.textContent = state.current.meaning;
    els.phonetic.textContent = "";
  }

  renderSlots(status.stage === 1, false);
  renderProgress();
  renderTopNav();
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
    setHint("拼写正确", "correct");
    els.nextBtn.disabled = false;
    renderSlots(false, true);
    renderProgress();
  } else {
    let text = `应为 ${target}`;
    if (newStatus.isWrongBook && !oldStatus.isWrongBook) text += "，已记入错题本";
    setHint(text, "wrong");
    els.nextBtn.disabled = false;
    renderSlots(false, true);
    renderProgress();

    if (oldStatus.stage > 1) {
      state.waitingForRetry = true;
    }
  }
}

function handleInput(val) {
  if (state.locked) {
    if (state.waitingForRetry) {
      state.locked = false;
      state.waitingForRetry = false;

      const lastChar = val.slice(-1);
      val = /^[a-zA-Z]$/.test(lastChar) ? lastChar.toLowerCase() : "";

      state.input = val;
      els.input.value = val;
      els.nextBtn.disabled = !val;
      setHint("请重新拼写正确的单词", "accent");
      renderSlots(false, false);

      if (!val) return;
    } else {
      els.input.value = state.input;
      return;
    }
  }

  const target = state.current.word;
  if (val.length > target.length) val = val.slice(0, target.length);
  const status = Storage.getStatus(state.current.word);

  if (status.stage === 1 && val.length > state.input.length) {
    const newChar = val[val.length - 1];
    const targetChar = target[val.length - 1];
    if (newChar !== targetChar) {
      els.input.value = state.input;
      setHint("输入错误，请重试", "wrong");
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
    setHint("按 回车 键检查", "accent");
  } else if (!state.locked) {
    setHint("输入对应的英文单词");
  }
}

function handlePhysicalInput(e) {
  if (state.locked) {
    if (state.waitingForRetry) {
       const lastChar = els.input.value.slice(-1);
       handleInput(lastChar);
       return;
    }
    els.input.value = state.input;
    return;
  }

  let val = els.input.value.toLowerCase().replace(/[^a-z0-9\s\.\-\+]/g, "");
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

  if (/^[a-zA-Z0-9\s\.\-\+]$/.test(e.key)) {
    if (state.locked && !state.waitingForRetry) return;
    e.preventDefault();

    if (state.locked && state.waitingForRetry && e.key === " ") return;

    handleInput(state.input + e.key.toLowerCase());
  }
}

function handleSkip() {
  if (state.locked) return;
  const target = state.current.word;
  const oldStatus = Storage.getStatus(target);
  const newStatus = Storage.record(target, false);
  let text = `已跳过，答案为 ${target}`;
  if (newStatus.isWrongBook && !oldStatus.isWrongBook) text += "，已记入错题本";
  setHint(text, "wrong");
  state.locked = true;
  els.nextBtn.disabled = false;
  renderSlots(false, true);
  renderProgress();
}

export function nextWord() {
  state.waitingForRetry = false;
  if (state.queue.length === 0) return;
  
  if (state.current) {
    Storage.addDailyLearnedWord(state.current.word);
    wordsSinceLastSync++; // 👈 每次学完一个词，计数器 +1
  }

  // 👇 核心逻辑：判断是否触发自动同步
  const settings = Storage.getSettings();
  const dailyStats = Storage.getDailyStats();
  const todayLearned = dailyStats.learnedWords.length;
  
  // 规则1：每满 50 个词同步一次
  if (wordsSinceLastSync >= 50) {
    triggerAutoSync();
    wordsSinceLastSync = 0; // 重置计数器
    console.log("☁️ 已积累50个词，触发自动同步");
  }

  // 规则2：刚好完成每日目标时同步一次
  if (todayLearned === settings.dailyGoal) {
    triggerAutoSync();
    wordsSinceLastSync = 0; // 既然完成目标同步了，顺便重置计数器
    console.log("🎉 完成每日目标，触发自动同步");
  }

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