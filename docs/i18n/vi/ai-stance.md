# Quan điểm của chúng tôi về AI

Lolly được xây dựng giữa thay đổi lớn nhất trong cách tạo nội dung truyền thông kể từ máy in, bởi những người không hoảng loạn về AI cũng không quá phấn khích trước công nghệ. Đây là quan điểm của dự án, cùng cơ chế đằng sau mỗi cam kết, để bạn có thể kiểm chứng thay vì chỉ tin.

> "Chúng ta đang uống như thể vòi nước sẽ cạn bất cứ lúc nào. Nó sẽ không cạn - AI hôm nay là phiên bản tệ nhất từ nay về sau. Nếu chúng ta sống sót qua trận lũ, đó sẽ không phải nhờ tích trữ những gì trong bồn nước gỉ sét dưới chân đồi, đầy cặn lắng. Mà nhờ tưới tiêu và cải tạo đất của ***chúng ta*** cho một tương lai thịnh vượng."
>
> - Andy Fitzsimon, Người đóng góp cho Lolly

![Một cơn bão siêu tế bào ập xuống trang trại ở vùng hẻo lánh của Úc - bồn nước và nhà kho bên dưới, nước lũ đã xẻ thành dòng qua đồng cỏ khô](/info/the-flood.webp)

%file{Gemini_Generated_Image_vmy7thvmy7thvmy7.png} %entity{Gemini} tạo ảnh %sig{signed by %entity{Google LLC}} %entity{Lolly} %act{opened}, %act{watermarked} và %act{exported to WebP} dưới dạng %file{the-flood.webp} %detail{10.6 MB down to 0.8 MB} %sig{signed by %entity{Lolly}} [Xác minh ngay](/#/verify?src=%2Finfo%2Fthe-flood.webp)

Nói cho chính xác, vì trang này lập luận rằng độ chính xác quan trọng: ảnh bên trên được tạo ra, không phải được chụp. Không máy ảnh nào hướng vào trang trại đó, vì không có trang trại nào. Nó mô tả vùng Queensland, Úc, với lời nhắc được nhập từ Vương quốc Anh, được tạo trong một trung tâm dữ liệu ở Hoa Kỳ. Nó cố gắng thể hiện trung thực một nơi mà không phải bản ghi về nơi đó, và chính sự khác biệt ấy là toàn bộ lý do ảnh mang Content Credentials.

Đây là những gì bạn thấy khi kiểm tra tệp. Chín bước còn lại trong tệp: năm bước do Google ghi nhận khi tạo và thêm hình mờ vào ảnh, rồi bốn bước do Lolly ghi nhận khi mở, tạo, đánh dấu và chuyển đổi phiên bản trên trang này. Lolly không tạo sinh bất cứ thứ gì, và mục ghi của nó nói rõ điều đó.

![Lịch sử thay đổi mà Lolly đọc lại từ tệp hoàn chỉnh - năm bước do Google ghi nhận, rồi bốn bước do Lolly ghi nhận, kết thúc bằng WebP trên trang này](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Trong hình ảnh Andy đưa ra, thái độ khan hiếm đối với AI là uống nước hỏng trong bồn trong khi nước lũ tràn qua đồng bằng. Nội dung được tạo sinh sắp trở nên gần như vô hạn. Khi một thứ trở nên vô hạn, giá trị của nó chuyển sang những gì vẫn khan hiếm quanh nó: niềm tin, nguồn gốc, tính nhất quán thương hiệu và khả năng phán đoán của con người. Lolly không phải chiếc xô lớn hơn để hứng lũ. Nó là hệ thống tưới tiêu: những kênh dẫn nước và đất nơi cây cối thực sự mọc lên.

<!--i:eti-checklist-->
## Quan điểm qua năm cam kết

- <!--i:layers--> **AI được chào đón làm đầu vào, không bao giờ để mạo danh.** Tác nhân là người dùng được hỗ trợ đầy đủ của Lolly: chúng chạy cùng công cụ mà con người dùng, qua [máy chủ MCP](/info/mcp.html) và [chế độ URL](/info/url-mode.html), trong đúng những ràng buộc đó. Không tác nhân nào được phép trình bày đầu ra của mình như thứ khác với bản chất của nó. [Đầu vào, không mạo danh](/info/input-not-impersonation.html) vạch ra ranh giới đó.
- <!--i:shieldcheck--> **AI tự khai báo.** Khi AI tạo các điểm ảnh, bản xuất nói rõ điều đó: một khai báo máy đọc được trong Content Credentials của tệp và huy hiệu GEN AI hiện rõ khi bất kỳ ai xác minh tệp. Khi nội dung truyền thông bạn đã khai báo là do AI tạo được đặt vào thiết kế, chứng thực của chính bản xuất cũng nói rõ điều đó: dấu nguồn gốc tổng hợp và công bố AI có chữ ký, máy đọc được. Lolly cũng đọc và hiển thị khai báo AI của tệp được tạo ở nơi khác, và báo khi có khả năng xuất hiện hình mờ SynthID, bằng cách đọc khai báo, không phải chính hình mờ. Cùng quy tắc đó ràng buộc trình viết lại chạy trên thiết bị của Lolly: mỗi câu nó viết mang một hình mờ thống kê công khai trong cách chọn từ, được công bố ở đây và trong công cụ, để văn bản do mô hình viết vẫn tự khai báo ngay cả ở dạng bản sao văn bản thuần, và bất kỳ ai cũng có thể kiểm tra văn bản đó trong [Lolly Verify](/#/verify) ([cách kiểm tra hoạt động](/info/what-verify-checks.html#text-reworded-by-lolly)). Phương pháp này được thiết kế để công khai: ai cũng có thể xác minh, không ai nắm bí mật. Người tiếp nhận xứng đáng được biết nội dung truyền thông được tạo như thế nào.
- <!--i:check--> **Nguồn gốc được bật theo mặc định.** Bản xuất mang [Content Credentials](/info/content-credentials-identity.html) theo mặc định, không phải dưới dạng cài đặt bị giấu sâu. Chuỗi này bao quát chỉnh sửa và thành phần đầu vào, nên lịch sử tác phẩm đi cùng tác phẩm. Bạn có thể [tự kiểm chứng](/info/verify-yourself.html) trên bất kỳ tệp nào Lolly tạo ra.
- <!--i:people--> **Con người vẫn là tác giả.** Câu chữ, hình ảnh, bảng màu, quyết định cần sự phán đoán: công cụ mở rộng khả năng áp dụng phán đoán đó và không bao giờ thay thế con người. Những phần tẻ nhạt được tự động hóa: kiểm tra thương hiệu, xuất lại ở mọi kích thước, bản địa hóa thủ công. Điều còn lại là vai trò tác giả.
- <!--i:globe--> **Kênh dẫn, không phải xô chứa.** Mô hình hôm nay là mức sàn, không phải mức trần, nên chúng tôi từ chối xây dựng bất cứ thứ gì có giá trị phụ thuộc vào việc độc chiếm quyền truy cập chúng. Bộ máy là mã nguồn mở, kết xuất trên thiết bị của bạn và hoạt động ngoại tuyến. Không có lợi thế độc quyền nhờ mô hình, bộ đếm mức sử dụng hay việc kinh doanh dựa trên sự khan hiếm gắn với chính dòng lũ. Khoản đầu tư bền vững là hạ tầng quanh dòng nước - và hạ tầng đó là thứ chúng tôi cho đi.

<!--i:eti-user-check-->
## Quyết định của con người là trọng tâm

Mỗi cá nhân định hình trái đất và lịch sử của chúng ta. Những lựa chọn của họ, được đưa ra từng lần một, trở thành thế giới mà tất cả những người còn lại sống trong đó. Hành động của họ tạo nên thế giới ấy. Mọi điều từ trước đến nay đều diễn ra như vậy.

Vì vậy chúng tôi trao quyền cho quyết định của con người và không bao giờ thỏa hiệp về điều đó. Quyền lựa chọn. Quyền tự quyết. Sự tự chủ. Khả năng quyết định và hành động, và để hành động đó là của bạn.

Các công cụ ở đây nhân rộng những gì một người đã quyết định và không bao giờ âm thầm quyết định thay họ. Khi một quyết định được thực hiện qua tự động hóa, bản ghi vẫn dẫn về người đã khởi động nó, dù trên đường đã đi qua bao nhiêu hệ thống và bước ngoặt.

Chúng tôi tôn trọng điều đó từ đầu đến cuối và ghi lại: vì lịch sử, vì trách nhiệm giải trình, vì lòng tin và vì ngày mai.

<!--i:eti-sliders-->
## AI, theo ý bạn

Bạn không bao giờ cần AI ở đây. Nếu bạn chọn dùng, ba điều này luôn đúng:

- <!--i:people--> **Bạn nắm quyền kiểm soát.** AI chỉ giúp khi bạn yêu cầu và chỉ với phần bạn chỉ định. Không có gì được quyết định thay bạn.
- <!--i:check--> **Chi phí dừng lại.** Nếu AI giúp tạo ra thứ gì đó một lần, kết quả thuộc về bạn. Dùng lại hoàn toàn miễn phí, dù bạn cần kết quả đó bao nhiêu lần.
- <!--i:shieldcheck--> **Luôn trung thực.** Một tác phẩm do AI tạo ra sẽ ghi rõ điều đó, và những gì bạn tạo mang tên bạn thay vì giả làm người khác. Ngay cả trợ giúp tích hợp cũng hoạt động như vậy: [Ask Lolly](/info/ask.html) trả lời bằng câu trong chính hướng dẫn cùng một liên kết, không bao giờ bịa câu trả lời.

<!--i:eti-info-->
## Đây không phải là gì

- <!--i:check--> **Không phải lệnh cấm.** Công cụ có thể dùng AI khi nó phục vụ công việc, và tác tử là một nhóm người dùng được hỗ trợ - xem [Tác tử AI](/info/ai-agents.html).
- <!--i:seal--> **Không phải tuyên bố về sự thuần khiết.** Lolly đọc thông tin nguồn gốc trên phạm vi rộng và ghi lại trung thực; nó không giả vờ phát hiện được mọi điểm ảnh được tạo sinh trên internet.
- <!--i:sunburst--> **Không phải sự hoảng loạn về đạo đức.** Dòng lũ không phải kẻ thù. Nước không rõ nguồn mới là vấn đề.

<!--i:eti-search-->
## Tự kiểm tra những cam kết này

Mọi cam kết trên đều được thực thi trong mã nguồn mở, không phải trong một PDF chính sách: quy trình nguồn gốc, việc gắn nhãn GEN AI và cam kết không có trình theo dõi đều đi kèm kiểm thử, và trang [Tự xác minh](/info/verify-yourself.html) hướng dẫn bạn kiểm tra các tuyên bố bằng một bản xuất thật.
