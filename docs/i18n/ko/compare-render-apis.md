# Lolly와 렌더링 API

_마지막 확인: 2026년 11월 5일._

API를 통해 템플릿에서 이미지를 생성한다면, 이 페이지에서 그 제작을 자신의 기기, CI 또는 직접 통제하는 서버에서 실행할 때 무엇이 달라지는지 설명해요. [호스팅 렌더링 API에서 이전하기](/info/work-move-from-render-api.html)에 단계가 나와 있어요.

<!--i:eti-award-->
## 호스팅 렌더링 API가 더 잘하는 것

[Bannerbear](https://www.bannerbear.com/)와 [Placid](https://placid.app/)는 관리형 서비스예요. 사용자는 요청을 보내고, 서버는 다른 사람이 운영해요.

- **운영할 것이 없어요.** 서버, 데이터베이스, 저장소, 업데이트, 용량 계획을 맡을 필요가 없어요.
- 바로 수정해서 쓸 수 있는 템플릿이 있는 **호스팅 템플릿 편집기**를 제공해요.
- **하나의 API로 더 많은 출력 유형을 제공해요.** 둘 다 동영상과 PDF 엔드포인트를 공개하며, Bannerbear는 애니메이션 출력, WebP와 AVIF, 스크린샷, AI 배경 제거도 문서화해요.
- **자체 통합과 지원을 제공해요.**

이런 방식이 필요하다면 이 서비스들은 좋은 선택이에요.

<!--i:eti-home-->
## 자체 호스팅으로 얻는 것

- **콘텐츠가 자신의 시스템에 남아요.** 입력, 에셋, 출력은 직접 선택한 인프라에 있어요. 기기나 CI에서 렌더링할 때는 서비스가 필요 없어요.
- **규칙은 도구 안에 있어요.** 색상, 서체, 로고, 잠긴 입력은 [디자인 시스템](/info/brand-studio.html)에서 오므로 호출자는 허용된 것만 바꿀 수 있어요. [Lolly Work](/info/compare.html#what-runs-where)는 모든 요청에 도구 공개 범위와 입력 정책을 적용해요.
- **어디서나 같은 도구예요.** 도구는 노트북, CI 작업, 서버에서 같은 입력으로 렌더링해요. 사람들은 앱에서 같은 도구를 편집할 수 있어요.
- **기록을 직접 보유해요.** [렌더링 영수증](/info/work-renders.html#evidence-and-identity), 감사 추적, 서명 신원을 구성한 경우의 Content Credentials가 있어요.
- **오픈 소스이며 사용량 과금이 없어요.** 코드를 직접 실행하고 자신의 인프라 비용만 내요.

그 서비스들이 대신 해주던 작업을 직접 맡게 돼요. 지속적으로 운영하는 서버에는 영구 데이터베이스와 출력 저장소가 필요해요. 브라우저가 필요한 도구에는 Chromium 워커가 필요해요. [Lolly Work 설치](/info/work-install.html)에서 둘 다 설명해요.

<!--i:eti-table-->
## 작업별 대응 관계

| 작업 | 호스팅 렌더링 API | Lolly |
|---|---|---|
| 데이터로 템플릿 채우기 | 템플릿과 레이어를 지정하는 API 요청 | 도구와 입력을 지정하는 [URL](/info/url-mode.html), [CLI](/info/cli.html) 또는 [서버 API](/info/work-automation-api.html) |
| 표에서 여러 파일 만들기 | 배치와 컬렉션 | 기기의 [Batch](/info/batch.html) 또는 서버의 [렌더링 배치](/info/work-renders.html#batches-with-durable-rows) |
| 결과를 기다리거나 폴링하기 | 폴링 또는 동기 옵션 | 폴링으로 확인하는 영속 렌더링 또는 즉시 렌더링 |
| 완료 시 웹훅 호출하기 | 지원 | 허용한 오리진으로 보내는 [서명된 콜백](/info/work-renders.html) |
| 동적 이미지 URL | 지원 | [공유 링크와 `/render` URL](/info/url-mode.html) |
| 템플릿 편집하기 | 호스팅 편집기 | 기기에서 실행하는 [Design](/info/using.html) |
| 에이전트 | 둘 다 MCP 서버를 공개해요 | Lolly Work에서 토큰 정책이 적용되는 조직 엔드포인트를 갖춘 [MCP](/info/mcp.html) |

Lolly 자체의 출력 유형은 [내보내기](/info/exporting.html)에 나열돼 있어요. 현재 Work 서버의 영속 렌더링은 SVG, PNG, JPG, PDF를 만들며, [동영상은 기기, CLI, MCP에서 처리해요](/info/work-renders.html#production-still-checks-and-permitted-repairs).

<!--i:eti-folder-move-->
## 이전되는 것과 이전되지 않는 것

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| 사용자 요청 | Work의 마이그레이션 API가 같은 구조를 받아요 | 동일 | 동일 |
| 사용자 템플릿 | 확인된 스키마가 없는 레이어 유형을 제외하고 편집 가능한 문서로 **Import**해요 | 필드 이름과 미리보기만 제공해요. 각각 다시 만드세요 | 필드 이름과 미리보기만 제공해요. 각각 다시 만드세요 |
| 기존 동적 URL | 지원하지 않아요 | 지원하지 않아요 | 호스트를 바꾼 후에도 기존 비공개 토큰으로 서명된 URL이 계속 작동해요 |
| 웹훅 | 등록된 웹훅은 지원하지 않아요 | `webhook_url`이 작동해요 | `webhook_success`가 작동해요 |
| WebP와 AVIF 출력 | 이름으로 지정하면 거부돼요 | 제공하지 않아요 | WebP를 이름으로 지정하면 거부돼요 |
| 애니메이션, 동영상, 컬렉션, 스크린샷 | 마이그레이션 API에서는 지원하지 않아요 | 마이그레이션 API에서는 지원하지 않아요 | 마이그레이션 API에서는 지원하지 않아요 |

::: note 공개 문서를 바탕으로 만들었어요
각 공급업체의 공개 문서를 바탕으로 만들었으며 실제 계정으로 실행해 보지는 않았어요. 계정이 있다면 [이전 가이드](/info/work-move-from-render-api.html#check-it-on-your-own-account)에 짧은 점검 목록이 있어요.
:::

템플릿 하나만 옮기고 나머지는 그대로 둘 수 있어요. [Lolly를 떠나는 것](/info/work-move-from-render-api.html#leave-lolly-too)도 자유로워요. 도구는 일반 파일이고 CLI는 서버 없이 이를 렌더링해요.

<!--i:eti-building-->
## 서비스를 운영하는 주체

Lolly에서는 개인이 로컬에서 렌더링하거나 팀이 자체 인프라에서 Lolly Work를 운영해요. 서버 작업은 입력과 필요한 에셋을 해당 인스턴스로 전송해요. 기기에서 처리하는 경로는 전송하지 않아요.

Bannerbear와 Placid는 각 소유자의 상표예요. 이 페이지는 공개 문서를 바탕으로 제품들이 겹치는 부분을 설명하며 어느 쪽과도 제휴 관계가 없어요.
