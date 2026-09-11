# Lolly dành cho người vận hành

Bạn được là người đã gật đầu với một thứ vừa an toàn vừa được ưa chuộng. Bạn khép lại một lỗ hổng rò rỉ dữ liệu, có thêm năng lực và xóa bỏ một hàng đợi yêu cầu chỉ trong một bước, đây là kiểu thắng lợi bảo mật hiếm có khiến bạn được yêu mến hơn chứ không phải ít hơn: không còn cuộc gọi lúc 3 giờ sáng vì tệp bị hạn chế lọt vào một công cụ web ngẫu nhiên nào đó, ít nhà cung cấp và hợp đồng hơn trên bàn làm việc của bạn và một hồ sơ bạn có thể chỉ ra khi có ai đó hỏi. Hãy chọn lối đi bên dưới phù hợp với chức năng bạn phụ trách.

Bạn quản trị toàn bộ cuộc chạy tiếp sức: một người làm sáng tạo soạn ra các quy tắc và một nhà phát triển mở rộng chúng, còn chính quản trị viên là người khiến việc đó an toàn để vận hành trên toàn bộ tổ chức, điều mà [Vòng đời của một chiến dịch](/info/overview.html#the-lifecycle-of-a-campaign) theo dõi từ đầu đến cuối.

Mới đến đây? [Áp dụng & Quản trị](/info/adoption-governance.html) trình bày toàn bộ quá trình triển khai. [Triển khai](/info/deployment.html) bao quát việc deploy, phục vụ và mô hình lai, còn [Cấu hình](/info/configuration.html) là những gì định hình một instance đơn lẻ.

## Kinh doanh

Bước vào cuộc họp với đúng tệp bạn cần, được làm ngay trên đường đến đó. Thả bộ slide bạn đã có sẵn vào và dựng lại nó sắc nét thành một tệp slide gốc, không có hàng đợi yêu cầu nào chen giữa bạn và tài sản.

- **[Lolly cho đội ngũ kinh doanh](/info/sales.html)** - cẩm nang: sửa lại bộ slide bạn đang có, dựng lại nó theo kiểu gốc và tự làm tài sản dùng một lần.
- **[Xuất & Định dạng](/info/exporting.html)** - phần slide, PDF và hình ảnh trong bảng xuất, khi tệp phải mở được trên laptop của người khác.

## Báo chí

Dữ liệu trực tiếp biến thành biểu đồ, bản đồ và bảng biểu đã sẵn khớp với house style. Dựng định dạng bài viết một lần và tái sử dụng nó mỗi khi bài chạy, cho cả bản in lẫn màn hình.

- **[Lolly cho tòa soạn](/info/press.html)** - cẩm nang: phong cách info-editorial, dữ liệu trực tiếp đầu vào và đầu ra chất lượng xuất bản.
- **[Các khung nhìn tiện ích](/info/utilities.html)** - bảng tính và bộ chuyển đổi, cho bước trước khi vẽ biểu đồ.

## Marketing

Mọi kích thước, mọi ngôn ngữ, một nguồn dữ liệu chuẩn duy nhất. Dán vào một bảng tính và nhận về một tệp hoàn chỉnh cho mỗi hàng, không cần agency nào chen vào giữa những tệp thường nhật.

- **[Lolly cho đội ngũ marketing](/info/marketing.html)** - cẩm nang: tạo biến thể quy mô lớn, bản địa hóa và những gì không còn là nút thắt cổ chai.
- **[Sử dụng Lolly](/info/using.html#batch-pro-mode)** - chính lượt chạy hàng loạt: một bảng tính vào, một thư mục tài sản ra.

## Bảo mật

Cách công việc sáng tạo thường nhật vẫn hay được thực hiện chính là một bề mặt rủi ro: tệp được gửi email cho nhà thầu bên ngoài, tài sản thương hiệu được tải lên hàng chục trình chỉnh sửa web, dữ liệu khách hàng được dán vào trang web của người lạ chỉ để làm nhanh một hình ảnh. Lolly là phản ứng miễn dịch trước điều đó, vì nó thay thế chính công việc đó thay vì chỉ thêm một lớp kiểm soát lên trên: thẻ trích dẫn, banner bản địa hóa và ảnh chụp màn hình đã được che thông tin đều được làm ngay trên thiết bị của nhân viên theo đúng thương hiệu của bạn, nên không có gì được tải lên ngoài những gì bạn tự đưa vào, và mọi kết quả đều có thể tái tạo lại từ chính đầu vào của nó. Bản xuất có thể mang theo nhiều lớp ghi nhận mật mã học - một Content Credential theo chuẩn C2PA được ký bằng một khóa được tạo ra ngay trên thiết bị và không bao giờ có thể đọc được ra ngoài, Lolly Imprint vô hình và một dấu bền vững tùy chọn tồn tại qua cả những lần lưu lại - mỗi lớp trong số đó đều có thể phát hiện can thiệp và có thể bị gỡ bỏ: một credential chỉ báo hiệu một thay đổi chứ không ngăn chặn nó, và chính điều đó mới là thứ khiến việc xác minh hoàn toàn ngoại tuyến trở nên khả thi. Mật mã học và các bộ phân tích tệp đang trải qua quá trình gia cố cấp doanh nghiệp của SUSE: các con dấu, việc ký trên thiết bị và mã hóa đã là thật và có thể bảo vệ được ngay bây giờ, nên ở nơi hợp đồng yêu cầu đảm bảo có chứng nhận, hãy triển khai chúng như một lớp phòng thủ theo chiều sâu trong khi quá trình đó hoàn tất.

- **[Trust](/info/trust.html)** - mọi tuyên bố trang này đưa ra, kèm theo cơ chế thực thi nó ngay bên cạnh.
- **[Bảo mật & Xác minh](/info/security.html)** - các tiêu chuẩn, nguyên hàm mật mã, mô hình tin cậy và việc kiểm thử, viết cho một người thẩm định.
- **[Mô hình đe dọa & Ranh giới tin cậy](/info/threat-model.html)** - Lolly phòng vệ trước điều gì, nó rõ ràng không phòng vệ trước điều gì và mỗi ranh giới nằm ở đâu.
- **[Bề mặt máy chủ](/info/server-surface.html)** - bản kiểm kê đầy đủ những gì chạy phía máy chủ (hai thành phần tùy chọn) đối chiếu với những gì chạy trên thiết bị.
- **[Danh mục bộ phân tích](/info/parser-inventory.html)** - mọi bộ phân tích chạm vào một tệp mà người dùng mở, và mỗi bộ được gia cố chống lại điều gì.
- **[Tự mình xác minh](/info/verify-yourself.html)** - đối chiếu các tuyên bố với một bản xuất thật, từng bước một, không có gì mà bạn không thể tự chạy được.
- **[Chính sách quyền riêng tư](/info/privacy.html)** - tuyên bố chính thức về những gì được và không được thu thập, lưu trữ và gửi đi.
- **[Sản xuất sáng tạo có chủ quyền](/info/sovereign-production.html)** - triển khai air-gapped, kết nối mạng có cổng đồng ý và ký trên thiết bị.
- **[Áp dụng & Quản trị](/info/adoption-governance.html)** - ai phê duyệt một công cụ, quy tắc thương hiệu trở nên thực thi được như thế nào và tùy chọn danh mục dưới dạng repository mang lại lợi ích gì.

## Pháp lý

MPL-2.0 không kèm thỏa thuận cấp phép người đóng góp, được nói rõ ràng, với những gì không được tuyên bố cũng được nói rõ như những gì được tuyên bố. Content Credentials có thể phát hiện can thiệp và có thể bị gỡ bỏ, nên các trang bên dưới nói rõ một chữ ký thực sự khẳng định điều gì trước khi ai đó đưa nó vào một hợp đồng.

- **[Gắn nhãn AI và Đạo luật AI của EU](/info/eu-ai-act.html)** - Article 50, Code of Practice chỉ đến C2PA và vị trí thực sự phù hợp của Lolly.
- **[So sánh Lolly với các lựa chọn khác](/info/positioning.html)** - các sự thật về giấy phép: MPL-2.0, không thỏa thuận cấp phép người đóng góp và điều gì thực sự làm nền cho việc miễn phí mãi mãi.
- **[Định danh Content Credentials](/info/content-credentials-identity.html)** - một credential đã ký khẳng định điều gì, không khẳng định điều gì và chứng chỉ nêu tên ai.
- **[Chuyển dữ liệu](/info/data-transfer.html)** - gói sao lưu dùng để đáp ứng một yêu cầu hồ sơ hoặc một lượt bàn giao thiết bị.

## AI

Agent chỉ cung cấp đầu vào, không bao giờ đóng vai một nhân vật. AI trợ giúp khi được yêu cầu, những gì nó tạo ra đều ghi rõ điều đó, và công việc của bạn mang tên bạn chứ không phải tên một mô hình.

- **[Lập trường của chúng tôi về AI](/info/ai-stance.html)** - Lolly làm gì và không làm gì với nội dung do AI tạo ra, và điều gì thực thi từng cam kết đó.
- **[Tạo một lần, kết xuất giống nhau](/info/ai-features.html)** - các tính năng AI được đưa vào sản phẩm, và vì sao việc bịa ra pixel bị đánh dấu trong khi việc loại bỏ chúng thì không.
- **[Đầu vào, không phải mạo danh](/info/input-not-impersonation.html)** - vì sao một agent chỉ cung cấp đầu vào chứ không bao giờ đóng vai một nhân vật, điều đó được thực thi ra sao và một agent lệch hướng vẫn không thể làm được gì.
- **[AI Agents](/info/ai-agents.html)** - một agent thực sự có thể điều khiển những gì, nếu đội ngũ của bạn đã đang hướng một agent vào việc này.
