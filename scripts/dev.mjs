import { spawn } from 'node:child_process';

const processes = [
  spawn(process.execPath, ['scripts/local-server.mjs'], { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0'], { stdio: 'inherit' }),
];

let shuttingDown = false;
const shutdown = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  processes.forEach((child) => child.kill('SIGTERM'));
  setTimeout(() => process.exit(code), 100);
};

process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
processes.forEach((child) => child.on('exit', (code) => {
  if (!shuttingDown && code !== 0) shutdown(code || 1);
}));
