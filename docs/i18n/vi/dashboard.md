# Cài đặt

Settings chứa thông tin của bạn, hệ thống thiết kế, trợ năng, lưu trữ trên thiết bị này và tải xuống để dùng ngoại tuyến. Mở **Settings** từ thanh ở chân màn hình chính hoặc từ menu ảnh đại diện của bạn và nó mở ở **Preferences**.

| Thẻ | Địa chỉ | Nội dung |
|---|---|---|
| **Preferences** | `#/settings` | Thông tin của bạn, hệ thống thiết kế, giao diện, emoji, trợ năng, kết nối, lưu trữ và tải xuống để dùng ngoại tuyến |
| **This device** | `#/settings?tab=device` | Thông tin trực tiếp về trình duyệt và máy này, cùng âm thanh và chế độ xem lưu trữ chỉ đọc |
| **Design system** | `#/settings?tab=brand` | Hệ thống thiết kế đang hoạt động dưới dạng bìa và các trang, với một dải bìa để chuyển hệ thống |
| **Capabilities** | `#/settings?tab=caps` | Mọi thứ Lolly có thể làm, dưới dạng thẻ có thể tìm kiếm |
| **Activity & stats** | `#/settings?tab=activity` | Danh mục, bộ đếm cục bộ và công việc gần đây của bạn |

Các liên kết `#/profile` và `#/d` cũ vẫn mở đúng chỗ, đến từng cài đặt riêng lẻ.

<!--i:eti-sliders-->
## Tùy chọn

