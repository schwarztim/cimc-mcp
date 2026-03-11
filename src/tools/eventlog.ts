import { z } from "zod";
import { resolveClass } from "../utils/client.js";

export const getEventLogDef = {
  name: "get_event_log",
  description:
    "Get system event log (SEL) entries from the CIMC. Shows hardware events, errors, and status changes.",
  inputSchema: z.object({
    limit: z
      .number()
      .optional()
      .default(50)
      .describe("Maximum number of entries to return (default 50)"),
  }),
};

export async function getEventLog(input: { limit?: number }): Promise<string> {
  const entries = await resolveClass("syseventLog");

  // If syseventLog doesn't return entries, try the individual log entries
  let logEntries = entries;
  if (logEntries.length === 0) {
    logEntries = await resolveClass("logEntry");
  }

  const limit = input.limit || 50;
  const trimmed = logEntries.slice(0, limit);

  return JSON.stringify(
    {
      total: logEntries.length,
      showing: trimmed.length,
      entries: trimmed.map((e) => ({
        dn: e.dn,
        id: e.id,
        severity: e.severity,
        description: e.descr || e.description,
        created: e.created || e.timeStamp,
        type: e.type,
        sensorType: e.sensorType,
      })),
    },
    null,
    2,
  );
}
