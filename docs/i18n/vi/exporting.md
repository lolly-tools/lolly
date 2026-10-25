# Xuất một tệp

Bạn đã làm ra thứ gì đó và nó cần rời Lolly: một PNG cho cuộc trò chuyện, một PDF cho nhà in, một bộ trang mà đồng nghiệp sẽ tiếp tục chỉnh sửa. Nhấn **Export**, nửa trái của viên thuốc **Export | Save**. Chọn định dạng bên cạnh tên tệp, rồi nhấn **Download**. Tệp được tạo trên thiết bị của bạn.

Những gì bạn thấy trên canvas là những gì tệp chứa. Menu định dạng chỉ liệt kê những gì công cụ này làm được trong trình duyệt này.

Với hầu hết công việc, một trong ba định dạng là đúng:

| Dành cho | Chọn | Vì sao |
|---|---|---|
| Màn hình, tin nhắn hoặc slide | **PNG** | Mọi ứng dụng đều mở được, và giữ nền trong suốt khi công cụ có hỗ trợ |
| Một trang hoàn chỉnh, hoặc bất cứ thứ gì để in | **PDF** | Kích thước trang thật, in ra đúng như hiển thị; **Print PDF**, ở nơi công cụ hỗ trợ, là phiên bản CMYK dành cho nhà in |
| Hình ảnh cần luôn sắc nét ở mọi kích thước | **SVG** | Hình dạng vector, sắc nét từ một huy hiệu đến một biểu ngữ |

::: check Kiểm tra tệp ở kích thước sẽ dùng thực tế
Trước khi gửi, hãy mở nó trên màn hình mà nó được tạo ra để dùng, hoặc in nó ở kích thước thật.
:::

::: details Phê duyệt và bàn giao với Lolly Work (tùy chọn)
[Một tổ chức chạy Lolly Work](/info/organisation.html) có thể quản trị những định dạng và cài đặt xuất nào thành viên của mình thấy. Nơi cần phê duyệt, **Request approval** thay cho **Download**. Hãy theo chính sách mà phiên bản của bạn hiển thị.

Lolly Work cũng có thể giao một tệp tới các đích S3, WebDAV và HTTP đã cấu hình, với các bước phê duyệt, biên nhận bàn giao và bản ghi kiểm toán. Gửi một tệp vào quy trình đó là gửi nó tới dịch vụ của tổ chức; một lần tải xuống thông thường ở lại trên thiết bị của bạn. Các đích Send cá nhân và bàn giao của tổ chức được cấu hình riêng.

