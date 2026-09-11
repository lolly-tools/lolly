# Lolly 사용하기

앱을 실제로 *사용하는* 방법을 담은 실용 안내서예요 - 도구 열기, 캔버스 작업, 내보내기, 저장과 공유. 여기 나오는 모든 것은 **내 기기에서** 실행돼요. 계정도, 업로드도 없고, 처음 한 번 불러온 뒤로는 인터넷도 필요 없어요.

> 처음 오셨나요? [빠른 시작](/info/quickstart.html)으로 몇 분 만에 무언가를 만들 수 있고, [운영자를 위한 Lolly](/info/operators.html)는 앱 설치와 배포를 다뤄요. 이 페이지는 앱을 연 다음 다루는 방법에 관한 내용이에요.

## 도구 열기

홈 화면은 **갤러리**예요 - 모든 도구가 분류별로 묶여 있어요. 카드를 클릭하면 도구가 열리고, 전에 작업한 적이 있다면 **Continue** 버튼이 가장 최근 세션을 이어서 열어 줘요. 검색창으로 이름을 걸러 내거나, 여섯 개 목록 화면(갤러리, Utilities, Projects, Catalogue, Dashboard, Profile) 아래쪽 바에서 [검색](/info/search.html)하세요. 이 검색은 도구뿐 아니라 저장한 작업물과 카탈로그, 설정까지 찾아 줘요. 도구 안에서는 이 바가 물러나고 도구 자체의 조작 영역이 그 자리를 차지해요.

![도구 갤러리 - 모든 도구가 분류별로 묶인 카드로 나열된 모습](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&filename=gallery&try=1)

도구마다 화면이 둘로 나뉘어요. 한쪽에는 **컨트롤**, 다른 쪽에는 실시간 **미리보기**(캔버스)가 있어요. 컨트롤을 바꾸면 미리보기가 즉시 갱신돼요.

