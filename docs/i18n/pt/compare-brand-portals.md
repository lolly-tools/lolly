# Lolly e portais de marca

_Última verificação: 28 de setembro de 2026._

O Lolly e o [lolly.work](https://lolly.work) juntos cobrem os fluxos de criação e governança para os quais as equipes usam portais de marca: ativos aprovados, modelos bloqueados, controle de acesso, revisão e distribuição. Compare essa solução combinada com Bynder, Frontify, Marq ou Brandfolder ao escolher como as pessoas encontram ativos de marca e criam novos.

## Criação e serviços de organização

O motor e os apps do Lolly produzem os arquivos. Modelos, design tokens e entradas permitidas definem o que alguém pode alterar, e a renderização pode permanecer no dispositivo da pessoa. O Lolly independente não exige conta.

O lolly.work é o serviço de organização do mesmo projeto, mantido em um [repositório separado](https://github.com/lolly-tools/lolly-work) e implantado junto com o Lolly. Ele acrescenta identidade, armazenamento compartilhado, políticas, aprovações e relatórios. As duas partes são de código aberto sob MPL-2.0. A separação permite que uma pessoa use o Lolly de forma independente e que uma organização execute a solução combinada em uma infraestrutura que ela controla.

## O que a solução combinada oferece

| Necessidade | Lolly + lolly.work |
|---|---|
| Login e provisionamento | Login único (SSO) via OIDC, múltiplos provedores de identidade, provisionamento de usuários e associação a grupos via SCIM 2.0, e desativação de contas que revoga as sessões existentes. Um provedor de identidade apenas SAML pode se conectar por meio de uma ponte OIDC, como o Keycloak. |
| Modelos aprovados | O Lolly define as entradas editáveis do modelo; o lolly.work aplica visibilidade por grupo e políticas de entrada que bloqueiam valores, restringem opções ou ocultam controles. |
| Biblioteca de ativos compartilhada | Uploads pertencentes à instância, coleções, metadados personalizados e catálogos com controle de acesso, além de conectores que leem bibliotecas de DAM e de armazenamento existentes. |
| Revisão | Etapas de aprovação ordenadas, grupos de aprovadores elegíveis, regras de quórum e separação de funções; a revisão pode governar envios ao catálogo e entregas a destinos da organização. |
| Histórico e disponibilidade de ativos | Versões e rollback para ativos pertencentes à instância, retenção e bloqueios legais, disponibilidade agendada, expiração e revogação. Os provedores conectados mantêm o próprio histórico de origem. |
| Relatórios | Contagens de uso e de downloads de ativos, atividade de ferramentas e de exportação, painéis e uma trilha de auditoria. A atribuição de uso segue a política de telemetria da implantação; a configuração padrão de atribuição exige consentimento. |
| Distribuição | Links com expiração e revogáveis, coleções compartilhadas, acesso de convidados e entrega a destinos da organização configurados. |

Os [guias do operador do lolly.work](https://github.com/lolly-tools/lolly-work/tree/main/docs) descrevem esses recursos e sua configuração. São capacidades disponíveis, e não recursos que exigem construir outro sistema em volta do Lolly.

## Como escolher um fluxo de portal

Portais consolidados oferecem hospedagem gerenciada, suporte e fluxos de DAM extensos. Por exemplo, o [DAM empresarial da Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) combina descoberta de ativos, controles de acesso, fluxos de aprovação e distribuição. Compare o fluxo exato de revisão e de direitos de que você precisa: o Lolly oferece controles de metadados, de acesso e de disponibilidade, mas a liberação jurídica e as obrigações de licenciamento ainda exigem o processo da organização. Suas cadeias de aprovação são sequenciais; elas não modelam fluxos de trabalho com ramificações arbitrárias.

A stack do Lolly é mais jovem, e a [página de status do lolly.work](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) registra seus limites de implantação. Em particular, o site público do lolly.work é um sandbox de avaliação. Uma implantação durável em uma organização precisa de armazenamento persistente e de um operador. Não há cobrança de licença de software por usuário para hospedagem própria; a infraestrutura e a administração ainda têm custo.

Um DAM existente também pode continuar sendo a fonte da verdade. Os conectores de catálogo do lolly.work disponibilizam seus ativos aprovados no Lolly, onde as pessoas criam novos arquivos sob as regras da organização. Essa é uma escolha de integração; a biblioteca e as aprovações do próprio Lolly estão disponíveis quando a organização quer gerenciar esses fluxos por conta própria.

Consulte [Como o Lolly se compara](/info/positioning.html) para a comparação de capacidades e [Lolly comparado, ferramenta por ferramenta](/info/compare.html) para o restante deste conjunto. Os nomes de fornecedores identificam os produtos comparados; o Lolly não é afiliado a eles.
