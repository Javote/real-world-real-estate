# 2 · API

> Milestone 3 evidence, item 2: *"API docs + test reports with coverage/outcomes (e.g., Postman
> collection)."*

## What is in this folder

| File | What it is |
|---|---|
| [`openapi/propnexus.openapi.json`](openapi/propnexus.openapi.json) | OpenAPI 3.1 document of the API: 91 operations, each with its method, path, required authorization (role and per-project access rule) and, where the route validates with Zod, the real request and response schemas |
| [`postman/propnexus.postman_collection.json`](postman/propnexus.postman_collection.json) | The same API as a Postman collection (v2.1), grouped by resource, with example bodies for the main flows (login, create project, create stage, upload evidence, accept an invitation, transition a stage) |

Both files are **generated from the mounted router, not written by hand**
(`pnpm --filter @plataforma/api docs:openapi` and `docs:api`), and a test fails if the committed
files do not match the code. They cannot drift from what the API actually does.

To use the Postman collection, import it and set the `baseUrl` variable (for example
`https://propnexus-api.onrender.com`) and the `token` variable (from `POST /api/v1/auth/login`).

## Covered elsewhere

- **Test reports with coverage and outcomes:** the same report as item 1,
  [`../1-repo-ci-tests/test-report.md`](../1-repo-ci-tests/test-report.md). The web app's
  `ApiPort` is also tested against this OpenAPI document.

## Status

| Part | Status |
|---|---|
| API docs (OpenAPI + Postman) | ✅ |
| Test reports with coverage/outcomes | ✅ (item 1) |
