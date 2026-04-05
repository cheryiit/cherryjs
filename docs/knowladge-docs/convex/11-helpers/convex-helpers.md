# convex-helpers

Kaynak: https://github.com/get-convex/convex-helpers

## Kurulum

```bash
pnpm add convex-helpers
```

## Kategoriler

### 1. Custom Functions (Middleware)

```typescript
import { customQuery, customMutation, customAction } from "convex-helpers/server/customFunctions";
```

Detaylar → `11-helpers/custom-functions.md`

### 2. Relationship Helpers

```typescript
import {
  getOneFrom,
  getOneFromOrThrow,
  getManyFrom,
  getManyVia,
  getManyViaOrThrow,
  getAll,
  getAllOrThrow,
} from "convex-helpers/server/relationships";
```

Detaylar → `11-helpers/relationships.md`

### 3. Zod Validation

```typescript
import { zCustomQuery, zCustomMutation } from "convex-helpers/server/zod";
import { zid } from "convex-helpers/server/zod";
```

Detaylar → `11-helpers/zod-validation.md`

### 4. HTTP Router with Hono

```typescript
import { HonoWithConvex, HttpRouterWithHono } from "convex-helpers/server/hono";
```

Detaylar → `11-helpers/hono-http.md`

### 5. Row-Level Security (RLS)

```typescript
import {
  wrapDatabaseReader,
  wrapDatabaseWriter,
  Rules,
} from "convex-helpers/server/rowLevelSecurity";
```

### 6. CRUD Utilities

```typescript
import { crud } from "convex-helpers/server/crud";

// Otomatik CRUD fonksiyonlari olustur
const { create, read, update, destroy } = crud(schema, "posts");
```

### 7. Sessions

```typescript
import { SessionProvider } from "convex-helpers/react/sessions";
import { useSessionQuery, useSessionMutation } from "convex-helpers/react/sessions";
```

Auth gerektirmeyen oturum yonetimi (client-side storage).

### 8. Richer useQuery

```typescript
import { useQuery } from "convex-helpers/react";

// { status: "success" | "pending" | "error", data, error }
const { status, data, error } = useQuery(api.posts.list, {});
```

`undefined` yerine structured status.

### 9. Rate Limiting

```typescript
import { RateLimiter, MINUTE } from "convex-helpers/server/rateLimit";

const rateLimiter = new RateLimiter(components.rateLimiter, {
  login: { kind: "fixed window", rate: 10, period: MINUTE },
});
```

**Not:** Artik `@convex-dev/rate-limiter` componenti tercih edilir.

### 10. Action Retries

```typescript
import { ActionRetrier } from "convex-helpers/server/retries";
```

**Not:** Artik `@convex-dev/action-retrier` componenti tercih edilir.

### 11. Migrations

```typescript
import { migration } from "convex-helpers/server/migrations";
```

**Not:** Artik `@convex-dev/migrations` componenti tercih edilir.

### 12. Validator Utilities

```typescript
import { partial, pick, omit } from "convex-helpers/validators";

// Object validator utilities
const patchUser = partial(userFields);
const publicUser = pick(userFields, ["name", "email"]);
```

### 13. OpenAPI

```typescript
import { generateOpenApiSpec } from "convex-helpers/server/openApi";
```

HTTP routes icin OpenAPI spec uretimi.

### 14. CORS Support

```typescript
import { corsRouter } from "convex-helpers/server/cors";
```

## Paket Yapisi

```
convex-helpers/
├── server/
│   ├── customFunctions.ts    # Middleware pattern
│   ├── relationships.ts      # DB relationship helpers
│   ├── rowLevelSecurity.ts   # RLS implementation
│   ├── crud.ts               # CRUD utilities
│   ├── zod.ts                # Zod integration
│   ├── hono.ts               # Hono HTTP routing
│   ├── rateLimit.ts          # Rate limiting
│   ├── retries.ts            # Action retries
│   ├── migrations.ts         # Data migrations
│   ├── validators.ts         # Validator utilities
│   └── openApi.ts            # OpenAPI generation
└── react/
    ├── index.ts              # richer useQuery/useMutation
    └── sessions.ts           # Session management
```
