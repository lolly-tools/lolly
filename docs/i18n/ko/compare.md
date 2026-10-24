# Lolly 도구별 비교

이미 다른 제품을 쓰고 있다면, 이 페이지들은 Lolly가 그 제품을 대체하는지, 함께 작동하는지, 작업에 맞지 않는지 알려줘요. 각 페이지는 다른 제품이 더 잘하는 것으로 시작해요.

_최종 확인일: 2026년 9월 28일._

## 제품별 비교

- [Lolly와 Canva](/info/compare-canva.html): 템플릿, 일상적인 디자인, 공유 브랜드 제작.
- [Lolly와 Adobe](/info/compare-adobe.html): 편집, 변환, 전문 출력, Content Credentials.
- [Lolly와 Figma](/info/compare-figma.html): 디자인, 실시간 협업, 재사용 가능한 에셋 제작.
- [Lolly와 Penpot](/info/compare-penpot.html): 오픈 소스 디자인, 공유 토큰, 조직 작업.
- [Lolly와 브랜드 포털](/info/compare-brand-portals.html): 승인된 라이브러리, 잠긴 템플릿, 신원, 검토, 보고.
- [Lolly와 렌더링 API](/info/compare-render-apis.html): 기기, CI 또는 Lolly Work 서버에서의 자동 생성.
- [Lolly와 온라인 파일 변환기](/info/compare-converters.html): 자신의 기기에서 형식 변환.

기능별 비교는 [Lolly 비교](/info/positioning.html)를 참고하세요. 각 비교에는 날짜가 있으며, 어느 한쪽 제품과 더 이상 맞지 않는 내용은 수정이 필요해요.

## 어디서 무엇이 실행되는가

모든 비교는 하나의 오픈 소스 프로젝트의 두 부분을 다뤄요. **Lolly**는 엔진, 앱, 도구예요. **Lolly Work**는 [lolly-work 저장소](https://github.com/lolly-tools/lolly-work)에서 관리되는 조직 서버예요. 둘 다 MPL-2.0이며, 조직이 어떤 Lolly Work 서비스를 켤지 결정해요.

::: cols
## 기기에서: Lolly

- 독립 실행형 사용에는 계정이 필요 없어요
- 만들기, 편집, 변환, 내보내기
- 필요한 도구와 에셋이 저장되면 오프라인에서 작동해요
- 기기에서 서명되는 Content Credentials
- 서버 없이 두 기기 간의 비공개 collab

## 조직의 서버에서: Lolly Work

- 싱글 사인온, SCIM 프로비저닝, 역할과 정책
- 공유 카탈로그, 팀 프로젝트, 업무 collab
- 승인, 사용량 보고, 감사 기록
- 서버 렌더링, 복구 가능한 작업, 승인된 전달
- 조직의 신원으로 하는 서버 서명
:::

독립 실행형 사용은 파일을 기기에 둬요. 공유 프로젝트, 업무 collab, 서버 렌더링 또는 전달을 선택하면 그 기능에 필요한 데이터가 조직의 서버로 가요.

## 모든 비교의 전제

이 한계는 이 모음의 모든 페이지에 적용되므로 여기서 한 번만 밝혀요.

- **업무 collab은 현재 단일 서버 노드에서 실행돼요.** 규모와 운영 이력이 오래 확립된 호스팅 제품과 달라요. [Work 상태와 로드맵](/info/work-status.html)이 현재 한계를 기록해요.
- **[lolly.work](https://lolly.work)의 사이트는 데모 샌드박스예요.** 지속되는 조직 배포에는 영구 저장소와 운영자가 필요해요. [Lolly Work 설치](/info/work-install.html)가 둘 다 다뤄요.
- Lolly나 직접 호스팅하는 Lolly Work에는 **좌석당 소프트웨어 라이선스 비용이 없어요.** 호스팅, 저장소, 운영에는 여전히 비용이 들어요.
- **서명은 신뢰할 수 있는 서명자가 아니에요.** 검증자는 파일에 서명한 인증서를 신뢰해야 서명자를 신뢰됨으로 표시해요. [Content Credentials 신원](/info/content-credentials-identity.html)이 방법을 설명해요.
