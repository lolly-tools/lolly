# Como o Lolly funciona

Uma ferramenta do Lolly reúne as regras para um tipo de arquivo: o layout, a tipografia, as cores e quais partes outras pessoas podem alterar. Você, um colega, um script ou um agente de IA preenchem os campos, e todos os arquivos seguem essas regras.

<!--i:eti-repeat-->
## Uma ferramenta, suas regras, muitos arquivos

As regras da marca ficam na ferramenta. Configure a ferramenta uma vez e cada resultado terá a mesma tipografia, cor e espaçamento, de um cartão a uma planilha com linhas em uma dúzia de idiomas.

![Uma ferramenta de logotipo com um campo preenchido: a tipografia, a cor e o espaçamento foram definidos quando a ferramenta foi criada](/info/shots/aud-rules-in-the-tool.svg)

Quem cria o centésimo arquivo só digita as palavras. Você decide como o trabalho é conferido e quem faz a conferência. O Lolly reduz o que precisa ser conferido e agiliza a criação do próximo arquivo.

<!--i:eti-users-->
## Quem usa uma ferramenta

Três funções em uma organização trabalham em um único cartão de campanha.

![Um designer define as regras uma vez em uma ferramenta; um desenvolvedor a executa por um script e qualquer pessoa pode preencher seus campos; ambos geram arquivos prontos](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Um designer define as regras.** Ele monta o cartão no Lolly Design com a tipografia e as cores da marca e escolhe quais campos ficam abertos. Faz isso uma vez, para que ninguém precise localizar o cartão manualmente de novo.
- <!--i:code--> **Um desenvolvedor amplia o uso da ferramenta.** A mesma ferramenta roda em um script noturno pela linha de comando. Um gráfico atualizado ou uma versão em outro idioma chega sem que ninguém reabra o design.
- <!--i:people--> **Qualquer pessoa preenche.** Um representante de vendas em um avião, sem rede e sem formação em design, abre a ferramenta e cria o cartão para a reunião de amanhã.
:::

O gráfico atualizado do desenvolvedor é uma renderização como esta, feita a partir de uma string de dados e algumas configurações:

![Um gráfico de áreas empilhadas com título e três séries em faixas de uma paleta fria, com eixos, legenda e título posicionados pelo template em vez de manualmente](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

A rapidez do representante depende das regras do designer e do script do desenvolvedor. Todas as funções trabalham com a mesma ferramenta.

<!--i:eti-train-->
## Quatro caminhos para um arquivo

Cada caminho executa o mesmo mecanismo na mesma ferramenta, então o arquivo gerado por um script corresponde ao que você vê na prévia do app.

![Parâmetros de URL e argumentos de linha de comando se tornam o mesmo modelo de entrada, processado por um único ambiente de execução compartilhado e uma ponte de exportação](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **No app, um de cada vez.** Abra uma ferramenta, preencha os campos e pressione **Export**. [Criar seu primeiro arquivo](/info/make-something.html) guia você pelo processo.
- <!--i:layers--> **No app, vários de uma vez.** O [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) recebe uma tabela colada ou importada e renderiza um arquivo pronto por linha.
- <!--i:cpu--> **Por um script ou agente de IA.** A [CLI](/info/cli.html) executa uma ferramenta sem interface gráfica, e o [servidor MCP](/info/mcp.html) permite que um agente descubra e execute ferramentas. Um link para uma ferramenta também carrega suas entradas, então um link é uma solicitação completa.
- <!--i:server--> **Pelo servidor da sua organização.** O [Lolly Work](/info/organisation.html) renderiza no servidor conforme a política de login e ferramentas da sua organização, mantém tarefas que pode retomar e guarda o resultado para download ou entrega aprovada.

O caminho que uma tarefa pode usar depende dos formatos da ferramenta e dos recursos do ambiente que a executa. Alguns formatos precisam de um navegador, então a linha de comando os encaminha a uma camada de navegador. [Renderizar com a CLI](/info/cli-rendering.html) lista quais formatos são renderizados em cada lugar.

<!--i:eti-monitor-->
## O que roda onde

A criação, a edição e a exportação rodam no seu dispositivo, sem conta. Um recurso que precisa de um servidor, como o Sync ou o envio de um arquivo a um serviço conectado, só se conecta quando você o usa. Com o Lolly Work, projetos compartilhados, edição ao vivo em equipe, aprovações e tarefas no servidor usam o servidor da sua organização. [O que roda onde](/info/compare.html#what-runs-where) coloca as duas partes lado a lado.

<!--i:eti-graduation-cap-->
## Leia a seguir

- [Criar seu primeiro arquivo](/info/make-something.html), para experimentar agora.
- [Começar](/info/quickstart.html), para inserir seu próprio sistema de design.
- [Automatizar](/info/builders.html), para a linha de comando, links e agentes.
- [Arquitetura do Lolly](/info/overview.html), para colaboradores: o mecanismo, as interfaces e as regras que os integram.
