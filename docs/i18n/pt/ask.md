# Ask Lolly

O Ask Lolly responde a uma pergunta com a seção correspondente destes guias, citada palavra por palavra, com a indicação da página e um link **Open in docs** para aquela seção. Nada é gerado: a resposta é encontrada e citada no seu dispositivo.

Abaixo da seção citada ficam os lugares do app que correspondem à pergunta: uma ferramenta, um utilitário, um projeto salvo, um recurso do catálogo, uma configuração ou uma página do app. Cada linha apenas navega. Nada em uma resposta muda uma configuração, abre um arquivo ou age por você, a mesma regra do [Lolly Search](/info/search.html).

<!--i:eti-chat-->
## Fazendo uma pergunta

Digite no campo de pergunta no rodapé da visão e pressione Enter. Qualquer texto com menos de dois caracteres é ignorado. As respostas se empilham acima do campo, com a mais recente por último.

![Ask Lolly, aberto e vazio: o campo de pergunta no rodapé da visão, com a nota de que as respostas vêm da documentação](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

::: note Cada pergunta é independente
As perguntas anteriores não passam contexto adiante, então "e quanto a PDF?" depois de uma pergunta sobre exportação é lida como uma pergunta apenas sobre PDF. Faça a pergunta completa a cada vez.
:::

A primeira palavra da sua pergunta determina o que vem primeiro na resposta:

| Você começa com | O que vem primeiro |
|---|---|
| *onde*, *encontrar*, *abrir*, *mostrar*, *ir para*, *irpara*, *levar*, *pular*, *navegar*, *alternar* | os lugares do app que correspondem |
| *fazer*, *criar*, *gerar*, *construir*, *desenhar*, *converter*, *redimensionar*, *comprimir*, *remover*, *limpar*, *exportar*, *renderizar*, *adicionar* | as ferramentas que correspondem |
| qualquer outra coisa - incluindo *como faço para* e *o que é* | a seção da documentação, que é o padrão |

As duas partes são sempre buscadas, então uma pergunta mal interpretada só muda a ordem da resposta.

A busca por correspondências descarta palavras comuns em perguntas (*como*, *faço*, *eu*, *o*, *meu*). Ela classifica uma seção por quantas das suas outras palavras ela cobre, depois por onde corresponderam: um título conta mais que o corpo do texto. A correspondência é por trecho de texto, ignorando maiúsculas, minúsculas e acentos, então um erro de digitação não é corrigido. Quando nada corresponde, o Ask informa isso e aponta para o índice da documentação.

**Better matching** é opcional. Depois da primeira resposta, o Ask pode oferecer um pequeno modelo de correspondência, com o tamanho do download. O modelo associa uma pergunta a um guia que usa palavras diferentes para a mesma coisa. Ele só é baixado quando você concorda, roda neste dispositivo e muda apenas quais seções ficam no topo da classificação. A resposta continua usando as próprias palavras da documentação. Você também pode baixá-lo como **Ask matching model** em **Settings → Preferences → Available offline** ([Disponível offline](/info/dashboard.html#available-offline)).

<!--i:eti-clipboard-->
## O que aparece na resposta

Um cartão de resposta tem uma ordem fixa:

1. **A própria seção**, renderizada a partir da fonte da documentação: parágrafos, listas, tabelas, código e citações, com links ativos para o app e `/info`. Uma seção longa termina em **Show more**, que abre o restante no mesmo lugar. As imagens são removidas, e um link para outro site aparece como texto simples.
2. **A citação** - *Página › Título* - e o link **Open in docs** para aquela seção exata.
3. **More in the docs** - até quatro outras seções correspondentes, como links.
4. **As linhas do app**, sob os mesmos títulos de grupo que o Search usa.

O texto completo vem da versão em markdown que cada página da documentação publica em `/info/<slug>.md`. Essas versões existem apenas em inglês. Em outro idioma, e nas poucas páginas que não são feitas a partir de markdown, a resposta mostra o trecho curto do índice de busca. A citação e o link **Open in docs** continuam apontando para a página no seu idioma.

<!--i:eti-map-pin-->
## Onde fica

A rota é `#/ask`. Ela não tem aba nem cartão na grade de Utilities. Você chega à visão pela barra de busca ou pelo endereço.

- <!--i:search--> **Pela busca.** Todo painel de resultados termina com uma linha **Ask Lolly: *sua consulta***, abaixo dos resultados dos outros grupos. A linha abre `#/ask?q=…`, e a visão faz a pergunta uma vez ao abrir. As palavras chegam em minúsculas e sem pontuação, então ajuste-as no campo de pergunta se precisar.
- <!--i:link--> **Por um link.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` abre a visão com aquela pergunta já feita. O fragmento do endereço só define a primeira pergunta. Perguntas que você digita depois são respondidas no mesmo lugar e nunca mudam o endereço.

A barra de busca fica oculta nesta visão porque o campo de pergunta usa Enter. A pílula de voltar leva você ao lugar de onde veio.

As respostas ficam durante esta sessão: continuam lá se você sair e voltar, e recarregar as apaga. Nada é gravado no armazenamento, então não há histórico para gerenciar.

<!--i:eti-download-->
## Offline

As respostas vêm de dois arquivos estáticos que o site da documentação publica: o índice de busca por idioma e a versão em markdown da página. Ambos são buscados pelo nome, então o Ask funciona sem conexão depois que estão no cache. Ler os guias no app os coloca no cache. **Guides & docs** em [Disponível offline](/info/dashboard.html#available-offline) baixa o site inteiro, incluindo capturas de tela, de uma vez.

Sem esses arquivos, a parte da documentação de uma resposta não aparece, e nenhum erro é exibido. As linhas do app continuam aparecendo, porque buscam correspondências nos dados que já estão no dispositivo.

<!--i:eti-lock-->
## Privacidade

Sua pergunta nunca sai do dispositivo. A busca por correspondências roda localmente sobre arquivos buscados pelo nome, então o que você digitou não faz parte de nenhuma requisição. Nenhum servidor vê sua pergunta, nenhuma conta a guarda e nenhum registro fica depois que você recarrega. A [Política de Privacidade](/info/privacy.html) lista tudo o que o app busca ou envia.

---

**Relacionado:** [Lolly Search](/info/search.html) para a barra que encaminha as perguntas. [Usando o Lolly](/info/using.html) para o restante do app. [Configurações do Lolly](/info/dashboard.html#available-offline) para primeiro disponibilizar a documentação offline.