Đơn vị vận hành thiết lập việc này bằng [hướng dẫn bàn giao của tổ chức](/info/work-delivery.html). Với kết xuất máy chủ và batch xếp hàng, xem [CLI batch and automation](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

## Cách xuất hoạt động

Khi bạn xuất, canvas của công cụ được kết xuất sang định dạng bạn chọn và trao cho bạn dưới dạng tải xuống, hoặc đặt vào clipboard.

Ba đường tạo ra một tệp. Hầu hết công cụ **kết xuất canvas**. Các định dạng văn bản và dữ liệu (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) được **tạo từ nội dung của công cụ** thay vì vẽ từ ảnh. Các tiện ích riêng tư như *Strip Hidden Data* **biến đổi tệp bạn đã chọn**, trên thiết bị của bạn, và trả lại không có canvas, hình mờ hay siêu dữ liệu thêm vào, vì nó vốn là tệp của chính bạn.

![Ba đường xuất hội tụ thành một tệp hoàn chỉnh: kết xuất canvas, tạo văn bản hoặc dữ liệu từ nội dung, hoặc biến đổi một tệp đã chọn trên thiết bị.](/info/diagrams/concepts/three-export-paths.svg)

Bảng xuất đưa ra các hành động này. Tác giả công cụ chọn cái nào xuất hiện; bộ mặc định là Copy, Download và Save.

- <!--i:download--> **Download** lưu tệp. Nếu sau đó bạn không tìm thấy, xem [Find a file you downloaded](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** đặt ảnh vào clipboard, sẵn sàng dán vào cuộc trò chuyện, email hoặc tài liệu. Nơi trình duyệt không sao chép được ảnh, nó tải xuống thay thế và báo cho bạn.
- <!--i:folder--> **Save** giữ thiết kế hiện tại trong Projects chỉ bằng một cú nhấp và không bao giờ tải tệp. **Save as**, bên cạnh **Download**, hỏi lưu ở đâu (xem [Saving and continuing](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** mở hộp thoại Share: một liên kết tái tạo thiết kế, các công tắc khi truy cập (toàn màn hình, bảng xuất, tải xuống hoặc sao chép khi mở) và **Shortest link** tùy chọn nén cả trạng thái thành token gọn (xem [URL Mode](/info/url-mode.html)).

![Bảng xuất - định dạng, kích thước và các thao tác Sao chép / Tải xuống / Lưu / Chia sẻ](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Khi một thiết kế nhúng bản kết xuất của công cụ khác, như hộp ảnh Design chứa liên kết QR Code, bản kết xuất lồng được vẽ vào bản xuất của cha. Nó vẫn là vector thật trong SVG và PDF và được điểm ảnh hóa sắc nét trong PNG, JPG và WebP. Bản kết xuất nhúng không có hình mờ và không có nguồn gốc riêng; chỉ tệp hoàn chỉnh có. Bản xuất HTML, Markdown và TXT không chứa được bản kết xuất ghép.

## Chọn một định dạng

Tên tệp và menu định dạng nằm cùng nhau thành một cặp `name.format`, bên dưới **Tải xuống**.

![Trường tên tệp gắn liền với bộ chọn định dạng, để việc xuất đọc như một cặp name.format](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Bắt đầu từ nơi tệp sẽ đến. Mỗi thẻ liệt kê các định dạng phù hợp với đích đó; một công cụ chỉ hiện những cái nó làm được.

::: figure exporting-format-chooser
Sáu đích đến và các định dạng phù hợp với từng đích.
:::

Một wordmark đặt bằng kiểu chữ của hệ thống thiết kế xuất ra SVG với mọi chữ cái là đường viền ngoại tuyến, nên một tệp vẫn sắc nét ở cỡ danh thiếp và cỡ bọc tòa nhà.

![Một wordmark nét mảnh giãn rộng đọc Aurora, kiểu tác phẩm vector thuần mà hàng SVG của bảng nói đến](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Mọi định dạng và công dụng của chúng
| Bạn muốn | Dùng | Vì sao |
|---|---|---|
| Logo hoặc tác phẩm sắc nét co giãn được | **SVG** | Vector: co giãn được, nhỏ và chỉnh sửa được; hiệu ứng mà bản xuất vector không vẽ được sẽ được nhúng dưới dạng ảnh |
| Vector cho Office và ứng dụng Windows | **EMF** | Dán vào PowerPoint và Word như vector chỉnh sửa được, với chữ sống; Google Drive mở nó trong Google Drawings |
| Vector cho in ấn và ứng dụng thiết kế | **EPS**, hoặc **EPS (CMYK)** | Vector PostScript cho Illustrator và quy trình nhà in |
| Vector cho máy cắt | **DXF** | Máy cắt laser, máy cắt decal vinyl và CNC: đường viền tính bằng milimét |
| Bộ trang chiếu chỉnh sửa được | **PowerPoint** (PPTX) | Văn bản và hình khối gốc chỉnh sửa được, với ảnh và vector vẫn trích xuất được |
| Tài liệu văn bản chỉnh sửa được | **Word** (DOCX) hoặc **OpenDocument** (ODT) | Đoạn văn và đề mục thật mà trình soạn văn bản tiếp tục chỉnh sửa được (Doc Studio) |
| Bố cục cho InDesign | **InDesign IDML (static subset)** | Văn bản, hình chữ nhật, hình bầu dục và ảnh, mỗi artboard một spread (Design) |
| Tài liệu Penpot chỉnh sửa được | **Penpot** | Board, hình khối, văn bản và token liên kết |
| Ảnh chụp hoặc ảnh đa dụng | **PNG** (không mất dữ liệu) hoặc **JPG** (nhỏ hơn) | Ảnh điểm phổ quát |
| Ảnh hiện đại nhỏ hơn | **WebP** hoặc **AVIF** | Nén tốt hơn, có độ trong suốt |
| In ấn | **PDF**, hoặc **Print PDF** (CMYK) | Đúng khổ trang; CMYK cho máy in |
| Ảnh điểm cho máy in | **Print TIFF** (CMYK) | Điểm ảnh DeviceCMYK cho RIP |
| Hoạt ảnh cho web | **GIF** | Phát ở mọi nơi; tệp lớn hơn |
| Hoạt ảnh với đủ màu và độ trong suốt thật | **APNG** | PNG động: không giới hạn bảng màu |
| Hoạt ảnh, tệp nhỏ nhất | **Animated WebP** | Đủ màu và độ trong suốt, nhỏ hơn GIF hoặc APNG |
| Hoạt ảnh vector co giãn được | **Animated SVG** | Tự chứa; lặp trong trình duyệt hoặc `<img>`, ở mọi kích thước (Lottie Ad) |
| Hoạt ảnh vẫn chỉnh sửa được | **dotLottie** | Hình khối, đường dẫn và khóa biến đổi ngoài từ dòng thời gian của Design |
| Bàn giao cho Premiere | **Premiere XML + media** | Clip có thời gian và media gốc cho Premiere (Design) |
| Video cho mạng xã hội và chia sẻ | **MP4** hoặc **WebM** | Chất lượng tốt nhất theo dung lượng tệp (xem [Video](#video)) |
| Phụ đề | **SRT** hoặc **VTT** | Văn bản có thời gian cho trình phát video (Captions, Audiogram và Record) |
| Khóa đào tạo | **SCORM (LMS)** | Một trang web có phiên bản, gói SCORM hoặc xAPI (xem [SCORM](#scorm-course-packages)) |
| Văn bản có định dạng hoặc chữ ký email | **HTML** | Dán có định dạng vào ứng dụng thư |
| Nội dung thuần | **MD** hoặc **TXT** | Chỉ văn bản |
| Một sự kiện lịch | **ICS** | Nhập vào mọi ứng dụng lịch |
| Một danh thiếp liên hệ | **VCF** | Nhập vào sổ địa chỉ |
| Dữ liệu có cấu trúc để nhập lại | **JSON** hoặc **CSV** | Khứ hồi nội dung của công cụ |
| Một favicon | **ICO** | Biểu tượng trang nhiều kích thước; **ZIP** gói nhiều định dạng |
:::

### Độ trong suốt

Các công cụ hỗ trợ cung cấp công tắc nền trong suốt, như **No BG**. PNG, WebP, AVIF, SVG, APNG và Animated WebP giữ độ trong suốt, còn GIF giữ cạnh cứng. JPG và PDF luôn đục. TIFF được làm phẳng lên nền trắng, hoặc nền đen trên đường HDR mô tả dưới [HDR](#hdr-bright-colours).

## Kích thước và đơn vị in

Bản xuất dùng kích thước điểm ảnh gốc của công cụ trừ khi công cụ cung cấp **dimensions**. Khi đó bạn đặt chiều rộng, chiều cao và **unit**:

- **px** (mặc định) là điểm ảnh chính xác.
- **mm, cm, in, pt** và **pc** là kích thước vật lý. Với đơn vị vật lý bạn cũng đặt **DPI** (mặc định 300). Một **PDF** trở thành trang thật ở kích thước đó, một **ảnh điểm** nhận số điểm ảnh cho DPI đó và ghi lại độ phân giải, và một **SVG** giữ đơn vị vật lý với viewBox tính bằng điểm ảnh.

Để có ảnh điểm độ phân giải cao hơn, nhập chiều rộng và chiều cao lớn hơn, hoặc chọn đơn vị vật lý và tăng DPI (điểm ảnh = kích thước × DPI). Chiều rộng `210`, chiều cao `297` và đơn vị `mm` tạo một trang A4.

![Hàng kích thước đặt thành 210 x 297 mm, với trường DPI hiện ra vì đơn vị là vật lý](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Ảnh tĩnh từ một bố cục có thời lượng

Một bố cục có thời gian, như dòng thời gian [Sequence](/info/sequence-editor.html) trong Design, chuyển động, nên bản xuất tĩnh phải chọn một thời điểm: **khung hình tại đầu phát**. Đặt đầu phát ở nơi bạn muốn bức ảnh và xuất.

Với nhiều hơn một thời điểm, trường **Frames** xuất hiện bên cạnh kích thước đầu ra. Nó chỉ hiện với bố cục có thời gian và định dạng tĩnh (PNG, JPG, WebP, SVG hoặc PDF). Để ở `1` cho khung hình tại đầu phát. Tăng lên và bạn nhận từng ấy ảnh tĩnh, trải đều trên cả chuỗi:

- PNG, JPG, WebP và SVG trả về một ZIP: `<name>-01.png`, `-02.png` v.v.
- PDF trả về một tài liệu với từng ấy trang.

Mỗi ảnh tĩnh lấy từ giữa lát của nó trên dòng thời gian, nên khung hình đầu không bao giờ là một lối vào mờ dở và khung cuối không bao giờ là khoảnh khắc trống sau khi mọi clip đã kết thúc.

::: figure exporting-contact-sheet
Frames: 4 cắt chuỗi thành bốn lát bằng nhau và lấy điểm giữa của mỗi lát.
:::

Dùng nó cho một storyboard, một bảng liên hệ để xem xét hoặc một carousel mạng xã hội cắt từ một bản dựng video. Số lượng bị giới hạn ở 64, và mọi thứ khác gõ vào ô sẽ quay về `1`. Mỗi khung hình là một ảnh tĩnh bình thường, nên credential, Imprint, đơn vị vật lý và DPI hoạt động như với một bản xuất. Một liên kết xuất, CLI và MCP yêu cầu cùng bảng đó bằng `cuts=` (xem [Contact sheets](/info/url-export.html#contact-sheets)).

## Nhiều tệp cùng lúc

Lolly có ba cách làm việc ở khối lượng lớn, mỗi cách cho một việc khác nhau:

::: cols
## Một bảng thành một tài liệu
Công cụ có đầu vào bảng, như **Battlecards**, biến mỗi hàng thành một trang. Dán một bảng từ bảng tính và nhận một PDF. Sửa các hàng trong bảng tính rồi dán lại.
## Một CSV thành một tệp cho mỗi hàng
**Batch** (`#/batch`) nhận một CSV và kết xuất một bản xuất cho mỗi hàng: thẻ tên hoặc chứng nhận, mỗi cái một tệp, giao trong một ZIP. Xem [Batch](/info/batch.html#make-many-versions-of-one-design).
## Nhiều thiết kế một lần chỉnh sửa
**Multi-edit** mở nhiều phiên đã lưu cạnh nhau để chỉnh sửa y hệt trên các thiết kế khác nhau. Xem [Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Từ **Projects**, **Render folder** xuất mọi phiên đã lưu trong một thư mục và các thư mục con của nó thành một ZIP lồng nhau, và **Render selection** làm tương tự cho mọi vùng chọn nhiều; một phiên đã lưu kết xuất ra tệp riêng của nó. Một phiên đã lưu cũng có thể được chia sẻ lại dưới dạng liên kết công cụ từ Projects, mở lại với cùng cài đặt.

## Các tệp vẫn chỉnh sửa được ở nơi khác

Một số định dạng trao công việc của bạn cho ứng dụng khác dưới dạng nội dung chỉnh sửa được thay vì một bức ảnh.

### PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart, Diagrams, Flow Chart và Agenda xuất bộ trình chiếu PowerPoint, mỗi trang một trang chiếu. Mỗi trang được tách thành các đối tượng gốc, để đồng nghiệp chỉnh sửa bộ trang và lấy tài nguyên ra:

- <!--i:font--> **Văn bản** trở thành hộp văn bản PowerPoint chỉnh sửa được với cỡ chữ, màu, độ đậm, nghiêng và căn lề của bố cục.
- <!--i:pentool--> **Vector** như logo và biểu tượng được nhúng dưới dạng ảnh SVG; chúng vẫn sắc nét, và PowerPoint có thể *Convert to Shape* trên chúng.
- <!--i:photos--> **Ảnh** đến ở độ phân giải gốc dưới dạng ảnh riêng. Một ảnh hero bị cắt giữ ảnh đầy đủ phía sau vùng cắt, và mọi bộ lọc hay chế độ hòa trộn trên đó được nướng vào.
- <!--i:layers--> **Nền, viền và đường kẻ** trở thành hình chữ nhật và đường thẳng.

![Bảng xuất với PowerPoint được chọn: mỗi trang một slide, văn bản và hình dạng vẫn chỉnh sửa được](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Bố cục là gần đúng; mục tiêu là nội dung dùng lại được. Mọi thứ mà bộ duyệt không biểu đạt được theo kiểu gốc, như vùng có bộ lọc hay mặt nạ phức tạp, được nhúng dưới dạng ảnh để không mất gì. Một bộ trang có một kích thước trang chiếu, lấy từ trang đầu.

PowerPoint cũng là một lối vào: [Rebrand a deck](/info/rebrand.html) chuyển bộ trang sang hệ thống thiết kế của bạn, và [Import a design](/info/design-import.html) mở một bộ trong Design.

### Penpot

Hầu hết công cụ xuất SVG cũng xuất một **tệp Penpot** (`.penpot`), sẵn sàng để tiếp tục chỉnh sửa trong Penpot.

| Bạn đã làm gì | Trong Penpot |
|---|---|
| Văn bản | Đối tượng văn bản chỉnh sửa được: sửa lỗi chính tả hoặc đổi kiểu |
| Hình khối, đường dẫn, chuyển sắc và ảnh | Hình vector chỉnh sửa được riêng của chúng |
| Một màu hoặc phông chữ từ token hệ thống thiết kế | Một liên kết token sống: sửa token và mọi hình kế thừa nó theo |
| Cả thiết kế | Một component dùng lại được trong bảng Assets |
| Một minh họa phức tạp hoặc canvas trực tiếp | Được nhúng riêng dưới dạng ảnh, nội dung chỉnh sửa được xung quanh không bị động đến |

Từ Design, mỗi khung trở thành một board Penpot. Màu và kiểu chữ của hệ thống thiết kế vào bảng Assets và toàn bộ bộ token của nó vào bảng Tokens. Từ đó Penpot giữ bản sao riêng: một token được sửa trong Penpot quay lại qua việc nhập trong [Design System Setup](/info/brand-studio.html).

![Bảng xuất với Penpot được chọn: tệp .penpot, và Send to Penpot bên cạnh nút tải xuống](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Để mở tệp, khởi động Penpot, chọn một dự án và chọn **Import**. Khi đã đăng nhập Penpot từ bảng xuất, **Send to Penpot** làm bước đó cho bạn.

### Word, OpenDocument và InDesign

**Doc Studio** xuất **Word** (DOCX) và **OpenDocument** (ODT) với đoạn văn và đề mục thật.

**Design** xuất **InDesign IDML (static subset)**: văn bản, hình chữ nhật, hình bầu dục và ảnh PNG hoặc JPEG, mỗi artboard một spread. Định dạng nội dòng được hỗ trợ vẫn chỉnh sửa được, ảnh đi trong `Links` và tọa độ trở thành điểm InDesign. Việc liên kết lại, thay thế phông chữ và ngắt dòng thay đổi có thể cần chú ý. Hiệu ứng, hoạt ảnh, bài viết ghép và hình học không được hỗ trợ dừng bản xuất kèm báo cáo liệt kê chúng. IDML không bảo toàn tài liệu gốc, nên hãy gửi PDF cho tác phẩm hoàn tất.

### Dòng thời gian: dotLottie và Premiere

Từ dòng thời gian của Design, **dotLottie** ghi một hoạt ảnh vẫn chỉnh sửa được trong các công cụ Lottie; [Lottie animations](/info/sequence-editor.html#lottie-animations) liệt kê những gì nó giữ. **Premiere XML + media** đóng gói clip có thời gian và media gốc của chúng cho Premiere; xem [Premiere XML exchange](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (gói khóa học)

Xuất khóa học tắt cho đến khi bạn bật **Training and courses** dưới Settings → Preferences → Feature flags.

Rồi chọn **Export course** từ một công cụ được hỗ trợ, một thư mục dự án hoặc một vùng chọn. Trong Design, chọn **SCORM (LMS)** và **Download** mở cùng quy trình khóa học. Lolly lưu công việc, cho bạn xem lại nội dung và thứ tự khóa học, rồi mở module và hộp thoại xuất của nó.

- <!--i:layers--> Chọn một dạng thể hiện cho mỗi nguồn: trang tĩnh, chuyển động dưới dạng video, âm thanh hoặc tài nguyên tải xuống. Thêm văn bản bài học và phương án đọc thay thế trong module.
- <!--i:clock--> Xem trước trình phát của người học và xem lại mô tả và phụ đề. Chuyển động được đưa vào dưới dạng video, kể cả hoạt ảnh không tiếng.
- <!--i:document--> Chọn Website, SCORM 1.2, SCORM 2004 4th Edition hoặc đích xAPI thử nghiệm. Kiểm tra nội dung và kích thước ZIP, rồi lưu và tải bản đã kiểm tra.
- <!--i:check--> Hoàn thành đòi hỏi xác nhận mọi bài học bắt buộc và chọn Finish.

![Bảng xuất trên một bản trình chiếu Design với SCORM (LMS) được chọn](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Gói chứa nội dung hoàn chỉnh và không cần tài khoản Lolly. Đặt ZIP Website lên máy chủ HTTP(S); nhập ZIP LMS nguyên trạng. Hãy kiểm thử đích đến trước khi chia sẻ khóa học. Với khóa học dựng từ nhiều sản phẩm đã lưu, xem [Create a training course](/info/training-creators.html).

### DXF (tệp cắt)

Asset Export, Diagrams, Growth, Logo Wall, QR Code, Street Map, Wayfinding và Wordmark xuất **DXF**, định dạng trao đổi AutoCAD R12 mà máy cắt laser, máy cắt decal vinyl và phần mềm CNC đọc. Hình học được ghi dưới dạng đường viền tính bằng milimét, văn bản được chuyển thành đường viền và màu ánh xạ tới AutoCAD Color Index gần nhất, thứ thường điều khiển thao tác của máy cắt. DXF chỉ là nét vẽ: vùng ảnh chụp hay có bộ lọc không có đường cắt và bị bỏ, kèm cảnh báo. Dùng SVG hoặc PDF để giữ nội dung ảnh điểm.

Street Map là trường hợp rõ nhất. Cả thiết kế vốn đã là nét vẽ, nên mọi con đường và kênh đào trở thành đường cắt.

::: showcase
![Bản render Street Map của Paris bằng mực trên nền kem - hình vẽ đường nét thuần túy, nên mọi nét đều giữ nguyên khi đưa vào máy cắt](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Cuộn xuống, và góc nhìn kéo lùi xuyên qua chính hình học đó: bảy đường path, không một pixel nào, mỗi nét sắc nét như tóc ở bất kỳ độ phóng đại nào. Đó chính là tệp mà máy cắt sẽ đọc.
:::

## In

**Print PDF** ghi CMYK theo một điều kiện in có tên, mặc định là **Coated FOGRA39**. Ô màu thương hiệu có giá trị mực đã đo được chuyển đổi chính xác; các màu khác dùng chuyển đổi thiết bị chuẩn. **Print TIFF** ghi điểm ảnh DeviceCMYK cho RIP và ghi cùng điều kiện in trong siêu dữ liệu TIFF. Điều khiển Colour profile chi phối cả hai; [Colour profiles](#colour-profiles) có chi tiết.

**Print marks & bleed** có thẻ riêng trên các định dạng in: vùng tràn lề tính bằng milimét cộng chi tiết Crop, Registration, Bleed, Colour bars và Stamp.

Một số công cụ dựng **PDF nhiều trang**: một bìa, nội dung chảy sang bao nhiêu trang cần thiết và một trang cuối, như công cụ *Booklet*. Mỗi trang là một trang PDF dọc thật cỡ A4, US Letter hoặc A5, và bạn có thể ép bất kỳ khối nào sang trang mới. Đây là tài liệu RGB không có dấu cắt hay vùng tràn lề, thứ thuộc về Print PDF một trang. Một PDF Design cũng có thể là **Notes handout**: một trang dọc cho mỗi trang chiếu với ghi chú diễn giả bên dưới.

**Trước khi xuất.** Thẻ **Before you export** ở chân bảng cho biết nhà in sắp thấy gì: định dạng, kích thước và vùng tràn lề, vùng cắt và tràn lề, độ phủ mực, số bản in và số trang, kèm một kết luận cạnh tiêu đề. Nó không bao giờ chặn một bản xuất. Design luôn hiện thẻ với các kiểm tra riêng của nó, gồm quy tắc nội bộ của hệ thống thiết kế theo từng lớp và tín hiệu văn phong cho văn bản của tài liệu ([Before you export](/info/design.html#before-you-export)), và thêm các kiểm tra in này khi **Print preflight** bật. Trong các công cụ khác, bật **Print preflight** dưới Settings → Preferences → Feature flags; nó tắt theo mặc định, và một bản triển khai Lolly Work có thể bật nó cho thành viên.

**Sau khi xuất.** Khi tệp sẵn sàng, Lolly đọc lại nó và so sánh với những gì bạn đã chọn: định dạng, kích thước điểm ảnh hoặc trang, độ dài clip, nền trong suốt, màu CMYK, HDR, Content Credentials và mật khẩu PDF hoặc ZIP. Bất cứ điều gì khác biệt được ghi trên thẻ xuất. Mỗi số đo đến từ tệp, không bao giờ từ cài đặt, và một thuộc tính mà tệp không trả lời được sẽ không được tính là khớp. Dòng lệnh ghi bản so sánh đầy đủ bằng `--export-report` (xem [Render with the CLI](/info/cli-rendering.html)).

Các kiểm tra của trình kiểm tra Design và phép so sánh thương hiệu trong Design System Setup là các kiểm tra riêng: chúng nhìn thiết kế, còn hai thẻ này nhìn tệp.

::: details Chi phí từ bảng giá
Dưới preflight, một thẻ chi phí biến cùng các con số đếm thành tiền, chỉ dùng giá do ai đó cung cấp. Nó đọc các số đếm đó ngay cả khi chính thẻ preflight tắt. Nó cần hai thứ: một công việc mà bảng giá định giá được (bản in, tờ, diện tích, trang, hàng biến thể hoặc tệp đầu ra, nên một logo PNG thường không bao giờ hiện nó) và một **bảng giá** (rate card), một danh sách giá JSON từ nhà in. Bản dựng mặc định không có và không có cách nạp trong ứng dụng. Bảng giá đến dưới dạng tài nguyên danh mục mà một bản triển khai đi kèm, hoặc qua phần mở rộng bảng giá tùy chọn mà người tự lưu trữ hoặc mặt phẳng điều khiển bật. Không có bảng giá, không có gì hiện ra.

Mọi con số là một mức giá bạn cung cấp nhân một số lượng Lolly đếm, như `4 plate × €35.00`, và tổng mang theo nguồn của nó: bên phát hành trên thẻ và ngày mà giá đó có hiệu lực. Không có đơn vị tiền mặc định và không có giá giữ chỗ. Những gì tệp nói về chính nó vẫn là lời tường thuật: *"The file says: … Lolly has not verified this."*

Khi một con số không tính được, bảng bị rút lại thay vì điền bừa:

- Các dòng mà thẻ không định giá nghĩa là **không có tổng nào**, chỉ có một tiêu đề nói có bao nhiêu dòng chưa định giá.
- Một số lượng là mức trần mang **"up to"** vào tổng phụ của nó.
- Giá quá ngày hết hạn chỉ hiện **số đếm** cho đến khi bạn nhấn *Use these rates anyway*; ngày hết hạn khi đó đi cùng con số.
- Mở qua **liên kết**, tiền vẫn ẩn cho đến khi bạn yêu cầu trên thiết bị này. CLI nhận `--rate-card=<file.json>` như tệp cục bộ và không bao giờ như tham số liên kết.

Thẻ bị loại khỏi mọi giai đoạn xuất, nên nó không bao giờ đổi tệp. Đó là số học, không phải báo giá; chỉ nhà in của bạn mới báo giá được.
:::

## Chuyển động và âm thanh

### Video

Các công cụ động xuất **MP4** và **WebM**. Bộ chọn chỉ hiện các container mà trình duyệt này tạo được, và một liên kết `?format=` được chia sẻ yêu cầu cái không tạo được sẽ quay về cái còn lại, với tên tệp khớp. Công cụ động cũng cung cấp **Start after**, giữ canvas đứng yên một lúc để hoạt ảnh và phông chữ ổn định trước khi ghi, và **Duration**, độ dài của clip hoàn chỉnh. **Motion blur** (Off, Draft quality, Standard hoặc High, với **Shutter angle**) làm mờ chuyển động nhanh với cái giá là thời gian kết xuất. Nơi trình duyệt hỗ trợ, **Record live** ghi bản xem trước trên màn hình theo thời gian thực qua chia sẻ màn hình thay thế.

![Cài đặt thời gian cho bản xuất động: Start after, Duration, Motion blur với Shutter angle, và Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** chọn Smaller file, Balanced hoặc Best quality. **Advanced** mở **Codec**, **Frame rate**, **Rate mode** và **Hardware acceleration**. Nơi một công cụ có phụ đề, **Captions** chọn một **Embedded track** hoặc **Sidecar .vtt + .srt** bên cạnh video. Một liên kết mang chất lượng, codec, tốc độ khung hình, thời lượng và độ trễ bắt đầu dưới dạng `vq`, `codec`, `fps`, `seconds` và `wait` ([URL parameters](/info/url-parameters.html)).

Bản xuất video giữ âm thanh của chúng. Một công cụ có thể đặt **music bed** dưới clip: một tài nguyên âm thanh được lặp hoặc cắt theo độ dài clip, với fade, âm lượng và ducking dưới âm thanh của chính cảnh quay. Các công cụ ghi mang âm thanh trực tiếp của chúng vào tệp.

Một bộ trang Design vốn là bộ bấm chuyển vẫn có thể ra đi dưới dạng video. **Export slides as video** trong menu Present mở bảng xuất ở MP4. Mỗi trang chiếu phát trong thời gian dừng của riêng nó, hoặc trong Duration của bảng xuất khi nó không có, và chuyển cảnh của bộ trang phát giữa chúng dưới dạng hòa tan. Bản thân tài liệu không đổi.

### Ảnh động

**GIF** phát ở mọi nơi và phù hợp với trò chuyện và email; nó lớn hơn và ít màu hơn video. **APNG** và **Animated WebP** giữ đủ màu và độ trong suốt. **Lottie Ad** cũng xuất **Animated SVG**: khung hình vector với keyframe CSS nhúng, nên nó co giãn tới mọi kích thước và lặp trong thẻ trình duyệt hoặc `<img>` mà không cần codec. Văn bản của nó được chuyển thành đường viền, và nó dùng tốc độ khung hình mặc định thấp hơn vì mỗi khung nặng hơn ảnh điểm. Tất cả những cái này không có tiếng.

### Âm thanh

Một số công cụ xuất âm thanh riêng. **Voice Recorder** ghi một bản thu từ micro với đồng hồ đo mức trực tiếp và lưu dưới dạng **MP3**, **WAV**, **M4A (AAC)** hoặc **Opus (WebM)**, được mã hóa trên thiết bị của bạn. `wav`, `mp3`, `m4a` và `opus` là các id định dạng bình thường, nên một bản xuất âm thanh chia sẻ và viết tập lệnh được như một PNG.

Bộ chọn tài nguyên chấp nhận nhiều loại âm thanh cho music bed, từ MP3 và FLAC đến MIDI và module tracker; [Formats](/info/formats.html) liệt kê chúng. Một [bài hát Rondocode](/info/rondocode.html) phát ở độ dài mà clip của nó yêu cầu.

## Màu sắc và HDR

Lolly đọc mọi màu CSS hiện đại, tính toán màu theo cảm thụ và ghi mỗi tệp trong một không gian mà người đọc mở được: sRGB cho màn hình, CMYK cho in và Rec.2100 PQ cho HDR. [Colour in the engine](/info/colour-engine.html) giải thích cách làm. Một tài liệu Design đặt **Wide colour / HDR** theo quy tắc riêng của nó, mô tả trong [Wide colour and HDR editing](/info/hdr-editing.html).

### Hồ sơ màu

Bản xuất được gắn một hồ sơ màu, để các ứng dụng quản lý màu như nhà in, Photoshop và trình duyệt đọc màu như bạn đã thấy. Việc này diễn ra tự động; hình thu nhỏ và bản xem trước bỏ qua thẻ để giữ nhỏ.

- **PNG và JPG** mang hồ sơ ICC **sRGB** nhúng, không gian mà bản xem trước được vẽ. Điểm ảnh được gắn thẻ, không mã hóa lại.
- **Print PDF (CMYK)** khai báo điều kiện in trong *OutputIntent*, cho nhà in biết các mực CMYK của nó được hiểu thế nào.
- **Print TIFF (CMYK)** ghi điểm ảnh DeviceCMYK không gắn thẻ và ghi điều kiện in trong siêu dữ liệu TIFF. TIFF không nhúng được hồ sơ máy in, nên hàng **Embed** chỉ ghi tên hồ sơ đó.
- **TIFF (RGB)** là anh em sRGB không nén cho lưu trữ hoặc khứ hồi trình chỉnh sửa. Nó làm phẳng độ trong suốt lên nền trắng. Cả hai TIFF chỉ có trên máy tính, vì trình duyệt không xem trước được TIFF.
- **SVG**, **EMF**, **EPS** và **DXF** là vector không có hồ sơ nhúng: màu của SVG là sRGB, EMF và EPS dùng RGB thiết bị, **EPS (CMYK)** ghi DeviceCMYK và DXF dùng AutoCAD Color Index. SVG, EPS và DXF chuyển văn bản thành đường viền. EMF giữ văn bản sống và chỉnh sửa được trong Office và Google Slides, chỉ chuyển về đường viền cho các đoạn mà định dạng không biểu đạt được; tùy chọn **Outline fonts** của bảng xuất ép dùng đường viền ở mọi nơi. SVG cũng tái tạo đổ bóng hộp CSS, trong và ngoài.

::: details PDF/X-4 và hồ sơ máy in của riêng bạn
Không hồ sơ CMYK nào đi kèm Lolly. Một điều kiện in có tên ghi output intent mà không tuyên bố tuân thủ PDF/X-4, vì PDF/X-4 muốn hồ sơ được nhúng.

Nạp hồ sơ CMYK của riêng bạn và chọn hàng **Embed** của nó trong điều khiển Colour profile. Nó được nhúng làm *DestOutputProfile* của tệp, và PDF tuyên bố PDF/X-4 bất cứ khi nào phần còn lại của tệp cho phép. Điều kiện in mà nó khai báo được đọc từ hồ sơ đó: một tên đã đăng ký nơi hồ sơ chứng minh được, hoặc `Custom` dưới tên riêng của hồ sơ.

Ba điều giữ lại tuyên bố trong khi vẫn giữ output intent: tác phẩm RGB mà lượt CMYK không chuyển đổi được, văn bản ghi công lề thử `prov` (vẽ bằng phông chuẩn không được nhúng) và mật khẩu **Strong**, vì PDF/X-4 cấm mã hóa. Mọi PDF cũng mang siêu dữ liệu PDF/X-4: hộp trang, XMP, ID tài liệu và output intent sRGB cùng hồ sơ của nó.
:::

### HDR (màu sáng)

Đây là thẻ **HDR** của bảng xuất, làm sáng tác phẩm thông thường cho màn hình HDR. Giữ bản gốc HDR qua chỉnh sửa là tính năng khác: [Wide colour and HDR editing](/info/hdr-editing.html).

Một bản xuất thông thường là sRGB: một màu thương hiệu bão hòa sáng bằng màu trắng thông thường của màn hình. Màn hình HDR có khoảng dư phía trên đó. Thẻ **HDR** đẩy màu thương hiệu và chữ trắng của bạn lên gần độ sáng đỉnh, trong khi vùng tối vẫn tối và cho ánh sáng độ tương phản.

![Thẻ HDR trong bảng xuất, đã bật, với các núm White / Reach / Dark lift / Focus hiện ra phía dưới](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Định dạng.** PNG, JPG, AVIF và TIFF. WebP là 8-bit và không có đường giải mã HDR hoạt động, còn vector và PDF không có mô hình HDR.
- **Tắt theo mặc định**, vì nó đổi điểm ảnh. Đánh dấu thẻ, hoặc truyền `hdr=1` trong liên kết chia sẻ.
- **Các núm.** **White** (trần độ sáng đỉnh, 400 đến 2000 nit), **Reach** (ánh sáng lan xuống các tông bao xa), **Dark lift** (vùng tối sáng lên bao nhiêu; `0` giữ chúng tối) và **Focus** (phần đẩy giữ lại bao nhiêu độ phong phú màu). Chúng đi như một giá trị: `hdr=1600-60-0-50` là White 1600, Reach 60, Dark lift 0 và Focus 50.
- **Những gì được ghi.** PNG nhận Rec.2100 PQ 16-bit với chunk `cICP`. JPG là JPEG gain-map ISO 21496-1: một ảnh SDR thường cộng một gain map nối thêm. AVIF nhận hộp `colr` được ghi lại. TIFF nhận điểm ảnh PQ với hồ sơ ICC v4 được tạo mang thẻ `cicp`, và làm phẳng lên nền đen, vì trắng là mã 10.000 nit trong PQ và sẽ tạo quầng quanh mọi cạnh. Phần đẩy theo độ sáng cảm thụ (OKLab) và giữ sắc độ, nên màu xanh thương hiệu sáng hơn, không nhạt như bạc hà.
- **Nơi ánh sáng hiện ra.** Trình xem quản lý màu trên màn hình HDR: Preview, Quick Look và Safari trên thiết bị Apple, hoặc Chrome trên màn hình HDR. Màn hình SDR hiện ảnh bình thường.
- **Trước khi giao.** Nhiều nền tảng mã hóa lại bản tải lên và bỏ tín hiệu HDR, có thể khiến ảnh tối hoặc bạc màu. Hãy dùng HDR nơi bạn kiểm soát đích đến, như trang của riêng bạn, tường video hoặc bộ trang trên màn hình sáng.
- **Từ terminal.** `--hdr=1` với `--export=png` hoặc `--export=jpg` ghi cùng PNG và JPEG gain-map trên [CLI](/info/cli.html), từ cùng bộ mã hóa engine, không có trình duyệt trên đường. AVIF và TIFF hiện vẫn là bản xuất web.

## Những gì đi cùng tệp của bạn

Một tệp hoàn chỉnh có thể mang nhiều bản ghi bên cạnh bức ảnh. Một số đi bên cạnh điểm ảnh và biến mất khi tệp được lưu lại hoặc bị lột; hai dấu nằm ngay trong điểm ảnh.

::: figure exporting-what-travels
Mỗi bản ghi nằm ở đâu, có bật theo mặc định không và tham số liên kết nào điều khiển từng cái.
:::

Bảng xuất gập **Licence**, **Source credits**, *Password protect*, **C2PA Credentials**, **Lolly Imprint** và **Durable credential** thành một nhóm **Content protection** chỉ hiện các thẻ mà định dạng đã chọn dùng được. Nó tự mở khi một liên kết hoặc tài liệu đã khai báo giấy phép, hoặc khi một nguồn cần bạn quyết định. Thẻ **Design system** ở ngoài nhóm, hiện trên mọi bản xuất.

![Nhóm Content protection được mở trên một bản xuất PNG, chỉ hiển thị các thẻ áp dụng được cho nó](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Nguồn gốc & hình mờ

Nơi định dạng có trường, bản xuất mang **siêu dữ liệu nguồn gốc**: phần mềm, nguồn, tên công cụ và dòng ghi công hồ sơ của bạn, được ghi vào PNG iTXt, JPEG EXIF, thông tin PDF, `<metadata>` của SVG hoặc chú thích GIF. Nó chỉ ghi quyền tác giả, và không có gì được tải lên. Các công cụ **Experimental** cũng đóng hình mờ nhìn thấy, do host áp dụng để chỉnh sửa công cụ không gỡ được dấu.

**Lolly Imprint** là hình mờ điểm ảnh vô hình, **bật theo mặc định**. Credential và siêu dữ liệu đi bên cạnh điểm ảnh và mất khi lưu lại, chụp màn hình hoặc lột siêu dữ liệu. Imprint nằm trong điểm ảnh và bền hơn việc nén lại, nên một bản sao vẫn được nhận ra là do Lolly làm. Nó là gợi ý chứ không phải đảm bảo mật mã, và không mang dữ liệu cá nhân. Nó đi trong JPEG XL, PNG, JPG, WebP, AVIF, TIFF và BMP, và trong các ảnh điểm Lolly kết xuất vào PDF hay PPTX, không bao giờ trong ảnh bạn nhúng. Bỏ chọn **Lolly Imprint** hoặc truyền `imprint=0` để bỏ Imprint. Khả năng AVIF sống sót qua mã hóa lại chưa được hiệu chỉnh. [Verify](/verify) phát hiện nó trên thiết bị của bạn; xem [The Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**Durable credential** ghi id của Lolly vào điểm ảnh bằng mô hình nơ-ron trên thiết bị theo định dạng TrustMark, để liên kết "made with Lolly" bền hơn việc lột siêu dữ liệu và mã hóa lại, và các công cụ biết TrustMark đọc được. Nó **tắt theo mặc định**, vì tốn một lượt nơ-ron cho mỗi bản xuất và một lần tải mô hình. Nó bao gồm PNG, JPG, WebP, AVIF và TIFF; đánh dấu trong bảng hoặc truyền `durable=1`. Ứng dụng máy tính và di động ẩn thẻ này, vì chúng không có nguồn gốc để tải mô hình khi ngoại tuyến.

**Licence.** Chọn cách người khác được dùng tác phẩm của bạn: *None (all rights reserved)* theo mặc định, CC0 1.0, Public Domain Mark 1.0, hoặc giấy phép Creative Commons 4.0 (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). Tên giấy phép và liên kết tới bản tóm tắt của nó đi vào siêu dữ liệu giấy phép của tệp (EXIF, XMP và RIFF nơi định dạng có) và Content Credential. Lựa chọn được lưu cùng tài liệu và đi trong liên kết dưới dạng `licence=`. Lolly ghi giấy phép bạn chọn; nó không kiểm tra hay thực thi các điều khoản. Một công cụ có trường giấy phép riêng, như Claim, giữ trường đó thay thế.

### Bản ghi hệ thống thiết kế

Một bản xuất ghi lại hệ thống thiết kế đã tạo tệp: tên, phiên bản đã phát hành mà nó được vẽ từ đó (khi đó không phải phiên bản đang làm việc) và [colourway](/info/colourways.html) nó được vẽ. Mọi lựa chọn chủ đề khác mà hệ thống thiết kế khai báo, như mật độ, được ghi theo cùng cách. Lựa chọn sáng hay tối bị bỏ, vì bức ảnh đã cho thấy cái nào được dùng.

**Bạn thấy bản ghi trước khi bất cứ gì được ghi.** Thẻ **Design system**, đánh dấu sẵn, hiện đúng những từ mà tệp sẽ mang, như *Records: Acme · Colourway: Beach*, và mô tả như nó sẽ đọc. Tên của hệ thống thiết kế là bất cứ gì chủ sở hữu gõ, nên thẻ hiện nó như đã viết. Bỏ chọn thẻ để bỏ bản ghi khỏi bản xuất đó. Bảng tài liệu của Design liệt kê cùng các từ đó dưới *Embedded in exports*.

**Mô tả nêu colourway bên cạnh công cụ.** Khi thẻ được đánh dấu, *"Made with https://lolly.tools : Chart"* trở thành *"Made with https://lolly.tools : Chart (Beach colourway)"*. Tên riêng của hệ thống thiết kế ở lại trong bản ghi, không trong mô tả. Mô tả không có tên công cụ, hoặc mô tả mà công cụ viết từ đầu vào của chính nó, được giữ nguyên. Một công cụ bỏ qua colourway qua `tokenAxes` không ghi cái nào, và ghi công thử PDF (dấu in `prov`) theo cùng quy tắc.

**Brand skills đã dẫn dắt một tác tử.** Khi một tác tử tạo tác phẩm và nêu tên [brand skills](/info/brand-skills.html) nó đã đọc và theo, bản ghi cũng liệt kê từng skill kèm bản sửa đổi, như *Guided by: acme-brand 1.0*. Các từ này nghĩa là skill đã dẫn dắt công việc. Chúng không phải kiểm tra: Lolly không kiểm thử tác phẩm với một skill. Chỉ lời khai của chính tác tử mới thêm danh sách, hiện nay nghĩa là tham số `brandSkills` của `lolly_render` trên [máy chủ MCP](/info/mcp.html), nên một tác phẩm làm trong ứng dụng hoặc từ liên kết chia sẻ không mang cái nào. Content Credential giữ danh sách dưới dạng `brandSkills`, một giá trị JSON với id, tên, bản sửa đổi và giá trị băm SHA-256 của mỗi skill. Gói XMP và siêu dữ liệu SVG giữ cùng giá trị dưới dạng `lolly:BrandSkills`, một PDF được ghi từ bản ghi thêm một từ khóa cho mỗi skill và mô tả giữ nguyên. Một skill nội bộ được ghi bằng id, tên, bản sửa đổi và giá trị băm, không bao giờ bằng văn bản của nó. Cùng các công tắc đó bỏ danh sách cùng phần còn lại của bản ghi: thẻ **Design system**, `_madewith=0`, `--no-madewith` và `madeWith: false`. Khi máy chủ MCP vẽ tệp trong trình duyệt (PDF, JPEG và các định dạng khác mà đường không trình duyệt của nó không ghi được), siêu dữ liệu của chính tệp không giữ danh sách và chỉ Content Credential mới giữ được. Truyền `c2pa` để giữ bản ghi; không có credential, bản kết xuất cảnh báo rằng brand skills chưa được ghi lại.

**Đọc lại bản ghi.** [Verify](/verify) liệt kê bản ghi dưới dạng **Design system** trong chi tiết credential của tệp và mọi brand skills dưới dạng **Guided by**. *Recreate with these settings* mở lại công cụ ở phiên bản và colourway đã ghi. Liên kết mở với hệ thống thiết kế đã ghi khi thiết bị này có một hệ thống cùng id và tên; nếu không nó mở với hệ thống thiết kế đang dùng của bạn.

::: details Cái gì được ghi ở đâu, và lần chạy nào bỏ bản ghi
| Ở đâu | Cái gì được ghi |
|---|---|
| Content Credential | `designSystem` (id), `designSystemLabel`, `designVersion` và `themes` trong khẳng định `tools.lolly.export`, mỗi giá trị là văn bản thuần; `themes` là một danh sách JSON các lựa chọn |
| PNG, JPEG, WebP và JXL | Cùng bốn giá trị dưới dạng thuộc tính `lolly:` của gói XMP trong tệp, trong không gian tên `https://lolly.tools/ns/export/1.0/` |
| SVG | Cùng các thuộc tính `lolly:` bên trong khối `<metadata>` |
| PDF | Từ khóa như *Design system: Acme* và *Colourway: Beach* |
| Mọi định dạng có trường mô tả | Mô tả, với colourway bên cạnh công cụ |

Thẻ chỉ xuất hiện khi có gì để ghi và định dạng giữ được bản ghi. CSV, JSON, tệp lịch và các định dạng văn bản hay dữ liệu khác không giữ siêu dữ liệu, và EPS, EMF, DXF cùng BMP không có trường cho bản ghi. HTML, Markdown và CSS chỉ giữ bản ghi trong Content Credential của chúng, nên với chúng thẻ không hiện dòng mô tả và ẩn khi **C2PA Credentials** tắt. Một trường mà hệ thống thiết kế không cung cấp thì ở ngoài tệp.

Một liên kết chia sẻ tắt bản ghi bằng `_madewith=0` ([URL parameters](/info/url-parameters.html)); dòng lệnh nhận `--no-madewith`, `lolly_render` của [máy chủ MCP](/info/mcp.html) nhận `madeWith: false`, và bảng xuất của ứng dụng terminal có hàng **Design system**. Dòng lệnh in các từ mà một tệp hoàn chỉnh mang ra lỗi chuẩn, cho một lần kết xuất công cụ và cho mỗi tệp mà `lolly run` xuất từ một phiên Design đã lưu, và một lần kết xuất MCP in chúng bên cạnh tệp, cả hai đều đọc lại từ tệp. Một PNG mà dòng lệnh vẽ không có trình duyệt không mang siêu dữ liệu tệp, nên bản ghi của nó chỉ đi trong credential. Các tiện ích trên thiết bị không thêm siêu dữ liệu nào.

Các lượt chạy không có thẻ **Design system** bỏ bản ghi: một lượt chạy Batch, một thư mục xuất từ Projects và một bản xuất bộ sưu tập 3D, và trong ứng dụng terminal là batch CSV, bản xuất thư mục hoặc vùng chọn Projects và chế độ render-everything. Hãy xuất một tệp từ công cụ để ghi hệ thống thiết kế.
:::

### Content Credentials (C2PA)

Bản xuất có thể mang **Content Credentials**: một manifest [C2PA](https://c2pa.org) có chữ ký ghi lại điều gì đã tạo ra tệp, khi nào và ở đâu, gắn với giá trị băm các byte của tệp để mọi chỉnh sửa sau đó đều phát hiện được. Đặc tả do C2PA công bố, và Lolly ghi các manifest chuẩn mà bất kỳ trình đọc C2PA nào cũng kiểm tra được.

![Thẻ C2PA Credentials, đã đánh dấu, với thời hạn credential cạnh hộp kiểm](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Bật theo mặc định.** Thẻ **C2PA Credentials** được chọn sẵn cho gần như mọi công cụ. Bỏ chọn cho một bản xuất, hoặc truyền `c2pa=off` trong liên kết. Một công cụ có thể từ chối trong manifest của nó.
- **Định dạng.** PDF (RGB và Print), PNG và APNG, JPG, GIF, SVG, TIFF (RGB và Print), WebP (tĩnh và động), AVIF, MP4, WebM, các container âm thanh MP3, WAV, M4A, OGG/Opus và FLAC, cùng HTML, Markdown và CSS. Một ZIP đóng dấu từng thành phần được hỗ trợ, đó là cách một Animated SVG có credential. MP4, AVIF và M4A dùng ràng buộc BMFF chuẩn và MP3 dùng ánh xạ ID3v2 của nó, nên `c2patool` và các trình đọc khác xác minh được. WebM và OGG/Opus chưa có ánh xạ chuẩn, nên Lolly mang manifest dưới dạng tệp đính kèm Matroska và trường OpusTags, mà trình xác minh riêng của Lolly kiểm tra. ICO, EPS, EMF, DXF, BMP, PPTX, các định dạng Office và các định dạng văn bản và dữ liệu khác không có container C2PA.
- **Nó ghi gì.** Công cụ và ứng dụng đã tạo tệp, thời điểm ký, shell đã xuất, [hệ thống thiết kế và colourway](#the-design-system-record) khi thẻ **Design system** được đánh dấu, và dấu vân tay của các đầu vào đang hoạt động. Văn bản đầu vào, trường gắn hồ sơ, điều khiển không hoạt động, phiên bản trình duyệt và chi tiết hệ điều hành bị bỏ. Tên và email của bạn chỉ xuất hiện làm tác giả khi **Use my details to create** bật dưới Settings → Preferences → Your details. Các nguồn mà bản xuất đặt vào đi dưới dạng thành phần: [tác phẩm được ghi công](#source-credits) như emoji, và [bài hát Rondocode](/info/rondocode.html#songs-in-the-credential) trong bản xuất video hoặc âm thanh.
- **Người nhận thấy gì.** Các công cụ C2PA như ứng dụng Adobe, `c2patool` và contentcredentials.org/verify đọc manifest và hiện khẳng định. Lolly ký bằng khóa tạo trên thiết bị của bạn, không phải chứng chỉ từ danh sách tin cậy, nên các trình xem báo credential là *unverified*: cấu trúc và dấu vết can thiệp là thật, người ký thì không được bảo chứng. Để đổi điều đó, đăng ký một **verified identity** dưới Settings → Preferences → Content Credentials; xem [Content Credentials Identity](/info/content-credentials-identity.html).
- **Kiểm tra một tệp.** Thả bất kỳ tệp nào lên [Verify](/verify), hoặc chạy `lolly validate <file>`, để có báo cáo trên thiết bị mở đầu bằng việc Lolly có tạo tệp không và nó có thay đổi kể từ đó không. Verify cũng nhìn ngoài credential; xem [What Verify checks](/info/what-verify-checks.html).
- **Quyền riêng tư.** Khóa ký được tạo cho bản xuất và không bao giờ rời thiết bị, và khẳng định chỉ chứa những gì siêu dữ liệu nguồn gốc vốn đã mang. Các tiện ích riêng tư biến đổi tệp của chính bạn không thêm credential, và *Strip Hidden Data* gỡ manifest C2PA như mọi siêu dữ liệu khác. Tiện ích Rondocode tạo âm thanh mới, nên nó ký những gì nó ghi ([Rondocode songs](/info/rondocode.html#files-from-the-rondocode-utility)).
- **Tương tác.** Một PDF có mật khẩu không thể mang Content Credentials, ở cả hai mức. Credential được thêm sau cùng, lên các byte hoàn chỉnh, sau DPI, EXIF, hồ sơ màu, siêu dữ liệu PDF/X và dấu in.

### Ghi công nguồn

Một bản xuất đặt tác phẩm của người khác ghi nguồn đó trong credential. Emoji vẽ từ bộ emoji đã chọn là trường hợp thường gặp: tác phẩm, người tạo, giấy phép, nơi các byte chính xác đến từ đâu và điều gì đã đổi đều đi cùng tệp. Văn bản trong một công cụ có mẫu là SVG giữ emoji của hệ thống, nên không có gì được ghi công ở đó. Hàng **Source credits** cho biết các nguồn yêu cầu gì từ việc phân phối trước khi bạn tải, và sau khi tải nó đọc lại các byte đã giao trước khi nói rằng phần ghi công đã có trong tệp. Một giấy phép yêu cầu bạn chọn, như một glyph CC BY-SA đã nhuộm lại mà bạn sắp chia sẻ, nhận một thẻ với các lựa chọn; việc tải không bao giờ bị chặn. [Creative rights and credits](/info/creative-rights.html) có cách diễn đạt, các giấy phép đã xem xét và những gì vẫn thuộc về bạn.

## Bảo vệ bằng mật khẩu

Hai loại khóa, đều làm trên thiết bị của bạn. Thẻ *Password protect* của bảng xuất điều khiển cả hai.

![Thẻ Password protect được mở rộng trên một bản xuất PDF, với trường mật khẩu và hai cấp khóa](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Mật khẩu mở PDF** có hai mức khi bạn gõ mật khẩu:

- **Weak**: RC4 40-bit, một biện pháp răn đe hơn là bảo vệ. Mật khẩu của nó có thể đi trong liên kết chia sẻ, dưới dạng văn bản thường. Chỉ `pdf` RGB.
- **Strong**: AES-256 (PDF 2.0). Gõ khi xuất và không bao giờ đặt trong liên kết. Nó cũng áp dụng cho Print PDF và cho mỗi PDF trong một ZIP batch. Một Print PDF khóa Strong giữ CMYK, dấu in và output intent nhưng bỏ tuyên bố PDF/X-4.

**ZIP có khóa** bao gồm một bản xuất ZIP, một thư mục tải xuống từ Projects hoặc một batch, với một mật khẩu ở hai mức: **Weak** (ZipCrypto, một biện pháp răn đe; có thể đi trong liên kết `?password=`) hoặc **Strong** (AES-256, gõ khi xuất, không bao giờ trong liên kết). Mật khẩu bảo vệ mọi thành phần, và mọi PDF bên trong cũng được khóa AES-256 riêng, nên vẫn khóa sau khi ZIP được giải nén. Lời nhắc xuất hiện khi việc tải bắt đầu; mật khẩu trống nghĩa là không khóa.

**Liên kết chia sẻ có mật khẩu** hỏi người nhận mật khẩu trước khi mở. Toàn bộ trạng thái liên kết được mã hóa AES-256 dưới một khóa dẫn xuất từ mật khẩu (PBKDF2), nên chỉ bản mã đi và việc giải mã diễn ra trong trình duyệt của người nhận. Máy chủ phục vụ liên kết không bao giờ thấy mật khẩu hay thiết kế. Bật nó trong hộp thoại **Share**. Một liên kết mã hóa chỉ mở trong Lolly, không bao giờ như một ảnh nhúng. Xem [URL Mode](/info/url-mode.html).

## Trên điện thoại

Các điều khiển xuất nằm sau nút **Export** nổi, mở tấm **Export**: cùng định dạng, kích thước, sao chép, tải xuống và chia sẻ, được dựng cho cảm ứng.

## Id định dạng cho liên kết và CLI

Đây là các giá trị cho tham số URL `format=` và cờ CLI `--export=` (xem [URL parameters](/info/url-parameters.html) và [CLI](/info/cli.html)). Menu của một công cụ chỉ hiện các định dạng công cụ đó làm được, nên luôn ngắn hơn danh sách này.

| Loại | Id |
|---|---|
| Ảnh điểm | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vector | `svg` · `svgz` (SVG nén gzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (tệp cắt) |
| Trang và tài liệu | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (tệp thiết kế Penpot) · `scorm` (gói khóa học, một ZIP) |
| Chuyển động | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Âm thanh | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` |
| Văn bản và dữ liệu | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `css` · `scss` · `gpl` (bảng màu GIMP) |
| Gói và bộ đóng gói | `zip` · `rpm` và `tar.gz` (bản kết xuất được niêm phong vào gói Linux) |

Một vài id đến từ mã xuất riêng của công cụ: `ase` (Adobe Swatch Exchange, từ Palette Lab) và `exr` cùng `hdr` (ảnh điểm dải động cao, từ Darkroom). **Convert Font** ghi `ttf`, `otf` và `woff` từ tệp phông chữ bạn cung cấp, nên một liên kết trần không có gì để nó kết xuất.
