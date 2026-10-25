# Lolly 아키텍처

![Lolly 아이콘 - 초록색과 흰색의 커다란 막대사탕](/info/icon.svg)

이 페이지는 Lolly의 코드를 바꾸는 사람을 위한 것이에요. 엔진, 셸, 도구 팩이 어떻게 맞물리는지, 저장소 어디에 있는지, 모든 변경을 제약하는 약속을 다뤄요. Lolly가 무엇을 하고 누가 쓰는지 알고 싶다면 먼저 [Lolly의 작동 방식](/info/how-lolly-works.html)을 읽으세요.

더 깊이 들어가는 두 개의 자료가 있어요. [`engine/README.md`](../engine/README.md)는 코드에서 생성된 엔진의 모듈별 지도예요. [위협 모델과 신뢰 경계](/info/threat-model.html)는 같은 아키텍처를 신뢰 경계로 읽으며, 엔진이 무엇을 신뢰할 수 없는 것으로 다루는지에 관한 모든 질문을 위한 페이지예요.

## 큰 그림

도구는 맨 위의 데이터예요. 가운데의 엔진은 어떤 플랫폼도 몰라요. 아래의 셸들은 하나의 계약을 구현하고, 카탈로그가 콘텐츠를 공급해요.

![도구가 매니페스트, 템플릿, 훅을 공유 엔진에 제공해요. 웹, Tauri, 터미널 셸이 HostV1 기능 브리지를 구현하고 카탈로그에서 도구와 에셋을 읽어요.](/info/diagrams/concepts/platform-layers.svg)

순수한 데이터와 Handlebars로 설명할 수 있다면 **엔진**에 속해요. DOM, 파일 시스템, 네트워크 또는 브라우저나 운영 체제 API를 건드린다면 셸 쪽 브리지인 **호스트**에 속해요. 엔진은 오픈 소스이며, 특정 브랜드나 플랫폼을 아는 것은 엔진에 들어가지 않아요.

## 저장소 구성

Lolly는 저장소 하나예요. 아래의 모든 디렉터리는 그 안의 일반 디렉터리이지만, SUSE 도구 팩과 카탈로그를 담은 **비공개** git 서브모듈 `brands/suse`는 예외이며 공개 클론은 이를 가져오지 않아요. 빌드가 어떤 팩을 읽는지는 콘텐츠 프로필(`profiles.json`)이 정하며, 전역으로 전환하는 것이 아니라 프로세스별로 결정돼요. [빌드 가이드](/info/build-guide.html)에 클론 명령과 비공개 팩 안의 변경을 커밋하는 방법이 있어요.

| 디렉터리 | 담는 것 |
|---|---|
| `engine/` | 플랫폼 중립 코어: 로더, 런타임, 입력, 템플릿, URL 모드, 단위, 형식 모듈 |
| `shells/` | 웹 앱, Tauri 데스크톱 및 모바일 앱, CLI, TUI, 브라우저 확장 프로그램 |
| `packages/` | 도구 작성자 SDK(`@lolly-tools/core`), 공유 Node 셸 구성 요소, 문서 렌더러 등 |
| `community/` | 브랜드 중립 도구와 공유 이모지 팩 |
| `brands/` | 브랜드 팩: `lolly-demo`(lolly.tools가 실행하는 디자인 시스템인 Lolly Demo), `lolly-start`(빈 스타터), 비공개 `suse` |
| `services/` | 선택 사항인 MCP, 인증서, Penpot 서비스와 이들이 공유하는 서버 코드 |
| `schemas/` | 도구 매니페스트, 에셋 항목, 에셋 참조용 JSON Schema |
| `scripts/`, `tests/`, `docs/`, `api/` | 빌드 및 카탈로그 스크립트, 엔진 테스트 모음, 이 문서, 생성된 서버리스 번들 |

::: details 가장 먼저 만나는 엔진과 셸 파일
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

저장소 루트에는 `tools/`나 `catalog/` 디렉터리가 없어요. `packages/node-shell/src/content-roots.ts`가 요청받을 때 `profiles.json`에서 "도구 `<id>`가 어디에 있는지"와 "카탈로그가 어디에 있는지"를 알려줘요. 실제 `tools/`와 `catalog/` 쌍은 `dist/`, RPM 페이로드, 컨테이너 이미지 같은 빌드 출력에만 쓰여요. 브라우저가 이 두 경로를 HTTP로 가져오기 때문이에요.

