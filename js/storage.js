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

  // 次日 00:00（本地时间），错题当天不再回流到练习队列
  getTomorrowStart() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  },

  loadAll() {
    try { return JSON.parse(localStorage.getItem(this.getKeys().progress)) || {}; } catch { return {}; }
  },
  
  saveAll(data) { localStorage.setItem(this.getKeys().progress, JSON.stringify(data)); },

  getStatus(word) {
    const all = this.loadAll();
    return all[word] || { stage: 1, consecutiveCorrect: 0, consecutiveErrors: 0, isWrongBook: false, dailyErrors: {}, streakDate: "" };
  },

  record(word, isCorrect, userInput = "") {
    const all = this.loadAll();
    let item = all[word] || { 
      stage: 1, 
      consecutiveCorrect: 0, 
      consecutiveErrors: 0, 
      isWrongBook: false,
      interval: 1,
      nextReview: 0,
      totalErrors: 0,
      wrongSpellings: {}, // 改为字典，记录错误拼写及其频率
      lastErrorDate: "",       // 最近一次答错的日期
      wrongReviewDate: 0,      // 错题复习日（次日 00:00）
      dailyErrors: {},         // 当日错误权重，只加不减
      streakDate: ""           // 当前连对是在哪一天攒出来的
    };

    const today = this.getTodayString();
    // 答错当天不允许靠连对移出错题本；必须等到首个“无错日”，且三次连对都在这一天
    const canClearToday = !item.lastErrorDate || today > item.lastErrorDate;

    if (isCorrect) {
      if (item.isWrongBook) {
        if (canClearToday) {
          if (item.streakDate !== today) {
            item.consecutiveCorrect = 0;
            item.streakDate = today;
          }
          item.consecutiveCorrect += 1;
        }
      } else {
        item.consecutiveCorrect += 1;
      }
      item.consecutiveErrors = 0; 
      
      if (item.isWrongBook) {
        if (canClearToday && item.consecutiveCorrect >= 3) { 
          item.isWrongBook = false; 
          item.stage = 4; 
          item.interval = 3;
          item.nextReview = Date.now() + 3 * 24 * 60 * 60 * 1000;
          item.wrongReviewDate = 0;
          item.consecutiveCorrect = 0;
          item.streakDate = "";
        }
      } else {
        if (item.stage === 1) item.stage = 2;
        else if (item.stage === 2) item.stage = 3;
        else if (item.stage === 3) {
          item.stage = 4;
          item.interval = 3;
          item.nextReview = Date.now() + 3 * 24 * 60 * 60 * 1000;
        } else if (item.stage === 4) {
          item.interval = Math.max(3, (item.interval || 3) * 2.5); 
          item.nextReview = Date.now() + item.interval * 24 * 60 * 60 * 1000;
        }
      }
    } else {
      item.consecutiveErrors += 1;
      item.consecutiveCorrect = 0; 
      item.streakDate = "";
      item.totalErrors = (item.totalErrors || 0) + 1;
      item.lastErrorDate = today;

      // 错误权重：同一天只会增加，答对也不会回退
      if (!item.dailyErrors) item.dailyErrors = {};
      item.dailyErrors[today] = (item.dailyErrors[today] || 0) + 1;

      // 记录错误的拼写，并统计频率
      if (userInput && userInput !== word) {
        if (!item.wrongSpellings) item.wrongSpellings = {};
        item.wrongSpellings[userInput] = (item.wrongSpellings[userInput] || 0) + 1;
        
        // 限制最多只存 10 种不同的错误拼写，防止数据过大
        const keys = Object.keys(item.wrongSpellings);
        if (keys.length > 10) {
          // 找出频率最低的删掉
          let minKey = keys[0];
          for (const k of keys) {
            if (item.wrongSpellings[k] < item.wrongSpellings[minKey]) minKey = k;
          }
          delete item.wrongSpellings[minKey];
        }
      }
      
      if (item.stage === 4) {
        item.stage = 2;
        item.interval = 1;
        item.nextReview = 0;
      }

      if (item.consecutiveErrors >= 2) {
        item.isWrongBook = true;
      }
      if (item.isWrongBook) {
        // 错题次日再复习，当天不回流到练习队列
        item.wrongReviewDate = this.getTomorrowStart();
      }
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
    const defaults = { dailyGoal: 20, reviewMultiplier: 2 };
    try { return { ...defaults, ...(JSON.parse(localStorage.getItem(this.getKeys().settings)) || {}) }; }
    catch { return { ...defaults }; }
  },

  saveSettings(settings) { localStorage.setItem(this.getKeys().settings, JSON.stringify(settings)); },

  getDailyStats() {
    try {
      const all = JSON.parse(localStorage.getItem(this.getKeys().daily)) || {};
      return all[this.getTodayString()] || { learnedWords: [], reviewedWords: [] };
    } catch { return { learnedWords: [], reviewedWords: [] }; }
  },

  getDailyHistory() {
    try { return JSON.parse(localStorage.getItem(this.getKeys().daily)) || {}; } catch { return {}; }
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

  addDailyReviewedWord(word) {
    try {
      const all = JSON.parse(localStorage.getItem(this.getKeys().daily)) || {};
      const today = this.getTodayString();
      if (!all[today]) all[today] = { learnedWords: [] };
      if (!Array.isArray(all[today].reviewedWords)) all[today].reviewedWords = [];
      if (!all[today].reviewedWords.includes(word)) {
        all[today].reviewedWords.push(word);
        localStorage.setItem(this.getKeys().daily, JSON.stringify(all));
      }
    } catch {}
  },

  // 每日复习上限 = 每日计划 × 倍数（向下取整）
  getReviewLimit() {
    const settings = this.getSettings();
    const multiplier = Number(settings.reviewMultiplier) || 2;
    return Math.max(0, Math.floor((settings.dailyGoal || 20) * multiplier));
  },

  // --- 已掌握 · 快速复习 ---

  // 认识：跳过本次复习，按当前间隔顺延下次复习（间隔倍数不变）
  skipMasteredReview(word) {
    const all = this.loadAll();
    const item = all[word];
    if (!item || item.stage !== 4 || item.isWrongBook) return;
    const days = Math.max(3, item.interval || 3);
    item.nextReview = Date.now() + days * 24 * 60 * 60 * 1000;
    all[word] = item;
    this.saveAll(all);
  },

  // 模糊：加入当日复习队列
  addTodayReviewWord(word) {
    try {
      const all = JSON.parse(localStorage.getItem(this.getKeys().daily)) || {};
      const today = this.getTodayString();
      if (!all[today]) all[today] = { learnedWords: [] };
      if (!all[today].reviewWords) all[today].reviewWords = [];
      if (!all[today].reviewWords.includes(word)) {
        all[today].reviewWords.push(word);
        localStorage.setItem(this.getKeys().daily, JSON.stringify(all));
      }
    } catch {}
  },

  removeTodayReviewWord(word) {
    try {
      const all = JSON.parse(localStorage.getItem(this.getKeys().daily)) || {};
      const today = all[this.getTodayString()];
      if (!today || !Array.isArray(today.reviewWords)) return;
      today.reviewWords = today.reviewWords.filter(w => w !== word);
      localStorage.setItem(this.getKeys().daily, JSON.stringify(all));
    } catch {}
  },

  getTodayReviewWords() {
    try {
      const all = JSON.parse(localStorage.getItem(this.getKeys().daily)) || {};
      const today = all[this.getTodayString()];
      return today && Array.isArray(today.reviewWords) ? today.reviewWords : [];
    } catch { return []; }
  },

  // 不认识：移出已掌握，回到第 1 阶段重新学习
  demoteMasteredWord(word) {
    const all = this.loadAll();
    const item = all[word];
    if (!item) return;
    item.stage = 1;
    item.interval = 1;
    item.nextReview = 0;
    item.consecutiveCorrect = 0;
    item.consecutiveErrors = 0;
    item.isWrongBook = false;
    all[word] = item;
    this.saveAll(all);
    this.removeTodayReviewWord(word);
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