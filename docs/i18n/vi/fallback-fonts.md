# Phông dự phòng

Khi các phông chữ của hệ thống thiết kế không vẽ được một chữ cái, Lolly vẽ chữ đó bằng phông Noto mở, để bản xuất giữ chữ dưới dạng đường viền vector thay vì ảnh. Các phông của Lolly Demo, Outfit cho đề mục và SUSE cho văn bản, không có chữ Cyrillic, Hy Lạp, Ả Rập, Hebrew, Devanagari, Bengal, Thái, Trung, Nhật hay Hàn.

Các phông của hệ thống thiết kế luôn được ưu tiên, theo thứ tự liệt kê. Outfit không có chữ tiếng Việt, nên đề mục tiếng Việt lấy chúng từ SUSE, phông tiếp theo trong danh sách của Lolly Demo. Phông dự phòng chỉ vẽ những ký tự mà không phông nào trong số đó vẽ được. Phông thương hiệu giữ mọi chữ cái, chữ số và dấu mà nó có, kể cả chữ Hán, ngay trong một từ thuộc hệ chữ khác.

<!--i:eti-package-->
## Những gì được đóng gói

Mười lăm phông chữ, tất cả từ Google Fonts tại một commit cố định. Mỗi tệp được liệt kê kèm dung lượng tải xuống.

| Hệ chữ | Phông chữ | Phiên bản | Tải xuống |
|---|---|---|---|
| Ả Rập, gồm cả chữ Urdu và Ba Tư | Noto Sans Arabic | 2.012 | 211 KB |
| Hebrew | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanagari (Hindi, Marathi, Nepal) | Noto Sans Devanagari | 2.007 | 151 KB |
| Bengal | Noto Sans Bengali | 3.011 | 139 KB |
| Thái | Noto Sans Thai | 2.002 | 62 KB |
| Cyrillic | Noto Sans, chữ Cyrillic | 2.015 | 115 KB, nghiêng 132 KB |
| Hy Lạp | Noto Sans, chữ Hy Lạp | 2.015 | 77 KB, nghiêng 83 KB |
| Latin, gồm tiếng Việt và các chữ có dấu khác | Noto Sans, chữ Latin | 2.015 | 316 KB, nghiêng 350 KB |
| Trung giản thể, các ký tự GB 2312 | Noto Sans SC | 2.004 | 2.0 MB |
| Trung phồn thể, các ký tự Big5 | Noto Sans TC | 2.004 | 3.8 MB |
| Nhật, các ký tự Shift_JIS | Noto Sans JP | 2.004 | 2.2 MB |
| Hàn, mọi âm tiết Hangul và các ký tự KS X 1001 | Noto Sans KR | 2.004 | 2.5 MB |

Mỗi phông giữ mọi độ đậm trên trục độ đậm của nó, nên đề mục đậm bằng tiếng Trung, Nhật hoặc Hàn vẫn đậm. Các phông Noto Sans cố định trục chiều rộng ở mức bình thường, giúp giảm một nửa dung lượng mỗi tệp. Các phông Trung, Nhật và Hàn không có trục chiều rộng. Noto Sans được chia theo hệ chữ, nên một từ Cyrillic chỉ tải các chữ Cyrillic. Đường viền giữ nguyên từ nguồn gốc.

::: details Phông chữ nằm ở đâu và được tạo thế nào
Các phông nằm trong một thư mục dùng chung, `community/fallback-fonts`, được phục vụ cho mọi hệ thống thiết kế từ `/catalog/packs/fallback-fonts/`, như các bộ emoji. `scripts/import-fallback-fonts.ts` tạo các tệp từ phông nguồn được cố định trong `scripts/data/fallback-fonts.json`, kiểm tra từng tệp nguồn theo SHA-256 đã ghi và ghi văn bản giấy phép cạnh các phông.
:::

<!--i:eti-globe-->
## Tiếng Trung, Nhật và Hàn

Phông Trung, Nhật hoặc Hàn chưa cắt gọn có dung lượng từ 9,6 MB đến 17,8 MB. Mỗi phông được cắt gọn theo bộ ký tự quốc gia, cộng với dấu câu, kana, dạng toàn chiều rộng và ký hiệu dùng trong văn bản thông thường:

- Trung giản thể: GB 2312, gồm 6.763 chữ Hán thông dụng và các ký hiệu, tổng cộng 7.522 ký tự.
- Trung phồn thể: Big5, gồm 13.053 chữ Hán và các ký hiệu, tổng cộng 13.629 ký tự. Không bao gồm Hong Kong Supplementary Character Set.
- Nhật: Shift_JIS theo cách Windows và web đọc, tức JIS X 0208 cùng các phần bổ sung NEC và IBM cần cho những tên như 髙 và 﨑, mọi kana và katakana nửa chiều rộng, tổng cộng 7.432 ký tự.
- Hàn: toàn bộ 11.172 âm tiết Hangul và KS X 1001, với 4.888 hanja, tổng cộng 17.082 ký tự.

