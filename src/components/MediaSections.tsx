import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { ImageIcon, MessageSquareQuote, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublicReviews } from "@/lib/bookings.functions";
import gallery01 from "@/assets/gallery/bikta-01.jpg.asset.json";
import gallery02 from "@/assets/gallery/bikta-02.jpg.asset.json";
import gallery03 from "@/assets/gallery/bikta-03.jpg.asset.json";
import gallery04 from "@/assets/gallery/bikta-04.jpg.asset.json";
import gallery05 from "@/assets/gallery/bikta-05.jpg.asset.json";
import gallery06 from "@/assets/gallery/bikta-06.jpg.asset.json";
import gallery07 from "@/assets/gallery/bikta-07.jpg.asset.json";
import gallery08 from "@/assets/gallery/bikta-08.jpg.asset.json";
import gallery09 from "@/assets/gallery/bikta-09.jpg.asset.json";
import gallery10 from "@/assets/gallery/bikta-10.jpg.asset.json";
import gallery11 from "@/assets/gallery/bikta-11.jpg.asset.json";

const gallery = [gallery01, gallery02, gallery03, gallery04, gallery05, gallery06, gallery07, gallery08, gallery09, gallery10, gallery11];

export function ReviewsSection() {
  const fetchReviews = useServerFn(getPublicReviews);
  const { data, isLoading } = useQuery({
    queryKey: ["public-reviews"],
    queryFn: () => fetchReviews(),
    staleTime: 10 * 60_000,
  });
  const reviews = data?.reviews ?? [];

  return (
    <section id="reviews" className="scroll-mt-28 border-y border-border/70 bg-secondary/40 py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-5">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} className="text-center">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 text-accent"><MessageSquareQuote className="h-5 w-5" /></span>
          <h2 className="mt-3 font-display text-2xl font-bold text-primary sm:text-3xl">מה אנשים חושבים עלינו?</h2>
          <p className="mt-2 text-sm text-muted-foreground">מילים אמיתיות מאנשים שכבר התארחו בבקתה</p>
        </motion.div>
        {isLoading ? (
          <div className="mx-auto mt-8 h-56 max-w-sm animate-pulse rounded-2xl bg-muted" />
        ) : reviews.length ? (
          <div className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
            {reviews.map((review, index) => (
              <motion.figure key={review.id} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.06 }}
                className="w-[82vw] max-w-sm shrink-0 snap-center overflow-hidden rounded-2xl border border-border bg-card shadow-organic">
                <img src={review.imageUrl} alt={review.title || "צילום מסך של תגובת לקוח"} loading="lazy" className="h-auto max-h-[34rem] w-full object-contain" />
                {review.title && <figcaption className="border-t border-border px-4 py-3 text-sm font-medium">{review.title}</figcaption>}
              </motion.figure>
            ))}
          </div>
        ) : (
          <p className="mx-auto mt-8 max-w-md rounded-2xl border border-dashed border-border bg-card/70 px-5 py-8 text-center text-sm text-muted-foreground">
            תגובות חדשות יופיעו כאן בקרוב.
          </p>
        )}
      </div>
    </section>
  );
}

export function PhotoGallery() {
  const [active, setActive] = useState<number | null>(null);
  return (
    <section id="gallery" className="scroll-mt-28 py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-5">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-8 flex items-end justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-accent"><ImageIcon className="h-5 w-5" /><span className="text-sm font-semibold">הצצה למקום</span></div>
            <h2 className="mt-2 font-display text-2xl font-bold text-primary sm:text-3xl">גלריית בקתה B</h2>
          </div>
          <p className="hidden max-w-sm text-sm text-muted-foreground sm:block">החלל, הפינות השקטות והגינה הפרטית שמחכה לכם.</p>
        </motion.div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {gallery.map((asset, index) => (
            <motion.div key={asset.url} initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: (index % 4) * 0.05 }}
              className={index === 0 || index === 5 ? "col-span-2 row-span-2" : ""}>
              <Button variant="ghost" onClick={() => setActive(index)} aria-label={`פתיחת תמונה ${index + 1}`}
                className="group h-full min-h-36 w-full overflow-hidden rounded-xl border-0 p-0 sm:min-h-44">
                <img src={asset.url} alt={`בקתה B והגינה הפרטית — תמונה ${index + 1}`} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
      <AnimatePresence>
        {active !== null && (
          <motion.div className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/85 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActive(null)}>
            <Button size="icon" variant="secondary" aria-label="סגירת תמונה" onClick={() => setActive(null)} className="absolute left-4 top-4 rounded-full"><X className="h-5 w-5" /></Button>
            <motion.img src={gallery[active]?.url} alt={`בקתה B — תמונה ${active + 1}`} onClick={(event) => event.stopPropagation()}
              className="max-h-[88vh] max-w-[94vw] rounded-xl object-contain shadow-organic" initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}