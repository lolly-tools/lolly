# Lolly e APIs de renderização

_Última verificação: 28 de setembro de 2026._

O Lolly gera ativos a partir de modelos e dados no seu dispositivo, em CI ou pela API de servidor do [lolly.work](https://lolly.work). A solução combinada cobre a renderização automatizada, assim como a identidade, as políticas e a entrega em torno dos jobs de produção de uma organização.

## Onde eles se sobrepõem

[Bannerbear](https://www.bannerbear.com/) e [Placid](https://placid.app/) geram imagens e outras mídias a partir de modelos por meio de APIs e integrações. O Lolly adota a mesma abordagem de modelo mais entradas, com o [modo URL](/info/url-mode.html), a [CLI](/info/cli.html), uma grade de lote e endpoints de servidor como formas de enviar o trabalho.

## O que o lolly.work oferece

O lolly.work é o serviço de organização do projeto Lolly, implantado separadamente. Ele executa o motor do Lolly por trás de uma API, aplica políticas de visibilidade de ferramentas e de entradas, e serve arquivos renderizados e links de compartilhamento assinados. Seu [serviço de renderização recuperável](https://github.com/lolly-tools/lolly-work/blob/main/docs/renders.md) oferece suporte a jobs individuais e em lote, envio idempotente, status, novas tentativas limitadas, cancelamento e retenção das saídas. O trabalho interrompido pode ser retomado após a reinicialização do servidor quando há armazenamento persistente configurado.

O servidor usa um caminho de renderização rápido para SVG/PNG e um worker Chromium opcional para ferramentas que precisam de um navegador. A automação se autentica com tokens de serviço, e a saída concluída pode ser enviada por [entrega governada](https://github.com/lolly-tools/lolly-work/blob/main/docs/delivery.md) a destinos da organização. Uma identidade de assinatura configurada habilita a assinatura C2PA na saída compatível do servidor.

## Quem executa o serviço

Bannerbear e Placid oferecem a renderização como serviços gerenciados, com infraestrutura e integrações próprias. Com o Lolly, uma pessoa pode renderizar localmente ou uma equipe pode operar o lolly.work em sua própria infraestrutura. Os dois repositórios do Lolly são de código aberto sob MPL-2.0; a hospedagem própria não tem cobrança de licença de software por renderização, mas computação, armazenamento e operação continuam sendo custos a planejar.

O site público do lolly.work é um sandbox de avaliação, não um compromisso de hospedagem em produção. Um serviço durável precisa de banco de dados e armazenamento de saída persistentes; as ferramentas que dependem de navegador precisam do worker Chromium. O [guia de instalação](https://github.com/lolly-tools/lolly-work/blob/main/docs/install.md) e a [página de status](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) descrevem esses requisitos e os limites atuais.

A renderização local e em CI continua disponível sem o serviço de organização. Enviar um job ao servidor encaminha suas entradas e os ativos necessários a essa instância; isso é distinto do caminho no dispositivo. Consulte a [visão geral da solução combinada](/info/compare.html).

Bannerbear e Placid são marcas registradas de seus proprietários. Esta página descreve onde as soluções se sobrepõem e não é afiliada a nenhuma delas.
