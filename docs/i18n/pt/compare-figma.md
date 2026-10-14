# Lolly e Figma

_Última verificação: 28 de setembro de 2026._

O Lolly oferece suporte a design, edição ao vivo e produção de ativos reutilizáveis. O [lolly.work](https://lolly.work) acrescenta os serviços de organização em torno desse trabalho: identidade, projetos compartilhados, controles de acesso e aprovações.

## Onde eles se sobrepõem

Ambos permitem organizar texto, formas e imagens em um canvas e trabalhar com outras pessoas. O [Import a design](/info/design-import.html) do Lolly lê arquivos do Figma como layouts editáveis. O Figma também cobre a produção de marca baseada em modelos: o [Figma Buzz](https://help.figma.com/hc/en-us/articles/31271566667543-Guide-to-Figma-Buzz) cria ativos a partir de modelos e os preenche com arquivos CSV ou XLSX.

O Lolly transforma um design em uma [ferramenta reutilizável com regras](/info/create-a-tool.html). Essa ferramenta roda no navegador ou na CLI e aceita entradas de uma URL, de um script ou da grade de lote. O mesmo modelo atende tanto uma pessoa editando um ativo quanto uma equipe produzindo muitas variantes.

## Colaboração e design de produto

O [Figma Design](https://www.figma.com/design/) reúne design de interfaces, componentes, protótipos interativos e handoff para desenvolvedores. Seu fluxo de design de produto consolidado e seu ecossistema são relevantes quando uma equipe precisa projetar e especificar um aplicativo completo.

O Lolly oferece dois tipos de colaboração ao vivo. Um [collab privado](/info/collaborate.html) conecta dois dispositivos diretamente, sem conta e sem precisar de internet em uma rede compartilhada. Um collab de trabalho usa o lolly.work para acesso autenticado, edições compartilhadas, cursores ao vivo e sessões de equipe salvas. A colaboração de trabalho está implementada tanto no cliente Lolly quanto no servidor lolly.work; sua implantação atual em um único nó não estabelece paridade com a escala de operação do Figma.

## Implantação e produção

Os apps criativos do Lolly e o lolly.work são partes do mesmo projeto de código aberto, implantadas separadamente. O Lolly independente pode renderizar offline, sem conta. O lolly.work oferece SSO, SCIM, catálogos compartilhados, permissões de projeto, aprovações, registros de auditoria e renderização no servidor em uma infraestrutura que a organização controla.

As sessões de equipe e as edições de collab de trabalho chegam a essa instância; as renderizações locais podem permanecer no dispositivo. As Content Credentials são opcionais nas exportações compatíveis, e a assinatura no servidor usa uma identidade de organização configurada. Consulte a [visão geral da solução combinada](/info/compare.html) para a separação e [Content Credentials Identity](/info/content-credentials-identity.html) para saber como um verificador passa a confiar no assinante.

Figma é uma marca registrada de seu proprietário. Esta página descreve onde as duas soluções se sobrepõem e não é afiliada ao Figma.
