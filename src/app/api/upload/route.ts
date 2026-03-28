import { BlobNotFoundError, head, put } from "@vercel/blob";
import { type NextRequest, NextResponse } from "next/server";
import {
  assertValidGif,
  ensureGifBuffer,
  isSupportedInputType,
  MAX_FINAL_GIF_BYTES,
  MAX_SOURCE_BYTES,
  md5Hex,
} from "@/lib/gif";

export const runtime = "nodejs";

type UploadSuccessPayload = {
  id: string;
  path: string;
  blobUrl: string;
  existing: boolean;
  size: number;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function buildPayload(
  request: NextRequest,
  id: string,
  blobUrl: string,
  size: number,
  existing: boolean,
) {
  const path = `/g/${id}.gif`;

  return NextResponse.json<UploadSuccessPayload>({
    id,
    path: new URL(path, request.url).toString(),
    blobUrl,
    existing,
    size,
  });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const entry = formData.get("file");

  if (!(entry instanceof File)) {
    return jsonError("Upload a file using the `file` form field.", 400);
  }

  const contentType = entry.type.toLowerCase();

  if (!isSupportedInputType(contentType)) {
    return jsonError("Only GIF, JPG, JPEG, and PNG files are supported.", 415);
  }

  const source = Buffer.from(await entry.arrayBuffer());

  if (source.byteLength === 0) {
    return jsonError("Uploaded file is empty.", 400);
  }

  if (source.byteLength > MAX_SOURCE_BYTES) {
    return jsonError("Source image is too large to process.", 413);
  }

  const id = md5Hex(source);
  const pathname = `gifs/${id}.gif`;

  try {
    const existing = await head(pathname);
    return buildPayload(request, id, existing.url, existing.size, true);
  } catch (error) {
    if (!(error instanceof BlobNotFoundError)) {
      return jsonError("Failed to check existing uploads.", 500);
    }
  }

  let gifBuffer: Buffer;

  try {
    gifBuffer = await ensureGifBuffer(source, contentType);
  } catch {
    return jsonError("Could not convert image to GIF.", 422);
  }

  if (gifBuffer.byteLength > MAX_FINAL_GIF_BYTES) {
    return jsonError("Final GIF exceeds 5MB.", 413);
  }

  try {
    await assertValidGif(gifBuffer);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid GIF output.";
    return jsonError(message, 422);
  }

  try {
    const uploaded = await put(pathname, gifBuffer, {
      access: "public",
      allowOverwrite: false,
      addRandomSuffix: false,
      contentType: "image/gif",
      cacheControlMaxAge: 31_536_000,
    });

    return buildPayload(request, id, uploaded.url, gifBuffer.byteLength, false);
  } catch {
    return jsonError("Failed to upload GIF.", 500);
  }
}
