import type { CimcConfig, SessionState } from "../types/cimc.js";
import { xmlRequest, parseResponse, escapeXml } from "../utils/xml.js";

let session: SessionState | null = null;
let loginPromise: Promise<string> | null = null;

function getConfig(): CimcConfig {
  const host = process.env.CIMC_HOST || "192.168.88.10";
  const username = process.env.CIMC_USERNAME || "admin";
  const password = process.env.CIMC_PASSWORD || "";
  const verifyTls = process.env.CIMC_VERIFY_TLS === "true";
  const iface = process.env.CIMC_INTERFACE;

  if (!password) {
    throw new Error(
      "CIMC_PASSWORD not set. Set the CIMC_PASSWORD environment variable.",
    );
  }

  return { host, username, password, verifyTls, interface: iface };
}

async function login(): Promise<string> {
  const config = getConfig();
  const escapedPassword = escapeXml(config.password);
  const xml = `<aaaLogin inName="${escapeXml(config.username)}" inPassword="${escapedPassword}"/>`;

  const result = await xmlRequest(config, xml, false);
  const root = parseResponse(result, "aaaLogin");

  if (root.errorCode) {
    throw new Error(
      `CIMC login failed (${root.errorCode}): ${root.errorDescr || "Unknown error"}`,
    );
  }

  const cookie = root.outCookie;
  if (!cookie) {
    throw new Error("CIMC login response missing outCookie");
  }

  const refreshPeriod = parseInt(root.outRefreshPeriod || "600", 10);

  session = {
    cookie,
    expiresAt: Date.now() + refreshPeriod * 1000,
    refreshPeriod,
  };

  return cookie;
}

async function refresh(): Promise<string> {
  if (!session) {
    return login();
  }

  const config = getConfig();
  const escapedPassword = escapeXml(config.password);
  const xml = `<aaaRefresh cookie="${session.cookie}" inCookie="${session.cookie}" inName="${escapeXml(config.username)}" inPassword="${escapedPassword}"/>`;

  try {
    const result = await xmlRequest(config, xml, false);
    const root = parseResponse(result, "aaaRefresh");

    if (root.errorCode) {
      // Refresh failed, re-login
      session = null;
      return login();
    }

    const cookie = root.outCookie || session.cookie;
    const refreshPeriod = parseInt(
      root.outRefreshPeriod || String(session.refreshPeriod),
      10,
    );

    session = {
      cookie,
      expiresAt: Date.now() + refreshPeriod * 1000,
      refreshPeriod,
    };

    return cookie;
  } catch {
    session = null;
    return login();
  }
}

export async function ensureAuthenticated(): Promise<string> {
  // If already logging in, wait for that to complete
  if (loginPromise) {
    return loginPromise;
  }

  // If session is valid and not within 100s of expiry, reuse it
  if (session && Date.now() < session.expiresAt - 100_000) {
    return session.cookie;
  }

  // If session exists but nearing expiry, refresh
  if (session && Date.now() < session.expiresAt) {
    loginPromise = refresh().finally(() => {
      loginPromise = null;
    });
    return loginPromise;
  }

  // No session or expired, login fresh
  loginPromise = login().finally(() => {
    loginPromise = null;
  });
  return loginPromise;
}

export async function logout(): Promise<void> {
  if (!session) return;

  try {
    const config = getConfig();
    const xml = `<aaaLogout cookie="${session.cookie}" inCookie="${session.cookie}"/>`;
    await xmlRequest(config, xml, false);
  } catch {
    // Best effort logout
  } finally {
    session = null;
  }
}

export function getSession(): SessionState | null {
  return session;
}

// For testing
export function _resetSession(): void {
  session = null;
  loginPromise = null;
}
