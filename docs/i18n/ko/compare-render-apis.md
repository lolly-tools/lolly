# Lolly와 렌더링 API

_최종 확인일: 2026년 9월 28일._

지금 API로 템플릿에서 이미지를 생성하고 있다면, 이 페이지는 Lolly가 같은 일을 자신의 기기, CI, 또는 자체 서버에서 하는 방법을 알려줘요.

## 호스팅 렌더링 API가 더 잘하는 것

[Bannerbear](https://www.bannerbear.com/)와 [Placid](https://placid.app/)는 렌더링을 자체 인프라, 통합, 지원과 함께 관리형 서비스로 제공해요. 요청을 보내면 서버는 다른 누군가가 운영해요.

## 겹치는 부분

둘 다 템플릿과 입력을 미디어로 바꿔요. Lolly는 [링크](/info/url-mode.html), [CLI](/info/cli.html), 배치 그리드, 서버 엔드포인트에서 입력을 받아요.

## Lolly가 겹치는 작업을 하는 방법

같은 도구가 같은 입력으로 노트북, CI 작업, 서버에서 렌더링해요. 로컬 및 CI 렌더링에는 서비스가 전혀 필요 없어요.

![Batch 내보내기 설정: 파일 이름, 기본 형식, 단위, DPI, 렌더링할 행의 수](/info/shots/use-batch-toolbar.svg)

서버에서 [Lolly Work](/info/compare.html#what-runs-where)는 API 뒤에서 Lolly 엔진을 실행하고 도구 가시성과 입력 정책을 적용해요. [복구 가능한 렌더 서비스](/info/work-renders.html)는 단일 작업과 배치, 멱등 제출, 상태, 제한된 재시도, 취소, 보관된 출력을 지원하며, 영구 저장소가 구성되어 있으면 중단된 작업이 재시작 후 이어져요.

서버에는 빠른 SVG 및 PNG 경로와, 브라우저가 필요한 도구를 위한 선택적 Chromium 워커가 있어요. 자동화는 서비스 토큰으로 로그인하고, 완성된 출력은 [승인된 전달](/info/work-delivery.html)을 통해 조직 대상으로 갈 수 있으며, 구성된 서명 신원이 지원되는 출력에 Content Credentials를 더해요.

## 서비스를 운영하는 주체

Lolly에서는 개인이 로컬에서 렌더링하거나, 팀이 자체 인프라에서 Lolly Work를 운영해요. 서버 작업을 제출하면 입력과 필요한 에셋이 그 인스턴스로 전송되며, 이는 기기 내 경로와 달라요. 지속되는 서비스에는 영구 데이터베이스와 출력 저장소가 필요하고, 브라우저에 의존하는 도구에는 Chromium 워커가 필요해요. [Lolly Work 설치](/info/work-install.html)가 둘 다 설명해요.

Bannerbear와 Placid는 각 소유자의 상표예요. 이 페이지는 제품이 겹치는 곳을 설명하며 어느 쪽과도 제휴 관계가 아니에요.
