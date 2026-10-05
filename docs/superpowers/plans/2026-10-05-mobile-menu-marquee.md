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
- [x] Obtain fresh independent Impeccable finish review and document scoped surface contracts; preserve global documentation drift.
- [ ] Run `git diff --check`, commit explicit paths, fetch and push main without force.
- [ ] Confirm the deploy workflow succeeds for the exact commit and production files match local hashes; verify localized navigation and player behavior in production. Keep the YouTube simulation limitation explicit.

Validation: 2026-10-05, 50 unique Playwright cases passed (14 i18n + 36 live). Three marquee cases repeated after adding offscreen-pause assertions: passed. 42 localized home header states and three localized live states verified locally and in production; YouTube API simulated with the existing cover for visual QA. Six menu/marquee regressions passed after cache-reference changes. Independent finish review: ship. UI commit df6a9b2 published successfully; final publication follows the cache correction and latest cyan-band request.

### Deployment cache correction

Observed production responses cache CSS/JS for 2592000 seconds. The original FTP mirror published root HTML before JS; the new HTML cache URL could therefore cache the old module. Stage changed tracked assets under .github (excluded from the ordinary mirror), upload those files without deletion, verify their public SHA-256 hashes, then run the existing mirror. Shallow history misses fall back to all tracked assets; preserve the excluded creators directory. Queue future production runs without cancellation. Final HTML/module references use a fresh ui-final cache version after the first transfer finishes. Validate preparation with a temporary Git fixture (modified/new/renamed/deleted assets, excluded creators, missing-history fallback, no-assets case) and confirm the real GitHub stage verifies the changed module before HTML.

### Cyan subject band requested after the light-controls update

- [x] Replace the desktop lower-third dark scrim with the existing ocean-cyan token; keep it opaque under text and fade only beyond the reading area. Use ocean-abyss text, purple-deep emphasis/focus and remove title shadow. Keep layout, motion and popover behavior.
- [x] Use a fresh manual CSS cache version, 20261005-cyan-band, in PT/EN/ES.
- [x] Inspect the three localized desktop/mobile states in one batch. Contrast: title/body 8.23:1; emphasis/focus 5.76:1; button text 9.88:1 (7.37:1 hover). Independent finish review: ship, no blockers.
- [ ] Publish through the queued production workflow and verify the final public hashes and manual aliases.

### Final transparent-title direction and separate detail action

The user's final Impeccable delight direction replaces the solid cyan subject band with a white floating title on a transparent background. A 1 px navy contour and soft offset text shadows keep it legible; the editorial notice uses a very pale cyan surface with navy text. The detail action lives in a sibling div outside role=status, with its own right column. The composition has a stable width up to 900 px; mobile stacks the action below the notice, aligned right. JavaScript creates and repositions the group around the existing note, so older HTML remains compatible during asset-first publication. The whole group hides for subjects without notices.

- [x] Implement the separate action column and preserve popover, reduced motion, resize and fullscreen behavior.
- [x] Use new CSS/live-module cache URLs, 20261005-clean-overlay, in all three Manuals.
- [x] Verify 39 unique live cases after the resize test measures all boxes atomically; final PT/EN/ES position recheck passed. Batched visual QA passed three localized desktop/mobile states. Independent finish review: ship, no blockers.
- [ ] Publish and verify the final public files and manual aliases.

### Purple inversion and authored topic change (latest request)

- Use #71206c for the controls and notice surface, with white/pale components, legible secondary times and clear keyboard focus. Preserve the thin total timeline and its markers.
- Keep the desktop subject background transparent, white Gobold lettering and soft navy contour/shadow; increase its display scale. Preserve the fixed right-hand details action and compact mobile placement.
- Motion thesis: the subject handoff is the focal moment. Exit the old title in 160 ms, leave a 2000 ms interval, then introduce the latest selected title in 360 ms. The notice follows the same subject so it cannot contradict the visible heading. Controls/seeking respond immediately.
- Use transform and opacity only, no new dependency. Cancel superseded timers on rapid selection; settle immediately on mobile, reduced motion or a hidden document. First selection is immediate. Preserve the existing 340 ms lower-third/controls continuity.
- Add behavior checks for the interval, latest-selection wins, resize/reduced-motion interruption and automatic playback boundary. Run the live suite, one batched localized visual inspection, independent finish review and documentation, then publish and verify exact commit hashes.

### Updated timing: finish the entrance at the next subject boundary

Latest steering supersedes the post-selection delay: during automatic playback, rehearse the title handoff in the last 2.52 real seconds of the current topic (160 ms exit, 2 s interval, 360 ms entrance). Derive the phases from the actual player time and playback rate, so the next title is fully visible at its start. Hide the previous notice during the handoff and commit the next notice at the boundary. Manual selection is immediate; pause/buffering, reduced motion, mobile and hidden pages cancel anticipation and restore the current title. A bounded animation frame loop runs only within the last four seconds. Verify boundaries, interruption, seek and resume with the existing player simulation.

Hover correction: keep the details target and its popover still while the pointer transfers between them; avoid revealing/moving video controls underneath an active hover target. Six affected hover/touch/position cases passed on the stable preview4175.

Final validation for the anticipated handoff: 44 live Playwright cases passed in 1.5 minutes on the stable4175 preview, including 1×/2× entrance completion, keyboard manual selection, pause/reduced-motion/mobile cancellation, scrub rewind and playback slowdown. Three localized desktop/mobile visual checks passed for the purple composition; six focused hover/touch/position cases also passed. YouTube is simulated. The earlier preview connection reset and automation smooth-scroll failures are retained in review evidence; final assertions are unchanged in intent. Public validation remains pending the exact final workflow.

Independent final review: ship after verifying scrub cancellation and restoration after playback slowdown. Preserve the concurrent bf115a5 home header commit as the publication base; it does not touch the requested player changes.
