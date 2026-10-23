# Configurações

Settings é onde você muda como o Lolly funciona para você: seus dados, o sistema de design que você usa, a acessibilidade, o que está armazenado neste dispositivo e o que está pronto offline. Abra com **Settings** na barra do rodapé da tela inicial, ou pelo menu do seu avatar. Ele abre em **Preferences**, com mais quatro abas ao lado.

| Aba | Endereço | O que contém |
|---|---|---|
| **Preferences** | `#/settings` | Seus dados, sistemas de design, aparência, emoji, acessibilidade, conexões, armazenamento e downloads offline |
| **This device** | `#/settings?tab=device` | Uma leitura ao vivo deste navegador e máquina, além de som e uma visão somente leitura do armazenamento |
| **Design system** | `#/settings?tab=brand` | O sistema de design ativo como uma capa e páginas, com uma faixa de capas para trocar de sistema |
| **Capabilities** | `#/settings?tab=caps` | Tudo o que o Lolly pode fazer, em cartões pesquisáveis |
| **Activity & stats** | `#/settings?tab=activity` | O catálogo, seus contadores locais e o trabalho recente |

Cada aba tem o próprio endereço, e os antigos links `#/profile` e `#/d` ainda abrem o lugar certo, até as configurações individuais.

## Preferences

