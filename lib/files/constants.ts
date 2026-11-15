export const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
]);

export const MAX_ATTACHMENTS_PER_MESSAGE = 3;
export const MAX_DATA_URL_LENGTH = 4.5 * 1024 * 1024;
