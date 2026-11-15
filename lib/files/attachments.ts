import type { FileUIPart } from "ai";
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from "./constants";

export const IMAGE_RESIZE_THRESHOLD_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_RAW_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_DOCUMENT_BYTES = 3 * 1024 * 1024; // 3 MB

export function resolveAttachmentMimeType(file: File): string {
  if (file.type) return file.type;
  // Some OSes/browsers leave file.type empty for .md files
  if (file.name.toLowerCase().endsWith(".md")) return "text/markdown";
  return "";
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error(`Failed to read ${file.name} as a data URL.`));
      }
    };
    reader.onerror = () => {
      reject(new Error(`Could not read file ${file.name}.`));
    };
    reader.readAsDataURL(file);
  });
}

function resizeImageToDataUrl(
  file: File,
  maxDimension = 2048,
  quality = 0.9,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const targetWidth = Math.max(1, Math.round(img.width * scale));
        const targetHeight = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas 2D context is not available."));
          return;
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Failed to resize image."));
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Could not load image ${file.name}.`));
    };

    img.src = objectUrl;
  });
}

export async function prepareFilesForChat(
  fileList: FileList,
  existingCount = 0,
): Promise<{ files: FileUIPart[]; error: string | null }> {
  const incoming = Array.from(fileList);
  if (existingCount + incoming.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    return {
      files: [],
      error: `You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} files per message.`,
    };
  }

  const prepared: FileUIPart[] = [];

  for (const file of incoming) {
    const mimeType = resolveAttachmentMimeType(file);
    if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(mimeType)) {
      return {
        files: [],
        error: `"${file.name}" is not a supported file type. Please upload JPEG, PNG, WebP, PDF, TXT, or MD files.`,
      };
    }

    if (mimeType.startsWith("image/")) {
      if (file.size > MAX_RAW_IMAGE_BYTES) {
        return {
          files: [],
          error: `"${file.name}" is larger than 10 MB. Please choose a smaller photo.`,
        };
      }

      const shouldResize = file.size > IMAGE_RESIZE_THRESHOLD_BYTES;
      const url = shouldResize
        ? await resizeImageToDataUrl(file)
        : await readFileAsDataUrl(file);

      prepared.push({
        type: "file",
        mediaType: shouldResize ? "image/jpeg" : mimeType,
        filename: file.name,
        url,
      });
    } else {
      if (file.size > MAX_DOCUMENT_BYTES) {
        return {
          files: [],
          error: `"${file.name}" is larger than 3 MB. Please choose a smaller document.`,
        };
      }

      const url = await readFileAsDataUrl(file);
      prepared.push({
        type: "file",
        mediaType: mimeType,
        filename: file.name,
        url,
      });
    }
  }

  return { files: prepared, error: null };
}
