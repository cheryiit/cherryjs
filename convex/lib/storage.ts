import type { ActionCtx } from "../_generated/server";

export async function generatePresignedUploadUrl(
  ctx: ActionCtx,
  options: {
    bucket: string;
    key: string;
    contentType: string;
    expiresIn?: number;
  },
): Promise<string> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

  const client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  const command = new PutObjectCommand({
    Bucket: options.bucket,
    Key: options.key,
    ContentType: options.contentType,
  });

  return getSignedUrl(client, command, {
    expiresIn: options.expiresIn ?? 3600,
  });
}

export async function generatePresignedDownloadUrl(
  ctx: ActionCtx,
  options: {
    bucket: string;
    key: string;
    expiresIn?: number;
  },
): Promise<string> {
  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

  const client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  const command = new GetObjectCommand({
    Bucket: options.bucket,
    Key: options.key,
  });

  return getSignedUrl(client, command, {
    expiresIn: options.expiresIn ?? 3600,
  });
}

export async function deleteFile(
  ctx: ActionCtx,
  options: {
    bucket: string;
    key: string;
  },
): Promise<void> {
  const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");

  const client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  await client.send(
    new DeleteObjectCommand({
      Bucket: options.bucket,
      Key: options.key,
    }),
  );
}
