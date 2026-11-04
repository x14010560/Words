window.Storage = (function () {
  const KEY_PREFIX = "typing_words_v3_";
  const CURRENT_LIB_KEY = "typing_words_current_lib";

  function getCurrentLib() { return localStorage.getItem(CURRENT_LIB_KEY) || "computer"; }
  function setCurrentLib(id) { localStorage.setItem(CURRENT_LIB_KEY, id); }

  function getKeys() {
    const lib = getCurrentLib();
    return {
      progress: `${KEY_PREFIX}progress_${lib}`,
      settings: `${KEY_PREFIX}settings_${lib}`,
      daily: `${KEY_PREFIX}daily_${lib}`
    };
  }

  function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function loadAll() {
    try { return JSON.parse(localStorage.getItem(getKeys().progress)) || {}; } catch { return {}; }
  }
  function saveAll(data) { localStorage.setItem(getKeys().progress, JSON.stringify(data)); }

  function getStatus(word) {
    const all = loadAll();
    return all[word] || { stage: 1, consecutiveCorrect: 0, consecutiveErrors: 0, isWrongBook: false };
  }

  function record(word, isCorrect) {
    const all = loadAll();
    let item = all[word] || { stage: 1, consecutiveCorrect: 0, consecutiveErrors: 0, isWrongBook: false };
    if (isCorrect) {
      item.consecutiveCorrect += 1;
      item.consecutiveErrors = 0; 
      if (item.isWrongBook) {
        if (item.consecutiveCorrect >= 3) { item.isWrongBook = false; item.stage = 4; }
      } else {
        if (item.stage === 1) item.stage = 2;
        else if (item.stage === 2) item.stage = 3;
        else if (item.stage === 3) item.stage = 4;
      }
    } else {
      item.consecutiveErrors += 1;
      item.consecutiveCorrect = 0; 
      if (item.consecutiveErrors >= 2) item.isWrongBook = true;
    }
    all[word] = item;
    saveAll(all);
    return item; 
  }

  function getStats() {
    const all = loadAll();
    let mastered = 0, wrongBook = 0;
    for (const k in all) {
      if (all[k].isWrongBook) wrongBook++;
      else if (all[k].stage === 4) mastered++;
    }
    return { mastered, wrongBook };
  }

  let cachedData = [];
  window.setCurrentLibData = (data) => { cachedData = data; };

  function getWrongBookWords() {
    const all = loadAll();
    return Object.keys(all).filter(k => all[k].isWrongBook).map(k => {
      const wordData = cachedData.find(w => w.word === k) || { word: k, meaning: "未知", phonetic: "" };
      return { ...wordData, status: all[k] };
    });
  }

  function getMasteredWords() {
    const all = loadAll();
    return Object.keys(all).filter(k => all[k].stage === 4 && !all[k].isWrongBook).map(k => {
      const wordData = cachedData.find(w => w.word === k) || { word: k, meaning: "未知", phonetic: "" };
      return { ...wordData, status: all[k] };
    });
  }

  function getSettings() {
    try { return JSON.parse(localStorage.getItem(getKeys().settings)) || { dailyGoal: 20 }; } catch { return { dailyGoal: 20 }; }
  }
  function saveSettings(settings) { localStorage.setItem(getKeys().settings, JSON.stringify(settings)); }
  function getDailyStats() {
    try {
      const all = JSON.parse(localStorage.getItem(getKeys().daily)) || {};
      return all[getTodayString()] || { learnedWords: [] };
    } catch { return { learnedWords: [] }; }
  }
  function addDailyLearnedWord(word) {
    try {
      const all = JSON.parse(localStorage.getItem(getKeys().daily)) || {};
      const today = getTodayString();
      if (!all[today]) all[today] = { learnedWords: [] };
      if (!all[today].learnedWords.includes(word)) {
        all[today].learnedWords.push(word);
        localStorage.setItem(getKeys().daily, JSON.stringify(all));
      }
    } catch {}
  }

  // --- 自定义词库 ---
  function getCustomLib() {
    try { return JSON.parse(localStorage.getItem("typing_words_custom_lib")) || []; } catch { return []; }
  }
  function saveCustomLib(words) {
    localStorage.setItem("typing_words_custom_lib", JSON.stringify(words));
  }

  // --- 同步功能 ---
  function getAllLocalData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith("typing_words_")) {
        data[key] = localStorage.getItem(key);
      }
    }
    return data;
  }

  function applyCloudData(cloudProgress) {
    if (!cloudProgress) return;
    for (const key in cloudProgress) {
      localStorage.setItem(key, cloudProgress[key]);
    }
  }

  return { 
    getCurrentLib, setCurrentLib,
    getStatus, record, getStats, loadAll, 
    getWrongBookWords, getMasteredWords,
    getSettings, saveSettings, getDailyStats, addDailyLearnedWord,
    getCustomLib, saveCustomLib,
    getAllLocalData, applyCloudData
  };
})();