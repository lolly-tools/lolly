# Lolly Design System Setup

<a id="design-system-setup"></a>

**Lolly Design System Setup**, tại `#/start`, chứa logo, màu sắc và kiểu chữ của bạn. Mọi công cụ, trang và bản xuất đều vẽ bằng chúng.

Thả logo vào và Lolly đọc màu sắc của nó. Chọn kiểu chữ hoặc thả tệp phông chữ mà công ty bạn được cấp phép sử dụng. Mỗi thay đổi hiển thị ngay trong toàn ứng dụng. Logo, phông chữ và token của bạn ở lại trên thiết bị này. Chỉ việc chọn Google Font mới kết nối ra ngoài: Lolly hỏi trước rồi tải họ phông chữ một lần.

Đặt tên hệ thống thiết kế và nhấn **Export** để nhận một tệp `.lolly`. Giữ tệp, mở trên thiết bị khác hoặc đưa cho đồng nghiệp. [Lolly Settings](/info/dashboard.html#design-system) hiển thị hệ thống đang dùng ở chế độ chỉ đọc; bìa liên kết về đây để chỉnh sửa.

<!--i:eti-clock-->
## Tạo dấu ấn riêng trong năm phút

::: timeline
- <!--i:upload--> **Thả logo của bạn** vào vùng thả trong **Logos**. Lolly đọc hình dạng và màu sắc của nó.
- <!--i:palette--> **Use these colours.** Màu chính của logo trở thành màu chính của bạn, và một màu trung tính tối từ logo trở thành màu văn bản.
- <!--i:font--> **Choose a face** trong **Type**: Google Font hoặc tệp phông chữ bạn sở hữu.
- <!--i:pentool--> **Đặt tên hệ thống.** Chỉnh sửa đầu tiên tạo hệ thống thiết kế của riêng bạn, và Lolly hỏi tên hệ thống một lần.
- <!--i:download--> **Export** ghi toàn bộ hệ thống thành một tệp `LollyBrand-….lolly`.
:::

Thanh ở trên cùng studio hiển thị tên hệ thống thiết kế dưới dạng ô có thể chỉnh sửa. **Enter** giữ tên mới và **Escape** đưa tên cũ trở lại. Khi chỉnh sửa đầu tiên hỏi **What is this design system called?**, Lolly điền các từ từ logo nếu logo có ghi chúng. **Save name** giữ tên; **Not now** giữ tên tạm cho đến khi bạn gõ tên trên thanh. Tên này gắn nhãn hệ thống trong Settings và khi bạn chuyển hệ thống, đồng thời là tên tệp mà **Export** ghi ra.

<!--i:eti-grid-->
## Các phòng

Studio gồm các phòng không có thứ tự cố định. Không phòng nào phải chờ phòng khác. Trên máy tính, các phòng nằm trong một dải bên dưới thanh. Trên điện thoại, chúng chuyển xuống thanh dọc mép dưới, với phòng đang mở được cuộn vào tầm nhìn. Bảng màu và khay nổi lên trên thanh đó, và thanh tránh sang bên khi bạn gõ. Với bàn phím, Tab đưa bạn đến dải một lần, còn các phím mũi tên, Home và End di chuyển giữa các phòng.

![Thanh của studio và các phòng: Board, Colours, Type, Logos, Tokens, Files, Sound, Rules và Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Phòng | Bạn làm gì ở đó | Khóa liên kết |
|---|---|---|
| **Board** | Xem hệ thống chứa gì, với lối vào từng phòng | `overview` |
| **Colours** | Thêm màu, gán vai trò, tạo sắc độ và bảng màu | `color` |
| **Type** | Chọn bốn kiểu chữ mà ứng dụng, các công cụ và mọi bản xuất đọc | `type` |
| **Logos** | Đặt các biểu trưng theo mọi hướng và cách thể hiện | `logos` |
| **Tokens** | Góc, khoảng cách, đổ bóng và mọi giá trị có tên khác | `tokens` |
| **Files** | Các tệp ảnh, âm thanh và chuyển động mà thương hiệu giữ | `catalogue` |
| **Sound** | Định hình nhận diện âm thanh, nhạc cho các mục đích khác nhau và mối quan hệ với giọng nói | `sound` |
| **Rules** | Các quy tắc thương hiệu áp dụng, được kiểm tra trên ví dụ thực tế | `usage` |
| **Skills** | Các tiêu chuẩn bằng văn bản của thương hiệu dành cho con người và tác nhân, để đọc và tải xuống | `skills` |

Liên kết đến một phòng bằng `#/start?area=<key>`. Khóa phòng là cố định, nên Files giữ `catalogue`, Board giữ `overview` và Rules giữ `usage`. `?tab=` vẫn hoạt động như bí danh cũ. Khóa không xác định sẽ mở Board.

**Thanh** chứa các hành động cho toàn hệ thống. **Add from…** đưa một thương hiệu vào ([Đưa thương hiệu vào](#bring-a-brand-in)). **Tray** giữ những gì quá trình quét tìm thấy mà bạn chưa thêm. **Export** ghi hệ thống thành một tệp. **More** chứa **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** và **Design systems**, mở danh sách trong Settings nơi bạn chuyển hệ thống ([Giữ và chuyển hệ thống thiết kế](#keep-and-move-your-design-system)). Mỗi hành động xuất hiện khi có nội dung để xử lý. Trên điện thoại, **Add from…** chuyển vào **More** và **Export** hiển thị dưới dạng biểu tượng.

Khi hệ thống thiết kế vẫn là hệ thống đi kèm ứng dụng, thanh bắt đầu bằng **Make it yours**, một menu gồm **Find a look**, **Add from…** và **Pick a colour**. Khi hệ thống đã là của riêng bạn, **Export** trở lại vị trí đó.

<!--i:eti-clipboard-->
## Board

Khi chưa chọn gì, Board đưa ra bốn cách bắt đầu. **Start from a reference** mở bộ chọn nguồn cho logo, ảnh chụp màn hình, trang web hoặc tệp thiết kế. **Pick a colour**, **Choose a face** và **Add a logo** mở các điều khiển tương ứng. Mở một điều khiển không ghi gì. Bên dưới, **Find a look** có các màu và kiểu chữ làm sẵn để thử, và **Explore the tools** có ngay từ đầu.

Khi đã có thứ gì đó của riêng bạn, Board hiển thị những gì bạn có, với số lượng của riêng bạn trước. Colours cho biết số màu, với `· N starter` hiển thị nhạt cho các màu kế thừa. Dải màu hiển thị màu của bạn, rồi một đường mảnh, rồi các màu ban đầu được làm nhạt. Colourways hiển thị mỗi colourway dưới dạng ô nhỏ mang màu chủ đạo của nó. Type liệt kê từng vai trò và hiển thị từng họ phông chữ bằng kiểu chữ riêng (*Inter cho đề mục*, với *Starter cho phần còn lại* ở dòng bên dưới). Logos cho biết có bao nhiêu ô đã điền (hoặc **Not set**), Tokens hiển thị bán kính góc và Files ghi **Nothing yet** khi thư viện còn trống. Mỗi khối mở phòng của nó.

Hệ thống thiết kế chỉnh sửa được đi kèm ứng dụng, như Lolly Demo, hiển thị màu sắc, colourway, kiểu chữ và biểu trưng trên Board ngay từ đầu, với nhãn **Came with this app** cạnh đề mục. Phía trên, **Start here** có **Find a look**, **Add from…** và **Pick a colour**.

### Nội dung ban đầu và của bạn

Trong mỗi phòng, **Starter** đánh dấu mọi thứ đi kèm ứng dụng mà chưa ai chọn. Bản cài đặt mới không có màu nào, chỉ có một thang màu trung tính từ màu mực đến màu giấy, để bề mặt, văn bản và đường mảnh có thể được kết xuất trước khi có người chọn.

::: cols
## Nội dung ban đầu

- Đi kèm ứng dụng: các màu trung tính từ màu mực đến màu giấy, kiểu chữ ban đầu, bán kính góc mặc định.
- Hiển thị nhạt, có nhãn **Starter** và không nhuộm màu.
- Không được tính là màu của bạn. Các màu trung tính nằm trong **Tokens** dưới tên **Neutrals · starter · 9**, và **Open** hiển thị chúng trong Colours thành một nhóm đang gập (`#/start?area=color&group=neutral`).
- Vai trò đang dùng màu ban đầu ghi *"Starter Paper đang thay thế"*, với **Choose…** trên bộ chọn.

## Của bạn

- Do bạn chọn hoặc cài đặt.
- Hiển thị đậm rõ, với thẻ được nhuộm màu ở nơi bạn đã cài kiểu chữ.
- Được tính trên Board và trong Tokens.
- Vai trò theo một vai trò khác ghi **↳ follows Primary**.
:::

Nội dung kế thừa không bao giờ có viền nét đứt. Viền nét đứt biểu thị vùng nhận tệp thả vào.

<!--i:eti-shapes-->
## Logo

Vùng thả ở trên cùng, **"Drop marks here, or choose several at once"**, nhận bao nhiêu tệp cũng được. Lolly đọc hình dạng và màu mực của từng tệp. Sau đó tệp chờ dưới **Waiting for a slot** dưới dạng chip cho biết nó trông giống gì, chẳng hạn *"Có vẻ là Horizontal primary"*, kèm số đo đã dùng và nút **Place** (**Replace** nếu ô đã có nội dung). Khi Lolly không chắc, chip ghi rõ và có **Change slot**, liệt kê cả tám ô. Không có gì được đặt vào cho đến khi bạn nhấn nút.

Biểu trưng có lề trống thừa sẽ được đề nghị cắt gọn trước. Trả lời đề nghị hoặc nhấn Escape để đặt bản gốc nguyên vẹn. Khi một biểu trưng có thể điền vào ô cùng nhóm còn trống, phòng đưa ra phiên bản **mono** hoặc **reverse** tạo từ nó dưới dạng chip có nhãn *Generated*.

Mỗi biểu trưng được đặt vào lưới gồm tám ô tùy chọn, mỗi ô cho một **hướng** và **cách thể hiện**:

- **Hướng:** Horizontal (wordmark và biểu tượng trên cùng hàng) và Vertical (xếp chồng, cho không gian vuông và cao).
- **Cách thể hiện:** Primary, Primary reverse (cho nền tối), Mono (một màu) và Mono reverse.

Nhóm chưa có biểu trưng gập thành một dòng; mở nhóm để xem các ô. Nhấp một ô để thêm PNG, SVG, JPEG hoặc WebP, hoặc nhấp ô đã có nội dung để thay biểu trưng. Ô trống cũng nhận tệp thả vào. Biểu trưng ngang nằm trong ô rộng và biểu trưng dọc nằm trong ô vuông, mỗi biểu trưng trên bề mặt dành cho nó, với khoảng trống bằng một phần tư chiều cao. Mọi thứ ở lại trên thiết bị này.

![Các ô logo với Horizontal và Vertical mở ra: mỗi cách thể hiện có ô riêng và mọi ô đều là tùy chọn](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** là các biểu trưng mà thương hiệu gọi bằng tên riêng, như biểu tượng, huy hiệu hoặc favicon.
- **Thêm bộ nhận diện.** Thương hiệu con, sản phẩm hoặc sự kiện có thể có bộ đầy đủ riêng: nhấn **+ Add another logo** và đặt tên cho bộ đó. Bộ chính của bạn là "Your logo". [Kiến trúc thương hiệu](/info/brand-architectures.html) cho biết khi nào nên dùng một bộ nhận diện logo.
- **Lolly đọc màu sắc của logo.** Một thẻ dưới vùng thả và ở trên cùng Colours liệt kê màu sắc của logo và hỏi **Which is the main colour?**. Màu nổi bật nhất được chọn, không bao giờ là nền trắng mà logo được xuất trên đó. **Use these colours** thêm chúng vào bảng màu và đặt màu chính của logo làm màu chính của bạn. Khi logo có màu trung tính tối hiển thị rõ trên giấy, màu trung tính đó trở thành màu văn bản. **Not now** để chúng trong Tray. Trên bản cài đặt hoàn toàn mới, Lolly áp dụng ngay lựa chọn có khả năng đúng nhất, và thẻ có **Undo** hoặc cho chọn màu chính khác. SVG cho màu chính xác; PNG, JPEG hoặc WebP cho các màu chiếm phần đáng kể của biểu trưng.

<!--i:eti-palette-->
## Màu sắc

Phòng mở rộng cùng hệ thống thiết kế. Lần truy cập đầu tiên yêu cầu một quyết định; nhiều điều khiển hơn xuất hiện khi bảng màu mở rộng.

### Màu đầu tiên

Hệ thống chưa có màu riêng hiển thị các màu trung tính ban đầu trong một nhóm riêng đang mở. Trên cùng phòng là ô dán và thả có viền nét đứt: một chip lớn và một ô nhập. Thả ảnh hoặc danh sách màu vào bất cứ đâu trên ô, và Lolly đọc các màu.

- **Chip là bộ chọn.** **Pick a colour** mở thẻ OKLCH của studio, với giá trị ban đầu lấy từ ô nhập. Thẻ hiển thị tên và mã hex của màu trước. Các không gian màu, vòng màu, bốn núm xoay và alpha nằm trong **Fine-tune**, còn **Cancel** và **Add colour** ở chân thẻ. Không có gì được đưa vào hệ thống cho đến khi bạn nhấn **Add colour**.
- **Ô nhập nhận mọi cách biểu diễn**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` hoặc tên màu. Danh sách được dán trở thành một hàng chip để thêm từng màu hoặc thêm bằng **Add all**.
- **Hai cách thêm nữa.** **Pick a colour from the screen** dùng ống hút màu khi trình duyệt có hỗ trợ, và **Take colours from an image** đọc ảnh chụp màn hình hoặc ảnh trên thiết bị này.
- **Add không bao giờ bị vô hiệu hóa.** Khi ô nhập trống, nó mở bộ chọn; nếu văn bản không đọc được, một dòng bên dưới ô sẽ báo rõ.

Màu đầu tiên trở thành **màu chính**. Một chip xác nhận thay đổi, chẳng hạn *"Màu chính hiện là Vivid Violet"*, cùng **Fine-tune** để chỉnh màu.


### Khi bảng màu mở rộng

Các màu của bạn nằm cạnh bản xem trước **In context** trên màn hình rộng và phía trên bản xem trước trên màn hình nhỏ hơn. Bản xem trước hiển thị áp phích, biểu đồ hoặc thẻ giao diện bằng bảng màu của bạn. Các màu ban đầu có nhóm riêng, gập lại khi hệ thống đã có màu riêng. Ô dán và thả thu thành một hàng gọn. Đầu phòng không có thao tác xuất; dùng **Export** trên thanh hoặc phòng Tokens.

![Phòng Colours trên Lolly Demo: các chip vai trò và ô dán và thả ở trên cùng, rồi đến bảng màu trong các nhóm gập được, mỗi màu có tên và mã hex](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Phòng Colours trên Lolly Demo sau khi thêm một màu: bảng Colour roles, rồi chip của màu mới với Use as Lead? và Fine-tune, cạnh bản xem trước bố cục trực tiếp](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Vai trò màu: các màu được gọi là gì

Hệ thống thiết kế đặt tên cho các màu và cho biết mỗi màu dùng để làm gì, và Lolly đọc cả hai. **Colour roles** nằm ở đầu phòng Colours. **In context** hiển thị ngay từng thay đổi.

![Bảng Colour roles trên Wefthouse, một thương hiệu dệt may hư cấu, bằng các từ riêng của thương hiệu: các chip colourway Indigo, Madder và Weld, rồi Main, Accent, Supporting và Tertiary, mỗi vai trò có màu sáng và tối, được đọc là màu chủ đạo, màu phối hợp và chỉ theo tên, còn Background, Text, Quiet text và Hairlines được liệt kê dưới bảng là các cách đọc chưa có vai trò nào đảm nhận](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

Bảng có bốn cột. Trên điện thoại, mỗi hàng trở thành một thẻ với sáng và tối cạnh nhau:

| Cột | Nội dung |
|---|---|
| **Role** | Từ riêng của hệ thống thiết kế mà bạn có thể chỉnh sửa tại chỗ, cùng một dòng cho biết màu dùng để làm gì |
| **Light** và **Dark** | Màu trong giao diện đó của colourway đã chọn, với tên hoặc giá trị và độ tương phản |
| **Lolly reads this as** | Công cụ làm gì với vai trò đó, bằng các từ riêng của Lolly |

**Cách Lolly hiểu một vai trò.** Mỗi cách hiểu gắn với một vai trò. Chọn cách hiểu đang thuộc về vai trò khác sẽ chuyển cách hiểu đó sang vai trò này. Lolly không bao giờ suy ra ý nghĩa từ một từ.

| Cách hiểu | Kết quả |
|---|---|
| **Lead colour** | Các hình lớn, nút, màu mà công cụ dùng làm chủ đạo |
| **Partner colour** | Màu thứ hai mà công cụ dùng đến |
| **Background** | Nằm sau mọi thứ khác |
| **Text** | Tiêu đề và nội dung văn bản |
| **Quiet text** | Chú thích và chữ nhỏ |
| **Hairlines** | Đường kẻ, đường viền và đường phân cách |
| **By name only** | Không công cụ nào tự chọn vai trò này. Vai trò xuất hiện trong mọi ô màu và trong Design, nơi lựa chọn giữ liên kết để đi theo colourway |

Cách hiểu chưa có vai trò nào đảm nhiệm giữ định nghĩa của hệ thống thiết kế, và phòng liệt kê các cách hiểu đó bên dưới bảng. Vai trò có cùng id với một cách hiểu, chẳng hạn vai trò tên Primary, chính là cách hiểu đó và không thể chuyển đi.

**Trong biểu đồ.** Bảng màu **Design system - colour roles first** của Lolly Chart gán cho các chuỗi vai trò màu của hệ thống thiết kế theo thứ tự của hệ thống, rồi đến phần còn lại của bảng màu. Vai trò được hiểu là nền, văn bản, văn bản phụ hoặc đường mảnh được bỏ qua, vì biểu đồ dùng những màu đó để vẽ nền và chữ. Không có gì thay đổi cho đến khi bạn chọn bảng màu đó. Hệ thống thiết kế không có vai trò màu vẽ bảng màu như **Design system - ordered**.

**Giá trị.** Nhấn một giá trị để chọn màu của vai trò đó cho giao diện đó và colourway đã chọn. **Same as light** cho giá trị tối theo giá trị sáng cho đến khi bạn chọn một màu tối. Chip **Aa** hiện chữ mà Lolly chọn để đặt trên màu đó. Dòng dưới giá trị cho biết chữ đó dễ đọc đến đâu trong mỗi giao diện: **Text reads well**, **Large text only** hoặc **Hard to read as text**. Đánh giá chỉ áp dụng cho chữ trên màu đó; màu vẫn có thể phù hợp với hình khối và vùng lớn. Vai trò chỉ được hiểu theo tên hiện cùng các dòng chữ nhưng không có màu cảnh báo, vì không công cụ nào tự đặt chữ lên vai trò đó. Chú giải và bộ chọn hiện các số đo, APCA trước và WCAG sau. **Own text colour** đánh dấu giá trị có màu chữ được khai báo trong tệp; màu chữ đó được giữ nguyên. **Copied** đánh dấu giá trị lấy từ colourway khác hoặc từ màu phối mà chưa ai chọn; **Keep this colour** trong bộ chọn xác lập giá trị đó.

**Điểm khởi đầu.** Hệ thống thiết kế chưa có vai trò riêng hiện các từ hiện tại: Primary, Secondary, Surface và Text. Chưa có gì được ghi cho đến khi bạn đổi một từ. **+ Add a role** gợi ý **Primary, Secondary** hoặc **Main, Accent, Supporting, Tertiary**, hoặc nhận bất kỳ từ nào bạn gõ và hiện cách hiểu mà mỗi từ sẽ nhận. Hai từ đầu trở thành màu chủ đạo và màu phối. Các công cụ tiếp tục vẽ cùng những màu đó. Trên hệ thống có một màu chủ đạo, colourway đầu tiên lấy tên của màu đó.

**Đổi tên, đổi thứ tự, xóa.** Đổi tên chỉ đổi từ ngữ; mọi thứ dùng vai trò đó vẫn hoạt động. Kéo vai trò bằng tay nắm, hoặc nhấn Space trên tay nắm, dùng phím mũi tên rồi nhấn Space để thả. **Remove** cho biết những gì vẫn dùng vai trò đó. Khi các công cụ đọc vai trò, **Remove and keep those colours** để mỗi cách hiểu giữ màu hiện tại. Quy tắc nội bộ, nhóm hướng dẫn, ô nhập của công cụ hoặc token khác đang dùng vai trò sẽ giữ vai trò đó cho đến khi cách dùng đó thay đổi. Tài liệu Design đã lưu cũng có thể dùng vai trò theo tên, và Lolly không thể biết điều đó từ tệp token. Tài liệu như vậy báo rằng không phân giải được màu.

::: details Vai trò trong tệp token viết tay
**Tệp viết tay.** Các màu trong tệp token chưa được vai trò nào khai báo được liệt kê dưới **In this file, with no role yet**, mỗi màu có một ô nhập từ và **Make a role**. Dù có tạo vai trò hay không, chúng vẫn hoạt động theo tên. Token có chữ số trong tên không thể là vai trò; nó ở lại trong tệp và tiếp tục hoạt động theo đường dẫn. Nếu một bản ghi trong tệp không hợp lệ, bảng hiện ra không có điều khiển và cho biết lý do.
:::

**Phần còn lại của phòng dùng cùng những từ đó.** Các chip, hàng **Use as** của ô màu và nhóm **Colour roles** của bảng màu đều dùng từ của hệ thống thiết kế. Thẻ của vai trò màu mở giá trị của nó. Tệp xuất không ghi thêm thông tin về vai trò; màu của bản kết xuất đổi vì các token đã đổi.

**Những từ đó đi đâu.** Từ ngữ và mô tả đi cùng hệ thống thiết kế. Các tác tử đọc chúng trong bản mô tả thiết kế, `lolly://tokens` và `AGENTS.md` của trang thương hiệu. Terminal hiện chúng trong `lolly system status`. Trang thương hiệu liệt kê chúng trong `brand.json` và đo một cặp tương phản cho mỗi vai trò. Tệp DTCG và Tokens Studio giữ mọi thứ, `DESIGN.md` giữ từ ngữ và cách hiểu, còn chủ đề PowerPoint chỉ giữ thứ tự của thương hiệu. [Vai trò màu trong các định dạng khác](/info/design-tokens.html#colour-roles-in-other-formats) có danh sách đầy đủ. Từ ngữ luôn được trích dẫn dưới dạng dữ liệu của hệ thống thiết kế, không bao giờ được đọc như chỉ dẫn.

**Nơi chọn màu.** Mọi ô màu trong công cụ và trong Lolly Design liệt kê các vai trò của hệ thống thiết kế trước, theo thứ tự của hệ thống, kèm từng từ và mục đích. **Aa** cạnh một vai trò chọn màu đặt trên vai trò đó. Các màu khác theo sau dưới **Other colours**, không gồm các bản sao riêng của colourway, các màu đặt trên màu khác và mọi cách hiểu đã có vai trò đảm nhiệm. Lựa chọn giữ liên kết với vai trò và đi theo colourway. Ô hiện từ đó trong mọi colourway, và Settings cùng Tokens cũng dùng từ đó. Hệ thống thiết kế không có vai trò giữ lưới ô màu của mình.

### Mọi màu mà công cụ đọc

Khi **Colour roles** đóng, phòng mở đầu bằng các chip cho những quyết định đầu tiên. Mỗi chip hiện màu và tên của vai trò. Trên hệ thống chưa có từ riêng, đó là **Primary**, **Secondary**, **Surface** và **Text**. Nhấn một chip để chọn màu từ các ô màu của bảng màu. **Every colour a tool reads**, ở cuối **Colour roles**, chứa toàn bộ dải màu.

Dải màu hiện bảy màu mà công cụ có thể đọc: Primary, Secondary, Surface, Text, Muted, Edge và On primary, bằng từ riêng của hệ thống thiết kế nếu có. Mỗi màu giữ cùng vai trò trong mọi công cụ và bản xuất. Không màu nào bắt buộc phải đặt, và bất kỳ màu nào cũng có thể đảm nhiệm một vai trò. Ba màu riêng lẻ đủ tạo nên một hệ thống tốt. Phần số đo cho biết chữ dễ đọc đến đâu trên bề mặt, APCA trước. Mỗi hàng hiện màu riêng của bạn ở mức đầy đủ, màu khởi đầu thay thế hoặc **↳ follows Primary**.

On primary được suy ra từ màu chính, có nhãn **Derived** và không có bộ chọn. Công tắc **Light** và **Dark** cạnh On primary, cùng công tắc cạnh **In context**, chọn giao diện mà dải màu, bảng màu và bản xem trước hiển thị.

Theo mặc định, màu nhấn của ứng dụng theo hệ thống thiết kế, qua cài đặt **Interface follows the design system** trong **Settings → Appearance**. Khi tắt cài đặt này, phần giao diện ứng dụng giữ màu trung tính. Các công cụ, canvas và bản xuất vẫn theo hệ thống thiết kế dù bật hay tắt.

**Colourway.** Hệ thống thiết kế có thể chứa nhiều màu chủ đạo, được chọn cho từng tác phẩm. Hàng **Colourways** ở đầu **Colour roles** hiện một chip cho mỗi colourway, với **Default** trên colourway chuẩn. **+ Add** tạo colourway mới từ một màu trong bảng màu. Chọn một chip, và bảng, dải màu, bảng màu cùng các bản xem trước hiện colourway đó. Bạn có thể đổi tên, nhân bản, xóa hoặc đặt colourway đã chọn làm mặc định. Trên hệ thống có colourway, mỗi colourway cần màu chính và màu phụ riêng, cùng màu bề mặt riêng khi các colourway nhuộm màu nền. Những vai trò đó vẫn được đặt trong trình chỉnh sửa ô màu. [Thêm colourway vào hệ thống thiết kế](/info/colourways.html#add-colourways-to-a-design-system) có các bước và định dạng token, và [Sử dụng Lolly Demo](/info/lolly-demo-in-use.html#colourways-on-real-work) cho thấy colourway trên công việc thật. Mỗi người có thể chọn một colourway cho riêng mình trong **Settings → Appearance** ([Chọn colourway cho riêng bạn](/info/colourways.html#make-a-colourway-your-own)).

### Tìm thêm màu

Ba công cụ dựa trên màu chính của bạn. Hai công cụ đầu chỉ gợi ý; công cụ thứ ba thay bảng màu.

::: cols
## Khám phá sắc độ & phối màu

Chọn **Starting colour**, **Scheme** (Mono, Complement, Analogous hoặc Triad) và số **Shades** (3 đến 20, mặc định 5). **Fine-tune** đặt cường độ giao diện, độ tương phản và chữ trên màu thương hiệu. Nhấp một sắc độ để thêm, hoặc **Add 5 shades** để thêm một nhóm. Màu và vai trò của bạn giữ nguyên.

## Tìm màu phù hợp

Chọn **Harmony**: Complementary, Adjacent, Triad, Tetrad hoặc Analogous (với **Accents** từ 2 đến 5 và **Angle** từ 10° đến 45°). Mỗi màu đề xuất có tên được tạo tự động và **+ Add**, mỗi lần nhấn thêm một màu.

## Tạo lại toàn bộ bảng màu

Thay bảng màu từ một màu khởi đầu, sau khi xem xét những gì thay đổi và những gì giữ nguyên.
:::

Cả ba dùng cùng phép toán màu theo cảm nhận (OKLCH) như bộ máy kết xuất. Trong **Explore shades & harmonies**, các hàng **Primary**, **Neutral** và **Secondary** hiện những sắc độ được gợi ý, và **Theme preview** hiện ví dụ sáng và tối cùng số đo tương phản.

![Ba nhóm sắc độ được gợi ý, với điều khiển thêm riêng và Theme preview tách biệt](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Các màu nhấn được tạo, mỗi màu có một ô màu, tên tự động, mã hex và nút Add](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Áp dụng bảng màu đã tạo

Mở **Rebuild the whole palette…** và nhấn **Preview full rebuild**. Phần xem xét đếm số vai trò giữ nguyên như bạn đã gán, số màu riêng của bạn được giữ và số đường cong sắc độ, khóa màu in, sắc độ ẩn cùng điểm dừng chuyển màu được neo lại hoặc giữ nguyên. **Apply rebuilt palette** áp dụng; **Cancel** không đổi gì. Sau đó thẻ hiện **Undo**, đã được lấy tiêu điểm, và điểm khôi phục được tạo trước khi thay sẽ khôi phục toàn bộ hệ thống.

Hệ thống có colourway giữ mọi colourway khi tạo lại. Colourway chuẩn theo màu khởi đầu mới, và mọi colourway khác giữ màu, tên, thứ tự cùng cài đặt riêng. Phần xem xét liệt kê colourway nào theo màu mới và colourway nào giữ màu. Lolly không tạo lại hệ thống mã hóa các colourway theo cách mà nó không thể chỉnh sửa; thẻ cho biết lý do và không có gì thay đổi.

### Các phần chuyên sâu

Bốn phần gập nằm dưới bản xem trước và các vai trò. Mỗi phần mở bằng `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`).
- **Shade curves** (`focus=curves`) định hình lại dải sắc độ theo từng điểm, với đường cong độ sáng, độ rực và sắc tướng riêng (L / C / H) và các sắc độ được vẽ lại khi bạn kéo.
- **Contrast** (`focus=contrast`): **Contrast-lock** chỉnh tông của dải sắc độ để đạt mục tiêu APCA trên nền bạn chọn, và **Rotate hue** xoay toàn bộ dải sắc độ quanh vòng màu.
- **Print** (`focus=print`) đặt màu chính khi in: giá trị tự động, công thức CMYK được ghim hoặc mực màu pha có tên.

### Bảng màu và từng ô màu

Bảng màu liệt kê các màu của bạn trong những nhóm gập được, mỗi nhóm có **+ Add** riêng. Bạn có thể tạo và đổi tên nhóm. Vai trò không bao giờ tạo thẻ thứ hai; thẻ mà vai trò trỏ tới hiện tên vai trò, chẳng hạn **Primary**. **Colour chart** dưới các thẻ hiện cùng những màu đó trên **Wheel** OKLCH (kéo một chấm để đổi màu, nhấp vùng trống để thêm ô màu) và biểu đồ **Gamut**, cho thấy giới hạn của dải màu hiển thị được. `#/start?area=color&focus=chart` mở biểu đồ.

![Ngăn bảng màu, mọi nhóm đều gập được](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Vòng màu OKLCH - góc là sắc tướng, khoảng cách từ tâm là độ rực và các màu xám nằm trên thanh độ sáng dọc bên cạnh](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Nhấp một ô màu để mở trình chỉnh sửa:

- **Rename** ô màu.
- **Đặt màu** bằng các thanh trượt OKLCH, hoặc trong **Hex**, **HSL**, **RGB** hay **CMYK**. Ô giá trị đọc và ghi theo không gian màu đang chọn. CMYK ở đây đặt màu màn hình bằng phép chuyển đổi; để ghim chính xác lượng mực, dùng **Print substitutes**.
- **Stored as** chọn cách lưu ô màu: **LCH** (mặc định, theo cảm nhận và có dải màu rộng), Hex, RGB hoặc HSL.
- **Use as** gán vai trò cho ô màu, bằng từ riêng của hệ thống thiết kế nếu có. Nhấn lại vai trò được tô sáng để bỏ vai trò.
- **Print substitutes** (gập): khóa **CMYK** từ **Auto** thành các giá trị mực chính xác, hoặc đặt **Spot colour** với **Name** (chẳng hạn `PANTONE 186 C`), **Book** tùy chọn và **Finish** cho ép kim, dập nổi, dập chìm, phủ véc-ni cục bộ, phủ mềm hoặc cắt bế, cấn hay đục lỗ. Máy in dùng các khóa này khi bạn xuất PDF hoặc TIFF CMYK; xem [Hồ sơ màu](/info/exporting.html#colour-profiles). Mực màu pha in trên bản in riêng trong Print PDF; để in mọi mực màu pha bằng hệ màu process cho một lần xuất, xem [In mực màu pha bằng hệ màu process](/info/exporting.html#spot-inks-as-process).
- **In other spaces** (gập): một giá trị cho mỗi không gian màu, được suy ra hoặc do bạn đặt, và giá trị do bạn đặt được ưu tiên khi xuất.

**Xóa ô màu** là an toàn. Các sắc độ được suy ra và vai trò chủ đề được ẩn, nên mọi thứ đọc chúng vẫn hoạt động. Các màu bạn thêm được xóa.

::: details Làm việc với nhiều ô màu
Ở trạng thái thường, ô màu hiện màu, tên và mã hex. Select hiện hộp kiểm và tay nắm kéo của từng ô màu trên mọi màn hình, và thẻ có tiêu điểm bàn phím cũng hiện tay nắm. Kéo tay nắm để đổi thứ tự trong nhóm, hoặc lấy tiêu điểm tay nắm, nhấn Space, dùng phím mũi tên rồi nhấn Space lần nữa để thả; Escape hủy. Trên điện thoại, bảng màu hiện bốn màu mỗi hàng. Để chuyển màu giữa các nhóm, dùng điều khiển **Group** của trình chỉnh sửa hoặc chọn nhiều màu rồi dùng **Move to**.

Việc chọn không cần công tắc riêng: thanh và các hộp kiểm xuất hiện khi chọn thẻ đầu tiên và biến mất khi bỏ chọn thẻ cuối cùng.

- **Kéo trên vùng trống** để vẽ hình chữ nhật; mọi thẻ mà nó chạm vào đều được chọn, kể cả ở nhóm khác. Phần đang gập không thêm gì vào vùng chọn.
- **Shift-click** chọn một dải theo thứ tự đọc, **Cmd/Ctrl-click** bật hoặc tắt chọn một thẻ, và nhấp thường mở trình chỉnh sửa.
- Mỗi tiêu đề nhóm có **Select all**, và **Cmd-A** khi một thẻ có tiêu điểm chọn mọi màu của riêng bạn, không bao giờ chọn màu khởi đầu.
- Lưới có một điểm dừng Tab: phím mũi tên di chuyển, Shift-mũi tên mở rộng vùng chọn, Space bật hoặc tắt chọn, Delete xóa và Escape bỏ chọn. Để chỉnh nhẹ một kênh, nhấn `l`, `c` hoặc `h` trước.
- Trên màn hình cảm ứng, nhấn giữ một thẻ để bắt đầu chọn, rồi chạm để thêm.

Thanh hiện **{n} selected**, rồi **Move to**, **Give a role** (mỗi màu lần lượt nhận vai trò tiếp theo), **Download** (vùng chọn ở bất kỳ định dạng nào trong sáu định dạng bảng màu), **Duplicate** (một bản sao cho mỗi màu, đặt sau bản gốc), **Copy values** và **Delete**. Một bản sao mở trong trình chỉnh sửa; nhiều bản sao vẫn được chọn. Một lần Cmd/Ctrl-Z hoàn tác một thao tác hàng loạt.
:::

### Chuyển màu

Bảng **Gradients** tùy chọn tạo token pha màu từ bảng màu. Mỗi dải chuyển màu có bản xem trước, 2 đến 8 điểm dừng có tên và một góc. Điểm dừng trỏ tới một ô màu, nên đổi màu của ô thì dải chuyển màu đổi theo. Màu được pha trong OKLCH.

Các mục tải bảng màu (design tokens, CSS, SCSS, GIMP và Adobe Swatch Exchange) nằm ở đầu bảng màu. [Mang bảng màu và phông chữ của bạn đi mọi nơi](/info/using.html#take-your-palette-and-fonts-anywhere) mô tả từng định dạng.

<!--i:eti-type-->
## Kiểu chữ

Khi chưa có kiểu chữ riêng, phòng hiện một thẻ: **Primary**, đặt ở cỡ chữ để đọc bằng kiểu chữ hiện tại, với nhãn **Starter**, nút **Choose for Primary** và dòng *"Chưa có gì được cài cho đến khi bạn chọn một kiểu chữ."* Tiêu đề, mã và chữ nghiêng theo kiểu chữ chính cho đến khi bạn chọn riêng; **Choose them separately** hiện các thẻ của chúng.

![Phòng Type khi chưa chọn kiểu chữ - một thẻ ở cỡ chữ để đọc, có nhãn Starter và một nút Choose for Primary tô nền](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Chọn một kiểu chữ và phòng mở thành bốn thẻ vai trò, danh sách Fonts và mẫu chữ trực tiếp:

- **Primary**: nội dung văn bản, nút và mọi công cụ.
- **Headings**: kiểu chữ hiển thị cho `h1` và `h2`.
- **Code**: kiểu chữ đơn cách cho mã và dữ liệu.
- **Italic**: kiểu chữ nghiêng thật cho phần nhấn mạnh, trích dẫn và lời ghi thêm.

Thẻ chỉ có màu nền ở nơi bạn đã cài kiểu chữ đó. Nút của thẻ hiện vai trò: **Change Headings** trên kiểu chữ riêng của bạn và **Choose for Headings** ở mọi nơi khác. Dòng mẫu tự ngắt dòng. Không có gì trên thẻ áp dụng thay đổi; nút mở vùng so sánh cho vai trò đó.

![Bốn thẻ vai trò hiện ra - mỗi thẻ dùng kiểu chữ phục vụ vai trò đó, với nhãn Starter ở nơi chưa ai chọn và Italic theo kiểu chữ chính](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Vùng so sánh

Vùng so sánh mở dưới thẻ bạn nhấn. Các thẻ gập thành dải một dòng để vùng so sánh hiện ngay trên màn hình đầu tiên của điện thoại. Escape hủy và trả tiêu điểm về thẻ.

1. Nhấn **Choose for** cùng vai trò trên thẻ.
2. Gõ tên họ phông chữ và nhấn **Preview**, hoặc nhấn một trong sáu họ phông chữ **Pinned** dưới ô nhập.
3. Nhấn **Use this face**.

![Vùng so sánh mở dưới thẻ của nó, với hàng tìm kiếm, các họ phông chữ được ghim và các thẻ gập thành dải một dòng](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**Chỉ hỏi sự đồng ý một lần.** Lần đầu bản xem trước kết nối với Google Fonts, hộp thoại giải thích: *Google biết tên họ phông chữ và địa chỉ IP của bạn. Sau đó tệp được giữ trên thiết bị này và dùng ngoại tuyến. Đây là bước duy nhất trong studio kết nối với bên thứ ba.* **Fetch from Google** tiếp tục và lựa chọn được ghi nhớ. **Cancel** để thẻ hiện *"Chưa tải. Không có gì được gửi tới Google."*, với nút **Fetch from Google** riêng.

**Thả tệp phông chữ vào vùng so sánh** (TTF, OTF hoặc WOFF) để xem trước kiểu chữ có giấy phép mà bạn sở hữu. Dù theo cách nào, kiểu chữ vẫn ở trên thiết bị này, được kết xuất ngoại tuyến trong ứng dụng, các công cụ và mọi bản xuất, và đi cùng tệp hệ thống thiết kế. Mọi phông chữ trên Google Fonts đều được phát hành theo giấy phép mở (OFL, Apache hoặc UFL).

### Phông chữ trên thiết bị này

Bảng **Fonts** liệt kê mọi kiểu chữ trên thiết bị này và vai trò mà nó phục vụ. Kiểu chữ bạn thêm xuất hiện trước, dưới **In the design system**, mỗi kiểu kèm các vai trò và nút xóa. Các kiểu chữ khởi đầu theo sau trong một hàng mờ được gập lại. **Add a face** mở vùng so sánh cho bất kỳ vai trò nào. Bảng **Type roles** hiện mẫu chữ trực tiếp của mỗi vai trò cùng họ phông chữ và trạng thái, chẳng hạn *Inter* hoặc *Inter · follows Primary*.

<!--i:eti-tag-->
## Token

Token là các giá trị có tên làm nền tảng cho hệ thống thiết kế: màu sắc, kiểu chữ, logo, góc và khoảng cách. Các công cụ đọc chúng theo tên, nên thay đổi ở đây đến mọi công cụ cùng lúc.

![Phòng Tokens: phần đầu có ví dụ từ hệ thống và các thao tác tệp, các thẻ đếm từng loại token, rồi các cặp màu cùng số đo tương phản](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Phần đầu** đưa ra ví dụ từ hệ thống riêng của bạn (*Primary là Spearmint, #033633*) và các thao tác tệp: **Download** (hệ thống dưới dạng design tokens, hoặc bảng màu ở năm định dạng khác), **Copy CSS** và **Add from…** để đọc lại tệp JSON vào.
- **Các thẻ** đếm từng loại token và chuyển đến phần tương ứng: Colours, Type, Logos, Shape and spacing, More và All tokens. Phần chỉ chứa những gì đi kèm bộ khởi đầu trống mang nhãn **Starter**; hệ thống đi kèm ứng dụng đếm nội dung riêng mà không có nhãn đó. Trên điện thoại, các thẻ xuống thành hai hàng, mỗi hàng ba thẻ.
- **Colours** bắt đầu với các cặp mà công cụ dùng cùng nhau (chữ trên bề mặt, chữ trên màu chính, chữ phụ trên bề mặt) cùng số đo APCA ở giao diện sáng và tối, và đánh dấu **Weak contrast** ở cặp không đạt. Sau đó là mọi nhóm màu: dải sắc độ thành một hàng chip, các màu khác kèm giá trị và tham chiếu mà công cụ dùng, chẳng hạn `{color.brand.spearmint}`. Nhấn tham chiếu để sao chép tham chiếu đó. **Edit in Colours** mở nhóm trong phòng Colours. Trên hệ thống thiết kế có [vai trò màu](#colour-roles-what-the-colours-are-called), **Colour roles** đứng trước, mỗi vai trò xuất hiện một lần bằng từ và theo thứ tự riêng của hệ thống. Mỗi vai trò giữ một màu cho mọi colourway và giao diện. Các màu đó được liệt kê cùng vai trò, không thành các màu riêng; đổi chúng trong bảng Colour roles.
- **Type** và **Logos** liệt kê kiểu chữ cho mỗi vai trò và từng vị trí logo, với **Edit in Type** và **Edit in Logos** khi bạn có nội dung riêng.
- **Shape and spacing** chứa **Rounded corners** (`shape.radius`) và **Spacing rhythm** (`space.base`). Mỗi mục hiện *Lolly default* cho đến khi bạn di chuyển thanh trượt rồi hiện *Yours*, lưu ngay và có thể hoàn tác.
- **More tokens** thêm khoảng cách, kích thước, độ dày nét, độ mờ đục, góc xoay, số thuần và bóng đổ, được lưu dưới dạng [design tokens](/info/design-tokens.html) chuẩn.
- **App appearance (advanced)** liệt kê màu sắc, kích thước và bóng đổ mà các màn hình của Lolly dùng, và **Inspect every token (advanced)** tìm kiếm, chỉnh sửa mọi giá trị đã lưu và hiện từng thay đổi để xem xét trước. Ở đó, giá trị của vai trò màu trong mỗi colourway được liệt kê cùng vai trò: chọn token của vai trò để thấy mỗi colourway một hàng, sáng và tối cạnh nhau. Dòng đếm cho biết các vai trò chứa bao nhiêu giá trị. Hệ thống thiết kế chỉ đọc hiện cùng danh sách.

Phần trống có **Pick a colour**, **Choose a face** hoặc **Add a logo**.

<!--i:eti-images-->
## Tệp

Thả các tệp thương hiệu của bạn lưu giữ, ngoài logo: tệp **vector**, **hình ảnh**, **âm thanh** và **chuyển động** (video, Lottie và hoạt ảnh). Chúng xuất hiện trong [Assets](/info/using.html#assets-your-library), được chia theo phần, và trong bộ chọn tài nguyên của mọi công cụ. Chúng ở lại trên thiết bị này.

## Âm thanh

**Sound** được chọn bằng cách nghe. Phòng mở ra với ba âm thanh khởi đầu, **Calm**, **Steady** và **Bright**, mỗi âm thanh là một thẻ mang màu của thể loại đó cùng nút phát. Phát một thẻ để nghe đoạn ngắn; bắt đầu thẻ khác sẽ dừng thẻ đầu. **Choose** đặt âm thanh đó cho mọi cách dùng. Thẻ thứ tư, **Mixed**, cho mỗi cách dùng âm thanh riêng: Calm cho Explain, Steady cho Demonstrate và Bright cho Play. Nút phát của nó phát lần lượt cả ba. Chưa có gì được lưu cho đến khi bạn chọn **Save sound**. Âm thanh sau đó trở thành một phần của hệ thống thiết kế này, với điểm khôi phục trong cùng lịch sử mà các phòng khác dùng. Hệ thống thiết kế không có âm thanh tiếp tục hoạt động như trước.

Cách dùng là thời điểm âm thanh được phát: ban đầu có **Explain**, **Demonstrate** và **Play**. Mỗi cách dùng là một chip có nút phát riêng. **Music** hoặc **With narration** phía trên các chip đặt việc chip chỉ phát nhạc hay phát nhạc dưới giọng nói. Cách dùng bạn chọn hiện mục đích và nhạc bằng từ ngữ dễ hiểu, ví dụ "Ấm áp · 84 bpm · Rhodes, bass cuộn, bộ trống mộc cũ". Mọi cách dùng lấy thể loại, nhịp độ và nhạc cụ của âm thanh đã chọn (hoặc âm thanh riêng với Mixed). Mỗi cách dùng giữ giai điệu và sự cân bằng riêng: Explain giữ giai điệu không lấn giọng nói, còn Play cho giai điệu dẫn dắt. Chuyển giữa Mixed và một âm thanh duy nhất giữ cả hai điều đó. Cách dùng bạn tự thêm giữ âm thanh hiện có khi ở Mixed. Hệ thống thiết kế ghi lại lựa chọn của bạn. **Add a use** thêm một cách dùng và cho bạn gõ tên ngay tại chỗ. **Make main** chọn cách dùng được phát khi không có yêu cầu khác. **Another tune** phát một bản nhạc mới với cùng cài đặt.

**Edit in the music generator** mở [trình tạo nhạc](/info/generated-music.html#the-music-generator) với cài đặt của cách dùng đó, có một dòng ở đầu cho biết bạn đang chỉnh sửa âm thanh của ai. **Save to this use** đưa cài đặt về phòng; **Cancel** quay lại mà không đổi gì. Những lựa chọn chưa lưu trong phòng chờ khi bạn rời đi. Nếu trong lúc đó có người lưu âm thanh ở thẻ khác, bản lưu mới hơn được giữ và chỉnh sửa của bạn bị bỏ qua.

**Voice** chọn giọng nói cho cách dùng, tốc độ nói và độ lớn của nhạc dưới giọng nói; **Hear the voice with the music** phát cả hai. Dưới **More** có mức hạ nhạc khi giọng nói phát, lời để thử (ở lại trong phòng), ghi chú phát âm (mỗi dòng một mục, theo dạng cách viết = cách đọc) và ghi chú về giọng nói. Bản xem trước dùng mô hình giọng nói cục bộ và cách phối âm giống bản xuất chuỗi. Bản xem trước nhỏ dần rồi tắt; đó không phải đoạn kết được sáng tác.

**Notes and signature** chứa những điểm cần nghe trong một cách dùng và âm thanh đặc trưng: đoạn mở đầu hoặc kết thúc cố định được giữ thành tệp âm thanh riêng. Đặt âm thanh đặc trưng vào chuỗi của bạn; nhạc được tạo không bao giờ chứa âm thanh đặc trưng đó. Yêu cầu mà phiên bản Lolly này không thể kiểm tra sẽ ngăn tạo nhạc mới cho cách dùng đó.

**Details** chứa đặc tính của thương hiệu (âm thanh nên mang lại cảm giác gì, những gì giữ nguyên và những gì cần tránh) cùng đánh giá nghe. **Record a listening review** lưu tên người đánh giá, ngày và ghi chú của họ gắn với phiên bản âm thanh đã lưu. Mọi thay đổi đều đưa âm thanh về bản nháp. Đánh giá áp dụng cho phiên bản đó, không phải mọi giai điệu được tạo từ âm thanh sau này: hãy nghe từng tác phẩm mới trước khi gửi đi.

**Make a music project** mở cách dùng trong trình tạo nhạc dưới dạng dự án giữ cách dùng, phiên bản âm thanh và cài đặt chính xác. **New tune** ở đó tạo bản nhạc mới và giữ âm thanh. Nếu bạn đổi cài đặt, **Put the sound back** quay về âm thanh đó, và **Keep as my own** tiếp tục với giai điệu độc lập. Cho đến khi bạn chọn, dự án không thể được lưu hoặc tải xuống với ghi nhận được tạo từ âm thanh đó. Liên kết chia sẻ chỉ mang theo cài đặt nhạc. Dự án và giai điệu đã lưu cũng giữ ghi chú của âm thanh, nhưng ghi chú không có trong liên kết chia sẻ hay thông tin chứng thực công khai của tệp âm thanh. Giữ một bản ghi đã kết xuất khi cần bảo toàn chính xác âm thanh qua các phiên bản sau của trình tạo.

<!--i:eti-checklist-->
## Quy tắc

**Rules** đặt những gì mọi người có thể đổi, những gì giữ cố định và những gì Lolly có thể kiểm tra.

![Rules trên Lolly Demo: bốn quy tắc nội bộ, mỗi quy tắc được đánh dấu Checked in Design và Required hoặc Advisory, rồi Try your design system in use với các ví dụ sẵn sàng kết xuất](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** liệt kê các quy tắc của bạn. **Add rule** (hoặc **Add your first rule**) mở một biểu mẫu ngắn:

- **Rule name** bằng từ ngữ của bạn, chẳng hạn *Màu nhấn Beacon*;
- **Check**: **Colour choices**, **Font choices**, **Fixed artwork** hoặc **Text length**, cùng vai trò thương hiệu được dùng, dưới tên bạn đặt cho vai trò;
- **Example** mà quy tắc áp dụng (Poster, Title slide, Content slide hoặc Lolly Chart), **Mode** và quy tắc là **Required** hay **Advisory**;
- **Reviewed by**, rồi **Save draft** hoặc **Approve & save**.

Phê duyệt ghi lại quyết định của chính bạn trên thiết bị này. Các quy tắc bắt buộc đã phê duyệt giới hạn áp phích dùng lại được, và kiểm tra chỉ áp dụng cho các PNG ví dụ; chúng không thay đổi công cụ nào khác.

Quy tắc trong tệp token của hệ thống thiết kế, chẳng hạn cặp màu đã phê duyệt, độ đậm và căn lề văn bản hoặc logo cho mỗi bề mặt, được liệt kê ở đây với nhãn **Checked in Design**. Lolly Design kiểm tra từng lớp trong thẻ **Before you export** của bảng xuất, và `lolly check` làm tương tự với tài liệu Lolly Design đã lưu ([Trước khi xuất](/info/design.html#before-you-export)). Quy tắc mà bản dựng này chưa có bộ kiểm tra được giữ như khi cung cấp và đánh dấu **Unchecked**.

Lolly Demo có bốn quy tắc nội bộ đã phê duyệt. Tiêu đề không bao giờ viết toàn chữ hoa: quy tắc đó là bắt buộc, nên `lolly check` báo tiêu đề viết toàn chữ hoa là lỗi. Ba quy tắc còn lại mang tính khuyến nghị. Nội dung văn bản căn trái. Biểu trưng chính đặt trên bề mặt sáng và biểu trưng đảo màu trên bề mặt tối. Đường nét đứt nghĩa là thả vào đây.

**Try your design system in use** kết xuất bốn ví dụ từ bản sửa đổi hiện tại bằng **Render & check examples**. Chọn **Mode** và **Try your own text** cho tiêu đề, văn bản hỗ trợ và văn bản trang chiếu. Mỗi ví dụ báo những gì đã đo, với **See checks & sources** và **Download check report**. **Make reusable poster** tải xuống một `.lolly` có bố cục cố định và lựa chọn đầu vào đã phê duyệt. Các ví dụ ở trên thiết bị: chạy kiểm tra không xuất bản hay phê duyệt gì.

Bản dựng đi kèm thương hiệu cố định hiện cùng các quy tắc và ví dụ ở chế độ chỉ đọc, dưới *This brand is set*.

<!--i:eti-graduation-cap-->
## Kỹ năng

**Skills** liệt kê các [kỹ năng thương hiệu](/info/brand-skills.html) của hệ thống thiết kế đang hoạt động: tiêu chuẩn thành văn của thương hiệu, mỗi lĩnh vực một kỹ năng, cho con người và tác tử AI. Mỗi hàng cho biết lĩnh vực, trạng thái do thương hiệu đặt (**Draft** hoặc **Approved**), kỹ năng là công khai hay nội bộ và bản sửa đổi. Chọn một hàng để đọc kỹ năng cùng phạm vi được bao quát, so sánh các dòng trong kỹ năng với token của bạn: những gì Lolly kiểm tra, những gì xung đột, những gì khớp và những gì chỉ là hướng dẫn.

**Download skill (.zip)** ghi kỹ năng thành thư mục Agent Skills cho công cụ tác tử, với các liên kết danh mục trỏ tới Lolly này. **Copy as one file** đưa cùng văn bản vào clipboard cho cửa sổ trò chuyện. Hệ thống thiết kế chưa có kỹ năng riêng liệt kê một bản cơ sở mà Lolly viết từ token và quy tắc nội bộ mỗi lần bản cơ sở được đọc. Phòng đọc các kỹ năng và không bao giờ chỉnh sửa chúng.

<!--i:eti-upload-->
## Đưa thương hiệu vào

**Add from…** trên thanh mở bộ chọn hỏi bạn có gì, không hỏi định dạng gì:

- **Design tokens or a design file**: DTCG hoặc Tokens Studio JSON, dự án Penpot, tệp zip chứa các bộ token, gói hệ thống thiết kế Lolly, SVG, `DESIGN.md` hoặc thư mục trang thương hiệu.
- **PDF**: bộ trang chiếu hoặc tệp hướng dẫn, được đọc trên thiết bị này để lấy màu sắc, biểu trưng và kiểu chữ nhúng.
- **Logo or screenshot**: hình ảnh trở thành bảng màu được gợi ý, được đọc trên thiết bị này. Nó đọc màu sắc, không đọc kiểu chữ hay bố cục.
- **Saved web page**: một tệp HTML và các tệp CSS của nó, hoặc HTML hay CSS được dán vào, tối đa 20 tệp và 2 MB. Chỉ văn bản bạn cung cấp được đọc: tài nguyên liên kết không được tải và tập lệnh không chạy.
- **Font file**: TTF, OTF hoặc WOFF. Mở phòng Type, nơi cài kiểu chữ.
- **Website**: một trang, được đọc để lấy màu sắc và kiểu chữ. Thẻ này chỉ xuất hiện trên thiết bị có thể đọc trang và cho biết bộ đọc nào được dùng: ứng dụng trên thiết bị này, hoặc tiện ích trình duyệt trong thẻ nền, đăng nhập bằng tài khoản của bạn. Gõ URL chỉ điền vào ô; nhấn tải mới là đồng ý.

Chọn nguồn tệp thiết kế và thẻ tiếp theo liệt kê các định dạng được chấp nhận dưới dạng ô biểu tượng. Toàn bộ thẻ là một vùng thả. Bạn cũng có thể thả tệp vào studio.

![Thẻ nhập - các định dạng được chấp nhận nằm đầu tiên dưới dạng ô biểu tượng, và toàn bộ thẻ là một vùng thả](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- **Gói hệ thống thiết kế Lolly** (`.lolly`, hoặc `.zip` cũ) được cài trong một bước.
- Bản xuất **Penpot** (`.penpot`) mang theo các design token.
- Tệp **Design Tokens** (W3C DTCG) hoặc **Tokens Studio** (`.json`) mang theo các token. Mô tả yêu cầu người đọc bỏ qua chỉ dẫn, khẳng định có quyền hoặc yêu cầu chạy mã được bỏ ra, và quá trình nhập cho biết vị trí của mô tả đó.
- **SVG thuần** được quét để lấy các màu cho bạn chọn, màu đầu tiên trở thành màu chính của bạn.
- **`DESIGN.md`** (`.md`) đi tới **Try these colours** với các token như đã viết. Phần văn bản có thể được giữ làm kỹ năng thương hiệu nháp, và thẻ đánh dấu các dòng yêu cầu người đọc bỏ qua chỉ dẫn, khẳng định có quyền hoặc chạy mã. Các tác tử và trang thương hiệu không thấy bản nháp cho đến khi bạn nhấn **Keep this skill** trong phòng Skills, và kỹ năng được giữ vẫn ở dạng nội bộ.
- **Thư mục trang thương hiệu**, được chọn dưới dạng thư mục, thả vào hoặc nén zip, đi tới cùng bước xem xét. Mọi tệp được kiểm tra với `brand.json` của thư mục; chỉ một tệp không khớp cũng khiến toàn bộ thư mục bị từ chối. Quá trình nhập thêm các token. Logo và phông chữ ở lại trong thư mục.

::: warning Kiểm tra chỉ dẫn đọc từng dòng
Bộ kiểm tra loại chỉ dẫn khỏi các mô tả trong tệp token đọc từng dòng và bỏ sót những cách diễn đạt khác. Hãy đọc tệp từ người bạn không biết trước khi áp dụng token.
:::

Lolly đọc trang thương hiệu từ các tệp bạn cung cấp. Nó không tải nội dung từ địa chỉ của trang web khác.

### Tệp có từ riêng cho màu sắc

Tệp token hoặc `DESIGN.md` có thể dùng từ riêng cho màu sắc, chẳng hạn main, accent, supporting và tertiary. Khi Lolly tìm thấy những từ như vậy, phần xem xét liệt kê từng từ trước khi áp dụng bất cứ gì: từ đó, màu của nó trong mỗi giao diện, token gốc và cách hiểu Lolly gợi ý. Lolly chỉ dựa vào từ ngữ để gợi ý cách hiểu, đối chiếu với danh sách ngắn, không dùng mô hình. Từ ngoài danh sách được coi là từ riêng của thương hiệu, **By name only**. Bạn có thể đổi tên bất kỳ từ nào, nói mục đích của nó, gán cách hiểu khác hoặc bỏ chọn để giữ nó làm màu có tên.

**Install with these roles** ghi các vai trò; **Install without roles** cài tệp như khi nhận. Tệp không có những từ như vậy bỏ qua bước này. Tệp khai báo các vai trò riêng, chẳng hạn tệp do Lolly viết, hiện các vai trò như đã viết và cài nguyên trạng; bạn có thể chỉnh sửa sau trong phòng Colours. Terminal không có bước xem xét: `lolly system import` giữ bản ghi được khai báo và để từ của các tệp khác thành màu có tên.

### Xem xét nguồn tham khảo

Logo, ảnh chụp màn hình, trang web hoặc trang đã lưu mở **Try these colours**: một ví dụ theo các màu đề xuất, **Main colour** bạn có thể đổi và tên cho hệ thống mới. Một hộp cho biết việc áp dụng sẽ làm gì: **thay** cài đặt token đang hoạt động bằng bảng màu đã tạo và kiểu mặc định, **giữ** phông chữ cùng các tệp thư viện của bạn và hệ thống trước có thể được **khôi phục**. **Apply suggested settings** tạo điểm khôi phục, rồi áp dụng bảng màu sáng và tối. **Restore brand settings** có thể đưa cài đặt cũ trở lại. **Change reference** chọn nguồn khác.

::: details Những gì được đọc từ nguồn tham khảo và báo cáo ngữ cảnh thiết kế
**Palette, source details and individual choices** hiện những gì đã đọc, các tên phông chữ tìm thấy và độ tương phản của bản xem trước. Tên phông chữ chỉ là gợi ý; bạn cài kiểu chữ trong Type. Chi tiết nguồn có thể gồm kiểu chữ, khoảng cách, đệm và giá trị góc khi quan sát được, nếu không sẽ có nhãn **Not observed**. Trang đã lưu hoặc trang web được đọc bằng ứng dụng gốc báo các kiểu được khai báo, mà trang có thể không dùng. Tiện ích trình duyệt có thể báo các kiểu được đo từ mẫu phần tử đang hiển thị. Đây là những quan sát: không có gì được cài, và khoảng cách của nguồn không bao giờ thay khoảng cách riêng của bạn. **Choose individual items in the tray** giữ từng mục riêng. **Download design context** lưu báo cáo JSON về những quan sát, token đề xuất và thông tin nguồn (với SHA-256 của HTML hoặc CSS được cung cấp). Báo cáo không chứa văn bản thô của trang và không phải Content Credential được ký.
:::

Việc nhập PDF và tệp thiết kế giữ các điều khiển xem xét riêng. Mục trong **Tray** không đổi gì cho đến khi bạn thêm chúng trong phòng phụ trách loại nội dung đó. `#/start?source=<kind>` mở bộ chọn tại một nguồn (`file`, `pdf`, `image`, `font`, `url`, `page`), và `?import` mở danh sách đơn giản.

### Tìm và so sánh diện mạo

Mở **Find a look** từ Board hoặc từ danh sách hệ thống thiết kế trong Settings. Duyệt các hệ thống đã lưu trên thiết bị này và một vài ví dụ Lolly dùng lại được, rồi tìm theo tên, thẻ màu hoặc phông chữ được khai báo. **Closest to my current palette** sắp xếp theo độ tương đồng màu được đo, dùng phông chữ trùng khớp để phân thứ tự khi bằng nhau; đây không phải điểm chất lượng.

Nhấp một diện mạo để xem trước trong ngữ cảnh; xem trước không đổi gì. **Use this look** trên thẻ áp dụng diện mạo đó. Hệ thống đã lưu trở thành hệ thống đang hoạt động, không chỉnh sửa gì. Màu của ví dụ đi vào hệ thống thiết kế đang mở sau khi tạo điểm khôi phục như thường lệ. Logo, phông chữ và mọi thứ khác trong hệ thống mà ví dụ không định nghĩa giữ nguyên. **Compare looks** thêm hộp kiểm vào mỗi thẻ: chọn hai thẻ để so sánh cạnh nhau. **Restore brand settings** khôi phục diện mạo trước. Các hệ thống đã lưu có **Search tags** chỉnh sửa được dưới **Details and design context**. Các ví dụ là công thức màu gốc của Lolly, không có bộ sưu tập thu thập từ web và không cần tài khoản.

![Lolly so sánh Sunroom và Orchard cạnh nhau trước khi áp dụng một trong hai hệ thống màu.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

<!--i:eti-package-->
## Giữ và di chuyển hệ thống thiết kế của bạn

### Chuyển thương hiệu giữa các thiết bị

**Export** ghi một tệp **`LollyBrand-….lolly`**: token, phông chữ, logo và lựa chọn chủ đề của bạn, kèm bảng kê tính toàn vẹn được kiểm tra khi nhập. Các bản phát hành web trước 1.0.7 đặt tên tệp là `.zip`, và Lolly vẫn chấp nhận cách viết đó. **Tokens (.json)** ghi tài liệu design tokens thuần, không có phông chữ hay logo, cho kho mã, bước dựng hoặc công cụ token khác.

Để đưa trở lại, dùng **Add from… → Design tokens or a design file**, hoặc thả tệp vào studio. Đây là cách đồng nghiệp đưa thương hiệu cho bạn hoặc bạn mang thương hiệu sang bản cài đặt thứ hai, không cần tài khoản hay đám mây. [Làm việc với đối tác](/info/partners.html) trình bày những gì cần gửi thêm khi người nhận thương hiệu của bạn làm việc cho tổ chức khác. Để đưa thương hiệu vào từ dòng lệnh, xem [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** đóng gói các phông chữ bạn thêm thành RPM cài đặt được. Nếu bạn tự tải lên bất kỳ phông chữ nào trong số đó, Lolly yêu cầu bạn xác nhận quyền phân phối lại trước.

### Khôi phục cài đặt trước

Mở **More** trên thanh, chọn **Restore brand settings**, chọn điểm khôi phục có ngày và nhấn **Restore**. Thao tác này khôi phục màu sắc, cài đặt kiểu chữ và các token khác cho thương hiệu đang hoạt động; tệp phông chữ và hình ảnh giữ nguyên. Trước tiên Lolly lưu cài đặt hiện tại thành **Before restore**, để bạn có thể đảo ngược việc khôi phục ngay cả sau khi đóng trình duyệt. 20 điểm khôi phục gần nhất được giữ trên thiết bị này. Chỉnh sửa được thực hiện khi studio hiện **Saving…** vẫn còn sau khi tải lại, và một thẻ cho phép khôi phục các thay đổi chưa lưu xong.

### Phiên bản

Phiên bản đã xuất bản là **bản sao vĩnh viễn, có tên** được giữ trên thiết bị này. Nó không bao giờ thay đổi, nên công cụ hoặc liên kết ghim nó (bằng `designv`) tiếp tục vẽ cùng một thứ. Hệ thống có nội dung riêng của bạn liệt kê **Versions & publishing** trong menu **More** trên thanh; sau lần xuất bản đầu tiên, **Versions** xuất hiện cùng các phòng. `#/start?area=versions` mở Versions.

::: warning Phiên bản đã xuất bản tồn tại vĩnh viễn
Hiện chưa có chức năng xóa, và bảng nói rõ điều đó. Không thể hoàn tác việc xuất bản; có thể hoàn tác việc khôi phục. *Restore latest from this version* là chỉnh sửa thông thường, với **Undo** xuất hiện ngay.
:::

**Các mục bị xóa đứng đầu thẻ tương thích**, vì token bị xóa khiến công cụ ngừng hoạt động.

**Publish only** giữ một phiên bản mà không đổi những gì công cụ theo; **Publish and make active** cho các công cụ và ứng dụng theo phiên bản đó. **Follow the latest again** đưa mọi chỉnh sửa vào sử dụng ngay.

### Xuất bản trang thương hiệu

[Trang thương hiệu](/info/brand-page.html) là một địa chỉ cho con người và tác tử: trang chứa logo, màu sắc, kiểu chữ và ví dụ, với cùng thông tin trong các tệp đi kèm. **Publish a brand page**, dưới Versions & publishing, hiện trang trực tiếp và bên cạnh trang là:

- **Goes public**: mọi tệp, được nhóm lại, kèm dung lượng.
- **Held back**: những gì bị giữ lại và lý do. Logo chưa có giấy phép được ghi nhận bị giữ lại cho đến khi bạn đánh dấu tên logo. Tệp phông chữ cần giấy phép được ghi nhận cho phép chuyển tiếp, và trang hiện mẫu chữ dạng đường viền khi tệp bị giữ lại. Kỹ năng thương hiệu nội bộ không bao giờ xuất hiện.
- **What was checked**: các cặp màu cho mỗi colourway và chế độ, cùng các quy tắc nội bộ. Đây là số đo, không phải kết luận đánh giá.
- **In your words**: tuyên bố sử dụng và thông tin liên hệ. Trang hiển thị những gì bạn viết và Lolly không thêm giấy phép hay tuyên bố pháp lý. Một công tắc tắt dòng "Made with Lolly" ở chân trang.
- **On exports**: công tắc [ghi địa chỉ trang vào các bản xuất của hệ thống thiết kế này](/info/brand-page.html#lead-back-from-your-files). Công tắc tắt cho đến khi bạn bật, cần địa chỉ `https` và không đi cùng gói hay bản sao. Hệ thống thiết kế bị khóa không hiện công tắc, vì người quản lý quyết định.

**Download folder** lưu thư mục thành ZIP để bạn lưu trữ trên máy chủ ở nơi bạn chọn. Không có gì được công khai cho đến khi bạn đưa thư mục lên máy chủ. Trong terminal, `lolly system publish --out=<dir>` ghi cùng thư mục đó. Bản triển khai phục vụ các trang thương hiệu cũng có **Publish to** địa chỉ của nó: một lần nhấn rõ ràng, qua chuỗi phê duyệt của bản triển khai nếu có. Hệ thống thiết kế được quản lý chỉ xuất bản khi người quản lý cho phép.

### Kết nối tác tử

**Connect an agent**, ở cùng chỗ, cung cấp văn bản để dán và cho biết mỗi lựa chọn có thể làm gì:

- **`AGENTS.md`** trong dự án: các tác tử đọc tên và quy tắc của hệ thống. Nó không vẽ gì và không cần máy chủ.
- **Lolly's public server**: vẽ bằng Lolly Demo, bất kể bạn mở hệ thống nào ở đây. Không cần khóa.
- **Your instance**: vẽ bằng các hệ thống mà bản triển khai chứa và đọc token dịch vụ từ biến môi trường. Bảng cho biết tên biến và không bao giờ hiện token.

Khi không có máy chủ được lưu trữ nào vẽ bằng hệ thống của bạn, bảng nói rõ điều đó.

<!--i:eti-layers-->
## Quản lý các hệ thống thiết kế của bạn

Mở **Settings → Preferences → Design systems** để chuyển, thêm hoặc xóa hệ thống. **Open** chọn hệ thống và mở tại đây; **Make a new one** tạo hệ thống cục bộ và mở với ô tên sẵn sàng. Mỗi thời điểm có một hệ thống hoạt động cho toàn thiết bị. [Kiến trúc thương hiệu](/info/brand-architectures.html) giúp quyết định khi nào thương hiệu cần hệ thống thiết kế riêng.

**Hệ thống đến từ đâu.** Hệ thống do danh mục của bản triển khai cung cấp hiện **Came with this app**, hoặc **From this instance** trong ứng dụng kết nối với bản triển khai. Mở rộng **Catalogue source** để xem ai cung cấp, tài nguyên token và không gian tên, cùng phiên bản hoặc tổng kiểm tra đã biết; nếu làm mới thất bại, nội dung trong bộ nhớ đệm được gắn nhãn.

**Hệ thống được quản lý là chỉ đọc.** Hệ thống hiện **Managed by this instance** (hoặc **Managed by this app** trong ứng dụng máy tính không có bản triển khai) khi danh mục khóa hệ thống. Bạn có thể dùng và tải xuống hệ thống được quản lý. Mở hệ thống đó ở đây hiện ghi chú chỉ đọc với **Make an editable copy** và **Switch**, rồi các vai trò màu và token không có điều khiển chỉnh sửa. Các hệ thống cục bộ riêng của bạn vẫn chỉnh sửa được, kể cả khi hệ thống được quản lý có trước. Bản dựng với một thương hiệu cố định mở Lolly Design System Setup tại *This brand is set*, với token và quy tắc sử dụng của thương hiệu để đọc.

**Mọi hệ thống được cung cấp khác đều thuộc về bạn** để ẩn, chỉnh sửa và đặt lại, kể cả Lolly Demo và Lolly Starter trên lolly.tools. Chỉnh sửa hệ thống giữ tên của nó và đánh dấu hàng bằng **Edited here**. **Reset to original** trong menu bỏ các thay đổi trên thiết bị này. Bộ khởi đầu trống là ngoại lệ: thay đổi đầu tiên ở đó bắt đầu hệ thống thiết kế riêng của bạn, và Lolly hỏi tên một lần. [Sử dụng Lolly Demo](/info/lolly-demo-in-use.html#switch-to-your-own) cho thấy hệ thống riêng của bạn thay thế những gì.

### Xóa hệ thống thiết kế

Chọn **Remove** từ menu của hệ thống; hộp xác nhận cho biết hệ thống nào sẽ hoạt động sau đó. Các phiên đã lưu, tệp tải lên và nội dung dùng chung với hệ thống khác giữ nguyên.

Xóa hệ thống được cung cấp chỉ ẩn hệ thống: tài nguyên danh mục của nó vẫn còn, **Bring back** hiện lại hệ thống và nó tự trở lại nếu bạn xóa mọi hệ thống khác. Xóa bản sao đã nhập hoặc chỉnh sửa không xóa hệ thống được cung cấp, logo hay phông chữ của nó. Nếu bản sao đang hoạt động, hệ thống được cung cấp hoạt động trở lại. Xóa bản sao được lưu trữ trên máy chủ đang hoạt động chỉ xóa kết nối của bản sao đó; bản triển khai được chọn riêng vẫn được chọn.

::: details Thay đổi hệ thống thiết kế do máy chủ cung cấp
Thay đổi những gì máy chủ cung cấp là việc của quản trị viên: đơn vị vận hành đổi danh mục nguồn rồi triển khai lại, hoặc quản trị viên Lolly Work xem xét và áp dụng thay đổi trên máy chủ. Chỉnh sửa ở đây ở lại trên thiết bị, với một ngoại lệ. Trên bản triển khai Lolly Work cấp cho bạn `brand.edit`, hệ thống được quản lý cũng có **Edit for** bản triển khai đó, mở một bản sao để chỉnh sửa. **Send to** bản triển khai đó trong **Versions** gửi lại màu sắc, colourway, vai trò màu và địa chỉ trang thương hiệu. [Chỉnh sửa bản triển khai này từ studio](/info/work-design-system-administration.html#edit-this-instance-from-the-studio) trình bày những gì chỉnh sửa có thể thay đổi và cách bản triển khai phục vụ thay đổi đó. Xem [Xóa hệ thống thiết kế trong danh mục](/info/configuration.html#removing-a-catalogue-design-system) và [Cấu hình](/info/configuration.html#supplied-and-local-design-systems).
:::

<!--i:eti-code-->
## Dùng ngữ cảnh thiết kế ngoài ứng dụng

**Download design context** lưu tài liệu token, màu đã phân giải, họ phông chữ được khai báo, id tài nguyên, bằng chứng nguồn nếu được ghi nhận, phạm vi bao quát và quy tắc rõ ràng, không có tệp phông chữ hay bằng chứng sở hữu. Dòng lệnh đọc tệp mà không cần máy chủ: `lolly system import` đặt nó làm hệ thống thiết kế của terminal và `lolly system check` kiểm tra đầu vào Lolly Design với ngữ cảnh đã lưu. [Mang theo hệ thống thiết kế của bạn](/info/cli.html#bring-your-design-system) trình bày việc nhập và [Hệ thống thiết kế mà lệnh dùng](/info/cli-decks.html#which-design-system-a-command-uses) trình bày việc kiểm tra. Máy khách MCP đọc cùng bản mô tả từ `lolly://design-context` ([Máy chủ MCP](/info/mcp.html)).

<!--i:eti-map-pin-->
## Tiếp theo nên xem gì

- **[Sử dụng Lolly](/info/using.html)**: các công cụ, lưu, chia sẻ và Assets.
- **[Kiến trúc thương hiệu](/info/brand-architectures.html)**: cách các bộ phận, sản phẩm, thương hiệu được bảo trợ, khách hàng và mùa tương ứng với hệ thống thiết kế, colourway và bộ nhận diện logo.
- **[Làm việc với đối tác](/info/partners.html)**: chia sẻ thương hiệu với đối tác và làm việc theo thương hiệu bạn được cung cấp.
- **[Trang thương hiệu](/info/brand-page.html)**: xuất bản hệ thống thiết kế tại một địa chỉ, thành bộ tài liệu báo chí và bộ tài liệu cho tác tử.
- **[Design Tokens](/info/design-tokens.html)**: mô hình token dùng để viết thương hiệu của bạn.
- **[Xuất một tệp](/info/exporting.html)**: đơn vị in, CMYK và các định dạng mà thương hiệu của bạn được kết xuất thành.
