# Settings

Settings에서는 Lolly가 나에게 맞게 동작하는 방식을 바꿔요. 내 세부 정보, 사용하는 디자인 시스템, 접근성, 이 기기에 저장된 것, 오프라인으로 준비된 것이에요. 홈 화면 하단 막대의 **Settings** 또는 아바타 메뉴에서 열어요. **Preferences**로 열리며 옆에 탭이 네 개 더 있어요.

| 탭 | 주소 | 담는 것 |
|---|---|---|
| **Preferences** | `#/settings` | 내 세부 정보, 디자인 시스템, 모양, 이모지, 접근성, 연결, 저장소, 오프라인 다운로드 |
| **This device** | `#/settings?tab=device` | 이 브라우저와 기기의 실시간 정보, 소리, 읽기 전용 저장소 보기 |
| **Design system** | `#/settings?tab=brand` | 표지와 페이지로 보는 활성 디자인 시스템과, 시스템을 전환하는 표지 띠 |
| **Capabilities** | `#/settings?tab=caps` | Lolly가 할 수 있는 모든 것을 검색 가능한 카드로 |
| **Activity & stats** | `#/settings?tab=activity` | 카탈로그, 로컬 카운터, 최근 작업 |

각 탭에는 자체 주소가 있으며, 예전 `#/profile`과 `#/d` 링크도 개별 설정까지 올바른 곳을 열어요.

## Preferences

