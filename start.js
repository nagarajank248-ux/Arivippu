const { spawn } = require('child_process');
const path = require('path');

function runCommand(command, args, dir, label, colorCode) {
  const isWindows = process.platform === 'win32';
  const cmd = isWindows ? 'cmd.exe' : command;
  const cmdArgs = isWindows ? ['/c', command, ...args] : args;

  const child = spawn(cmd, cmdArgs, {
    cwd: dir,
    stdio: ['inherit', 'pipe', 'pipe']
  });

  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.log(`\x1b[${colorCode}m[${label}]\x1b[0m ${line.trim()}`);
      }
    });
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.error(`\x1b[31m[${label} ERROR]\x1b[0m ${line.trim()}`);
      }
    });
  });

  return child;
}

console.log('\x1b[35m%s\x1b[0m', '===============================================');
console.log('\x1b[35m%s\x1b[0m', '   ARIVIPPU - Campaign Orchestration Platform  ');
console.log('\x1b[35m%s\x1b[0m', '   Your Message, Delivered at the Right Time.  ');
console.log('\x1b[35m%s\x1b[0m', '===============================================');
console.log('Starting services...');

const backendDir = path.join(__dirname, 'backend');
const frontendDir = path.join(__dirname, 'frontend');

// Start Express Backend on port 5000 (Color 36: Cyan)
const backendProcess = runCommand('npm', ['start'], backendDir, 'Backend', '36');

// Start Vite Frontend on port 5173 (Color 35: Magenta)
const frontendProcess = runCommand('npm', ['run', 'dev'], frontendDir, 'Frontend', '35');

// Clean up processes on exit
process.on('SIGINT', () => {
  console.log('\nShutting down Arivippu services...');
  backendProcess.kill();
  frontendProcess.kill();
  process.exit();
});

process.on('SIGTERM', () => {
  backendProcess.kill();
  frontendProcess.kill();
  process.exit();
});
