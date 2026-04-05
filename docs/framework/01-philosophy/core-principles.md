# Temel Prensipler

CherryJS'in her mimari kararının arkasında şu prensipler yatar.
Bir şeyin neden böyle yapıldığını anlamak için buraya bak.

---

## 1. Domain İzolasyonu

Her domain kendi tabloları, kendi business logic'i, kendi testleriyle bir ada gibi yaşar.
Domainler birbirinin DB'sine **doğrudan erişmez** — yalnızca birbirinin channel API'sini çağırır.

```
✅ trading.business.ts → ctx.runMutation(internal.apps.users.usersBusiness.getUser, ...)
❌ trading.business.ts → ctx.db.query("users")...
```

**Neden:** Domain A'nın query'si domain B'nin schema değişikliğiyle kırılmaması için.
Domain boundaries, codebase büyüdükçe refactor edilebilirliği korur.

---

## 2. Katman Disiplini

Her dosyanın tek bir sorumluluğu vardır. Katman sınırları **ihlal edilemez**:

```
channel   →  public API kapısı — business logic YOKTUR
business  →  tüm if-else, tüm kurallar — buraya aittir
model     →  ham DB operasyonları — auth, logic YOKTUR
integration → dış dünya — DB YOKTUR
```

**Neden:** AI ile hızlı kodlarken en büyük risk logic'in katmanlar arası sızmasıdır.
"Bunu channel'da halledelim" birikim yaparak test edilemeyen, bakımı imkânsız kod üretir.

---

## 3. Internal by Default

Yeni bir fonksiyon yazarken varsayılan `internalMutation` / `internalQuery`'dir.
Bunu public yapmak için bilinçli karar gerekir → channel layer'a alınır.

**Neden:** Convex'te public fonksiyonlar client'tan doğrudan çağrılabilir.
İstenmeyen erişim kapılarını kapatmanın en güvenli yolu her şeyi internal başlatmaktır.

---

## 4. Schema Kontrat'tır

`convex/schema.ts` tek gerçek kaynaktır.
Tablo tanımı, alan tipleri, index'ler buradan yönetilir.
Başka hiçbir dosya "bu tablo şu alanlara sahiptir" varsayımında bulunamaz —
her zaman `DataModel` ve `Doc<"tableName">` tiplerini kullanır.

**Neden:** Schema değişince compiler hata verir, runtime sürpriz olmaz.

---

## 5. Hata Taksonomisi

`throw new Error(...)` yasaktır — `apps/` ve `lib/` dizinlerinde hiç görünmez.
Tüm hatalar `errors.*` factory'den gelir ve `ErrorCode` enum'unu taşır.

```typescript
// ❌ Yasak
throw new Error("User not found");

// ✅ Zorunlu
throw errors.notFound("User");
```

**Neden:** Client'ta `isAppError(e) && e.data.code === ErrorCode.NOT_FOUND` şeklinde
tip-güvenli hata yönetimi yapılabilmesi için. Jenerik `Error` mesajları üzerinden
programatik karar vermek imkânsızdır.

---

## 6. Sıfır Ham Builder (apps/ içinde)

`convex/apps/` altındaki hiçbir dosya `query`, `mutation`, `action`'ı
doğrudan `_generated/server`'dan import edemez.
Tüm fonksiyonlar `lib/functions.ts`'teki approved wrapper'lardan biri olmalıdır.

```typescript
// ❌ Yasak — apps/ içinde
import { mutation } from "../_generated/server";
export const updateUser = mutation({ ... });

// ✅ Zorunlu
import { authenticatedMutation } from "../../lib/functions";
export const updateUser = authenticatedMutation({ ... });
```

**Neden:** Her public fonksiyon otomatik olarak auth + active check geçer.
Bunu unutmak mümkün değildir çünkü wrapper seçimi zorunludur.
Architectural test bunu enforce eder.

---

## 7. Fail Fast, Trust Internal

Validasyon **sistem sınırlarında** yapılır (channel layer, HTTP webhooks).
Business layer bir değeri aldığında geçerli olduğunu varsayar — tekrar kontrol etmez.

```typescript
// channel.ts — sınırda validasyon
export const updateProfile = authenticatedMutation({
  args: { name: v.string(), bio: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // args burada garantili geçerli
    return ctx.runMutation(internal.apps.users.usersBusiness.updateProfile, {
      userId: ctx.user._id, ...args
    });
  },
});

// usersBusiness.ts — validation TEKRAR YOKTUR
export const updateProfile = internalMutation({
  args: { userId: v.id("users"), name: v.string(), bio: v.optional(v.string()) },
  handler: async (ctx, { userId, name, bio }) => {
    // userId'nin gerçek bir user'a ait olduğunu varsayıyoruz — channel'da kontrol edildi
    await ctx.db.patch(userId, { name, bio });
  },
});
```

**Neden:** Double-validation kodu şişirir, yavaşlatır ve bakımı zorlaştırır.
Convex'in type system'ı internal fonksiyonlarda da argument tiplerini enforce eder.

---

## 8. Kompozisyon > İnheritance

Framework extension noktaları inheritance değil kompozisyon kullanır.
`customQuery`/`customMutation` chain'i ile yeni wrapper katmanları eklenir.
`Triggers` sınıfı ile side effect'ler kompoze edilir.

---

## Özetle

| Kural | Neden |
|-------|-------|
| Domain izolasyonu | Refactor edilebilirlik |
| Katman disiplini | Test edilebilirlik |
| Internal by default | Güvenlik |
| Schema kontrat | Tip güvenliği |
| Hata taksonomisi | Client-side programatik handling |
| Sıfır ham builder | Auth unutulamaz |
| Fail fast | Performans + okunabilirlik |
