import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/api/public/reviews/$reviewId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const parsed = z.string().uuid().safeParse(params.reviewId);
        if (!parsed.success) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: review, error } = await supabaseAdmin
          .from("customer_reviews")
          .select("storage_path")
          .eq("id", parsed.data)
          .eq("is_visible", true)
          .maybeSingle();

        if (error || !review) return new Response("Not found", { status: 404 });
        const { data: image, error: downloadError } = await supabaseAdmin.storage
          .from("customer-reviews")
          .download(review.storage_path);
        if (downloadError || !image) return new Response("Not found", { status: 404 });

        return new Response(image.stream(), {
          headers: {
            "Content-Type": image.type || "image/jpeg",
            "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});