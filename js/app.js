import { Storage } from './storage.js';
import { speak } from './modules/audio.js';
import { fetchFromCloud } from './modules/sync.js';
import { initPractice, setLibData, restartPractice, renderCurrent, nextWord } from './modules/practice.js';
import { initManager, renderManagerList } from './modules/manager.js';
import { triggerAutoSync } from './modules/sync.js';

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
  speakBtn: document.getElementById("speakBtn"),
  slots: document.getElementById("slots"),
  input: document.getElementById("hiddenInput"),
  hint: document.getElementById("hint"),
  skipBtn: document.getElementById("skipBtn"),
  nextBtn: document.getElementById("nextBtn"),
  prevWordBtn: document.getElementById("prevWordBtn"),
  nextWordBtn: document.getElementById("nextWordBtn"),

  wrongbookList: document.getElementById("wrongbookList"),
  masteredList: document.getElementById("masteredList"),

  settingsModal: document.getElementById("settingsModal"),
  openSettingsBtn: document.getElementById("openSettingsBtn"),
  cancelSettingsBtn: document.getElementById("cancelSettingsBtn"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
  goalInput: document.getElementById("goalInput"),
  syncKeyDisplay: document.getElementById("syncKeyDisplay"),
  copySyncKeyBtn: document.getElementById("copySyncKeyBtn"),
  syncKeyInput: document.getElementById("syncKeyInput"),
  bindSyncKeyBtn: document.getElementById("bindSyncKeyBtn"),

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

// --- 列表渲染 ---
function renderList(type) {
  const container = type === "wrongbook" ? els.wrongbookList : els.masteredList;
  const words = type === "wrongbook" ? Storage.getWrongBookWords() : Storage.getMasteredWords();
  container.innerHTML = "";

  if (words.length === 0) {
    const isWrong = type === "wrongbook";
    container.innerHTML = `
      <div class="empty">
        <p class="empty-title">${isWrong ? "还没有错题" : "还没有已掌握的词"}</p>
        <p class="empty-hint">${isWrong ? "连续拼错两次的词会出现在这里" : "完成学习、听写、默写后进入定期复习"}</p>
      </div>`;
    return;
  }

  words.forEach(w => {
    const card = document.createElement("article");
    card.className = "word-card";

    let meta = "";
    if (type === "wrongbook" && w.status) {
      const total = w.status.totalErrors || 0;
      meta += `<p class="word-card-meta">累计错 <b>${total}</b> 次</p>`;
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
      ${meta}
      <div class="word-card-actions">
        <button class="icon-btn btn-icon" type="button" aria-label="播放 ${escapeHtml(w.word)} 发音">${icon("volume")}</button>
        <button class="icon-btn btn-icon btn-delete" type="button" aria-label="移除 ${escapeHtml(w.word)}">${icon("trash")}</button>
      </div>
    `;

    card.querySelector(".btn-icon:not(.btn-delete)").addEventListener("click", () => speak(w.word));

    card.querySelector(".btn-delete").addEventListener("click", () => {
      if (confirm(`确定将 "${w.word}" 移出列表并重置学习进度吗？`)) {
        Storage.removeWordStatus(w.word);
        triggerAutoSync();
        renderList(type);
      }
    });

    container.appendChild(card);
  });
}

// --- 设置弹窗 ---
els.openSettingsBtn.addEventListener("click", () => {
  const settings = Storage.getSettings();
  els.goalInput.value = settings.dailyGoal;
  els.syncKeyDisplay.value = Storage.getSyncKey();
  els.settingsModal.classList.add("show");
});
els.cancelSettingsBtn.addEventListener("click", () => els.settingsModal.classList.remove("show"));
els.saveSettingsBtn.addEventListener("click", () => {
  const val = parseInt(els.goalInput.value, 10);
  if (val > 0) {
    Storage.saveSettings({ dailyGoal: val });
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
    els.meaning.textContent = "正在加载词库";
    els.slots.innerHTML = "";
    await loadLibData(newLibId);
    restartPractice();
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
