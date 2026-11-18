import { Storage } from '../storage.js?v=9';

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
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    
    if (Object.keys(data).length > 0) {
      // 优化：我们简单对比一下进度。如果云端有数据，并且本地也有进度，弹窗问问用户
      const localProgress = Storage.getAllLocalData();
      const hasLocalData = Object.keys(localProgress).some(k => k.includes('progress_') && localProgress[k] !== '{}');

      if (hasLocalData) {
        // 如果本地已经有学习记录，先问用户要不要覆盖
        if (confirm("检测到云端有更新的进度。\n\n点击“确定”将拉取云端进度并覆盖本地；\n点击“取消”保留当前本地进度（稍后会由本地覆盖云端）。")) {
          Storage.applySyncData(data);
          return true;
        } else {
          // 用户选择不覆盖，那我们就触发一次同步，把本地的新数据传上去
          triggerAutoSync();
          return false;
        }
      } else {
        // 本地是空的（比如新手机第一次打开），直接静默拉取云端
        Storage.applySyncData(data);
        return true;
      }
    }
  } catch (e) {
    console.warn("云端拉取失败", e);
  }
  return false;
}