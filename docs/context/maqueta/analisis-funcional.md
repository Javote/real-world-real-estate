# Requisitos Funcionales

rf_001_gestion_proyectos:
  descripcion: Gestion de Proyectos, Desarrollos, Torres

  items:
    - id: RF-001.1
      requisito: Visualizar listado de proyectos asignados al usuario autenticado
      prioridad: Alta

    - id: RF-001.2
      requisito: Cada proyecto muestra, nombre, ubicacion, cantidad de unidades, fecha estimada de entrega
      prioridad: Alta

    - id: RF-001.3
      requisito: Hero image por proyecto, visualizacion prominente del desarrollo
      prioridad: Alta

    - id: RF-001.4
      requisito: Indicador de progreso general del proyecto, milestones completados
      prioridad: Alta

    - id: RF-001.5
      requisito: Estado del proyecto, En curso, Retrasado, Por iniciar
      prioridad: Media

    - id: RF-001.6
      requisito: Filtrar proyectos por estado, ubicacion, o fecha de entrega
      prioridad: Media

rf_002_visualizacion_milestones:
  descripcion: Visualizacion de Milestones por Proyecto

  items:
    - id: RF-002.1
      requisito: Ver milestones del proyecto en formato de linea de tiempo vertical
      prioridad: Alta

    - id: RF-002.2
      requisito: Identificar visualmente el estado de cada milestone, Pending, InProgress, Completed, Observed
      prioridad: Alta

    - id: RF-002.3
      requisito: Cada milestone indica alcance, aplica a todo el proyecto, todas las unidades
      prioridad: Alta

    - id: RF-002.4
      requisito: Expandir un milestone para ver evidencia asociada y detalles
      prioridad: Alta

    - id: RF-002.5
      requisito: Visualizar certificador responsable del milestone
      prioridad: Media

    - id: RF-002.6
      requisito: Ver timestamp de certificacion y TXID de anclaje en Cardano
      prioridad: Alta

rf_003_gestion_evidencia:
  descripcion: Gestion de Evidencia por Proyecto

  items:
    - id: RF-003.1
      requisito: Subir documentos asociados a un milestone de proyecto
      prioridad: Alta

    - id: RF-003.2
      requisito: La evidencia se registra una vez para todo el proyecto, no por unidad individual
      prioridad: Alta

    - id: RF-003.3
      requisito: Ver lista de evidence items con tipo, categoria, fecha y autoria
      prioridad: Alta

    - id: RF-003.4
      requisito: Previsualizar documentos sin descargar, visor integrado
      prioridad: Media

    - id: RF-003.5
      requisito: Descargar documentos originales
      prioridad: Alta

    - id: RF-003.6
      requisito: Verificar integridad criptografica, hash SHA-256 y enlace a Cardano
      prioridad: Alta

    - id: RF-003.7
      requisito: Visualizar bundles de evidencia con commitment hash por milestone
      prioridad: Media

rf_004_informacion_unidades:
  descripcion: Informacion de Unidades, Subpagina por Proyecto

  items:
    - id: RF-004.1
      requisito: Acceder a subpagina Tipos de Unidad dentro del proyecto
      prioridad: Media

    - id: RF-004.2
      requisito: Visualizar tipologias de unidades, nombre, cantidad, metraje, caracteristicas
      prioridad: Media

    - id: RF-004.3
      requisito: Mostrar precio orientativo por tipologia
      prioridad: Baja

    - id: RF-004.4
      requisito: Indicar pisos y orientacion de cada tipologia
      prioridad: Baja

rf_005_roles_permisos:
  descripcion: Roles y Permisos

  items:
    - id: RF-005.1
      requisito: Login con redireccion segun rol, Developer, Certifier, Buyer, Investor
      prioridad: Alta

    - id: RF-005.2
      requisito: Developer, carga evidencia a proyectos asignados
      prioridad: Alta

    - id: RF-005.3
      requisito: Certifier, aprueba o rechaza milestones de proyectos asignados
      prioridad: Alta

    - id: RF-005.4
      requisito: Buyer, consulta proyectos donde tiene unidades adquiridas
      prioridad: Alta

    - id: RF-005.5
      requisito: Todos los roles ven el mismo timeline de proyecto, diferente segun permisos de accion
      prioridad: Alta

