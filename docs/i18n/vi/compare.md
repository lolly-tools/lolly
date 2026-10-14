# So sánh Lolly theo từng công cụ

Lolly bao quát công việc sáng tạo, từ một lần chuyển đổi tệp ngay trên thiết bị đến sản xuất tài sản có quản trị trong một tổ chức. Các trang này so sánh quy trình làm việc mà từng sản phẩm hỗ trợ, cách triển khai và những giới hạn quan trọng khi chọn giải pháp.

_Kiểm tra lần cuối: 28 tháng 9 năm 2026._

## Một dự án, hai phần triển khai riêng biệt

**Lolly** là bộ engine, ứng dụng và công cụ để tạo, chỉnh sửa, chuyển đổi và xuất tệp. Lolly chạy trên thiết bị của bạn, hoạt động ngoại tuyến khi đã có sẵn các tài sản cần thiết và không cần tài khoản khi dùng độc lập.

**[lolly.work](https://lolly.work)** là dịch vụ tổ chức của dự án, được duy trì trong [kho lolly-work](https://github.com/lolly-tools/lolly-work). Dịch vụ này cung cấp SSO, cấp phát SCIM, vai trò và chính sách, danh mục và dự án dùng chung, phê duyệt, cộng tác làm việc, báo cáo sử dụng, nhật ký kiểm toán và kết xuất phía máy chủ. Cả hai phần đều là mã nguồn mở theo MPL-2.0. Một tổ chức tự lưu trữ lolly.work cùng với Lolly và quyết định bật những dịch vụ nào.

Các bài so sánh áp dụng cho **Lolly + lolly.work**. Những tính năng cần dịch vụ tổ chức đều được nêu rõ. Khi dùng độc lập, tệp luôn nằm trên thiết bị; nếu chọn dự án dùng chung, cộng tác làm việc, kết xuất phía máy chủ hoặc phân phối, dữ liệu liên quan sẽ được gửi đến các dịch vụ đã cấu hình. Trang lolly.work công khai là môi trường thử nghiệm (sandbox); xem [hướng dẫn triển khai](https://github.com/lolly-tools/lolly-work/blob/main/docs/install.md) và [tình trạng hiện tại](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) để triển khai cho một tổ chức.

## So sánh theo quy trình làm việc

- [Lolly và Canva](/info/compare-canva.html) - mẫu, thiết kế hằng ngày và sản xuất thương hiệu dùng chung.
- [Lolly và Adobe](/info/compare-adobe.html) - chỉnh sửa, chuyển đổi, đầu ra chuyên nghiệp và Content Credentials.
- [Lolly và Figma](/info/compare-figma.html) - thiết kế, cộng tác trực tiếp và sản xuất tài sản có thể tái sử dụng.
- [Lolly và Penpot](/info/compare-penpot.html) - thiết kế mã nguồn mở, token dùng chung và quy trình của tổ chức.
- [Lolly và cổng thương hiệu](/info/compare-brand-portals.html) - thư viện đã duyệt, mẫu bị khóa, nhận diện, đánh giá và báo cáo.
- [Lolly và API kết xuất](/info/compare-render-apis.html) - tạo tự động trên thiết bị của bạn, trong CI hoặc qua lolly.work.
- [Lolly và trình chuyển đổi tệp trực tuyến](/info/compare-converters.html) - chuyển đổi định dạng ngay trên thiết bị của bạn.

Để xem so sánh theo từng khả năng, hãy đọc [Lolly so sánh thế nào](/info/positioning.html). Mỗi bài so sánh đều có ghi ngày; nhận định nào không còn khớp với một trong hai sản phẩm thì cần được sửa lại.
