# Sử dụng Lolly

Bạn đang mở Lolly và muốn tạo một thứ, giữ nó lại và gửi đi. Trang này đi qua vòng đó: mở một công cụ, đổi những gì nó cho phép đổi, lưu kết quả và chia sẻ dưới dạng liên kết hoặc tệp.

Mọi thứ ở đây chạy trên thiết bị của bạn, không cần tài khoản, và tiếp tục hoạt động ngoại tuyến sau khi công cụ và tài nguyên bạn cần đã được tải. Ứng dụng cần trình duyệt hoặc ứng dụng có WebGPU để khởi động; [Supported environments](/info/supported-environments.html) liệt kê các môi trường đã kiểm thử.

## Làm quen xung quanh

::: figure using-app-map
Màn hình chính: bốn thẻ dọc phía trên và thanh ở chân. Khi một công cụ được mở, các điều khiển của nó hiện bên cạnh bản xem trước trực tiếp.
:::

Bốn thẻ chạy dọc phía trên màn hình chính: **Tools**, **Utilities**, **Assets** và **Projects**. Tools là thứ bạn dùng để tạo, Utilities là bàn làm việc cho các việc như chuyển đổi, kiểm tra hay dọn một tệp, Assets là thư viện của bạn và Projects giữ những gì bạn đã lưu.

Thanh ở chân có **Open**, **Settings**, một ô tìm kiếm, **Verify** và **What?**. Nó hiện trên Tools, Utilities, Assets, Projects, Settings và các hướng dẫn bạn đọc trong ứng dụng, và nhường chỗ khi một công cụ được mở. [Search](/info/search.html) tới được công cụ, công việc đã lưu, tài nguyên và cài đặt của bạn từ ô đó. [Ask Lolly](/info/ask.html) trả lời một câu hỏi gõ vào bằng phần khớp trong các hướng dẫn này.

Nhấp một thẻ để bắt đầu việc mới trong công cụ đó. Công việc đã lưu mở lại từ **Projects**.

