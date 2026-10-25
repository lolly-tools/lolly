# Tiện ích mở rộng trình duyệt

Một trang web không đọc được điểm ảnh của trang web khác, nên ứng dụng web Lolly cần trợ giúp để chụp ảnh một trang. Trong trình duyệt nền Chromium (Chrome, Edge, Brave, Arc hoặc Opera, từ Chrome 111), tiện ích **Lolly URL Screenshot** miễn phí cung cấp trợ giúp đó, dùng cùng cách chụp mà ứng dụng máy tính dùng. Khi đã cài:

- **[URL Screenshot](/t/url-shot)** lưu trang bạn đã soạn thành một tệp;
- một địa chỉ web dán vào ô ảnh có thể trở thành ảnh chụp của trang đó, bằng **Screenshot this page**;
- nguồn **Website** trong [Design System Setup](/info/brand-studio.html) có thể đọc một trang để bắt đầu hệ thống thiết kế.

Bạn phê duyệt mọi yêu cầu, và ứng dụng máy tính làm cùng các việc đó mà không cần tiện ích.

## Trước khi cài

Cho đến khi cài tiện ích, **URL Screenshot** vẫn mở, nên bạn có thể soạn một ảnh chụp. Một ghi chú ở đầu các điều khiển của công cụ cho biết thiếu gì.

