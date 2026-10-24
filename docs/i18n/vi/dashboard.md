# Cài đặt

Settings là nơi bạn đổi cách Lolly hoạt động cho bạn: thông tin của bạn, hệ thống thiết kế bạn dùng, trợ năng, thứ được lưu trên thiết bị này và thứ sẵn sàng ngoại tuyến. Mở nó bằng **Settings** trên thanh ở chân màn hình chính, hoặc từ menu ảnh đại diện. Nó mở ở **Preferences**, với bốn thẻ khác bên cạnh.

| Thẻ | Địa chỉ | Nó chứa gì |
|---|---|---|
| **Preferences** | `#/settings` | Thông tin của bạn, hệ thống thiết kế, giao diện, emoji, trợ năng, kết nối, lưu trữ và tải xuống ngoại tuyến |
| **This device** | `#/settings?tab=device` | Bảng đọc trực tiếp về trình duyệt và máy này, cùng âm thanh và chế độ xem lưu trữ chỉ đọc |
| **Design system** | `#/settings?tab=brand` | Hệ thống thiết kế đang dùng dưới dạng bìa và các trang, với dải bìa để chuyển hệ thống |
| **Capabilities** | `#/settings?tab=caps` | Mọi thứ Lolly làm được, dưới dạng thẻ có thể tìm kiếm |
| **Activity & stats** | `#/settings?tab=activity` | Danh mục, bộ đếm cục bộ của bạn và công việc gần đây |

Mỗi thẻ có địa chỉ riêng, và các liên kết `#/profile` và `#/d` cũ vẫn mở đúng nơi, tới từng cài đặt.

## Preferences

