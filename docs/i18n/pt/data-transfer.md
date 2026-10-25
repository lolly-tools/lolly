# Transferência de dados: o pacote `lolly-backup`

O Lolly guarda a sua biblioteca pessoal no dispositivo. Um pacote de backup é como essa biblioteca se move: exporte-o em uma instalação, leve o arquivo como quiser (USB, AirDrop, e-mail para si mesmo ou um compartilhamento de rede) e importe em outra. Exportar e importar não precisam de servidor, e o destino pode estar offline.

Esta página é a especificação do formato, para quem desenvolve shells, ferramentas ou scripts em torno de backups: o que há no zip, como as versões são controladas, como uma importação mescla e o que é verificado. O passo a passo para quem está movendo o próprio trabalho é [Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device).

![Os dois botões que movem uma instalação inteira: Export my data grava um zip, Import data o lê de volta](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> **Escopo.** Um pacote carrega *dados do usuário*, não ferramentas do catálogo. As ferramentas e os recursos do catálogo são sincronizados separadamente e presume-se que já estejam no destino, no pior caso em uma versão mais alta. As ferramentas que um usuário criou viajam dentro do `profile.json`. Importar nunca instala nem atualiza uma ferramenta do catálogo.

## Objetivos

- <!--i:box--> **Um formato, todos os shells.** O app web, os apps desktop e mobile e os futuros shells compartilham o mesmo envelope e os mesmos esquemas de partes. As partes opcionais dependem das capacidades de cada shell, e as partes não compatíveis são informadas. Cada ponte de capacidades fornece o seu adaptador de armazenamento.
- <!--i:shieldcheck--> **Sobrevive à viagem.** Um pacote corrompido ou truncado no trânsito falha de forma explícita na importação e nunca restaura pela metade.
- <!--i:clock--> **Sobrevive a esta versão.** Um app mais antigo ainda consegue importar as partes de um pacote mais novo que reconhece. Um formato realmente incompatível é recusado de forma limpa.
- <!--i:check--> **Seguro para mesclar.** Importar em uma instalação que já está em uso nunca apaga nada que não estava no pacote.

## O envelope

Um pacote é um `.zip` simples, então sobrevive intacto a qualquer transporte e qualquer ferramenta de descompactação pode inspecionar o conteúdo.

O download recebe o nome da pessoa a quem pertence: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, por exemplo `LollyTools-Ada-Lovelace-2026-06-26-1.zip`, para que uma pasta de Downloads com backups continue legível. O nome e o sobrenome vêm do perfil e são omitidos quando não definidos: sem perfil dá `LollyTools-2026-06-26-1.zip`, e só o nome dá `LollyTools-Ada-2026-06-26-1.zip`. Cada nome é reduzido a um token seguro para nome de arquivo (letras e dígitos Unicode mantidos, espaços e pontuação removidos, no máximo 32 caracteres). `<n>` é uma sequência por dia e por dispositivo, então exportações repetidas no mesmo dia não colidem e ficam em ordem. O `backupFilename()` em `data-transfer.ts` monta o nome, e o conteúdo do zip é o mesmo seja qual for o nome.

| Caminho | Obrigatório | Conteúdo |
|---|---|---|
| `manifest.json` | sim | Id do formato, versões, contagens e integridade por parte. A primeira coisa que um leitor examina. |
| `profile.json` | quando definido | Todo o registro `me` do usuário: nome, contato, referência da foto e sinalizadores, mais pastas, Lixeira, modelos de projeto, templates de usuário e ferramentas criadas pelo usuário, favoritos, ferramentas ocultas, idioma e escolha de emoji. Lido via `host.profile`. |
| `sessions.json` | sim | Todas as sessões salvas: slot, id e versão da ferramenta, rótulo, miniatura (data URL) e todos os dados de entrada. Lido via `host.state`. |
| `assets.json` | sim | Metadados de cada recurso enviado (imagens, fontes, tokens da marca, logotipos, cópias salvas de downloads), cada um apontando para os bytes dele em `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | por recurso | Os bytes brutos do recurso, armazenados sem compressão porque a maioria já está em formatos comprimidos. A extensão é cosmética; o tipo MIME em `assets.json` é a referência. |
| `assets/blobs/<n>.c2pa` | quando presente | Content Credentials extraídas como bytes binários exatos, referenciadas por `_credentialFile` no registro do recurso. Não são chaves de assinatura do dispositivo. |
| `design-systems.json` | quando presente | Os sistemas de design criados ou adicionados nesta instalação, como `{ active, records }`. Veja [Import rules](#import-rules). |
| `file-history.json` | opcional | Instantâneos versionados de recursos, relatórios de operações de arquivo concluídas e manifestos completos de lotes, com versão própria. Fornecido pelo adaptador interno de backup `fileHistory` do shell. |
| `revision-history.json` | opcional, backups manuais | IDs de criação estáveis, pontos de restauração mantidos, miniaturas e rascunhos de recuperação contínuos. Fornecido por `host.state.history.backup` onde houver suporte. |
| `file-history/versions/` | por instantâneo | Bytes de recursos anteriores e credenciais extraídas, quer o recurso atual ainda exista ou não. |
| `file-history/results/` | por operação concluída | Bytes de saída exatos. Nenhum arquivo original selecionado para conversão é mantido nem incluído. |
| `prefs.json` | sim | Preferências locais do usuário: `theme`, `sidebarWidth` e a contagem de atividade `ct-metrics`. |
| `lolly.txt` | sim | Um resumo legível do pacote (contagens, perfil, nome de arquivo) para quem abrir o zip sem o Lolly. Regenerado a cada exportação e reconhecido na importação, então nunca conta como parte ignorada. É gravado depois do mapa de integridade, então o mapa não cobre este arquivo. |

::: details Como a exportação grava o zip
A exportação grava o zip uma parte por vez (`shells/web/src/lib/zip-stream.ts`). Envios, resultados salvos e versões salvas de recursos são lidos em fatias de 4 MiB, nunca inteiros, e os resultados e versões salvos são conferidos antes contra o SHA-256 registrado. Cada arquivo é então lido para o checksum e o digest de integridade, e o zip se refere a ele onde está.

Nada é recodificado, então um arquivo com Content Credentials mantém os bytes exatos que a assinatura cobre, e cada parte mantém os bytes e o digest exatos. Para as mesmas partes e o mesmo horário, o zip é idêntico ao do gravador anterior em memória, exceto que um arquivo de histórico acima de 16 MiB é comprimido em pedaços. O `tests/backup-streaming.test.ts` confere isso contra digests de referência registrados.

Em uma biblioteca sintética de 192 MiB, medido no Node, finalizar o backup levou cerca de 125 a 150 MiB além da biblioteca, contra cerca de 850 MiB do gravador em memória (`node scripts/bench-backup-finalise.ts`). A importação ainda lê o zip inteiro na memória.
:::

## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 3,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3, "assetVersions": 1, "fileOperations": 1 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.bin": "sha256-…",
    "file-history.json": "sha256-…",
    "file-history/versions/0.bin": "sha256-…",
    "file-history/results/0.bin": "sha256-…",
    "prefs.json": "sha256-…"
  }
}
```

| Campo | Significado |
|---|---|
| `format` | Sempre `lolly-backup`. Um arquivo sem ele é rejeitado como "not a Lolly backup". |
| `formatVersion` | O layout com que este pacote foi **gravado**. Aumentado a qualquer mudança no conjunto de partes ou nas formas. Os leitores **não** se baseiam neste campo. |
| `minReader` | A versão mínima de leitor que consegue importar este pacote com **segurança**. Este é o campo em que os leitores se baseiam. |
| `app` | Id do app produtor, para diagnóstico. |
| `exportedAt` | Data e hora ISO em que o pacote foi criado. |
| `counts` | O que o gravador colocou, para exibição e verificações de sanidade. |
| `integrity` | Opcional. Mapeia cada parte, exceto `manifest.json`, para um digest `sha256-<base64>` no estilo SRI dos bytes **descomprimidos** dela. |

## Política de versões

Dois números de versão permitem que o formato cresça sem deixar instalações antigas para trás.

![Uma mudança no formato do pacote é aditiva, e leitores antigos podem ignorá-la, ou é incompatível, e uma importação errada corrompe. A aditiva aumenta formatVersion e mantém minReader; a incompatível aumenta formatVersion e eleva minReader. Um leitor importa quando minReader é no máximo a sua própria versão.](/info/diagrams/concepts/backup-version-gate.svg)

- Um leitor importa um pacote quando `manifest.minReader` é no máximo a sua própria versão de leitor. Ele recusa, com "needs a newer version of the app", somente quando o pacote exige um leitor mais novo.
- Uma mudança **aditiva**, como uma nova parte opcional ou um novo campo opcional do manifesto, aumenta `formatVersion` e deixa `minReader` como está. Os apps mais antigos ainda importam todas as partes que reconhecem, e as partes que não reconhecem são informadas como ignoradas, não descartadas em silêncio.
- Uma mudança **incompatível**, em que uma importação errada de uma parte corrompe dados ou uma parte opcional passa a ser obrigatória, eleva `minReader`. Os apps mais antigos então recusam de forma limpa em vez de importar algo que não conseguem tratar.
- Se um pacote futuro definir `formatVersion` mas omitir `minReader`, os leitores recorrem a se basear em `formatVersion` e tratam a mudança como incompatível.

> **Regra prática para autores:** se todo leitor existente ainda faria a coisa certa ao ignorar o seu acréscimo, a mudança é aditiva: aumente `formatVersion` e deixe `minReader`. Caso contrário, eleve `minReader`.

## Integridade

Quando `manifest.integrity` está presente, um leitor confere o SHA-256 de cada parte listada **antes de gravar qualquer coisa**. Uma divergência ("failed its integrity check") ou uma parte ausente ("incomplete") interrompe a importação inteira, então não há restauração parcial. Isso detecta o dano que um transporte de arquivos pode causar: um AirDrop truncado, um gateway de e-mail que recodificou o anexo, um setor USB defeituoso.

A integridade é de melhor esforço. Ela só é gravada onde a Web Crypto está disponível (todo contexto seguro de navegador e o Node moderno) e só é conferida quando o mapa e a Web Crypto estão presentes. Um pacote sem o mapa, como um de antes de a integridade existir, é importado sem alterações: "cannot verify" nunca conta como "corrupt".

O manifesto não lista a si mesmo nem o `lolly.txt` regenerado. Os digests cobrem as partes que o manifesto atesta.

## Regras de importação

Uma importação roda em um de dois modos.

- **Merge** é o que **Import data…** faz, e o que a primeira adesão do sync, **Bring it to this device**, faz. Os dados no destino permanecem, e nada que não estava no pacote é tocado: uma sessão que o destino tinha e o pacote não tinha sobrevive à importação.
- **Replace** é o que o sync de dispositivos usa para manter os dispositivos em compasso: ele toma o registro de perfil, as preferências, as sessões, as imagens e a escolha do sistema de design ativo da cópia sincronizada, e remove apenas itens que outro dispositivo excluiu desde o último sync. Restaurar uma cópia anterior vai além e faz o dispositivo corresponder a essa cópia, removendo tudo o que a cópia não contém, depois de salvar o dispositivo antes. [Sync your devices](/info/sync.html) cobre o que uma pessoa vê.

Em uma mesclagem, tudo o que está apenas no destino é mantido, e cada tipo de dado do pacote encontra o destino assim:

| Dados | Já no destino | Só no pacote |
|---|---|---|
| Sessões (por slot) e imagens enviadas (por id) | A cópia salva mais recentemente é mantida, então um backup mais antigo nunca sobrescreve um trabalho mais novo. Horários iguais ou desconhecidos mantêm a cópia do destino. | Adicionado |
| Pastas | O nome e o pai do destino são mantidos, e a pasta ganha os membros do pacote que lhe faltam. Uma sessão arquivada em uma pasta no destino continua arquivada lá. | Adicionado |
| Favoritos (ferramentas, recursos do catálogo e itens de Projects) | Combinados | Adicionado |
| Templates, templates de Projects e ferramentas do usuário (por id) | O registro do destino é mantido. | Adicionado |
| Itens da Lixeira | O item do destino é mantido. | Adicionado, então um item que poderia ser restaurado em qualquer uma das instalações ainda pode ser. Um item cuja pasta voltou a ser usada no destino, ou cujo slot da Lixeira o destino já usa, é deixado de fora. |
| Outros campos do perfil (nome, dados de contato, idioma, feature flags, ferramentas ocultas e outras configurações) | O valor do destino é mantido. | Aproveitado quando o campo do destino está vazio |
| Preferências (`prefs.json`) | O valor do destino é mantido. | Gravado onde o destino não tem nenhum |
| Sistemas de design (por id) | O registro do pacote substitui o do destino. | Adicionado. A escolha ativa do pacote só vale quando o destino não tem sistema de design próprio. |
| Histórico de criação | A cópia salva mais recentemente continua atual, e a outra é mantida como rascunho protegido. | Adicionado |

**As sessões salvas se religam automaticamente às suas imagens.** As referências a recursos são mantidas por id, e a ponte as resolve de novo depois que as imagens são restauradas, o que precisa fazer de qualquer forma porque as URLs `blob:` não sobrevivem a um recarregamento.

**Os registros de histórico nunca mudam depois de gravados.** Uma importação repetida de versões de recursos e IDs de operações não adiciona nada, e um ID que já nomeia bytes ou histórico diferentes é recusado, não sobrescrito. Reimportar um recurso atual idêntico mantém a versão dele, e um recurso atual alterado precisa trazer uma versão diferente.

**O histórico de criação tem mais algumas regras.** Uma criação cujo slot o destino usa para uma criação diferente é adicionada como uma criação separada, e uma criação na Lixeira do destino permanece lá. Um id de ponto de restauração que nomeia conteúdo diferente no destino mantém o do destino. Um arquivo que falha nas próprias verificações interrompe a importação antes que qualquer perfil, sessão, recurso ou preferência mude, e uma importação idêntica repetida não acrescenta armazenamento.

**O resumo informa o que aconteceu.** Toda importação retorna `profile`, `sessions`, `userAssets`, `prefs`, `skipped` e `failedAssets`.

- `failedAssets` conta os recursos enviados que não puderam ser restaurados, por exemplo porque o armazenamento do dispositivo está cheio.
- `skipped` conta as partes de um gravador mais novo que esta versão não reconheceu. O app o mostra ("… · N newer items skipped"), então uma restauração declara o que deixou para trás.
- Com o histórico de arquivos, o resumo acrescenta `assetVersions`, `fileOperations`, `fileBatches` e `failedHistory`. O esgotamento do armazenamento ou um conflito de ID imutável pode causar uma restauração parcial, e o app então orienta a pessoa a guardar o backup de origem.
- Com o histórico de criação, acrescenta `revisions` e `recoveryDrafts`, contando apenas o que esta importação adicionou, e `added`, `kept`, `replaced`, `copies` e `hidden` para indicar como cada criação foi mesclada. `skippedCheckpoints` conta os pontos de restauração cujo id nomeia conteúdo diferente no destino, e `historyLeftOut` conta os pontos de restauração e rascunhos mais antigos que não couberam no espaço de histórico do dispositivo.
- Uma importação com substituição acrescenta `removed` e `failedRemovals`.

A restauração não é uma única transação entre os armazenamentos de perfil, sessões, recursos e histórico. A sincronização em nuvem **não** avança a revisão aplicada depois de uma restauração parcial ou sem suporte, então a cópia continua disponível para uma nova tentativa.

## O que não viaja

- **Caches do catálogo** (metadados e blobs de recursos baixados, o índice de ferramentas), que o destino sincroniza de novo sem custo.
- **Ferramentas e recursos do catálogo**, que estão fora do escopo e presume-se que estejam no destino. Os tokens de marca, fontes e logotipos que o usuário adicionou são recursos do usuário, então eles viajam.
- **URLs `blob:` e de objetos**, que a ponte regenera ao carregar.
- **Originais de conversão, concessões de execução ativas e segredos de acesso ou assinatura locais da máquina.** Não são histórico portátil. Um resultado salvo é uma cópia, não uma promessa de que a origem original passou por backup.
- **O contador de sequência de exportação**, o contador diário de nomes de download em `localStorage` (`lolly-export-seq`). Ele é mantido fora de `PREF_KEYS`, então nunca viaja em um pacote.

O medidor de armazenamento mostra a mesma divisão. Sessões salvas, My images e File results & versions vão para um pacote. O cache de recursos, as prévias de ferramentas e os itens fixados offline abaixo deles podem ser reconstruídos, então ficam para trás.

![O medidor de armazenamento dividindo os dados deste dispositivo em categorias nomeadas, com Saved sessions e My images acompanhados separadamente do Asset cache, aqui em uma instalação nova em que todas as categorias ainda estão vazias](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

## Dados da organização com o Lolly Work

Este pacote faz backup da biblioteca pessoal do dispositivo. Não é um backup de uma instância do **Lolly Work**: contas da organização, políticas de acesso, projetos compartilhados, versões do catálogo, aprovações, trabalhos de renderização e registros de auditoria ficam com esse serviço. Reconecte e faça login para recuperar o acesso ao trabalho compartilhado; importar um pacote pessoal não concede esse acesso.

Os operadores fazem backup, retêm e apagam os dados do servidor com os guias do próprio Lolly Work: [Backup and restore](/info/work-operations.html#backup-and-restore) e [Work storage and data lifecycle](/info/work-data-lifecycle.html). Limpar ou exportar um dispositivo não executa nenhuma dessas operações no servidor.

## Entre shells

O `data-transfer.ts` lê e grava apenas pela ponte de capacidades (`host.profile`, `host.state`, `host.assets`) e pelas preferências compartilhadas do `localStorage`. O mesmo módulo lê e grava o envelope comum na web e nos apps desktop e mobile, sobre armazenamento IndexedDB ou em sistema de arquivos. As partes opcionais de histórico só aparecem onde o adaptador delas está disponível, e uma parte sem suporte é informada como ignorada na importação. A suíte sem interface exercita as partes comuns contra uma ponte em memória, e as transações de histórico também têm testes em navegador real.

Dois shells ficam fora dessa garantia, por motivos diferentes:

- A **CLI de execução única** não tem nada a levar: o estado dela fica na memória e dura uma invocação.
- A **TUI** mantém o estado em `~/.lolly` (sessões, pastas, perfil), e a tela Profile dela pode fazer backup, mas grava um arquivo mais simples, próprio: `saved-state/<slot>.json` por sessão mais `profile.json` e `folders.json`, sem manifesto, sem `formatVersion` ou `minReader` e sem mapa de integridade. Este formato não consegue importá-lo (um leitor o rejeita como "not a Lolly backup"), e o nome dele é confusamente parecido (`lolly-backup-<stamp>.zip`). Unificar os dois é uma lacuna conhecida.

## Ainda não portável

O envelope é um manifesto mais partes nomeadas, então novos tipos de dados portáteis podem entrar depois como partes aditivas (um novo `formatVersion`, o mesmo `minReader`), e os leitores de hoje ignoram o que não reconhecem. Os sistemas de design já viajam assim, como `design-systems.json` mais seus recursos do usuário.

Dois nomes estão reservados para dados que ainda não viajam:

- **`tokens.json`** levaria um documento completo de design tokens [W3C DTCG](https://tr.designtokens.org/format/) com seus grupos, conjuntos e temas, o formato que o [Penpot importa e exporta](https://help.penpot.app/user-guide/design-systems/design-tokens/). Os tokens de marca do próprio usuário já viajam como o recurso `user/tokens/brand` em `assets.json`, e os tokens de um sistema de design viajam com o registro dele.
- **`penpot/`** está reservado para um arquivo Penpot ingerido, ou o subconjunto relevante para o Lolly, exposto como uma ferramenta.

Os leitores de hoje ainda não conhecem nenhum dos dois nomes. Como qualquer outra coisa fora das partes acima, cada um é uma parte desconhecida para eles: deixada intocada e contada em `skipped`.

## Partes de histórico

As duas partes de histórico são opcionais e têm versões próprias. A maioria dos leitores pode pular esta seção.

::: details Histórico de criação (v3)
Os backups manuais de uma instalação web com histórico de criação incluem `revision-history.json`, com o próprio esquema `{ version: 1, documents, revisions, recoveries }`. Ele carrega os IDs mantidos, instantâneos canônicos de entradas, marcas de versão, prévias raster e rascunhos separados do gravador. O adaptador de histórico captura as sessões atuais e suas cabeças em uma única transação de leitura, e o `sessions.json` usa os mesmos instantâneos atuais para leitores mais antigos.

A restauração confere o SHA-256 e a contagem de bytes do conteúdo, identidades únicas, relações entre documento e cabeça, ascendência, carimbos de data e hora, tipos de prévia e limites antes de confirmar o arquivo em uma única transação. Referências a pais compactados podem estar ausentes. O trabalho atual existente nunca é substituído em silêncio: quando uma criação existe nos dois lados, o lado que não fica atual vira um rascunho protegido.

O limite de transferência de 384 MiB do arquivo é conferido explicitamente, e os limites de armazenamento são aplicados sem truncar os pontos de restauração mantidos. A exportação grava `revision-history.json` e `sessions.json` em pedaços, com os mesmos bytes que um único `JSON.stringify` daria, para que o texto do arquivo nunca seja mantido inteiro. Um arquivo de histórico que passaria do limite é descartado no instante em que passa e só é contado a partir daí. O arquivo é então refeito sem seus pontos de restauração automáticos mais antigos, e o resumo da exportação os conta como `checkpointsLeftOut`, ou o arquivo é recusado por inteiro.

Um shell sem essa capacidade restaura as sessões comuns e informa a parte de histórico como ignorada. O histórico nativo em sistema de arquivos continua sem suporte até o adaptador dele fornecer transações de histórico duráveis. Convidados de um collab privado não têm histórico durável nem arquivo de recuperação.

O sync pessoal de instantâneos deixa o histórico de criação de fora. Aplicar um instantâneo a um documento local com histórico mantém o estado de trabalho anterior dele como um rascunho de recuperação separado e invalida o token de gravação de qualquer editor aberto. Seus pontos de restauração imutáveis ficam no dispositivo. Isso protege o histórico local durante a substituição por um instantâneo; não mescla históricos simultâneos de dispositivos.

As referências históricas a recursos são mantidas, enquanto a renderização ainda resolve os recursos pela biblioteca existente do destino. Este arquivo ainda não garante os bytes exatos de recursos antigos nem renderizações antigas de ferramentas. Os bytes de versões de recursos e de resultados de arquivos viajam em uma parte de backup própria.
:::

::: details Versões salvas e resultados de arquivos (v2)
A parte opcional de histórico guarda `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`, e os leitores também aceitam o formato anterior history-v1 sem lotes. Cada instantâneo traz o ID estável do recurso e a versão exata, o horário de salvamento, o tamanho em bytes e o SHA-256 em hexadecimal, além de um registro de recurso cujo `_file` e cujo `_credentialFile` opcional apontam para partes binárias. As operações carregam os fatos do arquivo original, a solicitação, o relatório, os carimbos de data e hora e um `_file` de resultado opcional. Nomes de backends de armazenamento, handles do OPFS e concessões de execução não viajam. Os leitores que só conhecem o history v1 recusam a nova versão de histórico antes de importar, em vez de descartar em silêncio a participação em lotes.

Os manifestos de lotes registram cada origem selecionada antes do processamento, inclusive arquivos nunca lidos, membros cancelados, falhas ao reservar espaço de resultado e trabalho interrompido. Cada membro tem um ID de operação estável, uma referência de origem e fatos, o nome de saída pedido e um relatório final. Uma origem não lida tem fatos declarados, não um digest inventado. A importação valida a identidade dos membros e a consistência com qualquer relatório de operação carregado. Os relatórios de lotes continuam disponíveis quando resultados individuais foram removidos, mas um recibo não significa que os bytes de saída dele ainda estejam armazenados.

- **Validação primeiro.** Todo registro de histórico conhecido, relatório e arquivo referenciado é validado antes que qualquer importação de perfil ou de recurso grave. Bytes ausentes e SHA-256 divergente falham mesmo quando o envelope não tem mapa de integridade. As credenciais extraídas continuam sendo arrays de bytes, inclusive em importações de gravadores mais antigos que as serializavam como objetos de chaves numéricas.
- **Trabalho em andamento.** As operações em andamento viram registros interrompidos no backup, com um relatório de falha explicativo e sem resultado. Restaurar nunca reinicia o trabalho em segundo plano nem importa uma concessão ativa. Tentar de novo significa selecionar o arquivo original de novo, conferido contra o SHA-256 registrado quando disponível.
- **Armazenamento.** Os resultados restaurados confirmam seus bytes e metadados juntos no IndexedDB. Os novos resultados comuns usam o OPFS onde disponível, com o IndexedDB como alternativa. Uma operação ativa existente nunca é substituída por uma importação.
- **Limites de backup.** A exportação transmite esses bytes para o arquivo, mas a restauração ainda descompacta um backup inteiro na memória, então os limites permanecem: **256 MiB de conteúdo de histórico**, **4 MiB de metadados de histórico**, no máximo **100 operações**, **100 lotes** e **2.000 instantâneos**. A exportação recusa explicitamente um histórico grande demais ou incompleto e nunca o deixa de fora em silêncio. Baixe as versões e os resultados importantes um a um antes de remover cópias locais mais antigas. Esses limites não são uma garantia medida de pico de memória para celulares.
- **Orçamentos locais.** O histórico local de resultados tem um orçamento de 512 MiB e um teto de 100 registros. Os instantâneos de recursos têm um orçamento separado de 512 MiB e no máximo 20 versões históricas por recurso, e os bytes de credenciais extraídas contam para esse orçamento. A restauração respeita esses limites e nunca remove em silêncio dados existentes do usuário.
- **Metadados de lotes.** Os metadados locais de lotes têm um orçamento separado de 4 MiB, no máximo 100 manifestos e 20 membros por lote. Os membros pendentes reservam capacidade de metadados, com um teto de relatório de 32 KiB por membro. É um orçamento lógico, não uma garantia de espaço em disco do navegador: uma falha real de cota é mostrada, e o relatório em memória continua disponível para download. Tentar de novo um membro de lote cria um novo lote sem sobrescrever o relatório antigo. Remover o registro de um lote não remove os bytes de resultados individuais nem os recursos da biblioteca.
- **Resultados na biblioteca.** Os resultados convertidos podem ser adicionados à biblioteca sem normalização nem recodificação, com os hashes de origem e de saída e a relação da operação anexados. Adições repetidas reaproveitam uma cópia inalterada, e uma cópia editada nunca é sobrescrita. Imagens raster podem iniciar um novo documento do Design, que usa o ID atual do recurso da biblioteca; impor fixações exatas de versão em todo o runtime e no caminho de URL do Design é outro trabalho. Os resultados SVG, HTML, PDF e ZIP são mantidos como recursos de arquivo opacos, e não promovidos a conteúdo interativo ou vetorial confiável.
- **Onde as pessoas veem isto.** **Convert → Recent file operations** mostra o uso do histórico, relatórios, downloads e o gerenciador de versões, que também encontra versões anteriores de recursos da biblioteca excluídos. Restaurar um instantâneo cria uma nova versão atual e mantém o instantâneo selecionado. **Settings → Preferences → Storage** conta resultados e versões separadamente dos caches descartáveis.
- **Limpeza.** A limpeza explícita de arquivos temporários remove apenas bytes pertencentes a operações e sem referência. Os registros atuais protegem seus arquivos, e os arquivos recentes do OPFS têm uma carência de uma hora. Os resultados salvos e os instantâneos de recursos não são limpos automaticamente.

Os leitores mais antigos ainda aceitam o envelope v2 (`minReader: 1`) e restauram as partes que conhecem, contando as partes de histórico sem suporte como ignoradas. A recuperação completa do histórico exige um shell com o adaptador `fileHistory`, uma junção dentro do shell e não uma nova capacidade `HostV1` voltada às ferramentas. A restauração real entre dois dispositivos é coberta pelo portão local do Chromium; a recuperação nos apps desktop, iOS e Android instalados ainda precisa ser aceita separadamente.
:::

## Referência

- Módulo: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; o gerador de nomes `backupFilename()` é interno).
- Teste de contrato: `tests/data-transfer.test.ts`, cobrindo ida e volta, mesclagem, integridade, compatibilidade futura e o portão do leitor.
- Testes de contrato do histórico: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` e `tests/file-result-library.test.ts`. Aceitação em navegador: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` e `tests/file-result-reuse.browser.test.ts`.
- Superfície da ponte usada: `host.profile`, `host.state` e `host.assets`; veja [Host API](/info/host-api.html).
