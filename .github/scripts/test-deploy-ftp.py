"""Check upload modes and protection of files excluded from the production mirror."""
import contextlib
import io
import os
from pathlib import Path
import re
import runpy
import shlex
import sys
import tempfile
from types import SimpleNamespace
from unittest.mock import patch

script = Path(__file__).with_name('deploy-ftp.py').resolve()
module = runpy.run_path(str(script))
with tempfile.TemporaryDirectory(prefix='kob-ftp-check-') as temp:
    previous = Path.cwd()
    try:
        os.chdir(temp)
        Path('.github/.deploy-assets').mkdir(parents=True)
        assets = shlex.split(module['mirror_command']('assets').split('; ')[-2])
        site = shlex.split(module['mirror_command']('site').split('; ')[-2])
        assert '--delete' not in assets
        assert assets[-2:] == ['.github/.deploy-assets', 'public_html']
        assert site[-2:] == ['.', 'public_html']
        assert '--delete' in site and '--delete-excluded' not in site
        for flag in ('--reverse', '--continue', '--dereference'):
            assert flag in assets and flag in site
        patterns = [re.compile(site[i + 1]) for i, value in enumerate(site) if value == '-x']
        protected = [
            '.git/config', '.github/workflows/deploy.yml', '.agents/skills/file',
            '.hermes/file', '.hermes-tmp/file', '.impeccable/config.json', '.codex/file',
            '.worktrees/file', '.od-skills/file', '.playwright-mcp/file', 'bkp/file',
            'assets/images/creators/private.svg', 'analytics/file', 'server/file',
            'api/reservation.php', 'netlify/file', 'php/db/connection.php', 'loop_finder/file',
            'node_modules/file', 'test/file', 'tests/file', 'docs/superpowers/file',
            'README.md', 'PRODUCT.md', 'DESIGN.md', 'ONIBUS-PAGAMENTO.md',
            'ANALYTICS-PREREQUISITES.md', 'preview.sh', 'netlify.toml', 'vercel.json',
            'playwright.config.mjs', 'package.json', 'package-lock.json', '.env',
            '.env.production', '.gitignore', 'assets/file.artifact.json', '.DS_Store',
        ]
        for path in protected:
            assert any(pattern.search(path) for pattern in patterns), path
        for path in ('index.html', 'en/index.html', 'es/onibus.html', 'assets/css/main.css',
                     'assets/js/main.js', 'assets/data/search-index.pt.json', 'php/whatsapp.php'):
            assert not any(pattern.search(path) for pattern in patterns), path

        output = io.StringIO()
        fixture_password = 'fixture-password-with-$-and-quotes'
        env = {'FTP_HOST': 'ftp.example.invalid', 'FTP_USER': 'fixture-user', 'FTP_PASSWORD': fixture_password}
        with patch.dict(os.environ, env, clear=True), patch.object(sys, 'argv', [str(script), 'site']), \
             patch('subprocess.run', return_value=SimpleNamespace(returncode=8)) as client, \
             contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            try:
                module['main']()
            except SystemExit as error:
                assert error.code == 8
            else:
                raise AssertionError('FTP failure must stop publication')
        assert client.call_args.kwargs['check'] is False
        assert client.call_args.args[0][-1] == env['FTP_HOST']
        assert fixture_password not in output.getvalue()
    finally:
        os.chdir(previous)
print('PASS: staged uploads do not delete; full mirror preserves private/API files; FTP errors fail without logging credentials')
