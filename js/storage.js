window.Storage = (function () {
  const KEY_PREFIX = "typing_words_v3_";
  const CURRENT_LIB_KEY = "typing_words_current_lib";

  // 获取当前学习的词库 ID
  function getCurrentLib() {
    return localStorage.getItem(CURRENT_LIB_KEY) || "computer";
  }
  
  // 切换词库
  function setCurrentLib(id) {
    localStorage.setItem(CURRENT_LIB_KEY, id);
  }

  // 生成基于当前词库的动态 Key
  function getKeys() {
    const lib = getCurrentLib();
    return {
      progress: `${KEY_PREFIX}progress_${lib}`,
      settings: `${KEY_PREFIX}settings_${lib}`,
      daily: `${KEY_PREFIX}daily_${lib}`
    };
  }

  // 获取今天的日期字符串
  function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // --- 单词进度 ---
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

  // 获取当前词库的所有数据（用于查错题、查已掌握）
  async function getCurrentData() {
    const lib = getCurrentLib();
    if (lib === 'custom') return getCustomLib();
    try {
      const res = await fetch(`./data/official/${lib}.json`);
      if (!res.ok) return [];
      return await res.json();
    } catch { return []; }
  }

  // 由于查错题需要同步返回，这里用一个简单的缓存机制
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

  // --- 设置与每日计划 ---
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

  // --- 自定义词库管理 ---
  function getCustomLib() {
    try { return JSON.parse(localStorage.getItem("typing_words_custom_lib")) || []; } catch { return []; }
  }
  function saveCustomLib(words) { localStorage.setItem("typing_words_custom_lib", JSON.stringify(words)); }
  function addCustomWord(wordData) {
    const words = getCustomLib();
    const index = words.findIndex(w => w.word === wordData.word);
    if (index > -1) words[index] = wordData;
    else words.push(wordData);
    saveCustomLib(words);
  }
  function deleteCustomWord(wordStr) {
    let words = getCustomLib();
    words = words.filter(w => w.word !== wordStr);
    saveCustomLib(words);
  }
  function importCustomWords(newWords) {
    let words = getCustomLib();
    newWords.forEach(nw => {
      const index = words.findIndex(w => w.word === nw.word);
      if (index > -1) words[index] = nw;
      else words.push(nw);
    });
    saveCustomLib(words);
  }

  return { 
    getCurrentLib, setCurrentLib,
    getStatus, record, getStats, loadAll, 
    getWrongBookWords, getMasteredWords,
    getSettings, saveSettings, getDailyStats, addDailyLearnedWord,
    getCustomLib, saveCustomLib, addCustomWord, deleteCustomWord, importCustomWords
  };
})();