rf_006_transparencia_verificacion:
  descripcion: Transparencia y Verificacion

  items:
    - id: RF-006.1
      requisito: Mostrar TXID de Cardano con enlace a explorador de bloques
      prioridad: Alta

    - id: RF-006.2
      requisito: Exportar reporte de trazabilidad del proyecto en PDF
      prioridad: Media

    - id: RF-006.3
      requisito: Pantalla publica de verificacion, sin login, para validar hash contra blockchain
      prioridad: Alta

    - id: RF-006.4
      requisito: La verificacion publica muestra proyecto y milestone asociado al documento
      prioridad: Media

# Arquitectura de Componentes de Frontend (sugerida)

src:
  components:
    layout:
      - NavigationBar: Navegacion principal por rol
      - Footer: Links a Cardano, ayuda
      - ProjectBreadcrumb: Proyecto > Tab activa

    projects:
      - ProjectList: Grid de tarjetas de proyecto
      - ProjectCard: Hero image, progreso, estado
      - ProjectHero: Imagen destacada del proyecto
      - ProjectProgressBar: Barra de progreso con milestones
      - ProjectFilters: Filtros de busqueda
      - ProjectMeta: Ubicacion, unidades, entrega

    milestones:
      - MilestoneTimeline: Linea de tiempo vertical por proyecto
      - MilestoneNode: Nodo individual con estado visual
      - MilestoneDetail: Panel expandible con evidencia
      - MilestoneStatusBadge: Pending, InProgress, Completed, Observed
      - MilestoneScope: Indicador de alcance del proyecto

    evidence:
      - EvidenceUploader: Drag-and-drop para subida
      - EvidenceList: Lista de items del proyecto
      - EvidenceItem: Fila individual con acciones
      - DocumentViewer: Previsualizacion embebida
      - IntegrityVerifier: Hash, TXID, verificacion
      - EvidenceBundleCard: Agrupacion por milestone

    unitTypes:
      - UnitTypeList: Grid de tipologias
      - UnitTypeCard: Nombre, specs, cantidad, precio
      - UnitTypeDetail: Modal o expand de tipologia

    blockchain:
      - TxIdLink: Enlace a explorador de bloques
      - HashDisplay: SHA-256 con copy
      - VerificationWidget: Estado de verificacion on-chain
      - ProjectAnchorSummary: Resumen de anclajes del proyecto

    auth:
      - LoginForm
      - RoleSelector: Developer, Certifier, Buyer
      - RoleGuard: Proteccion de rutas por rol
      - PermissionIndicator

  pages:
    - Dashboard: Segun rol, lista de proyectos
    - ProjectDetail: Hero mas tabs
    - ProjectDetail_tabs:
        - Timeline: default
        - UnitTypes
        - Documents
    - PublicVerification: Sin autenticacion
    - ExportReport: Generacion PDF de proyecto

  hooks:
    - useAuth
    - useProjects
    - useProjectDetail
    - useMilestones
    - useEvidence
    - useBlockchainAnchor

  services:
    - apiClient
    - projectsApi
    - milestonesApi
    - evidenceApi
    - blockchainApi

  types:
    - project
    - milestone
    - evidence
    - unitType
    - blockchain

rutas:
  - /login: Pantalla de login con selector de rol
  - /: Dashboard segun rol del usuario
  - /projects/{id}: Detalle de proyecto con tabs
  - /verify: Verificacion publica de documentos
  - /projects/{id}/report: Exportacion de reporte PDF

