// Entrada desde el Gestor de Personal (issue #2, opcion 2).
// El Gestor redirige aqui con ?t=<JWT HS256> firmado con HANDOFF_SECRET (iss "gestor-personal",
// aud = appCode) que ya trae numEmp. Lo validamos y regresamos a la app con un custom token de
// Firebase en #ct=... El claim numEmp es el que usan las reglas para que cada quien pida solo lo suyo.
// jose 5.x: trae build CommonJS (la 6.x es solo ESM).
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { jwtVerify } = require("jose");

admin.initializeApp();
const HANDOFF_SECRET = defineSecret("HANDOFF_SECRET"); // lo da TI por canal seguro; nunca en el repo

const HANDOFF_ISS = "gestor-personal";
const APP_CODE = "comedor-lans";
const APP_URL = "https://comedor-lans.grupoproesa.mx";

// Igual que normEmp() en index.html: mayusculas y sin ceros a la izquierda.
// El Gestor ya lo manda sin ceros (p. ej. "706"); esto solo lo deja igual al id de pedidos/{semana}_{numEmp}.
function normEmp(v) {
  return String(v == null ? "" : v).trim().toUpperCase().replace(/^0+(?=.)/, "");
}

exports.ssoCallback = onRequest({ secrets: [HANDOFF_SECRET], cors: false }, async (req, res) => {
  try {
    const t = req.query.t;
    if (!t || typeof t !== "string") return res.redirect(`${APP_URL}/?error=sin_token`);
    const key = new TextEncoder().encode(HANDOFF_SECRET.value());
    const { payload } = await jwtVerify(t, key, { issuer: HANDOFF_ISS, audience: APP_CODE, algorithms: ["HS256"] });
    if (!payload.exp) console.warn("ssoCallback: token del Gestor sin exp");
    const numEmp = normEmp(payload.numEmp);
    if (!/^[A-Z0-9]{1,20}$/.test(numEmp) || numEmp === "0") return res.redirect(`${APP_URL}/?error=sin_numero`);
    const customToken = await admin.auth().createCustomToken(`emp_${numEmp}`, {
      numEmp,
      nombre: String(payload.nombre || "").slice(0, 120),
      correo: String(payload.correo || "").trim().toLowerCase().slice(0, 200),
    });
    return res.redirect(`${APP_URL}/#ct=${encodeURIComponent(customToken)}`);
  } catch (e) {
    console.error("ssoCallback", e && e.code, e && e.message);
    return res.redirect(`${APP_URL}/?error=sso`);
  }
});
