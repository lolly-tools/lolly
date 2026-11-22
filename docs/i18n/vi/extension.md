# Tiện ích mở rộng trình duyệt

Một trang web không thể đọc điểm ảnh của một website khác. Trong trình duyệt dựa trên Chromium (Chrome, Edge, Brave, Arc hoặc Opera, từ Chrome 111), tiện ích mở rộng miễn phí **Lolly URL Screenshot** cho phép ứng dụng web Lolly chụp một trang bằng cùng cơ chế chụp mà ứng dụng máy tính sử dụng. Khi đã cài tiện ích mở rộng:

- **[Lolly URL Screenshot](/t/url-shot)** lưu trang bạn đã bố cục thành tệp;
- địa chỉ web được dán vào ô ảnh có thể trở thành ảnh chụp trang đó, bằng **Screenshot this page**;
- nguồn **Website** trong [Lolly Design System Setup](/info/brand-studio.html) có thể đọc một trang để bắt đầu một hệ thống thiết kế.

Bạn phê duyệt từng yêu cầu, và ứng dụng máy tính thực hiện cùng các công việc đó mà không cần tiện ích mở rộng.

<!--i:eti-checklist-->
## Trước khi cài đặt

Không có tiện ích mở rộng, **Lolly URL Screenshot** vẫn mở và bạn có thể bố cục ảnh chụp. Một ghi chú ở đầu các điều khiển của công cụ cho biết còn thiếu gì.