componentes_por_funcionalidad:
  Listado de proyectos: ProjectList, ProjectCard, ProjectHero, ProjectProgressBar, ProjectFilters
  Detalle de proyecto: ProjectDetail, MilestoneTimeline, UnitTypeList, DocumentList
  Milestones: MilestoneTimeline, MilestoneNode, MilestoneDetail, MilestoneStatusBadge
  Evidencia: EvidenceUploader, EvidenceList, EvidenceItem, DocumentViewer, IntegrityVerifier
  Blockchain: TxIdLink, HashDisplay, VerificationWidget, ProjectAnchorSummary
  Autenticacion: LoginForm, RoleSelector, RoleGuard, PermissionIndicator

# Análisis de UX/UI

flujos:

  developer_carga_evidencia:
    - Login
    - Dashboard de Proyectos
    - Seleccionar Proyecto: hero image
    - Tab Trazabilidad
    - Elegir Milestone: InProgress
    - Subir documentos
    - Confirmar anclaje
    - Ver TXID generado

  certifier_aprueba_milestone:
    - Login
    - Dashboard de Pendientes
    - Seleccionar Proyecto
    - Revisar evidencia del milestone
    - Aprobar u observar
    - Estado cambia: Completed u Observed para todo el proyecto

  buyer_consulta_proyectos:
    - Login
    - Mis Proyectos: con unidades adquiridas
    - Seleccionar Proyecto
    - Ver timeline de milestones del proyecto
    - Tab opcional: Tipos de Unidad para ver specs
    - Verificar integridad de documentos
    - Exportar reporte

  verificacion_publica:
    - Acceder a /verify
    - Ingresar hash o TXID
    - Sistema consulta Cardano
    - Muestra: proyecto, milestone, timestamp, validez

pantallas:

  dashboard_proyectos:
    descripcion: Lista de proyectos con hero image para Developer y Buyer
    elementos:
      - Header: Logo, navegacion, usuario
      - Titulo: Mis Proyectos
      - Boton: Nuevo proyecto
      - Grid de ProjectCards:
          - Hero image
          - Nombre del proyecto
          - Ubicacion
          - Cantidad de unidades
          - Fecha de entrega
          - Barra de progreso
          - Estado: En curso, Retrasado, Por iniciar
          - Link: Ver detalle

  detalle_proyecto:
    descripcion: Hero prominente mas timeline de milestones
    elementos:
      - Header: Volver, configuracion
      - Hero section:
          - Imagen grande: imagen-real-estate.jpg
          - Nombre del proyecto
          - Ubicacion y cantidad de unidades
          - Stats: progreso, milestones, entrega, documentos
      - Tabs:
          - Trazabilidad: activo por defecto
          - Tipos de Unidad
          - Documentos
      - Timeline vertical:
          - Nodo con indicador de estado
          - Nombre del milestone
          - Badge de estado
          - Meta informacion: documentos, unidades, certificador
          - TXID si esta anclado
          - Seccion expandible de evidencia
          - Area de subida si esta en progreso
      - Boton: Exportar PDF

  tipos_de_unidad:
    descripcion: Subpagina con grid de tipologias
    elementos:
      - Header: Volver, configuracion
      - Titulo: Tipos de Unidad
      - Subtitulo: Total de unidades en el proyecto
      - Grid de UnitTypeCards:
          - Nombre de tipologia
          - Cantidad de unidades
          - Metraje
          - Dormitorios y banos
          - Caracteristicas: balcon, orientacion
          - Precio desde
          - Pisos disponibles

principios_de_diseño:
  - Transparencia progresiva: Informacion tecnica disponible sin sobrecargar
  - Estados inmediatos: Colores claros para cada estado del milestone
  - Confianza verificable: Huella digital accesible en un clic
  - Contexto de rol: Misma pantalla, diferentes acciones segun permisos
  - Jerarquia visual: Hero prominente, progreso a primera vista


# Integración con Backend/API

