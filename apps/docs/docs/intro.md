---
slug: /
sidebar_position: 1
title: Vetify
---

<p className="etiqueta">Technical documentation</p>

# Vetify

**A shared clinical record for pets.** The record belongs to the owner, not to the clinic: the
owner feeds it with the day to day (weight, feeding, observations) and the clinics they grant
access record the medical acts (consultations, vaccinations, treatments, exams). It is unique,
portable and follows the animal for life.

This site documents how it is built and how to use the API.

## What is here

| Section                                       | For                                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [Getting started](./getting-started.md)       | Run the database, API and web locally.                                                                  |
| [Architecture](./architecture.md)             | How responsibilities are split across the monorepo.                                                     |
| [API](./api/conventions.md)                   | Conventions, versioning, authentication, authorization, clinic linking, record, vaccination and errors. |
| [Security](./security.md)                     | The security model and the audit it was hardened against.                                               |
| [API reference](pathname:///referencia)       | Every endpoint with its schemas, generated from the code.                                               |
| [Data model](./data-model.md)                 | The tables and how they relate.                                                                         |
| [Adding an endpoint](./adding-an-endpoint.md) | The full path, from contract to documentation.                                                          |

## The rule everything rests on

:::info A clinic accesses a pet only through an active permission granted by the owner.

- It is enforced **in the API**, in a single place, on every request.
- It is **revocable**: the owner removes it and the clinic loses access on the next request.
- It is **logged**: every access records who, what and when.
- It is **granted in person**: the owner types a link code that a **verified** clinic shows them.

:::

The product's user interface is in Spanish (it targets Costa Rica); code, API and this
documentation are in English.

Course project for EIF409 Global Computing Applications, Universidad Nacional, Brunca campus,
second term 2026. Team: Francisco Mora Cabezas and Alejandro León Marín.
