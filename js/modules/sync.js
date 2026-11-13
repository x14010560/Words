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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      console.log("自动同步成功");
    } catch (e) {
      console.warn("自动同步失败", e);
    }
  }, 2000);
}

export async function fetchFromCloud() {
  const key = Storage.getSyncKey();
  try {
    const res = await fetch(`/api/sync?key=${key}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
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