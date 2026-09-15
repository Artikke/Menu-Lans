#!/usr/bin/env node
// ============================================================
//  Carga el catalogo de empleados LANS en Firestore (config/catalogo)
//
//  Uso:
//    node setup/cargar_catalogo.mjs            (toma la key de index.html y pregunta el PIN)
//    node setup/cargar_catalogo.mjs --key <WEB_API_KEY> --pin <SUPER_PIN> [--project menu-lans] [--file setup/catalogo_lans.txt]
//
//  Requisitos previos (ver README):
//    1. Anonymous Auth activado en Firebase Authentication.
//    2. firestore.rules publicadas.
//    3. Documento config/secrets con adminPin y superPin creado en la consola.
//
//  El script hace lo mismo que el navegador: inicia sesion anonima, crea una
//  sesion de admin nivel "super" con el PIN (validada por las reglas) y escribe
//  el catalogo completo. No requiere Firebase CLI ni service account.
// ============================================================
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const args = process.argv.slice(2);
const getArg = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const __dir0 = dirname(fileURLToPath(import.meta.url));
function keyFromIndex() {
  try { const m = readFileSync(resolve(__dir0, "..", "index.html"), "utf8").match(/FIREBASE_API_KEY = "([^"]+)"/); return m && !m[1].startsWith("PEGA_AQUI") ? m[1] : null; } catch (e) { return null; }
}
const API_KEY = getArg('--key', process.env.FIREBASE_API_KEY || keyFromIndex());
let SUPER_PIN = getArg('--pin', process.env.SUPER_PIN);
const PROJECT = getArg('--project', 'menu-lans');
const __dir = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(getArg('--file', resolve(__dir, 'catalogo_lans.txt')));
const MERGE = args.includes('--merge');

if (!API_KEY) {
  console.error('No encontre la API key. Pegala en index.html o usa --key <WEB_API_KEY>');
  process.exit(1);
}
if (!SUPER_PIN) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  SUPER_PIN = (await rl.question('Escribe el SUPER PIN y presiona Enter: ')).trim();
  rl.close();
  if (!SUPER_PIN) { console.error('PIN vacio.'); process.exit(1); }
}

const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

function normEmp(s) { return String(s || '').trim().toUpperCase().replace(/^0+(?=.)/, ''); }

function parseCatalogo(txt) {
  const out = {};
  for (const line of txt.split(/\r?\n/)) {
    const l = line.trim();
    if (!l || l.startsWith('#')) continue;
    const parts = l.split(/\s*\|\s*|\t|\s*,\s*/).map(s => s.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const num = normEmp(parts[0]);
    if (!/^[A-Z0-9]+$/.test(num)) { console.warn('Linea ignorada (codigo invalido):', l); continue; }
    out[num] = { nombre: parts[1], rfc: (parts[2] || '').toUpperCase() };
  }
  return out;
}

function jsToFs(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(jsToFs) } };
  const fields = {};
  for (const [k, v] of Object.entries(val)) fields[k] = jsToFs(v);
  return { mapValue: { fields } };
}
function fsToJs(f) {
  if ('stringValue' in f) return f.stringValue;
  if ('integerValue' in f) return parseInt(f.integerValue);
  if ('mapValue' in f) { const o = {}; for (const [k, v] of Object.entries(f.mapValue.fields || {})) o[k] = fsToJs(v); return o; }
  return null;
}

async function main() {
  const catalogo = parseCatalogo(readFileSync(FILE, 'utf8'));
  const n = Object.keys(catalogo).length;
  console.log(`Catalogo leido: ${n} empleados desde ${FILE}`);

  // 1. Auth anonimo
  let r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true })
  });
  let j = await r.json();
  if (!r.ok) { console.error('Error de Auth anonimo:', j.error?.message, '\n-> Revisa que Anonymous este activado y que la API key sea correcta.'); process.exit(1); }
  const token = j.idToken, uid = j.localId;
  const H = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };
  console.log('Sesion anonima OK, uid:', uid);

  // 2. Sesion super (validada por reglas contra config/secrets)
  r = await fetch(`${FS_BASE}:commit`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ writes: [{
      update: { name: `projects/${PROJECT}/databases/(default)/documents/admin_sessions/${uid}`, fields: { pin: { stringValue: SUPER_PIN }, level: { stringValue: 'super' } } },
      updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }]
    }] })
  });
  if (!r.ok) { j = await r.json(); console.error('No se pudo crear la sesion super:', j.error?.message, '\n-> PIN incorrecto, reglas no publicadas o config/secrets no existe.'); process.exit(1); }
  console.log('Sesion super OK');

  // 3. Merge opcional con lo existente
  let final = catalogo;
  if (MERGE) {
    r = await fetch(`${FS_BASE}/config/catalogo`, { headers: H });
    if (r.ok) { const doc = await r.json(); const cur = {}; for (const [k, v] of Object.entries(doc.fields || {})) cur[k] = fsToJs(v); final = Object.assign(cur, catalogo); }
    r = await fetch(`${FS_BASE}/config/catalogo_rfc`, { headers: H });
    if (r.ok) { const doc = await r.json(); for (const [k, v] of Object.entries(doc.fields || {})) { if (final[k] && !final[k].rfc) final[k].rfc = fsToJs(v); } }
  }

  // 4. Escribir catalogo (solo nombres, legible por empleados) y RFCs aparte (solo super)
  const fields = {}, fieldsRfc = {};
  for (const [k, v] of Object.entries(final)) {
    fields[k] = jsToFs({ nombre: v.nombre });
    if (v.rfc) fieldsRfc[k] = jsToFs(v.rfc);
  }
  r = await fetch(`${FS_BASE}/config/catalogo`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields }) });
  if (!r.ok) { j = await r.json(); console.error('Error al escribir config/catalogo:', j.error?.message); process.exit(1); }
  console.log(`config/catalogo escrito con ${Object.keys(final).length} empleados (sin RFC).`);
  r = await fetch(`${FS_BASE}/config/catalogo_rfc`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields: fieldsRfc }) });
  if (!r.ok) { j = await r.json(); console.error('Error al escribir config/catalogo_rfc:', j.error?.message); process.exit(1); }
  console.log(`config/catalogo_rfc escrito con ${Object.keys(fieldsRfc).length} RFCs.`);

  // 5. Limpiar sesion
  await fetch(`${FS_BASE}/admin_sessions/${uid}`, { method: 'DELETE', headers: H });
  console.log('Listo.');
}

main().catch(e => { console.error(e); process.exit(1); });
