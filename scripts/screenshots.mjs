#!/usr/bin/env node
// Captures Play Store phone screenshots from a connected Android device.
//   node scripts/screenshots.mjs
// Needs adb (Android platform-tools) and one device with the app installed and
// unlocked. Pauses before each shot: navigate, then press Enter. Files go to
// fastlane/metadata/android/en-US/images/phoneScreenshots/01.png ... 05.png
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'fastlane/metadata/android/en-US/images/phoneScreenshots');
const SCREENS = ['pantry', 'item detail', 'shopping list', 'add item', 'settings'];
function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function checkAdb() {
  const probe = spawnSync('adb', ['version'], { encoding: 'utf8' });
  if (probe.error) fail('adb not found. Install Android platform-tools and put adb on your PATH.');
  if (probe.status !== 0) fail(`adb is not working:\n${probe.stderr || probe.stdout}`);

  const devices = spawnSync('adb', ['devices'], { encoding: 'utf8' });
  if (devices.status !== 0) {
    fail(`could not list devices:\n${devices.stderr || devices.stdout}`);
  }
  const attached = devices.stdout
    .split('\n')
    .slice(1)
    .map(line => line.trim().split(/\s+/))
    .filter(parts => parts[1] === 'device');
  if (attached.length === 0) {
    fail('no device attached. Connect a phone with USB debugging on (or boot an emulator).');
  }
  console.log(`device: ${attached[0][0]}`);
}

function capture(index) {
  const png = execFileSync('adb', ['exec-out', 'screencap', '-p'], {
    maxBuffer: 32 * 1024 * 1024,
  });
  if (png.length === 0) fail('screencap returned no data; is the device unlocked?');
  const path = join(OUT_DIR, `${String(index + 1).padStart(2, '0')}.png`);
  writeFileSync(path, png);
  console.log(`wrote ${path}`);
}

async function main() {
  checkAdb();
  mkdirSync(OUT_DIR, { recursive: true });
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    for (let i = 0; i < SCREENS.length; i++) {
      await rl.question(`Navigate to "${SCREENS[i]}", then press Enter to capture: `);
      capture(i);
    }
  } finally {
    rl.close();
  }
  console.log(`done: ${SCREENS.length} screenshots in ${OUT_DIR}`);
}

main().catch(error => fail(error.message));
