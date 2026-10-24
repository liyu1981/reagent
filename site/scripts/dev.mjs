import { spawn, spawnSync } from 'node:child_process';

const useShell = process.platform === 'win32';
const probe = spawnSync('oj', ['--version'], { stdio: 'ignore', shell: useShell });
const hasOj = probe.error === undefined && probe.status === 0;

const command = hasOj ? 'oj' : 'vite';
const args = hasOj ? ['dev'] : [];

console.log(`[dev] starting ${[command, ...args].join(' ')}`);

const child = spawn(command, args, { stdio: 'inherit', shell: useShell });

child.on('error', error => {
  console.error(`[dev] failed to start ${command}:`, error);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal !== null) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
