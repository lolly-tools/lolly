# Lolly và Penpot

_Kiểm tra lần cuối: 28 tháng 9 năm 2026._

Nếu nhóm bạn thiết kế trong Penpot, Lolly hoạt động bên cạnh Penpot. Cả hai đều là nguồn mở và đọc cùng token thiết kế. Trang này cho biết mỗi bên dành cho công việc nào.

<!--i:eti-award-->
## Penpot làm tốt hơn ở điểm nào

[Penpot](https://penpot.app/) cung cấp thiết kế giao diện, thành phần, bố cục linh hoạt, nguyên mẫu tương tác và chức năng kiểm tra cho lập trình viên, với chỉnh sửa thời gian thực và con trỏ trực tiếp. Nó có các cách triển khai được lưu trữ và tự lưu trữ, với [tùy chọn cài đặt Docker và Kubernetes](https://help.penpot.app/technical-guide/getting-started/). Để thiết kế ứng dụng, Penpot là công cụ phù hợp.

<!--i:eti-blend-->
## Những điểm trùng nhau

[Token thiết kế của Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) dùng định dạng DTCG mà Lolly cũng đọc, nên màu sắc, kiểu chữ và các giá trị token khác chuyển được giữa hai bên. [Nhập thiết kế](/info/design-import.html) của Lolly mở bản xuất `.penpot` thành bố cục chỉnh sửa được, và **Send to Penpot** trong Lolly gửi thiết kế trở lại dưới dạng gói lưu trữ `.penpot`. Lolly cũng duy trì [plugin Lolly Export cho Penpot](https://github.com/lolly-tools/lolly-plugins-penpot-export), dùng bộ máy của Lolly để thêm Content Credentials trên thiết bị khi người dùng chọn bật.

<!--i:eti-lolly-->
## Lolly thực hiện công việc trùng nhau như thế nào

Canvas Lolly Design tạo tài nguyên chỉnh sửa được và có thể biến bố cục thành [công cụ có quy tắc](/info/create-a-tool.html). Cùng công cụ đó kết xuất trong trình duyệt, ứng dụng máy tính hoặc CLI và tạo biến thể từ dữ liệu. Lolly độc lập kết xuất và ký trên thiết bị, không cần tài khoản hay máy chủ. Một [phiên cộng tác riêng tư](/info/collaborate.html) ghép đôi trực tiếp hai thiết bị.

<!--i:eti-building-->
## Khi dùng cùng tổ chức

Lolly Work thêm đăng nhập một lần, cấp phát qua SCIM, danh mục và dự án dùng chung, vai trò, phê duyệt, bản ghi kiểm toán, phiên cộng tác công việc và kết xuất máy chủ. Cả hai kho mã dùng MPL-2.0 và tổ chức có thể chạy cả hai. [Phần nào chạy ở đâu](/info/compare.html#what-runs-where) đặt hai phần cạnh nhau.

Bạn có thể dùng cả hai: Penpot để thiết kế giao diện và tạo nguyên mẫu, Lolly để tạo tệp có thể lặp lại.

Penpot là nhãn hiệu của chủ sở hữu. Trang này mô tả những điểm trùng nhau giữa hai sản phẩm và không liên kết với Penpot.
