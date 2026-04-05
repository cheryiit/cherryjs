# Convex Vector Search

Kaynak: https://docs.convex.dev/search/vector-search

## Nedir?

Sayisal vektörler üzerinden benzerlik aramasi. AI uygulamalari, öneri sistemleri ve semantic search icin idealdir.

**Similarity metric:** Cosine similarity

## Vector Index Tanımı

```typescript
// schema.ts
documents: defineTable({
  content: v.string(),
  embedding: v.array(v.float64()),  // vektör alanı
  authorId: v.id("users"),
  category: v.string(),
})
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,            // OpenAI text-embedding-3-small
    filterFields: ["category"],  // Hızlı filtreleme
  }),
```

## Ortak Embedding Boyutlari

| Model | Dimensions |
|-------|-----------|
| OpenAI text-embedding-3-small | 1536 |
| OpenAI text-embedding-3-large | 3072 |
| OpenAI text-embedding-ada-002 | 1536 |
| Cohere embed-v3 | 1024 |

## Vektör Arama

Vector search sadece **action** icerisinde calisir:

```typescript
export const semanticSearch = action({
  args: {
    query: v.string(),
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { query, category, limit = 10 }) => {
    // 1. Query'den embedding uret
    const embedding = await generateEmbedding(query);
    
    // 2. Vector search yap
    const results = await ctx.vectorSearch("documents", "by_embedding", {
      vector: embedding,
      limit,
      filter: category
        ? (q) => q.eq("category", category)
        : undefined,
    });
    
    // 3. Tam dokümanlari yükle
    const documents = await ctx.runQuery(
      internal.documents.getByIds,
      { ids: results.map(r => r._id) }
    );
    
    // Score ile birleştir
    return results.map((r, i) => ({
      ...documents[i],
      score: r._score, // -1 ile 1 arası
    }));
  },
});

// OpenAI embedding uretimi
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });
  
  const data = await response.json();
  return data.data[0].embedding;
}
```

## Embedding Kaydetme

```typescript
export const addDocument = action({
  args: {
    content: v.string(),
    category: v.string(),
  },
  handler: async (ctx, { content, category }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED" });
    
    // Embedding uret
    const embedding = await generateEmbedding(content);
    
    // Kaydet
    await ctx.runMutation(internal.documents.save, {
      content,
      embedding,
      category,
      authorId: identity.subject,
    });
  },
});
```

## Filter Expressions

```typescript
// Basit equality filter
filter: (q) => q.eq("category", "technical")

// OR filter
filter: (q) => q.or(
  q.eq("category", "technical"),
  q.eq("category", "science")
)
```

## RAG (Retrieval Augmented Generation) Pattern

```typescript
export const chatWithRAG = action({
  args: {
    message: v.string(),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { message, conversationId }) => {
    // 1. Ilgili dokümanlari bul
    const embedding = await generateEmbedding(message);
    const relevantDocs = await ctx.vectorSearch("documents", "by_embedding", {
      vector: embedding,
      limit: 5,
    });
    
    // 2. Context olustur
    const docIds = relevantDocs.map(d => d._id);
    const docs = await ctx.runQuery(internal.documents.getByIds, { ids: docIds });
    const context = docs.map(d => d.content).join("\n\n");
    
    // 3. LLM'e gönder
    const response = await callOpenAI({
      systemPrompt: `Context:\n${context}`,
      userMessage: message,
    });
    
    // 4. Konuşmaya kaydet
    await ctx.runMutation(internal.conversations.addMessage, {
      conversationId,
      role: "assistant",
      content: response,
    });
    
    return response;
  },
});
```

## Limitler

| Ozellik | Limit |
|---------|-------|
| Min dimension | 2 |
| Max dimension | 4096 |
| Max results per search | 256 |
| Vector indexes per table | 4 |
| Toplam vector sayisi | Milyonlar |
