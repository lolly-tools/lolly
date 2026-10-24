# Como o Lolly se compara

O Lolly são duas partes de um mesmo projeto de código aberto. O **Lolly** é o motor, os apps e as ferramentas para criar, editar, converter e exportar no seu dispositivo, sem conta. O **Lolly Work** é o servidor de organização, executado na sua própria infraestrutura, para login, projetos compartilhados, aprovações e renderização no servidor. Ambos são MPL-2.0. Esta página compara o par com as outras formas pelas quais as pessoas projetam, governam e produzem arquivos.

## As ferramentas de hoje

Cada anel pontua quão completamente uma classe de produto entrega uma capacidade, com cada classe avaliada pelo seu melhor representante. A coluna do Lolly cobre o Lolly e o Lolly Work juntos, e cada linha diz qual parte fornece o quê. Abra o nome de uma linha para ver o raciocínio por trás da sua pontuação. As colunas são ordenadas pela linha Overall completeness no topo: a média das linhas pontuadas, com a linha de gasto excluída.

::: figure positioning-comparison
Comparação de capacidades: pesquisa e pontuações de concorrentes de agosto de 2026; cobertura do Lolly + Lolly Work revisada em 28 de setembro de 2026. Pontuação: 0 ausente, 25 nível de solução alternativa, 50 real mas restrito ou parcial, 75 forte com ressalvas, 100 competência central.
:::

