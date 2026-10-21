# Menu LANS - Sistema de pedidos de comedor

Sistema de pedidos para el comedor de **LANS Laboratorios de Referencia** (~143 colaboradores).
Un solo `index.html` (CSS/JS inline) + Firestore via REST, hospedado en GitHub Pages.

- URL: https://comedor-lans.grupoproesa.mx/ (GitHub Pages, repo Grupo-PROESA/Menu-Lans)
- Firebase project: `menu-lans`
- Acceso de colaboradores: desde el Gestor de Personal > Comedor LANS (desde 2026-10-21). Ver seccion 6.
- Pedidos y cancelaciones: **a cualquier hora, cualquier dia, siempre para el dia siguiente en adelante**. El dia de hoy nunca se toca (acordado con Talento Humano 2026-09-25).
- El comedor publica el menu de la semana siguiente el **jueves**
- Servicio de comedor: **12:30 - 17:30**
- Al pedir, el turno de dia (no los nocturnos) elige por cada dia la **hora en que pasa por su comida** (cada media hora de 12:30, inicio del servicio, a 22:00; `HORARIOS_RECOGER` en `index.html`). Pedido de Axel Avila, 2026-10-07.
- Los pedidos se guardan **por semana** y no se borran: en el panel se elige la semana con las flechas o con una fecha, y el Excel sale solo de esa semana. Ya no hay que "Limpiar / Archivar".
- Turno nocturno: solicitud por Teams con Axel Avila (contenedor rotulado)

---

## 1. Puesta en marcha (una sola vez)

### 1.1 Firebase Console - obtener la Web API Key
1. https://console.firebase.google.com/project/menu-lans/settings/general
2. En **Tus apps** > **Agregar app** > **Web** (icono `</>`). Nombre: `Menu LANS`. No hace falta Hosting.
3. Copia el valor de `apiKey` del bloque `firebaseConfig`.
4. Pegalo en `index.html`:
   ```js
   const FIREBASE_API_KEY = "PEGA_AQUI_TU_WEB_API_KEY";
   ```

### 1.2 Activar Auth anonimo
1. https://console.firebase.google.com/project/menu-lans/authentication/providers
2. **Sign-in method** > **Anonymous** > Habilitar > Guardar.

### 1.3 Publicar reglas de Firestore
1. https://console.firebase.google.com/project/menu-lans/firestore/rules
2. Pega el contenido de [`firestore.rules`](firestore.rules) y **Publicar**.

### 1.4 Crear los PINs (documento protegido)
1. https://console.firebase.google.com/project/menu-lans/firestore/data
2. Crear coleccion `config` > documento `secrets` con dos campos tipo **string**:
   - `adminPin` -> PIN del comedor: editar/publicar el menu y ver los pedidos. Nada mas.
   - `superPin` -> PIN de Recursos Humanos: todo (cortesias, reportes, limpiar, borrar comentarios, catalogo)
3. Recomendado: **6 digitos** (las reglas validan el PIN en el servidor; nadie puede leer `config/secrets`).

### 1.5 Cargar el catalogo de empleados (143)
Desde esta carpeta, con Node instalado:
```bash
node setup/cargar_catalogo.mjs --key TU_WEB_API_KEY --pin TU_SUPER_PIN
```
El script inicia sesion anonima, valida el super PIN contra las reglas y escribe `config/catalogo`.
Alternativa sin Node: entrar como super en la app > **Catalogo de Empleados** > **Carga masiva** > pegar `setup/catalogo_lans.txt`.

### 1.5b Turno nocturno
Los empleados con `turno: "noche"` en el catalogo piden igual que todos; solo se distinguen en la tabla de pedidos con etiqueta "Nocturno" y una fila de contenedores por dia (se les entrega en contenedor rotulado). No hay modo ni boton especial en la pantalla.
Se marcan desde el panel super (boton "Nocturno/Dia" en el catalogo) o con la lista `setup/nocturnos.txt`:
```bash
node setup/marcar_nocturnos.mjs
```

### 1.6 Restringir la API key por dominio (Google Cloud)
1. https://console.cloud.google.com/apis/credentials?project=menu-lans
2. Abrir la key **Browser key (auto created by Firebase)**.
3. **Application restrictions** > *Websites* > agregar:
   - `https://comedor-lans.grupoproesa.mx/*`
   - `http://localhost:*` (solo para pruebas locales; quitar despues)
4. **API restrictions** > *Restrict key* > marcar: `Identity Toolkit API`, `Token Service API`, `Cloud Firestore API`.
5. Guardar.

