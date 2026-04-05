# Convex Testing

Kaynak: https://docs.convex.dev/testing

## Yaklasimlar

| Yaklasim | Araç | Hiz | Gercekcilik |
|----------|------|-----|-------------|
| convex-test (unit) | Vitest | Cok hizli | Simule |
| Local backend | Real Convex | Yavas | Tam |
| Preview deployment | Convex Cloud | Yavas | Tam |

## convex-test Kurulumu

```bash
pnpm add -D convex-test vitest
```

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
  },
});
```

## Temel Test Yazimi

```typescript
// convex/tests/tasks.test.ts
import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach } from "vitest";
import schema from "../schema";
import { api, internal } from "../_generated/api";

describe("Tasks", () => {
  let t: ReturnType<typeof convexTest>;
  
  beforeEach(() => {
    t = convexTest(schema);
  });
  
  test("create task", async () => {
    const taskId = await t.mutation(api.tasks.create, {
      title: "Test Task",
      priority: "medium",
    });
    
    expect(taskId).toBeDefined();
  });
  
  test("get task", async () => {
    const taskId = await t.mutation(api.tasks.create, {
      title: "My Task",
      priority: "high",
    });
    
    const task = await t.query(api.tasks.get, { taskId });
    
    expect(task).toMatchObject({
      title: "My Task",
      priority: "high",
      completed: false,
    });
  });
  
  test("unauthorized access throws", async () => {
    await expect(
      t.mutation(api.tasks.create, { title: "Test", priority: "low" })
    ).rejects.toThrow("UNAUTHENTICATED");
  });
});
```

## Authentication ile Test

```typescript
// Kimlikli istek
const identity = {
  subject: "user_123",
  tokenIdentifier: "clerk|user_123",
  issuer: "https://clerk.dev",
  email: "test@example.com",
};

test("authenticated user can create task", async () => {
  await t.run(async (ctx) => {
    // Identity set et
    t.setIdentity(identity);
    
    const taskId = await t.mutation(api.tasks.create, {
      title: "Authenticated Task",
      priority: "high",
    });
    
    expect(taskId).toBeDefined();
  });
});
```

## Internal Function Test

```typescript
test("internal cleanup runs correctly", async () => {
  // Once data olustur
  await t.run(async (ctx) => {
    await ctx.db.insert("sessions", {
      token: "expired-token",
      expiresAt: Date.now() - 1000,
    });
  });
  
  // Internal function calistir
  await t.mutation(internal.cleanup.expiredSessions, {});
  
  // Sonucu dogrula
  const sessions = await t.query(internal.sessions.getAll, {});
  expect(sessions).toHaveLength(0);
});
```

## Scheduled Function Test

```typescript
test("scheduled email is sent", async () => {
  await t.mutation(api.users.register, {
    email: "user@test.com",
    name: "Test User",
  });
  
  // Zamanlanmis fonksiyonlari calistir
  await t.finishAllScheduledFunctions(vi.runAllTimersAsync);
  
  // Email gonderildi mi dogrula
  const emails = await t.query(internal.emails.getSent, {});
  expect(emails).toHaveLength(1);
  expect(emails[0].to).toBe("user@test.com");
});
```

## Architectural Tests

```typescript
// convex/tests/architectural.test.ts
import { describe, test, expect } from "vitest";
import * as functions from "../functions/posts";

describe("Architectural Rules", () => {
  test("all public mutations have argument validators", () => {
    for (const [name, fn] of Object.entries(functions)) {
      if (fn.isPublic && fn.type === "mutation") {
        expect(fn.args, `${name} must have args validator`).toBeDefined();
      }
    }
  });
  
  test("no direct throw new Error (must use ConvexError)", async () => {
    // Source code analizi ile kontrol
    // ...
  });
});
```

## CI/CD Entegrasyonu

```yaml
# .github/workflows/test.yml
name: Test Convex Functions

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: pnpm install
      - run: pnpm test
      - run: npx convex deploy --cmd "pnpm build"
        env:
          CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}
```

## Test Best Practices

1. **Herbir test izole** — `beforeEach` ile fresh `convexTest` instance
2. **Internal functions test et** — sadece public API test etme
3. **Error cases kapsayi** — unhappy path testleri yaz
4. **Auth boundary'leri test et** — unauthenticated/unauthorized durumlar
5. **Scheduled functions test et** — `finishAllScheduledFunctions` ile
