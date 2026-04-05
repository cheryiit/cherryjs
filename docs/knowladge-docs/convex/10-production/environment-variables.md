# Convex Environment Variables

Kaynak: https://docs.convex.dev/production/environment-variables

## Temel Kullanim

```typescript
// Convex fonksiyonlarinda
const apiKey = process.env.OPENAI_API_KEY;
const isDev = process.env.NODE_ENV === "development";
```

## Yonetim

### Dashboard'dan
Convex Dashboard → Settings → Environment Variables

### CLI'dan
```bash
# Listele
npx convex env list

# Degeri gör
npx convex env get OPENAI_API_KEY

# Ekle/Guncelle
npx convex env set OPENAI_API_KEY sk-...

# Sil
npx convex env remove OPENAI_API_KEY
```

## Kurallar

| Kural | Deger |
|-------|-------|
| Max adet | 100 |
| Isim max uzunluk | 40 karakter |
| Isim formatı | Harf ile baslar, harf/rakam/alt cizgi |
| Deger max boyutu | 8KB |

## Sistem Degiskenleri (Her Zaman Mevcut)

```typescript
process.env.CONVEX_CLOUD_URL  // Convex backend URL
process.env.CONVEX_SITE_URL   // HTTP Actions URL
```

## Dev vs Production

```bash
# Development deployment icin
npx convex env set STRIPE_KEY sk_test_...

# Production deployment icin (--prod flag)
npx convex env set STRIPE_KEY sk_live_... --prod
```

## Onemli Uyari

```typescript
// ❌ Yanlis — Function export'larini env'e gore sartlandirama
if (process.env.FEATURE_FLAG === "true") {
  export const myFunction = query({ ... }); // CALISMIYOR
}

// ✅ Dogru — Env'i handler icinde kullan
export const myFunction = query({
  handler: async (ctx) => {
    if (process.env.FEATURE_FLAG === "true") {
      // Feature logic
    }
  },
});
```

## .env.local (Frontend)

```bash
# .env.local — client'a gönderilen değerler
VITE_CONVEX_URL=https://project.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# Server-side only (Convex functions)
# Bunlar Convex dashboard'a eklenir, .env'e değil
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_...
```

## Yaygin Kullanim

```typescript
// AI servisi
export const generateText = action({
  args: { prompt: v.string() },
  handler: async (ctx, { prompt }) => {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    return response.json();
  },
});

// Email servisi
export const sendEmail = action({
  args: { to: v.string(), subject: v.string(), html: v.string() },
  handler: async (ctx, args) => {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "noreply@example.com",
        ...args,
      }),
    });
  },
});
```