::: details Notas de pontuação
Os recursos disponíveis e a maturidade em produção são coisas separadas. O Lolly foi lançado: a versão 1.0 foi publicada como código aberto em 30 de agosto de 2026, sua segurança ainda não passou por uma auditoria independente e as evidências de adoção têm poucos meses ([Adoption & Governance](/info/adoption-governance.html#status) traz o estado atual). Ter single sign-on, aprovações ou renderização no servidor não estabelece um histórico em produção, e por isso a pontuação de maturidade reflete isso. As pontuações dos concorrentes mantêm a revisão datada de agosto.

Uma regra governa o quadro. A nota máxima (100), nas linhas que tocam o seu conteúdo ou a sua identidade, exige uma capacidade que você possa usar sem conta e sem pré-condição de nuvem; as linhas sobre o próprio produto, como maturidade e facilidade de uso, são isentas. Essa regra custa pontos à Adobe em Content Credentials: a implementação distribuída mais ampla (Photoshop, Lightroom, Premiere, Firefly) assina localmente e na nuvem, mas nunca sem uma conta e identidade Adobe, então 75. Ela limita as APIs de renderização em geração em massa e automação pelo mesmo motivo.

O Canva é pontuado pelo melhor membro da sua família em cada linha, já que é dono do Affinity e do Cavalry (ambos distribuídos gratuitamente em outubro de 2025). A renderização offline e no dispositivo recebe 75 pelo Affinity, uma suíte desktop que ainda exige uma conta verificada e carrega telemetria, o desconto que a Adobe também sofre; o modo offline do próprio Canva edita apenas designs sincronizados antes, em um dispositivo, por uma janela limitada. O preenchimento automático recebe 50: é real, mas restrito ao Enterprise e assíncrono, e preenche apenas texto e imagens. A geração em massa do Figma subiu de 25 para 50 quando o Buzz lançou o preenchimento por planilha (um beta gratuito, agosto de 2026).

A pontuação 75 do Lolly em Content Credentials cobre a assinatura no dispositivo e a assinatura no servidor do Lolly Work com uma identidade de organização configurada; um verificador ainda precisa confiar no signatário ([Content Credentials Identity](/info/content-credentials-identity.html)). O 50 do Penpot vem do plugin de exportação do próprio Lolly para o Penpot: a mesma assinatura do motor, opcional e divulgada como do Lolly. O Penpot recebe 90 em renderização no dispositivo: um canvas de navegador com um destino de salvamento no servidor dele, que pode ser auto-hospedado. A Cloudinary ganha uma coluna própria pela biblioteca de recursos, pela API de transformação e pela CDN; a revisão de agosto pontuou a assinatura de entrega dela com 50.

A colaboração ao vivo do Lolly inclui collabs privados diretos entre dois dispositivos e collabs de trabalho autenticados pelo Lolly Work, com edições compartilhadas, cursores e sessões de equipe salvas. A pontuação Partial reflete a atual implantação de trabalho em um único nó e o curto histórico de operação, e não a ausência de edição em equipe. As estimativas de preço são aritmética datada de preços de tabela, para ter noção de escala, e não uma cotação de compra.
:::

## Quando recorrer ao Lolly

::: cols
## Recorra ao Lolly quando

- O mesmo tipo de arquivo é necessário sempre de novo: peças de eventos, crachás, certificados, alertas, cartões sociais
- Muitos arquivos vêm de um template e de uma tabela de valores, no [Batch](/info/batch.html#make-many-versions-of-one-design) ou na CLI
- As cores, a tipografia e os recursos precisam ficar dentro do sistema de design, mesmo em um canvas aberto
- Um design pronto do Figma, Penpot, Illustrator, InDesign ou PDF deve se tornar editável e repetível ([Import a design](/info/design-import.html))
- Os arquivos precisam ser feitos nos seus próprios dispositivos ou servidores

## Recorra a outra coisa quando

- O trabalho é retoque fotográfico detalhado ou ilustração
- Você está projetando e prototipando a interface de um aplicativo
- Você precisa de uma grande biblioteca de imagens e templates pronta desde o primeiro dia
- Você precisa de um serviço gerenciado com um longo histórico em escala
:::

Designs importados e design tokens compartilhados permitem que uma equipe combine o Lolly com aplicativos especializados, enquanto o Lolly Work governa recursos compartilhados, revisão e entrega.

Um deck de slides inteiro mostra o teto: no **Markdown Slides**, um deck é declarado como dados, diagramado ao vivo e exportado como um arquivo nativo e editável do PowerPoint.

![O Markdown Slides na visão dividida: os slides do deck listados como blocos à esquerda, o deck diagramado sendo renderizado à direita](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## As regras vivem na ferramenta

O Lolly coloca na ferramenta as regras reutilizáveis da marca: cores, fontes, margens de sangria, espaçamento e entradas permitidas. O template fixa as partes que um destinatário não pode alterar. O Lolly Work acrescenta acesso por grupos e políticas de entrada em torno desse template, com cadeias de aprovação para envios ao catálogo e para a entrega.

Conferir uma ferramenta uma vez facilita a produção repetível, porque cada saída herda as regras de layout dela. Texto, imagens enviadas e direitos de uso ainda podem precisar de conferência, e o Lolly Work fornece catálogos compartilhados e etapas de aprovação para isso. Para a equipe criativa, a ferramenta é um guard-rail: você ainda traz os dados, o texto e a imagem, e a ferramenta mantém todo resultado fiel à marca.

![Todo o trabalho de quem produz: digitar as palavras. Tipografia, cor e espaçamento foram definidos quando a ferramenta foi criada](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Mais três coisas distinguem esta abordagem:

- **O arquivo final, a partir de entradas.** Entram as entradas e sai o arquivo pronto, sem o "agora salve da sua ferramenta de design e dê um jeito".
- **As ferramentas compõem ferramentas.** Uma ferramenta pode incorporar a renderização de outra em um único arquivo final, sem acoplamento de código entre elas.
- **Aberto até o fundo.** O motor é de código aberto, e as ferramentas, os recursos e os design tokens são arquivos que você pode manter em controle de versão ou gerenciar no Lolly Work, não linhas no banco de dados de outra pessoa.

O design ousado sobrevive aos guard-rails. Este mapa de cidade com qualidade de pôster é feito de caminhos vetoriais reais de ruas e água, a partir de um menu suspenso e de dois campos de cor que não podem ser apontados para fora do sistema de design:

![Os anéis de canais e a rede viária de Amsterdã desenhados de ponta a ponta na tinta do próprio sistema de design, cada traço posicionado pelo template e não à mão](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Inove probabilisticamente, escale deterministicamente

A maioria das propostas de "criatividade com IA" põe o modelo do lado errado de uma linha antiga. Escribas e iluminadores resolveram onde ela passa. Você trabalha solto no esboço, onde tudo pode ser tentado e nada é definitivo. Depois vai à prensa, que se compromete. Os esboços eram onde estava a arte, e a prensa era como ela viajava, e a obra impressa podia ser confiável porque a prensa cumpria a promessa a cada tiragem.

O Lolly é a prensa. Traga o que quiser para as ideias, um modelo, um designer ou um rascunho, mas no momento em que uma ideia precisa virar muitos arquivos, ela passa por algo que renderiza do mesmo jeito todas as vezes, a partir de entradas que qualquer pessoa pode reler. A comparação acima é, na verdade, sobre quem torna essa etapa definitiva repetível.

> Confie no processo criativo, escale com rigor.

## Grátis para sempre

**Se renderiza no seu dispositivo, é grátis para sempre.** O motor, os shells, as ferramentas e os formatos são de código aberto, e uma versão lançada não pode ser retirada. O Lolly Work também é de código aberto. Uma organização paga pela infraestrutura e pela operação que escolher, sem cobrança de licença de software por usuário ou por renderização para a auto-hospedagem. [Questions & answers](/info/faq.html) conta a história por trás da promessa.

## Onde o seu conteúdo vive

O trabalho criativo do Lolly pode rodar em hardware que você possui, e seus design tokens, fontes, logotipos e ferramentas são arquivos que você pode guardar. Com o Lolly Work, projetos compartilhados, recursos, políticas e registros de auditoria ficam no armazenamento que a sua organização configura. [Trust](/info/trust.html) explica por que isso importa, e a [Política de Privacidade](/info/privacy.html) e o [Verify It Yourself](/info/verify-yourself.html) permitem que você confira a afirmação em vez de acreditar na nossa palavra.

## Ferramenta por ferramenta

[Lolly compared, tool by tool](/info/compare.html) compara o Lolly com Canva, Adobe, Figma, Penpot, portais de marca, APIs de renderização e conversores online, uma página para cada, e apresenta [what runs where](/info/compare.html#what-runs-where).
