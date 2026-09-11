# Hồ sơ - bạn là ai khi bạn tạo

Một **profile** là danh tính làm việc mà Lolly tạo ra *dưới tư cách*. Đó là tập hợp nhỏ các chi tiết mà một công cụ có thể lấy ra để bạn không phải gõ lại mỗi lần - tên bạn, thông tin liên hệ, một ảnh chân dung tùy chọn, vài tùy chỉnh - cộng với mọi thứ bạn tích lũy trong khi làm việc: các phiên đã lưu, ảnh đã tải lên và số liệu hoạt động cục bộ.

Mọi thứ trong hồ sơ đều nằm **trên thiết bị**, trong cơ sở dữ liệu cục bộ của trình duyệt (IndexedDB trên web PWA, hệ thống tệp trên các ứng dụng Tauri). Không có tài khoản nào và không có gì được tải lên. Bạn quản lý nó trong mục **Hồ sơ** (góc trên bên phải của thư viện); các công cụ chỉ *đọc* nó, và chỉ những trường cụ thể mà chúng được xây dựng để điền sẵn.

> Một profile nói về *bạn* (hoặc bất kỳ ai đang tạo ở đây). Nó khác với **Platform** - màu sắc, font và cài đặt toàn cục của thương hiệu - và khác với **Capabilities**, danh mục những gì ứng dụng có thể làm. Xem [Profile vs Platform vs Capabilities](#profile-vs-platform-vs-capabilities) ở cuối.

## Những gì có trong hồ sơ

| Phần | Là gì |
|---|---|
| **Name** | Họ và tên. |
| **Contact** | Email và số điện thoại. |
| **Location** | Thành phố và quốc gia. |
| **Headshot** | Một ảnh tùy chọn, cắt thành hình vuông và giữ như một ảnh cục bộ. Được các công cụ như chữ ký email, thẻ trích dẫn, sơ đồ tổ chức và bố cục động sử dụng. |
| **Use my details to create** | Một công tắc opt-in duy nhất (nó hiển thị **Using my details** khi đã bật). Nó quyết định thông tin cá nhân của bạn có đi kèm dưới dạng **nguồn gốc** hay không - dòng tác giả/ghi công được nhúng trong file xuất - và làm tác giả trong các lượt chạy hàng loạt trên **/pro**. (Nó không kiểm soát việc điền sẵn: xem [How tools use your profile](#how-tools-use-your-profile).) |
| **Preferences** | Chủ đề của bạn (Light, Dark hoặc Brand - chủ đề brand tô ứng dụng bằng chính bảng màu của bạn) và những phần nào của ứng dụng bạn đã bật qua **Feature flags**. |
| **Accessibility** | Bốn công tắc tiện nghi - *Reduce motion*, *Hide colourful previews*, *High contrast*, *Large text* - được giữ trên bản ghi profile, nên chúng đi kèm khi xuất profile. Xem [Accessibility](#accessibility). |
| **Your work** | Các phiên đã lưu (kèm ảnh thu nhỏ) - được tổ chức thành các thư mục lồng nhau trong **[Projects](/info/using.html)** - thư viện **My images** của bạn và số liệu thống kê hoạt động cục bộ, tất cả đều gắn với profile này. |

![Three theme cards, each previewing its own type and colour, with the active one flagged](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

![Màn hình Profile - tên, liên hệ, một ảnh chân dung tùy chọn và các tùy chỉnh của bạn](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

Không có mục nào là bắt buộc. Một hồ sơ trống vẫn là một hồ sơ hoàn toàn tốt; bạn chỉ cần điền những gì giúp bạn đỡ phải gõ lại.

Trang này khá dài, nên nó có riêng một **thanh cài đặt** dọc theo cạnh - Your details, Appearance, Accessibility, Lolly instance, Your activity, Storage, Available offline, Feature flags, Content Credentials - cùng một ô **Search settings** phía trên lọc danh sách khi bạn gõ. Mỗi mục đều có thể liên kết trực tiếp dưới dạng `#/profile?focus=<section-id>`, việc này sẽ mở nó và cuộn nó vào tầm nhìn (`#/profile?focus=storage-section`, `?focus=feature-flags-section`, v.v.), nên một link có thể trỏ tới một cài đặt cụ thể thay vì đầu trang.

![Ba thẻ chủ đề, mỗi thẻ xem trước kiểu chữ và màu sắc riêng, với thẻ đang hoạt động được đánh dấu](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

## Hồ sơ là một bối cảnh, không chỉ là một con người

Từ "hồ sơ" gợi ý một con người cố định duy nhất, nhưng trong Lolly nó thực sự là một **bối cảnh sáng tạo** - *bạn là ai trong khi bạn tạo ra thứ này*. Bối cảnh đó có thể có ba hình thái khác nhau, và Lolly xử lý tất cả chúng theo cùng một cách.

### Với tư cách cá nhân

![The headshot control, empty until you upload a photo that then stays on this device](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

![Công cụ ảnh chân dung, trống cho tới khi bạn tải lên một ảnh rồi ảnh đó ở lại trên thiết bị này](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

### Với tư cách một nhóm

Một profile không nhất thiết phải là một cá nhân. Nó có thể đại diện cho một **nhóm hoặc chức năng trong một tổ chức**: tên chung của nhóm, một địa chỉ hộp thư chung (`events@…`), một phòng ban, ảnh chân dung hoặc biểu tượng của nhóm. Một người thiết lập nó, xuất nó ra (xem bên dưới) và phần còn lại của nhóm nạp cùng một profile - để mọi thứ nhóm tạo ra đều mang thông tin nhất quán mà không ai phải nhập lại. Một kiosk dùng chung hoặc một laptop demo cho mượn có thể chạy một profile nhóm duy nhất mà mọi người đứng sau nó cùng tạo bằng.

### Với tư cách một chức năng - một vai trò bạn khoác lên đôi khi

Đây là trường hợp mà mô hình cứng nhắc "một người, một hồ sơ" bỏ sót. Bạn có thể là một **quản lý sự kiện ba ngày trong năm** và hoàn toàn là người khác trong suốt thời gian còn lại. Ba ngày đó bạn muốn có thông tin sự kiện, hộp thư sự kiện, có thể là một thương hiệu phụ của sự kiện để điền vào huy hiệu và biển chỉ dẫn của bạn; 362 ngày còn lại bạn muốn lấy lại danh tính bình thường của mình.

Trong Lolly, vai trò đó chỉ đơn giản là **một hồ sơ khác mà bạn luôn có sẵn** - một gói đã lưu (phần tiếp theo) mà bạn nạp vào cho sự kiện rồi cất đi sau đó. Vai trò đó là một chiếc mũ, không phải một tài khoản mới. Đội nó lên khi bạn cần, bỏ nó xuống khi bạn xong việc.

## Một bản cài đặt, một hồ sơ đang hoạt động - nhiều hồ sơ bạn có thể giữ

Tại mọi thời điểm, một bản cài đặt chỉ có **một profile đang hoạt động** - những thông tin mà một công cụ nhìn thấy ngay lúc này. Không có bộ chuyển profile trong ứng dụng; thay vào đó, mỗi profile là một **gói di động** (một file `.zip` duy nhất, xem [bên dưới](#moving-a-profile-to-a-new-device)). Đó là cơ chế cố ý giống hệt việc chuyển sang thiết bị mới - một profile là một file bạn có thể lưu, sao chép và nạp lại.

![The storage meter, breaking down saved sessions, images and cache against what the browser actually reports](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

- <!--i:trash--> **Cách chuyển sạch nhất:** **Profile → Storage → Clear all my data**, sau đó **Import** gói cho ngữ cảnh bạn đang bước vào. Giờ bạn đang tạo hoàn toàn với tư cách profile đó.
- <!--i:layers--> **Xếp lớp:** import mà *không* xóa trước sẽ **hợp nhất** - profile, phiên và ảnh được import chồng lên những gì đã có sẵn, thay thế bất kỳ thứ gì trùng tên và giữ nguyên phần còn lại. Tiện khi kéo các phiên đã lưu của một nhóm vào bộ thiết lập của riêng bạn; không phải điều bạn muốn nếu cần một ranh giới vai trò sạch sẽ.
- <!--i:monitor--> **Song song:** vì mọi thứ đều giới hạn theo thiết bị, một profile trình duyệt riêng, một tài khoản người dùng riêng hay một PWA cài đặt thứ hai đều mang một profile Lolly độc lập của riêng nó. Chạy bản cài đặt cá nhân của bạn và bản cài đặt kiosk sự kiện cùng lúc, không cần chuyển đổi.

Vì vậy nếu bạn thực sự phải xoay sở giữa nhiều bối cảnh (bạn, nhóm của bạn, chiếc mũ quản lý sự kiện), bạn giữ nhiều gói và nạp gói bạn cần:

![Đồng hồ đo dung lượng lưu trữ, phân tách các phiên đã lưu, ảnh và cache so với những gì trình duyệt thực sự báo cáo](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

> Giữ một gói cho mỗi bối cảnh và đổi tên tệp theo đúng nội dung của chúng (`LollyTools-events-2026.zip`, `LollyTools-me.zip`). Tệp đó *chính là* hồ sơ.

## Accessibility

**Profile → Accessibility** chứa bốn cài đặt tiện nghi cho ứng dụng *xung quanh* công việc của bạn. Mỗi cài đặt đều tắt cho tới khi bạn bật nó, và không cái nào chạm vào bên trong canvas công cụ hay bản xuất - một ứng dụng dịu hơn không được phép làm xê dịch dù chỉ một pixel của file bạn gửi đi.

- <!--i:film--> **Reduce motion** - tắt các hiệu ứng chuyển cảnh, trượt và điểm nhấn hoạt hình trong ứng dụng. Canvas công cụ của bạn và bất kỳ bản xuất hoạt hình nào vẫn chuyển động đúng như thiết kế.
- <!--i:image--> **Hide colourful previews** - thay hình minh họa xem trước trong gallery bằng các thẻ icon-và-chữ trầm lặng, và giảm màu sắc, độ tương phản của ảnh thu nhỏ dự án để chúng vẫn nhận ra được mà không gây chói mắt. Bên trong một công cụ, mọi thứ vẫn hiển thị đầy đủ màu sắc.
- <!--i:sliders--> **High contrast** - làm đậm viền, chữ và vòng lấy nét của ứng dụng. Màu thương hiệu của bạn và mọi thứ trên canvas vẫn giữ nguyên như bạn đã đặt.
- <!--i:font--> **Large text** - phóng to kiểu chữ của ứng dụng: nhãn, menu và chữ trên nút. Các control giữ nguyên kích thước, nên chỉ chữ bên trong chúng lớn hơn, còn kiểu chữ trong thiết kế của bạn không bị đụng tới, nên không có gì bạn xuất ra bị dàn lại.

Những cài đặt này nằm ngay trên bản ghi profile, đó là lý do chúng đi theo khi xuất profile và xuất hiện trên bản cài đặt tiếp theo cùng với tên và các phiên của bạn. (Thiết bị cũng giữ một bản sao cục bộ nhỏ để cài đặt được áp dụng trước lần vẽ đầu tiên; bản sao đó chỉ tồn tại trên thiết bị và không đi theo.)

## Instance Lolly của bạn

**Profile → Lolly instance** cho biết bản cài đặt này lấy công cụ và catalog từ đâu - địa chỉ của instance, hoặc *Bundled with this app* khi mọi thứ đi kèm sẵn trong bản build. Ở nơi một bản triển khai có cung cấp, một link **Instance console** sẽ mở giao diện quản trị của nó, và **Change** / **Disconnect** trỏ lại bản cài đặt hoặc ngắt kết nối nó.

Trỏ lại một instance khác cần **ứng dụng desktop**: trình duyệt chặn một trang tải công cụ và tài sản từ nguồn gốc khác, nên trên web mục này chỉ báo cáo bạn đang ở đâu và dừng lại ở đó.

## Available offline

Lolly lưu cache khi bạn dùng, nhưng lưu cache-khi-dùng chỉ bao phủ những nơi bạn đã từng đến. **Profile → Available offline** dành cho chuyến đi bạn có thể thấy trước: một giờ dùng wifi sân bay trước một chuyến bay không có mạng. Tải về những phần bạn sẽ cần, theo dõi một thanh tiến trình, và mọi thứ bạn đã tải vẫn hoạt động khi mất kết nối.

Bảy phần, mỗi phần đều nêu rõ dung lượng trước khi bạn xác nhận:

- <!--i:layout--> **The app** - mọi view, trình soạn thảo và font, kể cả những cái bạn chưa mở. Thiếu cái này, một màn hình bạn chưa từng ghé qua khi online sẽ không tải được offline.
- <!--i:image--> **Catalogue** - tài sản thương hiệu ngoài những thứ thiết yếu. Lấy tất cả, hoặc mở *Choose by tag* và chỉ lấy các tag bạn dùng.
- <!--i:book--> **Guides & docs** - trang tài liệu này, bằng ngôn ngữ của bạn, kèm cả ảnh chụp màn hình.
- <!--i:cpu--> **Speech voices** - các mô hình giọng nói đằng sau âm thanh và lời dẫn của Script. Tải về một lần, sau đó chạy trên thiết bị.
- <!--i:zap--> **Upscaling models** - các bộ nâng cấp ảnh bằng AI: ảnh chụp, minh họa/anime và khuôn mặt.
- <!--i:layers--> **Background removal** - các mô hình tách nền trên thiết bị đằng sau *Remove background*.
- <!--i:shield--> **Verify deep scan** - trình quét watermark trên thiết bị, để kiểm tra Content Credentials khi không có kết nối.

Bốn mục cuối được đánh dấu **large download**, và chúng cố tình là các tùy chọn đăng ký riêng lẻ: **Download everything** ở trên cùng tải ứng dụng, phạm vi danh mục bạn đã chọn, tài liệu và tất cả công cụ trong một lượt và không gì khác. Speech voices, các bộ upscaler, xóa nền và deep scan mỗi thứ chỉ tải xuống khi bạn yêu cầu đúng hàng đó theo tên - vài trăm megabyte ẩn bên trong một nút bấm sẽ là không trung thực.

Bên dưới các phần này là danh sách theo từng công cụ: mỗi công cụ tải xuống riêng lẻ (dấu tích nghĩa là đã sẵn sàng offline), hoặc **Download all** tải toàn bộ một lượt. Các lượt tải có thể tiếp tục dở dang - hủy hoặc mất kết nối thì lần chạy tiếp theo sẽ tiếp tục từ chỗ dừng, chỉ lấy phần còn thiếu - và chúng tự làm mới khi bạn online trở lại, chỉ lấy đúng phần mà bản phát hành mới đã thay đổi.

Nếu trình duyệt chưa cấp quyền lưu trữ lâu dài (persistent storage), phần này sẽ báo rõ điều đó và hiển thị nút **Protect downloads** để yêu cầu quyền đó - khác biệt giữa "đã tải xuống" và "đã tải xuống cho đến khi trình duyệt cần lấy lại dung lượng".

## Chuyển hồ sơ sang thiết bị mới

![The two buttons that move a whole install: Export my data writes one zip, Import data reads it back](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Vì hồ sơ hoàn toàn cục bộ, cách duy nhất để đưa nó vào một bản cài đặt trống - một laptop mới, một trình duyệt vừa được đặt lại, máy của đồng nghiệp, một thiết bị ngoại tuyến - là **mang theo tệp**. Không có đăng nhập nào khôi phục nó giúp bạn, và đó chính là mấu chốt: ngay từ đầu chưa từng có gì rời khỏi thiết bị của bạn.

- <!--i:download--> **Export my data** tải xuống một tệp `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` - đặt tên theo hồ sơ mà nó thuộc về, kèm số thứ tự theo ngày để các lần export lặp lại không bị trùng (các phần tên bị bỏ qua khi hồ sơ không có chúng). Tệp này chứa hồ sơ của bạn, mọi phiên đã lưu (kèm ảnh thu nhỏ), ảnh bạn đã tải lên - token thương hiệu và font đã cài đặt đi kèm dưới dạng tài sản người dùng - và các tùy chọn của bạn (giao diện, bố cục, số liệu hoạt động cục bộ).
- <!--i:upload--> **Import data…** trên máy cài đặt khác sẽ đọc lại tệp đó và bạn tiếp tục đúng từ chỗ đã dừng.
- <!--i:box--> **Export my data & render everything** ghi ra cùng bản sao lưu đó *cộng thêm* một tệp zip thứ hai render mọi phiên đã lưu thành tệp kết quả hoàn chỉnh, trong các thư mục phản chiếu Projects của bạn. Một kho lưu trữ offline đầy đủ gồm cả nguồn lẫn kết quả - và có thể lớn và chậm nếu có nhiều phiên.

![Hai nút di chuyển toàn bộ bản cài đặt: Export my data ghi ra một tệp zip, Import data đọc lại tệp đó](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Gói này là một tệp zip đơn giản, tự chứa toàn bộ, nên nó có thể di chuyển bằng **bất kỳ** phương tiện nào - USB, AirDrop, một ổ mạng chia sẻ, tự gửi email cho chính mình - và đích đến có thể hoàn toàn ngoại tuyến. Mỗi phần đều được tính checksum, nên một tệp bị hỏng trong quá trình truyền sẽ bị phát hiện khi nhập vào thay vì được khôi phục ở trạng thái hỏng dở dang. Việc nhập sẽ **hợp nhất** (hồ sơ/phiên/hình ảnh trùng tên sẽ bị ghi đè; mọi thứ khác được giữ nguyên), nên nó không bao giờ xóa sạch một đích đến đang được sử dụng.

Những gì không được mang theo: bộ nhớ đệm danh mục (nó sẽ tự tải lại trên thiết bị mới) và bản thân các công cụ (được giả định là đã có sẵn).

Để biết bố cục gói chính xác, chính sách phiên bản và quy tắc toàn vẹn dữ liệu, xem **[Data Transfer](/info/data-transfer.html)**; để xem hướng dẫn từng bước đầy đủ, xem **[Using Lolly → Moving to another device](/info/using.html#moving-to-another-device)**.

## Cách các công cụ sử dụng hồ sơ của bạn

![The single Use my details switch, sitting beside Save Profile and off until you turn it on](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

Một công cụ chỉ bao giờ *điền sẵn* những trường hồ sơ mà nó được xây dựng rõ ràng để liên kết:

**Tùy chọn tham gia (provenance).** Khi bạn export một tài sản, thông tin của bạn có thể tùy chọn đi kèm dưới dạng **provenance** - một dòng tác giả/ghi công được nhúng vào metadata của tệp (PNG, PDF, SVG, …) - để tài sản hoàn chỉnh có thể cho biết ai đã tạo ra nó. *Đây* chính là điều mà **Use my details to create** kiểm soát: để tắt thì export vẫn mang ghi công công cụ/nền tảng "Made with Lolly", nhưng không có dòng tác giả/liên hệ cá nhân nào được nhúng vào. (Cùng một tùy chọn này đặt tác giả cho các lượt chạy hàng loạt trên **/pro**.) (Tác giả công cụ: xem [Authoring Tools → `bindToProfile`](/info/authoring-tools.html#bindtoprofile) và [Host API → `host.profile`](/info/host-api.html#host-profile).)

![Công tắc duy nhất Use my details to create, nằm cạnh Save Profile và tắt cho đến khi bạn bật nó lên](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## Hồ sơ so với Nền tảng so với Năng lực

Ba khái niệm này nằm gần nhau trong giao diện và rất dễ gây nhầm lẫn:

- <!--i:people--> **Profile** - *bạn* (hoặc nhóm của bạn, hoặc vai trò bạn đang đảm nhận): tên, thông tin liên hệ, ảnh đại diện, công việc đã lưu của bạn. Cá nhân, lưu trên thiết bị, có thể mang theo dưới dạng một gói.
- <!--i:palette--> **Platform** - *thương hiệu*: màu sắc, font chữ và các thiết lập toàn cục mà mọi công cụ dựa vào để render. Dùng chung và nhất quán, không mang tính cá nhân.
- <!--i:sliders--> **Capabilities** - *những gì ứng dụng có thể làm*: toàn bộ tập tính năng và các công cụ khả dụng cho bạn.

Hồ sơ thay đổi tài sản đó *đến từ* ai; nền tảng thay đổi nó *trông như thế nào*; năng lực là *những gì bạn có thể tạo ra*.

### "Hồ sơ" còn mang hai nghĩa khác trong dự án - không phải nghĩa này

Từ này bị dùng chồng chéo trong toàn bộ dự án. Không nghĩa nào trong hai nghĩa dưới đây là hồ sơ cá nhân mà trang này đang nói tới:

- <!--i:box--> **Content profile** - một cấu hình tại thời điểm build trong `profiles.json` liên kết một tập hợp gói công cụ với một danh mục thương hiệu (ví dụ `suse`, `lolly-start`). Đây là thứ mà một operator chọn khi triển khai, và cũng là thứ mà **URL/CLI parameter** `profile` chọn một biến thể *màu sắc* tại thời điểm export (điều kiện in ICC/CMYK - xem [URL Mode](/info/url-mode.html)). Cả hai đều liên quan đến *build/output*, không liên quan đến *bạn*. Xem [Configuration](/info/configuration.html).
- <!--i:seal--> **Identity profile** - **danh tính Content Credentials đã xác minh** tùy chọn mà bạn có thể đăng ký (một chứng chỉ ngắn hạn liên kết email của bạn với các bản export đã ký của bạn). Đó là một danh tính ký số, tách biệt với các trường tên/liên hệ của hồ sơ cá nhân, mặc dù **Use my details to create** kiểm soát việc liệu cái nào trong hai thứ đó có được nhúng vào hay không. Xem [Content Credentials Identity](/info/content-credentials-identity.html).

![Thẻ Verified identity, chiều rộng điện thoại: bộ chọn thời hạn chứng chỉ và bước đăng ký bên dưới - identity profile, tách biệt với thông tin cá nhân của bạn](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## Quyền riêng tư

Ngoài việc đăng ký danh tính tùy chọn ở trên (gửi email bạn đăng ký đến dịch vụ chứng chỉ - xem [Server Surface](/info/server-surface.html)), hồ sơ không bao giờ được truyền đi, tải lên hay dùng để nhận diện hoặc theo dõi bạn - không có gì cần bạn đồng ý cả, chỉ có thông báo này để bạn biết những gì đang được lưu giữ. Xóa toàn bộ dữ liệu này bất cứ lúc nào bằng **Profile → Clear all my data**. Xem [Privacy Policy](/info/privacy.html).
