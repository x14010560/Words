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
  });
});

// --- 列表渲染 ---
function renderList(type) {
  const container = type === "wrongbook" ? els.wrongbookList : els.masteredList;
  const words = type === "wrongbook" ? Storage.getWrongBookWords() : Storage.getMasteredWords();
  container.innerHTML = "";
  if (words.length === 0) {
    container.innerHTML = `<p class="empty">暂无单词</p>`;
    return;
  }

  words.forEach(w => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <div class="list-info">
        <span class="list-word">${w.word}</span>
        <span class="list-meaning">${w.meaning}</span>
      </div>
      <div class="list-actions">
        <button class="icon-btn btn-icon" type="button" aria-label="播放 ${w.word} 发音">${icon("volume")}</button>
        <button class="icon-btn btn-icon btn-delete" type="button" aria-label="移除 ${w.word}">${icon("trash")}</button>
      </div>
    `;

    div.querySelector(".btn-icon:not(.btn-delete)").addEventListener("click", () => speak(w.word));
    div.querySelector(".btn-delete").addEventListener("click", () => {
      if (confirm(`将 ${w.word} 移出列表并重置学习进度，是否继续`)) {
        Storage.removeWordStatus(w.word);
        triggerAutoSync();
        renderList(type);
      }
    });

    container.appendChild(div);
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
