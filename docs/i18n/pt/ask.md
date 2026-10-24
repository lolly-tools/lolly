# Ask Lolly

Digite uma pergunta e o Ask Lolly responde com a seção destes guias que a cobre, palavra por palavra, com a página de onde veio citada e um link **Open in docs** direto para essa seção. Nada é gerado: a resposta é recuperada, citada e atribuída, no seu dispositivo.

Sob a seção citada ficam os lugares do app que combinam com a mesma pergunta: uma ferramenta, um utilitário, um projeto salvo, um recurso do catálogo, uma configuração ou uma página do app. Cada linha apenas navega. Nada em uma resposta altera uma configuração, abre um arquivo ou age por você, a mesma regra que a [Search](/info/search.html) segue.

## Fazer uma pergunta

Digite no campo de pergunta no rodapé da tela e pressione Enter. Qualquer texto com menos de dois caracteres é ignorado. As respostas se empilham acima do campo, a mais nova por último, e você pode continuar perguntando.

![O Ask Lolly, aberto e vazio: o campo de pergunta no rodapé da tela, com a nota de que as respostas vêm da documentação](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

Cada pergunta é respondida isoladamente: as perguntas anteriores não carregam contexto, então "e o PDF?" depois de uma pergunta sobre exportação é lida como uma pergunta sobre PDF e nada mais. Faça a pergunta inteira a cada vez.

A primeira palavra da sua pergunta decide o que abre a resposta:

| Você começa com | O que vem primeiro |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *goto*, *take*, *jump*, *navigate*, *switch* | os lugares do app que combinam |
| *make*, *create*, *generate*, *build*, *design*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | as ferramentas que combinam |
| qualquer outra coisa - incluindo *how do I* e *what is* | a seção da documentação, que é o padrão |

As duas metades são sempre recuperadas, então uma pergunta mal interpretada reordena a resposta em vez de perder metade dela.

A busca descarta as palavras de pergunta comuns (*how*, *do*, *I*, *the*, *my*) e classifica uma seção pelo número de palavras restantes que ela cobre e depois pelo lugar onde combinaram: um título pesa mais que o corpo do texto. A busca é por trecho de texto, sem diferenciar maiúsculas e acentos, então um erro de digitação não é corrigido. Quando nada combina, o Ask diz isso e aponta para o índice da documentação em vez de inventar uma resposta.

A **Better matching** é opcional. Depois da sua primeira resposta, o Ask pode oferecer um pequeno modelo de correspondência, com o tamanho do download, que ajuda a ligar uma pergunta a um guia que usa outras palavras para a mesma coisa. Ele só é baixado quando você concorda, roda neste dispositivo e apenas muda quais seções aparecem primeiro: a resposta continua sendo as palavras da própria documentação. Você também pode baixá-lo em **Settings → Preferences → Available offline**, onde aparece como **Ask matching model** ([Available offline](/info/dashboard.html#available-offline)).

## O que volta

Um cartão de resposta é montado em uma ordem fixa:

1. **A própria seção**, renderizada a partir da fonte da documentação - parágrafos, listas, tabelas, código e citações, com os links do app e de `/info` ativos. Uma seção longa é limitada por um **Show more** que a abre no próprio lugar. As imagens são descartadas, e um link para outro site é exibido como texto simples, não como âncora.
2. **A citação** - *Página › Título* - e o link **Open in docs** para essa seção exata.
3. **More in the docs** - até quatro outras seções que combinaram, como links.
4. **As linhas do app**, sob os mesmos títulos de grupo que a Search usa.

O texto completo vem do gêmeo em markdown simples que cada página da documentação publica em `/info/<slug>.md`, e esses gêmeos existem somente em inglês. Em outro idioma - e nas poucas páginas que não são geradas a partir de markdown - a resposta recorre ao breve trecho guardado no índice de busca, em vez da seção inteira. A citação e o link **Open in docs** existem de qualquer forma, apontando para a página no seu idioma.

## Onde fica

A rota é `#/ask`. Ela não tem aba nem bloco na grade de Utilities; as formas de chegar são a barra de busca e o próprio endereço.

- <!--i:search--> **Pela busca.** Todo painel de resultados traz uma linha **Ask Lolly: *your query*** bem no final, sob os resultados concretos que os outros grupos encontraram. Ela repassa a pergunta como `#/ask?q=…`, e a tela faz a pergunta uma vez ao chegar. As palavras repassadas chegam em minúsculas e sem pontuação, então refine-as no campo de pergunta se precisar.
- <!--i:link--> **Por um link.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` abre a tela com essa pergunta já feita. O hash é apenas a semente de entrada: as perguntas que você digita depois são respondidas no lugar e nunca reescrevem o endereço.

A barra de busca sai de cena dentro desta tela, já que o campo de pergunta usa o Enter, e o botão de voltar leva você de volta a onde estava.

As respostas na tela duram esta sessão: continuam ali se você navegar para outro lugar e voltar, e recarregar as limpa. Nada é gravado no armazenamento, então não há histórico para gerenciar.

## Offline

As respostas são montadas a partir de dois arquivos estáticos que o site da documentação já publica: o índice de busca por idioma e o gêmeo em markdown da página. Ambos são buscados pelo nome, então o Ask continua funcionando sem conexão depois que estão em cache. Ler os guias no app os coloca em cache conforme você avança, e **Guides & docs** em [Available offline](/info/dashboard.html#available-offline) leva o site inteiro, capturas de tela incluídas, em um único download.

Sem eles, a metade da documentação de uma resposta simplesmente não aparece, sem erro. As linhas do app continuam aparecendo, porque são comparadas com dados que já estão no dispositivo.

## Privacidade

Sua pergunta nunca sai do dispositivo. A correspondência roda localmente sobre arquivos buscados pelo nome, então o que você digitou não faz parte de nenhuma requisição; não há servidor que a veja, conta a que ela se associe nem registro dela depois que você recarrega. Veja a [Política de Privacidade](/info/privacy.html) para a lista completa do que o app busca ou envia.

---

**Relacionado:** [Search](/info/search.html) para a barra que repassa as perguntas. [Using Lolly](/info/using.html) para o resto do app. [Settings](/info/dashboard.html#available-offline) para levar a documentação offline antes.
