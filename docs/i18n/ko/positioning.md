# Lolly 비교

Lolly는 계정 없이 사용자의 기기에서 브랜드에 맞는 파일을 만들어요. **Lolly Work**는 팀을 위한 서버예요. 조직이 운영하는 컴퓨터에서 로그인, 공유 프로젝트, 승인, 서버 렌더링을 제공해요. 둘 다 MPL-2.0에 따른 오픈 소스예요.

대부분의 팀은 기존 도구를 유지해요. 디자인 앱이 디자인을 제공하고, DAM이 공식 원본 저장소로 남고, Lolly가 승인된 입력을 완성된 파일로 바꿔요. [기존 DAM과 Lolly 함께 사용하기](/info/use-with-dam.html)에서 이 조합을 설명해요. 그 바탕에 있는 생각은 [콘텐츠 주권](/info/content-sovereignty.html)이에요.

<!--i:eti-gauge-->
## 오늘날의 도구

각 링은 한 종류의 제품이 한 가지 요구를 얼마나 완전히 충족하는지 보여줘요. 행 옆의 **?**를 누르면 근거를, 범례 옆의 **?**를 누르면 점수의 의미를 볼 수 있어요.

::: figure positioning-comparison
기능 비교. 경쟁 제품 조사는 공급업체 문서를 바탕으로 2026년 8월부터 11월 21일까지 진행했어요. Lolly와 Lolly Work는 2026년 11월 21일에 검토했어요. 점수: 0 없음, 25 우회 방법, 50 실제 기능이 있지만 사용 조건이 있거나 부분적임, 75 강력하지만 유의점이 있음, 100 핵심 역량.
:::

