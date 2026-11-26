# Lolly Batch và Lolly Multi-edit

<a id="batch-and-multi-edit"></a>

**Lolly Batch** tạo nhiều phiên bản của một thiết kế, như một tấm thẻ bằng mười hai ngôn ngữ hoặc mọi kích thước của một biểu ngữ. **Lolly Multi-edit** thực hiện một thay đổi, như ngày hoặc tiêu đề mới, trên nhiều thiết kế đã lưu khác nhau.

Cả hai chạy trên thiết bị của bạn và xuất qua cùng đường kết xuất như các công cụ.

::: cols
## Batch

- Một mẫu, nhiều hàng. Mỗi hàng là một bộ đầu vào và tạo một tệp.
- Điền các hàng bằng cách gõ, dán từ bảng tính hoặc nhập CSV.
- Không giới hạn số hàng; mỗi trang hiển thị 50 hàng.
- Mở từ **Lolly Batch** trong phần đầu của Projects (`#/batch`).

<a id="multi-edit"></a>
## Lolly Multi-edit

- Từ hai đến tám thiết kế đã lưu khác nhau, đặt cạnh nhau dưới dạng thẻ trực tiếp.
- Một thanh bên chỉnh sửa các đầu vào dùng chung, rồi đến đầu vào riêng của từng thẻ.
- Mỗi thiết kế được lưu lại vào chỗ cũ.
- Mở từ **Edit together** trên thanh vùng chọn của Projects.
:::

<!--i:eti-table-->
## Tạo nhiều phiên bản của một thiết kế

Mở chế độ xem **Projects** và nhấn **Batch** ở phần đầu. Lưới bắt đầu với một hàng. Chọn mẫu trong hàng đó, rồi nhân đôi hàng hoặc dán dữ liệu từ bảng tính. Khi mở từ trong một thư mục, Batch đưa bạn trở lại thư mục đó.

