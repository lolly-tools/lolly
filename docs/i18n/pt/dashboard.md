# Configurações

Settings reúne seus dados, seu sistema de design, acessibilidade, armazenamento neste dispositivo e downloads para uso offline. Abra **Settings** pela barra no rodapé da tela inicial ou pelo menu do seu avatar, e a aba **Preferences** será aberta.

| Aba | Endereço | O que contém |
|---|---|---|
| **Preferences** | `#/settings` | Seus dados, sistemas de design, aparência, emojis, acessibilidade, conexões, armazenamento e downloads para uso offline |
| **This device** | `#/settings?tab=device` | Uma leitura ao vivo deste navegador e desta máquina, além de som e uma visualização de armazenamento somente para leitura |
| **Design system** | `#/settings?tab=brand` | O sistema de design ativo como capa e páginas, com uma faixa de capas para trocar de sistema |
| **Capabilities** | `#/settings?tab=caps` | Tudo o que o Lolly pode fazer, em cartões pesquisáveis |
| **Activity & stats** | `#/settings?tab=activity` | O catálogo, seus contadores locais e trabalhos recentes |

Os links antigos `#/profile` e `#/d` ainda abrem o lugar certo, até configurações específicas.

<!--i:eti-sliders-->
## Preferências

Preferences é uma página longa com uma **barra lateral de configurações**. O campo **Search settings** acima da barra a filtra enquanto você digita. Cada seção tem um link no formato `#/settings?focus=<section-id>`, como `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - seu nome, dados de contato e foto de rosto e o botão **Use my details to create**. [Perfis](/info/profile.html) explica como as ferramentas os usam.
- <!--i:seal--> **Content Credentials** - a identidade verificada opcional que assina suas exportações. Veja [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - troque, adicione, oculte ou remova sistemas de design. [Configuração do sistema de design do Lolly](/info/brand-studio.html#manage-your-design-systems) explica cada ação.
- <!--i:moon--> **Appearance** - o tema (Light, Dark ou Brand, que colore o app com sua paleta), **Your colourway** quando o sistema de design oferece mais de uma ([Personalize uma variação de cores](/info/colourways.html#make-a-colourway-your-own)) e **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - o conjunto de emojis para novos trabalhos, com a licença da arte, e a intensidade com que sua paleta recolore os emojis (**Off**, **Subtle**, **Strong**, **Full**, **Mono** ou **Duotone**). **Keep skin tones and flags** mantém esses elementos nas próprias cores. Os trabalhos que você já fez mantêm seus conjuntos.
- <!--i:eyeoff--> **Accessibility** - quatro botões de conforto, além de Sound e Neurospicy Mode. Veja [Acessibilidade](#accessibility).
- <!--i:link--> **Connected services** - o armazenamento que você conecta, como Dropbox, Google Drive, OneDrive, Nextcloud ou S3, e **Sync across devices**. Veja [Sincronize seus dispositivos](/info/sync.html).
- <!--i:globe--> **Trusted sites** - os sites que uma caixa de página web do Lolly Design ou uma demonstração do Lolly Sandbox pode contatar sem perguntar e, onde o servidor oferece, **Allow pages from any site**. A [Política de Privacidade](/info/privacy.html) lista o que cada solicitação envia.
- <!--i:download--> **Your renders** - **Save my renders to my library** guarda uma cópia de cada imagem, clipe de áudio e vídeo que você baixa em Assets, sob a tag Renders.
- <!--i:database--> **Storage** - o que o Lolly guarda neste dispositivo e os botões que limpam ou transferem seus dados. Veja [Armazenamento](#storage).
- <!--i:cpu--> **Available offline** - baixe o que precisa antes de perder a conexão. Veja [Disponível offline](#available-offline).
- <!--i:folder--> **Hot folder** - no app para desktop, o Lolly monitora uma pasta e importa tudo o que for colocado nela, pelo mesmo seletor usado ao arrastar e soltar.
- <!--i:clock--> **Your activity** - o que você criou neste dispositivo, contado localmente.
- <!--i:sliders--> **Feature flags** - ative ou desative partes do app, como **Print preflight** ou **Strip metadata from uploads**. **Performance UI** dá ao app uma aparência mais simples que exige menos recursos para desenhar. O Lolly pode ativar Performance UI por conta própria em um dispositivo lento. A linha abaixo do botão então diz quando e por quê, com **Allow again** ([como ele decide](/info/configuration.html#curating-what-people-see)).
- <!--i:server--> **Lolly instance** - de onde esta instalação obtém suas ferramentas e seu catálogo. Veja [Instância do Lolly](#lolly-instance).

Os cartões de tema são prévias ao vivo. Um tema é aplicado assim que você o escolhe, apenas neste dispositivo.

![Três cartões de tema, cada um com uma prévia da própria tipografia e cor, com o ativo marcado](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Acessibilidade

**Settings → Preferences → Accessibility** reúne quatro configurações de conforto para o app. Cada uma fica desativada até você ativá-la, e nenhuma delas afeta o interior do canvas de uma ferramenta nem uma exportação, então um app mais tranquilo nunca move um pixel do arquivo que você entrega. Cada uma fica desativada por padrão. Nenhuma altera o canvas de uma ferramenta nem uma exportação.

- <!--i:pause--> **Reduce motion** desativa as transições, os deslizamentos e os efeitos decorativos do app.
- <!--i:photos--> **Hide colourful previews** troca as artes de prévia da galeria por cartões com ícone e texto e suaviza as miniaturas dos projetos, que continuam reconhecíveis.
- <!--i:sliders--> **High contrast** reforça as bordas, o texto e os contornos de foco do app. As cores da sua marca e o canvas continuam como você os definiu.
- <!--i:font--> **Large text** aumenta os rótulos, os menus e o texto dos botões do app.

**Dominant hand** (Right ou Left) define de que lado ficam os controles quando o Lolly mostra dois painéis, em um dispositivo dobrável ou em um tablet quase quadrado. **Swap sides** no cabeçalho de um painel também muda isso.

Essas configurações ficam no seu perfil, então vão em uma exportação de perfil junto com seu nome e suas sessões. Uma cópia exclusiva do dispositivo as aplica antes do primeiro desenho da interface.

O mesmo cartão tem **Sound**, sons suaves de apoio para ações como chegar à galeria, receber um resultado de Content Credentials ou fechar um painel. Também tem **Neurospicy Mode**, uma trilha calma para concentração. Ativar Neurospicy abre um pequeno player no canto que acompanha você por todo o app. No player, você escolhe uma faixa, pula, ajusta o volume e minimiza ou fecha o player. As faixas incluem as estações geradas pelo Lolly, loops ambientes e batidas, seu próprio áudio e estações de rádio da internet, que precisam de conexão. Ambos ficam desativados por padrão, e suas escolhas são lembradas. Desativar Sound também silencia a trilha de concentração. O menu do perfil e **This device** têm o mesmo botão.

Um controle deslizante abaixo do botão Sound define do que os sons são feitos. Perto da forma arredondada **Bouba**, eles viram gotas suaves, bolhas e um pouco de grave. Perto da estrela pontuda **Kiki**, viram estalos secos, arranhões e metal. O meio mantém os sinos e as notas do Lolly. Se os sons de uma ponta forem difíceis de suportar, mova em direção à outra. O controle deslizante funciona com Sound desativado, e soltá-lo reproduz uma amostra curta.

::: details As estações geradas
As estações geradas compõem sua música enquanto tocam, sem samples nem vozes gravadas. Cada música tem seus próprios instrumentos, ritmo e sequência de execução.

- **Lolly Sings** é uma família de estações. A Lolly Sings original é viva e melódica: tonalidades maiores, uma melodia principal em cada música e toques de bossa, shuffle e chiptune. Cada gênero também tem sua própria estação, de Sugar e K-pop a Country, Jazz, Metal e D&B.
- As **estações Lofi** (Warm, Late night e Rainy) são batidas lo-fi sem fim.

Em uma estação gerada, avançar e voltar alternam entre músicas. Cada música vem de uma semente, então toca da mesma forma onde quer que você a compartilhe ou salve (veja [Música gerada](/info/generated-music.html)). Abaixo dos controles de reprodução, **Mood** alterna entre as estações Lofi, **Drums** remove a bateria e **Texture** vai do som limpo ao de um disco empoeirado. Em seguida vem uma fileira de botões com ícones. Passe o ponteiro sobre um botão ou mantenha-o pressionado para ver seu nome:

- A nota musical, **Open in the music generator**, abre a música em `#/music`, onde você pode mudar seus instrumentos seção por seção.
- O link, **Share this tune or moment**, oferece um link que toca a mesma música ou um que também começa de onde você está e mostra o visualizador com sua predefinição e cores atuais.
- A pasta, **Save to library**, guarda a música nos seus recursos.
- O raio, **Light visualiser**, é um botão de ativação, descrito abaixo.

