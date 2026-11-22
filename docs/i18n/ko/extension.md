# 브라우저 확장 프로그램

웹페이지는 다른 웹사이트의 픽셀을 읽을 수 없어요. Chromium 기반 브라우저(Chrome 111부터의 Chrome, Edge, Brave, Arc, Opera)에서는 무료 **Lolly URL Screenshot** 확장 프로그램으로 Lolly 웹 앱이 데스크톱 앱과 같은 캡처 방식을 써서 페이지의 스크린샷을 찍을 수 있어요. 확장 프로그램을 설치하면 다음을 할 수 있어요.

- **[Lolly URL Screenshot](/t/url-shot)**은 구성한 페이지를 파일로 저장해요.
- 이미지 슬롯에 웹 주소를 붙여넣으면 **Screenshot this page**로 그 페이지의 스크린샷을 만들 수 있어요.
- [Lolly Design System Setup](/info/brand-studio.html)의 **Website** 소스는 페이지 하나를 읽어 디자인 시스템을 시작할 수 있어요.

모든 요청은 사용자가 승인하며, 데스크톱 앱은 확장 프로그램 없이 같은 작업을 해요.

<!--i:eti-checklist-->
## 설치하기 전에

확장 프로그램이 없어도 **Lolly URL Screenshot**은 열리고 캡처할 화면을 구성할 수 있어요. 도구 컨트롤 위쪽의 안내가 무엇이 빠져 있는지 알려줘요.