convenciones_generales:
  - Todos los endpoints devuelven JSON
  - POST devuelve el recurso creado, mismo formato que GET correspondiente
  - PATCH devuelve el recurso actualizado, mismo formato que GET correspondiente
  - DELETE devuelve 204 No Content sin cuerpo
  - Errores devuelven código HTTP apropiado con mensaje descriptivo
  - Parámetros de ruta usan notación {id}
  - Parámetros de query string usan notación ?parametro=valor

modelo_de_datos:

  project:
    descripcion: Desarrollo inmobiliario completo, Torre A, Torre B, etc
    campos:
      - project_id: UUID, identificador único
      - name: string, ej Torre A
      - slug: string, URL-friendly, ej torre-a
      - location: object, dirección, ciudad, coordenadas geográficas
      - hero_image_url: string, URL de imagen principal
      - total_units: integer, cantidad total de unidades
      - unit_types: array, resumen de tipologías
      - estimated_delivery: ISO date, fecha estimada de entrega
      - status: enum, planning | in_progress | delayed | completed
      - progress: object, completed_milestones, total_milestones, percentage
      - developer: object, account_id, name
      - certifier: object o null, certifier_id, name, license
      - milestones: array, lista de MilestoneSummary asociados

  milestone:
    descripcion: Etapa de construcción del proyecto, aplica a todo el proyecto
    campos:
      - milestone_id: UUID, identificador único
      - project_id: UUID, referencia al proyecto padre
      - name: string, ej Cimentación
      - sequence_order: integer, orden en la línea de tiempo
      - state: enum, Pending | InProgress | Completed | Observed
      - scope: object, type project_wide, unit_count integer
      - certified_at: ISO datetime o null, fecha de certificación
      - certified_by: UUID o null, referencia al certificador
      - evidence_summary: object, count, has_anchor, anchor_txid
      - evidence_items: array, lista completa de Evidence, solo en detalle

  evidence:
    descripcion: Documento o archivo de evidencia asociado a un milestone
    campos:
      - evidence_id: UUID, identificador único
      - project_id: UUID, referencia al proyecto
      - milestone_id: UUID, referencia al milestone
      - evidence_type: enum, document | photo | certificate
      - category: string, clasificación interna
      - authoritative: boolean, si es documento oficial o certificado
      - scope: object, type project_wide, unit_count integer
      - filename: string, nombre original del archivo
      - mime_type: string, tipo MIME del archivo
      - sha256_hash: string, hash criptográfico del contenido
      - uploaded_at: ISO datetime, fecha de subida
      - uploaded_by: UUID, referencia al usuario que subió
      - on_chain_anchor: object o null, txid, block_timestamp, block_number
      - download_url: string, URL temporal para descarga

  unit_type:
    descripcion: Tipología de unidad dentro del proyecto, no unidad individual
    campos:
      - unit_type_id: UUID, identificador único
      - project_id: UUID, referencia al proyecto
      - name: string, nombre comercial, ej 2 Ambientes
      - code: string, código interno, ej T2A
      - quantity: integer, cantidad de unidades de este tipo
      - specs: object, surface_m2, bedrooms, bathrooms, balcony, orientation, floors
      - pricing: object, currency, min_price, max_price
      - unit_ids: array o null, referencias a unidades específicas, opcional

  account:
    descripcion: Usuario del sistema con rol asignado
    campos:
      - account_id: UUID, identificador único
      - email: string, correo electrónico
      - role: enum, developer | certifier | buyer | admin
      - profile: object, datos según rol, nombre, licencia para certifier, etc

