# Phông dự phòng

Phông chữ của một hệ thống thiết kế thường chỉ bao phủ một số hệ chữ trên thế giới. Lolly Demo đặt tiêu đề bằng Outfit và văn bản bằng SUSE, và cả hai phông đều không có chữ Cyrillic, Hy Lạp, Ả Rập, Do Thái, Devanagari, Bengali, Thái, Trung, Nhật hay Hàn. Khi một tài liệu có những chữ mà phông của hệ thống thiết kế không vẽ được, Lolly vẽ các chữ đó bằng một phông Noto mở, nên bản xuất giữ chúng dưới dạng đường bao vector thay vì biến các từ thành một bức ảnh.

Phông của hệ thống thiết kế luôn được ưu tiên trước, theo thứ tự hệ thống thiết kế liệt kê. Outfit không có chữ cái tiếng Việt, nên một tiêu đề tiếng Việt lấy chúng từ SUSE, phông kế tiếp trong danh sách của Lolly Demo. Một phông dự phòng chỉ vẽ những ký tự mà không phông nào trong số đó vẽ được, nên phông thương hiệu giữ mọi chữ cái, chữ số và dấu mà nó có, kể cả bên trong một từ thuộc hệ chữ khác. Một phông thương hiệu có một chữ Hán thì cũng giữ chữ Hán đó.

## Những gì được đóng gói

Mười lăm phông, tất cả từ Google Fonts ở một commit đã ghim và tất cả theo SIL Open Font License 1.1. Mỗi tệp được hiện kèm dung lượng tải xuống.

| Hệ chữ | Phông | Phiên bản | Tải xuống |
|---|---|---|---|
| Ả Rập, gồm cả chữ Urdu và Ba Tư | Noto Sans Arabic | 2.012 | 206 KB |
| Do Thái | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanagari (Hindi, Marathi, Nepal) | Noto Sans Devanagari | 2.007 | 147 KB |
| Bengali | Noto Sans Bengali | 3.011 | 136 KB |
| Thái | Noto Sans Thai | 2.002 | 61 KB |
| Cyrillic | Noto Sans, chữ Cyrillic | 2.015 | 112 KB, nghiêng 129 KB |
| Hy Lạp | Noto Sans, chữ Hy Lạp | 2.015 | 75 KB, nghiêng 81 KB |
| Latin, gồm cả tiếng Việt và các chữ có dấu khác | Noto Sans, chữ Latin | 2.015 | 309 KB, nghiêng 342 KB |
| Chữ Trung giản thể, các ký tự GB 2312 | Noto Sans SC | 2.004 | 1,9 MB |
| Chữ Trung phồn thể, các ký tự Big5 | Noto Sans TC | 2.004 | 3,6 MB |
| Tiếng Nhật, các ký tự Shift_JIS | Noto Sans JP | 2.004 | 2,1 MB |
| Tiếng Hàn, mọi âm tiết Hangul và các ký tự KS X 1001 | Noto Sans KR | 2.004 | 2,4 MB |

Trục độ đậm của mỗi phông được giữ nguyên vẹn, nên mọi độ đậm mà một thiết kế yêu cầu vẫn vẽ được, và một tiêu đề Trung, Nhật hay Hàn in đậm vẫn đậm. Trục độ rộng của các phông Noto Sans được cố định ở mức bình thường, giúp giảm một nửa dung lượng mỗi tệp; các phông Trung, Nhật và Hàn không có trục độ rộng. Noto Sans được tách theo hệ chữ, nên một từ Cyrillic chỉ tải các chữ Cyrillic. Các đường bao là đường bao gốc của upstream, không thay đổi.

Các phông nằm trong một thư mục dùng chung, `community/fallback-fonts`, được phục vụ cho mọi hệ thống thiết kế từ `/catalog/packs/fallback-fonts/`, giống cách các bộ emoji được dùng chung. `scripts/import-fallback-fonts.ts` dựng các tệp từ phông upstream được ghim trong `scripts/data/fallback-fonts.json`, đối chiếu mọi tệp upstream với SHA-256 đã ghi và ghi văn bản giấy phép cạnh các phông.

## Tiếng Trung, Nhật và Hàn

