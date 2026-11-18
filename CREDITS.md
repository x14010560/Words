# 第三方资源与授权说明

本文件记录项目里用到的第三方素材、它们的许可，以及需要留意的授权风险。修改图标、字体或音频相关代码时请同步更新。

## 图标

- **Lucide** — 界面线性图标（`index.html` 里的 `<symbol>` 图标，16px / 1.5 描边）。部分路径按界面尺寸做了微调，属于演绎使用。
  - 许可：ISC License
  - 版权：Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
  - ISC 要求在任何副本中保留版权声明与许可声明，故在此收录全文：

```
ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of
Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT,
OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE,
DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS
ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS
SOFTWARE.
```

- **应用图标**（`icon.svg` / `icon-small.svg` 及由此导出的 PNG、ICO）：为本项目绘制的原创矢量图形（一张单词卡），不含第三方图片素材。构图参考了用户提供的参考图，但未复制其画面、角色或文字标识。

## 字体

- 项目**不打包任何字体文件**，全部使用系统字体栈（`styles.css` 顶部的 `--font-sans` / `--font-serif` / `--font-mono`）。
- 字体栈里出现的 `IBM Plex Mono`、`JetBrains Mono` 只在本机已安装时才会生效，属于按名称引用，不构成再分发；两者均为 SIL Open Font License 1.1。
- 其余（`-apple-system`、`Segoe UI`、`PingFang SC`、`Microsoft YaHei`、`Songti SC`、`SimSun`、`Consolas` 等）随操作系统提供，随系统许可使用，不可再分发字体文件。
- 若以后要做跨平台一致的排版，应自托管 OFL 字体（如 Source Han Serif / Noto Sans SC），并在本文件登记。

## 语音合成（需注意）

- `js/modules/audio.js` 与 `functions/tts.js` 调用 `https://edge-tts.x14010560.workers.dev/v1/audio/speech`，实际是**微软 Edge 朗读（Edge TTS）的非官方转发**，语音 `en-US-AvaMultilingualNeural`。
- 风险：Edge 朗读音色并未授权给第三方应用公开调用，`edge-tts` 一类实现属于逆向接口，用于线上服务可能违反微软服务条款；该 worker 也是他人自建服务，可用性与数据处理都不受控。
- 建议（按优先级）：① 自建 Azure AI Speech（有正式商用授权，按量计费）；② 直接使用浏览器内置 `speechSynthesis`（现有代码里已有 `fallbackSpeak` 兜底，零成本、零授权风险，只是音色随系统）；③ 自录音频文件随词库分发（需自行确认发音数据来源）。
- 现状：仅作发音播放，不缓存到服务端、不再分发音频文件，风险面较小，但上线前建议替换。

## 词库数据

- `data/official/tdxl.json`、`ts1000.json`、`ts2000.json`、`computer.json`、`commands.json` 共约 3600 条词条，来源未在仓库中记录。
- 「同等学力」「同硕核心词汇」等命名与词表编排通常来自教辅出版物，词条的选取与释义可能构成汇编作品。若要公开发布或商用，请确认词表来源与授权，或替换为公共领域 / 自建词表。
- `computer.json` / `commands.json` 为通用技术词与命令名，事实性内容一般不构成作品，风险较低。
- `data/official/ecdict.json`（6891 条）由 **ECDICT** 的 `ecdict.csv` 筛选转换而来：
  - 来源：<https://github.com/skywind3000/ECDICT>
  - 筛选：保留带 `cet4` / `cet6` 标签或 `oxford=1` 的纯字母单词；仅取首条中文释义，音标统一补 `/.../`，按字母排序；无词频、无音标的词条仍保留（音标留空）。
  - 许可：MIT License；按许可要求收录全文：

```
MIT License

Copyright (c) 2025 Linwei

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 设计与方法

- UI 方向与九轮改造流程参考 **unslop**（作者 Damir Sokolovsky，[@heydamir](https://x.com/heydamir)），许可 CC BY 4.0。本项目只沿用了方法论，未复制其代码；按许可要求在交付说明中署名。
