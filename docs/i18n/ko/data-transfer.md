# 데이터 전송 - `lolly-backup` 번들

Lolly 사용자가 쌓아온 모든 것은 **기기에** 있어요 - 계정도 없고 클라우드도 없어요. 데이터 전송 번들은 그 가치를 옮기는 방법이에요. 한 설치본에서 내보내고, 파일을 어떤 수단으로든(USB, AirDrop, 자신에게 보내는 이메일, 네트워크 공유) 옮긴 뒤, 다른 설치본에서 가져와요. 파일 자체가 전송 수단이에요. 대상은 오프라인이든 온라인이든 상관없어요. 서버와는 아무것도 통신하지 않으니까요.

![설치본 전체를 이전하는 두 버튼: 내 데이터 내보내기는 zip 하나를 작성하고, 데이터 가져오기는 그것을 다시 읽어들입니다](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

이 페이지는 형식 명세예요. 최종 사용자용 안내는 [Using Lolly → Moving to another device](/info/using.html)를 참고하세요. 구현체는 [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts)이고, [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts)가 왕복 계약을 고정해요.

> **범위.** 번들은 *사용자 데이터*를 담을 뿐 도구는 담지 않아요. 도구와 카탈로그 자산은 별도로 동기화되며 대상에 이미 존재한다고 가정해요(최악의 경우 더 높은 버전으로). 가져오기는 절대 도구를 설치하거나 업그레이드하지 않아요.

## 목표

- <!--i:box--> **하나의 형식, 모든 셸.** 웹 PWA, Tauri 데스크톱/모바일 앱, 그리고 앞으로 나올 어떤 셸이든 같은 바이트를 생성하고 소비해요. 번들이 곧 계약이에요. 각 셸의 캐퍼빌리티 브리지는 그 뒤에 있는 플랫폼별 어댑터예요.
- <!--i:shieldcheck--> **이동을 견뎌요.** 전송 중 손상되거나 잘린 번들은 가져오기 시 크게 실패할 뿐, 절대 절반만 복원되지 않아요.
- <!--i:clock--> **이번 버전보다 오래 살아남아요.** 구버전 앱도 신버전 번들 중 자신이 인식하는 부분은 가져올 수 있어요. 진짜로 호환되지 않는 형식은 깔끔하게 거부돼요.
- <!--i:check--> **병합해도 안전해요.** 이미 사용 중인 설치본에 가져오기를 해도 번들에 없던 항목은 절대 지워지지 않아요.

## 봉투(envelope)

번들은 평범한 `.zip`이에요. 다운로드 파일명은 소유자 이름을 따라요 - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`(예: `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - 그래서 백업이 쌓인 다운로드 폴더도 알아보기 쉬워요. 이름과 성 부분은 프로필에서 가져오며 설정되지 않으면 생략돼요. 프로필이 없으면 `LollyTools-2026-06-26-1.zip`이 되고, 이름만 있으면 `LollyTools-Ada-2026-06-26-1.zip`이 돼요. 각 부분은 파일명에 안전한 토큰으로 정제돼요(유니코드 문자/숫자는 유지하고 공백/구두점은 제거하며 최대 32자로 제한). `<n>`은 일별, 기기별 시퀀스라 같은 날 반복 내보내기도 충돌 없이 순서를 유지해요. [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts)의 `backupFilename()`이 이름을 만들어요. zip의 내용물은 이름과 무관하게 동일해요. 내부 구성:

| 경로 | 필수 여부 | 내용 |
|---|---|---|
| `manifest.json` | 예 | 형식 id, 버전, 개수, 부분별 무결성 정보. 리더가 가장 먼저 보는 것. |
| `profile.json` | 설정된 경우 | 사용자의 `me` 레코드(이름, 연락처, 프로필 사진 참조, 플래그). `host.profile`로 읽음. |
| `sessions.json` | 예 | 저장된 모든 세션: 슬롯, 도구 id/버전, 라벨, 썸네일(data-URL), 전체 입력 데이터. `host.state`로 읽음. |
| `assets.json` | 예 | 업로드된 각 자산(이미지, 폰트, 브랜드 토큰)의 메타데이터. 각각 `assets/blobs/` 아래의 바이트를 가리킴. |
| `assets/blobs/<n>.<ext>` | 자산별 | 원본 자산 바이트(이미지와 폰트 파일). 이미 압축된 형식이라 압축하지 않고 저장. 확장자는 겉모습일 뿐. `assets.json`의 MIME이 신뢰 정보. |
| `prefs.json` | 예 | 사용자 소유의 로컬 환경설정: `theme`, `sidebarWidth`, `ct-metrics` 활동 집계. |
| `lolly.txt` | 예 | Lolly 없이 zip을 여는 사람을 위한 번들의 사람이 읽기 쉬운 요약(개수, 프로필, 파일명). 내보낼 때마다 다시 생성되고 가져올 때 인식되므로, 건너뛴 부분으로 취급되지 않음. 무결성 맵 *이후에* 작성되므로 그 맵의 대상에서는 제외됨. |

번들을 평범한 zip으로 만든 건 의도적이에요. 어떤 전송 수단을 거쳐도 손상 없이 살아남고, 어떤 압축 해제 도구로도 내용을 살펴볼 수 있으니까요.

`profile.json`은 가장 작은 부분이면서 앱에서 리더가 가장 먼저 보게 되는 부분이에요. 작성자가 한 번 채워 넣는 정보와, 도구가 그 정보를 사용하도록 허용하는 옵트인이에요.

![profile.json이 되는 Profile 상세 정보 폼 - 이름, 연락처, 프로필 사진, 그리고 옆의 옵트인](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 1,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.webp": "sha256-…",
    "prefs.json": "sha256-…"
  }
}
```

| 필드 | 의미 |
|---|---|
| `format` | 항상 `lolly-backup`. 이 값이 없는 파일은 "Lolly 백업이 아님"으로 거부됨. |
| `formatVersion` | 이 번들이 **작성될 때** 사용한 레이아웃. 구성 요소나 형태가 바뀌면 올라감. 리더는 이 값으로 판단하지 **않음**. |
| `minReader` | 이 번들을 **안전하게** 가져오는 데 필요한 최소 리더 버전. 리더가 실제로 판단 기준으로 삼는 필드. |
| `app` | 생성한 앱 id, 진단용. |
| `exportedAt` | 번들이 생성된 ISO 타임스탬프. |
| `counts` | 작성자가 무엇을 담았는지, 표시와 정합성 확인용. |
| `integrity` | 선택 사항. `manifest.json`을 제외한 모든 부분을 그 **압축 해제된** 바이트의 SRI 형식 `sha256-<base64>` 다이제스트에 매핑. |

## 버전 정책(하위 호환성)

`formatVersion`과 `minReader`를 분리한 덕분에 구버전 설치본을 소외시키지 않고도 형식을 확장할 수 있어요.

- 리더는 `manifest.minReader ≤` 자신의 리더 버전일 때 번들을 가져와요. 번들이 명시적으로 더 새로운 리더를 요구할 때만("앱의 최신 버전이 필요합니다"라며) 거부해요.
- **추가적인** 변경 - 새로운 *선택적* 부분, 또는 새로운 선택적 매니페스트 필드 - 은 `formatVersion`을 올리지만 `minReader`는 그대로 둬요. 구버전 앱도 자신이 인식하는 모든 부분은 여전히 가져와요. 인식하지 못하는 부분은 (아래 참고) 조용히 버려지는 게 아니라 건너뛰어져요.
- **호환성을 깨는** 변경 - 부분을 잘못 가져오면 데이터가 손상되거나, 이전엔 선택적이던 부분이 필수가 되는 경우 - 은 `minReader`를 올려요. 구버전 앱은 처리할 수 없는 것을 가져오려 시도하는 대신 깔끔하게 거부해요.
- 미래의 번들이 `formatVersion`은 설정하되 `minReader`를 생략하면, 리더는 보수적으로 `formatVersion` 기준으로 판단해요(변경을 호환성을 깨는 것으로 취급).

> **작성자를 위한 경험칙:** 기존의 모든 리더가 여러분의 추가 사항을 무시하고도 여전히 올바르게 동작한다면 그건 추가적인 변경이에요 - `formatVersion`을 올리고 `minReader`는 그대로 두세요. 그렇지 않다면 `minReader`를 올리세요.

## 무결성

`manifest.integrity`가 있으면 리더는 **아무것도 쓰기 전에** 나열된 각 부분의 SHA-256을 검증해요. 불일치("무결성 검사 실패")나 누락된 부분("불완전")이 있으면 가져오기 전체가 중단돼요 - 부분 복원은 없어요. 이는 파일 전송 과정에서 생길 수 있는 손상을 잡아내요(잘린 AirDrop 전송, 첨부파일을 다시 인코딩한 이메일 게이트웨이, 불량 USB 섹터 등).

무결성 검증은 설계상 최선을 다하는 방식이에요. Web Crypto를 사용할 수 있는 곳(모든 보안 브라우저 컨텍스트와 최신 Node)에서만 작성되고, 맵과 Web Crypto가 둘 다 있을 때만 검증돼요. 맵이 없는 번들 - 예를 들어 무결성 기능이 생기기 전의 번들 - 은 그대로 가져와져요. "검증할 수 없음"은 절대 "손상됨"으로 취급되지 않아요.

매니페스트는 자기 자신도, 다시 생성되는 `lolly.txt` README도 나열하지 않아요. 다이제스트는 매니페스트가 보증하는 부분만 다뤄요.

## 가져오기 의미론

가져오기는 **병합 후 덮어쓰기**이며, 전체 교체가 절대 아니에요.

- 대상에 있는 기존 데이터는 그대로 남아요.
- 충돌하는 키 - 프로필, 세션 슬롯, 업로드된 이미지 id - 는 가져온 사본으로 교체돼요.
- 번들에 없던 것은 아무것도 건드리지 않아요. 대상에는 있었지만 번들에는 없던 세션은 가져오기 이후에도 살아남아요.

저장된 세션은 이미지와 자동으로 다시 연결돼요. 자산 참조는 id로 유지되며, 업로드된 이미지가 복원된 뒤 브리지가 이를 다시 해석해요(어차피 그렇게 해야 해요. `blob:` URL은 새로고침을 견디지 못하니까요).

가져오기 요약은 `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`를 보고해요. `failedAssets`는 복원하지 못한 업로드 자산의 수예요(예를 들어 기기 저장 공간이 가득 찬 경우). 이는 `skipped`와 다른데, `skipped`는 이 빌드가 인식하지 못한, 하위 호환성을 위해 남겨둔 더 새로운 작성자의 부분 개수를 세는 거예요. UI는 `skipped`를 그대로 보여줘요("… · N개의 최신 항목을 건너뜀"), 그래서 복원 결과가 무엇을 남겼는지 정직하게 알려줘요.

## 이동하지 않는 것

- **카탈로그 캐시**(다운로드된 자산 메타데이터와 blob, 도구 인덱스) - 대상에서 무료로 다시 동기화됨.
- **도구와 브랜드 자산** - 범위 밖이며, 대상에 이미 있다고 가정함.
- **`blob:` / 객체 URL** - 로드 시 브리지가 다시 생성함.
- **내보내기 시퀀스 카운터** - 일별 다운로드 이름 붙이기용 카운터(`localStorage` 키 `lolly-export-seq`)는 로컬 전용 편의 기능이라 `PREF_KEYS`에서 제외돼 있어 번들에 절대 실리지 않음.

저장 공간 미터는 같은 구분을 항목별로 보여줘요. 저장된 세션과 My images는 번들에 실려요. 그 아래의 자산 캐시, 도구 미리보기, 오프라인 고정 항목은 모두 다시 만들어낼 수 있어서 남겨져요.

![이 기기의 데이터를 이름 붙은 카테고리로 나눈 저장 공간 미터. Saved sessions와 My images가 Asset cache와 별도로 추적되고 있으며, 여기서는 모든 카테고리가 아직 비어 있는 새 설치 상태를 보여줌](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## 셸 간 보장

`data-transfer.ts`는 오직 기능 브리지(`host.profile`, `host.state`, `host.assets`)와 공유 `localStorage` 환경설정을 통해서만 읽고 씁니다. 브리지가 유일한 접점이기 때문에, 웹의 IndexedDB와 Tauri의 파일시스템처럼 저장소가 서로 달라도 *동일한* 모듈이 모든 셸에서 바이트 단위로 동일한 번들을 만들어냅니다. Tauri 셸들은 이 모듈을 변경 없이 그대로 재사용하며, 다른 것은 `host.state` 구현뿐입니다. 헤드리스 테스트는 인메모리 브리지를 대상으로 전체 왕복을 검증하며, 그래서 이 테스트 하나가 모두를 대표합니다.

두 셸은 서로 다른 이유로 이 보장 밖에 있습니다:

- **원샷 CLI**는 유지할 것이 없습니다 - 상태는 호출마다 메모리에만 존재하고 사라집니다.
- **TUI**는 실제로 상태(`~/.lolly`: 세션, 폴더, 프로필)를 유지하며 Profile 화면에서 백업도 가능하지만, 자체적으로 더 *단순한* 아카이브를 씁니다: 세션별 `sessions/<slot>.json`에 `profile.json`과 `folders.json`을 더한 형태로, 매니페스트도 `formatVersion`/`minReader`도 무결성 맵도 없습니다. 이 형식으로는 **가져올 수 없으며** - 리더는 이를 "Lolly 백업이 아님"으로 거부합니다 - 게다가 이름까지 비슷해(`lolly-backup-<stamp>.zip`) 혼동을 줍니다. 둘을 통합하는 것은 알려진 과제입니다.

## 예약된 확장 지점

봉투(envelope)는 설계상 매니페스트와 이름 붙은 파트들의 집합이므로, 나중에 새로운 종류의 이동 가능한 데이터도 **호환성을 깨지 않고** 실릴 수 있습니다. 이들은 추가되는 파트로 들어오며(새 `formatVersion`, 동일한 `minReader`), 오늘의 리더는 알아보지 못하는 것을 건너뜁니다. 이는 아직 구현되지 않은 [로드맵](/info/overview.html#roadmap) 항목입니다. 이름을 여기서 미리 예약해 두어, 이들이 도입될 때 형식이 일관되게 유지되도록 합니다.

- **`tokens.json` - 디자인 토큰.** [W3C DTCG](https://tr.designtokens.org/format/) 디자인 토큰 문서입니다([Penpot이 가져오고 내보내는](https://help.penpot.app/user-guide/design-systems/design-tokens/) 형식으로, `$value`/`$type`/`$description`을 가진 토큰들이 그룹, 세트, 테마로 구성됩니다). 번들 안의 토큰 세트를 이용하면 사용자가 세션과 함께 브랜드 기본값을 설치 간에 옮길 수 있습니다. 장기적으로는, 가져온 토큰 세트가 도구와 팔레트 애셋이 참조하는 일급 소스가 됩니다.
- **`penpot/` - 가져온 Penpot 파일.** Penpot 파일(또는 그 안에서 추출한, Lolly와 관련된 부분집합)을 가져와 *도구로서* 노출하기 위한 예약 디렉터리입니다. 번들은 가져온 정의를 담아, 사용자의 다른 데이터와 함께 이동합니다.

이 예약된 이름들과 위의 파트들을 벗어난 것은 리더 입장에서 알 수 없는 파트이며, 손대지 않고 `skipped`에 집계됩니다.

## 참고 자료

- 모듈: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - `backupFilename()` 네이머는 내부 전용).
- 계약 테스트: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - 왕복, 병합, 무결성, 상위 호환성, 리더 게이트 케이스.
- 사용되는 브리지 표면: `host.profile`, `host.state`, `host.assets` - [Host API](/info/host-api.html) 참고.
