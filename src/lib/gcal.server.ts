const GATEWAY = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

function headers() {
  const lk = process.env["LOVABLE_API_KEY"];
  const ck = process.env["GOOGLE_CALENDAR_API_KEY"];
  if (!lk || !ck) return null;
  return { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": ck, "Content-Type": "application/json" };
}

export async function gcalBusy(timeMin: string, timeMax: string): Promise<{ start: string; end: string }[]> {
  const h = headers();
  if (!h) return [];
  const res = await fetch(`${GATEWAY}/freeBusy`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ timeMin, timeMax, timeZone: "Asia/Jerusalem", items: [{ id: "primary" }] }),
  });
  if (!res.ok) {
    console.error(`Google freeBusy failed [${res.status}]: ${await res.text()}`);
    return [];
  }
  const data = (await res.json()) as { calendars?: { primary?: { busy?: { start: string; end: string }[] } } };
  return data.calendars?.primary?.busy ?? [];
}

/** Events in the calendar (incl. ones added manually), for the admin view. */
export async function gcalEvents(timeMin: string, timeMax: string): Promise<{ id: string; summary: string; start: string; end: string }[]> {
  const h = headers();
  if (!h) return [];
  const q = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "250" });
  const res = await fetch(`${GATEWAY}/calendars/primary/events?${q}`, { headers: h });
  if (!res.ok) { console.error(`Google events failed [${res.status}]: ${await res.text()}`); return []; }
  const data = (await res.json()) as { items?: { id: string; summary?: string; status?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } }[] };
  return (data.items ?? []).filter((e) => e.status !== "cancelled").map((e) => ({
    id: e.id, summary: e.summary ?? "אירוע ביומן",
    start: e.start?.dateTime ?? `${e.start?.date}T00:00:00+03:00`,
    end: e.end?.dateTime ?? `${e.end?.date}T00:00:00+03:00`,
  }));
}

export async function gcalCreate(ev: {
  summary: string; description: string; start: string; end: string;
}): Promise<string | null> {
  const h = headers();
  if (!h) return null;
  const res = await fetch(`${GATEWAY}/calendars/primary/events`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      summary: ev.summary,
      description: ev.description,
      start: { dateTime: ev.start, timeZone: "Asia/Jerusalem" },
      end: { dateTime: ev.end, timeZone: "Asia/Jerusalem" },
    }),
  });
  if (!res.ok) {
    console.error(`Google create event failed [${res.status}]: ${await res.text()}`);
    return null;
  }
  return ((await res.json()) as { id: string }).id;
}

export async function gcalDelete(id: string) {
  const h = headers();
  if (!h) return;
  const res = await fetch(`${GATEWAY}/calendars/primary/events/${encodeURIComponent(id)}`, { method: "DELETE", headers: h });
  if (!res.ok && res.status !== 410) console.error(`Google delete failed [${res.status}]: ${await res.text()}`);
}
