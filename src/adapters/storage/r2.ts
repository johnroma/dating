import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import mime from 'mime';

import type { StoragePort } from '@/src/ports/storage';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

const endpoint = process.env.S3_ENDPOINT;
const region = process.env.S3_REGION || 'auto';
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

const client = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials:
    accessKeyId && secretAccessKey
      ? { accessKeyId, secretAccessKey }
      : undefined,
});

const BUCKET_ORIG = () => required('S3_BUCKET_ORIG');
const BUCKET_CDN = () => required('S3_BUCKET_CDN');
const CDN_BASE = () => required('CDN_BASE_URL');

export const storage: StoragePort = {
  async putOriginal(key, buf) {
    const contentType = mime.getType(key) || 'application/octet-stream';
    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET_ORIG(),
        Key: `orig/${key}`,
        Body: buf,
        ContentType: contentType,
        ContentDisposition: `inline; filename="${key}"`,
      })
    );
  },

  async putVariant(photoId, size, buf) {
    const Key = `cdn/${photoId}/${size}.webp`;
    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET_CDN(),
        Key,
        Body: buf,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );
    return `${CDN_BASE()}/${Key}`;
  },

  async getOriginalPresignedUrl(key) {
    const expiresIn = Number(process.env.PRESIGN_TTL_SECONDS || 300);
    const cmd = new GetObjectCommand({
      Bucket: BUCKET_ORIG(),
      Key: `orig/${key}`,
    });
    return await getSignedUrl(client, cmd, { expiresIn });
  },

  async deleteAllForPhoto(photoId /*, origKey */) {
    const Objects = ['sm', 'md', 'lg'].map(size => ({
      Key: `cdn/${photoId}/${size}.webp`,
    }));
    await client.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET_CDN(),
        Delete: { Objects },
      })
    );
  },

  variantsBaseUrl() {
    return CDN_BASE();
  },
};
