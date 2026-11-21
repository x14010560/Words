import { Storage } from '../storage.js?v=13';

let syncTimer = null;
const LAST_MANUAL_UPLOAD_KEY = 'typing_words_last_manual_upload';
const MANUAL_COOLDOWN_MS = 5 * 60 * 1000;

export function getUploadCooldown() {
  const last = Number(localStorage.getItem(LAST_MANUAL_UPLOAD_KEY) || 0);
  const left = MANUAL_COOLDOWN_MS - (Date.now() - last);
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

// 手动上传：本地先挡一次，服务端还有同样的 5 分钟限制
export async function uploadToCloud() {
  const retryAfter = getUploadCooldown();
  if (retryAfter) return { ok: false, reason: 'cooldown', retryAfter };

  const key = Storage.getSyncKey();
  try {
    const res = await fetch(`/api/sync?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...Storage.getSyncData(), manual: true })
    });
    if (res.status === 429) {
      const info = await res.json().catch(() => ({}));
      const seconds = Math.max(1, Number(info.retryAfter) || 300);
      // 与服务端时间对齐，避免刷新页面绕过本地倒计时
      localStorage.setItem(LAST_MANUAL_UPLOAD_KEY, String(Date.now() - (MANUAL_COOLDOWN_MS - seconds * 1000)));
      return { ok: false, reason: 'server', retryAfter: seconds };
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    localStorage.setItem(LAST_MANUAL_UPLOAD_KEY, String(Date.now()));
    return { ok: true };
  } catch (e) {
    console.warn('手动上传失败', e);
    return { ok: false, reason: 'error' };
  }
}

function formatSyncTime(data) {
  const raw = data.syncedAt || data.updatedAt;
  if (!raw) return '云端未记录同步时间';
  const d = new Date(typeof raw === 'number' ? raw : raw.replace(' ', 'T'));
  if (isNaN(d.getTime())) return '云端同步时间未知';
  return `云端同步时间：${d.toLocaleString('zh-CN', { hour12: false })}`;
}

// 冲突时由用户决定：下载（云端覆盖本地）/ 上传（本地覆盖云端）
function askSyncConflict(timeText) {
  return new Promise(resolve => {
    const modal = document.getElementById('syncConflictModal');
    const timeEl = document.getElementById('syncConflictTime');
    const downloadBtn = document.getElementById('downloadCloudBtn');
    const uploadBtn = document.getElementById('uploadCloudBtn');
    if (!modal || !downloadBtn || !uploadBtn) { resolve(false); return; }

    if (timeEl) timeEl.textContent = timeText;
    modal.classList.add('show');

    const finish = choice => {
      modal.classList.remove('show');
      downloadBtn.removeEventListener('click', onDownload);
      uploadBtn.removeEventListener('click', onUpload);
      resolve(choice);
    };
    const onDownload = () => finish(true);
    const onUpload = () => finish(false);
    downloadBtn.addEventListener('click', onDownload);
    uploadBtn.addEventListener('click', onUpload);
  });
}

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
        const download = await askSyncConflict(formatSyncTime(data));
        if (download) {
          Storage.applySyncData(data);
          return true;
        }
        // 上传到云端：保留本地进度并触发一次同步覆盖云端
        triggerAutoSync();
        return false;
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