---
name: add-content
description: Add or update editable page content (terms, privacy, FAQ, marketing copy) via the core/content/ system
---

Add page content with slug `$ARGUMENTS`.

## When To Use This (vs. hardcoding)

Use the content system for:
- Legal pages (terms, privacy, cookies, refund policy)
- FAQ entries
- Landing page marketing copy that marketing/legal needs to edit
- Email templates that change without a deploy
- Help center articles

DO NOT use it for:
- UI labels, button text, error messages → those go in code (and are extracted via i18n later)
- Per-user data → that's a domain table
- Files/assets → that's `lib/storage.ts`

## Steps

1. **Decide the slug.** Lowercase, kebab-case, descriptive: `terms-of-service`, `faq-billing`, `landing-hero`. Slugs are unique per locale.

2. **Decide the locale.** Default is `"en"`. Use ISO 639-1 codes (`en`, `tr`, `de`).

3. **Decide the status:**
   - `draft` — invisible to public, admin can preview
   - `published` — visible via `getPublished` channel (public)
   - `archived` — hidden from public AND admin lists by default; preserved for audit

4. **Write the content via admin upsert.** From a script or one-time migration:
   ```ts
   await ctx.runMutation(internal.core.content.contentBusiness.upsert, {
     slug: "terms-of-service",
     locale: "en",
     title: "Terms of Service",
     body: "# Terms of Service\n\n...",  // Markdown
     tag: "legal",
     status: "published",
     updatedBy: ctx.user._id,
   });
   ```

5. **Read the content from the frontend or a public endpoint:**
   ```ts
   // Public read — returns null if not published
   const content = await ctx.runQuery(api.core.content.contentChannel.getPublished, {
     slug: "terms-of-service",
     locale: "en",
   });
   ```

6. **Render markdown safely.** The body is markdown — render it client-side with a sanitized markdown library (e.g. `react-markdown` + `rehype-sanitize`). NEVER `dangerouslySetInnerHTML` raw body.

7. **Run `npm run test:arch`** if you touched any channel/business code.

## Architecture Recap

| Function | Auth | Purpose |
|----------|------|---------|
| `core.content.contentChannel.getPublished` | Public | Get one published doc by slug+locale |
| `core.content.contentChannel.listPublished` | Public | List all published docs for a locale |
| `core.content.contentChannel.adminListAll` | Admin | List all docs (any status) |
| `core.content.contentChannel.adminGetById` | Admin | Get one doc by ID for editing |
| `core.content.contentChannel.upsert` | Admin | Create or update (audit logged) |
| `core.content.contentChannel.setStatus` | Admin | Change publication status (audit logged) |
| `core.content.contentChannel.remove` | Admin + critical | Hard delete (audit logged — PREFER setStatus("archived")) |

## Status Lifecycle

```
draft ──publish──▶ published ──archive──▶ archived
  ▲                    │                      │
  └──unpublish─────────┘                      │
                                              │
              ◀──────── unarchive ────────────┘
```

`publishedAt` is automatically set when status transitions from non-published to `published`. It is NOT updated on subsequent edits — that's `updatedAt`'s job.

## Multi-Locale

Each `(slug, locale)` pair is unique. To add a Turkish version of an English doc:
```ts
await upsert({ slug: "terms-of-service", locale: "tr", title: "...", body: "...", status: "published" });
```

The `getPublished` query falls back to `"en"` if you don't pass a locale. If you want fallback to English when a locale is missing, add it in the business layer (not the channel — channel stays thin).

## Forbidden Patterns

| ❌ DON'T | ✅ DO |
|----------|-------|
| Insert directly with `ctx.db.insert("contents", ...)` | Use `core.content.contentBusiness.upsert` |
| Create per-page tables (`termsOfService`, `privacy`) | One `contents` table, one slug per page |
| Render body with `dangerouslySetInnerHTML` | Use a sanitizing markdown renderer |
| Use `remove` for "soft deletes" | Use `setStatus("archived")` |
| Query the contents table from a domain like `apps/users/` | Cross-domain DB access is forbidden — use `runQuery` |

## Why `core/content/` and not `apps/content/`

Content is infrastructure — it's not a business domain. Like audit, parameter, schedule, and webhook, it's a shared concern any feature can use. That's why it lives under `core/`.
