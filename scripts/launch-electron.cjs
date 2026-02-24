// Ensure ELECTRON_RUN_AS_NODE is not set, so Electron starts as a proper app
delete process.env.ELECTRON_RUN_AS_NODE;
const { spawn } = require('child_process');
const electronPath = require('electron');
const child = spawn(electronPath, ['.'], { stdio: 'inherit' });
child.on('close', (code) => process.exit(code));
