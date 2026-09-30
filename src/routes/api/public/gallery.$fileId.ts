import { createFileRoute } from "@tanstack/react-router";
import { fetchGalleryFile, isGalleryFile } from "@/lib/gallery.server";

// Public endpoint that streams gallery images from the connected Drive folder.
// Only files present in the gallery folder are served — no arbitrary proxying.
export const Route = createFileRoute("/api/public/gallery/$fileId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const allowed = await isGalleryFile(params.fileId);
        if (!allowed) return new Response("Not found", { status: 404 });

        const upstream = await fetchGalleryFile(params.fileId);
        if (!upstream) return new Response("Not found", { status: 404 });

        return new Response(upstream.body, {
          status: 200,
          headers: {
            "Content-Type": upstream.headers.get("Content-Type") ?? "image/jpeg",
            "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
          },
        });
      },
    },
  },
});
