# Lolly와 렌더링 API

_최종 확인일: 2026년 9월 28일._

Lolly는 템플릿과 데이터로부터 에셋을 사용자의 기기, CI, 또는 [lolly.work](https://lolly.work)의 서버 API를 통해 생성해요. 통합 솔루션은 자동 렌더링뿐 아니라 조직의 제작 작업을 둘러싼 ID, 정책, 전달도 다뤄요.

## 겹치는 부분

[Bannerbear](https://www.bannerbear.com/)와 [Placid](https://placid.app/)는 API와 통합을 통해 템플릿에서 이미지와 그 밖의 미디어를 생성해요. Lolly도 템플릿과 입력을 쓰는 같은 방식을 사용하며, 작업을 제출하는 방법으로 [URL 모드](/info/url-mode.html), [CLI](/info/cli.html), 일괄 그리드, 서버 엔드포인트를 제공해요.

## lolly.work가 제공하는 것

lolly.work는 Lolly 프로젝트에서 따로 배포되는 조직용 서비스예요. API 뒤에서 Lolly 엔진을 실행하고, 도구 표시 여부와 입력 정책을 적용하며, 렌더링된 파일과 서명된 공유 링크를 제공해요. [복구 가능한 렌더 서비스](https://github.com/lolly-tools/lolly-work/blob/main/docs/renders.md)는 개별 작업과 일괄 작업, 멱등한 제출, 상태, 횟수가 제한된 재시도, 취소, 보존된 출력을 지원해요. 영구 스토리지가 구성되어 있으면 중단된 작업은 서버가 재시작된 후 이어서 실행될 수 있어요.

서버는 빠른 SVG/PNG 렌더 경로와, 브라우저가 필요한 도구를 위한 선택적 Chromium 워커를 사용해요. 자동화는 서비스 토큰으로 인증하고, 완료된 출력은 [거버넌스가 적용된 전달](https://github.com/lolly-tools/lolly-work/blob/main/docs/delivery.md)을 통해 조직 대상으로 보낼 수 있어요. 서명 ID를 구성하면 지원되는 서버 출력에 C2PA 서명이 활성화돼요.

## 서비스를 운영하는 주체

Bannerbear와 Placid는 렌더링을 자체 인프라와 통합을 갖춘 관리형 서비스로 제공해요. Lolly에서는 개인이 로컬에서 렌더링하거나, 팀이 자체 인프라에서 lolly.work를 운영할 수 있어요. Lolly의 두 저장소 모두 MPL-2.0 오픈 소스예요. 자체 호스팅에는 렌더링 건당 소프트웨어 라이선스 비용이 없지만, 컴퓨팅, 스토리지, 운영은 계획해야 할 비용으로 남아요.

공개 lolly.work 사이트는 평가용 샌드박스이며, 운영 호스팅을 약속하는 것이 아니에요. 지속적인 서비스에는 영구 데이터베이스와 출력 스토리지가 필요해요. 브라우저에 의존하는 도구에는 Chromium 워커가 필요해요. [설치 가이드](https://github.com/lolly-tools/lolly-work/blob/main/docs/install.md)와 [상태 페이지](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md)에서 이러한 요구 사항과 현재 제약을 설명해요.

로컬 렌더링과 CI 렌더링은 조직용 서비스 없이도 계속 사용할 수 있어요. 서버 작업을 제출하면 그 입력과 필요한 에셋이 해당 인스턴스로 전송돼요. 이는 기기 안 경로와는 별개예요. [통합 솔루션 개요](/info/compare.html)를 참고하세요.

Bannerbear와 Placid는 각 소유자의 상표예요. 이 페이지는 솔루션이 겹치는 부분을 설명하며 어느 쪽과도 제휴 관계가 아니에요.
