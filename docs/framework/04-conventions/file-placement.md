# Dosya Yerleştirme Kararı

Yeni bir dosya oluştururken bu karar ağacını kullan.
Her dosyanın tek, doğru bir yeri vardır.

---

## Backend — Karar Ağacı

```
Yeni bir .ts dosyası oluşturacaksın.

1. Tablo tanımı veya field listesi mi?
   → convex/schema.ts  (tek dosya — asla başka yerde)

2. Saf DB erişim helper'ı mı? (auth yok, logic yok)
   → convex/model/{entity}.model.ts

3. Framework altyapısı mı? (wrapper, error, permission, rls)
   → convex/lib/{concern}.ts

4. Client'tan çağrılabilecek mi? (public query/mutation)
   → convex/apps/{domain}/{domain}.channel.ts

5. Server-to-server business logic mi? (internalMutation/Query)
   → convex/apps/{domain}/{domain}.business.ts

6. Dış API çağrısı mı? (fetch, SDK)
   → convex/apps/{domain}/{domain}.integration.ts

7. Zamanlanmış/periyodik mi? (cron, scheduled)
   → convex/apps/{domain}/{domain}.schedule.ts

8. Büyük veri işleme mi? (100+ kayıt, paginated)
   → convex/apps/{domain}/{domain}.batch.ts

9. HTTP endpoint veya webhook mi?
   → convex/http.ts  (Hono sub-router ile)

10. Test dosyası mı?
    → convex/apps/{domain}/{domain}.{layer}.test.ts
```

---

## Frontend — Karar Ağacı

```
Yeni bir .tsx veya .ts dosyası oluşturacaksın.

1. URL path'i temsil ediyor mu?
   → app/routes/{path}.tsx  (TanStack router convention)

2. Auth gerektiren sayfalar için layout mı?
   → app/routes/_authenticated.tsx  (tek dosya)

3. Domain'e özgü React component mi?
   → app/features/{domain}/components/{ComponentName}.tsx

4. Domain'e özgü hook mu? (Convex query/mutation wrapper)
   → app/features/{domain}/hooks/use{Name}.ts

5. Domain'e özgü TypeScript tipi mi?
   → app/features/{domain}/types.ts

6. Herhangi bir domain'den bağımsız UI atom/molecule mi?
   (Button, Input, Card, Dialog gibi)
   → app/components/ui/{ComponentName}.tsx

7. App shell component'i mi? (Header, Sidebar, Layout)
   → app/components/layout/{ComponentName}.tsx

8. Convex client setup, auth setup gibi altyapı mı?
   → app/lib/{concern}.ts  (convex.ts, auth.tsx)

9. Saf utility fonksiyon mu? (format, parse, calculate)
   → app/utils/{concern}.ts  (format.ts, validation.ts)

10. Router factory veya entry point mi?
    → app/router.tsx | app/client.tsx | app/ssr.tsx
```

---

## Domain Belirleme

Bir feature hangi domain'e ait?

```
Sorunlar:
1. Kendi DB tablosu var mı?           → yeni domain
2. Mevcut bir domain'in sub-özelliği mi? → o domain'e ekle
3. İki domain'e eşit oranda ait mi?   → bağımlı olduğu domain (veya yeni ortak domain)
```

### Örnek Kararlar

| Feature | Domain | Neden |
|---------|--------|-------|
| Trade oluşturma | `trading` | Trades tablosuna sahip |
| Trade bildirimi | `notifications` | Notification domain'i trigger ile dinler |
| Trade geçmişi | `trading` | Trade verisinin view'ı |
| Kullanıcı profili | `users` | Users tablosunun parçası |
| Ödeme işlemi | `payments` | Ayrı domain (ayrı tablo) |
| Para yatırma | `payments` | Payments domain'inin sub-özelliği |

---

## Çakışan Karar Örnekleri

### "Bu util mi, model mi?"

```
Eğer ctx.db alıyorsa → MODEL
Eğer ctx almıyorsa   → UTILS
```

### "Bu business mı, channel mi?"

```
if-else içeriyorsa                  → BUSINESS
db.query() içeriyorsa               → BUSINESS  
sadece internal çağrısı yapıyorsa   → CHANNEL
20 satırı aşıyorsa                  → BUSINESS'a taşı
```

### "Bu integration mı, business mı?"

```
fetch() veya SDK çağrısı var mı?    → INTEGRATION
sadece Convex DB + scheduler?       → BUSINESS
```

### "Bu feature components mi, ui components mi?"

```
domain kelimesi geçiyor mu?         → features/{domain}/components/
herhangi bir component'te kullanılabilir mi? → components/ui/
```

---

## Klasör Açma Kararı

Yeni bir `apps/{domain}/` klasörü ne zaman açılır?

```
Kendi DB tablosu var    AND
En az 3 public fonksiyonu var  AND
Başka domain'in alt özelliği değil
```

Tüm koşullar sağlanıyorsa yeni domain klasörü aç.
Aksi halde mevcut bir domain'e ekle.

---

## Anti-Pattern: Ne Zaman Yanlış Yere Konur?

| Durum | Sıkça Yapılan Hata | Doğrusu |
|-------|--------------------|---------|
| Hızlı fix | `convex/utils.ts` açmak | `convex/lib/` veya `convex/model/` |
| Küçük helper | `convex/apps/trading/helpers.ts` | model'e veya business'a entegre et |
| Shared logic | Her domain'e kopyalamak | `convex/model/` shared helper |
| Form validation | Route dosyasına yazmak | `app/utils/validation.ts` |
| Type definition | Her yere inline yazmak | `features/{domain}/types.ts` |
