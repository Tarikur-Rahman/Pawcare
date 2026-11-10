# PawCare Round 8 — Frontend and Mobile Build/Test Corrections

Date: 2026-11-06

## Evidence from Windows run (provided by user)

- **Frontend `npm install`:** completed, but npm reported **3 vulnerabilities** (1 moderate, 2 critical) and warned about an `esbuild` install script awaiting approval. These must not be silently ignored.
- **Frontend `npm run typecheck` / `next build`:** `DashboardOverview.tsx` failed with `TS2604` and `TS2786`: the untyped heterogeneous `tiles` array caused `Icon` to be inferred as `string | number | LucideIcon` rather than a component.
- **Frontend `npm test`:** 45 of 48 passed; 3 failed with `ReferenceError: React is not defined` in JSX test evaluation. Vitest's esbuild transform was not configured for the React automatic JSX runtime.
- **Mobile `npm install`:** failed with ERESOLVE: the legacy `@testing-library/react-native` 13 line selected `react-test-renderer@19.3.1`, which requires a newer React patch than Expo SDK 58's pinned `react@19.3.0`. Mobile TypeScript/Jest checks could not run because dependencies never installed.

## Exact changes

1. `frontend/components/features/DashboardOverview.tsx`: add `LucideIcon` type and explicitly type the dashboard tile tuples; no tile labels/values/links changed.
2. `frontend/vitest.config.ts`: set `esbuild.jsx` to `automatic` to match Next.js's modern JSX runtime and enable component/test transforms without global React.
3. `frontend/tsconfig.json`: set `jsx` to `react-jsx` (Next.js had already applied this change in the user's working copy during `next build`).
4. `mobile/package.json`: upgrade React Native Testing Library to `^14.0.1` and explicitly add `test-renderer@~1.3.0`; **keep** Expo `~58.0.23`, React `19.3.0`, and React Native `0.88.1`. The v14 library no longer selects deprecated `react-test-renderer@19.3.1`.
5. `mobile/tests/{adoption,checkout,marketplace}.test.tsx`: await `render()` and `fireEvent.press()` where applicable, as required by React Native Testing Library v14.
6. `integration/ROUND8_CLIENT_BUILD_FIXES.md`: this audit report, plus regenerated `FILE_MANIFEST_SHA256.json`.

No database, ASP.NET Core, API contract, or mobile app business-logic files changed.

## Apply

**Prefer patch ZIP**, not full project ZIP. The patch contains a top-level `PawCare/` directory. Extract its contents **into the current PawCare root** so, for example, `PawCare/frontend/package.json` remains at that path. Do not overlay a full project ZIP on your existing repo, because it can reintroduce duplicate C# source files. Preserve your *locally generated* frontend `package-lock.json` (this patch does not include or replace it).

## Verify — PowerShell from PawCare root

```powershell
cd .\frontend
npm.cmd install
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd audit --omit=dev
npm.cmd audit
cd ..\mobile
npm.cmd install
npx.cmd expo install --check
npm.cmd run typecheck
npm.cmd test
cd ..
python .\scripts\release-preflight.py
```

**Security:** Don't automatically run `npm audit fix --force`: it may introduce breaking framework major versions. Review the advisory/package paths with `npm.cmd audit` and share the output for a precise dependency update. Separately inspect any unapproved install scripts with `npm install-scripts ls` before approving trusted scripts. Do not disable security checking merely to pass CI.

**Expo SDK version check:** If Expo CLI's `--check` flags React Native 0.88.1 versus 0.88.0 despite SDK 58's published 0.88.1 module map, check the upstream SDK version metadata issue; do not reflexively downgrade React Native without verifying its mapping.

## Validation limits

This package underwent integrity and syntax checks using the source in the Round 7 integrated ZIP. Network requests from this environment fail with npm registry `EAI_AGAIN`, so it **cannot run npm installs, Vitest, Next.js builds, Expo typecheck, or Jest here**. Re-running on the user's Windows machine remains necessary; further issues may appear. Source-audit success is not a runtime pass.

## References

- Expo SDK 58 React alignment: https://docs.expo.dev/versions/latest/
- React Native Testing Library 14 migration: https://github.com/callstack/react-native-testing-library/blob/main/website/docs/14.x/docs/start/migration-v14.mdx
- Test Renderer React 19.3 support: https://github.com/mdjastrzebski/test-renderer/releases
- Expo Jest test setup: https://docs.expo.dev/develop/unit-testing/
