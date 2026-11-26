# Làm việc với đối tác

Nhiều tác phẩm mang hai thương hiệu, chẳng hạn logo nhà tài trợ trên áp phích sự kiện, ưu đãi của đại lý bán lại dưới tên nhà sản xuất, thông báo chung hoặc nghiên cứu tình huống viết cùng nhà cung cấp. Trang này dành cho cả hai bên.

Trên trang này, **thương hiệu chủ đạo** là thương hiệu có hệ thống thiết kế dùng để tạo tác phẩm, và **đối tác** là thương hiệu còn lại trên tác phẩm. Bên nào cũng có thể tạo tác phẩm. [Kiến trúc thương hiệu](/info/brand-architectures.html#co-branding) so sánh đồng thương hiệu với các cách tổ chức thương hiệu khác.

<!--i:eti-info-->
## Cách Lolly xử lý hai thương hiệu hiện nay

- **Một hệ thống thiết kế vẽ mỗi tác phẩm.** Màu sắc, kiểu chữ và quy tắc nội bộ của thương hiệu chủ đạo được áp dụng. Biểu trưng của đối tác được đưa vào dưới dạng hình đồ họa: ảnh từ Assets hoặc biểu trưng tùy chỉnh được giữ trong hệ thống thiết kế.
- **Thương hiệu được chuyển đi dưới dạng tệp.** Tệp hệ thống thiết kế (`.lolly`) mang theo token, phông chữ và logo. Công cụ dùng lại được tạo bằng **Share with rules** mang một bố cục hoàn chỉnh với các đầu vào bạn cho phép. Kỹ năng thương hiệu được chuyển đi dưới dạng tệp riêng.
- **Thương hiệu cũng có thể có địa chỉ.** [Trang thương hiệu](/info/brand-page.html) xuất bản logo, màu sắc, kiểu chữ và quy tắc để đối tác đọc, cùng token và kỹ năng cho các công cụ của họ.
- **Lolly chỉ kiểm tra quy tắc của thương hiệu chủ đạo.** Lolly không biết quy tắc của đối tác, chẳng hạn khoảng trống bảo vệ hoặc kích thước tối thiểu, nên hãy kiểm tra chúng theo hướng dẫn của đối tác. Trong chương trình đối tác Lolly Work, bộ tài liệu đối tác của công ty chứa quy tắc của công ty, và Lolly Design kiểm tra biểu trưng của công ty theo bộ tài liệu đó.
- **Toàn bộ chương trình đối tác chạy trên Lolly Work.** Khi đại lý bán lại, nhà phân phối hoặc đối tác khác tạo tác phẩm theo thương hiệu của bạn trên Lolly Work của bạn, chương trình đối tác chỉ cung cấp cho mỗi công ty đối tác các công cụ, tệp và mẫu bạn chọn. Chương trình giữ logo và thông tin công ty, điền chúng vào mẫu của bạn và ghi nhận công ty trong mỗi tệp. [Vận hành chương trình đối tác](/info/manage/run-a-partner-programme.html) là hướng dẫn cho đội ngũ vận hành chương trình.

<!--i:eti-folder-shared-->
## Chia sẻ thương hiệu của bạn với đối tác

### Chọn những gì cần gửi

| Gửi | Cách làm | Đối tác nhận được | Phù hợp với |
| --- | --- | --- | --- |
| Tệp hệ thống thiết kế | **Export** trên thanh ở đầu [Lolly Design System Setup](/info/brand-studio.html#move-a-brand-between-devices) | Token, phông chữ, logo và lựa chọn chủ đề của bạn, dưới dạng hệ thống thiết kế mà họ có thể chuyển sang | Đối tác tạo nhiều tác phẩm theo thương hiệu của bạn |
| Công cụ dùng lại được | Trong Lolly Design, **Share with rules** ([Chia sẻ thiết kế kèm quy tắc](/info/create-a-tool.html)) | Một bố cục hoàn chỉnh với các đầu vào bạn cho phép, chẳng hạn tên và logo của họ. Tệp mang theo màu đã phân giải, phông chữ và hình ảnh, nên hệ thống thiết kế riêng của họ không thể đổi kiểu của phần đồ họa cố định | Tờ rơi, huy hiệu hoặc biểu ngữ đồng thương hiệu mà mỗi đối tác điền vào |
| Kỹ năng thương hiệu | Phòng **Skills**: **Download skill (.zip)** hoặc **Copy as one file** | Các tiêu chuẩn thành văn của bạn, cho con người và tác tử của họ | Một trong hai trường hợp trên, khi tác tử làm một phần công việc |
| Trang thương hiệu | **Publish a brand page** trong Lolly Design System Setup, hoặc `lolly system publish`, ghi một thư mục bạn đưa lên máy chủ ([Trang thương hiệu](/info/brand-page.html)) | Logo, màu sắc, kiểu chữ và quy tắc hiện tại của bạn tại một địa chỉ, cùng token và kỹ năng cho các công cụ của họ. Logo và tệp phông chữ xuất hiện khi quyền sử dụng cho phép, và trang liệt kê những gì bị giữ lại | Chia sẻ với những người bạn không gửi tệp cho |
| Token | **Tokens (.json)** trong menu **More** của studio | Tài liệu design tokens thuần, không có phông chữ hay logo | Công cụ thiết kế hoặc quy trình dựng riêng của đối tác |

![Lolly Design System Setup trên Lolly Demo, mở ở phòng Skills: Export trên thanh, menu More mở tại Tokens (.json), cùng Download skill (.zip) và Copy as one file bên cạnh kỹ năng đã chọn](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dskills&width=1200&height=900&dpi=192&waitMs=1800&waitSelector=.skills-reader-actions&drive=click%3A%5Bdata-ds-more%5D%3Bwait%3A500&format=svg&walker=1&dark=1&filename=partners-send)

::: warning Phông chữ của bạn đi cùng trong tệp
Phông chữ bạn thêm được chứa trong tệp hệ thống thiết kế, nên hãy kiểm tra xem giấy phép của chúng có cho phép bạn chuyển tiếp các tệp đó không.
:::

Công cụ tái sử dụng yêu cầu bạn xác nhận trước khi đưa vào một ảnh có giấy phép hạn chế việc này ([Xem trước và chia sẻ](/info/create-a-tool.html#preview-and-share)).

### Tạo một mẫu đồng thương hiệu

Công cụ tái sử dụng giữ các thành phần của mọi đối tác trong bố cục của bạn. Đối tác chỉ thay đổi những gì bạn cho phép.

1. Trong Lolly Design, tạo tác phẩm trong hệ thống thiết kế của bạn. Vẽ một hộp ảnh ở vị trí logo của đối tác và chừa khoảng trống quanh hộp theo nhu cầu của bố cục.
2. Chọn **Share with rules** từ File menu. Chọn hộp ảnh rồi chọn **Make editable**. Trong **Rules** của hộp, cho phép tải ảnh thay thế lên, đặt kích thước điểm ảnh tối thiểu và các định dạng tải lên bạn chấp nhận (SVG nếu có thể). Đặt **Image fit** của hộp thành **Contain (fit inside)** để giữ logo rộng hoặc cao bên trong hộp.
3. Cho phép chỉnh sửa cả tên hoặc ưu đãi của đối tác, kèm giới hạn ký tự.
4. Nhấn **Preview** và thử một logo rất rộng, một logo rất cao và một tên dài.
5. Chọn **Share .lolly** và viết hướng dẫn cho đối tác: cần tải lên phiên bản logo nào, chẳng hạn logo ngang đủ màu cho nền sáng.

![Share with rules trên một thẻ sự kiện đồng thương hiệu: hộp logo của đối tác được chọn và có thể chỉnh sửa, còn Rules của hộp cho phép tải lên ảnh ít nhất 480 x 110 điểm ảnh, ở định dạng PNG hoặc SVG](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%255B%257B%2522id%2522%253A%2522board%2522%252C%2522name%2522%253A%2522Build%2520day%2520card%2522%252C%2522kind%2522%253A%2522frame%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A0%252C%2522w%2522%253A1600%252C%2522h%2522%253A900%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.sugar%257D%2522%252C%2522clipChildren%2522%253Atrue%257D%252C%257B%2522id%2522%253A%2522dot-large%2522%252C%2522name%2522%253A%2522Large%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1040%252C%2522y%2522%253A70%252C%2522w%2522%253A480%252C%2522h%2522%253A480%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.pandanus%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522dot-small%2522%252C%2522name%2522%253A%2522Small%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1330%252C%2522y%2522%253A380%252C%2522w%2522%253A240%252C%2522h%2522%253A240%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.green-apple%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522band%2522%252C%2522name%2522%253A%2522Partner%2520band%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A680%252C%2522w%2522%253A1600%252C%2522h%2522%253A220%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.avocado%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522lolly%2522%252C%2522name%2522%253A%2522Lolly%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A96%252C%2522w%2522%253A260%252C%2522h%2522%253A90%252C%2522image%2522%253A%2522lolly%2Flogo%2Fhorizontal%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522imgpos%2522%253A%2522left%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522headline%2522%252C%2522name%2522%253A%2522Headline%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A260%252C%2522w%2522%253A880%252C%2522h%2522%253A180%252C%2522text%2522%253A%2522Build%2520day%25202026%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.liquorice%257D%2522%252C%2522fontSize%2522%253A120%252C%2522weight%2522%253A%2522700%2522%252C%2522font%2522%253A%2522display%2522%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522sub%2522%252C%2522name%2522%253A%2522Subtitle%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A450%252C%2522w%2522%253A880%252C%2522h%2522%253A90%252C%2522text%2522%253A%2522Twelve%2520hours%2520of%2520making%252C%2520with%2520friends%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A48%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522with%2522%252C%2522name%2522%253A%2522In%2520partnership%2520with%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A750%252C%2522w%2522%253A400%252C%2522h%2522%253A80%252C%2522text%2522%253A%2522In%2520partnership%2520with%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A34%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522partner%2522%252C%2522name%2522%253A%2522Partner%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A500%252C%2522y%2522%253A735%252C%2522w%2522%253A480%252C%2522h%2522%253A110%252C%2522image%2522%253A%2522%2Ftools%2Flogo-wall%2Fassets%2Fpartner-name.svg%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522frame%2522%253A%2522board%2522%257D%255D%26w%3D1600%26h%3D900&width=1280&height=1000&dpi=192&waitMs=3000&drive=click%3Abutton%5Baria-label%3D%22File%20menu%22%5D%3Bwait%3A500%3Bclick%3Atext%3DShare%20with%20rules%3Bwait%3A2500%3Bclick%3A%23tool-canvas%20%5Bdata-box-id%3D%22partner%22%5D%3Bclick%3Abutton%3Ahas-text%28%22Make%20editable%22%29%3Bwait%3A1200%3Bclick%3A.dr-input%20.dr-advanced%20%3E%20summary%3Bpress%3AControlOrMeta%2BA%7Con%3D%5Bdata-rule%3D%22image%3AminWidth%22%5D%3Bpress%3A4%3Bpress%3A8%3Bpress%3A0%3Bpress%3AControlOrMeta%2BA%7Con%3D%5Bdata-rule%3D%22image%3AminHeight%22%5D%3Bpress%3A1%3Bpress%3A1%3Bpress%3A0%3Bclick%3A%5Bdata-rule%3D%22image-format%3Ajpeg%22%5D%3Bclick%3A%5Bdata-rule%3D%22image-format%3Awebp%22%5D%3Bclick%3A%5Bdata-rule%3D%22image-format%3Aavif%22%5D&format=svg&walker=1&dark=1&filename=partners-template-rules)

Đối tác thả tệp vào Lolly, xem lại lời nhắc về độ tin cậy, điền các đầu vào và tải xuống những định dạng bạn cho phép ([Sử dụng công cụ đã hoàn thành](/info/create-a-tool.html#use-the-finished-tool)). Lolly giữ logo trong hộp bạn đã vẽ. Lolly không đọc quy tắc khoảng trống an toàn của đối tác, nên logo chỉ có khoảng trống bạn chừa quanh hộp.

### Giao kỹ năng thương hiệu của bạn cho một tác tử

Kỹ năng hướng dẫn con người và tác tử. Lolly kiểm tra các quy tắc nội bộ.

- Trong Lolly Design System Setup, mở phòng **Skills** (`#/start?area=skills`), chọn một kỹ năng và nhấn **Download skill (.zip)**. Các liên kết danh mục trong thư mục trỏ tới Lolly của bạn, còn `lolly.json` ghi lại nguồn của bản sao. **Copy as one file** đặt cùng văn bản đó vào clipboard để dùng trong cửa sổ trò chuyện.
- Từ terminal, `lolly system skill <name> --into=<dir>` ghi cùng thư mục đó ([Trong thư mục cho công cụ tác tử cục bộ](/info/brand-skills.html#in-a-folder-for-a-local-agent-tool)).
- Máy của bạn liệt kê cả kỹ năng được đánh dấu `internal` lẫn `public`, nên hãy chọn những kỹ năng cần gửi ([Kỹ năng công khai và nội bộ](/info/brand-skills.html#public-and-internal-skills)).
- Với hệ thống thiết kế chưa có kỹ năng riêng, Lolly viết một bản cơ sở từ các token và quy tắc nội bộ của hệ thống, rồi phòng này liệt kê bản cơ sở đó.
- Bản sao không tự cập nhật. Khi bạn phát hành bản sửa đổi mới của một kỹ năng, hãy gửi lại thư mục.

<!--i:eti-download-->
## Làm việc với thương hiệu được gửi cho bạn

Dành cho đối tác nhận tệp hệ thống thiết kế. Khi thương hiệu chủ đạo vận hành chương trình đối tác trên Lolly Work riêng, bạn đăng nhập vào đó: trang chủ mở ra với thẻ công ty của bạn và các mẫu được phát hành cho bạn ([Những gì đối tác thấy](/info/manage/run-a-partner-programme.html#what-partners-see)).

1. **Mở tệp.** Thả tệp vào Lolly hoặc nhấn **Open**; **Add from…** trong Lolly Design System Setup cũng nhận tệp. Bản xem trước liệt kê nội dung của tệp trước khi ghi bất cứ thứ gì. Tệp hệ thống thiết kế thêm một hệ thống thiết kế riêng theo tên thương hiệu chủ đạo và kích hoạt hệ thống đó. Hệ thống thiết kế của bạn vẫn ở trên thiết bị. Nếu tệp dùng để kết nối ứng dụng với Lolly riêng của thương hiệu chủ đạo, trước tiên nó liệt kê các tác động lên toàn bộ thiết bị; [Sử dụng Lolly tại tổ chức của bạn](/info/organisation.html) đề cập loại tệp đó.
2. **Tìm hiểu thương hiệu.** Trong Lolly Design System Setup, **Board** hiển thị nội dung của hệ thống thiết kế, **Logos** chứa các biểu trưng và **Rules** liệt kê các quy tắc nội bộ mà Lolly kiểm tra. **Skills** hiển thị bản cơ sở Lolly viết từ các token và quy tắc; kỹ năng riêng của thương hiệu chủ đạo được gửi dưới dạng tệp riêng, nếu họ gửi.
3. **Chuyển giữa các thương hiệu.** **Settings → Preferences → Design systems** chuyển hệ thống thiết kế cho toàn bộ thiết bị, còn **Settings → Design system** có một dải ảnh bìa để chọn chuyển. Hoàn thành tác phẩm của một thương hiệu trước khi chuyển.
4. **Đặt biểu trưng của bạn.** Tải logo lên **Assets**, nơi logo có mặt trong mọi hệ thống thiết kế, hoặc thêm dưới dạng **custom mark** vào hệ thống thiết kế của thương hiệu chủ đạo (phòng **Logos**, **Custom marks**), nơi logo đi cùng trong tệp của hệ thống thiết kế đó. Hệ thống thiết kế có hình ổ khóa là chỉ đọc, nên hãy dùng Assets trong trường hợp đó. [Đặt biểu trưng của đối tác](#place-a-partner-s-mark) có các mục cần kiểm tra.
5. **Kiểm tra trước khi xuất.** Trong Lolly Design, thẻ **Before you export** của bảng xuất liệt kê kết quả đối chiếu với quy tắc nội bộ của thương hiệu chủ đạo theo từng lớp ([Trước khi xuất](/info/design.html#before-you-export)). Thẻ **Design system** hiển thị hệ thống thiết kế được ghi trong tệp.
6. **Gửi lại công việc.** Gửi tệp đã xuất hoặc thiết kế có thể chỉnh sửa dưới dạng `.lolly` ([Chia sẻ công việc của bạn](/info/using.html#sharing-your-work)). Thiết kế mở trong hệ thống thiết kế đang hoạt động, nên thương hiệu chủ đạo mở thiết kế của bạn khi hệ thống thiết kế riêng của họ đang hoạt động.

::: note Tệp hệ thống thiết kế không cập nhật
Tệp hệ thống thiết kế là bản sao của thương hiệu vào ngày xuất. Không có gì cập nhật bản sao đó.
:::

Khi thương hiệu chủ đạo gửi tệp mới hơn, hãy mở tệp theo cùng cách. Sau đó kiểm tra hệ thống thiết kế đang hoạt động trong **Settings → Preferences → Design systems** và xóa bản sao cũ ở đó khi không còn cần đến.

![Design systems trong Settings: Lolly Demo đang hoạt động, Lolly Starter có nút Use để chuyển cho toàn bộ thiết bị và Open or import a file nhận tệp hệ thống thiết kế](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddesign-systems-section&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23design-systems-section&format=svg&walker=1&dark=1&filename=partners-design-systems)

<!--i:eti-image-->
## Đặt biểu trưng của đối tác

| Cách | Các bước | Phù hợp nhất cho |
| --- | --- | --- |
| Một ảnh trong Assets | Thả tệp vào vùng tải lên trong **Assets**, rồi chọn ảnh trong trường ảnh của công cụ, hoặc trong Lolly Design bằng **Image** từ menu thêm trên thanh công cụ | Tác phẩm dùng một lần. Tệp tải lên thuộc về thiết bị, nên có mặt bất kể hệ thống thiết kế nào đang hoạt động |
| Một biểu trưng tùy chỉnh | Phòng **Logos**, **Custom marks**: nhập tên cho biểu trưng, rồi chọn **Choose file…** | Đối tác bạn thường xuyên làm việc cùng. Biểu trưng thuộc về hệ thống thiết kế và đi cùng trong tệp của hệ thống |
| Một cụm logo hoàn chỉnh | Tạo cụm logo từ cả hai biểu trưng trong công cụ vẽ, rồi thêm dưới dạng biểu trưng tùy chỉnh | Cụm logo có chữ "cùng" hoặc "hợp tác với" được dùng nhiều lần |

::: check Trước khi xuất, hãy kiểm tra biểu trưng
- **Đúng tệp.** Dùng tệp đối tác cung cấp, ưu tiên SVG nếu có. Logo sao chép từ trang web hoặc trang chiếu sẽ bị mờ khi in.
- **Đúng phiên bản cho nền.** Dùng phiên bản đảo màu hoặc đơn sắc trên nền tối hoặc nhiều chi tiết, khi hướng dẫn của đối tác có phiên bản đó.
- **Tỷ lệ.** Đặt **Image fit** của hộp ảnh thành **Contain (fit inside)** để biểu trưng không bao giờ bị kéo méo.
- **Khoảng trống an toàn và kích thước.** Chừa khoảng trống quanh biểu trưng theo hướng dẫn của đối tác và giữ biểu trưng lớn hơn kích thước tối thiểu họ yêu cầu. Lolly không đo cả hai.
- **Thương hiệu nào chủ đạo.** Đặt kích thước hai biểu trưng theo hướng dẫn của cả hai thương hiệu về thương hiệu nào chủ đạo.
- **Quyền sử dụng.** Lolly hiển thị giấy phép được ghi cho tài nguyên trong danh mục. Tệp bạn tự tải lên không có bản ghi giấy phép và phần chi tiết hiển thị *Licence not recorded*, nên hãy lưu quyền sử dụng biểu trưng do đối tác cấp cùng hồ sơ của bạn ([Quyền sáng tạo và ghi công](/info/creative-rights.html)).
:::

![Before you export trên một thẻ đồng thương hiệu: hệ thống thiết kế là Lolly Demo, logo của đối tác được ghi nhận là ảnh ngoài tài nguyên của hệ thống thiết kế và bốn quy tắc nội bộ không có gì cần lưu ý](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%255B%257B%2522id%2522%253A%2522board%2522%252C%2522name%2522%253A%2522Build%2520day%2520card%2522%252C%2522kind%2522%253A%2522frame%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A0%252C%2522w%2522%253A1600%252C%2522h%2522%253A900%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.sugar%257D%2522%252C%2522clipChildren%2522%253Atrue%257D%252C%257B%2522id%2522%253A%2522dot-large%2522%252C%2522name%2522%253A%2522Large%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1040%252C%2522y%2522%253A70%252C%2522w%2522%253A480%252C%2522h%2522%253A480%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.pandanus%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522dot-small%2522%252C%2522name%2522%253A%2522Small%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1330%252C%2522y%2522%253A380%252C%2522w%2522%253A240%252C%2522h%2522%253A240%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.green-apple%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522band%2522%252C%2522name%2522%253A%2522Partner%2520band%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A680%252C%2522w%2522%253A1600%252C%2522h%2522%253A220%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.avocado%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522lolly%2522%252C%2522name%2522%253A%2522Lolly%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A96%252C%2522w%2522%253A260%252C%2522h%2522%253A90%252C%2522image%2522%253A%2522lolly%2Flogo%2Fhorizontal%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522imgpos%2522%253A%2522left%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522headline%2522%252C%2522name%2522%253A%2522Headline%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A260%252C%2522w%2522%253A880%252C%2522h%2522%253A180%252C%2522text%2522%253A%2522Build%2520day%25202026%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.liquorice%257D%2522%252C%2522fontSize%2522%253A120%252C%2522weight%2522%253A%2522700%2522%252C%2522font%2522%253A%2522display%2522%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522sub%2522%252C%2522name%2522%253A%2522Subtitle%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A450%252C%2522w%2522%253A880%252C%2522h%2522%253A90%252C%2522text%2522%253A%2522Twelve%2520hours%2520of%2520making%252C%2520with%2520friends%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A48%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522with%2522%252C%2522name%2522%253A%2522In%2520partnership%2520with%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A750%252C%2522w%2522%253A400%252C%2522h%2522%253A80%252C%2522text%2522%253A%2522In%2520partnership%2520with%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A34%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522partner%2522%252C%2522name%2522%253A%2522Partner%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A500%252C%2522y%2522%253A735%252C%2522w%2522%253A480%252C%2522h%2522%253A110%252C%2522image%2522%253A%2522%2Ftools%2Flogo-wall%2Fassets%2Fpartner-name.svg%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522frame%2522%253A%2522board%2522%257D%255D%26w%3D1600%26h%3D900&width=1440&height=1000&dpi=192&waitMs=3000&drive=click%3A.edge-dock-tab%3Ahas-text%28%22Export%22%29%3Bwait%3A2500%3Bclick%3A%5Bdata-action%3D%22preflight-open%22%5D%3Bwait%3A1200&cropSelector=.preflight-modal&format=svg&walker=1&dark=1&filename=partners-before-export)

[Bản ghi hệ thống thiết kế](/info/exporting.html#the-design-system-record) của bản xuất cho biết hệ thống thiết kế và colourway của thương hiệu chủ đạo. Nó không ghi thương hiệu của đối tác, trừ trong chương trình đối tác Lolly Work, nơi nó còn cho biết công ty đối tác và chương trình mà tác phẩm được tạo cho.

### Giao kỹ năng của từng thương hiệu cho một tác tử

Khi tác tử thực hiện công việc, hãy giao nguyên trạng kỹ năng của cả hai thương hiệu và cho tác tử biết thương hiệu nào chủ đạo. Kỹ năng của mỗi thương hiệu giữ tên và id riêng. Lolly không hợp nhất kỹ năng của hai thương hiệu hay quyết định thương hiệu nào được ưu tiên.

<!--i:eti-grid-->
## Tường logo nhà tài trợ và sự kiện

Công cụ [Lolly Logo Wall](/#/tool/logo-wall) sắp logo thành lưới đều cho bảng nhà tài trợ, trang chiếu đối tác hoặc phông nền báo chí. Tại sự kiện, đơn vị tổ chức thường là thương hiệu chủ đạo: tường logo được tạo trong hệ thống thiết kế của đơn vị tổ chức và logo của mỗi nhà tài trợ nằm trên tường dưới dạng hình ảnh.

![Tường nhà tài trợ có ba hạng trên nền xanh đậm, mọi logo đều màu trắng: hai đối tác Gold, ba đối tác Silver và năm đối tác Community, mỗi hạng có đề mục riêng và mỗi hạng thấp hơn nhỏ đi một bậc](/t/url-shot?url=%2F%23%2Ftool%2Flogo-wall%3Flogos%3D%255B%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fyour-logo.svg%2522%252C%2522tier%2522%253A%2522Gold%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Flogo-here.svg%2522%252C%2522tier%2522%253A%2522Gold%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fcompany.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fsponsor.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fbrand-name.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fsample-co.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fexample.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Florem-ipsum.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fplaceholder.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fpartner-name.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%255D%26columns%3D3%26gap%3D64%26padding%3D96%26background%3D033633%26headingColor%3Dffffff%26vectorizeAll%3Dtrue%26inkColor%3Dffffff%26transparentBg%3Dfalse&width=1440&height=900&dpi=192&waitMs=4000&cropSelector=%23tool-canvas&format=svg&walker=1&filename=partners-logo-wall&try=1)

1. Mở Lolly Logo Wall và thả các logo vào **Logos**. Mỗi logo có một bộ điều khiển riêng.
2. Gán **Tier** cho từng logo, chẳng hạn "Đối tác Vàng". Mỗi hạng có các hàng riêng theo thứ tự hạng xuất hiện lần đầu, dưới đề mục riêng; **Tier headings** tắt các đề mục. Khi **Tier sizes** đặt thành **Step down**, mỗi hạng thấp hơn chứa thêm một logo trên mỗi hàng, nên các hạng cao hơn trông lớn hơn. **Presence** và **Size %** điều chỉnh một logo trong hạng của nó.
3. Giữ **Balance sizes** bật. Lolly Logo Wall đặt kích thước từng logo theo trọng lượng thị giác, nên logo nặng được thu nhỏ, logo nhẹ được phóng to và mỗi hạng trông cân đối.
4. **Trim margins** cắt mỗi logo sát phần hình ảnh. Tắt tùy chọn này khi tệp logo đã có khoảng trống an toàn mà chủ sở hữu yêu cầu.
5. **Remove white backgrounds** xóa hộp trắng thường đi cùng logo sao chép từ trang chiếu.
6. Đặt **Columns**, khoảng cách và đệm trong **Layout**. **Background** ban đầu là màu bề mặt của hệ thống thiết kế của bạn.
7. Với tường logo đơn sắc, bật **Render all as vector** và chọn **Ink colour**, hoặc đặt **Filter** của một logo thành **Greyscale**. Chỉ dùng phiên bản đơn sắc khi hướng dẫn của từng nhà tài trợ cho phép.
8. Với phông nền báo chí, chọn **Grid**, **Brick** hoặc **Checker** trong **Step & repeat** và đặt số **Rows**.

Xuất tường logo thành PNG, SVG, PDF hoặc PDF CMYK để in. Đặt kích thước và hình dạng khác trong bảng xuất, chẳng hạn story dọc 1080 x 1920 hoặc trang A4, rồi canvas sắp xếp lại tường logo để lấp đầy hình dạng đó, với ít hoặc nhiều logo hơn trên mỗi hàng. Bản xuất khớp với canvas. Để đặt tường logo lên áp phích, chọn **Image** từ menu thêm trên thanh công cụ trong Lolly Design, vẽ một khung và chọn Lolly Logo Wall trên thẻ **Tools** của bộ chọn ([Công cụ trong một thiết kế](/info/design.html#tools-inside-a-design)). Để thêm chú thích giữa các logo, **Dynamic layout** đặt thành **grid** trong Lolly Design chứa một hộp ảnh cho mỗi logo ([Bố cục trong Lolly Design](/info/design-layout.html#dynamic-layouts)).

Trong terminal, `lolly run logo-wall logos/*.png --output=wall.svg` tạo tường logo từ một thư mục ảnh, còn CSV có các cột `logo` và `tier` tạo tường logo theo hạng. SVG và PNG không cần trình duyệt ([Tường nhà tài trợ theo hạng](/info/cli-rendering.html#a-sponsor-wall-with-tiers)).

Khi nhà tài trợ phát hành một [trang thương hiệu](/info/brand-page.html), `lolly run logo-wall --logos-from=<address or folder>` lấy logo hiện tại của họ cho bề mặt và in ra những gì trang đó nói về cách sử dụng. Lặp lại cờ cho từng nhà tài trợ.

Lolly Logo Wall không biết quy tắc của bất kỳ nhà tài trợ nào. Tiers và Presence đặt kích thước tương đối với nhau, không đặt kích thước tối thiểu của nhà tài trợ và không có gì kiểm tra khoảng trống an toàn giữa các logo liền kề. Kiểm tra tường logo hoàn chỉnh theo hướng dẫn của từng nhà tài trợ ở kích thước sẽ in hoặc hiển thị.

<!--i:eti-hammer-->
## Những gì Lolly chưa làm được

- Tác phẩm được vẽ trong một hệ thống thiết kế. Màu sắc, kiểu chữ và quy tắc của đối tác không tạo thành hệ thống thiết kế bên trong tác phẩm, còn biểu trưng của đối tác là một ảnh.
- Ngoài chương trình đối tác Lolly Work, ứng dụng không lưu hay kiểm tra quy tắc của đối tác: khoảng trống an toàn, kích thước tối thiểu và cách xử lý được phép như đơn sắc hoặc đảo màu.
- Bộ tài nguyên đối tác, một gói gọn nhẹ chứa logo, màu sắc và quy tắc của đối tác để dùng trong công việc của thương hiệu khác, chỉ đến được ứng dụng qua chương trình đối tác Lolly Work. Ở nơi khác, việc kiểm tra bộ tài nguyên chạy từ terminal: `lolly check --kit=<file>` đo các biểu trưng đối tác trong tài liệu Lolly Design ([Kiểm tra bản dựng lại](/info/cli-decks.html#check-the-recreation)).
- Lolly không tạo cụm logo từ hai biểu trưng theo bố cục "cùng", "hợp tác với" hoặc "bởi". Hãy thêm cụm logo hoàn chỉnh dưới dạng biểu trưng tùy chỉnh.
- Một hệ thống thiết kế hoạt động cho toàn bộ thiết bị, nên không thể mở hai thương hiệu cạnh nhau.
- Tệp hệ thống thiết kế xuất từ ứng dụng không chứa kỹ năng thương hiệu, nên hãy gửi các kỹ năng dưới dạng tệp riêng.
- Logo lấy từ trang thương hiệu là một ảnh trong hàng của nó và hàng đó không nhớ trang nguồn. Không có gì hiển thị ai đã phát hành trang, nên hãy tự kiểm tra địa chỉ.
- Ứng dụng web được lưu trữ không thể lấy trang của thương hiệu khác vì Content Security Policy của nó chỉ cho phép các máy chủ được chỉ định. Lấy logo trong terminal hoặc lưu tệp rồi thêm vào **Assets**.

<!--i:eti-map-pin-->
## Tiếp theo nên xem gì

- **[Kiến trúc thương hiệu](/info/brand-architectures.html)**: đồng thương hiệu, nhãn trắng và các cách tổ chức khác, cùng việc cần làm trong Lolly cho từng cách.
- **[Vận hành chương trình đối tác](/info/manage/run-a-partner-programme.html)**: những gì đối tác nhận được trên Lolly Work của bạn và cách thiết lập, vận hành chương trình.
- **[Chia sẻ thiết kế với quy tắc](/info/create-a-tool.html)**: công cụ tái sử dụng với bố cục cố định và các đầu vào bạn chọn.
- **[Kỹ năng thương hiệu](/info/brand-skills.html)**: cách viết, đọc và giao kỹ năng cho tác tử.
- **[Lolly Design System Setup](/info/brand-studio.html)**: logo, biểu trưng tùy chỉnh và chuyển hệ thống thiết kế giữa các thiết bị.
- **[Trang thương hiệu](/info/brand-page.html)**: phát hành thương hiệu tại một địa chỉ và lấy logo đối tác từ trang của họ.
- **[Quyền sáng tạo và ghi công](/info/creative-rights.html)**: những gì Lolly ghi lại về các tác phẩm mà nó vẽ.
