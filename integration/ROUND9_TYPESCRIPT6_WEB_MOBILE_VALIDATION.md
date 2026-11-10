# PawCare Round 9 — TypeScript 6 / Web and Mobile Verification

Date: 2026-11-06

## Windows results supplied by user

- Frontend `npm install`: succeeded; npm found 3 vulnerabilities (1 moderate, 2 critical). Frontend dependency vulnerabilities remain **open**.
- Frontend `npm run typecheck`: passed.
- Frontend `npm test`: 48/48 passed across two suites.
- Frontend `npm run build`: Next.js 16.4.5 production build completed successfully (not a live-browser/E2E test).
- Mobile `npm install`: succeeded (999 packages added); npm reported 24 vulnerabilities (1 low, 23 moderate).
- `npx expo install --check`: indicated TypeScript ~6.0.3 and, with user approval, installed compatible TypeScript.
- Mobile `npm test`: 9/9 passed across four suites.
- Mobile `npm run typecheck`: blocked by TS5101 because the existing project `mobile/tsconfig.json` specified `baseUrl`, deprecated in TypeScript 6.

## Changes

1. `mobile/tsconfig.json`: remove `compilerOptions.baseUrl` and change the `@/*` alias mapping from `src/*` to explicit `./src/*`. No JavaScript, API or runtime logic changed. This is the TypeScript 6 migration recommended by the TypeScript team.
2. `mobile/package.json`: align the baseline TypeScript devDependency to `~6.0.3`, the version requested by the user's Expo SDK 58 `expo install --check` output. All other dependency versions retained.
3. `integration/ROUND9_TYPESCRIPT6_WEB_MOBILE_VALIDATION.md`: this report, plus updated source-hash manifest.

The patch does **not** contain or overwrite `frontend/package-lock.json` or `mobile/package-lock.json` that were generated on the user's machine. Running `npm install` locally reconciles the package and lock file changes.

## Apply and verify (PowerShell)

From the PawCare project root, apply only the Round 9 patch, merging its `PawCare/` contents into the existing root. Then:

```powershell
cd .\mobile
npm.cmd install
npx.cmd expo install --check
npm.cmd run typecheck
npm.cmd test
npm.cmd audit --omit=dev
cd ..\frontend
npm.cmd audit --omit=dev
npm.cmd audit
cd ..
python .\scripts\release-preflight.py
```

If TypeScript reports new diagnostics after removing `baseUrl`, fix those diagnostics rather than suppress them. Web production build passed previously and does not need a new source patch; browser/runtime and Android native builds remain unverified.

## Security, scope and limitations

- Audit findings remain unresolved: mobile 24 (1 low, 23 moderate); frontend 3 (1 moderate, 2 critical). The mobile report shows `deepmerge`, `glob`, and `minimatch` in transitive Jest/Expo CLI paths. `npm audit --omit=dev` is required to determine whether issues are in production dependencies; do not assume they are all dev-only.
- The mobile audit suggested using `npm audit fix --force` to change major versions of Jest/Expo; that can break SDK 58 and is **not approved**. Do not use it.
- The user has not provided the detailed frontend audit yet; do not guess which packages caused its critical vulnerabilities.
- Neither lockfile was present in the published Round 8 archive and this archive intentionally does not invent them; the user should commit their generated, consistent lockfiles to source control after validation.
- The present package was statically checked in this environment; TypeScript 6 dependency installation and full web/mobile test execution on the updated source cannot be repeated here.

TypeScript 6 release notes: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html

npm audit docs: https://docs.npmjs.com/cli/commands/npm-audit/
