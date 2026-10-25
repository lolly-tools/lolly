# 파일 내보내기

무언가를 만들었고 Lolly 밖으로 내보내야 해요. 채팅용 PNG, 인쇄소용 PDF, 동료가 계속 편집할 덱 등이에요. **Export | Save** 알약의 왼쪽 절반인 **Export**를 누르세요. 파일 이름 옆에서 형식을 고르고 **Download**를 누르세요. 파일은 기기에서 만들어져요.

캔버스에서 보는 것이 파일에 담기는 내용이에요. 형식 메뉴는 이 브라우저에서 이 도구가 만들 수 있는 것만 나열해요.

대부분의 작업에는 세 가지 형식 중 하나가 맞아요.

| 용도 | 선택 | 이유 |
|---|---|---|
| 화면, 메시지, 슬라이드 | **PNG** | 어떤 앱에서도 열리고, 도구가 지원하면 투명 배경도 유지돼요 |
| 완성된 페이지나 인쇄할 모든 것 | **PDF** | 보이는 그대로 인쇄되는 정확한 페이지 크기예요. 도구가 제공하면 **Print PDF**가 인쇄소용 CMYK 버전이에요 |
| 어떤 크기에서도 선명함을 유지해야 하는 아트워크 | **SVG** | 벡터 도형이라 배지부터 배너까지 선명해요 |

::: check 실제로 사용할 크기로 파일을 확인하세요
보내기 전에, 그 화면에서 열어 보거나 실제 크기로 인쇄해 보세요.
:::

::: details Lolly Work의 승인과 전달(선택 사항)
[Lolly Work를 운영하는 조직](/info/organisation.html)은 구성원에게 보이는 형식과 내보내기 설정을 관리할 수 있어요. 승인이 필요한 곳에서는 **Request approval**이 **Download**를 대신해요. 인스턴스가 보여주는 정책을 따르세요.

Lolly Work는 승인 단계, 전달 영수증, 감사 기록과 함께 구성된 S3, WebDAV, HTTP 목적지로 파일을 전달할 수도 있어요. 해당 워크플로에 파일을 제출하면 조직의 서비스로 전송되며, 일반 다운로드는 기기에 남아요. 개인 Send 목적지와 조직 전달은 별도로 구성돼요.

