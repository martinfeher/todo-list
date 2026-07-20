const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_WIDTH = 1400;

export function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

export function hasImageFilesInDataTransfer(dataTransfer: DataTransfer) {
  if (dataTransfer.types.includes("Files")) {
    return Array.from(dataTransfer.items).some(
      (item) => item.kind === "file" && item.type.startsWith("image/"),
    );
  }

  return Array.from(dataTransfer.items).some(
    (item) => item.kind === "file" && item.type.startsWith("image/"),
  );
}

export function getImageFilesFromDataTransfer(dataTransfer: DataTransfer) {
  const files: File[] = [];

  if (dataTransfer.files?.length) {
    for (const file of Array.from(dataTransfer.files)) {
      if (isImageFile(file)) {
        files.push(file);
      }
    }
  }

  if (files.length === 0) {
    for (const item of Array.from(dataTransfer.items)) {
      if (item.kind !== "file" || !item.type.startsWith("image/")) continue;

      const file = item.getAsFile();
      if (file) {
        files.push(file);
      }
    }
  }

  return files.filter((file) => file.size <= MAX_IMAGE_BYTES);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = src;
  });
}

async function readImageFileAsDataUrl(file: File) {
  const originalDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });

  if (file.type === "image/gif" || file.type === "image/svg+xml") {
    return originalDataUrl;
  }

  try {
    const image = await loadImage(originalDataUrl);
    const scale = Math.min(1, MAX_IMAGE_WIDTH / image.width);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    if (scale >= 1 && file.size <= 1024 * 1024) {
      return originalDataUrl;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return originalDataUrl;

    context.drawImage(image, 0, 0, width, height);

    const outputType =
      file.type === "image/png" || file.type === "image/webp"
        ? file.type
        : "image/jpeg";

    return canvas.toDataURL(
      outputType,
      outputType === "image/jpeg" ? 0.9 : undefined,
    );
  } catch {
    return originalDataUrl;
  }
}

function dataUrlToUploadFile(dataUrl: string, originalName: string) {
  const [header, base64] = dataUrl.split(",");
  const mimeType = header.match(/data:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const extension =
    mimeType === "image/png"
      ? "png"
      : mimeType === "image/webp"
        ? "webp"
        : mimeType === "image/gif"
          ? "gif"
          : mimeType === "image/svg+xml"
            ? "svg"
            : "jpg";

  return new File([bytes], originalName || `image.${extension}`, {
    type: mimeType,
  });
}

async function prepareImageUploadFile(file: File) {
  const dataUrl = await readImageFileAsDataUrl(file);
  return dataUrlToUploadFile(dataUrl, file.name);
}

export async function uploadImageFile(taskId: string, file: File) {
  const uploadFile = await prepareImageUploadFile(file);
  const formData = new FormData();
  formData.append("file", uploadFile);

  const response = await fetch(`/api/tasks/${taskId}/images`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(errorBody?.error ?? "Image upload failed");
  }

  const data = (await response.json()) as { url: string };
  return data.url;
}

export async function uploadImageFiles(taskId: string, files: File[]) {
  const urls: string[] = [];

  for (const file of files) {
    urls.push(await uploadImageFile(taskId, file));
  }

  return urls;
}
