# Design System Setup

로고, 색상, 서체는 한곳에 있어야 모든 도구, 페이지, 내보내기가 그것으로 그려져요. 그곳이 `#/start`의 **Design System Setup**이며, 슬로건이 용도를 말해줘요. *Make it yours*.

가진 것으로 시작하세요. 로고를 놓으면 Lolly가 색상을 읽어요. 서체를 고르거나 회사가 라이선스한 글꼴 파일을 놓으세요. 변경은 모두 앱 전체에 바로 반영돼요. 로고, 글꼴, 토큰은 이 기기에 머물러요. Google Font를 고르는 것만 밖으로 나가는 단계이며, Lolly가 먼저 묻고 패밀리를 한 번 가져와요.

마음에 들면 디자인 시스템에 이름을 붙이고 **Export**를 누르세요. 보관하거나, 다른 기기에서 열거나, 동료에게 건넬 `.lolly` 파일 하나가 생겨요. [Settings](/info/dashboard.html#design-system)는 활성 시스템을 읽기 전용으로 보여주며, 그 표지에서 편집하러 여기로 연결돼요.

## 5분 만에 나만의 것으로 만들기

::: timeline
- <!--i:upload--> **로고 놓기.** **Logos**의 드롭 영역에 놓으세요. Lolly가 모양과 색상을 읽어요.
- <!--i:palette--> **이 색상 사용.** 로고의 주 색상이 기본 색상이 되고, 로고의 어두운 중립색이 텍스트 색상이 돼요.
- <!--i:font--> **서체 선택.** **Type**에서 Google Font 또는 가지고 있는 글꼴 파일을 고르세요.
- <!--i:pentool--> **시스템 이름 붙이기.** 첫 편집이 사용자 자신의 디자인 시스템을 만들며, Lolly가 이름을 한 번 물어요.
- <!--i:download--> **Export**가 전체 시스템을 `LollyBrand-….lolly` 파일 하나로 써요.
:::

헤더는 **Editing** 중인 디자인 시스템을 보여주며, 이름은 언제든 바꿀 수 있는 입력란이에요. 첫 편집이 **What is this design system called?**라고 물을 때, 로고가 글자를 포함하면 로고의 단어가 미리 채워져요. **Save name**은 이름을 유지하고, **Not now**는 헤더에 입력할 때까지 임시 이름을 유지해요. 이름은 Settings와 전환할 때 시스템의 라벨이 되고 **Export**가 쓰는 파일 이름이 돼요.

## The rooms

스튜디오는 옆의 레일에 있는 룸의 모음이며 정해진 순서는 없어요. 번호도 없고 다른 것을 기다리는 것도 없어요. 휴대폰에서는 레일이 헤더 아래의 칩 띠가 돼요.

![스튜디오의 룸 레일: Overview, Colours, Type, Logos, Tokens, Files, Usage & rules](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| 룸 | 하는 일 | 링크 키 |
|---|---|---|
| **Overview** | 시스템에 담긴 것을 보고, 각 룸으로 가는 문이 있어요 | `overview` |
| **Colours** | 색상을 추가하고, 역할을 주고, 음영과 팔레트를 만들어요 | `color` |
| **Type** | 앱, 도구, 모든 내보내기가 읽는 서체 네 개를 골라요 | `type` |
| **Logos** | 모든 방향과 처리 방식으로 마크를 배치해요 | `logos` |
| **Tokens** | 모서리, 간격, 그림자, 그 밖의 모든 이름 붙은 값 | `tokens` |
| **Files** | 브랜드가 보관하는 이미지, 오디오, 모션 파일 | `catalogue` |
| **Usage & rules** | 브랜드가 적용하는 규칙을 실제 예시로 확인해요 | `usage` |

`#/start?area=<key>`로 룸에 연결해요. Files 룸은 룸 키가 영구 계약이므로 키 `catalogue`를 유지하고, `?tab=`도 예전 별칭으로 계속 작동해요. 알 수 없는 키는 Overview를 열어요.

**레일 하단**에는 한 룸이 아니라 시스템 전체에 대한 동작이 있어요. **Add from…**은 브랜드를 가져오고([브랜드 가져오기](#bring-a-brand-in)), **Tray**는 스캔이 찾았지만 아직 추가하지 않은 것을 담아요. **Export**, **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions**, **Restore brand settings**는 시스템을 보관하고 옮겨요([디자인 시스템 보관과 이동](#keep-and-move-your-design-system)). 각각 작용할 대상이 있을 때 나타나요.

## Overview

아직 선택한 것이 없으면 Overview는 시작하는 방법 네 가지를 제안해요. **Start from a reference**는 로고, 스크린샷, 웹 페이지, 디자인 파일의 소스 선택기를 열고, **Pick a colour**, **Choose a face**, **Add a logo**는 해당 컨트롤을 바로 열어요. 하나를 열어도 아무것도 쓰이지 않으며, **Explore the tools**는 처음부터 있어요.

무언가 사용자 자신의 것이 되면 Overview는 가진 것을 보여주며 사용자의 개수가 앞에 와요. Colours는 색상 수를 보여주고, 상속된 색상이 있으면 흐린 `· N starter`가 붙어요. 띠는 사용자의 색상을 먼저, 그다음 가는 선, 그다음 흐려진 스타터 색상을 놓아요. Type은 역할별로 읽혀요(*Inter for headings*, 그 아래 줄에 *Starter for the rest*). Logos는 채워진 슬롯 수(또는 **Not set**)를 알려주고, Tokens는 모서리 반경을 보여주며, Files는 라이브러리가 비어 있는 동안 **Nothing yet**이라고 해요. 모든 블록이 해당 룸을 열어요.

### Starter와 Yours

**Starter**는 선택한 것이 아니라 앱과 함께 온 모든 것을 뜻하는 말이에요. 새로 설치하면 색상이 전혀 없고 잉크에서 종이까지의 중립 램프 하나만 있어서, 아무도 정하기 전에도 표면, 텍스트, 가는 선이 렌더링돼요. 같은 단어가 모든 룸에서 상속된 것에 표시돼요.

::: cols
## Starter

- 앱과 함께 온 것: 잉크에서 종이까지의 중립색, 스타터 서체, 기본 모서리 반경.
- **Starter** 태그가 붙고 색조 없이 흐려요.
- 사용자의 색상으로 세지 않아요. 중립색은 **Tokens**의 **Neutrals · starter · 9**에 있으며, **Open**이 Colours에서 접힌 그룹 하나로 보여줘요(`#/start?area=color&group=neutral`).
- 스타터 색상에 서 있는 역할은 *"Starter Paper stands in"*으로 표시되고, 선택기에 **Choose…**가 있어요.

## Yours

- 사용자가 선택하거나 설치한 것.
- 완전한 강도이며, 서체를 설치한 곳은 색조가 있는 카드예요.
- Overview와 Tokens에서 세어져요.
- 다른 것을 따르는 역할은 기본 색상의 이름을 반복하는 대신 **↳ follows Primary**로 표시돼요.
:::

상속된 것은 점선 테두리로 그려지지 않아요. 여기서 점선 테두리는 놓는 대상을 뜻하기 때문이에요.

## Logos

마크 폴더를 맨 위 드롭 영역에 통째로 놓으세요. **"Drop marks here, or choose several at once"**는 가진 만큼의 파일을 받아요. 각 파일은 모양과 잉크를 읽고, **Waiting for a slot** 아래에서 어떻게 보이는지 알려주는 칩(예: *"Looks like the Horizontal primary"*)으로 기다려요. 사용한 측정값과 **Place** 버튼(슬롯이 채워져 있으면 **Replace**)이 있어요. 확실하지 않으면 칩이 그렇게 알려주고 여덟 개를 모두 나열하는 **Change slot**을 제안해요. 무언가 누르기 전에는 아무것도 배치되지 않아요.

여백이 많이 남는 마크는 먼저 다듬기 제안을 받아요. 응답하거나 Escape를 누르면 원본이 그대로 들어가요. 마크가 비어 있는 형제 슬롯을 채울 수 있으면 룸이 파생된 **mono** 또는 **reverse** 버전을 *Generated*로 표시된 칩으로 제안해요.

모든 마크는 **방향**과 **처리 방식**마다 하나씩, 선택적인 슬롯 여덟 개의 격자에 들어가요.

- **방향:** Horizontal(워드마크와 심벌이 한 줄) 및 Vertical(정사각형과 세로형 공간용으로 쌓음).
- **처리 방식:** Primary, Primary reverse(어두운 배경용), Mono(한 색), Mono reverse.

아직 마크가 없는 그룹은 한 줄로 접혀 있으며 열면 슬롯이 보여요. 슬롯을 클릭해 PNG, SVG, JPEG, WebP를 추가하거나, 채워진 슬롯을 클릭해 마크를 교체하세요. 모든 것은 이 기기에 남아요.

![Horizontal과 Vertical이 열린 로고 슬롯: 각 처리 방식이 자체 슬롯이며 모든 슬롯은 선택 사항이에요](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails%3Anth-of-type%281%29%3Esummary%3Bclick%3A.be-logo-identity%3Edetails%3Anth-of-type%282%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks**는 아이콘, 문장, 파비콘처럼 브랜드가 자체 이름으로 부르는 마크예요.
- **More identities.** 서브 브랜드, 제품, 행사는 자체 전체 세트를 가질 수 있어요. **+ Add another logo**를 누르고 세트에 이름을 붙이세요. 기본 세트는 "Your logo"예요. [브랜드 아키텍처](/info/brand-architectures.html)가 로고 신원이 알맞은 블록인 경우를 보여줘요.
- **Lolly가 로고의 색상을 읽어요.** 드롭 영역 아래와 Colours 맨 위의 카드가 로고의 색상을 나열하고 **Which is the main colour?**라고 물으며, 가장 강한 색상이 미리 선택되어 있어요(내보낸 흰 배경은 절대 아님). **Use these colours**는 이를 팔레트에 추가하고, 주 색상을 기본 색상으로 만들며, 로고에 종이 위에서 읽히는 어두운 중립색이 있으면 그것을 텍스트 색상으로 만들어요. **Not now**는 Tray에 남겨요. 새로 설치한 상태에서는 가장 유력한 답이 바로 적용되고 카드가 **Undo**나 다른 주 색상을 제안해요. SVG는 정확한 색상을 주고, PNG, JPEG, WebP는 마크에서 실제로 의미 있는 비중을 차지하는 색상을 줘요.

## Colours

룸은 디자인 시스템과 함께 자라요. 처음 방문하면 결정은 하나이고, 나머지는 팔레트가 생기면서 와요.

### 첫 번째 색상

자체 색상이 없는 시스템은 큰 칩 하나와 입력란 하나로 열리며, 시스템이 자라면서 역할, 음영, 인쇄 설정이 온다는 안내가 있어요.

- **칩이 선택기예요.** **Pick a colour**를 누르면 스튜디오의 OKLCH 카드가 입력란에 있는 값으로 채워져 열려요. 이름, 휠, 다이얼 네 개, 알파, **Stored as**가 있고 아래에 **Cancel**과 **Add colour**가 있어요. **Add colour**를 누르기 전에는 시스템에 아무것도 반영되지 않아요.
- **입력란은 모든 표기를 받아요**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)`, 색상 이름. 목록을 붙여넣으면 하나씩 또는 **Add all**로 추가할 칩의 행이 돼요.
- **들어오는 방법 두 가지 더.** **Pick a colour from the screen**은 브라우저에 스포이트가 있으면 그것을 쓰고, **Take colours from an image**는 이 기기의 스크린샷이나 사진을 읽어요.
- **Add는 절대 비활성화되지 않아요.** 입력란이 비어 있으면 선택기를 열고, 읽을 수 없는 텍스트는 입력란 아래에 그렇다고 알려줘요.

첫 색상이 **기본 색상**이 되고, *"Primary is now Vivid Violet"* 같은 칩이 이를 확인해 주며 색상을 조정하는 **Fine-tune**이 있어요.


### 팔레트가 자라면서

색상은 넓은 화면에서 **In context** 미리보기 옆에, 작은 화면에서는 위에 놓여요. 미리보기는 팔레트로 만든 포스터, 차트, 인터페이스 카드를 보여줘요. 스타터 색상은 자체 접이식 그룹에 남아요.

![Lolly Demo의 Colours 룸: 접이식 그룹의 팔레트, 이름과 헥스가 있는 각 색상, 아래쪽의 다운로드 알약](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![색상 하나를 추가한 뒤의 Colours 룸. 팔레트와 실시간 구성 미리보기가 표시됨](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### 역할: 도구가 읽는 것

**역할**은 모든 도구와 내보내기에서 어떤 색상이 어떤 부분을 맡을지 알려줘요. 선택 사항이에요(역할 없이 느슨한 색상 세 개도 충분히 좋은 시스템이에요). 어떤 색상이든 역할을 맡을 수 있고, 대비 수치는 표면을 기준으로 측정하며 APCA를 먼저 써요. 각 역할 행은 완전한 강도의 자체 색상, 대신 서 있는 스타터 색상, 또는 **↳ follows Primary**를 보여줘요.

팔레트에 음영이 생기면 띠가 도구가 읽을 수 있는 일곱 가지 역할을 모두 보여줘요. Primary, Secondary, Surface, Text, Muted, Edge, On primary예요. On primary는 기본 색상에서 파생되며 **Derived**로 표시되고 선택기가 없어요.

앱 자체의 강조색은 기본적으로 디자인 시스템을 따라요. **Settings → Appearance**의 **Interface follows the design system** 설정이에요. 이 설정을 끄면 앱 크롬은 중립으로 남고, 도구, 캔버스, 내보내기는 어느 쪽이든 디자인 시스템을 따라요.

**컬러웨이.** 디자인 시스템은 작품마다 선택되는 대표 색상을 여럿 가질 수 있어요. Lolly는 모든 컬러웨이를 보관하지만 이 룸에서 아직 작성할 수는 없어요. 컬러웨이는 토큰 파일에 작성돼요. 컬러웨이가 있는 시스템에서는 모든 컬러웨이에 자체 기본 색상과 보조 색상이 필요하고, 컬러웨이가 배경에 색조를 입히면 자체 표면도 필요하므로 그 역할은 견본 편집기에 설정된 채로 남아요. [Lolly Demo 사용하기](/info/lolly-demo-in-use.html#colourways-on-real-work)가 실제 작업의 컬러웨이를 보여주고, [디자인 시스템에 컬러웨이 추가하기](/info/colourways.html#add-colourways-to-a-design-system)에 형식이 있어요.

### 더 많은 색상 찾기

세 가지 도구가 기본 색상을 바탕으로 해요. 앞의 두 개는 제안만 하고, 세 번째는 변경을 검토한 뒤 팔레트를 대체해요.

::: cols
## Explore shades & harmonies

**Starting colour**, **Scheme**(Mono, Complement, Analogous, Triad), **Shades** 개수(3~20, 기본값 5)를 고르세요. **Fine-tune**은 UI 강도, 대비, 브랜드 위의 텍스트를 설정해요. 음영을 클릭하면 추가되고, 그룹은 **Add 5 shades**로 추가해요. 색상과 역할은 그대로 유지돼요.

## Find matching colours

**Harmony**를 고르세요. Complementary, Adjacent, Triad, Tetrad, Analogous(**Accents** 2~5개와 **Angle** 10°~45°)예요. 각 후보에는 생성된 이름과 색상당 한 번 누르는 **+ Add**가 있어요.

## Rebuild the whole palette

무엇이 바뀌고 무엇이 남는지 검토한 뒤 시작 색상 하나로 팔레트를 대체해요. 체크포인트를 먼저 만들고 이후에 **Undo**를 제공해요.
:::

세 가지 모두 엔진과 같은 지각 기반 색상 수학(OKLCH)을 써요. **Explore shades & harmonies**에서는 **Primary**, **Neutral**, **Secondary** 행이 제안된 음영을 보여주고, **Theme preview**는 대비 수치와 함께 밝은 예시와 어두운 예시를 보여줘요.

![제안된 셰이드 그룹 세 개, 개별 추가 컨트롤과 별도의 Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![생성된 강조 색상들, 각각 견본, 자동 생성된 이름, 헥스 값과 추가 버튼을 갖춤](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### 생성된 팔레트 적용하기

**Rebuild the whole palette…**를 열고 **Preview full rebuild**를 누르세요. 검토 화면은 지정한 대로 유지되는 역할 수, 유지되는 사용자 색상 수, 다시 고정되거나 유지되는 음영 곡선, 인쇄 잠금, 숨겨진 음영, 그라디언트 정지점의 수를 세어 보여줘요. **Apply rebuilt palette**가 확정하고 **Cancel**은 아무것도 바꾸지 않아요. 이후 카드가 포커스가 놓인 **Undo**를 제공하며, 교체 전에 만든 체크포인트가 전체 시스템을 복원해요.

컬러웨이가 있는 시스템은 재구성해도 모든 컬러웨이를 유지해요. 표준 컬러웨이는 새 시작 색상을 따르고, 다른 컬러웨이는 자체 색상, 이름, 순서, 설정을 유지해요. 검토 화면이 어느 컬러웨이가 따르고 어느 것이 색상을 유지하는지 나열해요. Lolly는 편집할 수 없는 방식으로 컬러웨이를 인코딩한 시스템은 재구성하지 않으며, 카드가 이유를 알려주고 아무것도 바뀌지 않아요.

### 전문가용 섹션

미리보기와 역할 아래에 접힌 섹션 네 개가 있어요. 각각 `#/start?area=color&focus=<name>`으로 바로 열려요.

- **Explore shades & harmonies**(`focus=generate`)는 위에서 설명했어요.
- **Shade curves**(`focus=curves`)는 램프를 점 단위로 재구성하며 명도, 채도, 색상 곡선(L / C / H)이 따로 있고 끄는 대로 음영이 다시 그려져요.
- **Contrast**(`focus=contrast`): **Contrast-lock**은 고른 배경에 대해 APCA 목표에 맞게 램프의 톤을 조정하고, **Rotate hue**는 램프 전체를 휠 주위로 돌려요.
- **Print**(`focus=print`)는 기본 색상이 인쇄에서 무엇이 될지 정해요. 자동 값, 고정된 CMYK 조합, 이름 붙은 별색 잉크예요.

### 팔레트와 각 견본

팔레트는 색상을 접이식 그룹으로 나열하며 각각 자체 **+ Add**가 있어요. 그룹은 원하는 대로 만들고 이름을 바꾸세요. 역할은 두 번째 타일을 만들지 않아요. 역할이 가리키는 타일에는 대신 작은 표시(**P**, **S**, **Su**, **T**)가 붙어요. 타일 아래 **Colour chart**는 같은 색상을 OKLCH **Wheel**(점을 끌어 색을 바꾸고, 빈 곳을 클릭해 견본을 추가)과 표시 가능한 범위가 끝나는 곳을 보여주는 **Gamut** 차트로 보여줘요. `#/start?area=color&focus=chart`가 차트를 바로 열어요.

![팔레트 패널, 모든 그룹을 접고 펼 수 있으며, 하단 가장자리에 다운로드 필이 고정되어 있음](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![OKLCH 휠 - 각도는 색상, 바깥쪽 거리는 채도이며 회색은 옆쪽의 명도 레일을 따라 배치됨](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

견본을 클릭하면 편집기가 열려요.

- 견본 **이름 변경**.
- OKLCH 슬라이더 또는 **Hex**, **HSL**, **RGB**, **CMYK**로 **색상 설정**. 값 입력란은 활성 공간으로 읽고 써요. 여기서 CMYK는 변환으로 화면 색상을 설정하며, 정확한 잉크를 고정하려면 **Print substitutes**를 쓰세요.
- **Stored as**는 견본이 저장되는 방식을 고르며 **LCH**(기본값, 지각 기반이고 넓은 색역), Hex, RGB, HSL이 있어요.
- **Use as**는 견본에 역할을 직접 줘요. 강조된 역할을 다시 누르면 역할이 해제돼요.
- **Print substitutes**(접힘): **CMYK**를 **Auto**에서 정확한 잉크 값으로 잠그거나, **Name**(예: `PANTONE 186 C`), 선택적 **Book**, 박, 엠보스, 디보스, 스팟 바니시, 소프트 터치, 또는 다이컷·크리스·천공용 **Finish**가 있는 **Spot colour**를 설정해요. CMYK PDF나 TIFF를 내보낼 때 인쇄기가 이 잠금을 써요. [색상 프로필](/info/exporting.html#colour-profiles)을 참고하세요.
- **In other spaces**(접힘): 색 공간별 값으로, 파생된 것이거나 사용자가 작성한 것이며 작성한 값이 내보내기에서 우선해요.

**견본 삭제**는 안전해요. 파생된 음영과 테마 역할은 숨겨지므로 그것을 읽는 어떤 것도 깨지지 않고, 추가한 색상은 제거돼요.

::: details 견본이 많을 때 작업하기
각 견본에는 끌기 핸들이 있어요. 끌어서 그룹 안의 순서를 바꾸거나, 핸들에 포커스를 두고 Space를 누르고 화살표 키를 쓴 뒤 Space를 다시 눌러 놓아요. Escape는 취소해요. 그룹 간에 색상을 옮기려면 편집기의 **Group** 컨트롤을 쓰거나 여러 개를 선택해 **Move to**를 쓰세요.

선택에는 모드가 필요 없어요. 막대는 첫 선택된 타일과 함께 나타나고 마지막 타일과 함께 사라져요.

- **빈 공간에서 끌어** 사각형을 그리면 닿는 모든 타일이 그룹을 가로질러 선택에 합류해요. 접힌 섹션은 아무것도 더하지 않아요.
- **Shift 클릭**은 읽는 순서로 범위를 잡고, **Cmd/Ctrl 클릭**은 타일 하나를 토글하며, 일반 클릭은 편집기를 열어요.
- 각 그룹 헤더에 **Select all**이 있고, 타일에 포커스를 둔 **Cmd-A**는 스타터 색상이 아닌 사용자가 가진 모든 색상을 선택해요.
- 격자의 탭 정지 지점은 하나예요. 화살표는 이동, Shift-화살표는 확장, Space는 토글, Delete는 제거, Escape는 선택 해제예요. 채널을 조금 움직이려면 먼저 `l`, `c`, `h`를 누르세요.
- 터치 화면에서는 타일을 길게 눌러 선택을 시작하고 탭해서 추가해요.

막대에는 **{n} selected**가 표시되고, 이어서 **Move to**, **Give a role**(각 색상이 차례로 다음 역할을 받음), **Download**(여섯 가지 팔레트 형식 중 하나로 선택 항목), **Duplicate**(각각의 사본이 원본 뒤에 놓임), **Copy values**, **Delete**가 있어요. 사본 하나는 편집기에서 바로 열리고, 여러 개는 선택된 채로 남아요. Cmd/Ctrl-Z 한 번이 대량 작업 전체를 실행 취소해요.
:::

### 그라디언트

선택 사항인 **Gradients** 패널은 팔레트에서 블렌드 토큰을 만들어요. 각 그라디언트에는 미리보기, 이름 붙은 정지점 2~8개, 각도가 있어요. 정지점은 견본을 가리키므로 견본의 색을 바꾸면 그라디언트가 따라와요. 블렌드는 OKLCH로 실행돼요.

팔레트 다운로드(디자인 토큰, CSS, SCSS, GIMP, Adobe Swatch Exchange)는 음영이 생기면 팔레트 하단의 알약에 있어요. [팔레트와 글꼴을 어디서나 가져가기](/info/using.html#take-your-palette-and-fonts-anywhere)가 각 형식을 설명해요.

## 타입

자체 서체가 없으면 룸은 카드 하나예요. **Primary**가 현재 제공하는 서체의 읽기 크기로 표시되고, **Starter** 태그, **Choose a face** 버튼, *"Nothing installs until you choose one."* 문구가 있어요. Headings, code, italic은 직접 고르기 전까지 기본을 따르며, **Choose them separately**가 각 카드를 보여줘요.

![아직 서체를 선택하지 않은 Type 룸 - 읽기 좋은 크기의 카드 하나, 그 위의 Starter 태그, 그리고 채워진 Choose a face](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

서체 하나를 고르면 룸이 역할 카드 네 개, Fonts 목록, 실시간 견본으로 열려요.

- **Primary**: 본문, 버튼, 모든 도구.
- **Headings**: `h1`과 `h2`용 디스플레이 서체.
- **Code**: 코드와 데이터용 고정폭 서체.
- **Italic**: 강조, 인용, 부연용 진짜 이탤릭.

카드는 그 서체를 설치한 곳에만 색조가 입혀지며, 버튼은 사용자 자신의 서체에서는 **Change**, 그 외에는 **Choose a face**라고 표시돼요. 카드의 어떤 것도 확정하지 않아요. 버튼은 그 역할의 비교 스테이지를 열어요.

![드러난 네 개의 역할 카드 - 각각 담당하는 서체로 설정되며, 아무도 선택하지 않은 곳에는 Starter 태그가 붙고 Italic은 기본 서체를 따름](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### 비교 스테이지

스테이지는 누른 카드 아래의 룸 안에서 열리고, 카드는 한 줄 띠로 접히므로 휴대폰의 첫 화면에도 스테이지가 보여요. Escape는 취소하고 카드로 포커스를 돌려요.

1. 카드에서 **Choose a face**를 누르세요.
2. 패밀리 이름을 입력하고 **Preview**를 누르거나, 입력란 아래 **Pinned** 패밀리 여섯 개 중 하나를 누르세요.
3. **Use this face**를 누르세요.

![카드 아래에 열린 비교 스테이지 - 검색 행, 고정된 패밀리, 그리고 한 줄 스트립으로 접힌 카드들](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**동의는 한 번만 물어요.** 미리보기가 처음 Google Fonts에 닿을 때 대화상자가 설명해요. *Google learns the family name and your IP address. The file is then kept on this device and used offline. This is the one step in the studio that reaches a third party.* **Fetch from Google**은 진행하고 기억돼요. **Cancel**은 카드에 *"Not fetched. Nothing was sent to Google."*이라고 표시하며 자체 **Fetch from Google**이 있어요.

**스테이지에 글꼴 파일(TTF, OTF, WOFF)을 놓으면** 이미 가진 라이선스 서체를 미리 볼 수 있어요. 어느 쪽이든 서체는 이 기기에 남고, 앱, 도구, 모든 내보내기에서 오프라인으로 렌더링되며, 디자인 시스템 파일에 담겨 이동해요. Google Fonts의 모든 것은 오픈 라이선스(OFL, Apache, UFL)로 제공돼요.

### 이 기기의 폰트

**Fonts** 패널은 이 기기의 모든 서체와 맡은 역할을 나열해요. 추가한 서체는 **In the design system** 아래에 앞서고 각각 역할과 삭제 버튼이 있어요. 스타터 서체는 접힌 흐린 행 하나에 이어져요. **Add a face**는 모든 역할의 비교 스테이지를 열어요. **Type roles** 패널은 각 역할의 실시간 견본을 패밀리와 상태와 함께 보여줘요. 예: *Inter* 또는 *Inter · follows Primary*.

## 토큰

토큰은 디자인 시스템 뒤의 이름 붙은 값이에요. 색상, 서체, 로고, 모서리, 간격이에요. 도구는 이름으로 이를 읽으므로 여기서 바꾸면 모든 도구에 한꺼번에 반영돼요.

![Tokens 룸: 시스템의 예시와 파일 동작이 있는 헤더, 토큰 종류별 개수 타일, 그다음 대비 수치가 있는 색상 쌍](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **헤더**는 사용자 시스템의 예시(*Primary is Spearmint, #033633*)와 파일 동작을 보여줘요. **Download**(전체 시스템을 디자인 토큰으로, 또는 팔레트를 다른 다섯 가지 형식으로), **Copy CSS**, JSON 파일을 다시 읽는 **Add from…**이에요.
- **타일**은 토큰 종류별로 개수를 세고 해당 섹션으로 이동해요. Colours, Type, Logos, Shape and spacing, More, All tokens예요. Overview처럼 사용자 자신의 것을 세요. 휴대폰에서는 타일이 옆으로 스크롤돼요.
- **Colours**는 도구가 함께 놓는 쌍(표면 위의 텍스트, 기본 색상 위, 표면 위의 흐린 텍스트)에 밝고 어두운 모습의 APCA 수치를 보여주는 것으로 시작하고, 쌍이 기준에 못 미치면 **Weak contrast**를 표시해요. 그다음 모든 색상 그룹이 이어져요. 램프는 칩 한 줄로, 다른 색상은 값과 `{color.brand.spearmint}` 같은 도구가 쓰는 참조와 함께 보여줘요. 참조를 누르면 참조가 복사돼요. **Edit in Colours**는 Colours 룸에서 그룹을 열어요.
- **Type**과 **Logos**는 각 역할과 각 로고 슬롯의 서체를 나열하며, 직접 가진 것이 생기면 **Edit in Type**과 **Edit in Logos**가 나타나요.
- **Shape and spacing**에는 **Rounded corners**(`shape.radius`)와 **Spacing rhythm**(`space.base`)이 있어요. 각각 슬라이더를 움직이기 전에는 *Lolly default*, 후에는 *Yours*로 표시되고, 즉시 저장되며 실행 취소할 수 있어요.
- **More tokens**는 간격, 크기, 선 두께, 불투명도, 회전, 일반 숫자, 그림자를 표준 [디자인 토큰](/info/design-tokens.html)으로 저장해 추가해요.
- **App appearance (advanced)**는 Lolly 자체 화면이 쓰는 색상, 크기, 그림자를 나열하고, **Inspect every token (advanced)**는 저장된 모든 값을 검색하고 편집하며 변경을 먼저 검토하도록 보여줘요.

비어 있는 섹션은 빈틈을 채우는 방법을 제안해요. **Pick a colour**, **Choose a face**, **Add a logo**예요.

## 파일

로고 외에 브랜드가 보관하는 파일을 놓으세요. **vector**, **image**, **audio**, **motion** 파일(동영상, Lottie, 애니메이션)이에요. 이들은 [Assets](/info/using.html#assets-your-library)에 섹션별로 정렬되어 나타나고 모든 도구의 에셋 선택기에서 준비되며, 이 기기에 남아요.

## Usage & rules

**Usage & rules**는 브랜드의 선택이 작동하게 해요. 사람들이 바꿀 수 있는 것, 고정되는 것, Lolly가 확인할 수 있는 것이에요.

![Lolly Demo의 Usage & rules: Add your first rule이 있는 빈 Brand rules 카드, 그다음 렌더링할 준비가 된 예시가 있는 Try your brand in use](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules**는 규칙을 나열해요. **Add rule**(또는 **Add your first rule**)이 짧은 양식을 열어요.

- *Beacon accents*처럼 자신의 말로 쓰는 **Rule name**
- **Check**: **Colour choices**, **Font choices**, **Fixed artwork**, **Text length** 중 하나이며, 역할에 붙인 자신의 이름으로 사용하는 브랜드 역할을 지정해요.
- 적용 대상인 **Example**(Poster, Title slide, Content slide, Chart), **Mode**, **Required**인지 **Advisory**인지
- **Reviewed by**, 그다음 **Save draft** 또는 **Approve & save**

승인은 이 기기에 사용자 자신의 결정을 기록해요. 승인된 필수 규칙은 재사용 가능한 포스터를 제약하며, 검사는 예시 PNG에만 적용되고 다른 도구는 바꾸지 않아요.

디자인 시스템이 토큰 파일에 담아 오는 규칙, 예를 들어 승인된 색상 조합, 텍스트 굵기와 정렬, 표면당 로고는 여기에 **Checked in Design**으로 나열돼요. Design은 내보내기 패널의 **Before you export** 카드에서 레이어별로 이를 확인하고, `lolly check`는 저장된 Design 문서에 같은 일을 해요([내보내기 전에](/info/design.html#before-you-export)). 이 빌드에 검사기가 없는 규칙은 제공된 그대로 보관되며 **Unchecked**로 표시돼요.

**Try your brand in use**는 **Render & check examples**로 현재 개정본에서 예시 네 개를 렌더링해요. **Brand mode**를 고르고 제목, 보조 텍스트, 슬라이드 텍스트에 **Try your own text**를 쓰세요. 각 예시는 **See checks & sources**와 **Download check report**로 측정된 내용을 보고하며, **Make reusable poster**는 고정 레이아웃과 승인된 입력 선택이 파일과 함께 이동하는 `.lolly`를 다운로드해요. 예시는 로컬이에요. 검사를 실행해도 게시되거나 승인되는 것은 없어요.

고정된 브랜드와 함께 제공되는 빌드는 같은 규칙과 예시를 *This brand is set* 아래에 읽기 전용으로 보여줘요.

## 브랜드 가져오기

레일 하단의 **Add from…**은 형식이 아니라 무엇을 가졌는지를 묻는 선택기를 열어요.

- **Design tokens or a design file**: DTCG 또는 Tokens Studio JSON, Penpot 프로젝트, 토큰 세트의 zip, Lolly 디자인 시스템 팩, SVG.
- **PDF**: 덱이나 가이드라인 파일이며 색상, 마크, 포함된 서체를 이 기기에서 읽어요.
- **Logo or screenshot**: 이미지가 이 기기에서 읽은 제안 팔레트가 돼요. 색상을 읽으며 서체나 레이아웃은 읽지 않아요.
- **Saved web page**: HTML 파일 하나와 CSS 파일, 또는 붙여넣은 HTML이나 CSS로, 최대 20개 파일 및 2 MB예요. 제공한 텍스트만 읽어요. 연결된 리소스는 가져오지 않고 스크립트는 실행되지 않아요.
- **Font file**: TTF, OTF, WOFF. 서체가 설치되는 Type 룸을 열어요.
- **Website**: 색상과 서체를 읽는 페이지 하나예요. 이 타일은 페이지를 읽을 수 있는 기기에만 나타나며, 이 기기의 앱인지 사용자로 로그인된 백그라운드 탭의 브라우저 확장 프로그램인지 어떤 리더를 쓰는지 알려줘요. URL을 지정하는 것은 입력란만 채우며, 가져오기를 누르는 것이 동의예요.

디자인 파일 소스를 고르면 다음 카드가 허용되는 형식을 아이콘 타일로 나열하고, 카드 전체가 하나의 드롭 대상이에요. 스튜디오에 파일을 바로 놓을 수도 있어요.

![가져오기 카드 - 지원되는 형식이 아이콘 타일로 앞에 배치되며, 카드 전체가 하나의 드롭 대상임](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- **Lolly design-system pack**(`.lolly` 또는 예전 `.zip`)은 한 단계로 설치돼요.
- **Penpot** 내보내기(`.penpot`)는 디자인 토큰을 가져와요.
- **Design Tokens**(W3C DTCG) 또는 **Tokens Studio** 파일(`.json`)은 토큰을 가져와요.
- **plain SVG**는 선택할 색상을 스캔하며, 첫 번째가 기본 색상이 돼요.

### 레퍼런스 검토

로고, 스크린샷, 웹사이트, 저장된 페이지는 **Try these colours**를 열어요. 제안된 색상으로 만든 예시, 바꿀 수 있는 **Main colour**, 새 시스템의 이름이에요. 상자가 적용 시 일어나는 일을 설명해요. 활성 토큰 설정을 생성된 팔레트와 기본 스타일로 **교체**하고, 글꼴과 라이브러리 파일은 **유지**하며, 이전 시스템을 **복구**할 수 있어요. **Apply suggested settings**는 체크포인트 후에 밝고 어두운 팔레트를 적용하고, **Restore brand settings**는 이전 설정을 되돌릴 수 있어요. **Change reference**는 다른 소스를 골라요.

**Palette, source details and individual choices**는 읽은 내용, 발견된 글꼴 이름, 미리보기의 대비를 보여줘요. 글꼴 이름은 제안일 뿐이며 서체를 설치하는 곳은 여전히 Type이에요. 소스 세부 정보에는 관찰된 경우 타이포그래피, 간격, 패딩, 모서리 값이 포함될 수 있으며, 그렇지 않으면 **Not observed**로 표시돼요. 저장된 페이지나 네이티브 웹사이트 읽기는 페이지가 쓰지 않을 수도 있는 선언된 스타일을 보고하고, 브라우저 확장 프로그램은 보이는 요소 표본에서 측정된 스타일을 보고할 수 있어요. 이들은 관찰이며 설치되는 것은 없고 소스의 간격이 사용자 자신의 것을 대체하지 않아요. **Choose individual items in the tray**는 개별 항목을 유지하고, **Download design context**는 관찰, 제안된 토큰, 소스 정보(제공된 HTML이나 CSS의 SHA-256 포함)의 JSON 보고서를 저장해요. 보고서에는 원본 페이지 텍스트가 없고 서명된 Content Credential이 아니에요.

PDF와 디자인 파일 가져오기는 자체 검토 컨트롤을 유지해요. **Tray**의 항목은 그 종류의 자료를 소유한 룸에서 추가하기 전까지 아무것도 바꾸지 않아요. `#/start?source=<kind>`는 소스(`file`, `pdf`, `image`, `font`, `url`, `page`)의 선택기를 열고, `?import`는 일반 목록을 열어요.

### 룩 찾기와 비교

Overview 또는 Settings의 디자인 시스템 목록에서 **Find a look**을 여세요. 이 기기에 저장된 시스템과 재사용 가능한 Lolly 예시 몇 개를 둘러보고, 이름, 색상 태그, 선언된 글꼴로 검색해요. **Closest to my current palette**는 측정된 색상 유사도로 정렬하며 일치하는 글꼴이 동점을 가르고, 품질 점수가 아니에요.

룩 하나를 선택해 검토하거나, 둘을 선택해 나란히 비교하세요. 선택은 아무것도 바꾸지 않아요. **Use this saved system**은 그것으로 전환하고, **Use these colours**는 예시의 색상을 일반 체크포인트를 거쳐 적용하며 글꼴은 유지해요. **Restore brand settings**는 이전 룩을 복구해요. 저장된 시스템에는 **Details and design context** 아래에 편집 가능한 **Search tags**가 있어요. 예시는 스크랩한 모음이나 계정 없이 만든 Lolly 고유의 색상 레시피예요.

![어느 색상 시스템도 적용하기 전에 Sunroom과 Orchard를 나란히 비교하기.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

## 디자인 시스템 보관과 이동

### 기기 간 브랜드 이동

**Export**는 토큰, 글꼴, 로고, 테마 환경설정과 다시 가져올 때 확인되는 무결성 매니페스트가 담긴 **`LollyBrand-….lolly`** 파일 하나를 써요. 1.0.7 이전의 웹 릴리스는 같은 파일을 `.zip`이라고 이름 붙였으며 그 표기도 계속 받아요. **Tokens (.json)**은 글꼴이나 로고 없이 저장소, 빌드 단계, 다른 토큰 도구를 위한 일반 디자인 토큰 문서만 단독으로 써요.

되돌리려면 **Add from… → Design tokens or a design file**을 쓰거나 스튜디오에 파일을 놓으세요. 동료가 브랜드를 건네거나 두 번째 설치로 가져가는 방법이며 계정도 클라우드도 필요 없어요. 명령줄에서 브랜드를 가져오려면 [`ingest:brand`](/info/configuration.html#brand-packs)를 참고하세요.

**Fonts for Linux (.rpm)**은 추가한 글꼴을 설치 가능한 RPM으로 패키징해요. 직접 업로드한 글꼴이 있으면 Lolly가 먼저 재배포해도 되는지 확인을 요청해요.

### 이전 설정 복원

**Restore brand settings**를 선택하고 날짜가 있는 체크포인트를 골라 **Restore**를 누르세요. 활성 브랜드의 색상, 서체 설정, 다른 토큰을 복원하고 글꼴과 이미지 파일은 그대로예요. Lolly가 먼저 현재 설정을 **Before restore**로 저장하므로 브라우저를 닫은 뒤에도 복원을 되돌릴 수 있어요. 최근 체크포인트 20개가 이 기기에 보관돼요.

### 버전

게시된 버전은 이 기기에 보관되는 **영구적이고 이름 붙은 사본**이에요. 바뀌지 않으므로 이를 고정한 도구나 링크(`designv`로)는 계속 같은 것을 그려요. 사용자 자신의 것이 있는 시스템은 레일 하단에 조용한 **Versions & publishing** 링크를 보여주며, 첫 게시 후에는 **Versions** 항목이 돼요. `#/start?area=versions`가 바로 열어요.

- **버전은 영구적이에요.** 아직 삭제 기능이 없으며 패널이 그렇게 알려줘요.
- **제거 항목이 호환성 카드의 맨 앞에 와요.** 제거된 토큰이 도구를 깨뜨리기 때문이에요.
- **게시는 되돌릴 수 없지만 복원은 가능해요.** *Restore latest from this version*은 일반 편집이며 **Undo**가 바로 제공돼요.

**Publish only**는 도구가 따르는 것을 바꾸지 않고 버전을 보관하고, **Publish and make active**는 도구와 앱이 그 버전을 따르게 해요. **Follow the latest again**은 편집하는 즉시 모든 편집이 적용되게 해요.

## 디자인 시스템 관리

**Settings → Preferences → Design systems**를 열어 시스템을 전환, 추가 또는 제거하세요. **Open**은 시스템을 선택해 여기서 열고, **Make a new one**은 로컬 시스템을 만들어 이름 입력란이 준비된 채로 열어요. 기기 전체에서 한 번에 하나의 시스템이 활성이에요. [브랜드 아키텍처](/info/brand-architectures.html)는 브랜드에 자체 디자인 시스템이 필요한 시점을 판단하도록 도와요.

**시스템의 출처.** 배포의 카탈로그가 제공하는 시스템은 **Came with this app**으로, 인스턴스에 연결된 앱에서는 **From this instance**로 표시돼요. **Catalogue source**를 펼치면 제공자, 토큰 에셋과 네임스페이스, 알려진 버전이나 체크섬이 보이고, 새로 고침에 실패하면 캐시된 자료에 라벨이 붙어요.

**관리형 시스템은 읽기 전용이에요.** 카탈로그가 시스템을 잠그면 **Managed by this instance**(인스턴스가 없는 데스크톱 앱에서는 **Managed by this app**)로 표시돼요. 사용하고 다운로드할 수 있으며, 여기서 열면 **Make an editable copy**와 **Switch**가 있는 읽기 전용 안내가 나와요. 관리형이 먼저 왔더라도 사용자의 로컬 시스템은 계속 편집할 수 있어요. 고정된 브랜드 하나가 있는 빌드는 Design System Setup을 *This brand is set*으로 열며 브랜드의 토큰과 사용 규칙을 읽을 수 있어요.

**제공된 다른 모든 시스템은 사용자의 것이라** 숨기고, 편집하고, 초기화할 수 있어요. lolly.tools의 Lolly Demo와 Lolly Starter도 포함돼요. 편집하면 이름이 유지되고 행에 **Edited here**가 표시되며, 메뉴의 **Reset to original**이 이 기기에서 한 변경을 버려요. 빈 스타터는 예외로, 거기서의 첫 변경이 사용자 자신의 디자인 시스템을 시작하므로 Lolly가 새 시스템의 이름을 한 번 물어요. [Lolly Demo 사용하기](/info/lolly-demo-in-use.html#switch-to-your-own)가 사용자의 시스템이 대체하는 것을 보여줘요.

### 디자인 시스템 제거

시스템의 메뉴에서 **Remove**를 선택하세요. 확인 창이 이후 어떤 시스템이 활성이 될지 알려줘요. 저장된 세션, 업로드, 다른 시스템과 공유하는 자료는 남아요.

제공된 시스템을 제거하면 숨겨질 뿐이며 카탈로그 에셋은 남고, **Bring back**이 다시 보여주며, 다른 것을 모두 제거하면 저절로 돌아와요. 가져오거나 편집한 사본을 제거해도 제공된 시스템, 그 로고, 글꼴은 제거되지 않으며, 사본이 활성이었다면 제공된 시스템이 다시 활성이 돼요. 활성인 호스팅 사본을 제거하면 그 사본의 연결만 지워지고 따로 고른 인스턴스는 선택된 채로 남아요.

서버가 제공하는 것을 바꾸는 일은 관리자의 작업이에요. 운영자가 소스 카탈로그를 바꾸고 다시 배포하거나, Lolly Work 관리자가 서버 변경을 검토하고 적용해요. 여기서의 편집은 로컬에 남아요. [카탈로그 디자인 시스템 제거](/info/configuration.html#removing-a-catalogue-design-system)와 [구성](/info/configuration.html#supplied-and-local-design-systems)을 참고하세요.

## 앱 밖에서 디자인 컨텍스트 사용

**Download design context**는 토큰 문서, 확인된 색상, 선언된 글꼴 패밀리, 에셋 ID, 기록된 경우 소스 증거, 커버리지, 명시적 규칙을 글꼴 파일이나 소유권 증명 없이 저장해요. 명령줄은 서버 없이 이 파일을 읽어요. `lolly system import`는 이를 터미널의 디자인 시스템으로 만들고 `lolly system check`는 Design 입력을 저장된 컨텍스트와 대조해요. [디자인 시스템 가져오기](/info/cli.html#bring-your-design-system)가 가져오기를, [명령이 사용하는 디자인 시스템](/info/cli-decks.html#which-design-system-a-command-uses)이 검사를 다루며, MCP 클라이언트는 `lolly://design-context`에서 같은 브리프를 읽어요([MCP Server](/info/mcp.html)).

## 다음으로 갈 곳

- **[Lolly 사용하기](/info/using.html)**: 도구, 저장, 공유, Assets.
- **[브랜드 아키텍처](/info/brand-architectures.html)**: 사업부, 제품, 보증 브랜드, 고객, 시즌이 디자인 시스템, 컬러웨이, 로고 신원에 어떻게 대응하는지 다뤄요.
- **[디자인 토큰](/info/design-tokens.html)**: 브랜드가 작성되는 토큰 모델.
- **[파일 내보내기](/info/exporting.html)**: 인쇄 단위, CMYK, 브랜드가 렌더링되는 형식.
