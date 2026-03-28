import crypto from "node:crypto";
import sharp from "sharp";

const GIF_HEADER_87A = "GIF87a";
const GIF_HEADER_89A = "GIF89a";

export const MAX_FINAL_GIF_BYTES = 5 * 1024 * 1024;
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

export type SupportedInputType = "image/gif" | "image/jpeg" | "image/png";

export function isSupportedInputType(
  contentType: string,
): contentType is SupportedInputType {
  return (
    contentType === "image/gif" ||
    contentType === "image/jpeg" ||
    contentType === "image/png"
  );
}

export function md5Hex(buffer: Buffer): string {
  return crypto.createHash("md5").update(buffer).digest("hex");
}

export function hasGifSignature(buffer: Buffer): boolean {
  if (buffer.byteLength < 7) {
    return false;
  }

  const signature = buffer.subarray(0, 6).toString("ascii");
  const trailer = buffer[buffer.byteLength - 1];

  return (
    (signature === GIF_HEADER_87A || signature === GIF_HEADER_89A) &&
    trailer === 0x3b
  );
}

export async function assertValidGif(buffer: Buffer): Promise<void> {
  if (!hasGifSignature(buffer)) {
    throw new Error("Invalid GIF signature.");
  }

  let metadata: sharp.Metadata;

  try {
    metadata = await sharp(buffer, { animated: true }).metadata();
  } catch {
    throw new Error("Could not decode GIF.");
  }

  if (metadata.format !== "gif") {
    throw new Error("File is not a GIF.");
  }

  if (!metadata.width || !metadata.height) {
    throw new Error("GIF dimensions are invalid.");
  }
}

export async function ensureGifBuffer(
  input: Buffer,
  contentType: SupportedInputType,
): Promise<Buffer> {
  if (contentType === "image/gif") {
    return input;
  }

  return sharp(input, { animated: false }).gif().toBuffer();
}