Preferences é uma página longa com uma **barra de configurações** na lateral e um campo **Search settings** acima da barra que a filtra enquanto você digita. Cada seção abre direto de um link no formato `#/settings?focus=<section-id>`, por exemplo `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - seu nome, dados de contato e foto, e a chave **Use my details to create**. [Profiles](/info/profile.html) explica como as ferramentas os usam.
- <!--i:seal--> **Content Credentials** - a identidade verificada opcional que assina suas exportações. Veja [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - alterne, adicione, oculte ou remova sistemas de design. [Design System Setup](/info/brand-studio.html#manage-your-design-systems) cobre cada ação.
- <!--i:moon--> **Appearance** - o tema (Light, Dark ou Brand, que pinta o app com a sua paleta) e **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - o conjunto do qual seus emoji são desenhados quando você começa algo novo, com a licença da arte dele, e quanto a sua paleta os recolore (**Off**, **Subtle**, **Strong**, **Full**, **Mono** ou **Duotone**). **Keep skin tones and flags** deixa esses nas próprias cores. O trabalho que você já fez mantém o conjunto com que foi feito.
- <!--i:eyeoff--> **Accessibility** - quatro opções de conforto, além de Sound e Neurospicy Mode. Veja [Accessibility](#accessibility).
- <!--i:link--> **Connected services** - o armazenamento que você conecta, como Dropbox, Google Drive, OneDrive, Nextcloud ou S3, e **Sync across devices**. Veja [Sync your devices](/info/sync.html).
- <!--i:globe--> **Trusted sites** - os sites que uma caixa de página web do Design ou uma demo do Sandbox pode contatar sem perguntar e, onde o servidor oferece, **Allow pages from any site**. A [Política de Privacidade](/info/privacy.html) lista o que cada requisição envia.
- <!--i:download--> **Your renders** - **Save my renders to my library** guarda em Assets, sob a etiqueta Renders, uma cópia de cada imagem, clipe de áudio e vídeo que você baixa.
- <!--i:database--> **Storage** - o que o Lolly guarda neste dispositivo e os botões que limpam ou levam os seus dados. Veja [Storage](#storage).
- <!--i:cpu--> **Available offline** - baixe o que você precisa antes de perder a conexão. Veja [Available offline](#available-offline).
- <!--i:folder--> **Hot folder** - no app desktop, observe uma pasta e traga para o Lolly tudo o que for solto nela, pelo mesmo seletor que um arrastar e soltar recebe.
- <!--i:clock--> **Your activity** - o que você criou neste dispositivo, contado localmente.
- <!--i:sliders--> **Feature flags** - ative ou desative partes do app, como **Print preflight** ou **Strip metadata from uploads**.
- <!--i:server--> **Lolly instance** - de onde esta instalação obtém suas ferramentas e catálogo. Veja [Lolly instance](#lolly-instance).

Os cartões de tema são prévias ao vivo e se aplicam no instante em que você escolhe um, somente neste dispositivo.

![Três cartões de tema, cada um exibindo em pré-visualização sua própria tipografia e cor, com o ativo sinalizado](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Acessibilidade

**Settings → Preferences → Accessibility** reúne quatro configurações de conforto para o app ao redor do seu trabalho. Cada uma fica desativada até você ativá-la, e nenhuma alcança o interior do canvas de uma ferramenta nem uma exportação, então um app mais calmo nunca move um pixel do arquivo que você entrega.

- <!--i:pause--> **Reduce motion** desativa as transições, os deslizes e os floreios do app. Seu canvas e qualquer exportação animada continuam se movendo como projetados.
- <!--i:photos--> **Hide colourful previews** troca a arte de prévia da galeria por cartões calmos de ícone e texto e suaviza as miniaturas de projetos, para que continuem reconhecíveis sem gritar.
- <!--i:sliders--> **High contrast** reforça as bordas, o texto e os anéis de foco do app. As cores da sua marca e o canvas ficam como você os definiu.
- <!--i:font--> **Large text** aumenta os rótulos, menus e textos de botões do app. A tipografia dentro dos seus designs não é alterada, então nada do que você exporta se reorganiza.

Essas configurações ficam no seu perfil, então viajam em uma exportação de perfil e chegam à próxima instalação com seu nome e suas sessões. Uma pequena cópia só do dispositivo as aplica antes da primeira pintura.

O mesmo cartão traz **Sound**, uma camada suave de sons de apoio para o que você faz (chegar à galeria, um resultado de Content Credentials, fechar um painel), e o **Neurospicy Mode**, uma faixa calma de foco. Ativar o Neurospicy abre um pequeno player no canto que acompanha você pelo app. Ali você escolhe uma faixa, pula, ajusta o volume e minimiza ou fecha o player. As faixas incluem músicas procedurais do *Lolly Sings*, loops ambientes e batidas, seu próprio áudio e estações de rádio pela internet, que exigem conexão. Ambos vêm desativados por padrão e são lembrados, e desativar o Sound também silencia a faixa de foco. O menu do perfil e **This device** trazem a mesma chave.

A interface pode ser navegada pelo teclado, os controles personalizados trazem rótulos para leitores de tela e a prévia ao vivo de cada ferramenta é exposta como uma única imagem com rótulo que descreve o que ela mostra.

### Armazenamento

O medidor de armazenamento contabiliza cada byte que esta instalação guarda, categoria por categoria, em relação ao que o navegador informa.

![O medidor de armazenamento, detalhando sessões salvas, imagens e cache em relação ao que o navegador realmente informa](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Abaixo do medidor:

- **Move to another device** tem **Export my data**, **Import data…** e **Export my data & render everything**. [Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device) percorre cada um.
- **Clear cache** descarta os arquivos do catálogo baixados, que são baixados de novo quando necessário.
- **Remove automatic checkpoints older than 30 days** libera espaço do History e mantém as versões salvas e nomeadas.
- **Clear all my data** remove tudo o que o Lolly guarda neste navegador, depois que você digita uma palavra para confirmar. [If you clear your browser data](/info/find-your-work.html#if-you-clear-your-browser-data) lista o que se perde.

### Disponível offline

O Lolly coloca telas em cache conforme você as visita, o que só cobre onde você já esteve. **Available offline** é para a viagem que você já vê chegando: baixe as partes de que vai precisar, acompanhe uma única barra de progresso, e tudo o que você levou continua funcionando sem conexão.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (todas as telas, editores e fontes, inclusive telas que você nunca abriu), o **Catalogue** (todo ele, ou **Choose by tag**) e **Guides & docs** (esta documentação no seu idioma, capturas de tela incluídas).
- <!--i:cpu--> **AI models** - cada modelo no dispositivo em sua própria linha, com o tamanho: Speech voices, Upscaling models, Background removal, Text recognition, Verify deep scan, Durable credential, Rewriter model, Ask matching model, AI text detector e Singing voices. Um modelo acima de 50 MB é marcado como **large download**.
- <!--i:wrench--> **Tools** - cada ferramenta é baixada separadamente, ou **Download all** leva todas. Um visto significa pronto offline.

**Download everything**, no topo, leva o app, o escopo de catálogo que você escolheu, os guias e todas as ferramentas. Marque **Include all the AI models** para adicionar os modelos, ou baixe um modelo pela própria linha dele; as vozes de canto só são baixadas pela própria linha. A política de uma organização pode desativar os downloads de IA, e então as linhas avisam você.

Os downloads continuam de onde pararam se você cancelar ou perder a conexão, e se atualizam sozinhos quando você volta a ficar online, buscando apenas o que uma versão mudou. Se o navegador não concedeu armazenamento persistente, **Protect downloads** o solicita: a diferença entre "baixado" e "baixado até o navegador querer o espaço de volta".

### Lolly instance

**Lolly instance** diz de onde esta instalação obtém suas ferramentas e catálogo: o endereço de uma instância, ou *Bundled with this app* quando tudo vem dentro da compilação.

- **Design-system source** mostra de onde vem o sistema de design fornecido.
- **Instance console** abre as páginas de administração de uma implantação, onde ela as oferece.
- **Change** aponta o app desktop para outra instância. Um navegador não consegue carregar ferramentas e recursos entre origens, então na web a seção oferece **Open a workspace**.
- **Leave** remove o sistema de design, as ferramentas e o catálogo da instância, e seu próprio trabalho permanece. Veja [Use Lolly at your organisation](/info/organisation.html#leaving).
- Quando você está logado em uma organização, **Sign out** encerra esta sessão e **Sign out everywhere** encerra suas sessões em todos os dispositivos, inclusive neste.

## Este dispositivo

- <!--i:monitor--> **This Machine** - tela, entrada, gráficos, memória, codecs, back-end de armazenamento e mais, lidos ao vivo nesta sessão. Nada é armazenado e nada é enviado. Ele abre sozinho em uma tela larga, onde a aba se organiza em duas colunas.
- <!--i:neurobeat--> **Sound** - os sons da interface e os loops de foco do Neurospicy, a única chave desta aba que grava alguma coisa.
- <!--i:database--> **Storage** - uma visão somente leitura do medidor em [Preferences](#storage), que é onde você limpa ou leva os seus dados.

## Design system

O sistema de design ativo, apresentado para leitura. Quando este navegador guarda dois ou mais sistemas de design, uma faixa de pequenas capas no topo os lista: escolha uma para torná-la ativa, e **Undo** no aviso que se segue devolve a anterior.

![A aba Design system no Lolly Demo: uma faixa de capas para trocar de sistema e depois a capa com seu logotipo, nome, nota e as contagens que abrem cada página](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

A aba abre em uma capa pintada com as cores do próprio sistema, com seu logotipo, seu nome na fonte de exibição e a nota que o autor escreveu. Uma linha de contagens na capa leva a cada página:

- <!--i:palette--> **Colour** - superfície, texto, primária e secundária dos visuais claro e escuro, cada cor nomeada como um chip com nome e hex, uma faixa para cada rampa de tons e o espectro dos gráficos, e as funções de cor em uma seção recolhível. Selecione um valor para copiar o hex.
- <!--i:font--> **Type** - Headings, Text, Emphasis e Code, cada um composto na própria fonte.
- <!--i:photos--> **Logos** - cada arquivo de logotipo sobre o fundo para o qual foi feito.
- <!--i:layers--> **Colourways** - o par claro e escuro de cada variação de cores, quando o sistema tem mais de uma.
- <!--i:sliders--> **Tokens** - raio, espaçamento, efeitos e gradientes.
- <!--i:document--> **Print & CMYK** - as cores presas a uma tinta exata e as condições de impressão que um PDF CMYK pode declarar.

Trocar é a única alteração que esta aba faz. Você edita um sistema de design no [Design System Setup](/info/brand-studio.html), em `#/start`, para onde a capa leva. Um sistema somente leitura avisa isso na capa; os sistemas locais que você cria continuam editáveis. `/b` e `/brand` são atalhos direto para esta aba.

