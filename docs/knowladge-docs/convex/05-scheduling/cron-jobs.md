# Convex Cron Jobs

Kaynak: https://docs.convex.dev/scheduling/cron-jobs

## Nedir?

Periyodik olarak calistirilan zamanlanmis fonksiyonlar. `convex/crons.ts` dosyasinda tanimlanir.

## Temel Yapi

```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Interval — saniye/dakika/saat cinsinden
crons.interval(
  "cleanup-expired-sessions",  // unique isim
  { hours: 24 },               // her 24 saatte bir
  internal.cleanup.expiredSessions,
  {}
);

// Cron syntax — UTC timezone
crons.cron(
  "monthly-report",
  "0 9 1 * *",  // Her ayın 1'inde 09:00 UTC
  internal.reports.generateMonthly,
  {}
);

// Gunluk shortcut
crons.daily(
  "daily-digest",
  { hourUTC: 7, minuteUTC: 0 },  // Her gun 07:00 UTC
  internal.emails.sendDailyDigest,
  {}
);

// Saatlik shortcut
crons.hourly(
  "sync-data",
  { minuteUTC: 30 },  // Her saatin 30. dakikasinda
  internal.sync.externalData,
  {}
);

// Haftalik shortcut
crons.weekly(
  "weekly-cleanup",
  { dayOfWeek: "monday", hourUTC: 3, minuteUTC: 0 },
  internal.cleanup.oldData,
  {}
);

// Aylik shortcut
crons.monthly(
  "monthly-billing",
  { day: 1, hourUTC: 0, minuteUTC: 0 },
  internal.billing.processSubscriptions,
  {}
);

export default crons;
```

## Cron Syntax

```
"dakika saat gunOfAy ay gunOfHafta"

Ornekler:
"0 * * * *"     — Her saatin basinda
"0 9 * * 1"     — Her Pazartesi 09:00
"0 16 1 * *"    — Her ayin 1'inde 16:00
"*/15 * * * *"  — Her 15 dakikada
"0 0 * * 1-5"   — Hafta ici gece yarisi
```

## Arguman Gecirme

```typescript
crons.daily(
  "sync-premium-users",
  { hourUTC: 2, minuteUTC: 0 },
  internal.sync.usersByTier,
  { tier: "premium" }  // sabit argümanlar
);
```

## Onemli Notlar

1. **UTC timezone** — Tüm zamanlar UTC cinsinden
2. **Tek concurrent execution** — Onceki calisma bitmemisse sonraki atlanabilir
3. **Sadece mutations ve actions** — Query'ler cron olarak kullanilamaz
4. **Dashboard'dan izleme** — Cron gecmisi ve durumu goruntülenebilir

## Pratik Kullanim Ornekleri

```typescript
// 1. Suresi dolan token'lari temizle
crons.hourly(
  "cleanup-tokens",
  { minuteUTC: 0 },
  internal.auth.cleanupExpiredTokens,
  {}
);

// 2. Gunluk istatistik hesapla
crons.daily(
  "compute-daily-stats",
  { hourUTC: 1, minuteUTC: 0 },
  internal.analytics.computeDailyStats,
  {}
);

// 3. External API senkronizasyonu
crons.interval(
  "sync-external",
  { minutes: 30 },
  internal.sync.fetchExternalData,
  {}
);

// 4. Database cleanup
crons.weekly(
  "archive-old-data",
  { dayOfWeek: "sunday", hourUTC: 3, minuteUTC: 0 },
  internal.archive.oldRecords,
  {}
);
```

## Dashboard Izleme

Convex Dashboard → Schedules → Cron Jobs:
- Aktif cron'lari goruntule
- Son calisma zamanları
- Hata loglari
- Manuel tetikleme (test icin)