Uma música salva aparece no grupo da sua estação, por tonalidade e andamento. Escolher a música salva toca a mesma música novamente, repetindo como qualquer faixa ou seguindo adiante no modo de avanço. Ela armazena apenas a estação e o número da música, alguns bytes, e a música é composta novamente enquanto toca. Você pode renomear ou excluir uma música salva nos seus recursos e usá-la como trilha de fundo de um vídeo. Lolly Demo e Lolly Start vêm com seis músicas salvas cada.

O visualizador ouve todas as faixas em um nível constante, então uma faixa baixa movimenta a imagem tanto quanto uma alta, em qualquer volume. Cada gênero do Lolly Sings e uma música salva de um deles oferecem **Light visualiser**: barras de nível simples que deixam para a música o tempo de processamento de que ela precisa. Light visualiser começa ativado em telas de toque e em dispositivos com quatro núcleos ou menos ou 4 GB de memória ou menos.
:::

Você pode usar a interface pelo teclado. Os controles personalizados têm rótulos para leitores de tela. A prévia ao vivo de cada ferramenta é uma única imagem rotulada que descreve o que mostra.

### Armazenamento

O medidor de armazenamento mostra cada byte que esta instalação guarda, por categoria, em comparação com o que o navegador informa.

![O medidor de armazenamento, detalhando sessões salvas, imagens e cache em comparação com o que o navegador realmente informa](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Abaixo do medidor:

- **Move to another device** tem **Export my data**, **Import data…** e **Export my data & render everything**. [Mova seu trabalho para outro dispositivo](/info/find-your-work.html#move-your-work-to-another-device) explica cada um.
- **Clear cache** remove os arquivos de catálogo baixados, que são baixados novamente quando necessário.
- **Remove automatic checkpoints older than 30 days** libera espaço de History e mantém as versões salvas e nomeadas.
- **Clear all my data** remove tudo o que o Lolly guarda neste navegador, depois que você digita uma palavra para confirmar. [Se você limpar os dados do navegador](/info/find-your-work.html#if-you-clear-your-browser-data) lista o que é removido.

### Disponível offline

O Lolly armazena em cache apenas as telas que você visitou. **Available offline** baixa as partes de que você vai precisar, com uma única barra de progresso, e elas continuam funcionando sem conexão.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (todas as telas, editores e fontes, incluindo telas que você nunca abriu), o **Catalogue** (inteiro ou **Choose by tag**) e **Guides & docs** (esta documentação no seu idioma, incluindo capturas de tela).
- <!--i:cpu--> **AI models** - cada modelo executado no dispositivo em sua própria linha com seu tamanho: vozes de fala, modelos de ampliação, remoção de fundo, reconhecimento de texto, análise profunda do Lolly Verify, credencial durável, modelo de reescrita, modelo de correspondência do Ask, detector de texto de IA e vozes de canto. Um modelo com mais de 50 MB recebe a marca **large download**.
- <!--i:wrench--> **Tools** - cada ferramenta é baixada separadamente, ou **Download all** baixa todas as ferramentas. Um visto indica que está pronta para uso offline.

**Download everything**, no topo, baixa o app, o escopo do catálogo que você escolheu, os guias e todas as ferramentas. Marque **Include all the AI models** para incluir os modelos ou baixe um modelo pela própria linha. As vozes de canto só podem ser baixadas pela própria linha. A política de uma organização pode desativar os downloads de IA, e as linhas passam a indicar isso.

Os downloads continuam de onde pararam se você cancelar ou perder a conexão. Ao voltar à internet, eles se atualizam e baixam apenas o que mudou em uma versão. Se o navegador não concedeu armazenamento persistente, **Protect downloads** pede essa permissão. Sem a permissão, o navegador pode apagar downloads quando precisar recuperar espaço.

### Instância do Lolly

**Lolly instance** informa de onde esta instalação obtém suas ferramentas e seu catálogo: o endereço de uma instância ou *Bundled with this app* quando tudo vem incluído na compilação.

- **Design-system source** mostra de onde vem o sistema de design fornecido.
- **Instance console** abre as páginas de administração de uma implantação, quando ela as oferece.
- **Change** aponta o app para desktop para outra instância. Um navegador não pode carregar ferramentas e recursos de outras origens, então na web a seção oferece **Open a workspace**.
- **Leave** remove o sistema de design, as ferramentas e o catálogo da instância. Seu próprio trabalho fica. Veja [Use o Lolly na sua organização](/info/organisation.html#leaving).
- Quando você está conectado a uma organização, **Sign out** encerra esta sessão e **Sign out everywhere** encerra suas sessões em todos os dispositivos, incluindo este.

<!--i:eti-monitor-->
## Este dispositivo

- <!--i:monitor--> **This Machine** - tela, entrada, gráficos, memória, codecs, backend de armazenamento e mais, lidos em tempo real desta sessão. Nada é armazenado nem enviado. Em uma tela larga, este painel se abre sozinho e a aba usa duas colunas.
- <!--i:neurobeat--> **Sound** - os sons da interface e os loops de concentração do Neurospicy. Sound é o único alternador nesta aba que grava algo.
- <!--i:database--> **Storage** - uma visualização do medidor apenas para leitura. Limpe ou transfira seus dados em [Preferências](#storage).

<!--i:eti-palette-->
## Sistema de design

O sistema de design ativo, organizado para leitura. Quando este navegador guarda dois ou mais sistemas de design, uma faixa de capas no topo os lista. Escolha um para ativá-lo. **Undo**, no aviso que aparece em seguida, restaura o anterior.

![A aba Design system no Lolly Demo: uma faixa de capas para trocar de sistema, depois a capa com seu logo, nome, nota e as contagens que abrem cada página](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

A aba abre em uma capa nas cores do próprio sistema, com seu logo, seu nome na fonte de destaque e a nota que o autor escreveu. Uma linha de contagens na capa leva a cada página:

- <!--i:palette--> **Colour** - a superfície, o texto, a cor primária e a secundária dos visuais claro e escuro, cada cor nomeada como um chip com seu nome e hex, uma faixa para cada escala de tons e o espectro do gráfico, além das funções das cores em uma seção retrátil. Selecione um valor para copiar o hex.
- <!--i:font--> **Type** - Headings, Text, Emphasis e Code, cada um em sua própria fonte.
- <!--i:photos--> **Logos** - cada arquivo de logo no fundo para o qual foi feito.
- <!--i:layers--> **Colourways** - o par claro e escuro de cada variação de cores, quando o sistema tem mais de uma.
- <!--i:sliders--> **Tokens** - raio, espaçamento, efeitos e gradientes.
- <!--i:document--> **Print & CMYK** - as cores vinculadas a uma tinta exata e as condições de impressão que um PDF CMYK pode declarar.

Trocar de sistema é a única alteração que esta aba faz. Edite um sistema de design no [Lolly Design System Setup](/info/brand-studio.html), em `#/start`, acessível pela capa. Um sistema somente para leitura informa isso na capa. Os sistemas locais que você cria continuam editáveis. `/b` e `/brand` são links curtos para esta aba.

<!--i:eti-grid-->
## Capacidades

Cada parte da plataforma tem um cartão, em doze grupos: Experiências, Plataformas & ambientes de execução, Acessibilidade & idiomas, Formatos de exportação, Formatos de importação, Produção gráfica, Automação & IA, Determinismo & reprodutibilidade, Marca & sistema de design, Privacidade & propriedade dos dados, Segurança & controle de acesso e Arquitetura (para desenvolvedores). Cada grupo se recolhe e mostra sua contagem de cartões. Um cartão abre uma caixa de diálogo com os recursos dessa capacidade e, em cerca de metade dos cartões, a captura de tela usada nesta documentação.

O campo de busca acima dos grupos filtra os cartões enquanto você digita e abre os grupos que contêm uma correspondência. O campo mostra quantas capacidades pesquisa. Uma busca sem correspondências informa isso em palavras.

Esta aba documenta o que o Lolly pode fazer, em sintonia com estes guias. Ela não examina a máquina que você está usando; **This device** faz isso.

<!--i:eti-gauge-->
## Atividade & estatísticas

Primeiro, a compilação: o número de ferramentas carregadas, formatos de exportação, ambientes em que a plataforma roda e recursos de marca no catálogo. Um painel **Catalogue** detalha o que vem nesta compilação.

Depois, seu próprio trabalho: **Your activity** conta o que você criou neste dispositivo. **Recent creations** e **Latest exports** são pilhas que você pode percorrer deslizando, mostradas assim que têm conteúdo. Ambas abrem um item como ele estava. Esses contadores ficam no dispositivo. Uma instância opcional do Lolly Work mantém seus próprios [registros de telemetria e auditoria da organização](/info/privacy.html#organisation-services-with-lolly-work).

<!--i:eti-link-->
## Links diretos

Cada aba e seção de Settings tem seu próprio link para adicionar aos favoritos ou colar. A [Lolly Search](/info/search.html) monta seus resultados de **Settings** a partir do mesmo registro usado por Settings, então renomear uma seção nunca quebra um resultado de busca.

::: details Todas as formas de link

- **Uma aba:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Uma seção de Preferences:** `#/settings?focus=<section-id>`, como `#/settings?focus=offline-section`.
- **Uma seção exata:** seu id como um parâmetro sem valor, como `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` ou `#/settings?cap-formats`. Os links antigos `#/settings?dash-lock` e `#/settings?dash-palette-wheel` abrem a capa e a página Colour.
- **Uma seção por palavra-chave:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (a página Colour) ou `#/settings?tokens`. Duas seções podem compartilhar uma palavra-chave: `print` pertence tanto à referência de impressão da aba de marca quanto ao grupo Print production, e a primeira na ordem da página prevalece. Use o id para escolher uma.

Um link direto muda para a aba que contém o destino e abre qualquer grupo no qual ele esteja recolhido. Depois, rola até o destino assim que as seções acima terminam de se organizar. Os endereços desativados `#/platform` e `#/capabilities` abrem em Settings com seus parâmetros de link direto intactos.
:::

---

**Relacionado:** [Perfis](/info/profile.html) para seus dados e os contextos em que você cria. [Lolly Design System Setup](/info/brand-studio.html) para editar o que a aba Design system mostra. [Encontre e recupere seu trabalho](/info/find-your-work.html) para armazenamento, backups e troca de dispositivo.
