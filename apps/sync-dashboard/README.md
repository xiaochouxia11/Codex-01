# Codex Sync：独立全栈开发示例

React + Vite 前端、FastAPI API、SQLite 持久化组成的只读 GitHub Actions 状态管理页面。
现有同步脚本继续独立运行；本应用不会触发工作流、推送或删除远程内容。

## 安装与启动

要求 Python 3.10+、Node.js 22.12+（云环境使用 Python 3.12、Node 24）。
从仓库根目录执行：

```bash
bash apps/sync-dashboard/install.sh
bash apps/sync-dashboard/start.sh dev
```

开发模式启动后端 127.0.0.1:8000、Vite 127.0.0.1:5173；Vite 将 /api 代理到后端。
脚本会拒绝已占用的开发端口，并在退出时停止自己启动的进程，不终止其他进程。
进程不会随云环境快照恢复，进入新任务后需要重新运行 start.sh。

运行已构建的完整应用（只需要一个后端进程）：

```bash
bash apps/sync-dashboard/start.sh serve
```

此时 FastAPI 在 8000 端口同时提供 frontend/dist 静态文件和 API。
安装脚本自动执行前端构建。两个模式不要同时占用 8000。
本地服务用于开发，不作为经过认证的公网部署；若需公开部署，应单独配置认证、TLS、
持久卷、速率限制、进程托管和精确的允许来源，不直接绑定公网地址。

## 页面功能

- 默认显示明确标注的离线示例数据；示例没有虚构的真实运行链接。
- View cached live / Demo data 切换两套独立数据，不进行远程写入。
- Refresh GitHub 读取固定仓库 xiaochouxia11/Codex-01 的最近 30 条运行，成功后写入 SQLite。
- 工作流名称搜索、状态筛选、真实记录的 GitHub 详情链接。
- 刷新失败时显示错误，已有缓存和页面记录保持可用。
- 页面时间统一显示为 Asia/Shanghai，并明确标注时区；移动端表格可横向滚动。
- 不后台轮询 GitHub；公开 API 额度不足时稍后手动重试。

## API 与数据

| 接口 | 用途 |
| --- | --- |
| GET /api/health | 检查后端和 SQLite 是否可读取 |
| GET /api/runs?mode=demo | 离线示例 |
| GET /api/runs?mode=live | SQLite 中的真实缓存，未刷新前为空 |
| POST /api/refresh | 只读访问 GitHub，替换本地真实缓存 |
| GET /api/docs | OpenAPI 交互文档 |

后端不接受仓库名、URL、SQL 或远程动作参数；只访问固定 GitHub API。
浏览器的跨站刷新请求被拒绝。页面无认证，因此只绑定 loopback。

SQLite 默认文件：/workspace/.data/codex-01-dashboard/status.sqlite3，位于仓库外。
普通本机或 CI 没有可写的 /workspace 时，自动回退到用户目录 ~/.local/share/codex-01-dashboard/status.sqlite3。
启动时自动建表并只初始化缺失的示例数据；不会覆盖已有真实缓存。
可通过非敏感变量 SYNC_DASHBOARD_DB 指向其他持久文件路径，不使用 :memory:。
删除该文件会丢失本地缓存；安装和启动脚本都不会执行删除。

Python 虚拟环境默认 /workspace/.venvs/codex-01-dashboard，可通过 DASHBOARD_VENV 覆盖。
Python 依赖及间接依赖由 backend/requirements.txt 固定并校验哈希，npm 使用 package-lock.json 和 npm ci。
requirements.in 包含运行、测试和静态检查工具，requirements.txt 按 Python 3.10–3.13 的兼容标记解析。
需要升级依赖时再重新解析、测试和提交锁文件，不在每次安装时更新。

## 网络与凭据

安装使用现有包管理器域名，在线刷新仅需 api.github.com，不增加全公网权限。
公开 GitHub API 支持匿名读取；存在 GH_TOKEN 时由后端使用已有绑定，绝不返回给浏览器。
不要将 Token 写入 .env、前端变量、源码或日志。无须给本应用提供写入权限。
本应用无需配置 GitHub Actions 专用的 SYNC_REPOS、GITHUB_OUTPUT 等变量。

## 验证

```bash
# 仓库根目录：现有脚本回归测试
PYTHONDONTWRITEBYTECODE=1 /workspace/.venvs/codex-01-dashboard/bin/python -m unittest discover -s tests -v
# 仓库根目录：后端测试与全仓静态检查
PYTHONPATH=apps/sync-dashboard PYTHONDONTWRITEBYTECODE=1 /workspace/.venvs/codex-01-dashboard/bin/python -m unittest discover -s apps/sync-dashboard/backend/tests -v
PYTHONPATH=apps/sync-dashboard PYLINTHOME=/tmp/codex-01-pylint /workspace/.venvs/codex-01-dashboard/bin/pylint $(git ls-files '*.py')
npm --prefix apps/sync-dashboard/frontend test
npm --prefix apps/sync-dashboard/frontend run build
```

后端离线测试覆盖数据分离、API 校验、重启后持久化、失败保留缓存和跨站请求拒绝。
前端测试覆盖筛选、活动状态和统计。CI 对 Python 3.10/3.12/3.13 运行测试及静态检查，
另用 Node 24 运行 npm ci、前端测试和构建。
浏览器验证使用系统 Chromium；运行截图等验证产物保存在仓库外，不作为项目静态资源。
