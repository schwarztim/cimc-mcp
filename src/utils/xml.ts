import { execFileSync } from "node:child_process";
import { request as httpsRequest } from "node:https";
import { XMLParser } from "fast-xml-parser";
import { platform } from "node:os";
import { existsSync as fsExistsSync } from "node:fs";
import type { CimcConfig } from "../types/cimc.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseAttributeValue: false, // Keep everything as strings
  isArray: () => false, // We handle array normalization manually
});

// Auto-detect transport: macOS native uses /usr/bin/curl for network
// entitlements; containers/Linux use Node.js https
const useCurl = platform() === "darwin" && fsExistsSync("/usr/bin/curl");

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

function curlRequest(url: string, xmlBody: string, iface?: string): string {
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
  if (iface) {
    args.unshift("--interface", iface);
  }
  return execFileSync("/usr/bin/curl", args, {
    encoding: "utf8",
    timeout: 35_000,
  });
}

function nodeRequest(url: string, xmlBody: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = httpsRequest(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname,
        method: "POST",
        headers: { "Content-Type": "text/xml" },
        rejectUnauthorized: false,
        timeout: 30_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
    req.write(xmlBody);
    req.end();
  });
}

export async function xmlRequest(
  config: CimcConfig,
  xmlBody: string,
  serialize = true,
): Promise<Record<string, unknown>> {
  const doRequest = async (): Promise<Record<string, unknown>> => {
    const url = `https://${config.host}/nuova`;

    let response: string;
    if (useCurl) {
      response = curlRequest(url, xmlBody, config.interface);
    } else {
      response = await nodeRequest(url, xmlBody);
    }

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
