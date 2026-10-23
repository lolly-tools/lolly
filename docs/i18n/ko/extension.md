# 브라우저 확장 프로그램

웹 페이지는 다른 웹사이트의 픽셀을 읽을 수 없으므로 Lolly 웹 앱이 페이지를 스크린샷으로 찍으려면 도움이 필요해요. Chromium 기반 브라우저(Chrome 111부터의 Chrome, Edge, Brave, Arc, Opera)에서 무료 **Lolly URL Screenshot** 확장 프로그램이 데스크톱 앱이 쓰는 것과 같은 캡처로 이 도움을 줘요. 설치하면 다음이 가능해요.

- **[URL Screenshot](/t/url-shot)**이 구성한 페이지를 파일로 저장해요.
- 이미지 슬롯에 붙여넣은 웹 주소를 **Screenshot this page**로 해당 페이지의 스크린샷으로 바꿀 수 있어요.
- [Design System Setup](/info/brand-studio.html)의 **Website** 소스가 페이지 하나를 읽어 디자인 시스템을 시작할 수 있어요.

모든 요청을 사용자가 승인하며, 데스크톱 앱은 확장 프로그램 없이도 같은 작업을 해요.

## 설치하기 전에

확장 프로그램이 설치되기 전에도 **URL Screenshot**은 열리므로 샷을 구성할 수 있어요. 도구 컨트롤 상단의 안내가 무엇이 빠졌는지 알려줘요.

