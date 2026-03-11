import { z } from "zod";
import { resolveDn, resolveClass } from "../utils/client.js";

export const getServerSummaryDef = {
  name: "get_server_summary",
  description:
    "Get overall server status including power state, model, serial number, CPU/memory counts, and operability. Single composite view of the CIMC-managed server.",
  inputSchema: z.object({}),
};

export async function getServerSummary(): Promise<string> {
  const server = await resolveDn("sys/rack-unit-1");
  if (!server) {
    return "No server data returned from CIMC.";
  }

  return JSON.stringify(
    {
      name: server.name,
      model: server.model,
      vendor: server.vendor,
      serial: server.serial,
      serverId: server.serverId,
      uuid: server.uuid,
      powerState: server.operPower,
      adminPower: server.adminPower,
      operability: server.operability,
      presence: server.presence,
      cpus: server.numOfCpus,
      cores: server.numOfCores,
      threads: server.numOfThreads,
      totalMemoryMB: server.totalMemory,
      availableMemoryMB: server.availableMemory,
      dn: server.dn,
    },
    null,
    2,
  );
}

export const getSensorsDef = {
  name: "get_sensors",
  description:
    "Get all sensor readings: fans, power supplies, and temperature data from the CIMC-managed server.",
  inputSchema: z.object({}),
};

export async function getSensors(): Promise<string> {
  // Sequential calls to avoid overloading BMC
  const fans = await resolveClass("equipmentFan");
  const psus = await resolveClass("equipmentPsu");
  const cpuEnv = await resolveClass("processorEnvStats");
  const memEnv = await resolveClass("memoryEnvStats");
  const powerStats = await resolveClass("computeMbPowerStats");

  return JSON.stringify(
    {
      fans: fans.map((f) => ({
        dn: f.dn,
        id: f.id,
        model: f.model,
        operability: f.operability,
        presence: f.presence,
        speed: f.speed,
      })),
      powerSupplies: psus.map((p) => ({
        dn: p.dn,
        id: p.id,
        model: p.model,
        vendor: p.vendor,
        serial: p.serial,
        operability: p.operability,
        presence: p.presence,
        voltage: p.voltage,
        power: p.power,
        thermal: p.thermal,
      })),
      cpuTemperatures: cpuEnv.map((c) => ({
        dn: c.dn,
        temperature: c.temperature,
      })),
      memoryTemperatures: memEnv.map((m) => ({
        dn: m.dn,
        temperature: m.temperature,
      })),
      powerStats: powerStats.map((p) => ({
        dn: p.dn,
        consumedPower: p.consumedPower,
        inputCurrent: p.inputCurrent,
        inputVoltage: p.inputVoltage,
      })),
    },
    null,
    2,
  );
}

export const getServerHealthDef = {
  name: "get_server_health",
  description:
    "Composite health check: server status, active faults, DIMM/PSU/fan/storage status, and power consumption. Answers 'Is the server healthy?'",
  inputSchema: z.object({}),
};

