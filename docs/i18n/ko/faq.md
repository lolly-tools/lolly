# 질문과 답변

자주 묻는 질문이며 `/info/start/faq.html`에서 아코디언으로 렌더링돼요.

**유지 관리 방법:** 아래의 각 `##` 제목은 질문이고, 그 아래
(다음 `##` 전까지)의 내용이 답변이에요. 답변은 사이트의 다른 부분과 같은 가벼운 마크다운을 사용해요 -
문단은 빈 줄로 구분하세요. 여기서 질문을 추가, 삭제, 재정렬한 뒤
`pnpm run build:info`(또는 `pnpm run dev:web`)를 다시 실행하세요.
첫 번째 `##` 위쪽 내용(이 제목과 이 안내문)은 빌드 시 무시돼요.

순서는 처음 쓰는 사람의 순서예요. 먼저 함정, 그다음 파일, 그다음 Lolly를
구해서 실행하는 방법, 그다음 조직, 마지막으로 어떻게 만들어졌는지예요.
각 질문의 앵커는 같은 위치의 영어 질문으로 만들어지므로
번역도 영어 순서를 유지해요.

## 왜 무료인가요? 숨은 조건이 있나요?

**Lolly는 저희 자신을 위해 만들었어요.** SUSE에는 외부 서비스에 아무것도 넘기지 않고 만드는, 브랜드에 맞는 파일이 수천 개 필요했어요. 그래서 이 모든 것을 기기에서 하는 도구를 만들었고, 저희가 만드는 다른 모든 것처럼 오픈 소스로 공개했어요. 매일 쓰기 때문에 계속 유지 관리해요. **의무는 없어요.** 여기 있는 모든 것은 저희가 있든 없든 작동해요.

그 선은 약속이 아니라 라이선스에 그어져 있어요. 로컬에서 실행되는 모든 것은 영원히 무료예요. 배포된 버전은 되돌릴 수 없게 라이선스되며, 누구의 작업이든 다시 라이선스할 수 있는 기여자 계약이 없어요.

## SUSE는 얼마나 많은 부분을 비공개로 두나요? (일명 언제 뒤통수를 치나요)

