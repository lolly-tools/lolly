# Bắt đầu nhanh

Lolly biến các quy tắc của bạn - màu sắc, kiểu chữ, bố cục, logic - thành những công cụ mà ai cũng dùng được để tạo ra tệp hoàn chỉnh: hình ảnh, PDF, thẻ mạng xã hội, video, chỉ bằng cách điền vài ô. Gần như không có gì phải học và không phải tải gì lên: việc tạo và xuất tệp chạy ngay trên thiết bị của bạn, dù có mạng hay không.

Đây là trang bạn nên đọc trước tiên. Hai việc giúp bạn bắt tay vào làm ngay: **biến Lolly thành của bạn** và **mang vào những gì bạn đã có** (các tệp thiết kế và token của bạn). Mọi thứ khác chỉ cách một liên kết.

> Mới biết Lolly và chỉ muốn làm ra thứ gì đó? [Làm một thứ gì đó trong 60 giây](/info/make-something.html) sẽ dẫn bạn qua ba ví dụ, hoặc [mở ứng dụng](/#/), chọn bất kỳ công cụ nào trong thư viện, điền vào các ô trống rồi bấm **Export**. Quay lại đây khi bạn muốn nó mang thương hiệu *của bạn*.

![Màn hình Utilities - những công cụ chạy ngay trên thiết bị như Strip Hidden Data, Compress PDF và Convert Image, gom về một chỗ](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## 1. Biến nó thành của bạn - cấu hình Design System của bạn

Thương hiệu của bạn trong Lolly là một tài liệu **design-tokens** nhỏ gọn - màu sắc, phông chữ và vài quy tắc - mà mọi công cụ đều dựa vào đó để kết xuất. Thiết lập một lần và mọi thứ bạn tạo ra đều đúng thương hiệu ngay từ gốc, không phải nhờ khâu duyệt lại. Có ba đường vào; chọn đường phù hợp với nơi thương hiệu của bạn đang nằm.

### Bắt đầu từ con số không (trình dựng design system)

Lần chạy đầu tiên đưa bạn tới **gallery**, với một hộp thoại chào mừng ngắn phủ lên trên, mời ba đường vào - **Make it yours** (Brand Studio tại `#/start`), **Bring your design** (thả một tệp Figma, Penpot, InDesign hay PDF vào và nó mở ra thành một bố cục chỉnh sửa được - lối nhanh nhất tới [Mang vào những gì bạn đã có](#2-bring-in-what-you-already-have) bên dưới) và **Explore the community tools** - cùng một hàng ngôn ngữ nếu tiếng Anh không phải tiếng của bạn. Chọn thẻ đầu tiên và bạn tới [**Brand Studio**](/info/brand-studio.html). Đặt tên và chọn một màu chính, rồi Lolly *suy ra* từ đó cả một bảng màu đầy đủ, dễ tiếp cận - nền sáng/tối, chữ, màu nhấn - bằng đúng phép toán màu mà engine dùng ở mọi nơi khác.

![Phòng Colours của Brand Studio - một màu chính, và bảng màu dễ tiếp cận mà Lolly suy ra từ nó](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours) Chọn một phông chữ là bạn đã có một thương hiệu dùng được trong chưa đầy một phút. Từ đó, sáu phòng của studio - Overview, Colours, Type, Logos, Tokens, Files - cho bạn đi xa tới đâu tuỳ ý, theo thứ tự nào cũng được, tinh chỉnh lại bất cứ phần nào mỗi lần quay lại. Thẻ **Design system** trên dashboard (`#/d`) hiển thị kết quả ở chế độ chỉ đọc và trỏ ngược về `#/start`, nơi việc chỉnh sửa diễn ra (trừ khi bạn đang dùng bản Lolly khoá thương hiệu, khi đó thương hiệu là cố định và không có gì để đổi).

### Nhập một thương hiệu bạn đã có

Nếu thương hiệu của bạn đã được ghi lại dưới dạng design token - từ **Penpot**, **Tokens Studio** (Figma) hay bất kỳ tệp **DTCG** thuần nào - hãy mang trọn nó vào thay vì gõ lại. Có hai đường:

- <!--i:palette--> **Trong ứng dụng:** [trình dựng design system: Brand Studio](/info/brand-studio.html) (`#/start`) nhận nó qua **Add from…** ở cuối thanh phòng - một tệp token, một bản xuất Penpot, một SVG hay một gói `LollyBrand`. Thả vào và bảng màu sáng lên.
- <!--i:code--> **Từ dòng lệnh**, để dựng một gói thương hiệu dùng lại được:

```bash
# a monolithic tokens.json, a one-file-per-set directory, or a Penpot project archive
npm run ingest:brand -- ./my-tokens.json --name acme --label "Acme" --activate
```

`ingest:brand` nhận cả ba dạng chứa mà Penpot / Tokens Studio dùng để xuất cùng một tài liệu - một tệp `tokens.json` duy nhất, một thư mục (`$metadata.json` + các tệp theo từng bộ) hay một kho lưu trữ `project.penpot`. Với `--activate`, nó đăng ký thương hiệu thành một profile, chuyển sang profile đó và dựng lại catalog. Xem [Cấu hình](/info/configuration.html) để biết gói thương hiệu và profile khớp với nhau ra sao.

### Tinh chỉnh ngay trong ứng dụng

Khi một thương hiệu đã kích hoạt, bạn tiếp tục nhào nặn nó trong [**Brand Studio**](/info/brand-studio.html) (`#/start`) - đổi một màu hay một vai trò và mọi bản xem trước khắp ứng dụng cập nhật ngay khi bạn gõ. (Thẻ **Design system** trên dashboard tại `#/d` chỉ *hiển thị* thương hiệu ở chế độ đọc; Studio mới là nơi bạn chỉnh sửa.)

![Thẻ Design-system trên Dashboard - thương hiệu đang kích hoạt hiển thị ở chế độ chỉ đọc](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand) Cùng thương hiệu đó được tóm tắt trên thẻ **Profile → Your brand**. Phông chữ ở đây là phông thật: chọn từ Google Fonts và Lolly lưu tệp **trên thiết bị của bạn** dưới dạng tài nguyên thương hiệu, nên kiểu chữ của bạn đi theo cả khi ngoại tuyến và không có gì phải tải về lúc kết xuất.

Khi đã ưng ý, **xuất thương hiệu thành một gói `LollyBrand`** - một tệp duy nhất mà đồng nghiệp có thể nhập vào để có đúng bảng màu, phông chữ và quy tắc đó. Đó là cách một thương hiệu đi từ người này sang người khác, từ máy này sang máy khác mà không cần máy chủ nào ở giữa.

> **Token thương hiệu đi được cả hai chiều.** Vì thương hiệu của Lolly *chính là* token DTCG - định dạng mà Penpot đọc và ghi nguyên bản, còn Tokens Studio mang vào Figma - nên bảng màu bạn *dùng để thiết kế* và bảng màu Lolly *bắt tuân thủ* là một tài liệu duy nhất, không phải hai danh sách bạn tự tay giữ cho khớp. Xem [Design Tokens](/info/design-tokens.html).

## 2. Mang vào những gì bạn đã có

Bạn không bắt đầu từ trang giấy trắng. Lolly mở được các bản thiết kế và những định dạng mở mà bạn đã có.

### Tệp thiết kế nguồn mở

Việc đã làm xong trong **Figma, Penpot, Illustrator, InDesign hay bất kỳ ứng dụng SVG nào** không nhất thiết phải nằm kẹt trong ứng dụng bạn đã vẽ nó. Mở **Design**, bấm **Import a design**, và tệp mở ra như một *bố cục sống* - không phải một tấm ảnh bẹp. Mỗi lớp trở thành một hộp chỉnh sửa được: chữ vẫn gõ lại được, hình vẫn là hình, ảnh vào thẳng thư viện của bạn và các hình vector phức tạp được giữ nguyên trung thực. Nó tới nơi đã được nắn theo bộ phông và quy tắc màu của thương hiệu bạn.

| Bạn đang có | Mang vào dưới dạng |
|---|---|
| Một frame Figma | `.fig` nguyên bản (File → Save local copy), hoặc một bản xuất SVG |
| Một thiết kế Penpot | Bản xuất `.penpot` của nó, hoặc bất kỳ SVG nào |
| Một tệp Illustrator | `.ai` nguyên bản (tương thích PDF) hoặc `.pdf` - mở trực tiếp |
| Một bố cục InDesign | `.idml` (File → Export → InDesign Markup) |
| Bất kỳ thứ gì khác | **Bất kỳ SVG nào** - cánh cửa vào chung cho tất cả |

Toàn bộ việc nhập diễn ra **trên thiết bị của bạn** - tệp được phân tích ngay trong trình duyệt và không có gì được tải lên. Chi tiết đầy đủ, và chính xác những gì được giữ lại, nằm ở [Nhập một bản thiết kế](/info/design-import.html).

Bạn có một **bộ slide PowerPoint** thay vì thế? Thả tệp `.pptx` vào **Deck Builder** để sửa từng slide, đã bám sẵn thương hiệu của bạn - hoặc chạy **Rebrand a Deck** để nhận lại đúng bộ slide đó với chủ đề mới, biểu đồ và hiệu ứng động còn nguyên.

### Từ một bản làm một lần thành một mẫu

Phần thưởng là đây: một bố cục đã nhập chính là một phiên Design bình thường, nên khi bạn **lưu** nó lại, nó nằm tại một URL. Bất kỳ ai có Lolly đều mở được URL đó, đổi chữ, thay ảnh và kết xuất phiên bản của riêng họ - không cần ứng dụng thiết kế, còn những phần đã khoá thì vẫn khoá. Một thiết kế làm một lần trở thành một công cụ dùng lại được. Đó là toàn bộ ý tưởng, đạt được mà không phải viết một dòng cấu hình nào.

### Dữ liệu mở và công cụ mở

[Bộ công cụ cộng đồng](/info/builders.html) là nguồn mở và không gắn với thương hiệu nào - mã QR, bản đồ đường phố, bộ lọc, tiện ích riêng tư - và nó kết xuất theo thương hiệu *của bạn* ngay khi bạn kích hoạt.

Bạn cũng có thể nạp dữ liệu mở của chính mình cho công cụ: dán hoặc thả một bảng **CSV** hay **JSON** vào và các trường lặp của công cụ tự điền theo, mỗi dòng ra một tài nguyên hoàn chỉnh.

## 3. Làm ra thứ gì đó, rồi chia sẻ hoặc tự động hoá nó

Với một thương hiệu đang kích hoạt và tư liệu trong tay, mọi công cụ đều cho ra một tệp hoàn chỉnh:

- <!--i:download--> **Kết xuất** bất kỳ công cụ nào ra **SVG, PDF, PNG, JPG, WebP, video** và nhiều định dạng khác - đúng khổ in thật và đơn vị vật lý khi bạn cần. Xem [Xuất tệp & định dạng](/info/exporting.html).
- <!--i:link--> **Chia sẻ một liên kết.** Mọi trạng thái công cụ đều là một URL, nên một tài nguyên hoàn chỉnh có thể tái tạo lại và địa chỉ hoá theo tham số - commit liên kết, tạo lại bất cứ lúc nào cần.
- <!--i:layers--> **Làm hàng loạt.** Điều khiển một mẫu từ bảng tính trong [lưới xử lý hàng loạt](/info/exporting.html): mỗi dòng một tài nguyên hoàn chỉnh.
- <!--i:cpu--> **Tự động hoá.** Cùng một lần kết xuất đó chạy được từ [CLI](/info/cli.html) và từ một [tác nhân AI](/info/ai-agents.html) - URL chính là API.

"URL chính là API" là nói theo nghĩa đen. Biểu đồ bên dưới không do ai vẽ cả: loại biểu đồ, tiêu đề và toàn bộ bảng dữ liệu của nó đều được gõ vào thanh địa chỉ, và cùng liên kết đó cho ra cùng biểu đồ trên mọi thiết bị.

![Biểu đồ vùng thể hiện lượt đăng ký hàng tháng, mỗi giá trị trong đó đến từ một tham số truy vấn thay vì một cú nhấp chuột](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Đi tiếp từ đâu

Ba lối đi, tuỳ vào việc bạn tới đây để làm:

- <!--i:people--> **[Lolly cho người sáng tạo](/info/creators.html)** - bạn làm ra sản phẩm. Các lợi thế, và cách khai thác ứng dụng tối đa.
- <!--i:code--> **[Lolly cho người phát triển](/info/builders.html)** - bạn viết công cụ, tích hợp và triển khai. Tài liệu kỹ thuật.
- <!--i:shieldcheck--> **[Lolly cho người vận hành](/info/operators.html)** - bạn chịu trách nhiệm về thương hiệu, bảo mật và triển khai trong toàn tổ chức.
