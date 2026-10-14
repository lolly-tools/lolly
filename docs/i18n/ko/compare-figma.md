# Lolly와 Figma

_최종 확인일: 2026년 9월 28일._

Lolly는 디자인, 실시간 편집, 재사용 가능한 에셋 제작을 지원해요. [lolly.work](https://lolly.work)는 그 작업을 둘러싼 조직 서비스, 즉 ID, 공유 프로젝트, 접근 제어, 승인을 더해요.

## 겹치는 부분

두 쪽 모두 캔버스에서 글자, 도형, 이미지를 배치하고 다른 사람과 함께 작업할 수 있어요. Lolly의 [디자인 가져오기](/info/design-import.html)는 Figma 파일을 편집 가능한 레이아웃으로 읽어요. Figma도 템플릿 기반 브랜드 제작을 지원해요. [Figma Buzz](https://help.figma.com/hc/en-us/articles/31271566667543-Guide-to-Figma-Buzz)는 템플릿에서 에셋을 만들고 CSV 또는 XLSX 파일로 값을 채워요.

Lolly는 디자인을 [규칙이 있는 재사용 가능한 도구](/info/create-a-tool.html)로 바꿔요. 이 도구는 브라우저나 CLI에서 실행되고, URL, 스크립트, 일괄 그리드에서 입력을 받아요. 같은 템플릿으로 에셋 하나를 편집하는 개인도, 많은 변형을 만드는 팀도 작업할 수 있어요.

## 협업과 제품 디자인

[Figma Design](https://www.figma.com/design/)은 인터페이스 디자인, 컴포넌트, 인터랙티브 프로토타입, 개발자 핸드오프를 한데 모아요. 팀이 완전한 애플리케이션을 디자인하고 명세해야 한다면, 이미 자리 잡은 제품 디자인 워크플로와 생태계가 관련돼요.

Lolly는 두 가지 실시간 협업을 제공해요. [비공개 collab](/info/collaborate.html)은 두 기기를 직접 연결하며, 계정이 필요 없고 공유 네트워크에서는 인터넷도 필요 없어요. work collab은 인증된 접근, 공유 편집, 실시간 커서, 저장된 팀 세션을 위해 lolly.work를 사용해요. work 협업은 Lolly 클라이언트와 lolly.work 서버 모두에 구현되어 있지만, 현재의 단일 노드 배포로는 Figma의 운영 규모와 동등하다고 할 수 없어요.

## 배포와 제작

Lolly의 크리에이티브 앱과 lolly.work는 같은 오픈 소스 프로젝트에서 따로 배포되는 부분이에요. 단독 Lolly는 계정 없이 오프라인에서 렌더링할 수 있어요. lolly.work는 조직이 통제하는 인프라에서 SSO, SCIM, 공유 카탈로그, 프로젝트 권한, 승인, 감사 기록, 서버 렌더링을 제공해요.

팀 세션과 work collab 편집은 해당 인스턴스에 전달되고, 로컬 렌더링은 기기에 남을 수 있어요. Content Credentials는 지원되는 내보내기에서 선택 사항이며, 서버 서명은 구성된 조직 ID를 사용해요. 분리에 대해서는 [통합 솔루션 개요](/info/compare.html)를, 검증자가 서명자를 신뢰하는 방식은 [Content Credentials ID](/info/content-credentials-identity.html)를 참고하세요.

Figma는 해당 소유자의 상표예요. 이 페이지는 두 솔루션이 겹치는 부분을 설명하며 Figma와 제휴 관계가 아니에요.
