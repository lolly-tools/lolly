# Extensão de navegador

A extensão **Lolly URL Screenshot** permite que o app web tire screenshot de qualquer página web de dentro do seu navegador. Sem ela, capturar uma URL exige o app desktop - uma página do navegador não consegue ler pixels de outro site por conta própria. A extensão consegue, usando a mesma captura que o app desktop usa.

Ele faz mais uma tarefa da mesma forma: ler uma única página que você indica para que o Brand Studio consiga extrair uma marca de um site ao vivo. Ambas são cobertas abaixo.

Ela roda em navegadores baseados em Chromium: **Chrome, Edge, Brave, Arc, Opera** - Chrome 111 ou mais recente.

Até ser instalada, o **URL Screenshot** ainda abre para você compor um shot, e uma nota no topo dos controles da ferramenta diz o que está faltando.

![A nota do URL Screenshot oferecendo a extensão, mostrada quando a captura para arquivo não tem host para rodar](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Todo controle fica ativo enquanto você espera: a URL de destino, a profundidade de rolagem, o atraso de acomodação, as margens de corte e a recoloração. Só a captura em si precisa de um host.

![Os controles do URL Screenshot com uma URL de destino, profundidade de rolagem, atraso de acomodação e margens de corte, todos utilizáveis antes de a extensão existir](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Instalar

### Pela Chrome Web Store

*Em breve.* Assim que for publicada, você vai instalar em um clique e depois recarregar o Lolly.

### Carregue você mesmo (desenvolvedores)

A extensão fica no repositório em `shells/chrome-extension/`.

1. Abra `chrome://extensions`.
2. Ative o **Developer mode** (canto superior direito).
3. Clique em **Load unpacked** e escolha a pasta `shells/chrome-extension/`.
4. Recarregue o Lolly - o **URL Screenshot** agora funciona no navegador.

## Como funciona

- Um pequeno script avisa o Lolly de que a extensão está presente, então a ferramenta **URL Screenshot** liga automaticamente - sem configuração.
- Ao renderizar, a extensão abre a página de destino em uma aba de segundo plano, captura via DevTools Protocol (o mesmo `Page.captureScreenshot` que o app desktop usa), depois fecha a aba e devolve a imagem.
- Ela roda inteiramente no seu navegador, na sua rede - então capturar `localhost` ou um site interno funciona. A captura em si nunca é enviada a lugar nenhum; o único tráfego de rede é o seu próprio navegador carregando a página que você pediu para fotografar.

Enquanto uma captura roda, você pode ver brevemente um banner *"…started debugging this browser"* na aba temporária. É o DevTools Protocol trabalhando; ele desaparece sozinho quando o shot termina.

## Lendo um site para o Brand Studio

A fonte **Website** no Brand Studio inicia uma marca a partir de um site que você já tem. No Chromium, é a extensão que faz a leitura; no app desktop, uma busca nativa faz o mesmo trabalho, e em um navegador comum sem a extensão o quadro nem é oferecido.

O que acontece quando você aciona:

- Um endereço, uma página. A extensão a abre no mesmo tipo de aba em segundo plano, lê o markup renderizado, o texto das folhas de estilo e alguns ícones e logos, depois fecha a aba. Ela não segue links e não faz crawling.
- Folhas de estilo e fontes hospedadas em outro lugar (um CDN, um serviço de fontes) também são buscadas, porque as cores e a tipografia da página vivem nelas. Requisições cross-origin vão sem seus cookies; as same-origin usam, exatamente como a própria página faria.
- Tudo tem um limite - um número máximo de folhas, imagens e bytes - para que uma página hostil ou meio quebrada retorne material parcial em vez de travar.
- Os bytes voltam diretamente para a aba do Lolly que pediu. A interpretação em cores, tipografia e logos acontece no seu dispositivo; nada é enviado.

Nada é lido até você acionar. Colar um endereço só preenche o campo.

## Depois de instalar

Recarregue a aba do Lolly. O aviso "Get the extension" desaparece e o **URL Screenshot** fica disponível na galeria e no modo Batch.

## Permissões

Seu `manifest.json` declara quatro permissões, além de acesso a hosts:

- `debugger` - conduz a aba em segundo plano via DevTools Protocol. É isso que tira o screenshot.
- `tabs` - abre a aba temporária em segundo plano e a fecha depois.
- `scripting` - roda o leitor de página única dentro do site que você indicou, para a fonte Website do Brand Studio.
- `storage` - anota o id de uma aba que abriu, só em session storage, para que a aba ainda seja fechada se o navegador suspender a extensão no meio da leitura. Limpo na próxima inicialização; nada sobre você é armazenado.
- `host_permissions: ["<all_urls>"]` - acesso a *todos* os sites, porque você pode apontá-la para qualquer URL que escolher. O Chrome mostra isso na instalação como um aviso amplo de "read and change all your data on all websites".

Apesar desse aviso, ela só lê a única página que você pedir para capturar ou importar, e não lê nem transmite seus dados de navegação - nada é enviado a lugar nenhum.

O manifesto também define `minimum_chrome_version: 111`. A versão atual é 0.2.1.

## Solução de problemas

- **Ainda vendo "Get the extension"?** Recarregue a aba do Lolly - a detecção acontece no carregamento da página.
- **Nada acontece neste site?** A extensão só ativa nas próprias origens do Lolly. Está rodando um build personalizado em outro domínio? Adicione-o a `content_scripts.matches` no `manifest.json` da extensão.
- **Uma captura falha?** Verifique se a URL está acessível e começa com `http://` ou `https://`. Algumas páginas bloqueiam ativamente captura automatizada.
