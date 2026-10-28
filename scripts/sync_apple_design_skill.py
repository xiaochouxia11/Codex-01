#!/usr/bin/env python3
"""Mirror a Git tree under skills/apple-design-skill without executing upstream code."""
import argparse
from pathlib import Path
import subprocess

PREFIX = "skills/apple-design-skill"
def git(*args):
    return subprocess.check_output(["git", *args], text=True).strip()

def sync(url):
    git("fetch", "--no-tags", "--depth=1", url, "HEAD")
    sha = git("rev-parse", "FETCH_HEAD")
    upstream_tree = git("rev-parse", "FETCH_HEAD^{tree}")
    old = subprocess.run(["git", "rev-parse", "HEAD:" + PREFIX],
                         capture_output=True, text=True)
    if old.returncode == 0 and old.stdout.strip() == upstream_tree:
        print("Upstream files are unchanged.")
        return False
    git("rm", "-r", "--ignore-unmatch", "--", PREFIX)
    git("read-tree", "--prefix=" + PREFIX + "/", "-u", sha)
    # Confirm that every path, file mode and blob matches the upstream tree.
    staged_tree = git("write-tree")
    assert git("rev-parse", staged_tree + ":" + PREFIX) == upstream_tree
    doc = Path("docs/apple-design-skill-source.md")
    doc.parent.mkdir(parents=True, exist_ok=True)
    doc.write_text(
        "# Apple Design Skill 同步记录\n\n"
        "- 上游仓库：https://github.com/dickwu/apple-design-skill\n"
        f"- 上游提交：`{sha}`\n"
        f"- 上游树：`{upstream_tree}`\n"
        f"- 保存目录：`{PREFIX}/`\n"
        "- 同步范围：全部受版本控制文件，保留路径、内容和文件模式。\n"
        "- 校验：导入目录的 Git tree SHA 与上游一致。\n\n"
        "每天自动检查，也支持 Actions 页面手动触发。无文件变化时不提交。\n"
        "上游文件作为第三方内容保存，不执行其安装命令或更新脚本。\n"
        "署名和授权说明见上游 README；HIG 引用内容归 Apple Inc. 所有。\n",
        encoding="utf-8")
    git("add", "--", str(doc))
    print("Synchronized upstream commit " + sha)
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--upstream", default="https://github.com/dickwu/apple-design-skill.git")
    args = parser.parse_args()
    if git("status", "--porcelain"):
        raise SystemExit("Refusing to sync a dirty checkout.")
    sync(args.upstream)
