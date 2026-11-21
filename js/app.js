import { Storage } from './storage.js?v=13';
import { speak } from './modules/audio.js?v=13';
import { hasExample, exampleHtml, renderExample } from './modules/example.js?v=13';
import { fetchFromCloud, triggerAutoSync, uploadToCloud, getUploadCooldown } from './modules/sync.js?v=13';
import { initPractice, setLibData, restartPractice } from './modules/practice.js?v=13';
import { initManager, renderManagerList } from './modules/manager.js?v=13';

const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;

const els = {
  navBtns: document.querySelectorAll(".nav-btn"),
  views: document.querySelectorAll(".view"),
  sidebar: document.getElementById("sidebar"),
  toggleSidebar: document.getElementById("toggleSidebar"),
  libSelect: document.getElementById("libSelect"),

  modeTag: document.getElementById("modeTag"),
  progress: document.getElementById("progress"),
  wrongCount: document.getElementById("wrongCount"),
  dailyProgress: document.getElementById("dailyProgress"),
  dailyTrack: document.getElementById("dailyTrack"),
  accuracy: document.getElementById("accuracy"),
  stageSteps: document.getElementById("stageSteps"),
  meaning: document.getElementById("meaning"),
  phonetic: document.getElementById("phonetic"),
  exampleLine: document.getElementById("exampleLine"),
  exampleBody: document.getElementById("exampleBody"),
  speakBtn: document.getElementById("speakBtn"),
  slots: document.getElementById("slots"),
  input: document.getElementById("hiddenInput"),
  hint: document.getElementById("hint"),
  skipBtn: document.getElementById("skipBtn"),
  nextBtn: document.getElementById("nextBtn"),
  prevWordBtn: document.getElementById("prevWordBtn"),
  nextWordBtn: document.getElementById("nextWordBtn"),

  wrongbookList: document.getElementById("wrongbookList"),
  wrongbookScope: document.getElementById("wrongbookScope"),
  masteredList: document.getElementById("masteredList"),
  masteredDesc: document.getElementById("masteredDesc"),
  masteredScope: document.getElementById("masteredScope"),
  startReviewBtn: document.getElementById("startReviewBtn"),
  reviewSession: document.getElementById("reviewSession"),
  reviewCard: document.getElementById("reviewCard"),
  reviewDone: document.getElementById("reviewDone"),
  reviewDoneNote: document.getElementById("reviewDoneNote"),
  reviewCount: document.getElementById("reviewCount"),
  reviewLib: document.getElementById("reviewLib"),
  reviewWord: document.getElementById("reviewWord"),
  reviewPhonetic: document.getElementById("reviewPhonetic"),
  reviewMeaning: document.getElementById("reviewMeaning"),
  reviewExample: document.getElementById("reviewExample"),
  reviewExampleBody: document.getElementById("reviewExampleBody"),
  reviewSpeakBtn: document.getElementById("reviewSpeakBtn"),
  reviewKnowBtn: document.getElementById("reviewKnowBtn"),
  reviewFuzzyBtn: document.getElementById("reviewFuzzyBtn"),
  reviewUnknownBtn: document.getElementById("reviewUnknownBtn"),
  exitReviewBtn: document.getElementById("exitReviewBtn"),
  finishReviewBtn: document.getElementById("finishReviewBtn"),

  settingsModal: document.getElementById("settingsModal"),
  openSettingsBtn: document.getElementById("openSettingsBtn"),
  cancelSettingsBtn: document.getElementById("cancelSettingsBtn"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
  goalInput: document.getElementById("goalInput"),
  reviewMultiplierSelect: document.getElementById("reviewMultiplierSelect"),
  reviewLimitHint: document.getElementById("reviewLimitHint"),
  syncKeyDisplay: document.getElementById("syncKeyDisplay"),
  copySyncKeyBtn: document.getElementById("copySyncKeyBtn"),
  syncKeyInput: document.getElementById("syncKeyInput"),
  bindSyncKeyBtn: document.getElementById("bindSyncKeyBtn"),
  manualUploadBtn: document.getElementById("manualUploadBtn"),
  uploadHint: document.getElementById("uploadHint"),

  csvInput: document.getElementById("csvInput"),
  importCsvBtn: document.getElementById("importCsvBtn"),
  addManualBtn: document.getElementById("addManualBtn"),
  managerList: document.getElementById("managerList")
};

// --- 侧边栏与视图切换 ---
els.toggleSidebar.addEventListener("click", () => els.sidebar.classList.toggle("collapsed"));
els.navBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const targetId = btn.getAttribute("data-target");
    if (!targetId) return;
    els.navBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    els.views.forEach(v => v.classList.remove("active"));
    document.getElementById(targetId).classList.add("active");
    if (targetId === "view-wrongbook") renderList("wrongbook");
    if (targetId === "view-mastered") renderList("mastered");
    if (targetId === "view-manager") renderManagerList();
    if (targetId === "view-stats") renderStats();
  });
});

