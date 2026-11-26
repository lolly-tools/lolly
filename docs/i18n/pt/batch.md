# Lolly Batch e Lolly Multi-edit

<a id="batch-and-multi-edit"></a>

**Lolly Batch** cria muitas versões de um design, como um cartão em uma dúzia de idiomas ou todos os tamanhos de um banner. **Lolly Multi-edit** faz uma alteração, como uma nova data ou título, em vários designs salvos diferentes.

Ambos rodam no seu dispositivo e exportam pelo mesmo caminho de renderização das ferramentas.

::: cols
## Batch

- Um template, muitas linhas. Cada linha é um conjunto de entradas e gera um arquivo.
- Preencha as linhas digitando, colando de uma planilha ou importando um CSV.
- Sem limite de linhas; 50 aparecem por página.
- Abre em **Lolly Batch** no cabeçalho de Projects (`#/batch`).

<a id="multi-edit"></a>
## Lolly Multi-edit

- De dois a oito designs salvos diferentes, lado a lado como cartões ao vivo.
- Uma barra lateral edita as entradas que eles compartilham, depois as de cada cartão.
- Cada design é salvo de volta no lugar de onde veio.
- Abre em **Edit together** na barra de seleção de Projects.
:::

<!--i:eti-table-->
## Crie muitas versões de um design

Abra a visão **Projects** e pressione **Batch** no cabeçalho. A grade começa com uma linha. Escolha um template nessa linha e depois duplique a linha ou cole dados de uma planilha. Quando aberto de dentro de uma pasta, o Batch leva você de volta a essa pasta.

