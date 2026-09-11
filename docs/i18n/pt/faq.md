# FAQ

Perguntas frequentes exibidas no acordeão da página inicial `/info`.

**Como manter:** cada título `##` abaixo é uma pergunta; tudo o que vem abaixo dele
(até o próximo `##`) é a resposta. As respostas usam o mesmo markdown leve do
restante do site - separe os parágrafos com uma linha em branco. Adicione, remova ou
reordene as perguntas aqui e rode `npm run build:info` (ou `npm run dev:web`) de novo.
Tudo acima do primeiro `##` (este título e estas notas) é ignorado pelo build.

## O que acontece quando eu ativo o opt-in na página /profile?

Quando você começa a usar o Lolly, tudo o que você digita em qualquer lugar é totalmente privado até você deliberadamente querer que essa informação saia dali, por meio de uma mídia ou de um link de compartilhamento (se estiver online).

Com o opt-in ativado, os dados de perfil que você escolher ficam selados dentro do que você cria, identificando você como a fonte. Nada é incluído sem que você escolha.

O Lolly produz um grande volume de conteúdo. Adotamos uma abordagem estrita de minimização de dados para evitar riscos.

## A Lolly foi "vibe coded"?

A Lolly foi desenvolvida com codificação assistida por IA, descoberta assistida por IA e, em muitos pontos, conteúdo assistido por IA, usando uma combinação de modelos e fornecedores, incluindo os de empresas de ponta de nuvem pública.

No momento em que este texto foi escrito, a Lolly não contém nenhuma vulnerabilidade de segurança conhecida em sua cadeia de suprimentos e se compromete com práticas de resposta rápida a segurança quando CVEs surgem.

Um humano criou a arquitetura, curou o código com intenção e dirigiu a arte da experiência.

Mais importante ainda, a Lolly se apoia nos ombros de décadas de inovação open source de especialistas reais ao redor do mundo.

Existe um portão de build determinístico no código-fonte da Lolly para manter o código e a documentação coerentes para o leitor médio e "desbagunçar" a experiência. Isso pode dificultar a enumeração sintética proprietária de origem. Isso não é intencional.

**Divulgação de IA generativa:**

- **Código escrito por LLM:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next (esta lista pode se expandir)
- **Descoberta por LLM:** Gemini 3.1, Fable
- **Documentação:** Sonnet 5
- **Bibliotecas open source:** seus respectivos autores, expressos no SBOM, comentários e cabeçalhos de arquivo

Esta lista não inclui modelos empacotados (vendored) dentro da Lolly.

**Contribuição humana:**

- **Arquitetura:** Andy Fitzsimon
- **Direção de arte:** Andy Fitzsimon
- **Código escrito por humano:** Andy Fitzsimon
- **Idealização, revisão e feedback:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, a Comunidade Penpot (lista não exaustiva)

## O que são as feature flags?

As feature flags ligam ou desligam partes do Lolly. Normalmente quem controla isso é um administrador - no Lolly, o controle é seu.

