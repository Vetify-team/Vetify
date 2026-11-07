---
sidebar_position: 7
title: Vaccination and alerts
---

# Vaccination and alerts

`GET /api/v1/pets/:petId/vaccination-status` crosses the country's schedule (`vaccination_rules`)
with the applied vaccines and the pet's age. Statuses: `valid`, `expiring` (≤ 30 days),
`expired`, `due`, `not_yet_due`. It also returns `coverage` and the latest deworming per kind.

`GET /api/v1/alerts` aggregates overdue and upcoming doses for every visible pet, overdue first.
"Today" is the date in Costa Rica.
