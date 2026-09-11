# Lolly so sánh như thế nào

Những gì Lolly làm mà các công cụ sáng tạo hiện nay không làm, và những gì nó cố ý để lại cho chúng.

Để xem phiên bản so sánh từng công cụ, mỗi trang riêng cho Canva, Adobe, Figma, các API kết xuất và các bộ chuyển đổi trực tuyến, xem [Lolly so sánh, từng công cụ một](/info/compare.html). Mỗi trang nêu rõ công cụ kia làm tốt hơn ở điểm nào và Lolly làm gì thay vào đó.

> **Trạng thái thử nghiệm:** Lolly là một nguyên mẫu thử nghiệm khép kín (closed-pilot), chưa phải là sản phẩm hoàn thiện, và tính bảo mật của nó hiện đang trải qua quá trình tăng cường hạ tầng nghiêm ngặt của SUSE, chuẩn bị cho quy mô doanh nghiệp. Trang [Adoption & Governance](/info/adoption-governance.html#status) trình bày tình trạng hiện tại.

## Các công cụ hiện nay

Mỗi vòng tròn bên dưới chấm điểm mức độ đầy đủ mà một lớp sản phẩm cung cấp một khả năng **theo đúng những gì đã phát hành hôm nay** - không phải theo quảng cáo - với mỗi lớp được chấm điểm dựa trên đại diện tốt nhất của nó. Lolly được chấm điểm bằng cùng một tiêu chuẩn khắt khe: nó nhận vòng tròn đỏ duy nhất trên bảng, cho hạng mục độ chín muồi. Mở tên một hàng để xem lý giải đằng sau điểm số của nó. Các cột được sắp xếp theo hàng Mức độ hoàn thiện tổng thể ở trên cùng - giá trị trung bình của các hàng được chấm điểm, không tính hàng chi phí.

::: figure positioning-comparison
Mức độ hoàn thiện năng lực trên các công cụ sáng tạo hiện nay, khảo sát tháng 8/2026. Thang điểm: 0 không có, 25 mức giải pháp tạm, 50 có thật nhưng bị giới hạn hoặc một phần, 75 mạnh nhưng có lưu ý, 100 năng lực cốt lõi.
:::

**Ghi chú chấm điểm.** Điểm số của Lolly giả định các tuyên bố đã công bố của nó là đúng, đó là lý do vì sao độ chín muồi là vòng tròn đỏ duy nhất của nó: thử nghiệm khép kín, đang trong quá trình tăng cường bảo mật, chưa có gì được kiểm toán. Nghiên cứu đã làm thay đổi một số ô.

Canva được chấm điểm dựa trên thành viên tốt nhất trong họ sản phẩm của nó cho mỗi hàng, vì nó sở hữu Affinity và Cavalry (cả hai được tặng miễn phí từ tháng 10/2025). Kết xuất ngoại tuyến và trên thiết bị đạt điểm 75 qua Affinity - một bộ ứng dụng desktop vẫn cần tài khoản đã xác minh và mang theo telemetry, khoản trừ điểm mà Adobe cũng phải chịu - trong khi chế độ ngoại tuyến của chính Canva chỉ chỉnh sửa các thiết kế đã đồng bộ trước, một thiết bị, khoảng thời gian giới hạn. Tự động điền đạt điểm 50: có thật nhưng bị giới hạn cho gói Enterprise, không đồng bộ, chỉ văn bản và hình ảnh. Khả năng tạo hàng loạt của Figma tăng từ 25 lên 50 khi Buzz phát hành tính năng điền bảng tính (bản beta miễn phí, tháng 8/2026).

Một quy tắc chi phối toàn bộ bảng: điểm Đầy đủ (100), trên các hàng liên quan đến nội dung hoặc danh tính của bạn, cần một khả năng bạn có thể sử dụng mà không cần tài khoản và không cần điều kiện tiên quyết về cloud; các hàng mô tả chính sản phẩm (độ chín muồi, độ dễ sử dụng) được miễn trừ. Quy tắc này khiến Adobe bị trừ điểm về nguồn gốc: C2PA được phát hành rộng rãi nhất (Photoshop, Lightroom, Premiere, Firefly) ký cục bộ lẫn trên cloud, nhưng không bao giờ thiếu tài khoản và danh tính Adobe, nên chỉ đạt 75. Quy tắc này cũng giới hạn điểm của các API kết xuất về tạo hàng loạt và tự động hóa vì cùng lý do.

Điểm nguồn gốc 75 của Lolly phản ánh việc ký ngoại tuyến trên thiết bị: về mặt kiến trúc mạnh hơn nhưng chưa được kiểm toán, và một khóa thiết bị hiện lên là chưa được xác minh trong các trình xác thực tiêu chuẩn cho đến khi một danh tính hoặc CA riêng của một tổ chức xác nhận nó. Điểm 50 của Penpot đến từ plugin Lolly Export chính thức: cùng cách ký của engine, tùy chọn tham gia, được công bố là của riêng Lolly. Penpot cũng nhận vòng tròn duy nhất vượt thang điểm trên bảng, 90 điểm cho kết xuất trên thiết bị - canvas trên trình duyệt, lưu vào cloud tự chủ của riêng bạn (thậm chí một laptop), xuất riêng tư; chỉ có bước nhảy máy chủ mới tách nó khỏi Lolly. Cloudinary có cột riêng của nó: một pipeline media (DAM, API chuyển đổi, CDN), và là cột cloud duy nhất phát hành C2PA (50, vì fl_c2pa ký khi giao hàng, chứng thực là được-giao-bởi-Cloudinary, không phải được-tạo-bởi-bạn).

Cộng tác trực tiếp diễn ra theo chiều ngược lại: Figma đặt ra chuẩn mực về quy mô (200 người biên tập) và P2P theo cặp, cách ly hoàn toàn (air-gapped) của Lolly chỉ đạt điểm Một phần. Giá cả là một ước tính, được ghi rõ như vậy: phép tính theo giá niêm yết trên các tổ hợp số lượng ghế thực tế, cố ý rộng, nhằm mục đích so sánh quy mô chứ không phải để mua sắm. Các API kết xuất đạt 75 về ràng buộc: mẫu bị khóa, không có lớp quản trị thương hiệu.

Khoảng trống: chưa có sản phẩm nào đã phát hành hôm nay vừa ưu tiên ràng buộc trước tiên vừa hoạt động ngoại tuyến mà không cần tài khoản và không có máy chủ trong đường kết xuất, và chưa ai sao chép điều khoản về tài khoản này. Lolly giờ đây đã phát hành canvas mở của riêng mình - **Design**, một canvas tự do thao tác trực tiếp - nhưng màu sắc, kiểu chữ và tài sản trên đó tuân theo các giá trị toàn cục của thương hiệu, nên ngay cả việc sắp xếp tự do vẫn ưu tiên ràng buộc trước tiên.

Điều Lolly **vẫn không phải** là một bộ ứng dụng thiết kế không ràng buộc; các nhà thiết kế sẽ tiếp tục dùng Illustrator và Figma cho công việc riêng biệt - và khi công việc đó cần trở thành một tài sản được quản trị, có thể tái tạo, tính năng [Import a design](/info/design-import.html) của công cụ Design đưa tệp Figma, Penpot, Illustrator, InDesign hoặc PDF đã hoàn thiện lên canvas dưới dạng các hộp có thể chỉnh sửa, tuân theo thương hiệu.

![Canvas tự do của Design, nơi màu sắc, phông chữ và tài sản được cung cấp là của chính thương hiệu](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&dark=1&filename=aud-open-canvas)

## Dùng cho

- Tạo nhanh các tài sản sáng tạo được vận hành hóa (thẻ sự kiện, huy hiệu, chữ ký, cảnh báo)
- Sắp xếp tự do trên canvas mở (Design) khi các thành phần - màu sắc, kiểu chữ, biểu tượng, hình ảnh - vẫn phải tuân theo các giá trị toàn cục của thương hiệu
- Đưa một thiết kế Figma, Penpot, Illustrator, InDesign hoặc PDF đã hoàn thiện lên (tính năng Import a design của công cụ Design) để nó có thể được chỉnh sửa, quản trị và kết xuất lại một cách xác định trong mọi định dạng của Lolly
- Các quy trình "điền ba trường, nhận tài sản hoàn thiện" một-tới-nhiều - bao gồm các lượt chạy hàng loạt từ một bảng tính/CSV trong lưới xử lý hàng loạt `/pro` (dán hoặc nhập hàng, mỗi hàng cho ra một tài sản hoàn thiện, tải xuống dưới dạng zip)
- Các kết quả đầu ra được gắn thương hiệu, luôn hoạt động, lặp lại theo chu kỳ
- Những trường hợp mà việc kiểm soát tập trung cách thể hiện thương hiệu quan trọng hơn tính linh hoạt biểu đạt

Deck Studio là một thước đo tốt cho giới hạn trần ở đây: toàn bộ một bộ slide được khai báo dưới dạng dữ liệu, được bố cục trực tiếp trên canvas và xuất ra dưới dạng PowerPoint gốc có thể chỉnh sửa.

![Deck Studio trong chế độ xem chia đôi - các slide của bộ trình chiếu được liệt kê dưới dạng khối bên trái, bản kết xuất bộ trình chiếu đã bố cục bên phải](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Không dùng cho

- Nội dung chủ lực riêng biệt hoặc mang tính biểu tượng (biển quảng cáo lớn, video chủ đạo)
- Công việc chiến dịch độc nhất thực sự cần một nhà thiết kế
- Việc lên ý tưởng cần thoát hoàn toàn khỏi hệ thống thương hiệu - canvas mở của Lolly vẫn tuân theo màu sắc, kiểu chữ và tài sản theo các giá trị toàn cục của thương hiệu, và đó chính là mục đích

## Đổi mới theo xác suất, mở rộng quy mô theo tính xác định

Hầu hết các lời chào hàng "sáng tạo AI" đặt mô hình vào sai phía của một ranh giới đã có từ lâu. Các nhà chép kinh và họa sĩ minh họa thời xưa đã xác định rõ ranh giới đó nằm ở đâu: bạn làm việc phóng khoáng trên bản phác thảo, nơi bất cứ điều gì cũng có thể thử và không gì bị chốt lại, rồi sau đó bạn đưa nó đến máy in, thứ đáng gờm chính vì nó chốt lại mọi thứ. Các bản phác thảo là nơi nghệ thuật tồn tại. Máy in là cách nó lan tỏa. Hai công cụ, hai công việc, mỗi công cụ sáng tạo theo cách riêng của mình, và tác phẩm được in ra có thể được tin cậy vì máy in giữ đúng lời hứa của nó ở mỗi lần in.

Lolly là máy in, không phải bản phác thảo. Hãy mang bất cứ thứ gì bạn thích vào giai đoạn lên ý tưởng - một mô hình, một nhà thiết kế, một tờ giấy ăn - nhưng khoảnh khắc một ý tưởng phải trở thành mười nghìn tài sản, nó phải đi qua thứ gì đó kết xuất theo cùng một cách mỗi lần, từ những dữ liệu đầu vào mà bất kỳ ai cũng có thể đọc lại. Đó mới thực sự là điều mà phần so sánh ở trên nói đến: không phải ai có bộ tạo tốt hơn, mà là ai làm cho bước chốt lại có thể tái tạo được.

> Tin tưởng quá trình sáng tạo, mở rộng bằng sự nghiêm ngặt.

## Phê duyệt công cụ, không phải tệp

Mọi công cụ khác trên thị trường đều tạo ra một *tệp* rồi sau đó phải được kiểm tra - một quản lý thương hiệu trong luồng Slack, bộ phận pháp lý xem xét tuyên bố miễn trừ, một vòng chỉnh sửa, thêm một lượt xét duyệt nữa. Lolly đưa việc phê duyệt **lùi lên một bước**. Các quy tắc thương hiệu - mã hex chính xác, tệp phông chữ có bản quyền, lề tràn (bleed), khoảng cách - được mã hóa cứng vào HTML và CSS của công cụ, vì vậy mẫu *không thể* tạo ra một tài sản sai thương hiệu. Chính bố cục thực hiện việc thực thi đó.

Vì vậy bạn ngừng phê duyệt đầu ra và bắt đầu phê duyệt **công cụ** tạo ra chúng. Phê duyệt một lần, và mọi tài sản mà nó từng tạo ra đều đã được phê duyệt sẵn theo cấu trúc - không cần con người trong quy trình, không cần chu kỳ xét duyệt, ở bất kỳ quy mô nào.

Đây là thay đổi mà bộ máy tất định thực sự mang lại: đó không phải là phiên bản nhanh hơn của quy trình phê duyệt cũ, mà là loại bỏ hẳn quy trình đó. Đối với đội ngũ sáng tạo, đây là một rào chắn bảo vệ, không phải một sự thay thế - bạn vẫn ném quả bóng (dữ liệu, nội dung, hình ảnh) và mã nguồn là làn đường có thanh chắn giữ cho mọi cú ném không bao giờ rơi xuống rãnh.

![Toàn bộ công việc của người sản xuất: gõ chữ. Kiểu chữ, màu sắc và khoảng cách đã được ấn định khi công cụ được phê duyệt](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DApproved&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-approve-the-tool)

| Phê duyệt tài sản theo cách cũ | Phê duyệt công cụ, theo cách của Lolly |
|---|---|
| Mọi tệp hoàn thiện đều được kiểm tra, từng cái một | Công cụ chỉ được kiểm tra một lần |
| Yêu cầu → nhà thiết kế xây dựng → xét duyệt thương hiệu → kiểm tra pháp lý → chỉnh sửa → xét duyệt lại | Thay đổi một tham số → tài sản hoàn thiện |
| Nhà thiết kế, quản lý thương hiệu, pháp lý và người yêu cầu đều tham gia | Chỉ một mình người sản xuất |
| Nhiều ngày cho mỗi tài sản | Vài giây cho mỗi tài sản |
| 10.000 tài sản = 10.000 chu kỳ xét duyệt | 10.000 tài sản = không có (mẫu đã được phê duyệt từ trước) |

## Điều chỉ riêng Lolly mang lại

- **Tiềm năng thiết kế táo bạo được truyền tải an toàn trong bối cảnh.** Các công cụ có thể thể hiện những ý tưởng thiết kế phiêu lưu trong các rào chắn được mã hóa cứng.

- **Tự động hóa nội dung được định nghĩa bằng phần mềm, trả về tài sản cuối cùng.** Đầu vào → tệp cuối cùng. Không có chuyện "giờ hãy lưu nó từ công cụ thiết kế của bạn rồi xử lý hậu kỳ."
- **Công cụ kết hợp công cụ.** Một công cụ có thể nhúng bản dựng của một công cụ khác và trả về nó như một phần của tài sản hoàn thiện duy nhất, không có sự ràng buộc mã nguồn giữa các công cụ - một khả năng nguyên thủy mà không sản phẩm canvas mở hay tạo mẫu DAM nào trên thị trường cung cấp.
- **Trung lập với nhà cung cấp.** Kiểm soát đầy đủ tính năng và chi phí. Bộ máy mã nguồn mở. Công cụ và tài sản là nội dung được theo dõi bằng git, không bị khóa trong cơ sở dữ liệu SaaS.

Điều đầu tiên trong số đó là điều người ta thường đánh giá thấp. Một bản đồ thành phố cỡ áp phích, được vẽ dưới dạng đường bộ và đường nước vector thực thụ, chỉ từ một danh sách thả xuống và hai trường màu không thể chỉ ra ngoài phạm vi thương hiệu:

![Các vành đai kênh đào và mạng lưới đường phố của Amsterdam được vẽ sát mép bằng chính mực của thương hiệu, từng nét vẽ do mẫu đặt để chứ không phải bằng tay](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Chủ quyền nội dung

Có một cái tên cho những gì phần trước đã dẫn tới: chủ quyền. Quy trình xử lý nội dung của bạn chạy trên phần cứng bạn sở hữu. Thương hiệu của bạn - các token, phông chữ, logo, các công cụ thực thi chúng - nằm trong các tệp bạn nắm giữ, trong hệ thống quản lý phiên bản bạn kiểm soát, chứ không phải trong cơ sở dữ liệu của một nhà cung cấp với một nút xuất dữ liệu. Việc dựng hình diễn ra ngay trên thiết bị trước mặt bạn, vì vậy một tài sản không bao giờ phải đi qua bên thứ ba để tồn tại, và toàn bộ đường đi từ đầu vào đến tệp hoàn thiện đều là mã nguồn mở và có thể kiểm tra. Nếu mọi nhà cung cấp thiết kế SaaS biến mất vào ngày mai, một triển khai Lolly sẽ không hề hay biết.

Điều này quan trọng với bất kỳ ai mà công việc của họ cần tồn tại lâu hơn một gói thuê bao: bậc phụ huynh có cuốn sách ảnh nằm trên chiếc laptop đó cũng nhiều như cơ quan công quyền có thư viện thương hiệu nằm dưới các quy định mua sắm. Đối với các tổ chức - cơ quan công quyền, các ngành bị quản lý chặt, bất kỳ ai mà thương hiệu là một tài sản chiến lược chứ không phải vật trang trí - câu hỏi "nội dung của chúng ta nằm ở đâu và ai có thể tắt nó đi" là một vấn đề quản trị, không phải một sở thích. Chủ quyền ở đây là một thuộc tính của kiến trúc chứ không phải một tính năng lưu trữ được thêm vào cho hợp lệ tuân thủ, và các trang [Chính sách quyền riêng tư](/info/privacy.html) và [Tự mình xác minh](/info/verify-yourself.html) tồn tại để bạn có thể kiểm tra tuyên bố đó thay vì chỉ tin vào nó.

Bên dưới tất cả những điều đó là một lời hứa, được nêu ra như một cam kết chứ không phải một tính năng: **nếu nó dựng hình trên thiết bị của bạn, nó miễn phí mãi mãi.** Bộ máy, các shell, các công cụ, các định dạng - toàn bộ đường đi sáng tạo trên thiết bị đều là mã nguồn mở và sẽ luôn như vậy. Lời hứa đó có một cơ chế: một phiên bản đã được phát hành được cấp phép theo cách không thể thu hồi, và không tồn tại thỏa thuận đóng góp nào có thể cấp phép lại tác phẩm sau này. Toàn bộ ranh giới đó gói gọn trong một câu: mọi thứ dựng hình trên thiết bị của bạn đều miễn phí và mã nguồn mở, mãi mãi; việc phối hợp con người và máy móc qua mạng lưới là công việc của một mặt phẳng điều khiển riêng biệt, [lolly.work](https://lolly.work).
