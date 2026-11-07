---
sidebar_position: 2
title: Versioning
---

# Versioning

Every resource lives under a version. Two equivalent forms:

```bash
# In the URL
curl http://localhost:3001/api/v1/health

# In a header
curl -H "X-API-Version: 1" http://localhost:3001/api/health
```

- The header form is rewritten to the URL form before routing, so both reach the same handler.
- If both are present they must agree: `/api/v1/...` with `X-API-Version: 2` is rejected.
- Without a version, or with an unsupported one, the API answers
  `400 API_VERSION_UNSUPPORTED`.
- Versioned responses echo the version in an `X-API-Version` header.

The supported versions are `1`. The documentation (`/api/docs`, `/api/docs-json`) is not
versioned.
