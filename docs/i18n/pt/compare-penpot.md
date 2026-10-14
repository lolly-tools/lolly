# Lolly e Penpot

_Última verificação: 28 de setembro de 2026._

O Lolly e o Penpot oferecem ferramentas de design de código aberto, design tokens compartilhados e colaboração ao vivo. O Lolly combina criação no dispositivo com o [lolly.work](https://lolly.work), seu serviço de organização implantado separadamente.

## Bases de design compartilhadas

Os [design tokens do Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) usam o formato DTCG, que o Lolly também lê. Cores, tipografia e outros valores de token podem ser compartilhados entre os dois fluxos de trabalho. O [Import a design](/info/design-import.html) do Lolly abre uma exportação `.penpot` como um layout editável.

O plugin Lolly Export para o Penpot é mantido pelo Lolly. Ele usa o motor do Lolly para Content Credentials C2PA opcionais (opt-in) no dispositivo. A integridade da assinatura e a confiança no assinante são coisas distintas: o verificador precisa de uma identidade em que confie, conforme descrito em [Content Credentials Identity](/info/content-credentials-identity.html).

## Fluxos de trabalho de design e de equipe

O [Penpot](https://penpot.app/) oferece design de interfaces, componentes, layouts flexíveis, protótipos interativos e inspeção para desenvolvedores. Ele tem implantações hospedadas e autohospedadas, com [opções de instalação em Docker e Kubernetes](https://help.penpot.app/technical-guide/getting-started/).

O canvas Design do Lolly cria ativos editáveis e pode transformar um layout em uma [ferramenta com regras](/info/create-a-tool.html). A mesma ferramenta renderiza no navegador, no app desktop ou na CLI e pode gerar variantes a partir de dados. Para o trabalho em equipe, o Lolly tem tanto [collabs privados](/info/collaborate.html) diretos entre dois dispositivos quanto collabs de trabalho pelo lolly.work, com edições compartilhadas, cursores e sessões de equipe salvas.

## Como as implantações diferem

O Lolly independente renderiza e assina no dispositivo, sem conta nem servidor. O lolly.work acrescenta SSO, provisionamento SCIM, catálogos e projetos compartilhados, papéis, aprovações, registros de auditoria e renderização no servidor. Os dois repositórios são de código aberto sob MPL-2.0 e podem ser operados pela organização. O trabalho compartilhado usa a instância configurada; a criação local continua disponível de forma independente.

A escolha depende do trabalho: o fluxo de design de interfaces e prototipagem do Penpot, a produção repetível de ativos do Lolly, ou uma combinação que use tokens compartilhados e designs importados. A colaboração de trabalho do Lolly roda atualmente em um único nó de servidor, e seu [status de implantação](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) deve fazer parte da avaliação de uma organização.

Penpot é uma marca registrada de seu proprietário. O plugin acima é do Lolly. Consulte [Como o Lolly se compara](/info/positioning.html) e a [visão geral da solução combinada](/info/compare.html) para a comparação mais ampla.
