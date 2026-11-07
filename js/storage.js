const KEY_PREFIX = "typing_words_v3_";
const CURRENT_LIB_KEY = "typing_words_current_lib";

export const Storage = {
  getCurrentLib() { return localStorage.getItem(CURRENT_LIB_KEY) || "computer"; },
  setCurrentLib(id) { localStorage.setItem(CURRENT_LIB_KEY, id); },

  getKeys() {
    const lib = this.getCurrentLib();
    return {
      progress: `${KEY_PREFIX}progress_${lib}`,
      settings: `${KEY_PREFIX}settings_${lib}`,
      daily: `${KEY_PREFIX}daily_${lib}`
    };
  },

  getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  loadAll() {
    try { return JSON.parse(localStorage.getItem(this.getKeys().progress)) || {}; } catch { return {}; }
  },
  
  saveAll(data) { localStorage.setItem(this.getKeys().progress, JSON.stringify(data)); },

  getStatus(word) {
    const all = this.loadAll();
    return all[word] || { stage: 1, consecutiveCorrect: 0, consecutiveErrors: 0, isWrongBook: false };
  },

  record(word, isCorrect) {
    const all = this.loadAll();
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
    this.saveAll(all);
    return item; 
  },

  getStats() {
    const all = this.loadAll();
    let mastered = 0, wrongBook = 0;
    for (const k in all) {
      if (all[k].isWrongBook) wrongBook++;
      else if (all[k].stage === 4) mastered++;
    }
    return { mastered, wrongBook };
  },

  getWrongBookWords() {
    const all = this.loadAll();
    return Object.keys(all).filter(k => all[k].isWrongBook).map(k => {
      const wordData = (window.currentLibDataCache || []).find(w => w.word === k) || { word: k, meaning: "未知", phonetic: "" };
      return { ...wordData, status: all[k] };
    });
  },

  getMasteredWords() {
    const all = this.loadAll();
    return Object.keys(all).filter(k => all[k].stage === 4 && !all[k].isWrongBook).map(k => {
      const wordData = (window.currentLibDataCache || []).find(w => w.word === k) || { word: k, meaning: "未知", phonetic: "" };
      return { ...wordData, status: all[k] };
    });
  },

  getSettings() {
    try { return JSON.parse(localStorage.getItem(this.getKeys().settings)) || { dailyGoal: 20 }; } catch { return { dailyGoal: 20 }; }
  },
  
  saveSettings(settings) { localStorage.setItem(this.getKeys().settings, JSON.stringify(settings)); },

  getDailyStats() {
    try {
      const all = JSON.parse(localStorage.getItem(this.getKeys().daily)) || {};
      return all[this.getTodayString()] || { learnedWords: [] };
    } catch { return { learnedWords: [] }; }
  },

  addDailyLearnedWord(word) {
    try {
      const all = JSON.parse(localStorage.getItem(this.getKeys().daily)) || {};
      const today = this.getTodayString();
      if (!all[today]) all[today] = { learnedWords: [] };
      if (!all[today].learnedWords.includes(word)) {
        all[today].learnedWords.push(word);
        localStorage.setItem(this.getKeys().daily, JSON.stringify(all));
      }
    } catch {}
  },

  getCustomLib() {
    try { return JSON.parse(localStorage.getItem("typing_words_custom_lib")) || []; } catch { return []; }
  },
  
  saveCustomLib(words) { localStorage.setItem("typing_words_custom_lib", JSON.stringify(words)); },

  // --- 同步相关 ---
  getSyncKey() {
    let key = localStorage.getItem("typing_words_sync_key");
    if (!key) {
      key = "usr_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      localStorage.setItem("typing_words_sync_key", key);
    }
    return key;
  },

  setSyncKey(key) { localStorage.setItem("typing_words_sync_key", key); },

  getAllLocalData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(KEY_PREFIX)) data[key] = localStorage.getItem(key);
    }
    return data;
  },

  getSyncData() {
    return { progress: this.getAllLocalData(), customLib: this.getCustomLib() };
  },

  // --- 删除单个单词进度 ---
  removeWordStatus(word) {
    const all = this.loadAll();
    if (all[word]) {
      delete all[word];
      this.saveAll(all);
    }
  },

  // --- 重置当前词库进度 ---
  resetCurrentLibProgress() {
    localStorage.removeItem(this.getKeys().progress);
    localStorage.removeItem(this.getKeys().daily);
  },

  applySyncData(data) {
    if (!data) return;
    if (data.progress) {
      for (const key in data.progress) localStorage.setItem(key, data.progress[key]);
    }
    if (data.customLib && Array.isArray(data.customLib)) this.saveCustomLib(data.customLib);
  }
};