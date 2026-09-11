# Xuất & Định dạng

Cách lấy ra một tệp hoàn chỉnh từ một công cụ - chọn đúng định dạng, đặt kích thước đầu ra và mỗi tùy chọn làm gì. Như mọi thứ khác, **việc xuất diễn ra trên thiết bị của bạn**; không có gì được tải lên.

## Cách xuất hoạt động

Bản xem trước *chính là* tệp. Khi bạn xuất, host kết xuất canvas đó sang định dạng bạn chọn và đưa cho bạn một tệp tải xuống (hoặc đặt nó vào clipboard). Một công cụ chỉ đưa ra những định dạng mà tác giả của nó đã khai báo, và bộ chọn ẩn đi bất kỳ định dạng nào trình duyệt của bạn không tạo ra được (xem [Video](#video)).

Ba đường đi tạo ra một tệp. Hầu hết công cụ **kết xuất canvas** sang định dạng đã chọn. Các định dạng văn bản và dữ liệu (HTML, MD, TXT, JSON, CSV, ICS, VCF) thay vào đó được **tạo ra từ nội dung của công cụ**, không phải raster hóa từ hình ảnh. Và các tiện ích quyền riêng tư (ví dụ *Strip Hidden Data*) dùng đường thứ ba: tệp *bạn* chọn được biến đổi từng byte trên thiết bị và trả lại thẳng - không canvas, không watermark và không thêm siêu dữ liệu nguồn gốc nào, vì đó đã là tệp của riêng bạn.

Các thao tác trong bộ điều khiển xuất:

- <!--i:download--> **Tải xuống** - lưu tệp (thao tác chính).
- <!--i:photos--> **Sao chép** - đặt hình ảnh vào clipboard để dán thẳng vào Slack, email, một tài liệu. Ở nơi trình duyệt không thể sao chép hình ảnh, nó sẽ tải xuống thay thế và báo cho bạn biết.
- <!--i:folder--> **Lưu** - giữ lại thiết kế hiện tại như một phiên công cụ đã lưu trong thư viện của bạn.
- <!--i:link--> **Chia sẻ** - mở **hộp thoại Chia sẻ**: một liên kết có thể sao chép để tái tạo thiết kế, các bật/tắt khi truy cập (toàn màn hình, bảng xuất, tải xuống hoặc sao chép khi mở) và tùy chọn **Liên kết ngắn nhất** để đóng gói toàn bộ trạng thái thành một token gọn nhẹ (xem [URL Mode](/info/url-mode.html)).

(Tác giả của một công cụ chọn những thao tác nào xuất hiện; bộ mặc định là Sao chép, Tải xuống và Lưu.)

![Bảng xuất - định dạng, kích thước và các thao tác Sao chép / Tải xuống / Lưu / Chia sẻ](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Chia sẻ mở ra trên công cụ, với liên kết đã được dựng sẵn và các nút bật/tắt khi truy cập ở bên dưới.

### Kết xuất nhiều thứ cùng lúc

Một lần xuất là một tệp, nhưng bạn có thể kết xuất **nhiều** tệp trong một lượt - mỗi lượt được đóng gói thành một `.zip`:

- <!--i:folder--> **Projects → Render folder** xuất mọi phiên đã lưu trong một thư mục (và các thư mục con của nó) thành một zip lồng nhau; **Render selection** làm điều tương tự cho bất kỳ lựa chọn nhiều mục nào; một phiên đã lưu đơn lẻ kết xuất thẳng ra tệp riêng của nó. Không cần Batch/Pro - xem [Sử dụng Lolly → Projects](/info/using.html).
- <!--i:layers--> **Batch (Pro)** kết xuất một lưới các bộ đầu vào - mọi biến thể của một mẫu cùng một lúc.

Một phiên đã lưu cũng có thể được chia sẻ lại như một liên kết công cụ từ Projects (nó tái tạo URL công cụ từ các đầu vào đã lưu), nên một liên kết sẽ mở lại nó với đúng cùng những thiết lập đó.

## Chọn định dạng

Trường tên tệp và bộ chọn định dạng nằm ở đầu bảng điều khiển như một cặp `name.format`, và bộ chọn chỉ liệt kê những định dạng mà tác giả công cụ này đã khai báo.

![Trường tên tệp gắn liền với bộ chọn định dạng, để việc xuất đọc như một cặp name.format](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

| Bạn muốn… | Dùng | Vì sao |
|---|---|---|
| Logo / hình ảnh sắc nét, co giãn được | **SVG** | Vector - co giãn vô hạn, nhẹ, chỉnh sửa được |
| Vector cho Office / ứng dụng Windows | **EMF** | Dán vào PowerPoint / Word thành vector chỉnh sửa được; văn bản vẫn sống và có thể sửa, và Google Drive mở nó bằng Google Drawings cho Slides |
| Vector cho in ấn / ứng dụng thiết kế | **EPS**, hoặc **EPS (CMYK)** | Vector PostScript cho Illustrator / quy trình in ấn |
| Vector cho máy cắt / máy CAD | **DXF** | Máy cắt laser, máy cắt decal, CNC - đường viền tính bằng milimét |
| Bản trình chiếu chỉnh sửa được | **PowerPoint** (PPTX) | Văn bản + hình dạng gốc chỉnh sửa được, hình ảnh và vector vẫn trích xuất được |
| Khóa học mà LMS có thể nhập | **SCORM** (LMS) | Một tệp zip gồm manifest, trang khởi chạy, các slide và phim có thuyết minh kèm phụ đề - từ một bản trình chiếu Design |
| Tài liệu văn bản chỉnh sửa được | **Word** (DOCX) hoặc **OpenDocument** (ODT) | Đoạn văn và tiêu đề thật mà trình xử lý văn bản có thể tiếp tục chỉnh sửa (Doc Studio) |
| Ảnh chụp hoặc hình ảnh đa dụng | **PNG** (không mất dữ liệu) hoặc **JPG** (nhỏ hơn) | Raster phổ dụng |
| Ảnh hiện đại, nhỏ hơn | **WebP** / **AVIF** | Nén tốt hơn, có kênh alpha |
| In ấn | **PDF**, hoặc **Print PDF** (CMYK) | Kích thước trang thật; CMYK cho in ấn |
| Raster in ấn cho nhà in | **Print TIFF** (CMYK) | Điểm ảnh DeviceCMYK cho RIP |
| Hoạt hình cho web | **GIF** | Hoạt động ở mọi nơi, tệp lớn hơn |
| Hoạt hình đầy đủ màu + kênh alpha thật | **APNG** | PNG hoạt hình - không giới hạn bảng màu, trong suốt thật |
| Hoạt hình, tệp nhỏ nhất | **Animated WebP** | Đầy đủ màu + alpha, nén tốt hơn GIF hoặc APNG |
| Vector hoạt hình co giãn được | **Animated SVG** | Tự chứa; lặp trong trình duyệt hoặc `<img>`, không cần codec, mọi kích thước |
| Video cho mạng xã hội / chia sẻ | **MP4** hoặc **WebM** | Chất lượng trên mỗi byte tốt nhất (xem bên dưới) |
| Văn bản định dạng phong phú / chữ ký email | **HTML** | Dán định dạng sẵn vào ứng dụng email |
| Nội dung thuần | **MD** / **TXT** | Chỉ văn bản |
| Sự kiện lịch | **ICS** | Nhập vào bất kỳ ứng dụng lịch nào |
| Danh thiếp | **VCF** | Nhập vào Contacts / sổ địa chỉ |
| Dữ liệu có cấu trúc để nhập lại | **JSON** / **CSV** | Khôi phục nội dung của công cụ nguyên vẹn |
| Favicon | **ICO** | Biểu tượng trang web đa kích thước (**ZIP** gói nhiều định dạng) |

Hàng đầu tiên là trường hợp phổ biến. Một wordmark được đặt bằng font thương hiệu của bạn xuất ra dưới dạng SVG, nơi mỗi chữ cái là một đường path đã được vạch viền chứ không phải pixel, nên nó vẫn sắc nét ở kích thước danh thiếp và ở kích thước bọc tòa nhà từ cùng một tệp.

![Một wordmark viết Aurora, mảnh, dãn cách rộng, kiểu tác phẩm vector thuần túy mà hàng SVG trong bảng nói đến](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-wordmark-vector)

## Kích thước & đơn vị in ấn

Theo mặc định, bản xuất dùng kích thước pixel gốc của công cụ. Ở nơi một công cụ hiện **kích thước**, bạn có thể đặt chiều rộng × chiều cao và một **đơn vị**:

- **px** (mặc định) - pixel chính xác.
- **mm · cm · in · pt · pc** - kích thước vật lý/in ấn. Với đơn vị vật lý, bạn cũng đặt **DPI** (mặc định **300** cho in ấn); engine chuyển đổi chính xác theo từng định dạng - **PDF** trở thành một trang thật ở kích thước đó, **raster** kết xuất ở đúng số pixel theo DPI (và nhúng độ phân giải), **SVG** giữ đơn vị vật lý với một viewBox px.

Để có raster độ phân giải cao hơn, nhập chiều rộng/chiều cao lớn hơn, hoặc chọn một đơn vị vật lý và tăng DPI (pixel = kích thước × DPI). Không có nút bật/tắt tỷ lệ một chạm.

Ví dụ: chiều rộng `210`, chiều cao `297`, đơn vị `mm` → một trang A4.

![Hàng kích thước đặt thành 210 x 297 mm, với trường DPI hiện ra vì đơn vị là vật lý](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Ảnh tĩnh từ một bố cục có thời lượng

Một **bản dựng có thời lượng** - dòng thời gian [Sequence](/info/using.html#timeline-sequence) trong Design, hoặc bất kỳ artboard nào chạy theo dòng thời gian - là một thứ đang chuyển động, nên khi xuất ảnh tĩnh phải trả lời câu hỏi "tại thời điểm nào?". Quy tắc đúng như bạn nghĩ: **khung hình tại vị trí con trỏ phát**. Đặt con trỏ phát ở đúng chỗ bạn muốn lấy ảnh rồi xuất; những gì bạn thấy chính là những gì được xuất ra.

Khi bạn muốn nhiều hơn một khoảnh khắc, trường **Frames** xuất hiện bên cạnh kích thước đầu ra (chỉ với bố cục có thời lượng, và chỉ với định dạng tĩnh - PNG, JPG, WebP, SVG hoặc PDF). Để nguyên ở `1` cho khung hình tại đầu phát. Tăng lên và bạn sẽ có từng ấy ảnh tĩnh được lấy mẫu tại các khoảng cách đều nhau trên toàn bộ chuỗi cảnh:

- **Raster và SVG** trả về dưới dạng một **zip** - `<name>-01.png`, `-02.png` và cứ thế.
- **PDF** trả về dưới dạng **một tài liệu duy nhất gồm từng ấy trang**.

Hữu ích cho một storyboard, một bảng thumbnail, một contact sheet để xem xét lại hoặc một carousel mạng xã hội cắt thẳng từ một bản dựng video.

Việc lấy mẫu được thực hiện tại **điểm giữa** của mỗi khoảng thay vì tại các cạnh, vì khoảnh khắc đầu tiên của một chuỗi cảnh thường là một chuyển cảnh vào chưa kịp hiện rõ và khoảnh khắc cuối là trạng thái sau khi mọi clip đã kết thúc - lấy mẫu tại điểm cuối sẽ tốn hai khung hình của bạn cho những khung gần như trống. Số lượng bị giới hạn ở **64** (một contact sheet là để con người đọc), và bất cứ thứ gì vô nghĩa được nhập vào trường này sẽ quay về `1` thay vì làm hỏng bản xuất. Mỗi khung hình là một ảnh tĩnh bình thường, nên Content Credentials, dấu ấn (imprint), đơn vị vật lý và DPI đều hoạt động y hệt như với một bản xuất đơn.

Trường **Frames** là cách để có được một bảng ảnh ngay hôm nay. Engine dành sẵn một tham số URL `cuts` tương ứng, nhưng chưa có shell nào đọc nó từ một liên kết, nên một liên kết được chia sẻ luôn mở lại ở khung hình đầu phát - xem [URL Mode](/info/url-mode.html#contact-sheets-cuts).

## PDF nhiều trang

Một số công cụ tạo ra **tài liệu PDF nhiều trang** thay vì một tác phẩm đơn lẻ - một trang bìa, nội dung tự chảy sang bao nhiêu trang cần thiết và một trang cuối, tất cả trong một tệp (xem công cụ *Booklet*). Mỗi trang là một **trang PDF thật sự**, có kích thước đúng theo khung của trang đó, nên người đọc và máy in nhận được các trang thật, không phải một ảnh dài.

- **Trang tạo từ nội dung.** Thêm các khối văn bản và hình ảnh; các trang mới được tạo tự động khi các khối lấp đầy, và bạn có thể buộc bất kỳ khối nào bắt đầu một trang mới.
- **Kích thước trang thật.** Chọn A4, US Letter hoặc A5 (dọc - bố cục hai cột được thiết kế cho nó) - mọi trang, và tệp PDF được xuất, kết xuất đúng ở kích thước đó.

PDF nhiều trang là tài liệu RGB và không mang dấu cắt/dấu tràn lề - những thứ đó thuộc về đường dẫn **Print PDF** một trang ở trên. Chúng vẫn mang cùng **siêu dữ liệu PDF/X-4** như mọi bản xuất PDF (khung trang, XMP, ID tài liệu, ý định đầu ra sRGB kèm hồ sơ nhúng), và chúng có tùy chọn **Content Credentials** (bên dưới) - trên công cụ *Booklet* tùy chọn này được chọn sẵn.

## Tạo nhiều thứ cùng lúc

Lolly có ba cách riêng biệt để làm việc trên diện rộng, và chúng giải quyết những công việc khác nhau - chỉnh sửa hàng loạt là một năng lực hạng nhất của nền tảng, không phải thứ mỗi công cụ tự phát minh lại:

- <!--i:document--> **Một thiết kế × một bảng các hàng → một tài liệu nhiều trang.** Các công cụ có đầu vào `table` (như *Battlecards*) biến mỗi hàng thành một trang tự động - dán một bảng từ bảng tính của bạn, nhận về một PDF cỡ tập slide. Trình chỉnh sửa hàng loạt thật sự của bạn vẫn là bảng tính: sửa mười hàng ở đó, dán lại lần nữa. Bản thân công cụ không bao giờ quản lý các trang.
- <!--i:layers--> **Một thiết kế × một tệp dữ liệu → nhiều tệp riêng biệt.** Lưới hàng loạt `/pro` nhận một CSV và kết xuất một bản xuất *cho mỗi hàng* - thẻ tên, chứng chỉ, mỗi thứ một tệp.
- <!--i:sliders--> **Nhiều tài sản khác nhau, chỉnh sửa song song.** *Multi-edit* mở nhiều phiên đã lưu trong một khung nhìn để chỉnh sửa phối hợp trên các thiết kế riêng biệt.

Quy tắc chung: các hàng cùng một thiết kế thuộc về **một tài liệu** → một công cụ điều khiển bằng bảng; các hàng phải xuất ra **các tệp riêng biệt** → `/pro`; **các thiết kế khác nhau** cần cùng một chỉnh sửa → multi-edit. (Một tùy chọn kết xuất "combine media" đang được lên kế hoạch sẽ nối hai cách đầu lại với nhau - ghép các bản xuất cùng định dạng thành một PDF, một video hoặc một contact sheet để kiểm duyệt.)

## PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart và Diagrams đều có thể xuất một **bản trình chiếu PowerPoint** - mỗi trang một slide. Mục đích không phải là chụp ảnh màn hình chính xác từng điểm ảnh; mà là để trao cho đồng nghiệp một bản trình chiếu mà họ thực sự có thể **chỉnh sửa và lấy tài sản ra**. Vì vậy mỗi trang được phân rã thành các đối tượng gốc:

- <!--i:font--> **Văn bản** trở thành **hộp văn bản PowerPoint có thể chỉnh sửa** thực sự - với cỡ chữ, màu sắc, độ đậm, in nghiêng và căn chỉnh lấy từ bố cục - nên bạn có thể sửa lỗi gõ hoặc đổi kiểu ngay trong PowerPoint.
- <!--i:pentool--> **Vector** (logo, biểu tượng, dấu hiệu SUSE) được nhúng dưới dạng **ảnh SVG thật** - chúng luôn sắc nét ở mọi kích cỡ, và PowerPoint thậm chí có thể *Convert to Shape* trên đó.
- <!--i:photos--> **Hình ảnh** được đưa vào ở độ phân giải gốc dưới dạng ảnh riêng có thể trích xuất (một ảnh hero cắt kiểu `cover` vẫn giữ toàn bộ ảnh phía sau phần cắt, để bạn có thể đóng khung lại), với mọi xử lý trên ảnh (bộ lọc, hòa trộn) được thể hiện trung thực.
- <!--i:layers--> **Nền, đường viền và các đường kẻ** trở thành hình chữ nhật/đường thẳng thật.

![Bảng xuất với PowerPoint được chọn: mỗi trang một slide, văn bản và hình dạng vẫn chỉnh sửa được](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Bố cục chỉ mang tính tương đối theo chủ ý - mục tiêu là **nội dung** trung thực, có thể tái sử dụng, chứ không phải một ảnh chụp màn hình bị khóa cứng. Bất cứ thứ gì walker không thể thể hiện tự nhiên (một vùng có bộ lọc hoặc mặt nạ phức tạp) sẽ được nhúng dưới dạng ảnh để không mất gì. Một bản trình chiếu có một kích thước trang duy nhất, lấy từ trang đầu tiên.

PowerPoint cũng là một lối **vào**. Thả một tệp `.pptx` lên bất kỳ bề mặt tải lên nào và chọn các slide bạn muốn - mỗi slide trở thành một tài sản để đặt, chỉnh màu hoặc xây dựng tiếp. **Markdown Slides** viết một bản trình chiếu mới từ Markdown (và cung cấp một mẫu `.pptx` mang thương hiệu), còn tiện ích **Rebrand** thay đổi giao diện của một bản trình chiếu có sẵn ngay tại chỗ - bảng màu chủ đề, màu và phông chữ cố định - mà không đụng đến biểu đồ, SmartArt hay hiệu ứng động của nó, rồi trả lại một tệp `.pptx`. Xem [Nhập một thiết kế → Bản trình chiếu và tài liệu](/info/design-import.html#decks-and-documents).

## Penpot

Bất kỳ công cụ nào xuất được SVG cũng có thể xuất một **tệp Penpot** (`.penpot`) - tài liệu, sẵn sàng để tiếp tục chỉnh sửa trong Penpot chứ không chỉ để xem.

- <!--i:layout--> Từ **Design**, mỗi khung hình trở thành một **board** Penpot, mọi hộp trên đó được giữ nguyên thành hình dạng chỉnh sửa được riêng - hình chữ nhật, hình elip, văn bản, hình ảnh hoặc đường path - và kết quả xuất hiện dưới dạng một **component** tái sử dụng được trong bảng Assets, sẵn sàng để kéo ra lại.
- <!--i:pentool--> Từ một công cụ mà bản dựng của nó là **hình học thuần túy** - các công cụ vector như QR Code, Street Map, Wordmark và Palette Lab - mọi đường path, hình chữ nhật, dòng văn bản và gradient đều được giữ nguyên theo cách tương tự, thành hình dạng chỉnh sửa được riêng.
- <!--i:font--> Từ một công cụ dàn bản dựng bằng **HTML**, **văn bản vẫn là văn bản** - mỗi dòng là một đối tượng văn bản Penpot chỉnh sửa được riêng, không phải đường viền và không phải ảnh phẳng. Một tác phẩm mà Penpot không có cấu trúc tương ứng - một minh họa phức tạp, một canvas sống - sẽ đi kèm riêng dưới dạng hình ảnh, nên nó không bao giờ làm phẳng văn bản và các hộp xung quanh. Toàn bộ bố cục mà Penpot không thể tách rời trung thực vẫn có thể hiện ra như một hình ảnh duy nhất với độ trung thực đầy đủ, nên không có gì bị bỏ sót.
- <!--i:palette--> Một màu hoặc phông chữ mà một hình dạng **thừa hưởng từ token thương hiệu** vẫn giữ **liên kết** với token đó trong tệp: đổi token trong bảng Tokens của Penpot thì mọi hình dạng thừa hưởng nó sẽ tô lại màu cùng nhau, còn một màu cố định riêng lẻ vẫn giữ nguyên vị trí. Màu sắc và kiểu chữ của thương hiệu cũng xuất hiện trong bảng **Assets** và toàn bộ tập token thiết kế của nó trong bảng **Tokens** - cùng một tập token DTCG mà bảng màu của chính Lolly sử dụng. Từ đó Penpot giữ bản sao riêng: một chỉnh sửa thực hiện trong bảng Tokens của Penpot quay trở lại thương hiệu thông qua [nhập từ Brand Studio](/info/design-import.html), chứ không tự động.

| Bạn đã tạo | Trong Penpot |
|---|---|
| Văn bản | Đối tượng văn bản chỉnh sửa được - sửa lỗi gõ hoặc đổi kiểu |
| Hình dạng, đường path, gradient, hình ảnh | Hình dạng vector chỉnh sửa được riêng của chúng |
| Một màu hoặc phông chữ từ token thương hiệu | Một liên kết token sống - sửa token, mọi hình dạng thừa hưởng nó sẽ theo |
| Toàn bộ thiết kế | Một component tái sử dụng được trong bảng Assets |
| Một minh họa phức tạp hoặc canvas sống | Nhúng riêng dưới dạng hình ảnh, nội dung chỉnh sửa được xung quanh nó không bị đụng đến |

![Bảng xuất với Penpot được chọn: tệp .penpot, và Send to Penpot bên cạnh nút tải xuống](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Để mở tệp, khởi động Penpot, chọn một dự án rồi chọn **Import**. Khi đã đăng nhập vào Penpot từ bảng xuất, **Send to Penpot** thực hiện bước đó thay bạn - chọn một dự án ở đó và tệp sẽ đi thẳng vào dự án đó.

## SCORM (gói khóa học)

Một bản trình chiếu Design có thể xuất ra dưới dạng **gói SCORM** - tệp zip mà một hệ thống quản lý học tập (LMS) nhập vào, dù đó là Moodle, Canvas, Blackboard hay một LMS nội bộ doanh nghiệp. Chọn **SCORM (LMS)** trong bảng chọn định dạng và bản xuất sẽ ghi ra:

- <!--i:layout--> **Các slide**, mỗi artboard một hình ảnh, dạng vector khi artboard cho phép và chỉ ở dạng điểm ảnh khi không thể.
- <!--i:play--> **Phim thuyết minh** kèm rãnh phụ đề - ghi chú của người thuyết trình được đọc bởi một giọng nói trên thiết bị, đúng như [Presenting](/info/create/using.html#presenting) phát chúng.
- <!--i:file--> **Một trang khởi chạy** dẫn qua từng slide, phát phim và báo cáo hoàn thành về LMS thông qua runtime SCORM 1.2, phiên bản mà mọi LMS đều chấp nhận.
- <!--i:font--> Các phông chữ mà bản trình chiếu sử dụng, để trang khởi chạy hiển thị giống hệt khi ngoại tuyến.

![Bảng xuất trên một bản trình chiếu Design với SCORM (LMS) được chọn](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Không có gì trong gói này gọi về máy chủ nào cả: đó chỉ là các tệp trong một zip, và nó chạy bên trong LMS mà không cần bundler, không cần CDN và không cần tài khoản. Ứng dụng web và desktop tạo ra gói này; CLI thì không, vì việc chụp lại artboard và mã hóa phim cần đến trình duyệt.

## DXF (tệp cắt)

Các công cụ vector (Brand Lockup, QR Code, Street Map, Wayfinding Signage, Pose Geeko, các logo lockup, Diagram Builder) có thể xuất **DXF** - định dạng trao đổi AutoCAD R12 mà máy cắt laser, máy plot vinyl và phần mềm CNC/CAD đọc được. Hình học được ghi thành các **path viền theo milimét** (đường cong được làm phẳng đến một dung sai mịn), văn bản được viền thành path và màu sắc được ánh xạ tới AutoCAD Color Index gần nhất (thường quyết định công cụ/thao tác trên máy cắt). DXF chỉ là line-art - một vùng ảnh chụp hoặc đã lọc filter không có dạng đường cắt và sẽ bị loại bỏ (Lolly sẽ cảnh báo), vì vậy hãy dùng SVG/PDF khi bạn cần giữ lại nội dung raster.

Street Map là trường hợp rõ ràng nhất: toàn bộ thiết kế vốn đã là các nét vẽ, nên mỗi con đường và kênh đào trở thành một đường cắt mà không có gì bị bỏ đi.

::: showcase
![Bản render Street Map của Paris bằng mực trên nền kem - hình vẽ đường nét thuần túy, nên mọi nét đều giữ nguyên khi đưa vào máy cắt](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Cuộn xuống, và góc nhìn kéo lùi xuyên qua chính hình học đó: bảy đường path, không một pixel nào, mỗi nét sắc nét như tóc ở bất kỳ độ phóng đại nào. Đó chính là tệp mà máy cắt sẽ đọc.
:::

## SVG hoạt hình

Các công cụ chuyển động (Animated Ad, Lottie Ad) có thể xuất ra **SVG hoạt hình** - một hoạt ảnh *vector* độc lập, tự chứa. Khác với GIF/APNG/WebP (lấy mẫu từng khung hình thành pixel), một SVG hoạt hình xếp chồng các ảnh chụp vector với keyframe CSS nhúng sẵn, nên nó **thu phóng ở mọi kích cỡ mà không cần codec hay runtime bên ngoài** - nó lặp trong một tab trình duyệt hoặc một thẻ `<img>`. Văn bản vẫn được vẽ đường viền nên hiển thị được ở mọi nơi. Nó dùng chung các tùy chỉnh **Thời lượng**/tốc độ khung hình của các định dạng hoạt hình khác, và (do nặng hơn trên mỗi khung so với bitmap) dùng tốc độ khung hình mặc định thấp hơn.

## Trong suốt

Các công cụ hỗ trợ tính năng này cung cấp một nút bật/tắt **nền trong suốt** (ví dụ *No BG*). Tính trong suốt được giữ lại ở PNG, WebP, AVIF, SVG (tĩnh và hoạt hình), APNG và Animated WebP. JPG và PDF luôn không trong suốt, còn TIFF được làm phẳng trên nền trắng (trên nền đen ở đường dẫn HDR - xem bên dưới).

## Không gian màu

Hai câu hỏi khác nhau, đáng tách riêng: Lolly có thể **đọc và tư duy** trong những không gian màu nào, và nó **ghi ra** những không gian màu nào.

**Đọc.** Ở bất cứ nơi nào màu sắc được viết ra - stylesheet của một công cụ, nét vẽ của một SVG được nhập vào, giá trị của một token thiết kế, một bóng đổ hay gradient bên trong CSS shorthand - Lolly đọc toàn bộ từ vựng **CSS Color 4**: `#hex`, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, các tên màu CSS và `color()` trong các không gian được định sẵn - `srgb`, `srgb-linear`, `display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz-d50`, `xyz-d65` - kể cả các thành phần được viết dưới dạng từ khóa `none`. Một trình phân tích duy nhất làm việc này cho toàn bộ nền tảng, nên trình duyệt và mọi walker xuất tệp đều thống nhất về ý nghĩa của một chuỗi màu.

Điều đó quan trọng hơn vẻ ngoài của nó, vì trình duyệt phân giải CSS hiện đại thành CSS hiện đại. Viết `color-mix(in oklab, …)` thì Chrome sẽ tính ra `oklab(…)`; dùng một token thương hiệu được lưu dưới dạng `oklch()` thì đó chính là giá trị nguyên văn mà walker xuất tệp nhìn thấy. Màu sắc ở các dạng đó được đọc đúng thay vì bị bỏ qua - điều mà một walker chỉ hiểu `rgb()` đã từng làm, xuất văn bản có màu thương hiệu thành màu đen, làm mất các bảng có tông màu và đường kẻ bảng, và đọc `oklch(0.7 0.1 200) 0px 2px 4px` như một độ lệch bóng đổ là 0.7 nhân 0.1.

**Tư duy.** Toán học màu sắc diễn ra theo tri giác thay vì trên các kênh thô. Việc suy ra bảng màu, dải màu, hài hòa và độ tương phản chạy trong **OKLCH/OKLab**, và một màu ngoài gamut được đưa vào phạm vi bằng chính thuật toán ánh xạ gamut của CSS Color 4 - giảm chroma kèm kiểm tra khoảng cách tri giác - thay vì cắt kênh, nên một màu sặc sỡ sẽ ổn định ở màu gần nhất mà bạn thực sự chấp nhận được thay vì một màu bị làm phẳng. Gradient nội suy trong không gian bạn chọn (mặc định là OKLab, hoặc `oklch`, `lab`, `lch`, `srgb`, `srgb-linear`, `hsl`, với một hướng di chuyển màu (hue-travel) cho các không gian dạng cực), và việc pha trộn được **premultiplied**, nên một hiệu ứng mờ dần sang trong suốt vẫn giữ đúng màu thay vì tối dần về màu đen trên đường đi. Một bộ nội suy duy nhất phục vụ cả trình xem trước lẫn các walker xuất tệp - đó chính là điều ngăn một gradient hình nón bị pha trộn theo một cách trên màn hình và một cách khác trong tệp xuất ra.

**Ghi.** Đầu ra cố tình hẹp hơn đầu vào, vì một tệp phải đọc được bởi bất cứ thứ gì mở nó, và một không gian màu chỉ được *khai báo* khi các con số thực sự đã được chuyển đổi sang không gian đó. Các định dạng màn hình và web được ghi dưới dạng **sRGB** và được gắn nhãn tương ứng; các định dạng in được ghi dưới dạng **CMYK** theo một điều kiện in được đặt tên (bên dưới); và đường dẫn HDR là **Rec.2100 PQ** (ở trên). Một màu có dải gam rộng khi tới bước xuất sẽ được ánh xạ vào sRGB thay vì bị gắn nhãn sai - việc mang `color(display-p3 …)` xuyên suốt vào một tệp vector là một phần mở rộng đã được lên kế hoạch, chưa phải là điều các bản xuất hiện tại làm được. Một gradient được tạo trong OKLab sẽ được *nướng* thành các điểm dừng sRGB thuần khi xuất ra, với các điểm dừng bổ sung chỉ được chèn thêm ở nơi sRGB lệch rõ so với đường cong cảm nhận, vì một `<linearGradient>` trong SVG hay một shading trục trong PDF không có tùy chọn không gian nội suy để mang theo chủ ý đó. Một giá trị được tạo ra, ba trình kết xuất, không hề lệch nhau.

## Hồ sơ màu

Để màu sắc tái hiện trung thực trong các ứng dụng quản lý màu (nhà in, Photoshop, trình duyệt), các bản xuất được **gắn kèm hồ sơ màu**:

- **PNG / JPG** mang theo một hồ sơ ICC **sRGB** nhúng sẵn - đúng không gian màu mà bản xem trước thực sự được kết xuất - nên không có gì phải đoán. (Chỉ là gắn nhãn; các pixel không được mã hóa lại.)
- **PDF in (CMYK)** khai báo một **điều kiện in** đích trong *OutputIntent* của nó (mặc định là *Coated FOGRA39*), cho RIP/nhà in biết mực CMYK của nó cần được đọc như thế nào. Các mẫu màu thương hiệu có giá trị mực đo được sẽ được chuyển đổi chính xác; các màu khác dùng phép chuyển đổi thiết bị chuẩn. Khai báo đó là một *cái tên*: không có hồ sơ CMYK nào đi kèm Lolly, và PDF/X-4 yêu cầu hồ sơ phải được nhúng, nên một điều kiện được đặt tên chỉ ghi ra output intent mà không tuyên bố tuân thủ PDF/X-4. Nạp một hồ sơ CMYK của riêng bạn và chọn dòng **Embed** trong bộ điều khiển Hồ sơ màu thì nó sẽ được nhúng làm *DestOutputProfile* của tệp - lúc đó PDF mới thực sự có thể là PDF/X-4, và sẽ tuyên bố điều đó bất cứ khi nào phần còn lại của tệp cho phép. Ba thứ giữ tuyên bố đó lại trong khi vẫn giữ output intent (một RIP vẫn cần cái đó): tác phẩm RGB mà bước chuyển CMYK không chuyển đổi được, văn bản ghi công ở lề chứng minh `prov` (được vẽ bằng phông chuẩn không được nhúng, và X-4 không có ngoại lệ cho những trường hợp đó) và mật khẩu **Strong**, vì X-4 cấm mã hóa. Điều kiện mà nó khai báo sau đó được đọc ra từ chính hồ sơ đó: một tên đã đăng ký nơi hồ sơ chứng minh được, `Custom` dưới tên riêng của hồ sơ nơi không chứng minh được, để tệp không bao giờ nêu tên một điều kiện in trong khi mang số đo của một điều kiện khác.
- **TIFF in (CMYK)** ghi các pixel **DeviceCMYK** không gắn nhãn và ghi lại cùng điều kiện in đó như thông tin xuất xứ trong metadata TIFF (*ImageDescription*) thay vì nhúng một hồ sơ. Cùng bộ điều khiển Hồ sơ màu điều khiển cả hai định dạng CMYK - một TIFF hoàn toàn không thể nhúng hồ sơ in, nên dòng **Embed** chỉ ghi lại tên riêng của hồ sơ đó và không gì khác.
- **TIFF (RGB)** là phiên bản sRGB thuần, không nén - một ảnh raster không mất dữ liệu ở DPI đã chọn, dùng để lưu trữ hoặc chuyển qua lại với trình chỉnh sửa, với thông tin xuất xứ được ghi trong cùng metadata TIFF. Mọi độ trong suốt được làm phẳng trên nền trắng (hồ sơ này không mang kênh alpha). Giống TIFF CMYK, nó chỉ dùng trên máy tính để bàn, vì trình duyệt không thể xem trước TIFF và tải xuống trên di động sẽ vào ngõ cụt.
- **SVG**, **EMF**, **EPS** và **DXF** là các vector độc lập về độ phân giải và hồ sơ màu, không có hồ sơ nhúng - màu của SVG là sRGB thuần, của EMF và EPS là device RGB (và **EPS (CMYK)** ghi DeviceCMYK thuần) còn **DXF** mang AutoCAD Color Index gần nhất. (SVG, EPS và DXF, giống PDF, vẽ đường viền mọi văn bản thành path vector, nên kết quả vẫn hiển thị được ngay cả khi không cài phông chữ. EMF thì ngược lại, mặc định giữ văn bản SỐNG - các bản ghi văn bản metafile thật vẫn có thể chọn và chỉnh sửa được trong Office và Google Slides, chỉ chuyển về đường viền cho các đoạn định dạng không thể diễn đạt được; tùy chọn "Outline fonts" trong bảng xuất buộc dùng path ở mọi nơi.) **SVG** cũng tái hiện `box-shadow` CSS từ HTML - mỗi bóng đổ ngoài được vẽ phía sau hộp, có độ lệch/lan tỏa và làm mờ Gauss khớp với trình duyệt, còn bóng đổ trong (inset) được vẽ bên trong hộp theo cùng cách.

Việc này diễn ra tự động - không có thiết đặt nào để chỉnh. Ảnh thu nhỏ và bản xem trước bỏ qua nhãn để giữ dung lượng nhỏ. Một hồ sơ *là* một lựa chọn, vì nó thay đổi pixel chứ không chỉ gắn nhãn - xem **HDR** bên dưới.

## HDR (màu sáng)

Các bản xuất thông thường là sRGB: trắng là trắng, và một màu thương hiệu bão hòa cũng chỉ sáng bằng độ trắng bình thường của màn hình. Trên một màn hình hỗ trợ HDR, có rất nhiều dư địa sáng phía trên mức đó, và thẻ **HDR** trong bảng xuất tận dụng điều đó - màu thương hiệu và văn bản trắng của bạn được đẩy về phía độ sáng đỉnh để chúng thực sự *phát sáng*, trong khi vùng tối vẫn giữ tối để tạo độ tương phản cho ánh sáng đó.

![Thẻ HDR trong bảng xuất, đã bật, với các núm White / Reach / Dark lift / Focus hiện ra phía dưới](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Định dạng.** Các định dạng raster có chỗ để mang tín hiệu: **PNG**, **JPG**, **AVIF** và **TIFF**. (Không phải WebP - nó là 8-bit và không có đường giải mã HDR hoạt động, nên một WebP PQ sẽ chỉ trông tối đi. Vector và PDF hoàn toàn không có mô hình HDR.)
- **Tắt theo mặc định**, khác với gắn thẻ màu - nó thay đổi điểm ảnh, nên là tùy chọn tự bật. Tích vào thẻ, hoặc truyền `hdr=1` trong liên kết chia sẻ.
- **Những gì thực sự được ghi.** Điểm ảnh được mã hóa lại thành **Rec.2100 PQ** - dải màu gốc BT.2020 với đường cong truyền SMPTE ST 2084 (PQ) - và vùng chứa mang theo tín hiệu tương ứng để một ứng dụng có quản lý màu biết cách đọc chúng: một **hồ sơ ICC v4 kèm thẻ `cicp`** được tạo ra (JPG, TIFF), một **khối `cICP`** (PNG) hoặc một hộp `colr` được viết lại (AVIF). Độ tăng cường được điều khiển dựa trên **độ sáng cảm quan (OKLab)**, nên các màu ở mức trung bình trở lên được đẩy lên đỉnh còn màu tối được làm dịu thay vì bị cháy sáng, và nó giữ nguyên sắc độ - một màu xanh lá thương hiệu sẽ sáng hơn, không ngả sang màu bạc hà.
- **Các nút chỉnh.** Bốn nút, hiện ra khi thẻ được bật: **White** (trần độ sáng đỉnh, 400–2000 nit), **Reach** (độ tỏa xuống các sắc độ thấp hơn đến đâu), **Dark lift** (các vùng tối được làm sáng lên bao nhiêu - `0` giữ chúng tối) và **Focus** (độ phong phú màu sắc mà việc tăng cường giữ lại). Chúng đi cùng trong cùng một tham số như một giá trị đã tinh chỉnh ở dạng gọn - `hdr=1600-60-0-50` nghĩa là White 1600, Reach 60, Dark lift 0, Focus 50 - nên một hiệu ứng đã tinh chỉnh có thể tái lập được từ liên kết.
- **Nơi bạn sẽ thấy nó.** Các trình xem có quản lý màu trên màn hình HDR: Preview / Quick Look / Safari trên thiết bị Apple, Chrome trên màn hình HDR. Trên một màn hình SDR thông thường, tệp vẫn hiển thị như một hình ảnh bình thường.
- **Cần biết trước khi đăng tải.** Nhiều nền tảng **mã hóa lại** những gì bạn tải lên và loại bỏ tín hiệu HDR - mạng xã hội, ứng dụng nhắn tin, một số CMS - điều này có thể khiến hình ảnh trông tối hoặc nhạt màu. Hãy dùng HDR ở nơi bạn kiểm soát được điểm đến (một trang web bạn tự xây dựng, một màn hình video, một bản trình chiếu trên màn hình sáng), không phải như mặc định cho mọi thứ.
- **Trong suốt.** PNG và AVIF giữ kênh alpha; JPG luôn không trong suốt như thường lệ. Đường dẫn **TIFF** làm phẳng nền thành **đen**, không phải nền trắng như đường dẫn SDR - trong PQ, trắng là mã 10.000 nit, nên làm phẳng nền thành trắng sẽ tạo vầng sáng chói lóa quanh mọi cạnh.
- **Cùng những byte đó từ terminal.** `--hdr=1` cùng với `--export=png` hoặc `--export=jpg` ghi ra PNG Rec.2100 PQ 16-bit và JPEG gain-map ISO 21496-1 trên [CLI](/info/cli.html) cũng vậy, từ cùng bộ mã hóa của engine chứ không phải từ trình duyệt - nên một công cụ gốc `<svg>` tạo ra tệp HDR mà không có Chromium ở bất kỳ đâu trong đường dẫn, và tệp PNG giống hệt từng byte so với tệp của web shell. AVIF và TIFF hiện vẫn chỉ xuất được từ web shell.

## Video

Các công cụ hoạt hình xuất chuyển động dưới dạng **MP4**, **WebM** hoặc **GIF** - và, nếu có, **APNG**, **Animated WebP** hoặc **SVG hoạt hình** dạng vector (ở trên). Vùng chứa video nào bạn thấy phụ thuộc vào trình duyệt của bạn - bộ chọn chỉ hiển thị những gì nó thực sự có thể ghi lại được:

| Trình duyệt | Hiển thị |
|---|---|
| Safari / iOS | **MP4** |
| Firefox | **WebM** |
| Chrome / Edge 126+ / Android | **MP4 và WebM** |
| Chrome cũ hơn | **WebM** |

GIF hoạt động ở mọi nơi (rất phù hợp cho trò chuyện/email; dung lượng lớn hơn và ít màu hơn video). Các công cụ hoạt hình cũng cung cấp **Wait** (số giây để hoạt ảnh ổn định trước khi ghi) và **Duration** (độ dài đoạn clip).

> Một liên kết `?format=…` được chia sẻ yêu cầu một vùng chứa mà trình duyệt của bạn không thể ghi được sẽ tự động chuyển sang vùng chứa còn lại và đặt tên tệp tương ứng.

**Âm thanh.** Các bản xuất video không im lặng. Một công cụ có thể đặt một **nền nhạc** dưới đoạn clip - một tài sản âm thanh từ danh mục, được lặp hoặc cắt cho khớp độ dài clip, kèm hiệu ứng mờ dần vào/ra, âm lượng và tự động hạ âm lượng dưới âm thanh riêng của cảnh quay - và các công cụ ghi hình mang nguyên âm thanh trực tiếp của cảnh quay vào tệp. **MP4** và **WebM** giữ track âm thanh đã trộn; GIF và các định dạng ảnh hoạt hình (APNG, Animated WebP, Animated SVG) vốn dĩ không có âm thanh.

## Âm thanh

Một số công cụ xuất **âm thanh riêng**, không chỉ là một track trong video. **Voice Recorder** ghi lại giọng nói qua micro với đồng hồ đo mức tín hiệu trực tiếp và gợi ý nhẹ nhàng, sau đó lưu dưới dạng **MP3** (mặc định, được chuyển mã ngay trong trình duyệt của bạn) hoặc theo vùng chứa gốc của nó - **M4A** (AAC), **OGG** hoặc **WebM** (Opus), tùy vào định dạng trình duyệt của bạn ghi được. Cũng như mọi thứ khác, việc mã hóa diễn ra ngay trên thiết bị của bạn - không có gì được tải lên.

Âm thanh bạn *đưa vào* cũng đa dạng không kém. Bộ chọn tài sản chấp nhận **MP3**, **WAV**, **OGG**/**Opus**, **M4A**/**AAC** và **FLAC** (giữ nguyên byte và giải mã trên thiết bị), **MIDI** (`.mid` - được chuyển đổi khi nhập thành một track tổng hợp nhỏ gọn trên thiết bị) và **module tracker** - **MOD**, **XM**, **IT**, **S3M**, **STM**, **MTM** (giải mã trên thiết bị bởi một trình phát đi kèm, chỉ vài kilobyte dữ liệu nhạc). Bất kỳ tệp nào trong số này đều có thể trở thành **nền nhạc** dưới một bản xuất video, hoặc phát trong trình phát nền của Neurospicy Mode.

Âm thanh *là* một phần của quy trình `format=` / `--export=` bên dưới: `wav`, `mp3`, `m4a` và `opus` là các id định dạng bình thường, nên một bản xuất chỉ có âm thanh cũng dễ chia sẻ và dễ dùng bằng script như một PNG. Kết quả ra chỉ có âm thanh, không có hình ảnh.

## Xuất xứ & hình mờ

Ở nơi định dạng hỗ trợ, các bản xuất mang theo **siêu dữ liệu xuất xứ** - phần mềm, nguồn, tên công cụ và dòng ghi công trong hồ sơ của bạn - được nhúng theo cách tự nhiên của định dạng (PNG iTXt, JPEG EXIF, PDF info, `<metadata>` của SVG, comment của GIF). Đây chỉ là thông tin tác quyền; không có gì được tải lên. Các công cụ **Experimental** còn đóng thêm một hình mờ hiển thị được, do host áp dụng nên không thể bị xóa bằng cách chỉnh sửa công cụ.

**Lolly Imprint.** Các bản xuất raster còn mang theo **hình mờ pixel vô hình** riêng của Lolly - *Lolly Imprint* - **bật theo mặc định**, giống như Content Credentials. Trong khi thông tin xác thực và siêu dữ liệu xuất xứ đi kèm *bên cạnh* pixel và sẽ mất đi khi lưu lại, chụp màn hình hoặc xóa metadata, thì Imprint sống *bên trong* pixel và tồn tại qua việc nén lại - nên một bản sao của ảnh vẫn có thể được nhận diện là do Lolly tạo ra sau này. Đây là một dấu hiệu bền vững, không phải một đảm bảo mật mã học, và nó chỉ mang tính hiện diện (không chứa dữ liệu cá nhân nào). Nó có mặt trong **PNG, JPG, WebP, AVIF, TIFF và BMP**, và trong các ảnh raster do Lolly kết xuất được ghép vào một **PDF hoặc PPTX** - không bao giờ có trong một ảnh mà *bạn* đã nhúng vào, chỉ trong những gì chính Lolly kết xuất. Bỏ chọn thẻ **Lolly Imprint** trong bảng xuất để bỏ qua, hoặc truyền `imprint=0` trong một liên kết chia sẻ. (Khả năng tồn tại của AVIF qua việc mã hóa lại chưa được hiệu chỉnh; việc phát hiện trong PDF/PPTX chỉ bao phủ các ảnh raster do Lolly nhúng.) [/verify](/verify) phát hiện nó ngay trên thiết bị - xem [Content Credentials Identity](/info/content-credentials-identity.html#the-lolly-imprint).

**Thông tin xác thực bền vững.** Bên cạnh Imprint còn có một dấu thứ hai, nặng hơn: **Durable credential**, dùng một mô hình mạng nơ-ron trên thiết bị (định dạng TrustMark) để ghi id của Lolly *vào* pixel, để liên kết "làm bằng Lolly" tồn tại qua việc xóa metadata, mã hóa lại và được các công cụ nhận biết TrustMark đọc lại, cũng như chính Lolly. Nó **tắt theo mặc định** - khác với Imprint thuần JavaScript, nó tốn một lượt xử lý mạng nơ-ron cho mỗi lần xuất cộng thêm một lần tải mô hình duy nhất, nên đây là một lựa chọn bật thêm có chủ ý chứ không phải một khoản phí âm thầm. Chỉ dành cho raster (**PNG, JPG, WebP, AVIF, TIFF**), được tick trong bảng xuất hoặc truyền dưới dạng `durable=1` trong một liên kết chia sẻ. Trên các ứng dụng máy tính để bàn và di động, thẻ này bị ẩn hẳn thay vì hiển thị như một thao tác vô nghĩa, vì không có nguồn nào để tải mô hình khi ngoại tuyến.

**Bảo vệ nội dung.** Trong bảng xuất, *Password protect*, **C2PA Credentials**, **Lolly Imprint** và **Durable credential** gộp lại thành một nhóm **Content protection** thu gọn, tùy theo định dạng, để các tùy chọn xuất xứ và bảo vệ của một tệp nằm cùng một chỗ - nhóm này chỉ hiển thị các thẻ áp dụng được cho định dạng đã chọn, và tự ẩn hoàn toàn khi không thẻ nào áp dụng. Các dấu in cố tình *không* nằm trong đó: chúng là hình học sản xuất in ấn chứ không phải bảo vệ, nên **Print marks & bleed** - phép đo bleed theo milimét cùng Crop, Registration, Bleed, Colour bars và Stamp details - vẫn giữ thẻ cấp cao nhất riêng trên các định dạng in.

![Nhóm Content protection được mở trên một bản xuất PNG, chỉ hiển thị các thẻ áp dụng được cho nó](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

**Trước khi xuất (kiểm tra tiền chế bản in).** Bật **Print preflight** (`export-preflight`) trong cờ tính năng thuộc Hồ sơ của bạn - mặc định là **tắt**, để một cá nhân xuất một PNG cho tin nhắn trò chuyện không bao giờ bị bất ngờ bởi các phát hiện tiền chế bản in, và mặt bằng điều khiển của một triển khai ([lolly.work](https://lolly.work)) có thể đặt mặc định bật cho thành viên của mình - và một thẻ **Before you export** xuất hiện ở cuối bảng, ngay phía trên các nút bấm, bất cứ khi nào các quy tắc in có điều gì đúng để nói về công việc: định dạng, kích thước và bleed, rồi đến vùng trim và bleed, độ phủ mực, số lượng bản kẽm và số trang, kèm một kết luận bên cạnh tiêu đề của nó. Nó nằm dưới mọi thiết đặt vì đó là một phát biểu *về* các thiết đặt đó chứ không phải là một thiết đặt khác - và nó không bao giờ chặn việc xuất. Nó cho bạn biết một nhà in sắp nhìn thấy điều gì.

**Chi phí, tính toán từ bảng giá của bạn.** Bên dưới phần preflight - cuối cùng, vẫn phía trên các nút bấm - là một thẻ chuyển những con số đếm đó thành tiền, và chỉ luôn từ mức giá do ai đó cung cấp. Nó đọc bất cứ thứ gì bước preflight đã đếm được, dù thẻ preflight có được bật hay không, và nó cần hai điều đúng cùng lúc: công việc có thứ gì đó mà một bảng giá có thể định giá được (bản kẽm, tờ in, diện tích, số trang, các dòng biến thể hoặc tệp đầu ra - nên một PNG logo đơn giản sẽ không bao giờ hiển thị nó), **và** có một **bảng giá** (rate card) hiện diện. Một bảng giá là danh sách giá dạng JSON từ nhà in của bạn. Một bản dựng mặc định không mang theo bảng giá nào và không có cách nào trong ứng dụng để nạp một bảng: nó chỉ đến dưới dạng một tài sản danh mục mà một triển khai cung cấp, hoặc qua tiện ích mở rộng bảng giá tùy chọn mà một người tự lưu trữ hoặc mặt bằng điều khiển bật lên. Không có bảng giá, không có gì được hiển thị - không lời nhắc, không bảng trống.

Quy tắc mà toàn bộ tính năng này được xây dựng dựa trên là **nó không bao giờ bịa ra tiền**. Mỗi con số là một mức giá bạn cung cấp nhân với một số lượng Lolly đã đếm - `4 plate × €35.00` - và tổng số nêu rõ nguồn của chính nó ngay trong cùng câu với con số: nhà cung cấp mà bảng giá nêu tên, và ngày mà bảng giá nói mức giá của nó áp dụng từ đó. Không có đơn vị tiền tệ mặc định, không có giá trị giữ chỗ và không có số 0 nào thay thế cho một mức giá bị thiếu. Những gì tệp tự nói về chính nó vẫn luôn được thuật lại như lời trích dẫn: *"The file says: … Lolly has not verified this."*

Và khi không thể tính toán một cách trung thực, bảng làm việc **biến mất** thay vì suy giảm thành một con số xám mờ hoặc điền ẩu:

- Các dòng mà bảng giá không định giá được nghĩa là **không có tổng số nào cả** - chỉ có một dòng tiêu đề nói có bao nhiêu dòng chưa được định giá. Một tổng số một phần không phải là một câu trả lời nhỏ hơn, mà là một câu trả lời sai.
- Một số lượng là một giới hạn trên chứ không phải một con số chính xác sẽ mang theo **"up to"** vào tổng phụ của nó, để một giới hạn không bao giờ bị biến thành một con số cố định.
- Các mức giá đã quá hạn hiệu lực chỉ hiển thị **số lượng**, cho đến khi bạn nhấn *Use these rates anyway* - và khi đó ngày hết hạn sẽ đi kèm con số, để một tổng số đã lỗi thời không thể bị đọc như một tổng số hiện hành.
- Khi mở qua một **liên kết**, tiền vẫn ẩn cho đến khi bạn yêu cầu xem trên thiết bị này. Cả thẻ lẫn thao tác hiển thị đó không bao giờ đi theo một URL - cùng lý do mà CLI nhận `--rate-card=<file.json>` như một cờ tệp cục bộ chứ không bao giờ như một tham số liên kết.

Thẻ này là chrome, không bao giờ là nội dung: nó bị loại bỏ khỏi mọi bước xuất tệp, nên không thể làm dịch chuyển một pixel nào của tệp bạn tải xuống. Và đó là phép tính số học, không phải một báo giá - chỉ nhà in của bạn mới có thể cho bạn một báo giá thực sự.

**Bản kết xuất được ghép.** Khi một công cụ nhúng đầu ra của một công cụ khác (ví dụ một *Event Name Badge* nhúng một *QR Code*), bản kết xuất lồng bên trong được nội tuyến vào bản xuất của công cụ cha - nó vẫn là **vector thật** trong SVG và PDF, và được raster hóa sắc nét trong PNG/JPG/WebP. Thành phần con được nhúng chỉ là bước trung gian: nó *không* có hình mờ và *không* có xuất xứ riêng; chỉ tài sản hoàn thiện của công cụ cha mới có. (Ghép chỉ áp dụng cho SVG và các định dạng raster; HTML/MD/TXT không thể được ghép.)

## Bảo vệ bằng mật khẩu

Hai loại khóa độc lập, đều hoàn toàn trên thiết bị.

**PDF open-password** - thẻ *Password protect* (Bảo vệ bằng mật khẩu) trong bảng xuất cung cấp hai cấp độ:

![Thẻ Password protect được mở rộng trên một bản xuất PDF, với trường mật khẩu và hai cấp khóa](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

- **Standard** - một khóa cơ bản 40-bit (RC4). Nó mở được trong *bất kỳ* ứng dụng PDF nào, và - vì chỉ là một biện pháp răn đe nhẹ, không phải bảo vệ thực sự - nó có thể xuất hiện trong liên kết chia sẻ (dạng văn bản rõ, có chủ đích). Chỉ áp dụng cho `pdf` RGB.
- **Strong** - AES-256 (PDF 2.0). Mật khẩu được nhập khi xuất và **không bao giờ** được đặt vào liên kết; nó chỉ mở được trong các ứng dụng PDF mới hơn (Acrobat / Preview từ khoảng 2018 trở đi), và các ứng dụng cũ hơn có thể báo file bị hỏng. Strong cũng áp dụng cho **PDF Print / CMYK** và cho **từng PDF bên trong một zip hàng loạt** (hộp thoại xác nhận hàng loạt sẽ thu thập mật khẩu). Vì PDF/X-4 cấm mã hóa, một PDF Print bị khóa bằng Strong vẫn giữ CMYK, dấu cắt và output-intent nhưng mất tuyên bố tuân thủ PDF/X-4.

Cả hai cấp độ đều loại trừ lẫn nhau với Content Credentials (một PDF được mã hóa không thể mang chứng nhận).

**Tải xuống có khóa (toàn bộ zip + phòng thủ theo chiều sâu)** - một bản xuất **ZIP** (định dạng *ZIP* trong bảng xuất, gộp nhiều định dạng của một công cụ), một lượt tải **thư mục** (Projects → Download) hoặc **lưới hàng loạt** đều có thể khóa toàn bộ zip bằng một mật khẩu, ở hai cấp độ:

- **Standard** - **ZipCrypto** truyền thống: mở được trong *bất kỳ* công cụ giải nén nào kể cả tính năng giải nén tích hợp của Windows Explorer, nhưng yếu (chỉ mang tính răn đe). Mật khẩu của nó có thể xuất hiện trong liên kết chia sẻ `?password=`.
- **Strong** - **AES-256** (WinZip AE-2): mạnh, nhưng **không** mở được bằng tính năng giải nén tích hợp của Windows Explorer - người nhận cần 7-Zip / WinZip / Keka / macOS. Được nhập khi xuất, không bao giờ đặt vào liên kết.

Cùng một thẻ *Password protect* (Bảo vệ bằng mật khẩu) trong bảng xuất điều khiển cả khóa PDF lẫn khóa ZIP, tự đổi cách diễn đạt tùy theo định dạng được chọn. Một mật khẩu duy nhất bảo vệ **mọi** thành phần - hình ảnh, SVG, tất cả, kể cả PDF (chỉ có container zip mới bảo vệ được các file không phải PDF, vốn không có khóa riêng). Và đây là **phòng thủ theo chiều sâu**: bất kỳ PDF nào bên trong *cũng* được khóa AES-256 riêng bằng cùng mật khẩu, nên một PDF vẫn bị khóa ngay cả sau khi zip được giải nén. Hộp thoại xuất hiện khi bạn bắt đầu tải xuống; để trống mật khẩu nghĩa là không khóa.

**Liên kết chia sẻ có mật khẩu** - bất kỳ liên kết chia sẻ nào cũng có thể được mã hóa sao cho khi mở, người nhận phải nhập mật khẩu. Toàn bộ trạng thái liên kết được mã hóa AES-256 bằng khóa suy ra từ mật khẩu (PBKDF2); chỉ có bản mã được truyền đi, nên **mật khẩu không bao giờ nằm trong liên kết** và việc giải mã diễn ra **ngay trên trình duyệt của người nhận** - máy chủ phục vụ liên kết chỉ thấy bản mã trong URL, không bao giờ thấy mật khẩu và không bao giờ thấy thiết kế đã giải mã. Bật tính năng này trong hộp thoại **Share** (Chia sẻ). Một liên kết đã mã hóa chỉ có thể *mở* được trong Lolly (không thể nhúng như một hình ảnh, vì đường dẫn đó không thể hiện hộp thoại nhập mật khẩu). Xem [URL Mode → Encrypted links](/info/url-mode.html).

## Content Credentials (C2PA)

Các bản xuất có thể mang **Content Credentials** - một manifest [C2PA](https://c2pa.org) đã ký được nhúng vào file, ghi lại theo cách chống giả mạo rằng file được tạo bằng Lolly và chưa bị thay đổi kể từ đó. Đây là phiên bản theo chuẩn hóa của siêu dữ liệu nguồn gốc nói trên: một tuyên bố mật mã học (cái gì tạo ra file, khi nào, bởi ai và ở đâu) được gắn với hash của các byte trong file, nên bất kỳ chỉnh sửa nào sau đó đều có thể bị phát hiện bởi trình xem hỗ trợ C2PA. Chuẩn này do [Content Authenticity Initiative](https://contentauthenticity.org) (Adobe, BBC, Microsoft, Nikon và những hãng khác) quản lý, vì vậy các chứng nhận mà Lolly ghi cũng chính là loại mà máy ảnh, tòa soạn và bộ công cụ sáng tạo đang áp dụng.

![Thẻ C2PA Credentials, đã được tích sẵn, với thời hạn chứng nhận bên cạnh](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Định dạng.** Mọi container hỗ trợ nhúng C2PA: **PDF** (cả RGB và Print), **PNG / Animated PNG**, **JPG**, **GIF**, **SVG**, **TIFF** (RGB và Print), **WebP** (tĩnh và động), **AVIF**, **MP4**, **WebM** và các container âm thanh **MP3**, **WAV**, **M4A** và **OGG/Opus** - vì vậy một đoạn ghi âm hoặc giọng nói tổng hợp cũng mang cùng chứng nhận như một bức ảnh. Một gói **ZIP** đóng dấu riêng cho từng thành phần được hỗ trợ, và đây cũng là nơi một **Animated SVG** nhận được chứng nhận (bên trong nó chỉ là một tài liệu SVG thông thường; bản xuất Animated SVG trực tiếp không có thẻ riêng). MP4, AVIF và M4A dùng liên kết BMFF của chuẩn còn MP3 dùng ánh xạ ID3v2, nên `c2patool` và các trình xem hỗ trợ C2PA khác xác minh được chúng; **WebM** và **OGG/Opus** chưa có ánh xạ C2PA chuẩn hóa, nên Lolly mang manifest dưới dạng tệp đính kèm Matroska và trường OpusTags tương ứng, được chính trình xác minh (và CLI) của Lolly kiểm tra. (`ico`, `eps`, `emf`, `dxf`, `bmp`, `pptx`, các định dạng Office và các định dạng văn bản/dữ liệu không có container C2PA.)
- **Bật theo mặc định.** Thẻ **C2PA Credentials** trong bảng xuất được chọn sẵn cho gần như mọi công cụ - bỏ chọn để bỏ qua chứng nhận cho một lần xuất riêng lẻ (hoặc truyền `c2pa=off` trong liên kết chia sẻ). Một công cụ có thể từ chối hoàn toàn trong manifest của nó.
- **Những gì được ghi lại.** Công cụ và ứng dụng đã tạo file, thời điểm ký, môi trường xuất (họ engine trình duyệt + họ hệ điều hành - cố tình chỉ ở mức thô, không bao giờ là dấu vân tay) và - chỉ khi *Profile → Use my details* được bật - tên và email của bạn với tư cách tác giả tác phẩm.
- **Những gì người nhận thấy.** Các công cụ kiểm tra content credentials (ứng dụng Adobe, `c2patool`, contentcredentials.org/verify) sẽ đọc manifest và hiển thị tuyên bố. Vì Lolly ký bằng một khóa được tạo **ngay trên thiết bị của bạn** - không phải chứng chỉ từ danh sách tin cậy - các trình xem sẽ báo đây là chứng nhận *chưa được xác minh*. Cấu trúc và bằng chứng chống giả mạo là có thật; chỉ có danh tính người ký là chưa được một tổ chức xác thực bảo chứng. Để nâng cấp điều đó, bạn có thể đăng ký một **danh tính đã xác minh** (Profile → Content Credentials): một chứng chỉ ngắn hạn từ Lolly CA gắn email của bạn với các bản xuất trong khi khóa ký vẫn không bao giờ rời khỏi thiết bị của bạn - xem [Content Credentials Identity](/info/content-credentials-identity.html).
- **Kiểm tra một file.** Lolly cũng xác minh chứng nhận của chính mình: thả bất kỳ file nào vào [/verify](/verify) (hoặc chạy `lolly validate <file>` trong CLI) để nhận báo cáo trên thiết bị - nổi bật là việc file có thực sự được tạo bằng Lolly và chưa bị thay đổi kể từ đó hay không. Giao diện Verify trên web đọc được nhiều hơn cả chứng nhận: nó gắn cờ **nội dung do AI tạo**, phát hiện **Lolly Imprint**, kiểm tra chữ ký **SEAL** và (tùy chọn) watermark pixel của bên thứ ba, đồng thời phát hiện **dữ liệu ẩn** - tất cả đều trên thiết bị, không tải lên đâu cả. Xem [Content Credentials Identity → Beyond the credential](/info/content-credentials-identity.html#beyond-the-credential-what-else-verify-shows).
- **Quyền riêng tư.** Mọi thứ diễn ra trên thiết bị của bạn: khóa ký được tạo riêng cho lần xuất đó và không bao giờ rời khỏi trình duyệt, không có gì được tải lên và tuyên bố chỉ chứa những gì siêu dữ liệu nguồn gốc đã có sẵn. Các tiện ích quyền riêng tư (biến đổi trên thiết bị đối với *chính* file của bạn) không bao giờ thêm chứng nhận, và *Strip Hidden Data* sẽ xóa manifest C2PA giống như bất kỳ siêu dữ liệu nhúng nào khác.
- **Tương tác.** Đối với PDF, Content Credentials và **bảo vệ bằng mật khẩu** (ở cấp độ nào - xem ở trên) loại trừ lẫn nhau (một PDF đã mã hóa không thể mang tệp đính kèm chứng nhận). Chứng nhận được thêm vào như bước cuối cùng trên các byte đã hoàn thiện - sau khi đóng dấu DPI/EXIF/hồ sơ màu, siêu dữ liệu PDF/X và dấu in.

## Trên điện thoại

Các điều khiển xuất nằm sau nút **Render** nổi, mở ra bảng **Export** (Xuất) - cùng các định dạng, kích thước, sao chép, tải xuống và chia sẻ, được tối ưu cho thao tác chạm.

## Tham chiếu định dạng

Mọi id mà host có thể render, được nhóm lại. Đây cũng chính là các giá trị cho tham số URL `format=` và cờ CLI `--export=` - xem [URL Mode](/info/url-mode.html) và [CLI](/info/cli.html). Một công cụ chỉ cung cấp tập con mà tác giả của nó khai báo, nên bộ chọn luôn ngắn hơn danh sách này.

| Loại | Id |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vector | `svg` · `svgz` (SVG nén gzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (tệp cắt) |
| Trang & tài liệu | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `scorm` (gói khóa học SCORM, một tệp zip) · `penpot` (tệp thiết kế Penpot) · `docx` (Word) · `odt` (OpenDocument Text) |
| Chuyển động | `gif` · `apng` (PNG hoạt hình) · `webp-anim` (WebP hoạt hình) · `svg-anim` (SVG hoạt hình) · `webm` · `mp4` |
| Âm thanh | `wav` · `mp3` · `m4a` · `opus` |
| Văn bản & dữ liệu | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `css` · `scss` · `gpl` (bảng màu GIMP) |
| Gói | `zip` |

Một vài id khác đến từ **hook xuất riêng của công cụ** thay vì đường dẫn render dùng chung: `ase` (Adobe Swatch Exchange, từ Palette Lab), `exr` và `hdr` (các raster dải động cao của Darkroom) và `ttf` / `otf` / `woff` (Font Convert). Chúng chọn định dạng theo cùng cách - bộ chọn, `format=`, `--export=` - chỉ là các byte được xây dựng bởi chính công cụ. Font Convert là ngoại lệ duy nhất: nó biến đổi một file font *do bạn* cung cấp, nên không có gì để một URL trần render cả.
