# Contrato de integración · Comedor LANS

Lo que esta app ofrece a otras apps PROESA.

- **Dueño de la app:** Talento Humano (contacto: Axel Ávila). Los datos nuevos se piden al especialista responsable
- **Especialista responsable:** Jorge Anaya
- **Endpoints de integración:** **todavía no ofrece ninguno.** La app no tiene backend propio (es
  una página estática con Firestore, ver excepciones en `CLAUDE.md`). Si otra app necesita sus datos,
  se pide con un issue `cross-repo` en este repo.

## Qué datos tiene esta app

En Firestore, proyecto `menu-lans`.

| Dato | Descripción |
|---|---|
| `pedidos/{semana}_{numEmp}` | Pedido de cada colaborador por semana: días, guisado, guarnición, hora en que pasa, total y fecha. No se borran |
| `orders/{numEmp}` | Pedidos en el formato anterior (semana del 5 oct 2026). Solo lectura |
| `historial/{AAAA-M-Qn}` | Quincenas archivadas antes de los pedidos semanales y cortesías archivadas |
| `config/menu` | Menú publicado de la semana |
| `config/catalogo` | Catálogo de empleados: número, nombre y turno nocturno |
| `config/cortesias` | Cortesías registradas (nombre y días) y su semana |
| `config/secrets` | PIN de comedor y de RRHH. Nadie lo lee desde el navegador |
| `admin_sessions/{uid}` | Sesiones de admin abiertas con PIN (12 h) |
| `comentarios/{id}` | Buzón anónimo |

## Quién consume esta API

| App | Endpoints que usa | Desde |
|---|---|---|
| | | |

## Cambios

| Fecha | Cambio |
|---|---|
| 2026-10-29 | Versión inicial (sin endpoints) |
