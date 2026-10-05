"""Stage changed assets and all CSS/JS before publishing their HTML references."""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
from urllib.parse import quote
from urllib.request import Request, urlopen

root = Path.cwd().resolve()
stage = root / ".github" / ".deploy-assets"

if "--verify" in sys.argv:
    for source in stage.rglob("*"):
        if not source.is_file():
            continue
        relative = source.relative_to(stage).as_posix()
        expected = hashlib.sha256(source.read_bytes()).hexdigest()
        url = "https://kriativosonboard.com.br/" + quote(relative)
        for attempt in range(6):
            try:
                request = Request(url + "?release=" + os.environ["GITHUB_SHA"], headers={"Cache-Control": "no-cache"})
                with urlopen(request, timeout=30) as response:
                    actual = hashlib.file_digest(response, "sha256").hexdigest()
                if actual == expected:
                    break
            except OSError:
                pass
            if attempt == 5:
                raise SystemExit(f"Asset verification failed: {relative}")
            time.sleep(5)
    print("Public assets verified; HTML can be published.")
else:
    before = os.environ.get("KOB_DEPLOY_BEFORE", "")
    exists = subprocess.run(["git", "cat-file", "-e", before + "^{commit}"], capture_output=True).returncode == 0
    command = ["git", "diff", "--name-only", "--no-renames", "--diff-filter=ACM", "-z", before, "HEAD", "--", "assets"] if exists else ["git", "ls-files", "-z", "assets"]
    paths = set(filter(None, subprocess.check_output(command).split(b"\0")))
    # A superseded/failed deploy may contain imported modules absent from this diff.
    paths.update(filter(None, subprocess.check_output(["git", "ls-files", "-z", "--", "assets/css", "assets/js"]).split(b"\0")))
    stage.mkdir(parents=True, exist_ok=True)
    count = 0
    for raw in sorted(paths):
        relative = Path(os.fsdecode(raw))
        source = root / relative
        if relative.as_posix().startswith("assets/images/creators/") or not source.is_file() or root not in source.resolve().parents:
            continue
        target = stage / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        count += 1
    with open(os.environ["GITHUB_OUTPUT"], "a") as output:
        output.write(f"has_assets={'true' if count else 'false'}\n")
    print(f"Staged {count} public assets before HTML.")
