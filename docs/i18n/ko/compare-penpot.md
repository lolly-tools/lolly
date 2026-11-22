# Lolly와 Penpot

_마지막 확인: 2026년 9월 28일._

팀에서 Penpot으로 디자인한다면 Lolly를 Penpot과 함께 사용할 수 있어요. 둘 다 오픈 소스이고 같은 디자인 토큰을 읽어요. 이 페이지는 각각 어떤 작업을 위한 것인지 설명해요.

<!--i:eti-award-->
## Penpot이 더 잘하는 것

[Penpot](https://penpot.app/)은 실시간 편집과 실시간 커서를 갖춘 인터페이스 디자인, 컴포넌트, 유연한 레이아웃, 인터랙티브 프로토타입, 개발자용 검사 기능을 제공해요. 호스팅 및 자체 호스팅 배포를 제공하며, [Docker와 Kubernetes 설치 옵션](https://help.penpot.app/technical-guide/getting-started/)이 있어요. 애플리케이션을 디자인하려면 Penpot이 맞는 도구예요.

<!--i:eti-blend-->
## 겹치는 부분

[Penpot의 디자인 토큰](https://help.penpot.app/user-guide/design-systems/design-tokens/)은 Lolly도 읽는 DTCG 형식을 사용하므로 색상, 서체, 기타 토큰 값을 두 제품 사이에서 옮길 수 있어요. Lolly의 [디자인 가져오기](/info/design-import.html)는 내보낸 `.penpot` 파일을 편집 가능한 레이아웃으로 열고, Lolly의 **Send to Penpot**은 디자인을 `.penpot` 아카이브로 돌려보내요. Lolly는 [Penpot용 Lolly Export 플러그인](https://github.com/lolly-tools/lolly-plugins-penpot-export)도 유지 관리해요. 이 플러그인은 Lolly 엔진을 사용해 사용자가 선택하면 기기에서 Content Credentials를 추가해요.

<!--i:eti-lolly-->
## 겹치는 작업을 Lolly가 처리하는 방식

Lolly Design 캔버스는 편집 가능한 에셋을 만들며, 레이아웃을 [규칙이 있는 도구](/info/create-a-tool.html)로 바꿀 수 있어요. 같은 도구가 브라우저, 데스크톱 앱, CLI에서 렌더링하고 데이터로 변형본을 만들어요. 독립 실행형 Lolly는 계정이나 서버 없이 기기에서 렌더링하고 서명해요. [비공개 collab](/info/collaborate.html)은 두 기기를 직접 연결해요.

<!--i:eti-building-->
## 조직에서 사용하기

Lolly Work는 통합 로그인, SCIM 프로비저닝, 공유 카탈로그와 프로젝트, 역할, 승인, 감사 기록, 업무용 collab, 서버 렌더링을 추가해요. 두 저장소 모두 MPL-2.0이며, 조직은 둘 다 운영할 수 있어요. [무엇이 어디에서 실행되나요](/info/compare.html#what-runs-where)에서 두 부분을 나란히 비교해요.

둘 다 사용할 수 있어요. 인터페이스 디자인과 프로토타이핑에는 Penpot, 반복해서 만드는 파일에는 Lolly를 쓰세요.

Penpot은 해당 소유자의 상표예요. 이 페이지는 두 제품이 겹치는 부분을 설명하며 Penpot과 제휴 관계가 없어요.
