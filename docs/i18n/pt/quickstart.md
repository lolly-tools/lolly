# Comece

Ao fim desta página, suas ferramentas vão usar suas próprias cores e fontes, e o trabalho que você já tem estará pronto para ser reaproveitado. Você não precisa de conta, e criar e exportar rodam no seu dispositivo.

::: timeline
- <!--i:sparkle--> **Crie um arquivo.** [Make your first file](/info/make-something.html) guia você por um QR code em poucos minutos.
- <!--i:palette--> **Coloque a sua marca.** Comece por uma cor, um arquivo de tokens ou um design pronto.
- <!--i:layers--> **Crie mais do mesmo.** Compartilhe um link, preencha uma planilha ou execute a ferramenta a partir de um script.
:::

É novo na ideia? [What is Lolly?](/info/what-is-lolly.html) é a introdução de cinco minutos, e [How Lolly works](/info/how-lolly-works.html) mostra quem faz o quê.

## Coloque a sua marca

O lolly.tools abre no **Lolly Demo**, o sistema de design de exemplo do próprio Lolly; [Meet Lolly Demo](/info/lolly-demo.html) mostra o que você está vendo. O seu sistema de design o substitui: um pequeno conjunto de design tokens, ou seja, cores, fontes e algumas regras, com o qual todas as ferramentas desenham. Defina uma vez, e tudo o que você criar já começa na identidade da marca.

Escolha o caminho que combina com o que você tem:

