# Hỏi & đáp

Các câu hỏi thường gặp, được kết xuất thành accordion tại `/info/start/faq.html`.

**Cách bảo trì:** mỗi tiêu đề `##` bên dưới là một câu hỏi; mọi thứ nằm dưới nó
(cho đến `##` kế tiếp) là câu trả lời. Câu trả lời dùng cùng loại markdown nhẹ như
phần còn lại của site - tách các đoạn bằng một dòng trống. Thêm, xoá hoặc
sắp xếp lại câu hỏi ở đây rồi chạy lại `pnpm run build:info` (hoặc `pnpm run dev:web`).
Mọi thứ phía trên `##` đầu tiên (tiêu đề này và các ghi chú này) đều bị bản build bỏ qua.

Thứ tự là thứ tự của người mới: điều cần lưu ý trước, rồi đến các tệp của bạn, rồi
việc lấy và chạy Lolly, rồi các tổ chức, rồi cách nó được làm ra. Neo của mỗi câu hỏi
được dựng từ câu hỏi tiếng Anh ở cùng vị trí, nên bản dịch giữ nguyên
thứ tự tiếng Anh.

## Vì sao nó miễn phí? Có bẫy gì không?

**Chúng tôi xây Lolly cho chính mình.** SUSE cần hàng nghìn tệp đúng thương hiệu, làm ra mà không trao gì cho dịch vụ bên ngoài. Nên chúng tôi xây một công cụ làm tất cả trên thiết bị, và phát hành dưới dạng mã nguồn mở, như mọi thứ khác chúng tôi làm. Chúng tôi tiếp tục duy trì vì dùng nó mỗi ngày. **Không có nghĩa vụ nào:** mọi thứ ở đây hoạt động dù có hay không có chúng tôi.

Ranh giới đó được vạch trong giấy phép, không phải trong lời hứa: bất cứ thứ gì chạy cục bộ đều miễn phí, mãi mãi. Một phiên bản đã phát hành được cấp phép để không thể bị thu hồi, và không có thỏa thuận người đóng góp nào có thể cấp phép lại công việc của bất kỳ ai.

## SUSE giữ riêng bao nhiêu? (hay là bao giờ thì lật kèo)

