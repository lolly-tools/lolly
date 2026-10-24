# Chính sách quyền riêng tư

*Cập nhật lần cuối: 23 tháng 10 năm 2026*

**Việc tạo ra sản phẩm trong Lolly diễn ra ngay trên thiết bị của bạn.** Mở công cụ, gõ nội dung, xem trước, xuất và kiểm tra tệp đều chạy trong ứng dụng trên điện thoại, máy tính hoặc trình duyệt của bạn. Bạn không cần tài khoản, và ứng dụng không đặt cookie cho bất kỳ việc nào trong số đó.

**Những gì bạn tạo ra chỉ rời khỏi thiết bị khi bạn yêu cầu.** Thêm Google Font, gửi tệp lên Drive hoặc Dropbox, bật Sync, phát radio hoặc tải một mô hình AI chạy trên thiết bị đều tạo ra một yêu cầu do chính bạn khởi động. Ứng dụng cũng tải công cụ và bản cập nhật từ địa chỉ riêng của nó, và các yêu cầu đó không mang theo bất cứ thứ gì bạn đã tạo. [Mọi yêu cầu mạng mà ứng dụng có thể gửi](#every-network-request-the-app-can-make) liệt kê chúng, theo từng máy chủ.

**Một số dịch vụ của Lolly chạy trên máy chủ.** Liên kết kết xuất, trình tải ảnh, điểm cuối cho tác tử AI và dịch vụ danh tính đã xác minh chỉ nhận những gì bạn gửi, và không giữ lâu hơn thời hạn trang này nêu.

**Phiên bản Lolly Work của tổ chức bạn thì khác.** Nó lưu công việc chung mà bạn đưa vào đó, và chính sách của đơn vị vận hành áp dụng cho dữ liệu đó, không phải chính sách này.

::: figure privacy-where-data-goes
Dữ liệu của bạn đi đâu: dữ liệu ở lại trên thiết bị trừ khi bạn khởi động một yêu cầu, và mỗi loại yêu cầu có đích đến riêng.
:::

## Chính sách này bao gồm những gì

Lolly là phần mềm mã nguồn mở mà ai cũng có thể chạy: một engine, các shell ứng dụng cho web, máy tính, di động và terminal, cùng một tiện ích mở rộng trình duyệt. Chính sách này có hai phần:

- <!--i:code--> **Bản thân phần mềm**: những gì nó làm và không làm với dữ liệu của bạn, dù chạy ở đâu. Đây là thuộc tính của mã nguồn, nên đúng với mọi bản triển khai Lolly, của chúng tôi hay của bất kỳ ai khác.
- <!--i:server--> **lolly.tools**, bản triển khai tham chiếu do SUSE vận hành: các lựa chọn khi chạy những thành phần máy chủ tùy chọn của nó, chẳng hạn ghi nhật ký những gì, trong bao lâu và ai được xem.

Trên một phiên bản Lolly tự lưu trữ hoặc doanh nghiệp, hành vi của phần mềm nêu dưới đây vẫn áp dụng, nhưng *đơn vị vận hành* phiên bản đó, không phải SUSE, chịu trách nhiệm về mọi thứ trên máy chủ của họ: điểm cuối kết xuất, máy chủ MCP, dịch vụ chứng chỉ và phiên bản Lolly Work của họ. Hãy hỏi họ về chính sách riêng. [Adoption & Governance](/info/adoption-governance.html) mô tả việc vận hành Lolly bao gồm những gì.

## Những gì ở lại trên thiết bị của bạn

Các ứng dụng web, máy tính và di động của Lolly chạy toàn bộ engine kết xuất trên thiết bị. Khi các công cụ, tài nguyên và bộ mã hóa bạn dùng đã nằm trên thiết bị, việc kết xuất và tải xuống không cần máy chủ.

**Dùng ứng dụng độc lập không đặt cookie.** Đăng nhập tổ chức và việc đăng ký danh tính đã xác minh (tùy chọn) có cookie riêng, được mô tả trong các phần của chúng. Ứng dụng lưu các bản ghi sau trên thiết bị:

- <!--i:sliders--> **Tùy chọn giao diện**: chủ đề, ngôn ngữ, cài đặt âm thanh, kích thước thanh bên và thu phóng, lựa chọn sắp xếp và chế độ xem, cùng các mẹo bạn đã xem, lưu trong `localStorage` để sẵn sàng trước khi ứng dụng khởi động xong.
- <!--i:download--> **Bộ nhớ đệm ngoại tuyến của danh mục công cụ và bản xem trước tài nguyên**, để thư viện hoạt động khi không có kết nối.
- <!--i:hash--> **Bộ đếm sử dụng cục bộ** cho số liệu trên thẻ hồ sơ của bạn, chẳng hạn số lần xuất và công cụ nào: một bản ghi nhỏ, có giới hạn trong `localStorage`, chúng tôi không bao giờ đọc và không gửi đi đâu.
- <!--i:folder--> **Công việc của chính bạn**: tài liệu, phiên đã lưu và lịch sử của chúng, ảnh và phông chữ đã tải lên, kết quả tệp và các phiên bản trước, cùng Thùng rác, nơi giữ các mục đã xóa trong 30 ngày. Chúng nằm trong IndexedDB trên thiết bị và ở yên đó trừ khi bạn chọn Sync hoặc chia sẻ.
- <!--i:globe--> **Tra cứu thành phố của Meeting Planner**, trong `localStorage`, để mỗi thành phố chỉ phải tra một lần.
- <!--i:cpu--> **Mô hình đã tải và công cụ đã ghim**: các mô hình AI trên thiết bị bạn đã đồng ý tải và những công cụ bạn ghim để dùng ngoại tuyến.

**Settings → Storage** cho biết Lolly dùng bao nhiêu dung lượng trên thiết bị, với công việc của bạn, Thùng rác, mô hình đã tải, bản sao ngoại tuyến và bộ nhớ đệm được liệt kê từng mục. **Clear all my data** ở đó xóa bản sao cục bộ và tắt Sync trước; xóa dữ liệu lưu trữ của trang trong trình duyệt cũng có tác dụng tương tự. Bộ nhớ thật sự cần thiết cho dịch vụ bạn yêu cầu không cần sự đồng ý theo Chỉ thị ePrivacy (Art. 5(3)), chỉ cần minh bạch, và đó là điều tài liệu này cùng thông báo trong ứng dụng cung cấp.

![Phần lưu trữ của Settings trên màn hình cỡ điện thoại: mọi loại dữ liệu trên thiết bị đều được gọi tên, với nút Clear all my data bên cạnh danh sách](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

**Export my data** tạo ra một tệp `lolly-backup` do bạn giữ và kiểm soát. Tệp không bao giờ chạm tới máy chủ của chúng tôi trừ khi chính bạn gửi nó đi đâu đó. Xem [Data transfer](/info/data-transfer.html).

### Các tiện ích chạy trên thiết bị của bạn

Một số công cụ, như **Strip Hidden Data**, **Compress** và những công cụ khác có huy hiệu **Runs on your device**, xử lý một tệp do bạn cung cấp. Tệp được đọc vào bộ nhớ, biến đổi ngay trên thiết bị và trả lại dưới dạng tệp tải xuống. Tệp không bao giờ được tải lên, vì không có máy chủ nào trên đường đi. Các tiện ích này hoạt động ngoại tuyến, và đầu ra của chúng không mang hình mờ hay siêu dữ liệu nào của chúng tôi.

**Rondocode** là ngoại lệ duy nhất, vì nó tạo ra âm thanh mới từ bài hát của bạn thay vì biến đổi một tệp của bạn. Mọi tệp âm thanh nó ghi ra đều mang Content Credentials ghi lại bài hát và khai báo mọi giọng hát do AI tạo. Bảng Export nói rõ điều này trước khi bạn xuất, và [Rondocode songs](/info/rondocode.html#files-from-the-rondocode-utility) liệt kê chính xác những gì được ghi lại.

![Huy hiệu mà các công cụ này mang: Runs on your device - không có gì được tải lên](/t/url-shot?url=%2F%23%2Ftool%2Ftext-helper&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%5Bdata-privacy%5D&dark=1&filename=pv-ondevice-badge)

**Prepare for sharing** và **Compare** hoạt động trong bộ nhớ trên thiết bị và không gửi gì tới máy chủ, và Prepare không thêm gì vào lịch sử, liên kết, bản sao lưu hay Sync cho đến khi bạn lưu một kết quả.

::: details Cách Prepare for sharing và Compare xử lý tệp của bạn
**Prepare for sharing** giữ đầu vào làm việc, các phát hiện riêng tư và bản đồ thay thế trong bộ nhớ, không thêm chúng vào lịch sử, liên kết, bản sao lưu hay Sync. Việc kiểm tra và thay thế không gửi nội dung tệp tới máy chủ và không kiểm tra thông tin xác thực trực tuyến. Bạn chọn sao chép, tải xuống, gửi hay lưu kết quả vào thư viện của mình; kết quả đã lưu sau đó theo cài đặt sao lưu và Sync của thư viện. Tệp công thức bỏ qua nội dung trước đó và các ánh xạ nguyên văn, còn báo cáo tóm tắt chứa số lượng, ID phạm vi và giá trị băm tệp. CLI chỉ lưu tệp xem xét riêng tư kèm giá trị gốc khi được yêu cầu bằng `--review-file`. Rời khỏi chế độ xem chuẩn bị sẽ giải phóng trạng thái làm việc, nhưng đó không phải lời hứa xóa sạch theo kiểu pháp y khỏi bộ nhớ của trình duyệt hay hệ điều hành.

Bản sao đã chuẩn bị và các thao tác tệp đã hoàn tất dùng chung các điều khiển Compare. Giá trị đã gỡ bỏ ban đầu được thu gọn, và báo cáo so sánh bỏ qua tên nguồn, đường dẫn và giá trị trừ khi bạn chọn đưa vào. Lịch sử tệp lưu bản sao, nên muốn so sánh sau khi tải lại thì phải chọn lại tệp gốc, được khớp bằng SHA-256 đã ghi. Việc chọn không lưu hay tải tệp lên.
:::

Strip Hidden Data và Prepare for sharing cũng kiểm tra tệp DOCX, PPTX và XLSX trên thiết bị. Với tệp DOCX được hỗ trợ, các thuộc tính đã chọn có thể được gỡ bỏ trong một bản sao mới; nội dung Office khác chỉ để kiểm tra, và bản xem trước riêng tư nằm sau một nút hiện.

::: details Việc kiểm tra Office đọc và gỡ bỏ những gì
| Định dạng Office | Nội dung gói được kiểm tra | Hỗ trợ gỡ bỏ |
|---|---|---|
| DOCX | Thuộc tính lõi, ứng dụng và tùy chỉnh; chú thích và tác giả; dấu theo dõi thay đổi và bản xem trước; đoạn văn bản ẩn; quan hệ bên ngoài; đối tượng nhúng | Tác giả, người lưu gần nhất, ngày tạo/sửa/in lần cuối, tiêu đề, chủ đề, mô tả, từ khóa, thuộc tính tùy chỉnh, Company, Manager, Template, hyperlink base, tên và phiên bản ứng dụng, cùng số liệu thống kê (tổng thời gian chỉnh sửa và số trang, từ, ký tự, dòng, đoạn) đã chọn |
| PPTX | Thuộc tính; chú thích và bản ghi tác giả; ghi chú diễn giả; dấu trang chiếu ẩn; quan hệ bên ngoài; đối tượng nhúng và sổ làm việc lồng nhau được hỗ trợ | Không |
| XLSX | Thuộc tính; chú thích và ghi chú; dấu trang tính, hàng và cột ẩn; tên đã định nghĩa; quan hệ và kết nối bên ngoài; liên kết ngoài và bề mặt bộ đệm pivot; đối tượng nhúng | Không |

**Giới hạn.** Cuộc kiểm kê không kiểm tra đầy đủ văn bản hiển thị, công thức, phụ thuộc, hình thức kết xuất hay các phần nhị phân tùy ý. Nó hỗ trợ tối đa 300 phần của gói, 64 MiB tổng mức giải nén được khai báo, 2 MiB cho mỗi phần XML và hai cấp gói nhúng lồng nhau; Prepare dùng chung ngân sách về số phần và mức giải nén cho cả tác vụ. Nội dung bị cắt cụt, hỏng, được mã hóa hoặc không được hỗ trợ sẽ được báo cáo và giữ nguyên. Nội dung macro được nhận diện và không bao giờ chạy, định dạng Office nhị phân cũ và XLSB không được kiểm tra, và các tham chiếu bên ngoài không bao giờ được tải.

**Việc dọn dẹp DOCX giữ lại gì.** Việc dọn dẹp hỗ trợ định dạng gói DOCX chuyển tiếp (transitional) với các phần thuộc tính lõi, tùy chỉnh và mở rộng chuẩn. Từ thuộc tính mở rộng, có thể gỡ Company, Manager, Template, HyperlinkBase, Application, AppVersion và các thống kê TotalTime, Pages, Words, Characters, CharactersWithSpaces, Lines và Paragraphs. DocSecurity, tiêu đề đề mục và tiêu đề phần, cờ liên kết và các thuộc tính ứng dụng khác được giữ. Gỡ Template để lại mọi liên kết mẫu đính kèm trong cài đặt tài liệu, nơi cuộc kiểm kê báo cáo nó như một quan hệ bên ngoài.

Một số trình đọc chọn cách vẽ biểu đồ và hình vẽ dựa trên tên và phiên bản ứng dụng; chẳng hạn LibreOffice hiển thị biểu đồ từ tệp Word 2007 khác đi nếu thiếu chúng. Cả hai được giữ khi tệp chứa biểu đồ, ảnh, hình khối hoặc đối tượng nhúng, và việc kiểm tra liệt kê chúng là được giữ. Thuộc tính mà một trường Word hiển thị (TEMPLATE, EDITTIME, NUMPAGES, NUMWORDS hoặc NUMCHARS) được giữ, còn các trường liên kết và liên kết ngoài tương đối giữ HyperlinkBase, vì đích của chúng được phân giải theo địa chỉ gốc đó.

**Những gì chỉ để kiểm tra.** Dữ liệu chữ ký số mở rộng chặn việc dọn dẹp. Gói Office có chữ ký, bật macro, được mã hóa, hỏng, bị đổi tên hoặc lồng nhau chỉ để kiểm tra. Tệp có các trường Word khác phụ thuộc thuộc tính, như DOCPROPERTY hoặc AUTHOR, hoặc có điều khiển nội dung ràng buộc XML cũng vậy, vì gỡ một thuộc tính có thể làm thay đổi tài liệu khi Word cập nhật các ràng buộc đó, và văn bản trường đã lưu đệm không thể cho thấy lần kết xuất tiếp theo sẽ giống nhau. Các phần XML có đuôi tên tệp bất thường, đích quan hệ XML của Word không thể kiểm tra an toàn, các phần đầu trang hoặc chân trang khai báo sai và các phần SVG khai báo là XML với đuôi `.svg` cũng chỉ để kiểm tra trong bản dọn dẹp đầu tiên này.

**Cách việc dọn dẹp tự kiểm tra.** Các phần thuộc tính, khai báo của chúng, các thành phần gói không liên quan, chú thích XML và chú thích ZIP được giữ. Việc dọn dẹp áp dụng các giới hạn kiểm kê và kiểm tra tính toàn vẹn của từng thành phần trước khi ghi, rồi kiểm tra lại các thuộc tính kết quả. Compare hiển thị các khác biệt thuộc tính được hỗ trợ với giá trị được thu gọn; nó không so sánh văn bản hiển thị hay hình thức kết xuất. Giá trị dùng bản xem trước tối đa 2048 ký tự, nên khác biệt vượt quá bản xem trước có thể không hiện ra, và một lần xem xét một phần không thể xác lập rằng hai tệp bằng nhau. Lệnh `prepare --strip-hidden-data` của CLI gỡ các thuộc tính DOCX được hỗ trợ, và một phong bì xem xét riêng tư có thể chọn từng thuộc tính. Nếu chốt kiểm tra khi dọn dẹp thất bại, tệp được giữ nguyên và một thao tác thất bại được báo cáo.
:::

## Mọi yêu cầu mạng mà ứng dụng có thể thực hiện

Phần lớn các yêu cầu đưa công cụ, phông chữ hoặc mô hình về thiết bị của bạn. Hành động Send truyền tệp bạn đã chọn, Sync truyền một bản sao lưu tới nơi lưu trữ bạn đã chọn, và các dịch vụ tổ chức truyền nội dung hoặc chi tiết cần thiết cho công việc chung. Mỗi nhóm dưới đây liệt kê những gì rời khỏi thiết bị của bạn, khi nào, và điều gì xảy ra nếu đơn vị vận hành chặn yêu cầu. Các nhà cung cấp danh tính và tài nguyên do đơn vị vận hành cấu hình có thể thêm đích đến cho bản triển khai đó. [Mọi máy chủ cố định, trong một bảng](#every-fixed-host-in-one-table) liệt kê các máy chủ mà ứng dụng web có thể liên hệ.

::: details Những thứ được tải về thiết bị của bạn
- <!--i:download--> **Danh mục công cụ.** Không có gì cá nhân: một yêu cầu tới chỉ mục công cụ và tài nguyên công khai của chính Lolly, tại địa chỉ riêng của ứng dụng, khi khởi động rồi được lưu đệm ngoại tuyến. Nếu bị chặn, ứng dụng chạy bằng các công cụ đã lưu đệm và ngừng khám phá công cụ mới.
- <!--i:sparkle--> **Bộ emoji.** Bộ bạn chọn được tải từ địa chỉ riêng của ứng dụng vào lần đầu bạn dùng bộ đó. Không có gì cá nhân được gửi. Hoạt ảnh Lottie được đọc trên thiết bị và không liên hệ với ai.
- <!--i:document--> **Google Fonts.** Tên họ phông chữ đã chọn và địa chỉ IP của bạn được gửi tới máy chủ phông chữ của Google (`fonts.googleapis.com` cho bảng định kiểu, `fonts.gstatic.com` cho tệp phông chữ). Việc này chỉ xảy ra khi bạn thêm Google Font trong Design System Setup, và chỉ sau khi bạn đồng ý trong một hộp thoại nói đúng điều này. Mỗi họ phông chữ được tải một lần, sau đó giữ trên thiết bị và dùng ngoại tuyến. Nếu bị chặn, bộ chọn thất bại theo hướng đóng; hãy tải lên một tệp phông chữ thay thế.
- <!--i:cpu--> **Mô hình AI trên thiết bị.** Không có gì cá nhân: tải một tệp mô hình rồi giữ trên thiết bị. Bản dựng web mặc định dùng địa chỉ riêng của ứng dụng; một bản dựng có thể chỉ định máy chủ mô hình khác, chẳng hạn máy chủ phát hành của Lolly là `lolli.li` cho các ứng dụng đóng gói. Máy chủ nhận yêu cầu và địa chỉ IP của bạn, không có tài khoản và không có đầu vào của mô hình. Việc này chỉ xảy ra khi bạn dùng một tính năng cần mô hình (quét sâu của Verify, phóng to ảnh, giọng nói và các tính năng tương tự) hoặc chọn tải mô hình để dùng ngoại tuyến. Nếu bị chặn, tính năng đó phải chờ và mọi thứ khác vẫn hoạt động.
- <!--i:sliders--> **Hồ sơ màu ICC cho in ấn.** Không có gì cá nhân: một yêu cầu lấy hồ sơ điều kiện in tiêu chuẩn từ sổ đăng ký công khai của ICC (`registry.color.org`, `www.color.org`), chỉ khi bạn nhấp một cài đặt sẵn ICC trong trình quản lý hồ sơ in, mỗi hồ sơ một lần. Nếu bị chặn, các cài đặt sẵn thất bại; hãy cung cấp hồ sơ `.icc` của riêng bạn.
- <!--i:globe--> **Radio internet.** Không có gì cá nhân: một yêu cầu danh sách phát và một luồng âm thanh từ đài (`api.somafm.com` và máy chủ luồng mà nó trỏ tới, `*.somafm.com`), chỉ khi bạn phát radio tùy chọn trong trình phát âm thanh. Nếu bị chặn, radio thất bại và mọi tính năng âm thanh khác vẫn hoạt động.
:::

::: details Một công cụ cần dữ liệu trực tiếp
- <!--i:globe--> **Tra cứu thành phố của Meeting Planner.** Hiện nay đây là công cụ duy nhất tải dữ liệu trực tiếp. Nó hỏi `geocoding-api.open-meteo.com` để đổi mỗi tên thành phố (thành phố chủ trì và thành phố của từng thành viên nhóm) thành tọa độ và múi giờ, không có tài khoản, không có khóa và không có định danh nào ngoài chính yêu cầu. Ô nhập Host city giải thích điều này, và mỗi câu trả lời được lưu trên thiết bị nên một thành phố chỉ phải tra một lần. Nó chỉ chạy khi công cụ đang mở. Nếu bị chặn, việc tra cứu thất bại và không ảnh hưởng gì khác.
:::

::: details Các tệp bạn gửi đi
Mỗi mục dưới đây chỉ gửi đúng một tệp bạn đã chọn, khi bạn nhấn nút Send của nó, sau khi bạn hoàn tất đăng nhập trong cửa sổ riêng của dịch vụ. Mật khẩu ứng dụng Bluesky, địa chỉ webhook Discord, mật khẩu ứng dụng Nextcloud và khóa S3 chỉ được lưu trên thiết bị này, không bao giờ nằm trong bản sao lưu, và **Disconnect** xóa chúng.

- <!--i:upload--> **Google Drive.** Tệp, ở bất kỳ định dạng nào, được gửi tới API Drive của Google (`www.googleapis.com`). Quyền truy cập của Lolly giới hạn trong các tệp do nó tạo (phạm vi `drive.file`), nên nó không bao giờ đọc được phần còn lại của Drive của bạn. Trong ứng dụng web, token đăng nhập được giữ trong bộ nhớ trong suốt phiên và không bao giờ được lưu; trong các ứng dụng khác, refresh token chỉ được lưu trên thiết bị này nếu bạn đánh dấu **Stay connected**. Nút này chỉ có trên các bản dựng mà đơn vị vận hành đã cấu hình Google client id. Nếu bị chặn, nút không bao giờ xuất hiện; hãy tải tệp xuống và tự tải lên.
- <!--i:upload--> **Dropbox.** Tệp được gửi tới API của Dropbox (`api.dropboxapi.com` cho đăng nhập và siêu dữ liệu, `content.dropboxapi.com` cho tệp). Quyền truy cập chỉ giới hạn trong thư mục ứng dụng, nên Lolly thấy `Apps/` và thư mục riêng của nó ở đó, không gì khác. Liên kết **Open** mà nó hiển thị là một liên kết riêng tư tồn tại ngắn, và không có chia sẻ công khai nào được tạo. Refresh token chỉ được lưu nếu bạn đánh dấu **Stay connected**. Nút này chỉ có khi đơn vị vận hành đã cấu hình Dropbox client id.
- <!--i:upload--> **OneDrive.** Tệp được gửi tới dịch vụ danh tính và Graph của Microsoft (`login.microsoftonline.com` cho đăng nhập, `graph.microsoft.com` cho việc tải lên); tệp lớn được tải lên theo từng phần tới `api.onedrive.com` hoặc các nguồn lưu trữ do đơn vị vận hành cấu hình. Quyền truy cập giới hạn trong thư mục riêng của Lolly dưới `Apps/`, cộng với tên hiển thị của bạn để làm nhãn tài khoản. Refresh token chỉ được lưu nếu bạn đánh dấu **Stay connected**. Nút này chỉ có khi đơn vị vận hành đã cấu hình Microsoft client id.
- <!--i:upload--> **LinkedIn**, **chỉ trong các ứng dụng máy tính**. Tệp, cùng tên của nó làm nội dung bài đăng, được gửi tới LinkedIn (`www.linkedin.com` để đăng nhập trong trình duyệt của chính bạn, `api.linkedin.com` để tải lên và đăng) dưới dạng bài đăng công khai trên bảng tin của bạn. Lolly có thể đăng thay bạn và đọc tên của bạn để làm nhãn tài khoản, không gì khác. Phiên đăng nhập chỉ được giữ nếu bạn đánh dấu **Stay connected**, và token của LinkedIn có hiệu lực 60 ngày và không thể gia hạn âm thầm, nên nó tự hết hạn. Các máy chủ đó không nằm trong chính sách kết nối của ứng dụng web. Nút này chỉ có trên các bản dựng đã cấu hình ứng dụng LinkedIn.
- <!--i:upload--> **Penpot.** Token truy cập cá nhân Penpot mà bạn dán vào ứng dụng, cùng kho lưu trữ `.penpot` của bản thiết kế, được gửi tới API của Penpot (`design.penpot.app`) qua một lớp chuyển tiếp nhỏ tại địa chỉ riêng của ứng dụng (`/api/penpot`), vì API của Penpot không trả lời trực tiếp cho trình duyệt. Lớp chuyển tiếp này chuyển đi rồi quên; các ứng dụng máy tính nói chuyện trực tiếp với Penpot. Việc này chỉ xảy ra khi bạn nhấn **Send to Penpot** trong công cụ Design và xác nhận một dự án. Nếu bị chặn, việc gửi thất bại theo hướng đóng; hãy xuất tệp `.penpot` và tự nhập.
- <!--i:upload--> **Bluesky.** Hình ảnh, tên của nó làm nội dung bài đăng và văn bản thay thế, cùng tên người dùng và mật khẩu ứng dụng của bạn (tạo tại Bluesky → Settings → App passwords, không bao giờ là mật khẩu tài khoản) được gửi tới máy chủ Bluesky bạn chỉ định, mặc định là `bsky.social` trừ khi bạn chọn máy chủ khác. Trước tiên bạn kết nối tài khoản trong **Settings → Connected services**.
- <!--i:upload--> **Discord.** Tệp được gửi dưới dạng tệp đính kèm tới địa chỉ webhook của kênh bạn đã dán, trên discord.com. Ai nắm địa chỉ webhook cũng có thể đăng vào kênh đó, vì vậy nó ở lại trên thiết bị.
- <!--i:upload--> **Mastodon.** Tệp, cùng tên của nó làm nội dung bài đăng, được gửi tới máy chủ Mastodon hoặc tương thích mà bạn chỉ định, sau khi đăng nhập trong cửa sổ riêng của máy chủ đó. Việc kết nối đăng ký một ứng dụng nhỏ cho thiết bị này trên máy chủ đó, và phiên đăng nhập chỉ được giữ nếu bạn đánh dấu **Stay connected**.
- <!--i:upload--> **Nextcloud hoặc WebDAV.** Tệp được gửi tới máy chủ của chính bạn trong một lần tải lên có xác thực, với địa chỉ máy chủ, tên người dùng và mật khẩu ứng dụng bạn đã nhập (Nextcloud → Settings → Security → Devices & sessions; không bao giờ là mật khẩu tài khoản).
- <!--i:upload--> **Kho lưu trữ tương thích S3.** Tệp được gửi tới bucket của chính bạn (AWS S3, MinIO, R2, B2, Garage hoặc bất kỳ điểm cuối SigV4 nào), được ký trên thiết bị bằng cặp khóa bạn đã nhập.

**Các máy chủ do bạn chọn cần được đơn vị vận hành phê duyệt.** Các máy chủ Bluesky, Discord, Mastodon, Nextcloud và S3 không nằm trong danh sách cố định của Lolly, vì chính bạn chọn chúng. Ứng dụng không gửi gì tới máy chủ nào cho đến khi đơn vị vận hành phê duyệt đúng máy chủ HTTPS đó: trên web, trong Content Security Policy của bản triển khai; trong các ứng dụng máy tính, khi ứng dụng được dựng. Điều tương tự áp dụng cho các máy chủ tải lên lưu trữ tùy chỉnh và SharePoint. Trên web, máy chủ cũng phải cho phép các lệnh gọi từ trình duyệt đến từ ứng dụng (CORS), và việc chuyển hướng thất bại theo hướng đóng, nên hãy dùng địa chỉ không chuyển hướng. Các ứng dụng máy tính kiểm tra mọi lần chuyển hướng với danh sách đã phê duyệt.

Danh sách này giới hạn những máy chủ mà ứng dụng có thể truy cập. Nó không phân biệt tài khoản hay tenant trên Google hoặc Microsoft, và quyền riêng của nhà cung cấp quyết định tài khoản và hành động nào được phép. Nó cũng không bao gồm cửa sổ đăng nhập, các loại tài nguyên khác hay tính năng gốc, những thứ có quy tắc riêng. Một thay đổi cần bản dựng máy tính mới hoặc tiêu đề phản hồi web mới; hãy lưu công việc trước khi mở lại ứng dụng để áp dụng. [Connector origins](/info/connector-origins.html) mô tả cấu hình.
:::

::: details Đồng bộ giữa các thiết bị của bạn
- <!--i:folder--> **Những gì rời đi.** Một bản sao những gì bạn đã tạo trên thiết bị này (phiên và dự án đã lưu, các hệ thống thiết kế của bạn cùng phông chữ và logo, ảnh đã tải lên, hồ sơ và tùy chọn) dưới dạng một tệp, tới một nơi lưu trữ duy nhất bạn đã chọn: thư mục ứng dụng Lolly trong Dropbox của bạn (`api.dropboxapi.com`, `content.dropboxapi.com`), các tệp Lolly đã tạo trong Google Drive của bạn (`www.googleapis.com`), thư mục ứng dụng Lolly trong OneDrive của bạn (`graph.microsoft.com`, với tệp lớn hơn được tải lên `api.onedrive.com` hoặc các nguồn lưu trữ do đơn vị vận hành cấu hình, và tải xuống từ đúng các nguồn lưu trữ do đơn vị vận hành cấu hình), hoặc Nextcloud, máy chủ WebDAV hay bucket S3 của riêng bạn. Cùng nơi lưu trữ đó giữ tối đa bảy bản sao hằng ngày và một bản sao từ trước lần áp dụng gần nhất.
- <!--i:shieldcheck--> **Không có gì đi tới Lolly.** Không có máy chủ Lolly, rơ-le hay máy chủ Lolly Work nào trên đường đi, và các ứng dụng không cần trang web Lolly nào cho việc này, kể cả để đăng nhập. Bản sao chỉ được mã hóa trên thiết bị trước nếu bạn đặt cụm mật khẩu. Thông tin đăng nhập, khóa, mật khẩu ứng dụng, cụm mật khẩu và cài đặt Sync ở lại trên thiết bị và không bao giờ nằm trong bản sao. Trên web, kết nối Google Drive được ghi nhớ chỉ giữ tên tài khoản của bạn (và client id của riêng bạn, nếu bạn cung cấp), và phiên đăng nhập Google kéo dài một lượt truy cập. Trong ứng dụng Android, việc đăng nhập Google Drive đi qua Google Play services trên điện thoại, do Google vận hành.
- <!--i:sliders--> **Khi nào.** Chỉ sau khi bạn bật **Sync across my devices** hoặc nhấn **Sync now**: tải lên ngay sau mỗi thay đổi và khi bạn rời ứng dụng, cùng một lần kiểm tra bản sao mới hơn khi ứng dụng khởi động. Nếu bị chặn, Sync thất bại và nói rõ lý do, còn công việc của bạn ở lại trên thiết bị. Bạn có thể xuất dữ liệu ra tệp và tự chuyển thay thế. [Sync your devices](/info/sync.html) trình bày tính năng này.
:::

::: details Trang web, ảnh chụp và hình ảnh từ các trang khác
- <!--i:monitor--> **Một URL bạn yêu cầu công cụ chụp.** Công cụ chụp ảnh URL yêu cầu đúng địa chỉ bạn gõ, chỉ khi bạn bắt đầu chụp. Vì bạn chọn địa chỉ ngay lúc đó, nó không nằm trong chính sách kết nối, và đơn vị vận hành không thể cho phép hay chặn nó theo máy chủ; muốn loại bỏ, hãy gỡ công cụ.
- <!--i:globe--> **Một trang web trong hộp Design.** Trang được yêu cầu, kèm địa chỉ IP của bạn, từ trang mà nó đến, cùng mọi thứ mà chính trang đó yêu cầu. Khi trình duyệt hỗ trợ, khung không được gửi cookie và không gửi địa chỉ nào ngoài nguồn gốc của chính ứng dụng, nên tài liệu của bạn và liên kết của nó không bao giờ đi cùng yêu cầu. Trên ứng dụng web chỉ các trình phát sau được đặt trong khung: `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com` (bản đồ) và `www.figma.com`, cùng các trang tham khảo trên `wikipedia.org` và `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org` và `www.openstreetmap.org`. **Allow pages from any site**, trong **Settings → Trusted sites**, tải lại Lolly trên thiết bị của bạn theo một chính sách có thể đặt khung cho bất kỳ trang `https:` nào, và các quy tắc về tin cậy và hỏi trước vẫn áp dụng. Một trang chỉ tải với trang nằm trong Trusted sites của bạn, kể cả các mặc định tham khảo có thể gỡ, hoặc sau khi bạn chấp thuận hộp đó trong bảng thuộc tính; trước đó, một bộ trình chiếu ai đó gửi cho bạn chỉ hiện một hình ảnh của mỗi trang. Trước khi trình chiếu, danh sách đưa ra **Just this time** và **Always trust** cho từng trang, và không có gì được hỏi khi bạn đang trình chiếu. Nếu bị chặn, hộp hiện hình ảnh của nó kèm liên kết mở trang trong thẻ mới. Công cụ Lolly và bản demo Sandbox trong một hộp chạy tại địa chỉ riêng của ứng dụng và không liên hệ với ai.
- <!--i:sliders--> **Thay đổi trang bạn hiển thị.** Hành động **Use page** của hộp trang web cho phép bạn từ chối cookie hoặc đóng biểu ngữ bên trong trang. Với các trang Lolly có thể truy cập, **Hide cookie banners** ẩn các lớp phủ đã biết, kể cả OneTrust, mà không chấp nhận cookie hay thay đổi lựa chọn đồng ý của trang. **Page CSS** thay đổi trang trực tiếp và phần trình chiếu của hộp đó; bản xuất vẫn dùng ảnh poster đã chọn. Các quy tắc không thể nhập tài nguyên hay phông chữ, và trình duyệt ngăn Lolly thay đổi CSS của trang khác. Bản xem trước Sandbox có trình soạn CSS riêng dưới **Edit in Sandbox**.
- <!--i:code--> **Tài nguyên web của bản demo Sandbox.** Mỗi bảng định kiểu, tập lệnh, phông chữ hoặc ảnh mà mã của bản demo liên kết tới được yêu cầu, kèm địa chỉ IP của bạn và không có cookie, từ trang lưu trữ nó; các tệp mà một bảng định kiểu đã tải nêu tên, như tệp phông chữ của Google Fonts, được tính là các trang riêng. Việc này chỉ xảy ra sau khi bạn nhấp **Fetch & inline**, hoặc với trang nằm trong Trusted sites của bạn; **Always trust** bên cạnh một tệp thêm trang của nó vào danh sách đó. Nếu bị chặn, bản demo chạy mà không có các tệp ấy, và Sandbox liệt kê từng tệp không tải được cùng lý do.
- <!--i:download--> **Thêm ảnh từ URL.** **Add from URL** trong bộ chọn tài nguyên hoặc Assets yêu cầu đúng địa chỉ ảnh bạn dán. Chính sách riêng của ứng dụng web ngăn trình duyệt tải trực tiếp từ trang khác, nên một lớp chuyển tiếp nhỏ tại địa chỉ riêng của ứng dụng (`/api/fetch-image`) tải ảnh và chỉ trả lại các byte; nó không lưu gì, quên địa chỉ và từ chối mọi thứ không phải địa chỉ ảnh công khai. Các ứng dụng máy tính tải địa chỉ trực tiếp. Liên kết Lolly bạn dán hoàn toàn không được tải: nó được kết xuất trên thiết bị. Nếu đơn vị vận hành tắt lớp chuyển tiếp (`LOLLY_DISABLE_IMAGE_PROXY=1`), trong ứng dụng web chỉ thêm được liên kết Lolly, ảnh `data:` và ảnh cùng nguồn gốc, còn ứng dụng máy tính không bị ảnh hưởng.
- <!--i:palette--> **Một hệ thống thiết kế từ trang web.** Design System Setup có thể đọc một trang của site bạn chỉ định, qua [tiện ích mở rộng trình duyệt](#the-browser-extension) hoặc cơ chế tải riêng của ứng dụng máy tính, không bao giờ qua máy chủ Lolly. Không có gì được tải trước khi bạn nhấn, và các liên kết trên trang không được theo.
:::

::: details Làm việc với người khác và tác tử
- <!--i:link--> **Một collab riêng tư.** Hai thiết bị kết nối trực tiếp, không có máy chủ ở giữa. Lời mời và phản hồi mang các địa chỉ mà mỗi thiết bị tự thấy trên mạng của nó, và bản dựng này không cấu hình máy chủ khám phá địa chỉ bên ngoài nào, nên chỉ đưa chúng cho người bạn đang làm việc cùng. Xem [Working together](/info/collaborate.html).
- <!--i:monitor--> **Nearby**, trong ứng dụng máy tính. Khi bạn hiển thị, tức mười phút khi bạn bắt đầu lời mời collab hoặc, nếu bạn bật, bất cứ khi nào ứng dụng đang chạy, ứng dụng thông báo một tên ngẫu nhiên, tên hiển thị bạn đã chọn và loại thiết bị trên mạng cục bộ. Nó không thông báo địa chỉ email, tài khoản hay định danh lâu dài nào.
- <!--i:link--> **Mời một tác tử.** Trạng thái của tài liệu được mời, các bản xem trước mà tác tử yêu cầu, danh tính của tác tử và các chỉnh sửa của nó đi qua rơ-le trực tiếp đã cấu hình (`lolly.ing` trên lolly.tools) tới tác tử bạn mời. Một plugin lưu trữ đã cài cũng chuyển các lệnh gọi qua trình kết nối lolly.tools tới rơ-le mà lời mời chọn; trình kết nối không giữ lời mời hay tài liệu nào giữa các lệnh gọi. Rơ-le giữ lời mời và các yêu cầu đang chờ trong bộ nhớ cho đến khi bạn ngắt kết nối hoặc chúng hết hạn: mười phút với lời mời chưa dùng và ba mươi phút không hoạt động với lời mời đã tham gia. Nhà cung cấp tác tử của bạn xử lý dữ liệu nó nhận theo chính sách riêng của họ. Việc này chỉ xảy ra sau khi bạn tạo lời mời trong Share và đưa hướng dẫn của nó cho tác tử; quyền đọc cho phép kiểm tra và quyền chỉnh sửa cũng cho phép thay đổi. Pause dừng các thay đổi, còn Disconnect hoặc thu hồi lời mời chấm dứt quyền truy cập. Nếu bị chặn, tác tử không thể tham gia hoặc tiếp tục, và bạn vẫn chỉnh sửa như thường.
- <!--i:cpu--> **Allow AI control**, trong ứng dụng máy tính. Một tác tử chạy trên máy tính này có thể đọc và chỉnh sửa tài liệu Design đang mở qua một kết nối ở lại trên máy tính. Tính năng tắt cho đến khi bạn bật. Lolly không gửi gì tới máy chủ cho việc này; nhà cung cấp tác tử xử lý những gì tác tử đọc theo chính sách riêng của họ. [Threat Model & Trust Boundaries](/info/threat-model.html) liệt kê những gì một tác tử như vậy làm được và không làm được.
- <!--i:server--> **Một phiên bản từ xa.** Khi bạn trỏ ứng dụng tới một bản triển khai Lolly khác, nó nhận mọi thứ phiên bản đó phục vụ lại, qua cùng cơ chế đồng bộ danh mục, kèm một thẻ phiên bản trên các yêu cầu gửi tới nó (loại ứng dụng và phiên bản engine, cùng thông tin mà một user agent mang theo), để đơn vị vận hành của nó thấy các phiên bản Lolly nào đang dùng. Trên một phiên bản được quản lý, khi bạn đã đăng nhập, thẻ còn mang một install id của thiết bị này, để danh sách thiết bị của đơn vị vận hành phân biệt được các bản cài; khi rời đi, id bị xóa, và một thiết bị kết nối lại sau đó sẽ trình id mới. Bạn chọn máy chủ, nên nó không nằm trong chính sách kết nối. Nếu bị chặn, việc chuyển đổi thất bại và phiên bản cục bộ của bạn không bị ảnh hưởng.
- <!--i:people--> **Phiên bản Lolly Work của tổ chức bạn.** Danh tính đăng nhập và thông tin thiết bị, các yêu cầu chính sách, các phiên chung, chỉnh sửa cộng tác, tệp tải lên, bản gửi phê duyệt và tệp bàn giao bạn dùng, cùng nhãn sự kiện sử dụng được phép khi có cấu hình, được gửi tới phiên bản của tổ chức bạn, với đăng nhập qua nhà cung cấp danh tính của nó. Việc làm mới chính sách và telemetry đã bật có thể chạy trong khi dùng; công việc chung, collab, xem xét và bàn giao gửi nội dung như một phần của các quy trình đó. Nếu bị chặn, các tính năng tổ chức đó không thể hoàn tất, và công việc cá nhân của bạn vẫn tách biệt. Xem [Organisation services with Lolly Work](#organisation-services-with-lolly-work).
:::

### Mọi máy chủ cố định, trong một bảng

Content Security Policy của ứng dụng web là thứ ngăn một tập lệnh truy cập bất kỳ máy chủ nào không được liệt kê. Ngoài địa chỉ riêng của ứng dụng, bảng nêu mọi máy chủ mà chính sách đó liệt kê, cộng hai máy chủ LinkedIn mà ứng dụng máy tính thêm vào, được đánh dấu là chỉ dành cho máy tính. Một bài kiểm thử CI đối chiếu bảng này với chính sách đã triển khai, nên không thể thêm máy chủ vào bên này mà không thêm vào bên kia.

| Mục | Những gì thực sự rời khỏi thiết bị của bạn | Máy chủ |
|---|---|---|
| Mô hình trên thiết bị trong các ứng dụng đóng gói, và tệp phát hành | Một yêu cầu lấy tệp công khai, kèm địa chỉ IP của bạn | `lolli.li` |
| Google Fonts | Tên họ phông chữ và địa chỉ IP của bạn | `fonts.googleapis.com`, `fonts.gstatic.com` |
| Send to và Sync với Google Drive | Tệp hoặc bản sao lưu bạn đã chọn | `www.googleapis.com` |
| Send to và Sync với Dropbox | Tệp hoặc bản sao lưu bạn đã chọn | `api.dropboxapi.com`, `content.dropboxapi.com` |
| Send to và Sync với OneDrive | Tệp hoặc bản sao lưu bạn đã chọn, và tên hiển thị của bạn làm nhãn tài khoản | `login.microsoftonline.com`, `graph.microsoft.com`, `api.onedrive.com` |
| Tra cứu thành phố của Meeting Planner | Mỗi tên thành phố | `geocoding-api.open-meteo.com` |
| Hồ sơ màu ICC cho in ấn | Một yêu cầu lấy hồ sơ công khai | `registry.color.org`, `www.color.org` |
| Radio internet | Một yêu cầu danh sách phát và một luồng âm thanh | `api.somafm.com`, `*.somafm.com` |
| Mời một tác tử, và không gian làm việc lolly.ing | Trạng thái, bản xem trước và chỉnh sửa của tài liệu được mời, cùng các yêu cầu không gian làm việc bạn gửi | `lolly.ing` |
| Trình phát trong hộp web của Design | Một yêu cầu lấy trang, kèm địa chỉ IP của bạn | `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com`, `www.figma.com` |
| Trang tham khảo trong hộp web của Design | Một yêu cầu lấy trang, kèm địa chỉ IP của bạn | `wikipedia.org`, `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org`, `www.openstreetmap.org` |
| Send to LinkedIn, chỉ trong các ứng dụng máy tính | Tệp, cùng tên của nó làm bài đăng công khai | `www.linkedin.com`, `api.linkedin.com` |

Danh sách riêng của ứng dụng máy tính còn bao gồm điểm cuối token của Google cho việc đăng nhập Drive. Mọi máy chủ khác, như máy chủ Mastodon hay Nextcloud bạn chỉ định, cần sự phê duyệt của đơn vị vận hành, như mô tả trong mục Các tệp bạn gửi đi. Những máy chủ bạn chọn vào lúc sử dụng, như URL bạn chụp hoặc phiên bản từ xa bạn chỉ định, không xuất hiện trong danh sách nào.


**Chữ ký SEAL không gửi yêu cầu nào.** Verify có thể kiểm tra chữ ký SEAL, một cơ chế mà khóa ký có thể được công bố trong DNS. Trình duyệt không thể thực hiện truy vấn DNS, nên một lần tra cứu trên web sẽ phải đi qua trình phân giải DNS-over-HTTPS của bên thứ ba, bên đó sẽ thấy tên miền đang được kiểm tra và địa chỉ IP của bạn. Trước đây Lolly dùng trình phân giải của Cloudflare; nay không còn, và chưa có gì thay thế Cloudflare. Hiện không ứng dụng Lolly nào tra cứu khóa SEAL: các ứng dụng máy tính và di động chạy cùng màn hình Verify, và lệnh `lolly validate` trên dòng lệnh không kiểm tra SEAL. Tệp có bản ghi SEAL mang khóa nội tuyến được kiểm tra ngoại tuyến, và Verify gọi chữ ký là nhất quán nội bộ mà không xác nhận tên miền. Tệp có khóa chỉ nằm trong DNS hiện **SEAL signature did not verify**, kèm lý do "no key resolver and no inline key".

![Màn hình Verify: chỉ có một vùng thả và không gì khác - tệp được kiểm tra ngay tại nơi nó đang có, không tải lên và không cần tài khoản](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop)

Bạn có thể tự kiểm tra điều này và mọi khẳng định khác trên trang: [Verify It Yourself](/info/verify-yourself.html) đưa ra các lệnh và kết quả cần mong đợi.

## Các dịch vụ lolly.tools vận hành

Các dịch vụ này chạy trên lolly.tools cho mọi người. Mỗi dịch vụ chỉ nhận những gì bạn gửi. [Server Surface](/info/server-surface.html) mô tả cùng các thành phần đó khi chúng hoạt động trên bất kỳ bản triển khai nào.

### Liên kết kết xuất

Mọi URL `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>` đều kết xuất thật, và đầu vào của nó đi cùng trong URL, nên một liên kết Lolly được chia sẻ có thể hiện thành hình ảnh trực tiếp trong README, wiki hoặc bảng điều khiển. Việc tải một liên kết yêu cầu máy chủ kết xuất **dữ liệu công khai của công cụ và danh mục** với các đầu vào được ghi trong địa chỉ.

- <!--i:usercheck--> **Không tài khoản, không cookie, không trạng thái.** Tuyến này không yêu cầu đăng nhập, và không có gì trên thiết bị của bạn bị đọc. Tài liệu, phiên và tệp tải lên của bạn không bao giờ rời trình duyệt và không thể xuất hiện trong các liên kết này.
- <!--i:document--> **Chính URL được ghi lại.** Chuỗi truy vấn của URL là một phần của yêu cầu, nên nó xuất hiện trong nhật ký truy cập thông thường của nền tảng lưu trữ như mọi đường dẫn được yêu cầu. Nếu đầu vào của một liên kết chứa tên hay địa chỉ email của ai đó, như trên một thẻ tên hay chữ ký email, **văn bản đó nằm trong các nhật ký ấy**. Chỉ đưa vào liên kết kết xuất những gì bạn sẽ đặt trên một trang công khai.
- <!--i:globe--> **Dù sao đầu vào cũng công khai.** Chúng là bất cứ gì tác giả liên kết đã gõ vào URL, ai nhận được liên kết đều đọc được. Đừng đặt bí mật trong liên kết được chia sẻ; Lolly cung cấp mã hóa liên kết cho nội dung nhạy cảm.
- <!--i:eyeoff--> **Có bộ nhớ đệm, giới hạn và không được lập chỉ mục.** Phản hồi được lưu đệm và giới hạn tốc độ như mọi hình ảnh công khai, và được đánh dấu `noindex` để công cụ tìm kiếm bỏ qua các bản kết xuất của bạn.

Một bản triển khai tự lưu trữ không muốn tuyến kết xuất công khai thì đặt `LOLLY_DISABLE_RENDER_GET=1`, và mọi URL này trả về 404.

### Trình tải ảnh và lớp chuyển tiếp Penpot

**Add from URL** trong ứng dụng web và **Send to Penpot** dùng hai lớp chuyển tiếp nhỏ trên lolly.tools, được mô tả trong [Mọi yêu cầu mạng mà ứng dụng có thể gửi](#every-network-request-the-app-can-make). Trình tải ảnh không giữ gì và quên địa chỉ. Lớp chuyển tiếp Penpot chuyển token và kho lưu trữ của bạn tới Penpot và không giữ cái nào; nó ghi lại tên lệnh và trạng thái phản hồi của Penpot.

### Máy chủ MCP, dành cho tác tử AI

Một tác tử AI có thể truy cập Lolly qua Model Context Protocol, thông qua một điểm cuối do đơn vị vận hành chạy. lolly.tools chạy một điểm cuối như vậy, và ai cũng có thể chạy điểm cuối riêng, kể cả hoàn toàn ngoại tuyến.

- <!--i:cpu--> **Tệp mà tác tử gửi.** Các công cụ nhận tệp (`lolly_transform`, `lolly_verify`, `lolly_redact`, `lolly_read`, `lolly_check`, `lolly_package`, `lolly_compose`, `lolly_rebrand` và các công cụ ảnh `lolly_look`, `lolly_sample_color` và `lolly_trace_edges`) xử lý nó trong bộ nhớ và trả kết quả trong cùng lệnh gọi. Tệp không bao giờ được ghi xuống đĩa và không được giữ sau khi yêu cầu hoàn tất. `lolly_inspect` cũng nhận tệp, và các bước kiểm tra video và sản xuất in của nó ghi một bản làm việc tạm, được xóa khi lệnh gọi trả về. Mọi công cụ khác làm việc từ các tham số trong lệnh gọi: văn bản, số, màu, URL, id tài nguyên danh mục hoặc một tài liệu do bên gọi cung cấp.
- <!--i:cpu--> **Rebrand nói rõ bộ trình chiếu đi đâu.** Giai đoạn đầu của `lolly_rebrand`, `capabilities`, nói bằng lời xem các byte của bạn sẽ đi đâu trước khi bạn gửi gì: trên máy chủ cục bộ tự lưu trữ, bộ trình chiếu không bao giờ rời máy đó, còn trên máy chủ được lưu trữ, gọi `lolly_rebrand` sẽ gửi bộ trình chiếu tới đó, trong giới hạn kích thước và số trang chiếu mà giai đoạn đó nêu.
- <!--i:lock--> **Điểm cuối mở.** Trên lolly.tools, `lolly.tools/api/mcp` mở cho mọi người, không cần token. Các lệnh gọi bị giới hạn theo địa chỉ và theo ngân sách hằng ngày. Địa chỉ trở thành một giá trị băm giả danh trong kho kiểm soát lạm dụng, như ở các điểm cuối đăng nhập bên dưới, và ngân sách chỉ đếm thời gian CPU và số byte gửi đi, không có địa chỉ. Bearer token của một điểm cuối hạn chế không bao giờ được ghi vào nhật ký hay URL kết xuất.
- <!--i:link--> **Liên kết tải xuống cho kết quả lớn.** lolly.tools trả kết quả trực tiếp và không bao giờ cấp các liên kết này. Đơn vị vận hành có thể bật chúng cho cổng có xác thực của riêng họ, nơi một kết quả được giữ tối đa năm phút và chỉ bearer token của chính bên gọi mới tải được; xem [MCP Server](/info/mcp.html#private-download-links-for-large-results). Một điểm cuối hạn chế dự kiến tại `mcp.lolly.tools` sẽ nhận bearer token mà đơn vị vận hành cấp cho các máy khách tin cậy, hoặc OAuth 2.1 với token ký ngắn hạn được kiểm tra bằng một bí mật chung; việc kích hoạt đang chờ, và nó được liệt kê trong [Máy chủ phân phối và bên xử lý](#delivery-hosts-and-processors).

### Danh tính đã xác minh: một lần đăng nhập do chính bạn khởi động

Lolly có thể niêm phong một **Content Credential** vào các bản xuất của bạn, để bất kỳ ai cũng kiểm tra ngoại tuyến được rằng tệp không thay đổi kể từ khi rời Lolly. Phần đó **bật sẵn theo mặc định và hoàn toàn cục bộ**: khóa ký được tạo trên thiết bị của bạn và việc ký diễn ra ngoại tuyến. Khi chưa đăng ký, khóa đó chỉ dùng một lần, một cặp khóa mới được tạo cho mỗi lần xuất rồi bỏ đi. Khi bạn đăng ký, khóa tồn tại lâu và được tạo ở dạng **không thể trích xuất**, nên ngay cả mã của chính Lolly cũng không đọc được, chỉ yêu cầu nó ký. Dù theo cách nào, nó cũng không bao giờ rời thiết bị của bạn.

[Exporting](/info/exporting.html#content-credentials-c2pa) liệt kê những gì một credential ghi lại: công cụ, thời gian, bề mặt xuất ở mức thô, tên của bạn chỉ khi bạn bật *Use my details*, các tác phẩm được ghi công mà bản xuất đặt vào, và từng bài hát Rondocode mà bản xuất video hoặc âm thanh phát (tên, giá trị băm của nguồn và cách sandbox của Lolly kết xuất bài hát). Bảng xuất liệt kê các bài hát đó trước khi bạn xuất.

Credential và siêu dữ liệu của tệp cũng ghi lại [hệ thống thiết kế và colourway](/info/exporting.html#the-design-system-record) đã tạo nên bản xuất: id và tên của hệ thống thiết kế, phiên bản đã phát hành và colourway. Tên của một hệ thống thiết kế là văn bản do chủ sở hữu của nó gõ và có thể là tên khách hàng, nên thẻ **Design system** của bảng xuất hiện đúng từ ngữ đó trước khi bạn xuất. Bỏ chọn thẻ, hoặc truyền `_madewith=0` hay `--no-madewith`, để loại chúng ra.

Bước *tùy chọn* duy nhất thêm vào đó là đăng ký một danh tính đã xác minh, để bản xuất của bạn ghi "Verified - signed by \<your email\>" thay vì chỉ một khóa ẩn danh. **Nếu bạn bỏ qua việc đăng ký, dịch vụ chứng chỉ không nhận dữ liệu đăng ký nào từ bạn.**

![Thẻ Verified identity trong Settings, cỡ điện thoại: bộ chọn thời hạn chứng chỉ và bước đăng ký bên dưới, ở trạng thái nghỉ cho đến khi chính bạn khởi động](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Nếu bạn đăng ký, đây chính xác là những gì xảy ra:

::: timeline
- <!--i:usercheck--> **Bạn chọn phương thức đăng nhập**: GitHub, Google, SUSE (id.suse.com) hoặc một liên kết gửi qua email. Với ba nhà cung cấp OIDC, bạn đến trang đăng nhập riêng của nhà cung cấp đó, theo chính sách quyền riêng tư của họ chứ không phải của chúng tôi, và dịch vụ chứng chỉ chỉ nhận lại một địa chỉ email đã xác minh cùng tên nhà cung cấp. Với liên kết email, địa chỉ bạn gõ được gửi tới **Resend**, một dịch vụ email giao dịch, chỉ để chuyển đúng liên kết đó.
- <!--i:lock--> **Một cookie ngắn hạn bảo vệ việc chuyển hướng.** Dịch vụ chứng chỉ đặt `lolly_ca_state`, `HttpOnly`, trong phạm vi `/api/ca` và hết hạn trong vòng mười phút. Nó mang một giá trị ngẫu nhiên chứ không phải định danh theo dõi, chỉ tồn tại để ngăn việc giả mạo chuyển hướng đăng nhập và bị xóa ngay khi đăng nhập hoàn tất.
- <!--i:eyeoff--> **Địa chỉ IP của bạn được dùng thoáng qua để ngăn lạm dụng** các điểm cuối đăng nhập, để một tập lệnh không thể làm ngập hộp thư hay dùng hết hạn ngạch email. Lolly biến nó thành giá trị băm SHA-256 trước khi nó tới kho kiểm soát lạm dụng ngắn hạn, nên địa chỉ gốc không được gửi tới đó. Giá trị băm là giả danh chứ không ẩn danh: ai nắm kho đó có thể khôi phục địa chỉ IPv4 bằng cách thử mọi địa chỉ có thể. Nhóm này hết hạn sau khoảng một phút và không dùng cho việc gì khác. Nhật ký truy cập lưu trữ thông thường là riêng và được mô tả bên dưới.
- <!--i:seal--> **Dịch vụ cấp một chứng chỉ** gắn địa chỉ email đã xác minh của bạn với khóa công khai của thiết bị. Khóa riêng ở lại trên thiết bị: máy khách gửi yêu cầu chứng chỉ kèm bằng chứng sở hữu được ràng buộc, và không khóa riêng thiết bị nào được gửi tới chế độ nhà cấp phát nào.
- <!--i:check--> **Việc ký vẫn cục bộ.** Với nhà cấp phát kế thừa, một bản xuất không cần yêu cầu nào tới dịch vụ chứng chỉ. Một danh tính được quản lý còn cần danh sách thu hồi mới, được ký từ nhà cấp phát của nó; máy khách có thể dùng danh sách đã lưu đệm trong thời hạn còn mới đã cấu hình, và việc làm mới có thể liên hệ dịch vụ chứng chỉ trong lúc xuất. Trạng thái thiếu, hết hạn hoặc không hợp lệ sẽ ngăn danh tính được quản lý bị dùng.
:::

::: details Lưu giữ và thu hồi trong từng chế độ nhà cấp phát
**Cấp phát lưu trữ kế thừa** cung cấp 7, 30, 90 hoặc 365 ngày, bị giới hạn trần bởi đơn vị vận hành. Nó không giữ kho danh tính và không có nhật ký cấp phát, nên không thể tra ai đã nhận chứng chỉ hay thu hồi chứng chỉ của người đó; thời hạn chính là việc thu hồi.

**Cấp phát cho tổ chức được quản lý** dùng thời hạn mặc định tối đa 24 giờ và tối đa bảy ngày, với gốc tin cậy và chính sách tin cậy nhà cấp phát riêng, và việc ký đi tới nhà cấp phát Vault mà đơn vị vận hành của nó đã cấu hình. Ứng dụng đăng ký của nó dùng một kho nhận vào dùng một lần chung, chỉ chứa một định danh xác thực có khóa và một giá trị băm yêu cầu, tối đa mười phút, và không lưu kho danh tính hay bộ đệm phản hồi chứng chỉ. Nhà cung cấp PKI, thiết bị kiểm toán, cổng và bản sao lưu của nó có luồng dữ liệu riêng. Ngay cả khi tắt lưu trữ cấp phát thông thường, việc thu hồi dựa trên chứng chỉ vẫn có thể giữ chứng chỉ, kể cả danh tính email của nó, và các số sê-ri thu hồi cùng định danh kiểm toán có thể vẫn liên kết được; chính sách của đơn vị vận hành quyết định kho đó, ai được truy cập và giữ bao lâu.

Một thiết bị được quản lý có thể yêu cầu thu hồi chứng chỉ của chính nó, bằng một bằng chứng đã xác thực của thiết bị, và không API nào yêu cầu khóa riêng của thiết bị. Đơn vị vận hành có thể rút một nhà cấp phát qua chính sách tin cậy của nó. Lolly không giữ ánh xạ nào từ con người tới chứng chỉ, nên việc thu hồi chứng chỉ của một người khi họ rời đi phụ thuộc vào các bản ghi mà đơn vị vận hành giữ, và bản ghi PKI, bản ghi kiểm toán, người nhận và bản sao lưu theo chính sách của đơn vị vận hành. [Thiết kế dịch vụ chứng chỉ](https://github.com/lolly-tools/lolly/blob/main/services/ca/README.md) đề cập quyền lưu giữ khóa của nhà cấp phát, thời hạn lưu giữ của nhà cung cấp và việc đánh giá đạt chuẩn.
:::

## Dịch vụ tổ chức với Lolly Work

**Lolly Work** là dịch vụ tổ chức tùy chọn của dự án Lolly, do từng tổ chức vận hành một phiên bản triển khai riêng. Việc kết nối tới một phiên bản bổ sung dữ liệu lưu trên máy chủ đó bên cạnh việc chỉnh sửa cục bộ của bạn. Đơn vị vận hành của nó chịu trách nhiệm về chính sách quyền riêng tư, kiểm soát truy cập, người nhận, thời hạn lưu giữ và bản sao lưu của bản triển khai đó.

| Quy trình | Dữ liệu do dịch vụ của tổ chức xử lý |
|---|---|
| Đăng nhập và cấp tài khoản | Các claim của nhà cung cấp danh tính, tài khoản và tư cách thành viên nhóm, phiên đăng nhập và thông tin thiết bị. OIDC xử lý đăng nhập; quản trị viên có thể cấp và vô hiệu hóa tài khoản qua SCIM |
| Danh mục chung và dự án | Tài nguyên đã tải lên, siêu dữ liệu và phiên bản; dự án và phiên chung; nội dung lấy từ các nhà cung cấp thư viện đã cấu hình |
| Collab công việc | Trạng thái phiên chung, chỉnh sửa trực tiếp và sự hiện diện của người tham gia được gửi qua phiên bản; trạng thái đã lưu được giữ theo chính sách lưu trữ của nó |
| Liên kết chia sẻ được quản lý | Đích liên kết và cài đặt truy cập, như thời hạn và bảo vệ mật khẩu tùy chọn; yêu cầu được phân giải qua phiên bản và có thể bị thu hồi |
| Xem xét và bàn giao | Nội dung đã gửi, quyết định phê duyệt, đích đã chọn, tệp trung chuyển và biên nhận bàn giao |
| Kết xuất và xử lý hàng loạt trên máy chủ | Đầu vào công cụ đã gửi, yêu cầu kết xuất, trạng thái và tệp đầu ra được giữ lại. Các tác vụ này chạy trên máy chủ chứ không phải trên thiết bị của bạn |
| Báo cáo sử dụng | Nhãn sự kiện trong danh sách cho phép như id công cụ, định dạng và id tài nguyên, theo chính sách telemetry bên dưới |
| Kiểm toán | Bản ghi người thực hiện và hành động cho các thao tác được quản trị, giữ riêng khỏi telemetry sử dụng |

Dịch vụ dùng cookie xác thực, gồm `lw_session` cho thành viên đã đăng nhập và `lw_guest` cho truy cập khách khi được bật, tách biệt với cookie của dịch vụ chứng chỉ. Việc làm mới chính sách và báo cáo sử dụng đã bật có thể gửi yêu cầu trong khi ứng dụng đang dùng, mà không cần một lần nhấp riêng cho mỗi lần. Đây là lưu lượng tới phiên bản đã cấu hình, không phải báo cáo gửi dự án Lolly về những bản triển khai mà nó không vận hành.

**Telemetry sử dụng có ba mức.** `off` không lưu sự kiện sử dụng nào, `aggregate` loại bỏ id người dùng và `standard` có thể gán sự kiện cho người dùng. Mức mặc định là `standard`, nên một phiên bản lưu các sự kiện sử dụng mà nó nhận được trừ khi đơn vị vận hành chọn `off`. Chính sách gán mặc định là `opt-in`, cần sự đồng ý của bạn trước khi một id người dùng được lưu; đơn vị vận hành thay vào đó có thể cấu hình báo cáo có gán bằng `telemetryAttribution: default`. Các thuộc tính được phép là nhãn, không bao giờ là giá trị đầu vào của công cụ. Xem [Work telemetry](/info/work-telemetry.html).

**Kiểm toán là riêng.** Các hành động được quản trị có thể giữ bản ghi kiểm toán có danh tính bất kể sự đồng ý telemetry của bạn. Tắt telemetry không tắt việc lưu phiên chung, bản ghi phê duyệt, lưu tác vụ kết xuất hay kiểm toán. Đơn vị vận hành kiểm soát thời hạn lưu giữ và xóa, kể cả việc giả danh hóa nhật ký kiểm toán; xem [Work storage and data lifecycle](/info/work-data-lifecycle.html).

| | Thiết bị của bạn | Phiên bản của tổ chức bạn |
|---|---|---|
| Nó giữ gì | Công việc cá nhân, tùy chọn và bộ nhớ đệm của bạn | Công việc chung, tài khoản, tệp tải lên, phê duyệt, bản kết xuất, kiểm toán và telemetry đã cấu hình |
| Ai xóa | Bạn, bằng **Clear all my data** hoặc dữ liệu trang của trình duyệt | Đơn vị vận hành, qua các điều khiển riêng của phiên bản |
| Hỏi ai | Không ai: các bản ghi nằm trên thiết bị của bạn | Đơn vị vận hành phiên bản, về truy cập, xuất hoặc xóa |

**Xóa cục bộ không phải xóa trên máy chủ.** Rời một phiên bản hay xóa trình duyệt chỉ gỡ trạng thái cục bộ, không gỡ các bản ghi hay bản sao lưu mà tổ chức đã lưu. [Sync](/info/sync.html) cá nhân và **Export my data** sao lưu thiết bị của bạn, không phải dịch vụ của tổ chức. Bản demo công khai [lolly.work](https://lolly.work) chỉ giữ trạng thái trong bộ nhớ và không phải nơi lưu trữ bền vững cho công việc của bạn.

## Tiện ích mở rộng trình duyệt

Tiện ích mở rộng trình duyệt **Lolly URL Screenshot** không thu thập dữ liệu cá nhân nào cho chúng tôi. Nó không có phân tích, không theo dõi và không có máy chủ riêng. Trang [Browser extension](/info/extension.html) mô tả cách nó hoạt động.

**Nó làm gì.** Ứng dụng web Lolly có thể yêu cầu nó chụp ảnh một trang web, hoặc lấy nội dung của một trang để bắt đầu một hệ thống thiết kế từ một trang web. Mỗi yêu cầu mở một cửa sổ phê duyệt trong tiện ích, hiển thị trang yêu cầu, việc nó muốn ảnh chụp hay nội dung trang, và địa chỉ trang. Chỉ sau khi bạn nhấn **Approve once**, tiện ích mới mở trang đó trong một thẻ nền tạm thời, chụp ảnh hoặc đọc trang, đưa kết quả cho thẻ Lolly đã yêu cầu và đóng thẻ. Mỗi yêu cầu cần sự phê duyệt riêng.

**Dữ liệu.**

- <!--i:shieldcheck--> **Chúng tôi không thu thập gì.** Kết quả chỉ đi tới trang Lolly đã yêu cầu, trong cùng trình duyệt. Tiện ích không lưu nội dung trang và không thêm người nhận nào khác.
- <!--i:globe--> **Yêu cầu mạng.** Trang bạn phê duyệt tải như trong bất kỳ thẻ nào, cùng mọi thứ mà chính trang đó yêu cầu. Việc đọc nội dung một trang cũng tải các bảng định kiểu của trang và vài ảnh biểu tượng và logo của nó, từ bên trong trang, và các lần tải đó không gửi cookie tới các trang khác. Tiện ích không gửi yêu cầu nào khác, và không yêu cầu nào đi tới máy chủ Lolly.
- <!--i:lock--> **Phiên trình duyệt của bạn.** Trang tải bằng phiên trình duyệt của bạn, như khi bạn tự mở, nên một trang bạn đã đăng nhập có thể đưa thông tin riêng tư vào kết quả.
- <!--i:link--> **Các địa chỉ bạn phê duyệt** chỉ được dùng để tải đúng trang đó cho đúng yêu cầu đó. Chúng không được ghi nhật ký hay chia sẻ.

**Quyền.**

- <!--i:wrench--> **`debugger`**: để chụp ảnh qua DevTools Protocol, cùng cơ chế mà ứng dụng máy tính Lolly dùng.
- <!--i:monitor--> **`tabs`**: để mở và đóng thẻ tạm thời, và kiểm tra rằng cả trang Lolly lẫn trang đích đều chưa di chuyển kể từ khi bạn phê duyệt.
- <!--i:code--> **`scripting`**: để đọc nội dung một trang trong thẻ tạm thời, sau khi bạn phê duyệt yêu cầu đó.
- <!--i:database--> **`storage`**: để ghi các id của thẻ tạm thời vào bộ nhớ phiên, để chúng vẫn được đóng nếu trình duyệt dừng tiện ích giữa chừng một yêu cầu. Không có nội dung trang nào được lưu.
- <!--i:check--> **Quyền truy cập trang tùy chọn (`http://*/*`, `https://*/*`)**: không được cấp khi cài đặt. Khi bạn nhấn **Approve once**, tiện ích xin Chrome quyền truy cập đúng một trang trong yêu cầu đó, và Chrome hỏi bạn lần đầu cho mỗi trang. Một trang bạn đã cho phép trước đây vẫn cần phê duyệt mới cho mỗi yêu cầu.

Không quyền nào trong số này được dùng để đọc, theo dõi hay truyền việc duyệt web của bạn ngoài đúng một yêu cầu bạn đã phê duyệt.

## Máy chủ phân phối và bên xử lý

Theo mặc định, tệp danh mục công khai, công cụ và các bản hiển thị đến từ địa chỉ riêng của ứng dụng. Tên theo nội dung thay đổi nơi tệp được tải, không phải ai nhận yêu cầu. Tính năng phân phối này không kích hoạt CDN bên thứ ba nào. Một CDN kết thúc TLS sẽ nhận chi tiết yêu cầu, gồm địa chỉ IP và mọi cookie hay thông tin xác thực bearer được chuyển tới, kể cả dưới cùng tên máy chủ của trình duyệt, nên đơn vị vận hành nào thêm một CDN là thêm một bên xử lý mới.

**Trước khi thêm bất kỳ CDN hay máy chủ mô hình bên ngoài nào**, quản trị viên phải công bố tên bên xử lý, tên máy chủ, các khu vực pháp lý, siêu dữ liệu nhận được, thời hạn lưu giữ và thỏa thuận chuyển giao. [Delivery deployment](/info/deploy-delivery.html) liệt kê những gì cần công bố. Phản hồi không gian làm việc riêng tư bỏ qua bộ nhớ đệm dùng chung: kết quả cá nhân, từ chối truy cập và lỗi dùng `private, no-store`, và một phản hồi riêng tư được phép có thể xác nhận lại trong trình duyệt của bạn mà không trở thành công khai.

Các dịch vụ tham chiếu dùng hạ tầng lưu trữ bên dưới. Đây là danh sách tên máy chủ, không phải khẳng định rằng phiên bản của tổ chức khác dùng cùng khu vực.

| Tên máy chủ hoặc dịch vụ | Chức năng và người nhận | Khu vực và cách xử lý dữ liệu |
|---|---|---|
| lolly.tools | Ứng dụng công khai, danh mục, kết xuất và dịch vụ chứng chỉ; lưu trữ UpCloud | Frankfurt, Đức. Chi tiết yêu cầu có thể xuất hiện trong nhật ký hạ tầng; việc chỉnh sửa cục bộ thông thường ở lại trên thiết bị |
| lolly.ing | Không gian làm việc được quản lý và dịch vụ tác tử tài liệu; lưu trữ UpCloud | Frankfurt, Đức. Cơ sở dữ liệu riêng tư và kho tệp nằm trên cùng máy chủ. Tài khoản, nội dung chung và bản ghi dịch vụ theo chính sách của quản trị viên phiên bản |
| mcp.lolly.tools | Cổng MCP có xác thực tùy chọn dự kiến và tải xuống kết quả riêng tư; lưu trữ UpCloud | Frankfurt, Đức, với cùng bên xử lý lưu trữ. Việc kích hoạt đang chờ. Cổng sẽ nhận chi tiết yêu cầu và các tham số hoặc tệp mà bên gọi gửi |
| lolli.li | Tệp phát hành và mô hình công khai; UpCloud Managed Object Storage, tách khỏi cụm ứng dụng | Frankfurt, Đức, trong vùng lưu trữ đối tượng europe-2 của UpCloud. Một lượt tải xuống gửi chi tiết yêu cầu, không phải đầu vào mà mô hình xử lý sau đó |
| Nhà cung cấp danh tính đã cấu hình | Google, GitHub hoặc nhà cung cấp OIDC của đơn vị vận hành | Đăng nhập theo chính sách của nhà cung cấp đó. Hãy hỏi đơn vị vận hành phiên bản về tên máy chủ, khu vực và thỏa thuận chuyển giao |
| Nhà cung cấp tài nguyên đã cấu hình | Brandfolder hoặc thư viện khác do đơn vị vận hành chọn | Nhà cung cấp nhận các yêu cầu thư viện được phép. Quyền nguồn của nó và chính sách của phiên bản quyết định truy cập; hãy hỏi đơn vị vận hành về tên máy chủ và khu vực |
| Đăng ký qua email, khi được cấu hình | Resend gửi liên kết đăng nhập được yêu cầu | Nhận địa chỉ email đích của thư đó; điều khoản xử lý riêng của họ áp dụng |

Ứng dụng tham chiếu không dùng nhà cung cấp lưu trữ, cơ sở dữ liệu hay kiểm soát lạm dụng nào khác. Đơn vị vận hành có thể chọn nhà cung cấp khác cho một phiên bản khác, và nhà cung cấp lưu trữ, danh tính, tài nguyên và email đều cần công bố riêng. [Vùng lưu trữ đối tượng](https://upcloud.com/docs/products/managed-object-storage/availability/) của máy chủ mô hình được xác minh riêng với vùng của ứng dụng.

**Liên kết tải xuống MCP tùy chọn gắn với chủ thể.** Đơn vị vận hành có thể bật liên kết tải xuống cho kết quả lớn trên một cổng có xác thực, một bản sao duy nhất. Chúng tắt theo mặc định. Cổng ẩn danh tại `lolly.tools/api/mcp` trả kết quả trực tiếp và không bao giờ cấp các liên kết này. Tên máy chủ hạn chế dự kiến là `mcp.lolly.tools`, trên cùng bên xử lý UpCloud ở Frankfurt; việc kích hoạt đang chờ, và trang này không khẳng định có dịch vụ liên kết tải xuống đang hoạt động. Các liên kết không thêm CDN bên thứ ba nào.

Chỉ bên gọi có xác thực và có phạm vi tệp mới nhận được liên kết, và cần đúng bearer của chính bên gọi đó để tải về: hãy dùng bearer đã được xác thực từ lệnh gọi kết xuất, không phải token khác của cùng tài khoản. Quyền được cấp hết hạn trong vòng 300 giây. Quyền sở hữu và việc tra cứu kết quả ở trong bộ nhớ của cổng, còn các byte đầu ra đi vào tệp tạm riêng tư, được dọn sau khi hết hạn hoặc xóa khi tắt máy sạch sẽ. Khởi động lại cổng làm vô hiệu các liên kết hiện có. Kết quả đang giữ bị giới hạn 64 MiB cho mỗi bearer, 256 MiB trên toàn cổng và 200 tệp đang chờ hoặc đang giữ. Ngân sách CPU và byte đã giải mã hằng ngày tính kết quả khi chúng được giữ và khi được tải xuống. Phản hồi dùng `private, no-store` và `Referrer-Policy: no-referrer`. Riêng token của liên kết không cho phép người hay tác tử khác đọc kết quả.

## Nhật ký hạ tầng

Phần này mô tả bản triển khai công khai lolly.tools. Nền tảng lưu trữ của nó ghi lại chi tiết yêu cầu thông thường: địa chỉ IP, đường dẫn được yêu cầu, dấu thời gian và user agent. Các chỉnh sửa cục bộ không tới máy chủ đó. Chuỗi truy vấn của một liên kết kết xuất có thể chứa văn bản mà bên gọi cung cấp, như đã giải thích ở trên. Các công cụ tệp MCP xử lý các byte được đưa vào trong bộ nhớ. Một phiên bản Lolly Work cũng giữ các bản ghi mô tả ở trên, theo chính sách ghi nhật ký của đơn vị vận hành.

**Các dịch vụ công khai giữ việc ghi nhật ký ứng dụng ở mức tối thiểu.** Máy chủ MCP ghi nhật ký khởi động, cấu hình và cảnh báo kết xuất; nó không giữ nhật ký yêu cầu riêng và không ghi token hay địa chỉ bên gọi. Lớp chuyển tiếp Penpot ghi tên từng lệnh và trạng thái phản hồi của Penpot, không bao giờ ghi tiêu đề, token hay tệp. Dịch vụ chứng chỉ ghi các cài đặt khởi động và cảnh báo cấu hình, cộng hai dòng đã lược bỏ khi thất bại: mã trạng thái gửi thất bại không kèm địa chỉ người nhận, và một dòng thất bại cố định không có văn bản lỗi, stack trace hay URL, vì lỗi của nhà cung cấp có thể mang giá trị danh tính hoặc thông tin xác thực. Mọi thứ khác trong nhật ký đến từ nền tảng lưu trữ.

Với lolly.tools, quản trị viên phiên bản kiểm soát việc ghi nhật ký yêu cầu, xoay vòng và thời hạn lưu giữ trên UpCloud. Trang này không nêu thời hạn lưu giữ nhật ký tối đa nào chưa được xác minh. Hãy liên hệ bên kiểm soát dưới đây để biết lịch hiện hành và cho mọi yêu cầu về nhật ký lưu trên máy chủ. Với phiên bản khác, cài đặt của đơn vị vận hành của nó áp dụng, kể cả mọi việc xuất nhật ký hay bên xử lý khác.

## Căn cứ pháp lý, thời gian lưu trữ và bên nhận dữ liệu

Bảng này đề cập bản triển khai tham chiếu **lolly.tools**. Nó không nêu cơ sở pháp lý hay thời hạn lưu giữ của phiên bản Lolly Work thuộc tổ chức bạn; đơn vị vận hành của nó cung cấp những điều đó trong chính sách riêng.

| Xử lý | Cơ sở pháp lý (GDPR Art. 6) | Thời hạn lưu giữ |
|---|---|---|
| Mọi thứ trên thiết bị của bạn (tài liệu, tùy chọn, bộ nhớ đệm, bộ đếm) | **Hoàn toàn không phải xử lý của chúng tôi**: nó không bao giờ tới chúng tôi. Lưu trữ trên thiết bị của bạn thật sự cần thiết cho dịch vụ bạn yêu cầu (ePrivacy Art. 5(3)), nên không cần sự đồng ý | Cho đến khi bạn xóa |
| Địa chỉ email của bạn khi đăng ký Content Credentials lưu trữ kế thừa | **Art. 6(1)(b)**, thực hiện một dịch vụ bạn đã yêu cầu rõ ràng | Không có kho danh tính hay nhật ký cấp phát trong dịch vụ kế thừa; email được dùng trong lúc xử lý yêu cầu và đưa vào chứng chỉ của bạn. Thời hạn lưu giữ PKI, kiểm toán và thu hồi của tổ chức được quản lý theo chính sách của đơn vị vận hành |
| Giá trị băm SHA-256 giả danh tạo từ địa chỉ IP của bạn, để giới hạn tốc độ các điểm cuối đăng nhập và các điểm cuối kết xuất, ảnh và MCP công khai | **Art. 6(1)(f)**, lợi ích hợp pháp của chúng tôi trong việc ngăn lạm dụng một dịch vụ miễn phí và hạn ngạch email của bên thứ ba. Chúng tôi cho rằng điều này vượt qua phép cân bằng lợi ích vì địa chỉ gốc không được gửi cho bộ giới hạn, giá trị băm chỉ dùng để kiểm soát lạm dụng và tự hết hạn | Khoảng một phút trong kho kiểm soát lạm dụng; không giữ sau đó |
| Nhật ký truy cập lưu trữ (IP, đường dẫn, dấu thời gian, user agent) | **Art. 6(1)(f)**, lợi ích hợp pháp của chúng tôi trong bảo mật dịch vụ, ngăn lạm dụng và chẩn đoán lỗi | Xoay vòng và lưu giữ do quản trị viên cấu hình; hãy liên hệ bên kiểm soát để biết lịch hiện hành |

**Người nhận.** Các loại người nhận là nhà cung cấp lưu trữ của chúng tôi (UpCloud), nơi chứa cơ sở dữ liệu và kho kiểm soát lạm dụng của ứng dụng, và, chỉ khi bạn dùng tùy chọn đăng nhập bằng email, một nhà cung cấp email giao dịch (Resend). Kho kiểm soát lạm dụng chỉ nhận các giá trị băm ngắn hạn, không bao giờ nhận địa chỉ IP gốc. Nếu bạn đăng nhập bằng GitHub, Google hoặc SUSE (id.suse.com), bạn làm việc trực tiếp với nhà cung cấp đó theo chính sách quyền riêng tư của họ, và họ chỉ báo cho chúng tôi một địa chỉ email đã xác minh, không gì khác. Chúng tôi không chia sẻ dữ liệu cá nhân với ai khác, không bán dữ liệu, không chạy quảng cáo và không lập hồ sơ người dùng.

**Chuyển giao ra ngoài EEA.** Việc lưu trữ, cơ sở dữ liệu và kho tệp của ứng dụng tham chiếu đặt ở Frankfurt. Các nhà cung cấp danh tính, email và tài nguyên tùy chọn có nơi xử lý và điều khoản riêng, có thể bao gồm truy cập từ ngoài EEA, và riêng vùng của máy chủ không xác lập được khu vực pháp lý của mọi người nhận. Hãy liên hệ bên kiểm soát để biết các thỏa thuận nhà cung cấp và biện pháp chuyển giao áp dụng; với phiên bản khác, hãy hỏi đơn vị vận hành của nó. [Standard Contractual Clauses](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en) của Ủy ban châu Âu là một biện pháp bảo vệ có thể dùng cho các lần chuyển giao như vậy; trang này không khẳng định rằng một thỏa thuận nhà cung cấp chưa được xác minh có dùng chúng.

**Ra quyết định tự động.** Không có. Không có việc lập hồ sơ và không có quyết định tự động nào gây hệ quả pháp lý hoặc tác động đáng kể tương tự (Art. 22).

## Quyền riêng tư của trẻ em

Việc dùng ứng dụng cục bộ thông thường không gửi nội dung cá nhân nào tới lolly.tools. Việc đăng ký Content Credentials tùy chọn của nó nhận một địa chỉ email và không hướng tới hay dành cho trẻ em. Các dịch vụ tổ chức có tài khoản và cách xử lý dữ liệu riêng, theo chính sách của đơn vị vận hành.

## Quyền của bạn

Với các bản ghi chỉ lưu trên thiết bị của bạn, bạn có thể tự truy cập, chỉnh sửa, xóa và di chuyển dữ liệu. Nó nằm trong bộ nhớ của trình duyệt hoặc ứng dụng, ở dạng bạn có thể kiểm tra, xuất (**Export my data**, ở trên) hoặc xóa (**Clear all my data**, hoặc dữ liệu trang của trình duyệt).

Về mặt chính thức, theo các Điều 15-22 của GDPR, bạn có quyền **truy cập** dữ liệu cá nhân của mình, **chỉnh sửa** nó, **xóa** nó, **hạn chế** hoặc **phản đối** việc xử lý nó (kể cả bất cứ gì chúng tôi dựa trên lợi ích hợp pháp), quyền **di chuyển dữ liệu** và, khi việc xử lý dựa trên sự đồng ý, quyền **rút lại sự đồng ý đó bất cứ lúc nào**, mà không ảnh hưởng đến tính hợp pháp của những gì đã xảy ra trước khi bạn rút lại.

Dịch vụ chứng chỉ công khai không giữ nhật ký cấp phát. Nhật ký hạ tầng có thể chứa chi tiết yêu cầu, nên chính sách này không hứa rằng môi trường lưu trữ không giữ dữ liệu cá nhân nào. Hãy liên hệ bên kiểm soát để truy cập, xóa hoặc đưa ra yêu cầu khác về các bản ghi đó; chúng tôi sẽ giải thích có những bản ghi nào và có thể làm gì. Với công việc, danh tính, telemetry và bản ghi kiểm toán do một tổ chức giữ, hãy liên hệ đơn vị vận hành Lolly Work của bạn, vì các điều khiển xuất và xóa cục bộ không với tới các bản sao đó.

**Bạn có quyền khiếu nại.** Nếu bạn cho rằng chúng tôi xử lý dữ liệu của bạn không đúng, bạn có thể nộp đơn khiếu nại tới cơ quan giám sát bảo vệ dữ liệu: tại EU, là cơ quan ở quốc gia bạn cư trú, nơi làm việc hoặc nơi bạn cho là xảy ra vi phạm (Art. 77). Cơ quan giám sát chính của chúng tôi là *Bayerisches Landesamt für Datenschutzaufsicht* (BayLDA) tại Ansbach, Đức. Bạn không cần liên hệ chúng tôi trước, dù chúng tôi muốn có cơ hội khắc phục vấn đề.

## Thay đổi đối với chính sách này

Ngày ở đầu trang thay đổi mỗi khi tài liệu này thay đổi. Một thay đổi làm thay đổi những gì rời khỏi thiết bị của bạn hoặc những gì được giữ sẽ có dòng riêng tại đây thay vì sửa âm thầm. Để xem điều gì đã thay đổi, hãy hỏi (bên dưới) hoặc so sánh với [mã nguồn công khai](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

**29 tháng 9 năm 2026:** làm rõ dịch vụ lolly.work tùy chọn, nội dung do tổ chức giữ, cookie xác thực, telemetry sử dụng và bản ghi kiểm toán, cùng sự tách biệt giữa xóa cục bộ và lưu giữ trên máy chủ. Đây là các quy trình tùy chọn đã có, không phải yêu cầu tải lên mới đối với việc chỉnh sửa cục bộ.

**11 tháng 10 năm 2026:** thay mô tả lưu trữ Vercel đã ngừng bằng danh sách tên máy chủ ứng dụng UpCloud, phân biệt các nhà cung cấp danh tính và tài nguyên tùy chọn, và mô tả cách phân phối theo nội dung cùng chế độ tải xuống MCP có giữ kết quả. Thay đổi này không bật CDN bên thứ ba nào. Thời hạn lưu giữ nhật ký do quản trị viên kiểm soát thay vì một mặc định của gói Vercel được nêu.

**22 tháng 10 năm 2026:** sửa mô tả về hành vi đã có. Phần tiện ích mở rộng trình duyệt nay đề cập cửa sổ phê duyệt cho mọi yêu cầu, quyền truy cập trang được xin từng trang một và việc tải bảng định kiểu cùng biểu tượng khi đọc một trang web. Cũng đã sửa: các hàng Send to Google Drive và Meeting Planner, ghi chú SEAL (không ứng dụng Lolly nào tra cứu khóa SEAL trong DNS), mức telemetry sử dụng mặc định của dịch vụ tổ chức, các công cụ ảnh MCP và việc ghi nhật ký ứng dụng của các dịch vụ công khai. Bản thân phần mềm không thay đổi.

**23 tháng 10 năm 2026:** sắp xếp lại chính sách theo điều gì khởi động mỗi yêu cầu, và mô tả hành vi đã có mà trước đây chưa đề cập: lời mời collab riêng tư mang địa chỉ mạng cục bộ, Nearby trong ứng dụng máy tính, Allow AI control, đọc hệ thống thiết kế từ một trang web, bộ emoji, bộ nhớ đệm trên thiết bị của Meeting Planner cho việc tra cứu thành phố, Thùng rác và các bản ghi khác mà Settings → Storage liệt kê. Sửa hai khẳng định: Bluesky và Discord không chỉ dành cho máy tính, và mọi máy chủ mà một người chọn để gửi đều cần sự phê duyệt của đơn vị vận hành trong cả ứng dụng web lẫn máy tính; giá trị băm giới hạn tốc độ của địa chỉ IP là giả danh chứ không ẩn danh. Bản thân phần mềm không thay đổi.

## Ai chịu trách nhiệm, và cách liên hệ với chúng tôi

**Bên kiểm soát dữ liệu** cho lolly.tools là:

> SUSE Software Solutions Germany GmbH
> Frankenstraße 146
> 90461 Nürnberg
> Germany

SUSE đã chỉ định một **Cán bộ Bảo vệ Dữ liệu**, liên hệ qua [privacy@suse.com](mailto:privacy@suse.com). Hãy dùng địa chỉ đó cho mọi yêu cầu chính thức theo "Quyền của bạn" ở trên.

Với bất cứ điều gì về chính Lolly, như cách nó hoạt động, vì sao một điều là như vậy hoặc để sửa tài liệu này, hãy liên hệ **Andy Fitzsimon**, [fitzy@suse.com](mailto:fitzy@suse.com).

Với một phiên bản Lolly tự lưu trữ hoặc doanh nghiệp, hãy liên hệ người vận hành nó: đơn vị vận hành là bên kiểm soát cho bản triển khai của chính họ. SUSE và dự án mã nguồn mở Lolly không giữ dữ liệu nào của các bản triển khai mà họ không vận hành.
