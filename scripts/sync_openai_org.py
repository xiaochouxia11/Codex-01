"""Discover and mirror public OpenAI Git trees, one destination branch per repository."""
import argparse
import base64
import json
import os
import re
import subprocess
import tempfile
import time
import urllib.request
import urllib.error

def request(url):
    """Read a GitHub JSON response, retrying transient request failures."""
    headers = {"User-Agent": "Codex-01-org-sync", "Accept": "application/vnd.github+json"}
    token = os.environ.get("GH_TOKEN")
    if token:
        headers["Authorization"] = "Bearer " + token
    for attempt in range(3):
        try:
            query = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(query, timeout=60) as response:
                return json.load(response)
        except (OSError, urllib.error.URLError, json.JSONDecodeError):
            if attempt == 2:
                raise
            time.sleep(5 * (attempt + 1))
    raise RuntimeError("Request retries exhausted.")

def discover():
    """Write a matrix of all public OpenAI repositories to the Actions output."""
    repos = {}
    page = 1
    while True:
        batch = request(
            "https://api.github.com/orgs/openai/repos"
            f"?type=public&sort=full_name&per_page=100&page={page}")
        for repo in batch:
            if repo["owner"]["login"].lower() == "openai" and not repo["private"]:
                repos[repo["id"]] = {"name": repo["name"], "default_branch": repo["default_branch"]}
        if len(batch) < 100:
            break
        page += 1
    names = sorted(repos.values(), key=lambda r: r["name"].lower())
    if not names:
        raise RuntimeError("Discovery returned no public repositories.")
    groups = [names[i::8] for i in range(min(8, len(names)))]
    matrix = {"include": [{"group": i + 1, "repos": group} for i, group in enumerate(groups)]}
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
        output.write("matrix=" + json.dumps(matrix, separators=(",", ":")) + "\n")
    print(f"Discovered {len(names)} public repositories, "
          "including archived repositories and forks.")

def git(directory, *args, authenticated=False, stdin=None):
    """Run Git with noninteractive Actions identity and optional authentication."""
    env = os.environ.copy()
    env.update({"GIT_TERMINAL_PROMPT": "0", "GIT_LFS_SKIP_SMUDGE": "1",
                "GIT_AUTHOR_NAME": "github-actions[bot]",
                "GIT_AUTHOR_EMAIL": "41898282+github-actions[bot]@users.noreply.github.com",
                "GIT_COMMITTER_NAME": "github-actions[bot]",
                "GIT_COMMITTER_EMAIL":
                    "41898282+github-actions[bot]@users.noreply.github.com"})
    if authenticated:
        value = base64.b64encode(("x-access-token:" + env["GH_TOKEN"]).encode()).decode()
        env.update({"GIT_CONFIG_COUNT": "1",
                    "GIT_CONFIG_KEY_0": "http.https://github.com/.extraheader",
                    "GIT_CONFIG_VALUE_0": "AUTHORIZATION: basic " + value})
    result = subprocess.run(["git", "-C", str(directory), *args], input=stdin,
                            text=True, capture_output=True, env=env, timeout=1200, check=False)
    if result.returncode:
        raise RuntimeError(result.stderr[-3000:] or "Git operation failed.")
    return result.stdout.strip()

