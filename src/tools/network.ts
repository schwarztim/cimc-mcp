import { z } from "zod";
import { resolveClass } from "../utils/client.js";

export const getNetworkAdaptersDef = {
  name: "get_network_adapters",
  description:
    "List all network adapters (NICs) with model, vendor, MAC addresses, and port details.",
  inputSchema: z.object({}),
};

export async function getNetworkAdapters(): Promise<string> {
  const adapters = await resolveClass("adaptorUnit", true);
  const extEth = await resolveClass("adaptorExtEthIf");
  const hostEth = await resolveClass("adaptorHostEthIf");
  const networkAdapters = await resolveClass("networkAdapterUnit");

  return JSON.stringify(
    {
      adapters: adapters.map((a) => ({
        dn: a.dn,
        id: a.id,
        model: a.model,
        vendor: a.vendor,
        serial: a.serial,
        presence: a.presence,
        cimc: a as Record<string, unknown>,
      })),
      externalPorts: extEth.map((e) => ({
        dn: e.dn,
        id: e.id,
        mac: e.mac,
        linkState: e.linkState,
        operSpeed: e.operSpeed,
        adminSpeed: e.adminSpeed,
      })),
      hostInterfaces: hostEth.map((h) => ({
        dn: h.dn,
        name: h.name,
        mac: h.mac,
        mtu: h.mtu,
        uplinkPort: h.uplinkPort,
      })),
      networkAdapters: networkAdapters.map((n) => ({
        dn: n.dn,
        model: n.model,
        numIntf: n.numIntf,
      })),
    },
    null,
    2,
  );
}
