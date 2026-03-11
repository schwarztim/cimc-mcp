import { z } from "zod";
import { resolveDnRaw, configMo } from "../utils/client.js";
import { parseResponse } from "../utils/xml.js";

export const getBiosSettingsDef = {
  name: "get_bios_settings",
  description:
    "Get all current BIOS token values. Returns token names, class names, and current values needed for set_bios_setting.",
  inputSchema: z.object({}),
};

export async function getBiosSettings(): Promise<string> {
  const result = await resolveDnRaw("sys/rack-unit-1/bios/bios-settings", true);
  const root = parseResponse(result, "configResolveDn");
  const outConfig = root.outConfig;

  if (!outConfig || typeof outConfig !== "object") {
    return JSON.stringify({ tokens: [], message: "No BIOS settings returned" });
  }

  // outConfig contains biosSettings which contains individual token classes
  const settings = (outConfig as Record<string, unknown>).biosSettings;
  if (!settings || typeof settings !== "object") {
    return JSON.stringify({ tokens: [], message: "No BIOS settings found" });
  }

  const tokens: Array<{
    className: string;
    dn: string;
    attributes: Record<string, string>;
  }> = [];

  const settingsObj = settings as Record<string, unknown>;
  for (const className of Object.keys(settingsObj)) {
    if (className === "dn" || className === "rn") continue;

    const value = settingsObj[className];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const attrs = value as Record<string, string>;
      tokens.push({
        className,
        dn: attrs.dn || "",
        attributes: attrs,
      });
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object") {
          const attrs = item as Record<string, string>;
          tokens.push({
            className,
            dn: attrs.dn || "",
            attributes: attrs,
          });
        }
      }
    }
  }

  return JSON.stringify({ total: tokens.length, tokens }, null, 2);
}

export const setBiosSettingDef = {
  name: "set_bios_setting",
  description:
    "Modify a BIOS token value. Use get_bios_settings first to discover available tokens, class names, and attribute names. Requires server reboot to take effect.",
  inputSchema: z.object({
    tokenDn: z
      .string()
      .describe(
        "Full DN of the BIOS token, e.g. sys/rack-unit-1/bios/bios-settings/SelectMemory-RAS-configuration",
      ),
    className: z
      .string()
      .describe(
        "BIOS token class name, e.g. biosVfSelectMemoryRASConfiguration",
      ),
    attributeName: z
      .string()
      .describe("Attribute to set, e.g. vpSelectMemoryRASConfiguration"),
    value: z.string().describe("New value for the token"),
    confirm: z.boolean().describe("Must be true to modify BIOS settings"),
  }),
};

export async function setBiosSetting(input: {
  tokenDn: string;
  className: string;
  attributeName: string;
  value: string;
  confirm: boolean;
}): Promise<string> {
  if (!input.confirm) {
    return "BIOS modification requires confirm=true. Changes take effect after server reboot.";
  }

  const inConfig = `<${input.className} dn="${input.tokenDn}" ${input.attributeName}="${input.value}"/>`;
  const result = await configMo(input.tokenDn, inConfig);

  return JSON.stringify(
    {
      success: true,
      tokenDn: input.tokenDn,
      attribute: input.attributeName,
      newValue: input.value,
      note: "Reboot required for BIOS changes to take effect",
      result: result || "Command accepted",
    },
    null,
    2,
  );
}
