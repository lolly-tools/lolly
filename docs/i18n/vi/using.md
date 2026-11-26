# Sử dụng Lolly

Mở công cụ, thay đổi những phần công cụ cho phép, lưu kết quả rồi chia sẻ bằng liên kết hoặc tệp.

Mọi thứ chạy trên thiết bị của bạn mà không cần tài khoản và dùng được ngoại tuyến khi các công cụ cùng tài nguyên cần thiết đã được tải xuống. Để khởi động, ứng dụng cần trình duyệt hoặc ứng dụng có WebGPU. [Môi trường được hỗ trợ](/info/supported-environments.html) liệt kê những môi trường đã được kiểm thử.

**Quy trình**, gồm bốn bước:

::: steps
- <!--i:eti-home--> **[Mở công cụ](#find-your-way-around)** Nhấp một thẻ trên màn hình chính. Các điều khiển nằm cạnh bản xem trước trực tiếp.
- <!--i:eti-sliders--> **[Thay đổi đầu vào](#change-what-the-tool-lets-you-change)** Chỉ những đầu vào tác giả cho phép sửa. Nhấp vào thiết kế để tìm điều khiển của nó.
- <!--i:eti-folder-plus--> **[Lưu công việc](#saving-continuing)** **Save** giữ công việc trong My library và Projects giúp mở lại.
- <!--i:eti-link--> **[Chia sẻ thiết kế](#sharing-your-work)** Liên kết mang theo mọi đầu vào hoặc một tệp `.lolly`.
:::

<!--i:eti-home-->
## Làm quen với giao diện

::: figure using-app-map
Màn hình chính có bốn thẻ ở trên và một thanh ở dưới. Khi mở công cụ, các điều khiển xuất hiện cạnh bản xem trước trực tiếp.
:::

Phía trên màn hình chính có bốn thẻ: **Tools**, **Utilities**, **Assets** và **Projects**. Tools dùng để sáng tạo. Utilities chuyển đổi, kiểm tra hoặc dọn tệp. Assets là thư viện của bạn. Projects chứa công việc bạn đã lưu.

Thanh ở dưới chứa **Open**, **Settings**, ô tìm kiếm, lối tắt **Verify** đến Lolly Verify và **Docs** để mở các hướng dẫn này. Thanh xuất hiện trong Tools, Utilities, Assets, Projects, Settings và hướng dẫn trong ứng dụng, rồi ẩn khi mở công cụ. [Lolly Search](/info/search.html) tìm công cụ, công việc đã lưu, tài nguyên và cài đặt của bạn từ ô đó. [Ask Lolly](/info/ask.html) trả lời câu hỏi bạn gõ bằng phần phù hợp trong các hướng dẫn này.

Nhấp một thẻ để bắt đầu công việc mới bằng công cụ đó. Mở lại công việc đã lưu từ **Projects**. Ở lần truy cập đầu tiên, dải chào mừng phía trên thư viện công cụ đưa ra một hành động để bắt đầu: **Start making** khi dùng Lolly Demo hoặc **Make it yours** để thiết lập hệ thống thiết kế riêng.

![Thẻ trong thư viện công cụ với điều hướng qua các ví dụ và hành động New](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Mỗi công cụ có chế độ xem chia đôi: **điều khiển** ở một phía và **bản xem trước** trực tiếp ở phía kia. Bản xem trước cập nhật khi bạn thay đổi điều khiển và nội dung bạn thấy cũng là nội dung được xuất.

![Chế độ xem chia đôi của công cụ - ngăn xếp điều khiển bên trái và biểu đồ cột nhóm được vẽ trực tiếp bên phải](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Lolly Design** là trường hợp ngoại lệ: canvas tự do với các hộp để kéo, đổi kích thước và gõ vào, cùng thanh trên, dòng thời gian và điều khiển bộ trang chiếu riêng. [Lolly Design: canvas tự do](/info/design.html) là hướng dẫn cho công cụ này.

<!--i:eti-sliders-->
## Thay đổi những phần công cụ cho phép

Công cụ chỉ hiển thị những đầu vào được phép thay đổi. Tác giả đã ấn định màu sắc, bố cục, kiểu chữ và logic để công việc của bạn tuân theo quy tắc của họ. Đầu vào gồm văn bản, thanh trượt, bộ chọn màu, danh sách thả xuống, ngày, bộ chọn ảnh và nhóm hàng lặp. Một số nằm trong các phần có thể gập lại.

![Ngăn xếp điều khiển của công cụ - ô văn bản, nút mở bảng màu và thanh trượt, còn những phần tác giả đã khóa thì không xuất hiện](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Nhấp vào thiết kế để tìm điều khiển tương ứng.** Nhấp một phần tử trong bản xem trước để điều khiển của nó được cuộn vào tầm nhìn và nhận tiêu điểm. Trong nhóm hàng lặp, hàng bạn nhấp sẽ bung ra.

**Clear changes** nằm trên các điều khiển, đưa mọi đầu vào về giá trị mặc định.

**Các lựa chọn của hệ thống thiết kế.** Khi hệ thống thiết kế cung cấp nhiều colourway, diện mạo sáng và tối hoặc lựa chọn chủ đề khác, chúng nằm trong phần **Design system** dưới các điều khiển. Lựa chọn chỉ hiện khi có tác dụng với công cụ này, nên tiện ích tệp không có phần đó. Mỗi colourway hiện thành một chấm mang màu riêng, sáng và tối là hai nút còn lựa chọn khác là một danh sách.

Lựa chọn này thuộc về tác phẩm đang làm. Nó được giữ trong liên kết và phiên đã lưu. Mọi màu gắn với hệ thống thiết kế thay đổi theo lựa chọn, còn màu của ứng dụng vẫn giữ nguyên. Lolly Design có các lựa chọn tương tự ở thẻ **Canvas** trong Inspector. Công cụ lấy màu sắc làm nội dung có thể giữ colourway chuẩn và khi đó không hiển thị các chấm colourway. [Sử dụng Lolly Demo](/info/lolly-demo-in-use.html#colourways-on-real-work) minh họa colourway trên tác phẩm thực tế. Để dùng một colourway cho ứng dụng và mỗi tác phẩm mới, chọn nó trong **Settings → Appearance** ([Chọn colourway riêng](/info/colourways.html#make-a-colourway-your-own)).

### Thu phóng và kéo bản xem trước

- **Thu phóng:** Cmd/Ctrl-cuộn hoặc chụm trên bàn di chuột, với con trỏ làm tâm. Dùng bàn phím, `0` hoặc `Shift+1` vừa khung toàn bộ, `1` hoặc `Shift+0` đặt 100% và `Shift+2` vừa khung vùng chọn. `+` / `−` thu phóng quanh con trỏ nếu con trỏ nằm trên vùng làm việc, nếu không thì quanh tâm.
- **Kéo:** giữ **Space** rồi kéo hoặc kéo bằng nút giữa chuột. Thao tác nhấp thông thường vẫn dùng để nhấp các phần của thiết kế.
- **Cảm ứng:** chụm để thu phóng, kéo để dịch chuyển và chạm đúp để vừa khung.
- **HUD thu phóng:** nhấn giữ hình xoáy Lolly ở góc để mở `−`, **Fit** và `+`. Chạm nhanh vào hình xoáy vẫn mở menu hồ sơ.

Trong Lolly Design, **Fit all** tính cả artboard lẫn các lớp rời. Bạn có thể thu nhỏ thủ công xuống dưới 20% cho đến khi trang chiếm nửa khung nhìn. Mức thấp nhất là giá trị nhỏ hơn trong hai giá trị: 5% tỷ lệ Fit thông thường và mức thu phóng tuyệt đối 2%.

Mỗi lần thay đổi kích thước đầu ra, khung nhìn tự trở về mức vừa khung.

![HUD thu phóng mở từ hình xoáy ở góc canvas - trừ, Fit, cộng, tiếp đến là công tắc chủ đề, âm thanh và tay nắm để di chuyển HUD](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Hoàn tác và làm lại

**Cmd/Ctrl-Z** lùi một bước còn **Cmd/Ctrl-Shift-Z** (hoặc **Cmd/Ctrl-Y**) tiến một bước. Các nút **Undo** và **Redo** nằm trên phần điều khiển hoặc ở thanh trên trong Lolly Design. Nút chuyển sang màu xám khi không còn bước nào. Thông báo cho biết đầu vào nào vừa được hoàn tác khôi phục, kèm nút **Redo**.

- **Một lần kéo tính là một bước.** Nhiều thay đổi trên cùng điều khiển trong nửa giây được gộp thành một bước.
- **Giữ lại 100 bước gần nhất.** Chỉnh sửa mới sau khi hoàn tác sẽ xóa ngăn xếp làm lại.
- **Trong ô văn bản**, Cmd/Ctrl-Z do trường đó xử lý theo từng ký tự. Lolly xử lý phím này cho thanh trượt, danh sách thả xuống, màu sắc và công tắc.
- **Chọn tệp** trong đầu vào tệp không được tính là một bước vì các byte chỉ được giữ trong phiên hiện tại.

Trong phiên [cộng tác](/info/collaborate.html) trực tiếp, thay đổi từ thiết bị khác không bao giờ được thêm vào ngăn xếp hoàn tác của bạn. Hoàn tác được giữ cho đến khi bạn rời công cụ hoặc tải lại. Với thay đổi cũ hơn, những công cụ lưu trong khi bạn làm việc giữ các phiên bản trước ở **History** ([Quay lại phiên bản trước](/info/find-your-work.html#go-back-to-an-earlier-version)).

### Camera trực tiếp

Các hiệu ứng của công cụ **Filter** (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art và Glitch) có nút **Go live** khi có camera. Bật nút này để hiệu ứng theo webcam của bạn từng khung hình. Bản xuất chuyển động ghi lại kết quả dưới dạng GIF, WebM hoặc MP4. Các khung hình được xử lý trên thiết bị của bạn. Camera được giải phóng ngay khi bạn dừng hoặc rời công cụ. Mọi bộ chọn ảnh cũng có **Take a photo** để chụp một khung hình.

<!--i:eti-folder-plus-->
## Lưu & tiếp tục

Để giữ công việc của bạn, nhấn **Save**, nút dấu tích cạnh **Export** trên viên thuốc kết xuất. Công việc mới được đưa vào **My library**, công việc đã lưu được cập nhật tại chỗ và không có tệp nào được tải xuống. Bảng xuất cũng có nút **Save** này.

Để chọn nơi lưu, nhấn **Save as** cạnh **Download** trong bảng xuất. Trong **Save to a project**, giữ lựa chọn **My library** hoặc chọn một dự án (**＋ New project…** tạo dự án mới), rồi nhấn **Save**. **Save as a template** lưu thiết kế thành một [mẫu](/info/templates.html) để bắt đầu tài liệu mới. Trong Lolly Design, **Save as** có trong menu Lolly. Trên điện thoại, nhấn **•••**, tiếp đến **File menu**, rồi **Save as**.

![Viên thuốc kết xuất gồm hai nửa: Export có mũi tên hướng lên để mở bảng xuất và Save có dấu tích để lưu tại chỗ](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Nhấn **Save** trên viên thuốc kết xuất, hoặc **Save as** để chọn dự án.
- <!--i:folder--> Mục được đưa vào **My library** hoặc dự án bạn đã chọn.
- <!--i:home--> Sau đó, nhấn **Home** ở góc trên bên trái và mở thẻ **Projects**.
- <!--i:document--> Mở mục đó. Mọi cài đặt đều được khôi phục, sẵn sàng để thay đổi và xuất lại.
:::

Các mục dùng tên tệp bạn nhập trong bảng xuất hoặc tên công cụ của chúng, chẳng hạn **QR Code**. Tệp từ **Download** là một bản sao hoàn chỉnh. Để sửa về sau, mở mục đã lưu trong Projects.

::: note Các bản lưu ở lại trên thiết bị này
Các bản lưu cá nhân ở lại trên thiết bị này, trong trình duyệt hoặc ứng dụng bạn dùng để lưu, trừ khi bạn bật [Sync](/info/sync.html).
:::

Nếu có thứ không ở nơi bạn nghĩ, [Tìm và khôi phục công việc của bạn](/info/find-your-work.html) trình bày mọi trường hợp, từ thẻ đã đóng đến dữ liệu trình duyệt bị xóa.

::: details Dự án nhóm với Lolly Work (tùy chọn)
Nếu [tổ chức của bạn dùng Lolly Work](/info/organisation.html), hãy đăng nhập vào phiên bản của tổ chức và mở **Projects → Team projects** để xem các phiên được chia sẻ với bạn. Tổ chức quy định quyền truy cập và thời gian lưu giữ, còn dịch vụ Lolly Work của tổ chức lưu trữ các phiên đó. Khi tổ chức cho phép chỉnh sửa trực tiếp, một phiên được chia sẻ sẽ tham gia cộng tác trực tiếp ngay khi mở. [Cùng làm việc](/info/collaborate.html#collabs-through-lolly-work-optional) giải thích các bước.

Thư viện cá nhân của bạn vẫn tách biệt. Đăng nhập trên thiết bị khác cho phép bạn truy cập công việc của nhóm. Các bản lưu cá nhân vẫn cần Sync hoặc bản sao lưu để chuyển sang.
:::

<!--i:eti-link-->
## Chia sẻ công việc của bạn

Chia sẻ thiết kế dưới dạng liên kết hoặc tệp. **Share** trong các điều khiển xuất mở hộp thoại có cả hai lựa chọn. **Share link** trên một phiên đã lưu trong Projects mở cùng hộp thoại cho phiên đó. Sau khi bạn gửi tệp đến Google Drive, Nextcloud, một bucket S3, Dropbox hoặc OneDrive, hộp thoại cũng có thể tạo liên kết qua dịch vụ đó ([Xuất một tệp](/info/exporting.html#how-export-works)).

::: cols
## Liên kết

- Chứa mọi đầu vào trong địa chỉ, nhờ đó liên kết tái tạo được thiết kế.
- Bỏ lại ảnh và tệp bạn đã thêm từ thiết bị này, văn bản rất dài và danh sách rất lớn.
- Mở trong mọi trình duyệt, nên bạn có thể đánh dấu trang, dán hoặc đưa liên kết vào một commit.

## Tệp .lolly

- Chứa phiên đã lưu cùng ảnh và tệp trên thiết bị này, và cũng có thể chứa công cụ cùng hệ thống thiết kế.
- Giữ lại tác phẩm có giấy phép trong danh mục, trừ khi bạn chọn đưa các tệp đó vào.
- Mở trong Lolly: nhấp đúp, dùng **Open** hoặc thả tệp vào ứng dụng.
:::

### Liên kết

Liên kết nằm ở đầu hộp thoại, cùng nút **Copy** và nút **QR** để mở liên kết trong công cụ QR Code. Bên dưới liên kết, **Link options** có:

- **Open in the installed app** chuyển liên kết sang địa chỉ `lolly://` cho Shortcuts, trình khởi chạy và tác vụ tự động, giữ nguyên mọi tham số.
- **Shortest link** gói một thiết kế dài thành token gọn và cho biết số ký tự tiết kiệm được. Dạng dễ đọc vẫn có sẵn.
- **Password-protect this link** mã hóa liên kết trên thiết bị của bạn bằng AES-256. Mật khẩu không bao giờ nằm trong liên kết.
- **Pin this tool version** thêm cờ `_v`, để bản cập nhật công cụ về sau không thể thay đổi những gì liên kết kết xuất.
- **When the recipient opens the link…** chọn chế độ toàn màn hình, bảng xuất mở sẵn, tải xuống khi mở (`&export`) hoặc sao chép vào clipboard (`&copy`).
- **Copy credit** sao chép chú thích "Được tạo bằng Lolly" cùng liên kết để dùng trong bài đăng hoặc trang chiếu.

Khi công cụ có các trường cá nhân, chẳng hạn tên của bạn, **Review personal fields** giữ từng trường ngoài liên kết cho đến khi bạn đánh dấu trường đó. [Chế độ URL](/info/url-mode.html) trình bày mọi thứ mà liên kết có thể chứa.

**Hộp thoại cho biết những gì liên kết không thể chứa.** Khi tạo liên kết, Lolly đếm những thứ không thể đưa vào địa chỉ. Nếu có nội dung bị bỏ, hộp thoại liệt kê nội dung đó và chỉ bạn đến lựa chọn tệp. Liên kết chỉ dài thì có một ghi chú nhẹ hơn kèm số ký tự.

**Với một số công cụ, liên kết chính là toàn bộ sản phẩm.** Jump Page gom các liên kết của bạn vào một trang để chia sẻ: liên kết hồ sơ, bài nói chuyện hoặc trang giới thiệu cửa hàng. Trang chính là liên kết, nên không có nội dung được lưu trên máy chủ và không có tài khoản đứng sau trang. Khách xem thấy trang chiếm toàn bộ chiều rộng, mỗi liên kết một cảnh khi họ cuộn.

![Jump Page trong trình soạn thảo: cảnh tiêu đề ở đầu trang, bên dưới là các cảnh liên kết](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Liên kết do tổ chức quản lý với Lolly Work
Với việc chia sẻ cần thời hạn, khả năng thu hồi hoặc mật khẩu, Lolly Work cung cấp liên kết được quản lý đến các phiên, công cụ và tài nguyên danh mục được chia sẻ. Chúng được phân giải qua dịch vụ của tổ chức và tuân theo các quy tắc truy cập của tổ chức. Chúng tách biệt với các liên kết tự chứa ở trên. Thu hồi liên kết không thể lấy lại tệp mà người khác đã tải xuống. [Kết xuất và chia sẻ](/info/manage/sharing.html) liệt kê các loại liên kết và quyền.
:::

### Tệp .lolly

**Download .lolly**, trong phần **Editable file** của hộp thoại Share, ghi thiết kế hiện tại thành một tệp. Tác phẩm thông thường trong danh mục được đưa vào cùng ảnh và tệp từ thiết bị này. Tệp đã cũ hoặc không khả dụng vẫn được giữ dưới dạng tham chiếu bên ngoài. Trước khi lưu, hộp thoại hiện dung lượng tệp, số tệp được nhúng, số tệp được tham chiếu và có bao gồm công cụ hay không. Nếu thiết bị của bạn có bảng chia sẻ, **Send to…** chuyển tệp đến bảng chia sẻ (AirDrop, chia sẻ trên Android).

**Download project (.lolly)**, trong menu của một thư mục ở **Projects**, ghi cả thư mục để người khác có thể tiếp tục mọi phiên trong thư mục đó. Các phiên hàng loạt bị bỏ qua và thông báo cho biết số lượng. **Download originals**, trong cùng menu, ghi một tệp zip thông thường, trong đó mỗi mục là một tệp riêng.

Trước khi gửi tệp đi, bạn quyết định ba điều:

- **Có đưa tên của bạn vào hay không.** Tên, email và tổ chức của bạn chỉ được ghi khi **Use my details to create** được bật trong [hồ sơ của bạn](/info/profile.html). Khi tắt, tệp chỉ ghi rằng nó được tạo bằng Lolly và thời điểm tạo.
- **Có đưa tác phẩm bị giữ lại vào hay không.** Tác phẩm có giấy phép và tác phẩm bị khóa theo thương hiệu mặc định được giữ lại, cũng như tác phẩm trong danh mục có giấy phép đã ghi mà Lolly chưa đọc được. Nếu thiết kế dùng những tác phẩm này, hộp thoại cho biết số lượng và đưa ra lựa chọn *Download without them* hoặc *Include and download*. Đưa chúng vào nghĩa là trao các tệp cho bất kỳ ai mở `.lolly`. Tác phẩm trong danh mục chưa ghi thông tin về quyền vẫn được đưa vào, và hộp thoại liệt kê từng tác phẩm để bạn kiểm tra trước khi gửi. `CREDITS.txt` trong tệp liệt kê những gì được đưa vào và giữ lại, kèm lý do. [Quyền sáng tạo và ghi công](/info/creative-rights.html) giải thích các quy tắc.
- **Có đưa công cụ vào hay không.** **Include the tool** đóng gói các tệp của chính công cụ, để thiết kế mở được trên thiết bị chưa có công cụ đó. Lựa chọn này ban đầu được đánh dấu với công cụ tùy chỉnh, chẳng hạn một bản fork, và không được đánh dấu với công cụ có trong danh mục đã ký. Trên bản dựng không có danh mục đã ký, mọi công cụ đều được tính là tùy chỉnh.

**Mở tệp.** Trong ứng dụng máy tính và di động, nhấp đúp hoặc chạm vào `.lolly`, chọn **Open with Lolly** hoặc gửi tệp đến Lolly từ bảng chia sẻ. Trong ứng dụng web, nhấn **Open** hoặc thả tệp vào Lolly. Mỗi cách đều đọc bản kê của tệp trước và cho biết dung lượng, nội dung cùng những gì sẽ xảy ra trước khi ghi bất cứ thứ gì.

::: warning Cài đặt công cụ sẽ chạy mã của công cụ đó
Nếu tệp chứa một công cụ bạn chưa có, **Trust this tool?** hiển thị công cụ cùng tác giả và cho biết rằng mở tệp sẽ chạy mã riêng của công cụ trên thiết bị của bạn. **Trust & install** tiếp tục thao tác.
:::

Nếu bạn từ chối, công việc vẫn được lưu vào Projects và chờ đến khi bạn thêm công cụ. Công cụ có mã được phân phối dưới dạng mô-đun hiện chưa cài đặt được theo cách này và cũng bị từ chối như vậy.

::: details .lolly chứa gì và cách mở tệp này
`.lolly` là phần mở rộng gói của Lolly, và `format` trong `manifest.json` cho biết nội dung bên trong:

- Một **thiết kế được chia sẻ** (`lolly-share`) chứa một phiên đã lưu, các tệp nhúng và biên nhận cho mọi thứ vẫn được phân giải qua tham chiếu. Nó cũng có thể chứa công cụ và hệ thống thiết kế. Mở tệp sẽ thêm một Project mới và không bao giờ ghi đè phiên.
- Một **dự án được chia sẻ** (`lolly-share`, loại `project`) chứa một thư mục từ Projects: các thư mục con, mọi phiên trong đó cùng ô xem trước và các ảnh được lưu ở đó. Mở tệp sẽ thêm một bản sao của thư mục. Mỗi phiên được đưa vào dưới dạng `sessions/<key>.json`, với ô xem trước nằm trong `thumbs/`. Phiên bản Lolly có trước tính năng tệp dự án sẽ yêu cầu bạn cập nhật.
- Một **gói hệ thống thiết kế** (`lolly-brand`) chứa token và có thể chứa phông chữ, logo, các phiên bản đã xuất bản và tài nguyên được giữ lại. Mở gói sẽ thêm một hệ thống thiết kế riêng có tên và kích hoạt hệ thống đó.
- Một **gói không gian làm việc hoặc phiên bản triển khai** là `lolly-brand` có khai báo công cụ, tài nguyên danh mục và có thể có địa chỉ phiên bản triển khai. Tải gói sẽ thay thế lớp phủ không gian làm việc duy nhất đã tải trước đó, và bản xem trước liệt kê những tác động trên toàn thiết bị này.

Bản sao lưu toàn bộ thiết bị không phải là `.lolly`. Nó vẫn là `LollyTools-….zip` (định dạng `lolly-backup`) và được khôi phục qua **Settings → Storage → Import data…**. Thư mục công cụ được nén cũng vẫn là `.zip`. [Chuyển dữ liệu](/info/data-transfer.html) là tài liệu tham chiếu về định dạng.

`.lolly` là một tệp zip thông thường. Đổi tên thành `.zip` để xem bên trong. Ảnh của bạn nằm trong `assets/uploads/`, còn tác phẩm trong danh mục nằm trong `assets/catalog/`. `manifest.json` liệt kê mọi tệp, và README mô tả tệp này là gì.

macOS, Windows, Linux, iOS và Android đều đăng ký định dạng này. Trình quản lý tệp trên máy tính hiển thị tệp như tài liệu Lolly, và GNOME Files có thể hiện hình thu nhỏ riêng của phiên đã lưu. Khi mở từ Lolly Design System Setup, ứng dụng đề xuất thao tác hệ thống thiết kế nếu thiết kế được chia sẻ có chứa hệ thống đó, nhưng không bao giờ ẩn **Open shared design**.

Trên iOS hoặc Android, tài liệu được chuyển từ ứng dụng khác bị giới hạn ở 48 MB và ứng dụng sẽ cho biết điều này. Việc chuyển giao sao chép các byte của tài liệu qua ranh giới ứng dụng. **Open** bên trong Lolly không có giới hạn này, nên hãy dùng nó cho gói lớn hơn.

Sau khi bạn xác nhận, Lolly giải nén và xác minh gói một lần. Tài nguyên được đưa vào thư viện của bạn, đối chiếu bằng tổng kiểm để tái sử dụng tệp đã có trên thiết bị. Các phiên được đưa vào Projects với id mới, nên cùng một tệp có thể được mở hai lần. Phiên thiếu công cụ sẽ chờ ở đó. Tệp trên 100 MB được báo là lớn, và bản xem trước cảnh báo khi bộ nhớ trình duyệt báo dung lượng trống ít hơn dung lượng tệp cần. Mọi phần thuộc phạm vi kiểm tra tính toàn vẹn đều được kiểm tra trước khi ghi chính thức, và bản sao bị hỏng sẽ bị từ chối mà không để lại gì.
:::

Cả liên kết lẫn tệp đều trao một bản chụp trạng thái. Để chỉnh sửa trực tiếp, [Cùng làm việc](/info/collaborate.html) trình bày cách cộng tác riêng giữa hai thiết bị và cộng tác công việc tùy chọn qua Lolly Work.

<!--i:eti-images-->
## Assets - thư viện của bạn

**Lolly Assets** (`#/a`) có những gì công cụ của bạn có thể dùng: logo thương hiệu, ảnh, âm thanh và chuyển động được nhóm theo loại, cùng các tệp của bạn. Nội dung bạn tải lên được lưu trên thiết bị của bạn. Tổ chức dùng Lolly Work cũng có thể cung cấp danh mục dùng chung theo quy tắc truy cập riêng ([Dùng Lolly tại tổ chức của bạn](/info/organisation.html)).

![Assets với mẫu màu, phông chữ của thương hiệu và nội dung bạn tải lên](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Đưa tệp của bạn vào.** Thả ảnh, SVG, đoạn âm thanh, video, Lottie, PDF hoặc bộ trang PowerPoint vào vùng tải lên, hoặc nhấp để chọn. Tệp xuất hiện ngay trong Assets và bộ chọn tài nguyên của mọi công cụ. PDF nhiều trang hoặc `.pptx` sẽ hỏi bạn muốn giữ trang hay trang chiếu nào, và mỗi trang trở thành một tài nguyên SVG. Ảnh bạn thêm bên trong công cụ được giữ nguyên trong **My images**, nên Content Credential trên ảnh vẫn xác minh được. Chỉ tệp rất lớn mới hỏi có đổi kích thước không. **Settings → Storage** cho biết **My images** chiếm bao nhiêu dung lượng. Không có giới hạn nào ngoài bộ nhớ của thiết bị. Để xóa dữ liệu EXIF và GPS khi tải lên, bật **Strip metadata from uploads** trong **Settings → Feature flags**. Content Credentials được giữ trong cả hai trường hợp.
- <!--i:star--> **Đánh dấu yêu thích những gì hay dùng.** Gắn sao cho tài nguyên hoặc mẫu màu thương hiệu để ghim lên đầu mọi bộ chọn.
- <!--i:folder--> **Sắp xếp gọn lại.** Chuyển tài nguyên sang nhóm khác, ẩn tài nguyên thương hiệu dùng chung mà bạn không dùng (**Show hidden** hiện lại chúng) hoặc xóa nội dung bạn tải lên. Thanh chọn giống trong Projects thao tác trên toàn bộ vùng chọn.
- <!--i:layers--> **Tách video khỏi nền.** Mở chi tiết video, hoặc nhấp chuột phải vào thẻ của nó trong bộ chọn tài nguyên và chọn **Remove background…**. **On-device model** tách chủ thể khỏi một cảnh phức tạp. **Colour key** loại bỏ phông nền có ánh sáng đều như phông xanh và không cần tải xuống. **Tolerance**, **Softness** và **Spill removal** điều chỉnh mép. **Resolution** (360, 480, 720 hoặc 1080p, không bao giờ vượt nguồn) đánh đổi độ chi tiết lấy tốc độ. Kết quả tách nền là WebP hoặc PNG động có độ trong suốt, được lưu cạnh bản gốc. Content Credential của nguồn đi cùng kết quả như một thành phần. [Tạo một lần, kết xuất như nhau](/info/ai-features.html) giải thích vì sao đây vẫn là một chỉnh sửa thông thường.

### Mang bảng màu và phông chữ của bạn đi mọi nơi

Bảng **Swatches** trong Assets hiện màu của thương hiệu: các màu thương hiệu, màu bạn đã thêm, các dải sắc độ và phổ màu. Các màu theo vai trò mà Lolly dành cho giao diện (văn bản, bề mặt, cạnh, màu chủ đạo của colourway và bản sao màu thương hiệu dưới tên khác) nằm sau thẻ **Show colour roles** màu xám ở cuối bảng.

Mỗi màu là một thẻ như mọi tài nguyên khác. Nhấp vào một màu để mở chi tiết, chọn vài màu để tải xuống hoặc tải cả bảng màu theo định dạng mà công cụ khác của bạn đọc được:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** hoặc **CSS classes**, cho biểu định kiểu hoặc bản dựng. Màu ngoài sRGB giữ giá trị dải rộng: CSS đặt giá trị đó sau mã hex, còn JSON giữ mã hex cùng màu dải rộng, công thức CMYK và mực màu pha bên cạnh.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**, cho Illustrator hoặc Photoshop. Màu được khóa theo công thức CMYK trở thành mẫu màu CMYK đó, mực màu pha trở thành mẫu màu pha có tên và màu ngoài sRGB trở thành Lab.
- <!--i:pentool--> **GIMP palette (.gpl)**, cho GIMP hoặc Inkscape, và **SCSS variables**, cả hai đều ở sRGB.

![Bảng Swatches - năm nút tải bảng màu ở trên cùng, rồi từng màu thương hiệu dưới dạng chip để mở chi tiết](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

::: details Chọn nhiều màu hoặc mở chi tiết một màu
Chọn màu bằng chấm trên mỗi thẻ: giữ Shift và nhấp chấm thứ hai để chọn mọi màu ở giữa, kéo một khung qua các khoảng trống hoặc nhấn Cmd/Ctrl+A khi một thẻ đang có tiêu điểm. Thanh thao tác có **Download as…** với cùng sáu định dạng, **Copy hex** và **Favourite**. Trước khi bạn chọn định dạng, menu liệt kê màu mà không định dạng nào chứa được (Transparent không có màu), định dạng lưu màu dải rộng bằng màu sRGB dự phòng (SCSS và GIMP) và định dạng chứa giá trị CMYK cùng màu pha (JSON và .ase). Nhấp chuột phải vào thẻ để dùng cùng các thao tác cho một màu.

Chi tiết của một màu phủ màu đó lên bản xem trước và mở các phần **Linked values** (công thức CMYK hoặc mực màu pha, giá trị được tạo cho một không gian màu hay máy in cụ thể và token thiết kế của màu), **Every notation** (hex, OKLCH, Display-P3 và các cách biểu diễn khác, mỗi cách có nút sao chép), **Plotted on a colour space**, **Tones** và **Readability**. Các phím mũi tên di chuyển qua bảng màu, **Copy link** chia sẻ màu và **Open in Colour Lab** mở màu để tiếp tục xử lý.
:::

Bảng **Fonts** liệt kê các phông chữ thương hiệu của bạn, mỗi phông có **download** để cài trên máy hoặc gửi cho nhà in.

<!--i:eti-grid-->
## Tùy chỉnh lưới theo ý bạn

- <!--i:star--> **Đánh dấu yêu thích những gì bạn dùng.** Nhấp chuột phải vào thẻ và chọn **Add to favourites**. Công cụ có một ô lớn trong dải phía trên lưới. [Mục yêu thích của bạn](/info/favourites.html) trình bày về dải này.
- <!--i:eyeoff--> **Ẩn công cụ bạn không bao giờ dùng.** Nhấp chuột phải vào một thẻ, hoặc chọn nhiều thẻ, rồi chọn **Hide tool**. Công cụ biến mất khỏi lưới và kết quả khi bạn gõ trong lưới. Công cụ rời khỏi lưới và không còn khớp khi bạn gõ trong lưới. Ô **Show hidden tools (N)** màu xám ở cuối hiện lại các công cụ đã ẩn dưới dạng mờ, mỗi công cụ có **Unhide tool** trong menu. Việc ẩn chỉ thay đổi lưới của bạn: công cụ vẫn mở được từ liên kết hoặc dấu trang.
- <!--i:clock--> **Công cụ của bạn lên đầu.** Khi bạn đã lưu công việc trong ba công cụ khác nhau, hàng chip **Yours** phía trên lưới sẽ đưa công cụ yêu thích và dùng gần đây lên trước.
- <!--i:sliders--> **Bố trí theo ý bạn.** **View options** đặt bố cục (**Grid**, **Card** hoặc **List**), kích thước và mật độ thẻ, thứ tự sắp xếp và bộ lọc danh mục.

![Cuối lưới Tools khi các công cụ ẩn được hiện: thẻ Wordmark bị làm mờ, cạnh đó là ô màu xám vừa bật nó lên và giờ ghi Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed the tile. The alt says so rather than quoting the resting
label the prose above already gives.
The recipe hides nothing itself. The lolly-demo catalog the captures pin
ships Wordmark hidden (`defaultHiddenTools` in its assets index.json), so a
fresh profile already has one hidden tool and the recipe only clicks the grey
reveal tile (`.gtile--hiddenbox`, confirmed in gallery.ts). It used to tick
the QR Code card and press the bulk bar's Hide button first; under lolly-demo
that published Wordmark dimmed and QR Code not, under a caption naming QR
Code, so the steps were dropped rather than relied on. QR Code was hidden
in that run too: the End scroll had left the pointer over its card, and a
hovered hidden card lifts its dimming (gallery.css), so it read as a normal
tool. The closing `hover:` puts the pointer back on the reveal tile, which
keeps every revealed card dimmed.
-->

**Thao tác trên nhiều thẻ cùng lúc.** Đánh dấu ô chọn của mỗi thẻ, kéo khung chọn qua vùng trống hoặc giữ Shift/Cmd và nhấp, một thanh sẽ hiện ra với các thao tác mà chế độ xem đó cho phép:

- **Tools và Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects, chỉ hiện các phiên được tạo bằng những công cụ đó) và Copy link cho một thẻ.
- **Assets:** Favourite và Hide cho mọi vùng chọn. Duplicate, Download và Delete chỉ xuất hiện khi mọi mục được chọn đều do bạn tải lên, vì tài nguyên của hệ thống thiết kế dùng chung là một cam kết lâu dài.
- **Projects:** xem [Tìm và khôi phục công việc của bạn](/info/find-your-work.html#find-something-you-saved).

![Thanh chọn của gallery cho hai công cụ, có Available offline, View sessions, Favourite và Hide](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
<!--
SHOT NOTE (misc-bulkbar-gallery): drive targets `[data-select="qr-code"]` /
`[data-select="gradient"]` - the `.tile-check[data-select="<ref>"]` checkbox button
confirmed directly in views/gallery.ts's card markup (the same attribute
cardMarkup gives every tile), so these two clicks tick both cards without
opening either tool.

SHOT NOTE (misc-sessions-by-tool, NOT PUBLISHED): the "View sessions" result
had a recipe of its own (`/#/p?tools=qr-code,d3`, views/projects.ts's
toolsBodyHtml()), dropped here because it has no `drive=` that can
manufacture its own content - a saved session isn't a click away, it has to
already exist, and build-docs-shots.ts gives every shot a fresh
`browser.newContext()`. It would publish an empty list. Same dependency the
`projects` shot (now on find-your-work.md) carries; revisit if the pipeline gains a
storage-seeding hook.
-->

**View sessions** chỉ xuất hiện khi có mục được chọn. Nhấp chuột phải vào một thẻ chưa được chọn để mở **N saved sessions**: danh sách các phiên đã lưu của công cụ đó, trong đó thao tác xóa chuyển phiên vào Trash.

<!--i:eti-layers-->
## Trên điện thoại

Trên màn hình hẹp, bố cục chuyển thành một cột:

- **Các điều khiển trở thành một bảng** ở trên cùng, có tay nắm kéo ở mép dưới. Kéo tay nắm để chuyển đến mức **peek**, **half** hoặc **full**, hoặc chạm để gấp và mở rộng. Bản xem trước lấp đầy khoảng trống bên dưới và luôn trong tầm nhìn khi bạn chỉnh sửa.
- Nút **Export** nổi mở bảng xuất: định dạng, kích thước, sao chép, lưu và tải xuống. Chạm vào vùng nền để đóng bảng.

![Công cụ trên màn hình rộng bằng điện thoại - các điều khiển thành bảng ở trên, bảng màu được tạo lấp đầy bản xem trước bên dưới và viên thuốc kết xuất nổi ở giữa phía dưới](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

<!--i:eti-copy-->
## Thiết bị gập và iPhone Duo

Trên thiết bị gập, iPhone Duo hoặc màn hình cảm ứng gần vuông, Lolly bố trí công cụ thành hai ngăn:

- **Điều khiển ở một bên, canvas ở bên kia.** Các điều khiển nằm cách xa tay bạn dùng để vẽ. Chọn **Dominant hand** trong **Settings → Accessibility**, hoặc nhấn **Swap sides** ở đầu các điều khiển. Với ngôn ngữ từ phải sang trái, hai bên được đảo lại.
- **Đường phân chia là bản lề.** Khi thiết bị báo vị trí nếp gập, các ngăn gặp nhau tại đó để không có điều khiển hay tác phẩm nào nằm trên nếp gập. Trên màn hình liền, kéo đường phân chia đến một phần ba, một nửa hoặc hai phần ba chiều rộng. Lolly nhớ lựa chọn của bạn cho từng chế độ xem trên thiết bị này.
- **Đặt trên bàn.** Khi thiết bị mở một nửa và nếp gập nằm ngang màn hình, canvas chiếm nửa trên còn điều khiển nằm dưới nếp gập. Khi trình chiếu, trang chiếu ở trên, còn ghi chú, trang chiếu tiếp theo cùng **Back** và **Next** ở dưới. Trong Sequence, bản xem trước ở trên và dòng thời gian ở dưới.
- **Lolly Design, Design System Setup và Assets.** Trong Lolly Design, Inspector, các lớp và bảng xuất là những thẻ bên cạnh canvas. Các công cụ nằm dọc mép ngoài canvas, dưới tay bạn dùng để vẽ. Khi không đủ chỗ cho công cụ, cột có thể cuộn và một vùng mờ kèm mũi tên chỉ hướng có phần còn lại. Khi đặt trên bàn, các công cụ nằm dọc chân canvas. Lolly Design System Setup giữ Board ở một bên và phòng bạn mở ở bên kia. Trong Assets, chi tiết tài nguyên mở cạnh thư viện, nên lần chạm tiếp theo hiện tài nguyên tiếp theo ở cùng chỗ.
- **Không có gì trên nếp gập.** Khi có vị trí nếp gập được báo, hộp thoại mở trên trang chứa điều khiển. Ô tìm kiếm ở chân màn hình chính và kết quả cũng vậy. Màn hình phẳng giữ chúng ở giữa.
- **Gập không làm mất gì.** Gập, mở hoặc xoay thiết bị giữ nguyên tài liệu, vùng chọn, mức thu phóng và ô bạn đang gõ, với con trỏ ở nguyên vị trí.

Màn hình ngoài của thiết bị gập giữ bố cục điện thoại ở trên, cũng như cửa sổ Lolly nằm trong một nửa màn hình chia đôi.

<!--i:eti-smile-->
## Cài đặt, âm thanh và sự thoải mái

**Settings**, ở chân màn hình chính, chứa thông tin của bạn, hệ thống thiết kế, khả năng tiếp cận, bộ nhớ và nội dung tải xuống ngoại tuyến. [Cài đặt Lolly](/info/dashboard.html) mô tả từng thẻ.

- **Thông tin và ảnh chân dung của bạn** điền vào mọi công cụ được xây dựng để dùng chúng, chẳng hạn chữ ký email hoặc huy hiệu. [Hồ sơ](/info/profile.html) trình bày về những thông tin này.
- **Accessibility** có bốn công tắc giúp dùng thoải mái hơn: **Reduce motion**, **Hide colourful previews**, **High contrast** và **Large text**. Chúng thay đổi ứng dụng xung quanh công việc của bạn, không bao giờ thay đổi canvas của công cụ hay bản xuất. Bên cạnh đó, **Dominant hand** chọn bên đặt điều khiển khi có hai ngăn.
- **Sound** phát âm thanh hỗ trợ nhẹ nhàng cho các thao tác của bạn, và **Neurospicy Mode** phát một bản nhạc êm dịu để tập trung. Cả hai đều tắt cho đến khi bạn bật trong **Settings → Accessibility** hoặc menu hồ sơ. Thanh trượt **Sound shape** dưới công tắc Sound chuyển âm thanh từ tiếng giọt nước tròn, mềm (Bouba) sang tiếng tích và sột soạt khô (Kiki), với tiếng chuông Lolly ở giữa. Các bản nhạc của Neurospicy bao gồm những đài nhạc được Lolly tạo ra: **Lolly Sings** và các thể loại của nó, cùng ba **Lofi stations**. Các đài tạo nhạc liên tục khi phát. Mỗi đài có điều khiển trống và chất âm (cùng tâm trạng trên Lofi), liên kết để chia sẻ giai điệu bạn đang nghe và nút lưu giai điệu vào tài nguyên của bạn. [Nhạc được tạo](/info/generated-music.html) giải thích cách tạo giai điệu. **Music generator** trong Utilities (`#/music`) cho phép bạn định hình một giai điệu.
- **Available offline** tải xuống phần còn lại của ứng dụng, công cụ, danh mục và hướng dẫn trước khi bạn mất kết nối. Để cài Lolly thành ứng dụng web, dùng nút cài đặt của trình duyệt hoặc *Add to Home Screen* trên điện thoại. Ứng dụng đã cài chạy toàn màn hình và tự cập nhật khi bạn có mạng trở lại.
- **Performance UI**, trong **Settings → Feature flags**, cho ứng dụng một giao diện đơn giản hơn, ít tốn tài nguyên để vẽ hơn. Canvas của công cụ và bản xuất giữ nguyên. Trên thiết bị chậm, Lolly tự bật giao diện này và giải thích lý do, với **Undo** và **Keep** ([Performance UI](/info/configuration.html#curating-what-people-see)).
- **Storage** cho biết những gì Lolly giữ trên thiết bị này. [Nếu bạn xóa dữ liệu trình duyệt](/info/find-your-work.html#if-you-clear-your-browser-data) giải thích thao tác xóa sẽ loại bỏ gì, còn [Chính sách quyền riêng tư](/info/privacy.html) liệt kê mọi thứ ứng dụng tải về hoặc gửi đi.

::: note Nếu một chế độ xem không tải được sau khi cập nhật
Bảng trống hoặc thông báo "không thể tải về" ngay sau khi cập nhật thường hết sau một lần tải lại. Công việc đã lưu, các phiên và hệ thống thiết kế của bạn không bị ảnh hưởng vì chúng được lưu trên thiết bị. Chỉ ảnh bạn đã thêm mà chưa từng lưu mới có thể cần thêm lại.
:::

<!--i:eti-map-pin-->
## Tiếp theo nên xem gì

- **[Lolly Design: canvas tự do](/info/design.html)**: canvas, hình khối, dòng thời gian và trình chiếu một bộ trang.
- **[Xử lý hàng loạt và Lolly Multi-edit](/info/batch.html)**: nhiều phiên bản của một thiết kế, hoặc chỉnh sửa nhiều thiết kế đã lưu cùng lúc.
- **[Xuất một tệp](/info/exporting.html)**: chọn định dạng, kích thước, đơn vị in, độ trong suốt và video.
- **[Nhập một thiết kế](/info/design-import.html)**: đưa tệp Figma, Penpot, Illustrator, InDesign, Affinity hoặc DXF vào Lolly Design và tiếp tục chỉnh sửa.
- **[Mẫu](/info/templates.html)**: điểm khởi đầu đã lưu cho công cụ.
- **[Màu dải rộng và HDR](/info/hdr-editing.html)**: giữ độ chính xác của ảnh gốc trong Lolly Design và Lolly Darkroom.
- **[Tìm và khôi phục công việc của bạn](/info/find-your-work.html)**: mọi thứ ở đâu và cách chuyển sang thiết bị khác.
