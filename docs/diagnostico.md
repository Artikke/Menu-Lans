# Diagnóstico — Menu LANS

- Fecha: 2026-10-13
- Versión revisada: `main` en `01f4211` (pedidos por semana y hora para pasar por la comida)
- Generación: **temprana** (un `index.html` + Firestore por REST)
- Dueño del área: [completar] · Operadora: [completar]
- Estándar usado: lista de puntos de Soluciones Digitales PROESA recibida el 2026-10-13. Cuando haya acceso a `Grupo-PROESA/playbook-soluciones-digitales`, cotejar contra el playbook oficial.

## Resumen
La app cumple su función y está en uso: pedidos, panel del comedor, reportes BUK y conciliación, con reglas de Firestore que validan en el servidor lo importante (PINs, forma del pedido, "hoy no se toca").
No sigue la arquitectura estándar en ningún punto técnico: no tiene backend, ni migraciones, ni login corporativo, ni CI/CD formal.
El riesgo más alto no es técnico sino de datos: **el repo es público y contiene nombres y RFC de 148 empleados**.

## Comparación contra el estándar
| Punto | Estándar | Menu LANS hoy | Estado |
|---|---|---|---|
| Repositorio | En la organización `Grupo-PROESA` | `Artikke/Menu-Lans`, cuenta personal, **público** | ❌ |
| Backend | FastAPI + uv + Python 3.12 | No hay. El navegador habla directo con Firestore por REST | ❌ |
| Migraciones | Alembic | No hay esquema formal; Firestore sin migraciones. El cambio a pedidos semanales se resolvió en código (`SEMANA_LEGADO`, colección `orders` de solo lectura) | ❌ |
| Autenticación | Portal Gateway | Empleado: sin login (número + nombre contra catálogo, token anónimo de Firebase). Admin: PIN compartido por rol (comedor / RRHH) validado por reglas | ❌ |
| Integraciones | API con token | Ninguna API. BUK y factura se alimentan con archivos CSV/XLSX descargados a mano | ❌ |
| Design system | `@proesa/design` | CSS propio con variables (`--primary`, `--accent`…), fuentes Inter y Montserrat | ❌ |
| Ayuda embebida | Ayuda dentro de la app | Parcial: textos de apoyo, avisos y mensajes de error en pantalla; no hay sección de ayuda ni guía por rol | ⚠️ |
| CI | `ci.yml` | No hay workflows. Sin lint ni pruebas automáticas | ❌ |
| CD | `deploy.yml` | GitHub Pages publica `main` automáticamente (sin workflow propio). `firestore.rules` se pega **a mano** en Firebase Console | ⚠️ |
| Health | `/api/health` | No hay endpoint. Solo un indicador "Sincronizado / Sin conexión" en pantalla | ❌ |
| Documentación | Tarjeta, README, diagnóstico, contrato | README detallado (puesta en marcha, seguridad). Con esta rama: `CLAUDE.md`, `docs/diagnostico.md`, `docs/contrato.md` | ✅ |

## Qué funciona bien
- **Reglas de Firestore serias para una app temprana:** todo exige token; PINs en `config/secrets` ilegibles desde el cliente; sesión de admin validada por reglas y con vencimiento de 12 h; validación de forma de pedidos y comentarios.
- **La regla de negocio crítica está en el servidor:** el día de hoy no se agrega ni se quita (hora de México), aunque alguien manipule el navegador.
- **Separación de roles** comedor / RRHH, y RFC en un documento aparte que solo RRHH lee.
- **Lecturas acotadas:** cada empleado lee solo su pedido; listar pedidos requiere sesión de admin.
- **Historial por semana:** los pedidos ya no se borran; se consulta cualquier semana y los reportes cuentan por fecha real.
- **Reportes que usa el área:** Excel semanal, CSV para BUK y conciliación de factura (CSV y XLSX).
- **Operación sencilla:** sin servidores que mantener, costo casi cero, funciona bien en celular.
- **Probado con emulador** de Firestore y Playwright en los últimos cambios (pruebas manuales, no automatizadas en el repo).