Một phông Trung, Nhật hoặc Hàn đầy đủ nặng từ 9,6 MB đến 17,8 MB, nên mỗi phông này được cắt xuống bộ ký tự quốc gia mà người đọc dùng hằng ngày, cộng với dấu câu, kana, dạng toàn chiều rộng và ký hiệu của văn bản thông thường:

- Chữ Trung giản thể: GB 2312, 6.763 chữ Hán thông dụng và các ký hiệu của nó, tổng cộng 7.522 ký tự.
- Chữ Trung phồn thể: Big5, 13.053 chữ Hán và các ký hiệu của nó, tổng cộng 13.629 ký tự. Bộ ký tự bổ sung Hồng Kông không được đưa vào.
- Tiếng Nhật: Shift_JIS theo cách Windows và web đọc, tức là JIS X 0208 cùng các bổ sung của NEC và IBM mà những tên như 髙 và 﨑 cần, mọi kana và katakana nửa chiều rộng, tổng cộng 7.432 ký tự.
- Tiếng Hàn: toàn bộ 11.172 âm tiết Hangul và KS X 1001, cùng 4.888 chữ hanja của nó, tổng cộng 17.082 ký tự.

Chữ Latin, Hy Lạp và Cyrillic được bỏ khỏi bốn phông này, vì phông của hệ thống thiết kế và các phông ở trên đã vẽ chúng. Các bộ ký tự được đọc từ các tệp chỉ mục của Encoding Standard ở một commit đã ghim, nên mỗi lần dựng lại cho ra cùng các tệp.

Tiếng Trung, Nhật và Hàn dùng chung phần lớn ký tự, nhưng mỗi thứ vẽ nhiều ký tự theo một kiểu khác. Cùng chữ 直 được viết theo một cách trong tiếng Trung và một cách khác trong tiếng Nhật. Vì vậy một đoạn văn bản lấy mọi ký tự dùng chung từ một trong các phông này, không bao giờ từ hai, và Lolly chọn phông đó theo thứ tự sau:

1. Ngôn ngữ của đoạn văn bản, lấy từ `lang` của phần tử chứa nó hoặc phần tử gần nhất bao quanh trong tài liệu. Cài đặt ngôn ngữ của một công cụ, như Language của chứng nhận, đặt giá trị đó. Ngôn ngữ của giao diện Lolly và ngôn ngữ của hệ thống thiết kế không được tính, nên một tài liệu xuất ra giống nhau cho mọi người.
2. Hệ chữ của đoạn văn bản: kana nghĩa là tiếng Nhật và Hangul nghĩa là tiếng Hàn. Khi bản thân đoạn đó không có cái nào, cả tài liệu được xét, nên một tiêu đề chỉ gồm kanji trong tài liệu tiếng Nhật được vẽ bằng kiểu Nhật. Một tài liệu có cả kana lẫn Hangul không quyết định được gì ở bước này.
3. Một ký tự chỉ chữ Trung phồn thể dùng, như 體 hoặc 說, trong đoạn đó hoặc nếu không thì trong tài liệu, nghĩa là chữ Trung phồn thể, trừ khi cùng văn bản đó cũng có một ký tự chỉ chữ Trung giản thể dùng.
4. Nếu không thì là chữ Trung giản thể.

Một ký tự mà phông được chọn không có thì không bao giờ được lấy từ một trong ba phông còn lại. Nó vẫn là ảnh, như mô tả bên dưới. Kana hoặc Hangul mà phông được chọn thiếu, như các từ tiếng Hàn trong một dòng được đánh dấu là tiếng Nhật, vẫn có thể lấy từ phông Nhật hoặc Hàn, nhưng chỉ khi phông đó không phải vẽ ký tự dùng chung nào của dòng.

Trên trang, một canvas có hai trong các ngôn ngữ này liệt kê cả hai phông, và trình duyệt vẽ các ký tự dùng chung bằng phông đầu tiên. Bản xuất vẽ từng đoạn bằng phông riêng của nó.

## Khi nào một phông được tải