def mirror(repo, directory):
    """Import an upstream tree and push a verified commit when files change."""
    name = repo["name"]
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", name) or name in (".", ".."):
        raise ValueError("Invalid repository name.")
    destination = os.environ["GITHUB_REPOSITORY"]
    if destination != "xiaochouxia11/Codex-01":
        raise ValueError("Unexpected destination repository.")
    source = f"https://github.com/openai/{name}.git"
    remote = f"https://github.com/{destination}.git"
    branch = "refs/heads/sync/" + name
    prefix = "upstream/" + name
    git(directory, "init", "-q")
    head = git(directory, "ls-remote", source, "HEAD")
    if not head:
        return "empty repository; no Git files to import"
    git(directory, "fetch", "--no-tags", "--depth=1", source, "HEAD")
    sha = git(directory, "rev-parse", "FETCH_HEAD")
    source_tree = git(directory, "rev-parse", sha + "^{tree}")
    existing = git(directory, "ls-remote", remote, branch, authenticated=True)
    parent = None
    if existing:
        git(directory, "fetch", "--no-tags", "--depth=1", remote, branch, authenticated=True)
        parent = git(directory, "rev-parse", "FETCH_HEAD")
        git(directory, "update-ref", "HEAD", parent)
        git(directory, "read-tree", parent)
        # This lookup is allowed to fail when importing into a pre-existing branch.
        row = git(directory, "ls-tree", parent, "--", prefix)
        if row and row.split()[2] == source_tree:
            return "unchanged"
        git(directory, "rm", "-r", "--cached", "--ignore-unmatch", "--", prefix)
    else:
        git(directory, "read-tree", "--empty")
    # Work only in Git's index: upstream hooks, workflows and scripts are never run.
    git(directory, "read-tree", "--prefix=" + prefix + "/", sha)
    return commit_mirror(directory, name, sha, source_tree, parent)

def commit_mirror(directory, name, sha, source_tree, parent):
    """Verify the staged import, record its source, and publish its commit."""
    prefix = "upstream/" + name
    remote = "https://github.com/" + os.environ["GITHUB_REPOSITORY"] + ".git"
    branch = "refs/heads/sync/" + name
    staged = git(directory, "write-tree")
    if git(directory, "rev-parse", staged + ":" + prefix) != source_tree:
        raise RuntimeError("Imported tree differs from upstream.")
    text = (f"# openai/{name} 同步记录\n\n- 上游：https://github.com/openai/{name}\n"
            f"- 上游提交：{sha}\n- 上游 tree：{source_tree}\n- 目录：{prefix}/\n\n"
            "每日自动同步默认分支，也支持手动触发。包含归档仓库及公开 fork。"
            "保留 Git 文件、模式、符号链接及授权说明；不包含完整历史、Issues、讨论、"
            "Release 附件、子模块内容和 Git LFS 实体。空仓库没有可导入文件。\n"
            "同步目录内自定义修改会在上游文件变化后被替换；目录外文件保留。"
            "不执行上游代码。上游移除或转为私有后保留已有快照。\n")
    blob = git(directory, "hash-object", "-w", "--stdin", stdin=text)
    git(directory, "update-index", "--add", "--cacheinfo",
        "100644", blob, "docs/" + name + "-source.md")
    tree = git(directory, "write-tree")
    args = ["commit-tree", tree, "-m", f"Sync openai/{name} at {sha[:12]}"]
    if parent:
        args += ["-p", parent]
    commit = git(directory, *args)
    git(directory, "push", remote, commit + ":" + branch, authenticated=True)
    return "updated " + sha[:12]

def worker():
    """Process every assigned repository and report failures after the batch."""
    failures = []
    rows = []
    for repo in json.loads(os.environ["SYNC_REPOS"]):
        try:
            with tempfile.TemporaryDirectory(prefix="openai-mirror-") as directory:
                status = mirror(repo, directory)
        # Isolate repository failures so remaining imports still run.
        except (OSError, RuntimeError, ValueError, KeyError, subprocess.SubprocessError) as error:
            status = "FAILED: " + str(error).replace("\n", " ")[:2000]
            failures.append(repo["name"])
        print(repo["name"] + ": " + status, flush=True)
        rows.append("- " + repo["name"] + ": " + status)
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as output:
        output.write("\n".join(rows) + "\n")
    if failures:
        raise SystemExit("Failed repositories: " + ", ".join(failures))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["discover", "worker"])
    mode = parser.parse_args().mode
    if mode == "discover":
        discover()
    else:
        worker()
