# Lolly 아키텍처

![Lolly 아이콘 - 초록색과 흰색의 커다란 막대사탕](/info/icon.svg)

이 페이지는 Lolly 코드를 바꾸는 사람을 위한 것이에요. 엔진, 셸, 도구 팩이 어떻게 맞물리는지, 저장소 어디에 있는지, 모든 변경이 지켜야 하는 원칙을 다뤄요. Lolly가 무엇을 하고 누가 쓰는지 알아보려면 먼저 [Lolly 작동 방식](/info/how-lolly-works.html)을 읽으세요.

[`engine/README.md`](https://github.com/lolly-tools/lolly/blob/main/engine/README.md)는 엔진을 모듈별로 설명하며 코드에서 생성돼요. [위협 모델 & 신뢰 경계](/info/threat-model.html)는 같은 아키텍처를 신뢰 경계의 관점에서 살펴보고 엔진이 무엇을 신뢰하지 않는지 설명해요.

<!--i:eti-layers-->
## 전체 구조

맨 위의 도구는 데이터예요. 가운데 엔진은 어떤 플랫폼에 대해서도 알지 못해요. 맨 아래 셸은 하나의 계약을 구현하고, 카탈로그는 콘텐츠를 제공해요.

![도구는 공유 엔진에 매니페스트, 템플릿, 훅을 제공해요. 웹, Tauri, 터미널 셸은 HostV1 기능 브리지를 구현하고 카탈로그에서 도구와 에셋을 읽어요.](/info/diagrams/concepts/platform-layers.svg)

순수 데이터와 Handlebars로 기술할 수 있는 것은 모두 **엔진**에 속해요. DOM, 파일 시스템, 네트워크 또는 브라우저나 운영체제 API에 접근하는 것은 모두 **호스트**, 즉 브리지의 셸 쪽에 속해요. 엔진은 오픈 소스예요. 특정 브랜드에 관한 정보를 아는 것은 엔진에 들어가지 않아요.

<!--i:eti-folder-shared-->
## 저장소 구조

Lolly는 하나의 저장소예요. 아래 디렉터리는 `brands/suse`를 제외하면 모두 일반 디렉터리예요. 이 디렉터리는 SUSE 도구 팩과 카탈로그를 담은 **비공개** git 서브모듈로, 공개 저장소를 복제할 때는 가져오지 않아요. 콘텐츠 프로필(`profiles.json`)이 빌드에서 읽을 팩을 정해요. 각 프로세스가 자체적으로 프로필을 결정하며 전역 스위치는 없어요. [빌드 가이드](/info/build-guide.html)에 복제 명령과 비공개 팩 안의 변경을 커밋하는 방법이 있어요.

| 디렉터리 | 담긴 내용 |
|---|---|
| `engine/` | 플랫폼에 종속되지 않는 코어: 로더, 런타임, 입력, 템플릿, URL 모드, 단위, 형식 모듈 |
| `shells/` | 웹 앱, Tauri 데스크톱 및 모바일 앱, CLI, TUI, 브라우저 확장 프로그램 |
| `packages/` | 도구 작성자용 SDK(`@lolly-tools/core`), 공유 Node 셸 구성 요소, 문서 렌더러 등 |
| `community/` | 특정 브랜드에 종속되지 않는 도구와 공유 이모지 팩 |
| `brands/` | 브랜드 팩: `lolly-demo`(lolly.tools에서 사용하는 디자인 시스템인 Lolly Demo), `lolly-start`(빈 시작 팩), 비공개 `suse` |
| `services/` | 선택적 MCP, 인증서, Penpot 서비스와 이들이 공유하는 서버 코드 |
| `schemas/` | 도구 매니페스트, 에셋 항목, 에셋 참조용 JSON Schema |
| `scripts/`, `tests/`, `docs/`, `api/` | 빌드 및 카탈로그 스크립트, 엔진 테스트 모음, 이 문서, 생성된 서버리스 번들 |

::: details 처음 접하게 되는 엔진과 셸 파일
```
engine/src/
  index.ts          public surface: loader, runtime, template, inputs, url-mode
  loader.ts         fetches and validates tool files
  runtime.ts        orchestrates one mounted tool, from load to export
  template.ts       Handlebars hydration and annotateTemplate
  inputs.ts         manifest to runtime input model
  url-mode.ts       URL to input state and back
  validate.ts       JSON Schema validation of manifests
  compose.ts        nested tool renders (composes)
  embed.ts          portable lolly.tools embed URLs
  bridge/host-v1.ts type re-export of the @lolly-tools/core contract

shells/web/src/
  main.ts           boot and routing
  bridge/           the web implementations of the host APIs
  catalog/sync.ts   boot-time catalog sync and offline cache
  views/            the gallery, tool, projects, free canvas and the other views
  pro/              Batch (#/batch)

shells/cli/         bin/lolly.ts (entry), src/run.ts (headless render), src/bridge.ts
shells/tui/         src/main.tsx (the full-screen app), src/bridge.ts
```
:::

::: note 저장소 루트에는 `tools/`나 `catalog/` 디렉터리가 없어요
`packages/node-shell/src/content-roots.ts`는 `profiles.json`을 바탕으로 "도구 `<id>`가 어디에 있는지"와 "카탈로그가 어디에 있는지"를 알려줘요. 실제 `tools/`와 `catalog/` 쌍은 `dist/`, RPM 페이로드, 컨테이너 이미지 같은 빌드 출력에만 작성돼요. 브라우저가 HTTP로 이 두 경로를 가져오기 때문이에요.
:::

<!--i:eti-monitor-->
## Lolly가 실행되는 환경

모든 환경에서 같은 엔진과 같은 도구 파일을 사용해요.

- **웹 앱.** 프로그레시브 웹 앱이에요. 서비스 워커가 도구와 에셋을 캐시하면 오프라인으로 동작해요. 계정이 필요 없고 상태는 각 기기의 IndexedDB에 저장돼요. 하나의 반응형 레이아웃으로 데스크톱과 휴대폰을 지원해요. 휴대폰에서는 컨트롤이 시트가 되고 내보내기 컨트롤은 떠 있는 알약에서 열려요.
- **데스크톱 및 모바일 앱.** 같은 웹 앱을 Tauri로 패키징한 것으로, 네이티브 파일 대화상자, 파일 시스템에 저장되는 상태, 완전한 오프라인 사용을 제공해요.
- **CLI.** `lolly <tool-id> --input=value --output=file.png`는 헤드리스 DOM에 같은 엔진을 로드하고 파일을 써요. 다른 전송 수단을 쓰는 URL 모드예요. [CLI](/info/cli.html)를 참고하세요.
- **TUI.** 키보드 중심의 전체 화면 터미널 앱이에요. CLI의 브리지를 재사용하고 저장된 세션을 디스크에 보관해요. 데스크톱 앱이 설치되어 있으면 그 앱의 폴더에, 아니면 `~/.lolly` 아래에 보관해요. 형식에 필요한 경우에만 범위가 제한된 헤드리스 브라우저를 실행해요. [TUI](/info/tui.html)를 참고하세요.

![데스크톱 분할 보기: 왼쪽에는 매니페스트에서 생성된 컨트롤, 오른쪽에는 실시간 캔버스](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

휴대폰 너비에서는 컨트롤 시트가 위쪽에 있고 미리보기가 화면을 채워요.

![너비 430px 화면의 오디오그램: 위쪽의 컨트롤 시트, 아래쪽의 완성된 정사각형 아트워크, 떠 있는 내보내기 알약](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dzzfxm%3A7%3Alofi%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

웹 앱에는 **Batch**(`#/batch`, `shells/web/src/pro/`)도 포함돼요. 하나 또는 여러 도구에서 많은 행을 한 번에 렌더링하는 스프레드시트 형태의 격자예요. [Batch와 Lolly Multi-edit](/info/batch.html#make-many-versions-of-one-design)을 참고하세요. **Settings → Capabilities**에는 플랫폼이 할 수 있다고 선언한 모든 기능이 나열돼요.

![새로 설치한 앱의 Batch: 도구를 기다리는 빈 행 하나가 있고, 데이터가 들어오기 전부터 스프레드시트 화면과 Render 버튼이 준비되어 있어요](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

<!--i:eti-lock-->
## 아키텍처 원칙

이 결정들은 확정되어 있어요. 코드베이스의 다른 모든 결정이 여기에 의존하므로 하나를 바꾸는 것도 큰 작업이에요.

### 1. 필요하면 명령형 코드를 쓸 수 있는 선언형 도구

도구는 매니페스트(`tool.json`), 템플릿(`template.html`), 선택적 `hooks.js`로 이뤄져요. **매니페스트가 입력을 선언해요**. 템플릿의 Handlebars 토큰에서 입력을 추론하는 일은 없어요. 대부분의 도구는 매니페스트와 템플릿만으로 이뤄지므로 개발자가 아니어도 작성할 수 있어요.

![Street Map의 컨트롤 스택: 도시 드롭다운, 테마 선택기, 굵기 슬라이더, 색상 버튼이 모두 매니페스트의 한 줄에서 만들어져요](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

QR 인코딩이나 차트 구성처럼 값을 계산하는 도구는 훅을 추가해요. 훅은 기능 브리지가 주입된 상태로 런타임이 호출하는 이름 있는 수명 주기 함수예요. 훅은 이식성을 위한 계약이며 보안 샌드박스는 아니에요. 정해진 시간 예산 안에서 실행돼요. 훅이 페이지 전역 변수를 쓰지 않는다고 확인된 도구는 `isolate: true`를 명시하고 Worker에서 실행돼요. [도구 훅](/info/tool-hooks.html)에 수명 주기와 예산이 나와 있어요. [위협 모델](/info/threat-model.html)은 페이지 내 실행기가 무엇을 격리하고 무엇을 격리하지 못하는지 설명해요.

### 2. 도구와 에셋은 번들 코드가 아닌 데이터예요

웹 앱과 Tauri 앱은 시작할 때 도구 및 에셋 카탈로그를 가져와 캐시하고 캐시된 내용으로 작업해요. 새 도구나 에셋을 추가해도 앱을 새로 출시할 필요가 없어요. 에셋 바이트는 SHA-256 체크섬으로 검증해요. 에셋의 `id`와 `version`이 캐시 무효화를 결정해요.

### 3. 도구가 접근할 수 있는 API는 기능 브리지뿐이에요

도구는 템플릿 밖의 DOM에 접근하지 않고, `fetch`를 직접 호출하지 않으며, 파일 시스템을 읽지 않아요. 버전이 지정된 `host.*` 메서드를 호출해요. 계약은 도구 작성자용 SDK `@lolly-tools/core`의 `packages/core/src/host-v1.ts`에 정의돼 있어요. 제삼자는 엔진에 의존하지 않고 SDK를 기반으로 개발할 수 있어요. `engine/src/bridge/host-v1.ts`가 그 타입을 다시 내보내요.

| 필수 API | 하는 일 |
|---|---|
| `host.profile` | 사용자 정보. `bindToProfile`을 통해 입력을 미리 채워요 |
| `host.assets` | 카탈로그 조회, 에셋 참조 해석, 호스트의 선택기 |
| `host.state` | 입력 슬롯 저장과 로드: 웹에서는 IndexedDB, Tauri에서는 파일 시스템, CLI에서는 메모리 |
| `host.clipboard` | 플랫폼별 대체 수단을 갖춰 텍스트나 이미지를 클립보드에 써요 |
| `host.export` | 렌더링 대상을 래스터화하거나 직렬화하고, 기기 내 파일 변환 경로를 제공해요 |
| `host.log` | 호스트에 수준별 로그를 기록해요 |

그 밖의 모든 API는 선택적으로 추가되는 기능이에요. `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` 등 여러 가지가 있어요. 매니페스트의 `requires`에는 훅이 사전 확인 없이 호출하는 선택적 API가 나열돼요. 그중 하나라도 없는 호스트는 도구 마운트를 거부해요. 나머지는 훅이 사용 가능 여부를 확인해요. `recorder` 같은 일부 API는 도구가 선언하는 기기 기능도 필요해요. `packages/core/src/host-v1/apis.ts`에 전체 목록이 있고 [Host API](/info/host-api.html)에 각각 설명돼 있어요. 메서드 추가는 마이너 버전 변경이에요. 삭제나 변경은 메이저 버전 변경이며, v2가 나와도 v1은 계속 동작해요.

### 4. 에셋 ID는 영구적이에요

`lolly/logo/primary`는 계약이에요. 게시된 ID는 절대 바뀌거나 재사용되지 않아요. 바이트가 바뀌면 에셋 항목의 `version`을 올려요. 대체할 때는 `deprecated: true`를 설정하고 선택적으로 `replacedBy`도 설정해요. 기존 참조는 항상 해석되므로 저장된 세션과 공유 링크는 수년간 계속 동작해요.

### 5. URL 모드는 핵심 기능이에요

모든 입력을 URL 매개변수로 표현할 수 있어서 링크가 곧 완성된 파일이에요:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![그 링크만 있으면 다른 것은 없어도 완성된 파일이 돼요](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

매개변수를 바꾸면 다른 파일이 나와요. 이 팔레트는 기준 색상 하나, 색상 조화, 단계 수로 이뤄져요:

![네 가지 색조에 걸친 아홉 단계로, 모두 링크에 담긴 기준 색상 하나에서 나왔어요](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

CLI는 인수에서 같은 URL 상태를 만들고 같은 파이프라인을 실행하므로 앱과 동작이 달라질 수 없어요. `engine/src/url-mode.ts`가 URL 상태를 파싱하고 직렬화해요. 예약된 이름(`format`, `width`, `dpi`, `c2pa`, `z` 등)은 도구에 전달되지 않아요. [예약된 URL 매개변수](/info/url-parameters.html)에 전체 목록이 있어요. 에셋 입력은 `id`로 전달되고 템플릿을 채우기 전에 `host.assets.get()`을 통해 해석돼요.

### 6. 저장은 브리지를 거쳐요

웹 앱은 IndexedDB, Tauri는 파일 시스템, CLI는 메모리를 사용해요. 도구는 `host.state.save(slot, data)`와 `host.state.load(slot)`에만 접근하며 `localStorage`에는 접근하지 않아요. 계정 없이도 도구마다 이름을 붙인 세션을 여러 개 보관할 수 있어요. 브리지만이 유일한 접점이므로 상태도 옮길 수 있어요. `shells/web/src/data-transfer.ts`는 상태를 하나의 `lolly-backup` 파일로 내보내며, 다른 어느 설치 환경에서든 가져올 수 있어요([데이터 전송](/info/data-transfer.html)). [Sync](/info/sync.html)는 같은 번들을 사용자가 고른 저장소로 보내요.

### 7. 성숙도 태그가 도구의 상태를 알려줘요

모든 도구는 `status: official | community | experimental`을 선언해요. 갤러리는 상태별로 정렬해요. 실험적 도구는 기본적으로 내보내기에 워터마크를 넣어요. 호출자가 `watermark: false`를 전달하지 않는 한 런타임이 워터마크를 켜요. 기기 내 도구는 제외돼요. 팀 자체 카탈로그 절차는 이 태그를 바탕으로 운영돼요.

### 8. 입력 타입은 매니페스트에서 지정해요

입력은 `type`을 선언해요. `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table`, `file` 중 하나예요. 호스트가 타입별 컨트롤을 렌더링하므로 도구는 컨트롤 코드를 작성하지 않아요. 어떤 입력에도 `bindToProfile`을 지정할 수 있어요. 특히 중요한 타입은 세 가지예요:

- **`asset`**은 `filter`, `allowUpload`와 함께 에셋 시스템으로 연결되는 브리지예요. `allowUpload: false`는 슬롯을 라이브러리 에셋으로 제한해요. 사용자 업로드도 라이브러리와 같은 `AssetRef` 구조를 써요.
- **`blocks`**는 측면 패널에서 편집하는 반복 필드 그룹으로, Meeting Planner, Wayfinding, Diagrams 등에서 사용해요. 렌더링된 블록을 클릭하면 해당 행에 포커스가 가요.
- **`file`**은 Lolly Strip Hidden Data나 Compress 같은 기기 내 유틸리티를 위해 사용자 파일을 메모리에 보관하고, **`vector`**는 고정된 숫자 집합을 하나의 컨트롤로 묶어요.

### 9. 템플릿에는 로직이 없어요

템플릿은 Handlebars이므로 개발자가 아니어도 작성할 수 있어요. `{{x}}`는 이스케이프하고, `{{{x}}}`는 이스케이프하지 않겠다는 명시적 선택이에요. 로직은 검토할 수 있도록 `hooks.js`에 있어요. 많은 템플릿이 훅에서 계산한 마크업에 `{{{`를 사용하므로 각 훅은 넘기는 내용을 이스케이프해야 해요. 헬퍼에는 `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing`, `media`가 있고, 같은 도구의 `.ics`, `.vcf`, `.csv` 템플릿을 위한 `icsStamp`, `rfcText`, `csvCell`, `arrow`도 있어요. [템플릿과 렌더링](/info/tool-rendering.html)에서 다뤄요.

### 10. 도구가 다른 도구를 조합해요

도구는 도구끼리 임포트하지 않고도 다른 도구의 렌더링을 임베드할 수 있어요. 엔진이 이 조합을 해석해요. 매니페스트에서 `composes: [{ id, tool, inputs }]`를 선언하고 `{{asset <id>}}`로 하위 도구를 배치할 수 있어요. 이동 가능한 임베드 URL(`https://lolly.tools/tool/<id>.svg?…`)은 하위 도구를 로컬에서 렌더링해요. Lolly Design은 이 방식으로 실시간 QR 코드나 차트를 배치해요. 상위 출력이 SVG나 PDF이면 하위 SVG는 벡터로 유지돼요. 하위 출력은 중간 결과물이므로 워터마크나 스탬프를 붙이지 않아요. 하위 도구를 렌더링할 수 없는 셸은 슬롯을 비워 두고 상위 도구는 계속 렌더링해요. [조합과 브랜드 오버레이](/info/tool-composition.html)에 자세한 내용이 있어요.

<!--i:eti-scissors-->
## 하지 않기로 한 것

- **템플릿에 임의의 JavaScript를 넣지 않아요.** 로직은 `hooks.js`에 있어요.
- **에셋 서버를 필수로 두지 않아요.** 사용자는 앱의 Assets에 자기 파일을 추가하고 작업물을 세션으로 넘겨요. 입력과 설정은 공유 링크로, 업로드 파일도 함께 옮길 때는 `.lolly` 파일로 전달해요. 공유 세션은 도구의 선택기에서 템플릿이 될 수 있어요. 관리 체계를 갖춘 카탈로그가 필요한 조직은 Lolly Work의 카탈로그, 승인, 정책을 쓰거나 git에서 브랜드 팩을 관리하고 변경을 검토할 수 있어요.
- **접근 제어를 강제하지 않아요.** 개방형 앱은 기본적으로 공개돼 있어요. 성숙도 태그와 워터마크가 브랜드 위험을 나타내요. 팀이 원하면 Lolly Work가 조직 로그인, 역할, 정책을 제공해요.
- **중앙 데이터베이스를 두지 않아요.** 사용자 상태는 각 기기에 있고, 선택적 Sync는 사용자가 고른 저장소로 복사하며 Lolly 데이터베이스로는 보내지 않아요.
- **도구와 엔진이 코드 경로를 공유하지 않아요.** 엔진과 커뮤니티 도구는 오픈 소스예요. 비공개 `brands/suse/` 같은 브랜드 팩은 자체 조건에 따라 자체 도구와 카탈로그를 담아요. 어떤 도구도 `engine/`에서 임포트하지 않으므로 분리가 명확하게 유지돼요.

<!--i:eti-refresh-->
## 한 번의 렌더링 수명 주기

누군가 `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`를 열어요:

1. **시작.** 웹 앱이 IndexedDB를 열고 기능 브리지를 만들고 도구 및 에셋 카탈로그를 동기화해요. 오프라인이면 캐시에서 로드해요.
2. **라우팅.** 경로가 `qr-code`의 도구 보기를 선택하고 쿼리를 초기값으로 사용해요.
3. **로드.** `loadTool`이 `tool.json`을 가져와 스키마에 맞는지 검증하고 템플릿, 스타일, 훅을 가져와요.
4. **링크 파싱.** `parseUrlState`가 매개변수를 입력값으로 바꿔요. `?logo=lolly/logo/primary` 같은 에셋 참조는 아직 해석되지 않은 `{ id }`가 돼요.
5. **런타임 시작.** `createRuntime(tool, host, initialValues)`가 프로필 데이터, 기본값, 링크로 입력 모델을 만들고 에셋 참조를 해석하고 훅을 로드한 다음 `onInit`을 호출해요.
6. **렌더링.** 셸이 런타임을 구독하고 모델에서 컨트롤을 그린 다음 채워진 템플릿을 `#tool-canvas`에 써요.
7. **상호작용.** 글을 입력하면 `runtime.setInput`이 호출되어 제약 조건을 적용하고 `onInput`을 호출한 다음 템플릿을 다시 채우고 그려요.
8. **내보내기.** **Download**가 `runtime.export(node, format)`을 호출하고 셸의 `host.export`가 파일을 만들어요. 래스터, DOM 워커가 만든 벡터, PDF, 문서 또는 `schemas/tool.schema.json`에 있는 다른 형식 중 하나예요. 물리 단위는 형식별로 변환돼요. 메타데이터와 Content Credentials는 형식이 지원하는 경우 임베드돼요. 실험적 도구의 워터마크는 도구가 아니라 호스트가 넣어요. [템플릿과 렌더링](/info/tool-rendering.html)과 [파일 내보내기](/info/exporting.html)에서 내보내기 단계를 다뤄요.

![?options로 여는 내보내기 패널: 파일 이름과 형식의 쌍, 출력 크기, 파일을 쓰는 컨트롤](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

같은 수명 주기가 Tauri에서도, 헤드리스 DOM을 사용하는 CLI에서도 실행되며 CLI 출력은 파일이나 stdout으로 가요.

<!--i:eti-stamp-->
## 라이선스

`engine/`, `shells/`, `services/`, `schemas/`, 문서 생성기를 포함한 코드는 MPL-2.0이며, 하나의 공개 저장소인 [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly)에 있어요. 문서의 본문은 CC BY-SA 4.0이에요. 브랜드 팩은 각 팩의 `NOTICE.md`에 자체 조건을 담아요. 커뮤니티 도구는 MPL-2.0이며, 비공개 SUSE 팩은 SUSE 독점 소유예요. [소개](/info/about.html)에 전체 라이선스 안내가 있어요.
