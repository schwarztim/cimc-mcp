import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the client module before importing tools
vi.mock("../src/utils/client.js", () => ({
  resolveDn: vi.fn(),
  resolveDnRaw: vi.fn(),
  resolveClass: vi.fn(),
  resolveChildren: vi.fn(),
  configMo: vi.fn(),
}));

import * as client from "../src/utils/client.js";
import { getServerSummary } from "../src/tools/server.js";
import { powerControl } from "../src/tools/power.js";
import { getFaults } from "../src/tools/faults.js";
import { setLocatorLed } from "../src/tools/led.js";
import { getFirmwareVersions } from "../src/tools/firmware.js";
import { getStorageSummary } from "../src/tools/storage.js";

const mockResolveDn = vi.mocked(client.resolveDn);
const mockResolveClass = vi.mocked(client.resolveClass);
const mockConfigMo = vi.mocked(client.configMo);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getServerSummary", () => {
  it("returns formatted server summary", async () => {
    mockResolveDn.mockResolvedValue({
      dn: "sys/rack-unit-1",
      name: "D1CIMC",
      model: "UCSC-C220-M4S",
      vendor: "Cisco Systems Inc",
      serial: "FCH1234ABCD",
      serverId: "1",
      uuid: "abcd-1234",
      operPower: "on",
      adminPower: "policy",
      operability: "operable",
      presence: "equipped",
      numOfCpus: "2",
      numOfCores: "28",
      numOfThreads: "56",
      totalMemory: "131072",
      availableMemory: "131072",
    });

    const result = JSON.parse(await getServerSummary());
    expect(result.model).toBe("UCSC-C220-M4S");
    expect(result.powerState).toBe("on");
    expect(result.cpus).toBe("2");
    expect(result.cores).toBe("28");
    expect(result.serial).toBe("FCH1234ABCD");
  });

  it("handles no data", async () => {
    mockResolveDn.mockResolvedValue(null);
    const result = await getServerSummary();
    expect(result).toContain("No server data");
  });
});

describe("powerControl", () => {
  it("maps friendly action names to CIMC values", async () => {
    mockConfigMo.mockResolvedValue({ dn: "sys/rack-unit-1" });

    const result = JSON.parse(
      await powerControl({ action: "on", confirm: true }),
    );
    expect(result.adminPower).toBe("up");
    expect(result.success).toBe(true);
  });

  it("blocks destructive actions without confirm", async () => {
    const result = await powerControl({ action: "off", confirm: false });
    expect(result).toContain("requires confirm=true");
  });

  it("allows non-destructive actions without confirm", async () => {
    mockConfigMo.mockResolvedValue({ dn: "sys/rack-unit-1" });
    const result = JSON.parse(
      await powerControl({ action: "on", confirm: false }),
    );
    expect(result.success).toBe(true);
  });

  it("maps shutdown to soft-shut-down", async () => {
    mockConfigMo.mockResolvedValue({ dn: "sys/rack-unit-1" });
    const result = JSON.parse(
      await powerControl({ action: "shutdown", confirm: true }),
    );
    expect(result.adminPower).toBe("soft-shut-down");
  });
});

describe("getFaults", () => {
  it("returns sorted faults", async () => {
    mockResolveClass.mockResolvedValue([
      {
        dn: "sys/rack-unit-1/fault-1",
        severity: "warning",
        code: "F001",
        descr: "Warning fault",
        cause: "test",
        created: "2024-01-02",
        lastTransition: "2024-01-02",
        ack: "no",
        type: "environmental",
      },
      {
        dn: "sys/rack-unit-1/fault-2",
        severity: "critical",
        code: "F002",
        descr: "Critical fault",
        cause: "test",
        created: "2024-01-01",
        lastTransition: "2024-01-01",
        ack: "no",
        type: "equipment",
      },
    ]);

    const result = JSON.parse(await getFaults({}));
    expect(result.total).toBe(2);
    expect(result.faults[0].severity).toBe("critical"); // Critical first
    expect(result.faults[1].severity).toBe("warning");
  });

  it("filters by severity", async () => {
    mockResolveClass.mockResolvedValue([
      {
        dn: "f1",
        severity: "critical",
        code: "F1",
        descr: "crit",
        cause: "",
        created: "",
        lastTransition: "",
        ack: "",
        type: "",
      },
      {
        dn: "f2",
        severity: "warning",
        code: "F2",
        descr: "warn",
        cause: "",
        created: "",
        lastTransition: "",
        ack: "",
        type: "",
      },
    ]);

    const result = JSON.parse(await getFaults({ severity: "critical" }));
    expect(result.total).toBe(1);
    expect(result.faults[0].severity).toBe("critical");
  });
});