endpoints:

  autenticacion:
    - metodo: POST
      ruta: /api/v1/auth/login
      descripcion: Iniciar sesión
      parametros: email, password en body
      respuesta: Account

    - metodo: POST
      ruta: /api/v1/auth/refresh
      descripcion: Renovar token
      parametros: refresh_token en body
      respuesta: tokens

    - metodo: DELETE
      ruta: /api/v1/auth/logout
      descripcion: Cerrar sesión
      parametros: ninguno
      respuesta: 204

    - metodo: GET
      ruta: /api/v1/auth/me
      descripcion: Perfil actual
      parametros: ninguno
      respuesta: Account

  proyectos:
    - metodo: GET
      ruta: /api/v1/projects
      descripcion: Listado con filtros
      parametros: ?status=&city=&delivery_before=
      respuesta: array de Project resumido

    - metodo: GET
      ruta: /api/v1/projects/{id}
      descripcion: Detalle completo
      parametros: ninguno
      respuesta: Project completo

    - metodo: GET
      ruta: /api/v1/projects/{id}/timeline
      descripcion: Milestones con estado
      parametros: ninguno
      respuesta: array de Milestone

    - metodo: GET
      ruta: /api/v1/projects/{id}/unit-types
      descripcion: Tipologías de unidad
      parametros: ninguno
      respuesta: array de UnitType

    - metodo: GET
      ruta: /api/v1/projects/{id}/documents
      descripcion: Documentos generales
      parametros: ninguno
      respuesta: array de Evidence

  milestones:
    - metodo: GET
      ruta: /api/v1/projects/{id}/milestones
      descripcion: Listado por proyecto
      parametros: ninguno
      respuesta: array de Milestone

    - metodo: GET
      ruta: /api/v1/milestones/{id}
      descripcion: Detalle de milestone
      parametros: ninguno
      respuesta: Milestone completo

    - metodo: PATCH
      ruta: /api/v1/milestones/{id}/state
      descripcion: Cambiar estado
      parametros: state en body
      respuesta: Milestone actualizado

    - metodo: GET
      ruta: /api/v1/milestones/{id}/evidence
      descripcion: Evidencia del milestone
      parametros: ninguno
      respuesta: array de Evidence

  evidencia:
    - metodo: POST
      ruta: /api/v1/projects/{id}/evidence
      descripcion: Subir documento
      parametros: multipart/form-data con archivo
      respuesta: Evidence creado

    - metodo: GET
      ruta: /api/v1/evidence/{id}
      descripcion: Detalle de evidencia
      parametros: ninguno
      respuesta: Evidence completo

    - metodo: GET
      ruta: /api/v1/evidence/{id}/download
      descripcion: Descargar archivo
      parametros: ninguno
      respuesta: archivo binario

    - metodo: GET
      ruta: /api/v1/evidence/{id}/verify
      descripcion: Verificar en blockchain
      parametros: ninguno
      respuesta: estado de verificación

    - metodo: POST
      ruta: /api/v1/milestones/{id}/bundle
      descripcion: Crear bundle de evidencias
      parametros: array de evidence_ids en body
      respuesta: bundle con commitment hash

  blockchain_verificacion:
    - metodo: GET
      ruta: /api/v1/blockchain/verify
      descripcion: Verificar hash público
      parametros: ?hash=
      respuesta: resultado de verificación

    - metodo: GET
      ruta: /api/v1/blockchain/tx/{txid}
      descripcion: Consultar transacción
      parametros: ninguno
      respuesta: datos de la transacción

    - metodo: GET
      ruta: /api/v1/projects/{id}/anchors
      descripcion: Resumen de anclajes
      parametros: ninguno
      respuesta: lista de anchors del proyecto

