#!/usr/bin/env node
/**
 * Copies the pure `src/domain/` modules the Edge Functions use into
 * `supabase/functions/_shared/domain/`, so `supabase functions deploy` bundles
 * them from inside `supabase/functions` like any shared code. Relative imports
 * get their `.ts` extension, which Deno needs.
 *
 *   node scripts/sync-function-domain.js          # write the copies
 *   node scripts/sync-function-domain.js --check  # fail if they are out of date (npm run check, CI)
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'src/domain');
const targetDir = path.join(root, 'supabase/functions/_shared/domain');
/** The modules the functions import; their own imports are followed. */
const entries = ['campaigns.ts'];

const importPattern = /(\bfrom\s+'|\bimport\s+')\.\/([\w-]+)'/g;

function generate() {
  const out = new Map();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.shift();
    if (out.has(file)) continue;
    const source = fs.readFileSync(path.join(sourceDir, file), 'utf8').replace(/\r\n/g, '\n');
    const body = source.replace(importPattern, (_match, prefix, name) => {
      queue.push(`${name}.ts`);
      return `${prefix}./${name}.ts'`;
    });
    out.set(
      file,
      `// Generated from src/domain/${file} by scripts/sync-function-domain.js. Do not edit.\n${body}`,
    );
  }
  return out;
}

const expected = generate();
const existing = fs.existsSync(targetDir) ? fs.readdirSync(targetDir).filter((f) => f.endsWith('.ts')) : [];

if (process.argv.includes('--check')) {
  const stale = [...expected].filter(([file, text]) => {
    const target = path.join(targetDir, file);
    // Line endings can change on checkout (core.autocrlf); only the text matters.
    return !fs.existsSync(target) || fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== text;
  });
  const extra = existing.filter((file) => !expected.has(file));
  if (stale.length > 0 || extra.length > 0) {
    console.error(
      `supabase/functions/_shared/domain is out of date (${[...stale.map(([f]) => f), ...extra].join(', ')}). ` +
        'Run: node scripts/sync-function-domain.js',
    );
    process.exit(1);
  }
  console.log(`supabase/functions/_shared/domain matches src/domain (${expected.size} files).`);
} else {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const file of existing) if (!expected.has(file)) fs.rmSync(path.join(targetDir, file));
  for (const [file, text] of expected) fs.writeFileSync(path.join(targetDir, file), text);
  console.log(`Wrote ${expected.size} files to supabase/functions/_shared/domain.`);
}
