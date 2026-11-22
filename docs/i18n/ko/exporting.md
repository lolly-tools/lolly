# 파일 내보내기

**Export | Save** 알약의 왼쪽 절반인 **Export**를 누르고, 파일 이름 옆에서 형식을 선택한 뒤 **Download**를 누르세요. 파일은 기기에서 생성돼요.

파일에는 캔버스에서 보는 내용이 담겨요. 형식 메뉴에는 이 브라우저에서 해당 도구가 만들 수 있는 형식만 나와요.

대부분의 작업에는 다음 세 가지 형식 중 하나면 돼요.

| 용도 | 선택 | 이유 |
|---|---|---|
| 화면, 메시지, 슬라이드 | **PNG** | 모든 앱에서 열 수 있고, 도구가 지원하면 투명 배경도 유지해요 |
| 완성된 페이지 또는 인쇄물 | **PDF** | 보이는 대로 인쇄되는 실제 페이지 크기예요. 도구가 제공하는 **Print PDF**는 인쇄기용 CMYK 버전이에요 |
| 어떤 크기에서도 선명해야 하는 아트워크 | **SVG** | 벡터 도형 |

::: check 실제로 사용할 크기로 파일을 확인하세요
파일을 보내기 전에, 사용할 화면에서 열거나 실제 크기로 인쇄해 보세요.
:::

::: details Lolly Work의 승인과 전달(선택 사항)
[Lolly Work를 운영하는 조직](/info/organisation.html)은 구성원에게 표시할 형식과 내보내기 설정을 선택할 수 있어요. 승인이 필요하면 **Download** 대신 **Request approval**이 표시돼요. 인스턴스에 표시된 정책을 따르세요.

Lolly Work는 승인 단계, 전달 영수증, 감사 기록을 갖춰 설정된 S3, WebDAV, HTTP 목적지로 파일을 전달할 수도 있어요. 이 전달은 파일을 조직의 서비스로 보내요. 일반 다운로드는 기기에 남아요. 개인 Send 목적지와 조직 전달은 따로 설정돼요.

