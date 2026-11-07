# Lolly e portais de marca

_Posicionamento atualizado em: 31 de outubro de 2026. Exemplo de capacidade de fornecedor verificado em: 28 de setembro de 2026._

Se a sua organização mantém os recursos aprovados no Bynder, Frontify, Marq ou Brandfolder, esta página compara isso com o Lolly mais o Lolly Work: como as pessoas encontram os recursos da marca e como criam novos arquivos a partir deles.

## Manter o seu portal atual

Um DAM existente pode continuar sendo a fonte de registro. Os conectores de catálogo do Lolly Work tornam uma parte selecionada da biblioteca dele disponível no Lolly, onde as pessoas criam novos arquivos sob as regras da organização. As restrições de origem compatíveis do DAM e as regras de exposição do Lolly Work governam o acesso; a revisão da saída final é uma decisão separada.

[Use Lolly with your existing DAM](/info/use-with-dam.html) explica as responsabilidades e os limites. [SUSE's Brandfolder experience](/info/suse-brandfolder.html) registra uma integração bem-sucedida que apoiou a gestão de mudanças dos administradores antes de uma migração planejada. Manter a origem conectada continua sendo uma escolha compatível.

O propósito do Lolly é a [soberania de conteúdo](/info/content-sovereignty.html), incluindo o controle sobre a produção e a liberdade de escolher sistemas. A biblioteca e as aprovações próprias dele apoiam as organizações que escolhem operar essas capacidades por conta própria. [Lolly for DAM vendors and implementation partners](/info/dam-partners.html) descreve como o fluxo de trabalho conectado pode agregar valor a um sistema de registro existente.

## O que um portal consolidado faz melhor

Os portais consolidados oferecem hospedagem gerenciada, suporte e extensos fluxos de gestão de recursos. Por exemplo, o [DAM corporativo do Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) combina descoberta de recursos, controles de acesso, fluxos de aprovação e distribuição. A pilha do Lolly é mais jovem e suas cadeias de aprovação são sequenciais, e não fluxos de trabalho com ramificação arbitrária. [Lolly Work status and roadmap](/info/work-status.html) registra os limites de implantação dela.

## Onde eles se sobrepõem

Ambos cobrem recursos aprovados, templates bloqueados, controle de acesso, revisão e distribuição. O Lolly cria os arquivos: templates, design tokens e entradas permitidas definem o que alguém pode mudar, e a renderização pode ficar no dispositivo da pessoa. O Lolly Work acrescenta identidade, armazenamento compartilhado, política, aprovações e relatórios em uma infraestrutura que a organização controla.

![O sistema de design ativo em Settings, mostrado como uma capa e páginas: as cores, a tipografia e os logotipos com que toda ferramenta desenha](/info/shots/dashboard-brand.svg)

## O que o Lolly e o Lolly Work oferecem

| Necessidade | Lolly + Lolly Work |
|---|---|
| Login e provisionamento | Single sign-on OIDC, vários provedores de identidade, provisionamento de usuários SCIM 2.0 e associação a grupos, e desativação de contas que revoga as sessões existentes. Um provedor de identidade somente SAML pode se conectar por uma ponte OIDC como o Keycloak. |
| Templates aprovados | O Lolly define as entradas editáveis do template; o Lolly Work aplica visibilidade por grupo e políticas de entrada que bloqueiam valores, restringem escolhas ou ocultam controles. |
| Biblioteca de recursos compartilhada | Envios pertencentes à instância, coleções, metadados personalizados e catálogos com controle de acesso, além de conectores que leem bibliotecas DAM e de armazenamento existentes. |
| Revisão | Etapas de aprovação ordenadas, grupos de aprovadores elegíveis, regras de quórum e separação de funções; a revisão pode governar envios ao catálogo e a entrega a destinos da organização. |
| Histórico e disponibilidade de recursos | Versões e reversão de recursos pertencentes à instância, retenção e bloqueios, disponibilidade agendada, expiração e revogação. Os provedores conectados mantêm o próprio histórico de origem. |
| Licenças e créditos | O Lolly registra a licença de cada origem que um arquivo usa e prepara os créditos devidos; [Creative rights and credits](/info/creative-rights.html) explica o que ele registra e onde os créditos são gravados. Ele não libera direitos. |
| Relatórios | Contagens de uso e de download de recursos, atividade de ferramentas e exportações, painéis e uma trilha de auditoria. A atribuição de uso segue a política de telemetria da implantação; a configuração padrão de atribuição exige consentimento. |
| Distribuição | Links com expiração e revogáveis, coleções compartilhadas, acesso de convidados e entrega a destinos configurados da organização. |
| Uma brand page pública | O Lolly grava uma [brand page](/info/brand-page.html) estática, a partir do Lolly Design System Setup ou da linha de comando: logotipos, cores, tipografia, regras e exemplos para pessoas, com tokens, `DESIGN.md` e skills para agentes. Você hospeda a pasta, ou um administrador ativa a [hospedagem de brand page](/info/work-design-system-administration.html#host-a-brand-page) no Lolly Work, que vem desativada por padrão. |

[Catalog and content](/info/work-catalog.html), [Approvals](/info/work-approvals.html) e [Policy and governance](/info/work-governance.html) descrevem esses recursos e sua configuração.

## Avalie o fluxo de trabalho combinado

Use [a sequência de produção de cartões de evento](/info/dam-production.html) para testar o acesso à origem, as edições permitidas, a revisão da saída e a entrega com a sua própria biblioteca. [What runs where](/info/compare.html#what-runs-where) lista os limites que toda comparação compartilha. Uma conexão de origem não estabelece, por si só, uma parceria com o fornecedor nem uma qualificação para todos os tenants.

Veja [How Lolly compares](/info/positioning.html) para a comparação de capacidades. Os nomes de fornecedores identificam os produtos comparados; o Lolly não é afiliado a eles.
