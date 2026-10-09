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

# With the real client installed in CI, mirror only a local file:// fixture.
import shutil
if shutil.which('lftp'):
    with tempfile.TemporaryDirectory(prefix='kob-ftp-local-') as temp:
        root = Path(temp)
        source = root / 'source'
        remote = root / 'remote'
        stage = source / '.github/.deploy-assets'
        (stage / 'assets/css').mkdir(parents=True)
        (stage / 'assets/css/main.css').write_text('new style')
        # Match the public parent directories present in the repository.
        (source / 'php').mkdir()
        (source / 'php/public.php').write_text('public endpoint')
        (source / 'assets/images').mkdir(parents=True)
        (source / 'assets/css').mkdir()
        (source / 'assets/css/main.css').write_text('new style')
        source.joinpath('index.html').write_text('new HTML')
        source.joinpath('.env').write_text('excluded fixture')
        published = remote / 'public_html'
        for path in ('api/keep.php', 'php/db/keep.php', '.env', 'assets/images/creators/keep.svg', 'old.html'):
            file = published / path
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text('keep')
        previous = Path.cwd()
        try:
            os.chdir(source)
            env = {'FTP_HOST': remote.as_uri(), 'FTP_USER': 'fixture', 'FTP_PASSWORD': 'fixture'}
            for mode in ('assets', 'site'):
                with patch.dict(os.environ, env), patch.object(sys, 'argv', [str(script), mode]):
                    try:
                        module['main']()
                    except SystemExit as error:
                        assert error.code == 0, (mode, error.code)
                for path in ('api/keep.php', 'php/db/keep.php', '.env', 'assets/images/creators/keep.svg'):
                    assert (published / path).read_text() == 'keep', path
                if mode == 'assets':
                    assert (published / 'assets/css/main.css').read_text() == 'new style'
                    assert (published / 'old.html').exists()
                else:
                    assert (published / 'index.html').read_text() == 'new HTML'
                    assert not (published / 'old.html').exists()
        finally:
            os.chdir(previous)
    print('PASS: real lftp local mirror stages assets and preserves excluded remote-only files during deletion')
