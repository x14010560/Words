import { Storage } from '../storage.js?v=11';
import { speak } from './audio.js?v=11';
import { triggerAutoSync } from './sync.js?v=11';

let els = {};
const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;

export function initManager(elements) {
  els = elements;
  els.csvInput.addEventListener("change", handleCSV);
  els.addManualBtn.addEventListener("click", handleManualAdd);
}

export function renderManagerList() {
  const words = Storage.getCustomLib();
  els.managerList.innerHTML = "";
  if (words.length === 0) {
    els.managerList.innerHTML = `
      <div class="empty">
        <p class="empty-title">还没有自定义词条</p>
        <p class="empty-hint">导入 CSV 或手动添加后出现在这里</p>
      </div>`;
    return;
  }
  words.forEach((w, idx) => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <div class="list-info">
        <span class="list-word">${w.word}${w.phonetic ? `<small class="list-phonetic">${w.phonetic}</small>` : ""}</span>
        <span class="list-meaning">${w.meaning || '无释义'}</span>
      </div>
      <div class="list-actions">
        <button class="icon-btn btn-delete" data-idx="${idx}" type="button" aria-label="删除 ${w.word}">${icon("trash")}</button>
      </div>
    `;
    div.querySelector(".btn-delete").addEventListener("click", (e) => {
      const i = e.currentTarget.getAttribute("data-idx");
      let current = Storage.getCustomLib();
      current.splice(i, 1);
      Storage.saveCustomLib(current);
      triggerAutoSync();
      renderManagerList();
    });

    els.managerList.appendChild(div);
  });
}

function handleCSV(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const text = evt.target.result;
    const lines = text.split('\n');
    let newWords = Storage.getCustomLib();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
      if (cols.length >= 2) {
        const word = cols[0].replace(/"/g, '').trim();
        let phonetic = '', meaning = '';
        if (cols.length >= 3) {
          phonetic = cols[1].replace(/"/g, '').trim();
          meaning = cols.slice(2).join(',').replace(/"/g, '').trim();
        } else {
          meaning = cols[1].replace(/"/g, '').trim();
        }
        if (word) {
          const existingIdx = newWords.findIndex(w => w.word === word);
          if (existingIdx > -1) newWords[existingIdx] = { word, phonetic, meaning };
          else newWords.push({ word, phonetic, meaning });
        }
      }
    }
    Storage.saveCustomLib(newWords);
    triggerAutoSync();
    alert(`词库现有 ${newWords.length} 个词条`);
    renderManagerList();
    e.target.value = '';
  };
  reader.readAsText(file);
}

function handleManualAdd() {
  const word = prompt("输入单词或指令，如 git push");
  if (!word) return;
  const meaning = prompt("输入释义（可选）") || "无释义";
  let current = Storage.getCustomLib();
  const existingIdx = current.findIndex(w => w.word === word.trim());
  if (existingIdx > -1) current[existingIdx] = { word: word.trim(), phonetic: "", meaning: meaning.trim() };
  else current.push({ word: word.trim(), phonetic: "", meaning: meaning.trim() });
  Storage.saveCustomLib(current);
  triggerAutoSync();
  renderManagerList();
}
