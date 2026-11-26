# 질문 & 답변

`/info/start/faq.html`에서 아코디언으로 표시되는 자주 묻는 질문이에요.

**관리 방법:** 아래의 각 `##` 제목이 질문이에요. 제목 아래부터
다음 `##` 직전까지의 모든 내용이 답변이에요. 답변은 사이트의 경량 Markdown을 사용해요.
단락 사이는 빈 줄로 구분하세요. 여기서 질문을 추가하거나 지우거나 순서를 바꾼 뒤
`pnpm run build:info`(또는 `pnpm run dev:web`)를 다시 실행하세요.
빌드는 첫 `##` 위의 모든 내용(이 제목과 안내)을 무시해요.

처음 쓰는 사람을 위한 순서예요. 먼저 숨은 조건, 그다음 파일, 그다음 Lolly를 받아
실행하는 방법, 그다음 조직, 마지막으로 어떻게 만들었는지를 다뤄요. 각 질문의 앵커는
같은 위치에 있는 영어 질문으로 만들어지므로, 번역에서도
영어의 순서를 유지해요.

## 왜 무료인가요? 숨은 조건이 있나요?

**우리가 쓰려고 Lolly를 만들었어요.** SUSE에는 외부 서비스에 아무것도 넘기지 않고 만든, 브랜드에 맞는 파일 수천 개가 필요했어요. 그래서 모든 작업을 기기에서 하는 도구를 만들고, 우리가 만드는 다른 모든 것처럼 오픈 소스로 공개했어요. 매일 쓰기 때문에 계속 유지 관리해요. **아무 의무도 없어요:** 여기 있는 모든 것은 우리가 있든 없든 동작해요.

그 경계는 약속이 아니라 라이선스에 명시돼 있어요. 기기에서 실행되는 모든 것은 영원히 무료예요. 공개된 버전에는 라이선스가 부여되어 회수할 수 없어요. 어떤 기여자 계약으로도 누구의 작업물도 다른 라이선스로 바꿀 수 없어요.

## SUSE는 얼마나 비공개로 두고 있나요? (즉, 언제 갑자기 조건을 바꾸나요)

