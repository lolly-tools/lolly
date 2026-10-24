# Perfis

Defina seu nome, seus dados de contato e sua foto uma vez, e toda ferramenta feita para usá-los os preenche por você: uma assinatura de e-mail, um crachá, um cartão de palestrante. Esse pequeno registro é o seu **perfil**, e ele fica no seu dispositivo.

Seu perfil também guarda o que você acumula enquanto trabalha: sessões salvas, imagens enviadas e a contagem local da sua atividade. Você o gerencia em **Settings → Preferences**; as ferramentas só leem os campos que foram feitas para preencher. O uso autônomo não exige conta, e o Sync opcional, o compartilhamento e os serviços da organização têm, cada um, os próprios fluxos de dados, descritos abaixo.

## O que há em um perfil

| Parte | O que é |
|---|---|
| **Name** | Nome e sobrenome. |
| **Contact** | E-mail e telefone. |
| **Location** | Cidade e país. |
| **Headshot** | Uma foto opcional, recortada em quadrado e mantida como imagem local, para ferramentas como assinaturas de e-mail, cartões de citação e organogramas. |
| **Use my details to create** | Uma chave de adesão opcional (passa a mostrar **Using my details** quando ativada). Ela decide se os seus dados viajam como crédito de autoria nos arquivos exportados e nas execuções do Batch. Não afeta o preenchimento automático; veja [How tools use your profile](#how-tools-use-your-profile). |
| **Preferences** | Seu tema, suas configurações de acessibilidade e quais partes do app você ativou em **Feature flags**. |
| **Your work** | Sessões salvas com as miniaturas, organizadas em [Projects](/info/find-your-work.html), suas imagens enviadas e suas estatísticas de atividade local. |

Nada disso é obrigatório. Um perfil em branco funciona; preencha só o que poupa você de digitar.

![Settings na aba Preferences: a barra lateral de configurações e Your details com a chave Use my details to create e os campos de nome, contato e localização](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

[Settings](/info/dashboard.html) mapeia todo o resto em Preferences, de aparência e emoji até armazenamento e downloads offline.

## Você, uma equipe ou uma função

A palavra "perfil" sugere uma pessoa fixa. No Lolly, ela é mais próxima de um contexto de criação: quem você é enquanto faz esta coisa. Ele pode ter três formatos, e o Lolly trata cada um do mesmo jeito.

::: cols
## Como você mesmo

O padrão. Seu nome, seu e-mail, sua foto. Defina uma vez e a assinatura, o crachá e o lockup da conferência se preenchem sozinhos.

## Como equipe

O nome compartilhado de uma equipe, uma caixa de entrada de grupo como `events@…`, um departamento e a marca da equipe. Uma pessoa configura e exporta, e todos os outros carregam o mesmo perfil, então os arquivos da equipe levam dados consistentes. Um quiosque compartilhado ou um notebook de demonstração pode rodar um único perfil de equipe.

## Como função

Uma gerente de eventos que, três dias por ano, quer a caixa de entrada e a submarca do evento em crachás e sinalização, e depois a identidade de sempre de volta. Guarde essa função como um arquivo de perfil salvo, carregue-o para o evento e deixe-o de lado depois.
:::

![O controle de foto de perfil, vazio até você enviar uma foto, que então permanece neste dispositivo](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

::: details Perfis em uma organização que usa o Lolly Work
Quando você faz login no [Lolly de uma organização](/info/organisation.html), o Lolly Work pode fornecer campos de perfil verificados a partir do provedor de identidade e fixar campos ou preferências pela política da organização. Um campo gerenciado é identificado no app.

Esse login também controla o acesso a projetos e recursos compartilhados. Um arquivo de perfil de equipe continua sendo um arquivo local: ele não concede participação na organização nem substitui uma conta de trabalho. **Use my details to create** controla o crédito nas suas exportações, não o login da organização nem os registros de auditoria. Veja [Privacy](/info/privacy.html#organisation-services-with-lolly-work).
:::

## Guarde vários, use um

Uma instalação tem um perfil ativo por vez, e não há alternador no app. Em vez disso, cada perfil é um arquivo portátil, o mesmo arquivo de backup que você usaria para mudar para um novo dispositivo. Para entrar em outro contexto:

::: timeline
- <!--i:download--> **Export my data**, em **Settings → Storage → Move to another device**, salva o perfil atual como um único `.zip`.
- <!--i:trash--> **Clear all my data** esvazia esta instalação.
- <!--i:upload--> **Import data…** carrega o arquivo de perfil do contexto em que você está entrando.
:::

Importar sem limpar antes faz uma **mesclagem**. As sessões e imagens importadas são adicionadas; quando as duas cópias existem, a salva mais recentemente é mantida. Pastas, favoritos e modelos são adicionados ao lado dos seus, e os seus próprios dados permanecem, exceto campos vazios, que recebem os valores do arquivo. Isso serve para trazer as sessões de uma equipe para o seu ambiente, mas não para uma separação limpa entre funções.

Para dois contextos ao mesmo tempo, use um perfil de navegador separado, uma conta de usuário separada ou uma segunda cópia instalada do app web: cada uma carrega o próprio perfil independente do Lolly.

![Os dois botões que movem uma instalação inteira: Export my data grava um zip, Import data o lê de volta](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> Mantenha um arquivo por contexto e dê a cada um o nome do que ele é, como `LollyTools-events-2026.zip` e `LollyTools-me.zip`. O arquivo é o perfil.

[Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device) cobre o que o arquivo contém, o que fica para trás e as outras formas de mover, incluindo o Sync.

## Como as ferramentas usam seu perfil

**Preenchimento automático.** O autor de uma ferramenta marca uma entrada como vinda do seu perfil (`bindToProfile: "firstname"`, `"email"`, `"headshot"` e assim por diante). Quando a ferramenta abre, essa entrada é preenchida a partir do seu perfil, e você pode substituí-la por uma sessão sem alterar o perfil, a menos que uma política da organização bloqueie a entrada. O preenchimento automático é uma conveniência local e acontece com **Use my details** ativado ou não.

**Crédito.** Ao exportar, seus dados podem viajar como crédito de autoria nos metadados do arquivo (PNG, PDF, SVG e outros), para que um arquivo final possa dizer quem fez o trabalho. **Use my details to create** governa isso, e o autor nas execuções do Batch. Com a opção desativada, a exportação ainda diz que foi feita com o Lolly e não carrega nenhuma linha pessoal de autoria ou contato.

Autores de ferramentas: veja [`bindToProfile`](/info/tool-inputs.html#bindtoprofile) e [`host.profile`](/info/host-api.html#host-profile).

![A única chave Use my details to create, marcada como opcional e desativada até você ativá-la](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## Perfil, sistema de design e capacidades

Três coisas ficam perto umas das outras em Settings e são fáceis de confundir:

- <!--i:people--> **Profile** - você, a sua equipe ou a função em que está: nome, contato, foto e trabalho salvo. Pessoal, mantido no dispositivo e portátil como um arquivo.
- <!--i:palette--> **Design system** - a marca: as cores, fontes e configurações com que toda ferramenta renderiza. Compartilhado e consistente, e não pessoal; veja [Design System Setup](/info/brand-studio.html).
- <!--i:sliders--> **Capabilities** - o que o app consegue fazer: os recursos e as ferramentas disponíveis para você.

Um perfil muda de quem é um arquivo; o sistema de design muda como o arquivo se parece; as capacidades são o que você pode criar.

A palavra tem três outros sentidos no Lolly. Um **perfil de conteúdo** é uma configuração de compilação que escolhe quais ferramentas e catálogo uma implantação entrega; o [Glossary](/info/glossary.html) define o termo. O parâmetro de link `profile` escolhe um perfil de cor para uma exportação, como uma condição de impressão CMYK; veja [Reserved URL parameters](/info/url-parameters.html#print). Uma **identidade verificada** é o certificado de assinatura opcional que liga o seu e-mail às suas exportações assinadas, separado destes dados, embora **Use my details to create** governe se qualquer um dos dois é incorporado; veja [Content Credentials](/info/content-credentials-identity.html).

![O cartão Verified identity, na largura de um telefone: o seletor de tempo de vida do certificado e o passo de registro abaixo dele - o perfil de identidade, separado dos seus dados pessoais](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## Privacidade

Seu perfil pessoal é armazenado localmente. Seus dados podem viajar em um backup ou cópia do Sync, em conteúdo que você compartilha ou exporta e durante o cadastro opcional de Content Credentials. Em uma instância do Lolly Work, o login, o trabalho compartilhado, a política de telemetria e os registros de auditoria são separados deste perfil local. **Settings → Preferences → Clear all my data** limpa este dispositivo; não apaga as cópias mantidas pelo seu provedor de armazenamento ou pela sua organização. Veja a [Política de Privacidade](/info/privacy.html).
