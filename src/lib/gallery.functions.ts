import { createServerFn } from "@tanstack/react-start";
import { listGalleryImages } from "./gallery.server";

// Public read — the gallery is public marketing content.
export const getGalleryImages = createServerFn({ method: "GET" }).handler(async () => {
  const images = await listGalleryImages();
  return images.map((img) => ({ id: img.id, name: img.name, mimeType: img.mimeType }));
});
