# Lolly e APIs de renderização

_Última verificação: 5 de novembro de 2026._

Se você gera imagens a partir de templates por uma API, esta página diz o que muda quando você executa essa produção no seu próprio dispositivo, em CI ou em um servidor que controla. [Migrar de uma API de renderização hospedada](/info/work-move-from-render-api.html) traz as etapas.

<!--i:eti-award-->
## O que as APIs de renderização hospedadas fazem melhor

[Bannerbear](https://www.bannerbear.com/) e [Placid](https://placid.app/) são serviços gerenciados: você envia uma solicitação e outra pessoa opera os servidores.

- **Nada para operar.** Sem servidor, banco de dados, armazenamento, atualizações ou planejamento de capacidade.
- **Um editor de templates hospedado** com templates prontos para adaptar.
- **Mais tipos de saída em uma API.** Ambos publicam endpoints de vídeo e PDF, e o Bannerbear também documenta saída animada, WebP e AVIF, capturas de tela e remoção de fundo por IA.
- **Integrações e suporte próprios.**

Se é esse o modelo que você quer, esses serviços são uma boa escolha.

<!--i:eti-home-->
## O que a hospedagem própria oferece

- **Seu conteúdo fica nos seus sistemas.** Entradas, recursos e saídas ficam na infraestrutura que você escolheu. Renderizar em um dispositivo ou em CI não precisa de serviço.
- **As regras ficam na ferramenta.** Cores, tipografia, logotipos e entradas bloqueadas vêm do seu [sistema de design](/info/brand-studio.html), então quem faz uma chamada só pode mudar o que você permite. O [Lolly Work](/info/compare.html#what-runs-where) aplica visibilidade de ferramentas e políticas de entrada a cada solicitação.
- **A mesma ferramenta em todo lugar.** Uma ferramenta renderiza a partir das mesmas entradas em um laptop, em uma tarefa de CI ou em um servidor. As pessoas podem editar a mesma ferramenta no app.
- **Registros sob seu controle.** [Recibos de renderização](/info/work-renders.html#evidence-and-identity), um registro de auditoria e Content Credentials onde você configura uma identidade de assinatura.
- **Código aberto e sem cobrança por uso.** Você executa o código e paga apenas pela própria infraestrutura.

Você assume o trabalho que esses serviços fazem por você. Um servidor durável precisa de um banco de dados persistente e armazenamento de saída. Ferramentas que precisam de navegador precisam do worker do Chromium. [Instale o Lolly Work](/info/work-install.html) descreve ambos.

<!--i:eti-table-->
## Como as tarefas se comparam

| Tarefa | API de renderização hospedada | Lolly |
|---|---|---|
| Preencher um template com dados | Solicitação de API que nomeia um template e suas camadas | [URL](/info/url-mode.html), [CLI](/info/cli.html) ou [API do servidor](/info/work-automation-api.html) que nomeia uma ferramenta e suas entradas |
| Muitos arquivos a partir de uma tabela | Lotes e coleções | [Lote](/info/batch.html) no seu dispositivo ou [lotes de renderização](/info/work-renders.html#batches-with-durable-rows) em um servidor |
| Aguardar ou consultar periodicamente um resultado | Consultas periódicas ou uma opção síncrona | Renderizações duráveis que você consulta periodicamente ou uma renderização imediata |
| Chamar um webhook ao terminar | Sim | [Callbacks assinados](/info/work-renders.html) para origens que você permite |
| URL de imagem dinâmica | Sim | [Links de compartilhamento e URLs `/render`](/info/url-mode.html) |
| Editar um template | Editor hospedado | [Design](/info/using.html), no seu dispositivo |
| Agentes | Ambos publicam um servidor MCP | [MCP](/info/mcp.html), com um endpoint da organização sob a política de um token no Lolly Work |

Os tipos de saída do próprio Lolly estão listados em [Exportar](/info/exporting.html). Em um servidor Work hoje, as renderizações duráveis criam SVG, PNG, JPG e PDF, e [o vídeo fica no dispositivo, na CLI e no MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

<!--i:eti-folder-move-->
## O que é transferido e o que não é

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Suas solicitações | A API de migração do Work aceita a mesma estrutura | O mesmo | O mesmo |
| Seus templates | **Import** como documentos editáveis, exceto tipos de camada sem esquema confirmado | Apenas nomes de campos e uma prévia. Reconstrua cada um | Apenas nomes de campos e uma prévia. Reconstrua cada um |
| URLs dinâmicas existentes | Sem suporte | Sem suporte | URLs assinadas continuam funcionando depois de uma mudança de host, com seu token privado antigo |
| Webhooks | Webhooks registrados não são suportados | `webhook_url` funciona | `webhook_success` funciona |
| Saída WebP e AVIF | Recusados pelo nome | Não oferecida | WebP recusado pelo nome |
| Animações, vídeos, coleções, capturas de tela | Não disponíveis na API de migração | Não disponíveis na API de migração | Não disponíveis na API de migração |

::: note Desenvolvido a partir de documentação pública
Isto foi desenvolvido a partir da documentação pública de cada fornecedor e não foi executado com uma conta real. Se você tem uma conta, [o guia de migração](/info/work-move-from-render-api.html#check-it-on-your-own-account) traz uma lista curta de verificações.
:::

Você pode migrar um template e manter o restante onde está. [Sair do Lolly](/info/work-move-from-render-api.html#leave-lolly-too) é igualmente aberto: as ferramentas são arquivos simples e a CLI as renderiza sem servidor.

<!--i:eti-building-->
## Quem opera o serviço

Com o Lolly, uma pessoa renderiza localmente ou uma equipe executa o Lolly Work na própria infraestrutura. Uma tarefa de servidor envia suas entradas e os recursos necessários para essa instância. O fluxo no dispositivo não faz isso.

Bannerbear e Placid são marcas comerciais de seus titulares. Esta página descreve onde os produtos se sobrepõem, a partir da documentação pública deles, e não tem afiliação com nenhum dos dois.
