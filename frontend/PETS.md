# Owner pet management

Routes: `/pets` (directory and creation), `/pets/[id]` (details, health history, editing, archiving).

The pages are behind the existing OWNER-only server layout, backed by the ASP.NET Core 10 API through the same-origin relay and HTTP-only authentication cookies. No new API endpoints or migrations were added.

| UI action | Existing API | Behavior |
| --- | --- | --- |
| List | `GET /api/v1/pets` | Active pets owned by the signed-in user |
| Details | `GET /api/v1/pets/{id}` | Owner-scoped pet profile |
| Create | `POST /api/v1/pets` | Requires name, species and sex (`MALE`, `FEMALE`, `UNKNOWN`) |
| Update | `PATCH /api/v1/pets/{id}` | Updates name, breed, birth date and existing attributes JSON |
| Archive | `DELETE /api/v1/pets/{id}` | Soft archive, blocked by active listing locks |
| History | `GET /api/v1/pets/{id}/medical` | Existing vaccination/medication history |

The backend's `PetEdit` contract replaces `dateOfBirth` and `attributesJson` when patching. The frontend therefore preserves the existing JSON attribute string and birthday unless the user changes the birthday. Species and sex are read-only on edit, matching the API.

No pet is physically deleted by the archive button; the API changes the status to `ARCHIVED`. Owners cannot archive a pet associated with an active listing.

To test: `npm ci`, `npm run typecheck`, `npm test`, `npm run build` from `frontend/`, then start backend + frontend and sign in as an owner. New UI-focused tests are in `tests/pets.test.tsx`.
