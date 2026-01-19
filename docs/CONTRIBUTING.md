# Contributing Guide — WSO API Platform

This document defines **the one and only workflow** for building endpoints in this repo.
Any contributor must follow it to avoid breaking the platform contracts, responses, and Postman tests.

---

## 1) Project Principles (Non-negotiable)

### 1.1 One contract for all services
All services must follow the same API contract:

- Global prefix: `/api/v1`
- Unified response shape:
  - Success: `success: true`
  - Error: `success: false` + `error` object
  - Always include `meta.timestamp`
- Unified error handling via `GlobalExceptionFilter`

### 1.2 No “random” responses
Do not return raw NestJS default errors.
All errors must be shaped by the global filter.

### 1.3 Postman is part of the deliverable
Every endpoint MUST ship with Postman requests:
- ✅ a success request
- ❌ at least one failure request

If Postman JSON is missing, the endpoint is considered **unfinished**.

---

## 2) Repo Structure (Monorepo)

