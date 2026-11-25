#!/usr/bin/env node
// Expands permissions-fleet.json (the declared fleet operator permissions) into
// permissions.allow of settings.project.json. Existing allow entries are kept;
// generated entries are added once (deduplicated, stable order). Run after
// editing permissions-fleet.json, then regenerate the mirrors with the dotfiles
// engine. `--check` exits 1 when settings.project.json is missing any expanded rule.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const declPath = join(here, 'permissions-fleet.json');
const settingsPath = join(here, 'settings.project.json');

export function expand(decl) {
  const rules = [];
  for (const [cmd, subs] of Object.entries(decl.commands || {})) {
    if (!subs.length) { rules.push(`Bash(${cmd} *)`); continue; }
    for (const sub of subs) {
      rules.push(`Bash(${cmd} ${sub})`);
      rules.push(`Bash(${cmd} ${sub} *)`);
    }
  }
  for (const t of decl.tools || []) rules.push(t);
  return [...new Set(rules)];
}

const decl = JSON.parse(readFileSync(declPath, 'utf8'));
const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
const allow = settings.permissions.allow;
const wanted = expand(decl);
const missing = wanted.filter((r) => !allow.includes(r));

if (process.argv.includes('--check')) {
  if (missing.length) { console.error(`missing ${missing.length} declared rules, e.g. ${missing[0]}`); process.exit(1); }
  console.log(`ok: all ${wanted.length} declared rules present`);
  process.exit(0);
}
settings.permissions.allow = [...allow, ...missing];
writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
console.log(`added ${missing.length} rules (${wanted.length} declared, ${settings.permissions.allow.length} total allow)`);