Preferences là một trang dài với **thanh cài đặt** dọc bên cạnh và ô **Search settings** phía trên thanh lọc nó khi bạn gõ. Mỗi phần mở trực tiếp từ một liên kết dạng `#/settings?focus=<section-id>`, ví dụ `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - tên, thông tin liên hệ và ảnh chân dung của bạn, cùng công tắc **Use my details to create**. [Profiles](/info/profile.html) giải thích cách công cụ dùng chúng.
- <!--i:seal--> **Content Credentials** - danh tính đã xác minh tùy chọn ký các bản xuất của bạn. Xem [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - chuyển, thêm, ẩn hoặc gỡ hệ thống thiết kế. [Design System Setup](/info/brand-studio.html#manage-your-design-systems) đề cập từng hành động.
- <!--i:moon--> **Appearance** - chủ đề (Light, Dark hoặc Brand, tô ứng dụng bằng bảng màu của bạn) và **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - bộ mà emoji của bạn được vẽ từ đó khi bạn bắt đầu việc mới, kèm giấy phép tác phẩm, và mức bảng màu của bạn nhuộm lại chúng (**Off**, **Subtle**, **Strong**, **Full**, **Mono** hoặc **Duotone**). **Keep skin tones and flags** để những thứ đó giữ màu riêng. Công việc bạn đã làm giữ bộ nó được làm ra.
- <!--i:eyeoff--> **Accessibility** - bốn công tắc thoải mái, cộng Sound và Neurospicy Mode. Xem [Accessibility](#accessibility).
- <!--i:link--> **Connected services** - nơi lưu trữ bạn kết nối, như Dropbox, Google Drive, OneDrive, Nextcloud hoặc S3, và **Sync across devices**. Xem [Sync your devices](/info/sync.html).
- <!--i:globe--> **Trusted sites** - các trang mà hộp trang web Design hoặc bản demo Sandbox có thể liên hệ mà không hỏi, và, nơi máy chủ cung cấp, **Allow pages from any site**. [Privacy Policy](/info/privacy.html) liệt kê mỗi yêu cầu gửi gì.
- <!--i:download--> **Your renders** - **Save my renders to my library** giữ một bản sao mỗi ảnh, clip âm thanh và video bạn tải xuống trong Assets, dưới thẻ Renders.
- <!--i:database--> **Storage** - Lolly giữ gì trên thiết bị này, và các nút xóa hoặc mang dữ liệu của bạn. Xem [Storage](#storage).
- <!--i:cpu--> **Available offline** - tải những gì bạn cần trước khi mất kết nối. Xem [Available offline](#available-offline).
- <!--i:folder--> **Hot folder** - trong ứng dụng máy tính, theo dõi một thư mục và kéo mọi thứ thả vào đó vào Lolly, qua cùng bộ chọn mà kéo-thả nhận.
- <!--i:clock--> **Your activity** - những gì bạn đã làm trên thiết bị này, được đếm cục bộ.
- <!--i:sliders--> **Feature flags** - bật hoặc tắt các phần của ứng dụng, như **Print preflight** hay **Strip metadata from uploads**.
- <!--i:server--> **Lolly instance** - nơi bản cài này lấy công cụ và danh mục. Xem [Lolly instance](#lolly-instance).

Các thẻ chủ đề là bản xem trước trực tiếp và áp dụng ngay khi bạn chọn một cái, chỉ trên thiết bị này.

![Ba thẻ chủ đề, mỗi thẻ xem trước kiểu chữ và màu sắc riêng, với thẻ đang hoạt động được đánh dấu](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Trợ năng

**Settings → Preferences → Accessibility** chứa bốn cài đặt thoải mái cho ứng dụng xung quanh công việc của bạn. Mỗi cái tắt cho đến khi bạn bật, và không cái nào chạm vào bên trong canvas công cụ hay bản xuất, nên một ứng dụng dịu hơn không bao giờ dịch chuyển một điểm ảnh nào của tệp bạn giao.

- <!--i:pause--> **Reduce motion** tắt các chuyển cảnh, hiệu ứng trượt và trang trí của ứng dụng. Canvas của bạn và mọi bản xuất động vẫn chuyển động như đã thiết kế.
- <!--i:photos--> **Hide colourful previews** thay tác phẩm xem trước của thư viện bằng các thẻ biểu tượng và chữ êm dịu, và làm dịu hình thu nhỏ dự án để chúng vẫn nhận ra được mà không gây ồn.
- <!--i:sliders--> **High contrast** tăng cường viền, văn bản và vòng tiêu điểm của ứng dụng. Màu thương hiệu và canvas của bạn giữ nguyên như bạn đặt.
- <!--i:font--> **Large text** phóng to nhãn, menu và chữ trên nút của ứng dụng. Chữ bên trong thiết kế của bạn không bị động đến, nên không gì bạn xuất bị dàn lại.

Các cài đặt này nằm trên hồ sơ của bạn, nên chúng đi cùng trong bản xuất hồ sơ và đến bản cài tiếp theo cùng tên và các phiên của bạn. Một bản sao nhỏ chỉ trên thiết bị áp dụng chúng trước lần vẽ đầu tiên.

Cùng thẻ chứa **Sound**, một lớp âm thanh hỗ trợ nhẹ nhàng cho những gì bạn làm (vào thư viện, kết quả Content Credentials, đóng một bảng), và **Neurospicy Mode**, một bản nhạc tập trung êm dịu. Bật Neurospicy mở một trình phát nhỏ ở góc, đi theo bạn qua ứng dụng. Ở đó bạn chọn bản nhạc, bỏ qua, đặt âm lượng và thu nhỏ hoặc đóng trình phát. Các bản nhạc gồm giai điệu *Lolly Sings* thủ tục, vòng lặp môi trường và nhịp, âm thanh của riêng bạn và các đài radio internet, cần có kết nối. Cả hai tắt theo mặc định và được ghi nhớ, và tắt Sound cũng tắt tiếng bản nhạc tập trung. Menu hồ sơ và **This device** có cùng công tắc.

Giao diện điều hướng được bằng bàn phím, các điều khiển tùy chỉnh mang nhãn cho trình đọc màn hình và bản xem trước trực tiếp của mỗi công cụ được cung cấp dưới dạng một ảnh có nhãn mô tả những gì nó hiển thị.

### Lưu trữ

Đồng hồ lưu trữ tính từng byte mà bản cài này giữ, theo từng loại, so với những gì trình duyệt báo cáo.

![Đồng hồ lưu trữ, chia nhỏ các phiên đã lưu, ảnh và bộ nhớ đệm so với những gì trình duyệt thực sự báo cáo](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Dưới đồng hồ:

- **Move to another device** có **Export my data**, **Import data…** và **Export my data & render everything**. [Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device) hướng dẫn qua từng cái.
- **Clear cache** bỏ các tệp danh mục đã tải, sẽ tải lại khi cần.
- **Remove automatic checkpoints older than 30 days** giải phóng chỗ của History và giữ các phiên bản đã lưu và đã đặt tên.
- **Clear all my data** xóa mọi thứ Lolly giữ trong trình duyệt này, sau khi bạn gõ một từ để xác nhận. [If you clear your browser data](/info/find-your-work.html#if-you-clear-your-browser-data) liệt kê những gì mất.

### Có sẵn ngoại tuyến

Lolly lưu đệm các màn hình khi bạn ghé thăm, điều đó chỉ bao phủ những nơi bạn đã đến. **Available offline** dành cho chuyến đi bạn thấy trước: tải những phần bạn sẽ cần và theo dõi một thanh tiến trình, và mọi thứ bạn mang theo tiếp tục hoạt động không cần kết nối.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (mọi màn hình, trình soạn thảo và phông chữ, kể cả những màn hình bạn chưa từng mở), **Catalogue** (toàn bộ, hoặc **Choose by tag**) và **Guides & docs** (tài liệu này bằng ngôn ngữ của bạn, kể cả ảnh chụp màn hình).
- <!--i:cpu--> **AI models** - mỗi mô hình trên thiết bị một hàng riêng kèm dung lượng: Speech voices, Upscaling models, Background removal, Text recognition, Verify deep scan, Durable credential, Rewriter model, Ask matching model, AI text detector và Singing voices. Mô hình trên 50 MB được đánh dấu **large download**.
- <!--i:wrench--> **Tools** - mỗi công cụ tải riêng, hoặc **Download all** lấy mọi công cụ. Dấu tích nghĩa là sẵn sàng ngoại tuyến.

**Download everything** ở trên cùng lấy ứng dụng, phạm vi danh mục bạn chọn, các hướng dẫn và mọi công cụ. Đánh dấu **Include all the AI models** để thêm các mô hình, hoặc tải một mô hình bằng hàng riêng của nó; giọng hát chỉ được tải từ hàng riêng của chúng. Chính sách của tổ chức có thể tắt tải AI, và các hàng sẽ cho bạn biết.

Các lượt tải tiếp tục từ chỗ dừng nếu bạn hủy hoặc mất kết nối, và tự làm mới khi bạn trực tuyến lại, chỉ tải những gì một bản phát hành đã đổi. Nếu trình duyệt chưa cấp lưu trữ bền vững, **Protect downloads** xin quyền đó: sự khác biệt giữa "đã tải" và "đã tải cho đến khi trình duyệt muốn lấy lại chỗ".

### Lolly instance

**Lolly instance** cho biết bản cài này lấy công cụ và danh mục từ đâu: địa chỉ của một phiên bản, hoặc *Bundled with this app* khi mọi thứ đi kèm trong bản dựng.

- **Design-system source** cho biết hệ thống thiết kế được cung cấp đến từ đâu.
- **Instance console** mở các trang quản trị của một bản triển khai, nơi nó cung cấp.
- **Change** trỏ ứng dụng máy tính tới phiên bản khác. Trình duyệt không thể tải công cụ và tài nguyên giữa các nguồn gốc, nên trên web phần này đưa ra **Open a workspace** thay thế.
- **Leave** gỡ hệ thống thiết kế, công cụ và danh mục của phiên bản, còn công việc của riêng bạn ở lại. Xem [Use Lolly at your organisation](/info/organisation.html#leaving).
- Khi bạn đã đăng nhập vào một tổ chức, **Sign out** kết thúc phiên này và **Sign out everywhere** kết thúc các phiên của bạn trên mọi thiết bị, kể cả thiết bị này.

## This device

- <!--i:monitor--> **This Machine** - màn hình, đầu vào, đồ họa, bộ nhớ, codec, nền lưu trữ và hơn nữa, đọc trực tiếp từ phiên này. Không có gì được lưu và không có gì được gửi. Nó tự mở trên màn hình rộng, nơi thẻ bố trí hai cột.
- <!--i:neurobeat--> **Sound** - âm thanh giao diện và các vòng lặp tập trung Neurospicy, công tắc duy nhất trên thẻ này có ghi gì đó.
- <!--i:database--> **Storage** - chế độ xem chỉ đọc của đồng hồ trong [Preferences](#storage), là nơi bạn xóa hoặc mang dữ liệu của mình.

## Design system

Hệ thống thiết kế đang dùng, trình bày để đọc. Khi trình duyệt này giữ hai hệ thống thiết kế trở lên, một dải bìa nhỏ ở trên cùng liệt kê chúng: chọn một cái để đặt làm đang dùng, và **Undo** trong thông báo tiếp theo đưa cái trước trở lại.

![Thẻ Design system trên Lolly Demo: một dải bìa để chuyển hệ thống, rồi bìa với logo, tên, ghi chú và các con số mở từng trang](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

Thẻ mở trên một bìa tô bằng màu riêng của hệ thống, với logo, tên bằng kiểu chữ hiển thị của nó và ghi chú do tác giả viết. Một dòng các con số trên bìa liên kết tới từng trang:

- <!--i:palette--> **Colour** - bề mặt, văn bản, màu chính và màu phụ của giao diện sáng và tối, mọi màu có tên dưới dạng chip kèm tên và mã hex, một dải cho mỗi dải sắc độ và phổ biểu đồ, cùng các vai trò màu trong một nếp gập. Chọn một giá trị để sao chép mã hex.
- <!--i:font--> **Type** - Headings, Text, Emphasis và Code, mỗi loại đặt bằng kiểu chữ riêng của nó.
- <!--i:photos--> **Logos** - mỗi tệp logo trên nền mà nó được tạo cho.
- <!--i:layers--> **Colourways** - cặp sáng và tối của mỗi colourway, khi hệ thống có nhiều hơn một.
- <!--i:sliders--> **Tokens** - bán kính, khoảng cách, hiệu ứng và chuyển sắc.
- <!--i:document--> **Print & CMYK** - các màu khóa vào một loại mực chính xác, và các điều kiện in mà một PDF CMYK có thể khai báo.

Chuyển đổi là thay đổi duy nhất thẻ này thực hiện. Bạn chỉnh sửa một hệ thống thiết kế trong [Design System Setup](/info/brand-studio.html) tại `#/start`, nơi bìa liên kết tới. Một hệ thống chỉ đọc nói rõ điều đó trên bìa; các hệ thống cục bộ bạn tạo vẫn chỉnh sửa được. `/b` và `/brand` là đường tắt thẳng tới thẻ này.