Bốn phông này bỏ các chữ Latin, Hy Lạp và Cyrillic, vốn do các phông của hệ thống thiết kế và các phông bên trên vẽ. Các bộ ký tự lấy từ các tệp chỉ mục của Encoding Standard tại một commit cố định, nên tạo lại sẽ cho ra cùng các tệp.

Tiếng Trung, Nhật và Hàn dùng chung phần lớn ký tự nhưng vẽ nhiều ký tự theo cách khác nhau. Ví dụ, 直 được viết một cách trong tiếng Trung và một cách khác trong tiếng Nhật. Một đoạn văn bản lấy toàn bộ ký tự dùng chung từ một phông trong số này, không bao giờ từ hai phông. Lolly chọn phông theo thứ tự sau:

1. Ngôn ngữ của đoạn, từ `lang` của phần tử chứa nó hoặc phần tử bao quanh gần nhất trong tài liệu. Cài đặt ngôn ngữ của công cụ, như Language của chứng nhận, đặt giá trị đó. Ngôn ngữ giao diện của Lolly và ngôn ngữ của hệ thống thiết kế không được tính, nên tài liệu xuất ra giống nhau cho mọi người.
2. Hệ chữ của đoạn: kana nghĩa là tiếng Nhật và Hangul nghĩa là tiếng Hàn. Khi đoạn không có cả hai, Lolly đọc tài liệu, nên đề mục chỉ có kanji trong tài liệu tiếng Nhật được vẽ theo tiếng Nhật. Tài liệu có cả kana và Hangul không quyết định được gì ở bước này.
3. Ký tự chỉ tiếng Trung phồn thể dùng, như 體 hoặc 說, trong đoạn hoặc nếu không có thì trong tài liệu, nghĩa là tiếng Trung phồn thể, trừ khi cùng văn bản cũng chứa ký tự chỉ tiếng Trung giản thể dùng.
4. Nếu không, dùng tiếng Trung giản thể.

Ký tự mà phông đã chọn thiếu không bao giờ được lấy từ một trong ba phông còn lại. Nó vẫn là ảnh. Kana hoặc Hangul mà phông đã chọn thiếu, như từ tiếng Hàn trong dòng được đánh dấu là tiếng Nhật, vẫn có thể lấy từ phông Nhật hoặc Hàn, nhưng chỉ khi phông đó không vẽ ký tự dùng chung nào của dòng.

Trên trang, canvas chứa hai ngôn ngữ trong số này liệt kê cả hai phông, và trình duyệt vẽ các ký tự dùng chung bằng phông đầu tiên. Bản xuất vẽ từng đoạn bằng phông riêng của đoạn đó.

<!--i:eti-download-->
## Khi nào phông được tải xuống

Không có gì được tải xuống cho đến khi tài liệu chứa ký tự mà không phông nào của hệ thống thiết kế vẽ được. Ký hiệu trong một dòng tiếng Anh, như ★ hoặc ※, không bao giờ khiến phông Trung, Nhật hoặc Hàn được tải xuống.

Lần đầu tài liệu cần phông dự phòng, Lolly tải đúng phông đó và giữ trên thiết bị của bạn. Tài liệu tiếng Nhật chỉ tải phông Nhật, 2,2 MB, còn tài liệu tiếng Trung phồn thể tải phông phồn thể 3,8 MB. Từ đó hệ chữ được vẽ ngoại tuyến, và phông vẫn còn khi danh mục được dọn dẹp. Phông được giữ cùng các tệp của danh mục, không bao giờ nằm trong các phông bạn đã tải lên, và không xuất hiện trong danh sách phông của thương hiệu.

Dòng lệnh, ứng dụng terminal và máy chủ MCP đọc cùng các tệp từ đĩa, nên không cần tải xuống.

<!--i:eti-eye-->
## Trên trang và trong bản xuất

Trang dùng cùng phông dự phòng với bản xuất, nên dòng chứa những chữ đó có cùng chiều rộng ở cả hai. Chỉ trên canvas đó, Lolly thêm phông dự phòng sau các phông của hệ thống thiết kế và trước mọi phông hệ thống. Công cụ đặt danh sách phông riêng, trong kiểu dáng hoặc trên các phần tử của nó, nhận phông dự phòng ở cùng vị trí. Canvas mà hệ thống thiết kế hỗ trợ đầy đủ giữ nguyên danh sách phông.

Trang không đổi danh sách phông khi nó bắt đầu bằng phông hệ thống, như `system-ui` hoặc Helvetica, vì bản xuất vẽ văn bản đó bằng các phông của hệ thống thiết kế còn trang thì không.

