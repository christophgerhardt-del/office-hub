// OfficeHub Hub – läuft auf dem Mac mini im Büro-Netz.
// Nimmt Schaltbefehle aus Supabase (Tabelle hub_commands) live entgegen, schaltet die Shellys direkt per IP
// und schreibt den echten Lampenzustand zurück (office_kv: lampStates, hubStatus).
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import os from 'node:os';
import { execFile } from 'node:child_process';
/* Shelly-Aufrufe über Apples curl: launchd-gestartete Drittprogramme (node) dürfen unter macOS
   ohne GUI-Freigabe nicht ins lokale Netz, Apples eigene Werkzeuge schon. */
function curlText(url, timeoutSec = 2) {
  return new Promise((resolve, reject) => {
    execFile('/usr/bin/curl', ['-s', '-S', '-m', String(timeoutSec), url], { timeout: (timeoutSec + 1) * 1000 }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || err.message || '').trim() || 'curl fehlgeschlagen')); else resolve(stdout);
    });
  });
}

const cfg = JSON.parse(fs.readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const OFFICE = cfg.office;
const log = (...a) => console.log(new Date().toISOString(), ...a);
const sb = createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false, autoRefreshToken: true } });

const { error: authErr } = await sb.auth.signInWithPassword({ email: cfg.email, password: cfg.password });
if (authErr) { log('Login fehlgeschlagen:', authErr.message); process.exit(1); }
log('Angemeldet als', cfg.email);

let lamps = [];
async function loadLamps() {
  const { data, error } = await sb.from('office_kv').select('value').eq('office_id', OFFICE).eq('key', 'shellys').maybeSingle();
  if (error) { log('Lampen laden:', error.message); return; }
  lamps = (data?.value || []).filter(d => d.ip && d.kind !== 'cover');
}
async function shellySet(d, on) {
  const ch = d.channel || 0;
  const url = d.gen === 'gen1' ? `http://${d.ip}/relay/${ch}?turn=${on ? 'on' : 'off'}` : `http://${d.ip}/rpc/Switch.Set?id=${ch}&on=${on}`;
  try { await curlText(url, 2.5); return true; } catch (e) { log('Schalten fehlgeschlagen', d.name, d.ip, e.message); return false; }
}
async function shellyGet(d) {
  const ch = d.channel || 0;
  const url = d.gen === 'gen1' ? `http://${d.ip}/relay/${ch}` : `http://${d.ip}/rpc/Switch.GetStatus?id=${ch}`;
  try { const j = JSON.parse(await curlText(url, 1.5)); return d.gen === 'gen1' ? !!j.ison : !!j.output; } catch (e) { return null; }
}
let lastStates = {}, lastWrite = 0, lastBeat = 0;
async function upsert(key, value) {
  const { error } = await sb.from('office_kv').upsert({ office_id: OFFICE, key, value, updated_at: new Date().toISOString() }, { onConflict: 'office_id,key' });
  if (error) log('Schreiben', key, error.message);
}
async function readStates(targets = lamps) {
  const pairs = await Promise.all(targets.map(async d => [d.id, await shellyGet(d)]));
  const states = { ...lastStates };
  for (const [id, on] of pairs) if (on !== null) states[id] = on;
  return states;
}
async function publishStates(states, force = false) {
  const changed = JSON.stringify(states) !== JSON.stringify(lastStates);
  lastStates = states;
  if (changed || force || Date.now() - lastWrite > 30000) { lastWrite = Date.now(); await upsert('lampStates', { states, updated: new Date().toISOString() }); }
}
async function heartbeat() { if (Date.now() - lastBeat > 25000) { lastBeat = Date.now(); await upsert('hubStatus', { online: true, updated: new Date().toISOString(), host: os.hostname(), lamps: lamps.length }); } }

async function handle(cmd) {
  const targets = cmd.type === 'all' ? lamps : lamps.filter(d => d.id === cmd.id);
  if (!targets.length) return { ok: false, error: 'Lampe unbekannt' };
  const results = await Promise.all(targets.map(async d => ({ id: d.id, name: d.name, ok: await shellySet(d, !!cmd.on) })));
  await new Promise(r => setTimeout(r, 250));
  await publishStates(await readStates(targets), true);
  return { ok: results.every(r => r.ok), results };
}
const seen = new Set();
async function run(c) {
  if (!c || seen.has(c.id)) return; seen.add(c.id); if (seen.size > 500) seen.delete(seen.values().next().value);
  let result;
  if (Date.now() - Date.parse(c.created_at) > 60000) result = { ok: false, error: 'veraltet' };
  else { log('Befehl', JSON.stringify(c.cmd)); result = await handle(c.cmd); }
  await sb.from('hub_commands').update({ done_at: new Date().toISOString(), result }).eq('id', c.id);
}
async function processOpen() {
  const { data, error } = await sb.from('hub_commands').select('*').eq('office_id', OFFICE).is('done_at', null).order('created_at').limit(20);
  if (error) { log('Befehle lesen:', error.message); return; }
  for (const c of data || []) await run(c);
}

await loadLamps(); log('Lampen:', lamps.map(d => `${d.name}@${d.ip}`).join(', '));
sb.channel('hub-commands')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hub_commands', filter: `office_id=eq.${OFFICE}` }, p => run(p.new))
  .subscribe(status => log('Realtime:', status));
setInterval(processOpen, 1500);
setInterval(loadLamps, 60000);
setInterval(async () => { try { await publishStates(await readStates()); await heartbeat(); } catch (e) { log('Statuslauf:', e.message); } }, 2000);
/* Neustart bei Update des Skripts (LaunchAgent startet es neu) */
const self = new URL(import.meta.url).pathname; const mtime = fs.statSync(self).mtimeMs;
setInterval(() => { if (fs.statSync(self).mtimeMs !== mtime) { log('Update erkannt – Neustart'); process.exit(0); } }, 60000);
await processOpen(); await publishStates(await readStates(), true); await heartbeat();
log('Hub bereit.');
