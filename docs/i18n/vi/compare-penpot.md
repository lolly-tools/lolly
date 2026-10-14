# Lolly và Penpot

_Kiểm tra lần cuối: 28 tháng 9 năm 2026._

Lolly và Penpot đều cung cấp công cụ thiết kế mã nguồn mở, design token dùng chung và cộng tác trực tiếp. Lolly kết hợp việc sáng tạo trên thiết bị với [lolly.work](https://lolly.work), dịch vụ tổ chức được triển khai riêng.

## Nền tảng thiết kế chung

[Design token của Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) dùng định dạng DTCG, mà Lolly cũng đọc được. Màu sắc, kiểu chữ và các giá trị token khác có thể được chia sẻ giữa hai quy trình. [Import a design](/info/design-import.html) của Lolly mở bản xuất `.penpot` thành bố cục có thể chỉnh sửa.

Plugin Lolly Export cho Penpot do Lolly duy trì. Nó dùng engine của Lolly để tạo C2PA Content Credentials tùy chọn ngay trên thiết bị. Tính toàn vẹn chữ ký và sự tin cậy vào người ký là hai việc riêng biệt: bên xác minh cần một danh tính mà họ tin cậy, như được mô tả trong [Content Credentials Identity](/info/content-credentials-identity.html).

## Quy trình thiết kế và làm việc nhóm

[Penpot](https://penpot.app/) cung cấp thiết kế giao diện, thành phần, bố cục linh hoạt, nguyên mẫu tương tác và kiểm tra dành cho lập trình viên. Penpot có cả bản triển khai được lưu trữ và tự lưu trữ, với [các tùy chọn cài đặt Docker và Kubernetes](https://help.penpot.app/technical-guide/getting-started/).

Canvas Design của Lolly tạo tài sản có thể chỉnh sửa và có thể biến một bố cục thành [công cụ có quy tắc](/info/create-a-tool.html). Cùng một công cụ kết xuất trong trình duyệt, ứng dụng máy tính hoặc CLI và có thể tạo biến thể từ dữ liệu. Về làm việc nhóm, Lolly có cả [collab riêng tư](/info/collaborate.html) trực tiếp giữa hai thiết bị và collab làm việc qua lolly.work, với chỉnh sửa chung, con trỏ và các phiên nhóm đã lưu.

## Các bản triển khai khác nhau thế nào

Lolly độc lập kết xuất và ký trên thiết bị mà không cần tài khoản hay máy chủ. lolly.work bổ sung SSO, cấp phát SCIM, danh mục và dự án dùng chung, vai trò, phê duyệt, nhật ký kiểm toán và kết xuất phía máy chủ. Cả hai kho đều là mã nguồn mở MPL-2.0 và tổ chức có thể tự vận hành. Công việc dùng chung dùng instance đã cấu hình; việc sáng tạo cục bộ vẫn có sẵn một cách độc lập.

Lựa chọn tùy thuộc vào công việc: quy trình thiết kế giao diện và tạo nguyên mẫu của Penpot, quy trình sản xuất tài sản lặp lại của Lolly, hoặc sự kết hợp dùng token dùng chung và thiết kế được nhập. Cộng tác làm việc của Lolly hiện chạy trên một nút máy chủ duy nhất, và [tình trạng triển khai](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) của nó nên là một phần trong việc đánh giá của tổ chức.

Penpot là nhãn hiệu của chủ sở hữu. Plugin nêu trên là của Lolly. Xem [Lolly so sánh thế nào](/info/positioning.html) và [tổng quan giải pháp kết hợp](/info/compare.html) để có so sánh rộng hơn.
