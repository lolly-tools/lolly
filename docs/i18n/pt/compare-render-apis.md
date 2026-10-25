# Lolly e APIs de renderização

_Última verificação: 28 de setembro de 2026._

Se hoje você gera imagens a partir de templates por meio de uma API, esta página diz como o Lolly faz o mesmo trabalho no seu próprio dispositivo, no CI ou no seu próprio servidor.

## O que as APIs de renderização hospedadas fazem melhor

O [Bannerbear](https://www.bannerbear.com/) e o [Placid](https://placid.app/) empacotam a renderização como serviços gerenciados, com infraestrutura, integrações e suporte próprios. Você envia uma solicitação e outra pessoa cuida dos servidores.

## Onde eles se sobrepõem

Ambos transformam um template mais entradas em mídia. O Lolly recebe as entradas de um [link](/info/url-mode.html), da [CLI](/info/cli.html), de uma grade de lote ou de um endpoint de servidor.

## Como o Lolly faz o trabalho em comum

A mesma ferramenta renderiza em um notebook, em um job de CI ou em um servidor, a partir das mesmas entradas. A renderização local e a de CI não precisam de nenhum serviço.

![Configurações de exportação do Batch: nome do arquivo, formato padrão, unidades, DPI e o número de linhas a renderizar](/info/shots/use-batch-toolbar.svg)

Em um servidor, o [Lolly Work](/info/compare.html#what-runs-where) executa o motor do Lolly atrás de uma API e aplica visibilidade de ferramentas e políticas de entrada. O [serviço de renderização recuperável](/info/work-renders.html) dele aceita trabalhos únicos e lotes, envio idempotente, status, novas tentativas limitadas, cancelamento e saídas retidas, e o trabalho interrompido é retomado após uma reinicialização quando o armazenamento persistente está configurado.

O servidor tem um caminho rápido para SVG e PNG e um worker Chromium opcional para ferramentas que precisam de um navegador. A automação faz login com tokens de serviço, a saída pronta pode passar pela [entrega aprovada](/info/work-delivery.html) a destinos da organização, e uma identidade de assinatura configurada acrescenta Content Credentials à saída compatível.

## Quem executa o serviço

Com o Lolly, uma pessoa renderiza localmente, ou uma equipe executa o Lolly Work na própria infraestrutura. Enviar um trabalho de servidor manda as entradas e os recursos necessários a essa instância, o que é diferente do caminho no dispositivo. Um serviço durável precisa de um banco de dados persistente e de armazenamento de saída, e as ferramentas que dependem de navegador precisam do worker Chromium; [Install Lolly Work](/info/work-install.html) descreve ambos.

Bannerbear e Placid são marcas registradas dos respectivos titulares. Esta página descreve onde os produtos se sobrepõem e não é afiliada a nenhum dos dois.
