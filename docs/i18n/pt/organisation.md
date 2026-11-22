# Use o Lolly na sua organização

Sua organização pode operar seu próprio Lolly: o mesmo app, com as ferramentas e os sistemas de design que escolheu. Veja como acessá-lo, fazer login e o que muda.

Para planejar a configuração da organização, [Usar o Lolly com seu DAM existente](/info/use-with-dam.html) explica como uma biblioteca aprovada pode continuar onde está enquanto as pessoas criam conteúdo no Lolly. [Soberania do conteúdo](/info/content-sovereignty.html) descreve o controle mais amplo sobre criação, governança, armazenamento e portabilidade.

::: note O que você precisa receber da sua organização
O endereço da web do Lolly dela ou um arquivo de configuração `.lolly` criado pela organização. O lolly.tools, por si só, não se conecta a uma organização.
:::

<!--i:eti-globe-->
## No navegador

Abra o endereço que sua organização forneceu. Se a página pedir login, pressione **Sign in** e siga a página de login que se abrir. Depois disso, o Lolly funciona como de costume, com as ferramentas e os sistemas de design da sua organização.

Você também pode começar pelo lolly.tools: abra a visualização **Settings** e, no cartão **Lolly instance**, pressione **Open a workspace**, digite o endereço e pressione **Open this instance**. O navegador vai para o endereço da sua organização, porque não pode carregar as ferramentas de outro Lolly a partir do lolly.tools.

