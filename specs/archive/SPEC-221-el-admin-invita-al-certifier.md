# SPEC-221 — El admin invita al certifier, y el admin entra a todo desde la web

> Nace preparando el video walkthrough (2026-09-21). El proyecto que se crea en cámara nace con una
> sola membresía, la del developer, y sin la del certifier el Acto 4 (observar y certificar) no
> existe. La única forma de sumarlo era `POST /projects/:id/members`, admin-only y **sin pantalla**:
> se había corrido por consola en la prueba de volumen (3 proyectos) y hacía falta otra vez. El
> dueño decidió (D-095) que el admin es la salvaguarda, que puede todo lo que puede cualquier rol, y
> que tiene que poder hacerlo desde la web.

## Propósito

1. **El admin pasa por cualquier guard de rol en la web**, con su pantalla propia en `/admin`. El
   backend ya lo dejaba pasar en todas las rutas; la web no.
2. **El admin invita a un certifier a un proyecto** y el certifier acepta o rechaza desde su panel.
   Aceptar crea la membresía `verifier`. Mismo modelo que el buyer (invitación → aceptación →
   membresía), sin contrato ni anclaje.

## Alcance / NO-alcance

| Entra | No entra |
|---|---|
| `useRoleGuard` deja pasar al admin; `ROLE_LANDING['admin'] = '/admin'` | Solapa de admin en `/login` (se entra tipeando el usuario, a propósito) |
| `/admin`: elegir proyecto, ver sus miembros, invitar a un certifier, ver las invitaciones | Editar o quitar miembros, gestionar usuarios, cambiar roles |
| Barra de navegación del admin con la entrada a los cuatro paneles | Que las pantallas "mías" (mis unidades, mis firmas) muestren lo de otros al admin: se ven vacías, porque están acotadas al usuario |
| Invitaciones pendientes en el panel del certifier, con Aceptar/Rechazar | Inbox de notificaciones del certifier (no existe en M2-D5) |
| Audit log de invitar, aceptar y rechazar, visible para el developer del proyecto | Anclar la aceptación on-chain: sumarse a certificar no es un hecho del proyecto que haga falta probar |
| | Que el developer invite a su propio certifier (D-095: le resta independencia a la firma) |

## Interfaz

### Esquema — migración `0011_certifier_invitation.sql`

Tabla nueva `CertifierInvitation (id, projectId, certifierId, status, createdById, createdAt,
respondedAt)`, con un índice único **parcial** en `(projectId, certifierId) WHERE status =
'pending'`. Tabla propia y no una columna en `Invitation`: esa es la invitación a comprar, con
unidad y monto `NOT NULL`, y aceptarla crea un contrato. Aditiva: ninguna fila existente cambia.

### Endpoints

| Método y ruta | Quién | Qué |
|---|---|---|
| `POST /projects/:id/certifier-invitations` `{certifierId}` | admin | Crea la invitación `pending`. 400 `CERTIFIER_NOT_ELIGIBLE` si el usuario no es un `verifier` activo; 409 `ALREADY_MEMBER` si ya certifica el proyecto; 409 `INVITATION_ALREADY_PENDING` si ya tiene una sin responder |
| `GET /projects/:id/certifier-invitations` | admin | El historial del proyecto, la más nueva primero |
| `GET /certifier/invitations` | verifier (y admin) | Las pendientes de quien pregunta |
| `POST /certifier/invitations/:id/accept` | el certifier invitado (y admin) | `pending → accepted` + `ProjectMember(verifier)`, en una transacción |
| `POST /certifier/invitations/:id/decline` | el certifier invitado (y admin) | `pending → declined` |

Los schemas (`inviteCertifierSchema`, `certifierInvitationSchema`) viven en
`packages/shared/src/certifier.ts`. La autorización de responder es `dueño(CertifierInvitation:id)`:
una rama nueva de `OwnerSource` en `middlewares/auth.ts`, comparada por **id** (el certifier ya
tiene cuenta), no por email como la del buyer.

## Invariantes

1. **Aceptar y crear la membresía son atómicos.** No puede quedar una invitación `accepted` sin su
   `ProjectMember`.
2. **Responder es una sola vez.** La guarda es `WHERE status = 'pending'` en el `UPDATE`: de dos
   respuestas concurrentes gana una, la otra recibe 409 `INVITATION_NOT_PENDING`.
3. **Una sola pendiente por (proyecto, certifier)**, garantizada por el índice parcial, no por un
   chequeo previo. Después de un rechazo se puede volver a invitar.
4. **La membresía es del certifier invitado**, aunque responda el admin.
5. **Nada de esto toca la cadena.** Ni la invitación ni la aceptación anclan; el registro es el
   audit log (`INVITE_CERTIFIER`, `ACCEPT_CERTIFIER_INVITATION`, `DECLINE_CERTIFIER_INVITATION`).

## Casos borde (definen los tests)

`apps/api/test/spec-221-invitacion-certifier.test.ts`: solo el admin invita (developer → 403); un
no-certifier no se puede invitar; rechazar no crea membresía y se puede re-invitar; aceptar crea la
membresía; duplicada → 409; responder dos veces → 409; ya miembro → 409; otro usuario no puede
responder → 403; los tres eventos quedan en el audit log.

`apps/web/e2e/admin-certifier-invite.spec.ts`: developer crea un proyecto → admin invita →
certifier acepta desde su panel → el admin lo ve como miembro. Y el admin entra al panel del
developer desde su barra.

## Test IDs

Propios, porque ningún entregable define esta superficie: `ADMIN-PROJECT-001`,
`ADMIN-MEMBERS-002`, `ADMIN-CERTIFIER-INVITE-003`, `ADMIN-CERTIFIER-INVITATIONS-004` (el patrón de
`check-testids.mjs` no reclama `ADMIN-*`) y `CER-INVITATIONS-003`, declarado en
`FUERA_DEL_BACKLOG`. Ninguno entra al denominador de cobertura.

## Preguntas abiertas

- **Notificación al certifier.** Hoy la ve cuando abre su panel. Una notificación en la campana
  pide decidir primero qué hace la campana del certifier, que en M2-D5 no tiene inbox.
- **Invitar notaries.** El notary no trabaja por membresía de proyecto (M2-D1 §4), así que no hace
  falta hoy.
