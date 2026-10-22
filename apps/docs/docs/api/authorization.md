---
sidebar_position: 4
title: Authorization and access log
---

# Authorization and access log

## Roles

| Role     | Who                                                                      |
| -------- | ------------------------------------------------------------------------ |
| `owner`  | Owns the records of their pets.                                          |
| `clinic` | Staff of a clinic; accesses only pets whose owner granted it permission. |
| `admin`  | Verifies clinics. Never accesses pets. Created only by a server script.  |

## A single decision point

Every service that touches a pet's data first calls `PermissionsService.authorize` with one of
four operations:

| Operation                                                                 | Pet owner | Clinic with active permission |
| ------------------------------------------------------------------------- | --------- | ----------------------------- |
| `read`: profile, record, schedule                                         | ✓         | ✓                             |
| `medical_act`: consultations, vaccinations, dewormings, treatments, exams | —         | ✓                             |
| `day_to_day`: weight and feeding                                          | ✓         | —                             |
| `administer`: edit the pet, permissions, access log                       | ✓         | —                             |

When it cannot:

| Case                                                              | Status |
| ----------------------------------------------------------------- | ------ |
| Clinic without an active, full permission on the pet              | `403`  |
| Owner trying to record a medical act                              | `403`  |
| Clinic trying to record the day to day or administer              | `403`  |
| Admin on any pet endpoint                                         | `403`  |
| Owner asking for someone else's pet, or a pet that does not exist | `404`  |

The `404` is intentional: someone who is not the owner is never told that the pet exists.

Who signs a medical act is never taken from the request: the clinic comes from the permission and
the veterinarian from the token.

:::note
Hiding a button is not authorization. The web only avoids showing what the API would deny; the
decision is always the API's.
:::

## Permissions

| Endpoint                                              | What it does                                                                        |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `GET /pets/:petId/permissions`                        | Clinics with access, active and revoked.                                            |
| `POST /pets/:petId/permissions`                       | Grants access with a clinic's link code. See [Clinic linking](./clinic-linking.md). |
| `POST /pets/:petId/permissions/:permissionId/revoke`  | Cuts access on the next request (permissions are not cached).                       |
| `POST /pets/:petId/permissions/:permissionId/restore` | Gives a previously linked, still verified clinic its access back.                   |

| Scope       | Allows                                         |
| ----------- | ---------------------------------------------- |
| `full`      | Reading the record and recording medical acts. |
| `card_only` | Only vaccine validity, through the card.       |

## Access log

A global interceptor writes to `access_logs` on every request to a route with `:petId`, so no
endpoint depends on remembering to log, and the response waits until the entry is stored.

- **Denied attempts** (`403`) are logged as `access_denied`, so the owner sees who tried.
- **Listings** are logged per pet: a clinic's `GET /pets` writes `list_patients` and its
  `GET /alerts` writes `view_alerts` for each patient.
- **Reads are deduplicated**: the same user, action and pet within five minutes is logged once,
  so repeating a request cannot bury the owner's log. Writes are never deduplicated.

`GET /pets/:petId/access-log` (owner only) is paginated (`limit`, `cursor`, newest first) and
accepts `actor=others` to hide the owner's own actions:

| Action                                                                                                             | Means                                                   |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `view_pet`, `view_record`, `view_vaccination`                                                                      | Reading the profile, record or schedule                 |
| `list_patients`, `view_alerts`                                                                                     | A clinic listed its patients or checked their schedules |
| `access_denied`                                                                                                    | Someone without permission tried                        |
| `record_consultation`, `record_vaccination`, `record_deworming`, `record_treatment`, `record_exam`                 | Medical acts                                            |
| `record_weight`, `record_feeding`                                                                                  | The owner's day to day                                  |
| `grant_permission`, `revoke_permission`, `restore_permission`, `view_permissions`, `view_access_log`, `update_pet` | Owner administration                                    |
