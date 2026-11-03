# 开发环境与验证

此 Linux 云环境用于脚本、代码、插件/技能文件、网页和视频工具的开发。
自动同步工作流仍在 GitHub Actions 执行，不需要在云环境启动定时任务。

## 当前仓库

```bash
cd /workspace/Codex-01
source /workspace/.venvs/codex-01/bin/activate
PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -s tests -v
PYLINTHOME=/tmp/codex-01-pylint pylint $(git ls-files '*.py')
```

离线测试使用模拟 API 和临时 Git 仓库，覆盖分页与分组、空结果、重试、
镜像导入与删除、重复执行、路径验证和批次失败处理；不会向 GitHub 推送。
CI 在 push 和 pull_request 时运行测试及 Pylint，使用 Python 3.10、3.12、3.13。
本地验证使用 Python 3.12；其他版本的结果以 CI 为准。

## 通用工具

| 工作类型 | 已验证的基础能力 | 项目开始后再配置 |
| --- | --- | --- |
| 脚本、代码 | Python、Git、独立虚拟环境、Pylint、unittest | 项目依赖、数据库、具体编译工具链 |
| 网页、前端 | Node.js、npm、Playwright + 系统 Chromium | 前端框架、构建工具及锁文件 |
| 视频 | FFmpeg、FFprobe，H.264 编码与输出检查 | Remotion/HyperFrames、素材、字体、字幕与音频服务 |
| 插件、技能 | 本地文件、脚本及版本管理 | 目标宿主、插件工具连接、账号授权与验证方法 |
| 软件 | Linux 开发工具，可按项目安装依赖 | 平台 SDK、打包、签名与发布目标 |

浏览器测试应使用系统浏览器路径，避免依赖不存在的默认下载：

```javascript
const { chromium } = require('playwright');
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
// 在当前隔离云环境内测试可信的本地开发页面。
await browser.close();
```

Python 与 npm 依赖按项目隔离并保留锁文件；不把所有框架安装到当前仓库。
Linux 环境不能替代 macOS/Xcode 的 iOS/macOS 构建、模拟器与签名验证。
Android SDK、GPU 运行环境、Windows 打包及其他专用能力需要按任务另行准备。
插件技能存在不代表服务已授权；需要账号的功能先检查连接与权限。

## 网络、凭据与发布

保留包管理器域名与 api.github.com 访问权限。其他服务有实际需求时再添加域名。
不要把密钥写入源码、技能、日志或安装脚本，也不要为测试触发实际批量同步。
外部 AI 图片、视频、语音等服务的账号、额度和凭据不是此基础环境的组成部分。

修改代码前检查远程更新与用户本地修改；验证后提交并推送 GitHub，不强制覆盖。
云环境安装脚本与启动说明另外保存为配置草稿，发布由用户决定。
GitHub Actions 的批量同步失败与本地环境是否正常是不同的检查项目；
查看最新运行和各任务日志，不把某一任务成功当成整批成功，也不绕过推送保护。
