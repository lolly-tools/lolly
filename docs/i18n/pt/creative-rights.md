# Direitos criativos, créditos e o que continua seu

Você deveria conseguir usar um bom trabalho feito por outras pessoas sem se tornar um especialista em licenciamento, e sem descartar silenciosamente as pessoas que o fizeram. Por isso o Lolly mantém a origem de cada obra que usa, lê a licença que foi registrada para ela, calcula o que essa licença pede do uso que você está de fato fazendo, faz a parte que um programa consegue fazer, e nomeia a parte que só você pode fazer.

Nada disso é aconselhamento jurídico, e nada disso é um veredito sobre o seu projeto. O Lolly registra fatos, aplica um pequeno conjunto de regras lidas dos próprios textos legais das licenças, e mostra seu raciocínio. Uma licença com condições é uma escolha normal e permitida. Ela nunca é apresentada como um ativo quebrado.

## Três fatos, mantidos separados

"CC BY 4.0", "este uso precisa de um crédito" e "o crédito está no arquivo que você acabou de baixar" são três afirmações diferentes, e o Lolly as mantém separadas:

- **Evidência** é o que uma fonte declarou, registrado como foi encontrado, com quem disse e onde foi lido. Uma importação posterior nunca sobrescreve um registro anterior.
- **Obrigação** é o que as regras revisadas fazem dessa evidência para um uso, uma rota de entrega e um público. Condições de compartilhamento continuam condicionais enquanto você trabalha de forma privada.
- **Entrega** é o que os bytes finais realmente carregam, medido relendo-os. O Lolly diz que os créditos estão incluídos somente depois que um leitor os encontrou no arquivo entregue.

## Onde você encontra isso pela primeira vez

Os conjuntos de emoji são o caso do dia a dia. O Twemoji é CC BY 4.0, então um título com um emoji nele exporta com a arte creditada e nada sobrando para você fazer. Os dois conjuntos OpenMoji são CC BY-SA 4.0, então recolorir um de seus glifos com um tratamento de marca é uma adaptação, e compartilhar essa adaptação pede que você escolha uma licença compatível uma vez. Escolher o conjunto nunca é bloqueado, e o controle de conjunto nomeia a licença onde você faz a escolha. As mesmas regras respondem por uma ilustração de catálogo, uma LUT, uma fonte e qualquer outra obra registrada.

## As palavras que o Lolly usa

Um único vocabulário no painel de exportação, no Verify, na linha de comando e no resultado para máquina.

| O que você vê | O que significa |
|---|---|
| Créditos de origem serão incluídos. | O crédito está preparado e a rota consegue transportá-lo. Nada foi escrito ainda, então esta não é uma mensagem de sucesso. |
| Créditos incluídos nos metadados deste arquivo. | Os bytes entregues foram relidos, a credencial foi verificada e cada origem exigida foi encontrada nele. |
| Créditos e credenciais estão no pacote de download. | O crédito viaja como um arquivo complementar ao lado do artefato. Mantenha-os juntos ao repassá-los. |
| Adicione este crédito à descrição da postagem. | A rota escolhida não carrega nem uma credencial nem um crédito legível, então o texto do crédito é seu para colar. |
| Se você compartilhar esta adaptação, ela precisa de uma licença compatível. | Uma origem ShareAlike foi alterada e o resultado está indo para algo além de uso privado. Escolher é uma única ação, não uma caixa de diálogo por posicionamento. |
| Licença da origem não registrada. | Nada foi registrado para esta origem. Isso é uma lacuna a preencher, não uma constatação contra a obra. |
| Condições registradas, ainda não interpretadas. | O identificador é reconhecido e suas condições estão listadas, e nenhuma regra aqui as interpreta. Nem aprovação automática, nem proibição automática. |
| Duas declarações de licença divergem. | Dois registros nomeiam licenças diferentes e nada selecionou qual concessão se aplica. |
| Nenhum crédito exigido pela dedicação CC0 registrada. | A dedicação não pede nada. Um crédito de cortesia é oferecido mesmo assim. |
| Os créditos não estão no arquivo que foi entregue. | Um crédito foi prometido, a releitura não o encontrou, e o arquivo ainda é seu. Exporte novamente, ou use o texto do crédito manualmente. |

O Lolly não usa "direitos autorais verificados", "legalmente seguro", "totalmente liberado" ou "direitos liberados", e não há um único selo verde de licença em lugar nenhum do produto. Essas palavras alegariam algo que nenhum programa consegue conferir.

