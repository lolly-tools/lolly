# Lolly Design System Setup

<a id="design-system-setup"></a>

Logo, màu sắc và kiểu chữ của bạn thuộc về một nơi, để mọi công cụ, trang và bản xuất đều vẽ bằng chúng. Nơi đó là **Lolly Design System Setup**, tại `#/start`.

Bắt đầu với bất cứ gì bạn có. Thả một logo vào và Lolly đọc màu của nó. Chọn một kiểu chữ, hoặc thả tệp phông chữ mà công ty bạn có giấy phép. Mỗi thay đổi hiện khắp ứng dụng ngay. Logo, phông chữ và token của bạn ở lại trên thiết bị này. Chọn một Google Font là bước duy nhất với ra ngoài: Lolly hỏi trước, rồi tải họ phông chữ một lần.

Khi nó trông đúng, đặt tên cho hệ thống thiết kế và nhấn **Export**. Bạn nhận một tệp `.lolly` để giữ, để mở trên thiết bị khác hoặc đưa cho đồng nghiệp. [Lolly Settings](/info/dashboard.html#design-system) hiện hệ thống đang dùng ở chế độ chỉ đọc, và bìa của nó liên kết về đây để chỉnh sửa.

## Biến nó thành của bạn trong năm phút

::: timeline
- <!--i:upload--> **Thả logo của bạn** vào vùng thả trong **Logos**. Lolly đọc hình dạng và màu sắc của nó.
- <!--i:palette--> **Dùng các màu này.** Màu chính của logo trở thành màu primary, và một màu trung tính tối từ logo trở thành màu văn bản.
- <!--i:font--> **Chọn một kiểu chữ** trong **Type**: một Google Font, hoặc tệp phông chữ bạn sở hữu.
- <!--i:pentool--> **Đặt tên cho hệ thống.** Chỉnh sửa đầu tiên tạo một hệ thống thiết kế của riêng bạn, và Lolly hỏi tên một lần.
- <!--i:download--> **Export** ghi cả hệ thống thành một tệp `LollyBrand-….lolly`.
:::

Thanh ngang đầu studio mang tên hệ thống thiết kế, và tên là một ô bạn có thể đổi bất cứ lúc nào: **Enter** giữ tên mới và **Escape** đặt lại tên cũ. Khi chỉnh sửa đầu tiên hỏi **What is this design system called?**, các chữ từ logo của bạn được điền sẵn nếu logo viết rõ chúng. **Save name** giữ tên; **Not now** giữ một tên tạm cho đến khi bạn gõ vào thanh. Tên gắn nhãn hệ thống trong Settings và khi bạn chuyển, và trở thành tên tệp mà **Export** ghi.

## Các phòng

Studio là một tập các phòng không theo thứ tự cố định: không gì được đánh số và không gì phải chờ gì khác. Trên máy tính, các phòng nằm trong một dải dưới thanh. Trên điện thoại, chúng chuyển xuống một thanh ở mép dưới, nơi ngón cái với tới, với phòng đang mở được cuộn vào tầm nhìn; bảng màu và khay nổi lên phía trên thanh đó, và thanh tránh sang bên khi bạn gõ. Với bàn phím, Tab tới dải đó một lần, còn phím mũi tên, Home và End di chuyển từ phòng này sang phòng khác.

![Thanh của studio và các phòng: Board, Colours, Type, Logos, Tokens, Files, Rules và Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Phòng | Bạn làm gì ở đó | Khóa liên kết |
|---|---|---|
| **Board** | Xem hệ thống chứa gì, với một cửa vào từng phòng | `overview` |
| **Colours** | Thêm màu, gán vai trò, tạo sắc độ và bảng màu | `color` |
| **Type** | Chọn bốn kiểu chữ mà ứng dụng, công cụ và mọi bản xuất đọc | `type` |
| **Logos** | Đặt dấu hiệu của bạn ở mọi hướng và cách xử lý | `logos` |
| **Tokens** | Bo góc, khoảng cách, đổ bóng và mọi giá trị có tên khác | `tokens` |
| **Files** | Các tệp ảnh, âm thanh và chuyển động mà thương hiệu của bạn giữ | `catalogue` |
| **Rules** | Các quy tắc thương hiệu của bạn áp dụng, được kiểm tra trên ví dụ thật | `usage` |
| **Skills** | Các tiêu chuẩn thành văn của thương hiệu cho con người và tác tử, để đọc và tải xuống | `skills` |

Liên kết tới một phòng bằng `#/start?area=<key>`. Phòng Files giữ khóa `catalogue`, Board giữ `overview` và Rules giữ `usage`, vì khóa phòng là cam kết vĩnh viễn, và `?tab=` vẫn hoạt động như bí danh cũ. Khóa không xác định mở Board.

**Thanh** chứa các hành động cho cả hệ thống thay vì một phòng. **Add from…** đưa một thương hiệu vào ([Bring a brand in](#bring-a-brand-in)), và **Tray** giữ những gì một lần quét tìm thấy mà bạn chưa thêm. **Export** ghi hệ thống thành một tệp, còn **More** chứa **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** và **Design systems**, mở danh sách trong Settings nơi bạn chuyển ([Keep and move your design system](#keep-and-move-your-design-system)). Mỗi cái xuất hiện khi có gì để nó tác động. Trên điện thoại, **Add from…** chuyển vào **More** và **Export** hiện dưới dạng biểu tượng của nó.

## Board

Khi chưa chọn gì, Board đưa ra bốn cách bắt đầu. **Start from a reference** mở bộ chọn nguồn cho logo, ảnh chụp màn hình, trang web hoặc tệp thiết kế, còn **Pick a colour**, **Choose a face** và **Add a logo** mở trực tiếp các điều khiển đó. Mở một cái không ghi gì, và **Explore the tools** có sẵn từ đầu.

Khi có thứ gì là của riêng bạn, Board hiện những gì bạn có, với số lượng của riêng bạn dẫn đầu. Colours cho số lượng màu, với `· N starter` mờ nơi màu kế thừa hiện ra; dải của nó đặt màu của bạn trước, rồi một đường mảnh, rồi các màu starter đã mờ. Colourways hiện mỗi colourway thành một ô nhỏ bằng màu dẫn của nó. Type đọc theo vai trò và đặt mỗi họ chữ bằng chính kiểu chữ của nó (*Inter for headings*, với *Starter for the rest* ở dòng dưới). Logos cho biết bao nhiêu ô đã điền (hoặc **Not set**), Tokens hiện bán kính bo góc và Files nói **Nothing yet** khi thư viện còn trống. Mỗi khối mở phòng của nó.

Một hệ thống thiết kế đi kèm ứng dụng và chỉnh sửa được, như Lolly Demo, có tất cả những điều đó ngay từ đầu: Board hiện màu, colourway, kiểu chữ và dấu hiệu của nó, với thẻ **Came with this app** bên cạnh tiêu đề.

### Starter và của bạn

**Starter** là từ chỉ bất cứ thứ gì đi kèm ứng dụng thay vì do bạn chọn. Một bản cài mới không mang màu nào, chỉ một dải trung tính từ mực đến giấy, để bề mặt, văn bản và đường mảnh kết xuất được trước khi ai quyết định gì. Cùng từ đó đánh dấu vật liệu kế thừa ở mọi phòng.

::: cols
## Starter

- Đi kèm ứng dụng: các màu trung tính mực-đến-giấy, các kiểu chữ starter, bán kính bo góc mặc định.
- Mờ, với thẻ **Starter** và không nhuộm màu.
- Không tính là màu của bạn. Các màu trung tính nằm trong **Tokens** dưới dạng **Neutrals · starter · 9**, và **Open** hiện chúng trong Colours như một nhóm gập (`#/start?area=color&group=neutral`).
- Một vai trò đứng trên màu starter đọc *"Starter Paper stands in"*, với **Choose…** trên bộ chọn của nó.

## Của bạn

- Do bạn chọn hoặc cài.
- Đủ độ đậm, và một thẻ nhuộm màu nơi bạn cài một kiểu chữ.
- Được đếm trên Board và trong Tokens.
- Một vai trò theo vai trò khác đọc **↳ follows Primary** thay vì lặp lại tên của primary.
:::

Vật liệu kế thừa không bao giờ được vẽ với viền nét đứt, vì ở đây viền nét đứt nghĩa là đích thả.

## Logos

Đổ thư mục dấu hiệu của bạn vào vùng thả ở trên cùng: **"Drop marks here, or choose several at once"** nhận bao nhiêu tệp cũng được. Mỗi tệp được đọc hình dạng và mực, rồi chờ dưới **Waiting for a slot** như một chip nói nó trông như gì, ví dụ *"Looks like the Horizontal primary"*, kèm phép đo nó đã dùng và nút **Place** (**Replace** nơi ô đã điền). Nơi không chắc, chip nói vậy và đưa ra **Change slot**, liệt kê cả tám. Không có gì được đặt cho đến khi bạn nhấn.

Một dấu hiệu có lề trống thừa được đề nghị cắt tỉa trước; trả lời hoặc nhấn Escape và bản gốc vào nguyên vẹn. Nơi một dấu hiệu có thể lấp một ô anh em trống, phòng đề xuất phiên bản **mono** hoặc **reverse** suy ra dưới dạng chip đánh dấu *Generated*.

Mỗi dấu hiệu kết thúc trong một lưới tám ô tùy chọn, mỗi ô cho một **orientation** và **treatment**:

- **Orientations:** Horizontal (chữ và biểu tượng trên một hàng) và Vertical (xếp chồng, cho không gian vuông và cao).
- **Treatments:** Primary, Primary reverse (cho nền tối), Mono (một màu) và Mono reverse.

Nhóm chưa có dấu hiệu nào gập thành một dòng; mở để xem các ô. Nhấp một ô để thêm PNG, SVG, JPEG hoặc WebP, hoặc nhấp ô đã điền để thay dấu hiệu. Mọi thứ ở lại trên thiết bị này.

![Các ô logo với Horizontal và Vertical đã mở: mỗi treatment là một ô riêng, và mọi ô đều tùy chọn](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** là các dấu hiệu mà thương hiệu của bạn gọi bằng tên riêng, như biểu tượng, huy hiệu hoặc favicon.
- **More identities.** Một thương hiệu con, sản phẩm hay sự kiện có thể có bộ đầy đủ của riêng nó: **+ Add another logo** và đặt tên cho bộ. Bộ chính của bạn là "Your logo". [Brand architectures](/info/brand-architectures.html) cho thấy khi nào một danh tính logo là khối đúng.
- **Lolly đọc màu của logo.** Một thẻ dưới vùng thả, và lần nữa ở đầu Colours, liệt kê màu của logo và hỏi **Which is the main colour?**, với màu mạnh nhất đã được chọn sẵn (không bao giờ là màu trắng nó được xuất trên đó). **Use these colours** thêm chúng vào bảng màu, đặt màu chính làm primary và, khi logo có màu trung tính tối đọc được trên giấy, đặt nó làm màu văn bản. **Not now** để chúng trong Tray. Trên bản cài mới, câu trả lời khả dĩ nhất được áp dụng ngay, và thẻ đưa ra **Undo** hoặc màu chính khác. SVG cho màu chính xác; PNG, JPEG hoặc WebP cho các màu phủ một phần đáng kể của dấu hiệu.

## Colours

Phòng lớn lên cùng hệ thống thiết kế: lần đầu ghé là một quyết định, và phần còn lại đến cùng với bảng màu.

### Màu đầu tiên

Một hệ thống chưa có màu riêng hiện các màu trung tính của bản khởi đầu, mở trong nhóm riêng của chúng, và ở đầu phòng có một ô dán và thả viền đứt: một chip lớn và một ô. Thả một ảnh hoặc một danh sách màu vào bất kỳ đâu trên ô, và Lolly đọc các màu từ thứ bạn đã thả.

- **Chip là bộ chọn.** Nhấn **Pick a colour** và thẻ OKLCH của studio mở ra, điền sẵn theo thứ ô đang giữ: trước hết là tên và mã hex của màu, rồi các không gian màu, vòng màu, bốn núm xoay và alpha dưới **Fine-tune**, cùng **Cancel** và **Add colour** ở chân thẻ. Không có gì vào hệ thống cho đến khi bạn nhấn **Add colour**.
- **Ô nhận mọi ký hiệu màu**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` hoặc một tên màu. Dán một danh sách và nó thành một hàng chip để thêm từng cái hoặc dùng **Add all**.
- **Hai cách nữa để đưa màu vào.** **Pick a colour from the screen** dùng công cụ lấy màu nếu trình duyệt có, và **Take colours from an image** đọc một ảnh chụp màn hình hoặc ảnh trên thiết bị này.
- **Add không bao giờ bị vô hiệu.** Khi ô trống, nó mở bộ chọn; văn bản mà nó không đọc được sẽ có một dòng dưới ô nói rõ điều đó.

Màu đầu tiên của bạn trở thành **primary**, và một chip xác nhận, như *"Primary is now Vivid Violet"*, với **Fine-tune** để chỉnh màu.


### Khi bảng màu lớn dần

Màu của bạn nằm cạnh bản xem trước **In context** trên màn hình rộng, và phía trên nó trên màn hình nhỏ hơn. Bản xem trước hiện một áp phích, biểu đồ hay thẻ giao diện trong bảng màu của bạn. Màu của bản khởi đầu ở trong nhóm gập riêng của chúng, nhóm này gập lại khi hệ thống đã có màu riêng, và ô dán và thả trở thành một hàng gọn. Export nằm ở **Export** trên thanh và trong phòng Tokens, nên phần đầu phòng không có nút nào.

![Phòng Colours trên Lolly Demo: bảng màu trong các nhóm gập, mỗi màu có tên và mã hex, và bản tải bảng màu ở phần đầu](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Phòng Colours trên Lolly Demo sau khi thêm một màu: bảng Colour roles, rồi chip của màu mới với Use as Lead? và Fine-tune, cạnh bản xem trước bố cục trực tiếp](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Vai trò màu: các màu được gọi là gì

Hệ thống thiết kế nói các màu của nó được gọi là gì và mỗi màu dùng để làm gì, và Lolly đọc điều đó. **Colour roles** nằm ở đầu phòng Colours. Trên màn hình rộng, **In context** dùng chung chế độ xem, nên một thay đổi hiện ngay trên áp phích, biểu đồ và thẻ giao diện khi bạn thực hiện.

![Bảng Colour roles trên Wefthouse, một thương hiệu dệt may hư cấu, bằng chính từ của nó: các chip colourway Indigo, Madder và Weld, rồi Main, Accent, Supporting và Tertiary, mỗi mục có màu sáng và màu tối, được đọc là màu chủ đạo, màu đối tác và chỉ theo tên, còn Background, Text, Quiet text và Hairlines được liệt kê dưới bảng như các cách đọc mà không vai trò nào đảm nhiệm](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

Bảng có bốn cột, và trên điện thoại mỗi hàng thành một thẻ giữ màu sáng và màu tối cạnh nhau:

| Cột | Nó chứa gì |
|---|---|
| **Role** | Từ riêng của hệ thống thiết kế, bạn có thể sửa tại chỗ, và một dòng nói màu dùng để làm gì |
| **Light** và **Dark** | Màu ở giao diện đó cho colourway đã chọn, kèm tên hoặc giá trị và độ tương phản |
| **Lolly reads this as** | Công cụ làm gì với vai trò, bằng chính từ của Lolly |

**Cách Lolly đọc một vai trò.** Mỗi cách đọc thuộc về một vai trò, nên chọn một cách đọc mà vai trò khác đang giữ sẽ chuyển cách đọc đó về đây. Lolly không bao giờ suy ra ý nghĩa từ một từ.

| Cách đọc | Điều theo sau |
|---|---|
| **Lead colour** | Hình lớn, nút, màu mà công cụ dùng làm chủ đạo |
| **Partner colour** | Màu thứ hai mà công cụ tìm đến |
| **Background** | Nằm sau mọi thứ khác |
| **Text** | Tiêu đề và văn bản chính |
| **Quiet text** | Chú thích và chữ nhỏ |
| **Hairlines** | Đường kẻ, viền và đường phân cách |
| **By name only** | Không công cụ nào tự chọn vai trò này. Nó được đưa ra trong mọi ô màu và trong Design, nơi lựa chọn vẫn được liên kết, nên nó theo colourway |

Một cách đọc mà không vai trò nào đảm nhiệm vẫn giữ như hệ thống thiết kế định nghĩa, và phòng liệt kê chúng dưới bảng. Một vai trò có cùng id với cách đọc, như vai trò tên Primary, chính là cách đọc đó và không thể di chuyển.

**Giá trị.** Nhấn một giá trị để chọn màu cho vai trò đó, ở giao diện đó, trong colourway đã chọn. **Same as light** làm giá trị tối theo giá trị sáng cho đến khi bạn chọn màu riêng. Chip **Aa** cho thấy chữ mà Lolly chọn để đặt trên màu, và dòng dưới giá trị nói chữ đó đọc ra sao, theo từng giao diện: **Text reads well**, **Large text only** hoặc **Hard to read as text**. Điều đó nói về chữ đặt trên màu và không nói gì chống lại chính màu, màu vẫn có thể dùng tốt cho hình và vùng lớn. Một vai trò chỉ đọc theo tên hiện cùng các từ nhưng không có màu cảnh báo, vì không công cụ nào tự đặt chữ lên nó. Các con số đằng sau các từ, APCA trước và WCAG sau, nằm trong chú giải và trong bộ chọn. **Own text colour** đánh dấu một giá trị mà tệp của nó nêu màu chữ, và màu đó được giữ. **Copied** đánh dấu một giá trị đến từ colourway khác hoặc từ màu đối tác mà chưa ai chọn; **Keep this colour** trong bộ chọn chốt giá trị.

**Điểm xuất phát.** Một hệ thống thiết kế chưa có vai trò riêng hiện các từ hiện nay: Primary, Secondary, Surface và Text. Không có gì được ghi cho đến khi bạn đổi một cái. **+ Add a role** đưa ra **Primary, Secondary** hoặc **Main, Accent, Supporting, Tertiary** làm gợi ý, hoặc bất kỳ từ nào bạn gõ, kèm cách đọc mà mỗi từ sẽ nhận. Hai từ đầu thành màu chủ đạo và màu đối tác. Các công cụ vẫn vẽ cùng các màu, và trên hệ thống có một màu chủ đạo, colourway đầu tiên được đặt tên theo màu đó.

**Đổi tên, sắp xếp lại, gỡ bỏ.** Đổi tên chỉ đổi từ, nên mọi thứ dùng vai trò vẫn hoạt động. Kéo một vai trò bằng tay nắm của nó, hoặc nhấn Space trên tay nắm, dùng phím mũi tên rồi nhấn Space để thả. **Remove** cho biết còn gì đang dùng vai trò. Khi công cụ đọc nó, **Remove and keep those colours** để mỗi cách đọc giữ màu mà nó vẽ hiện nay. Một quy tắc nội bộ, một nhóm hướng dẫn, một ô của công cụ hoặc một token khác dùng vai trò sẽ giữ nó cho đến khi cách dùng đó đổi. Một tài liệu Design đã lưu cũng có thể dùng vai trò theo tên, và Lolly không thấy điều đó từ tệp token: tài liệu nào làm vậy sẽ báo màu là chưa phân giải.

**Một tệp viết tay.** Các màu mà tệp token giữ nhưng không vai trò nào khai báo được liệt kê dưới **In this file, with no role yet**, mỗi màu có một ô cho một từ và **Make a role**. Chúng vẫn hoạt động theo tên dù thế nào. Một token có chữ số trong tên không thể là vai trò, nên nó ở lại trong tệp và vẫn hoạt động theo đường dẫn của nó. Một bản ghi trong tệp không hợp lệ sẽ hiện bảng không có điều khiển và nói lý do.

**Phần còn lại của phòng nói cùng các từ.** Các chip, hàng **Use as** của mẫu màu và nhóm **Colour roles** của bảng màu đều dùng từ của hệ thống thiết kế, và ô của một vai trò màu mở giá trị của nó. Các tệp xuất không ghi gì mới về vai trò: màu trong bản kết xuất đổi vì token đã đổi.

**Các từ đi đâu.** Các từ và mô tả đi cùng hệ thống thiết kế. Agent đọc chúng trong bản tóm tắt thiết kế, `lolly://tokens` và `AGENTS.md` của trang thương hiệu, terminal hiện chúng trong `lolly system status`, và một trang thương hiệu liệt kê chúng trong `brand.json` và đo một cặp tương phản cho mỗi vai trò. Mỗi định dạng xuất giữ những gì nó có chỗ chứa: tệp DTCG và Tokens Studio giữ tất cả, `DESIGN.md` giữ các từ và cách đọc, còn chủ đề PowerPoint chỉ giữ thứ tự của thương hiệu. [Colour roles in other formats](/info/design-tokens.html#colour-roles-in-other-formats) có danh sách đầy đủ. Các từ luôn được trích như dữ liệu của hệ thống thiết kế, không bao giờ được đọc như chỉ dẫn.

**Nơi một màu được chọn.** Mọi ô màu trong công cụ và trong Lolly Design đều mở đầu bằng các vai trò của hệ thống thiết kế, theo thứ tự riêng của nó, với mỗi từ và công dụng của màu được hiển thị. **Aa** cạnh một vai trò chọn màu đặt trên vai trò đó. Phần còn lại theo sau dưới **Other colours**, không gồm bản sao riêng của colourway, các màu trên nền và mọi cách đọc mà một vai trò đã đảm nhiệm. Một lựa chọn vẫn liên kết với vai trò và theo colourway, ô luôn hiện từ đó dù colourway nào được chọn, và Settings cùng Tokens cũng dùng từ đó. Một hệ thống thiết kế không có vai trò giữ lưới mẫu màu như xưa nay.

### Mọi màu mà công cụ đọc

Khi **Colour roles** đóng, các quyết định đầu tiên mở đầu phòng dưới dạng chip, mỗi chip hiện màu đóng vai trò và tên của nó. Trên hệ thống không có từ riêng, đó là **Primary**, **Secondary**, **Surface** và **Text**. Nhấn một chip để chọn màu từ các mẫu màu của chính bảng màu. **Every colour a tool reads**, ở chân **Colour roles**, có dải đầy đủ.

Dải hiện bảy màu mà một công cụ có thể đọc: Primary, Secondary, Surface, Text, Muted, Edge và On primary, bằng từ riêng của hệ thống thiết kế nếu có. Mỗi màu đóng cùng một phần trong mọi công cụ và bản xuất. Không màu nào bắt buộc phải đặt (ba màu rời đã là một hệ thống tốt), màu nào cũng có thể giữ một vị trí và phần hiển thị nói chữ đọc ra sao, đo trên nền, APCA trước. Mỗi hàng hiện một màu riêng ở độ đậm đầy đủ, một màu khởi đầu đang thay thế, hoặc **↳ follows Primary**.

On primary được suy ra từ primary, hiện **Derived** và không có bộ chọn. Công tắc **Light** và **Dark** bên cạnh, và công tắc cạnh **In context**, chọn giao diện mà dải, bảng màu và bản xem trước hiển thị.

Màu nhấn của chính ứng dụng theo hệ thống thiết kế theo mặc định. Đó là cài đặt **Interface follows the design system** trong **Settings → Appearance**; tắt cài đặt để khung ứng dụng trung tính, còn công cụ, canvas và bản xuất theo hệ thống thiết kế dù thế nào.

**Colourways.** Một hệ thống thiết kế có thể giữ nhiều màu chủ đạo, mỗi màu được chọn theo từng sản phẩm. Hàng **Colourways** ở đầu **Colour roles** hiện một chip cho mỗi colourway, với **Default** trên cái chuẩn. **+ Add** bắt đầu một colourway mới từ một trong các màu của bảng màu. Chọn một chip, và bảng, dải, bảng màu cùng các bản xem trước hiện colourway đó; colourway đã chọn có thể được đổi tên, nhân đôi, đặt làm mặc định hoặc gỡ bỏ. Trên hệ thống có colourway, mỗi colourway cần primary và secondary riêng, và surface riêng khi các colourway nhuộm nền, nên các vai trò đó vẫn được đặt trong trình sửa mẫu màu. [Add colourways to a design system](/info/colourways.html#add-colourways-to-a-design-system) có các bước và định dạng token, còn [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) cho thấy colourway trên công việc thật.

### Tìm thêm màu

Ba công cụ dựng trên primary của bạn. Hai công cụ đầu chỉ gợi ý, còn công cụ thứ ba thay bảng màu sau khi bạn xem lại thay đổi.

::: cols
## Khám phá sắc độ & hòa sắc

Chọn một **Starting colour**, một **Scheme** (Mono, Complement, Analogous hoặc Triad) và số **Shades** (3 đến 20, mặc định 5). **Fine-tune** đặt cường độ UI, tương phản và chữ trên thương hiệu. Nhấp một sắc độ để thêm, hoặc **Add 5 shades** cho một nhóm. Màu và vai trò của bạn giữ nguyên.

## Tìm màu phù hợp

Chọn một **Harmony**: Complementary, Adjacent, Triad, Tetrad hoặc Analogous (với **Accents** từ 2 đến 5 và **Angle** từ 10° đến 45°). Mỗi ứng viên có một tên được tạo và **+ Add**, một lần nhấn cho mỗi màu.

## Dựng lại toàn bộ bảng màu

Thay bảng màu từ một màu khởi đầu, sau khi xem lại điều gì đổi và điều gì ở lại. Một điểm kiểm tra được lập trước, và **Undo** được đưa ra sau đó.
:::

Cả ba dùng cùng phép toán màu cảm thụ (OKLCH) như engine. Trong **Explore shades & harmonies**, các hàng **Primary**, **Neutral** và **Secondary** hiện các sắc độ gợi ý, và **Theme preview** hiện ví dụ sáng và tối kèm chỉ số tương phản.

![Ba nhóm sắc độ được gợi ý, với các điều khiển thêm riêng lẻ và một Theme preview tách biệt](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Các màu nhấn được tạo ra, mỗi màu có mẫu màu, tên tự sinh, mã hex và một nút Add](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Chốt một bảng màu đã tạo

Mở **Rebuild the whole palette…** và nhấn **Preview full rebuild**. Phần xem lại đếm bao nhiêu vai trò giữ nguyên như bạn gán, bao nhiêu màu của riêng bạn được giữ và bao nhiêu đường cong sắc độ, khóa in, sắc độ ẩn và điểm dừng chuyển sắc được neo lại hoặc giữ. **Apply rebuilt palette** xác nhận; **Cancel** không đổi gì. Sau đó thẻ đưa ra **Undo** với tiêu điểm trên đó, và điểm kiểm tra lập trước khi hoán đổi khôi phục cả hệ thống.

Một hệ thống có colourway giữ mọi colourway qua việc dựng lại. Colourway chuẩn theo màu khởi đầu mới, và mọi colourway khác giữ màu, tên, thứ tự và cài đặt của riêng nó. Phần xem lại liệt kê colourway nào theo và colourway nào giữ màu. Lolly không dựng lại một hệ thống mã hóa colourway theo cách nó không chỉnh sửa được; thẻ nói lý do, và không gì thay đổi.

### Các phần dành cho chuyên gia

Bốn phần gập nằm dưới bản xem trước và các vai trò. Mỗi phần mở trực tiếp bằng `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`), mô tả ở trên.
- **Shade curves** (`focus=curves`) định hình lại một dải từng điểm, với các đường cong độ sáng, độ bão hòa và sắc độ riêng (L / C / H) và các sắc độ vẽ lại khi bạn kéo.
- **Contrast** (`focus=contrast`): **Contrast-lock** chỉnh lại tông một dải để đạt mục tiêu APCA so với nền bạn chọn, và **Rotate hue** xoay cả dải quanh bánh xe.
- **Print** (`focus=print`) đặt primary trở thành gì trên máy in: giá trị tự động, bản dựng CMYK được ghim hoặc mực spot có tên.

### Bảng màu và từng ô màu

Bảng màu liệt kê các màu của bạn trong các nhóm gập, mỗi nhóm có **+ Add** riêng. Tạo và đổi tên nhóm tùy ý. Một vai trò không bao giờ tạo ô thứ hai: ô mà một vai trò trỏ tới mang tên của vai trò, chẳng hạn **Primary**. **Colour chart** bên dưới các ô cho thấy cùng các màu trên **Wheel** OKLCH (kéo một chấm để đổi màu, nhấp vào chỗ trống để thêm một mẫu) và biểu đồ **Gamut**, cho thấy dải hiển thị được kết thúc ở đâu. `#/start?area=color&focus=chart` mở thẳng biểu đồ.

![Bảng bảng màu, mọi nhóm có thể gấp lại, với bản tải bảng màu ở phần đầu](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Bánh xe OKLCH - góc là sắc độ (hue), khoảng cách ra ngoài là độ bão hòa (chroma) và các màu xám chạy theo một dải độ sáng dọc theo cạnh bên](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Nhấp một ô màu để mở trình chỉnh sửa của nó:

- **Rename** mẫu màu.
- **Set the colour** trên thanh trượt OKLCH, hoặc trong **Hex**, **HSL**, **RGB** hay **CMYK**. Ô giá trị đọc và ghi theo không gian đang dùng. CMYK ở đây đặt màu trên màn hình bằng chuyển đổi; để chốt mực chính xác, dùng **Print substitutes**.
- **Stored as** chọn cách lưu mẫu màu: **LCH** (mặc định, theo cảm nhận và gam rộng), Hex, RGB hoặc HSL.
- **Use as** gán trực tiếp một vai trò cho mẫu màu, bằng từ riêng của hệ thống thiết kế nếu có. Nhấn lại một vai trò đang sáng để xóa vai trò.
- **Print substitutes** (gập): khóa **CMYK** từ **Auto** sang giá trị mực chính xác, hoặc đặt một **Spot colour** với **Name** (như `PANTONE 186 C`), một **Book** tùy chọn và một **Finish** cho ép kim, dập nổi, dập chìm, phủ vecni cục bộ, phủ mềm hoặc bế, bấm nếp hay đục lỗ. Máy in dùng các khóa này khi bạn xuất PDF hoặc TIFF CMYK; xem [Colour profiles](/info/exporting.html#colour-profiles).
- **In other spaces** (gập): một giá trị cho mỗi không gian màu, được suy ra hoặc do bạn tự đặt, và giá trị tự đặt thắng khi xuất.

**Xóa một ô màu** là an toàn. Các sắc độ suy ra và vai trò chủ đề bị ẩn, nên không gì đọc chúng bị hỏng, còn màu bạn thêm thì bị gỡ.

::: details Làm việc với nhiều ô màu
Mỗi ô màu có một tay kéo. Kéo để sắp xếp lại trong nhóm, hoặc đặt tiêu điểm vào tay kéo, nhấn Space, dùng phím mũi tên và nhấn Space lần nữa để thả; Escape hủy. Trên điện thoại, bảng màu hiện bốn màu một hàng và các tay kéo xuất hiện trong chế độ Select, thay vì một hàng dưới mỗi màu. Để chuyển màu giữa các nhóm, dùng điều khiển **Group** của trình chỉnh sửa hoặc chọn nhiều ô và dùng **Move to**.

Việc chọn không cần công tắc riêng. Thanh và các hộp kiểm xuất hiện cùng ô được chọn đầu tiên và biến mất cùng ô cuối cùng.

- **Kéo trên khoảng trống** để vẽ hình chữ nhật; mọi ô nó chạm vào gia nhập vùng chọn, xuyên nhóm. Một phần gập không thêm gì.
- **Shift-nhấp** lấy một dải theo thứ tự đọc, **Cmd/Ctrl-nhấp** bật tắt một ô, và nhấp thường mở trình chỉnh sửa.
- Mỗi tiêu đề nhóm có **Select all**, và **Cmd-A** khi một ô có tiêu điểm lấy mọi màu bạn sở hữu, không bao giờ lấy màu starter.
- Lưới có một điểm dừng tab: mũi tên di chuyển, Shift-mũi tên mở rộng, Space bật tắt, Delete gỡ và Escape xóa chọn. Để nhích một kênh, nhấn `l`, `c` hoặc `h` trước.
- Trên màn hình cảm ứng, nhấn giữ một ô để bắt đầu chọn, rồi chạm để thêm.

Thanh đọc **{n} selected**, rồi **Move to**, **Give a role** (mỗi màu nhận vai trò kế tiếp lần lượt), **Download** (vùng chọn theo bất kỳ trong sáu định dạng bảng màu), **Duplicate** (một bản sao mỗi ô, đặt sau bản gốc), **Copy values** và **Delete**. Một bản sao mở thẳng trong trình chỉnh sửa; nhiều bản vẫn được chọn. Một lần Cmd/Ctrl-Z hoàn tác cả hành động hàng loạt.
:::

### Gradient

Bảng **Gradients** tùy chọn dựng các token pha trộn từ bảng màu. Mỗi chuyển sắc có bản xem trước, 2 đến 8 điểm dừng có tên và một góc. Một điểm dừng trỏ tới một ô màu, nên nhuộm lại ô màu và chuyển sắc theo. Các phép pha chạy trong OKLCH.

Các bản tải bảng màu (design token, CSS, SCSS, GIMP và Adobe Swatch Exchange) nằm ở phần đầu của bảng màu, bên cạnh tiêu đề. [Take your palette and fonts anywhere](/info/using.html#take-your-palette-and-fonts-anywhere) mô tả từng định dạng.

## Type

Khi chưa có kiểu chữ riêng, phòng là một thẻ: **Primary**, đặt cỡ đọc bằng kiểu chữ đang phục vụ hôm nay, với thẻ **Starter**, nút **Choose for Primary** và dòng *"Nothing installs until you choose one."* Headings, code và italic theo primary cho đến khi bạn chọn chúng; **Choose them separately** hiện các thẻ của chúng.

![Phòng Type khi chưa chọn kiểu chữ nào - một thẻ ở cỡ đọc, mang nhãn Starter, và một nút Choose for Primary đã tô đậm](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Chọn một kiểu chữ và phòng mở thành bốn thẻ vai trò, danh sách Fonts và một mẫu chữ trực tiếp:

- **Primary**: nội dung chính, nút và mọi công cụ.
- **Headings**: kiểu chữ hiển thị cho `h1` và `h2`.
- **Code**: kiểu chữ đơn cách cho mã và dữ liệu.
- **Italic**: chữ nghiêng thật cho nhấn mạnh, trích dẫn và chú thích bên lề.

Một thẻ chỉ được nhuộm màu nơi bạn cài kiểu chữ đó. Nút của nó cho biết nó dành cho vai trò nào: **Change Headings** trên kiểu chữ của riêng bạn và **Choose for Headings** ở mọi nơi khác. Dòng mẫu xuống dòng thay vì bị cắt. Không gì trên thẻ xác nhận điều gì: nút mở sân khấu so sánh cho vai trò đó.

![Bốn thẻ vai trò được mở ra - mỗi thẻ đặt trong kiểu chữ phục vụ nó, mang nhãn Starter ở nơi chưa ai chọn, và Italic đang theo primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Compare stage

Sân khấu mở bên trong phòng, dưới thẻ bạn đã nhấn, và các thẻ gập thành một dải một dòng để sân khấu hiện trên màn hình đầu của điện thoại. Escape hủy và trả tiêu điểm về thẻ.

1. Nhấn **Choose for** và vai trò trên thẻ.
2. Gõ tên họ phông chữ và nhấn **Preview**, hoặc nhấn một trong sáu họ **Pinned** dưới ô.
3. Nhấn **Use this face**.

![Compare stage mở ra bên dưới thẻ của nó, với hàng tìm kiếm, các họ font đã ghim và các thẻ gấp lại thành một dải một dòng](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**Sự đồng ý được hỏi một lần.** Lần đầu bản xem trước tới Google Fonts, một hộp thoại giải thích: *Google learns the family name and your IP address. The file is then kept on this device and used offline. This is the one step in the studio that reaches a third party.* **Fetch from Google** tiếp tục và được ghi nhớ. **Cancel** để thẻ đọc *"Not fetched. Nothing was sent to Google."*, với **Fetch from Google** riêng của nó.

**Thả tệp phông chữ lên sân khấu** (TTF, OTF hoặc WOFF) để xem trước kiểu chữ có giấy phép mà bạn đã sở hữu. Dù cách nào, kiểu chữ ở lại trên thiết bị này, kết xuất ngoại tuyến trong ứng dụng, các công cụ và mọi bản xuất, và đi cùng trong tệp hệ thống thiết kế. Mọi thứ trên Google Fonts được phát hành theo giấy phép mở (OFL, Apache hoặc UFL).

### Phông chữ trên thiết bị này

Bảng **Fonts** liệt kê mọi kiểu chữ trên thiết bị này và vai trò nó phục vụ. Kiểu chữ bạn thêm đứng đầu dưới **In the design system**, mỗi cái kèm vai trò và nút xóa. Các kiểu chữ starter theo sau trong một hàng mờ, gập. **Add a face** mở sân khấu so sánh cho bất kỳ vai trò nào. Bảng **Type roles** hiện mẫu chữ trực tiếp của mỗi vai trò với họ phông chữ và trạng thái của nó, như *Inter* hoặc *Inter · follows Primary*.

## Tokens

Token là các giá trị có tên đằng sau hệ thống thiết kế: màu sắc, kiểu chữ, logo, bo góc và khoảng cách. Công cụ đọc chúng theo tên, nên một thay đổi ở đây tới mọi công cụ cùng lúc.

![Phòng Tokens: phần đầu với ví dụ từ hệ thống và các hành động tệp, các ô đếm từng loại token, rồi các cặp màu kèm chỉ số tương phản](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Phần đầu** đưa ra một ví dụ từ hệ thống của chính bạn (*Primary is Spearmint, #033633*) và các hành động tệp: **Download** (cả hệ thống dưới dạng design token, hoặc bảng màu theo năm định dạng khác), **Copy CSS** và **Add from…** để đọc lại một tệp JSON.
- **Các ô** đếm từng loại token và nhảy tới phần của nó: Colours, Type, Logos, Shape and spacing, More và All tokens. Chúng đếm những gì mỗi phần chứa; một phần chỉ chứa những gì đi kèm bản khởi đầu trống mang thẻ **Starter**, còn hệ thống đi kèm ứng dụng đếm tài liệu của chính nó mà không có thẻ. Trên điện thoại các ô xếp thành hai hàng ba ô.
- **Colours** bắt đầu với các cặp mà công cụ đặt cùng nhau (chữ trên bề mặt, trên primary, muted trên bề mặt) kèm chỉ số APCA ở sáng và tối, và đánh dấu **Weak contrast** nơi một cặp chưa đạt. Rồi mọi nhóm màu: một dải dưới dạng một hàng chip, các màu khác kèm giá trị và tham chiếu mà công cụ dùng, như `{color.brand.spearmint}`. Nhấn một tham chiếu để sao chép tham chiếu. **Edit in Colours** mở một nhóm trong phòng Colours. Với hệ thống thiết kế có [vai trò màu](#colour-roles-what-the-colours-are-called), **Colour roles** đứng đầu, mỗi vai trò một lần theo lời và thứ tự của chính hệ thống. Một vai trò giữ một màu cho từng bảng phối màu và từng giao diện, và các màu đó đi cùng vai trò thay vì xuất hiện như màu riêng: hãy đổi chúng trong bảng Colour roles.
- **Type** và **Logos** liệt kê kiểu chữ cho mỗi vai trò và mỗi ô logo, với **Edit in Type** và **Edit in Logos** khi bạn đã có của riêng mình.
- **Shape and spacing** chứa **Rounded corners** (`shape.radius`) và **Spacing rhythm** (`space.base`). Mỗi cái đọc *Lolly default* cho đến khi bạn kéo thanh trượt và *Yours* sau đó, lưu ngay và hoàn tác được.
- **More tokens** thêm khoảng cách, kích thước, độ dày nét, độ mờ đục, góc xoay, số thường và đổ bóng, được lưu dưới dạng [design token](/info/design-tokens.html) chuẩn.
- **App appearance (advanced)** liệt kê màu, kích thước và đổ bóng mà các màn hình riêng của Lolly dùng, và **Inspect every token (advanced)** tìm kiếm và chỉnh sửa bất kỳ giá trị đã lưu nào, hiện từng thay đổi để xem trước. Ở đó, giá trị của một vai trò màu trong từng bảng phối màu được liệt kê cùng vai trò: chọn token của vai trò để xem một hàng cho mỗi bảng phối màu, sáng và tối cạnh nhau, và dòng đếm cho biết các vai trò giữ bao nhiêu giá trị. Một hệ thống thiết kế chỉ đọc hiển thị cùng danh sách.

Một phần trống đưa ra cách lấp khoảng trống: **Pick a colour**, **Choose a face** hoặc **Add a logo**.

## Files

Thả các tệp mà thương hiệu của bạn giữ, ngoài logo: tệp **vector**, **image**, **audio** và **motion** (video, Lottie và hoạt ảnh). Chúng xuất hiện trong [Assets](/info/using.html#assets-your-library), xếp vào các phần và sẵn sàng trong bộ chọn tài nguyên của mọi công cụ, và chúng ở lại trên thiết bị này.

## Rules

**Rules** đưa các lựa chọn của thương hiệu vào làm việc: người dùng được đổi gì, gì cố định và Lolly kiểm tra được gì.

![Rules trên Lolly Demo: bốn quy tắc nội bộ, mỗi quy tắc được đánh dấu Checked in Lolly Design và Required hoặc Advisory, rồi Try your design system in use với các ví dụ sẵn sàng kết xuất](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** liệt kê các quy tắc của bạn. **Add rule** (hoặc **Add your first rule**) mở một biểu mẫu ngắn:

- một **Rule name** theo lời của bạn, như *Beacon accents*;
- **Check**: **Colour choices**, **Font choices**, **Fixed artwork** hoặc **Text length**, với vai trò thương hiệu mà nó dùng, dưới tên riêng của bạn cho vai trò;
- **Example** mà nó áp dụng (Poster, Title slide, Content slide hoặc Lolly Chart), **Mode** và việc nó là **Required** hay **Advisory**;
- **Reviewed by**, rồi **Save draft** hoặc **Approve & save**.

Phê duyệt ghi lại quyết định của riêng bạn trên thiết bị này. Các quy tắc bắt buộc đã duyệt ràng buộc áp phích dùng lại được, và các kiểm tra chỉ bao gồm các PNG ví dụ; chúng không đổi công cụ nào khác.

Các quy tắc mà một hệ thống thiết kế mang theo trong tệp token của nó, như cặp màu đã duyệt, độ đậm và căn lề của chữ hay một logo cho mỗi bề mặt, được liệt kê ở đây là **Checked in Lolly Design**. Lolly Design kiểm tra chúng theo từng lớp trong thẻ **Before you export** của bảng xuất, và `lolly check` làm tương tự cho một tài liệu Lolly Design đã lưu ([Before you export](/info/design.html#before-you-export)). Một quy tắc mà bản dựng này không có bộ kiểm tra được giữ nguyên như được cung cấp và đánh dấu **Unchecked**.

Lolly Demo mang theo bốn quy tắc nội bộ đã duyệt. Tiêu đề không bao giờ viết hoa toàn bộ: quy tắc đó là bắt buộc, nên `lolly check` báo một tiêu đề viết hoa toàn bộ là lỗi. Ba quy tắc còn lại chỉ mang tính khuyến nghị. Văn bản chính căn trái. Dấu hiệu chính đặt trên nền sáng và dấu hiệu đảo màu trên nền tối. Đường nét đứt nghĩa là thả vào đây.

**Try your design system in use** kết xuất bốn ví dụ từ bản hiệu đính hiện tại bằng **Render & check examples**. Chọn một **Mode** và **Try your own text** cho tiêu đề, văn bản phụ và chữ trên slide. Mỗi ví dụ báo cáo những gì đã đo, với **See checks & sources** và **Download check report**, và **Make reusable poster** tải về một tệp `.lolly` mà bố cục cố định và các lựa chọn đầu vào đã duyệt đi cùng tệp. Các ví dụ chạy cục bộ: chạy kiểm tra không công bố hay duyệt gì.

Một bản dựng đi kèm thương hiệu cố định hiện cùng các quy tắc và ví dụ ở chế độ chỉ đọc, dưới *This brand is set*.

## Skills

**Skills** liệt kê [brand skills](/info/brand-skills.html) của hệ thống thiết kế đang dùng: các tiêu chuẩn thành văn của thương hiệu, mỗi bộ môn một bản, cho con người và tác tử AI. Mỗi hàng cho biết bộ môn, trạng thái riêng của thương hiệu (**Draft** hoặc **Approved**), skill công khai hay nội bộ và bản sửa đổi của nó. Chọn một hàng để đọc skill bên cạnh phần phủ của nó, đặt các dòng của skill đối chiếu với token của bạn: Lolly kiểm tra gì, gì xung đột, gì khớp và gì chỉ là hướng dẫn.

**Download skill (.zip)** ghi skill thành một thư mục Agent Skills cho công cụ tác tử, với các liên kết catalog trỏ về Lolly này, và **Copy as one file** đặt cùng văn bản lên clipboard cho một cửa sổ chat. Một hệ thống thiết kế chưa có skill riêng sẽ liệt kê một bản nền mà Lolly viết từ token và quy tắc nhà của nó mỗi lần bản nền được đọc. Phòng này đọc skill và không bao giờ sửa chúng.

## Mang một thương hiệu vào

**Add from…** trên thanh mở một bộ chọn hỏi bạn có gì, không hỏi nó là định dạng gì:

- **Design tokens or a design file**: JSON DTCG hoặc Tokens Studio, một dự án Penpot, một zip các bộ token, một gói hệ thống thiết kế Lolly, một SVG, một `DESIGN.md` hoặc một thư mục trang thương hiệu.
- **PDF**: một bộ slide hoặc tệp hướng dẫn, được đọc trên thiết bị này để lấy màu, dấu hiệu và phông chữ nhúng.
- **Logo or screenshot**: một ảnh thành bảng màu gợi ý, được đọc trên thiết bị này. Nó đọc màu, không đọc kiểu chữ hay bố cục.
- **Saved web page**: một tệp HTML và các tệp CSS của nó, hoặc HTML hay CSS được dán, tối đa 20 tệp và 2 MB. Chỉ văn bản bạn cung cấp được đọc: tài nguyên được liên kết không được tải và script không chạy.
- **Font file**: TTF, OTF hoặc WOFF. Mở phòng Type, nơi phông chữ được cài.
- **Website**: một trang, được đọc để lấy màu và kiểu chữ. Ô này chỉ xuất hiện trên thiết bị đọc được một trang, và cho biết nó dùng trình đọc nào: ứng dụng trên thiết bị này, hoặc tiện ích mở rộng trình duyệt trong một tab nền, đăng nhập bằng tài khoản của bạn. Nêu một URL chỉ điền vào ô; nhấn tải mới là sự đồng ý.

Chọn nguồn tệp thiết kế và thẻ tiếp theo liệt kê các định dạng được chấp nhận dưới dạng ô biểu tượng, với cả thẻ là một đích thả. Bạn cũng có thể thả tệp thẳng lên studio.

![Thẻ nhập - các định dạng được chấp nhận dẫn đầu dưới dạng ô biểu tượng, và toàn bộ thẻ là một vùng thả duy nhất](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- Một **gói hệ thống thiết kế Lolly** (`.lolly`, hoặc `.zip` cũ) được cài trong một bước.
- Một bản xuất **Penpot** (`.penpot`) mang theo các design token của nó.
- Một tệp **Design Tokens** (W3C DTCG) hoặc **Tokens Studio** (`.json`) mang theo token của nó. Một mô tả yêu cầu người đọc bỏ qua chỉ dẫn, tuyên bố quyền hạn hoặc yêu cầu chạy mã sẽ bị bỏ ra, và lần nhập cho biết nó nằm ở đâu. Đây là phép kiểm tra từng dòng và bỏ sót cách diễn đạt khác, nên hãy đọc tệp từ người bạn không quen trước khi áp dụng token.
- Một **SVG thuần** được quét tìm màu để bạn chọn, màu đầu tiên thành primary của bạn.
- Một **`DESIGN.md`** (`.md`) đi tới **Try these colours** với token của nó như đã viết. Phần văn xuôi có thể được giữ làm bản nháp kỹ năng thương hiệu, và thẻ đánh dấu các dòng yêu cầu người đọc bỏ qua chỉ dẫn, tuyên bố quyền hạn hoặc chạy mã. Agent và trang thương hiệu không thấy bản nháp cho đến khi bạn nhấn **Keep this skill** trong phòng Skills, và một kỹ năng đã giữ vẫn là nội bộ.
- Một **thư mục trang thương hiệu**, được chọn như thư mục, được thả vào hoặc nén zip, đi tới cùng bước xem xét. Mỗi tệp được đối chiếu với `brand.json` của thư mục, và một tệp không khớp sẽ từ chối cả thư mục. Nó thêm token. Logo và phông chữ ở lại trong thư mục.

Lolly đọc một trang thương hiệu từ các tệp bạn cung cấp. Nó không tải địa chỉ của một trang khác.

### Một tệp có từ riêng cho màu

Một tệp token hoặc `DESIGN.md` có thể dùng từ riêng cho màu của nó, như main, accent, supporting và tertiary. Khi Lolly thấy những từ như vậy, phần xem xét liệt kê từng từ trước khi áp dụng gì: từ đó, màu của nó ở mỗi giao diện, token mà nó đến từ và Lolly sẽ đọc nó là gì. Lolly gợi ý các cách đọc đó chỉ từ các từ, đối chiếu một danh sách ngắn, và không dùng mô hình nào. Một từ ngoài danh sách đến như của riêng thương hiệu, **By name only**. Hãy đổi tên bất kỳ từ nào, nói nó dùng để làm gì, đọc nó là thứ khác, hoặc bỏ chọn để giữ nó như một màu có tên.

**Install with these roles** ghi chúng, và **Install without roles** cài tệp đúng như nó đến. Một tệp không có từ như vậy không hiện bước mới. Một tệp tự nêu vai trò của mình, như tệp do Lolly ghi, hiện chúng như đã viết và cài chúng nguyên vẹn, và bạn có thể sửa chúng sau trong phòng Colours. Terminal không có bước xem xét, nên `lolly system import` giữ một bản ghi đã nêu và để các từ của tệp khác thành màu có tên.

### Xem lại một nguồn tham chiếu

Một logo, ảnh chụp màn hình, trang web hoặc trang đã lưu mở **Try these colours**: một ví dụ trong các màu đề xuất, **Main colour** bạn có thể đổi và tên cho hệ thống mới. Một hộp nói rõ việc áp dụng làm gì: nó **thay thế** cài đặt token đang dùng bằng bảng màu được tạo và kiểu mặc định, **giữ** phông chữ và tệp thư viện của bạn và hệ thống trước có thể được **khôi phục**. **Apply suggested settings** áp dụng bảng màu sáng và tối, sau một điểm kiểm tra, và **Restore brand settings** có thể đưa cài đặt cũ trở lại. **Change reference** chọn nguồn khác.

**Palette, source details and individual choices** hiện những gì đã đọc, mọi tên phông chữ tìm thấy và độ tương phản của bản xem trước. Tên phông chữ chỉ là gợi ý; Type vẫn là nơi bạn cài một kiểu chữ. Chi tiết nguồn có thể gồm kiểu chữ, khoảng cách, đệm và giá trị bo góc nơi quan sát được, ghi nhãn **Not observed** nếu không. Trang đã lưu hoặc việc đọc website gốc báo cáo các kiểu được khai báo, mà trang có thể không dùng, còn tiện ích mở rộng trình duyệt có thể báo cáo kiểu đo được từ một mẫu các phần tử hiển thị. Đây là các quan sát: không gì được cài, và khoảng cách của nguồn không bao giờ thay thế của riêng bạn. **Choose individual items in the tray** giữ từng mục đơn lẻ, và **Download design context** lưu một báo cáo JSON gồm quan sát, token đề xuất và thông tin nguồn (kèm SHA-256 của mọi HTML hay CSS được cung cấp). Báo cáo không chứa văn bản thô của trang và không phải Content Credential có chữ ký.

Việc nhập PDF và tệp thiết kế giữ các điều khiển xem lại riêng. Các mục trong **Tray** không đổi gì cho đến khi bạn thêm chúng trong phòng sở hữu loại vật liệu đó. `#/start?source=<kind>` mở bộ chọn ở một nguồn (`file`, `pdf`, `image`, `font`, `url`, `page`), và `?import` mở danh sách thuần.

### Tìm và so sánh một diện mạo

Mở **Find a look** từ Board hoặc từ danh sách hệ thống thiết kế trong Settings. Duyệt các hệ thống đã lưu trên thiết bị này và vài ví dụ Lolly dùng lại được, và tìm theo tên, thẻ màu hoặc phông chữ đã khai báo. **Closest to my current palette** sắp xếp theo độ tương đồng màu đã đo, với phông chữ khớp phân định khi hòa; đó không phải điểm chất lượng.

Nhấp vào một giao diện để xem trước trong ngữ cảnh. Xem trước không đổi gì. **Use this look** của mỗi thẻ dùng giao diện đó. Một hệ thống đã lưu thành hệ thống đang dùng, việc này không sửa gì. Màu của một ví dụ đi qua điểm kiểm tra thông thường vào hệ thống thiết kế đang mở, và logo, phông chữ cùng mọi thứ ví dụ không định nghĩa vẫn như cũ. **Compare looks** thêm một hộp kiểm vào mỗi thẻ, để bạn chọn hai và so sánh cạnh nhau. **Restore brand settings** khôi phục giao diện trước đó. Các hệ thống đã lưu có **Search tags** sửa được dưới **Details and design context**. Các ví dụ là công thức màu gốc của Lolly, không có bộ sưu tập thu thập nào và không cần tài khoản.

![So sánh Sunroom và Orchard cạnh nhau trước khi áp dụng một trong hai hệ thống màu.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

## Giữ và chuyển hệ thống thiết kế của bạn

### Chuyển một thương hiệu giữa các thiết bị

**Export** ghi một tệp **`LollyBrand-….lolly`**: token, phông chữ, logo và tùy chọn giao diện của bạn, kèm manifest toàn vẹn được kiểm tra khi đưa lại vào. Các bản web trước 1.0.7 đặt tên cùng tệp là `.zip`, và cách viết đó vẫn được chấp nhận. **Tokens (.json)** ghi riêng tài liệu design token thuần, không phông chữ hay logo, cho một kho mã, một bước dựng hoặc công cụ token khác.

Để đưa một thương hiệu trở lại, dùng **Add from… → Design tokens or a design file**, hoặc thả tệp lên studio. Đó là cách đồng nghiệp trao thương hiệu cho bạn, hoặc cách bạn mang nó sang bản cài thứ hai, không tài khoản và không đám mây. [Working with partners](/info/partners.html) nói thêm về những gì cần gửi kèm khi người nhận thương hiệu của bạn làm việc cho một tổ chức khác. Để đưa thương hiệu vào từ dòng lệnh, xem [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** đóng gói các phông chữ bạn đã thêm thành một RPM cài được. Nếu bạn tự tải lên bất kỳ cái nào, Lolly yêu cầu bạn xác nhận rằng bạn được phép phân phối lại chúng trước.

### Khôi phục cài đặt trước

Mở **More** trong thanh, chọn **Restore brand settings**, chọn một điểm kiểm tra có ngày và nhấn **Restore**. Nó khôi phục màu, cài đặt kiểu chữ và các token khác của thương hiệu đang dùng; tệp phông chữ và ảnh giữ nguyên. Lolly lưu cài đặt hiện tại của bạn là **Before restore** trước, để bạn đảo ngược việc khôi phục ngay cả sau khi đóng trình duyệt. 20 điểm kiểm tra gần nhất được giữ trên thiết bị này.

### Phiên bản

Một phiên bản đã xuất bản là một **bản sao vĩnh viễn, có tên** giữ trên thiết bị này. Nó không bao giờ đổi, nên một công cụ hoặc liên kết ghim nó (bằng `designv`) tiếp tục vẽ cùng một thứ. Một hệ thống có thứ gì của riêng bạn liệt kê **Versions & publishing** trong menu **More** của thanh; sau lần xuất bản đầu tiên **Versions** gia nhập các phòng. `#/start?area=versions` mở thẳng nó.

- **Một phiên bản là vĩnh viễn.** Chưa có xóa, và bảng nói rõ điều đó.
- **Các mục gỡ bỏ dẫn đầu thẻ tương thích**, vì token bị gỡ là thứ làm hỏng công cụ.
- **Xuất bản không thể hoàn tác; khôi phục thì có.** *Restore latest from this version* là một chỉnh sửa bình thường, với **Undo** được đưa ra ngay.

**Publish only** giữ một phiên bản mà không đổi thứ công cụ theo; **Publish and make active** khiến công cụ và ứng dụng theo phiên bản đó. **Follow the latest again** đưa mọi chỉnh sửa vào hoạt động ngay khi bạn thực hiện.

### Công bố một trang thương hiệu

[Trang thương hiệu](/info/brand-page.html) là một địa chỉ cho cả con người và agent: một trang hiện logo, màu sắc, kiểu chữ và ví dụ, với cùng các dữ kiện trong các tệp bên cạnh trang. **Publish a brand page**, dưới Versions & publishing, hiện trang trực tiếp và, bên cạnh trang:

- **Goes public**: mọi tệp, được nhóm, kèm kích thước.
- **Held back**: những gì bị giữ lại, và lý do. Một logo chưa ghi giấy phép bị giữ lại cho đến khi bạn đánh dấu tên logo. Một tệp phông chữ cần giấy phép đã ghi cho phép chuyển giao, và trang hiện một mẫu chữ đã vẽ đường viền khi tệp bị giữ lại. Kỹ năng thương hiệu nội bộ không bao giờ xuất hiện.
- **What was checked**: các cặp màu theo colourway và chế độ, cùng các quy tắc nội bộ. Đây là số đo, không phải phán quyết.
- **In your words**: một tuyên bố sử dụng và một đầu mối liên hệ. Trang in ra điều bạn viết và Lolly không thêm giấy phép hay tuyên bố pháp lý nào. Một công tắc tắt dòng "Made with Lolly" ở chân trang.
- **On exports**: một công tắc [ghi địa chỉ của trang vào các bản xuất của hệ thống thiết kế này](/info/brand-page.html#lead-back-from-your-files). Nó tắt cho đến khi bạn bật, cần một địa chỉ `https`, và không đi theo gói hay bản sao. Một hệ thống thiết kế bị khóa không hiện công tắc, vì người quản lý của nó quyết định.

**Download folder** lưu thư mục thành ZIP để bạn tự lưu trữ ở nơi bạn chọn, và không gì được công khai cho đến khi bạn làm vậy. Trong terminal, `lolly system publish --out=<dir>` ghi cùng thư mục đó. Một phiên bản phục vụ trang thương hiệu cũng có **Publish to** địa chỉ của nó, đó là một lần nhấn rõ ràng, và đi qua chuỗi phê duyệt khi có. Một hệ thống thiết kế được quản lý chỉ công bố khi người quản lý cho phép.

### Kết nối một agent

**Connect an agent**, ở cùng chỗ, cho bạn văn bản để dán và nói mỗi lựa chọn làm được gì:

- **`AGENTS.md`** trong một dự án: agent đọc tên và quy tắc của hệ thống. Nó không vẽ gì và không cần máy chủ.
- **Máy chủ công khai của Lolly**: vẽ bằng Lolly Demo, dù bạn đang mở hệ thống nào ở đây. Không cần khóa.
- **Phiên bản của bạn**: vẽ bằng các hệ thống mà phiên bản đó giữ, và đọc một token dịch vụ từ biến môi trường. Bảng cho biết tên biến và không bao giờ hiện token.

Khi không có máy chủ lưu trữ nào vẽ bằng hệ thống của bạn, bảng sẽ nói như vậy.

## Quản lý các hệ thống thiết kế của bạn

Mở **Settings → Preferences → Design systems** để chuyển, thêm hoặc gỡ hệ thống. **Open** chọn một hệ thống và mở nó tại đây; **Make a new one** tạo một hệ thống cục bộ và mở nó với ô tên sẵn sàng. Một hệ thống đang dùng tại một thời điểm, cho cả thiết bị. [Brand architectures](/info/brand-architectures.html) giúp quyết định khi nào một thương hiệu cần hệ thống thiết kế riêng.

**Một hệ thống đến từ đâu.** Hệ thống mà danh mục của một bản triển khai cung cấp đọc **Came with this app**, hoặc **From this instance** trong ứng dụng kết nối với một phiên bản. Mở rộng **Catalogue source** để xem ai cung cấp nó, tài nguyên token và không gian tên của nó cùng phiên bản hoặc checksum đã biết; nếu làm mới thất bại, tài liệu đã lưu đệm được gắn nhãn.

**Hệ thống được quản lý là chỉ đọc.** Một hệ thống hiện **Managed by this instance** (hoặc **Managed by this app** trong ứng dụng máy tính không có phiên bản) khi danh mục của nó khóa hệ thống. Bạn dùng và tải xuống được, và mở nó ở đây sẽ hiện một ghi chú chỉ đọc với **Make an editable copy** và **Switch**, rồi các vai trò màu và token của nó không có điều khiển chỉnh sửa. Các hệ thống cục bộ của riêng bạn vẫn sửa được, kể cả khi hệ thống được quản lý có trước. Một bản dựng có một thương hiệu cố định mở Lolly Design System Setup ở *This brand is set*, với token và quy tắc sử dụng của thương hiệu để đọc.

**Mọi hệ thống được cung cấp khác là của bạn** để ẩn, chỉnh sửa và đặt lại, kể cả Lolly Demo và Lolly Starter trên lolly.tools. Chỉnh sửa một hệ thống giữ tên của nó và đánh dấu hàng là **Edited here**, và **Reset to original** trong menu của nó bỏ các thay đổi thực hiện trên thiết bị này. Bản khởi đầu trống là ngoại lệ: thay đổi đầu tiên ở đó bắt đầu một hệ thống thiết kế của riêng bạn, nên Lolly hỏi một lần đặt tên gì cho hệ thống mới. [Lolly Demo in use](/info/lolly-demo-in-use.html#switch-to-your-own) cho thấy hệ thống của bạn thay thế gì.

### Gỡ một hệ thống thiết kế

Chọn **Remove** từ menu của một hệ thống; hộp xác nhận cho biết hệ thống nào sẽ đang dùng sau đó. Các phiên đã lưu, tệp tải lên và tài liệu chia sẻ với hệ thống khác vẫn ở lại.

Gỡ một hệ thống được cung cấp chỉ ẩn nó: tài nguyên danh mục của nó ở lại, **Bring back** hiện lại và nó tự quay lại nếu bạn gỡ mọi thứ khác. Gỡ một bản nhập hoặc bản sao đã chỉnh sửa không gỡ hệ thống được cung cấp, logo hay phông chữ của nó, và nếu bản sao đang dùng thì hệ thống được cung cấp trở lại đang dùng. Gỡ một bản sao lưu trữ đang dùng chỉ xóa kết nối của bản sao đó; một phiên bản được chọn riêng vẫn được chọn.

Đổi những gì một máy chủ cung cấp là việc của quản trị viên: người vận hành đổi danh mục nguồn và triển khai lại, hoặc một quản trị viên Lolly Work xem xét và áp dụng một thay đổi của máy chủ. Các chỉnh sửa ở đây vẫn cục bộ, với một ngoại lệ: trên một phiên bản Lolly Work cấp cho bạn `brand.edit`, một hệ thống được quản lý cũng có **Edit for** phiên bản đó, mở một bản sao để chỉnh sửa, và **Send to** phiên bản đó trong **Versions** gửi màu, colourway, vai trò màu và địa chỉ trang thương hiệu của nó trở lại. [Edit this instance from the studio](/info/work-design-system-administration.html#edit-this-instance-from-the-studio) nói một chỉnh sửa có thể đổi gì và phiên bản phục vụ thay đổi ra sao. Xem [Removing a catalogue design system](/info/configuration.html#removing-a-catalogue-design-system) và [Configuration](/info/configuration.html#supplied-and-local-design-systems).

## Dùng ngữ cảnh thiết kế ngoài ứng dụng

**Download design context** lưu tài liệu token, màu đã phân giải, họ phông chữ đã khai báo, id tài nguyên, bằng chứng nguồn nếu có ghi, độ phủ và các quy tắc tường minh, không có tệp phông chữ và không có bằng chứng quyền sở hữu. Dòng lệnh đọc tệp mà không cần máy chủ: `lolly system import` biến nó thành hệ thống thiết kế của terminal và `lolly system check` kiểm tra đầu vào Lolly Design theo ngữ cảnh đã lưu. [Bring your design system](/info/cli.html#bring-your-design-system) nói về việc nhập và [Which design system a command uses](/info/cli-decks.html#which-design-system-a-command-uses) nói về việc kiểm tra, và một máy khách MCP đọc cùng bản tóm tắt từ `lolly://design-context` ([MCP Server](/info/mcp.html)).

## Đi tiếp từ đâu

- **[Using Lolly](/info/using.html)**: các công cụ, lưu, chia sẻ và Assets.
- **[Brand architectures](/info/brand-architectures.html)**: các bộ phận, sản phẩm, thương hiệu được bảo chứng, khách hàng và mùa ánh xạ thế nào vào hệ thống thiết kế, colourway và nhận diện logo.
- **[Working with partners](/info/partners.html)**: chia sẻ thương hiệu của bạn với đối tác, và làm việc trong thương hiệu bạn được giao.
- **[Brand pages](/info/brand-page.html)**: công bố hệ thống thiết kế của bạn tại một địa chỉ, như bộ tài liệu báo chí và bộ tài liệu cho agent.
- **[Design Tokens](/info/design-tokens.html)**: mô hình token mà thương hiệu của bạn được viết trong đó.
- **[Export a file](/info/exporting.html)**: đơn vị in, CMYK và các định dạng mà thương hiệu của bạn kết xuất ra.
