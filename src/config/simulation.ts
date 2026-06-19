/**
 * SIMULATION MODE CONFIGURATION
 *
 * Set SIMULATION_DATE to test with historical data.
 * - When set: entire app (frontend + scripts) uses this date
 * - When null: uses real current time
 *
 * Format: "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM"
 */

export const SIMULATION_DATE: string | null = null;

export function getSimulationDate(): Date {
  if (SIMULATION_DATE) {
    return new Date(SIMULATION_DATE);
  }
  return new Date();
}

export function isSimulationMode(): boolean {
  return SIMULATION_DATE !== null;
}
