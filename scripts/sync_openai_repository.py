"""Synchronize an upstream Git tree into a dedicated repository branch."""
import argparse
from pathlib import Path
import subprocess

def git(*args):
    return subprocess.check_output(["git", *args], text=True).strip()

def sync(name):
    prefix = "upstream/" + name
    if git("status", "--porcelain"):
        raise SystemExit("Checkout must be clean.")
    git("fetch", "--no-tags", "--depth=1", "https://github.com/openai/" + name + ".git", "HEAD")
    sha = git("rev-parse", "FETCH_HEAD")
    tree = git("rev-parse", "FETCH_HEAD^{tree}")
    current = subprocess.run(["git", "rev-parse", "HEAD:" + prefix], text=True, capture_output=True)
    if current.returncode == 0 and current.stdout.strip() == tree:
        print("No upstream file changes.")
        return
    git("rm", "-r", "--ignore-unmatch", "--", prefix)
    git("read-tree", "--prefix=" + prefix + "/", "-u", sha)
    staged = git("write-tree")
    if git("rev-parse", staged + ":" + prefix) != tree:
        raise SystemExit("Imported tree does not match upstream.")
    doc = Path("docs/" + name + "-source.md")
    doc.parent.mkdir(parents=True, exist_ok=True)
    doc.write_text(
        "# " + name + " 同步记录\n\n"
        + "- 上游：https://github.com/openai/" + name + "\n"
        + "- 上游提交：" + sha + "\n"
        + "- Git tree：" + tree + "\n"
        + "- 保存目录：" + prefix + "/\n\n"
        + "完整同步默认分支的受版本控制文件，包含文件删除、文件模式及原始授权说明；不包含历史、Release 附件或子模块内容。"
        + "导入目录 Git tree 与上游一致。只保存第三方文件，不执行上游代码。\n"
        + "每天自动检查，亦可从 Actions 手动运行。无文件变化时不提交。"
        + "本目录内的自定义修改会被下次同步替换；自定义内容请放在目录外。\n",
        encoding="utf-8")
    git("add", "--", str(doc))
    print("Synced " + name + " at " + sha)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("name", choices=["codex", "codex-security"])
    sync(parser.parse_args().name)
