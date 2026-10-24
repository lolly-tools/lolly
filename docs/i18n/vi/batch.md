# Batch và Multi-edit

Hai việc xuất hiện khi bạn thường xuyên làm cùng loại tệp. Đôi khi bạn cần nhiều phiên bản của một thiết kế: một tấm thẻ bằng hàng chục ngôn ngữ, hoặc mọi kích thước của một biểu ngữ. Đôi khi bạn có nhiều thiết kế đã lưu khác nhau và muốn một thay đổi tới được tất cả, như ngày mới hay tiêu đề mới.

**Batch** làm việc đầu và **Multi-edit** làm việc sau. Cả hai chạy trên thiết bị của bạn và xuất qua cùng đường kết xuất như chính các công cụ.

::: cols
## Batch

- Một mẫu, nhiều hàng. Mỗi hàng là một bộ đầu vào và tạo một tệp.
- Điền các hàng bằng cách gõ, dán từ bảng tính hoặc nhập CSV.
- Không giới hạn số hàng; mỗi trang hiện 50.
- Mở từ **Batch** ở tiêu đề Projects (`#/batch`).

## Multi-edit

- Hai đến tám thiết kế đã lưu khác nhau, cạnh nhau dưới dạng thẻ trực tiếp.
- Một thanh bên chỉnh các đầu vào chúng dùng chung, rồi đến đầu vào riêng của từng thẻ.
- Mỗi thiết kế lưu lại về nơi nó đến.
- Mở từ **Edit together** ở thanh chọn của Projects.
:::

## Tạo nhiều phiên bản của một thiết kế

Mở **Projects** và nhấn **Batch** ở tiêu đề. Lưới bắt đầu với một hàng: chọn một mẫu trong đó, rồi nhân đôi hàng hoặc dán dữ liệu từ bảng tính. Mở từ bên trong một thư mục, Batch đưa bạn về thư mục đó.