Không có gì được tải cho đến khi một tài liệu có ký tự mà không phông nào của hệ thống thiết kế vẽ được. Một tài liệu tiếng Anh, hoặc bằng bất kỳ ngôn ngữ nào mà hệ thống thiết kế bao phủ, không bao giờ tải phông dự phòng. Một ký hiệu trong dòng tiếng Anh, như ★ hoặc ※, không bao giờ tải phông Trung, Nhật hay Hàn.

Lần đầu một tài liệu cần một phông, Lolly tải đúng phông đó, cho đúng hệ chữ đó, và giữ nó trên thiết bị của bạn. Một tài liệu tiếng Nhật chỉ tải phông Nhật, 2,1 MB, và một tài liệu chữ Trung phồn thể tải phông phồn thể 3,6 MB. Từ đó hệ chữ này được vẽ ngoại tuyến, và phông vẫn ở lại khi danh mục được dọn dẹp. Phông được giữ cùng các tệp riêng của danh mục, không bao giờ nằm trong số các phông bạn đã tải lên, nên nó không xuất hiện trong danh sách phông của thương hiệu bạn.

Dòng lệnh, ứng dụng terminal và máy chủ MCP đọc cùng các tệp đó từ đĩa, nên không cần tải xuống.

## Trên trang và trong bản xuất

Trang dùng cùng phông dự phòng với bản xuất. Nếu không, trình duyệt vẽ các chữ đó bằng một phông hệ thống trong khi bản xuất dùng Noto, và một dòng có chúng đổi độ rộng giữa hai nơi. Lolly thêm phông dự phòng vào cuối danh sách phông của hệ thống thiết kế chỉ trên canvas đó, sau các phông riêng của hệ thống thiết kế và trước mọi phông hệ thống. Một canvas mà hệ thống thiết kế bao phủ giữ danh sách phông y như trước.

Trong PDF, các từ trở thành đường bao được vẽ bằng phông dự phòng, bất kể bạn chọn thiết lập văn bản nào, vì văn bản PDF trực tiếp không thể mang một hệ chữ mà phông nhúng thiếu. Trong SVG, EMF, EPS, DXF và WMF, chúng trở thành đường bao bất cứ khi nào văn bản được chuyển thành đường bao; khi văn bản được giữ trực tiếp, phông riêng của người đọc vẽ chúng, như trước. Khi một phông dự phòng đã vẽ một phần của bản xuất, bảng xuất hiện một ghi chú như:

> Văn bản tiếng Nhật được vẽ bằng Noto Sans JP, vì phông của hệ thống thiết kế này không có những chữ đó.

Dòng lệnh in cùng câu đó như một ghi chú.

## Những gì vẫn là ảnh

Một ký tự nằm ngoài bốn bộ ký tự quốc gia thì không có phông dự phòng. Các ký tự hiếm như 𠮷, các ký tự được bộ bổ sung của Hồng Kông thêm vào, và các hệ chữ không có phông dự phòng, như Tamil, Ethiopia hoặc Syriac, đều được xử lý theo cùng một cách. Trong PDF, dòng chứa một ký tự như vậy được đưa vào dưới dạng ảnh 300 dpi, và bảng xuất liệt kê các hệ chữ. Trong SVG, đoạn đó vẫn là văn bản trực tiếp, do phông riêng của người đọc vẽ.

## Giấy phép và ghi công

Mọi phông dự phòng đều theo SIL Open Font License 1.1, và mỗi mục danh mục ghi giấy phép đó kèm mã băm của văn bản giấy phép, nên các quy tắc quyền trong [Creative rights and credits](/info/creative-rights.html) đọc giấy phép như với phông chữ khác. Các văn bản giấy phép nằm cạnh các phông. Các tệp Noto Sans không khai báo Reserved Font Name. Các phông Trung, Nhật và Hàn là của Adobe, và bảo lưu tên Source; các tệp đã cắt giữ tên Noto của chúng, không dùng tên đó.

Giấy phép nói rằng các điều khoản của nó không áp dụng cho tài liệu làm bằng các phông. Một bản xuất chỉ chứa các đường bao đã vẽ của những chữ nó dùng, như với phông riêng của hệ thống thiết kế, và Lolly không thêm chương trình phông, dòng ghi công hay mục content credential mới nào cho một phông dự phòng.
