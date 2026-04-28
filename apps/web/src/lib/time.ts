export function europeanLocalDateTimeToUtcIso(date: string, time: string): string {
  return zonedLocalDateTimeToUtcIso(date, time || "09:00", "Europe/Zurich");
}

function zonedLocalDateTimeToUtcIso(date: string, time: string, timeZone: string): string {
  const dateMatch = date.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  const timeMatch = time.match(/^(\d{2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) {
    throw new Error("Departure date or time is invalid.");
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const targetUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let utcMs = targetUtcMs;

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = zonedParts(new Date(utcMs), timeZone);
    const representedUtcMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);
    const nextUtcMs = utcMs - (representedUtcMs - targetUtcMs);
    if (nextUtcMs === utcMs) {
      break;
    }
    utcMs = nextUtcMs;
  }

  return new Date(utcMs).toISOString();
}

function zonedParts(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value ?? "0");

  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute")
  };
}