// --- 数据统计 ---
function renderStats() {
  const stats = Storage.getStats();
  const daily = Storage.getDailyStats();
  const allData = Storage.loadAll();

  let totalErrors = 0;
  for (const k in allData) totalErrors += (allData[k].totalErrors || 0);

  const today = daily.learnedWords ? daily.learnedWords.length : 0;
  const goal = Storage.getSettings().dailyGoal || 20;

  document.getElementById("stat-mastered").textContent = stats.mastered || 0;
  document.getElementById("stat-wrong").textContent = stats.wrongBook || 0;
  document.getElementById("stat-today").textContent = today;
  document.getElementById("stat-errors").textContent = totalErrors;
  document.getElementById("stat-goal").textContent = `/ ${goal} 词`;
  document.getElementById("statDailyFill").style.setProperty("--progress", Math.min(1, goal > 0 ? today / goal : 0));
  renderWeek();
}

function renderWeek() {
  const history = Storage.getDailyHistory();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const entry = history[key];
    days.push({
      label: "日一二三四五六"[d.getDay()],
      count: entry && entry.learnedWords ? entry.learnedWords.length : 0,
      today: i === 0,
    });
  }

  const max = Math.max(1, ...days.map(d => d.count));
  const total = days.reduce((sum, d) => sum + d.count, 0);

  const bars = days.map(d => `
    <div class="stat-bar${d.today ? " stat-bar--today" : ""}" title="${d.count} 词">
      <div class="stat-bar-fill" style="--h: ${Math.round((d.count / max) * 100)}%"></div>
    </div>`).join("");
  const labels = days.map(d => `<span class="stat-day${d.today ? " stat-day--today" : ""}">${d.label}</span>`).join("");

  document.getElementById("statBars").innerHTML =
    `<div class="stat-plot">${bars}</div><div class="stat-days">${labels}</div>`;
  document.getElementById("statWeekTotal").textContent = `共 ${total} 词`;
}

// --- 错题本：按字母格标出拼错的位置 ---
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function spellCells(target, input) {
  let html = "";
  const max = Math.max(target.length, input.length);
  for (let i = 0; i < max; i++) {
    const c = input[i];
    const t = target[i];
    if (c === undefined) {
      html += `<span class="cell cell--miss" title="漏打 ${escapeHtml(t)}"></span>`;
    } else if (c === " ") {
      html += `<span class="cell cell--space"></span>`;
    } else if (c === t) {
      html += `<span class="cell">${escapeHtml(c)}</span>`;
    } else {
      html += `<span class="cell cell--wrong">${escapeHtml(c)}</span>`;
    }
  }
  return html;
}