### 1.7 GitHub Pages
1. https://github.com/Grupo-PROESA/Menu-Lans/settings/pages
2. **Source**: Deploy from a branch > `main` / `/ (root)` > Save.
3. Custom domain: `comedor-lans.grupoproesa.mx` (CNAME a `grupo-proesa.github.io`), con Enforce HTTPS.

### 1.8 Logo
`logo.png` (512x512) esta en la raiz del repo. Si faltara, se muestra "LANS" como texto.

### 1.9 Estructura de cada dia del menu
Cada dia tiene: Entrada, Guiso 1, Guiso 2 (opcional), Ensalada (opcional, plato completo sin guarnicion), Guarnicion 1 y Guarnicion 2 (opcionales; si hay dos, el empleado elige una), Postre.
Si elige Ensalada no elige guarnicion. En la tabla de pedidos cada celda muestra guiso + guarnicion, y el desglose de produccion cuenta por guiso y por guarnicion.

---

## 2. Seguridad (diferencias vs PROESA)

| Tema | PROESA | LANS |
|---|---|---|
| Acceso a Firestore | Abierto (sin token) | Requiere token de Firebase Auth (Gestor o anonimo) |
| Login de empleado | Ninguno | Desde el Gestor de Personal: el numero de empleado viene del token y cada quien solo pide/cancela lo suyo |
| Reglas | read/write libre | Restrictivas por coleccion + validacion de forma de pedidos |
| PINs | Hardcodeados en el HTML | En `config/secrets`, ilegible desde el cliente; validados por reglas |
| Sesion admin | Solo en el navegador | `admin_sessions/{uid}` creada por reglas, expira a las 12 h |
| Catalogo | PIN en HTML | Solo sesion nivel `super` puede escribir |
| Roles | Uno | Dos niveles (admin = comedor, super = RRHH) validados en reglas |
| Buzon | Nombre + foto, solo admin lo ve | Anonimo, publico, texto de 3 a 400 caracteres, solo admin borra |
| Dominio | Ninguno | Guard en JS + restriccion de API key por referrer |
| Horarios | Solo en el navegador | Sin ventanas. Regla unica en reglas (hora de Mexico): el dia de hoy nunca se agrega ni se quita de un pedido; si el menu publicado es de una semana futura, todos sus dias estan disponibles |
| Lecturas | Cada empleado descarga todos los pedidos | Cada empleado lee solo su pedido; listar requiere admin |
| RFC | Visible para cualquier empleado | No se guarda: el reporte BUK sale por numero de empleado y Nomina pone el RFC desde el Gestor |

Flujo de admin: el navegador escribe `admin_sessions/{uid}` con `{pin, level, createdAt}`.
Las reglas comparan `pin` con `config/secrets`; si no coincide la escritura falla (403) y el
panel no se abre. Todas las escrituras de admin (menu, cortesias, historial, borrar pedidos)
exigen que exista esa sesion y que tenga menos de 12 h.

Empleados: entran desde la seccion Comedor del Gestor de Personal. La Cloud Function `ssoCallback` valida
el token firmado que manda el Gestor y regresa a la app con un custom token (`#ct=...`)
con el claim `numEmp` (normalizado igual que `normEmp()`). El numero queda fijo en pantalla y las
reglas solo dejan leer, pedir, modificar o cancelar `pedidos/{semana}_{numEmp}` propio. Quien abre el
link sin pasar por el Gestor entra como anonimo: ve el menu y un aviso con boton "Ir al Gestor de Personal",
pero no puede pedir. El anonimo queda para el acceso de admin con PIN. "No soy yo" cierra la sesion
en ese navegador (equipos compartidos). Ver seccion 6.

Limitaciones conocidas:
- Un PIN de 4 digitos se puede adivinar por fuerza bruta contra las reglas; usar 6+ digitos.

---

## 3. Estructura en Firestore

