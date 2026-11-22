# Como o Lolly se compara

O Lolly cria arquivos alinhados à marca no seu próprio dispositivo, sem conta. O **Lolly Work** é o servidor para equipes: login, projetos compartilhados, aprovações e renderização no servidor, em máquinas que sua organização opera. Ambos são de código aberto sob MPL-2.0.

A maioria das equipes mantém as ferramentas que já tem. Um app de design fornece os designs, um DAM continua como fonte oficial, e o Lolly transforma entradas aprovadas em arquivos finalizados. [Use o Lolly com seu DAM existente](/info/use-with-dam.html) descreve essa combinação. A ideia por trás da combinação é a [soberania de conteúdo](/info/content-sovereignty.html).

<!--i:eti-gauge-->
## As ferramentas de hoje

Cada anel mostra em que medida uma classe de produto atende a uma necessidade. Pressione um **?** ao lado de uma linha para ver as evidências e o **?** ao lado da legenda para ver como as pontuações funcionam.

::: figure positioning-comparison
Comparação de capacidades. Pesquisa de concorrentes com base em documentos dos fornecedores, de agosto a 21 de novembro de 2026. Lolly e Lolly Work revisados em 21 de novembro de 2026. Pontuação: 0 ausente, 25 solução alternativa, 50 real mas restrita ou parcial, 75 forte com ressalvas, 100 competência central.
:::

