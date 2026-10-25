# Perguntas e respostas

Perguntas frequentes, exibidas como o acordeão em `/info/start/faq.html`.

**Como manter:** cada título `##` abaixo é uma pergunta; tudo abaixo dele
(até o próximo `##`) é a resposta. As respostas usam o mesmo markdown leve do
resto do site - parágrafos separados por uma linha em branco. Adicione, remova ou
reordene perguntas aqui e rode de novo `pnpm run build:info` (ou `pnpm run dev:web`).
Tudo acima do primeiro `##` (este título e estas notas) é ignorado pelo build.

A ordem é a de quem chega agora: primeiro a pegadinha, depois os seus arquivos, depois como obter
e executar o Lolly, depois as organizações e por fim como ele foi feito. A âncora de cada pergunta
é construída a partir da pergunta em inglês na mesma posição, então uma tradução mantém a
ordem do inglês.

## Por que é gratuito? Qual é a pegadinha?

**Criamos o Lolly para nós mesmos.** A SUSE precisava de milhares de arquivos fiéis à marca, feitos sem entregar nada a serviços externos. Então criamos uma ferramenta que faz tudo isso no dispositivo e a lançamos como código aberto, como tudo o mais que fazemos. Continuamos a mantê-la porque a usamos todos os dias. **Não há obrigação:** tudo aqui funciona com ou sem a gente.

Essa linha está traçada na licença, não em uma promessa: tudo o que roda localmente é gratuito, para sempre. Uma versão lançada é licenciada de modo a não poder ser retirada, e não há acordo de contribuidor que possa relicenciar o trabalho de alguém.

## Quanto a SUSE mantém em privado? (ou seja, quando vão puxar o tapete)

