# Lập trường của chúng tôi về AI

Lolly được xây dựng giữa lòng thay đổi lớn nhất trong cách nội dung truyền thông được tạo ra kể từ khi máy in ra đời, bởi những người không hoảng loạn vì AI cũng không cuồng nhiệt về nó. Trang này nêu rõ lập trường của dự án và đi kèm mỗi tuyên bố với cơ chế thực thi nó, để bạn có thể xác minh thay vì chỉ tin tưởng.

> "Chúng ta đang uống nước như thể vòi sắp cạn bất cứ lúc nào. Nó sẽ không cạn - AI hôm nay là phiên bản tệ nhất mà nó từng có. Nếu chúng ta vượt qua được trận lũ, đó sẽ không phải nhờ tích trữ những gì trong bồn nước gỉ sét dưới chân đồi, đầy cặn bẩn. Đó sẽ là nhờ dẫn nước tưới tiêu và khai khẩn lại mảnh đất ***của chúng ta*** cho một tương lai thịnh vượng."
>
> - Andy Fitzsimon, Người đóng góp cho Lolly

![Một cơn bão siêu tế bào ập xuống trang trại vùng hẻo lánh - bồn nước và các nhà kho phía dưới, nước lũ đã bắt đầu khoét thành các rãnh chảy qua cánh đồng khô hạn](/info/the-flood.webp)

