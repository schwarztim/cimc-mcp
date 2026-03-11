import { ensureAuthenticated } from "../auth/session.js";
import { xmlRequest, extractOutConfigs, extractOutConfig } from "./xml.js";
import type { CimcConfig } from "../types/cimc.js";

function getConfig(): CimcConfig {
  return {
    host: process.env.CIMC_HOST || "192.168.88.10",
    username: process.env.CIMC_USERNAME || "admin",
    password: process.env.CIMC_PASSWORD || "",
    verifyTls: process.env.CIMC_VERIFY_TLS === "true",
    interface: process.env.CIMC_INTERFACE,
  };
}

async function authenticatedRequest(
  xmlBody: string,
): Promise<Record<string, unknown>> {
  const cookie = await ensureAuthenticated();
  const config = getConfig();
  return xmlRequest(config, xmlBody.replace(/\{cookie\}/g, cookie));
}

/**
 * Query a single DN.
 */
export async function resolveDn(
  dn: string,
  hierarchical = false,
): Promise<Record<string, string> | null> {
  const xml = `<configResolveDn cookie="{cookie}" dn="${dn}" inHierarchical="${hierarchical}"/>`;
  const result = await authenticatedRequest(xml);
  return extractOutConfig(result, "configResolveDn");
}

/**
 * Query a single DN with hierarchical children. Returns raw parsed result for complex traversal.
 */
export async function resolveDnRaw(
  dn: string,
  hierarchical = true,
): Promise<Record<string, unknown>> {
  const xml = `<configResolveDn cookie="{cookie}" dn="${dn}" inHierarchical="${hierarchical}"/>`;
  return authenticatedRequest(xml);
}

/**
 * Query all objects of a class.
 */
export async function resolveClass(
  classId: string,
  hierarchical = false,
): Promise<Record<string, string>[]> {
  const xml = `<configResolveClass cookie="{cookie}" inHierarchical="${hierarchical}" classId="${classId}"/>`;
  const result = await authenticatedRequest(xml);
  return extractOutConfigs(result, "configResolveClass");
}

/**
 * Query children of a DN, optionally filtered by classId.
 */
export async function resolveChildren(
  dn: string,
  classId?: string,
): Promise<Record<string, string>[]> {
  const classAttr = classId ? ` classId="${classId}"` : "";
  const xml = `<configResolveChildren cookie="{cookie}" inDn="${dn}"${classAttr} inHierarchical="false"/>`;
  const result = await authenticatedRequest(xml);
  return extractOutConfigs(result, "configResolveChildren");
}

/**
 * Modify a managed object.
 */
export async function configMo(
  dn: string,
  inConfigXml: string,
): Promise<Record<string, string> | null> {
  const xml = `<configConfMo cookie="{cookie}" dn="${dn}" inHierarchical="false"><inConfig>${inConfigXml}</inConfig></configConfMo>`;
  const result = await authenticatedRequest(xml);
  return extractOutConfig(result, "configConfMo");
}
