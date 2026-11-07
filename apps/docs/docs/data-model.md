---
sidebar_position: 5
title: Data model
---

# Data model

PostgreSQL with Prisma; source of truth `apps/api/prisma/schema.prisma`. Tables: `users`,
`refresh_sessions`, `clinics` (with `verified`), `clinic_staff`, `clinic_link_codes`, `pets`,
`consultations`, `vaccinations`, `dewormings`, `treatments`, `exams`, `weight_entries`,
`feeding_entries`, `vaccination_rules`, `permissions`, `access_logs` (append-only),
`reminders`, `anomalies`. The migration `english_names` renamed the original Spanish model
without data loss.
