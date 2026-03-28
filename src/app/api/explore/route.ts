import { list } from "@vercel/blob";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const ID_PATTERN = /^gifs\/([a-f0-9]{32})\.gif$/;

type ExploreItem = {
  id: string;
  path: string;
  blobUrl: string;
  size: number;
  uploadedAt: string;
};

function parseLimit(limit: string | null): number {
  const parsed = Number.parseInt(limit ?? "", 10);

  if (Number.isNaN(parsed)) {
    return 24;
  }

  return Math.max(1, Math.min(parsed, 60));
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseLimit(searchParams.get("limit"));
  const cursor = searchParams.get("cursor") ?? undefined;

  const result = await list({
    prefix: "gifs/",
    limit,
    cursor,
  });

  const items: ExploreItem[] = result.blobs
    .map((blob) => {
      const match = blob.pathname.match(ID_PATTERN);

      if (!match) {
        return null;
      }

      const id = match[1];

      return {
        id,
        path: `/g/${id}.gif`,
        blobUrl: blob.url,
        size: blob.size,
        uploadedAt: blob.uploadedAt.toISOString(),
      };
    })
    .filter((item): item is ExploreItem => item !== null)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

  return NextResponse.json({
    items,
    cursor: result.cursor ?? null,
    hasMore: result.hasMore,
  });
}
