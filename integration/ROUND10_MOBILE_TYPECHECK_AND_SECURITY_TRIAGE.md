# PawCare Round 10 — Mobile TypeScript and npm security triage

Date: 2026-11-06

## Verified user workstation results (after Round 9)

- Web: TypeScript check passed, 48/48 tests passed, Next.js 16.4.5 production build passed (previous log).
- Web `npm audit --omit=dev`: **0 findings**. Full audit: **3 findings** (1 moderate in `@vitest/mocker`; 2 critical in `tinypool`) in dev dependencies.
- Mobile `npm install`: succeeded; Expo SDK 58 `expo install --check` found dependencies current; Jest: **9/9 passed** across four suites.
- Mobile TypeScript: **2 remaining errors**, missing `expo-status-bar` module and removed `StyleSheet.absoluteFillObject` property.
- Mobile full npm audit: **24 findings** (1 low, 23 moderate). Production-only audit: **5 moderate** findings, related to `glob` and `minimatch` within Expo CLI/fingerprint dependency chains. The production-only count is not necessarily equivalent to runtime-exploitable mobile code.
- The `cd .\mobile` failure was just navigation: the shell was already in `PawCare\mobile` and attempted `mobile\mobile`. It did not affect any installation or tests.

## Source corrections applied in this package

1. `mobile/package.json`: add the missing runtime dependency `expo-status-bar: ~58.0.4`, the compatible version listed by Expo SDK 58's public documentation. The existing `App.tsx` import remains unchanged.
2. `mobile/src/components/ui/BottomSheet.tsx`: use `StyleSheet.absoluteFill` instead of `StyleSheet.absoluteFillObject`; React Native removed the latter in 0.85. Preserves the absolute-position backdrop.
3. Add this evidence report and update `integration/FILE_MANIFEST_SHA256.json` to reflect source changes.

No Oracle migrations, C# backend, frontend code, or existing test assertions were changed. No frontend or mobile `package-lock.json` was packaged; the user's locally generated lockfiles must be retained and updated by npm installation. The package is statically validated only; the TypeScript compiler and Expo tests cannot be rerun here without registry access.

## Commands: from the PawCare project root

```powershell
cd .\mobile
npm.cmd install
npx.cmd expo install --check
npm.cmd run typecheck
npm.cmd test
npm.cmd audit --omit=dev
cd ..
python .\scripts\release-preflight.py
```

If you are *already inside* `PawCare\mobile`, do not run `cd .\mobile` again.

### Web development-tool advisories (separate, deliberately not auto-updated here)

`vitest` was pinned at `^3.2.0` in the previous source, outside the maintained patch branches. Recommended security migration: test Vitest **4.1.12 or newer patched 4.x release** on a separate branch with a lockfile refresh, then re-run typecheck, all 48 tests, build and `npm audit`. `@vitest/mocker` is patched at 4.1.12 for both disclosed 2026 mock vulnerabilities, and `tinypool` needs at least 2.1.2 for both prototype-pollution advisories. A major test-runner upgrade may require test/config adjustments. This is NOT claimed resolved in Round 10.

Suggested on a feature branch (from `PawCare\frontend`):

```powershell
npm.cmd install --save-dev "vitest@^4.1.12"
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd audit
```

Confirm the resolved tree has `tinypool>=2.1.2` and `@vitest/mocker>=4.1.12` and is free from newly disclosed advisories; do not infer success from the requested top-level version alone. After a successful run, commit `package.json` and the regenerated `package-lock.json` together.

### Mobile Expo tool-chain advisories

The observed `glob` and `minimatch` findings are also reported by Expo maintainers as SDK 58 CLI/fingerprint dependency-range issues. Their maintainers have described a planned transition away from those packages. Avoid forcing Expo to an older SDK with `npm audit fix --force`; check supported future Expo 58 patches, and re-run both `npm audit --omit=dev` and Android bundle checks. Test any overrides as potentially breaking; do not blindly force `minimatch@11` because older tooling may depend on APIs it removed.

## Gate status

- Backend build: previously passed.
- Backend tests: 52 passed / 26 skipped (real Oracle/deployed API cases).
- Web: previously typecheck, 48 tests and production build passed; dev dependency security warnings open.
- Mobile: 9 tests passed; TypeScript correction requires workstation rerun; native Android build and real device use not verified.
- Production: NOT READY. Oracle integration, registration activation/payment workflows, browser/device E2E and security follow-up remain.

## References (accessed 2026-11-06)

- Expo StatusBar installation/version: https://docs.expo.dev/versions/latest/sdk/status-bar/
- React Native 0.85 removal of `absoluteFillObject`: https://reactnative.dev/blog/2026/04/07/react-native-0.85
- Mock register vulnerability: https://github.com/vitest-dev/vitest/security/advisories/GHSA-qxg6-89mg-rqv8
- Tinypool vulnerabilities: https://github.com/advisories/GHSA-5gmw-xhrv-c9v3 and https://github.com/advisories/GHSA-85c8-ppgw-ccpr
- Expo issue #52735 (SDK 58 glob/minimatch ranges): https://github.com/expo/expo/issues/52735