![Ghi chú của công cụ URL Screenshot đề nghị cài tiện ích mở rộng, hiển thị khi chụp ra tệp không có host để chạy](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Mọi điều khiển đều hoạt động trong khi bạn chờ: URL đích, độ sâu cuộn, độ trễ ổn định, lề cắt và nhuộm lại màu. Chỉ riêng việc chụp cần tiện ích.

![Các điều khiển của URL Screenshot với URL đích, độ sâu cuộn, độ trễ ổn định và phần lề cắt, tất cả đều dùng được trước khi có tiện ích mở rộng](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Cài đặt

**Từ Chrome Web Store:** sắp có. Khi tiện ích được xuất bản, bạn cài bằng một cú nhấp.

**Tự nạp (cho nhà phát triển).** Tiện ích nằm trong kho mã tại `shells/chrome-extension/`. Thư mục đó là bản dựng chính thức, chỉ hoạt động với Lolly tại `https://lolly.tools`.

1. Mở `chrome://extensions`.
2. Bật **Developer mode** (trên bên phải).
3. Nhấp **Load unpacked** và chọn thư mục `shells/chrome-extension/`.
4. Tải lại thẻ Lolly. Việc phát hiện xảy ra khi trang tải, nên lời nhắc "Get the extension" biến mất. **URL Screenshot** (dưới Utilities) khi đó có thể lưu ảnh chụp thành tệp và có sẵn trong chế độ Batch.

Với máy chủ phát triển cục bộ, hãy chạy `pnpm run pack:chrome-extension:dev` và tải `dist/chrome-extension-dev` thay thế. Gói đó cũng chấp nhận `http://localhost:5173` và có chữ **Development** trong tên.

## Điều gì xảy ra khi Lolly yêu cầu

![Thẻ Lolly yêu cầu một trang và bạn nhấn Approve once trong cửa sổ phê duyệt của tiện ích. Một thẻ nền mở ra, đọc trang rồi đóng. Sau đó thẻ Lolly nhận kết quả.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly yêu cầu.** Một tập lệnh nhỏ báo cho Lolly biết tiện ích có mặt, nên việc chụp hoặc đọc trang có thể bắt đầu mà không cần thiết lập thêm.
2. **Bạn phê duyệt.** Tiện ích mở cửa sổ **Approve page request** của riêng nó. Cửa sổ hiện trang yêu cầu, việc nó muốn ảnh chụp hay nội dung trang, và địa chỉ trang. Không có gì được đọc cho đến khi bạn nhấn **Approve once**. **Cancel**, hoặc đóng cửa sổ, kết thúc yêu cầu.
3. **Chrome hỏi một lần cho mỗi trang.** Lần đầu bạn phê duyệt yêu cầu cho một trang, Chrome cũng hỏi tiện ích có được truy cập trang đó không. Chrome giữ quyền truy cập đó khi bạn cho phép, nhưng mọi yêu cầu sau vẫn cần **Approve once** riêng.
4. **Trang được đọc trong thẻ nền.** Tiện ích mở trang đích trong thẻ nền, chụp nó qua DevTools Protocol (cùng `Page.captureScreenshot` mà ứng dụng máy tính dùng), đóng thẻ và đưa kết quả về thẻ Lolly đã yêu cầu.

Một lần phê duyệt bao gồm một yêu cầu và hết hạn sau 30 giây. Mỗi lúc chỉ một yêu cầu có thể chờ hoặc chạy, và một yêu cầu đã duyệt dừng sau 55 giây. Nếu trang Lolly đóng hoặc đổi, hoặc trang đích chuyển sang site khác, yêu cầu bị hủy.

Việc chụp chạy trong trình duyệt của bạn, trên mạng của bạn, nên `localhost` và các site nội bộ hoạt động. Trang tải bằng phiên trình duyệt của bạn, nên một trang bạn đã đăng nhập có thể hiện thông tin riêng tư trong kết quả. Ảnh chụp không được tải lên: lưu lượng mạng duy nhất là trình duyệt của chính bạn tải trang bạn yêu cầu.

Trong khi chụp, bạn có thể thoáng thấy biểu ngữ *"…started debugging this browser"* trên thẻ tạm thời. Đó là DevTools Protocol đang làm việc, và biểu ngữ biến mất khi ảnh chụp xong.

## Đọc một site cho Design System Setup

Nguồn **Website** trong Design System Setup bắt đầu một hệ thống thiết kế từ một site bạn đã có. Trong trình duyệt Chromium, tiện ích đọc trang. Trong ứng dụng máy tính, ứng dụng tự tải trang. Trong trình duyệt không có tiện ích, ô Website không được đưa ra.

- **Một địa chỉ, một trang.** Sau khi bạn phê duyệt, tiện ích mở trang trong cùng loại thẻ nền, đọc markup đã kết xuất, văn bản bảng định kiểu và một số ảnh biểu tượng và logo, rồi đóng thẻ. Nó không theo liên kết hay thu thập dữ liệu.
- **Bảng định kiểu lưu trữ ở nơi khác** (CDN hoặc dịch vụ phông chữ) cũng được tải, vì màu và kiểu chữ của trang nằm trong đó. Yêu cầu khác nguồn gốc đi không kèm cookie của bạn; yêu cầu cùng nguồn gốc dùng chúng, như chính trang sẽ làm.
- **Mọi thứ đều có giới hạn**, về số bảng định kiểu và ảnh và về byte, để một trang độc hại hay hỏng một nửa trả về tài liệu một phần thay vì treo.
- **Việc phân tích diễn ra trên thiết bị của bạn.** Các byte đi thẳng về thẻ Lolly đã yêu cầu, nơi biến chúng thành màu sắc, kiểu chữ và logo.

Dán một địa chỉ chỉ điền vào ô. Không có gì được đọc cho đến khi bạn bắt đầu việc đọc và nhấn **Approve once**.

## Quyền truy cập

`manifest.json` của tiện ích khai báo bốn quyền, cộng quyền truy cập trang mà nó xin từng trang một. Nó đặt `minimum_chrome_version: 111`, và phiên bản hiện tại là 0.4.0.

| Quyền | Dùng để làm gì | Khi nào được cấp |
|---|---|---|
| `debugger` | Điều khiển thẻ nền qua DevTools Protocol, nơi chụp ảnh. | Khi cài đặt |
| `tabs` | Mở thẻ nền tạm thời và đóng nó sau đó, và kiểm tra rằng cả trang Lolly lẫn trang đích đều chưa di chuyển kể từ khi bạn phê duyệt. | Khi cài đặt |
| `scripting` | Chạy trình đọc một trang bên trong site bạn đã nêu, cho nguồn Website. | Khi cài đặt |
| `storage` | Ghi id của một thẻ nó đã mở, chỉ trong bộ nhớ phiên, để thẻ vẫn đóng nếu trình duyệt tạm dừng tiện ích giữa lúc đọc. Xóa ở lần khởi động tiếp theo; không có gì về bạn được lưu. | Khi cài đặt |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Quyền truy cập trang, không cấp khi cài đặt. Khi bạn nhấn **Approve once**, tiện ích xin Chrome quyền truy cập đúng một trang trong yêu cầu đó. | Lần đầu bạn phê duyệt yêu cầu cho trang đó, sau khi Chrome hỏi bạn |

Tiện ích chỉ đọc đúng một trang bạn phê duyệt. Nó không đọc hay gửi dữ liệu duyệt web của bạn, và không có gì được tải lên.

## Khắc phục sự cố

- **Vẫn thấy "Get the extension"?** Hãy tải lại thẻ Lolly.
- **Không có gì xảy ra trên site này?** Tiện ích chỉ hoạt động trên `https://lolly.tools`, cộng `http://localhost:5173` trong gói phát triển. Nguồn gốc khác, như một bản Lolly tự lưu trữ, cần bản dựng tiện ích riêng liệt kê nguồn gốc đó trong cả `manifest.json` lẫn `policy.js`. Chỉ sửa manifest không có tác dụng.
- **Việc chụp thất bại?** Kiểm tra URL truy cập được và bắt đầu bằng `http://` hoặc `https://`. Một số trang chặn chụp tự động. Nếu bạn nhấn **Cancel**, đóng cửa sổ phê duyệt hoặc chờ quá 30 giây, hãy bắt đầu chụp lại.
