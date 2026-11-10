# Adoption — web behavior

Public `/adopt` uses published `GET /adoptions`. Public details `/adopt/[id]` use `GET /adoptions/{id}`. Authenticated applications send private care-plan answers to `POST /adoptions/{id}/applications`.

Owners use `/my-adoptions` to create a private draft for an ACTIVE pet, submit the draft for staff review, and review applicant decisions using a saved listing ID. The current API does not expose private listing history, and the web UI intentionally does not fabricate it.

`MATCHED` and `AWAITING_OTHER_PARTY` do not mean ownership has transferred. Both existing owner and accepted adopter must confirm the matched handover; completion is acknowledged only when the backend reports `COMPLETED`.

Validation limits mirror `AdoptionService` and `ModuleRules.Text`: title 1–180 bytes, description 20 chars minimum and 4,000 UTF-8 bytes maximum, general area 1–160 bytes, application answers 10 chars minimum and 4,000 UTF-8 bytes maximum.
