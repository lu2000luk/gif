import { BlobNotFoundError, head } from "@vercel/blob";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const FILE_PATTERN = /^([a-f0-9]{32})\.gif$/;

function cachingHeaders() {
  return {
    "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
    "Content-Type": "image/gif",
    "X-Content-Type-Options": "nosniff",
    Vary: "Accept-Encoding",
  };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ file: string }> },
) {
  const { file } = await context.params;
  const match = file.match(FILE_PATTERN);

  if (!match) {
    return NextResponse.json({ error: "Invalid GIF path." }, { status: 400 });
  }

  const id = match[1];
  const pathname = `gifs/${id}.gif`;

  try {
    const blob = await head(pathname);

    return NextResponse.redirect(blob.url, {
      status: 308,
      headers: cachingHeaders(),
    });
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return NextResponse.json({ error: "GIF not found." }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to resolve GIF." },
      { status: 500 },
    );
  }
}
