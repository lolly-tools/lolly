# Lolly Design System Setup

<a id="design-system-setup"></a>

**Lolly Design System Setup**은 `#/start`에 있으며 사용자의 로고, 색상, 서체를 담아요. 모든 도구, 페이지, 내보내기는 이것으로 그려요.

로고를 끌어다 놓으면 Lolly가 색상을 읽어요. 서체를 고르거나 회사가 라이선스를 보유한 글꼴 파일을 끌어다 놓으세요. 각 변경 사항은 앱 전체에 바로 표시돼요. 로고, 글꼴, 토큰은 이 기기에 남아요. Google Font를 고를 때만 외부에 연결해요. Lolly가 먼저 확인을 요청한 뒤 글꼴 패밀리를 한 번 받아요.

디자인 시스템에 이름을 붙이고 **Export**를 누르면 `.lolly` 파일 하나를 받아요. 파일을 보관하거나 다른 기기에서 열거나 동료에게 전달하세요. [Lolly Settings](/info/dashboard.html#design-system)는 현재 시스템을 읽기 전용으로 보여주며, 표지는 편집할 수 있도록 이곳으로 연결돼요.

<!--i:eti-clock-->
## 5분 만에 나만의 시스템 만들기

::: timeline
- <!--i:upload--> **Logos**의 드롭 영역에 **로고를 끌어다 놓으세요**. Lolly가 모양과 색상을 읽어요.
- <!--i:palette--> **Use these colours.** 로고의 주요 색상이 기본색이 되고, 로고의 어두운 중립색이 텍스트 색상이 돼요.
- <!--i:font--> **Type**에서 **서체를 고르세요**. Google Font나 보유한 글꼴 파일을 선택해요.
- <!--i:pentool--> **시스템에 이름을 붙이세요.** 처음 편집하면 나만의 디자인 시스템이 만들어지며 Lolly가 이름을 한 번 물어요.
- <!--i:download--> **Export**는 전체 시스템을 `LollyBrand-….lolly` 파일 하나로 기록해요.
:::

스튜디오 상단 막대에는 디자인 시스템 이름이 편집 가능한 입력란으로 표시돼요. **Enter**는 새 이름을 유지하고 **Escape**는 이전 이름으로 되돌려요. 처음 편집할 때 **What is this design system called?**라는 질문이 나오면, 로고에 글자가 있을 경우 Lolly가 그 내용을 채워 넣어요. **Save name**은 이름을 유지하고 **Not now**는 막대에 이름을 입력할 때까지 임시 이름을 유지해요. 이 이름은 Settings와 전환할 때 시스템을 표시하는 데 쓰이고, **Export**가 만드는 파일의 이름이 돼요.

<!--i:eti-grid-->
## 작업실

스튜디오는 정해진 순서가 없는 여러 작업실로 구성돼요. 어떤 작업실도 다른 작업실의 완료를 기다리지 않아요. 데스크톱에서는 작업실이 막대 아래의 한 줄에 있어요. 휴대폰에서는 화면 아래 가장자리의 막대로 이동하며, 열린 작업실이 보이도록 스크롤돼요. 팔레트 시트와 트레이는 그 막대 위로 올라오고, 입력하는 동안 막대는 비켜나요. 키보드에서는 Tab으로 이 줄에 한 번 진입하고 화살표 키, Home, End로 작업실 사이를 이동해요.

![스튜디오의 막대와 작업실: Board, Colours, Type, Logos, Tokens, Files, Sound, Rules, Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| 작업실 | 하는 일 | 링크 키 |
|---|---|---|
| **Board** | 시스템에 담긴 내용을 보고 각 작업실로 들어가요 | `overview` |
| **Colours** | 색상을 추가하고 역할을 지정하며 명암 변형과 팔레트를 만들어요 | `color` |
| **Type** | 앱, 도구, 모든 내보내기가 읽는 네 가지 서체를 골라요 | `type` |
| **Logos** | 모든 방향과 표현 방식에 로고를 배치해요 | `logos` |
| **Tokens** | 모서리, 간격, 그림자와 그 밖의 모든 명명된 값이에요 | `tokens` |
| **Files** | 브랜드가 보관하는 이미지, 오디오, 모션 파일이에요 | `catalogue` |
| **Sound** | 사운드 정체성, 용도별 음악, 음성과의 관계를 정해요 | `sound` |
| **Rules** | 실제 예시로 확인하는 브랜드 적용 규칙이에요 | `usage` |
| **Skills** | 사람과 에이전트가 읽고 다운로드할 수 있는 브랜드의 문서화된 기준이에요 | `skills` |

`#/start?area=<key>`로 작업실에 연결하세요. 작업실 키는 영구적이므로 Files는 `catalogue`, Board는 `overview`, Rules는 `usage`를 유지해요. 이전 별칭인 `?tab=`도 계속 작동해요. 알 수 없는 키는 Board를 열어요.

**막대**에는 전체 시스템에 대한 동작이 있어요. **Add from…**는 브랜드를 가져와요([브랜드 가져오기](#bring-a-brand-in)). **Tray**는 스캔으로 찾았지만 아직 추가하지 않은 것을 보관해요. **Export**는 시스템을 파일 하나로 기록해요. **More**에는 **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings**, 시스템을 전환하는 Settings의 목록을 여는 **Design systems**가 있어요([디자인 시스템 보관하고 옮기기](#keep-and-move-your-design-system)). 각 동작은 대상이 생기면 나타나요. 휴대폰에서는 **Add from…**가 **More** 안으로 이동하고 **Export**는 아이콘으로 표시돼요.

디자인 시스템이 앱에 기본으로 포함된 상태라면 막대 맨 앞에 **Make it yours**가 표시돼요. **Find a look**, **Add from…**, **Pick a colour**가 있는 메뉴예요. 시스템이 나만의 것이 되면 **Export**가 다시 그 자리를 차지해요.

<!--i:eti-clipboard-->
## Board

아직 아무것도 고르지 않았다면 Board는 시작하는 방법 네 가지를 제공해요. **Start from a reference**는 로고, 스크린샷, 웹 페이지, 디자인 파일을 위한 소스 선택기를 열어요. **Pick a colour**, **Choose a face**, **Add a logo**는 각각 해당 컨트롤을 열어요. 열기만 해서는 아무것도 기록되지 않아요. 그 아래의 **Find a look**은 시도해 볼 수 있는 미리 구성된 색상과 서체를 제공하며 **Explore the tools**는 처음부터 있어요.

무엇이든 직접 고르면 Board는 보유한 내용을 보여주되 직접 고른 항목의 개수를 먼저 표시해요. Colours는 색상 수를 보여주고, 물려받은 색상은 흐린 `· N starter`로 표시해요. 색상 띠에는 직접 고른 색상, 가는 구분선, 흐리게 표시한 기본 제공 색상 순으로 나와요. Colourways는 각 컬러웨이를 주도색의 작은 타일로 보여줘요. Type은 각 역할을 나열하고 각 패밀리를 해당 서체로 표시해요(*Inter for headings*, 그 아래 줄에 *Starter for the rest*). Logos는 채워진 슬롯 수(또는 **Not set**)를 표시하고, Tokens는 모서리 반경을 보여주며, Files는 라이브러리가 비어 있으면 **Nothing yet**을 표시해요. 각 블록은 해당 작업실을 열어요.

Lolly Demo처럼 앱에 포함된 편집 가능한 디자인 시스템은 처음부터 Board에 색상, 컬러웨이, 서체, 로고를 보여주며 제목 옆에 **Came with this app** 태그가 있어요. 그 위의 **Start here**에는 **Find a look**, **Add from…**, **Pick a colour**가 있어요.

### 기본 제공 항목과 직접 고른 항목

모든 작업실에서 **Starter**는 앱에 포함돼 있었고 아무도 고르지 않은 항목을 표시해요. 새로 설치하면 색상 없이 잉크색부터 종이색까지의 중립색 램프 하나만 있어요. 따라서 아무도 고르기 전에도 표면, 텍스트, 가는 선을 그릴 수 있어요.

::: cols
## 기본 제공 항목

- 앱에 포함돼 있어요. 잉크색부터 종이색까지의 중립색, 기본 제공 서체, 기본 모서리 반경이에요.
- 흐리게 표시되고 **Starter** 태그가 있으며 색조가 없어요.
- 직접 고른 색상으로 집계되지 않아요. 중립색은 **Tokens**에 **Neutrals · starter · 9**로 있으며, **Open**을 누르면 Colours에 접힌 그룹 하나로 표시돼요(`#/start?area=color&group=neutral`).
- 기본 제공 색상을 대신 쓰는 역할에는 *"Starter Paper stands in"*이 표시되고 선택기에 **Choose…**가 있어요.

## 직접 고른 항목

- 직접 고르거나 설치했어요.
- 선명하게 표시되고, 서체를 설치한 곳에는 색조가 있는 카드가 있어요.
- Board와 Tokens에서 집계돼요.
- 다른 역할을 따르는 역할에는 **↳ follows Primary**가 표시돼요.
:::

물려받은 항목에는 점선 테두리가 없어요. 점선 테두리는 끌어다 놓을 수 있는 곳을 뜻해요.

<!--i:eti-shapes-->
## Logos

맨 위의 드롭 영역인 **"Drop marks here, or choose several at once"**에는 파일을 원하는 만큼 넣을 수 있어요. Lolly는 각 파일의 모양과 잉크 색상을 읽어요. 그다음 파일은 **Waiting for a slot** 아래에서 *"Looks like the Horizontal primary"*처럼 어떤 형태로 보이는지 알려주는 칩으로 대기해요. 판단에 쓴 측정값과 **Place** 버튼(이미 채워진 슬롯에는 **Replace**)도 있어요. Lolly가 확신하지 못하면 칩에 그 사실을 알리고 슬롯 여덟 개를 모두 나열하는 **Change slot**을 제공해요. 버튼을 누르기 전에는 아무것도 배치되지 않아요.

불필요한 빈 여백이 있는 로고에는 먼저 여백 자르기를 제안해요. 제안에 응답하거나 Escape를 눌러 원본 그대로 배치하세요. 로고로 같은 그룹의 빈 슬롯을 채울 수 있으면 작업실은 파생된 **mono** 또는 **reverse** 버전을 *Generated*로 표시한 칩으로 제공해요.

모든 로고는 **방향**과 **표현 방식**의 조합마다 하나씩 있는 선택 사항인 슬롯 여덟 개의 격자에 들어가요.

- **방향:** Horizontal(워드마크와 심볼이 가로로 나란히 있어요), Vertical(정사각형이나 세로로 긴 공간을 위해 위아래로 쌓여 있어요).
- **표현 방식:** Primary, Primary reverse(어두운 배경용), Mono(단색), Mono reverse.

로고가 없는 그룹은 한 줄로 접혀요. 그룹을 열면 슬롯이 보여요. 슬롯을 클릭해 PNG, SVG, JPEG, WebP를 추가하거나, 채워진 슬롯을 클릭해 로고를 바꾸세요. 빈 슬롯에는 파일을 끌어다 놓을 수도 있어요. 가로 로고는 넓은 타일에, 세로 로고는 정사각형에 놓이며, 각각 용도에 맞는 배경과 높이의 4분의 1만큼의 여백이 있어요. 모든 것은 이 기기에 남아요.

![Horizontal과 Vertical을 펼친 로고 슬롯: 표현 방식마다 슬롯이 따로 있으며 모든 슬롯은 선택 사항이에요](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks**는 아이콘, 문장, 파비콘처럼 브랜드에서 자체 이름으로 부르는 로고예요.
- **더 많은 아이덴티티.** 하위 브랜드, 제품, 이벤트마다 전체 세트를 따로 가질 수 있어요. **+ Add another logo**를 누르고 세트에 이름을 붙이세요. 기본 세트는 "Your logo"예요. [브랜드 구조](/info/brand-architectures.html)에서 로고 아이덴티티를 언제 쓰는지 설명해요.
- **Lolly는 로고의 색상을 읽어요.** 드롭 영역 아래와 Colours 맨 위의 카드에 로고의 색상을 나열하고 **Which is the main colour?**라고 물어요. 가장 강한 색상이 선택되며, 로고를 내보낼 때 쓴 흰색 배경은 선택되지 않아요. **Use these colours**는 이 색상들을 팔레트에 추가하고 주요 색상을 기본색으로 지정해요. 로고에 종이 위에서 잘 보이는 어두운 중립색이 있으면 그 색상이 텍스트 색상이 돼요. **Not now**는 색상들을 Tray에 남겨요. 새로 설치한 경우 Lolly는 가장 가능성 높은 답을 바로 적용하고, 카드에서 **Undo**나 다른 주요 색상을 제공해요. SVG에서는 정확한 색상을 얻고, PNG, JPEG, WebP에서는 로고의 상당 부분을 차지하는 색상을 얻어요.

<!--i:eti-palette-->
## Colours

작업실은 디자인 시스템과 함께 커져요. 처음 방문하면 하나만 결정하면 되고, 팔레트가 커지면서 더 많은 컨트롤이 나타나요.

### 첫 번째 색상

자체 색상이 없는 시스템은 기본 제공 중립색을 별도의 펼쳐진 그룹에 보여줘요. 작업실 맨 위에는 점선으로 된 붙여넣기 및 드롭 입력란이 있어요. 큰 칩 하나와 입력란 하나예요. 입력란 어디든 이미지나 색상 목록을 끌어다 놓으면 Lolly가 색상을 읽어요.

- **칩이 곧 선택기예요.** **Pick a colour**는 입력란의 내용을 초기값으로 삼아 스튜디오의 OKLCH 카드를 열어요. 카드는 색상 이름과 16진수 값을 먼저 보여줘요. 색 공간, 휠, 다이얼 네 개, 알파는 **Fine-tune** 아래에 있고 **Cancel**과 **Add colour**는 맨 아래에 있어요. **Add colour**를 누르기 전에는 시스템에 아무것도 추가되지 않아요.
- **입력란은 어떤 표기법이든 받아요**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)`, 색상 이름을 쓸 수 있어요. 붙여넣은 목록은 칩 한 줄이 되며, 하나씩 추가하거나 **Add all**로 모두 추가해요.
- **두 가지 방법이 더 있어요.** **Pick a colour from the screen**은 브라우저가 제공하는 경우 스포이트를 쓰고, **Take colours from an image**는 이 기기의 스크린샷이나 사진을 읽어요.
- **Add는 비활성화되지 않아요.** 입력란이 비어 있으면 선택기를 열고, 읽을 수 없는 텍스트라면 입력란 아래에 한 줄로 알려줘요.

첫 번째 색상이 **기본색**이 돼요. 칩이 *"Primary is now Vivid Violet"*처럼 변경 사항을 확인해 주며, 색상을 조정하는 **Fine-tune**도 있어요.


### 팔레트가 커지면

넓은 화면에서는 색상이 **In context** 미리보기 옆에, 작은 화면에서는 미리보기 위에 있어요. 미리보기는 팔레트로 만든 포스터, 차트, 인터페이스 카드를 보여줘요. 기본 제공 색상은 별도의 그룹에 있으며, 시스템에 자체 색상이 생기면 접혀요. 붙여넣기 및 드롭 입력란은 간결한 한 줄로 바뀌어요. 작업실 상단에는 내보내기가 없어요. 막대의 **Export**나 Tokens 작업실을 쓰세요.

![Lolly Demo의 Colours 작업실: 맨 위의 역할 칩과 붙여넣기 및 드롭 입력란, 그 아래의 접히는 그룹으로 나뉜 팔레트, 각 색상의 이름과 16진수 값](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![색상 하나를 추가한 뒤 Lolly Demo의 Colours 작업실: Colour roles 표 아래에 Use as Lead?와 Fine-tune을 제공하는 새 색상 칩이 있고, 그 옆에 실시간 컴포지션 미리보기가 있어요](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### 색상 역할: 색상을 부르는 이름

디자인 시스템은 색상에 이름을 붙이고 각 용도를 정하며 Lolly는 둘 다 읽어요. **Colour roles**는 Colours 작업실 맨 위에 있어요. **In context**는 각 변경 사항을 바로 보여줘요.

![가상의 직물 브랜드 Wefthouse의 자체 용어를 쓰는 Colour roles 표: 컬러웨이 칩 Indigo, Madder, Weld 아래에 밝은 색상과 어두운 색상을 각각 갖춘 Main, Accent, Supporting, Tertiary가 있고, 주도색, 짝 색상, 이름으로만 쓰는 색상으로 읽혀요. 어떤 역할도 채우지 않는 용도인 Background, Text, Quiet text, Hairlines는 표 아래에 나열돼요](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

표에는 열이 네 개 있어요. 휴대폰에서는 각 행이 밝음과 어두움이 나란히 놓인 카드가 돼요.

| 열 | 담긴 내용 |
|---|---|
| **Role** | 그 자리에서 편집할 수 있는 디자인 시스템 자체 용어와 색상의 용도를 알려주는 한 줄 설명 |
| **Light**와 **Dark** | 선택한 컬러웨이에서 해당 모습의 색상과 그 이름 또는 값, 대비 |
| **Lolly reads this as** | 도구가 해당 역할로 하는 일을 Lolly 자체 용어로 설명해요 |

**Lolly가 역할을 해석하는 방식.** 각 해석에는 역할 하나가 연결돼요. 다른 역할이 맡고 있는 해석을 선택하면 그 해석이 이 역할로 옮겨져요. Lolly는 단어에서 의미를 추론하지 않아요.

| 해석 | 적용되는 곳 |
|---|---|
| **Lead colour** | 큰 도형, 버튼, 도구가 주로 사용하는 색상 |
| **Partner colour** | 도구가 두 번째로 사용하는 색상 |
| **Background** | 다른 모든 요소 뒤에 놓이는 배경 |
| **Text** | 제목과 본문 텍스트 |
| **Quiet text** | 캡션과 작은 글씨 |
| **Hairlines** | 괘선, 테두리, 구분선 |
| **By name only** | 어떤 도구도 이 역할을 자동으로 선택하지 않아요. 모든 색상 입력란과 Design에서 선택할 수 있고, 선택한 색상은 연결을 유지하므로 컬러웨이를 따라요 |

어떤 역할도 맡지 않은 해석은 디자인 시스템의 정의를 유지하며, 화면은 그 해석들을 표 아래에 나열해요. Primary라는 역할처럼 해석 자체의 id와 같은 id를 쓰는 역할은 그 해석 자체이므로 옮길 수 없어요.

**차트에서.** Lolly Chart의 **Design system - colour roles first** 팔레트는 디자인 시스템의 색상 역할을 그 시스템의 순서대로 계열에 배정한 뒤 나머지 팔레트를 배정해요. 배경, 텍스트, 보조 텍스트, 가는 선으로 해석되는 역할은 제외해요. 차트가 그 색상으로 배경과 글자를 그리기 때문이에요. 이 팔레트를 선택하기 전에는 아무것도 바뀌지 않아요. 색상 역할이 없는 디자인 시스템은 **Design system - ordered** 방식으로 팔레트를 그려요.

**값.** 값을 눌러 해당 모습과 선택한 컬러웨이에서 그 역할이 쓸 색상을 고르세요. **Same as light**는 어두운 모습의 색상을 고를 때까지 어두운 모습의 값이 밝은 모습의 값을 따르게 해요. **Aa** 칩은 그 색상 위에 놓을 텍스트를 Lolly가 골라 보여줘요. 값 아래의 줄은 각 모습에서 그 텍스트가 얼마나 잘 읽히는지 **Text reads well**, **Large text only**, **Hard to read as text**로 알려줘요. 평가는 그 색상 위의 텍스트에만 해당해요. 도형이나 넓은 영역에는 여전히 그 색상을 쓸 수 있어요. 이름으로만 쓰는 역할은 경고 색상 없이 같은 문구를 보여줘요. 어떤 도구도 그 역할 위에 텍스트를 자동으로 놓지 않기 때문이에요. 도구 설명과 선택기는 APCA, WCAG 순으로 수치를 보여줘요. **Own text colour**는 파일에 텍스트 색상이 명시된 값을 표시하며, 그 텍스트 색상은 유지돼요. **Copied**는 다른 컬러웨이나 보조 색상에서 가져왔지만 아직 아무도 선택하지 않은 값을 표시해요. 선택기의 **Keep this colour**로 값을 확정해요.

**시작점.** 자체 역할이 없는 디자인 시스템은 현재 이름인 Primary, Secondary, Surface, Text를 보여줘요. 하나를 바꾸기 전에는 아무것도 기록되지 않아요. **+ Add a role**은 **Primary, Secondary** 또는 **Main, Accent, Supporting, Tertiary**를 제안하거나 직접 입력한 이름을 받고, 각각에 배정될 해석을 보여줘요. 처음 두 이름은 주 색상과 보조 색상이 돼요. 도구는 계속 같은 색상으로 그려요. 주 색상이 하나인 시스템에서는 첫 컬러웨이가 그 색상의 이름을 받아요.

**이름 바꾸기, 순서 바꾸기, 제거하기.** 이름을 바꾸면 단어만 바뀌고, 그 역할을 쓰는 모든 것은 계속 동작해요. 역할의 손잡이를 끌거나, 손잡이에서 Space를 누르고 화살표 키로 이동한 뒤 Space를 눌러 놓으세요. **Remove**는 아직 그 역할을 쓰는 것을 알려줘요. 도구가 그 역할을 읽는 경우 **Remove and keep those colours**는 각 해석에 현재 색상을 남겨요. 조직 규칙, 가이드 그룹, 도구 입력란, 다른 토큰이 그 역할을 쓰면 해당 사용을 바꿀 때까지 역할이 유지돼요. 저장된 Design 문서도 이름으로 역할을 쓸 수 있으며, Lolly는 토큰 파일만으로 이를 알 수 없어요. 그런 문서는 색상을 확인할 수 없다고 보고해요.

::: details 직접 작성한 토큰 파일의 역할
**직접 작성한 파일.** 토큰 파일에서 어떤 역할에도 선언되지 않은 색상은 **In this file, with no role yet** 아래에 나열되며, 각각 이름 입력란과 **Make a role**이 있어요. 역할을 만들든 만들지 않든 이름으로 계속 동작해요. 이름에 숫자가 있는 토큰은 역할이 될 수 없어요. 파일에 남아 경로로 계속 동작해요. 파일의 레코드가 유효성 검사를 통과하지 못하면 표는 컨트롤 없이 표시되고 이유를 알려줘요.
:::

**화면의 나머지 부분도 같은 이름을 써요.** 칩, 색상 견본의 **Use as** 행, 팔레트의 **Colour roles** 그룹은 모두 디자인 시스템의 이름을 써요. 색상 역할의 타일을 누르면 해당 값이 열려요. 내보낸 파일에는 역할에 관한 새 정보가 기록되지 않아요. 렌더링의 색상이 바뀌는 것은 토큰이 바뀌었기 때문이에요.

**이름이 전달되는 곳.** 이름과 설명은 디자인 시스템과 함께 이동해요. 에이전트는 디자인 브리프, `lolly://tokens`, 브랜드 페이지의 `AGENTS.md`에서 이를 읽어요. 터미널은 `lolly system status`에 이를 보여줘요. 브랜드 페이지는 `brand.json`에 이를 나열하고 각 역할의 대비 쌍을 측정해요. DTCG와 Tokens Studio 파일은 모든 것을 유지하고, `DESIGN.md`는 이름과 해석을 유지하며, PowerPoint 테마는 브랜드의 순서만 유지해요. [다른 형식의 색상 역할](/info/design-tokens.html#colour-roles-in-other-formats)에 전체 목록이 있어요. 이름은 항상 디자인 시스템의 데이터로 인용되며, 지시로 읽히지 않아요.

**색상을 고르는 곳.** 도구와 Lolly Design의 모든 색상 입력란은 디자인 시스템의 역할을 그 시스템의 순서대로 먼저 나열하며, 각 이름과 용도를 함께 보여줘요. 역할 옆의 **Aa**는 그 역할 위에 놓이는 색상을 선택해요. 다른 색상은 **Other colours** 아래에 이어지며, 컬러웨이 자체의 사본, 색상 위에 놓이는 색상, 역할이 이미 맡고 있는 해석은 제외돼요. 선택한 색상은 역할과 연결을 유지하며 컬러웨이를 따라요. 입력란은 모든 컬러웨이에서 그 이름을 보여주고, Settings와 Tokens도 그 이름을 써요. 역할이 없는 디자인 시스템은 색상 견본 격자를 유지해요.

### 도구가 읽는 모든 색상

화면에서 **Colour roles**를 닫으면 맨 앞에 처음 결정할 항목의 칩이 보여요. 각 칩은 역할의 색상과 이름을 보여줘요. 자체 이름이 없는 시스템에서는 **Primary**, **Secondary**, **Surface**, **Text**예요. 칩을 눌러 팔레트의 견본에서 색상을 고르세요. **Colour roles** 맨 아래의 **Every colour a tool reads**에는 전체 띠가 있어요.

이 띠는 도구가 읽을 수 있는 일곱 색상인 Primary, Secondary, Surface, Text, Muted, Edge, On primary를 보여줘요. 디자인 시스템에 자체 이름이 있으면 그 이름을 써요. 각각은 모든 도구와 내보내기에서 같은 역할을 해요. 꼭 설정할 필요는 없고, 어떤 색상이든 배정할 수 있어요. 자유롭게 고른 색상 세 개로도 좋은 시스템이 돼요. 수치 표시는 배경 위에서 텍스트가 얼마나 잘 읽히는지 APCA를 먼저 보여줘요. 각 행은 직접 고른 색상을 원래 강도로 보여주거나, 대신 쓰는 시작 색상 또는 **↳ follows Primary**를 보여줘요.

On primary는 주 색상에서 파생되며, **Derived**로 표시되고 선택기가 없어요. On primary 옆과 **In context** 옆의 **Light**, **Dark** 스위치는 띠, 팔레트, 미리보기에 표시할 모습을 골라요.

앱 자체의 강조 색상은 기본적으로 **Settings → Appearance**의 **Interface follows the design system** 설정을 통해 디자인 시스템을 따라요. 설정을 끄면 앱의 인터페이스는 중립적인 색상을 유지해요. 어느 쪽이든 도구, 캔버스, 내보내기는 디자인 시스템을 따라요.

**컬러웨이.** 디자인 시스템에는 작품별로 고르는 여러 주 색상을 담을 수 있어요. **Colour roles** 맨 위의 **Colourways** 행은 컬러웨이마다 칩 하나를 보여주며, 표준 컬러웨이에는 **Default**가 표시돼요. **+ Add**는 팔레트 색상에서 새 컬러웨이를 시작해요. 칩을 고르면 표, 띠, 팔레트, 미리보기가 그 컬러웨이를 보여줘요. 선택한 컬러웨이의 이름을 바꾸거나, 복제하거나, 제거하거나, 기본값으로 설정할 수 있어요. 컬러웨이가 있는 시스템에서는 컬러웨이마다 자체 주 색상과 보조 색상이 필요하며, 컬러웨이가 배경을 물들이면 자체 배경 색상도 필요해요. 색상 견본 편집기에서 그 역할들은 설정된 상태를 유지해요. [디자인 시스템에 컬러웨이 추가하기](/info/colourways.html#add-colourways-to-a-design-system)에 단계와 토큰 형식이 있으며, [Lolly Demo 사용하기](/info/lolly-demo-in-use.html#colourways-on-real-work)에서 실제 작업의 컬러웨이를 보여줘요. 각자 **Settings → Appearance**에서 자신의 컬러웨이를 정할 수 있어요([내 컬러웨이로 설정하기](/info/colourways.html#make-a-colourway-your-own)).

### 더 많은 색상 찾기

세 도구가 주 색상을 바탕으로 동작해요. 처음 두 도구는 제안만 하고, 세 번째 도구는 팔레트를 교체해요.

::: cols
## 색조 & 배색 살펴보기

고를 항목은 **Starting colour**, **Scheme**(Mono, Complement, Analogous, Triad), **Shades** 개수(3~20개, 기본값 5개)예요. **Fine-tune**은 UI 강도, 대비, 브랜드 색상 위의 텍스트를 설정해요. 색조를 클릭해 추가하거나 **Add 5 shades**로 그룹을 추가하세요. 기존 색상과 역할은 유지돼요.

## 어울리는 색상 찾기

배색은 **Harmony**에서 Complementary, Adjacent, Triad, Tetrad, Analogous를 고르세요(**Accents**는 2~5개, **Angle**은 10°~45°). 각 후보에는 자동 생성된 이름과 **+ Add**가 있으며, 색상마다 한 번씩 눌러요.

## 전체 팔레트 다시 만들기

바뀌는 것과 유지되는 것을 검토한 뒤, 시작 색상 하나로 팔레트를 교체해요.
:::

셋 모두 엔진과 같은 지각 기반 색상 수학(OKLCH)을 써요. **Explore shades & harmonies**의 **Primary**, **Neutral**, **Secondary** 행은 제안된 색조를 보여주고, **Theme preview**는 대비 수치와 함께 밝은 모습과 어두운 모습의 예시를 보여줘요.

![제안된 세 색조 그룹, 각각의 추가 컨트롤과 별도의 Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![생성된 강조 색상. 각각 색상 견본, 자동 생성된 이름, 16진수 값, Add 버튼이 있어요](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### 생성된 팔레트 적용하기

먼저 **Rebuild the whole palette…**를 열고 **Preview full rebuild**를 누르세요. 검토 화면은 배정한 대로 유지되는 역할 수, 직접 고른 색상 중 유지되는 수, 기준점이 다시 설정되거나 유지되는 색조 곡선, 인쇄 잠금, 숨긴 색조, 그라데이션 정지점 수를 집계해요. **Apply rebuilt palette**는 적용하고, **Cancel**은 아무것도 바꾸지 않아요. 그 뒤 카드에는 포커스가 이미 맞춰진 **Undo**가 나타나며, 교체 전에 만든 체크포인트로 전체 시스템을 복원할 수 있어요.

컬러웨이가 있는 시스템은 다시 만들어도 모든 컬러웨이를 유지해요. 표준 컬러웨이는 새 시작 색상을 따르고, 다른 컬러웨이는 모두 자체 색상, 이름, 순서, 설정을 유지해요. 검토 화면은 어느 컬러웨이가 새 색상을 따르고 어느 것이 자체 색상을 유지하는지 나열해요. Lolly가 편집할 수 없는 방식으로 컬러웨이를 인코딩한 시스템은 다시 만들지 않아요. 카드가 이유를 알려주고 아무것도 바뀌지 않아요.

### 전문가용 섹션

미리보기와 역할 아래에는 접힌 섹션 네 개가 있어요. 각각 `#/start?area=color&focus=<name>`으로 열려요.

- **Explore shades & harmonies** (`focus=generate`).
- **Shade curves** (`focus=curves`)는 명도, 채도, 색상각 곡선(L / C / H)을 따로 써서 색조 단계를 점마다 바꿔요. 끄는 동안 색조가 다시 그려져요.
- **Contrast** (`focus=contrast`): **Contrast-lock**은 선택한 배경에 대해 APCA 목표치를 충족하도록 색조 단계를 조정하고, **Rotate hue**는 전체 색조 단계를 색상환 둘레로 돌려요.
- **Print** (`focus=print`)는 인쇄할 때 주 색상을 자동 값, 고정된 CMYK 배합, 이름이 있는 별색 잉크 중 무엇으로 쓸지 설정해요.

### 팔레트와 각 색상 견본

팔레트는 색상을 접을 수 있는 그룹으로 나열하며, 각 그룹에 **+ Add**가 있어요. 그룹을 만들고 이름을 바꿀 수 있어요. 역할은 두 번째 타일을 만들지 않아요. 역할이 가리키는 타일에는 **Primary** 같은 역할 이름이 표시돼요. 타일 아래의 **Colour chart**는 같은 색상을 OKLCH **Wheel**(점을 끌어 색상을 바꾸고, 빈 곳을 클릭해 견본을 추가해요)과 표시 가능한 범위의 끝을 보여주는 **Gamut** 차트에 보여줘요. `#/start?area=color&focus=chart`로 차트를 열어요.

![모든 그룹을 접을 수 있는 팔레트 창](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![OKLCH 색상환 - 각도는 색상각, 중심에서의 거리는 채도이며, 회색은 옆쪽의 명도 레일에 놓여요](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

색상 견본을 클릭해 편집기를 여세요.

- 색상 견본의 **이름을 바꿔요**.
- OKLCH 슬라이더나 **Hex**, **HSL**, **RGB**, **CMYK**로 **색상을 설정해요**. 값 입력란은 현재 색 공간으로 읽고 써요. 여기서 CMYK는 변환을 통해 화면 색상을 설정해요. 정확한 잉크 값을 고정하려면 **Print substitutes**를 쓰세요.
- **Stored as**는 견본을 저장할 방식을 골라요. **LCH**(기본값, 지각 기반의 넓은 색역), Hex, RGB, HSL이 있어요.
- **Use as**는 견본에 역할을 배정하며, 디자인 시스템에 자체 이름이 있으면 그 이름을 써요. 강조 표시된 역할을 다시 누르면 역할이 해제돼요.
- **Print substitutes**(접힘): **CMYK**를 **Auto**에서 정확한 잉크 값으로 잠그거나, **Name**(예: `PANTONE 186 C`), 선택 사항인 **Book**, 박, 양각, 음각, 부분 바니시, 소프트 터치 또는 도무송, 접지선, 타공용 **Finish**로 **Spot colour**를 설정해요. CMYK PDF나 TIFF를 내보낼 때 인쇄기는 이 잠금을 사용해요. [색상 프로필](/info/exporting.html#colour-profiles)을 참고하세요. 별색 잉크는 Print PDF에서 자체 판으로 인쇄돼요. 한 번의 내보내기에서 모든 별색 잉크를 프로세스 컬러로 인쇄하려면 [별색 잉크를 프로세스 컬러로](/info/exporting.html#spot-inks-as-process)를 참고하세요.
- **In other spaces**(접힘): 색 공간별 값으로, 파생된 값이나 직접 작성한 값이에요. 내보낼 때는 직접 작성한 값이 우선해요.

**색상 견본 삭제**는 안전해요. 파생된 색조와 테마 역할은 숨겨지므로, 이를 읽는 기능은 계속 동작해요. 직접 추가한 색상은 제거돼요.

::: details 여러 색상 견본 다루기
평소에는 견본에 색상, 이름, 16진수 값이 보여요. Select는 모든 화면에서 각 견본의 체크박스와 끌기 손잡이를 보여주며, 키보드 포커스가 있는 타일도 손잡이를 보여줘요. 손잡이를 끌어 그룹 안에서 순서를 바꾸거나, 손잡이에 포커스를 맞추고 Space를 누른 뒤 화살표 키로 이동하고 Space를 다시 눌러 놓으세요. Escape는 취소해요. 휴대폰에서는 팔레트가 한 행에 색상 네 개를 보여줘요. 그룹 사이로 색상을 옮기려면 편집기의 **Group** 컨트롤을 쓰거나 여러 색상을 선택한 뒤 **Move to**를 쓰세요.

선택에는 별도 스위치가 필요 없어요. 첫 타일을 선택하면 막대와 체크박스가 나타나고, 마지막 선택을 해제하면 사라져요.

- **빈 곳에서 끌어** 사각형을 그리세요. 사각형에 닿는 모든 타일이 그룹을 넘어 선택돼요. 접힌 섹션에서는 아무것도 추가되지 않아요.
- **Shift를 누르고 클릭**하면 읽기 순서의 범위가 선택되고, **Cmd/Ctrl을 누르고 클릭**하면 타일 하나의 선택이 전환되며, 그냥 클릭하면 편집기가 열려요.
- 각 그룹 제목에는 **Select all**이 있고, 타일에 포커스가 있을 때 **Cmd-A**를 누르면 직접 추가한 모든 색상이 선택되며 시작 색상은 선택되지 않아요.
- 격자의 탭 정지점은 하나예요. 화살표는 이동하고, Shift와 화살표는 선택을 확장하고, Space는 선택을 전환하고, Delete는 제거하고, Escape는 선택을 해제해요. 채널을 조금씩 조정하려면 먼저 `l`, `c`, `h`를 누르세요.
- 터치 화면에서는 타일을 길게 눌러 선택을 시작한 뒤 탭해서 추가하세요.

막대에는 **{n} selected**, **Move to**, **Give a role**(각 색상에 다음 역할을 차례로 배정), **Download**(여섯 팔레트 형식 중 하나로 선택 항목 다운로드), **Duplicate**(각 원본 뒤에 사본 하나씩 배치), **Copy values**, **Delete**가 차례로 있어요. 사본이 하나면 편집기에서 열리고, 여러 개면 선택된 상태를 유지해요. Cmd/Ctrl-Z 한 번으로 일괄 작업을 실행 취소해요.
:::

### 그라데이션

선택 사항인 **Gradients** 패널은 팔레트에서 혼합 토큰을 만들어요. 각 그라데이션에는 미리보기, 이름이 있는 정지점 2~8개, 각도가 있어요. 정지점은 견본을 가리키므로 견본의 색상을 바꾸면 그라데이션도 따라 바뀌어요. 혼합은 OKLCH에서 이뤄져요.

팔레트 다운로드(디자인 토큰, CSS, SCSS, GIMP, Adobe Swatch Exchange)는 팔레트 맨 위에 있어요. [팔레트와 글꼴을 어디서나 사용하기](/info/using.html#take-your-palette-and-fonts-anywhere)에서 각 형식을 설명해요.

<!--i:eti-type-->
## 서체

자체 서체가 없으면 화면에 카드 하나가 보여요. **Primary**는 현재 서체를 읽기 좋은 크기로 보여주며, **Starter** 태그, **Choose for Primary** 버튼, *"하나를 고르기 전에는 아무것도 설치되지 않아요."*라는 문구가 있어요. 제목, 코드, 이탤릭은 직접 고를 때까지 기본 서체를 따라요. **Choose them separately**를 누르면 해당 카드가 보여요.

![아직 서체를 고르지 않은 Type 화면 - 읽기 좋은 크기의 카드 하나에 Starter 태그가 있고, 색이 채워진 Choose for Primary 버튼 하나가 있어요](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

서체 하나를 고르면 화면에 역할 카드 네 개, Fonts 목록, 실시간 서체 예시가 펼쳐져요.

- **Primary**: 본문, 버튼, 모든 도구.
- **Headings**: `h1`과 `h2`용 제목 서체.
- **Code**: 코드와 데이터용 고정폭 서체.
- **Italic**: 강조, 인용, 보충 설명용 정식 이탤릭 서체.

직접 해당 서체를 설치한 카드에만 색상이 들어가요. 버튼에는 역할이 표시돼요. 직접 설치한 서체에는 **Change Headings**, 나머지에는 **Choose for Headings**가 보여요. 예시 문장은 줄바꿈돼요. 카드의 어떤 요소도 변경을 바로 적용하지 않아요. 버튼은 해당 역할의 비교 스테이지를 열어요.

![펼쳐진 네 역할 카드 - 각 역할의 서체로 표시되고, 아직 고르지 않은 곳에는 Starter 태그가 있으며 Italic은 기본 서체를 따라요](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### 비교 스테이지

누른 카드 아래에 스테이지가 열려요. 카드는 한 줄짜리 띠로 접혀서 휴대폰의 첫 화면에 스테이지가 보여요. Escape는 취소하고 카드로 포커스를 돌려줘요.

1. 카드에서 **Choose for**와 역할이 적힌 버튼을 누르세요.
2. 글꼴 패밀리 이름을 입력하고 **Preview**를 누르거나, 입력란 아래의 **Pinned** 패밀리 여섯 개 중 하나를 누르세요.
3. **Use this face**를 누르세요.

![카드 아래에 열린 비교 스테이지. 검색 행, 고정된 글꼴 패밀리, 한 줄짜리 띠로 접힌 카드가 있어요](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**동의는 한 번만 물어요.** 미리보기가 처음 Google Fonts에 접속하면 대화상자가 설명해요. *Google에 글꼴 패밀리 이름과 IP 주소가 전달돼요. 그런 다음 파일을 이 기기에 보관해 오프라인으로 써요. 스튜디오에서 제3자에게 접속하는 단계는 이것뿐이에요.* **Fetch from Google**은 진행하고 선택을 기억해요. **Cancel**을 누르면 카드에 *"가져오지 않았어요. Google에 아무것도 전송하지 않았어요."*가 표시되고, 자체 **Fetch from Google** 버튼이 남아요.

**스테이지에 글꼴 파일을 끌어다 놓아**(TTF, OTF, WOFF) 사용권이 있는 서체를 미리 보세요. 어느 방법이든 서체는 이 기기에 남고, 앱, 도구, 모든 내보내기에서 오프라인으로 렌더링되며, 디자인 시스템 파일과 함께 이동해요. Google Fonts의 모든 글꼴은 개방형 라이선스(OFL, Apache, UFL)로 제공돼요.

### 이 기기의 글꼴

이 기기의 모든 서체와 각 서체가 맡는 역할은 **Fonts** 패널에 나열돼요. 직접 추가한 서체가 **In the design system** 아래에 먼저 나오며, 각각 역할과 삭제 버튼이 있어요. 시작 서체는 흐리게 표시된 접힌 행 하나에 이어져요. **Add a face**는 어느 역할에든 쓸 수 있는 비교 스테이지를 열어요. **Type roles** 패널은 각 역할의 실시간 서체 예시를 *Inter* 또는 *Inter · follows Primary* 같은 패밀리 이름과 상태와 함께 보여줘요.

<!--i:eti-tag-->
## 토큰

토큰은 디자인 시스템을 구성하는 이름이 있는 값이에요. 색상, 서체, 로고, 모서리, 간격 등이에요. 도구가 이름으로 읽으므로 여기서 바꾸면 모든 도구에 한꺼번에 반영돼요.

![Tokens 화면: 맨 위의 시스템 예시와 파일 동작, 토큰 종류별 개수를 보여주는 타일, 그 아래의 색상 쌍과 대비 수치](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **맨 위**에는 자체 시스템의 예시(*Primary는 Spearmint, #033633이에요*)와 파일 동작이 있어요. **Download**(시스템을 디자인 토큰으로, 또는 팔레트를 다른 다섯 형식으로), **Copy CSS**, JSON 파일을 다시 읽어 들이는 **Add from…**예요.
- **타일**은 토큰 종류별 개수를 보여주고 해당 섹션으로 이동해요. Colours, Type, Logos, Shape and spacing, More, All tokens가 있어요. 빈 시작 시스템에 포함된 것만 있는 섹션에는 **Starter** 태그가 붙어요. 앱에 포함된 시스템은 이 태그 없이 자체 자료의 개수를 보여줘요. 휴대폰에서는 타일이 세 개씩 두 줄로 배치돼요.
- **Colours**는 도구가 함께 쓰는 쌍(배경 위의 텍스트, 주 색상 위의 색상, 배경 위의 보조 텍스트)과 밝은 모습과 어두운 모습의 APCA 수치로 시작하며, 기준에 못 미치는 쌍에는 **Weak contrast**를 표시해요. 그다음 모든 색상 그룹이 나와요. 색조 단계는 한 줄의 칩으로, 다른 색상은 값과 `{color.brand.spearmint}`처럼 도구가 쓰는 참조로 표시돼요. 참조를 누르면 참조가 복사돼요. **Edit in Colours**는 Colours 화면에서 그룹을 열어요. [색상 역할](#colour-roles-what-the-colours-are-called)이 있는 디자인 시스템에서는 **Colour roles**가 맨 앞에 오며, 시스템 자체의 이름과 순서대로 각 역할이 한 번씩 나와요. 역할은 컬러웨이와 모습마다 색상을 하나씩 유지해요. 이 색상은 별도 색상이 아니라 역할과 함께 나열돼요. Colour roles 표에서 바꾸세요.
- **Type**과 **Logos**는 각 역할의 서체와 각 로고 슬롯을 나열하며, 직접 추가한 것이 있으면 **Edit in Type**과 **Edit in Logos**가 나타나요.
- **Shape and spacing**에는 **Rounded corners**(`shape.radius`)와 **Spacing rhythm**(`space.base`)이 있어요. 각각 슬라이더를 움직이기 전에는 *Lolly default*, 이후에는 *Yours*로 표시되며, 즉시 저장되고 실행 취소할 수 있어요.
- **More tokens**는 간격, 크기, 선 두께, 불투명도, 회전, 일반 숫자, 그림자를 추가하며, 표준 [디자인 토큰](/info/design-tokens.html)으로 저장해요.
- **App appearance (advanced)**는 Lolly 자체 화면에서 쓰는 색상, 크기, 그림자를 나열하고, **Inspect every token (advanced)**는 저장된 모든 값을 검색하고 편집하며, 각 변경을 먼저 검토할 수 있게 보여줘요. 여기서는 각 컬러웨이의 색상 역할 값이 역할과 함께 나열돼요. 역할의 토큰을 고르면 컬러웨이당 한 행에 밝은 모습과 어두운 모습이 나란히 보여요. 개수 표시줄은 역할에 담긴 값이 몇 개인지 알려줘요. 읽기 전용 디자인 시스템도 같은 목록을 보여줘요.

빈 섹션에는 **Pick a colour**, **Choose a face**, **Add a logo**가 표시돼요.

<!--i:eti-images-->
## 파일

로고 외에 브랜드가 보관하는 파일을 끌어다 놓으세요. **벡터**, **이미지**, **오디오**, **모션** 파일(동영상, Lottie, 애니메이션)이에요. [Assets](/info/using.html#assets-your-library)에서 섹션별로 분류되어 나타나고, 모든 도구의 에셋 선택기에도 나타나요. 파일은 이 기기에 남아요.

## 사운드

**Sound**는 들어 보고 골라요. 화면은 세 가지 시작 사운드인 **Calm**, **Steady**, **Bright**로 열리며, 각각 장르의 색상을 입힌 카드에 재생 버튼이 있어요. 하나를 재생해 짧게 들어 보세요. 다른 사운드를 시작하면 앞의 사운드는 멈춰요. **Choose**는 그 사운드를 모든 용도에 적용해요. 네 번째 카드인 **Mixed**는 용도마다 자체 사운드를 배정해요. Explain에는 Calm, Demonstrate에는 Steady, Play에는 Bright예요. 재생 버튼은 세 사운드를 차례로 재생해요. **Save sound**를 고르기 전에는 아무것도 저장되지 않아요. 저장하면 사운드가 이 디자인 시스템의 일부가 되고, 다른 화면과 같은 기록에 체크포인트가 남아요. 사운드가 없는 디자인 시스템은 이전처럼 계속 동작해요.

용도는 사운드가 재생되는 상황이에요. 처음에는 **Explain**, **Demonstrate**, **Play**가 있어요. 각 용도는 자체 재생 버튼이 있는 칩이에요. 칩 위의 **Music** 또는 **With narration**은 칩이 음악만 재생할지, 음성 아래에 음악을 깔아 재생할지 정해요. 선택한 용도는 목적과 음악을 쉬운 말로 보여줘요. 예를 들면 "따뜻한 분위기 · 84 bpm · Rhodes, 굴러가는 베이스, 거친 질감의 드럼 키트"예요. 모든 용도는 선택한 사운드의 장르, 템포, 악기를 받아요(Mixed에서는 각각 자체 설정을 받아요). 각 용도는 자체 곡과 균형을 유지해요. Explain은 멜로디가 음성을 방해하지 않게 하고, Play는 멜로디를 앞세워요. Mixed와 단일 사운드 사이를 오가도 둘 다 유지돼요. 직접 추가한 용도는 Mixed에서 기존 사운드를 유지해요. 디자인 시스템은 선택한 것을 기록해요. **Add a use**는 용도를 하나 추가하고 그 자리에서 이름을 입력하게 해요. **Make main**은 별도 요청이 없을 때 재생할 용도를 정해요. **Another tune**은 같은 설정으로 새 곡을 재생해요.

**Edit in the music generator**는 해당 용도의 설정으로 [음악 생성기](/info/generated-music.html#the-music-generator)를 열고, 맨 위에 어느 용도의 사운드를 편집 중인지 보여줘요. **Save to this use**는 설정을 화면으로 가져오고, **Cancel**은 아무것도 바꾸지 않고 돌아와요. 화면에서 아직 저장하지 않은 선택은 자리를 비운 동안에도 유지돼요. 그사이 누군가 다른 탭에서 사운드를 저장하면 더 최근 저장이 유지되고 내 편집은 반영되지 않아요.

**Voice**는 용도에 쓸 목소리, 말하기 속도, 음성 아래에 깔리는 음악의 크기를 골라요. **Hear the voice with the music**은 둘을 함께 재생해요. **More** 아래에는 말하는 동안 음악의 음량을 낮추는 정도, 시험할 문구(이 화면에만 남아요), 발음 메모(한 줄에 하나씩, 표기 = 발음), 목소리 메모가 있어요. 미리보기는 기기의 음성 모델과 시퀀스 내보내기와 같은 믹싱을 써요. 미리보기는 서서히 잦아들며 끝나요. 곡의 마무리를 작곡한 것은 아니에요.

**Notes and signature**에는 용도별로 귀 기울여 들을 점과 사운드 시그니처가 있어요. 시그니처는 별도 오디오 파일로 보관하는 고정된 시작음이나 끝음이에요. 시그니처를 시퀀스에 배치하세요. 생성된 음악에는 시그니처가 포함되지 않아요. 이 버전의 Lolly가 확인할 수 없는 요구 사항이 있으면 해당 용도의 새 음악 생성이 중단돼요.

**Details**에는 브랜드의 특성(사운드가 어떤 느낌이어야 하는지, 무엇을 유지하고 무엇을 피할지)과 청취 검토가 있어요. **Record a listening review**는 검토자 이름, 날짜, 메모를 사운드의 저장된 버전에 기록해요. 무엇이든 바꾸면 사운드는 다시 초안이 돼요. 검토는 해당 버전에 적용되며, 이후 그 사운드로 만든 모든 곡에 적용되지는 않아요. 새 작품은 내보내기 전에 각각 들어 보세요.

**Make a music project**는 음악 생성기에서 용도를 프로젝트로 열어요. 프로젝트는 용도, 사운드 버전, 정확한 설정을 유지해요. 거기서 **New tune**은 새 곡을 만들고 사운드를 유지해요. 설정을 바꾸면 **Put the sound back**은 사운드 설정으로 되돌리고, **Keep as my own**은 독립된 곡으로 계속 작업하게 해요. 선택하기 전에는 프로젝트를 해당 사운드로 만든 것으로 저장하거나 다운로드할 수 없어요. 공유 링크에는 음악 설정만 담겨요. 프로젝트와 저장된 곡은 사운드 메모도 보관하지만, 이 메모는 공유 링크와 오디오 파일의 공개 자격 증명에는 포함되지 않아요. 생성기의 이후 버전에서도 정확히 같은 오디오가 필요하면 렌더링한 녹음 파일을 보관하세요.

<!--i:eti-checklist-->
## 규칙

**Rules**는 사용자가 바꿀 수 있는 것, 고정되는 것, Lolly가 검사할 수 있는 것을 설정해요.

![Lolly Demo의 Rules: 각각 Checked in Design과 Required 또는 Advisory로 표시된 네 조직 규칙, 그다음 렌더링할 예시가 준비된 Try your design system in use](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules**는 규칙을 나열해요. **Add rule**(또는 **Add your first rule**)은 짧은 양식을 열어요.

- *Beacon 강조 색상*처럼 직접 정한 **Rule name**;
- **Check**: **Colour choices**, **Font choices**, **Fixed artwork**, **Text length** 중 하나와 여기에 쓰이는 브랜드 역할. 역할은 직접 정한 이름으로 표시돼요;
- 적용할 **Example**(Poster, Title slide, Content slide, Lolly Chart), **Mode**, **Required**인지 **Advisory**인지 여부;
- **Reviewed by**, 그다음 **Save draft** 또는 **Approve & save**.

승인은 이 기기에 내 결정을 기록해요. 승인된 필수 규칙은 재사용 가능한 포스터를 제한하며, 검사는 예시 PNG에만 적용돼요. 다른 도구는 바꾸지 않아요.

승인된 색상 조합, 텍스트 굵기와 정렬, 배경별 로고 같은 디자인 시스템 토큰 파일의 규칙은 여기에 **Checked in Design**으로 나열돼요. Lolly Design은 내보내기 패널의 **Before you export** 카드에서 레이어별로 검사하고, `lolly check`는 저장된 Lolly Design 문서에 같은 검사를 해요([내보내기 전에](/info/design.html#before-you-export)). 이 빌드에 검사기가 없는 규칙은 제공된 그대로 보관되고 **Unchecked**로 표시돼요.

Lolly Demo에는 승인된 조직 규칙 네 개가 있어요. 큰 제목은 대문자로 쓰지 않아요. 이 규칙은 필수이므로 `lolly check`는 대문자 큰 제목을 오류로 보고해요. 나머지 세 개는 권고 사항이에요. 본문 텍스트는 왼쪽 정렬해요. 기본 로고는 밝은 배경에, 반전 로고는 어두운 배경에 놓아요. 점선은 여기에 끌어다 놓으라는 뜻이에요.

**Try your design system in use**는 **Render & check examples**로 현재 리비전의 예시 네 개를 렌더링해요. **Mode**를 고르고 **Try your own text**에서 제목, 보조 텍스트, 슬라이드 텍스트를 입력하세요. 각 예시는 측정한 내용을 **See checks & sources**, **Download check report**와 함께 알려줘요. **Make reusable poster**는 고정된 레이아웃과 승인된 입력 선택지가 있는 `.lolly`를 다운로드해요. 예시는 기기에서 동작해요. 검사를 실행해도 아무것도 게시되거나 승인되지 않아요.

고정 브랜드가 포함된 빌드는 *This brand is set* 아래에 같은 규칙과 예시를 읽기 전용으로 보여줘요.

<!--i:eti-graduation-cap-->
## 스킬

**Skills**는 활성 디자인 시스템의 [브랜드 스킬](/info/brand-skills.html)을 나열해요. 사람과 AI 에이전트를 위해 분야별로 하나씩 작성된 브랜드 기준이에요. 각 행에는 분야, 브랜드 자체의 상태(**Draft** 또는 **Approved**), 스킬의 공개 또는 내부용 여부, 리비전이 있어요. 행을 선택하면 스킬과 적용 범위를 읽을 수 있어요. 적용 범위는 스킬의 각 줄을 토큰과 비교해 Lolly가 검사하는 것, 충돌하는 것, 일치하는 것, 지침만 제공하는 것을 보여줘요.

**Download skill (.zip)**는 에이전트 도구용 Agent Skills 폴더로 스킬을 저장하며, 카탈로그 링크는 이 Lolly를 가리켜요. **Copy as one file**은 채팅 창에서 쓸 수 있도록 같은 텍스트를 클립보드에 놓아요. 자체 스킬이 없는 디자인 시스템에는 기본 스킬이 표시돼요. Lolly는 기본 스킬을 읽을 때마다 해당 시스템의 토큰과 조직 규칙으로 이를 작성해요. 이 화면은 스킬을 읽기만 하고 편집하지 않아요.

<!--i:eti-upload-->
## 브랜드 가져오기

**Add from…**를 막대에서 누르면 파일 형식 대신 가지고 있는 자료를 묻는 선택기가 열려요.

- **Design tokens or a design file**: DTCG 또는 Tokens Studio JSON, Penpot 프로젝트, 토큰 세트 zip, Lolly 디자인 시스템 팩, SVG, `DESIGN.md`, 브랜드 페이지 폴더.
- **PDF**: 덱이나 가이드라인 파일에서 기기로 색상, 로고, 임베드된 서체를 읽어요.
- **Logo or screenshot**: 기기에서 이미지를 읽어 팔레트를 제안해요. 서체나 레이아웃이 아니라 색상을 읽어요.
- **Saved web page**: HTML 파일 하나와 CSS 파일들, 또는 붙여넣은 HTML이나 CSS로, 최대 20개 파일과 2 MB예요. 제공한 텍스트만 읽어요. 연결된 리소스를 가져오지 않고 스크립트도 실행하지 않아요.
- **Font file**: TTF, OTF, WOFF. 서체를 설치하는 Type 화면을 열어요.
- **Website**: 페이지 하나에서 색상과 서체를 읽어요. 이 타일은 페이지를 읽을 수 있는 기기에만 나타나며, 이 기기의 앱을 쓰는지, 사용자로 로그인된 백그라운드 탭의 브라우저 확장 프로그램을 쓰는지 알려줘요. URL을 입력하면 입력란만 채워져요. 가져오기 버튼을 눌러야 동의한 것으로 봐요.

디자인 파일 소스를 고르면 다음 카드에 지원 형식이 아이콘 타일로 나열돼요. 카드 전체가 하나의 끌어다 놓기 영역이에요. 스튜디오에 파일을 바로 끌어다 놓을 수도 있어요.

![가져오기 카드 - 지원 형식이 아이콘 타일로 먼저 나오고, 카드 전체가 하나의 끌어다 놓기 영역이에요](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- **Lolly 디자인 시스템 팩**(`.lolly` 또는 이전 형식인 `.zip`)은 한 단계로 설치돼요.
- **Penpot** 내보내기 파일(`.penpot`)은 디자인 토큰을 가져와요.
- **Design Tokens**(W3C DTCG) 또는 **Tokens Studio** 파일(`.json`)은 토큰을 가져와요. 읽는 이에게 지시를 무시하라고 하거나, 권한이 있다고 주장하거나, 코드 실행을 요구하는 설명은 제외되며, 가져오기 화면이 해당 설명의 위치를 알려줘요.
- **일반 SVG**에서는 색상을 찾아 선택하게 하며, 첫 번째가 주 색상이 돼요.
- **`DESIGN.md`**(`.md`)는 토큰을 작성된 그대로 담아 **Try these colours**로 이동해요. 본문은 브랜드 스킬 초안으로 보관할 수 있으며, 카드는 읽는 이에게 지시를 무시하거나 권한을 주장하거나 코드를 실행하라고 하는 줄을 표시해요. Skills 화면에서 **Keep this skill**을 누르기 전에는 에이전트와 브랜드 페이지에 초안이 보이지 않으며, 보관한 스킬도 내부용으로 남아요.
- **브랜드 페이지 폴더**는 폴더로 선택하거나, 끌어다 놓거나, zip으로 가져오면 같은 검토 화면으로 이동해요. 모든 파일을 폴더의 `brand.json`과 대조해 검사하며, 하나라도 일치하지 않으면 폴더 전체를 거부해요. 가져오기는 토큰을 추가해요. 로고와 글꼴은 폴더에 남아요.

::: warning 지시 검사는 줄 단위로 읽어요
토큰 파일의 설명에서 지시를 제외하는 검사는 줄 단위로 읽으며, 다른 표현은 놓쳐요. 모르는 사람에게 받은 파일은 토큰을 적용하기 전에 읽어 보세요.
:::

Lolly는 제공한 파일에서 브랜드 페이지를 읽어요. 다른 사이트의 주소에 접속해 가져오지 않아요.

### 자체 색상 이름이 있는 파일

토큰 파일이나 `DESIGN.md`는 색상에 main, accent, supporting, tertiary 같은 자체 이름을 쓸 수 있어요. Lolly가 이런 이름을 찾으면 적용 전에 검토 화면에서 각각을 나열해요. 이름, 각 모습의 색상, 원본 토큰, Lolly가 제안하는 해석이 보여요. Lolly는 모델 없이 짧은 목록에 이름만 대조해 해석을 제안해요. 목록에 없는 이름은 브랜드 자체의 이름으로 들어와 **By name only**가 돼요. 어떤 이름이든 바꾸고, 용도를 설명하고, 다른 해석을 배정하거나, 체크를 해제해 이름이 있는 색상으로 유지할 수 있어요.

**Install with these roles**는 역할을 기록하고, **Install without roles**는 파일을 받은 그대로 설치해요. 이런 이름이 없는 파일은 이 단계를 건너뛰어요. Lolly가 작성한 파일처럼 자체 역할을 명시한 파일은 작성된 그대로 보여주고 변경 없이 설치해요. 나중에 Colours 화면에서 편집할 수 있어요. 터미널에는 검토 화면이 없어요. `lolly system import`는 명시된 레코드를 유지하고, 다른 파일의 이름은 이름이 있는 색상으로 남겨요.

### 참조 자료 검토하기

로고, 스크린샷, 웹사이트, 저장된 페이지는 **Try these colours**를 열어요. 제안된 색상의 예시, 바꿀 수 있는 **Main colour**, 새 시스템의 이름이 있어요. 상자는 적용하면 어떻게 되는지 알려줘요. 활성 토큰 설정을 생성된 팔레트와 기본 스타일로 **교체**하고, 글꼴과 라이브러리 파일은 **유지**하며, 이전 시스템은 **복구**할 수 있어요. **Apply suggested settings**는 체크포인트를 만든 뒤 밝은 팔레트와 어두운 팔레트를 적용해요. **Restore brand settings**로 이전 설정을 되돌릴 수 있어요. **Change reference**는 다른 소스를 골라요.

::: details 참조 자료에서 읽는 내용과 디자인 컨텍스트 보고서
**Palette, source details and individual choices**는 읽어 들인 내용, 발견한 글꼴 이름, 미리보기의 대비를 보여줘요. 글꼴 이름은 제안일 뿐이며, 서체는 Type에서 설치해요. 소스 세부 정보에는 관찰된 타이포그래피, 간격, 패딩, 모서리 값이 포함될 수 있고, 관찰되지 않은 항목에는 **Not observed**가 표시돼요. 저장된 페이지나 네이티브 방식으로 읽은 웹사이트는 선언된 스타일을 보고하며, 페이지가 실제로 쓰지 않는 스타일일 수도 있어요. 브라우저 확장 프로그램은 화면에 보이는 일부 요소에서 측정한 스타일을 보고할 수 있어요. 이는 관찰 결과예요. 아무것도 설치되지 않으며, 소스의 간격이 자체 간격을 대체하지 않아요. **Choose individual items in the tray**는 개별 항목을 보관해요. **Download design context**는 관찰 결과, 제안된 토큰, 소스 정보를 JSON 보고서로 저장해요(제공한 HTML이나 CSS의 SHA-256 포함). 보고서에는 페이지의 원문 텍스트가 없으며, 서명된 Content Credential이 아니에요.
:::

PDF와 디자인 파일 가져오기는 각자의 검토 컨트롤을 유지해요. **Tray**의 항목은 해당 자료를 다루는 화면에서 추가하기 전에는 아무것도 바꾸지 않아요. `#/start?source=<kind>`는 소스(`file`, `pdf`, `image`, `font`, `url`, `page`)를 선택한 상태로 선택기를 열고, `?import`는 일반 목록을 열어요.

### 모습 찾고 비교하기

Board나 Settings의 디자인 시스템 목록에서 **Find a look**을 여세요. 이 기기에 저장된 시스템과 재사용할 수 있는 Lolly 예시 몇 가지를 살펴보고, 이름, 색상 태그, 선언된 글꼴로 검색하세요. **Closest to my current palette**는 측정한 색상 유사도로 정렬하며, 동률이면 글꼴 일치 여부로 순서를 정해요. 품질 점수가 아니에요.

모습을 클릭하면 실제 적용된 예시를 미리 볼 수 있어요. 미리보기는 아무것도 바꾸지 않아요. 카드의 **Use this look**은 그 모습을 적용해요. 저장된 시스템은 활성 시스템이 되며, 아무것도 편집하지 않아요. 예시의 색상은 평소처럼 체크포인트를 만든 뒤 열려 있는 디자인 시스템에 들어가요. 시스템의 로고, 글꼴, 예시에 정의되지 않은 나머지는 그대로 유지돼요. **Compare looks**는 각 카드에 체크박스를 추가해요. 두 개를 골라 나란히 비교하세요. **Restore brand settings**는 이전 모습을 복구해요. 저장된 시스템에는 **Details and design context** 아래에 편집 가능한 **Search tags**가 있어요. 예시는 Lolly가 직접 만든 배색이며, 수집해 온 모음도 계정도 없어요.

![어느 색상 시스템도 적용하기 전에 Lolly Compare에서 Sunroom과 Orchard를 나란히 비교해요.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

<!--i:eti-package-->
## 디자인 시스템 보관하고 옮기기

### 기기 사이로 브랜드 옮기기

**Export**는 **`LollyBrand-….lolly`** 파일 하나를 만들어요. 토큰, 글꼴, 로고, 테마 환경설정과 가져올 때 검사하는 무결성 매니페스트가 담겨요. 1.0.7 이전 웹 릴리스에서는 파일 확장자가 `.zip`이었고, Lolly는 여전히 이 확장자를 받아요. **Tokens (.json)**는 저장소, 빌드 단계, 다른 토큰 도구에 쓸 수 있도록 글꼴과 로고 없이 순수 디자인 토큰 문서를 만들어요.

다시 가져오려면 **Add from… → Design tokens or a design file**을 쓰거나 스튜디오에 파일을 끌어다 놓으세요. 계정이나 클라우드 없이 동료에게 브랜드를 받거나 다른 설치 환경으로 브랜드를 옮기는 방법이에요. [파트너와 작업하기](/info/partners.html)에서는 브랜드를 받는 사람이 다른 조직에서 일할 때 함께 보내야 할 것을 다뤄요. 명령줄에서 브랜드를 가져오려면 [`ingest:brand`](/info/configuration.html#brand-packs)를 참고하세요.

**Fonts for Linux (.rpm)**은 추가한 글꼴을 설치 가능한 RPM으로 묶어요. 직접 업로드한 글꼴이 하나라도 있으면 Lolly는 먼저 재배포 권한이 있는지 확인하도록 요청해요.

### 이전 설정 복원하기

막대에서 **More**를 열고 **Restore brand settings**를 고른 뒤 날짜가 표시된 체크포인트를 선택하고 **Restore**를 누르세요. 활성 브랜드의 색상, 서체 설정, 다른 토큰이 복원되며, 글꼴과 이미지 파일은 그대로 유지돼요. Lolly는 먼저 현재 설정을 **Before restore**로 저장하므로, 브라우저를 닫은 뒤에도 복원을 되돌릴 수 있어요. 최근 체크포인트 20개가 이 기기에 보관돼요. 스튜디오에 **Saving…**이 표시되는 동안 편집한 내용도 새로고침 후에 유지되며, 저장이 끝나지 않은 변경은 카드에서 복원할 수 있어요.

### 버전

게시된 버전은 이 기기에 보관되는 **이름이 있는 영구 사본**이에요. 절대 바뀌지 않으므로 `designv`로 해당 버전을 고정한 도구나 링크는 계속 같은 것을 그려요. 직접 추가한 것이 있는 시스템은 막대의 **More** 메뉴에 **Versions & publishing**을 표시해요. 처음 게시하면 화면 목록에 **Versions**가 추가돼요. `#/start?area=versions`로 Versions를 열어요.

::: warning 게시된 버전은 영구적이에요
아직 삭제 기능은 없으며, 패널에도 그렇게 표시돼요. 게시는 되돌릴 수 없고, 복원은 되돌릴 수 있어요. *Restore latest from this version*은 일반 편집이며, 바로 **Undo**가 제공돼요.
:::

**호환성 카드에는 제거된 항목이 먼저 나와요**. 토큰을 제거하면 도구가 제대로 동작하지 않기 때문이에요.

**Publish only**는 도구가 따르는 대상을 바꾸지 않고 버전을 보관해요. **Publish and make active**는 도구와 앱이 그 버전을 따르게 해요. **Follow the latest again**은 모든 편집을 즉시 반영해요.

### 브랜드 페이지 게시하기

[브랜드 페이지](/info/brand-page.html)는 사람과 에이전트를 위한 하나의 주소예요. 로고, 색상, 서체, 예시가 있는 페이지와 같은 정보를 담은 파일이 함께 있어요. Versions & publishing 아래의 **Publish a brand page**는 실시간 페이지를 보여주며, 페이지 옆에는 다음 항목이 있어요.

- **Goes public**: 모든 파일을 그룹별로 크기와 함께 보여줘요.
- **Held back**: 제외된 항목과 이유예요. 라이선스가 기록되지 않은 로고는 로고 이름에 체크할 때까지 제외돼요. 글꼴 파일에는 전달을 허용하는 라이선스가 기록되어 있어야 하며, 파일이 제외되면 페이지에는 윤곽선으로 만든 서체 예시가 보여요. 내부용 브랜드 스킬은 표시되지 않아요.
- **What was checked**: 컬러웨이와 모드별 색상 쌍, 조직 규칙이에요. 판정이 아니라 측정 결과예요.
- **In your words**: 사용 안내문과 연락처예요. 페이지는 작성한 내용을 표시하며, Lolly는 라이선스나 법적 주장을 추가하지 않아요. 스위치로 바닥글의 "Made with Lolly" 문구를 끌 수 있어요.
- **On exports**: [이 디자인 시스템의 내보내기에 페이지 주소를 기록하는](/info/brand-page.html#lead-back-from-your-files) 스위치예요. 직접 켜기 전까지 꺼져 있고, `https` 주소가 필요하며, 팩이나 사본과 함께 이동하지 않아요. 잠긴 디자인 시스템에는 스위치가 보이지 않아요. 관리자가 결정하기 때문이에요.

**Download folder**는 원하는 곳에 호스팅할 수 있도록 폴더를 ZIP으로 저장해요. 폴더를 호스팅하기 전에는 아무것도 공개되지 않아요. 터미널에서는 `lolly system publish --out=<dir>`가 같은 폴더를 만들어요. 브랜드 페이지를 제공하는 인스턴스에는 해당 주소로 보내는 **Publish to**도 있어요. 명시적으로 한 번 눌러야 하며, 인스턴스에 승인 절차가 있으면 그 절차를 거쳐요. 관리되는 디자인 시스템은 관리자가 허용할 때만 게시돼요.

### 에이전트 연결하기

**Connect an agent**는 같은 곳에서 붙여넣을 텍스트를 제공하고 각 옵션으로 할 수 있는 일을 알려줘요.

- 프로젝트의 **`AGENTS.md`**: 에이전트가 시스템의 이름과 규칙을 읽어요. 아무것도 그리지 않고 서버가 필요 없어요.
- **Lolly의 공개 서버**: 여기서 어떤 시스템을 열었든 Lolly Demo로 그려요. 키가 필요 없어요.
- **내 인스턴스**: 인스턴스에 있는 시스템으로 그리며, 환경 변수에서 서비스 토큰을 읽어요. 시트는 변수 이름을 알려주고 토큰은 보여주지 않아요.

내 시스템으로 그리는 호스팅 서버가 없으면 시트에 그렇게 표시돼요.

<!--i:eti-layers-->
## 디자인 시스템 관리하기

시스템을 전환하거나 추가하거나 제거하려면 **Settings → Preferences → Design systems**를 여세요. **Open**은 시스템을 선택하고 여기서 열어요. **Make a new one**은 기기에 시스템을 만들고 이름을 입력할 수 있는 상태로 열어요. 한 번에 하나의 시스템이 기기 전체에서 활성화돼요. [브랜드 구조](/info/brand-architectures.html)는 브랜드에 자체 디자인 시스템이 필요한 시점을 결정하는 데 도움을 줘요.

**시스템의 출처.** 배포 환경의 카탈로그가 제공하는 시스템에는 **Came with this app**, 인스턴스에 연결된 앱에서는 **From this instance**가 표시돼요. **Catalogue source**를 펼치면 제공자, 토큰 에셋과 네임스페이스, 알려진 버전이나 체크섬을 볼 수 있어요. 새로고침에 실패하면 캐시된 자료라고 표시돼요.

**관리되는 시스템은 읽기 전용이에요.** 카탈로그가 시스템을 잠그면 **Managed by this instance**(인스턴스에 연결되지 않은 데스크톱 앱에서는 **Managed by this app**)로 표시돼요. 관리되는 시스템도 사용하고 다운로드할 수 있어요. 여기서 열면 읽기 전용 안내와 **Make an editable copy**, **Switch**가 먼저 나오고, 그다음 편집 컨트롤 없이 색상 역할과 토큰이 보여요. 관리되는 시스템이 먼저 있었더라도 직접 만든 로컬 시스템은 계속 편집할 수 있어요. 고정 브랜드 하나가 있는 빌드는 브랜드의 토큰과 사용 규칙을 읽을 수 있도록 Lolly Design System Setup의 *This brand is set*을 열어요.

**그 밖에 제공되는 모든 시스템은 자유롭게** 숨기고 편집하고 재설정할 수 있어요. lolly.tools의 Lolly Demo와 Lolly Starter도 포함돼요. 하나를 편집하면 이름은 유지되고 행에 **Edited here**가 표시돼요. 메뉴의 **Reset to original**은 이 기기에서 바꾼 내용을 버려요. 빈 시작 시스템은 예외예요. 처음 바꾸면 자체 디자인 시스템이 시작되고 Lolly가 이름을 한 번 물어요. [Lolly Demo 사용하기](/info/lolly-demo-in-use.html#switch-to-your-own)에서 자체 시스템이 무엇을 대체하는지 보여줘요.

### 디자인 시스템 제거하기

시스템 메뉴에서 **Remove**를 고르세요. 확인 창은 제거 후 어떤 시스템이 활성화될지 알려줘요. 저장된 세션, 업로드한 파일, 다른 시스템과 공유하는 자료는 유지돼요.

제공된 시스템을 제거하면 시스템만 숨겨져요. 카탈로그 에셋은 남고, **Bring back**으로 다시 표시할 수 있으며, 다른 시스템을 모두 제거하면 자동으로 돌아와요. 가져오거나 편집한 사본을 제거해도 원래 제공된 시스템과 그 로고, 글꼴은 제거되지 않아요. 사본이 활성 상태였다면 원래 제공된 시스템이 다시 활성화돼요. 활성 상태인 호스팅 사본을 제거하면 그 사본의 연결만 해제돼요. 따로 고른 인스턴스는 선택된 상태를 유지해요.

::: details 서버가 제공하는 디자인 시스템 바꾸기
서버가 제공하는 것을 바꾸는 일은 관리자의 작업이에요. 운영자가 소스 카탈로그를 바꾸고 다시 배포하거나, Lolly Work 관리자가 서버 변경을 검토하고 적용해요. 여기서 편집한 내용은 기기에만 남지만 예외가 하나 있어요. `brand.edit` 권한을 부여받은 Lolly Work 인스턴스에서는 관리되는 시스템에도 해당 인스턴스의 **Edit for**가 표시되며, 편집용 사본을 열어요. **Versions**에서 해당 인스턴스의 **Send to**를 누르면 색상, 컬러웨이, 색상 역할, 브랜드 페이지 주소가 다시 전송돼요. [스튜디오에서 이 인스턴스 편집하기](/info/work-design-system-administration.html#edit-this-instance-from-the-studio)에서 바꿀 수 있는 항목과 인스턴스가 변경을 제공하는 방식을 다뤄요. [카탈로그 디자인 시스템 제거하기](/info/configuration.html#removing-a-catalogue-design-system)와 [구성](/info/configuration.html#supplied-and-local-design-systems)을 참고하세요.
:::

<!--i:eti-code-->
## 앱 밖에서 디자인 컨텍스트 사용하기

**Download design context**는 토큰 문서, 해석된 색상, 선언된 글꼴 패밀리, 에셋 id, 기록된 출처 근거, 적용 범위, 명시적 규칙을 저장하며, 글꼴 파일과 소유권 증명은 포함하지 않아요. 명령줄은 서버 없이 파일을 읽어요. `lolly system import`는 이를 터미널의 디자인 시스템으로 설정하고, `lolly system check`는 저장된 컨텍스트에 맞춰 Lolly Design 입력을 검사해요. [디자인 시스템 가져오기](/info/cli.html#bring-your-design-system)에서 가져오기를, [명령이 사용하는 디자인 시스템](/info/cli-decks.html#which-design-system-a-command-uses)에서 검사를 다뤄요. MCP 클라이언트는 `lolly://design-context`에서 같은 브리프를 읽어요([MCP 서버](/info/mcp.html)).

<!--i:eti-map-pin-->
## 다음에 살펴볼 내용

- **[Lolly 사용하기](/info/using.html)**: 도구, 저장, 공유, Assets.
- **[브랜드 구조](/info/brand-architectures.html)**: 사업부, 제품, 보증 브랜드, 고객, 시즌을 디자인 시스템, 컬러웨이, 로고 아이덴티티에 대응시키는 방법.
- **[파트너와 작업하기](/info/partners.html)**: 파트너와 브랜드 공유하기, 전달받은 브랜드로 작업하기.
- **[브랜드 페이지](/info/brand-page.html)**: 보도 자료 키트와 에이전트 키트로 디자인 시스템을 하나의 주소에 게시하기.
- **[디자인 토큰](/info/design-tokens.html)**: 브랜드를 작성하는 토큰 모델.
- **[파일 내보내기](/info/exporting.html)**: 인쇄 단위, CMYK, 브랜드가 렌더링되는 형식.
