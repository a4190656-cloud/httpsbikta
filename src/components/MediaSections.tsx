import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { ImageIcon, Maximize2, MessageSquareQuote, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublicReviews } from "@/lib/bookings.functions";
import { getGalleryImages } from "@/lib/gallery.functions";
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

const fallbackGallery = [gallery01, gallery02, gallery03, gallery04, gallery05, gallery06, gallery07, gallery08, gallery09, gallery10, gallery11];

export function ReviewsSection() {
  const [activeReview, setActiveReview] = useState<{ imageUrl: string; title: string | null } | null>(null);
  const fetchReviews = useServerFn(getPublicReviews);
  const { data, isLoading } = useQuery({
    queryKey: ["public-reviews"],
    queryFn: () => fetchReviews(),
    staleTime: 10 * 60_000,
  });
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const reviews = (data?.reviews ?? []).filter((r) => !broken.has(r.id));

  return (
    <section id="reviews" className="scroll-mt-28 border-y border-border/70 bg-secondary/40 py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-5">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} className="text-center">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 text-accent"><MessageSquareQuote className="h-5 w-5" /></span>
          <h2 className="mt-3 font-display text-2xl font-bold text-primary sm:text-3xl">מה אנשים חושבים עלינו?</h2>
          <p className="mt-2 text-sm text-muted-foreground">מילים אמיתיות מאנשים שכבר התארחו בבקתה</p>
        </motion.div>
        {isLoading ? (
          <div className="mx-auto mt-8 aspect-[4/5] w-[78vw] max-w-sm animate-pulse rounded-2xl bg-muted" />
        ) : reviews.length ? (
          <div className="-mx-5 mt-8 flex items-start snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-4 sm:mx-0 sm:gap-4 sm:px-0">
            {reviews.map((review, index) => (
              <figure key={review.id}
                className="h-fit w-[78vw] max-w-sm shrink-0 snap-center self-start overflow-hidden rounded-2xl border border-border bg-muted shadow-organic">
                <Button variant="ghost" onClick={() => setActiveReview({ imageUrl: review.imageUrl, title: review.title })} aria-label="פתיחת צילום התגובה"
                  className="group relative block h-auto min-h-0 w-full overflow-hidden rounded-none p-0">
                  <SafeImage src={review.imageUrl} alt={review.title || "צילום מסך של תגובת לקוח"} loading="eager" onFail={() => setBroken((prev) => new Set(prev).add(review.id))} className="block h-auto min-h-24 max-h-[85vh] w-full object-contain" />
                  <span className="absolute bottom-2 left-2 grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-organic transition-transform group-hover:scale-105" title="הגדלת התמונה"><Maximize2 className="h-4 w-4" /></span>
                </Button>
                {review.title && <figcaption className="border-t border-border px-4 py-3 text-sm font-medium">{review.title}</figcaption>}
              </figure>
            ))}
          </div>
        ) : (
          <p className="mx-auto mt-8 max-w-md rounded-2xl border border-dashed border-border bg-card/70 px-5 py-8 text-center text-sm text-muted-foreground">
            תגובות חדשות יופיעו כאן בקרוב.
          </p>
        )}
      </div>
      <AnimatePresence>
        {activeReview && (
          <motion.div className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/85 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveReview(null)}>
            <Button size="icon" variant="secondary" aria-label="סגירת צילום התגובה" onClick={() => setActiveReview(null)} className="absolute left-4 top-4 rounded-full"><X className="h-5 w-5" /></Button>
            <motion.img src={activeReview.imageUrl} alt={activeReview.title || "צילום מסך של תגובת לקוח"} onClick={(event) => event.stopPropagation()}
              className="max-h-[88vh] max-w-[94vw] rounded-xl object-contain shadow-organic" initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/** Image that retries once, then reports failure if it errors, stalls or decodes empty. */
function SafeImage({ src, onFail, className, ...rest }: ImgHTMLAttributes<HTMLImageElement> & { src: string; onFail: () => void }) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  const url = attempt ? `${src}${src.includes("?") ? "&" : "?"}r=${attempt}` : src;
  const fail = () => { if (attempt < 1) { setAttempt((a) => a + 1); setLoaded(false); } else onFail(); };
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
    const t = window.setTimeout(() => { const el = ref.current; if (!(el?.complete && el.naturalWidth > 0)) fail(); }, 15000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
  return (
    <img ref={ref} src={url} {...rest}
      onLoad={(e) => { if (e.currentTarget.naturalWidth > 0) setLoaded(true); else fail(); }}
      onError={fail}
      className={`${className ?? ""} ${loaded ? "" : "animate-pulse bg-muted"}`} />
  );
}

interface GalleryEntry {
  src: string;
  key: string;
}

export function PhotoGallery() {
  const [active, setActive] = useState<number | null>(null);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const fetchImages = useServerFn(getGalleryImages);
  const { data } = useQuery({
    queryKey: ["drive-gallery"],
    queryFn: () => fetchImages(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const driveEntries: GalleryEntry[] = (data ?? []).map((img) => ({
    src: `/api/public/gallery/${img.id}`,
    key: img.id,
  }));
  const entries: GalleryEntry[] = (driveEntries.length
    ? driveEntries
    : fallbackGallery.map((asset, i) => ({ src: asset.url, key: `fallback-${i}` }))).filter((e) => !failed.has(e.key));

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
          {entries.map((entry, index) => (
            <div key={entry.key}
              className={index === 0 || index === 5 ? "col-span-2 row-span-2" : ""}>
              <Button variant="ghost" onClick={() => setActive(index)} aria-label={`פתיחת תמונה ${index + 1}`}
                className="group h-full min-h-36 w-full overflow-hidden rounded-xl border-0 bg-muted p-0 sm:min-h-44">
                <SafeImage src={entry.src} alt={`בקתה B והגינה הפרטית — תמונה ${index + 1}`} loading="eager" onFail={() => setFailed((prev) => new Set(prev).add(entry.key))} className="h-full w-full object-cover" />
              </Button>
            </div>
          ))}
        </div>
      </div>
      <AnimatePresence>
        {active !== null && entries[active] && (
          <motion.div className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/85 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActive(null)}>
            <Button size="icon" variant="secondary" aria-label="סגירת תמונה" onClick={() => setActive(null)} className="absolute left-4 top-4 rounded-full"><X className="h-5 w-5" /></Button>
            <motion.img src={entries[active].src} alt={`בקתה B — תמונה ${active + 1}`} onClick={(event) => event.stopPropagation()}
              className="max-h-[88vh] max-w-[94vw] rounded-xl object-contain shadow-organic" initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}