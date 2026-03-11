# cimc-mcp

MCP server for Cisco CIMC (Integrated Management Controller) — manage standalone C-Series rack servers through the XML API.

## Features

16 tools covering full server lifecycle management:

| Tool                    | Description                                                 |
| ----------------------- | ----------------------------------------------------------- |
| `get_server_summary`    | Power state, model, serial, CPU/memory counts, operability  |
| `get_server_health`     | Composite health: DIMMs, PSUs, fans, storage, temps, faults |
| `get_sensors`           | Fan speeds, PSU readings, temperature data                  |
| `get_inventory`         | CPUs, DIMMs, PCI cards, NICs, storage controllers           |
| `get_faults`            | Active faults with severity filtering                       |
| `power_control`         | Power on/off/cycle/reset/shutdown (confirmation required)   |
| `get_storage_summary`   | RAID controllers, virtual drives, physical disks            |
| `get_bios_settings`     | All BIOS token values                                       |
| `set_bios_setting`      | Modify BIOS tokens (confirmation required, reboot to apply) |
| `get_network_adapters`  | NICs, MAC addresses, port details                           |
| `get_firmware_versions` | CIMC, BIOS, storage controller, NIC firmware                |
| `get_power_stats`       | Input voltage, current, consumed power                      |
| `get_thermal_stats`     | CPU/memory/ambient temps, fan speeds                        |
| `get_event_log`         | System event log entries                                    |
| `set_locator_led`       | Chassis locator LED on/off                                  |
| `sol_configure`         | Serial over LAN enable/disable/baud rate                    |

## Requirements

- Node.js 22+
- macOS with `/usr/bin/curl` (uses system curl for network routing to BMC interfaces)
- Network access to CIMC management interface

## Setup

```bash
git clone https://github.com/schwarztim/cimc-mcp.git
cd cimc-mcp
npm install
npm run build
```

### Environment Variables

```bash
cp .env.example .env
# Edit .env with your CIMC credentials
```

| Variable          | Default         | Description                     |
| ----------------- | --------------- | ------------------------------- |
| `CIMC_HOST`       | `192.168.88.10` | CIMC BMC IP address             |
| `CIMC_USERNAME`   | `admin`         | Login username                  |
| `CIMC_PASSWORD`   | _(required)_    | Login password                  |
| `CIMC_VERIFY_TLS` | `false`         | Verify TLS certificates         |
| `CIMC_INTERFACE`  | _(none)_        | Local network interface to bind |

## Usage

### Claude Code

Add to `~/.claude/user-mcps.json`:

```json
{
  "mcpServers": {
    "cimc": {
      "command": "node",
      "args": ["/path/to/cimc-mcp/dist/index.js"],
      "env": {
        "CIMC_HOST": "192.168.88.10",
        "CIMC_USERNAME": "admin",
        "CIMC_PASSWORD": "your-password"
      }
    }
  }
}
```

### Standalone

```bash
CIMC_HOST=192.168.88.10 CIMC_USERNAME=admin CIMC_PASSWORD=changeme npm start
```

## How It Works

All communication goes through the CIMC XML API — a single POST endpoint at `https://{host}/nuova`. The server:

1. Authenticates via `aaaLogin` to get a session cookie (600s TTL)
2. Caches and auto-refreshes the session before expiry
3. Serializes all requests to avoid overloading the resource-constrained BMC
4. Parses XML responses and normalizes single-item/array inconsistencies

### macOS Network Note

CIMC BMCs are typically on isolated management networks reachable via a dedicated interface. On macOS, only system binaries (`/usr/bin/curl`) have the network entitlements to route across interfaces. This server uses system curl as its HTTP transport instead of Node.js `https` for this reason.

## Compatibility

Tested on:

- Cisco UCS C220 M4 (CIMC 2.0(10l))

Should work with any standalone C-Series server running CIMC 2.x or later. UCS Manager-managed servers use a different API and are not supported.

## Development

```bash
npm run dev          # Run with tsx (hot reload)
npm test             # Run tests
npm run build        # Compile TypeScript
```

## License

MIT
