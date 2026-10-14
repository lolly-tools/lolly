# Lolly và Adobe

_Kiểm tra lần cuối: 28 tháng 9 năm 2026._

Lolly xử lý chỉnh sửa và chuyển đổi ảnh, bố cục, sản xuất thương hiệu lặp lại, đầu ra in ấn và Content Credentials. [lolly.work](https://lolly.work) bổ sung nhận diện tổ chức, tài sản dùng chung, phê duyệt và sản xuất tự động phía máy chủ vào quy trình sáng tạo đó.

## Điểm giao nhau

Cả hai đều hỗ trợ các công việc như đổi kích thước ảnh, dàn trang và xuất sang các định dạng chuyên nghiệp. Lolly hỗ trợ PDF/X, CMYK và đầu ra raster độ sâu bit cao, kèm [khả năng riêng của từng định dạng](/info/formats.html). Các tiện ích trên thiết bị của Lolly chuyển đổi và làm sạch tệp mà không cần tải lên.

Các ứng dụng chuyên biệt của Adobe bao quát nhiều quy trình sáng tạo. Ví dụ, [Photoshop](https://www.adobe.com/products/photoshop.html) cung cấp các công cụ chỉnh sửa ảnh, chọn vùng, tạo mặt nạ và ghép ảnh chi tiết. Hãy so sánh các thao tác chỉnh sửa mà công việc của bạn cần với các công cụ của Lolly; một tài sản thương hiệu lặp lại và một lần retouch phức tạp có thể có yêu cầu khác nhau.

## Sáng tạo và dịch vụ tổ chức

Lolly độc lập chạy mà không cần tài khoản Adobe hay tài khoản Lolly, dùng cùng một engine trong trình duyệt, ứng dụng máy tính và CLI. Mẫu và design token giúp đầu ra lặp lại được, còn [Chia sẻ kèm quy tắc](/info/create-a-tool.html) biến một thiết kế thành công cụ để người khác điền vào.

lolly.work là một dịch vụ riêng trong dự án Lolly, là mã nguồn mở theo MPL-2.0 giống các ứng dụng sáng tạo. Dịch vụ này cung cấp SSO, SCIM, danh mục và dự án dùng chung, phê duyệt, chính sách truy cập, nhật ký kiểm toán và kết xuất phía máy chủ. Một tổ chức có thể tự vận hành cả hai phần và kết nối các thư viện tài sản hiện có. Việc sáng tạo cục bộ vẫn nằm trên thiết bị; công việc dùng chung và tác vụ máy chủ dùng các dịch vụ đã cấu hình.

## Content Credentials và nhận diện

Lolly có thể ký các bản xuất được hỗ trợ ngay trên thiết bị, với Content Credentials do người dùng bật. Khóa tạo trên thiết bị chứng minh tính toàn vẹn chữ ký của tệp; bên xác minh vẫn phải tin cậy người ký trước khi hiển thị một danh tính đã được xác minh. Một tổ chức có thể dùng tổ chức cấp chứng chỉ (CA) riêng và phân phối chứng chỉ gốc cho các bên xác minh của mình. lolly.work cũng hỗ trợ ký phía máy chủ bằng chứng chỉ và khóa của tổ chức đã được cấu hình.

Nhờ vậy, cả ký cá nhân lẫn ký của tổ chức đều có sẵn trong giải pháp Lolly. Xem [Content Credentials Identity](/info/content-credentials-identity.html), [hướng dẫn ký của lolly.work](https://github.com/lolly-tools/lolly-work/blob/main/docs/c2pa.md) và [tổng quan giải pháp kết hợp](/info/compare.html). Các tiện ích biến đổi trên thiết bị không thêm hình mờ Lolly hay siêu dữ liệu nguồn gốc.

Adobe, Photoshop và Creative Cloud là nhãn hiệu của Adobe. Trang này mô tả những điểm giao nhau giữa các giải pháp và không liên kết với Adobe.
