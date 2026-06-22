import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const REQUIRED_R2_ENV = [
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_ACCESS_KEY_ID',
  'CLOUDFLARE_SECRET_ACCESS_KEY',
] as const;

export function getCloudflareR2Status() {
  const missing = REQUIRED_R2_ENV.filter((name) => !process.env[name]);

  return {
    configured: missing.length === 0,
    missing,
    bucket: process.env.CLOUDFLARE_R2_BUCKET || 'clawd',
    publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL || null,
  };
}

function requireR2Config() {
  const status = getCloudflareR2Status();
  if (!status.configured) {
    throw new Error(`Cloudflare R2 is not configured. Missing: ${status.missing.join(', ')}`);
  }
}

function getClient() {
  requireR2Config();

  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY!,
    },
  });
}

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET || 'clawd';
const PUBLIC_BASE =
  process.env.CLOUDFLARE_R2_PUBLIC_URL ||
  'https://pub-9a12d2869ea54d26bc39b55ba9a84e9a.r2.dev';

export function r2PublicUrl(path: string): string {
  return `${PUBLIC_BASE}/${path}`;
}

export async function r2Put(
  key: string,
  body: Buffer | string,
  contentType: string
): Promise<void> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );
}

export async function r2Get(key: string): Promise<string | null> {
  const client = getClient();
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    return res.Body ? await res.Body.transformToString() : null;
  } catch {
    return null;
  }
}

export async function r2List(
  prefix: string,
  maxKeys = 1000
): Promise<{ key: string; lastModified?: Date }[]> {
  const client = getClient();
  const res = await client.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, MaxKeys: maxKeys })
  );
  return (res.Contents ?? []).map((obj) => ({
    key: obj.Key!,
    lastModified: obj.LastModified,
  }));
}