## Capabilities

Cada parte da plataforma é descrita em um cartão, em doze grupos: Experiences, Platforms & runtimes, Accessibility & languages, Export formats, Import formats, Print production, Automation & AI, Determinism & reproducibility, Brand & design system, Privacy & data ownership, Security & access control e Architecture (for builders). Cada grupo se recolhe e mostra o número de cartões. Um cartão abre em uma caixa de diálogo com os recursos daquela capacidade e, em cerca de metade deles, a captura de tela que esta documentação usa.

O campo de busca acima dos grupos filtra os cartões enquanto você digita e abre os grupos que ainda têm uma correspondência. Ele diz quantas capacidades está pesquisando, e uma busca sem resultado avisa isso em palavras.

Esta aba é documentação escrita do que o Lolly pode fazer, mantida em sincronia com estes guias. Ela não examina a máquina em que você está; **This device** faz isso.

## Activity & stats

Primeiro a compilação: quantas ferramentas estão carregadas, quantos formatos de exportação existem, em quantas superfícies a plataforma roda e quantos recursos de marca o catálogo carrega, com um painel **Catalogue** detalhando o que vem nesta compilação.

Depois o seu lado: **Your activity** conta o que você criou neste dispositivo, e **Recent creations** e **Latest exports** são pilhas que você pode deslizar, cada uma aparecendo quando há algo a mostrar. As duas abrem um item como ele estava. Esses contadores ficam no dispositivo; uma instância opcional do Lolly Work mantém seus próprios [registros de telemetria e auditoria da organização](/info/privacy.html#organisation-services-with-lolly-work).

## Links diretos

Toda aba e seção de Settings tem um link próprio, que você pode guardar nos favoritos ou colar. A [Search](/info/search.html) aponta seus resultados de **Settings** para o mesmo registro a partir do qual Settings é renderizado, então uma seção não pode ser renomeada por baixo de um resultado de busca.

::: details Todas as formas de link

- **Uma aba:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Uma seção de Preferences:** `#/settings?focus=<section-id>`, como `#/settings?focus=offline-section`.
- **Uma seção, exatamente:** o id dela como um sinalizador simples, como `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` ou `#/settings?cap-formats`. Os links mais antigos `#/settings?dash-lock` e `#/settings?dash-palette-wheel` abrem a capa e a página Colour.
- **Uma seção por palavra-chave:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (a página Colour) ou `#/settings?tokens`. As palavras-chave podem ser compartilhadas: `print` pertence tanto à referência de impressão da aba de marca quanto ao grupo Print production, e vale a primeira na ordem da página. Use o id quando importar qual.

Um link direto troca para a aba dona do destino, abre qualquer grupo em que ele esteja recolhido e então rola até ele, esperando um instante enquanto as seções acima terminam de se organizar. Os endereços desativados `#/platform` e `#/capabilities` se integram a Settings com seus sinalizadores de link direto intactos.
:::

---

**Relacionado:** [Profiles](/info/profile.html) para seus dados e os contextos em que você cria. [Design System Setup](/info/brand-studio.html) para editar o que a aba Design system mostra. [Find and recover your work](/info/find-your-work.html) para armazenamento, backups e troca de dispositivos.