## Lolly가 실행되는 곳

모든 환경이 같은 엔진과 같은 도구 파일을 사용해요.

- **웹 앱.** 서비스 워커가 도구와 에셋을 캐시하고 나면 오프라인에서 작동하는 프로그레시브 웹 앱이에요. 계정이 필요 없고, 상태는 각 기기의 IndexedDB에 있어요. 하나의 반응형 레이아웃이 데스크톱과 휴대폰에 쓰여요. 휴대폰에서는 컨트롤이 시트가 되고 내보내기 컨트롤은 떠 있는 알약에서 열려요.
- **데스크톱 및 모바일 앱.** 같은 웹 앱의 Tauri 패키지이며, 네이티브 파일 대화상자, 파일 시스템 상태, 완전한 오프라인 사용을 갖췄어요.
- **CLI.** `lolly <tool-id> --input=value --output=file.png`는 헤드리스 DOM에서 같은 엔진을 로드하고 파일을 써요. 별도의 구현이 아니라 다른 전송 방식의 URL 모드예요. [CLI](/info/cli.html)를 참고하세요.
- **TUI.** CLI의 브리지를 재사용하는 전체 화면, 키보드 중심의 터미널 앱이에요. 저장된 세션을 디스크에 보관하고(앱이 설치되어 있으면 데스크톱 앱의 자체 폴더, 아니면 `~/.lolly` 아래), 형식에 필요할 때만 범위가 제한된 헤드리스 브라우저를 시작해요. [TUI](/info/tui.html)를 참고하세요.

