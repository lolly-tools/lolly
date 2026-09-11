# Início rápido

Lolly transforma suas regras - cores, tipografia, layouts, lógica - em ferramentas que qualquer pessoa pode usar para criar arquivos prontos: imagens, PDFs, cards para redes sociais, vídeo, preenchendo alguns campos. Há pouco a aprender e nada a enviar: criar e exportar acontece no seu dispositivo, online ou offline.

Esta é a página para ler primeiro. Duas coisas deixam você produtivo: **deixe Lolly com a sua cara** e **traga o que você já tem** (seus arquivos de design e tokens). Todo o resto está a um link de distância.

> Chegou agora em Lolly e só quer criar algo? [Crie algo em 60 segundos](/info/make-something.html) leva você por três deles, ou [abra o app](/#/), escolha qualquer ferramenta da galeria, preencha os campos e clique em **Export**. Volte aqui quando quiser tudo com a *sua* marca.

![A visão Utilities - as ferramentas que rodam no dispositivo, como Strip Hidden Data, Compress PDF e Convert Image, todas em um só lugar](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## 1. Deixe com a sua cara - configure seu Design System

Sua marca em Lolly é um pequeno documento de **design tokens** - cores, fontes e algumas regras - contra o qual toda ferramenta renderiza. Configure uma vez e tudo o que você fizer sai alinhado à marca por construção, não por revisão. Há três caminhos de entrada; escolha o que corresponde ao lugar onde sua marca já vive.

### Comece do zero (o construtor de design system)

Na primeira execução você cai na **galeria**, com um breve diálogo de boas-vindas por cima oferecendo três caminhos - **Make it yours** (o Brand Studio em `#/start`), **Bring your design** (solte um arquivo do Figma, Penpot, InDesign ou PDF e ele abre como um layout editável - a rota mais rápida para [Traga o que você já tem](#2-bring-in-what-you-already-have) abaixo) e **Explore the community tools** - além de uma fileira de idiomas, caso o inglês não seja o seu. Escolha o primeiro card e você chega no [**Brand Studio**](/info/brand-studio.html). Dê um nome e uma cor primária e Lolly *deriva* dali uma paleta completa e acessível - superfícies claras/escuras, texto, destaques - usando a mesma matemática de cor que o motor usa em todo o resto.

![A sala Colours do Brand Studio - uma cor primária e a paleta acessível que Lolly deriva dela](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours) Escolha uma fonte e você tem uma marca funcionando em menos de um minuto. Dali, as seis salas do studio - Overview, Colours, Type, Logos, Tokens, Files - deixam você levar isso até onde quiser, em qualquer ordem, refinando qualquer parte sempre que voltar. A aba **Design system** do painel (`#/d`) mostra o resultado em modo somente leitura e aponta de volta para `#/start`, que é onde a edição acontece (a menos que você esteja em uma build de Lolly com marca travada, em que a marca é fixa e não há nada a mudar).

### Importe uma marca que você já tem

Se sua marca já está registrada como design tokens - do **Penpot**, do **Tokens Studio** (Figma) ou de qualquer arquivo **DTCG** simples - traga tudo de uma vez em vez de redigitar. Dois caminhos:

- <!--i:palette--> **No app:** o [construtor de design system: Brand Studio](/info/brand-studio.html) (`#/start`) aceita isso pelo **Add from…** no pé da barra de salas - um arquivo de tokens, uma exportação do Penpot, um SVG ou um pacote `LollyBrand`. Solte o arquivo e a paleta se acende.
- <!--i:code--> **Pela linha de comando**, para montar um pacote de marca reutilizável:

```bash
# a monolithic tokens.json, a one-file-per-set directory, or a Penpot project archive
npm run ingest:brand -- ./my-tokens.json --name acme --label "Acme" --activate
```

`ingest:brand` aceita os três contêineres em que Penpot / Tokens Studio exportam o mesmo documento - um único `tokens.json`, um diretório (`$metadata.json` + arquivos por conjunto) ou um arquivo `project.penpot`. Com `--activate` ele registra a marca como um perfil, muda para ela e reconstrói o catálogo. Veja [Configuração](/info/configuration.html) para entender como pacotes de marca e perfis se encaixam.

### Ajuste no app

Com uma marca ativa, siga moldando ela no [**Brand Studio**](/info/brand-studio.html) (`#/start`) - mude uma cor ou um papel e toda prévia no app se atualiza enquanto você digita. (A aba **Design system** do painel, em `#/d`, *mostra* a marca em modo somente leitura; o Studio é onde você edita.)

![A aba Design-system do painel - a marca ativa exibida em modo somente leitura](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand) A mesma marca aparece resumida no card **Profile → Your brand**. As fontes são reais: escolha no Google Fonts e Lolly guarda o arquivo **no seu dispositivo** como um asset de marca, então sua tipografia viaja offline e nada é buscado na hora de renderizar.

Quando estiver satisfeito, **exporte a marca como um pacote `LollyBrand`** - um único arquivo que um colega pode importar para ter exatamente a mesma paleta, as mesmas fontes e as mesmas regras. É assim que uma marca circula entre pessoas e máquinas sem um servidor no meio.

> **Os tokens de marca fazem o caminho de ida e de volta.** Como a marca de Lolly *é* tokens DTCG - o formato que o Penpot lê e escreve nativamente e que o Tokens Studio leva ao Figma - a paleta com a qual você *desenha* e a paleta que Lolly *aplica* são um só documento, não duas listas que você sincroniza na mão. Veja [Design Tokens](/info/design-tokens.html).

## 2. Traga o que você já tem

Você não começa de uma página em branco. Lolly abre o trabalho de design e os formatos abertos que você já tem.

### Arquivos de design de código aberto

Trabalho finalizado no **Figma, Penpot, Illustrator, InDesign ou qualquer app de SVG** não precisa ficar preso no app em que foi desenhado. Abra o **Design**, clique em **Import a design** e o arquivo abre como um *layout vivo* - não uma imagem achatada. Cada camada vira uma caixa editável: o texto continua digitável, as formas continuam formas, as imagens vão para a sua biblioteca e a arte vetorial complexa é preservada fielmente. Ele chega já ajustado às fontes e às regras de cor da sua marca.

| Você tem | Traga como |
|---|---|
| Um frame do Figma | `.fig` nativo (File → Save local copy) ou uma exportação SVG |
| Um design do Penpot | A exportação `.penpot` dele ou qualquer SVG |
| Um arquivo do Illustrator | `.ai` nativo (compatível com PDF) ou `.pdf` - abre direto |
| Um layout do InDesign | `.idml` (File → Export → InDesign Markup) |
| Qualquer outra coisa | **Qualquer SVG** - a porta de entrada universal |

Toda a importação acontece **no seu dispositivo** - o arquivo é interpretado no seu navegador e nada é enviado. Os detalhes completos, e exatamente o que é preservado, estão em [Importar um design](/info/design-import.html).

Tem uma **apresentação do PowerPoint**? Solte o `.pptx` no **Deck Builder** para editar slide a slide, já ajustada à sua marca - ou rode o **Rebrand a Deck** para receber a mesma apresentação de volta com outro tema, com gráficos e animações intactos.

### De um trabalho pontual a um template

Aqui está o ganho: um layout importado é uma sessão comum do Design, então assim que você **salva**, ele passa a viver em uma URL. Qualquer pessoa com Lolly pode abrir essa URL, trocar as palavras, trocar uma imagem e renderizar a própria versão - sem app de design, e as partes travadas continuam travadas. Um design de uma vez só vira uma ferramenta reutilizável. Essa é a ideia toda, alcançada sem escrever uma linha de configuração.

### Dados abertos e ferramentas abertas

O [conjunto de ferramentas da comunidade](/info/builders.html) é de código aberto e independente de marca - QR codes, mapas de ruas, filtros, utilitários de privacidade - e renderiza com a *sua* marca no momento em que você a ativa.

Alimente as ferramentas com seus próprios dados abertos também: cole ou solte uma tabela **CSV** ou **JSON** e os campos repetíveis de uma ferramenta se preenchem a partir dela, um asset pronto por linha.

## 3. Crie algo, depois compartilhe ou automatize

Com uma marca ativa e seu material em mãos, toda ferramenta produz um arquivo pronto:

- <!--i:download--> **Renderize** qualquer ferramenta em **SVG, PDF, PNG, JPG, WebP, vídeo** e mais - em tamanhos reais de impressão e unidades físicas quando você precisar. Veja [Exportação & formatos](/info/exporting.html).
- <!--i:link--> **Compartilhe um link.** Todo estado de ferramenta é uma URL, então um asset pronto é reproduzível e endereçável por parâmetros - versione o link, gere de novo quando quiser.
- <!--i:layers--> **Faça em lote.** Comande um template a partir de uma planilha na [grade em lote](/info/exporting.html): um asset pronto por linha.
- <!--i:cpu--> **Automatize.** A mesma renderização roda pela [CLI](/info/cli.html) e por um [agente de IA](/info/ai-agents.html) - uma URL é a API.

"Uma URL é a API" é literal. O gráfico abaixo não foi desenhado por ninguém: o tipo dele, o título e toda a tabela de dados foram digitados na barra de endereços, e o mesmo link renderiza o mesmo gráfico em qualquer dispositivo.

![Um gráfico de área dos cadastros mensais, cujo cada valor chegou como um parâmetro de query em vez de um clique](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Para onde ir agora

Três caminhos, dependendo do que você veio fazer:

- <!--i:people--> **[Lolly para Criadores](/info/creators.html)** - você cria coisas. As vantagens e como tirar o máximo do app.
- <!--i:code--> **[Lolly para Desenvolvedores](/info/builders.html)** - você cria ferramentas, integra e faz deploy. A documentação técnica.
- <!--i:shieldcheck--> **[Lolly para Operadores](/info/operators.html)** - você é responsável pela marca, pela segurança e pela implantação em uma organização.
