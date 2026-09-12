# Compruébalo tú mismo

Las páginas de privacidad y seguridad de Lolly hacen afirmaciones: sin analíticas, sin rastreo, los archivos nunca salen del dispositivo, una sola cookie en todo el sistema. Esta página es distinta: no te pide que creas nada de eso. Es una lista de procedimientos, cada uno con el comando o la ruta de clics exactos y el resultado que verás. Cada afirmación aquí es refutable en minutos, la mayoría sin instalar nada.

Si algún control en esta página no produce el resultado mostrado, eso es un error o una promesa incumplida. [Repórtalo](#if-a-check-fails) de cualquier forma, y lo trataremos con la gravedad que merece una promesa incumplida.

## Míralo funcionar, en diez segundos

Antes de los procedimientos, la recompensa. Abre [`/verify`](/#/verify) y suelta un archivo sobre ella - sin subida, sin cuenta, sin esperar a un servidor. Aquí está comprobando la [tormenta de Queensland generada](/info/ai-stance.html) de nuestra página de postura sobre IA: una imagen de Gemini que Lolly abrió, redimensionó y exportó. Cada insignia de abajo se calculó en el dispositivo, a partir de los propios bytes del archivo.

![Verify en una pantalla de ancho de teléfono - la imagen de la tormenta, un veredicto verde Made with Lolly y las insignias de credencial intacta y bytes sin cambios apiladas debajo](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

El veredicto no es una sola insignia, sino un pequeño montón de ellas, cada una un hecho independiente:

- <!--i:lock--> **Made with Lolly** - la credencial está intacta *y* registra una exportación de Lolly.
- <!--i:seal--> **La credencial está intacta** - el manifiesto C2PA firmado se analiza correctamente y su propia firma de reclamación se verifica.
- <!--i:hash--> **Los bytes no han cambiado** - el hash del archivo sigue coincidiendo con lo que se firmó. Altera un píxel y esta insignia cambia.
- <!--i:sparkle--> **GEN AI** - una máquina creó estos píxeles, y el archivo lo indica. Lolly lee esa afirmación en lugar de ocultarla.

Y todo el historial viaja con el archivo. Aquí sobreviven nueve pasos - cinco que Google registró al generar y marcar con agua la imagen, luego cuatro que Lolly registró al abrir, marcar y convertir la copia en esta página - leídos directamente de los bytes, en tu dispositivo, y presentados como una cronología. Es la misma imagen, verificada de la misma manera, que la cronología C2PA en la [página de postura sobre IA](/info/ai-stance.html).

![El historial de cambios que Verify lee de la imagen de la tormenta - cinco pasos registrados por Google, luego cuatro por Lolly, terminando en el WebP de esta página](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Nada de eso es la afirmación de confianza, sin embargo, es la demo. El resto de esta página es la afirmación de confianza: cada insignia de arriba es reproducible, y aquí tienes cómo reproducir las garantías que hay detrás.

## En tu navegador, sin herramientas necesarias

**1. Observa la red.** Abre [lolly.tools](https://lolly.tools), abre las DevTools de tu navegador (F12), cambia a la pestaña **Network** y usa una herramienta - escribe una URL en [QR Code](/t/qr-code), cambia colores, exporta un PNG. Cada petición se queda en `lolly.tools`: el shell de la app, los archivos propios de la herramienta, los recursos del catálogo. Ningún host de analítica, ningún beacon de CDN, ningún servicio de fuentes, ningún endpoint de "reporte de errores". Lo que escribes en una herramienta no aparece en **ninguna petición** - el renderizado es local.

Las excepciones honestas - todas opcionales, iniciadas por el usuario y visibles en la misma pestaña Network cuando ocurren: añadir una **Google Font** en el editor de marca obtiene esa familia concreta desde Google, tras un diálogo de consentimiento que te lo dice exactamente, una vez, antes de la primera petición; hacer clic en un **preset de perfil ICC de imprenta** obtiene ese perfil del registro público del ICC en color.org; reproducir la **radio** integrada opcional transmite desde la emisora; introducir una ubicación en **Meeting Planner** consulta ese lugar en el servicio de geocodificación de open-meteo para obtener sus coordenadas y zona horaria, una vez por ciudad (las respuestas se guardan en tu dispositivo), y el campo lleva ese aviso justo donde escribes; y **URL Screenshot** necesariamente carga la URL que escribiste - es su función, y lo ves ocurrir. Una herramienta que declara una capacidad de red solo puede hacer peticiones a los hosts que su manifiesto permite explícitamente, y ese mecanismo falla en modo cerrado; ninguna herramienta publicada actualmente declara una, así que la Content-Security-Policy que aplica el navegador es el límite que realmente mantiene la lista de arriba dentro de sus hosts. La [política de privacidad](/info/privacy.html) mantiene la tabla canónica de todo esto; su regla vigente es que un contacto de red que no esté en esa tabla no ocurre.

**2. Desconecta.** Carga la app y abre una o dos herramientas, luego ponte sin conexión - modo avión, o DevTools → Network → Offline. Recarga. La galería y cada herramienta que hayas abierto siguen funcionando, incluidos el renderizado y la exportación en los formatos que hayas usado - los archivos de una herramienta y el codificador de un formato se cachean la primera vez que los usas, así que ejecuta una herramienta una vez en línea antes de probarla sin conexión. Esta es la comprobación más contundente de esta página: el software que llama a casa no sobrevive a que le corten el cable.

**3. Cuenta las cookies.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. La lista está vacía - la app no establece cookies. O pega `document.cookie` en la consola: obtienes `""`. (La única cookie de todo el sistema, `lolly_ca_state`, vive como máximo diez minutos durante un inicio de sesión de identidad opcional - se elimina en el momento en que se completa el inicio de sesión -, está limitada a `/api/ca` y es `HttpOnly`: la [política de privacidad](/info/privacy.html) la describe con precisión.)

**4. Lee tu propio almacenamiento.** El mismo panel Application: todo lo que Lolly guarda es inspeccionable delante de ti - un par de docenas de claves `localStorage` planas (tema, idioma, ancho de la barra lateral, ajustes de sonido y vista, más una copia cacheada del índice público del catálogo de herramientas), y tus propios documentos en IndexedDB. Cada valor es una cadena o JSON legible - nada está ofuscado, nada está codificado para dificultar su lectura. **Profile → Clear all my data** lo borra; lo mismo hace borrar los datos del sitio en el navegador, porque no hay ninguna copia del lado del servidor que sobreviva a eso.

**5. Comprueba que existe el contacto de divulgación.** [`/.well-known/security.txt`](/.well-known/security.txt) responde con un bloque de contacto [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), no una página HTML.

## Desde una terminal

**6. El endpoint de renderizado responde solo con datos públicos.** La única función del servidor que introduce entradas escritas por el usuario en una URL - los renderizados por enlace directo - está activa aquí, y la [política de privacidad](/info/privacy.html) indica qué significa eso para las entradas que pones en un enlace:

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

El interruptor es por despliegue (`LOLLY_DISABLE_RENDER_GET=1`): en una instancia que lo activa, la misma prueba devuelve `404` - esa diferencia es el indicador funcionando, no una incoherencia.

**7. La superficie del servidor es enumerable.** [Server Surface](/info/server-surface.html) enumera cada ruta del lado del servidor que existe, con la regla vigente de que un endpoint que no esté en esa página no forma parte de Lolly. Pruébalas con `curl`; no hay nada más que encontrar.

## En el código fuente

Todo lo anterior podría seguir siendo teatro si el código desplegado difiriera del código público. Así que revisa el código - el despliegue se construye a partir de [el repositorio público](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Ningún rastreador, ningún SDK de analítica, en ninguna parte.** Busca en el código que se publica - el engine, cada shell (incluida la extensión de navegador, las overrides del puente de Tauri y el service worker), las funciones del servidor y los packs de herramientas - los sospechosos habituales:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

**9. Ningún resolutor DNS de terceros.** La comprobación SEAL de Verify nunca enruta las búsquedas a través de un proveedor DNS-over-HTTPS - la app web simplemente no tiene resolutor:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. El servicio de certificados no retiene nada.** La CA de identidad no tiene registro de emisión - ni tu correo, ni una marca de tiempo, ni un webhook. La ausencia es verificable con grep:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

## Impuesto por pruebas, no por promesas

Las tres comprobaciones de código de arriba no son una auditoría puntual - están fijadas en la suite de pruebas, así que no pueden degradarse en silencio. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) hace fallar la build si:

- aparece cualquier SDK de analítica o rastreo en cualquier parte del código fuente publicado que analiza - app, engine, servidor, extensión y código de los packs de herramientas por igual,
- aparece cualquier resolutor DNS-over-HTTPS de terceros en ese código,
- reaparece el registro de emisión de la CA - en el código fuente **o** en el bundle generado del servidor,
- la política de privacidad pierde sus declaraciones legalmente requeridas (responsable nombrado, base legal, derecho a reclamar).

Ejecútalos tú mismo en la copia local (Node 22.18+; no hace falta `pnpm install` para este archivo):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

La suite completa (`pnpm install && pnpm test`) ejecuta varios miles más, incluidas las pruebas de criptografía adversarial descritas en [Seguridad y verificación](/info/security.html).

## Lo que no puedes verificar desde fuera - dicho sin rodeos

Una página como esta se gana la confianza nombrando sus propios límites:

- **Registros de acceso del hosting.** Cualquier servidor que responda a una petición puede registrarla - IP, ruta, marca de tiempo. No puedes verificar qué retiene o no retiene un host, y nosotros tampoco más allá del comportamiento documentado de nuestro proveedor. Precisamente por eso la arquitectura mantiene tu contenido completamente fuera de la red: lo que nunca sale de tu dispositivo, nadie puede registrarlo.
- **Que el despliegue ejecuta este código.** Puedes verificar que el código fuente está limpio y que el comportamiento desplegado coincide con él (las comprobaciones de arriba cubren ambos extremos), pero la certificación a nivel binario de un despliegue web no es algo que ofrezca la plataforma web. Las mitigaciones son el repositorio público, las pruebas impuestas y la comprobación sin conexión - un despliegue manipulado que llame a casa falla de inmediato en las comprobaciones 1 y 2.
- **Los hooks de herramientas no están aislados por defecto.** La lógica opcional de una herramienta se ejecuta revisada, en el propio realm de la página; toda herramienta en lolly.tools es de origen propio y se revisa antes de publicarse. El aislamiento por Worker ya se ofrece como opción por herramienta - una herramienta cuyo manifiesto establece `isolate: true` ejecuta sus hooks fuera del hilo principal - así que lo que no puedes verificar desde fuera se va reduciendo, pero la ruta por defecto sigue siendo en el mismo realm y la revisión sigue siendo el control. Esto se declara, no se oculta - ver la sección [design boundaries](/info/security.html), que siempre lo ha dicho así.

## Si una comprobación falla

Una discrepancia entre esta página y el comportamiento observado es un informe de seguridad, y de verdad preferimos saberlo: [fitzy+security@suse.com](mailto:fitzy+security@suse.com), el botón **Report a vulnerability** en cualquier [repositorio de lolly-tools](https://github.com/lolly-tools) o el contacto en [`/.well-known/security.txt`](/.well-known/security.txt). La divulgación coordinada y el crédito al informante son la política vigente - [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md) tiene los detalles.
