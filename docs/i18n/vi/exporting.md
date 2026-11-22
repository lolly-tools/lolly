# Xuất một tệp

Nhấn **Export**, nửa trái của viên thuốc **Export | Save**, chọn định dạng bên cạnh tên tệp và nhấn **Download**. Tệp được tạo trên thiết bị của bạn.

Tệp chứa những gì bạn thấy trên canvas. Menu định dạng chỉ liệt kê những gì công cụ này làm được trong trình duyệt này.

Hầu hết công việc cần một trong ba định dạng:

| Dành cho | Chọn | Vì sao |
|---|---|---|
| Màn hình, tin nhắn hoặc trang chiếu | **PNG** | Mọi ứng dụng đều mở được và giữ nền trong suốt khi công cụ có hỗ trợ |
| Trang hoàn chỉnh hoặc bất cứ thứ gì để in | **PDF** | Kích thước trang thật, in ra đúng như hiển thị; **Print PDF**, ở nơi công cụ hỗ trợ, là phiên bản CMYK dành cho máy in |
| Hình ảnh cần luôn sắc nét ở mọi kích thước | **SVG** | Hình dạng vector |

::: check Kiểm tra tệp ở kích thước sẽ dùng
Trước khi gửi tệp, hãy mở trên màn hình mà nó được tạo ra để dùng hoặc in ở kích thước thật.
:::

::: details Phê duyệt và bàn giao với Lolly Work (tùy chọn)
Một [tổ chức chạy Lolly Work](/info/organisation.html) có thể chọn định dạng và cài đặt xuất mà thành viên nhìn thấy. Nơi cần phê duyệt, **Request approval** thay cho **Download**. Hãy theo chính sách mà phiên bản của bạn hiển thị.

Lolly Work cũng có thể bàn giao tệp tới các đích S3, WebDAV và HTTP đã cấu hình, với các bước phê duyệt, biên nhận bàn giao và bản ghi kiểm toán. Việc bàn giao đó gửi tệp tới dịch vụ của tổ chức. Một lần tải xuống thông thường ở lại trên thiết bị của bạn. Các đích Send cá nhân và bàn giao của tổ chức được cấu hình riêng.

