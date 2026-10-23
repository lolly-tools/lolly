# Lolly e portais de marca

_Última verificação: 28 de setembro de 2026._

Se a sua organização mantém os recursos aprovados no Bynder, Frontify, Marq ou Brandfolder, esta página compara isso com o Lolly mais o Lolly Work: como as pessoas encontram os recursos da marca e como criam novos arquivos a partir deles.

## O que um portal consolidado faz melhor

Os portais consolidados oferecem hospedagem gerenciada, suporte e extensos fluxos de gestão de recursos. Por exemplo, o [DAM corporativo do Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) combina descoberta de recursos, controles de acesso, fluxos de aprovação e distribuição. A pilha do Lolly é mais jovem e suas cadeias de aprovação são sequenciais, e não fluxos de trabalho com ramificação arbitrária. [Work status and roadmap](/info/work-status.html) registra os limites de implantação dela.

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

[Catalog and content](/info/work-catalog.html), [Approvals](/info/work-approvals.html) e [Policy and governance](/info/work-governance.html) descrevem esses recursos e sua configuração.

## Manter o seu portal atual

Um DAM existente pode continuar sendo a fonte da verdade. Os conectores de catálogo do Lolly Work tornam os recursos aprovados dele disponíveis no Lolly, onde as pessoas criam novos arquivos sob as regras da organização. Essa é uma escolha de integração; a biblioteca e as aprovações do próprio Lolly estão lá quando a organização quiser operá-las por conta própria. [What runs where](/info/compare.html#what-runs-where) lista os limites que toda comparação compartilha.

Veja [How Lolly compares](/info/positioning.html) para a comparação de capacidades. Os nomes de fornecedores identificam os produtos comparados; o Lolly não é afiliado a eles.
