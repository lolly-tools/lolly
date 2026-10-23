# Batch e Multi-edit

Dois trabalhos surgem quando você produz o mesmo tipo de arquivo com frequência. Às vezes você precisa de muitas versões de um design: um cartão em uma dúzia de idiomas ou todos os tamanhos de um banner. Às vezes você tem vários designs salvos diferentes e quer que uma única mudança chegue a todos eles, como uma nova data ou um novo título.

O **Batch** faz o primeiro trabalho e o **Multi-edit** faz o segundo. Ambos rodam no seu dispositivo e exportam pelo mesmo caminho de renderização das próprias ferramentas.

::: cols
## Batch

- Um template, muitas linhas. Cada linha é um conjunto de entradas e gera um arquivo.
- Preencha as linhas digitando, colando de uma planilha ou importando um CSV.
- Sem limite de linhas; 50 aparecem por página.
- Abre em **Batch** no cabeçalho de Projects (`#/batch`).

## Multi-edit

- De dois a oito designs salvos diferentes, lado a lado como cartões ao vivo.
- Uma barra lateral edita as entradas que eles compartilham e depois as de cada cartão.
- Cada design é salvo de volta no lugar de onde veio.
- Abre em **Edit together** na barra de seleção de Projects.
:::

## Crie muitas versões de um design

Abra **Projects** e pressione **Batch** no cabeçalho. A grade começa com uma linha: escolha um template nela e depois duplique a linha ou cole dados da sua planilha. Quando aberto de dentro de uma pasta, o Batch devolve você a essa pasta.

