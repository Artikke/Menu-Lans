#!/usr/bin/env node
// ============================================================
//  Marca en config/catalogo quienes son de turno nocturno (turno = 'noche')
//  segun setup/nocturnos.txt. A los demas les quita la marca. No toca nombres ni RFC.
//
//  Uso:  node setup/marcar_nocturnos.mjs        (toma la key de index.html y pregunta el super PIN)
// ============================================================
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const __dir = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const getArg = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
function keyFromIndex() {
  try { const m = readFileSync(resolve(__dir, '..', 'index.html'), 'utf8').match(/FIREBASE_API_KEY = "([^"]+)"/); return m ? m[1] : null; } catch (e) { return null; }
}
const API_KEY = getArg('--key', process.env.FIREBASE_API_KEY || keyFromIndex());
const PROJECT = getArg('--project', 'menu-lans');
const FILE = resolve(getArg('--file', resolve(__dir, 'nocturnos.txt')));
let SUPER_PIN = getArg('--pin', process.env.SUPER_PIN);
if (!API_KEY) { console.error('No encontre la API key.'); process.exit(1); }
if (!SUPER_PIN) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  SUPER_PIN = (await rl.question('Escribe el SUPER PIN y presiona Enter: ')).trim();
  rl.close();
}
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const normEmp = s => String(s || '').trim().toUpperCase().replace(/^0+(?=.)/, '');
const nocturnos = new Set(readFileSync(FILE, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(l => normEmp(l.split(/[\s|,]/)[0])));
console.log(`Nocturnos en ${FILE}: ${[...nocturnos].join(', ')}`);

let r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) });
let j = await r.json();
if (!r.ok) { console.error('Error de Auth:', j.error?.message); process.exit(1); }
const H = { 'Authorization': 'Bearer ' + j.idToken, 'Content-Type': 'application/json' };
const uid = j.localId;
r = await fetch(`${FS_BASE}:commit`, { method: 'POST', headers: H, body: JSON.stringify({ writes: [{ update: { name: `projects/${PROJECT}/databases/(default)/documents/admin_sessions/${uid}`, fields: { pin: { stringValue: SUPER_PIN }, level: { stringValue: 'super' } } }, updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }] }] }) });
if (!r.ok) { j = await r.json(); console.error('PIN rechazado:', j.error?.message); process.exit(1); }
console.log('Sesion super OK');

r = await fetch(`${FS_BASE}/config/catalogo`, { headers: H });
if (!r.ok) { console.error('No pude leer el catalogo'); process.exit(1); }
const doc = await r.json();
const fields = doc.fields || {};
let marcados = 0, faltantes = [];
for (const id of nocturnos) if (!fields[id]) faltantes.push(id);
for (const [id, v] of Object.entries(fields)) {
  const f = v.mapValue.fields;
  if (nocturnos.has(id)) { f.turno = { stringValue: 'noche' }; marcados++; }
  else delete f.turno;
}
r = await fetch(`${FS_BASE}/config/catalogo`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields }) });
if (!r.ok) { j = await r.json(); console.error('Error al escribir:', j.error?.message); process.exit(1); }
console.log(`Listo: ${marcados} empleados marcados como turno nocturno de ${Object.keys(fields).length} en el catalogo.`);
if (faltantes.length) console.log('OJO, no estan en el catalogo (no se marcaron):', faltantes.join(', '));
await fetch(`${FS_BASE}/admin_sessions/${uid}`, { method: 'DELETE', headers: H });
