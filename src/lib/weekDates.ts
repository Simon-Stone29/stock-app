// src/lib/weekDates.ts
//
// Single source of truth for "what day/time is it" logic used to compute
// week_start and voting-phase status. Both the client (page.tsx) and the
// server (api/time-context/route.ts) MUST use these functions instead of
// Date.getDay()/getDate()/getHours() directly — those use the runtime's
// local timezone, which is different on the server (UTC on Vercel) vs.
// the browser (the user's actual timezone). That mismatch causes
// weekStart / voting-open calculations to disagree between client and
// server near day/week boundaries.

export const APP_TIMEZONE = "America/New_York";

// Extracts the date/time components of `date` AS SEEN IN `APP_TIMEZONE`,
// regardless of what timezone the code is actually executing in.
function getZonedParts(date: Date) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    weekday: "short",
  });

  const parts = dtf.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  // Intl's "hour: 2-digit, hour12: false" can return "24" for midnight
  // in some environments; normalize to 0.
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0;

  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10), // 1-12
    day: parseInt(get("day"), 10),
    hour,
    weekday: weekdayMap[get("weekday")] ?? date.getDay(),
  };
}

function formatDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Builds a real Date object representing local-midnight-in-APP_TIMEZONE
// for the given y/m/d, by asking Intl what the UTC offset is that day
// and adjusting accordingly. This avoids constructing a UTC date and
// accidentally shifting the calendar day.
function zonedDateFromParts(year: number, month: number, day: number): Date {
  // Start with a UTC guess, then correct using the timezone offset at that instant.
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 12)); // noon UTC avoids DST edge cases
  const zonedNoon = getZonedParts(utcGuess);
  const dayDiff = day - zonedNoon.day;
  utcGuess.setUTCDate(utcGuess.getUTCDate() + dayDiff);
  return utcGuess;
}

// Returns the calendar date (YYYY-MM-DD) for `date` as seen in APP_TIMEZONE.
// Use this anywhere you'd otherwise call toISOString().split("T")[0] or
// build a date string from getFullYear()/getMonth()/getDate() directly.
export function getZonedDateString(date: Date): string {
  const p = getZonedParts(date);
  return formatDateString(p.year, p.month, p.day);
}

export function getLastMonday(date: Date): string {
  const { year, month, day, weekday } = getZonedParts(date);
  const daysBack = weekday === 0 ? 6 : weekday - 1;
  const asOf = zonedDateFromParts(year, month, day);
  asOf.setUTCDate(asOf.getUTCDate() - daysBack);
  const p = getZonedParts(asOf);
  return formatDateString(p.year, p.month, p.day);
}

export function getPreviousMonday(date: Date): string {
  const lastMonday = getLastMonday(date);
  const [y, m, d] = lastMonday.split("-").map(Number);
  const asOf = zonedDateFromParts(y, m, d);
  asOf.setUTCDate(asOf.getUTCDate() - 7);
  const p = getZonedParts(asOf);
  return formatDateString(p.year, p.month, p.day);
}

export function getNextMonday(date: Date): string {
  const { weekday } = getZonedParts(date);
  let daysUntilNextMonday: number;
  if (weekday === 6) daysUntilNextMonday = 2;
  else if (weekday === 0) daysUntilNextMonday = 1;
  else daysUntilNextMonday = 8 - weekday;

  const { year, month, day } = getZonedParts(date);
  const asOf = zonedDateFromParts(year, month, day);
  asOf.setUTCDate(asOf.getUTCDate() + daysUntilNextMonday);
  const p = getZonedParts(asOf);
  return formatDateString(p.year, p.month, p.day);
}

export function isVotingOpen(date: Date): boolean {
  const { weekday, hour } = getZonedParts(date);
  const isSat = weekday === 6;
  const isSun = weekday === 0;
  const isAfter9AM = hour >= 9;
  return (isSat && isAfter9AM) || isSun; // Sunday: open all day until midnight
}