Trong PDF, các từ trở thành đường viền bằng phông dự phòng với mọi cài đặt văn bản, vì chữ sống trong PDF không thể mang hệ chữ mà phông nhúng thiếu. Trong SVG, EMF, EPS, DXF và WMF, chúng trở thành đường viền mỗi khi văn bản được chuyển thành đường viền. Khi giữ chữ sống, các phông riêng của trình đọc vẽ chúng. Khi phông dự phòng vẽ một phần của bản xuất, bảng xuất hiện ghi chú như:

> Văn bản tiếng Nhật được vẽ bằng Noto Sans JP, vì các phông của hệ thống thiết kế này không có những chữ đó.

Dòng lệnh in cùng câu đó dưới dạng ghi chú.

<!--i:eti-image-->
## Những gì vẫn là ảnh

Ký tự ngoài bốn bộ ký tự quốc gia, như 𠮷 hoặc ký tự bổ sung của Hồng Kông, không có phông dự phòng. Các ký tự hiếm như 𠮷, các ký tự thêm cho Hồng Kông từ bộ bổ sung và các hệ chữ không có phông dự phòng, như Tamil, Ethiopic hoặc Syriac, đều được xử lý như nhau. Các hệ chữ như Tamil, Ethiopic hoặc Syriac cũng không có. Trong PDF, dòng chứa văn bản như vậy được đưa vào dưới dạng ảnh 300 dpi, và bảng xuất liệt kê các hệ chữ. Trong SVG, đoạn vẫn là chữ sống, do các phông riêng của trình đọc vẽ.

::: details Trong bản xuất EPS, WMF và EMF
EPS, WMF hoặc EMF với **Outline fonts** bật không có chữ sống để dự phòng, nên đoạn cũng được đưa vào dưới dạng ảnh 300 dpi. Ảnh chỉ tô màu văn bản ở nơi có chữ, nên nền hiện xuyên qua. Bảng xuất liệt kê các hệ chữ. Ảnh chỉ được vẽ thẳng đứng, nên đoạn bị xoay hoặc nghiêng dừng việc xuất với thông báo trích dẫn đoạn đó. Trong WMF hoặc EMF, ảnh là một cặp thao tác bitmap, một mặt nạ và một lớp tô. Microsoft Office và LibreOffice vẽ chúng đúng như dự định. Ứng dụng bỏ qua chúng, như Inkscape, hiện các từ trên một ô trắng.

EMF với **Outline fonts** tắt giữ đoạn đó dưới dạng chữ sống, do các phông riêng của trình đọc vẽ. Ngoại lệ là đoạn mà chữ sống EMF không thể chứa, như văn bản có giãn cách chữ. Lolly chuyển đoạn đó thành đường viền, nên đoạn không phông nào vẽ được cũng được đưa vào dưới dạng ảnh.
:::

::: warning Bản xuất DXF dừng ở văn bản không phông nào vẽ được
DXF dùng cho máy cắt và phần mềm CAD vốn cần đường viền, nên đoạn không phông nào vẽ được sẽ dừng bản xuất DXF. Thông báo trích dẫn đoạn đó và cho biết hệ chữ của nó. Thêm phông có những chữ đó, hoặc xuất SVG hay PDF.
:::

<!--i:eti-checklist-->
## Kiểm tra trước khi xuất

Thẻ **Before you export** của Lolly Design và các phép kiểm tra `render` của `lolly check` báo văn bản không phông nào vẽ được. Chúng xét các phông dự phòng như khi xuất, từ cùng danh sách ký tự của từng phông, nên văn bản do phông dự phòng vẽ không bị báo. Hệ chữ không có phông dự phòng, như Tamil, và ký tự Trung, Nhật hoặc Hàn ngoài các bộ quốc gia vẫn bị báo, vì bản xuất vẽ chúng dưới dạng ảnh hoặc chữ sống, còn bản xuất DXF dừng ở chúng. Phép kiểm tra đọc những danh sách đó từ danh mục và không tải phông nào.

<!--i:eti-stamp-->
## Giấy phép và ghi công

Mọi phông dự phòng đều theo SIL Open Font License 1.1. Mỗi mục trong danh mục ghi giấy phép đó cùng mã băm văn bản giấy phép, nên các quy tắc quyền trong [Quyền sáng tạo và ghi công](/info/creative-rights.html) đọc giấy phép như của mọi phông khác. Văn bản giấy phép nằm cạnh các phông. Các tệp Noto Sans không khai báo Reserved Font Name. Các phông Trung, Nhật và Hàn là của Adobe và bảo lưu tên Source. Các tệp cắt gọn giữ tên Noto, vốn không dùng tên đó.

Giấy phép nêu rằng các điều khoản của nó không áp dụng cho tài liệu tạo bằng các phông này. Bản xuất chỉ chứa đường viền của những chữ nó dùng, như với các phông riêng của hệ thống thiết kế. Lolly không thêm chương trình phông, dòng ghi công hay mục chứng thực nội dung mới cho phông dự phòng.