Engine, các shell, các schema và các công cụ không gắn thương hiệu là mã nguồn mở. Nhãn hiệu và các công cụ mang thương hiệu của SUSE là phần ở lại riêng tư, và chúng đã được tách riêng. Phiên bản công khai tại [lolly.tools](https://lolly.tools) chạy [Lolly Demo](/info/lolly-demo.html), hệ thống thiết kế riêng của Lolly.

Không có gì ở đây dựa trên lời hứa: mọi phiên bản đã phát hành vẫn là mã nguồn mở, và thứ duy nhất được giữ lại là nhãn hiệu. Khi một công ty khác đóng mã nguồn Linux doanh nghiệp vào năm 2023, SUSE đồng sáng lập [OpenELA](https://openela.org) để giữ mã đó mở, cùng lập trường mà dự án này kế thừa.

Công khai đầy đủ: SUSE *đang* xây công cụ nội bộ để kết nối Lolly với các hệ thống CNTT của chính mình. Đó là thiết lập nội bộ của SUSE, không phải sự chia tách giữa phát triển công khai và riêng tư. Lolly cũng đặt mục tiêu được dựng qua [Open Build Service](https://openbuildservice.org/), với các thành phần chuỗi cung ứng an toàn do [SUSE Application Collection](https://apps.rancher.io/applications) cung cấp.

## Vì sao lại có tên "Lolly Tools"?

**Lolly** vì tự do thật ngọt ngào, và vì ở Úc, New Zealand và Anh, "lolly" nghĩa là kẹo.

**Tools** vì một công cụ chỉ nằm yên cho đến khi bạn cầm nó lên. Nó không chạy khi bạn không dùng, và cũng không theo dõi bạn khi bạn đang dùng.

## Vì sao mọi thứ đều xanh lá?

lolly.tools mở trong [Lolly Demo](/info/lolly-demo.html), hệ thống thiết kế mẫu của chính Lolly, và màu chủ đạo của nó là xanh lá. Đó là một mẫu, không phải quy tắc. Hãy chuyển sang **Lolly Starter**, một hệ thống thiết kế trống, hoặc sang hệ thống của riêng bạn trong [Settings → Design systems](/#/settings?focus=design-systems-section).

## Tôi có dùng được thương hiệu của riêng mình không?

Có. **Design System Setup** (`#/start`) dựng một hệ thống thiết kế từ một màu, một tệp design token hoặc một thiết kế hoàn chỉnh, và mọi công cụ sau đó đều vẽ bằng hệ thống thiết kế của bạn. [Start](/info/quickstart.html#put-your-brand-in) đi qua ba lộ trình.

Một hệ thống thiết kế do tổ chức hoặc bản dựng của bạn cung cấp là được quản lý: nó hiện một khóa và chỉ đọc, và bạn có thể tạo một bản sao chỉnh sửa được để thay đổi.

## Tác phẩm tôi làm hôm qua đâu rồi?

Nếu bạn đã nhấn **Save as** hoặc **Save**, nó nằm trong **Projects**, trên màn hình chính, trong trình duyệt hoặc ứng dụng bạn đã lưu. Nếu bạn chỉ nhấn **Download**, tệp nằm ở nơi trình duyệt hoặc hệ thống lưu các tệp tải xuống, và thường có một bản sao trong **Assets**. Các công cụ [lưu khi bạn làm việc](/info/find-your-work.html#which-tools-save-as-you-work) cũng giữ công việc chưa lưu trong **Projects**. [Find and recover your work](/info/find-your-work.html) đề cập mọi trường hợp.

## Tôi đã đóng tab. Tác phẩm của tôi mất rồi à?

Công việc đã lưu vẫn còn trong **Dự án**. Công việc chưa lưu sẽ mất, trừ ở các công cụ tự lưu khi bạn làm việc, cũng giữ nó trong **Dự án**. Lần sau, hãy nhấn **Lưu thành** trước khi rời đi. Xem [Nếu bạn đã đóng tab hoặc rời khỏi công cụ](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Tôi có thể chia sẻ tác phẩm dưới dạng tệp thay vì liên kết không?

Có. Khi một liên kết không mang hết mọi thứ, như ảnh của riêng bạn hay văn bản dài, hộp thoại Share nói điều gì sẽ mất và đề xuất một tệp **.lolly** thay thế: một tệp chứa thiết kế, các ảnh nó dùng và, nếu bạn chọn, chính công cụ.

Bạn quyết định bao nhiêu thứ được đi cùng. Tên và thông tin của bạn chỉ vào khi hồ sơ của bạn chọn tham gia, và tác phẩm có giấy phép bị giữ lại trừ khi bạn chọn đưa vào. Ai mở một tệp mang công cụ sẽ được hỏi có tin công cụ không trước khi nó chạy. Xem [Sharing your work](/info/using.html#sharing-your-work).

## Thông tin hồ sơ của tôi dùng để làm gì?

Thông tin của bạn trong **Settings** điền sẵn cho các công cụ yêu cầu chúng, như tên trên thẻ tên. Chúng ở lại trên thiết bị này. Nếu bạn cũng bật lựa chọn tham gia, những thông tin bạn chọn được niêm phong vào thứ bạn tạo, nêu tên bạn là nguồn. Không có gì được đưa vào trừ khi bạn chọn đưa thông tin của mình.

Chia sẻ và Sync chỉ gửi nội dung bạn chọn. Trên phiên bản Lolly Work của tổ chức, các phiên chung và công việc được quản trị cũng tới máy chủ đó. Xem [Privacy](/info/privacy.html).

## Làm sao để có ứng dụng di động hoặc máy tính?

Tải chúng từ [Install Lolly](/info/install.html). Trang liệt kê mọi bản dựng cho macOS, Windows, Linux và Android, và chỉ cách kiểm tra tệp bạn đã tải. iPhone và iPad nhận **Lolly Tools** từ App Store; [phần iPhone và iPad](/info/install.html#iphone-and-ipad) có liên kết.

Ai cũng có thể dựng và phát bản sao ứng dụng của riêng mình, với các công cụ và cài đặt mà đối tượng của họ cần. [Build Guide](/info/build-guide.html) chỉ cách làm.

## Lolly báo cần WebGPU. Tôi làm gì được?

Ứng dụng web vẽ bằng WebGPU, một tính năng đồ họa của các trình duyệt hiện đại, và kiểm tra nó trước khi mở một công cụ. Hãy thử theo thứ tự:

1. Cập nhật trình duyệt lên phiên bản hiện hành.
2. Bật tăng tốc đồ họa hoặc phần cứng trong cài đặt trình duyệt, rồi khởi động lại trình duyệt.
3. Thử một trình duyệt đã được kiểm thử: [Supported environments](/info/supported-environments.html) liệt kê chúng.
4. Trên Mac, iPhone hoặc iPad, hãy [cài ứng dụng](/info/install.html) thay thế.

## Lolly có sửa và render được tệp Figma, Penpot, Illustrator hay InDesign của tôi không?

Có. Mở **Design** và nhấp **Import a design**: nó nhận **.fig** Figma gốc (Save local copy), bản xuất **.penpot** của Penpot, **.ai** hoặc **.pdf** của Illustrator, **.idml** của InDesign (File → Export → InDesign Markup) hoặc **bất kỳ SVG nào**. Bạn không cần tài khoản, không cần plugin và không cần giấy phép ứng dụng thiết kế.

![Canvas mở của Design - Import a design nằm trong menu Lolly của thanh công cụ](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Các lớp đến dưới dạng hộp chỉnh sửa được: văn bản vẫn gõ lại được, hình khối vẫn là hình khối và ảnh vào thư viện của bạn. Lưu nó, và **Share with rules** có thể biến bố cục thành công cụ mà ai có Lolly cũng điền lại được. Xem [Import a design](/info/design-import.html).

## Hai người có thể cùng làm trên một bản thiết kế mà không cần internet không?

Có. Một người chia sẻ lời mời, dưới dạng liên kết, mã QR hoặc mã ngắn, và người kia chấp nhận. Cả hai thiết bị khi đó giữ cùng một phiên trực tiếp, kể cả hiện diện và vòng tiêu điểm. Nó hoạt động trên mọi mạng chung, kể cả điểm phát sóng điện thoại dưới tầng hầm, vì không có máy chủ ở giữa. Xem [Working together](/info/collaborate.html). Với đồng nghiệp ở các mạng khác nhau, phiên bản Lolly Work của tổ chức cung cấp work collab có xác thực.

## Feature flag là gì?

Feature flag bật hoặc tắt các phần của Lolly. Khi dùng độc lập, bạn chọn cài đặt cá nhân. Một tổ chức dùng Lolly Work có thể đặt mặc định hoặc ẩn một số công tắc theo chính sách của mình, và các điều khiển được quản lý có nhãn. Xem [Use Lolly at your organisation](/info/organisation.html).

![Feature flag cá nhân trong ứng dụng độc lập; chính sách tổ chức có thể quản lý một số công tắc](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Tiện ích khác với công cụ ở điểm nào?

Một tiện ích làm một việc nhanh trên tệp bạn đã có, như nén PDF, chuyển đổi ảnh hoặc xóa dữ liệu ẩn, và nhiều tiện ích chạy trên thiết bị của bạn mà không tải gì lên. Chúng có để những việc mọi người thường giao cho một trang web ngẫu nhiên ở lại bên trong Lolly. Nén một hợp đồng, chuyển ảnh kỳ nghỉ còn nguyên vị trí hoặc dán một token vào trình định dạng trực tuyến không nên có nghĩa là trao tệp cho một trang với thời hạn lưu giữ, khu vực pháp lý và mô hình kinh doanh không rõ. [Utilities](/info/utilities.html) liệt kê chúng, và [The trade we never agreed to](/info/status-quo.html) kể câu chuyện đằng sau.

![Màn hình Utilities: Strip Hidden Data, Compress PDF, Convert Image và các việc chạy trên thiết bị khác, tất cả ở một nơi](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Tổ chức của chúng tôi có dùng được SSO, dự án chung và phê duyệt không?

Có, với **Lolly Work**, máy chủ tổ chức của cùng dự án mã nguồn mở. Nó chạy riêng và bổ sung đăng nhập một lần qua nhà cung cấp danh tính của bạn, cấp tài khoản SCIM, quyền theo nhóm, dự án và tài nguyên chung, work collab trực tiếp, phê duyệt và bản ghi kiểm toán. Ứng dụng hằng ngày vẫn hoạt động độc lập.

[Use Lolly at your organisation](/info/organisation.html) đề cập đăng nhập và tìm công việc chung, còn [Deployment](/info/deployment.html#organisation-services-with-lolly-work) đề cập thiết lập. Nội dung chung và bản ghi tổ chức theo chính sách quyền riêng tư và lưu giữ của phiên bản đó.

## Khi áp dụng Lolly, tôi có thể gặp những trở ngại nào?

Phần lớn thay đổi nằm ở phía sản xuất hơn là công nghệ. Một đội muốn có bộ công cụ được quản trị cần ai đó soạn hệ thống thiết kế và các mẫu đầu tiên, dù ai cũng có thể bắt đầu làm công cụ của riêng mình trong Design ngay ngày đầu, không cần git. Và các quy trình hiện có vẫn tiếp tục chạy dù đầu ra của chúng lệch thương hiệu, nên chuyển đổi tốt một đầu ra nhìn thấy được, trước và sau đặt cạnh nhau, thuyết phục nhanh hơn một kế hoạch.

[Adoption & Governance](/info/adoption-governance.html) đề cập việc giới thiệu theo vai trò, cách đo một thử nghiệm và một quy trình quản trị có thể trông ra sao.

## Lolly có được "vibe coded" không?

Lolly được phát triển với lập trình có AI hỗ trợ, khám phá có AI hỗ trợ và, ở nhiều chỗ, nội dung có AI hỗ trợ, dùng nhiều mô hình và nhà cung cấp, kể cả từ các công ty tiên phong trên đám mây công cộng. Một con người đã tạo kiến trúc, chăm chút mã nguồn có chủ đích và chỉ đạo nghệ thuật cho trải nghiệm.

Một cảnh báo mức cao hoặc nghiêm trọng trong các phụ thuộc của Lolly sẽ chặn CI. Một cảnh báo chưa thể sửa chỉ được giữ lại như một ngoại lệ đã duyệt kèm lý do bằng văn bản. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) liệt kê từng ngoại lệ hiện đang giữ, và [release notes](https://github.com/lolly-tools/lolly/releases) liệt kê những ngoại lệ mà mỗi bản phát hành mang theo. SECURITY.md cũng nói cách báo cáo một lỗ hổng.

Các kiểm tra trong bản dựng cũng từ chối cách diễn đạt đọc lên như do máy tạo trong chú thích mã, ứng dụng và các tài liệu này, để giữ văn bản giản dị cho mọi người đọc. Một tác dụng phụ là một bộ phát hiện có thể khó phân biệt hơn văn bản nào do mô hình viết. Chúng tôi không chủ ý gây ra điều đó.

Quan trọng nhất, Lolly đứng trên vai nhiều thập kỷ làm việc mã nguồn mở của các chuyên gia khắp thế giới.

**Công bố AI tạo sinh:**

- **Mã do LLM viết:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (danh sách này có thể mở rộng)
- **Khám phá bằng LLM:** Gemini 3.1, Fable, Codex Astra
- **Tài liệu:** Sonnet 5
- **Thư viện mã nguồn mở:** Các tác giả tương ứng của chúng, được thể hiện trong SBOM, chú thích và phần đầu tệp

Danh sách này không bao gồm các mô hình được vendor vào Lolly.

**Đóng góp của con người:**
- **Ý tưởng, xem xét và phản hồi:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, cộng đồng Penpot, Tim Hildred (danh sách chưa đầy đủ)
- **Kiến trúc, chỉ đạo nghệ thuật & người dọn rác AI:** Andy Fitzsimon

## Các công cụ mang thương hiệu SUSE đi đâu rồi?

Chúng nằm trong một kho riêng tư, tách biệt. Một bản clone công khai hoàn toàn không tải gói thương hiệu SUSE, nên bản dựng từ đó dùng hồ sơ `lolly-start` trung tính trừ khi bạn chọn hồ sơ khác: các công cụ cộng đồng không gắn thương hiệu cùng một thương hiệu trống để bạn điền của riêng mình. [lolly.tools](https://lolly.tools) được dựng với hồ sơ `lolly-demo` và mở trong [Lolly Demo](/info/lolly-demo.html), hệ thống thiết kế riêng của Lolly. SUSE vận hành phiên bản riêng của mình để bảo vệ nhãn hiệu.

## Logo Lolly kia là vị gì?

Người thì bảo vị chanh, người thì bảo vị bạc hà, đôi khi lại là táo, Lolly mang đến vị ngọt, còn hương vị là do bạn tạo nên!
