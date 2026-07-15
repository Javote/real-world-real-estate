# Reporte — Primer sprint: consolidación del proyecto

**Fecha:** 15 de julio de 2026
**Audiencia:** decisores del proyecto
**Estado general: encaminados.** El proyecto quedó unificado en un solo repositorio ordenado, con una demo funcionando de punta a punta y un plan de ejecución claro para los próximos sprints.

---

## 1. De dónde partimos

Hasta este sprint, el proyecto vivía repartido en tres piezas desconectadas:

| Pieza | Qué aportaba | Qué le faltaba |
|---|---|---|
| **Maqueta visual** (PropTrust) | La referencia de cómo debe verse y navegarse la app: login, paneles por rol, detalle de proyecto con su línea de tiempo de milestones, verificación de documentos | Era HTML estático con datos inventados y login simulado; no era una implementación real |
| **Backend PoC** | Una API real y verificada: autenticación segura (JWT + contraseñas cifradas), proyectos, milestones, subida de evidencia con huella criptográfica SHA-256, registro de auditoría. Incluía además un primer contrato inteligente en Aiken (Cardano) con la máquina de estados de milestones | No tenía interfaz: solo se podía usar por línea de comandos |
| **Guía de implementación** | La planificación seria: registro de decisiones, roadmap por sprints, especificaciones técnicas, convenciones de trabajo, y dos contratos de referencia para la fase on-chain avanzada | Eran documentos y diseños sin proyecto ejecutable; los archivos estaban sueltos, sin estructura |

Tener tres frentes separados frenaba el desarrollo: cada avance en uno exigía sincronizar a mano los otros dos, y no había una única fuente de verdad.

## 2. Qué hicimos: un solo proyecto, ordenado y funcionando

Se consolidó todo en un **monorepo único** (`plataforma/`), siguiendo el playbook de trabajo del equipo (documentación primero, decisiones registradas, integración continua desde el inicio). Fue un **refactor necesario**: no se tiró nada que funcionara, se reorganizó lo que ya existía para poder desarrollar mucho más rápido de acá en adelante.

Concretamente:

- **El backend entró tal cual** como el servicio de API del monorepo. Es el mismo código ya verificado (autenticación, proyectos, milestones, evidencia con hash, auditoría). La decisión de adoptarlo en lugar de reescribirlo está documentada y fundamentada (D-016 en el registro de decisiones): reescribir hubiera costado días sin agregar valor.
- **La maqueta se convirtió en la aplicación real.** Sus pantallas se portaron al framework definitivo (TanStack Start + React) conservando su estética, pero ahora **conectadas a la API real**: el login autentica de verdad, los paneles muestran datos reales, y la subida de documentos calcula y muestra la huella SHA-256 real de cada archivo.
- **Los contratos inteligentes quedaron unificados** en una sola carpeta: el validador de milestones que ya compilaba en el backend (la versión vigente) más los dos contratos de referencia de la guía para la fase avanzada (certificación y anclaje con token de estado). Compilan y su "blueprint" queda versionado en el repo. Este frente puede avanzar en paralelo sin depender de nada más.
- **La documentación quedó fusionada y coherente:** un solo registro de decisiones (17 entradas), un solo índice de especificaciones (7 specs, 6 ya escritas), roadmap, guía de commits y convenciones de trabajo con asistencia de IA. El material histórico (maqueta original, análisis funcional, registros previos) quedó congelado como referencia, sin mezclarse con lo vigente.
- **Calidad automatizada desde el primer día:** cada cambio pasa por integración continua (verificación de tipos, compilación de la app y de los contratos, y tests). El flujo de login ya tiene su suite de tests automatizados.

## 3. Estado actual, verificable

Hoy cualquier persona del equipo puede clonar el repositorio y, con cuatro comandos, levantar la aplicación completa:

- Login con usuarios de demostración por rol (developer, certificador, comprador).
- Panel por rol con proyectos, milestones y estadísticas reales.
- Detalle de proyecto con línea de tiempo de milestones y sus transiciones de estado válidas.
- Subida de evidencia (planos, fotos, permisos) con huella SHA-256 calculada y visible, lista para el anclaje en blockchain.
- Verificación de documentos por hash dentro de la plataforma.

Lo que **todavía no** está — y está planificado, no olvidado: el anclaje real en Cardano (los documentos figuran "pendiente de anclaje", el enganche está preparado), la verificación pública sin cuenta (depende del anclaje), y el rediseño de identidad visual (la estética actual es la de la maqueta, a propósito: se reemplaza sin tocar la lógica).

## 4. Por qué este refactor acelera el desarrollo

1. **Tres frentes pueden avanzar en paralelo sin pisarse:** diseño/UX sobre las pantallas ya portadas, contratos inteligentes (aislados, con sus propios tests), y backend/anclaje. Las reglas de paralelización están escritas en el propio repo.
2. **Una sola fuente de verdad:** decisiones, especificaciones y código viven juntos; cualquier contradicción se detecta y corrige en el mismo cambio.
3. **Al compartir framework entre interfaz y API, la integración que antes era "un proyecto aparte" ahora es una tarea de sprint.**
4. **La barrera de calidad es automática:** nada se integra si no compila, tipa y pasa los tests.

## 5. Próximo sprint

Objetivo: **el primer anclaje real en la blockchain de prueba de Cardano** (walking skeleton, SPEC-001) — un script que toma un documento, calcula su huella, la ancla en la red de prueba (Preprod) y la verifica públicamente por identificador de transacción. Es también la validación práctica de la librería web3 elegida (decisión D-005, con alternativa documentada si falla).

En paralelo:
- **Modo demo sin backend** (adaptador mock, SPEC-004): poder mostrar la app sin infraestructura, en cualquier máquina.
- **Contrato de datos compartido** entre interfaz y API (schemas Zod compartidos): elimina de raíz las desincronizaciones front/back.
- **Tests de la API y de los contratos** (los casos ya están especificados; hoy son la principal deuda declarada).
- **Arranque del rediseño visual** con la librería de componentes definitiva (shadcn/ui), sobre las pantallas existentes.

## 6. Roadmap (resumen — detalle en ROADMAP.md)

| Sprint | Objetivo | Resultado verificable |
|---|---|---|
| **1 (este)** ✅ | Consolidación + demo funcionando | App completa levantable en local; CI en verde |
| **2** | Walking skeleton + integración del anclaje | Un documento subido desde la app termina **anclado con TXID verificable** en el explorador de Cardano |
| **3** | Superficie developer completa | Flujo de carga de evidencia con confirmación de anclaje, de punta a punta por la interfaz |
| **4** | Superficie inversor | Dossier de proyecto compartible públicamente por link, sin datos personales de terceros |
| **5** | Fase on-chain avanzada + certificador/notario | Certificaciones y firmas con transacción on-chain propia |
| **6** | Cierre | Pruebas end-to-end por rol, endurecimiento, demo ensayada frente a alguien externo |

La regla del roadmap es la del playbook: **la fecha no se mueve; el alcance sí.** Cada sprint tiene criterios de salida binarios (se cumplen o no — sin zonas grises), y los riesgos conocidos tienen señal temprana y plan B documentados (por ejemplo: si la red de prueba o el proveedor de acceso a Cardano fallan, el modo simulado mantiene el producto usable y demostrable).

---

*Este reporte es una fotografía. Los documentos vivos que mandan son, en orden: `DECISIONS.md` → `CLAUDE.md` → `specs/` → `ROADMAP.md`.*
