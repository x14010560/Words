import { Storage } from './storage.js';
import { speak } from './modules/audio.js';
import { fetchFromCloud } from './modules/sync.js';
import { initPractice, setLibData, restartPractice, renderCurrent, nextWord } from './modules/practice.js';
import { initManager, renderManagerList } from './modules/manager.js';
import { triggerAutoSync } from './modules/sync.js';
// 集中管理所有 DOM
const els = {
  navBtns: document.querySelectorAll(".nav-btn"),
  views: document.querySelectorAll(".view"),
  sidebar: document.getElementById("sidebar"),
  toggleSidebar: document.getElementById("toggleSidebar"),
  libSelect: document.getElementById("libSelect"),
  
  // 练习区
  modeTag: document.getElementById("modeTag"),
  progress: document.getElementById("progress"),
  dailyProgress: document.getElementById("dailyProgress"),
  accuracy: document.getElementById("accuracy"),
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
  syncKeyDisplay: document.getElementById("syncKeyDisplay"),
  copySyncKeyBtn: document.getElementById("copySyncKeyBtn"),
  syncKeyInput: document.getElementById("syncKeyInput"),
  bindSyncKeyBtn: document.getElementById("bindSyncKeyBtn"),

  // 词库管理
  csvInput: document.getElementById("csvInput"),
  addManualBtn: document.getElementById("addManualBtn"),
  managerList: document.getElementById("managerList")
};

// --- 侧边栏与视图切换 ---
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
      if (targetId === "view-manager") renderManagerList();
    }
  });
});

// --- 列表渲染 ---
function renderList(type) {
  const container = type === "wrongbook" ? els.wrongbookList : els.masteredList;
  const words = type === "wrongbook" ? Storage.getWrongBookWords() : Storage.getMasteredWords();
  container.innerHTML = "";
  if (words.length === 0) { container.innerHTML = `<p style="color:var(--muted);text-align:center;padding:20px;">暂无单词</p>`; return; }
  
  words.forEach(w => {
    const div = document.createElement("div");
    div.className = "list-item";
    
    // 增加删除按钮
    div.innerHTML = `
      <div class="list-info">
        <span class="list-word">${w.word}</span>
        <span class="list-meaning">${w.meaning}</span>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-icon" title="发音">🔊</button>
        <button class="btn btn-icon btn-delete" title="删除并重置">🗑️</button>
      </div>
    `;
    
    div.querySelector(".btn-icon:not(.btn-delete)").addEventListener("click", () => speak(w.word));
    
    // 绑定删除事件
    div.querySelector(".btn-delete").addEventListener("click", () => {
      if (confirm(`确定将 "${w.word}" 移出列表并重置学习进度吗？`)) {
        Storage.removeWordStatus(w.word);
        triggerAutoSync(); // 触发云端同步
        renderList(type);  // 刷新列表
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

// 重置当前词库数据
const resetBtn = document.getElementById("resetAllDataBtn");
if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    if (confirm("⚠️ 警告：这会清空当前词库的所有学习记录（包括错题本、已掌握），且不可恢复！\n确定要重置吗？")) {
      // 二次确认
      if (confirm("再次确认：真的要重置所有进度吗？")) {
        Storage.resetCurrentLibProgress();
        triggerAutoSync(); // 同步空数据到云端
        alert("已重置当前词库的所有进度，页面将刷新。");
        location.reload();
      }
    }
  });
}

els.copySyncKeyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(Storage.getSyncKey());
  alert("同步码已复制！");
});
els.bindSyncKeyBtn.addEventListener("click", async () => {
  const newKey = els.syncKeyInput.value.trim();
  if (!newKey) return;
  if (confirm("绑定新同步码会覆盖当前本地进度，确定吗？")) {
    Storage.setSyncKey(newKey);
    els.syncKeyDisplay.value = newKey;
    const hasData = await fetchFromCloud();
    alert(hasData ? "☁️ 绑定成功并拉取了数据。" : "绑定成功，云端暂无数据。");
    location.reload();
  }
});

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
  customOption.textContent = "🌟 我的自定义词库";
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
    els.meaning.textContent = "词库加载中...";
    els.slots.innerHTML = "";
    await loadLibData(newLibId);
    restartPractice();
  });
}

// --- 启动 ---
(async function init() {
  // 1. 初始化 UI 模块
  initPractice(els);
  initManager(els);

  // 2. 云端拉取
  const isSynced = await fetchFromCloud();
  if (isSynced && Storage.getCurrentLib() === 'custom') {
    setLibData(Storage.getCustomLib());
  }

  // 3. 加载词库并开始练习
  await initLibSelector();
  restartPractice();
})();