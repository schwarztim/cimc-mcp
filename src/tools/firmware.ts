import { z } from "zod";
import { resolveClass } from "../utils/client.js";

export const getFirmwareVersionsDef = {
  name: "get_firmware_versions",
  description:
    "List all component firmware versions: CIMC, BIOS, storage controllers, network adapters, etc.",
  inputSchema: z.object({}),
};

export async function getFirmwareVersions(): Promise<string> {
  const firmware = await resolveClass("firmwareRunning");

  return JSON.stringify(
    {
      total: firmware.length,
      firmware: firmware.map((f) => ({
        dn: f.dn,
        type: f.type,
        version: f.version,
        deployment: f.deployment,
        packageVersion: f.packageVersion,
      })),
    },
    null,
    2,
  );
}