운영자는 [조직 전달 가이드](/info/work-delivery.html)에 따라 설정해요. 대기열에 넣는 서버 렌더링과 배치는 [CLI 배치와 자동화](/info/cli-automation.html#organisation-jobs-with-lolly-work)를 참고하세요.
:::

<!--i:eti-cpu-->
## 내보내기 작동 방식

파일을 만드는 경로는 세 가지예요. 대부분의 도구는 **캔버스를 렌더링**해요. 텍스트 및 데이터 형식(HTML, Markdown, TXT, JSON, CSV, ICS, VCF)은 **도구의 콘텐츠로 생성**해요. *Lolly Strip Hidden Data* 같은 개인정보 유틸리티는 기기에서 **선택한 파일을 변환**해요. 결과물에는 캔버스, 워터마크, 추가 메타데이터가 없어요.

![세 가지 내보내기 경로가 완성된 파일로 이어져요. 캔버스 렌더링, 콘텐츠로 텍스트나 데이터 생성, 기기에서 선택한 파일 변환이에요.](/info/diagrams/concepts/three-export-paths.svg)

내보내기 패널에서 제공할 동작은 도구 작성자가 정해요. 기본 동작은 Copy, Download, Save예요.

- <!--i:download--> **Download**는 파일을 저장해요. 나중에 파일을 찾을 수 없다면 [다운로드한 파일 찾기](/info/find-your-work.html#find-a-file-you-downloaded)를 참고하세요.
- <!--i:photos--> **Copy**는 이미지를 클립보드에 넣어요. 브라우저가 이미지를 복사할 수 없으면 Copy는 대신 파일을 다운로드하고 알려줘요.
- <!--i:folder--> **Save**는 현재 디자인을 Projects에 보관하며 파일을 다운로드하지 않아요. **Download** 옆의 **Save as**는 저장할 곳을 물어요([저장하고 이어서 하기](/info/using.html#saving-continuing) 참고).
- <!--i:link--> **Share**는 Share 대화상자를 열어요. 디자인을 재현하는 링크, 방문 시 동작 토글(전체 화면, 내보내기 패널, 열 때 다운로드 또는 복사), 상태를 간결한 토큰으로 묶는 선택적 **Shortest link**가 있어요([URL 모드](/info/url-mode.html) 참고).

내보내기 패널의 **Send to** 카드는 연결한 서비스로 파일을 보내요. Google Drive, Nextcloud, S3 버킷, Dropbox, OneDrive로 보낸 뒤에는 **Create a share link**로 다시 업로드하지 않고 해당 서비스의 링크를 만들 수 있어요. Share 대화상자의 **Share through your cloud** 섹션은 `.lolly` 파일 전송과 링크 생성을 한 번에 처리해요. 링크 패널에는 링크를 열 수 있는 사람, 파일 위치, 링크 만료 시점이 표시돼요. Share 대화상자의 **Links you've shared**에서 공유를 중지할 수 있어요. Nextcloud 링크에는 비밀번호와 만료일을 설정할 수 있어요. S3 링크는 1~7일 동안 유효하며 일찍 중지할 수 없어요. Lolly는 파일 사본이나 로그인 토큰을 서버에 보관하지 않아요. 각 서비스가 받는 정보는 [개인정보 보호](/info/privacy.html#every-network-request-the-app-can-make)에 나와 있어요.

![내보내기 패널 - 형식, 크기, Copy / Download / Save / Share 동작](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

QR Code 링크가 담긴 Lolly Design 이미지 박스처럼 디자인이 다른 도구의 렌더링을 임베드하면, 부모의 내보내기가 중첩된 렌더링을 그려요. SVG와 PDF에서는 벡터로 유지되고 PNG, JPG, WebP에서는 래스터화돼요. 임베드된 렌더링에는 별도의 워터마크나 출처가 붙지 않고 완성된 파일에만 붙어요. HTML, Markdown, TXT 내보내기는 구성된 렌더링을 담지 못해요.

<!--i:eti-file-->
## 형식 고르기

파일 이름과 형식 메뉴는 **Download** 아래에서 하나의 `name.format` 쌍으로 나란히 놓여 있어요.

![파일 이름 필드와 형식 선택기가 붙어 있어 내보내기가 하나의 name.format 쌍으로 보여요](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

파일을 어디에 쓸지부터 정하세요. 각 카드에는 해당 목적지에 맞는 형식이 나와요.

::: figure exporting-format-chooser
여섯 가지 목적지와 각 목적지에 알맞은 형식.
:::

디자인 시스템의 서체를 쓴 워드마크는 모든 글자가 윤곽선 경로인 SVG로 내보내져요. 파일은 어떤 크기에서도 선명하게 유지돼요.

다른 언어의 텍스트는 보유한 글꼴에 따라 달라져요. 디자인 시스템의 글꼴에 해당 글자가 있으면 SVG와 PDF는 글자 모양을 잡고 읽는 순서대로 윤곽선을 그려요. 오른쪽에서 왼쪽으로 쓰는 줄도 포함해요. 어느 글꼴에도 없으면 Lolly가 [대체 글꼴](/info/fallback-fonts.html)을 사용하고, 내보내기 카드에 그 글꼴이 표시돼요. 어떤 대체 글꼴도 지원하지 않는 텍스트는 SVG에서 라이브 텍스트로 남아 보는 쪽의 글꼴로 그려져요. PDF, EPS, WMF와 **Outline fonts**를 켠 EMF에서는 그 텍스트가 이미지로 바뀌어요. 해당 글자는 페이지에서처럼 보이지만 선택하거나 검색할 수 없어요. 내보내기 카드는 해당 문자 체계를 나열해요. 그 글자가 있는 글꼴을 추가하면 벡터 텍스트로 유지할 수 있어요.

![아주 가는 선과 넓은 자간으로 Aurora를 쓴 워드마크로, 표의 SVG 행에서 다루는 순수 벡터 아트워크의 예예요](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details 모든 형식과 용도
| 원하는 것 | 사용 | 이유 |
|---|---|---|
| 크기를 바꿔도 선명한 로고나 아트워크 | **SVG** | 벡터: 크기 조정과 편집이 가능하고 파일이 작아요. 벡터 내보내기가 그리지 못하는 효과는 이미지로 임베드돼요 |
| Office와 Windows 앱용 벡터 | **EMF** | PowerPoint와 Word에 라이브 텍스트를 포함한 편집 가능한 벡터로 붙여넣어져요. Google Drive에서는 Google Drawings로 열려요 |
| 인쇄 및 디자인 앱용 벡터 | **EPS** 또는 **EPS (CMYK)** | Illustrator와 인쇄 워크플로용 PostScript 벡터 |
| 커팅 머신용 벡터 | **DXF** | 레이저 커터, 비닐 플로터, CNC용 밀리미터 단위 윤곽선 경로 |
| 편집 가능한 슬라이드 덱 | **PowerPoint** (PPTX) | 네이티브 편집 가능 텍스트와 도형, 추출 가능한 이미지와 벡터 |
| 편집 가능한 텍스트 문서 | **Word** (DOCX) 또는 **OpenDocument** (ODT) | 워드 프로세서에서 계속 편집할 수 있는 단락과 제목(Lolly Doc Studio) |
| InDesign용 레이아웃 | **InDesign IDML (static subset)** | 아트보드당 스프레드 하나에 텍스트, 사각형, 타원, 이미지 배치(Lolly Design) |
| 편집 가능한 Penpot 문서 | **Penpot** | 보드, 도형, 텍스트, 연결된 토큰 |
| 사진이나 범용 이미지 | **PNG**(무손실) 또는 **JPG**(더 작음) | 범용 래스터 |
| 더 작은 최신 이미지 | **WebP** 또는 **AVIF** | 투명도를 유지하면서 더 잘 압축해요 |
| 인쇄물 | **PDF** 또는 **Print PDF** (CMYK) | 실제 페이지 크기. 인쇄기용은 CMYK |
| 인쇄기용 래스터 | **Print TIFF** (CMYK) | RIP용 DeviceCMYK 픽셀 |
| 웹용 애니메이션 | **GIF** | 어디서나 재생되지만 파일이 더 커요 |
| 풀 컬러와 진짜 투명도를 갖춘 애니메이션 | **APNG** | 팔레트 제한이 없는 애니메이션 PNG |
| 파일 크기가 가장 작은 애니메이션 | **Animated WebP** | 풀 컬러와 투명도 지원, GIF나 APNG보다 작음 |
| 크기 조정이 가능한 애니메이션 벡터 | **Animated SVG** | 자체 완결형으로, 브라우저나 `<img>`에서 어떤 크기로든 반복 재생돼요(Lottie Ad) |
| 편집 가능한 상태로 유지되는 애니메이션 | **dotLottie** | Lolly Design 타임라인의 도형, 경로, 외부 변환 키 |
| Premiere로 전달할 작업물 | **Premiere XML + media** | Premiere용 타이밍이 있는 클립과 원본 미디어(Lolly Design) |
| 소셜 및 공유용 동영상 | **MP4** 또는 **WebM** | 파일 크기 대비 가장 높은 품질([동영상](#video) 참고) |
| 자막 | **SRT** 또는 **VTT** | 동영상 플레이어용 타이밍이 있는 텍스트(Captions, Audiogram, Record) |
| 방송용 자막 | **TTML** 또는 **SCC** | IMSC1.1 타이밍 텍스트 또는 CEA-608 팝온 자막(Captions, [방송용 자막](#broadcast-captions) 참고) |
| 교육 과정 | **SCORM (LMS)** | 버전이 지정된 웹사이트, SCORM 또는 xAPI 패키지([SCORM](#scorm-course-packages) 참고) |
| 서식 있는 텍스트나 이메일 서명 | **HTML** | 서식을 유지한 채 메일 클라이언트에 붙여넣어져요 |
| 브라우저에서 재생되는 애니메이션 | **HTML** | Lolly Design 타임라인이나 Snippet에서 만든 하나의 파일로 된 플레이어([동영상](#video) 참고) |
| 일반 콘텐츠 | **MD** 또는 **TXT** | 텍스트만 |
| 캘린더 일정 | **ICS** | 모든 캘린더 앱으로 가져올 수 있어요 |
| 연락처 카드 | **VCF** | 주소록으로 가져올 수 있어요 |
| 다시 가져올 구조화된 데이터 | **JSON** 또는 **CSV** | 도구의 콘텐츠를 내보내고 다시 가져와요 |
| 파비콘 | **ICO** | 여러 크기의 사이트 아이콘. **ZIP**은 여러 형식을 묶어요 |
:::

### 투명도

투명 배경을 지원하는 도구에는 **No BG** 같은 토글이 있어요. PNG, WebP, AVIF, SVG, APNG, Animated WebP는 투명도를 유지하고, GIF는 가장자리가 딱딱해져요. JPG와 PDF는 언제나 불투명해요. TIFF는 흰색 배경으로 평탄화하고, [HDR](#hdr-bright-colours) 경로에서는 검은색 배경으로 평탄화해요.

<!--i:eti-crop-->
## 크기와 인쇄 단위

내보내기에는 도구의 기본 픽셀 크기를 사용하지만, 도구가 **dimensions**를 제공하면 너비, 높이, **단위**를 설정할 수 있어요.

- **px**(기본값)는 정확한 픽셀 수예요.
- **mm, cm, in, pt**와 **pc**는 물리적 크기예요. 물리 단위에서는 **DPI**도 설정해요(기본값 300). **PDF**는 그 크기의 실제 페이지가 돼요. **래스터**는 해당 DPI에 맞는 픽셀 수를 갖고 해상도를 기록해요. **SVG**는 픽셀 viewBox와 함께 물리 단위를 유지해요.

더 높은 해상도의 래스터가 필요하면 너비와 높이를 더 크게 입력하거나, 물리 단위를 선택하고 DPI를 높이세요(픽셀 = 크기 × DPI). 너비 `210`, 높이 `297`, 단위 `mm`로 설정하면 A4 페이지가 돼요.

![크기 행을 210 x 297 mm로 설정한 모습. 물리 단위를 사용하므로 DPI 입력란이 나타나요](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

<!--i:eti-images-->
## 타임드 컴포지션의 스틸컷

Lolly Design의 [시퀀스](/info/sequence-editor.html) 타임라인 같은 시간 구성에서 스틸 내보내기는 **재생 헤드 위치의 프레임**을 가져와요. 원하는 장면에 재생 헤드를 놓고 내보내세요.

여러 순간이 필요하면 출력 크기 옆의 **Frames** 입력란을 사용하세요. 시간 구성과 스틸 형식(PNG, JPG, WebP, SVG, PDF)일 때만 보여요. `1`이면 재생 헤드의 프레임을 가져와요. 더 큰 수를 입력하면 시퀀스 전체에 고르게 분포한 그만큼의 스틸을 가져와요.

- PNG, JPG, WebP, SVG는 `<name>-01.png`, `-02.png` 등의 파일을 ZIP 하나로 묶어 전달해요.
- PDF는 그만큼의 페이지가 담긴 문서 하나로 전달해요.

각 스틸은 나눠진 타임라인 구간의 가운데에서 가져와요. 그래서 첫 장면이 반쯤 나타난 상태가 되거나, 마지막 장면이 클립이 끝난 뒤의 빈 순간이 되는 일이 없어요.

::: figure exporting-contact-sheet
Frames: 4는 시퀀스를 같은 길이의 네 구간으로 나누고 각 구간의 가운데를 가져와요.
:::

Frames는 스토리보드, 검토용 컨택트 시트, 편집한 동영상에서 뽑은 소셜 캐러셀에 사용하세요. 최대 개수는 64예요. 입력란에 다른 값을 입력하면 `1`로 돌아가요. 각 프레임은 일반 스틸이므로 자격 증명, Imprint, 물리 단위, DPI는 단일 내보내기와 똑같이 작동해요. 내보내기 링크, CLI, MCP에서도 `cuts=`로 같은 시트를 요청할 수 있어요([컨택트 시트](/info/url-export.html#contact-sheets) 참고).

<!--i:eti-copy-->
## 여러 파일 한꺼번에 만들기

Lolly에는 대량으로 작업하는 세 가지 방법이 있어요.

::: cols
## 표 하나가 문서 하나로
표 입력을 페이지로 나누도록 만든 도구는 각 행을 페이지 하나로 바꿔요. 스프레드시트에서 표를 붙여넣으면 PDF 하나를 얻어요. 행을 수정하려면 스프레드시트를 편집하고 다시 붙여넣으세요. 참고 도구는 Battlecards예요. 오픈 소스 `community` 폴더에 있으며 lolly.tools에는 나열되지 않아요.
## CSV의 각 행이 파일 하나로
**Batch**(`#/batch`)는 CSV를 받아 이름표나 수료증처럼 행마다 결과물 하나를 렌더링하고 ZIP으로 전달해요. [Lolly Batch](/info/batch.html#make-many-versions-of-one-design)를 참고하세요.
## 여러 디자인을 한 번에 수정
**Lolly Multi-edit**은 저장된 세션 여러 개를 나란히 열어 각각에 같은 변경을 적용해요. [Lolly Multi-edit](/info/batch.html#edit-several-saved-designs-together)을 참고하세요.
:::

Booklet, Print Sheet, Lolly Doc Studio, Lolly Markdown Slides처럼 여러 페이지를 다루는 도구는 PNG, JPG, WebP, SVG 및 기타 단일 이미지 형식을 페이지당 파일 하나로 내보내고, 파일이 여러 개면 ZIP으로 묶어요. Print Sheet는 선택한 DPI로 전체 시트와 재단 표시를 유지해요.

**Projects**의 **Render folder**는 폴더와 하위 폴더에 저장된 모든 세션을 중첩된 ZIP 하나로 내보내요. **Render selection**은 여러 선택 항목에 같은 동작을 해요. 저장된 세션 하나는 개별 파일 하나로 렌더링돼요. Projects에서는 저장된 세션을 같은 설정으로 다시 여는 도구 링크로 공유할 수도 있어요.

<!--i:eti-pen-->
## 다른 앱에서도 편집 가능한 파일

일부 형식은 작업물을 이미지가 아닌 편집 가능한 콘텐츠로 다른 애플리케이션에 전달해요.

### PowerPoint (PPTX)

Lolly Design, Lolly Markdown Slides, Booklet, Lolly Doc Studio, Lolly Chart, Diagrams, Flow Chart, Agenda는 페이지당 슬라이드 하나인 PowerPoint 덱을 내보내요. 각 페이지는 동료가 편집하고 추출할 수 있는 네이티브 개체로 나뉘어요.

- <!--i:font--> **텍스트**는 레이아웃의 글꼴 크기, 색상, 굵기, 이탤릭, 정렬을 가진 편집 가능한 PowerPoint 텍스트 상자가 돼요. Lolly Design 덱은 슬라이드 마스터가 없어도 모든 텍스트 구간에 브랜드 서체를 설정해요.
- <!--i:pentool--> 로고와 아이콘 같은 **벡터**는 SVG 이미지로 임베드되며, PowerPoint에서 *Convert to Shape*를 적용할 수 있어요.
- <!--i:photos--> **이미지**는 원본 해상도의 개별 이미지로 들어가요. 잘린 대표 이미지도 잘린 영역 뒤에 전체 이미지를 유지해요. 이미지에 적용한 필터나 블렌드는 이미지 자체에 반영돼요.
- <!--i:layers--> **배경, 테두리, 구분선**은 사각형과 선 도형이 돼요. Lolly Design의 원, 타원, 알약 모양은 편집 가능한 네이티브 도형으로 유지돼요.

![PowerPoint를 선택한 내보내기 패널: 페이지당 슬라이드 하나이며, 텍스트와 도형은 편집 가능한 상태로 유지돼요](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

레이아웃은 대략적으로 재현돼요. 복잡한 필터나 마스크가 적용된 영역처럼 워커가 네이티브 개체로 표현하지 못하는 것은 이미지로 임베드돼요. 덱의 슬라이드 크기는 첫 페이지를 기준으로 하나로 정해져요.

PowerPoint는 가져오기에도 쓸 수 있어요. [덱의 브랜드 바꾸기](/info/rebrand.html)는 덱에 자신의 디자인 시스템을 적용하고, [디자인 가져오기](/info/design-import.html)는 덱을 Lolly Design에서 열어요.

### Penpot

SVG를 내보내는 대부분의 도구는 **Penpot 파일**(`.penpot`)도 내보내요.

| 만든 것 | Penpot에서 |
|---|---|
| 텍스트 | 편집 가능한 텍스트 개체 |
| 도형, 경로, 그라디언트, 이미지 | 편집 가능한 벡터 도형 |
| 디자인 시스템 토큰의 색상이나 글꼴 | 실시간 토큰 연결: 토큰을 편집하면 이를 상속한 모든 도형이 따라 바뀌어요 |
| 디자인 전체 | Assets 패널의 재사용 가능한 컴포넌트 |
| 복잡한 일러스트나 실시간 캔버스 | 임베드된 이미지. 주변 콘텐츠는 계속 편집할 수 있어요 |

Lolly Design의 각 프레임은 Penpot 보드가 돼요. 디자인 시스템의 색상과 타이포그래피는 Assets 패널에, 전체 토큰 집합은 Tokens 패널에 들어가요. Penpot은 자체 사본을 보관해요. Penpot에서 편집한 토큰은 [Lolly Design System Setup](/info/brand-studio.html)의 가져오기로 다시 가져올 수 있어요.

![Penpot을 선택한 내보내기 패널: .penpot 파일과 다운로드 옆의 Send to Penpot](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

파일을 열려면 Penpot을 실행하고, 프로젝트를 고른 뒤 **Import**를 선택하세요. 내보내기 패널에서 Penpot에 로그인하면 **Send to Penpot**이 파일을 가져와 줘요.

### Word, OpenDocument, InDesign

**Lolly Doc Studio**는 편집 가능한 단락과 제목을 담아 **Word**(DOCX)와 **OpenDocument**(ODT)로 내보내요. Word 파일은 문서 스타일을 통해 브랜드 글꼴과 텍스트 색상을 설정하고, 선택한 페이지 크기를 따르며, SVG를 그리지 못하는 앱을 위해 SVG 로고와 함께 PNG를 추가해요.

**Lolly Design**은 **InDesign IDML (static subset)**로 내보내요. 아트보드당 스프레드 하나에 텍스트, 사각형, 타원, PNG 또는 JPEG 이미지를 담아요. 지원하는 인라인 서식은 편집 가능한 상태로 유지되고, 이미지는 `Links`에 담기며, 좌표는 InDesign 포인트로 바뀌어요. 다시 연결하기, 글꼴 대체, 줄바꿈 변경은 살펴봐야 할 수 있어요. 효과, 애니메이션, 구성된 스토리, 지원하지 않는 도형이 있으면 내보내기가 중단되고 해당 항목을 나열한 보고서가 나와요. IDML은 원본 문서를 보존하지 않아요. 완성된 아트워크는 PDF로 보내세요.

### 타임라인: dotLottie와 Premiere

Lolly Design 타임라인에서 **dotLottie**는 Lottie 도구에서 계속 편집할 수 있는 애니메이션을 만들어요. 보존되는 항목은 [Lottie 애니메이션](/info/sequence-editor.html#lottie-animations)에 나와 있어요. **Premiere XML + media**는 타이밍이 있는 클립과 원본 미디어를 Premiere용으로 묶어요. [Premiere XML 교환](/info/sequence-editor.html#premiere-xml-exchange)을 참고하세요.

### SCORM(교육 과정 패키지)

Settings → Preferences → Feature flags에서 **Training and courses**를 켜기 전까지는 교육 과정 내보내기가 꺼져 있어요.

그런 다음 지원하는 도구, 프로젝트 폴더, 선택 항목에서 **Export course**를 선택하세요. Lolly Design에서 **SCORM (LMS)**와 **Download**를 선택해도 같은 교육 과정 워크플로가 열려요. Lolly는 작업물을 저장하고, 검토할 수 있도록 교육 과정의 콘텐츠와 순서를 보여준 뒤 모듈과 내보내기 대화상자를 열어요.

- <!--i:layers--> 각 원본의 출력 형태를 고르세요. 정지 페이지, 모션을 담은 동영상, 오디오, 다운로드 가능한 자료 중에서 선택해요. 모듈에 학습 텍스트와 읽기용 대체 콘텐츠를 추가하세요.
- <!--i:clock--> 학습자용 플레이어를 미리 보고 설명과 자막을 검토하세요. 소리 없는 애니메이션을 포함한 모션은 동영상으로 들어가요.
- <!--i:document--> Website, SCORM 1.2, SCORM 2004 4th Edition, 실험적 xAPI 대상 중에서 선택하세요. 콘텐츠와 ZIP 크기를 확인한 뒤, 확인한 버전을 저장하고 다운로드하세요.
- <!--i:check--> 완료하려면 모든 필수 학습 단원을 확인하고 Finish를 선택해야 해요.

![SCORM (LMS)를 선택한 Lolly Design 덱의 내보내기 패널](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

패키지에는 완성된 콘텐츠가 들어 있으며 Lolly 계정은 필요 없어요. Website ZIP은 HTTP(S) 호스트에 올리고, LMS ZIP은 변경하지 않고 가져오세요. 교육 과정을 공유하기 전에 대상 환경을 테스트하세요. 저장된 여러 작업물로 교육 과정을 만드는 방법은 [교육 과정 만들기](/info/training-creators.html)를 참고하세요.

### 방송용 자막

Captions 도구는 **TTML**과 **SCC**도 내보낼 수 있어요. 둘 다 SRT, VTT 파일과 같은 큐 목록으로 작성하므로 텍스트와 시간이 일치해요.

- **TTML**은 IMSC1.1 Text Profile이며, 미디어 시간 기준의 시각과 하단 중앙 영역 하나를 사용해요. Lolly 자막에는 시작, 끝, 텍스트만 있으므로 자막별 색상, 글꼴, 위치는 담지 않아요.
- **SCC**는 드롭 프레임 타임코드를 사용해 초당 29.97프레임으로 채널 1에 CEA-608 팝온 자막을 담아요. 북미 기본 문자와 특수 문자, 확장 문자를 지원해요. 자막에 지원하지 않는 문자가 있으면 내보내기가 멈추고 해당 문자를 알려줘요. 각 자막은 32열에 맞춰 줄바꿈하며 최대 15행까지예요. 시작 시간 전에 로드할 수 없는 자막은 몇 프레임 늦춰져요.
- 롤업 자막과 페인트온 자막은 작성하지 않아요.

::: note SCC는 방송 도구에서 확인하지 않았어요
하드웨어 디코더에서도 시험하지 않았어요. 전달하기 전에 자신의 파이프라인에서 파일을 테스트하세요.
:::

### DXF(커팅 파일)

Lolly Asset Export, Diagrams, Growth, Lolly Logo Wall, QR Code, Street Map, Wayfinding, Wordmark는 **DXF**를 내보내요. 레이저 커터, 비닐 플로터, CNC 소프트웨어가 읽는 AutoCAD R12 교환 형식이에요. 도형은 밀리미터 단위의 윤곽선 경로로 기록하고 텍스트도 윤곽선으로 바꿔요. 색상은 가장 가까운 AutoCAD Color Index에 매핑되며, 보통 이 색인이 커터의 동작을 정해요. DXF에는 선화만 담겨요. 사진이나 필터가 적용된 영역에는 커팅 경로가 없어 경고와 함께 제외돼요. 래스터 콘텐츠를 유지하려면 SVG나 PDF를 사용하세요. [대체 글꼴](/info/fallback-fonts.html)까지 포함해 어떤 글꼴도 지원하지 않는 텍스트가 있으면 내보내기가 멈추고 해당 텍스트를 인용한 메시지를 보여줘요.

Street Map 디자인은 모두 선으로 이루어져 있어 모든 도로와 운하가 커팅 경로가 돼요.

::: showcase
![크림색 바탕에 잉크색으로 파리를 그린 Street Map 렌더링 - 순수한 선화라 커터로 보내도 모든 선이 그대로 유지돼요](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

스크롤하면 카메라가 도형 사이로 뒤로 물러나요. 픽셀 없이 경로 일곱 개뿐이에요. 커터도 같은 파일을 읽어요.
:::

<!--i:eti-stamp-->
## 인쇄

**Print PDF**는 이름이 지정된 인쇄 조건을 기준으로 CMYK를 기록하며, 기본값은 **Coated FOGRA39**예요. 측정된 잉크 값이 있는 브랜드 색상 견본은 그 값을 유지해요. 다른 색상은 인쇄 프로필을 통해 변환해요. 기본값은 Lolly 자체 Coated FOGRA39 프로필이며, 자신의 프로필에서 **Embed** 행을 선택하면 그 프로필을 사용해요. 회색과 검은색은 검정 판에만 남아 작은 글자에서 핀이 어긋나지 않아요. FOGRA51, SWOP, GRACoL은 표준 장치 변환을 사용해요. 검은 글자는 아래의 색상 위에 오버프린트되므로 인쇄 핀이 조금 어긋나도 글자 둘레에 흰 테두리가 생기지 않아요. **Print TIFF**는 RIP용 DeviceCMYK 픽셀을 기록해요. Colour profile 컨트롤은 둘 다 제어해요([색상 프로필](#colour-profiles)). Print TIFF와 **EPS (CMYK)**는 Print PDF와 같은 인쇄 프로필로 색상을 분판해요.

인쇄 형식에는 **Print marks & bleed** 전용 카드가 있어요. 밀리미터 단위의 도련과 Crop, Registration, Bleed, Colour bars, Stamp details가 포함돼요. Stamp details는 여백에 날짜, 도구, 사용자 이름을 인쇄해요. 이름이나 도구 이름에 아랍 문자, 한자, 키릴 문자, 이모지처럼 여백용 글꼴에 없는 글자가 있으면 같은 회색의 이미지로 그려요. 내보내기 카드에 해당 문자 체계가 나열돼요.

*Booklet* 같은 일부 도구는 **여러 페이지 PDF**를 만들어요. 표지, 필요한 만큼 페이지를 채우며 이어지는 콘텐츠, 뒷면으로 구성돼요. 각 페이지는 A4, US Letter, A5 크기의 실제 세로형 PDF 페이지예요. 어떤 블록이든 강제로 새 페이지에서 시작할 수 있어요. 이 문서는 재단 표시나 도련 표시가 없는 RGB 문서예요. 그런 표시는 단일 페이지 Print PDF에 속해요. Lolly Design PDF는 **Notes handout**으로도 만들 수 있어요. 슬라이드마다 세로 페이지 하나에 슬라이드와 그 아래 발표자 노트를 담아요.

**내보내기 전.** 패널 아래의 **Before you export** 카드는 인쇄소가 보게 될 내용을 보여줘요. 형식, 크기와 도련, 재단 및 도련 영역, 잉크 사용량, 판 수, 페이지 수를 표시하고 제목 옆에 판정 결과를 보여줘요. 카드는 내보내기를 막지 않아요. Lolly Design은 자체 검사와 함께 이 카드를 항상 보여줘요. 디자인 시스템의 조직 작업 규칙을 레이어별로 검사하고 문서 텍스트의 글쓰기 신호도 포함해요([내보내기 전 확인](/info/design.html#before-you-export)). Lolly Design은 **Print preflight**가 켜져 있으면 이 인쇄 검사를 추가해요. 다른 도구에서는 Settings → Preferences → Feature flags에서 **Print preflight**를 켜세요. 기본값은 꺼짐이며, Lolly Work 배포에서는 구성원에게 켜 줄 수 있어요.

**내보내기 후.** Lolly는 완성된 파일을 다시 읽고 선택한 설정과 비교해요. 형식, 픽셀 또는 페이지 크기, 클립 길이, 투명 배경, CMYK 색상, HDR, Content Credentials, PDF 또는 ZIP 비밀번호를 비교해요. 다른 점은 모두 내보내기 카드에 기록돼요. 모든 측정값은 설정이 아니라 파일에서 가져와요. 파일에서 확인할 수 없는 속성은 일치하는 것으로 세지 않아요. 명령줄에서는 `--export-report`로 전체 비교 결과를 기록해요([CLI로 렌더링하기](/info/cli-rendering.html) 참고).

::: details 명령줄에서 PDF 접근성 검사하기
**PDF 접근성 검사.** PDF의 경우 명령줄은 `--export-report` 파일의 `pdfAccessibility` 아래에 접근성 검사 32개도 나열해요. 각 검사에는 id, 쉬운 설명, 결과, 파일에서 문제를 발견한 위치가 있어요.

- **Passed**: 검사 대상에서 문제가 발견되지 않았어요.
- **Failed**: 검사에서 문제가 발견됐어요. 해당 페이지 번호나 태그가 나열돼요.
- **Not applicable**: 표가 없는 파일에서 표를 검사하는 경우처럼 해당 유형의 검사 대상이 파일에 없었어요. 이 결과로 파일에 관해 판단할 수는 없어요.
- **Needs a person**: 여섯 가지 검사는 프로그램이 판단할 수 없어요(읽기 순서, 색상 대비, 깜박임, 스크립트, 시간 제한, 반복 링크).

이 목록은 판정이 아니에요. PDF가 PDF/UA를 충족한다거나 보조 기술을 쓰는 사람이 PDF를 사용할 수 있다는 뜻이 아니에요. 사람이 화면 읽기 프로그램으로 파일을 확인해야 해요. 내보내기 기능이 아직 태그를 기록하지 않아 현재 Lolly 자체 PDF도 태그 검사에 실패해요. 검사는 기기에서 파일을 읽고 아무것도 바꾸지 않아요. 비밀번호가 필요한 파일은 통과가 아니라 미검사로 표시해요. 전달받은 PDF를 검사하려면 [Lolly Strip Hidden Data](/info/utilities.html)에 끌어다 놓으세요. **PDF accessibility checks** 아래에 같은 목록이 나타나요.
:::

Lolly Design의 Inspector 검사와 Lolly Design System Setup의 브랜드 비교는 디자인을 살펴봐요. 이 두 카드는 파일을 살펴봐요.

::: details 요금표로 비용 계산하기
사전 검사 아래의 비용 카드는 사전 검사 카드가 꺼져 있어도 같은 수량을 금액으로 바꿔요. 두 가지가 필요해요. 가격표로 가격을 계산할 수 있는 작업(판, 용지, 면적, 페이지, 변형 행, 출력 파일이므로 일반 로고 PNG에는 카드가 나타나지 않아요)과 인쇄소에서 받은 JSON 가격표인 **요금표**예요. 기본 빌드에는 요금표가 없고 앱 안에서 불러올 방법도 없어요. 요금표는 배포에 포함된 카탈로그 에셋으로 제공되거나, 자체 호스팅 운영자나 컨트롤 플레인이 켜는 선택적 요금표 확장을 통해 들어와요. 요금표가 없으면 아무것도 표시되지 않아요.

모든 금액은 `4 plate × €35.00`처럼 사용자가 제공한 요율에 Lolly가 센 수량을 곱한 값이에요. 합계에는 출처인 요금표 발행자와 요율 날짜가 표시돼요. 기본 통화도 임시 가격도 없어요. 파일이 스스로에 관해 말하는 내용은 인용으로만 전달해요. *"파일에 따르면: … Lolly는 이를 검증하지 않았어요."*

금액을 계산할 수 없으면 표를 채우지 않고 숨겨요.

- 요금표에 가격이 없는 항목이 있으면 **합계가 전혀 표시되지 않고**, 가격이 없는 항목 수를 알리는 제목만 보여요.
- 수량이 상한값이면 소계에도 **"최대"**가 표시돼요.
- 유효 기한이 지난 요율은 *Use these rates anyway*를 누를 때까지 **수량만** 보여줘요. 누른 뒤에도 금액에 만료일이 함께 표시돼요.
- **링크**로 열면 이 기기에서 금액 표시를 요청할 때까지 금액을 숨겨요. CLI는 `--rate-card=<file.json>`을 로컬 파일로만 받고 링크 매개변수로는 받지 않아요.

이 카드는 모든 내보내기 단계에서 제외되며 파일을 바꾸지 않아요. 산술 계산일 뿐 견적은 아니에요. 견적은 인쇄소만 낼 수 있어요.
:::

<!--i:eti-film-->
## 모션과 소리

### 동영상

애니메이션 도구는 **MP4**와 **WebM**을 내보내요. 공유된 `?format=` 링크가 이 브라우저에서 만들 수 없는 컨테이너를 요청하면 다른 컨테이너로 전환하고 파일 이름도 맞춰요. **Start after**는 녹화 전에 애니메이션과 글꼴이 안정되도록 캔버스를 정지 상태로 유지해요. **Duration**은 완성된 클립 길이를 정해요. **Motion blur**(Off, Draft quality, Standard, High 중 선택, **Shutter angle** 포함)는 빠른 움직임을 흐리게 하고 렌더링 속도를 늦춰요. 브라우저가 지원하면 **Record live**로 화면 공유를 통해 화면의 미리보기를 실시간으로 녹화할 수 있어요.

![애니메이션 내보내기의 시간 설정: Start after, Duration, Shutter angle을 포함한 Motion blur, Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality**에서는 Smaller file, Balanced, Best quality 중에서 선택해요. **Advanced**를 열면 **Codec**, **Frame rate**, **Rate mode**, **Hardware acceleration**이 나와요. 자막이 있는 도구에서는 **Captions**로 **Embedded track**이나 동영상 옆에 둘 **Sidecar .vtt + .srt**를 고를 수 있어요. 링크에는 품질, 코덱, 프레임 속도, 길이, 시작 지연이 각각 `vq`, `codec`, `fps`, `seconds`, `wait`로 담겨요([URL 매개변수](/info/url-parameters.html)).

동영상 내보내기는 소리를 유지해요. 도구는 클립에 **배경 음악**을 깔 수 있어요. 오디오 에셋을 클립 길이에 맞춰 반복하거나 자르고, 페이드와 음량을 적용하며, 영상 자체 소리가 나올 때 음악을 낮춰요. 녹화 도구는 실시간 오디오를 파일에 담아요.

Lolly Design의 클릭 덱도 동영상으로 내보낼 수 있어요. Present 메뉴의 **Export slides as video**는 MP4가 선택된 내보내기 시트를 열어요. 각 슬라이드는 자체 머무름 시간 동안 재생되고, 없으면 내보내기 시트의 Duration을 따라요. 덱의 슬라이드 전환은 슬라이드 사이에 디졸브로 재생돼요. 문서는 바뀌지 않아요.

시간이 설정된 Lolly Design 문서나 Snippet에서 내보낸 **HTML**은 하나의 파일로 된 플레이어예요. 애니메이션 위에 재생, 탐색, 소리 컨트롤이 있고 지원하는 글꼴, 이미지, 소리가 임베드돼요. 파일은 오프라인에서 재생돼요. 장면이 있는 Lolly Design 영상에는 장면 메뉴가 추가돼요. 동영상, Lottie, 3D 클립을 담은 시퀀스는 아직 HTML로 내보낼 수 없으므로 동영상으로 내보내세요.

### 애니메이션 이미지

**GIF**는 어디서나 재생되고 채팅과 이메일에 적합해요. 동영상보다 파일이 크고 색상 수가 적어요. **APNG**와 **Animated WebP**는 풀 컬러와 투명도를 유지해요. **Lottie Ad**는 **Animated SVG**도 내보내요. CSS 키프레임이 임베드된 벡터 프레임으로, 어떤 크기로든 확대할 수 있고 코덱 없이 브라우저 탭이나 `<img>`에서 반복 재생돼요. 텍스트는 윤곽선으로 바뀌어요. 각 프레임이 비트맵보다 무거워 기본 프레임 속도가 더 낮아요. 이 형식들은 모두 소리가 없어요.

### 오디오

일부 도구는 소리만 내보내요. **Lolly Voice Recorder**는 실시간 레벨 미터와 함께 마이크 녹음을 진행하고, 기기에서 인코딩해 **MP3**, **WAV**, **M4A (AAC)**, **Opus (WebM)**으로 저장해요. `wav`, `mp3`, `m4a`, `opus`는 일반 형식 id이므로, 오디오 내보내기도 PNG처럼 공유하고 스크립트로 처리할 수 있어요.

에셋 선택기는 배경 음악용으로 MP3와 FLAC부터 MIDI와 트래커 모듈까지 다양한 오디오 형식을 받아요. 목록은 [형식](/info/formats.html)에 있어요. [Lolly Rondocode 곡](/info/rondocode.html)은 해당 클립이 요청한 길이로 재생돼요.

<!--i:eti-palette-->
## 색상과 HDR

Lolly는 모든 최신 CSS 색상을 읽고, 시지각을 기준으로 색상을 계산하며, 읽는 프로그램이 열 수 있는 색 공간으로 각 파일을 기록해요. 화면용은 sRGB, 인쇄용은 CMYK, HDR용은 Rec.2100 PQ예요([엔진의 색상 처리](/info/colour-engine.html)). **Wide colour / HDR**로 설정된 Lolly Design 문서는 자체 규칙을 따라요. [넓은 색 영역과 HDR 편집](/info/hdr-editing.html)을 참고하세요.

### 색상 프로필

내보낸 파일에는 색상 프로필이 태그되어, 인쇄소의 앱, Photoshop, 브라우저처럼 색상을 관리하는 앱이 보이는 그대로 색상을 읽을 수 있어요. 썸네일과 미리보기는 크기를 작게 유지하려고 태그를 생략해요.

- **PNG와 JPG**에는 미리보기를 그리는 색 공간인 **sRGB** ICC 프로필이 임베드돼요. 픽셀에 태그만 붙이고 다시 인코딩하지 않아요.
- **Print PDF (CMYK)**는 *OutputIntent*에 인쇄 조건을 선언해 인쇄소에 CMYK 잉크를 어떻게 해석해야 하는지 알려줘요.
- **Print TIFF (CMYK)**는 태그 없는 DeviceCMYK 픽셀을 기록하고 TIFF 메타데이터에 인쇄 조건을 남겨요. TIFF에는 인쇄 프로필을 임베드할 수 없어 **Embed** 행을 선택해도 프로필 이름만 기록해요.
- **TIFF (RGB)**는 보관하거나 편집기로 내보냈다가 다시 가져오기 위한 비압축 sRGB 버전이에요. 브라우저에서는 TIFF를 미리 볼 수 없어 두 TIFF 모두 데스크톱 전용이에요.
- **SVG**, **EMF**, **EPS**, **DXF**는 프로필이 임베드되지 않은 벡터예요. SVG 색상은 sRGB이고, EMF와 EPS는 장치 RGB를 사용하며, **EPS (CMYK)**는 DeviceCMYK를 기록하고, DXF는 AutoCAD Color Index를 사용해요. SVG, EPS, DXF는 텍스트를 윤곽선 경로로 바꿔요. EMF는 Office와 Google Slides에서 텍스트를 라이브 상태로 편집 가능하게 유지하고, 형식이 표현하지 못하는 구간만 윤곽선으로 바꿔요. 내보내기 패널의 **Outline fonts** 옵션은 링크의 `_text=outline`, 명령줄의 `--text=outline`처럼 모든 텍스트를 경로로 바꿔요. SVG는 안쪽과 바깥쪽 CSS 박스 그림자도 재현해요.

::: details PDF/X-4와 자신의 인쇄 프로필
Lolly는 Fogra의 FOGRA39 특성화 데이터에 맞춰 CC0로 공개한 CMYK 프로필 하나를 제공하며, 기본 인쇄 조건에서는 이 프로필로 색상을 변환해요. 프로필은 ICC 버전 4.3이고 PDF/X-4는 4.2까지만 허용하므로 임베드하지 않아요. 따라서 이름이 지정된 인쇄 조건은 PDF/X-4 준수를 선언하지 않고 출력 인텐트를 기록해요.

자신의 CMYK 프로필을 불러오고 Colour profile 컨트롤에서 해당 프로필의 **Embed** 행을 선택하세요. 프로필은 파일의 *DestOutputProfile*로 임베드되며, 파일의 나머지 부분이 허용하면 PDF는 PDF/X-4 준수를 선언해요. 선언하는 인쇄 조건은 그 프로필에서 읽어요. 프로필이 등록된 이름을 증명하면 그 이름을 쓰고, 그렇지 않으면 프로필 자체 이름 아래에 `Custom`을 써요.

출력 인텐트는 유지하지만 준수 선언을 하지 않는 경우는 세 가지예요. CMYK 처리에서 변환하지 못한 RGB 아트워크, `prov` 교정 여백의 크레딧 텍스트(임베드되지 않은 표준 글꼴로 그려짐), **Strong** 비밀번호예요. PDF/X-4는 암호화를 금지하기 때문이에요. 모든 PDF에는 페이지 박스, XMP, 문서 ID, 프로필이 포함된 sRGB 출력 인텐트라는 PDF/X-4 메타데이터도 담겨요.
:::

### 별색 잉크를 프로세스 컬러로 인쇄하기

디자인 시스템은 색상에 Pantone이나 HLC 색상 같은 별색 잉크를 지정할 수 있어요. 그러면 **Print PDF**는 그 색상을 전용 인쇄판으로 인쇄해요. Lolly Demo는 흰색인 Sugar와 Daylight, 검은색인 Void를 제외한 모든 색상에 별색 잉크를 지정해요. Lolly Demo에서 만든 Print PDF는 대부분의 색상을 별색판으로, 검은색을 검정판으로 인쇄해요.

일반적인 4색 파일을 만들려면 내보내기 패널의 Profile 카드에서 **Print spot inks as process**를 선택하세요. 그러면 각 별색 잉크는 디자인 시스템이 그 색상에 지정한 CMYK 배합에 따라 시안, 마젠타, 노랑, 검정으로 인쇄돼요. 자체 배합이 없는 색상은 아트워크의 다른 모든 색상처럼 인쇄 프로파일에 따라 변환돼요. 그러면 파일에는 4개의 프로세스 컬러판만 있어요. 이 선택은 기본적으로 꺼져 있어요. 패널은 **Print PDF**에서만, 디자인 시스템이 색상에 별색 잉크를 지정한 경우에만 이 체크 상자를 보여줘요.

후가공은 잉크가 아니에요. 박, 양각, 음각, 부분 바니시, 소프트 터치, 도무송, 접지선, 절취선은 체크 상자를 선택해도 각각 이름이 있는 전용 판을 유지해요. 후가공을 프로세스 컬러로 인쇄하면 검은색 마스크가 페이지에 찍히기 때문이에요.

**Before you export** 카드와 `lolly preflight`는 파일에 들어갈 인쇄판 수를 세요. 체크 상자를 선택하면 4개의 프로세스 컬러판과 후가공판을 세고, 별색 잉크는 프로세스 컬러로 인쇄되어 판이 추가되지 않는다고 알려줘요. 체크 상자를 해제하면 디자인 시스템이 지정한 별색 잉크마다 최대 한 개의 별색판을 세요. 요금표는 이 수량에 따라 가격을 매기므로 파일에 없는 별색판에는 가격을 매기지 않아요.

**Print TIFF**와 **EPS (CMYK)**에는 이름이 있는 판이 없으므로 이 선택과 관계없이 모든 잉크를 프로세스 컬러로 인쇄해요. 이 두 형식에서는 카드와 `lolly preflight`가 4개의 프로세스 컬러판만 세고 별색판이나 후가공판은 세지 않아요. 후가공은 검정판에 검은색 마스크로 들어가며, 카드는 이를 오류로 보고해요.

링크에서는 `_spots=process`로, 명령줄에서는 `--spots=process`로, [MCP 서버](/info/mcp.html)에서는 `spots: "process"`로, 터미널 앱에서는 **Spot inks** 행으로 같은 파일을 요청해요. 선택에 관한 정보는 파일에 들어가지 않고 잉크만 바뀌어요.

### HDR(밝은 색상)

내보내기 패널의 **HDR** 카드는 일반 아트워크를 HDR 화면에 맞게 밝게 해요. 편집 중에 HDR 원본을 유지하려면 [광색역과 HDR 편집](/info/hdr-editing.html)을 참고하세요.

일반 내보내기는 sRGB예요. 채도가 높은 브랜드 색상은 화면의 일반적인 흰색만큼 밝아요. HDR 디스플레이는 그보다 더 밝아질 수 있어요. **HDR** 카드는 브랜드 색상과 흰색 텍스트를 최대 밝기에 가깝게 높여요. 어두운 부분은 어둡게 유지돼요.

![내보내기 패널에서 켜진 HDR 카드와 그 아래에 나타난 White / Reach / Dark lift / Focus 다이얼](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **형식.** PNG, JPG, AVIF, TIFF예요. WebP는 8비트이고 작동하는 HDR 디코딩 경로가 없으며, 벡터와 PDF에는 HDR 모델이 없어요.
- 픽셀을 바꾸므로 **기본적으로 꺼져 있어요**. 카드를 선택하거나 공유 링크에 `hdr=1`을 전달하세요.
- **다이얼.** **White**(최대 밝기 상한, 400~2000니트), **Reach**(빛이 얼마나 어두운 톤까지 퍼지는지), **Dark lift**(어두운 부분을 얼마나 밝게 하는지. `0`이면 어둡게 유지돼요), **Focus**(밝기를 높일 때 색상의 풍부함을 얼마나 유지하는지)예요. 이들은 하나의 값으로 전달돼요. `hdr=1600-60-0-50`은 White 1600, Reach 60, Dark lift 0, Focus 50이에요.
- **기록되는 내용.** PNG에는 `cICP` 청크가 있는 16비트 Rec.2100 PQ가 들어가요. JPG는 ISO 21496-1 게인 맵 JPEG로, 일반 SDR 그림에 게인 맵이 덧붙어요. AVIF에는 다시 작성된 `colr` 박스가 들어가요. TIFF에는 `cicp` 태그를 담은 생성된 ICC v4 프로파일과 PQ 픽셀이 들어가요. TIFF는 검은색 배경으로 평탄화돼요. PQ에서 흰색은 10,000니트 코드이므로 모든 가장자리에 후광이 생기기 때문이에요. 밝기 증가는 지각적(OKLab) 명도를 따르고 색상을 유지하므로 브랜드의 녹색이 더 밝아질 뿐 민트색으로 바뀌지 않아요.
- **밝기가 드러나는 곳.** HDR 디스플레이에서 색상을 관리하는 뷰어예요. Apple 기기의 Preview, Quick Look, Safari나 HDR 모니터의 Chrome 등이에요. SDR 화면에는 일반 이미지가 보여요.
- **터미널에서.** [CLI](/info/cli.html)에서 `--hdr=1`을 `--export=png` 또는 `--export=jpg`와 함께 쓰면 브라우저 없이 같은 엔진 인코더로 같은 PNG와 게인 맵 JPEG를 만들어요. AVIF와 TIFF는 현재 웹에서만 내보낼 수 있어요.

::: warning 많은 플랫폼이 HDR 신호를 제거해요
업로드한 이미지를 다시 인코딩하는 플랫폼에서는 이미지가 어둡거나 색이 바래 보일 수 있어요. 자체 사이트, 비디오 월, 밝은 패널에서 보여줄 덱처럼 표시할 곳을 직접 관리할 수 있을 때 HDR을 쓰세요.
:::

<!--i:eti-badge-check-->
## 파일과 함께 전달되는 것

완성된 파일에는 여러 기록이 있을 수 있어요. 일부는 픽셀과 별도로 존재하며 파일을 다시 저장하거나, 스크린샷을 찍거나, 메타데이터를 제거하면 사라져요. 두 가지 표식은 픽셀 안에 있어요.

::: figure exporting-what-travels
각 기록이 있는 곳, 기본적으로 켜져 있는지 여부, 각 기록을 제어하는 링크 매개변수예요.
:::

내보내기 패널은 **Licence**, **Source credits**, **Password**, **C2PA Credentials**, **Lolly Imprint**, **Durable credential**을 하나의 **Content protection** 그룹에 모으고, 선택한 형식이 쓸 수 있는 카드만 보여줘요. 링크나 문서가 이미 라이선스를 선언했거나 소스에 사용자 결정이 필요하면 그룹이 자동으로 열려요. **Design system** 카드는 그룹 밖에 있으며 모든 내보내기에서 보여요.

![PNG 내보내기에서 열린 Content protection 그룹. 해당 형식에 적용되는 카드만 보여요](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### 출처 & 워터마크

형식에 해당 필드가 있으면 내보낸 파일에 **출처 메타데이터**가 담겨요. 소프트웨어, 소스, 도구 이름, 프로필의 크레딧 문구를 PNG iTXt, JPEG EXIF, PDF 정보, SVG `<metadata>` 또는 GIF 주석에 기록해요. 작성자 정보만 기록해요. 업로드되는 것은 없어요. **Experimental** 도구는 눈에 보이는 워터마크도 찍어요. 호스트가 워터마크를 적용하므로 도구를 편집해도 표식을 없앨 수 없어요.

**Lolly Imprint**는 보이지 않는 픽셀 워터마크이며 **기본적으로 켜져 있어요**. 다시 압축해도 남으므로 사본도 Lolly로 만든 것으로 알아볼 수 있어요. 암호학적 보장이 아닌 단서이며 개인 데이터를 담지 않아요. JPEG XL, PNG, JPG, WebP, AVIF, TIFF, BMP와 Lolly가 PDF나 PPTX 안에 렌더링하는 래스터에 기록되며, 사용자가 임베드한 이미지에는 기록되지 않아요. Imprint를 빼려면 **Lolly Imprint**를 해제하거나 `imprint=0`을 전달하세요. AVIF를 다시 인코딩했을 때 얼마나 유지되는지는 아직 보정되지 않았어요. [Lolly Verify](/#/verify)가 기기에서 Imprint를 감지해요. [Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint)를 참고하세요.

**Durable credential**은 기기의 신경망 모델로 Lolly의 id를 TrustMark 형식으로 픽셀에 기록해요. 그래서 메타데이터를 제거하고 다시 인코딩해도 "Lolly로 만듦"이라는 연결이 남고 TrustMark를 지원하는 도구에서 읽을 수 있어요. 내보낼 때마다 신경망 처리가 필요하고 모델을 한 번 내려받아야 하므로 **기본적으로 꺼져 있어요**. PNG, JPG, WebP, AVIF, TIFF를 지원해요. 패널에서 선택하거나 `durable=1`을 전달하세요. 데스크톱과 모바일 앱은 오프라인에서 모델을 가져올 오리진이 없어 이 카드를 숨겨요.

**Licence.** 다른 사람이 작업물을 어떻게 쓸 수 있는지 고르세요. 기본값인 *None (all rights reserved)*, CC0 1.0, Public Domain Mark 1.0 또는 Creative Commons 4.0 라이선스(BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND)가 있어요. 라이선스 이름과 증서 링크가 파일의 라이선스 메타데이터(형식이 지원하는 EXIF, XMP, RIFF)와 Content Credential에 들어가요. 선택은 문서와 함께 저장되고 링크에서는 `licence=`로 전달돼요. Lolly는 선택한 라이선스를 기록해요. Lolly는 약관을 확인하거나 집행하지 않아요. Claim처럼 자체 라이선스 필드가 있는 도구는 그 필드를 유지해요.

### 디자인 시스템 기록

내보내기는 파일을 만든 디자인 시스템을 기록해요. 이름, 렌더링에 사용한 게시 버전(작업 버전이 아닌 경우), 렌더링에 사용한 [컬러웨이](/info/colourways.html)예요. 밀도처럼 디자인 시스템이 선언한 다른 테마 선택도 같은 방식으로 기록돼요. 밝음과 어두움 선택은 그림에 이미 드러나므로 기록에서 빠져요.

**무엇이든 기록되기 전에 기록 내용을 볼 수 있어요.** 기본적으로 선택된 **Design system** 카드는 *Records: Acme · Colourway: Beach*처럼 파일에 담길 정확한 문구와 설명을 보여줘요. 디자인 시스템 이름은 소유자가 입력한 그대로이며, 카드도 입력된 이름을 보여줘요. 해당 내보내기에서 기록을 빼려면 카드를 해제하세요. Lolly Design의 문서 패널은 *Embedded in exports* 아래에 같은 문구를 나열해요.

**설명에는 도구 옆에 컬러웨이가 표시돼요.** 카드를 선택하면 *"Made with https://lolly.tools : Chart"*가 *"Made with https://lolly.tools : Chart (Beach colourway)"*로 바뀌어요. 디자인 시스템 자체의 이름은 기록에만 남고 설명에는 들어가지 않아요. 도구 이름이 없는 설명이나 도구가 자체 입력으로 작성하는 설명은 그대로예요. `tokenAxes`를 통해 컬러웨이를 무시하는 도구는 컬러웨이를 기록하지 않으며, PDF 교정본의 크레딧(`prov` 인쇄 표시)도 같은 규칙을 따라요.

::: details 기록에 담기는 브랜드 스킬, 브랜드 페이지, 파트너사
**에이전트의 작업을 안내한 브랜드 스킬.** 에이전트가 작업물을 만들면서 읽고 따른 [브랜드 스킬](/info/brand-skills.html)을 명시하면, 기록에도 *Guided by: acme-brand 1.0*처럼 각 스킬과 리비전이 나열돼요. 이 문구는 스킬이 작업을 안내했다는 뜻이에요. Lolly는 작업물이 스킬을 따르는지 검사하지 않아요. 목록은 에이전트 자신의 선언으로만 추가돼요. 현재는 [MCP 서버](/info/mcp.html)의 `lolly_render`에 있는 `brandSkills` 인수가 이 역할을 하므로, 앱이나 공유 링크로 만든 작업물에는 목록이 없어요. Content Credential은 각 스킬의 id, 이름, 리비전, SHA-256 해시가 있는 하나의 JSON 값을 `brandSkills`로 담아요. XMP 패킷과 SVG 메타데이터는 같은 값을 `lolly:BrandSkills`로 담아요. 이 기록으로 작성된 PDF에는 스킬당 키워드 하나가 추가돼요. 설명은 그대로예요. 내부 스킬의 텍스트는 절대 기록되지 않아요. **Design system** 카드, `_madewith=0`, `--no-madewith`, `madeWith: false` 같은 스위치로 나머지 기록과 함께 이 목록도 뺄 수 있어요. MCP 서버가 브라우저에서 파일을 그릴 때(PDF, JPEG 및 브라우저 없는 경로에서 만들 수 없는 다른 형식) 파일 자체의 메타데이터에는 목록이 없어요. 이 경우에는 Content Credential만 목록을 담을 수 있어요. 기록을 유지하려면 `c2pa`를 전달하세요. 자격 증명이 없으면 렌더링 시 브랜드 스킬이 기록되지 않았다는 경고가 나와요.

**게시자가 동의한 경우의 브랜드 페이지.** 디자인 시스템 게시자는 내보낸 파일에 [브랜드 페이지](/info/brand-page.html#lead-back-from-your-files) 주소를 기록하도록 선택할 수 있어요. 설정은 디자인 시스템별로 적용되며 기본적으로 꺼져 있어요. 그러면 카드는 *Records: Acme · Colourway: Beach · Brand page: https://acme.example/brand/acme/*처럼 같은 줄에 주소를 추가해요. 카드를 해제하면 나머지 기록과 함께 주소도 빠져요. 기록은 주소만 담고 페이지에 관한 다른 정보는 담지 않아요. 파일의 다른 부분은 바뀌지 않아요. 주소가 없는 디자인 시스템은 이전과 같은 파일을 만들어요.

**주소는 팩과 함께 전달되지 않아요.** 서명된 파일의 기록은 서명자 자신의 기록으로 읽혀요. 주소를 선택하지 않은 사람에게 주소 기록이 저절로 켜져서는 안 되며, 팩이 다른 사람의 파일을 자신이 고른 페이지로 연결할 수 있어서는 안 돼요. `.lolly` 팩, 디자인 시스템의 사본이나 포크, **Try these colours**, 복원한 백업, 한 번의 실행을 위해 제공된 토큰 파일은 모두 설정이 꺼진 상태로 들어와요. 직접 주소를 입력하고 설정을 켤 수 있어요. 관리형 디자인 시스템만 예외로, 관리자가 소스 토큰에 설정한 주소를 유지해요. [파일에서 다시 연결하기](/info/brand-page.html#lead-back-from-your-files)에 자세한 내용이 있어요.

**Lolly Work 파트너 프로그램의 파트너사.** 파트너사를 위해 만든 작업물은 *Records: Acme · Colourway: Beach · Partner: Northwind IT (Resellers, EMEA)*처럼 같은 줄에 회사와 프로그램을 기록하고, 파일에는 회사 정보의 리비전도 담아요. 기록에는 사람, 연락처, 주소, 통화 정보가 없어요. 회사의 파트너 키트가 첨부되면 줄에 *, kit revision 2*처럼 키트 리비전이 추가되고, 자격 증명에는 키트의 id와 리비전만 담기며 색상이나 규칙은 담기지 않아요. 카드를 해제하면 나머지 기록과 함께 파트너도 빠져요. PDF에는 *Partner: Northwind IT* 키워드가 추가되며, [Lolly Verify](/info/what-verify-checks.html#partner)는 기록을 **Partner**로 보여줘요([파일의 파트너 기록](/info/manage/partner-programmes.html#the-partner-record-in-files)).
:::

**기록 다시 읽기.** [Lolly Verify](/#/verify)는 파일의 자격 증명 세부 정보에서 기록을 **Design system**으로, 브랜드 스킬을 **Guided by**로 나열해요. 브랜드 페이지는 [서명자가 기록한 주소](/info/what-verify-checks.html#brand-page)로 별도로 표시돼요. *Recreate with these settings*는 기록된 버전과 컬러웨이로 도구를 다시 열어요. 이 기기에 id와 이름이 같은 디자인 시스템이 있으면 링크는 기록된 디자인 시스템으로 열리고, 없으면 현재 활성화된 디자인 시스템으로 열려요.

::: details 어디에 무엇이 기록되고 어떤 실행에서 기록이 빠지는지
| 위치 | 기록되는 내용 |
|---|---|
| Content Credential | `tools.lolly.export` 어설션의 `designSystem`(id), `designSystemLabel`, `designVersion`, `themes`. 각각 일반 텍스트 값이며, `themes`는 선택 항목의 JSON 목록이에요. 게시자가 동의하면 `brandPage`도 포함돼요 |
| PNG, JPEG, WebP, JXL | 같은 값을 파일의 XMP 패킷에 `https://lolly.tools/ns/export/1.0/` 네임스페이스의 `lolly:` 속성으로 기록해요. 게시자가 동의하면 `lolly:BrandPage`도 포함돼요 |
| SVG | `<metadata>` 블록 안에 같은 `lolly:` 속성을 기록해요 |
| PDF | *Design system: Acme*, *Colourway: Beach* 같은 키워드와, 게시자가 동의한 경우 *Brand page: https://acme.example/brand/acme/* |
| 설명 필드가 있는 모든 형식 | 도구 옆에 컬러웨이가 표시된 설명 |

카드는 기록할 내용이 있고 형식이 기록을 담을 수 있을 때만 나타나요. CSV, JSON, 캘린더 파일 및 다른 텍스트나 데이터 형식에는 메타데이터가 없으며, EPS, EMF, DXF, BMP에는 기록을 담을 필드가 없어요. HTML, Markdown, CSS는 Content Credential에만 기록을 담으므로, 이 형식에서 카드는 설명 줄을 보여주지 않고 **C2PA Credentials**가 꺼져 있으면 숨겨져요. 디자인 시스템이 제공하지 않는 필드는 파일에 들어가지 않아요.

공유 링크는 `_madewith=0`으로 기록을 꺼요([URL 매개변수](/info/url-parameters.html)). 명령줄은 `--no-madewith`를, [MCP 서버](/info/mcp.html)의 `lolly_render`는 `madeWith: false`를 받으며, 터미널 앱의 내보내기 패널에는 **Design system** 행이 있어요. 명령줄은 도구 렌더링과 `lolly run`이 저장된 Lolly Design 세션에서 내보내는 각 파일에 대해, 완성된 파일에 담긴 문구를 표준 오류로 출력해요. MCP 렌더링은 파일 옆에 문구를 출력해요. 둘 다 파일에서 문구를 다시 읽어요. 명령줄이 브라우저 없이 그린 PNG에는 파일 메타데이터가 없으므로 기록은 자격 증명에만 담겨 전달돼요. 기기에서 실행되는 유틸리티는 메타데이터를 추가하지 않아요.

**Design system** 카드가 없는 실행에서는 기록이 빠져요. Lolly Batch 실행, Projects에서 내보낸 폴더, 3D 컬렉션 내보내기와, 터미널 앱의 CSV 배치, Projects 폴더나 선택 항목 내보내기, 전체 렌더링 보기가 해당돼요. 디자인 시스템을 기록하려면 도구에서 파일 하나를 내보내세요.
:::

### Content Credentials (C2PA)

내보낸 파일에는 **Content Credentials**를 담을 수 있어요. 무엇이 언제 어디서 파일을 만들었는지 기록하는 서명된 [C2PA](https://c2pa.org) 매니페스트로, 파일 바이트의 해시에 결합되어 이후의 편집을 감지할 수 있어요. Lolly는 모든 C2PA 리더에서 확인할 수 있는 표준 매니페스트를 작성해요.

![선택된 C2PA Credentials 카드. 체크 상자 옆에 자격 증명 유효 기간이 있어요](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **기본적으로 켜져 있어요.** 거의 모든 도구에서 **C2PA Credentials** 카드가 선택돼 있어요. 한 번의 내보내기에서 해제하거나 링크에 `c2pa=off`를 전달하세요. 그러면 파일에는 자격 증명이 없고, 카탈로그 로고처럼 자격 증명이 있는 아트워크를 인라인으로 넣은 SVG에서는 그 아트워크의 자격 증명도 사라져요. Lolly Imprint와 파일의 다른 메타데이터는 남아요. 도구는 매니페스트에서 이 기능을 끌 수 있어요.
- **형식.** PDF(RGB와 Print), PNG와 APNG, JPG, GIF, SVG와 SVGZ, TIFF(RGB와 Print), WebP(스틸과 애니메이션), AVIF, MP4, WebM, HTML, Markdown, CSS와 오디오 컨테이너 MP3, WAV, M4A, OGG/Opus, FLAC이에요. ZIP은 지원되는 각 파일에 자격 증명을 넣으며, Animated SVG도 이렇게 자격 증명을 받아요. MP4, AVIF, M4A는 표준 BMFF 바인딩을, MP3는 ID3v2 매핑을 사용하므로 `c2patool`과 다른 리더가 검증할 수 있어요. WebM과 OGG/Opus에는 아직 표준 매핑이 없어 Lolly는 매니페스트를 Matroska 첨부 파일과 OpusTags 필드에 담고 자체 검증기로 확인해요. SVGZ는 압축된 SVG예요. C2PA 사양은 압축 형식을 정의하지 않으므로 압축 전에 SVG에 자격 증명을 기록해요. Lolly의 검증기는 파일을 그대로 읽으며, `c2patool`은 파일 압축을 푼 뒤(`gunzip`) 같은 자격 증명을 읽어요. ICO, EPS, EMF, DXF, BMP, PPTX, Office 형식과 다른 텍스트 및 데이터 형식에는 C2PA 컨테이너가 없어요.
- **기록하는 내용.** 파일을 만든 도구와 앱, 서명 시각, 파일을 내보낸 셸이에요. 이미지, SVG, PDF로 내보낸 Lolly Design 페이지에서는 페이지를 그린 렌더러(`tools.lolly.export` 어설션의 `route`: GPU 페이지 렌더러는 `gpu`, 벡터로 기록된 그리기 연산은 `operations`, 브라우저 자체 렌더러는 `compatibility`)와 렌더러 버전(`renderer`: GPU 레시피, `design-draw-v`와 그 버전, 또는 `dom-to-image`와 `dom-walker`)을 기록해요. **Design system** 카드가 선택돼 있으면 [디자인 시스템과 컬러웨이](#the-design-system-record)를 기록해요. 활성 설정도 기록해요. 메뉴 선택, 숫자, 스위치, 색상은 그대로 기록하고, 입력한 내용(제목, 이름, 메모, 링크, 날짜)은 지문으로만 기록하므로 문구는 파일에 들어가지 않아요. 프로필에 연결된 필드, 비활성 컨트롤, 브라우저 버전, 운영 체제 세부 정보는 빠져요. Settings → Preferences → Your details에서 **Use my details to create**가 켜져 있을 때만 이름과 이메일이 작성자로 표시돼요. 내보내기에 배치된 소스는 구성 요소로 함께 전달돼요. 페이지의 그림 중 자체 Content Credential이 있는 그림은 해당 자격 증명과 그 자격 증명이 선언하는 AI 소스 유형과 함께 페이지의 구성 요소로 기록돼요. PNG, JPEG, WebP, AVIF, TIFF, SVG, PDF에서 이렇게 기록되며, GIF, APNG, Animated WebP, MP4, WebM에서도 내보내는 범위의 한 프레임 이상에 그림이 그려지면 마찬가지예요. Darkroom, Filter, Asset Export 같은 도구가 변경하는 단일 그림은 대신 파일의 부모로 기록돼요. 먼저 그림을 열었다는 기록 뒤에 도구가 그림에 한 작업이 이어져요. 다른 구성 요소에는 이모지 같은 [크레딧이 표기된 저작물](#source-credits), 동영상이나 오디오 내보내기에 쓰인 [Lolly Rondocode 곡](/info/rondocode.html#songs-in-the-credential), 동영상이나 오디오 내보내기에 쓰인 [저장된 곡](/info/generated-music.html#what-a-track-records)이 있어요. 저장된 각 곡에는 이름, 곡에 기록된 라이선스가 있으면 그 라이선스, 레시피의 SHA-256, 엔진 버전, 알고리즘 미디어라는 정보가 있어요. 저장된 곡의 제작자(저장할 때의 프로필 이름)는 사용자 자신의 이름처럼 **Use my details to create**가 켜져 있을 때만 추가돼요. 내보내기 패널도 이때만 내보내기 전에 제작자를 보여줘요.
- **기록된 승인이 있는 경우.** [Lolly Work](/info/work-approvals.html#review-an-exported-file)로 승인된 파일은 이 자격 증명 위에 두 번째 서명된 기록을 담을 수 있어요. 승인 id, 결정 날짜, 검토한 파일의 다이제스트예요. 이름, 이메일, 그룹, 댓글, 승인 체인 이름은 없어요. 요청 대화상자에서 기본적으로 선택돼 있으며, 한 요청에서 해제하거나 인스턴스 전체에서 끌 수 있어요. 서명자가 결정을 선언했다는 사실을 기록해요. 작업물이 어떤 표준을 충족한다는 뜻은 아니에요.
- **[인텐트](/info/visual-intent.html#what-goes-in-the-file)로 만든 파일이 요청받은 작업.** 목적, 표시 매체, 도구, 언어, 규칙과 용어의 버전, 인텐트 다이제스트예요. 해당 렌더링을 실행하는 사람이나 에이전트가 프롬프트 문구를 기록하도록 요청하지 않으면, 행사, 대상, 지역, 프롬프트는 지문으로만 기록돼요. 인텐트에서 시작한 렌더링만 이 기록을 담아요. 실행 시 기록한 내용을 알려주며 기록을 뺄 수 있어요.
- **받는 사람에게 보이는 것.** Adobe 앱, `c2patool`, contentcredentials.org/verify 같은 C2PA 도구는 매니페스트를 읽고 주장을 보여줘요. Lolly는 신뢰 목록의 인증서가 아닌 기기에서 만든 키로 서명하므로 뷰어는 자격 증명을 *미검증*으로 표시해요. 구조와 변조 증거는 유효하지만 서명자를 보증하는 주체가 없어요. 이를 바꾸려면 Settings → Preferences → Content Credentials에서 **검증된 신원**을 등록하세요. [Content Credentials 신원](/info/content-credentials-identity.html)을 참고하세요.
- **파일 확인하기.** [Lolly Verify](/#/verify)에 파일을 놓거나 `lolly validate <file>`을 실행하면 Lolly가 파일을 만들었는지, 이후 바뀌었는지부터 보여주는 보고서를 기기에서 받을 수 있어요. Lolly Verify는 자격 증명 외의 정보도 살펴봐요. [Lolly Verify가 확인하는 것](/info/what-verify-checks.html)을 참고하세요.
- **개인정보 보호.** 서명 키는 내보내기를 위해 만들어지며 기기를 떠나지 않아요. 주장에는 출처 메타데이터에 이미 담긴 내용만 들어가요. 사용자의 파일을 변환하는 개인정보 유틸리티는 자격 증명을 추가하지 않으며, *Lolly Strip Hidden Data*는 다른 메타데이터처럼 C2PA 매니페스트를 제거해요. Rondocode 유틸리티는 새 오디오를 만들므로 작성하는 파일에 서명해요([Lolly Rondocode 곡](/info/rondocode.html#files-from-the-rondocode-utility)). 음악 생성기는 내려받는 모든 WAV나 M4A에 서명해요. 자격 증명은 Lolly의 음악 생성기가 트랙을 만들었다는 사실과 음악에 적용되는 CC BY 4.0 라이선스, 크레딧을 기록해요([트랙이 기록하는 것](/info/generated-music.html#what-a-track-records)).
- **상호 작용.** 비밀번호로 보호된 PDF에는 어느 단계에서도 Content Credentials를 담을 수 없어요. 자격 증명은 DPI, EXIF, 색상 프로파일, PDF/X 메타데이터, 인쇄 표시를 적용한 뒤 완성된 바이트에 마지막으로 추가돼요.

### 소스 크레딧

다른 사람의 작업물을 배치한 내보내기는 그 소스를 자격 증명에 기록해요. 흔한 예는 선택한 이모지 세트의 이모지예요. 저작물, 제작자, 라이선스, 정확한 바이트를 가져온 곳, 변경 사항이 모두 파일과 함께 전달돼요. 템플릿이 SVG인 도구의 텍스트는 시스템 자체의 이모지를 유지하므로 여기에 크레딧이 표기되는 것은 없어요. 내려받기 전에 **Source credits** 행이 소스에서 전달 시 요구하는 사항을 알려줘요. 내려받은 뒤에는 전달된 바이트를 다시 읽은 다음 파일에 크레딧이 들어 있는지 알려줘요. 색상을 바꾼 CC BY-SA 글리프를 공유하려는 경우처럼 선택을 요구하는 라이선스에는 선택지가 있는 카드가 나타나요. 다운로드는 차단되지 않아요. [창작물의 권리와 크레딧](/info/creative-rights.html)에서 문구, 검토된 라이선스, 사용자에게 남는 권리를 다뤄요.

<!--i:eti-lock-->
## 비밀번호 보호

Lolly는 두 종류의 잠금을 모두 기기에서 만들어요. 내보내기 패널의 **Password** 카드에서 둘 다 설정해요.

![PDF 내보내기에서 펼쳐진 Password 카드. 비밀번호 필드와 두 단계의 잠금이 있어요](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**PDF 열기 비밀번호**는 비밀번호를 입력하면 두 단계로 나뉘어요.

- **Weak**: 40비트 RC4로, 인쇄 표시나 도련이 없는 RGB `pdf`와 일반 ASCII 비밀번호에 사용해요. 다른 문자가 있는 비밀번호는 Strong으로 바뀌어요. 이 단계에서 그런 비밀번호로 잠근 파일은 리더가 열 수 없기 때문이에요. 처음 32자만 적용돼요.
- **Strong**: AES-256(PDF 2.0)이에요. Print PDF와 배치 ZIP 안의 각 PDF에도 적용돼요. Strong으로 잠근 Print PDF는 CMYK, 표시, 출력 인텐트를 유지하지만 PDF/X-4 선언은 제거해요.

::: warning Weak는 억제 수단일 뿐 보호 수단이 아니에요
기밀 파일에는 **Strong**을 쓰세요.
:::

**잠긴 ZIP**은 ZIP 내보내기, Projects의 폴더 다운로드, 배치에 적용되며, 비밀번호 하나로 **Weak**(ZipCrypto, 억제 수단) 또는 **Strong**(AES-256)의 두 단계를 제공해요. 비밀번호는 모든 파일을 보호해요. 안에 있는 PDF도 각각 AES-256으로 잠기므로 ZIP의 압축을 푼 뒤에도 PDF는 잠겨 있어요. 다운로드를 시작하면 입력창이 나타나요. 비밀번호를 비워 두면 잠그지 않아요.

**입력한 비밀번호는 두 단계 모두에서 링크에 포함되지 않아요.** `?password=` 링크로 파일을 받으면 Lolly는 값을 읽고 즉시 주소에서 제거해요. 파일이 지원하지 않는 잠금을 요청하는 링크는 파일을 만들지 않고 이유를 알려줘요([`password`](/info/url-parameters.html) 참고).

**비밀번호가 필요한 공유 링크**는 열기 전에 받는 사람에게 비밀번호를 요청해요. 링크 상태는 비밀번호에서 파생한 키(PBKDF2)로 AES-256 암호화돼요. 암호문만 전달되고 복호화는 받는 사람의 브라우저에서 이루어져요. 링크를 제공하는 서버는 비밀번호나 디자인을 볼 수 없어요. **Share** 대화상자에서 켜세요. 암호화된 링크는 Lolly에서만 열리며 임베드된 이미지로는 열리지 않아요. [URL 모드](/info/url-mode.html)를 참고하세요.

<!--i:eti-monitor-->
## 휴대폰에서

내보내기 컨트롤은 떠 있는 **Export** 버튼을 누르면 열리는 **Export** 시트에 있어요. 같은 형식, 크기, 복사, 다운로드, 공유 기능을 터치에 맞는 크기로 제공해요.

<!--i:eti-code-->
## 링크와 CLI용 형식 id

URL의 `format=` 매개변수와 CLI의 `--export=` 플래그에 쓰는 값이에요([URL 매개변수](/info/url-parameters.html)와 [CLI](/info/cli.html) 참고). 도구의 메뉴는 그 도구가 만들 수 있는 형식만 보여줘요.

| 종류 | id |
|---|---|
| 래스터 | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| 벡터 | `svg` · `svgz` (gzip으로 압축한 SVG) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (커팅 파일) |
| 페이지와 문서 | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (Penpot 디자인 파일) · `scorm` (교육 과정 패키지, ZIP) |
| 모션 | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| 오디오 | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` · `mid` (Lolly Rondocode의 MIDI 음표) |
| 텍스트와 데이터 | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `ttml` · `scc` · `css` · `scss` · `gpl` (GIMP 팔레트) |
| 번들과 패키지 | `zip` · `rpm` 및 `tar.gz` (렌더링 결과를 Linux 패키지로 묶은 것) |

일부 id는 도구 자체의 내보내기 코드에서 제공해요. `ase`(Lolly Palette Lab의 Adobe Swatch Exchange)와 `exr`, `hdr`(Lolly Darkroom의 고명암비 래스터)예요. **Convert Font**는 사용자가 제공한 글꼴 파일에서 `ttf`, `otf`, `woff`를 만들므로 링크만으로는 도구가 렌더링할 대상이 없어요.