Preferences는 옆에 **설정 레일**이 있고 레일 위에 입력하는 대로 걸러주는 **Search settings** 입력란이 있는 긴 페이지 하나예요. 모든 섹션은 `#/settings?focus=<section-id>` 형태의 링크로 바로 열려요. 예: `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details**: 이름, 연락처, 프로필 사진, **Use my details to create** 스위치예요. [프로필](/info/profile.html)이 도구가 이를 쓰는 방식을 설명해요.
- <!--i:seal--> **Content Credentials**: 내보내기에 서명하는 선택적 검증된 신원이에요. [Content Credentials](/info/content-credentials-identity.html)를 참고하세요.
- <!--i:palette--> **Design systems**: 디자인 시스템을 전환, 추가, 숨기기 또는 제거해요. [Design System Setup](/info/brand-studio.html#manage-your-design-systems)이 각 동작을 다뤄요.
- <!--i:moon--> **Appearance**: 테마(Light, Dark, 또는 팔레트로 앱을 칠하는 Brand)와 **Interface follows the design system**이에요.
- <!--i:sparkle--> **Emoji**: 새로 시작할 때 이모지를 그리는 세트와 그 아트워크 라이선스, 팔레트가 이를 얼마나 강하게 다시 칠하는지(**Off**, **Subtle**, **Strong**, **Full**, **Mono**, **Duotone**)예요. **Keep skin tones and flags**는 피부색과 국기를 자체 색상으로 둬요. 이미 만든 작업물은 만들 때의 세트를 유지해요.
- <!--i:eyeoff--> **Accessibility**: 편의 스위치 네 개와 Sound 및 Neurospicy Mode예요. [접근성](#accessibility)을 참고하세요.
- <!--i:link--> **Connected services**: Dropbox, Google Drive, OneDrive, Nextcloud, S3 같은 연결하는 저장소와 **Sync across devices**예요. [기기 Sync](/info/sync.html)를 참고하세요.
- <!--i:globe--> **Trusted sites**: Design 웹 페이지 박스나 Sandbox 데모가 묻지 않고 접속할 수 있는 사이트와, 서버가 제공하는 경우 **Allow pages from any site**예요. [개인정보 처리방침](/info/privacy.html)이 각 요청이 보내는 것을 나열해요.
- <!--i:download--> **Your renders**: **Save my renders to my library**는 다운로드하는 각 이미지, 오디오 클립, 동영상의 사본을 Renders 태그로 Assets에 보관해요.
- <!--i:database--> **Storage**: Lolly가 이 기기에 보관하는 것과, 데이터를 지우거나 옮기는 버튼이에요. [저장소](#storage)를 참고하세요.
- <!--i:cpu--> **Available offline**: 연결이 끊기기 전에 필요한 것을 내려받아요. [오프라인 사용](#available-offline)을 참고하세요.
- <!--i:folder--> **Hot folder**: 데스크톱 앱에서 폴더 하나를 감시하고 드래그 앤 드롭과 같은 선택기를 통해 그곳에 놓인 것을 Lolly로 가져와요.
- <!--i:clock--> **Your activity**: 이 기기에서 만든 것을 로컬로 집계해요.
- <!--i:sliders--> **Feature flags**: **Print preflight**나 **Strip metadata from uploads**처럼 앱의 일부를 켜고 꺼요.
- <!--i:server--> **Lolly instance**: 이 설치가 도구와 카탈로그를 가져오는 곳이에요. [Lolly 인스턴스](#lolly-instance)를 참고하세요.

테마 카드는 실시간 미리보기이며 고르는 즉시 이 기기에만 적용돼요.

![Three theme cards, each previewing its own type and colour, with the active one flagged](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### 접근성

**Settings → Preferences → Accessibility**에는 작업물 주변 앱을 위한 편의 설정 네 가지가 있어요. 각각 켜기 전까지 꺼져 있으며, 어느 것도 도구 캔버스나 내보내기 안으로 들어가지 않으므로 더 차분한 앱이 내보내는 파일의 픽셀 하나도 움직이지 않아요.

- <!--i:pause--> **Reduce motion**은 앱의 전환, 슬라이드, 장식 효과를 꺼요. 캔버스와 애니메이션 내보내기는 설계된 대로 계속 움직여요.
- <!--i:photos--> **Hide colourful previews**는 갤러리의 미리보기 아트워크를 차분한 아이콘과 텍스트 카드로 바꾸고, 프로젝트 썸네일은 시끄럽지 않으면서 알아볼 수 있게 낮춰요.
- <!--i:sliders--> **High contrast**는 앱의 테두리, 텍스트, 포커스 링을 강화해요. 브랜드 색상과 캔버스는 설정한 대로 유지돼요.
- <!--i:font--> **Large text**는 앱의 라벨, 메뉴, 버튼 텍스트를 키워요. 디자인 안의 글꼴은 그대로이므로 내보내는 것의 줄바꿈이 달라지지 않아요.

이 설정은 프로필에 있으므로 프로필 내보내기에 담겨 이동하고, 다음 설치에 이름과 세션과 함께 도착해요. 기기에만 있는 작은 사본이 첫 화면이 그려지기 전에 이를 적용해요.

같은 카드에 **Sound**와 **Neurospicy Mode**가 있어요. Sound는 갤러리에 도착하기, Content Credentials 결과, 패널 닫기 같은 동작에 대한 부드러운 보조 소리 층이고, Neurospicy Mode는 차분한 집중 트랙이에요. Neurospicy를 켜면 앱 전체를 따라다니는 작은 플레이어가 모서리에 열려요. 거기서 트랙을 고르고, 건너뛰고, 볼륨을 설정하고, 플레이어를 최소화하거나 닫아요. 트랙에는 절차적 *Lolly Sings* 곡, 앰비언트 루프와 비트, 직접 올린 오디오, 연결이 필요한 인터넷 라디오 방송국이 있어요. 둘 다 기본으로 꺼져 있고 기억되며, Sound를 끄면 집중 트랙도 음소거돼요. 프로필 메뉴와 **This device**에도 같은 스위치가 있어요.

인터페이스는 키보드로 탐색할 수 있고, 사용자 지정 컨트롤에는 스크린 리더용 라벨이 있으며, 각 도구의 실시간 미리보기는 보여주는 것을 설명하는 라벨 붙은 이미지 하나로 노출돼요.

### 저장소

저장소 미터는 이 설치가 보유한 모든 바이트를 범주별로, 브라우저가 보고하는 값과 비교해서 계산해요.

![저장소 미터: 저장된 세션, 이미지, 캐시를 브라우저가 실제로 보고하는 값과 비교해 나눠 보여줘요](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

미터 아래에는 다음이 있어요.

- **Move to another device**에는 **Export my data**, **Import data…**, **Export my data & render everything**이 있어요. [작업물을 다른 기기로 옮기기](/info/find-your-work.html#move-your-work-to-another-device)가 안내해요.
- **Clear cache**는 내려받은 카탈로그 파일을 지우며, 필요하면 다시 내려받아요.
- **Remove automatic checkpoints older than 30 days**는 History 공간을 비우고 저장된 버전과 이름 붙인 버전은 유지해요.
- **Clear all my data**는 단어를 입력해 확인한 뒤 Lolly가 이 브라우저에 보관하는 모든 것을 제거해요. [브라우저 데이터를 지우면](/info/find-your-work.html#if-you-clear-your-browser-data)이 무엇이 사라지는지 나열해요.

### 오프라인 사용

Lolly는 방문한 화면을 캐시하지만, 이미 가 본 곳만 다뤄요. **Available offline**은 예상되는 여행을 위한 것이에요. 필요한 부분을 내려받고 진행 막대 하나를 지켜보면, 가져간 모든 것이 연결 없이도 계속 동작해요.

- <!--i:monitor--> **App, catalogue and guides**: **The app**(열어 본 적 없는 화면을 포함한 모든 보기, 편집기, 글꼴), **Catalogue**(전체 또는 **Choose by tag**), **Guides & docs**(스크린샷을 포함한 사용 중인 언어의 이 문서)예요.
- <!--i:cpu--> **AI models**: 각 온디바이스 모델이 크기와 함께 한 행씩 있어요. Speech voices, Upscaling models, Background removal, Text recognition, Verify deep scan, Durable credential, Rewriter model, Ask matching model, AI text detector, Singing voices예요. 50 MB가 넘는 모델에는 **large download**가 표시돼요.
- <!--i:wrench--> **Tools**: 각 도구를 개별로 내려받거나, **Download all**이 모든 도구를 받아요. 체크 표시는 오프라인 준비 완료를 뜻해요.

맨 위의 **Download everything**은 앱, 선택한 카탈로그 범위, 가이드, 모든 도구를 받아요. **Include all the AI models**를 선택하면 모델이 추가되고, 모델은 각자의 행에서 내려받을 수도 있어요. 노래하는 목소리는 항상 자기 행에서만 내려받아요. 조직의 정책이 AI 다운로드를 끌 수 있으며, 그러면 행에 그렇게 표시돼요.

취소하거나 연결이 끊기면 다운로드는 멈춘 곳에서 이어지고, 다시 온라인이 되면 스스로 새로 고치며 릴리스에서 바뀐 것만 가져와요. 브라우저가 영구 저장소를 허용하지 않았으면 **Protect downloads**가 이를 요청해요. "내려받음"과 "브라우저가 공간을 되찾으려 할 때까지만 내려받음"의 차이예요.

### Lolly 인스턴스

**Lolly instance**는 이 설치가 도구와 카탈로그를 가져오는 곳을 알려줘요. 인스턴스의 주소, 또는 모든 것이 빌드에 들어 있을 때는 *Bundled with this app*이에요.

- **Design-system source**는 제공되는 디자인 시스템의 출처를 보여줘요.
- **Instance console**은 배포가 제공하는 곳에서 관리 페이지를 열어요.
- **Change**는 데스크톱 앱이 다른 인스턴스를 가리키게 해요. 브라우저는 출처를 넘나들며 도구와 에셋을 불러올 수 없으므로 웹에서는 이 섹션이 대신 **Open a workspace**를 제공해요.
- **Leave**는 인스턴스의 디자인 시스템, 도구, 카탈로그를 제거하며 사용자의 작업물은 남아요. [조직에서 Lolly 사용하기](/info/organisation.html#leaving)를 참고하세요.
- 조직에 로그인한 동안 **Sign out**은 이 세션을 끝내고, **Sign out everywhere**는 이 기기를 포함한 모든 기기의 세션을 끝내요.

## 이 기기

- <!--i:monitor--> **This Machine**: 화면, 입력, 그래픽, 메모리, 코덱, 저장소 백엔드 등을 이 세션에서 실시간으로 읽어요. 저장되거나 전송되는 것은 없어요. 넓은 화면에서는 저절로 열리며 탭이 두 열로 배치돼요.
- <!--i:neurobeat--> **Sound**: 인터페이스 소리와 Neurospicy 집중 루프로, 이 탭에서 무언가를 쓰는 유일한 스위치예요.
- <!--i:database--> **Storage**: [Preferences](#storage)에 있는 미터의 읽기 전용 보기이며, 데이터를 지우거나 옮기는 곳은 그쪽이에요.

## 디자인 시스템

읽기 좋게 펼쳐 놓은 활성 디자인 시스템이에요. 이 브라우저에 디자인 시스템이 둘 이상 있으면 위쪽의 작은 표지 띠가 이를 나열해요. 하나를 고르면 활성화되고, 이어서 나타나는 알림의 **Undo**가 이전 것을 되돌려요.

![Lolly Demo의 Design system 탭: 시스템을 전환하는 표지 띠, 그다음 로고, 이름, 메모, 각 페이지를 여는 개수가 있는 표지](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

탭은 시스템 자체 색상으로 칠해진 표지로 열리며 로고, 디스플레이 서체의 이름, 작성자가 쓴 메모가 담겨요. 표지의 개수 줄이 각 페이지로 연결돼요.

- <!--i:palette--> **Colour**: 밝은 모습과 어두운 모습의 표면, 텍스트, 기본, 보조 색상, 이름과 헥스가 있는 칩으로 된 모든 이름 붙은 색상, 각 틴트 램프와 차트 스펙트럼의 띠, 접이식으로 된 색상 역할이에요. 값을 선택하면 헥스가 복사돼요.
- <!--i:font--> **Type**: Headings, Text, Emphasis, Code가 각각 자기 서체로 표시돼요.
- <!--i:photos--> **Logos**: 각 로고 파일이 만들어진 바탕 위에 표시돼요.
- <!--i:layers--> **Colourways**: 시스템에 둘 이상 있을 때 각 컬러웨이의 밝은 모습과 어두운 모습 쌍이에요.
- <!--i:sliders--> **Tokens**: 반경, 간격, 효과, 그라디언트예요.
- <!--i:document--> **Print & CMYK**: 정확한 잉크에 고정된 색상과 CMYK PDF가 선언할 수 있는 인쇄 조건이에요.

전환이 이 탭이 하는 유일한 변경이에요. 디자인 시스템은 표지가 연결해 주는 `#/start`의 [Design System Setup](/info/brand-studio.html)에서 편집해요. 읽기 전용 시스템은 표지에 그렇게 표시되며, 직접 만든 로컬 시스템은 계속 편집할 수 있어요. `/b`와 `/brand`는 이 탭으로 바로 가는 짧은 링크예요.

