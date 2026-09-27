# Data Transfer - o pacote `lolly-backup`

Tudo que um usuário do Lolly acumula vive **no seu dispositivo** - sem conta, sem nuvem. O pacote de transferência de dados é como esse valor se move: exporte-o em uma instalação, leve o arquivo por qualquer meio (USB, AirDrop, e-mail para si mesmo, um compartilhamento de rede) e importe-o em outra. O arquivo *é* o transporte. O destino pode estar offline ou online. Não faz diferença, porque nada nunca fala com um servidor.

![Os dois botões que movem uma instalação inteira: Export my data grava um zip, Import data o lê de volta](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=%23storage-section%20.storage-subsection&dark=1&filename=pd-transfer-controls)

Esta página é a especificação do formato. Para o passo a passo do usuário final, veja [Encontre e recupere seu trabalho → Mova seu trabalho para outro dispositivo](/info/find-your-work.html#move-your-work-to-another-device). A implementação é [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), e [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) fixa o contrato de ida e volta.

> **Escopo.** Um pacote carrega *dados do usuário*, não ferramentas de catálogo. Ferramentas de catálogo e ativos de catálogo são sincronizados separadamente e presume-se que já estejam presentes no destino (no pior caso, em uma versão mais alta); ferramentas que o próprio usuário fez viajam dentro de `profile.json`. Importar nunca instala nem atualiza uma ferramenta de catálogo.

## Objetivos

- <!--i:box--> **Um formato, todo shell.** O PWA web, os apps de desktop/mobile do Tauri e futuros shells compartilham o mesmo envelope e os mesmos esquemas de parte suportados. Partes opcionais dependem das capacidades de cada shell; partes não suportadas são relatadas. Cada bridge de capacidade fornece seu próprio adaptador de armazenamento.
- <!--i:shieldcheck--> **Sobrevive à viagem.** Um pacote corrompido ou truncado no trajeto falha ruidosamente na importação, nunca restaura pela metade.
- <!--i:clock--> **Sobrevive a esta versão.** Um app mais antigo ainda consegue importar as partes reconhecidas de um pacote mais novo. Um formato genuinamente incompatível é recusado de forma limpa.
- <!--i:check--> **Seguro para mesclar.** Importar em uma instalação já em uso nunca apaga nada que não estava no pacote.

## O envelope

Um pacote é um `.zip` simples. O download recebe o nome da pessoa a quem pertence - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (por exemplo `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - para que uma pasta de Downloads cheia de backups continue legível. As partes de primeiro e último nome vêm do perfil e são omitidas quando não definidas. Sem perfil, o resultado é `LollyTools-2026-06-26-1.zip`, e apenas um primeiro nome dá `LollyTools-Ada-2026-06-26-1.zip`. Cada parte é sanitizada para um token seguro para nome de arquivo (letras/dígitos Unicode mantidos, espaços/pontuação removidos, limitado a 32 caracteres). `<n>` é uma sequência por dia, por dispositivo, então exportações repetidas no mesmo dia não colidem e permanecem em ordem. `backupFilename()` em [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) monta o nome. O conteúdo do zip é idêntico independentemente do nome. Dentro:

| Caminho | Obrigatório | Conteúdo |
|---|---|---|
| `manifest.json` | sim | Id do formato, versões, contagens e integridade por parte. A primeira coisa que um leitor observa. |
| `profile.json` | quando definido | Todo o registro `me` do usuário: nome, contato, referência de foto de perfil e flags, mais pastas, Lixeira, modelos de projeto, modelos do usuário e ferramentas feitas pelo usuário, favoritos, ferramentas ocultas, escolha de idioma e de emoji. Lido via `host.profile`. |
| `sessions.json` | sim | Cada sessão salva: slot, id/versão da ferramenta, rótulo, miniatura (data-URL) e todos os dados de entrada. Lido via `host.state`. |
| `assets.json` | sim | Metadados de cada ativo enviado (imagens, fontes, tokens de marca, logos, cópias salvas de downloads), cada um apontando para seus bytes em `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | por ativo | Os bytes brutos do ativo (arquivos de imagem e de fonte). Armazenados sem compressão (formatos já comprimidos). A extensão é cosmética. O MIME em `assets.json` é a autoridade. |
| `assets/blobs/<n>.c2pa` | quando presente | Content Credentials extraídas como bytes binários exatos, referenciadas por `_credentialFile` no registro do ativo. Não são chaves de assinatura do dispositivo. |
| `design-systems.json` | quando presente | Os design systems criados ou adicionados nesta instalação, como `{ active, records }`. Mesclado por id na importação; a escolha ativa do pacote se aplica só quando o destino não tem design system próprio. |
| `file-history.json` | opcional | Snapshots de ativos versionados, relatórios de operação de arquivo do terminal e manifestos de lote completos. A parte de histórico tem versão própria; fornecida pelo adaptador de backup interno `fileHistory` do shell. |
| `revision-history.json` | opcional, backups manuais | IDs de criação estáveis, checkpoints retidos, miniaturas e rascunhos rotativos de recuperação. Fornecida por `host.state.history.backup` onde suportado. |
| `file-history/versions/` | por snapshot | Bytes anteriores do ativo e credenciais extraídas, independente de o ativo atual ainda existir. |
| `file-history/results/` | por operação concluída | Bytes de saída exatos. Nenhum arquivo original selecionado para conversão é retido ou incluído. |
| `prefs.json` | sim | Preferências locais do próprio usuário: `theme`, `sidebarWidth` e a contagem de atividade `ct-metrics`. |
| `lolly.txt` | sim | Um resumo legível do pacote (contagens, perfil, nome do arquivo) para quem abrir o zip sem o Lolly. Regenerado a cada exportação e reconhecido na importação, então nunca conta como uma parte pulada. É escrito *depois* do mapa de integridade, então fica fora dele. |

O pacote é um zip simples de propósito: sobrevive a qualquer transporte intacto, e qualquer ferramenta de descompactação consegue inspecioná-lo.

`profile.json` é a menor parte e a primeira que um leitor vê no app: os detalhes que uma produtora preenche uma vez, mais o opt-in que permite às ferramentas usá-los.

![O formulário de detalhes do Profile que se torna profile.json - nome, contato, foto e o opt-in ao lado](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

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

| Field | Meaning |
|---|---|
| `format` | Sempre `lolly-backup`. Um arquivo sem isso é rejeitado como "not a Lolly backup". |
| `formatVersion` | O layout com que este pacote foi **escrito**. Incrementado a cada mudança no conjunto de partes ou formas. Os leitores **não** se baseiam nele. |
| `minReader` | A versão mínima de leitor necessária para importar este pacote **com segurança**. É neste campo que os leitores se baseiam. |
| `app` | Id do app produtor, para diagnóstico. |
| `exportedAt` | Timestamp ISO de quando o pacote foi criado. |
| `counts` | O que o gravador colocou, para exibição e verificação de sanidade. |
| `integrity` | Opcional. Mapeia cada parte, exceto `manifest.json`, a um digest no estilo SRI `sha256-<base64>` dos seus bytes **não compactados**. |

## Política de versão (compatibilidade futura)

A separação entre `formatVersion` e `minReader` é o que permite ao formato crescer sem deixar instalações antigas órfãs:

- Um leitor importa um pacote quando `manifest.minReader ≤` sua própria versão de leitor. Ele se recusa (com "needs a newer version of the app") somente quando o pacote exige explicitamente um leitor mais novo.
- Uma mudança **aditiva** - uma nova parte *opcional*, ou um novo campo opcional no manifesto - incrementa `formatVersion`, mas deixa `minReader` inalterado. Apps mais antigos ainda importam cada parte que reconhecem. Partes que não reconhecem são puladas (veja abaixo), não descartadas silenciosamente.
- Uma mudança **incompatível** - uma em que uma importação incorreta de uma parte corrompe dados, ou em que uma parte antes opcional passa a ser obrigatória - eleva `minReader`. Apps mais antigos então se recusam de forma limpa, em vez de importar algo que não conseguem tratar.
- Se um pacote futuro definir `formatVersion` mas omitir `minReader`, os leitores, por precaução, recorrem a se basear em `formatVersion` (tratando a mudança como incompatível).

> **Regra prática para autores:** se todo leitor existente ainda se comportaria corretamente ao ignorar sua adição, ela é aditiva - incremente `formatVersion`, deixe `minReader`. Caso contrário, eleve `minReader`.

## Integridade

Quando `manifest.integrity` está presente, um leitor verifica o SHA-256 de cada parte listada **antes de escrever qualquer coisa**. Uma divergência ("failed its integrity check") ou uma parte ausente ("incomplete") aborta toda a importação - não há restauração parcial. Isso captura a corrupção que um transporte de arquivo pode introduzir (um AirDrop truncado, um gateway de e-mail que recodificou o anexo, um setor de USB ruim).

A integridade é best-effort por design: só é escrita onde a Web Crypto está disponível (todo contexto seguro de navegador e Node moderno), e só é verificada quando tanto o mapa quanto a Web Crypto estão presentes. Um pacote sem o mapa - por exemplo, um de antes de a integridade existir - é importado sem alteração. "Não é possível verificar" nunca é tratado como "corrompido".

O manifesto não lista nem a si mesmo nem o README `lolly.txt` regenerado. Os digests cobrem as partes que o manifesto atesta.

## Semântica de importação

A importação é uma **mesclagem**, nunca substituição total:

- Os dados existentes no destino são deixados no lugar.
- Quando um slot de sessão ou id de imagem enviada está em ambos, a cópia salva mais recentemente é mantida, então um backup mais antigo nunca sobrescreve um trabalho mais novo no destino. Horários iguais ou desconhecidos mantêm a cópia do destino. Em uma instalação web com histórico de criação, a mesma regra decide qual cópia de uma criação permanece atual, e a outra cópia é mantida como um rascunho protegido (veja abaixo).
- O registro de perfil é mesclado, não substituído. Toda pasta no destino permanece com seu conteúdo; uma pasta do pacote que falta no destino é adicionada, e uma pasta presente em ambos mantém o nome e o pai do destino e ganha os membros do pacote que lhe faltam. Uma sessão arquivada em uma pasta no destino permanece arquivada lá.
- Favoritos (ferramentas, ativos de catálogo e itens de Projetos) são combinados. Modelos, modelos de Projetos e ferramentas do usuário do pacote são adicionados quando o destino não tem nenhum registro com aquele id. Entradas da Lixeira de ambos são mantidas, então um item que podia ser restaurado em qualquer uma das instalações ainda pode ser.
- Todo outro campo do perfil (nome, dados de contato, idioma, feature flags, ferramentas ocultas e as demais configurações) mantém o valor do destino. Um campo vazio no destino recebe o valor do pacote. O mesmo vale para `prefs.json`: uma preferência só é gravada onde o destino não tem nenhuma.
- A aplicação comum da sincronização de dispositivos é a exceção: para manter os dispositivos alinhados, ela usa o registro de perfil, as preferências, as sessões e as imagens da cópia sincronizada. Restaurar uma cópia anterior faz o mesmo, já que ela volta no tempo de propósito. A primeira adesão, **Trazer para este dispositivo**, mescla como uma importação.
- Versões históricas de ativos e IDs de operação são exceções imutáveis: uma importação repetida é idempotente, e um ID que já nomeia bytes/histórico diferentes é recusado, não sobrescrito. Reimportar um ativo atual idêntico preserva sua versão. Um ativo atual alterado precisa carregar uma versão diferente.
- O histórico de criação também se mescla. Uma criação presente nos dois lados mantém como atual a cópia salva mais recentemente, e a outra cópia se torna um rascunho protegido; uma criação cujo slot o destino usa para uma criação diferente é adicionada ao lado dela; uma criação na Lixeira do destino permanece lá. Um ID de checkpoint que nomeia conteúdo diferente no destino mantém o do destino. Um arquivo que falha em suas próprias verificações interrompe a importação antes de qualquer mudança de perfil, sessão, ativo ou preferência. Uma importação repetida idêntica não soma armazenamento.
- Nada que não estava no pacote é tocado. Uma sessão que o destino tinha, mas o pacote não, sobrevive à importação.

Sessões salvas se reconectam automaticamente às suas imagens: as referências de ativos são mantidas por id, e a ponte as resolve novamente depois que as imagens enviadas são restauradas (ela precisa fazer isso de qualquer forma, porque URLs `blob:` não sobrevivem a uma recarga).

O resumo de importação reporta `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` conta os ativos enviados que não puderam ser restaurados (armazenamento do dispositivo cheio, por exemplo). É distinto de `skipped`, que conta partes de um gravador mais novo e compatível para trás que esta build não reconheceu. A interface exibe `skipped` ("… · N newer items skipped"), então a restauração é honesta sobre o que deixou para trás.

Quando o histórico de arquivo está presente, o resumo também carrega `assetVersions`, `fileOperations` e `failedHistory`. Esgotamento de armazenamento ou conflitos de ID imutável podem causar uma restauração parcial; a interface diz ao usuário para manter o backup de origem. A sincronização na nuvem **não** avança sua revisão aplicada depois de uma restauração parcial ou não suportada, então o snapshot continua disponível para nova tentativa. Restaurar não é uma única transação em todos os armazenamentos de perfil/sessão/ativo/histórico.

## Histórico de criação (v3)

Backups manuais de um host web com capacidade de histórico incluem `revision-history.json` com seu próprio esquema `{ version: 1, documents, revisions, recoveries }`. Ele carrega os IDs retidos, snapshots canônicos de entrada, marcas de versão, prévias raster e rascunhos de redator separados. O adaptador de histórico captura as sessões atuais e suas pontas em uma única transação de leitura; `sessions.json` usa esses mesmos snapshots atuais para leitores mais antigos.

A restauração verifica o SHA-256 e as contagens de bytes do payload, identidades únicas, relações documento/head, ancestralidade, timestamps, tipos de prévia e limites antes de confirmar o arquivo em uma única transação. Referências de pai compactadas podem estar ausentes. O trabalho atual existente nunca é substituído silenciosamente: quando uma criação está presente nos dois lados, o lado que não é mantido como atual se torna um rascunho protegido. O limite de transferência de 384 MiB do arquivo é verificado explicitamente, e os limites de armazenamento são aplicados sem truncar checkpoints retidos. O backup geral ainda usa uma implementação de ZIP em memória e não é um arquivo em streaming.

O resumo adiciona `revisions` e `recoveryDrafts`, contando só o que esta importação adicionou, e `added`, `kept`, `replaced`, `copies` e `hidden` para como cada criação foi mesclada. Um shell sem essa capacidade restaura sessões comuns e relata a parte de histórico como pulada. O histórico de sistema de arquivos nativo continua sem suporte até seu adaptador fornecer transações de histórico duráveis. O estado de convidado P2P não tem histórico durável nem arquivo de recuperação.

A sincronização de snapshot pessoal exclui explicitamente o histórico de criação. Aplicar um snapshot a um documento local com histórico preserva seu estado de trabalho anterior como um rascunho de recuperação separado e invalida o token de escrita de qualquer editor aberto. Seus checkpoints imutáveis permanecem no dispositivo. Isso protege o histórico local durante a substituição de snapshot; não mescla históricos de dispositivos concorrentes.

Referências históricas de ativos são retidas, enquanto a renderização ainda resolve os ativos pela biblioteca existente do destino. Este arquivo ainda não garante bytes exatos de ativos antigos nem renderizações antigas da ferramenta. Bytes de versão de ativo e de resultado de arquivo continuam viajando pela sua própria parte de backup separada.

## Versões salvas e resultados de arquivo (v2)

A parte opcional de histórico contém `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`; leitores também aceitam o formato anterior history-v1 sem lotes. Cada snapshot identifica o ID estável do ativo e a versão exata, seu horário de salvamento, o comprimento em bytes e o SHA-256 hex, mais um registro de ativo cujo `_file` e `_credentialFile` opcional apontam para partes binárias. Operações carregam os fatos originais do arquivo, requisição, relatório, timestamps e `_file` de resultado opcional; nomes de backend de armazenamento, handles OPFS e leases de execução não viajam. Leitores mais antigos, só de history-v1, recusam a nova versão de histórico antes de importar, em vez de descartar silenciosamente a associação de lote.

Manifestos de lote registram cada fonte selecionada antes do processamento, incluindo arquivos nunca lidos, membros cancelados, falhas ao reservar espaço de resultado e trabalho interrompido. Cada membro tem um ID de operação estável, referência/fatos de fonte, nome de saída solicitado e relatório terminal. Uma fonte não lida tem fatos declarados, não um digest inventado. A importação valida a identidade do membro e a consistência com qualquer relatório de operação carregado. Relatórios de lote continuam disponíveis quando resultados individuais foram removidos explicitamente, mas um recibo não implica que os bytes de saída ainda estejam armazenados.

- Todo registro de histórico, relatório e arquivo referenciado conhecido é validado antes de qualquer escrita de importação de perfil ou ativo. Bytes ausentes e SHA-256 incompatível falham mesmo que o envelope não tenha um mapa de integridade. Credenciais extraídas permanecem como arrays de bytes, incluindo importações de escritores mais antigos que os serializaram em JSON como objetos de chave numérica.
- Operações em execução se tornam registros interrompidos no backup, com um relatório de falha explicativo e nenhum resultado. Restaurar nunca reinicia trabalho em segundo plano nem importa um lease ativo. Tentar de novo exige selecionar o arquivo original, checado contra seu SHA-256 registrado quando disponível.
- Resultados restaurados confirmam seus bytes e metadados juntos no IndexedDB. Resultados novos comuns usam OPFS quando disponível, com um fallback para IndexedDB. Uma operação ativa existente nunca é substituída por uma importação.
- A montagem do ZIP de histórico ainda é em memória: o limite atual é **256 MiB de payload de histórico**, **4 MiB de metadados de histórico**, no máximo **100 operações**, **100 lotes** e **2.000 snapshots**. A exportação recusa explicitamente histórico grande demais ou incompleto; nunca o omite silenciosamente. Baixe versões/resultados importantes individualmente antes de remover cópias locais mais antigas. Esses limites não são uma garantia medida de pico de memória para celulares.
- O histórico local de resultado tem um orçamento de 512 MiB e um teto de 100 registros. Snapshots de ativo têm um orçamento separado de 512 MiB e no máximo 20 versões históricas por ativo; bytes de credencial extraída contam para esse orçamento de snapshot. A restauração respeita esses limites e nunca despeja silenciosamente dados existentes do usuário.
- Metadados de lote locais têm um orçamento separado de 4 MiB, no máximo 100 manifestos e 20 membros por lote. Membros pendentes reservam capacidade de metadados, com um teto de relatório de 32 KiB por membro. Isso é um orçamento lógico, não uma garantia de espaço em disco do navegador; uma falha de cota real é sinalizada e o relatório em memória continua para download. Tentar de novo um membro de lote cria um novo lote sem sobrescrever o relatório antigo. Remover um registro de lote não remove bytes de resultado individuais nem ativos da biblioteca.
- Resultados convertidos podem ser explicitamente adicionados à biblioteca sem normalização ou recodificação. Hashes de origem/saída e a relação de operação acompanham o ativo. Adições repetidas reutilizam uma cópia inalterada; uma cópia editada nunca é sobrescrita. Imagens raster podem iniciar um novo documento Design. Esse documento usa o ID de ativo atual da biblioteca: aplicar fixações de versão exatas em todo o runtime e caminho de URL do Design ainda é trabalho separado. Resultados SVG/HTML/PDF/ZIP são mantidos como ativos de arquivo opacos por essa entrega, não promovidos a conteúdo interativo/vetorial confiável.
- **Convert → Operações recentes de arquivo** expõe o uso de histórico, relatórios, downloads e o gerenciador de versão. O gerenciador também encontra versões anteriores de ativos de biblioteca excluídos. Restaurar um snapshot cria uma nova versão atual mantendo intacto o snapshot selecionado. **Configurações → Armazenamento** contabiliza resultados e versões separadamente de caches descartáveis.
- A limpeza explícita de arquivo temporário remove só bytes pertencentes a uma operação e não referenciados. Registros atuais protegem seus arquivos; arquivos OPFS recentes têm um período de tolerância de uma hora. Resultados salvos e snapshots de ativo não são limpos automaticamente.

Leitores mais antigos ainda aceitam o envelope v2 (`minReader: 1`) e restauram as partes conhecidas, contando partes de histórico não suportadas como puladas. A recuperação completa de histórico exige um shell com o adaptador `fileHistory`; isso é uma costura interna do shell, não uma nova capacidade `HostV1` voltada para a ferramenta. A restauração real entre dois dispositivos é coberta pelo portão local do Chromium; a aceitação de recuperação instalada do Tauri/iOS/Android continua separada.

## O que não viaja

- **Caches de catálogo** (metadados e blobs de ativo baixados, o índice de ferramentas) - ressincronizados de graça no destino.
- **Ferramentas de catálogo e ativos de catálogo** - fora de escopo, e presume-se que já estejam presentes no destino. Tokens de marca, fontes e logos que o usuário adicionou são ativos do usuário, então eles viajam sim.
- **URLs `blob:` / de objeto** - regeneradas pela bridge ao carregar.
- **Originais de conversão, leases de execução ao vivo e segredos de acesso/assinatura locais à máquina** - não são payload de histórico portável. Um resultado salvo é uma cópia, não uma promessa de que a fonte original foi salva em backup.
- **O contador de sequência de exportação** - o contador de nomeação de download por dia (chave `localStorage` `lolly-export-seq`) é uma conveniência de nomeação local. Ele fica fora de `PREF_KEYS`, então nunca viaja em um pacote.

O medidor de armazenamento discrimina a mesma divisão. Sessões salvas, My images e File results & versions viajam em um pacote. O cache de ativos, prévias de ferramenta e fixações offline abaixo deles são todos rederiváveis, então ficam para trás.

![O medidor de armazenamento dividindo os dados deste dispositivo em categorias nomeadas, com Saved sessions e My images rastreados separadamente do Asset cache, aqui em uma instalação nova onde toda categoria ainda está vazia](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## Garantia entre shells

`data-transfer.ts` lê e escreve exclusivamente pela bridge de capacidade (`host.profile`, `host.state`, `host.assets`) e pelas preferências compartilhadas de `localStorage`. O mesmo módulo lê e escreve o envelope comum na web e no Tauri, sobre armazenamento IndexedDB ou de sistema de arquivos. Partes de histórico opcionais aparecem só onde o adaptador correspondente está disponível; uma parte não suportada é relatada como pulada na importação. A suíte headless exercita as partes comuns contra uma bridge em memória, enquanto as transações de histórico também têm testes em navegador real.

Dois shells ficam fora dessa garantia, por motivos diferentes:

- A **CLI de uma vez só** não tem nada para carregar - seu estado é em memória e efêmero por invocação.
- A **TUI** persiste estado sim (`~/.lolly`: sessões, pastas, perfil) e sua visão de Perfil pode fazer backup dele, mas ela escreve um arquivo *mais simples*, próprio: `saved-state/<slot>.json` por sessão mais `profile.json` e `folders.json`, sem manifesto, sem `formatVersion`/`minReader` e sem mapa de integridade. Ele **não** é importável por este formato - um leitor o rejeita como "not a Lolly backup" - e, para confundir mais, usa um nome parecido (`lolly-backup-<stamp>.zip`). Unificar os dois é uma lacuna conhecida.

## Pontos de extensão reservados

O envelope é, por design, um manifesto mais um conjunto de partes nomeadas, então novos tipos de dado portável podem viajar nele mais tarde **sem uma mudança que quebre compatibilidade**. Eles se encaixam como partes aditivas (novo `formatVersion`, mesmo `minReader`), e o leitor de hoje pula o que não reconhece. Essas partes ainda não foram construídas. Os nomes são reservados aqui para que o formato continue coerente quando elas chegarem.

- **`tokens.json` - tokens de design.** Um documento de tokens de design [W3C DTCG](https://tr.designtokens.org/format/) (o formato que o [Penpot importa e exporta](https://help.penpot.app/user-guide/design-systems/design-tokens/) - tokens com `$value`/`$type`/`$description`, organizados em grupos, conjuntos e temas). Um conjunto de tokens no pacote deixa o usuário mover os primitivos de marca entre instalações junto com suas sessões. (Os próprios tokens de marca do usuário já viajam hoje como o ativo `user/tokens/brand` em `assets.json`; esta parte carregaria um documento DTCG inteiro, com seus conjuntos e temas.) A mais longo prazo, um conjunto de tokens ingerido se torna uma fonte de primeira classe contra a qual ferramentas e ativos de paleta se resolvem.
- **`penpot/` - arquivos Penpot ingeridos.** Um diretório reservado para um arquivo Penpot (ou seu subconjunto extraído, relevante para o Lolly) importado e apresentado *como uma ferramenta*. O pacote carregará a definição ingerida, então ela viaja com o resto dos dados do usuário.

Qualquer coisa fora desses nomes reservados e das partes acima é, para um leitor, uma parte desconhecida: deixada intocada e contada em `skipped`.

## Referência

- Módulo: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - o nomeador `backupFilename()` é interno).
- Teste de contrato: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - casos de ida e volta, mesclagem, integridade, compatibilidade futura e portão de leitor.
- Testes de contrato de histórico: [`tests/file-history-backup.test.ts`](../tests/file-history-backup.test.ts), [`tests/file-batch-history.test.ts`](../tests/file-batch-history.test.ts) e [`tests/file-result-library.test.ts`](../tests/file-result-library.test.ts). Aceitação em navegador: [`tests/file-history.browser.test.ts`](../tests/file-history.browser.test.ts), [`tests/file-batch-history.browser.test.ts`](../tests/file-batch-history.browser.test.ts) e [`tests/file-result-reuse.browser.test.ts`](../tests/file-result-reuse.browser.test.ts).
- Superfície de bridge usada: `host.profile`, `host.state`, `host.assets` - veja [Host API](/info/host-api.html).
