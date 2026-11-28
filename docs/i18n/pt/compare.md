# Lolly em comparação, ferramenta por ferramenta

Estas páginas dizem se o Lolly substitui outro produto, trabalha junto com ele ou não se encaixa no seu trabalho. Cada página começa pelo que o outro produto faz melhor.

_Última verificação: 28 de setembro de 2026._

<!--i:eti-grid-->
## Compare por produto

- [Lolly e Canva](/info/compare-canva.html) - templates, design do dia a dia e produção compartilhada de materiais de marca.
- [Lolly e Adobe](/info/compare-adobe.html) - edição, conversão, saída profissional e Content Credentials.
- [Lolly e Figma](/info/compare-figma.html) - design, colaboração ao vivo e produção de recursos reutilizáveis.
- [Lolly e Penpot](/info/compare-penpot.html) - design de código aberto, tokens compartilhados e trabalho da organização.
- [Lolly e portais de marca](/info/compare-brand-portals.html) - bibliotecas aprovadas, templates bloqueados, identidade, revisão e relatórios.
- [Lolly e APIs de renderização](/info/compare-render-apis.html) - geração automatizada no seu dispositivo, em CI ou no seu próprio servidor e [como migrar](/info/work-move-from-render-api.html) do Bannerbear ou do Placid.
- [Lolly e conversores de arquivos online](/info/compare-converters.html) - conversão de formatos no seu próprio dispositivo.

[Como o Lolly se compara](/info/positioning.html) traz a visão recurso por recurso. Cada comparação tem uma data. Uma afirmação que já não corresponde a um dos produtos precisa ser corrigida.

<!--i:eti-map-pin-->
## O que roda onde

Cada comparação cobre duas partes de um projeto de código aberto. **Lolly** é o mecanismo, os apps e as ferramentas. **Lolly Work** é o servidor da organização, mantido no [repositório lolly-work](https://github.com/lolly-tools/lolly-work). Ambos são MPL-2.0, e a organização decide quais serviços do Lolly Work ativar.

::: cols
## No seu dispositivo: Lolly

- Sem conta para uso independente
- Criação, edição, conversão e exportação
- Funciona offline depois que as ferramentas e os recursos necessários são salvos
- Content Credentials assinadas no dispositivo
- Colaborações privadas entre dois dispositivos, sem servidor

## No servidor da sua organização: Lolly Work

- Login único, provisionamento SCIM, funções e políticas
- Catálogos compartilhados, projetos de equipe e colaborações de trabalho
- Aprovações, relatórios de uso e registros de auditoria
- Renderização no servidor, tarefas recuperáveis e entrega aprovada
- Assinatura no servidor com a identidade da organização
:::

O uso independente mantém os arquivos no dispositivo. Escolher projetos compartilhados, uma colaboração de trabalho, uma renderização no servidor ou uma entrega envia os dados necessários para esse recurso ao servidor da sua organização.

<!--i:eti-info-->
## O que toda comparação pressupõe

Estes limites se aplicam a todas as páginas deste conjunto:

- **As colaborações do Lolly Work rodam em um único nó de servidor hoje.** Sua escala e seu histórico de operação diferem dos produtos hospedados estabelecidos há muito tempo. [Status e roteiro do Lolly Work](/info/work-status.html) registra os limites atuais.
- **O site em [lolly.work](https://lolly.work) é um ambiente de demonstração.** Uma implantação durável para uma organização precisa de armazenamento persistente e de um operador. [Instale o Lolly Work](/info/work-install.html) cobre ambos.
- **Não há cobrança de licença de software por usuário** para o Lolly ou para o Lolly Work em hospedagem própria. Hospedagem, armazenamento e operação ainda custam dinheiro.
- **Uma assinatura não é um signatário confiável.** Um verificador só mostra o signatário como confiável quando confia no certificado que assinou o arquivo. [Identidade de Content Credentials](/info/content-credentials-identity.html) explica como.
