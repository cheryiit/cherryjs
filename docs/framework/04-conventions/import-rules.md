# Import Kuralları

Import graph'ı enforce edilir.
Architectural test bu kuralları kod olarak kontrol eder.

---

## Backend Import Kuralları

### Katman Bazında İzin Verilen Import'lar

#### channel.ts

```typescript
// ✅ İzin verilen
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { paginationOptsValidator } from "convex/server";
import {
  publicQuery,
  authenticatedQuery,
  authenticatedMutation,
  adminQuery,
  adminMutation,
} from "../../lib/functions";
import type { Id, Doc } from "../../_generated/dataModel";

// ❌ Yasak
import { query, mutation } from "../../_generated/server";     // ham builder
import { internalMutation } from "../../_generated/server";    // internal — channel değil
import { errors } from "../../lib/errors";                     // business'a ait
import { getTradeById } from "../../model/trade.model";        // business bypass
import * from "../other-domain/other.business";                // cross-domain
```

#### business.ts

```typescript
// ✅ İzin verilen
import { internalMutation, internalQuery } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import { errors } from "../../lib/errors";
import { hasPermission, Permission } from "../../lib/permissions";
import { getTradeById, listTradesByUser } from "../../model/trade.model";
import type { Id, Doc } from "../../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../../_generated/server";

// ❌ Yasak
import { query, mutation, action } from "../../_generated/server";  // public builder
import { authenticatedMutation } from "../../lib/functions";        // channel'a ait
import * from "../other-domain/other.channel";                      // cross-domain channel
```

#### integration.ts

```typescript
// ✅ İzin verilen
import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import { errors } from "../../lib/errors";
import type { Id } from "../../_generated/dataModel";

// ❌ Yasak
import { internalMutation } from "../../_generated/server";  // integration sadece action
import * from "../../model/trade.model";                     // model direkt erişim yok
// ctx.db KULLANAMAZ — integration'da db yoktur
```

#### model.ts

```typescript
// ✅ İzin verilen
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";

// ❌ Yasak
import { errors } from "../lib/errors";    // model hata fırlatmaz
import { v } from "convex/values";         // model validator kullanmaz (helpers hariç)
import * from "../apps/**";               // apps'i model import edemez
```

---

## Frontend Import Kuralları

### Katman Bazında İzin Verilen Import'lar

#### routes/ (Route dosyaları)

```typescript
// ✅ İzin verilen
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../convex/_generated/api";
import { SomeDomainComponent } from "../../features/{domain}/components/SomeDomainComponent";

// ❌ Yasak
import { useState } from "react";          // state route'a ait değil
import { someBusinessLogic } from "...";   // route'ta logic yok
// Inline JSX yazmak — component features/'ta olmalı
```

#### features/{domain}/hooks/

```typescript
// ✅ İzin verilen
import { useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useMutation as useConvexMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id, Doc } from "../../../convex/_generated/dataModel";

// ❌ Yasak — hook diğer domain'in hook'unu import etmez
import { useOtherDomainData } from "../../other-domain/hooks/...";
// Bunun yerine: her hook kendi query'sini çağırır
```

#### features/{domain}/components/

```typescript
// ✅ İzin verilen
import { useMyTrades } from "../hooks/useMyTrades";           // kendi hook'u
import { TradeCard } from "./TradeCard";                      // kendi component'i
import { Button } from "../../../components/ui/Button";       // shared ui
import { formatCurrency } from "../../../utils/format";       // shared utils
import type { Trade } from "../types";                        // kendi tipler

// ❌ Yasak
import { convexQuery } from "@convex-dev/react-query";       // hook'ta olmalı
import { api } from "../../../convex/_generated/api";        // hook'ta olmalı
import { useOtherDomainComponent } from "../../other-domain"; // cross-domain component
```

---

## Cross-Domain Kuralları

Backend'de domainler arası doğrudan erişim yasaktır:

```typescript
// ❌ trading.business.ts — users domain DB'sine doğrudan erişim
const user = await ctx.db.query("users")...;  // YASAK

// ✅ Doğrusu — internal API üzerinden
const user = await ctx.runQuery(
  internal.apps.users.usersBusiness.getUserById,
  { userId }
);
```

Frontend'de domainler arası hook çağrısı:

```typescript
// ✅ Bir component birden fazla feature hook'unu kullanabilir
// (Bu cross-domain DEĞİL, sadece composition)
function DashboardSummary() {
  const { data: trades } = useMyTrades();     // trading feature
  const { data: user } = useCurrentUser();   // users feature
  return ...;
}
```

Component-to-component cross-domain import'u:

```typescript
// ❌ Yasak — domain A'nın component'i domain B'nin component'ini import etmez
import { TradingWidget } from "../trading/components/TradingWidget";
// Bunun yerine, ortak bir component oluştur: components/widgets/TradingWidget.tsx
```

---

## Architectural Test

Bu kuralların tamamı `tests/architecture.test.ts` ile kod olarak enforce edilir.
CI'da her PR'da çalışır.

```typescript
describe("Channel katmanı: raw builder import yasak", () => {
  const channelFiles = glob("convex/apps/**/*.channel.ts");
  for (const file of channelFiles) {
    it(`${file} ham builder import etmemeli`, () => {
      const content = readFileSync(file, "utf-8");
      expect(content).not.toMatch(/import.*\{ (query|mutation|action) \}.*_generated\/server/);
    });
  }
});
```
