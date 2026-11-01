# OpenAI 组织首次同步结果

- 发现公开仓库：278 个（包括归档仓库和公开 fork）。
- 同步成功：276 个，其中首次新增或更新 274 个，文件未变化 2 个。
- 失败：2 个。
- 运行记录：https://github.com/xiaochouxia11/Codex-01/actions/runs/41325761878

## 被 GitHub 推送保护拦截的仓库

- openai/openai-apps-sdk-examples：上游 src/pizzaz/index.jsx 被识别含 Mapbox Secret Access Token。
- openai/mitmproxy：上游 .appveyor.yml 被识别含 Slack Incoming Webhook URL。

未绕过推送保护、未更改上游文件或关闭安全设置，因此这两个仓库尚未成功导入。本工作流会继续同步其他仓库，并在后续运行重试；如上游未移除触发项且仓库保护仍然拦截，它们会继续报错。

每日北京时间 09:41 自动重新发现并同步。手动入口、同步范围及平台限制见 [同步说明](openai-repositories-sync.md)。
