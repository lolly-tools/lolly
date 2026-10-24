# Extensão de navegador

Uma página web não consegue ler os pixels de outro site, então o app web do Lolly precisa de ajuda para tirar uma captura de tela de uma página. Em um navegador baseado em Chromium (Chrome, Edge, Brave, Arc ou Opera, a partir do Chrome 111), a extensão gratuita **Lolly URL Screenshot** oferece essa ajuda, usando a mesma captura do app desktop. Com ela instalada:

- **[URL Screenshot](/t/url-shot)** salva em arquivo a página que você montou;
- um endereço web colado em um slot de imagem pode virar uma captura dessa página, com **Screenshot this page**;
- a origem **Website** no [Design System Setup](/info/brand-studio.html) pode ler uma página para iniciar um sistema de design.

Você aprova cada solicitação, e o app desktop faz os mesmos trabalhos sem a extensão.

## Antes de instalar

Enquanto a extensão não estiver instalada, o **URL Screenshot** ainda abre, para que você monte uma captura. Uma nota no topo dos controles da ferramenta diz o que está faltando.

![A nota do URL Screenshot oferecendo a extensão, mostrada quando a captura para arquivo não tem host para rodar](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Todos os controles funcionam enquanto você espera: a URL de destino, a profundidade de rolagem, o atraso de estabilização, as margens de corte e a recoloração. Apenas a captura em si precisa da extensão.

![Os controles do URL Screenshot com uma URL de destino, profundidade de rolagem, atraso de acomodação e margens de corte, todos utilizáveis antes de a extensão existir](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Instalar

**Pela Chrome Web Store:** em breve. Quando a extensão for publicada, você a instala com um clique.

**Carregue você mesmo (desenvolvedores).** A extensão fica no repositório em `shells/chrome-extension/`. Essa pasta é a compilação de produção, que funciona apenas com o Lolly em `https://lolly.tools`.

1. Abra `chrome://extensions`.
2. Ative **Developer mode** (canto superior direito).
3. Clique em **Load unpacked** e escolha a pasta `shells/chrome-extension/`.
4. Recarregue a aba do Lolly. A detecção acontece quando a página carrega, então o aviso "Get the extension" desaparece. O **URL Screenshot** (em Utilities) pode então salvar capturas em arquivo e fica disponível no modo Batch.

Para um servidor de desenvolvimento local, execute `pnpm run pack:chrome-extension:dev` e carregue `dist/chrome-extension-dev` no lugar. Esse pacote também aceita `http://localhost:5173` e tem **Development** no nome.

## O que acontece quando o Lolly pede

![A aba do Lolly pede uma página e você pressiona Approve once na janela de aprovação da extensão. Uma aba em segundo plano abre, lê a página e fecha. Depois a aba do Lolly recebe o resultado.](/info/diagrams/concepts/extension-request.svg)

1. **O Lolly pede.** Um pequeno script informa ao Lolly que a extensão está presente, então uma captura ou a leitura de uma página pode começar sem mais configuração.
2. **Você aprova.** A extensão abre a própria janela **Approve page request**. Ela mostra o site solicitante, se ele quer uma captura de tela ou o conteúdo da página, e o endereço da página. Nada é lido até você pressionar **Approve once**. **Cancel**, ou fechar a janela, encerra a solicitação.
3. **O Chrome pergunta uma vez por site.** Na primeira vez que você aprova uma solicitação para um site, o Chrome também pergunta se a extensão pode acessar esse site. O Chrome mantém esse acesso depois que você permite, mas cada solicitação seguinte ainda precisa do próprio **Approve once**.
4. **A página é lida em uma aba em segundo plano.** A extensão abre a página de destino em uma aba em segundo plano, a captura pelo DevTools Protocol (o mesmo `Page.captureScreenshot` que o app desktop usa), fecha a aba e devolve o resultado à aba do Lolly que pediu.

Uma aprovação cobre uma solicitação e expira em 30 segundos. Apenas uma solicitação pode esperar ou rodar por vez, e uma solicitação aprovada é interrompida após 55 segundos. Se a página do Lolly fechar ou mudar, ou se a página de destino for para outro site, a solicitação é cancelada.

A captura roda no seu navegador, na sua rede, então `localhost` e sites internos funcionam. A página carrega com a sessão do seu navegador, então uma página em que você está logado pode mostrar informações privadas no resultado. A captura não é enviada: o único tráfego de rede é o seu próprio navegador carregando a página que você pediu.

Enquanto uma captura roda, você pode ver brevemente um aviso *"…started debugging this browser"* na aba temporária. É o DevTools Protocol trabalhando, e o aviso some quando a captura termina.

## Ler um site para o Design System Setup

A origem **Website** no Design System Setup inicia um sistema de design a partir de um site que você já tem. Em um navegador Chromium, a extensão lê a página. No app desktop, o app busca a página por conta própria. Em um navegador sem a extensão, o bloco Website não é oferecido.

- **Um endereço, uma página.** Depois que você aprova, a extensão abre a página no mesmo tipo de aba em segundo plano, lê a marcação renderizada, o texto das folhas de estilo e algumas imagens de ícone e logotipo, e fecha a aba. Ela não segue links nem rastreia.
- **As folhas de estilo hospedadas em outro lugar** (uma CDN ou um serviço de fontes) também são buscadas, porque as cores e a tipografia da página estão nelas. As requisições entre origens vão sem os seus cookies; as de mesma origem os usam, como a própria página faria.
- **Tudo tem limite**, com um teto para o número de folhas de estilo e imagens e para os bytes, então uma página hostil ou meio quebrada devolve material parcial em vez de travar.
- **A análise acontece no seu dispositivo.** Os bytes voltam direto à aba do Lolly que pediu, que os transforma em cores, tipografia e logotipos.

Colar um endereço apenas preenche o campo. Nada é lido até você iniciar a leitura e pressionar **Approve once**.

## Permissões

O `manifest.json` da extensão declara quatro permissões, além do acesso a sites que ela pede um site por vez. Ele define `minimum_chrome_version: 111`, e a versão atual é a 0.4.0.

| Permissão | Para que serve | Quando é concedida |
|---|---|---|
| `debugger` | Conduz a aba em segundo plano pelo DevTools Protocol, que tira a captura de tela. | Na instalação |
| `tabs` | Abre a aba temporária em segundo plano e a fecha depois, e confere que nem a página do Lolly nem a página de destino mudaram desde que você aprovou. | Na instalação |
| `scripting` | Executa o leitor de uma página dentro do site que você indicou, para a origem Website. | Na instalação |
| `storage` | Anota o id de uma aba que abriu, apenas no armazenamento de sessão, para que a aba ainda feche se o navegador suspender a extensão no meio da leitura. Limpo na próxima inicialização; nada sobre você é armazenado. | Na instalação |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Acesso a sites, não concedido na instalação. Quando você pressiona **Approve once**, a extensão pede ao Chrome acesso ao único site daquela solicitação. | Na primeira vez que você aprova uma solicitação para aquele site, depois que o Chrome pergunta a você |

A extensão lê apenas a única página que você aprova. Ela não lê nem envia seus dados de navegação, e nada é enviado.

## Solução de problemas

- **Ainda vendo "Get the extension"?** Recarregue a aba do Lolly.
- **Nada acontece neste site?** A extensão funciona apenas em `https://lolly.tools`, além de `http://localhost:5173` no pacote de desenvolvimento. Outra origem, como uma cópia auto-hospedada do Lolly, precisa da própria compilação da extensão que liste essa origem no `manifest.json` e no `policy.js`. Editar só o manifesto não funciona.
- **Uma captura falha?** Confira se a URL está acessível e começa com `http://` ou `https://`. Algumas páginas bloqueiam a captura automatizada. Se você pressionou **Cancel**, fechou a janela de aprovação ou esperou mais de 30 segundos, inicie a captura de novo.
