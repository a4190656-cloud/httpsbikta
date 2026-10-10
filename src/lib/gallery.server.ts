// Google Drive gallery sync — single integration point for the public photo gallery.
// Lists image files in the owner's Drive folder and streams their content through
// the connector gateway. No image ever needs to be re-baked into the site.

const FOLDER_ID = "10_-v6Rbw-W9nxndYZxhmZKZS5RUPyQ7Q";
const GATEWAY = "https://connector-gateway.lovable.dev/google_drive/drive/v3";

function headers() {
  const lk = process.env["LOVABLE_API_KEY"];
  const ck = process.env["GOOGLE_DRIVE_API_KEY"];
  if (!lk || !ck) return null;
  return { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": ck };
}

export interface GalleryImage {
  id: string;
  name: string;
  mimeType: string;
}

// Short-lived in-process cache so the folder is not listed on every page view.
let cache: { at: number; images: GalleryImage[] } | null = null;
const CACHE_MS = 30_000;

export async function listGalleryImages(force = false): Promise<GalleryImage[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.images;
  const h = headers();
  if (!h) return [];
  const q = `'${FOLDER_ID}' in parents and mimeType contains 'image/' and trashed = false`;
  const params = new URLSearchParams({
    q,
    fields: "files(id,name,mimeType,modifiedTime)",
    orderBy: "name_natural",
    pageSize: "200",
  });
  try {
    const res = await fetch(`${GATEWAY}/files?${params.toString()}`, { headers: h });
    if (!res.ok) {
      console.error(`Drive gallery list failed [${res.status}]: ${await res.text()}`);
      return cache?.images ?? [];
    }
    const data = (await res.json()) as { files?: GalleryImage[] };
    const images = (data.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
    }));
    // Always replace the cache so files deleted from Drive disappear from the site.
    cache = { at: Date.now(), images };
    return images;
  } catch (err) {
    console.error("Drive gallery list error:", err);
    return cache?.images ?? [];
  }
}

// Only allow streaming files that actually live in the gallery folder.
export async function isGalleryFile(fileId: string): Promise<boolean> {
  const images = await listGalleryImages(true);
  return images.some((img) => img.id === fileId);
}

export async function fetchGalleryFile(fileId: string): Promise<Response | null> {
  const h = headers();
  if (!h) return null;
  const res = await fetch(`${GATEWAY}/files/${encodeURIComponent(fileId)}?alt=media`, { headers: h });
  if (!res.ok) {
    console.error(`Drive file fetch failed [${res.status}] for ${fileId}`);
    return null;
  }
  return res;
}
