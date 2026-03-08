import { Client } from 'minio';

let minioClient: Client | null = null;

export function getMinioClient(): Client {
  if (!minioClient) {
    minioClient = new Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: Number(process.env.MINIO_PORT || 9000),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || '',
      secretKey: process.env.MINIO_SECRET_KEY || '',
    });
  }
  return minioClient;
}

const BUCKET = process.env.MINIO_BUCKET || 'nexus-media';

export async function ensureBucket(): Promise<void> {
  const client = getMinioClient();
  const exists = await client.bucketExists(BUCKET);
  if (!exists) {
    await client.makeBucket(BUCKET, 'us-east-1');
    // Set public read policy for CDN access
    const policy = {
      Version: '2012-10-17',
      Statement: [{
        Sid: 'PublicRead',
        Effect: 'Allow',
        Principal: '*',
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${BUCKET}/*`],
      }],
    };
    await client.setBucketPolicy(BUCKET, JSON.stringify(policy));
  }
}

export async function uploadFile(key: string, buffer: Buffer, contentType: string): Promise<string> {
  const client = getMinioClient();
  await client.putObject(BUCKET, key, buffer, buffer.length, { 'Content-Type': contentType });

  const cdnBase = process.env.CDN_BASE_URL || `http://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || 9000}/${BUCKET}`;
  return `${cdnBase}/${key}`;
}

/** Upload from a readable stream (for large files) */
export async function uploadStream(key: string, stream: NodeJS.ReadableStream, size: number, contentType: string): Promise<string> {
  const client = getMinioClient();
  await client.putObject(BUCKET, key, stream, size, { 'Content-Type': contentType });
  const cdnBase = process.env.CDN_BASE_URL || `http://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || 9000}/${BUCKET}`;
  return `${cdnBase}/${key}`;
}

/** Get object as Buffer (for cooldown migrations) */
export async function getObject(key: string): Promise<Buffer> {
  const client = getMinioClient();
  const stream = await client.getObject(BUCKET, key);
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/** Get a presigned download URL */
export async function getPresignedDownloadUrl(key: string, expirySeconds = 3600): Promise<string> {
  const client = getMinioClient();
  return client.presignedGetObject(BUCKET, key, expirySeconds);
}

export async function getPresignedUploadUrl(key: string, expirySeconds = 3600): Promise<string> {
  const client = getMinioClient();
  return client.presignedPutObject(BUCKET, key, expirySeconds);
}

/** Check if an object exists */
export async function objectExists(key: string): Promise<boolean> {
  try {
    const client = getMinioClient();
    await client.statObject(BUCKET, key);
    return true;
  } catch {
    return false;
  }
}

export async function deleteFile(key: string): Promise<void> {
  const client = getMinioClient();
  await client.removeObject(BUCKET, key);
}

/** Get the bucket name */
export function getBucketName(): string {
  return BUCKET;
}
