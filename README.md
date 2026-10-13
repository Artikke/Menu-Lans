# Menu LANS — Sistema de pedidos del comedor

## Descripción
Sistema de pedidos para el comedor de **LANS Laboratorios de Referencia** (~143 colaboradores).
Los empleados apartan desde el celular su comida de la semana; el comedor sabe cuántos platillos preparar
y a qué hora pasa cada quien, y Recursos Humanos saca el descuento de nómina (BUK) y la conciliación
de la factura del proveedor. Tarjeta de la app para desarrollo: [CLAUDE.md](CLAUDE.md).

## Cómo funciona
1. **El comedor publica el menú** de la semana siguiente (normalmente el jueves): entrada, guiso 1 y 2, ensalada, guarniciones y postre por día.
2. **El empleado pide** con su número de empleado (el nombre se llena solo desde el catálogo). Marca los días, elige guiso, guarnición o ensalada y, si es de turno de día, la **hora en que pasa** (12:30 a 22:00, cada media hora). Siempre para el día siguiente en adelante: el día de hoy no se pide ni se cancela.
3. **Puede cancelar** días futuros con el botón "Cancelar Pedido" y ver su resumen.
4. **El comedor ve los pedidos** en el panel por semana (flechas o fecha): totales por día, desglose por platillo y guarnición, conteo por hora y contenedores del turno nocturno.
5. **RRHH** administra catálogo, RFC y cortesías, y descarga el Excel de la semana, el CSV para **BUK** y la **conciliación** de la factura por quincena.
6. Cualquiera puede dejar un **comentario anónimo** en el buzón (texto y foto opcional).

Reglas acordadas con Talento Humano: pedidos y cancelaciones a cualquier hora, siempre para el día siguiente en adelante (2026-09-25); hora para pasar solo turno de día, 12:30 a 22:00 (2026-10-07); servicio del comedor 12:30 a 17:30. Turno nocturno: se entrega en contenedor rotulado.

## Tecnología
- Un solo `index.html` (HTML, CSS y JavaScript inline, sin build ni dependencias de npm).
- **Firebase Auth anónimo** y **Cloud Firestore** por REST (sin SDK); la seguridad está en [`firestore.rules`](firestore.rules).
- **GitHub Pages** sirve la app desde la rama `main`.
- Librerías por CDN: `xlsx-js-style` (Excel de conciliación) y Google Fonts.
- Scripts de Node en `setup/` para cargar el catálogo y marcar nocturnos.

## Acceso
- **Empleados:** https://artikke.github.io/Menu-Lans/ (solo funciona en ese dominio y en `localhost`).
- **Administración:** en la misma URL, botón **Admin** (arriba a la derecha) y PIN:
  - PIN de **comedor** (`adminPin`): publicar menú, ver pedidos y comentarios.
  - PIN de **RRHH** (`superPin`): todo, incluido catálogo, cortesías y reportes.
  - Los PINs viven en Firestore `config/secrets` (nadie los puede leer desde la app). Los entrega: [completar].
- **Firebase Console:** proyecto `menu-lans`. Acceso: [completar quién tiene permisos].

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
   - `superPin` -> PIN de Recursos Humanos: todo (cortesias, reportes, borrar pedidos y comentarios, catalogo)
3. Recomendado: **6 digitos** (las reglas validan el PIN en el servidor; nadie puede leer `config/secrets`).

### 1.5 Cargar el catalogo de empleados (143)
Desde esta carpeta, con Node instalado:
```bash
node setup/cargar_catalogo.mjs --key TU_WEB_API_KEY --pin TU_SUPER_PIN
```
El script inicia sesion anonima, valida el super PIN contra las reglas y escribe `config/catalogo`.
Alternativa sin Node: entrar como super en la app > **Catalogo de Empleados** > **Carga masiva** > pegar `setup/catalogo_lans.txt`.

### 1.5b Turno nocturno
Los empleados con `turno: "noche"` en el catalogo piden igual que todos pero sin elegir hora; se distinguen en la tabla de pedidos con etiqueta "Nocturno" y una fila de contenedores por dia (se les entrega en contenedor rotulado). No hay modo ni boton especial en la pantalla.
Se marcan desde el panel super (boton "Nocturno/Dia" en el catalogo) o con la lista `setup/nocturnos.txt`:
```bash
node setup/marcar_nocturnos.mjs
```