![데스크톱 분할 보기: 왼쪽에는 매니페스트에서 생성된 컨트롤, 오른쪽에는 실시간 캔버스](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

같은 도구가 휴대폰 너비에서도 두 번째 레이아웃이 필요 없어요. 컨트롤은 위쪽 시트가 되고 미리보기가 화면을 차지해요.

![430px 너비 화면의 오디오그램: 위쪽에 컨트롤 시트, 아래에 완성된 정사각형 아트워크, 떠 있는 내보내기 알약](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

웹 앱에는 **Batch**(`#/batch`, `shells/web/src/pro/`)도 포함돼요. 하나 또는 여러 도구에 걸쳐 많은 행을 한꺼번에 렌더링하는 스프레드시트식 그리드이며, [Batch와 Multi-edit](/info/batch.html#make-many-versions-of-one-design)이 Batch를 다뤄요. **Settings → Capabilities**는 플랫폼이 할 수 있다고 선언하는 모든 것을 정리해요.

![새로 설치한 상태의 Batch: 도구를 기다리는 빈 행 하나와, 데이터가 들어오기 전부터 갖춰진 스프레드시트 화면 및 Render 버튼](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

## 아키텍처 원칙

이 결정들은 확정된 것이에요. 이 중 어느 것을 바꾸든 코드베이스의 다른 모든 결정을 좌우하므로 큰일이에요.

### 1. 선언적 도구, 명령형 탈출구를 갖춘

도구는 매니페스트(`tool.json`), 템플릿(`template.html`), 선택 사항인 `hooks.js`예요. **매니페스트가 입력을 선언하며** 템플릿은 그렇지 않아요. 입력은 Handlebars 토큰에서 추론되지 않아요. 대부분의 도구는 매니페스트와 템플릿만으로 이루어지며, 그래서 개발자가 아닌 사람도 작성할 수 있어요.

![Street Map의 컨트롤 모음: 도시 드롭다운, 테마 선택, 굵기 슬라이더, 색상 트리거가 모두 매니페스트의 한 줄에서 그려져요](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

QR 인코딩이나 차트 구성처럼 값을 계산하는 도구는 훅을 추가해요. 기능 브리지가 주입된 채로 런타임이 호출하는 이름 붙은 수명 주기 함수예요. 훅은 이식성 계약이지 보안 샌드박스가 아니며, 시간 예산 안에서 실행돼요. 훅에 페이지 전역이 없다고 입증된 도구는 `isolate: true`를 갖고 Worker에서 실행돼요. [도구 훅](/info/tool-hooks.html)에 수명 주기와 예산이 있고, [위협 모델](/info/threat-model.html)이 페이지 내 실행기가 무엇을 가두고 가두지 않는지 설명해요.

### 2. 도구와 에셋은 데이터이지, 번들된 코드가 아닙니다

웹과 Tauri 앱은 부팅할 때 도구 및 에셋 카탈로그를 가져와 캐시하고 있는 것으로 작업하므로, 새 도구나 에셋에 앱 릴리스가 필요 없어요. 에셋 바이트는 SHA-256 체크섬이 있고, 에셋의 `id`와 `version`이 캐시 무효화를 이끌어요.

### 3. 기능 브리지는 도구가 보는 유일한 API예요

도구는 템플릿 밖의 DOM을 건드리지 않고, `fetch`를 직접 호출하지 않으며, 파일 시스템을 읽지 않아요. 버전이 있는 `host.*` 메서드를 호출해요. 계약의 표준 정의는 도구 작성자 SDK `@lolly-tools/core`의 `packages/core/src/host-v1.ts`라서 제3자가 엔진에 의존하지 않고 이에 맞춰 만들 수 있고, `engine/src/bridge/host-v1.ts`는 그 타입을 다시 내보내요.

| 필수 API | 하는 일 |
|---|---|
| `host.profile` | 사용자의 세부 정보. `bindToProfile`을 통해 입력을 미리 채워요 |
| `host.assets` | 카탈로그 쿼리, 에셋 확인, 호스트의 선택기 |
| `host.state` | 입력 슬롯 저장 및 불러오기: 웹은 IndexedDB, Tauri는 파일 시스템, CLI는 메모리 |
| `host.clipboard` | 플랫폼별 대체 수단과 함께 텍스트나 이미지를 클립보드에 써요 |
| `host.export` | 렌더 대상을 래스터화하거나 직렬화하며, 온디바이스 파일 변환 경로 |
| `host.log` | 호스트로 레벨별 로깅 |

다른 모든 API는 선택 사항이며 추가형이에요. `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` 등 많아요. 도구의 매니페스트는 `requires` 아래에 훅이 확인 없이 호출하는 선택 API를 나열하고, 그중 하나가 없는 호스트는 도구 마운트를 거부하며, 나머지는 훅이 기능을 감지해요. `recorder` 같은 일부는 도구가 선언하는 기기 기능도 필요해요. `packages/core/src/host-v1/apis.ts`가 모두 나열하고 [Host API](/info/host-api.html)가 각각을 설명해요. 메서드 추가는 마이너 버전이며, 제거하거나 변경하는 것은 메이저 버전이고, v2가 나와도 v1은 계속 동작해요.

### 4. 에셋 ID는 영원해요

`lolly/logo/primary`는 계약이에요. 게시되면 ID는 바뀌지 않고 재사용되지 않아요. 바이트가 바뀌면 에셋 항목의 `version`이 올라가고, 대체품은 `deprecated: true`와 선택적으로 `replacedBy`를 설정하므로 기존 참조가 항상 확인돼요. 그래서 저장된 세션과 공유 링크가 수년간 작동해요.

### 5. URL 모드는 최우선 요소입니다

모든 입력은 URL 매개변수로 표현할 수 있으므로 링크는 완성된 파일이에요.

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![아무것도 더하지 않은 그 링크 자체가 완성된 파일이에요](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

매개변수를 바꾸면 다른 파일이 돼요. 이 팔레트 전체가 기준 색상 하나, 하모니 하나, 단계 수 하나예요.

![링크에 담긴 단 하나의 씨앗 색상에서 자라난 네 가지 색조에 걸친 아홉 단계](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

CLI는 인수에서 같은 URL 상태를 만들고 같은 파이프라인을 실행하므로 CLI가 앱과 어긋날 수 없어요. `engine/src/url-mode.ts`가 구문 분석과 직렬화를 맡고, 예약된 이름 집합(`format`, `width`, `dpi`, `c2pa`, `z` 등)은 도구에 절대 전달되지 않으며 [예약된 URL 매개변수](/info/url-parameters.html)가 모두 나열해요. 에셋 입력은 `id`로 전달되고 템플릿이 채워지기 전에 `host.assets.get()`을 통해 확인돼요.

### 6. 저장소는 브리지를 거쳐요

웹 앱은 IndexedDB, Tauri는 파일 시스템, CLI는 메모리를 써요. 도구는 `host.state.save(slot, data)`와 `host.state.load(slot)`만 보고 `localStorage`는 절대 보지 않아요. 사람들은 계정 없이 도구마다 이름 붙은 여러 세션을 유지할 수 있어요. 브리지가 유일한 접점이므로 그 상태는 이식 가능하기도 해요. `shells/web/src/data-transfer.ts`가 이를 `lolly-backup` 파일 하나로 다시 읽어내고 다른 설치에서 가져올 수 있으며([데이터 이전](/info/data-transfer.html)), [Sync](/info/sync.html)는 같은 번들을 사용자가 고른 저장소로 보내요.

### 7. 성숙도 태그는 도구가 무엇인지 알려줘요

모든 도구는 `status: official | community | experimental`을 선언해요. 갤러리는 상태순으로 정렬하며, 실험적 도구는 기본적으로 내보내기에 워터마크를 넣어요. 호출자가 `watermark: false`를 전달하지 않는 한 런타임이 워터마크를 켜고, 온디바이스 도구는 제외돼요. 팀이 카탈로그 주위에 두는 프로세스는 무엇이든 이 위에 얹혀요.

### 8. 입력은 매니페스트에서 타입이 정해져요

입력은 `type`을 선언해요. `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table`, `file` 중 하나예요. 호스트가 타입별로 컨트롤을 렌더링하므로 도구는 컨트롤 코드를 쓰지 않으며, 어떤 입력이든 `bindToProfile`을 가질 수 있어요. 세 가지가 가장 비중이 커요.

- **`asset`**은 `filter`와 `allowUpload`와 함께 에셋 시스템으로 가는 브리지예요. `allowUpload: false`는 슬롯을 라이브러리 에셋으로 제한하며, 사용자 업로드는 라이브러리와 같은 `AssetRef` 형태를 공유해요.
- **`blocks`**는 사이드 패널에서 편집하는 반복 필드 그룹으로 Meeting Planner, Wayfinding, Diagrams 등이 사용해요. 렌더링된 블록을 클릭하면 해당 행에 포커스가 가요.
- **`file`**은 Strip Hidden Data, Compress 같은 온디바이스 유틸리티를 위해 사용자의 파일을 메모리에 보관하고, **`vector`**는 고정된 숫자 집합을 하나의 컨트롤로 묶어요.

### 9. 템플릿은 로직이 없어요

템플릿은 Handlebars이며 개발자가 아닌 사람도 쓸 수 있도록 선택됐어요. `{{x}}`는 이스케이프하고 `{{{x}}}`는 명시적 옵트인이에요. 로직은 명시적이고 검토 가능한 `hooks.js`에 있어요. 많은 템플릿이 훅이 계산한 마크업에 `{{{`를 쓰므로 각 훅은 넘기는 것을 이스케이프해야 해요. 헬퍼는 `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing`, `media`이고, 짝이 되는 `.ics`, `.vcf`, `.csv` 템플릿을 위한 `icsStamp`, `rfcText`, `csvCell`, `arrow`가 더해져요. [템플릿과 렌더링](/info/tool-rendering.html)이 이를 다뤄요.

### 10. 도구가 도구를 합성합니다

도구는 도구 간 import 없이 다른 도구의 렌더링을 임베드할 수 있어요. 엔진이 구성을 해석해요. 매니페스트가 `composes: [{ id, tool, inputs }]`를 선언하고 `{{asset <id>}}`로 자식을 배치할 수 있으며, 이식 가능한 임베드 URL(`https://lolly.tools/tool/<id>.svg?…`)이 자식을 로컬에서 렌더링해요. Design이 실시간 QR 코드나 차트를 배치하는 방식이에요. SVG 자식은 SVG 또는 PDF 부모 안에서 벡터로 유지돼요. 자식은 중간 산출물이므로 워터마크나 스탬프가 찍히지 않고, 자식을 렌더링할 수 없는 셸은 슬롯을 비워 두지만 부모는 여전히 렌더링돼요. [구성과 브랜드 오버레이](/info/tool-composition.html)에 자세한 내용이 있어요.

## 하지 않기로 한 것

- **템플릿에 임의의 JavaScript를 넣지 않아요.** 로직은 `hooks.js`에 있어요.
- **필수 에셋 서버가 없어요.** 사람들은 앱의 Assets에 자신의 파일을 추가하고 작업을 세션으로 넘겨요. 입력과 설정은 공유 링크로, 업로드까지 함께 가야 하면 `.lolly` 파일로 전달해요. 공유 세션은 도구 선택기의 템플릿이 될 수 있어요. 관리되는 카탈로그를 원하는 조직은 Lolly Work의 카탈로그, 승인, 정책을 쓰거나 git에서 브랜드 팩을 관리하며 거기서 변경을 검토할 수 있어요.
- **강제된 접근 제어가 없어요.** 열린 앱은 기본적으로 공개이며, 성숙도 태그와 워터마크가 브랜드 위험을 맡아요. 조직 로그인, 역할, 정책은 팀이 원할 때 Lolly Work에서 와요.
- **중앙 데이터베이스가 없어요.** 사용자 상태는 각 기기에 있고, 선택 사항인 Sync는 사용자가 고른 저장소로 복사하며 Lolly 데이터베이스로는 절대 가지 않아요.
- **도구와 엔진이 코드 경로를 공유하지 않아요.** 엔진과 커뮤니티 도구는 오픈 소스이고, 비공개 `brands/suse/` 같은 브랜드 팩은 자체 약관에 따라 자체 도구와 카탈로그를 가져요. 어떤 도구도 `engine/`에서 import하지 않으므로 분리가 깔끔하게 유지돼요.

## 렌더링 한 건의 라이프사이클

누군가 `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`를 열어요.

1. **부팅.** 웹 앱이 IndexedDB를 열고, 기능 브리지를 만들고, 도구 및 에셋 카탈로그를 동기화하거나 오프라인이면 캐시에서 불러와요.
2. **라우팅.** 경로가 `qr-code`의 도구 보기를 선택하고, 쿼리가 초기값이 돼요.
3. **로드.** `loadTool`이 `tool.json`을 가져와 스키마로 검증하고 템플릿, 스타일, 훅을 가져와요.
4. **링크 구문 분석.** `parseUrlState`가 매개변수를 입력값으로 바꿔요. `?logo=lolly/logo/primary` 같은 에셋 참조는 확인되지 않은 `{ id }`가 돼요.
5. **런타임 시작.** `createRuntime(tool, host, initialValues)`가 프로필 데이터, 기본값, 링크로 입력 모델을 만들고, 에셋 참조를 확인하고, 훅을 불러와 `onInit`을 호출해요.
6. **렌더링.** 셸이 런타임을 구독하고, 모델로 컨트롤을 그리고, 채워진 템플릿을 `#tool-canvas`에 써요.
7. **상호작용.** 입력하면 `runtime.setInput`이 호출되어 제약을 적용하고, `onInput`을 호출하고, 템플릿을 다시 채우고 다시 그려요.
8. **내보내기.** **Download**가 `runtime.export(node, format)`를 호출하고 셸의 `host.export`가 파일을 만들어요. 래스터, DOM 워커의 벡터, PDF, 문서, 또는 `schemas/tool.schema.json`의 다른 형식 중 하나예요. 물리 단위는 형식별로 변환되고, 형식이 담을 수 있는 곳에는 메타데이터와 Content Credentials가 임베드돼요. 실험적 도구의 워터마크는 도구가 아니라 호스트가 넣어요. [템플릿과 렌더링](/info/tool-rendering.html)과 [파일 내보내기](/info/exporting.html)가 내보내기 단계를 다뤄요.

![?options가 여는 내보내기 패널: 파일 이름과 형식 쌍, 출력 크기, 파일을 쓰는 컨트롤](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

같은 수명 주기가 Tauri와, 헤드리스 DOM의 CLI에서도 실행되며, CLI에서는 출력이 파일이나 stdout으로 가요.

## 라이선스

`engine/`, `shells/`, `services/`, `schemas/`, 문서 생성기를 포함한 코드는 MPL-2.0이며 공개 저장소 하나인 [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly)에 있어요. 문서 본문은 CC BY-SA 4.0이에요. 브랜드 팩은 각 팩의 `NOTICE.md`에 자체 약관이 있어요. 커뮤니티 도구는 MPL-2.0이고 비공개 SUSE 팩은 SUSE의 독점이에요. [소개](/info/about.html)에 전체 라이선스 안내가 있어요.
