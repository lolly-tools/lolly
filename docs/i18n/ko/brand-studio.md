# Lolly Design System Setup

<a id="design-system-setup"></a>

로고, 색상, 서체는 한곳에 있어야 모든 도구, 페이지, 내보내기가 그것으로 그려져요. 그곳이 `#/start`의 **Lolly Design System Setup**이에요.

가진 것으로 시작하세요. 로고를 놓으면 Lolly가 색상을 읽어요. 서체를 고르거나 회사가 라이선스한 글꼴 파일을 놓으세요. 변경은 모두 앱 전체에 바로 반영돼요. 로고, 글꼴, 토큰은 이 기기에 머물러요. Google Font를 고르는 것만 밖으로 나가는 단계이며, Lolly가 먼저 묻고 패밀리를 한 번 가져와요.

마음에 들면 디자인 시스템에 이름을 붙이고 **Export**를 누르세요. 보관하거나, 다른 기기에서 열거나, 동료에게 건넬 `.lolly` 파일 하나가 생겨요. [Lolly Settings](/info/dashboard.html#design-system)는 활성 시스템을 읽기 전용으로 보여주며, 그 표지에서 편집하러 여기로 연결돼요.

## 5분 만에 나만의 것으로 만들기

::: timeline
- <!--i:upload--> **로고 놓기.** **Logos**의 드롭 영역에 놓으세요. Lolly가 모양과 색상을 읽어요.
- <!--i:palette--> **이 색상 사용.** 로고의 주 색상이 기본 색상이 되고, 로고의 어두운 중립색이 텍스트 색상이 돼요.
- <!--i:font--> **서체 선택.** **Type**에서 Google Font 또는 가지고 있는 글꼴 파일을 고르세요.
- <!--i:pentool--> **시스템 이름 붙이기.** 첫 편집이 사용자 자신의 디자인 시스템을 만들며, Lolly가 이름을 한 번 물어요.
- <!--i:download--> **Export**가 전체 시스템을 `LollyBrand-….lolly` 파일 하나로 써요.
:::

스튜디오 맨 위의 바에는 디자인 시스템의 이름이 있고, 이름은 언제든 바꿀 수 있는 입력란이에요. **Enter**는 새 이름을 유지하고 **Escape**는 이전 이름으로 되돌려요. 첫 편집이 **What is this design system called?**라고 물을 때, 로고가 글자를 포함하면 로고의 단어가 미리 채워져요. **Save name**은 이름을 유지하고, **Not now**는 바에 입력할 때까지 임시 이름을 유지해요. 이름은 Settings와 전환할 때 시스템의 라벨이 되고 **Export**가 쓰는 파일 이름이 돼요.

## The rooms

스튜디오는 정해진 순서가 없는 룸의 모음이에요. 번호도 없고 다른 것을 기다리는 것도 없어요. 데스크톱에서는 룸이 바 아래의 띠 하나에 놓여요. 휴대폰에서는 엄지가 닿는 아래쪽 가장자리의 바로 옮겨 가고, 열린 룸이 보이도록 스크롤돼요. 팔레트 시트와 트레이는 그 바 위로 올라오고, 입력하는 동안에는 바가 비켜요. 키보드로는 Tab이 띠에 한 번 닿고, 화살표 키, Home, End로 룸 사이를 이동해요.

![스튜디오의 바와 룸: Board, Colours, Type, Logos, Tokens, Files, Rules, Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| 룸 | 하는 일 | 링크 키 |
|---|---|---|
| **Board** | 시스템에 담긴 것을 보고, 각 룸으로 가는 문이 있어요 | `overview` |
| **Colours** | 색상을 추가하고, 역할을 주고, 음영과 팔레트를 만들어요 | `color` |
| **Type** | 앱, 도구, 모든 내보내기가 읽는 서체 네 개를 골라요 | `type` |
| **Logos** | 모든 방향과 처리 방식으로 마크를 배치해요 | `logos` |
| **Tokens** | 모서리, 간격, 그림자, 그 밖의 모든 이름 붙은 값 | `tokens` |
| **Files** | 브랜드가 보관하는 이미지, 오디오, 모션 파일 | `catalogue` |
| **Rules** | 브랜드가 적용하는 규칙을 실제 예시로 확인해요 | `usage` |
| **Skills** | 사람과 에이전트를 위한 브랜드의 문서화된 기준을 읽고 내려받아요 | `skills` |

`#/start?area=<key>`로 룸에 연결해요. 룸 키는 영구 계약이므로 Files 룸은 키 `catalogue`를, Board는 `overview`를, Rules는 `usage`를 유지하고, `?tab=`도 예전 별칭으로 계속 작동해요. 알 수 없는 키는 Board를 열어요.

**바**에는 한 룸이 아니라 시스템 전체에 대한 동작이 있어요. **Add from…**은 브랜드를 가져오고([브랜드 가져오기](#bring-a-brand-in)), **Tray**는 스캔이 찾았지만 아직 추가하지 않은 것을 담아요. **Export**는 시스템을 파일 하나로 쓰고, **More**에는 **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings**, **Design systems**가 있어요. **Design systems**는 전환할 수 있는 Settings의 목록을 열어요([디자인 시스템 보관과 이동](#keep-and-move-your-design-system)). 각각 작용할 대상이 있을 때 나타나요. 휴대폰에서는 **Add from…**이 **More** 안으로 들어가고 **Export**는 아이콘으로 보여요.

## Board

아직 선택한 것이 없으면 Board는 시작하는 방법 네 가지를 제안해요. **Start from a reference**는 로고, 스크린샷, 웹 페이지, 디자인 파일의 소스 선택기를 열고, **Pick a colour**, **Choose a face**, **Add a logo**는 해당 컨트롤을 바로 열어요. 하나를 열어도 아무것도 쓰이지 않으며, **Explore the tools**는 처음부터 있어요.

무언가 사용자 자신의 것이 되면 Board는 가진 것을 보여주며 사용자의 개수가 앞에 와요. Colours는 색상 수를 보여주고, 상속된 색상이 있으면 흐린 `· N starter`가 붙어요. 띠는 사용자의 색상을 먼저, 그다음 가는 선, 그다음 흐려진 스타터 색상을 놓아요. Colourways는 각 컬러웨이를 대표 색상의 작은 타일로 보여줘요. Type은 역할별로 읽히고 각 패밀리를 자기 서체로 보여줘요(*Inter for headings*, 그 아래 줄에 *Starter for the rest*). Logos는 채워진 슬롯 수(또는 **Not set**)를 알려주고, Tokens는 모서리 반경을 보여주며, Files는 라이브러리가 비어 있는 동안 **Nothing yet**이라고 해요. 모든 블록이 해당 룸을 열어요.

Lolly Demo처럼 앱과 함께 오고 편집할 수 있는 디자인 시스템은 처음부터 이 모두를 갖고 있어요. Board에 색상, 컬러웨이, 서체, 마크가 보이고 제목 옆에 **Came with this app** 태그가 붙어요.

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
- Board와 Tokens에서 세어져요.
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

![Horizontal과 Vertical이 열린 로고 슬롯: 각 처리 방식이 자체 슬롯이며 모든 슬롯은 선택 사항이에요](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks**는 아이콘, 문장, 파비콘처럼 브랜드가 자체 이름으로 부르는 마크예요.
- **More identities.** 서브 브랜드, 제품, 행사는 자체 전체 세트를 가질 수 있어요. **+ Add another logo**를 누르고 세트에 이름을 붙이세요. 기본 세트는 "Your logo"예요. [브랜드 아키텍처](/info/brand-architectures.html)가 로고 신원이 알맞은 블록인 경우를 보여줘요.
- **Lolly가 로고의 색상을 읽어요.** 드롭 영역 아래와 Colours 맨 위의 카드가 로고의 색상을 나열하고 **Which is the main colour?**라고 물으며, 가장 강한 색상이 미리 선택되어 있어요(내보낸 흰 배경은 절대 아님). **Use these colours**는 이를 팔레트에 추가하고, 주 색상을 기본 색상으로 만들며, 로고에 종이 위에서 읽히는 어두운 중립색이 있으면 그것을 텍스트 색상으로 만들어요. **Not now**는 Tray에 남겨요. 새로 설치한 상태에서는 가장 유력한 답이 바로 적용되고 카드가 **Undo**나 다른 주 색상을 제안해요. SVG는 정확한 색상을 주고, PNG, JPEG, WebP는 마크에서 실제로 의미 있는 비중을 차지하는 색상을 줘요.

## Colours

룸은 디자인 시스템과 함께 자라요. 처음 방문하면 결정은 하나이고, 나머지는 팔레트가 생기면서 와요.

### 첫 번째 색상

자체 색상이 없는 시스템은 스타터의 중립색을 자체 그룹에 펼쳐 보여주고, 룸 맨 위에 점선으로 된 붙여넣기 및 놓기 영역을 보여줘요. 큰 칩 하나와 입력란 하나예요. 이미지나 색상 목록을 영역 어디에든 놓으면 Lolly가 놓은 것에서 색상을 읽어요.

- **칩이 선택기예요.** **Pick a colour**를 누르면 스튜디오의 OKLCH 카드가 입력란에 있는 값으로 채워져 열려요. 색상 이름과 헥스가 먼저 나오고, 색상 공간, 휠, 다이얼 네 개, 알파는 **Fine-tune** 아래에 있으며, 아래에 **Cancel**과 **Add colour**가 있어요. **Add colour**를 누르기 전에는 시스템에 아무것도 반영되지 않아요.
- **입력란은 모든 표기를 받아요**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)`, 색상 이름. 목록을 붙여넣으면 하나씩 또는 **Add all**로 추가할 칩의 행이 돼요.
- **들어오는 방법 두 가지 더.** **Pick a colour from the screen**은 브라우저에 스포이트가 있으면 그것을 쓰고, **Take colours from an image**는 이 기기의 스크린샷이나 사진을 읽어요.
- **Add는 절대 비활성화되지 않아요.** 입력란이 비어 있으면 선택기를 열고, 읽을 수 없는 텍스트는 입력란 아래에 그렇다고 알려줘요.

첫 색상이 **기본 색상**이 되고, *"Primary is now Vivid Violet"* 같은 칩이 이를 확인해 주며 색상을 조정하는 **Fine-tune**이 있어요.


### 팔레트가 자라면서

색상은 넓은 화면에서 **In context** 미리보기 옆에, 작은 화면에서는 위에 놓여요. 미리보기는 팔레트로 만든 포스터, 차트, 인터페이스 카드를 보여줘요. 스타터 색상은 자체 접이식 그룹에 남아 있다가 시스템에 자체 색상이 생기면 접히고, 붙여넣기 및 놓기 영역은 컴팩트한 한 줄이 돼요. 내보내기는 바의 **Export**와 Tokens 룸에 있어서, 룸의 머리말에는 없어요.

![Lolly Demo의 Colours 룸: 접이식 그룹의 팔레트, 이름과 헥스가 있는 각 색상, 머리말에 있는 팔레트 다운로드](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Lolly Demo의 Colours 룸에서 색상 하나를 추가한 뒤: Colour roles 표, 그다음 Use as Lead?와 Fine-tune을 제안하는 새 색상의 칩, 그 옆에 실시간 구성 미리보기](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### 색상 역할: 색상의 이름

디자인 시스템은 색상이 무엇으로 불리고 각각 무엇을 위한 것인지 알려주고, Lolly가 그것을 읽어요. **Colour roles**는 Colours 룸 맨 위에 있어요. 넓은 화면에서는 **In context**가 화면을 함께 쓰므로, 변경하는 대로 포스터, 차트, 인터페이스 카드에 바로 보여요.

![Wefthouse(가상의 텍스타일 브랜드)의 Colour roles 표를 디자인 시스템 자신의 단어로 본 모습: 컬러웨이 칩 Indigo, Madder, Weld, 그다음 Main, Accent, Supporting, Tertiary가 각각 라이트와 다크 색상과 함께 있고, 각각 대표 색상, 파트너 색상, 이름으로만 읽히며, 표 아래에 어떤 역할도 채우지 않는 읽는 방식으로 Background, Text, Quiet text, Hairlines가 나열돼 있어요](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

표에는 열이 네 개 있고, 휴대폰에서는 각 행이 라이트와 다크를 나란히 보여주는 카드가 돼요:

| 열 | 담는 내용 |
|---|---|
| **역할** | 직접 고쳐 쓸 수 있는 디자인 시스템 자신의 단어와, 그 색상이 무엇을 위한 것인지 알려주는 한 줄 |
| **라이트**와 **다크** | 선택한 컬러웨이에서 그 모습의 색상, 이름이나 값, 대비 |
| **Lolly가 읽는 방식** | 도구가 그 역할로 하는 일을 Lolly 자신의 말로 설명한 것 |

**Lolly가 역할을 읽는 방식.** 읽는 방식 하나는 역할 하나에만 붙어요. 다른 역할이 가진 읽는 방식을 고르면 그 방식이 여기로 옮겨 와요. Lolly는 단어에서 의미를 읽지 않아요.

| 읽는 방식 | 그에 따른 결과 |
|---|---|
| **대표 색상** | 큰 모양, 버튼, 도구가 앞세우는 색상 |
| **파트너 색상** | 도구가 두 번째로 찾는 색상 |
| **배경** | 다른 모든 것의 뒤에 놓여요 |
| **텍스트** | 제목과 본문 텍스트 |
| **보조 텍스트** | 캡션과 작은 글씨 |
| **헤어라인** | 규칙선, 테두리, 구분선 |
| **이름으로만** | 어떤 도구도 이 역할을 스스로 고르지 않아요. 모든 색상 필드와 Design에서 선택지로 나오며, 그곳에서 고른 색은 연결된 채로 남아 컬러웨이를 따라가요 |

어떤 역할도 채우지 않는 읽는 방식은 디자인 시스템이 정의한 그대로 남고, 룸이 표 아래에 그 목록을 보여줘요. Primary라는 역할처럼 읽는 방식과 같은 id를 가진 역할은 그 읽는 방식 자체이며 옮길 수 없어요.

**차트에서.** Lolly Chart의 **Design system - colour roles first** 팔레트는 디자인 시스템의 색상 역할을 그 순서대로 시리즈에 주고, 그다음에 팔레트의 나머지를 써요. 배경, 텍스트, 보조 텍스트, 헤어라인으로 읽히는 역할은 빠져요. 차트가 바탕과 글자를 그 색상으로 그리기 때문이에요. 그 팔레트를 고르기 전에는 아무것도 바뀌지 않고, 색상 역할이 없는 디자인 시스템은 팔레트를 **Design system - ordered**로 그려요.

**값.** 값을 눌러 그 역할의, 그 모습의, 선택한 컬러웨이의 색상을 고르세요. **라이트와 같음**은 직접 색상을 고를 때까지 다크 값이 라이트 값을 따르게 해요. **Aa** 칩은 Lolly가 그 색상 위에 놓을 텍스트를 보여주고, 값 아래 줄은 그 텍스트가 모습별로 어떻게 읽히는지 알려줘요: **텍스트가 잘 읽혀요**, **큰 텍스트만** 또는 **텍스트로 읽기 어려워요**. 이는 색상 위의 텍스트에 대한 것이며 색상 자체를 나쁘게 말하는 것이 아니에요. 그 색상은 도형과 넓은 면에는 여전히 쓸 수 있어요. 이름으로만 읽히는 역할은 도구가 그 위에 텍스트를 스스로 놓지 않으므로 경고 색 없이 같은 문구를 보여줘요. 문구 뒤의 수치는 APCA가 먼저, WCAG가 그다음이며, 툴팁과 선택기에 있어요. **자체 텍스트 색상**은 파일이 텍스트 색상을 명시한 값을 표시하며, 그 값은 유지돼요. **복사했어요**는 다른 컬러웨이나 파트너 색상에서 온 값으로 아직 아무도 고르지 않은 값을 표시하며, 선택기의 **이 색상 유지**가 값을 확정해요.

**시작점.** 자체 역할이 없는 디자인 시스템은 지금의 단어를 보여줘요: Primary, Secondary, Surface, Text. 하나를 바꾸기 전에는 아무것도 기록되지 않아요. **+ 역할 추가**는 **Primary, Secondary** 또는 **Main, Accent, Supporting, Tertiary**를 제안으로 보여주고, 직접 입력한 단어도 받으며, 각각이 얻을 읽는 방식을 함께 보여줘요. 처음 두 단어가 대표 색상과 파트너 색상이 돼요. 도구는 같은 색상으로 계속 그리고, 대표 색상이 하나인 시스템에서는 첫 컬러웨이가 그 색상의 이름을 따라요.

**이름 바꾸기, 순서 바꾸기, 제거.** 이름을 바꾸면 단어만 바뀌므로 그 역할을 쓰는 모든 것이 계속 작동해요. 핸들로 역할을 끌거나, 핸들에서 Space를 누르고 화살표 키로 옮긴 뒤 Space로 놓으세요. **Remove**는 그 역할을 아직 무엇이 쓰는지 알려줘요. 도구가 읽고 있으면 **제거하고 그 색상은 유지**가 각 읽는 방식에 지금 그려지는 색상을 남겨요. 하우스 규칙, 가이드 그룹, 도구 필드, 그 역할을 쓰는 다른 토큰은 그 사용이 바뀔 때까지 역할을 붙들어요. 저장된 Design 문서도 이름으로 역할을 쓸 수 있는데 Lolly는 토큰 파일에서 이를 볼 수 없으므로, 그런 문서는 그 색상을 확인되지 않은 것으로 보고해요.

**직접 쓴 파일.** 토큰 파일에 있지만 어떤 역할도 선언하지 않은 색상은 **이 파일에 있지만 아직 역할이 없어요** 아래에 나열되며, 각각 단어를 적는 필드와 **역할 만들기**가 있어요. 어느 쪽이든 이름으로 계속 작동해요. 이름에 숫자가 들어간 토큰은 역할이 될 수 없으므로 파일에 남아 경로로 계속 작동해요. 파일의 기록이 유효하지 않으면 컨트롤 없이 표만 보여주고 이유를 알려줘요.

**룸의 나머지도 같은 단어를 써요.** 칩, 견본의 **Use as** 행, 팔레트의 **Colour roles** 그룹이 모두 디자인 시스템의 단어를 쓰고, 색상 역할의 타일은 누르면 그 값이 열려요. 내보낸 파일에는 역할에 대한 새 기록이 없어요. 렌더의 색상이 바뀌는 것은 토큰이 바뀌었기 때문이에요.

**단어가 가는 곳.** 단어와 설명은 디자인 시스템과 함께 이동해요. 에이전트는 디자인 브리프, `lolly://tokens`, 브랜드 페이지의 `AGENTS.md`에서 읽고, 터미널은 `lolly system status`에서 보여주며, 브랜드 페이지는 `brand.json`에 나열하고 역할마다 대비 쌍 하나를 측정해요. 각 내보내기 형식은 담을 수 있는 만큼 유지해요. DTCG와 Tokens Studio 파일은 모든 것을, `DESIGN.md`는 단어와 읽는 방식을, PowerPoint 테마는 브랜드의 순서만 유지해요. [다른 형식의 색상 역할](/info/design-tokens.html#colour-roles-in-other-formats)에 전체 목록이 있어요. 단어는 항상 디자인 시스템의 데이터로 인용되며, 지시로 읽히지 않아요.

**색상을 고르는 곳.** 도구와 Lolly Design의 모든 색상 필드는 디자인 시스템의 역할을 자체 순서대로 맨 앞에 놓고, 각 단어와 그 색상이 무엇을 위한 것인지를 함께 보여줘요. 역할 옆의 **Aa**는 그 역할 위에 놓을 색상을 골라요. 나머지는 **다른 색상** 아래에 이어지며, 컬러웨이 자체의 사본, 온 컬러, 역할이 이미 채운 읽는 방식은 제외돼요. 고른 색은 역할에 연결된 채로 컬러웨이를 따라가고, 필드는 어떤 컬러웨이를 골라도 그 단어를 계속 보여주며, Settings와 Tokens도 그 단어를 써요. 역할이 없는 디자인 시스템은 늘 있던 견본 격자를 그대로 유지해요.

### 도구가 읽는 모든 색상

**Colour roles**를 닫으면 첫 결정들이 룸 맨 위에 칩으로 나오며, 각 칩은 그 역할을 맡은 색상과 이름을 보여줘요. 자체 단어가 없는 시스템에서는 **Primary**, **Secondary**, **Surface**, **Text**예요. 칩을 누르면 팔레트의 견본에서 색상을 고를 수 있어요. **도구가 읽는 모든 색상**은 **Colour roles** 맨 아래에 있으며 전체 띠가 있어요.

띠는 도구가 읽을 수 있는 일곱 가지 색상을 보여줘요. Primary, Secondary, Surface, Text, Muted, Edge, On primary이며, 디자인 시스템에 자체 단어가 있으면 그 단어로 나와요. 각 색상은 모든 도구와 내보내기에서 같은 부분을 맡아요. 어느 것도 꼭 설정할 필요는 없어요(느슨한 색상 세 개로도 좋은 시스템이 돼요). 어떤 색상이든 하나를 채울 수 있고, 판독값은 텍스트가 표면 위에서 어떻게 읽히는지 APCA를 먼저 써서 알려줘요. 각 행은 완전한 강도의 자체 색상, 대신 서 있는 스타터 색상, 또는 **↳ follows Primary**를 보여줘요.

On primary는 primary에서 파생되며 **파생됨**으로 표시되고 선택기가 없어요. 그 옆의 **라이트**와 **다크** 스위치, 그리고 **In context** 옆의 스위치가 띠, 팔레트, 미리보기가 보여줄 모습을 정해요.

앱 자체의 강조색은 기본적으로 디자인 시스템을 따라요. **Settings → Appearance**의 **Interface follows the design system** 설정이에요. 이 설정을 끄면 앱 크롬은 중립으로 남고, 도구, 캔버스, 내보내기는 어느 쪽이든 디자인 시스템을 따라요.

**컬러웨이.** 디자인 시스템은 작품마다 선택되는 대표 색상을 여럿 가질 수 있어요. **Colour roles** 맨 위의 **Colourways** 행은 컬러웨이마다 칩 하나를 보여주고, 표준 컬러웨이에는 **기본값** 표시가 붙어요. **+ 추가**는 팔레트의 색상 하나에서 새 컬러웨이를 시작해요. 칩을 고르면 표, 띠, 팔레트, 미리보기가 그 컬러웨이를 보여주며, 고른 컬러웨이는 이름을 바꾸고, 복제하고, 기본값으로 만들고, 제거할 수 있어요. 컬러웨이가 있는 시스템에서는 모든 컬러웨이에 자체 primary와 secondary가 필요하고, 컬러웨이가 배경에 색조를 입히면 자체 surface도 필요하므로 그 역할은 견본 편집기에 설정된 채로 남아요. [디자인 시스템에 컬러웨이 추가하기](/info/colourways.html#add-colourways-to-a-design-system)에 단계와 토큰 형식이 있고, [Lolly Demo 사용하기](/info/lolly-demo-in-use.html#colourways-on-real-work)가 실제 작업의 컬러웨이를 보여줘요.

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

팔레트는 색상을 접이식 그룹으로 나열하며 각각 자체 **+ 추가**가 있어요. 그룹은 원하는 대로 만들고 이름을 바꾸세요. 역할은 두 번째 타일을 만들지 않아요. 역할이 가리키는 타일에는 대신 **Primary** 같은 역할의 이름이 붙어요. 타일 아래 **Colour chart**는 같은 색상을 OKLCH **Wheel**(점을 끌어 색을 바꾸고, 빈 곳을 클릭해 견본을 추가)과 표시 가능한 범위가 끝나는 곳을 보여주는 **Gamut** 차트로 보여줘요. `#/start?area=color&focus=chart`가 차트를 바로 열어요.

![팔레트 패널, 모든 그룹을 접고 펼 수 있으며, 머리말에 팔레트 다운로드가 있음](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![OKLCH 휠 - 각도는 색상, 바깥쪽 거리는 채도이며 회색은 옆쪽의 명도 레일을 따라 배치됨](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

견본을 클릭하면 편집기가 열려요.

- 견본의 **이름 바꾸기**.
- OKLCH 슬라이더나 **Hex**, **HSL**, **RGB**, **CMYK**로 **색상 설정**. 값 필드는 활성 공간에서 읽고 써요. 여기서 CMYK는 변환으로 화면 색상을 정해요. 정확한 잉크를 고정하려면 **Print substitutes**를 쓰세요.
- **Stored as**는 견본을 저장하는 방식을 고르며, **LCH**(기본값, 지각 기반이고 넓은 색역), Hex, RGB, HSL이에요.
- **Use as**는 견본에 역할을 직접 주며, 디자인 시스템에 자체 단어가 있으면 그 단어를 써요. 강조된 역할을 다시 누르면 역할이 해제돼요.
- **Print substitutes**(접힘): **CMYK**를 **Auto**에서 정확한 잉크 값으로 고정하거나, **Name**(예: `PANTONE 186 C`), 선택 사항인 **Book**, 박, 엠보스, 디보스, 부분 코팅, 소프트 터치, 또는 다이컷, 접지선, 미싱선을 위한 **Finish**가 있는 **Spot colour**를 설정해요. 인쇄소는 CMYK PDF나 TIFF를 내보낼 때 이 고정값을 써요. [색상 프로필](/info/exporting.html#colour-profiles)을 참고하세요.
- **In other spaces**(접힘): 색 공간별 값으로, 파생되거나 직접 지정할 수 있으며 직접 지정한 값이 내보낼 때 우선해요.

**견본 삭제**는 안전해요. 파생된 음영과 테마 역할은 숨겨지므로 그것을 읽는 어떤 것도 깨지지 않고, 추가한 색상은 제거돼요.

::: details 견본이 많을 때 작업하기
각 견본에는 끌기 핸들이 있어요. 끌어서 그룹 안의 순서를 바꾸거나, 핸들에 포커스를 두고 Space를 누르고 화살표 키를 쓴 뒤 Space를 다시 눌러 놓아요. Escape는 취소해요. 휴대폰에서는 팔레트가 한 줄에 색상 네 개를 보여주고, 핸들은 모든 색상 아래 줄로 나오는 대신 Select 모드에서 나타나요. 그룹 간에 색상을 옮기려면 편집기의 **Group** 컨트롤을 쓰거나 여러 개를 선택해 **Move to**를 쓰세요.

선택에는 별도 스위치가 필요 없어요. 바와 체크박스는 첫 번째 선택된 타일과 함께 나타나고 마지막 타일과 함께 사라져요.

- **빈 공간에서 끌어** 사각형을 그리면 닿는 모든 타일이 그룹을 가로질러 선택에 합류해요. 접힌 섹션은 아무것도 더하지 않아요.
- **Shift 클릭**은 읽는 순서로 범위를 잡고, **Cmd/Ctrl 클릭**은 타일 하나를 토글하며, 일반 클릭은 편집기를 열어요.
- 각 그룹 헤더에 **Select all**이 있고, 타일에 포커스를 둔 **Cmd-A**는 스타터 색상이 아닌 사용자가 가진 모든 색상을 선택해요.
- 격자의 탭 정지 지점은 하나예요. 화살표는 이동, Shift-화살표는 확장, Space는 토글, Delete는 제거, Escape는 선택 해제예요. 채널을 조금 움직이려면 먼저 `l`, `c`, `h`를 누르세요.
- 터치 화면에서는 타일을 길게 눌러 선택을 시작하고 탭해서 추가해요.

막대에는 **{n} selected**가 표시되고, 이어서 **Move to**, **Give a role**(각 색상이 차례로 다음 역할을 받음), **Download**(여섯 가지 팔레트 형식 중 하나로 선택 항목), **Duplicate**(각각의 사본이 원본 뒤에 놓임), **Copy values**, **Delete**가 있어요. 사본 하나는 편집기에서 바로 열리고, 여러 개는 선택된 채로 남아요. Cmd/Ctrl-Z 한 번이 대량 작업 전체를 실행 취소해요.
:::

### 그라디언트

선택 사항인 **Gradients** 패널은 팔레트에서 블렌드 토큰을 만들어요. 각 그라디언트에는 미리보기, 이름 붙은 정지점 2~8개, 각도가 있어요. 정지점은 견본을 가리키므로 견본의 색을 바꾸면 그라디언트가 따라와요. 블렌드는 OKLCH로 실행돼요.

팔레트 다운로드(디자인 토큰, CSS, SCSS, GIMP, Adobe Swatch Exchange)는 팔레트의 머리말, 제목 옆에 있어요. [팔레트와 글꼴을 어디서나 가져가기](/info/using.html#take-your-palette-and-fonts-anywhere)가 각 형식을 설명해요.

## 타입

자체 서체가 없으면 룸은 카드 하나예요. **Primary**가 현재 제공하는 서체의 읽기 크기로 표시되고, **Starter** 태그, **Choose for Primary** 버튼, *"Nothing installs until you choose one."* 문구가 있어요. Headings, code, italic은 직접 고르기 전까지 기본을 따르며, **Choose them separately**가 각 카드를 보여줘요.

![아직 서체를 선택하지 않은 Type 룸 - 읽기 좋은 크기의 카드 하나, 그 위의 Starter 태그, 그리고 채워진 Choose for Primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

서체 하나를 고르면 룸이 역할 카드 네 개, Fonts 목록, 실시간 견본으로 열려요.

- **Primary**: 본문, 버튼, 모든 도구.
- **Headings**: `h1`과 `h2`용 디스플레이 서체.
- **Code**: 코드와 데이터용 고정폭 서체.
- **Italic**: 강조, 인용, 부연용 진짜 이탤릭.

카드는 그 서체를 설치한 곳에만 색조가 입혀져요. 버튼은 어느 역할용인지 말해줘요. 사용자 자신의 서체에서는 **Change Headings**, 그 외에는 **Choose for Headings**라고 표시돼요. 샘플 줄은 잘리지 않고 줄바꿈돼요. 카드의 어떤 것도 확정하지 않아요. 버튼은 그 역할의 비교 스테이지를 열어요.

![드러난 네 개의 역할 카드 - 각각 담당하는 서체로 설정되며, 아무도 선택하지 않은 곳에는 Starter 태그가 붙고 Italic은 기본 서체를 따름](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### 비교 스테이지

스테이지는 누른 카드 아래의 룸 안에서 열리고, 카드는 한 줄 띠로 접히므로 휴대폰의 첫 화면에도 스테이지가 보여요. Escape는 취소하고 카드로 포커스를 돌려요.

1. 카드에서 **Choose for**와 역할을 누르세요.
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
- **타일**은 토큰 종류별로 개수를 세고 해당 섹션으로 이동해요. Colours, Type, Logos, Shape and spacing, More, All tokens예요. 각 섹션이 담은 것을 세어요. 빈 스타터에서 온 것만 담은 섹션에는 **Starter** 태그가 붙고, 앱과 함께 온 시스템은 태그 없이 자기 자료를 세어요. 휴대폰에서는 타일이 세 개씩 두 줄로 줄바꿈돼요.
- **Colours**는 도구가 함께 놓는 쌍(표면 위의 텍스트, 기본 색상 위, 표면 위의 흐린 텍스트)에 밝고 어두운 모습의 APCA 수치를 보여주는 것으로 시작하고, 쌍이 기준에 못 미치면 **Weak contrast**를 표시해요. 그다음 모든 색상 그룹이 이어져요. 램프는 칩 한 줄로, 다른 색상은 값과 `{color.brand.spearmint}` 같은 도구가 쓰는 참조와 함께 보여줘요. 참조를 누르면 참조가 복사돼요. **Edit in Colours**는 Colours 룸에서 그룹을 열어요. [색상 역할](#colour-roles-what-the-colours-are-called)이 있는 디자인 시스템에서는 **Colour roles**가 맨 위에 오고, 각 역할이 시스템 자체의 표현과 순서대로 한 번씩 나와요. 역할은 컬러웨이와 룩마다 색상을 가지며, 그 색상은 독립된 색상으로 나타나지 않고 역할에 속해요. Colour roles 표에서 바꾸세요.
- **Type**과 **Logos**는 각 역할과 각 로고 슬롯의 서체를 나열하며, 직접 가진 것이 생기면 **Edit in Type**과 **Edit in Logos**가 나타나요.
- **Shape and spacing**에는 **Rounded corners**(`shape.radius`)와 **Spacing rhythm**(`space.base`)이 있어요. 각각 슬라이더를 움직이기 전에는 *Lolly default*, 후에는 *Yours*로 표시되고, 즉시 저장되며 실행 취소할 수 있어요.
- **More tokens**는 간격, 크기, 선 두께, 불투명도, 회전, 일반 숫자, 그림자를 표준 [디자인 토큰](/info/design-tokens.html)으로 저장해 추가해요.
- **App appearance (advanced)**는 Lolly 자체 화면이 쓰는 색상, 크기, 그림자를 나열하고, **Inspect every token (advanced)**는 저장된 모든 값을 검색하고 편집하며 변경을 먼저 검토하도록 보여줘요. 거기서는 색상 역할의 값이 컬러웨이별로 역할과 함께 나열돼요. 역할의 토큰을 고르면 컬러웨이마다 한 줄씩, 라이트와 다크를 나란히 볼 수 있고, 개수 줄은 역할이 가진 값이 몇 개인지 알려줘요. 읽기 전용 디자인 시스템도 같은 목록을 보여줘요.

비어 있는 섹션은 빈틈을 채우는 방법을 제안해요. **Pick a colour**, **Choose a face**, **Add a logo**예요.

## 파일

로고 외에 브랜드가 보관하는 파일을 놓으세요. **vector**, **image**, **audio**, **motion** 파일(동영상, Lottie, 애니메이션)이에요. 이들은 [Assets](/info/using.html#assets-your-library)에 섹션별로 정렬되어 나타나고 모든 도구의 에셋 선택기에서 준비되며, 이 기기에 남아요.

## Rules

**Rules**는 브랜드의 선택을 실제로 작동하게 해요. 사람들이 바꿀 수 있는 것, 고정된 것, Lolly가 확인할 수 있는 것을 정해요.

![Lolly Demo의 Rules: 하우스 규칙 네 개, 각각 Checked in Design과 Required 또는 Advisory로 표시되고, 그다음 렌더할 예시가 준비된 Try your design system in use](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules**는 규칙을 나열해요. **Add rule**(또는 **Add your first rule**)이 짧은 양식을 열어요.

- 직접 쓴 말로 된 **Rule name**, 예: *Beacon accents*
- **Check**: **Colour choices**, **Font choices**, **Fixed artwork** 또는 **Text length**. 사용하는 브랜드 역할이 있으면 역할에 붙인 자체 이름으로 표시돼요.
- 규칙이 적용되는 **Example**(Poster, Title slide, Content slide 또는 Lolly Chart), **Mode**, 그리고 **Required**인지 **Advisory**인지
- **Reviewed by**, 그다음 **Save draft** 또는 **Approve & save**

승인은 이 기기에 사용자 자신의 결정을 기록해요. 승인된 필수 규칙은 재사용 가능한 포스터를 제약하며, 검사는 예시 PNG에만 적용되고 다른 도구는 바꾸지 않아요.

디자인 시스템이 토큰 파일에 담아 오는 규칙, 예를 들어 승인된 색상 조합, 텍스트 굵기와 정렬, 표면별 로고는 여기에 **Checked in Design**으로 나열돼요. Lolly Design은 내보내기 패널의 **Before you export** 카드에서 레이어별로 이를 검사하고, `lolly check`는 저장된 Lolly Design 문서에 같은 검사를 해요([Before you export](/info/design.html#before-you-export)). 이 빌드에 검사기가 없는 규칙은 받은 그대로 보관되고 **Unchecked**로 표시돼요.

Lolly Demo에는 승인된 하우스 규칙 네 개가 있어요. 헤드라인은 절대 대문자로 쓰지 않아요. 이 규칙은 필수이므로 `lolly check`가 대문자 헤드라인을 오류로 보고해요. 나머지 세 개는 권고예요. 본문 텍스트는 왼쪽 정렬이에요. 기본 마크는 밝은 표면에, 반전 마크는 어두운 표면에 놓아요. 점선은 여기에 놓으라는 뜻이에요.

**Try your design system in use**는 **Render & check examples**로 현재 리비전의 예시 네 개를 렌더해요. **Mode**를 고르고, 제목, 보조 텍스트, 슬라이드 텍스트에 **Try your own text**를 쓰세요. 각 예시는 측정한 내용을 **See checks & sources**와 **Download check report**와 함께 보고하고, **Make reusable poster**는 고정된 레이아웃과 승인된 입력 선택이 파일과 함께 이동하는 `.lolly`를 내려받아요. 예시는 로컬이며, 검사를 실행한다고 해서 게시되거나 승인되는 것은 없어요.

고정된 브랜드와 함께 제공되는 빌드는 같은 규칙과 예시를 *This brand is set* 아래에 읽기 전용으로 보여줘요.

## Skills

**Skills**는 활성 디자인 시스템의 [브랜드 스킬](/info/brand-skills.html)을 나열해요. 사람과 AI 에이전트를 위해 분야마다 하나씩 쓰인 브랜드의 문서화된 기준이에요. 각 행에는 분야, 브랜드 자체의 상태(**초안** 또는 **승인됨**), 스킬이 공개인지 내부용인지, 개정본이 나와요. 행을 고르면 스킬을 적용 범위 옆에서 읽을 수 있어요. 적용 범위는 스킬의 문장을 토큰과 맞대어 Lolly가 확인하는 것, 충돌하는 것, 일치하는 것, 안내일 뿐인 것을 보여줘요.

**스킬 다운로드 (.zip)**는 스킬을 에이전트 도구용 Agent Skills 폴더로 쓰고 카탈로그 링크는 이 Lolly를 가리키게 해요. **파일 하나로 복사**는 같은 텍스트를 채팅 창에 붙여넣을 수 있게 클립보드에 넣어요. 자체 스킬이 없는 디자인 시스템에는 Lolly가 토큰과 하우스 규칙에서 기준 스킬을 만들어 나열하며, 기준 스킬을 읽을 때마다 새로 써요. 이 룸은 스킬을 읽기만 하고 편집하지 않아요.

## 브랜드 가져오기

바의 **Add from…**은 형식이 아니라 가진 것이 무엇인지를 묻는 선택기를 열어요:

- **Design tokens or a design file**: DTCG 또는 Tokens Studio JSON, Penpot 프로젝트, 토큰 세트 zip, Lolly 디자인 시스템 팩, SVG, `DESIGN.md` 또는 브랜드 페이지 폴더.
- **PDF**: 덱이나 가이드라인 파일로, 이 기기에서 색상, 마크, 포함된 서체를 읽어요.
- **Logo or screenshot**: 이미지가 추천 팔레트가 되며, 이 기기에서 읽어요. 색상을 읽을 뿐 서체나 레이아웃은 읽지 않아요.
- **Saved web page**: HTML 파일 하나와 CSS 파일들, 또는 붙여넣은 HTML이나 CSS로, 파일 20개와 2MB까지예요. 직접 제공한 텍스트만 읽어요. 연결된 리소스는 가져오지 않고 스크립트는 실행하지 않아요.
- **Font file**: TTF, OTF 또는 WOFF. 서체가 설치되는 Type 룸이 열려요.
- **Website**: 페이지 하나로, 색상과 서체를 읽어요. 이 타일은 페이지를 읽을 수 있는 기기에서만 나타나고, 어떤 리더를 쓰는지 알려줘요: 이 기기의 앱, 또는 로그인한 채로 백그라운드 탭에서 도는 브라우저 확장이에요. URL을 적는 것은 입력란을 채울 뿐이고, 가져오기를 누르는 것이 동의예요.

디자인 파일 소스를 고르면 다음 카드가 허용되는 형식을 아이콘 타일로 나열하고, 카드 전체가 하나의 드롭 대상이에요. 스튜디오에 파일을 바로 놓을 수도 있어요.

![가져오기 카드 - 지원되는 형식이 아이콘 타일로 앞에 배치되며, 카드 전체가 하나의 드롭 대상임](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- **Lolly design-system pack**(`.lolly` 또는 예전 `.zip`)은 한 번에 설치돼요.
- **Penpot** 내보내기(`.penpot`)는 디자인 토큰을 가져와요.
- **Design Tokens**(W3C DTCG) 또는 **Tokens Studio** 파일(`.json`)은 토큰을 가져와요. 읽는 쪽에 지시를 무시하라고 하거나, 권한이 있다고 주장하거나, 코드를 실행하라고 요구하는 설명은 제외되고, 가져오기가 그것이 있던 위치를 알려줘요. 이것은 줄 단위 검사라서 다른 표현은 놓치므로, 모르는 사람의 파일은 토큰을 적용하기 전에 직접 읽어 보세요.
- **일반 SVG**는 고를 수 있는 색상을 스캔하며, 첫 번째 색상이 기본 색상이 돼요.
- **`DESIGN.md`**(`.md`)는 토큰이 쓰인 그대로 **Try these colours**로 가요. 글은 초안 브랜드 스킬로 보관할 수 있고, 카드가 읽는 쪽에 지시를 무시하라고 하거나, 권한이 있다고 주장하거나, 코드를 실행하라고 요구하는 줄을 표시해요. 에이전트와 브랜드 페이지는 Skills 룸에서 **Keep this skill**을 누르기 전까지 초안을 볼 수 없고, 보관한 스킬은 내부용으로 남아요.
- **브랜드 페이지 폴더**는 폴더로 고르거나, 놓거나, zip으로 묶어 같은 검토로 가요. 모든 파일을 폴더의 `brand.json`과 대조하며, 맞지 않는 파일이 하나라도 있으면 폴더 전체를 거부해요. 토큰을 추가하고, 로고와 글꼴은 폴더에 남아요.

Lolly는 직접 제공한 파일에서 브랜드 페이지를 읽어요. 다른 사이트의 주소를 가져오지는 않아요.

### 자체 색상 단어가 있는 파일

토큰 파일이나 `DESIGN.md`는 main, accent, supporting, tertiary처럼 색상에 자체 단어를 쓸 수 있어요. Lolly가 그런 단어를 발견하면 무엇이든 적용하기 전에 검토 화면이 각각을 나열해요: 단어, 각 모습의 색상, 그것이 나온 토큰, Lolly가 그것을 무엇으로 읽을지. Lolly는 모델 없이 단어만 보고 짧은 목록과 대조해서 그 읽는 방식을 제안해요. 목록에 없는 단어는 브랜드 자신의 것으로 들어오며 **이름으로만**이에요. 어떤 단어든 이름을 바꾸고, 무엇을 위한 것인지 적고, 다른 방식으로 읽게 하거나, 체크를 해제해 이름 붙은 색상으로 남겨 둘 수 있어요.

**이 역할로 설치**는 그 역할을 기록하고, **역할 없이 설치**는 파일을 받은 그대로 설치해요. 그런 단어가 없는 파일에는 새 단계가 보이지 않아요. Lolly가 쓴 파일처럼 자체 역할을 명시하는 파일은 그것을 쓰인 그대로 보여주고 바꾸지 않고 설치하며, 이후 Colours 룸에서 편집할 수 있어요. 터미널에는 검토가 없으므로 `lolly system import`는 명시된 기록은 유지하고 다른 파일의 단어는 이름 붙은 색상으로 남겨요.

### 레퍼런스 검토

로고, 스크린샷, 웹사이트, 저장된 페이지는 **Try these colours**를 열어요. 제안된 색상으로 만든 예시, 바꿀 수 있는 **Main colour**, 새 시스템의 이름이에요. 상자가 적용 시 일어나는 일을 설명해요. 활성 토큰 설정을 생성된 팔레트와 기본 스타일로 **교체**하고, 글꼴과 라이브러리 파일은 **유지**하며, 이전 시스템을 **복구**할 수 있어요. **Apply suggested settings**는 체크포인트 후에 밝고 어두운 팔레트를 적용하고, **Restore brand settings**는 이전 설정을 되돌릴 수 있어요. **Change reference**는 다른 소스를 골라요.

**Palette, source details and individual choices**는 읽은 내용, 발견된 글꼴 이름, 미리보기의 대비를 보여줘요. 글꼴 이름은 제안일 뿐이며 서체를 설치하는 곳은 여전히 Type이에요. 소스 세부 정보에는 관찰된 경우 타이포그래피, 간격, 패딩, 모서리 값이 포함될 수 있으며, 그렇지 않으면 **Not observed**로 표시돼요. 저장된 페이지나 네이티브 웹사이트 읽기는 페이지가 쓰지 않을 수도 있는 선언된 스타일을 보고하고, 브라우저 확장 프로그램은 보이는 요소 표본에서 측정된 스타일을 보고할 수 있어요. 이들은 관찰이며 설치되는 것은 없고 소스의 간격이 사용자 자신의 것을 대체하지 않아요. **Choose individual items in the tray**는 개별 항목을 유지하고, **Download design context**는 관찰, 제안된 토큰, 소스 정보(제공된 HTML이나 CSS의 SHA-256 포함)의 JSON 보고서를 저장해요. 보고서에는 원본 페이지 텍스트가 없고 서명된 Content Credential이 아니에요.

PDF와 디자인 파일 가져오기는 자체 검토 컨트롤을 유지해요. **Tray**의 항목은 그 종류의 자료를 소유한 룸에서 추가하기 전까지 아무것도 바꾸지 않아요. `#/start?source=<kind>`는 소스(`file`, `pdf`, `image`, `font`, `url`, `page`)의 선택기를 열고, `?import`는 일반 목록을 열어요.

### 룩 찾기와 비교

Board 또는 Settings의 디자인 시스템 목록에서 **Find a look**을 여세요. 이 기기에 저장된 시스템과 재사용 가능한 Lolly 예시 몇 개를 둘러보고, 이름, 색상 태그, 선언된 글꼴로 검색해요. **Closest to my current palette**는 측정된 색상 유사도로 정렬하며 일치하는 글꼴이 동점을 가르고, 품질 점수가 아니에요.

스타일을 클릭하면 맥락 속에서 미리 볼 수 있어요. 미리 보기는 아무것도 바꾸지 않아요. 각 카드의 **이 스타일 사용**이 그 스타일을 사용해요. 저장된 시스템은 활성 시스템이 되며 아무것도 편집하지 않아요. 예시의 색상은 평소의 체크포인트를 거쳐 열려 있는 디자인 시스템에 들어가고, 예시가 정의하지 않는 로고, 글꼴 등 나머지는 그대로 남아요. **스타일 비교**는 각 카드에 체크박스를 더해 두 개를 골라 나란히 비교할 수 있게 해요. **브랜드 설정 복원**은 이전 스타일을 되살려요. 저장된 시스템에는 **세부 정보와 디자인 맥락** 아래에 편집 가능한 **태그 검색**이 있어요. 예시는 Lolly 고유의 색상 레시피이며, 긁어 온 컬렉션도 계정도 없어요.

![어느 색상 시스템도 적용하기 전에 Sunroom과 Orchard를 나란히 비교하기.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

## 디자인 시스템 보관과 이동

### 기기 간 브랜드 이동

**Export**는 토큰, 글꼴, 로고, 테마 환경설정과 다시 가져올 때 확인되는 무결성 매니페스트가 담긴 **`LollyBrand-….lolly`** 파일 하나를 써요. 1.0.7 이전의 웹 릴리스는 같은 파일을 `.zip`이라고 이름 붙였으며 그 표기도 계속 받아요. **Tokens (.json)**은 글꼴이나 로고 없이 저장소, 빌드 단계, 다른 토큰 도구를 위한 일반 디자인 토큰 문서만 단독으로 써요.

되돌리려면 **Add from… → Design tokens or a design file**을 쓰거나 스튜디오에 파일을 놓으세요. 동료가 브랜드를 건네거나 두 번째 설치로 가져가는 방법이며 계정도 클라우드도 필요 없어요. [파트너와 함께 일하기](/info/partners.html)는 브랜드를 받는 사람이 다른 조직에서 일할 때 무엇을 더 보내야 하는지 다뤄요. 명령줄에서 브랜드를 가져오려면 [`ingest:brand`](/info/configuration.html#brand-packs)를 참고하세요.

**Fonts for Linux (.rpm)**은 추가한 글꼴을 설치 가능한 RPM으로 패키징해요. 직접 업로드한 글꼴이 있으면 Lolly가 먼저 재배포해도 되는지 확인을 요청해요.

### 이전 설정 복원

바에서 **More**를 열고 **Restore brand settings**를 선택하고 날짜가 있는 체크포인트를 골라 **Restore**를 누르세요. 활성 브랜드의 색상, 서체 설정, 다른 토큰을 복원하고 글꼴과 이미지 파일은 그대로예요. Lolly가 먼저 현재 설정을 **Before restore**로 저장하므로 브라우저를 닫은 뒤에도 복원을 되돌릴 수 있어요. 최근 체크포인트 20개가 이 기기에 보관돼요.

### 버전

게시된 버전은 이 기기에 보관되는 **영구적이고 이름 붙은 사본**이에요. 바뀌지 않으므로 이를 고정한 도구나 링크(`designv`로)는 계속 같은 것을 그려요. 사용자 자신의 것이 있는 시스템은 바의 **More** 메뉴에 **Versions & publishing**이 나열되고, 첫 게시 후에는 **Versions**가 룸에 더해져요. `#/start?area=versions`가 바로 열어요.

- **버전은 영구적이에요.** 아직 삭제 기능이 없으며 패널이 그렇게 알려줘요.
- **제거 항목이 호환성 카드의 맨 앞에 와요.** 제거된 토큰이 도구를 깨뜨리기 때문이에요.
- **게시는 되돌릴 수 없지만 복원은 가능해요.** *Restore latest from this version*은 일반 편집이며 **Undo**가 바로 제공돼요.

**Publish only**는 도구가 따르는 것을 바꾸지 않고 버전을 보관하고, **Publish and make active**는 도구와 앱이 그 버전을 따르게 해요. **Follow the latest again**은 편집하는 즉시 모든 편집이 적용되게 해요.

### 브랜드 페이지 게시

[브랜드 페이지](/info/brand-page.html)는 사람과 에이전트를 위한 하나의 주소예요. 로고, 색상, 서체, 예시를 보여주는 페이지이고, 같은 사실이 페이지 옆 파일에도 담겨 있어요. Versions & publishing 아래의 **Publish a brand page**는 실시간 페이지를 보여주고, 페이지 옆에 다음을 보여줘요:

- **공개됨**: 모든 파일을 묶어서, 크기와 함께.
- **제외됨**: 빠진 것과 그 이유. 기록된 라이선스가 없는 로고는 로고 이름에 체크할 때까지 빠져 있어요. 글꼴 파일은 전달을 허용하는 기록된 라이선스가 필요하며, 파일이 빠지면 페이지는 윤곽선 처리한 견본을 보여줘요. 내부 브랜드 스킬은 절대 나타나지 않아요.
- **확인한 내용**: 컬러웨이와 모드별 색상 쌍, 그리고 하우스 규칙. 이것은 측정값이지 판정이 아니에요.
- **내가 쓴 설명**: 사용 설명과 연락처. 페이지는 쓴 내용을 그대로 인쇄하고, Lolly는 라이선스나 법적 주장을 덧붙이지 않아요. 스위치 하나로 푸터의 "Made with Lolly" 줄을 끌 수 있어요.
- **내보내기에서**: [페이지 주소를 이 디자인 시스템의 내보내기에 기록하는](/info/brand-page.html#lead-back-from-your-files) 스위치. 켜기 전에는 꺼져 있고, `https` 주소가 필요하며, 팩이나 사본과 함께 이동하지 않아요. 잠긴 디자인 시스템에는 관리자가 정하므로 스위치가 보이지 않아요.

**Download folder**는 원하는 곳에 호스팅할 수 있도록 폴더를 ZIP으로 저장하며, 직접 올리기 전에는 아무것도 공개되지 않아요. 터미널에서는 `lolly system publish --out=<dir>`이 같은 폴더를 써요. 브랜드 페이지를 서비스하는 인스턴스는 그 주소로 **Publish to**도 제공하는데, 명시적으로 한 번 누르는 동작이며 승인 절차가 있으면 그 절차를 거쳐요. 관리되는 디자인 시스템은 관리자가 허용할 때만 게시돼요.

### 에이전트 연결

같은 곳의 **Connect an agent**는 붙여넣을 텍스트를 주고 각 옵션이 무엇을 할 수 있는지 알려줘요:

- 프로젝트의 **`AGENTS.md`**: 에이전트가 시스템의 이름과 규칙을 읽어요. 아무것도 그리지 않고 서버도 필요 없어요.
- **Lolly의 공개 서버**: 여기서 어떤 시스템을 열어 두었든 Lolly Demo로 그려요. 키가 필요 없어요.
- **내 인스턴스**: 인스턴스가 보유한 시스템으로 그리고, 환경 변수에서 서비스 토큰을 읽어요. 시트는 변수의 이름을 알려주며 토큰은 절대 보여주지 않아요.

호스팅된 서버 중 내 시스템으로 그리는 서버가 없으면, 시트가 그렇다고 알려줘요.

## 디자인 시스템 관리

**Settings → Preferences → Design systems**를 열어 시스템을 전환, 추가 또는 제거하세요. **Open**은 시스템을 선택해 여기서 열고, **Make a new one**은 로컬 시스템을 만들어 이름 입력란이 준비된 채로 열어요. 기기 전체에서 한 번에 하나의 시스템이 활성이에요. [브랜드 아키텍처](/info/brand-architectures.html)는 브랜드에 자체 디자인 시스템이 필요한 시점을 판단하도록 도와요.

**시스템의 출처.** 배포의 카탈로그가 제공하는 시스템은 **Came with this app**으로, 인스턴스에 연결된 앱에서는 **From this instance**로 표시돼요. **Catalogue source**를 펼치면 제공자, 토큰 에셋과 네임스페이스, 알려진 버전이나 체크섬이 보이고, 새로 고침에 실패하면 캐시된 자료에 라벨이 붙어요.

**관리되는 시스템은 읽기 전용이에요.** 카탈로그가 시스템을 잠그면 시스템에 **Managed by this instance**(인스턴스가 없는 데스크톱 앱에서는 **Managed by this app**)가 표시돼요. 사용하고 내려받을 수 있으며, 여기서 열면 **Make an editable copy**와 **Switch**가 있는 읽기 전용 안내가 나온 뒤 편집 컨트롤 없이 색상 역할과 토큰을 보여줘요. 관리되는 시스템이 먼저 있었더라도 내 로컬 시스템은 계속 편집할 수 있어요. 고정된 브랜드 하나만 있는 빌드는 Lolly Design System Setup을 *This brand is set*으로 열고, 브랜드의 토큰과 사용 규칙을 읽을 수 있게 해요.

**제공된 다른 모든 시스템은 사용자의 것이라** 숨기고, 편집하고, 초기화할 수 있어요. lolly.tools의 Lolly Demo와 Lolly Starter도 포함돼요. 편집하면 이름이 유지되고 행에 **Edited here**가 표시되며, 메뉴의 **Reset to original**이 이 기기에서 한 변경을 버려요. 빈 스타터는 예외로, 거기서의 첫 변경이 사용자 자신의 디자인 시스템을 시작하므로 Lolly가 새 시스템의 이름을 한 번 물어요. [Lolly Demo 사용하기](/info/lolly-demo-in-use.html#switch-to-your-own)가 사용자의 시스템이 대체하는 것을 보여줘요.

### 디자인 시스템 제거

시스템의 메뉴에서 **Remove**를 선택하세요. 확인 창이 이후 어떤 시스템이 활성이 될지 알려줘요. 저장된 세션, 업로드, 다른 시스템과 공유하는 자료는 남아요.

제공된 시스템을 제거하면 숨겨질 뿐이며 카탈로그 에셋은 남고, **Bring back**이 다시 보여주며, 다른 것을 모두 제거하면 저절로 돌아와요. 가져오거나 편집한 사본을 제거해도 제공된 시스템, 그 로고, 글꼴은 제거되지 않으며, 사본이 활성이었다면 제공된 시스템이 다시 활성이 돼요. 활성인 호스팅 사본을 제거하면 그 사본의 연결만 지워지고 따로 고른 인스턴스는 선택된 채로 남아요.

서버가 제공하는 내용을 바꾸는 것은 관리자의 일이에요. 운영자가 소스 카탈로그를 바꾸고 다시 배포하거나, Lolly Work 관리자가 서버 변경을 검토하고 적용해요. 여기서의 편집은 로컬에 남아요. 예외가 하나 있어요. `brand.edit`을 부여한 Lolly Work 인스턴스에서는 관리되는 시스템이 그 인스턴스용 **Edit for**도 제공해서 편집용 사본을 열고, **Versions**의 그 인스턴스로 **Send to**가 색상, 컬러웨이, 색상 역할, 브랜드 페이지 주소를 되돌려 보내요. [스튜디오에서 이 인스턴스 편집하기](/info/work-design-system-administration.html#edit-this-instance-from-the-studio)가 편집으로 바꿀 수 있는 것과 인스턴스가 그 변경을 서비스하는 방식을 다뤄요. [카탈로그 디자인 시스템 제거](/info/configuration.html#removing-a-catalogue-design-system)와 [구성](/info/configuration.html#supplied-and-local-design-systems)도 참고하세요.

## 앱 밖에서 디자인 컨텍스트 사용

**디자인 맥락 다운로드**는 토큰 문서, 확정된 색상, 선언된 글꼴 패밀리, 애셋 id, 기록된 경우 소스 증거, 범위, 명시적 규칙을 저장하며, 글꼴 파일도 소유 증명도 없어요. 명령줄은 서버 없이 그 파일을 읽어요. `lolly system import`는 그것을 터미널의 디자인 시스템으로 만들고 `lolly system check`는 Lolly Design 입력을 저장된 맥락과 대조해요. [내 디자인 시스템 가져오기](/info/cli.html#bring-your-design-system)가 가져오기를, [명령이 쓰는 디자인 시스템](/info/cli-decks.html#which-design-system-a-command-uses)이 검사를 다루고, MCP 클라이언트는 `lolly://design-context`에서 같은 브리프를 읽어요([MCP Server](/info/mcp.html)).

## 다음으로 갈 곳

- **[Using Lolly](/info/using.html)**: 도구, 저장, 공유, Assets.
- **[브랜드 아키텍처](/info/brand-architectures.html)**: 사업부, 제품, 보증 브랜드, 클라이언트, 시즌이 디자인 시스템, 컬러웨이, 로고 신원에 어떻게 대응하는지.
- **[파트너와 함께 일하기](/info/partners.html)**: 파트너와 브랜드를 공유하는 방법, 그리고 받은 브랜드 안에서 일하는 방법.
- **[브랜드 페이지](/info/brand-page.html)**: 디자인 시스템을 하나의 주소에 게시해 보도 자료 키트이자 에이전트 키트로 쓰기.
- **[Design Tokens](/info/design-tokens.html)**: 브랜드가 쓰이는 토큰 모델.
- **[Export a file](/info/exporting.html)**: 인쇄 단위, CMYK, 브랜드가 렌더되는 형식.