![도구의 분할 화면 - 왼쪽에는 컨트롤 스택, 오른쪽에는 실시간으로 그려지는 그룹형 막대 차트](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

> 일부 도구(예를 들면 **Design**)는 대신 **자유 캔버스**로 열려요 - 조작 틀이 없는 직접 조작 화면에서 텍스트와 도형, 이미지 상자를 끌고, 크기를 바꾸고, 돌리고, 맞물리게 놓고, 더블클릭해 그 자리에서 텍스트를 편집해요. 다른 모든 도구와 똑같은 렌더 경로로 내보내니, 캔버스가 *그대로* 파일이에요. 아래 [자유 캔버스](#the-free-canvas-design)를 참고하세요.

격자 자체를 원하는 모습으로 다듬는 방법은 두 가지예요:

- <!--i:star--> **자주 쓰는 것에 별을 다세요.** 카드에 ★를 달면 격자 위쪽 띠에 큼직한 전용 타일이 생겨요 - [즐겨찾기](/info/favourites.html)를 참고하세요.
- <!--i:eyeoff--> **한 번도 쓰지 않는 도구는 숨기세요.** 카드를 오른쪽 클릭하거나(여러 개를 골라 선택 바를 써도 돼요) → **Hide tool**을 고르세요. 격자에서 빠지고, 격자에서 타이핑해 찾는 결과에서도 빠져요. 맨 끝의 회색 **Show hidden tools (N)** 타일을 누르면 흐리게 다시 나타나고, 각 카드의 메뉴에 **Unhide tool**이 생겨요. 숨기기는 내 격자에만 해당돼요 - 저장한 링크나 즐겨찾기로는 그대로 열리고, 다른 사람에게는 있던 자리에 그대로 남아요.

![숨긴 도구가 드러난 Tools 격자의 끝부분 - 흐리게 표시된 QR Code Generator 카드와, 그 옆에서 카드를 다시 보이게 만든 회색 타일(지금은 Hide hidden tools로 표시)](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-bulk%3D%22hide%22%5D%3Bwait%3A300%3Bclick%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed it. The alt says so rather than quoting the resting
label the prose above already gives.
There is no standalone per-card "hide" button
(unlike the always-visible fav/pin corner icons) - Hide only exists inside a
tile's right-click menu or the bulk bar, both confirmed in views/gallery.ts.
The recipe goes the bulk-bar route since it needs no `|right` context-menu
step: tick the card (`[data-select="qr-code"]`, the same checkbox hook the
selection bullet under Projects uses), click the bar's Hide button
(`[data-bulk="hide"]` - the literal `data-bulk` value bulkBarHtml() writes,
confirmed in lib/bulk-bar.ts), then click the grey reveal tile
(`.gtile--hiddenbox`, confirmed in gallery.ts).
-->

### Ask Lolly

뒤지기보다 물어보고 싶을 때, **Ask Lolly**(`#/ask`)는 입력한 질문을 받아 이 문서에서 해당하는 부분을 **그대로** 돌려줘요 - 요약도 생성도 아닌 안내서 자신의 문장이에요 - 어느 페이지에서 왔는지 밝히고 그 옆에 **Open in docs** 링크를 붙여서요. 답변 아래에는 같은 질문에 걸리는 앱 안의 자리가 놓여요. 도구, 설정, 저장한 프로젝트가 각각 버튼이고, 누르면 그리로 이동할 뿐이에요.

대화 기록은 세션 단위 기억이에요. 이어서 물으면 실타래가 쌓여 가고, 새로 고치면 처음부터 다시 시작해요. 검색 결과 맨 아래에는 **Ask Lolly: *입력한 검색어*** 줄이 붙어요 - 다른 묶음이 찾아낸 구체적인 결과 아래에요 - 이 줄이 질문을 그대로 넘겨 주니, 검색 바에서 시작해 여기서 마무리할 수 있어요.

## 캔버스(미리보기)

미리보기는 언제나 내보내질 결과 그대로를 보여 줘요.

**데스크톱**

- **확대/축소:** Cmd/Ctrl-스크롤, 또는 트랙패드에서 손가락 모으기 - 포인터를 중심으로 확대돼요.
- **화면 이동:** **Space**를 누른 채 끌거나, **마우스 가운데 버튼**으로 끄세요. (일반 클릭은 디자인의 각 부분을 클릭하는 데 그대로 남겨 뒀어요.)
- **키보드:** `0` = 창에 맞추기 · `1` = 100% · `+` / `−` = 확대/축소.
- **줌 HUD:** 모서리에 있는 작은 `−  NN%  +  Fit` 컨트롤이에요. 퍼센트를 클릭하면 Fit ↔ 100%가 번갈아요.

![캔버스 모서리의 줌 HUD - 빼기, 실시간 퍼센트, 더하기, Fit, 그리고 테마와 소리 토글](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

**터치**

- **손가락 모으기**로 확대/축소, **끌기**로 화면 이동, **두 번 탭**으로 맞춤 보기로 되돌리기.

**클릭해서 해당 컨트롤로 건너뛰기:** 디자인의 아무 요소나 클릭하면 대응하는 사이드바 입력에 포커스가 가고 화면에 보이도록 스크롤돼요. 반복 행 묶음이라면 클릭한 바로 그 행이 펼쳐지니, 보이는 것을 고치는 데 한 번의 탭이면 충분해요.

크기를 바꾸면 보기가 언제나 깔끔한 맞춤 상태로 되돌아가요.

### 자유 캔버스(Design)

자유 캔버스 도구는 아트보드 *바깥*에 작업 공간을 더해요. 디자이너의 작업대처럼요:

- **캔버스 밖 대기 공간.** 상자를 프레임 밖으로 끌어내도 **완전히 보이고 선택할 수 있는** 상태로 남아요 - 구성을 짜는 동안 요소를 옆에 세워 뒀다가 다시 끌어 넣으세요. 프레임 바깥은 모두 **은은하게 흐려져서** 내보내기 영역이 한눈에 읽히고, 프레임에는 그림자가 남아 파일이 어디서 시작하는지 정확히 알려 줘요.
- **프레임 안쪽만 내보내져요.** 내보낸 파일의 경계는 아트보드예요 - 바깥에 남은 것(또는 가장자리에 걸친 상자의 일부)은 래스터든 벡터든 결과물에서 그대로 잘려 나가요.
- **Fit보다 더 축소**(20%까지)하면 프레임에서 멀리 떨어진 곳까지 세워 뒀을 때 작업대 전체를 볼 수 있어요.
- **크기를 바꿀 수 있는 아트보드.** 내보내기 크기를 바꾸면 프레임이 제자리에서 리사이즈돼요. 상자는 위치를 지키니, 기존 내용을 중심으로 레이아웃을 다시 잡을 수 있어요.

![Design의 자유 캔버스 - 아트보드와 그 주변의 페이스트보드](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

**선택 항목 뒤집기.** 아무 박스나 우클릭한 뒤 **Flip horizontal** 또는 **Flip vertical**을 선택하면 그 자리에서 좌우 또는 상하로 뒤집힙니다. 키보드로는 `Shift+H` / `Shift+V`를 누르면 됩니다 - Shift를 쓰는 이유는 단독 `V`가 포인터 도구이기 때문입니다. 선택한 각 박스는 자신의 축을 기준으로 실행 취소 한 단계 안에서 뒤집히며, 이 뒤집기는 실제 변형이므로 캔버스뿐 아니라 내보낸 SVG, PDF, PNG에도 그대로 유지됩니다.

### 직접 도형 그리기(펜)

상자와 원, 모서리가 둥근 프레임이면 대부분의 레이아웃은 해결돼요. 그 목록에 없는 도형이 필요하면 직접 그리세요. 도구 막대의 **Pen** 버튼(또는 `P` 키)을 누르면 그리기 모드로 들어가요. 모드 사이는 키 하나로 오가요 - **`V`**는 Pointer로 돌아가고, **`P`**는 Pen, **`N`**은 노드 도구(**Edit points**)예요 - 어떤 모드에 있든 빠져나오는 길은 언제나 Pointer예요.

![자유 캔버스의 도구 막대 - 끌기 손잡이, Lolly 메뉴, 그리고 Pointer, Add a box, Pen, Edit points, Line, Timeline, Artboards, Auto-arrange](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

- **클릭**해서 점을 놓으세요. 기본 곡선 유형에서는 **클릭한 채 끌면** 그 점의 핸들이 딸려 나오고, 이렇게 해서 모서리가 아닌 곡선을 그려요 - 클릭할 때 **Alt**를 누르면 대신 각진 모서리가 돼요. (다른 곡선 유형에서는 놓는 점이 모두 모서리라서 끌어도 아무 일도 일어나지 않아요. 아래 **Spline type**을 보세요.)
- 점을 놓는 동안 아트보드와 다른 상자에 맞물리면서, 평소 끌기와 똑같은 안내선이 그려져요. Alt를 누르면 그리는 동안에는 격자가, 나중에 점을 끄는 동안에는 격자와 가장자리가 함께 무시돼요.
- **첫 점을 클릭**하면 고리가 닫히면서 한 번에 끝나요. 그렇지 않으면 **Enter**를 누르거나 더블클릭하거나 그냥 도구를 바꾸세요 - 그린 것은 버려지지 않고 남아요.
- **Escape**는 한 칸씩 물러나요. 처음 누르면 그리던 것을 버리고 아무것도 남기지 않고, 한 번 더 누르면 펜에서 나와요.
- 그리는 중에 **Delete**를 누르면 마지막에 놓은 점이 지워져요.

결과는 캔버스 위의 평범한 상자예요. 옮기고, 크기를 바꾸고, 돌리고, 묶고, 정렬하고, 앞뒤 순서를 바꾸고, 채우기와 그러데이션, 그림자, 불투명도를 주세요 - 패스도 다른 상자와 똑같이 동작하고, 어느 컨트롤도 패스를 다르게 다루지 않아요.

색도 입혀진 채로 나와요. 처음 그린 패스는 브랜드가 패스에 지정해 둔 채우기와 선을 받고, 그다음부터 새 패스는 **마지막에 쓴 값**을 물려받아요 - 도형마다 다시 칠하는 대신 채우기를 한 번 정해 두고 계속 그리면 돼요. (브랜드가 패스에 관해 아무것도 정해 두지 않은 도구에서는, 그리는 동안 눈에 보이던 그 색으로 선이 그어지니 보이지 않는 일은 없어요.)

**점을 다시 편집하기.** 도형을 더블클릭하거나 개체 바의 **Edit points**를 쓰면 점이 다시 나타나요. 점을 끌어 옮기고, 핸들을 끌어 방향을 다시 잡고, 곡선 아무 데나 클릭해 점을 넣고, 여러 점을 올가미로 묶은 뒤 Delete를 눌러 선택한 점을 지우세요. 패스에는 점이 늘 최소 두 개는 남으니, 실수로 지워서 아예 없애 버릴 일은 없어요.

**Spline type**은 놓은 점들을 어떤 곡선이 지나갈지 정하고, 알아 둘 가치가 있는 선택이에요:

| 유형 | 하는 일 |
|---|---|
| **Smooth (auto)** | 기본값이에요. 핸들 길이를 스스로 계산하니, 클릭만 이어 가도 핸들과 씨름하지 않고 정말 매끄러운 곡선이 나와요. 핸들을 직접 잡으면 *방향*만 고정되고 길이는 곡선이 계속 맡아요. |
| **Bezier handles** | 고전적인 펜이에요. 핸들이 곧 제어점이고, 점을 넣어도 곡선은 움직이지 않아요. |
| **Through the points** | 놓은 모든 점을 정확히 지나가고, 핸들은 없어요. |
| **B-spline** | 점을 지나는 대신 그 곁을 흘러가서 더 부드러운 형태가 돼요. |
| **Straight lines** | 꺾은선이에요. |

이미 그린 패스를 핸들을 스스로 계산하는 유형으로 바꾸면 먼저 확인을 물어요. 직접 정한 핸들 길이는 되돌릴 수 없거든요 - **Bezier handles**로 바꾸는 것은 언제나 손실이 없어요. 그리는 도중에는 확인이 없어요. 바꾼 값이 곧바로 초안에 적용되고, 이미 끌어낸 핸들도 함께 사라져요. 핸들을 곡선이 맡는 유형에서는 점을 넣으면 곡선이 아주 살짝 달라지고, **Bezier handles**에서는 그렇지 않아요.

점마다 연속성 규칙도 있고, 캔버스에서는 점의 모양으로 알 수 있어요 - 네모는 **Corner**(핸들이 따로 움직여요), 동그라미는 **Smooth**(핸들이 일직선을 지켜요), 테두리 있는 동그라미는 **Symmetric**(일직선에 길이까지 같아요)이에요. 선택한 점에 규칙을 정하면 곡선이 곧바로 그 규칙에 맞춰 다시 그려져요.

![링크에서 곧바로 렌더링한 펜 패스 두 개 - 선으로 그린 S자 곡선과, 닫혀서 채워진 덩어리 도형](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

그린 패스도 다른 모든 것처럼 링크에 실려 다녀요. 그래서 직접 그린 도형은 공유 링크로 다시 열리고, CLI에서도 똑같이 렌더링돼요. 어느 것도 편집기에 기대지 않아요.

### 도형 합치기(패스 연산)

도형을 둘 이상 선택하고 캔버스를 **오른쪽 클릭**하면(터치에서는 두 손가락 탭) 드로잉 앱에서 기대할 만한 연산이 메뉴에 나와요:

- **Union**은 도형을 하나로 합치고, 맨 위 도형의 색을 따라요.
- **Subtract**는 위에 있는 것을 전부 맨 아래 도형에서 잘라 내요.
- **Intersect**는 겹친 부분만 남겨요.
- **Exclude**는 겹친 부분만 빼고 모두 남겨요.

도형 하나에 쓰는 연산도 셋 있어요. **Outline stroke…**는 선을 같은 윤곽의 채워진 도형으로 바꾸고(그린 굵기를 그대로 지키고 싶을 때 좋아요), **Offset path…**는 실루엣을 바깥으로 키우거나 음수를 넣으면 안쪽으로 줄이며, **Simplify**는 같은 모양을 더 적은 구간으로 다시 만들어요.

![Subtract로 만들어 낸 초승달과, 가운데가 진짜로 뚫린 고리](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=path-ops-boolean-result)

결과는 펜으로 계속 편집할 수 있는 새 패스예요. 구멍은 진짜 구멍이고, 선 패널의 **Fill rule** 컨트롤이 겹친 윤곽을 채울지(*non-zero*) 뚫을지(*even-odd*) 정해요.

이 연산이 일부러 하지 않는 일이 둘 있어요. 첫째, **망가뜨리는 대신 거절해요.** 겹치지 않는 두 도형을 교차시키려 하면 남길 것이 없다고 알려 주고, 아무것도 바뀌지 않아요. 둘째, 텍스트와 이미지 상자에는 다룰 윤곽이 없어서, 프레임으로 어림잡는 대신 그냥 두어요. 합쳐진 결과는 평범한 베지어 곡선으로 저장되는데, 드로잉 앱도 그렇게 해요 - 원래의 스플라인 유형은 연산을 넘어 살아남지 않아요.

## 타임라인(Sequence Studio)

![The timeline with the music clip selected: its strip runs along the bottom with Speed, Fades, Volume, Pan, EQ, Pitch, Normalize volume and the Effect slot](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dvideo%26_sel%3Dbed&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px!important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip)

**Sequence Studio**는 자유 캔버스에 *시간*을 더해요. 상자마다 시작 시점과 지속 길이를 갖고 들어오고 나가는 애니메이션을 붙일 수 있고, 아트보드 아래에 붙은 타임라인이 그것들을 배치하는 자리예요. 열어 보면 이미 시퀀스가 재생되고 있어요 - 제목 카드, 클립, 엔딩 카드, 하단 자막, 배경 음악까지 - 그래서 아무것도 바꾸기 전에 구조가 눈에 들어와요.

![시퀀스 스튜디오의 타임라인: 트랜스포트, 눈금자, 오버레이 레인, 클립과 이음매 칩이 있는 자석형 시퀀스 행, Always on 스트립](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

행에는 두 종류가 있고, 그 차이가 핵심 그 자체예요:

- **시퀀스 행**은 *자석*처럼 붙어요. 클립이 빈틈없이 줄줄이 놓이고, 하나를 끌면 구멍이 남는 대신 순서가 바뀌어요. 클립을 지우면 나머지가 붙어 메워요. 여기가 뼈대예요.
- **오버레이 레인**은 자유로워요. 하단 자막, 로고, 캡션처럼 뼈대 위에 각자의 시간으로 떠 있는 것은 저마다의 레인과 시작 시점을 가져요.
- 그 아래 **Always on**은 타이밍이 아예 없는 상자를 모아 둬요. 처음부터 끝까지 그냥 있는 배경 요소죠. 칩의 `+`를 누르면 하나를 레인으로 올리고, **Make always on**은 다시 내려보내요.

![편집 스테이지: 중앙의 아트보드, 왼쪽의 도구 레일, 모서리의 줌 HUD](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-stage)

타임라인을 열면 키보드가 타임라인으로 넘어가서, Space와 화살표 키가 페이지 대신 재생 헤드를 움직여요 - 이미 타이밍이 있는 구성에서는 타임라인이 알아서 열리니, Sequence Studio가 뜨는 순간부터 그래요.

> **[시퀀스 편집기](/info/sequence-editor.html)**는 시간 위에서의 편집이 예측 가능하게 느껴지는지를 좌우하는 네 가지를 더 깊이 다뤄요. 캔버스 클릭이 어느 클립을 편집하는지, 이웃 클립의 어니언 스킨 잔상, 분할 범위와 자른 것을 되돌리는 Join, 그리고 트리밍(키보드 조작 포함)이에요. 타임라인에 포커스를 둔 채 `?`를 누르면 단축키 목록이 나와요.

**편집.** 클립 가운데를 끌면 옮기거나 순서를 바꾸고, 양 끝에서 몇 픽셀 안쪽을 끌면 길이를 다듬고, **Split at playhead**(또는 `S`)를 누르면 클립 하나가 둘로 잘려요. 분할하려면 클립에 실제 **Length**가 있어야 하고 재생 헤드가 그 안쪽으로 조금 들어와 있어야 해서, 끝이 열린 클립(예를 들면 배경 음악)은 자를 수 없어요. **Snap to edges**는 기본으로 켜져 있고 클립 가장자리와 재생 헤드, 정수 초에 맞물려요. Alt를 누르면 무시돼요. 끌기 하나가 실행 취소 한 단계이고, 끄는 중의 미리보기가 확정과 똑같은 계산을 쓰니 끄는 동안 보이는 그대로가 결과예요.

클립을 선택하면 인스펙터가 같은 편집을 숫자로 내줘요. **Length**, **Trim in**(원본의 어느 지점부터 시작하는지), ×0.25에서 ×4까지 정해진 배수 중에 고르는 **Speed**, 길이까지 함께 정하는 **Animate in** / **Animate out**, 그리고 **Mute clip**이에요. 자석 행의 클립에는 **Start** 칸이 일부러 없어요 - 순서는 행이 맡으니, 옮길 때는 끌면 돼요.

**Transitions**는 키프레임이 아니라 프리셋이에요. Fade, Pop, Grow, Rise, Drop, 네 방향 Slide, Zoom in과 out, Tilt, Swoop, Spin, Drift, 그리고 **Cut (no animation)**이 있어요. 이동 거리는 개체 크기에 맞춰 조정되니, 같은 프리셋이 화면을 가득 채운 카드에서도 작은 배지에서도 제대로 읽혀요. 시퀀스 행에서 맞붙은 두 클립 사이에는 **이음매 칩**이 있어요. 칩을 클릭해 **Cut**이나 **Crossfade**를 고르면 곧바로 적용되고 닫혀요. 같은 칩을 다시 열면 **Length (ms)**를 바꾸고 **Done**을 누를 수 있어요. 크로스페이드는 앞 클립의 페이드 아웃과 뒤 클립의 페이드 인으로 저장되고, 내보내기가 그 한 쌍에서 실제 디졸브를 만들어 내요 - 그래서 크로스페이드가 미리보기에서는 페이드 두 개처럼 보이고 파일에서는 진짜 전환으로 나와요.

**소리.** **Audio** 클립을 넣으면 다른 클립과 똑같이 타임라인에 자리 잡아요. 파형이 보이고, 다듬고, 음소거할 수 있어요. (기본 세션에 딸려 오는 생성 배경음만 예외예요 - 내보낼 때 합성되기 때문에, 렌더링하기 전까지는 막대가 밋밋하고 소리도 나지 않아요.) 마이크를 누르면 카운트인과 레벨 미터와 함께 **보이스오버를 녹음**해 곧바로 타임라인에 올릴 수 있고, 녹음본은 시작한 지점에 내 자산으로 저장돼요. 그 옆의 카메라를 누르면 같은 방식으로 **영상을 녹화**할 수 있어요. 녹화하는 동안 테이크가 아트보드의 내보내기 크기에 맞춰 계속 잘리기 때문에, 작은 셀프뷰에는 재생 헤드 위치의 시퀀스에 그대로 들어갈 내용이 풀프레임으로 정확히 보여요 - 공유 링크로 동료의 클립을 받아 오는 방법이기도 해요. 음악과 대사, 클립 자체의 사운드트랙이 모두 내보낸 믹스에 담겨요. (내보내기 패널의 **Audio track**은 다른 것이에요. 클립 전체 아래에 깔리는 배경음 하나로, 페이드와 더킹이 붙어요. 둘은 함께 있을 수 있어요.)

**렌더링하기.** 모션 내보내기는 화면 녹화가 아니라 **결정적인 합성**이에요 - 프레임마다 정확한 시각에 디코딩되고 그려지고 인코딩되니, 파일이 내 기기가 따라오는지에 좌우되지 않고 MP4나 WebM에는 사실상 프레임 상한도 없어요. 길이를 직접 입력하지 않으면 타임라인 자체의 길이가 재생 시간이 돼요. Content Credentials는 다른 내보내기와 똑같이 새겨져요. 스틸로 내보내면 재생 헤드 위치의 프레임을 얻고, 출력 크기 옆 **Frames** 칸을 쓰면 통째로 컨택트 시트를 얻어요 - [내보내기](/info/exporting.html#stills-from-a-timed-composition)를 보세요.

염두에 둘 제한이 몇 가지 있어요. 시퀀스는 최대 한 시간이고, GIF와 애니메이션 PNG는 프레임을 쌓아 두기 때문에 짧게 유지되며, 속도가 ×1이 아닌 클립은 소리가 나지 않고(아직 타임 스트레칭이 없어요), **Record live**는 합성 경로가 더 낫기 때문에 여기서는 숨겨 뒀어요.

**프리셋을 넘어서: 키프레임, 깊이, 카메라.** 트랜지션은 클립이 들어오고 나갈 때 애니메이션을 적용해요. 클립 *안에서* 요소를 배치하려면 - 이동시키거나, 페이드하거나, 블러 처리하거나, 화면 밖으로 들어 올렸다가 다시 내려놓으려면 - 키프레임을 추가하세요: 클립을 선택하고 **+Keyframe**(타임라인 도구 모음의 다이아몬드, 캔버스 객체 바의 다이아몬드, 또는 `K`)을 누르면 재생 헤드의 위치가 다음 편집이 기록할 포즈를 결정해요. 같은 키프레임 시스템이 모든 타임드 컴포지션에 밀어 들어가고, 가로로 패닝하고, 초점을 당기는 **카메라**를 제공하며, 평면 SVG 하나를 층층이 넘나들 수 있는 레이어 스택으로 바꿔줘요. **[애니메이션 만들기](/info/animating.html)**가 전체 가이드예요.

Design 도구에도 같은 타임라인이 있어요. 그래서 다른 도구로 옮기지 않고도 레이아웃에 시간을 입힐 수 있고, 모션으로 내보내기도 해요.

## 발표하기

![The inspector's Document section: Voice, Blend with, Speed, Lead-in, Tail and Show captions when presenting](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

**아트보드**로 이루어진 Design 문서는 그 자체로 이미 슬라이드 덱이에요. 도구 막대의 **Lolly menu**를 열고 맨 아래 줄의 **Present**를 고르면, 캔버스에 놓인 순서 그대로 아트보드마다 전체 화면 슬라이드가 돼요. 덱은 렌더링된 아트보드의 사본으로 돌아가니 아래의 편집기는 전혀 건드리지 않고, 나가면 있던 자리로 정확히 돌아와요.

- **Space**, `→`, **Page Down** 키 또는 화면 오른쪽 가장자리의 스트립을 클릭하면 **다음으로 넘어가고**, `←`, **Page Up** 키 또는 왼쪽 가장자리의 스트립을 클릭하면 되돌아가요. **Home**과 **End**는 각각 첫 슬라이드와 마지막 슬라이드로 이동해요. 포인터를 움직이면 작은 컨트롤 바가 나타났다가 멈추면 다시 사라져요.
- **개요 보기**(`O` 또는 그리드 버튼)는 캔버스에서 배치한 순서 그대로 모든 아트보드를 한 번에 늘어놓아요. 하나를 클릭하면 열려요.
- **단계 공개.** 박스를 우클릭해 기본값인 **항상 표시** 대신 **1단계에서 공개**, **2**, **3** 중 하나를 선택하세요. 그러면 해당 박스는 자신의 단계로 넘어갈 때까지 기다리므로 슬라이드가 여러 조각으로 나뉘어 등장할 수 있고, 같은 번호를 공유하는 박스는 함께 등장해요.
- **발표자 보기**(`S`)는 현재 슬라이드, 다음 슬라이드, 해당 슬라이드의 메모, 진행 시계를 담은 두 번째 창을 열어요. 브라우저가 팝업을 막으면 덱 위에 패널로 대신 표시돼요. 메모는 아트보드마다 설정되며 슬라이드 자체에는 절대 나타나지 않아요.
- `B`는 검은 화면을 유지하고(아무 키나 누르면 슬라이드로 돌아와요), `F`는 전체 화면으로 되돌리고, **Escape**는 한 번에 한 단계씩 벗겨내요: 개요 보기는 덱으로, 덱은 에디터로요.
- **키오스크.** 아트보드에 **Length**를 지정하면 덱이 그 시간만큼 머물다가 얇은 진행 표시줄 뒤에서 스스로 다음으로 넘어가요; `K`(또는 무언가에 Length가 지정된 뒤에만 나타나는 일시정지 버튼)로 멈추고 다시 시작할 수 있어요. 링크에 `kiosk`를 추가하면 덱이 끝에서 처음으로 되돌아가는데, 이것이 바로 사이니지가 되는 지점이에요.

덱은 링크이기도 해요. `?present`는 곧장 덱으로 열고, `s=`는 슬라이드를 지정하며(위치, 아트보드 id, 또는 등장 단계까지 지정하는 `id.step`), 이동할 때마다 주소가 갱신되니 보내는 링크가 곧 지금 보고 있는 슬라이드예요. 도구 제작자를 위해: 이 매개변수는 [URL 모드](/info/url-mode.html#reserved-parameters) 페이지에 정리돼 있어요.

## 휴대폰에서

좁은 화면에서는 레이아웃이 한 열로 다시 흘러요:

- **컨트롤이 위쪽 시트**가 되고 아래쪽 가장자리에 **끌기 손잡이**가 붙어요. 손잡이를 끌어 크기를 조절하면 **peek / half / full**에 맞물리고, 손잡이를 **탭**하면 접힘 ↔ 펼침이 번갈아요. 미리보기는 그 아래 공간을 채우고 편집하는 동안 계속 보여요.
- 떠 있는 **Export** 버튼을 누르면 내보내기 시트가 열려요. 형식과 크기, 복사, 저장, 다운로드 컨트롤이 한자리에 다 있어요. 배경을 탭하면 닫혀요.

![휴대폰 너비 화면의 도구 - 위쪽에 시트로 놓인 컨트롤, 그 아래 미리보기를 채운 생성된 팔레트, 그리고 아래 가운데에 떠 있는 렌더 알약 버튼](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## 컨트롤(입력)

도구는 달라져야 하는 입력만 드러내요 - 나머지(색, 레이아웃, 타이포그래피, 로직)는 도구 제작자가 고정해 두기 때문에, 무엇을 만들든 제작자가 정한 규칙을 지켜요. 입력에는 텍스트, 슬라이더, 색 선택기, 드롭다운, 날짜, 이미지 선택기, 반복 행 묶음이 있어요. 일부는 접을 수 있는 구역으로 묶여 있어요.

![도구의 컨트롤 묶음 - 텍스트 칸과 색 버튼, 슬라이더뿐이고 나머지는 제작자가 고정해 뒀어요](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**초기화:** *Clear changes*는 모든 입력을 기본값으로 되돌려요.

### 실행 취소와 다시 실행

**Cmd/Ctrl-Z**는 한 단계 되돌리고, **Cmd/Ctrl-Shift-Z**(또는 **Cmd/Ctrl-Y**)는 다시 앞으로 나아가요. 같은 짝이 컨트롤 위쪽 줄에 **Undo**와 **Redo** 버튼으로 놓여 있고(자유 캔버스에서는 도구 막대에 있어요), 되돌릴 것이 없으면 각각 흐려져요. 단계마다 그것이 무엇이었는지 알려 줘요. 색을 되돌리면 방금 복원한 입력의 이름을 담은 짧은 안내가 뜨고, 그 안의 **Redo** 버튼이 돌아가는 길이에요.

- **끌기 하나가 한 단계예요.** 같은 컨트롤을 0.5초 안에 반복해 바꾸면 하나로 합쳐지니, 슬라이더를 끝에서 끝까지 끌어도 실행 취소는 이백 번이 아니라 한 번이에요.
- **최근 100단계가 보관돼요** - 그보다 오래된 것은 밀려나요. 되돌린 뒤에 새로 편집하면 앞으로 갈 기록이 지워지는데, 이건 어디서나 마찬가지예요.
- **텍스트 상자에 커서가 있는 동안**에는 Cmd/Ctrl-Z가 그 칸의 몫이라 글자 단위로 되돌아가요. Lolly는 쓸 만한 자체 실행 취소가 없는 컨트롤, 즉 슬라이더와 드롭다운, 색, 스위치를 맡아요.
- **file** 입력에서 **파일을 고르는 것**은 한 단계가 아니에요. 그 바이트는 세션 동안만 들고 있어서 되돌릴 것이 없거든요.

실시간 [협업](/info/collaborate.html) 중에도 히스토리는 오직 나만의 것으로 유지돼요. 다른 기기에서 들어온 변경 사항은 절대 내 스택에 올라가지 않으므로, 실행 취소는 언제나 내가 한 작업만 되돌릴 수 있어요.

## 내 정보와 프로필 사진

**Profile**(갤러리 오른쪽 위)에는 이름과 연락처, 그리고 원한다면 **프로필 사진**이 담겨요. 그 항목을 요구하는 도구는 자동으로 미리 채워 줘요 - 한 번만 정해 두면 이메일 서명과 로고 조합, 명찰이 알아서 채워져요. 세션마다 어느 항목이든 덮어써도 돼요. **Use my details to create**를 켜면 내 정보가 내보낸 결과물에 작성자로 함께 실려요.

프로필 사진과 정보는 **이 기기에만** 있어요. 프로필은 나 자신만이 아니라, 팀이나 가끔 맡는 역할일 수도 있어요. 여러 개를 두는 방법까지 포함한 전체 그림은 **[프로필](/info/profile.html)**을 보세요.

## 저장하고 이어서 하기

**Save**를 클릭하면 지금의 입력이 그 도구의 세션으로 저장돼요. 도구마다 이름 붙인 세션을 여러 개 둘 수 있고, 각 도구의 **Continue** 버튼은 가장 최근 것을 다시 열며, **기록 버튼**(오른쪽 위, 프로필 옆)은 모든 도구에 걸쳐 저장된 세션을 전부 보여 줘요. 세션은 기기 안에만 있어요. 정리하려면 아래의 **Projects**를 여세요.

![반씩 나뉜 렌더 알약 버튼 - 내보내기 패널을 여는 위쪽 화살표와, 세션을 그 자리에 저장하는 체크 표시](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

## Projects

**Projects**는 저장한 모든 것의 집이고 파일 관리자처럼 동작해요 - **Tools** 옆의 **Projects** 탭이나 **Profile → Storage → Organise in Projects**에서 열 수 있어요:

![Projects - 저장한 세션이 겹겹이 넣을 수 있는 폴더로 정리된 모습](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)

- <!--i:folder--> **겹겹이 넣는 폴더.** 저장한 세션을 폴더로 묶고, 폴더 안에 폴더를 원하는 만큼 깊이 넣으세요. 폴더를 만들고 이름을 바꾸거나, 타일을 다른 폴더 위로 끌어 옮기세요. 이동 경로가 위로 되돌아가는 길을 안내해요. 늘 자리를 지키는 **Uncategorised** 폴더에는 아직 정리하지 않은 것이 담겨요.
- <!--i:clock--> **원하는 방식으로 정렬.** **View & sort**에는 **Name**, **Date added**, **Last modified**(기본값)가 있고, 폴더 안에서는 **By tool**도 있어요. 어떤 정렬이 켜져 있든 폴더가 언제나 먼저 오고, 정렬은 각자의 묶음 안에서 세션과 폴더의 순서만 정해요.
- <!--i:document--> **새 작업을 바로 정리해 넣기.** **New asset**(최상위에서는 "Start a fresh creation", 폴더 안에서는 "Add to *folder*")은 도구를 열고 그 첫 저장을 해당 폴더에 자동으로 넣어요.
- <!--i:checklist--> **다중 선택(데스크톱).** 타일의 체크박스를 켜거나, 빈 곳에서 선택 상자를 끌거나, **Shift/Cmd-클릭**하세요. 타일을 **오른쪽 클릭**하면 컨텍스트 메뉴가 나와요. 그런 다음 선택 전체에 한 번에 적용하세요 - 같은 동작과 같은 떠 있는 실행 바가 여기뿐 아니라 Tools 갤러리와 Utilities, Catalogue, Projects에서 모두 통해요.
- <!--i:download--> **폴더나 선택 전체를 렌더링.** **Render folder**는 폴더 안에 저장된 모든 세션을 하위 폴더까지 포함해 하나의 중첩된 `.zip`으로 내보내요. **Render selection**은 어떤 다중 선택에도 같은 일을 하고, 세션 하나는 곧바로 자기 파일로 렌더링돼요. Batch나 Pro는 필요 없어요.
- <!--i:link--> **어떤 도구로 저장한 작업으로 바로 가기.** Tools 갤러리에서 도구를 하나 이상 고르고 선택 바에서 **View sessions**를 누르면, 그 도구로 만든 세션만 보이는 Projects가 열려요. **Clear**를 누르면 전체 보기로 돌아와요.
- <!--i:link--> **저장한 세션 공유하기.** 세션을 오른쪽 클릭 → **Share link**를 누르면 똑같은 입력으로 다시 열리는 링크가 복사돼요(아래에서 설명하는 전체 Share 대화상자예요).

![Projects의 View and sort 팝오버가 열린 모습 - 테마 줄, Preview 또는 List를 고르는 View, 그리고 Sort 아래의 Name, Date added, Last modified](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
<!--
SHOT NOTE (misc-projects-sort): trigger button confirmed as
`.filter-fab.projects-viewopts` in views/projects.ts (openViewOpts() is bound
to `.projects-viewopts` specifically) - `.projects-viewopts` alone is the
more specific hook, so that's what drives the click. The popover it opens
(`.projects-viewmenu`, also confirmed directly in openViewOpts()) is body-
appended, not nested under the Projects root, so cropSelector finds it
regardless. "By tool" only appears inside a folder - this recipe captures at
the Projects ROOT (`url=/#/p`), so if the capture pass wants "By tool"
visible too, point url= at a real folder instead: the route is a path
segment, `/#/p/<folderId>` (confirmed in main.ts's hash router - `parts[0]
=== 'p'` reads `folderId` from `parts[1]`), not a query param. Caveat: a
folder has to already EXIST in the capture profile, which a per-shot fresh
context has none of.
Also: the popover is not sort-only. openViewOpts() writes a theme segment, a
"View" pair (Preview / List) and a sound segment around the Sort rows, so the
alt text names them - do not re-caption this as "the sort menu".
-->

**선택 바가 무엇을 내주는지**는 보기마다 조금씩 달라요. 모든 동작이 어디서나 말이 되는 건 아니니까요:

- **Tools / Utilities:** Favourite(또는 Unfavourite), Hide(또는 Unhide), Available offline(또는 Remove from offline), **View sessions**(위에서 설명한 건너뛰기), 그리고 카드가 정확히 하나만 선택됐을 때의 Copy link예요.
- **Catalogue:** Favourite와 Hide는 어떤 선택에도 적용돼요. Duplicate와 Download, Delete는 선택한 항목이 모두 내가 올린 것일 때만 나타나요 - 공유된 디자인 시스템 자산은 영구적인 약속이라, 한꺼번에 처리할 때조차 이 셋은 붙지 않아요.
- **Projects:** **Render selection**, **Move to…**, **New folder**, **Delete**, 한 도구의 세션을 두 개에서 여덟 개까지 골랐을 때의 **Edit together**(하나로 합친 사이드바 아래에 나란히 열어 줘요), 그리고 선택 전체를 대신 배치 격자의 행으로 여는 **Edit as sheet**가 있어요. 마지막 것은 **개수 제한이 없고** 세션이 같은 도구에서 왔는지도 따지지 않으니, 선택이 Edit together의 2~8개보다 크거나 더 뒤섞였을 때의 비상구예요.

> 이름 때문에 헷갈리기 쉬운 지점 하나. **View sessions**는 무언가 *선택된* 뒤에만 있어요. 선택하지 않은 카드 하나를 오른쪽 클릭하면 대신 **N saved sessions**가 나오는데, 이건 Projects로 이동하는 대신 그 도구의 기록 대화상자를 열어요.

![Tools 갤러리에서 도구 카드 두 개가 선택된 상태이고, 떠 있는 선택 표시줄에 2 selected라고 표시되며 Available offline, View sessions, Favourite, Hide가 제공돼요](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery)
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
`projects` shot above already carries; revisit if the pipeline gains a
storage-seeding hook.
-->


## 작업물 공유하기

디자인이 밖으로 나가는 길은 둘 중 하나예요. 링크로, 또는 파일로요. Share 대화상자가 둘 다 내줘요. 내보내기 컨트롤의 **Share**로 열고, Projects에서 저장한 세션의 **Share link**를 누르면 그 세션에 대해 같은 대화상자가 열려요.

### 링크

모든 입력이 페이지 URL에 담기니, 링크가 *곧* 디자인이에요. 대화상자 맨 위에는 바로 복사할 수 있는 링크가 있고, 그 아래에 접힌 구역이 둘 있어요.

- **Link options**에는 **Shortest link**(큰 디자인은 URL이 길어지니, 상태 전체를 작은 토큰으로 담고 글자 수가 얼마나 줄었는지 보여 줘요. 읽을 수 있는 형태도 언제나 함께 있어요), **Password-protect this link**(링크 전체에 AES-256을 씌우고, 비밀번호는 링크에 담기지 않아요), **Pin this tool version**(지금 보고 있는 도구 버전에 링크를 못 박는 `_v` 플래그로, 나중에 업데이트돼도 렌더 결과가 바뀌지 않아요)이 있어요.
- **Link behaviour**는 받는 사람이 링크를 열었을 때 무슨 일이 일어날지예요. 전체 화면, 내보내기 패널이 이미 펼쳐진 상태, `&export`로 열자마자 다운로드하기, `&copy`로 클립보드에 복사하기요.

링크를 동료에게 붙여넣거나, 즐겨찾기에 넣거나, 저장소에 커밋하세요. (자세한 내용: [URL 모드](/info/url-mode.html).)

**어떤 도구는 링크 자체가 곧 완성된 제품이에요.** Jump Page는 여러 링크를 나눠줄 페이지 하나로 모아줘요 - 바이오 링크, 컨퍼런스 발표, 매장 소개 페이지 등이에요. 호스팅할 것도 없고 뒤에 계정도 없어요: 페이지가 곧 링크이므로 URL이 도달하는 속도만큼 빠르게 열려요. 편집기에서는 완성된 페이지를 입력 필드 옆에서 볼 수 있고, 링크를 여는 방문자는 전체 너비로, 스크롤할 때마다 장면당 링크 하나씩 보게 돼요.

![편집기에서 본 Jump Page - 제목, 각각 고유한 색조를 가진 세 개의 링크 장면, 그리고 Made with Lolly 푸터가 캔버스 안에 하나의 페이지로 배치돼 있어요](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

**링크가 담을 수 없는 것은 대화상자가 말해 줘요.** URL에 들어가지 못하는 것이 셋 있어요. 이 기기에서 추가한 이미지나 파일, 아주 긴 텍스트 값, 아주 큰 목록이에요. 링크를 만들면서 각각을 세어 둬요. 빠뜨릴 수밖에 없는 것이 있으면, 그림이 빠진 채 열리는 링크를 건네는 대신 무엇이 빠졌는지 짚어 주고 아래의 파일 쪽으로 안내해요. 단지 *길기만* 한 링크에는 글자 수와 함께 더 가벼운 안내가 붙어요. 길이는 압축으로 아직 구할 수 있으니까요.

### .lolly 파일

작업 중인 도구의 Share 대화상자에 있는 **Download .lolly**는 같은 디자인을 파일로 써 내요. 저장한 세션과 함께 내 기기에서 추가한 이미지와 파일까지 담아요. 디자인이 끌어다 쓰는 카탈로그 자산도 안에 함께 실리니, 내 브랜드를 한 번도 본 적 없는 기기에서도 파일이 온전하게 열려요. 기기에 공유 시트가 있다면 **Send to…**가 그 파일을 디스크에 저장하는 대신 곧바로 건네줘요(AirDrop이나 Android 공유 등).

`.lolly`는 평범한 zip이에요. 이름을 `.zip`으로 바꿔 열어 보세요. 내가 올린 이미지는 `assets/uploads/`에, 카탈로그 자산은 `assets/catalog/`에 각각 원래 이름과 확장자 그대로 들어 있고, `manifest.json`이 전부를 목록으로 담고 있으며, 맨 위의 README가 이 파일이 무엇인지 말해 줘요.

나가기 전에 직접 정할 것이 셋 있어요:

- **내 이름 포함 여부.** 이름, 이메일, 소속 조직은 프로필에서 **Use my details to create**가 켜져 있을 때만 파일에 기록됩니다. 꺼져 있으면 파일에는 Lolly로 언제 만들어졌는지만 남고 당신에 대한 정보는 남지 않습니다.
- **라이선스 아트 포함 여부.** 라이선스가 걸려 있거나 브랜드에 잠긴 에셋은 기본적으로 제외됩니다. 디자인에 그런 에셋이 있으면 대화상자에 몇 개인지 표시되고 두 가지 버튼 중 하나를 선택할 수 있습니다 - *Download without them* 또는 *Include and download* - 포함하면 `.lolly`를 여는 사람에게 실제 파일이 넘어가기 때문입니다.
- **도구 포함 여부.** **Include the tool**을 선택하면 도구 자체의 파일이 디자인과 함께 패키징되어 그 도구가 없는 기기에서도 열립니다. 커스텀 도구 - 수신자가 갖고 있을 가능성이 낮은 포크나 비공개 브랜드 도구 - 는 기본적으로 체크되어 있고, 서명된 카탈로그에 등재된 도구는 상대방도 같은 출처에서 받으므로 기본적으로 체크되어 있지 않습니다. (서명된 카탈로그가 없는 빌드에서는 모든 도구가 커스텀으로 취급되어 체크박스가 처음부터 켜져 있습니다.)

**파일 열기.** 앱에 `.lolly` 파일을 놓으면: 애셋은 라이브러리로, 세션은 프로젝트로 들어가고 도구가 그 세션을 열어요. 기존 항목은 아무것도 덮어쓰지 않아요: 세션은 새로 저장된 슬롯으로 도착하고, 이 기기에 이미 있는 애셋은 체크섬으로 대조해 중복 생성 없이 재사용돼요. 모든 부분은 들어오는 과정에서 파일 자체의 체크섬으로 검사되므로, 전송 중 손상된 사본은 절반만 가져오는 대신 거부돼요.

파일에 내게 없는 도구가 실려 있으면, Lolly는 그 도구가 실행되기 전에 먼저 물어요. **Trust this tool?**은 도구 이름과 제작자를 밝히고, 이것을 열면 도구 자체의 코드가 내 기기에서 실행된다고 분명하게 말해 줘요. 계속하는 길은 **Trust & install**이에요. 거절해도 공유받은 작업물은 프로젝트에 저장돼서, 그 도구를 추가하는 날까지 거기서 기다려요. (아직 곁에서 설치할 수 없는 도구가 한 종류 있어요. 코드가 모듈로 배포되는 도구인데, 같은 방식으로 돌려보내져요.)

링크와 파일은 둘 다 어느 한 시점의 사본을 건네줘요. 다른 사람과 같은 세션을 *동시에* 작업하려면 - 기기 두 대, 서버 없이, 같은 네트워크에 있다면 인터넷도 필요 없이 - [함께 작업하기](/info/collaborate.html)를 보세요.

## 실시간 카메라(움직임에 반응하는 도구)

사진 **Filter** 도구는 모두 - Halftone, Scanline, Posterize, Voronoi cells, Colour treatment, Pixel stretch, Imperfections - 카메라를 쓸 수 있는 곳에서 **Go live** 버튼을 보여 줘요. 켜면 효과가 웹캠을 프레임 단위로 따라가며 움직임에 반응하고, 그 결과를 GIF나 WebM, MP4로 녹화할 수 있어요. 프레임은 **내 기기에서** 읽히고 처리되며 절대 밖으로 나가지 않고, 멈추거나 도구를 떠나는 순간 카메라가 풀려요. (어떤 이미지 선택기에도 **Take a photo**가 있어서 한 프레임을 기기 안의 이미지로 담을 수 있어요.)

## 내 이미지

도구에서 내 기기의 이미지를 추가하면 들어온 그대로 보관돼요 - 그래서 거기에 붙은 Content Credential도 그대로 검증돼요 - 그리고 개인 **My images** 라이브러리(**Profile → Storage** 아래)에 저장돼요. 정말로 큰 파일일 때만 그대로 둘지 크기를 줄일지 물어봐요. 어느 도구에서든 다시 쓰세요. 들어오는 이미지에서 EXIF/GPS를 지우려면 프로필에서 **Strip metadata from uploads**를 켜세요. 개수 제한은 없어요. 라이브러리는 전부 로컬이고 기기의 저장 공간만이 한계예요 - 이미지 관리와 삭제도 거기서 해요.

## 카탈로그 - 내 자산 라이브러리

**Catalogue**(`#/c`, 또는 모든 목록 화면 위쪽에 있는 Projects · Tools · Utilities · Catalog 전환기의 **Catalog** 칸)는 도구가 끌어다 쓸 수 있는 모든 것을 모아 둬요 - 브랜드 로고, 이미지, 오디오, 모션이 종류별로 묶여 있어요 - 그리고 **내가 만든 파일**도 여기에 살아요. 서버도, 관리 콘솔도, 풀 리퀘스트도 없어요. 전부 내 기기 안에 있어요.

![카탈로그 - 브랜드 자산과 색 견본, 글꼴, 그리고 내가 올린 파일](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=catalogue)

- <!--i:upload--> **파일을 가져오세요.** 이미지, SVG, 오디오 클립, 동영상, Lottie, PDF, PowerPoint 덱을 업로드 영역에 드래그하거나 - 클릭해서 선택하면 - 즉시 카탈로그에 도착해 모든 도구의 애셋 선택기에서 바로 사용할 수 있어요. 여러 페이지의 PDF나 `.pptx`는 유지할 페이지나 슬라이드를 물어보고, 각각이 SVG 애셋이 돼요. 원하는 만큼 가져오세요. 기기 밖으로 나가지 않아요.
- <!--i:star--> **자주 쓰는 항목을 즐겨찾기하세요.** 애셋(또는 브랜드 색상 견본)에 ★를 표시하면 모든 선택기 맨 위에 고정되어, 자주 쓰는 로고나 색상을 클릭 한 번으로 사용할 수 있어요.
- <!--i:folder--> **정리하세요.** 애셋을 다른 그룹으로 다시 분류하거나, 사용하지 않는 공유 브랜드 애셋을 숨기거나(**Show hidden**(숨긴 항목 표시)으로 다시 불러올 수 있어요), 직접 업로드한 항목을 완전히 삭제할 수 있어요. Projects와 같은 다중 선택 제스처와 플로팅 작업 표시줄을 여기서도 사용할 수 있어서, 선택한 전체 항목에 한 번에 적용할 수 있어요.
- <!--i:layers--> **동영상에서 배경을 제거하세요.** 애셋 선택기에서 동영상의 세부 정보를 열거나 카드를 오른쪽 클릭해 **Remove background…**(배경 제거…)를 선택하면 투명 버전을 저장할 수 있어요 - 실제 알파값을 가진 애니메이션 WebP 또는 PNG예요. **Method**(방법)를 선택하세요: **On-device model**(온디바이스 모델)은 복잡한 장면에서 피사체를 오려내고, **Colour key**(컬러 키)는 그린 스크린이나 단색 벽처럼 조명이 고른 단색 배경을 제거하며, **Tolerance**(허용 오차), **Softness**(부드러움), **Spill removal**(번짐 제거)로 경계를 다듬을 수 있어요. 컬러 키는 모델 다운로드도 네트워크도 필요 없어서 **Remove background**(배경 제거)는 모든 동영상에서 제공되며, 깔끔하게 촬영된 영상에서 더 좋은 결과를 낼 때가 많아요. **Resolution**(해상도) 설정(360, 480, 720 또는 1080p, 원본을 넘지 않음)은 화질과 더 작고 빠른 파일 사이에서 절충할 수 있게 해줘요. 이 작업은 기기에서 백그라운드 작업으로 실행돼요. 완성된 오려내기는 원본 옆에 별도의 애셋으로 저장되고, 원본 동영상의 Content Credential이 재료(ingredient)로 함께 따라가요. (배경 제거가 왜 평범한 편집으로 유지되는지는 [한 번 생성하면 똑같이 렌더링](/info/ai-features.html)을 참고하세요.)

### 팔레트와 글꼴을 어디로든 가져가기

카탈로그의 **Swatches** 패널은 보여 주기만 하지 않아요 - 색을 클릭하면 복사되고, 다른 도구가 알아듣는 형식으로 **브랜드 팔레트 전체를 내려받을** 수도 있어요:

- <!--i:code--> **디자인 토큰(JSON)**, **CSS 변수** 또는 **CSS 클래스** - 브랜드를 스타일시트나 빌드에 그대로 넣으세요;
- <!--i:palette--> **Adobe Swatch Exchange (.ase)** - Illustrator나 Photoshop으로 불러오세요;
- <!--i:pentool--> **GIMP palette (.gpl)** - GIMP나 Inkscape용이에요.

![Swatches 패널 - 위쪽에 늘어선 다섯 개의 팔레트 다운로드 버튼과, 그 아래 복사할 수 있는 칩으로 놓인 모든 브랜드 색](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

**Fonts** 패널은 브랜드 글꼴을 나열하고 각각 옆에 **download**를 두어, 기기에 설치하거나 인쇄소에 건넬 수 있게 해요. ([Brand Studio](/info/brand-studio.html)의 Colours 방에서도 같은 팔레트 다운로드를 제공해요.)

자산은 열려 있는 직접 만들기 경로의 한쪽이고, 다른 한쪽은 **직접 도구 만들기**예요 - 위에서 설명한 자유 캔버스(Design)로 코드 없이 눈으로 보며 만들 수 있어요.

## 소리와 접근성

Lolly는 누구에게나 편안하게 쓰이는 것을 목표로 해요. 인터페이스는 키보드로 이동할 수 있고, 맞춤 컨트롤에는 화면 낭독기를 위한 제대로 된 레이블이 붙으며, 모든 도구의 실시간 미리보기는 무엇을 만들고 있는지 설명하는 레이블이 달린 하나의 이미지로 노출돼요.

은은한 **보조 사운드**가 방금 한 일을 확인해 줘요 - 갤러리에 도착할 때, Content Credentials 검사가 유효하거나 유효하지 않을 때, 패널을 닫을 때, 필터를 바꿀 때요. 기본값은 **꺼짐**이에요. 스위치가 보이는 곳(각 화면의 옵션 팝오버나 **Profile**)에서 **Sound**를 켜면 그 선택이 기억돼요.

직접 켜는 편의 설정 네 가지가 **Profile → Accessibility**에 있어요. **Reduce motion**(앱의 전환과 장식 효과를 걷어내요), **Hide colourful previews**(갤러리 카드를 아이콘과 글자만으로 차분하게, 프로젝트 미리보기도 조용하게 만들어요), **High contrast**(테두리와 글자, 포커스 테두리를 더 진하게 해요), **Large text**(레이블과 메뉴, 버튼 글자 등 앱 글씨를 크게 해요)예요. 네 가지 모두 작업물 *주변*의 앱을 가라앉힐 뿐이에요. 도구 캔버스 안으로는 절대 들어가지 않고 내보낸 결과물의 픽셀도 바꾸지 않으며, 켜기 전까지는 각각 꺼져 있어요. 자세한 내용은 [내 프로필 → 접근성](/info/profile.html#accessibility)에 있어요.

Sound 스위치 옆에는 **Neurospicy Mode**가 있어요 - 일하는 동안 조용히 흐르는, 선택 사항인 차분한 집중용 배경 음악이에요. 켜면 화면 아래 모서리에 작은 **플레이어 독**이 열려 앱 어디를 가든 따라와요. 거기서 트랙을 검색해 고르고, 앞뒤로 건너뛰고, 볼륨을 정하고, 최소화하거나 닫을 수 있어요. 트랙 목록은 몇 갈래를 아울러요. 절차적으로 만들어지는 *Lolly Sings* 곡, 앰비언트 루프와 비트, 직접 올린 오디오, 그리고 몇몇 실시간 인터넷 **라디오** 방송이에요(라디오는 연결이 필요하고, 나머지는 오프라인에서도 재생돼요). 기본값은 **꺼짐**이고, Sound와 마찬가지로 세션과 기기를 넘어 기억돼요. Sound를 끄면 집중용 트랙도 함께 음소거돼요.

## 저장 공간과 개인정보

모든 것이 브라우저의 로컬 데이터베이스(IndexedDB)에 저장돼요. 프로필, 저장한 세션, 올린 이미지, 내려받은 카탈로그 콘텐츠의 캐시까지요. **Profile → Storage**는 사용량을 보여 주고 다음을 할 수 있게 해 줘요:

- <!--i:box--> **Clear cache** - 내려받은 카탈로그 콘텐츠를 지워요(다음 로드 때 다시 동기화돼요).
- <!--i:trash--> **Clear all my data** - 프로필과 세션, 이미지를 모두 지워요. *되돌릴 수 없어요.*

![휴대폰 너비 화면의 저장 공간 카드 - 기기에 있는 데이터의 모든 갈래가 이름과 함께 나오고, 맨 아래에 Clear all my data 버튼이 있어요](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

이 로컬 데이터는 어디로도 전송되지 않아요. 원격 측정도, 클라우드 렌더링도 없어요. 앱이 가져오거나 보내는 모든 것의 전체 목록은 [개인정보 처리방침](/info/privacy.html)에 있고, [서버 표면](/info/server-surface.html)은 선택적인 서버 구성 요소를 정리해 놓았어요.

## 다른 기기로 옮기기

모든 것이 내 기기에 있기 때문에, **Profile → Storage → Move to another device**로 전부를 두 번째 설치본으로 옮길 수 있어요. 계정도 클라우드도 없이요:

- <!--i:download--> **Export my data**는 프로필과 저장한 모든 세션(썸네일 포함), 올린 이미지, 환경설정(테마, 사이드바 너비, 로컬 활동 통계)을 담은 `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` 파일 하나를 내려받아요(이름의 각 부분은 프로필에서 오고, 값이 없으면 빠져요. `<n>`은 같은 날 내보낸 파일끼리 이름이 겹치지 않게 하는 하루 단위 일련번호예요).
- <!--i:upload--> 다른 설치본에서 **Import data…**로 그 파일을 다시 읽어 들이세요. 이 과정은 **병합**이에요. 이름이 같은 것(프로필, 세션 칸, 이미지)은 가져온 사본으로 바뀌고, 그 기기의 나머지는 그대로 남아요. 저장된 세션은 가져온 이미지와 자동으로 다시 연결돼요.

카탈로그 캐시는 포함되지 않아요 - 새 기기에서 알아서 다시 내려받아요. 묶음은 평범한 zip이라(`manifest.json` + `profile.json` + `sessions.json` + `assets.json` + `assets/blobs/…` + `prefs.json`, 형식 id는 `lolly-backup`) 이메일이나 USB, AirDrop을 거쳐도 온전하고, 모든 셸이 읽는 같은 형식이에요. 각 부분에 체크섬이 있어서 전송 중에 손상된 파일은 절반만 복원되는 대신 가져오는 시점에 걸러져요. (전체 형식 명세: [데이터 전송](/info/data-transfer.html).)

## 디자인 가져오기(Figma, Penpot, Illustrator, InDesign)

이미 있는 디자인을 Lolly로 가져와 이어서 작업할 수 있어요. **Design**을 열고 캔버스 툴바의 **Import a design**을 클릭한 다음, Figma **.fig**나 SVG, Penpot **.penpot**, Illustrator **.ai** / **.pdf**, InDesign **.idml** 중에서 고르세요. 레이어는 자유 캔버스의 편집 가능한 상자가 돼요 - 텍스트는 다시 입력할 수 있고, 이미지는 **My images**로 들어가며, 글꼴과 색은 브랜드 전역 값에 맞춰져요 - 그다음부터 결과물은 다른 세션과 똑같이 저장되고 공유되고 렌더링돼요. 해석은 전부 내 기기에서 일어나요. 자세한 내용: **[디자인 가져오기](/info/design-import.html)**.

## 내보내기

전체 이야기는 **[내보내기와 형식](/info/exporting.html)**을 보세요 - 형식 고르기, 출력 크기와 인쇄 단위, 투명도, 영상, 복사와 공유까지요. 요약하면, 형식을 고르고 필요하면 크기를 정한 뒤 **Download**(또는 클립보드로 **Copy**)를 누르면 돼요.

## 배치(Pro) 모드

고급 사용자를 위한 **Batch**(갤러리에서 연결되고, 기본으로 켜져 있는 Pro 기능 플래그 뒤에 있어요)는 여러 변형을 한 번에 렌더링해요. 각 행이 입력 한 벌인 격자를 함께 내보내는 방식이에요. 카드 하나를 열두 개 언어로 현지화하거나, 모든 크기 변형을 한 번에 만들 때 딱 맞아요. 행은 직접 입력하거나 스프레드시트에서 그대로 붙여넣거나 CSV를 가져와 채우고(다시 CSV로 내보낼 수도 있어요), 행마다 형식과 크기, 출력 파일 이름을 정하세요. 격자 전체를 이름 붙인 **배치 세션**으로 저장하면 갤러리에서 다시 열리고, 모든 행을 하나의 `.zip`으로 내려받을 수 있어요.

![일괄 처리 도구 모음 - zip 이름, 단위, DPI, 모든 행이 상속하는 형식이 있고 오른쪽에는 Sessions와 Render가 있어요](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.pro-toolbar&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

Batch는 **한 템플릿의 여러 변형**을 한 번에 만드는 기능이에요. **이미 저장한** 세션을 다시 렌더링하려면 위에서 설명한 **Projects → Render folder / Render selection**을 쓰세요 - Pro는 필요 없어요.

## 나란히 편집하기(Multi-edit)

일괄 처리(Batch)는 *하나의* 디자인에 대한 여러 변형이에요. **Multi-edit**은 그 반대편 절반을 담당해요: **서로 다른** 저장된 디자인 여러 개를 한 번에 열어서, 하나의 변경이 모두에 적용돼요. **Projects**에서 **2개에서 8개** 사이의 저장된 세션을 선택하고 선택 표시줄에서 **Edit together**(함께 편집)를 선택하세요. 그러면 `#/multi?s=<slot>,<slot>…`에서 나란히 놓인 실시간 카드로 열려요. 각 카드는 저장된 썸네일이 아니라 해당 세션의 실제 렌더링이므로, 보이는 그대로 내보내져요.

사이드바 하나가 전부를 움직여요:

- <!--i:sliders--> 맨 앞은 **Shared**예요. 고른 세션 중 둘 이상이 *같은 방식으로* 선언한 입력(같은 id, 같은 유형, 같은 제약 - 배치 격자가 열에 쓰는 것과 같은 병합 규칙이에요)이 모여요. 공유 컨트롤을 한 번 바꾸면 그 값이 그것을 선언한 모든 세션으로 퍼져서 모든 카드에 바로 반영돼요. 같은 도구의 두 세션은 전부를 공유하고, 서로 다른 두 도구는 마침 겹치는 것만 공유해요.
- <!--i:document--> 그 아래에는 **세션마다 접힌 카드 하나**가 있고, 그 세션 자체의 모든 입력이 도구의 사이드바와 같은 수준으로 들어 있어요. 자산 선택기, 반복 행 묶음, 색 입력에 더해 간결한 내보내기 묶음(**Format**, **W** / **H**, **Unit**, **DPI**, 그리고 자체 **Download**)까지요. 그 Download는 세션을 먼저 저장한 뒤 평범한 세션 내보내기 경로로 렌더링하니, 파일에는 도구에서 곧바로 내보낼 때와 같은 파일 이름과 형식, Content Credentials가 담겨요.
- <!--i:search--> 맨 위의 **Filter inputs…**는 *모든* 카드의 컨트롤을 한 번에 좁혀 줘요. 여덟 개 세션에서 "헤드라인"을 찾아 스크롤하지 않고 바로 닿는 방법이죠.

아무 캔버스나 클릭하거나 그 위에서 Enter를 누르면 해당 세션의 사이드바 카드가 열리며 화면에 보이도록 스크롤돼요. **Save all**은 모든 세션을 각자의 칸에 다시 써 넣어요. **Download all**은 먼저 저장한 뒤 전체를 Projects의 **Render selection**과 같은 경로로 렌더링해요. 결과는 zip 하나이고, 가는 길에 선택 사항인 비밀번호 잠금을 권해요.

솔직히 말할 제한이 둘 있어요. 2~8개라는 상한은 실제 제한이에요. 카드마다 자체 실시간 런타임을 띄우는데, 반응이 살아 있는 개수가 그만큼이거든요. 그보다 많은 것(또는 이제 없는 세션)을 요구하는 링크는 절반만 불러오는 대신 그렇다고 말해 줘요. 그리고 이 링크는 *내* 저장 칸을 가리키기 때문에 이 기기에서 그 묶음을 다시 열 뿐, 공유 링크가 아니에요.

선택이 여덟 개를 넘거나, 여러 도구가 섞였거나, 세션과 함께 이미지까지 들어 있다면 비상구는 같은 선택 바의 **Edit as sheet**예요. 선택 전체를 **배치 격자의 행**(`#/pro?s=…`)으로 열고, 개수 제한도 같은 도구여야 한다는 규칙도 없어요. 폴더는 둘 다에서 빠져요 - 폴더에는 격자에서 여는 자체 경로가 있어요. ([검색](/info/search.html)만은 아직 여기까지 닿지 않아요. Multi-edit은 검색 바가 모르는 유일한 화면이에요.)

## 오프라인과 설치

Lolly는 PWA예요. 처음 한 번 불러온 뒤로는 **오프라인**에서도 동작해요 - 브라우저 주소창에서 설치하면(모바일에서는 *Add to Home Screen*) 앱처럼 전체 화면으로 쓸 수 있어요. 다시 온라인이 되면 스스로 업데이트해요.

업데이트에 대해: 업데이트 직후 화면이 로드되지 않는다면(빈 패널이나 구석에 뜨는 "failed to fetch" 메시지), 페이지를 한 번 새로고침하세요 - 앱은 새 버전을 깔끔하게 받아들이고, 작업물과 세션, 브랜드는 그대로 유지돼요. 모든 것은 페이지가 아니라 기기에 저장돼요.