![파일로 캡처를 실행할 호스트가 없을 때 URL Screenshot 도구에 나타나는 확장 프로그램 안내](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

대상 URL, 스크롤 깊이, 안정화 대기 시간, 안쪽 자르기 여백, 색상 변경 등 모든 컨트롤은 확장 프로그램 없이 작동해요. 캡처에만 확장 프로그램이 필요해요.

![대상 URL, 스크롤 깊이, 안정화 대기 시간, 안쪽 자르기 여백이 있는 Lolly URL Screenshot 컨트롤. 확장 프로그램이 없어도 모두 사용할 수 있어요](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

<!--i:eti-download-->
## 설치

**Chrome Web Store에서 설치:** 곧 제공돼요. 게시되면 한 번의 클릭으로 확장 프로그램을 설치할 수 있어요.

**직접 불러오기(개발자).** 확장 프로그램의 소스는 저장소의 `shells/chrome-extension/`에 있어요. 패키징 단계에서 이 폴더로 프로덕션 패키지를 빌드해요. 그 패키지는 `https://lolly.tools`의 Lolly에서만 작동해요.

1. `pnpm run pack:chrome-extension`을 실행하세요. `dist/chrome-extension/`에 패키지를 빌드해요.
2. `chrome://extensions`를 여세요.
3. **Developer mode**(오른쪽 위)를 켜세요.
4. **Load unpacked**를 클릭하고 `dist/chrome-extension/` 폴더를 고르세요.
5. Lolly 탭을 새로고침하세요. 페이지가 로드될 때 Lolly가 확장 프로그램을 감지하면 "Get the extension" 안내가 사라져요. 그러면 Utilities의 **Lolly URL Screenshot**으로 캡처를 파일에 저장할 수 있고 Lolly Batch 모드에서도 작동해요.

::: details 로컬 개발 서버 또는 소스 폴더에서 사용하기
로컬 개발 서버에서는 `pnpm run pack:chrome-extension:dev`를 실행하고 대신 `dist/chrome-extension-dev`를 불러오세요. 그 패키지는 `http://localhost:5173`도 허용하며 이름에 **Development**가 들어 있어요.

`shells/chrome-extension/` 폴더 자체를 불러와도 PNG 스크린샷은 작동해요. 그 폴더에는 패키징 단계에서 빌드해 넣는 페이지 순회 기능이 없어요. 그 폴더에서 만든 SVG는 도형이 아니라 스크린샷을 담아요.
:::

<!--i:eti-user-check-->
## Lolly가 요청하면 일어나는 일

![Lolly 탭이 페이지 하나를 요청하면 확장 프로그램의 승인 창에서 Approve once를 눌러요. 백그라운드 탭이 열려 페이지를 읽고 닫혀요. 그러면 Lolly 탭이 결과를 받아요.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly가 요청해요.** 작은 스크립트가 확장 프로그램이 있다는 것을 Lolly에 알려주므로 추가 설정 없이 캡처나 페이지 읽기를 시작할 수 있어요.
2. **사용자가 승인해요.** 확장 프로그램이 자체 **Approve page request** 창을 열어요. 요청한 사이트, 스크린샷과 페이지 콘텐츠 중 원하는 것, 페이지 주소를 보여줘요. **Approve once**를 누르기 전에는 아무것도 읽지 않아요. **Cancel**을 누르거나 창을 닫으면 요청이 끝나요.
3. **Chrome이 사이트마다 한 번 물어요.** 사이트에 대한 요청을 처음 승인하면 Chrome도 확장 프로그램이 그 사이트에 접근해도 되는지 물어요. 허용하면 Chrome은 그 접근 권한을 유지하지만, 이후의 모든 요청에도 각각 **Approve once**가 필요해요.
4. **백그라운드 탭에서 페이지를 읽어요.** 확장 프로그램이 대상 페이지를 백그라운드 탭에서 열고, DevTools Protocol(데스크톱 앱과 같은 `Page.captureScreenshot`)로 캡처한 뒤 탭을 닫고 요청한 Lolly 탭에 결과를 돌려줘요.

::: details SVG 캡처 작동 방식
형식이 **SVG**이면 확장 프로그램이 화면을 찍는 대신 페이지를 순회해요. 확장 프로그램에 패키징된 스크립트가 백그라운드 탭에서 페이지 레이아웃을 읽고 페이지를 도형과 윤곽선 텍스트로 바꿔요. 파일은 어떤 크기에서도 선명하며 모든 부분을 계속 편집할 수 있어요. 페이지의 그림은 그림으로 남아요. 페이지가 캔버스, 동영상 또는 SVG로 표현할 수 없는 효과로 그리는 것은 같은 순간의 스크린샷에서 복사해요. Lolly는 그 스크린샷과 결과를 비교해요. 둘의 차이가 너무 크면 SVG는 대신 스크린샷을 담아요.

페이지의 자체 서체로 텍스트 윤곽선을 만들기 위해 확장 프로그램은 페이지가 불러온 글꼴 파일을 Lolly에 넘겨요. Chrome은 확장 프로그램이 읽을 수 있는 곳에 글꼴 바이트를 보관하지 않으므로, 확장 프로그램이 페이지에 각 글꼴을 다시 요청해요. 브라우저는 보통 캐시에서 응답하며, 그 요청에도 페이지 자체의 보안 정책이 적용돼요.
:::

승인은 요청 하나에 적용되며 30초 뒤에 만료돼요. 한 번에 요청 하나만 대기하거나 실행할 수 있고, 승인된 요청은 55초 뒤에 멈춰요. Lolly 페이지가 닫히거나 바뀌거나 대상 페이지가 다른 사이트로 이동하면 요청이 취소돼요.

::: warning 캡처는 브라우저 세션을 사용해요
페이지는 브라우저 세션으로 로드되므로 로그인한 페이지의 비공개 정보가 결과에 나타날 수 있어요.
:::

캡처는 사용자의 네트워크에서 사용자의 브라우저로 실행되므로 `localhost`와 내부 사이트도 작동해요. 캡처는 업로드되지 않아요. 네트워크 통신은 브라우저가 요청한 페이지를 불러올 때와 SVG의 경우 그 페이지의 글꼴 파일을 다시 불러올 때만 일어나요.

캡처가 실행되는 동안 임시 탭에 *"…started debugging this browser"* 배너가 잠깐 보일 수 있어요. 이 배너는 DevTools Protocol에서 표시하며 캡처가 끝나면 사라져요.

<a id="reading-a-site-for-design-system-setup"></a>
<!--i:eti-globe-->
## Lolly Design System Setup을 위해 사이트 읽기

Lolly Design System Setup의 **Website** 소스는 이미 가지고 있는 사이트에서 디자인 시스템을 시작해요. Chromium 브라우저에서는 확장 프로그램이 페이지를 읽어요. 데스크톱 앱에서는 앱이 직접 페이지를 가져와요. 확장 프로그램이 없는 브라우저에서는 Website 타일이 제공되지 않아요.

- **주소 하나, 페이지 하나.** 승인하면 확장 프로그램은 같은 방식의 백그라운드 탭에서 페이지를 열고, 렌더링된 마크업, 스타일시트 텍스트, 몇 개의 아이콘과 로고 이미지를 읽은 뒤 탭을 닫아요. 확장 프로그램은 링크를 따라가거나 크롤링하지 않아요.
- **다른 곳에 호스팅된 스타일시트**(CDN이나 글꼴 서비스)도 페이지의 색상과 서체를 담고 있으므로 가져와요. 교차 출처 요청에는 사용자 쿠키가 실리지 않아요. 동일 출처 요청은 페이지가 하듯이 사용자 쿠키를 사용해요.
- **모든 것에 상한이 있어요.** 스타일시트와 이미지 수, 바이트 수에 한도를 두므로 악의적이거나 일부가 망가진 페이지에서도 멈추지 않고 부분적인 자료를 돌려줘요.
- **파싱은 기기에서 일어나요.** 바이트는 요청한 Lolly 탭으로 바로 돌아가며, 그 탭이 바이트를 색상, 서체, 로고로 바꿔요.

주소를 붙여넣으면 입력란만 채워져요. 읽기를 시작하고 **Approve once**를 누르기 전에는 아무것도 읽지 않아요.

<!--i:eti-lock-->
## 권한

확장 프로그램의 `manifest.json`은 권한 네 가지와 사이트마다 하나씩 요청하는 사이트 접근 권한을 선언해요. `minimum_chrome_version: 111`을 설정하며 현재 버전은 0.5.0이에요.

| 권한 | 용도 | 부여 시점 |
|---|---|---|
| `debugger` | DevTools Protocol로 백그라운드 탭을 제어해 스크린샷을 찍고, SVG의 경우 페이지 순회를 실행해요. | 설치할 때 |
| `tabs` | 임시 백그라운드 탭을 열고 나중에 닫으며, 승인한 뒤 Lolly 페이지와 대상 페이지가 모두 이동하지 않았는지 확인해요. | 설치할 때 |
| `scripting` | Website 소스를 위해 지정한 사이트 안에서 단일 페이지 리더를 실행해요. | 설치할 때 |
| `storage` | 읽는 도중 브라우저가 확장 프로그램을 일시 중단해도 탭이 닫히도록, 연 탭의 ID를 세션 저장소에만 기록해요. 다음 시작 때 지워지며, 사용자에 관한 것은 저장하지 않아요. | 설치할 때 |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | 사이트 접근 권한이며 설치할 때 부여되지 않아요. **Approve once**를 누르면 확장 프로그램이 그 요청에 있는 사이트 하나의 접근 권한을 Chrome에 요청해요. | Chrome이 물은 뒤, 그 사이트에 대한 요청을 처음 승인할 때 |

확장 프로그램은 승인한 페이지만 읽어요. 사용자의 탐색 데이터를 읽거나 보내지 않아요.

<!--i:eti-help-->
## 문제 해결

- **"Get the extension"이 계속 보이나요?** Lolly 탭을 새로고침하세요.
- **이 사이트에서 아무 일도 일어나지 않나요?** 확장 프로그램은 `https://lolly.tools`에서만 작동하며 개발 패키지에서는 `http://localhost:5173`도 지원해요. 자체 호스팅한 Lolly 같은 다른 출처에는 `manifest.json`과 `policy.js` 모두에 그 출처를 나열한 자체 확장 프로그램 빌드가 필요해요. 매니페스트만 편집해서는 작동하지 않아요.
- **캡처가 실패하나요?** URL에 접근할 수 있고 `http://` 또는 `https://`로 시작하는지 확인하세요. 일부 페이지는 자동 캡처를 차단해요. **Cancel**을 눌렀거나 승인 창을 닫았거나 30초 넘게 기다렸다면 캡처를 다시 시작하세요.
