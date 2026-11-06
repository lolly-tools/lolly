# Lolly và cổng thương hiệu

_Định vị cập nhật: 31 tháng 10 năm 2026. Ví dụ năng lực của nhà cung cấp được kiểm tra: 28 tháng 9 năm 2026._

Nếu tổ chức của bạn giữ tài nguyên đã duyệt trong Bynder, Frontify, Marq hoặc Brandfolder, trang này so sánh điều đó với Lolly cộng Lolly Work: mọi người tìm tài nguyên thương hiệu ra sao, và tạo tệp mới từ đó thế nào.

## Giữ cổng thông tin hiện có của bạn

Một DAM hiện có có thể vẫn là nguồn ghi chép. Các trình kết nối danh mục của Lolly Work đưa một phần được chọn của thư viện đó vào Lolly, nơi mọi người tạo tệp mới theo quy tắc của tổ chức. Các ràng buộc nguồn được hỗ trợ của DAM và quy tắc hiển thị của Lolly Work chi phối quyền truy cập; việc xem xét đầu ra cuối cùng là một quyết định riêng.

[Use Lolly with your existing DAM](/info/use-with-dam.html) giải thích các trách nhiệm và giới hạn. [SUSE's Brandfolder experience](/info/suse-brandfolder.html) ghi lại một lần tích hợp thành công đã hỗ trợ việc quản lý thay đổi của quản trị viên trước một cuộc chuyển đổi đã lên kế hoạch. Giữ nguồn được kết nối vẫn là một lựa chọn được hỗ trợ.

Mục đích của Lolly là [chủ quyền nội dung](/info/content-sovereignty.html), gồm quyền kiểm soát sản xuất và tự do chọn hệ thống. Thư viện và phê duyệt riêng của nó hỗ trợ các tổ chức chọn tự vận hành những năng lực đó. [Lolly for DAM vendors and implementation partners](/info/dam-partners.html) mô tả cách quy trình được kết nối có thể thêm giá trị cho một hệ thống ghi chép hiện có.

## Một cổng thông tin lâu đời làm tốt hơn điều gì

Các cổng lâu đời cung cấp lưu trữ được quản lý, hỗ trợ và quy trình quản lý tài nguyên phong phú. Chẳng hạn, [DAM doanh nghiệp của Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) kết hợp khám phá tài nguyên, kiểm soát truy cập, quy trình phê duyệt và phân phối. Bộ Lolly còn non trẻ hơn và chuỗi phê duyệt của nó tuần tự thay vì quy trình rẽ nhánh tùy ý. [Lolly Work status and roadmap](/info/work-status.html) ghi các giới hạn triển khai của nó.

## Điểm giao nhau

Cả hai đều bao gồm tài nguyên đã duyệt, mẫu bị khóa, kiểm soát truy cập, xem xét và phân phối. Lolly làm ra các tệp: mẫu, design token và đầu vào được phép định nghĩa người dùng được đổi gì, và kết xuất có thể ở lại thiết bị của họ. Lolly Work thêm danh tính, lưu trữ chung, chính sách, phê duyệt và báo cáo trên hạ tầng mà tổ chức kiểm soát.

![Hệ thống thiết kế đang dùng trong Settings, hiện dưới dạng bìa và các trang: màu sắc, kiểu chữ và logo mà mọi công cụ vẽ bằng chúng](/info/shots/dashboard-brand.svg)

## Lolly và Lolly Work cung cấp gì

| Nhu cầu | Lolly + Lolly Work |
|---|---|
| Đăng nhập và cấp tài khoản | Đăng nhập một lần OIDC, nhiều nhà cung cấp danh tính, cấp người dùng SCIM 2.0 và tư cách thành viên nhóm, và vô hiệu hóa tài khoản thu hồi các phiên hiện có. Một nhà cung cấp danh tính chỉ dùng SAML có thể kết nối qua cầu OIDC như Keycloak. |
| Mẫu đã duyệt | Lolly định nghĩa đầu vào chỉnh sửa được của mẫu; Lolly Work áp dụng hiển thị theo nhóm và chính sách đầu vào để khóa giá trị, hạn chế lựa chọn hoặc ẩn điều khiển. |
| Thư viện tài nguyên chung | Tệp tải lên thuộc phiên bản, bộ sưu tập, siêu dữ liệu tùy chỉnh và danh mục có kiểm soát truy cập, cùng trình kết nối đọc các thư viện DAM và lưu trữ hiện có. |
| Xem xét | Các bước phê duyệt có thứ tự, nhóm người duyệt đủ điều kiện, quy tắc đủ số phiếu và phân tách nhiệm vụ; xem xét có thể quản trị bản gửi danh mục và bàn giao tới các đích của tổ chức. |
| Lịch sử và tính sẵn có của tài nguyên | Phiên bản và hoàn nguyên cho tài nguyên thuộc phiên bản, lưu giữ và tạm giữ, thời điểm có sẵn theo lịch, hết hạn và thu hồi. Nhà cung cấp kết nối giữ lịch sử nguồn của riêng họ. |
| Giấy phép và ghi công | Lolly ghi giấy phép của mỗi nguồn mà một tệp dùng và chuẩn bị phần ghi công cần có; [Creative rights and credits](/info/creative-rights.html) giải thích nó ghi gì và phần ghi công được viết ở đâu. Nó không xác nhận quyền. |
| Báo cáo | Số lần dùng và tải tài nguyên, hoạt động công cụ và xuất, bảng điều khiển và nhật ký kiểm toán. Việc gán lượt dùng theo chính sách telemetry của bản triển khai; cài đặt gán mặc định đòi sự đồng ý. |
| Phân phối | Liên kết hết hạn, thu hồi được, bộ sưu tập chung, truy cập khách và bàn giao tới các đích tổ chức đã cấu hình. |
| Một trang thương hiệu công khai | Lolly viết một [trang thương hiệu](/info/brand-page.html) tĩnh, từ Lolly Design System Setup hoặc dòng lệnh: logo, màu sắc, kiểu chữ, quy tắc và ví dụ cho con người, cùng token, `DESIGN.md` và skill cho agent. Bạn tự lưu trữ thư mục đó, hoặc một quản trị viên bật [lưu trữ trang thương hiệu](/info/work-design-system-administration.html#host-a-brand-page) trong Lolly Work, mặc định đang tắt. |

[Catalog and content](/info/work-catalog.html), [Approvals](/info/work-approvals.html) và [Policy and governance](/info/work-governance.html) mô tả các tính năng này và cấu hình của chúng.

## Đánh giá quy trình kết hợp

Dùng [chuỗi sản xuất thẻ sự kiện](/info/dam-production.html) để kiểm tra quyền truy cập nguồn, các chỉnh sửa được phép, việc xem xét đầu ra và bàn giao với thư viện của chính bạn. [What runs where](/info/compare.html#what-runs-where) liệt kê các giới hạn mà mọi so sánh dùng chung. Một kết nối nguồn tự nó không thiết lập quan hệ đối tác với nhà cung cấp hay tư cách đạt chuẩn cho mọi tenant.

Xem [How Lolly compares](/info/positioning.html) để so sánh khả năng. Tên nhà cung cấp chỉ nhằm xác định các sản phẩm được so sánh; Lolly không liên kết với họ.
