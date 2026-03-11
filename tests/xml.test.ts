import { describe, it, expect } from "vitest";
import {
  escapeXml,
  parseResponse,
  extractOutConfigs,
  extractOutConfig,
} from "../src/utils/xml.js";

describe("escapeXml", () => {
  it("escapes special characters", () => {
    expect(escapeXml("maxmax123!")).toBe("maxmax123&#33;");
    expect(escapeXml("a&b<c>d\"e'f")).toBe("a&amp;b&lt;c&gt;d&quot;e&apos;f");
  });

  it("handles empty string", () => {
    expect(escapeXml("")).toBe("");
  });

  it("passes through plain text", () => {
    expect(escapeXml("admin")).toBe("admin");
  });
});

describe("parseResponse", () => {
  it("extracts root element attributes", () => {
    const parsed = {
      aaaLogin: {
        response: "yes",
        outCookie: "cookie123",
        outRefreshPeriod: "600",
        outPriv: "admin",
      },
    };
    const result = parseResponse(parsed, "aaaLogin");
    expect(result.outCookie).toBe("cookie123");
    expect(result.outRefreshPeriod).toBe("600");
  });

  it("throws on missing root element", () => {
    const parsed = { somethingElse: {} };
    expect(() => parseResponse(parsed, "aaaLogin")).toThrow(
      "Unexpected CIMC response: missing <aaaLogin>",
    );
  });

  it("throws on error response", () => {
    const parsed = {
      aaaLogin: {
        response: "yes",
        errorCode: "551",
        errorDescr: "Authentication failed",
      },
    };
    expect(() => parseResponse(parsed, "aaaLogin")).toThrow(
      "CIMC error (551): Authentication failed",
    );
  });

  it("does not throw on errorCode 0", () => {
    const parsed = {
      configConfMo: {
        response: "yes",
        errorCode: "0",
        outConfig: {},
      },
    };
    expect(() => parseResponse(parsed, "configConfMo")).not.toThrow();
  });

  it("detects error in wrong root element", () => {
    const parsed = {
      configConfMo: {
        errorCode: "103",
        errorDescr: "can't create; object already exists.",
      },
    };
    expect(() => parseResponse(parsed, "aaaLogin")).toThrow("CIMC error (103)");
  });
});

describe("extractOutConfigs", () => {
  it("extracts array of objects from outConfigs", () => {
    const parsed = {
      configResolveClass: {
        response: "yes",
        outConfigs: {
          equipmentFan: [
            { dn: "sys/rack-unit-1/fan-1", id: "1", speed: "5000" },
            { dn: "sys/rack-unit-1/fan-2", id: "2", speed: "4800" },
          ],
        },
      },
    };
    const result = extractOutConfigs(parsed, "configResolveClass");
    expect(result).toHaveLength(2);
    expect(result[0].dn).toBe("sys/rack-unit-1/fan-1");
    expect(result[1].speed).toBe("4800");
  });

  it("normalizes single object to array", () => {
    const parsed = {
      configResolveClass: {
        response: "yes",
        outConfigs: {
          computeRackUnit: {
            dn: "sys/rack-unit-1",
            operPower: "on",
          },
        },
      },
    };
    const result = extractOutConfigs(parsed, "configResolveClass");
    expect(result).toHaveLength(1);
    expect(result[0].operPower).toBe("on");
  });

  it("returns empty array for empty outConfigs", () => {
    const parsed = {
      configResolveClass: {
        response: "yes",
        outConfigs: "",
      },
    };
    const result = extractOutConfigs(parsed, "configResolveClass");
    expect(result).toHaveLength(0);
  });

  it("handles outConfig (singular) for configResolveDn", () => {
    const parsed = {
      configResolveDn: {
        response: "yes",
        outConfig: {
          computeRackUnit: {
            dn: "sys/rack-unit-1",
            model: "UCSC-C220-M4S",
          },
        },
      },
    };
    const result = extractOutConfigs(parsed, "configResolveDn");
    expect(result).toHaveLength(1);
    expect(result[0].model).toBe("UCSC-C220-M4S");
  });
});

describe("extractOutConfig", () => {
  it("extracts single object", () => {
    const parsed = {
      configResolveDn: {
        response: "yes",
        outConfig: {
          computeRackUnit: {
            dn: "sys/rack-unit-1",
            serial: "FCH1234",
          },
        },
      },
    };
    const result = extractOutConfig(parsed, "configResolveDn");
    expect(result).not.toBeNull();
    expect(result!.serial).toBe("FCH1234");
  });

  it("returns null for empty response", () => {
    const parsed = {
      configResolveDn: {
        response: "yes",
        outConfig: "",
      },
    };
    const result = extractOutConfig(parsed, "configResolveDn");
    expect(result).toBeNull();
  });
});
