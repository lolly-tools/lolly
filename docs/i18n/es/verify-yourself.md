# Compruébalo tú mismo

Cada promesa de este sitio se puede comprobar, sin cuenta. La mayoría de las comprobaciones solo necesitan un navegador; el resto necesitan una terminal y una copia del código fuente. Si una comprobación de abajo no da el resultado mostrado, es un error o una promesa rota, y queremos saberlo: consulta [If a check fails](#if-a-check-fails).

Empieza por la más rápida: suelta un archivo en Verify. Luego ve más lejos: observa la red mientras usas una herramienta, desenchufa y sigue trabajando, cuenta las cookies y lee el código fuente.

Estas comprobaciones cubren Lolly por sí solo. Si tu organización opera Lolly Work, esta añade inicio de sesión, contenido compartido, telemetría configurada y registros de auditoría; compruébalos con [Server Surface](/info/server-surface.html) y la [sección de organización de la política de privacidad](/info/privacy.html#organisation-services-with-lolly-work).

## Míralo funcionar, en diez segundos

Abre [`/verify`](/#/verify) y suelta un archivo en la página. No hay subida, ni cuenta, ni espera a un servidor. Aquí comprueba la [tormenta de Queensland generada](/info/ai-stance.html) de Our AI Stance: una imagen que generó Gemini, que Lolly abrió, marcó y convirtió. Cada insignia se calculó en el dispositivo, a partir de los bytes del propio archivo.

![Verify en una pantalla de ancho de teléfono - la imagen de la tormenta, un veredicto verde Made with Lolly y las insignias de credencial intacta y bytes sin cambios apiladas debajo](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

El veredicto es un pequeño montón de insignias, cada una un hecho independiente:

- <!--i:lock--> **Made with Lolly**: la credencial está intacta *y* registra una exportación de Lolly.
- <!--i:seal--> **The credential is intact**: el manifiesto C2PA firmado se analiza y su propia firma de declaración se verifica.
- <!--i:hash--> **The bytes have not changed**: el hash del archivo sigue coincidiendo con lo que se firmó. Altera un píxel y esta insignia cambia.
- <!--i:sparkle--> **GEN AI**: una máquina creó estos píxeles, y el archivo lo dice. Lolly lee esa declaración en lugar de ocultar el hecho.

Toda la historia viaja con el archivo. Aquí sobreviven nueve pasos: cinco que Google registró al generar y marcar con agua la imagen, y luego cuatro que Lolly registró al abrir, marcar y convertir la copia de esta página. Verify los lee directamente de los bytes y los dibuja como una línea de tiempo.

![El historial de cambios que Verify lee de la imagen de la tormenta - cinco pasos registrados por Google, luego cuatro por Lolly, terminando en el WebP de esta página](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Esa es la demostración. Las comprobaciones de abajo son las garantías que hay debajo, y cada una es reproducible. [Content Credentials](/info/content-credentials-identity.html) explica cada veredicto.

## En tu navegador, sin herramientas necesarias

::: timeline
- <!--i:globe--> **1. Observa la red.** Abre [lolly.tools](https://lolly.tools), abre las DevTools de tu navegador (F12), cambia a **Network** y usa una herramienta: escribe una dirección web en [QR Code](/t/qr-code), cambia colores, exporta un PNG. Cada solicitud se queda en `lolly.tools`: el shell de la aplicación, los archivos propios de la herramienta y los recursos del catálogo. No hay ningún host de analítica, ninguna baliza de CDN, ningún servicio de fuentes ni ningún endpoint de informes de errores. Lo que escribes en una herramienta no aparece en **ninguna solicitud**, porque el renderizado es local.
- <!--i:eyeoff--> **2. Desenchufa.** Carga la aplicación y abre una herramienta o dos, luego pasa a sin conexión (modo avión, o DevTools → Network → Offline) y recarga. La galería y todas las herramientas que abriste siguen funcionando, incluidos el renderizado y la exportación en los formatos que usaste. Los archivos de una herramienta y el codificador de un formato se guardan en caché la primera vez que los usas, así que usa una herramienta una vez con conexión antes de probarla sin ella. Esta es la comprobación individual más sólida de esta página: el software que llama a casa no sobrevive a que le corten el cable.
- <!--i:check--> **3. Cuenta las cookies.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. La lista está vacía: la aplicación no instala cookies. Pega `document.cookie` en la consola y obtienes `""`. El registro opcional de la CA establece una cookie `HttpOnly` de corta duración, `lolly_ca_state`, limitada a `/api/ca`, que `document.cookie` no puede mostrar. Una instancia de Lolly Work usa sus propias cookies de inicio de sesión; compárlas con [Privacy](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Lee tu propio almacenamiento.** En el mismo panel, todo lo que guarda Lolly está delante de ti: un par de docenas de claves simples de `localStorage` (tema, idioma, ancho de la barra lateral, ajustes de sonido y de vista, y una copia en caché del índice público del catálogo de herramientas) y tus propios documentos en IndexedDB. Cada valor es una cadena legible o JSON, sin nada ofuscado. Borrar los datos del sitio elimina estos registros locales, pero no una copia de seguridad de Sync ni los registros que guarda una instancia de Lolly Work. **Settings → Storage → Clear all my data** hace lo mismo desde dentro de la aplicación, y puedes ver cómo se vacían los almacenes y las cachés.
- <!--i:lock--> **5. Comprueba que existe el contacto de divulgación.** [`/.well-known/security.txt`](/.well-known/security.txt) responde con un bloque de contacto [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), no con una página HTML.
:::

::: details Qué más puedes ver en la pestaña Network
Algunas funciones llegan a la red solo cuando las usas, y cada una es visible en la misma pestaña:

- añadir una **Google Font** en Design System Setup descarga esa única familia de Google, tras un diálogo de consentimiento que lo dice, una vez, antes de la primera descarga;
- hacer clic en un **preajuste de perfil de impresión ICC** descarga ese perfil del registro público del ICC en color.org;
- reproducir la **radio** integrada opcional transmite desde la emisora;
- introducir una ubicación en **Meeting Planner** busca ese lugar en el servicio de geocodificación de open-meteo para obtener sus coordenadas y zona horaria, una vez por ciudad (las respuestas se guardan en tu dispositivo), y el campo lo dice donde escribes;
- **URL Screenshot** carga la dirección que escribiste, porque ese es su trabajo, y ves cómo ocurre.

Una herramienta que declara una capacidad de red solo puede descargar de los hosts que permite la lista de su manifiesto, y esa comprobación falla de forma segura. Ninguna herramienta distribuida hoy declara una, así que la Content-Security-Policy aplicada por el navegador es lo que mantiene la lista de arriba en sus hosts. La [política de privacidad](/info/privacy.html) guarda la tabla canónica de todos ellos, incluido el tráfico de instancias gestionadas como las actualizaciones de políticas y los informes activados.
:::

## Desde una terminal

**6. El endpoint de renderizado responde solo con datos públicos.** La única función de servidor que pone entradas escritas en una URL, los renderizados enlazados desde otros sitios, está activa aquí. La [política de privacidad](/info/privacy.html) dice qué significa eso para las entradas que pones en un enlace.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Cada despliegue lo decide (`LOLLY_DISABLE_RENDER_GET=1`): en una instancia que lo define, la misma sonda devuelve `404`. Esa diferencia es el ajuste funcionando, no una incoherencia.

**7. Comprueba los servicios que activa tu despliegue.** [Server Surface](/info/server-surface.html) enumera los servicios opcionales y enlaza sus referencias detalladas. Para Lolly Work, incluye sus API autenticadas, la conexión de colaboración, el almacenamiento y los proveedores configurados. Una sonda al lolly.tools público no prueba una instancia privada de una organización.

Si operas tu propia instancia, [Delivery deployment](/info/deploy-delivery.html) tiene las comprobaciones de versión para ella: integridad de los modelos, la sonda de borde y su lista de muestras, las versiones de visualización, la pasarela privada de descargas y el catálogo firmado en un navegador.


## En el código fuente

Todo lo anterior seguiría pudiendo ser teatro si el código desplegado difiriera del código público. Así que comprueba el código. El despliegue se compila desde [el repositorio público](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Sin rastreadores ni SDK de analítica, en ninguna parte.** Busca en el código que se distribuye (el motor, cada shell incluida la extensión de navegador, las sobrescrituras del puente de Tauri y el service worker, las funciones de servidor y los paquetes de herramientas) a los sospechosos habituales:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Este escaneo busca SDK de seguimiento de terceros. No demuestra la ausencia de informes de uso propios: Lolly Work admite telemetría de organización y un registro de auditoría aparte, con su propia política y pruebas.

**9. Sin resolvedor DNS de terceros.** La comprobación SEAL de Verify nunca envía una consulta por un proveedor de DNS sobre HTTPS, porque la aplicación no tiene resolvedor:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. El servicio de certificados no guarda registro de emisiones.** La CA de identidad no guarda registro de lo que emitió ni inventario de identidades: ni línea en stdout, ni webhook, ni almacén de certificados. La ausencia se puede buscar:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

La CA sí guarda estado de trabajo de corta duración: los buckets de límite de frecuencia guardan claves de IP y correo con hash durante su ventana, y el almacén de admisión de un despliegue gestionado guarda un identificador con clave y un resumen de la solicitud durante como máximo diez minutos. [Content Credentials engineering](/info/content-credentials-engineering.html#protocol) tiene el detalle.

## Aplicado por pruebas

Las comprobaciones de código fuente de arriba no son una auditoría puntual: están fijadas en la batería de pruebas, así que no pueden pudrirse en silencio. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) comprueba una lista de nombres de rastreadores más larga que el escaneo de arriba y hace fallar la compilación si:

- aparece cualquier SDK de analítica o seguimiento en cualquier parte del código distribuido que escanea, en el código de la aplicación, el motor, el servidor, la extensión y los paquetes de herramientas;
- aparece cualquier resolvedor DNS sobre HTTPS de terceros en ese código;
- vuelve el registro de emisiones de la CA, en el código fuente **o** en el paquete de servidor generado;
- la política de privacidad pierde sus declaraciones exigidas legalmente (responsable del tratamiento nombrado, base jurídica, derecho a reclamar).

Ejecútalas tú mismo en el clon (Node 22.18 o posterior; este archivo no necesita `pnpm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

La suite completa (`pnpm install && pnpm test`) ejecuta varios miles más, incluidas las pruebas de criptografía adversarial descritas en [Seguridad y verificación](/info/security.html).

## Lo que no puedes verificar desde fuera

- **Registros de acceso del alojamiento.** Cualquier servidor que responde a una solicitud puede registrarla: dirección IP, ruta y hora. Una sonda externa no puede establecer cuánto tiempo se conservan los registros. El operador controla el registro, la rotación y las exportaciones, y debe divulgar esas decisiones. El renderizado local mantiene las ediciones normales en tu dispositivo; el renderizado de servidor opcional y los servicios de espacio de trabajo compartido tienen los flujos de datos separados que describe la política de privacidad.
- **Que el despliegue ejecuta este código.** Puedes comprobar que el código fuente está limpio y que el comportamiento desplegado coincide con él, y las comprobaciones de arriba hacen ambas cosas. La atestación a nivel binario de un despliegue web no es algo que ofrezca la plataforma web. Las mitigaciones son el repositorio público, las pruebas impuestas y la comprobación sin conexión: un despliegue manipulado que llame a casa falla a la vez las comprobaciones 1 y 2.
- **Hooks de herramientas.** La lógica opcional de una herramienta integrada se revisa y no se aísla en un sandbox: se ejecuta en la página a menos que la herramienta opte por un Worker. Todas las herramientas de lolly.tools son propias y se revisan antes de distribuirse. El [Threat Model](/info/threat-model.html#trust-boundaries) expone dónde se ejecutan los hooks y qué los limita.

## Si una comprobación falla

Una diferencia entre esta página y lo que observas es un informe de seguridad. Envíalo por los canales privados de [Security & Verification](/info/security.html#reporting-a-vulnerability). Practicamos la divulgación coordinada y reconocemos a quienes informan.
