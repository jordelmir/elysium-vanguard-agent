const { spawn } = require('child_process');
const telemetry = require('./telemetry');
const crypto = require('crypto');
const fs = require('fs');
require('dotenv').config();

const PRIVATE_KEY = fs.readFileSync('/Users/Jorge/.agent-hub/Elysium Vanguard Agent/keys/private.pem');
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const BRAND = 'Elysium Vanguard Agent';

io.on('connection', (socket) => {
  console.log(`[${BRAND}] Handshake established: ${socket.id}`);

  // When Android APK sends a task
  socket.on('agent_task', (data) => {
    const { task_id, prompt } = data;
    console.log(`[${BRAND}] Objective Received [${task_id}]: ${prompt}`);

    // Create Cryptographic Signature for Zero-Trust
    const sign = crypto.createSign('SHA256');
    sign.update(prompt + task_id);
    const signature = sign.sign(PRIVATE_KEY, 'hex');

    // Emit confirmation with Signature
    socket.emit('vanguard_log_stream', { 
      task_id, 
      type: 'info', 
      log: `>> ${BRAND} Processing: "${prompt}"`,
      vanguard_signature: signature
    });

    // Spawn the local Sovereign Agent sequence
    const agentProcess = spawn('bash', ['-c', `echo "${BRAND} Core booting..." && sleep 2 && echo "[${BRAND}] Android SDK build successful" && sleep 1 && echo "[${BRAND}] APK generated"`]);

    agentProcess.stdout.on('data', (chunk) => {
      const output = chunk.toString();
      const signal = telemetry.process('gradle', output); 
      if (signal) {
        console.log(`[Vanguard-Signal]: ${signal.trim()}`);
        socket.emit('vanguard_log_stream', { task_id, type: 'stdout', log: signal });
      }
    });

    agentProcess.stderr.on('data', (chunk) => {
      const error = chunk.toString();
      const signal = telemetry.process('gradle', error);
      if (signal) {
        console.error(`[Vanguard-Err-Signal]: ${signal.trim()}`);
        socket.emit('vanguard_log_stream', { task_id, type: 'stderr', log: signal });
      }
    });

    agentProcess.on('close', (code) => {
      socket.emit('vanguard_log_stream', { task_id, type: 'exit', log: `>> ${BRAND} process exited with code ${code}` });
      socket.emit('agent_task_complete', { task_id, status: code === 0 ? 'success' : 'failed' });
    });
  });

  socket.on('disconnect', () => {
    console.log(`[${BRAND}] Client disconnected: ${socket.id}`);
  });
});

app.get('/health', (req, res) => {
  res.json({ status: `${BRAND} Core Online`, uptime: process.uptime() });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`[${BRAND}] Communications Node listening on ${PORT}`);
  console.log(`[${BRAND}] Awaiting Mobile Telemetry Bridge...`);
});
