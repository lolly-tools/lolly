# Extensão de navegador

A extensão **Lolly URL Screenshot** permite que o app web tire screenshot de qualquer página web de dentro do seu navegador. Sem ela, capturar uma URL exige o app desktop - uma página do navegador não consegue ler pixels de outro site por conta própria. A extensão consegue, usando a mesma captura que o app desktop usa.

Ela faz mais duas tarefas da mesma forma. Um endereço web colado em um espaço de imagem pode virar um screenshot dessa página (**Screenshot this page**), e a extensão pode ler uma única página que você indica para que o Brand Studio consiga extrair uma marca de um site ao vivo. Toda requisição espera a sua aprovação na extensão.

Ela roda em navegadores baseados em Chromium: **Chrome, Edge, Brave, Arc, Opera** - Chrome 111 ou mais recente.

Até ser instalada, o **URL Screenshot** ainda abre para você compor um shot, e uma nota no topo dos controles da ferramenta diz o que está faltando.

![A nota do URL Screenshot oferecendo a extensão, mostrada quando a captura para arquivo não tem host para rodar](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Todo controle fica ativo enquanto você espera: a URL de destino, a profundidade de rolagem, o atraso de acomodação, as margens de corte e a recoloração. Só a captura em si precisa de um host.

![Os controles do URL Screenshot com uma URL de destino, profundidade de rolagem, atraso de acomodação e margens de corte, todos utilizáveis antes de a extensão existir](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Instalar

### Pela Chrome Web Store

*Em breve.* Assim que for publicada, você vai instalar em um clique e depois recarregar o Lolly.

### Carregue você mesmo (desenvolvedores)

A extensão fica no repositório em `shells/chrome-extension/`. Essa pasta é o build de produção, que funciona com o Lolly apenas em `https://lolly.tools`.

1. Abra `chrome://extensions`.
2. Ative o **Developer mode** (canto superior direito).
3. Clique em **Load unpacked** e escolha a pasta `shells/chrome-extension/`.
4. Recarregue o Lolly - o **URL Screenshot** agora funciona no navegador.

Para um servidor de desenvolvimento local, execute `pnpm run pack:chrome-extension:dev` e carregue `dist/chrome-extension-dev` no lugar. Esse pacote também aceita `http://localhost:5173` e tem **Development** no nome.

## Como funciona

- Um pequeno script avisa o Lolly de que a extensão está presente, então o **URL Screenshot** pode salvar capturas sem nenhuma configuração adicional.
- Você aprova cada requisição. Quando o Lolly pede, a extensão abre a sua própria janela **Approve page request**, que mostra o site solicitante, se ele quer um screenshot ou o conteúdo da página, e o endereço da página. Nada é lido até você clicar em **Approve once**. **Cancel**, ou fechar a janela, encerra a requisição.
- Na primeira vez que você aprova uma requisição para um site, o Chrome também pergunta se a extensão pode acessar esse site. O Chrome mantém esse acesso depois que você permite, mas cada requisição seguinte ainda precisa do seu próprio **Approve once**.
- Uma aprovação vale para uma requisição e expira após 30 segundos. Só uma requisição pode esperar ou rodar por vez, e uma requisição aprovada é interrompida após 55 segundos. Se a página do Lolly for fechada ou mudar, ou se a página de destino for para outro site, a requisição é cancelada.
- Depois que você aprova, a extensão abre a página de destino em uma aba de segundo plano, captura via DevTools Protocol (o mesmo `Page.captureScreenshot` que o app desktop usa), depois fecha a aba e devolve a imagem para a aba do Lolly que pediu.
- Ela roda inteiramente no seu navegador, na sua rede - então capturar `localhost` ou um site interno funciona. A página carrega com a sessão do seu navegador, então uma página em que você está conectado pode mostrar informações privadas no resultado. A captura em si nunca é enviada a lugar nenhum; o único tráfego de rede é o seu próprio navegador carregando a página que você pediu para fotografar.

Enquanto uma captura roda, você pode ver brevemente um banner *"…started debugging this browser"* na aba temporária. É o DevTools Protocol trabalhando; ele desaparece sozinho quando o shot termina.

## Lendo um site para o Brand Studio

A fonte **Website** no Brand Studio inicia uma marca a partir de um site que você já tem. No Chromium, é a extensão que faz a leitura; no app desktop, uma busca nativa faz o mesmo trabalho, e em um navegador comum sem a extensão o quadro nem é oferecido.

O que acontece quando você aciona:

- Um endereço, uma página. Depois que você aprova, a extensão a abre no mesmo tipo de aba em segundo plano, lê o markup renderizado, o texto das folhas de estilo e alguns ícones e logos, depois fecha a aba. Ela não segue links e não faz crawling.
- Folhas de estilo hospedadas em outro lugar (um CDN, um serviço de fontes) também são buscadas, porque as cores e a tipografia da página vivem nelas. Requisições cross-origin vão sem seus cookies; as same-origin usam, exatamente como a própria página faria.
- Tudo tem um limite - um número máximo de folhas, imagens e bytes - para que uma página hostil ou meio quebrada retorne material parcial em vez de travar.
- Os bytes voltam diretamente para a aba do Lolly que pediu. A interpretação em cores, tipografia e logos acontece no seu dispositivo; nada é enviado.

Colar um endereço só preenche o campo. Nada é lido até você iniciar a leitura e clicar em **Approve once**.

## Depois de instalar

Recarregue a aba do Lolly. O aviso "Get the extension" desaparece, o **URL Screenshot** (em Utilitários) pode salvar capturas em um arquivo, e a ferramenta fica disponível no modo Batch.

## Permissões

Seu `manifest.json` declara quatro permissões, além de acesso a sites que ela pede um site de cada vez:

- `debugger` - conduz a aba em segundo plano via DevTools Protocol. É isso que tira o screenshot.
- `tabs` - abre a aba temporária em segundo plano e a fecha depois, e verifica que nem a página do Lolly nem a página de destino mudaram desde que você aprovou a requisição.
- `scripting` - roda o leitor de página única dentro do site que você indicou, para a fonte Website do Brand Studio.
- `storage` - anota o id de uma aba que abriu, só em session storage, para que a aba ainda seja fechada se o navegador suspender a extensão no meio da leitura. Limpo na próxima inicialização; nada sobre você é armazenado.
- `optional_host_permissions: ["http://*/*", "https://*/*"]` - acesso a sites, que não é concedido na instalação. Quando você clica em **Approve once**, a extensão pede ao Chrome acesso ao único site dessa requisição, e o Chrome pergunta a você na primeira vez para cada site.

Ela só lê a única página que você aprova, e não lê nem transmite seus dados de navegação - nada é enviado a lugar nenhum.

O manifesto também define `minimum_chrome_version: 111`. A versão atual é 0.4.0.

## Solução de problemas

- **Ainda vendo "Get the extension"?** Recarregue a aba do Lolly - a detecção acontece no carregamento da página.
- **Nada acontece neste site?** A extensão funciona apenas em `https://lolly.tools`, mais `http://localhost:5173` no pacote de desenvolvimento. Outra origem, como uma cópia do Lolly hospedada por você, precisa de um build separado da extensão que liste essa origem tanto em `manifest.json` quanto em `policy.js`. Editar apenas o manifesto não funciona mais.
- **Uma captura falha?** Verifique se a URL está acessível e começa com `http://` ou `https://`. Algumas páginas bloqueiam ativamente captura automatizada. Se você clicou em **Cancel**, fechou a janela de aprovação ou esperou mais de 30 segundos, inicie a captura de novo.
