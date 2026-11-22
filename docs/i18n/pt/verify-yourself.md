# Verifique você mesmo

Toda promessa neste site pode ser verificada, sem conta. A maioria das verificações só precisa de um navegador; as demais precisam de um terminal e uma cópia do código-fonte. Se uma verificação abaixo não der o resultado mostrado, isso é um bug ou uma promessa quebrada, e queremos saber: veja [Se uma verificação falhar](#if-a-check-fails).

Estas verificações cobrem o Lolly sozinho. Se sua organização executa o Lolly Work, ele adiciona login, conteúdo compartilhado, telemetria configurada e registros de auditoria; confira esses itens com a [Superfície do servidor](/info/server-surface.html) e a [seção da política de privacidade sobre organizações](/info/privacy.html#organisation-services-with-lolly-work).

<!--i:eti-clock-->
## Veja funcionar em dez segundos

Abra [`/verify`](/#/verify) e solte um arquivo na página. Não há upload, conta nem espera por um servidor. Aqui ele verifica a [tempestade gerada de Queensland](/info/ai-stance.html) de Nossa posição sobre IA: uma imagem que o Gemini gerou, que o Lolly abriu, marcou e converteu. Cada selo foi calculado no dispositivo, a partir dos próprios bytes do arquivo.

![O Lolly Verify em uma tela com a largura de um celular - a imagem da tempestade, um veredito verde Made with Lolly e os selos de credencial intacta e bytes inalterados empilhados abaixo](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

O veredito é um pequeno conjunto de selos, cada um um fato independente:

- <!--i:lock--> **Made with Lolly**: a credencial está intacta *e* registra uma exportação do Lolly.
- <!--i:seal--> **The credential is intact**: o manifesto C2PA assinado é analisado com sucesso e a assinatura da sua própria declaração é validada.
- <!--i:hash--> **The bytes have not changed**: o hash do arquivo ainda corresponde ao que foi assinado. Altere um pixel e este selo muda.
- <!--i:sparkle--> **GEN AI**: uma máquina criou estes pixels, e o arquivo diz isso. O Lolly lê essa declaração do arquivo em vez de esconder o fato.

Todo o histórico acompanha o arquivo. Nove etapas são preservadas aqui: cinco que o Google registrou ao gerar e adicionar marca d'água à imagem, depois quatro que o Lolly registrou ao abrir, marcar e converter a cópia nesta página. O Lolly Verify as lê diretamente dos bytes e as desenha como uma linha do tempo.

![O histórico de alterações que o Lolly Verify lê da imagem da tempestade - cinco etapas registradas pelo Google, depois quatro pelo Lolly, terminando no WebP desta página](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

As verificações abaixo são as garantias por trás dessa demonstração, e cada uma é reproduzível. [Content Credentials](/info/content-credentials-identity.html) explica cada veredito.

<!--i:eti-globe-->
## No seu navegador, sem precisar de ferramentas

::: timeline
- <!--i:globe--> **1. Observe a rede.** Abra [lolly.tools](https://lolly.tools), abra o DevTools do seu navegador (F12), mude para **Network** e use uma ferramenta: digite um endereço web no [Lolly QR Code](/t/qr-code), mude cores, exporte um PNG. Toda solicitação vai para `lolly.tools`: o shell do app, os arquivos da própria ferramenta e os recursos do catálogo. Não há host de análise de uso, beacon de CDN, serviço de fontes nem endpoint de relatórios de erro. O que você digita em uma ferramenta não aparece em **nenhuma solicitação**, porque a renderização é local.
- <!--i:eyeoff--> **2. Desconecte.** Carregue o app e abra uma ou duas ferramentas, depois fique offline (modo avião, ou DevTools → Network → Offline) e recarregue. A galeria e todas as ferramentas que você abriu continuam funcionando, incluindo renderização e exportação nos formatos que você usou. Os arquivos de uma ferramenta e o codificador de um formato ficam em cache na primeira vez que você os usa, então use uma ferramenta uma vez online antes de testá-la offline. Esta é a verificação individual mais forte desta página: um software que envia dados ao seu servidor não sobrevive ao corte da conexão.
- <!--i:check--> **3. Conte os cookies.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. A lista está vazia: o app não define cookies. Cole `document.cookie` no console e você recebe `""`. O cadastro opcional na CA define um cookie `HttpOnly` de curta duração, `lolly_ca_state`, restrito a `/api/ca`, que `document.cookie` não consegue mostrar. Uma instância do Lolly Work usa seus próprios cookies de login; compare-os com [Privacidade](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Leia seu próprio armazenamento.** No mesmo painel, tudo o que o Lolly guarda está na sua frente: cerca de duas dúzias de chaves simples de `localStorage` (tema, idioma, largura da barra lateral, configurações de som e visualização e uma cópia em cache do índice do catálogo público de ferramentas) e seus próprios documentos no IndexedDB. Cada valor é uma string legível ou JSON, sem nada ofuscado. Limpar os dados do site remove esses registros locais, mas não um backup do Sync nem registros armazenados por uma instância do Lolly Work. **Settings → Storage → Clear all my data** faz o mesmo de dentro do app, e você pode ver os armazenamentos e caches esvaziarem.
- <!--i:lock--> **5. Confira se o contato para divulgação existe.** [`/.well-known/security.txt`](/.well-known/security.txt) responde com um bloco de contato [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), não uma página HTML.
:::

::: details O que mais você pode ver na aba Network
Alguns recursos acessam a rede apenas quando você os usa, e cada um fica visível na mesma aba:

- adicionar uma **Google Font** no Lolly Design System Setup busca essa única família no Google, após uma caixa de consentimento que informa isso, uma vez, antes da primeira busca;
- clicar em uma **predefinição de perfil de impressão ICC** busca esse perfil no registro público do ICC em color.org;
- ouvir o **rádio** integrado opcional recebe a transmissão da estação;
- inserir um local no **Meeting Planner** consulta esse lugar no serviço de geocodificação do open-meteo para obter suas coordenadas e seu fuso horário, uma vez por cidade (as respostas são salvas no seu dispositivo), e o campo informa isso onde você digita;
- o **Lolly URL Screenshot** carrega o endereço que você digitou, e você vê isso acontecer.

Uma ferramenta que declara uma capacidade de rede só pode buscar dados dos hosts permitidos pelo seu manifesto, e essa verificação bloqueia o acesso em caso de falha. Nenhuma ferramenta distribuída hoje declara uma, então a Content-Security-Policy aplicada pelo navegador limita a lista acima aos seus hosts. A [política de privacidade](/info/privacy.html) tem a tabela canônica de todos eles, incluindo tráfego de instâncias gerenciadas, como atualizações de políticas e envio de relatórios habilitado.
:::

<!--i:eti-code-->
## Pelo terminal

**6. O endpoint de renderização responde apenas com dados públicos.** O único recurso do servidor que coloca entradas digitadas em uma URL, as renderizações por link direto, está ativo aqui. A [política de privacidade](/info/privacy.html) diz o que isso significa para as entradas que você coloca em um link.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Cada implantação escolhe (`LOLLY_DISABLE_RENDER_GET=1`): em uma instância que define a variável, a mesma sondagem retorna `404`. Essa diferença é a configuração funcionando, não uma inconsistência.

**7. Verifique os serviços que sua implantação habilita.** [Superfície do servidor](/info/server-surface.html) lista os serviços opcionais e traz links para suas referências detalhadas. Para o Lolly Work, inclua suas APIs autenticadas, conexão de colaboração, armazenamento e provedores configurados. Uma sondagem do lolly.tools público não testa uma instância privada de uma organização.

Se você executa sua própria instância, [Implantação da entrega](/info/deploy-delivery.html) tem as verificações de lançamento: integridade do modelo, a sondagem de borda e sua lista de amostras, versões para exibição, o gateway privado de download e o catálogo assinado em um navegador.


<!--i:eti-search-->
## No código-fonte

Tudo acima ainda poderia ser encenação se o código implantado fosse diferente do código público. Então verifique o código. A implantação é compilada a partir do [repositório público](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Nenhum rastreador nem SDK de análise de uso, em lugar algum.** Procure os suspeitos de sempre no código distribuído (o motor, todos os shells incluindo a extensão do navegador, as sobrescritas da ponte Tauri e o service worker, as funções do servidor e os pacotes de ferramentas):

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Essa varredura procura SDKs de rastreamento de terceiros. Ela não demonstra a ausência de relatórios de uso próprios: o Lolly Work oferece telemetria da organização e um registro de auditoria separado, com sua própria política e seus próprios testes.

**9. Nenhum resolvedor DNS de terceiros.** A verificação SEAL do Lolly Verify nunca envia uma consulta por um provedor DNS-over-HTTPS, porque o app não tem resolvedor:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. O serviço de certificados não mantém registro de emissão.** A CA de identidade não mantém registro do que emitiu nem inventário de identidades: nenhuma linha em stdout, nenhum webhook, nenhum armazenamento de certificados. É possível buscar para confirmar essa ausência:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

A CA mantém estado de trabalho de curta duração: compartimentos de limitação de requisições armazenam chaves de IP e e-mail com hash durante sua janela, e o armazenamento de admissão de uma implantação gerenciada mantém um identificador baseado em chave e um resumo criptográfico da solicitação por no máximo dez minutos. [Engenharia de Content Credentials](/info/content-credentials-engineering.html#protocol) traz os detalhes.

<!--i:eti-flask-->
## Garantido por testes

As verificações do código-fonte acima não são uma auditoria pontual: elas estão fixadas na suíte de testes, então não podem se deteriorar sem que se perceba. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) verifica uma lista maior de nomes de rastreadores do que a varredura acima e faz a compilação falhar se:

- qualquer SDK de análise de uso ou rastreamento aparecer em qualquer parte do código-fonte distribuído que ele verifica, incluindo código do app, motor, servidor, extensão e pacotes de ferramentas;
- qualquer resolvedor DNS-over-HTTPS de terceiros aparecer nesse código-fonte;
- o registro de emissão da CA voltar, no código-fonte **ou** no pacote de servidor gerado;
- a política de privacidade perder suas declarações legalmente exigidas (controlador identificado, base legal, direito de apresentar reclamação).

Execute você mesmo no clone (Node 22.18 ou posterior; este arquivo não precisa de `pnpm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

A suíte completa (`pnpm install && pnpm test`) executa vários milhares de testes a mais, incluindo os testes adversariais de criptografia descritos em [Segurança & Verificação](/info/security.html).

<!--i:eti-eye-off-->
## O que você não pode verificar de fora

- **Registros de acesso da hospedagem.** Qualquer servidor pode registrar as solicitações que responde: endereço IP, caminho e hora. Uma sondagem externa não pode determinar por quanto tempo os registros são mantidos. O operador controla o registro, a rotação e as exportações, e deve divulgar essas escolhas. A renderização local mantém as edições comuns no seu dispositivo; a renderização opcional no servidor e os serviços de espaço de trabalho compartilhado têm os fluxos de dados separados que a política de privacidade descreve.
- **Que a implantação executa este código.** Você pode verificar se o código-fonte está limpo e se o comportamento implantado corresponde ao código-fonte, e as verificações acima fazem as duas coisas. A plataforma web não oferece atestação em nível binário de uma implantação web. As medidas de mitigação são o repositório público, os testes obrigatórios e a verificação offline: uma implantação adulterada que envia dados ao seu servidor falha nas verificações 1 e 2 ao mesmo tempo.
- **Hooks de ferramentas.** A lógica opcional de uma ferramenta integrada é revisada em vez de isolada em sandbox: ela roda na página, a menos que a ferramenta opte por um Worker. Todas as ferramentas em lolly.tools são próprias e revisadas antes da distribuição. O [Modelo de ameaças](/info/threat-model.html#trust-boundaries) define onde os hooks rodam e o que os limita.

<!--i:eti-warning-->
## Se uma verificação falhar

Uma diferença entre esta página e o que você observa é um relato de segurança. Envie pelos canais privados em [Segurança & Verificação](/info/security.html#reporting-a-vulnerability). Praticamos divulgação coordenada e damos crédito a quem relata.
