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
