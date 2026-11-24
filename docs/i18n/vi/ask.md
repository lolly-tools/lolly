# Ask Lolly

Ask Lolly trả lời câu hỏi bằng phần phù hợp trong các hướng dẫn này, trích nguyên văn, dẫn nguồn trang và kèm liên kết **Open in docs** tới phần đó. Không có nội dung nào được tạo mới: câu trả lời được tìm và trích trên thiết bị của bạn.

Bên dưới phần được trích là những nơi trong ứng dụng khớp với câu hỏi: công cụ, tiện ích, dự án đã lưu, tài nguyên trong danh mục, cài đặt hoặc trang của ứng dụng. Mỗi hàng chỉ điều hướng. Không có gì trong câu trả lời thay đổi cài đặt, mở tệp hoặc hành động thay bạn, cùng quy tắc với [Lolly Search](/info/search.html).

<!--i:eti-chat-->
## Đặt câu hỏi

Gõ vào ô câu hỏi ở cuối chế độ xem và nhấn Enter. Nội dung ngắn hơn hai ký tự bị bỏ qua. Câu trả lời xếp phía trên ô, mới nhất ở cuối.

![Ask Lolly đang mở và trống: ô câu hỏi ở cuối chế độ xem, kèm ghi chú rằng câu trả lời lấy từ tài liệu](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

::: note Mỗi câu hỏi đứng riêng
Câu hỏi trước không truyền ngữ cảnh sang câu sau, nên "còn PDF thì sao?" sau câu hỏi về xuất tệp được hiểu là câu hỏi chỉ về PDF. Hãy đặt câu hỏi đầy đủ mỗi lần.
:::

Từ đầu tiên trong câu hỏi quyết định phần nào đứng đầu câu trả lời:

| Bạn bắt đầu bằng | Phần đứng đầu |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *goto*, *take*, *jump*, *navigate*, *switch* | những nơi trong ứng dụng khớp với câu hỏi |
| *make*, *create*, *generate*, *build*, *design*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | các công cụ khớp với câu hỏi |
| bất cứ từ nào khác - kể cả *how do I* và *what is* | phần tài liệu, là mặc định |

Cả hai phần luôn được truy xuất, nên câu hỏi bị hiểu sai chỉ làm đổi thứ tự câu trả lời.

Việc tìm phần khớp bỏ qua các từ thường gặp trong câu hỏi (*how*, *do*, *I*, *the*, *my*). Nó xếp hạng một phần theo số từ còn lại của bạn mà phần đó chứa, rồi theo vị trí khớp: đề mục được tính cao hơn nội dung. Việc so khớp dựa trên chuỗi con, bỏ qua chữ hoa chữ thường và dấu, nên lỗi gõ không được sửa. Khi không có gì khớp, Ask báo rõ và dẫn tới mục lục tài liệu.

**Better matching** là tùy chọn. Sau câu trả lời đầu tiên, Ask có thể đề xuất một mô hình so khớp nhỏ, kèm dung lượng tải xuống. Mô hình ghép câu hỏi với hướng dẫn dùng các từ khác để nói về cùng một việc. Nó chỉ tải xuống khi bạn đồng ý, chạy trên thiết bị này và chỉ thay đổi phần nào được xếp đầu. Câu trả lời vẫn là câu chữ của chính tài liệu. Bạn cũng có thể tải nó dưới tên **Ask matching model** trong **Settings → Preferences → Available offline** ([Có sẵn ngoại tuyến](/info/dashboard.html#available-offline)).

<!--i:eti-clipboard-->
## Kết quả trả về

Thẻ câu trả lời có thứ tự cố định:

1. **Chính phần nội dung đó**, được kết xuất từ nguồn tài liệu: đoạn văn, danh sách, bảng, mã và trích dẫn, với các liên kết trong ứng dụng và `/info` hoạt động. Phần dài kết thúc bằng **Show more**, mở phần còn lại ngay tại chỗ. Ảnh bị bỏ đi, và liên kết tới trang web khác hiển thị thành văn bản thuần.
2. **Dẫn nguồn** - *Trang › Đề mục* - và liên kết **Open in docs** tới đúng phần đó.
3. **More in the docs** - tối đa bốn phần khác khớp với câu hỏi, dưới dạng liên kết.
4. **Các hàng trong ứng dụng**, dưới cùng các đề mục nhóm mà Search dùng.

Toàn văn lấy từ bản Markdown tương ứng mà mỗi trang tài liệu xuất bản tại `/info/<slug>.md`. Các bản này chỉ có tiếng Anh. Với ngôn ngữ khác, và trên một số ít trang không được dựng từ Markdown, câu trả lời hiển thị đoạn trích ngắn từ chỉ mục tìm kiếm thay thế. Dẫn nguồn và liên kết **Open in docs** vẫn trỏ tới trang bằng ngôn ngữ của bạn.

<!--i:eti-map-pin-->
## Vị trí

Đường dẫn là `#/ask`. Nó không có thẻ và không có ô trong lưới Utilities. Bạn đến chế độ xem từ thanh tìm kiếm hoặc bằng địa chỉ của nó.

- <!--i:search--> **Từ tìm kiếm.** Mọi bảng kết quả kết thúc bằng một hàng **Ask Lolly: *truy vấn của bạn***, bên dưới kết quả của các nhóm khác. Hàng đó mở `#/ask?q=…`, và chế độ xem đặt câu hỏi một lần khi mở. Các từ được chuyển sang dạng chữ thường không có dấu câu, nên hãy chỉnh lại trong ô câu hỏi nếu cần.
- <!--i:link--> **Từ liên kết.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` mở chế độ xem với câu hỏi đó đã được đặt. Phần hash chỉ cung cấp câu hỏi đầu tiên. Câu hỏi bạn gõ sau đó được trả lời tại chỗ và không bao giờ đổi địa chỉ.

Thanh tìm kiếm ẩn trong chế độ xem này vì ô câu hỏi nhận phím Enter. Nút quay lại dạng viên thuốc đưa bạn về nơi vừa đến.

Câu trả lời được giữ trong phiên này: chúng vẫn còn nếu bạn rời đi rồi quay lại, và tải lại sẽ xóa chúng. Không có gì được ghi vào bộ nhớ lưu trữ, nên không có lịch sử cần quản lý.

<!--i:eti-download-->
## Ngoại tuyến

Câu trả lời lấy từ hai tệp tĩnh mà trang tài liệu xuất bản: chỉ mục tìm kiếm theo ngôn ngữ và bản Markdown tương ứng của trang. Cả hai được tải theo tên, nên Ask hoạt động khi không có kết nối sau khi chúng được lưu vào bộ nhớ đệm. Đọc hướng dẫn trong ứng dụng sẽ lưu chúng vào bộ nhớ đệm. **Guides & docs** trong [Có sẵn ngoại tuyến](/info/dashboard.html#available-offline) tải toàn bộ trang web, kể cả ảnh chụp màn hình, trong một lần.

Không có các tệp này thì phần tài liệu trong câu trả lời không xuất hiện, và không có lỗi hiển thị. Các hàng trong ứng dụng vẫn xuất hiện, vì chúng so khớp với dữ liệu đã có trên thiết bị.

<!--i:eti-lock-->
## Quyền riêng tư

Câu hỏi của bạn không bao giờ rời thiết bị. Việc so khớp chạy cục bộ trên các tệp được tải theo tên, nên những gì bạn gõ không nằm trong bất kỳ yêu cầu nào. Không máy chủ nào thấy câu hỏi, không tài khoản nào giữ nó và không bản ghi nào còn lại sau khi bạn tải lại. [Chính sách quyền riêng tư](/info/privacy.html) liệt kê mọi thứ ứng dụng tải về hoặc gửi đi.

---

**Liên quan:** [Lolly Search](/info/search.html) nói về thanh chuyển câu hỏi sang đây. [Sử dụng Lolly](/info/using.html) nói về phần còn lại của ứng dụng. [Cài đặt Lolly](/info/dashboard.html#available-offline) nói về việc tải tài liệu để dùng ngoại tuyến trước.
