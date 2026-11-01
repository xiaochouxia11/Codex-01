# OpenAI 项目同步

- openai/codex-security → sync/codex-security 分支 upstream/codex-security/
- openai/codex → sync/codex 分支 upstream/codex/

每日北京时间 09:41 检查上游默认分支（GitHub 可能延迟）。有文件变化自动提交；无变化不提交。
手动运行：https://github.com/xiaochouxia11/Codex-01/actions/workflows/sync-openai-repositories.yml
点击 Run workflow，选择 main。

工作流和脚本放在 main；项目文件分别保存在目标分支。保留完整 Git tree，包括授权说明、符号链接、文件模式和子模块指针。子模块内容、Git LFS 实体、历史和 Release 附件不在此同步范围。
同步新增、修改和删除，并核对导入 Git tree。目录内自定义修改会被后续同步替换；目录外文件保留。不会运行上游代码。

无需本机开机或登录。需要 Actions 可用、GITHUB_TOKEN 允许 contents: write，且目标分支允许推送。公开仓库连续 60 天无活动时 GitHub 可能暂停定时任务，需要重新启用。自动更新不会合并项目分支到 main。
