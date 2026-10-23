# Como o Lolly funciona

Uma ferramenta do Lolly guarda as regras de um tipo de arquivo: o layout, a tipografia, as cores e quais partes outras pessoas podem alterar. Você, um colega, um script ou um agente de IA preenchem os campos, e todo arquivo sai certo. Esta página mostra quem faz o quê e os quatro caminhos de uma ferramenta até um arquivo pronto.

## Uma ferramenta, as suas regras, muitos arquivos

As regras da marca ficam na ferramenta, não em cada arquivo que ela gera. Acerte a ferramenta uma vez e todo resultado herda a mesma tipografia, as mesmas cores e o mesmo espaçamento, seja um cartão ou uma planilha de linhas em uma dúzia de idiomas.

![Uma ferramenta de logotipo com um campo preenchido: tipografia, cor e espaçamento foram definidos quando a ferramenta foi criada](/info/shots/aud-rules-in-the-tool.svg)

Quem faz o centésimo arquivo só digita as palavras. Como você confere o trabalho, e quem confere, continua sendo decisão sua. O Lolly torna menor o que vale a pena conferir e mais rápido o próximo arquivo.

## Quem mexe em uma ferramenta

Acompanhe um cartão de campanha dentro de uma organização e três pares de mãos aparecem. Cada um se apoia no anterior.

![Um designer define as regras uma vez em uma ferramenta; um desenvolvedor a executa a partir de um script e qualquer pessoa pode preencher os campos; ambos geram arquivos prontos](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Um designer define as regras.** Ele monta o cartão no Design com a tipografia e as cores da marca e depois escolhe quais campos ficam abertos. Faz isso uma vez, para que ninguém localize o cartão à mão de novo.
- <!--i:code--> **Um desenvolvedor escala a ferramenta.** A mesma ferramenta roda em um script noturno pela linha de comando, então um gráfico novo ou uma versão em outro idioma chega sem que ninguém reabra o design.
- <!--i:people--> **Qualquer pessoa preenche.** Um vendedor em um avião, sem rede e sem formação em design, abre a ferramenta e cria o cartão para a reunião de amanhã.
:::

O gráfico novo na etapa do desenvolvedor é uma renderização como esta, feita a partir de um texto de dados e de algumas configurações, sem que ninguém abra um arquivo de design:

![Um gráfico de área empilhada com título, suas três séries em faixas de uma paleta fria, com eixos, legenda e título todos posicionados pelo template, e não à mão](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

O minuto fácil do vendedor só é possível graças ao cuidado do designer e ao script do desenvolvedor. Cada função trabalha com a mesma ferramenta, em vez de um produto separado para cada uma.

## Quatro caminhos até um arquivo

Todo caminho roda o mesmo motor na mesma ferramenta, então o arquivo que um script gera é igual ao que você visualiza no app.

![Parâmetros de URL e argumentos de linha de comando viram o mesmo modelo de entradas, executado por um único runtime e uma única ponte de exportação](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **No app, um de cada vez.** Abra uma ferramenta, preencha os campos e pressione **Export**. [Make your first file](/info/make-something.html) guia você por um.
- <!--i:layers--> **No app, muitos de uma vez.** O [Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) recebe uma tabela colada ou importada e renderiza um arquivo pronto por linha.
- <!--i:cpu--> **Por um script ou agente de IA.** A [CLI](/info/cli.html) executa uma ferramenta sem interface, e o [servidor MCP](/info/mcp.html) permite que um agente descubra e execute ferramentas. Um link para uma ferramenta também carrega as entradas dela, então um link é uma solicitação completa.
- <!--i:server--> **Pelo servidor da sua organização.** O [Lolly Work](/info/organisation.html) renderiza no servidor sob o login e a política de ferramentas da sua organização, mantém trabalhos que ele pode retomar e guarda a saída para download ou entrega aprovada.

O caminho que um trabalho pode usar depende dos formatos da ferramenta e do que o host consegue fazer: alguns formatos exigem um navegador, então a linha de comando os passa para um nível de navegador. [Render with the CLI](/info/cli-rendering.html) lista quais formatos são renderizados onde.

## O que roda onde

Criar, editar e exportar rodam no seu dispositivo, sem conta. Um recurso que precisa de servidor, como o Sync ou o envio de um arquivo a um serviço conectado, só se conecta quando você usa esse recurso. Com o Lolly Work, projetos compartilhados, edição ao vivo em equipe, aprovações e trabalhos de servidor usam o servidor da sua organização. [What runs where](/info/compare.html#what-runs-where) coloca as duas partes lado a lado.

## Leia a seguir

- [Make your first file](/info/make-something.html), para experimentar agora.
- [Start](/info/quickstart.html), para colocar o seu próprio sistema de design.
- [Automate](/info/builders.html), para linha de comando, links e agentes.
- [Lolly architecture](/info/overview.html), para colaboradores: o motor, os shells e as regras que os mantêm unidos.
