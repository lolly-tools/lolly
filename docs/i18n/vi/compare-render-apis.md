# Lolly và API kết xuất

_Kiểm tra lần cuối: 28 tháng 9 năm 2026._

Lolly tạo tài sản từ mẫu và dữ liệu trên thiết bị của bạn, trong CI hoặc qua API máy chủ của [lolly.work](https://lolly.work). Giải pháp kết hợp bao quát việc kết xuất tự động cũng như nhận diện, chính sách và phân phối xung quanh các tác vụ sản xuất của tổ chức.

## Điểm giao nhau

[Bannerbear](https://www.bannerbear.com/) và [Placid](https://placid.app/) tạo hình ảnh và nội dung đa phương tiện khác từ mẫu thông qua API và tích hợp. Lolly dùng cùng cách tiếp cận mẫu cộng đầu vào, với [chế độ URL](/info/url-mode.html), [CLI](/info/cli.html), lưới xử lý hàng loạt và các endpoint máy chủ là những cách gửi công việc.

## lolly.work cung cấp những gì

lolly.work là dịch vụ tổ chức được triển khai riêng trong dự án Lolly. Nó chạy engine Lolly phía sau một API, áp dụng chính sách hiển thị công cụ và đầu vào, đồng thời phục vụ các tệp đã kết xuất và liên kết chia sẻ có chữ ký. [Dịch vụ kết xuất có thể phục hồi](https://github.com/lolly-tools/lolly-work/blob/main/docs/renders.md) của nó hỗ trợ tác vụ đơn lẻ và theo lô, gửi bất biến (idempotent), trạng thái, thử lại có giới hạn, hủy và lưu giữ đầu ra. Công việc bị gián đoạn có thể tiếp tục sau khi máy chủ khởi động lại khi đã cấu hình lưu trữ bền vững.

Máy chủ dùng đường kết xuất SVG/PNG nhanh và một worker Chromium tùy chọn cho các công cụ cần trình duyệt. Tự động hóa xác thực bằng service token, và đầu ra đã hoàn tất có thể được gửi qua [phân phối có quản trị](https://github.com/lolly-tools/lolly-work/blob/main/docs/delivery.md) đến các đích của tổ chức. Một danh tính ký đã cấu hình cho phép ký C2PA trên đầu ra máy chủ được hỗ trợ.

## Ai vận hành dịch vụ

Bannerbear và Placid đóng gói việc kết xuất thành các dịch vụ được quản lý với hạ tầng và tích hợp riêng. Với Lolly, một cá nhân có thể kết xuất cục bộ hoặc một nhóm có thể vận hành lolly.work trên hạ tầng của chính mình. Cả hai kho của Lolly đều là mã nguồn mở MPL-2.0; tự lưu trữ không tính phí giấy phép phần mềm theo từng lần kết xuất, trong khi tính toán, lưu trữ và vận hành vẫn là các chi phí cần lên kế hoạch.

Trang lolly.work công khai là môi trường thử nghiệm để đánh giá, không phải cam kết lưu trữ cho môi trường sản xuất. Một dịch vụ bền vững cần cơ sở dữ liệu và lưu trữ đầu ra bền vững; các công cụ phụ thuộc trình duyệt cần worker Chromium. [Hướng dẫn cài đặt](https://github.com/lolly-tools/lolly-work/blob/main/docs/install.md) và [trang tình trạng](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) mô tả các yêu cầu này và giới hạn hiện tại.

Kết xuất cục bộ và trong CI vẫn có sẵn mà không cần dịch vụ tổ chức. Việc gửi một tác vụ máy chủ sẽ gửi đầu vào và các tài sản cần thiết của nó đến instance đó; điều này khác với đường xử lý trên thiết bị. Xem [tổng quan giải pháp kết hợp](/info/compare.html).

Bannerbear và Placid là nhãn hiệu của chủ sở hữu tương ứng. Trang này mô tả những điểm giao nhau giữa các giải pháp và không liên kết với bên nào trong hai bên.
