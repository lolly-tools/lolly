# Lolly và API kết xuất

_Kiểm tra lần cuối: 28 tháng 9 năm 2026._

Nếu hiện bạn tạo ảnh từ mẫu qua một API, trang này cho biết Lolly làm cùng việc đó thế nào trên thiết bị của chính bạn, trong CI hoặc trên máy chủ của bạn.

## Các API kết xuất được lưu trữ làm tốt hơn điều gì

[Bannerbear](https://www.bannerbear.com/) và [Placid](https://placid.app/) đóng gói kết xuất thành dịch vụ được quản lý, với hạ tầng, tích hợp và hỗ trợ riêng. Bạn gửi một yêu cầu và người khác vận hành máy chủ.

## Điểm giao nhau

Cả hai đều biến một mẫu cộng đầu vào thành phương tiện. Lolly lấy đầu vào từ một [liên kết](/info/url-mode.html), [CLI](/info/cli.html), lưới batch hoặc một điểm cuối máy chủ.

## Lolly làm phần việc chồng lấn thế nào

Cùng một công cụ kết xuất trên laptop, trong một tác vụ CI hoặc trên máy chủ, từ cùng các đầu vào. Kết xuất cục bộ và CI không cần dịch vụ nào.

![Cài đặt xuất Batch: tên tệp, định dạng mặc định, đơn vị, DPI và số hàng cần kết xuất](/info/shots/use-batch-toolbar.svg)

Trên máy chủ, [Lolly Work](/info/compare.html#what-runs-where) chạy engine Lolly sau một API và áp dụng khả năng hiển thị công cụ và chính sách đầu vào. [Dịch vụ kết xuất khôi phục được](/info/work-renders.html) của nó hỗ trợ tác vụ đơn và batch, gửi idempotent, trạng thái, thử lại có giới hạn, hủy và giữ đầu ra, và công việc bị gián đoạn tiếp tục sau khi khởi động lại khi cấu hình lưu trữ liên tục.

Máy chủ có đường SVG và PNG nhanh và một worker Chromium tùy chọn cho các công cụ cần trình duyệt. Tự động hóa đăng nhập bằng token dịch vụ, đầu ra hoàn tất có thể đi qua [bàn giao đã duyệt](/info/work-delivery.html) tới các đích của tổ chức, và danh tính ký đã cấu hình thêm Content Credentials vào đầu ra được hỗ trợ.

## Ai vận hành dịch vụ

Với Lolly, một cá nhân kết xuất cục bộ, hoặc một đội chạy Lolly Work trên hạ tầng của chính mình. Gửi một tác vụ lên máy chủ là gửi đầu vào và tài nguyên cần thiết của nó tới phiên bản đó, khác với đường chạy trên thiết bị. Một dịch vụ bền vững cần cơ sở dữ liệu liên tục và nơi lưu trữ đầu ra, và các công cụ phụ thuộc trình duyệt cần worker Chromium; [Install Lolly Work](/info/work-install.html) mô tả cả hai.

Bannerbear và Placid là nhãn hiệu của chủ sở hữu chúng. Trang này mô tả nơi các sản phẩm chồng lấn và không liên kết với bên nào.
