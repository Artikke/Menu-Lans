// Pruebas de firestore.rules con el emulador.
// Correr: cd tests && npm install && npm test   (necesita Java para el emulador)
const { test, before, after, beforeEach } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, serverTimestamp } = require('firebase/firestore');

const ADMIN_PIN = '111111';
const SUPER_PIN = '222222';
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
let env;

// Menu publicado de la semana que entra (asi la regla "el dia de hoy no se toca" no estorba)
const lunes = new Date(); lunes.setUTCHours(12, 0, 0, 0); lunes.setUTCDate(lunes.getUTCDate() + ((8 - lunes.getUTCDay()) % 7 || 7));
const SEM = lunes.toISOString().slice(0, 10);
const menu = {
  mes: MESES[lunes.getUTCMonth()], mesNum: lunes.getUTCMonth() + 1, anio: lunes.getUTCFullYear(),
  dias: ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'].map((dia, i) => {
    const d = new Date(lunes); d.setUTCDate(d.getUTCDate() + i); return { dia, fecha: d.getUTCDate() };
  }).slice(0, 1),
};
const pedido = (numEmpleado, extra = {}) => ({
  nombre: 'Prueba', numEmpleado, semana: SEM, fecha: new Date().toISOString(), total: 1,
  detalle: { Lunes: 1 }, opciones: { Lunes: 'Pollo' }, guarniciones: {}, horarios: { Lunes: '13:00' }, ...extra,
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-menu-lans',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'config/secrets'), { adminPin: ADMIN_PIN, superPin: SUPER_PIN });
    await setDoc(doc(db, 'config/menu'), menu);
    await setDoc(doc(db, 'config/catalogo'), { '123': { nombre: 'Prueba' }, '456': { nombre: 'Otro' }, '999': { nombre: 'Nuevo' } });
    await setDoc(doc(db, `pedidos/${SEM}_456`), pedido('456'));
    await setDoc(doc(db, 'orders/123'), { numEmpleado: '123', nombre: 'Prueba', total: 1, detalle: { Lunes: 1 } });
    await setDoc(doc(db, 'orders/456'), { numEmpleado: '456', nombre: 'Otro', total: 1, detalle: { Lunes: 1 } });
  });
});

// Empleado que entro por el portal: custom token con claim numEmp
const emp = (n) => env.authenticatedContext(`emp_${n}`, { numEmp: n }).firestore();
const anon = () => env.authenticatedContext('anon_1', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
async function adminDb(level, pin, uid = 'anon_admin') {
  const db = env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  await assertSucceeds(setDoc(doc(db, `admin_sessions/${uid}`), { pin, level, createdAt: serverTimestamp() }));
  return db;
}

test('empleado crea, lee, modifica y borra SU pedido', async () => {
  const db = emp('123');
  const ref = doc(db, `pedidos/${SEM}_123`);
  await assertSucceeds(setDoc(ref, pedido('123')));
  await assertSucceeds(getDoc(ref));
  await assertSucceeds(updateDoc(ref, { total: 0, detalle: {}, opciones: {}, horarios: {} }));
  await assertSucceeds(deleteDoc(ref));
  await assertSucceeds(getDoc(doc(db, 'orders/123'))); // formato anterior: el suyo si
});

test('empleado NO toca el pedido de otro', async () => {
  const db = emp('123');
  await assertFails(setDoc(doc(db, `pedidos/${SEM}_999`), pedido('999')));
  await assertFails(setDoc(doc(db, `pedidos/${SEM}_456`), pedido('456', { total: 0, detalle: {} })));
  await assertFails(updateDoc(doc(db, `pedidos/${SEM}_456`), { total: 0 }));
  await assertFails(deleteDoc(doc(db, `pedidos/${SEM}_456`)));
  await assertFails(getDoc(doc(db, `pedidos/${SEM}_456`)));
  await assertFails(getDoc(doc(db, 'orders/456')));
  await assertFails(getDocs(collection(db, 'pedidos')));
});

test('empleado NO guarda su id con otro numEmpleado', async () => {
  await assertFails(setDoc(doc(emp('123'), `pedidos/${SEM}_123`), pedido('456')));
});

test('se conservan las validaciones de validPedido', async () => {
  const db = emp('123');
  await assertFails(setDoc(doc(db, `pedidos/${SEM}_123`), pedido('123', { hack: 1 })));
  await assertFails(setDoc(doc(db, `pedidos/2020-01-06_123`), pedido('123', { semana: '2020-01-06' })));
  await assertFails(setDoc(doc(emp('777'), `pedidos/${SEM}_777`), pedido('777'))); // no esta en el catalogo
});

test('anonimo (sin portal) no pide, no cancela, no lee pedidos; si ve el menu', async () => {
  const db = anon();
  await assertFails(setDoc(doc(db, `pedidos/${SEM}_123`), pedido('123')));
  await assertFails(deleteDoc(doc(db, `pedidos/${SEM}_456`)));
  await assertFails(getDoc(doc(db, `pedidos/${SEM}_456`)));
  await assertFails(getDoc(doc(db, 'orders/456')));
  await assertFails(getDocs(collection(db, 'pedidos')));
  await assertSucceeds(getDoc(doc(db, 'config/menu')));
});

test('sin token no hay nada', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'config/menu')));
  await assertFails(setDoc(doc(db, `pedidos/${SEM}_123`), pedido('123')));
});

test('claim numEmp que no es string no sirve', async () => {
  const db = env.authenticatedContext('emp_x', { numEmp: 123 }).firestore();
  await assertFails(setDoc(doc(db, `pedidos/${SEM}_123`), pedido('123')));
});

test('admin (comedor) con PIN ve todos los pedidos, como antes', async () => {
  const db = await adminDb('admin', ADMIN_PIN);
  await assertSucceeds(getDocs(collection(db, 'pedidos')));
  await assertSucceeds(getDoc(doc(db, `pedidos/${SEM}_456`)));
  await assertSucceeds(getDoc(doc(db, 'orders/456')));
});

test('super (RRHH) con PIN sigue pudiendo todo', async () => {
  const db = await adminDb('super', SUPER_PIN);
  await assertSucceeds(setDoc(doc(db, `pedidos/${SEM}_999`), pedido('999')));
  await assertSucceeds(deleteDoc(doc(db, `pedidos/${SEM}_456`)));
  await assertSucceeds(setDoc(doc(db, 'config/catalogo'), { '123': { nombre: 'Prueba' } }));
  await assertFails(getDoc(doc(db, 'config/secrets')));
});

test('super con PIN desde una sesion del portal (uid emp_*) tambien funciona', async () => {
  const uid = 'emp_123';
  const db = env.authenticatedContext(uid, { numEmp: '123' }).firestore();
  await assertSucceeds(setDoc(doc(db, `admin_sessions/${uid}`), { pin: SUPER_PIN, level: 'super', createdAt: serverTimestamp() }));
  await assertSucceeds(deleteDoc(doc(db, `pedidos/${SEM}_456`)));
});

test('PIN incorrecto no crea sesion ni da acceso', async () => {
  const db = anon();
  await assertFails(setDoc(doc(db, 'admin_sessions/anon_1'), { pin: '000000', level: 'super', createdAt: serverTimestamp() }));
  await assertFails(getDocs(collection(db, 'pedidos')));
});
