---
sidebar_position: 6
title: Record
---

# Record

| Who                              | Records      | Routes (`POST /api/v1/pets/:petId/…`)                                |
| -------------------------------- | ------------ | -------------------------------------------------------------------- |
| Clinic with an active permission | Medical acts | `consultations`, `vaccinations`, `dewormings`, `treatments`, `exams` |
| Owner                            | Day to day   | `weights`, `feedings`                                                |

Both read the history with `GET /api/v1/pets/:petId/record`, which also returns the names of the
clinics and veterinarians in that page. Pets: `GET/POST /pets`, `GET/PATCH /pets/:petId`.
A vaccination without `expiresOn` gets the expiry from the schedule.

## History pagination

The initial response contains up to 50 entries of each section, newest first. `limit` can be
between 1 and 100. Sections with older entries have a UUID cursor in `nextCursors`:

```json
{ "nextCursors": { "consultations": "<last-entry-uuid>" } }
```

Fetch the next page with:

```text
GET /api/v1/pets/:petId/record?section=consultations&cursor=<last-entry-uuid>&limit=50
```

Only that section is populated; other history arrays are empty. Append its entries and merge
the page's clinic/veterinarian names by ID. Replace that section's cursor, or remove it when
the next response omits it. A cursor requires a section and is scoped to the authorized pet.
Date ties are ordered by ID so pages do not skip or duplicate entries. History entries are
immutable; newly added entries appear on a fresh first-page request.

Sections are `consultations`, `vaccinations`, `dewormings`, `treatments`, `exams`, `weightEntries`
and `feedingEntries`. The web provides controls to load older pages. Weight graphs sort the
loaded entries chronologically. Vaccination status and alerts use latest-dose queries over the
full history, independent of how many history pages the browser has loaded.
