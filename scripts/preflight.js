#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { ROOT } from './paths.js';

const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';

const STEPS = [
  {
    name: 'duplicate audit',
    command: process.execPath,
    args: ['scripts/check-duplicate.js', '--audit', '--public'],
  },
  {
    name: 'content consistency audit',
    command: npmCommand,
    args: ['run', 'audit:consistency'],
    windowsCommand: 'npm.cmd run audit:consistency',
  },
  {
    name: 'build',
    command: npmCommand,
    args: ['run', 'build'],
    windowsCommand: 'npm.cmd run build',
  },
];

function runStep(step) {
  return new Promise((resolve) => {
    console.log(`\n[preflight] ${step.name}`);
    let child;
    try {
      const command = isWindows && step.windowsCommand ? (process.env.ComSpec || 'cmd.exe') : step.command;
      const args = isWindows && step.windowsCommand
        ? ['/d', '/s', '/c', step.windowsCommand]
        : step.args;

      child = spawn(command, args, {
        cwd: ROOT,
        stdio: 'inherit',
        shell: false,
      });
    } catch (error) {
      console.error(`[preflight] ${step.name} failed to start: ${error.message}`);
      resolve(1);
      return;
    }

    child.on('error', (error) => {
      console.error(`[preflight] ${step.name} failed to start: ${error.message}`);
      resolve(1);
    });

    child.on('close', (code) => {
      resolve(code ?? 1);
    });
  });
}

for (const step of STEPS) {
  const code = await runStep(step);
  if (code !== 0) {
    console.error(`\npreflight NG - ${step.name} failed with exit code ${code}`);
    process.exit(code);
  }
}

console.log('\npreflight OK - 公開可能');
