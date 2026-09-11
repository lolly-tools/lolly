# 프로필 — 창작할 때의 나

**프로필**은 Lolly가 그 이름으로 제작 활동을 하는 작업 정체성입니다. 도구가 매번 다시 입력하지 않도록 가져다 쓸 수 있는 소소한 정보 모음으로 - 이름, 연락처, 선택적 프로필 사진, 몇 가지 환경설정 - 그리고 작업하면서 쌓이는 모든 것, 즉 저장된 세션, 업로드한 이미지, 로컬 활동 집계까지 포함합니다.

프로필의 모든 것은 **기기 안**, 즉 브라우저의 로컬 데이터베이스(웹 PWA는 IndexedDB, Tauri 앱은 파일시스템)에 저장돼요. 계정도 없고 아무것도 업로드되지 않아요. **프로필**(갤러리 오른쪽 위) 아래에서 관리할 수 있고, 도구는 프로필을 *읽기만* 하며, 그마저도 미리 채우도록 만들어진 특정 필드만 읽어요.

> 프로필은 *당신*(또는 여기서 제작 활동을 하는 사람) 자체에 관한 것입니다. 브랜드의 색상, 폰트, 전역 설정인 **Platform**과는 다르며, 앱이 할 수 있는 일의 목록인 **Capabilities**와도 다릅니다. 맨 끝의 [Profile vs Platform vs Capabilities](#profile-vs-platform-vs-capabilities)를 참고하세요.

## 프로필에 담기는 것

| 항목 | 내용 |
|---|---|
| **이름** | 성과 이름. |
| **연락처** | 이메일과 전화번호. |
| **위치** | 도시와 국가. |
| **프로필 사진** | 선택적인 사진으로, 정사각형으로 잘려 로컬 이미지로 보관됩니다. 이메일 서명, 인용 카드, 조직도, 동적 레이아웃 같은 도구에서 사용됩니다. |
| **내 정보로 제작** | 하나의 옵트인 스위치입니다(켜지면 **Using my details**로 표시됩니다). 켜면 내보낸 파일에 삽입되는 저자/크레딧 줄인 **출처(provenance)**로, 그리고 **/pro** 일괄 실행의 저자로 개인정보가 함께 실리는지를 제어합니다. (사전 채움 여부는 이 스위치가 아니라 다른 방식으로 제어됩니다: [How tools use your profile](#how-tools-use-your-profile) 참고.) |
| **환경설정** | 테마(라이트, 다크 또는 Brand - Brand 테마는 앱을 사용자 고유의 팔레트로 칠합니다)와 **Feature flags**를 통해 활성화한 앱의 부분들. |
| **접근성** | 네 가지 편의 스위치 - *동작 줄이기*, *화려한 미리보기 숨기기*, *고대비*, *큰 텍스트* - 는 프로필 레코드에 저장되므로 프로필 내보내기에도 함께 담깁니다. [Accessibility](#accessibility) 참고. |
| **작업물** | (썸네일이 있는) 저장된 세션 - **[Projects](/info/using.html)**의 중첩 폴더로 정리됨 - 사용자의 **My images** 라이브러리, 그리고 이 프로필에 연결된 로컬 활동 통계. |

![Three theme cards, each previewing its own type and colour, with the active one flagged](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

![프로필 화면 - 이름, 연락처, 선택적 프로필 사진, 환경설정](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

이 중 어느 것도 필수가 아니에요. 빈 프로필도 완전히 정상적인 프로필이에요. 타이핑을 줄여주는 항목만 채우면 돼요.

이 페이지는 길기 때문에 옆쪽에 자체 **설정 레일**을 두고 있습니다 - Your details, Appearance, Accessibility, Lolly instance, Your activity, Storage, Available offline, Feature flags, Content Credentials 순서로, 그 위에는 입력하는 대로 목록을 필터링하는 **Search settings** 필드가 있습니다. 모든 섹션은 `#/profile?focus=<section-id>` 형태로 딥링크가 가능하며, 이 링크는 해당 섹션을 열고 화면에 스크롤해 보여줍니다(`#/profile?focus=storage-section`, `?focus=feature-flags-section` 등). 그래서 링크가 페이지 맨 위가 아니라 하나의 설정을 정확히 가리킬 수 있습니다.

![세 개의 테마 카드, 각각 고유한 서체와 색상을 미리 보여주며, 활성화된 카드가 표시됨](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

## 프로필은 사람이 아니라 맥락이에요

"프로필"이라는 단어는 고정된 한 사람을 떠올리게 하지만, Lolly에서 프로필은 사실 **창작 맥락**이에요 — *이걸 만드는 동안 나는 누구인가*를 뜻해요. 이 맥락은 세 가지 다른 형태를 취할 수 있고, Lolly는 이 셋을 모두 똑같은 방식으로 다뤄요.

### 개인으로서

![The headshot control, empty until you upload a photo that then stays on this device](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

![프로필 사진 컨트롤 - 사진을 업로드하기 전까지는 비어 있고, 업로드하면 이 기기에 보관됨](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

### 팀으로서

프로필이 반드시 한 사람이어야 하는 것은 아닙니다. **조직 내 팀이나 부서**를 대신할 수도 있습니다: 팀의 공유 이름, 그룹 수신함 주소(`events@…`), 부서, 팀의 프로필 사진이나 유닛 마크 등입니다. 한 사람이 설정하고 내보내면(아래 참고) 나머지 팀원들은 같은 프로필을 불러옵니다 - 그러면 누구도 다시 입력할 필요 없이 팀이 만드는 모든 결과물이 일관된 정보를 담게 됩니다. 공용 키오스크나 대여용 데모 노트북도 그 뒤에 서는 모두가 같은 이름으로 제작하는 단일 팀 프로필로 운영할 수 있습니다.

### 기능으로서 — 가끔 걸치는 역할

고정된 "한 사람, 하나의 프로필" 모델로는 담아낼 수 없는 경우예요. 누군가는 **1년에 사흘만 이벤트 매니저**이고, 나머지 기간은 완전히 다른 무언가일 수 있어요. 그 사흘 동안은 이벤트 정보, 이벤트 수신함, 어쩌면 배지와 사이니지에 들어갈 이벤트 서브 브랜드가 필요하고, 나머지 362일은 평소의 정체성으로 돌아가고 싶을 거예요.

Lolly에서 그 역할은 그저 **손 닿는 곳에 두는 또 하나의 프로필**이에요 — 이벤트를 위해 불러오고 끝나면 치워두는 저장된 번들(다음 절 참고)이죠. 역할은 새로운 계정이 아니라 모자예요. 필요할 때 쓰고, 끝나면 벗으면 돼요.

## 설치본 하나에 활성 프로필 하나 — 보관할 수 있는 수는 제한 없어요

어느 순간이든 설치본에는 **활성 프로필 하나**만 있습니다 - 도구가 지금 보고 있는 정보입니다. 앱 안에 프로필 전환기는 없습니다. 대신 각 프로필은 **이동 가능한 번들**입니다(하나의 `.zip` 파일, [아래](#moving-a-profile-to-a-new-device) 참고). 이는 새 기기로 옮길 때와 의도적으로 같은 방식입니다 - 프로필은 저장하고 복사하고 불러올 수 있는 파일입니다.

![The storage meter, breaking down saved sessions, images and cache against what the browser actually reports](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

- <!--i:trash--> **가장 깔끔한 전환:** **Profile → Storage → Clear all my data**를 실행한 다음, 새로 들어갈 맥락에 맞는 번들을 **Import**합니다. 이제부터는 오직 그 프로필로만 제작합니다.
- <!--i:layers--> **레이어링:** 먼저 지우지 *않고* 가져오면 **병합**됩니다 - 가져온 프로필, 세션, 이미지가 기존 내용 위에 얹혀, 이름이 같은 항목은 대체하고 나머지는 그대로 둡니다. 한 팀의 저장된 세션을 내 설정에 끌어오고 싶을 때 유용하지만, 깔끔한 역할 경계가 필요할 때는 적합하지 않습니다.
- <!--i:monitor--> **나란히 운영:** 모든 것이 기기 범위이므로, 별도의 브라우저 프로필, 별도의 사용자 계정, 또는 두 번째로 설치한 PWA는 각각 독립된 Lolly 프로필을 갖습니다. 전환할 필요 없이 개인 설치본과 행사용 키오스크 설치본을 동시에 실행할 수 있습니다.

여러 맥락(나, 팀, 이벤트 매니저라는 모자)을 실제로 오간다면, 여러 개의 번들을 보관해두고 필요한 것을 불러오면 돼요.

![저장된 세션, 이미지, 캐시를 브라우저가 실제로 보고하는 값과 비교해 세분화해 보여주는 저장용량 미터](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

> 맥락마다 번들을 하나씩 보관하고, 파일 이름을 내용에 맞게 바꿔두세요(`LollyTools-events-2026.zip`, `LollyTools-me.zip`). 그 파일 *자체가* 프로필이에요.

## 접근성

**Profile → Accessibility**에는 작업물 *주변* 앱을 위한 네 가지 편의 설정이 있습니다. 각 설정은 켜기 전까지 꺼져 있으며, 어느 것도 도구 캔버스나 내보내기 안쪽에는 영향을 주지 않습니다 - 차분해진 앱이라도 사용자가 내보내는 파일의 픽셀 하나까지 건드려서는 안 됩니다.

- <!--i:film--> **동작 줄이기** - 앱 안의 전환, 슬라이드, 애니메이션 효과를 끕니다. 도구 캔버스와 애니메이션 내보내기는 설계된 그대로 계속 움직입니다.
- <!--i:image--> **화려한 미리보기 숨기기** - 갤러리 미리보기 이미지를 차분한 아이콘-텍스트 카드로 바꾸고, 프로젝트 썸네일의 색상과 대비를 낮춰 요란하지 않으면서도 알아볼 수 있게 유지합니다. 도구 안에서는 모든 것이 원래 색상 그대로 표시됩니다.
- <!--i:sliders--> **고대비** - 앱의 테두리, 텍스트, 포커스 링을 강화합니다. 브랜드 색상과 캔버스 위의 모든 요소는 설정한 그대로 유지됩니다.
- <!--i:font--> **큰 텍스트** - 앱 서체를 키웁니다: 레이블, 메뉴, 버튼 텍스트. 컨트롤 자체의 크기는 그대로이므로 그 안의 글자만 커지며, 디자인 안의 서체는 손대지 않으므로 내보내는 결과물의 레이아웃은 흐트러지지 않습니다.

이 설정들은 프로필 레코드 자체에 저장되므로 프로필 내보내기에 함께 담겨 이름, 세션과 함께 다음 설치본으로 옮겨갑니다. (기기에는 첫 페인트 이전부터 설정이 적용되도록 작은 로컬 미러도 보관되는데, 이 미러는 기기 전용이며 이동하지 않습니다.)

## 사용 중인 Lolly 인스턴스

**Profile → Lolly instance**는 이 설치본이 도구와 카탈로그를 어디에서 가져오는지 - 인스턴스의 주소, 혹은 모든 것이 빌드 안에 포함된 경우 *Bundled with this app*를 표시합니다. 배포본이 제공하는 경우 **Instance console** 링크로 관리 화면을 열 수 있고, **Change**/**Disconnect**로 설치본을 다른 곳으로 재지정하거나 연결을 끊을 수 있습니다.

다른 인스턴스로 재지정하려면 **데스크톱 앱**이 필요합니다. 브라우저는 페이지가 다른 오리진에서 도구와 자산을 불러오는 것을 차단하므로, 웹에서는 이 섹션이 현재 위치만 표시할 뿐 거기서 더 나아가지 않습니다.

## 오프라인 사용 가능

Lolly는 사용하는 동안 계속 캐시를 쌓지만, 이런 자연스러운 캐싱은 이미 다녀온 곳만 커버합니다. **Profile → Available offline**은 미리 예상되는 여정을 위한 것입니다: 연결이 끊기는 비행 전, 공항 와이파이가 되는 한 시간 같은 상황 말이죠. 필요한 부분을 내려받고 진행률 표시줄 하나만 지켜보면, 챙긴 모든 것이 연결이 끊긴 뒤에도 계속 작동합니다.

필요한 부분마다 다운로드 전에 용량이 표시되는 일곱 가지 항목입니다.

- <!--i:layout--> **앱** - 아직 열어보지 않은 화면까지 포함해 모든 화면, 편집기, 폰트입니다. 이것이 없으면 온라인 상태에서 방문한 적 없는 화면은 오프라인에서 불러올 수 없습니다.
- <!--i:image--> **카탈로그** - 필수 요소를 넘어서는 브랜드 자산입니다. 전부 받거나, *Choose by tag*를 열어 사용하는 태그만 받을 수 있습니다.
- <!--i:book--> **가이드와 문서** - 스크린샷을 포함한 사용자 언어의 이 문서 사이트입니다.
- <!--i:cpu--> **음성 목소리** - Script의 오디오와 내레이션을 뒷받침하는 음성 모델입니다. 한 번 내려받으면 이후에는 기기에서 실행됩니다.
- <!--i:zap--> **업스케일링 모델** - AI 이미지 업스케일러입니다: 사진, 일러스트/애니메, 얼굴.
- <!--i:layers--> **배경 제거** - *Remove background* 기능을 뒷받침하는 기기 내 컷아웃 모델입니다.
- <!--i:shield--> **Verify 심층 스캔** - 연결이 없는 곳에서 Content Credentials를 확인하기 위한 기기 내 워터마크 스캐너입니다.

마지막 네 가지는 **대용량 다운로드**로 표시되며, 의도적으로 개별 옵트인 방식입니다. 맨 위의 **모두 다운로드**는 앱, 선택한 카탈로그 범위, 문서와 모든 도구를 한 번에 가져올 뿐 그 외에는 아무것도 하지 않습니다. 음성, 업스케일러, 배경 제거와 심층 스캔은 각각 해당 행을 이름으로 지정해 요청할 때만 다운로드됩니다 - 버튼 하나에 수백 메가바이트가 숨어 있다면 정직하지 않을 테니까요.

각 파트 아래에는 도구별 목록이 있습니다: 각 도구를 개별적으로 다운로드하거나(체크 표시는 오프라인 준비 완료를 뜻합니다), **모두 다운로드**로 전부 한 번에 가져올 수 있습니다. 다운로드는 재개 가능합니다 - 취소하거나 연결이 끊겨도 다음 실행 시 중단된 지점부터 이어받아 누락된 부분만 가져옵니다 - 그리고 온라인 상태로 돌아오면 새 릴리스에서 변경된 부분만 가져와 자동으로 갱신됩니다.

브라우저가 영구 저장소 권한을 부여하지 않은 경우 이 섹션에서 그 사실을 알리고 **다운로드 보호**를 제공하는데, 이는 권한을 요청합니다 - "다운로드됨"과 "브라우저가 공간을 회수하기 전까지만 다운로드됨"의 차이입니다.

## 프로필을 새 기기로 옮기기

![The two buttons that move a whole install: Export my data writes one zip, Import data reads it back](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

프로필은 완전히 로컬에만 있기 때문에, 이를 새 설치본 — 새 노트북, 방금 초기화한 브라우저, 동료의 컴퓨터, 오프라인 기기 — 으로 옮기는 유일한 방법은 **파일을 직접 옮기는 것**이에요. 로그인으로는 복원되지 않아요. 그게 핵심이에요 — 애초에 기기 밖으로 나간 적이 없으니까요.

- <!--i:download--> **내 데이터 내보내기**는 `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` 파일 하나를 다운로드합니다 - 해당하는 프로필 이름을 따르며, 반복 내보내기가 충돌하지 않도록 일별 일련번호가 붙습니다(프로필에 해당 항목이 없으면 이름 부분은 생략됩니다). 여기에는 프로필, 저장된 모든 세션(썸네일 포함), 업로드한 이미지 - 브랜드 토큰과 설치된 폰트도 사용자 자산으로 함께 포함됩니다 - 그리고 환경설정(테마, 레이아웃, 로컬 활동 통계)이 담깁니다.
- <!--i:upload--> 다른 설치본의 **데이터 가져오기…**는 그 파일을 다시 읽어들여 중단했던 지점 그대로 이어갑니다.
- <!--i:box--> **내 데이터 내보내기 및 전체 렌더링**은 동일한 백업을 작성하면서 *더불어* 저장된 모든 세션을 완성된 출력 파일로 렌더링한 두 번째 zip을 Projects 구조를 그대로 반영하는 폴더에 작성합니다. 소스와 결과물 모두를 담은 완전한 오프라인 아카이브입니다 - 세션이 많으면 용량이 크고 느릴 수 있습니다.

![설치본 전체를 이전하는 두 버튼: 내 데이터 내보내기는 zip 하나를 작성하고, 데이터 가져오기는 그것을 다시 읽어들입니다](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

번들은 그 자체로 완결된 평범한 zip 파일이라서 USB, AirDrop, 네트워크 공유, 자신에게 보내는 이메일 등 **어떤** 방법으로도 옮길 수 있고, 대상 기기가 완전히 오프라인이어도 괜찮아요. 각 부분에는 체크섬이 있어서, 전송 중 손상된 파일은 어중간하게 복원되지 않고 가져오는 시점에 걸러져요. 가져오기는 **병합**되기 때문에(이름이 같은 프로필/세션/이미지는 덮어쓰고, 나머지는 그대로 유지) 이미 사용 중인 대상 기기를 지워버리는 일은 없어요.

함께 옮겨지지 않는 것: 카탈로그 캐시(새 기기에서 스스로 다시 다운로드돼요)와 도구 자체(이미 있다고 전제해요).

정확한 번들 구조, 버전 정책과 무결성 규칙은 **[Data Transfer](/info/data-transfer.html)**를, 전체 진행 절차는 **[Using Lolly → Moving to another device](/info/using.html#moving-to-another-device)**를 참조하세요.

## 도구가 프로필을 사용하는 방식

![The single Use my details switch, sitting beside Save Profile and off until you turn it on](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

도구는 명시적으로 연결하도록 만들어진 프로필 필드만 *미리 채워요*.

**옵트인 (출처 정보).** 자산을 내보낼 때 사용자 정보는 선택적으로 **출처 정보(provenance)**로 함께 실릴 수 있습니다 - 파일 메타데이터(PNG, PDF, SVG 등)에 삽입되는 작성자/크레딧 라인입니다 - 완성된 자산이 누가 만들었는지 밝힐 수 있게 합니다. **내 정보를 사용하여 제작**이 통제하는 것이 바로 *이것*입니다: 꺼두면 내보내기에는 여전히 "Made with Lolly" 도구/플랫폼 표시가 남지만 개인 작성자/연락처 라인은 삽입되지 않습니다. (같은 옵트인이 **/pro** 일괄 실행의 작성자도 설정합니다.) (도구 제작자용: [Authoring Tools → `bindToProfile`](/info/authoring-tools.html#bindtoprofile)와 [Host API → `host.profile`](/info/host-api.html#host-profile)을 참조하세요.)

![Save Profile 옆에 있는 단일 스위치 내 정보를 사용하여 제작, 켜기 전까지는 꺼져 있습니다](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## 프로필 vs 플랫폼 vs 기능

이 셋은 UI에서 서로 가까이 놓여 있어서 헷갈리기 쉬워요.

- <!--i:people--> **Profile** - *사용자* 본인(또는 팀, 또는 맡은 역할): 이름, 연락처, 프로필 사진, 저장한 작업물. 개인적이며 기기에 저장되고 번들로 이동 가능합니다.
- <!--i:palette--> **Platform** - *브랜드*: 모든 도구가 렌더링 기준으로 삼는 색상, 폰트와 전역 설정. 공유되고 일관되며 개인적이지 않습니다.
- <!--i:sliders--> **Capabilities** - *앱이 할 수 있는 것*: 전체 기능 세트와 사용 가능한 도구.

프로필은 에셋이 *누구로부터* 나온 것인지를 바꾸고, 플랫폼은 그게 *어떻게 보이는지*를 바꾸며, 기능은 *무엇을 만들 수 있는지*를 결정해요.

### 다른 곳의 "프로필" — 이 페이지의 프로필이 아니에요

이 단어는 프로젝트 전반에서 여러 의미로 쓰여요. 아래 둘 다 이 페이지에서 다루는 개인 프로필과는 달라요.

- <!--i:box--> **Content profile** - `profiles.json`에 있는 빌드 타임 구성으로, 도구 팩 집합을 브랜드 카탈로그(예: `suse`, `lolly-start`)에 연결합니다. 배포 시 운영자가 선택하는 것이며, `profile` **URL/CLI 매개변수**도 내보내기 시점에 *색상* 변형(ICC/CMYK 인쇄 조건 - [URL Mode](/info/url-mode.html) 참조)을 선택합니다. 둘 다 *사용자* 자신이 아니라 *빌드/출력물*에 관한 것입니다. [Configuration](/info/configuration.html)을 참조하세요.
- <!--i:seal--> **Identity profile** - 선택적으로 등록할 수 있는 **검증된 Content Credentials 신원**(이메일을 서명된 내보내기에 연결하는 단기 인증서)입니다. 이는 개인 프로필의 이름/연락처 필드와는 별개인 서명용 신원이지만, **내 정보를 사용하여 제작**이 둘 중 어느 쪽이 삽입될지를 통제합니다. [Content Credentials Identity](/info/content-credentials-identity.html)를 참조하세요.

![휴대폰 폭의 검증된 신원 카드: 인증서 유효기간 선택기와 그 아래의 등록 단계 - 개인 정보와는 별개인 신원 프로필](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## 프라이버시

위의 선택적 신원 등록(등록 시 입력한 이메일을 인증서 서비스로 전송합니다 - [Server Surface](/info/server-surface.html) 참조)을 제외하면, 프로필은 전송되거나 업로드되거나 사용자를 식별·추적하는 데 쓰이지 않습니다 - 동의할 대상이 없으며, 보관되는 내용을 알리는 이 안내뿐입니다. **Profile → Clear all my data**로 언제든 전부 삭제할 수 있습니다. [Privacy Policy](/info/privacy.html)를 참조하세요.
