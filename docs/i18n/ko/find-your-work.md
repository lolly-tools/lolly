# 작업 찾기 및 복구

무언가 없어졌어요. 저장하지 않은 디자인, 내려받은 파일, 지난주 버전, 또는 브라우저를 지운 뒤의 모든 것이에요. 표에서 시작해 그것이 가리키는 섹션을 따라가세요.

개인 작업물은 [Sync](/info/sync.html)를 켜지 않는 한 만든 브라우저나 앱의 그 기기에 남아요. 선택 사항인 Lolly Work를 쓰는 조직은 **Team projects**도 서버에 보관하며, 아래에서 다뤄요.

| 무엇을 했는지 | 어디를 볼지 |
|---|---|
| **다른 이름으로 저장** 또는 **저장**을 눌렀다 | **프로젝트** |
| **다운로드**를 눌렀다 | 브라우저의 다운로드 폴더, 그리고 **애셋**에도 사본 |
| 둘 다 아님, [작업하는 동안 저장되는 도구](#which-tools-save-as-you-work) 중 하나 | **프로젝트**와 **History** |
| 둘 다 아님, 그 밖의 도구 | 탭을 닫기 전까지 작업하던 탭에만 |
| 앱에서 삭제했다 | **휴지통**, **프로젝트**, **애셋** 또는 **설정 → 저장 공간**에 30일간 |

::: figure find-your-work-places
작업물이 있는 곳: 브라우저 자체 저장소에 Projects, History, Trash가 있고, 다운로드는 기기의 폴더로 가며, Sync와 백업 파일은 브라우저 밖의 사본이에요.
:::

::: details Lolly Work에서 공유 작업 찾기(선택 사항)
조직의 Lolly를 열고 로그인한 다음 **Projects → Team projects**를 살펴보세요. 공유 세션은 해당 인스턴스가 보관하며 사용자의 접근 권한에 따라 나타나요. 로그인하면 다른 기기에서도 그 세션에 대한 접근을 복구할 수 있지만, 개인 라이브러리나 기기 백업은 복구되지 않아요.

[업무 collab](/info/collaborate.html#work-collabs-with-lolly-work-optional)에서는 떠나기 전에 **Saved to work**가 표시될 때까지 기다리세요. 공유 프로젝트가 없다면 올바른 인스턴스에 연결되어 있는지 확인하고, 접근이나 보관에 대해서는 운영자에게 문의하세요. 브라우저 데이터를 지우면 로컬 사본만 제거되고 조직 서버의 사본은 그대로예요. [조직에서 Lolly 사용하기](/info/organisation.html)를 참고하세요.
:::

## 저장한 것 찾기

1. 도구 왼쪽 위의 **홈**을 누르세요.
2. 홈 화면 위쪽의 **프로젝트** 탭을 여세요(휴대폰에서는 폴더 아이콘).
3. 첫 화면을 보세요. **내 라이브러리**에 저장한 작업이 거기 있고, 각 프로젝트는 폴더예요. 모든 폴더를 한 번에 검색하려면 화면 아래쪽의 **모든 프로젝트 검색…**에 입력하세요.

항목 이름은 내보내기 패널에 입력한 파일 이름을 따르고, 입력하지 않았다면 **QR Code** 같은 도구 이름을 따라요. 항목을 열면 모든 설정이 돌아와 있어서 바로 바꾸고 다시 내보낼 수 있어요. 새 작업을 이런 식으로 보관하려면 [저장하고 이어가기](/info/using.html#saving-continuing)를 참고하세요.

::: note 프로젝트에 없나요?
- **휴지통**에 있을 수 있어요: [삭제한 것 되찾기](#get-back-something-you-deleted)를 참고하세요.
- 다른 브라우저, 시크릿 창, 다른 기기는 [동기화](/info/sync.html)를 쓰거나 [작업을 옮기지](#move-your-work-to-another-device) 않는 한 비어 있는 상태로 시작해요.
- **다운로드**만 눌렀다면 [다운로드한 파일 찾기](#find-a-file-you-downloaded)를 참고하세요.
:::

::: details 프로젝트로 작업하기
**프로젝트**는 **설정 → 저장 공간 → 저장된 세션 → 프로젝트로 정리**에서도 열 수 있어요. 파일 관리자처럼 동작해요:

![아무것도 저장하지 않은 상태의 프로젝트: 새 폴더, 새 애셋, 템플릿 타일과 오른쪽 위의 History 시계 아이콘, 그리고 맨 아래의 모든 프로젝트 검색 바](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **중첩되는 폴더.** 저장된 세션을 폴더로, 폴더 안의 폴더로 원하는 깊이만큼 묶어요. 폴더를 만들고, 이름을 바꾸고, 타일을 다른 폴더로 끌어 옮기세요. 이동 경로 표시가 위로 돌아가게 해줘요. 폴더 없이 저장된 세션은 **Projects** 루트에 바로 나타나요.
- <!--i:clock--> **원하는 대로 정렬.** 오른쪽 위의 슬라이더 버튼인 **View options**는 **Grid** 또는 **List**를 제공하고, **Name**, **Date added**, **Last modified**(기본값), **Size**, 폴더 안에서는 **By tool**로 정렬해요. 어떤 정렬이 활성이든 폴더가 항상 먼저 오며, 정렬은 각자의 그룹 안의 세션과 폴더 순서만 정해요.
- <!--i:document--> **새 작업을 바로 보관.** **New asset**이 공유 선택기를 열어요. **Templates**를 선택하면 저장된 템플릿에서 시작해요. 열어서 편집하거나 **+ Add**로 새 작품을 바로 저장해요.
- <!--i:checklist--> **다중 선택(데스크톱).** 타일의 체크박스를 선택하거나, 빈 공간에서 선택 상자를 끌거나, **Shift/Cmd 클릭**하세요. 타일을 **우클릭**하면 컨텍스트 메뉴가 나와요. 그러면 선택 막대에 **Render selection**, **Move to…**, **New folder**, **Delete**(휴지통으로 이동), 사이드바 하나 아래 나란히 놓고 편집하는 단일 도구 세션 2~8개용 **Edit together**, 크기나 구성에 관계없이 선택을 배치 그리드의 행으로 여는 **Edit as sheet**가 나타나요.
- <!--i:download--> **폴더 전체 또는 선택 렌더링.** **Render folder**는 폴더의 모든 저장된 세션을 하위 폴더까지 포함해 중첩된 `.zip` 하나로 내보내요. **Render selection**은 모든 다중 선택에 같은 일을 하며, 세션 하나는 자체 파일로 바로 렌더링돼요.
- <!--i:link--> **도구의 저장된 작업으로 바로 이동.** Tools 갤러리에서 도구를 하나 이상 선택하고 선택 막대에서 **View sessions**를 선택하면, Projects가 해당 도구로 만든 세션만 보여주며 열려요. **Clear**로 전체 보기로 돌아가요.
- <!--i:link--> **저장된 세션 공유.** 세션을 우클릭하고(휴대폰에서는 타일의 **•••**을 누르고) **Share link**를 선택하면 같은 설정으로 다시 여는 링크가 복사돼요. 기기의 그림은 링크로 이동하지 않아요(전체 공유 대화상자는 [작업물 공유](/info/using.html#sharing-your-work)를 참고하세요).
- <!--i:pentool--> **이름 변경 또는 복사.** 세션을 우클릭하면(휴대폰에서는 타일의 **•••**을 누르면) **Rename**, **Duplicate**(같은 폴더에 사본), **Move to…**가 나와요.

![프로젝트의 보기 옵션 팝오버: 그리드와 목록 레이아웃, 마지막 수정으로 설정된 정렬, 그 옆에 순서를 반대로 바꾸는 버튼](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
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
The popover (views/projects-view-options.ts, checked 2026-09-26) holds a
Layout pair (Grid / List) and a Sort by menu with a reverse button; the
options inside the menu (Name, Date added, Last modified, Size, By tool) are
not visible in the closed menu, so the alt does not list them.
-->

:::

## 탭을 닫았거나 도구를 떠났을 때

무엇이 돌아오는지는 어떻게 나갔는지와 어떤 도구를 사용했는지에 따라 달라져요:

- **탭을 닫았거나 나중에 다시 왔어요.** [작업하는 대로 저장하는 도구](#which-tools-save-as-you-work)를 제외하면 저장하지 않은 작업은 사라져요. 그 작업은 **Projects**에서 여세요.
- **같은 탭에서 페이지를 새로고침했어요.** 설정이 페이지 주소에서 돌아와요. 작업하는 대로 저장하지 않는 도구에서는 기기에서 추가한 그림과 파일, 150자를 넘는 한 줄 텍스트가 돌아오지 않아요. 주소가 이를 담지 못하기 때문이에요.
- **Home이나 왼쪽 위의 뒤로 버튼을 눌렀어요.** 마지막으로 저장, 다운로드, 복사한 뒤 무언가 바꿨다면 **Unsaved edits** 대화상자가 먼저 저장할지 물어요. **Save & leave**는 작업을 저장하고 **Projects** 또는 작업을 연 프로젝트 폴더로 돌아가요. **Leave anyway**는 변경 사항을 버려요. 저장된 항목은 마지막으로 저장한 상태로 돌아가고, 저장한 적 없는 작품은 **Projects**에서 사라져요. **Cancel**은 도구에 남게 해요.

Lolly는 도구 안에서 **홈**이나 뒤로 가기 버튼을 눌렀을 때만 물어봐요. 탭을 닫거나, 새로고침하거나, 브라우저 자체의 뒤로 가기 버튼을 쓸 때는 절대 묻지 않아요. 확실히 하려면 도구를 떠나기 전에 **다른 이름으로 저장**을 누르거나 내보내기 패널에서 **저장**을 누르세요.

자동 복구를 쓸 수 없을 때 편집 컨트롤 옆의 안내가 무엇을 보관해야 하는지 알려줘요.

- 가져온 파일로 작업하는 도구에서는 설정을 저장하고 원본 파일도 보관하세요.
- 녹음 도구나 Save 동작이 없는 유틸리티에서는 떠나기 전에 결과를 저장하거나 다운로드하세요.
- 데스크톱과 모바일 앱은 직접 저장해야 할 때를 알려줘요.
- 비공개 협업에서는 초대한 사람이 상대방의 변경을 포함한 문서와 기록을 보관해요. 참여한 사람은 임시 사본으로 작업하므로 세션이 끝나기 전에 별도 사본을 저장해야 해요.

::: note 실수로 저장하지 않고 나갔나요?
작업하는 동안 저장되는 도구에서는 기록이 버려진 편집 내용의 사본을 보관해요. **History** 페이지를 열어 **Changes** 아래에서 찾은 다음 **사본으로 열기**를 누르세요. 다른 도구에서는 변경 내용이 사라져요.
:::

::: details 작업하는 동안 저장되는 도구는 어떤 것들인가요
웹 앱에서는 문서를 만드는 모든 도구가 작업하는 동안 저장돼요: Design, Chart, QR Code, Text, Sandbox 등이에요. 다음 도구는 그렇지 않아요:

- Redact, Sign, Convert Image처럼 가져온 파일로 작업하는 도구. Lolly는 그 파일의 사본을 절대 보관하지 않기 때문이에요.
- Record, Screen Capture, Voice Recorder처럼 카메라, 마이크, 화면에서 녹화하는 도구.
- Countdown처럼 바꿀 것이 없는 도구.

다른 도구에서는 첫 변경이 저장한 것처럼 작업을 **Projects**에 보관하고, 이후 변경은 도구가 그리기를 마치면 작업하는 대로 유지돼요. 저장하지 않은 작품도 탭을 닫은 뒤 Projects에 남아 있고, 변경 사항이 저장되지 않음으로 표시된 채 다시 열려요.

**Leave anyway**는 여전히 이 변경을 버리며, History가 버려진 편집의 사본을 30일간 보관해요. 홈 화면에서 도구를 다시 열면 새 작품이 시작되며, 이전 것은 Projects에서 여세요.

3D와 Darkroom은 작업하는 대로 저장되지만, 3D 모델이나 LUT처럼 불러온 파일은 보관하지 않아요. History와 **Save**는 파일 자체가 아니라 이름, 유형, 크기를 보관해요. 작업을 다시 열면 안내가 어떤 파일이었는지 알려주고, 다시 불러오기 전까지 도구는 그 파일 없이 작동해요. 원본 파일을 보관하세요.

[동기화](/info/sync.html)가 켜져 있으면 이렇게 기록된 창작물도 프로젝트의 다른 항목과 마찬가지로 다른 기기로 전달돼요. 다만 버전은 만들어진 기기에 그대로 남아요.

어떤 창작물을 두 개의 탭에서 열어 두고 양쪽에서 저장하면 마지막 저장이 유지돼요. 그때 밀려난 작업은 사라지지 않아요: 그 창작물의 History 안 **Protected drafts**에 있고, **Open draft as a copy**로 꺼낼 수 있어요.

이 기능은 웹 앱에서만 동작하며, 데스크톱이나 모바일 앱에서는 동작하지 않아요. 그리고 다른 사람과 실시간으로 함께 작업하는 동안에도 동작하지 않아요.
:::

## 다운로드한 파일 찾기

브라우저에서는 **다운로드**를 누르면 파일이 브라우저로 넘어가고, 브라우저가 자신의 다운로드 폴더(보통 **다운로드**)에 저장하거나 저장 위치를 물어봐요. Lolly는 파일이 어디로 갔는지 알지 못하므로 브라우저의 다운로드 목록을 확인하세요.

파일이 나타나지 않았다면 아직 도구 안에 있는 동안 내보내기 패널을 확인하세요. **다운로드** 아래에 파일 이름과 시간을 알려주는 줄이 있고, **Retry download**와, Chrome, Edge 등 다른 Chromium 브라우저에서는 직접 폴더를 고를 수 있는 **Save file…**이 있어요. 이 줄과 그 파일은 도구를 떠나거나, 새로고침하거나, 다시 내보낼 때까지 남아 있어요.

Lolly는 다운로드할 때마다 두 가지를 더 보관해요:

- **파일 사본**이 **설정 → 내 렌더** 아래에서 **내 렌더를 라이브러리에 저장**이 켜져 있는 동안 **애셋**의 **내 업로드**에 저장돼요(**설정**은 홈 화면 아래쪽에 있어요). 이 설정은 기본으로 켜져 있어요. 동영상이나 50MB가 넘는 파일은 먼저 확인을 물어보고, zip은 복사되지 않아요.
- **사용한 설정**이 최근 24번의 다운로드에 대해 저장돼요. **프로젝트**의 저장한 작업 아래에 있는 **최근 내보내기**는 그 설정으로 도구를 다시 열어 파일을 다시 만들 수 있게 해주지만, 기기에서 추가한 사진과 파일은 포함되지 않아요. 같은 목록이 **설정 → 활동 및 통계 → 최근 내보내기**와 **History**의 **Changes** 탭에도 있어요. 이 목록은 설정을 보관할 뿐, 파일을 보관하지 않아요.

::: details 데스크톱과 모바일 앱에서는
- **데스크톱 앱:** **다운로드**는 대화상자 없이 **Downloads** 폴더 안의 **Lolly** 폴더로 바로 저장돼요. **다운로드** 아래의 줄에는 파일이 저장된 위치가 나오는데, 예를 들어 "Downloads/Lolly에 저장됨"처럼 표시되고 **폴더에서 보기**가 함께 있어요. **Window**나 **Exports** 메뉴에 있는 **Open Exports Folder**로 언제든 그 폴더를 열 수 있어요. 이전과 같은 이름의 파일은 "name (1)"로 저장돼요.
- **iPhone과 iPad:** 파일은 **Lolly** 아래의 **파일** 앱에 저장되고, 공유 시트가 열려서 바로 보낼 수 있어요. **다운로드** 아래의 줄에는 "Files → Lolly에 저장됨"이라고 표시돼요.
- **Android:** 공유 메뉴가 열려서 파일을 보낼 곳을 고를 수 있어요.

iPhone, iPad, Android에서는 새 파일이 같은 이름의 이전 파일을 대체해요.
:::

## 이전 버전으로 돌아가기

- **이번 방문 동안은:** **실행 취소**는 도구를 떠나거나 새로고침할 때까지 최근 100번의 변경을 되돌릴 수 있어요. [실행 취소와 다시 실행](/info/using.html#undo-and-redo)을 참고하세요.
- **[작업하는 동안 저장되는 도구](#which-tools-save-as-you-work)에서는:** 각 창작물의 이전 버전이 보관돼요. 아래 단계를 따르세요.
- **기기의 모든 것은:** [동기화](/info/sync.html)가 켜져 있으면 **설정 → 연결된 서비스** 아래의 **Restore an earlier copy**로 최근 7일치 일일 사본 중 하나, 또는 마지막 적용 이전의 사본을 되돌릴 수 있어요. 이 경우 디자인 하나가 아니라 이 기기의 모든 것이 그 사본과 일치하게 돼요.

이전 버전을 열려면:

1. **실행 취소**와 **다시 실행** 옆의 시계 버튼인 **History**를 누르세요. Design에서는 **History**가 상단 바에 있어요; 휴대폰에서는 **•••**를 누른 다음 **History**를 누르세요. **실행 취소**가 없는 도구(Text, Sandbox 등)에서는 **History**가 왼쪽 위 **Home** 옆에 있어요.
2. 날짜와 시간으로 버전을 찾으세요. **Automatic checkpoint** 행은 작업하는 동안 자동으로 찍힌 것이고, **Saved version** 행은 저장한 시각이에요.
3. **Open as a copy**를 누르세요. 그 버전이 새 창작물로 열리고, 열려 있던 원래 작업은 그대로 남아요. 사본은 **프로젝트**에 있으며 이름 뒤에 "(copy)"가 붙어요.

이름을 붙여 버전을 남기려면 **Name version**을 누르고 이름을 입력한 다음 **Keep milestone**을 누르세요. 이름을 붙인 버전은 **History** 페이지의 **Milestones** 아래에 나열돼요.

::: details History 패널과 History 페이지
**History** 패널에는 **Recovered work** 행도 나열되고, **Protected drafts**는 체크포인트 사이의 최신 편집 내용을 보관하며 **Open draft as a copy**가 있어요. **Compare**와 **Check assets**는 사본을 열기 전에 선택하는 데 도움을 줘요. **This creation**을 **All history on this device**로 전환하면 모든 창작물을 볼 수 있어요.

자동 체크포인트는 오래될수록 줄어들어요: 최근 1시간은 1분마다, 최근 하루는 1시간마다, 최근 30일은 하루마다, 그 이후는 일주일마다예요. 저장된 버전과 이름 붙인 버전은 모두 보관돼요. 창작물을 삭제하면 그 버전들도 **휴지통**으로 이동하고, **완전 삭제**를 하면 함께 제거돼요.

History 저장 공간이 가득 차면, 30일 동안 열지 않은 창작물의 가장 오래된 자동 체크포인트부터 먼저 제거돼요. 그래도 저장은 항상 보관돼요: 현재 작업으로 기록되고, History는 이 저장이 버전으로 보관되지 않는다고 표시해요. **설정 → 저장 공간**에서 History가 얼마나 쓰이고 있는지 볼 수 있어요.

**History** 페이지(`#/history`)는 이 브라우저의 모든 작품을 다뤄요. 열려면 홈 화면 또는 **Projects** 오른쪽 위의 시계 버튼을 누르거나, 프로필 메뉴(휴대폰에서는 오른쪽 위의 둥근 로고 버튼)에서 **Saved sessions**를 선택하거나, 도구의 History 패널에서 **Open app history**를 누르세요. 데스크톱과 모바일 앱에는 History 페이지가 없으므로, 거기서는 홈 화면의 시계 버튼과 **Saved sessions**가 대신 **Your recent work**를 열어요. 최근 저장된 세션과 내보내기, 그리고 Projects로 가는 링크예요.

- **Recent**은 창작물을 최신순으로 **Resume**과 함께 나열해요.
- **Changes**는 체크포인트, 다운로드, Convert 결과를 하나의 타임라인에 모아요. 다운로드에는 **Reopen settings**가 있어요.
- **Milestones**는 이름을 붙인 버전을 나열해요.

프로젝트, 도구, 날짜로 필터링할 수 있어요(휴대폰에서는 **Filters** 안에). History 페이지에는 삭제 버튼이 없어요; 항목을 지우려면 프로젝트를 사용하세요.
:::

## 다른 기기로 작업 옮기기

| 목적 | 사용할 기능 |
|---|---|
| 기기들을 맞춰 두기 | **설정 → 연결된 서비스** 아래의 **기기 간 동기화**: [기기 동기화하기](/info/sync.html) 참고 |
| 한 번에 모두 옮기기 | 아래의 **내 데이터 내보내기**와 **데이터 가져오기…** |
| 디자인 하나나 프로젝트 하나를 넘기기 | `.lolly` 파일: **내보내기**, 그다음 **공유**, 그다음 **Download .lolly**; 프로젝트 전체라면 폴더 메뉴의 **Download project (.lolly)**. 다른 기기에서 **열기**를 누르세요. [.lolly 파일](/info/using.html#the-lolly-file) 참고 |

공유 링크에는 설정이 담기지만, 기기에서 추가한 사진이나 파일은 담기지 않아요.

::: note 가져오기는 아무것도 지우지 않고 더하기만 해요
파일 안의 폴더, 즐겨찾기, 템플릿은 다른 기기에 이미 있는 것들 옆에 추가돼요. 저장된 항목이 양쪽에 모두 있으면 더 최근에 저장된 사본이 유지돼요. 그 기기에 있는 사용자 정보와 설정은 그대로 남고, 비어 있던 항목은 파일에서 채워져요. 동기화의 **이 기기로 가져오기**도 똑같이 동작해요.
:::

한 번에 모두 옮기려면:

1. 이전 기기에서 **설정 → 저장 공간**을 열고, **다른 기기로 이동** 아래의 **내 데이터 내보내기**를 누르세요. Lolly가 이름이 `LollyTools-`로 시작하는 `.zip` 파일 하나를 다운로드해요.
2. USB, 자신에게 보내는 이메일, AirDrop, 또는 공유 폴더로 파일을 옮기세요.
3. 새 기기에서 **설정 → 저장 공간**을 열고 **데이터 가져오기…**를 눌러 파일을 고른 다음 **가져오기**를 누르세요.

::: note 남겨지는 것
로그인 정보, 키, 동기화 암호 문구는 각 기기에 남아요. 최근 다운로드 목록, 오프라인 다운로드, AI 모델은 어떤 방법으로도 이동하지 않아요. 버전 히스토리는 **내 데이터 내보내기** 파일 안에서만 이동하고, 동기화나 `.lolly`로는 이동하지 않아요. 히스토리가 파일 하나에 담기에 너무 크면, 가장 오래된 자동 체크포인트가 제외되고 내보내기 줄에 몇 개인지 표시돼요. 동기화가 저장소에 보관하는 사본은 다운로드해서 열 수도 있고, 백업 파일처럼 **데이터 가져오기…**에서 선택할 수도 있어요. 암호화된 사본은 암호 문구를 물어봐요.
:::

::: details 백업 파일이 담고 있는 것
파일은 `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`이라는 이름을 가져요(이름 부분은 프로필에서 가져오며 설정되지 않으면 생략돼요; `<n>`은 일별 카운터라 같은 날의 내보내기가 충돌하지 않아요). 여기에는 폴더, 휴지통, 템플릿, 즐겨찾기를 포함한 프로필; 썸네일이 딸린 모든 저장된 세션; 업로드한 이미지, 폰트, 로고와 다운로드 사본; 디자인 시스템; 환경설정(테마, 사이드바 너비, 로컬 활동 통계); 저장된 버전과 Convert 결과; 그리고 웹 앱의 경우 창작물의 버전 히스토리가 담겨요.

카탈로그 캐시는 포함되지 않으며 새 기기에서 스스로 다시 내려받아요. 각 부분에 체크섬이 있으므로 전송 중 손상된 파일은 반쯤 망가진 채 복원되지 않고 가져올 때 걸러져요. 저장된 세션은 가져온 이미지와 자동으로 다시 연결돼요. 웹, 데스크톱, 모바일 앱은 같은 파일을 읽으며, 터미널 앱은 이 형식이 읽지 못하는 더 단순한 자체 백업을 써요. **Export my data & render everything**은 같은 파일에 모든 저장된 세션을 출력으로 렌더링한 두 번째 zip을 더해서 만들어요. (전체 형식 명세: [데이터 이전](/info/data-transfer.html).)
:::

## 브라우저 데이터를 지운 경우

웹 앱에서는 Lolly가 이 사이트용 브라우저 저장소에 모든 것을 보관해요: 저장한 작업, 사진, 폰트, 디자인 시스템, 버전 히스토리, 오프라인 다운로드예요. 브라우저에서 이 사이트의 데이터를 지우면 그 모두가 삭제되고, Lolly는 그중 무엇도 되찾을 수 없어요. 남는 것은 이미 브라우저 밖으로 나가 있던 것들이에요: 다운로드한 파일, **내 데이터 내보내기** 파일, [동기화](/info/sync.html) 사본, 그리고 공유한 링크예요.

::: warning 브라우저 데이터를 지우기 전에
**설정 → 저장 공간** 아래의 **내 데이터 내보내기**를 눌러 그 파일을 다른 곳에 보관하세요.
:::

앱이 시작되면 Lolly는 기기의 공간이 부족해질 때 브라우저가 저장소를 지우지 않도록 요청하고, 브라우저가 결정해요. **Settings → Available offline**에서 **Protected**로 시작하는 줄은 브라우저가 동의했다는 뜻이에요. "The browser may clear downloads if the device runs low on space"는 동의하지 않았다는 뜻이며, **Protect downloads**가 다시 요청해요.

브라우저가 동의하지 않았다면 공간이 부족할 때 다운로드뿐 아니라 저장된 작업물도 지울 수 있으므로 최근 **Export my data** 파일을 보관하세요.

**설정 → 저장 공간**은 각 종류의 데이터가 얼마나 많은 공간을 쓰는지 보여줘요. 그중 **History** 행은 자동 체크포인트와 그 미리보기, 복구용 초안을 세어요; **Remove automatic checkpoints older than 30 days**는 그 공간을 확보하면서 저장된 버전과 이름 붙인 버전은 그대로 보관해요. **캐시 지우기**는 다운로드된 카탈로그 파일을 버려요. 필요할 때 다시 다운로드돼요. **내 데이터 모두 지우기**는 어떤 단어의 입력을 요청한 다음, 동기화를 끄고, Lolly가 이 브라우저에 보관하고 있는 모든 것을 지워요: 프로필과 설정, 히스토리와 휴지통을 포함한 저장된 세션, 업로드한 파일, 폰트와 디자인 시스템, 다운로드 기록, Convert 결과, 다운로드한 AI 모델과 오프라인 사본이에요. 다운로드한 파일은 저장한 위치에 그대로 남아요. 그런 다음 앱은 처음 방문했을 때처럼 시작돼요.

![휴대폰 너비 화면의 저장소 카드: 기기 내 데이터의 모든 범주가 표시되고 아래쪽에 Clear all my data 버튼이 있어요](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

데스크톱과 모바일 앱에서는 저장된 세션이 앱 자체의 데이터 폴더 안 파일이고, 나머지는 앱 자체의 저장소에 있어서 웹 브라우저를 지워도 영향을 받지 않아요.

::: details 데스크톱과 모바일 앱이 저장된 세션을 보관하는 위치
저장된 세션마다 파일 하나씩이 `saved-state` 폴더 안에 있어요:

- macOS: `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows: `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux: `~/.local/share/tools.lolly.Desktop/saved-state/`, 또는 `$XDG_DATA_HOME` 아래의 같은 경로
- iPhone, iPad, Android: 앱 자체의 저장소 안에 있으며, 파일 앱에는 표시되지 않아요

사진, 디자인 시스템, 최근 다운로드 목록은 이 폴더가 아니라 앱의 내부 저장소에 있어요. 터미널 앱과 명령줄은 같은 `saved-state` 폴더를 읽어요: [저장된 세션이 있는 곳](/info/cli-reference.html#where-saved-sessions-live)을 참고하세요.
:::

## 삭제한 것 되찾기

앱에서 저장된 세션, 폴더, 업로드한 파일, 폰트 중 하나를 삭제하면 어디에서 삭제하든 - **프로젝트**, **애셋**, **설정 → 저장 공간**, 또는 도구의 저장된 세션 목록 - 30일 동안 **휴지통**으로 옮겨져요. 폴더는 안의 모든 것을 포함해 하나의 항목으로 이동하고, 세션은 그곳에 있는 동안 버전 히스토리를 유지해요. 바로 직후에는 **실행 취소**를 제공하는 메시지가 떠요. 그 이후에는:

1. **휴지통**을 여세요: **프로젝트**의 **휴지통** 타일, **애셋 → 내 업로드**의 **휴지통** 버튼, 또는 **설정 → 저장 공간**의 **휴지통** 행 중 하나예요. 셋 다 같은 목록을 열어요.
2. 항목 옆의 **복원**을 누르세요. 항목은 원래 폴더로 돌아가고, 폰트는 자신의 디자인 시스템에서 가지고 있던 역할을 되찾아요.

**영구 삭제**는 항목 하나를 완전히 제거해요. **휴지통 비우기**는 먼저 물어본 다음 휴지통의 모든 항목을 제거해요. 30일이 지난 항목은 완전히 제거돼요.

::: warning 일부 삭제는 즉시 이뤄져요
디자인 시스템, 로고, 프로필 사진을 삭제하면 휴지통으로 가지 않아요. 명령줄과 터미널 앱도 즉시 삭제해요.
:::

[동기화](/info/sync.html)가 켜져 있으면 **Restore an earlier copy**로 기기 전체의 이전 날짜 상태를 되돌릴 수 있고, **내 데이터 내보내기** 파일은 그 파일이 담고 있는 내용을 되돌려요.
