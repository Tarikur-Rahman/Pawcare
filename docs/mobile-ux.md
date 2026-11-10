# PawCare — Mobile UX Specification

> **Status:** design and implementation contract; screens not yet built.  
> **Stack:** React Native + Expo 58 + TypeScript, `App.tsx` entry point with React Navigation.  
> **Target:** Android and iOS; verify on a **real Android device** before release.

## 1. UX outcomes

A user must be able to (a) understand the next care task at a glance, (b) open a pet's medical history quickly, (c) find adoption/sale/lost-and-found/food without confusion, and (d) complete consequential actions with explicit review and confirmation. Vet and administrator experiences appear only when their permissions allow them.

**The five primary owner tabs** are `Home | My Pets | Explore | Care | Account`. Explore has distinct `Adopt`, `Marketplace`, `Lost & Found`, and `Food Store` categories. Bookings and expenses are reachable through Home, My Pets or Care; they do not need to occupy bottom-tab space. An Add (+) entry opens permitted quick actions.

## 2. Screen inventory and source paths

| Surface / entry | Proposed screens | Main actions |
| --- | --- | --- |
| Auth | `src/screens/auth/{LoginScreen,RegisterScreen,ResetPasswordScreen}.tsx` | Sign in/register, forgot password, optional verified contact |
| Home | `src/screens/home/{DashboardScreen,NotificationsScreen}.tsx` | Daily summary, overdue care, next visit, alerts |
| My Pets | `src/screens/pets/{PetsScreen,PetDetailsScreen,EditPetScreen,HealthTimelineScreen}.tsx` | View/add/edit own pet; attach verified records |
| Care | `src/screens/care/{CareScreen,TaskEditorScreen,ReminderSettingsScreen}.tsx` | Complete/skip/schedule care; opt-in reminders |
| Visits | `src/screens/visits/{VisitsScreen,VetDirectoryScreen,BookVisitScreen}.tsx` | Request/reschedule/cancel visit; follow-ups |
| Expenses | `src/screens/expenses/ExpensesScreen.tsx` | Record costs, filter by pet/category/date |
| Explore hub | `src/screens/explore/ExploreScreen.tsx` | Choose Adopt / Marketplace / Lost & Found / Food Store |
| Adoption | `src/screens/adoption/{AdoptionListScreen,AdoptionDetailsScreen,CreateAdoptionScreen,MyApplicationsScreen}.tsx` | Browse/create/apply, decision, coordinated handover |
| Marketplace | `src/screens/marketplace/{MarketplaceScreen,SaleDetailsScreen,CreateSaleListingScreen,MySaleListingsScreen}.tsx` | Approved animal posts, inquiries, saved listings, handover status |
| Lost/found | `src/screens/lostfound/{LostFoundScreen,LostReportDetailsScreen,CreateLostReportScreen,SightingScreen}.tsx` | Public approximate location, secure sighting, verification |
| Food store | `src/screens/shop/{FoodStoreScreen,ProductDetailsScreen,CartScreen,CheckoutScreen,OrdersScreen}.tsx` | Browse, cart, delivery, checkout and track food orders |
| Account | `src/screens/account/{AccountScreen,EditProfileScreen,SettingsScreen}.tsx` | Personal settings, contacts/privacy, sign out |
| Vet | `src/screens/vet/{VetQueueScreen,VisitNotesScreen}.tsx` | Assigned queue, review permitted records, visit notes |
| Admin | `src/screens/admin/{AdminDashboardScreen,ModerationScreen}.tsx` | Safe review queue, approval decisions, abuse handling |

**Mapping:** use `src/navigation/{RootNavigator,OwnerTabs,VetNavigator,AdminNavigator}.tsx`; components in `src/components`; API/auth/theme/storage in `src/lib`. Do not switch to Expo Router silently because the agreed blueprint uses `App.tsx`.

## 3. Design system

| Token | Specification |
| --- | --- |
| Identity | PawCare paw mark, calm warm pet-care imagery; avoid threatening emergency visuals |
| Base | `#0B1523` midnight; surfaces `#10203A` navy; accents `#009B8A` teal, `#63D6B7` mint |
| Text | Light `#F8FAFC` with tested secondary-text contrast; errors must not rely on color alone |
| Typography | System fonts; 12/14/16/20/28/36px semantic scale; support dynamic type |
| Space | Base 4px; 8/12/16/24/32 increments; 12–16px card radius |
| Touch | Target at least ~44×44 dp/pt; comfortable spacing, no tiny close buttons |
| Motion | Short purposeful transitions ~150–250ms; honor reduced-motion setting |
| Icons | Always pair ambiguous icons with labels; active bottom tab has text + icon |
| Pictures | Responsive crop, alt/accessibility labels, skeleton placeholders; never use photos as sole proof of authenticity |

Create shared theme token exports under `mobile/src/lib/theme/tokens.ts` based on `packages/design-tokens`. Expose `Button`, `Input`, `LoadingSkeleton`, `EmptyState`, `ErrorBanner`, `StatusBadge`, `PhotoPicker` and accessible modal/bottom-sheet primitives. Semantic statuses must remain readable in dark mode.

## 4. Primary screens and information hierarchy

### Home

1. Header: greeting, selected pet switcher, notifications and profile shortcut.
2. Today's care: due/overdue tasks with **Mark done**, **Skip** and **View** actions.
3. Upcoming vet visit: date/time zone, location/format, confirmation state and reschedule.
4. Relevant reminders: next vaccine/medication; avoid alarmist language.
5. Contextual one-tap `+ Add` action. Content below fold: expenses summary, Explore entry and education.

