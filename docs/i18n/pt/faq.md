# Perguntas & respostas

Perguntas frequentes, renderizadas como o acordeão em `/info/start/faq.html`.

**Como manter:** cada título `##` abaixo é uma pergunta. Tudo abaixo do título,
até o próximo `##`, é a resposta. As respostas usam o markdown leve do site:
separe os parágrafos com uma linha em branco. Adicione, remova ou reordene perguntas aqui e
execute de novo `pnpm run build:info` (ou `pnpm run dev:web`).
A compilação ignora tudo acima do primeiro `##` (este título e estas notas).

A ordem é a de quem chega pela primeira vez: primeiro a pegadinha, depois seus arquivos, depois obter
e executar o Lolly, depois organizações, depois como ele foi feito. A âncora de cada pergunta
é construída a partir da pergunta em inglês na mesma posição, então uma tradução mantém a
ordem do inglês.

## Por que é gratuito? Qual é a pegadinha?

**Criamos o Lolly para nós mesmos.** A SUSE precisava de milhares de arquivos alinhados à marca, feitos sem entregar nada a serviços externos. Então criamos uma ferramenta que faz tudo isso no dispositivo e a lançamos como código aberto, como tudo o que fazemos. Continuamos a mantê-la porque a usamos todos os dias. **Não há obrigação:** tudo aqui funciona com ou sem nós.

Esse limite está na licença, não em uma promessa: tudo o que roda localmente é gratuito, para sempre. Uma versão lançada é licenciada de forma que não possa ser retirada. Nenhum acordo de contribuição poderia relicenciar o trabalho de ninguém.

## Quanto a SUSE está mantendo privado? (ou: quando vão puxar o tapete?)

