# Lolly và cổng thương hiệu

_Kiểm tra lần cuối: 28 tháng 9 năm 2026._

Lolly và [lolly.work](https://lolly.work) cùng bao quát các quy trình sáng tạo và quản trị mà các nhóm dùng cổng thương hiệu để làm: tài sản đã duyệt, mẫu bị khóa, kiểm soát truy cập, đánh giá và phân phối. Hãy so sánh giải pháp kết hợp đó với Bynder, Frontify, Marq hoặc Brandfolder khi chọn cách mọi người tìm tài sản thương hiệu và tạo tài sản mới.

## Sáng tạo và dịch vụ tổ chức

Engine và ứng dụng của Lolly tạo ra các tệp. Mẫu, design token và đầu vào được phép xác định những gì một người có thể thay đổi, và việc kết xuất có thể ở lại trên thiết bị của họ. Lolly độc lập không cần tài khoản.

lolly.work là dịch vụ tổ chức trong cùng dự án, được duy trì trong một [kho riêng](https://github.com/lolly-tools/lolly-work) và triển khai cùng với Lolly. Dịch vụ này bổ sung nhận diện, lưu trữ dùng chung, chính sách, phê duyệt và báo cáo. Cả hai phần đều là mã nguồn mở theo MPL-2.0. Sự tách biệt này cho phép một cá nhân dùng Lolly độc lập và một tổ chức vận hành giải pháp kết hợp trên hạ tầng do mình kiểm soát.

## Giải pháp kết hợp cung cấp những gì

| Nhu cầu | Lolly + lolly.work |
|---|---|
| Đăng nhập và cấp phát | Đăng nhập một lần (SSO) OIDC, nhiều nhà cung cấp danh tính, cấp phát người dùng SCIM 2.0 và thành viên nhóm, và vô hiệu hóa tài khoản sẽ thu hồi các phiên hiện có. Nhà cung cấp danh tính chỉ hỗ trợ SAML có thể kết nối qua cầu nối OIDC như Keycloak. |
| Mẫu đã duyệt | Lolly xác định các đầu vào có thể chỉnh sửa của mẫu; lolly.work áp dụng chế độ hiển thị theo nhóm và chính sách đầu vào để khóa giá trị, giới hạn lựa chọn hoặc ẩn các điều khiển. |
| Thư viện tài sản dùng chung | Tệp tải lên thuộc về instance, bộ sưu tập, siêu dữ liệu tùy chỉnh và danh mục có kiểm soát truy cập, cùng các trình kết nối đọc thư viện DAM và lưu trữ hiện có. |
| Đánh giá | Các bước phê duyệt theo thứ tự, nhóm người phê duyệt đủ điều kiện, quy tắc đủ số phiếu (quorum) và phân tách nhiệm vụ; quy trình đánh giá có thể chi phối việc gửi vào danh mục và việc phân phối đến các đích của tổ chức. |
| Lịch sử và khả năng sử dụng của tài sản | Phiên bản và khôi phục cho tài sản thuộc về instance, lưu giữ và tạm giữ, lịch phát hành, hết hạn và thu hồi. Các nhà cung cấp được kết nối giữ lịch sử nguồn của riêng họ. |
| Báo cáo | Số lượt dùng và tải xuống tài sản, hoạt động công cụ và xuất tệp, bảng điều khiển và nhật ký kiểm toán. Việc ghi nhận nguồn sử dụng tuân theo chính sách telemetry của bản triển khai; thiết lập ghi nhận mặc định yêu cầu sự đồng ý. |
| Phân phối | Liên kết có thời hạn và có thể thu hồi, bộ sưu tập dùng chung, quyền truy cập cho khách và phân phối đến các đích đã cấu hình của tổ chức. |

[Hướng dẫn dành cho người vận hành lolly.work](https://github.com/lolly-tools/lolly-work/tree/main/docs) mô tả các tính năng này và cách cấu hình. Đây là những khả năng có sẵn, không phải các tính năng đòi hỏi phải xây thêm một hệ thống khác xung quanh Lolly.

## Chọn quy trình cổng thương hiệu

Các cổng thương hiệu lâu năm cung cấp dịch vụ lưu trữ được quản lý, hỗ trợ và nhiều quy trình DAM phong phú. Ví dụ, [DAM doanh nghiệp của Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) kết hợp khám phá tài sản, kiểm soát truy cập, quy trình phê duyệt và phân phối. Hãy so sánh đúng quy trình đánh giá và quyền sử dụng mà bạn cần: Lolly cung cấp siêu dữ liệu, kiểm soát truy cập và khả năng sử dụng, còn việc thông qua pháp lý và nghĩa vụ giấy phép vẫn cần quy trình của tổ chức. Chuỗi phê duyệt của Lolly là tuần tự; chúng không mô hình hóa các quy trình rẽ nhánh tùy ý.

Hệ thống Lolly còn non trẻ hơn, và [trang tình trạng lolly.work](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) ghi lại các giới hạn triển khai của nó. Đặc biệt, trang lolly.work công khai là môi trường thử nghiệm để đánh giá. Một bản triển khai bền vững cho tổ chức cần lưu trữ lâu dài và một người vận hành. Tự lưu trữ không tính phí giấy phép phần mềm theo từng người dùng; hạ tầng và quản trị vẫn tốn chi phí.

Một hệ thống DAM hiện có cũng có thể tiếp tục là nguồn dữ liệu gốc. Các trình kết nối danh mục của lolly.work đưa tài sản đã duyệt của nó vào Lolly, nơi mọi người tạo tệp mới theo quy tắc của tổ chức. Đó là một lựa chọn tích hợp; thư viện và quy trình phê duyệt riêng của Lolly vẫn có sẵn khi tổ chức muốn tự quản lý các quy trình đó.

Xem [Lolly so sánh thế nào](/info/positioning.html) để biết so sánh về khả năng và [So sánh Lolly theo từng công cụ](/info/compare.html) cho phần còn lại của bộ bài này. Tên nhà cung cấp chỉ để nhận diện các sản phẩm được so sánh; Lolly không liên kết với họ.
