# Transferência de dados: o pacote `lolly-backup`

Um pacote de backup transfere a biblioteca pessoal que o Lolly mantém no dispositivo: exporte-a em uma instalação, leve o arquivo (USB, AirDrop, e-mail para você mesmo ou um compartilhamento de rede) e importe-o em outra. A exportação e a importação não precisam de servidor, e o destino pode estar offline.

Esta é a especificação do formato para quem cria shells, ferramentas ou scripts para backups. Para transferir seu próprio trabalho, leia [Transfira seu trabalho para outro dispositivo](/info/find-your-work.html#move-your-work-to-another-device).

![Os dois botões que transferem uma instalação inteira: Export my data grava um zip, Import data o lê de volta](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note Escopo
Um pacote carrega *dados do usuário*, não ferramentas do catálogo. As ferramentas e os recursos do catálogo são sincronizados separadamente e pressupõe-se que estejam presentes no destino, no pior caso em uma versão superior. Ferramentas criadas por um usuário viajam dentro de `profile.json`. A importação nunca instala nem atualiza uma ferramenta do catálogo.
:::

<!--i:eti-badge-check-->
## Objetivos

- <!--i:box--> **Um formato, todos os shells.** O app web, os apps para desktop e celular e os futuros shells compartilham os mesmos esquemas de envelope e de partes. As partes opcionais dependem dos recursos de cada shell, e as partes sem suporte são informadas. Cada ponte de recursos fornece seu adaptador de armazenamento.
- <!--i:shieldcheck--> **Resiste à viagem.** Um pacote danificado ou truncado em trânsito falha na importação com um erro e nunca é restaurado pela metade.
- <!--i:clock--> **Dura além desta versão.** Um app mais antigo importa as partes de um pacote mais novo que reconhece. Um formato que quebra a compatibilidade é recusado sem problemas.
- <!--i:check--> **Seguro para mesclar.** Importar para uma instalação que já está em uso nunca apaga nada que não estava no pacote.

<!--i:eti-package-->
## O envelope

Um pacote é um `.zip` comum. Ele passa intacto por qualquer transporte, e qualquer ferramenta de descompactação pode inspecionar seu conteúdo.

O download recebe o nome de seu proprietário: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, por exemplo `LollyTools-Ada-Lovelace-2026-06-26-1.zip`. O nome e o sobrenome vêm do perfil e ficam de fora quando não estão definidos: sem perfil, o resultado é `LollyTools-2026-06-26-1.zip`, e só com o primeiro nome, é `LollyTools-Ada-2026-06-26-1.zip`. Cada nome vira um token seguro para nomes de arquivo (letras e dígitos Unicode mantidos, espaços e pontuação removidos, no máximo 32 caracteres). `<n>` é uma sequência por dia e por dispositivo, então exportações repetidas em um dia não entram em conflito e ficam em ordem. `backupFilename()` em `data-transfer.ts` monta o nome. O nome não muda o conteúdo do zip.

| Caminho | Obrigatório | Conteúdo |
|---|---|---|
| `manifest.json` | sim | Id do formato, versões, contagens e integridade por parte. Um leitor lê este arquivo primeiro. |
| `profile.json` | quando definido | O registro `me` do usuário: nome, contato, referência à foto de perfil e flags, mais pastas, Trash, planos de projeto, templates do usuário e ferramentas criadas pelo usuário, favoritos, ferramentas ocultas, idioma e escolha de emojis. Lido via `host.profile`. |
| `sessions.json` | sim | Todas as sessões salvas: slot, id e versão da ferramenta, rótulo, miniatura (URL de dados) e dados de entrada completos. Lido via `host.state`. |
| `assets.json` | sim | Metadados de cada recurso enviado (imagens, fontes, tokens de marca, logotipos, cópias salvas de downloads), cada um apontando para seus bytes em `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | por recurso | Os bytes brutos do recurso, armazenados sem compressão porque a maioria já está em formatos comprimidos. A extensão é cosmética; o tipo MIME em `assets.json` é o que vale. |
| `assets/blobs/<n>.c2pa` | quando presente | Content Credentials extraídas como bytes binários exatos, referenciadas por `_credentialFile` no registro do recurso. Não são chaves de assinatura do dispositivo. |
| `design-systems.json` | quando presente | Os sistemas de design criados ou adicionados nesta instalação, como `{ active, records }`. Veja [Regras de importação](#import-rules). |
| `file-history.json` | opcional | Instantâneos versionados de recursos, relatórios de operações de arquivo concluídas e manifestos de lote completos, com uma versão própria. Fornecido pelo adaptador interno de backup `fileHistory` do shell. |
| `revision-history.json` | opcional, backups manuais | IDs estáveis de criação, pontos de controle mantidos, miniaturas e rascunhos de recuperação atualizados continuamente. Fornecido por `host.state.history.backup` onde há suporte. |
| `file-history/versions/` | por instantâneo | Bytes anteriores dos recursos e credenciais extraídas, exista ou não o recurso atual. |
| `file-history/results/` | por operação concluída | Bytes exatos de saída. Nenhum arquivo original selecionado para conversão é mantido ou incluído. |
| `prefs.json` | sim | Preferências locais do usuário: `theme`, `sidebarWidth` e a contagem de atividades `ct-metrics`. |
| `lolly.txt` | sim | Um resumo legível do pacote (contagens, perfil, nome do arquivo) para quem abre o zip sem o Lolly. Gerado novamente em cada exportação e reconhecido na importação, então nunca conta como uma parte ignorada. É gravado depois do mapa de integridade, então o mapa não cobre este arquivo. |

::: details Como a exportação grava o zip
A exportação grava o zip uma parte por vez (`shells/web/src/lib/zip-stream.ts`). Uploads, resultados salvos e versões salvas de recursos são lidos em fatias de 4 MiB, nunca por inteiro. Os resultados e as versões salvos são primeiro conferidos com seu SHA-256 registrado. Depois, cada arquivo é lido para obter sua soma de verificação e seu resumo de integridade, e o zip referencia o arquivo onde ele está.

Nada é recodificado. Cada parte mantém seus bytes e seu resumo criptográfico exatos, então um arquivo que carrega Content Credentials mantém os bytes cobertos por sua assinatura. Para as mesmas partes e o mesmo horário, o zip é idêntico ao do gravador anterior em memória, exceto que um arquivo de histórico com mais de 16 MiB é comprimido em partes. `tests/backup-streaming.test.ts` verifica isso com resumos de referência registrados.

Em uma biblioteca sintética de 192 MiB, medido em Node, finalizar o backup usou cerca de 125 a 150 MiB além da biblioteca, contra cerca de 850 MiB para o gravador em memória (`node scripts/bench-backup-finalise.ts`). A importação ainda lê o zip inteiro para a memória.
:::

<!--i:eti-file-->
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
| `format` | Sempre `lolly-backup`. Um arquivo sem ele é rejeitado como "não é um backup do Lolly". |
| `formatVersion` | O layout com que este pacote foi **gravado**. Incrementado a cada mudança no conjunto ou na estrutura das partes. Os leitores **não** usam este campo para decidir se podem importar. |
| `minReader` | A versão mínima de leitor que pode importar este pacote **com segurança**. É este campo que os leitores usam para decidir se podem importar. |
| `app` | Id do app que gerou o pacote, para diagnóstico. |
| `exportedAt` | Data e hora ISO em que o pacote foi criado. |
| `counts` | O que o gravador incluiu, para exibição e verificações de consistência. |
| `integrity` | Opcional. Mapeia cada parte, exceto `manifest.json`, para um resumo `sha256-<base64>` no estilo SRI de seus bytes **não comprimidos**. |

<!--i:eti-tag-->
## Política de versões

Dois números de versão permitem que o formato cresça sem deixar instalações mais antigas sem suporte.

![Uma mudança no formato do pacote é aditiva, que leitores antigos podem ignorar, ou quebra a compatibilidade, quando uma importação incorreta corrompe dados. Uma mudança aditiva incrementa formatVersion e mantém minReader; uma mudança que quebra a compatibilidade incrementa formatVersion e aumenta minReader. Um leitor importa quando minReader é no máximo igual à sua própria versão.](/info/diagrams/concepts/backup-version-gate.svg)

- Um leitor importa um pacote quando `manifest.minReader` é no máximo igual à sua própria versão de leitor. Ele recusa, com "precisa de uma versão mais nova do app", apenas quando o pacote exige um leitor mais novo.
- Uma mudança **aditiva**, como uma nova parte opcional ou um novo campo opcional no manifesto, incrementa `formatVersion` e mantém `minReader`. Apps mais antigos ainda importam todas as partes que reconhecem, e as partes que não reconhecem são informadas como ignoradas, sem serem descartadas silenciosamente.
- Uma mudança **que quebra a compatibilidade**, em que a importação incorreta de uma parte corrompe dados ou uma parte opcional se torna obrigatória, aumenta `minReader`. Apps mais antigos então recusam sem problemas em vez de importar algo que não conseguem processar. Apps mais antigos então recusam o pacote sem problemas.
- Se um pacote futuro define `formatVersion`, mas deixa `minReader` de fora, os leitores passam a usar `formatVersion` para decidir se podem importar e tratam a mudança como uma quebra de compatibilidade.

::: note Regra prática para autores
Se todos os leitores existentes ainda funcionariam corretamente ao ignorar seu acréscimo, a mudança é aditiva: incremente `formatVersion` e mantenha `minReader`. Caso contrário, aumente `minReader`.
:::

<!--i:eti-shield-check-->
## Integridade

Quando `manifest.integrity` está presente, um leitor verifica o SHA-256 de cada parte listada **antes de gravar qualquer coisa**. Uma divergência ("falhou na verificação de integridade") ou uma parte ausente ("incompleto") interrompe a importação, então não há restauração parcial. Isso detecta danos de transporte: um AirDrop truncado, um gateway de e-mail que recodificou o anexo, um setor defeituoso em um dispositivo USB.

A integridade é tratada na medida do possível. Ela é gravada apenas onde Web Crypto está disponível (todo contexto seguro de navegador e Node moderno) e verificada apenas quando o mapa e Web Crypto estão presentes. Um pacote sem o mapa, como um de antes de existir integridade, é importado sem mudanças: "não é possível verificar" nunca conta como "corrompido".

O manifesto não lista a si próprio nem o `lolly.txt` gerado novamente.

<!--i:eti-download-->
## Regras de importação

Uma importação roda em um de dois modos.

- **Merge** é o que **Import data…** e a primeira adesão à sincronização, **Bring it to this device**, fazem. Os dados no destino permanecem, e nada fora do pacote é alterado.
- **Replace** é o que a sincronização de dispositivos usa para mantê-los alinhados. Ela usa o registro de perfil, as preferências, as sessões, as imagens e a escolha do sistema de design ativo da cópia sincronizada. Remove apenas itens que outro dispositivo excluiu desde a última sincronização. Restaurar uma cópia anterior primeiro salva o dispositivo, depois faz o dispositivo corresponder a essa cópia e remove tudo o que a cópia não contém. [Sincronize seus dispositivos](/info/sync.html) cobre o que uma pessoa vê.

Uma mesclagem trata cada tipo de dado assim:

| Dados | Já no destino | Só no pacote |
|---|---|---|
| Sessões (por slot) e imagens enviadas (por id) | A cópia salva mais recentemente é mantida, então um backup mais antigo nunca sobrescreve trabalhos mais novos. Horários iguais ou desconhecidos mantêm a cópia do destino. | Adicionados |
| Pastas | O nome e a pasta pai do destino são mantidos, e a pasta recebe os membros do pacote que ainda não tem. Uma sessão arquivada em uma pasta no destino continua arquivada ali. | Adicionadas |
| Favoritos (ferramentas, recursos do catálogo e itens de Projects) | Combinados | Adicionados |
| Templates, templates de Projects e ferramentas do usuário (por id) | O registro do destino é mantido. | Adicionados |
| Entradas de Trash | A entrada do destino é mantida. | Adicionadas, para que um item que poderia ser restaurado em qualquer instalação ainda possa ser. Uma entrada cuja pasta voltou a ser usada no destino, ou cujo slot de Trash o destino já usa, fica de fora. |
| Outros campos de perfil (nome, dados de contato, idioma, flags de recursos, ferramentas ocultas e outras configurações) | O valor do destino é mantido. | Usados quando o campo do destino está vazio |
| Preferências (`prefs.json`) | O valor do destino é mantido. | Gravadas onde o destino não tem nenhuma |
| Sistemas de design (por id) | O registro do pacote substitui o do destino. | Adicionados. A escolha ativa do pacote só se aplica quando o destino não tem um sistema de design próprio. |
| Histórico de criação | A cópia salva mais recentemente continua atual, e a outra é mantida como um rascunho protegido. | Adicionado |

**As sessões salvas se vinculam novamente às suas imagens de forma automática.** As referências aos recursos são mantidas por id. A ponte as resolve novamente depois que as imagens são restauradas, porque URLs `blob:` não sobrevivem a um recarregamento.

**Os registros de histórico nunca mudam depois de gravados.** Uma importação repetida de versões de recursos e IDs de operações não acrescenta nada, e um ID que já identifica bytes ou histórico diferentes é recusado, não sobrescrito. Reimportar um recurso atual idêntico mantém sua versão, e um recurso atual alterado deve carregar uma versão diferente.

**O histórico de criação tem mais algumas regras.** Uma criação cujo slot o destino usa para uma criação diferente é adicionada como uma criação separada, e uma criação em Trash no destino permanece ali. Um id de ponto de controle que identifica conteúdo diferente no destino mantém o do destino. Um arquivo compactado que falha em suas próprias verificações interrompe a importação antes de qualquer mudança em perfil, sessão, recurso ou preferência, e uma importação repetida idêntica não usa armazenamento adicional.

**O resumo informa o que aconteceu.** Toda importação retorna `profile`, `sessions`, `userAssets`, `prefs`, `skipped` e `failedAssets`.

- `failedAssets` conta recursos enviados que não puderam ser restaurados, por exemplo porque o armazenamento do dispositivo está cheio.
- `skipped` conta partes de um gravador mais novo que esta compilação não reconheceu. O app mostra a contagem ("… · N itens mais novos ignorados").
- Com histórico de arquivos, o resumo acrescenta `assetVersions`, `fileOperations`, `fileBatches` e `failedHistory`. A falta de espaço de armazenamento ou um conflito de ID imutável pode causar uma restauração parcial, e o app então orienta a pessoa a manter o backup de origem.
- Com histórico de criação, acrescenta `revisions` e `recoveryDrafts`, contando apenas o que esta importação adicionou, e `added`, `kept`, `replaced`, `copies` e `hidden` para indicar como cada criação foi mesclada. `skippedCheckpoints` conta pontos de controle cujo id identifica conteúdo diferente no destino, e `historyLeftOut` conta pontos de controle e rascunhos mais antigos que não couberam no espaço de histórico do dispositivo.
- Uma importação por substituição acrescenta `removed` e `failedRemovals`.

A restauração não é uma única transação entre os armazenamentos de perfil, sessões, recursos e histórico. A sincronização na nuvem **não** avança sua revisão aplicada após uma restauração parcial ou não suportada, então a cópia continua disponível para tentar de novo.

<!--i:eti-unlink-->
## O que não é transferido

- **Caches do catálogo** (metadados e blobs de recursos baixados, o índice de ferramentas), que o destino sincroniza de novo.
- **Ferramentas e recursos do catálogo**, que se supõe já estarem no destino. Tokens de marca, fontes e logotipos que o usuário adicionou são recursos do usuário e são transferidos.
- **URLs `blob:` e de objetos**, que a ponte recria ao carregar.
- **Originais de conversão, concessões de execução ativas e segredos de acesso ou assinatura locais da máquina.** Isso não é histórico portátil. Um resultado salvo é uma cópia. Isso não significa que houve backup da fonte original.
- **O contador de sequência de exportação**, o contador diário para nomear downloads em `localStorage` (`lolly-export-seq`). Ele fica fora de `PREF_KEYS`, então nunca é transferido em um pacote.

O medidor de armazenamento mostra a mesma divisão. Saved sessions, My images e File results & versions entram em um pacote. O cache de recursos, as prévias de ferramentas e os itens fixados para uso offline podem ser recriados e ficam de fora.

![O medidor de armazenamento dividindo os dados deste dispositivo em categorias nomeadas, com Saved sessions e My images contabilizados separadamente de Asset cache, aqui em uma instalação nova em que todas as categorias ainda estão vazias](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

<!--i:eti-building-->
## Dados da organização com o Lolly Work

Este pacote faz backup da biblioteca pessoal do dispositivo. Um pacote não é um backup de uma instância do **Lolly Work**. Contas da organização, políticas de acesso, projetos compartilhados, versões do catálogo, aprovações, trabalhos de renderização e registros de auditoria ficam nesse serviço. Reconecte-se e entre para recuperar o acesso ao trabalho compartilhado. Importar um pacote pessoal não concede esse acesso.

Os operadores fazem backup, retêm e apagam dados do servidor com os guias do próprio Lolly Work: [Backup e restauração](/info/work-operations.html#backup-and-restore) e [Armazenamento e ciclo de vida dos dados do Lolly Work](/info/work-data-lifecycle.html). Limpar ou exportar um dispositivo não executa nenhuma dessas operações no servidor.

<!--i:eti-monitor-->
## Entre shells

`data-transfer.ts` lê e grava apenas pela ponte de capacidades (`host.profile`, `host.state`, `host.assets`) e pelas preferências compartilhadas de `localStorage`. O mesmo módulo lê e grava o envelope comum na web e nos apps para desktop e celular, sobre IndexedDB ou armazenamento no sistema de arquivos. As partes opcionais de histórico aparecem apenas onde seu adaptador está disponível. A importação informa que uma parte não suportada foi ignorada. A suíte de testes sem interface exercita as partes comuns com uma ponte em memória, e as transações de histórico também têm testes em navegador real.

Dois shells ficam fora dessa garantia:

- A **CLI de execução única** não tem nada para levar: seu estado fica na memória e dura uma invocação.
- A **TUI** mantém o estado em `~/.lolly` (sessões, pastas, perfil). Sua visualização Profile grava um arquivo de backup próprio, mais simples: `saved-state/<slot>.json` por sessão mais `profile.json` e `folders.json`, sem manifesto, sem `formatVersion` nem `minReader` e sem mapa de integridade. Um leitor deste formato rejeita esse arquivo como "não é um backup do Lolly", embora os nomes sejam parecidos (`lolly-backup-<stamp>.zip`). Unificar os dois é uma lacuna conhecida.

<!--i:eti-clock-->
## Ainda não portáteis

Novos tipos de dados portáteis podem entrar depois como partes adicionais (um novo `formatVersion`, o mesmo `minReader`). Os sistemas de design já são transferidos assim, como `design-systems.json` mais seus recursos do usuário.

Dois nomes estão reservados para dados que ainda não são transferidos:

- **`tokens.json`** levaria um documento de tokens de design [W3C DTCG](https://tr.designtokens.org/format/) com seus grupos, conjuntos e temas, o formato que o [Penpot importa e exporta](https://help.penpot.app/user-guide/design-systems/design-tokens/). Os tokens de marca do próprio usuário já são transferidos como o recurso `user/tokens/brand` em `assets.json`, e os tokens de um sistema de design são transferidos com seu registro.
- **`penpot/`** está reservado para um arquivo Penpot ingerido, ou seu subconjunto relevante para o Lolly, disponibilizado como ferramenta.

<!--i:eti-history-->
## Partes de histórico

As duas partes de histórico são opcionais e têm versões próprias.

::: details Histórico de criação (v3)
Backups manuais de uma instalação web com histórico de criação incluem `revision-history.json`, com seu próprio esquema `{ version: 1, documents, revisions, recoveries }`. Ele leva os IDs mantidos, snapshots canônicos das entradas, marcadores de versão, prévias raster e rascunhos separados por gravador. O adaptador de histórico captura as sessões atuais e suas revisões mais recentes em uma única transação de leitura, e `sessions.json` usa os mesmos snapshots atuais para leitores mais antigos.

A restauração verifica SHA-256 e contagens de bytes da carga útil, identidades únicas, relações entre documentos e revisões mais recentes, ancestralidade, carimbos de data e hora, tipos de prévia e limites antes de gravar o arquivo em uma única transação. Referências a revisões ancestrais compactadas podem estar ausentes. O trabalho atual existente nunca é substituído silenciosamente: quando uma criação está nos dois lados, o lado que não é mantido como atual vira um rascunho protegido.

O arquivo tem um limite de transferência de 384 MiB. Os limites de armazenamento são aplicados sem truncar os pontos de verificação mantidos. A exportação grava `revision-history.json` e `sessions.json` em blocos, com os mesmos bytes que uma única chamada de `JSON.stringify` produz, então o texto do arquivo nunca é mantido inteiro em memória. Um arquivo de histórico que ultrapassaria o limite é descartado no momento em que o ultrapassa e, daí em diante, apenas contabilizado. O arquivo é então gerado de novo sem seus pontos de verificação automáticos mais antigos, e o resumo da exportação os contabiliza como `checkpointsLeftOut`, ou o arquivo é recusado.

Um shell sem essa capacidade restaura as sessões comuns e informa que a parte de histórico foi ignorada. O histórico nativo no sistema de arquivos continua sem suporte até que seu adaptador forneça transações duráveis de histórico. Convidados em uma colaboração privada não têm histórico durável nem arquivo de recuperação.

A sincronização de snapshots pessoais deixa o histórico de criação de fora. Aplicar um snapshot a um documento local com histórico mantém seu estado de trabalho anterior como um rascunho de recuperação separado e invalida o token de gravação de qualquer editor aberto. Seus pontos de verificação imutáveis ficam no dispositivo. Isso protege o histórico local durante a substituição por um snapshot. Não mescla históricos simultâneos de dispositivos.

As referências históricas a recursos são mantidas, mas a renderização ainda resolve os recursos pela biblioteca existente no destino. Este arquivo ainda não garante os bytes exatos dos recursos antigos nem as renderizações antigas das ferramentas. Os bytes das versões de recursos e dos resultados de arquivos são transferidos em sua própria parte do backup.
:::

::: details Versões salvas e resultados de arquivos (v2)
A parte opcional de histórico contém `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`, e os leitores também aceitam a estrutura anterior history-v1, sem lotes. Cada snapshot informa o ID estável do recurso e a versão exata, a hora em que foi salvo, o tamanho em bytes e o SHA-256 hexadecimal, além de um registro de recurso cujos `_file` e `_credentialFile` opcional apontam para partes binárias. As operações levam os dados do arquivo original, a solicitação, o relatório, os carimbos de data e hora e o resultado opcional `_file`. Nomes de backends de armazenamento, identificadores OPFS e concessões de execução não são transferidos. Leitores que conhecem apenas o histórico v1 recusam a nova versão do histórico antes de importar, então a associação a lotes nunca é descartada silenciosamente.

Os manifestos de lote registram cada fonte selecionada antes do processamento, incluindo arquivos nunca lidos, membros cancelados, falhas ao reservar espaço para resultados e trabalho interrompido. Cada membro tem um ID de operação estável, referência e dados da fonte, nome de saída solicitado e relatório final. Uma fonte não lida tem dados declarados, não um resumo criptográfico inventado. A importação valida a identidade do membro e a consistência com qualquer relatório de operação incluído. Os relatórios do Lolly Batch continuam disponíveis quando resultados individuais foram removidos, mas um recibo não significa que seus bytes de saída ainda estão armazenados.

- **Validação primeiro.** Cada registro de histórico, relatório e arquivo referenciado conhecido é validado antes de qualquer gravação de importação de perfil ou recurso. Bytes ausentes e divergências de SHA-256 causam falha mesmo quando o envelope não tem mapa de integridade. As credenciais extraídas continuam como arrays de bytes, incluindo importações de gravadores antigos que as serializavam como objetos com chaves numéricas.
- **Trabalho em execução.** Operações em execução viram registros interrompidos no backup, com um relatório de falha e sem resultado. A restauração nunca reinicia trabalho em segundo plano nem importa uma concessão ativa. Tentar de novo exige selecionar o arquivo original outra vez, verificado contra seu SHA-256 registrado quando disponível.
- **Armazenamento.** Os resultados restaurados gravam seus bytes e metadados juntos no IndexedDB. Novos resultados comuns usam OPFS onde disponível, com IndexedDB como alternativa. Uma operação ativa existente nunca é substituída por uma importação.
- **Limites de backup.** A exportação transmite esses bytes para o arquivo em fluxo, mas a restauração ainda descompacta um backup inteiro em memória, então os limites continuam: **256 MiB de carga útil de histórico**, **4 MiB de metadados de histórico**, no máximo **100 operações**, **100 lotes** e **2.000 snapshots**. A exportação recusa explicitamente um histórico grande demais ou incompleto e nunca o deixa de fora silenciosamente. Baixe versões e resultados importantes um por um antes de remover cópias locais mais antigas. Esses limites não são uma garantia medida do pico de uso de memória em celulares.
- **Cotas locais.** O histórico local de resultados tem uma cota de 512 MiB e um limite de 100 registros. Os snapshots de recursos têm uma cota separada de 512 MiB e no máximo 20 versões históricas por recurso, e os bytes de credenciais extraídas contam nessa cota. A restauração respeita esses limites e nunca remove silenciosamente dados existentes do usuário.
- **Metadados de lote.** Os metadados locais de lote têm uma cota separada de 4 MiB, no máximo 100 manifestos e 20 membros por lote. Membros pendentes reservam capacidade de metadados, com um limite de 32 KiB por relatório de membro. Esta é uma cota lógica, não uma garantia de espaço em disco do navegador: uma falha real de cota é exibida, e o relatório em memória continua disponível para download. Tentar de novo um membro do lote cria um novo lote sem sobrescrever o relatório antigo. Remover um registro de lote não remove bytes de resultados individuais nem recursos da biblioteca.
- **Resultados na biblioteca.** Resultados convertidos podem ser adicionados à biblioteca sem normalização nem recodificação, com os hashes da fonte e da saída e a relação com a operação anexados. Adições repetidas reutilizam uma cópia que não foi alterada, e uma cópia editada nunca é sobrescrita. Imagens raster podem iniciar um novo documento do Lolly Design, que usa o ID atual do recurso da biblioteca. Impor versões exatas fixadas em todo o runtime e no caminho de URL do Lolly Design é um trabalho separado. Resultados SVG, HTML, PDF e ZIP são mantidos como recursos de arquivo opacos, sem serem promovidos a conteúdo interativo ou vetorial confiável.
- **Onde as pessoas veem isso.** **Convert → Recent file operations** mostra o uso do histórico, relatórios, downloads e o gerenciador de versões, que também encontra versões anteriores de recursos excluídos da biblioteca. Restaurar um snapshot cria uma nova versão atual e mantém o snapshot selecionado. **Settings → Preferences → Storage** contabiliza resultados e versões separadamente dos caches descartáveis.
- **Limpeza.** A limpeza explícita de arquivos temporários remove apenas bytes que pertencem a operações e não têm referências. Os registros atuais protegem seus arquivos, e arquivos OPFS recentes têm um período de tolerância de uma hora. Resultados salvos e snapshots de recursos não são apagados automaticamente.

Leitores mais antigos ainda aceitam o envelope v2 (`minReader: 1`) e restauram as partes que conhecem, contabilizando as partes de histórico não suportadas como ignoradas. A recuperação completa do histórico exige um shell com o adaptador `fileHistory`, um ponto de integração dentro do shell, não uma capacidade `HostV1` voltada às ferramentas. A restauração real entre dois dispositivos é coberta pela verificação local em Chromium. A recuperação em apps instalados para desktop, iOS e Android ainda precisa passar por aceitação separada.
:::

<!--i:eti-code-->
## Referência

- Módulo: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; a função de nomeação `backupFilename()` é interna).
- Teste de contrato: `tests/data-transfer.test.ts`, cobrindo ida e volta, mesclagem, integridade, compatibilidade futura e a verificação de versão do leitor.
- Testes de contrato do histórico: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` e `tests/file-result-library.test.ts`. Aceitação no navegador: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` e `tests/file-result-reuse.browser.test.ts`.
- Interface da ponte usada: `host.profile`, `host.state` e `host.assets`; veja [API do host](/info/host-api.html).