![Batch em uma grade nova: o nome do arquivo e as ferramentas de linha no topo, e a lista de templates da primeira linha aberta nas ferramentas que você pode escolher](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Preencha as linhas.** Digite em uma célula ou cole um bloco do Excel, Google Sheets ou outra planilha. **Import CSV** adiciona linhas ou substitui o lote. Quando você cola em uma célula que contém configurações de exportação, o Lolly pergunta qual entrada cada coluna colada preenche. **Export CSV** grava a grade em um arquivo. Abra **Columns** abaixo da grade para mostrar mais entradas, ou largura, altura, unidade e DPI por linha. O popover **Fill** de uma coluna de números, texto ou opções também tem uma seção **Design token** que vincula um token às linhas da coluna ([Vincular muitos documentos de uma vez](/info/token-workflows.html#link-many-documents-at-once)).

**Defina a saída.** A barra de ferramentas define o nome do arquivo zip, o **Default format**, as unidades e o DPI para todas as linhas. O menu de formatos é a lista agrupada do painel de exportação com os formatos que o catálogo oferece e seu navegador suporta. Uma linha com formato, tamanho ou nome de arquivo próprio mantém sua configuração.

**Renderize.** **Render all** exporta todas as linhas para um único `.zip`. Com linhas selecionadas, **Render selected**, **Export selected CSV** e **Print selected rows** agem apenas nessas linhas. Limpe a seleção para voltar a trabalhar no lote inteiro. **Print sheet** organiza as linhas em uma folha para impressão. **Batch activity** informa cada importação e renderização, e pode ser recolhido.

**Guarde o lote.** **Sessions** salva todas as linhas da grade como uma sessão de lote nomeada, seja qual for a seleção. A sessão reabre em Projects. **Folders…** no mesmo menu abre uma pasta de Projects como linhas, uma por sessão salva; cada nome de arquivo inclui o caminho da sua pasta.

::: details Selecionar linhas e células
Selecione linhas pelas caixas de seleção, ou clique em uma caixa com Shift para selecionar um intervalo. A caixa de seleção do cabeçalho seleciona a página atual, e **Select all *N* rows** inclui também as linhas de outras páginas. As seleções se mantêm quando você muda de página. **Edit input**, **Duplicate** e **Remove** agem nas linhas selecionadas, e **Undo remove** restaura as últimas linhas removidas. Com o foco em uma célula, Shift+Space seleciona aquela linha e Escape limpa a seleção.

Arraste sobre as células, clique em uma célula com Shift ou use Shift+teclas de seta para selecionar um retângulo. **Copy cells**, ou Ctrl+C / Command+C, copia os valores para uma planilha. Ctrl+A / Command+A com o foco em uma célula seleciona todas as colunas visíveis em todas as páginas; com o foco na caixa de seleção de uma linha, o mesmo atalho seleciona todas as linhas. Selecionar células mantém as linhas marcadas. Dê um clique duplo em uma célula ou pressione Enter para editar seu texto. Cole um retângulo da área de transferência, ou cole um valor para preencher todas as células selecionadas; células em branco e texto com várias linhas mantêm suas posições.
:::

### Variações de cores e temas por linha

Cada linha mantém suas próprias escolhas de tema: claro ou escuro, e uma variação de cores quando o sistema de design oferece opções. Uma linha aberta de Projects, de uma pasta ou de um lote salvo é renderizada e exibida na prévia com as escolhas usadas ao salvar sua sessão. A folha de impressão, uma linha duplicada e uma linha preenchida mantêm essas escolhas.

Um CSV leva as escolhas em uma coluna `_themes` depois das colunas de tamanho. A coluna tem o mesmo JSON do parâmetro de link `_themes`, por exemplo `{"":"dark","colourway":"beach"}`. Uma célula em branco, ou `{}`, significa os padrões do sistema de design. A coluna só é gravada quando alguma linha tem escolhas. Na importação, uma célula que não contém escolhas de tema válidas é listada como um problema e sua linha é renderizada com os padrões.

::: note Defina as escolhas de uma linha no CSV
A grade ainda não tem controle para mudar as escolhas de uma linha, então defina-as no CSV ou na sessão salva.
:::

### Um idioma para cada linha

Uma ferramenta que imprime seu próprio texto, como Certificate, pode receber uma coluna `language` com um código curto de idioma, como `de`, `ja` ou `ar`. Cada linha então imprime seu texto e sua data nesse idioma. Linhas em árabe e urdu são dispostas da direita para a esquerda. Uma célula em branco segue o idioma do app. Um idioma para o qual o Lolly ainda não tem tradução imprime em inglês, inclusive a data, para que um certificado nunca fique traduzido pela metade.

### Batch ou Render folder

Para renderizar de novo sessões que você já salvou, selecione-as em Projects e use **Render selection**, ou **Render folder** para uma pasta inteira. [Encontre e recupere seu trabalho](/info/find-your-work.html#find-something-you-saved) cobre ambos.

<!--i:eti-layers-->
## Edite vários designs salvos juntos

Marque de duas a oito sessões salvas em **Projects** e escolha **Edit together** na barra de seleção. Elas abrem lado a lado como cartões ao vivo em `#/multi?s=<slot>,<slot>…`. Cada cartão é uma renderização real da sua sessão e mostra o que será exportado.

Uma barra lateral controla todos:

- <!--i:sliders--> **Shared** vem primeiro: todas as entradas que duas ou mais sessões declaram da mesma forma (mesmo id, tipo e restrições, a regra que a grade de lotes usa para suas colunas). Uma alteração em um controle compartilhado alcança todas as sessões que declaram a entrada, ao vivo em cada cartão. Duas sessões da mesma ferramenta compartilham tudo; duas ferramentas diferentes compartilham apenas as entradas em comum. O menu **Input actions** do cartão Shared vincula um token de design em cada sessão que declara a entrada.
- <!--i:document--> Abaixo do cartão Shared, **um cartão recolhido por sessão** contém todas as entradas próprias daquela sessão, como na barra lateral da ferramenta, com um bloco de exportação compacto: **Format**, **W** / **H**, **Unit**, **DPI** e **Download**. Esse Download salva a sessão primeiro e depois renderiza o arquivo com o mesmo nome, formato e Content Credentials que teria na ferramenta.
- <!--i:search--> **Filter inputs…** no topo filtra os controles de todos os cartões de uma vez.

Clique em qualquer cartão (ou pressione Enter no cartão) para abrir o cartão daquela sessão na barra lateral. **Save all** grava cada sessão de volta no seu próprio espaço. **Download all** salva primeiro, depois renderiza o conjunto em um único zip, como **Render selection** faz em Projects, e oferece o bloqueio opcional por senha.

Cada cartão é desenhado com as escolhas de tema da própria sessão, inclusive uma ferramenta inserida no design. O app ao redor dos cartões mantém suas próprias cores. **Save all**, os downloads, **Batch grid** e **Send to Print Sheet** mantêm as escolhas de cada sessão.

### Limites

- **No máximo oito.** Cada cartão carrega seu próprio ambiente de execução ao vivo, e oito cartões continuam respondendo bem. Um link que pede mais, ou uma sessão que não existe mais, informa isso e não carrega pela metade.
- **O link é local.** Ele identifica seus próprios espaços salvos e reabre aquele conjunto neste dispositivo. Não é um link de compartilhamento.
- **Para conjuntos maiores,** escolha **Edit as sheet** na mesma barra de seleção. Isso abre a seleção como linhas na grade de lotes (`#/batch?s=…`), sem limite de tamanho e sem exigir a mesma ferramenta. Pastas ficam fora dos dois: abra uma pasta na grade com **Sessions → Folders…**, ou renderize uma com **Render folder** em Projects.
- **A busca não alcança o Lolly Multi-edit.** É a única visão que a barra de busca não cobre.

<!--i:eti-map-pin-->
## Para onde ir agora

- **[Exportar um arquivo](/info/exporting.html)**: os formatos, tamanhos e configurações de impressão que cada linha pode usar.
- **[Templates](/info/templates.html)**: pontos de partida que dão uma boa primeira linha.
- **[Encontre e recupere seu trabalho](/info/find-your-work.html)**: Projects, pastas e renderização do que você salvou.
