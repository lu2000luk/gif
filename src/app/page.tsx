"use client";

import { Check, Copy, LoaderCircle, Plus, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PAGE_SIZE = 24;
const ACCEPTED_TYPES = new Set(["image/gif", "image/jpeg", "image/png"]);

type UploadStatus = "idle" | "uploading" | "success" | "error";

type ExploreItem = {
  id: string;
  path: string;
  blobUrl: string;
  size: number;
  uploadedAt: string;
};

type ExploreResponse = {
  items: ExploreItem[];
  hasMore: boolean;
  cursor: string | null;
};

type UploadResponse = {
  id: string;
  path: string;
  blobUrl: string;
  existing: boolean;
  size: number;
};

type UploadResult = {
  url: string;
  existing: boolean;
};

async function parseError(response: Response) {
  try {
    const json = (await response.json()) as { error?: string };
    return json.error ?? `Request failed with status ${response.status}.`;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

export default function Home() {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState<string>("");
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const [mobileUploadOpen, setMobileUploadOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const loadMoreAnchorRef = useRef<HTMLDivElement | null>(null);
  const isInitialLoading = useRef(false);

  const canonicalItems = useMemo(() => {
    const map = new Map<string, ExploreItem>();

    for (const item of items) {
      map.set(item.id, item);
    }

    return Array.from(map.values()).sort((a, b) =>
      b.uploadedAt.localeCompare(a.uploadedAt),
    );
  }, [items]);

  const mergeItems = useCallback((nextItems: ExploreItem[]) => {
    setItems((previous) => {
      const map = new Map(previous.map((item) => [item.id, item]));

      for (const item of nextItems) {
        map.set(item.id, item);
      }

      return Array.from(map.values());
    });
  }, []);

  const loadItems = useCallback(
    async (targetCursor?: string | null) => {
      if (isLoadingMore) {
        return;
      }

      setIsLoadingMore(true);

      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));

      if (targetCursor) {
        params.set("cursor", targetCursor);
      }

      try {
        const response = await fetch(`/api/explore?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(await parseError(response));
        }

        const payload = (await response.json()) as ExploreResponse;
        mergeItems(payload.items);
        setCursor(payload.cursor);
        setHasMore(payload.hasMore);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoadingMore(false);
      }
    },
    [isLoadingMore, mergeItems],
  );

  const resetMessage = useCallback(() => {
    setMessage("");
    setCopied(false);
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED_TYPES.has(file.type.toLowerCase())) {
        setStatus("error");
        setMessage("Only GIF, JPG, JPEG, and PNG files are supported.");
        return;
      }

      resetMessage();
      setUploadResult(null);
      setStatus("uploading");

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(await parseError(response));
        }

        const payload = (await response.json()) as UploadResponse;

        const newItem: ExploreItem = {
          id: payload.id,
          path: `/g/${payload.id}.gif`,
          blobUrl: payload.blobUrl,
          size: payload.size,
          uploadedAt: new Date().toISOString(),
        };

        mergeItems([newItem]);
        setUploadResult({
          url: payload.path,
          existing: payload.existing,
        });
        setStatus("success");
      } catch (error) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Upload failed.");
      }
    },
    [mergeItems, resetMessage],
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileInputChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (!file) {
        return;
      }

      await uploadFile(file);
      event.target.value = "";
    },
    [uploadFile],
  );

  const onDrop = useCallback(
    async (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault();
      setIsDragging(false);

      const file = event.dataTransfer.files?.[0];

      if (!file) {
        return;
      }

      await uploadFile(file);
    },
    [uploadFile],
  );

  const handleDragEnter = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const onCopy = useCallback(async () => {
    if (!uploadResult?.url) {
      return;
    }

    try {
      const fullUrl = uploadResult.url;
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage("Could not copy URL to clipboard.");
    }
  }, [uploadResult]);

  const uploadFromPaste = useCallback(
    async (event: ClipboardEvent) => {
      const entries = event.clipboardData?.items;

      if (!entries || entries.length === 0 || status === "uploading") {
        return;
      }

      for (const entry of entries) {
        if (!entry.type.startsWith("image/")) {
          continue;
        }

        const file = entry.getAsFile();

        if (!file) {
          continue;
        }

        event.preventDefault();
        await uploadFile(file);
        return;
      }
    },
    [status, uploadFile],
  );

  useEffect(() => {
    if (isInitialLoading.current) {
      return;
    }

    isInitialLoading.current = true;
    void loadItems(null);
  }, [loadItems]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      void uploadFromPaste(event);
    };

    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [uploadFromPaste]);

  useEffect(() => {
    const anchor = loadMoreAnchorRef.current;
    const root = gridScrollRef.current;

    if (!anchor || !root || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (!entry.isIntersecting || isLoadingMore || !cursor) {
          return;
        }

        void loadItems(cursor);
      },
      {
        root,
        rootMargin: "240px",
      },
    );

    observer.observe(anchor);

    return () => {
      observer.disconnect();
    };
  }, [cursor, hasMore, isLoadingMore, loadItems]);

  const uploadPanel = (
    <div
      role="button"
      tabIndex={0}
      className={`flex h-full min-h-[420px] w-full flex-col justify-between rounded-2xl border-4 border-dashed bg-[#1C2033] p-5 transition-colors ${
        isDragging
          ? "border-[#51629a] bg-[#1a1e30]"
          : "border-[#2F344A] hover:bg-[#1a1e30] hover:border-[#383e58]"
      } ${status !== "uploading" ? "cursor-pointer" : ""}`}
      onClick={status !== "uploading" ? openFilePicker : undefined}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if (status !== "uploading") openFilePicker();
        }
      }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={onDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/gif,image/jpeg,image/png"
        hidden
        onChange={onFileInputChange}
      />

      <div className="flex flex-1 w-full items-center justify-center pointer-events-none">
        {status === "uploading" ? (
          <div className="grid place-items-center gap-4 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="1em"
              height="1em"
              viewBox="0 0 24 24"
            >
              <g stroke="currentColor">
                <circle
                  cx="12"
                  cy="12"
                  r="9.5"
                  fill="none"
                  stroke-linecap="round"
                  stroke-width="3"
                >
                  <animate
                    attributeName="stroke-dasharray"
                    calcMode="spline"
                    dur="1.5s"
                    keySplines="0.42,0,0.58,1;0.42,0,0.58,1;0.42,0,0.58,1"
                    keyTimes="0;0.475;0.95;1"
                    repeatCount="indefinite"
                    values="0 150;42 150;42 150;42 150"
                  />
                  <animate
                    attributeName="stroke-dashoffset"
                    calcMode="spline"
                    dur="1.5s"
                    keySplines="0.42,0,0.58,1;0.42,0,0.58,1;0.42,0,0.58,1"
                    keyTimes="0;0.475;0.95;1"
                    repeatCount="indefinite"
                    values="0;-16;-59;-59"
                  />
                </circle>
                <animateTransform
                  attributeName="transform"
                  dur="2s"
                  repeatCount="indefinite"
                  type="rotate"
                  values="0 12 12;360 12 12"
                />
              </g>
            </svg>
          </div>
        ) : null}

        {status === "error" ? (
          <div className="grid place-items-center gap-3 text-center">
            <X className="h-10 w-10 text-[#ff9c9c]" />
            <p className="text-3xl text-[#ffb1b1] md:text-4xl">Upload failed</p>
            <span className="max-w-[34ch] text-sm text-[#f1bbbb]">
              {message || "Try again with a different file."}
            </span>
          </div>
        ) : null}

        {status === "success" ? (
          <div className="grid place-items-center gap-4 text-center">
            <Check className="h-12 w-12 text-[#67CA65]" />
          </div>
        ) : null}

        {status === "idle" ? (
          <div className="grid place-items-center gap-3 text-center">
            <p className="text-2xl text-[#FFFFFF] md:text-3xl">Upload</p>
            <span className="text-sm leading-[1.08] tracking-[-0.02em] text-[#5A6079] md:text-base">
              Drag n&apos; drop or click to select
            </span>
          </div>
        ) : null}
      </div>

      {status === "success" && uploadResult ? (
        <div
          className="w-full pt-4 cursor-default pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className="grid w-full grid-cols-[1fr_auto] gap-2">
            <input
              value={uploadResult.url}
              readOnly
              aria-label="Uploaded GIF URL"
              className="min-w-0 rounded-md border border-[#2F344A] bg-[#11131F] px-3 py-2 font-mono text-xs text-[#FFFFFF] outline-none"
            />
            <button
              type="button"
              onClick={onCopy}
              aria-label="Copy URL"
              className="grid h-9 w-9 place-items-center rounded-md border border-[#2F344A] bg-[#1a1e30] hover:bg-[#2c344a] text-[#FFFFFF] transition-colors"
            >
              <Copy size={14} />
            </button>
          </div>
          <div className="h-5 mt-1.5 text-center">
            {copied ? (
              <span className="text-sm text-[#67CA65]">Copied!</span>
            ) : null}
          </div>
        </div>
      ) : (
        <footer className="pt-4 text-center text-sm leading-none tracking-[-0.02em] text-[#5A6079] md:text-base">
          Max 5 MB - GIF, JPG, JPEG, PNG supported
        </footer>
      )}
    </div>
  );

  return (
    <main className="h-screen bg-[#11131F] text-[#FFFFFF] flex flex-col overflow-hidden">
      <div className="mx-auto w-full max-w-[1100px] p-3 md:p-4 flex flex-col h-full">
        <header className="mb-6 grid gap-0.5 shrink-0">
          <h1 className="m-0 text-[58px] leading-[0.88] tracking-[-0.03em] md:text-[72px]">
            gifs
          </h1>
        </header>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_470px] flex-1 min-h-0">
          <div className="md:order-1 h-full min-h-0">
            <div
              ref={gridScrollRef}
              className="h-full overflow-y-auto pb-4 pr-1"
            >
              <div className="grid grid-cols-2 gap-2.5">
                {canonicalItems.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(
                        window.location.origin + item.path,
                      );
                      setCopiedItemId(item.id);
                      setTimeout(() => setCopiedItemId(null), 2000);
                    }}
                    className="group relative cursor-pointer aspect-square overflow-hidden rounded-[14px] bg-white bg-[linear-gradient(45deg,#f3f3f3_25%,transparent_25%,transparent_75%,#f3f3f3_75%,#f3f3f3),linear-gradient(45deg,#f3f3f3_25%,transparent_25%,transparent_75%,#f3f3f3_75%,#f3f3f3)] bg-[length:24px_24px] bg-[position:0_0,12px_12px] p-0 border-none outline-none focus-visible:ring-2 focus-visible:ring-[#51629a]"
                    title={`Copy URL for ${item.id}.gif`}
                  >
                    <img
                      src={item.path}
                      alt="Uploaded GIF"
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <div
                      className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity ${copiedItemId === item.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                    >
                      {copiedItemId === item.id ? (
                        <span className="text-white text-sm font-medium bg-[#67CA65] px-3 py-1.5 rounded-full flex items-center gap-1.5">
                          <Check size={14} /> Copied
                        </span>
                      ) : (
                        <span className="text-white text-sm font-medium bg-[#1C2033]/80 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                          <Copy size={14} /> Copy
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div ref={loadMoreAnchorRef} className="h-px w-px" />
              {isLoadingMore ? (
                <p className="mt-3 text-xs text-[#5A6079] text-center w-full">
                  Loading more...
                </p>
              ) : null}
              {!hasMore && items.length > 0 ? (
                <p className="mt-6 mb-3 text-sm text-[#5A6079] text-center w-full">
                  You&apos;ve reached the end!
                </p>
              ) : null}
            </div>
          </div>

          <div className="md:order-2 h-full min-h-0 flex flex-col">
            <div className="mb-2 md:hidden shrink-0">
              <button
                type="button"
                onClick={() => setMobileUploadOpen((value) => !value)}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#2c3550] bg-[#1f2438] text-sm text-[#e8edf8]"
              >
                <Plus size={16} />
                {mobileUploadOpen ? "Close uploader" : "Upload GIF"}
              </button>
            </div>

            <div
              className={`${mobileUploadOpen ? "flex" : "hidden"} md:flex flex-1 min-h-0 w-full`}
            >
              {uploadPanel}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
