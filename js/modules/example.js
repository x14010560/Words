// 示例文本渲染：反引号包裹的内容按代码片段显示，其余按普通文本显示。
// 所有文本都转义后再进 innerHTML，词条可能来自用户导入的 CSV。
const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ESCAPES[c]);
}

export function hasExample(text) {
  return !!text && String(text) !== "—";
}

export function exampleHtml(text) {
  if (!hasExample(text)) return "";
  const m = String(text).match(/^`(.+)`$/s);
  const body = m ? m[1] : String(text);
  return m
    ? `<code class="example-code">${escapeHtml(body)}</code>`
    : `<span>${escapeHtml(body)}</span>`;
}

export function renderExample(container, text) {
  container.innerHTML = hasExample(text) ? exampleHtml(text) : "";
}
