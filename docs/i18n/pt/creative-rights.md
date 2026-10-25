# Direitos criativos e créditos

Você deveria poder usar um bom trabalho feito por outras pessoas sem virar especialista em licenciamento e sem deixar de lado, em silêncio, as pessoas que fizeram o trabalho. Por isso o Lolly guarda a origem de cada obra que usa, lê a licença registrada para ela, descobre o que essa licença pede do uso que você realmente faz, faz a parte que um programa pode fazer e diz a você a parte que só você pode fazer.

Nada disso é aconselhamento jurídico, e nada disso é uma decisão sobre o seu projeto. O Lolly registra fatos, aplica um pequeno conjunto de regras lidas nos próprios textos legais das licenças e mostra o seu raciocínio. Uma licença com condições é uma escolha normal e permitida. Nunca é apresentada como um recurso quebrado.

## Onde você encontra isto

Os conjuntos de emoji são o caso do dia a dia. O Twemoji é CC BY 4.0, então um título com um emoji é exportado com a arte creditada e nada para você fazer. Os dois conjuntos OpenMoji são CC BY-SA 4.0, então recolorir um dos glifos deles com um tratamento de marca é uma adaptação, e compartilhar essa adaptação pede que você escolha uma licença compatível uma vez. Fluent (MIT), Noto e Blobmoji (ambos Apache 2.0) também estão registrados, e cada um é resolvido pela própria licença revisada.

Escolher um conjunto nunca é bloqueado, e o controle do conjunto mostra a licença onde você escolhe. As mesmas regras respondem por uma ilustração do catálogo, uma LUT, uma fonte e qualquer outra obra registrada.

## Três fatos, mantidos separados

"CC BY 4.0", "este uso precisa de um crédito" e "o crédito está no arquivo que você acabou de baixar" são três afirmações diferentes, e o Lolly as mantém separadas:

- **Evidence** é o que uma origem declarou, registrado como foi encontrado, com quem o disse e onde foi lido. Uma importação posterior nunca sobrescreve um registro anterior.
- **Obligation** é o que as regras revisadas fazem dessa evidência para um uso, uma rota de entrega e um público. As condições que se aplicam no compartilhamento continuam condicionais enquanto você trabalha em privado.
- **Delivery** é o que os bytes finais realmente carregam, medido lendo-os de volta. O Lolly só diz que os créditos estão incluídos depois que um leitor os encontrou no arquivo entregue.

![A evidência de origem registrada e o uso escolhido alimentam regras revisadas. A exportação prepara os créditos e então uma verificação de entrega lê os bytes finais para informar quais créditos foram encontrados ou ainda são necessários.](/info/diagrams/concepts/rights-evidence-to-delivery.svg)

## O que você vê e o que fazer

As mesmas palavras aparecem no painel de exportação, no Verify, na linha de comando e no resultado de máquina, aproximadamente na ordem de frequência com que você as encontrará.

| O que você vê | O que significa |
|---|---|
| Source credits will be included. | O crédito está preparado e a rota consegue levar o crédito. Nada foi gravado ainda, então esta não é uma mensagem de sucesso. |
| Credits included in this file's metadata. | Os bytes entregues foram lidos de volta, a credencial foi verificada e todas as origens exigidas foram encontradas na credencial. |
| Credits and credentials are in the download package. | O crédito viaja como um arquivo complementar junto com o artefato. Mantenha-os juntos ao repassar. |
| If you share this adaptation, it needs a compatible licence. | Uma origem ShareAlike foi alterada e o resultado vai para algo diferente de uso privado. Escolher é uma única ação, não uma caixa de diálogo por posicionamento. |
| Add this credit to the post description. | A rota escolhida não leva credencial nem crédito legível, então o texto do crédito é seu para colar. |
| No required credit under the recorded CC0 dedication. | A dedicação não pede nada. Um crédito de cortesia é oferecido mesmo assim. |
| Source licence not recorded. | Nada foi registrado para esta origem. Isso é uma lacuna a preencher, não um achado contra a obra. Nunca é evidência de que a obra está livre para ser repassada. |
| Conditions recorded, not yet interpreted. | O identificador é reconhecido e suas condições são listadas, e nenhuma regra aqui as lê. Nenhuma aprovação automática, nenhuma proibição automática. |
| Two licence declarations disagree. | Dois registros nomeiam licenças diferentes e nada selecionou qual concessão se aplica. |
| The credits are not in the file that was delivered. | Um crédito foi prometido, a leitura de volta não o encontrou e o arquivo continua sendo seu. Exporte de novo ou use o texto do crédito manualmente. |

