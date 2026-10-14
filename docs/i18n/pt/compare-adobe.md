# Lolly e Adobe

_Última verificação: 28 de setembro de 2026._

O Lolly cuida de edição e conversão de imagens, layout, produção de marca repetível, saída para impressão e Content Credentials. O [lolly.work](https://lolly.work) acrescenta a esse fluxo criativo identidade de organização, ativos compartilhados, aprovações e produção automatizada no servidor.

## Onde eles se sobrepõem

Ambos oferecem suporte a tarefas como redimensionar imagens, compor layouts e exportar formatos profissionais. O Lolly oferece saída em PDF/X, CMYK e raster de alta profundidade de bits, com [recursos específicos de cada formato](/info/formats.html). Seus utilitários no dispositivo convertem e limpam arquivos sem enviá-los por upload.

Os aplicativos especializados da Adobe cobrem fluxos de trabalho criativos extensos. O [Photoshop](https://www.adobe.com/products/photoshop.html), por exemplo, oferece ferramentas detalhadas de edição de fotos, seleção, máscara e composição. Compare as operações de edição que seu trabalho exige com as ferramentas do Lolly; um ativo de marca recorrente e um retoque complexo podem ter requisitos diferentes.

## Criação e serviços de organização

O Lolly independente roda sem conta Adobe nem conta Lolly, usando o mesmo motor no navegador, no app desktop e na CLI. Modelos e design tokens tornam as saídas repetíveis, e o [Share with rules](/info/create-a-tool.html) transforma um design em uma ferramenta que outras pessoas podem preencher.

O lolly.work é um serviço separado dentro do projeto Lolly, de código aberto sob MPL-2.0 como os apps criativos. Ele oferece SSO, SCIM, catálogos e projetos compartilhados, aprovações, políticas de acesso, registros de auditoria e renderização no servidor. Uma organização pode executar as duas partes por conta própria e conectar bibliotecas de ativos existentes. A criação local permanece no dispositivo; o trabalho compartilhado e os jobs no servidor usam os serviços configurados.

## Content Credentials e identidade

O Lolly pode assinar exportações compatíveis no dispositivo, com Content Credentials ativadas pelo usuário. Uma chave gerada no dispositivo comprova a integridade da assinatura do arquivo; ainda assim, um verificador precisa confiar no assinante antes de exibir uma identidade verificada. Uma organização pode usar a própria autoridade certificadora e distribuir sua raiz aos seus verificadores. O lolly.work também oferece suporte à assinatura no servidor com um certificado e uma chave de organização configurados.

Assim, tanto a assinatura pessoal quanto a assinatura de organização ficam disponíveis dentro da solução Lolly. Consulte [Content Credentials Identity](/info/content-credentials-identity.html), o [guia de assinatura do lolly.work](https://github.com/lolly-tools/lolly-work/blob/main/docs/c2pa.md) e a [visão geral da solução combinada](/info/compare.html). Os utilitários de transformação no dispositivo não adicionam marcas d'água do Lolly nem metadados de proveniência.

Adobe, Photoshop e Creative Cloud são marcas registradas da Adobe. Esta página descreve onde as soluções se sobrepõem e não é afiliada à Adobe.
