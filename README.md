# gifs

Minimal GIF upload and hosting app built with Next.js App Router and Vercel Blob.

## Features

- Upload GIF, JPG, JPEG, and PNG files.
- Paste images directly from clipboard (`Ctrl+V` / `Cmd+V`).
- Convert JPG/PNG to GIF on the server.
- Validate GIF integrity for every upload.
- Enforce a **5MB max final GIF size**.
- Deterministic naming with **MD5 hash** IDs.
- Public GIF links via `/g/:id.gif` with aggressive cache headers.
- Explore feed API for infinite scroll.

## Routes

- `POST /api/upload` - upload/convert/validate/store.
- `GET /api/explore?limit=24&cursor=...` - paginated latest uploads.
- `GET /g/:id.gif` - canonical GIF URL that redirects to Blob URL.

## Environment

Set this variable locally and in Vercel:

```bash
BLOB_READ_WRITE_TOKEN=...
```

## Run

```bash
bun install
bun run dev
```

Open `http://localhost:3000`.

## Notes

- Server upload mode is used (`@vercel/blob` `put` from route handlers).
- Uploaded files are stored under `gifs/<md5>.gif`.
