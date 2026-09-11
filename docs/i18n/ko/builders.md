# 빌더를 위한 Lolly

기술 문서예요 - 도구를 제작하거나, Lolly를 파이프라인에 통합하거나, 직접 호스팅하거나, 플랫폼을 확장하려는 모든 분을 위한 문서예요.

**이 문서가 여러분에게 주는 것.** 도구를 한 번 만들어 두면 그 요청이 다시는 여러분에게 돌아오지 않아요. 오후 시간을 통째로 잡아먹는 "이것 좀 만들어 줄 수 있어요?"라는 반복적인 부탁은, 다른 사람이 직접--정확하게, 여러분 없이도--채워 넣을 수 있는 템플릿이 돼요. 여러분의 결과물은 평범한 HTML/CSS/JS라서 버전 관리가 되고, 변경 사항을 비교할 수 있고, 리뷰할 수 있고, 벤더 종속이 없는 개방형 엔진 위에서 동작하기 때문에 계속 여러분의 것으로 남아요. 생산 작업을 자동화하고 나면 여러분의 시간은 만 번째 내보내기가 아니라 흥미로운 문제를 푸는 데 쓰이게 돼요.

Lolly는 여러 **셸**(web PWA, Tauri 데스크톱/모바일, CLI, TUI)에서 동일한 렌더링 경로를 실행하는, 플랫폼에 종속되지 않는 **엔진**이에요. 도구는 **번들된 코드가 아니라 데이터**예요--매니페스트와 템플릿, 그리고 선택적인 훅으로 구성되기 때문에 새 도구는 앱 업데이트 없이 배포돼요. 아키텍처는 [개요](/info/overview.html)에서 시작한 다음, 여러분이 만들려는 것에 맞는 트랙을 따라가 보세요.

이 플랫폼이 처음이신가요? **[빠른 시작](/info/quickstart.html)**에서 깊이 들어가기 전에 브랜드와 첫 렌더링을 먼저 준비할 수 있어요.

## 아키텍처 이해하기



- **[개요](/info/overview.html)** - Lolly가 존재하는 이유, 엔진/셸/도구의 분리, 기능 브리지, 그리고 확정된 아키텍처상의 결정 사항.
- **[디자인 토큰](/info/design-tokens.html)** - 브랜드가 표현되는 DTCG 토큰 모델과, 도구가 이를 사용하는 방식.

## 도구 제작하기

아래의 컨트롤은 모두 `tool.json`에 선언된 입력에서 생성된 거예요. 매니페스트에 한 줄 쓰면 호스트가 위젯을 그리고, 같은 모델이 CLI와 URL까지 움직여요.

![One declared input, one generated control: a url, a colour, a select, a number, a boolean](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code&width=1440&height=900&dpi=192&waitMs=2000&cropSelector=.tool-inputs&walker=1&format=svg&dark=1&filename=aud-manifest-controls)

이 방식은 컨트롤 다섯 개에서 끝나지 않아요. 입력에 `section`을 주면 호스트가 그것을 접어두기 때문에, D3 Chart Studio처럼 입력이 50개인 도구도 열었을 때는 짧은 컨트롤 묶음으로 보이고, 나머지는 이름이 붙은 그룹 뒤에 정리돼요.

![The D3 sidebar - a handful of primary controls, then Data, Columns, Chart, Axes and the other sections collapsed into one line each](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=1600&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-d3-sections)

- **[도구 제작 가이드](/info/authoring-tools.html)** - 매니페스트, 템플릿, 스타일, 훅, 조합, 게시까지 다루는 전체 가이드.
- **[에셋 제작 가이드](/info/authoring-assets.html)** - 카탈로그 에셋, 티어, 로케일, 팔레트, 테마 지원 아이콘, 폰트.
- **[Host API](/info/host-api.html)** - 모든 도구가 그 위에서 작성되는 `HostV1` 기능 브리지(도구가 볼 수 있는 유일한 API)예요.
- **[URL 모드](/info/url-mode.html)** - 모든 입력을 URL 파라미터로 표현하는 방법; 예약된 파라미터, 압축 인코딩, 패킹된 링크.

## 실행 및 통합

- **[CLI](/info/cli.html)** - 헤드리스 렌더링; `--foo=bar` 형태의 argv로 구동되는, GUI와 동일한 렌더링 경로예요.
- **[TUI](/info/tui.html)** - 대화형 터미널 셸.
- **[MCP 서버](/info/mcp.html)** - AI 에이전트가 도구를 찾아 실행할 수 있게 해 주는 네이티브 엔드포인트.
- **[AI 에이전트](/info/ai-agents.html)** - 모델에서 Lolly를 구동하는 방법: URL이 곧 API예요.
- **[Chrome 확장 프로그램](/info/extension.html)** - 실시간 URL을 재사용 가능한 에셋으로 캡처해요.

## 배포 및 운영

- **[빌드 가이드](/info/build-guide.html)** - CLI, TUI, 데스크톱, 모바일 등 모든 대상을 빌드해요.
- **[배포](/info/deployment.html)** - web 앱, 각 앱, 백엔드 서비스; 각 구성 요소가 실행되는 위치.
- **[구성](/info/configuration.html)** - 프로필, 브랜드 팩, 기능 게이팅, 기능 플래그, 카탈로그 검증.

## 신뢰와 데이터

권리와 저작자 표시도 다른 입력과 똑같아요. Embed & Track Image는 제작자, 저작권, 라이선스, 연락처 필드를 선언하고, 내보내기가 그 값을 파일 자체의 메타데이터와 C2PA 매니페스트에 기록해요.

![The Embed and Track Image controls - creator, copyright, a licence dropdown, contact and title, filled from the link](/t/url-shot?url=%2F%23%2Ftool%2Fclaim%3Fcreator%3DAda%2520Lovelace%26title%3DEngine%2520Notes&width=1440&height=1200&dpi=192&waitMs=2200&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-rights-fields)

- **[Content Credentials Identity](/info/content-credentials-identity.html)** - 온디바이스 C2PA를 위한 CA 발급 서명; 엔진 계약과 운영자 런북.
- **[데이터 이전](/info/data-transfer.html)** - `lolly-backup` 번들: 봉투 형식, 무결성, 셸 간 보장 사항.
- **[소개](/info/about.html)** - 프로젝트, 라이선스 경계, 리포지토리.