![Batch trên lưới mới: tên tệp và các công cụ hàng ở trên cùng, và danh sách mẫu của hàng đầu tiên mở trên các công cụ bạn có thể chọn](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Điền các hàng.** Gõ vào một ô hoặc dán một khối thẳng từ Excel, Google Sheets hay bảng tính khác. **Import CSV** thêm hàng hoặc thay thế batch. Khi bạn dán vào một ô chứa cài đặt xuất, Lolly hỏi mỗi cột dán điền vào đầu vào nào. **Export CSV** ghi lưới ra lại. Mở **Columns** dưới lưới để hiện thêm đầu vào, hoặc chiều rộng, chiều cao, đơn vị và DPI theo từng hàng.

**Đặt đầu ra.** Thanh công cụ đặt tên tệp zip, **Default format**, đơn vị và DPI cho mọi hàng. Menu định dạng là danh sách nhóm của bảng xuất, hiện các định dạng mà danh mục cung cấp và trình duyệt của bạn hỗ trợ. Một hàng có định dạng, kích thước hoặc tên tệp riêng giữ cài đặt riêng của nó.

**Render.** **Render all** xuất mọi hàng vào một `.zip`. Chọn hàng trước và **Render selected**, **Export selected CSV** cùng **Print selected rows** chỉ tác động lên những hàng đó; bỏ chọn để làm việc trên cả batch trở lại. **Print sheet** dàn các hàng lên một tờ in được. **Batch activity** báo cáo từng lần nhập và kết xuất, và gập lại để bảng có thêm chỗ.

**Giữ batch.** **Sessions** lưu cả lưới thành một phiên batch có tên, mở lại sau từ Projects. Sessions luôn lưu mọi hàng, bất kể chọn gì. **Folders…** trong cùng menu mở cả một thư mục Projects thành các hàng, mỗi phiên đã lưu một hàng, với mỗi tên tệp mang đường dẫn thư mục của nó.

::: details Chọn hàng và ô
Chọn hàng bằng hộp kiểm của chúng, hoặc Shift-nhấp một hộp kiểm để chọn dải. Hộp kiểm tiêu đề chọn trang hiện tại, và **Select all *N* rows** lấy cả các hàng ở trang khác. Vùng chọn giữ nguyên khi bạn chuyển trang. **Edit input**, **Duplicate** và **Remove** tác động lên các hàng đã chọn, và **Undo remove** khôi phục các hàng vừa xóa. Từ một ô có tiêu điểm, Shift+Space chọn hàng đó và Escape bỏ chọn.

Kéo qua các ô, Shift-nhấp một ô hoặc dùng Shift+phím mũi tên để chọn một hình chữ nhật. **Copy cells**, hoặc Ctrl+C / Command+C, sao chép các giá trị cho bảng tính. Ctrl+A / Command+A từ một ô có tiêu điểm chọn mọi cột hiển thị trên mọi trang; từ hộp kiểm hàng, cùng phím tắt chọn mọi hàng. Chọn ô giữ nguyên các hàng đã đánh dấu. Nhấp đúp một ô hoặc nhấn Enter để sửa văn bản. Dán một hình chữ nhật từ clipboard, hoặc dán một giá trị để điền mọi ô đã chọn; ô trống và văn bản nhiều dòng giữ nguyên vị trí.
:::

### Colourway và chủ đề theo từng hàng

Mỗi hàng giữ lựa chọn chủ đề riêng: sáng hoặc tối, và một colourway khi hệ thống thiết kế có. Một hàng mở từ Projects, một thư mục hoặc một batch đã lưu được kết xuất theo các lựa chọn mà phiên của nó đã lưu, và bản xem trước mở theo đó. Bản in, hàng được nhân đôi và hàng được điền đều giữ chúng.

CSV mang các lựa chọn trong cột `_themes` sau các cột kích thước, chứa cùng JSON như tham số liên kết `_themes`, ví dụ `{"":"dark","colourway":"beach"}`. Ô trống, hoặc `{}`, nghĩa là mặc định của hệ thống thiết kế. Cột chỉ được ghi khi có hàng nào đó có lựa chọn, nên batch không có lựa chọn nào xuất cùng CSV như trước. Khi nhập, ô không phải lựa chọn chủ đề hợp lệ được liệt kê là một vấn đề và hàng của nó kết xuất theo mặc định. Lưới chưa có điều khiển để đổi lựa chọn của một hàng, nên hãy đặt chúng trong CSV hoặc phiên đã lưu.

### Batch, hoặc Render folder

Batch tạo nhiều biến thể của một mẫu. Để kết xuất lại các phiên bạn đã lưu, chọn chúng trong Projects và dùng **Render selection**, hoặc **Render folder** cho cả thư mục; [Find and recover your work](/info/find-your-work.html#find-something-you-saved) đề cập cả hai.

## Chỉnh sửa nhiều thiết kế đã lưu cùng nhau

Đánh dấu từ hai đến tám phiên đã lưu trong **Projects** và chọn **Edit together** từ thanh chọn. Chúng mở cạnh nhau dưới dạng thẻ trực tiếp tại `#/multi?s=<slot>,<slot>…`. Mỗi thẻ là một bản kết xuất thật của phiên, nên những gì bạn thấy là những gì sẽ xuất.

Một thanh bên điều khiển tất cả:

- <!--i:sliders--> **Shared** đứng đầu: mọi đầu vào mà hai phiên trở lên khai báo giống nhau (cùng id, cùng kiểu, cùng ràng buộc, quy tắc mà lưới batch dùng cho các cột). Sửa một điều khiển chung một lần và giá trị tới mọi phiên khai báo đầu vào đó, trực tiếp trên mọi thẻ. Hai phiên của cùng một công cụ chia sẻ mọi thứ; hai công cụ khác nhau chỉ chia sẻ các đầu vào chung.
- <!--i:document--> Bên dưới, **một thẻ gập cho mỗi phiên** chứa mọi đầu vào riêng của phiên đó, đầy đủ như thanh bên của chính công cụ, với một khối xuất gọn: **Format**, **W** / **H**, **Unit**, **DPI** và **Download**. Download đó lưu phiên trước, rồi kết xuất tệp với cùng tên tệp, định dạng và Content Credentials như từ công cụ.
- <!--i:search--> **Filter inputs…** ở trên cùng thu hẹp các điều khiển trên mọi thẻ cùng lúc, để bạn tới được "tiêu đề" trong tám phiên mà không phải cuộn.

Nhấp vào bất kỳ thẻ nào (hoặc nhấn Enter trên đó) để mở thẻ thanh bên của phiên đó. **Save all** ghi mọi phiên về ô của chính nó. **Download all** lưu trước, rồi kết xuất cả bộ vào một zip, cùng cách **Render selection** làm trong Projects, với khóa mật khẩu tùy chọn được đưa ra giữa chừng.

Mỗi thẻ vẽ theo lựa chọn chủ đề của phiên riêng nó, kể cả công cụ đặt trong thiết kế. Các thẻ ở những diện mạo khác nhau nằm cạnh nhau trong khi ứng dụng xung quanh giữ màu của riêng nó, và **Save all**, các lần tải xuống, **Batch grid** và **Send to Print Sheet** giữ lựa chọn của từng phiên.

### Giới hạn

- **Tối đa tám.** Mỗi thẻ gắn runtime trực tiếp của riêng nó, và tám là con số còn giữ được độ phản hồi. Liên kết đòi nhiều hơn, hoặc một phiên không còn tồn tại, sẽ nói rõ thay vì tải dở.
- **Liên kết là cục bộ.** Nó gọi tên các ô đã lưu của chính bạn, nên mở lại bộ đó trên thiết bị này. Nó không phải liên kết chia sẻ.
- **Với lớn hơn,** chọn **Edit as sheet** trong cùng thanh chọn. Nó mở cả vùng chọn thành các hàng trong lưới batch (`#/batch?s=…`), không giới hạn kích thước và không quy tắc cùng công cụ. Thư mục nằm ngoài cả hai: mở một thư mục trong lưới bằng **Sessions → Folders…**, hoặc kết xuất bằng **Render folder** trong Projects.
- **Tìm kiếm không tới Multi-edit.** Đây là chế độ xem duy nhất mà thanh tìm kiếm không biết.

## Đi tiếp từ đâu

- **[Export a file](/info/exporting.html)**: các định dạng, kích thước và cài đặt in mà mỗi hàng có thể dùng.
- **[Templates](/info/templates.html)**: các điểm khởi đầu làm nên một hàng đầu tiên tốt.
- **[Find and recover your work](/info/find-your-work.html)**: Projects, thư mục và kết xuất lại những gì bạn đã lưu.
