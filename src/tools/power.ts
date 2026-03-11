import { z } from "zod";
import { configMo } from "../utils/client.js";

const POWER_ACTION_MAP: Record<string, string> = {
  on: "up",
  off: "down",
  shutdown: "soft-shut-down",
  cycle: "cycle-immediate",
  reset: "hard-reset-immediate",
  "bmc-reset": "bmc-reset-immediate",
  "bmc-reset-default": "bmc-reset-default",
  "diagnostic-interrupt": "diagnostic-interrupt",
};

export const powerControlDef = {
  name: "power_control",
  description:
    "Control server power: on, off, graceful shutdown, power cycle, hard reset, or BMC reset. WARNING: 'off' and 'reset' are immediate and can cause data loss.",
  inputSchema: z.object({
    action: z
      .enum([
        "on",
        "off",
        "shutdown",
        "cycle",
        "reset",
        "bmc-reset",
        "bmc-reset-default",
        "diagnostic-interrupt",
      ])
      .describe(
        "Power action: on/off/shutdown(graceful)/cycle/reset(hard)/bmc-reset/bmc-reset-default/diagnostic-interrupt",
      ),
    confirm: z
      .boolean()
      .describe(
        "Must be true to execute destructive actions (off, cycle, reset)",
      ),
  }),
};

export async function powerControl(input: {
  action: string;
  confirm: boolean;
}): Promise<string> {
  const destructive = [
    "off",
    "cycle",
    "reset",
    "bmc-reset",
    "bmc-reset-default",
  ];
  if (destructive.includes(input.action) && !input.confirm) {
    return `Destructive action '${input.action}' requires confirm=true. This action may cause data loss or service interruption.`;
  }

  const adminPower = POWER_ACTION_MAP[input.action];
  if (!adminPower) {
    return `Unknown power action: ${input.action}`;
  }

  const inConfig = `<computeRackUnit dn="sys/rack-unit-1" adminPower="${adminPower}"/>`;
  const result = await configMo("sys/rack-unit-1", inConfig);

  return JSON.stringify(
    {
      action: input.action,
      adminPower,
      success: true,
      result: result || "Command accepted",
    },
    null,
    2,
  );
}
