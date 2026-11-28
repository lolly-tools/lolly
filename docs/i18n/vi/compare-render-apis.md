# Lolly và các API kết xuất

_Kiểm tra lần cuối: 5 tháng 11 năm 2026._

Nếu bạn tạo ảnh từ mẫu qua API, trang này cho biết những gì thay đổi khi bạn chạy quy trình sản xuất đó trên thiết bị của mình, trong CI hoặc trên máy chủ bạn kiểm soát. [Chuyển từ API kết xuất được lưu trữ](/info/work-move-from-render-api.html) đưa ra các bước.

<!--i:eti-award-->
## API kết xuất được lưu trữ làm tốt hơn ở điểm nào

[Bannerbear](https://www.bannerbear.com/) và [Placid](https://placid.app/) là dịch vụ được quản lý: bạn gửi yêu cầu và người khác vận hành máy chủ.

- **Không có gì phải vận hành.** Không máy chủ, cơ sở dữ liệu, lưu trữ, cập nhật hay lập kế hoạch năng lực.
- **Trình chỉnh sửa mẫu được lưu trữ** với mẫu sẵn sàng để điều chỉnh.
- **Nhiều loại đầu ra hơn từ một API.** Cả hai công bố điểm cuối video và PDF, và Bannerbear còn có tài liệu về đầu ra hoạt ảnh, WebP và AVIF, ảnh chụp màn hình và xóa nền bằng AI.
- **Tích hợp và hỗ trợ riêng của họ.**

Nếu đó là cách tổ chức bạn muốn, các dịch vụ đó là lựa chọn hợp lý.

<!--i:eti-home-->
## Tự lưu trữ mang lại cho bạn điều gì

- **Nội dung của bạn ở lại trên hệ thống của bạn.** Đầu vào, tài nguyên và đầu ra nằm trên hạ tầng bạn đã chọn. Kết xuất trên thiết bị hoặc trong CI không cần dịch vụ.
- **Quy tắc nằm trong công cụ.** Màu sắc, kiểu chữ, logo và đầu vào bị khóa đến từ [hệ thống thiết kế](/info/brand-studio.html) của bạn, nên bên gọi chỉ có thể thay đổi những gì bạn cho phép. [Lolly Work](/info/compare.html#what-runs-where) áp dụng quyền hiển thị công cụ và chính sách đầu vào cho mọi yêu cầu.
- **Cùng một công cụ ở mọi nơi.** Công cụ kết xuất từ cùng đầu vào trên máy tính xách tay, trong tác vụ CI hoặc trên máy chủ. Mọi người có thể chỉnh sửa cùng công cụ đó trong ứng dụng.
- **Bản ghi do bạn giữ.** [Biên nhận kết xuất](/info/work-renders.html#evidence-and-identity), lịch sử kiểm toán và Content Credentials ở nơi bạn cấu hình danh tính ký.
- **Nguồn mở và không tính phí theo mức dùng.** Bạn chạy mã và chỉ trả tiền cho hạ tầng của mình.

Bạn đảm nhận công việc mà các dịch vụ đó làm thay bạn. Máy chủ vận hành lâu dài cần cơ sở dữ liệu bền vững và nơi lưu đầu ra. Công cụ cần trình duyệt thì cần tiến trình xử lý Chromium. [Cài đặt Lolly Work](/info/work-install.html) mô tả cả hai.

<!--i:eti-table-->
## Đối chiếu các công việc

| Công việc | API kết xuất được lưu trữ | Lolly |
|---|---|---|
| Điền mẫu từ dữ liệu | Yêu cầu API nêu tên mẫu và các lớp của nó | [URL](/info/url-mode.html), [CLI](/info/cli.html) hoặc [API máy chủ](/info/work-automation-api.html) nêu tên công cụ và đầu vào của nó |
| Nhiều tệp từ một bảng | Lô và bộ sưu tập | [Batch](/info/batch.html) trên thiết bị của bạn, hoặc [các lô kết xuất](/info/work-renders.html#batches-with-durable-rows) trên máy chủ |
| Chờ hoặc truy vấn định kỳ để lấy kết quả | Truy vấn định kỳ, hoặc tùy chọn đồng bộ | Các bản kết xuất được lưu bền vững mà bạn truy vấn định kỳ, hoặc kết xuất ngay |
| Gọi webhook khi hoàn tất | Có | [Lệnh gọi lại đã ký](/info/work-renders.html) tới các origin bạn cho phép |
| URL động cho ảnh | Có | [Liên kết chia sẻ và URL `/render`](/info/url-mode.html) |
| Chỉnh sửa mẫu | Trình chỉnh sửa được lưu trữ | [Design](/info/using.html), trên thiết bị của bạn |
| Tác tử | Cả hai công bố máy chủ MCP | [MCP](/info/mcp.html), với điểm cuối tổ chức theo chính sách của token trên Lolly Work |

Các loại đầu ra riêng của Lolly được liệt kê trong [Xuất tệp](/info/exporting.html). Hiện tại trên máy chủ Work, các bản kết xuất được lưu bền vững tạo SVG, PNG, JPG và PDF, còn [video ở lại trên thiết bị, CLI và MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

<!--i:eti-folder-move-->
## Những gì chuyển sang được và những gì không

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Yêu cầu của bạn | API di chuyển của Work nhận cùng cấu trúc | Tương tự | Tương tự |
| Mẫu của bạn | **Import** thành tài liệu chỉnh sửa được, trừ các loại lớp chưa có lược đồ được xác nhận | Chỉ tên trường và bản xem trước. Dựng lại từng mẫu | Chỉ tên trường và bản xem trước. Dựng lại từng mẫu |
| URL động hiện có | Không hỗ trợ | Không hỗ trợ | URL đã ký tiếp tục hoạt động sau khi đổi máy chủ, với token riêng tư cũ của bạn |
| Webhook | Không hỗ trợ webhook đã đăng ký | `webhook_url` hoạt động | `webhook_success` hoạt động |
| Đầu ra WebP và AVIF | Bị từ chối theo tên | Không cung cấp | WebP bị từ chối theo tên |
| Hoạt ảnh, video, bộ sưu tập, ảnh chụp màn hình | Không có trên API di chuyển | Không có trên API di chuyển | Không có trên API di chuyển |

::: note Được xây dựng từ tài liệu công khai
Phần này được xây dựng từ tài liệu công khai của từng nhà cung cấp và chưa được chạy với tài khoản thật. Nếu bạn có tài khoản, [hướng dẫn di chuyển](/info/work-move-from-render-api.html#check-it-on-your-own-account) có một danh sách kiểm tra ngắn.
:::

Bạn có thể chuyển một mẫu và giữ phần còn lại ở nguyên chỗ cũ. [Rời Lolly](/info/work-move-from-render-api.html#leave-lolly-too) cũng cởi mở như vậy: công cụ là tệp thông thường và CLI kết xuất chúng mà không cần máy chủ.

<!--i:eti-building-->
## Ai vận hành dịch vụ

Với Lolly, cá nhân kết xuất cục bộ, hoặc nhóm chạy Lolly Work trên hạ tầng riêng. Tác vụ máy chủ gửi đầu vào và tài nguyên cần thiết tới phiên bản triển khai đó. Quy trình trên thiết bị thì không.

Bannerbear và Placid là nhãn hiệu của các chủ sở hữu. Trang này mô tả những điểm trùng nhau giữa các sản phẩm dựa trên tài liệu công khai của họ và không liên kết với bên nào.