O Lolly nunca diz "copyright verified", "legally safe", "fully cleared" nem "rights cleared", e não existe um único selo verde de licença em lugar nenhum do produto. Essas palavras afirmariam algo que nenhum programa consegue verificar.

## O que continua seu

- **A escolha da licença é sua.** Reivindicar um arquivo separa três estados que antes eram um só: nenhuma licença pública declarada, um aviso explícito de todos os direitos reservados e uma concessão real de licença pública. O Lolly grava uma linha de direitos apenas para os dois últimos, e nunca a partir do seu perfil.
- **Seu trabalho não é relicenciado por você.** Os termos de uma origem e a sua própria declaração de saída são registros separados. Uma condição ShareAlike se aplica à adaptação que ela rege, não automaticamente a tudo o mais que você criou.
- **O trabalho privado continua utilizável.** As condições que se aplicam no compartilhamento são levantadas quando o compartilhamento está em vista. Nada aqui vira uma proibição de importação, e nenhum questionário de licenciamento se interpõe entre você e os seus próprios arquivos.
- **Uma decisão é lembrada em relação aos seus próprios fatos.** Cada escolha que você registra recebe a impressão digital das obras, dos usos, da rota e do público sobre os quais foi feita. Mude o conjunto, o tratamento, o formato ou o público e a pergunta é feita de novo. Não há uma chave geral de "ignorar licenças", porque dispensar um aviso com um clique não consegue entregar um crédito nem conceder uma permissão.
- **Seus dados ficam separados do crédito de terceiros.** Remover seus próprios metadados pessoais não remove um artista creditado, e um crédito exigido nunca é desculpa para exportar seus dados de contato.

## O que o Lolly faz em cada lugar

- **No catálogo.** A ficha de uma obra mostra a origem e o criador, o nome canônico da licença com o rótulo original mantido embaixo, um crédito copiável onde houver um registrado e uma linha dizendo o que usá-la pede. Um bloco declara a exigência; nunca afirma que uma exportação foi concluída.
- **No painel de exportação.** Um cartão Source credits aparece dentro de Content protection quando uma renderização usa uma obra registrada, ao lado da Licence que você escolhe para a sua própria exportação. Ele mostra o estado, o texto do crédito atrás de Details, um botão Copy credit e um cartão embutido quando uma decisão é devida. Uma decisão nunca é uma caixa de diálogo bloqueante: um download com uma ação pendente segue em frente.
- **No arquivo.** Uma exportação que incluiu uma obra registrada grava um ingrediente de origem das Content Credentials por obra distinta, vinculado aos bytes originais no endereço público deles, e que carrega o criador, a licença e seu link, a origem, a revisão e as alterações. O Lolly assina o que observou. Nunca assina uma declaração em nome do artista original, e o Verify diz qual das duas coisas aconteceu.
- **Em um pacote.** Um download que não pode conter uma credencial, como uma animação `.lottie`, leva os créditos como `CREDITS.txt` e `credits.json` dentro do pacote. Eles são lidos de volta depois de gravados, e nenhuma credencial assinada é afirmada para eles.
- **Depois de gravar.** Os bytes entregues são lidos de volta antes que qualquer coisa diga que os créditos estão incluídos. Uma credencial que não foi verificada não conta como crédito entregue.
- **Em um arquivo `.lolly` editável.** Os bytes só viajam quando uma licença revisada registra permissão para repassar a origem. O `CREDITS.txt` do pacote lista o que viajou, sob qual licença e o que foi retido, com o motivo. Uma licença não registrada é retida. Você ainda pode incluir deliberadamente o conteúdo retido, e o arquivo de créditos registra que foi uma escolha sua.
- **No Verify.** Um painel Sources lista todas as origens que um arquivo registra, com um resumo calculado, o crédito, um botão Copy credit, um link Open source que só abre quando você pede e os limites declarados do que foi inspecionado. Uma pergunta Check for this use só aparece quando você escolhe um uso, e nada é buscado para respondê-la.
- **Quando você remove metadados.** A remoção informa quantos créditos de origem o arquivo deixou de carregar, oferece o texto do crédito e oferece um arquivo limpo com os créditos em um arquivo separado. Os bytes removidos nunca são recarimbados.

::: details As licenças que o Lolly revisou
Versão das regras `rights-rules-2026-09-13.2`. Cada regra foi lida do próprio texto legal da licença, e a seção de onde veio é citada aqui e ao lado da regra em `engine/src/rights-profiles.ts`. Uma versão e uma jurisdição são mantidas como registradas: uma declaração CC BY 3.0 mantém a própria versão em vez de ser informada como 4.0 porque o seletor do app prefere a 4.0.

