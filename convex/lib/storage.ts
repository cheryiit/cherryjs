// @ts-nocheck — `_generated/api.d.ts` regenerates after `npx convex dev`
// runs once with the new component installed.
//
// Cloudflare R2 storage via @convex-dev/r2 component.
//
// The component owns its own metadata table in an isolated namespace
// (`components.r2.*`) and manages presigned URL generation through its
// own pre-configured S3Client. We expose a thin wrapper here so the rest
// of the framework imports `lib/storage` (one stable name) instead of the
// raw component, identical to how `lib/polar` and `lib/email` work.
//
// Required environment variables (set via `npx convex env set ...`):
//   - R2_BUCKET             — bucket name (e.g. "cherryjs-prod")
//   - R2_ENDPOINT           — Cloudflare R2 endpoint URL
//   - R2_ACCESS_KEY_ID      — R2 API token access key
//   - R2_SECRET_ACCESS_KEY  — R2 API token secret
//
// USAGE
//
// 1. Generate an upload URL the client can PUT to (channel mutation):
//
//      import { r2 } from "../../lib/storage";
//      export const startUpload = normalMutation({
//        args: {},
//        handler: async () => {
//          return r2.generateUploadUrl();   // → { url, key }
//        },
//      });
//
// 2. Get a signed serving URL (any context):
//
//      const url = await r2.getUrl(key, { expiresIn: 900 });
//
// 3. Delete an object (mutation context):
//
//      await r2.deleteObject(ctx, key);
//
// 4. List/inspect metadata:
//
//      const meta = await r2.getMetadata(ctx, key);
//      const page = await r2.listMetadata(ctx, 50);
//
// The R2 instance also exposes `r2.clientApi({ ... })` to expose the
// upload-URL generator and metadata APIs as PUBLIC convex functions
// without writing wrapper code yourself. See `r2.clientApi()` docs.
import { R2 } from "@convex-dev/r2";
import { components } from "../_generated/api";

export const r2 = new R2(components.r2);
