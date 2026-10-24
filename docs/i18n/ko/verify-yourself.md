# 직접 검증하기

이 사이트의 모든 약속은 계정 없이 확인할 수 있어요. 대부분의 확인은 브라우저만 있으면 되고, 나머지는 터미널과 소스 사본이 필요해요. 아래 확인이 보여준 결과와 다른 결과를 낸다면 버그이거나 깨진 약속이므로 알려주세요. [확인이 실패하면](#if-a-check-fails)을 참고하세요.

가장 빠른 것으로 시작하세요. Verify에 파일을 놓으세요. 그다음 더 나아가세요. 도구를 쓰는 동안 네트워크를 지켜보고, 연결을 끊고도 계속 작업하고, 쿠키를 세고, 소스를 읽어 보세요.

이 확인은 Lolly 단독의 경우를 다뤄요. 조직이 Lolly Work를 운영한다면 로그인, 공유 콘텐츠, 구성된 원격 측정, 감사 기록이 추가되니, 이는 [서버 영역](/info/server-surface.html)과 [개인정보 처리방침의 조직 섹션](/info/privacy.html#organisation-services-with-lolly-work)과 대조해 확인하세요.

## 10초 만에 직접 확인하기

[`/verify`](/#/verify)를 열고 페이지에 파일을 놓으세요. 업로드도 계정도 서버 대기도 없어요. 여기서는 Our AI Stance의 [생성된 퀸즐랜드 폭풍](/info/ai-stance.html)을 확인해요. Gemini가 생성한 이미지를 Lolly가 열고, 표시하고, 변환한 것이에요. 모든 배지는 파일 자체의 바이트를 바탕으로 기기에서 계산됐어요.

![휴대폰 너비 화면에서의 Verify - 폭풍 이미지, 초록색 Made with Lolly 판정, 그리고 그 아래 쌓인 자격 증명 무결·바이트 불변 배지](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

판정은 각각 독립적인 사실인 작은 배지 모음이에요.

- <!--i:lock--> **Made with Lolly**: 자격 증명이 온전하고 *또한* Lolly 내보내기를 기록하고 있어요.
- <!--i:seal--> **The credential is intact**: 서명된 C2PA 매니페스트가 구문 분석되고 자체 클레임 서명이 검증돼요.
- <!--i:hash--> **The bytes have not changed**: 파일의 해시가 서명된 것과 여전히 일치해요. 픽셀 하나만 바꿔도 이 배지가 뒤집혀요.
- <!--i:sparkle--> **GEN AI**: 기계가 이 픽셀을 만들었고 파일이 그렇다고 밝혀요. Lolly는 사실을 숨기지 않고 그 선언을 다시 읽어내요.

전체 이력이 파일과 함께 이동해요. 여기서는 아홉 단계가 남아 있어요. Google이 이미지를 생성하고 워터마크를 넣으면서 기록한 다섯 단계, 그리고 Lolly가 이 페이지의 사본을 열고, 표시하고, 변환하면서 기록한 네 단계예요. Verify는 이를 바이트에서 곧바로 읽어 타임라인으로 그려요.

![Verify가 폭풍 이미지에서 그대로 읽어낸 변경 이력 - Google이 기록한 다섯 단계, 그다음 Lolly가 기록한 네 단계, 이 페이지의 WebP로 끝남](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

이것이 데모예요. 아래 확인은 그 아래에 있는 보증이며, 각각 재현할 수 있어요. [Content Credentials](/info/content-credentials-identity.html)가 모든 판정을 설명해요.

## 브라우저에서, 별도 도구 없이

::: timeline
- <!--i:globe--> **1. 네트워크를 지켜보세요.** [lolly.tools](https://lolly.tools)를 열고, 브라우저의 DevTools(F12)를 열어 **Network**로 전환한 다음 도구를 사용하세요. [QR Code](/t/qr-code)에 웹 주소를 입력하고, 색상을 바꾸고, PNG를 내보내세요. 모든 요청은 `lolly.tools`에 머물러요. 앱 셸, 도구 자체의 파일, 카탈로그 에셋이에요. 분석 호스트도, CDN 비콘도, 글꼴 서비스도, 오류 보고 엔드포인트도 없어요. 도구에 입력한 내용은 렌더링이 로컬이므로 **어떤 요청에도 나타나지 않아요**.
- <!--i:eyeoff--> **2. 연결을 끊어 보세요.** 앱을 불러오고 도구를 한두 개 연 다음, 오프라인으로 전환(비행기 모드, 또는 DevTools → Network → Offline)하고 새로고침하세요. 갤러리와 연 모든 도구가 사용한 형식의 렌더링과 내보내기를 포함해 계속 작동해요. 도구의 파일과 형식의 인코더는 처음 사용할 때 캐시되므로, 오프라인 테스트 전에 온라인에서 도구를 한 번 사용하세요. 이 페이지에서 가장 강력한 단일 확인이에요. 몰래 서버와 통신하는 소프트웨어는 연결이 끊기면 살아남지 못해요.
- <!--i:check--> **3. 쿠키를 세어 보세요.** DevTools → **Application**(Firefox는 **Storage**) → Cookies → `https://lolly.tools`. 목록이 비어 있어요. 앱은 쿠키를 설정하지 않아요. 콘솔에 `document.cookie`를 붙여넣으면 `""`가 나와요. 선택 사항인 CA 등록은 `/api/ca` 범위의 수명이 짧은 `HttpOnly` 쿠키 `lolly_ca_state`를 설정하며, `document.cookie`로는 보이지 않아요. Lolly Work 인스턴스는 자체 로그인 쿠키를 사용하니 [개인정보](/info/privacy.html#organisation-services-with-lolly-work)와 비교해 보세요.
- <!--i:layers--> **4. 자신의 저장소를 읽어 보세요.** 같은 패널에서 Lolly가 보관하는 모든 것이 눈앞에 있어요. 일반 `localStorage` 키 수십 개(테마, 언어, 사이드바 너비, 소리와 보기 설정, 공개 도구 카탈로그 색인의 캐시된 사본)와 IndexedDB의 자신의 문서예요. 모든 값은 읽을 수 있는 문자열이나 JSON이며 난독화된 것은 없어요. 사이트 데이터를 지우면 이 로컬 기록은 제거되지만 Sync 백업이나 Lolly Work 인스턴스가 보관한 기록은 제거되지 않아요. **Settings → Storage → Clear all my data**는 앱 안에서 같은 일을 하며, 저장소와 캐시가 비는 것을 볼 수 있어요.
- <!--i:lock--> **5. 공개 연락처가 있는지 확인하세요.** [`/.well-known/security.txt`](/.well-known/security.txt)는 HTML 페이지가 아니라 [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116) 연락처 블록으로 응답해요.
:::

::: details Network 탭에서 볼 수 있는 다른 것
일부 기능은 사용할 때만 네트워크에 닿으며, 각각 같은 탭에서 볼 수 있어요.

- Design System Setup에서 **Google Font**를 추가하면, 첫 요청 전에 한 번 그렇다고 알리는 동의 대화상자를 거친 후 그 패밀리 하나를 Google에서 가져와요.
- **ICC 인쇄 프로필 프리셋**을 클릭하면 color.org의 ICC 공개 레지스트리에서 그 프로필을 가져와요.
- 선택 사항인 내장 **라디오**를 재생하면 방송국에서 스트리밍해요.
- **Meeting Planner**에 위치를 입력하면 도시마다 한 번 open-meteo의 지오코딩 서비스에서 좌표와 시간대를 조회하며(응답은 기기에 저장돼요), 입력란이 입력하는 곳에서 그렇다고 알려줘요.
- **URL Screenshot**은 입력한 주소를 불러와요. 그것이 하는 일이고, 일어나는 일을 직접 볼 수 있어요.

네트워크 기능을 선언한 도구는 매니페스트가 허용 목록에 둔 호스트에서만 가져올 수 있고, 그 검사는 안전하게 실패해요. 현재 출시된 도구 중 이를 선언한 것은 없으므로, 위 목록을 해당 호스트로 제한하는 것은 브라우저가 강제하는 Content-Security-Policy예요. [개인정보 처리방침](/info/privacy.html)이 정책 갱신과 활성화된 보고 같은 관리형 인스턴스 트래픽을 포함해 이 모든 것의 표준 표를 보관해요.
:::

## 터미널에서

**6. 렌더 엔드포인트는 공개 데이터로만 응답해요.** 입력한 값을 URL에 넣는 유일한 서버 기능인 핫링크 렌더링이 여기서 작동해요. [개인정보 처리방침](/info/privacy.html)이 링크에 넣는 입력값에 대해 그것이 무엇을 뜻하는지 설명해요.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

각 배포가 선택해요(`LOLLY_DISABLE_RENDER_GET=1`). 이를 설정한 인스턴스에서는 같은 프로브가 `404`를 반환해요. 이 차이는 불일치가 아니라 설정이 작동하는 것이에요.

**7. 배포가 켠 서비스를 확인하세요.** [서버 영역](/info/server-surface.html)이 선택적 서비스를 나열하고 자세한 참조로 연결해요. Lolly Work는 인증된 API, 협업 연결, 저장소, 구성된 공급자를 포함하세요. 공개 lolly.tools를 프로브해도 비공개 조직 인스턴스는 테스트되지 않아요.

직접 인스턴스를 운영한다면 [전달 배포](/info/deploy-delivery.html)에 그것을 위한 릴리스 확인이 있어요. 모델 무결성, 엣지 프로브와 샘플 목록, 표시용 렌디션, 비공개 다운로드 게이트웨이, 브라우저의 서명된 카탈로그예요.


## 소스 코드에서

위의 모든 것은 배포된 코드가 공개 코드와 다르다면 여전히 연극일 수 있어요. 그래서 코드를 확인하세요. 배포는 [공개 저장소](https://github.com/lolly-tools/lolly)에서 빌드돼요.

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. 어디에도 트래커나 분석 SDK가 없어요.** 배포되는 코드(엔진, 브라우저 확장 프로그램을 포함한 모든 셸, Tauri 브리지 오버라이드, 서비스 워커, 서버 함수, 도구 팩)에서 흔한 용의자를 검색하세요.

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

이 스캔은 서드파티 추적 SDK를 찾아요. 자사 사용량 보고가 없음을 보여주지는 않아요. Lolly Work는 자체 정책과 테스트가 있는 조직 원격 측정과 별도의 감사 로그를 지원해요.

**9. 서드파티 DNS 리졸버가 없어요.** 앱에 리졸버가 없으므로 Verify의 SEAL 확인은 DNS-over-HTTPS 공급자를 통해 조회를 보내지 않아요.

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. 인증서 서비스는 발급 로그를 보관하지 않아요.** ID CA는 무엇을 발급했는지 로그를 보관하지 않고 신원 목록도 없어요. stdout 줄도, 웹훅도, 인증서 저장소도 없어요. 부재는 검색해서 확인할 수 있어요.

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

CA는 수명이 짧은 작업 상태를 보관해요. 속도 제한 버킷은 해당 기간 동안 해시된 IP와 이메일 키를 담고, 관리형 배포의 승인 저장소는 키 기반 식별자와 요청 다이제스트를 최대 10분간 보관해요. [Content Credentials 엔지니어링](/info/content-credentials-engineering.html#protocol)에 자세한 내용이 있어요.

## 테스트로 강제되는 것

위의 소스 확인은 일회성 감사가 아니에요. 테스트 모음에 고정되어 있어서 조용히 낡아질 수 없어요. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts)는 위 스캔보다 긴 트래커 이름 목록을 확인하며, 다음의 경우 빌드를 실패시켜요.

- 앱, 엔진, 서버, 확장 프로그램, 도구 팩 코드에 걸쳐 스캔하는 배포 소스 어디에든 분석 또는 추적 SDK가 나타나는 경우
- 서드파티 DNS-over-HTTPS 리졸버가 그 소스에 나타나는 경우
- CA 발급 로그가 소스 **또는** 생성된 서버 번들에 다시 생기는 경우
- 개인정보 처리방침이 법적으로 필요한 진술(명시된 컨트롤러, 법적 근거, 불만을 제기할 권리)을 잃는 경우

클론에서 직접 실행해 보세요(Node 22.18 이상. 이 파일에는 `pnpm install`이 필요 없어요).

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

전체 테스트 스위트(`pnpm install && pnpm test`)는 [Security & Verification](/info/security.html)에서 설명하는 적대적(adversarial) 암호화 테스트를 포함해 수천 건을 추가로 실행합니다.

## 외부에서 확인할 수 없는 것

- **호스팅 접근 로그.** 요청에 응답하는 모든 서버는 IP 주소, 경로, 시간을 기록할 수 있어요. 외부 프로브로는 로그가 얼마나 오래 보관되는지 알 수 없어요. 운영자가 로깅, 순환, 내보내기를 관리하며 그 선택을 공개해야 해요. 로컬 렌더링은 일반 편집을 기기에 두고, 선택적 서버 렌더링과 공유 워크스페이스 서비스에는 개인정보 처리방침이 설명하는 별도의 데이터 흐름이 있어요.
- **배포가 이 코드를 실행한다는 것.** 소스가 깨끗하고 배포된 동작이 그와 일치하는지 확인할 수 있으며, 위의 확인이 둘 다 해요. 웹 배포의 바이너리 수준 증명은 웹 플랫폼이 제공하는 것이 아니에요. 완화책은 공개 저장소, 강제되는 테스트, 오프라인 확인이에요. 몰래 서버와 통신하는 변조된 배포는 확인 1과 2를 동시에 통과하지 못해요.
- **도구 훅.** 내장 도구의 선택적 로직은 샌드박스가 아니라 검토를 거쳐요. 도구가 Worker를 선택하지 않는 한 페이지에서 실행돼요. lolly.tools의 모든 도구는 자사 제작이며 출시 전에 검토돼요. [위협 모델](/info/threat-model.html#trust-boundaries)이 훅이 실행되는 곳과 그 제한을 설명해요.

## 검사가 실패한다면

이 페이지와 관찰한 것의 차이는 보안 보고예요. [보안 및 검증](/info/security.html#reporting-a-vulnerability)의 비공개 채널로 보내주세요. 저희는 조율된 공개를 실천하고 보고자의 기여를 인정해요.