Preferences là một trang dài với **thanh cài đặt** dọc bên cạnh. Trường **Search settings** phía trên thanh lọc thanh đó khi bạn gõ. Mỗi phần có liên kết dạng `#/settings?focus=<section-id>`, như `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - tên, thông tin liên hệ và ảnh chân dung của bạn, cùng công tắc **Use my details to create**. [Hồ sơ](/info/profile.html) giải thích cách công cụ dùng chúng.
- <!--i:seal--> **Content Credentials** - danh tính đã xác minh tùy chọn để ký bản xuất của bạn. Xem [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - chuyển, thêm, ẩn hoặc xóa hệ thống thiết kế. [Thiết lập hệ thống thiết kế Lolly](/info/brand-studio.html#manage-your-design-systems) trình bày từng thao tác.
- <!--i:moon--> **Appearance** - chủ đề (Light, Dark hoặc Brand, dùng bảng màu của bạn cho ứng dụng), **Your colourway** khi hệ thống thiết kế cung cấp nhiều hơn một colourway ([Chọn colourway cho riêng bạn](/info/colourways.html#make-a-colourway-your-own)) và **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - bộ emoji cho công việc mới, cùng giấy phép hình ảnh của bộ đó và mức độ bảng màu của bạn đổi màu emoji (**Off**, **Subtle**, **Strong**, **Full**, **Mono** hoặc **Duotone**). **Keep skin tones and flags** giữ nguyên màu của tông da và cờ. Công việc đã tạo giữ bộ emoji của nó.
- <!--i:eyeoff--> **Accessibility** - bốn công tắc giúp dùng thoải mái hơn, cùng Sound và Neurospicy Mode. Xem [Trợ năng](#accessibility).
- <!--i:link--> **Connected services** - nơi lưu trữ bạn kết nối, như Dropbox, Google Drive, OneDrive, Nextcloud hoặc S3 và **Sync across devices**. Xem [Đồng bộ các thiết bị](/info/sync.html).
- <!--i:globe--> **Trusted sites** - các trang mà hộp trang web của Lolly Design hoặc bản demo Lolly Sandbox có thể liên hệ mà không cần hỏi và **Allow pages from any site** ở nơi máy chủ cung cấp. [Chính sách quyền riêng tư](/info/privacy.html) liệt kê những gì mỗi yêu cầu gửi đi.
- <!--i:download--> **Your renders** - **Save my renders to my library** giữ một bản sao của mỗi ảnh, đoạn âm thanh và video bạn tải xuống trong Assets, dưới nhãn Renders.
- <!--i:database--> **Storage** - những gì Lolly giữ trên thiết bị này và các nút xóa hoặc chuyển dữ liệu của bạn. Xem [Lưu trữ](#storage).
- <!--i:cpu--> **Available offline** - tải xuống những gì bạn cần trước khi mất kết nối. Xem [Dùng ngoại tuyến](#available-offline).
- <!--i:folder--> **Hot folder** - trong ứng dụng máy tính, Lolly theo dõi một thư mục và đưa vào mọi thứ được thả vào đó, qua cùng bộ chọn dùng khi kéo và thả.
- <!--i:clock--> **Your activity** - những gì bạn đã tạo trên thiết bị này, được đếm cục bộ.
- <!--i:sliders--> **Feature flags** - bật hoặc tắt các phần của ứng dụng, như **Print preflight** hoặc **Strip metadata from uploads**. **Performance UI** cho ứng dụng giao diện đơn giản hơn, tốn ít tài nguyên để vẽ hơn. Lolly có thể tự bật Performance UI trên thiết bị chậm. Khi đó, dòng bên dưới công tắc cho biết thời điểm và lý do, với **Allow again** ([cách ứng dụng quyết định](/info/configuration.html#curating-what-people-see)).
- <!--i:server--> **Lolly instance** - nơi bản cài đặt này lấy công cụ và danh mục. Xem [Phiên bản Lolly](#lolly-instance).

Các thẻ chủ đề là bản xem trước trực tiếp. Chủ đề được áp dụng ngay khi bạn chọn, chỉ trên thiết bị này.

![Ba thẻ chủ đề, mỗi thẻ xem trước kiểu chữ và màu riêng, với thẻ đang dùng được đánh dấu](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Trợ năng

**Settings → Preferences → Accessibility** chứa bốn cài đặt giúp dùng ứng dụng thoải mái hơn. Mỗi cài đặt đều tắt cho đến khi bạn bật và không cài đặt nào tác động vào canvas công cụ hay bản xuất, nên ứng dụng dịu hơn không bao giờ dịch chuyển một điểm ảnh nào trong tệp bạn gửi đi. Mỗi cài đặt mặc định đều tắt. Không cài đặt nào thay đổi canvas công cụ hay bản xuất.

- <!--i:pause--> **Reduce motion** tắt các hiệu ứng chuyển tiếp, trượt và trang trí của ứng dụng.
- <!--i:photos--> **Hide colourful previews** thay hình xem trước trong gallery bằng thẻ có biểu tượng và văn bản, đồng thời giảm độ nổi bật của ảnh thu nhỏ dự án nhưng vẫn giữ chúng dễ nhận ra.
- <!--i:sliders--> **High contrast** làm rõ hơn đường viền, văn bản và vòng tiêu điểm của ứng dụng. Màu thương hiệu và canvas giữ nguyên như bạn đã đặt.
- <!--i:font--> **Large text** tăng cỡ chữ của nhãn, menu và nút trong ứng dụng.

**Dominant hand** (Right hoặc Left) đặt phía chứa điều khiển khi Lolly hiển thị hai ngăn, trên thiết bị gập hoặc máy tính bảng gần vuông. **Swap sides** trong phần đầu ngăn cũng thay đổi điều này.

Các cài đặt này nằm trong hồ sơ của bạn, nên đi cùng tên và các phiên của bạn khi xuất hồ sơ. Một bản sao chỉ có trên thiết bị áp dụng chúng trước lần vẽ đầu tiên.

Cùng thẻ đó có **Sound**, những âm thanh hỗ trợ nhẹ nhàng cho các thao tác như vào gallery, nhận kết quả Content Credentials hoặc đóng bảng. Nó cũng có **Neurospicy Mode**, một bản nhạc êm dịu giúp tập trung. Bật Neurospicy sẽ mở một trình phát nhỏ ở góc, luôn theo bạn khắp ứng dụng. Trong trình phát, bạn chọn bản nhạc, bỏ qua, chỉnh âm lượng và thu nhỏ hoặc đóng trình phát. Các bản nhạc gồm những đài nhạc được tạo của Lolly, vòng lặp âm thanh nền và nhịp điệu, âm thanh riêng của bạn và các đài radio internet cần kết nối. Cả hai mặc định đều tắt và trạng thái được ghi nhớ. Tắt Sound cũng tắt tiếng nhạc tập trung. Menu hồ sơ và **This device** có cùng công tắc.

Thanh trượt dưới công tắc Sound đặt chất liệu âm thanh. Về phía khối **Bouba** tròn, chúng thành tiếng giọt nước nhẹ, bong bóng và một chút âm trầm. Về phía ngôi sao **Kiki** nhọn, chúng thành tiếng tích khô, tiếng cào và tiếng kim loại. Ở giữa giữ tiếng chuông và nốt nhạc của Lolly. Nếu âm thanh ở một đầu khiến bạn khó chịu, hãy chuyển về đầu kia. Thanh trượt hoạt động khi Sound tắt và thả thanh trượt sẽ phát một mẫu ngắn.

::: details Các đài nhạc được tạo
Các đài nhạc được tạo tự soạn nhạc trong khi phát, không có mẫu âm thanh hay giọng nói thu sẵn. Mỗi giai điệu có nhạc cụ, nhịp điệu và trình tự phát riêng.

- **Lolly Sings** là một nhóm đài nhạc. Lolly Sings gốc tươi sáng và giàu giai điệu: giọng trưởng, phần giai điệu chính trong mỗi bản nhạc và sắc thái bossa, shuffle và chiptune. Mỗi thể loại cũng có đài riêng, từ Sugar và K-pop đến Country, Jazz, Metal và D&B.
- Các **Lofi stations** (Warm, Late night và Rainy) là những nhịp lo-fi bất tận.

Trên đài nhạc được tạo, nút tiếp theo và trước đó chuyển giữa các giai điệu. Mỗi giai điệu được tạo từ một giá trị khởi tạo, nên phát giống nhau ở bất cứ nơi nào bạn chia sẻ hay lưu nó (xem [Nhạc được tạo](/info/generated-music.html)). Bên dưới các điều khiển phát, **Mood** chuyển giữa các Lofi stations, **Drums** bỏ bộ trống và **Texture** đi từ âm thanh sạch đến chất âm đĩa nhạc phủ bụi. Tiếp đó là một hàng nút biểu tượng. Di chuột hoặc nhấn giữ nút để xem tên:

- Nốt nhạc, **Open in the music generator**, mở giai điệu tại `#/music`, nơi bạn có thể đổi nhạc cụ theo từng đoạn.
- Liên kết, **Share this tune or moment**, cung cấp liên kết phát cùng giai điệu hoặc liên kết còn bắt đầu tại vị trí hiện tại và hiển thị hình ảnh theo nhạc với cài đặt sẵn và màu sắc hiện tại của bạn.
- Thư mục, **Save to library**, giữ giai điệu trong tài nguyên của bạn.
- Tia sét, **Light visualiser**, là một công tắc được mô tả bên dưới.

