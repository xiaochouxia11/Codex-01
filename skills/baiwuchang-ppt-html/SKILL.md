---
name: baiwuchang-ppt-html
description: >-
  生成「百无常」风格的演示文稿(PPT/slides/deck/发布会)。固定设计系统：白底、黑字、单一强调色、
  密集小圆点背景、思源黑体（标题超粗/正文细）、左下角灰色 logo，可选 4 套配色
  (minimal/warm-orange/blue/rainbow)。一次产出两份交付物：① HTML 形式的网页 PPT；
  ② 可在 PowerPoint 里改文字、换图片的可编辑 .pptx。当用户要做 PPT/演示/幻灯片/发布会页面，
  或要"网页版 PPT / 这种极简或渐变风格 / 既要网页又要可编辑 PPT"时使用。
allowed-tools: Read, Write, Edit, Bash
---

# baiwuchang-ppt-html

把「主题/大纲」一键生成**两份**交付物：HTML 网页 PPT + 可编辑 PowerPoint(.pptx)。
风格严格遵循同目录 `设计规范.md`，模板源码在 `html参考/`。

> 本技能目录已自带全部资料：`设计规范.md`（唯一规范）、`html参考/`（4 套可运行模板，logo 已就位）、
> `scripts/`（build_pptx.py + 占位图）、`示例png/`（预览）、`交付示例/`（HTML 成品 + baiwuchang-ppt.pptx 样例）。

## 必读
动手前先读 `设计规范.md`（铁律、6 版式、渐变黄金法则）。**严格遵守**其中"铁律""自检清单"。

## 输入（缺关键项才追问，最多 1 轮）
- `topic` 主题（必需）、`outline` 大纲（可选，缺则自动拟）、`pages` 页数（默认 8）、
- `theme`：`minimal` / `warm-orange` / `blue` / `rainbow`（默认 minimal）。

主题与目录对应：`minimal`→`极简`、`warm-orange`→`暖橙`、`blue`→`蓝色`、`rainbow`→`彩色`。

## 工作流（产出两份交付物）
1. **规划页序**：第 1 页封面、末页结束页、每章前插 `.divider`；其余内容映射到
   `.content-std` / `.cards-3` / `.data-grid`（映射见设计规范第 5 节）。
2. **交付物①：HTML 形式 PPT**
   - 复制 `html参考/<theme 对应目录>/` 为输出目录，按 6 种版式把占位文字替换为真实内容；
   - 改 `data-page` 分母为总页数；保持铁律（颜色/思源黑体/圆点/1672×941/左下角 logo）。
   - 浏览器打开 `template.html` 即可播放。
3. **交付物②：可编辑 .pptx**
   - 用 `python-pptx` 生成原生 PowerPoint（16:9），与 HTML **同内容**：
     白底、黑色超粗标题、细正文、强调色点缀、左下角 logo 图片；
   - **文字用文本框（可改）**，**封面装饰与配图用图片（可右键→更改图片）**；
   - 渐变用 PowerPoint 渐变填充近似（遵守"柔和无边界"，别做硬边实体球）。
   - 参考脚本：`scripts/build_pptx.py`（见 `交付示例/baiwuchang-ppt.pptx` 为成品样例）。
4. **自检 + 交付**：逐页对照设计规范"自检清单"；告诉用户两个产物路径与用法
   （HTML 双击 `template.html`；PPTX 用 PowerPoint 打开改字换图）。

## 硬性约束（违反即失败）
- 纯 HTML/CSS、零图片零截图（logo 除外）；文字可选中。
- 白底 + 黑字 + 一个强调色；思源黑体（标题 900 / 正文 300）；统一圆点；画布 1672×941。
- 4 套配色共用同一版式：只换 `--lime` + 几团**柔和无边界**的渐变；HTML 结构不动。
- 左下角放灰色 logo（`灰色logo2.png`）。
- PPTX 必须是**原生可编辑**（文字框 + 可换图片），不要把整页烤成一张图。

## 参考
- 设计系统与版式：`设计规范.md`
- 模板源码（4 套，logo 已就位）：`html参考/`（极简 / 暖橙 / 蓝色 / 彩色）
- 预览：`示例png/`；成品样例：`交付示例/`（html-ppt 文件夹 + baiwuchang-ppt.pptx）