```
config/menu        { mes, mesNum, semana, anio, dias:[{dia, fecha, entrada, platoFuerte (guiso 1), platoAlternativo (guiso 2), ensalada, complemento (guarnicion 1), guarnicion2, postre}] }
config/catalogo    { "952": { nombre }, "981": { nombre, turno:"noche" }, ... }   <- legible por empleados
config/secrets     { adminPin, superPin }          <- solo lectura por reglas
config/cortesias   { items: [{ nombre, dias: { Lunes:1, ... } }], semana }   <- semana del menu; al agregar en otra semana las anteriores se archivan en historial
pedidos/{semana}_{numEmp}  { nombre, numEmpleado, semana:"2026-10-12", fecha, total, detalle:{Lunes:1}, opciones:{Lunes:"Guiso"}, guarniciones:{Lunes:"Arroz"}, horarios:{Lunes:"14:00"} }
orders/{numEmp}    formato anterior (semana del 5 de octubre 2026, SEMANA_LEGADO). Solo lectura; cuenta en esa semana mientras el empleado no tenga pedido semanal.
historial/{AAAA-M-Qn}  { "952": { nombre, comidas, pedidos:[...] }, _cortesias:[...] }   <- quincenas archivadas antes de los pedidos semanales
admin_sessions/{uid}   { pin, level:'admin'|'super', createdAt }
comentarios/{autoId}   { texto, fecha }   <- buzon anonimo
```

`semana` es la fecha del primer dia del menu publicado (`AAAA-MM-DD`). Las reglas solo dejan escribir la semana
del menu publicado; las semanas pasadas quedan guardadas y BUK / conciliacion las leen por fecha real de cada dia.

## 4. Precios de reportes
En `index.html` (ajustar con el proveedor de LANS):
```js
const PRECIO_DESCUENTO_COLABORADOR = 56.71;
const PRECIO_BASE_PROVEEDOR = 103.45;
const IVA_RATE = 0.16;
```

## 5. Pruebas locales
```bash
npx -y http-server -p 8765 -c-1
```
Abrir http://localhost:8765 (el guard de dominio permite `localhost`).

## 6. Entrada desde el Gestor de Personal - issue #2
Los colaboradores entran desde la seccion **Comedor** del Gestor de Personal (opcion 2 acordada con TI).
El Gestor redirige a la Function `ssoCallback` con `?t=<JWT HS256>` firmado con `HANDOFF_SECRET`
(`iss` = `gestor-personal`, `aud` = `comedor-lans`, trae `numEmp`, `nombre`, `correo`). La Function lo valida y
regresa a la app con un custom token (`#ct=...`) con el claim `numEmp`.
Archivos: `functions/index.js` (Node 22, 2nd gen), `firebase.json`, `.firebaserc`.

**Plan Blaze:** `menu-lans` ya esta en Blaze (2026-10-20); Cloud Functions y Secret Manager lo requieren.

**Deploy (Cloud Shell o tu maquina, con firebase CLI):**
```
firebase use menu-lans
(cd functions && npm install)
firebase functions:secrets:set HANDOFF_SECRET   # pega el secreto que te de TI; NUNCA en el repo
firebase deploy --only functions:ssoCallback
```
URL: `https://us-central1-menu-lans.cloudfunctions.net/ssoCallback`. El mismo `HANDOFF_SECRET` lo tiene TI en el
`.env` del Gestor; si lo rotan, se vuelve a correr `secrets:set` (y contestar Y para re-desplegar).
El `GESTOR_TOKEN` del flujo anterior (portal) ya no se usa: se puede borrar con
`firebase functions:secrets:destroy GESTOR_TOKEN`.

**Permiso para firmar custom tokens (una sola vez, ya hecho):** la cuenta de servicio de la Function
(`<NUMERO_DE_PROYECTO>-compute@developer.gserviceaccount.com`) necesita el rol **Service Account Token Creator**:
```
gcloud projects add-iam-policy-binding menu-lans \
  --member="serviceAccount:<NUMERO_DE_PROYECTO>-compute@developer.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"
```

**Orden para publicar:** (1) Function con `HANDOFF_SECRET`; (2) merge a `main` del `index.html` nuevo (funciona
tambien con las reglas actuales); (3) prueba con un colaborador real entrando desde el Gestor; (4) publicar
[`firestore.rules`](firestore.rules) (consola o `firebase deploy --only firestore:rules`). No publicar las reglas
antes del `index.html`: el anterior lista todos los pedidos y con las reglas nuevas eso ya no se permite.
Desde el paso 4 solo se puede pedir entrando desde el Gestor.
Los scripts de `setup/` siguen funcionando (usan sesion anonima + super PIN).

**API key:** ya esta restringida por dominio (1.6); `signInWithCustomToken` usa Identity Toolkit, que ya
esta permitida. No hay que cambiar nada.

**Errores que muestra la app** (`?error=` del callback): `sin_token` (se abrio la Function sin token),
`sin_numero` (el token no trae numero de empleado), `sso` (token invalido, expirado, de otro comedor o error al firmar).

**Pruebas de reglas** (emulador de Firestore, necesita Java 11+):
```
cd tests && npm install && npm test
```