Đơn vị vận hành thiết lập việc này bằng [hướng dẫn bàn giao của tổ chức](/info/work-delivery.html). Với các lần kết xuất máy chủ và batch xếp hàng, xem [Batch và tự động hóa bằng CLI](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

<!--i:eti-cpu-->
## Cách xuất hoạt động

Ba đường tạo ra một tệp. Hầu hết công cụ **kết xuất canvas**. Các định dạng văn bản và dữ liệu (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) được **tạo từ nội dung của công cụ**. Các tiện ích riêng tư như *Lolly Strip Hidden Data* **biến đổi tệp bạn đã chọn** trên thiết bị của bạn. Kết quả không có canvas, hình mờ hay siêu dữ liệu thêm vào.

![Ba đường xuất hội tụ thành một tệp hoàn chỉnh: kết xuất canvas, tạo văn bản hoặc dữ liệu từ nội dung, hoặc biến đổi tệp đã chọn trên thiết bị.](/info/diagrams/concepts/three-export-paths.svg)

Tác giả công cụ chọn các hành động có trong bảng xuất. Bộ mặc định là Copy, Download và Save.

- <!--i:download--> **Download** lưu tệp. Nếu sau đó không tìm thấy, xem [Tìm tệp bạn đã tải xuống](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** đặt ảnh vào clipboard. Nơi trình duyệt không sao chép được ảnh, Copy tải tệp xuống thay thế và báo cho bạn.
- <!--i:folder--> **Save** giữ thiết kế hiện tại trong Projects và không bao giờ tải tệp xuống. **Save as**, bên cạnh **Download**, hỏi nơi lưu (xem [Lưu và tiếp tục](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** mở hộp thoại Share: liên kết tái tạo thiết kế, các công tắc khi truy cập (toàn màn hình, bảng xuất, tải xuống hoặc sao chép khi mở) và **Shortest link** tùy chọn nén trạng thái thành token gọn (xem [Chế độ URL](/info/url-mode.html)).

**Send to**, một thẻ trong bảng xuất, gửi tệp tới dịch vụ bạn đã kết nối. Sau khi gửi tới Google Drive, Nextcloud, một bucket S3, Dropbox hoặc OneDrive, **Create a share link** có thể tạo liên kết ở đó mà không cần tải lên lần nữa. Phần **Share through your cloud** của hộp thoại Share gửi tệp `.lolly` và tạo liên kết trong một bước. Bảng liên kết hiển thị ai có thể mở liên kết, tệp nằm ở đâu và khi nào liên kết hết hạn. **Links you've shared**, trong hộp thoại Share, cho phép bạn ngừng chia sẻ. Liên kết Nextcloud có thể có mật khẩu và ngày hết hạn. Liên kết S3 có hiệu lực từ 1 đến 7 ngày và không thể dừng sớm. Lolly không giữ bản sao của tệp hay token đăng nhập trên máy chủ. [Quyền riêng tư](/info/privacy.html#every-network-request-the-app-can-make) liệt kê những gì mỗi dịch vụ nhận được.

![Bảng xuất - định dạng, kích thước và các hành động Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Khi một thiết kế nhúng bản kết xuất của công cụ khác, chẳng hạn hộp ảnh Lolly Design chứa liên kết QR Code, bản xuất của thiết kế cha vẽ bản kết xuất lồng đó. Nó vẫn là vector trong SVG và PDF và được điểm ảnh hóa trong PNG, JPG và WebP. Bản kết xuất nhúng không có hình mờ hay nguồn gốc riêng; chỉ tệp hoàn chỉnh có. Bản xuất HTML, Markdown và TXT không chứa được bản kết xuất ghép.

<!--i:eti-file-->
## Chọn định dạng

Tên tệp và menu định dạng nằm cùng nhau thành một cặp `name.format`, bên dưới **Download**.

![Trường tên tệp gắn liền với bộ chọn định dạng, để bản xuất hiển thị như một cặp name.format](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Bắt đầu từ nơi tệp sẽ đến. Mỗi thẻ liệt kê các định dạng phù hợp với đích đó.

::: figure exporting-format-chooser
Sáu đích đến và các định dạng phù hợp với từng đích.
:::

Một wordmark dùng kiểu chữ của hệ thống thiết kế xuất thành SVG với mỗi chữ cái là một đường viền. Tệp giữ độ sắc nét ở mọi kích thước.

Văn bản bằng ngôn ngữ khác phụ thuộc vào các phông chữ bạn có. Khi một phông chữ trong hệ thống thiết kế có các chữ cái đó, SVG và PDF vẽ chúng thành đường viền, đã được định hình và theo thứ tự đọc, kể cả các dòng từ phải sang trái. Khi không phông nào có, Lolly dùng [phông dự phòng](/info/fallback-fonts.html) và thẻ xuất hiển thị phông đó. Văn bản mà không phông dự phòng nào phủ được vẫn là văn bản sống trong SVG, do các phông chữ của trình xem tự vẽ. Trong PDF, EPS hoặc WMF và trong EMF khi bật **Outline fonts**, văn bản đó trở thành ảnh. Những chữ đó trông như trên trang nhưng không chọn hay tìm kiếm được. Thẻ xuất liệt kê các hệ chữ đó. Thêm phông chữ có các chữ cái đó để giữ chúng thành văn bản vector.

![Một wordmark nét mảnh với khoảng cách chữ rộng ghi Aurora, loại tác phẩm vector thuần mà hàng SVG trong bảng đề cập](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Mọi định dạng và công dụng của chúng
| Bạn muốn | Dùng | Vì sao |
|---|---|---|
| Logo hoặc tác phẩm sắc nét co giãn được | **SVG** | Vector: co giãn được, nhỏ và chỉnh sửa được; hiệu ứng mà bản xuất vector không vẽ được sẽ được nhúng dưới dạng ảnh |
| Vector cho Office và ứng dụng Windows | **EMF** | Dán vào PowerPoint và Word như vector chỉnh sửa được, với văn bản sống; Google Drive mở nó trong Google Drawings |
| Vector cho in ấn và ứng dụng thiết kế | **EPS** hoặc **EPS (CMYK)** | Vector PostScript cho Illustrator và quy trình nhà in |
| Vector cho máy cắt | **DXF** | Máy cắt laser, máy cắt decal vinyl và CNC: đường viền tính bằng milimét |
| Bộ trang chiếu chỉnh sửa được | **PowerPoint** (PPTX) | Văn bản và hình khối gốc chỉnh sửa được, với ảnh và vector vẫn trích xuất được |
| Tài liệu văn bản chỉnh sửa được | **Word** (DOCX) hoặc **OpenDocument** (ODT) | Đoạn văn và đề mục mà trình soạn văn bản tiếp tục chỉnh sửa được (Lolly Doc Studio) |
| Bố cục cho InDesign | **InDesign IDML (static subset)** | Văn bản, hình chữ nhật, hình bầu dục và ảnh, mỗi artboard một spread (Lolly Design) |
| Tài liệu Penpot chỉnh sửa được | **Penpot** | Board, hình khối, văn bản và token liên kết |
| Ảnh chụp hoặc ảnh đa dụng | **PNG** (không mất dữ liệu) hoặc **JPG** (nhỏ hơn) | Ảnh điểm phổ quát |
| Ảnh hiện đại nhỏ hơn | **WebP** hoặc **AVIF** | Nén tốt hơn, có độ trong suốt |
| In ấn | **PDF** hoặc **Print PDF** (CMYK) | Đúng khổ trang; CMYK cho máy in |
| Ảnh điểm cho máy in | **Print TIFF** (CMYK) | Điểm ảnh DeviceCMYK cho RIP |
| Hoạt ảnh cho web | **GIF** | Phát ở mọi nơi; tệp lớn hơn |
| Hoạt ảnh với đủ màu và độ trong suốt thật | **APNG** | PNG động: không giới hạn bảng màu |
| Hoạt ảnh, tệp nhỏ nhất | **Animated WebP** | Đủ màu và độ trong suốt, nhỏ hơn GIF hoặc APNG |
| Hoạt ảnh vector co giãn được | **Animated SVG** | Tự chứa; lặp trong trình duyệt hoặc `<img>`, ở mọi kích thước (Lottie Ad) |
| Hoạt ảnh vẫn chỉnh sửa được | **dotLottie** | Hình khối, đường dẫn và khóa biến đổi ngoài từ dòng thời gian của Lolly Design |
| Bàn giao cho Premiere | **Premiere XML + media** | Clip có thời gian và media gốc cho Premiere (Lolly Design) |
| Video cho mạng xã hội và chia sẻ | **MP4** hoặc **WebM** | Chất lượng tốt nhất theo dung lượng tệp (xem [Video](#video)) |
| Phụ đề | **SRT** hoặc **VTT** | Văn bản có thời gian cho trình phát video (Captions, Audiogram và Record) |
| Phụ đề phát sóng | **TTML** hoặc **SCC** | Văn bản có thời gian IMSC1.1 hoặc phụ đề CEA-608 pop-on (Captions; xem [Phụ đề phát sóng](#broadcast-captions)) |
| Khóa đào tạo | **SCORM (LMS)** | Trang web có phiên bản, gói SCORM hoặc xAPI (xem [SCORM](#scorm-course-packages)) |
| Văn bản có định dạng hoặc chữ ký email | **HTML** | Dán kèm định dạng vào ứng dụng email |
| Hoạt ảnh phát trong trình duyệt | **HTML** | Trình phát trong một tệp, từ dòng thời gian của Lolly Design hoặc Snippet (xem [Video](#video)) |
| Nội dung thuần văn bản | **MD** hoặc **TXT** | Chỉ văn bản |
| Sự kiện lịch | **ICS** | Nhập vào bất kỳ ứng dụng lịch nào |
| Thẻ liên hệ | **VCF** | Nhập vào sổ địa chỉ |
| Dữ liệu có cấu trúc để nhập lại | **JSON** hoặc **CSV** | Xuất rồi nhập lại nội dung của công cụ |
| Favicon | **ICO** | Biểu tượng trang web nhiều kích thước; **ZIP** gói nhiều định dạng |
:::

### Độ trong suốt

Công cụ có hỗ trợ sẽ có công tắc nền trong suốt, chẳng hạn **No BG**. PNG, WebP, AVIF, SVG, APNG và Animated WebP giữ độ trong suốt, còn GIF giữ cạnh cứng. JPG và PDF luôn có nền đục. TIFF gộp lên nền trắng hoặc nền đen trên đường xuất [HDR](#hdr-bright-colours).

<!--i:eti-crop-->
## Kích thước và đơn vị in

Bản xuất dùng kích thước điểm ảnh gốc của công cụ trừ khi công cụ có **dimensions**. Khi đó, bạn đặt chiều rộng, chiều cao và **unit**:

- **px** (mặc định) là số điểm ảnh chính xác.
- **mm, cm, in, pt** và **pc** là kích thước vật lý. Với đơn vị vật lý, bạn cũng đặt **DPI** (mặc định là 300). **PDF** trở thành trang thật ở kích thước đó. **Ảnh điểm** có số điểm ảnh tương ứng với DPI đó và ghi lại độ phân giải. **SVG** giữ đơn vị vật lý với viewBox theo điểm ảnh.

Để có ảnh điểm độ phân giải cao hơn, nhập chiều rộng và chiều cao lớn hơn hoặc chọn đơn vị vật lý rồi tăng DPI (điểm ảnh = kích thước × DPI). Chiều rộng `210`, chiều cao `297` và đơn vị `mm` tạo thành trang A4.

![Hàng kích thước đặt thành 210 x 297 mm, với trường DPI hiện ra vì đơn vị là vật lý](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

<!--i:eti-images-->
## Ảnh tĩnh từ bố cục có thời gian

Từ bố cục có thời gian, chẳng hạn dòng thời gian [Sequence](/info/sequence-editor.html) trong Lolly Design, bản xuất tĩnh lấy **khung hình tại đầu phát**. Đặt đầu phát ở nơi bạn muốn lấy ảnh rồi xuất.

Để lấy nhiều thời điểm, dùng trường **Frames** bên cạnh kích thước đầu ra. Trường này chỉ hiện với bố cục có thời gian và định dạng tĩnh (PNG, JPG, WebP, SVG hoặc PDF). `1` cho khung hình tại đầu phát. Số lớn hơn cho số ảnh tĩnh tương ứng, phân bố đều trong chuỗi:

- PNG, JPG, WebP và SVG được trả về trong một ZIP: `<name>-01.png`, `-02.png` và cứ thế tiếp tục.
- PDF được trả về dưới dạng một tài liệu có số trang tương ứng.

Mỗi ảnh tĩnh lấy từ giữa phần dòng thời gian tương ứng, nên ảnh đầu không bao giờ là cảnh vào mới hiện được một nửa và ảnh cuối không bao giờ là khoảnh khắc trống sau khi các clip kết thúc.

::: figure exporting-contact-sheet
Frames: 4 chia chuỗi thành bốn phần bằng nhau và lấy giữa mỗi phần.
:::

Dùng Frames cho kịch bản phân cảnh, bảng ảnh để duyệt hoặc chuỗi ảnh mạng xã hội cắt từ bản dựng video. Số lượng được giới hạn ở 64. Giá trị khác nhập vào trường đều trở về `1`. Mỗi khung hình là ảnh tĩnh thông thường, nên thông tin xác thực, Imprint, đơn vị vật lý và DPI hoạt động như với một bản xuất. Liên kết xuất, CLI và MCP yêu cầu cùng bảng ảnh đó bằng `cuts=` (xem [Bảng ảnh](/info/url-export.html#contact-sheets)).

<!--i:eti-copy-->
## Nhiều tệp cùng lúc

Lolly có ba cách làm việc với số lượng lớn:

::: cols
## Một bảng trở thành một tài liệu
Công cụ được xây dựng để phân trang đầu vào dạng bảng biến mỗi hàng thành một trang. Dán bảng từ bảng tính để có một PDF. Để sửa các hàng, chỉnh sửa bảng tính rồi dán lại. Battlecards là công cụ tham chiếu. Nó nằm trong thư mục mã nguồn mở `community` và không được liệt kê trên lolly.tools.
## Một CSV trở thành một tệp cho mỗi hàng
**Batch** (`#/batch`) nhận CSV và kết xuất một bản xuất cho mỗi hàng, chẳng hạn thẻ tên hoặc chứng nhận, được giao trong một ZIP. Xem [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
## Nhiều thiết kế nhận cùng một chỉnh sửa
**Lolly Multi-edit** mở nhiều phiên đã lưu cạnh nhau để thực hiện cùng thay đổi trong mỗi phiên. Xem [Lolly Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Công cụ có nhiều trang, chẳng hạn Booklet, Print Sheet, Lolly Doc Studio hoặc Lolly Markdown Slides, xuất PNG, JPG, WebP, SVG và các định dạng ảnh đơn khác thành một tệp cho mỗi trang, trong một ZIP khi có nhiều trang. Print Sheet giữ nguyên cả tờ in và dấu cắt ở DPI đã chọn.

Từ **Projects**, **Render folder** xuất mọi phiên đã lưu trong một thư mục và các thư mục con thành một ZIP có cấu trúc lồng nhau. **Render selection** làm tương tự cho nhiều mục được chọn. Một phiên đã lưu được kết xuất thành tệp riêng. Projects cũng có thể chia sẻ lại phiên đã lưu dưới dạng liên kết công cụ để mở lại phiên với cùng cài đặt.

<!--i:eti-pen-->
## Tệp vẫn chỉnh sửa được ở nơi khác

Một số định dạng chuyển công việc của bạn sang ứng dụng khác dưới dạng nội dung chỉnh sửa được thay vì ảnh.

### PowerPoint (PPTX)

Lolly Design, Lolly Markdown Slides, Booklet, Lolly Doc Studio, Lolly Chart, Diagrams, Flow Chart và Agenda xuất bộ trang chiếu PowerPoint, một trang chiếu cho mỗi trang. Mỗi trang được tách thành các đối tượng gốc mà đồng nghiệp có thể chỉnh sửa và trích xuất:

- <!--i:font--> **Văn bản** trở thành các hộp văn bản PowerPoint chỉnh sửa được với cỡ chữ, màu sắc, độ đậm, chữ nghiêng và căn chỉnh của bố cục. Bộ trang chiếu Lolly Design đặt kiểu chữ của thương hiệu cho mọi đoạn chữ, ngay cả khi không có trang chiếu cái.
- <!--i:pentool--> **Vector** như logo và biểu tượng được nhúng dưới dạng ảnh SVG và PowerPoint có thể dùng *Convert to Shape* với chúng.
- <!--i:photos--> **Ảnh** được chuyển thành các ảnh riêng ở độ phân giải gốc. Ảnh chủ đạo đã cắt vẫn giữ ảnh đầy đủ phía sau vùng cắt. Mọi bộ lọc hoặc hiệu ứng hòa trộn trên ảnh đều được áp dụng cố định vào ảnh.
- <!--i:layers--> **Nền, đường viền và đường kẻ** trở thành hình chữ nhật và đường thẳng. Hình tròn, hình elip và hình viên thuốc từ Lolly Design vẫn là hình khối gốc chỉnh sửa được.

![Bảng xuất với PowerPoint được chọn: một trang chiếu cho mỗi trang, văn bản và hình khối vẫn chỉnh sửa được](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Bố cục là gần đúng. Bất cứ thứ gì bộ duyệt cấu trúc không thể biểu diễn bằng đối tượng gốc, chẳng hạn vùng có bộ lọc hoặc mặt nạ phức tạp, đều được nhúng dưới dạng ảnh. Bộ trang chiếu có một kích thước trang chiếu, lấy từ trang đầu tiên.

PowerPoint cũng là một đầu vào: [Đổi thương hiệu cho bộ trang chiếu](/info/rebrand.html) chuyển bộ trang chiếu sang hệ thống thiết kế của bạn và [Nhập thiết kế](/info/design-import.html) mở bộ trang chiếu trong Lolly Design.

### Penpot

Hầu hết công cụ xuất SVG cũng xuất **tệp Penpot** (`.penpot`).

| Những gì bạn tạo | Trong Penpot |
|---|---|
| Văn bản | Đối tượng văn bản chỉnh sửa được |
| Hình khối, đường dẫn, chuyển sắc và ảnh | Hình dạng vector chỉnh sửa được |
| Màu hoặc phông chữ từ token hệ thống thiết kế | Liên kết token sống: chỉnh sửa token và mọi hình khối kế thừa nó đều thay đổi theo |
| Toàn bộ thiết kế | Thành phần tái sử dụng trong bảng Assets |
| Hình minh họa phức tạp hoặc canvas trực tiếp | Ảnh nhúng; nội dung xung quanh vẫn chỉnh sửa được |

Từ Lolly Design, mỗi khung trở thành một board Penpot. Màu sắc và kiểu chữ của hệ thống thiết kế vào bảng Assets, còn toàn bộ bộ token vào bảng Tokens. Penpot giữ bản sao riêng. Token chỉnh sửa trong Penpot được đưa trở lại qua chức năng nhập trong [Lolly Design System Setup](/info/brand-studio.html).

![Bảng xuất với Penpot được chọn: tệp .penpot và Send to Penpot bên cạnh nút tải xuống](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Để mở tệp, khởi động Penpot, chọn dự án rồi chọn **Import**. Nếu bạn đăng nhập vào Penpot từ bảng xuất, **Send to Penpot** nhập tệp cho bạn.

### Word, OpenDocument và InDesign

**Lolly Doc Studio** xuất **Word** (DOCX) và **OpenDocument** (ODT) với đoạn văn và đề mục chỉnh sửa được. Tệp Word đặt phông chữ và màu văn bản của thương hiệu qua các kiểu của tài liệu, theo kích thước trang bạn chọn và thêm PNG bên cạnh logo SVG cho ứng dụng không vẽ được SVG.

**Lolly Design** xuất **InDesign IDML (static subset)**: văn bản, hình chữ nhật, hình bầu dục và ảnh PNG hoặc JPEG, mỗi artboard một spread. Định dạng nội tuyến được hỗ trợ vẫn chỉnh sửa được, ảnh đi cùng trong `Links` và tọa độ chuyển thành point của InDesign. Việc liên kết lại, thay thế phông chữ và thay đổi ngắt dòng có thể cần chú ý. Hiệu ứng, hoạt ảnh, luồng văn bản đã dàn và hình học không được hỗ trợ sẽ dừng việc xuất kèm báo cáo liệt kê chúng. IDML không giữ nguyên tài liệu gốc. Gửi PDF cho tác phẩm hoàn chỉnh.

### Dòng thời gian: dotLottie và Premiere

Từ dòng thời gian của Lolly Design, **dotLottie** ghi hoạt ảnh vẫn chỉnh sửa được trong các công cụ Lottie; [Hoạt ảnh Lottie](/info/sequence-editor.html#lottie-animations) liệt kê những gì được giữ lại. **Premiere XML + media** đóng gói các clip có thời gian và media gốc của chúng cho Premiere; xem [Trao đổi qua Premiere XML](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (gói khóa học)

Chức năng xuất khóa học tắt cho đến khi bạn bật **Training and courses** trong Settings → Preferences → Feature flags.

Sau đó chọn **Export course** từ công cụ được hỗ trợ, thư mục dự án hoặc vùng chọn. Trong Lolly Design, chọn **SCORM (LMS)** và **Download** mở cùng quy trình khóa học. Lolly lưu công việc, hiển thị nội dung và thứ tự khóa học để duyệt, rồi mở mô-đun và hộp thoại xuất của nó.

- <!--i:layers--> Chọn một dạng thể hiện cho mỗi nguồn: trang tĩnh, chuyển động dưới dạng video, âm thanh hoặc tài nguyên tải xuống được. Thêm văn bản bài học và các bản thay thế để đọc trong mô-đun.
- <!--i:clock--> Xem trước trình phát dành cho người học và duyệt mô tả, phụ đề. Chuyển động, kể cả hoạt ảnh không tiếng, được đưa vào dưới dạng video.
- <!--i:document--> Chọn Website, SCORM 1.2, SCORM 2004 4th Edition hoặc đích xAPI thử nghiệm. Kiểm tra nội dung và dung lượng ZIP, rồi lưu và tải xuống phiên bản đã kiểm tra.
- <!--i:check--> Để hoàn thành, cần xác nhận mọi bài học bắt buộc và chọn Finish.

![Bảng xuất trên bộ trang chiếu Lolly Design với SCORM (LMS) được chọn](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Gói chứa nội dung hoàn chỉnh và không cần tài khoản Lolly. Đặt ZIP Website lên máy chủ HTTP(S); nhập nguyên trạng ZIP LMS. Kiểm thử đích đến trước khi chia sẻ khóa học. Với khóa học được tạo từ nhiều tác phẩm đã lưu, xem [Tạo khóa đào tạo](/info/training-creators.html).

### Phụ đề phát sóng

Công cụ Captions cũng có thể xuất **TTML** và **SCC**. Cả hai được ghi từ cùng danh sách mốc phụ đề như các tệp SRT và VTT, nên lời và thời gian khớp nhau.

- **TTML** dùng IMSC1.1 Text Profile, với mốc thời gian theo đồng hồ media và một vùng ở giữa phía dưới. Nó không chứa màu sắc, phông chữ hay vị trí riêng cho từng phụ đề vì phụ đề của Lolly chỉ có thời điểm bắt đầu, kết thúc và văn bản.
- **SCC** chứa phụ đề CEA-608 pop-on trên kênh 1 ở 29.97 khung hình mỗi giây với mã thời gian drop-frame. Nó hỗ trợ các ký tự Bắc Mỹ cơ bản cùng các ký tự đặc biệt và mở rộng. Nếu phụ đề có ký tự ngoài bộ này, việc xuất dừng lại và cho biết ký tự đó. Mỗi phụ đề ngắt dòng ở 32 cột và tối đa 15 hàng. Phụ đề không thể tải xong trước thời điểm bắt đầu sẽ bị trễ vài khung hình.
- Phụ đề roll-up và paint-on không được ghi.

::: note SCC chưa được kiểm tra trong công cụ phát sóng
Nó cũng chưa được thử trên bộ giải mã phần cứng. Hãy kiểm thử tệp trong quy trình của bạn trước khi bàn giao.
:::

### DXF (tệp cắt)

Lolly Asset Export, Diagrams, Growth, Lolly Logo Wall, QR Code, Street Map, Wayfinding và Wordmark xuất **DXF**, định dạng trao đổi AutoCAD R12 mà máy cắt laser, máy cắt decal vinyl và phần mềm CNC đọc được. Hình học được ghi thành các đường viền tính bằng milimét và văn bản được chuyển thành đường viền. Màu được ánh xạ tới AutoCAD Color Index gần nhất, thường dùng để điều khiển thao tác của máy cắt. DXF chỉ có hình nét: vùng ảnh chụp hoặc vùng có bộ lọc không có đường cắt và bị bỏ qua kèm cảnh báo. Dùng SVG hoặc PDF để giữ nội dung ảnh điểm. Văn bản không được phông nào phủ, kể cả [phông dự phòng](/info/fallback-fonts.html), sẽ dừng việc xuất kèm thông báo trích văn bản đó.

Thiết kế Street Map hoàn toàn là các nét, nên mọi con đường và kênh đều trở thành đường cắt.

::: showcase
![Bản kết xuất Paris bằng Street Map với nét mực trên nền kem - hình nét thuần túy, nên mọi nét đều được giữ khi chuyển tới máy cắt](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Cuộn và camera lùi ra qua các hình: bảy đường dẫn và không có điểm ảnh. Máy cắt đọc cùng tệp đó.
:::

<!--i:eti-stamp-->
## In

**Print PDF** ghi CMYK theo một điều kiện in được đặt tên, mặc định là **Coated FOGRA39**. Các mẫu màu thương hiệu có giá trị mực đã đo sẽ giữ nguyên các giá trị đó. Các màu khác được chuyển đổi qua hồ sơ in: mặc định là hồ sơ Coated FOGRA39 riêng của Lolly, hoặc hồ sơ của bạn khi chọn hàng **Embed** của nó. Màu xám và đen chỉ nằm trên bản in đen, nên chữ nhỏ không thể bị lệch chồng màu. FOGRA51, SWOP và GRACoL dùng phép chuyển đổi thiết bị tiêu chuẩn. Chữ đen cũng in đè lên màu bên dưới, nên máy in hơi lệch không để lại viền trắng quanh chữ. **Print TIFF** ghi điểm ảnh DeviceCMYK cho RIP. Điều khiển Colour profile chi phối cả hai ([Hồ sơ màu](#colour-profiles)). Print TIFF và **EPS (CMYK)** tách màu qua cùng hồ sơ in như Print PDF.

**Print marks & bleed** có thẻ riêng cho các định dạng in: phần tràn lề tính bằng milimét cùng Crop, Registration, Bleed, Colour bars và Stamp details. Stamp details in ngày, công cụ và tên bạn trong lề. Tên người hoặc tên công cụ có chữ mà phông chữ ở lề không có, chẳng hạn chữ Ả Rập, Trung Quốc, Cyrillic hoặc emoji, được vẽ thành ảnh với cùng màu xám. Thẻ xuất liệt kê các hệ chữ đó.

Một số công cụ, chẳng hạn *Booklet*, tạo **PDF nhiều trang**: bìa trước, nội dung trải ra số trang cần thiết và trang cuối. Mỗi trang là trang PDF dọc thật ở khổ A4, US Letter hoặc A5. Bạn có thể buộc bất kỳ khối nào sang trang mới. Đây là tài liệu RGB không có dấu cắt hay dấu tràn lề; các dấu đó thuộc về Print PDF một trang. PDF của Lolly Design cũng có thể là **Notes handout**: một trang dọc cho mỗi trang chiếu với ghi chú của người thuyết trình bên dưới.

**Trước khi xuất.** Thẻ **Before you export** ở cuối bảng hiển thị những gì nhà in sẽ thấy: định dạng, kích thước và phần tràn lề, vùng thành phẩm và vùng tràn lề, độ phủ mực, số bản in và số trang, với kết luận bên cạnh đề mục. Thẻ không bao giờ chặn việc xuất. Lolly Design luôn hiển thị thẻ với các kiểm tra riêng, gồm quy tắc nội bộ của hệ thống thiết kế theo từng lớp và tín hiệu về cách viết cho văn bản của tài liệu ([Trước khi xuất](/info/design.html#before-you-export)). Lolly Design thêm các kiểm tra in này khi **Print preflight** bật. Trong các công cụ khác, bật **Print preflight** trong Settings → Preferences → Feature flags. Nó mặc định tắt và một bản triển khai Lolly Work có thể bật cho các thành viên.

**Sau khi xuất.** Lolly đọc lại tệp hoàn chỉnh và so sánh với những gì bạn đã chọn: định dạng, kích thước điểm ảnh hoặc trang, độ dài clip, nền trong suốt, màu CMYK, HDR, Content Credentials và mật khẩu PDF hoặc ZIP. Mọi khác biệt đều được ghi trên thẻ xuất. Mỗi số đo đều lấy từ tệp, không bao giờ lấy từ cài đặt. Thuộc tính mà tệp không thể trả lời không được tính là khớp. Dòng lệnh ghi toàn bộ so sánh bằng `--export-report` (xem [Kết xuất bằng CLI](/info/cli-rendering.html)).

::: details Kiểm tra khả năng tiếp cận PDF từ dòng lệnh
**Kiểm tra khả năng tiếp cận PDF.** Với PDF, dòng lệnh cũng liệt kê 32 kiểm tra khả năng tiếp cận trong tệp `--export-report`, dưới `pdfAccessibility`. Mỗi kiểm tra có một id, mô tả dễ hiểu, kết quả và vị trí trong tệp nơi phát hiện vấn đề:

- **Passed**: kiểm tra đã xem xét một nội dung và không thấy lỗi.
- **Failed**: kiểm tra tìm thấy vấn đề. Số trang hoặc thẻ liên quan được liệt kê.
- **Not applicable**: tệp không có nội dung thuộc loại đó để xem xét, chẳng hạn kiểm tra bảng trong tệp không có bảng. Điều này không nói lên gì về tệp.
- **Needs a person**: sáu kiểm tra không thể được đánh giá bằng chương trình (thứ tự đọc, độ tương phản màu, nhấp nháy, tập lệnh, giới hạn thời gian và liên kết lặp lại).

Danh sách không phải là kết luận. Nó không khẳng định PDF đáp ứng PDF/UA hay người dùng công nghệ hỗ trợ có thể sử dụng PDF. Vẫn cần một người kiểm tra tệp bằng trình đọc màn hình. PDF do chính Lolly tạo hiện không đạt các kiểm tra gắn thẻ vì các bộ xuất chưa ghi thẻ. Việc kiểm tra đọc tệp trên thiết bị của bạn và không thay đổi gì. Tệp cần mật khẩu được ghi là chưa kiểm tra, không phải đã đạt. Để kiểm tra PDF được gửi cho bạn, thả vào [Lolly Strip Hidden Data](/info/utilities.html), nơi hiển thị cùng danh sách dưới **PDF accessibility checks**.
:::

Các kiểm tra trong Inspector của Lolly Design và phép so sánh thương hiệu trong Lolly Design System Setup xem xét thiết kế. Hai thẻ này xem xét tệp.

::: details Chi phí từ bảng đơn giá
Bên dưới phần kiểm tra trước khi in, thẻ chi phí chuyển cùng các số lượng đó thành tiền, ngay cả khi thẻ kiểm tra trước khi in tắt. Nó cần hai thứ: công việc mà bảng giá có thể định giá (bản in, tờ, diện tích, trang, hàng biến thể hoặc tệp đầu ra, nên PNG logo đơn giản không bao giờ hiện thẻ) và **bảng đơn giá**, một bảng giá JSON từ nhà in của bạn. Bản dựng mặc định không có bảng đơn giá và không có cách tải bảng vào trong ứng dụng. Bảng đơn giá đến dưới dạng tài nguyên danh mục đi kèm bản triển khai, hoặc qua phần mở rộng bảng đơn giá tùy chọn mà người tự lưu trữ hoặc mặt phẳng điều khiển bật. Không có bảng đơn giá thì không hiển thị gì.

Mỗi con số là đơn giá bạn cung cấp nhân với số lượng Lolly đếm được, chẳng hạn `4 plate × €35.00`. Tổng tiền hiển thị nguồn: đơn vị phát hành trên bảng và ngày áp dụng đơn giá. Không có tiền tệ mặc định hay giá giữ chỗ. Những gì tệp nói về chính nó vẫn được trình bày dưới dạng lời dẫn lại: *"Tệp cho biết: … Lolly chưa xác minh điều này."*

Khi không thể tính được một con số, bảng bị ẩn thay vì được điền vào:

- Các dòng mà bảng không định giá khiến **hoàn toàn không có tổng tiền**, chỉ có đề mục cho biết bao nhiêu dòng chưa được định giá.
- Số lượng là mức trần sẽ có **"tối đa"** trong thành tiền của nó.
- Đơn giá quá ngày hết hiệu lực chỉ hiển thị **số lượng** cho đến khi bạn nhấn *Use these rates anyway*; ngày hết hạn sau đó vẫn đi cùng con số.
- Khi mở qua **liên kết**, số tiền vẫn ẩn cho đến khi bạn yêu cầu hiển thị trên thiết bị này. CLI nhận `--rate-card=<file.json>` dưới dạng tệp cục bộ và không bao giờ dưới dạng tham số liên kết.

Bảng đơn giá được loại khỏi mọi giai đoạn xuất và không bao giờ thay đổi tệp. Đây là phép tính, không phải báo giá. Chỉ nhà in của bạn mới có thể báo giá.
:::

<!--i:eti-film-->
## Chuyển động và âm thanh

### Video

Các công cụ hoạt ảnh xuất **MP4** và **WebM**. Liên kết `?format=` được chia sẻ yêu cầu định dạng chứa mà trình duyệt này không tạo được sẽ chuyển sang định dạng còn lại, với tên tệp tương ứng. **Start after** giữ canvas đứng yên để hoạt ảnh và phông chữ ổn định trước khi ghi. **Duration** đặt độ dài clip hoàn chỉnh. **Motion blur** (Off, Draft quality, Standard hoặc High, với **Shutter angle**) làm mờ chuyển động nhanh và khiến việc kết xuất chậm hơn. Nơi trình duyệt hỗ trợ, **Record live** ghi bản xem trước trên màn hình theo thời gian thực qua chia sẻ màn hình.

![Các cài đặt thời gian cho bản xuất hoạt ảnh: Start after, Duration, Motion blur với Shutter angle và Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** chọn Smaller file, Balanced hoặc Best quality. **Advanced** mở **Codec**, **Frame rate**, **Rate mode** và **Hardware acceleration**. Khi công cụ có phụ đề, **Captions** chọn **Embedded track** hoặc **Sidecar .vtt + .srt** bên cạnh video. Liên kết chứa chất lượng, codec, tốc độ khung hình, thời lượng và độ trễ bắt đầu dưới dạng `vq`, `codec`, `fps`, `seconds` và `wait` ([Tham số URL](/info/url-parameters.html)).

Bản xuất video giữ âm thanh. Công cụ có thể đặt **nhạc nền** dưới clip: tài nguyên âm thanh được lặp hoặc cắt theo độ dài clip, với hiệu ứng tăng giảm âm dần, âm lượng và giảm âm dưới tiếng riêng của cảnh quay. Các công cụ ghi đưa âm thanh trực tiếp của chúng vào tệp.

Bộ trang chiếu chuyển bằng nhấp chuột trong Lolly Design cũng có thể xuất thành video. **Export slides as video** trong menu Present mở bảng xuất ở MP4. Mỗi trang chiếu phát trong thời gian dừng riêng, hoặc theo Duration của bảng xuất khi không có thời gian riêng. Hiệu ứng chuyển trang của bộ trang chiếu phát giữa các trang dưới dạng hòa tan. Tài liệu không thay đổi.

**HTML** từ tài liệu Lolly Design có thời gian hoặc từ Snippet là trình phát trong một tệp: các điều khiển phát, tua và âm thanh trên hoạt ảnh, với phông chữ được hỗ trợ, ảnh và âm thanh được nhúng. Tệp phát ngoại tuyến. Phim Lolly Design có các cảnh sẽ thêm menu cảnh. Chuỗi chứa clip video, Lottie hoặc 3D chưa thể xuất thành HTML; hãy xuất chuỗi thành video.

### Ảnh động

**GIF** phát ở mọi nơi và phù hợp với trò chuyện, email; nó lớn hơn và có ít màu hơn video. **APNG** và **Animated WebP** giữ đủ màu và độ trong suốt. **Lottie Ad** cũng xuất **Animated SVG**: khung hình vector với keyframe CSS nhúng, co giãn tới mọi kích thước và lặp trong thẻ trình duyệt hoặc `<img>` mà không cần codec. Văn bản được chuyển thành đường viền. Nó dùng tốc độ khung hình mặc định thấp hơn vì mỗi khung hình nặng hơn ảnh điểm. Tất cả các định dạng này đều không có tiếng.

### Âm thanh

Một số công cụ xuất riêng âm thanh. **Lolly Voice Recorder** ghi một lượt từ micrô với đồng hồ mức âm trực tiếp và lưu thành **MP3**, **WAV**, **M4A (AAC)** hoặc **Opus (WebM)**, được mã hóa trên thiết bị của bạn. `wav`, `mp3`, `m4a` và `opus` là các id định dạng thông thường, nên bản xuất âm thanh có thể chia sẻ và xử lý bằng tập lệnh như PNG.

Bộ chọn tài nguyên chấp nhận nhiều định dạng âm thanh làm nhạc nền, từ MP3 và FLAC đến MIDI và các mô-đun tracker; [Định dạng](/info/formats.html) liệt kê chúng. Một [bài hát Lolly Rondocode](/info/rondocode.html) phát theo độ dài mà clip yêu cầu.

<!--i:eti-palette-->
## Màu sắc và HDR

Lolly đọc mọi màu CSS hiện đại, tính toán màu theo cảm nhận và ghi từng tệp trong một không gian màu mà trình đọc có thể mở: sRGB cho màn hình, CMYK cho in ấn và Rec.2100 PQ cho HDR ([Màu sắc trong bộ máy](/info/colour-engine.html)). Tài liệu Lolly Design đặt thành **Wide colour / HDR** tuân theo quy tắc riêng: xem [Chỉnh sửa màu dải rộng và HDR](/info/hdr-editing.html).

### Hồ sơ màu

Bản xuất được gắn hồ sơ màu, nên các ứng dụng có quản lý màu như phần mềm nhà in, Photoshop và trình duyệt đọc màu đúng như bạn thấy. Ảnh thu nhỏ và bản xem trước bỏ qua thẻ này để giữ dung lượng nhỏ.

- **PNG và JPG** chứa hồ sơ ICC **sRGB** nhúng, không gian màu dùng để vẽ bản xem trước. Các điểm ảnh được gắn thẻ, không mã hóa lại.
- **Print PDF (CMYK)** khai báo điều kiện in trong *OutputIntent*, cho nhà in biết cách diễn giải các màu mực CMYK của nó.
- **Print TIFF (CMYK)** ghi điểm ảnh DeviceCMYK không gắn thẻ và ghi điều kiện in trong siêu dữ liệu TIFF. TIFF không thể nhúng hồ sơ in, nên hàng **Embed** chỉ ghi tên hồ sơ đó.
- **TIFF (RGB)** là phiên bản sRGB không nén để lưu trữ hoặc đưa qua trình chỉnh sửa rồi trở lại. Cả hai loại TIFF chỉ dùng trên máy tính vì trình duyệt không thể xem trước TIFF.
- **SVG**, **EMF**, **EPS** và **DXF** là vector không có hồ sơ nhúng: màu của SVG là sRGB, EMF và EPS dùng RGB thiết bị, **EPS (CMYK)** ghi DeviceCMYK và DXF dùng AutoCAD Color Index. SVG, EPS và DXF chuyển văn bản thành đường viền. EMF giữ văn bản sống và chỉnh sửa được trong Office và Google Slides, chỉ chuyển thành đường viền những đoạn mà định dạng không thể biểu diễn. Tùy chọn **Outline fonts** trong bảng xuất buộc dùng đường dẫn ở mọi nơi, như `_text=outline` trong liên kết và `--text=outline` trên dòng lệnh. SVG cũng tái tạo đổ bóng hộp CSS, cả bên trong lẫn bên ngoài.

::: details PDF/X-4 và hồ sơ in riêng của bạn
Lolly đi kèm một hồ sơ CMYK, được khớp với dữ liệu đặc trưng FOGRA39 của Fogra và phát hành theo CC0, rồi chuyển màu qua hồ sơ đó cho điều kiện in mặc định. Hồ sơ không được nhúng vì nó là ICC phiên bản 4.3, còn PDF/X-4 chấp nhận phiên bản tối đa 4.2. Vì vậy, điều kiện in được đặt tên sẽ ghi ý định đầu ra mà không tuyên bố tuân thủ PDF/X-4.

Tải hồ sơ CMYK riêng và chọn hàng **Embed** của nó trong điều khiển Colour profile. Hồ sơ được nhúng làm *DestOutputProfile* của tệp và PDF tuyên bố tuân thủ PDF/X-4 khi phần còn lại của tệp cho phép. Điều kiện in được khai báo được đọc từ hồ sơ đó: tên đã đăng ký khi hồ sơ chứng minh được, hoặc `Custom` dưới tên riêng của hồ sơ.

Ba yếu tố khiến tệp không tuyên bố tuân thủ nhưng vẫn giữ ý định đầu ra: tác phẩm RGB mà bước CMYK không chuyển đổi được, văn bản ghi công `prov` ở lề bản in thử (được vẽ bằng phông chữ tiêu chuẩn không được nhúng) và mật khẩu **Strong**, vì PDF/X-4 cấm mã hóa. Mọi PDF cũng chứa siêu dữ liệu PDF/X-4: các hộp trang, XMP, ID tài liệu và ý định đầu ra sRGB cùng hồ sơ của nó.
:::

### In mực màu pha bằng màu cơ bản

Một hệ thống thiết kế có thể gán mực màu pha cho một màu, chẳng hạn như màu Pantone hoặc HLC. Khi đó **Print PDF** in màu ấy trên một bản in riêng. Lolly Demo gán mực màu pha cho mọi màu trừ các màu trắng Sugar và Daylight, cùng màu đen Void. Một Print PDF tạo trong Lolly Demo in hầu hết các màu trên bản màu pha và màu đen trên bản đen.

Để có tệp bốn màu thông thường, đánh dấu **Print spot inks as process** trong thẻ Profile của bảng xuất. Khi đó mỗi mực màu pha được in bằng xanh lơ, đỏ tươi, vàng và đen, theo công thức CMYK mà hệ thống thiết kế gán cho màu ấy. Màu không có công thức riêng dùng phép chuyển đổi của cấu hình máy in, như mọi màu khác trong tác phẩm. Tệp khi đó chỉ có bốn bản màu cơ bản. Lựa chọn này mặc định tắt. Bảng chỉ hiện ô này cho **Print PDF**, và chỉ khi hệ thống thiết kế gán mực màu pha cho một màu.

Gia công không phải là mực. Ép nhũ, dập nổi, dập chìm, phủ bóng cục bộ, phủ nhung, bế, cấn và đục lỗ vẫn giữ các bản có tên riêng khi đánh dấu ô này, vì in một lớp gia công bằng màu cơ bản sẽ đưa mặt nạ đen của nó lên trang.

Thẻ **Before you export** và `lolly preflight` đếm các bản in mà tệp sẽ có. Khi đánh dấu ô này, chúng đếm bốn bản màu cơ bản và mọi bản gia công, đồng thời cho biết mực màu pha được in bằng màu cơ bản và không thêm bản in. Khi bỏ đánh dấu, chúng đếm tối đa một bản màu pha cho mỗi mực màu pha mà hệ thống thiết kế cung cấp. Bảng giá tính theo các số lượng đó, nên không bao giờ tính giá một bản màu pha mà tệp sẽ không có.

**Print TIFF** và **EPS (CMYK)** không có bản in có tên, nên chúng in mọi loại mực bằng màu cơ bản dù có bật lựa chọn này hay không. Với hai định dạng đó, thẻ và `lolly preflight` đếm bốn bản màu cơ bản và không bao giờ đếm bản màu pha hay bản gia công. Lớp gia công đi vào chúng dưới dạng mặt nạ đen trên bản đen, và thẻ báo đó là lỗi.

Liên kết yêu cầu cùng tệp đó bằng `_spots=process`, dòng lệnh bằng `--spots=process`, [máy chủ MCP](/info/mcp.html) bằng `spots: "process"` và ứng dụng terminal bằng hàng **Spot inks**. Không thông tin nào về lựa chọn này được ghi vào tệp: chỉ các loại mực thay đổi.

### HDR (màu sáng)

Thẻ **HDR** của bảng xuất tăng độ sáng của tác phẩm thông thường cho màn hình HDR. Để giữ bản gốc HDR trong quá trình chỉnh sửa, xem [Chỉnh sửa màu dải rộng và HDR](/info/hdr-editing.html).

Bản xuất thông thường là sRGB: một màu thương hiệu bão hòa có độ sáng bằng màu trắng thông thường của màn hình. Màn hình HDR có thể sáng hơn. Thẻ **HDR** tăng độ sáng của màu thương hiệu và chữ trắng lên gần độ sáng tối đa. Vùng tối vẫn tối.

![Thẻ HDR trong bảng xuất, đang bật, với các núm White / Reach / Dark lift / Focus hiện bên dưới](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Định dạng.** PNG, JPG, AVIF và TIFF. WebP là 8-bit, không có đường giải mã HDR hoạt động, còn vector và PDF không có mô hình HDR.
- **Mặc định tắt**, vì nó thay đổi các điểm ảnh. Đánh dấu thẻ, hoặc truyền `hdr=1` trong liên kết chia sẻ.
- **Các núm.** **White** (trần độ sáng tối đa, từ 400 đến 2000 nit), **Reach** (ánh sáng lan xuống các tông tối đến đâu), **Dark lift** (vùng tối sáng lên bao nhiêu; `0` giữ chúng tối) và **Focus** (mức độ giữ độ đậm màu khi tăng sáng). Chúng đi cùng nhau dưới một giá trị: `hdr=1600-60-0-50` là White 1600, Reach 60, Dark lift 0 và Focus 50.
- **Những gì được ghi.** PNG nhận Rec.2100 PQ 16-bit với một khối `cICP`. JPG là JPEG bản đồ tăng sáng ISO 21496-1: ảnh SDR thông thường cộng với bản đồ tăng sáng nối thêm. AVIF nhận một hộp `colr` được viết lại. TIFF nhận các điểm ảnh PQ với cấu hình ICC v4 được tạo có thẻ `cicp`. TIFF gộp lên nền đen, vì màu trắng là mã 10.000 nit trong PQ và sẽ tạo quầng quanh mọi cạnh. Việc tăng sáng theo độ sáng cảm nhận (OKLab) và giữ sắc độ, nên màu xanh lá của thương hiệu sáng hơn mà không ngả xanh bạc hà.
- **Nơi thấy được độ sáng tăng thêm.** Trình xem có quản lý màu trên màn hình HDR: Preview, Quick Look và Safari trên thiết bị Apple, hoặc Chrome trên màn hình HDR. Màn hình SDR hiển thị ảnh bình thường.
- **Từ terminal.** `--hdr=1` với `--export=png` hoặc `--export=jpg` ghi cùng PNG và JPEG bản đồ tăng sáng trên [CLI](/info/cli.html) từ cùng các bộ mã hóa của bộ máy, không cần trình duyệt. Hiện AVIF và TIFF chỉ xuất được trên web.

::: warning Nhiều nền tảng loại bỏ tín hiệu HDR
Nền tảng mã hóa lại tệp tải lên có thể khiến ảnh tối hoặc bạc màu. Dùng HDR ở nơi bạn kiểm soát đích đến, như trang web của bạn, tường màn hình hoặc bộ trang trên màn hình có độ sáng cao.
:::

<!--i:eti-badge-check-->
## Những gì đi cùng tệp của bạn

Một tệp hoàn chỉnh có thể có nhiều bản ghi. Một số nằm bên cạnh các điểm ảnh và biến mất khi tệp được lưu lại, chụp màn hình hoặc loại bỏ siêu dữ liệu. Hai dấu nằm trong các điểm ảnh.

::: figure exporting-what-travels
Mỗi bản ghi nằm ở đâu, có bật mặc định hay không và tham số liên kết nào điều khiển từng bản ghi.
:::

Bảng xuất đặt **Licence**, **Source credits**, **Password**, **C2PA Credentials**, **Lolly Imprint** và **Durable credential** trong một nhóm **Content protection** chỉ hiện các thẻ mà định dạng đã chọn dùng được. Nhóm tự mở khi một liên kết hoặc tài liệu đã khai báo giấy phép, hoặc khi một nguồn cần bạn quyết định. Thẻ **Design system** nằm ngoài nhóm, hiện trên mọi bản xuất.

![Nhóm Content protection mở trên bản xuất PNG, chỉ hiện các thẻ áp dụng cho nó](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Nguồn gốc & hình mờ

Khi định dạng có các trường tương ứng, bản xuất mang **siêu dữ liệu nguồn gốc**: phần mềm, nguồn, tên công cụ và dòng ghi công trong hồ sơ của bạn, được ghi vào PNG iTXt, JPEG EXIF, PDF info, SVG `<metadata>` hoặc chú thích GIF. Nó chỉ ghi nhận tác giả. Không có gì được tải lên. Công cụ **Experimental** còn đóng hình mờ nhìn thấy được. Ứng dụng chủ áp dụng hình mờ, nên chỉnh sửa công cụ không thể xóa dấu đó.

**Lolly Imprint** là hình mờ điểm ảnh vô hình, **bật mặc định**. Nó tồn tại qua nén lại, nên vẫn có thể nhận ra một bản sao được tạo bằng Lolly. Nó là dấu hiệu, không phải bảo đảm bằng mật mã, và không chứa dữ liệu cá nhân. Nó được ghi vào JPEG XL, PNG, JPG, WebP, AVIF, TIFF và BMP, cùng các ảnh điểm mà Lolly kết xuất vào PDF hoặc PPTX, không bao giờ vào ảnh bạn đã nhúng. Bỏ đánh dấu **Lolly Imprint** hoặc truyền `imprint=0` để không đưa Imprint vào. Khả năng tồn tại qua mã hóa lại của AVIF chưa được hiệu chuẩn. [Lolly Verify](/#/verify) phát hiện Imprint trên thiết bị của bạn; xem [Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**Durable credential** ghi id của Lolly vào các điểm ảnh bằng mô hình nơ-ron trên thiết bị theo định dạng TrustMark, để mối liên hệ "tạo bằng Lolly" vẫn tồn tại sau khi loại bỏ siêu dữ liệu và mã hóa lại, và các công cụ hỗ trợ TrustMark có thể đọc được. Nó **mặc định tắt**, vì mỗi lần xuất cần một lượt xử lý nơ-ron và phải tải mô hình một lần. Nó hỗ trợ PNG, JPG, WebP, AVIF và TIFF. Đánh dấu nó trong bảng hoặc truyền `durable=1`. Ứng dụng máy tính và di động ẩn thẻ này, vì chúng không có origin để lấy mô hình khi ngoại tuyến.

**Licence.** Chọn cách người khác được phép sử dụng tác phẩm của bạn: mặc định là *None (all rights reserved)*, CC0 1.0, Public Domain Mark 1.0 hoặc giấy phép Creative Commons 4.0 (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). Tên giấy phép và liên kết đến bản tóm tắt điều khoản của nó được đưa vào siêu dữ liệu giấy phép của tệp (EXIF, XMP và RIFF khi định dạng có các trường đó) và Content Credential của tệp. Lựa chọn được lưu cùng tài liệu và đi trong liên kết dưới dạng `licence=`. Lolly ghi giấy phép bạn đã chọn. Lolly không kiểm tra hay thực thi các điều khoản. Công cụ có trường giấy phép riêng, như Claim, giữ trường đó thay thế.

### Bản ghi hệ thống thiết kế

Bản xuất ghi lại hệ thống thiết kế đã tạo tệp: tên của nó, phiên bản đã xuất bản được dùng để vẽ (khi đó không phải phiên bản đang làm việc) và [colourway](/info/colourways.html) được dùng để vẽ. Mọi lựa chọn chủ đề khác mà hệ thống thiết kế khai báo, như mật độ, đều được ghi theo cùng cách. Lựa chọn sáng hoặc tối được bỏ qua, vì hình ảnh đã cho thấy lựa chọn nào được dùng.

**Bạn thấy bản ghi trước khi bất cứ thứ gì được ghi vào tệp.** Thẻ **Design system**, được đánh dấu mặc định, hiện chính xác những từ mà tệp sẽ mang, như *Bản ghi: Acme · Colourway: Beach*, và phần mô tả. Tên hệ thống thiết kế là bất cứ tên nào chủ sở hữu đã nhập, và thẻ hiện nguyên tên đó. Bỏ đánh dấu thẻ để không đưa bản ghi vào bản xuất đó. Bảng tài liệu của Lolly Design liệt kê cùng những từ ấy dưới *Embedded in exports*.

**Mô tả ghi colourway cạnh công cụ.** Khi đánh dấu thẻ, *"Tạo bằng https://lolly.tools : Chart"* trở thành *"Tạo bằng https://lolly.tools : Chart (colourway Beach)"*. Tên riêng của hệ thống thiết kế nằm trong bản ghi, không nằm trong mô tả. Mô tả không có tên công cụ, hoặc mô tả do công cụ viết từ đầu vào của nó, giữ nguyên. Công cụ bỏ qua colourway qua `tokenAxes` không ghi colourway nào, và dòng ghi công trên bản in thử PDF (dấu in `prov`) theo cùng quy tắc.

::: details Kỹ năng thương hiệu, trang thương hiệu và công ty đối tác trong bản ghi
**Kỹ năng thương hiệu đã hướng dẫn tác nhân.** Khi một tác nhân tạo tác phẩm và nêu tên các [kỹ năng thương hiệu](/info/brand-skills.html) nó đã đọc và làm theo, bản ghi cũng liệt kê từng kỹ năng cùng bản sửa đổi, như *Được hướng dẫn bởi: acme-brand 1.0*. Những từ này có nghĩa là kỹ năng đó đã hướng dẫn công việc. Lolly không kiểm tra tác phẩm theo kỹ năng. Chỉ tuyên bố của chính tác nhân mới thêm danh sách này. Hiện tại đó là đối số `brandSkills` của `lolly_render` trên [máy chủ MCP](/info/mcp.html), nên tác phẩm tạo trong ứng dụng hoặc từ liên kết chia sẻ không mang danh sách nào. Content Credential chứa danh sách dưới dạng `brandSkills`, một giá trị JSON gồm id, tên, bản sửa đổi và mã băm SHA-256 của từng kỹ năng. Gói XMP và siêu dữ liệu SVG chứa cùng giá trị dưới dạng `lolly:BrandSkills`. PDF được ghi từ bản ghi nhận thêm một từ khóa cho mỗi kỹ năng. Mô tả giữ nguyên. Nội dung của kỹ năng nội bộ không bao giờ được ghi lại. Các công tắc tương tự loại bỏ danh sách cùng phần còn lại của bản ghi: thẻ **Design system**, `_madewith=0`, `--no-madewith` và `madeWith: false`. Khi máy chủ MCP vẽ tệp trong trình duyệt (PDF, JPEG và các định dạng khác mà đường xử lý không dùng trình duyệt không thể ghi), siêu dữ liệu riêng của tệp không chứa danh sách. Ở đó chỉ Content Credential mới chứa được danh sách. Truyền `c2pa` để giữ bản ghi. Khi không có chứng thực, lần kết xuất cảnh báo rằng các kỹ năng thương hiệu chưa được ghi lại.

**Trang thương hiệu, khi bên xuất bản chọn bật.** Bên xuất bản hệ thống thiết kế có thể chọn ghi địa chỉ [trang thương hiệu](/info/brand-page.html#lead-back-from-your-files) của mình trên các bản xuất. Cài đặt áp dụng riêng cho từng hệ thống thiết kế và mặc định tắt. Khi đó thẻ thêm địa chỉ vào cùng dòng, như *Bản ghi: Acme · Colourway: Beach · Trang thương hiệu: https://acme.example/brand/acme/*. Bỏ đánh dấu thẻ sẽ xóa địa chỉ cùng phần còn lại. Bản ghi chỉ chứa địa chỉ, không có thông tin nào khác về trang. Không có gì khác trong tệp thay đổi. Hệ thống thiết kế không có địa chỉ ghi cùng tệp như trước.

**Địa chỉ không đi cùng gói.** Bản ghi trong tệp đã ký được hiểu là của người ký. Địa chỉ không được tự bật cho người không chọn địa chỉ đó, và gói không được phép hướng tệp của người khác đến trang do nó chọn. Gói `.lolly`, bản sao hoặc bản rẽ nhánh của hệ thống thiết kế, **Try these colours**, bản sao lưu được khôi phục và tệp token cấp cho một lần chạy đều đến với cài đặt tắt. Bạn có thể tự bật cài đặt, với địa chỉ do bạn nhập. Hệ thống thiết kế được quản lý là ngoại lệ duy nhất: nó giữ địa chỉ mà người quản lý đã đặt trong các token nguồn. [Dẫn về từ tệp của bạn](/info/brand-page.html#lead-back-from-your-files) có chi tiết.

**Công ty đối tác, trong chương trình đối tác Lolly Work.** Tác phẩm tạo cho một công ty đối tác ghi công ty và chương trình của họ trên cùng dòng, như *Bản ghi: Acme · Colourway: Beach · Đối tác: Northwind IT (Đại lý, EMEA)*, cùng bản sửa đổi thông tin công ty trong tệp. Bản ghi không chứa người, thông tin liên hệ, địa chỉ hay tiền tệ. Khi đính kèm bộ tài nguyên đối tác của công ty, dòng thêm bản sửa đổi của bộ tài nguyên, như *, bản sửa đổi bộ tài nguyên 2*, và chứng thực chứa id cùng bản sửa đổi của bộ tài nguyên, không bao giờ chứa màu sắc hay quy tắc của nó. Bỏ đánh dấu thẻ sẽ xóa đối tác cùng phần còn lại của bản ghi. PDF nhận thêm từ khóa *Đối tác: Northwind IT*, và [Lolly Verify](/info/what-verify-checks.html#partner) hiện bản ghi dưới **Partner** ([Bản ghi đối tác trong tệp](/info/manage/partner-programmes.html#the-partner-record-in-files)).
:::

**Đọc lại bản ghi.** [Lolly Verify](/#/verify) liệt kê bản ghi dưới **Design system** trong chi tiết chứng thực của tệp và các kỹ năng thương hiệu dưới **Guided by**. Trang thương hiệu xuất hiện riêng, dưới dạng [bản ghi địa chỉ của người ký](/info/what-verify-checks.html#brand-page). *Recreate with these settings* mở lại công cụ với phiên bản và colourway đã ghi. Liên kết mở bằng hệ thống thiết kế đã ghi khi thiết bị này có một hệ thống cùng id và tên; nếu không, nó mở bằng hệ thống thiết kế đang hoạt động của bạn.

::: details Nội dung được ghi ở đâu và những lần chạy nào bỏ qua bản ghi
| Nơi | Nội dung được ghi |
|---|---|
| Content Credential | `designSystem` (id), `designSystemLabel`, `designVersion` và `themes` trong xác nhận `tools.lolly.export`, mỗi mục là một giá trị văn bản thuần; `themes` là danh sách JSON gồm các lựa chọn. `brandPage` khi bên xuất bản chọn bật |
| PNG, JPEG, WebP và JXL | Cùng các giá trị dưới dạng thuộc tính `lolly:` của gói XMP trong tệp, trong không gian tên `https://lolly.tools/ns/export/1.0/`. `lolly:BrandPage` khi bên xuất bản chọn bật |
| SVG | Cùng các thuộc tính `lolly:` trong khối `<metadata>` |
| PDF | Các từ khóa như *Hệ thống thiết kế: Acme*, *Colourway: Beach* và, khi bên xuất bản chọn bật, *Trang thương hiệu: https://acme.example/brand/acme/* |
| Mọi định dạng có trường mô tả | Mô tả, với colourway cạnh công cụ |

Thẻ chỉ xuất hiện khi có thông tin để ghi và định dạng chứa được bản ghi. CSV, JSON, tệp lịch và các định dạng văn bản hay dữ liệu khác không chứa siêu dữ liệu, còn EPS, EMF, DXF và BMP không có trường cho bản ghi. HTML, Markdown và CSS chỉ chứa bản ghi trong Content Credential của chúng, nên với các định dạng này, thẻ không hiện dòng mô tả và ẩn khi **C2PA Credentials** tắt. Trường mà hệ thống thiết kế không cung cấp sẽ không có trong tệp.

Liên kết chia sẻ tắt bản ghi bằng `_madewith=0` ([Tham số URL](/info/url-parameters.html)). Dòng lệnh nhận `--no-madewith`, `lolly_render` của [máy chủ MCP](/info/mcp.html) nhận `madeWith: false` và bảng xuất của ứng dụng terminal có hàng **Design system**. Dòng lệnh in những từ mà tệp hoàn chỉnh mang ra luồng lỗi chuẩn, cho bản kết xuất công cụ và cho mỗi tệp mà `lolly run` xuất từ phiên Lolly Design đã lưu. Bản kết xuất MCP in những từ đó cạnh tệp. Cả hai đều đọc lại những từ đó từ tệp. PNG mà dòng lệnh vẽ không dùng trình duyệt không mang siêu dữ liệu tệp, nên bản ghi chỉ đi trong chứng thực. Các tiện ích trên thiết bị không thêm siêu dữ liệu.

Những lần chạy không có thẻ **Design system** bỏ qua bản ghi: lần chạy Lolly Batch, thư mục xuất từ Projects và bản xuất bộ sưu tập 3D, cùng với lô CSV, bản xuất thư mục hoặc vùng chọn Projects và chế độ xem kết xuất mọi thứ trong ứng dụng terminal. Xuất một tệp từ công cụ để ghi hệ thống thiết kế.
:::

### Content Credentials (C2PA)

Bản xuất có thể mang **Content Credentials**: một bản kê [C2PA](https://c2pa.org) đã ký ghi lại thứ gì tạo ra tệp, khi nào và ở đâu, gắn với mã băm các byte của tệp để có thể phát hiện mọi chỉnh sửa về sau. Lolly ghi bản kê chuẩn mà mọi trình đọc C2PA đều kiểm tra được.

![Thẻ C2PA Credentials, được đánh dấu, với thời hạn chứng thực cạnh ô đánh dấu](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Bật mặc định.** Thẻ **C2PA Credentials** được đánh dấu cho gần như mọi công cụ. Bỏ đánh dấu cho một lần xuất, hoặc truyền `c2pa=off` trong liên kết. Khi đó tệp không có chứng thực, và SVG nhúng trực tiếp tác phẩm có chứng thực, như logo trong danh mục, cũng mất chứng thực của tác phẩm đó. Lolly Imprint và các siêu dữ liệu khác của tệp vẫn còn. Công cụ có thể chọn tắt trong bản kê của nó.
- **Định dạng.** PDF (RGB và Print), PNG và APNG, JPG, GIF, SVG và SVGZ, TIFF (RGB và Print), WebP (tĩnh và động), AVIF, MP4, WebM, HTML, Markdown, CSS và các định dạng chứa âm thanh MP3, WAV, M4A, OGG/Opus và FLAC. ZIP đóng dấu từng tệp thành phần được hỗ trợ, đó là cách Animated SVG có chứng thực. MP4, AVIF và M4A dùng cách gắn kết BMFF chuẩn còn MP3 dùng ánh xạ ID3v2, nên `c2patool` và các trình đọc khác xác minh được chúng. WebM và OGG/Opus chưa có ánh xạ chuẩn, nên Lolly chứa bản kê dưới dạng tệp đính kèm Matroska và trường OpusTags mà trình xác minh riêng của Lolly kiểm tra. SVGZ là SVG được nén. Đặc tả C2PA không định nghĩa dạng nén, nên chứng thực được ghi vào SVG trước khi nén. Trình xác minh của Lolly đọc nguyên tệp; `c2patool` đọc cùng chứng thực sau khi tệp được giải nén (`gunzip`). ICO, EPS, EMF, DXF, BMP, PPTX, các định dạng Office và các định dạng văn bản và dữ liệu khác không có vùng chứa C2PA.
- **Thông tin được ghi lại.** Công cụ và ứng dụng đã tạo tệp, thời điểm ký và ứng dụng vỏ đã xuất tệp. Với trang Lolly Design xuất dưới dạng ảnh, SVG hoặc PDF, trình kết xuất đã vẽ trang (`route` trong xác nhận `tools.lolly.export`: `gpu` cho trình kết xuất trang bằng GPU, `operations` cho các thao tác vẽ được ghi dưới dạng vector, `compatibility` cho trình kết xuất riêng của trình duyệt) và phiên bản của trình kết xuất đó (`renderer`: công thức GPU, `design-draw-v` và phiên bản của nó, hoặc `dom-to-image` và `dom-walker`). [Hệ thống thiết kế và colourway](#the-design-system-record) khi thẻ **Design system** được đánh dấu. Các cài đặt đang hoạt động: lựa chọn menu, số, công tắc và màu được giữ nguyên, còn mọi nội dung đã nhập (tiêu đề, tên, ghi chú, liên kết và ngày) chỉ ở dạng dấu vân tay, nên câu chữ không có trong tệp. Các trường gắn với hồ sơ, điều khiển không hoạt động, phiên bản trình duyệt và chi tiết hệ điều hành đều được bỏ qua. Tên và email của bạn chỉ xuất hiện dưới vai trò tác giả khi **Use my details to create** bật trong Settings → Preferences → Your details. Các nguồn mà bản xuất đưa vào đi cùng dưới dạng thành phần nguồn. Mỗi ảnh trên trang có Content Credential riêng được ghi là một thành phần của trang, cùng chứng thực đó và mọi loại nguồn AI mà nó khai báo. Điều này áp dụng cho PNG, JPEG, WebP, AVIF, TIFF, SVG hoặc PDF, và cho GIF, APNG, WebP động, MP4 hoặc WebM khi ảnh được vẽ trong ít nhất một khung hình của khoảng được xuất. Một ảnh mà công cụ như Darkroom, Filter hoặc Asset Export thay đổi được ghi là nguồn cha của tệp, được mở trước rồi đến những gì công cụ đã làm với ảnh. Các thành phần nguồn khác là [tác phẩm được ghi công](#source-credits) như emoji, [bài nhạc Lolly Rondocode](/info/rondocode.html#songs-in-the-credential) trong bản xuất video hoặc âm thanh và [giai điệu đã lưu](/info/generated-music.html#what-a-track-records) trong bản xuất video hoặc âm thanh. Mỗi giai điệu đã lưu có tên, giấy phép nếu giai điệu có ghi, SHA-256 của công thức, phiên bản bộ máy và loại phương tiện được tạo bằng thuật toán. Người tạo giai điệu đã lưu (tên hồ sơ khi lưu) chỉ được thêm khi **Use my details to create** bật, như tên của chính bạn. Chỉ khi đó bảng xuất mới hiện người tạo trước khi bạn xuất.
- **Phê duyệt, khi đã được ghi lại.** Tệp được phê duyệt qua [Lolly Work](/info/work-approvals.html#review-an-exported-file) có thể mang bản ghi đã ký thứ hai phủ lên chứng thực này: id phê duyệt, ngày quyết định và mã băm của tệp đã duyệt. Nó không có tên, email, nhóm, nhận xét hay tên chuỗi. Nó được đánh dấu mặc định trong hộp thoại yêu cầu và có thể bỏ đánh dấu cho một yêu cầu hoặc tắt cho một phiên bản triển khai. Nó ghi nhận rằng một người ký đã tuyên bố quyết định. Nó không nói rằng tác phẩm đáp ứng tiêu chuẩn nào.
- **Những gì được yêu cầu thực hiện, với tệp tạo từ [ý định](/info/visual-intent.html#what-goes-in-the-file).** Mục đích, bề mặt, công cụ, ngôn ngữ, phiên bản quy tắc và từ vựng cùng mã băm ý định. Dịp, đối tượng, khu vực và lời nhắc chỉ ở dạng dấu vân tay, trừ khi người hoặc tác nhân chạy lần kết xuất đó yêu cầu ghi lại câu chữ của lời nhắc. Chỉ lần kết xuất bắt đầu từ ý định mới mang bản ghi này. Lần chạy cho biết đã ghi những gì, và có thể bỏ bản ghi.
- **Những gì người nhận thấy.** Công cụ C2PA như ứng dụng Adobe, `c2patool` và contentcredentials.org/verify đọc bản kê và hiện tuyên bố. Lolly ký bằng khóa tạo trên thiết bị của bạn, không phải chứng chỉ từ danh sách tin cậy, nên trình xem báo chứng thực *chưa được xác minh*. Cấu trúc và bằng chứng chống sửa đổi hợp lệ, nhưng không ai bảo chứng cho người ký. Để thay đổi điều đó, đăng ký **danh tính đã xác minh** trong Settings → Preferences → Content Credentials; xem [Danh tính Content Credentials](/info/content-credentials-identity.html).
- **Kiểm tra tệp.** Thả tệp bất kỳ vào [Lolly Verify](/#/verify), hoặc chạy `lolly validate <file>`, để có báo cáo trên thiết bị mở đầu bằng việc Lolly có tạo tệp hay không và tệp có thay đổi kể từ đó hay không. Lolly Verify còn kiểm tra ngoài chứng thực; xem [Lolly Verify kiểm tra những gì](/info/what-verify-checks.html).
- **Quyền riêng tư.** Khóa ký được tạo cho lần xuất và không bao giờ rời thiết bị của bạn. Tuyên bố chỉ chứa những gì siêu dữ liệu nguồn gốc đã mang. Tiện ích quyền riêng tư biến đổi tệp của chính bạn không thêm chứng thực, và *Lolly Strip Hidden Data* xóa bản kê C2PA như mọi siêu dữ liệu khác. Tiện ích Rondocode tạo âm thanh mới, nên ký những gì nó ghi ([Bài nhạc Lolly Rondocode](/info/rondocode.html#files-from-the-rondocode-utility)). Trình tạo nhạc ký mọi bản tải xuống WAV hoặc M4A. Chứng thực ghi rằng trình tạo nhạc của Lolly đã tạo bản nhạc cùng giấy phép áp dụng cho nhạc, CC BY 4.0, với dòng ghi công ([Bản nhạc ghi lại những gì](/info/generated-music.html#what-a-track-records)).
- **Tương tác.** PDF được bảo vệ bằng mật khẩu không thể mang Content Credentials, ở cả hai cấp. Chứng thực được thêm cuối cùng, trên các byte hoàn chỉnh, sau DPI, EXIF, cấu hình màu, siêu dữ liệu PDF/X và dấu in.

### Ghi công nguồn

Bản xuất có tác phẩm của người khác ghi nguồn đó trong chứng thực. Trường hợp thường gặp là emoji từ bộ emoji đã chọn: tác phẩm, người tạo, giấy phép, nguồn của các byte chính xác và những gì đã thay đổi đều đi cùng tệp. Văn bản trong công cụ có mẫu là SVG giữ emoji riêng của hệ thống, nên không có ghi công ở đó. Trước khi bạn tải xuống, hàng **Source credits** cho biết các nguồn yêu cầu gì khi bàn giao. Sau khi tải xuống, hàng đọc lại các byte đã bàn giao trước khi báo rằng thông tin ghi công có trong tệp. Giấy phép yêu cầu bạn lựa chọn, như ký tự CC BY-SA đã đổi màu mà bạn sắp chia sẻ, có thẻ với các tùy chọn. Việc tải xuống không bao giờ bị chặn. [Quyền sáng tạo và ghi công](/info/creative-rights.html) có câu chữ, các giấy phép đã được rà soát và những gì vẫn là của bạn.

<!--i:eti-lock-->
## Bảo vệ bằng mật khẩu

Lolly tạo hai loại khóa, cả hai đều trên thiết bị của bạn. Thẻ **Password** của bảng xuất đặt cả hai.

![Thẻ Password mở rộng trên bản xuất PDF, với trường mật khẩu và hai cấp khóa](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Mật khẩu mở PDF** có hai cấp sau khi bạn nhập mật khẩu:

- **Weak**: RC4 40-bit, dành cho `pdf` RGB không có dấu in hay vùng tràn lề và mật khẩu chỉ có ASCII. Mật khẩu có ký tự khác chuyển sang Strong, vì trình đọc không thể mở tệp khóa theo cách đó ở cấp này. Chỉ 32 ký tự đầu tiên có hiệu lực.
- **Strong**: AES-256 (PDF 2.0). Nó cũng áp dụng cho Print PDF và từng PDF trong ZIP xuất theo lô. Print PDF khóa bằng Strong giữ CMYK, dấu in và mục đích đầu ra nhưng bỏ tuyên bố PDF/X-4.

::: warning Weak chỉ gây trở ngại, không bảo vệ
Dùng **Strong** cho tệp bí mật.
:::

**ZIP được khóa** áp dụng cho bản xuất ZIP, bản tải xuống thư mục từ Projects hoặc một lô, với một mật khẩu ở hai cấp: **Weak** (ZipCrypto, chỉ gây trở ngại) hoặc **Strong** (AES-256). Mật khẩu bảo vệ mọi tệp thành phần. Mọi PDF bên trong cũng được khóa riêng bằng AES-256, nên PDF vẫn khóa sau khi giải nén ZIP. Lời nhắc xuất hiện khi bắt đầu tải xuống. Mật khẩu trống nghĩa là không khóa.

**Mật khẩu đã nhập không đi vào liên kết ở cả hai cấp.** Nếu tệp đến qua liên kết `?password=`, Lolly đọc giá trị rồi xóa ngay khỏi địa chỉ. Liên kết yêu cầu khóa mà tệp không hỗ trợ sẽ không ghi tệp và cho biết lý do (xem [`password`](/info/url-parameters.html)).

**Liên kết chia sẻ có mật khẩu** yêu cầu người nhận nhập mật khẩu trước khi mở. Trạng thái liên kết được mã hóa bằng AES-256 với khóa suy ra từ mật khẩu (PBKDF2). Chỉ bản mã được truyền đi, và việc giải mã diễn ra trong trình duyệt của người nhận. Máy chủ phục vụ liên kết không bao giờ thấy mật khẩu hay thiết kế. Bật tính năng này trong hộp thoại **Share**. Liên kết được mã hóa chỉ mở trong Lolly, không bao giờ dưới dạng ảnh nhúng. Xem [Chế độ URL](/info/url-mode.html).

<!--i:eti-monitor-->
## Trên điện thoại

Các điều khiển xuất nằm sau nút nổi **Export**, nút này mở bảng **Export**: cùng các định dạng, kích thước, sao chép, tải xuống và chia sẻ, với kích thước phù hợp cho cảm ứng.

<!--i:eti-code-->
## Id định dạng cho liên kết và CLI

Đây là các giá trị cho tham số URL `format=` và cờ CLI `--export=` (xem [Tham số URL](/info/url-parameters.html) và [CLI](/info/cli.html)). Menu của công cụ chỉ hiện những định dạng mà công cụ đó tạo được.

| Loại | Id |
|---|---|
| Ảnh điểm | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vector | `svg` · `svgz` (SVG nén bằng gzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (tệp cho máy cắt) |
| Trang và tài liệu | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (tệp thiết kế Penpot) · `scorm` (gói khóa học, một ZIP) |
| Chuyển động | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Âm thanh | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` · `mid` (nốt MIDI, từ Lolly Rondocode) |
| Văn bản và dữ liệu | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `ttml` · `scc` · `css` · `scss` · `gpl` (bảng màu GIMP) |
| Gói dữ liệu và gói phần mềm | `zip` · `rpm` và `tar.gz` (bản kết xuất được đóng dấu vào gói Linux) |

Một số id đến từ mã xuất riêng của công cụ: `ase` (Adobe Swatch Exchange, từ Lolly Palette Lab) và `exr` cùng `hdr` (ảnh điểm dải động cao, từ Lolly Darkroom). **Convert Font** ghi `ttf`, `otf` và `woff` từ tệp phông chữ bạn cung cấp, nên chỉ một liên kết sẽ không cho công cụ thứ gì để kết xuất.