function spellRows(target, spellings) {
  const entries = Object.entries(spellings || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (entries.length === 0) return "";
  const rows = entries.map(([spelling, count]) => `
    <div class="spell-row">
      <div class="cells">${spellCells(target, spelling)}</div>
      <span class="spell-times">${count} 次</span>
    </div>`).join("");
  return `<div class="spell-block"><span class="spell-label">高频错误</span><div class="spell-rows">${rows}</div></div>`;
}

function formatReviewDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "今天";
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

// --- 词库元数据（用于按来源分组显示已掌握词） ---
const libMeta = { index: null, words: new Map() };

async function ensureLibIndex() {
  if (!libMeta.index) {
    try {
      const res = await fetch('./data/index.json');
      libMeta.index = res.ok ? await res.json() : [];
    } catch { libMeta.index = []; }
  }
  return libMeta.index;
}

async function getLibWords(libId) {
  if (libId === 'custom') return Storage.getCustomLib();
  if (!libMeta.words.has(libId)) {
    let words = [];
    try {
      const res = await fetch(`./data/official/${libId}.json`);
      if (res.ok) words = await res.json();
    } catch {}
    libMeta.words.set(libId, words);
  }
  return libMeta.words.get(libId);
}

function libDisplayName(libId) {
  const entry = (libMeta.index || []).find(x => x.id === libId);
  return entry ? entry.name : (libId === 'custom' ? '我的词库' : libId);
}

async function loadWordGroups(kind) {
  await ensureLibIndex();
  const groups = [];
  for (const libId of Storage.getAllLibIdsWithProgress()) {
    const all = Storage.loadAll(libId);
    const keys = Object.keys(all).filter(k => kind === 'mastered'
      ? (all[k].stage === 4 && !all[k].isWrongBook)
      : !!all[k].isWrongBook);
    if (!keys.length) continue;
    const words = await getLibWords(libId);
    const byWord = new Map(words.map(w => [w.word, w]));
    const name = libDisplayName(libId);
    groups.push({
      libId, name,
      entries: keys.map(k => ({
        ...(byWord.get(k) || { word: k, meaning: '未知', phonetic: '' }),
        status: all[k], libId, libName: name
      }))
    });
  }
  return groups;
}

// 两个列表各自记住「当前词库 / 全部」
const listScope = {
  wrongbook: localStorage.getItem('typing_words_scope_wrongbook') || 'current',
  mastered: localStorage.getItem('typing_words_scope_mastered') || 'all'
};

function scopedGroups(groups, type) {
  return listScope[type] === 'current'
    ? groups.filter(g => g.libId === Storage.getCurrentLib())
    : groups;
}

function updateScopeButtons(type) {
  const scopeEl = type === 'mastered' ? els.masteredScope : els.wrongbookScope;
  if (!scopeEl) return;
  scopeEl.querySelectorAll('.scope-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.scope === listScope[type]);
  });
}

function setListScope(type, scope) {
  listScope[type] = scope;
  localStorage.setItem(`typing_words_scope_${type}`, scope);
  updateScopeButtons(type);
  if (type === 'mastered') renderMastered(); else renderWrongBook();
}

[['mastered', els.masteredScope], ['wrongbook', els.wrongbookScope]].forEach(([type, scopeEl]) => {
  if (!scopeEl) return;
  scopeEl.querySelectorAll('.scope-btn').forEach(btn => {
    btn.addEventListener('click', () => setListScope(type, btn.dataset.scope));
  });
  updateScopeButtons(type);
});

function renderList(type) {
  if (type === 'mastered') renderMastered();
  else renderWrongBook();
}

function renderGroupedList(container, groups, type, showGroupHead, emptyTitle, emptyHint) {
  container.innerHTML = '';
  const total = groups.reduce((n, g) => n + g.entries.length, 0);
  if (!total) {
    container.innerHTML = `<div class="empty"><p class="empty-title">${emptyTitle}</p><p class="empty-hint">${emptyHint}</p></div>`;
    return total;
  }
  groups.forEach(group => {
    if (showGroupHead) {
      const section = document.createElement("section");
      section.className = "mastered-group";
      section.innerHTML = `
        <div class="mastered-group-head">
          <span class="mastered-group-name">${escapeHtml(group.name)}</span>
          <span class="mastered-group-count">${group.entries.length} 词</span>
        </div>
        <div class="list-grid"></div>`;
      const grid = section.querySelector(".list-grid");
      group.entries.forEach(w => grid.appendChild(createWordCard(w, type, group.libId)));
      container.appendChild(section);
    } else {
      const grid = document.createElement("div");
      grid.className = "list-grid";
      group.entries.forEach(w => grid.appendChild(createWordCard(w, type, group.libId)));
      container.appendChild(grid);
    }
  });
  return total;
}

