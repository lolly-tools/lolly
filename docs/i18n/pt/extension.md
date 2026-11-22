# Extensão do navegador

Uma página web não pode ler os pixels de outro site. Em um navegador baseado em Chromium (Chrome, Edge, Brave, Arc ou Opera, a partir do Chrome 111), a extensão gratuita **Lolly URL Screenshot** permite que o app web do Lolly capture uma página com o mesmo mecanismo de captura do app para desktop. Com a extensão instalada:

- **[Lolly URL Screenshot](/t/url-shot)** salva a página que você compôs como arquivo;
- um endereço web colado em um campo de imagem pode virar uma captura dessa página, com **Screenshot this page**;
- a fonte **Website** no [Lolly Design System Setup](/info/brand-studio.html) pode ler uma página para iniciar um sistema de design.

Você aprova cada solicitação, e o app para desktop faz os mesmos trabalhos sem a extensão.

<!--i:eti-checklist-->
## Antes de instalar

Sem a extensão, o **Lolly URL Screenshot** ainda abre e você pode compor uma captura. Uma nota no topo dos controles da ferramenta diz o que falta.

![A nota da ferramenta URL Screenshot oferecendo a extensão, exibida quando a captura para arquivo não tem um host onde executar](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Todos os controles funcionam sem a extensão: a URL de destino, a profundidade de rolagem, o tempo de espera para estabilização, as margens de recorte e a mudança de cores. Só a captura precisa da extensão.

![Os controles do Lolly URL Screenshot com URL de destino, profundidade de rolagem, tempo de espera para estabilização e margens de recorte, todos utilizáveis antes de instalar a extensão](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

<!--i:eti-download-->
## Instalar

**Pela Chrome Web Store:** em breve. Depois de publicada, a extensão é instalada com um clique.

**Carregue você mesmo (desenvolvedores).** O código-fonte da extensão está no repositório em `shells/chrome-extension/`. A etapa de empacotamento gera o pacote de produção a partir dessa pasta. Esse pacote funciona apenas com o Lolly em `https://lolly.tools`.

1. Execute `pnpm run pack:chrome-extension`. Isso gera o pacote em `dist/chrome-extension/`.
2. Abra `chrome://extensions`.
3. Ative o **Developer mode** (canto superior direito).
4. Clique em **Load unpacked** e escolha a pasta `dist/chrome-extension/`.
5. Recarregue a aba do Lolly. O Lolly detecta a extensão quando a página carrega, e o aviso "Get the extension" desaparece. O **Lolly URL Screenshot** (em Utilities) pode então salvar capturas em um arquivo e funciona no modo Lolly Batch.

::: details Para um servidor local de desenvolvimento ou a pasta de código-fonte
Para um servidor local de desenvolvimento, execute `pnpm run pack:chrome-extension:dev` e carregue `dist/chrome-extension-dev` no lugar. Esse pacote também aceita `http://localhost:5173` e tem **Development** no nome.

Carregar a própria pasta `shells/chrome-extension/` também funciona para capturas PNG. Essa pasta não tem o mecanismo que percorre a página, incluído na etapa de empacotamento. Um SVG dessa pasta contém uma captura de tela, não formas.
:::

<!--i:eti-user-check-->
## O que acontece quando o Lolly solicita

![A aba do Lolly solicita uma página e você pressiona Approve once na janela de aprovação da extensão. Uma aba em segundo plano abre, lê a página e fecha. Então a aba do Lolly recebe o resultado.](/info/diagrams/concepts/extension-request.svg)

1. **O Lolly solicita.** Um pequeno script informa ao Lolly que a extensão está presente, então uma captura ou leitura de página pode começar sem configuração adicional.
2. **Você aprova.** A extensão abre sua própria janela **Approve page request**. Ela mostra o site solicitante, se ele quer uma captura de tela ou o conteúdo da página e o endereço da página. Nada é lido até você pressionar **Approve once**. **Cancel**, ou fechar a janela, encerra a solicitação.
3. **O Chrome pergunta uma vez por site.** Na primeira vez que você aprova uma solicitação para um site, o Chrome também pergunta se a extensão pode acessar esse site. O Chrome mantém esse acesso depois que você o permite, mas cada solicitação posterior ainda precisa de sua própria aprovação com **Approve once**.
4. **A página é lida em uma aba em segundo plano.** A extensão abre a página de destino em uma aba em segundo plano, captura pelo DevTools Protocol (o mesmo `Page.captureScreenshot` que o app para desktop usa), fecha a aba e devolve o resultado à aba do Lolly que o solicitou.

::: details Como funciona uma captura SVG
Para um **SVG**, a extensão percorre a página em vez de tirar uma foto da tela. Um script incluído na extensão lê o layout da página na aba em segundo plano e transforma a página em formas e texto convertido em contornos. O arquivo continua nítido em qualquer tamanho e cada parte continua editável. As imagens na página continuam como imagens. Tudo o que a página desenha com um canvas, um vídeo ou um efeito que o SVG não consegue representar é copiado de uma captura de tela do mesmo instante. O Lolly compara o resultado com essa captura. Quando os dois diferem demais, o SVG contém a captura de tela no lugar.

Para converter o texto em contornos na própria fonte da página, a extensão entrega ao Lolly os arquivos de fonte que a página carregou. O Chrome não mantém os bytes de uma fonte onde uma extensão possa lê-los, então a extensão solicita cada fonte à página de novo. Seu navegador costuma responder a partir do cache, e a política de segurança da própria página continua se aplicando a essa solicitação.
:::

Uma aprovação cobre uma solicitação e expira após 30 segundos. Só uma solicitação pode esperar ou executar por vez, e uma solicitação aprovada para após 55 segundos. Se a página do Lolly fechar ou mudar, ou a página de destino for para outro site, a solicitação será cancelada.

::: warning As capturas usam sua sessão do navegador
A página carrega com sua sessão do navegador, então uma página em que você está conectado pode mostrar informações privadas no resultado.
:::

A captura roda no seu navegador, na sua rede, então `localhost` e sites internos funcionam. A captura não é enviada. O único tráfego de rede é o navegador carregando a página que você solicitou e, para um SVG, os arquivos de fonte dessa página uma segunda vez.

Enquanto uma captura roda, você pode ver brevemente um banner *"…started debugging this browser"* na aba temporária. O banner vem do DevTools Protocol e desaparece quando a captura termina.

<a id="reading-a-site-for-design-system-setup"></a>
<!--i:eti-globe-->
## Leitura de um site para o Lolly Design System Setup

A fonte **Website** no Lolly Design System Setup inicia um sistema de design a partir de um site que você já tem. Em um navegador Chromium, a extensão lê a página. No app para desktop, o próprio app busca a página. Em um navegador sem extensão, o cartão Website não é oferecido.

- **Um endereço, uma página.** Depois que você aprova, a extensão abre a página no mesmo tipo de aba em segundo plano, lê a marcação renderizada, o texto das folhas de estilo e algumas imagens de ícones e logotipos, depois fecha a aba. A extensão não segue links nem rastreia o site.
- **Folhas de estilo hospedadas em outro lugar** (uma CDN ou um serviço de fontes) também são buscadas, porque contêm as cores e a tipografia da página. Solicitações entre origens são enviadas sem seus cookies. Solicitações da mesma origem usam seus cookies, como a página faria.
- **Tudo tem limites**, com um limite no número de folhas de estilo e imagens e na quantidade de bytes, então uma página hostil ou parcialmente quebrada retorna material parcial em vez de travar.
- **A análise acontece no seu dispositivo.** Os bytes voltam direto à aba do Lolly que os solicitou, que os transforma em cores, tipografia e logotipos.

Colar um endereço apenas preenche o campo. Nada é lido até você iniciar a leitura e pressionar **Approve once**.

<!--i:eti-lock-->
## Permissões

O `manifest.json` da extensão declara quatro permissões, além do acesso a sites que ela solicita um site por vez. Ele define `minimum_chrome_version: 111`, e a versão atual é 0.5.0.

| Permissão | Para que serve | Quando é concedida |
|---|---|---|
| `debugger` | Controla a aba em segundo plano pelo DevTools Protocol, que faz a captura de tela e, para um SVG, percorre a página. | Na instalação |
| `tabs` | Abre a aba temporária em segundo plano e a fecha depois, e verifica se nem a página do Lolly nem a página de destino mudaram de endereço desde sua aprovação. | Na instalação |
| `scripting` | Executa o leitor de uma página dentro do site que você indicou, para a fonte Website. | Na instalação |
| `storage` | Registra o id de uma aba que abriu, apenas no armazenamento de sessão, para que a aba ainda seja fechada se o navegador suspender a extensão durante a leitura. Limpo na próxima inicialização; nada sobre você é armazenado. | Na instalação |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Acesso a sites, não concedido na instalação. Quando você pressiona **Approve once**, a extensão solicita ao Chrome acesso ao único site dessa solicitação. | Na primeira vez que você aprova uma solicitação para esse site, depois que o Chrome pergunta a você |

A extensão lê apenas a página que você aprova. Ela não lê nem envia seus dados de navegação.

<!--i:eti-help-->
## Solução de problemas

- **Ainda vê "Get the extension"?** Recarregue a aba do Lolly.
- **Nada acontece neste site?** A extensão funciona apenas em `https://lolly.tools`, mais `http://localhost:5173` no pacote de desenvolvimento. Outra origem, como uma cópia auto-hospedada do Lolly, precisa de sua própria compilação da extensão que liste essa origem tanto em `manifest.json` quanto em `policy.js`. Editar só o manifesto não funciona.
- **Uma captura falha?** Verifique se a URL está acessível e começa com `http://` ou `https://`. Algumas páginas bloqueiam a captura automatizada. Se você pressionou **Cancel**, fechou a janela de aprovação ou esperou mais de 30 segundos, inicie a captura de novo.