### 1.6 Restringir la API key por dominio (Google Cloud)
1. https://console.cloud.google.com/apis/credentials?project=menu-lans
2. Abrir la key **Browser key (auto created by Firebase)**.
3. **Application restrictions** > *Websites* > agregar:
   - `https://artikke.github.io/*`
   - `http://localhost:*` (solo para pruebas locales; quitar despues)
4. **API restrictions** > *Restrict key* > marcar: `Identity Toolkit API`, `Token Service API`, `Cloud Firestore API`.
5. Guardar.

### 1.7 GitHub Pages
1. https://github.com/Artikke/Menu-Lans/settings/pages
2. **Source**: Deploy from a branch > `main` / `/ (root)` > Save.
3. En 1-2 min queda en https://artikke.github.io/Menu-Lans/

### 1.8 Logo
`logo.png` (512x512) esta en la raiz del repo. Si faltara, se muestra "LANS" como texto.

### 1.9 Estructura de cada dia del menu
Cada dia tiene: Entrada, Guiso 1, Guiso 2 (opcional), Ensalada (opcional, plato completo sin guarnicion), Guarnicion 1 y Guarnicion 2 (opcionales; si hay dos, el empleado elige una), Postre.
Si elige Ensalada no elige guarnicion. En la tabla de pedidos cada celda muestra guiso + guarnicion, y el desglose de produccion cuenta por guiso y por guarnicion.

---

## 2. Seguridad (diferencias vs PROESA)

| Tema | PROESA | LANS |
|---|---|---|
| Acceso a Firestore | Abierto (sin token) | Requiere token de Firebase Auth anonimo |
| Reglas | read/write libre | Restrictivas por coleccion + validacion de forma de pedidos |
| PINs | Hardcodeados en el HTML | En `config/secrets`, ilegible desde el cliente; validados por reglas |
| Sesion admin | Solo en el navegador | `admin_sessions/{uid}` creada por reglas, expira a las 12 h |
| Catalogo | PIN en HTML | Solo sesion nivel `super` puede escribir |
| Roles | Uno | Dos niveles (admin = comedor, super = RRHH) validados en reglas |
| Buzon | Nombre + foto, solo admin lo ve | Anonimo, publico, texto de 3 a 400 caracteres, solo admin borra |
| Dominio | Ninguno | Guard en JS + restriccion de API key por referrer |
| Horarios | Solo en el navegador | Sin ventanas. Regla unica en reglas (hora de Mexico): el dia de hoy nunca se agrega ni se quita de un pedido; si el menu publicado es de una semana futura, todos sus dias estan disponibles |
| Lecturas | Cada empleado descarga todos los pedidos | Cada empleado lee solo su pedido; listar requiere admin |
| RFC | Visible para cualquier empleado | Documento aparte, solo super |

Flujo de admin: el navegador escribe `admin_sessions/{uid}` con `{pin, level, createdAt}`.
Las reglas comparan `pin` con `config/secrets`; si no coincide la escritura falla (403) y el
panel no se abre. Todas las escrituras de admin (menu, cortesias, historial, borrar pedidos)
exigen que exista esa sesion y que tenga menos de 12 h.

Limitaciones conocidas (mismas que PROESA por diseño sin login de empleado):
- Cualquier persona con el link puede pedir/cancelar con cualquier numero de empleado del catalogo.
- Un PIN de 4 digitos se puede adivinar por fuerza bruta contra las reglas; usar 6+ digitos.

---

## 3. Estructura en Firestore
Colecciones, campos, quién lee y escribe y sensibilidad de cada dato: [docs/contrato.md](docs/contrato.md).
Resumen en [CLAUDE.md](CLAUDE.md#colecciones-en-firestore).

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

## 6. Diagnóstico
Comparación contra el estándar de Soluciones Digitales PROESA, deuda priorizada y plan por fases: [docs/diagnostico.md](docs/diagnostico.md).
