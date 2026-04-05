# Katmanlar — Genel Bakış

Her domain, maksimum 5 katmandan oluşur.
Hangi katmanlar oluşturulur domain'in ihtiyacına göre belirlenir.

---

## Katman Haritası

```
                        ┌─────────────────────┐
                        │      CLIENT          │
                        └──────────┬──────────┘
                                   │ query / mutation
                        ┌──────────▼──────────┐
             ┌──────────│      CHANNEL         │──────────┐
             │          │  (public API kapısı) │          │
             │          └──────────┬──────────┘          │
             │                     │ internal call        │
             │          ┌──────────▼──────────┐          │
             │          │      BUSINESS        │          │
             │          │  (tüm business logic)│          │
             │          └────┬─────────────┬──┘          │
             │               │             │              │
             │    ┌──────────▼──┐    ┌─────▼──────────┐  │
             │    │    MODEL    │    │  INTEGRATION    │  │
             │    │  (db only)  │    │  (3rd party)    │  │
             │    └─────────────┘    └────────────────┘  │
             │                                            │
             └─────── SCHEDULE / BATCH ──────────────────┘
                    (business'ı zamanlanmış çağırır)
```

---

## Katman Varlığı

| Katman | Her domain gerektirir mi? |
|--------|--------------------------|
| channel | Evet — public API olmadan domain'e erişilemez |
| business | Evet — en az bir internalMutation/Query |
| model | Genellikle evet — DB erişimi varsa |
| integration | Hayır — sadece dış API çağrısı varsa |
| schedule | Hayır — sadece zamanlanmış işlem varsa |
| batch | Hayır — sadece büyük veri işlemi varsa |

---

## Katmanlar Arası Çağrı Kuralları

### Channel → Business

```typescript
// ✅ Doğru — internal call ile business'a delege et
handler: async (ctx, args) => {
  return ctx.runMutation(internal.apps.trading.tradingBusiness.createTrade, {
    userId: ctx.user._id,
    ...args,
  });
}

// ❌ Yanlış — channel içinde business logic
handler: async (ctx, args) => {
  const balance = await ctx.db.query("balances")...  // HAYIR
  if (balance < args.amount) throw ...               // HAYIR
}
```

### Business → Model

```typescript
// ✅ Doğru — model'den DB helper kullan
import { getTradeById, listTradesByUser } from "../../model/trade.model";

handler: async (ctx, { userId }) => {
  const trades = await listTradesByUser(ctx, userId);
  // ...
}

// ❌ Yanlış — business'ta raw query
handler: async (ctx, { userId }) => {
  const trades = await ctx.db.query("trades")...  // Model'e ait
}
```

### Business → Integration

```typescript
// ✅ Doğru — action scheduling ile
await ctx.scheduler.runAfter(0, internal.apps.trading.tradingIntegration.submitOrder, {
  tradeId,
});

// ❌ Yanlış — internalMutation'dan doğrudan action çağrısı
await ctx.runAction(...)  // internalMutation'da çalışmaz zaten
```

### Integration → Business (geri yazma)

```typescript
// ✅ Doğru — integration DB'ye runMutation ile yazar
await ctx.runMutation(internal.apps.trading.tradingBusiness.updateOrderStatus, {
  tradeId,
  status: "filled",
});

// ❌ Yanlış — integration doğrudan DB'ye yazar
await ctx.db.patch(tradeId, { status: "filled" });  // HAYIR
```

---

## Hangi Katmanda Hata Fırlatılır?

| Katman | Hata Fırlatır? | Ne Tür? |
|--------|----------------|---------|
| model | **Hayır** — null döner | — |
| business | **Evet** — business rule ihlalleri | `errors.*` |
| channel | **Nadiren** — sadece input validasyonu | `errors.validation()` |
| integration | **Evet** — dış API hataları | `errors.internal()` veya özel |

---

## Katman Dosyası Boyutu Kılavuzu

| Katman | Max satır (handler başına) | Max dosya |
|--------|---------------------------|-----------|
| channel | 20 satır | 150 satır |
| business | 50 satır | 300 satır |
| model | 10 satır | 150 satır |
| integration | 80 satır | 200 satır |
| schedule | 15 satır | 100 satır |
| batch | 50 satır | 200 satır |

Bu limitler aşıldığında domain'i bölmeyi veya yardımcı fonksiyon çıkarmayı düşün.