function createWordCard(w, type, libId) {
  const card = document.createElement("article");
  card.className = "word-card";

  let meta = "";
  if (type === "wrongbook" && w.status) {
    const total = w.status.totalErrors || 0;
    meta += `<p class="word-card-meta">累计错 <b>${total}</b> 次</p>`;
    const todayCount = (w.status.dailyErrors || {})[Storage.getTodayString()] || 0;
    if (todayCount) {
      const pending = w.status.wrongReviewDate && Date.now() < w.status.wrongReviewDate;
      meta += `<p class="word-card-meta">今日错 <b>${todayCount}</b> 次${pending ? " · 次日复习" : ""}</p>`;
    }
    meta += spellRows(w.word, w.status.wrongSpellings);
  }
  if (type === "mastered" && w.status && w.status.nextReview) {
    meta += `<p class="word-card-meta">下次复习 ${formatReviewDate(w.status.nextReview)}</p>`;
  }

  card.innerHTML = `
    <div class="word-card-head">
      <span class="word-card-word">${escapeHtml(w.word)}</span>
      ${w.phonetic ? `<span class="word-card-phonetic">${escapeHtml(w.phonetic)}</span>` : ""}
    </div>
    <p class="word-card-meaning">${escapeHtml(w.meaning)}</p>
    ${hasExample(w.example) ? `<p class="word-card-example"><span class="example-label">示例</span> ${exampleHtml(w.example)}</p>` : ""}
    ${meta}
    <div class="word-card-actions">
      <button class="icon-btn btn-icon" type="button" aria-label="播放 ${escapeHtml(w.word)} 发音">${icon("volume")}</button>
      <button class="icon-btn btn-icon btn-delete" type="button" aria-label="移除 ${escapeHtml(w.word)}">${icon("trash")}</button>
    </div>
  `;

  card.querySelector(".btn-icon:not(.btn-delete)").addEventListener("click", () => speak(w.word));

  card.querySelector(".btn-delete").addEventListener("click", () => {
    if (confirm(`确定将 "${w.word}" 移出已掌握并重置该词库的学习进度吗？`)) {
      Storage.removeWordStatus(w.word, libId);
      triggerAutoSync();
      if (type === "mastered") renderMastered(); else renderList("wrongbook");
    }
  });

  return card;
}

let wrongbookRenderId = 0, masteredRenderId = 0;

async function renderWrongBook() {
  const renderId = ++wrongbookRenderId;
  const groups = scopedGroups(await loadWordGroups("wrongbook"), "wrongbook");
  if (renderId !== wrongbookRenderId) return;
  renderGroupedList(els.wrongbookList, groups, "wrongbook", listScope.wrongbook === "all",
    "还没有错题", "连续拼错两次的词会出现在这里");
}

async function renderMastered() {
  const renderId = ++masteredRenderId;
  const groups = scopedGroups(await loadWordGroups("mastered"), "mastered");
  if (renderId !== masteredRenderId) return;
  const total = renderGroupedList(els.masteredList, groups, "mastered", listScope.mastered === "all",
    "还没有已掌握的词", "完成学习、听写、默写后进入定期复习");
  els.masteredDesc.textContent = listScope.mastered === "all"
    ? "汇总所有词库的已掌握词，按来源词库分组"
    : "当前词库的已掌握词，完成学习后进入定期复习";
  els.startReviewBtn.disabled = total === 0;
}

// --- 已掌握：快速复习 ---
const review = { words: [], index: 0, counts: { know: 0, fuzzy: 0, unknown: 0 }, current: null, active: false };

function renderReview() {
  if (review.index >= review.words.length) {
    review.current = null;
    els.reviewCard.hidden = true;
    els.reviewDone.hidden = false;
    els.reviewCount.textContent = `${review.words.length} / ${review.words.length}`;
    els.reviewDoneNote.textContent = `认识 ${review.counts.know} · 模糊 ${review.counts.fuzzy} · 不认识 ${review.counts.unknown}`;
    return;
  }
  const w = review.words[review.index];
  review.current = w;
  els.reviewCard.hidden = false;
  els.reviewDone.hidden = true;
  els.reviewCount.textContent = `${review.index + 1} / ${review.words.length}`;
  els.reviewLib.textContent = w.libName || "";
  els.reviewWord.textContent = w.word;
  els.reviewPhonetic.textContent = w.phonetic || "";
  els.reviewMeaning.textContent = w.meaning;
  els.reviewExample.hidden = !hasExample(w.example);
  renderExample(els.reviewExampleBody, w.example);
}

