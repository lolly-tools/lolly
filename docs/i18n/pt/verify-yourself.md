# Verifique você mesmo

As páginas de privacidade e segurança do Lolly fazem afirmações: sem análise, sem rastreamento, arquivos que nunca saem do dispositivo, um único cookie em todo o sistema. Esta página é diferente: ela não pede que você acredite em nada disso. É uma lista de procedimentos, cada um com o comando ou caminho de clique exato e o resultado que você verá. Toda afirmação aqui é refutável em minutos, a maioria sem instalar nada.

Se alguma verificação nesta página não produzir o resultado mostrado, isso é um bug ou uma promessa quebrada. [Reporte](#if-a-check-fails) de qualquer forma, e vamos tratar com a gravidade que uma promessa quebrada merece.

## Veja funcionando, em dez segundos

Antes dos procedimentos, o resultado. Abra [`/verify`](/#/verify) e solte um arquivo nele - sem upload, sem conta, sem esperar por um servidor. Aqui está verificando a [tempestade de Queensland gerada](/info/ai-stance.html) da nossa página de posicionamento sobre IA: uma imagem do Gemini que o Lolly abriu, redimensionou e exportou. Cada selo abaixo foi calculado no dispositivo, a partir dos próprios bytes do arquivo.

![Verify em uma tela largura de telefone - a imagem da tempestade, um veredito verde Made with Lolly e os selos de credencial intacta e bytes inalterados empilhados abaixo dela](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

O veredito não é um único selo, mas uma pequena pilha deles, cada um um fato independente:

- <!--i:lock--> **Made with Lolly** - a credencial está intacta *e* registra uma exportação do Lolly.
- <!--i:seal--> **A credencial está intacta** - o manifesto C2PA assinado é interpretado e sua própria assinatura de claim é verificada.
- <!--i:hash--> **Os bytes não mudaram** - o hash do arquivo ainda corresponde ao que foi assinado. Altere um pixel e este selo muda.
- <!--i:sparkle--> **GEN AI** - uma máquina fez esses pixels, e o arquivo diz isso. O Lolly lê essa afirmação de volta em vez de escondê-la.

E todo o histórico viaja com o arquivo. Nove etapas sobrevivem aqui - cinco que o Google registrou ao gerar e marcar com watermark a imagem, depois quatro que o Lolly registrou ao abrir, marcar e converter a cópia nesta página - lidas diretamente dos bytes, no seu dispositivo, e renderizadas como uma linha do tempo. É a mesma imagem, verificada da mesma forma, que a linha do tempo C2PA na [página de posicionamento sobre IA](/info/ai-stance.html).

![O histórico de alterações que o Verify lê de volta da imagem da tempestade - cinco etapas registradas pelo Google, depois quatro pelo Lolly, terminando no WebP nesta página](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Nada disso é a promessa de confiança, no entanto - isso é a demonstração. O resto desta página é a promessa de confiança: cada selo acima é reproduzível, e aqui está como você reproduz as garantias por trás deles.

## No seu navegador, sem ferramentas necessárias

**1. Observe a rede.** Abra o [lolly.tools](https://lolly.tools), abra as DevTools do seu navegador (F12), mude para a aba **Network** e use uma ferramenta - digite uma URL em [QR Code](/t/qr-code), mude cores, exporte um PNG. Toda requisição permanece em `lolly.tools`: o app shell, os próprios arquivos da ferramenta, os ativos do catálogo. Nenhum host de analytics, nenhum beacon de CDN, nenhum serviço de fontes, nenhum endpoint de "relatório de erros". O que você digita em uma ferramenta não aparece em **nenhuma requisição** - a renderização é local.

As exceções honestas - todas opt-in, iniciadas pelo usuário e visíveis na mesma aba Network quando acontecem: adicionar uma **Google Font** no editor de marca busca aquela família específica na Google, após um diálogo de consentimento que informa exatamente isso, uma vez, antes da primeira busca; clicar em um **preset de perfil ICC de impressão** busca aquele perfil no registro público do ICC em color.org; tocar o **rádio** integrado opcional transmite da estação; inserir um local no **Meeting Planner** consulta esse lugar no serviço de geocodificação da open-meteo para suas coordenadas e fuso horário, uma vez por cidade (as respostas são salvas no seu dispositivo), e o campo carrega esse aviso bem onde você digita; e o **URL Screenshot** necessariamente carrega a URL que você digitou - essa é sua função, e você observa isso acontecer. Uma ferramenta que declara uma capacidade de rede só pode buscar dos hosts que seu manifesto permite, e esse mecanismo é fail-closed; nenhuma ferramenta atualmente publicada declara uma, então a Content-Security-Policy imposta pelo navegador é a fronteira que de fato mantém a lista acima restrita aos seus hosts. A [política de privacidade](/info/privacy.html) mantém a tabela canônica de tudo isso; sua regra permanente é que um contato de rede fora dessa tabela não acontece.

**2. Desligue o cabo.** Carregue o app e abra uma ou duas ferramentas, depois fique offline - modo avião, ou DevTools → Network → Offline. Recarregue. A galeria e cada ferramenta que você abriu continuam funcionando, incluindo renderização e exportação nos formatos que você usou - os arquivos de uma ferramenta e o codificador de um formato são armazenados em cache na primeira vez que você os usa, então use uma ferramenta uma vez online antes de testá-la offline. Essa é a verificação mais forte desta página: software que liga para casa não sobrevive ao corte do cabo.

**3. Conte os cookies.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. A lista está vazia - o app não define nenhum cookie. Ou cole `document.cookie` no console: você obtém `""`. (O único cookie em todo o sistema, `lolly_ca_state`, dura no máximo dez minutos durante um login de identidade opcional - excluído no momento em que o login é concluído - é restrito a `/api/ca` e é `HttpOnly`: a [política de privacidade](/info/privacy.html) o descreve com precisão.)

**4. Leia seu próprio armazenamento.** No mesmo painel Application: tudo o que o Lolly mantém é inspecionável diante de você - algumas dezenas de chaves simples de `localStorage` (tema, idioma, largura da barra lateral, configurações de som e visualização, além de uma cópia em cache do índice público do catálogo de ferramentas), e seus próprios documentos no IndexedDB. Cada valor é uma string legível ou JSON - nada é ofuscado, nada é codificado para dificultar a leitura. **Profile → Clear all my data** apaga tudo isso; assim como limpar os dados do site no navegador, porque não há cópia no servidor para sobreviver a isso.

**5. Verifique se o contato de divulgação existe.** [`/.well-known/security.txt`](/.well-known/security.txt) responde com um bloco de contato [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), não uma página HTML.

## Em um terminal

**6. O endpoint de renderização responde apenas com dados públicos.** O único recurso do servidor que coloca entradas digitadas pelo usuário em uma URL - renderizações por hot-link - está ativo aqui, e a [política de privacidade](/info/privacy.html) explica o que isso significa para as entradas que você coloca em um link:

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

A opção é por implantação (`LOLLY_DISABLE_RENDER_GET=1`): em uma instância que a define, a mesma sondagem retorna `404` - essa diferença é a flag funcionando, não uma inconsistência.

**7. A superfície do servidor é enumerável.** [Server Surface](/info/server-surface.html) lista cada rota do lado do servidor que existe, com a regra permanente de que um endpoint fora dessa página não faz parte do Lolly. Faça `curl` nelas; não há mais nada a encontrar.

## No código-fonte

Tudo acima ainda poderia ser encenação se o código implantado fosse diferente do código público. Então verifique o código - a implantação é construída a partir do [repositório público](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Nenhum rastreador, nenhum SDK de analytics, em lugar nenhum.** Pesquise o código que é publicado - o engine, cada shell (incluindo a extensão do navegador, os overrides da bridge do Tauri e o service worker), as funções do servidor e os pacotes de ferramentas - pelos suspeitos de sempre:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

**9. Nenhum resolvedor DNS de terceiros.** A verificação SEAL do Verify nunca roteia buscas através de um provedor DNS-over-HTTPS - o app web simplesmente não tem resolvedor:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. O serviço de certificados não retém nada.** A CA de identidade não tem log de emissão - nem seu e-mail, nem um timestamp, nem um webhook. A ausência é verificável com grep:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

## Imposto por testes, não por promessas

As três verificações de código-fonte acima não são uma auditoria única - elas estão fixadas na suíte de testes, então não podem apodrecer silenciosamente. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) falha a build se:

- qualquer SDK de analytics ou rastreamento aparecer em qualquer lugar do código-fonte publicado que ele varre - app, engine, servidor, extensão e código de pacotes de ferramentas igualmente,
- qualquer resolvedor DNS-over-HTTPS de terceiros aparecer nesse código-fonte,
- o log de emissão da CA reaparecer - no código-fonte **ou** no bundle de servidor gerado,
- a política de privacidade perder suas declarações legalmente exigidas (controlador nomeado, base legal, direito de reclamação).

Execute-os você mesmo no clone (Node 22.18+; não é necessário `pnpm install` para este arquivo):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

O conjunto completo (`pnpm install && pnpm test`) executa mais alguns milhares, incluindo os testes adversariais de criptografia descritos em [Segurança e Verificação](/info/security.html).

## O que você não consegue verificar de fora - dito claramente

Uma página como esta conquista confiança nomeando seus próprios limites:

- **Logs de acesso da hospedagem.** Qualquer servidor que responde a uma requisição pode registrar a requisição - IP, caminho, timestamp. Você não pode verificar o que um host retém ou não, e nós também não, além do comportamento documentado do nosso provedor. É exatamente por isso que a arquitetura mantém seu conteúdo totalmente fora da rede: o que nunca sai do seu dispositivo não pode ser registrado por ninguém.
- **Que a implantação executa este código.** Você pode verificar que o código-fonte está limpo e que o comportamento implantado corresponde a ele (as verificações acima cobrem ambas as pontas), mas atestação em nível binário de uma implantação web não é algo que a plataforma web oferece. As mitigações são o repositório público, os testes impostos e a verificação offline - uma implantação adulterada que liga para casa falha imediatamente nas verificações 1 e 2.
- **Os hooks de ferramentas não são isolados (sandboxed) por padrão.** A lógica opcional de uma ferramenta é executada revisada, no próprio realm da página; toda ferramenta em lolly.tools é first-party e revisada antes de ser publicada. O isolamento por Worker agora é oferecido como opt-in por ferramenta - uma ferramenta cujo manifesto define `isolate: true` executa seus hooks fora da thread principal - então o que você não consegue verificar de fora está diminuindo, mas o caminho padrão ainda é no mesmo realm e a revisão ainda é o controle. Isso é declarado, não ocultado - veja a seção de [limites de design](/info/security.html), que sempre disse isso.

## Se uma verificação falhar

Uma discrepância entre esta página e o comportamento observado é um relatório de segurança, e realmente preferimos ouvir sobre isso do que não: [fitzy+security@suse.com](mailto:fitzy+security@suse.com), o botão **Report a vulnerability** em qualquer [repositório lolly-tools](https://github.com/lolly-tools) ou o contato em [`/.well-known/security.txt`](/.well-known/security.txt). Divulgação coordenada e crédito ao relator são a política permanente - [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md) tem os detalhes.
