import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the xml module
vi.mock("../src/utils/xml.js", () => ({
  xmlRequest: vi.fn(),
  parseResponse: vi.fn(),
  escapeXml: vi.fn((s: string) =>
    s.replace(/&/g, "&amp;").replace(/!/g, "&#33;"),
  ),
}));

import {
  ensureAuthenticated,
  logout,
  _resetSession,
} from "../src/auth/session.js";
import * as xml from "../src/utils/xml.js";

const mockXmlRequest = vi.mocked(xml.xmlRequest);
const mockParseResponse = vi.mocked(xml.parseResponse);

beforeEach(() => {
  vi.clearAllMocks();
  _resetSession();
  process.env.CIMC_PASSWORD = "testpass!";
  process.env.CIMC_HOST = "10.0.0.1";
  process.env.CIMC_USERNAME = "admin";
});

afterEach(() => {
  delete process.env.CIMC_PASSWORD;
  delete process.env.CIMC_HOST;
  delete process.env.CIMC_USERNAME;
});

describe("ensureAuthenticated", () => {
  it("logs in and returns cookie", async () => {
    mockXmlRequest.mockResolvedValue({
      aaaLogin: {
        response: "yes",
        outCookie: "cookie-abc-123",
        outRefreshPeriod: "600",
      },
    });
    mockParseResponse.mockReturnValue({
      response: "yes",
      outCookie: "cookie-abc-123",
      outRefreshPeriod: "600",
    });

    const cookie = await ensureAuthenticated();
    expect(cookie).toBe("cookie-abc-123");
    expect(mockXmlRequest).toHaveBeenCalledOnce();
  });

  it("reuses cached cookie on second call", async () => {
    mockXmlRequest.mockResolvedValue({
      aaaLogin: {
        response: "yes",
        outCookie: "cookie-abc-123",
        outRefreshPeriod: "600",
      },
    });
    mockParseResponse.mockReturnValue({
      response: "yes",
      outCookie: "cookie-abc-123",
      outRefreshPeriod: "600",
    });

    const cookie1 = await ensureAuthenticated();
    const cookie2 = await ensureAuthenticated();
    expect(cookie1).toBe(cookie2);
    expect(mockXmlRequest).toHaveBeenCalledOnce(); // Only one login call
  });

  it("throws when CIMC_PASSWORD not set", async () => {
    delete process.env.CIMC_PASSWORD;
    await expect(ensureAuthenticated()).rejects.toThrow(
      "CIMC_PASSWORD not set",
    );
  });

  it("throws on auth failure", async () => {
    mockXmlRequest.mockResolvedValue({
      aaaLogin: {
        response: "yes",
        errorCode: "551",
        errorDescr: "Authentication failed",
      },
    });
    mockParseResponse.mockImplementation(() => {
      throw new Error("CIMC error (551): Authentication failed");
    });

    await expect(ensureAuthenticated()).rejects.toThrow("551");
  });
});

describe("logout", () => {
  it("sends logout and clears session", async () => {
    // First login
    mockXmlRequest.mockResolvedValue({
      aaaLogin: {
        response: "yes",
        outCookie: "cookie-123",
        outRefreshPeriod: "600",
      },
    });
    mockParseResponse.mockReturnValue({
      response: "yes",
      outCookie: "cookie-123",
      outRefreshPeriod: "600",
    });

    await ensureAuthenticated();

    // Reset mock for logout
    mockXmlRequest.mockResolvedValue({ aaaLogout: { response: "yes" } });

    await logout();

    // Next call should trigger fresh login
    mockXmlRequest.mockResolvedValue({
      aaaLogin: {
        response: "yes",
        outCookie: "cookie-456",
        outRefreshPeriod: "600",
      },
    });
    mockParseResponse.mockReturnValue({
      response: "yes",
      outCookie: "cookie-456",
      outRefreshPeriod: "600",
    });

    const cookie = await ensureAuthenticated();
    expect(cookie).toBe("cookie-456");
  });
});
