# Lolly e Penpot

_Última verificação: 28 de setembro de 2026._

Se sua equipe cria designs no Penpot, o Lolly trabalha junto com ele. Ambos são de código aberto e leem os mesmos tokens de design. Esta página diz a que tarefa cada um se destina.

<!--i:eti-award-->
## O que o Penpot faz melhor

[Penpot](https://penpot.app/) oferece design de interfaces, componentes, layouts flexíveis, protótipos interativos e inspeção para desenvolvedores, com edição em tempo real e cursores ao vivo. Ele oferece implantações hospedadas e com hospedagem própria, com [opções de instalação com Docker e Kubernetes](https://help.penpot.app/technical-guide/getting-started/). Para projetar um aplicativo, o Penpot é a ferramenta.

<!--i:eti-blend-->
## Onde eles se sobrepõem

[Os tokens de design do Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) usam o formato DTCG, que o Lolly também lê, então cores, tipografia e outros valores de tokens passam de um para o outro. [Importar um design](/info/design-import.html) do Lolly abre uma exportação `.penpot` como layout editável, e **Send to Penpot** no Lolly envia um design de volta como um arquivo `.penpot`. O Lolly também mantém o [plugin Lolly Export para Penpot](https://github.com/lolly-tools/lolly-plugins-penpot-export), que usa o mecanismo do Lolly para adicionar Content Credentials no dispositivo quando você opta por isso.

<!--i:eti-lolly-->
## Como o Lolly faz as tarefas em comum

O canvas do Lolly Design cria recursos editáveis e pode transformar um layout em uma [ferramenta com regras](/info/create-a-tool.html). A mesma ferramenta renderiza no navegador, no app de desktop ou na CLI e cria variações a partir de dados. O Lolly independente renderiza e assina no dispositivo, sem conta nem servidor. Uma [colaboração privada](/info/collaborate.html) conecta dois dispositivos diretamente.

<!--i:eti-building-->
## Com uma organização

O Lolly Work adiciona login único, provisionamento SCIM, catálogos e projetos compartilhados, funções, aprovações, registros de auditoria, colaborações de trabalho e renderização no servidor. Os dois repositórios são MPL-2.0, e uma organização pode executar ambos. [O que roda onde](/info/compare.html#what-runs-where) coloca as duas partes lado a lado.

Você pode usar os dois: Penpot para design de interfaces e prototipagem, Lolly para arquivos que podem ser produzidos repetidamente.

Penpot é uma marca comercial de seu titular. Esta página descreve onde os dois produtos se sobrepõem e não tem afiliação com o Penpot.
