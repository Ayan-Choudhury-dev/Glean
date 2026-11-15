#!/usr/bin/env node
//
// Catch the class of bug that shipped in 1.0.15: a `useState` value that is set
// but never read in the rendered tree, so a control changes state and the screen
// shows nothing.
//
//   node scripts/check-screen-wiring.mjs
//
// Heuristic, deliberately: for each screen, take everything from the first
// `return (` to the end of the component and require every `const [x, setX]` to
// mention `x` somewhere in that region. That region is the JSX plus the handlers
// it calls, which is exactly "what the user can see".

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['app', 'components'];

// State that is deliberately not rendered: it feeds a save path or a handler.
// Anything else that is set but never appears in the tree is a dead control.
const ALLOWED = new Set([
  'app/item-form.tsx:imageDirty',
  'app/scan.tsx:lastLocation',
  'components/ui/tappable.tsx:focused',
]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (path.endsWith('.tsx')) out.push(path);
  }
  return out;
}

const files = ROOTS.flatMap(root => walk(root));
const problems = [];

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const declarations = [...source.matchAll(/const \[(\w+),\s*set\w+\]\s*=\s*useState/g)];
  if (declarations.length === 0) continue;

  const returnAt = source.indexOf('return (');
  if (returnAt === -1) continue;
  const rendered = source.slice(returnAt);

  for (const [, value] of declarations) {
    const pattern = new RegExp(`\\b${value}\\b`);
    if (pattern.test(rendered)) continue;
    if (ALLOWED.has(`${file}:${value}`)) continue;
    problems.push(`${file}: \`${value}\` is set but never rendered`);
  }
}

if (problems.length) {
  console.error('Unrendered state:\n' + problems.map(p => `  ${p}`).join('\n'));
  process.exit(1);
}

console.log(`ok: ${files.length} files, every useState value reaches the tree`);
