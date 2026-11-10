# PawCare Round 11 — Vitest 4 JSX configuration correction

Date: 2026-11-06

## Windows results from the user (after Round 10)

- Mobile `npm install`, `expo install --check`, and `tsc --noEmit` succeeded.
- Mobile Jest: 9/9 passed; `expo export --platform android`: succeeded (1 Android JS bundle, 17 assets). This is NOT a native APK build or device test.
- Frontend `npm install --save-dev "vitest@^4.1.12"`: succeeded; `npm audit` found 0 vulnerabilities.
- Frontend Vitest: 48/48 tests passed.
- Frontend Next.js `next build` compiled but failed at TypeScript with TS2769 on `vitest.config.ts` because `esbuild.jsx` is no longer a valid ESBuildOptions property in its Vite 8 typing. This is a config error rather than an app component failure.
- User also saw a non-blocking warning that ESM syntax in `vitest.config.ts` was being loaded as CommonJS by the Vite config loader. This was intentionally left untouched for this minimal patch.
- Mobile full audit was 24 findings (1 low, 23 moderate); the prior mobile production-only audit was 5 moderate, principally Expo CLI tooling dependencies. No changes are made here to mobile dependencies.

## Source changes

1. `frontend/vitest.config.ts`: replace `esbuild: { jsx: 'automatic' }` with supported `oxc: { jsx: { runtime: 'automatic' } }`, per Vite 8 migration guidance. Keep existing Vitest settings and `@` resolution intact.
2. `frontend/package.json`: declare the user's already installed `vitest: '^4.1.12'` upgrade, so the source package matches the successful security scan rather than silently reverting to v3.
3. Update `integration/FILE_MANIFEST_SHA256.json` for the new package.

**No Oracle, C#, mobile, web page or test assertions changed.**

No `package-lock.json` is included: retain the local `frontend/package-lock.json` generated during the user's successful npm upgrade and commit it along with `frontend/package.json`. Back up your working project before applying.

## Windows validation (from PawCare project root)

```powershell
cd .\frontend
npm.cmd install
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd audit
```

Run `cd ..` to return to PawCare root. Expected: TS2769 gone; 48 tests and production build should remain passing, but execution on the user's Windows machine is still needed. The non-blocking Vite CommonJS/ESM config-loader warning may remain. Do not use `npm audit fix --force` to downgrade Expo or Vitest.

Static source audit and archive integrity checks are not a substitute for real npm compiler/test/build execution.