![O cartão Lolly instance em Settings, onde você abre o espaço de trabalho da sua organização ou muda de onde o app obtém suas ferramentas](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

<!--i:eti-monitor-->
## No app para computador ou celular

O app começa com as ferramentas que vêm com ele. Para se conectar, abra a visualização **Settings** e pressione **Change** no cartão **Lolly instance**. O painel pergunta **Where should Lolly get its tools?**

1. Escolha **Connect to a Lolly instance**.
2. Digite o endereço da web da sua organização e pressione **Check & connect**.
3. Pressione **Use this instance**. A próxima tela, **Import your data (optional)**, traz trabalhos salvos de um backup do Lolly. Pressione **Skip** se não tiver nenhum.
4. Faça login se o app pedir.

As ferramentas de uma instância conectada rodam com o mesmo nível de confiança que as do próprio app, então conecte-se apenas a uma instância em que você confie. Sua organização também pode enviar um arquivo de configuração `.lolly` que conecta o app para você.

Para trocar depois, use **Change** de novo ou **Leave** no mesmo cartão.

### Login com um código

Nos apps para computador e celular, a tela de login também oferece um código curto quando o Lolly da sua organização permite login por código. Pressione **Open sign-in in browser**, faça login e aprove o código lá. Ou abra o endereço exibido na tela em um celular ou computador onde você já tenha feito login e digite o código. O código vale por cerca de dez minutos.

<!--i:eti-sliders-->
## O que muda lá

- **Alguns controles são definidos para você.** Um controle gerenciado pela sua organização mostra **Managed by** e o nome da organização ou **Managed by your organisation**. Um controle fixado não pode ser alterado, e um menu pode oferecer apenas algumas opções. Alguns controles ficam ocultos. O console da sua organização registra qual regra fixou um controle e por quê. Fale com quem administra o Lolly da sua organização.
- **Alguns sistemas de design são bloqueados.** Um sistema de design fornecido pela sua organização exibe um cadeado e fica somente para leitura. Para experimentar alterações, crie uma cópia editável em **Settings → Preferences → Design systems**.
- **Só as ferramentas dela são listadas.** Uma ferramenta que sua organização não oferece não aparece.
- **Projetos compartilhados.** Se sua organização compartilha projetos com você, **Projects** mostra um cartão **Team projects**. Essas sessões ficam no servidor da organização. Abra uma para trabalhar nela ou inicie uma [colaboração de trabalho](/info/collaborate.html#collabs-through-lolly-work-optional) em **Share** quando disponível.
- **Algumas exportações podem precisar de aprovação.** Quando sua organização exige aprovação, **Request approval** ocupa o lugar de **Download**, e uma ferramenta pode oferecer menos formatos.
- **Sua tela inicial pode abrir nos templates.** Se sua organização publica templates para você, como poderia fazer para uma empresa parceira, sua tela inicial abre neles em vez da saudação da primeira visita. Cada template é um cartão, com **Your copy** para continuar e **New version** quando o template muda. Veja [Templates de parceiros](/info/work-partner-templates.html).

### O que fica onde

::: cols
## Neste dispositivo

- Seus próprios trabalhos salvos, a menos que você ative o [Sync](/info/sync.html)
- Sistemas de design que você mesmo criou
- Tudo o que você cria e baixa

## No servidor da sua organização

- Sua identidade de login e as informações do dispositivo
- Projetos de equipe, sessões compartilhadas e edições ao vivo em uma colaboração de trabalho
- Recursos que você envia para a biblioteca compartilhada
- Solicitações de aprovação e entregas aprovadas
- Um registro dos seus logins e do que você faz lá
:::

Com um espaço de trabalho conectado, a linha sobre privacidade na primeira tela do app diz o mesmo. Os apps do próprio Lolly não enviam eventos de uso ao espaço de trabalho. [Privacidade](/info/privacy.html#organisation-services-with-lolly-work) lista o que o servidor armazena e quem controla esses dados.

<!--i:eti-building-->
## O que o Lolly Work acrescenta

O servidor da sua organização executa o **Lolly Work**, o software para organizações do mesmo projeto de código aberto. O app não precisa de conta de trabalho nem do Lolly Work quando você o usa por conta própria.

::: details O que o Lolly Work pode acrescentar
Sua organização hospeda o [Lolly Work](https://github.com/lolly-tools/lolly-work) junto com o Lolly e escolhe quais recursos ativar:

- **Login e acesso.** Login único da organização, permissões por grupo e campos de perfil gerenciados. Administradores podem provisionar e desativar contas via SCIM.
- **Trabalho compartilhado.** Projetos de equipe, sessões compartilhadas e [colaborações de trabalho](/info/collaborate.html#collabs-through-lolly-work-optional), com edição ao vivo pelo servidor da organização.
- **Uma biblioteca de recursos compartilhada.** Recursos enviados, coleções e bibliotecas conectadas, com regras de acesso, versões e revisão.
- **Revisão e entrega.** Etapas de aprovação, links gerenciados com expiração ou revogação e entrega a destinos permitidos pela organização.
- **Administração.** Um registro de auditoria das ações sujeitas a políticas e relatórios de uso conforme a política de telemetria da instância para clientes que enviam eventos de uso. Os apps do próprio Lolly não enviam nenhum hoje.
:::

Para configurar o serviço, comece por [Implantação](/info/deployment.html#organisation-services-with-lolly-work). A demonstração pública em [lolly.work](https://lolly.work) é um ambiente de testes. Use o endereço da sua própria organização para trabalhos que precisa guardar.

<!--i:eti-palette-->
## A marca de outra organização

Um parceiro, cliente ou patrocinador pode enviar a marca dele como um arquivo de sistema de design (`.lolly`) em vez de um endereço. Abrir esse arquivo não conecta o app a nada. O arquivo adiciona o sistema de design dele ao lado do seu neste dispositivo. Um arquivo de configuração da sua própria organização conecta o app ao Lolly dela. Antes de qualquer alteração, a prévia mostra o que acontecerá ao abrir um arquivo. [Trabalhar com parceiros](/info/partners.html) aborda os dois lados do trabalho com a marca de outra organização.

<!--i:eti-unlink-->
## Sair

**Leave**, no cartão **Lolly instance** em **Settings**, remove o sistema de design, as ferramentas e o catálogo da sua organização. Seu próprio trabalho fica. Tudo o que você criou com as ferramentas dela só voltará a abrir quando você se reconectar. Quando o Lolly da sua organização oferece essa opção, **Sign out everywhere**, no mesmo cartão, encerra suas sessões em todos os dispositivos, inclusive este.

Tudo o que você salvou na organização fica com ela, sujeito às suas políticas de acesso e retenção. Sair ou limpar este dispositivo não exclui a cópia no servidor. Em um navegador no endereço da sua organização, não há de onde sair: basta abrir outro endereço.

<!--i:eti-help-->
## Com quem falar

O que chega ao servidor da sua organização, quem pode ver os projetos compartilhados e quais configurações são fixadas são decisões da organização. Fale com quem administra o Lolly dela. [Privacidade](/info/privacy.html) explica o que o próprio Lolly faz com seus dados.
