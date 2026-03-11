import { z } from "zod";
import { resolveClass, resolveDn } from "../utils/client.js";

export const getPowerStatsDef = {
  name: "get_power_stats",
  description:
    "Detailed power consumption statistics: input voltage, current, consumed power, and power budget.",
  inputSchema: z.object({}),
};

export async function getPowerStats(): Promise<string> {
  const mbPower = await resolveClass("computeMbPowerStats");
  const psus = await resolveClass("equipmentPsu");
  const budget = await resolveClass("powerBudget");

  return JSON.stringify(
    {
      motherboardPower: mbPower.map((p) => ({
        dn: p.dn,
        consumedPower: p.consumedPower,
        inputCurrent: p.inputCurrent,
        inputVoltage: p.inputVoltage,
      })),
      powerSupplies: psus.map((p) => ({
        dn: p.dn,
        id: p.id,
        power: p.power,
        voltage: p.voltage,
        thermal: p.thermal,
        operability: p.operability,
      })),
      powerBudget: budget.map((b) => ({
        dn: b.dn,
        powerConsumed: b.powerConsumed,
        powerAvailable: b.powerAvailable,
        powerCap: b.powerCap,
        powerCharacterization: b.powerCharacterization,
      })),
    },
    null,
    2,
  );
}

export const getThermalStatsDef = {
  name: "get_thermal_stats",
  description:
    "Detailed thermal readings: CPU temperatures, memory temperatures, ambient, and fan speeds for all zones.",
  inputSchema: z.object({}),
};

export async function getThermalStats(): Promise<string> {
  const cpuEnv = await resolveClass("processorEnvStats");
  const memEnv = await resolveClass("memoryEnvStats");
  const fans = await resolveClass("equipmentFan");
  const server = await resolveDn("sys/rack-unit-1");

  return JSON.stringify(
    {
      ambientTemp: server?.ambientTemp || "unknown",
      cpuTemperatures: cpuEnv.map((c) => ({
        dn: c.dn,
        temperature: c.temperature,
      })),
      memoryTemperatures: memEnv.map((m) => ({
        dn: m.dn,
        temperature: m.temperature,
      })),
      fans: fans.map((f) => ({
        dn: f.dn,
        id: f.id,
        speed: f.speed,
        operability: f.operability,
      })),
    },
    null,
    2,
  );
}
