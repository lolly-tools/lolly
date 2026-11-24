# 설정

설정에는 개인 정보, 디자인 시스템, 접근성, 이 기기의 저장소, 오프라인 다운로드가 있어요. 홈 화면 아래쪽 막대나 아바타 메뉴에서 **Settings**를 열면 **Preferences**가 표시돼요.

| 탭 | 주소 | 담긴 내용 |
|---|---|---|
| **Preferences** | `#/settings` | 개인 정보, 디자인 시스템, 모양, 이모지, 접근성, 연결, 저장소, 오프라인 다운로드 |
| **This device** | `#/settings?tab=device` | 이 브라우저와 컴퓨터의 실시간 정보, 소리, 읽기 전용 저장소 보기 |
| **Design system** | `#/settings?tab=brand` | 표지와 페이지로 표시되는 활성 디자인 시스템, 시스템을 전환하는 표지 띠 |
| **Capabilities** | `#/settings?tab=caps` | 검색 가능한 카드로 표시되는 Lolly의 모든 기능 |
| **Activity & stats** | `#/settings?tab=activity` | 카탈로그, 로컬 집계, 최근 작업 |

기존 `#/profile`과 `#/d` 링크도 여전히 개별 설정까지 올바른 위치를 열어요.

<!--i:eti-sliders-->
## 환경설정

Preferences는 옆쪽에 **설정 레일**이 있는 긴 페이지 하나예요. 레일 위의 **Search settings** 입력란에 입력하면 레일이 필터링돼요. 각 섹션에는 `#/settings?focus=storage-section`처럼 `#/settings?focus=<section-id>` 형식의 링크가 있어요.

