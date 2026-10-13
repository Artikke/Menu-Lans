# Menu LANS — tarjeta de la app

## Qué es
Sistema de pedidos del comedor de **LANS Laboratorios de Referencia** (~143 colaboradores).
Los empleados apartan su comida de la semana desde el celular; el comedor ve cuántas comidas preparar
y Recursos Humanos saca los descuentos de nómina (BUK) y la conciliación de la factura del proveedor.

- URL: https://artikke.github.io/Menu-Lans/
- Repo: `Artikke/Menu-Lans` (público). Firebase: proyecto `menu-lans`.
- Generación: **temprana** (un solo `index.html` con CSS/JS inline + Firestore por REST, igual que Menu Club YAM).

## Proceso que cubre
1. El comedor publica el menú de la semana siguiente (normalmente el jueves).
2. Cada empleado pide por día, siempre para el día siguiente en adelante, y elige guiso, guarnición o ensalada y la hora en que pasa.
3. El comedor ve los pedidos de la semana (por día, platillo, hora y contenedores del turno nocturno) y prepara.
4. RRHH exporta por quincena el descuento a nómina (BUK) y la conciliación de la factura del proveedor.

## Dueño y responsables
| Rol | Persona |
|---|---|
| Dueño del área (decide reglas y prioridades) | [completar] |
| Operadora del sistema (día a día, catálogo, PINs) | [completar] |
| Contacto que pide cambios (Talento Humano) | Axel Rodrigo Ávila Ramírez |
| Desarrollo y soporte | Soluciones Digitales PROESA (Jorge Esteban Anaya) |

## Roles en la app
| Rol | Cómo entra | Qué puede hacer |
|---|---|---|
| Empleado (turno de día) | Sin login: número de empleado + nombre (se valida contra el catálogo) | Pedir y cancelar sus días (nunca hoy), elegir platillo y hora para pasar, ver su resumen, dejar comentario anónimo |
| Empleado turno nocturno | Igual; marcado `turno: "noche"` en el catálogo | Igual, pero sin hora: se le entrega en contenedor rotulado |
| Comedor (`admin`) | Botón **Admin** + `adminPin` | Editar y publicar el menú, ver pedidos por semana, leer comentarios |
| RRHH (`super`) | Botón **Admin** + `superPin` | Todo lo anterior + cortesías, catálogo y RFC, Excel semanal, BUK, conciliación, borrar pedidos y comentarios, pedir el día de hoy |

## Vocabulario del área
| Término | Significado |
|---|---|
| Guiso 1 / Guiso 2 | Plato fuerte y su alternativa (`platoFuerte`, `platoAlternativo`) |
| Guarnición 1 / 2 | Acompañamiento; si hay dos, el empleado elige una (`complemento`, `guarnicion2`) |
| Ensalada | Plato completo que sustituye guiso y guarnición |
| Entrada / Postre | Fijos del día |
| Semana del menú | Fecha del primer día del menú publicado (`AAAA-MM-DD`); agrupa los pedidos |
| Un día antes | Regla: se pide y cancela para mañana en adelante; hoy no se toca |
| Hora para pasar | Hora en que el empleado de día recoge su comida (12:30 a 22:00, cada media hora) |
| Turno nocturno / contenedor rotulado | Empleados de noche; su comida se entrega empacada con su nombre |
| Cortesía | Comida sin descuento para alguien fuera del catálogo (visitas, etc.) |
| BUK | Sistema de nómina; recibe un CSV con el descuento por empleado y quincena |
| Descuento colaborador | Lo que se descuenta al empleado por comida (`PRECIO_DESCUENTO_COLABORADOR`) |
| Conciliación de factura | Reporte por quincena para cotejar la factura del proveedor (precio base + IVA) |
| Buzón | Comentarios anónimos (texto y foto opcional) para comedor y RRHH |

## Arquitectura
```
 Celular / navegador
 ┌──────────────────────────────────────────────┐
 │ index.html (HTML + CSS + JS, sin build)      │
 │  - guard de dominio (artikke.github.io)      │
 │  - vistas: empleado | panel comedor | RRHH   │
 └───────┬──────────────────────┬───────────────┘
         │ REST (token anónimo) │ REST
         ▼                      ▼
 Firebase Auth (anónimo)   Cloud Firestore  ◄── firestore.rules (validan PIN, forma, "hoy no se toca")
                               │
 GitHub Pages ── sirve index.html y logo.png desde la rama main
 CDN: jsDelivr (xlsx-js-style) · Google Fonts
 Salidas manuales: Excel semanal · CSV BUK · CSV/XLSX conciliación
```
No hay backend propio ni API: el navegador lee y escribe Firestore directo y las reglas son la única capa de seguridad.