export async function getServerHealth(): Promise<string> {
  // Sequential calls
  const server = await resolveDn("sys/rack-unit-1");
  const faults = await resolveClass("faultInst");
  const dimms = await resolveClass("memoryUnit");
  const psus = await resolveClass("equipmentPsu");
  const fans = await resolveClass("equipmentFan");
  const vdrives = await resolveClass("storageVirtualDrive");
  const pdisks = await resolveClass("storageLocalDisk");

  const criticalFaults = faults.filter((f) => f.severity === "critical");
  const majorFaults = faults.filter((f) => f.severity === "major");

  const dimmIssues = dimms.filter(
    (d) => d.operState !== "operable" && d.presence === "equipped",
  );
  const psuIssues = psus.filter(
    (p) => p.operability !== "operable" && p.presence === "equipped",
  );
  const fanIssues = fans.filter(
    (f) => f.operability !== "operable" && f.presence === "equipped",
  );
  const vdriveIssues = vdrives.filter((v) => v.health !== "Good" && v.health);
  const pdiskIssues = pdisks.filter(
    (p) =>
      p.pdStatus !== "Online" &&
      p.pdStatus !== "Unconfigured Good" &&
      p.presence === "equipped",
  );

  const healthy =
    criticalFaults.length === 0 &&
    majorFaults.length === 0 &&
    dimmIssues.length === 0 &&
    psuIssues.length === 0 &&
    fanIssues.length === 0 &&
    vdriveIssues.length === 0 &&
    pdiskIssues.length === 0 &&
    server?.operability === "operable";

  return JSON.stringify(
    {
      overall: healthy ? "HEALTHY" : "DEGRADED",
      powerState: server?.operPower || "unknown",
      operability: server?.operability || "unknown",
      faults: {
        critical: criticalFaults.length,
        major: majorFaults.length,
        total: faults.length,
        details: faults.slice(0, 20).map((f) => ({
          severity: f.severity,
          code: f.code,
          description: f.descr,
          dn: f.dn,
          created: f.created,
        })),
      },
      components: {
        dimms: {
          total: dimms.filter((d) => d.presence === "equipped").length,
          issues: dimmIssues.length,
        },
        psus: {
          total: psus.filter((p) => p.presence === "equipped").length,
          issues: psuIssues.length,
        },
        fans: {
          total: fans.filter((f) => f.presence === "equipped").length,
          issues: fanIssues.length,
        },
        virtualDrives: { total: vdrives.length, issues: vdriveIssues.length },
        physicalDisks: {
          total: pdisks.filter((p) => p.presence === "equipped").length,
          issues: pdiskIssues.length,
        },
      },
    },
    null,
    2,
  );
}

export const getInventoryDef = {
  name: "get_inventory",
  description:
    "Complete hardware inventory: CPUs, DIMMs, PCI cards, network adapters, and storage controllers. Answers 'What hardware is in this server?'",
  inputSchema: z.object({}),
};

export async function getInventory(): Promise<string> {
  // Sequential calls
  const cpus = await resolveClass("processorUnit");
  const dimms = await resolveClass("memoryUnit");
  const pci = await resolveClass("pciEquipSlot");
  const adapters = await resolveClass("adaptorUnit");
  const controllers = await resolveClass("storageController");
  const firmware = await resolveClass("firmwareRunning");

  return JSON.stringify(
    {
      cpus: cpus.map((c) => ({
        dn: c.dn,
        id: c.id,
        model: c.model,
        vendor: c.vendor,
        arch: c.arch,
        cores: c.cores,
        coresEnabled: c.coresEnabled,
        threads: c.threads,
        speed: c.speed,
        operability: c.operability,
        presence: c.presence,
      })),
      memory: dimms
        .filter((d) => d.presence === "equipped")
        .map((d) => ({
          dn: d.dn,
          id: d.id,
          model: d.model,
          vendor: d.vendor,
          serial: d.serial,
          capacityMB: d.capacity,
          clockMHz: d.clock,
          type: d.type,
          formFactor: d.formFactor,
          location: d.location,
          operState: d.operState,
        })),
      pciSlots: pci.map((p) => ({
        dn: p.dn,
        id: p.id,
        model: p.model,
        vendor: p.vendor,
        controllerReported: p.controllerReported,
      })),
      networkAdapters: adapters.map((a) => ({
        dn: a.dn,
        id: a.id,
        model: a.model,
        vendor: a.vendor,
        serial: a.serial,
        presence: a.presence,
      })),
      storageControllers: controllers.map((c) => ({
        dn: c.dn,
        id: c.id,
        model: c.model,
        vendor: c.vendor,
        serial: c.serial,
        raidSupport: c.raidSupport,
        type: c.type,
        presence: c.presence,
      })),
      firmwareVersions: firmware.map((f) => ({
        dn: f.dn,
        type: f.type,
        version: f.version,
        deployment: f.deployment,
      })),
    },
    null,
    2,
  );
}
