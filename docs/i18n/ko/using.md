# Lolly 사용하기

Lolly를 열었고 무언가를 만들어 보관하고 전달하고 싶군요. 이 페이지는 그 흐름을 안내해요. 도구를 열고, 허용된 부분을 바꾸고, 결과를 저장하고, 링크나 파일로 공유해요.

여기 있는 모든 것은 계정 없이 기기에서 실행되며, 필요한 도구와 에셋을 내려받은 뒤에는 오프라인에서도 계속 동작해요. 앱이 시작하려면 WebGPU가 있는 브라우저나 앱이 필요해요. [지원되는 환경](/info/supported-environments.html)에서 테스트된 환경을 나열해요.

## 화면 둘러보기

::: figure using-app-map
홈 화면: 위쪽에 탭 네 개, 아래쪽에 막대 하나가 있어요. 도구를 열면 실시간 미리보기 옆에 컨트롤이 표시돼요.
:::

홈 화면 위쪽에 **Tools**, **Utilities**, **Assets**, **Projects** 탭 네 개가 있어요. Tools는 만드는 데 쓰는 것이고, Utilities는 파일 변환, 확인, 정리 같은 작업을 위한 작업대이며, Assets는 라이브러리이고, Projects는 저장한 것을 담아요.

아래쪽 막대에는 **Open**, **Settings**, 검색 입력란, **Verify**, **What?**이 있어요. Tools, Utilities, Assets, Projects, Settings와 앱에서 읽는 가이드에 표시되고, 도구를 열면 비켜나요. [검색](/info/search.html)은 이 입력란에서 도구, 저장된 작업물, 에셋, 설정에 닿아요. [Ask Lolly](/info/ask.html)는 입력한 질문에 이 가이드의 해당 섹션으로 답해요.

카드를 클릭하면 그 도구에서 새로 시작해요. 저장된 작업물은 **Projects**에서 다시 열어요.

