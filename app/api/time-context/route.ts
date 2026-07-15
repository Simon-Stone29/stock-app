import { NextResponse } from "next/server";
import { getSimulationDate, isSimulationMode } from "../../../src/config/simulation";
import { getLastMonday, isVotingOpen } from "../../../src/lib/weekDates";

export async function GET() {
  const now = getSimulationDate();

  return NextResponse.json({
    currentTime: now.toISOString(), // real instant — fine to keep as ISO/UTC
    isSimulation: isSimulationMode(),
    votingOpen: isVotingOpen(now),
    weekStart: getLastMonday(now),
    lastWeekStart: getLastMonday(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
  });
}