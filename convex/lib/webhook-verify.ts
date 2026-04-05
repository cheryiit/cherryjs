export async function validateWebhookSignature(
  body: string,
  headers: Record<string, string>,
  secret: string,
): Promise<void> {
  const msgId = headers["webhook-id"] ?? headers["svix-id"];
  const msgTimestamp = headers["webhook-timestamp"] ?? headers["svix-timestamp"];
  const msgSignature = headers["webhook-signature"] ?? headers["svix-signature"];

  if (!(msgId && msgTimestamp && msgSignature)) {
    throw new Error("Missing webhook headers"); // cherry:allow
  }

  const timestamp = Number.parseInt(msgTimestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) {
    throw new Error("Webhook timestamp too old"); // cherry:allow
  }

  const signedContent = `${msgId}.${msgTimestamp}.${body}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(
    secret.startsWith("whsec_") ? secret.slice(6) : secret,
  );

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signedContent),
  );

  const expectedSignature = btoa(
    String.fromCharCode(...new Uint8Array(signatureBuffer)),
  );

  const signatures = msgSignature.split(" ").map((s) => s.split(",")[1]);
  if (!signatures.includes(expectedSignature)) {
    throw new Error("Webhook signature verification failed"); // cherry:allow
  }
}
