# Hỏi & đáp

Các câu hỏi thường gặp, được kết xuất thành các mục đóng mở trên `/info/start/faq.html`.

**Cách bảo trì:** mỗi đề mục `##` bên dưới là một câu hỏi. Mọi thứ dưới đề mục,
cho đến `##` tiếp theo, là câu trả lời. Câu trả lời dùng Markdown gọn nhẹ của trang web:
ngăn cách các đoạn bằng một dòng trống. Thêm, xóa hoặc đổi thứ tự câu hỏi ở đây rồi
chạy lại `pnpm run build:info` (hoặc `pnpm run dev:web`).
Quá trình dựng bỏ qua mọi thứ phía trên `##` đầu tiên (tiêu đề này và các ghi chú này).

Thứ tự dành cho người mới: điều kiện ngầm trước, rồi đến các tệp của bạn, rồi cách tải
và chạy Lolly, rồi các tổ chức, rồi cách nó được tạo ra. Điểm neo của mỗi câu hỏi
được tạo từ câu hỏi tiếng Anh ở cùng vị trí, nên bản dịch giữ nguyên
thứ tự tiếng Anh.

## Vì sao miễn phí? Có điều kiện ngầm gì không?

**Chúng tôi xây dựng Lolly cho chính mình.** SUSE cần hàng nghìn tệp đúng thương hiệu, được tạo mà không giao bất cứ thứ gì cho dịch vụ bên ngoài. Vì vậy chúng tôi xây dựng công cụ làm tất cả trên thiết bị và phát hành dưới dạng mã nguồn mở, như mọi thứ khác chúng tôi tạo ra. Chúng tôi tiếp tục bảo trì vì dùng nó mỗi ngày. **Không có ràng buộc:** mọi thứ ở đây đều hoạt động dù có chúng tôi hay không.

Ranh giới đó được ghi trong giấy phép, không phải lời hứa: mọi thứ chạy cục bộ đều miễn phí, mãi mãi. Phiên bản đã phát hành được cấp phép theo cách không thể thu hồi. Không thỏa thuận đóng góp nào có thể cấp phép lại tác phẩm của bất kỳ ai.

## SUSE đang giữ kín bao nhiêu? (hay khi nào sẽ trở mặt)

