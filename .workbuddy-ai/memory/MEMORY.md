# 项目长期记忆

## 项目
- `D:/Code/Works`：TypeWords，打字背单词（中文释义 → 逐字母拼英文），面向计算机英语与命令行指令词库；静态站点 + Cloudflare Worker/Functions 同步，原生 JS 模块，无构建工具。
- 移动端依赖 `#hiddenInput`（`opacity:.01`、16px 字号）唤起系统键盘，勿改其兼容写法；`.virtual-keyboard` 目前是死代码。

## 设计约定（用户确认，2026-11-13）
- UI 方向 **纸质单词卡**：暖纸中性面（`#F7F4EE` / `#FDFBF7` / `#EFE9DF` / `#1F1B16` / `#5E554A` / `#7B7266`），单一琥珀强调（深至 `#92400E` 保证 4.5:1），中文大释义用衬线，字母格/音标/数字用等宽。
- 唯一亮点是字母格行；签名细节是当前待输入格下方一条手绘感短墨线（琥珀），全站不复用。
- 界面禁用 emoji 图标，用 Lucide 16px/1.5；中性面保持安静，语义色只承载对错含义。
- 分支 `unslop/ui-audit` 用于此次 UI 改版；方案确认前不动代码。

## 实现注意（2026-11-17）
- 语义色 token 是 `--negative` / `--positive`，灰色是 `--ink-2` / `--ink-3`；项目里不存在 `--wrong` / `--muted`，写错会让声明静默失效（红字不变红就是这个原因）。
- 等宽栈（Consolas 等）只有 400/700，`font-weight:500` 会被合成为常规——需要真加粗就用 700。
- 列表与错题本一律用 class（`.word-card` / `.cell` / `.cell--wrong` 等），不要写 inline style；拼写字符串来自用户输入，插入 innerHTML 前必须转义。
- 练习页模式标签走 `setMode()` 写 `data-mode`，不要覆盖 `className`，否则会丢掉 `.stage-kicker`。

## 布局与图标（2026-11-17 第二轮）
- 列表页用 `.list-grid`（auto-fill minmax(340px,1fr)）+ `.word-card`，卡片等高（grid stretch）；错题本的错误拼写用逐字母格 `.cell`，拼错红底红字、漏打虚线空格，`width` 必须固定否则「N 次」不对齐。
- 统计页结构：`.stat-hero`（今日大数字 + 进度条）→ `.stat-row` 双栏（`.stat-panel` 近 7 天柱状图 + 词库概览行表）→ 脚注。柱状图容器要给固定 `height`，`flex:1` 在 auto 高度的 column 里会算成 0。
- 图标是「线稿单词卡」：`icon.svg`（64 视框，纸色填充 + 墨色描边 + 琥珀短线）+ `icon-small.svg`（≤48px 直角加粗版）。favicon 必须透明底（Chrome 加 `--default-background-color=00000000`），apple-touch/android 才用纸色底。`favicon.ico` 是手写的 PNG-in-ICO。改图标要同时更新 `site.webmanifest`、`index.html` 的 link 与侧栏 `.brand-mark`。
- 第三方授权统一登记在 `CREDITS.md`（Lucide ISC 全文、字体、TTS、词库来源）。
- 改了 `styles.css` / `js/app.js` 要顺手把 `?v=N` 递增，否则用户会看到「HTML 是新的、样式是旧的」。
