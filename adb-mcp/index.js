#!/usr/bin/env node

const { execSync } = require('child_process');
const express = require('express');
const cors = require('cors');
const { program } = require('commander');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

const BRAND = 'Elysium Vanguard Agent';

function runAdb(cmd) {
  try {
    const stdout = execSync(`adb ${cmd}`).toString();
    return { success: true, output: stdout.trim() };
  } catch (err) {
    return { success: false, output: err.message || err.toString() };
  }
}

// -------------------------------------------------------------
// 1. CLI LAYER
// -------------------------------------------------------------
program
  .name('elysium-adb')
  .description(`${BRAND} - Native Over-The-Air ADB Controller`);

program.command('cli <cmd...>')
  .description('Instruir a Elysium ejecutar un comando ADB directamente')
  .action((cmdArgs) => {
    const cmdStr = cmdArgs.join(' ');
    console.log(`[${BRAND}] Overriding ADB: ${cmdStr}`);
    const res = runAdb(cmdStr);
    console.log(res.output);
    process.exit(res.success ? 0 : 1);
  });

// -------------------------------------------------------------
// 2. REST API LAYER
// -------------------------------------------------------------
program.command('api')
  .description(`Arrancar Bridge REST API del ${BRAND}`)
  .option('-p, --port <number>', 'Port to listen on', 5050)
  .action((options) => {
    const app = express();
    app.use(cors());
    app.use(express.json());

    app.post('/api/adb', (req, res) => {
      const { command } = req.body;
      if (!command) return res.status(400).json({ error: 'Command required' });
      const result = runAdb(command);
      res.json(result);
    });

    app.listen(options.port, () => {
      console.log(`[${BRAND}] REST ADB Core online at port ${options.port}`);
    });
  });

// -------------------------------------------------------------
// 3. MCP SERVER LAYER (STDIO)
// -------------------------------------------------------------
program.command('mcp')
  .description(`Exposer el Hardware MCP Server a ${BRAND}`)
  .action(async () => {
    const server = new Server(
      { name: 'elysium-vanguard-adb-mcp', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'elysium_adb_execute',
          description: `(Elysium Vanguard Agent) Ejecuta comandos ADB nativos vía Shizuku TCP/IP (instalar apks silenciosamente, inyectar taps, leer logcat).`,
          inputSchema: {
            type: 'object',
            properties: {
              command: { type: 'string', description: 'El comando ADB (ej: install app.apk, shell input tap 500 500, connect 192.168.0.2:5555)' },
            },
            required: ['command']
          }
        },
        {
          name: 'elysium_get_hardware_status',
          description: `Obtiene el estado físico del dispositivo (Batería, Temperatura, Red). Úsalo para decidir si es seguro realizar compilaciones pesadas.`,
          inputSchema: {
            type: 'object',
            properties: {
              component: { type: 'string', enum: ['battery', 'thermal', 'all'], description: 'Qué componente monitorear.' }
            },
            required: ['component']
          }
        }
      ]
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === 'elysium_adb_execute') {
        const { command } = request.params.arguments;
        const res = runAdb(command);
        return {
          content: [{ type: 'text', text: res.output || 'success' }],
          isError: !res.success,
        };
      }

      if (request.params.name === 'elysium_get_hardware_status') {
        const { component } = request.params.arguments;
        let output = "";
        if (component === 'battery' || component === 'all') {
          output += "\n[BATTERY]\n" + runAdb("shell dumpsys battery").output;
        }
        if (component === 'thermal' || component === 'all') {
          output += "\n[THERMAL]\n" + runAdb("shell dumpsys thermalservice").output;
        }
        return {
          content: [{ type: 'text', text: output.trim() }],
          isError: false,
        };
      }
      throw new Error(`[${BRAND}] Error: Herramienta no autorizada`);
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
  });

program.parse();