## Capabilities

플랫폼의 모든 부분이 열두 개 그룹의 카드로 정리돼 있어요. Experiences, Platforms & runtimes, Accessibility & languages, Export formats, Import formats, Print production, Automation & AI, Determinism & reproducibility, Brand & design system, Privacy & data ownership, Security & access control, Architecture (for builders)예요. 각 그룹은 접히며 카드 수를 보여줘요. 카드를 열면 그 기능의 특징이 담긴 대화상자가 나오고, 절반 정도에는 이 문서가 쓰는 스크린샷이 있어요.

그룹 위의 검색 입력란은 입력하는 대로 카드를 거르고 일치하는 항목이 남은 그룹을 열어요. 몇 개의 기능을 검색하는지 알려주며, 일치하는 것이 없으면 말로 알려줘요.

이 탭은 Lolly가 할 수 있는 일을 적은 문서이며 이 가이드와 보조를 맞춰 유지돼요. 지금 쓰는 기기를 조사하지는 않아요. 그것은 **This device**가 해요.

## Activity & stats

먼저 빌드예요. 로드된 도구 수, 내보내기 형식 수, 플랫폼이 실행되는 환경 수, 카탈로그가 담은 브랜드 에셋 수가 있고, 이 빌드에 포함된 것을 나눠 보여주는 **Catalogue** 패널이 있어요.

