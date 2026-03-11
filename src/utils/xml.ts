import { execFileSync } from "node:child_process";
import { XMLParser } from "fast-xml-parser";
import type { CimcConfig } from "../types/cimc.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseAttributeValue: false, // Keep everything as strings
  isArray: () => false, // We handle array normalization manually
});

// Request serialization mutex
let requestQueue: Promise<unknown> = Promise.resolve();

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/!/g, "&#33;");
}

export async function xmlRequest(
  config: CimcConfig,
  xmlBody: string,
  serialize = true,
): Promise<Record<string, unknown>> {
  const doRequest = async (): Promise<Record<string, unknown>> => {
    const url = `https://${config.host}/nuova`;

    // Use /usr/bin/curl — macOS system curl has network entitlements
    // that Homebrew Node.js lacks for cross-interface routing
    const args = [
      "-sk",
      "--max-time",
      "30",
      "-H",
      "Content-Type: text/xml",
      "-d",
      xmlBody,
      url,
    ];
    if (config.interface) {
      args.unshift("--interface", config.interface);
    }

    const response = execFileSync("/usr/bin/curl", args, {
      encoding: "utf8",
      timeout: 35_000,
    });

    const parsed = parser.parse(response);
    return parsed as Record<string, unknown>;
  };

  if (serialize) {
    const result = requestQueue.then(doRequest);
    requestQueue = result.catch(() => {});
    return result;
  }

  return doRequest();
}

export function parseResponse(
  parsed: Record<string, unknown>,
  expectedRoot: string,
): Record<string, string> {
  const root = parsed[expectedRoot] as Record<string, string> | undefined;
  if (!root) {
    // Try to find any error in the response
    const keys = Object.keys(parsed);
    for (const key of keys) {
      const val = parsed[key] as Record<string, string>;
      if (val && typeof val === "object" && val.errorCode) {
        throw new Error(
          `CIMC error (${val.errorCode}): ${val.errorDescr || "Unknown error"}`,
        );
      }
    }
    throw new Error(
      `Unexpected CIMC response: missing <${expectedRoot}> element. Got keys: ${keys.join(", ")}`,
    );
  }

  if (root.errorCode && root.errorCode !== "0") {
    throw new Error(
      `CIMC error (${root.errorCode}): ${root.errorDescr || "Unknown error"}`,
    );
  }

  return root;
}

/**
 * Extract objects from a configResolveClass or configResolveDn response.
 * Handles both single-object and array responses.
 * Returns an empty array if no results.
 */
export function extractOutConfigs(
  parsed: Record<string, unknown>,
  responseTag: string,
): Record<string, string>[] {
  const root = parseResponse(parsed, responseTag);
  const outConfigs = root.outConfigs ?? root.outConfig;

  if (!outConfigs || typeof outConfigs !== "object") {
    return [];
  }

  // outConfigs contains one or more class-named keys
  const results: Record<string, string>[] = [];
  const configs = outConfigs as Record<string, unknown>;

  for (const key of Object.keys(configs)) {
    const value = configs[key];
    if (Array.isArray(value)) {
      results.push(...(value as Record<string, string>[]));
    } else if (value && typeof value === "object") {
      results.push(value as Record<string, string>);
    }
  }

  return results;
}

/**
 * Extract a single object from configResolveDn outConfig.
 */
export function extractOutConfig(
  parsed: Record<string, unknown>,
  responseTag: string,
): Record<string, string> | null {
  const items = extractOutConfigs(parsed, responseTag);
  return items[0] || null;
}