![탐색 예시와 New 동작을 보여주는 갤러리 카드](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

각 도구는 분할 보기예요. 한쪽에는 **컨트롤**, 다른 쪽에는 실시간 **미리보기**가 있어요. 컨트롤을 바꾸면 미리보기가 바로 따라오고, 보이는 대로 내보내져요.

![도구의 분할 화면 - 왼쪽에는 컨트롤 스택, 오른쪽에는 실시간으로 그려지는 그룹형 막대 차트](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Design**은 예외예요. 끌고, 크기를 조정하고, 글을 입력하는 박스로 이루어진 자유 캔버스로 열리며, 자체 상단 막대, 타임라인, 덱 컨트롤이 있어요. [Design: 자유 캔버스](/info/design.html)가 그 가이드예요.

## 도구가 허용하는 것 바꾸기

도구에는 달라져야 할 입력만 표시돼요. 작성자가 색상, 레이아웃, 글꼴, 로직을 이미 고정했으므로 만드는 것은 모두 그 규칙을 따라요. 입력에는 텍스트, 슬라이더, 색상 선택기, 드롭다운, 날짜, 이미지 선택기, 반복 행 그룹이 있고, 일부는 접히는 섹션에 있어요.

![도구의 컨트롤 묶음 - 텍스트 칸과 색 버튼, 슬라이더뿐이고 나머지는 제작자가 고정해 뒀어요](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**디자인을 클릭해서 해당 컨트롤 찾기.** 미리보기의 어떤 요소든 클릭하면 해당 컨트롤에 포커스가 가고 화면에 스크롤돼요. 반복 행 그룹에서는 클릭한 행이 정확히 펼쳐져요.

컨트롤 위의 **Clear changes**는 모든 입력을 기본값으로 되돌려요.

**디자인 시스템 선택.** 디자인 시스템이 컬러웨이, 밝은 모습과 어두운 모습, 또는 다른 테마 선택지를 둘 이상 제공하면 컨트롤 아래의 **Design system** 섹션에 이것이 있어요. 선택지는 이 도구에 영향을 줄 때만 나타나므로 파일 유틸리티에는 섹션이 아예 없어요. 각 컬러웨이는 자체 색상의 점이고, 밝음과 어두움은 두 개의 버튼이며, 그 밖의 선택은 목록이에요.

선택은 이 작품에 속해요. 링크와 저장된 세션에 담겨 이동하고, 디자인 시스템에 연결된 모든 색상이 이를 따르며, 앱 자체의 색상은 그대로예요. Design은 Inspector의 **Canvas** 탭에서 같은 선택을 보여줘요. 색상이 곧 콘텐츠인 도구는 표준 컬러웨이에 머물 수 있으며, 그러면 컬러웨이 점을 제공하지 않아요. [Lolly Demo 사용하기](/info/lolly-demo-in-use.html#colourways-on-real-work)에서 실제 작업의 컬러웨이를 보여줘요.

### 미리보기 확대/축소와 이동

미리보기는 언제나 내보내질 결과 그대로를 보여 줘요.

- **확대/축소:** Cmd/Ctrl 스크롤 또는 트랙패드 핀치로, 포인터를 중심으로 확대/축소해요. 키보드에서는 `0` 또는 `Shift+1`로 전체에 맞추고, `1` 또는 `Shift+0`으로 100%를 설정하고, `Shift+2`로 선택 영역에 맞춰요. `+` / `−`는 포인터가 스테이지 위에 있으면 포인터를 중심으로, 그 밖에 있으면 화면 중앙을 중심으로 확대/축소해요.
- **이동:** **Space**를 누른 채 끌거나 마우스 가운데 버튼으로 끌어요. 일반 클릭은 디자인의 부분을 클릭하는 용도로 그대로 비워 둬요.
- **터치:** 핀치로 확대/축소하고, 끌어서 이동하고, 두 번 탭해서 맞춰요.
- **확대/축소 HUD:** 모서리의 Lolly 소용돌이를 길게 누르면 `−`, **Fit**, `+`가 펼쳐져요. 소용돌이를 짧게 탭하면 여전히 프로필 메뉴가 열려요.

Design의 **Fit all**은 아트보드와 독립된 레이어를 포함해요. 수동으로 축소하면 전체 페이지가 화면의 절반을 채울 때까지 20% 아래로 내려갈 수 있어요. 최종 하한은 기본 Fit 배율의 5%와 절대 배율 2% 중 더 작은 값이에요.

출력 크기가 바뀌면 보기가 항상 깔끔하게 맞춰진 상태로 돌아가요.

![캔버스 모서리의 소용돌이에서 펼쳐진 확대/축소 HUD: 빼기, Fit, 더하기, 그다음 테마와 소리 토글, 이를 옮기는 손잡이](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### 실행 취소와 다시 실행

**Cmd/Ctrl-Z**로 뒤로 가고 **Cmd/Ctrl-Shift-Z**(또는 **Cmd/Ctrl-Y**)로 앞으로 가요. 같은 한 쌍이 컨트롤 위에 **Undo**와 **Redo** 버튼으로도 있으며(Design에서는 상단 막대에 있어요), 되돌릴 것이 없으면 각각 회색으로 바뀌어요. 메시지가 각 실행 취소로 복원된 입력을 알려주며, 메시지에 **Redo** 버튼이 있어요.

- **끌기는 한 단계예요.** 0.5초 안에 한 컨트롤을 반복해서 바꾸면 합쳐지므로, 슬라이더를 끝까지 당겨도 실행 취소는 한 번이에요.
- **마지막 100단계가 보관돼요.** 실행 취소 후에 새로 편집하면 앞으로 가기 스택이 지워져요.
- **텍스트 상자에서는** Cmd/Ctrl-Z가 입력란에 속하며 글자 단위로 작동해요. 슬라이더, 드롭다운, 색상, 스위치는 Lolly가 맡아요.
- 파일 입력에서 **파일 선택**은 단계가 아니에요. 그 바이트는 이번 세션에서만 유지되기 때문이에요.

실시간 [협업](/info/collaborate.html)에서도 기록은 사용자만의 것이에요. 다른 기기의 변경이 사용자의 스택에 들어가지 않아요. 실행 취소는 도구를 떠나거나 새로고침할 때까지 유지돼요. 더 오래된 것은 작업하는 동안 저장하는 도구가 **History** 아래에 이전 버전을 보관해요. [이전 버전으로 돌아가기](/info/find-your-work.html#go-back-to-an-earlier-version)를 참고하세요.

### 라이브 카메라

**Filter** 도구의 효과(Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art, Glitch)는 카메라를 쓸 수 있으면 **Go live** 버튼을 보여줘요. 켜면 효과가 웹캠을 프레임 단위로 따라가고, 모션 내보내기는 결과를 GIF, WebM, MP4로 기록해요. 프레임은 기기에서 처리되며, 멈추거나 도구를 떠나는 순간 카메라가 해제돼요. 모든 이미지 선택기에는 한 프레임을 위한 **Take a photo**도 있어요.

## 저장하고 이어서 하기

작업물을 보관하려면 렌더 알약의 **Export** 옆 체크 표시인 **Save**를 누르세요. 새 작업물은 **My library**로 가고, 이전에 저장한 작업물은 그 자리에서 업데이트되며 다운로드되는 것은 없어요. 내보내기 패널에도 같은 **Save** 버튼이 있어요.

저장 위치를 고르려면 내보내기 패널의 **Download** 옆 **Save as**를 누르세요. **Save to a project** 아래에서 **My library**를 그대로 두거나 프로젝트를 고르고(**＋ New project…**로 만들 수 있어요) **Save**를 누르세요. **Save as a template**은 디자인을 새 문서의 출발점인 [템플릿](/info/templates.html)으로 보관해요. Design에서는 **Save as**가 Lolly 메뉴에 있어요. 휴대폰에서는 **•••**, **File menu**, **Save as** 순으로 누르세요.

![두 부분으로 나뉜 렌더 알약: 내보내기 패널을 여는 위쪽 화살표의 Export, 제자리에 저장하는 체크 표시의 Save](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> 렌더 알약에서 **Save**를 누르거나, **Save as**로 프로젝트를 고르세요.
- <!--i:folder--> 항목이 **My library** 또는 고른 프로젝트로 가요.
- <!--i:home--> 나중에 왼쪽 위의 **Home**을 누르고 **Projects** 탭을 여세요.
- <!--i:document--> 항목을 열어요. 모든 설정이 돌아와 있어서 바로 바꾸고 다시 내보낼 수 있어요.
:::

항목 이름은 내보내기 패널에 입력한 파일 이름을 따르며, 없으면 **QR Code** 같은 도구 이름을 따라요. **Download**로 받은 파일은 완성된 사본이므로, 나중에 바꾸려면 Projects에서 저장된 항목을 여세요.

개인 저장물은 [Sync](/info/sync.html)를 켜지 않는 한 저장한 브라우저나 앱의 이 기기에 남아요. 예상한 곳에 없다면 [작업물 찾기와 복구](/info/find-your-work.html)가 닫힌 탭부터 지워진 브라우저 데이터까지 모든 경우를 다뤄요.

::: details Lolly Work의 팀 프로젝트(선택 사항)
[조직이 Lolly Work를 사용한다면](/info/organisation.html) 그 인스턴스에 로그인하고 **Projects → Team projects**를 열어 공유받은 세션을 확인하세요. 접근과 보관은 조직이 정하며, 해당 세션은 조직의 Lolly Work 서비스가 저장해요. 조직이 실시간 편집을 허용하면 공유 세션은 열릴 때 실시간 collab에 합류해요. [함께 작업하기](/info/collaborate.html#work-collabs-with-lolly-work-optional)에서 단계를 설명해요.

개인 라이브러리는 별개로 유지돼요. 다른 기기에서 로그인하면 팀 작업은 오지만, 개인 저장물은 Sync나 백업이 있어야 옮겨져요.
:::

## 작업물 공유하기

디자인은 링크나 파일로 나가요. 내보내기 컨트롤의 **Share**는 둘 다 제공하는 대화상자를 열고, Projects에 저장된 세션의 **Share link**는 그 세션에 대해 같은 대화상자를 열어요.

::: cols
## 링크

- 주소에 모든 입력이 담기므로 링크가 디자인을 그대로 재현해요.
- 이 기기에서 추가한 이미지와 파일, 아주 긴 텍스트, 아주 큰 목록은 빠져요.
- 어느 브라우저에서나 열리므로 링크를 북마크하고, 붙여넣고, 커밋할 수 있어요.

## .lolly 파일

- 이 기기의 이미지와 파일이 포함된 저장 세션을 담고, 도구와 디자인 시스템도 담을 수 있어요.
- 파일 포함을 선택하지 않으면 라이선스가 있는 카탈로그 아트는 제외해요.
- Lolly에서 열려요. 더블클릭하거나 **Open**을 쓰거나 앱에 끌어다 놓으세요.
:::

### 링크

바로 복사할 수 있는 링크가 대화상자 맨 위에 **Copy**와 링크로 QR Code 도구를 여는 **QR** 버튼과 함께 있어요. 링크 아래의 **Link options**에는 다음이 있어요.

- **Open in the installed app**은 링크를 Shortcuts, 런처, 자동화용 `lolly://` 주소로 바꾸며 모든 매개변수는 그대로예요.
- **Shortest link**는 긴 디자인을 간결한 토큰으로 압축하고 줄어든 글자 수를 보여줘요. 읽을 수 있는 형태도 항상 함께 있어요.
- **Password-protect this link**는 링크를 기기에서 AES-256으로 암호화해요. 비밀번호는 링크에 절대 포함되지 않아요.
- **Pin this tool version**은 `_v` 플래그를 추가해서 나중에 도구가 업데이트돼도 링크의 렌더링 결과가 바뀌지 않게 해요.
- **When the recipient opens the link…**는 전체 화면, 이미 펼쳐진 내보내기 패널, 열 때 다운로드(`&export`), 클립보드로 복사(`&copy`) 중에서 골라요.
- **Copy credit**은 게시물이나 슬라이드용으로 링크와 함께 "Made with Lolly" 캡션을 복사해요.

도구에 이름 같은 개인 필드가 있으면 **Review personal fields**가 해당 필드를 선택할 때까지 링크에 넣지 않아요. [URL 모드](/info/url-mode.html)에서 링크에 담을 수 있는 모든 것을 다뤄요.

**대화상자는 링크가 담을 수 없는 것을 알려줘요.** 이 기기에서 추가한 이미지나 파일, 아주 긴 텍스트 값, 아주 큰 목록은 주소에 들어가지 않아요. 링크를 만들 때 각각 집계돼요. 무언가 빠졌다면 그림이 빠진 채로 열리는 링크를 건네는 대신, 대화상자가 그 목록을 보여주고 파일 옵션을 안내해요. 길기만 한 링크에는 글자 수와 함께 더 가벼운 안내가 나와요.

**어떤 도구는 링크 자체가 제품이에요.** Jump Page는 링크를 한 페이지에 모아 나눠 주게 해요. 프로필 링크, 강연, 매장 앞면 등이에요. 페이지가 곧 링크이므로 호스팅도 계정도 없어요. 방문자는 전체 너비로 보고, 스크롤하면 장면마다 링크 하나씩 나와요.

![편집기에서 본 Jump Page: 페이지 상단의 제목 장면과 그 아래의 링크 장면들](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Lolly Work의 조직 관리형 링크
만료, 폐기, 비밀번호가 필요한 공유를 위해 Lolly Work는 공유 세션, 도구, 카탈로그 에셋에 대한 관리형 링크를 제공해요. 이 링크는 조직의 서비스를 통해 확인되며 그 접근 규칙을 따라요. 위의 독립형 링크와는 별개이며, 링크를 폐기해도 누군가 이미 내려받은 파일을 회수할 수는 없어요. [렌더링과 공유](/info/manage/sharing.html)에서 링크 유형과 권한을 나열해요.
:::

### .lolly 파일

공유 대화상자의 **Editable file** 섹션에 있는 **Download .lolly**는 현재 디자인을 파일 하나로 써요. 이 기기의 이미지와 파일이 포함된 저장 세션을 담고, 일반 카탈로그 아트도 함께 들어가요. 오래됐거나 사용할 수 없는 파일은 사라지지 않고 외부 참조로 남아요. 저장하기 전에 대화상자가 파일 크기, 포함된 파일 수, 참조된 파일 수, 도구 포함 여부를 보여줘요. 기기에 공유 시트가 있으면 **Send to…**가 파일을 바로 넘겨줘요(AirDrop, Android 공유).

**Projects**의 폴더 메뉴에 있는 **Download project (.lolly)**는 폴더 전체를 써서 다른 사람이 폴더의 모든 세션을 이어서 작업할 수 있게 해요. Batch 세션은 제외되며 알림에 몇 개인지 표시돼요. 같은 메뉴의 **Download originals**는 각 항목을 개별 파일로 담은 일반 zip을 써요.

파일이 나가기 전에 사용자가 결정할 것이 세 가지 있어요.

- **이름을 넣을지.** 이름, 이메일, 조직은 [프로필](/info/profile.html)에서 **Use my details to create**가 켜져 있을 때만 기록돼요. 꺼져 있으면 파일에는 Lolly로 만들었다는 사실과 시간만 기록돼요.
- **제외된 아트를 넣을지.** 라이선스가 있는 아트, 브랜드 잠금 아트, 라이선스가 기록되지 않은 카탈로그 작품은 기본적으로 빠져요. 디자인이 그중 하나라도 쓰면 대화상자가 몇 개인지 알려주고 *Download without them* 또는 *Include and download*를 제공해요. 포함하면 `.lolly`를 여는 사람에게 그 파일이 넘어가기 때문이에요. 파일의 `CREDITS.txt`는 무엇이 포함되었고 무엇이 제외되었는지 이유와 함께 나열하며, [크리에이티브 권리와 크레딧](/info/creative-rights.html)이 규칙을 설명해요.
- **도구를 넣을지.** **Include the tool**은 도구 자체의 파일을 묶어서, 그 도구가 없는 기기에서도 디자인이 열리게 해요. 포크 같은 사용자 지정 도구는 선택된 채로 시작하고, 서명된 카탈로그에 있는 도구는 선택 해제된 채로 시작해요. 서명된 카탈로그가 없는 빌드에서는 모든 도구가 사용자 지정으로 간주돼요.

**파일 열기.** 데스크톱과 모바일 앱에서는 `.lolly`를 더블클릭하거나 탭하고, **Open with Lolly**를 선택하거나, 공유 시트에서 Lolly로 보내세요. 웹 앱에서는 **Open**을 누르거나 Lolly에 파일을 끌어다 놓으세요. 어느 경로든 무언가 쓰기 전에 먼저 파일의 매니페스트를 읽고 크기, 내용, 이어질 일을 보여줘요.

파일에 없는 도구가 들어 있으면 **Trust this tool?**이 도구와 작성자를 보여주고, 이를 열면 도구 자체 코드가 기기에서 실행된다고 알려줘요. **Trust & install**을 누르면 진행해요. 거절해도 작업물은 Projects에 저장되어 도구를 추가하는 날을 기다려요. 코드가 모듈로 제공되는 도구는 아직 이 방식으로 설치할 수 없으며 같은 방식으로 거절돼요.

::: details .lolly에 담기는 것과 열리는 방식
`.lolly`는 Lolly의 번들 확장자이며, `manifest.json`의 `format`이 안에 든 것을 알려줘요.

- **공유 디자인**(`lolly-share`)은 저장된 세션 하나, 포함된 파일, 아직 참조로 확인되는 것의 영수증을 담아요. 도구와 디자인 시스템도 담을 수 있어요. 열면 새 Project가 추가되며 세션을 덮어쓰지 않아요.
- **공유 프로젝트**(`lolly-share`, kind `project`)는 Projects의 폴더 하나를 담아요. 하위 폴더, 그 안의 모든 세션과 타일, 거기 보관된 그림이에요. 열면 폴더 전체의 사본이 추가돼요. 각 세션은 `sessions/<key>.json`으로, 타일은 `thumbs/` 아래에 담겨 이동해요. 프로젝트 파일이 생기기 전의 Lolly는 업데이트하라고 안내해요.
- **디자인 시스템 팩**(`lolly-brand`)은 토큰을 담고 글꼴, 로고, 게시된 버전, 유지된 리소스를 담을 수 있어요. 팩을 열면 별도로 이름 붙은 디자인 시스템이 추가되고 그 시스템이 활성화돼요.
- **워크스페이스 또는 인스턴스 팩**은 선언된 도구, 카탈로그 에셋, 선택적으로 인스턴스 주소가 있는 `lolly-brand`예요. 하나를 불러오면 이전에 불러온 단일 워크스페이스 오버레이를 대체하며, 미리보기에 이런 기기 전체 영향이 나열돼요.

전체 기기 백업은 `.lolly`가 아니에요. `LollyTools-….zip`(형식 `lolly-backup`)으로 남으며 **Settings → Storage → Import data…**로 복원해요. zip으로 묶인 도구 폴더도 `.zip`으로 남아요. [데이터 이전](/info/data-transfer.html)이 형식 참조예요.

`.lolly`는 일반 zip이에요. 이름을 `.zip`으로 바꾸면 내용을 볼 수 있어요. 직접 올린 이미지는 `assets/uploads/` 아래, 카탈로그 아트는 `assets/catalog/` 아래에 있고, `manifest.json`이 모든 파일을 나열하며, README가 파일이 무엇인지 알려줘요.

macOS, Windows, Linux, iOS, Android 모두 이 형식을 등록하며, 데스크톱 파일 관리자는 이를 Lolly 문서로 표시하고 GNOME Files는 저장된 세션 자체의 썸네일을 보여줄 수 있어요. Design System Setup에서 열면 공유 디자인에 디자인 시스템이 들어 있을 때 디자인 시스템 동작을 추천하지만 **Open shared design**을 숨기지는 않아요.

iOS나 Android에서 다른 앱이 넘긴 문서는 48 MB로 제한돼요. 넘기는 과정이 앱 경계를 넘어 바이트를 복사하기 때문이며, 앱이 이를 알려줘요. Lolly 안의 **Open**에는 그런 제한이 없으니 더 큰 번들에는 그것을 쓰세요.

확인하면 Lolly가 번들을 한 번 풀고 검증해요. 에셋은 체크섬으로 대조되어 라이브러리로 가고 이미 기기에 있는 파일은 재사용돼요. 세션은 새 ID로 Projects에 가므로 같은 파일을 두 번 열 수 있으며, 도구가 없는 세션은 그곳에서 기다려요. 100 MB가 넘는 파일은 큼으로 표시되고, 브라우저 저장소의 여유 공간이 파일에 필요한 것보다 적다고 보고하면 미리보기가 경고해요. 무엇이든 확정되기 전에 무결성 대상인 모든 부분을 확인하며, 손상된 사본은 아무것도 남기지 않고 거부돼요.
:::

링크와 파일은 모두 스냅샷을 전달해요. 실시간 편집에 관해서는 [함께 작업하기](/info/collaborate.html)가 두 기기 간 비공개 collab과 Lolly Work를 통한 선택적 업무 collab을 다뤄요.

## 애셋 - 내 라이브러리

**Assets**(`#/a`)는 도구가 활용할 수 있는 모든 것을 모아요. 브랜드 로고, 이미지, 오디오, 모션이 종류별로 묶여 있고 직접 올린 파일도 있어요. 업로드한 파일은 기기에 저장돼요. Lolly Work를 쓰는 조직은 자체 접근 규칙에 따른 공유 카탈로그도 제공할 수 있어요. [조직에서 Lolly 사용하기](/info/organisation.html)를 참고하세요.

![애셋 - 브랜드 색상 견본과 글꼴, 그리고 내가 올린 파일](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **파일 가져오기.** 이미지, SVG, 오디오 클립, 동영상, Lottie, PDF, PowerPoint 덱을 업로드 영역에 놓거나 클릭해서 고르세요. Assets와 모든 도구의 에셋 선택기에 즉시 나타나요. 여러 페이지 PDF나 `.pptx`는 유지할 페이지나 슬라이드를 묻고, 각각 SVG 에셋이 돼요. 도구 안에서 추가한 이미지는 받은 그대로 **My images**에 보관되므로 거기 붙은 Content Credential도 여전히 검증되며, 아주 큰 파일만 크기 조정 여부를 물어요. **Settings → Storage**가 **My images**의 용량을 보여줘요. 기기 저장소 외에 다른 제한은 없어요. 이미지가 들어올 때 EXIF와 GPS 데이터를 지우려면 **Settings → Feature flags**에서 **Strip metadata from uploads**를 켜세요. Content Credentials는 어느 쪽이든 유지돼요.
- <!--i:star--> **자주 쓰는 것을 즐겨찾기.** 에셋이나 브랜드 견본에 별표를 하면 모든 선택기의 맨 위에 고정돼요.
- <!--i:folder--> **정리하기.** 에셋을 다른 그룹으로 옮기고, 쓰지 않는 공유 브랜드 에셋을 숨기거나(**Show hidden**으로 되돌려요) 직접 올린 파일을 삭제해요. Projects와 같은 선택 막대가 선택 항목 전체에 적용돼요.
- <!--i:layers--> **동영상에서 배경 걷어내기.** 동영상의 세부 정보를 열거나 에셋 선택기에서 카드를 우클릭하고 **Remove background…**를 선택하세요. **On-device model**은 복잡한 장면에서 피사체를 잘라내고, **Colour key**는 그린 스크린처럼 고르게 조명된 배경을 제거하며 가장자리를 위한 **Tolerance**, **Softness**, **Spill removal**이 있고 다운로드가 필요 없어요. **Resolution**(360, 480, 720 또는 1080p, 원본을 넘지 않음)은 디테일과 속도를 맞바꿔요. 진짜 투명도를 가진 애니메이션 WebP 또는 PNG인 잘라낸 결과가 원본 옆에 저장되고, 원본의 Content Credential이 구성 요소로 함께 따라가요. [한 번 생성하고 똑같이 렌더링](/info/ai-features.html)에서 이것이 평범한 편집으로 유지되는 이유를 설명해요.

### 팔레트와 글꼴을 어디로든 가져가기

Assets의 **Swatches** 패널은 브랜드를 이루는 색상을 보여줘요. 브랜드 색상, 추가한 색상, 램프, 스펙트럼이에요. Lolly가 인터페이스용으로 보관하는 역할 색상(텍스트, 표면, 가장자리, 컬러웨이 리드, 다른 이름으로 된 브랜드 색상의 사본)은 패널 하단의 회색 **Show colour roles** 카드 뒤에 있어요.

각 색상은 다른 에셋처럼 카드예요. 하나를 클릭하면 세부 정보가 열리고, 몇 개를 선택해 그것만 다운로드하거나, 다른 도구가 읽는 형식으로 팔레트 전체를 다운로드할 수 있어요.

- <!--i:code--> 스타일시트나 빌드용 **Design tokens (JSON)**, **CSS variables**, **CSS classes**. sRGB보다 넓은 색상은 넓은 값을 유지해요. CSS는 헥스 뒤에 이를 설정하고, JSON은 헥스에 넓은 색상, CMYK 빌드, 별색 잉크를 함께 유지해요.
- <!--i:palette--> Illustrator나 Photoshop용 **Adobe Swatch Exchange (.ase)**. CMYK 빌드로 잠긴 색상은 그 CMYK 견본으로, 별색 잉크는 이름 있는 별색 견본으로, sRGB보다 넓은 색상은 Lab으로 들어가요.
- <!--i:pentool--> GIMP나 Inkscape용 **GIMP palette (.gpl)**와 **SCSS variables**이며 둘 다 sRGB예요.

![Swatches 패널: 위쪽에 팔레트 다운로드 버튼 다섯 개, 그 아래에 세부 정보를 여는 칩으로 된 모든 브랜드 색상](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

각 카드의 점으로 색상을 선택해요. 두 번째 점을 Shift 클릭하면 사이의 모든 것이 선택되고, 상자를 끌어 틈을 지나가거나, 카드에 포커스를 둔 채 Cmd/Ctrl+A를 눌러요. 막대는 같은 여섯 가지 형식의 **Download as…**, **Copy hex**, **Favourite**를 제공해요. 형식을 고르기 전에 메뉴가 어떤 형식도 담을 수 없는 색상(Transparent는 색 자체가 없어요), 넓은 색상을 sRGB 대체값으로 저장하는 형식(SCSS와 GIMP), CMYK와 별색 값을 담는 형식(JSON과 .ase)을 나열해요. 카드를 우클릭하면 색상 하나에 같은 동작을 쓸 수 있어요.

색상의 세부 정보는 미리보기를 그 색으로 채우고 **Linked values**(CMYK 빌드 또는 별색 잉크, 특정 공간이나 인쇄기용으로 작성된 값, 디자인 토큰), **Every notation**(헥스, OKLCH, Display-P3 등, 각각 복사 버튼 포함), **Plotted on a colour space**, **Tones**, **Readability**를 펼쳐요. 화살표 키로 팔레트를 이동하고, **Copy link**는 색상 자체를 공유하며, **Open in Colour Lab**이 더 깊이 들어가게 해요.

**Fonts** 패널은 브랜드 글꼴을 나열하고 각각에 **download**가 있어서 로컬에 설치하거나 인쇄소에 넘길 수 있어요.

## 그리드 맞춤 설정

- <!--i:star--> **쓰는 것을 즐겨찾기.** 카드를 우클릭하고 **Add to favourites**를 선택하면 그리드 위 띠에 큰 타일이 생겨요. [즐겨찾기](/info/favourites.html)에서 이 띠를 다뤄요.
- <!--i:eyeoff--> **쓰지 않는 도구 숨기기.** 카드를 우클릭하거나 여러 개를 선택하고 **Hide tool**을 선택하세요. 그리드와 그리드에서 입력해 찾는 결과에서 사라져요. 끝에 있는 회색 **Show hidden tools (N)** 타일이 흐리게 처리된 채로 다시 보여주며, 각각의 메뉴에 **Unhide tool**이 있어요. 숨기기는 사용자의 그리드만 바꿔요. 링크나 북마크로는 도구가 여전히 열려요.
- <!--i:clock--> **내 도구를 먼저.** 서로 다른 도구 세 개에서 작업물을 저장하고 나면, 그리드 위의 **Yours** 칩 행이 즐겨찾기와 최근 도구를 앞에 보여줘요.
- <!--i:sliders--> **원하는 대로 배치.** **View options**로 레이아웃(**Grid**, **Card**, **List**), 카드 크기와 밀도, 정렬 순서, 카테고리 필터를 정해요.

![숨긴 도구가 드러난 Tools 그리드의 끝: 흐려진 Wordmark 카드와, 그 옆에 다시 보이게 토글한 회색 타일이 이제 Hide hidden tools로 표시돼요](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed the tile. The alt says so rather than quoting the resting
label the prose above already gives.
The recipe hides nothing itself. The lolly-demo catalog the captures pin
ships Wordmark hidden (`defaultHiddenTools` in its assets index.json), so a
fresh profile already has one hidden tool and the recipe only clicks the grey
reveal tile (`.gtile--hiddenbox`, confirmed in gallery.ts). It used to tick
the QR Code card and press the bulk bar's Hide button first; under lolly-demo
that published Wordmark dimmed and QR Code not, under a caption naming QR
Code, so the steps were dropped rather than relied on. QR Code was hidden
in that run too: the End scroll had left the pointer over its card, and a
hovered hidden card lifts its dimming (gallery.css), so it read as a normal
tool. The closing `hover:` puts the pointer back on the reveal tile, which
keeps every revealed card dimmed.
-->

**여러 카드에 한꺼번에 작업하기.** 각 카드의 체크박스를 선택하거나, 빈 공간에서 선택 상자를 끌거나, Shift/Cmd 클릭하면 해당 보기가 허용하는 동작이 담긴 막대가 나타나요.

- **Tools와 Utilities:** Favourite, Hide, Available offline, **View sessions**(Projects에서 해당 도구로 만든 세션만 표시), 카드 하나에 대한 Copy link.
- **Assets:** 모든 선택에 Favourite와 Hide. Duplicate, Download, Delete는 선택한 항목이 모두 직접 올린 것일 때만 나타나요. 공유 디자인 시스템 에셋은 영구 계약이기 때문이에요.
- **Projects:** [작업물 찾기와 복구](/info/find-your-work.html#find-something-you-saved)를 참고하세요.

![두 도구에 대한 갤러리 선택 바 - Available offline, View sessions, Favourite, Hide를 제공해요](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
<!--
SHOT NOTE (misc-bulkbar-gallery): drive targets `[data-select="qr-code"]` /
`[data-select="gradient"]` - the `.tile-check[data-select="<ref>"]` checkbox button
confirmed directly in views/gallery.ts's card markup (the same attribute
cardMarkup gives every tile), so these two clicks tick both cards without
opening either tool.

SHOT NOTE (misc-sessions-by-tool, NOT PUBLISHED): the "View sessions" result
had a recipe of its own (`/#/p?tools=qr-code,d3`, views/projects.ts's
toolsBodyHtml()), dropped here because it has no `drive=` that can
manufacture its own content - a saved session isn't a click away, it has to
already exist, and build-docs-shots.ts gives every shot a fresh
`browser.newContext()`. It would publish an empty list. Same dependency the
`projects` shot (now on find-your-work.md) carries; revisit if the pipeline gains a
storage-seeding hook.
-->

**View sessions**는 무언가 선택된 뒤에만 나타나요. 대신 선택되지 않은 카드 하나를 우클릭하면 **N saved sessions**를 제공하며, 그 도구의 저장된 세션 목록에서 삭제하면 세션이 휴지통으로 가요.

## 휴대폰에서

좁은 화면에서는 레이아웃이 한 열이 돼요.

- **컨트롤이 시트가 되어** 위에 놓이고 아래 가장자리에 끌기 손잡이가 있어요. 손잡이를 끌어 **peek**, **half**, **full**로 맞추거나, 탭해서 접고 펼치세요. 미리보기가 아래 공간을 채우고 편집하는 동안 계속 보여요.
- 떠 있는 **Export** 버튼이 내보내기 시트를 열어요. 형식, 크기, 복사, 저장, 다운로드가 한곳에 있어요. 배경을 탭하면 시트가 닫혀요.

![휴대폰 너비 화면의 도구 - 위쪽에 시트로 놓인 컨트롤, 그 아래 미리보기를 채운 생성된 팔레트, 그리고 아래 가운데에 떠 있는 렌더 알약 버튼](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Settings, 소리, 편안함

홈 화면 하단의 **Settings**에는 내 정보, 디자인 시스템, 접근성, 저장소, 오프라인 다운로드가 있어요. [Settings](/info/dashboard.html)가 모든 탭을 안내해요.

- **내 정보와 프로필 사진**은 이메일 서명이나 배지처럼 이를 쓰도록 만들어진 모든 도구에 채워져요. [프로필](/info/profile.html)에서 다뤄요.
- **접근성**에는 네 가지 편의 스위치가 있어요. **Reduce motion**, **Hide colourful previews**, **High contrast**, **Large text**예요. 작업물 주변의 앱을 바꾸며 도구 캔버스나 내보내기는 절대 바꾸지 않아요.
- **소리**는 사용자의 동작에 맞는 부드러운 보조 소리를 재생하고, **Neurospicy Mode**는 차분한 집중 트랙을 재생해요. 둘 다 **Settings → Accessibility**나 프로필 메뉴에서 켜기 전까지 꺼져 있어요.
- **Available offline**은 연결이 끊기기 전에 앱의 나머지, 도구, 카탈로그, 가이드를 내려받아요. Lolly는 설치할 수 있는 웹 앱이에요. 브라우저의 설치 버튼이나 휴대폰의 *Add to Home Screen*을 사용하면, 다시 온라인이 되었을 때 스스로 업데이트되는 전체 화면 앱을 얻어요.
- **Storage**는 Lolly가 이 기기에 보관하는 것을 보여줘요. [브라우저 데이터를 지우면](/info/find-your-work.html#if-you-clear-your-browser-data)에서 지울 때 제거되는 것을 설명하고, [개인정보 처리방침](/info/privacy.html)은 앱이 가져오거나 보내는 모든 것을 나열해요.

::: note 업데이트 후 보기가 로드되지 않을 때
업데이트 직후 빈 패널이나 "failed to fetch" 메시지가 나오면 보통 한 번 새로고침하면 해결돼요. 저장된 작업물, 세션, 디자인 시스템은 기기에 저장되어 있으므로 영향을 받지 않아요. 추가했지만 저장하지 않은 그림만 다시 추가해야 할 수 있어요.
:::

## 다음으로 갈 곳

- **[Design: 자유 캔버스](/info/design.html)**: 캔버스, 도형, 타임라인, 덱 발표를 다뤄요.
- **[Batch와 Multi-edit](/info/batch.html)**: 한 디자인의 여러 버전, 또는 저장된 여러 디자인의 동시 편집을 다뤄요.
- **[파일 내보내기](/info/exporting.html)**: 형식, 크기, 인쇄 단위, 투명도, 동영상 선택을 다뤄요.
- **[디자인 가져오기](/info/design-import.html)**: Figma, Penpot, Illustrator, InDesign 파일을 Design으로 가져와 계속 편집해요.
- **[템플릿](/info/templates.html)**: 도구의 저장된 출발점이에요.
- **[Wide Colour와 HDR](/info/hdr-editing.html)**: Design과 Darkroom에서 원본 이미지 정밀도를 유지해요.
- **[작업물 찾기와 복구](/info/find-your-work.html)**: 모든 것이 어디에 있는지, 다른 기기로 옮기는 방법을 다뤄요.
