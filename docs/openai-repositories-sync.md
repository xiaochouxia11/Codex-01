# OpenAI 组织公开仓库同步

每天北京时间 09:41（GitHub 可能延迟）重新发现 https://github.com/openai 的全部公开仓库，包括归档仓库与公开 fork，自动纳入新公开仓库。

每个仓库独立保存：`openai/<name>` → `sync/<name>` 分支 → `upstream/<name>/`。沿用已有同名同步分支。新分支仅保存上游文件和来源记录，源仓库的 GitHub 工作流位于子目录，不执行。

手动同步：[Sync OpenAI repositories](https://github.com/xiaochouxia11/Codex-01/actions/workflows/sync-openai-repositories.yml)，点击 Run workflow，选择 main。

同步默认分支的 Git 文件和模式、符号链接、原始授权说明及子模块指针，并验证导入 tree SHA。无文件变化不提交。不包含完整历史、Issues、讨论、Release 附件、子模块内容或 Git LFS 实体。空仓库没有可导入文件，运行摘要会标记。上游删除或转为私有后保留已有快照，不自动删除目标分支。

同步目录内自定义修改会在上游文件变化时被替换；目录外内容保留。自动提交不强制推送，冲突会报错。某仓库失败不阻止同组其他仓库，失败项目在日志和运行摘要中列出，下次执行重试。

工作流和同步脚本位于 main；8 组任务，最多 4 组并行，每次只临时拉取一个项目以控制磁盘用量。组织全量首次导入可能耗时较长；受 GitHub 单文件、推送大小、Actions 额度与平台限制影响，失败需查看运行摘要，不能保证所有仓库永久可镜像。

正常运行无需本机开机或登录。需要 GitHub Actions 可用、contents: write 权限和目标分支允许推送。公开仓库连续 60 天无活动时 GitHub 可能暂停定时任务，需要重新启用。
