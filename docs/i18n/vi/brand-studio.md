# Brand Studio

**Brand Studio** tại `#/start` là nơi duy nhất bạn định hình thương hiệu của mình - logo, màu sắc, kiểu chữ, phần còn lại của token và các tệp mà nó lưu giữ. Thiết lập ở đây một lần và mọi công cụ, trang và bản export sẽ tuân theo nó *do cấu trúc quy định*, chứ không phải nhờ rà soát.

Các thay đổi được xem trước **trực tiếp trên toàn bộ ứng dụng** ngay khi bạn thực hiện, để bạn thấy một màu hoặc một font xuất hiện ở khắp nơi trước khi chốt lại. Tất cả đều diễn ra trên thiết bị: tệp thương hiệu và token của bạn không bao giờ rời khỏi máy của bạn (chọn một Google Font sẽ tải riêng họ font đó từ Google, một lần duy nhất, sau một hộp thoại xin đồng ý), và thương hiệu di chuyển dưới dạng một tệp [brand pack](#move-a-brand-between-devices) duy nhất.

> **Đây là trình chỉnh sửa. Dashboard là tấm gương phản chiếu.** Tab **Design system** trên Dashboard (`#/d`) *hiển thị* thương hiệu của bạn ở chế độ chỉ đọc; bạn *chỉnh sửa* nó ở đây, tại `#/start`. Nếu sau này muốn đổi một màu, hãy quay lại Brand Studio.

## Các phòng

Studio là một tập hợp các **phòng (rooms)** được liệt kê trên một thanh rail dọc bên cạnh - không phải các bước. Không có gì được đánh số, không có gì bị khóa bởi điều kiện khác, và việc đi thẳng vào bất kỳ phòng nào cũng đều hợp lệ:

- **Overview** - trung tâm điều hướng. Những gì đang có ngay lúc này, nhìn thoáng qua là thấy, với một lối vào từng phòng.
- **Colours** - thêm từng màu một, gán vai trò hoặc tạo cả một bảng màu từ một màu.
- **Type** - bốn font chữ mà ứng dụng, công cụ của bạn và mọi bản export đọc theo.
- **Logos** - các logo của bạn, ở mọi hướng và mọi cách xử lý.
- **Tokens** - bán kính góc, khoảng cách, đổ bóng và phần còn lại của hệ thống.
- **Files** - các tệp ảnh, âm thanh và chuyển động mà thương hiệu của bạn lưu giữ.

Trên điện thoại, cùng danh sách đó trở thành một dải chip nằm ngang được ghim dưới phần header. Chuyển phòng không bao giờ tải lại bất cứ thứ gì - trình chỉnh sửa giữ nguyên tất cả các panel đã được mount và chỉ đơn giản hiển thị panel bạn yêu cầu.

**Liên kết trực tiếp đến một phòng** bằng `#/start?area=<key>`. Các key là `overview`, `color` *(lưu ý cách viết tiếng Anh-Mỹ trong URL)*, `type`, `logos`, `tokens`, `catalogue` (phòng Files - panel key là một hợp đồng vĩnh viễn, nên URL vẫn giữ tên cũ) và `versions`. `?tab=` là bí danh đã tồn tại lâu dài cho cùng một thứ và vẫn hoạt động, nên các liên kết và bookmark cũ vẫn dùng được; bất cứ giá trị nào không nhận diện được sẽ mở Overview thay vì dẫn vào ngõ cụt.

Được ghim ở **chân thanh rail** là các hành động thuộc về toàn bộ hệ thống thiết kế chứ không thuộc riêng một phòng nào:

- **Add from…** - bộ chọn nguồn, để đưa thương hiệu vào từ một tệp, một PDF, một ảnh, một font hoặc một website. Xem [Bring a brand in](#bring-a-brand-in) bên dưới.
- **Tray** - các ứng viên mà một lượt scan tìm thấy nhưng chưa được xác nhận. Nó ẩn cho đến khi một lượt scan thực sự giữ lại được gì đó, và hiển thị số lượng khi có; không có gì trong đó thay đổi thương hiệu của bạn cho đến khi bạn nhấn Add trên hàng đó.
- **Export** - ghi ra toàn bộ hệ thống thiết kế dưới dạng một tệp `LollyBrand-….lolly`.
- **Tokens (.json)** - tài liệu design-tokens thuần túy, độc lập, dùng cho một repo, một bước build hoặc một công cụ tokens khác.
- **Restore brand settings** - quay lại một checkpoint đã lưu trước một lượt nhập hoặc một lần thay thế thiết lập thương hiệu.
- **Versions** - publish, activate và khôi phục các bản sao có tên của hệ thống thiết kế. Ẩn cho đến khi có thứ gì đó của riêng bạn để publish (hoặc một liên kết `?area=versions` yêu cầu đích danh).

![Thanh rail phòng của studio - Overview, Colours, Type, Logos, Tokens và Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Overview

Overview là phòng đầu tiên, và nó có hai diện mạo.

Khi **chưa có gì được chọn**, nó nói **Make it yours**. **Start from a reference** mở bộ chọn nguồn cho một logo, ảnh chụp màn hình, trang web hoặc tệp thiết kế. **Pick a colour**, **Choose a face** và **Add a logo** mở thẳng các điều khiển sẵn có của chúng. Mỗi lối đi bắt đầu bằng một lựa chọn; mở một trong số đó không ghi lại gì cả. **Explore the tools** có sẵn ngay lập tức.

Ngay khi có gì đó là của riêng bạn, cùng phòng đó hiển thị **những gì bạn đang có**, với các con số bạn đã tạo dẫn đầu. Colours cho biết số lượng màu mà hệ thống thiết kế đang mang, và chỉ thêm dòng mờ `· N starter` khi có màu kế thừa đang hiển thị; dải màu bên cạnh xếp các màu bạn chọn trước, rồi đến một đường kẻ mảnh, rồi đến các màu starter đã mờ đi. Type đọc theo vai trò (*Inter cho tiêu đề*, với *Starter cho phần còn lại · SUSE, SUSE Mono* bên dưới). Logos cho biết bao nhiêu ô đã được lấp đầy, hoặc **Not set**. Tokens mang theo bán kính góc, gắn nhãn *starter* cho đến khi bạn thay đổi nó. Files nói **Nothing yet** khi thư viện còn trống. Mỗi khối là một lối vào phòng của nó. Ở đây chỉ có số lượng, không bao giờ có thanh tiến trình và không bao giờ có thẻ hoàn tất - không có gì trong studio này là một nghĩa vụ phải hoàn thành.

## Logos

Bắt đầu bằng cách đổ toàn bộ thư mục logo của bạn vào vùng thả ở trên cùng: **"Drop marks here, or choose several at once"** nhận bao nhiêu tệp bạn có trong một lượt cũng được. Mỗi tệp được đọc theo hình dạng và màu mực của nó, rồi xếp hàng dưới **Waiting for a slot** dưới dạng một chip nói lên nhận định của nó - *"Looks like the Horizontal primary"*, kèm số đo mà nó dựa vào, cùng một nút **Place** (**Replace**, nếu ô đó đã có sẵn logo). Khi không chắc chắn, chip nói rõ điều đó và thay vào đó đưa ra **Change slot**, liệt kê đủ tám ô. Không có gì được đặt vào cho đến khi bạn nhấn một nút nào đó.

Hai điều xảy ra xung quanh hàng đợi đó. Một logo có lề trống dư thừa sẽ nhận được **đề nghị cắt (trim offer)** trước tiên - trả lời nó hoặc nhấn Escape thì tệp gốc sẽ được đưa vào nguyên trạng. Và khi một logo có thể cung cấp cho một ô trống liền kề, phòng này đề xuất phiên bản **mono** hoặc **reverse** được suy ra như một chip riêng, đánh dấu *Generated*, và chip đó sẽ biến mất nếu bạn lấp ô đó bằng cách khác.

Bên dưới đó là lưới mà mọi logo cuối cùng đều rơi vào - các ô **orientation × treatment**:

- **Orientations:** Horizontal (wordmark + biểu tượng xếp thành hàng) và Vertical (xếp chồng, dùng cho không gian vuông và cao).
- **Treatments:** Primary, Primary reverse (dành cho nền tối), Mono (một màu) và Mono reverse.

Đó là tám ô tùy chọn. Nhấp vào một ô để thêm tệp PNG, SVG, JPEG hoặc WebP; nhấp vào một ô đã có logo để thay thế nó. Mọi ô đều là tùy chọn và mọi thứ đều ở lại trên thiết bị này.

![Ma trận logo - mỗi orientation nằm ngang trên đầu, mỗi treatment là một ô viền đứt nét riêng, tất cả đều tùy chọn](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** - thêm các logo mà thương hiệu của bạn tự đặt tên theo cách riêng (một icon, một huy hiệu, một favicon) dưới mục **Custom marks**; đặt tên cho nó và chọn một tệp.
- **More identities** - một thương hiệu con, sản phẩm hoặc sự kiện có thể có bộ logo đầy đủ của riêng nó. Dùng **+ Add another logo** và đặt tên cho nó; bộ chính của bạn đơn giản là "Your logo".
- **Tải lên một tệp SVG và Lolly sẽ đọc màu sắc của nó.** Trên một bản cài đặt hoàn toàn mới, nó lặng lẽ đặt màu chính của bạn theo logo và thông báo điều đó. Trên một thương hiệu đã có sẵn, nó đưa ra màu đó như một gợi ý thay vì tự đặt - *"Found in the logo: #…"* kèm nút **Use as primary** bên cạnh - ở phòng Colours, nơi bạn có thể chấp nhận hoặc bỏ qua.

## Colours

Phòng này lớn dần cùng với hệ thống thiết kế. Không có gì bạn chưa cần xuất hiện trên trang, nên lần ghé đầu tiên chỉ là một quyết định, và phần còn lại đến dần khi bảng màu lớn lên.

### Màu đầu tiên

Một hệ thống thiết kế chưa có màu riêng nào sẽ mở ra trên một cột căn giữa duy nhất: **Start with one colour**, một chip trực tiếp cỡ lớn, một ô nhập, và một dòng nhỏ nhẹ cho biết vai trò, sắc độ và thiết lập in ấn sẽ đến khi hệ thống lớn dần.

- **Chip chính là bộ chọn màu.** Nhấn vào nó và thẻ OKLCH riêng của studio mở ra ngay trên chip, được nạp sẵn từ bất cứ gì ô nhập đang giữ: một tên, bánh xe màu, bốn núm xoay, alpha và **Stored as**, với **Cancel** và **Add colour** ở chân thẻ. Kéo một núm xoay sẽ tô màu chip và viết lại ô nhập ngay khi bạn kéo, và không có gì đến được hệ thống thiết kế cho đến khi bạn nhấn **Add colour**.
- **Ô nhập chấp nhận mọi ký hiệu** - `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` hoặc một tên màu thuần - và cả một *danh sách* màu sẽ trở thành một hàng chip mà bạn thêm từng cái một.
- **Có thêm hai cánh cửa nữa bên cạnh.** Ống hút màu (trên trình duyệt nào có) lấy một màu ngay trên màn hình, và **From an image** đọc một ảnh chụp màn hình hoặc một bức ảnh trên thiết bị này rồi đưa ra các màu nó tìm thấy.
- **Add không bao giờ bị vô hiệu hóa.** Khi không có gì đọc được trong ô nhập, nó sẽ mở bộ chọn màu, đó thường là ý nghĩa của một lần nhấn khi ô trống; văn bản mà nó không phân tích được sẽ nhận một dòng bên dưới ô nhập nói rõ điều đó, thay vì một nút chết.

Màu đầu tiên trở thành **primary**, và chip trả lời cho lượt thêm đó sẽ nói rõ điều này - *"Primary is now Vivid Violet"* - với **Fine-tune** bên cạnh.

![Phòng Colours khi chưa có gì được chọn - một chip trực tiếp cỡ lớn, một ô nhập và một dòng về những gì sẽ đến sau](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Starter

**Starter** là từ dùng cho bất cứ thứ gì đi kèm ứng dụng thay vì do bạn chọn. Một bản cài đặt mới hoàn toàn không mang theo màu nào cả: những gì nó có là một dải màu trung tính, mực trên giấy, để các bề mặt, văn bản và đường kẻ mảnh có thể hiển thị trước khi ai đó quyết định bất cứ điều gì. Những màu trung tính đó là khung dựng tạm, nên chúng không được tính là màu và không được vẽ trong bảng màu. Chúng nằm trong phòng [Tokens](#tokens) dưới dạng **Neutrals · starter · 9**, với một nút **Open** hiển thị chúng trong bảng Colours như một nhóm gấp lại, có gắn nhãn (`#/start?area=color&group=neutral`).

Cùng một từ đó xuất hiện xuyên suốt mọi phòng: một vai trò đang đứng trên một màu starter sẽ đọc là *"Starter Paper stands in"* và bộ chọn của nó đưa ra **Choose…**; một kiểu chữ starter mang nhãn **Starter** và không có sắc tint; một bán kính góc starter được gắn nhãn trên Overview. Vật liệu kế thừa không bao giờ được vẽ bằng viền nét đứt, vì ở đây viền nét đứt có nghĩa là một điểm thả.

### Khi bảng màu lớn dần

Các màu của bạn nằm cạnh một bản xem trước **In context** trên màn hình rộng và xếp chồng lên trên nó ở màn hình nhỏ hơn. Bản xem trước có thể hiển thị một áp phích, biểu đồ hoặc thẻ giao diện dùng bảng màu của bạn. Các màu starter ở lại trong nhóm gấp lại riêng của chúng, tách biệt với các màu bạn thêm vào.

Thêm từng màu riêng lẻ hoặc một bộ sắc độ, gán vai trò cho chúng, và mở các phần nâng cao khi bạn cần. Biểu đồ màu, gradient và các điều khiển tải xuống vẫn đi cùng bảng màu.

![Phòng Colours sau khi thêm một màu, cùng bảng màu và một bản xem trước bố cục trực tiếp](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Roles - những gì công cụ đọc

**Roles** là lớp phủ lên trên các mẫu màu - màu nào đảm nhận vai trò nào trong mỗi công cụ và bản export. Roles là tùy chọn (một hệ thống thiết kế chỉ có ba màu rời rạc và không có role nào vẫn là một hệ thống hoàn toàn ổn), bất kỳ swatch nào cũng có thể nhận một role, và chỉ số tương phản được đo so với bề mặt, ưu tiên APCA trước.

Một hàng đọc theo một trong ba mức thể hiện, để dải màu không bao giờ khẳng định một quyết định mà không ai đưa ra:

- một màu riêng đang đảm nhận vai trò đó, ở cường độ đầy đủ;
- **Starter *Paper* stands in** - mờ nhạt, với **Choose…** trên bộ chọn của nó;
- **↳ follows Primary** - vai trò được giải quyết thông qua primary thay vì một màu riêng của nó.

Khi bảng màu đã có sắc độ, dải màu lớn thành đủ bảy ô mà một công cụ có thể đọc: Primary, Secondary, Surface, Text, Muted, Edge và On primary. On primary được suy ra từ primary, hiển thị là **Derived** và không có bộ chọn.

**Màu nhấn riêng của ứng dụng là một tùy chọn, không phải một token.** Theo mặc định, giao diện theo hệ thống thiết kế và màu nhấn của chrome lấy màu primary. Đó là một thiết lập Appearance trong [hồ sơ của bạn](/info/profile.html) - **Interface follows the design system** - và tắt nó đi sẽ để chrome ở trạng thái trung tính. Công cụ, canvas và bản export không bị ảnh hưởng dù thế nào, và font cùng bán kính góc luôn theo hệ thống thiết kế bất kể thiết lập này bật hay tắt.

### Các cánh nâng cao

Bốn mục gấp lại nằm bên dưới bản xem trước bố cục và các vai trò màu. Mở mục bạn muốn; mỗi mục đều có thể liên kết trực tiếp dưới dạng `#/start?area=color&focus=<wing>`, mở đúng mục đó dù phòng đang hiển thị gì khác:

- **Explore shades & harmonies** (`focus=generate`) - biến một màu thành cả một tập sắc độ đầy đủ. Mô tả bên dưới.
- **Shade curves** (`focus=curves`) - định hình lại một ramp từng điểm một. Lightness, chroma và hue mỗi thứ có đường cong riêng, chuyển đổi bằng L / C / H, và các sắc độ bên dưới được nướng lại trực tiếp khi bạn kéo.
- **Contrast** (`focus=contrast`) - **Contrast-lock** điều chỉnh lại tông của một ramp để đạt các mục tiêu APCA so với nền bạn chọn, mỗi bước vẫn giữ nguyên hue và chroma riêng; **Rotate hue** xoay toàn bộ ramp quanh vòng tròn màu, mọi sắc độ vẫn giữ nguyên lightness và chroma.
- **Print** (`focus=print`) - primary sẽ trở thành gì trên bản in: giá trị màn hình tự động của nó, hoặc thay vào đó là một bản dựng CMYK cố định hoặc một mực pha (spot ink) có tên riêng.

### Một màu, cả một bảng màu

Bên trong **Explore shades & harmonies**, chọn một **Starting colour**. Lolly sẽ gợi ý các sắc độ phù hợp bằng cùng phép toán màu theo cảm nhận thị giác (OKLCH) mà engine dùng ở những nơi khác. Tinh chỉnh các gợi ý:

- **Scheme** - Mono, Complement, Analogous hoặc Triad - quy định màu phụ (secondary) liên hệ với màu chính (primary) của bạn như thế nào.
- **Shades** - một thanh trượt từ 3 đến 20 (mặc định 5) kiểm soát mỗi ramp tạo ra bao nhiêu bước.
- **Fine-tune** (thu gọn) - **UI intensity** (Muted / Deep), **Contrast** (Comfort / High) và **Text on brand** (Auto / Light / Dark).

Thay đổi màu khởi đầu và các điều khiển chỉ thay đổi các gợi ý. Nhấp vào một sắc độ để thêm màu đó, hoặc **Add 5 shades** để thêm cả một nhóm (số lượng theo thiết lập Shades của bạn). Các màu và vai trò hiện có vẫn giữ nguyên vị trí. Undo sẽ xóa lượt thêm đó.

Các hàng **Primary**, **Neutral** và **Secondary** hiển thị các sắc độ được gợi ý. Mở **Theme preview** để xem các ví dụ sáng và tối cùng chỉ số tương phản của chúng. Chọn một bước Neutral hoặc Secondary ở đó để điều chỉnh các điểm neo chủ đề được đề xuất. Việc xây dựng lại toàn bộ bảng màu vẫn là một hành động riêng, được xem xét ở bên dưới.

![Ba nhóm sắc độ được gợi ý, với các điều khiển thêm riêng lẻ và một Theme preview tách biệt](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Xây dựng bảng màu (trình tạo hài hòa)

Trong **Find matching colours**, trình tạo hài hòa gợi ý các màu nhấn phù hợp từ primary. Chọn một kiểu **Harmony** - **Complementary**, **Adjacent**, **Triad**, **Tetrad** hoặc **Analogous** (kiểu này có thêm số lượng **Accents** từ 2 đến 5, và **Angle** góc từ 10° đến 45°) - và mỗi màu ứng viên xuất hiện kèm tên tự sinh dễ đọc và một nút **+ Add**. Thêm một màu sẽ đưa màu đó vào bảng màu ngay lập tức, một lần nhấn cho một token. **In context** xem trước các màu bạn đã thêm trên các bố cục mẫu.

![Các màu nhấn được tạo ra, mỗi màu có mẫu màu, tên tự sinh, mã hex và một nút Add](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Chốt một bảng màu đã tạo

Thêm một màu hoặc nhóm sắc độ được gợi ý vẫn giữ nguyên phần còn lại của bảng màu bạn. Để thay thế hoàn toàn, mở **Rebuild the whole palette…** và nhấn **Preview full rebuild**. Bản xem xét giải thích các thay đổi: bao nhiêu vai trò giữ nguyên như bạn đã gán, bao nhiêu màu bạn tự thêm được giữ lại, bao nhiêu đường cong sắc độ được neo lại, bao nhiêu khóa in được ghim lại, bao nhiêu sắc độ ẩn vẫn ở trạng thái ẩn, bao nhiêu điểm dừng gradient giữ nguyên màu.

**Apply rebuilt palette** trên thẻ đó sẽ chốt thay đổi; **Cancel** thoát ra và không thay đổi gì. Sau khi chạy xong, thẻ đưa ra nút **Undo** đã sẵn sàng focus - và một điểm khôi phục của toàn bộ hệ thống thiết kế được chụp lại *trước khi* thay đổi, nên việc "đưa nó về như cũ" là một thao tác khôi phục chứ không phải một buổi chiều công sức mất trắng.

### Bảng màu, biểu đồ và từng mẫu màu

Bảng màu liệt kê các màu của hệ thống thiết kế theo nhóm có thể gấp lại, mỗi nhóm có nút **+ Add** riêng. Tạo và đổi tên nhóm để sắp xếp công việc của bạn. Một vai trò không bao giờ tạo ra ô thứ hai: một token là một ô, và một ô mà một vai trò trỏ tới sẽ mang một dấu góc nhỏ thay vào đó (**P**, **S**, **Su**, **T**). Bên dưới các ô, **Colour chart** mở ra hai chế độ xem trên cùng một bộ mẫu màu: **Wheel** (bánh xe OKLCH - kéo một điểm để đổi màu, nhấp vào một điểm để chỉnh sửa hoặc nhấp vào chỗ trống để thả thêm một mẫu màu mới) và biểu đồ **Gamut**, cho thấy dải hiển thị thực sự kết thúc ở đâu. `#/start?area=color&focus=chart` mở thẻ này trực tiếp, giống như `?wheel` luôn làm.

![Bảng bảng màu, mọi nhóm có thể gấp lại, với nút tải xuống đặt ở mép dưới cùng](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Bánh xe OKLCH - góc là sắc độ (hue), khoảng cách ra ngoài là độ bão hòa (chroma) và các màu xám chạy theo một dải độ sáng dọc theo cạnh bên](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Nhấp vào bất kỳ mẫu màu nào để mở trình chỉnh sửa của nó:

- **Rename** nó.
- **Set the colour** - trình chọn màu mở ra với các thanh trượt cảm nhận **OKLCH**, có các chế độ **Hex**, **HSL**, **RGB** và **CMYK**; ô giá trị đọc *và* ghi ở bất kỳ không gian nào đang hoạt động, nên bạn có thể dán mã hex hoặc nhập tỷ lệ phần trăm mực. Lưu ý rằng nhập CMYK sẽ đặt màu *trên màn hình* thông qua chuyển đổi - để ghim đúng giá trị mực, dùng khóa in bên dưới.
- **Stored as** - chọn cách mẫu màu được lưu trữ: **LCH** (mặc định - cảm nhận, dải màu rộng, lựa chọn tốt nhất khi chỉnh sửa), Hex, RGB hoặc HSL. Ghi đè khi bạn cần ghim đúng một mã hex cũ hoặc khớp một giá trị sRGB.
- **Use as** - gán trực tiếp mẫu màu này cho một trong các vai trò thương hiệu, không cần quay lại bảng Roles. (Ô của một vai trò không có tùy chọn này - một vai trò không thể nhận một vai trò khác.)
- **Print substitutes** (gấp lại) - khóa hành vi in của màu:
  - **CMYK** - chuyển từ **Auto** sang **Locked** để ghi đè việc chuyển đổi sRGB→CMYK tự động bằng các giá trị mực chính xác (C/M/Y/K, 0-100).
  - **Spot colour** - chuyển từ **None** sang **Set** để khóa mẫu màu vào một màu pha (spot colour); đặt cho nó một **Name** (ví dụ `PANTONE 186 C`), một **Book** tùy chọn và một **Finish** tùy chọn (Ordinary ink theo mặc định) cho trường hợp mực hoàn toàn không phải mực - một lớp foil, dập nổi hoặc dập chìm, một lớp verni bóng cục bộ, hiệu ứng soft touch hoặc bế, cấn nếp gấp hoặc đục lỗ.
- **In other spaces** (gấp lại) - cùng ý tưởng đó nhưng mở rộng: mỗi hàng là một không gian màu mà mẫu màu này có thể biểu diễn, hoặc được suy ra từ giá trị gốc hoặc do bạn tự đặt, và giá trị tự đặt sẽ thắng khi xuất.

Các khóa in này là những gì một xưởng in sử dụng khi bạn xuất một PDF hoặc TIFF CMYK - xem [Exporting](/info/exporting.html#colour-profiles).

**Xóa một mẫu màu** là an toàn: các bước dải màu suy ra và các vai trò giao diện chỉ bị *ẩn đi* (token gốc vẫn tiếp tục phân giải, nên không có gì phía sau bị gãy), trong khi các màu bạn tự thêm vào sẽ bị xóa hẳn.

### Làm việc với nhiều mẫu màu

Mỗi mẫu màu có một tay cầm kéo riêng. Kéo nó để sắp xếp lại các màu trong nhóm của nó, hoặc focus vào nó, nhấn Space, dùng phím mũi tên, rồi nhấn Space lần nữa để thả. Escape hủy bỏ. Thứ tự vẫn giữ nguyên khi mở lại studio và có thể hoàn tác. Để di chuyển màu giữa các nhóm, dùng điều khiển **Group** của trình chỉnh sửa mẫu màu hoặc chọn nhiều màu và dùng **Move**. Tên token và tham chiếu vai trò vẫn giữ nguyên.

Việc chọn trong bảng màu là một cử chỉ, không phải một chế độ. Không có nút nào cần nhấn trước, và thanh công cụ xuất hiện cùng ô đầu tiên được chọn và biến mất cùng ô cuối cùng.

- **Kéo trên khoảng trống của bảng** để vẽ một hình chữ nhật: mọi ô mà nó chạm vào sẽ gia nhập lựa chọn, xuyên qua ranh giới nhóm. Một mục đã gấp lại không đóng góp gì, và một lượt kéo không hề di chuyển sẽ xóa lựa chọn.
- **Shift-click** lấy cả một dải theo thứ tự đọc; **Cmd/Ctrl-click** bật/tắt một ô; một cú nhấp thường vẫn mở trình chỉnh sửa của ô đó.
- Mỗi tiêu đề nhóm đều có **Select all**, và **Cmd-A** khi một ô đang focus sẽ chọn mọi màu mà hệ thống thiết kế sở hữu - không bao giờ chọn một màu starter.
- Lưới chỉ có một điểm dừng tab. Mũi tên di chuyển qua nó, Shift-mũi tên mở rộng lựa chọn, Space bật/tắt một ô, Delete xóa lựa chọn và Escape xóa lựa chọn đó. (Mũi tên chỉ di chuyển focus: để chỉnh một kênh màu, nhấn `l`, `c` hoặc `h` trước, như phần đọc số cho biết.)
- Trên màn hình cảm ứng thì không có hình chữ nhật. Nhấn giữ một ô để bắt đầu chọn, rồi chạm để thêm; **Select all** theo từng nhóm sẽ chọn phần còn lại.

Thanh công cụ hiển thị **{n} selected**, rồi đến **Move to** (một nhóm có sẵn, hoặc một nhóm mới bạn đặt tên ngay trong menu), **Give a role** (mỗi màu được chọn nhận vai trò kế tiếp lần lượt, nên bốn ô sẽ lấp đầy cả bốn vai trò chỉ trong một lần nhấn), **Download** (lựa chọn ở bất kỳ định dạng nào trong sáu định dạng bảng màu), **Copy values** (một dòng cho mỗi màu theo ký hiệu đã lưu của nó) và **Delete**. Move to và Give a role chỉ xuất hiện khi bảng màu đã có sắc độ để di chuyển. Một lần Ctrl/Cmd-Z hoàn tác cả một hành động hàng loạt - một lượt di chuyển bốn mươi màu, một lượt gán vai trò, một lượt xóa - và một lượt xóa cho biết nó đã giữ lại những gì, vì một lựa chọn có thể chạm tới những ô mà phòng này không xóa.

### Gradient

Một bảng **Gradients** tùy chọn xây dựng các token pha trộn từ bảng màu cho nền và điểm nhấn. Bỏ qua hoàn toàn nếu hệ thống thiết kế không dùng gradient. Mỗi gradient có một bản xem trước, các điểm dừng có tên (2–8) và một góc. Hành vi mấu chốt: **một điểm dừng tham chiếu đến một mẫu màu**, nên đổi màu mẫu đó thì gradient sẽ theo. Phép nội suy chạy trong không gian OKLCH để có các dải chuyển màu sạch. Xóa một điểm dừng để rút gọn dải.

### Mang bảng màu đi nơi khác

Nút nổi đặt ở mép dưới của bảng bảng màu cho phép tải xuống toàn bộ bảng màu dưới dạng **Design tokens (JSON)**, **CSS variables**, **CSS classes**, **SCSS variables**, một **GIMP palette (.gpl)** hoặc một **Adobe Swatch Exchange (.ase)** - để hệ thống thiết kế chuyển thẳng vào Illustrator, Figma, GIMP hoặc một stylesheet. Nút này nằm ngoài vùng cuộn của bảng, nên nó luôn giữ nguyên vị trí dù bảng màu cuộn đến đâu, và nó xuất hiện khi bảng màu đã có sắc độ. (Bạn cũng có thể tải bảng màu xuống từ [Tài sản](/info/using.html#assets-your-library).)

## Type

Phòng này cũng lớn dần theo cách tương tự. Khi chưa có kiểu chữ riêng, nó chỉ là một thẻ và một quyết định: **Primary**, đặt ở cỡ đọc trong kiểu chữ đang phục vụ nó hôm nay, một nhãn **Starter** bên cạnh tên, một nút **Choose a face** đã tô đậm và dòng *"Nothing installs until you choose one."* Bên dưới thẻ là dòng *"Headings, code and italic follow the primary until you choose them"*, với **Choose them separately** mở ra ba thẻ còn lại cho phần còn lại của lượt truy cập.

![Phòng Type khi chưa chọn kiểu chữ nào - một thẻ ở cỡ đọc, mang nhãn Starter, và một nút Choose a face đã tô đậm](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Chọn một kiểu chữ và phòng sẽ mở rộng thành **bốn thẻ vai trò**, danh sách Fonts và mẫu trực tiếp. Bốn kiểu chữ đó là những gì ứng dụng, các công cụ và mọi bản export thực sự đọc theo:

- **Primary** - nội dung chính, các nút và mọi công cụ.
- **Headings** - kiểu chữ hiển thị cho `h1`/`h2`.
- **Code** - một kiểu chữ đơn cách cho mã và dữ liệu.
- **Italic** - một kiểu chữ nghiêng thật đi kèm để nhấn mạnh, trích dẫn và các đoạn phụ.

Headings, code và italic đều mặc định quay về primary cho đến khi bạn gán chúng, nên một hệ thống thiết kế chỉ dùng một kiểu chữ không cần quyết định gì ở đây cả.

**Một tint có nghĩa là bạn đã chọn nó.** Một thẻ chỉ được tô màu ở nơi bạn đã cài kiểu chữ đó. Một kiểu chữ starter mang cùng nhãn **Starter** mà các nhóm kế thừa của bảng màu mang, ở mức thể hiện mờ và không có tint, và một vai trò chưa ai chọn sẽ đọc là **↳ follows Primary** thay vì lặp lại tên của primary như thể nó đã được chọn. Nút bấm ghi **Change** trên một kiểu chữ của riêng bạn và **Choose a face** ở mọi nơi khác. Không có gì trên thẻ chốt lại bất cứ điều gì: nút bấm mở ra **compare stage** giới hạn trong vai trò đó.

![Bốn thẻ vai trò được mở ra - mỗi thẻ đặt trong kiểu chữ phục vụ nó, mang nhãn Starter ở nơi chưa ai chọn, và Italic đang theo primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Compare stage

![Compare stage mở ra bên dưới thẻ của nó, với hàng tìm kiếm, các họ font đã ghim và các thẻ gấp lại thành một dải một dòng](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

Compare stage mở ra **ngay trong phòng**, không phải trong hộp thoại, và ngay bên dưới thẻ bạn đã nhấn. Trong khi nó đang mở, các thẻ khác gấp lại thành một dải một dòng gồm vai trò và kiểu chữ, nên stage luôn nằm trên màn hình đầu tiên kể cả trên điện thoại. Escape hủy bỏ và trả lại bàn phím cho thẻ mà bạn đã mở nó từ đó.

Chọn một kiểu chữ chỉ mất ba lần nhấn:

1. **Choose a face** trên thẻ.
2. Gõ tên một họ font và nhấn **Preview** - hoặc nhấn một trong sáu họ font **Pinned** dưới ô nhập, mỗi lần nhấn một họ. Thẻ hiện ra như đang tải, với một thanh khung xương ở chỗ mẫu chữ sẽ xuất hiện, thay vì kiểu chữ giao diện đứng tạm cho một kiểu chữ bạn chưa từng thấy.
3. **Use this face**.

**Sự đồng ý chỉ được hỏi một lần, ngay tại lần nhấn bạn đã thực hiện.** Lần đầu tiên một bản xem trước chạm tới Google Fonts, một hộp thoại cho biết điều gì sẽ xảy ra: *Google biết tên họ font và địa chỉ IP của bạn. Sau đó tệp được giữ trên thiết bị này và dùng ngoại tuyến. Đây là bước duy nhất trong studio chạm tới bên thứ ba.* **Fetch from Google** tiếp tục và được ghi nhớ. **Cancel** để lại thẻ với dòng chữ *"Not fetched. Nothing was sent to Google."* cùng nút **Fetch from Google** trực tiếp của riêng nó, nên đổi ý chỉ mất một lần nhấn ngay trên thẻ. Không thẻ nào từng hiển thị một nút chết: dù đang ở trạng thái nào, nút chính duy nhất của nó luôn cho biết bước tiếp theo là gì.

**Thả một tệp font vào stage** và nó xem trước ngay lập tức - **TTF**, **OTF** hoặc **WOFF** từ chính máy của bạn, đây là con đường cho một font doanh nghiệp có bản quyền mà bạn đã sở hữu. Vùng thả đó là cánh cửa tệp duy nhất trong phòng này.

Dù theo cách nào thì kiểu chữ vẫn ở lại trên thiết bị này, hiển thị trong ứng dụng, trong các công cụ và trong mọi bản xuất, hoạt động ngoại tuyến vĩnh viễn và di chuyển trong tệp hệ thống thiết kế - không có gì được tải về vào lúc render. Mọi thứ trên Google Fonts đều phát hành theo giấy phép mở (OFL/Apache/UFL).

### Fonts on this device

Bảng **Fonts** liệt kê mọi kiểu chữ mà thiết bị này đang có và vai trò nó phục vụ. Các kiểu chữ bạn đã thêm dẫn đầu dưới mục **In the design system**, mỗi kiểu có vai trò riêng và một nút xóa, và kiểu đang phục vụ Primary mang một huy hiệu. Các kiểu chữ starter theo sau trong một hàng gấp lại - *Starter · SUSE, SUSE Mono · serving Primary and Code until you choose* - mờ nhạt, không có nút xóa và không có gì để nâng cấp, vì cả hai đều không phải là quyết định của ai cả. **Add a face** mở ra cùng compare stage nhưng không giới hạn vai trò.

Bảng **Type roles** ở cuối trang hiển thị một mẫu trực tiếp của từng vai trò - body và giao diện ở kiểu chữ chính, một kiểu chữ hiển thị tùy chọn cho các tiêu đề trên cùng, một kiểu nghiêng để nhấn mạnh, một kiểu đơn cách cho mã và dữ liệu - kèm họ font và trạng thái của nó bên cạnh mỗi vai trò (*Inter*, *SUSE · starter*, *SUSE · follows Primary*), để cả bộ có thể đọc được cùng lúc.

## Tokens

Phần còn lại của hệ thống thiết kế, có thể chỉnh sửa mà không cần đụng đến mã:

![Khu vực Tokens - một thanh trượt bán kính góc cùng khoảng cách, kích thước, đổ bóng và phần còn lại của hệ thống](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Rounded corners** - một thanh trượt bán kính duy nhất (0–1.5rem) mà các thẻ, nút và bảng trong toàn ứng dụng đều tuân theo.
- **Neutrals** - dải màu mực-trên-giấy đi kèm một bản cài đặt mới, liệt kê dưới dạng **Neutrals · starter · 9** với chín bước của nó và một nút **Open** vào bảng Colours. Đây là nơi duy nhất quản lý các màu trung tính starter, và nhãn *starter* biến mất ngay khi dải màu được tạo ra thay vì được kế thừa.
- **More tokens** - thêm và chỉnh sửa **spacing**, **sizing**, **stroke width**, **opacity**, **rotation**, **numbers** thuần và **shadows**. Chọn một loại, đặt tên (*Gutter, Card shadow…*) và đặt giá trị của nó. Các giá trị này được lưu dưới dạng [design token](/info/design-tokens.html) chuẩn (DTCG) và đi cùng hệ thống thiết kế.

## Files

Thả vào đây các tệp mà thương hiệu của bạn lưu giữ - ngoại trừ logo: tài sản **vector**, **image**, **audio** và **motion** (video, Lottie, hoạt hình). Chúng sẽ nằm trong [Tài sản](/info/using.html#assets-your-library), được sắp xếp theo phần và sẵn sàng trong trình chọn tài sản của mọi công cụ. Mọi thứ đều ở lại trên thiết bị này. (Thanh bên gọi khu vực này là **Files**; khóa URL vẫn là `catalogue`, vì khóa của một bảng là một hợp đồng vĩnh viễn.)

## Mang một thương hiệu vào

**Add from…** ở cuối thanh bên mở một bộ chọn hai bước. Bước đầu tiên hỏi bạn *đang có* gì, chứ không phải định dạng gì:

- **Design tokens or a design file** - DTCG hoặc Tokens Studio JSON, một dự án Penpot, một **zip chứa các bộ token**, một gói hệ thống thiết kế Lolly hoặc một SVG.
- **PDF** - một bản trình bày hoặc một tệp hướng dẫn thương hiệu, được đọc trên thiết bị này để lấy màu sắc, dấu cắt và các kiểu chữ được nhúng.
- **Logo or screenshot** - một hình ảnh trở thành một bảng màu được gợi ý, đọc trên thiết bị này. Không có gì được tải lên. Bước này chỉ đọc màu sắc, không đọc kiểu chữ hay bố cục trong hình.
- **Saved web page** - chọn một tệp HTML và các tệp CSS của nó, hoặc dán HTML hay CSS. Tối đa 20 tệp và 2 MB tổng cộng. Chỉ văn bản được cung cấp mới được đọc; các tài nguyên liên kết không được tải về và script không chạy. Con đường này cũng hoạt động mà không cần tiện ích mở rộng hay ứng dụng desktop.
- **Font file** - TTF, OTF hoặc WOFF. Mở khu vực Type, nơi kiểu chữ được cài đặt.
- **Website** - một trang, được đọc để lấy màu sắc và kiểu chữ. Ô này chỉ xuất hiện trên thiết bị thực sự có thể đọc một trang, vì một ô bị vô hiệu hóa mà vẫn quảng cáo thứ không ai bấm được thì còn tệ hơn là không có ô nào cả. Ở nơi nó xuất hiện, nó nêu rõ ràng ai đang đọc: được ứng dụng lấy về trên thiết bị này, hoặc được đọc qua tiện ích mở rộng trình duyệt trong một tab nền, đăng nhập với tư cách bạn. Việc nhập một URL chỉ *điền sẵn* vào ô - nút lấy về mới là sự đồng ý, nên một liên kết ai đó gửi cho bạn không bao giờ có thể tự khởi động một lượt đọc.

Chọn nguồn tệp thiết kế và bước thứ hai là thẻ bên dưới: các định dạng được chấp nhận dẫn đầu dưới dạng ô biểu tượng theo thứ tự ưu tiên, và toàn bộ thẻ là một vùng thả duy nhất - nhấp vào bất kỳ đâu trên đó hoặc kéo một tệp thả vào đó. Bạn cũng có thể thả một tệp thẳng vào studio.

![Thẻ nhập - các định dạng được chấp nhận dẫn đầu dưới dạng ô biểu tượng, và toàn bộ thẻ là một vùng thả duy nhất](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Mỗi tệp thiết kế mang lại cho bạn những gì:

- một **gói hệ thống thiết kế Lolly** (`.lolly`; vẫn chấp nhận đuôi `.zip` cũ) - cài đặt trong một bước;
- một bản xuất **Penpot** (`.penpot`) - kéo các design token của nó vào;
- một tệp **Design Tokens** (`.json`) - W3C DTCG;
- một tệp **Tokens Studio** (`.json`) - Tokens Studio;
- một tệp **SVG** thuần (`.svg`) - Lolly quét các màu của nó và cho bạn chọn màu nào cần giữ, màu đầu tiên trở thành màu chính của bạn.

Một logo/ảnh chụp màn hình, website hoặc trang đã lưu sẽ mở **Your suggested design system**. Xem một ví dụ dùng các màu được đề xuất, chọn một **Main colour** khác nếu cần, và đặt tên cho hệ thống. **Use this design system** áp dụng các bảng màu sáng và tối đã tạo ra và quay lại Overview. Các font hiện có vẫn giữ nguyên. Việc này thay thế màu sắc và các thiết lập token khác của hệ thống đang hoạt động. Một checkpoint phải thành công trước; **Restore brand settings** khôi phục lại các thiết lập trước đó.

**Source details and individual choices** cho biết những gì đã được đọc, tên font được phát hiện và độ tương phản văn bản/hành động của bản xem trước. Nó cũng đưa ra **Choose individual items in the tray** và **Download design context**. Báo cáo JSON mang theo các quan sát, token được đề xuất và thông tin nguồn; HTML/CSS đã lưu bao gồm một mã SHA-256 của văn bản được cung cấp. Nó không chứa văn bản trang thô và không phải là một Content Credential đã ký. Tên font chỉ là gợi ý: Type vẫn là nơi để chọn và cài đặt font.

Các lượt nhập PDF và tệp thiết kế khác vẫn giữ nguyên các điều khiển xem xét hiện có. Các mục được giữ trong **Tray** không thay đổi gì cho đến khi được thêm vào thông qua phòng sở hữu loại vật liệu đó.

`#/start?source=<kind>` mở bộ chọn trên một nguồn cho trước (`file`, `pdf`, `image`, `font`, `url`, `page`), và `?import` mở nó trên danh sách thuần.

## Di chuyển một thương hiệu giữa các thiết bị

**Export** ở cuối thanh bên ghi ra một tệp **`LollyBrand-….lolly`** duy nhất - token, font, logo và tùy chọn giao diện của bạn, kèm một tệp kê khai toàn vẹn được xác minh khi đưa trở lại. Các bản phát hành web trước 1.0.7 đặt tên cùng payload đó là `.zip`; cách viết cũ đó vẫn được chấp nhận. Bên cạnh đó, **Tokens (.json)** ghi ra tài liệu design token thuần túy một mình: không font, không logo, chỉ có token - đây là thứ mà một kho mã, một bước CI hoặc một công cụ token khác thực sự đọc được.

Đưa một tệp trở lại là **Add from… → Design tokens or a design file** (ở trên), hoặc kéo và thả vào studio. Đây là cách một đồng nghiệp trao cho bạn một thương hiệu, hoặc cách bạn mang một thương hiệu sang một lần cài đặt thứ hai - không cần tài khoản, không cần đám mây. Để mang một thương hiệu vào từ dòng lệnh thay vì vậy, xem [`ingest:brand`](/info/configuration.html#brand-packs).

## Khôi phục thiết lập trước đó

Chọn **Restore brand settings** ở cuối thanh bên, chọn một checkpoint có ngày tháng, rồi nhấn **Restore**. Thao tác này khôi phục màu sắc, thiết lập kiểu chữ và các token thương hiệu khác cho thương hiệu đang hoạt động. Các tệp font và hình ảnh vẫn giữ nguyên.

Lolly lưu các thiết lập hiện tại của bạn dưới dạng **Before restore** trước khi áp dụng checkpoint. Chọn checkpoint đó để đảo ngược lượt khôi phục, kể cả sau khi đóng và mở lại trình duyệt. 20 checkpoint gần nhất được giữ trên thiết bị này. Nếu không đọc được bộ nhớ hoặc không lưu được các thiết lập hiện tại, hộp thoại sẽ báo lỗi để bạn thử lại.

## Phiên bản

**Versions** ở cuối rail là nơi một hệ thống thiết kế ngừng là một mục tiêu di động. Publish một phiên bản và bạn có được một **bản sao vĩnh viễn, có tên** được giữ trên thiết bị này: nó không bao giờ thay đổi sau đó, nên một công cụ ghim vào nó sẽ luôn vẽ ra cùng một thứ. Bảng điều khiển này vẫn ẩn cho đến khi có điều gì đó của riêng bạn để publish, nên một studio chưa bao giờ publish sẽ không bao giờ thấy các điều khiển này.

Ba điều cần biết trước khi bạn nhấn bất cứ nút nào, và bảng điều khiển nói cả ba điều đó trước khi bạn nhấn chứ không phải sau:

- **Một phiên bản là vĩnh viễn.** Hiện chưa có chức năng xóa, nên bảng điều khiển nói rõ điều gì đã được giữ lại và rằng nó sẽ tiếp tục được giữ lại, thay vì đưa ra một nút bấm nói dối.
- **Việc gỡ bỏ dẫn đầu thẻ tương thích.** Các token được thêm và thay đổi là tin tức; một token bị *gỡ bỏ* mới là điều làm hỏng một công cụ, nên nó được nêu tên đầu tiên và được gọi đúng bản chất của nó.
- **Việc publish không thể hoàn tác; việc khôi phục thì có thể.** *Restore latest from this version* là một chỉnh sửa thông thường vào head, nên nó được đưa vào ngăn xếp undo của studio và bảng điều khiển sẽ cung cấp cho bạn **Undo** ngay lập tức.

Bạn có thể **Chỉ xuất bản**, hoặc **Xuất bản và đặt làm bản đang dùng** - khác biệt ở chỗ liệu công cụ và ứng dụng có theo phiên bản đó từ nay trở đi hay tiếp tục theo chỉnh sửa mới nhất của bạn. **Theo bản mới nhất trở lại** đưa mọi chỉnh sửa lên trực tiếp ngay khi nó được thực hiện. `#/start?area=versions` mở bảng điều khiển này trực tiếp.

## Khi thương hiệu đã cố định

Một số bản build đi kèm **hệ thống thiết kế bị khóa**, chẳng hạn SUSE Brand. Mở nó sẽ hiển thị một ghi chú chỉ đọc với **Make an editable copy** và **Switch**. Màu sắc, font và token gốc của nó vẫn giữ nguyên. Các hệ thống cục bộ của riêng bạn vẫn có thể chỉnh sửa, ngay cả khi hệ thống bị khóa là hệ thống đầu tiên trên thiết bị. Trong Profile, **Open** chọn một hệ thống và mở studio của nó; **Make a new one** tạo một hệ thống cục bộ và mở nó tại `#/start` với ô tên đang được focus.

## Đi tiếp từ đâu

- **[Sử dụng Lolly](/info/using.html)** - canvas, lưu, dự án và Tài sản.
- **[Design Tokens](/info/design-tokens.html)** - mô hình token mà thương hiệu của bạn được thể hiện qua đó.
- **[Xuất & định dạng](/info/exporting.html)** - đơn vị in ấn, CMYK và các định dạng thương hiệu của bạn kết xuất ra.


## Tìm và so sánh một diện mạo

Mở **Find a look** từ Overview hoặc danh sách hệ thống thiết kế trên Profile. Duyệt các hệ thống đã lưu trên thiết bị này và một vài ví dụ Lolly có thể tái sử dụng. Tìm theo tên, nhãn màu hoặc font đã khai báo. **Closest to my current palette** sắp xếp theo mức độ giống nhau về màu đã đo được, với các họ font trùng khớp dùng để phân định khi bằng nhau; đây không phải là một điểm chất lượng.

Chọn một diện mạo để xem xét, hoặc hai để so sánh. Nút xem xét vẫn khả dụng trên màn hình nhỏ. Chọn một diện mạo không thay đổi gì cả. **Use this saved system** chuyển qua registry hệ thống thiết kế hiện có. **Use these colours** áp dụng một ví dụ qua quy trình checkpoint và cài đặt thông thường, giữ nguyên các font hiện tại. **Restore brand settings** có thể khôi phục lại diện mạo trước đó.

Trong **Details and design context**, các hệ thống đã lưu có **Search tags** có thể chỉnh sửa và một bản tải context. Các ví dụ dùng công thức màu gốc của Lolly; không có bộ sưu tập cảm hứng thu thập từ xa hay yêu cầu tài khoản nào.

![So sánh Sunroom và Orchard cạnh nhau trước khi áp dụng một trong hai hệ thống màu.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

Bản so sánh giữ cả hai bảng màu hiển thị cùng nhau. Xem xét một diện mạo không thay đổi gì cho đến khi bạn chọn **Use these colours** hoặc **Use this saved system**.

## Đọc bằng chứng nguồn

Các chi tiết tùy chọn của bản xem xét nguồn hiển thị kiểu chữ, khoảng cách, padding và giá trị góc ở nơi được quan sát thấy. HTML/CSS đã lưu và các lượt đọc website gốc báo cáo các khai báo, có thể không được trang đã kết xuất sử dụng. Tiện ích mở rộng trình duyệt có thể báo cáo các kiểu đã đo từ một mẫu giới hạn các phần tử hiển thị, cùng viewport và tùy chọn màu trình duyệt của nó. Các tiện ích mở rộng cũ hơn vẫn hoạt động với các kiểu đã khai báo. Các trường còn thiếu ghi **Not observed**.

Đây là các quan sát, không phải thiết lập kiểu tự động. Các tệp font không được tải về hay cài đặt bởi một lượt scan tham chiếu, và khoảng cách từ nguồn không âm thầm thay thế khoảng cách của riêng bạn. Các con số mô tả số lần xuất hiện trong mẫu, không phải độ tin cậy hay chất lượng.

## Kiểm tra một bố cục so với hệ thống thiết kế

Trong Design, mở **Export**, rồi **Before you export**. Lượt kiểm tra dùng đúng phiên bản hệ thống thiết kế đang có hiệu lực như bản render. Nó so sánh màu sắc đã soạn, bí danh token, lựa chọn font và ID tài sản hình ảnh. Giá trị tùy chỉnh có thể là chủ đích; một hình ảnh nằm ngoài các tài sản thương hiệu đã khai báo là một mục cần xem xét, không phải một hình ảnh bị cấm.

Ở nơi có sẵn một gợi ý cụ thể về màu hoặc font, nút của nó chỉ thay đổi lớp đó. **Undo** thông thường khôi phục lại giá trị gốc. Các lớp đã khóa hoặc đã thay đổi không bị ghi đè bởi một gợi ý cũ. Bằng chứng nguồn còn thiếu vẫn tách biệt với một sự khớp. Độ tương phản đã render và bố cục văn bản được kiểm tra bởi các lượt kiểm tra hiện có đã tích hợp sẵn. Gradient, hiệu ứng, nội dung công cụ lồng nhau, quyền và chất lượng chủ quan không được đánh giá bởi lượt so sánh thương hiệu. Các lượt kiểm tra không chặn Download.

## Dùng design context tại chỗ

**Download design context** bao gồm tài liệu token, các màu đã giải quyết, các họ font đã khai báo, ID tài sản, bằng chứng nguồn nếu có ghi nhận, phạm vi bao phủ và các quy tắc rõ ràng. Nó không bao gồm tệp font hay bằng chứng sở hữu. Bản xem xét tham chiếu cũng bao gồm các token được đề xuất và các quan sát của nó.

CLI có thể đọc một trong hai bản tải này mà không cần máy chủ:

```bash
lolly system import ./lolly-design-context.json
lolly system context --output=design-context.json
lolly system check ./design-inputs.json --file=design-context.json
```

`system check` chấp nhận đầu vào Design với một mảng `boxes` hoặc một tài liệu Design đã biên dịch. Nó báo cáo các sửa chữa được đề xuất mà không sửa đổi bố cục. Nó không thể đo bố cục trình duyệt hay độ tương phản đã render. Tài nguyên MCP hiện có **lolly://design-context** hiển thị context của hệ thống đang có hiệu lực thông qua tiến trình MCP cục bộ đã cấu hình; không cần dịch vụ lưu trữ mới hay khóa API nào.
