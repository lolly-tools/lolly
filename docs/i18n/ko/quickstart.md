# 시작하기

이 페이지를 마치면 도구가 사용자의 색상과 글꼴을 입게 되고, 이미 가진 작업물은 재사용할 준비가 돼요. 계정이 필요 없고, 만들기와 내보내기는 기기에서 실행돼요.

::: timeline
- <!--i:sparkle--> **파일 하나 만들기.** [첫 파일 만들기](/info/make-something.html)에서 몇 분 만에 QR 코드를 만들어 봐요.
- <!--i:palette--> **브랜드 넣기.** 색상 하나, 토큰 파일, 완성된 디자인 중 무엇으로든 시작해요.
- <!--i:layers--> **같은 것을 더 많이 만들기.** 링크를 공유하거나, 스프레드시트를 채우거나, 스크립트로 도구를 실행해요.
:::

아이디어 자체가 처음이라면 [Lolly란?](/info/what-is-lolly.html)이 5분짜리 소개이고, [Lolly의 작동 방식](/info/how-lolly-works.html)에서 누가 무엇을 하는지 볼 수 있어요.

## 브랜드 넣기

lolly.tools는 Lolly 자체의 샘플 디자인 시스템인 **Lolly Demo**로 열려요. [Lolly Demo 만나보기](/info/lolly-demo.html)에서 지금 보는 것이 무엇인지 알려줘요. 사용자의 디자인 시스템이 이를 대체해요. 색상, 글꼴, 몇 가지 규칙으로 이루어진 작은 디자인 토큰 세트로, 모든 도구가 이를 바탕으로 그려요. 한 번 설정하면 만드는 모든 것이 브랜드에 맞게 시작돼요.

가진 것에 맞는 방법을 고르세요.

