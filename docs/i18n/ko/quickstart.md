# 빠른 시작

Lolly는 여러분의 규칙 - 색상, 서체, 레이아웃, 로직 - 을 누구나 쓸 수 있는 도구로 바꿔 줘요. 몇 개의 항목만 채우면 이미지, PDF, 소셜 카드, 영상 같은 완성된 파일이 나와요. 배울 것은 거의 없고 업로드할 것도 없어요. 만들기와 내보내기는 온라인이든 오프라인이든 여러분의 기기에서 실행돼요.

이 페이지를 가장 먼저 읽어 보세요. 두 가지만 하면 바로 쓸 수 있어요. **Lolly를 내 것으로 만들기**, 그리고 **이미 가진 것 가져오기**(디자인 파일과 토큰)예요. 나머지는 모두 링크 하나로 이어져요.

> Lolly가 처음이라 일단 뭔가 만들어 보고 싶으세요? [60초 만에 무언가 만들기](/info/make-something.html)에서 세 가지를 따라 해 볼 수 있고, 아니면 [앱 열기](/#/)로 갤러리에서 아무 도구나 골라 빈칸을 채우고 **Export**를 누르면 돼요. *여러분의* 브랜드를 입히고 싶어지면 이 페이지로 돌아오세요.

![Utilities 화면 - Strip Hidden Data, Compress PDF, Convert Image 같은 온디바이스 일꾼들을 한곳에 모아 둔 곳](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## 1. 내 것으로 만들기 - 디자인 시스템 설정하기

Lolly에서 여러분의 브랜드는 작은 **디자인 토큰** 문서예요 - 색상, 폰트, 그리고 몇 가지 규칙이죠 - 모든 도구가 이 문서를 기준으로 렌더링해요. 한 번만 정해 두면 만드는 모든 것이 검수가 아니라 구조상 브랜드에 맞아요. 들어가는 방법은 세 가지예요. 여러분의 브랜드가 이미 어디에 있는지에 맞춰 고르세요.

### 처음부터 시작하기 (디자인 시스템 빌더)

처음 실행하면 **갤러리**가 열리고, 그 위에 짧은 환영 대화상자가 세 가지 시작 방법을 안내해요 - **Make it yours**(`#/start`의 Brand Studio), **Bring your design**(Figma, Penpot, InDesign, PDF 파일을 끌어다 놓으면 편집 가능한 레이아웃으로 열려요 - 아래 [이미 가진 것 가져오기](#2-bring-in-what-you-already-have)로 가는 가장 빠른 길이에요), 그리고 **Explore the community tools**예요. 영어가 모국어가 아니라면 언어 목록도 함께 나와요. 첫 번째 카드를 고르면 [**Brand Studio**](/info/brand-studio.html)로 이동해요. 이름과 기본 색상만 정하면 Lolly가 거기에서 완전하고 접근성 있는 팔레트를 *도출*해요 - 밝은/어두운 표면, 텍스트, 강조색까지 - 엔진이 다른 곳에서도 쓰는 것과 같은 색상 계산으로요.

![Brand Studio의 Colours 룸 - 기본 색상, 그리고 Lolly가 거기에서 도출한 접근성 팔레트](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours) 폰트를 고르면 1분도 안 되어 쓸 수 있는 브랜드가 완성돼요. 그다음부터는 스튜디오의 여섯 개 룸 - Overview, Colours, Type, Logos, Tokens, Files - 에서 원하는 만큼, 원하는 순서로 다듬을 수 있고, 다시 돌아올 때마다 언제든 고칠 수 있어요. 대시보드의 **Design system** 탭(`#/d`)은 그 결과를 읽기 전용으로 보여 주고, 편집이 이뤄지는 `#/start`를 가리켜요(브랜드가 고정된 brand-locked 빌드를 쓰고 있다면 브랜드는 잠겨 있어 바꿀 것이 없어요).

### 이미 가진 브랜드 가져오기

브랜드가 이미 디자인 토큰으로 정리돼 있다면 - **Penpot**, **Tokens Studio**(Figma), 또는 평범한 **DTCG** 파일이든 - 다시 입력하지 말고 통째로 가져오세요. 두 가지 경로가 있어요:

- <!--i:palette--> **앱에서:** [디자인 시스템 빌더: Brand Studio](/info/brand-studio.html)(`#/start`)에서는 룸 레일 아래쪽의 **Add from…** 으로 가져와요 - 토큰 파일, Penpot 내보내기, SVG, 또는 `LollyBrand` 팩을요. 끌어다 놓으면 팔레트가 살아나요.
- <!--i:code--> **명령줄에서**, 다시 쓸 수 있는 브랜드 팩을 만들려면:

```bash
# a monolithic tokens.json, a one-file-per-set directory, or a Penpot project archive
npm run ingest:brand -- ./my-tokens.json --name acme --label "Acme" --activate
```

`ingest:brand`는 Penpot / Tokens Studio가 같은 문서를 내보낼 때 쓰는 세 가지 컨테이너를 모두 받아요 - 단일 `tokens.json`, 디렉터리(`$metadata.json` + 세트별 파일), 또는 `project.penpot` 아카이브요. `--activate`를 쓰면 브랜드를 프로필로 등록하고 그 프로필로 전환한 뒤 카탈로그를 다시 빌드해요. 브랜드 팩과 프로필이 어떻게 맞물리는지는 [설정](/info/configuration.html)을 참고하세요.

### 앱에서 다듬기

브랜드를 활성화한 뒤에도 [**Brand Studio**](/info/brand-studio.html)(`#/start`)에서 계속 다듬을 수 있어요 - 색상이나 역할을 바꾸면 앱 전체의 미리보기가 입력하는 대로 갱신돼요. (`#/d`의 대시보드 **Design system** 탭은 브랜드를 읽기 전용으로 *보여 줄* 뿐이고, 편집은 Studio에서 해요.)

![대시보드의 Design system 탭 - 활성 브랜드를 읽기 전용으로 보여 줘요](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand) 같은 브랜드가 **Profile → Your brand** 카드에도 요약돼 있어요. 폰트는 실제 파일이에요. Google Fonts에서 고르면 Lolly가 그 파일을 브랜드 자산으로 **여러분의 기기에** 저장하니, 타이포그래피가 오프라인에서도 그대로 따라오고 렌더링 시점에 아무것도 내려받지 않아요.

마음에 들면 **브랜드를 `LollyBrand` 팩으로 내보내세요** - 동료가 가져오기만 하면 똑같은 팔레트, 폰트, 규칙을 그대로 얻는 단일 파일이에요. 브랜드가 중간에 서버 없이 사람과 기기 사이를 오가는 방식이에요.

> **브랜드 토큰은 양방향으로 오가요.** Lolly의 브랜드 *자체가* DTCG 토큰 - Penpot이 기본으로 읽고 쓰며 Tokens Studio가 Figma로 가져오는 그 형식 - 이기 때문에, 디자인할 때 *쓰는* 팔레트와 Lolly가 *강제하는* 팔레트는 손으로 맞춰야 하는 두 개의 목록이 아니라 하나의 문서예요. [디자인 토큰](/info/design-tokens.html)을 참고하세요.

## 2. 이미 가진 것 가져오기

빈 페이지에서 시작하지 않아요. Lolly는 여러분이 이미 가진 디자인 작업물과 열린 형식을 그대로 열어요.

### 오픈소스 디자인 파일

**Figma, Penpot, Illustrator, InDesign, 또는 SVG를 다루는 어떤 앱**에서 끝낸 작업물이 그 앱 안에만 갇혀 있을 이유는 없어요. **Design**을 열고 **Import a design**을 누르면 파일이 납작한 그림이 아니라 *살아 있는 레이아웃*으로 열려요. 모든 레이어가 편집 가능한 상자가 돼요. 텍스트는 다시 입력할 수 있고, 도형은 도형으로 남고, 이미지는 라이브러리에 들어가고, 복잡한 벡터 아트도 충실하게 보존돼요. 게다가 여러분의 브랜드 서체와 색상 규칙에 이미 맞춰진 상태로 도착해요.

| 가지고 있는 것 | 가져오는 방법 |
|---|---|
| Figma 프레임 | 네이티브 `.fig`(File → Save local copy) 또는 SVG 내보내기 |
| Penpot 디자인 | `.penpot` 내보내기 또는 아무 SVG |
| Illustrator 파일 | 네이티브 `.ai`(PDF 호환) 또는 `.pdf` - 바로 열려요 |
| InDesign 레이아웃 | `.idml`(File → Export → InDesign Markup) |
| 그 밖의 모든 것 | **어떤 SVG든** - 어디서나 통하는 입구예요 |

가져오기는 전부 **여러분의 기기에서** 이뤄져요 - 파일은 브라우저 안에서 해석되고 아무것도 업로드되지 않아요. 자세한 내용과 무엇이 그대로 넘어오는지는 [디자인 가져오기](/info/design-import.html)에 있어요.

**PowerPoint 덱**이 있으신가요? `.pptx`를 **Deck Builder**에 끌어다 놓으면 이미 브랜드에 맞춰진 상태로 슬라이드를 하나씩 편집할 수 있고, **Rebrand a Deck**을 돌리면 차트와 애니메이션이 그대로인 채 테마만 바뀐 같은 덱을 돌려받아요.

### 한 번 쓰고 마는 작업물에서 템플릿으로

여기서부터가 진짜예요. 가져온 레이아웃은 평범한 Design 세션이라, 한 번 **저장**하면 URL로 남아요. Lolly를 쓰는 누구나 그 URL을 열어 문구를 바꾸고 이미지를 갈아 끼워 자기 버전을 렌더링할 수 있어요 - 디자인 앱 없이, 잠긴 부분은 잠긴 채로요. 한 번 쓰고 말 디자인이 다시 쓸 수 있는 도구가 되는 거예요. 설정을 한 줄도 쓰지 않고 여기에 도달해요.

### 열린 데이터와 열린 도구

[커뮤니티 도구 모음](/info/builders.html)은 오픈소스이고 브랜드에 얽매이지 않아요 - QR 코드, 거리 지도, 필터, 프라이버시 유틸리티요 - 그리고 브랜드를 활성화하는 순간부터 *여러분의* 브랜드로 렌더링돼요.

도구에 여러분의 열린 데이터도 넣어 보세요. **CSV**나 **JSON** 표를 붙여 넣거나 끌어다 놓으면 도구의 반복 항목이 그 값으로 채워지고, 행마다 완성된 자산이 하나씩 나와요.

## 3. 만들고, 공유하거나 자동화하기

브랜드를 활성화하고 재료도 갖췄다면, 모든 도구가 완성된 파일을 내놓아요:

- <!--i:download--> **렌더링하세요.** 어떤 도구든 **SVG, PDF, PNG, JPG, WebP, 영상** 등으로 내보낼 수 있어요 - 필요하면 실제 인쇄 크기와 물리 단위로도요. [내보내기 & 형식](/info/exporting.html)을 참고하세요.
- <!--i:link--> **링크로 공유하세요.** 모든 도구 상태가 URL이라, 완성된 자산은 재현할 수 있고 매개변수로 지정할 수 있어요 - 링크를 커밋해 두고 필요할 때 다시 만들면 돼요.
- <!--i:layers--> **한꺼번에 처리하세요.** [배치 그리드](/info/exporting.html)에서 스프레드시트로 템플릿을 돌리면 행마다 완성된 자산이 하나씩 나와요.
- <!--i:cpu--> **자동화하세요.** 같은 렌더링이 [CLI](/info/cli.html)에서도, [AI 에이전트](/info/ai-agents.html)에서도 돌아가요 - URL이 곧 API예요.

"URL이 곧 API"라는 말은 그대로예요. 아래 차트는 누구도 그린 적이 없어요. 차트 종류도, 제목도, 데이터 표 전체도 주소창에 입력한 것이고, 같은 링크는 어떤 기기에서든 같은 차트를 그려 내요.

![월별 가입자 수를 나타내는 영역 차트로, 모든 값이 클릭이 아니라 쿼리 매개변수로 전달됐어요](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## 다음으로 갈 곳

여기 온 목적에 따라 세 갈래 길이 있어요:

- <!--i:people--> **[크리에이터를 위한 Lolly](/info/creators.html)** - 무언가를 만드는 분들을 위해서요. 어떤 점이 좋은지, 앱을 어떻게 최대한 활용하는지 다뤄요.
- <!--i:code--> **[빌더를 위한 Lolly](/info/builders.html)** - 도구를 만들고, 통합하고, 배포하는 분들을 위해서요. 기술 문서예요.
- <!--i:shieldcheck--> **[운영자를 위한 Lolly](/info/operators.html)** - 조직 전체의 브랜드, 보안, 도입을 책임지는 분들을 위해서요.