![O Batch em uma grade nova: o nome do arquivo e as ferramentas de linha no topo, e a lista de templates da primeira linha aberta com as ferramentas que você pode escolher](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Preencha as linhas.** Digite em uma célula ou cole um bloco direto do Excel, Google Sheets ou outra planilha. **Import CSV** adiciona linhas ou substitui o lote. Quando você cola em uma célula que contém configurações de exportação, o Lolly pergunta qual entrada cada coluna colada preenche. **Export CSV** grava a grade de volta. Abra **Columns** abaixo da grade para mostrar mais entradas, ou largura, altura, unidade e DPI por linha.

**Defina a saída.** A barra de ferramentas define o nome do arquivo zip, o **Default format**, as unidades e o DPI de todas as linhas. O menu de formato é a lista agrupada do painel de exportação, mostrando os formatos que o catálogo oferece e que o seu navegador aceita. Uma linha com formato, tamanho ou nome de arquivo próprios mantém a própria configuração.

**Renderize.** **Render all** exporta todas as linhas em um único `.zip`. Selecione linhas antes e **Render selected**, **Export selected CSV** e **Print selected rows** agem apenas sobre elas; limpe a seleção para voltar a trabalhar com o lote inteiro. **Print sheet** organiza as linhas em uma folha imprimível. **Batch activity** informa cada importação e renderização, e se recolhe para dar mais espaço à tabela.

**Guarde o lote.** **Sessions** salva a grade inteira como uma sessão de lote nomeada, que reabre depois em Projects. Sessions sempre salva todas as linhas, seja qual for a seleção. **Folders…** no mesmo menu abre uma pasta inteira de Projects como linhas, uma por sessão salva, com o nome de cada arquivo levando o caminho da pasta.

::: details Selecionar linhas e células
Selecione linhas com as caixas de seleção ou use Shift-clique em uma caixa para um intervalo. A caixa do cabeçalho seleciona a página atual, e **Select all *N* rows** inclui também as linhas de outras páginas. As seleções permanecem enquanto você muda de página. **Edit input**, **Duplicate** e **Remove** agem sobre as linhas selecionadas, e **Undo remove** restaura as últimas linhas removidas. A partir de uma célula em foco, Shift+Space seleciona essa linha e Escape limpa a seleção.

Arraste por células, use Shift-clique em uma célula ou Shift+setas para selecionar um retângulo. **Copy cells**, ou Ctrl+C / Command+C, copia os valores para uma planilha. Ctrl+A / Command+A a partir de uma célula em foco seleciona todas as colunas visíveis em todas as páginas; a partir da caixa de seleção de uma linha, o mesmo atalho seleciona todas as linhas. Selecionar células mantém marcadas as linhas marcadas. Clique duas vezes em uma célula ou pressione Enter para editar o texto dela. Cole um retângulo da área de transferência, ou cole um valor para preencher todas as células selecionadas; células em branco e texto de várias linhas mantêm suas posições.
:::

### Variações de cores e temas por linha

Cada linha guarda as próprias escolhas de tema: claro ou escuro, e uma variação de cores quando o sistema de design as tem. Uma linha aberta a partir de Projects, de uma pasta ou de um lote salvo é renderizada com as escolhas em que a sessão dela foi salva, e a prévia abre com elas. A folha de impressão, uma linha duplicada e uma linha preenchida as mantêm.

Um CSV leva as escolhas em uma coluna `_themes` depois das colunas de tamanho, com o mesmo JSON do parâmetro de link `_themes`, por exemplo `{"":"dark","colourway":"beach"}`. Uma célula em branco, ou `{}`, significa os padrões do sistema de design. A coluna só é gravada quando alguma linha tem escolhas, então um lote sem nenhuma exporta o mesmo CSV de antes. Na importação, uma célula que não seja uma escolha de tema válida é listada como problema e a linha dela é renderizada com os padrões. A grade ainda não tem controle para mudar as escolhas de uma linha, então defina-as no CSV ou na sessão salva.

### Batch, ou Render folder

O Batch gera muitas variantes de um template. Para renderizar de novo sessões que você já salvou, selecione-as em Projects e use **Render selection**, ou **Render folder** para uma pasta inteira; [Find and recover your work](/info/find-your-work.html#find-something-you-saved) cobre as duas.

## Edite vários designs salvos juntos

Marque de duas a oito sessões salvas em **Projects** e escolha **Edit together** na barra de seleção. Elas abrem lado a lado como cartões ao vivo em `#/multi?s=<slot>,<slot>…`. Cada cartão é uma renderização real da sessão dele, então o que você vê é o que será exportado.

Uma barra lateral controla todos:

- <!--i:sliders--> **Shared** vem primeiro: cada entrada que duas ou mais sessões declaram da mesma forma (mesmo id, mesmo tipo, mesmas restrições, a regra que a grade do lote usa para as colunas). Edite um controle compartilhado uma vez e o valor chega a todas as sessões que declaram a entrada, ao vivo em cada cartão. Duas sessões da mesma ferramenta compartilham tudo; duas ferramentas diferentes compartilham apenas as entradas que têm em comum.
- <!--i:document--> Abaixo dele, **um cartão recolhido por sessão** guarda todas as entradas próprias dessa sessão, tão completas quanto a barra lateral da própria ferramenta, com um bloco de exportação compacto: **Format**, **W** / **H**, **Unit**, **DPI** e **Download**. Esse Download salva a sessão primeiro e depois renderiza o arquivo com o mesmo nome, formato e Content Credentials que teria a partir da ferramenta.
- <!--i:search--> **Filter inputs…** no topo restringe os controles de todos os cartões de uma vez, para você chegar a "o título" em oito sessões sem rolar.

Clique em qualquer cartão (ou pressione Enter nele) para abrir o cartão da barra lateral dessa sessão. **Save all** grava cada sessão de volta no próprio slot. **Download all** salva primeiro e depois renderiza o conjunto inteiro em um zip, do mesmo jeito que **Render selection** em Projects, com o bloqueio opcional por senha oferecido no caminho.

Cada cartão é desenhado com as escolhas de tema da própria sessão, inclusive uma ferramenta colocada dentro do design. Cartões com visuais diferentes ficam lado a lado enquanto o app ao redor mantém as próprias cores, e **Save all**, os downloads, **Batch grid** e **Send to Print Sheet** mantêm as escolhas de cada sessão.

### Limites

- **No máximo oito.** Cada cartão monta o próprio runtime ao vivo, e oito é o número que continua responsivo. Um link que peça mais, ou uma sessão que não existe mais, avisa isso em vez de carregar pela metade.
- **O link é local.** Ele nomeia os seus próprios slots salvos, então reabre esse conjunto neste dispositivo. Não é um link de compartilhamento.
- **Para algo maior,** escolha **Edit as sheet** na mesma barra de seleção. Ela abre toda a seleção como linhas na grade do lote (`#/batch?s=…`), sem limite de tamanho e sem a regra de mesma ferramenta. As pastas ficam fora dos dois: abra uma pasta na grade com **Sessions → Folders…**, ou renderize uma com **Render folder** em Projects.
- **A busca não alcança o Multi-edit.** É a única tela que a barra de busca não conhece.

## Para onde ir agora

- **[Export a file](/info/exporting.html)**: os formatos, tamanhos e configurações de impressão que cada linha pode usar.
- **[Templates](/info/templates.html)**: pontos de partida que dão uma boa primeira linha.
- **[Find and recover your work](/info/find-your-work.html)**: Projects, pastas e a renderização do que você salvou.
