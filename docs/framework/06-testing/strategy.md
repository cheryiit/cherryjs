# Test Stratejisi

---

## Test Piramidi

```
             /\
            /  \
           / E2E \         ← Az, yavaş, yüksek güven (Playwright)
          /________\
         /          \
        / Integration \    ← Channel layer end-to-end (convex-test)
       /______________\
      /                \
     /   Business Unit  \  ← Her internalMutation/Query (convex-test) ← ÇOĞUNLUK
    /____________________\
   /                      \
  /   Architectural Tests  \ ← Dosya yapısı, import, naming (Vitest, pure TS)
 /________________________\
```

---

## Test Türleri

### 1. Architectural Tests

**Ne test eder:** Kod yapısı — dosya yerleri, import kuralları, naming, katman disiplini
**Framework:** Vitest (Convex gerekmez — saf dosya okuma)
**Ne zaman çalışır:** Her commit, CI'da PR'da
**Nerede:** `tests/architecture.test.ts`

```typescript
// Örnek: channel'ın ham builder import etmediğini kontrol et
test("channel dosyaları ham Convex builder import etmemeli", () => {
  for (const file of channelFiles) {
    const content = readFileSync(file, "utf-8");
    expect(content).not.toMatch(/from ".*_generated\/server".*query|mutation/);
  }
});
```

**Coverage gereksinimi:** %100 — structural kural yoktur, ya var ya yok.

---

### 2. Business Unit Tests

**Ne test eder:** `internalMutation` ve `internalQuery` fonksiyonları
**Framework:** convex-test (`@convex-dev/testing`)
**Nerede:** `convex/apps/{domain}/{domain}.business.test.ts`

Her business fonksiyonu için:
- ✅ Happy path
- ✅ Not found (kaynak yoksa)
- ✅ Unauthorized / forbidden (yetki yoksa)
- ✅ Business rule violations (state machine, unique constraint, vb.)

```typescript
// convex/apps/trading/trading.business.test.ts
import { convexTest } from "convex-test";
import { describe, test, expect, beforeEach } from "vitest";
import schema from "../../schema";
import { internal } from "../../_generated/api";

describe("tradingBusiness.createTrade", () => {
  test("başarılı trade oluşturur", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { /* ... */ });
      const tradeId = await ctx.runMutation(
        internal.apps.trading.tradingBusiness.createTrade,
        { userId, symbol: "AAPL", side: "buy", quantity: 10 }
      );
      const trade = await ctx.db.get(tradeId);
      expect(trade?.status).toBe("pending");
    });
  });

  test("aynı sembol için açık trade varsa CONFLICT hatası", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { /* ... */ });
      await ctx.db.insert("trades", {
        userId, symbol: "AAPL", status: "pending", /* ... */
      });
      await expect(
        ctx.runMutation(internal.apps.trading.tradingBusiness.createTrade, {
          userId, symbol: "AAPL", side: "buy", quantity: 5,
        })
      ).rejects.toMatchObject({ data: { code: "CONFLICT" } });
    });
  });
});
```

**Coverage gereksinimi:** Her public business fonksiyonu için minimum 2 test.

---

### 3. Integration Tests (Channel)

**Ne test eder:** Channel fonksiyonları — auth wrapper'ı dahil uçtan uca
**Framework:** convex-test (auth mock desteği var)
**Nerede:** `convex/apps/{domain}/{domain}.channel.test.ts`

```typescript
// convex/apps/trading/trading.channel.test.ts
test("listMine: authenticated olmayan kullanıcı UNAUTHENTICATED hatası alır", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    // Auth olmadan çağır
    await expect(
      ctx.query(api.apps.trading.tradingChannel.listMine, {})
    ).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
  });
});

test("listMine: kullanıcı sadece kendi trade'lerini görür", async () => {
  const t = convexTest(schema);
  await t.withIdentity({ tokenIdentifier: "user1" }).run(async (ctx) => {
    // user1 ve user2 trade'leri oluştur
    // listMine'ı çağır — sadece user1'inkiler gelmeli
  });
});
```

---

### 4. E2E Tests (Playwright)

**Ne test eder:** Tarayıcı üzerinden tam kullanıcı akışları
**Framework:** Playwright
**Nerede:** `e2e/`
**Ne zaman:** Release öncesi, nightly CI

Critical path'ler için: Giriş, temel CRUD, ödeme akışı (varsa).

---

## Test Dosyası Konvansiyonu

| Test türü | Dosya | Konumu |
|-----------|-------|--------|
| Architectural | `architecture.test.ts` | `tests/` |
| Business unit | `{domain}.business.test.ts` | `convex/apps/{domain}/` |
| Channel integration | `{domain}.channel.test.ts` | `convex/apps/{domain}/` |
| E2E | `{flow}.spec.ts` | `e2e/` |

---

## CI Pipeline

```yaml
# Her PR
- pnpm typecheck          # TypeScript compile kontrolü
- pnpm test               # Architectural + business unit testler
- pnpm test:channel       # Channel integration testler

# Release branch
- pnpm test:e2e           # E2E testler
```

---

## Test Coverage Hedefleri

| Katman | Minimum Coverage |
|--------|-----------------|
| Architectural tests | %100 (her kural test edilmeli) |
| Business mutations | %80 branch coverage |
| Business queries | %70 branch coverage |
| Channel layer | Critical path'ler (happy + auth error) |

Coverage tool: `vitest --coverage`

---

## Mock Politikası

| Ne | Mock? |
|----|-------|
| Convex DB | **Hayır** — convex-test gerçek DB gibi çalışır |
| Auth (Clerk) | **Evet** — `t.withIdentity()` ile |
| External API | **Evet** — integration testlerde `fetch` mock |
| Convex scheduler | **Hayır** — convex-test scheduler'ı kapsar |

```typescript
// Auth mock örneği
const t = convexTest(schema);
await t
  .withIdentity({ tokenIdentifier: "user:123", name: "Test User" })
  .run(async (ctx) => { ... });
```
