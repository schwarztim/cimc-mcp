import { z } from "zod";
import { configMo, resolveDn } from "../utils/client.js";

export const solConfigureDef = {
  name: "sol_configure",
  description:
    "Enable, disable, or configure Serial over LAN (SOL). SOL provides remote console access to the server.",
  inputSchema: z.object({
    enabled: z.enum(["yes", "no"]).describe("Enable or disable SOL"),
    baudRate: z
      .enum(["9600", "19200", "38400", "57600", "115200"])
      .optional()
      .describe("SOL baud rate (default: 115200)"),
  }),
};

export async function solConfigure(input: {
  enabled: string;
  baudRate?: string;
}): Promise<string> {
  let attrs = `adminState="${input.enabled === "yes" ? "enable" : "disable"}"`;
  if (input.baudRate) {
    attrs += ` speed="${input.baudRate}"`;
  }

  const inConfig = `<solIf dn="sys/rack-unit-1/sol-if" ${attrs}/>`;
  await configMo("sys/rack-unit-1/sol-if", inConfig);

  // Read back
  const current = await resolveDn("sys/rack-unit-1/sol-if");

  return JSON.stringify(
    {
      success: true,
      adminState: current?.adminState || "unknown",
      speed: current?.speed || "unknown",
      dn: "sys/rack-unit-1/sol-if",
    },
    null,
    2,
  );
}
