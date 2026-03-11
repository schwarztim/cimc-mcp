import { z } from "zod";
import { resolveClass } from "../utils/client.js";

export const getFaultsDef = {
  name: "get_faults",
  description:
    "List all active faults with severity, description, cause, and timestamps. Optionally filter by severity level.",
  inputSchema: z.object({
    severity: z
      .enum(["critical", "major", "minor", "warning", "info", "cleared"])
      .optional()
      .describe("Filter faults by severity level"),
  }),
};

export async function getFaults(input: { severity?: string }): Promise<string> {
  let faults = await resolveClass("faultInst");

  if (input.severity) {
    faults = faults.filter((f) => f.severity === input.severity);
  }

  // Sort: critical first, then by creation time descending
  const severityOrder: Record<string, number> = {
    critical: 0,
    major: 1,
    minor: 2,
    warning: 3,
    info: 4,
    cleared: 5,
  };

  faults.sort((a, b) => {
    const sa = severityOrder[a.severity] ?? 99;
    const sb = severityOrder[b.severity] ?? 99;
    if (sa !== sb) return sa - sb;
    return (b.created || "").localeCompare(a.created || "");
  });

  return JSON.stringify(
    {
      total: faults.length,
      faults: faults.map((f) => ({
        severity: f.severity,
        code: f.code,
        description: f.descr,
        cause: f.cause,
        dn: f.dn,
        type: f.type,
        created: f.created,
        lastTransition: f.lastTransition,
        acknowledged: f.ack,
      })),
    },
    null,
    2,
  );
}
