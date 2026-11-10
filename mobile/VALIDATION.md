# PawCare mobile source validation

## Scope

This package contains the complete list of requested mobile source file paths plus supporting UI helpers, an account shipping-address screen and order-details screen, a `.gitignore`, and this validation report.

## Checks completed during generation

- All 41 explicitly requested screen files exist, plus six supporting screens (including shipping address and order detail).
- All requested navigation, UI component, library, test, asset, and configuration files exist.
- TypeScript/TSX *syntax* parsing completed without errors using TypeScript 5.9.
- All local relative imports resolve to existing source files.
- JSON configuration parsed successfully.
- Pure-function smoke checks passed: email validation, password-length validation, minor-unit conversions, currency formatting, account key normalization.
- Expo SDK 58 / React Native 0.88 versions selected according to official Expo documentation. Expo-managed dependency versions must still be checked with `npx expo install --check`.

## Not verified in this environment

- `npm install` failed because registry.npmjs.org DNS/network access is unavailable.
- `npm run typecheck`, `npm test`, and an actual Android/iOS build have not been run with installed packages.
- Phone UI, push notifications, Oracle-backed API, and EAS build have not been tested end-to-end.
- The previously delivered backend has not been confirmed to compile or run as a fully assembled project. A matching running API is required for authenticated features.

## Backend-dependent limitations

- New accounts remain pending verification; there is no completed verification email workflow.
- Password recovery and veterinarian medical notes lack backend endpoints; screens explicitly say so.
- There is no user-specific adoption/sale listing index endpoint; users may need known listing IDs for management.
- Pet marketplace checkout and monetary donations remain disabled pending legal/payment integration.
- Food checkout creates an **unpaid** order with reserved stock; it cannot charge funds.
- Uploaded photos remain quarantined, not publicly viewable.
- Remote push on Android needs a native development build and backend device-token support, not Expo Go alone.

## Release gate

Before public deployment: install dependencies and align versions; run TypeScript, Jest, Expo Doctor and EAS build; complete backend account verification and media review; test physical-device connections; run role/ownership and multi-user API tests; verify payment, stock and booking concurrency against Oracle.
