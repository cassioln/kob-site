# Mobile Menu and Live Marquee Implementation Plan

> **For agentic workers:** Execute inline in the existing session. Independent finish review/documentation follow the Impeccable workflow.

**Goal:** Move the mobile Manual CTA into the menu and make overflowing live topic names readable with a slow marquee.

**Architecture:** Localized static HTML retains existing routes and analytics. Scoped CSS defines the responsive navigation and equal drawer actions; a small live helper measures labels and exposes transform animation variables.

**Tech Stack:** HTML, CSS, native JavaScript modules, Playwright; no new dependency.

## Global Constraints

- PT, EN and ES parity; desktop header behavior unchanged above 1320 px.
- Minimum 44 × 44 px language/menu controls; drawer actions 64 px high.
- Preserve analytics and full accessible names; reduced motion disables marquee.
- Scan before reads, using the existing user waiver while Sonar is unauthenticated.
- Do not alter preexisting animation hook findings without the pending approval.

---

### Task 1: Mobile navigation

**Files:** index.html, en/index.html, es/index.html, assets/css/main.css, analytics/tests/i18n.spec.js.

**Interface:** `.drawer__actions` contains `.header-manual-link` then `[data-analytics-cta-id="drawer_reserve"]`; existing main.js handles every drawer anchor.

- [x] Replace each plain Manual nav link with the existing localized header CTA in a `.drawer__actions` wrapper alongside the untouched reservation anchor.
- [x] Replace obsolete mobile Manual downsizing rules with one ≤1320 px block hiding that header CTA and desktop language group. Set each language control and hamburger to 44 px with matching border/radius/navy surface; white active locale. Add scoped `.drawer__actions > .btn { width:100%; height:64px; box-sizing:border-box; margin:0; }` and a nonshrinking actions group with 12 px gap, 24 px top padding, auto top margin.
- [x] Update three mobile regression cases to assert the header CTA hidden, two drawer actions equal, correct order/routes, no plain duplicate, matching language/control sizes and Escape returning focus. Use 1440 px for tests explicitly exercising the desktop selector.
- [x] Run `playwright test 'analytics/tests/i18n.spec.js$'`: all 14 cases pass. Batch mobile/tablet/desktop captures for all three languages.

### Task 2: Live label marquee

**Files:** assets/js/manual-de-bordo-live-marquee.js (new), assets/js/manual-de-bordo-live.js, assets/css/manual-de-bordo.css, analytics/tests/manual-live.spec.js, three manual-de-bordo.html files.

**Interface:** `initLiveControlMarquee(buttons)` returns `{ refresh() }`. It observes label dimensions, sets `--live-label-travel` and `--live-label-duration`, and toggles `.is-overflowing` only for positive overflow.

- [x] Move maximum label width to the clipping wrapper (130 px desktop / 88 px tablet; whole button 180/138 px, about 40% narrower); leave the inner span at full content width. Hover/focus animation uses `transform: translateX(var(--live-label-travel))` and pauses at both endpoints. Reduced motion restores ellipsis and `animation:none`.
- [x] Align play/pause/nav actions with the purple Assuntos tab and use a lighter purple accent for the topic range. Change guide CTA to Mais detalhes / More details / Más detalles with an authored info SVG, outlined surface and hover/focus/open feedback; retain existing popover behavior.
- [x] Initialize helper for previous/current/next buttons; refresh after names change. ResizeObserver plus font readiness recalculates width; document visibility pauses motion. Change textContent only when the title changes.
- [x] Add behavior tests using the existing mockPlayer/readyPlayer helpers: long real topic animates on focus, short topic stays static, pointer leave stops, resize recalculates, reduced motion stays static, full aria-label remains.
- [x] Bump only relevant CSS/module version references, run the live suite and capture final focused/hovered controls with real localized names.

### Task 3: Finish and publish

- [x] Inspect one batch of screenshots/measurements; fix concrete issues together, confirm once if required.
- [ ] Obtain fresh independent Impeccable finish review and document scoped surface contracts; preserve global documentation drift.
- [ ] Run `git diff --check`, commit explicit paths, fetch and push main without force.
- [ ] Confirm the deploy workflow succeeds for the exact commit and production files match local hashes; verify localized navigation and player behavior in production. Keep the YouTube simulation limitation explicit.

Validation: 2026-10-05, 50 unique Playwright cases passed (14 i18n + 36 live). Three marquee cases repeated after adding offscreen-pause assertions: passed. 42 localized home header states and three localized live states verified; YouTube API simulated with the existing cover for visual QA. Publication pending final independent review.

### Deployment cache correction

Observed production responses cache CSS/JS for 2592000 seconds. The original FTP mirror published root HTML before JS; the new HTML cache URL could therefore cache the old module. Stage changed tracked assets under .github (excluded from the ordinary mirror), upload those files without deletion, verify their public SHA-256 hashes, then run the existing mirror. Shallow history misses fall back to all tracked assets; preserve the excluded creators directory. Queue future production runs without cancellation. Final HTML/module references use a fresh ui-final cache version after the first transfer finishes. Validate preparation with a temporary Git fixture (modified/new/renamed/deleted assets, excluded creators, missing-history fallback, no-assets case) and confirm the real GitHub stage verifies the changed module before HTML.
