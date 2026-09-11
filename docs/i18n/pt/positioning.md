# Como o Lolly se compara

O que o Lolly faz que as ferramentas criativas de hoje não fazem, e o que ele deliberadamente deixa para elas.

Para a versão ferramenta por ferramenta, uma página para cada uma de Canva, Adobe, Figma, APIs de renderização e conversores online, veja [Lolly comparado, ferramenta por ferramenta](/info/compare.html). Cada página declara o que a outra ferramenta faz melhor e o que o Lolly faz em vez disso.

> **Status de piloto:** o Lolly é um protótipo de piloto fechado, não um produto acabado, e sua segurança está atualmente passando pelo rigoroso hardening de infraestrutura da SUSE, se preparando para a escala corporativa. A página [Adoption & Governance](/info/adoption-governance.html#status) cobre o estado atual.

## As ferramentas de hoje

Cada anel abaixo pontua o quão completamente uma classe de produto entrega uma capacidade **como publicada hoje** - não como divulgada em marketing - com cada classe pontuada pelo seu melhor representante. O Lolly é pontuado com a mesma faca: ele leva o único anel vermelho do quadro, por maturidade. Abra o nome de uma linha para ver o raciocínio por trás de suas pontuações. As colunas são ordenadas pela linha Overall completeness no topo - a média das linhas pontuadas, com a linha de gasto excluída.

::: figure positioning-comparison
Completude de capacidades entre as ferramentas criativas atuais, pesquisado em agosto de 2026. Pontuação: 0 ausente, 25 nível de solução alternativa, 50 real mas limitado ou parcial, 75 forte com ressalvas, 100 competência central.
:::

**Notas de pontuação.** As pontuações do Lolly assumem que suas alegações publicadas se sustentam, por isso a maturidade é seu único anel vermelho: piloto fechado, hardening de segurança em andamento, nada auditado ainda. A pesquisa moveu várias células.

O Canva é pontuado pelo melhor membro de sua família em cada linha, já que é dono da Affinity e da Cavalry (ambas oferecidas gratuitamente em outubro de 2025). Renderização offline e no dispositivo pontuam 75 via Affinity - um pacote desktop que ainda exige uma conta verificada e carrega telemetria, a mesma dedução que a Adobe também recebe - enquanto o próprio modo offline do Canva só edita designs pré-sincronizados, em um dispositivo, com janela limitada. Autofill pontua 50: real, mas restrito ao Enterprise, assíncrono, apenas texto e imagem. A geração em massa do Figma subiu de 25 para 50 quando o Buzz lançou o preenchimento por planilha (beta gratuito, agosto de 2026).

Uma regra governa o quadro: Full (100), em linhas que tocam seu conteúdo ou identidade, exige uma capacidade que você pode usar sem conta e sem pré-condição de nuvem; linhas que descrevem o próprio produto (maturidade, facilidade de uso) são isentas. Isso custa pontos à Adobe em proveniência: o C2PA mais amplo publicado (Photoshop, Lightroom, Premiere, Firefly) assina localmente e na nuvem, mas nunca sem uma conta e identidade Adobe, portanto 75. Isso limita as APIs de renderização em geração em massa e automação pelo mesmo motivo.

A pontuação 75 de proveniência do Lolly reflete a assinatura offline no dispositivo: arquiteturalmente mais forte, mas não auditada, e uma chave de dispositivo aparece como não verificada em validadores padrão até que uma identidade ou a própria CA de uma organização a ateste. O 50 do Penpot vem através do plugin oficial Lolly Export: a mesma assinatura do engine, opt-in, divulgada como sendo do próprio Lolly. O Penpot também leva o único anel fora de escala do quadro, 90 em renderização no dispositivo - canvas do navegador, salvamento na sua própria nuvem soberana (até mesmo um laptop), exportação privada; só o salto pelo servidor o separa do Lolly. O Cloudinary tem sua própria coluna: um pipeline de mídia (DAM, API de transformação, CDN), e a única coluna de nuvem que publica C2PA (50, porque o fl_c2pa assina na entrega, atestando entregue-pelo-Cloudinary, não feito-por-você).

A colaboração ao vivo funciona ao contrário: o Figma define o padrão de escala (200 editores) e o P2P par a par, air-gapped, do Lolly pontua Partial. O preço é uma estimativa, rotulada como tal: aritmética de preço de lista sobre combinações realistas de assentos, ampla de propósito, para escala, não para aquisição. As APIs de renderização levam 75 em restrições: templates fixos, sem camada de governança de marca.

A lacuna: nada publicado hoje é constraints-first e offline, sem conta e sem servidor no caminho de renderização, e ninguém copiou a cláusula da conta. O Lolly agora publica seu próprio canvas aberto - o **Design**, um canvas livre de manipulação direta - mas as cores, tipografia e ativos nele obedecem aos globais de marca, então mesmo o arranjo livre permanece constraints-first.

O que o Lolly ainda **não** é uma suíte de design irrestrita; os designers continuarão a usar o Illustrator e o Figma para trabalhos sob medida - e quando esse trabalho precisar se tornar um ativo governado e reproduzível, o [Import a design](/info/design-import.html) da ferramenta Design traz o arquivo final do Figma, Penpot, Illustrator, InDesign ou PDF para o canvas como caixas editáveis e conformadas à marca.

![O canvas livre do Design, onde as cores, tipografias e ativos oferecidos são os da própria marca](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&dark=1&filename=aud-open-canvas)

## Use para

- Geração rápida de ativos criativos operacionalizados (tiles de eventos, crachás, assinaturas, alertas)
- Arranjo livre no canvas aberto (Design) quando as peças - cores, tipografia, ícones, imagens - precisam permanecer conformadas aos globais de marca
- Trazer um design finalizado do Figma, Penpot, Illustrator, InDesign ou PDF (o Import a design da ferramenta Design) para que possa ser editado, governado e renderizado novamente de forma determinística em todo formato do Lolly
- Fluxos um-para-muitos do tipo "preencha três campos, obtenha o ativo pronto" - incluindo execuções em massa a partir de uma planilha/CSV na grade de lote `/pro` (cole ou importe linhas, um ativo pronto por linha, baixe como zip)
- Saídas de marca sempre ativas e recorrentes
- Casos em que o controle central da expressão de marca importa mais do que a flexibilidade expressiva

O Deck Studio é uma boa medida do teto aqui: uma apresentação de slides inteira declarada como dados, disposta ao vivo no canvas e exportada como um PowerPoint nativo editável.

![Deck Studio na visão dividida - os slides da apresentação listados como blocos à esquerda, a apresentação disposta renderizando à direita](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Não use para

- Conteúdo hero sob medida ou de destaque (outdoors, vídeos principais)
- Trabalho de campanha único que genuinamente precisa de um designer
- Ideação que precisa escapar totalmente do sistema de marca - o canvas aberto do Lolly ainda conforma cores, tipografia e ativos aos globais de marca, e esse é o ponto

## Inove probabilisticamente, escale deterministicamente

A maioria dos discursos de "IA criativa" coloca o modelo no lado errado de uma linha antiga. Escribas e iluminadores já resolveram onde essa linha cai: você trabalha solto no esboço, onde tudo pode ser tentado e nada é definitivo, e então você vai para a prensa de impressão, que é intimidadora exatamente porque compromete. Os esboços eram onde estava a arte. A prensa era como ela viajava. Dois instrumentos, dois papéis, cada um inventivo à sua maneira, e o trabalho impresso podia ser confiável porque a prensa cumpria sua promessa a cada impressão.

O Lolly é a prensa, não o esboço. Traga o que quiser para a ideação - um modelo, um designer, um guardanapo - mas no momento em que uma ideia precisa se tornar dez mil ativos, ela passa por algo que renderiza da mesma forma todas as vezes, a partir de entradas que qualquer um pode conferir. É disso que a comparação acima realmente trata: não quem tem o melhor gerador, mas quem torna o passo definitivo reproduzível.

> Confie no processo criativo, escale com rigor.

## Aprove a ferramenta, não o arquivo

Toda outra ferramenta do mercado produz um *arquivo* que depois precisa ser conferido - um gerente de marca numa thread do Slack, jurídico no aviso legal, uma rodada de mudanças, mais uma revisão. Lolly move a aprovação **uma etapa para trás**. As regras de marca - códigos hex exatos, arquivos de fonte licenciados, margens de sangria, espaçamento - estão codificadas no HTML e no CSS da ferramenta, de modo que o template *não pode* gerar um asset fora da marca. É o próprio layout que faz a fiscalização.

Então você para de aprovar resultados e passa a aprovar a **ferramenta** que os produz. Aprove uma vez, e todo asset que ela venha a produzir já está pré-aprovado por construção - sem humano no ciclo, sem revisão, em qualquer volume.

Essa é a mudança que o motor determinístico de fato entrega: não é uma versão mais rápida do processo de aprovação antigo, é a eliminação do processo. Para a equipe criativa é uma grade de proteção, não um substituto - você ainda arremessa a bola (os dados, o texto, a imagem) e o código é a canaleta que impede qualquer arremesso de cair fora.

![O trabalho inteiro do produtor: digitar as palavras. Tipo, cor e espaçamento já estavam definidos quando a ferramenta foi aprovada](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DApproved&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-approve-the-tool)

| Aprovar assets do jeito antigo | Aprovar a ferramenta, o jeito Lolly |
|---|---|
| Cada arquivo pronto é conferido, um por um | A ferramenta é conferida uma vez |
| Pedido → designer monta → revisão de marca → checagem jurídica → mudanças → nova revisão | Uma mudança de parâmetro → asset pronto |
| Designer, gerente de marca, jurídico e solicitante, todos no ciclo | O produtor, sozinho |
| Dias por asset | Segundos por asset |
| 10.000 assets = 10.000 ciclos de revisão | 10.000 assets = zero (o template já estava aprovado) |

## O que isso oferece de único

- **Potencial criativo ousado entregue com segurança no contexto certo.** As ferramentas podem expressar ideias de design arrojadas dentro de grades de proteção fixas no código.

- **Automação de conteúdo definida por software que devolve o asset final.** Entrada → arquivo final. Nada de "agora salve da sua ferramenta de design e faça o pós-processamento".
- **Ferramentas compõem ferramentas.** Uma ferramenta pode incorporar o render de outra e devolvê-lo como parte de um único asset pronto, sem nenhum acoplamento de código entre ferramentas - uma primitiva que nenhum produto de canvas aberto ou templating de DAM do mercado oferece.
- **Neutralidade de fornecedor.** Controle total de recursos e custo. Motor de código aberto. Ferramentas e assets são conteúdo versionado em git, não presos num banco de dados SaaS.

O primeiro desses itens é o que as pessoas subestimam. Um mapa de cidade em qualidade de pôster, desenhado como verdadeiros caminhos vetoriais de ruas e água, a partir de um menu suspenso e dois campos de cor que não podem apontar para fora da marca:

![Os anéis de canais e a malha viária de Amsterdã desenhados de ponta a ponta com a tinta da própria marca, cada traço posicionado pelo template em vez de à mão](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Soberania de conteúdo

Existe um nome para o que a seção anterior soma: soberania. Seu pipeline de mídia roda em hardware que você possui. Sua marca - os tokens, as fontes, os logos, as ferramentas que os aplicam - vive em arquivos que você guarda, num controle de versão que você controla, não no banco de dados de um fornecedor com um botão de exportação. A renderização acontece no dispositivo à sua frente, então um asset nunca transita por terceiros para existir, e todo o caminho da entrada ao arquivo final é de código aberto e inspecionável. Se todo fornecedor de design SaaS desaparecesse amanhã, uma instalação Lolly nem notaria.

Isso importa para qualquer pessoa cujo trabalho deveria sobreviver a uma assinatura: tanto para o pai cujo álbum de fotos vive naquele laptop quanto para o órgão público cuja biblioteca de marca está sob regras de licitação. Para organizações - órgãos públicos, setores regulados, qualquer entidade cuja marca seja um ativo estratégico e não uma decoração - "onde nosso conteúdo vive e quem pode desligá-lo" é uma questão de governança, não uma preferência. Soberania aqui é uma propriedade da arquitetura, não um recurso de hospedagem adicionado por conformidade, e as páginas [Política de Privacidade](/info/privacy.html) e [Verifique Você Mesmo](/info/verify-yourself.html) existem para que você confira essa afirmação em vez de simplesmente confiar nela.

Por trás de tudo isso há uma promessa, declarada como compromisso e não como recurso: **se renderiza no seu dispositivo, é gratuito para sempre.** O motor, os shells, as ferramentas, os formatos - todo o caminho criativo no dispositivo é de código aberto e continua assim. Essa promessa tem um mecanismo: uma versão já lançada é licenciada de forma que não pode ser revogada, e não existe nenhum acordo de contribuidor que permita relicenciar o trabalho depois. Todo o limite cabe numa frase: tudo que renderiza no seu dispositivo é livre e de código aberto, para sempre; coordenar pessoas e máquinas numa rede é trabalho de um plano de controle separado, [lolly.work](https://lolly.work).
