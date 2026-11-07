# Lolly và API kết xuất

_Kiểm tra lần cuối: 5 tháng 11 năm 2026._

Nếu hiện bạn tạo ảnh từ mẫu qua một API, trang này cho biết điều gì thay đổi nếu bạn tự chạy khâu sản xuất đó: trên thiết bị của bạn, trong CI hoặc trên một máy chủ bạn kiểm soát. [Move from a hosted render API](/info/work-move-from-render-api.html) là cách làm.

## Các API kết xuất được lưu trữ làm tốt hơn điều gì

[Bannerbear](https://www.bannerbear.com/) và [Placid](https://placid.app/) là các dịch vụ được quản lý, và đó là một lợi thế thực sự. Bạn gửi một yêu cầu và người khác vận hành máy chủ, giữ cho chúng chạy và xử lý tải.

- **Không có gì để vận hành.** Không máy chủ, cơ sở dữ liệu, lưu trữ, cập nhật hay hoạch định dung lượng.
- **Một trình soạn mẫu được lưu trữ** với các mẫu sẵn sàng để điều chỉnh.
- **Nhiều loại đầu ra hơn từ một API.** Cả hai đều công bố điểm cuối video và PDF, và Bannerbear còn ghi nhận đầu ra hoạt ảnh, WebP và AVIF, ảnh chụp trang và xóa nền bằng AI.
- **Tích hợp và hỗ trợ riêng của họ.**

Nếu đó là cách sắp xếp bạn muốn, các dịch vụ đó là một lựa chọn vững.

## Tự lưu trữ mang lại gì cho bạn

- **Nội dung của bạn ở lại trên hệ thống của bạn.** Đầu vào, tài nguyên và đầu ra nằm trên hạ tầng bạn đã chọn. Kết xuất trên thiết bị hoặc trong CI không cần dịch vụ nào.
- **Quy tắc nằm trong công cụ.** Màu sắc, kiểu chữ, logo và đầu vào bị khóa đến từ [hệ thống thiết kế](/info/brand-studio.html) của bạn, nên người gọi chỉ đổi được những gì bạn cho phép. [Lolly Work](/info/compare.html#what-runs-where) áp dụng khả năng hiển thị công cụ và chính sách đầu vào cho mọi yêu cầu.
- **Cùng một công cụ ở mọi nơi.** Một công cụ kết xuất trên laptop, trong tác vụ CI hoặc trên máy chủ từ cùng các đầu vào, và mọi người có thể chỉnh sửa cùng công cụ đó trong ứng dụng.
- **Hồ sơ do bạn nắm giữ.** [Render receipts](/info/work-renders.html#evidence-and-identity), nhật ký kiểm toán, và Content Credentials nơi bạn cấu hình danh tính ký.
- **Mã nguồn mở và không tính phí theo lượt.** Bạn tự chạy mã, và thứ bạn trả tiền là hạ tầng của chính mình.

Bạn nhận lấy phần việc mà các dịch vụ đó làm thay bạn. Một máy chủ bền vững cần cơ sở dữ liệu liên tục và nơi lưu trữ đầu ra, và các công cụ cần trình duyệt cần worker Chromium. [Install Lolly Work](/info/work-install.html) mô tả cả hai.

## Các việc tương ứng với nhau thế nào

| Việc | API kết xuất được lưu trữ | Lolly |
|---|---|---|
| Điền một mẫu từ dữ liệu | Yêu cầu API nêu một mẫu và các lớp của nó | [URL](/info/url-mode.html), [CLI](/info/cli.html) hoặc [API máy chủ](/info/work-automation-api.html) nêu một công cụ và các đầu vào của nó |
| Nhiều tệp từ một bảng | Batch và bộ sưu tập | [Batch](/info/batch.html) trên thiết bị của bạn, hoặc [batch kết xuất](/info/work-renders.html#batches-with-durable-rows) trên máy chủ |
| Chờ hoặc thăm dò kết quả | Thăm dò, hoặc một tùy chọn đồng bộ | Kết xuất bền vững mà bạn thăm dò, hoặc một lần kết xuất tức thì |
| Gọi webhook khi xong | Có | [Callback có chữ ký](/info/work-renders.html) tới các origin bạn cho phép |
| URL ảnh động | Có | [Liên kết chia sẻ và URL `/render`](/info/url-mode.html) |
| Chỉnh sửa một mẫu | Trình soạn được lưu trữ | [Design](/info/using.html), trên thiết bị của bạn |
| Agent | Cả hai công bố một máy chủ MCP | [MCP](/info/mcp.html), với một điểm cuối tổ chức theo chính sách của token trên Lolly Work |

Các loại đầu ra riêng của Lolly được liệt kê trong [Exporting](/info/exporting.html). Trên máy chủ Work hiện nay, kết xuất bền vững tạo SVG, PNG, JPG và PDF, và [video ở lại trên thiết bị, CLI và MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

## Những gì đi theo, và những gì không

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Yêu cầu của bạn | API di chuyển của Work nhận cùng dạng | Giống | Giống |
| Mẫu của bạn | **Import** thành tài liệu chỉnh sửa được, trừ các loại lớp không có lược đồ đã xác nhận | Chỉ tên trường và bản xem trước. Dựng lại từng mẫu | Chỉ tên trường và bản xem trước. Dựng lại từng mẫu |
| URL động hiện có | Không được hỗ trợ | Không được hỗ trợ | URL có chữ ký vẫn hoạt động sau khi đổi máy chủ, với token riêng cũ của bạn |
| Webhook | Webhook đã đăng ký không được hỗ trợ | `webhook_url` hoạt động | `webhook_success` hoạt động |
| Đầu ra WebP và AVIF | Bị từ chối theo tên | Không được cung cấp | WebP bị từ chối theo tên |
| Hoạt ảnh, video, bộ sưu tập, ảnh chụp trang | Không có trên API di chuyển | Không có trên API di chuyển | Không có trên API di chuyển |

Tất cả những điều này được dựng từ tài liệu công khai của từng nhà cung cấp và chưa được chạy trên một tài khoản thật. [Hướng dẫn chuyển](/info/work-move-from-render-api.html#check-it-on-your-own-account) có một danh sách kiểm tra ngắn nếu bạn có tài khoản.

Việc chuyển không phải tất cả hoặc không gì. Bạn có thể chuyển một mẫu và giữ phần còn lại ở nơi chúng đang ở, và [rời Lolly](/info/work-move-from-render-api.html#leave-lolly-too) cũng mở như vậy: công cụ là tệp thuần và CLI kết xuất chúng không cần máy chủ.

## Ai vận hành dịch vụ

Với Lolly, một cá nhân kết xuất cục bộ, hoặc một đội chạy Lolly Work trên hạ tầng của chính mình. Gửi một tác vụ lên máy chủ là gửi đầu vào và tài nguyên cần thiết của nó tới phiên bản đó, khác với đường chạy trên thiết bị.

Bannerbear và Placid là nhãn hiệu của chủ sở hữu chúng. Trang này mô tả nơi các sản phẩm chồng lấn, từ tài liệu công khai của họ, và không liên kết với bên nào.
