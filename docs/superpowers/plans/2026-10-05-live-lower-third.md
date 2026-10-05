# Live Lower Third Implementation Plan

> **For agentic workers:** Execute inline in this session. Use the existing impeccable finish reviewer and documenter workflow after the bounded visual pass.

**Goal:** Place the desktop topic and editorial note together above the video controls, moving them into the vacated area when controls hide.

**Architecture:** Add one lower-third container before the controls in each localized HTML. Reparent the existing topic/note at the existing breakpoint; CSS follows the controls' visibility and uses a measured offset for transform. Preserve all player logic and content sources.

**Tech Stack:** Static localized HTML, CSS, vanilla JavaScript, ResizeObserver, existing Playwright mock.

## Global Constraints

- Desktop is `(min-width: 769px)`; preserve mobile presentation.
- Use existing Gobold/Montserrat and navy/white/gold; no new dependency or raster.
- Preserve one topic/status node, native API fallback, localized copy and existing guide help.
- Animate transform/opacity only; reduced motion changes state immediately.
- Keep user changes in the primary checkout untouched; use the attached worktree.

### Task 1: Compose and synchronize the lower third

**Files:** Modify the three `manual-de-bordo.html` files and `assets/js/manual-de-bordo-live.js`.

- [ ] Wrap the existing topic before controls in `<div class="live-lower-third" id="liveLowerThird" hidden>`. Keep the original hidden note before the cinema as the mobile origin.
- [ ] Extend `updateDimensions()` to put the topic and note inside the new container on desktop, insert it before controls, and set `--live-controls-offset` to `controls.offsetHeight + 12` px. On mobile prepend the topic to controls, move note immediately before cinema, and hide the empty container.
- [ ] In `select(chapter, isPlaying)`, set `byId('liveLowerThird').hidden = !desktop.matches` after revealing the topic. Keep the existing localized note construction.
- [ ] Observe both video and controls with the existing ResizeObserver. Reveal controls on lower-third focus/hover; reset the hide timer when focus/hover leaves either lower third or controls. The timer tests both regions before hiding.

### Task 2: Style and animate

**File:** Modify `assets/css/manual-de-bordo.css`.

- [ ] Replace the upper-right topic rule with a lower-third rule: absolute bottom18/left22/right22, transform transition340ms, left aligned white display topic and navy-to-transparent scrim.
- [ ] Follow the real visible state using `.hero-live-player:has(> .live-custom-controls:not([hidden]):is(.is-visible,:hover,:focus-within)) > .live-lower-third { transform: translateY(calc(-1 * var(--live-controls-offset, 102px))); }`.
- [ ] Add scoped note styles below the title, retaining the existing status/copy/button. Use a one-pixel horizontal separator, white body and gold rule label/link; reveal with220ms opacity/translateY4px.
- [ ] Add reduced-motion transition/animation none and API-failure transform−56px for native controls. Change CSS/live module cache versions to `20261005-lower-third` in all three HTMLs.

### Task 3: Verify meaningful states

### Task 2b: Topic markers on the preserved total line

**Files:** Add `assets/js/manual-de-bordo-live-markers.js`; modify the three Manual HTMLs, main live module, CSS and existing browser tests.

- [ ] Wrap native progress in `<div class="live-total-track" id="liveTotalTrack">`; keep progress and time copy unchanged.
- [ ] Export `initLiveMarkers({track, chapters, lang, label, onSelect})`, returning `{update(duration, selectedId)}`. Create positioned button dots and one tooltip with DOM textContent. Pointer selections resolve the closest real chapter; keyboard uses roving tabindex with ArrowLeft/Right/Home/End and Enter/Space. Escape dismisses tooltip. The tooltip is hoverable and bounded within the track.
- [ ] Call the helper from the live module; `onSelect(chapter)` uses existing `select(chapter,false)` and `playAt(chapter.seconds)`. `updateProgress` updates marker percentages and active state with real duration.
- [ ] Preserve the3px track; dots4px, larger only for hover/focus/current; transparent20px targets. Tooltip navy/white, readable type, no duplicate native tooltip. Restore the native progress's readonly behavior; interactive descendants alone receive pointer events.
- [ ] Test all41 positions, hover text, pointer and keyboard seek, actual-duration change, stable single player, no accidental pause, and absence on mobile.

### Task 3: Verify meaningful states (continued)

**File:** Modify `analytics/tests/manual-live.spec.js`.

- [ ] Update incumbent desktop assertions to expect the topic inside `liveLowerThird` above controls rather than at the top of the player.
- [ ] Add checks for topic/note order, measured separation, real auto-hide movement and pointer/focus return, reduced motion, resize restoration, fullscreen and API fallback. Preserve the existing timeline/menu tests.
- [ ] Run `node --check assets/js/manual-de-bordo-live.js`, `git diff --check` and the Manual Playwright suite with the existing isolated4174 config. Do not rerun unrelated backend suites.
- [ ] Capture PT/EN/ES at390/850/1440 with controls visible/hidden and a warning present, mock video explicitly labeled; inspect once as a batch. Perform the required fresh finish-review/documenter handoff without expanding scope.

### Task 4: Publish and confirm

- [ ] Commit only this refinement, verify remote main has not advanced, push without force and monitor the exact FTP workflow to completion.
- [ ] Compare served PT/EN/ES HTML, CSS and liveJS to final commit and verify the desktop/mobile interface in production with simulated API. Update only the ignored surface brief with conclusive deployment evidence.
