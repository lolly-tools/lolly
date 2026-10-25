# Verifique você mesmo

Toda promessa neste site pode ser verificada, sem conta. A maioria das verificações precisa apenas de um navegador; as demais precisam de um terminal e uma cópia do código-fonte. Se uma verificação abaixo não der o resultado mostrado, isso é um bug ou uma promessa quebrada, e queremos saber: veja [If a check fails](#if-a-check-fails).

Comece pela mais rápida: solte um arquivo no Verify. Depois vá além: observe a rede enquanto usa uma ferramenta, desconecte a tomada e continue trabalhando, conte os cookies e leia o código-fonte.

Essas verificações cobrem o Lolly por si só. Se a sua organização executa o Lolly Work, ele acrescenta login, conteúdo compartilhado, telemetria configurada e registros de auditoria; confira-os com [Server Surface](/info/server-surface.html) e com a [seção da organização da política de privacidade](/info/privacy.html#organisation-services-with-lolly-work).

## Veja funcionando, em dez segundos

Abra [`/verify`](/#/verify) e solte um arquivo na página. Não há envio, conta nem espera por um servidor. Aqui ele verifica a [tempestade de Queensland gerada](/info/ai-stance.html) de Our AI Stance: uma imagem que o Gemini gerou, que o Lolly abriu, marcou e converteu. Todos os selos foram calculados no dispositivo, a partir dos próprios bytes do arquivo.

![Verify em uma tela largura de telefone - a imagem da tempestade, um veredito verde Made with Lolly e os selos de credencial intacta e bytes inalterados empilhados abaixo dela](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

O veredito é um pequeno monte de selos, cada um um fato independente:

- <!--i:lock--> **Made with Lolly**: a credencial está intacta *e* registra uma exportação do Lolly.
- <!--i:seal--> **The credential is intact**: o manifesto C2PA assinado é analisado e a assinatura da própria declaração é verificada.
- <!--i:hash--> **The bytes have not changed**: o hash do arquivo ainda corresponde ao que foi assinado. Altere um pixel e este selo vira.
- <!--i:sparkle--> **GEN AI**: uma máquina criou estes pixels, e o arquivo diz isso. O Lolly lê essa declaração de volta em vez de esconder o fato.

Todo o histórico viaja com o arquivo. Nove etapas sobrevivem aqui: cinco que o Google registrou ao gerar e marcar com marca d'água a imagem, depois quatro que o Lolly registrou ao abrir, marcar e converter a cópia desta página. O Verify as lê direto dos bytes e as desenha como uma linha do tempo.

![O histórico de alterações que o Verify lê de volta da imagem da tempestade - cinco etapas registradas pelo Google, depois quatro pelo Lolly, terminando no WebP nesta página](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Essa é a demonstração. As verificações abaixo são as garantias por baixo dela, e cada uma é reproduzível. [Content Credentials](/info/content-credentials-identity.html) explica cada veredito.

## No seu navegador, sem ferramentas necessárias

::: timeline
- <!--i:globe--> **1. Observe a rede.** Abra o [lolly.tools](https://lolly.tools), abra o DevTools do seu navegador (F12), vá para **Network** e use uma ferramenta: digite um endereço web no [QR Code](/t/qr-code), mude as cores, exporte um PNG. Toda requisição fica em `lolly.tools`: o shell do app, os arquivos da própria ferramenta e os recursos do catálogo. Não há host de análise de uso, beacon de CDN, serviço de fontes nem endpoint de relatório de erros. O que você digita em uma ferramenta aparece em **nenhuma requisição**, porque a renderização é local.
- <!--i:eyeoff--> **2. Desconecte a tomada.** Carregue o app e abra uma ou duas ferramentas, depois fique offline (modo avião, ou DevTools → Network → Offline) e recarregue. A galeria e todas as ferramentas que você abriu continuam funcionando, inclusive a renderização e a exportação nos formatos que você usou. Os arquivos de uma ferramenta e o codificador de um formato ficam em cache na primeira vez que você os usa, então use uma ferramenta uma vez online antes de testá-la offline. Esta é a verificação isolada mais forte desta página: um software que liga para casa não sobrevive a ter o cabo cortado.
- <!--i:check--> **3. Conte os cookies.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. A lista está vazia: o app não define cookies. Cole `document.cookie` no console e você obtém `""`. O cadastro opcional na CA define um cookie `HttpOnly` de curta duração, `lolly_ca_state`, restrito a `/api/ca`, que o `document.cookie` não consegue mostrar. Uma instância do Lolly Work usa os próprios cookies de login; compare-os com [Privacy](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Leia o seu próprio armazenamento.** No mesmo painel, tudo o que o Lolly guarda está diante de você: algumas dezenas de chaves simples de `localStorage` (tema, idioma, largura da barra lateral, configurações de som e de visualização, e uma cópia em cache do índice público do catálogo de ferramentas) e os seus próprios documentos no IndexedDB. Todo valor é uma string ou JSON legível, sem nada ofuscado. Limpar os dados do site remove esses registros locais, mas não um backup do Sync nem registros mantidos por uma instância do Lolly Work. **Settings → Storage → Clear all my data** faz o mesmo de dentro do app, e você pode ver os armazenamentos e caches se esvaziarem.
- <!--i:lock--> **5. Confira se o contato de divulgação existe.** [`/.well-known/security.txt`](/.well-known/security.txt) responde com um bloco de contato [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), não com uma página HTML.
:::

::: details O que mais você pode ver na aba Network
Alguns recursos só acessam a rede quando você os usa, e cada um é visível na mesma aba:

- adicionar uma **Google Font** no Design System Setup busca essa única família no Google, depois de uma caixa de consentimento que avisa isso, uma vez, antes da primeira busca;
- clicar em uma **predefinição de perfil de impressão ICC** busca esse perfil no registro público do ICC em color.org;
- tocar o **rádio** integrado opcional transmite a partir da estação;
- digitar um local no **Meeting Planner** consulta esse lugar no serviço de geocodificação do open-meteo para obter as coordenadas e o fuso horário, uma vez por cidade (as respostas ficam salvas no seu dispositivo), e o campo avisa isso onde você digita;
- o **URL Screenshot** carrega o endereço que você digitou, porque esse é o trabalho dele, e você vê isso acontecer.

Uma ferramenta que declara uma capacidade de rede só pode buscar nos hosts que o manifesto dela permite, e essa verificação falha de forma segura. Nenhuma ferramenta incluída hoje declara uma, então é a Content-Security-Policy aplicada pelo navegador que mantém a lista acima restrita a seus hosts. A [política de privacidade](/info/privacy.html) mantém a tabela canônica de tudo isso, incluindo o tráfego de instâncias gerenciadas, como atualizações de política e relatórios ativados.
:::

## Em um terminal

**6. O endpoint de renderização responde apenas com dados públicos.** O único recurso de servidor que coloca entradas digitadas em uma URL, as renderizações por hotlink, está ativo aqui. A [política de privacidade](/info/privacy.html) diz o que isso significa para as entradas que você coloca em um link.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Cada implantação escolhe (`LOLLY_DISABLE_RENDER_GET=1`): em uma instância que a define, a mesma sondagem retorna `404`. Essa diferença é a configuração funcionando, não uma inconsistência.

**7. Verifique os serviços que a sua implantação ativa.** [Server Surface](/info/server-surface.html) lista os serviços opcionais e leva às referências detalhadas deles. Para o Lolly Work, inclua suas APIs autenticadas, a conexão de colaboração, o armazenamento e os provedores configurados. Uma sondagem do lolly.tools público não testa uma instância privada de organização.

Se você executa a sua própria instância, [Delivery deployment](/info/deploy-delivery.html) traz as verificações de lançamento dela: integridade de modelos, a sondagem de borda e a lista de amostras, versões de exibição, o gateway de download privado e o catálogo assinado em um navegador.


## No código-fonte

Tudo o que foi dito acima ainda poderia ser teatro se o código implantado fosse diferente do código público. Então verifique o código. A implantação é compilada a partir do [repositório público](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Nenhum rastreador e nenhum SDK de análise de uso, em lugar nenhum.** Procure no código que é distribuído (o motor, todos os shells, inclusive a extensão de navegador, as sobreposições da ponte do Tauri e o service worker, as funções de servidor e os pacotes de ferramentas) pelos suspeitos de sempre:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Esta busca procura SDKs de rastreamento de terceiros. Ela não mostra a ausência de relatórios de uso do próprio projeto: o Lolly Work oferece telemetria da organização e um log de auditoria separado, com política e testes próprios.

**9. Nenhum resolvedor DNS de terceiros.** A verificação SEAL do Verify nunca envia uma consulta por um provedor DNS-over-HTTPS, porque o app não tem resolvedor:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. O serviço de certificados não mantém log de emissão.** A CA de identidade não guarda log do que emitiu nem inventário de identidades: nenhuma linha em stdout, nenhum webhook, nenhum armazenamento de certificados. A ausência pode ser buscada:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

A CA mantém, sim, estado de trabalho de curta duração: os buckets de limite de taxa guardam chaves de IP e e-mail com hash durante a janela deles, e o armazenamento de admissão de uma implantação gerenciada guarda um identificador com chave e um digest da requisição por no máximo dez minutos. [Content Credentials engineering](/info/content-credentials-engineering.html#protocol) traz o detalhe.

## Garantido por testes

As verificações de código acima não são uma auditoria única: elas estão fixadas na suíte de testes, para que não apodreçam em silêncio. O [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) confere uma lista de nomes de rastreadores mais longa que a busca acima e quebra a compilação se:

- qualquer SDK de análise de uso ou rastreamento aparecer em qualquer parte do código distribuído que ele examina, no código do app, do motor, do servidor, da extensão e dos pacotes de ferramentas;
- qualquer resolvedor DNS-over-HTTPS de terceiros aparecer nesse código;
- o log de emissão da CA voltar, no código-fonte **ou** no pacote de servidor gerado;
- a política de privacidade perder as declarações exigidas por lei (controlador nomeado, base legal, direito de reclamar).

Execute-os você mesmo no clone (Node 22.18 ou posterior; este arquivo não precisa de `pnpm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

O conjunto completo (`pnpm install && pnpm test`) executa mais alguns milhares, incluindo os testes adversariais de criptografia descritos em [Segurança e Verificação](/info/security.html).

## O que você não consegue verificar de fora

- **Logs de acesso da hospedagem.** Qualquer servidor que responde a uma requisição pode registrá-la: endereço IP, caminho e horário. Uma sondagem externa não consegue estabelecer por quanto tempo os logs são mantidos. O operador controla o registro, a rotação e as exportações, e deve divulgar essas escolhas. A renderização local mantém as edições comuns no seu dispositivo; a renderização opcional no servidor e os serviços de espaço de trabalho compartilhado têm os fluxos de dados separados que a política de privacidade descreve.
- **Que a implantação executa este código.** Você pode verificar que o código-fonte está limpo e que o comportamento implantado corresponde a ele, e as verificações acima fazem as duas coisas. A atestação em nível de binário de uma implantação web não é algo que a plataforma web ofereça. As mitigações são o repositório público, os testes aplicados e a verificação offline: uma implantação adulterada que liga para casa falha nas verificações 1 e 2 ao mesmo tempo.
- **Hooks de ferramentas.** A lógica opcional de uma ferramenta integrada é revisada, e não isolada em sandbox: ela roda na página, a menos que a ferramenta opte por um Worker. Toda ferramenta do lolly.tools é própria e revisada antes de ser distribuída. O [Threat Model](/info/threat-model.html#trust-boundaries) expõe onde os hooks rodam e o que os limita.

## Se uma verificação falhar

Uma diferença entre esta página e o que você observa é um relatório de segurança. Envie-o pelos canais privados em [Security & Verification](/info/security.html#reporting-a-vulnerability). Praticamos a divulgação coordenada e damos crédito a quem relata.
