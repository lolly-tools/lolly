# Lolly y los portales de marca

_Última revisión: 28 de septiembre de 2026._

Si tu organización guarda sus recursos aprobados en Bynder, Frontify, Marq o Brandfolder, esta página lo compara con Lolly más Lolly Work: cómo encuentra la gente los recursos de marca y cómo crea archivos nuevos a partir de ellos.

## Lo que un portal consolidado hace mejor

Los portales consolidados ofrecen alojamiento gestionado, soporte y amplios flujos de gestión de recursos. Por ejemplo, el [DAM empresarial de Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) combina descubrimiento de recursos, controles de acceso, flujos de aprobación y distribución. La pila de Lolly es más joven y sus cadenas de aprobación son secuenciales, no flujos arbitrarios con ramificaciones. [Work status and roadmap](/info/work-status.html) recoge sus límites de despliegue.

## Dónde coinciden

Ambos cubren recursos aprobados, plantillas bloqueadas, control de acceso, revisión y distribución. Lolly crea los archivos: las plantillas, los design tokens y las entradas permitidas definen lo que alguien puede cambiar, y el renderizado puede quedarse en su dispositivo. Lolly Work añade identidad, almacenamiento compartido, políticas, aprobaciones e informes en una infraestructura que controla la organización.

![El design system activo en Settings, mostrado como portada y páginas: los colores, la tipografía y los logotipos con los que dibuja cada herramienta](/info/shots/dashboard-brand.svg)

## Lo que aportan Lolly y Lolly Work

| Necesidad | Lolly + Lolly Work |
|---|---|
| Inicio de sesión y aprovisionamiento | Inicio de sesión único OIDC, varios proveedores de identidad, aprovisionamiento de usuarios SCIM 2.0 y pertenencia a grupos, y desactivación de cuentas que revoca las sesiones existentes. Un proveedor de identidad solo SAML puede conectarse mediante un puente OIDC como Keycloak. |
| Plantillas aprobadas | Lolly define las entradas editables de la plantilla; Lolly Work aplica visibilidad por grupos y políticas de entradas que bloquean valores, restringen opciones u ocultan controles. |
| Biblioteca de recursos compartida | Subidas propias de la instancia, colecciones, metadatos personalizados y catálogos con control de acceso, además de conectores que leen bibliotecas DAM y de almacenamiento existentes. |
| Revisión | Pasos de aprobación ordenados, grupos de aprobadores elegibles, reglas de quórum y separación de funciones; la revisión puede gobernar los envíos al catálogo y la entrega a destinos de la organización. |
| Historial y disponibilidad de recursos | Versiones y reversión para los recursos propios de la instancia, conservación y retenciones, disponibilidad programada, caducidad y revocación. Los proveedores conectados conservan su propio historial de origen. |
| Licencias y créditos | Lolly registra la licencia de cada fuente que usa un archivo y prepara los créditos que debe; [Creative rights and credits](/info/creative-rights.html) explica qué registra y dónde se escriben los créditos. No libera derechos. |
| Informes | Recuentos de uso y descarga de recursos, actividad de herramientas y exportación, paneles y un rastro de auditoría. La atribución del uso sigue la política de telemetría del despliegue; el ajuste de atribución predeterminado exige consentimiento. |
| Distribución | Enlaces con caducidad y revocables, colecciones compartidas, acceso de invitados y entrega a destinos configurados de la organización. |

[Catalog and content](/info/work-catalog.html), [Approvals](/info/work-approvals.html) y [Policy and governance](/info/work-governance.html) describen estas funciones y su configuración.

## Conservar tu portal actual

Un DAM existente puede seguir siendo la fuente de verdad. Los conectores de catálogo de Lolly Work hacen disponibles sus recursos aprobados en Lolly, donde la gente crea archivos nuevos bajo las reglas de la organización. Es una elección de integración; la biblioteca y las aprobaciones propias de Lolly están ahí cuando la organización quiere operarlas ella misma. [What runs where](/info/compare.html#what-runs-where) enumera los límites que comparten todas las comparaciones.

Consulta [How Lolly compares](/info/positioning.html) para la comparativa de capacidades. Los nombres de proveedores identifican los productos que se comparan; Lolly no está afiliado a ellos.
