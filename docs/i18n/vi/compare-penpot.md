# Lolly và Penpot

_Kiểm tra lần cuối: 28 tháng 9 năm 2026._

Nếu đội của bạn thiết kế trong Penpot, Lolly làm việc song song với Penpot: cả hai đều là mã nguồn mở và cùng đọc các design token như nhau. Trang này cho biết mỗi bên dành cho việc gì.

## Penpot làm tốt hơn điều gì

[Penpot](https://penpot.app/) cung cấp thiết kế giao diện, component, bố cục linh hoạt, nguyên mẫu tương tác và kiểm tra cho lập trình viên, với chỉnh sửa thời gian thực và con trỏ trực tiếp. Nó có các bản triển khai lưu trữ và tự lưu trữ, với [tùy chọn cài đặt Docker và Kubernetes](https://help.penpot.app/technical-guide/getting-started/). Để thiết kế một ứng dụng, Penpot là công cụ.

## Điểm giao nhau

[Design token của Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) dùng định dạng DTCG mà Lolly cũng đọc, nên màu sắc, kiểu chữ và các giá trị token khác di chuyển giữa hai bên. [Import a design](/info/design-import.html) của Lolly mở bản xuất `.penpot` như bố cục chỉnh sửa được, và **Send to Penpot** trong Lolly gửi một thiết kế trở lại dưới dạng kho lưu trữ `.penpot`. Lolly cũng duy trì [plugin Lolly Export cho Penpot](https://github.com/lolly-tools/lolly-plugins-penpot-export), dùng engine của Lolly để thêm Content Credentials tùy chọn trên thiết bị.

## Lolly làm phần việc chồng lấn thế nào

Canvas Design của Lolly tạo tài nguyên chỉnh sửa được và có thể biến một bố cục thành [công cụ có quy tắc](/info/create-a-tool.html). Cùng công cụ đó kết xuất trong trình duyệt, ứng dụng máy tính hoặc CLI và tạo các biến thể từ dữ liệu. Lolly độc lập kết xuất và ký trên thiết bị, không cần tài khoản hay máy chủ. Một [collab riêng tư](/info/collaborate.html) ghép hai thiết bị trực tiếp.

## Với một tổ chức

Lolly Work thêm đăng nhập một lần, cấp tài khoản SCIM, danh mục và dự án chung, vai trò, phê duyệt, bản ghi kiểm toán, work collab và kết xuất trên máy chủ. Cả hai kho đều theo MPL-2.0 và một tổ chức có thể chạy cả hai. [What runs where](/info/compare.html#what-runs-where) đặt hai phần cạnh nhau.

Bạn có thể dùng cả hai: Penpot cho thiết kế giao diện và nguyên mẫu, Lolly cho các tệp lặp lại, nối với nhau bằng token chung và thiết kế đã nhập.

Penpot là nhãn hiệu của chủ sở hữu nó. Trang này mô tả nơi hai sản phẩm chồng lấn và không liên kết với Penpot.
