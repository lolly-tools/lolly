# Tiện ích mở rộng trình duyệt

Tiện ích mở rộng **Lolly URL Screenshot** cho phép ứng dụng web chụp ảnh màn hình bất kỳ trang web nào ngay từ trong trình duyệt của bạn. Không có nó, việc chụp một URL cần đến ứng dụng desktop - một trang trình duyệt không thể tự đọc pixel từ một trang khác. Tiện ích mở rộng thì có thể, dùng cùng cơ chế chụp mà ứng dụng desktop sử dụng.

Nó còn làm một việc khác theo cùng cách đó: đọc một trang duy nhất mà bạn nêu tên để Brand Studio có thể rút ra một thương hiệu từ một trang web trực tiếp. Cả hai đều được trình bày bên dưới.

Nó chạy trên các trình duyệt dựa trên Chromium: **Chrome, Edge, Brave, Arc, Opera** - Chrome 111 trở lên.

Cho đến khi được cài đặt, **URL Screenshot** vẫn mở để bạn có thể soạn một cảnh chụp, và một ghi chú ở đầu phần điều khiển của công cụ cho biết thiếu gì.

![Ghi chú của công cụ URL Screenshot đề nghị cài tiện ích mở rộng, hiển thị khi chụp ra tệp không có host để chạy](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Mọi điều khiển đều hoạt động trong khi bạn chờ: URL đích, độ sâu cuộn, độ trễ ổn định, phần lề cắt và tô lại màu. Chỉ riêng việc chụp mới cần đến host.

![Các điều khiển của URL Screenshot với URL đích, độ sâu cuộn, độ trễ ổn định và phần lề cắt, tất cả đều dùng được trước khi có tiện ích mở rộng](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Cài đặt

### Từ Chrome Web Store

*Sắp ra mắt.* Khi được xuất bản, bạn sẽ cài đặt chỉ với một cú nhấp, sau đó tải lại Lolly.

### Tự tải lên (dành cho nhà phát triển)

Tiện ích mở rộng nằm trong kho mã tại `shells/chrome-extension/`.

1. Mở `chrome://extensions`.
2. Bật **Developer mode** (chế độ nhà phát triển, ở góc trên bên phải).
3. Nhấp **Load unpacked** và chọn thư mục `shells/chrome-extension/`.
4. Tải lại Lolly - **URL Screenshot** giờ đã hoạt động trong trình duyệt.

## Cách hoạt động

- Một đoạn script nhỏ báo cho Lolly biết tiện ích mở rộng đã có mặt, nhờ đó công cụ **URL Screenshot** tự động bật lên - không cần thiết lập.
- Khi bạn kết xuất, tiện ích mở rộng mở trang đích trong một tab nền, chụp nó qua DevTools Protocol (cùng `Page.captureScreenshot` mà ứng dụng desktop dùng), rồi đóng tab và trả hình ảnh về.
- Nó chạy hoàn toàn trong trình duyệt của bạn, trên mạng của bạn - nên chụp `localhost` hay một trang nội bộ vẫn hoạt động. Bản thân cảnh chụp không bao giờ được tải lên bất cứ đâu; lưu lượng mạng duy nhất là chính trình duyệt của bạn tải trang bạn yêu cầu chụp.

Trong lúc chụp, bạn có thể thấy thoáng qua một biểu ngữ *"…started debugging this browser"* trên tab tạm thời. Đó là DevTools Protocol đang hoạt động; nó tự biến mất khi cảnh chụp hoàn tất.

## Đọc một trang web cho Brand Studio

Nguồn **Website** trong Brand Studio khởi tạo một thương hiệu từ một trang web bạn đã có sẵn. Trên Chromium, tiện ích mở rộng là thứ đọc nó; trên ứng dụng desktop, một lệnh fetch gốc làm cùng việc đó, còn trên trình duyệt thường không có tiện ích mở rộng thì ô này hoàn toàn không được cung cấp.

Điều gì xảy ra khi bạn nhấn vào đó:

- Một địa chỉ, một trang. Tiện ích mở rộng mở nó trong cùng loại tab nền, đọc mã đánh dấu đã kết xuất, nội dung stylesheet và một số hình ảnh biểu tượng, logo, rồi đóng tab. Nó không theo các liên kết và không thu thập dữ liệu hàng loạt.
- Các stylesheet và font được lưu trữ ở nơi khác (một CDN, một dịch vụ font) cũng được tải về, vì màu sắc và kiểu chữ của trang nằm trong đó. Các yêu cầu khác nguồn gửi đi không kèm cookie của bạn; các yêu cầu cùng nguồn thì dùng cookie, đúng như chính trang đó sẽ làm.
- Mọi thứ đều bị giới hạn - một số lượng stylesheet, hình ảnh và byte có giới hạn - để một trang độc hại hoặc lỗi nửa chừng trả về tài liệu một phần thay vì bị treo.
- Các byte được gửi thẳng về tab Lolly đã yêu cầu. Việc phân tích thành màu sắc, kiểu chữ và logo diễn ra trên thiết bị của bạn; không có gì được tải lên.

Không có gì được đọc cho đến khi bạn nhấn. Dán một địa chỉ chỉ điền vào ô trống.

## Sau khi cài đặt

Tải lại tab Lolly. Lời nhắc "Get the extension" biến mất và **URL Screenshot** trở nên khả dụng trong thư viện và trong chế độ Batch.

## Quyền truy cập

Tệp `manifest.json` của nó khai báo bốn quyền cộng với quyền truy cập host:

- `debugger` - điều khiển tab nền qua DevTools Protocol. Đây là thứ thực hiện việc chụp ảnh màn hình.
- `tabs` - mở tab nền tạm thời và đóng lại sau đó.
- `scripting` - chạy trình đọc một trang bên trong trang web bạn chỉ định, dành cho nguồn Website của Brand Studio.
- `storage` - ghi lại id của một tab đã mở, chỉ trong bộ nhớ phiên (session storage), để tab vẫn được đóng nếu trình duyệt tạm dừng tiện ích mở rộng giữa chừng lúc đọc. Được xóa vào lần khởi động tiếp theo; không có gì về bạn được lưu trữ.
- `host_permissions: ["<all_urls>"]` - quyền truy cập host tới *mọi* trang web, vì bạn có thể trỏ nó tới bất kỳ URL nào bạn chọn. Chrome hiển thị điều này lúc cài đặt như một cảnh báo rộng "read and change all your data on all websites".

Bất chấp cảnh báo đó, nó chỉ đọc đúng một trang bạn yêu cầu chụp hoặc nhập vào, và nó không đọc hay truyền dữ liệu duyệt web của bạn - không có gì được tải lên bất cứ đâu.

Manifest cũng thiết lập `minimum_chrome_version: 111`. Phiên bản hiện tại là 0.2.1.

## Khắc phục sự cố

- **Vẫn thấy "Get the extension"?** Tải lại tab Lolly - việc phát hiện diễn ra khi tải trang.
- **Không có gì xảy ra trên trang này?** Tiện ích mở rộng chỉ kích hoạt trên các nguồn gốc của chính Lolly. Đang chạy một bản build tùy chỉnh trên tên miền khác? Thêm nó vào `content_scripts.matches` trong `manifest.json` của tiện ích mở rộng.
- **Chụp bị lỗi?** Kiểm tra xem URL có truy cập được không và có bắt đầu bằng `http://` hoặc `https://` không. Một số trang chủ động chặn việc chụp tự động.
