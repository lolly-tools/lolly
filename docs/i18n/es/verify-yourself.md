# Compruébalo tú mismo

Cada promesa de este sitio se puede comprobar sin una cuenta. La mayoría de las comprobaciones solo necesitan un navegador; las demás necesitan un terminal y una copia del código fuente. Si alguna de las comprobaciones siguientes no da el resultado mostrado, es un error o una promesa incumplida, y queremos saberlo: consulta [Si falla una comprobación](#if-a-check-fails).

Estas comprobaciones cubren Lolly por sí solo. Si tu organización opera Lolly Work, este añade inicio de sesión, contenido compartido, telemetría configurada y registros de auditoría; compruébalos con [Superficie del servidor](/info/server-surface.html) y la [sección sobre organizaciones de la política de privacidad](/info/privacy.html#organisation-services-with-lolly-work).

<!--i:eti-clock-->
## Míralo funcionar en diez segundos

Abre [`/verify`](/#/verify) y suelta un archivo en la página. No se sube nada, no hay cuenta ni espera por un servidor. Aquí comprueba la [tormenta de Queensland generada](/info/ai-stance.html) de Nuestra postura sobre la IA: una imagen generada por Gemini que Lolly abrió, marcó y convirtió. Cada insignia se calculó en el dispositivo, a partir de los propios bytes del archivo.

![Lolly Verify en una pantalla con el ancho de un teléfono: la imagen de la tormenta, un veredicto Made with Lolly en verde y las insignias de credencial intacta y bytes sin cambios apiladas debajo](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

El veredicto es un pequeño conjunto de insignias, cada una un hecho independiente:

- <!--i:lock--> **Made with Lolly**: la credencial está intacta *y* registra una exportación de Lolly.
- <!--i:seal--> **The credential is intact**: el manifiesto C2PA firmado se analiza correctamente y se verifica la firma de su propia declaración.
- <!--i:hash--> **The bytes have not changed**: el hash del archivo sigue coincidiendo con lo que se firmó. Altera un píxel y esta insignia cambia.
- <!--i:sparkle--> **GEN AI**: una máquina creó estos píxeles, y el archivo lo declara. Lolly lee esa declaración en lugar de ocultar el hecho.

Todo el historial viaja con el archivo. Aquí se conservan nueve pasos: cinco que Google registró al generar la imagen y añadirle una marca de agua, y después cuatro que Lolly registró al abrir, marcar y convertir la copia de esta página. Lolly Verify los lee directamente de los bytes y los dibuja como una línea de tiempo.

![El historial de cambios que Lolly Verify lee de la imagen de la tormenta: cinco pasos registrados por Google, después cuatro por Lolly, hasta llegar al WebP de esta página](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Las comprobaciones siguientes son las garantías que sustentan esa demostración, y cada una es reproducible. [Content Credentials](/info/content-credentials-identity.html) explica cada veredicto.

<!--i:eti-globe-->
## En tu navegador, sin herramientas adicionales

::: timeline
- <!--i:globe--> **1. Observa la red.** Abre [lolly.tools](https://lolly.tools), abre DevTools de tu navegador (F12), cambia a **Network** y usa una herramienta: escribe una dirección web en [Lolly QR Code](/t/qr-code), cambia colores, exporta un PNG. Cada solicitud va a `lolly.tools`: la shell de la aplicación, los archivos de la propia herramienta y los recursos del catálogo. No hay ningún host de analítica, baliza de CDN, servicio de fuentes ni endpoint de informes de errores. Lo que escribes en una herramienta no aparece en **ninguna solicitud**, porque el renderizado es local.
- <!--i:eyeoff--> **2. Desconecta la red.** Carga la aplicación y abre una o dos herramientas, después desconéctate (modo avión, o DevTools → Network → Offline) y recarga. La galería y todas las herramientas que abriste siguen funcionando, incluidos el renderizado y la exportación en los formatos que usaste. Los archivos de una herramienta y el codificador de un formato se guardan en caché la primera vez que los usas, así que usa una herramienta una vez con conexión antes de probarla sin conexión. Esta es la comprobación individual más contundente de esta página: el software que se comunica con su servidor no sobrevive si le cortas la conexión.
- <!--i:check--> **3. Cuenta las cookies.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. La lista está vacía: la aplicación no establece cookies. Pega `document.cookie` en la consola y obtendrás `""`. La inscripción opcional en la CA establece una cookie `HttpOnly` de corta duración, `lolly_ca_state`, limitada a `/api/ca`, que `document.cookie` no puede mostrar. Una instancia de Lolly Work usa sus propias cookies de inicio de sesión; compáralas con [Privacidad](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Lee tu propio almacenamiento.** En el mismo panel, tienes delante todo lo que Lolly conserva: un par de docenas de claves de `localStorage` sin cifrar (tema, idioma, ancho de la barra lateral, ajustes de sonido y vista y una copia en caché del índice público del catálogo de herramientas) y tus propios documentos en IndexedDB. Cada valor es una cadena legible o JSON, sin nada ofuscado. Borrar los datos del sitio elimina estos registros locales, pero no una copia de seguridad de Sync ni los registros almacenados por una instancia de Lolly Work. **Settings → Storage → Clear all my data** hace lo mismo desde la aplicación, y puedes ver cómo se vacían los almacenes y las cachés.
- <!--i:lock--> **5. Comprueba que existe el contacto para comunicar vulnerabilidades.** [`/.well-known/security.txt`](/.well-known/security.txt) responde con un bloque de contacto [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), no con una página HTML.
:::

::: details Qué más puedes ver en la pestaña Network
Algunas funciones solo acceden a la red cuando las usas, y cada una se ve en la misma pestaña:

- añadir una **Google Font** en Lolly Design System Setup obtiene esa única familia de Google, tras un diálogo de consentimiento que lo indica y se muestra una vez, antes de la primera descarga;
- hacer clic en un **ajuste preestablecido de perfil de imprenta ICC** obtiene ese perfil del registro público de ICC en color.org;
- reproducir la **radio** opcional integrada transmite el audio desde la emisora;
- introducir una ubicación en **Meeting Planner** busca ese lugar en el servicio de geocodificación de open-meteo para obtener sus coordenadas y zona horaria, una vez por ciudad (las respuestas se guardan en tu dispositivo), y el campo lo indica donde escribes;
- **Lolly URL Screenshot** carga la dirección que escribiste, y puedes verlo.

Una herramienta que declara una capacidad de red solo puede obtener datos de los hosts que su manifiesto permite explícitamente, y esa comprobación deniega el acceso si falla. Ninguna herramienta distribuida actualmente declara una, así que la Content-Security-Policy que aplica el navegador limita la lista anterior a sus hosts. La [política de privacidad](/info/privacy.html) tiene la tabla canónica de todos ellos, incluido el tráfico de instancias gestionadas, como las actualizaciones de políticas y los informes habilitados.
:::

<!--i:eti-code-->
## Desde un terminal

**6. El endpoint de renderizado responde solo con datos públicos.** La única función del servidor que pone las entradas escritas en una URL, los renderizados mediante enlace directo, está activa aquí. La [política de privacidad](/info/privacy.html) explica qué significa eso para las entradas que incluyes en un enlace.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Cada despliegue elige (`LOLLY_DISABLE_RENDER_GET=1`): en una instancia que establece la variable, la misma prueba devuelve `404`. Esa diferencia indica que el ajuste funciona, no una incoherencia.

**7. Comprueba los servicios que habilita tu despliegue.** [Superficie del servidor](/info/server-surface.html) enumera los servicios opcionales y enlaza sus referencias detalladas. Para Lolly Work, incluye sus API autenticadas, la conexión de colaboración, el almacenamiento y los proveedores configurados. Una prueba del sitio público lolly.tools no comprueba una instancia privada de una organización.

Si operas tu propia instancia, [Despliegue de la entrega](/info/deploy-delivery.html) contiene las comprobaciones de publicación: integridad del modelo, la prueba en el borde y su lista de muestras, las versiones para visualización, la pasarela de descarga privada y el catálogo firmado en un navegador.


<!--i:eti-search-->
## En el código fuente

Todo lo anterior aún podría ser una fachada si el código desplegado fuera distinto del código público. Así que comprueba el código. El despliegue se compila a partir del [repositorio público](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Ningún rastreador ni SDK de analítica, en ninguna parte.** Busca los sospechosos habituales en el código que se distribuye (el motor, todas las shells incluida la extensión del navegador, las implementaciones que sustituyen las del puente de Tauri y el service worker, las funciones del servidor y los paquetes de herramientas):

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Este análisis busca SDK de seguimiento de terceros. No demuestra la ausencia de informes de uso propios: Lolly Work admite telemetría de la organización y un registro de auditoría separado, con sus propias políticas y pruebas.

**9. Ningún resolvedor DNS de terceros.** La comprobación SEAL de Lolly Verify nunca envía una consulta a través de un proveedor de DNS-over-HTTPS, porque la aplicación no tiene resolvedor:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. El servicio de certificados no conserva un registro de emisiones.** La CA de identidad no conserva un registro de lo que emitió ni un inventario de identidades: ni una línea en stdout, ni un webhook, ni un almacén de certificados. Esa ausencia se puede comprobar mediante una búsqueda:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

La CA sí conserva un estado de trabajo de corta duración: los contenedores de limitación de solicitudes almacenan claves de IP y correo electrónico con hash durante su intervalo, y el almacén de admisión de un despliegue gestionado conserva un identificador basado en clave y un resumen criptográfico de la solicitud durante un máximo de diez minutos. [Ingeniería de Content Credentials](/info/content-credentials-engineering.html#protocol) contiene los detalles.

<!--i:eti-flask-->
## Garantizado por pruebas

Las comprobaciones del código fuente anteriores no son una auditoría puntual: están fijadas en la batería de pruebas, así que no pueden deteriorarse sin que se note. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) comprueba una lista de nombres de rastreadores más larga que el análisis anterior y hace fallar la compilación si:

- aparece algún SDK de analítica o seguimiento en cualquier parte del código fuente distribuido que analiza, incluido el código de la aplicación, el motor, el servidor, la extensión y los paquetes de herramientas;
- aparece algún resolvedor de DNS-over-HTTPS de terceros en ese código fuente;
- reaparece el registro de emisiones de la CA, en el código fuente **o** en el paquete generado del servidor;
- la política de privacidad pierde sus declaraciones exigidas por ley (responsable identificado, base jurídica, derecho a presentar una reclamación).

Ejecútalas tú mismo en el clon (Node 22.18 o posterior; este archivo no necesita `pnpm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

La batería completa (`pnpm install && pnpm test`) ejecuta varios miles más, incluidas las pruebas adversariales de criptografía descritas en [Seguridad & verificación](/info/security.html).

<!--i:eti-eye-off-->
## Lo que no puedes verificar desde fuera

- **Registros de acceso del alojamiento.** Cualquier servidor puede registrar las solicitudes que responde: dirección IP, ruta y hora. Una prueba externa no puede determinar cuánto tiempo se conservan los registros. El operador controla el registro, la rotación y las exportaciones, y debe dar a conocer esas decisiones. El renderizado local mantiene las ediciones ordinarias en tu dispositivo; el renderizado opcional en servidor y los servicios de espacio de trabajo compartido tienen los flujos de datos separados que describe la política de privacidad.
- **Que el despliegue ejecuta este código.** Puedes comprobar que el código fuente está limpio y que el comportamiento desplegado coincide con él, y las comprobaciones anteriores hacen ambas cosas. La plataforma web no ofrece certificación a nivel binario de un despliegue web. Las medidas de mitigación son el repositorio público, las pruebas obligatorias y la comprobación sin conexión: un despliegue manipulado que se comunica con su servidor falla a la vez las comprobaciones 1 y 2.
- **Hooks de herramientas.** La lógica opcional de una herramienta integrada se revisa en lugar de aislarse en un entorno restringido: se ejecuta en la página salvo que la herramienta opte por un Worker. Todas las herramientas de lolly.tools son propias y se revisan antes de distribuirse. El [Modelo de amenazas](/info/threat-model.html#trust-boundaries) detalla dónde se ejecutan los hooks y qué los limita.

<!--i:eti-warning-->
## Si falla una comprobación

Una diferencia entre esta página y lo que observas constituye un informe de seguridad. Envíalo por los canales privados de [Seguridad & verificación](/info/security.html#reporting-a-vulnerability). Practicamos la divulgación coordinada y reconocemos a quienes informan.