Giai điệu đã lưu được liệt kê trong nhóm của đài tương ứng, theo giọng và nhịp độ. Chọn giai điệu đã lưu sẽ phát lại đúng giai điệu đó, lặp lại như mọi bản nhạc hoặc chuyển tiếp trong chế độ phát tiến. Nó chỉ lưu đài và số của giai điệu, vài byte và nhạc được soạn lại khi phát. Bạn có thể đổi tên hoặc xóa giai điệu đã lưu trong tài nguyên và dùng nó làm nhạc nền cho video. Lolly Demo và Lolly Start mỗi hệ thống có sẵn sáu giai điệu đã lưu.

Bộ hiển thị hình ảnh theo nhạc nhận mọi bản nhạc ở mức ổn định, nên bản nhạc nhỏ làm hình ảnh chuyển động nhiều như bản nhạc lớn, ở bất kỳ âm lượng nào. Mỗi thể loại Lolly Sings và giai điệu được lưu từ đó đều có **Light visualiser**: các thanh mức âm thanh đơn giản, dành thời gian xử lý cần thiết cho nhạc. Light visualiser mặc định bật trên màn hình cảm ứng và trên thiết bị có tối đa bốn lõi hoặc bộ nhớ từ 4 GB trở xuống.
:::

Bạn có thể dùng giao diện bằng bàn phím. Các điều khiển tùy chỉnh có nhãn cho trình đọc màn hình. Bản xem trước trực tiếp của mỗi công cụ là một ảnh có nhãn mô tả nội dung hiển thị.

