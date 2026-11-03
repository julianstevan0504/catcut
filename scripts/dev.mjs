import { spawn } from 'node:child_process';
const children = [
  spawn(process.execPath, ['--use-env-proxy', '--watch', 'server/index.mjs'], { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0'], { stdio: 'inherit' }),
];
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  children.forEach(child => child.kill(signal));
  process.exit(0);
});
for (const child of children) child.on('exit', code => {
  children.forEach(other => { if (other !== child) other.kill(); });
  process.exit(code ?? 1);
});