::: details Fontes das pontuações que mudaram em novembro de 2026
- Canva: [registro de alterações da API](https://www.canva.dev/docs/apps/rest-apis/changelog/), [apps de serviço](https://www.canva.dev/blog/developers/canva-service-accounts/), [ajuda de Brand Controls](https://www.canva.com/help/brand-control/)
- Adobe: [registro de alterações da API do InDesign](https://developer.adobe.com/firefly-services/docs/indesign-apis/getting-started/changelog/), [preços do Adobe Express](https://www.adobe.com/express/pricing)
- Figma: [créditos de agentes e IA](https://help.figma.com/hc/en-us/articles/42614902212887), [servidor MCP](https://developers.figma.com/docs/figma-mcp-server/)
- Frontify e Bynder: [nota de lançamento do Frontify de outubro de 2026](https://news.frontify.com/163371-what-s-new-in-october-2026), [Frontify MCP](https://help.frontify.com/en/articles/14787214-frontify-mcp-beta)
- Bannerbear e Placid: [preços do Bannerbear](https://www.bannerbear.com/pricing/), [registro de alterações do Bannerbear](https://www.bannerbear.com/changelog/), [preços do Placid](https://placid.app/pricing)
- Penpot: [preços de hospedagem própria](https://penpot.app/pricing/self-host), [lançamentos](https://github.com/penpot/penpot/releases)
- Cloudinary: [procedência do conteúdo](https://cloudinary.com/documentation/content_provenance_and_authenticity), [preços](https://cloudinary.com/pricing)
:::

Recursos e histórico de uso são linhas separadas. O primeiro lançamento público do Lolly foi o 1.0.1 em 30 de agosto de 2026, sua segurança ainda não passou por auditoria independente e suas evidências de adoção têm poucos meses. [Adoção & Governança](/info/adoption-governance.html#status) traz o estado atual.

<!--i:eti-hammer-->
## Quando usar o Lolly

::: cols
## Use o Lolly quando

- O mesmo tipo de arquivo é necessário repetidamente: cartões de eventos, crachás, certificados, alertas, cartões para redes sociais
- Muitos arquivos vêm de um template e uma tabela de valores, no [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) ou na CLI
- As cores, a tipografia e os recursos precisam ficar dentro do sistema de design, mesmo em um canvas aberto
- Um design finalizado do Figma, Penpot, Illustrator, InDesign, Affinity ou em PDF deve se tornar editável e repetível ([Importar um design](/info/design-import.html))
- Os arquivos precisam ser criados nos seus próprios dispositivos ou servidores

## Use outra coisa quando

- O trabalho é retoque detalhado de fotos ou ilustração
- Você está criando e prototipando a interface de um aplicativo
- Você precisa de uma grande biblioteca de imagens e templates pronta desde o primeiro dia
- Você precisa de um serviço gerenciado com um longo histórico de operação em escala
:::

Designs importados e tokens de design compartilhados permitem que uma equipe combine o Lolly com aplicativos especializados, enquanto o Lolly Work governa recursos compartilhados, revisão e entrega.

Para equipes com um DAM com curadoria, comece mantendo essa biblioteca e seus administradores como estão. [A experiência da SUSE com o Brandfolder](/info/suse-brandfolder.html) registra como a integração apoiou a adoção e a gestão de mudanças nas aprovações. Fornecedores de DAM e parceiros de implementação podem avaliar a mesma configuração pelo [fluxo de trabalho para parceiros](/info/dam-partners.html).

No **Lolly Markdown Slides**, um deck inteiro é escrito como dados, tem seu layout montado ao vivo e é exportado como um arquivo PowerPoint nativo e editável.

![O Lolly Markdown Slides na visão dividida: os slides do deck listados como blocos à esquerda, a renderização do deck com o layout montado à direita](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

<!--i:eti-shield-check-->
## As regras ficam na ferramenta

O Lolly coloca regras de marca reutilizáveis na ferramenta: cores, fontes, margens de sangria, espaçamento e entradas permitidas. O template fixa as partes que um destinatário não deve mudar. O Lolly Work adiciona acesso por grupo e políticas de entrada em torno desse template, com cadeias de aprovação para envios ao catálogo e para a entrega.

Verificar uma ferramenta uma vez facilita a produção repetível, porque cada saída herda suas regras de layout. O texto, as imagens enviadas e os direitos de uso ainda podem precisar de verificação, e o Lolly Work fornece catálogos compartilhados e etapas de aprovação para isso. Para a equipe criativa, a ferramenta é uma proteção: você ainda traz os dados, o texto e a imagem, e a ferramenta mantém cada resultado alinhado à marca.

![Todo o trabalho de quem produz: digitar as palavras. A tipografia, a cor e o espaçamento foram definidos quando a ferramenta foi criada](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Mais três diferenças:

- **O arquivo final, a partir de entradas.** Entradas entram, arquivo finalizado sai, sem "agora salve na sua ferramenta de design e faça os ajustes".
- **Ferramentas compõem ferramentas.** Uma ferramenta pode incorporar a renderização de outra em um único arquivo finalizado, sem acoplamento de código entre elas.
- **Código aberto.** O motor é de código aberto, e ferramentas, recursos e tokens de design são arquivos que você pode manter sob controle de versão ou gerenciar no Lolly Work, não linhas no banco de dados de outra pessoa.

O design ousado sobrevive a esses limites. Este mapa urbano com qualidade para pôster é feito de caminhos vetoriais reais de ruas e cursos d'água, a partir de um menu suspenso e dois campos de cor que não permitem sair do sistema de design:

![Os anéis de canais e a rede viária de Amsterdã desenhados de ponta a ponta com a tinta do próprio sistema de design, cada traço posicionado pelo template em vez de à mão](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

<!--i:eti-stamp-->
## Inove de forma probabilística, escale de forma determinística

A maioria das propostas de "criatividade com IA" coloca o modelo do lado errado de uma antiga linha divisória. Escribas e iluminadores definiram onde ela fica. Você trabalha livremente no esboço, onde tudo pode ser testado e nada é definitivo. Depois vai à prensa de impressão, que torna tudo definitivo. Os esboços eram onde estava a arte, e a prensa era como ela circulava, e o trabalho impresso era confiável porque a prensa cumpria sua promessa a cada impressão.

O Lolly é a prensa. Traga o que quiser para as ideias, um modelo, um designer ou um desenho preliminar, mas, no momento em que uma ideia precisa virar muitos arquivos, ela passa por algo que renderiza do mesmo jeito toda vez, a partir de entradas que qualquer pessoa pode ler de volta. A comparação acima é, na verdade, sobre quem torna essa etapa definitiva repetível.

> Confie no processo criativo, escale com rigor.

<!--i:eti-tag-->
## Grátis para sempre

**Se renderiza no seu dispositivo, é grátis para sempre.** O motor, os shells, as ferramentas e os formatos são de código aberto, e uma versão lançada não pode ser retirada. O Lolly Work também é de código aberto. Uma organização paga pela infraestrutura e pela operação que escolhe, sem cobrança de licença de software por usuário ou por renderização para hospedagem própria. [Perguntas & respostas](/info/faq.html) conta a história por trás da promessa.

<!--i:eti-map-pin-->
## Onde seu conteúdo fica

O trabalho criativo do Lolly pode rodar em hardware seu, e seus tokens de design, fontes, logotipos e ferramentas são arquivos que você pode guardar. Com o Lolly Work, projetos compartilhados, recursos, políticas e registros de auditoria ficam no armazenamento que sua organização configura. [Confiança](/info/trust.html) explica por que isso importa, e a [Política de privacidade](/info/privacy.html) e [Verifique você mesmo](/info/verify-yourself.html) permitem conferir a afirmação em vez de acreditar na nossa palavra.

<!--i:eti-grid-->
## Ferramenta por ferramenta

[Lolly comparado, ferramenta por ferramenta](/info/compare.html) compara o Lolly com Canva, Adobe, Figma, Penpot, portais de marca, APIs de renderização e conversores online, uma página para cada, e explica [o que roda onde](/info/compare.html#what-runs-where).
