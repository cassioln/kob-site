# Footer sponsors — Implementation Plan

**Goal:** Credit the seven sponsors already listed on the home page in the Manual and official bus footers, without a dense grid or distracting autoplay.

**Architecture:** One shared stylesheet and one progressive-enhancement script, included only by the six localized Manual/bus HTMLs. Preserve the existing footer navigation and legal links; place the sponsor area between them. Logos and destinations come from the existing sponsor tier in the home, not the store/partner/support tiers.

**Tech stack:** HTML, CSS, vanilla JavaScript, existing WebP logos and Playwright.

## Approved direction and constraints

- PT title: “Quem faz o Kriativos On Board acontecer”; localized equivalents in EN/ES.
- Seven sponsor links, original logo colors, correct intrinsic dimensions and accessible brand names. No new images or dependencies.
- A single white logo rail on the existing navy footer; all seven fit desktop. Horizontal scrolling supports tablet/mobile with previous/next controls shown only when overflowing.
- Native swipe and keyboard link navigation remain usable without JavaScript. No autoplay. Button scroll respects reduced motion.
- Scope changes to six pages and the shared sponsor assets; preserve all existing footer destinations and claims.
- SonarQube remains disabled. User authorized the design choice and publication; execute inline.

## Implementation

- [x] Create `assets/css/footer-sponsors.css` with `.footer-sponsors` section, heading/controls row, white flex rail, 116px minimum logo columns, 72px logo links, visible focus and 44px buttons. Scope footer deck spacing to the presence of this component.
- [x] Create `assets/js/footer-sponsors.js`: initialize each component; show controls only when `scrollWidth > clientWidth + 1`; disable edge buttons; scroll by 80% of visible width; sync on scroll/resize; use auto scrolling under reduced motion.
- [x] Add matching localized sections and versioned CSS/JS references to `manual-de-bordo.html`, `en/manual-de-bordo.html`, `es/manual-de-bordo.html`, `onibus.html`, `en/onibus.html`, `es/onibus.html`. Copy sponsor names, image paths, sizes and destinations from the home sponsor tier.
- [x] Verify six pages at 320, 768 and 1440px: seven loaded logos; parity of sponsor links; no page overflow; usable forward/back, keyboard and reduced-motion behavior; all logos accessible without JS. Inspect desktop/tablet/mobile together, fix any findings in one batch, confirm once and stop polishing.
- [ ] Compare existing footer links with baseline; run `git diff --check` and JavaScript syntax check. Create/attach PR, await the mandatory CI, merge normally and verify the production assets/pages against the immutable merge commit. Record publication in the PR.

Publications already in flight (WhatsApp invitation card) remain separate and will also be verified. No deployment cancellation or CI workflow change belongs to this task.

Validation: 18 route/viewport combinations passed loaded logo count, page overflow, conditional controls and forward navigation under reduced motion. Desktop/tablet/mobile screenshots inspected together. Existing footer markup is preserved (ignoring whitespace). Publication pending CI/deployment.