## As licenças que o Lolly revisou

Versão das regras `rights-rules-2026-09-13.2`. Cada regra abaixo foi lida do próprio texto legal da licença, e a seção de onde veio é citada ao lado dela em `engine/src/rights-profiles.ts`, assim como aqui. Uma versão e uma porta são mantidas como registradas: uma declaração CC BY 3.0 mantém sua própria versão em vez de ser relatada como 4.0 só porque o seletor do app prefere 4.0.

| Licença | O que ela pede de um uso que o Lolly pode fazer | Lida de |
|---|---|---|
| CC BY 4.0 | O criador, o título, o aviso de direitos autorais, o nome e o link da licença, o link da origem e uma indicação das alterações, cada um quando a origem os forneceu. Nenhum uso é excluído, uso comercial incluído. | [Texto legal](https://creativecommons.org/licenses/by/4.0/legalcode.en), seções 2(a)(1) e 3(a) |
| CC BY-SA 4.0 | O mesmo crédito. Além disso, se você compartilhar uma adaptação, ela sai sob uma licença compatível: CC BY-SA 4.0, a Free Art License 1.3, ou GPL-3.0-or-later, que funciona só em um sentido. Essas três são carregadas como dados da lista da Creative Commons, nunca comparadas pelo nome. | [Texto legal](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en), seções 3(a) e 3(b); a [lista de licenças compatíveis](https://creativecommons.org/compatible-licenses/) |
| CC0 1.0 | Nada. A dedicação não carrega nenhuma condição, então o Lolly oferece um crédito de cortesia e nunca apresenta um como obrigatório. | [A dedicação](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en), seções 2 e 3; o [FAQ da CC](https://creativecommons.org/faq/) sobre crédito |
| CC-PDDC | Nada. O que é registrado é a própria alegação e quem a fez, porque uma certificação é a declaração de uma das partes, não uma prova. | os parágrafos da [dedicação e certificação](https://creativecommons.org/licenses/publicdomain/) |
| Apache License 2.0 | Os avisos da origem e o texto de atribuição do arquivo NOTICE viajam com uma obra distribuída. Um uso em tempo de execução não pede nada. Uma licença que pede um texto de aviso e uma obra que não carrega nenhum são relatados como uma lacuna. | [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0), seção 4, condições 1 a 4 |
| MIT | A linha de direitos autorais e o aviso de permissão viajam com cópias e partes substanciais. Usos em tempo de execução e de referência não pedem nada. | [MIT](https://opensource.org/license/mit), a condição do aviso de permissão |
| SIL OFL 1.1 | Renderizar texto com a fonte não pede nada do texto. Repassar o arquivo da fonte carrega a licença, o aviso de direitos autorais e a regra de nome reservado. | [OFL 1.1](https://openfontlicense.org/open-font-license-official-text/), condições 2, 3 e 5; o [FAQ da OFL](https://openfontlicense.org/ofl-faq/) sobre documentos |

### Registradas, não interpretadas

CC BY-NC, CC BY-ND e as combinações NC-SA e NC-ND são reconhecidas, suas condições são listadas, e nenhuma regra aqui as interpreta. Elas relatam `licence.unknown` com uma linha nomeando as condições. Um contexto comercial não pode ser deduzido de um preço ou de uma conta, e cada texto combinado precisa de sua própria revisão antes que uma regra o toque.

Mais três respostas honestas, nenhuma das quais é permissão:

- Um identificador `LicenseRef-` volta como ele mesmo. Ele aponta para uma definição armazenada e nunca é proprietário por causa da grafia.
- Uma declaração que nada reconhece volta sem análise, com o texto original mantido ao lado dela.
- `A OR B` é uma escolha que o titular dos direitos ofereceu, então cada alternativa é retornada e nenhuma é selecionada. `A AND B` é cumulativo, e essas regras registram isso em vez de ler dois perfis juntos.

Informação de licença ausente nunca é lida como evidência de que uma obra é livre para ser repassada.

## O que o Lolly faz por você

- **No catálogo.** A ficha de uma obra mostra sua origem e criador, o nome canônico da licença com o rótulo original mantido embaixo, um crédito copiável onde um está registrado, e uma linha dizendo o que usá-la pede. Um tile declara a exigência; ele nunca alega que uma exportação foi concluída.
- **No painel de exportação.** Um cartão Source credits aparece dentro de Content protection assim que uma renderização usa uma obra registrada, ao lado da Licence que você escolhe para sua própria exportação. Ele mostra o estado, o texto do crédito atrás de Details, um botão Copy credit, e um cartão embutido quando uma decisão está pendente. Uma decisão nunca é uma caixa de diálogo bloqueante: um download que ainda tem uma ação pendente prossegue, e a obra privada continua utilizável.
- **No arquivo.** Uma exportação que posicionou uma obra registrada grava um ingrediente de origem do Content Credentials por obra distinta, vinculado aos bytes originais em seu endereço público, carregando o criador, a licença e seu link, a origem, a revisão e as alterações. O Lolly assina o que observou. Ele nunca assina uma alegação em nome do artista de origem, e o Verify diz qual dos dois aconteceu.
- **Depois de gravar.** Os bytes entregues são relidos antes que algo diga que os créditos foram incluídos. Uma credencial que não verificou não conta como um crédito entregue.
- **Em um arquivo `.lolly` editável.** Os bytes só viajam quando uma licença revisada registra permissão para repassar a origem, e o `CREDITS.txt` do pacote lista o que viajou, sob qual licença, e o que foi retido, com o motivo. Uma licença não registrada é retida. Você ainda pode incluir conteúdo retido deliberadamente, e o arquivo de créditos registra que foi sua escolha.
- **No Verify.** Um painel Sources lista cada origem que um arquivo registra, com um resumo calculado, o crédito, um botão Copy credit, um link Open source que só é aberto sob pedido, e os limites declarados do que foi inspecionado. Uma pergunta Check for this use só é feita quando você escolhe um uso, e nada é buscado para respondê-la.
- **Quando você remove metadados.** A remoção diz quantos créditos de origem o arquivo deixou de carregar, oferece o texto do crédito, e oferece um arquivo limpo com os créditos ao lado. Bytes removidos nunca são recarimbados.

## O que continua seu

- **Sua escolha de licença é sua.** Reivindicar um arquivo separa três estados que costumavam ser um só: nenhuma licença pública declarada, um aviso explícito de todos os direitos reservados, e uma concessão real de licença pública. O Lolly escreve uma linha de direitos apenas para os dois últimos, e nunca a partir do seu perfil.
- **Sua obra não é relicenciada por você.** Os termos de uma origem e sua própria declaração de saída são registros separados. Uma condição ShareAlike se aplica à adaptação que ela rege, não automaticamente a tudo o mais que você fez.
- **A obra privada continua utilizável.** Condições que se aplicam ao compartilhar são levantadas quando o compartilhamento está em vista. Nada aqui se transforma em uma proibição de importação, e nenhum questionário de licenciamento fica entre você e seus próprios arquivos.
- **Uma decisão é lembrada em relação aos seus próprios fatos.** Cada escolha que você registra é carimbada com uma impressão digital das obras, usos, rota e público sobre os quais foi tomada. Mude o conjunto, o tratamento, o formato ou o público e a pergunta é feita de novo. Não existe um interruptor geral de "ignorar licenças", porque descartar um aviso com um clique não consegue entregar um crédito nem conceder uma permissão.
- **Seus dados continuam separados do crédito de terceiros.** Remover seus próprios metadados pessoais não remove um artista creditado, e um crédito exigido nunca é desculpa para exportar seus dados de contato.

## Na linha de comando

Uma renderização imprime um bloco `Rights:` no standard error quando a avaliação tem um crédito exigido ou um problema. Ele carrega o status, uma linha por problema como `code - summary`, o que o arquivo entregue foi relido como sendo, e o texto do crédito para colar.

```
Rights: actions-required
  licence.adaptation-choice - If you share this adaptation, it needs a compatible licence.
  Credential intact. It records 1 source. The exporter recorded it; the source did not sign a credential of its own.
  Credits included in this file's metadata.
  "water wave (OpenMoji Color 17.0.0)" by Vanessa Boutzikoudi (OpenMoji), CC BY-SA 4.0 https://creativecommons.org/licenses/by-sa/4.0/, source https://raw.githubusercontent.com/hfg-gmuend/openmoji/f9fc506a3f913be9897ab0181d611d4c910a4104/color/svg/1F30A.svg, changes: recoloured.
```

Essas duas afirmações são independentes, e esse é o objetivo de mantê-las separadas: o crédito está no arquivo, e uma decisão de licença ainda é devida antes que o arquivo seja compartilhado. O arquivo é gravado de qualquer forma.

| Status | Significado | Saída |
|---|---|---|
| `ready` | Nada está esperando por uma pessoa. | 0 |
| `actions-required` | Uma decisão permanece pendente antes que o arquivo seja compartilhado. O arquivo ainda é gravado. | 4 |
| `use-not-covered` | Uma regra revisada diz que a licença não cobre este uso. | 4 |
| `unknown` | Os únicos problemas são lacunas: uma licença que não foi registrada, ou condições que não são interpretadas. | 0 |
| `delivery-failed` | Definido por um comprovante, nunca por uma avaliação: um crédito prometido não foi encontrado nos bytes entregues. O painel de exportação mostra isso; a CLI relata o mesmo fato em sua linha de releitura. | não impresso |

Saída 4 é o código que esta CLI já dá a uma verificação protetiva que disse não. Deliberadamente não é 3, que significa "tentar novamente em outro executor", e uma decisão de licença estará esperando em todo executor que existir.

`--rights=private` declara que esta renderização não está sendo entregue a ninguém. O bloco ainda é impresso e o crédito ainda está lá para copiar; o que recua é a condição que se aplica ao compartilhamento, e nenhuma alegação de entrega é registrada. Não existe uma flag para ignorar uma condição: `--rights=ignore` é um erro de uso.

Os códigos de problema são estáveis e legíveis por máquina, independentes do texto traduzido:

`attribution.source-missing`, `attribution.delivery-missing`, `licence.adaptation-choice`, `licence.use-not-covered`, `licence.grant-conflict`, `licence.unknown`, `source.redistribution-unknown`, `credential.ingredient-missing`.

Via MCP, `lolly_verify` retorna um payload `rights` com o resumo, uma linha por origem registrada e os limites declarados; um `lolly_render` sem navegador retorna `status`, `issues`, `credits`, `fingerprint` e uma flag `creditsInFile` que é medida relendo os bytes.

## Onde as regras vivem

Quatro módulos do engine, todos puros: sem rede, sem relógio, sem sistema de arquivos. Os dados das regras são versionados e ficam no repositório, nunca são buscados.

| Módulo | O que contém |
|---|---|
| `engine/src/rights-profiles.ts` | A tabela de identificadores, o leitor mínimo de expressões SPDX, os perfis revisados com suas citações, e a única regra para um link que um crédito pode imprimir. |
| `engine/src/rights-evaluate.ts` | Classificação, problemas, o plano de atribuição e a impressão digital. Determinístico: os mesmos fatos em uma ordem diferente dão a mesma resposta. |
| `engine/src/rights-attribution.ts` | Créditos legíveis, os arquivos complementares, os ingredientes de origem e o comprovante medido após a gravação. |
| `engine/src/rights-report.ts` | Uma credencial verificada, relida como as três perguntas que o Verify faz. |

Os arquivos de expectativa em `tests/fixtures/rights/` foram escritos a partir dos textos das licenças, e não a partir da saída do avaliador, e seu README cita a seção por trás de cada expectativa.

## O que isso não faz

Dito claramente, porque uma lacuna que não é nomeada soa como uma promessa.

- **NC e ND não são interpretadas.** Suas condições são registradas e relatadas como desconhecidas.
- **Nenhum destino é confirmado.** O Lolly prepara uma legenda; um conector que aceita uma solicitação não é prova de que um crédito chegou a um leitor, e nada aqui promete que um upload, captura de tela ou transcodificação posterior preserva metadados ocultos.
- **Campos de crédito nativos de metadados não são gravados a partir do plano.** Os créditos viajam no Content Credentials e em texto legível. Os campos de crédito por origem do IPTC e do XMP ainda não são preenchidos a partir do plano de atribuição.
- **Correções e retirada não estão implementadas.** Adicionar um criador ausente ou uma correção local a uma obra registrada, e retirar um registro, não têm interface.
- **Provedores conectados não estão implementados.** Estoque comprado, uma permissão personalizada e uma conta de provedor não têm caminho de importação, então suas concessões só podem ser registradas como sua própria declaração.
- **A política da organização não é combinada com esses resultados.** A política de exportação e as condições de licença são registros separados hoje, e uma aprovação organizacional não é permissão de um titular de direitos.
- **Várias rotas de entrega ainda não estão neste caminho.** Baixar um original do catálogo, um ZIP em lote, um download derivado, Send e Copy image ainda não avaliam nem carregam esses créditos.