### Pet detail

- Cover photo, name, species, breed, age (if known), responsible owner.
- Segments: **Overview | Health | Care | Visits | Expenses | Documents**.
- Health timeline in chronological order with provenance and author; medical information must indicate who entered it and when.
- Clear controls for editing, consented sharing with assigned vet, and pet ownership transfer; do not publish a pet automatically when creating an adoption or sale post.

### Explore

Use a category switcher with visible labels. **Adopt** should not be visually confused with **Buy**. Cards show only approved content, safe approximate region, animal basics, verification status and the next available action. Filter by approved species, approximate area, age group and posting recency. Include useful no-results states.

### Food store

Product cards show food category, age suitability when documented, unit/weight, price, stock indication and clear image. Product detail includes ingredients/allergens where provided, delivery terms, seller/operator identity and return conditions. Checkout displays item totals, shipping cost, taxes where applicable, final amount and estimated delivery **before** order confirmation. Do not interpret pet-food information as veterinary advice.

## 5. Critical journeys

### Adoption

`Explore → Adopt → Listing → Apply → Application submitted → Await decision → Approved/matched → Arrange safe in-person handover → Both confirm → Completed`.

- An application is not an adoption confirmation.
- Keep the poster's private address, phone and proof documents hidden from anonymous users and other applicants.
- `Apply` needs clear eligibility/privacy statement; applicant can view their own application status.
- Transfer of an existing `PETS` record occurs **only** when backend checks are satisfied, never on button tap alone.

### Marketplace

`Explore → Marketplace → Listing → Ask seller / Request reservation → Safe handover → Confirm with evidence → Completed`.

- Show *lawful, approved listings only*; suppress rejected/removed listings from discovery.
- Seller approval badge must reflect actual verification state, not self-asserted text.
- Do not show shipping options for live animals. Do not auto-route animal sales through the food-store cart.

### Lost/found

`Explore → Lost & Found → Create report (lost/found) → General area + photos → Public post → Private sighting → Verify privately → Reunion`.

- Never reveal precise home coordinates or finder address. Strip photo GPS metadata.
- Show approximate region/radius; proof is submitted privately.
- A claim is not publicly marked verified until the backend authorizes resolution.

### Food purchase

`Explore → Food Store → Product → Cart → Shipping address → Review charges → Place order → Payment state → Order tracking`.

- Double tap on **Place order** must not create two orders; disable action during pending request and use idempotency key.
- A payment pending state is distinct from paid/success.
- Show clear retry instructions on network loss; never assume payment failed solely because a response timed out.

### Vet

`Vet Queue → Assigned appointment → Authorized history → Notes → Complete visit → Follow-up instruction`.

- Vet sees only assigned/consented records, not other users' pets by searching an ID.

## 6. Loading, offline, error and accessibility states

| State | Mobile treatment | Never do |
| --- | --- | --- |
| Loading | Layout-preserving skeleton; text `Loading…` for screen reader | Infinite spinner without explanation |
| Empty | Relevant description + primary action | Pretend sample data are real pets |
| Form invalid | Field-level message and focus/scroll to first error | Error only as red border |
| No API / timeout | “Connection unavailable. Check your connection and retry.” | Show `10.0.2.2`, `192.168...`, SQL or stack traces |
| Offline read | Mark last sync time and read-only cached records | Permit unverified transaction while disconnected |
| Unauthorized | Attempt safe session refresh; then sign-in prompt | Infinite retry loop |
| Conflicting update | Explain record changed; refresh and offer safe reapply | Silent overwrite |
| Upload failure | Preserve draft, show retry/cancel | Lose photo and form contents |
| Payment pending | Check status using order ID | Place another order by default |

Use accessible field labels, announcements for status changes, 200%+ text scaling where feasible, color-contrast validation, keyboard avoidance, screen-reader item descriptions and safe-area insets. Test with real Android accessibility services.

## 7. Physical-device networking and secure configuration

- Use `.env` for `EXPO_PUBLIC_API_URL`. For a real phone, `localhost` and `10.0.2.2` are incorrect addresses for the PC's API. The mobile URL is generally `http://<PC-LAN-IP>:5080/api/v1` for **trusted local development only** when backend binds to a reachable interface.
- The physical phone and PC must be on the same permitted LAN; check `/api/health` from phone browser and firewall rules on a **Private** network. Never turn off application-control policy or firewall globally.
- For production use an HTTPS API domain, not a development LAN IP. `EXPO_PUBLIC_*` values are bundled into client JS and **must not contain secrets**.
- Use `expo start --clear` to refresh env changes if bundler retains stale values. Don't store JWTs in AsyncStorage; use platform secure storage.
- Remote push, sensitive native permissions, camera and production app-signing must be tested in an appropriate development/standalone build, not assumed from an Expo Go preview.

## 8. Mobile acceptance criteria

- [ ] Role-specific navigation hides unauthorised actions; backend independently denies them.
- [ ] Home opens pet context and a care task in ≤3 deliberate taps from Home.
- [ ] Real Android login and API health pass over an actual network.
- [ ] Adoption and marketplace listings are clearly distinguishable and moderation-controlled.
- [ ] Lost/found content never reveals exact private locations.
- [ ] Cart totals and order state match backend confirmation.
- [ ] Dynamic type, focus, screen reader, keyboard and dark-mode checks pass.
- [ ] Every primary route handles loading, empty, offline, expired-token and API failure.

See [web-ux.md](web-ux.md), [api-contracts.md](api-contracts.md), [permissions-matrix.md](permissions-matrix.md) and [acceptance-tests.md](acceptance-tests.md).
