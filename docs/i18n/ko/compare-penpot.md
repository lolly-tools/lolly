# Lolly와 Penpot

_최종 확인일: 2026년 9월 28일._

팀이 Penpot에서 디자인한다면, Lolly는 Penpot 옆에서 작동해요. 둘 다 오픈 소스이고 같은 디자인 토큰을 읽어요. 이 페이지는 각각 어떤 작업을 위한 것인지 알려줘요.

## Penpot이 더 잘하는 것

[Penpot](https://penpot.app/)은 실시간 편집과 라이브 커서와 함께 인터페이스 디자인, 컴포넌트, 유연한 레이아웃, 인터랙티브 프로토타입, 개발자 검사를 제공해요. 호스팅과 직접 호스팅 배포를 제공하며 [Docker와 Kubernetes 설치 옵션](https://help.penpot.app/technical-guide/getting-started/)이 있어요. 애플리케이션을 디자인하는 데는 Penpot이 맞는 도구예요.

## 겹치는 부분

[Penpot의 디자인 토큰](https://help.penpot.app/user-guide/design-systems/design-tokens/)은 Lolly도 읽는 DTCG 형식을 쓰므로 색상, 서체, 다른 토큰 값이 둘 사이를 오가요. Lolly의 [디자인 가져오기](/info/design-import.html)는 `.penpot` 내보내기를 편집 가능한 레이아웃으로 열고, Lolly의 **Send to Penpot**은 디자인을 `.penpot` 아카이브로 돌려보내요. Lolly는 [Penpot용 Lolly Export 플러그인](https://github.com/lolly-tools/lolly-plugins-penpot-export)도 관리하며, Lolly의 엔진으로 기기에서 옵트인 Content Credentials를 추가해요.

## Lolly가 겹치는 작업을 하는 방법

Lolly의 Design 캔버스는 편집 가능한 에셋을 만들고 레이아웃을 [규칙이 있는 도구](/info/create-a-tool.html)로 바꿀 수 있어요. 같은 도구가 브라우저, 데스크톱 앱, CLI에서 렌더링하고 데이터로 변형을 만들어요. 독립 실행형 Lolly는 계정이나 서버 없이 기기에서 렌더링하고 서명해요. [비공개 collab](/info/collaborate.html)은 두 기기를 직접 연결해요.

## 조직과 함께

Lolly Work는 싱글 사인온, SCIM 프로비저닝, 공유 카탈로그와 프로젝트, 역할, 승인, 감사 기록, 업무 collab, 서버 렌더링을 더해요. 두 저장소 모두 MPL-2.0이며 조직이 둘 다 운영할 수 있어요. [어디서 무엇이 실행되는가](/info/compare.html#what-runs-where)가 두 부분을 나란히 비교해요.

둘 다 쓸 수 있어요. 인터페이스 디자인과 프로토타이핑은 Penpot으로, 반복 가능한 파일은 Lolly로 하고, 공유 토큰과 가져온 디자인으로 연결해요.

Penpot은 소유자의 상표예요. 이 페이지는 두 제품이 겹치는 곳을 설명하며 Penpot과 제휴 관계가 아니에요.
