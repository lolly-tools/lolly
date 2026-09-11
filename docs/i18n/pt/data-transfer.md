# Data Transfer - o pacote `lolly-backup`

Tudo que um usuário do Lolly acumula vive **no seu dispositivo** - sem conta, sem nuvem. O pacote de transferência de dados é como esse valor se move: exporte-o em uma instalação, leve o arquivo por qualquer meio (USB, AirDrop, e-mail para si mesmo, um compartilhamento de rede) e importe-o em outra. O arquivo *é* o transporte. O destino pode estar offline ou online. Não faz diferença, porque nada nunca fala com um servidor.

![Os dois botões que movem uma instalação inteira: Export my data grava um zip, Import data o lê de volta](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Esta página é a especificação do formato. Para o passo a passo do usuário final, veja [Using Lolly → Moving to another device](/info/using.html). A implementação está em [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), e [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) fixa o contrato de ida e volta.

> **Escopo.** Um pacote carrega *dados do usuário*, não ferramentas. Ferramentas e ativos do catálogo são sincronizados separadamente e presume-se que já estejam presentes no destino (no pior caso, em uma versão mais nova). Importar nunca instala ou atualiza uma ferramenta.

## Objetivos

- <!--i:box--> **Um formato, todo shell.** Os mesmos bytes são produzidos e consumidos pelo PWA web, pelos apps Tauri desktop/mobile e por qualquer shell futuro. O pacote é o contrato. A ponte de capacidades de cada shell é o adaptador específico da plataforma por trás dele.
- <!--i:shieldcheck--> **Sobrevive à viagem.** Um pacote corrompido ou truncado em trânsito falha de forma clara ao importar, nunca restaura pela metade.
- <!--i:clock--> **Sobrevive a esta versão.** Um app mais antigo ainda consegue importar as partes reconhecidas de um pacote mais novo. Um formato genuinamente incompatível é recusado de forma limpa.
- <!--i:check--> **Seguro para mesclar.** Importar em uma instalação já em uso nunca apaga nada que não estava no pacote.

## O envelope

Um pacote é um `.zip` simples. O download recebe o nome da pessoa a quem pertence - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (por exemplo `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - para que uma pasta de Downloads cheia de backups continue legível. As partes de primeiro e último nome vêm do perfil e são omitidas quando não definidas. Sem perfil, o resultado é `LollyTools-2026-06-26-1.zip`, e apenas um primeiro nome dá `LollyTools-Ada-2026-06-26-1.zip`. Cada parte é sanitizada para um token seguro para nome de arquivo (letras/dígitos Unicode mantidos, espaços/pontuação removidos, limitado a 32 caracteres). `<n>` é uma sequência por dia, por dispositivo, então exportações repetidas no mesmo dia não colidem e permanecem em ordem. `backupFilename()` em [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) monta o nome. O conteúdo do zip é idêntico independentemente do nome. Dentro:

| Path | Required | Contents |
|---|---|---|
| `manifest.json` | sim | Id do formato, versões, contagens e integridade por parte. A primeira coisa que um leitor examina. |
| `profile.json` | quando definido | O registro `me` do usuário (nome, contato, referência de foto, flags). Lido via `host.profile`. |
| `sessions.json` | sim | Cada sessão salva: slot, id/versão da ferramenta, rótulo, miniatura (data-URL) e dados de entrada completos. Lido via `host.state`. |
| `assets.json` | sim | Metadados de cada ativo enviado (imagens, fontes, tokens de marca), cada um apontando para seus bytes em `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | por ativo | Os bytes brutos do ativo (arquivos de imagem e fonte). Armazenados sem compressão (formatos já compactados). A extensão é cosmética. O MIME em `assets.json` é a fonte autoritativa. |
| `prefs.json` | sim | Preferências locais de propriedade do usuário: `theme`, `sidebarWidth` e a contagem de atividade `ct-metrics`. |
| `lolly.txt` | sim | Um resumo legível por humanos do pacote (contagens, perfil, nome do arquivo) para quem abrir o zip sem o Lolly. Regenerado a cada exportação e reconhecido na importação, então nunca conta como parte pulada. É escrito *depois* do mapa de integridade, então fica fora dele. |

O pacote é um zip simples de propósito: sobrevive a qualquer transporte intacto, e qualquer ferramenta de descompactação consegue inspecioná-lo.

`profile.json` é a menor parte e a primeira que um leitor vê no app: os detalhes que uma produtora preenche uma vez, mais o opt-in que permite às ferramentas usá-los.

![O formulário de detalhes do Profile que se torna profile.json - nome, contato, foto e o opt-in ao lado](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 1,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.webp": "sha256-…",
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

A importação é **mesclar e sobrescrever**, nunca substituir tudo:

- Os dados existentes no destino são deixados no lugar.
- Qualquer chave que colidir - o perfil, um slot de sessão, um id de imagem enviada - é substituída pela cópia importada.
- Nada que não estava no pacote é tocado. Uma sessão que o destino tinha, mas o pacote não, sobrevive à importação.

Sessões salvas se reconectam automaticamente às suas imagens: as referências de ativos são mantidas por id, e a ponte as resolve novamente depois que as imagens enviadas são restauradas (ela precisa fazer isso de qualquer forma, porque URLs `blob:` não sobrevivem a uma recarga).

O resumo de importação reporta `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` conta os ativos enviados que não puderam ser restaurados (armazenamento do dispositivo cheio, por exemplo). É distinto de `skipped`, que conta partes de um gravador mais novo e compatível para trás que esta build não reconheceu. A interface exibe `skipped` ("… · N newer items skipped"), então a restauração é honesta sobre o que deixou para trás.

## O que não viaja

- **Caches do catálogo** (metadados e blobs de ativos baixados, o índice de ferramentas) - ressincronizados de graça no destino.
- **Ferramentas e ativos de marca** - fora do escopo, e presume-se que já estejam presentes no destino.
- **URLs `blob:` / object URLs** - regeneradas pela ponte ao carregar.
- **O contador de sequência de exportação** - o contador de nomeação de download por dia (chave `localStorage` `lolly-export-seq`) é uma conveniência de nomeação local. Fica fora de `PREF_KEYS`, então nunca viaja em um pacote.

O medidor de armazenamento detalha essa mesma divisão. Sessões salvas e Minhas imagens viajam em um pacote. O cache de ativos, as prévias de ferramentas e os pins offline abaixo deles são todos re-deriváveis, então ficam de fora.

![O medidor de armazenamento dividindo os dados deste dispositivo em categorias nomeadas, com Saved sessions e My images rastreados separadamente do Asset cache, aqui em uma instalação nova onde toda categoria ainda está vazia](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## Garantia entre shells

`data-transfer.ts` le e grava exclusivamente através da bridge de capacidades (`host.profile`, `host.state`, `host.assets`) e das preferências compartilhadas em `localStorage`. Como a bridge é a única costura, o *mesmo* módulo produz um pacote byte a byte idêntico em cada shell, mesmo com o armazenamento subjacente diferindo - IndexedDB na web, o sistema de arquivos no Tauri. Os shells do Tauri reutilizam esse módulo sem alterações. Só a implementação de `host.state` deles é diferente. O teste headless exercita o round-trip completo contra uma bridge em memória, e é por isso que ele representa todos eles.

Dois shells ficam fora dessa garantia, por motivos diferentes:

- O **CLI one-shot** não tem nada para carregar - seu estado é em memória e efêmero por invocação.
- O **TUI** persiste estado sim (`~/.lolly`: sessões, pastas, perfil) e sua visão de Perfil pode fazer backup dele, mas grava um arquivo *mais simples*, próprio: `sessions/<slot>.json` por sessão mais `profile.json` e `folders.json`, sem manifesto, sem `formatVersion`/`minReader` e sem mapa de integridade. Ele **não** é importável por este formato - um leitor o rejeita como "not a Lolly backup" - e, para confundir, usa um nome parecido (`lolly-backup-<stamp>.zip`). Unificar os dois é uma lacuna conhecida.

## Pontos de extensão reservados

O envelope é um manifesto mais um conjunto de partes nomeadas por design, para que novos tipos de dados portáveis possam usá-lo depois **sem uma mudança que quebre compatibilidade**. Eles entram como partes aditivas (novo `formatVersion`, mesmo `minReader`), e o leitor de hoje ignora o que não reconhece. Isso está no [roadmap](/info/overview.html#roadmap), ainda não implementado. Os nomes são reservados aqui para que o formato permaneça coerente quando chegarem.

- **`tokens.json` - design tokens.** Um documento de design tokens [W3C DTCG](https://tr.designtokens.org/format/) (o formato que o [Penpot importa e exporta](https://help.penpot.app/user-guide/design-systems/design-tokens/) - tokens com `$value`/`$type`/`$description`, organizados em grupos, sets e temas). Um conjunto de tokens no pacote permite que um usuário mova os primitivos da sua marca entre instalações junto com suas sessões. No longo prazo, um conjunto de tokens ingerido se torna uma fonte de primeira classe que ferramentas e ativos de paleta resolvem contra.
- **`penpot/` - arquivos do Penpot ingeridos.** Um diretório reservado para um arquivo do Penpot (ou seu subconjunto extraído, relevante para o Lolly) importado e exposto *como uma ferramenta*. O pacote carregará a definição ingerida, para que viaje junto com o resto dos dados do usuário.

Qualquer coisa fora desses nomes reservados e das partes acima é, para um leitor, uma parte desconhecida: deixada intocada e contada em `skipped`.

## Referência

- Módulo: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - o nomeador `backupFilename()` é interno).
- Teste de contrato: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - casos de round-trip, merge, integridade, compatibilidade futura e bloqueio de leitor.
- Superfície de bridge usada: `host.profile`, `host.state`, `host.assets` - veja [Host API](/info/host-api.html).
