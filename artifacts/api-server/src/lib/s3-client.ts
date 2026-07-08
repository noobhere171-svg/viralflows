import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import "dotenv/config";

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT || "https://s3.us-west-2.idrivee2.com",
  region: process.env.S3_REGION || "us-west-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "",
    secretAccessKey: process.env.S3_SECRET_KEY || "",
  },
  forcePathStyle: true,
});

const BUCKET = process.env.S3_BUCKET || "mrnoobs";

export async function s3Put(key: string, body: string, contentType = "application/json"): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}

export async function s3Get(key: string): Promise<string> {
  const res = await s3.send(new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
  return await res.Body!.transformToString();
}

export async function s3Delete(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
}

export async function s3Exists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }));
    return true;
  } catch {
    return false;
  }
}

export { s3, BUCKET };
