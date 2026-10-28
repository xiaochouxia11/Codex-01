# Apple Design Skill 自动同步

工作流：[Sync Apple Design Skill](https://github.com/xiaochouxia11/Codex-01/actions/workflows/sync-apple-design-skill.yml)。

- 自动：每天 UTC 01:23（北京时间 09:23）检查；GitHub 可能延迟执行。
- 手动：打开上述页面，点击 **Run workflow**，选择 **main** 后确认运行。
- 上游：https://github.com/dickwu/apple-design-skill，跟随其默认分支 HEAD。
- 目标：`add/apple-design-skill` 分支的 `skills/apple-design-skill/`。
- 更新时完整同步新增、修改、删除的文件及文件模式，核对 Git tree SHA，再提交并推送；没有文件变化时不提交。
- 来源记录：目标分支的 `docs/apple-design-skill-source.md`。
- 不自动合并到 main；main 保存工作流和同步脚本。

## 运行条件

仓库开启 GitHub Actions，并允许此工作流使用带 contents: write 权限的 GITHUB_TOKEN。无需额外密钥，也不依赖本机运行。目标分支的保护规则必须允许机器人推送，否则任务会失败并显示日志。

定时及手动触发要求此工作流存在于默认分支 main。公开仓库连续 60 天没有活动时，GitHub 可能停用定时任务，需要到 Actions 页面重新启用。运行额度用尽、GitHub 故障或上游不可访问时也会失败。

## 范围

只把上游内容当作文件导入，不运行上游脚本。同步目录内的本地修改会在下次上游更新时被替换；自定义内容应放在目录外。目标分支不存在、工作目录不干净或并发推送冲突时停止，避免强制覆盖。查看 Actions 运行日志确认最近一次执行结果。
