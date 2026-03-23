#!/usr/bin/env node

const { program } = require('commander');
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const BRAND = 'Elysium Vanguard Agent';
const BASE_DIR = '/Users/Jorge/Downloads/Apps programadas/Celular/Elysium Vanguard Agent';

program
  .name('elysium')
  .description(`Sovereign Command Center for ${BRAND}`)
  .version('1.0.0');

// 1. BACKEND COMMANDS
const backend = program.command('backend').description('Manage Communications Backend');
backend
  .command('start')
  .description('Launch the WebSocket Backend')
  .action(() => {
    console.log(`[${BRAND}] Launching Communications Node...`);
    const p = spawn('node', [path.join(BASE_DIR, 'backend', 'index.js')], { stdio: 'inherit' });
    p.on('exit', (code) => console.log(`Backend exited with code ${code}`));
  });

// 2. ADB COMMANDS (BRIDGING TO elysium-adb)
const adb = program.command('adb').description('Hardware Control & Remote Install');
adb
  .command('cli <cmd...>')
  .description('Direct ADB instruction (Shizuku Bridge)')
  .action((cmdArgs) => {
    const cmdStr = cmdArgs.join(' ');
    spawn('node', [path.join(BASE_DIR, 'adb-mcp', 'index.js'), 'cli', ...cmdArgs], { stdio: 'inherit' });
  });

adb
  .command('api')
  .description('Start ADB REST Bridge')
  .action(() => {
    spawn('node', [path.join(BASE_DIR, 'adb-mcp', 'index.js'), 'api'], { stdio: 'inherit' });
  });

adb
  .command('mcp')
  .description('Start ADB MCP Stdio Server (for Gemini/IDE)')
  .action(() => {
    spawn('node', [path.join(BASE_DIR, 'adb-mcp', 'index.js'), 'mcp'], { stdio: 'inherit' });
  });

// 3. SYSTEM COMMANDS
program
  .command('info')
  .description('Sovereign System Status')
  .action(() => {
    console.log(`\n=== ${BRAND} ===`);
    console.log(`Base: ${BASE_DIR}`);
    console.log(`Model: deepseek-r1:8b (Sovereign Local)`);
    console.log(`Infrastructure: n8n, Ollama, Docker, CLI-Anything`);
    console.log(`\n"The Assistant is dead. The Infrastructure lives."\n`);
  });

program.parse();
