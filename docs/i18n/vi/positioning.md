# So sánh Lolly

Lolly tạo tệp đúng chuẩn thương hiệu trên thiết bị của bạn, không cần tài khoản. **Lolly Work** là máy chủ dành cho nhóm: đăng nhập, dự án dùng chung, phê duyệt và kết xuất máy chủ, trên máy do tổ chức của bạn vận hành. Cả hai đều là mã nguồn mở theo MPL-2.0.

Hầu hết nhóm giữ các công cụ đang có. Ứng dụng thiết kế cung cấp thiết kế, DAM vẫn là nguồn lưu trữ chính thức, và Lolly chuyển đầu vào đã phê duyệt thành tệp hoàn chỉnh. [Dùng Lolly với DAM hiện có](/info/use-with-dam.html) mô tả cách kết hợp đó. Ý tưởng đằng sau sự kết hợp là [chủ quyền nội dung](/info/content-sovereignty.html).

<!--i:eti-gauge-->
## Các công cụ hiện nay

Mỗi vòng thể hiện mức độ một nhóm sản phẩm đáp ứng trọn vẹn một nhu cầu. Nhấn **?** bên cạnh một hàng để xem bằng chứng, và **?** bên cạnh chú giải để xem cách tính điểm.

::: figure positioning-comparison
So sánh khả năng. Nghiên cứu đối thủ từ tài liệu nhà cung cấp, từ tháng 8 đến ngày 21 tháng 11 năm 2026. Lolly và Lolly Work được đánh giá ngày 21 tháng 11 năm 2026. Chấm điểm: 0 không có, 25 có cách làm vòng, 50 có thật nhưng bị giới hạn quyền truy cập hoặc chỉ đáp ứng một phần, 75 mạnh nhưng có điểm cần lưu ý, 100 năng lực cốt lõi.
:::

