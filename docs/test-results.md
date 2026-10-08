# Verification record

## Environment

- Date: 9 October 2026 (Asia/Kolkata)
- Workspace: `G:\idea-1\one\securities-lending-recalls`
- Runtime: Windows, Node.js 22.18.0, Next.js 16.4.0, Vitest 4.0.3
- Mode: local development store unless Supabase environment variables are supplied

## Automated checks

| Check | Command | Result |
| --- | --- | --- |
| Domain and local session unit tests | `npm test` | Passed: 2 files, 12 tests. Covers canonical shares, ordering, role permissions, broker return order, duplicate request, reconnect, role change, kick/rejoin, and repeat run. |
| Strict TypeScript check | `npm run typecheck` | Passed after source and test type fixes. |
| ESLint | `npm run lint` | Passed with no warnings or errors. |
| Production build | `npm run build` | Passed; `/` and `/join` static, `/api/room` dynamic. |
| Browser layout | Chrome on local server, CUA viewport override at 320, 390, 430, 768 and 1440 CSS px | Lending Desk Overview, Work, Activity, and sample detail inspected; `documentElement.scrollWidth == clientWidth` at each tested width. Join screen inspected at 320 and 390px. 768px is a narrow-desktop reflow proxy, not a 200% zoom test. |
| Keyboard and semantic accessibility | Chrome accessibility tree, Tab and Escape | Overview/Work/Activity exposed as buttons; progress has an accessible value; room status is a polite live region; sample detail is a modal dialog, Escape closes it and returns focus to its trigger. |
| Two-browser-context synchronization and complete run | IAB Portfolio/Presenter, Chrome Lending Desk, and local HTTP API against `localhost:3000` | Passed locally. IAB Portfolio clicked sale (#1); Chrome Lending clicked recall (#2); local HTTP API submitted broker A/B returns (#3/#4) and custodian confirmation (#5); Chrome Lending clicked collateral release (#6); local HTTP API submitted custodian settlement (#7). IAB presenter showed Settled, 7/7, version 7. The IAB and Chrome browser views updated through local server polling. |
| Kick, rejoin, and reset | IAB presenter and Portfolio views | Passed locally. Presenter kicked Portfolio (connected count 5 to 4); Portfolio view showed "Presenter removed this device." Rejoin and role selection restored the role/count. Presenter reset to run 2, 0/7 events, version 8; reload showed a ready room without the old log. |
| Graph drift | Graph MCP drift check | Unverified: no drift tool is exposed by codebase-memory MCP and Graft was unavailable. |

## Failures found and fixed

- Vitest initially discovered an unrelated `G:\vite.config.ts` when run without an explicit config. Added `tests/vitest.config.ts`; the package test script now points to it.
- The first test invocation used Vitest's unsupported `--runInBand` flag. Reran with the supported package script.
- Initial strict type check reported a UUID type mismatch in the test fixture and source typing errors. The fixture was corrected; source typing errors were corrected by the implementation owner. The subsequent type check passed.
- ESLint reported one warning for an anonymous default export in the test config. The config now uses a named variable; the final lint rerun passed without warnings.

## Browser and accessibility findings

- The 320px Lending Desk layout had no measured horizontal overflow, but its "Open work view" button initially measured 28 by 28 CSS px. The hit area was enlarged to 44 by 44 CSS px and remeasured in Chrome.
- A computed-color sample in Lending Desk Work initially found several small text elements below 4.5:1 contrast against their solid backgrounds: room/run labels (~2.88:1), progress label (~3.49:1), step labels (~2.87:1), waiting pills (~3.38:1), work disclaimer (~4.11:1), and inactive navigation (~2.93:1). After the CSS fix, the same sampled Work text had no result below 4.5:1. This is a targeted computed-color check, not a full WCAG color audit; image-backed hero text was visually inspected only.
- Chrome zoom shortcuts issued through CUA did not change viewport size or device pixel ratio. Actual 200% browser zoom remains unverified; the 768px reflow check is only a proxy.

## Browser evidence and limits

Chrome screenshots were captured and visually inspected through CUA during the checks above but were not saved as repository artifacts. Browser error-state fixtures, an actual screen-reader announcement test, reduced-motion emulation, true 200% zoom, managed Supabase synchronization, Vercel smoke test, and physical-device checks have not been performed. The unit tests use the local store and do not establish cross-device behavior. The complete browser/API run used the local development server; it does not establish deployment reliability or managed realtime behavior.