describe("setLocatorLed", () => {
  it("sets LED and reads back state", async () => {
    mockConfigMo.mockResolvedValue({ dn: "sys/rack-unit-1/locator-led" });
    mockResolveDn.mockResolvedValue({
      dn: "sys/rack-unit-1/locator-led",
      adminState: "on",
      operState: "on",
    });

    const result = JSON.parse(await setLocatorLed({ state: "on" }));
    expect(result.success).toBe(true);
    expect(result.currentState).toBe("on");
  });
});

describe("getFirmwareVersions", () => {
  it("returns firmware list", async () => {
    mockResolveClass.mockResolvedValue([
      {
        dn: "sys/rack-unit-1/mgmt/fw-system",
        type: "blade-controller",
        version: "3.0(4q)",
        deployment: "system",
        packageVersion: "3.0(4q)C",
      },
      {
        dn: "sys/rack-unit-1/bios/fw-boot-loader",
        type: "blade-bios",
        version: "C220M4.4.0.1a.0",
        deployment: "boot-loader",
        packageVersion: "",
      },
    ]);

    const result = JSON.parse(await getFirmwareVersions());
    expect(result.total).toBe(2);
    expect(result.firmware[0].version).toBe("3.0(4q)");
  });
});

describe("getStorageSummary", () => {
  it("returns controllers, vdrives, pdisks, and batteries", async () => {
    // Mock 4 sequential resolveClass calls
    mockResolveClass
      .mockResolvedValueOnce([
        {
          dn: "sys/rack-unit-1/board/storage-SAS-MRAID",
          id: "MRAID",
          model: "AVAGO",
          vendor: "LSI",
          serial: "SN1",
          raidSupport: "yes",
          type: "SAS",
          presence: "equipped",
          pciSlot: "0",
          firmwareVersion: "4.680.00-8289",
        },
      ])
      .mockResolvedValueOnce([
        {
          dn: "sys/rack-unit-1/board/storage-SAS-MRAID/vd-0",
          id: "0",
          name: "vd0",
          size: "1TB",
          raidLevel: "1",
          health: "Good",
          driveState: "Optimal",
          stripSize: "256k",
          accessPolicy: "rw",
          readPolicy: "read-ahead",
          writePolicy: "write-back",
        },
      ])
      .mockResolvedValueOnce([
        {
          dn: "sys/rack-unit-1/board/storage-SAS-MRAID/pd-1",
          id: "1",
          vendor: "SEAGATE",
          model: "ST1200MM",
          serial: "DSK1",
          coercedSize: "1TB",
          pdStatus: "Online",
          linkSpeed: "12.0Gb/s",
          mediaType: "HDD",
          predictiveFailureCount: "0",
          driveState: "online",
        },
      ])
      .mockResolvedValueOnce([]); // No RAID battery

    const result = JSON.parse(await getStorageSummary());
    expect(result.controllers).toHaveLength(1);
    expect(result.virtualDrives).toHaveLength(1);
    expect(result.physicalDisks).toHaveLength(1);
    expect(result.raidBatteries).toHaveLength(0);
    expect(result.virtualDrives[0].health).toBe("Good");
  });
});