O motor, os shells, os schemas e as ferramentas independentes de marca são de código aberto. As marcas registradas da SUSE e as ferramentas com a marca dela são a parte que permanece privada, e já estão separadas. A instância pública em [lolly.tools](https://lolly.tools) executa o [Lolly Demo](/info/lolly-demo.html), o sistema de design do próprio Lolly.

Nada aqui depende de uma promessa: toda versão lançada continua sendo código aberto, e a única coisa reservada é a marca registrada. Quando outra empresa fechou, em 2023, os códigos-fonte do seu Linux corporativo, a SUSE foi cofundadora da [OpenELA](https://openela.org) para manter esse código aberto, a mesma postura que este projeto herda.

Transparência total: a SUSE *está* criando ferramentas internas para conectar o Lolly aos próprios sistemas de TI. Essa é a configuração interna da SUSE, não uma divisão entre desenvolvimento público e privado. O Lolly também pretende ser compilado pelo [Open Build Service](https://openbuildservice.org/), com artefatos seguros da cadeia de suprimentos entregues pelo [SUSE Application Collection](https://apps.rancher.io/applications).

## Por que o nome "Lolly Tools"?

**Lolly** porque a liberdade é doce e porque, na Austrália, na Nova Zelândia e na Grã-Bretanha, "lolly" quer dizer bala.

**Tools** porque uma ferramenta fica parada até você pegá-la. Ela não roda quando você não está usando e não fica te observando quando você está.

## Por que tudo é verde?

O lolly.tools abre no [Lolly Demo](/info/lolly-demo.html), o sistema de design de exemplo do próprio Lolly, e a cor principal dele é verde. É um exemplo, não uma regra. Mude para o **Lolly Starter**, um sistema de design em branco, ou para o seu próprio em [Settings → Design systems](/#/settings?focus=design-systems-section).

## Posso usar a minha própria marca?

Sim. O **Design System Setup** (`#/start`) cria um sistema de design a partir de uma cor, de um arquivo de design tokens ou de um design pronto, e então todas as ferramentas passam a desenhar com o seu sistema de design. [Start](/info/quickstart.html#put-your-brand-in) percorre os três caminhos.

Um sistema de design fornecido pela sua organização ou pela sua versão é gerenciado: mostra um cadeado e fica somente leitura, e você pode criar uma cópia editável para alterá-lo.

## Onde está a coisa que eu fiz ontem?

Se você pressionou **Save as** ou **Save**, ele está em **Projects**, na tela inicial, no navegador ou app em que você salvou. Se você pressionou apenas **Download**, o arquivo está onde o seu navegador ou sistema salva downloads, e normalmente há uma cópia em **Assets**. As ferramentas que [salvam enquanto você trabalha](/info/find-your-work.html#which-tools-save-as-you-work) também mantêm o trabalho não salvo em **Projects**. [Find and recover your work](/info/find-your-work.html) cobre todos os casos.

## Fechei a aba. Meu trabalho se foi?

O trabalho salvo continua em **Projetos**. O trabalho não salvo se foi, exceto nas ferramentas que salvam enquanto você trabalha, que o mantêm em **Projetos** também. Da próxima vez, pressione **Salvar como** antes de sair. Veja [Se você fechou a aba ou saiu da ferramenta](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Posso compartilhar meu trabalho como arquivo em vez de link?

Sim. Quando um link não consegue carregar tudo, como as suas próprias fotos ou um texto longo, a caixa Share diz o que se perderia e oferece um arquivo **.lolly**: um arquivo com o design, as imagens que ele usa e, se você escolher, a própria ferramenta.

Você decide quanto viaja. Seu nome e seus dados só entram se o seu perfil autorizar, e a arte licenciada é retida, a menos que você escolha incluí-la. Quem abre um arquivo que carrega uma ferramenta é perguntado se confia nela antes que ela possa rodar. Veja [Sharing your work](/info/using.html#sharing-your-work).

## Para que servem os dados do meu perfil?

Seus dados em **Settings** preenchem de antemão as ferramentas que os pedem, como um nome em um crachá. Eles ficam neste dispositivo. Se você também ativar a opção de inclusão, os dados que escolher são selados no que você cria, nomeando você como a origem. Nada é incluído, a menos que você escolha incluir seus dados.

O compartilhamento e o Sync enviam apenas o conteúdo que você escolher. Em uma instância do Lolly Work de uma organização, as sessões compartilhadas e o trabalho governado também vão para esse servidor. Veja [Privacy](/info/privacy.html).

## Como consigo os apps para celular ou desktop?

Baixe em [Install Lolly](/info/install.html). A página lista todas as versões para macOS, Windows, Linux e Android e mostra como conferir o arquivo que você baixou. iPhone e iPad recebem o **Lolly Tools** pela App Store; [a seção de iPhone e iPad](/info/install.html#iphone-and-ipad) tem o link.

Qualquer pessoa também pode compilar e distribuir a própria cópia do app, com as ferramentas e configurações de que o seu público precisa. O [Build Guide](/info/build-guide.html) mostra como.

## O Lolly diz que exige WebGPU. O que posso fazer?

O app web desenha com WebGPU, um recurso gráfico dos navegadores atuais, e verifica se ele existe antes de abrir uma ferramenta. Tente isto, em ordem:

1. Atualize o navegador para a versão atual.
2. Ative a aceleração gráfica ou de hardware nas configurações do navegador e depois reinicie o navegador.
3. Tente um navegador que tenha sido testado: [Supported environments](/info/supported-environments.html) os lista.
4. Em um Mac, iPhone ou iPad, [instale o app](/info/install.html).

## O Lolly consegue editar e renderizar meus arquivos do Figma, Penpot, Illustrator ou InDesign?

Sim. Abra o **Design** e clique em **Import a design**: ele aceita um **.fig** nativo do Figma (Save local copy), uma exportação **.penpot** do Penpot, um **.ai** ou **.pdf** do Illustrator, um **.idml** do InDesign (File → Export → InDesign Markup) ou **qualquer SVG**. Você não precisa de conta, de plugin nem de licença de app de design.

![A prancheta aberta do Design - Import a design fica no menu Lolly da barra de ferramentas](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

As camadas chegam como caixas editáveis: o texto continua editável, as formas continuam formas e as imagens entram na sua própria biblioteca. Salve, e o **Share with rules** pode transformar o layout em uma ferramenta que qualquer pessoa com o Lolly pode preencher de novo. Veja [Import a design](/info/design-import.html).

## Duas pessoas conseguem trabalhar no mesmo design sem internet?

Sim. Uma pessoa compartilha um convite, como link, QR code ou código curto, e a outra aceita. Os dois dispositivos passam a ter a mesma sessão ao vivo, com presença e anéis de foco incluídos. Funciona em qualquer rede compartilhada, inclusive em um hotspot de celular em um porão, porque não há servidor no meio. Veja [Working together](/info/collaborate.html). Para colegas em redes diferentes, a instância do Lolly Work de uma organização oferece collabs de trabalho autenticados.

## O que são as feature flags?

Os feature flags ativam ou desativam partes do Lolly. No uso autônomo, você escolhe suas configurações pessoais. Uma organização que usa o Lolly Work pode definir padrões ou ocultar certas opções sob a própria política, e os controles gerenciados são identificados. Veja [Use Lolly at your organisation](/info/organisation.html).

![Feature flags pessoais no app autônomo; a política da organização pode governar certas opções](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## O que diferencia os utilitários das ferramentas?

Um utilitário faz um trabalho rápido em um arquivo que você já tem, como comprimir um PDF, converter uma foto ou remover dados ocultos, e muitos deles rodam no seu dispositivo sem enviar nada. Eles existem para que os trabalhos que as pessoas costumam entregar a um site qualquer fiquem dentro do Lolly. Comprimir um contrato, converter fotos de férias com a localização ainda dentro ou colar um token em um formatador online não deveria significar entregar o arquivo a um site de retenção, jurisdição e modelo de negócio desconhecidos. [Utilities](/info/utilities.html) os lista, e [The trade we never agreed to](/info/status-quo.html) conta a história por trás deles.

![A tela Utilities: Strip Hidden Data, Compress PDF, Convert Image e os outros trabalhos no dispositivo, todos em um só lugar](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Nossa organização pode usar SSO, projetos compartilhados e aprovações?

Sim, com o **Lolly Work**, o servidor de organização do mesmo projeto de código aberto. Ele roda separadamente e acrescenta single sign-on pelo seu provedor de identidade, provisionamento SCIM, permissões por grupo, projetos e recursos compartilhados, collabs de trabalho ao vivo, aprovações e registros de auditoria. O app do dia a dia continua funcionando sozinho.

[Use Lolly at your organisation](/info/organisation.html) cobre o login e como encontrar o trabalho compartilhado, e [Deployment](/info/deployment.html#organisation-services-with-lolly-work) cobre a configuração. O conteúdo compartilhado e os registros da organização seguem as políticas de privacidade e retenção dessa instância.

## Que obstáculos posso esperar ao adotar o Lolly?

Na maior parte, a mudança está no lado de quem produz, e não na tecnologia. Uma equipe que quer um conjunto governado de ferramentas precisa de alguém que crie o sistema de design e os primeiros templates, embora qualquer pessoa possa começar a criar as próprias ferramentas no Design desde o primeiro dia, sem precisar de git. E os processos existentes continuam funcionando mesmo quando o resultado deles foge da marca, então converter bem uma saída visível, com o antes e o depois lado a lado, defende a causa mais rápido do que um plano.

[Adoption & Governance](/info/adoption-governance.html) cobre a integração por função, como medir um piloto e como pode ser um processo de governança.

## A Lolly foi "vibe coded"?

O Lolly foi desenvolvido com programação assistida por IA, descoberta assistida por IA e, em muitos pontos, conteúdo assistido por IA, usando uma mistura de modelos e fornecedores, incluindo os de empresas de ponta de nuvem pública. Uma pessoa criou a arquitetura, selecionou o código com intenção e dirigiu a arte da experiência.

Um aviso de severidade alta ou crítica nas dependências do Lolly bloqueia o CI. Um aviso que ainda não pode ser corrigido só é mantido como exceção aprovada, com uma justificativa por escrito. O [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) lista cada exceção mantida hoje, e as [notas de versão](https://github.com/lolly-tools/lolly/releases) listam as que cada versão carrega. O SECURITY.md também diz como relatar uma vulnerabilidade.

As verificações da compilação também rejeitam textos que parecem feitos por máquina nos comentários do código, no app e nestes documentos, para manter o texto simples para todos os leitores. Um efeito colateral é que um detector pode ter mais dificuldade para dizer qual texto um modelo escreveu. Não foi nosso objetivo causar isso.

O mais importante: o Lolly se apoia nos ombros de décadas de trabalho de código aberto de especialistas do mundo todo.

**Divulgação de IA generativa:**

- **Código escrito por LLM:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (esta lista pode crescer)
- **Descoberta por LLM:** Gemini 3.1, Fable, Codex Astra
- **Documentação:** Sonnet 5
- **Bibliotecas de código aberto:** Seus respectivos autores, expressos no SBOM, nos comentários e nos cabeçalhos de arquivo

Esta lista não inclui modelos empacotados (vendored) dentro da Lolly.

**Contribuições humanas:**
- **Ideação, revisão e feedback:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, a Comunidade Penpot, Tim Hildred (lista não exaustiva)
- **Arquitetura, direção de arte e faxineiro de slop:** Andy Fitzsimon

## Para onde foram as ferramentas com a marca SUSE?

Elas ficam em um repositório separado e privado. Um clone público não busca o pacote de marca da SUSE, então uma compilação a partir dele usa o perfil neutro `lolly-start`, a menos que você escolha outro: as ferramentas da comunidade independentes de marca mais uma marca em branco que você preenche com a sua. O [lolly.tools](https://lolly.tools) é compilado com o perfil `lolly-demo` e abre no [Lolly Demo](/info/lolly-demo.html), o sistema de design do próprio Lolly. A SUSE opera a própria instância para proteger suas marcas registradas.

## Qual é o sabor daquele logo do Lolly?

Uns dizem limão, outros dizem menta e às vezes maçã; o Lolly traz a doçura, o sabor é você quem faz!
