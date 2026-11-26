# 도구별로 비교하는 Lolly

이 페이지들은 Lolly가 다른 제품을 대체하는지, 함께 사용하는지, 작업에 맞지 않는지 설명해요. 각 페이지는 다른 제품이 더 잘하는 것부터 시작해요.

_마지막 확인: 2026년 9월 28일._

<!--i:eti-grid-->
## 제품별 비교

- [Lolly와 Canva](/info/compare-canva.html) - 템플릿, 일상적인 디자인, 공동 브랜드 제작.
- [Lolly와 Adobe](/info/compare-adobe.html) - 편집, 변환, 전문 출력, Content Credentials.
- [Lolly와 Figma](/info/compare-figma.html) - 디자인, 실시간 협업, 재사용 가능한 에셋 제작.
- [Lolly와 Penpot](/info/compare-penpot.html) - 오픈 소스 디자인, 공유 토큰, 조직 작업.
- [Lolly와 브랜드 포털](/info/compare-brand-portals.html) - 승인된 라이브러리, 잠긴 템플릿, 신원, 검토, 보고.
- [Lolly와 렌더링 API](/info/compare-render-apis.html) - 기기, CI 또는 자체 서버에서 자동 생성하기와 Bannerbear 또는 Placid에서 [이전하는 방법](/info/work-move-from-render-api.html).
- [Lolly와 온라인 파일 변환기](/info/compare-converters.html) - 자신의 기기에서 형식 변환하기.

[Lolly 비교](/info/positioning.html)에서 기능별로 살펴볼 수 있어요. 모든 비교에는 날짜가 있어요. 어느 한 제품의 현황과 더 이상 맞지 않는 주장은 수정해야 해요.

<!--i:eti-map-pin-->
## 무엇이 어디에서 실행되나요

모든 비교는 하나의 오픈 소스 프로젝트를 이루는 두 부분을 다뤄요. **Lolly**는 엔진, 앱, 도구예요. **Lolly Work**는 [lolly-work 저장소](https://github.com/lolly-tools/lolly-work)에서 유지 관리하는 조직 서버예요. 둘 다 MPL-2.0이며, 어떤 Lolly Work 서비스를 켤지는 조직이 결정해요.

::: cols
## 사용자 기기에서: Lolly

- 독립 실행에는 계정이 필요 없어요
- 만들기, 편집, 변환, 내보내기
- 필요한 도구와 에셋이 저장되면 오프라인으로 작동해요
- 기기에서 서명하는 Content Credentials
- 서버 없이 두 기기 사이에서 진행하는 비공개 collab

## 조직 서버에서: Lolly Work

- 통합 로그인, SCIM 프로비저닝, 역할, 정책
- 공유 카탈로그, 팀 프로젝트, 업무용 collab
- 승인, 사용량 보고, 감사 기록
- 서버 렌더링, 복구 가능한 작업, 승인된 전달
- 조직의 신원으로 서버에서 서명
:::

독립 실행에서는 파일이 기기에 남아요. 공유 프로젝트, 업무용 collab, 서버 렌더링 또는 전달을 선택하면 그 기능에 필요한 데이터가 조직 서버로 전송돼요.

<!--i:eti-info-->
## 모든 비교의 전제

다음 한계는 이 모음의 모든 페이지에 적용돼요.

- **Lolly Work의 collab은 현재 단일 서버 노드에서 실행돼요.** 규모와 운영 이력은 오래전부터 운영된 호스팅 제품들과 달라요. [Lolly Work 현황과 로드맵](/info/work-status.html)에 현재의 한계가 기록돼 있어요.
- **[lolly.work](https://lolly.work) 사이트는 데모 샌드박스예요.** 조직이 지속적으로 운영하는 배포 환경에는 영구 저장소와 운영자가 필요해요. [Lolly Work 설치](/info/work-install.html)에서 둘 다 다뤄요.
- Lolly나 자체 호스팅하는 Lolly Work에는 **사용자당 소프트웨어 라이선스 요금이 없어요**. 호스팅, 저장소, 운영에는 여전히 비용이 들어요.
- **서명이 있다고 서명자를 신뢰할 수 있는 것은 아니에요.** 검증기는 파일에 서명한 인증서를 신뢰할 때만 서명자를 신뢰할 수 있다고 표시해요. [Content Credentials 신원](/info/content-credentials-identity.html)에서 그 방법을 설명해요.
