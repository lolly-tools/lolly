# 개요

![Lolly 아이콘 - 초록색과 흰색의 커다란 막대사탕](/info/icon.svg)

이 문서는 Lolly 플랫폼의 목적, 구조, 아키텍처 결정을 담고 있습니다. 제품 비전과 코드베이스의 현재 상태를 모두 반영합니다.

> **상태:** Lolly는 **아직 완료되지 않은 비공개 파일럿** 단계의 내부 프로토타입입니다. 엔진은 결정적이고 내부적으로 일관되지만 제품은 아직 초기 단계입니다 - SUSE가 첫 번째 고객입니다 - 그리고 암호화 및 파일 파싱 엔진은 현재 SUSE의 엄격한 인프라 강화 과정을 거치며 엔터프라이즈 규모를 준비하고 있습니다(이 분야는 저희가 정말 잘합니다). 아래 아키텍처는 완성되고 인증된 제품이 아니라 검증 중인 설계 의도로 읽어 주세요. 파일럿이 어떻게 운영되고 측정되는지는 [도입과 거버넌스](/info/adoption-governance.html#status)를 참고하세요.

> **이 페이지를 읽는 방법.** 이 페이지는 두 종류의 내용을 순서대로 담고 있습니다. 앞부분은
> **왜 이것이 존재하는가**입니다: 문제, 포지셔닝, 하나의 에셋이 거치는 라이프사이클을 다룹니다.
> [큰 그림](#the-big-picture-how-the-layers-fit)부터는
> **레이어가 어떻게 맞물리는가**입니다: 기여자를 위한 아키텍처 문서로, 엔진/셸/팩
> 분리, 저장소 구조, 배포 대상, 그리고 플랫폼에 대한 모든 변경을 제약하는 약속을 다룹니다. 제품을 이해하기보다
> 코드베이스를 변경하러 왔다면 큰 그림부터 시작하세요.
>
> 이 페이지보다 더 깊이 들어가는 두 개의 동반 문서가 있습니다. 저장소 안의 [`engine/README.md`](../engine/README.md)는
> 엔진을 모듈 단위로 정리한 지도로, 각 모듈이 무엇을 파싱하거나 쓰는지 생성된 표로 보여줍니다. [위협 모델과 신뢰 경계](/info/threat-model.html)는
> 같은 아키텍처를 신뢰 경계 관점에서 읽은 문서로, 엔진이 무엇을 신뢰할 수 없는 것으로 취급하는지에 대한 질문이라면 이 페이지가
> 적합합니다.

---

## 이것이 존재하는 이유

팀들은 반복되는 문제를 마주합니다: 매번 숙련된 인력을 투입할 만큼 예측 불가능하지는 않지만, 가드레일 없이 넘기기에는 품질에 너무 민감한 반복적인 크리에이티브·콘텐츠 작업입니다. 그 결과는 느린 처리량(전문가 병목), 일관성 부족(각자 손에 있는 도구를 쓰는 것) 또는 벤더 종속(템플릿을 좌지우지하는 SaaS DAM) 중 하나로 나타납니다.

이 플랫폼은 그에 대한 직접적인 답입니다:

> **대규모 프로그래매틱 크리에이티브와 콘텐츠** - 직원, 벤더, 파트너를 위해 규칙은 중앙에서 통제하면서 인력 투입 없이 에셋을 생성합니다.

Lolly는 디자인 시스템이 만들어지는 곳이 아니라 그것이 제작되는 곳이에요. 디자인용 자판기라고 생각해 보세요: 선택하면 결과물이 나와요. 매번요. 엔진은 눈앞의 하드웨어에서 각 형식이 낼 수 있는 최고 품질을 목표로 동작하고, 같은 엔진이 배포되는 모든 환경에서 같은 파일을 만들어요.

그 결과는 **풍요**입니다: 모든 행사에 올바른 사이니지가 준비되고, 모든 CVE 경고가 하우스 스타일을 따르고, 모든 라벨이 깔끔하게 인쇄되고, 모든 이메일 서명이 최신 상태를 유지합니다 - 디자인 요청 없이도요. 이 플랫폼은 반복되는 운영형 크리에이티브를 처리합니다. 맞춤형 크리에이티브 도구가 아니라는 점은 의도된 것입니다 - 플래그십 작업은 여전히 디자이너의 몫입니다.

### 확률적으로 혁신하고, 결정적으로 규모를 키운다

크리에이티브 파이프라인에서 AI를 둘러싼 모든 논쟁은 같은 질문에서 멈춥니다: 이 중 어느 부분이 기계의 일인가? 이는 답이 이미 정해진 오래된 질문입니다. 필경사와 채식사(彩飾師)는 이미 두 도구 사이를 오가며 일했습니다 - 아무것도 확정되지 않아 무엇이든 시도할 수 있었던 러프 스케치와, 확정한다는 바로 그 이유로 위압적이었던 인쇄기입니다. 예술이 일어난 곳은 스케치였습니다. 그것이 누구에게든 닿게 한 것은 인쇄기였습니다. 아무도 이 둘을 혼동하지 않았고, 둘 다 계속 발전했습니다 - 새로운 잉크, 새로운 서체, 새로운 인쇄기 - 각각이 기술과 그것이 섬기는 의도에 발맞춰 나아졌습니다.

Lolly도 같은 선을 긋습니다. 확률적으로 탐색하세요: 모델, 디자이너, 러프한 아이디어, 아무도 계획하지 않은 곳으로 향하는 프롬프트. 그런 다음 결정적으로 규모를 키우세요 - 만 개의 결과물에 도달하는 것은 *도구*이며, 도구는 읽을 수 있는 입력으로부터 매번 같은 방식으로 렌더링됩니다. 탐색은 자유로운 채로 남습니다. 다운스트림의 어떤 것도 그것이 두 번 같은 결과로 떨어지는 데 의존하지 않기 때문입니다. 결과물은 신뢰를 얻습니다. 그것이 추측이 아니기 때문입니다. AI 실험을 예측 가능하고 재현 가능한 결과로 옮기는 일은 새로운 원칙이 아닙니다. 그것은 애초에 인쇄물을 신뢰할 만하게 만들었던 것과 같은 분업입니다.

> 크리에이티브 과정을 신뢰하고, 엄격함으로 규모를 키우세요.

### 대안들과 비교하면

::: figure positioning-comparison
오늘날의 크리에이티브 도구 전반에서 기능 완성도를 조사(2026년 8월 기준). 점수 기준: 0 없음, 25 우회 수준, 50 실제 존재하지만 제한적이거나 부분적, 75 단서가 있지만 강력함, 100 핵심 역량.
:::

그 간극은 명확합니다: 오늘날 출시된 그 어떤 제품도 제약 우선, 오프라인 지원, 낮은 숙련도, 내부적으로 누구나 접근 가능한 결과물을 제공하지 않습니다. Lolly에는 열린 캔버스 - **Design** - 도 있어서 색상, 서체, 에셋이 브랜드 전역 설정을 따르므로 자유로운 배치도 제약 우선 원칙 안에 머뭅니다. Lolly가 **아닌** 것은 제약 없는 디자인 스위트입니다: 디자이너는 맞춤형 플래그십 작업에 계속 Illustrator와 Figma를 사용합니다. 순열 조합은 이 도구로 만들 수 있습니다.

![라이브러리의 모든 도구를 카드 형태로 카테고리별로 묶어, 프로듀서가 하나를 골라 바로 시작할 수 있게 한 화면](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=aud-gallery-landscape)

**이럴 때 사용하세요:** 운영형 크리에이티브 에셋의 신속한 생성 - 행사 타일, 명찰, 서명, CVE 경고, QR 코드, 소셜 카드, 위탁 라벨, 구조화된 보고서.

**이럴 때는 사용하지 마세요:** 맞춤형 히어로 콘텐츠.

---

## 캠페인의 라이프사이클

Lolly가 무엇인지 가장 분명하게 보는 방법은 기능 목록이 아니라, 하나의 에셋이 손에서 손으로 넘어가는 과정을 따라가 보는 것입니다. 현지화된 캠페인 카드 하나가 조직을 거쳐 가는 과정을 살펴보세요:

1. **크리에이티브가 규칙을 정합니다.** 디자이너가 Design 도구에서 기본 템플릿을 만들며 브랜드의 타이포그래피와 색상 변수를 하드코딩합니다. 카드 한 장을 만드는 것이 아니라, 다시는 수작업으로 현지화하지 않아도 되도록 기초 작업을 *단 한 번* 해두는 것입니다.
2. **개발자가 규모를 키웁니다.** 같은 템플릿이 CLI를 통해 야간 파이프라인에 연결되어, 새 차트나 새 언어 버전이 자동으로 생성됩니다 - 디자이너가 파일을 다시 열 필요가 없습니다.
3. **프로듀서는 그냥 사용합니다.** 비행기 안에서 오프라인 상태인 영업 담당자가 같은 도구를 열어 고객 미팅용 자료를 완벽하게 브랜드에 맞춰 생성합니다. 디자인 기술도, 네트워크도, 기다림도 필요 없습니다.

두 번째 단계의 '새 차트'는 바로 이런 렌더링입니다. 데이터 문자열과 몇 가지 매개변수만으로 만들어지며, 디자인 파일을 여는 사람은 아무도 없습니다:

![제목이 있는 누적 영역 차트로, 세 개의 시리즈가 차분한 색상 팔레트로 나뉘어 있고, 축, 범례, 제목 모두 손으로가 아니라 템플릿이 배치했어요](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

요점은 Lolly가 디자이너에게도 좋고 *또* 개발자에게도 좋고 *또* 영업에도 좋다는, 각각 별개로 좋다는 것이 아닙니다. 이것은 **이어달리기**입니다: 크리에이티브의 초기 작업을 개발자가 확장하고, 그것이 다시 프로듀서에게 힘을 실어줍니다. 비행기 안의 비기술직 영업 담당자가 누리는 수고 없는 경험은 오직 디자이너가 세우고 개발자가 배포한 엄격함 덕분에 *가능*한 것입니다.

이것이 힘의 배가입니다. Lolly는 각 역할을 위한 별개의 도구를 모아둔 서랍이 아니라, 모든 역할이 관여하는 하나의 결정적 에셋 라이프사이클이며, 그것을 거쳐 가는 각 손이 앞선 가치를 배가시킵니다.

---

## 승인 한 번, 에셋 만 개

승인이 파일이 아니라 도구에 담겨 있기 때문에([Lolly는 어떻게 다른가](/info/positioning.html) 참고), 규모 확장은 더 이상 검토 문제가 아닙니다. 현지화된 소셜 카드 도구를 한 번 승인하면 스프레드시트로부터 **12개 언어로 1만 개의 에셋**을 생성할 수 있고, 그중 단 하나도 법무나 브랜드 팀의 새로운 컴플라이언스 검토가 필요하지 않습니다. 모두가 나온 템플릿이 이미 승인되었기 때문입니다.

같은 결정적 도구가 세 가지 경로로 그 규모에 도달하며, 모두 동일한 사전 승인된 결과물을 만들어냅니다:

- <!--i:people--> **앱 안에서, 사람이.** `/pro` 배치 그리드: 행을 붙여넣거나 가져오면 행마다 완성된 에셋이 하나씩 나오고, zip으로 다운로드합니다. 디자인 기술도, 요청도, 기다림도 필요 없습니다.
- <!--i:code--> **명령줄에서, 개발자가.** CLI는 *동일한* 엔진과 *동일한* 렌더링 경로를 헤드리스로 실행하므로, 스크립트나 야간 파이프라인에서 도구를 1만 행 전체에 순차적으로 적용할 수 있습니다. 반복문 안의 `lolly <tool> --field=…` 호출 하나가 통합의 전부입니다.
- <!--i:cpu--> **MCP를 통해, 시스템이나 AI 에이전트가.** 같은 도구가 같은 충실도로, 심지어 더 큰 규모로 프로그래밍 방식으로 동작합니다 - 수천 개의 파일이 쏟아져도 기계는 지치지 않으니까요.

![새로 설치한 상태의 Batch 모드 - 도구를 기다리는 빈 행 하나와 함께, 데이터가 들어오기 전부터 전체 스프레드시트 화면과 Render 버튼이 준비되어 있어요](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

디자이너가 한 번 정한 하나의 브랜드 제약 세트, 동일한 사전 승인 결과물로 가는 세 가지 경로 - 그중 기계 경로가 가장 멀리까지 확장됩니다. 파일이 쏟아지는 동안에도 지치지 않기 때문입니다.

---

## 큰 그림: 레이어가 맞물리는 방식

여기서부터는 모두 아키텍처입니다. 다이어그램은 전체 시스템을 한눈에 보여줍니다: 맨 위의 도구는
데이터이고, 가운데의 엔진은 어떤 플랫폼에 대해서도 알지 못하며, 그 아래의 셸들은
하나의 계약을 구현하고, 카탈로그가 콘텐츠를 공급합니다.

```
                ┌─────────────────────────────────────────────┐
                │              Tools (data, not code)         │
                │   tool.json + template.html + hooks.js?     │
                └─────────────────────────────────────────────┘
                                    ▲
                                    │ talks to via Capability Bridge v1
                                    ▼
                ┌─────────────────────────────────────────────┐
                │                  Engine                     │
                │   loader · validator · runtime · template   │
                │   inputs · url-mode                         │
                │   PLATFORM AGNOSTIC. Knows nothing of DOM,  │
                │   filesystem, or You.                       │
                └─────────────────────────────────────────────┘
                                    ▲
                                    │ implements HostV1
                                    ▼
        ┌──────────────┬──────────────┬──────────────┬──────────────┐
        │  Web Shell   │ Tauri Desktop│ Tauri Mobile │  CLI Shell   │
        │   (PWA)      │              │              │              │
        └──────────────┴──────────────┴──────────────┴──────────────┘
                                    ▲
                                    │ fetches from
                                    ▼
                ┌─────────────────────────────────────────────┐
                │              Catalogs                       │
                │   catalog/tools/index.json + tool dirs      │
                │   catalog/assets/index.json + asset files   │
                └─────────────────────────────────────────────┘
```

### 저장소 구조

콘텐츠는 팩 형태로 마운트됩니다: `community/`, `docs/`, 모든 `shells/*`, 두 `services/*`, `brands/suse`는 각각 별도의 저장소이며 이 저장소의 git 서브모듈로 체크아웃됩니다. 상위 저장소는 `engine/`, `schemas/`, `scripts/`, `tests/`, `api/`, `brands/lolly-start/`, `profiles.json`을 소유합니다. 체크아웃 명령과 여러 저장소를 넘나드는 작업 흐름은 [빌드 가이드 » 소스 코드 받기](/info/build-guide.html)를 참고하세요.

```
lolly/
├── engine/           # Platform-agnostic core. Open source (MPL-2.0).
│   └── src/
│       ├── index.ts          # public surface - loader, runtime, template, inputs, url-mode
│       ├── loader.ts         # fetches and validates tool files
│       ├── runtime.ts        # orchestrates the 5-step lifecycle
│       ├── template.ts       # Handlebars hydration + annotateTemplate
│       ├── inputs.ts         # manifest → runtime input model
│       ├── url-mode.ts       # URL ↔ input state round-trip
│       ├── validate.ts       # JSON Schema validation of manifests
│       ├── compose.ts        # resolve nested tool renders (composes)
│       ├── embed.ts          # parse portable lolly.tools embed URLs
│       └── bridge/
│           └── host-v1.ts    # type re-export of the @lolly-tools/core contract
│
├── shells/
│   ├── web/          # PWA - hosted online; primary distribution
│   │   └── src/
│   │       ├── main.ts           # boot, routing
│   │       ├── theme.ts          # theme apply/persist (FOUC prevention)
│   │       ├── bridge/           # web implementations of HostV1 APIs
│   │       │   ├── index.ts      # compose all bridge pieces
│   │       │   ├── db.ts         # IndexedDB setup
│   │       │   ├── state.ts      # host.state - saved edits
│   │       │   ├── profile.ts    # host.profile - user details
│   │       │   ├── assets.ts     # host.assets - catalog + user uploads
│   │       │   ├── clipboard.ts  # host.clipboard
│   │       │   ├── export.ts     # host.export - rasterise/serialize
│   │       │   ├── net.ts        # host.net - allowlisted fetch
│   │       │   └── media.ts      # host.media - live camera frames (onFrame)
│   │       ├── catalog/
│   │       │   └── sync.ts       # boot-time catalog sync + offline cache
│   │       ├── styles/           # app-wide CSS (app.css, picker.css, tokens.css)
│   │       └── views/
│   │           ├── gallery.ts    # tool library listing + saved-state cards
│   │           ├── tool.ts       # mounts one tool (inputs + canvas + actions)
│   │           ├── picker.ts     # asset picker UI (invoked by host.assets)
│   │           ├── profile.ts    # user details editor
│   │           ├── projects.ts   # /p - folders of saved sessions (nested; folder/selection export)
│   │           └── free-canvas.ts # free-canvas editor overlay for render.layout:"editor" tools
│   │
│   ├── cli/          # Node.js CLI - same engine, headless jsdom
│   │   ├── bin/lolly.ts
│   │   └── src/
│   │       ├── run.ts    # loadTool → createRuntime → export → write file
│   │       └── bridge.ts # CLI implementation of HostV1
│   │
│   ├── tui/          # Interactive terminal shell (Ink) - reuses the CLI bridge
│   │   └── src/
│   │       ├── main.tsx  # full-screen app: Gallery / Projects / Profile / ToolView
│   │       └── bridge.ts # CLI bridge + on-disk state under ~/.lolly
│   │
│   ├── tauri-desktop/ # downloadable desktop app
│   └── tauri-mobile/  # iOS/Android app
│
├── tools/            # profile VIEW (gitignored) - data, not code. Merged from packs:
│                     #   community/ (public, brand-agnostic, MPL) + brands/<active>/tools (brand-owned).
│                     #   A SELECTION follows - the mounted set depends on the profile.
│   ├── qr-code/
│   ├── quotes/
│   ├── email-signature/
│   ├── snippet/
│   ├── countdown-timer/
│   ├── color-palette/
│   ├── color-block/           # typed/heterogeneous blocks (addMenu discriminator)
│   ├── dynamic-layout/
│   ├── tool-logo/         # "Logo" - auto-switching brand logo
│   ├── street-map/        # offline vector city-block maps
│   ├── url-shot/          # "URL Screenshot" (capture capability)
│   ├── strip-data/        # on-device metadata strip - JPEG/PNG/SVG/PDF (file in → clean file out)
│   ├── compress-pdf/      # on-device PDF compressor - recompresses images (file in → smaller file out)
│   ├── brand-lockup/      # "Brand Lockup" - SUSE logo lockups; HarfBuzz text-to-path (wasm)
│   ├── chart-creator/     # SVG charts from structured data
│   ├── filter/            # photo effects in one tool - halftone/scanline/posterize/voronoi (vector), duotone/pixel-stretch/imperfections (raster)
│   ├── meeting-planner/   # global timezone meeting scheduler
│   ├── calendar-ics/      # event → .ics calendar file plus a card
│   ├── digi-ad/           # "Animated Ad" - looping banner from scenes
│   ├── event-name-badge/  # conference badges - composes qr-code as an SVG
│   ├── wayfinding-signage/ # event signage; directions blocks auto-fit label text
│   ├── text-helper/       # on-device text workbench (format/decode/hash/de-identify)
│   ├── design/     # "Design" - freeform WYSIWYG editor canvas (render.layout: editor)
│   ├── multi-page-pdf/    # multi-page PDF document - cover, flowing content blocks, back page
│   ├── diagram-builder/   # org / layercake / process / cycle / pyramid diagrams
│   ├── logo-wall/         # many logos → auto-packed grid
│   ├── logo-lockup-partner/ # SUSE + partner co-brand lockup
│   ├── icon/          # favicon .ico / png / svg from text + colours
│   ├── lottie-digi-ad/    # animated Lottie ad banners
│   └── pose-geeko/        # pose the SUSE Geeko mascot - print-ready stills
│
├── catalog/
│   ├── tools/index.json        # tool registry
│   └── assets/
│       ├── index.json          # asset registry
│       └── suse/...            # logo, palette, etc.
│
├── schemas/          # JSON Schema for tool.json, asset entries, AssetRef
├── scripts/          # build-catalog-index.ts, checksum-assets.ts, validate-catalog.ts
├── tests/            # engine tests
└── docs/             # this file + authoring guides + positioning
```

---

## 플랫폼 배포 모델

이 플랫폼은 여러 표면에서 실행됩니다 - 웹 PWA, Tauri 데스크톱/모바일, 스크립트 가능한 CLI, 대화형 TUI. 모두 같은 엔진과 같은 도구 파일을 사용합니다.

### 웹(PWA) - 주요 배포 경로
SUSE가 관리하는 URL에서 호스팅됩니다. 서비스 워커가 도구와 에셋을 캐시하고 나면 오프라인에서도 작동합니다. 대부분의 직원, 벤더, 파트너가 이 플랫폼을 사용하는 곳입니다. 계정이 필요 없으며 - 상태는 기기별로 IndexedDB에 저장됩니다.

웹 셸은 하나의 레이아웃에서 반응형으로 동작합니다. 데스크톱에서는 도구가 크기 조절 가능한 컨트롤 사이드바와 미리보기 스테이지로 구성되며, 트랙패드에 최적화된 캔버스 탐색(Cmd/Ctrl-휠 또는 핀치로 커서 기준 확대/축소, Space 또는 중간 버튼 드래그로 패닝, `0`/`1`/`+`/`−` 키, Fit/% HUD)을 지원합니다. 모바일(≤640px)에서는 컨트롤이 상단에 고정된 시트가 되어 드래그 손잡이로 peek/half/full 사이를 스냅 전환하고(탭으로도 전환), 고정된 전체 화면 미리보기 위에 표시됩니다. 떠 있는 **Render** 버튼을 누르면 하단 시트 팝업으로 **Export** 컨트롤이 열립니다. 터치에서는 미리보기에서 핀치 줌과 드래그 패닝을 사용할 수 있습니다. 렌더링 경로와 내보내기 컨트롤은 둘 다 동일하며 - 크롬(UI 프레임)만 다르게 배치됩니다.

![데스크톱 분할 화면 - 왼쪽은 매니페스트에서 생성된 컨트롤, 오른쪽은 실시간 캔버스](/t/url-shot?url=%2F%23%2Ftool%2Fchart-creator&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=aud-web-split)

같은 도구를 휴대폰 너비에서 보면, 유지해야 할 두 번째 레이아웃이 없습니다: 컨트롤은 상단의 시트가 되고, 프리뷰가 화면 전체를 차지하며, 렌더 필이 그 위에 떠 있습니다.

![너비 430px 화면의 오디오그램 - 위쪽에는 컨트롤 시트, 아래쪽에는 완성된 정사각형 아트워크, 그리고 떠 있는 렌더 알약(pill) 버튼](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

**배치 모드(`/pro`).** 웹 셸에는 하나 또는 여러 도구에 걸쳐 여러 행을 한 번에 렌더링하는 스프레드시트 스타일의 배치 그리드(`shells/web/src/pro/`)도 포함되어 있습니다. CSV/TSV 왕복 변환과 스프레드시트 붙여넣기, 행별 템플릿/포맷/크기/단위/dpi, 실시간 프리뷰가 있는 블록 편집기 사이드 패널, 접을 수 있는 내보내기 열, 행별 "관련성" 태그 바, 왼쪽 드래그 핸들을 이용한 행 재정렬, 2단계 삭제 확인, 저장된 배치 세션, `.zip` 다운로드를 제공합니다. 이것이 "대량 콘텐츠 생성" 포지셔닝 뒤에 있는 일대다 화면입니다.

### Tauri 데스크톱 / 모바일
Tauri를 통해 작은 용량으로 패키징된 네이티브 앱입니다. 완전한 오프라인 사용, CLI 의존 도구(PDF Smasher, Font Outliner)를 위한 파일시스템 접근, 카메라 접근을 제공합니다. 2026년 중반 툴링 개선이 예정되어 있습니다.

### CLI
`lolly <tool-id> [--input=value ...] --output=file.png`

데스크톱 사용자는 터미널에서 많은 도구를 실행할 수 있습니다. CLI 셸은 동일한 엔진을 로드하고, jsdom DOM을 생성하며, 동일한 렌더 경로를 실행하고 파일을 씁니다. URL 모드가 전송 방식입니다 - CLI는 별도의 구현이 아닙니다. 이는 CLI와 GUI 출력이 동일함을 보장합니다.

```bash
lolly qr-code --url=https://suse.com --output=qr.svg
lolly quotes --quote="Ship it." --output=quote.png
lolly                        # lists available tools
lolly qr-code                # lists inputs for that tool
```

### TUI
`npm run tui`

CLI의 대화형 짝입니다: 도구를 탐색하고, 입력을 채우고, 프로젝트를 저장하고, 내보내는 것을 GUI 없이 전부 처리하는 전체 화면 키보드 우선 터미널 앱(Ink 기반)입니다. 호스트 브리지는 DOM이 필요 없는 포맷(SVG/EMF/EPS/HTML + 텍스트/데이터)에 대해 **CLI의 구현을 재사용**하며, `~/.lolly` 아래의 디스크 상태와 옵트인 인라인 프리뷰를 추가로 제공합니다. 그 외에 **브라우저 렌더 티어**도 있습니다: 필요할 때 래스터/PDF/비디오와 실시간 URL 캡처를 생성하는 범위가 제한된 헤드리스 Chromium(MCP 서버가 설치하는 것과 동일)으로, 웹 셸의 빌드된 사본을 구동해 출력이 동일하며 그런 포맷을 처음 내보낼 때만 실행됩니다. 그래서 `url-shot`(크롭 + 리컬러 + 벡터 PDF/SVG 포함)과 모든 래스터/pdf 도구가 터미널에서도 실행됩니다. [TUI 가이드](/info/tui.html)를 참조하세요.

어느 화면에 있든, 대시보드의 Capabilities 탭은 플랫폼이 할 수 있다고 선언한 모든 것을 그룹화해 도구를 하나도 열지 않고도 읽을 수 있는 전체 지도입니다.

---

## 도구 카테고리

도구는 갤러리 그룹화를 위해 매니페스트에 `category`가 태그되어 있습니다.

행은 갤러리 섹션 순서로 나열됩니다. `utility` 섹션은 (향후 추가될 카테고리를 포함한) 다른 모든 카테고리 뒤, 갤러리에서 항상 **마지막**에 렌더링됩니다 - 이는 온디바이스 "오프라인 유틸리티" 서랍입니다.

| 카테고리 | 예시 | 계획 중 |
|---|---|---|
| `everyone` | QR Code Generator, Quote Card, Email Signature, Logo, Wordmark, Audiogram, Battlecards, Sequence Studio, Record | Employee Image Stationery |
| `designer` | Brand Lockup, Design, Chart, Darkroom, Filter, Pose Geeko, Multi-Page PDF | Font Outliner |
| `event` | Meeting Planner, Event Name Badge, Wayfinding Signage, Calendar ICS, Booth Studio | Event Stationery, Bulk Name Badges, Room Agenda Cards |
| `product` | - | CVE Alert, Product Release Announcement, Blog OG Image |
| `utility` | Strip Hidden Data, Text Helper, Compress PDF, Convert Image, Convert Font, Redact, Run Web Code, Screen Capture, URL Screenshot | Unit/format converters, more on-device privacy utilities |

이 셀들은 **예시일 뿐 전체 목록이 아닙니다**. 어떤 도구가 존재하는지는 이 페이지가 아니라 마운트한 프로필의 속성입니다: 브랜드 팩은 자체 도구를 추가할 수 있고, 배포하고 싶지 않은 커뮤니티 도구를 제외할 수도 있습니다. 매니페스트에서 생성되고 갤러리가 실제로 읽는 레지스트리인 `catalog/tools/index.json`이 공인 목록입니다. 프로필이 마운트하는 것을 세려면, 여기 적힌 숫자를 믿기보다 매니페스트(`ls community/*/tool.json brands/*/tools/*/tool.json`)를 세십시오. (두 팩에 존재하는 도구 id는 이긴 팩에서 한 번만 마운트됩니다.)

도구는 상태(status)로도 분류됩니다: `official`(브랜드 승인, 워터마크 없음), `community`(외부 기여), `experimental`(내보내기에 워터마크 표시). 라이브러리 대부분은 `official`이며, 최신 스튜디오와 캡처 도구는 안정화되는 동안 `community` 또는 `experimental`에 머무르는 경향이 있습니다. 모든 화면이 배지를 표시하므로 읽는 사람은 열어보기 전에 무엇을 받게 될지 알 수 있습니다 - 그리고 위의 카테고리 셀과 마찬가지로, 상태별 소속은 너무 빠르게 바뀌어 여기 나열할 수 없습니다. 갤러리나 생성된 인덱스에서 확인하세요.

**Design**은 `render.layout: "editor"` 자유 캔버스 모드로 만들어진 첫 번째 도구입니다 - 텍스트, 도형, 이미지 박스를 드래그, 크기 조절, 회전, 스냅한 뒤 다른 모든 도구와 동일한 렌더 경로로 내보내는, 크롬이 없는 직접 조작 화면입니다.

**Strip Hidden Data**는 첫 번째 **온디바이스 유틸리티**(`privacy: "on-device"`)입니다: *사용자*가 제공한 파일을 받아 브라우저 안에서 전부 처리하고 깨끗한 사본을 돌려주는 콘텐츠 변환 도구로, 업로드되지 않고, 워터마크도 찍히지 않고, 출처 정보도 찍히지 않습니다. **Text Helper**가 두 번째입니다 - JSON 포맷, JWT 디코드, Base64, URL 인코딩/디코딩, SHA 해싱 등 일상적으로 웹사이트에 붙여넣는 작업을 위한 온디바이스 작업대입니다. **Compress PDF**가 세 번째입니다 - 이미지를 다시 압축해 PDF 용량을 줄이며, 이 역시 전부 온디바이스로 처리됩니다. 마커와 그 배지 문구 "Runs on your device - nothing is uploaded"는 이제 전체 변환 세트를 아우릅니다: Strip Hidden Data, Text Helper, Compress PDF, **Convert Image**(HEIC/TIFF/AVIF → WebP/JPG/PNG), **Convert Font**, **Redact**(이미지, SVG, PDF의 영역 파기), **Prompt to Image**, 그리고 프로필이 마운트하는 경우 **Rebrand a Deck**(`.pptx`를 그 자리에서 리테마)입니다. 이는 기밀 파일을 단일 목적 웹사이트에 넘기는 방식을 대체하는 프라이버시 유틸리티 카테고리입니다.

![이미 가지고 있는 파일을 변환하는 도구인 카드들이 모여 있는 유틸리티 서랍](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=aud-utilities)

> 참고: `category`와 `status`는 각 `tool.json`에서 (갤러리가 읽는 레지스트리인) `catalog/tools/index.json`으로 비정규화됩니다. 매니페스트가 단일 진실 공급원이며 - 인덱스는 `npm run build:catalog`로 **생성**되고, 커밋된 인덱스가 매니페스트에서 어긋나면 `npm run validate:catalog`가 CI를 실패시킵니다.

---

## 아키텍처 원칙

이 결정들은 확정되었습니다. 이 중 하나라도 바꾸는 것은 큰 작업입니다 - 이들이 코드베이스의 다른 모든 결정을 형성합니다.

### 1. 선언적 도구, 명령형 탈출구를 갖춘

도구는 매니페스트(`tool.json`) + 템플릿(`template.html`) + 선택적 `hooks.js`로 구성됩니다.

**매니페스트가 입력을 선언합니다.** 템플릿이 아닙니다. 입력은 Handlebars 토큰에서 추론되지 않습니다. 매니페스트가 계약이며, 템플릿은 `{{id}}`로 명명된 변수를 소비합니다.

![Street Map의 컨트롤 스택 - 도시 드롭다운, 테마 선택, 굵기 슬라이더, 색상 트리거까지 모두 매니페스트의 한 줄에서 그려집니다](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

**훅은 선택 사항입니다.** 대부분의 도구는 순수하게 선언적입니다 - 매니페스트 + 템플릿이면 충분합니다. 계산된 값이 필요한 도구(QR 인코딩, 차트 데이터 정형화)는 명명된 라이프사이클 함수(`onInit`, `onInput`, `onFrame` - 모션 반응형 도구를 위한 프레임별 실시간 카메라 훅 - `onLevel`, `beforeExport`, `afterExport`, `exportFile` - Strip Hidden Data 같은 온디바이스 유틸리티가 쓰는 파일 입력/출력 변환 경로 - 그리고 자체 딥 래스터를 소유하는 도구를 위한 `exportStill`)를 노출하는 `hooks.js`를 제공합니다. 호스트는 `new Function('host', …)`를 통해 훅을 로드하며, 기능 브리지를 클로저 스코프로 주입합니다. 이는 **이식성 계약이지 보안 샌드박스가 아닙니다**: 훅은 여전히 페이지 렐름에서 실행되며 브라우저 셸에서는 `window`/`fetch`/`document`에 접근할 *수 있습니다* - `host.*`는 지원되는 이식 가능한 표면일 뿐, 강제되는 경계가 아닙니다. 비동기 훅 결과는 시간 제한이 있고(`onInit` 5초, `onInput` 2초, `beforeExport`/`afterExport` 5초, `exportFile`/`exportStill` 10초) 늦게 도착한 결과는 버려집니다. 폭주하는 *동기* 훅은 선점할 수 없습니다. 따라서 신뢰할 수 없는 서드파티 훅 코드는 Worker 격리가 도입되기 전까지 실행하기에 안전하지 않습니다.

이것이 중요한 이유: 선언적 도구는 비개발자도 만들 수 있습니다. 모든 도구가 웹 앱이었다면, "주력 템플릿을 만들고 유지할 인력이 제한적"이라는 위험 요소가 영구적인 병목이 됩니다.

### 2. 도구와 에셋은 데이터이지, 번들된 코드가 아닙니다

웹과 Tauri 앱은 부팅 시 알려진 URL에서 도구와 에셋 카탈로그를 가져와 로컬에 캐시하고 거기 있는 것으로 동작합니다. **새 이벤트 타일이나 시즌 에셋을 추가하는 데 앱 릴리스가 필요하지 않습니다.**

에셋 바이트는 CDN 오염을 막기 위해 SHA-256으로 체크섬이 매겨집니다. 에셋 `id` + `version`이 캐시 무효화를 결정합니다.

### 3. Capability Bridge가 도구가 보는 유일한 API입니다

도구는 템플릿 영역 밖의 DOM을 절대 건드리지 않고, `fetch`를 직접 호출하지 않으며, 파일시스템을 읽지 않습니다. 버전이 매겨진 `host.*` 메서드를 호출할 뿐입니다. 이 계약의 정본 정의는 `packages/core/src/host-v1.ts`입니다 - 도구 저작 SDK `@lolly-tools/core`로, 서드파티가 엔진에 의존하지 않고도 이를 기반으로 개발할 수 있습니다. `engine/src/bridge/host-v1.ts`는 이것의 타입 재내보내기이며, 엔진/셸 코드는 그 경로를 그대로 계속 임포트합니다:

| 브리지 API | 하는 일 |
|---|---|
| `host.profile` | 사용자의 이름, 이메일, 프로필 사진, 도시 등. `bindToProfile`로 입력을 미리 채웁니다. |
| `host.assets` | 카탈로그 조회, 에셋 해석, 호스트가 제공하는 피커 UI. |
| `host.state` | 입력 슬롯 저장/불러오기. 웹에서는 IndexedDB, Tauri에서는 파일시스템, CLI에서는 메모리. |
| `host.clipboard` | 텍스트나 이미지를 클립보드에 쓰기(플랫폼별 대체 방식 포함). |
| `host.export` | 렌더 대상을 래스터화하거나 직렬화합니다. experimental 도구에는 워터마크를 적용합니다. |
| `host.net` | 허용 목록에 등록된 fetch - 도구가 `"network"` 기능을 선언한 경우에만 사용 가능합니다. (현재 배포된 도구 중 이를 사용하는 것은 없습니다.) |

선택적이고 추가적인 표면은 셸이 이를 제공할 때만 나타납니다. 일부는 **기능 게이팅**되어 있습니다 - 도구가 일치하는 플래그를 선언할 때만 노출됩니다: `host.compose`(다른 도구의 렌더 임베드 - `compose`), `host.capture`(URL Screenshot을 위한 페이지 캡처 - `capture`), `host.recorder`(녹화 도구를 위한 마이크/카메라/화면 캡처 - `microphone` / `camera` / `screen`). 나머지는 **기능 감지**됩니다 - 셸이 제공할 수 있을 때는 언제나 존재하며, 제공할 수 없는 셸을 위해 도구가 대체 동작을 유지합니다.

무엇을 다루는지 보여주기 위한 대표적인 표면 몇 가지입니다 - [Host API](/info/host-api.html)가 전부 문서화하며, `packages/core/src/host-v1.ts`가 계약 그 자체입니다:

| 표면(Surface) | 도입 버전 | 추가되는 기능 |
|---|---|---|
| `host.tokens` | 1.0 | DTCG 디자인 토큰 - 브랜드 고유의 기본 요소 |
| `host.text` | 1.0 | HarfBuzz WASM을 통한 텍스트-패스 변환(`wasm` 기능 플래그가 이를 사용하는 도구를 표시해요) |
| `host.media` | 1.4 | `onFrame` 훅을 구동하는 실시간 카메라 프레임. 점진적 향상 방식으로, 의도적으로 `camera` 플래그로 제한되지 *않아요* - 이런 도구는 일반 정지 이미지 도구로도 여전히 작동해요 |
| `host.color` | 1.40 | 지각적 색상 연산: ΔEOK, WCAG + APCA 대비, OKLab 램프, 클래스 구간, 범주형 팔레트, 조화 스킴(1.60), CSS Color 4 혼합 및 그레이디언트 베이킹(1.68). 순수하고 동기적이에요 - 셸은 직접 구현하지 않고 엔진의 `makeColorApi()`를 연결하므로 어긋날 수 없어요 |
| `host.images` | 1.60 | 기기에서 바이트를 디코딩/크기 조정/재인코딩 - 변환 경로예요(HEIC → JPEG, WebP로 압축, 축소). 웹 셸에서는 지연 로딩 파사드로 제공되어, HEIC 디코더가 부팅 청크에 절대 포함되지 않아요 |
| `host.geom` | 1.64 | 정확한 벡터 기하 연산: 경로 불리언, 오프셋, 스트로크-투-필, 스플라인 저차화, 단순화, 히트 테스트. 이 또한 순수하고 동기적이며 엔진에서 연결돼요(`makeGeomApi()`). 실패는 예외를 던지지 않고 *반환*돼요 |

나머지는 같은 규칙을 따르며 그 옆에 함께 문서화되어 있습니다: 온디바이스 문서 수술을 위한 `pdf`(1.8)와 `pptx`(1.58), 클립 분석과 온디바이스 TTS/전사를 위한 `audio`(1.71)와 `speech`(1.96), MilkDrop 플레이스홀더 계약을 위한 `viz`(1.72), 딥비트와 레이어드 비트맵 출력을 위한 `codec`(1.100)과 `layers`(1.102), 온디바이스 모델을 위한 `upscale`(1.101)과 `matte`(1.103), 직접 픽셀 작업을 하는 훅을 위한 `raster`(1.105), 내보내기 안전 화살표를 위한 `connectors`(1.106), 완성된 바이트에 서명하기 위한 `c2pa`(1.85)입니다. 개수는 늘어나지만 규칙은 그대로입니다.

선언 가능한 기능은 다음과 같습니다: `network`, `filesystem`, `clipboard`, `camera`, `microphone`, `screen`, `ffmpeg`, `wasm`, `capture`, `compose`. (1.54에서 추가된 `screen`은 `host.recorder`를 통한 화면 캡처입니다 - 사용자가 브라우저 네이티브 UI에서 화면/창/탭을 선택합니다. 도구 자신이 지정한 URL을 래스터화하는 `capture`와는 다릅니다.)

동일한 도구가 브라우저, Tauri, 헤드리스 CLI에서 실행되는 이유는 각 셸이 이 인터페이스를 구현하기 때문입니다 - 도구는 자신이 어디에서 실행되는지 전혀 알지 못합니다.

브리지에는 버전이 매겨집니다. 메서드를 추가하는 것은 마이너 버전입니다. 제거하거나 시그니처를 바꾸는 것은 메이저 버전 상승입니다. v2가 출시되어도 v1은 계속 동작해야 합니다.

### 4. 에셋 ID는 영원합니다

`suse/logo/primary`는 계약입니다. 한번 공개되면:
- ID는 절대 바뀌지 않고, 재사용되지 않습니다.
- 바이트가 바뀌면 → 매니페스트의 `version`을 올립니다.
- 새 에셋으로 대체되면 → `deprecated: true`를 설정하고 선택적으로 `replacedBy`를 지정합니다.
- 기존 참조는 항상 해석됩니다.

이는 저장된 도구 상태와 URL로 공유한 링크가 몇 년이 지나도 유지되게 합니다.

### 5. URL 모드는 최우선 요소입니다

모든 입력은 URL 파라미터로 표현할 수 있어야 합니다:

```
lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H
```

![그 외에 아무것도 없는 이 링크 자체가 완성된 에셋입니다](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fsuse.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

CLI 모드는 다른 전송 방식을 쓰는 URL 모드입니다 - CLI 셸은 argv로부터 URL 상태 객체를 만들고 **동일한** 엔진 파이프라인을 실행합니다. 렌더 경로는 하나뿐입니다. CLI는 별도의 구현이 아니므로 GUI와 어긋날 수 없습니다.

`url-mode.ts`가 왕복 변환(파싱과 직렬화)을 처리합니다. **예약된 파라미터** 집합은 절대 도구에 입력으로 전달되지 않습니다: 출력 제어(`format`, `export`, `copy`, `filename`, `width`/`w`, `height`/`h`, `unit`, `dpi`), 인쇄와 출처 다이얼(`bleed`, `marks`, `profile`, `password`, `c2pa`, `imprint`, `durable`, `meta`, `hdr`, `depth`, `cuts`), 그리고 상태 전달자(`template`, "Shortest link" 압축 토큰인 `z`, 그리고 이를 비밀번호로 암호화한 `zx`)입니다. `engine/src/url-mode.ts`의 `RESERVED` 집합이 권위 있는 정의이며 테스트로 고정되어 있습니다. [URL Mode](/info/url-mode.html)가 여기 나열되지 않은 몇 개를 포함해 전부 문서화합니다. URL 모드의 에셋 입력은 `id`로 직렬화되며, 런타임은 하이드레이션 전에 `host.assets.get()`을 통해 이를 해석합니다. `width`/`height`는 `unit`(기본값 `px`, 그 외 `mm`/`cm`/`in`/`pt`/`pc`) 단위의 값입니다. 물리적 단위를 쓰면 `dpi`가 래스터 해상도를 결정합니다. 이들은 캔버스 문서 크기를 설정하고 내보내기 크기 패널을 미리 채웁니다.

모든 입력이 링크에 담겨 이동하므로, 파라미터 하나를 바꾸면 완성된 에셋이 달라집니다. 이 팔레트 전체가 시드 색상 하나, 조화 방식 하나, 단계 수 하나로 이루어져 있습니다:

![링크에 담긴 단 하나의 씨앗 색상에서 자라난 네 가지 색조에 걸친 아홉 단계](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

### 6. 저장은 다이렉트가 아니라 브리지를 통해 이루어집니다

웹 쉘: IndexedDB. Tauri: 파일시스템. CLI: 인메모리. 도구는 `host.state.save(slot, data)`와 `host.state.load(slot)`만 볼 수 있습니다. `localStorage`는 사용하지 않습니다 - 너무 작고 blob을 저장할 수 없기 때문입니다.

사용자는 도구별로 이름이 지정된 여러 편집 슬롯을 저장하고 나중에 각 세션으로 돌아갈 수 있습니다. 계정 생성은 필요하지 않으며, 상태는 기기별로 저장됩니다. 브리지가 유일한 접점이기 때문에 이 기기별 상태는 *이동 가능*하기도 합니다: `shells/web/src/data-transfer.ts`가 `host.profile`/`host.state`/`host.assets`를 통해 모든 것을 다시 읽어들여 다른 설치본에서도 가져올 수 있는 하나의 `lolly-backup` zip 파일로 만듭니다 - 서버가 필요 없는 "새 기기로 이동" 문제에 대한 오프라인 해법입니다(전체 사양: `docs/data-transfer.md`). SUSE ID 통합(다중 기기 동기화)은 이를 기반으로 한 향후 마일스톤입니다.

### 7. 성숙도 태그는 "브랜드 승인" 리스크에 설계로 답합니다

모든 도구는 매니페스트에서 `status: official | community | experimental`을 선언합니다. 갤러리는 이 상태에 따라 정렬됩니다. 실험적 도구는 내보내기 시 자동으로 워터마크가 적용됩니다 - 워터마크는 도구가 아니라 `host.export.render`가 적용하므로, 공식 도구가 아닌 작성자가 이를 비활성화할 수 없습니다.

이는 어떤 도구를 사용하는 것이 브랜드 승인을 의미한다는 인식 리스크에 대한 구조적 답변입니다. 프로세스적 답변(검토 대기열, SUSE ID 게이팅)은 그 위에 층으로 더해집니다.

### 8. 도구 입력은 자산을 포함해 매니페스트를 통해 타입이 지정됩니다

입력은 `type`을 선언합니다: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table`, `file`. 호스트는 매니페스트로부터 타입별로 범용 컨트롤을 렌더링합니다 - 도구는 컨트롤 코드를 전혀 작성하지 않습니다. (사용자 프로필에서 값을 미리 채우는 것은 타입이 아닙니다 - 어떤 입력이든 `bindToProfile`을 가질 수 있습니다.) 나머지보다 비중이 큰 세 가지가 있습니다:

- **`asset`**(`filter`와 `allowUpload` 포함)는 전역 자산 시스템으로 이어지는 브리지입니다. `allowUpload: false`는 라이브러리 자산만 허용되는 스폰서 타일 로고 같은 경우를 위한 브랜드 강제 레버입니다. 사용자 업로드는 라이브러리 자산과 동일한 `AssetRef` 형태를 사용하므로 도구는 이 둘을 동일하게 처리합니다.
- **`blocks`**는 반복되는 필드 그룹입니다 - 하나의 입력 안에 있는 미니 테이블로, 사이드 패널에서 편집하며, 타입이 지정된/판별된 추가 메뉴와 블록별 자산 필드를 가집니다. 캔버스에서 렌더링된 블록을 클릭하면 해당 블록의 행에 포커스가 갑니다. `meeting-planner`, `chart-creator`, `event-name-badge`, `wayfinding-signage`, `color-block`, `digi-ad`에서 사용됩니다.
- **`vector`**는 고정된 숫자 집합(예: 변형)을 하나의 복합 컨트롤로 묶습니다. **`file`**은 `strip-data`, `compress-pdf` 같은 온디바이스 변환 유틸리티를 위해 사용자 자신의 파일을 메모리 내 바이트로 저장합니다.

### 9. 템플릿은 로직이 없습니다(EJS가 아닌 Handlebars)

Handlebars는 EJS 대신 의도적으로 선택되었습니다:
- 로직이 없음. 개발자가 아닌 사람도 템플릿을 작성할 수 있습니다.
- 기본적으로 안전함. `{{x}}`는 HTML을 이스케이프하며, `{{{x}}}`는 선택적으로 원본을 그대로 출력합니다.
- 템플릿에 임의의 JS가 없으므로 템플릿별 XSS 감사 대상이 없습니다.

로직은 명시적이고 검토 가능한 `hooks.js`에 있습니다. 사용 가능한 Handlebars 헬퍼: `{{default}}`, `{{upper}}`, `{{lower}}`, `{{eq}}`, `{{markdown}}`, `{{asset ref}}`, `{{asset ref "property"}}`(그 외에 함께 쓰이는 `.ics`/`.vcf`/`.csv` 템플릿용 데이터 포맷 헬퍼 `icsStamp`/`rfcText`/`csvCell`도 있습니다).

### 10. 도구가 도구를 합성합니다

도구는 도구 간 임포트 없이 **다른** 도구의 렌더링 결과를 임베드할 수 있습니다 - 합성은 도구 코드가 아니라 항상 엔진이 처리합니다. 두 가지 표면이 있습니다:

- **선언적 매니페스트** - `composes: [{ id, tool, inputs, format?, width?, height? }]`. 엔진이 지정된 자식 도구를 렌더링하고 그 결과를 로직 없는 템플릿 안에 `{{asset <id>}}`로 배치합니다. `event-name-badge`는 현재 `qr-code`를 SVG로 합성합니다.
- **이식 가능한 임베드 URL** - `<img src="https://lolly.tools/tool/<id>.<ext>?<inputs>">`. 쉘은 이 자식을 **로컬에서** 렌더링합니다(로컬 렌더링이 완료될 때까지 자리 표시자 픽셀이 표시됩니다). `lolly.tools`에서 실제로 가져오는 것은 전혀 없습니다.

어떤 도구의 렌더링 결과도 합성할 수 있습니다: **SVG** 자식은 부모가 SVG나 PDF로 내보낼 때 진짜 벡터로 유지되고, PNG로 내보낼 때는 선명하게 래스터화됩니다. **PNG/JPG/WEBP** 자식은 이미지로 임베드됩니다. `compose` 기능이 필요합니다. 합성된 자식은 중간 산물이며 - 워터마크나 출처 정보가 절대 찍히지 않습니다 - 합성은 우아하게 저하됩니다: 자식을 렌더링할 수 없는 쉘은 그 슬롯을 그냥 생략하고 부모는 여전히 렌더링됩니다.

---

## 우리가 의도적으로 하지 않기로 한 것

- **템플릿에 EJS나 임의의 JS 없음.** XSS 공격면이 0이에요. 로직은 `hooks.js`에 있어요.
- **필수 에셋 CMS 없음.** 개인은 자신의 창작 파일을 앱 안에서 바로 자신의 카탈로그로 가져와요([카탈로그](/info/using.html) 뷰와 Brand Studio) - 서버도 관리자 콘솔도 없어요. 작업물은 **세션**으로 전달돼요: 공유 링크가 전체 상태를 담고, 같은 세션이 백업이나 협업 세션을 통해서도 이동해요. 배포를 관리하는 쪽은 공유 세션을 **템플릿**으로 고정할 수 있어요 - 링크를 열어 그 값을 브랜드 팩 안 해당 도구 디렉터리의 템플릿 항목으로 기록하고 커밋하면, 이후 그 도구의 "New from template" 선택기에 나타나고 `?template=<id>`로 딥링크할 수 있어요. Git은 배포 소유자의 고정 단계일 뿐, 제작자의 것이 아니에요. *공유되고 관리되는* 카탈로그가 필요하다면 조직이 같은 방식으로 에셋 디렉터리를 관리하고 PR 리뷰로 업데이트를 통제할 **수 있어요** - 이는 앱이 요구하는 것이 아니라 선택 가능한 거버넌스 모델이에요.
- **강제 RBAC 없음.** 오픈 앱은 기본적으로 누구나 접근할 수 있고, 브랜드 리스크는 성숙도 태그와 워터마크로 관리돼요. 더 강한 통제가 필요한 조직은 위의 자체 인증과 git 리뷰 카탈로그를 그 위에 얹으면 돼요.
- **중앙 데이터베이스 없음.** 모든 사용자 상태는 기기별로 저장돼요. SUSE ID 연동은 로드맵에 있지만 출시를 막는 조건은 아니에요.
- **공유 도구/엔진 코드 경로 없음.** 엔진은 오픈소스이고 `community/`의 브랜드 무관 도구들도 마찬가지예요; 비공개 `brands/suse/`와 같은 브랜드 팩은 자체 조건 아래 자신의 도구와 카탈로그를 갖고 있어요. 어느 쪽이든 분리가 강제되므로(`engine/`에서 도구 콘텐츠로의 교차 임포트 없음) 이 분리는 깔끔하게 유지돼요.

---

## 처음부터 끝까지, 라이프사이클

사용자가 `lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H`를 엽니다:

1. **부팅.** 웹 쉘이 IndexedDB를 열고, 기능 브리지를 구성하며, 도구와 자산 카탈로그를 동기화합니다(오프라인일 때는 캐시에서 불러옵니다).
2. **라우팅.** URL 해시 → `tool` 뷰, `qr-code`와 URL 파라미터가 추출됩니다.
3. **로드.** `loadTool('qr-code', fetchFile)`이 `tool.json`을 가져와 JSON 스키마에 대해 검증하고, `template.html`, `styles.css`, `hooks.js` 소스를 가져옵니다.
4. **URL 상태 파싱.** `parseUrlState`가 URL 파라미터를 초기 입력 값으로 변환합니다. 자산 참조(`?logo=suse/logo/primary`)는 가벼운 `{ id, _unresolved: true }` 객체로 파싱됩니다.
5. **런타임.** `createRuntime(tool, host, initialValues)`가 입력 모델을 구성하고(프로필 데이터, 기본값, 초기 값을 병합), `host.assets.get()`을 통해 자산 참조를 해석하며, 훅을 로드하고(클로저 범위의 `host`이며 샌드박스는 아닙니다), `hooks.onInit`을 호출합니다.
6. **렌더링.** 쉘이 런타임을 구독합니다. 상태가 바뀔 때마다 `{ model, hydrated }`를 받습니다. 모델로부터 입력 컨트롤을 렌더링하고, 하이드레이션된 템플릿 HTML을 `#tool-canvas`에 씁니다.
7. **상호작용.** 사용자가 입력란에 입력 → `runtime.setInput(id, value)` → 제약 적용 → `hooks.onInput` 호출 → 재하이드레이션 → 재렌더링. 캔버스가 실시간으로 업데이트됩니다.
8. **내보내기.** 사용자가 Download(PNG)를 클릭 → `runtime.export(canvasNode, 'png')` → `host.export.render`(dom-to-image-more를 통해 래스터화하며, SVG/PDF는 전용 DOM 순회 벡터화기를 거칩니다) → blob → `host.export.download`. 도구가 선택할 수 있는 포맷 범위는 넓으며, `schemas/tool.schema.json`의 `render.formats` 열거형이 이에 대한 최종 근거입니다 - 래스터와 부동소수점 래스터, 벡터와 재단 파일, 인쇄/CMYK, 모션, 편집 가능한 문서(`pptx`, `docx`, `odt`), 팔레트와 데이터/텍스트 출력, 오디오와 폰트 파일까지 포함합니다. [URL Mode](/info/url-mode.html)가 모든 id와 그것이 만드는 결과물을 정리해 둡니다. 오디오도 다른 항목과 마찬가지로 이 열거형에 포함됩니다(`wav`, `mp3`, `m4a`, `opus` - 오디오그램과 녹음 도구가 선언합니다). 별도로, 녹음 도구의 `render.capture` 모드는 `host.recorder`를 구동하며, 그 결과물은 브라우저가 녹음한 컨테이너 형식 그대로 완성된 Blob으로 도착합니다. (`render.export: false`를 설정한 도구 - 예: Color Palette, Countdown Timer, Strip Hidden Data, Text Helper, Compress PDF - 는 다운로드/포맷/크기 컨트롤을 숨깁니다.) 물리적 단위는 여기서 포맷별로 변환됩니다(PDF → 실제 페이지 포인트, 래스터 → `pHYs` 청크를 포함한 DPI 기준 픽셀). 저작/출처 메타데이터(작성자, 도구, 소스 - `engine/src/metadata.ts`가 생성)는 포맷별로 삽입됩니다: PNG iTXt, JPEG EXIF, PDF info dict, SVG `<metadata>`, GIF comment. 실험적 도구는 도구가 아니라 호스트가 워터마크를 삽입합니다.

![`?options`가 여는 내보내기 패널: 파일명과 포맷 쌍, 출력 크기, 파일을 기록하는 컨트롤들](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Tauri에서도 동일한 라이프사이클입니다. CLI에서도 동일한 라이프사이클입니다 - jsdom이 헤드리스 DOM을 제공하며, 출력은 파일이나 stdout으로 전달됩니다.

---

## 오픈소스 상태

**코드는 MPL-2.0이에요.** `engine/`, `shells/*`, `services/*`, `schemas/`, `docs/`는 **MPL-2.0** 아래 오픈소스로 공개돼요 - 브랜드 툴링을 위한 벤더 중립적 스캐폴딩 플랫폼이며, 배포 가능한 각 단위는 [github.com/lolly-tools](https://github.com/lolly-tools) 아래 자체 저장소로 존재해요.

**도구 콘텐츠는 브랜드 팩 형태로 제공되며**, 각 팩은 자체 조건을 가져요(팩의 `NOTICE.md` 참고). `community/`는 공개 [`lolly-tools`](https://github.com/lolly-tools/lolly-tools) 저장소이고, 여기 담긴 브랜드 무관 도구들도 MPL-2.0이에요. `brands/suse/`는 비공개 `suse-lolly` 팩이에요: SUSE 도구와 SUSE 카탈로그로, 라이선스가 있는 PremiumBeat 음악을 포함해 **SUSE 소유의 독점 자산**이에요. `brands/lolly-start/`는 이 저장소가 소유한 빈 스타터 브랜드예요. 폰트는 **SIL Open Font License 1.1** 아래 팩 안에 포함되어 제공돼요 - SUSE 팩에는 SUSE와 SUSE Mono 서체가 들어 있어요.

저장소 루트의 `tools/`와 `catalog/`는 git에서 무시되는 *뷰*예요: 프로필이 `community/`와 활성 브랜드 팩을 조합해 이를 만들어내며, 그래서 모든 스크립트와 셸은 팩을 직접 읽지 않고 항상 이 두 경로만 읽어요.

이 분리는 강제돼요 - `engine/`에서 도구 콘텐츠로의 교차 임포트는 없어요 - 그래서 플랫폼과 콘텐츠 사이의 경계는 깔끔하게 유지돼요.

---

## 엔진이 끝나고 호스트가 시작되는 지점

순수한 데이터 + Handlebars로 표현할 수 있다면 → **엔진**.
DOM, 파일시스템, 네트워크 또는 어떤 브라우저/OS API든 다룬다면 → **호스트**.

이 경계선은 의도적으로 명확합니다. 엔진은 오픈소스 부분입니다. SUSE나 특정 플랫폼, 런타임 환경을 아는 모든 것은 그 밖에 머뭅니다.

더 자세한 내용은 [`engine/README.md`](../engine/README.md)에서 모든 엔진 모듈과 각각의 책임을 나열하고 있으며, [위협 모델과 신뢰 경계](/info/threat-model.html)는 이 같은 경계선이 신뢰 경계 역할도 겸하는 지점을 기록합니다.
