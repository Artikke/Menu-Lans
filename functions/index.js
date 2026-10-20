// jose 5.x: trae build CommonJS (la 6.x es solo ESM).
// SSO callback del Portal de Aplicaciones PROESA (issue #2).
// El portal redirige aqui con ?token=<JWT>; validamos el JWT, pedimos el numero de
// empleado al Gestor de Personal y regresamos a la app con un custom token de Firebase
// en #ct=... El claim numEmp es el que usan las reglas para que cada quien pida solo lo suyo.
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { createRemoteJWKSet, jwtVerify } = require("jose");

admin.initializeApp();
const GESTOR_TOKEN = defineSecret("GESTOR_TOKEN"); // lo da TI por canal seguro; nunca en el repo

const PORTAL_ISS = "https://portal.grupoproesa.mx";
const PORTAL_JWKS = createRemoteJWKSet(new URL("https://portal.grupoproesa.mx/.well-known/jwks.json"));
const GESTOR_BASE = "https://proesa-team.grupoproesa.mx/api/integracion/v1";
const APP_CODE = "comedor-lans";
const APP_URL = "https://comedor-lans.grupoproesa.mx";

// Igual que normEmp() en index.html: mayusculas y sin ceros a la izquierda.
// Asi el claim coincide con pedidos/{semana}_{numEmp} y con las llaves del catalogo.
function normEmp(v) {
  return String(v == null ? "" : v).trim().toUpperCase().replace(/^0+(?=.)/, "");
}

exports.ssoCallback = onRequest({ secrets: [GESTOR_TOKEN], cors: false }, async (req, res) => {
  try {
    const token = req.query.token;
    const returnTo = typeof req.query.return_to === "string" ? req.query.return_to : "/";
    if (!token || typeof token !== "string") return res.redirect(`${APP_URL}/?error=sin_token`);
    const { payload } = await jwtVerify(token, PORTAL_JWKS, { issuer: PORTAL_ISS, audience: APP_CODE });
    const email = String(payload.email || "").trim().toLowerCase();
    if (!email) return res.redirect(`${APP_URL}/?error=sin_correo`);
    const r = await fetch(`${GESTOR_BASE}/empleado?email=${encodeURIComponent(email)}`,
      { headers: { "X-Integracion-Token": GESTOR_TOKEN.value() } });
    if (r.status === 404) return res.redirect(`${APP_URL}/?error=sin_ficha`);
    if (!r.ok) return res.redirect(`${APP_URL}/?error=gestor`);
    const emp = await r.json();
    const numEmp = normEmp(emp.numero_empleado);
    if (!/^[A-Z0-9]{1,20}$/.test(numEmp) || numEmp === "0") return res.redirect(`${APP_URL}/?error=sin_ficha`);
    const customToken = await admin.auth().createCustomToken(`emp_${numEmp}`, {
      numEmp, nombre: String(emp.nombre || "").slice(0, 120), correo: email,
    });
    // Solo rutas locales (evita redirigir a otro dominio)
    const dest = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo.split("#")[0] : "/";
    return res.redirect(`${APP_URL}${dest}#ct=${encodeURIComponent(customToken)}`);
  } catch (e) {
    console.error("ssoCallback", e && e.code, e && e.message);
    return res.redirect(`${APP_URL}/?error=sso`);
  }
});