O motor, os shells, os esquemas e as ferramentas independentes de marca são de código aberto. As marcas registradas e as ferramentas com a marca SUSE continuam privadas e já estão separadas. A instância pública em [lolly.tools](https://lolly.tools) roda o [Lolly Demo](/info/lolly-demo.html), o sistema de design do próprio Lolly.

Nada aqui depende de uma promessa: toda versão lançada continua sendo de código aberto. Quando outra empresa fechou o código-fonte do seu Linux empresarial em 2023, a SUSE cofundou a [OpenELA](https://openela.org) para manter esse código aberto. Este projeto herda essa postura.

A SUSE *está* criando ferramentas internas para conectar o Lolly aos seus próprios sistemas de TI. Isso faz parte da configuração interna da SUSE, não de uma divisão entre desenvolvimento público e privado. O Lolly também pretende ser compilado pelo [Open Build Service](https://openbuildservice.org/), com artefatos de uma cadeia de suprimentos segura entregues pela [SUSE Application Collection](https://apps.rancher.io/applications).

## Por que o nome "Lolly Tools"?

**Lolly** porque a liberdade é doce, e porque na Austrália, na Nova Zelândia e na Grã-Bretanha lolly é um doce.

**Tools** porque uma ferramenta fica parada até você pegá-la. Ela não roda quando você não a está usando, e não observa você enquanto a usa.

## Por que tudo é verde?

lolly.tools abre no [Lolly Demo](/info/lolly-demo.html), o sistema de design de exemplo do próprio Lolly, cuja cor principal é verde. Mude para **Lolly Starter**, um sistema de design em branco, ou para o seu próprio em [Settings → Design systems](/#/settings?focus=design-systems-section).

## Posso usar minha própria marca?

Sim. **Lolly Design System Setup** (`#/start`) cria um sistema de design a partir de uma cor, de um arquivo de tokens de design ou de um design pronto. Cada ferramenta passa a desenhar com seu sistema de design. [Começar](/info/quickstart.html#put-your-brand-in) percorre os três caminhos.

Um sistema de design fornecido pela sua organização ou pela sua versão do app é gerenciado. Ele mostra um cadeado e permanece somente leitura. Para alterá-lo, faça uma cópia editável.

## Onde está o que eu fiz ontem?

Se você pressionou **Save as** ou **Save**, seu trabalho está em **Projects** na tela inicial, no navegador ou app em que você salvou. Se pressionou apenas **Download**, o arquivo está nos downloads do navegador ou do sistema, e uma cópia geralmente fica em **Assets**. Ferramentas que [salvam enquanto você trabalha](/info/find-your-work.html#which-tools-save-as-you-work) também guardam trabalhos não salvos em **Projects**. [Encontre e recupere seu trabalho](/info/find-your-work.html) cobre todos os casos.

## Fechei a aba. Perdi meu trabalho?

O trabalho salvo continua em **Projects**. O trabalho não salvo se perdeu, exceto nas ferramentas que salvam enquanto você trabalha, que também o guardam em **Projects**. Na próxima vez, pressione **Save as** antes de sair. Veja [Se você fechou a aba ou saiu da ferramenta](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Posso compartilhar meu trabalho como arquivo em vez de link?

Sim. Quando um link não consegue levar tudo, como suas próprias fotos ou textos longos, a caixa de diálogo Share informa o que ficaria de fora e oferece um arquivo **.lolly**. Esse único arquivo contém o design, as imagens que ele usa e, se você escolher, a ferramenta.

Você decide quanto vai junto. Seu nome e seus dados só entram se você autorizar no perfil. Arte licenciada fica de fora, a menos que você escolha incluí-la. Quem abre um arquivo que leva uma ferramenta precisa dizer se confia nela antes que ela possa rodar. Veja [Compartilhando seu trabalho](/info/using.html#sharing-your-work).

## Para que servem os dados do meu perfil?

Seus dados em **Settings** preenchem previamente as ferramentas que os pedem, como um nome em um crachá. Eles ficam neste dispositivo. Nada entra no que você cria, a menos que você ative a opção. Aí os dados que você escolhe são selados no resultado e identificam você como a fonte.

O compartilhamento e o Sync enviam apenas o conteúdo que você escolhe. Na instância do Lolly Work de uma organização, sessões compartilhadas e trabalhos sujeitos à governança também vão para esse servidor. Veja [Privacidade](/info/privacy.html).

## Como obtenho os apps para celular ou computador?

Baixe-os em [Instalar o Lolly](/info/install.html). A página lista todas as versões para macOS, Windows, Linux e Android, e mostra como verificar o arquivo baixado. No iPhone e no iPad, obtenha o **Lolly Tools** na App Store. [A seção de iPhone e iPad](/info/install.html#iphone-and-ipad) tem o link.

Qualquer pessoa também pode compilar e distribuir sua própria cópia do app, com as ferramentas e configurações de que seu público precisa. O [Guia de compilação](/info/build-guide.html) mostra como.

## O Lolly diz que precisa de WebGPU. O que posso fazer?

O app web desenha com WebGPU, um recurso gráfico dos navegadores atuais, e verifica a presença de WebGPU antes de abrir uma ferramenta. Tente estas opções na ordem:

1. Atualize seu navegador para a versão atual.
2. Ative a aceleração gráfica ou de hardware nas configurações do navegador e depois reinicie o navegador.
3. Experimente um navegador testado: [Ambientes compatíveis](/info/supported-environments.html) lista as opções.
4. Em um Mac, iPhone ou iPad, [instale o app](/info/install.html) como alternativa.

## O Lolly pode editar e renderizar meus arquivos do Figma, Penpot, Illustrator ou InDesign?

Sim. Abra a ferramenta **Design** e clique em **Import a design**: ela aceita um **.fig** nativo do Figma (Save local copy), uma exportação **.penpot** do Penpot, um **.ai** ou **.pdf** do Illustrator, um **.idml** ou **.indd** do InDesign, um documento do Affinity, um **.psd** do Photoshop, um **.pptx** do PowerPoint, um **.dxf** de CAD ou **qualquer SVG** ([todos os formatos que ela lê](/info/design-import.html#what-comes-in-from-each-app)). Você não precisa de conta, plugin nem licença de app de design.

![O canvas aberto do Lolly Design - Import a design fica no menu Lolly da barra de ferramentas](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

As camadas chegam como caixas editáveis. O texto continua podendo ser reescrito, as formas continuam sendo formas e as imagens entram na sua biblioteca. Depois de salvar o layout, **Share with rules** pode transformá-lo em uma ferramenta que qualquer pessoa com Lolly pode preencher de novo. Veja [Importar um design](/info/design-import.html).

## Duas pessoas podem trabalhar no mesmo design sem internet?

Sim. Uma pessoa compartilha um convite (um link, um QR code ou um código curto) e a outra aceita. Os dois dispositivos passam a manter a mesma sessão ao vivo, com indicadores de presença e anéis de foco. Isso funciona em qualquer rede compartilhada, inclusive no hotspot de um celular, porque não há servidor no meio. Veja [Trabalhando juntos](/info/collaborate.html). Para colegas em redes diferentes, a instância do Lolly Work de uma organização oferece colaborações de trabalho autenticadas.

## O que são as flags de recursos?

As flags de recursos ativam ou desativam partes do Lolly. No uso independente, você escolhe suas configurações pessoais. Uma organização que usa o Lolly Work pode definir padrões ou ocultar determinados alternadores conforme sua política, e os controles gerenciados são identificados. Veja [Use o Lolly na sua organização](/info/organisation.html).

![Flags de recursos pessoais no app independente; a política da organização pode controlar determinados alternadores](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## O que diferencia os utilitários das ferramentas?

Um utilitário faz uma tarefa rápida em um arquivo que você já tem, como comprimir um PDF, converter uma foto ou remover dados ocultos. Muitos rodam no seu dispositivo sem enviar nada. Os utilitários mantêm dentro do Lolly as tarefas que as pessoas costumam entregar a um site qualquer. Comprimir um contrato, converter fotos de férias que ainda contêm sua localização ou colar um token em um formatador online não deveria significar entregar o arquivo a um site com retenção, jurisdição e modelo de negócios desconhecidos. [Lolly Utilities](/info/utilities.html) lista os utilitários, e [A troca com a qual nunca concordamos](/info/status-quo.html) conta a história por trás deles.

![A visão Utilities: Lolly Strip Hidden Data, Compress PDF, Convert Image e as outras tarefas que rodam no dispositivo, todas em um só lugar](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Nossa organização pode usar SSO, projetos compartilhados e aprovações?

Sim, com o **Lolly Work**, o servidor para organizações do mesmo projeto de código aberto. Ele roda separadamente e adiciona login único pelo seu provedor de identidade, provisionamento SCIM, permissões de grupos, projetos e recursos compartilhados, colaborações de trabalho ao vivo, aprovações e registros de auditoria. O app do dia a dia continua funcionando por conta própria.

[Use o Lolly na sua organização](/info/organisation.html) cobre como entrar e encontrar trabalhos compartilhados. [Implantação](/info/deployment.html#organisation-services-with-lolly-work) cobre a configuração do Lolly Work. O conteúdo compartilhado e os registros da organização seguem as políticas de privacidade e retenção daquela instância.

## Que obstáculos posso esperar ao adotar o Lolly?

Principalmente mudanças na forma como uma equipe produz trabalho, não na tecnologia. Uma equipe que quer um conjunto de ferramentas sujeito à governança precisa de alguém para criar seu sistema de design e os primeiros templates. Qualquer pessoa ainda pode criar suas próprias ferramentas no Lolly Design no primeiro dia, sem precisar de git. Os processos existentes continuam funcionando mesmo quando sua saída foge do padrão da marca. Converter bem um resultado visível, com o antes e o depois lado a lado, convence mais rápido que um plano.

[Adoção & Governança](/info/adoption-governance.html) cobre a integração por função, como medir um piloto e como pode ser um processo de governança.

## O Lolly foi feito com "vibe coding"?

O Lolly foi desenvolvido com programação assistida por IA, descoberta assistida por IA e, em muitos lugares, conteúdo assistido por IA, usando uma combinação de modelos e fornecedores, inclusive de empresas de IA de ponta em nuvem pública. Uma pessoa criou a arquitetura, fez a curadoria intencional do código e a direção de arte da experiência.

Um alerta de segurança de gravidade alta ou crítica nas dependências do Lolly bloqueia a CI. Um alerta que ainda não pode ser corrigido só fica pendente como uma exceção aprovada com uma justificativa por escrito. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) lista cada exceção mantida hoje, e as [notas de versão](https://github.com/lolly-tools/lolly/releases) listam as que cada versão leva. SECURITY.md também informa como relatar uma vulnerabilidade.

Verificações na compilação também rejeitam formulações que parecem feitas por máquina nos comentários do código, no app e nesta documentação, para manter o texto claro para todos os leitores. Um efeito colateral é que um detector pode ter mais dificuldade para identificar qual texto foi escrito por um modelo. Não buscamos causar isso.

Acima de tudo, o Lolly se apoia em décadas de trabalho de código aberto de especialistas do mundo inteiro.

**Declaração de uso de IA generativa:**

- **Código escrito por LLM:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (esta lista pode crescer)
- **Descoberta com LLM:** Gemini 3.1, Fable, Codex Astra
- **Documentação:** Sonnet 5
- **Bibliotecas de código aberto:** Seus respectivos autores, indicados na SBOM, nos comentários e nos cabeçalhos dos arquivos

Esta lista não inclui os modelos incorporados ao Lolly.

**Contribuições humanas:**
- **Ideação, revisão e feedback:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, a comunidade Penpot, Tim Hildred (lista não exaustiva)
- **Arquitetura, direção de arte & limpeza de conteúdo ruim:** Andy Fitzsimon

## Para onde foram as ferramentas com a marca SUSE?

Elas ficam em um repositório privado separado. Um clone público não baixa o pacote de marca da SUSE, então uma compilação feita a partir dele usa o perfil neutro `lolly-start`, a menos que você escolha outro. Esse perfil tem as ferramentas da comunidade independentes de marca e uma marca em branco que você preenche com a sua. [lolly.tools](https://lolly.tools) é compilado com o perfil `lolly-demo` e abre no [Lolly Demo](/info/lolly-demo.html), o sistema de design do próprio Lolly. A SUSE opera sua própria instância para proteger suas marcas registradas.

## Qual é o sabor daquele logotipo do Lolly?

Alguns dizem limão, outros dizem menta e às vezes maçã. O Lolly traz a doçura, e você cria o sabor.

## O que o Lolly entende por soberania de conteúdo?

Controle sobre como seu conteúdo é criado, governado, armazenado e transferido entre os sistemas que você escolhe. O Lolly oferece produção local, trabalhos editáveis e ferramentas portáteis. O Lolly Work acrescenta serviços compartilhados controlados pela organização. As licenças das fontes, as dependências disponíveis e os fluxos de dados do processo continuam relevantes. [O que é soberania de conteúdo?](/info/content-sovereignty.html) explica cada controle e seus limites.

## Podemos manter nosso DAM atual?

Sim. Um DAM compatível pode continuar sendo a fonte oficial enquanto o Lolly Work conecta recursos selecionados às ferramentas do Lolly. O acesso à fonte, as edições permitidas, os direitos de uso e a aprovação da saída final são decisões separadas. [Use o Lolly com seu DAM atual](/info/use-with-dam.html) explica essa configuração, e [A experiência da SUSE com o Brandfolder](/info/suse-brandfolder.html) registra o uso bem-sucedido durante a adoção.
