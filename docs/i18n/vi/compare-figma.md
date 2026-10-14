# Lolly và Figma

_Kiểm tra lần cuối: 28 tháng 9 năm 2026._

Lolly hỗ trợ thiết kế, chỉnh sửa trực tiếp và sản xuất tài sản có thể tái sử dụng. [lolly.work](https://lolly.work) bổ sung các dịch vụ tổ chức xung quanh công việc đó: nhận diện, dự án dùng chung, kiểm soát truy cập và phê duyệt.

## Điểm giao nhau

Cả hai đều cho phép bố trí chữ, hình khối và hình ảnh trên canvas và làm việc với người khác. [Import a design](/info/design-import.html) của Lolly đọc tệp Figma thành bố cục có thể chỉnh sửa. Figma cũng bao quát sản xuất thương hiệu dựa trên mẫu: [Figma Buzz](https://help.figma.com/hc/en-us/articles/31271566667543-Guide-to-Figma-Buzz) tạo tài sản từ mẫu và điền dữ liệu từ tệp CSV hoặc XLSX.

Lolly biến một thiết kế thành [công cụ có quy tắc, tái sử dụng được](/info/create-a-tool.html). Công cụ đó chạy trong trình duyệt hoặc CLI và nhận đầu vào từ URL, tập lệnh hoặc lưới xử lý hàng loạt. Cùng một mẫu phục vụ cả một cá nhân chỉnh sửa một tài sản lẫn một nhóm tạo nhiều biến thể.

## Cộng tác và thiết kế sản phẩm

[Figma Design](https://www.figma.com/design/) tập hợp thiết kế giao diện, thành phần, nguyên mẫu tương tác và bàn giao cho lập trình viên. Quy trình thiết kế sản phẩm và hệ sinh thái đã khẳng định của nó phù hợp khi một nhóm cần thiết kế và đặc tả một ứng dụng hoàn chỉnh.

Lolly cung cấp hai kiểu cộng tác trực tiếp. [Collab riêng tư](/info/collaborate.html) ghép trực tiếp hai thiết bị, không cần tài khoản và không cần internet trên cùng một mạng. Collab làm việc dùng lolly.work để truy cập có xác thực, chỉnh sửa chung, con trỏ trực tiếp và các phiên nhóm đã lưu. Cộng tác làm việc được triển khai ở cả máy khách Lolly và máy chủ lolly.work; bản triển khai một nút hiện tại chưa chứng minh được sự tương đương với quy mô vận hành của Figma.

## Triển khai và sản xuất

Các ứng dụng sáng tạo của Lolly và lolly.work là những phần được triển khai riêng của cùng một dự án mã nguồn mở. Lolly độc lập có thể kết xuất ngoại tuyến mà không cần tài khoản. lolly.work cung cấp SSO, SCIM, danh mục dùng chung, quyền dự án, phê duyệt, nhật ký kiểm toán và kết xuất phía máy chủ trên hạ tầng do tổ chức kiểm soát.

Các phiên nhóm và chỉnh sửa collab làm việc được gửi đến instance đó; các bản kết xuất cục bộ có thể ở lại trên thiết bị. Content Credentials là tùy chọn đối với các bản xuất được hỗ trợ, và ký phía máy chủ dùng danh tính tổ chức đã cấu hình. Xem [tổng quan giải pháp kết hợp](/info/compare.html) về sự tách biệt và [Content Credentials Identity](/info/content-credentials-identity.html) về cách bên xác minh tin cậy người ký.

Figma là nhãn hiệu của chủ sở hữu. Trang này mô tả những điểm giao nhau giữa hai giải pháp và không liên kết với Figma.
