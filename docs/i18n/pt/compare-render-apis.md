# Lolly e APIs de renderização

_Última verificação: 5 de novembro de 2026._

Se hoje você gera imagens a partir de templates por meio de uma API, esta página diz o que muda se você mesmo operar essa produção: no seu próprio dispositivo, no CI ou em um servidor que você controla. [Move from a hosted render API](/info/work-move-from-render-api.html) explica como fazer.

## O que as APIs de renderização hospedadas fazem melhor

O [Bannerbear](https://www.bannerbear.com/) e o [Placid](https://placid.app/) são serviços gerenciados, e isso é uma vantagem real. Você envia uma solicitação e outra pessoa cuida dos servidores, os mantém no ar e lida com a carga.

- **Nada para operar.** Sem servidor, banco de dados, armazenamento, atualizações nem planejamento de capacidade.
- **Um editor de templates hospedado** com templates prontos para adaptar.
- **Mais tipos de saída a partir de uma API.** Ambos publicam endpoints de vídeo e PDF, e o Bannerbear também documenta saída animada, WebP e AVIF, capturas de tela e remoção de fundo por IA.
- **Integrações e suporte próprios.**

Se esse é o arranjo que você quer, esses serviços são uma boa escolha.

## O que a auto-hospedagem oferece

- **O seu conteúdo fica nos seus sistemas.** Entradas, recursos e saídas ficam na infraestrutura que você escolheu. Renderizar em um dispositivo ou no CI não precisa de nenhum serviço.
- **As regras ficam na ferramenta.** Cores, tipografia, logotipos e entradas bloqueadas vêm do seu [sistema de design](/info/brand-studio.html), então quem chama só pode mudar o que você permitir. O [Lolly Work](/info/compare.html#what-runs-where) aplica a visibilidade das ferramentas e as políticas de entrada a cada solicitação.
- **A mesma ferramenta em todo lugar.** Uma ferramenta renderiza em um notebook, em um job de CI ou em um servidor a partir das mesmas entradas, e as pessoas podem editar a mesma ferramenta no app.
- **Registros que ficam com você.** [Render receipts](/info/work-renders.html#evidence-and-identity), uma trilha de auditoria e Content Credentials onde você configura uma identidade de assinatura.
- **Código aberto e sem medidor.** Você executa o código, e o que você paga é a sua própria infraestrutura.

Você assume o trabalho que esses serviços fazem por você. Um servidor durável precisa de um banco de dados persistente e de armazenamento de saída, e as ferramentas que precisam de um navegador precisam do worker Chromium. [Install Lolly Work](/info/work-install.html) descreve ambos.

## Como os trabalhos se correspondem

| Trabalho | API de renderização hospedada | Lolly |
|---|---|---|
| Preencher um template com dados | Solicitação de API que nomeia um template e suas camadas | [URL](/info/url-mode.html), [CLI](/info/cli.html) ou [API de servidor](/info/work-automation-api.html) que nomeia uma ferramenta e suas entradas |
| Muitos arquivos a partir de uma tabela | Lotes e coleções | O [Batch](/info/batch.html) no seu dispositivo, ou [lotes de renderização](/info/work-renders.html#batches-with-durable-rows) em um servidor |
| Esperar ou consultar um resultado | Consulta periódica, ou uma opção síncrona | Renderizações duráveis que você consulta, ou uma renderização imediata |
| Chamar um webhook ao terminar | Sim | [Callbacks assinados](/info/work-renders.html) para origens que você permite |
| URL de imagem dinâmica | Sim | [Links de compartilhamento e URLs `/render`](/info/url-mode.html) |
| Editar um template | Editor hospedado | O [Design](/info/using.html), no seu dispositivo |
| Agentes | Ambos publicam um servidor MCP | O [MCP](/info/mcp.html), com um endpoint de organização sob a política de um token no Lolly Work |

Os tipos de saída do próprio Lolly estão listados em [Exporting](/info/exporting.html). Em um servidor Work hoje, as renderizações duráveis geram SVG, PNG, JPG e PDF, e o [vídeo continua no dispositivo, na CLI e no MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

## O que passa de um para o outro e o que não passa

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Suas solicitações | A API de migração do Work aceita o mesmo formato | Igual | Igual |
| Seus templates | **Import** como documentos editáveis, exceto tipos de camada sem esquema confirmado | Só nomes de campos e uma prévia. Reconstrua cada um | Só nomes de campos e uma prévia. Reconstrua cada um |
| URLs dinâmicas existentes | Não aceitas | Não aceitas | URLs assinadas continuam funcionando após a troca de host, com o seu antigo token privado |
| Webhooks | Webhooks registrados não são aceitos | `webhook_url` funciona | `webhook_success` funciona |
| Saída WebP e AVIF | Recusada pelo nome | Não oferecida | WebP recusado pelo nome |
| Animações, vídeos, coleções, capturas de tela | Não estão na API de migração | Não estão na API de migração | Não estão na API de migração |

Tudo isso foi montado a partir da documentação pública de cada fornecedor e não foi executado contra uma conta real. [The move guide](/info/work-move-from-render-api.html#check-it-on-your-own-account) tem uma lista curta de verificação, caso você tenha uma.

Migrar não é tudo ou nada. Você pode mover um template e deixar o resto onde está, e [sair também do Lolly](/info/work-move-from-render-api.html#leave-lolly-too) continua igualmente aberto: as ferramentas são arquivos simples e a CLI as renderiza sem servidor.

## Quem executa o serviço

Com o Lolly, uma pessoa renderiza localmente, ou uma equipe executa o Lolly Work na própria infraestrutura. Enviar um trabalho de servidor manda as entradas e os recursos necessários a essa instância, o que é diferente do caminho no dispositivo.

Bannerbear e Placid são marcas registradas dos respectivos titulares. Esta página descreve onde os produtos se sobrepõem, a partir da documentação pública deles, e não é afiliada a nenhum dos dois.
