# Lolly e Penpot

_Última verificação: 28 de setembro de 2026._

Se a sua equipe projeta no Penpot, o Lolly funciona ao lado dele: ambos são de código aberto e ambos leem os mesmos design tokens. Esta página diz para que serve cada um.

## O que o Penpot faz melhor

O [Penpot](https://penpot.app/) oferece design de interfaces, componentes, layouts flexíveis, protótipos interativos e inspeção para desenvolvedores, com edição em tempo real e cursores ao vivo. Ele oferece implantações hospedadas e auto-hospedadas, com [opções de instalação em Docker e Kubernetes](https://help.penpot.app/technical-guide/getting-started/). Para projetar um aplicativo, o Penpot é a ferramenta.

## Onde eles se sobrepõem

Os [design tokens do Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) usam o formato DTCG, que o Lolly também lê, então cores, tipografia e outros valores de token circulam entre os dois. O [Import a design](/info/design-import.html) do Lolly abre uma exportação `.penpot` como um layout editável, e **Send to Penpot** no Lolly envia um design de volta como um arquivo `.penpot`. O Lolly também mantém o [plugin Lolly Export para o Penpot](https://github.com/lolly-tools/lolly-plugins-penpot-export), que usa o motor do Lolly para adicionar Content Credentials opcionais no dispositivo.

## Como o Lolly faz o trabalho em comum

O canvas Design do Lolly cria recursos editáveis e pode transformar um layout em uma [ferramenta com regras](/info/create-a-tool.html). A mesma ferramenta renderiza no navegador, no app desktop ou na CLI e gera variantes a partir de dados. O Lolly autônomo renderiza e assina no dispositivo, sem conta nem servidor. Um [collab privado](/info/collaborate.html) liga dois dispositivos diretamente.

## Com uma organização

O Lolly Work acrescenta single sign-on, provisionamento SCIM, catálogos e projetos compartilhados, funções, aprovações, registros de auditoria, collabs de trabalho e renderização no servidor. Os dois repositórios são MPL-2.0 e uma organização pode executar ambos. [What runs where](/info/compare.html#what-runs-where) coloca as duas partes lado a lado.

Você pode usar os dois: o Penpot para design de interfaces e prototipagem, o Lolly para arquivos repetíveis, ligados por tokens compartilhados e designs importados.

Penpot é uma marca registrada do respectivo titular. Esta página descreve onde os dois produtos se sobrepõem e não é afiliada ao Penpot.
