window.Storage = (function () {
  const KEY_PROGRESS = "typing_words_progress_v2";
  const KEY_SETTINGS = "typing_words_settings";
  const KEY_DAILY = "typing_words_daily";

  // 获取今天的日期字符串 YYYY-MM-DD
  function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // --- 单词进度 ---
  function loadAll() {
    try { return JSON.parse(localStorage.getItem(KEY_PROGRESS)) || {}; } catch { return {}; }
  }
  function saveAll(data) { localStorage.setItem(KEY_PROGRESS, JSON.stringify(data)); }
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
  // 修改 getWrongBookWords 中的查询逻辑
  function getWrongBookWords() {
    const all = loadAll();
    return Object.keys(all).filter(k => all[k].isWrongBook).map(k => {
      // 不再依赖 window.WORD_DATA，改为从本地自定义库或全局缓存找
      let wordData = getCustomLib().find(w => w.word === k);
      
      // 如果没在自定义里，尝试去当前加载的官方数据里找
      if (!wordData && window.currentLibDataCache) {
         wordData = window.currentLibDataCache.find(w => w.word === k);
      }
      
      return { 
        word: k, 
        meaning: wordData ? wordData.meaning : "未知", 
        phonetic: wordData ? wordData.phonetic : "" 
      };
    });
  }
  function getMasteredWords() {
    const all = loadAll();
    return Object.keys(all).filter(k => all[k].stage === 4 && !all[k].isWrongBook).map(k => {
      const wordData = window.WORD_DATA.find(w => w.word === k) || { word: k, meaning: "未知", phonetic: "" };
      return { ...wordData, status: all[k] };
    });
  }

  // --- 设置与每日计划 ---
  function getSettings() {
    try {
      return JSON.parse(localStorage.getItem(KEY_SETTINGS)) || { dailyGoal: 20 };
    } catch { return { dailyGoal: 20 }; }
  }
  function saveSettings(settings) {
    localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
  }
  function getDailyStats() {
    try {
      const all = JSON.parse(localStorage.getItem(KEY_DAILY)) || {};
      const today = getTodayString();
      return all[today] || { learnedWords: [] };
    } catch { return { learnedWords: [] }; }
  }
  function addDailyLearnedWord(word) {
    try {
      const all = JSON.parse(localStorage.getItem(KEY_DAILY)) || {};
      const today = getTodayString();
      if (!all[today]) all[today] = { learnedWords: [] };
      if (!all[today].learnedWords.includes(word)) {
        all[today].learnedWords.push(word);
        localStorage.setItem(KEY_DAILY, JSON.stringify(all));
      }
    } catch {}
  }

  return { 
    getStatus, record, getStats, loadAll, 
    getWrongBookWords, getMasteredWords,
    getSettings, saveSettings, getDailyStats, addDailyLearnedWord
  };
})();