운영자는 [조직 전달 가이드](/info/work-delivery.html)로 이를 설정해요. 대기열에 있는 서버 렌더링과 배치는 [CLI 배치와 자동화](/info/cli-automation.html#organisation-jobs-with-lolly-work)를 참고하세요.
:::

## 내보내기 작동 방식

내보내면 도구의 캔버스가 선택한 형식으로 렌더링되어 다운로드로 전달되거나 클립보드에 놓여요.

파일을 만드는 경로는 세 가지예요. 대부분의 도구는 **캔버스를 렌더링**해요. 텍스트 및 데이터 형식(HTML, Markdown, TXT, JSON, CSV, ICS, VCF)은 그림에서 그리는 것이 아니라 **도구의 콘텐츠로 생성**돼요. *Strip Hidden Data* 같은 개인정보 유틸리티는 **선택한 파일을 변환**하여 기기에서 캔버스, 워터마크, 추가 메타데이터 없이 돌려줘요. 이미 사용자 자신의 파일이기 때문이에요.

![세 가지 내보내기 경로가 완성된 파일로 모여요. 캔버스를 렌더링하거나, 콘텐츠로 텍스트나 데이터를 생성하거나, 선택한 파일을 기기에서 변환해요.](/info/diagrams/concepts/three-export-paths.svg)

내보내기 패널은 이런 동작을 제공해요. 어느 것이 나타날지는 도구 작성자가 정하며, 기본 세트는 Copy, Download, Save예요.

- <!--i:download--> **Download**는 파일을 저장해요. 이후 찾을 수 없다면 [다운로드한 파일 찾기](/info/find-your-work.html#find-a-file-you-downloaded)를 참고하세요.
- <!--i:photos--> **Copy**는 채팅, 이메일, 문서에 붙여넣을 수 있도록 이미지를 클립보드에 놓아요. 브라우저가 이미지를 복사할 수 없으면 대신 다운로드하고 알려줘요.
- <!--i:folder--> **Save**는 한 번의 클릭으로 현재 디자인을 Projects에 보관하며 파일을 다운로드하지 않아요. **Download** 옆의 **Save as**는 위치를 물어요([저장하고 이어가기](/info/using.html#saving-continuing) 참고).
- <!--i:link--> **Share**는 공유 대화상자를 열어요. 디자인을 재현하는 링크, 방문 시 토글(전체 화면, 내보내기 패널, 열 때 다운로드 또는 복사), 전체 상태를 간결한 토큰으로 압축하는 선택적 **Shortest link**가 있어요([URL 모드](/info/url-mode.html) 참고).

![내보내기 패널 - 형식, 크기, 복사 / 다운로드 / 저장 / 공유 동작](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

QR Code 링크를 담은 Design 이미지 박스처럼 디자인이 다른 도구의 렌더링을 임베드하면, 중첩된 렌더링이 부모의 내보내기에 그려져요. SVG와 PDF에서는 진짜 벡터로 유지되고 PNG, JPG, WebP에서는 선명하게 래스터화돼요. 임베드된 렌더링에는 워터마크도 자체 출처도 붙지 않으며 완성된 파일에만 붙어요. HTML, Markdown, TXT 내보내기는 구성된 렌더링을 담을 수 없어요.

## 형식 고르기

파일 이름과 형식 메뉴는 **다운로드** 아래에 하나의 `name.format` 쌍으로 나란히 있어요.

![파일명 필드가 형식 선택기와 결합되어 내보내기가 하나의 name.format 쌍으로 읽혀요](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

파일이 가는 곳에서 시작하세요. 각 카드는 그 목적지에 맞는 형식을 나열하며, 도구는 만들 수 있는 것만 보여줘요.

::: figure exporting-format-chooser
여섯 가지 목적지와 각각에 맞는 형식.
:::

디자인 시스템의 서체로 짠 워드마크는 모든 글자가 윤곽선 경로인 SVG로 내보내져, 파일 하나가 명함 크기에서도 건물 래핑 크기에서도 선명해요.

![Aurora라고 읽히는 가는 선의 넓은 자간 워드마크로, 표의 SVG 행이 다루는 순수한 벡터 아트워크의 예](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details 모든 형식과 용도
| 원하는 것 | 사용 | 이유 |
|---|---|---|
| 확대해도 선명한 로고나 아트워크 | **SVG** | 벡터: 확장 가능하고, 작고, 편집 가능해요. 벡터 내보내기가 그릴 수 없는 효과는 이미지로 임베드돼요 |
| Office와 Windows 앱용 벡터 | **EMF** | 라이브 텍스트와 함께 편집 가능한 벡터로 PowerPoint와 Word에 붙여넣어져요. Google Drive는 Google Drawings로 열어요 |
| 인쇄와 디자인 앱용 벡터 | **EPS** 또는 **EPS (CMYK)** | Illustrator와 인쇄 워크플로를 위한 PostScript 벡터 |
| 커팅 머신용 벡터 | **DXF** | 레이저 커터, 비닐 플로터, CNC: 밀리미터 단위의 윤곽선 경로 |
| 편집 가능한 슬라이드 덱 | **PowerPoint** (PPTX) | 이미지와 벡터를 추출 가능한 상태로 유지하는 네이티브 편집 가능 텍스트와 도형 |
| 편집 가능한 텍스트 문서 | **Word** (DOCX) 또는 **OpenDocument** (ODT) | 워드 프로세서에서 계속 편집할 수 있는 실제 단락과 제목(Doc Studio) |
| InDesign용 레이아웃 | **InDesign IDML (static subset)** | 텍스트, 사각형, 타원, 이미지를 아트보드당 스프레드 하나로(Design) |
| 편집 가능한 Penpot 문서 | **Penpot** | 보드, 도형, 텍스트, 연결된 토큰 |
| 사진 또는 범용 이미지 | **PNG** (무손실) 또는 **JPG** (더 작음) | 범용 래스터 |
| 더 작은 최신 이미지 | **WebP** 또는 **AVIF** | 투명도와 함께 더 나은 압축 |
| 인쇄 | **PDF** 또는 **Print PDF** (CMYK) | 실제 페이지 크기. 인쇄기에는 CMYK |
| 인쇄기용 래스터 | **Print TIFF** (CMYK) | RIP용 DeviceCMYK 픽셀 |
| 웹용 애니메이션 | **GIF** | 어디서나 재생되고 파일이 더 커요 |
| 풀 컬러와 진짜 투명도의 애니메이션 | **APNG** | 애니메이션 PNG: 팔레트 제한 없음 |
| 애니메이션, 가장 작은 파일 | **Animated WebP** | 풀 컬러와 투명도, GIF나 APNG보다 작음 |
| 확대해도 선명한 애니메이션 벡터 | **Animated SVG** | 자체 완결형. 브라우저나 `<img>`에서 어떤 크기로든 반복돼요(Lottie Ad) |
| 편집 가능하게 유지되는 애니메이션 | **dotLottie** | Design 타임라인의 도형, 경로, 외부 변환 키 |
| Premiere 인계 | **Premiere XML + media** | Premiere용 타이밍이 있는 클립과 원본 미디어(Design) |
| 소셜과 공유용 동영상 | **MP4** 또는 **WebM** | 파일 크기 대비 최고 품질([동영상](#video) 참고) |
| 자막 | **SRT** 또는 **VTT** | 동영상 플레이어용 타이밍이 있는 텍스트(Captions, Audiogram, Record) |
| 교육 과정 | **SCORM (LMS)** | 버전이 있는 웹사이트, SCORM 또는 xAPI 패키지([SCORM](#scorm-course-packages) 참고) |
| 서식 있는 텍스트 또는 이메일 서명 | **HTML** | 서식이 유지된 채 메일 클라이언트에 붙여넣어져요 |
| 일반 콘텐츠 | **MD** 또는 **TXT** | 텍스트만 |
| 캘린더 일정 | **ICS** | 모든 캘린더 앱으로 가져와져요 |
| 연락처 카드 | **VCF** | 주소록으로 가져와져요 |
| 다시 가져올 구조화된 데이터 | **JSON** 또는 **CSV** | 도구의 콘텐츠를 왕복해요 |
| 파비콘 | **ICO** | 여러 크기의 사이트 아이콘. **ZIP**은 여러 형식을 묶어요 |
:::

### 투명도

지원하는 도구는 **No BG** 같은 투명 배경 토글을 제공해요. PNG, WebP, AVIF, SVG, APNG, Animated WebP는 투명도를 유지하고 GIF는 딱딱한 가장자리를 유지해요. JPG와 PDF는 항상 불투명해요. TIFF는 흰색으로, 또는 [HDR](#hdr-bright-colours)에서 설명한 HDR 경로에서는 검은색으로 평탄화돼요.

## 크기와 인쇄 단위

도구가 **dimensions**를 제공하지 않는 한 내보내기는 도구의 기본 픽셀 크기를 사용해요. 제공하면 너비, 높이, **단위**를 설정해요.

- **px**(기본값)는 정확한 픽셀이에요.
- **mm, cm, in, pt**, **pc**는 물리적 크기예요. 물리 단위에서는 **DPI**(기본값 300)도 설정해요. **PDF**는 그 크기의 실제 페이지가 되고, **래스터**는 그 DPI에 해당하는 픽셀 수를 받고 해상도를 기록하며, **SVG**는 픽셀 viewBox와 함께 물리 단위를 유지해요.

더 높은 해상도의 래스터를 원하면 더 큰 너비와 높이를 입력하거나, 물리 단위를 고르고 DPI를 높이세요(픽셀 = 크기 × DPI). 너비 `210`, 높이 `297`, 단위 `mm`는 A4 페이지가 돼요.

![치수 행이 210 x 297 mm로 설정되고, 단위가 물리적이라 DPI 필드가 나타난 모습](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## 타임드 컴포지션의 스틸컷

Design의 [시퀀스](/info/sequence-editor.html) 타임라인 같은 시간 구성은 움직이므로, 스틸 내보내기는 한 순간인 **재생 헤드의 프레임**을 골라야 해요. 재생 헤드를 원하는 장면에 두고 내보내세요.

한 순간보다 많이 필요하면 출력 크기 옆에 **Frames** 입력란이 나타나요. 시간 구성과 스틸 형식(PNG, JPG, WebP, SVG, PDF)에서만 표시돼요. 재생 헤드 프레임에는 `1`로 두세요. 올리면 시퀀스 전체에 고르게 퍼진 그만큼의 스틸을 얻어요.

- PNG, JPG, WebP, SVG는 ZIP 하나로 돌아와요. `<name>-01.png`, `-02.png` 등이에요.
- PDF는 그만큼의 페이지가 있는 문서 하나로 돌아와요.

각 스틸은 타임라인 조각의 가운데에서 가져오므로, 첫 프레임이 반쯤 사라진 등장 장면이 되거나 마지막이 모든 클립이 끝난 뒤의 빈 순간이 되는 일이 없어요.

::: figure exporting-contact-sheet
Frames: 4는 시퀀스를 같은 조각 네 개로 나누고 각각의 가운데를 가져와요.
:::

스토리보드, 검토용 컨택트 시트, 동영상 편집에서 잘라낸 소셜 캐러셀에 쓰세요. 개수는 64로 제한되며 입력란에 다른 것을 입력하면 `1`로 돌아가요. 각 프레임은 일반 스틸이므로 자격 증명, Imprint, 물리 단위, DPI는 내보내기 하나일 때와 똑같이 동작해요. 내보내기 링크, CLI, MCP는 `cuts=`로 같은 시트를 요청해요([컨택트 시트](/info/url-export.html#contact-sheets) 참고).

## 한꺼번에 많은 파일

Lolly에는 대량 작업을 위한 세 가지 방법이 있고 각각 다른 작업을 위한 것이에요.

::: cols
## 표가 문서 하나가 돼요
**Battlecards** 같은 표 입력이 있는 도구는 모든 행을 한 페이지로 바꿔요. 스프레드시트의 표를 붙여넣으면 PDF 하나를 얻어요. 스프레드시트에서 행을 고치고 다시 붙여넣으세요.
## CSV가 행당 파일 하나가 돼요
**Batch**(`#/batch`)는 CSV를 받아 행마다 내보내기 하나를 렌더링해요. 이름표나 수료증을 파일 하나씩 ZIP으로 전달해요. [Batch](/info/batch.html#make-many-versions-of-one-design)를 참고하세요.
## 여러 디자인에 편집 하나
**Multi-edit**은 저장된 여러 세션을 나란히 열어 서로 다른 디자인에 같은 수정을 해요. [Multi-edit](/info/batch.html#edit-several-saved-designs-together)을 참고하세요.
:::

**Projects**에서 **Render folder**는 폴더와 하위 폴더의 모든 저장된 세션을 중첩된 ZIP 하나로 내보내고, **Render selection**은 모든 다중 선택에 같은 일을 해요. 저장된 세션 하나는 자체 파일로 렌더링돼요. 저장된 세션은 Projects에서 같은 설정으로 다시 여는 도구 링크로 다시 공유할 수도 있어요.

## 다른 곳에서도 편집 가능한 파일

일부 형식은 작업을 그림이 아니라 편집 가능한 콘텐츠로 다른 애플리케이션에 넘겨요.

### PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart, Diagrams, Flow Chart, Agenda는 페이지당 슬라이드 하나로 PowerPoint 덱을 내보내요. 각 페이지는 네이티브 개체로 분해되므로 동료가 덱을 편집하고 에셋을 꺼낼 수 있어요.

- <!--i:font--> **텍스트**는 레이아웃의 글꼴 크기, 색상, 굵기, 이탤릭, 정렬을 가진 편집 가능한 PowerPoint 텍스트 상자가 돼요.
- <!--i:pentool--> 로고와 아이콘 같은 **벡터**는 SVG 그림으로 임베드돼요. 선명하게 유지되고 PowerPoint에서 *Convert to Shape*를 쓸 수 있어요.
- <!--i:photos--> **이미지**는 원본 해상도의 개별 그림으로 들어와요. 잘린 히어로 이미지는 자르기 뒤의 전체 이미지를 유지하고, 적용된 필터나 블렌드는 구워져 있어요.
- <!--i:layers--> **배경, 테두리, 규칙선**은 사각형과 선 도형이 돼요.

![PowerPoint를 선택한 내보내기 패널: 페이지당 슬라이드 하나, 텍스트와 도형은 편집 가능하게 유지됨](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

레이아웃은 근사치예요. 목표는 재사용 가능한 콘텐츠예요. 복잡한 필터나 마스크가 적용된 영역처럼 워커가 네이티브로 표현할 수 없는 것은 아무것도 잃지 않도록 그림으로 임베드돼요. 덱의 슬라이드 크기는 하나이며 첫 페이지에서 가져와요.

PowerPoint는 들어오는 길이기도 해요. [덱 리브랜드](/info/rebrand.html)는 덱을 디자인 시스템으로 옮기고, [디자인 가져오기](/info/design-import.html)는 Design에서 덱을 열어요.

### Penpot

SVG를 내보내는 대부분의 도구는 Penpot에서 계속 편집할 수 있는 **Penpot 파일**(`.penpot`)도 내보내요.

| 만든 것 | Penpot에서 |
|---|---|
| 텍스트 | 편집 가능한 텍스트 개체: 오타를 고치거나 스타일을 바꿔요 |
| 도형, 경로, 그라디언트, 이미지 | 각각 편집 가능한 벡터 도형 |
| 디자인 시스템 토큰의 색상 또는 글꼴 | 라이브 토큰 링크: 토큰을 편집하면 그것을 상속하는 모든 도형이 따라와요 |
| 전체 디자인 | Assets 패널의 재사용 가능한 컴포넌트 |
| 복잡한 일러스트나 라이브 캔버스 | 이미지로 단독 임베드되고 그 주변의 편집 가능한 콘텐츠는 그대로예요 |

Design에서는 각 프레임이 Penpot 보드가 돼요. 디자인 시스템의 색상과 타이포그래피는 Assets 패널에, 전체 토큰 세트는 Tokens 패널에 들어가요. 그 이후 Penpot이 자체 사본을 유지하며, Penpot에서 편집한 토큰은 [Design System Setup](/info/brand-studio.html)의 가져오기로 돌아와요.

![Penpot을 선택한 내보내기 패널: .penpot 파일과, 다운로드 옆의 Send to Penpot](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

파일을 열려면 Penpot을 시작하고, 프로젝트를 고르고, **Import**를 선택하세요. 내보내기 패널에서 Penpot에 로그인했다면 **Send to Penpot**이 그 단계를 대신해요.

### Word, OpenDocument, InDesign

**Doc Studio**는 실제 단락과 제목이 있는 **Word**(DOCX)와 **OpenDocument**(ODT)를 내보내요.

**Design**은 **InDesign IDML (static subset)**을 내보내요. 텍스트, 사각형, 타원, PNG 또는 JPEG 이미지이며 아트보드당 스프레드 하나예요. 지원되는 인라인 서식은 편집 가능하게 유지되고, 이미지는 `Links`에 담겨 이동하며, 좌표는 InDesign 포인트가 돼요. 다시 연결, 글꼴 대체, 바뀐 줄바꿈은 확인이 필요할 수 있어요. 효과, 애니메이션, 구성된 스토리, 지원되지 않는 도형은 이를 나열한 보고서와 함께 내보내기를 중단시켜요. IDML은 원본 문서를 보존하지 않으므로 완성된 아트워크에는 PDF를 보내세요.

### 타임라인: dotLottie와 Premiere

Design의 타임라인에서 **dotLottie**는 Lottie 도구에서 편집 가능하게 유지되는 애니메이션을 써요. [Lottie 애니메이션](/info/sequence-editor.html#lottie-animations)이 유지되는 것을 나열해요. **Premiere XML + media**는 Premiere용으로 타이밍이 있는 클립과 원본 미디어를 패키징해요. [Premiere XML 교환](/info/sequence-editor.html#premiere-xml-exchange)을 참고하세요.

### SCORM (과정 패키지)

Settings → Preferences → Feature flags에서 **Training and courses**를 켜기 전에는 과정 내보내기가 꺼져 있어요.

그다음 지원되는 도구, 프로젝트 폴더 또는 선택에서 **Export course**를 선택하세요. Design에서는 **SCORM (LMS)**를 선택하고 **Download**를 누르면 같은 과정 워크플로가 열려요. Lolly가 작업을 저장하고, 과정 콘텐츠와 순서를 검토하게 한 뒤 모듈과 내보내기 대화상자를 열어요.

- <!--i:layers--> 각 소스의 렌디션을 고르세요. 정지 페이지, 동영상 형태의 모션, 오디오 또는 다운로드 가능한 리소스예요. 모듈에서 레슨 텍스트와 대체 읽기 자료를 추가하세요.
- <!--i:clock--> 학습자 플레이어를 미리 보고 설명과 자막을 검토하세요. 모션은 무음 애니메이션을 포함해 동영상으로 포함돼요.
- <!--i:document--> Website, SCORM 1.2, SCORM 2004 4th Edition 또는 실험적 xAPI 대상을 고르세요. 콘텐츠와 ZIP 크기를 확인한 뒤 확인된 버전을 저장하고 다운로드하세요.
- <!--i:check--> 이수하려면 필수 레슨을 모두 확인하고 Finish를 선택해야 해요.

![The export panel on a Design deck with SCORM (LMS) chosen](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

패키지는 완성된 콘텐츠를 담고 있으며 Lolly 계정이 필요 없어요. Website ZIP은 HTTP(S) 호스트에 올리고, LMS ZIP은 그대로 가져오세요. 과정을 공유하기 전에 대상을 테스트하세요. 저장된 여러 작품으로 만든 과정은 [교육 과정 만들기](/info/training-creators.html)를 참고하세요.

### DXF (절단 파일)

Asset Export, Diagrams, Growth, Logo Wall, QR Code, Street Map, Wayfinding, Wordmark는 레이저 커터, 비닐 플로터, CNC 소프트웨어가 읽는 AutoCAD R12 교환 형식인 **DXF**를 내보내요. 도형은 밀리미터 단위의 윤곽선 경로로 쓰이고, 텍스트는 윤곽선이 되며, 색상은 가장 가까운 AutoCAD Color Index에 대응되어 보통 커터의 작업을 정해요. DXF는 선화만 지원해요. 사진이나 필터가 적용된 영역에는 절단 경로가 없어 경고와 함께 제외돼요. 래스터 콘텐츠를 유지하려면 SVG나 PDF를 쓰세요.

Street Map이 가장 분명한 경우예요. 디자인 전체가 이미 선이므로 모든 도로와 운하가 절단 경로가 돼요.

::: showcase
![크림색 배경에 잉크로 그린 파리의 Street Map 렌더링 - 순수한 선화이므로 모든 획이 커터로의 이동에서 그대로 유지됩니다](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

스크롤하면 카메라가 실제 지오메트리를 통과해 뒤로 물러납니다: 일곱 개의 경로, 어디에도 픽셀이 없으며, 모든 획이 어떤 확대 배율에서도 실선처럼 선명합니다. 이것이 커터가 읽는 파일과 동일합니다.
:::

## 인쇄

**Print PDF**는 이름 붙은 인쇄 조건(기본값 **Coated FOGRA39**)에 맞춰 CMYK를 써요. 측정된 잉크 값이 있는 브랜드 견본은 정확히 변환되고, 다른 색상은 표준 장치 변환을 써요. **Print TIFF**는 RIP용 DeviceCMYK 픽셀을 쓰고 같은 인쇄 조건을 TIFF 메타데이터에 기록해요. Colour profile 컨트롤이 둘 다 제어하며 [색상 프로필](#colour-profiles)에 자세한 내용이 있어요.

**Print marks & bleed**는 인쇄 형식에 자체 카드가 있어요. 밀리미터 단위의 도련과 Crop, Registration, Bleed, Colour bars, Stamp 세부 항목이에요.

일부 도구는 **여러 페이지 PDF**를 만들어요. *Booklet* 도구처럼 표지, 필요한 만큼 페이지로 흘러가는 콘텐츠, 뒷면이에요. 각 페이지는 A4, US Letter, A5의 진짜 세로 PDF 페이지이고, 어떤 블록이든 새 페이지로 강제할 수 있어요. 이들은 재단선이나 도련 표시가 없는 RGB 문서이며, 그런 표시는 한 페이지짜리 Print PDF에 속해요. Design PDF는 **Notes handout**도 될 수 있어요. 각 슬라이드마다 발표자 노트가 아래에 붙은 세로 페이지예요.

**내보내기 전에.** 패널 하단의 **Before you export** 카드는 인쇄소가 보게 될 것을 알려줘요. 형식, 크기, 도련, 재단과 도련 영역, 잉크 커버리지, 판 수, 페이지 수가 있고 제목 옆에 판정이 있어요. 내보내기를 막지는 않아요. Design은 디자인 시스템의 조직 규칙을 레이어별로 확인하는 것과 문서 텍스트의 글쓰기 신호를 포함한 자체 검사와 함께 항상 이 카드를 보여주며([내보내기 전에](/info/design.html#before-you-export)), **Print preflight**가 켜져 있으면 이 인쇄 검사를 추가해요. 다른 도구에서는 Settings → Preferences → Feature flags에서 **Print preflight**를 켜세요. 기본값은 꺼짐이며 Lolly Work 배포가 구성원에게 켤 수 있어요.

**내보낸 후.** 파일이 준비되면 Lolly가 파일을 다시 읽어 선택한 것과 비교해요. 형식, 픽셀 또는 페이지 크기, 클립 길이, 투명 배경, CMYK 색상, HDR, Content Credentials, PDF 또는 ZIP 비밀번호예요. 다른 것은 내보내기 카드에 표시돼요. 각 측정값은 설정이 아니라 파일에서 오며, 파일이 답할 수 없는 속성은 일치로 계산되지 않아요. 명령줄은 `--export-report`로 전체 비교를 써요([CLI로 렌더링하기](/info/cli-rendering.html) 참고).

Design 인스펙터의 검사와 Design System Setup의 브랜드 비교는 별개의 검사예요. 이들은 디자인을 보고, 이 두 카드는 파일을 봐요.

::: details 요금표 기반 비용
프리플라이트 아래의 비용 카드는 같은 수치를 누군가 제공한 가격만 사용해 금액으로 바꿔요. 프리플라이트 카드 자체가 꺼져 있어도 그 수치를 읽어요. 두 가지가 필요해요. 가격표로 가격을 매길 수 있는 작업(판, 시트, 면적, 페이지, 변형 행, 출력 파일이며, 그래서 일반 로고 PNG에는 절대 나타나지 않아요)과, 인쇄소에서 받은 JSON 가격표인 **요금표**예요. 기본 빌드에는 없고 앱 안에서 불러오는 방법도 없어요. 요금표는 배포가 제공하는 카탈로그 에셋으로, 또는 직접 호스팅하는 사람이나 컨트롤 플레인이 켜는 선택적 요금표 확장을 통해 들어와요. 요금표가 없으면 아무것도 표시되지 않아요.

모든 수치는 제공한 요율에 Lolly가 센 수량을 곱한 것이에요. 예: `4 plate × €35.00`. 합계에는 출처가 붙어요. 카드의 발급자와 요율의 기준 날짜예요. 기본 통화도 임시 가격도 없어요. 파일이 자신에 대해 말하는 것은 전달된 말로 남아요. *"The file says: … Lolly has not verified this."*

수치를 계산할 수 없으면 표는 채워지는 대신 철회돼요.

- 카드가 가격을 매기지 않는 줄이 있으면 **합계가 전혀 없고**, 가격이 없는 줄 수를 알려주는 제목만 표시돼요.
- 상한인 수량은 소계에 **"up to"**를 붙여요.
- 유효 기간이 지난 요율은 *Use these rates anyway*를 누를 때까지 **수량만** 표시하며, 그다음에는 만료 날짜가 수치와 함께 표시돼요.
- **링크**로 열면 이 기기에서 요청할 때까지 금액이 숨겨져 있어요. CLI는 `--rate-card=<file.json>`을 로컬 파일로 받으며 링크 매개변수로는 받지 않아요.

카드는 모든 내보내기 단계에서 제거되므로 파일을 바꾸지 않아요. 산수이지 견적이 아니며, 견적은 인쇄소만 낼 수 있어요.
:::

## 모션과 소리

### 동영상

애니메이션 도구는 **MP4**와 **WebM**을 내보내요. 선택기는 이 브라우저가 만들 수 있는 컨테이너만 보여주며, 만들 수 없는 것을 요청하는 공유 `?format=` 링크는 다른 하나로 대체되고 파일 이름도 맞춰져요. 애니메이션 도구는 **Start after**도 제공하는데, 녹화 전에 애니메이션과 글꼴이 안정되도록 캔버스를 잠시 정지해 두며, **Duration**은 완성된 클립의 길이예요. **Motion blur**(Off, Draft quality, Standard, High와 **Shutter angle**)는 렌더링 시간을 들여 빠른 움직임을 흐리게 해요. 브라우저가 지원하면 **Record live**가 화면 공유를 통해 화면의 미리보기를 실시간으로 녹화해요.

![애니메이션 내보내기의 타이밍 설정: Start after, Duration, Shutter angle이 있는 Motion blur, Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality**는 Smaller file, Balanced, Best quality 중에서 골라요. **Advanced**는 **Codec**, **Frame rate**, **Rate mode**, **Hardware acceleration**을 열어요. 도구에 자막이 있으면 **Captions**가 **Embedded track** 또는 동영상 옆의 **Sidecar .vtt + .srt**를 골라요. 링크는 품질, 코덱, 프레임 속도, 지속 시간, 시작 지연을 `vq`, `codec`, `fps`, `seconds`, `wait`로 담아요([URL 매개변수](/info/url-parameters.html)).

동영상 내보내기는 소리를 유지해요. 도구는 클립 아래에 **음악 배경**을 깔 수 있어요. 클립 길이에 맞게 반복되거나 잘린 오디오 에셋이며, 영상 자체 소리 아래에서 페이드, 볼륨, 더킹이 적용돼요. 녹화 도구는 실시간 오디오를 파일까지 전달해요.

클릭 덱으로 남는 Design 덱도 동영상으로 내보낼 수 있어요. Present 메뉴의 **Export slides as video**가 MP4로 내보내기 시트를 열어요. 각 슬라이드는 자체 체류 시간만큼, 없으면 내보내기 시트의 Duration만큼 재생되고, 덱의 슬라이드 전환이 디졸브로 그 사이에서 재생돼요. 문서 자체는 바뀌지 않아요.

### 애니메이션 이미지

**GIF**는 어디서나 재생되어 채팅과 이메일에 적합해요. 동영상보다 크고 색상이 적어요. **APNG**와 **Animated WebP**는 풀 컬러와 투명도를 유지해요. **Lottie Ad**는 **Animated SVG**도 내보내요. 임베드된 CSS 키프레임이 있는 벡터 프레임이라서 어떤 크기로도 확대되고 코덱 없이 브라우저 탭이나 `<img>`에서 반복돼요. 텍스트는 윤곽선이 되고, 각 프레임이 비트맵보다 무거우므로 기본 프레임 속도가 더 낮아요. 이 모두는 무음이에요.

### 오디오

일부 도구는 소리만 내보내요. **Voice Recorder**는 실시간 레벨 미터로 마이크 녹음을 캡처하고 기기에서 인코딩해 **MP3**, **WAV**, **M4A (AAC)**, **Opus (WebM)**로 저장해요. `wav`, `mp3`, `m4a`, `opus`는 일반 형식 ID이므로 오디오 내보내기도 PNG처럼 공유하고 스크립트로 처리할 수 있어요.

에셋 선택기는 음악 배경용으로 MP3와 FLAC부터 MIDI와 트래커 모듈까지 다양한 오디오를 받아요. [형식](/info/formats.html)이 나열해요. [Rondocode 노래](/info/rondocode.html)는 클립이 요청하는 길이만큼 재생돼요.

## 색상과 HDR

Lolly는 모든 최신 CSS 색상을 읽고, 색상 연산을 지각 기반으로 하며, 각 파일을 리더가 열 수 있는 공간으로 써요. 화면에는 sRGB, 인쇄에는 CMYK, HDR에는 Rec.2100 PQ예요. [엔진의 색상](/info/colour-engine.html)이 방식을 설명해요. **Wide colour / HDR**로 설정한 Design 문서는 [Wide colour와 HDR 편집](/info/hdr-editing.html)에 설명된 자체 규칙을 따라요.

### 색상 프로필

내보내기에는 색상 프로필이 태그되므로 인쇄소, Photoshop, 브라우저 같은 색상 관리 앱이 본 그대로의 색상을 읽어요. 자동으로 일어나며, 썸네일과 미리보기는 크기를 작게 유지하려고 태그를 건너뛰어요.

- **PNG와 JPG**는 미리보기가 그려지는 공간인 **sRGB** ICC 프로필을 임베드해요. 픽셀은 다시 인코딩되지 않고 태그만 붙어요.
- **Print PDF (CMYK)**는 *OutputIntent*에 인쇄 조건을 선언하여 CMYK 잉크가 어떻게 읽혀야 하는지 인쇄소에 알려줘요.
- **Print TIFF (CMYK)**는 태그 없는 DeviceCMYK 픽셀을 쓰고 인쇄 조건을 TIFF 메타데이터에 기록해요. TIFF는 인쇄 프로필을 임베드할 수 없으므로 **Embed** 행은 그 프로필의 이름만 기록해요.
- **TIFF (RGB)**는 보관이나 편집기 왕복용 비압축 sRGB 짝이에요. 투명도를 흰색으로 평탄화해요. 브라우저가 TIFF를 미리 볼 수 없으므로 두 TIFF 모두 데스크톱 전용이에요.
- **SVG**, **EMF**, **EPS**, **DXF**는 임베드된 프로필이 없는 벡터예요. SVG의 색상은 sRGB, EMF와 EPS는 장치 RGB를 쓰고, **EPS (CMYK)**는 DeviceCMYK를 쓰고, DXF는 AutoCAD Color Index를 써요. SVG, EPS, DXF는 텍스트를 경로로 윤곽선 처리해요. EMF는 Office와 Google Slides에서 텍스트를 라이브로 편집 가능하게 유지하며 형식이 표현할 수 없는 런만 윤곽선으로 대체해요. 내보내기 패널의 **Outline fonts** 옵션은 모든 곳에서 경로를 강제해요. SVG는 CSS 박스 그림자도 안팎으로 재현해요.

::: details PDF/X-4와 자체 인쇄 프로필
Lolly에는 CMYK 프로필이 포함되어 있지 않아요. 이름 붙은 인쇄 조건은 PDF/X-4 준수를 주장하지 않은 채 출력 의도를 써요. PDF/X-4는 프로필이 임베드되어 있어야 하기 때문이에요.

자체 CMYK 프로필을 불러오고 Colour profile 컨트롤에서 그 **Embed** 행을 선택하세요. 파일의 *DestOutputProfile*로 임베드되며, 파일의 나머지가 허용하면 PDF가 PDF/X-4를 주장해요. 선언하는 인쇄 조건은 그 프로필에서 읽어요. 프로필이 증명하는 등록된 이름, 또는 프로필 자체 이름 아래의 `Custom`이에요.

세 가지가 출력 의도는 유지한 채 이 주장을 보류시켜요. CMYK 패스가 변환할 수 없었던 RGB 아트워크, `prov` 교정 여백 크레딧 텍스트(임베드되지 않은 표준 글꼴로 그려짐), **Strong** 비밀번호예요. PDF/X-4가 암호화를 금지하기 때문이에요. 모든 PDF에는 PDF/X-4 메타데이터도 담겨요. 페이지 박스, XMP, 문서 ID, 프로필이 있는 sRGB 출력 의도예요.
:::

### HDR (밝은 색상)

내보내기 패널의 **HDR** 카드는 일반 아트워크를 HDR 화면용으로 밝게 해요. 편집하는 동안 HDR 원본을 유지하는 것은 다른 기능이에요. [Wide colour와 HDR 편집](/info/hdr-editing.html)을 참고하세요.

일반 내보내기는 sRGB예요. 채도 높은 브랜드 색상도 화면의 일반 흰색만큼 밝아요. HDR 디스플레이에는 그 위로 여유가 있어요. **HDR** 카드는 브랜드 색상과 흰색 텍스트를 최고 밝기 쪽으로 끌어올리고, 어두운 영역은 어둡게 유지해서 빛에 대비를 줘요.

![내보내기 패널에서 켜진 HDR 카드, 그 아래로 드러난 White / Reach / Dark lift / Focus 다이얼](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **형식.** PNG, JPG, AVIF, TIFF. WebP는 8비트이며 쓸 수 있는 HDR 디코드 경로가 없고, 벡터와 PDF에는 HDR 모델이 없어요.
- **기본값은 꺼짐**이에요. 픽셀을 바꾸기 때문이에요. 카드를 선택하거나 공유 링크에 `hdr=1`을 전달하세요.
- **다이얼.** **White**(최고 밝기 상한, 400~2000 니트), **Reach**(빛이 톤을 따라 얼마나 아래까지 퍼지는지), **Dark lift**(어두운 부분이 얼마나 밝아지는지. `0`이면 어둡게 유지), **Focus**(부스트가 얼마나 색상의 풍부함을 유지하는지)예요. 이들은 하나의 값으로 전달돼요. `hdr=1600-60-0-50`은 White 1600, Reach 60, Dark lift 0, Focus 50이에요.
- **쓰이는 것.** PNG는 `cICP` 청크가 있는 16비트 Rec.2100 PQ를 받아요. JPG는 ISO 21496-1 게인 맵 JPEG으로, 일반 SDR 사진에 게인 맵이 덧붙어요. AVIF는 다시 쓴 `colr` 박스를 받아요. TIFF는 `cicp` 태그가 있는 생성된 ICC v4 프로필의 PQ 픽셀을 받고 검은색으로 평탄화해요. PQ에서 흰색은 10,000니트 코드라서 모든 가장자리에 후광이 생기기 때문이에요. 부스트는 지각 기반(OKLab) 명도를 따르고 색조를 유지하므로 브랜드 초록은 민트색이 아니라 더 밝은 초록이 돼요.
- **빛이 보이는 곳.** HDR 디스플레이의 색상 관리 뷰어예요. Apple 기기의 Preview, Quick Look, Safari, 또는 HDR 모니터의 Chrome이에요. SDR 화면에서는 일반 이미지로 보여요.
- **내보내기 전에.** 많은 플랫폼이 업로드를 다시 인코딩하고 HDR 신호를 제거하여 이미지가 어둡거나 바래 보일 수 있어요. 자신의 사이트, 비디오 월, 밝은 패널의 덱처럼 목적지를 통제하는 곳에서 HDR을 쓰세요.
- **터미널에서.** `--export=png` 또는 `--export=jpg`와 함께 `--hdr=1`을 쓰면 [CLI](/info/cli.html)에서 브라우저 없이 같은 엔진 인코더로 같은 PNG와 게인 맵 JPEG을 써요. AVIF와 TIFF는 당분간 웹 내보내기로 남아요.

## 파일과 함께 이동하는 것

완성된 파일은 그림 옆에 여러 기록을 담을 수 있어요. 일부는 픽셀 옆에 실려 가며 파일을 다시 저장하거나 제거하면 사라지고, 두 가지 표시는 픽셀 자체에 있어요.

::: figure exporting-what-travels
각 기록이 있는 곳, 기본으로 켜져 있는지, 어떤 링크 매개변수가 각각을 제어하는지.
:::

내보내기 패널은 **Licence**, **Source credits**, *Password protect*, **C2PA Credentials**, **Lolly Imprint**, **Durable credential**을 선택한 형식이 쓸 수 있는 카드만 보여주는 하나의 **Content protection** 그룹으로 접어요. 링크나 문서가 이미 라이선스를 선언했거나 소스가 결정을 요구하면 저절로 열려요. **Design system** 카드는 그룹 밖에 있어 모든 내보내기에서 보여요.

![PNG 내보내기에서 열린 Content protection 그룹, 여기에 적용되는 카드만 표시함](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### 출처와 워터마크

형식에 필드가 있으면 내보내기는 **출처 메타데이터**를 담아요. 소프트웨어, 소스, 도구 이름, 프로필 크레딧 줄이 PNG iTXt, JPEG EXIF, PDF 정보, SVG `<metadata>` 또는 GIF 주석에 쓰여요. 작성자만 기록하며 아무것도 업로드되지 않아요. **Experimental** 도구는 눈에 보이는 워터마크도 찍는데, 호스트가 적용하므로 도구를 편집해도 표시를 제거할 수 없어요.

**Lolly Imprint**는 보이지 않는 픽셀 워터마크이며 **기본으로 켜져 있어요**. 자격 증명과 메타데이터는 픽셀 옆에 실려 가므로 다시 저장하거나, 스크린샷을 찍거나, 메타데이터를 제거하면 사라져요. Imprint는 픽셀에 있어 재압축에도 살아남으므로 사본이 Lolly에서 만든 것임을 여전히 알아볼 수 있어요. 암호학적 보증이 아닌 힌트이며 개인 데이터를 담지 않아요. JPEG XL, PNG, JPG, WebP, AVIF, TIFF, BMP와 Lolly가 PDF나 PPTX에 렌더링하는 래스터에 들어가며, 임베드한 이미지에는 들어가지 않아요. Imprint를 빼려면 **Lolly Imprint**를 선택 해제하거나 `imprint=0`을 전달하세요. 재인코딩을 거친 AVIF의 생존은 아직 보정되지 않았어요. [Verify](/verify)가 기기에서 이를 탐지해요. [Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint)를 참고하세요.

**Durable credential**은 기기 내 신경망 모델로 TrustMark 형식을 써서 Lolly의 ID를 픽셀에 써요. 그래서 "made with Lolly" 링크가 메타데이터 제거와 재인코딩에도 살아남고 TrustMark를 지원하는 도구가 읽을 수 있어요. 내보내기마다 신경망 패스와 한 번의 모델 다운로드가 들므로 **기본값은 꺼짐**이에요. PNG, JPG, WebP, AVIF, TIFF를 다루며, 패널에서 선택하거나 `durable=1`을 전달하세요. 데스크톱과 모바일 앱은 오프라인에서 모델을 가져올 출처가 없으므로 이 카드를 숨겨요.

**Licence.** 다른 사람이 작업물을 어떻게 사용할 수 있는지 고르세요. 기본값은 *None (all rights reserved)*이고, CC0 1.0, Public Domain Mark 1.0, Creative Commons 4.0 라이선스(BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND)가 있어요. 라이선스 이름과 증서 링크가 파일의 라이선스 메타데이터(형식에 있다면 EXIF, XMP, RIFF)와 Content Credential에 들어가요. 선택은 문서와 함께 저장되고 링크에서 `licence=`로 전달돼요. Lolly는 사용자가 고른 라이선스를 쓸 뿐 약관을 확인하거나 강제하지 않아요. Claim처럼 자체 라이선스 필드가 있는 도구는 그 필드를 대신 유지해요.

### 디자인 시스템 기록

내보내기는 파일을 만든 디자인 시스템을 기록해요. 이름, 그림의 기준이 된 게시 버전(작업 버전이 아닌 경우), 그려진 [컬러웨이](/info/colourways.html)예요. 디자인 시스템이 선언하는 밀도 같은 다른 테마 선택도 같은 방식으로 기록돼요. 밝음 또는 어두움 선택은 그림이 어느 쪽인지 이미 보여주므로 제외돼요.

**아무것도 쓰이기 전에 기록을 볼 수 있어요.** 기본으로 선택된 **Design system** 카드가 파일에 담길 정확한 문구를 보여줘요. 예: *Records: Acme · Colourway: Beach*와 읽히게 될 설명이에요. 디자인 시스템 이름은 소유자가 입력한 그대로이므로 카드도 쓰인 대로 보여줘요. 카드를 선택 해제하면 해당 내보내기에서 기록이 빠져요. Design의 문서 패널은 같은 문구를 *Embedded in exports* 아래에 나열해요.

**설명은 도구 옆에 컬러웨이를 알려줘요.** 카드를 선택하면 *"Made with https://lolly.tools : Chart"*가 *"Made with https://lolly.tools : Chart (Beach colourway)"*가 돼요. 디자인 시스템 자체 이름은 설명이 아니라 기록에 남아요. 도구 이름이 없는 설명이나 도구가 자체 입력에서 쓰는 설명은 그대로 둬요. `tokenAxes`로 컬러웨이를 무시하는 도구는 기록하지 않으며, PDF 교정 크레딧(`prov` 인쇄 표시)도 같은 규칙을 따라요.

**에이전트를 안내한 브랜드 스킬.** 에이전트가 작품을 만들면서 읽고 따른 [브랜드 스킬](/info/brand-skills.html)을 명시하면 기록에 각 스킬이 개정본과 함께 나열돼요. 예: *Guided by: acme-brand 1.0*. 이 문구는 스킬이 작업을 안내했다는 뜻이며 검사가 아니에요. Lolly는 작품을 스킬에 대해 테스트하지 않아요. 에이전트 자신의 진술만 목록을 추가하며, 현재는 [MCP 서버](/info/mcp.html)의 `lolly_render`의 `brandSkills` 인수를 뜻하므로 앱이나 공유 링크에서 만든 작품에는 없어요. Content Credential은 이 목록을 각 스킬의 ID, 이름, 개정본, SHA-256 해시가 담긴 JSON 값 하나인 `brandSkills`로 담아요. XMP 패킷과 SVG 메타데이터는 같은 값을 `lolly:BrandSkills`로 담고, 기록에서 쓴 PDF는 스킬당 키워드 하나를 얻으며 설명은 그대로예요. 내부 스킬은 텍스트가 아니라 ID, 이름, 개정본, 해시로 기록돼요. 같은 스위치가 목록을 기록의 나머지와 함께 뺄 수 있어요. **Design system** 카드, `_madewith=0`, `--no-madewith`, `madeWith: false`예요. MCP 서버가 브라우저에서 파일을 그릴 때(PDF, JPEG, 브라우저 없는 경로로는 쓸 수 없는 다른 형식) 파일 자체의 메타데이터에는 목록이 없고 Content Credential만 담을 수 있어요. 기록을 유지하려면 `c2pa`를 전달하세요. 자격 증명이 없으면 렌더링이 브랜드 스킬이 기록되지 않았다고 경고해요.

**기록 다시 읽기.** [Verify](/verify)는 파일의 자격 증명 세부 정보에서 기록을 **Design system**으로, 브랜드 스킬을 **Guided by**로 나열해요. *Recreate with these settings*는 기록된 버전과 컬러웨이로 도구를 다시 열어요. 링크는 이 기기에 같은 ID와 이름의 디자인 시스템이 있으면 기록된 디자인 시스템으로 열리고, 없으면 활성 디자인 시스템으로 열려요.

::: details 어디에 무엇이 쓰이는지, 어떤 실행이 기록을 빼는지
| 위치 | 쓰이는 것 |
|---|---|
| Content Credential | `tools.lolly.export` 어서션의 `designSystem`(ID), `designSystemLabel`, `designVersion`, `themes`로, 각각 일반 텍스트 값이며 `themes`는 선택의 JSON 목록이에요 |
| PNG, JPEG, WebP, JXL | 파일의 XMP 패킷에서 네임스페이스 `https://lolly.tools/ns/export/1.0/`의 `lolly:` 속성으로 쓰인 같은 네 개의 값 |
| SVG | `<metadata>` 블록 안의 같은 `lolly:` 속성 |
| PDF | *Design system: Acme*, *Colourway: Beach* 같은 키워드 |
| 설명 필드가 있는 모든 형식 | 도구 옆에 컬러웨이가 있는 설명 |

카드는 기록할 것이 있고 형식이 기록을 담을 수 있을 때만 나타나요. CSV, JSON, 캘린더 파일, 기타 텍스트 또는 데이터 형식은 메타데이터를 담지 않고, EPS, EMF, DXF, BMP에는 기록용 필드가 없어요. HTML, Markdown, CSS는 기록을 Content Credential에만 담으므로 이들에는 카드에 설명 줄이 없고 **C2PA Credentials**가 꺼져 있으면 숨겨져요. 디자인 시스템이 제공하지 않는 필드는 파일에서 빠져요.

공유 링크는 `_madewith=0`으로 기록을 꺼요([URL 매개변수](/info/url-parameters.html)). 명령줄은 `--no-madewith`를, [MCP 서버](/info/mcp.html)의 `lolly_render`는 `madeWith: false`를 받고, 터미널 앱의 내보내기 패널에는 **Design system** 행이 있어요. 명령줄은 도구 렌더링과 `lolly run`이 저장된 Design 세션에서 내보내는 각 파일에 대해 완성된 파일이 담은 문구를 표준 오류로 출력하고, MCP 렌더링은 파일 옆에 출력하며, 둘 다 파일에서 다시 읽은 것이에요. 명령줄이 브라우저 없이 그리는 PNG에는 파일 메타데이터가 없으므로 기록이 자격 증명에만 담겨 이동해요. 기기 내 유틸리티는 메타데이터를 전혀 추가하지 않아요.

**Design system** 카드가 없는 실행은 기록을 빼요. Batch 실행, Projects에서 내보낸 폴더, 3D 컬렉션 내보내기, 그리고 터미널 앱의 CSV 배치, Projects 폴더 또는 선택 내보내기, 전체 렌더링 보기예요. 디자인 시스템을 기록하려면 도구에서 파일 하나를 내보내세요.
:::

### Content Credentials (C2PA)

내보내기는 **Content Credentials**를 담을 수 있어요. 무엇이 언제 어디서 파일을 만들었는지 기록하고 파일 바이트의 해시에 묶인 서명된 [C2PA](https://c2pa.org) 매니페스트로, 이후의 어떤 편집도 탐지돼요. 사양은 C2PA가 게시하며, Lolly는 모든 C2PA 리더가 검사할 수 있는 표준 매니페스트를 써요.

![C2PA Credentials 카드: 선택된 상태이며 체크박스 옆에 자격 증명 유효 기간이 있어요](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **기본으로 켜져 있어요.** **C2PA Credentials** 카드는 거의 모든 도구에서 미리 선택돼 있어요. 내보내기 한 번에 대해 선택 해제하거나 링크에 `c2pa=off`를 전달하세요. 도구는 매니페스트에서 제외를 선택할 수 있어요.
- **형식.** PDF(RGB와 Print), PNG와 APNG, JPG, GIF, SVG, TIFF(RGB와 Print), WebP(정지와 애니메이션), AVIF, MP4, WebM, 오디오 컨테이너 MP3, WAV, M4A, OGG/Opus, FLAC, HTML, Markdown, CSS예요. ZIP은 지원되는 각 멤버에 스탬프를 찍으며 Animated SVG가 이렇게 얻어요. MP4, AVIF, M4A는 표준 BMFF 바인딩을, MP3는 ID3v2 매핑을 사용하므로 `c2patool` 등의 리더가 검증해요. WebM과 OGG/Opus는 아직 표준 매핑이 없어서 Lolly가 매니페스트를 Matroska 첨부와 OpusTags 필드로 담으며 Lolly 자체 검증기가 확인해요. ICO, EPS, EMF, DXF, BMP, PPTX, Office 형식, 기타 텍스트 및 데이터 형식에는 C2PA 컨테이너가 없어요.
- **기록하는 것.** 파일을 만든 도구와 앱, 서명 시간, 내보낸 셸, **Design system** 카드가 선택된 동안 [디자인 시스템과 컬러웨이](#the-design-system-record), 활성 입력의 지문이에요. 입력 텍스트, 프로필에 연결된 필드, 비활성 컨트롤, 브라우저 버전, 운영 체제 세부 정보는 제외돼요. 이름과 이메일은 Settings → Preferences → Your details에서 **Use my details to create**가 켜져 있을 때만 작성자로 나타나요. 내보내기가 배치하는 소스는 구성 요소로 담겨요. 이모지 같은 [출처가 표기되는 작품](#source-credits)과, 동영상이나 오디오 내보내기의 [Rondocode 노래](/info/rondocode.html#songs-in-the-credential)예요.
- **받는 사람이 보는 것.** Adobe 앱, `c2patool`, contentcredentials.org/verify 같은 C2PA 도구가 매니페스트를 읽고 주장을 보여줘요. Lolly는 신뢰 목록의 인증서가 아니라 기기에서 만든 키로 서명하므로 뷰어는 *unverified* 자격 증명으로 보고해요. 구조와 변조 증거는 실제이고, 서명자는 보증되지 않아요. 이를 바꾸려면 Settings → Preferences → Content Credentials에서 **검증된 신원**을 등록하세요. [Content Credentials 신원](/info/content-credentials-identity.html)을 참고하세요.
- **파일 확인.** 아무 파일이나 [Verify](/verify)에 놓거나 `lolly validate <file>`을 실행하면, Lolly가 파일을 만들었는지와 이후 변경되었는지가 먼저 나오는 기기 내 보고서를 받아요. Verify는 자격 증명 너머도 살펴봐요. [Verify가 확인하는 것](/info/what-verify-checks.html)을 참고하세요.
- **개인정보.** 서명 키는 내보내기를 위해 만들어지고 기기를 떠나지 않으며, 주장에는 출처 메타데이터가 이미 담고 있는 것만 들어가요. 사용자 자신의 파일을 변환하는 개인정보 유틸리티는 자격 증명을 추가하지 않고, *Strip Hidden Data*는 C2PA 매니페스트를 다른 메타데이터처럼 제거해요. Rondocode 유틸리티는 새 오디오를 만들므로 쓰는 것에 서명해요([Rondocode 노래](/info/rondocode.html#files-from-the-rondocode-utility)).
- **상호작용.** 비밀번호로 보호된 PDF는 어느 단계에서도 Content Credentials를 담을 수 없어요. 자격 증명은 DPI, EXIF, 색상 프로필, PDF/X 메타데이터, 인쇄 표시 뒤의 완성된 바이트 위에 마지막으로 추가돼요.

### 출처 크레딧

다른 사람의 작업을 배치하는 내보내기는 그 소스를 자격 증명에 기록해요. 선택한 이모지 세트에서 그려진 이모지가 흔한 경우예요. 작품, 제작자, 라이선스, 정확한 바이트의 출처, 바뀐 점이 모두 파일과 함께 이동해요. 템플릿이 SVG인 도구의 텍스트는 시스템 자체의 이모지를 유지하므로 거기서는 출처가 표기되지 않아요. **Source credits** 행은 다운로드 전에 소스가 전달에 요구하는 것을 알려주고, 다운로드 후에는 전달된 바이트를 다시 읽고 나서야 크레딧이 파일에 있다고 말해요. 공유하려는 색을 바꾼 CC BY-SA 글리프처럼 선택을 요구하는 라이선스는 선택지가 있는 카드를 받으며 다운로드는 절대 막히지 않아요. [크리에이티브 권리와 크레딧](/info/creative-rights.html)에 문구, 검토된 라이선스, 사용자에게 남는 것이 있어요.

## 비밀번호 보호

두 종류의 잠금이 있으며 모두 기기에서 만들어져요. 내보내기 패널의 *Password protect* 카드가 둘 다 제어해요.

![PDF 내보내기에서 펼쳐진 비밀번호 보호 카드. 비밀번호 필드와 두 가지 잠금 등급이 표시됨](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**PDF 열기 비밀번호**는 비밀번호를 입력하면 두 단계가 있어요.

- **Weak**: 40비트 RC4로, 보호가 아니라 억제 수단이에요. 비밀번호가 공유 링크에 평문으로 실려 갈 수 있어요. RGB `pdf` 전용이에요.
- **Strong**: AES-256(PDF 2.0). 내보낼 때 입력하며 링크에 절대 넣지 않아요. Print PDF와 배치 ZIP 안의 각 PDF에도 적용돼요. Strong으로 잠근 Print PDF는 CMYK, 표시, 출력 의도는 유지하지만 PDF/X-4 주장은 버려요.

**잠긴 ZIP**은 ZIP 내보내기, Projects의 폴더 다운로드 또는 배치를 다루며, 하나의 비밀번호와 두 단계가 있어요. **Weak**(ZipCrypto, 억제 수단이며 `?password=` 링크에 실려 갈 수 있음) 또는 **Strong**(AES-256, 내보낼 때 입력하며 링크에는 절대 없음)이에요. 비밀번호는 모든 멤버를 보호하며, 안의 모든 PDF도 자체적으로 AES-256으로 잠기므로 ZIP을 푼 뒤에도 잠긴 채예요. 프롬프트는 다운로드가 시작될 때 나타나며 비밀번호를 비워 두면 잠금이 없어요.

**비밀번호로 보호된 공유 링크**는 열리기 전에 받는 사람에게 비밀번호를 요구해요. 링크 상태 전체가 비밀번호에서 파생된 키(PBKDF2)로 AES-256으로 암호화되므로 암호문만 이동하고 복호화는 받는 사람의 브라우저에서 이루어져요. 링크를 제공하는 서버는 비밀번호도 디자인도 보지 못해요. **Share** 대화상자에서 켜세요. 암호화된 링크는 Lolly에서만 열리며 임베드된 이미지로는 절대 열리지 않아요. [URL 모드](/info/url-mode.html)를 참고하세요.

## 휴대폰에서

내보내기 컨트롤은 떠 있는 **Export** 버튼 뒤에 있고, 이 버튼이 **Export** 시트를 열어요. 같은 형식, 크기, 복사, 다운로드, 공유를 터치에 맞게 만든 것이에요.

## 링크와 CLI용 형식 ID

URL `format=` 매개변수와 CLI `--export=` 플래그의 값이에요([URL 매개변수](/info/url-parameters.html)와 [CLI](/info/cli.html) 참고). 도구의 메뉴는 그 도구가 만들 수 있는 형식만 보여주므로 항상 이 목록보다 짧아요.

| 종류 | ID |
|---|---|
| 래스터 | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| 벡터 | `svg` · `svgz` (gzip SVG) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (절단 파일) |
| 페이지와 문서 | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (Penpot 디자인 파일) · `scorm` (과정 패키지, ZIP) |
| 모션 | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| 오디오 | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` |
| 텍스트와 데이터 | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `css` · `scss` · `gpl` (GIMP 팔레트) |
| 번들과 패키지 | `zip` · `rpm`과 `tar.gz` (Linux 패키지로 봉인된 렌더링) |

일부 ID는 도구 자체의 내보내기 코드에서 와요. `ase`(Palette Lab의 Adobe Swatch Exchange), `exr`과 `hdr`(Darkroom의 하이 다이내믹 레인지 래스터)예요. **Convert Font**는 제공한 글꼴 파일로 `ttf`, `otf`, `woff`를 쓰므로 단순 링크로는 렌더링할 것이 없어요.
