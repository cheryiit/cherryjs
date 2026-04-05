# Yetkilendirme Sistemi — Genel Bakış

CherryJS'te yetkilendirme üç katmanda çalışır.
Her katman farklı bir soruyu yanıtlar.

---

## Üç Katman

```
┌─────────────────────────────────────────────────────────┐
│  KATMAN 1: Function Wrapper (Authentication + Role)      │
│                                                           │
│  "Bu kullanıcı giriş yapmış mı? Admin mi?"               │
│  → lib/functions.ts'teki wrapper seçimi                   │
└──────────────────────────────┬──────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────┐
│  KATMAN 2: RBAC (Permissions)                            │
│                                                           │
│  "Bu kullanıcının bu işlemi yapma yetkisi var mı?"       │
│  → lib/permissions.ts — Role → Permission mapping        │
└──────────────────────────────┬──────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────┐
│  KATMAN 3: RLS (Row-Level Security)                      │
│                                                           │
│  "Bu kullanıcı bu KAYDA erişebilir mi?"                  │
│  → lib/rls.ts — document-level kontrol                   │
└─────────────────────────────────────────────────────────┘
```

---

## Katman 1: Function Wrapper

En temel katman. Wrapper seçimi = ilk güvenlik kapısı.

| Wrapper | Kim kullanabilir |
|---------|-----------------|
| `publicQuery` | Herkes (auth gerekmez) |
| `publicMutation` | Herkes — dikkatli kullan |
| `authenticatedQuery` | Giriş yapmış, aktif kullanıcı |
| `authenticatedMutation` | Giriş yapmış, aktif kullanıcı |
| `adminQuery` | Admin rolündeki kullanıcı |
| `adminMutation` | Admin rolündeki kullanıcı |

Wrapper, `ctx.user` nesnesini inject eder. Business katmanı bu nesneyi kullanır.

---

## Katman 2: RBAC

Wrapper yeterliyse (örn. `adminMutation` zaten admin kontrolü yapar) RBAC'e
gerek yoktur. RBAC şu durumda devreye girer:

- Aynı endpoint iki farklı role göre farklı sonuç döndürüyorsa
- "Kendi kaydına" vs "başkasının kaydına" erişim ayrımı varsa

```typescript
// business katmanında RBAC kullanımı
export const updateUser = internalMutation({
  args: { targetUserId: v.id("users"), patch: v.object({...}), requestingUserId: v.id("users") },
  handler: async (ctx, { targetUserId, patch, requestingUserId }) => {
    const requestingUser = await getUserById(ctx, requestingUserId);
    if (!requestingUser) throw errors.unauthenticated();

    const isSelf = requestingUser._id === targetUserId;
    const permission = isSelf ? Permission.USERS_UPDATE_OWN : Permission.USERS_UPDATE_ANY;

    if (!hasPermission(requestingUser.role, permission)) {
      throw errors.forbidden();
    }

    await ctx.db.patch(targetUserId, patch);
  },
});
```

---

## Katman 3: RLS

Row-Level Security, `wrapDatabaseReader` ile tüm `ctx.db` okuma operasyonlarını
otomatik olarak filtreler. Açık bırakılmış veri sızıntılarına karşı son savunma hattı.

```typescript
// lib/rls.ts
const rules = {
  trades: {
    read: async (ctx, doc) => {
      if (!ctx.user) return false;
      return doc.userId === ctx.user._id || ctx.user.role === "admin";
    },
  },
};
```

RLS, **query bazında açık/kapalı değildir** — tüm sorgulara otomatik uygulanır.

---

## Hangi Katman Ne Zaman?

| Senaryo | Çözüm |
|---------|-------|
| "Giriş yapılmış mı?" | Wrapper: `authenticatedQuery` |
| "Admin mi?" | Wrapper: `adminMutation` |
| "Kendi kaydı mı, başkasının mı?" | RBAC: `canPerform()` |
| "Silinmiş kayda erişim?" | Business: `isActive` kontrolü |
| "Başkasının trade'ini görebilir mi?" | RLS: `trades.read` kuralı |
| "Sadece public veriler" | Wrapper: `publicQuery` |

---

## Güvenlik Akışı (Tam)

```
Client request
     ↓
[Wrapper] → auth check → active check → ctx.user inject
     ↓
[Channel] → input validation
     ↓
[Business] → RBAC check (gerekirse)
     ↓
[Business → Model] → [RLS] → DB read
     ↓
Response
```

Her katman bir sonraki katmana güvenebilir:
- Business, "user giriş yapmıştır" varsayar (wrapper garanti eder)
- Model, "kullanıcı bu kaydı okuyabilir" varsayar (RLS garanti eder)