![Ghi chú của công cụ URL Screenshot đề xuất tiện ích mở rộng, hiển thị khi việc chụp thành tệp không có môi trường chủ để chạy](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Mọi điều khiển đều hoạt động mà không cần tiện ích mở rộng: URL đích, độ sâu cuộn, thời gian chờ ổn định, khoảng cắt vào từ các mép và đổi màu. Chỉ việc chụp cần tiện ích mở rộng.

![Các điều khiển Lolly URL Screenshot với URL đích, độ sâu cuộn, thời gian chờ ổn định và khoảng cắt vào từ các mép, tất cả đều dùng được trước khi có tiện ích mở rộng](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

<!--i:eti-download-->
## Cài đặt

**Từ Chrome Web Store:** sắp có. Khi được phát hành, tiện ích mở rộng sẽ cài đặt chỉ bằng một cú nhấp.

**Tự tải vào (dành cho nhà phát triển).** Mã nguồn của tiện ích mở rộng nằm trong kho mã tại `shells/chrome-extension/`. Bước đóng gói tạo gói dùng chính thức từ thư mục đó. Gói này chỉ hoạt động với Lolly tại `https://lolly.tools`.

1. Chạy `pnpm run pack:chrome-extension`. Lệnh này tạo gói trong `dist/chrome-extension/`.
2. Mở `chrome://extensions`.
3. Bật **Developer mode** (góc trên bên phải).
4. Nhấp **Load unpacked** và chọn thư mục `dist/chrome-extension/`.
5. Tải lại thẻ Lolly. Lolly phát hiện tiện ích mở rộng khi trang tải, và lời nhắc "Get the extension" biến mất. Khi đó **Lolly URL Screenshot** (trong Utilities) có thể lưu ảnh chụp thành tệp và hoạt động ở chế độ Lolly Batch.

::: details Với máy chủ phát triển cục bộ hoặc thư mục mã nguồn
Với máy chủ phát triển cục bộ, chạy `pnpm run pack:chrome-extension:dev` và tải `dist/chrome-extension-dev` thay thế. Gói đó cũng chấp nhận `http://localhost:5173` và có **Development** trong tên.

Tải chính thư mục `shells/chrome-extension/` cũng dùng được để chụp PNG. Thư mục đó không có chức năng duyệt trang, vốn được tích hợp ở bước đóng gói. SVG từ thư mục đó chứa ảnh chụp, không chứa hình khối.
:::

<!--i:eti-user-check-->
## Điều gì xảy ra khi Lolly yêu cầu

![Thẻ Lolly yêu cầu một trang và bạn nhấn Approve once trong cửa sổ phê duyệt của tiện ích mở rộng. Một thẻ nền mở ra, đọc trang rồi đóng lại. Sau đó thẻ Lolly nhận kết quả.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly yêu cầu.** Một đoạn mã nhỏ cho Lolly biết tiện ích mở rộng đã có, để việc chụp hoặc đọc trang có thể bắt đầu mà không cần thiết lập thêm.
2. **Bạn phê duyệt.** Tiện ích mở rộng mở cửa sổ **Approve page request** riêng. Cửa sổ hiển thị website gửi yêu cầu, yêu cầu chụp ảnh hay nội dung trang và địa chỉ trang. Không có gì được đọc cho đến khi bạn nhấn **Approve once**. **Cancel** hoặc đóng cửa sổ sẽ kết thúc yêu cầu.
3. **Chrome hỏi một lần cho mỗi website.** Lần đầu bạn phê duyệt yêu cầu cho một website, Chrome cũng hỏi tiện ích mở rộng có được phép truy cập website đó không. Chrome giữ quyền truy cập sau khi bạn cho phép, nhưng mỗi yêu cầu sau vẫn cần **Approve once** riêng.
4. **Trang được đọc trong một thẻ nền.** Tiện ích mở rộng mở trang đích trong một thẻ nền, chụp qua DevTools Protocol (cùng `Page.captureScreenshot` mà ứng dụng máy tính dùng), đóng thẻ rồi trả kết quả về thẻ Lolly đã gửi yêu cầu.

::: details Cách chụp SVG hoạt động
Với **SVG**, tiện ích mở rộng duyệt trang thay vì chụp ảnh màn hình. Một đoạn mã được đóng gói cùng tiện ích mở rộng đọc bố cục trang trong thẻ nền và chuyển trang thành hình khối và văn bản dạng đường viền. Tệp vẫn sắc nét ở mọi kích thước và mọi phần vẫn chỉnh sửa được. Ảnh trên trang vẫn là ảnh. Bất cứ thứ gì trang vẽ bằng canvas, video hoặc hiệu ứng mà SVG không thể biểu diễn đều được sao chép từ ảnh chụp cùng thời điểm. Lolly kiểm tra kết quả với ảnh chụp đó. Khi hai bản khác nhau quá nhiều, SVG sẽ chứa ảnh chụp thay thế.

Để chuyển văn bản thành đường viền theo đúng kiểu chữ của trang, tiện ích mở rộng chuyển cho Lolly các tệp phông chữ mà trang đã tải. Chrome không giữ các byte của phông chữ ở nơi tiện ích mở rộng đọc được, nên tiện ích yêu cầu lại từng phông chữ từ trang. Trình duyệt của bạn thường trả lời từ bộ nhớ đệm, và chính sách bảo mật của chính trang vẫn áp dụng cho yêu cầu đó.
:::

Một lần phê duyệt áp dụng cho một yêu cầu và hết hạn sau 30 giây. Mỗi thời điểm chỉ một yêu cầu được chờ hoặc chạy, và yêu cầu đã phê duyệt sẽ dừng sau 55 giây. Nếu trang Lolly đóng hoặc thay đổi, hoặc trang đích chuyển sang website khác, yêu cầu sẽ bị hủy.

::: warning Ảnh chụp dùng phiên trình duyệt của bạn
Trang tải bằng phiên trình duyệt của bạn, nên trang mà bạn đã đăng nhập có thể hiển thị thông tin riêng tư trong kết quả.
:::

Việc chụp chạy trong trình duyệt trên mạng của bạn, nên `localhost` và các website nội bộ đều hoạt động. Ảnh chụp không được tải lên. Lưu lượng mạng duy nhất là trình duyệt tải trang bạn yêu cầu và, với SVG, tải lại các tệp phông chữ của trang đó lần thứ hai.

Trong khi chụp, bạn có thể thấy thoáng qua biểu ngữ *"…started debugging this browser"* trên thẻ tạm. Biểu ngữ đến từ DevTools Protocol và biến mất khi chụp xong.

<a id="reading-a-site-for-design-system-setup"></a>
<!--i:eti-globe-->
## Đọc website cho Lolly Design System Setup

Nguồn **Website** trong Lolly Design System Setup bắt đầu một hệ thống thiết kế từ website bạn đã có. Trong trình duyệt Chromium, tiện ích mở rộng đọc trang. Trong ứng dụng máy tính, ứng dụng tự tải trang. Trong trình duyệt không có tiện ích mở rộng, thẻ Website không xuất hiện.

- **Một địa chỉ, một trang.** Sau khi bạn phê duyệt, tiện ích mở rộng mở trang trong cùng loại thẻ nền, đọc mã đánh dấu đã kết xuất, văn bản stylesheet và một vài ảnh biểu tượng, logo rồi đóng thẻ. Tiện ích mở rộng không đi theo liên kết hay thu thập các trang khác.
- **Stylesheet lưu trữ ở nơi khác** (CDN hoặc dịch vụ phông chữ) cũng được tải vì chúng chứa màu sắc và kiểu chữ của trang. Yêu cầu khác nguồn không gửi cookie của bạn. Yêu cầu cùng nguồn dùng cookie của bạn, giống như trang sẽ làm.
- **Mọi thứ đều có mức trần**, với giới hạn về số stylesheet, ảnh và số byte, nên trang độc hại hoặc bị lỗi một phần sẽ trả về một phần nội dung thay vì bị treo.
- **Việc phân tích diễn ra trên thiết bị của bạn.** Các byte được trả thẳng về thẻ Lolly đã gửi yêu cầu, nơi chuyển chúng thành màu sắc, kiểu chữ và logo.

Dán địa chỉ chỉ điền vào ô. Không có gì được đọc cho đến khi bạn bắt đầu đọc và nhấn **Approve once**.

<!--i:eti-lock-->
## Quyền

`manifest.json` của tiện ích mở rộng khai báo bốn quyền, cùng quyền truy cập website được yêu cầu lần lượt cho từng website. Nó đặt `minimum_chrome_version: 111`, và phiên bản hiện tại là 0.5.0.

| Quyền | Dùng để làm gì | Khi nào được cấp |
|---|---|---|
| `debugger` | Điều khiển thẻ nền qua DevTools Protocol để chụp ảnh và, với SVG, chạy việc duyệt trang. | Khi cài đặt |
| `tabs` | Mở thẻ nền tạm và đóng sau đó, đồng thời kiểm tra rằng cả trang Lolly lẫn trang đích đều chưa chuyển đi kể từ lúc bạn phê duyệt. | Khi cài đặt |
| `scripting` | Chạy trình đọc một trang bên trong website bạn chỉ định, cho nguồn Website. | Khi cài đặt |
| `storage` | Ghi lại id của thẻ đã mở, chỉ trong bộ lưu trữ phiên, để thẻ vẫn đóng nếu trình duyệt tạm ngưng tiện ích mở rộng khi đang đọc. Được xóa ở lần khởi động tiếp theo; không lưu gì về bạn. | Khi cài đặt |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Quyền truy cập website, không được cấp khi cài đặt. Khi bạn nhấn **Approve once**, tiện ích mở rộng xin Chrome quyền truy cập một website trong yêu cầu đó. | Lần đầu bạn phê duyệt yêu cầu cho website đó, sau khi Chrome hỏi bạn |

Tiện ích mở rộng chỉ đọc trang bạn phê duyệt. Nó không đọc hay gửi dữ liệu duyệt web của bạn.

<!--i:eti-help-->
## Khắc phục sự cố

- **Vẫn thấy "Get the extension"?** Tải lại thẻ Lolly.
- **Không có gì xảy ra trên website này?** Tiện ích mở rộng chỉ hoạt động trên `https://lolly.tools`, cùng với `http://localhost:5173` trong gói phát triển. Một nguồn khác, chẳng hạn bản Lolly tự lưu trữ, cần bản dựng tiện ích mở rộng riêng liệt kê nguồn đó trong cả `manifest.json` và `policy.js`. Chỉ sửa bản kê sẽ không có tác dụng.
- **Chụp thất bại?** Kiểm tra URL có thể truy cập được và bắt đầu bằng `http://` hoặc `https://`. Một số trang chặn việc chụp tự động. Nếu bạn đã nhấn **Cancel**, đóng cửa sổ phê duyệt hoặc chờ lâu hơn 30 giây, hãy bắt đầu chụp lại.
