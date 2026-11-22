# 직접 검증하기

이 사이트의 모든 약속은 계정 없이 확인할 수 있어요. 대부분의 확인에는 브라우저만 필요하고, 나머지에는 터미널과 소스 사본이 필요해요. 아래 확인에서 표시된 결과가 나오지 않으면 버그이거나 약속이 지켜지지 않은 것이므로 알려 주세요. [확인이 실패하면](#if-a-check-fails)을 참고하세요.

이 확인은 Lolly 단독 사용을 다뤄요. 조직에서 Lolly Work를 운영하면 로그인, 공유 콘텐츠, 구성된 텔레메트리, 감사 기록이 추가돼요. [서버 인터페이스](/info/server-surface.html)와 [개인정보 처리방침의 조직 섹션](/info/privacy.html#organisation-services-with-lolly-work)에 비추어 확인하세요.

<!--i:eti-clock-->
## 10초 만에 작동 확인하기

[`/verify`](/#/verify)를 열고 페이지에 파일을 끌어다 놓으세요. 업로드도 계정도 없고 서버를 기다릴 필요도 없어요. 여기서는 AI에 대한 우리의 입장에 나오는 [생성된 퀸즐랜드 폭풍 이미지](/info/ai-stance.html)를 확인해요. Gemini가 생성한 이미지를 Lolly가 열고 표시를 붙이고 변환했어요. 모든 배지는 파일 자체의 바이트로 기기에서 계산됐어요.

![휴대폰 너비 화면의 Lolly Verify. 폭풍 이미지 아래로 초록색 Made with Lolly 판정과 자격 증명 유지, 바이트 변경 없음 배지가 쌓여 있어요](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

판정은 몇 개의 배지로 표시되며 각각 독립적인 사실을 나타내요.

- <!--i:lock--> **Made with Lolly**: 자격 증명이 온전하게 유지돼요. *그리고* Lolly 내보내기를 기록하고 있어요.
- <!--i:seal--> **The credential is intact**: 서명된 C2PA 매니페스트가 파싱되며 자체 클레임 서명이 검증돼요.
- <!--i:hash--> **The bytes have not changed**: 파일 해시가 여전히 서명 당시와 일치해요. 픽셀 하나만 바꿔도 이 배지가 바뀌어요.
- <!--i:sparkle--> **GEN AI**: 기계가 이 픽셀을 만들었으며 파일이 그 사실을 밝히고 있어요. Lolly는 그 사실을 숨기지 않고 선언을 읽어 보여줘요.

전체 기록은 파일과 함께 옮겨져요. 여기에는 아홉 단계가 남아 있어요. Google이 이미지를 생성하고 워터마크를 넣으며 기록한 다섯 단계, 그다음 Lolly가 이 페이지의 사본을 열고 표시를 붙이고 변환하며 기록한 네 단계예요. Lolly Verify는 바이트에서 직접 이 기록을 읽어 타임라인으로 그려요.

![Lolly Verify가 폭풍 이미지에서 읽어 낸 변경 기록. Google이 기록한 다섯 단계와 그다음 Lolly의 네 단계가 이 페이지의 WebP로 끝나요](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

아래 확인은 그 시연을 뒷받침하는 보장이며, 하나하나 재현할 수 있어요. [Content Credentials](/info/content-credentials-identity.html)에서 모든 판정을 설명해요.

<!--i:eti-globe-->
## 별도 도구 없이 브라우저에서

::: timeline
- <!--i:globe--> **1. 네트워크를 살펴보세요.** [lolly.tools](https://lolly.tools)를 열고, 브라우저의 DevTools(F12)를 열어 **Network**로 전환한 뒤 도구를 사용해 보세요. [Lolly QR Code](/t/qr-code)에 웹 주소를 입력하고, 색상을 바꾸고, PNG를 내보내세요. 모든 요청은 `lolly.tools`로 가요. 앱 셸, 도구 자체의 파일, 카탈로그 에셋이에요. 분석 호스트도, CDN 비컨도, 글꼴 서비스도, 오류 보고 엔드포인트도 없어요. 렌더링이 로컬에서 이뤄지므로 도구에 입력한 것은 **어떤 요청에도 나타나지 않아요**.
- <!--i:eyeoff--> **2. 연결을 끊으세요.** 앱을 불러오고 도구 한두 개를 연 뒤, 오프라인으로 전환하고(비행기 모드 또는 DevTools → Network → Offline) 새로고침하세요. 갤러리와 열었던 모든 도구는 사용했던 형식의 렌더링과 내보내기를 포함해 계속 작동해요. 도구 파일과 형식 인코더는 처음 사용할 때 캐시되므로, 오프라인에서 테스트하기 전에 온라인에서 도구를 한 번 사용하세요. 이는 이 페이지에서 가장 강력한 단일 확인이에요. 외부 서버에 의존하는 소프트웨어는 연결이 끊기면 작동을 이어갈 수 없어요.
- <!--i:check--> **3. 쿠키를 세어 보세요.** DevTools → **Application**(Firefox: **Storage**) → Cookies → `https://lolly.tools`. 목록은 비어 있어요. 앱은 쿠키를 설정하지 않아요. 콘솔에 `document.cookie`를 붙여넣으면 `""`가 나와요. 선택적인 CA 등록은 단기 `HttpOnly` 쿠키 `lolly_ca_state`를 설정해요. 이 쿠키의 범위는 `/api/ca`로 한정되며, `document.cookie`로 볼 수 없어요. Lolly Work 인스턴스는 자체 로그인 쿠키를 사용해요. [개인정보 보호](/info/privacy.html#organisation-services-with-lolly-work)와 비교하세요.
- <!--i:layers--> **4. 자신의 저장소를 읽어 보세요.** 같은 패널에 Lolly가 보관하는 모든 것이 있어요. 20여 개의 일반 `localStorage` 키(테마, 언어, 사이드바 너비, 소리와 보기 설정, 공개 도구 카탈로그 인덱스의 캐시 사본)와 IndexedDB의 사용자 문서예요. 모든 값은 읽을 수 있는 문자열이나 JSON이며 난독화된 것은 없어요. 사이트 데이터를 지우면 이 로컬 레코드가 삭제되지만 Sync 백업이나 Lolly Work 인스턴스가 저장한 레코드는 삭제되지 않아요. 앱 안의 **Settings → Storage → Clear all my data**도 같은 일을 하며, 저장소와 캐시가 비워지는 것을 볼 수 있어요.
- <!--i:lock--> **5. 취약점 공개 연락처가 있는지 확인하세요.** [`/.well-known/security.txt`](/.well-known/security.txt)는 HTML 페이지가 아니라 [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116) 연락처 블록으로 응답해요.
:::

::: details Network 탭에 그 밖에 나타날 수 있는 것
일부 기능은 사용할 때만 네트워크에 접속하며, 각각 같은 탭에서 볼 수 있어요.

- Lolly Design System Setup에서 **Google Font**를 추가하면, 처음 가져오기 전에 한 번 표시되는 동의 대화상자로 이를 알린 뒤 Google에서 그 글꼴 모음 하나를 가져와요.
- **ICC 인쇄 프로필 프리셋**을 클릭하면 color.org의 ICC 공개 레지스트리에서 그 프로필을 가져와요.
- 선택적인 내장 **라디오**를 재생하면 방송국에서 스트리밍해요.
- **Meeting Planner**에 위치를 입력하면 open-meteo의 지오코딩 서비스에서 좌표와 시간대를 도시마다 한 번 조회해요(응답은 기기에 저장돼요). 입력하는 필드에 이 사실이 표시돼요.
- **Lolly URL Screenshot**은 입력한 주소를 불러오며 그 과정을 볼 수 있어요.

네트워크 기능을 선언한 도구는 매니페스트의 허용 목록에 있는 호스트에서만 가져올 수 있고, 이 확인은 실패하면 차단해요. 현재 배포된 도구 중 이를 선언한 것은 없으므로 브라우저가 강제하는 Content-Security-Policy가 위 목록을 해당 호스트로 제한해요. [개인정보 처리방침](/info/privacy.html)에 정책 갱신과 활성화된 보고 같은 관리형 인스턴스의 트래픽을 포함해 이 모든 것의 공식 표가 있어요.
:::

<!--i:eti-code-->
## 터미널에서

**6. 렌더 엔드포인트는 공개 데이터로만 응답해요.** 입력한 값을 URL에 넣는 유일한 서버 기능인 핫링크 렌더링이 여기서 운영되고 있어요. [개인정보 처리방침](/info/privacy.html)에서 링크에 넣는 입력값에 이것이 무엇을 의미하는지 설명해요.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

각 배포에서 선택해요(`LOLLY_DISABLE_RENDER_GET=1`). 이 변수를 설정한 인스턴스에서는 같은 탐색 요청이 `404`를 반환해요. 이 차이는 설정이 작동한다는 뜻이며 불일치가 아니에요.

**7. 배포에서 활성화한 서비스를 확인하세요.** [서버 인터페이스](/info/server-surface.html)는 선택적 서비스를 나열하고 자세한 참고 자료를 연결해요. Lolly Work라면 인증된 API, 협업 연결, 저장소, 구성된 제공업체를 포함하세요. 공개 lolly.tools를 탐색해도 비공개 조직 인스턴스를 테스트하는 것은 아니에요.

자체 인스턴스를 운영한다면 [전달 배포](/info/deploy-delivery.html)에 릴리스 확인 항목이 있어요. 모델 무결성, 에지 탐색과 샘플 목록, 표시용 렌디션, 비공개 다운로드 게이트웨이, 브라우저에서의 서명된 카탈로그예요.


<!--i:eti-search-->
## 소스에서

배포된 코드가 공개 코드와 다르다면 위의 모든 것이 보여주기일 수 있어요. 그러니 코드를 확인하세요. 배포는 [공개 저장소](https://github.com/lolly-tools/lolly)에서 빌드해요.

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. 어디에도 추적기나 분석 SDK가 없어요.** 배포되는 코드(엔진, 브라우저 확장 프로그램을 포함한 모든 셸, Tauri 브리지 재정의와 서비스 워커, 서버 함수, 도구 팩)에서 흔히 쓰이는 추적 도구를 검색하세요.

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

이 스캔은 제삼자 추적 SDK를 찾아요. 자체 사용 보고가 없다는 것을 보여주지는 않아요. Lolly Work는 자체 정책과 테스트를 갖춘 조직 텔레메트리와 별도의 감사 로그를 지원해요.

**9. 제삼자 DNS 리졸버가 없어요.** Lolly Verify의 SEAL 확인은 DNS-over-HTTPS 제공업체를 통해 조회하지 않아요. 앱에 리졸버가 없기 때문이에요.

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. 인증서 서비스는 발급 로그를 보관하지 않아요.** 신원 CA는 발급한 내역이나 신원 목록을 보관하지 않아요. stdout 출력 줄도, 웹훅도, 인증서 저장소도 없어요. 검색해서 없음을 확인할 수 있어요.

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

CA는 단기 작업 상태는 보관해요. 요청 제한 버킷은 해당 시간 구간 동안 해시된 IP와 이메일 키를 저장하며, 관리형 배포의 허용 저장소는 키를 사용한 식별자와 요청 다이제스트를 최대 10분 동안 보관해요. [Content Credentials 엔지니어링](/info/content-credentials-engineering.html#protocol)에 자세한 내용이 있어요.

<!--i:eti-flask-->
## 테스트로 강제해요

위의 소스 확인은 일회성 감사가 아니에요. 테스트 모음에 고정돼 있어서 모르는 사이에 무력해질 수 없어요. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts)는 위 스캔보다 더 긴 추적기 이름 목록을 확인하며 다음 경우 빌드를 실패시켜요.

- 앱, 엔진, 서버, 확장 프로그램, 도구 팩 코드에 걸쳐 스캔하는 배포 소스 어디에든 분석 또는 추적 SDK가 나타나는 경우
- 그 소스에 제삼자 DNS-over-HTTPS 리졸버가 나타나는 경우
- 소스 **또는** 생성된 서버 번들에 CA 발급 로그가 다시 나타나는 경우
- 개인정보 처리방침에서 법적으로 필요한 명시 사항(이름이 명시된 개인정보처리자, 법적 근거, 불만을 제기할 권리)이 빠지는 경우

복제한 저장소에서 직접 실행하세요(Node 22.18 이상, 이 파일에는 `pnpm install`이 필요하지 않아요).

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

전체 테스트 모음(`pnpm install && pnpm test`)은 [보안 & 검증](/info/security.html)에서 설명하는 적대적 암호화 테스트를 포함해 수천 개를 더 실행해요.

<!--i:eti-eye-off-->
## 외부에서 검증할 수 없는 것

- **호스팅 접근 로그.** 어떤 서버든 응답한 요청의 IP 주소, 경로, 시간을 기록할 수 있어요. 외부 탐색으로는 로그를 얼마나 오래 보관하는지 확인할 수 없어요. 운영자가 로깅, 순환, 내보내기를 제어하며 그 선택을 공개해야 해요. 로컬 렌더링은 일반 편집을 기기에 유지해요. 선택적 서버 렌더링과 공유 작업 공간 서비스에는 개인정보 처리방침에서 설명하는 별도의 데이터 흐름이 있어요.
- **배포에서 이 코드를 실행하는지.** 소스에 문제가 없는지, 배포된 동작이 소스와 일치하는지 확인할 수 있으며 위의 확인은 둘 다 해요. 웹 플랫폼은 웹 배포의 바이너리 수준 증명을 제공하지 않아요. 이를 완화하는 것은 공개 저장소, 강제되는 테스트, 오프라인 확인이에요. 변조돼 외부 서버와 통신하는 배포는 확인 1과 2에서 곧바로 실패해요.
- **도구 훅.** 내장 도구의 선택적 로직은 샌드박스에 격리하는 대신 검토해요. 도구가 Worker 사용을 선택하지 않으면 페이지에서 실행돼요. lolly.tools의 모든 도구는 자체 제작되며 배포 전에 검토해요. [위협 모델](/info/threat-model.html#trust-boundaries)에서 훅이 어디서 실행되고 무엇이 제한하는지 설명해요.

<!--i:eti-warning-->
## 확인이 실패하면

이 페이지와 관찰한 내용이 다르다면 보안 신고 대상이에요. [보안 & 검증](/info/security.html#reporting-a-vulnerability)의 비공개 채널로 보내 주세요. 우리는 조율된 취약점 공개를 실천하며 신고자의 기여를 밝혀요.