그다음 사용자 쪽이에요. **Your activity**는 이 기기에서 만든 것을 집계하고, **Recent creations**와 **Latest exports**는 넘겨볼 수 있는 스택으로 보여줄 것이 생기면 나타나요. 둘 다 항목을 만들 때의 모습 그대로 열어요. 이 카운터는 기기에 남으며, 선택 사항인 Lolly Work 인스턴스는 자체 [조직 원격 측정 및 감사 기록](/info/privacy.html#organisation-services-with-lolly-work)을 보관해요.

## 딥 링크

Settings의 모든 탭과 섹션에는 북마크하거나 붙여넣을 수 있는 자체 링크가 있어요. [검색](/info/search.html)은 **Settings** 결과를 Settings가 렌더링하는 것과 같은 레지스트리로 연결하므로, 섹션 이름이 검색 결과 밑에서 바뀔 수 없어요.

::: details 모든 링크 형태

- **탭:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Preferences 섹션:** `#/settings?focus=<section-id>`. 예: `#/settings?focus=offline-section`.
- **정확한 섹션:** `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways`, `#/settings?cap-formats`처럼 ID를 단독 플래그로 써요. 예전 `#/settings?dash-lock`과 `#/settings?dash-palette-wheel` 링크는 표지와 Colour 페이지를 열어요.
- **키워드로 섹션:** `#/settings?print`, `#/settings?formats`, `#/settings?palette`(Colour 페이지), `#/settings?tokens`. 키워드는 공유될 수 있어요. `print`는 브랜드 탭의 인쇄 참조와 Print production 그룹 모두에 속하며 페이지 순서상 먼저 오는 것이 우선해요. 어느 쪽이 중요한지 알아야 하면 ID를 쓰세요.

딥 링크는 대상을 소유한 탭으로 전환하고, 그 안에 접혀 있는 그룹을 열고, 위의 섹션들이 레이아웃을 마칠 때까지 잠시 기다린 뒤 그곳으로 스크롤해요. 폐기된 `#/platform`과 `#/capabilities` 주소는 딥 링크 플래그를 유지한 채 Settings로 합쳐져요.
:::

---

**관련 문서:** 내 세부 정보와 만드는 맥락은 [프로필](/info/profile.html), Design system 탭이 보여주는 것의 편집은 [Design System Setup](/info/brand-studio.html), 저장소, 백업, 기기 이동은 [작업물 찾기와 복구](/info/find-your-work.html)를 참고하세요.
