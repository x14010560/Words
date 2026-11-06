import { Storage } from '../storage.js';

let syncTimer = null;

export function triggerAutoSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    const key = Storage.getSyncKey();
    const data = Storage.getSyncData();
    try {
      const res = await fetch(`/api/sync?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      // 👇 如果状态不是 200，这里直接抛出错误
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      console.log("☁️ 自动同步成功");
    } catch (e) {
      // 👇 这里千万不要用 res 变量，直接打印 e 即可
      console.warn("☁️ 自动同步失败", e);
    }
  }, 2000); 
}

export async function fetchFromCloud() {
  const key = Storage.getSyncKey();
  try {
    const res = await fetch(`/api/sync?key=${key}`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    if (Object.keys(data).length > 0) {
      Storage.applySyncData(data);
      return true; 
    }
  } catch (e) {
    console.warn("云端拉取失败", e);
  }
  return false;
}