## Capabilities

Mọi phần của nền tảng được viết thành một thẻ, trong mười hai nhóm: Experiences, Platforms & runtimes, Accessibility & languages, Export formats, Import formats, Print production, Automation & AI, Determinism & reproducibility, Brand & design system, Privacy & data ownership, Security & access control và Architecture (for builders). Mỗi nhóm gập lại và hiện số thẻ. Một thẻ mở thành hộp thoại với các tính năng của khả năng đó và, với khoảng một nửa, ảnh chụp màn hình mà tài liệu này dùng.

Ô tìm kiếm phía trên các nhóm lọc các thẻ khi bạn gõ và mở nhóm nào vẫn còn kết quả khớp. Nó cho biết đang tìm trong bao nhiêu khả năng, và truy vấn không khớp sẽ nói bằng lời.

Thẻ này là tài liệu viết về những gì Lolly làm được, giữ đồng bộ với các hướng dẫn này. Nó không thăm dò máy bạn đang dùng; **This device** làm việc đó.

## Activity & stats

Trước hết là bản dựng: bao nhiêu công cụ được nạp, có bao nhiêu định dạng xuất, nền tảng chạy trên bao nhiêu bề mặt và danh mục mang bao nhiêu tài nguyên thương hiệu, với bảng **Catalogue** chia nhỏ những gì đi kèm trong bản dựng này.

