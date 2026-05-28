import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const nodeBin = process.execPath;
const workspace = process.cwd();
const ngScript = resolve(workspace, 'node_modules/@angular/cli/bin/ng.js');
const angularArgs = process.argv.slice(2);

const configRun = spawnSync(nodeBin, [resolve(workspace, 'scripts/write-runtime-config.mjs')], {
  cwd: workspace,
  stdio: 'inherit'
});

if (configRun.status !== 0) {
  process.exit(configRun.status ?? 1);
}

const apiServer = spawn(nodeBin, [resolve(workspace, 'scripts/request-dev-server.mjs')], {
  cwd: workspace,
  stdio: 'inherit'
});

const angularServer = spawn(nodeBin, [ngScript, 'serve', '--proxy-config', 'proxy.conf.json', ...angularArgs], {
  cwd: workspace,
  stdio: 'inherit'
});

let shuttingDown = false;

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(0));
}

apiServer.on('exit', (code) => {
  if (!shuttingDown) {
    console.error('[orionplay] Local request API exited unexpectedly.');
    shutdown(code ?? 1);
  }
});

angularServer.on('exit', (code) => {
  shutdown(code ?? 0);
});

function shutdown(exitCode) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  apiServer.kill();
  angularServer.kill();
  process.exit(exitCode);
}
