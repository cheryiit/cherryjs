# Convex File Storage

Kaynak: https://docs.convex.dev/file-storage

## Desteklenen Yuklemeler

| Yontem | Boyut Limiti | Kullanim |
|--------|-------------|---------|
| Upload URL | Sinırsız (2dk timeout) | Buyuk dosyalar |
| HTTP Action | 20MB | Kucuk dosyalar |

## Upload URL Yontemi (Onerilen)

### 3 Adim:

```typescript
// ADIM 1: Mutation ile upload URL uret
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED" });
    
    // URL 1 saat gecerli
    return ctx.storage.generateUploadUrl();
  },
});

// ADIM 2: Client'ta dosyayi yukle
const uploadFile = async (file: File) => {
  // Upload URL al
  const uploadUrl = await generateUploadUrl();
  
  // Dosyayi direkt yukle
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  
  const { storageId } = await response.json();
  return storageId; // Id<"_storage">
};

// ADIM 3: Storage ID'yi kaydet
export const saveFileRecord = mutation({
  args: {
    storageId: v.id("_storage"),
    name: v.string(),
    type: v.string(),
  },
  handler: async (ctx, { storageId, name, type }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED" });
    
    return ctx.db.insert("files", {
      storageId,
      name,
      type,
      uploadedBy: identity.subject,
    });
  },
});
```

## Dosya URL'i Servisi

```typescript
// Query ile URL uret
export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    return ctx.storage.getUrl(storageId); // string | null
  },
});

// React'ta kullanim
function FilePreview({ storageId }: { storageId: Id<"_storage"> }) {
  const url = useQuery(api.files.getFileUrl, { storageId });
  
  if (!url) return null;
  return <img src={url} alt="Uploaded file" />;
}
```

## Dosya Silme

```typescript
export const deleteFile = mutation({
  args: { 
    fileId: v.id("files"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { fileId, storageId }) => {
    // Ownership kontrolü
    const file = await ctx.db.get(fileId);
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || file?.uploadedBy !== identity.subject) {
      throw new ConvexError({ code: "UNAUTHORIZED" });
    }
    
    // Hem storage hem DB kaydı sil
    await ctx.storage.delete(storageId);
    await ctx.db.delete("files", fileId);
  },
});
```

## Schema Ornegi

```typescript
// schema.ts
files: defineTable({
  storageId: v.id("_storage"),
  name: v.string(),
  type: v.string(),                    // MIME type
  size: v.optional(v.number()),        // bytes
  uploadedBy: v.string(),              // tokenIdentifier
  entityId: v.optional(v.string()),    // iliskili entity
  entityType: v.optional(v.string()),  // "post", "profile", etc.
})
  .index("by_uploader", ["uploadedBy"])
  .index("by_entity", ["entityId"]),
```

## React Component Ornegi

```typescript
function FileUpload({ onUpload }: { onUpload: (storageId: string) => void }) {
  const generateUrl = useMutation(api.files.generateUploadUrl);
  const saveFile = useMutation(api.files.saveFileRecord);
  const [uploading, setUploading] = useState(false);
  
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const uploadUrl = await generateUrl();
      
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      
      const { storageId } = await res.json();
      
      await saveFile({ storageId, name: file.name, type: file.type });
      onUpload(storageId);
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <input
      type="file"
      onChange={handleUpload}
      disabled={uploading}
    />
  );
}
```
