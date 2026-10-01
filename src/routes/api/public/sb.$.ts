import { createFileRoute } from "@tanstack/react-router";

// Same-origin proxy to the backend so visitors behind network filters/VPNs
// that block the backend domain can still sign in and load data.
const ALLOWED = /^(auth|rest|storage)\/v1\//;
const FORWARD_REQ = ["apikey", "authorization", "content-type", "accept", "prefer", "range", "x-client-info", "x-supabase-api-version", "accept-profile", "content-profile"];
const DROP_RES = new Set(["content-encoding", "content-length", "transfer-encoding", "connection", "set-cookie"]);

async function proxy({ request, params }: { request: Request; params: { _splat?: string } }) {
  const path = params._splat ?? "";
  if (!ALLOWED.test(path)) return new Response("Not found", { status: 404 });
  const base = process.env["SUPABASE_URL"];
  if (!base) return new Response("Backend not configured", { status: 500 });
  const url = new URL(request.url);
  const target = `${base.replace(/\/$/, "")}/${path}${url.search}`;
  const headers = new Headers();
  for (const h of FORWARD_REQ) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }
  const hasBody = !["GET", "HEAD"].includes(request.method);
  const res = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : null,
    redirect: "manual",
  });
  const out = new Headers();
  res.headers.forEach((v, k) => { if (!DROP_RES.has(k.toLowerCase())) out.set(k, v); });
  out.set("Cache-Control", "no-store");
  return new Response(res.body, { status: res.status, headers: out });
}

export const Route = createFileRoute("/api/public/sb/$")({
  server: {
    handlers: { GET: proxy, POST: proxy, PUT: proxy, PATCH: proxy, DELETE: proxy, HEAD: proxy },
  },
});
