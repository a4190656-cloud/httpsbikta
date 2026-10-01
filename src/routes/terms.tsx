import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

const doc = LEGAL.terms;

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: `${doc.title} | בקתה B` },
      { name: "description", content: doc.description },
      { property: "og:title", content: `${doc.title} | בקתה B` },
      { property: "og:description", content: doc.description },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LegalPage doc={doc} />,
});