ejemplos_get:

  get_projects_id: |
    {
      "project_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Torre A",
      "slug": "torre-a",
      "location": {
        "address": "Av. Santa Fe 3200",
        "city": "Buenos Aires",
        "country": "Argentina",
        "coordinates": [-34.5889, -58.3930]
      },
      "hero_image_url": "https://cdn.proptrust.com/projects/torre-a/hero.jpg",
      "total_units": 48,
      "unit_types": [
        {
          "unit_type_id": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
          "name": "2 Ambientes",
          "code": "T2A",
          "quantity": 24
        },
        {
          "unit_type_id": "c3d4e5f6-a7b8-9012-cdef-345678901234",
          "name": "3 Ambientes",
          "code": "T3A",
          "quantity": 16
        }
      ],
      "estimated_delivery": "2025-12-15",
      "status": "in_progress",
      "progress": {
        "completed_milestones": 3,
        "total_milestones": 5,
        "percentage": 60
      },
      "developer": {
        "account_id": "d4e5f6a7-b8c9-0123-defa-456789012345",
        "name": "Constructora del Sol S.A."
      },
      "certifier": {
        "certifier_id": "e5f6a7b8-c9d0-1234-efab-567890123456",
        "name": "Ing. Carlos Ruiz",
        "license": "Mat. 45281"
      },
      "milestones": [
        {
          "milestone_id": "f6a7b8c9-d0e1-2345-fabc-678901234567",
          "name": "Cimentación",
          "sequence_order": 1,
          "state": "Completed",
          "scope": {
            "type": "project_wide",
            "unit_count": 48
          },
          "certified_at": "2024-03-15T14:32:07Z",
          "certified_by": "e5f6a7b8-c9d0-1234-efab-567890123456",
          "evidence_summary": {
            "count": 12,
            "has_anchor": true,
            "anchor_txid": "8a3f5c7e9d1b2f4a6c8e0d2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2"
          }
        },
        {
          "milestone_id": "a7b8c9d0-e1f2-3456-abcd-789012345678",
          "name": "Estructura",
          "sequence_order": 2,
          "state": "InProgress",
          "scope": {
            "type": "project_wide",
            "unit_count": 48
          },
          "certified_at": null,
          "certified_by": null,
          "evidence_summary": {
            "count": 3,
            "has_anchor": false,
            "anchor_txid": null
          }
        }
      ]
    }

  get_projects_id_unit_types: |
    [
      {
        "unit_type_id": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
        "name": "2 Ambientes",
        "code": "T2A",
        "quantity": 24,
        "specs": {
          "surface_m2": [55, 68],
          "bedrooms": 1,
          "bathrooms": 1,
          "balcony": true,
          "orientation": ["Este", "Oeste"],
          "floors": [1, 16]
        },
        "pricing": {
          "currency": "USD",
          "min_price": 280000,
          "max_price": 320000
        },
        "unit_ids": null
      },
      {
        "unit_type_id": "c3d4e5f6-a7b8-9012-cdef-345678901234",
        "name": "3 Ambientes",
        "code": "T3A",
        "quantity": 16,
        "specs": {
          "surface_m2": [80, 95],
          "bedrooms": 2,
          "bathrooms": 2,
          "balcony": true,
          "orientation": ["Sur"],
          "floors": [10, 20]
        },
        "pricing": {
          "currency": "USD",
          "min_price": 420000,
          "max_price": 480000
        },
        "unit_ids": null
      }
    ]

  get_evidence_id: |
    {
      "evidence_id": "b8c9d0e1-f2a3-4567-bcde-890123456789",
      "project_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "milestone_id": "f6a7b8c9-d0e1-2345-fabc-678901234567",
      "evidence_type": "document",
      "category": "plan",
      "authoritative": true,
      "scope": {
        "type": "project_wide",
        "unit_count": 48
      },
      "filename": "plano_cimentacion_aprobado.pdf",
      "mime_type": "application/pdf",
      "sha256_hash": "a3f7c9e2d8b1f5a6e4c7d9b0f2e8a1c3d5b7e9f0a2c4d6e8f0a1b3c5d7e9f0a2",
      "uploaded_at": "2024-03-10T09:15:30Z",
      "uploaded_by": "g9h0i1j2-k3l4-5678-mnop-901234567890",
      "on_chain_anchor": {
        "txid": "8a3f5c7e9d1b2f4a6c8e0d2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2",
        "block_timestamp": "2024-03-15T14:32:07Z",
        "block_number": 10234567
      },
      "download_url": "https://cdn.proptrust.com/evidence/b8c9d0e1-f2a3-4567-bcde-890123456789/download?token=xyz123"
    }
