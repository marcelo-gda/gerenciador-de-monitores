export function generateICS(params: {
  title: string;
  startDate: string;   // YYYY-MM-DD
  endDate?: string | null;
  startTime: string;   // HH:MM
  endTime: string;     // HH:MM
  location: string;
}): string {
  const { title, startDate, endDate, startTime, endTime, location } = params;

  const fmt = (date: string, time: string) =>
    date.replace(/-/g, "") + "T" + time.replace(/:/g, "") + "00";

  const effectiveEnd = endDate && endDate !== startDate ? endDate : startDate;
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@gda`;
  const now = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GDA Escalas//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=America/Sao_Paulo:${fmt(startDate, startTime)}`,
    `DTEND;TZID=America/Sao_Paulo:${fmt(effectiveEnd, endTime)}`,
    `SUMMARY:${title}`,
    `LOCATION:${location}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadICS(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