![Một thẻ gallery có ví dụ điều hướng và một hành động New](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Mỗi công cụ là một khung chia đôi: **điều khiển** ở một bên và **bản xem trước** trực tiếp ở bên kia. Đổi một điều khiển và bản xem trước theo ngay, và những gì bạn thấy là những gì được xuất.

![Chế độ xem chia đôi của một công cụ - ngăn xếp điều khiển ở bên trái, và biểu đồ cột nhóm trực tiếp mà nó vẽ ở bên phải](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Design** là ngoại lệ. Nó mở ra như một canvas tự do gồm các hộp bạn kéo, đổi kích thước và gõ vào, với thanh trên, dòng thời gian và điều khiển trình chiếu riêng. [Design: the free canvas](/info/design.html) là hướng dẫn của nó.

## Đổi những gì công cụ cho phép đổi

Một công cụ chỉ hiện những đầu vào được định để thay đổi. Tác giả của nó đã cố định màu sắc, bố cục, kiểu chữ và logic, nên mọi thứ bạn tạo đều theo quy tắc của họ. Đầu vào gồm văn bản, thanh trượt, bộ chọn màu, danh sách thả xuống, ngày, bộ chọn ảnh và nhóm hàng lặp, và một số nằm trong các phần gập được.

![Ngăn điều khiển của một công cụ - một ô văn bản, các nút mở bảng màu và một thanh trượt, không còn gì khác vì tác giả đã chọn khoá phần còn lại](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Nhấp vào thiết kế để tìm điều khiển của nó.** Nhấp vào bất kỳ phần tử nào trong bản xem trước và điều khiển tương ứng được lấy tiêu điểm và cuộn vào tầm nhìn. Trong một nhóm hàng lặp, đúng hàng bạn nhấp sẽ mở ra.

**Clear changes**, phía trên các điều khiển, đưa mọi đầu vào về mặc định.

**Lựa chọn của hệ thống thiết kế.** Khi hệ thống thiết kế của bạn có nhiều hơn một colourway, một giao diện sáng và tối hoặc lựa chọn chủ đề khác, một phần **Design system** dưới các điều khiển chứa chúng. Một lựa chọn chỉ xuất hiện khi nó đổi công cụ này, nên một tiện ích tệp không hiện phần nào. Mỗi colourway là một chấm với màu của nó, sáng và tối là hai nút và mọi lựa chọn khác là một danh sách.

Lựa chọn thuộc về tác phẩm này. Nó đi cùng trong liên kết và phiên đã lưu, mọi màu liên kết với hệ thống thiết kế đều theo nó và màu của chính ứng dụng giữ nguyên. Design hiện cùng các lựa chọn trong thẻ **Canvas** của Inspector. Một công cụ mà màu sắc là nội dung của nó có thể ở lại colourway chuẩn, và khi đó không có chấm colourway. [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) cho thấy colourway trên công việc thật.

### Thu phóng và kéo bản xem trước

Bản xem trước luôn hiển thị chính xác thứ sẽ được xuất ra.

- **Thu phóng:** Cmd/Ctrl-cuộn hoặc chụm trên bàn di chuột, lấy con trỏ làm tâm. Trên bàn phím, `0` hoặc `Shift+1` vừa khung toàn bộ nội dung, `1` hoặc `Shift+0` đặt mức 100% và `Shift+2` vừa khung phần chọn. `+` / `−` thu phóng quanh con trỏ khi con trỏ ở trên vùng làm việc, hoặc quanh tâm khung nhìn trong trường hợp khác.
- **Kéo:** giữ **Space** và kéo, hoặc kéo bằng nút giữa chuột. Nhấp thường vẫn dành để nhấp vào các phần của thiết kế.
- **Cảm ứng:** chụm để thu phóng, kéo để di chuyển và chạm đúp để vừa khung.
- **HUD thu phóng:** nhấn giữ vòng xoáy Lolly ở góc để bung `−`, **Fit** và `+`. Chạm ngắn vào vòng xoáy vẫn mở menu hồ sơ của bạn.

Trong Design, **Fit all** bao gồm các artboard và lớp rời. Bạn có thể thu nhỏ thủ công dưới 20% cho đến khi toàn bộ trang chiếm nửa khung nhìn. Giới hạn dưới là giá trị nhỏ hơn giữa 5% tỷ lệ Fit thông thường và mức thu phóng tuyệt đối 2%.

Đổi kích thước đầu ra luôn đưa khung nhìn về vừa khít gọn gàng.

![HUD thu phóng bung ra từ vòng xoáy ở góc canvas - trừ, Fit, cộng, rồi các công tắc chủ đề và âm thanh và tay nắm để di chuyển nó](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Hoàn tác và làm lại

**Cmd/Ctrl-Z** lùi một bước và **Cmd/Ctrl-Shift-Z** (hoặc **Cmd/Ctrl-Y**) tiến một bước. Cặp này cũng có dạng nút **Undo** và **Redo** phía trên các điều khiển (trong Design chúng nằm ở thanh trên), và mỗi nút mờ đi khi không còn gì để hoàn tác. Một thông báo cho biết mỗi lần hoàn tác đã khôi phục đầu vào nào, với nút **Redo** trong thông báo.

- **Một lần kéo là một bước.** Các thay đổi lặp lại trên một điều khiển trong nửa giây được gộp, nên kéo thanh trượt hết dải chỉ là một lần hoàn tác.
- **100 bước gần nhất được giữ.** Một chỉnh sửa mới sau khi hoàn tác xóa ngăn xếp phía trước.
- **Trong ô văn bản**, Cmd/Ctrl-Z thuộc về ô đó, từng ký tự một. Lolly đảm nhận với thanh trượt, danh sách thả xuống, màu sắc và công tắc.
- **Chọn một tệp** trong ô nhập tệp không phải một bước, vì các byte đó chỉ được giữ trong phiên này.

Trong một [cộng tác](/info/collaborate.html) trực tiếp, lịch sử của bạn vẫn là của bạn: một thay đổi từ thiết bị kia không bao giờ vào ngăn xếp của bạn. Hoàn tác kéo dài đến khi bạn rời công cụ hoặc tải lại. Với những gì cũ hơn, các công cụ lưu khi bạn làm việc giữ các phiên bản trước trong **History**; xem [Go back to an earlier version](/info/find-your-work.html#go-back-to-an-earlier-version).

### Camera trực tiếp

Các hiệu ứng của công cụ **Filter** (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art và Glitch) hiện nút **Go live** khi có camera. Bật nó và hiệu ứng theo webcam của bạn từng khung hình, và một bản xuất chuyển động ghi kết quả thành GIF, WebM hoặc MP4. Khung hình được xử lý trên thiết bị của bạn, và camera được giải phóng ngay khi bạn dừng hoặc rời công cụ. Mọi bộ chọn ảnh cũng có **Take a photo** cho một khung hình đơn.

## Lưu & tiếp tục

Để giữ công việc, nhấn **Save**, dấu tích bên cạnh **Export** trên viên thuốc kết xuất. Công việc mới vào **My library**, công việc đã lưu trước đó được cập nhật tại chỗ và không có gì được tải xuống. Bảng xuất có cùng nút **Save**.

Để chọn nơi lưu, nhấn **Save as**, bên cạnh **Download** trong bảng xuất. Dưới **Save to a project**, để **My library** được chọn hoặc chọn một dự án (**＋ New project…** tạo mới), rồi nhấn **Save**; **Save as a template** giữ thiết kế như một [mẫu](/info/templates.html), điểm khởi đầu cho tài liệu mới. Trong Design, **Save as** nằm ở menu Lolly; trên điện thoại, nhấn **•••**, rồi **File menu**, rồi **Save as**.

![Viên thuốc kết xuất hai nửa: Export, với mũi tên lên mở bảng xuất, và Save, với dấu tích lưu tại chỗ](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Nhấn **Save** trên viên thuốc kết xuất, hoặc **Save as** để chọn dự án.
- <!--i:folder--> Mục đó vào **My library**, hoặc vào dự án bạn đã chọn.
- <!--i:home--> Sau đó, nhấn **Home** ở góc trên bên trái và mở thẻ **Projects**.
- <!--i:document--> Mở mục đó. Mọi cài đặt trở lại, sẵn sàng để đổi và xuất lại.
:::

Các mục được đặt tên theo tên tệp bạn gõ trong bảng xuất, hoặc theo công cụ của chúng, như **QR Code**. Một tệp bạn có từ **Download** là bản sao hoàn chỉnh; để đổi nó sau này, hãy mở mục đã lưu trong Projects.

Các bản lưu cá nhân ở lại trên thiết bị này, trong trình duyệt hoặc ứng dụng bạn đã lưu, trừ khi bạn bật [Sync](/info/sync.html). Nếu thứ gì không ở chỗ bạn mong đợi, [Find and recover your work](/info/find-your-work.html) đề cập mọi trường hợp, từ thẻ đã đóng đến dữ liệu trình duyệt bị xóa.

::: details Dự án nhóm với Lolly Work (tùy chọn)
Nếu [tổ chức bạn dùng Lolly Work](/info/organisation.html), hãy đăng nhập phiên bản của nó và mở **Projects → Team projects** để xem các phiên chia sẻ với bạn. Tổ chức đặt quyền truy cập và thời hạn lưu giữ, và dịch vụ Lolly Work của họ lưu các phiên đó. Một phiên chung tham gia work collab trực tiếp của nó khi mở nếu tổ chức cho phép chỉnh sửa trực tiếp; [Working together](/info/collaborate.html#work-collabs-with-lolly-work-optional) giải thích các bước.

Thư viện cá nhân của bạn vẫn tách biệt. Đăng nhập trên thiết bị khác cho bạn công việc nhóm, còn các bản lưu cá nhân vẫn cần Sync hoặc bản sao lưu để chuyển sang.
:::

## Chia sẻ công việc của bạn

Một thiết kế ra đi dưới dạng liên kết hoặc tệp. **Share** trong các điều khiển xuất mở một hộp thoại đưa ra cả hai, và **Share link** trên một phiên đã lưu trong Projects mở cùng hộp thoại đó cho phiên ấy.

::: cols
## Một liên kết

- Mang mọi đầu vào trong địa chỉ, nên liên kết tái tạo được thiết kế.
- Bỏ lại ảnh và tệp bạn thêm từ thiết bị này, văn bản rất dài và danh sách rất lớn.
- Mở trong bất kỳ trình duyệt nào, nên bạn có thể đánh dấu, dán hoặc commit liên kết.

## Một tệp .lolly

- Mang phiên đã lưu cùng ảnh và tệp trên thiết bị này, và có thể mang cả công cụ lẫn hệ thống thiết kế.
- Giữ lại tác phẩm danh mục có giấy phép trừ khi bạn chọn đưa tệp vào.
- Mở trong Lolly: nhấp đúp, dùng **Open** hoặc thả lên ứng dụng.
:::

### Liên kết

Liên kết sẵn sàng sao chép nằm ở đầu hộp thoại, với **Copy** và nút **QR** mở công cụ QR Code trên liên kết. Dưới liên kết, **Link options** gồm:

- **Open in the installed app** chuyển liên kết sang địa chỉ `lolly://` cho Shortcuts, trình khởi chạy và tự động hóa, mọi tham số giữ nguyên.
- **Shortest link** nén một thiết kế dài thành token gọn và hiện số ký tự tiết kiệm được. Dạng đọc được luôn có sẵn.
- **Password-protect this link** mã hóa liên kết trên thiết bị của bạn bằng AES-256. Mật khẩu không bao giờ là một phần của liên kết.
- **Pin this tool version** thêm cờ `_v`, để bản cập nhật công cụ sau này không thể đổi những gì liên kết kết xuất.
- **When the recipient opens the link…** chọn toàn màn hình, bảng xuất đã mở rộng sẵn, tải xuống khi mở (`&export`) hoặc sao chép vào clipboard (`&copy`).
- **Copy credit** sao chép dòng chú thích "Made with Lolly" cùng liên kết, cho một bài đăng hoặc một trang chiếu.

Khi một công cụ chứa các trường cá nhân, như tên của bạn, **Review personal fields** giữ từng trường ngoài liên kết cho đến khi bạn đánh dấu trường đó. [URL mode](/info/url-mode.html) đề cập mọi thứ một liên kết có thể mang.

**Hộp thoại cho biết một liên kết không mang được gì.** Ảnh hoặc tệp bạn thêm từ thiết bị này, một giá trị văn bản rất dài và một danh sách rất lớn không vừa trong địa chỉ. Mỗi thứ được đếm khi liên kết được dựng. Nếu có gì phải bỏ, hộp thoại liệt kê và chỉ bạn sang tùy chọn tệp, thay vì đưa bạn một liên kết mở ra thiếu ảnh. Một liên kết chỉ dài sẽ nhận ghi chú nhẹ hơn kèm số ký tự.

**Một số công cụ biến liên kết thành toàn bộ sản phẩm.** Jump Page gom các liên kết của bạn vào một trang để phát: liên kết tiểu sử, một buổi nói chuyện, một cửa hàng. Không có gì được lưu trữ và không tài khoản nào đứng sau trang, vì trang chính là liên kết. Người truy cập thấy nó toàn chiều rộng, mỗi cảnh một liên kết khi cuộn.

![Jump Page trong trình chỉnh sửa: cảnh tiêu đề ở đầu trang, với các cảnh liên kết bên dưới](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Liên kết do tổ chức quản lý với Lolly Work
Với việc chia sẻ cần hạn dùng, thu hồi hoặc mật khẩu, Lolly Work cung cấp liên kết được quản lý tới phiên chung, công cụ và tài nguyên danh mục. Chúng được phân giải qua dịch vụ của tổ chức và theo quy tắc truy cập của nó. Chúng tách biệt với các liên kết tự chứa ở trên, và thu hồi một liên kết không thể thu lại tệp mà ai đó đã tải. [Rendering and sharing](/info/manage/sharing.html) liệt kê các loại liên kết và quyền.
:::

### File .lolly

**Download .lolly**, trong phần **Editable file** của hộp thoại Share, ghi thiết kế hiện tại thành một tệp. Nó mang phiên đã lưu cùng ảnh và tệp trên thiết bị này, và tác phẩm danh mục thông thường cũng đi cùng. Một tệp cũ hoặc không còn sẵn vẫn là tham chiếu bên ngoài thay vì biến mất. Trước khi lưu, hộp thoại hiện kích thước tệp, số tệp nó nhúng, số tệp nó tham chiếu và công cụ có được đưa vào không. Nơi thiết bị có bảng chia sẻ, **Send to…** đưa tệp thẳng vào đó (AirDrop, chia sẻ Android).

**Download project (.lolly)**, trong menu của một thư mục ở **Projects**, ghi cả thư mục, để người khác tiếp tục với mọi phiên trong thư mục. Các phiên Batch ở lại, và thông báo cho biết bao nhiêu. **Download originals**, trong cùng menu, ghi một zip thường chứa từng mục dưới dạng tệp riêng.

Ba điều do bạn quyết định trước khi một tệp ra đi:

- **Tên của bạn có vào không.** Tên, email và tổ chức của bạn chỉ được ghi khi **Use my details to create** bật trong [hồ sơ của bạn](/info/profile.html). Khi tắt, tệp chỉ ghi rằng nó được tạo bằng Lolly, và vào lúc nào.
- **Tác phẩm bị giữ lại có vào không.** Tác phẩm có giấy phép, tác phẩm khóa theo thương hiệu và tác phẩm danh mục mà giấy phép chưa bao giờ được ghi lại mặc định ở ngoài. Nếu thiết kế dùng bất kỳ thứ nào, hộp thoại cho biết bao nhiêu và đưa ra *Download without them* hoặc *Include and download*, vì đưa vào nghĩa là trao các tệp cho bất kỳ ai mở `.lolly`. Tệp `CREDITS.txt` của nó liệt kê những gì đã đi và không đi, kèm lý do; [Creative rights and credits](/info/creative-rights.html) giải thích các quy tắc.
- **Công cụ có vào không.** **Include the tool** đóng gói các tệp của chính công cụ, để thiết kế mở được trên thiết bị không có công cụ đó. Mặc định được đánh dấu với công cụ tùy chỉnh, như một bản fork, và không đánh dấu với công cụ nằm trong danh mục đã ký. Trên bản dựng không có danh mục đã ký, mọi công cụ đều tính là tùy chỉnh.

**Mở một tệp.** Trong ứng dụng máy tính và di động, nhấp đúp hoặc chạm một `.lolly`, chọn **Open with Lolly** hoặc gửi nó tới Lolly từ bảng chia sẻ. Trong ứng dụng web, nhấn **Open** hoặc thả tệp lên Lolly. Mọi lộ trình đều đọc manifest của tệp trước và hiện kích thước, nội dung và điều sẽ xảy ra, trước khi bất cứ gì được ghi.

Nếu tệp mang một công cụ bạn không có, **Trust this tool?** hiện công cụ và tác giả của nó, và nói rằng mở nó sẽ chạy mã của chính công cụ trên thiết bị của bạn. **Trust & install** tiếp tục. Từ chối thì công việc vẫn được lưu vào Projects, chờ ngày bạn thêm công cụ. Một công cụ có mã đi kèm dưới dạng module chưa thể cài theo cách này, và bị từ chối theo cùng cách.

::: details Một tệp .lolly chứa gì, và việc mở nó hoạt động ra sao
`.lolly` là phần mở rộng gói của Lolly, và `format` trong `manifest.json` của nó cho biết bên trong có gì:

- Một **thiết kế chung** (`lolly-share`) chứa một phiên đã lưu, các tệp nhúng của nó và một biên nhận cho mọi thứ vẫn được phân giải bằng tham chiếu. Nó cũng có thể mang công cụ và hệ thống thiết kế. Mở nó thêm một Project mới và không bao giờ ghi đè một phiên.
- Một **dự án chung** (`lolly-share`, kind `project`) chứa một thư mục từ Projects: các thư mục con của nó, mọi phiên trong đó cùng ô hình của chúng và các ảnh được lưu ở đó. Mở nó thêm một bản sao của cả thư mục. Mỗi phiên đi dưới dạng `sessions/<key>.json` với ô hình của nó trong `thumbs/`. Lolly từ trước khi có tệp dự án sẽ yêu cầu bạn cập nhật.
- Một **gói hệ thống thiết kế** (`lolly-brand`) chứa token và có thể chứa phông chữ, logo, các phiên bản đã phát hành và tài nguyên được giữ lại. Mở gói thêm một hệ thống thiết kế có tên riêng và đặt hệ thống đó làm hệ thống đang dùng.
- Một **gói không gian làm việc hoặc phiên bản** là một `lolly-brand` với các công cụ đã khai báo, tài nguyên danh mục và có thể một địa chỉ phiên bản. Nạp một gói thay thế lớp phủ không gian làm việc duy nhất đã nạp trước đó, và bản xem trước liệt kê các hiệu ứng trên toàn thiết bị đó.

Một bản sao lưu toàn thiết bị không phải `.lolly`. Nó vẫn là `LollyTools-….zip` (định dạng `lolly-backup`) và được khôi phục qua **Settings → Storage → Import data…**. Một thư mục công cụ được nén cũng vẫn là `.zip`. [Data transfer](/info/data-transfer.html) là tài liệu tham chiếu định dạng.

Một `.lolly` là một tệp zip bình thường. Đổi tên thành `.zip` để nhìn bên trong: ảnh của riêng bạn nằm dưới `assets/uploads/`, tác phẩm danh mục dưới `assets/catalog/`, `manifest.json` liệt kê mọi tệp, và một README cho biết tệp là gì.

macOS, Windows, Linux, iOS và Android đều đăng ký định dạng này, trình quản lý tệp trên máy tính hiện nó như tài liệu Lolly và GNOME Files có thể hiện hình thu nhỏ riêng của một phiên đã lưu. Mở từ Design System Setup sẽ gợi ý hành động hệ thống thiết kế khi một thiết kế chung mang theo, nhưng không bao giờ ẩn **Open shared design**.

Một tài liệu được chuyển từ ứng dụng khác trên iOS hoặc Android bị giới hạn 48 MB, vì việc bàn giao sao chép các byte của nó qua ranh giới ứng dụng, và ứng dụng nói rõ điều này. **Open** bên trong Lolly không có giới hạn đó, nên hãy dùng nó cho gói lớn hơn.

Sau khi bạn xác nhận, Lolly giải nén và xác minh gói một lần. Tài nguyên vào thư viện của bạn, được khớp theo checksum để tệp đã có trên thiết bị được dùng lại. Các phiên vào Projects với id mới, nên cùng một tệp có thể mở hai lần; một phiên thiếu công cụ chờ ở đó. Tệp trên 100 MB được nêu là lớn, và bản xem trước cảnh báo khi bộ nhớ trình duyệt báo còn ít chỗ trống hơn tệp cần. Mọi phần được bảo vệ toàn vẹn được kiểm tra trước khi bất cứ gì được ghi, và một bản hỏng bị từ chối mà không để lại gì.
:::

Cả liên kết lẫn tệp đều trao một ảnh chụp tại thời điểm. Để chỉnh sửa trực tiếp, [Working together](/info/collaborate.html) đề cập collab riêng tư giữa hai thiết bị và work collab tùy chọn qua Lolly Work.

## Tài sản - thư viện của bạn

**Assets** (`#/a`) gom mọi thứ mà công cụ của bạn có thể dùng: logo thương hiệu, ảnh, âm thanh và chuyển động, nhóm theo loại, cùng các tệp của riêng bạn. Tệp bạn tải lên được lưu trên thiết bị. Một tổ chức dùng Lolly Work cũng có thể cung cấp danh mục chung theo quy tắc truy cập riêng; xem [Use Lolly at your organisation](/info/organisation.html).

![Tài sản, cùng các mẫu màu và font của thương hiệu và các file bạn tự tải lên](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Đưa tệp của bạn vào.** Thả một ảnh, SVG, clip âm thanh, video, Lottie, PDF hoặc bộ trình chiếu PowerPoint lên vùng tải lên, hoặc nhấp để chọn. Nó xuất hiện ngay trong Assets và trong bộ chọn tài nguyên của mọi công cụ. Một PDF nhiều trang hoặc `.pptx` hỏi giữ trang hay trang chiếu nào, và mỗi cái trở thành một tài nguyên SVG. Ảnh bạn thêm trong một công cụ được giữ nguyên như khi đến trong **My images**, nên Content Credential trên đó vẫn xác minh được, và chỉ một tệp rất lớn mới hỏi có đổi kích thước không. **Settings → Storage** cho biết **My images** chứa bao nhiêu. Không có giới hạn nào ngoài dung lượng thiết bị. Để xóa dữ liệu EXIF và GPS khi ảnh đưa vào, bật **Strip metadata from uploads** dưới **Settings → Feature flags**; Content Credentials được giữ dù theo cách nào.
- <!--i:star--> **Yêu thích những gì bạn hay dùng.** Gắn sao một tài nguyên hoặc ô màu thương hiệu và nó được ghim lên đầu mọi bộ chọn.
- <!--i:folder--> **Dọn dẹp.** Chuyển tài nguyên sang nhóm khác, ẩn tài nguyên thương hiệu chung bạn không dùng (**Show hidden** đưa nó lại) hoặc xóa tệp tải lên của chính bạn. Cùng thanh chọn như Projects tác động lên cả vùng chọn.
- <!--i:layers--> **Tách video khỏi nền.** Mở chi tiết của một video, hoặc nhấp chuột phải vào thẻ của nó trong bộ chọn tài nguyên, và chọn **Remove background…**. Một **On-device model** cắt chủ thể khỏi cảnh rối; một **Colour key** loại bỏ phông nền sáng đều như màn xanh, với **Tolerance**, **Softness** và **Spill removal** cho phần viền, và không cần tải gì. **Resolution** (360, 480, 720 hoặc 1080p, không bao giờ vượt nguồn) đánh đổi chi tiết lấy tốc độ. Phần cắt ra, một WebP hoặc PNG động với độ trong suốt thật, được lưu cạnh bản gốc, và Content Credential của nguồn đi kèm như một thành phần. [Generated once, rendered the same](/info/ai-features.html) giải thích vì sao việc này vẫn chỉ là một chỉnh sửa thường.

### Mang bảng màu và font của bạn đi khắp nơi

Bảng **Swatches** trong Assets hiện các màu tạo nên thương hiệu của bạn: màu thương hiệu, màu bạn thêm, các dải và phổ của nó. Các màu vai trò mà Lolly giữ cho giao diện (văn bản, bề mặt, viền, màu dẫn của colourway và bản sao của màu thương hiệu dưới tên khác) nằm sau thẻ xám **Show colour roles** ở chân bảng.

Mỗi màu là một thẻ như mọi tài nguyên khác. Nhấp một màu để mở chi tiết, chọn vài màu để tải riêng chúng hoặc tải cả bảng màu theo định dạng mà công cụ khác của bạn đọc:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** hoặc **CSS classes**, cho một bảng định kiểu hoặc một bản dựng. Màu rộng hơn sRGB giữ giá trị rộng của nó: CSS đặt nó sau mã hex, còn JSON giữ mã hex cùng màu rộng, bản dựng CMYK và mực spot bên cạnh.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**, cho Illustrator hoặc Photoshop. Màu khóa vào một bản dựng CMYK đến dưới dạng ô màu CMYK đó, mực spot dưới dạng ô spot có tên và màu rộng hơn sRGB dưới dạng Lab.
- <!--i:pentool--> **GIMP palette (.gpl)**, cho GIMP hoặc Inkscape, và **SCSS variables**, cả hai ở sRGB.

![Bảng Swatches - năm nút tải bảng màu ở trên cùng, rồi mọi màu thương hiệu dưới dạng chip mở chi tiết của nó](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Chọn màu bằng chấm trên mỗi thẻ: Shift-nhấp chấm thứ hai để chọn mọi thứ ở giữa, kéo một khung qua các khoảng trống hoặc nhấn Cmd/Ctrl+A khi một thẻ đang có tiêu điểm. Thanh cung cấp **Download as…** theo cùng sáu định dạng, **Copy hex** và **Favourite**. Trước khi bạn chọn định dạng, menu liệt kê mọi màu mà không định dạng nào chứa được (Transparent hoàn toàn không có màu), định dạng nào lưu màu rộng thành màu sRGB dự phòng (SCSS và GIMP) và định dạng nào mang giá trị CMYK và spot (JSON và .ase). Nhấp chuột phải một thẻ để có cùng hành động cho một màu.

Chi tiết của một màu lấp đầy bản xem trước bằng màu đó và mở ra **Linked values** (bản dựng CMYK hoặc mực spot, mọi giá trị được viết cho một không gian hay máy in cụ thể và design token của nó), **Every notation** (hex, OKLCH, Display-P3 và các cách khác, mỗi cách có nút sao chép), **Plotted on a colour space**, **Tones** và **Readability**. Phím mũi tên duyệt qua bảng màu, **Copy link** chia sẻ chính màu đó và **Open in Colour Lab** đưa nó đi xa hơn.

Bảng **Fonts** liệt kê các kiểu chữ thương hiệu của bạn, mỗi kiểu có nút **download**, để cài cục bộ hoặc giao cho nhà in.

## Biến lưới thành của bạn

- <!--i:star--> **Yêu thích những gì bạn dùng.** Nhấp chuột phải một thẻ và chọn **Add to favourites**, và nó có một ô lớn trong dải phía trên lưới. [Your favourites](/info/favourites.html) đề cập dải này.
- <!--i:eyeoff--> **Ẩn công cụ bạn không bao giờ dùng.** Nhấp chuột phải một thẻ, hoặc chọn nhiều thẻ, và chọn **Hide tool**. Nó biến khỏi lưới và khỏi kết quả khi gõ tìm trong lưới. Một ô xám **Show hidden tools (N)** ở cuối hiện chúng lại, mờ đi, mỗi cái có **Unhide tool** trong menu. Việc ẩn chỉ đổi lưới của bạn: công cụ vẫn mở được từ liên kết hoặc dấu trang.
- <!--i:clock--> **Công cụ của bạn lên trước.** Khi bạn đã lưu công việc trong ba công cụ khác nhau, một hàng chip **Yours** phía trên lưới dẫn đầu bằng công cụ yêu thích và gần đây của bạn.
- <!--i:sliders--> **Sắp xếp theo cách của bạn.** **View options** đặt bố cục (**Grid**, **Card** hoặc **List**), kích thước và mật độ thẻ, thứ tự sắp xếp và bộ lọc danh mục.

![Cuối lưới Tools với các công cụ ẩn được hiện ra: thẻ Wordmark bị làm mờ, và bên cạnh là ô xám đã bật nó lại, nay đọc là Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
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

**Tác động lên nhiều thẻ cùng lúc.** Đánh dấu hộp của từng thẻ, kéo một khung chọn qua khoảng trống hoặc Shift/Cmd-nhấp, và một thanh xuất hiện với những gì chế độ xem đó cho phép:

- **Tools và Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects, chỉ hiện các phiên tạo bằng những công cụ đó) và Copy link cho một thẻ đơn.
- **Assets:** Favourite và Hide cho mọi vùng chọn. Duplicate, Download và Delete chỉ xuất hiện khi mọi mục được chọn đều là tệp tải lên của riêng bạn, vì một tài nguyên hệ thống thiết kế dùng chung là một cam kết vĩnh viễn.
- **Projects:** xem [Find and recover your work](/info/find-your-work.html#find-something-you-saved).

![Thanh chọn trên gallery cho hai công cụ, hiển thị Khả dụng ngoại tuyến, Xem các phiên, Yêu thích và Ẩn](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
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

**View sessions** chỉ xuất hiện khi đã chọn thứ gì đó. Thay vào đó, nhấp chuột phải một thẻ đơn chưa chọn và nó đưa ra **N saved sessions**, danh sách các phiên đã lưu của công cụ đó, nơi một lần xóa chuyển phiên vào Thùng rác.

## Trên điện thoại

Trên màn hình hẹp, bố cục thành một cột:

- **Các điều khiển thành một tấm** ở trên cùng với tay kéo ở cạnh dưới. Kéo tay nắm để bám vào **peek**, **half** hoặc **full**, hoặc chạm để thu gọn và mở rộng. Bản xem trước lấp đầy khoảng trống bên dưới và vẫn ở trong tầm nhìn khi bạn chỉnh sửa.
- Một nút **Export** nổi mở bảng xuất: định dạng, kích thước, sao chép, lưu và tải xuống ở một nơi. Chạm vào nền phía sau để đóng bảng.

![Một công cụ trên màn hình rộng bằng điện thoại - điều khiển là một tấm trượt phía trên, bảng màu vừa tạo lấp đầy bản xem trước bên dưới và nút render nổi ở chính giữa phía dưới](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Cài đặt, âm thanh và sự thoải mái

**Settings**, ở chân màn hình chính, chứa thông tin của bạn, các hệ thống thiết kế, trợ năng, lưu trữ và tải xuống ngoại tuyến. [Settings](/info/dashboard.html) vẽ ra từng thẻ.

- **Thông tin và ảnh chân dung của bạn** điền vào mọi công cụ được xây để dùng chúng, như chữ ký email hoặc thẻ tên. [Profiles](/info/profile.html) đề cập chúng.
- **Accessibility** có bốn công tắc thoải mái: **Reduce motion**, **Hide colourful previews**, **High contrast** và **Large text**. Chúng đổi ứng dụng xung quanh công việc của bạn, không bao giờ đổi canvas công cụ hay bản xuất.
- **Sound** phát âm thanh hỗ trợ nhẹ nhàng cho những gì bạn làm, và **Neurospicy Mode** phát một bản nhạc tập trung êm dịu. Cả hai tắt cho đến khi bạn bật, trong **Settings → Accessibility** hoặc menu hồ sơ.
- **Available offline** tải phần còn lại của ứng dụng, các công cụ, danh mục và hướng dẫn trước khi bạn mất kết nối. Lolly là ứng dụng web có thể cài: dùng nút cài của trình duyệt, hoặc *Add to Home Screen* trên điện thoại, để có ứng dụng toàn màn hình tự cập nhật khi bạn trực tuyến trở lại.
- **Storage** cho biết Lolly giữ gì trên thiết bị này. [If you clear your browser data](/info/find-your-work.html#if-you-clear-your-browser-data) giải thích việc xóa gỡ bỏ những gì, và [Privacy Policy](/info/privacy.html) liệt kê mọi thứ ứng dụng tải hoặc gửi.

::: note Nếu một màn hình không tải được sau khi cập nhật
Một bảng trống hoặc thông báo "failed to fetch" ngay sau khi cập nhật thường hết sau một lần tải lại. Công việc đã lưu, các phiên và hệ thống thiết kế của bạn không bị ảnh hưởng, vì chúng được lưu trên thiết bị. Chỉ ảnh bạn thêm mà chưa lưu có thể cần thêm lại.
:::

## Đi tiếp từ đâu

- **[Design: the free canvas](/info/design.html)**: canvas, hình khối, dòng thời gian và trình chiếu một bộ trang.
- **[Batch and Multi-edit](/info/batch.html)**: nhiều phiên bản của một thiết kế, hoặc nhiều thiết kế đã lưu được chỉnh sửa cùng nhau.
- **[Export a file](/info/exporting.html)**: chọn định dạng, kích thước, đơn vị in, độ trong suốt và video.
- **[Import a design](/info/design-import.html)**: đưa tệp Figma, Penpot, Illustrator hoặc InDesign vào Design và tiếp tục chỉnh sửa.
- **[Templates](/info/templates.html)**: điểm khởi đầu đã lưu cho một công cụ.
- **[Wide Colour and HDR](/info/hdr-editing.html)**: giữ độ chính xác ảnh gốc trong Design và Darkroom.
- **[Find and recover your work](/info/find-your-work.html)**: mọi thứ ở đâu, và cách chuyển sang thiết bị khác.