Sau đó là phía của bạn: **Your activity** đếm những gì bạn đã làm trên thiết bị này, còn **Recent creations** và **Latest exports** là các chồng bạn có thể vuốt qua, mỗi cái xuất hiện khi có gì để hiện. Cả hai mở một mục như lúc nó được làm. Các bộ đếm này ở lại trên thiết bị; một phiên bản Lolly Work tùy chọn giữ [telemetry tổ chức và bản ghi kiểm toán](/info/privacy.html#organisation-services-with-lolly-work) của riêng nó.

## Liên kết sâu

Mọi thẻ và phần của Settings đều có liên kết riêng, bạn có thể đánh dấu hoặc dán. [Search](/info/search.html) trỏ các kết quả **Settings** của nó tới cùng sổ đăng ký mà Settings kết xuất từ đó, nên một phần không thể bị đổi tên khỏi một kết quả tìm kiếm.

::: details Mọi dạng liên kết

- **Một thẻ:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Một phần Preferences:** `#/settings?focus=<section-id>`, như `#/settings?focus=offline-section`.
- **Một phần, chính xác:** id của nó dưới dạng cờ trần, như `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` hoặc `#/settings?cap-formats`. Các liên kết cũ `#/settings?dash-lock` và `#/settings?dash-palette-wheel` mở bìa và trang Colour.
- **Một phần theo từ khóa:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (trang Colour) hoặc `#/settings?tokens`. Từ khóa có thể bị dùng chung: `print` thuộc cả tham chiếu in của thẻ thương hiệu và nhóm Print production, và cái đầu theo thứ tự trang thắng. Hãy dùng id khi cần phân biệt.

Một liên kết sâu chuyển sang thẻ sở hữu đích, mở mọi nhóm nó nằm trong, rồi cuộn tới đó, đợi một lát trong khi các phần phía trên hoàn tất bố cục. Các địa chỉ `#/platform` và `#/capabilities` đã ngừng được gộp vào Settings với cờ liên kết sâu còn nguyên.
:::

---

**Liên quan:** [Profiles](/info/profile.html) cho thông tin của bạn và các bối cảnh bạn sáng tạo. [Design System Setup](/info/brand-studio.html) để chỉnh những gì thẻ Design system hiển thị. [Find and recover your work](/info/find-your-work.html) cho lưu trữ, sao lưu và chuyển thiết bị.
