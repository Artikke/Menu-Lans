# Menu LANS - Sistema de pedidos de comedor

Sistema de pedidos para el comedor de **LANS Laboratorios de Referencia** (~143 colaboradores).
Un solo `index.html` (CSS/JS inline) + Firestore via REST, hospedado en GitHub Pages.

- URL: https://artikke.github.io/Menu-Lans/
- Firebase project: `menu-lans`
- Horario de pedidos: **7:00 - 11:30 AM** (L-V)
- Cancelaciones: **7:00 - 11:30 AM** y **5:00 PM - 12:00 AM**
- Servicio de comedor: **12:30 - 17:30**
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

### 1.8 Logo (opcional)
Sube un `logo.png` (cuadrado, fondo blanco o transparente) a la raiz del repo. Si no existe, se muestra "LANS" como texto.

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

Flujo de admin: el navegador escribe `admin_sessions/{uid}` con `{pin, level, createdAt}`.
Las reglas comparan `pin` con `config/secrets`; si no coincide la escritura falla (403) y el
panel no se abre. Todas las escrituras de admin (menu, cortesias, historial, borrar pedidos)
exigen que exista esa sesion y que tenga menos de 12 h.

Limitaciones conocidas (mismas que PROESA por diseño sin login de empleado):
- Cualquier persona con el link puede pedir/cancelar con cualquier numero de empleado del catalogo.
- Un PIN de 4 digitos se puede adivinar por fuerza bruta contra las reglas; usar 6+ digitos.

---

## 3. Estructura en Firestore

```
config/menu        { mes, semana, anio, dias:[{dia, fecha, entrada, platoFuerte, complemento, platoAlternativo, postre}] }
config/catalogo    { "952": { nombre, rfc }, "F1": { nombre, rfc }, ... }
config/cortesias   { items: [{ nombre, dias: { Lunes:1, ... } }] }
config/secrets     { adminPin, superPin }          <- solo lectura por reglas
orders/{numEmp}    { nombre, numEmpleado, fecha, total, detalle:{Lunes:1}, opciones:{Lunes:"Plato"} }
historial/{AAAA-M-Qn}  { "952": { nombre, comidas, pedidos:[...] }, _cortesias:[...] }
admin_sessions/{uid}   { pin, level:'admin'|'super', createdAt }
comentarios/{autoId}   { texto, fecha }   <- buzon anonimo
```

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
