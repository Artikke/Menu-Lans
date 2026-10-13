# Contrato de datos — Menu LANS

- Dueño de los datos: [completar]
- Operadora del sistema: [completar]
- Desarrollo y soporte: Soluciones Digitales PROESA
- Almacenamiento: Cloud Firestore, proyecto Firebase `menu-lans` (región: [completar])
- Última revisión: 2026-10-13

## Qué datos tiene
| Dato | Dónde | Campos | Sensibilidad | Quién lo lee | Quién lo escribe | Retención |
|---|---|---|---|---|---|---|
| Menú publicado | `config/menu` | `mes`, `mesNum`, `semana`, `anio`, `dias[]` (`dia`, `fecha`, `entrada`, `platoFuerte`, `platoAlternativo`, `ensalada`, `complemento`, `guarnicion2`, `postre`) | Pública | Cualquiera con la app | Comedor, RRHH | Solo el vigente; se sobrescribe cada semana |
| Catálogo de empleados | `config/catalogo` | `{ numEmp: { nombre, turno? } }` (`turno: "noche"` para nocturnos) | Personal (nombre) | Cualquiera con la app | RRHH | Mientras la persona trabaje en LANS [completar] |
| RFC de empleados | `config/catalogo_rfc` | `{ numEmp: rfc }` | **Personal sensible** (dato fiscal) | RRHH | RRHH | [completar] |
| Pedidos semanales | `pedidos/{semana}_{numEmp}` | `nombre`, `numEmpleado`, `semana` (`AAAA-MM-DD`), `fecha` (último cambio, ISO), `total`, `detalle {Dia: 1}`, `opciones {Dia: platillo}`, `guarniciones {Dia: guarnición}`, `horarios {Dia: "HH:MM"}` | Personal (qué y cuándo come; base del descuento) | Por id: cualquiera con la app. Listado: comedor, RRHH | Empleado (validado por reglas), RRHH | Indefinida hoy [completar] |
| Pedidos formato anterior | `orders/{numEmp}` | `nombre`, `numEmpleado`, `fecha`, `total`, `detalle`, `opciones`, `guarniciones` | Personal | Igual que pedidos | Solo RRHH | Archivar tras la conciliación de octubre 2026 |
| Cortesías | `config/cortesias` | `items[] { nombre, dias }`, `semana` | Personal (nombre de invitados) | Comedor, RRHH | RRHH | Semana vigente; luego pasa a `historial` |
| Historial por quincena | `historial/{AAAA-M-Qn}` | `{ numEmp: { nombre, comidas, pedidos[] } }`, `_cortesias[]` | Personal (base de nómina) | RRHH | RRHH | Indefinida hoy [completar] |
| Buzón | `comentarios/{autoId}` | `texto` (3–400), `fecha`, `foto?` (JPEG base64) | Anónimo; la foto puede mostrar personas | Comedor, RRHH | Crear: cualquiera; borrar: RRHH | Indefinida hoy [completar] |
| PINs | `config/secrets` | `adminPin`, `superPin` | **Secreto** | Nadie desde el cliente (solo las reglas) | Solo Firebase Console | Rotar [completar] |
| Sesiones de admin | `admin_sessions/{uid}` | `pin`, `level` (`admin` / `super`), `createdAt` | **Secreto** (contiene el PIN) | El mismo navegador | El mismo navegador si el PIN coincide | Vence a las 12 h; el documento queda hasta cerrar sesión [completar limpieza] |

Notas:
- No se guardan correos, teléfonos ni contraseñas de empleados. La identidad es solo el número de empleado.
- Datos personales que hoy están **fuera** de Firestore y no deberían: `setup/catalogo_lans.txt` (nombres y RFC) en el repo público. Ver [diagnostico.md](diagnostico.md), deuda #1.

## Endpoints
La app **no tiene API propia**. El navegador usa directamente las APIs de Google con un token anónimo, y `firestore.rules` decide qué se permite:

| Operación | API de Google | Quién |
|---|---|---|
| Sesión anónima y renovación de token | Identity Toolkit `accounts:signUp`, Secure Token `token` | Todos |
| Leer menú y catálogo | Firestore `GET config/menu`, `GET config/catalogo` | Todos |
| Leer, crear, cambiar o cancelar mi pedido | Firestore `GET/PATCH/DELETE pedidos/{semana}_{numEmp}` | Empleado (solo semana del menú, nunca hoy) |
| Pedidos de una semana y reportes | Firestore `runQuery` sobre `pedidos` por rango de `semana`; `GET orders` | Comedor, RRHH |
| Iniciar sesión de admin | Firestore `commit` en `admin_sessions/{uid}` con el PIN | Comedor, RRHH |
| Publicar menú | Firestore `PATCH config/menu` | Comedor, RRHH |
| Catálogo, RFC, cortesías, historial | Firestore `PATCH config/*`, `historial/*` | RRHH |
| Buzón | Firestore `POST comentarios`; `GET`/`DELETE` | Crear: todos; leer: comedor y RRHH; borrar: RRHH |

Salidas que hoy sustituyen a una integración (descarga manual desde el panel de RRHH):
- **Excel semanal** de pedidos (`.xls`): por empleado, día, platillo y hora.
- **CSV para BUK** por quincena: `Numero de Documento (RFC), Ficha/Col (numEmp), Valor (comidas × $56.71)`.
- **Conciliación de factura** por quincena (CSV y XLSX): comidas por día, total, precio base, IVA y descuentos.

## Dependencias
| Dependencia | Para qué | Si falla |
|---|---|---|
| Firebase Authentication (anónimo) | Token para hablar con Firestore | Nadie puede pedir ni entrar al panel |
| Cloud Firestore + `firestore.rules` | Todos los datos y la seguridad | Nadie puede pedir ni entrar al panel |
| GitHub Pages (`Artikke/Menu-Lans`, rama `main`) | Servir la app | La app no carga |
| Restricción de API key en Google Cloud (dominio `artikke.github.io`) | Evitar uso de la key desde otros sitios | Si se cambia de dominio hay que actualizarla |
| jsDelivr `xlsx-js-style@1.2.0` | Excel de conciliación | Solo falla el XLSX; queda el CSV |
| Google Fonts (Inter, Montserrat) | Tipografía | Se ve con fuente del sistema |
| BUK (nómina) | Recibe el CSV de descuentos | Sin integración: carga manual por RRHH |
| Proveedor del comedor | Factura que se concilia | Sin integración: cotejo manual |
| Microsoft Teams | Coordinación con Talento Humano (cambios, turno nocturno) | Proceso manual, fuera de la app |
