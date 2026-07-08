import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { s3Put, s3Get, s3Delete, s3Exists } from "./s3-client.js";
import "dotenv/config";

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), "data");

// ─── Cookies: ALWAYS local (yt-dlp needs --cookies /path/to/file.txt) ───

export function getWorkspaceCookiesPath(workspaceId: string): string {
  return join(DATA_DIR, "workspaces", workspaceId, "cookies.txt");
}

export async function hasWorkspaceCookies(workspaceId: string): Promise<boolean> {
  return existsSync(getWorkspaceCookiesPath(workspaceId));
}

// ─── JSON storage: S3 first, local fallback ───

export async function readJsonFromFilebase(key: string): Promise<any> {
  const s3Key = key.replace(/^\/+/, "");
  try {
    const raw = await s3Get(s3Key);
    return JSON.parse(raw);
  } catch (err: any) {
    if (err.name === "NoSuchKey" || err.Code === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
      const filePath = join(DATA_DIR, key.replace(/^\/+/, ""));
      const content = await readFile(filePath, "utf-8");
      return JSON.parse(content);
    }
    throw err;
  }
}

export async function writeJsonToFilebase(key: string, data: any): Promise<void> {
  const body = JSON.stringify(data, null, 2);
  const s3Key = key.replace(/^\/+/, "");
  try {
    await s3Put(s3Key, body);
  } catch (err) {
    console.error(`[S3 WRITE FAIL] ${s3Key}, falling back to local:`, err);
  }
  const filePath = join(DATA_DIR, key.replace(/^\/+/, ""));
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(filePath, body, "utf-8");
}

export async function deleteFromFilebase(key: string): Promise<void> {
  const s3Key = key.replace(/^\/+/, "");
  try {
    await s3Delete(s3Key);
  } catch {}
  const filePath = join(DATA_DIR, key.replace(/^\/+/, ""));
  if (existsSync(filePath)) {
    await unlink(filePath);
  }
}

// ─── Text storage: S3 first, local fallback ───

export async function readTextFromFilebase(key: string): Promise<string> {
  const s3Key = key.replace(/^\/+/, "");
  try {
    return await s3Get(s3Key);
  } catch (err: any) {
    if (err.name === "NoSuchKey" || err.Code === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
      const filePath = join(DATA_DIR, key.replace(/^\/+/, ""));
      return await readFile(filePath, "utf-8");
    }
    throw err;
  }
}

export async function writeTextToFilebase(key: string, data: string): Promise<void> {
  const s3Key = key.replace(/^\/+/, "");
  try {
    await s3Put(s3Key, data, "text/plain");
  } catch (err) {
    console.error(`[S3 WRITE FAIL] ${s3Key}, falling back to local:`, err);
  }
  const filePath = join(DATA_DIR, key.replace(/^\/+/, ""));
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(filePath, data, "utf-8");
}

// ─── File existence: S3 first, local fallback ───

export async function fileExists(key: string): Promise<boolean> {
  const s3Key = key.replace(/^\/+/, "");
  try {
    if (await s3Exists(s3Key)) return true;
  } catch {}
  return existsSync(join(DATA_DIR, key.replace(/^\/+/, "")));
}
