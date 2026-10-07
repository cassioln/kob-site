# Timeline card categories — Implementation Plan

> Execute inline in this session. The maintainer approved the layout through the supplied screenshot and category mappings; no additional design approval is required.

**Goal:** Place concise Montserrat categories inside the upper-right corner of timeline cards and match each card border to its category color.

**Architecture:** Preserve the existing 15 articles, phase navigation and scroll markers. Set `data-timeline-category` on categorized articles and style their text-only status with the same custom color property used by their border. Keep the existing PT, EN and ES HTML architecture.

**Tech Stack:** HTML, CSS, existing JavaScript, Playwright.

## Global constraints

- Three categories only: required (red), recommended (blue), attention (yellow with readable contrast on white).
- No category for generic estimated cabin release, onboard activities or announced party theme.
- Keep mandatory MSC safety training categorized as required.
- Keep all existing dates, locations and times. Clarify charter eligibility and add the official, localized bus site link.
- Preserve the Gobold timing heading shown in the approved screenshot; use Montserrat for status and body copy.
- Preserve category borders in hover and current-step states. Reserve a separate top row so tags never overlap headings on narrow screens.
- No dependency, CI workflow or unrelated animation changes. No SonarQube.

## Task 1 — Approved markup and styling

Files: `manual-de-bordo.html`, `en/manual-de-bordo.html`, `es/manual-de-bordo.html`, `assets/css/manual-de-bordo.css`.

- [x] Apply the category map by article index, consistent across locales:
  ```python
  categories = ['required', 'recommended', 'required', 'required', 'attention',
                'required', None, 'attention', 'required', None, 'required',
                None, 'attention', 'attention', 'attention']
  ```
- [x] Use labels PT `OBRIGATÓRIO / RECOMENDADO / ATENÇÃO`, EN `REQUIRED / RECOMMENDED / ATTENTION`, ES `OBLIGATORIO / RECOMENDADO / ATENCIÓN`.
- [x] Add localized eligibility and booking link to the outbound charter card, using `https://busao.kriativosonboard.com.br/`, `/en/` and `/es/`.
- [x] Use category colors `#c6283d`, `#1b658f`, `#916600` on the tag and the full 1px border; no tag background or border. Position at `top:12px; right:16px`, with `44px` top padding for categorized cards.
- [x] Update the CSS cache version in all three HTMLs to `20261007-timeline-categories`.

## Task 2 — Verification and publication

- [x] Compare the 15 articles with the original commit; allow only category changes and the charter paragraph changes. Check six required, one recommended, five attention and three uncategorized cards per locale.
- [x] Render the real timeline in PT/EN/ES at 320, 390 and 1440px. Verify tags stay inside cards, never overlap heading/body, match the border in current/hover states, load Montserrat and pass text contrast. Inspect one batched screenshot set; fix any findings once.
- [x] Run the existing timeline animation regression: `node node_modules/@playwright/test/cli.js test analytics/tests/timeline-animation.spec.js --reporter=list` and `git diff --check`.
- [ ] Commit the five files, create and attach a PR, wait for `Testes (servidor + navegador)`, then merge normally to main.
- [ ] Confirm the deploy result and that the three public HTMLs and CSS match the immutable merge commit. Record the outcome in the PR.

## Validation evidence

The 15 timing headings and 14 unchanged paragraphs match baseline `286d74e`. All three locales contain six required, one recommended, five attention and three uncategorized articles. Nine browser combinations (PT/EN/ES × 320/390/1440px) passed containment, overlap, border color, Montserrat, contrast, hover and collapse/reopen checks. Minimum measured contrast: 5.12:1. Existing timeline animation regression passed (1 test traversing all three languages, 4.5s). Layout detector returned no timeline findings; its 15 findings belong to other, unchanged components. No new ignores or unrelated repairs were introduced.

Evidence: `/Users/cassio/.codex/visualizations/2026/10/07/kob-timeline-approved/medidas.json`, the corresponding screenshots, `/tmp/kob-timeline-tests.log`, and `/tmp/kob-timeline-layout-detect.json`. Fixed header/navigation were hidden only for component screenshot crops; layout measurements use the normal page. CI, merge and public-file results will be recorded in the PR after completion.