Bộ máy, các lớp vỏ, lược đồ và các công cụ không phụ thuộc thương hiệu đều là mã nguồn mở. Nhãn hiệu và công cụ mang thương hiệu SUSE được giữ riêng và đã được tách ra. Bản triển khai công khai tại [lolly.tools](https://lolly.tools) chạy [Lolly Demo](/info/lolly-demo.html), hệ thống thiết kế riêng của Lolly.

Không có gì ở đây dựa vào lời hứa: mọi phiên bản đã phát hành đều giữ mã nguồn mở. Khi một công ty khác đóng mã nguồn Linux doanh nghiệp của họ vào năm 2023, SUSE đồng sáng lập [OpenELA](https://openela.org) để giữ mã đó mở. Dự án này kế thừa lập trường ấy.

SUSE *đúng là* đang xây dựng công cụ nội bộ để kết nối Lolly với các hệ thống CNTT riêng của mình. Đó là cách thiết lập nội bộ của SUSE, không phải sự chia tách giữa phát triển công khai và riêng tư. Lolly cũng hướng tới việc được dựng qua [Open Build Service](https://openbuildservice.org/), với các sản phẩm dựng có chuỗi cung ứng an toàn do [SUSE Application Collection](https://apps.rancher.io/applications) phân phối.

## Vì sao đặt tên "Lolly Tools"?

**Lolly** vì tự do ngọt ngào, và vì ở Úc, New Zealand và Anh, lolly có nghĩa là kẹo.

**Tools** vì công cụ nằm yên cho đến khi bạn cầm lên. Nó không chạy khi bạn không dùng và không theo dõi bạn khi bạn đang dùng.

## Vì sao mọi thứ đều màu xanh lá?

lolly.tools mở với [Lolly Demo](/info/lolly-demo.html), hệ thống thiết kế mẫu riêng của Lolly có màu chủ đạo là xanh lá. Chuyển sang **Lolly Starter**, một hệ thống thiết kế trống, hoặc sang hệ thống của riêng bạn trong [Settings → Design systems](/#/settings?focus=design-systems-section).

## Tôi có thể dùng thương hiệu riêng không?

Có. **Lolly Design System Setup** (`#/start`) xây dựng hệ thống thiết kế từ một màu, một tệp token thiết kế hoặc một thiết kế hoàn chỉnh. Mọi công cụ sau đó vẽ bằng hệ thống thiết kế của bạn. [Bắt đầu](/info/quickstart.html#put-your-brand-in) hướng dẫn ba cách đó.

Hệ thống thiết kế do tổ chức hoặc bản dựng của bạn cung cấp được quản lý. Nó hiển thị khóa và chỉ cho phép đọc. Để thay đổi, hãy tạo một bản sao chỉnh sửa được.

## Thứ tôi làm hôm qua ở đâu?

Nếu bạn đã nhấn **Save as** hoặc **Save**, công việc nằm trong **Projects** trên màn hình chính, trong trình duyệt hoặc ứng dụng bạn đã dùng để lưu. Nếu bạn chỉ nhấn **Download**, tệp nằm trong mục tải xuống của trình duyệt hoặc hệ thống, và thường có một bản sao trong **Assets**. Các công cụ [lưu khi bạn làm việc](/info/find-your-work.html#which-tools-save-as-you-work) cũng giữ công việc chưa lưu trong **Projects**. [Tìm và khôi phục công việc của bạn](/info/find-your-work.html) trình bày mọi trường hợp.

## Tôi đã đóng thẻ. Công việc có mất không?

Công việc đã lưu vẫn nằm trong **Projects**. Công việc chưa lưu đã mất, trừ trong các công cụ lưu khi bạn làm việc, cũng giữ nó trong **Projects**. Lần sau, nhấn **Save as** trước khi rời đi. Xem [Nếu bạn đã đóng thẻ hoặc rời công cụ](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Tôi có thể chia sẻ công việc dưới dạng tệp thay vì liên kết không?

Có. Khi liên kết không thể mang theo mọi thứ, như ảnh riêng của bạn hoặc văn bản dài, hộp thoại Share cho biết những gì sẽ thiếu và đề xuất một tệp **.lolly**. Một tệp đó chứa thiết kế, các ảnh được dùng và, nếu bạn chọn, cả công cụ.

Bạn quyết định gửi theo bao nhiêu. Tên và thông tin của bạn chỉ được đưa vào nếu bạn đã bật tùy chọn đồng ý trong hồ sơ. Tác phẩm có giấy phép được giữ lại trừ khi bạn chọn đính kèm tác phẩm. Người mở tệp chứa công cụ sẽ được hỏi có tin cậy công cụ đó không trước khi nó có thể chạy. Xem [Chia sẻ công việc của bạn](/info/using.html#sharing-your-work).

## Thông tin hồ sơ của tôi dùng để làm gì?

Thông tin của bạn trong **Settings** điền sẵn vào các công cụ cần chúng, như tên trên huy hiệu. Chúng ở lại trên thiết bị này. Không có gì được đưa vào sản phẩm bạn tạo trừ khi bạn bật tùy chọn đồng ý. Khi đó, các thông tin bạn chọn được niêm phong trong sản phẩm và ghi tên bạn là nguồn.

Chia sẻ và Sync chỉ gửi nội dung bạn chọn. Trên bản triển khai Lolly Work của tổ chức, các phiên được chia sẻ và công việc được quản trị cũng được gửi tới máy chủ đó. Xem [Quyền riêng tư](/info/privacy.html).

## Làm sao để có ứng dụng cho điện thoại hoặc máy tính?

Tải chúng từ [Cài đặt Lolly](/info/install.html). Trang liệt kê mọi bản dựng cho macOS, Windows, Linux và Android, và hướng dẫn kiểm tra tệp bạn đã tải. iPhone và iPad tải **Lolly Tools** từ App Store. [Phần iPhone và iPad](/info/install.html#iphone-and-ipad) có liên kết.

Bất kỳ ai cũng có thể dựng và phân phối bản sao ứng dụng riêng, với các công cụ và cài đặt mà người dùng của họ cần. [Hướng dẫn dựng](/info/build-guide.html) chỉ cách làm.

## Lolly báo cần WebGPU. Tôi có thể làm gì?

Ứng dụng web vẽ bằng WebGPU, một tính năng đồ họa của các trình duyệt hiện nay, và kiểm tra WebGPU trước khi mở công cụ. Hãy thử theo thứ tự này:

1. Cập nhật trình duyệt lên phiên bản hiện tại.
2. Bật tăng tốc đồ họa hoặc phần cứng trong cài đặt trình duyệt, rồi khởi động lại trình duyệt.
3. Thử một trình duyệt đã được kiểm thử: [Môi trường được hỗ trợ](/info/supported-environments.html) liệt kê chúng.
4. Trên Mac, iPhone hoặc iPad, hãy [cài ứng dụng](/info/install.html) thay thế.

## Lolly có thể chỉnh sửa và kết xuất tệp Figma, Penpot, Illustrator hoặc InDesign của tôi không?

Có. Mở công cụ **Design** và nhấp **Import a design**: nó nhận tệp Figma gốc **.fig** (Save local copy), bản xuất Penpot **.penpot**, tệp Illustrator **.ai** hoặc **.pdf**, tệp InDesign **.idml** hoặc **.indd**, tài liệu Affinity, tệp Photoshop **.psd**, PowerPoint **.pptx**, CAD **.dxf** hoặc **bất kỳ SVG nào** ([mọi định dạng nó đọc được](/info/design-import.html#what-comes-in-from-each-app)). Bạn không cần tài khoản, plugin hay giấy phép ứng dụng thiết kế.

![Canvas đang mở của Lolly Design - Import a design nằm trong menu Lolly trên thanh công cụ](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Các lớp được nhập thành hộp chỉnh sửa được. Văn bản vẫn gõ lại được, hình khối vẫn là hình khối và ảnh được thêm vào thư viện của bạn. Khi bố cục đã được lưu, **Share with rules** có thể biến nó thành công cụ mà bất kỳ ai có Lolly cũng có thể điền lại. Xem [Nhập một thiết kế](/info/design-import.html).

## Hai người có thể cùng làm một thiết kế mà không có internet không?

Có. Một người chia sẻ lời mời (liên kết, mã QR hoặc mã ngắn) và người kia chấp nhận. Cả hai thiết bị sau đó cùng giữ một phiên trực tiếp, với hiển thị người có mặt và các vòng tiêu điểm. Cách này hoạt động trên bất kỳ mạng chung nào, kể cả điểm phát sóng điện thoại, vì không có máy chủ ở giữa. Xem [Làm việc cùng nhau](/info/collaborate.html). Với đồng nghiệp trên các mạng khác nhau, bản triển khai Lolly Work của tổ chức cung cấp các phiên cộng tác công việc có xác thực.

## Cờ tính năng là gì?

Cờ tính năng bật hoặc tắt các phần của Lolly. Khi dùng độc lập, bạn chọn các cài đặt cá nhân. Tổ chức dùng Lolly Work có thể đặt mặc định hoặc ẩn một số công tắc theo chính sách, và các điều khiển được quản lý có nhãn. Xem [Dùng Lolly tại tổ chức của bạn](/info/organisation.html).

![Cờ tính năng cá nhân trong ứng dụng độc lập; chính sách tổ chức có thể quản trị một số công tắc](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Tiện ích khác công cụ ở điểm nào?

Tiện ích làm nhanh một việc trên tệp bạn đã có, như nén PDF, chuyển đổi ảnh hoặc xóa dữ liệu ẩn. Nhiều tiện ích chạy trên thiết bị của bạn mà không tải gì lên. Tiện ích giữ trong Lolly những việc mọi người thường giao cho một trang web bất kỳ. Nén hợp đồng, chuyển đổi ảnh kỳ nghỉ vẫn chứa vị trí hoặc dán token vào bộ định dạng trực tuyến không nên đồng nghĩa với việc đưa tệp cho một trang không rõ chính sách lưu giữ, phạm vi tài phán và mô hình kinh doanh. [Lolly Utilities](/info/utilities.html) liệt kê các tiện ích, và [Cuộc trao đổi chúng ta chưa từng đồng ý](/info/status-quo.html) kể câu chuyện phía sau chúng.

![Chế độ xem Utilities: Lolly Strip Hidden Data, Compress PDF, Convert Image và các tác vụ khác trên thiết bị, tất cả ở một nơi](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Tổ chức của chúng tôi có thể dùng SSO, dự án chung và phê duyệt không?

Có, với **Lolly Work**, máy chủ cho tổ chức của cùng dự án mã nguồn mở. Nó chạy riêng và bổ sung đăng nhập một lần qua nhà cung cấp danh tính của bạn, cấp phát qua SCIM, quyền theo nhóm, dự án và tài nguyên chung, cộng tác công việc trực tiếp, phê duyệt và bản ghi kiểm toán. Ứng dụng dùng hằng ngày vẫn hoạt động độc lập.

[Dùng Lolly tại tổ chức của bạn](/info/organisation.html) trình bày việc đăng nhập và tìm công việc chung. [Triển khai](/info/deployment.html#organisation-services-with-lolly-work) trình bày việc thiết lập Lolly Work. Nội dung được chia sẻ và hồ sơ tổ chức tuân theo chính sách quyền riêng tư và lưu giữ của bản triển khai đó.

## Tôi có thể gặp những trở ngại gì khi áp dụng Lolly?

Chủ yếu là thay đổi cách nhóm tạo ra sản phẩm, không phải công nghệ. Nhóm muốn có bộ công cụ được quản trị cần người xây dựng hệ thống thiết kế và các mẫu đầu tiên. Bất kỳ ai vẫn có thể tạo công cụ riêng trong Lolly Design ngay ngày đầu, không cần git. Các quy trình hiện có vẫn hoạt động ngay cả khi đầu ra không đúng thương hiệu. Chuyển đổi tốt một sản phẩm cụ thể, đặt bản trước và sau cạnh nhau, thuyết phục nhanh hơn một kế hoạch.

[Áp dụng & Quản trị](/info/adoption-governance.html) trình bày cách hướng dẫn người mới theo vai trò, cách đánh giá thử nghiệm và hình thức có thể có của quy trình quản trị.

## Lolly có được "lập trình theo cảm hứng" không?

Lolly được phát triển với việc viết mã có AI hỗ trợ, tìm hiểu có AI hỗ trợ và, ở nhiều chỗ, nội dung có AI hỗ trợ, dùng nhiều mô hình và nhà cung cấp, kể cả từ các công ty phát triển mô hình hàng đầu trên đám mây công cộng. Một người đã tạo kiến trúc, tuyển chọn mã có chủ đích và chỉ đạo nghệ thuật cho trải nghiệm.

Cảnh báo mức cao hoặc nghiêm trọng trong các phần phụ thuộc của Lolly chặn CI. Cảnh báo chưa thể khắc phục chỉ được tạm bỏ qua dưới dạng ngoại lệ đã phê duyệt kèm lý do bằng văn bản. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) liệt kê từng ngoại lệ hiện có, và [ghi chú phát hành](https://github.com/lolly-tools/lolly/releases) liệt kê các ngoại lệ trong mỗi bản phát hành. SECURITY.md cũng hướng dẫn cách báo cáo lỗ hổng.

Các phép kiểm tra trong quá trình dựng cũng từ chối cách diễn đạt có vẻ do máy viết trong chú thích mã, ứng dụng và tài liệu này, để văn bản dễ hiểu với mọi người đọc. Một tác dụng phụ là công cụ phát hiện có thể khó xác định văn bản nào do mô hình viết hơn. Chúng tôi không chủ ý gây ra điều đó.

Quan trọng hơn cả, Lolly được xây dựng trên hàng chục năm đóng góp mã nguồn mở của các chuyên gia trên khắp thế giới.

**Công bố về AI tạo sinh:**

- **Mã do LLM viết:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (danh sách này có thể mở rộng)
- **Tìm hiểu bằng LLM:** Gemini 3.1, Fable, Codex Astra
- **Tài liệu:** Sonnet 5
- **Thư viện mã nguồn mở:** Các tác giả tương ứng, được ghi trong SBOM, chú thích và phần đầu tệp

Danh sách này không bao gồm các mô hình được đóng gói sẵn trong Lolly.

**Đóng góp của con người:**
- **Lên ý tưởng, đánh giá và phản hồi:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, Cộng đồng Penpot, Tim Hildred (danh sách chưa đầy đủ)
- **Kiến trúc, chỉ đạo nghệ thuật & dọn nội dung rác:** Andy Fitzsimon

## Các công cụ mang thương hiệu SUSE đi đâu rồi?

Chúng nằm trong một kho mã riêng tư, tách biệt. Bản sao công khai không tải gói thương hiệu SUSE, nên bản dựng từ đó dùng hồ sơ `lolly-start` trung tính trừ khi bạn chọn hồ sơ khác. Hồ sơ đó có các công cụ cộng đồng không gắn với thương hiệu và một thương hiệu trống để bạn điền thương hiệu của mình. [lolly.tools](https://lolly.tools) được dựng với hồ sơ `lolly-demo` và mở trong [Lolly Demo](/info/lolly-demo.html), hệ thống thiết kế riêng của Lolly. SUSE vận hành phiên bản riêng để bảo vệ nhãn hiệu của mình.

## Logo Lolly đó có vị gì?

Có người nói là chanh, người khác nói là bạc hà và đôi khi là táo. Lolly mang đến vị ngọt, còn bạn tạo nên hương vị.

## Lolly hiểu chủ quyền nội dung là gì?

Quyền kiểm soát cách nội dung của bạn được tạo, quản trị, lưu trữ và di chuyển giữa các hệ thống bạn chọn. Lolly hỗ trợ tạo nội dung cục bộ, tác phẩm có thể chỉnh sửa và công cụ có thể chuyển đi. Lolly Work bổ sung các dịch vụ dùng chung do tổ chức kiểm soát. Giấy phép nguồn, các thành phần phụ thuộc có sẵn và luồng dữ liệu của quy trình vẫn có vai trò quan trọng. [Chủ quyền nội dung là gì?](/info/content-sovereignty.html) giải thích từng quyền kiểm soát và giới hạn của nó.

## Chúng tôi có thể giữ DAM hiện có không?

Có. Một DAM được hỗ trợ có thể tiếp tục là nguồn dữ liệu chính thức trong khi Lolly Work kết nối các tài nguyên đã chọn với công cụ Lolly. Quyền truy cập nguồn, các chỉnh sửa được phép, quyền sử dụng và việc phê duyệt đầu ra hoàn chỉnh là những quyết định riêng biệt. [Dùng Lolly với DAM hiện có](/info/use-with-dam.html) giải thích cách bố trí này và [Trải nghiệm Brandfolder của SUSE](/info/suse-brandfolder.html) ghi lại việc sử dụng thành công trong quá trình triển khai.