%file{Gemini_Generated_Image_vmy7thvmy7thvmy7.png} %entity{Gemini} tạo hình ảnh %sig{signed by %entity{Google LLC}} %entity{Lolly} %act{opened}, %act{resized} và %act{exported to WebP} thành %file{the-flood.webp} %detail{10.6 MB down to 0.8 MB} %sig{signed by %entity{Lolly}} [Xác minh ngay](/#/verify?src=%2Finfo%2Fthe-flood.webp)

Để nói cho chính xác, vì trang này lập luận rằng độ chính xác quan trọng: hình ảnh ở trên là được tạo ra, không phải được chụp. Không có máy ảnh nào từng chĩa vào trang trại đó, vì không hề có trang trại nào cả. Nó mô tả vùng Queensland, Australia, được yêu cầu (prompt) từ Vương quốc Anh, được tạo ra trong một trung tâm dữ liệu ở Hoa Kỳ. Nó cố gắng trung thực với một địa điểm mà không phải là bản ghi lại địa điểm đó, và sự khác biệt này chính là toàn bộ lý do vì sao Content Credentials của nó nói như vậy.

Đây là những gì bạn sẽ thấy khi kiểm tra nó. Chín bước còn lưu lại trong tệp: năm bước do Google ghi lại khi tạo và đóng dấu chìm cho hình ảnh, sau đó bốn bước do Lolly ghi lại khi mở, tạo, đánh dấu và chuyển đổi phiên bản trên trang này. Lolly không tạo ra bất cứ điều gì, và mục ghi của nó nói rõ như vậy.

![Lịch sử thay đổi mà Lolly đọc lại được từ tệp hoàn thiện - năm bước do Google ghi lại, sau đó bốn bước do Lolly, kết thúc bằng tệp WebP trên trang này](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Ẩn dụ về trận lũ của Andy là thế này: thái độ khan hiếm đối với AI - dồn tất cả vào số ít, tự làm mình cạn kiệt hôm nay rồi lo sau - giống như uống nước bồn đã hỏng trong khi mưa bắt đầu trút xuống và nước lũ đang lao qua đồng bằng về phía bạn. Nội dung được tạo ra sắp trở nên gần như vô hạn. Khi một thứ gì đó trở nên vô hạn, giá trị của nó chuyển sang bất cứ điều gì vẫn còn khan hiếm xung quanh nó: niềm tin, nguồn gốc xuất xứ, sự nhất quán thương hiệu và sự phán đoán của con người. Lolly không phải là một chiếc thùng to hơn để hứng lũ. Đó là hệ thống tưới tiêu - những con kênh dẫn dòng nước, và mảnh đất nơi mọi thứ thực sự sinh sôi.

## Lập trường, trong năm cam kết

- <!--i:layers--> **AI được chào đón như một đầu vào, không bao giờ như một sự mạo danh.** Các agent là người dùng hạng nhất của Lolly: chúng chạy cùng những công cụ mà con người dùng, thông qua [MCP server](/info/mcp.html) và [URL mode](/info/url-mode.html), bên trong đúng những ràng buộc y hệt. Một công cụ không thể tạo ra một tài sản lệch thương hiệu cho một người thì cũng không thể tạo ra nó cho một agent - các rào chắn không quan tâm ai đang ném quả bóng. Điều mà không agent nào được phép làm là giả mạo đầu ra của mình thành thứ mà nó không phải.
- <!--i:shieldcheck--> **AI tự khai báo chính nó.** Khi AI tạo ra các pixel, bản xuất sẽ nói rõ điều đó: một khẳng định máy có thể đọc được trong Content Credentials của tệp và một huy hiệu GEN AI hiển thị khi bất kỳ ai xác minh nó. Lolly cũng đọc và hiển thị các khai báo AI của những tệp được tạo ở nơi khác, và đánh dấu khi một watermark SynthID có khả năng hiện diện - đọc khai báo, chứ không phải chính watermark. Cùng quy tắc đó ràng buộc cả bộ viết lại (rewriter) trên thiết bị của chính Lolly: mỗi câu nó viết ra đều mang một watermark thống kê công khai trong cách lựa chọn từ ngữ, được công bố ở đây và trong công cụ, để văn bản do một mô hình viết ra vẫn tự khai báo ngay cả khi trở thành một bản sao văn bản thuần túy - và bất kỳ ai cũng có thể kiểm tra điều đó trên trang [Verify](/info/verify-yourself.html). Cơ chế này công khai theo thiết kế: xác minh cho tất cả mọi người, bí mật cho không ai cả. Khán giả xứng đáng được biết phương tiện được tạo ra như thế nào - câu đó xuất hiện trên trang [Inclusive Design](/info/inclusive-design.html) của chúng tôi như một cam kết đạo đức, và đây chính là điều biến nó thành hiện thực. Và khi phương tiện mà bạn đã khai báo là do AI tạo ra được đặt vào trong một thiết kế, chính credential của bản xuất cũng nói rõ điều đó: một dấu nguồn gốc tổng hợp (composite origin mark) và một khai báo AI đã ký, máy có thể đọc được.
- <!--i:check--> **Nguồn gốc (provenance) mặc định được bật.** Các bản xuất mang theo [Content Credentials](/info/content-credentials-identity.html) theo mặc định, không phải như một cài đặt bị chôn giấu. Chuỗi này bao gồm cả các chỉnh sửa và thành phần (ingredient), nên lịch sử của một tác phẩm đi cùng với nó. Bạn có thể [tự mình xác minh điều này](/info/verify-yourself.html) trên bất kỳ tệp nào Lolly tạo ra.
- <!--i:people--> **Con người vẫn là tác giả.** Mọi đầu vào cuối cùng đều là một quyết định, được khởi phát ở đâu đó bởi một con người, bất kể có bao nhiêu hệ thống hay bao nhiêu bước ngoặt để đi đến đây. Một agent có thể mang một quyết định đi rất xa. Nó không thể là người khởi tạo ra quyết định đó. Từ ngữ, hình ảnh, bảng màu, quyết định cần đến sự phán đoán: các công cụ mở rộng quy mô cho sự phán đoán đó, chúng không thay thế nó. Những phần nhàm chán mới là thứ được tự động hóa: việc kiểm tra thương hiệu, việc xuất lại ở mọi kích thước, việc bản địa hóa thủ công. Điều còn lại chính là quyền tác giả.
- <!--i:globe--> **Kênh dẫn, không phải xô chứa.** Các mô hình ngày nay là sàn, không phải trần, nên chúng tôi từ chối xây dựng bất cứ điều gì mà giá trị của nó phụ thuộc vào việc tích trữ quyền truy cập vào chúng. Engine này là mã nguồn mở, kết xuất ngay trên thiết bị của riêng bạn và hoạt động ngoại tuyến. Không có hào bảo vệ mô hình (model moat), không có đồng hồ đo mức sử dụng, không có hoạt động kinh doanh dựa trên sự khan hiếm gắn liền với chính dòng chảy đó. Khoản đầu tư bền vững là hạ tầng xung quanh dòng nước - và chính hạ tầng đó là thứ chúng tôi cho đi miễn phí.

## Quyết định của con người mới là trọng tâm

Hãy nói thật rõ ràng về điều nằm bên dưới mọi cam kết ở trên.

Từng cá nhân định hình trái đất và lịch sử của chúng ta. Những lựa chọn của họ, được đưa ra từng cái một, trở thành thế giới mà phần còn lại chúng ta đang sống trong đó. Hành động của họ tạo nên nó. Đó không phải là cảm tính, đó đơn giản là cách mọi thứ từng xảy ra.

Vì vậy chúng tôi trao quyền cho quyết định của con người và không thỏa hiệp với nó. Quyền được lựa chọn. Năng lực hành động. Quyền tự quyết. Khả năng quyết định và hành động, và để hành động đó thực sự là của bạn.

Các công cụ ở đây nhân rộng những gì một người đã quyết định. Chúng không quyết định thay cho người đó, và không bao giờ lặng lẽ đứng ra thay thế họ. Khi một quyết định được thực hiện bởi tự động hóa, bản ghi vẫn luôn dẫn ngược trở lại người đã khởi phát nó, dù nó có đi qua bao nhiêu hệ thống và bao nhiêu bước ngoặt trên đường đi.

Chúng tôi tôn trọng điều đó từ đầu đến cuối, và chúng tôi ghi lại nó: vì lịch sử, vì trách nhiệm giải trình, vì niềm tin và vì ngày mai.

## AI, theo cách của bạn

Bạn không bao giờ bắt buộc phải dùng AI ở đây. Nếu bạn chọn dùng nó, ba điều sau luôn đúng:

- <!--i:people--> **Bạn nắm quyền kiểm soát.** AI chỉ trợ giúp khi bạn yêu cầu, và chỉ với đúng phần bạn chỉ đến. Không có gì được quyết định thay bạn.
- <!--i:check--> **Nó ngừng tốn phí.** Nếu AI giúp tạo ra thứ gì đó một lần, kết quả đó là của bạn. Dùng lại nó là miễn phí, dù bạn cần bao nhiêu lần đi nữa.
- <!--i:shieldcheck--> **Nó luôn trung thực.** Một phần do AI tạo ra sẽ ghi rõ điều đó, và những gì bạn làm ra mang tên bạn thay vì giả vờ là ai khác. Ngay cả phần trợ giúp tích hợp sẵn cũng hoạt động theo cách này: [Hỏi Lolly](/info/ask.html) trả lời bằng chính câu chữ trong tài liệu hướng dẫn cùng một liên kết, không bao giờ là một câu trả lời bịa ra.

## Đây không phải là

- <!--i:check--> **Không phải một lệnh cấm.** Các công cụ có thể sử dụng AI khi nó phục vụ cho công việc, và các tác nhân là một nhóm người dùng được hỗ trợ - xem [Tác nhân AI](/info/ai-agents.html).
- <!--i:seal--> **Không phải một tuyên bố về sự thuần khiết.** Lolly đọc nguồn gốc xuất xứ một cách rộng rãi và ghi lại nó một cách trung thực; nó không giả vờ có thể phát hiện mọi pixel được tạo ra trên internet.
- <!--i:sunburst--> **Không phải một cơn hoảng loạn đạo đức.** Trận lũ không phải là kẻ thù. Dòng nước không rõ nguồn gốc mới là kẻ thù.

## Cách để buộc chúng tôi giữ lời

Mọi cam kết ở trên đều được thực thi trong mã nguồn mở, không phải trong một tệp PDF chính sách: đường đi nguồn gốc xuất xứ, việc gắn nhãn GEN AI và cam kết không theo dõi đều đi kèm các bài kiểm thử, và trang [Tự mình xác minh](/info/verify-yourself.html) sẽ hướng dẫn bạn kiểm tra các tuyên bố này so với một bản xuất thực tế. Nếu bạn tìm thấy chỗ nào mà mã nguồn và trang này không khớp nhau, thì mã nguồn mới là lỗi.