- <!--i:usercheck--> **Your details** - 이름, 연락처, 인물 사진, **Use my details to create** 스위치예요. [프로필](/info/profile.html)에서 도구가 이 정보를 어떻게 사용하는지 설명해요.
- <!--i:seal--> **Content Credentials** - 내보내기 파일에 서명하는 선택적 확인된 ID예요. [Content Credentials](/info/content-credentials-identity.html)를 참고하세요.
- <!--i:palette--> **Design systems** - 디자인 시스템을 전환하고, 추가하고, 숨기고, 제거해요. [Lolly Design System Setup](/info/brand-studio.html#manage-your-design-systems)에서 각 동작을 다뤄요.
- <!--i:moon--> **Appearance** - 테마(Light, Dark 또는 앱을 자신의 팔레트로 꾸미는 Brand), 디자인 시스템에 컬러웨이가 둘 이상 있을 때의 **Your colourway**([컬러웨이를 나만의 것으로 만들기](/info/colourways.html#make-a-colourway-your-own)), **Interface follows the design system**이 있어요.
- <!--i:sparkle--> **Emoji** - 새 작업에 쓸 이모지 세트와 그 아트워크 라이선스, 자신의 팔레트로 이모지 색상을 바꾸는 강도(**Off**, **Subtle**, **Strong**, **Full**, **Mono**, **Duotone**)예요. **Keep skin tones and flags**는 피부색과 국기를 원래 색상으로 유지해요. 이미 만든 작업물은 기존 세트를 유지해요.
- <!--i:eyeoff--> **Accessibility** - 편안한 사용을 위한 스위치 네 개와 Sound, Neurospicy Mode가 있어요. [접근성](#accessibility)을 참고하세요.
- <!--i:link--> **Connected services** - Dropbox, Google Drive, OneDrive, Nextcloud, S3 등 연결한 저장소와 **Sync across devices**예요. [기기 동기화하기](/info/sync.html)를 참고하세요.
- <!--i:globe--> **Trusted sites** - Lolly Design의 웹 페이지 박스나 Lolly Sandbox 데모가 묻지 않고 접속할 수 있는 사이트와, 서버가 제공하는 경우 **Allow pages from any site**가 있어요. [개인정보 처리방침](/info/privacy.html)에 각 요청이 보내는 내용이 나열돼 있어요.
- <!--i:download--> **Your renders** - **Save my renders to my library**는 다운로드하는 이미지, 오디오 클립, 동영상 각각의 사본을 Assets에 Renders 태그로 보관해요.
- <!--i:database--> **Storage** - Lolly가 이 기기에 보관하는 것과 데이터를 지우거나 옮기는 버튼이에요. [저장소](#storage)를 참고하세요.
- <!--i:cpu--> **Available offline** - 연결이 끊기기 전에 필요한 것을 다운로드해요. [오프라인에서 사용하기](#available-offline)를 참고하세요.
- <!--i:folder--> **Hot folder** - 데스크톱 앱에서 Lolly가 폴더 하나를 감시하고, 끌어다 놓기와 같은 선택기를 통해 그 안에 넣은 모든 것을 가져와요.
- <!--i:clock--> **Your activity** - 이 기기에서 만든 것을 로컬에서 집계해요.
- <!--i:sliders--> **Feature flags** - **Print preflight**, **Strip metadata from uploads** 같은 앱 기능을 켜거나 꺼요. **Performance UI**는 그리는 데 자원이 덜 드는 단순한 모습으로 앱을 바꿔요. 느린 기기에서는 Lolly가 Performance UI를 스스로 켤 수 있어요. 그러면 스위치 아래 줄에 언제, 왜 켰는지와 **Allow again**이 표시돼요([판단 방식](/info/configuration.html#curating-what-people-see)).
- <!--i:server--> **Lolly instance** - 이 설치 환경이 도구와 카탈로그를 가져오는 곳이에요. [Lolly 인스턴스](#lolly-instance)를 참고하세요.

테마 카드는 실시간 미리보기예요. 테마는 선택하는 즉시 이 기기에만 적용돼요.

![각각 자체 서체와 색상을 미리 보여주는 테마 카드 세 개. 활성 카드에는 표시가 있어요](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### 접근성

**Settings → Preferences → Accessibility**에는 앱을 편안하게 쓰기 위한 설정 네 가지가 있어요. 모두 직접 켜기 전에는 꺼져 있고 도구 캔버스나 내보내기에는 영향을 주지 않으므로, 앱이 차분해져도 전달할 파일은 한 픽셀도 달라지지 않아요. 모두 기본적으로 꺼져 있어요. 어느 것도 도구 캔버스나 내보내기를 바꾸지 않아요.

- <!--i:pause--> **Reduce motion**은 앱의 전환, 슬라이드, 장식 효과를 꺼요.
- <!--i:photos--> **Hide colourful previews**는 갤러리 미리보기 아트워크를 아이콘과 텍스트 카드로 바꾸고, 프로젝트 썸네일을 알아볼 수 있게 유지하면서 색을 차분하게 해요.
- <!--i:sliders--> **High contrast**는 앱의 테두리, 텍스트, 포커스 윤곽선을 더 뚜렷하게 해요. 브랜드 색상과 캔버스는 설정한 그대로 유지돼요.
- <!--i:font--> **Large text**는 앱의 라벨, 메뉴, 버튼 글자를 키워요.

**Dominant hand**(Right 또는 Left)는 폴더블 기기나 정사각형에 가까운 태블릿에서 Lolly가 창 두 개를 보여줄 때 컨트롤이 어느 쪽에 놓일지 정해요. 창 제목 영역의 **Swap sides**로도 바꿀 수 있어요.

이 설정들은 프로필에 저장되므로 프로필을 내보낼 때 이름, 세션과 함께 이동해요. 기기 전용 사본이 첫 화면을 그리기 전에 적용해요.

같은 카드에는 갤러리 도착, Content Credentials 결과, 패널 닫기 같은 동작을 부드러운 보조 소리로 알려주는 **Sound**가 있어요. 차분한 집중용 트랙인 **Neurospicy Mode**도 있어요. Neurospicy를 켜면 모서리에 작은 플레이어가 열려 앱 어디에서든 함께해요. 플레이어에서 트랙을 고르고, 건너뛰고, 음량을 설정하고, 플레이어를 최소화하거나 닫을 수 있어요. 트랙에는 Lolly의 생성형 스테이션, 앰비언트 루프와 비트, 자신의 오디오, 연결이 필요한 인터넷 라디오 스테이션이 있어요. 둘 다 기본적으로 꺼져 있으며 선택을 기억해요. Sound를 끄면 집중용 트랙도 음소거돼요. 프로필 메뉴와 **This device**에도 같은 스위치가 있어요.

Sound 스위치 아래의 슬라이더는 소리를 구성하는 요소를 정해요. 둥근 **Bouba** 덩어리 쪽으로 옮기면 부드러운 물방울, 거품, 약간의 베이스 소리가 돼요. 뾰족한 **Kiki** 별 쪽으로 옮기면 건조한 틱 소리, 긁는 소리, 금속 소리가 돼요. 가운데에서는 Lolly의 차임과 음을 유지해요. 한쪽 끝의 소리가 견디기 힘들면 반대쪽으로 옮기세요. Sound가 꺼져 있어도 슬라이더는 동작하며, 슬라이더를 놓으면 짧은 샘플이 재생돼요.

::: details 생성형 스테이션
생성형 스테이션은 샘플이나 녹음된 목소리 없이 재생하면서 음악을 작곡해요. 각 곡에는 고유한 악기, 그루브, 진행 순서가 있어요.

- **Lolly Sings**는 여러 스테이션으로 이뤄져 있어요. 원래의 Lolly Sings는 밝고 선율이 뚜렷해요. 장조, 모든 곡의 리드 선율, 보사, 셔플, 칩튠의 색채가 특징이에요. Sugar와 K-pop부터 Country, Jazz, Metal, D&B까지 각 장르에도 자체 스테이션이 있어요.
- **Lofi stations**(Warm, Late night, Rainy)는 끝없이 이어지는 로파이 비트예요.

생성형 스테이션에서 다음과 이전은 곡 사이를 이동해요. 각 곡은 시드에서 나오므로 어디에 공유하거나 저장해도 같은 곡이 재생돼요([생성형 음악](/info/generated-music.html) 참고). 재생 컨트롤 아래의 **Mood**는 Lofi 스테이션 사이를 전환하고, **Drums**는 드럼 키트를 빼고, **Texture**는 깨끗한 소리부터 먼지 낀 레코드 소리까지 조절해요. 그다음에는 아이콘 버튼이 한 줄로 있어요. 버튼 위에 포인터를 올리거나 길게 누르면 이름을 볼 수 있어요:

- 음표 아이콘인 **Open in the music generator**는 `#/music`에서 곡을 열어 구간별로 악기를 바꿀 수 있게 해요.
- 링크 아이콘인 **Share this tune or moment**는 같은 곡을 재생하는 링크 또는 현재 위치에서 시작하고 현재 프리셋과 색상으로 시각화 화면도 보여주는 링크를 제공해요.
- 폴더 아이콘인 **Save to library**는 곡을 에셋에 보관해요.
- 번개 아이콘인 **Light visualiser**는 아래에서 설명하는 스위치예요.

저장한 곡은 해당 스테이션 그룹 아래에 조성과 템포로 표시돼요. 저장한 곡을 고르면 같은 곡이 다시 재생되고, 다른 트랙처럼 반복되거나 순차 재생 모드에서는 다음 곡으로 넘어가요. 스테이션과 곡 번호만 몇 바이트로 저장하며, 음악은 재생하면서 다시 작곡돼요. 에셋에서 저장한 곡의 이름을 바꾸거나 삭제하고, 동영상 배경 음악으로 쓸 수 있어요. Lolly Demo와 Lolly Start에는 각각 저장된 곡 여섯 개가 들어 있어요.

시각화 기능은 모든 트랙을 일정한 레벨로 받아들이므로, 어떤 음량에서든 조용한 트랙도 큰 트랙만큼 화면을 움직여요. Lolly Sings의 각 장르와 해당 장르에서 저장한 곡은 **Light visualiser**를 제공해요. 음악에 필요한 처리 시간을 확보해 주는 단순한 레벨 막대예요. Light visualiser는 터치 화면과 코어가 4개 이하이거나 메모리가 4 GB 이하인 기기에서 처음부터 켜져 있어요.
:::

키보드로 인터페이스를 사용할 수 있어요. 맞춤 컨트롤에는 화면 읽기 프로그램용 라벨이 있어요. 각 도구의 실시간 미리보기는 표시하는 내용을 설명하는 라벨이 붙은 이미지 하나예요.

### 저장소

저장소 미터는 이 설치 환경이 보관하는 모든 바이트를 범주별로 나누어 브라우저가 보고하는 수치와 비교해 보여줘요.

![저장된 세션, 이미지, 캐시를 나누어 브라우저가 실제로 보고하는 수치와 비교해 보여주는 저장소 미터](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

미터 아래에는:

- **Move to another device**에는 **Export my data**, **Import data…**, **Export my data & render everything**이 있어요. [작업물을 다른 기기로 옮기기](/info/find-your-work.html#move-your-work-to-another-device)에서 차례로 안내해요.
- **Clear cache**는 다운로드한 카탈로그 파일을 지우며, 필요할 때 다시 다운로드해요.
- **Remove automatic checkpoints older than 30 days**는 History 공간을 확보하고 저장한 버전과 이름을 붙인 버전은 유지해요.
- **Clear all my data**는 확인용 단어를 입력한 뒤 Lolly가 이 브라우저에 보관한 모든 것을 지워요. [브라우저 데이터를 지우면](/info/find-your-work.html#if-you-clear-your-browser-data)에 지워지는 항목이 나열돼 있어요.

### 오프라인에서 사용하기

Lolly는 방문한 화면만 캐시해요. **Available offline**은 필요한 부분을 하나의 진행률 막대로 다운로드하며, 다운로드한 부분은 연결이 없어도 계속 동작해요.

- <!--i:monitor--> **App, catalogue and guides** - **The app**(아직 열어 보지 않은 화면을 포함한 모든 보기, 편집기, 글꼴), **Catalogue**(전체 또는 **Choose by tag**), **Guides & docs**(스크린샷을 포함한 사용자 언어의 이 문서)예요.
- <!--i:cpu--> **AI models** - 기기에서 실행되는 각 모델이 크기와 함께 별도 행에 표시돼요. Speech voices, Upscaling models, Background removal, Text recognition, Lolly Verify deep scan, Durable credential, Rewriter model, Ask matching model, AI text detector, Singing voices가 있어요. 50 MB가 넘는 모델에는 **large download**가 표시돼요.
- <!--i:wrench--> **Tools** - 도구를 각각 다운로드하거나 **Download all**로 모든 도구를 받아요. 체크 표시는 오프라인에서 쓸 준비가 됐다는 뜻이에요.

맨 위의 **Download everything**은 앱, 선택한 범위의 카탈로그, 가이드, 모든 도구를 받아요. **Include all the AI models**를 선택해 모델을 추가하거나 각 모델의 행에서 다운로드하세요. 노래하는 음성은 해당 행에서만 다운로드할 수 있어요. 조직 정책에 따라 AI 다운로드가 꺼질 수 있으며, 이때는 각 행에 그 상태가 표시돼요.

취소하거나 연결이 끊겨도 다운로드는 멈춘 곳에서 이어져요. 다시 온라인이 되면 새 버전을 확인하고 릴리스에서 바뀐 것만 받아요. 브라우저가 영구 저장소를 허용하지 않았다면 **Protect downloads**가 그 권한을 요청해요. 권한이 없으면 브라우저가 공간을 확보하려고 다운로드를 삭제할 수 있어요.

### Lolly 인스턴스

**Lolly instance**는 이 설치본이 도구와 카탈로그를 받는 곳을 알려줘요. 인스턴스 주소가 표시되거나, 빌드 안에 모든 것이 포함돼 있으면 *Bundled with this app*이 표시돼요.

- **Design-system source**는 제공된 디자인 시스템의 출처를 보여줘요.
- **Instance console**은 배포 환경에서 관리자 페이지를 제공하면 그 페이지를 열어요.
- **Change**는 데스크톱 앱이 다른 인스턴스를 사용하게 해요. 브라우저는 다른 출처의 도구와 에셋을 불러올 수 없으므로 웹에서는 이 섹션에 **Open a workspace**가 대신 표시돼요.
- **Leave**는 인스턴스의 디자인 시스템, 도구, 카탈로그를 제거해요. 사용자의 작업물은 남아요. [조직에서 Lolly 사용하기](/info/organisation.html#leaving)를 참고하세요.
- 조직에 로그인한 상태에서 **Sign out**은 이 세션을 끝내고 **Sign out everywhere**는 이 기기를 포함한 모든 기기의 세션을 끝내요.

<!--i:eti-monitor-->
## 이 기기

- <!--i:monitor--> **This Machine** - 화면, 입력, 그래픽, 메모리, 코덱, 저장소 백엔드 등을 이 세션에서 실시간으로 읽어요. 저장되거나 전송되는 것은 없어요. 넓은 화면에서는 이 패널이 자동으로 열리고 탭이 두 열로 표시돼요.
- <!--i:neurobeat--> **Sound** - 인터페이스 소리와 Neurospicy 집중 루프예요. 이 탭에서 무언가를 저장하는 스위치는 Sound뿐이에요.
- <!--i:database--> **Storage** - 저장 공간 표시를 읽기 전용으로 보여줘요. 데이터 지우기와 옮기기는 [Preferences](#storage)에서 해요.

<!--i:eti-palette-->
## 디자인 시스템

현재 디자인 시스템을 살펴볼 수 있게 펼쳐 보여줘요. 이 브라우저에 디자인 시스템이 둘 이상 있으면 맨 위의 표지 띠에 나열돼요. 하나를 선택하면 활성화돼요. 뒤이어 나타나는 알림의 **Undo**로 이전 시스템을 되돌려요.

![Lolly Demo의 Design system 탭: 시스템 전환용 표지 띠 아래에 로고, 이름, 설명, 각 페이지를 여는 개수가 있는 표지](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

탭을 열면 시스템 자체 색상으로 칠한 표지에 로고, 디스플레이 서체로 쓴 이름, 작성자가 쓴 설명이 보여요. 표지의 한 줄로 나열된 개수는 각 페이지로 연결돼요.

- <!--i:palette--> **Colour** - 밝은 모습과 어두운 모습의 표면색, 텍스트색, 기본색, 보조색, 이름과 16진수 값이 있는 칩으로 표시한 모든 명명된 색상, 각 틴트 램프와 차트 스펙트럼의 띠, 접히는 영역의 색상 역할을 보여줘요. 값을 선택하면 16진수 값을 복사해요.
- <!--i:font--> **Type** - Headings, Text, Emphasis, Code를 각각의 서체로 보여줘요.
- <!--i:photos--> **Logos** - 각 로고 파일을 그 로고에 맞는 배경 위에 보여줘요.
- <!--i:layers--> **Colourways** - 시스템에 컬러웨이가 둘 이상이면 각 컬러웨이의 밝음과 어두움 쌍을 보여줘요.
- <!--i:sliders--> **Tokens** - 반경, 간격, 효과, 그라디언트예요.
- <!--i:document--> **Print & CMYK** - 정확한 잉크로 고정한 색상과 CMYK PDF가 명시할 수 있는 인쇄 조건이에요.

이 탭에서 바꿀 수 있는 것은 시스템 전환뿐이에요. 디자인 시스템은 표지에서 연결되는 `#/start`의 [Lolly Design System Setup](/info/brand-studio.html)에서 편집하세요. 읽기 전용 시스템은 표지에 그렇게 표시돼요. 직접 만든 로컬 시스템은 계속 편집할 수 있어요. `/b`와 `/brand`는 이 탭의 짧은 링크예요.

<!--i:eti-grid-->
## 기능

플랫폼의 모든 부분은 열두 그룹의 카드로 구성돼요. Experiences, Platforms & runtimes, Accessibility & languages, Export formats, Import formats, Print production, Automation & AI, Determinism & reproducibility, Brand & design system, Privacy & data ownership, Security & access control, Architecture (for builders)예요. 각 그룹은 접을 수 있고 카드 개수를 보여줘요. 카드를 열면 해당 기능의 세부 사항이 대화상자에 나타나며, 카드의 절반 정도는 이 문서에서 쓰는 스크린샷도 보여줘요.

그룹 위의 검색 입력란은 입력할 때마다 카드를 걸러 내고 일치하는 카드가 있는 그룹을 열어요. 입력란에는 검색 대상 기능의 개수가 표시돼요. 일치하는 결과가 없으면 글로 알려줘요.

이 탭은 이 가이드에 맞춰 Lolly가 할 수 있는 일을 설명해요. 지금 쓰는 기기를 검사하지는 않아요. 그 일은 **This device**가 맡아요.

<!--i:eti-gauge-->
## 활동과 통계

먼저 빌드를 보여줘요. 불러온 도구 수, 내보내기 형식, 플랫폼이 실행되는 환경, 카탈로그의 브랜드 에셋이에요. **Catalogue** 패널은 이 빌드에 포함된 항목을 세부적으로 보여줘요.

그다음은 사용자의 작업이에요. **Your activity**는 이 기기에서 만든 것을 집계해요. **Recent creations**와 **Latest exports**는 밀어서 살펴볼 수 있는 카드 묶음이며, 항목이 생기면 표시돼요. 둘 다 항목을 그때 상태 그대로 열어요. 이 집계는 기기에 남아요. 선택 사항인 Lolly Work 인스턴스는 자체 [조직 텔레메트리와 감사 기록](/info/privacy.html#organisation-services-with-lolly-work)을 보관해요.

<!--i:eti-link-->
## 딥 링크

Settings의 모든 탭과 섹션에는 북마크하거나 붙여넣을 수 있는 자체 링크가 있어요. [Lolly Search](/info/search.html)는 Settings와 같은 레지스트리에서 **Settings** 결과를 만들므로 섹션 이름이 바뀌어도 검색 결과의 연결이 끊기지 않아요.

::: details 모든 링크 형식

- **탭:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Preferences 섹션:** `#/settings?focus=<section-id>`, 예를 들어 `#/settings?focus=offline-section`이에요.
- **특정 섹션:** 해당 id를 값 없는 플래그로 써요. 예를 들어 `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways`, `#/settings?cap-formats`예요. 이전의 `#/settings?dash-lock`과 `#/settings?dash-palette-wheel` 링크는 표지와 Colour 페이지를 열어요.
- **키워드로 찾는 섹션:** `#/settings?print`, `#/settings?formats`, `#/settings?palette`(Colour 페이지), `#/settings?tokens`예요. 두 섹션이 같은 키워드를 쓸 수 있어요. `print`는 브랜드 탭의 인쇄 참조와 Print production 그룹에 모두 속하며, 페이지 순서에서 먼저 나오는 쪽이 열려요. 하나를 지정하려면 id를 쓰세요.

딥 링크는 대상이 있는 탭으로 전환하고 대상이 접혀 들어가 있는 그룹을 모두 열어요. 그다음 위쪽 섹션의 배치가 끝나면 대상으로 스크롤해요. 더 이상 쓰지 않는 `#/platform`과 `#/capabilities` 주소는 딥 링크 플래그를 그대로 유지한 채 Settings에서 열려요.
:::

---

**관련 문서:** [프로필](/info/profile.html)은 사용자 정보와 작업하는 맥락을 다뤄요. [Lolly Design System Setup](/info/brand-studio.html)은 Design system 탭에 표시되는 내용을 편집하는 곳이에요. [작업물 찾기와 복구](/info/find-your-work.html)는 저장소, 백업, 기기 이전을 다뤄요.