## Deuda priorizada por riesgo
| # | Riesgo | Deuda | Impacto | Acción propuesta |
|---|---|---|---|---|
| 1 | 🔴 Crítico | `setup/catalogo_lans.txt` con **nombres y RFC de 148 empleados** en repo **público**, presente desde el primer commit. Además un RFC real como ejemplo en `index.html` (placeholder de carga masiva) y en versiones anteriores de `README.md` | Exposición de datos personales (LFPDPPP). Cualquiera puede descargarlo hoy y del historial de git | Hacer el repo privado de inmediato o moverlo a `Grupo-PROESA` privado; quitar el archivo y el placeholder; limpiar historial; evaluar con legal/RRHH [completar] |
| 2 | 🟠 Alto | Sin identidad de empleado: cualquiera con el link puede pedir o cancelar con el número de otro, y cualquiera con el link lee el catálogo (número, nombre y turno de todos) | Pedidos falsos que se descuentan por nómina; lista de personal expuesta | Login corporativo (Portal Gateway); mientras tanto, no exponer el catálogo completo al cliente |
| 3 | 🟠 Alto | PINs compartidos por rol, sin usuarios ni bitácora; un PIN de 6 dígitos se puede adivinar contra las reglas | No se sabe quién publicó, borró o cambió algo; si el PIN se filtra hay que cambiarlo a todos | Usuarios con rol vía Portal Gateway; mientras tanto rotar PINs y definir quién los resguarda |
| 4 | 🟠 Alto | `firestore.rules` se publica a mano y debe ir sincronizada con `index.html` | Si se publica una sin la otra, los pedidos fallan (pasó en el cambio a pedidos semanales y se coordinó a mano) | Desplegar reglas desde CI (`firebase deploy --only firestore:rules`) junto con la página |
| 5 | 🟠 Alto | Respaldos: [completar: confirmar si hay export programado de Firestore] | Un borrado o error deja sin pedidos ni historial para BUK | Export programado de Firestore a Cloud Storage o respaldo semanal |
| 6 | 🟡 Medio | Sin CI ni pruebas automáticas; monolito de ~3,100 líneas | Cada cambio depende de pruebas manuales; fácil romper reportes | `ci.yml` con pruebas de reglas (emulador) y pruebas de flujo (Playwright) |
| 7 | 🟡 Medio | Precios (`56.71`, `103.45`, IVA) fijos en el código | Un cambio de precio requiere tocar código; riesgo de descuentos mal calculados | Moverlos a configuración editable por RRHH con historial de vigencia |
| 8 | 🟡 Medio | Transición a pedidos semanales: `SEMANA_LEGADO` y colección `orders` de solo lectura | Código especial que ya no se necesita después de la quincena de octubre | Tras cerrar la conciliación de octubre, archivar `orders` en `historial` y quitar el código de legado |
| 9 | 🟡 Medio | Cualquier persona con un id puede leer un pedido semanal (`get` abierto a cualquier sesión) | Se puede consultar qué pidió alguien conociendo su número y la semana | Restringir al dueño del pedido cuando exista identidad |
| 10 | 🟢 Bajo | Fotos del buzón en base64 dentro del documento de Firestore | Documentos pesados; lecturas más caras | Guardar fotos en Cloud Storage |
| 11 | 🟢 Bajo | Librerías por CDN sin integridad (SRI): `xlsx-js-style`, Google Fonts | Si el CDN cambia el archivo, la app carga código ajeno | Fijar SRI o empaquetar |
| 12 | 🟢 Bajo | Código muerto y comentarios viejos (ventanas de horario L-V 7:00–11:30, `horarioNormalAbierto`, `nocheAbierta`) y `DEFAULT_MENU` de ejemplo | Confunde a quien mantiene | Limpieza en un cambio aparte |
| 13 | 🟢 Bajo | Datos del menú capturados a mano (mes, número de semana) | Un mes mal elegido mueve la semana de los pedidos | Calcular mes y semana a partir de la fecha |

## Plan por fases
### Fase 0 — Contener (esta semana)
- Repo privado o movido a `Grupo-PROESA` privado; quitar `setup/catalogo_lans.txt` y el RFC de ejemplo; limpiar historial de git.
- Confirmar restricción de la API key por dominio en Google Cloud (README §1.6).
- Confirmar o crear respaldo de Firestore.
- Nombrar dueño del área y operadora; definir quién resguarda los PINs y rotarlos.

### Fase 1 — Estabilizar en generación temprana (2–4 semanas)
- `ci.yml`: pruebas de reglas con emulador y pruebas de flujo con Playwright.
- `deploy.yml`: publicar página y reglas juntas desde `main`.
- Ayuda embebida por rol (empleado, comedor, RRHH).
- Precios configurables por RRHH.
- Quitar el código de legado (`SEMANA_LEGADO`, `orders`) después de la conciliación de octubre.

### Fase 2 — Migrar al estándar (por definir con el dueño)
- Backend FastAPI + uv + Python 3.12 con base de datos relacional y Alembic; migrar catálogo, menús, pedidos, historial y comentarios.
- Autenticación con Portal Gateway: cada empleado entra con su cuenta; admin por rol, con bitácora.
- Front con `@proesa/design`.
- `/api/health`, `ci.yml` y `deploy.yml` del estándar.

### Fase 3 — Integrar
- API con token hacia BUK para el descuento quincenal (en lugar del CSV).
- Reporte o API para el proveedor del comedor (conciliación de factura).
- Retirar Firestore cuando los datos estén migrados y validados.

## Pendientes por completar
- Dueño del área: [completar]
- Operadora del sistema: [completar]
- Quién resguarda los PINs y con qué frecuencia se rotan: [completar]
- Respaldos de Firestore: [completar]
- Revisión legal del RFC expuesto: [completar]
