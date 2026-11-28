# Comece

Configure suas ferramentas com suas próprias cores e fontes e reutilize o trabalho que você já tem. Você não precisa de conta, e a criação e a exportação rodam no seu dispositivo.

::: steps
- <!--i:eti-sparkles--> **[Crie um arquivo](/info/make-something.html)** Um QR code em poucos minutos, com cada passo mostrado.
- <!--i:eti-palette--> **[Adicione sua marca](#put-your-brand-in)** Comece com uma cor, um arquivo de tokens ou um design pronto.
- <!--i:eti-folder-move--> **[Traga seu trabalho](#bring-in-what-you-already-have)** Designs, decks e dados que você já tem, lidos no seu dispositivo.
- <!--i:eti-repeat--> **[Crie mais do mesmo](#make-many-share-and-automate)** Compartilhe um link, preencha uma planilha ou execute a ferramenta a partir de um script.
:::

[O que é o Lolly?](/info/what-is-lolly.html) é uma introdução de cinco minutos. [Como o Lolly funciona](/info/how-lolly-works.html) mostra quem faz o quê.

<!--i:eti-palette-->
## Adicione sua marca

lolly.tools abre no **Lolly Demo**, o sistema de design de exemplo do próprio Lolly ([Conheça o Lolly Demo](/info/lolly-demo.html)). Seu sistema de design substitui o Lolly Demo. Ele é um pequeno conjunto de tokens de design (cores, fontes e algumas regras) com os quais todas as ferramentas desenham. Configure uma vez, e tudo o que você cria já começa seguindo sua marca.

Escolha o caminho que corresponde ao que você tem:

- <!--i:palette--> **Uma cor.** Abra a visualização **Design System Setup** (`#/start`), dê um nome ao seu sistema de design e escolha uma cor primária. O Lolly deriva uma paleta acessível dessa cor, com superfícies claras e escuras, texto e destaques. Escolha uma fonte e você terá uma marca pronta para usar.
- <!--i:upload--> **Um arquivo de tokens.** **Add from…**, no topo do Lolly Design System Setup, aceita um arquivo de tokens DTCG, Tokens Studio ou Penpot, um SVG ou um pacote `LollyBrand`. A paleta é preenchida a partir do arquivo. Enquanto o sistema de design está vazio, **Start from a reference**, no Board, abre o mesmo seletor.
- <!--i:pentool--> **Um design pronto.** No Lolly Design, escolha **Import a design** e solte um arquivo Figma, Penpot, Illustrator, InDesign, Affinity, Photoshop, PowerPoint ou SVG ([todos os formatos](/info/design-import.html#what-comes-in-from-each-app)). Veja [Traga o que você já tem](#bring-in-what-you-already-have) abaixo.

Na primeira vez que você abre a galeria, uma saudação no topo oferece um próximo passo. Em lolly.tools, **Start making** abre o Lolly Design no pôster Launch. Em uma instalação nova, **Make it yours** abre o Lolly Design System Setup. Abaixo desse botão, **Bring a file** abre um seletor de arquivos para um design, e a outra dessas duas opções aparece como link. Qualquer uma delas, ou o botão de fechar, dispensa a saudação de vez.

![A sala Colours do Lolly Design System Setup em um sistema de design novo: uma amostra ao vivo, um campo e toda a primeira decisão](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-colours-new-system)

Oito salas, usadas em qualquer ordem, levam o sistema de design adiante: **Board**, **Colours**, **Type**, **Logos**, **Tokens**, **Files**, **Rules** e **Skills**. Cada prévia no app se atualiza enquanto você digita. [Lolly Design System Setup](/info/brand-studio.html) cobre cada sala.

As fontes ficam no seu dispositivo. Uma Google Font que você escolhe é armazenada como recurso da marca, então sua tipografia funciona offline e nada é buscado quando uma ferramenta desenha.

### Veja, troque e compartilhe um sistema de design

- **Veja o ativo.** **Settings → Design system** mostra o sistema de design ativo como uma capa e páginas, somente para leitura.
- **Troque entre eles.** **Settings → Preferences → Design systems** lista todos os sistemas de design neste dispositivo. Uma organização pode operar vários sistemas de design, ou um com várias variações de cores. [Arquiteturas de marca](/info/brand-architectures.html) mapeia as configurações.
- **Compartilhe um.** Exporte o sistema de design como um pacote `LollyBrand`: um arquivo que um colega importa para ter a mesma paleta, fontes e regras.

Um sistema de design fornecido pela sua distribuição ou organização é **gerenciado**: exibe um cadeado e fica somente para leitura. Para alterá-lo, crie uma cópia editável em **Settings → Preferences → Design systems**.

![A aba Design system em Settings: o sistema de design ativo como capa e páginas](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Seu sistema de design é composto por tokens DTCG, o formato que o Penpot lê e grava e que o Tokens Studio leva ao Figma. A paleta com que você cria e a paleta que o Lolly aplica são um só documento. [Tokens de design](/info/design-tokens.html) traz os detalhes.

::: details Para desenvolvedores: crie um pacote de marca pela linha de comando
`ingest:brand` cria um pacote de marca reutilizável em uma cópia local do repositório. Aceita os três contêineres que o Penpot e o Tokens Studio exportam: um único `tokens.json`, um diretório de arquivos por conjunto com `$metadata.json` ou um arquivo `project.penpot`.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` registra a marca como um perfil, gera seu catálogo e o valida. Nunca altera o perfil padrão: execute com `LOLLY_PROFILE=acme` para usar o novo pacote. [Configuração](/info/configuration.html) explica como os pacotes de marca e os perfis se relacionam.
:::

<!--i:eti-folder-move-->
## Traga o que você já tem

**Arquivos do Lolly Design.** Trabalhos prontos do Figma, Penpot, Illustrator, InDesign ou qualquer app de SVG abrem no Lolly Design como layouts editáveis. O texto continua editável, as formas continuam sendo formas e as imagens vão para sua biblioteca. O arquivo é lido no seu navegador e nada é enviado. [Importar um design](/info/design-import.html) lista cada formato e o que é mantido.

**Decks.** Solte um `.pptx` do PowerPoint no Lolly para guardar seus slides como recursos. Escreva um novo deck a partir de Markdown no **Lolly Markdown Slides**. [Aplicar sua marca a um deck](/info/rebrand.html) adapta um deck ao seu sistema de design.

**Dados.** Cole ou solte uma tabela CSV ou JSON para preencher os campos repetidos de uma ferramenta. O [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) gera um arquivo pronto por linha.

### De uma peça avulsa a um template

Um layout importado é uma sessão comum do Lolly Design. **Share with rules** transforma a sessão em uma ferramenta. Você escolhe quais partes outras pessoas podem alterar, e elas preenchem apenas essas partes.

![Mantenha o original do Lolly Design, escolha entradas e limites em uma cópia de autoria e compartilhe uma ferramenta .lolly reutilizável que os destinatários preenchem](/info/diagrams/concepts/share-with-rules.svg)

[Compartilhar um design com regras](/info/create-a-tool.html) explica cada etapa.

<!--i:eti-repeat-->
## Crie em quantidade, compartilhe e automatize

- <!--i:download--> **Exporte.** As ferramentas geram SVG, PDF, PNG, JPG, WebP, vídeo e outros formatos, em tamanhos reais de impressão quando necessário. Cada ferramenta oferece seus próprios formatos. Veja [Exportar um arquivo](/info/exporting.html).
- <!--i:link--> **Compartilhe um link.** As configurações de uma ferramenta acompanham seu link, que reabre o mesmo arquivo em qualquer lugar.
- <!--i:layers--> **Crie um por linha.** Use uma planilha para alimentar uma ferramenta no [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Automatize.** A mesma renderização é executada pela [CLI](/info/cli.html) e por um [agente de IA](/info/ai-agents.html).

Um link é uma solicitação completa. O tipo, o título e a tabela de dados do gráfico abaixo foram digitados na barra de endereços.

![Um gráfico de barras de cadastros mensais por canal nas cores do sistema de design, com cada valor recebido como parâmetro de consulta em vez de um clique](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26sty%3Dposter%26pl%3Droles%26transparentBg%3Dfalse%26d%3DMonth%2CWeb%2CApp%2CPartners%250AJan%2C120%2C60%2C25%250AFeb%2C180%2C95%2C40%250AMar%2C265%2C150%2C70%250AApr%2C340%2C210%2C110%250AMay%2C455%2C290%2C160%250AJun%2C560%2C380%2C230%26t%3DSignups%2520this%2520year%26st%3DBy%2520channel%252C%2520January%2520to%2520June%26full&width=1440&height=900&dpi=192&waitMs=4000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

<!--i:eti-map-pin-->
## Para onde ir agora

- <!--i:people--> **[Criar](/info/creators.html)**: criação, animação, gravação, compartilhamento e exportação.
- <!--i:code--> **[Automatizar](/info/builders.html)**: sistemas de design, autoria de ferramentas, linha de comando, links e agentes.
- <!--i:usercheck--> **[Gerenciar](/info/operators.html)**: operação do Lolly para uma equipe com o Lolly Work.
- <!--i:server--> **[Implantar](/info/operate.html)**: hospedagem do Lolly e do Lolly Work.
- <!--i:shieldcheck--> **[Confiar](/info/trust.html)**: privacidade, segurança e verificação de arquivos por conta própria.