::: details 2026년 11월에 바뀐 점수의 출처
- Canva: [API 변경 기록](https://www.canva.dev/docs/apps/rest-apis/changelog/), [서비스 앱](https://www.canva.dev/blog/developers/canva-service-accounts/), [Brand Controls 도움말](https://www.canva.com/help/brand-control/)
- Adobe: [InDesign API 변경 기록](https://developer.adobe.com/firefly-services/docs/indesign-apis/getting-started/changelog/), [Adobe Express 요금](https://www.adobe.com/express/pricing)
- Figma: [에이전트와 AI 크레딧](https://help.figma.com/hc/en-us/articles/42614902212887), [MCP 서버](https://developers.figma.com/docs/figma-mcp-server/)
- Frontify와 Bynder: [Frontify 2026년 10월 릴리스 노트](https://news.frontify.com/163371-what-s-new-in-october-2026), [Frontify MCP](https://help.frontify.com/en/articles/14787214-frontify-mcp-beta)
- Bannerbear와 Placid: [Bannerbear 요금](https://www.bannerbear.com/pricing/), [Bannerbear 변경 기록](https://www.bannerbear.com/changelog/), [Placid 요금](https://placid.app/pricing)
- Penpot: [자체 호스팅 요금](https://penpot.app/pricing/self-host), [릴리스](https://github.com/penpot/penpot/releases)
- Cloudinary: [콘텐츠 출처](https://cloudinary.com/documentation/content_provenance_and_authenticity), [요금](https://cloudinary.com/pricing)
:::

기능과 실적은 별도의 행이에요. Lolly의 첫 공개 릴리스는 2026년 8월 30일의 1.0.1이었고, 보안은 아직 독립 감사를 받지 않았으며, 도입 근거는 몇 개월간 쌓인 것이에요. [도입 & 거버넌스](/info/adoption-governance.html#status)에 현재 상태가 있어요.

<!--i:eti-hammer-->
## Lolly를 선택할 때

::: cols
## 이런 경우 Lolly를 선택하세요

- 이벤트 타일, 배지, 인증서, 알림, 소셜 카드처럼 같은 종류의 파일이 반복해서 필요할 때
- [Lolly Batch](/info/batch.html#make-many-versions-of-one-design)나 CLI에서 템플릿 하나와 값이 담긴 표로 많은 파일을 만들 때
- 자유 캔버스에서도 색상, 서체, 에셋이 디자인 시스템 안에 머물러야 할 때
- 완성된 Figma, Penpot, Illustrator, InDesign, Affinity 또는 PDF 디자인을 편집하고 반복해서 만들 수 있어야 할 때([디자인 가져오기](/info/design-import.html))
- 자신의 기기나 서버에서 파일을 만들어야 할 때

## 이런 경우 다른 것을 선택하세요

- 세밀한 사진 보정이나 일러스트 작업을 할 때
- 애플리케이션 인터페이스를 디자인하고 프로토타입을 만들 때
- 첫날부터 대규모 스톡 및 템플릿 라이브러리가 필요할 때
- 대규모 운영에서 오랜 실적을 가진 관리형 서비스가 필요할 때
:::

가져온 디자인과 공유 디자인 토큰으로 팀은 Lolly를 전문 애플리케이션과 함께 사용할 수 있으며, Lolly Work는 공유 에셋, 검토, 전달을 관리해요.

잘 정리된 DAM이 있는 팀이라면 그 라이브러리와 관리자를 그대로 유지하는 것부터 시작하세요. [SUSE의 Brandfolder 경험](/info/suse-brandfolder.html)은 통합이 도입과 승인 절차의 변경 관리를 어떻게 지원했는지 기록해요. DAM 공급업체와 구현 파트너는 [파트너 워크플로](/info/dam-partners.html)로 같은 구성을 평가할 수 있어요.

전체 덱은 **Lolly Markdown Slides**에서 데이터로 작성되고, 실시간으로 배치되고, 네이티브 편집 가능 PowerPoint 파일로 내보내져요.

![분할 보기의 Lolly Markdown Slides. 왼쪽에는 덱의 슬라이드가 블록으로 나열되고, 오른쪽에는 배치된 덱이 렌더링돼요](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

<!--i:eti-shield-check-->
## 규칙은 도구 안에 있어요

Lolly는 색상, 글꼴, 도련 여백, 간격, 허용된 입력처럼 재사용할 수 있는 브랜드 규칙을 도구에 담아요. 템플릿은 수신자가 바꾸면 안 되는 부분을 고정해요. Lolly Work는 그 템플릿에 그룹 접근과 입력 정책을 더하고, 카탈로그 제출과 전달을 위한 승인 단계를 제공해요.

도구를 한 번 확인하면 각 출력이 그 레이아웃 규칙을 물려받으므로 반복 제작이 쉬워져요. 문구, 업로드한 이미지, 사용 권한은 여전히 확인이 필요할 수 있으며, Lolly Work는 이를 위한 공유 카탈로그와 승인 단계를 제공해요. 창작 팀에게 도구는 안전장치예요. 데이터, 문구, 이미지는 여전히 사용자가 가져오고, 도구는 모든 결과가 브랜드에 맞도록 유지해요.

![제작자가 할 일은 단어를 입력하는 것뿐이에요. 서체, 색상, 간격은 도구를 만들 때 정해졌어요](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

그 밖의 차이 세 가지예요.

- **입력에서 최종 파일로.** 입력을 넣으면 완성된 파일이 나와요. "이제 디자인 도구에서 저장한 뒤 다듬으세요"라는 단계가 없어요.
- **도구가 도구를 조합해요.** 한 도구가 다른 도구의 렌더링을 하나의 완성된 파일에 임베드할 수 있으며, 둘 사이에 코드 결합이 없어요.
- **오픈 소스.** 엔진은 오픈 소스이며, 도구, 에셋, 디자인 토큰은 버전 관리에 보관하거나 Lolly Work에서 관리할 수 있는 파일이에요. 다른 사람의 데이터베이스에 있는 행이 아니에요.

안전장치 안에서도 과감한 디자인을 할 수 있어요. 이 포스터용 도시 지도는 실제 벡터 도로와 수로 경로로 이뤄져 있으며, 디자인 시스템 밖의 값을 지정할 수 없는 드롭다운 하나와 색상 필드 두 개로 만들었어요.

![디자인 시스템 자체의 색으로 화면 가득 그려진 암스테르담의 고리 모양 운하와 도로망. 모든 획은 손이 아니라 템플릿이 배치했어요](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

<!--i:eti-stamp-->
## 확률적으로 혁신하고, 결정론적으로 확장해요

대부분의 "AI 창작" 제안은 오래전부터 있던 경계의 잘못된 쪽에 모델을 놓아요. 필경사와 채식사가 그 경계를 정했어요. 스케치에서는 자유롭게 작업하며 무엇이든 시도할 수 있고 아무것도 확정하지 않아요. 그런 다음 인쇄기로 가서 확정해요. 스케치에 예술이 담겼고 인쇄기는 그것을 전달하는 수단이었어요. 인쇄물이 신뢰받을 수 있었던 것은 인쇄기가 매번 찍을 때마다 약속을 지켰기 때문이에요.

Lolly는 그 인쇄기예요. 아이디어에는 모델이든 디자이너든 거친 스케치든 원하는 것을 가져오세요. 하지만 아이디어가 많은 파일이 되어야 하는 순간에는 누구나 다시 읽을 수 있는 입력으로 매번 같은 방식으로 렌더링하는 과정을 거쳐요. 위의 비교는 결국 누가 그 확정 단계를 반복 가능하게 만드는지에 관한 것이에요.

> 창작 과정을 믿고, 엄밀하게 확장하세요.

<!--i:eti-tag-->
## 영원히 무료

**기기에서 렌더링된다면 영원히 무료예요.** 엔진, 셸, 도구, 형식은 오픈 소스이며, 출시된 버전은 회수할 수 없어요. Lolly Work도 오픈 소스예요. 조직은 선택한 인프라와 운영에 비용을 지불하며, 자체 호스팅에는 사용자별 또는 렌더링별 소프트웨어 라이선스 요금이 없어요. [질문과 답변](/info/faq.html)에서 이 약속의 배경을 이야기해요.

<!--i:eti-map-pin-->
## 콘텐츠가 머무는 곳

Lolly의 창작 작업은 소유한 하드웨어에서 실행할 수 있고, 디자인 토큰, 글꼴, 로고, 도구는 직접 보관할 수 있는 파일이에요. Lolly Work에서는 공유 프로젝트, 에셋, 정책, 감사 기록이 조직이 구성한 저장소에 머물러요. [신뢰](/info/trust.html)에서 이것이 왜 중요한지 설명하며, [개인정보 처리방침](/info/privacy.html)과 [직접 검증하기](/info/verify-yourself.html)로 우리 말을 그대로 믿는 대신 주장을 확인할 수 있어요.

<!--i:eti-grid-->
## 도구별 비교

[Lolly 도구별 비교](/info/compare.html)는 Canva, Adobe, Figma, Penpot, 브랜드 포털, 렌더링 API, 온라인 변환기를 각각 한 페이지에서 Lolly와 비교하고, [무엇이 어디서 실행되는지](/info/compare.html#what-runs-where) 설명해요.