- <!--i:palette--> **Uma cor.** Abra o **Design System Setup** (`#/start`), dê um nome ao seu sistema de design e escolha uma cor primária. O Lolly deriva dela uma paleta completa e acessível, com superfícies claras e escuras, texto e destaques. Escolha uma fonte e você tem uma marca funcionando.
- <!--i:upload--> **Um arquivo de tokens.** **Add from…**, no pé da barra de salas do Design System Setup, aceita um arquivo de tokens DTCG, Tokens Studio ou Penpot, um SVG ou um pacote `LollyBrand`. Solte-o ali e a paleta é preenchida. Enquanto o sistema de design ainda está vazio, **Start from a reference** na sala Overview abre o mesmo seletor.
- <!--i:pentool--> **Um design pronto.** No Design, escolha **Import a design** e solte um arquivo `.fig`, `.penpot`, `.ai`, `.idml` ou SVG. Veja [Traga o que você já tem](#bring-in-what-you-already-have) abaixo.

Na primeira vez que você abre a galeria, uma breve boas-vindas oferece as mesmas escolhas: **Make it yours** abre o Design System Setup, **Bring your design** abre um seletor de arquivos para um design e **Explore the community tools** fecha as boas-vindas.

![A sala Colours do Design System Setup em uma instalação nova: uma amostra ao vivo, um campo e toda a primeira decisão](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

A partir daí, sete salas levam você até onde quiser, em qualquer ordem: **Overview**, **Colours**, **Type**, **Logos**, **Tokens**, **Files** e **Usage & rules**. Todas as prévias do app são atualizadas enquanto você digita. [Design System Setup](/info/brand-studio.html) cobre cada sala.

As fontes ficam no seu dispositivo. Escolha uma Google Font e o Lolly guarda o arquivo como um recurso da marca, então a sua tipografia funciona offline e nada é buscado quando uma ferramenta desenha.

### Veja, troque e compartilhe um sistema de design

- **Veja o ativo.** **Settings → Design system** mostra o sistema de design ativo como uma capa e páginas, somente leitura.
- **Alterne entre eles.** **Settings → Preferences → Design systems** lista todos os sistemas de design deste dispositivo. Uma organização pode ter vários sistemas de design, ou um com várias variações de cores; [Brand architectures](/info/brand-architectures.html) mapeia as combinações.
- **Compartilhe um.** Exporte o sistema de design como um pacote `LollyBrand`: um arquivo que um colega importa para ter a mesma paleta, as mesmas fontes e as mesmas regras.

Um sistema de design fornecido pela sua versão ou organização é **gerenciado**: mostra um cadeado e fica somente leitura. Para alterar um, crie uma cópia editável em **Settings → Preferences → Design systems**.

![A aba Design system em Settings: o sistema de design ativo como uma capa e páginas](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

O seu sistema de design são tokens DTCG, o formato que o Penpot lê e grava e que o Tokens Studio leva ao Figma, então a paleta com que você projeta e a paleta que o Lolly aplica são um único documento. [Design Tokens](/info/design-tokens.html) traz os detalhes.

::: details Para desenvolvedores: crie um pacote de marca pela linha de comando
Para montar um pacote de marca reutilizável em um checkout, o `ingest:brand` aceita os três contêineres que o Penpot e o Tokens Studio exportam: um único `tokens.json`, um diretório de arquivos por conjunto com `$metadata.json` ou um arquivo `project.penpot`.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` registra a marca como um perfil e compila e valida o catálogo dela. Ele nunca altera o perfil padrão: execute com `LOLLY_PROFILE=acme` para usar o novo pacote. [Configuration](/info/configuration.html) explica como pacotes de marca e perfis se encaixam.
:::

## Traga o que você já tem

Você não começa de uma página em branco.

**Arquivos de design.** Trabalhos prontos do Figma, Penpot, Illustrator, InDesign ou de qualquer app SVG abrem no Design como um layout vivo: o texto continua editável, as formas continuam formas e as imagens vão para a sua biblioteca. O arquivo é lido no seu navegador e nada é enviado. [Import a design](/info/design-import.html) lista cada formato e o que é mantido.

**Decks.** Solte um `.pptx` do PowerPoint no Lolly para arquivar os slides como recursos, escreva um deck novo a partir de Markdown em **Markdown Slides** ou use [Rebrand a deck](/info/rebrand.html) para levar o deck inteiro para o seu sistema de design.

**Dados.** Cole ou solte uma tabela CSV ou JSON e os campos repetidos de uma ferramenta são preenchidos a partir dela, ou o [Batch](/info/batch.html#make-many-versions-of-one-design) gera um arquivo pronto por linha.

### De um trabalho pontual a um template

Um layout importado é uma sessão comum do Design. **Share with rules** o transforma em uma ferramenta: você escolhe quais partes outras pessoas podem alterar, e elas preenchem somente essas.

![Mantenha o master do Design, escolha entradas e limites em uma cópia de autoria e depois compartilhe uma ferramenta .lolly reutilizável que os destinatários preenchem](/info/diagrams/concepts/share-with-rules.svg)

[Share a design with rules](/info/create-a-tool.html) percorre cada etapa.

## Faça muitos, compartilhe e automatize

- <!--i:download--> **Exporte.** As ferramentas geram SVG, PDF, PNG, JPG, WebP, vídeo e mais, nos formatos que cada ferramenta oferece, em tamanhos reais de impressão quando você precisar. Veja [Export a file](/info/exporting.html).
- <!--i:link--> **Compartilhe um link.** As configurações de uma ferramenta viajam no link, então o link reabre o mesmo arquivo em qualquer lugar.
- <!--i:layers--> **Faça um por linha.** Conduza uma ferramenta a partir de uma planilha no [Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Automatize.** A mesma renderização roda pela [CLI](/info/cli.html) e por um [agente de IA](/info/ai-agents.html).

Um link é uma solicitação completa. Ninguém desenhou o gráfico abaixo: o tipo, o título e toda a tabela de dados foram digitados na barra de endereços, e o mesmo link desenha o mesmo gráfico em qualquer dispositivo.

![Um gráfico de área dos cadastros mensais, cujo cada valor chegou como um parâmetro de query em vez de um clique](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Para onde ir agora

- <!--i:people--> **[Create](/info/creators.html)**: criar, animar, gravar, compartilhar e exportar.
- <!--i:code--> **[Automate](/info/builders.html)**: sistemas de design, criação de ferramentas, linha de comando, links e agentes.
- <!--i:usercheck--> **[Manage](/info/operators.html)**: executar o Lolly para uma equipe com o Lolly Work.
- <!--i:server--> **[Deploy](/info/operate.html)**: hospedar o Lolly e o Lolly Work.
- <!--i:shieldcheck--> **[Trust](/info/trust.html)**: privacidade, segurança e como verificar um arquivo você mesmo.
