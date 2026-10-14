# Lolly와 Penpot

_최종 확인일: 2026년 9월 28일._

Lolly와 Penpot은 모두 오픈 소스 디자인 도구, 공유 디자인 토큰, 실시간 협업을 제공해요. Lolly는 기기 안 제작과 따로 배포되는 조직용 서비스인 [lolly.work](https://lolly.work)를 결합해요.

## 공통 디자인 기반

[Penpot의 디자인 토큰](https://help.penpot.app/user-guide/design-systems/design-tokens/)은 DTCG 형식을 사용하며, Lolly도 이를 읽어요. 색상, 글꼴, 그 밖의 토큰 값을 두 워크플로 사이에서 공유할 수 있어요. Lolly의 [디자인 가져오기](/info/design-import.html)는 `.penpot` 내보내기를 편집 가능한 레이아웃으로 열어요.

Penpot용 Lolly Export 플러그인은 Lolly가 관리해요. Lolly의 엔진을 사용해 기기에서 선택적으로 C2PA Content Credentials를 적용해요. 서명 무결성과 서명자에 대한 신뢰는 별개예요. [Content Credentials ID](/info/content-credentials-identity.html)에서 설명하듯이, 검증자는 자신이 신뢰하는 ID가 필요해요.

## 디자인과 팀 워크플로

[Penpot](https://penpot.app/)은 인터페이스 디자인, 컴포넌트, 유연한 레이아웃, 인터랙티브 프로토타입, 개발자용 검사 기능을 제공해요. 호스팅 방식과 자체 호스팅 방식의 배포를 모두 제공하며, [Docker 및 Kubernetes 설치 옵션](https://help.penpot.app/technical-guide/getting-started/)이 있어요.

Lolly의 디자인 캔버스는 편집 가능한 에셋을 만들고 레이아웃을 [규칙이 있는 도구](/info/create-a-tool.html)로 바꿀 수 있어요. 같은 도구가 브라우저, 데스크톱 앱, CLI에서 렌더링되며 데이터로 변형을 생성할 수 있어요. 팀워크를 위해 Lolly에는 두 기기를 직접 연결하는 [비공개 collab](/info/collaborate.html)과 lolly.work를 통한 work collab이 모두 있으며, 공유 편집, 커서, 저장된 팀 세션을 지원해요.

## 배포 방식의 차이

단독 Lolly는 계정이나 서버 없이 기기에서 렌더링하고 서명해요. lolly.work는 SSO, SCIM 프로비저닝, 공유 카탈로그와 프로젝트, 역할, 승인, 감사 기록, 서버 렌더링을 더해요. 두 저장소 모두 MPL-2.0 오픈 소스이며 조직이 직접 운영할 수 있어요. 공유 작업은 구성된 인스턴스를 사용하고, 로컬 제작은 독립적으로 계속 사용할 수 있어요.

선택은 작업에 따라 달라져요. Penpot의 인터페이스 디자인 및 프로토타이핑 워크플로, Lolly의 반복 가능한 에셋 제작, 또는 공유 토큰과 가져온 디자인을 활용한 조합 중에서 고르게 돼요. Lolly의 work 협업은 현재 단일 서버 노드에서 실행되며, [배포 상태](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md)를 조직의 평가에 포함해야 해요.

Penpot은 해당 소유자의 상표예요. 위의 플러그인은 Lolly의 것이에요. 더 폭넓은 비교는 [Lolly 비교](/info/positioning.html)와 [통합 솔루션 개요](/info/compare.html)를 참고하세요.
