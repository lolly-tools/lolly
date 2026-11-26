# Chính sách quyền riêng tư

*Cập nhật lần cuối: 10 tháng 11 năm 2026*

- <!--i:eti-home--> **Việc tạo nội dung trong Lolly diễn ra trên thiết bị của bạn.** Mở công cụ, gõ, xem trước, xuất và kiểm tra tệp đều chạy trong ứng dụng trên điện thoại, máy tính hoặc trình duyệt của bạn. Bạn không cần tài khoản và ứng dụng không đặt cookie cho bất kỳ việc nào trong số đó.
- <!--i:eti-globe--> **Nội dung bạn tạo chỉ rời thiết bị khi bạn yêu cầu.** Thêm Google Font, gửi tệp tới Drive hoặc Dropbox, bật Sync, nghe radio hay tải mô hình AI chạy trên thiết bị đều tạo một yêu cầu do bạn khởi động. Ứng dụng cũng lấy các công cụ và bản cập nhật từ địa chỉ của chính nó, và các yêu cầu đó không mang theo nội dung nào bạn đã tạo. [Mọi yêu cầu mạng mà ứng dụng có thể gửi](#every-network-request-the-app-can-make) liệt kê chúng theo từng máy chủ.
- <!--i:eti-cpu--> **Một số dịch vụ Lolly chạy trên máy chủ.** Liên kết kết xuất, trình lấy ảnh, điểm cuối dành cho tác tử AI và dịch vụ danh tính đã xác minh chỉ nhận những gì bạn gửi cho chúng, và không giữ lâu hơn thời hạn nêu trên trang này.
- <!--i:eti-building--> **Phiên bản Lolly Work của tổ chức bạn thì khác.** Nó lưu công việc dùng chung mà bạn đưa vào đó cùng nhật ký những lần bạn đăng nhập và việc bạn làm ở đó, và chính sách của đơn vị vận hành áp dụng cho dữ liệu đó, không phải chính sách này.

Để hỏi về dữ liệu của bạn hoặc thực hiện quyền của mình, xem [Quyền của bạn](#your-rights) và [Ai chịu trách nhiệm](#who-is-responsible-and-how-to-reach-us).

::: figure privacy-where-data-goes
Dữ liệu của bạn đi đâu: dữ liệu ở lại trên thiết bị trừ khi bạn khởi động một yêu cầu, và mỗi loại yêu cầu có đích đến riêng.
:::

<!--i:eti-clipboard-->
## Phạm vi của chính sách này

Lolly là phần mềm nguồn mở mà ai cũng có thể chạy: một bộ máy, các lớp vỏ ứng dụng cho web, máy tính, thiết bị di động và terminal, cùng một tiện ích mở rộng trình duyệt. Chính sách này có hai phần:

- <!--i:code--> **Bản thân phần mềm**: những gì nó làm và không làm với dữ liệu của bạn, dù chạy ở đâu. Đây là đặc tính của mã nguồn, nên đúng với mọi bản triển khai Lolly, của chúng tôi hay của bất kỳ ai khác.
- <!--i:server--> **lolly.tools**, bản triển khai tham chiếu do SUSE vận hành: các lựa chọn khi vận hành những thành phần máy chủ tùy chọn của nó, như ghi nhật ký những gì, trong bao lâu và do ai thực hiện.

Trên một phiên bản Lolly tự lưu trữ hoặc dành cho doanh nghiệp, hành vi của phần mềm dưới đây vẫn áp dụng, nhưng *đơn vị vận hành* phiên bản đó, chứ không phải SUSE, chịu trách nhiệm cho mọi thứ trên máy chủ của họ: điểm cuối kết xuất, máy chủ MCP, dịch vụ chứng chỉ và phiên bản Lolly Work. Hãy yêu cầu họ cung cấp chính sách riêng. [Áp dụng & Quản trị](/info/adoption-governance.html) mô tả những gì liên quan đến việc vận hành Lolly.

<!--i:eti-home-->
## Những gì ở lại trên thiết bị của bạn

Các ứng dụng web, máy tính và di động của Lolly chạy toàn bộ bộ máy kết xuất trên thiết bị. Khi các công cụ, tài nguyên và bộ mã hóa bạn dùng đã có trên thiết bị, việc kết xuất và tải xuống không cần máy chủ.

**Việc dùng ứng dụng độc lập không đặt cookie.** Đăng nhập tổ chức và việc đăng ký danh tính đã xác minh tùy chọn có cookie riêng, được mô tả trong các phần tương ứng. Ứng dụng giữ các bản ghi sau trên thiết bị:

- <!--i:sliders--> **Tùy chọn giao diện**: chủ đề, ngôn ngữ, cài đặt âm thanh, cài đặt hỗ trợ tiếp cận, kích thước thanh bên và mức thu phóng, lựa chọn sắp xếp và chế độ xem cùng những mẹo bạn đã xem, trong bản ghi hồ sơ và trong `localStorage`, để chúng sẵn sàng trước khi ứng dụng khởi động xong.
- <!--i:usercheck--> **Thông tin hồ sơ của bạn**: tên, địa chỉ email, số điện thoại, chức danh, tổ chức, thành phố, quốc gia và ảnh chân dung bạn nhập trong **Settings**, ở IndexedDB. Chúng điền vào các công cụ cần dùng đến và chỉ được ghi vào bản ghi nguồn gốc của bản xuất hoặc tệp `.lolly` được chia sẻ khi bạn bật *Use my details*.
- <!--i:download--> **Bộ nhớ đệm ngoại tuyến của danh mục công cụ và bản xem trước tài nguyên**, để gallery hoạt động khi không có kết nối.
- <!--i:hash--> **Bộ đếm sử dụng cục bộ** cho số liệu trên thẻ hồ sơ, như số lần xuất và những công cụ đã dùng: một bản ghi nhỏ có giới hạn trong `localStorage`, chúng tôi không bao giờ đọc. Chúng chỉ rời thiết bị trong tệp sao lưu hoặc bản sao Sync của chính bạn.
- <!--i:folder--> **Công việc của chính bạn**: tài liệu, phiên đã lưu và lịch sử của chúng, ảnh và phông chữ đã tải lên, kết quả tệp và các phiên bản trước, cùng Thùng rác, nơi giữ các mục đã xóa trong 30 ngày trừ khi bạn dọn sớm hơn. Sau 30 ngày, một mục được xóa vào lần tiếp theo bạn mở Projects, trừ khi công việc đã lưu vẫn dùng mục đó, như với ảnh hoặc phông chữ. Chúng nằm trong IndexedDB và trong vùng lưu trữ tệp riêng của trình duyệt (OPFS) trên thiết bị, và ở đó trừ khi bạn chọn Sync hoặc chia sẻ.
- <!--i:globe--> **Kết quả tra cứu thành phố của Meeting Planner**, trong `localStorage`, để mỗi thành phố chỉ được tra cứu một lần.
- <!--i:cpu--> **Mô hình đã tải xuống và công cụ đã ghim**: các mô hình AI chạy trên thiết bị mà bạn đồng ý tải xuống và các công cụ bạn ghim để dùng ngoại tuyến.
- <!--i:seal--> **Danh tính ký của bạn**, sau khi đăng ký: cặp khóa lâu dài dùng để ký Content Credentials và chứng chỉ của cặp khóa đó có địa chỉ email đã xác minh của bạn, trong IndexedDB. Khóa riêng không bao giờ rời thiết bị. Khi chưa đăng ký, khóa cho mỗi bản xuất được tạo riêng cho bản xuất đó rồi bỏ đi; [Danh tính đã xác minh](#verified-identity-a-sign-in-you-start-yourself) giải thích cả hai trường hợp.
- <!--i:link--> **Dịch vụ đã kết nối**: thông tin đăng nhập, mật khẩu ứng dụng, khóa và cụm mật khẩu Sync mà bạn chọn giữ lại, các nhãn tài khoản hiển thị bên cạnh chúng và danh sách **Links you've shared**, với tên và liên kết của từng tệp. Chúng không bao giờ có trong bản sao lưu hoặc bản sao Sync; [Tệp bạn gửi](#files-you-send) mô tả từng dịch vụ.

::: details Các bản ghi khác mà ứng dụng giữ trên thiết bị
- **Câu trả lời của bạn.** Những câu hỏi một lần nào bạn đã trả lời và trả lời ra sao: thêm Google Font, yêu cầu đầu tiên tới từng tác tử trong **Ask an agent**, **Allow pages from any site** và **Allow AI control**. Cả những thông báo và lời chào bạn đã đóng.
- **Hoạt động gần đây.** Một danh sách ngắn các lần tải xuống mới nhất của bạn, với tên tệp, công cụ, cài đặt và ảnh thu nhỏ của từng tệp, dành cho Dashboard, cùng những tài nguyên và công cụ bạn dùng gần đây nhất.
- **Một phiên bản đã kết nối.** Địa chỉ của nó, mã cài đặt cho thiết bị này, ghi chú cho biết bản sao cục bộ nào đến từ không gian làm việc nào và bản sao đệm của những gì phiên bản đó gửi cho ứng dụng: cài đặt của nó cùng tên, địa chỉ email, nhóm và vai trò của tài khoản bạn.
- **Tệp đang làm việc.** Bản ghi màn hình đang thực hiện, bản xem trước âm thanh và bản mã hóa video, trong OPFS, cùng tệp mà ứng dụng khác chia sẻ tới Lolly, được giữ đến lần khởi động ứng dụng tiếp theo.
- **Các trang tài liệu.** lolly.tools/info không đặt cookie. Nó giữ chủ đề, ngôn ngữ và thứ tự ngôn ngữ của bạn trong `localStorage`, đọc cài đặt Reduce motion và Large text của ứng dụng và, để quay lại ứng dụng, địa chỉ chế độ xem ứng dụng mà thẻ trình duyệt này đến từ đó. Nó chỉ giữ bản sao tài liệu nếu bạn tải xuống để dùng ngoại tuyến.
:::

**Settings → Storage** cho biết Lolly dùng bao nhiêu dung lượng trên thiết bị, với công việc của bạn, Thùng rác, mô hình đã tải xuống, bản sao ngoại tuyến và bộ nhớ đệm được liệt kê riêng. **Clear all my data** ở đó xóa bản sao cục bộ, bao gồm service worker và bộ nhớ đệm ngoại tuyến của Lolly, và tắt Sync trước. Nó chỉ giữ một dấu hiệu để báo cho các thẻ Lolly khác đang mở rằng việc xóa đã diễn ra. Nó không kết thúc phiên đăng nhập tổ chức: cookie đó mất đi khi bạn đăng xuất hoặc khi bạn xóa dữ liệu trang web trong trình duyệt, thao tác cũng xóa mọi thứ mà nút này xóa. Việc lưu trữ thực sự cần thiết cho dịch vụ bạn yêu cầu không cần sự đồng ý theo ePrivacy Directive (Art. 5(3)), chỉ cần minh bạch, điều mà tài liệu này và thông báo trong ứng dụng cung cấp.

![Phần lưu trữ của Settings trên màn hình rộng bằng điện thoại: từng loại dữ liệu trên thiết bị được nêu tên, với nút Clear all my data bên cạnh danh sách](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

**Export my data** tạo một tệp `lolly-backup` mà bạn giữ và kiểm soát. Nó không bao giờ tới máy chủ của chúng tôi trừ khi bạn tự gửi nó đi đâu đó. Xem [Chuyển dữ liệu](/info/data-transfer.html).

### Các tiện ích chạy trên thiết bị của bạn

Một số công cụ, như **Lolly Strip Hidden Data**, **Compress** và các công cụ khác có nhãn **Runs on your device**, làm việc trên tệp bạn cung cấp. Tệp được đọc vào bộ nhớ, biến đổi trên thiết bị và trả lại dưới dạng tải xuống. Tệp không bao giờ được tải lên, vì không có máy chủ trong quy trình. Các tiện ích này hoạt động ngoại tuyến và đầu ra không mang hình mờ hay siêu dữ liệu của chúng tôi.

**Lolly Rondocode** là ngoại lệ duy nhất, vì nó tạo âm thanh mới từ bài hát của bạn thay vì biến đổi tệp của bạn. Mọi tệp âm thanh nó ghi đều mang Content Credentials ghi lại bài hát và khai báo mọi giọng hát do AI tạo. Bảng Export nêu điều này trước khi bạn xuất, và [Bài hát Lolly Rondocode](/info/rondocode.html#files-from-the-rondocode-utility) liệt kê chính xác những gì được ghi lại.

Công cụ **Music generator** cũng tạo âm thanh mới. Tệp WAV hoặc M4A bạn tải xuống từ công cụ này luôn mang Content Credentials cho biết trình tạo nhạc của Lolly đã tạo bản nhạc và nêu giấy phép áp dụng cho nhạc, CC BY 4.0, với dòng ghi công *Nhạc được tạo bằng Lolly (https://lolly.tools), CC BY 4.0*. Giai điệu bạn lưu từ công cụ này ghi tên hồ sơ của bạn là người tạo, khi hồ sơ có tên, cùng phiên bản Lolly, phiên bản bộ máy và giấy phép đó, tất cả hiển thị trong thông tin chi tiết của giai điệu ở Assets. Tên đó ở lại trong thư viện của bạn: bản xuất phát giai điệu chỉ thêm tên khi *Use my details* bật, và bản tải xuống từ trình tạo nhạc không mang tên. [Những gì một bản nhạc ghi lại](/info/generated-music.html#what-a-track-records) liệt kê từng bản ghi.

![Nhãn của các công cụ này: Runs on your device - không có gì được tải lên](/t/url-shot?url=%2F%23%2Ftool%2Ftext-helper&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%5Bdata-privacy%5D&dark=1&filename=pv-ondevice-badge)

**Prepare for sharing** và **Lolly Compare** làm việc trong bộ nhớ trên thiết bị và không gửi gì tới máy chủ, và Prepare không thêm gì vào lịch sử, liên kết, bản sao lưu hoặc Sync cho đến khi bạn lưu kết quả.

<a id="how-prepare-for-sharing-and-compare-handle-your-files"></a>
::: details Cách Prepare for sharing và Lolly Compare xử lý tệp của bạn
**Prepare for sharing** giữ các đầu vào đang xử lý, phát hiện riêng tư và bảng ánh xạ thay thế trong bộ nhớ, và không kiểm tra thông tin xác thực trực tuyến. Bạn chọn sao chép, tải xuống, gửi hay lưu kết quả vào thư viện; kết quả đã lưu sau đó tuân theo cài đặt sao lưu và Sync của thư viện. Tệp công thức bỏ qua nội dung trước đó và ánh xạ các giá trị nguyên văn, còn báo cáo tóm tắt chứa số lượng, ID phạm vi và mã băm tệp. CLI chỉ lưu tệp rà soát riêng chứa các giá trị gốc khi được yêu cầu bằng `--review-file`. Rời chế độ xem chuẩn bị sẽ giải phóng trạng thái đang xử lý, nhưng không có nghĩa là đảm bảo xóa khỏi bộ nhớ trình duyệt hoặc hệ điều hành đến mức không thể khôi phục bằng phân tích pháp chứng.

Các bản sao đã chuẩn bị và thao tác tệp đã hoàn tất dùng chung các điều khiển Lolly Compare. Các giá trị đã loại bỏ ban đầu được thu gọn, và báo cáo so sánh bỏ qua tên nguồn, đường dẫn và giá trị trừ khi bạn chọn đưa chúng vào. Lịch sử tệp lưu bản sao, nên so sánh sau khi tải lại có nghĩa là chọn lại bản gốc, được đối chiếu bằng SHA-256 đã ghi. Chọn tệp không lưu hay tải tệp lên.
:::

Lolly Strip Hidden Data và Prepare for sharing cũng kiểm tra tệp DOCX, PPTX và XLSX trên thiết bị. Với tệp DOCX được hỗ trợ, có thể xóa các thuộc tính đã chọn trong một bản sao mới; nội dung Office khác chỉ được kiểm tra, và các bản xem trước riêng tư vẫn ẩn sau điều khiển hiển thị.

::: details Những gì việc kiểm tra Office đọc và xóa
| Định dạng Office | Nội dung gói được kiểm tra | Hỗ trợ xóa |
|---|---|---|
| DOCX | Thuộc tính cốt lõi, ứng dụng và tùy chỉnh; bình luận và tác giả; dấu theo dõi thay đổi và bản xem trước; các đoạn văn bản ẩn; quan hệ bên ngoài; đối tượng nhúng | Các thuộc tính được chọn về tác giả, người lưu cuối cùng, ngày tạo/sửa/in lần cuối, tiêu đề, chủ đề, mô tả, từ khóa, thuộc tính tùy chỉnh, Company, Manager, Template, địa chỉ gốc siêu liên kết, tên và phiên bản ứng dụng cùng số liệu thống kê (tổng thời gian chỉnh sửa và số trang, từ, ký tự, dòng và đoạn văn) |
| PPTX | Thuộc tính; bình luận và bản ghi tác giả; ghi chú diễn giả; dấu trang chiếu ẩn; quan hệ bên ngoài; đối tượng nhúng và sổ làm việc lồng nhau được hỗ trợ | Không có |
| XLSX | Thuộc tính; bình luận và ghi chú; dấu trang tính, hàng và cột ẩn; tên đã xác định; quan hệ và kết nối bên ngoài; các phần liên kết ngoài và bộ nhớ đệm pivot; đối tượng nhúng | Không có |

**Giới hạn.** Việc thống kê không kiểm tra đầy đủ văn bản hiển thị, công thức, phần phụ thuộc, hình thức kết xuất hoặc các phần nhị phân tùy ý. Nó hỗ trợ tối đa 300 phần trong gói, tổng dung lượng giải nén khai báo 64 MiB, 2 MiB cho mỗi phần XML và hai cấp gói nhúng lồng nhau; Prepare dùng chung giới hạn số phần và dung lượng giải nén cho toàn bộ công việc. Nội dung bị cắt cụt, sai định dạng, mã hóa và không được hỗ trợ được báo cáo và giữ lại. Nội dung macro được nhận diện và không bao giờ chạy, các định dạng Office nhị phân cũ và XLSB không được kiểm tra, và các tham chiếu bên ngoài không bao giờ được tải về.

**Những gì việc dọn dẹp DOCX giữ lại.** Việc dọn dẹp hỗ trợ định dạng gói DOCX transitional với các phần thuộc tính cốt lõi, tùy chỉnh và mở rộng chuẩn. Trong thuộc tính mở rộng, có thể xóa Company, Manager, Template, HyperlinkBase, Application, AppVersion cùng các số liệu TotalTime, Pages, Words, Characters, CharactersWithSpaces, Lines và Paragraphs. DocSecurity, tiêu đề đề mục và phần, cờ liên kết và các thuộc tính ứng dụng khác được giữ lại. Xóa Template vẫn để lại mọi liên kết mẫu đính kèm trong cài đặt tài liệu, nơi việc thống kê báo cáo nó là quan hệ bên ngoài.

Một số trình đọc chọn cách vẽ biểu đồ và hình vẽ dựa vào tên và phiên bản ứng dụng; chẳng hạn, LibreOffice hiển thị biểu đồ từ tệp Word 2007 khác đi khi thiếu chúng. Cả hai được giữ lại khi tệp chứa biểu đồ, ảnh, hình khối hoặc đối tượng nhúng, và việc kiểm tra liệt kê chúng là được giữ lại. Thuộc tính mà một trường Word hiển thị (TEMPLATE, EDITTIME, NUMPAGES, NUMWORDS hoặc NUMCHARS) được giữ lại, và các trường liên kết cùng liên kết ngoài tương đối giữ HyperlinkBase, vì đích của chúng được xác định dựa trên địa chỉ gốc đó.

**Những gì vẫn chỉ được kiểm tra.** Dữ liệu chữ ký số mở rộng ngăn việc dọn dẹp. Gói Office đã ký, bật macro, mã hóa, sai định dạng, đổi tên hoặc lồng nhau vẫn chỉ được kiểm tra. Tệp có các trường Word khác phụ thuộc vào thuộc tính, như DOCPROPERTY hoặc AUTHOR, hoặc có điều khiển nội dung liên kết với XML cũng vậy, vì xóa thuộc tính có thể làm thay đổi tài liệu khi Word cập nhật các liên kết đó, và văn bản trường được lưu đệm không thể cho biết lần kết xuất tiếp theo có giữ nguyên hình thức hay không. Các phần XML có phần mở rộng tên tệp bất thường, đích quan hệ Word XML không thể kiểm tra an toàn, phần đầu trang hoặc chân trang khai báo sai và phần SVG khai báo là XML với phần mở rộng `.svg` cũng vẫn chỉ được kiểm tra trong bản phát hành dọn dẹp đầu tiên này.

**Cách việc dọn dẹp kiểm tra kết quả.** Các phần thuộc tính, khai báo của chúng, thành phần gói không liên quan, chú thích XML và chú thích ZIP được giữ lại. Việc dọn dẹp áp dụng giới hạn thống kê và kiểm tra tính toàn vẹn của từng thành phần trước khi ghi, rồi kiểm tra lại các thuộc tính sau khi xử lý. Lolly Compare hiển thị khác biệt của các thuộc tính được hỗ trợ với giá trị thu gọn; nó không so sánh văn bản hiển thị hay hình thức kết xuất. Giá trị dùng bản xem trước dài tối đa 2048 ký tự, nên khác biệt ngoài bản xem trước có thể không hiển thị, và việc rà soát một phần không thể xác lập rằng hai tệp giống nhau. Lệnh `prepare --strip-hidden-data` của CLI xóa các thuộc tính DOCX được hỗ trợ, và một gói rà soát riêng có thể chọn từng thuộc tính. Khi một điều kiện bảo vệ dọn dẹp không đạt, tệp được giữ lại và thao tác được báo cáo là thất bại.
:::

<!--i:eti-globe-->
## Mọi yêu cầu mạng mà ứng dụng có thể gửi

Hầu hết yêu cầu đưa công cụ, phông chữ hoặc mô hình về thiết bị của bạn. Hành động Send truyền tệp bạn chọn, Sync truyền bản sao lưu tới nơi lưu trữ bạn chọn và các dịch vụ tổ chức truyền nội dung hoặc thông tin cần cho công việc dùng chung. Mỗi nhóm dưới đây liệt kê những gì rời thiết bị của bạn, khi nào và điều gì xảy ra nếu đơn vị vận hành chặn yêu cầu. Các nhà cung cấp danh tính và tài nguyên do đơn vị vận hành cấu hình có thể thêm đích đến cho bản triển khai đó. [Mọi máy chủ cố định trong một bảng](#every-fixed-host-in-one-table) liệt kê các máy chủ mà ứng dụng web có thể liên hệ.

::: details Những thứ được tải về thiết bị của bạn
- <!--i:download--> **Danh mục công cụ.** Không có gì mang tính cá nhân: một yêu cầu lấy chỉ mục công cụ và tài nguyên công khai của Lolly, tới địa chỉ của chính ứng dụng, khi khởi động rồi được lưu đệm ngoại tuyến. Nếu bị chặn, ứng dụng chạy với các công cụ đã lưu đệm và ngừng tìm công cụ mới.
- <!--i:sparkle--> **Bộ emoji.** Bộ bạn chọn được tải xuống từ địa chỉ của chính ứng dụng vào lần đầu bạn dùng bộ đó. Không gửi gì mang tính cá nhân. Hoạt ảnh Lottie được đọc trên thiết bị và không liên hệ với ai.
- <!--i:document--> **Google Fonts.** Tên họ phông chữ đã chọn và địa chỉ IP của bạn được gửi tới máy chủ phông chữ của Google (`fonts.googleapis.com` cho biểu định kiểu, `fonts.gstatic.com` cho tệp phông chữ). Việc này chỉ xảy ra khi bạn thêm Google Font trong Lolly Design System Setup và chỉ sau khi bạn đồng ý trong hộp thoại nêu chính xác điều này. Mỗi họ phông chữ được lấy một lần, rồi giữ trên thiết bị và dùng ngoại tuyến. Nếu bị chặn, bộ chọn dừng an toàn; hãy tải lên tệp phông chữ thay thế.
- <!--i:cpu--> **Mô hình AI chạy trên thiết bị.** Không có gì mang tính cá nhân: một lần tải tệp mô hình, rồi giữ trên thiết bị. Các bản dựng web mặc định dùng địa chỉ của chính ứng dụng; bản dựng có thể chỉ định máy chủ mô hình khác, như máy chủ phát hành `lolli.li` của Lolly cho các ứng dụng đóng gói. Máy chủ nhận yêu cầu và địa chỉ IP của bạn, không có tài khoản và đầu vào mô hình. Việc này chỉ xảy ra khi bạn dùng tính năng cần mô hình (quét sâu của Lolly Verify, tăng độ phân giải ảnh, giọng nói và tương tự) hoặc chọn tải mô hình để dùng ngoại tuyến. Nếu bị chặn, tính năng đó chờ và mọi thứ khác vẫn hoạt động.
- <!--i:sliders--> **Hồ sơ in ICC.** Không có gì mang tính cá nhân: một yêu cầu lấy hồ sơ điều kiện in tiêu chuẩn tới sổ đăng ký công khai của ICC (`registry.color.org`, `www.color.org`), chỉ khi bạn nhấp một thiết lập sẵn ICC trong trình quản lý hồ sơ in, một lần cho mỗi hồ sơ. Nếu bị chặn, các thiết lập sẵn không hoạt động; hãy cung cấp hồ sơ `.icc` của riêng bạn.
- <!--i:globe--> **Radio Internet.** Không có gì mang tính cá nhân: yêu cầu danh sách phát và luồng âm thanh từ đài (`api.somafm.com` và máy chủ luồng mà nó trỏ tới, `*.somafm.com`), chỉ khi bạn bật radio tùy chọn trong trình phát âm thanh. Nếu bị chặn, radio không hoạt động và mọi tính năng âm thanh khác vẫn hoạt động.
:::

::: details Công cụ cần dữ liệu trực tiếp
- <!--i:globe--> **Tra cứu thành phố của Meeting Planner.** Hiện đây là công cụ duy nhất lấy dữ liệu trực tiếp. Nó yêu cầu `geocoding-api.open-meteo.com` chuyển từng tên thành phố (thành phố chủ trì và thành phố của mỗi thành viên nhóm) thành tọa độ và múi giờ, không có tài khoản, khóa hay mã định danh ngoài bản thân yêu cầu. Ô nhập Host city giải thích điều này, và mỗi kết quả được lưu trên thiết bị để mỗi thành phố chỉ được tra cứu một lần. Nó chỉ chạy khi công cụ đang mở. Nếu bị chặn, việc tra cứu thất bại và không ảnh hưởng gì khác.
:::

::: details Tệp bạn gửi
Mỗi mục sau chỉ gửi một tệp bạn chọn khi bạn nhấn nút Send tương ứng, sau khi bạn hoàn tất đăng nhập trong cửa sổ riêng của dịch vụ. Mật khẩu ứng dụng Bluesky, địa chỉ webhook Discord, mật khẩu ứng dụng Nextcloud và khóa S3 chỉ được lưu trên thiết bị này, không bao giờ nằm trong bản sao lưu, và **Disconnect** xóa chúng.

- <!--i:upload--> **Google Drive.** Tệp, ở bất kỳ định dạng nào, được gửi tới Drive API của Google (`www.googleapis.com`). Quyền truy cập của Lolly giới hạn ở các tệp nó tạo (phạm vi `drive.file`), nên nó không bao giờ đọc được phần còn lại của Drive của bạn. Trong ứng dụng web, token đăng nhập được giữ trong bộ nhớ cho phiên đó và không bao giờ được lưu; trong các ứng dụng khác, token làm mới chỉ được lưu trên thiết bị này nếu bạn đánh dấu **Stay connected**. Nút chỉ có trên bản dựng mà đơn vị vận hành đã cấu hình mã ứng dụng khách Google. Nếu bị chặn, nút không bao giờ xuất hiện; hãy tải tệp xuống và tự tải lên. **Liên kết chia sẻ.** Nếu bạn nhấn **Create a share link**, lệnh gọi thứ hai tới `www.googleapis.com` thêm quyền cho tệp đó (bất kỳ ai có liên kết, miền Workspace của bạn hoặc các địa chỉ bạn nhập, trong trường hợp đó Google gửi email cho họ) và đọc liên kết của tệp. **Stop sharing** xóa quyền đó. Không cần gì thêm: phạm vi `drive.file` đã bao gồm các tệp Lolly tạo.
- <!--i:upload--> **Dropbox.** Tệp được gửi tới API của Dropbox (`api.dropboxapi.com` cho đăng nhập và siêu dữ liệu, `content.dropboxapi.com` cho tệp). Quyền truy cập chỉ giới hạn trong thư mục ứng dụng, nên Lolly chỉ thấy `Apps/` và thư mục riêng của nó ở đó. Liên kết **Open** mà nó hiển thị là liên kết riêng tồn tại ngắn hạn, và không tạo chia sẻ công khai nào. Token làm mới chỉ được lưu nếu bạn đánh dấu **Stay connected**. Nút chỉ có khi đơn vị vận hành đã cấu hình mã ứng dụng khách Dropbox. **Liên kết chia sẻ.** Chỉ khi bạn nhấn **Create a share link** lần đầu, Dropbox mới yêu cầu bạn phê duyệt thêm một quyền, `sharing.write`. Sau đó Lolly gọi `api.dropboxapi.com` để tạo liên kết (`sharing/create_shared_link_with_settings`) và, với **Stop sharing**, để thu hồi liên kết đó. Việc gửi tệp không bao giờ yêu cầu quyền này.
- <!--i:upload--> **OneDrive.** Tệp được gửi tới các dịch vụ danh tính và Graph của Microsoft (`login.microsoftonline.com` cho đăng nhập, `graph.microsoft.com` cho tải lên); tệp lớn được tải lên theo từng khối tới `api.onedrive.com` hoặc các origin lưu trữ do đơn vị vận hành cấu hình. Quyền truy cập giới hạn trong thư mục riêng của Lolly ở `Apps/`, cộng với tên hiển thị của bạn cho nhãn tài khoản. Token làm mới chỉ được lưu nếu bạn đánh dấu **Stay connected**. Nút chỉ có khi đơn vị vận hành đã cấu hình mã ứng dụng khách Microsoft. **Liên kết chia sẻ.** **Create a share link** gọi `graph.microsoft.com` (`createLink` trên tệp) với quyền truy cập bạn đã cấp. Nếu Microsoft từ chối, Lolly không yêu cầu quyền rộng hơn: nó đưa bạn tới trang riêng của tệp trong OneDrive để dùng nút Share ở đó. **Stop sharing** xóa quyền của liên kết.
- <!--i:upload--> **LinkedIn**, **chỉ trong ứng dụng máy tính**. Tệp, với tên tệp làm nội dung bài đăng, được gửi tới LinkedIn (`www.linkedin.com` để đăng nhập trong trình duyệt của bạn, `api.linkedin.com` để tải lên và đăng bài) dưới dạng bài đăng công khai trên bảng tin của bạn. Lolly có thể đăng thay bạn và đọc tên bạn cho nhãn tài khoản, ngoài ra không làm gì khác. Thông tin đăng nhập chỉ được giữ nếu bạn đánh dấu **Stay connected**, và token của LinkedIn có hiệu lực 60 ngày, không thể được gia hạn ngầm nên tự hết hạn. Các máy chủ đó không nằm trong chính sách kết nối của ứng dụng web. Nút chỉ có trên bản dựng đã cấu hình ứng dụng LinkedIn.
- <!--i:upload--> **Penpot.** Token truy cập cá nhân Penpot mà bạn dán vào ứng dụng cùng tệp lưu trữ `.penpot` của thiết kế được gửi tới API của Penpot (`design.penpot.app`) qua một thành phần chuyển tiếp nhỏ ở địa chỉ của chính ứng dụng (`/api/penpot`), vì API của Penpot không trả lời trực tiếp cho trình duyệt. Thành phần chuyển tiếp chuyển tiếp rồi bỏ dữ liệu; ứng dụng máy tính trao đổi trực tiếp với Penpot. Việc này chỉ xảy ra khi bạn nhấn **Send to Penpot** trong công cụ Design và xác nhận một dự án. Nếu bị chặn, việc gửi dừng an toàn; hãy xuất tệp `.penpot` và tự nhập.
- <!--i:upload--> **Bluesky.** Ảnh, tên ảnh làm nội dung bài đăng và văn bản thay thế, cùng tên tài khoản và mật khẩu ứng dụng của bạn (tạo trong Bluesky → Settings → App passwords, không bao giờ là mật khẩu tài khoản) được gửi tới máy chủ Bluesky bạn chỉ định, là `bsky.social` trừ khi bạn chọn máy chủ khác. Bạn kết nối tài khoản trước trong **Settings → Connected services**.
- <!--i:upload--> **Discord.** Tệp được gửi dưới dạng tệp đính kèm tới địa chỉ webhook của kênh mà bạn đã dán, trên discord.com. Bất kỳ ai có địa chỉ webhook đều có thể đăng vào kênh đó, vì vậy nó ở lại trên thiết bị.
- <!--i:upload--> **Mastodon.** Tệp, với tên tệp làm nội dung bài đăng, được gửi tới máy chủ Mastodon hoặc máy chủ tương thích mà bạn chỉ định, sau khi đăng nhập trong cửa sổ riêng của máy chủ đó. Việc kết nối đăng ký một ứng dụng nhỏ cho thiết bị này trên máy chủ đó, và thông tin đăng nhập chỉ được giữ nếu bạn đánh dấu **Stay connected**.
- <!--i:upload--> **Nextcloud hoặc WebDAV.** Tệp được gửi tới máy chủ của bạn trong một lần tải lên có xác thực, với địa chỉ máy chủ, tên người dùng và mật khẩu ứng dụng bạn đã nhập (Nextcloud → Settings → Security → Devices & sessions; không bao giờ là mật khẩu tài khoản). **Liên kết chia sẻ.** **Create a share link** gọi một lần tới dịch vụ chia sẻ trên máy chủ của bạn (`/ocs/v2.php/apps/files_sharing/api/v1/shares`) bằng cùng mật khẩu ứng dụng, để tạo liên kết công khai chỉ đọc với mật khẩu và ngày hết hạn bạn chọn. **Stop sharing** xóa chia sẻ đó.
- <!--i:upload--> **Lưu trữ tương thích S3.** Tệp được gửi tới bucket của bạn (AWS S3, MinIO, R2, B2, Garage hoặc bất kỳ điểm cuối SigV4 nào), được ký trên thiết bị bằng cặp khóa bạn đã nhập. **Liên kết chia sẻ.** Liên kết là địa chỉ ký sẵn được tạo trên thiết bị từ khóa đã lưu của bạn, nên việc tạo không gửi gì đi. Nó tồn tại tối đa bảy ngày và không thể bị tắt sớm hơn.

**Máy chủ bạn chọn cần được đơn vị vận hành phê duyệt.** Các máy chủ Bluesky, Discord, Mastodon, Nextcloud và S3 không nằm trong danh sách cố định của Lolly, vì bạn chọn chúng. Ứng dụng không gửi gì tới một máy chủ cho đến khi đơn vị vận hành phê duyệt đúng máy chủ HTTPS đó: trên web, trong Content Security Policy của bản triển khai; trong ứng dụng máy tính, khi ứng dụng được dựng. Điều tương tự áp dụng cho các máy chủ lưu trữ tùy chỉnh và tải lên SharePoint. Trên web, máy chủ cũng phải cho phép lệnh gọi từ trình duyệt của ứng dụng (CORS), và việc chuyển hướng bị chặn an toàn, nên hãy dùng địa chỉ không chuyển hướng. Ứng dụng máy tính kiểm tra mọi chuyển hướng theo danh sách đã phê duyệt.

Danh sách này giới hạn các máy chủ mà ứng dụng có thể truy cập. Nó không phân biệt tài khoản hay tenant trên Google hoặc Microsoft, và quyền của chính nhà cung cấp quyết định tài khoản và hành động nào được phép. Nó cũng không bao gồm cửa sổ đăng nhập, các loại tài nguyên khác hoặc tính năng gốc, vốn có quy tắc riêng. Thay đổi cần một bản dựng máy tính mới hoặc tiêu đề phản hồi web mới; hãy lưu công việc trước khi mở lại ứng dụng để nhận thay đổi. [Origin của trình kết nối](/info/connector-origins.html) mô tả cấu hình.
:::

::: details Sync trên các thiết bị của bạn
- <!--i:folder--> **Những gì rời thiết bị.** Một bản sao những gì bạn đã tạo trên thiết bị này (phiên và dự án đã lưu, hệ thống thiết kế cùng phông chữ và logo của chúng, ảnh đã tải lên, hồ sơ và tùy chọn của bạn) dưới dạng một tệp, tới một nơi lưu trữ bạn chọn: thư mục ứng dụng Lolly trong Dropbox (`api.dropboxapi.com`, `content.dropboxapi.com`), các tệp Lolly tạo trong Google Drive (`www.googleapis.com`), thư mục ứng dụng Lolly trong OneDrive (`graph.microsoft.com`, với tệp lớn hơn tải lên `api.onedrive.com` hoặc các origin lưu trữ do đơn vị vận hành cấu hình, và tải xuống từ đúng các origin lưu trữ do đơn vị vận hành cấu hình), hoặc Nextcloud, máy chủ WebDAV hay bucket S3 của bạn. Cùng nơi lưu trữ đó giữ tối đa bảy bản sao hằng ngày và một bản sao từ trước lần áp dụng gần nhất của bạn.
- <!--i:shieldcheck--> **Không có gì được gửi tới Lolly.** Không có máy chủ Lolly, trạm chuyển tiếp hay máy chủ Lolly Work trong quy trình, và ứng dụng không cần trang web Lolly nào cho việc này, kể cả để đăng nhập. Bản sao chỉ được mã hóa trước trên thiết bị nếu bạn đặt cụm mật khẩu. Thông tin đăng nhập, khóa, mật khẩu ứng dụng, cụm mật khẩu và cài đặt Sync ở lại trên thiết bị, không bao giờ nằm trong bản sao. Trên web, kết nối Google Drive được ghi nhớ chỉ giữ nhãn tài khoản, thường là địa chỉ email tài khoản Google của bạn, quyền mà nó có và thời điểm bạn kết nối (cùng mã ứng dụng khách của bạn, nếu bạn cung cấp). Không lưu token truy cập nào, và lần đăng nhập Google kéo dài một lượt truy cập. Trong ứng dụng Android, đăng nhập Google Drive đi qua Google Play services trên điện thoại, do Google vận hành.
- <!--i:sliders--> **Khi nào.** Chỉ sau khi bạn bật **Sync across my devices** hoặc nhấn **Sync now**: tải lên ngay sau mỗi thay đổi và khi bạn rời ứng dụng, và kiểm tra bản sao mới hơn khi ứng dụng khởi động. Nếu bị chặn, Sync thất bại và nêu lý do, còn công việc ở lại trên thiết bị. Thay vào đó, bạn có thể xuất dữ liệu ra tệp và tự chuyển. [Đồng bộ các thiết bị của bạn](/info/sync.html) trình bày tính năng này.
:::

::: details Trang web, ảnh chụp và hình ảnh từ các trang khác
- <!--i:monitor--> **URL bạn yêu cầu công cụ chụp.** Công cụ chụp ảnh URL yêu cầu đúng địa chỉ bạn gõ, chỉ khi bạn bắt đầu chụp. Vì bạn chọn địa chỉ tại thời điểm đó, nó không nằm trong chính sách kết nối, và đơn vị vận hành không thể cho phép hay chặn nó theo máy chủ; để loại bỏ nó, hãy loại bỏ công cụ.
- <!--i:globe--> **Trang web trong một hộp Lolly Design.** Trang được yêu cầu từ trang web gốc, kèm địa chỉ IP của bạn, cùng mọi thứ mà bản thân trang yêu cầu. Khi trình duyệt hỗ trợ, khung không được gửi cookie hay địa chỉ nào ngoài origin của chính ứng dụng, nên tài liệu của bạn và liên kết của nó không bao giờ đi cùng yêu cầu. Trên ứng dụng web, chỉ có thể nhúng các trình phát này vào khung: `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com` (bản đồ) và `www.figma.com`, cùng các trang tham chiếu trên `wikipedia.org` và `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org` và `www.openstreetmap.org`. **Allow pages from any site**, trong **Settings → Trusted sites**, tải lại Lolly trên thiết bị của bạn theo chính sách có thể nhúng bất kỳ trang `https:` nào, và vẫn áp dụng cùng quy tắc về tin cậy và hỏi quyền. Trang chỉ tải từ trang web trong Trusted sites của bạn, kể cả các trang tham chiếu mặc định có thể xóa, hoặc sau khi bạn phê duyệt hộp đó trong Inspector; bộ trang ai đó gửi cho bạn hiển thị ảnh của mỗi trang cho đến lúc đó. Trước khi bạn trình chiếu, danh sách đưa ra **Just this time** và **Always trust** cho từng trang web, và không hỏi gì trong khi bạn trình chiếu. Nếu bị chặn, hộp hiển thị ảnh kèm liên kết để mở trang trong thẻ mới. Công cụ Lolly và bản demo Lolly Sandbox trong hộp chạy trên địa chỉ của chính ứng dụng và không liên hệ với ai.
- <!--i:sliders--> **Thay đổi trang bạn hiển thị.** Hành động **Use page** của hộp trang web cho phép bạn từ chối cookie hoặc đóng biểu ngữ trong trang. Với các trang Lolly có thể truy cập, **Hide cookie banners** ẩn các lớp phủ đã biết, bao gồm OneTrust, mà không chấp nhận cookie hay thay đổi lựa chọn đồng ý của trang web. **Page CSS** thay đổi trang trực tiếp và phần trình chiếu của hộp đó; bản xuất vẫn dùng ảnh đại diện đã chọn. Các quy tắc không thể nhập tài nguyên hoặc phông chữ, và trình duyệt ngăn Lolly thay đổi CSS của trang web khác. Bản xem trước Lolly Sandbox có trình chỉnh sửa CSS riêng trong **Edit in Sandbox**.
- <!--i:code--> **Tài nguyên web của bản demo Lolly Sandbox.** Mỗi biểu định kiểu, tập lệnh, phông chữ hoặc ảnh mà mã demo liên kết tới được yêu cầu từ trang web lưu trữ nó, kèm địa chỉ IP của bạn và không có cookie; các tệp được nêu trong biểu định kiểu đã lấy, như tệp phông chữ Google Fonts, được tính là các trang web riêng. Việc này chỉ xảy ra sau khi bạn nhấp **Fetch & inline**, hoặc với trang web trong Trusted sites của bạn; **Always trust** bên cạnh tệp thêm trang web của nó vào danh sách đó. Nếu bị chặn, bản demo chạy mà không có các tệp đó, và Lolly Sandbox liệt kê từng tệp không lấy được cùng lý do.
- <!--i:download--> **Thêm ảnh từ URL.** **Add from URL** trong bộ chọn tài nguyên hoặc Assets yêu cầu đúng địa chỉ ảnh bạn dán. Chính sách riêng của ứng dụng web ngăn trình duyệt lấy trực tiếp từ trang web khác, nên một thành phần chuyển tiếp nhỏ ở địa chỉ của chính ứng dụng (`/api/fetch-image`) lấy ảnh và chỉ trả lại các byte; nó không lưu gì, bỏ địa chỉ và từ chối mọi thứ không phải địa chỉ ảnh công khai. Ứng dụng máy tính lấy trực tiếp từ địa chỉ. Liên kết Lolly bạn dán hoàn toàn không được tải về: nó được kết xuất trên thiết bị. Nếu đơn vị vận hành tắt thành phần chuyển tiếp (`LOLLY_DISABLE_IMAGE_PROXY=1`), chỉ có thể thêm liên kết Lolly, ảnh `data:` và ảnh cùng origin trong ứng dụng web, còn ứng dụng máy tính không bị ảnh hưởng.
- <!--i:palette--> **Hệ thống thiết kế từ một trang web.** Lolly Design System Setup có thể đọc một trang của trang web bạn chỉ định, qua [tiện ích mở rộng trình duyệt](#the-browser-extension) hoặc chức năng lấy dữ liệu riêng của ứng dụng máy tính, không bao giờ qua máy chủ Lolly. Không có gì được tải về trước khi bạn nhấn, và các liên kết trên trang không được truy cập tiếp.
:::

::: details Làm việc với người khác và tác tử
- <!--i:link--> **Một phiên cộng tác riêng.** Hai thiết bị kết nối trực tiếp, không có máy chủ ở giữa. Lời mời và phản hồi mang theo các địa chỉ mà mỗi thiết bị thấy trên mạng riêng của mình, và bản dựng này không cấu hình máy chủ khám phá địa chỉ bên ngoài, nên chỉ đưa chúng cho người bạn đang làm việc cùng. Xem [Làm việc cùng nhau](/info/collaborate.html).
- <!--i:monitor--> **Nearby**, trong ứng dụng máy tính. Trong khi bạn hiển thị, tức là mười phút khi bạn bắt đầu lời mời cộng tác hoặc, nếu bạn bật tùy chọn đó, bất cứ khi nào ứng dụng đang chạy, ứng dụng thông báo một tên ngẫu nhiên, tên hiển thị bạn chọn và loại thiết bị trên mạng cục bộ. Nó không thông báo địa chỉ email, tài khoản hay mã định danh lâu dài.
- <!--i:link--> **Invite an agent.** Trạng thái của tài liệu được mời, các bản xem trước mà tác tử yêu cầu, danh tính tác tử và các chỉnh sửa của nó đi qua trạm chuyển tiếp trực tiếp đã cấu hình (`lolly.ing` trên lolly.tools) tới tác tử bạn mời. Plugin được lưu trữ đã cài đặt cũng chuyển tiếp lệnh gọi qua trình kết nối lolly.tools tới trạm chuyển tiếp mà lời mời chọn; trình kết nối không giữ lời mời hay tài liệu giữa các lệnh gọi. Trạm chuyển tiếp giữ lời mời và yêu cầu đang chờ trong bộ nhớ cho đến khi bạn ngắt kết nối hoặc chúng hết hạn: mười phút cho lời mời chưa dùng và ba mươi phút không hoạt động cho lời mời đã tham gia. Nhà cung cấp tác tử của bạn xử lý dữ liệu nhận được theo chính sách riêng. Việc này chỉ xảy ra sau khi bạn tạo lời mời trong Share và đưa hướng dẫn của nó cho tác tử; quyền đọc cho phép kiểm tra và quyền chỉnh sửa còn cho phép thay đổi. Pause dừng thay đổi, và Disconnect hoặc thu hồi lời mời kết thúc quyền truy cập. Nếu bị chặn, tác tử không thể tham gia hoặc tiếp tục, và bạn vẫn chỉnh sửa được.
- <!--i:cpu--> **Allow AI control**, trong ứng dụng máy tính. Tác tử chạy trên máy tính này có thể đọc và chỉnh sửa tài liệu Lolly Design đang mở qua kết nối ở lại trên máy tính. Nó tắt cho đến khi bạn bật. Lolly không gửi gì tới máy chủ cho việc này; nhà cung cấp tác tử xử lý những gì tác tử đọc theo chính sách riêng. [Mô hình mối đe dọa & Ranh giới tin cậy](/info/threat-model.html) liệt kê những gì tác tử như vậy có thể và không thể làm.
- <!--i:cpu--> **Ask an agent**, trong ứng dụng máy tính. Mở **Ask an agent** trong Lolly Design khiến ứng dụng tìm trên máy tính này bốn công cụ tác tử dòng lệnh (Claude Code, Codex, Gemini CLI và GitHub Copilot CLI), bảy ứng dụng (Claude, ChatGPT, Codex, Cursor, Visual Studio Code, LM Studio và Ollama) cùng máy chủ Ollama và LM Studio trên `127.0.0.1`. Nó chạy lệnh phiên bản và trợ giúp của từng công cụ (cùng danh sách tính năng của Codex), đọc tên và phiên bản ứng dụng từ các gói ứng dụng và hỏi hai máy chủ cục bộ xem chúng có mô hình nào. Nó không đọc tệp đăng nhập hay thông tin xác thực nào, kết quả ở lại trong bộ nhớ ứng dụng và không có gì về kết quả được gửi đi đâu. Khi bạn hỏi tác tử, yêu cầu của bạn và tài liệu đang mở, bỏ qua ảnh đã tải lên, được gửi tới nhà cung cấp tác tử đó (Anthropic cho Claude Code, OpenAI cho Codex) bằng tài khoản mà công cụ đã đăng nhập, và gói dịch vụ của bạn với nhà cung cấp đó chịu phí. Không có máy chủ Lolly trong quy trình. Trước yêu cầu đầu tiên tới mỗi tác tử, bảng hiển thị điều này và hỏi một lần, và câu trả lời của bạn được giữ trong `localStorage` trên thiết bị này. Tác tử chạy không có công cụ, trong thư mục tạm trống, chỉ với các biến môi trường cần để tìm thông tin đăng nhập của chính nó, nên khóa API đặt trong môi trường không được chuyển theo. Trên phiên bản được quản lý, chính sách của tổ chức có thể tắt chức năng này, khi đó ứng dụng không tìm tác tử cũng không khởi động tác tử nào.
- <!--i:server--> **Một phiên bản từ xa.** Khi bạn trỏ ứng dụng tới bản triển khai Lolly khác, ứng dụng nhận mọi thứ mà phiên bản đó trả về, qua cùng cơ chế đồng bộ danh mục, cùng một thẻ phiên bản trên các yêu cầu gửi tới nó (loại ứng dụng và phiên bản bộ máy, cùng thông tin mà user agent mang theo), để đơn vị vận hành thấy phiên bản Lolly nào đang được dùng. Trên phiên bản được quản lý, khi bạn đăng nhập, thẻ còn mang mã cài đặt cho thiết bị này để danh sách thiết bị của đơn vị vận hành phân biệt các bản cài đặt; rời đi xóa mã đó, và thiết bị kết nối lại sau này cung cấp mã mới. Bạn chọn máy chủ nên nó không nằm trong chính sách kết nối. Nếu bị chặn, việc chuyển đổi thất bại và phiên bản cục bộ của bạn không bị ảnh hưởng.
- <!--i:people--> **Phiên bản Lolly Work của tổ chức bạn.** Danh tính đăng nhập và thông tin thiết bị, yêu cầu chính sách, phiên dùng chung, chỉnh sửa cộng tác, nội dung tải lên, hồ sơ xin phê duyệt, trang thương hiệu bạn xuất bản và tệp bàn giao bạn dùng được gửi tới phiên bản của tổ chức bạn, với việc đăng nhập qua nhà cung cấp danh tính của tổ chức. Việc làm mới chính sách có thể chạy trong lúc sử dụng; công việc dùng chung, cộng tác, rà soát và bàn giao gửi nội dung trong các quy trình đó. Các ứng dụng của chính Lolly không gửi sự kiện sử dụng nào tới phiên bản đó. Nếu bị chặn, các tính năng tổ chức đó không thể hoàn tất, và công việc cá nhân của bạn vẫn riêng biệt. Xem [Dịch vụ tổ chức với Lolly Work](#organisation-services-with-lolly-work).
:::

### Mọi máy chủ cố định trong một bảng

Content Security Policy của ứng dụng web ngăn tập lệnh truy cập bất kỳ máy chủ nào không có trong danh sách. Ngoài địa chỉ của chính ứng dụng, bảng liệt kê mọi máy chủ có trong chính sách đó, cộng với hai máy chủ LinkedIn mà ứng dụng máy tính thêm vào, được đánh dấu chỉ dành cho máy tính. Một kiểm thử CI đối chiếu bảng này với chính sách đã triển khai, nên không thể thêm máy chủ vào một bên mà không thêm vào bên kia.

| Mục | Những gì thực sự rời thiết bị của bạn | Máy chủ |
|---|---|---|
| Mô hình chạy trên thiết bị trong các ứng dụng đóng gói và tệp phát hành | Yêu cầu lấy tệp công khai, kèm địa chỉ IP của bạn | `lolli.li` |
| Google Fonts | Tên họ phông chữ và địa chỉ IP của bạn | `fonts.googleapis.com`, `fonts.gstatic.com` |
| Gửi tới và đồng bộ với Google Drive | Tệp hoặc bản sao lưu bạn chọn và quyền chia sẻ khi bạn yêu cầu liên kết chia sẻ | `www.googleapis.com` |
| Gửi tới và đồng bộ với Dropbox | Tệp hoặc bản sao lưu bạn chọn và cài đặt liên kết khi bạn yêu cầu liên kết chia sẻ | `api.dropboxapi.com`, `content.dropboxapi.com` |
| Gửi tới và đồng bộ với OneDrive | Tệp hoặc bản sao lưu bạn chọn, tên hiển thị của bạn cho nhãn tài khoản và yêu cầu liên kết khi bạn yêu cầu liên kết chia sẻ | `login.microsoftonline.com`, `graph.microsoft.com`, `api.onedrive.com` |
| Tra cứu thành phố của Meeting Planner | Từng tên thành phố | `geocoding-api.open-meteo.com` |
| Hồ sơ in ICC | Yêu cầu lấy hồ sơ công khai | `registry.color.org`, `www.color.org` |
| Radio Internet | Yêu cầu danh sách phát và luồng âm thanh | `api.somafm.com`, `*.somafm.com` |
| Invite an agent và không gian làm việc lolly.ing | Trạng thái, bản xem trước và chỉnh sửa của tài liệu được mời cùng các yêu cầu không gian làm việc bạn thực hiện | `lolly.ing` |
| Trình phát trong hộp web Lolly Design | Yêu cầu lấy trang, kèm địa chỉ IP của bạn | `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com`, `www.figma.com` |
| Trang tham chiếu trong hộp web Lolly Design | Yêu cầu lấy trang, kèm địa chỉ IP của bạn | `wikipedia.org`, `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org`, `www.openstreetmap.org` |
| Gửi tới LinkedIn, chỉ trong ứng dụng máy tính | Tệp, với tên tệp làm bài đăng công khai | `www.linkedin.com`, `api.linkedin.com` |

Danh sách riêng của ứng dụng máy tính còn có điểm cuối token của Google cho đăng nhập Drive. Bất kỳ máy chủ nào khác, như máy chủ Mastodon hoặc Nextcloud bạn chỉ định, đều cần được đơn vị vận hành phê duyệt, như mô tả trong Tệp bạn gửi. Máy chủ bạn chọn tại thời điểm sử dụng, như URL bạn chụp hoặc phiên bản từ xa bạn chỉ định, không xuất hiện trong danh sách nào.


**Chữ ký SEAL không tạo yêu cầu nào.** Lolly Verify có thể kiểm tra chữ ký SEAL, một cơ chế mà khóa ký có thể được công bố trong DNS. Trình duyệt không thể truy vấn DNS, nên tra cứu trên web phải đi qua trình phân giải DNS-over-HTTPS bên thứ ba, nơi sẽ thấy miền đang được kiểm tra và địa chỉ IP của bạn. Lolly từng dùng trình phân giải của Cloudflare; hiện không còn dùng và không có gì thay thế Cloudflare. Hiện không ứng dụng Lolly nào tra cứu khóa SEAL: ứng dụng máy tính và di động chạy cùng chế độ xem Verify, và lệnh `lolly validate` không kiểm tra SEAL. Tệp có bản ghi SEAL chứa khóa trực tiếp được kiểm tra ngoại tuyến, và Lolly Verify gọi chữ ký đó là nhất quán nội bộ mà không xác nhận miền. Tệp có khóa chỉ nằm trong DNS hiển thị **SEAL signature did not verify**, với lý do "không có trình phân giải khóa và không có khóa trực tiếp".

![Màn hình Lolly Verify: chỉ có vùng thả tệp - tệp được kiểm tra ngay tại nơi nó đang nằm, không tải lên và không cần tài khoản](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop)

Bạn có thể tự kiểm tra điều này và mọi tuyên bố khác trên trang: [Tự xác minh](/info/verify-yourself.html) cung cấp các lệnh và đầu ra dự kiến.

<!--i:eti-cpu-->
## Các dịch vụ lolly.tools vận hành

Các dịch vụ này chạy trên lolly.tools cho mọi người. Mỗi dịch vụ chỉ nhận những gì bạn gửi. [Bề mặt máy chủ](/info/server-surface.html) mô tả cùng các thành phần đó khi hoạt động trên bất kỳ bản triển khai nào.

### Liên kết kết xuất

Mọi URL `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>` đều thực sự kết xuất, và đầu vào đi trong URL, nên liên kết Lolly được chia sẻ có thể xuất hiện như ảnh trực tiếp trong README, wiki hoặc bảng tổng quan. Lấy một URL như vậy yêu cầu máy chủ kết xuất **dữ liệu công cụ và danh mục công khai** với đầu vào được ghi trong địa chỉ.

- <!--i:usercheck--> **Không tài khoản, không cookie, không trạng thái.** Tuyến này không yêu cầu đăng nhập và không đọc gì trên thiết bị của bạn. Tài liệu, phiên và nội dung tải lên của bạn không bao giờ rời trình duyệt và không thể xuất hiện trong các liên kết này.
- <!--i:document--> **Bản thân URL được ghi lại.** Chuỗi truy vấn của URL là một phần của yêu cầu, nên xuất hiện trong nhật ký truy cập thông thường của nền tảng lưu trữ như mọi đường dẫn được yêu cầu. Nếu đầu vào của liên kết chứa tên hoặc địa chỉ email của ai đó, như trên thẻ tên hoặc chữ ký email, **văn bản đó nằm trong các nhật ký này**. Chỉ đưa vào liên kết kết xuất những gì bạn sẵn sàng đặt trên trang công khai.
- <!--i:globe--> **Đầu vào vốn đã công khai.** Đó là những gì tác giả liên kết gõ vào URL, ai nhận được liên kết cũng đọc được. Với nội dung nhạy cảm, Lolly cung cấp mã hóa liên kết.
- <!--i:eyeoff--> **Được lưu đệm, giới hạn và không lập chỉ mục.** Phản hồi được lưu đệm và giới hạn tần suất như mọi ảnh công khai, và được đánh dấu `noindex` để công cụ tìm kiếm bỏ qua các bản kết xuất của bạn.

Bản triển khai tự lưu trữ không muốn có tuyến kết xuất công khai đặt `LOLLY_DISABLE_RENDER_GET=1`, và tất cả các URL này đều trả về 404.

### Trình lấy ảnh và thành phần chuyển tiếp Penpot

**Add from URL** trong ứng dụng web và **Send to Penpot** dùng hai thành phần chuyển tiếp nhỏ trên lolly.tools, được mô tả trong [Mọi yêu cầu mạng mà ứng dụng có thể gửi](#every-network-request-the-app-can-make). Trình lấy ảnh không giữ gì và bỏ địa chỉ. Thành phần chuyển tiếp Penpot chuyển token và tệp lưu trữ của bạn tới Penpot, không giữ cả hai; nó ghi nhật ký tên lệnh và trạng thái phản hồi của Penpot.

### Máy chủ MCP dành cho tác tử AI

Tác tử AI có thể truy cập Lolly qua Model Context Protocol, thông qua điểm cuối do đơn vị vận hành chạy. lolly.tools chạy một điểm cuối, và ai cũng có thể chạy điểm cuối riêng, kể cả hoàn toàn ngoại tuyến.

- <!--i:cpu--> **Tệp tác tử gửi.** Các công cụ nhận tệp (`lolly_transform`, `lolly_verify`, `lolly_redact`, `lolly_read`, `lolly_check`, `lolly_package`, `lolly_compose`, `lolly_rebrand` và các công cụ ảnh `lolly_look`, `lolly_sample_color` và `lolly_trace_edges`) xử lý tệp trong bộ nhớ và trả kết quả trong cùng lệnh gọi. Tệp không bao giờ được ghi ra đĩa và không được giữ sau khi yêu cầu hoàn tất. `lolly_inspect` cũng nhận tệp, và các bước kiểm tra video và sản xuất in của nó ghi một bản sao làm việc tạm thời, được xóa khi lệnh gọi trả về. Mọi công cụ khác làm việc từ các tham số trong lệnh gọi: văn bản, số, màu sắc, URL, mã tài nguyên danh mục hoặc tài liệu do bên gọi cung cấp.
- <!--i:cpu--> **Lolly Rebrand nêu rõ bộ trang đi đâu.** Giai đoạn đầu tiên của `lolly_rebrand`, `capabilities`, diễn đạt bằng lời các byte của bạn sẽ đi đâu trước khi bạn gửi bất kỳ byte nào: trên máy chủ cục bộ tự lưu trữ, bộ trang không bao giờ rời máy đó, và trên máy chủ được lưu trữ, gọi `lolly_rebrand` sẽ gửi bộ trang tới đó, trong giới hạn dung lượng và số trang chiếu mà giai đoạn đó đưa ra.
- <!--i:lock--> **Điểm cuối mở.** Trên lolly.tools, `lolly.tools/api/mcp` mở cho bất kỳ ai mà không cần token. Lệnh gọi bị giới hạn theo địa chỉ và hạn mức hằng ngày. Địa chỉ trở thành mã băm định danh giả trong kho kiểm soát lạm dụng, như ở các điểm cuối đăng nhập bên dưới, và hạn mức chỉ tính thời gian CPU và số byte gửi đi, không kèm địa chỉ. Bearer token của điểm cuối hạn chế không bao giờ được ghi vào nhật ký hoặc URL kết xuất.
- <!--i:link--> **Liên kết tải xuống cho kết quả lớn.** lolly.tools trả kết quả trực tiếp trong phản hồi và không bao giờ cấp các liên kết này. Đơn vị vận hành có thể bật chúng cho cổng có xác thực riêng, nơi kết quả được giữ tối đa năm phút và chỉ bearer token của chính bên gọi mới lấy được; xem [Máy chủ MCP](/info/mcp.html#private-download-links-for-large-results). Điểm cuối hạn chế dự kiến tại `mcp.lolly.tools` sẽ nhận bearer token do đơn vị vận hành cấp cho ứng dụng khách tin cậy, hoặc OAuth 2.1 với token đã ký tồn tại ngắn hạn được kiểm tra bằng bí mật dùng chung; việc kích hoạt đang chờ và nó được liệt kê trong [Máy chủ phân phối và bên xử lý](#delivery-hosts-and-processors).

### Danh tính đã xác minh: lần đăng nhập do bạn tự bắt đầu

Lolly có thể đóng dấu một **Content Credential** vào bản xuất của bạn, để ai cũng có thể kiểm tra ngoại tuyến rằng tệp không thay đổi kể từ khi rời Lolly. Phần đó **được bật mặc định và hoàn toàn cục bộ**: khóa ký được tạo trên thiết bị của bạn và việc ký diễn ra ngoại tuyến. Khi chưa đăng ký, khóa đó dùng một lần, một cặp khóa mới được tạo cho từng bản xuất rồi bỏ đi. Sau khi bạn đăng ký, khóa tồn tại lâu dài và được tạo ở dạng **không thể trích xuất**, nên ngay cả mã của chính Lolly cũng không đọc được, chỉ có thể yêu cầu khóa ký. Trong cả hai trường hợp, khóa không bao giờ rời thiết bị của bạn.

[Xuất tệp](/info/exporting.html#content-credentials-c2pa) liệt kê những gì chứng thực ghi lại: công cụ, thời gian, bề mặt xuất ở mức khái quát, tên bạn chỉ khi bạn bật *Use my details*, các tác phẩm được ghi công mà bản xuất sử dụng, từng bài hát Lolly Rondocode mà bản xuất video hoặc âm thanh phát (tên, mã băm nguồn và cách sandbox của Lolly kết xuất bài hát) và từng giai điệu đã lưu mà bản xuất đó phát (tên, mã băm công thức, phiên bản bộ máy và giấy phép khi giai điệu có ghi giấy phép). Người tạo giai điệu đã lưu, tên được ghi khi lưu giai điệu, chỉ được thêm khi *Use my details* bật, nên khi tắt công tắc đó, không có tên nào rời thiết bị của bạn theo cách này. Bảng xuất liệt kê các bài hát và giai điệu đó trước khi bạn xuất, và chỉ hiển thị người tạo giai điệu khi tên sẽ được ghi.

Chứng thực và siêu dữ liệu của tệp còn ghi lại [hệ thống thiết kế và colourway](/info/exporting.html#the-design-system-record) đã vẽ bản xuất: mã và tên hệ thống thiết kế, phiên bản đã xuất bản và colourway. Tên hệ thống thiết kế là văn bản do chủ sở hữu gõ và có thể là tên khách hàng, nên thẻ **Design system** trong bảng xuất hiển thị đúng nội dung đó trước khi bạn xuất. Bỏ chọn thẻ, hoặc truyền `_madewith=0` hay `--no-madewith`, để không đưa chúng vào.

Bên xuất bản hệ thống thiết kế cũng có thể chọn ghi địa chỉ [trang thương hiệu](/info/brand-page.html#lead-back-from-your-files) trong cùng bản ghi. Địa chỉ là phần bổ sung duy nhất. Cài đặt tắt cho đến khi bên xuất bản bật, không đi cùng gói hoặc bản sao, và cùng thẻ đó hiển thị địa chỉ và cho phép bỏ địa chỉ đi. Đọc lại tệp không bao giờ tải địa chỉ đó: Lolly Verify hiển thị máy chủ, và bạn chọn có mở trang hay không.

Tệp được phê duyệt qua Lolly Work của tổ chức còn có thể mang bản ghi phê duyệt đã ký: mã phê duyệt, ngày quyết định và mã băm của tệp đã rà soát, không có tên, email, nhóm, bình luận hay tên chuỗi. Người yêu cầu rà soát thấy mục này dưới dạng ô đã chọn và có thể bỏ chọn, và tổ chức có thể tắt việc ghi lại.

Tệp tạo từ một [ý định](/info/visual-intent.html#what-goes-in-the-file) còn ghi lại những gì nó được yêu cầu làm: mục đích, bề mặt, công cụ, ngôn ngữ và mã băm của yêu cầu. Dịp, đối tượng, khu vực và mọi lời nhắc chỉ được lưu dưới dạng dấu vân tay. Nội dung nguyên văn của lời nhắc chỉ được đưa vào khi người hoặc tác tử thực hiện lần kết xuất đó yêu cầu, và lần chạy nêu rõ điều này, vì ai nhận được tệp cũng có thể đọc chúng. Có thể bỏ bản ghi này, và không bản xuất nào khác mang bản ghi như vậy.

Bước *tùy chọn* duy nhất thêm vào là đăng ký danh tính đã xác minh, để bản xuất ghi "Đã xác minh - được ký bởi \<your email\>" thay vì nêu một khóa ẩn danh. **Nếu bạn bỏ qua đăng ký, dịch vụ chứng chỉ không nhận dữ liệu đăng ký nào từ bạn.**

![Thẻ Verified identity trong Settings, rộng bằng điện thoại: bộ chọn thời hạn chứng chỉ và bước đăng ký bên dưới, không hoạt động cho đến khi bạn tự bắt đầu](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Nếu bạn đăng ký, đây chính xác là những gì xảy ra:

::: timeline
- <!--i:usercheck--> **Bạn chọn phương thức đăng nhập**: GitHub, Google, SUSE (id.suse.com) hoặc liên kết gửi qua email. Với ba nhà cung cấp OIDC, bạn tới trang đăng nhập riêng của nhà cung cấp, theo chính sách quyền riêng tư của họ, không phải của chúng tôi, và dịch vụ chứng chỉ chỉ nhận lại địa chỉ email đã xác minh cùng tên nhà cung cấp. Với liên kết email, địa chỉ bạn gõ được gửi tới **Resend**, một dịch vụ email giao dịch, chỉ để gửi một liên kết đó.
- <!--i:lock--> **Cookie ngắn hạn bảo vệ việc chuyển hướng.** Dịch vụ chứng chỉ đặt `lolly_ca_state`, `HttpOnly`, có phạm vi `/api/ca` và hết hạn trong vòng mười phút. Nó mang một giá trị ngẫu nhiên thay vì mã định danh theo dõi, chỉ tồn tại để ngăn giả mạo chuyển hướng đăng nhập và được xóa ngay khi đăng nhập hoàn tất.
- <!--i:eyeoff--> **Địa chỉ IP của bạn được dùng trong thời gian ngắn để ngăn lạm dụng** các điểm cuối đăng nhập, để một tập lệnh không thể làm ngập hộp thư hoặc dùng hết hạn mức email. Lolly chuyển địa chỉ thành mã băm SHA-256 trước khi tới kho kiểm soát lạm dụng ngắn hạn, nên địa chỉ gốc không được gửi tới đó. Mã băm là định danh giả chứ không phải ẩn danh: người có kho dữ liệu có thể khôi phục địa chỉ IPv4 bằng cách thử mọi địa chỉ có thể. Bucket hết hạn sau khoảng một phút và không dùng cho việc gì khác. Nhật ký truy cập lưu trữ thông thường là riêng biệt và được mô tả bên dưới.
- <!--i:seal--> **Dịch vụ cấp chứng chỉ** gắn địa chỉ email đã xác minh của bạn với khóa công khai của thiết bị. Khóa riêng ở lại trên thiết bị: ứng dụng khách gửi yêu cầu chứng chỉ kèm bằng chứng sở hữu được ràng buộc, và không có khóa riêng của thiết bị nào được gửi tới cả hai chế độ bên cấp.
- <!--i:check--> **Việc ký vẫn diễn ra cục bộ.** Với bên cấp cũ, bản xuất không cần yêu cầu tới dịch vụ chứng chỉ. Danh tính được quản lý còn cần danh sách thu hồi đã ký còn mới từ bên cấp; ứng dụng khách có thể dùng danh sách lưu đệm trong khoảng thời gian còn mới đã cấu hình, và việc làm mới có thể liên hệ dịch vụ chứng chỉ trong lúc xuất. Trạng thái thiếu, hết hạn hoặc không hợp lệ ngăn việc dùng danh tính được quản lý.
:::

::: details Lưu giữ và thu hồi trong từng chế độ bên cấp
**Cấp chứng chỉ qua dịch vụ lưu trữ cũ** cung cấp thời hạn 7, 30, 90 hoặc 365 ngày, với mức trần do đơn vị vận hành đặt. Nó không giữ danh mục danh tính hay nhật ký cấp, nên không thể tra cứu ai đã nhận chứng chỉ hoặc thu hồi chứng chỉ của người đó; thời hạn chính là cơ chế thu hồi.

**Cấp chứng chỉ do tổ chức quản lý** dùng thời hạn mặc định tối đa 24 giờ và tối đa bảy ngày, với chính sách tin cậy gốc và bên cấp riêng, và việc ký được chuyển tới bên cấp Vault do đơn vị vận hành cấu hình. Ứng dụng đăng ký dùng kho chấp nhận một lần dùng chung, chỉ giữ mã định danh xác thực có khóa và mã băm yêu cầu, tối đa mười phút, không lưu danh mục danh tính hay bộ nhớ đệm phản hồi chứng chỉ. Nhà cung cấp PKI, thiết bị kiểm toán, cổng và bản sao lưu của họ có luồng dữ liệu riêng. Ngay cả khi tắt lưu trữ cấp chứng chỉ thông thường, việc thu hồi dựa trên chứng chỉ vẫn có thể giữ chứng chỉ, bao gồm danh tính email, và số sê-ri thu hồi cùng mã định danh kiểm toán có thể vẫn liên kết được; chính sách của đơn vị vận hành quyết định danh mục đó, ai có thể truy cập và thời gian lưu giữ.

Thiết bị được quản lý có thể yêu cầu thu hồi chứng chỉ của chính nó, với bằng chứng đã xác thực của thiết bị, và không API nào yêu cầu khóa riêng của thiết bị. Đơn vị vận hành có thể rút lại sự tin cậy đối với bên cấp qua chính sách tin cậy. Lolly không giữ ánh xạ từ người sang chứng chỉ, nên việc thu hồi chứng chỉ của một người khi họ rời đi phụ thuộc vào các bản ghi mà đơn vị vận hành giữ, và bản ghi PKI, bản ghi kiểm toán, bên nhận và bản sao lưu tuân theo chính sách của đơn vị vận hành. [Thiết kế dịch vụ chứng chỉ](https://github.com/lolly-tools/lolly/blob/main/services/ca/README.md) trình bày việc quản lý bên cấp, lưu giữ của nhà cung cấp và điều kiện đáp ứng.
:::

<!--i:eti-building-->
## Dịch vụ tổ chức với Lolly Work

**Lolly Work** là dịch vụ tổ chức tùy chọn của dự án Lolly, được triển khai riêng bởi từng tổ chức vận hành một phiên bản. Kết nối với một phiên bản bổ sung dữ liệu được giữ trên máy chủ đó bên cạnh việc chỉnh sửa cục bộ của bạn. Đơn vị vận hành chịu trách nhiệm về chính sách quyền riêng tư, kiểm soát truy cập, bên nhận, lưu giữ và sao lưu của bản triển khai đó.

Khi kết nối không gian làm việc, dòng quyền riêng tư trên màn hình đầu tiên của ứng dụng nêu rõ điều đó: không gian làm việc giữ những gì bạn lưu vào các dự án của nó hoặc chia sẻ qua nó, cùng nhật ký các lần đăng nhập và việc bạn làm ở đó.

| Quy trình | Dữ liệu do dịch vụ của tổ chức xử lý |
|---|---|
| Đăng nhập và cấp tài khoản | Các khai báo của nhà cung cấp danh tính, tài khoản và tư cách thành viên nhóm, phiên đăng nhập và thông tin thiết bị. OIDC xử lý đăng nhập; quản trị viên có thể cấp và vô hiệu hóa tài khoản qua SCIM |
| Danh mục và dự án dùng chung | Tài nguyên đã tải lên, siêu dữ liệu và phiên bản; dự án và phiên dùng chung; trang thương hiệu bạn xuất bản; nội dung lấy từ các nhà cung cấp thư viện đã cấu hình |
| Cộng tác Lolly Work | Trạng thái phiên dùng chung, chỉnh sửa trực tiếp và sự hiện diện của người tham gia được gửi qua phiên bản; trạng thái đã lưu được duy trì theo chính sách lưu trữ của nó |
| Liên kết chia sẻ được quản lý | Đích liên kết và cài đặt truy cập, như thời hạn và bảo vệ bằng mật khẩu tùy chọn; yêu cầu được xử lý qua phiên bản và có thể bị thu hồi |
| Rà soát và bàn giao | Nội dung đã gửi, quyết định phê duyệt, đích đã chọn, tệp được chuẩn bị và biên nhận bàn giao |
| Kết xuất và batch trên máy chủ | Đầu vào công cụ đã gửi, yêu cầu kết xuất, trạng thái và tệp đầu ra được giữ lại. Các công việc này chạy trên máy chủ thay vì trên thiết bị của bạn |
| Báo cáo sử dụng | Nhãn sự kiện được cho phép như mã công cụ, định dạng và mã tài nguyên, từ ứng dụng khách gửi chúng, theo chính sách đo lường bên dưới |
| Kiểm toán | Bản ghi chủ thể và hành động cho các thao tác được quản trị, được giữ riêng với dữ liệu đo lường sử dụng |

Dịch vụ dùng cookie xác thực, gồm `lw_session` cho thành viên đã đăng nhập và `lw_guest` cho truy cập khách khi được bật, riêng với cookie của dịch vụ chứng chỉ. Việc làm mới chính sách có thể tạo yêu cầu trong khi ứng dụng đang được dùng, không cần nhấp riêng cho từng lần. Đây là lưu lượng tới phiên bản đã cấu hình, không phải báo cáo cho dự án Lolly về những bản triển khai mà dự án không vận hành.

**Kiểm tra bản phát hành.** Máy chủ Lolly Work kiểm tra chỉ mục chart đã công bố trên GitHub mỗi ngày một lần để tìm bản phát hành mới hơn, bằng cùng yêu cầu thông thường mà mọi lệnh `helm repo update` tạo, không mang thông tin gì về phiên bản hay người dùng của nó. Tính năng được bật mặc định, và quản trị viên của phiên bản có thể tắt hoặc trỏ tới bản sao mirror ([`updates`](/info/work-configuration.html#updates)).

**Đo lường sử dụng có ba mức.** Hiện các ứng dụng của chính Lolly không gửi sự kiện sử dụng nào, nên các mức này áp dụng cho sự kiện từ ứng dụng khách khác mà đơn vị vận hành kết nối. `off` không lưu sự kiện sử dụng, `aggregate` loại bỏ mã người dùng và `standard` có thể gắn sự kiện với người dùng. Mức mặc định là `standard`, nên phiên bản lưu các sự kiện sử dụng nhận được trừ khi đơn vị vận hành chọn `off`. Chính sách gắn danh tính mặc định là `opt-in`, cần sự đồng ý của bạn trước khi lưu mã người dùng; thay vào đó, đơn vị vận hành có thể cấu hình báo cáo gắn danh tính bằng `telemetryAttribution: default`. Các thuộc tính được cho phép là nhãn, không bao giờ là giá trị đầu vào công cụ. Xem [Đo lường Lolly Work](/info/work-telemetry.html).

**Kiểm toán là riêng biệt.** Hành động được quản trị có thể giữ bản ghi kiểm toán có định danh bất kể sự đồng ý đo lường của bạn. Tắt đo lường không tắt lưu trữ phiên dùng chung, bản ghi phê duyệt, lưu trữ công việc kết xuất hoặc kiểm toán. Đơn vị vận hành kiểm soát lưu giữ và xóa, bao gồm mọi việc giả danh hóa nhật ký kiểm toán; xem [Lưu trữ và vòng đời dữ liệu Lolly Work](/info/work-data-lifecycle.html).

| | Thiết bị của bạn | Phiên bản của tổ chức bạn |
|---|---|---|
| Giữ những gì | Công việc cá nhân, tùy chọn và bộ nhớ đệm của bạn | Công việc dùng chung, tài khoản, nội dung tải lên, phê duyệt, bản kết xuất, kiểm toán và dữ liệu đo lường đã cấu hình |
| Ai xóa | Bạn, bằng **Clear all my data** hoặc dữ liệu trang web của trình duyệt | Đơn vị vận hành, qua các điều khiển riêng của phiên bản |
| Hỏi ai | Không ai: các bản ghi nằm trên thiết bị của bạn | Đơn vị vận hành phiên bản, để truy cập, xuất hoặc xóa |

::: warning Xóa cục bộ không phải xóa trên máy chủ
Rời phiên bản hoặc dọn trình duyệt xóa trạng thái cục bộ, không xóa các bản ghi hoặc bản sao lưu mà tổ chức giữ. [Sync](/info/sync.html) cá nhân và **Export my data** sao lưu thiết bị của bạn, không phải dịch vụ của tổ chức. Bản demo [lolly.work](https://lolly.work) công khai chỉ giữ trạng thái trong bộ nhớ và không phải nơi lưu trữ bền vững cho công việc của bạn.
:::

<!--i:eti-camera-->
## Tiện ích mở rộng trình duyệt

Tiện ích mở rộng trình duyệt **Lolly URL Screenshot** không thu thập dữ liệu cá nhân nào cho chúng tôi. Nó không có phân tích, theo dõi hay máy chủ riêng. Trang [Tiện ích mở rộng trình duyệt](/info/extension.html) mô tả cách nó hoạt động.

**Nó làm gì.** Ứng dụng web Lolly có thể yêu cầu nó chụp ảnh trang web hoặc lấy nội dung trang để bắt đầu một hệ thống thiết kế từ trang web. Mỗi yêu cầu mở cửa sổ phê duyệt trong tiện ích mở rộng, hiển thị trang web yêu cầu, yêu cầu ảnh chụp hay nội dung trang và địa chỉ trang. Chỉ sau khi bạn nhấn **Approve once**, tiện ích mở rộng mới mở trang đó trong thẻ nền tạm thời, chụp ảnh hoặc đọc trang, chuyển kết quả cho thẻ Lolly đã yêu cầu rồi đóng thẻ. Với ảnh chụp SVG, nó còn đọc bố cục trang, ảnh và tệp phông chữ trong thẻ đó, và ứng dụng chuyển chúng thành hình khối trên thiết bị của bạn. Mỗi yêu cầu cần được phê duyệt riêng.

**Dữ liệu.**

- <!--i:shieldcheck--> **Chúng tôi không thu thập gì.** Kết quả chỉ được gửi tới trang Lolly đã yêu cầu, trong cùng trình duyệt. Tiện ích mở rộng không lưu nội dung trang và không thêm bên nhận nào khác.
- <!--i:globe--> **Yêu cầu mạng.** Trang bạn phê duyệt tải như trong bất kỳ thẻ nào, cùng mọi thứ mà chính trang đó yêu cầu. Đọc nội dung trang còn lấy các biểu định kiểu và một số ảnh biểu tượng, logo của trang, từ bên trong trang, và các lần lấy đó không gửi cookie tới trang web khác. Ảnh chụp SVG yêu cầu lại các tệp phông chữ mà trang đã tải, thường được trình duyệt trả lời từ bộ nhớ đệm. Tiện ích mở rộng không tạo yêu cầu nào khác, và không yêu cầu nào tới máy chủ Lolly.
- <!--i:lock--> **Phiên trình duyệt của bạn.** Trang tải với phiên trình duyệt của bạn, như khi bạn tự mở, nên trang mà bạn đã đăng nhập có thể đưa thông tin riêng tư vào kết quả.
- <!--i:link--> **Các địa chỉ bạn phê duyệt** chỉ được dùng để tải một trang đó cho một yêu cầu đó. Chúng không được ghi nhật ký hay chia sẻ.

**Quyền.**

- <!--i:wrench--> **`debugger`**: để chụp ảnh qua DevTools Protocol, cùng cơ chế mà ứng dụng máy tính Lolly dùng, và với SVG để duyệt trang trong thẻ tạm thời.
- <!--i:monitor--> **`tabs`**: để mở và đóng thẻ tạm thời, và kiểm tra cả trang Lolly lẫn trang đích đều chưa chuyển đi kể từ khi bạn phê duyệt.
- <!--i:code--> **`scripting`**: để đọc nội dung trang trong thẻ tạm thời, sau khi bạn phê duyệt yêu cầu đó.
- <!--i:database--> **`storage`**: để ghi mã các thẻ tạm thời vào vùng lưu trữ phiên, để chúng vẫn được đóng nếu trình duyệt dừng tiện ích mở rộng trong khi xử lý yêu cầu. Không lưu nội dung trang nào.
- <!--i:check--> **Quyền truy cập trang web tùy chọn (`http://*/*`, `https://*/*`)**: không được cấp khi cài đặt. Khi bạn nhấn **Approve once**, tiện ích mở rộng xin Chrome quyền truy cập một trang web trong yêu cầu đó, và Chrome hỏi bạn ở lần đầu cho mỗi trang web. Trang web bạn từng cho phép vẫn cần phê duyệt mới cho mỗi yêu cầu.

Không quyền nào trong số này được dùng để đọc, theo dõi hoặc truyền hoạt động duyệt web của bạn ngoài một yêu cầu bạn đã phê duyệt.

<!--i:eti-map-pin-->
## Máy chủ phân phối và bên xử lý

Tệp danh mục công khai, công cụ và bản kết xuất để hiển thị mặc định đến từ địa chỉ của chính ứng dụng. Tên định địa chỉ theo nội dung thay đổi nơi lấy tệp, không thay đổi bên nhận yêu cầu. Không CDN bên thứ ba nào được kích hoạt bởi tính năng phân phối này. CDN kết thúc TLS sẽ nhận thông tin yêu cầu, gồm địa chỉ IP và mọi cookie hoặc thông tin xác thực bearer được chuyển tiếp tới nó, ngay cả dưới cùng tên máy chủ trong trình duyệt, nên đơn vị vận hành thêm CDN sẽ có thêm bên xử lý mới.

**Trước khi thêm bất kỳ CDN hoặc máy chủ mô hình bên ngoài nào**, quản trị viên phải công bố tên bên xử lý, tên máy chủ, khu vực tài phán, siêu dữ liệu được nhận, việc lưu giữ và các thỏa thuận chuyển dữ liệu. [Triển khai phân phối](/info/deploy-delivery.html) liệt kê những gì cần công bố. Phản hồi không gian làm việc riêng bỏ qua bộ nhớ đệm dùng chung: kết quả cá nhân, từ chối truy cập và lỗi dùng `private, no-store`, và phản hồi riêng được phép có thể được xác thực lại trong trình duyệt của bạn mà không trở thành công khai.

Các dịch vụ tham chiếu dùng hạ tầng lưu trữ dưới đây. Đây là danh sách tên máy chủ, không phải tuyên bố rằng phiên bản của tổ chức khác dùng cùng khu vực.

| Tên máy chủ hoặc dịch vụ | Chức năng và bên nhận | Khu vực và cách xử lý dữ liệu |
|---|---|---|
| lolly.tools | Ứng dụng công khai, danh mục, dịch vụ kết xuất và chứng chỉ; lưu trữ UpCloud | Frankfurt, Đức. Thông tin yêu cầu có thể xuất hiện trong nhật ký hạ tầng; chỉnh sửa cục bộ thông thường ở lại trên thiết bị |
| lolly.ing | Dịch vụ không gian làm việc được quản lý và tác tử tài liệu; lưu trữ UpCloud | Frankfurt, Đức. Cơ sở dữ liệu riêng và vùng lưu trữ tệp nằm trên cùng máy chủ. Tài khoản, nội dung dùng chung và bản ghi dịch vụ tuân theo chính sách của quản trị viên phiên bản |
| mcp.lolly.tools | Cổng MCP có xác thực tùy chọn và tải xuống kết quả riêng theo kế hoạch; lưu trữ UpCloud | Frankfurt, Đức, với cùng bên xử lý lưu trữ. Đang chờ kích hoạt. Cổng sẽ nhận thông tin yêu cầu cùng tham số hoặc tệp mà bên gọi gửi |
| lolli.li | Tệp phát hành và mô hình công khai; UpCloud Managed Object Storage, tách biệt với cụm ứng dụng | Frankfurt, Đức, trong khu vực lưu trữ đối tượng europe-2 của UpCloud. Một lần tải xuống gửi thông tin yêu cầu, không gửi đầu vào mà mô hình xử lý sau đó |
| Nhà cung cấp danh tính đã cấu hình | Google, GitHub hoặc nhà cung cấp OIDC của đơn vị vận hành | Đăng nhập tuân theo chính sách của nhà cung cấp đó. Hỏi đơn vị vận hành phiên bản về tên máy chủ, khu vực và các thỏa thuận chuyển dữ liệu |
| Nhà cung cấp tài nguyên đã cấu hình | Brandfolder hoặc thư viện khác do đơn vị vận hành chọn | Nhà cung cấp nhận các yêu cầu thư viện được phép. Quyền tại nguồn và chính sách của phiên bản chi phối truy cập; hỏi đơn vị vận hành về tên máy chủ và khu vực của nhà cung cấp |
| Đăng ký qua email, khi được cấu hình | Resend gửi liên kết đăng nhập được yêu cầu | Nhận địa chỉ email đích cho thư đó; áp dụng điều khoản xử lý riêng của dịch vụ |

Ứng dụng tham chiếu không dùng nhà cung cấp lưu trữ, cơ sở dữ liệu hay kiểm soát lạm dụng nào khác. Đơn vị vận hành có thể chọn nhà cung cấp khác cho phiên bản khác, và từng nhà cung cấp lưu trữ, danh tính, tài nguyên và email cần được công bố riêng. [Khu vực lưu trữ đối tượng](https://upcloud.com/docs/products/managed-object-storage/availability/) của máy chủ mô hình được xác minh riêng với khu vực của ứng dụng.

**Liên kết tải xuống MCP tùy chọn gắn với chủ thể.** Đơn vị vận hành có thể bật liên kết tải xuống cho kết quả lớn trên cổng có xác thực, chỉ có một bản sao chạy. Chúng tắt theo mặc định. Cổng ẩn danh tại `lolly.tools/api/mcp` trả kết quả trực tiếp trong phản hồi và không bao giờ cấp các liên kết này. Tên máy chủ hạn chế dự kiến là `mcp.lolly.tools`, trên cùng bên xử lý UpCloud ở Frankfurt; đang chờ kích hoạt, và trang này không tuyên bố có dịch vụ liên kết tải xuống đang hoạt động. Các liên kết không thêm CDN bên thứ ba nào.

::: details Cách lưu giữ liên kết tải xuống MCP của đơn vị vận hành
Chỉ bên gọi đã xác thực có phạm vi tệp mới nhận được liên kết, và cần bearer của chính bên gọi đó để lấy kết quả: dùng bearer đã được xác thực từ lệnh gọi kết xuất, không dùng token khác cho cùng tài khoản. Quyền cấp hết hạn trong vòng 300 giây. Quyền sở hữu và tra cứu kết quả ở lại trong bộ nhớ cổng, còn byte đầu ra được ghi vào tệp tạm riêng, được dọn sau khi hết hạn hoặc xóa khi tắt đúng quy trình. Khởi động lại cổng làm mất hiệu lực các liên kết hiện có. Kết quả được giữ giới hạn ở 64 MiB cho mỗi bearer, 256 MiB trên toàn cổng và 200 tệp đang chờ hoặc được giữ. Hạn mức CPU và byte đã giải mã hằng ngày tính kết quả khi chúng được giữ và khi được tải xuống. Phản hồi dùng `private, no-store` và `Referrer-Policy: no-referrer`. Chỉ riêng token của liên kết không cho phép người hoặc tác tử khác đọc kết quả.
:::

<!--i:eti-file-->
## Nhật ký hạ tầng

Phần này mô tả bản triển khai lolly.tools công khai. Nền tảng lưu trữ của nó ghi lại thông tin yêu cầu thông thường: địa chỉ IP, đường dẫn được yêu cầu, dấu thời gian và user agent. Các chỉnh sửa cục bộ không tới máy chủ đó. Chuỗi truy vấn của liên kết kết xuất có thể chứa văn bản do bên gọi cung cấp, như đã giải thích ở trên. Các công cụ tệp MCP xử lý byte được cung cấp trong bộ nhớ. Phiên bản Lolly Work còn giữ các bản ghi mô tả ở trên, theo chính sách ghi nhật ký của đơn vị vận hành.

**Các dịch vụ công khai giữ việc ghi nhật ký ứng dụng ở mức tối thiểu.** Máy chủ MCP ghi nhật ký khởi động, cấu hình và cảnh báo kết xuất; nó không giữ nhật ký yêu cầu riêng và không ghi token hay địa chỉ bên gọi. Thành phần chuyển tiếp Penpot ghi tên từng lệnh và trạng thái phản hồi của Penpot, không bao giờ ghi tiêu đề, token hay tệp. Dịch vụ chứng chỉ ghi cài đặt khởi động và cảnh báo cấu hình, cộng với hai dòng đã lược bỏ thông tin khi thất bại: mã trạng thái gửi thất bại không có địa chỉ bên nhận và một dòng báo thất bại cố định không có văn bản lỗi, dấu vết ngăn xếp hay URL, vì lỗi nhà cung cấp có thể mang giá trị danh tính hoặc thông tin xác thực. Mọi thứ khác trong nhật ký đến từ nền tảng lưu trữ.

Với lolly.tools, quản trị viên phiên bản kiểm soát ghi nhật ký yêu cầu, luân chuyển và lưu giữ trên UpCloud. Trang này không nêu thời hạn lưu giữ nhật ký tối đa chưa được xác minh. Liên hệ bên kiểm soát bên dưới để biết lịch hiện tại và gửi mọi yêu cầu về nhật ký được giữ trên máy chủ. Với phiên bản khác, áp dụng cài đặt của đơn vị vận hành, bao gồm mọi bản xuất nhật ký hoặc bên xử lý khác.

<!--i:eti-stamp-->
## Cơ sở pháp lý, lưu giữ và bên nhận

Bảng này áp dụng cho bản triển khai tham chiếu **lolly.tools**. Nó không nêu cơ sở pháp lý hoặc thời hạn lưu giữ của phiên bản Lolly Work của tổ chức bạn; đơn vị vận hành cung cấp những thông tin đó trong chính sách riêng.

| Xử lý | Cơ sở pháp lý (GDPR Art. 6) | Thời gian lưu giữ |
|---|---|---|
| Mọi thứ trên thiết bị của bạn (tài liệu, tùy chọn, bộ nhớ đệm, bộ đếm) | **Hoàn toàn không phải việc xử lý của chúng tôi**: dữ liệu không bao giờ tới chúng tôi. Lưu trữ trên thiết bị của bạn là thực sự cần thiết cho dịch vụ bạn yêu cầu (ePrivacy Art. 5(3)), nên không cần sự đồng ý | Cho đến khi bạn xóa |
| Địa chỉ email của bạn trong quá trình đăng ký Content Credentials qua dịch vụ lưu trữ cũ | **Art. 6(1)(b)**, thực hiện dịch vụ bạn đã yêu cầu rõ ràng | Dịch vụ cũ không có danh mục danh tính hay nhật ký cấp; email được dùng trong yêu cầu và đưa vào chứng chỉ của bạn. Việc lưu giữ PKI, kiểm toán và thu hồi do tổ chức quản lý tuân theo chính sách của đơn vị vận hành |
| Mã băm SHA-256 định danh giả được tạo từ địa chỉ IP của bạn, để giới hạn tần suất các điểm cuối đăng nhập và các điểm cuối kết xuất, ảnh và MCP công khai | **Art. 6(1)(f)**, lợi ích chính đáng của chúng tôi trong việc ngăn lạm dụng dịch vụ miễn phí và hạn mức email của bên thứ ba. Chúng tôi cho rằng việc này đạt yêu cầu đánh giá cân bằng vì địa chỉ gốc không được gửi tới bộ giới hạn, mã băm chỉ dùng để kiểm soát lạm dụng và tự hết hạn | Khoảng một phút trong kho kiểm soát lạm dụng; không giữ sau đó |
| Nhật ký truy cập lưu trữ (IP, đường dẫn, dấu thời gian, user agent) | **Art. 6(1)(f)**, lợi ích chính đáng của chúng tôi về bảo mật dịch vụ, ngăn lạm dụng và chẩn đoán lỗi | Luân chuyển và lưu giữ do quản trị viên cấu hình; liên hệ bên kiểm soát để biết lịch hiện tại |

**Bên nhận.** Các nhóm bên nhận gồm nhà cung cấp lưu trữ của chúng tôi (UpCloud), nơi lưu trữ cơ sở dữ liệu của ứng dụng và kho kiểm soát lạm dụng, và, chỉ khi bạn dùng tùy chọn đăng nhập bằng email, nhà cung cấp email giao dịch (Resend). Kho kiểm soát lạm dụng chỉ nhận mã băm ngắn hạn, không bao giờ nhận địa chỉ IP gốc. Nếu bạn đăng nhập bằng GitHub, Google hoặc SUSE (id.suse.com), bạn làm việc trực tiếp với nhà cung cấp đó theo chính sách quyền riêng tư của họ, và họ chỉ cho chúng tôi biết địa chỉ email đã xác minh. Chúng tôi không chia sẻ dữ liệu cá nhân với ai khác, không bán dữ liệu, chạy quảng cáo hay lập hồ sơ người dùng.

**Chuyển dữ liệu ra ngoài EEA.** Hạ tầng lưu trữ, cơ sở dữ liệu và vùng lưu trữ tệp của ứng dụng tham chiếu nằm ở Frankfurt. Các nhà cung cấp danh tính, email và tài nguyên tùy chọn có địa điểm và điều khoản xử lý riêng, có thể bao gồm truy cập ngoài EEA, và chỉ riêng khu vực của máy chủ không xác lập khu vực tài phán của mọi bên nhận. Liên hệ bên kiểm soát để biết các thỏa thuận nhà cung cấp và sắp xếp chuyển dữ liệu áp dụng; với phiên bản khác, hỏi đơn vị vận hành. [Các Điều khoản Hợp đồng Tiêu chuẩn](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en) của Ủy ban châu Âu là một biện pháp bảo đảm có thể dùng cho việc chuyển dữ liệu như vậy; trang này không tuyên bố rằng thỏa thuận nhà cung cấp chưa được xác minh có dùng chúng.

**Ra quyết định tự động.** Không có. Không có lập hồ sơ hay quyết định tự động gây hiệu lực pháp lý hoặc tác động đáng kể tương tự (Art. 22).

<!--i:eti-smile-->
## Quyền riêng tư của trẻ em

Việc dùng ứng dụng cục bộ thông thường không gửi nội dung cá nhân tới lolly.tools. Việc đăng ký Content Credentials tùy chọn nhận địa chỉ email và không hướng tới hay dành cho trẻ em. Dịch vụ tổ chức có tài khoản và cách xử lý dữ liệu riêng, theo chính sách của đơn vị vận hành.

<!--i:eti-user-check-->
## Quyền của bạn

Với các bản ghi chỉ lưu trên thiết bị của bạn, bạn có thể tự truy cập, sửa, xóa và chuyển dữ liệu. Dữ liệu nằm trong vùng lưu trữ của trình duyệt hoặc ứng dụng, ở dạng bạn có thể kiểm tra, xuất (**Export my data**, ở trên) hoặc xóa (**Clear all my data**, hoặc dữ liệu trang web của trình duyệt).

Về mặt pháp lý, theo GDPR Articles 15-22, bạn có quyền **truy cập** dữ liệu cá nhân của mình, **đính chính**, **xóa**, **hạn chế** hoặc **phản đối** việc xử lý dữ liệu (bao gồm mọi việc chúng tôi dựa trên lợi ích chính đáng), quyền **chuyển dữ liệu** và, khi việc xử lý dựa trên sự đồng ý, quyền **rút lại sự đồng ý đó bất cứ lúc nào**, mà không ảnh hưởng đến tính hợp pháp của những gì đã diễn ra trước khi bạn rút lại sự đồng ý.

Dịch vụ chứng chỉ công khai không giữ nhật ký cấp. Nhật ký hạ tầng có thể chứa thông tin yêu cầu, nên chính sách này không hứa rằng môi trường lưu trữ không giữ dữ liệu cá nhân. Liên hệ bên kiểm soát để yêu cầu truy cập, xóa hoặc yêu cầu khác về các bản ghi đó; chúng tôi sẽ giải thích những bản ghi nào tồn tại và có thể làm gì. Với công việc, danh tính, dữ liệu đo lường và bản ghi kiểm toán do tổ chức giữ, hãy liên hệ đơn vị vận hành Lolly Work của bạn, vì các điều khiển xuất và xóa cục bộ không tác động tới các bản sao đó.

**Bạn có quyền khiếu nại.** Nếu cho rằng chúng tôi đã xử lý dữ liệu của bạn không đúng cách, bạn có thể khiếu nại với cơ quan giám sát bảo vệ dữ liệu: trong EU, cơ quan tại quốc gia bạn cư trú, nơi làm việc hoặc nơi bạn cho rằng vi phạm đã xảy ra (Art. 77). Cơ quan giám sát chính của chúng tôi là *Bayerisches Landesamt für Datenschutzaufsicht* (BayLDA) tại Ansbach, Đức. Bạn không cần liên hệ chúng tôi trước, dù chúng tôi mong có cơ hội khắc phục vấn đề.

<!--i:eti-history-->
## Thay đổi chính sách này

Ngày ở đầu trang thay đổi mỗi khi tài liệu này thay đổi. Thay đổi làm khác đi những gì rời thiết bị của bạn hoặc những gì được giữ lại sẽ có dòng riêng ở đây thay vì chỉnh sửa âm thầm. Để xem điều gì đã thay đổi, hãy hỏi (bên dưới) hoặc so sánh với [nguồn công khai](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

::: details Các thay đổi trước đó, từ 29 tháng 9 đến 23 tháng 10 năm 2026
**29 tháng 9 năm 2026:** làm rõ dịch vụ lolly.work tùy chọn, nội dung do tổ chức giữ, cookie xác thực, dữ liệu đo lường sử dụng và bản ghi kiểm toán của dịch vụ, cùng sự tách biệt giữa xóa cục bộ và lưu giữ trên máy chủ. Đây là các quy trình tùy chọn hiện có, không phải yêu cầu tải lên mới cho việc chỉnh sửa cục bộ.

**11 tháng 10 năm 2026:** thay mô tả lưu trữ Vercel đã ngừng dùng bằng danh sách tên máy chủ ứng dụng UpCloud, phân biệt các nhà cung cấp danh tính và tài nguyên tùy chọn, và mô tả phân phối theo địa chỉ nội dung cùng chế độ tải xuống MCP có lưu giữ. Thay đổi này không bật CDN bên thứ ba nào. Việc lưu giữ nhật ký do quản trị viên kiểm soát thay vì theo mức mặc định của gói Vercel được nêu trước đó.

**22 tháng 10 năm 2026:** sửa mô tả hành vi hiện có. Phần tiện ích mở rộng trình duyệt hiện bao gồm cửa sổ phê duyệt cho mọi yêu cầu, quyền truy cập trang web được xin cho từng trang và việc lấy biểu định kiểu, biểu tượng khi đọc trang web. Cũng đã sửa: các hàng Send to Google Drive và Meeting Planner, ghi chú SEAL (không ứng dụng Lolly nào tra cứu khóa SEAL trong DNS), mức đo lường sử dụng mặc định của dịch vụ tổ chức, các công cụ ảnh MCP và việc ghi nhật ký ứng dụng của các dịch vụ công khai. Bản thân phần mềm không thay đổi.

**23 tháng 10 năm 2026:** sắp xếp lại chính sách theo điều gì khởi động từng yêu cầu, và mô tả hành vi hiện có chưa được đề cập trước đây: lời mời cộng tác riêng mang địa chỉ mạng cục bộ, Nearby trong ứng dụng máy tính, Allow AI control, đọc hệ thống thiết kế từ trang web, bộ emoji, bộ nhớ đệm tra cứu thành phố trên thiết bị của Meeting Planner, Thùng rác và các bản ghi khác được liệt kê trong Settings → Storage. Sửa hai tuyên bố: Bluesky và Discord không chỉ có trên máy tính, và mọi máy chủ mà một người chọn để gửi đều cần được đơn vị vận hành phê duyệt trong cả ứng dụng web và máy tính; mã băm địa chỉ IP dùng để giới hạn tần suất là định danh giả, không phải ẩn danh. Bản thân phần mềm không thay đổi.
:::

**3 tháng 11 năm 2026:** thêm liên kết chia sẻ sau Send. Khi bạn nhấn Create a share link, Lolly thực hiện thêm một lệnh gọi tới nhà cung cấp mà bạn đã gửi tệp tới (Google Drive, Dropbox, OneDrive hoặc Nextcloud của bạn), và Stop sharing thực hiện lệnh gọi khác để tắt liên kết. Liên kết chia sẻ S3 được tạo trên thiết bị của bạn và không gửi gì đi. Không có máy chủ mới nào tham gia, và Lolly không giữ bản sao của bất kỳ liên kết hay token nào trên máy chủ.

**3 tháng 11 năm 2026:** thêm **Ask an agent** trong ứng dụng máy tính: những gì ứng dụng tìm trên máy tính khi bảng mở và những gì được gửi tới nhà cung cấp tác tử khi bạn hỏi, bằng tài khoản của chính bạn với nhà cung cấp đó.

**10 tháng 11 năm 2026:** hoàn thiện và sửa mô tả hành vi hiện có. Danh sách trên thiết bị hiện nêu thông tin hồ sơ, danh tính ký, thông tin đăng nhập và liên kết chia sẻ được giữ lại, câu trả lời cho câu hỏi một lần, các lần tải xuống gần đây, bản ghi của phiên bản đã kết nối, tệp đang làm việc trong vùng lưu trữ tệp của trình duyệt và những gì các trang tài liệu giữ. Đã sửa: bộ đếm sử dụng cục bộ đi trong tệp sao lưu và bản sao Sync của chính bạn; Clear all my data không kết thúc phiên đăng nhập tổ chức; Thùng rác xóa các mục cũ hơn 30 ngày vào lần tiếp theo bạn mở Projects; kết nối Google Drive được ghi nhớ trên web có nhãn là địa chỉ email tài khoản Google của bạn; các ứng dụng của chính Lolly không gửi sự kiện sử dụng nào tới phiên bản Lolly Work. Cũng mô tả dòng quyền riêng tư của không gian làm việc mà 1.2.0 thêm vào và các trang thương hiệu xuất bản tới một phiên bản. Ngoài dòng quyền riêng tư đó, bản thân phần mềm không thay đổi.

**10 tháng 11 năm 2026:** thêm kiểm tra bản phát hành Lolly Work: máy chủ Lolly Work đọc chỉ mục chart đã công bố mỗi ngày một lần để báo cho quản trị viên về bản phát hành mới hơn. Yêu cầu không mang thông tin gì về phiên bản hay người dùng của nó, và quản trị viên có thể tắt hoặc trỏ tới bản sao mirror.

<!--i:eti-mail-->
## Ai chịu trách nhiệm và cách liên hệ với chúng tôi

Với lolly.tools, **bên kiểm soát dữ liệu** là:

> SUSE Software Solutions Germany GmbH
>
> Frankenstraße 146
>
> 90461 Nürnberg
>
> Đức

SUSE đã bổ nhiệm **Cán bộ Bảo vệ Dữ liệu**, có thể liên hệ tại [privacy@suse.com](mailto:privacy@suse.com). Dùng địa chỉ đó cho mọi yêu cầu chính thức theo phần "Quyền của bạn" ở trên.

Với mọi việc về bản thân Lolly, như cách nó hoạt động, lý do một thứ được thiết kế như vậy hoặc sửa nội dung tài liệu này, hãy liên hệ **Andy Fitzsimon**, [fitzy@suse.com](mailto:fitzy@suse.com).

Với phiên bản Lolly tự lưu trữ hoặc dành cho doanh nghiệp, thay vào đó hãy liên hệ bên vận hành: đơn vị vận hành là bên kiểm soát cho bản triển khai của chính họ. SUSE và dự án nguồn mở Lolly không giữ dữ liệu cho các bản triển khai mà họ không vận hành.