| Licença | O que ela pede de um uso que o Lolly pode fazer | Lido de |
|---|---|---|
| CC BY 4.0 | O criador, o título, o aviso de direitos autorais, o nome e o link da licença, o link da origem e uma indicação de alterações, cada um quando a origem forneceu. Nenhum uso é excluído, inclusive o comercial. | [Legal code](https://creativecommons.org/licenses/by/4.0/legalcode.en), seções 2(a)(1) e 3(a) |
| CC BY-SA 4.0 | O mesmo crédito. Além disso, se você compartilha uma adaptação, ela sai sob uma licença compatível: CC BY-SA 4.0, a Free Art License 1.3 ou a GPL-3.0-or-later, o que vale em um só sentido. Essas três são carregadas como dados a partir da lista da Creative Commons, nunca identificadas pelo nome. | [Legal code](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en), seções 3(a) e 3(b); a [lista de licenças compatíveis](https://creativecommons.org/compatible-licenses/) |
| CC0 1.0 | Nada. A dedicação não carrega nenhuma condição, então o Lolly oferece um crédito de cortesia e nunca apresenta um como exigido. | [A dedicação](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en), seções 2 e 3; o [CC FAQ](https://creativecommons.org/faq/) sobre creditar |
| CC-PDDC | Nada. O que fica registrado é a própria asserção e quem a fez, porque uma certificação é a declaração de uma parte e não uma prova. | Os parágrafos da [dedicação e certificação](https://creativecommons.org/licenses/publicdomain/) |
| Apache License 2.0 | Os avisos da origem e o texto de atribuição do arquivo NOTICE viajam com uma obra distribuída. Um uso em tempo de execução não pede nada. Uma licença que pede um texto de aviso e uma obra que não carrega nenhum é informada como lacuna. | [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0), seção 4, condições 1 a 4 |
| MIT | A linha de direitos autorais e o aviso de permissão viajam com cópias e partes substanciais. Usos em tempo de execução e de referência não pedem nada. | [MIT](https://opensource.org/license/mit), a condição do aviso de permissão |
| SIL OFL 1.1 | Renderizar texto com a fonte não pede nada do texto. Repassar o arquivo da fonte leva a licença, o aviso de direitos autorais e a regra de nome reservado. | [OFL 1.1](https://openfontlicense.org/open-font-license-official-text/), condições 2, 3 e 5; o [OFL FAQ](https://openfontlicense.org/ofl-faq/) sobre documentos |

**Registrado, não interpretado.** CC BY-NC, CC BY-ND e as combinações NC-SA e NC-ND são reconhecidas, suas condições são listadas e nenhuma regra aqui as lê. Elas informam `licence.unknown` com uma linha que nomeia as condições. Um contexto comercial não pode ser lido a partir de um preço ou de uma conta, e cada texto combinado precisa da própria revisão antes que uma regra leia esse texto.

Mais três respostas honestas, nenhuma das quais é permissão:

- Um identificador `LicenseRef-` volta como ele mesmo. Ele aponta para uma definição armazenada e nunca é proprietário por causa da grafia.
- Uma declaração que nada reconhece volta sem análise, e o texto original é mantido.
- `A OR B` é uma escolha que o titular dos direitos ofereceu, então todas as alternativas são devolvidas e nenhuma é selecionada. `A AND B` é cumulativo, e estas regras o registram em vez de ler dois perfis juntos.
:::

::: details Na linha de comando e por MCP
Uma renderização imprime um bloco `Rights:` no erro padrão quando a avaliação tem um crédito exigido ou um problema. Ele traz o status, uma linha por problema como `code - summary`, como o arquivo entregue foi lido de volta e o texto do crédito para colar.

```
Rights: actions-required
  licence.adaptation-choice - If you share this adaptation, it needs a compatible licence.
  Credential intact. It records 1 source. The exporter recorded it; the source did not sign a credential of its own.
  Credits included in this file's metadata.
  "water wave (OpenMoji Color 17.0.0)" by Vanessa Boutzikoudi (OpenMoji), CC BY-SA 4.0 https://creativecommons.org/licenses/by-sa/4.0/, source https://raw.githubusercontent.com/hfg-gmuend/openmoji/f9fc506a3f913be9897ab0181d611d4c910a4104/color/svg/1F30A.svg, changes: recoloured.
```

Aqui o crédito está no arquivo, e uma decisão de licença ainda é devida antes de o arquivo ser compartilhado. O arquivo é gravado de qualquer forma.

| Status | Significado | Saída |
|---|---|---|
| `ready` | Nada está esperando por uma pessoa. | 0 |
| `actions-required` | Uma decisão permanece pendente antes que o arquivo seja compartilhado. O arquivo ainda é gravado. | 4 |
| `use-not-covered` | Uma regra revisada diz que a licença não cobre este uso. | 4 |
| `unknown` | Os únicos problemas são lacunas: uma licença que não foi registrada, ou condições que não são interpretadas. | 0 |
| `delivery-failed` | Definido por um comprovante, nunca por uma avaliação: um crédito prometido não foi encontrado nos bytes entregues. O painel de exportação mostra isso; a CLI relata o mesmo fato em sua linha de releitura. | não impresso |

A saída 4 é o código que esta CLI já dá quando uma verificação de proteção diz não. Não é 3, que significa "tentar de novo em outro executor", porque uma decisão de licença estará esperando em todos os executores que existirem.

`--rights=private` declara que esta renderização não está sendo entregue a ninguém. O bloco ainda é impresso e o crédito ainda está lá para copiar; o que recua é a condição que se aplica ao compartilhamento, e nenhuma alegação de entrega é registrada. Não existe uma flag para ignorar uma condição: `--rights=ignore` é um erro de uso.

Os códigos de problema são estáveis e legíveis por máquina, independentes do texto traduzido: `attribution.source-missing`, `attribution.delivery-missing`, `licence.adaptation-choice`, `licence.use-not-covered`, `licence.grant-conflict`, `licence.unknown`, `source.redistribution-unknown`, `credential.ingredient-missing`.

Por MCP, `lolly_verify` retorna um conteúdo `rights` com o resumo, uma linha por origem registrada e os limites declarados. Um `lolly_render` sem navegador retorna `status`, `issues`, `credits`, `fingerprint` e um indicador `creditsInFile` medido lendo os bytes de volta.
:::

::: details Onde as regras vivem
Cinco módulos do motor, todos puros: sem rede, sem relógio, sem sistema de arquivos. Os dados das regras são versionados e ficam no repositório, nunca são buscados.

| Módulo | O que contém |
|---|---|
| `engine/src/rights-profiles.ts` | A tabela de identificadores, o leitor mínimo de expressões SPDX, os perfis revisados com suas citações e a regra única para um link que um crédito pode imprimir. |
| `engine/src/rights-evaluate.ts` | Classificação, problemas, o plano de atribuição e a impressão digital. Determinístico: os mesmos fatos em outra ordem dão a mesma resposta. |
| `engine/src/rights-attribution.ts` | Créditos legíveis, os arquivos complementares, os ingredientes de origem e o recibo medido depois da gravação. |
| `engine/src/rights-companion.ts` | A leitura de volta dos créditos do pacote (`CREDITS.txt` e `credits.json` dentro de um download baseado em ZIP), que confirma os créditos sem afirmar uma credencial assinada. |
| `engine/src/rights-report.ts` | Uma credencial verificada lida de volta como as três perguntas que o Verify faz. |

Os arquivos de expectativas em `tests/fixtures/rights/` foram escritos a partir dos textos das licenças e não da saída do avaliador, e o README deles cita a seção por trás de cada expectativa.
:::

## O que isto ainda não faz

- **Nenhum destino é confirmado.** O Lolly prepara uma legenda. Um conector que aceita uma solicitação não prova que um crédito chegou a um leitor, e nada aqui promete que um envio, captura de tela ou transcodificação posterior mantenha metadados ocultos.
- **Os campos nativos de crédito em metadados não são gravados a partir do plano.** Os créditos viajam nas Content Credentials e em texto legível. Os campos de crédito por origem do IPTC e do XMP ainda não são preenchidos a partir do plano de atribuição.
- **Correções e retirada não foram construídas.** Adicionar um criador ausente ou uma correção local a uma obra registrada, e retirar um registro, não têm interface.
- **Provedores conectados não foram construídos.** Banco de imagens comprado, uma permissão personalizada e uma conta de provedor não têm caminho de importação, então as concessões deles só podem ser registradas como declaração sua.
- **A política da organização não é combinada com estes resultados.** A política de exportação e as condições de licença são separadas hoje, e a aprovação de uma organização não é permissão de um titular de direitos.
- **Várias rotas de entrega ainda não estão neste caminho.** Baixar um original do catálogo, um ZIP em massa, Send e Copy image ainda não avaliam nem carregam estes créditos. Um corte, uma gradação de cor, uma cópia emoldurada, uma conversão por Download as e uma edição de vídeo, sim: uma origem com licença registrada e sem Content Credentials próprias viaja como um ingrediente de origem não assinado com o seu crédito, uma LUT é creditada pela própria licença e nunca como a da imagem, e um arquivo que não consegue carregar um crédito que a origem pede não é salvo. Nada lê esses arquivos de volta ainda, então os créditos deles são gravados, não confirmados. Retouch, remoção de fundo e ampliação de imagem única e extração de áudio mantêm apenas a credencial da própria origem.