::: details Nguồn cho các điểm số thay đổi trong tháng 11 năm 2026
- Canva: [nhật ký thay đổi API](https://www.canva.dev/docs/apps/rest-apis/changelog/), [ứng dụng dịch vụ](https://www.canva.dev/blog/developers/canva-service-accounts/), [trợ giúp Brand Controls](https://www.canva.com/help/brand-control/)
- Adobe: [nhật ký thay đổi InDesign API](https://developer.adobe.com/firefly-services/docs/indesign-apis/getting-started/changelog/), [giá Adobe Express](https://www.adobe.com/express/pricing)
- Figma: [tác nhân và tín dụng AI](https://help.figma.com/hc/en-us/articles/42614902212887), [máy chủ MCP](https://developers.figma.com/docs/figma-mcp-server/)
- Frontify và Bynder: [ghi chú phát hành Frontify tháng 10 năm 2026](https://news.frontify.com/163371-what-s-new-in-october-2026), [Frontify MCP](https://help.frontify.com/en/articles/14787214-frontify-mcp-beta)
- Bannerbear và Placid: [giá Bannerbear](https://www.bannerbear.com/pricing/), [nhật ký thay đổi Bannerbear](https://www.bannerbear.com/changelog/), [giá Placid](https://placid.app/pricing)
- Penpot: [giá tự lưu trữ](https://penpot.app/pricing/self-host), [các bản phát hành](https://github.com/penpot/penpot/releases)
- Cloudinary: [nguồn gốc nội dung](https://cloudinary.com/documentation/content_provenance_and_authenticity), [giá](https://cloudinary.com/pricing)
:::

Tính năng và lịch sử hoạt động là các hàng riêng. Bản phát hành công khai đầu tiên của Lolly là 1.0.1 vào ngày 30 tháng 8 năm 2026, bảo mật của nó chưa được kiểm toán độc lập và bằng chứng về việc sử dụng mới có vài tháng. [Áp dụng & Quản trị](/info/adoption-governance.html#status) có thông tin hiện tại.

<!--i:eti-hammer-->
## Khi nào nên chọn Lolly

::: cols
## Chọn Lolly khi

- Cần cùng một loại tệp nhiều lần: thẻ sự kiện, huy hiệu, chứng nhận, cảnh báo, thẻ mạng xã hội
- Nhiều tệp được tạo từ một mẫu và một bảng giá trị, trong [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) hoặc CLI
- Màu sắc, kiểu chữ và tài nguyên phải nằm trong hệ thống thiết kế, ngay cả trên canvas tự do
- Một thiết kế Figma, Penpot, Illustrator, InDesign, Affinity hoặc PDF hoàn chỉnh cần trở thành thứ có thể chỉnh sửa và tạo lại ([Nhập một thiết kế](/info/design-import.html))
- Các tệp phải được tạo trên thiết bị hoặc máy chủ của bạn

## Chọn công cụ khác khi

- Công việc là chỉnh sửa ảnh chi tiết hoặc vẽ minh họa
- Bạn đang thiết kế và tạo nguyên mẫu giao diện ứng dụng
- Bạn cần thư viện tài nguyên có sẵn và mẫu lớn ngay từ ngày đầu
- Bạn cần dịch vụ được quản lý có lịch sử hoạt động lâu dài ở quy mô lớn
:::

Thiết kế được nhập và token thiết kế dùng chung cho phép nhóm kết hợp Lolly với ứng dụng chuyên dụng, trong khi Lolly Work quản trị tài nguyên dùng chung, rà soát và bàn giao.

Với nhóm có DAM được tuyển chọn kỹ, hãy bắt đầu bằng việc giữ nguyên thư viện đó và các quản trị viên của nó. [Kinh nghiệm dùng Brandfolder của SUSE](/info/suse-brandfolder.html) ghi lại cách tích hợp hỗ trợ việc áp dụng và quản lý thay đổi trong phê duyệt. Nhà cung cấp DAM và đối tác triển khai có thể đánh giá cách bố trí tương tự qua [quy trình dành cho đối tác](/info/dam-partners.html).

Trong **Lolly Markdown Slides**, toàn bộ bộ trang chiếu được viết dưới dạng dữ liệu, bố cục trực tiếp và xuất thành tệp PowerPoint gốc có thể chỉnh sửa.

![Lolly Markdown Slides ở chế độ xem chia đôi: các trang chiếu được liệt kê thành khối ở bên trái, bộ trang đã bố cục được kết xuất ở bên phải](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

<!--i:eti-shield-check-->
## Quy tắc nằm trong công cụ

Lolly đặt quy tắc thương hiệu có thể dùng lại vào công cụ: màu sắc, phông chữ, lề tràn, khoảng cách và đầu vào được phép. Mẫu cố định những phần người nhận không được thay đổi. Lolly Work bổ sung quyền truy cập theo nhóm và chính sách đầu vào quanh mẫu đó, với các chuỗi phê duyệt cho nội dung gửi vào danh mục và việc bàn giao.

Kiểm tra công cụ một lần giúp việc sản xuất lặp lại dễ hơn, vì mỗi đầu ra kế thừa quy tắc bố cục của nó. Nội dung chữ, hình ảnh tải lên và quyền sử dụng vẫn có thể cần kiểm tra, và Lolly Work cung cấp danh mục dùng chung cùng các bước phê duyệt cho việc đó. Với nhóm sáng tạo, công cụ là hàng rào bảo vệ: bạn vẫn mang đến dữ liệu, nội dung chữ và hình ảnh, và công cụ giữ mọi kết quả đúng chuẩn thương hiệu.

![Toàn bộ công việc của người tạo: gõ các từ. Kiểu chữ, màu sắc và khoảng cách đã được quyết định khi công cụ được tạo](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Ba điểm khác biệt nữa:

- **Tệp cuối cùng, từ đầu vào.** Cung cấp đầu vào, nhận tệp hoàn chỉnh, không có bước "giờ hãy lưu từ công cụ thiết kế rồi chỉnh lại".
- **Công cụ kết hợp công cụ.** Một công cụ có thể nhúng bản kết xuất của công cụ khác trong một tệp hoàn chỉnh, mà không có sự phụ thuộc mã giữa chúng.
- **Mã nguồn mở.** Bộ máy là mã nguồn mở, và công cụ, tài nguyên, token thiết kế là những tệp bạn có thể giữ trong hệ thống quản lý phiên bản hoặc quản lý trong Lolly Work, không phải những hàng trong cơ sở dữ liệu của người khác.

Thiết kế táo bạo vẫn có chỗ trong các giới hạn bảo vệ. Bản đồ thành phố đủ chất lượng làm áp phích này gồm đường sá và đường nước dạng vector thật, tạo từ một danh sách thả xuống và hai ô màu không thể chọn màu ngoài hệ thống thiết kế:

![Các vành đai kênh đào và mạng lưới đường sá Amsterdam được vẽ kín khung bằng màu mực của chính hệ thống thiết kế, mỗi nét do mẫu đặt vào thay vì vẽ tay](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

<!--i:eti-stamp-->
## Đổi mới theo xác suất, mở rộng theo tính tất định

Hầu hết lời chào mời về "sáng tạo bằng AI" đặt mô hình ở sai phía của một ranh giới lâu đời. Người chép sách và người vẽ trang trí bản thảo đã định rõ ranh giới ấy. Bạn tự do với bản phác thảo, nơi có thể thử mọi thứ và chưa chốt điều gì. Rồi bạn đến máy in, nơi chốt kết quả. Nghệ thuật nằm trong bản phác thảo, và máy in đưa nó đi xa, còn tác phẩm in ra có thể được tin cậy vì máy in giữ lời hứa qua mỗi lượt in.

Lolly là máy in đó. Hãy dùng bất cứ thứ gì bạn thích để lên ý tưởng, một mô hình, một nhà thiết kế hay một bản vẽ nháp, nhưng khi ý tưởng phải trở thành nhiều tệp, nó đi qua một hệ thống kết xuất giống nhau ở mọi lần, từ đầu vào mà ai cũng có thể đọc lại. So sánh bên trên thực chất nói về ai làm cho bước chốt đó có thể lặp lại.

> Tin vào quá trình sáng tạo, mở rộng bằng sự chặt chẽ.

<!--i:eti-tag-->
## Miễn phí mãi mãi

**Nếu kết xuất trên thiết bị của bạn, nó miễn phí mãi mãi.** Bộ máy, lớp vỏ, công cụ và định dạng đều là mã nguồn mở, và phiên bản đã phát hành không thể bị thu hồi. Lolly Work cũng là mã nguồn mở. Tổ chức trả tiền cho hạ tầng và hoạt động vận hành mà mình chọn, không có phí giấy phép phần mềm theo chỗ ngồi hay lượt kết xuất khi tự lưu trữ. [Hỏi & đáp](/info/faq.html) kể câu chuyện đằng sau cam kết.

<!--i:eti-map-pin-->
## Nội dung của bạn nằm ở đâu

Công việc sáng tạo trong Lolly có thể chạy trên phần cứng bạn sở hữu, và token thiết kế, phông chữ, logo, công cụ của nó là những tệp bạn có thể giữ. Với Lolly Work, dự án dùng chung, tài nguyên, chính sách và bản ghi kiểm toán nằm trong bộ lưu trữ do tổ chức của bạn cấu hình. [Niềm tin](/info/trust.html) giải thích vì sao điều đó quan trọng, còn [Chính sách quyền riêng tư](/info/privacy.html) và [Tự kiểm chứng](/info/verify-yourself.html) cho phép bạn kiểm tra tuyên bố thay vì chỉ tin lời chúng tôi.

<!--i:eti-grid-->
## Theo từng công cụ

[So sánh Lolly theo từng công cụ](/info/compare.html) so sánh Lolly với Canva, Adobe, Figma, Penpot, cổng thương hiệu, API kết xuất và trình chuyển đổi trực tuyến, mỗi loại một trang, đồng thời nêu rõ [thứ gì chạy ở đâu](/info/compare.html#what-runs-where).
