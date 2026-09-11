# 직접 검증하기

Lolly의 개인정보 보호 및 보안 페이지는 여러 가지를 주장합니다: 분석 없음, 추적 없음, 파일이 기기를 벗어나지 않음, 전체 시스템에 쿠키 하나뿐. 이 페이지는 다릅니다: 그중 무엇도 믿어달라고 요구하지 않습니다. 정확한 명령어나 클릭 경로, 그리고 눈으로 확인하게 될 결과가 담긴 절차 목록입니다. 여기 있는 모든 주장은 몇 분 안에, 대부분 아무것도 설치하지 않고도 반증 가능합니다.

이 페이지의 어떤 확인이든 표시된 결과가 나오지 않는다면, 그것은 버그이거나 지켜지지 않은 약속입니다. 어느 쪽이든 [신고해 주세요](#if-a-check-fails). 지켜지지 않은 약속에 걸맞은 심각도로 다루겠습니다.

## 10초 만에 직접 확인하기

절차를 다루기 전에 결과부터 보여드립니다. [`/verify`](/#/verify)를 열고 파일을 끌어다 놓아 보세요 - 업로드도, 계정도, 서버 대기도 없습니다. 여기서는 AI 입장 페이지에 있는 [생성된 퀸즐랜드 폭풍](/info/ai-stance.html) 이미지를 확인하고 있습니다: Lolly가 열고, 크기를 조정하고, 내보낸 Gemini 이미지입니다. 아래의 배지는 모두 파일 자체의 바이트로부터 기기에서 계산된 것입니다.

![휴대폰 너비 화면에서의 Verify - 폭풍 이미지, 초록색 Made with Lolly 판정, 그리고 그 아래 쌓인 자격 증명 무결·바이트 불변 배지](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

판정은 하나의 배지가 아니라 각각 독립적인 사실을 나타내는 작은 배지 더미입니다:

- <!--i:lock--> **Made with Lolly** - 자격 증명이 온전하고, *동시에* Lolly에서 내보냈다는 기록이 있습니다.
- <!--i:seal--> **자격 증명이 온전합니다** - 서명된 C2PA 매니페스트가 파싱되고 그 자체의 클레임 서명이 검증됩니다.
- <!--i:hash--> **바이트가 변경되지 않았습니다** - 파일의 해시가 서명 당시와 여전히 일치합니다. 픽셀 하나만 바꿔도 이 배지는 뒤집힙니다.
- <!--i:sparkle--> **GEN AI** - 기계가 이 픽셀들을 만들었고, 파일이 그렇게 밝히고 있습니다. Lolly는 그 주장을 숨기지 않고 그대로 읽어 보여줍니다.

그리고 전체 이력이 파일과 함께 이동합니다. 여기에는 아홉 단계가 남아 있습니다 - Google이 이미지를 생성하고 워터마크를 넣으며 기록한 다섯 단계, 그리고 Lolly가 이 페이지의 사본을 열고 표시하고 변환하며 기록한 네 단계 - 이는 사용자 기기에서 바이트로부터 곧바로 읽혀 타임라인으로 표시됩니다. 이는 [AI 입장 페이지](/info/ai-stance.html)의 C2PA 타임라인과 동일한 방식으로 검증된, 동일한 이미지입니다.

![Verify가 폭풍 이미지에서 그대로 읽어낸 변경 이력 - Google이 기록한 다섯 단계, 그다음 Lolly가 기록한 네 단계, 이 페이지의 WebP로 끝남](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

하지만 그건 신뢰 주장이 아니에요 - 그건 데모예요. 이 페이지의 나머지 부분이 신뢰 주장이에요: 위의 모든 배지는 재현 가능하고, 그 이면의 보증을 재현하는 방법은 다음과 같아요.

## 브라우저에서, 별도 도구 없이

**1. 네트워크를 지켜보세요.** [lolly.tools](https://lolly.tools)를 열고, 브라우저의 개발자 도구(F12)를 연 다음 **네트워크** 탭으로 전환하고 도구를 사용해보세요 - [QR Code](/t/qr-code)에 URL을 입력하고, 색상을 바꾸고, PNG로 내보내보세요. 모든 요청은 `lolly.tools`에 머뭅니다: 앱 셸, 도구 자체 파일, 카탈로그 자산까지 모두요. 분석 호스트도, CDN 비콘도, 폰트 서비스도, "오류 보고" 엔드포인트도 없습니다. 도구에 입력한 내용은 **어떤 요청에도 전혀 나타나지 않습니다** - 렌더링은 로컬에서 이루어집니다.

정직한 예외들 - 모두 선택적이고, 사용자가 직접 시작하며, 발생하는 순간 같은 네트워크 탭에서 보입니다: 브랜드 편집기에서 **Google 폰트**를 추가하면 첫 요청 전에 정확히 그 사실을 알리는 동의 대화상자가 한 번 뜨고, 그 후 해당 글꼴 하나를 Google에서 가져옵니다; **ICC 인쇄 프로필 프리셋**을 클릭하면 color.org에 있는 ICC의 공개 레지스트리에서 해당 프로필을 가져옵니다; 선택적으로 내장된 **라디오**를 재생하면 해당 방송국에서 스트리밍합니다; **Meeting Planner**에 위치를 입력하면 도시당 한 번 open-meteo의 지오코딩 서비스에서 좌표와 시간대를 조회하며(응답은 기기에 저장됩니다), 입력란 바로 옆에 그 사실이 안내되어 있습니다; 그리고 **URL Screenshot**은 필연적으로 입력한 URL을 불러옵니다 - 그것이 이 도구의 역할이며, 그 과정을 직접 지켜볼 수 있습니다. 네트워크 기능을 선언한 도구는 매니페스트가 허용 목록에 올린 호스트에서만 가져올 수 있으며, 이 메커니즘은 페일 클로즈드(fail-closed) 방식입니다; 현재 배포된 도구 중 이를 선언한 것은 없으므로, 위 목록을 실제로 해당 호스트에 묶어두는 경계는 브라우저가 강제하는 콘텐츠 보안 정책(Content-Security-Policy)입니다. [개인정보 처리방침](/info/privacy.html)에 이 모든 것의 정본 표가 있으며, 그 표에 없는 네트워크 접촉은 일어나지 않는다는 것이 원칙입니다.

**2. 플러그를 뽑아보세요.** 앱을 로드하고 도구를 한두 개 열어본 다음 오프라인으로 전환하세요 - 비행기 모드나, 개발자 도구 → 네트워크 → 오프라인. 새로고침하세요. 갤러리와 열어본 모든 도구는 계속 작동합니다. 사용해본 형식의 렌더링과 내보내기도 포함해서요 - 도구의 파일과 형식의 인코더는 처음 사용할 때 캐시되므로, 오프라인으로 테스트하기 전에 온라인 상태에서 도구를 한 번 사용해두세요. 이것이 이 페이지에서 가장 강력한 단일 검증입니다: 본가에 전화를 거는 소프트웨어는 선이 끊기면 살아남지 못합니다.

**3. 쿠키를 세어보세요.** 개발자 도구 → **Application**(Firefox: **Storage**) → Cookies → `https://lolly.tools`. 목록이 비어 있습니다 - 앱은 쿠키를 설정하지 않습니다. 또는 콘솔에 `document.cookie`를 입력해보세요: `""`가 반환됩니다. (전체 시스템에서 유일한 쿠키인 `lolly_ca_state`는 선택적 신원 로그인 중 최대 10분 동안만 존재하며 - 로그인이 완료되는 순간 삭제됩니다 - `/api/ca`로 범위가 한정되고 `HttpOnly`입니다: [개인정보 처리방침](/info/privacy.html)에 정확히 설명되어 있습니다.)

**4. 자신의 저장소를 직접 읽어보세요.** 같은 Application 패널에서: Lolly가 보관하는 모든 것을 눈앞에서 확인할 수 있습니다 - 평문 `localStorage` 키 20여 개(테마, 언어, 사이드바 너비, 소리 및 보기 설정, 그리고 공개 도구 카탈로그 인덱스의 캐시 사본)와 IndexedDB에 있는 자신의 문서들입니다. 모든 값은 읽을 수 있는 문자열이나 JSON입니다 - 난독화된 것도, 읽지 못하게 인코딩된 것도 없습니다. **Profile → Clear all my data**를 실행하면 지워집니다; 브라우저에서 사이트 데이터를 지워도 마찬가지입니다. 살아남을 서버 측 사본이 없기 때문입니다.

**5. 신고 연락처가 존재하는지 확인하세요.** [`/.well-known/security.txt`](/.well-known/security.txt)는 HTML 페이지가 아니라 [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116) 연락처 블록으로 응답합니다.

## 터미널에서

**6. 렌더링 엔드포인트는 공개 데이터로만 응답합니다.** 사용자가 입력한 값을 URL에 담는 유일한 서버 기능인 핫링크 렌더링은 여기서 라이브로 운영되고 있으며, 링크에 입력한 값이 어떻게 다뤄지는지는 [개인정보 처리방침](/info/privacy.html)에 설명되어 있습니다:

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

이 스위치는 배포별로 설정됩니다(`LOLLY_DISABLE_RENDER_GET=1`): 이를 설정한 인스턴스에서는 같은 검사를 해도 `404`가 반환됩니다 - 이 차이는 불일치가 아니라 플래그가 제대로 작동하고 있다는 증거입니다.

**7. 서버 표면은 모두 나열되어 있습니다.** [Server Surface](/info/server-surface.html)는 존재하는 모든 서버 측 라우트를 나열하며, 그 페이지에 없는 엔드포인트는 Lolly의 일부가 아니라는 원칙을 따릅니다. `curl`로 확인해보세요; 그 외에는 아무것도 없습니다.

## 소스 코드에서

위의 모든 것도 배포된 코드가 공개 코드와 다르다면 여전히 연출에 불과할 수 있습니다. 그러니 코드를 직접 확인해보세요 - 이 배포는 [공개 저장소](https://github.com/lolly-tools/lolly)로부터 빌드됩니다:

```bash
git clone --recurse-submodules https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. 어디에도 트래커나 분석 SDK가 없습니다.** 배포되는 코드 전체를 - 엔진, 모든 셸(브라우저 확장, Tauri 브리지 오버라이드, 서비스 워커 포함), 서버 함수, 도구 팩까지 - 흔한 용의자들을 대상으로 검색해보세요:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

**9. 제3자 DNS 리졸버가 없습니다.** Verify의 SEAL 검사는 조회를 DNS-over-HTTPS 제공업체를 통해 라우팅하지 않습니다 - 웹 앱에는 애초에 리졸버가 없습니다:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. 인증서 서비스는 아무것도 보관하지 않습니다.** 신원 CA에는 발급 로그가 없습니다 - 이메일도, 타임스탬프도, 웹훅도 없습니다. 이 부재는 grep으로 확인할 수 있습니다:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

## 약속이 아니라 테스트로 강제됩니다

위의 세 가지 소스 검사는 일회성 감사가 아닙니다 - 테스트 스위트에 고정되어 있어 조용히 낡아버릴 수 없습니다. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts)는 다음의 경우 빌드를 실패시킵니다:

- 스캔 대상인 배포 소스 어디든 - 앱, 엔진, 서버, 확장, 도구 팩 코드 모두 - 분석이나 트래킹 SDK가 나타나는 경우,
- 그 소스에 제3자 DNS-over-HTTPS 리졸버가 나타나는 경우,
- CA 발급 로그가 다시 나타나는 경우 - 소스에서든 **또는** 생성된 서버 번들에서든,
- 개인정보 처리방침이 법적으로 요구되는 진술(지정된 관리자, 법적 근거, 이의제기 권리)을 잃는 경우.

클론에서 직접 실행해보세요(Node 22.18+; 이 파일에는 `npm install`이 필요하지 않습니다):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

전체 스위트(`npm install && npm test`)는 [보안 및 검증](/info/security.html)에 설명된 적대적 암호화 테스트를 포함해 수천 개를 더 실행합니다.

## 외부에서 검증할 수 없는 것 - 솔직하게 말하자면

이런 페이지는 자신의 한계를 명시함으로써 신뢰를 얻습니다:

- **호스팅 접근 로그.** 요청에 응답하는 서버는 그 요청을 기록할 수 있습니다 - IP, 경로, 타임스탬프. 호스트가 무엇을 보관하고 보관하지 않는지는 여러분도, 저희도 제공업체가 문서화한 동작 이상으로는 검증할 수 없습니다. 바로 그렇기 때문에 이 아키텍처는 여러분의 콘텐츠를 아예 전선(wire) 밖에 둡니다: 기기를 떠난 적이 없는 것은 누구도 기록할 수 없습니다.
- **배포본이 정말 이 코드를 실행하는가.** 소스가 깨끗한지, 배포된 동작이 소스와 일치하는지는 검증할 수 있지만(위의 검사들이 양쪽 끝을 모두 확인합니다), 웹 배포의 바이너리 수준 증명은 웹 플랫폼이 제공하는 기능이 아닙니다. 그 완화책은 공개 저장소, 강제된 테스트, 그리고 오프라인 검사입니다 - 본가에 전화를 거는 변조된 배포는 검사 1과 2에서 즉시 걸립니다.
- **도구 훅은 기본적으로 샌드박스화되어 있지 않습니다.** 도구의 선택적 로직은 검토를 거쳐 페이지 자체의 렌더링 영역(realm) 안에서 실행됩니다; lolly.tools의 모든 도구는 자체 제작이며 배포 전에 검토를 거칩니다. 이제 워커 격리가 도구별 옵트인으로 제공됩니다 - 매니페스트에서 `isolate: true`를 설정한 도구는 대신 훅을 별도 스레드에서 실행합니다 - 그래서 외부에서 검증할 수 없는 범위는 줄어들고 있지만, 기본 경로는 여전히 같은 영역 안에 있고 검토가 여전히 통제 수단입니다. 이것은 숨긴 것이 아니라 명시된 사실입니다 - 항상 그렇게 말해온 [설계 경계](/info/security.html) 섹션을 참고하세요.

## 검사가 실패한다면

이 페이지와 관찰된 동작 사이의 불일치는 보안 신고 대상이며, 저희는 진심으로 그 소식을 듣고 싶습니다: [fitzy+security@suse.com](mailto:fitzy+security@suse.com), 어떤 [lolly-tools 저장소](https://github.com/lolly-tools)에서든 **Report a vulnerability** 버튼, 또는 [`/.well-known/security.txt`](/.well-known/security.txt)에 있는 연락처로요. 조율된 공개와 신고자 크레딧이 기본 방침입니다 - 자세한 내용은 [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md)에 있습니다.
