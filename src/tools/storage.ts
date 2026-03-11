import { z } from "zod";
import { resolveClass } from "../utils/client.js";

export const getStorageSummaryDef = {
  name: "get_storage_summary",
  description:
    "Storage subsystem overview: RAID controllers, virtual drives (arrays), and physical disks with health and status.",
  inputSchema: z.object({}),
};

export async function getStorageSummary(): Promise<string> {
  // Sequential calls
  const controllers = await resolveClass("storageController");
  const vdrives = await resolveClass("storageVirtualDrive");
  const pdisks = await resolveClass("storageLocalDisk");
  const batteries = await resolveClass("storageRaidBattery");

  return JSON.stringify(
    {
      controllers: controllers.map((c) => ({
        dn: c.dn,
        id: c.id,
        model: c.model,
        vendor: c.vendor,
        serial: c.serial,
        raidSupport: c.raidSupport,
        type: c.type,
        presence: c.presence,
        pciSlot: c.pciSlot,
        firmwareVersion: c.firmwareVersion,
      })),
      virtualDrives: vdrives.map((v) => ({
        dn: v.dn,
        id: v.id,
        name: v.name,
        size: v.size,
        raidLevel: v.raidLevel,
        health: v.health,
        driveState: v.driveState,
        stripSize: v.stripSize,
        accessPolicy: v.accessPolicy,
        readPolicy: v.readPolicy,
        writePolicy: v.writePolicy,
      })),
      physicalDisks: pdisks.map((p) => ({
        dn: p.dn,
        id: p.id,
        vendor: p.vendor,
        model: p.model,
        serial: p.serial,
        size: p.coercedSize,
        status: p.pdStatus,
        linkSpeed: p.linkSpeed,
        mediaType: p.mediaType,
        predictiveFailureCount: p.predictiveFailureCount,
        driveState: p.driveState,
      })),
      raidBatteries: batteries.map((b) => ({
        dn: b.dn,
        type: b.type,
        present: b.present,
        status: b.status,
        chargeStatus: b.chargeStatus,
        health: b.health,
        learnMode: b.learnMode,
      })),
    },
    null,
    2,
  );
}