async function startQuickReview() {
  const groups = scopedGroups(await loadWordGroups("mastered"), "mastered");
  review.words = groups.flatMap(g => g.entries);
  if (!review.words.length) return;
  review.index = 0;
  review.counts = { know: 0, fuzzy: 0, unknown: 0 };
  review.active = true;
  els.startReviewBtn.disabled = true;
  els.reviewSession.hidden = false;
  els.masteredList.hidden = true;
  renderReview();
}

function closeQuickReview(rerender = true) {
  review.active = false;
  review.current = null;
  els.reviewSession.hidden = true;
  els.masteredList.hidden = false;
  els.startReviewBtn.disabled = !Storage.getMasteredByLib().some(g =>
    listScope.mastered === "all" || g.libId === Storage.getCurrentLib());
  if (rerender) renderList("mastered");
}

function handleReviewChoice(kind) {
  const w = review.words[review.index];
  if (!w) return;
  if (kind === "know") {
    Storage.skipMasteredReview(w.word, w.libId);
    review.counts.know++;
  } else if (kind === "fuzzy") {
    Storage.addTodayReviewWord(w.word, w.libId);
    review.counts.fuzzy++;
  } else {
    Storage.demoteMasteredWord(w.word, w.libId);
    review.counts.unknown++;
  }
  triggerAutoSync();
  review.index++;
  renderReview();
}

els.startReviewBtn.addEventListener("click", startQuickReview);
els.exitReviewBtn.addEventListener("click", () => closeQuickReview());
els.finishReviewBtn.addEventListener("click", () => closeQuickReview());
els.reviewSpeakBtn.addEventListener("click", () => review.current && speak(review.current.word));
els.reviewKnowBtn.addEventListener("click", () => handleReviewChoice("know"));
els.reviewFuzzyBtn.addEventListener("click", () => handleReviewChoice("fuzzy"));
els.reviewUnknownBtn.addEventListener("click", () => handleReviewChoice("unknown"));

// --- 设置弹窗 ---
function formatCooldown(seconds) {
  return seconds >= 60 ? `${Math.ceil(seconds / 60)} 分钟` : `${seconds} 秒`;
}

let uploadHintTimer = null;
function refreshUploadHint() {
  const left = getUploadCooldown();
  els.manualUploadBtn.disabled = left > 0;
  if (left > 0) els.uploadHint.textContent = `请 ${formatCooldown(left)}后再上传`;
  return left;
}
function startUploadCountdown() {
  clearInterval(uploadHintTimer);
  uploadHintTimer = setInterval(() => {
    if (!els.settingsModal.classList.contains("show")) { clearInterval(uploadHintTimer); return; }
    refreshUploadHint();
  }, 1000);
}

els.manualUploadBtn.addEventListener("click", async () => {
  if (getUploadCooldown()) return;
  els.manualUploadBtn.disabled = true;
  els.uploadHint.textContent = "正在上传…";
  const res = await uploadToCloud();
  if (res.ok) {
    els.uploadHint.textContent = "已上传到云端";
  } else if (res.reason === "cooldown" || res.reason === "server") {
    els.uploadHint.textContent = `请 ${formatCooldown(res.retryAfter)}后再上传`;
  } else {
    els.uploadHint.textContent = "上传失败，请稍后重试";
  }
  els.manualUploadBtn.disabled = getUploadCooldown() > 0;
  startUploadCountdown();
});

function updateReviewLimitHint() {
  const goal = parseInt(els.goalInput.value, 10) || 0;
  const mult = Number(els.reviewMultiplierSelect.value) || 2;
  els.reviewLimitHint.textContent = `当前上限 ${Math.floor(goal * mult)} 词复习 / 天`;
}

