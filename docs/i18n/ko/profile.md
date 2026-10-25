# 프로필

이름, 연락처, 프로필 사진을 한 번 설정하면 이를 쓰도록 만들어진 모든 도구가 대신 채워줘요. 이메일 서명, 배지, 발표자 카드 등이에요. 이 작은 기록이 사용자의 **프로필**이며 기기에 있어요.

프로필에는 작업하면서 쌓이는 것도 담겨요. 저장된 세션, 업로드한 이미지, 로컬 활동 집계예요. **Settings → Preferences**에서 관리하며, 도구는 미리 채우도록 만들어진 필드만 읽어요. 독립 실행형 사용에는 계정이 필요 없고, 선택 사항인 Sync, 공유, 조직 서비스에는 아래에서 설명하는 각자의 데이터 흐름이 있어요.

## 프로필에 담기는 것

| 부분 | 설명 |
|---|---|
| **Name** | 이름과 성. |
| **Contact** | 이메일과 전화번호. |
| **Location** | 도시와 국가. |
| **Headshot** | 이메일 서명, 견적 카드, 조직도 같은 도구를 위해 정사각형으로 잘라 로컬 이미지로 보관하는 선택적 사진. |
| **Use my details to create** | 동의 스위치 하나(한 번 켜면 **Using my details**로 표시돼요). 내보낸 파일과 Batch 실행에서 세부 정보가 작성자 크레딧으로 전달될지를 정해요. 미리 채우기에는 영향이 없으며 [도구가 프로필을 쓰는 방식](#how-tools-use-your-profile)을 참고하세요. |
| **Preferences** | 테마, 접근성 설정, **Feature flags**에서 켠 앱의 부분. |
| **Your work** | 썸네일이 있는 저장된 세션([Projects](/info/find-your-work.html)에 정리됨), 업로드한 이미지, 로컬 활동 통계. |

이 중 필수인 것은 없어요. 빈 프로필도 작동하니 입력을 줄여주는 것만 채우세요.

![Preferences 탭의 Settings: 설정 레일, 그리고 Use my details to create 스위치와 이름, 연락처, 위치 필드가 있는 Your details](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

[Settings](/info/dashboard.html)가 모양과 이모지부터 저장소와 오프라인 다운로드까지 Preferences의 나머지를 정리해요.

## 개인, 팀, 역할

"프로필"이라는 말은 고정된 한 사람을 떠올리게 해요. Lolly에서는 만드는 맥락, 즉 이것을 만드는 동안의 내가 누구인지에 더 가까워요. 세 가지 형태가 가능하며 Lolly는 각각을 같은 방식으로 처리해요.

::: cols
## 나 자신으로

기본값이에요. 이름, 이메일, 프로필 사진이에요. 한 번 설정하면 서명, 배지, 콘퍼런스 로고 조합이 저절로 채워져요.

## 팀으로

팀의 공유 이름, `events@…` 같은 그룹 받은편지함, 부서, 팀의 마크예요. 한 사람이 설정하고 내보내면 나머지가 같은 프로필을 불러오므로, 팀의 파일에 일관된 세부 정보가 담겨요. 공용 키오스크나 데모 노트북에서 팀 프로필 하나를 실행할 수 있어요.

## 역할로

1년에 사흘만 일하는 행사 매니저는 배지와 사이니지에 행사 받은편지함과 행사 서브 브랜드를 원하고, 그다음에는 평소의 신원으로 돌아가요. 그 역할을 저장된 프로필 파일로 보관하고, 행사 때 불러오고, 끝나면 치워 두세요.
:::

![The headshot control, empty until you upload a photo that then stays on this device](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

::: details Lolly Work를 쓰는 조직의 프로필
[조직의 Lolly](/info/organisation.html)에 로그인하면 Lolly Work가 신원 공급자로부터 검증된 프로필 필드를 제공하고 조직 정책에 따라 필드나 환경설정을 고정할 수 있어요. 관리되는 필드는 앱에 표시돼요.

그 로그인은 공유 프로젝트와 에셋의 접근도 제어해요. 팀 프로필 파일은 여전히 로컬 파일이며, 조직 멤버십을 부여하거나 업무 계정을 대체하지 않아요. **Use my details to create**는 내보내기의 크레딧을 제어하며 조직의 로그인이나 감사 기록은 제어하지 않아요. [개인정보](/info/privacy.html#organisation-services-with-lolly-work)를 참고하세요.
:::

## 여러 개를 보관하고 하나를 사용하기

설치에는 한 번에 활성 프로필이 하나 있으며 앱 안의 전환기는 없어요. 대신 각 프로필은 새 기기로 옮길 때 쓰는 것과 같은 이식 가능한 백업 파일이에요. 다른 맥락으로 들어가려면 이렇게 해요.

::: timeline
- <!--i:download--> **Settings → Storage → Move to another device**의 **Export my data**가 현재 프로필을 `.zip` 하나로 저장해요.
- <!--i:trash--> **Clear all my data**가 이 설치를 비워요.
- <!--i:upload--> **Import data…**가 들어가려는 맥락의 프로필 파일을 불러와요.
:::

먼저 지우지 않고 가져오면 대신 **병합**돼요. 가져온 세션과 이미지가 추가되고, 두 사본이 모두 있으면 더 최근에 저장한 것이 유지돼요. 폴더, 즐겨찾기, 템플릿은 기존 것 옆에 추가되고, 비어 있는 필드를 제외한 사용자의 세부 정보는 그대로 있으며 빈 필드는 파일의 값을 받아요. 한 팀의 세션을 자신의 설정으로 가져오기에는 알맞지만, 역할 사이를 깔끔하게 끊는 데는 맞지 않아요.

두 맥락을 동시에 쓰려면 별도의 브라우저 프로필, 별도의 사용자 계정 또는 웹 앱을 두 번째로 설치한 사본을 쓰세요. 각각 독립적인 Lolly 프로필을 가져요.

![설치 전체를 옮기는 두 버튼: Export my data는 zip 하나를 쓰고, Import data는 다시 읽어요](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> 맥락마다 파일 하나를 보관하고 `LollyTools-events-2026.zip`, `LollyTools-me.zip`처럼 무엇인지 알 수 있게 이름을 붙이세요. 그 파일이 곧 프로필이에요.

[작업물을 다른 기기로 옮기기](/info/find-your-work.html#move-your-work-to-another-device)가 파일에 담기는 것, 남는 것, Sync를 포함한 다른 이동 방법을 다뤄요.

## 도구가 프로필을 사용하는 방식

**미리 채우기.** 도구 작성자는 입력이 프로필에서 값을 가져오도록 표시해요(`bindToProfile: "firstname"`, `"email"`, `"headshot"` 등). 도구가 열리면 그 입력이 프로필에서 채워지며, 조직 정책이 입력을 잠그지 않는 한 프로필을 바꾸지 않고 한 세션에 한해 덮어쓸 수 있어요. 미리 채우기는 로컬 편의 기능이며 **Use my details**의 켜짐 여부와 상관없이 일어나요.

**크레딧.** 내보낼 때 세부 정보가 파일 메타데이터(PNG, PDF, SVG 등)에 작성자 크레딧으로 전달될 수 있어서, 완성된 파일이 누가 만들었는지 밝힐 수 있어요. **Use my details to create**가 이를, 그리고 Batch 실행의 작성자를 제어해요. 꺼져 있으면 내보내기는 여전히 Lolly로 만들었다고 밝히지만 개인 작성자나 연락처 줄은 담지 않아요.

도구 작성자는 [`bindToProfile`](/info/tool-inputs.html#bindtoprofile)과 [`host.profile`](/info/host-api.html#host-profile)을 참고하세요.

![하나뿐인 Use my details to create 스위치: 옵트인으로 표시되며 켜기 전에는 꺼져 있어요](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## 프로필, 디자인 시스템, 기능

Settings에서 서로 가까이 있어 헷갈리기 쉬운 세 가지가 있어요.

- <!--i:people--> **Profile**: 나, 팀 또는 지금 맡은 역할로, 이름, 연락처, 프로필 사진, 저장된 작업물이에요. 개인적이며 기기에 보관되고 파일로 이식할 수 있어요.
- <!--i:palette--> **Design system**: 브랜드로, 모든 도구가 렌더링에 쓰는 색상, 글꼴, 설정이에요. 개인적이지 않고 공유되며 일관돼요. [Design System Setup](/info/brand-studio.html)을 참고하세요.
- <!--i:sliders--> **Capabilities**: 앱이 할 수 있는 일로, 사용할 수 있는 기능과 도구예요.

프로필은 파일이 누구에게서 왔는지를 바꾸고, 디자인 시스템은 파일의 모습을 바꾸며, 기능은 만들 수 있는 것이에요.

이 단어는 Lolly에서 다른 의미가 세 가지 더 있어요. **콘텐츠 프로필**은 배포가 어떤 도구와 카탈로그를 포함하는지 고르는 빌드 설정이며, [용어집](/info/glossary.html)이 이 용어를 정의해요. `profile` 링크 매개변수는 CMYK 인쇄 조건 같은 내보내기의 색상 프로필을 골라요. [예약된 URL 매개변수](/info/url-parameters.html#print)를 참고하세요. **검증된 신원**은 이메일을 서명된 내보내기에 연결하는 선택적 서명 인증서로 이 세부 정보와 별개이지만, 둘 중 어느 것을 임베드할지는 **Use my details to create**가 정해요. [Content Credentials](/info/content-credentials-identity.html)를 참고하세요.

![The Verified identity card, phone-width: the certificate lifetime picker and the enrolment step beneath it - the identity profile, separate from your personal details](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## 프라이버시

개인 프로필은 로컬에 저장돼요. 세부 정보는 백업이나 Sync 사본, 공유하거나 내보내는 콘텐츠, 선택적 Content Credentials 등록 중에 전달될 수 있어요. Lolly Work 인스턴스에서 로그인, 공유 작업, 원격 측정 정책, 감사 기록은 이 로컬 프로필과 별개예요. **Settings → Preferences → Clear all my data**는 이 기기를 지우며, 저장소 공급자나 조직이 보관한 사본은 지우지 않아요. [개인정보 처리방침](/info/privacy.html)을 참고하세요.
