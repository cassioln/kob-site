"""Run the existing FTP mirror directly, without a Docker Hub dependency."""
import os
from pathlib import Path
import shlex
import subprocess
import sys

# Preserve the production mirror exclusions, including remote-only API/private files.
EXCLUDES = (
    r"^\.git/", r"^\.github/", r"^\.agents/", r"^\.hermes/",
    r"^\.hermes-tmp/", r"^\.impeccable/", r"^\.codex/", r"^\.worktrees/",
    r"^\.od-skills/", r"^\.playwright-mcp/", r"^bkp/",
    r"^assets/images/creators/", r"^analytics/", r"^server/", r"^api/",
    r"^netlify/", r"^php/db/", r"^loop_finder/", r"^node_modules/",
    r"^tests?/", r"^docs/superpowers/", r"^README\.md$", r"^PRODUCT\.md$",
    r"^DESIGN\.md$", r"^ONIBUS-PAGAMENTO\.md$", r"^ANALYTICS-PREREQUISITES\.md$",
    r"^preview\.sh$", r"^netlify\.toml$", r"^vercel\.json$",
    r"^playwright.*\.mjs$", r"^package\.json$", r"^package-lock\.json$",
    r"^\.env.*$", r"^\.gitignore$", r"\.artifact\.json$", r"\.DS_Store$",
)


def mirror_command(mode):
    if mode not in ("assets", "site"):
        raise ValueError("Expected assets or site mode")
    local = ".github/.deploy-assets" if mode == "assets" else "."
    if not Path(local).is_dir():
        raise ValueError("FTP source directory is missing")
    options = ["mirror", "--reverse", "--continue", "--dereference", "--parallel=3"]
    if mode == "assets":
        options += ["--verbose", "-x", r"^\.git/$"]
    else:
        options.append("--delete")
        for pattern in EXCLUDES:
            options += ["-x", pattern]
    options += [local, "public_html"]
    # Use the same SSL settings as the previous action. Fail instead of retrying forever.
    settings = "set cmd:fail-exit yes; set ftp:ssl-force false; set ssl:verify-certificate false; set net:max-retries 3; set net:timeout 30; "
    return settings + " ".join(shlex.quote(option) for option in options) + "; quit"


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: deploy-ftp.py assets|site")
    try:
        command = mirror_command(sys.argv[1])
    except ValueError as error:
        raise SystemExit(str(error)) from None
    for key in ("FTP_HOST", "FTP_USER", "FTP_PASSWORD"):
        if not os.environ.get(key):
            raise SystemExit(f"Missing {key}")
    # Do not log the invocation or use check=True: exceptions could include credentials.
    result = subprocess.run([
        "lftp", "-u", os.environ["FTP_USER"] + "," + os.environ["FTP_PASSWORD"],
        "-e", command, os.environ["FTP_HOST"],
    ], check=False)
    raise SystemExit(result.returncode)


if __name__ == "__main__":
    main()
