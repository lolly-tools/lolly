# 작업물 찾기와 복구

저장하지 않은 디자인, 다운로드한 파일, 지난주 버전, 브라우저를 지운 뒤의 작업물을 찾아요. 표부터 살펴보세요.

[Sync](/info/sync.html)를 켜지 않는 한 개인 작업물은 만든 기기의 해당 브라우저나 앱에 남아요. 선택 사항인 Lolly Work를 사용하는 조직은 **Team projects**를 서버에도 보관해요.

| 한 일 | 찾을 곳 |
|---|---|
| **Save as** 또는 **Save**를 눌렀어요 | **Projects** |
| **Download**를 눌렀어요 | 브라우저의 다운로드 목록과 **Assets**에 있는 사본 |
| [작업하는 동안 저장하는 도구](#which-tools-save-as-you-work)에서 둘 다 누르지 않았어요 | **Projects**와 **History** |
| 작업하는 동안 저장하지 않는 도구에서 둘 다 누르지 않았어요 | 탭을 닫기 전까지 작업한 탭에만 있어요 |
| 앱에서 삭제했어요 | **Projects**, **Assets**, **Settings → Storage**의 **Trash**에 30일 동안 있어요 |

::: figure find-your-work-places
작업물이 있는 곳: 브라우저 자체 저장소에는 Projects, History, Trash가 있고, 다운로드는 기기의 폴더로 가며, Sync와 백업 파일은 브라우저 밖의 사본이에요.
:::

::: details Lolly Work에서 공유 작업물 찾기(선택 사항)
조직의 Lolly를 열고 로그인한 다음 **Projects → Team projects**를 살펴보세요. 그 인스턴스에는 공유 세션이 있고, 접근 권한이 있는 세션을 보여줘요. 다른 기기에서 로그인하면 해당 세션에 다시 접근할 수 있어요. 로그인해도 개인 라이브러리나 기기 백업은 복원되지 않아요.

[Work collab](/info/collaborate.html#collabs-through-lolly-work-optional)에서는 **Saved to work**가 표시될 때까지 기다린 뒤 나가세요. 공유 프로젝트가 보이지 않으면 올바른 인스턴스에 연결돼 있는지 확인하고 운영자에게 접근 권한이나 보관에 관해 문의하세요. 브라우저 데이터를 지우면 로컬 사본이 제거되며 조직 서버의 사본은 남아요. [조직에서 Lolly 사용하기](/info/organisation.html)를 참고하세요.
:::

<!--i:eti-search-->
## 저장한 작업물 찾기

1. 도구 왼쪽 위의 **Home**을 누르세요.
2. 홈 화면 위쪽의 **Projects** 탭을 여세요(휴대폰에서는 폴더 아이콘이에요).
3. **My library**에 저장한 모든 작업물은 첫 화면에 있어요. 각 프로젝트는 폴더예요. 모든 폴더를 검색하려면 화면 아래의 **Search all projects…**에 입력하세요.

항목 이름은 내보내기 패널에 입력한 파일 이름을 따라요. 파일 이름이 없으면 **QR Code** 같은 도구 이름을 따라요. 항목을 열면 모든 설정이 돌아와요. 새 작업물을 저장하려면 [저장하고 이어서 하기](/info/using.html#saving-continuing)를 참고하세요.

::: note Projects에 없나요?
- **Trash**에 있을 수 있어요. [삭제한 항목 되찾기](#get-back-something-you-deleted)를 참고하세요.
- [Sync](/info/sync.html)를 쓰거나 [작업물을 옮기지](#move-your-work-to-another-device) 않으면 다른 브라우저, 비공개 창, 다른 기기에서는 빈 상태로 시작해요.
- **Download**만 눌렀다면 [다운로드한 파일 찾기](#find-a-file-you-downloaded)를 참고하세요.
:::

::: details Projects 사용하기
**Settings → Storage → Saved sessions → Organise in Projects**에서도 **Projects** 보기를 열 수 있어요. 파일 관리자처럼 작동해요.

![아직 아무것도 저장하지 않은 Projects: New folder, New asset, Templates 타일, 오른쪽 위의 History 시계, 아래쪽의 Search all projects 막대](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **중첩할 수 있는 폴더.** 저장된 세션을 폴더에 넣고 그 폴더를 다른 폴더 안에 넣으며 원하는 깊이로 구성하세요. 폴더를 만들거나 이름을 바꾸고, 타일을 폴더 위로 끌어 옮기세요. 탐색 경로로 상위 폴더로 돌아가요. 폴더 없이 저장한 세션은 **Projects** 최상위에 있어요.
- <!--i:clock--> **원하는 방식으로 정렬하기.** 오른쪽 위의 슬라이더 버튼인 **View options**는 **Grid** 또는 **List**를 제공하고 **Name**, **Date added**, **Last modified**(기본값), **Size**, 폴더 안에서는 **By tool**로 정렬해요. 폴더가 항상 먼저 나와요. 세션과 폴더는 각자의 그룹 안에서 정렬돼요.
- <!--i:document--> **새 작업물을 바로 넣기.** **New asset**은 공통 선택기를 열어요. 저장된 템플릿에서 시작하려면 **Templates**를 고르세요. 템플릿을 열어 편집하거나 **+ Add**를 눌러 새 작업물을 바로 저장하세요.
- <!--i:checklist--> **여러 항목 선택하기(데스크톱).** 타일의 체크박스를 선택하거나 빈 공간에서 선택 상자를 끌거나 **Shift/Cmd를 누르고 클릭**하세요. 타일의 상황별 메뉴는 타일을 **우클릭**하면 열려요. 선택 막대에는 **Render selection**, **Move to…**, **New folder**, **Delete**(Trash로 이동)가 있어요. **Edit together**는 단일 도구 세션 두 개에서 여덟 개를 하나의 사이드바 아래에 나란히 열어요. **Edit as sheet**는 개수나 도구 조합에 관계없이 선택한 항목을 배치 격자의 행으로 열어요.
- <!--i:download--> **폴더 전체나 선택 항목 렌더링하기.** **Render folder**는 폴더와 하위 폴더의 모든 저장된 세션을 중첩된 `.zip` 하나로 내보내요. **Render selection**은 여러 선택 항목에 같은 일을 해요. 세션 하나는 자체 파일로 렌더링돼요.
- <!--i:link--> **도구의 저장된 작업물로 바로 가기.** Tools 갤러리에서 도구를 하나 이상 선택하고 선택 막대의 **View sessions**를 고르세요. 그러면 Projects는 해당 도구로 만든 세션만 보여줘요. **Clear**로 전체 보기로 돌아가요.
- <!--i:link--> **저장된 세션 공유하기.** 세션을 우클릭하고(휴대폰에서는 타일의 **•••**를 누르고) **Share link**를 고르세요. 링크는 같은 설정으로 세션을 다시 열어요. 기기의 이미지는 링크와 함께 이동하지 않아요. 전체 Share 대화상자는 [작업물 공유하기](/info/using.html#sharing-your-work)를 참고하세요.
- <!--i:pentool--> **이름 바꾸기 또는 복사하기.** 같은 메뉴에 **Rename**, **Duplicate**(같은 폴더에 사본 만들기), **Move to…**가 있어요.

![Projects의 View options 팝오버: Grid와 List가 있는 Layout, Last modified로 설정된 Sort by와 그 옆의 순서를 뒤집는 버튼](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
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

<!--i:eti-refresh-->
## 탭을 닫거나 도구를 떠났다면

무엇이 돌아오는지는 어떻게 나갔는지와 도구에 따라 달라요.

- **탭을 닫았거나 나중에 다시 왔어요.** [작업하는 동안 저장하는 도구](#which-tools-save-as-you-work)를 제외하면 저장하지 않은 작업물은 사라져요. 해당 작업물은 **Projects**에서 여세요.
- **같은 탭에서 페이지를 새로고침했어요.** 페이지 주소에서 설정이 돌아와요. 작업하는 동안 저장하지 않는 도구에서는 기기의 이미지와 파일, 150자를 넘는 한 줄 텍스트가 주소에 담기지 않으므로 돌아오지 않아요.
- **Home이나 왼쪽 위의 뒤로 가기 버튼을 눌렀어요.** 마지막으로 저장, 다운로드, 복사한 뒤 바꾼 내용이 있으면 **Unsaved edits** 대화상자가 먼저 저장할지 물어요. **Save & leave**는 작업물을 저장하고 **Projects** 또는 그 작업물을 열었던 프로젝트 폴더로 이동해요. **Leave anyway**는 변경 사항을 버려요. 저장된 항목은 마지막 저장 상태로 돌아가고, 한 번도 저장하지 않은 작업물은 **Projects**에서 사라져요. **Cancel**은 도구에 머물게 해요.

::: warning 탭을 닫을 때는 먼저 묻지 않아요
탭 닫기, 새로고침, 브라우저 자체의 뒤로 가기 버튼은 확인을 요청하지 않아요. 확실히 보관하려면 도구를 떠나기 전에 **Save as** 또는 내보내기 패널의 **Save**를 누르세요.
:::

자동 복구를 쓸 수 없으면 편집 컨트롤 옆에 무엇을 보관해야 하는지 안내가 나타나요.

- 가져온 파일을 다루는 도구에서는 설정을 저장하고 원본 파일도 보관하세요.
- 녹화·녹음 도구나 Save 동작이 없는 유틸리티에서는 떠나기 전에 결과를 저장하거나 다운로드하세요.
- 데스크톱과 모바일 앱은 직접 저장해야 할 때 알려줘요.
- 비공개 협업에서는 초대한 사람이 상대방의 변경 사항을 포함해 문서와 기록을 보관해요. 참여한 사람은 임시 사본으로 작업하므로 세션이 끝나기 전에 별도 사본을 저장해야 해요.

::: note 실수로 저장하지 않고 나갔나요?
작업하는 동안 저장하는 도구에서는 History가 버린 편집 내용의 사본을 30일 동안 보관해요. **History** 페이지를 열고 **Changes**에서 해당 내용을 찾아 **Open as a copy**를 누르세요. 다른 도구에서는 변경 사항이 사라져요.
:::

::: details 작업하는 동안 저장하는 도구
웹 앱에서는 Lolly Design, Lolly Chart, QR Code, Text, Lolly Sandbox처럼 문서를 만드는 모든 도구가 작업하는 동안 저장해요. 다음 도구는 그러지 않아요.

- Redact, Sign, Convert Image처럼 가져온 파일을 다루는 도구. Lolly가 그 파일의 사본을 보관하지 않기 때문이에요.
- Record, Lolly Screen Capture, Lolly Voice Recorder처럼 카메라, 마이크, 화면을 녹화·녹음하는 도구.
- Countdown처럼 바꿀 것이 없는 도구.

그 밖의 도구에서는 처음 내용을 바꾸면 저장한 것처럼 작업물을 **Projects**에 넣어요. 이후 변경 사항은 도구가 그리기를 마치면 보관돼요. 저장하지 않은 작업물은 탭을 닫아도 Projects에 남고, 다시 열면 변경 사항이 저장되지 않은 상태로 표시돼요.

**Leave anyway**는 여전히 그 변경 사항을 버려요. 홈 화면에서 도구를 다시 열면 새 작업물을 시작해요. 이전 작업물은 Projects에서 여세요.

3D와 Lolly Darkroom은 작업하는 동안 저장하지만, 3D 모델이나 LUT처럼 불러온 파일은 보관하지 않아요. History와 **Save**는 파일 자체가 아니라 파일의 이름, 유형, 크기를 보관해요. 작업물을 다시 열면 어떤 파일이었는지 안내가 나오고, 그 파일을 다시 불러올 때까지 도구는 파일 없이 작동해요. 원본 파일을 보관하세요.

[Sync](/info/sync.html)를 켜면 이렇게 보관된 작업물이 다른 기기로 이동해요. 버전은 만들어진 기기에 남아요.

작업물 하나를 두 탭에서 열고 둘 다 저장하면 마지막 저장본이 유지돼요. 대체된 작업물은 해당 작업물의 History에서 **Protected drafts** 아래에 있으며 **Open draft as a copy**로 열 수 있어요.

이 기능은 웹 앱에서만 작동하며 데스크톱이나 모바일 앱에서는 작동하지 않고, 다른 사람과 실시간으로 작업하는 동안에도 작동하지 않아요.
:::

<!--i:eti-download-->
## 다운로드한 파일 찾기

브라우저에서 **Download**는 파일을 브라우저에 넘겨요. 브라우저는 다운로드 폴더(보통 **Downloads**)에 파일을 저장하거나 저장할 곳을 물어요. Lolly는 파일이 어디로 갔는지 알 수 없으므로 브라우저의 다운로드 목록을 살펴보세요.

파일이 나타나지 않으면 도구를 떠나기 전에 내보내기 패널을 살펴보세요. **Download** 아래 한 줄에 파일 이름, 시간, **Retry download**가 있어요. Chrome, Edge, 그 밖의 Chromium 브라우저에서는 같은 줄에 폴더를 고르는 **Save file…**도 있어요. 이 줄과 파일은 도구를 떠나거나 새로고침하거나 다시 내보낼 때까지 유지돼요.

Lolly는 다운로드할 때마다 두 가지도 보관해요.

- **파일 사본**은 **Settings → Your renders**의 **Save my renders to my library**가 켜져 있으면 **Assets**의 **Your uploads**에 보관돼요(**Settings**는 홈 화면 아래에 있어요). 이 설정은 처음부터 켜져 있어요. 동영상이나 50 MB를 넘는 파일은 먼저 확인을 요청하고, zip은 복사하지 않아요.
- **사용한 설정**은 최근 다운로드 24개에 대해 보관돼요. **Projects**의 저장된 작업물 아래에 있는 **Recent exports**는 그 설정으로 도구를 다시 열어요. 기기에서 추가한 이미지와 파일은 포함되지 않아요. 같은 목록이 **Settings → Activity & stats → Latest exports**와 **History**의 **Changes** 탭에도 있어요.

::: details 데스크톱과 모바일 앱에서
- **데스크톱 앱:** **Download**는 대화상자 없이 **Downloads** 폴더 안의 **Lolly** 폴더에 저장해요. **Download** 아래 줄에 "Saved to Downloads/Lolly"처럼 파일이 저장된 곳과 **Show in folder**가 표시돼요. **Window** 또는 **Exports** 메뉴의 **Open Exports Folder**로 언제든 그 폴더를 열 수 있어요. 이전 파일과 이름이 같으면 "name (1)"로 저장돼요.
- **iPhone과 iPad:** 파일은 **Files** 앱의 **Lolly** 아래에 저장되고 공유 시트가 열려요. **Download** 아래 줄에는 "Saved to Files → Lolly"가 표시돼요.
- **Android:** 공유 메뉴가 열려요. 파일을 보낼 곳을 고르세요.

iPhone, iPad, Android에서는 새 파일이 이름이 같은 이전 파일을 대체해요.
:::

<!--i:eti-history-->
## 이전 버전으로 돌아가기

- **이번 방문 중:** **Undo**는 도구를 떠나거나 새로고침할 때까지 최근 변경 사항 100개를 차례로 되돌려요. [실행 취소와 다시 실행](/info/using.html#undo-and-redo)을 참고하세요.
- **[작업하는 동안 저장하는 도구](#which-tools-save-as-you-work)에서는:** 각 작업물의 이전 버전을 보관해요.
- **기기의 모든 데이터:** [Sync](/info/sync.html)를 켜면 **Settings → Connected services**의 **Restore an earlier copy**로 최근 일별 사본 일곱 개 중 하나 또는 마지막으로 적용하기 전의 사본을 복원해요. 그러면 이 기기의 모든 데이터가 그 사본과 같아져요.

이전 버전을 열려면:

1. **Undo**와 **Redo** 옆의 시계 버튼인 **History**를 누르세요. Lolly Design에서는 **History**가 상단 막대에 있어요. 휴대폰에서는 **•••**를 누른 다음 **History**를 누르세요. Text와 Lolly Sandbox처럼 **Undo**가 없는 도구에서는 **History**가 왼쪽 위의 **Home** 옆에 있어요.
2. 날짜와 시간으로 버전을 찾으세요. **Automatic checkpoint** 행은 작업하는 동안 만들어지고, **Saved version** 행은 직접 저장한 시점이에요.
3. **Open as a copy**를 누르세요. 해당 버전이 새 작업물로 열리고, 열려 있던 작업물은 그대로 유지돼요. 사본은 **Projects**에 있으며 이름 뒤에 "(copy)"가 붙어요.

버전에 이름을 붙여 보관하려면 **Name version**을 누르고 이름을 입력한 뒤 **Keep milestone**을 누르세요. 이름 붙인 버전은 **History** 페이지의 **Milestones** 아래에 나열돼요.

::: details History 패널과 History 페이지
**History** 패널에는 **Recovered work** 행도 있으며, **Protected drafts**에는 체크포인트 사이의 최신 편집 내용과 **Open draft as a copy**가 있어요. **Lolly Compare**와 **Check assets**는 사본을 열기 전에 선택을 도와줘요. 모든 작업물을 보려면 **This creation**을 **All history on this device**로 바꾸세요.

자동 체크포인트는 오래될수록 간격이 넓어져요. 최근 한 시간은 분당 하나, 최근 하루는 시간당 하나, 30일 동안은 하루 하나, 그 뒤로는 주당 하나예요. 저장한 버전과 이름 붙인 버전은 모두 보관해요. 작업물을 삭제하면 버전도 **Trash**로 이동하며, **Delete forever**로 제거돼요.

History 저장소가 가득 차면 30일 동안 열지 않은 작업물의 가장 오래된 자동 체크포인트부터 제거돼요. 그때도 저장본은 항상 보관돼요. 현재 작업물로 기록되며, History는 이 저장본을 버전으로 보관하지 않았다고 알려줘요. **Settings → Storage**에서 History가 쓰는 공간을 보여줘요.

**History** 페이지(`#/history`)는 이 브라우저의 모든 작업물을 다뤄요. 페이지를 열려면 홈 화면이나 **Projects** 오른쪽 위의 시계 버튼을 누르거나, 프로필 메뉴(휴대폰에서는 오른쪽 위의 둥근 로고 버튼)에서 **Saved sessions**를 고르거나, 도구의 History 패널에서 **Open app history**를 누르세요. 데스크톱과 모바일 앱에는 History 페이지가 없어요. 그 앱에서는 홈 화면의 시계 버튼과 **Saved sessions**가 **Your recent work**를 열어요. 최근 저장된 세션과 내보내기, Projects로 가는 링크가 있어요.

- **Recent**는 작업물을 최신순으로 나열하고 **Resume**을 제공해요.
- **Changes**는 체크포인트, 다운로드, Convert 결과를 하나의 타임라인에 놓아요. 다운로드에는 **Reopen settings**가 있어요.
- **Milestones**는 이름 붙인 버전을 나열해요.

각 작업물은 그림이 있는 타일이에요. **Grid**나 **List**로 레이아웃을 바꿔요. 프로젝트, 도구, 날짜로 걸러 내세요(휴대폰에서는 **Filters** 안에 있어요). 타일의 메뉴(우클릭하거나 길게 누르기)에는 **Resume**, **Versions**, **Show in Projects**, **Move to Trash**가 있어요. 여러 개를 제거하려면 선택한 뒤 **Move to Trash**를 고르세요. Undo가 제공돼요.
:::

<!--i:eti-folder-move-->
## 다른 기기로 작업물 옮기기

| 목적 | 사용 방법 |
|---|---|
| 기기를 같은 상태로 유지하기 | **Settings → Connected services**의 **Sync across devices**: [기기 동기화하기](/info/sync.html)를 참고하세요 |
| 모든 것을 한 번에 옮기기 | 아래의 **Export my data**와 **Import data…** |
| 디자인 하나나 프로젝트 하나 전달하기 | `.lolly` 파일: **Export**, **Share**, **Download .lolly** 순으로 누르세요. 프로젝트 전체는 폴더 메뉴의 **Download project (.lolly)**를 쓰세요. 다른 기기에서 **Open**을 누르세요. [.lolly 파일](/info/using.html#the-lolly-file)을 참고하세요 |

공유 링크는 설정을 담지만 기기에서 추가한 이미지나 파일은 담지 않아요.

::: note 가져오기는 추가만 하고 아무것도 삭제하지 않아요
파일의 폴더, 즐겨찾기, 템플릿은 다른 기기에 이미 있는 항목에 추가돼요. 저장된 항목이 양쪽에 있으면 더 최근에 저장한 사본을 보관해요. 그 기기의 사용자 정보와 설정은 그대로 유지돼요. 비어 있는 값은 파일에서 채워요. Sync의 **Bring it to this device**도 같은 방식으로 작동해요.
:::

모든 것을 한 번에 옮기려면:

1. 기존 기기에서 **Settings → Storage**를 열고 **Move to another device** 아래의 **Export my data**를 누르세요. Lolly가 `.zip` 파일 하나를 다운로드하며, 이름은 `LollyTools-`로 시작해요.
2. USB, 자신에게 보내는 이메일, AirDrop, 공유 폴더로 파일을 옮기세요.
3. 새 기기에서 **Settings → Storage**를 열고 **Import data…**를 누른 뒤 파일을 고르고 **Import**를 누르세요.

::: note 옮겨지지 않는 것
로그인 상태, 키, 동기화 암호 구문은 각 기기에 남아요. 최근 다운로드 목록, 오프라인 다운로드, AI 모델은 어떤 경로로도 옮겨지지 않아요. 버전 기록은 **Export my data** 파일로만 옮겨지며 Sync나 `.lolly`로는 이동하지 않아요. 기록이 파일 하나에 담기에는 너무 크면 가장 오래된 자동 체크포인트가 빠지고, 내보내기 줄에 빠진 개수가 표시돼요. Sync가 사용자 저장소에 보관하는 사본을 다운로드해 열거나, 백업 파일처럼 **Import data…**에서 고를 수 있어요. 암호화된 사본은 암호 구문을 요청해요.
:::

::: details 백업 파일에 담기는 것
파일 이름은 `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`이에요. 이름의 각 부분은 프로필에서 가져오며 설정하지 않았으면 빠져요. `<n>`은 같은 날 내보낸 횟수예요. 파일에는 폴더, Trash, 템플릿, 즐겨찾기가 포함된 프로필, 썸네일이 있는 모든 저장된 세션, 업로드한 이미지, 글꼴, 로고, 다운로드 사본, 디자인 시스템, 환경설정(테마, 사이드바 너비, 로컬 활동 통계), Convert의 저장된 버전과 결과, 그리고 웹 앱에서는 작업물의 버전 기록이 담겨요.

카탈로그 캐시는 포함되지 않아요. 새 기기에서 다시 다운로드해요. 각 부분에 체크섬이 있어 가져올 때 전송 중 손상된 파일을 감지해요. 저장된 세션은 가져온 이미지와 다시 연결돼요. 웹, 데스크톱, 모바일 앱은 같은 파일을 읽어요. 터미널 앱은 자체적으로 더 간단한 백업을 만들며, 이 형식으로는 읽을 수 없어요. **Export my data & render everything**은 같은 파일과 함께 모든 저장된 세션을 출력물로 렌더링한 두 번째 zip을 만들어요. 전체 형식은 [데이터 전송](/info/data-transfer.html)에 있어요.
:::

<!--i:eti-globe-->
## 브라우저 데이터를 지우면

웹 앱에서 Lolly는 모든 것을 브라우저의 이 사이트용 저장소에 보관해요. 저장된 작업물, 이미지, 글꼴, 디자인 시스템, 버전 기록, 오프라인 다운로드예요. 브라우저에서 이 사이트의 데이터를 지우면 모두 제거되며 Lolly는 아무것도 되살릴 수 없어요. 남는 것은 이미 브라우저 밖으로 나온 것이에요. 다운로드한 파일, **Export my data** 파일, [Sync](/info/sync.html) 사본, 공유한 링크예요.

::: warning 브라우저 데이터를 지우기 전에
**Settings → Storage**에서 **Export my data**를 누르고 파일을 다른 곳에 보관하세요.
:::

앱이 시작되면 Lolly는 기기의 공간이 부족해도 저장소를 지우지 말아 달라고 브라우저에 요청하며, 결정은 브라우저가 해요. **Settings → Available offline**에서 **Protected**로 시작하는 줄은 브라우저가 동의했다는 뜻이에요. "The browser may clear downloads if the device runs low on space"는 동의하지 않았다는 뜻이며, **Protect downloads**로 다시 요청해요.

브라우저가 동의하지 않았다면 공간이 부족할 때 다운로드뿐 아니라 저장된 작업물도 지울 수 있으므로 최신 **Export my data** 파일을 보관하세요.

**Settings → Storage**는 각 데이터 유형이 쓰는 공간을 보여줘요. **History** 행은 자동 체크포인트, 해당 미리보기, 복구 초안을 집계해요. **Remove automatic checkpoints older than 30 days**는 해당 공간을 확보하고 저장한 버전과 이름 붙인 버전은 보관해요. **Clear cache**는 다운로드한 카탈로그 파일을 지우며 필요할 때 다시 다운로드해요. **Clear all my data**는 단어 하나를 입력하도록 요청하고 Sync를 끈 뒤 Lolly가 이 브라우저에 보관하는 모든 것을 제거해요. 프로필과 설정, 기록이 포함된 저장된 세션과 Trash, 업로드, 글꼴과 디자인 시스템, 다운로드 로그, Convert 결과, 다운로드한 AI 모델과 오프라인 사본이에요. 다운로드한 파일은 저장한 곳에 남아요. 그다음 앱은 처음 방문했을 때처럼 시작해요.

![휴대폰 너비 화면의 저장소 카드: 기기 내 데이터의 모든 범주가 이름으로 표시되고 아래에 Clear all my data 버튼이 있어요](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

데스크톱과 모바일 앱에서 저장된 세션은 앱 자체 데이터 폴더의 파일이며, 그 밖의 모든 것은 앱 자체 저장소에 있어요. 웹 브라우저를 지워도 이 데이터에는 영향이 없어요.

::: details 데스크톱과 모바일 앱이 저장된 세션을 보관하는 곳
`saved-state` 폴더에 저장된 세션마다 파일 하나씩 있어요.

- macOS: `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows: `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux: `~/.local/share/tools.lolly.Desktop/saved-state/` 또는 `$XDG_DATA_HOME` 아래의 같은 경로
- iPhone, iPad, Android: Files 앱에 표시되지 않는 앱 자체 저장소 안

이미지, 디자인 시스템, 최근 다운로드 목록은 이 폴더가 아니라 앱의 내부 저장소에 남아요. 터미널 앱과 명령줄은 같은 `saved-state` 폴더를 읽어요. [저장된 세션이 있는 곳](/info/cli-reference.html#where-saved-sessions-live)을 참고하세요.
:::

<!--i:eti-trash-->
## 삭제한 항목 되찾기

앱에서 저장된 세션, 폴더, 업로드한 항목, 사용자 글꼴을 삭제하면 어디서 삭제하든 30일 동안 **Trash**로 이동해요. **Projects**, **Assets**, **Settings → Storage**, 도구의 저장된 세션 목록 모두 마찬가지예요. 폴더와 그 안의 모든 내용은 하나의 항목으로 Trash에 가요. 세션은 Trash에서도 버전 기록을 유지해요. 삭제 직후에는 메시지에 **Undo**가 나타나요. 나중에 되찾으려면:

1. **Trash**를 여세요. **Projects**의 **Trash** 타일, **Assets → Your uploads**의 **Trash** 버튼, **Settings → Storage**의 **Trash** 행 중 하나를 쓰세요. 셋 다 같은 목록을 열어요.
2. 항목 옆의 **Restore**를 누르세요. 원래 폴더로 돌아가며, 글꼴은 디자인 시스템에서 맡았던 역할도 되찾아요.

**Delete forever**는 항목 하나를 영구적으로 제거해요. **Empty Trash**는 먼저 확인을 요청한 뒤 Trash의 모든 항목을 제거해요. 30일이 지난 항목은 영구적으로 제거돼요.

::: warning 일부 삭제는 즉시 적용돼요
디자인 시스템, 로고, 프로필 사진을 삭제하면 Trash로 가지 않아요. 명령줄과 터미널 앱에서도 즉시 삭제돼요.
:::

[Sync](/info/sync.html)를 켜면 **Restore an earlier copy**로 기기 전체를 이전 날짜의 상태로 되돌릴 수 있으며, **Export my data** 파일로는 그 파일에 담긴 것을 복원해요.