![캡처할 대상 호스트가 없을 때 표시되는, URL Screenshot 도구의 확장 프로그램 안내 문구](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

기다리는 동안에도 모든 컨트롤이 작동해요. 대상 URL, 스크롤 깊이, 안정화 지연, 자르기 여백, 색상 변경이에요. 캡처 자체만 확장 프로그램이 필요해요.

![확장 프로그램 없이도 사용할 수 있는, 대상 URL·스크롤 깊이·정착 지연시간·크롭 여백이 있는 URL Screenshot 컨트롤](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## 설치

**Chrome 웹 스토어에서:** 곧 제공돼요. 확장 프로그램이 게시되면 한 번의 클릭으로 설치해요.

**직접 불러오기(개발자).** 확장 프로그램은 저장소의 `shells/chrome-extension/`에 있어요. 그 폴더는 프로덕션 빌드이며 `https://lolly.tools`의 Lolly에서만 작동해요.

1. `chrome://extensions`를 여세요.
2. **Developer mode**(오른쪽 위)를 켜세요.
3. **Load unpacked**를 클릭하고 `shells/chrome-extension/` 폴더를 선택하세요.
4. Lolly 탭을 새로고침하세요. 감지는 페이지가 로드될 때 일어나므로 "Get the extension" 안내가 사라져요. 그러면 **URL Screenshot**(Utilities 아래)이 캡처를 파일로 저장할 수 있고 Batch 모드에서 사용 가능해져요.

로컬 개발 서버를 쓴다면 `pnpm run pack:chrome-extension:dev`를 실행하고 대신 `dist/chrome-extension-dev`를 로드하세요. 이 패키지는 `http://localhost:5173`도 허용하며 이름에 **Development**가 붙습니다.

## Lolly가 요청하면 일어나는 일

![Lolly 탭이 페이지 하나를 요청하고 사용자가 확장 프로그램의 승인 창에서 Approve once를 눌러요. 백그라운드 탭이 열려 페이지를 읽고 닫혀요. 그다음 Lolly 탭이 결과를 받아요.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly가 요청해요.** 작은 스크립트가 Lolly에 확장 프로그램이 있음을 알려주므로, 추가 설정 없이 캡처나 페이지 읽기를 시작할 수 있어요.
2. **사용자가 승인해요.** 확장 프로그램이 자체 **Approve page request** 창을 열어요. 요청한 사이트, 스크린샷인지 페이지 콘텐츠인지, 페이지 주소를 보여줘요. **Approve once**를 누르기 전에는 아무것도 읽지 않아요. **Cancel**이나 창 닫기는 요청을 끝내요.
3. **Chrome이 사이트마다 한 번 물어요.** 사이트에 대한 요청을 처음 승인할 때 Chrome이 확장 프로그램이 그 사이트에 접근해도 되는지도 물어요. 허용하면 Chrome이 그 접근을 유지하지만, 이후 모든 요청에는 여전히 각자의 **Approve once**가 필요해요.
4. **페이지는 백그라운드 탭에서 읽어요.** 확장 프로그램이 대상 페이지를 백그라운드 탭에서 열고, DevTools Protocol(데스크톱 앱이 쓰는 것과 같은 `Page.captureScreenshot`)로 캡처하고, 탭을 닫고, 요청한 Lolly 탭에 결과를 전달해요.

승인은 요청 하나에만 해당하며 30초 후 만료돼요. 요청은 한 번에 하나만 대기하거나 실행될 수 있고, 승인된 요청은 55초 후 중단돼요. Lolly 페이지가 닫히거나 바뀌거나 대상 페이지가 다른 사이트로 이동하면 요청이 취소돼요.

캡처는 사용자의 네트워크에서 사용자의 브라우저 안에서 실행되므로 `localhost`와 내부 사이트도 작동해요. 페이지는 브라우저 세션으로 로드되므로 로그인한 페이지는 결과에 비공개 정보를 보여줄 수 있어요. 캡처는 업로드되지 않아요. 네트워크 트래픽은 요청한 페이지를 사용자의 브라우저가 로드하는 것뿐이에요.

캡처가 실행되는 동안 임시 탭에 *"…started debugging this browser"* 배너가 잠깐 보일 수 있어요. DevTools Protocol이 작동하는 것이며, 샷이 끝나면 배너가 사라져요.

## Design System Setup용 사이트 읽기

Design System Setup의 **Website** 소스는 이미 가진 사이트로 디자인 시스템을 시작해요. Chromium 브라우저에서는 확장 프로그램이 페이지를 읽어요. 데스크톱 앱에서는 앱이 직접 페이지를 가져와요. 확장 프로그램이 없는 브라우저에서는 Website 타일이 제공되지 않아요.

- **주소 하나, 페이지 하나.** 승인하면 확장 프로그램이 같은 종류의 백그라운드 탭에서 페이지를 열고, 렌더링된 마크업, 스타일시트 텍스트, 아이콘과 로고 이미지 몇 개를 읽은 뒤 탭을 닫아요. 링크를 따라가거나 크롤링하지 않아요.
- **다른 곳에 호스팅된 스타일시트**(CDN이나 글꼴 서비스)도 가져와요. 페이지의 색상과 서체가 그 안에 있기 때문이에요. 교차 출처 요청은 쿠키 없이 가고, 같은 출처 요청은 페이지 자체처럼 쿠키를 써요.
- **모든 것에 상한이 있어요.** 스타일시트와 이미지의 수와 바이트에 한도가 있으므로, 악의적이거나 반쯤 망가진 페이지도 멈추는 대신 일부 자료를 반환해요.
- **구문 분석은 사용자의 기기에서 이루어져요.** 바이트는 요청한 Lolly 탭으로 곧바로 돌아가며, 거기서 색상, 서체, 로고로 바뀌어요.

주소를 붙여넣으면 입력란만 채워져요. 읽기를 시작하고 **Approve once**를 누르기 전에는 아무것도 읽지 않아요.

## 권한

확장 프로그램의 `manifest.json`은 권한 네 개와, 사이트 하나씩 요청하는 사이트 접근을 선언해요. `minimum_chrome_version: 111`로 설정되어 있고 현재 버전은 0.4.0이에요.

| 권한 | 용도 | 부여되는 시점 |
|---|---|---|
| `debugger` | 스크린샷을 찍는 DevTools Protocol로 백그라운드 탭을 구동해요. | 설치할 때 |
| `tabs` | 임시 백그라운드 탭을 열고 나중에 닫으며, 승인한 뒤 Lolly 페이지와 대상 페이지 모두 이동하지 않았는지 확인해요. | 설치할 때 |
| `scripting` | Website 소스를 위해 지정한 사이트 안에서 한 페이지 리더를 실행해요. | 설치할 때 |
| `storage` | 연 탭의 ID를 세션 저장소에만 기록해서, 읽는 도중 브라우저가 확장 프로그램을 일시 중단해도 탭이 닫히게 해요. 다음 시작 때 지워지며 사용자에 관한 것은 저장되지 않아요. | 설치할 때 |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | 사이트 접근이며 설치할 때는 부여되지 않아요. **Approve once**를 누르면 확장 프로그램이 해당 요청의 사이트 하나에 대한 접근을 Chrome에 요청해요. | 해당 사이트의 요청을 처음 승인할 때, Chrome이 사용자에게 물은 뒤 |

확장 프로그램은 승인한 한 페이지만 읽어요. 탐색 데이터를 읽거나 보내지 않으며 업로드되는 것은 없어요.

## 문제 해결

- **아직 "Get the extension"이 보이나요?** Lolly 탭을 새로고침하세요.
- **이 사이트에서 아무 일도 일어나지 않나요?** 확장 프로그램은 `https://lolly.tools`와 개발 패키지의 `http://localhost:5173`에서만 작동해요. 직접 호스팅한 Lolly 같은 다른 출처에는 `manifest.json`과 `policy.js` 모두에 그 출처가 나열된 확장 프로그램의 자체 빌드가 필요해요. 매니페스트만 편집해서는 작동하지 않아요.
- **캡처가 실패하나요?** URL에 접근할 수 있고 `http://` 또는 `https://`로 시작하는지 확인하세요. 일부 페이지는 자동 캡처를 차단해요. **Cancel**을 눌렀거나, 승인 창을 닫았거나, 30초 넘게 기다렸다면 캡처를 다시 시작하세요.
