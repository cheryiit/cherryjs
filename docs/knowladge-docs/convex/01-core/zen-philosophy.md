# The Zen of Convex — Tasarım Felsefesi

Kaynak: https://docs.convex.dev/understanding/zen

## Temel Felsefe

Convex, geliştiricileri **"başarı çukuruna"** yönlendiren opinionated bir framework'tür. En iyi pratikler doğal olarak daha iyi sonuçlara götürür.

---

## Performans Prensipleri

### 1. Sync Engine Merkezde
Deterministik, reaktif veritabanı Convex'in temelidir.
- Daha anlaşılır kod
- Daha hızlı performans
- Consistency sorunları ortadan kalkar

### 2. Okuma için Query, Her Zaman
Neredeyse her uygulama okuması için `query` kullan:
- Reaktiflik
- Otomatik caching
- Consistency
- Veri yayılımında resilience

### 3. Lightweight Transactions
Mutation ve query'ler:
- **Birkaç yüz kayıttan fazlasını işlememeli**
- **100ms içinde tamamlanmalı**

### 4. Action'ları Dikkatli Kullan
Actions:
- Batch işleme ve external servis entegrasyonu için idealdir
- Daha yavaş, daha pahalı
- Query/mutation kadar güvencesi yok
- Sparingly kullan

### 5. Client-Side Basitliği Koru
Convex'in built-in caching ve consistency kontrollerini kullan:
- Custom state management katmanları ekleme
- Framework çoğu senaryoyu zaten halleder

---

## Mimari Prensipler

### Framework'ü Kodla İnşa Et
- Authentication sistemleri ve ORM'leri standart TypeScript ile yaz
- Framework güncellemesi bekleme

### Intentional Action Workflows
Browser'dan doğrudan action çağırma:

```
// ❌ Anti-pattern
await callAction(api.actions.processPayment, data);

// ✅ Doğru pattern
// 1. Mutation intent kaydeder
await callMutation(api.payments.initiatePayment, data);
// 2. Mutation background action schedule eder
// 3. Action tamamlanınca mutation result kaydeder
```

**Zincir**: `action → mutation → action → mutation`

### Adımlı İlerleme Kaydı
- Küçük batch'lerde işle
- Her adımı mutation ile kaydet
- Bu sayede:
  - Debug edilebilir
  - Devam ettirilebilir (resumable)
  - UI'da incremental feedback mümkün

---

## Geliştirme Workflow'u

### Dashboard'ı Temel Araç Olarak Gör
Convex dashboard:
- Logging
- Function testing
- Configuration inspection
- Schema generation

### Topluluktan Yararlan
- [Stack](https://stack.convex.dev) — blog & patterns
- [Discord](https://convex.dev/community)
- Kanıtlanmış mimari çözümler için önce toplulukta ara

---

## Framework'ümüze Yansıması

| Zen Prensibi | Framework Kuralı |
|---|---|
| Lightweight transactions | Model fonksiyonları 100ms hedefi |
| Query-centric reads | Her public okuma `query` ile |
| Intentional workflows | Actions sadece internal schedule ile |
| Progressive recording | Batch mutations progress kaydeder |
| Auth in code | Her public mutation'da `ctx.auth` check |
