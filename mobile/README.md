# PawCare Mobile (Expo SDK 58 / React Native 0.88)

PawCare mobile is an Android/iOS client of the existing **Oracle-backed ASP.NET Core 10** API. It has role-aware navigation for pet owners, veterinarians and administrators, plus public adoption, marketplace, lost/found and food-catalog browsing.

## Requirements

- Node.js 22.13+ (or another version supported by Expo SDK 58).
- A working PawCare ASP.NET Core API with Oracle V001–V012 already migrated.
- An Android phone for local testing. A simulator/emulator is optional, not required.
- Same trusted Wi-Fi network for your phone and PC if you use local HTTP.

## Setup (Windows PowerShell)

```powershell
cd PawCare\mobile
Copy-Item .env.example .env
# Update EXPO_PUBLIC_API_URL with the current PC IPv4 address, e.g. http://192.168.1.30:5080
npm install
npx expo install --fix
npm run typecheck
npm test
npx expo start --clear
```

For a physical phone, **do not use** `10.0.2.2` (Android emulator gateway), `localhost`, or `127.0.0.1` as the backend IP. Start the trusted development API so it listens on the PC LAN interface and configure a Private-network firewall rule. Example for a verified, approved development environment:

```powershell
# from backend/PawCare.Api
# Use the compiled DLL if your Windows Application Control policy blocks the generated EXE.
dotnet .\bin\Debug\net10.0\PawCare.Api.dll --urls "http://0.0.0.0:5080"
```

Check `http://<PC-IP>:5080/api/health` from the Android phone browser. Scan the Metro QR code in Expo Go if SDK 58 is supported there; otherwise install a suitable Expo **development build** using EAS.

## Build

Configure your actual unique Android package and iOS bundle identifier in `app.json`, replace `extra.eas.projectId` after registering the EAS project, then run `eas build --profile preview --platform android` to obtain a development APK. Push notifications on Android require a development build and native credentials; Expo Go does not support remote pushes in this configuration.

## Security and limitations

- The app stores JWT access and rotating refresh tokens in Expo SecureStore; no bearer tokens in AsyncStorage.
- Only the **public** adoption, sale, lost/found and food catalog lists use offline caching (max 24 h). Cached results are labeled stale. Never cache medical records, account credentials, addresses or private sightings in plain storage.
- New registrations remain `PENDING_VERIFICATION` until the API implements email verification/activation. Password-reset endpoint and veterinary medical-note endpoint are not yet present; their screens explicitly explain that.
- Adoption handovers require dual confirmation. Public lost-pet posts never reveal precise locations. Pet sales are inquiries only; live animal sales completion is disabled.
- Food checkout creates **unpaid** orders and reserves stock. No money is charged until an audited payment provider is integrated. Never mark an order paid on the client.
- Uploaded media is stored in private quarantine pending moderation and malware scanning, so the app does not falsely display them as published assets.
- Data models and REST endpoints are mapped to the PawCare backend feature-module source. Some admin listing/management APIs are incomplete and require separate backend development.
- Public `.env` values are bundled in the app. Do not put secrets in EXPO_PUBLIC_* keys. Production must use HTTPS.

## Structure

- `src/navigation/`: role-based root stack + owner tabs
- `src/screens/`: requested feature screens + shared list/detail/form components
- `src/components/`: reusable controls and cards
- `src/lib/`: API, auth, validation, cache, date/money utilities
- `assets/`: generated icon, splash and pet placeholder
- `tests/`: basic component and domain safety tests

## Validation

The generated code can be statically parsed and checked for local imports. A **real** Expo build, dependency installation, device UI tests and authenticated Oracle-backed E2E tests are required before deployment. Run `npx expo-doctor`, `npm run typecheck` and `npm test` on a machine with access to npm.
