import { mkdir, readdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const MAX_TASK_IMAGE_BYTES = 8 * 1024 * 1024;

const UPLOAD_ROOT = path.join(process.cwd(), "uploads", "tasks");

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

const SAFE_TASK_ID = /^[a-z0-9]+$/i;
const SAFE_FILENAME = /^[a-z0-9-]+\.(jpe?g|png|gif|webp|svg)$/i;

function assertSafeTaskId(taskId: string) {
  if (!SAFE_TASK_ID.test(taskId)) {
    throw new Error("Invalid task id");
  }
}

function assertSafeFilename(filename: string) {
  if (!SAFE_FILENAME.test(filename)) {
    throw new Error("Invalid filename");
  }
}

function getExtensionForMime(mimeType: string) {
  const extension = MIME_TO_EXT[mimeType.toLowerCase()];
  if (!extension) {
    throw new Error("Unsupported image type");
  }

  return extension;
}

export function getTaskImagePublicUrl(taskId: string, filename: string) {
  assertSafeTaskId(taskId);
  assertSafeFilename(filename);
  return `/api/task-images/${taskId}/${filename}`;
}

export function getTaskImagePath(taskId: string, filename: string) {
  assertSafeTaskId(taskId);
  assertSafeFilename(filename);
  return path.join(UPLOAD_ROOT, taskId, filename);
}

export function getMimeTypeForFilename(filename: string) {
  assertSafeFilename(filename);
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MIME[extension] ?? "application/octet-stream";
}

async function ensureTaskImageDir(taskId: string) {
  assertSafeTaskId(taskId);
  await mkdir(path.join(UPLOAD_ROOT, taskId), { recursive: true });
}

export async function saveTaskImage(
  taskId: string,
  buffer: Buffer,
  mimeType: string,
) {
  if (!mimeType.startsWith("image/")) {
    throw new Error("File must be an image");
  }

  if (buffer.byteLength > MAX_TASK_IMAGE_BYTES) {
    throw new Error("Image is too large");
  }

  await ensureTaskImageDir(taskId);

  const extension = getExtensionForMime(mimeType);
  const filename = `${randomUUID()}.${extension}`;
  const filePath = getTaskImagePath(taskId, filename);

  await writeFile(filePath, buffer);

  return getTaskImagePublicUrl(taskId, filename);
}

export function extractReferencedImageFilenames(
  taskId: string,
  detailsHtml: string,
) {
  assertSafeTaskId(taskId);

  const filenames = new Set<string>();
  const pattern = new RegExp(
    `/api/task-images/${taskId}/([a-z0-9-]+\\.(?:jpe?g|png|gif|webp|svg))`,
    "gi",
  );

  for (const match of detailsHtml.matchAll(pattern)) {
    filenames.add(match[1]);
  }

  return filenames;
}

export async function cleanupOrphanedTaskImages(
  taskId: string,
  detailsHtml: string,
) {
  assertSafeTaskId(taskId);

  const taskDir = path.join(UPLOAD_ROOT, taskId);

  let existingFiles: string[];
  try {
    existingFiles = await readdir(taskDir);
  } catch {
    return;
  }

  const referenced = extractReferencedImageFilenames(taskId, detailsHtml);

  await Promise.all(
    existingFiles
      .filter((filename) => SAFE_FILENAME.test(filename) && !referenced.has(filename))
      .map((filename) => rm(getTaskImagePath(taskId, filename), { force: true })),
  );
}

export async function deleteTaskImageDirectory(taskId: string) {
  assertSafeTaskId(taskId);
  await rm(path.join(UPLOAD_ROOT, taskId), { recursive: true, force: true });
}

export async function readTaskImageFile(taskId: string, filename: string) {
  const filePath = getTaskImagePath(taskId, filename);
  return readFile(filePath);
}