### Lưu trữ

Thước đo lưu trữ hiển thị từng byte mà bản cài đặt này giữ theo danh mục, đối chiếu với số liệu trình duyệt báo cáo.

![Thước đo lưu trữ, phân tách các phiên đã lưu, ảnh và bộ nhớ đệm để đối chiếu với số liệu thực tế trình duyệt báo cáo](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Bên dưới thước đo:

- **Move to another device** có **Export my data**, **Import data…** và **Export my data & render everything**. [Chuyển công việc sang thiết bị khác](/info/find-your-work.html#move-your-work-to-another-device) hướng dẫn từng mục.
- **Clear cache** xóa các tệp danh mục đã tải xuống, chúng sẽ được tải lại khi cần.
- **Remove automatic checkpoints older than 30 days** giải phóng dung lượng History và giữ các phiên bản đã lưu và được đặt tên.
- **Clear all my data** xóa mọi thứ Lolly giữ trong trình duyệt này sau khi bạn gõ một từ để xác nhận. [Nếu bạn xóa dữ liệu trình duyệt](/info/find-your-work.html#if-you-clear-your-browser-data) liệt kê những gì bị xóa.

### Dùng ngoại tuyến

Lolly chỉ lưu vào bộ nhớ đệm những màn hình bạn đã truy cập. **Available offline** tải xuống các phần bạn sẽ cần, với một thanh tiến trình và chúng tiếp tục hoạt động khi không có kết nối.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (mọi chế độ xem, trình soạn thảo và phông chữ, kể cả những màn hình bạn chưa từng mở), **Catalogue** (toàn bộ hoặc **Choose by tag**) và **Guides & docs** (tài liệu này bằng ngôn ngữ của bạn, bao gồm cả ảnh chụp màn hình).
- <!--i:cpu--> **AI models** - mỗi mô hình chạy trên thiết bị có một hàng riêng kèm dung lượng: giọng nói, mô hình phóng to ảnh, xóa nền, nhận dạng văn bản, quét chuyên sâu Lolly Verify, thông tin xác thực bền vững, mô hình viết lại, mô hình tìm phần khớp cho Ask, bộ phát hiện văn bản AI và giọng hát. Mô hình trên 50 MB được đánh dấu **large download**.
- <!--i:wrench--> **Tools** - từng công cụ được tải riêng, hoặc **Download all** tải mọi công cụ. Dấu tích có nghĩa là đã sẵn sàng dùng ngoại tuyến.

**Download everything** ở trên cùng tải ứng dụng, phạm vi danh mục bạn đã chọn, các hướng dẫn và mọi công cụ. Đánh dấu **Include all the AI models** để thêm các mô hình, hoặc tải một mô hình từ hàng riêng của nó. Giọng hát chỉ tải được từ hàng riêng. Chính sách của tổ chức có thể tắt việc tải AI, và khi đó các hàng sẽ cho biết điều này.

Các lượt tải xuống tiếp tục từ chỗ đã dừng nếu bạn hủy hoặc mất kết nối. Khi có mạng trở lại, chúng làm mới và chỉ tải những gì bản phát hành đã thay đổi. Nếu trình duyệt chưa cấp quyền lưu trữ lâu dài, **Protect downloads** sẽ xin quyền đó. Khi không có quyền này, trình duyệt có thể xóa nội dung đã tải xuống khi cần lấy lại dung lượng.

### Phiên bản triển khai Lolly

**Lolly instance** cho biết bản cài đặt này lấy công cụ và danh mục ở đâu: địa chỉ của một phiên bản triển khai hoặc *Bundled with this app* khi mọi thứ đều nằm trong bản dựng.

- **Design-system source** cho biết hệ thống thiết kế được cung cấp đến từ đâu.
- **Instance console** mở các trang quản trị của bản triển khai, nếu có.
- **Change** trỏ ứng dụng máy tính đến một phiên bản triển khai khác. Trình duyệt không thể tải công cụ và tài nguyên từ nguồn khác, nên trên web, phần này có **Open a workspace** thay thế.
- **Leave** xóa hệ thống thiết kế, công cụ và danh mục của phiên bản triển khai. Công việc của riêng bạn vẫn còn. Xem [Sử dụng Lolly tại tổ chức của bạn](/info/organisation.html#leaving).
- Khi bạn đăng nhập vào một tổ chức, **Sign out** kết thúc phiên này và **Sign out everywhere** kết thúc các phiên của bạn trên mọi thiết bị, kể cả thiết bị này.

<!--i:eti-monitor-->
## Thiết bị này

- <!--i:monitor--> **This Machine** - màn hình, đầu vào, đồ họa, bộ nhớ, codec, hệ thống lưu trữ và nhiều thông tin khác, được đọc trực tiếp từ phiên này. Không có gì được lưu hay gửi đi. Trên màn hình rộng, bảng này tự mở và thẻ dùng hai cột.
- <!--i:neurobeat--> **Sound** - âm thanh giao diện và các vòng lặp hỗ trợ tập trung Neurospicy. Âm thanh là công tắc duy nhất trên thẻ này ghi lại dữ liệu.
- <!--i:database--> **Storage** - chế độ xem chỉ đọc của thước đo dung lượng. Xóa hoặc mang theo dữ liệu của bạn trong [Tùy chọn](#storage).

<!--i:eti-palette-->
## Hệ thống thiết kế

Hệ thống thiết kế đang dùng, được trình bày để xem. Khi trình duyệt này có từ hai hệ thống thiết kế trở lên, một dải bìa ở trên cùng liệt kê chúng. Chọn một hệ thống để dùng. **Undo** trong thông báo hiện sau đó đưa hệ thống trước trở lại.

![Thẻ Design system trên Lolly Demo: một dải bìa để chuyển hệ thống, rồi đến bìa có logo, tên, ghi chú và các số lượng mở từng trang](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

Thẻ mở ra với một bìa mang màu sắc của hệ thống, cùng logo, tên bằng kiểu chữ trưng bày và ghi chú do tác giả viết. Một dòng số lượng trên bìa liên kết đến từng trang:

- <!--i:palette--> **Colour** - màu bề mặt, văn bản, chính và phụ của giao diện sáng và tối, mỗi màu có tên dưới dạng chip kèm tên và mã hex, một dải cho mỗi thang sắc độ và phổ màu biểu đồ, cùng các vai trò màu trong một phần gập được. Chọn một giá trị để sao chép mã hex.
- <!--i:font--> **Type** - Headings, Text, Emphasis và Code, mỗi vai trò hiển thị bằng kiểu chữ riêng.
- <!--i:photos--> **Logos** - mỗi tệp logo trên nền mà nó được tạo ra để dùng.
- <!--i:layers--> **Colourways** - cặp sáng và tối của từng colourway, khi hệ thống có nhiều hơn một colourway.
- <!--i:sliders--> **Tokens** - bán kính, khoảng cách, hiệu ứng và chuyển sắc.
- <!--i:document--> **Print & CMYK** - các màu được khóa vào một màu mực chính xác và các điều kiện in mà PDF CMYK có thể khai báo.

Chuyển hệ thống là thay đổi duy nhất mà thẻ này thực hiện. Chỉnh sửa hệ thống thiết kế trong [Lolly Design System Setup](/info/brand-studio.html) tại `#/start`, được liên kết từ bìa. Hệ thống chỉ đọc ghi rõ điều đó trên bìa. Các hệ thống cục bộ bạn tạo vẫn chỉnh sửa được. `/b` và `/brand` là liên kết ngắn đến thẻ này.

<!--i:eti-grid-->
## Khả năng

Mỗi phần của nền tảng có một thẻ, chia thành mười hai nhóm: Trải nghiệm, Nền tảng & môi trường chạy, Khả năng tiếp cận & ngôn ngữ, Định dạng xuất, Định dạng nhập, Sản xuất in ấn, Tự động hóa & AI, Tính xác định & khả năng tái tạo, Thương hiệu & hệ thống thiết kế, Quyền riêng tư & quyền sở hữu dữ liệu, Bảo mật & kiểm soát truy cập và Kiến trúc (dành cho người xây dựng). Mỗi nhóm gập được và hiển thị số thẻ. Một thẻ mở hộp thoại với các tính năng thuộc khả năng đó và, với khoảng một nửa số thẻ, ảnh chụp màn hình mà tài liệu này sử dụng.

Ô tìm kiếm phía trên các nhóm lọc thẻ khi bạn gõ và mở các nhóm có kết quả khớp. Ô này hiển thị số khả năng mà nó tìm kiếm. Truy vấn không có kết quả khớp sẽ báo rõ bằng lời.

Thẻ này ghi lại những gì Lolly làm được, đồng bộ với các hướng dẫn này. Nó không kiểm tra máy bạn đang dùng; **This device** làm việc đó.

<!--i:eti-gauge-->
## Hoạt động & thống kê

Đầu tiên là bản dựng: số công cụ đã tải, định dạng xuất, môi trường mà nền tảng chạy trên đó và tài nguyên thương hiệu trong danh mục. Bảng **Catalogue** liệt kê chi tiết những gì có trong bản dựng này.

Tiếp theo là công việc của riêng bạn: **Your activity** đếm những gì bạn đã tạo trên thiết bị này. **Recent creations** và **Latest exports** là các ngăn xếp bạn có thể vuốt qua, hiển thị khi đã có nội dung. Cả hai mở một mục đúng như trạng thái trước đó. Các bộ đếm này ở lại trên thiết bị. Phiên bản triển khai Lolly Work tùy chọn giữ riêng [dữ liệu đo từ xa và bản ghi kiểm toán của tổ chức](/info/privacy.html#organisation-services-with-lolly-work).

<!--i:eti-link-->
## Liên kết sâu

Mỗi thẻ và phần trong Settings có liên kết riêng để đánh dấu trang hoặc dán. [Lolly Search](/info/search.html) tạo kết quả **Settings** từ cùng danh sách đăng ký với Settings, nên việc đổi tên một phần không bao giờ làm hỏng kết quả tìm kiếm.

::: details Mọi dạng liên kết

- **Một thẻ:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Một phần trong Preferences:** `#/settings?focus=<section-id>`, chẳng hạn `#/settings?focus=offline-section`.
- **Một phần chính xác:** id của phần đó dưới dạng cờ không có giá trị, chẳng hạn `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` hoặc `#/settings?cap-formats`. Các liên kết cũ `#/settings?dash-lock` và `#/settings?dash-palette-wheel` mở bìa và trang Colour.
- **Một phần theo từ khóa:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (trang Colour) hoặc `#/settings?tokens`. Hai phần có thể dùng chung một từ khóa: `print` thuộc cả phần tham khảo in ấn của thẻ thương hiệu và nhóm Sản xuất in ấn, và phần đứng trước theo thứ tự trang được chọn. Dùng id để chọn một phần.

Liên kết sâu chuyển sang thẻ chứa đích và mở mọi nhóm đang gập chứa đích đó. Sau đó, nó cuộn đến đích khi các phần phía trên đã bố trí xong. Các địa chỉ đã ngừng dùng `#/platform` và `#/capabilities` mở trong Settings và giữ nguyên các cờ liên kết sâu.
:::

---

**Liên quan:** [Hồ sơ](/info/profile.html) cho thông tin của bạn và những bối cảnh bạn tạo nội dung trong đó. [Lolly Design System Setup](/info/brand-studio.html) để chỉnh sửa những gì thẻ Design system hiển thị. [Tìm và khôi phục công việc của bạn](/info/find-your-work.html) về lưu trữ, sao lưu và chuyển thiết bị.
