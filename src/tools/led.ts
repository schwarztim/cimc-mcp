import { z } from "zod";
import { configMo, resolveDn } from "../utils/client.js";

export const setLocatorLedDef = {
  name: "set_locator_led",
  description:
    "Turn the server locator LED on or off. Used to physically identify a server in a rack.",
  inputSchema: z.object({
    state: z.enum(["on", "off"]).describe("Desired LED state"),
  }),
};

export async function setLocatorLed(input: { state: string }): Promise<string> {
  const inConfig = `<equipmentLocatorLed dn="sys/rack-unit-1/locator-led" adminState="${input.state}"/>`;
  const result = await configMo("sys/rack-unit-1/locator-led", inConfig);

  // Read back current state
  const current = await resolveDn("sys/rack-unit-1/locator-led");

  return JSON.stringify(
    {
      success: true,
      requestedState: input.state,
      currentState: current?.operState || current?.adminState || "unknown",
      result: result || "Command accepted",
    },
    null,
    2,
  );
}