![Cada feature flag é um interruptor que pertence a você, no seu próprio perfil e não no console de um administrador](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Como consigo os apps para celular ou desktop?

Qualquer pessoa pode distribuir os próprios apps, e as ferramentas e a configuração desses apps variam bastante conforme o público a que se destinam. Então não existe um app único, a não ser que você tenha feito o seu ou que alguém relevante te dê um.

## Por que o nome "Lolly Tools"?

**Lolly** porque a liberdade é doce e porque, na Austrália, na Nova Zelândia e na Grã-Bretanha, "lolly" quer dizer bala.

**Tools** porque uma ferramenta fica parada até você pegá-la. Ela não roda quando você não está usando e não fica te observando quando você está.

## Que obstáculos posso esperar ao adotar o Lolly?

O Lolly se encaixa em qualquer lugar onde você já gera arquivos - a CLI é o mesmo motor
do App, então um pipeline rodando às 2h da manhã não tem como divergir do que uma pessoa
visualiza no navegador. O atrito na adoção raramente é técnico; é organizacional. Espere o seguinte:

**Alguém precisa montar um catálogo de marca curado.** O Lolly é uma plataforma, não um
pacote pronto com os seus templates. Para uma *implantação governada*, alguém define o catálogo
compartilhado de assets (logos, paletas, fontes como IDs permanentes) e escreve o manifesto +
template de cada tipo de saída. Mas ninguém precisa esperar por isso - no
app aberto qualquer pessoa pode trazer os próprios arquivos para o catálogo e criar ferramentas no
Design desde o primeiro dia.

**Não é preciso git para contribuir.** Designers criam as próprias ferramentas e templates
dentro do app e depois compartilham com colegas ou enviam para quem cuida do
deployment incluir por padrão.

**Ele é deliberadamente restrito - apresente-o assim.** O Lolly não serve para conteúdo
sob medida nem para peças de vitrine. Ele *é* o seu DAM pessoal - alimentado e turbinado pelo seu design
system, pelas suas ferramentas e pelo seu catálogo - e *tem* sim um canvas aberto (Design), mas
até ali as cores, a tipografia e os assets seguem os globais de design ativos, então o arranjo
livre continua dentro do sistema. Comparado ao Figma ou ao Canva, vai
parecer limitado. Visto pelo que ele é - geração de assets operacionalizada, recorrente e em escala
massiva - nada chega perto. O enquadramento errado é o tropeço mais comum.

**Gestão de mudança do lado de quem produz.** Os processos atuais funcionam hoje, mesmo que
a saída esteja fora da marca. Reapontá-los para o motor significa testar e aprender de novo,
e "a gente já consegue fazer arquivos" vira a desculpa para não migrar. Comece convertendo
uma saída de qualidade de produção bem visível e mostrando o antes/depois lado a lado.

O Lolly eleva o nível de tudo.


## O que diferencia os utilitários das ferramentas?

**Resposta simples →** Os utilitários nem sempre precisam renderizar e por isso podem ter uma UX diferente. 

**Resposta real →** O motivo de os utilitários poderem ser hospedados dentro do Lolly Tools é acrescentar mais uma 'camada de conveniência' de defesa para desestimular a exfiltração de dados. 

Por quê? Porque se sabe que, todo dia, as pessoas pegam **conteúdo confidencial que já têm** e entregam a um
site qualquer para fazer uma pequena operação mecânica:

- "**Comprimir este PDF**" → envia um contrato / holerite / apresentação do conselho para entidades desconhecidas.
- "**converter HEIC para JPG**" → envia fotos pessoais (com EXIF de GPS) para um host financiado por anúncios
- "**recortar / redimensionar esta imagem**" → envia o screenshot de um produto ou um asset ainda não lançado
- "**formatar este JSON**" / "decodificar este JWT" → cola respostas de API, tokens e segredos em um formatador
- "**juntar estes PDFs**" → envia **dois documentos que nunca deveriam dividir o mesmo servidor**

Esses sites e a enorme cauda longa de clones **não são confiáveis por padrão**: retenção
desconhecida, jurisdições desconhecidas, suboperadores desconhecidos e um modelo de negócio
de anúncios/afiliados com todo o incentivo para guardar o que você entrega. A operação é
trivial; o **custo é o conteúdo.** 

Ganhamos a guerra da governança com conveniência e serviço excelentes. 

![A tela de Utilitários reúne as tarefas mecânicas que as pessoas costumam entregar a um site qualquer, só que rodando dentro do Lolly](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## O Lolly consegue editar e renderizar meus arquivos do Figma, Penpot, Illustrator ou InDesign?

Sim. Abra o **Design** e clique em **Import a design** (importar um design): ele aceita um **.fig** nativo do Figma (Save local copy), uma exportação **.penpot** do Penpot, um **.ai** ou **.pdf** do Illustrator, um **.idml** do InDesign (File → Export → InDesign Markup) ou **qualquer SVG** (a porta larga - quase todo app de design exporta esse formato). Sem conta, sem plugin e sem licença de app de design.

![O canvas aberto do Design - Importar um design fica no menu Lolly da barra de ferramentas](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

As camadas chegam como caixas editáveis no canvas aberto: o texto continua digitável, as formas continuam formas, as imagens entram na sua biblioteca de imagens e a tipografia e as cores seguem os globais da marca. Salve e o layout vira um template reutilizável e endereçável por URL que qualquer pessoa com o Lolly pode preencher de novo - e você pode misturar ferramentas vivas (um QR code, um gráfico) que voltam a renderizar no carregamento. Dali em diante ele renderiza como qualquer outra coisa no Lolly - SVG, PDF, PNG e o resto, reproduzível a partir da URL. Veja [Importar um design](/info/design-import.html).

## Posso compartilhar meu trabalho como arquivo em vez de link?

Sim. Quando um link não consegue carregar tudo (suas próprias fotos, textos longos), a caixa de compartilhamento diz exatamente o que ficaria de fora e oferece um arquivo **.lolly** no lugar: um único arquivo com o design, as imagens que ele usa e, se você quiser, a própria ferramenta. Você decide quanto viaja junto - seu nome e seus dados só entram se o seu perfil tiver dado opt-in, arte licenciada fica de fora a menos que você a inclua, e quem abre um arquivo que carrega uma ferramenta é perguntado se confia nela antes de ela poder rodar. Veja [Compartilhando seu trabalho](/info/using.html#sharing-your-work).

## Duas pessoas conseguem trabalhar no mesmo design sem internet?

Sim. Uma pessoa envia um convite (um link, um QR code ou um código curto), a outra aceita e os dois dispositivos mantêm a mesma sessão ao vivo - presença, anéis de foco e tudo mais. Funciona em qualquer rede compartilhada, inclusive no hotspot de um celular em um subsolo, porque não há servidor no meio. Veja [Trabalhando em conjunto](/info/collaborate.html).

## Para onde foram as ferramentas com a marca SUSE?

Elas já ficam em um repositório separado e privado. Um clone público não baixa o brand pack da SUSE, então um build público roda o perfil neutro `lolly-start` - as ferramentas comunitárias, que independem de marca, mais uma marca em branco que você preenche com a sua. A SUSE opera a própria instância para proteger suas marcas registradas.

## Por que é gratuito? Qual é a pegadinha?

**Criamos o Lolly para nós mesmos.** A SUSE precisava de milhares de arquivos dentro da marca, cada um com o nome dela selado por dentro, feitos sem entregar nada a serviços de fora. Então criamos uma ferramenta que faz tudo isso no próprio dispositivo e a lançamos como open source, como tudo o que fazemos. Continuamos mantendo porque usamos todo dia. **Não existe obrigação:** tudo aqui funciona com ou sem a gente.

Essa linha está traçada na licença, não em uma promessa: tudo o que roda localmente é gratuito, para sempre. Uma versão já lançada é licenciada de modo que não pode ser retirada e não existe contributor agreement que possa relicenciar o trabalho de ninguém. Veja o [posicionamento](/info/positioning.html) para a declaração completa.

## Quanto a SUSE mantém em privado? (ou seja, quando vão puxar o tapete)

O motor, os shells, os schemas e as ferramentas que independem de marca são open source; as marcas registradas da SUSE e as ferramentas com a marca dela são a parte que fica privada, e já estão separadas. A instância pública em [lolly.tools](https://lolly.tools) roda com a marca neutra.

A fronteira é estrutural, não prometida. Toda versão lançada é open source e não pode ser des-lançada, não existe contributor agreement que possa relicenciar o trabalho de ninguém e a única coisa retida é a marca registrada. Quando outra empresa fechou o código do seu Linux corporativo em 2023, a SUSE cofundou a [OpenELA](https://openela.org) para manter esse código aberto - a mesma postura que este projeto herda.

Para deixar claro: a SUSE *está* sim desenvolvendo ferramentas internas para integrar o Lolly aos seus sistemas de TI - isso diz respeito à organização interna da SUSE, não a desenvolvimento público vs. privado. O Lolly também pretende ser construído pelo [Open Build Service](https://openbuildservice.org/), com artefatos de cadeia de suprimentos seguros entregues pela [SUSE Application Collection](https://apps.rancher.io/applications).

## Qual é o sabor daquele logo do Lolly?

Uns dizem limão, outros dizem menta e às vezes maçã; o Lolly traz a doçura, o sabor é você quem faz!
