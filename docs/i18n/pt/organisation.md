# Use o Lolly na sua organização

Sua organização pode executar o próprio Lolly: o mesmo app, com as ferramentas e os sistemas de design que ela escolheu. Esta página mostra como acessá-lo, fazer login e o que muda depois disso.

::: note O que você precisa da sua organização
O endereço da web do Lolly dela, ou um arquivo de configuração `.lolly` que sua organização criou. O lolly.tools sozinho não se conecta a uma organização.
:::

## No navegador

Abra o endereço que sua organização forneceu. Se a página pedir que você faça login, pressione **Sign in** e siga a página de login que ela abre. Depois disso, funciona como qualquer Lolly, com as ferramentas e os sistemas de design da sua organização.

Você também pode começar pelo lolly.tools: abra **Settings** e, no cartão **Lolly instance**, pressione **Open a workspace**, informe o endereço e pressione **Open this instance**. O navegador vai para o endereço da sua organização, porque um navegador não consegue carregar as ferramentas de outro Lolly a partir do lolly.tools.

![O cartão Lolly instance em Settings, onde você abre o espaço de trabalho da sua organização ou muda de onde o app obtém suas ferramentas](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

## No aplicativo desktop ou mobile

O app começa com as ferramentas que vêm incluídas. Para se conectar, abra **Settings** e pressione **Change** no cartão **Lolly instance**. A janela pergunta **Where should Lolly get its tools?**

1. Escolha **Conectar a uma instância do Lolly**.
2. Digite o endereço da web da sua organização e pressione **Verificar e conectar**.
3. Pressione **Usar esta instância**. A próxima tela, **Importe seus dados (opcional)**, traz o trabalho salvo de um backup do Lolly; pressione **Pular** se você não tiver nenhum.
4. Entre, se o aplicativo pedir.

As ferramentas de uma instância conectada rodam com a mesma confiança que as do próprio aplicativo, então conecte-se apenas a uma em que você confia. Sua organização também pode enviar um arquivo de configuração `.lolly` que conecta o aplicativo para você.

Para trocar depois, use **Change** de novo ou **Leave** no mesmo cartão.

### Login com um código

Nos apps desktop e mobile, a tela de login também oferece um código curto, quando o Lolly da sua organização aceita login por código. Pressione **Open sign-in in browser**, faça login e aprove o código lá. Ou abra o endereço que ela mostra em um celular ou computador em que você já está logado e digite o código. O código dura cerca de dez minutos.

## O que é diferente lá

- **Alguns controles já vêm definidos.** Um controle que a sua organização governa mostra **Managed by** e o nome da organização, ou **Managed by your organisation**. Um controle fixo não pode ser alterado, um menu pode oferecer apenas algumas de suas opções, e uma linha iniciada por **Set by** pode dizer qual regra se aplica e por quê. Alguns controles nem aparecem.
- **Alguns sistemas de design são bloqueados.** Um sistema de design fornecido pela sua organização mostra um cadeado e fica somente leitura. Para testar alterações, crie uma cópia editável em **Settings → Preferences → Design systems**.
- **Só as ferramentas dela são listadas.** Uma ferramenta que a sua organização não oferece não aparece de forma alguma.
- **Projetos compartilhados.** Se a sua organização compartilha projetos com você, **Projects** mostra um bloco **Team projects**. Essas sessões ficam no servidor da organização. Abra uma para trabalhar nela ou inicie um [collab de trabalho](/info/collaborate.html#work-collabs-with-lolly-work-optional) em **Share**, quando disponível.
- **Algumas exportações podem exigir aprovação.** Onde a sua organização pede aprovação, **Request approval** substitui **Download**, e uma ferramenta pode oferecer menos formatos.

### O que fica onde

::: cols
## Neste dispositivo

- Seus próprios salvamentos, a menos que você ative o [Sync](/info/sync.html)
- Sistemas de design que você mesmo criou
- Tudo o que você cria e baixa

## No servidor da sua organização

- Sua identidade de login e informações do dispositivo
- Projetos de equipe, sessões compartilhadas e edições ao vivo em um collab de trabalho
- Recursos que você envia para a biblioteca compartilhada
- Solicitações de aprovação e entregas aprovadas
- Eventos de uso, quando a sua organização os ativa
:::

[Privacy](/info/privacy.html#organisation-services-with-lolly-work) lista o que o servidor armazena e quem controla esses dados.

## O que o Lolly Work acrescenta

O servidor da sua organização executa o **Lolly Work**, o software de organização do mesmo projeto de código aberto. O app não precisa de uma conta de trabalho nem do Lolly Work quando você o usa por conta própria.

::: details O que o Lolly Work pode acrescentar
Sua organização hospeda o [Lolly Work](https://github.com/lolly-tools/lolly-work) junto com o Lolly e escolhe quais recursos ativar:

- **Login e acesso.** Single sign-on da organização, permissões baseadas em grupos e campos de perfil gerenciados. Administradores podem provisionar e desativar contas pelo SCIM.
- **Trabalho compartilhado.** Projetos de equipe, sessões compartilhadas e [collabs de trabalho](/info/collaborate.html#work-collabs-with-lolly-work-optional), com edição ao vivo pelo servidor da organização.
- **Uma biblioteca de recursos compartilhada.** Recursos enviados, coleções e bibliotecas conectadas, com regras de acesso, versões e revisão.
- **Revisão e entrega.** Etapas de aprovação, links gerenciados com expiração ou revogação e entrega aos destinos que a organização permite.
- **Administração.** Relatório de uso sob a política de telemetria da instância, além de um registro de auditoria das ações governadas.

Se você está configurando o serviço, comece por [Deployment](/info/deployment.html#organisation-services-with-lolly-work). A demo pública em [lolly.work](https://lolly.work) é um sandbox; use o endereço da sua própria organização para o trabalho que você precisa manter.
:::

## Saindo

**Leave**, no cartão **Lolly instance** em **Settings**, remove o sistema de design, as ferramentas e o catálogo da sua organização. Seu próprio trabalho permanece. Tudo o que você criou com as ferramentas dela não abrirá de novo até você se reconectar.

Tudo o que você salvou na organização permanece com a organização, sob as políticas de acesso e retenção dela. Sair ou limpar este dispositivo não apaga essa cópia do servidor. Em um navegador no endereço da sua própria organização não há nada de que sair: abra um endereço diferente.

## A quem perguntar

O que chega ao servidor da sua organização, quem pode ver os projetos compartilhados dela e quais configurações são fixas são decisões da sua organização. Pergunte a quem administra o Lolly da sua organização. [Política de Privacidade](/info/privacy.html) cobre o que o próprio Lolly faz com seus dados.