엔진, 셸, 스키마, 브랜드 중립 도구는 오픈 소스예요. SUSE의 상표와 브랜드 도구는 비공개로 남는 부분이며 이미 분리되어 있어요. [lolly.tools](https://lolly.tools)의 공개 인스턴스는 Lolly 자체의 디자인 시스템인 [Lolly Demo](/info/lolly-demo.html)를 실행해요.

여기 있는 어떤 것도 약속에 의존하지 않아요. 배포된 모든 버전은 오픈 소스로 남고, 보류되는 것은 상표뿐이에요. 2023년에 다른 회사가 엔터프라이즈 Linux 소스를 닫았을 때 SUSE는 그 코드를 열어 두기 위해 [OpenELA](https://openela.org)를 공동 설립했고, 이 프로젝트가 이어받은 것도 같은 입장이에요.

솔직히 밝히면 SUSE는 Lolly를 자체 IT 시스템에 연결하는 내부 도구를 *만들고 있어요*. 이는 SUSE의 내부 구성이며 공개 개발과 비공개 개발의 분리가 아니에요. Lolly는 [Open Build Service](https://openbuildservice.org/)로 빌드하는 것도 목표로 하며, 안전한 공급망 아티팩트는 [SUSE Application Collection](https://apps.rancher.io/applications)으로 전달돼요.

## 왜 이름이 "Lolly Tools"인가요?

**Lolly**는 자유가 달콤하기 때문이고, 오스트레일리아와 뉴질랜드, 영국에서 lolly가 사탕을 뜻하기 때문이에요.

**Tools**는 도구가 집어 들기 전까지 가만히 있기 때문이에요. 쓰지 않을 때는 동작하지 않고, 쓰는 동안에도 사용자를 지켜보지 않아요.

## 왜 모든 게 초록색인가요?

lolly.tools는 Lolly 자체의 샘플 디자인 시스템인 [Lolly Demo](/info/lolly-demo.html)로 열리며 대표 색상이 초록이에요. 이것은 규칙이 아니라 샘플이에요. 빈 디자인 시스템인 **Lolly Starter** 또는 [Settings → Design systems](/#/settings?focus=design-systems-section)에서 자신의 것으로 전환하세요.

## 내 브랜드를 쓸 수 있나요?

네. **Design System Setup**(`#/start`)이 색상 하나, 디자인 토큰 파일 또는 완성된 디자인으로 디자인 시스템을 만들고, 이후 모든 도구가 사용자의 디자인 시스템으로 그려요. [시작하기](/info/quickstart.html#put-your-brand-in)가 세 가지 경로를 안내해요.

조직이나 빌드가 제공하는 디자인 시스템은 관리형이에요. 잠금이 표시되고 읽기 전용으로 유지되며, 편집 가능한 사본을 만들어 바꿀 수 있어요.

## 어제 만든 건 어디에 있나요?

**Save as** 또는 **Save**를 눌렀다면 저장한 브라우저나 앱의 홈 화면에 있는 **Projects**에 있어요. **Download**만 눌렀다면 파일은 브라우저나 시스템이 다운로드를 저장하는 곳에 있고, 보통 사본이 **Assets**에도 있어요. [작업하는 대로 저장하는](/info/find-your-work.html#which-tools-save-as-you-work) 도구는 저장하지 않은 작업도 **Projects**에 보관해요. [작업물 찾기와 복구](/info/find-your-work.html)가 모든 경우를 다뤄요.

## 탭을 닫았어요. 작업이 사라졌나요?

저장한 작업은 여전히 **프로젝트**에 있어요. 저장하지 않은 작업은 사라지지만, 작업하는 동안 저장되는 도구는 예외이며 이 경우도 **프로젝트**에 보관돼요. 다음에는 나가기 전에 **다른 이름으로 저장**을 누르세요. [탭을 닫았거나 도구를 떠났을 때](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool)를 참고하세요.

## 작업물을 링크 대신 파일로 공유할 수 있나요?

네. 링크가 직접 찍은 사진이나 긴 텍스트처럼 모든 것을 담을 수 없을 때, 공유 대화상자가 무엇이 빠질지 알려주고 대신 **.lolly** 파일을 제안해요. 디자인, 사용된 이미지, 선택하면 도구 자체까지 담은 파일 하나예요.

얼마나 전달할지는 사용자가 정해요. 이름과 세부 정보는 프로필이 동의한 경우에만 들어가고, 라이선스가 있는 아트는 아트를 포함하도록 선택하지 않는 한 제외돼요. 도구가 들어 있는 파일을 여는 사람은 도구가 실행되기 전에 그 도구를 신뢰하는지 질문을 받아요. [작업물 공유](/info/using.html#sharing-your-work)를 참고하세요.

## 프로필 세부 정보는 무슨 역할을 하나요?

**Settings**의 세부 정보는 배지의 이름처럼 이를 요청하는 도구를 미리 채워요. 이 기기에 머물러요. 동의 옵션도 켜면 선택한 세부 정보가 만든 것에 봉인되어 사용자를 출처로 밝혀요. 세부 정보를 포함하도록 선택하지 않는 한 아무것도 포함되지 않아요.

공유와 Sync는 선택한 콘텐츠만 보내요. 조직의 Lolly Work 인스턴스에서는 공유 세션과 관리되는 작업도 그 서버로 가요. [개인정보](/info/privacy.html)를 참고하세요.

## 모바일 앱이나 데스크톱 앱은 어떻게 구하나요?

[Lolly 설치](/info/install.html)에서 내려받으세요. 이 페이지는 macOS, Windows, Linux, Android용 모든 빌드를 나열하고 내려받은 파일을 확인하는 방법을 보여줘요. iPhone과 iPad는 App Store에서 **Lolly Tools**를 받아요. [iPhone과 iPad 섹션](/info/install.html#iphone-and-ipad)에 링크가 있어요.

누구나 청중에게 필요한 도구와 설정을 갖춘 앱의 자체 사본을 만들어 배포할 수도 있어요. [빌드 가이드](/info/build-guide.html)가 방법을 보여줘요.

## Lolly가 WebGPU가 필요하다고 해요. 어떻게 해야 하나요?

웹 앱은 최신 브라우저의 그래픽 기능인 WebGPU로 그리며, 도구를 열기 전에 이를 확인해요. 다음을 순서대로 시도하세요.

1. 브라우저를 최신 버전으로 업데이트하세요.
2. 브라우저 설정에서 그래픽 또는 하드웨어 가속을 켜고 브라우저를 다시 시작하세요.
3. 테스트된 브라우저를 써 보세요. [지원되는 환경](/info/supported-environments.html)에 나열돼 있어요.
4. Mac, iPhone, iPad에서는 대신 [앱을 설치](/info/install.html)하세요.

## Lolly에서 Figma, Penpot, Illustrator, InDesign 파일을 편집하고 렌더링할 수 있나요?

네. **Design**을 열고 **Import a design**을 클릭하세요. 네이티브 Figma **.fig**(Save local copy), Penpot **.penpot** 내보내기, Illustrator **.ai** 또는 **.pdf**, InDesign **.idml**(File → Export → InDesign Markup), **모든 SVG**를 받아요. 계정도, 플러그인도, 디자인 앱 라이선스도 필요 없어요.

![Design의 열린 캔버스 - Import a design이 툴바의 Lolly 메뉴 안에 있어요](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

레이어는 편집 가능한 박스로 들어와요. 텍스트는 다시 입력할 수 있고, 도형은 도형으로 남고, 이미지는 사용자의 라이브러리에 합류해요. 저장하면 **Share with rules**가 레이아웃을 Lolly가 있는 누구나 다시 채울 수 있는 도구로 바꿔요. [디자인 가져오기](/info/design-import.html)를 참고하세요.

## 인터넷 없이 두 사람이 같은 디자인을 함께 작업할 수 있나요?

네. 한 사람이 링크, QR 코드 또는 짧은 코드로 초대를 공유하고 다른 사람이 수락해요. 그러면 두 기기가 현재 상태와 포커스 링을 포함해 같은 세션을 실시간으로 유지해요. 중간에 서버가 없으므로 지하실의 휴대폰 핫스팟을 포함해 공유하는 어떤 네트워크에서도 작동해요. [함께 작업하기](/info/collaborate.html)를 참고하세요. 서로 다른 네트워크의 동료에게는 조직의 Lolly Work 인스턴스가 인증된 업무 collab을 제공해요.

## 피처 플래그란 무엇인가요?

Feature flags는 Lolly의 일부를 켜고 꺼요. 독립 실행형 사용에서는 개인 설정을 직접 선택해요. Lolly Work를 쓰는 조직은 정책에 따라 기본값을 정하거나 일부 스위치를 숨길 수 있으며, 관리되는 컨트롤은 표시돼요. [조직에서 Lolly 사용하기](/info/organisation.html)를 참고하세요.

![독립 실행형 앱의 개인 Feature flags: 조직 정책이 일부 스위치를 관리할 수 있어요](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## 유틸리티는 도구와 무엇이 다른가요?

유틸리티는 PDF 압축, 사진 변환, 숨겨진 데이터 제거처럼 이미 가진 파일에 대해 빠른 작업 하나를 하며, 대부분 아무것도 업로드하지 않고 기기에서 실행돼요. 사람들이 보통 아무 웹사이트에 맡기는 작업이 Lolly 안에 머물도록 존재해요. 계약서를 압축하거나, 위치 정보가 그대로 남은 휴가 사진을 변환하거나, 토큰을 온라인 포매터에 붙여넣는 일이 보관 기간, 관할권, 사업 모델을 알 수 없는 사이트에 파일을 주는 일이 되어서는 안 돼요. [유틸리티](/info/utilities.html)가 이들을 나열하고, [The trade we never agreed to](/info/status-quo.html)가 그 뒤의 이야기를 들려줘요.

![Utilities 보기: Strip Hidden Data, Compress PDF, Convert Image 등 기기에서 하는 작업이 한곳에 있어요](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## 조직에서 SSO, 공유 프로젝트, 승인을 사용할 수 있나요?

네, 같은 오픈 소스 프로젝트의 조직 서버인 **Lolly Work**로 가능해요. 별도로 실행되며 신원 공급자를 통한 싱글 사인온, SCIM 프로비저닝, 그룹 권한, 공유 프로젝트와 에셋, 실시간 업무 collab, 승인, 감사 기록을 더해요. 일상적인 앱은 여전히 단독으로 작동해요.

[조직에서 Lolly 사용하기](/info/organisation.html)가 로그인과 공유 작업 찾기를 다루고, [배포](/info/deployment.html#organisation-services-with-lolly-work)가 설정을 다뤄요. 공유 콘텐츠와 조직 기록은 해당 인스턴스의 개인정보 및 보관 정책을 따라요.

## Lolly를 도입할 때 어떤 장애물을 예상해야 하나요?

대부분 기술보다 제작하는 쪽의 변화예요. 관리되는 도구 세트를 원하는 팀은 디자인 시스템과 첫 템플릿을 작성할 사람이 필요하지만, 누구나 첫날부터 git 없이 Design에서 자기 도구를 만들기 시작할 수 있어요. 또 기존 프로세스는 결과물이 브랜드에 맞지 않아도 계속 작동하므로, 눈에 보이는 결과물 하나를 전후 비교로 잘 바꿔 보여주는 것이 계획서보다 설득이 빨라요.

[도입 및 거버넌스](/info/adoption-governance.html)가 역할별 온보딩, 파일럿 측정 방법, 거버넌스 프로세스의 모습을 다뤄요.

## Lolly는 "바이브 코딩"으로 만들어졌나요?

Lolly는 AI 지원 코딩, AI 지원 탐색, 여러 곳에서 AI 지원 콘텐츠로 개발되었으며, 퍼블릭 클라우드 프런티어 기업의 모델을 포함해 여러 모델과 공급업체를 섞어 썼어요. 사람이 아키텍처를 만들고, 의도를 갖고 코드를 가다듬고, 경험의 아트 디렉션을 맡았어요.

Lolly 종속성의 높음 또는 치명적 권고는 CI를 차단해요. 아직 고칠 수 없는 권고는 서면 사유가 있는 승인된 예외로만 보류돼요. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions)가 현재 보류 중인 각 예외를 나열하고, [릴리스 노트](https://github.com/lolly-tools/lolly/releases)가 각 릴리스가 담은 예외를 나열해요. SECURITY.md는 취약점을 보고하는 방법도 알려줘요.

빌드의 검사는 모든 독자에게 텍스트를 평이하게 유지하기 위해 코드 주석, 앱, 이 문서에서 기계가 쓴 것처럼 읽히는 표현도 거부해요. 부수 효과로 탐지기가 어떤 텍스트를 모델이 썼는지 구분하기 더 어려워질 수 있어요. 그렇게 하려던 것은 아니에요.

무엇보다 Lolly는 전 세계 전문가들이 수십 년간 쌓은 오픈 소스 작업의 어깨 위에 서 있어요.

**생성형 AI 공개:**

- **LLM이 작성한 코드:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (이 목록은 늘어날 수 있어요)
- **LLM 탐색:** Gemini 3.1, Fable, Codex Astra
- **문서:** Sonnet 5
- **오픈 소스 라이브러리:** 각 저자이며 SBOM, 주석, 파일 헤더에 표시돼 있어요

이 목록에는 Lolly에 내장된 모델은 포함되지 않아요.

**사람의 기여:**
- **아이디어, 검토, 피드백:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, Penpot Community, Tim Hildred (전체 목록은 아니에요)
- **아키텍처, 아트 디렉션, slop janitor:** Andy Fitzsimon

## SUSE 브랜드 도구들은 어디로 갔나요?

이들은 별도의 비공개 저장소에 있어요. 공개 클론은 SUSE 브랜드 팩을 전혀 가져오지 않으므로, 이로 만든 빌드는 다른 것을 고르지 않는 한 중립적인 `lolly-start` 프로필을 사용해요. 브랜드 중립 커뮤니티 도구와 직접 채우는 빈 브랜드예요. [lolly.tools](https://lolly.tools)는 `lolly-demo` 프로필로 빌드되며 Lolly 자체의 디자인 시스템인 [Lolly Demo](/info/lolly-demo.html)로 열려요. SUSE는 자사 상표를 보호하기 위해 자체 인스턴스를 운영해요.

## 그 Lolly 로고는 무슨 맛인가요?

누구는 라임이라 하고, 누구는 민트, 가끔은 사과라고도 해요. Lolly는 달콤함을 가져다주고, 맛은 여러분이 만들어 내는 거예요!
