Whitepaper: Real-World Real Estate Pre-Sale with Proof & Release

Abstract (Resumen)
Explica que la venta de propiedades en pozo exige que los compradores aporten capital mucho antes de que la unidad exista legalmente, acumulando años de registros y aprobaciones dispersas en canales informales.
Propone una plataforma que organiza esta trayectoria fragmentada en un historial ordenado y auditable por unidad, estructurado en hitos del ciclo de vida del proyecto.
La plataforma mantiene los documentos y datos personales fuera de la cadena (off-chain) por privacidad, mientras que ancla las huellas criptográficas con marcas de tiempo en la blockchain de Cardano para dar pruebas de integridad inmutables.

Problem Statement and Motivation (Planteamiento del problema y motivación)
Identifica la "brecha de confianza" en las ventas en pozo debido a la baja auditabilidad de los avances, evidencia de baja legitimidad o no estándar, disputas costosas sobre la "finalización" y certificaciones retrasadas.
La motivación es pasar de la "creencia a la verificación", permitiendo a los compradores monitorear el progreso estructurado y a los desarrolladores mejorar la transparencia continuamente.
Se aclara que la plataforma no reemplaza a las autoridades públicas ni a los procesos legales, sino que hace que el rastro de evidencia sea coherente y cronológico.

Objectives (Objetivos)
Proveer un flujo de trabajo claro de extremo a extremo para la trazabilidad en las etapas de construcción y preregistro.
Definir un modelo que detalle qué evidencia existe por hito, qué respalda y cómo se verifica.
Anclar las pruebas de integridad en Cardano manteniendo los datos sensibles fuera de la cadena.
Validar este enfoque a través de un proyecto piloto con datos y actores reales.

System Overview (Descripción general del sistema)
Detalla los componentes conceptuales: una aplicación web (interfaz de usuario), servicios backend y API off-chain (gestión de evidencias y control de acceso), y la capa de anclaje en Cardano (on-chain).
Define las entidades principales: la unidad en venta, los elementos o paquetes de evidencia por hito, los hitos del proyecto y el anclaje en cadena (transacciones de Cardano).

Stakeholders, Roles, and Governance (Partes interesadas, roles y gobernanza)
Identifica a los actores: el Desarrollador Inmobiliario (aporta evidencia), el Comprador/Inversor (visualiza la línea de tiempo) y el Administrador u operador de la plataforma.
El modelo de gobernanza combina la autorización off-chain (permisos basados en roles) y la gobernanza de estados on-chain (una máquina de estados mediante contratos inteligentes que regula el avance de los hitos y excepciones sin exponer datos).

Identity & Signatures Policy (Política de identidad y firmas)
Establece cuentas aprovisionadas mediante control de acceso por roles y vinculadas a unidades específicas.
Implementa un flujo de "autoridad primero", donde los documentos que requieren validación oficial deben estar certificados por la autoridad competente antes de que el desarrollador los suba a la plataforma.
Los hitos críticos no pueden marcarse como certificados si falta evidencia o las firmas requeridas (ya sean nativas o de profesionales off-chain) no están completas.
Garantiza el no repudio en la práctica mediante roles, firmas, anclajes criptográficos y registros de auditoría inalterables.

Workflow and State Model (Flujo de trabajo y modelo de estados)
Describe el flujo integral: configuración del proyecto, visibilidad de la línea de tiempo para el comprador, presentación de evidencias y la generación/anclaje de pruebas criptográficas.
Los hitos siguen cuatro estados de cara al usuario: Pendiente (Pending), En Progreso (In Progress), Certificado (Certified) y Observado (Observed - usado para reportar problemas y requerir correcciones).
Contempla caminos de excepción predefinidos para manejar retrasos o fallas de manera transparente y auditable en el sistema.

Evidence Model and Verification Blueprint (Modelo de evidencia y plan de verificación)
Presenta una taxonomía que categoriza la evidencia (planos técnicos, avance de obra, permisos, etc.), sus fuentes típicas, qué respaldan y sus métodos de prueba de integridad.
Precisa qué prueba el anclaje (integridad, orden cronológico y auditabilidad) y qué no prueba.
Ofrece una guía paso a paso para que cualquier revisor externo pueda verificar la integridad de los archivos de forma independiente recalculando el hash SHA-256 y comparándolo con el registro en la cadena (TXID).

On-Chain / Off-Chain Boundaries (Límites On-Chain / Off-Chain)
Define lo que se graba en la cadena: huellas criptográficas de la evidencia, marcas de tiempo, identificadores y eventos de estado de los hitos.
Define lo que se queda fuera de la cadena: los documentos y archivos multimedia reales, detalles de identidad, políticas de control de acceso y registros operativos.

Privacy Boundaries and Data Handling (Límites de privacidad y manejo de datos)
Se enfoca en la minimización de datos personales, aclarando que la plataforma no busca ser un proveedor de identidad.
Solo almacena datos personales limitados bajo estándares de necesidad y proporcionalidad para facilitar el flujo inmobiliario real.
Mantiene los accesos restringidos según el rol y la unidad del usuario bajo un esquema de divulgación selectiva y permisos granulares.

Legal Registral Memo Purpose and Scope / Non-Substitution Statement (Propósito del memo legal registral / Declaración de no sustitución)
Aclara que la plataforma es un entorno de coordinación e integridad y no posee autoridad legal ni confiere estatus jurídico.
Explicita que no reemplaza a los registros públicos de propiedad, los procesos notariales o escrituras formales, las autorizaciones o inspecciones estatutarias gubernamentales, ni el asesoramiento legal contractual.
