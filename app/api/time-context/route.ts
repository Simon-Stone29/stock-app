import { NextResponse } from "next/server";
import { getSimulationDate, isSimulationMode } from "@/src/config/simulation";

function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNextMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  let daysUntilNextMonday;

  if (day === 6) {
    daysUntilNextMonday = 2;
  } else if (day === 0) {
    daysUntilNextMonday = 1;
  } else {
    daysUntilNextMonday = 8 - day;
  }

  d.setDate(d.getDate() + daysUntilNextMonday);
  return getLocalDateString(d);
}

function getLastMonday(date: Date): string {
  const thisMonday = new Date(date);
  const day = thisMonday.getDay();
  const daysBack = day === 0 ? 6 : day - 1;
  thisMonday.setDate(thisMonday.getDate() - daysBack);

  return getLocalDateString(thisMonday);
}

function isVotingOpen(date: Date): boolean {
  const day = date.getDay();
  const hour = date.getHours();

  const isSat = day === 6;
  const isSun = day === 0;
  const isAfter9AM = hour >= 9;
  const isBeforeMidnight = hour < 24;

  return (isSat && isAfter9AM) || (isSun && isBeforeMidnight);
}

export async function GET() {
  const now = getSimulationDate();

  return NextResponse.json({
    currentTime: now.toISOString(),
    isSimulation: isSimulationMode(),
    votingOpen: isVotingOpen(now),
    weekStart: getLastMonday(now),
    lastWeekStart: getLastMonday(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
  });
}
