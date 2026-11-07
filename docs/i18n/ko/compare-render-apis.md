# Lolly와 렌더링 API

_최종 확인일: 2026년 11월 5일._

지금 API로 템플릿에서 이미지를 생성하고 있다면, 이 페이지는 그 제작을 직접 운영할 때 무엇이 달라지는지 알려줘요. 자신의 기기, CI, 또는 직접 관리하는 서버에서 운영하는 경우예요. [호스팅 렌더 API에서 옮기기](/info/work-move-from-render-api.html)가 그 방법이에요.

## 호스팅 렌더링 API가 더 잘하는 것

[Bannerbear](https://www.bannerbear.com/)와 [Placid](https://placid.app/)는 관리형 서비스이며, 이는 실질적인 장점이에요. 요청을 보내면 다른 누군가가 서버를 운영하고, 계속 가동하고, 부하를 처리해요.

- **운영할 것이 없어요.** 서버, 데이터베이스, 저장소, 업데이트, 용량 계획이 없어요.
- **호스팅 템플릿 편집기**와 바로 맞춰 쓸 수 있는 템플릿이 있어요.
- **하나의 API에서 더 많은 출력 종류.** 둘 다 비디오와 PDF 엔드포인트를 공개하며, Bannerbear는 애니메이션 출력, WebP와 AVIF, 스크린샷, AI 배경 제거도 문서화해요.
- **자체 통합과 지원.**

그런 방식을 원한다면 그 서비스들은 좋은 선택이에요.

## 직접 호스팅하면 얻는 것

- **콘텐츠가 내 시스템에 남아요.** 입력, 에셋, 출력이 직접 고른 인프라에 있어요. 기기나 CI에서 렌더링하면 서비스가 전혀 필요 없어요.
- **규칙이 도구에 있어요.** 색상, 서체, 로고, 잠긴 입력은 [디자인 시스템](/info/brand-studio.html)에서 오므로 호출하는 쪽은 허용한 것만 바꿀 수 있어요. [Lolly Work](/info/compare.html#what-runs-where)는 모든 요청에 도구 가시성과 입력 정책을 적용해요.
- **어디서나 같은 도구.** 도구는 같은 입력으로 노트북, CI 작업, 서버에서 렌더링하고, 사람들은 앱에서 같은 도구를 편집할 수 있어요.
- **직접 보관하는 기록.** [렌더 영수증](/info/work-renders.html#evidence-and-identity), 감사 추적, 서명 신원을 설정한 경우의 Content Credentials예요.
- **오픈 소스이고 종량제가 없어요.** 코드를 직접 운영하며, 비용은 자신의 인프라에 대해서만 들어요.

그런 서비스가 대신 해 주던 일은 직접 맡게 돼요. 지속되는 서버에는 영구 데이터베이스와 출력 저장소가 필요하고, 브라우저가 필요한 도구에는 Chromium 워커가 필요해요. [Lolly Work 설치](/info/work-install.html)가 둘 다 설명해요.

## 작업이 어떻게 대응되는가

| 작업 | 호스팅 렌더링 API | Lolly |
|---|---|---|
| 데이터로 템플릿 채우기 | 템플릿과 그 레이어를 지정하는 API 요청 | 도구와 그 입력을 지정하는 [URL](/info/url-mode.html), [CLI](/info/cli.html) 또는 [서버 API](/info/work-automation-api.html) |
| 표로 많은 파일 만들기 | 배치와 컬렉션 | 기기의 [Batch](/info/batch.html), 또는 서버의 [렌더 배치](/info/work-renders.html#batches-with-durable-rows) |
| 결과를 기다리거나 폴링 | 폴링, 또는 동기 옵션 | 폴링하는 지속 렌더, 또는 즉시 렌더 |
| 완료되면 웹훅 호출 | 지원 | 허용한 오리진으로 가는 [서명된 콜백](/info/work-renders.html) |
| 동적 이미지 URL | 지원 | [공유 링크와 `/render` URL](/info/url-mode.html) |
| 템플릿 편집 | 호스팅 편집기 | 기기의 [Design](/info/using.html) |
| 에이전트 | 둘 다 MCP 서버를 공개 | [MCP](/info/mcp.html), Lolly Work에서는 토큰의 정책에 따른 조직 엔드포인트 |

Lolly 자체의 출력 종류는 [내보내기](/info/exporting.html)에 나열돼 있어요. 지금 Work 서버에서 지속 렌더는 SVG, PNG, JPG, PDF를 만들고, [비디오는 기기, CLI, MCP에 남아 있어요](/info/work-renders.html#production-still-checks-and-permitted-repairs).

## 무엇이 이어지고 무엇이 이어지지 않는가

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| 요청 | Work의 마이그레이션 API가 같은 형태를 받아요 | 같음 | 같음 |
| 템플릿 | 확인된 스키마가 없는 레이어 유형을 제외하고 편집 가능한 문서로 **가져와요** | 필드 이름과 미리보기만. 하나씩 다시 만들어야 해요 | 필드 이름과 미리보기만. 하나씩 다시 만들어야 해요 |
| 기존 동적 URL | 지원되지 않음 | 지원되지 않음 | 호스트를 바꿔도 서명된 URL이 계속 작동해요. 예전 비공개 토큰을 써요 |
| 웹훅 | 등록된 웹훅은 지원되지 않음 | `webhook_url`이 작동해요 | `webhook_success`가 작동해요 |
| WebP와 AVIF 출력 | 이름으로 거부 | 제공되지 않음 | WebP는 이름으로 거부 |
| 애니메이션, 비디오, 컬렉션, 스크린샷 | 마이그레이션 API에 없음 | 마이그레이션 API에 없음 | 마이그레이션 API에 없음 |

이 모든 것은 각 공급업체의 공개 문서를 바탕으로 만들었고 실제 계정에 대해 실행해 보지는 않았어요. 계정이 있다면 [이전 가이드](/info/work-move-from-render-api.html#check-it-on-your-own-account)에 짧은 확인 목록이 있어요.

옮기는 일은 전부 아니면 전무가 아니에요. 템플릿 하나만 옮기고 나머지는 그대로 둘 수 있으며, [Lolly를 떠나는 것](/info/work-move-from-render-api.html#leave-lolly-too)도 똑같이 열려 있어요. 도구는 일반 파일이고 CLI가 서버 없이 렌더링해요.

## 서비스를 운영하는 주체

Lolly에서는 개인이 로컬에서 렌더링하거나, 팀이 자체 인프라에서 Lolly Work를 운영해요. 서버 작업을 제출하면 입력과 필요한 에셋이 그 인스턴스로 전송되며, 이는 기기 내 경로와 달라요.

Bannerbear와 Placid는 각 소유자의 상표예요. 이 페이지는 제품이 겹치는 곳을 공개 문서를 바탕으로 설명하며 어느 쪽과도 제휴 관계가 아니에요.