![Batch trên một lưới mới: tên tệp và công cụ hàng ở phía trên, và danh sách mẫu của hàng đầu tiên đang mở với các công cụ bạn có thể chọn](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Điền các hàng.** Gõ vào một ô hoặc dán một khối từ Excel, Google Sheets hay bảng tính khác. **Import CSV** thêm hàng hoặc thay thế lô. Khi bạn dán vào ô chứa cài đặt xuất, Lolly hỏi mỗi cột được dán sẽ điền vào đầu vào nào. **Export CSV** ghi lưới ra tệp. Mở **Columns** bên dưới lưới để hiển thị thêm đầu vào, hoặc chiều rộng, chiều cao, đơn vị và DPI cho từng hàng. Popover **Fill** của cột số, văn bản hoặc lựa chọn cũng có phần **Design token** để liên kết một token trên các hàng của cột ([Liên kết nhiều tài liệu cùng lúc](/info/token-workflows.html#link-many-documents-at-once)).

**Đặt đầu ra.** Thanh công cụ đặt tên tệp zip, **Default format**, đơn vị và DPI cho mọi hàng. Menu định dạng là danh sách phân nhóm của bảng xuất, gồm các định dạng mà danh mục cung cấp và trình duyệt của bạn hỗ trợ. Hàng có định dạng, kích thước hoặc tên tệp riêng giữ cài đặt riêng của nó.

**Kết xuất.** **Render all** xuất mọi hàng vào một tệp `.zip`. Khi có các hàng được chọn, **Render selected**, **Export selected CSV** và **Print selected rows** chỉ thao tác trên những hàng đó. Bỏ chọn để làm việc với toàn bộ lô lần nữa. **Print sheet** sắp xếp các hàng lên một tờ có thể in. **Batch activity** báo cáo mỗi lần nhập và kết xuất, và có thể gập lại.

**Giữ lại lô.** **Sessions** lưu mọi hàng của lưới thành một phiên xử lý hàng loạt có tên, bất kể đang chọn gì. Phiên mở lại từ Projects. **Folders…** trong cùng menu mở một thư mục Projects thành các hàng, mỗi hàng là một phiên đã lưu; mỗi tên tệp mang theo đường dẫn thư mục của nó.

::: details Chọn hàng và ô
Chọn hàng bằng hộp kiểm của chúng, hoặc giữ Shift rồi nhấp hộp kiểm để chọn một dải. Hộp kiểm ở hàng tiêu đề chọn trang hiện tại, và **Select all *N* rows** chọn cả các hàng trên những trang khác. Vùng chọn giữ nguyên khi bạn chuyển trang. **Edit input**, **Duplicate** và **Remove** thao tác trên các hàng được chọn, và **Undo remove** khôi phục các hàng vừa xóa gần nhất. Từ ô đang có tiêu điểm, Shift+Space chọn hàng đó và Escape bỏ chọn.

Kéo qua các ô, giữ Shift rồi nhấp một ô hoặc dùng Shift+phím mũi tên để chọn một hình chữ nhật. **Copy cells**, hoặc Ctrl+C / Command+C, sao chép các giá trị để dùng trong bảng tính. Ctrl+A / Command+A từ ô đang có tiêu điểm chọn mọi cột hiển thị trên mọi trang; từ hộp kiểm của hàng, cùng phím tắt đó chọn mọi hàng. Việc chọn ô vẫn giữ các hàng đã đánh dấu. Nhấp đúp vào một ô hoặc nhấn Enter để sửa văn bản của nó. Dán một hình chữ nhật từ clipboard, hoặc dán một giá trị để điền vào mọi ô được chọn; ô trống và văn bản nhiều dòng giữ nguyên vị trí.
:::

### Colourway và chủ đề cho từng hàng

Mỗi hàng giữ các lựa chọn chủ đề riêng: sáng hoặc tối, và colourway khi hệ thống thiết kế có chúng. Hàng mở từ Projects, thư mục hoặc lô đã lưu được kết xuất và xem trước theo các lựa chọn đã lưu cùng phiên của nó. Tờ in, hàng được nhân đôi và hàng được điền đều giữ các lựa chọn đó.

CSV mang các lựa chọn trong cột `_themes` sau các cột kích thước. Cột này có cùng JSON như tham số liên kết `_themes`, ví dụ `{"":"dark","colourway":"beach"}`. Ô trống, hoặc `{}`, có nghĩa là các giá trị mặc định của hệ thống thiết kế. Cột chỉ được ghi khi có hàng chứa lựa chọn. Khi nhập, ô không chứa các lựa chọn chủ đề hợp lệ được liệt kê là có vấn đề và hàng của nó được kết xuất theo mặc định.

::: note Đặt lựa chọn của hàng trong CSV
Lưới chưa có điều khiển để đổi lựa chọn của hàng, nên hãy đặt chúng trong CSV hoặc trong phiên đã lưu.
:::

### Một ngôn ngữ cho mỗi hàng

Công cụ in câu chữ riêng của nó, như Certificate, có thể nhận cột `language` với mã ngôn ngữ ngắn như `de`, `ja` hoặc `ar`. Mỗi hàng sau đó in câu chữ và ngày bằng ngôn ngữ đó. Các hàng tiếng Ả Rập và tiếng Urdu được bố trí từ phải sang trái. Ô trống dùng ngôn ngữ của ứng dụng. Ngôn ngữ mà Lolly chưa có bản dịch sẽ được in bằng tiếng Anh, kể cả ngày, nên chứng chỉ không bao giờ chỉ được dịch một nửa.

### Batch, hoặc Render folder

Để kết xuất lại các phiên đã lưu, chọn chúng trong Projects và dùng **Render selection**, hoặc **Render folder** cho cả thư mục. [Tìm và khôi phục công việc của bạn](/info/find-your-work.html#find-something-you-saved) trình bày cả hai.

<!--i:eti-layers-->
## Cùng chỉnh sửa nhiều thiết kế đã lưu

Đánh dấu từ hai đến tám phiên đã lưu trong **Projects** và chọn **Edit together** trên thanh vùng chọn. Chúng mở cạnh nhau thành các thẻ trực tiếp tại `#/multi?s=<slot>,<slot>…`. Mỗi thẻ là bản kết xuất thật của phiên và hiển thị những gì sẽ được xuất.

Một thanh bên điều khiển tất cả:

- <!--i:sliders--> **Shared** đứng đầu: mọi đầu vào được hai phiên trở lên khai báo giống nhau (cùng id, kiểu và ràng buộc, quy tắc mà lưới xử lý hàng loạt dùng cho các cột). Thay đổi điều khiển dùng chung sẽ đến mọi phiên khai báo đầu vào đó, trực tiếp trên mỗi thẻ. Hai phiên của cùng công cụ dùng chung mọi thứ; hai công cụ khác nhau chỉ dùng chung các đầu vào chúng có chung. Menu **Input actions** của thẻ Shared liên kết một token thiết kế trong mọi phiên khai báo đầu vào đó.
- <!--i:document--> Dưới thẻ Shared, **mỗi phiên có một thẻ gập** chứa mọi đầu vào riêng của phiên đó, như trong thanh bên của công cụ, với một khối xuất gọn: **Format**, **W** / **H**, **Unit**, **DPI** và **Download**. Download đó lưu phiên trước, rồi kết xuất tệp với cùng tên tệp, định dạng và Content Credentials như khi xuất từ công cụ.
- <!--i:search--> **Filter inputs…** ở phía trên thu hẹp các điều khiển trên mọi thẻ cùng lúc.

Nhấp một thẻ bất kỳ (hoặc nhấn Enter trên thẻ) để mở thẻ của phiên đó trong thanh bên. **Save all** ghi mỗi phiên về ô lưu riêng của nó. **Download all** lưu trước, rồi kết xuất cả bộ vào một tệp zip, như **Render selection** trong Projects, và cung cấp tùy chọn khóa bằng mật khẩu.

Mỗi thẻ vẽ theo các lựa chọn chủ đề của phiên riêng, kể cả công cụ được đặt trong thiết kế. Ứng dụng quanh các thẻ giữ màu riêng của nó. **Save all**, các bản tải xuống, **Batch grid** và **Send to Print Sheet** giữ lựa chọn của từng phiên.

### Giới hạn

- **Tối đa tám.** Mỗi thẻ chạy môi trường thực thi trực tiếp riêng, và tám thẻ vẫn phản hồi nhanh. Liên kết yêu cầu nhiều hơn, hoặc yêu cầu một phiên không còn tồn tại, sẽ báo rõ và không tải dở dang.
- **Liên kết là cục bộ.** Nó chỉ định các ô lưu của riêng bạn và mở lại bộ đó trên thiết bị này. Đây không phải liên kết chia sẻ.
- **Với số lượng lớn hơn,** chọn **Edit as sheet** trong cùng thanh vùng chọn. Nó mở phần được chọn thành các hàng trong lưới xử lý hàng loạt (`#/batch?s=…`), không giới hạn số lượng và không yêu cầu cùng công cụ. Cả hai đều không bao gồm thư mục: mở thư mục trong lưới bằng **Sessions → Folders…**, hoặc kết xuất bằng **Render folder** trong Projects.
- **Tìm kiếm không bao gồm Lolly Multi-edit.** Đây là chế độ xem duy nhất thanh tìm kiếm không bao quát.

<!--i:eti-map-pin-->
## Tiếp theo nên xem gì

- **[Xuất một tệp](/info/exporting.html)**: định dạng, kích thước và cài đặt in mà mỗi hàng có thể dùng.
- **[Mẫu](/info/templates.html)**: những điểm khởi đầu phù hợp cho hàng đầu tiên.
- **[Tìm và khôi phục công việc của bạn](/info/find-your-work.html)**: Projects, thư mục và kết xuất những gì bạn đã lưu.
