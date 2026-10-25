# Codex-01
chatgpt  Codex

## PPT / HTML Skills

本仓库收录以下两套独立的演示文稿 Skill，保留各自的原始模板、脚本和示例：

| 目录 | 内容 | 来源 |
| --- | --- | --- |
| [baiwuchang-ppt-html](skills/baiwuchang-ppt-html/README.md) | 极简、暖橙、蓝色、彩色四套 HTML 风格，以及可编辑 PPTX 示例 | [Baiwuchang-PPT-HTML](https://github.com/whiteg2030-alt/Baiwuchang-PPT-HTML) |
| [bwc-xixi-ppt-html-skill](skills/bwc-xixi-ppt-html-skill/README.md) | 黑白细线风格、白无常可可体字体、HTML 转可编辑 PPTX 脚本 | 用户提供的 `bwc-xixi-ppt-html-skill-v1.0.0.zip` |

### 使用

直接在浏览器中打开各目录内的 HTML 模板即可查看。生成 PPTX 时，先安装对应 Python 依赖：

```bash
python -m pip install python-pptx Pillow beautifulsoup4
```

四配色项目生成内置 PPTX 示例：

```bash
python skills/baiwuchang-ppt-html/scripts/build_pptx.py
```

细细风格将编辑后的 HTML 转换为 PPTX：

```bash
python skills/bwc-xixi-ppt-html-skill/scripts/html_to_editable_pptx.py path/to/deck.html path/to/deck.pptx
```

细细风格导出脚本在 Windows 上会尝试安装随包字体；具体说明见其 README。将目录作为 Codex Skill 使用时，可复制相应完整目录至自己的 Skills 目录。

来源版本与导入范围见 [导入记录](skills/SOURCES.md)。
