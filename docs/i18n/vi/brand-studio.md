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
- **Export** - ghi ra toàn bộ thương hiệu dưới dạng một tệp `LollyBrand-…zip`.
- **Tokens (.json)** - tài liệu design-tokens thuần túy, độc lập, dùng cho một repo, một bước build hoặc một công cụ tokens khác.
- **Versions** - publish, activate và khôi phục các bản sao có tên của hệ thống thiết kế. Ẩn cho đến khi có thứ gì đó của riêng bạn để publish (hoặc một liên kết `?area=versions` yêu cầu đích danh).

![Thanh rail phòng của studio - Overview, Colours, Type, Logos, Tokens và Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Overview

Overview là phòng bạn đặt chân vào đầu tiên, và nó có hai diện mạo.

Khi **chưa thiết lập gì cả**, nó đưa ra hai lối đi - **Start from a file** (design tokens, một dự án Penpot, một gói design system hoặc một tệp SVG) và **Start from scratch** (thêm một màu, rồi tiếp tục bất cứ khi nào bạn muốn) - cùng một lối thoát **Explore the tools** lặng lẽ bên dưới, vì việc rời đi cũng là một lựa chọn hợp lệ.

Khi một hệ thống thiết kế đã tồn tại, cùng phòng đó sẽ hiển thị **những gì bạn đang có**: bảng màu và số lượng màu của nó, các họ font đang dùng, bao nhiêu ô logo đã được lấp đầy, có bao nhiêu token và phòng Files. Mỗi khối là một lối vào phòng của nó. Ở đây chỉ có số lượng, không bao giờ có thanh tiến trình và không bao giờ có thẻ hoàn tất - không có gì trong studio này là một nghĩa vụ phải hoàn thành.

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

![The Colours room after one colour - the two panes back, the generate offer, roles reading in three registers and the pane at one colour](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

Phòng phong phú nhất, gồm hai khung. Khung trái là nơi bạn làm việc; khung phải là **bảng màu trực tiếp (live palette)** của bạn. Kéo thanh chia giữa chúng để đổi kích thước (nhấn Enter trên thanh đó sẽ thu gọn bảng màu sang một bên).

![Phòng Colours - một màu chính suy ra các ramp, các thẻ mẫu kèm tỷ lệ tương phản và một bảng màu trực tiếp](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Thêm một màu, rồi giao cho nó một nhiệm vụ

**Add a colour** là toàn bộ con đường đơn giản: dán hoặc chọn một màu ở bất kỳ ký hiệu nào và nó trở thành đúng một token. Không có gì được suy ra từ nó, không có gì được gợi ý thêm vào nó, không có gì khác được yêu cầu. Dán cả một *danh sách* màu và mỗi màu sẽ trở thành một chip mà bạn có thể tự thêm vào.

**Roles** là lớp phủ lên trên - màu nào đảm nhận vai trò nào. Roles là tùy chọn (một hệ thống thiết kế chỉ có ba màu rời rạc và không có role nào vẫn là một hệ thống hoàn toàn ổn), bất kỳ swatch nào cũng có thể nhận một role, và chỉ số tương phản được đo so với bề mặt, ưu tiên APCA trước.

### Các cánh nâng cao

Bốn mục thu gọn nằm bên dưới hai mục đó. Mở mục bạn muốn; mỗi mục đều có thể liên kết trực tiếp dưới dạng `#/start?area=color&focus=<wing>`:

- **Generate a starter palette** (`focus=generate`) - biến một màu thành cả một tập sắc độ đầy đủ. Mô tả bên dưới.
- **Shade curves** (`focus=curves`) - định hình lại một ramp từng điểm một. Lightness, chroma và hue mỗi thứ có đường cong riêng, chuyển đổi bằng L / C / H, và các sắc độ bên dưới được nướng lại trực tiếp khi bạn kéo.
- **Contrast** (`focus=contrast`) - **Contrast-lock** điều chỉnh lại tông của một ramp để đạt các mục tiêu APCA so với nền bạn chọn, mỗi bước vẫn giữ nguyên hue và chroma riêng; **Rotate hue** xoay toàn bộ ramp quanh vòng tròn màu, mọi sắc độ vẫn giữ nguyên lightness và chroma.
- **Print** (`focus=print`) - primary sẽ trở thành gì trên bản in: giá trị màn hình tự động của nó, hoặc thay vào đó là một bản dựng CMYK cố định hoặc một mực pha (spot ink) có tên riêng.

### Một màu, cả một bảng màu

Bên trong **Generate a starter palette**, chọn một **Primary colour** và Lolly sẽ tính ra một bảng màu hoàn chỉnh - bề mặt sáng và tối, văn bản, màu nhấn và các ramp tint/shade đầy đủ - dùng cùng phép toán màu theo cảm nhận thị giác (OKLCH) mà engine dùng ở khắp mọi nơi. Tinh chỉnh cách suy ra:

- **Scheme** - Mono, Complement, Analogous hoặc Triad - quy định màu phụ (secondary) liên hệ với màu chính (primary) của bạn như thế nào.
- **Shades** - một thanh trượt từ 3 đến 20 (mặc định 5) kiểm soát mỗi ramp tạo ra bao nhiêu bước.
- **Fine-tune** (thu gọn) - **UI intensity** (Muted / Deep), **Contrast** (Comfort / High) và **Text on brand** (Auto / Light / Dark).

Không có gì trong cánh này ghi bất cứ thứ gì vào thương hiệu của bạn. Đây chỉ là bản xem trước, trực tiếp trên toàn ứng dụng để bạn đánh giá, cho đến khi bạn nhấn **Replace palette** (bên dưới).

Bên dưới màu chính, bạn sẽ thấy các ramp **Primary / Neutral / Secondary / Blend** trực tiếp cùng các thẻ mẫu Light và Dark, mỗi thẻ mang chỉ số tương phản riêng - tỷ lệ WCAG kèm con số APCA `Lc` bên cạnh. **Nhấp vào một bước trong ramp Neutral hoặc Secondary** để ghim cố định sắc độ đó thay vì dùng giá trị mặc định được suy ra.

![Bốn dải ramp xếp chồng phía trên các thẻ mẫu sáng và tối, mỗi thẻ mang tỷ lệ tương phản WCAG riêng](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Xây dựng bảng màu của bạn (trình tạo hài hòa)

Vẫn trong cùng khu vực, **Build your palette** tạo ra các màu nhấn phù hợp từ màu chính của bạn. Chọn một kiểu **Harmony** - **Complementary**, **Adjacent**, **Triad**, **Tetrad** hoặc **Analogous** (kiểu này có thêm số lượng **Accents** từ 2 đến 5, và **Angle** góc từ 10° đến 45°) - và mỗi màu ứng viên xuất hiện kèm tên tự sinh dễ đọc và một nút **+ Add**. Thêm một màu sẽ đưa màu đó vào bảng màu của bạn ngay lập tức, một lần nhấn cho một token. *"Your palette, applied"* xem trước toàn bộ bộ màu trên các đồ họa thực.

![Các màu nhấn được tạo ra, mỗi màu có mẫu màu, tên tự sinh, mã hex và một nút Add](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Chốt một bảng màu đã tạo

**Replace palette** là điều khiển duy nhất trong khu vực này thực sự ghi thay đổi, và nó không bao giờ ghi ngay lập tức. Nhấn vào đó và một thẻ xem xét sẽ mở ra trước, tiêu đề **"Replace the palette?"**, liệt kê chính xác những gì sắp xảy ra: bao nhiêu vai trò giữ nguyên như bạn đã gán, bao nhiêu màu bạn tự thêm được giữ lại, bao nhiêu đường cong sắc độ được neo lại, bao nhiêu khóa in được ghim lại, bao nhiêu sắc độ ẩn vẫn ở trạng thái ẩn, bao nhiêu điểm dừng gradient giữ nguyên màu.

**Replace palette** trên thẻ đó sẽ chốt thay đổi; **Cancel** thoát ra và không thay đổi gì. Sau khi chạy xong, thẻ trở thành **"Palette replaced."** với một nút **Undo** đã sẵn sàng focus - và một điểm khôi phục của toàn bộ hệ thống thiết kế được chụp lại *trước khi* thay đổi, nên việc "đưa nó về như cũ" là một thao tác khôi phục chứ không phải một buổi chiều công sức mất trắng.

### Bảng màu, biểu đồ và từng mẫu màu

Bảng bên phải liệt kê mọi màu mà thương hiệu của bạn có, được nhóm lại (Primary, Neutral, Secondary, Spectrum, Custom, Roles), mỗi nhóm có thể gấp lại với nút **+ Add** riêng. Bên dưới, **Colour chart** mở ra hai chế độ xem trên cùng một bộ mẫu màu: **Wheel** (bánh xe OKLCH - kéo một điểm để đổi màu, nhấp vào một điểm để chỉnh sửa hoặc nhấp vào chỗ trống để thả thêm một mẫu màu mới) và biểu đồ **Gamut**, cho thấy dải hiển thị thực sự kết thúc ở đâu. `#/start?area=color&focus=chart` mở thẻ này trực tiếp, giống như `?wheel` luôn làm.

![Bảng bảng màu, mọi nhóm có thể gấp lại, với nút tải xuống đặt ở mép dưới cùng](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Bánh xe OKLCH - góc là sắc độ (hue), khoảng cách ra ngoài là độ bão hòa (chroma) và các màu xám chạy theo một dải độ sáng dọc theo cạnh bên](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

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

### Gradient

Một bảng **Gradients** tùy chọn xây dựng các token pha trộn từ bảng màu của bạn cho nền và điểm nhấn. Bỏ qua hoàn toàn nếu thương hiệu của bạn không dùng gradient. Mỗi gradient có một bản xem trước, các điểm dừng có tên (2-8) và một góc. Hành vi mấu chốt: **một điểm dừng tham chiếu đến một mẫu màu**, nên đổi màu mẫu đó thì gradient sẽ theo. Phép nội suy chạy trong không gian OKLCH để có các dải chuyển màu sạch. Xóa một điểm dừng để rút gọn dải.

### Mang bảng màu đi nơi khác

Nút nổi đặt ở mép dưới của bảng bảng màu cho phép tải xuống toàn bộ bảng màu dưới dạng **Design tokens (JSON)**, **CSS variables**, **CSS classes**, **SCSS variables**, một **GIMP palette (.gpl)** hoặc một **Adobe Swatch Exchange (.ase)** - để thương hiệu chuyển thẳng vào Illustrator, Figma, GIMP hoặc một stylesheet. Nút này nằm ngoài vùng cuộn của bảng, nên nó luôn giữ nguyên vị trí dù bảng màu cuộn đến đâu. (Bạn cũng có thể tải bảng màu xuống từ chế độ xem [Catalogue](/info/using.html).)

## Type

![The compare stage open under its card, with the search row, the pinned families and the cards folded to a one-line strip](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

Khu vực này dẫn đầu bằng **bốn thẻ vai trò** - bốn kiểu chữ mà ứng dụng, các công cụ của bạn và mọi bản xuất thực sự đọc. Mỗi thẻ hiển thị kiểu chữ nào đang phục vụ vai trò đó ngay bây giờ, đặt trong chính kiểu chữ đó, kèm một dòng nội dung thật bên dưới:

- **Primary** - nội dung chính, các nút và mọi công cụ.
- **Headings** - kiểu chữ hiển thị cho `h1`/`h2`.
- **Code** - một kiểu chữ đơn cách cho mã và dữ liệu.
- **Italic** - một kiểu chữ nghiêng thật đi kèm để nhấn mạnh, trích dẫn và các đoạn phụ.

Headings, code và italic đều mặc định quay về primary cho đến khi bạn gán chúng, nên một thương hiệu chỉ dùng một font không cần quyết định gì ở đây cả. Không có gì trên thẻ ghi thay đổi ngay: **Change** (hoặc **Choose a face** trên một vai trò còn trống) mở ra **compare stage** giới hạn trong vai trò đó.

![Khu vực Type - các thẻ vai trò và một mẫu trực tiếp của từng kiểu chữ đang thực hiện chức năng của nó](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

### Compare stage

Khu vực so sánh mở **ngay trong khu vực đó**, không phải trong hộp thoại, nên các thẻ bạn vừa rời khỏi vẫn còn trên màn hình. Tìm một họ font Google Fonts (Inter, Fraunces, Space Grotesk…) hoặc thả một tệp font vào, nhấn **Add to the comparison** và các ứng viên đứng cạnh nhau với cùng một đoạn chữ trước khi bất kỳ cái nào được cài đặt. Escape hủy bỏ và trả bàn phím lại cho thẻ mà bạn đã mở nó từ đó.

Đó là cánh cửa duy nhất để đi vào, đó là lý do không có gì có thể lọt vào thương hiệu của bạn mà không bị nhìn thấy. Bên dưới stage là hai bảng quản lý:

- **Fonts on this device** - mọi họ font đã cài, các vai trò nó đang phục vụ và một nút xóa. **Add a face** ở đây mở cùng compare stage nhưng không giới hạn vai trò.
- **Your fonts** - tải lên một tệp **TTF**, **OTF** hoặc **WOFF** từ chính máy của bạn. Đây là con đường cho một font doanh nghiệp có bản quyền mà bạn đã sở hữu.

Dù theo cách nào thì kiểu chữ vẫn ở lại trên thiết bị này, hiển thị trong ứng dụng, trong các công cụ của bạn và trong mọi bản xuất, hoạt động ngoại tuyến vĩnh viễn và đi cùng gói thương hiệu của bạn - không có gì được tải về vào lúc render. Mọi thứ trên Google Fonts đều phát hành theo giấy phép mở (OFL/Apache/UFL).

Bảng **Type roles** ở cuối trang hiển thị một mẫu trực tiếp của từng vai trò - body và giao diện ở kiểu chữ chính, một kiểu chữ hiển thị tùy chọn cho các tiêu đề trên cùng, một kiểu nghiêng để nhấn mạnh, một kiểu đơn cách cho mã và dữ liệu - để bạn thấy toàn bộ bộ kiểu chữ hoạt động cùng nhau.

![Mẫu Type roles - heading, body, italic và code, mỗi loại đặt trong kiểu chữ mà vai trò đó phân giải đến, kèm tên kiểu chữ bên cạnh](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

## Tokens

Phần còn lại của hệ thống thiết kế, có thể chỉnh sửa mà không cần đụng đến mã:

![Khu vực Tokens - một thanh trượt bán kính góc cùng khoảng cách, kích thước, đổ bóng và phần còn lại của hệ thống](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Rounded corners** - một thanh trượt bán kính duy nhất (0-1.5rem) mà các thẻ, nút và bảng trong toàn ứng dụng đều tuân theo.
- **More tokens** - thêm và chỉnh sửa **spacing**, **sizing**, **stroke width**, **opacity**, **rotation**, **numbers** thuần và **shadows**. Chọn một loại, đặt tên (*Gutter, Card shadow…*) và đặt giá trị của nó. Các giá trị này được lưu dưới dạng [design token](/info/design-tokens.html) chuẩn (DTCG) và đi cùng thương hiệu của bạn.

## Files

Thả vào đây các tệp mà thương hiệu của bạn lưu giữ - ngoại trừ logo: tài sản **vector**, **image**, **audio** và **motion** (video, Lottie, hoạt hình). Chúng sẽ nằm trong [Catalogue](/info/using.html) của bạn, được sắp xếp theo phần và sẵn sàng trong trình chọn tài sản của mọi công cụ. Mọi thứ đều ở lại trên thiết bị này. (Thanh bên gọi khu vực này là **Files**; khóa URL vẫn là `catalogue`, vì khóa của một bảng là một hợp đồng vĩnh viễn.)

## Mang một thương hiệu vào

**Add from…** ở cuối thanh bên mở một bộ chọn hai bước. Bước đầu tiên hỏi bạn *đang có* gì, chứ không phải định dạng gì:

- **Design tokens or a design file** - DTCG hoặc Tokens Studio JSON, một dự án Penpot, một **zip chứa các bộ token**, một gói hệ thống thiết kế Lolly hoặc một SVG.
- **PDF** - một bản trình bày hoặc một tệp hướng dẫn thương hiệu, được đọc trên thiết bị này để lấy màu sắc, dấu cắt và các kiểu chữ được nhúng.
- **Image** - một ảnh chụp màn hình hoặc một bức ảnh; màu sắc của nó được đọc trên thiết bị này và không có gì được tải lên.
- **Font file** - TTF, OTF hoặc WOFF. Mở khu vực Type, nơi kiểu chữ được cài đặt.
- **Website** - một trang, được đọc để lấy màu sắc và kiểu chữ. Ô này chỉ xuất hiện trên thiết bị thực sự có thể đọc một trang, vì một ô bị vô hiệu hóa mà vẫn quảng cáo thứ không ai bấm được thì còn tệ hơn là không có ô nào cả. Ở nơi nó xuất hiện, nó nêu rõ ràng ai đang đọc: được ứng dụng lấy về trên thiết bị này, hoặc được đọc qua tiện ích mở rộng trình duyệt trong một tab nền, đăng nhập với tư cách bạn. Việc nhập một URL chỉ *điền sẵn* vào ô - nút lấy về mới là sự đồng ý, nên một liên kết ai đó gửi cho bạn không bao giờ có thể tự khởi động một lượt đọc.

Chọn nguồn tệp thiết kế và bước thứ hai là thẻ bên dưới: các định dạng được chấp nhận dẫn đầu dưới dạng ô biểu tượng theo thứ tự ưu tiên, và toàn bộ thẻ là một vùng thả duy nhất - nhấp vào bất kỳ đâu trên đó hoặc kéo một tệp thả vào đó. Bạn cũng có thể thả một tệp thẳng vào studio.

![Thẻ nhập - các định dạng được chấp nhận dẫn đầu dưới dạng ô biểu tượng, và toàn bộ thẻ là một vùng thả duy nhất](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Mỗi tệp thiết kế mang lại cho bạn những gì:

- một gói **LollyBrand** (`.zip`) - cài đặt trong một bước;
- một bản xuất **Penpot** (`.penpot`) - kéo các design token của nó vào;
- một tệp **Design Tokens** (`.json`) - W3C DTCG;
- một tệp **Tokens Studio** (`.json`) - Tokens Studio;
- một tệp **SVG** thuần (`.svg`) - Lolly quét các màu của nó và cho bạn chọn màu nào cần giữ, màu đầu tiên trở thành màu chính của bạn.

Một lượt cài đặt từ nguồn sẽ **chụp lại điểm khôi phục trước**, nên "quay lại trước khi nhập" chỉ là một lần khôi phục. Và những gì một lượt quét tìm thấy không đi thẳng vào ngay: các ứng viên nằm trong **Tray**, nơi mỗi cái được thêm vào bằng một lần nhấn riêng, thông qua khu vực sở hữu loại vật liệu đó.

`#/start?source=<kind>` mở bộ chọn trên một nguồn cho trước (`file`, `pdf`, `image`, `font`, `url`), và `?import` mở nó trên danh sách thuần.

## Di chuyển một thương hiệu giữa các thiết bị

**Export** ở cuối thanh bên ghi ra một tệp **`LollyBrand-…zip`** duy nhất - token, font, logo và tùy chọn giao diện của bạn, kèm một tệp kê khai toàn vẹn được xác minh khi đưa trở lại. Bên cạnh đó, **Tokens (.json)** ghi ra tài liệu design token thuần túy một mình: không font, không logo, chỉ có token - đây là thứ mà một kho mã, một bước CI hoặc một công cụ token khác thực sự đọc được.

Đưa một tệp trở lại là **Add from… → Design tokens or a design file** (ở trên), hoặc kéo và thả vào studio. Đây là cách một đồng nghiệp trao cho bạn một thương hiệu, hoặc cách bạn mang một thương hiệu sang một lần cài đặt thứ hai - không cần tài khoản, không cần đám mây. Để mang một thương hiệu vào từ dòng lệnh thay vì vậy, xem [`ingest:brand`](/info/configuration.html#brand-packs).

## Phiên bản

**Versions** ở cuối rail là nơi một hệ thống thiết kế ngừng là một mục tiêu di động. Publish một phiên bản và bạn có được một **bản sao vĩnh viễn, có tên** được giữ trên thiết bị này: nó không bao giờ thay đổi sau đó, nên một công cụ ghim vào nó sẽ luôn vẽ ra cùng một thứ. Bảng điều khiển này vẫn ẩn cho đến khi có điều gì đó của riêng bạn để publish, nên một studio chưa bao giờ publish sẽ không bao giờ thấy các điều khiển này.

Ba điều cần biết trước khi bạn nhấn bất cứ nút nào, và bảng điều khiển nói cả ba điều đó trước khi bạn nhấn chứ không phải sau:

- **Một phiên bản là vĩnh viễn.** Hiện chưa có chức năng xóa, nên bảng điều khiển nói rõ điều gì đã được giữ lại và rằng nó sẽ tiếp tục được giữ lại, thay vì đưa ra một nút bấm nói dối.
- **Việc gỡ bỏ dẫn đầu thẻ tương thích.** Các token được thêm và thay đổi là tin tức; một token bị *gỡ bỏ* mới là điều làm hỏng một công cụ, nên nó được nêu tên đầu tiên và được gọi đúng bản chất của nó.
- **Việc publish không thể hoàn tác; việc khôi phục thì có thể.** *Restore latest from this version* là một chỉnh sửa thông thường vào head, nên nó được đưa vào ngăn xếp undo của studio và bảng điều khiển sẽ cung cấp cho bạn **Undo** ngay lập tức.

Bạn có thể **Chỉ xuất bản**, hoặc **Xuất bản và đặt làm bản đang dùng** - khác biệt ở chỗ liệu công cụ và ứng dụng có theo phiên bản đó từ nay trở đi hay tiếp tục theo chỉnh sửa mới nhất của bạn. **Theo bản mới nhất trở lại** đưa mọi chỉnh sửa lên trực tiếp ngay khi nó được thực hiện. `#/start?area=versions` mở bảng điều khiển này trực tiếp.

## Khi thương hiệu đã cố định

Một số bản build sử dụng **thương hiệu bị khóa** - màu sắc, phông chữ và token của nó là những gì mọi công cụ và bản xuất đều dùng, và không có gì để thay đổi. Trong trường hợp đó, studio được thay bằng một ghi chú ngắn giải thích rằng bản build này đi kèm thương hiệu cố định và việc chỉnh sửa bị tắt. Đây là chủ đích: đó là cách một tổ chức đảm bảo mọi thứ luôn đúng thương hiệu.

## Đi tiếp từ đâu

- **[Sử dụng Lolly](/info/using.html)** - canvas, lưu, dự án và danh mục.
- **[Design Tokens](/info/design-tokens.html)** - mô hình token mà thương hiệu của bạn được thể hiện qua đó.
- **[Xuất & định dạng](/info/exporting.html)** - đơn vị in ấn, CMYK và các định dạng thương hiệu của bạn kết xuất ra.
