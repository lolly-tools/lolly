# Ask Lolly

Gõ một câu hỏi và Ask Lolly trả lời bằng phần của các hướng dẫn này đề cập đến nó, nguyên văn, kèm trang nguồn được trích dẫn và liên kết **Open in docs** thẳng tới phần đó. Không có gì được sinh ra: câu trả lời được truy xuất, trích dẫn và ghi nguồn, ngay trên thiết bị của bạn.

Dưới phần được trích là những nơi trong ứng dụng khớp với cùng câu hỏi: một công cụ, một tiện ích, một dự án đã lưu, một tài nguyên danh mục, một cài đặt hoặc một trang của ứng dụng. Mỗi hàng chỉ điều hướng. Không có gì trong câu trả lời đổi cài đặt, mở tệp hay hành động thay bạn, cùng quy tắc mà [Search](/info/search.html) tuân theo.

## Đặt câu hỏi

Gõ vào ô câu hỏi ở chân màn hình và nhấn Enter. Mọi thứ ngắn hơn hai ký tự bị bỏ qua. Các câu trả lời xếp chồng phía trên ô, mới nhất ở cuối, và bạn có thể tiếp tục hỏi.

![Ask Lolly, đang mở và trống: ô câu hỏi ở chân màn hình, kèm ghi chú rằng câu trả lời đến từ tài liệu](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

Mỗi câu hỏi được trả lời riêng: các câu hỏi trước không mang ngữ cảnh tiếp, nên "còn PDF thì sao?" sau một câu hỏi về xuất được hiểu là câu hỏi về PDF và không gì khác. Hãy hỏi trọn câu hỏi mỗi lần.

Từ đầu tiên trong câu hỏi quyết định điều gì dẫn đầu câu trả lời:

| Bạn bắt đầu bằng | Điều dẫn đầu |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *goto*, *take*, *jump*, *navigate*, *switch* | các nơi trong ứng dụng khớp |
| *make*, *create*, *generate*, *build*, *design*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | các công cụ khớp |
| bất cứ gì khác - kể cả *how do I* và *what is* | phần tài liệu, là mặc định |

Cả hai nửa luôn được truy xuất, nên hiểu sai một câu hỏi chỉ sắp xếp lại câu trả lời thay vì mất một nửa.

Việc khớp bỏ các từ hỏi thông dụng (*how*, *do*, *I*, *the*, *my*) và xếp hạng một phần theo số từ còn lại của bạn mà nó bao phủ, rồi theo nơi chúng khớp: đề mục có trọng lượng hơn văn bản. Việc khớp theo chuỗi con, bỏ qua hoa thường và dấu, nên lỗi chính tả không được sửa. Khi không gì khớp, Ask nói vậy và chỉ tới mục lục tài liệu thay vì bịa ra câu trả lời.

**Better matching** là tùy chọn. Sau câu trả lời đầu tiên, Ask có thể đề xuất một mô hình khớp nhỏ, kèm dung lượng tải, giúp khớp câu hỏi với hướng dẫn dùng từ khác cho cùng một thứ. Nó chỉ tải khi bạn đồng ý, chạy trên thiết bị này và chỉ đổi phần nào xếp hạng đầu: câu trả lời vẫn là lời của chính tài liệu. Bạn cũng có thể tải nó từ **Settings → Preferences → Available offline**, nơi nó được liệt kê là **Ask matching model** ([Available offline](/info/dashboard.html#available-offline)).

## Những gì trả về

Một thẻ trả lời được lắp theo thứ tự cố định:

1. **Chính phần đó**, kết xuất từ nguồn tài liệu - đoạn văn, danh sách, bảng, mã và trích dẫn, với các liên kết trong ứng dụng và `/info` hoạt động. Một phần dài bị cắt bằng **Show more** mở nó tại chỗ. Ảnh bị bỏ, và liên kết ra trang khác hiện dưới dạng văn bản thường thay vì liên kết.
2. **Trích dẫn** - *Trang › Đề mục* - và liên kết **Open in docs** tới đúng phần đó.
3. **More in the docs** - tối đa bốn phần khác khớp, dưới dạng liên kết.
4. **Các hàng trong ứng dụng**, dưới cùng các đề mục nhóm mà Search dùng.

Toàn văn đến từ bản markdown thuần mà mỗi trang tài liệu xuất bản tại `/info/<slug>.md`, và các bản đó chỉ có tiếng Anh. Ở ngôn ngữ khác - và trên một số ít trang không dựng từ markdown - câu trả lời dùng đoạn trích ngắn có trong chỉ mục tìm kiếm thay vì cả phần. Trích dẫn và liên kết **Open in docs** vẫn có ở cả hai trường hợp, trỏ tới trang bằng ngôn ngữ của bạn.

## Nó ở đâu

Tuyến là `#/ask`. Nó không có thẻ và không có ô trong lưới Utilities; các lối vào là thanh tìm kiếm và chính địa chỉ.

- <!--i:search--> **Từ tìm kiếm.** Mọi bảng kết quả có một hàng **Ask Lolly: *your query*** ở tận cùng, dưới bất kỳ kết quả cụ thể nào mà các nhóm khác tìm thấy. Nó chuyển câu hỏi sang dưới dạng `#/ask?q=…`, và màn hình hỏi câu đó một lần khi đến. Các từ được chuyển sang đến ở dạng chữ thường, bỏ dấu câu, nên hãy chỉnh lại trong ô câu hỏi nếu cần.
- <!--i:link--> **Từ một liên kết.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` mở màn hình với câu hỏi đó đã được hỏi sẵn. Hash chỉ là hạt giống đầu vào: các câu hỏi bạn gõ sau đó được trả lời tại chỗ và không bao giờ viết lại địa chỉ.

Thanh tìm kiếm nhường chỗ trong màn hình này, vì ô câu hỏi nhận Enter, và viên thuốc quay lại đưa bạn về nơi bạn đến.

Các câu trả lời trên màn hình tồn tại trong phiên này: chúng vẫn còn nếu bạn rời đi rồi quay lại, và tải lại sẽ xóa chúng. Không có gì được ghi vào bộ nhớ, nên không có lịch sử để quản lý.

## Ngoại tuyến

Câu trả lời được lắp từ hai tệp tĩnh mà trang tài liệu vốn đã xuất bản: chỉ mục tìm kiếm theo ngôn ngữ và bản markdown của trang. Cả hai được tải theo tên, nên Ask tiếp tục hoạt động không cần kết nối khi chúng đã được lưu đệm. Đọc hướng dẫn trong ứng dụng lưu đệm chúng dần dần, và **Guides & docs** dưới [Available offline](/info/dashboard.html#available-offline) lấy cả site, kể cả ảnh chụp màn hình, trong một lần tải.

Không có chúng, nửa tài liệu của câu trả lời đơn giản là không xuất hiện, không có lỗi. Các hàng trong ứng dụng vẫn có, vì chúng được khớp với dữ liệu đã có trên thiết bị.

## Quyền riêng tư

Câu hỏi của bạn không bao giờ rời thiết bị. Việc khớp chạy cục bộ trên các tệp tải theo tên, nên những gì bạn gõ không là một phần của yêu cầu nào; không máy chủ nào thấy nó, không tài khoản nào gắn với nó và không có bản ghi nào sau khi bạn tải lại. Xem [Privacy Policy](/info/privacy.html) để có danh sách đầy đủ những gì ứng dụng từng tải hoặc gửi.

---

**Liên quan:** [Search](/info/search.html) cho thanh chuyển câu hỏi sang. [Using Lolly](/info/using.html) cho phần còn lại của ứng dụng. [Settings](/info/dashboard.html#available-offline) để đưa tài liệu ngoại tuyến trước.
