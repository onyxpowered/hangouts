#!/usr/bin/env node
// Maintainer tool for the Hangouts catalog. Node 18+. No dependencies.
//   node tools/publish.mjs add <file.hngts> --id x --title "X" --category essentials|socials|originals
//        [--season manifesto] [--creator name] [--version 1.0.0] [--subtitle ..] [--tagline ..]
//        [--description ..] [--poster path.png] [--shot a.png --shot b.png] [--featured] [--seal <sig>]
//   node tools/publish.mjs check            validate the catalog the way Zero reads it
//   node tools/publish.mjs publish "msg"    commit, push, purge jsDelivr for every changed file
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'onyxpowered/hangouts', REF = 'main';
const SEASONS = 'HSNT', CATALOG = 'NAGO/UATH.json', POSTERS = 'NAGO/SOTA', SHOTS = 'NAGO/UGHN';
const PART = 19 * 1024 * 1024;           // Zero's limit is 20 MB per part
const ID = /^[a-z0-9][a-z0-9._-]{0,63}$/, HEX = /^[0-9a-f]{64}$/;
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const fail = m => { console.error('error: ' + m); process.exit(1); };

function args(a) {
  const o = { _: [], shot: [] };
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith('--')) { o._.push(a[i]); continue; }
    const k = a[i].slice(2);
    if (k === 'featured') o.featured = true;
    else if (k === 'shot') o.shot.push(a[++i]);
    else o[k] = a[++i];
  }
  return o;
}
const load = () => JSON.parse(fs.readFileSync(path.join(ROOT, CATALOG), 'utf8'));
const save = c => fs.writeFileSync(path.join(ROOT, CATALOG), JSON.stringify(c, null, 2) + '\n');

function add(o) {
  const src = o._[1];
  if (!src || !fs.existsSync(src)) fail('give an existing .hngts file');
  if (!ID.test(o.id || '')) fail('--id must match ' + ID);
  if (!o.title) fail('--title required');
  const season = o.season || load().defaultSeason || 'manifesto';
  const category = o.category;
  if (!category) fail('--category required');
  if (category === 'originals' && !o.seal) fail('originals are dropped by Zero unless sealed; pass --seal');
  const buf = fs.readFileSync(src);
  const rel = `${SEASONS}/${season}/${category}/${o.id}`;
  const dir = path.join(ROOT, rel);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const names = [], partSha = [];
  if (buf.length <= PART) { fs.writeFileSync(path.join(dir, 'game.hngts'), buf); names.push('game.hngts'); partSha.push(sha(buf)); }
  else for (let i = 0, n = 1; i < buf.length; i += PART, n++) {
    const p = buf.subarray(i, i + PART), nm = `game.hngts.part${n}`;
    fs.writeFileSync(path.join(dir, nm), p); names.push(nm); partSha.push(sha(p));
  }
  if (names.length > 64) fail('too many parts');
  const media = (f, base) => {
    if (!f) return undefined;
    const nm = `${o.id}-${path.basename(f)}`;
    fs.copyFileSync(f, path.join(ROOT, base, nm));
    return `${base}/${nm}`;
  };
  const e = {
    id: o.id, title: o.title, subtitle: o.subtitle, tagline: o.tagline, description: o.description,
    creator: o.creator, version: o.version, season, category,
    hngts: names.map(n => `${rel}/${n}`), sha256: sha(buf), partSha, bytes: buf.length,
    poster: media(o.poster, POSTERS), screenshots: o.shot.length ? o.shot.map(f => media(f, SHOTS)) : undefined,
    featured: o.featured || undefined, seal: o.seal, added: Math.floor(Date.now() / 1000)
  };
  for (const k of Object.keys(e)) if (e[k] === undefined) delete e[k];
  const c = load();
  const i = c.games.findIndex(g => g.id === o.id);
  if (i >= 0) { e.added = c.games[i].added || e.added; c.games[i] = e; } else c.games.push(e);
  save(c);
  console.log(`${o.id}: ${names.length} part(s), ${buf.length} bytes, sha256 ${e.sha256}`);
}

function check() {
  const c = load();
  const cats = new Set(['originals', 'essentials', 'socials', ...(c.categories || []).map(x => x.id)]);
  const seen = new Set();
  let bad = 0;
  const no = m => { console.error('  ✗ ' + m); bad++; };
  for (const g of c.games) {
    if (!ID.test(g.id || '')) { no(`bad id ${g.id}`); continue; }
    if (seen.has(g.id)) no(`duplicate ${g.id}`); seen.add(g.id);
    if (!cats.has(g.category)) no(`${g.id}: unknown category ${g.category}`);
    if (g.category === 'originals' && !g.seal) no(`${g.id}: originals need a seal`);
    if (g.soon) continue;
    const pre = `${SEASONS}/${g.season}/${g.category}/${g.id}/`;
    if (!HEX.test(g.sha256 || '')) no(`${g.id}: sha256`);
    if (!Array.isArray(g.hngts) || !g.hngts.length || g.hngts.length > 64) { no(`${g.id}: hngts`); continue; }
    if (g.partSha && g.partSha.length !== g.hngts.length) no(`${g.id}: partSha count`);
    const chunks = [];
    g.hngts.forEach((p, i) => {
      if (!p.startsWith(pre) || !/^game\.hngts(\.part[0-9]{1,3})?$/.test(p.slice(pre.length))) return no(`${g.id}: path ${p}`);
      const f = path.join(ROOT, p);
      if (!fs.existsSync(f)) return no(`${g.id}: missing ${p}`);
      const b = fs.readFileSync(f);
      if (b.length > 20 * 1024 * 1024) no(`${g.id}: ${p} over 20 MB`);
      if (g.partSha && sha(b) !== g.partSha[i]) no(`${g.id}: partSha mismatch ${p}`);
      chunks.push(b);
    });
    if (chunks.length === g.hngts.length && sha(Buffer.concat(chunks)) !== g.sha256) no(`${g.id}: sha256 mismatch`);
    for (const m of [g.poster, ...(g.screenshots || [])]) if (m && !fs.existsSync(path.join(ROOT, m))) no(`${g.id}: missing media ${m}`);
  }
  console.log(bad ? `${bad} problem(s)` : `ok, ${c.games.length} game(s)`);
  if (bad) process.exit(1);
}

async function publish(o) {
  check();
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
  git('add', '-A');
  if (!git('status', '--porcelain')) console.log('nothing to commit; purging anyway');
  else git('commit', '-m', o._[1] || 'publish');
  const before = (() => { try { return git('rev-parse', 'origin/' + REF); } catch { return null; } })();
  execFileSync('git', ['push', 'origin', 'HEAD:' + REF], { cwd: ROOT, stdio: 'inherit' });
  const files = before ? git('diff', '--name-only', before, 'HEAD').split('\n').filter(Boolean)
                       : git('ls-files').split('\n').filter(f => f && !f.endsWith('.gitkeep'));
  const paths = files.filter(f => f !== '.gitkeep' && !f.endsWith('/.gitkeep')).map(f => `/gh/${REPO}@${REF}/${f}`);
  if (!paths.length) return;
  for (let i = 0; i < paths.length; i += 20) {
    const r = await fetch('https://purge.jsdelivr.net/', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: paths.slice(i, i + 20) })
    });
    const j = await r.json().catch(() => ({}));
    console.log(`purge ${r.status}`, j.id || j.message || '');
  }
}

const o = args(process.argv.slice(2));
const cmd = o._[0];
if (cmd === 'add') add(o);
else if (cmd === 'check') check();
else if (cmd === 'publish') await publish(o);
else fail('commands: add | check | publish');