## Colecciones en Firestore
| Ruta | Contenido | Lee | Escribe |
|---|---|---|---|
| `config/menu` | Menú publicado: mes, mesNum, semana, año, días con platillos | Cualquiera con la app | Comedor, RRHH |
| `config/catalogo` | `{ numEmp: { nombre, turno? } }` | Cualquiera con la app | RRHH |
| `config/catalogo_rfc` | `{ numEmp: rfc }` | RRHH | RRHH |
| `config/cortesias` | `{ items: [{ nombre, dias }], semana }` | Comedor, RRHH | RRHH |
| `config/secrets` | `adminPin`, `superPin` | Nadie desde el cliente | Solo consola |
| `pedidos/{semana}_{numEmp}` | Pedido semanal: días, platillo, guarnición, hora | Por id: cualquiera; listar: comedor/RRHH | Empleado (reglas), RRHH |
| `orders/{numEmp}` | Formato anterior (semana del 5-oct-2026), solo lectura | Igual que arriba | Solo RRHH |
| `historial/{AAAA-M-Qn}` | Quincenas archivadas antes de los pedidos semanales + cortesías | RRHH | RRHH |
| `admin_sessions/{uid}` | Sesión de admin `{ pin, level, createdAt }`, vence a las 12 h | El mismo uid | El mismo uid (si el PIN coincide) |
| `comentarios/{autoId}` | Buzón anónimo `{ texto, fecha, foto? }` | Comedor, RRHH | Crear: cualquiera; borrar: RRHH |

Detalle de campos y sensibilidad: [docs/contrato.md](docs/contrato.md).

## Reglas de negocio
- **Un día antes:** se pide y se cancela a cualquier hora, siempre para el día siguiente en adelante. El día de hoy (hora de México) no se agrega ni se quita. Lo validan las reglas; solo RRHH puede saltarlo. Si el menú publicado es de una semana futura, todos sus días están abiertos.
- Un pedido por empleado y semana (`pedidos/{semana}_{numEmp}`); las semanas pasadas no se borran.
- Solo se escribe la semana del menú publicado; el número de empleado debe existir en el catálogo y el nombre escrito debe coincidir.
- Turno de día: elegir hora para pasar (12:30 a 22:00, cada 30 min) es obligatorio. Turno nocturno: no lleva hora.
- Si eligen ensalada no eligen guiso ni guarnición; con dos guarniciones se elige una.
- Servicio del comedor: 12:30 a 17:30. El menú de la semana siguiente se publica el jueves.
- Precios (en `index.html`): descuento al colaborador $56.71 por comida; proveedor $103.45 + IVA 16%.
- BUK y conciliación son por quincena (1-15 y 16-fin de mes) y cuentan cada comida en su fecha real.
- Cortesías pertenecen a una semana; al agregar en una semana nueva las anteriores se archivan en `historial`.
- Sesión admin: vence a las 12 h (reglas) o a los 15 min sin actividad (navegador).
- Buzón: anónimo, 3 a 400 caracteres, foto opcional comprimida.

## Deuda conocida
Priorizada y con plan en [docs/diagnostico.md](docs/diagnostico.md). Lo más urgente:
- **Datos personales en repo público:** `setup/catalogo_lans.txt` (nombres y RFC de 148 empleados) y un RFC real de ejemplo en `README.md` (historial) e `index.html`.
- Cualquiera con el link puede pedir o cancelar a nombre de otro número de empleado y ver la lista de nombres del catálogo.
- PINs compartidos por rol, sin usuario ni bitácora de quién hizo qué.
- `firestore.rules` se publica a mano en la consola; sin CI ni pruebas automáticas.
- Respaldos de Firestore: [completar: ¿hay export programado?].
- Código monolítico (~3,100 líneas), precios y `SEMANA_LEGADO` fijos en el código, código muerto de horarios viejos.

## Para trabajar en el código
- Pruebas locales: `npx -y http-server -p 8765 -c-1` y abrir http://localhost:8765 (el guard permite `localhost`).
- Cambios en `firestore.rules` y en `index.html` que dependen uno del otro se publican juntos: merge a `main` (Pages) y pegar las reglas en Firebase Console → Firestore → Reglas.
- Probar reglas con el emulador de Firestore antes de publicarlas.
- No subir datos de empleados (nombres, RFC) al repo.