- <!--i:palette--> **색상 하나.** **Design System Setup**(`#/start`)을 열고 디자인 시스템 이름을 지은 뒤 기본 색상을 골라요. Lolly가 거기서 밝은 면과 어두운 면, 텍스트, 강조색을 갖춘 접근성 높은 팔레트 전체를 만들어요. 글꼴을 고르면 쓸 수 있는 브랜드가 완성돼요.
- <!--i:upload--> **토큰 파일.** Design System Setup의 룸 레일 하단에 있는 **Add from…**은 DTCG, Tokens Studio, Penpot 토큰 파일, SVG, `LollyBrand` 팩을 받아요. 놓으면 팔레트가 채워져요. 디자인 시스템이 아직 비어 있는 동안에는 Overview 룸의 **Start from a reference**가 같은 선택기를 열어요.
- <!--i:pentool--> **완성된 디자인.** Design에서 **Import a design**을 선택하고 `.fig`, `.penpot`, `.ai`, `.idml` 또는 SVG 파일을 놓아요. 아래 [이미 가진 것 가져오기](#bring-in-what-you-already-have)를 참고하세요.

갤러리를 처음 열면 짧은 환영 화면이 같은 선택지를 제공해요. **Make it yours**는 Design System Setup을 열고, **Bring your design**은 디자인용 파일 선택기를 열고, **Explore the community tools**는 환영 화면을 닫아요.

![새로 설치한 상태의 Design System Setup의 Colours 룸: 실시간 칩 하나, 입력란 하나, 첫 결정의 전부](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

거기서부터 일곱 개의 룸이 원하는 만큼, 어떤 순서로든 이어져요. **Overview**, **Colours**, **Type**, **Logos**, **Tokens**, **Files**, **Usage & rules**예요. 앱의 모든 미리보기는 입력하는 대로 업데이트돼요. [Design System Setup](/info/brand-studio.html)에서 각 룸을 다뤄요.

글꼴은 기기에 보관돼요. Google Font를 고르면 Lolly가 파일을 브랜드 에셋으로 저장하므로, 글꼴이 오프라인에서도 따라다니고 도구가 그릴 때 아무것도 가져오지 않아요.

### 디자인 시스템 보기, 전환, 공유

- **활성 디자인 시스템 보기.** **Settings → Design system**은 활성 디자인 시스템을 표지와 페이지로 읽기 전용으로 보여줘요.
- **디자인 시스템 간 전환.** **Settings → Preferences → Design systems**는 이 기기의 모든 디자인 시스템을 나열해요. 한 조직이 디자인 시스템 여러 개를, 또는 컬러웨이가 여러 개인 디자인 시스템 하나를 운영할 수 있어요. [브랜드 아키텍처](/info/brand-architectures.html)에서 구성 방식을 정리해요.
- **디자인 시스템 공유.** 디자인 시스템을 `LollyBrand` 팩으로 내보내요. 동료가 파일 하나를 가져오면 같은 팔레트, 글꼴, 규칙을 얻어요.

빌드나 조직이 제공하는 디자인 시스템은 **관리형**이에요. 잠금이 표시되고 읽기 전용으로 유지돼요. 변경하려면 **Settings → Preferences → Design systems**에서 편집 가능한 사본을 만드세요.

![Settings의 Design system 탭: 활성 디자인 시스템을 표지와 페이지로 보여줘요](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

디자인 시스템은 Penpot이 읽고 쓰며 Tokens Studio가 Figma에 들여오는 형식인 DTCG 토큰이므로, 디자인할 때 쓰는 팔레트와 Lolly가 적용하는 팔레트는 하나의 문서예요. [디자인 토큰](/info/design-tokens.html)에서 자세히 설명해요.

::: details 개발자용: 명령줄로 브랜드 팩 만들기
체크아웃에서 재사용 가능한 브랜드 팩을 세우려면 `ingest:brand`가 Penpot과 Tokens Studio가 내보내는 세 가지 컨테이너를 받아요. 단일 `tokens.json`, `$metadata.json`이 있는 세트별 파일 디렉터리, 또는 `project.penpot` 아카이브예요.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate`는 브랜드를 프로필로 등록하고 카탈로그를 빌드하고 검증해요. 기본 프로필은 절대 바꾸지 않아요. 새 팩을 쓰려면 `LOLLY_PROFILE=acme`로 실행하세요. [구성](/info/configuration.html)에서 브랜드 팩과 프로필이 어떻게 맞물리는지 설명해요.
:::

## 이미 가진 것 가져오기

빈 페이지에서 시작하지 않아도 돼요.

**디자인 파일.** Figma, Penpot, Illustrator, InDesign 또는 모든 SVG 앱의 완성된 작업물이 Design에서 살아 있는 레이아웃으로 열려요. 텍스트는 다시 입력할 수 있고, 도형은 도형으로 유지되며, 이미지는 라이브러리에 들어가요. 파일은 브라우저에서 읽으며 아무것도 업로드되지 않아요. [디자인 가져오기](/info/design-import.html)에서 각 형식과 가져오는 내용을 나열해요.

**덱.** PowerPoint `.pptx`를 Lolly에 놓아 슬라이드를 에셋으로 보관하거나, **Markdown Slides**에서 Markdown으로 새 덱을 쓰거나, [덱 리브랜드](/info/rebrand.html)로 덱 전체를 디자인 시스템으로 옮기세요.

**데이터.** CSV나 JSON 표를 붙여넣거나 놓으면 도구의 반복 필드가 그것으로 채워지고, [Batch](/info/batch.html#make-many-versions-of-one-design)는 행마다 완성된 파일 하나를 만들어요.

### 한 번 쓰고 마는 작업물에서 템플릿으로

가져온 레이아웃은 일반 Design 세션이에요. **Share with rules**는 이를 도구로 바꿔요. 다른 사람이 바꿔도 되는 부분을 사용자가 정하고, 그들은 그 부분만 채워요.

![Design 마스터를 유지하고, 작성용 사본에서 입력과 제한을 고른 뒤, 받는 사람이 채우는 재사용 가능한 .lolly 도구로 공유해요](/info/diagrams/concepts/share-with-rules.svg)

[규칙과 함께 디자인 공유하기](/info/create-a-tool.html)에서 각 단계를 안내해요.

## 많이 만들고, 공유하고, 자동화하기

- <!--i:download--> **내보내기.** 도구는 SVG, PDF, PNG, JPG, WebP, 동영상 등을 각 도구가 제공하는 형식으로, 필요하면 실제 인쇄 크기로 만들어요. [파일 내보내기](/info/exporting.html)를 참고하세요.
- <!--i:link--> **링크 공유.** 도구의 설정이 링크에 담겨 이동하므로, 링크는 어디서든 같은 파일을 다시 열어요.
- <!--i:layers--> **행마다 하나씩 만들기.** [Batch](/info/batch.html#make-many-versions-of-one-design)에서 스프레드시트로 도구를 구동해요.
- <!--i:cpu--> **자동화.** 같은 렌더링이 [CLI](/info/cli.html)와 [AI 에이전트](/info/ai-agents.html)에서도 실행돼요.

링크는 완전한 요청이에요. 아래 차트는 아무도 그리지 않았어요. 유형, 제목, 데이터 표 전체를 주소창에 입력했을 뿐이고, 같은 링크는 어느 기기에서든 같은 차트를 그려요.

![월별 가입자 수를 나타내는 영역 차트로, 모든 값이 클릭이 아니라 쿼리 매개변수로 전달됐어요](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## 다음으로 갈 곳

- <!--i:people--> **[만들기](/info/creators.html)**: 제작, 애니메이션, 녹화, 공유, 내보내기.
- <!--i:code--> **[자동화](/info/builders.html)**: 디자인 시스템, 도구 제작, 명령줄, 링크, 에이전트.
- <!--i:usercheck--> **[관리](/info/operators.html)**: Lolly Work로 팀을 위해 Lolly 운영하기.
- <!--i:server--> **[배포](/info/operate.html)**: Lolly와 Lolly Work 호스팅하기.
- <!--i:shieldcheck--> **[신뢰](/info/trust.html)**: 개인정보, 보안, 파일 직접 확인하기.
