#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";
import { logout } from "./auth/session.js";

// Tool imports
import {
  getServerSummaryDef,
  getServerSummary,
  getSensorsDef,
  getSensors,
  getServerHealthDef,
  getServerHealth,
  getInventoryDef,
  getInventory,
} from "./tools/server.js";
import { powerControlDef, powerControl } from "./tools/power.js";
import { getFaultsDef, getFaults } from "./tools/faults.js";
import { getStorageSummaryDef, getStorageSummary } from "./tools/storage.js";
import {
  getBiosSettingsDef,
  getBiosSettings,
  setBiosSettingDef,
  setBiosSetting,
} from "./tools/bios.js";
import { getNetworkAdaptersDef, getNetworkAdapters } from "./tools/network.js";
import {
  getFirmwareVersionsDef,
  getFirmwareVersions,
} from "./tools/firmware.js";
import { setLocatorLedDef, setLocatorLed } from "./tools/led.js";
import { getEventLogDef, getEventLog } from "./tools/eventlog.js";
import {
  getPowerStatsDef,
  getPowerStats,
  getThermalStatsDef,
  getThermalStats,
} from "./tools/thermal.js";
import { solConfigureDef, solConfigure } from "./tools/sol.js";

const server = new McpServer({
  name: "cimc",
  version: "1.0.0",
});

// Helper to wrap tool handlers with error handling
function wrapHandler<T>(
  handler: (input: T) => Promise<string>,
): (input: T) => Promise<{ content: Array<{ type: "text"; text: string }> }> {
  return async (input: T) => {
    try {
      const text = await handler(input);
      return { content: [{ type: "text" as const, text }] };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
      };
    }
  };
}

// Register all 16 tools

// High Priority (6)
server.tool(
  getServerSummaryDef.name,
  getServerSummaryDef.description,
  getServerSummaryDef.inputSchema.shape,
  wrapHandler(getServerSummary),
);

server.tool(
  getSensorsDef.name,
  getSensorsDef.description,
  getSensorsDef.inputSchema.shape,
  wrapHandler(getSensors),
);

server.tool(
  powerControlDef.name,
  powerControlDef.description,
  powerControlDef.inputSchema.shape,
  wrapHandler(powerControl),
);

server.tool(
  getFaultsDef.name,
  getFaultsDef.description,
  getFaultsDef.inputSchema.shape,
  wrapHandler(getFaults),
);

server.tool(
  getServerHealthDef.name,
  getServerHealthDef.description,
  getServerHealthDef.inputSchema.shape,
  wrapHandler(getServerHealth),
);

server.tool(
  getInventoryDef.name,
  getInventoryDef.description,
  getInventoryDef.inputSchema.shape,
  wrapHandler(getInventory),
);

// Medium Priority (10)
server.tool(
  getStorageSummaryDef.name,
  getStorageSummaryDef.description,
  getStorageSummaryDef.inputSchema.shape,
  wrapHandler(getStorageSummary),
);

server.tool(
  getBiosSettingsDef.name,
  getBiosSettingsDef.description,
  getBiosSettingsDef.inputSchema.shape,
  wrapHandler(getBiosSettings),
);

server.tool(
  setBiosSettingDef.name,
  setBiosSettingDef.description,
  setBiosSettingDef.inputSchema.shape,
  wrapHandler(setBiosSetting),
);

server.tool(
  getNetworkAdaptersDef.name,
  getNetworkAdaptersDef.description,
  getNetworkAdaptersDef.inputSchema.shape,
  wrapHandler(getNetworkAdapters),
);

server.tool(
  getFirmwareVersionsDef.name,
  getFirmwareVersionsDef.description,
  getFirmwareVersionsDef.inputSchema.shape,
  wrapHandler(getFirmwareVersions),
);

server.tool(
  setLocatorLedDef.name,
  setLocatorLedDef.description,
  setLocatorLedDef.inputSchema.shape,
  wrapHandler(setLocatorLed),
);

server.tool(
  getEventLogDef.name,
  getEventLogDef.description,
  getEventLogDef.inputSchema.shape,
  wrapHandler(getEventLog),
);

server.tool(
  getPowerStatsDef.name,
  getPowerStatsDef.description,
  getPowerStatsDef.inputSchema.shape,
  wrapHandler(getPowerStats),
);

server.tool(
  getThermalStatsDef.name,
  getThermalStatsDef.description,
  getThermalStatsDef.inputSchema.shape,
  wrapHandler(getThermalStats),
);

server.tool(
  solConfigureDef.name,
  solConfigureDef.description,
  solConfigureDef.inputSchema.shape,
  wrapHandler(solConfigure),
);

// Graceful shutdown — logout session
async function shutdown() {
  try {
    await logout();
  } catch {
    // Best effort
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const useHttp = process.env.MCP_TRANSPORT === "http";

if (useHttp) {
  const port = parseInt(process.env.MCP_PORT || "21488", 10);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  const httpServer = createServer(async (req, res) => {
    await transport.handleRequest(req, res);
  });
  httpServer.listen(port, "0.0.0.0", () => {
    console.error(`CIMC MCP server listening on port ${port}`);
  });
} else {
  const transport = new StdioServerTransport();
  server.connect(transport).catch((err) => {
    console.error("Failed to start CIMC MCP server:", err);
    process.exit(1);
  });
}