엔진, 셸, 스키마, 특정 브랜드에 종속되지 않는 도구는 오픈 소스예요. SUSE의 상표와 브랜드 도구는 비공개로 유지되며 이미 분리돼 있어요. [lolly.tools](https://lolly.tools)의 공개 인스턴스는 Lolly 자체 디자인 시스템인 [Lolly Demo](/info/lolly-demo.html)를 실행해요.

여기서는 어떤 것도 약속에 기대지 않아요. 공개된 모든 버전은 오픈 소스로 남아요. 2023년에 다른 회사가 기업용 Linux 소스를 비공개로 바꿨을 때, SUSE는 그 코드를 공개 상태로 유지하려고 [OpenELA](https://openela.org)를 공동 설립했어요. 이 프로젝트는 그 입장을 이어받아요.

SUSE가 Lolly를 자체 IT 시스템에 연결하는 내부 도구를 만들고 있는 것은 *맞아요*. 이는 SUSE의 내부 구성이며, 개발을 공개와 비공개로 나눈 것이 아니에요. Lolly는 [Open Build Service](https://openbuildservice.org/)로 빌드하고, [SUSE Application Collection](https://apps.rancher.io/applications)을 통해 안전한 공급망 산출물을 전달하는 것도 목표로 해요.

## 왜 이름이 "Lolly Tools"인가요?

**Lolly**는 자유가 달콤하기 때문이고, 호주, 뉴질랜드, 영국에서 lolly가 사탕을 뜻하기 때문이에요.

**Tools**는 도구가 집어 들 때까지 가만히 있기 때문이에요. 쓰지 않을 때는 실행되지 않고, 쓰는 동안에도 사용자를 감시하지 않아요.

## 왜 모두 초록색인가요?

lolly.tools는 Lolly 자체 샘플 디자인 시스템인 [Lolly Demo](/info/lolly-demo.html)로 열리며, 대표 색상이 초록색이에요. [Settings → Design systems](/#/settings?focus=design-systems-section)에서 빈 디자인 시스템인 **Lolly Starter**나 자신의 디자인 시스템으로 바꾸세요.

## 내 브랜드를 쓸 수 있나요?

네. **Lolly Design System Setup**(`#/start`)은 색상 하나, 디자인 토큰 파일, 완성된 디자인으로 디자인 시스템을 만들어요. 그러면 모든 도구가 그 디자인 시스템으로 그려요. [시작하기](/info/quickstart.html#put-your-brand-in)에서 세 가지 경로를 안내해요.

조직이나 빌드에서 제공하는 디자인 시스템은 관리 대상이에요. 자물쇠가 표시되고 읽기 전용으로 유지돼요. 바꾸려면 편집 가능한 사본을 만드세요.

## 어제 만든 것은 어디에 있나요?

이전에 **Save as**나 **Save**를 눌렀다면, 작업물은 저장할 때 쓴 브라우저나 앱의 홈 화면 **Projects**에 있어요. **Download**만 눌렀다면 파일은 브라우저나 시스템의 다운로드에 있고, 보통 **Assets**에도 사본이 있어요. [작업하는 동안 저장하는](/info/find-your-work.html#which-tools-save-as-you-work) 도구는 저장하지 않은 작업도 **Projects**에 보관해요. [작업물 찾기와 복구](/info/find-your-work.html)에서 모든 경우를 다뤄요.

## 탭을 닫았어요. 작업물이 사라졌나요?

저장한 작업물은 여전히 **Projects**에 있어요. 저장하지 않은 작업은 사라져요. 단, 작업하는 동안 저장하는 도구는 저장하지 않은 작업도 **Projects**에 보관해요. 다음에는 나가기 전에 **Save as**를 누르세요. [탭을 닫았거나 도구를 떠났다면](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool)을 참고하세요.

## 작업물을 링크 대신 파일로 공유할 수 있나요?

네. 직접 넣은 사진이나 긴 텍스트처럼 링크에 모든 것을 담을 수 없으면, Share 대화상자가 무엇이 빠지는지 알려주고 **.lolly** 파일을 제공해요. 그 파일 하나에 디자인, 쓰인 이미지, 그리고 선택하면 도구까지 담겨요.

얼마나 담아 보낼지는 직접 정해요. 이름과 세부 정보는 프로필에서 포함에 동의한 경우에만 들어가요. 라이선스가 있는 아트는 포함하기로 선택하지 않으면 제외해요. 도구를 담은 파일을 여는 사람에게는 도구를 실행하기 전에 그 도구를 신뢰하는지 물어요. [작업물 공유하기](/info/using.html#sharing-your-work)를 참고하세요.

## 프로필 정보는 어디에 쓰이나요?

사용자의 **Settings** 정보는 배지의 이름처럼 해당 정보를 요청하는 도구에 미리 채워져요. 정보는 이 기기에 남아요. 포함 동의를 켜지 않으면 만드는 것에 아무 정보도 들어가지 않아요. 켜면 고른 정보가 봉인되어 들어가고 사용자를 출처로 표시해요.

공유와 Sync는 선택한 콘텐츠만 보내요. 조직의 Lolly Work 인스턴스에서는 공유 세션과 조직의 관리 대상 작업도 해당 서버로 가요. [개인정보 보호](/info/privacy.html)를 참고하세요.

## 모바일이나 데스크톱 앱은 어떻게 받나요?

앱은 [Lolly 설치하기](/info/install.html)에서 다운로드하세요. 페이지에 macOS, Windows, Linux, Android의 모든 빌드가 나열돼 있고, 다운로드한 파일을 확인하는 방법도 있어요. iPhone과 iPad에서는 App Store에서 **Lolly Tools**를 받아요. [iPhone과 iPad 섹션](/info/install.html#iphone-and-ipad)에 링크가 있어요.

누구나 사용자에게 필요한 도구와 설정을 넣은 앱 사본을 직접 빌드하고 배포할 수도 있어요. [빌드 가이드](/info/build-guide.html)에서 방법을 알려줘요.

## Lolly에서 WebGPU가 필요하다고 해요. 어떻게 하나요?

웹 앱은 최신 브라우저의 그래픽 기능인 WebGPU로 그리며, 도구를 열기 전에 WebGPU를 확인해요. 다음 순서대로 해 보세요.

1. 브라우저를 최신 버전으로 업데이트하세요.
2. 브라우저 설정에서 그래픽 또는 하드웨어 가속을 켠 뒤 브라우저를 다시 시작하세요.
3. 테스트된 브라우저를 써 보세요. [지원되는 환경](/info/supported-environments.html)에 나열돼 있어요.
4. Mac, iPhone, iPad에서는 대신 [앱을 설치하세요](/info/install.html).

## Lolly로 Figma, Penpot, Illustrator, InDesign 파일을 편집하고 렌더링할 수 있나요?

네. **Design** 도구를 열고 **Import a design**을 클릭하세요. Figma 네이티브 **.fig**(Save local copy), Penpot **.penpot** 내보내기, Illustrator **.ai** 또는 **.pdf**, InDesign **.idml** 또는 **.indd**, Affinity 문서, Photoshop **.psd**, PowerPoint **.pptx**, CAD **.dxf**, **모든 SVG**를 받아요([읽을 수 있는 모든 형식](/info/design-import.html#what-comes-in-from-each-app)). 계정도, 플러그인도, 디자인 앱 라이선스도 필요 없어요.

![Lolly Design의 열린 캔버스 - 도구 막대의 Lolly 메뉴에 Import a design이 있어요](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

레이어는 편집 가능한 박스로 들어와요. 텍스트는 다시 입력할 수 있고, 도형은 도형으로 남고, 이미지는 라이브러리에 들어가요. 레이아웃을 저장한 뒤에는 **Share with rules**로 Lolly를 쓰는 누구나 내용을 다시 채울 수 있는 도구로 바꿀 수 있어요. [디자인 가져오기](/info/design-import.html)를 참고하세요.

## 인터넷 없이 두 사람이 같은 디자인에서 작업할 수 있나요?

네. 한 사람이 초대(링크, QR 코드, 짧은 코드)를 공유하고 다른 사람이 수락해요. 그러면 두 기기가 참여 상태와 포커스 링을 표시하며 같은 세션을 실시간으로 유지해요. 중간에 서버가 없으므로 휴대폰 핫스팟을 포함해 함께 쓰는 어떤 네트워크에서든 동작해요. [함께 작업하기](/info/collaborate.html)를 참고하세요. 서로 다른 네트워크에 있는 동료에게는 조직의 Lolly Work 인스턴스가 인증된 업무용 collab을 제공해요.

## 기능 플래그는 무엇인가요?

기능 플래그는 Lolly의 일부 기능을 켜거나 꺼요. 독립형으로 쓸 때는 개인 설정을 직접 골라요. Lolly Work를 쓰는 조직은 정책에 따라 기본값을 정하거나 특정 스위치를 숨길 수 있고, 관리되는 컨트롤에는 표시가 붙어요. [조직에서 Lolly 사용하기](/info/organisation.html)를 참고하세요.

![독립형 앱의 개인 기능 플래그. 조직 정책이 특정 스위치를 관리할 수 있어요](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## 유틸리티는 도구와 어떻게 다른가요?

유틸리티는 이미 가진 파일에 PDF 압축, 사진 변환, 숨겨진 데이터 제거 같은 간단한 작업 하나를 해요. 많은 유틸리티가 아무것도 업로드하지 않고 기기에서 실행돼요. 유틸리티는 사람들이 보통 아무 웹사이트에나 맡기는 작업을 Lolly 안에서 처리하게 해요. 계약서를 압축하거나, 위치 정보가 남은 휴가 사진을 변환하거나, 온라인 포매터에 토큰을 붙여넣는 일이 보관 정책, 관할권, 사업 모델을 알 수 없는 사이트에 파일을 넘기는 일이 되어서는 안 돼요. [Lolly Utilities](/info/utilities.html)에 목록이 있고, [우리가 동의한 적 없는 거래](/info/status-quo.html)에서 그 배경을 이야기해요.

![Utilities 보기: Lolly Strip Hidden Data, Compress PDF, Convert Image와 기기에서 처리하는 다른 작업을 한곳에 모았어요](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## 우리 조직에서 SSO, 공유 프로젝트, 승인을 쓸 수 있나요?

네. 같은 오픈 소스 프로젝트의 조직용 서버인 **Lolly Work**로 할 수 있어요. 별도로 실행되며, 조직의 ID 공급자를 통한 통합 로그인, SCIM 프로비저닝, 그룹 권한, 공유 프로젝트와 에셋, 실시간 업무용 collab, 승인, 감사 기록을 추가해요. 일상적으로 쓰는 앱은 여전히 혼자서도 동작해요.

[조직에서 Lolly 사용하기](/info/organisation.html)는 로그인과 공유 작업물 찾기를 다뤄요. [배포](/info/deployment.html#organisation-services-with-lolly-work)는 Lolly Work 설정을 다뤄요. 공유 콘텐츠와 조직 기록은 해당 인스턴스의 개인정보 보호 및 보관 정책을 따라요.

## Lolly를 도입할 때 어떤 어려움이 있을까요?

대부분 기술보다 팀이 작업물을 만드는 방식의 변화예요. 관리되는 도구 모음을 원하는 팀에는 디자인 시스템과 첫 템플릿을 만들 사람이 필요해요. 그래도 누구나 첫날부터 git 없이 Lolly Design에서 자기 도구를 만들 수 있어요. 기존 절차는 결과물이 브랜드에 맞지 않아도 계속 돌아가요. 눈에 보이는 결과물 하나를 잘 전환하고 전후를 나란히 보여주면 계획보다 빠르게 설득할 수 있어요.

[도입 & 거버넌스](/info/adoption-governance.html)에서 역할별 온보딩, 시범 운영의 성과 측정 방법, 거버넌스 절차의 예를 다뤄요.

## Lolly는 "바이브 코딩"으로 만들었나요?

Lolly는 퍼블릭 클라우드의 선도 AI 기업이 제공하는 것을 포함해 여러 모델과 공급업체를 함께 활용하고, AI의 도움을 받은 코딩과 탐색, 그리고 많은 부분에서 AI의 도움을 받은 콘텐츠로 개발했어요. 사람이 아키텍처를 만들고, 의도를 갖고 코드를 선별하고 다듬고, 경험의 아트 디렉션을 맡았어요.

Lolly의 의존성에 높음 또는 심각 등급의 보안 권고가 있으면 CI가 차단돼요. 아직 해결할 수 없는 권고는 사유를 문서로 남긴 승인된 예외로만 보류해요. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions)에 현재 보류 중인 각 예외가 나열돼 있고, [릴리스 노트](https://github.com/lolly-tools/lolly/releases)에 각 릴리스가 포함하는 예외가 나열돼 있어요. SECURITY.md에는 취약점 신고 방법도 있어요.

빌드 검사에서는 모든 독자가 글을 쉽게 읽을 수 있도록 코드 주석, 앱, 이 문서에서 기계가 쓴 것처럼 읽히는 표현도 거부해요. 부수 효과로 탐지기가 어떤 글을 모델이 썼는지 구분하기 더 어려워질 수 있어요. 그것을 의도한 것은 아니에요.

무엇보다 Lolly는 전 세계 전문가들이 수십 년간 쌓아 온 오픈 소스 작업을 기반으로 해요.

**생성형 AI 사용 공개:**

- **LLM이 작성한 코드:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (이 목록은 늘어날 수 있어요)
- **LLM을 활용한 탐색:** Gemini 3.1, Fable, Codex Astra
- **문서:** Sonnet 5
- **오픈 소스 라이브러리:** SBOM, 주석, 파일 머리글에 명시된 각 저자

이 목록에는 Lolly에 포함된 외부 모델이 들어 있지 않아요.

**사람이 맡은 부분:**
- **아이디어 구상, 검토와 피드백:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, Penpot 커뮤니티, Tim Hildred(전체 목록은 아니에요)
- **아키텍처, 아트 디렉션 & 저품질 결과물 정리:** Andy Fitzsimon

## SUSE 브랜드 도구는 어디로 갔나요?

별도의 비공개 저장소에 있어요. 공개 저장소를 복제해도 SUSE 브랜드 팩은 가져오지 않으므로, 여기서 빌드하면 다른 프로필을 고르지 않는 한 중립적인 `lolly-start` 프로필을 사용해요. 이 프로필에는 특정 브랜드에 종속되지 않는 커뮤니티 도구와 직접 채울 수 있는 빈 브랜드가 있어요. [lolly.tools](https://lolly.tools)는 `lolly-demo` 프로필로 빌드되며 Lolly 자체 디자인 시스템인 [Lolly Demo](/info/lolly-demo.html)로 열려요. SUSE는 상표를 보호하기 위해 자체 인스턴스를 운영해요.

## Lolly 로고는 무슨 맛인가요?

어떤 사람은 라임, 어떤 사람은 민트, 때로는 사과라고 해요. Lolly가 달콤함을 더하면, 맛은 여러분이 만들어요.

## Lolly에서 콘텐츠 주권은 무엇을 뜻하나요?

선택한 시스템에서 콘텐츠를 어떻게 만들고, 관리하고, 저장하고, 옮길지 통제하는 것이에요. Lolly는 로컬 제작, 편집 가능한 작업물, 이동 가능한 도구를 지원해요. Lolly Work는 조직이 통제하는 공유 서비스를 더해요. 원본 라이선스, 사용할 수 있는 의존성, 워크플로의 데이터 흐름도 여전히 중요해요. [콘텐츠 주권이란?](/info/content-sovereignty.html)에서 각 통제 수단과 그 한계를 설명해요.

## 기존 DAM을 계속 쓸 수 있나요?

네. 지원되는 DAM을 공식 원본 저장소로 유지하면서 Lolly Work로 선택한 에셋을 Lolly 도구에 연결할 수 있어요. 원본 접근, 허용된 편집, 사용 권한, 완성된 출력물의 승인은 각각 별도로 결정해요. [기존 DAM과 함께 Lolly 사용하기](/info/use-with-dam.html)에서 이 구성을 설명하고, [SUSE의 Brandfolder 경험](/info/suse-brandfolder.html)에서 도입 과정의 성공적인 활용 사례를 기록해요.
