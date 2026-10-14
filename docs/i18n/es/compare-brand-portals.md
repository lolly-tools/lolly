# Lolly y los portales de marca

_Última revisión: 28 de septiembre de 2026._

Lolly y [lolly.work](https://lolly.work) cubren juntos los flujos de creación y gobernanza para los que los equipos usan portales de marca: activos aprobados, plantillas bloqueadas, control de acceso, revisión y distribución. Compara esa solución combinada con Bynder, Frontify, Marq o Brandfolder al decidir cómo encuentran las personas los activos de marca y cómo crean otros nuevos.

## Creación y servicios de organización

El motor y las apps de Lolly generan los archivos. Las plantillas, los tokens de diseño y las entradas permitidas definen qué puede cambiar una persona, y el renderizado puede permanecer en su dispositivo. Lolly independiente no requiere cuenta.

lolly.work es el servicio de organización del mismo proyecto, se mantiene en un [repositorio aparte](https://github.com/lolly-tools/lolly-work) y se despliega junto con Lolly. Añade identidad, almacenamiento compartido, políticas, aprobaciones e informes. Ambas partes son de código abierto bajo MPL-2.0. Esta separación permite que una persona use Lolly por su cuenta y que una organización ejecute la solución combinada en una infraestructura que controla.

## Qué ofrece la solución combinada

| Necesidad | Lolly + lolly.work |
|---|---|
| Inicio de sesión y aprovisionamiento | Inicio de sesión único OIDC, varios proveedores de identidad, aprovisionamiento de usuarios y pertenencia a grupos con SCIM 2.0, y desactivación de cuentas que revoca las sesiones existentes. Un proveedor de identidad solo SAML puede conectarse mediante un puente OIDC como Keycloak. |
| Plantillas aprobadas | Lolly define las entradas editables de la plantilla; lolly.work aplica visibilidad por grupos y políticas de entrada que bloquean valores, restringen opciones u ocultan controles. |
| Biblioteca de activos compartida | Cargas propias de la instancia, colecciones, metadatos personalizados y catálogos con acceso controlado, además de conectores que leen bibliotecas DAM y de almacenamiento existentes. |
| Revisión | Pasos de aprobación ordenados, grupos de aprobadores elegibles, reglas de quórum y separación de funciones; la revisión puede regir los envíos al catálogo y la entrega a destinos de la organización. |
| Historial y disponibilidad de activos | Versiones y reversión para los activos propios de la instancia, retención y bloqueos, disponibilidad programada, caducidad y revocación. Los proveedores conectados conservan su propio historial de origen. |
| Informes | Recuentos de uso y descarga de activos, actividad de herramientas y exportaciones, paneles y un registro de auditoría. La atribución del uso sigue la política de telemetría del despliegue; la configuración de atribución predeterminada requiere consentimiento. |
| Distribución | Enlaces que caducan y pueden revocarse, colecciones compartidas, acceso de invitados y entrega a destinos configurados de la organización. |

Las [guías de operación de lolly.work](https://github.com/lolly-tools/lolly-work/tree/main/docs) describen estas funciones y su configuración. Son capacidades disponibles, no funciones que obliguen a construir otro sistema alrededor de Lolly.

## Elegir un flujo de portal

Los portales consolidados ofrecen alojamiento gestionado, soporte y amplios flujos de trabajo DAM. Por ejemplo, el [DAM empresarial de Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) combina búsqueda de activos, controles de acceso, flujos de aprobación y distribución. Compara el flujo exacto de revisión y derechos que necesitas: Lolly ofrece metadatos y controles de acceso y disponibilidad, mientras que la autorización legal y las obligaciones de licencia siguen requiriendo el proceso de la organización. Sus cadenas de aprobación son secuenciales; no modelan flujos de trabajo con ramificaciones arbitrarias.

La pila de Lolly es más joven, y la [página de estado de lolly.work](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) recoge sus límites de despliegue. En particular, el sitio público lolly.work es un entorno de evaluación. Un despliegue duradero en una organización necesita almacenamiento persistente y un operador. El autoalojamiento no tiene cargo de licencia de software por usuario; la infraestructura y la administración siguen costando dinero.

Un DAM existente también puede seguir siendo la fuente de verdad. Los conectores de catálogo de lolly.work ponen sus activos aprobados a disposición en Lolly, donde las personas crean archivos nuevos bajo las reglas de la organización. Es una decisión de integración; la biblioteca y las aprobaciones propias de Lolly están disponibles cuando la organización quiere gestionar por sí misma esos flujos de trabajo.

Consulta [Cómo se compara Lolly](/info/positioning.html) para la comparación de capacidades y [Lolly comparado, herramienta por herramienta](/info/compare.html) para el resto de este conjunto. Los nombres de los proveedores identifican los productos comparados; Lolly no está afiliada a ellos.