els.openSettingsBtn.addEventListener("click", () => {
  const settings = Storage.getSettings();
  els.goalInput.value = settings.dailyGoal;
  const mult = String(settings.reviewMultiplier ?? 2);
  const options = [...els.reviewMultiplierSelect.options].map(o => o.value);
  els.reviewMultiplierSelect.value = options.includes(mult) ? mult : "2";
  updateReviewLimitHint();
  els.syncKeyDisplay.value = Storage.getSyncKey();
  const uploadLeft = refreshUploadHint();
  if (!uploadLeft) els.uploadHint.textContent = "将当前本地进度上传到云端";
  startUploadCountdown();
  els.settingsModal.classList.add("show");
});
els.goalInput.addEventListener("input", updateReviewLimitHint);
els.reviewMultiplierSelect.addEventListener("change", updateReviewLimitHint);
els.cancelSettingsBtn.addEventListener("click", () => els.settingsModal.classList.remove("show"));
els.saveSettingsBtn.addEventListener("click", () => {
  const val = parseInt(els.goalInput.value, 10);
  if (val > 0) {
    Storage.saveSettings({ dailyGoal: val, reviewMultiplier: Number(els.reviewMultiplierSelect.value) || 2 });
    triggerAutoSync(); // 确保这里有这句，修改设置立刻同步
    els.settingsModal.classList.remove("show");
    window.location.reload(); 
  }
});

const resetBtn = document.getElementById("resetAllDataBtn");
if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    if (confirm("重置会清空当前词库的所有学习记录，包括错题本和已掌握，且不可恢复\n是否继续")) {
      if (confirm("再次确认：重置所有进度")) {
        Storage.resetCurrentLibProgress();
        triggerAutoSync();
        alert("已重置当前词库的进度，页面将刷新");
        location.reload();
      }
    }
  });
}

els.copySyncKeyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(Storage.getSyncKey());
  alert("同步码已复制");
});
els.bindSyncKeyBtn.addEventListener("click", async () => {
  const newKey = els.syncKeyInput.value.trim();
  if (!newKey) return;
  if (confirm("绑定新同步码会覆盖本地进度，是否继续")) {
    Storage.setSyncKey(newKey);
    els.syncKeyDisplay.value = newKey;
    const hasData = await fetchFromCloud();
    alert(hasData ? "已绑定并拉取云端数据" : "已绑定，云端暂无数据");
    location.reload();
  }
});

els.importCsvBtn.addEventListener("click", () => els.csvInput.click());

// --- 词库加载与下拉框 ---
async function loadLibData(libId) {
  if (libId === 'custom') {
    setLibData(Storage.getCustomLib());
    return;
  }
  try {
    const res = await fetch(`./data/official/${libId}.json`);
    if (!res.ok) throw new Error();
    setLibData(await res.json());
  } catch (err) {
    console.error("加载词库失败", err);
    alert("加载词库失败，请检查网络或文件是否存在");
    setLibData([]);
  }
}

async function initLibSelector() {
  const customOption = document.createElement("option");
  customOption.value = "custom";
  customOption.textContent = "我的词库";
  els.libSelect.appendChild(customOption);

  try {
    const res = await fetch('./data/index.json');
    const indexList = await res.json();
    const currentLibId = Storage.getCurrentLib();

    indexList.forEach(lib => {
      if (lib.id === 'custom') return;
      const option = document.createElement("option");
      option.value = lib.id;
      option.textContent = lib.name;
      els.libSelect.appendChild(option);
    });

    els.libSelect.value = currentLibId;
    await loadLibData(currentLibId);
  } catch (err) {
    console.error("加载词库目录失败", err);
  }

  els.libSelect.addEventListener("change", async (e) => {
    const newLibId = e.target.value;
    Storage.setCurrentLib(newLibId);
    if (review.active) closeQuickReview(false);
    els.meaning.textContent = "正在加载词库";
    els.slots.innerHTML = "";
    await loadLibData(newLibId);
    restartPractice();
    if (listScope.mastered === "current") renderMastered();
    if (listScope.wrongbook === "current") renderWrongBook();
  });
}

// --- 启动 ---
(async function init() {
  initPractice(els);
  initManager(els);

  const isSynced = await fetchFromCloud();
  if (isSynced && Storage.getCurrentLib() === 'custom') {
    setLibData(Storage.getCustomLib());
  }

  await initLibSelector();
  restartPractice();
})();
