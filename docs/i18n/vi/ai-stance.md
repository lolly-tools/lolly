# Lập trường về AI của chúng tôi

Lolly được xây giữa thay đổi lớn nhất về cách tạo ra truyền thông kể từ máy in, bởi những người không hoảng sợ về AI cũng không phấn khích thái quá về công nghệ. Đây là quan điểm của dự án, kèm cơ chế đằng sau từng cam kết, để bạn kiểm chứng thay vì tin.

> "Chúng ta đang uống nước như thể vòi sắp cạn bất cứ lúc nào. Nó sẽ không cạn - AI hôm nay là phiên bản tệ nhất mà nó từng có. Nếu chúng ta vượt qua được trận lũ, đó sẽ không phải nhờ tích trữ những gì trong bồn nước gỉ sét dưới chân đồi, đầy cặn bẩn. Đó sẽ là nhờ dẫn nước tưới tiêu và khai khẩn lại mảnh đất ***của chúng ta*** cho một tương lai thịnh vượng."
>
> - Andy Fitzsimon, Người đóng góp cho Lolly

![Một cơn bão siêu tế bào ập xuống trang trại vùng hẻo lánh - bồn nước và các nhà kho phía dưới, nước lũ đã bắt đầu khoét thành các rãnh chảy qua cánh đồng khô hạn](/info/the-flood.webp)

%file{Gemini_Generated_Image_vmy7thvmy7thvmy7.png} %entity{Gemini} tạo hình ảnh %sig{signed by %entity{Google LLC}} %entity{Lolly} %act{opened}, %act{watermarked} và %act{exported to WebP} thành %file{the-flood.webp} %detail{10.6 MB down to 0.8 MB} %sig{signed by %entity{Lolly}} [Xác minh ngay](/#/verify?src=%2Finfo%2Fthe-flood.webp)

Để chính xác, vì trang này lập luận rằng sự chính xác quan trọng: ảnh phía trên được tạo ra, không phải chụp. Không máy ảnh nào được hướng vào trang trại đó, vì không có trang trại nào. Nó mô tả vùng Queensland, Úc, được viết lời nhắc từ Vương quốc Anh, được tạo trong một trung tâm dữ liệu ở Hoa Kỳ. Nó cố gắng trung thành với một nơi mà không phải bản ghi của nơi đó, và sự phân biệt ấy là toàn bộ lý do bức ảnh mang Content Credentials.

Đây là điều bạn thấy khi kiểm tra tệp. Chín bước còn lại trong tệp: năm bước do Google ghi lại khi tạo và đóng hình mờ cho ảnh, rồi bốn bước do Lolly ghi lại khi mở, tạo, đánh dấu và chuyển đổi phiên bản trên trang này. Lolly không tạo ra gì, và mục của nó nói vậy.

![Lịch sử thay đổi mà Lolly đọc lại được từ tệp hoàn thiện - năm bước do Google ghi lại, sau đó bốn bước do Lolly, kết thúc bằng tệp WebP trên trang này](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Trong bức tranh của Andy, tư thế khan hiếm đối với AI là uống nước bể chứa đã thiu trong khi nước lũ cuồn cuộn qua đồng bằng. Nội dung được tạo ra sắp trở nên gần như vô hạn. Khi một thứ trở nên vô hạn, giá trị của nó chuyển sang bất cứ thứ gì còn khan hiếm quanh nó: sự tin cậy, nguồn gốc, sự nhất quán thương hiệu và phán đoán của con người. Lolly không phải chiếc xô lớn hơn hứng nước lũ. Nó là hệ thống tưới tiêu: những con mương dẫn nước, và lớp đất nơi mọi thứ thực sự lớn lên.

## Lập trường, trong năm cam kết

- <!--i:layers--> **AI được chào đón làm đầu vào, không bao giờ làm kẻ mạo danh.** Tác tử là người dùng hạng nhất của Lolly: chúng chạy cùng các công cụ như con người, qua [máy chủ MCP](/info/mcp.html) và [URL mode](/info/url-mode.html), trong đúng cùng những ràng buộc. Điều không tác tử nào được làm là đem đầu ra của nó giả làm thứ nó không phải. [Input, not impersonation](/info/input-not-impersonation.html) vạch ranh giới đó.
- <!--i:shieldcheck--> **AI tự khai báo.** Khi AI tạo ra các điểm ảnh, bản xuất nói vậy: một khẳng định máy đọc được trong Content Credentials của tệp và huy hiệu GEN AI nhìn thấy được khi ai đó xác minh tệp. Khi phương tiện bạn đã khai báo là do AI tạo được đặt vào một thiết kế, credential riêng của bản xuất cũng nói vậy: dấu nguồn gốc hỗn hợp và một khai báo AI có chữ ký, máy đọc được. Lolly cũng đọc và hiện các khai báo AI của tệp tạo ở nơi khác, và đánh dấu khi có khả năng hình mờ SynthID hiện diện, đọc khai báo, không phải chính hình mờ. Cùng quy tắc ràng buộc bộ viết lại trên thiết bị của chính Lolly: mỗi câu nó viết mang một hình mờ thống kê công khai trong cách chọn từ, được công bố ở đây và trong công cụ, để văn bản do mô hình viết vẫn tự khai báo ngay cả khi là bản sao văn bản thuần, và ai cũng kiểm tra được văn bản đó trong [Verify](/#/verify) ([cách kiểm tra hoạt động](/info/what-verify-checks.html#text-reworded-by-lolly)). Cơ chế công khai theo thiết kế: xác minh cho mọi người, bí mật cho không ai. Khán giả xứng đáng biết phương tiện được tạo ra thế nào.
- <!--i:check--> **Nguồn gốc được bật theo mặc định.** Bản xuất mang [Content Credentials](/info/content-credentials-identity.html) theo mặc định, không phải một cài đặt bị chôn. Chuỗi bao gồm chỉnh sửa và thành phần, nên lịch sử của một tác phẩm đi cùng tác phẩm. Bạn có thể [tự xác minh](/info/verify-yourself.html) trên bất kỳ tệp nào Lolly tạo ra.
- <!--i:people--> **Con người vẫn là tác giả.** Lời văn, hình ảnh, bảng màu, quyết định cần phán đoán: công cụ nhân rộng phán đoán đó và không bao giờ thay thế con người. Phần tẻ nhạt là thứ được tự động hóa: kiểm tra thương hiệu, xuất lại ở mọi kích thước, địa phương hóa bằng tay. Phần còn lại là quyền tác giả.
- <!--i:globe--> **Mương dẫn, không phải xô chứa.** Các mô hình hôm nay là nền, không phải trần, nên chúng tôi từ chối xây bất cứ thứ gì có giá trị phụ thuộc vào việc tích trữ quyền truy cập chúng. Engine là mã nguồn mở, kết xuất trên thiết bị của bạn và hoạt động ngoại tuyến. Không có hào lũy mô hình, không đồng hồ đo sử dụng, không kinh doanh khan hiếm gắn với chính trận lũ. Khoản đầu tư bền vững là hạ tầng quanh dòng nước - và hạ tầng đó là thứ chúng tôi cho đi.

## Quyết định của con người mới là trọng tâm

Mỗi cá nhân định hình trái đất và lịch sử của chúng ta. Những lựa chọn của họ, được đưa ra từng cái một, trở thành thế giới mà phần còn lại chúng ta sống trong đó. Hành động của họ tạo nên thế giới đó. Mọi điều từng xảy ra đều như vậy.

Vì vậy chúng tôi trao quyền cho quyết định của con người và không bao giờ nhượng bộ điều đó. Quyền lựa chọn. Quyền tự quyết. Quyền tự chủ. Khả năng quyết định và hành động, và để hành động đó là của bạn.

Các công cụ ở đây nhân rộng những gì một người đã quyết định. Chúng không quyết định thay cho người đó, và không bao giờ lặng lẽ đứng ra thay thế họ. Khi một quyết định được thực hiện bởi tự động hóa, bản ghi vẫn luôn dẫn ngược trở lại người đã khởi phát nó, dù nó có đi qua bao nhiêu hệ thống và bao nhiêu bước ngoặt trên đường đi.

Chúng tôi tôn trọng điều đó từ đầu đến cuối, và chúng tôi ghi lại nó: vì lịch sử, vì trách nhiệm giải trình, vì niềm tin và vì ngày mai.

## AI, theo cách của bạn

Bạn không bao giờ bắt buộc phải dùng AI ở đây. Nếu bạn chọn dùng nó, ba điều sau luôn đúng:

- <!--i:people--> **Bạn nắm quyền kiểm soát.** AI chỉ giúp khi bạn yêu cầu, và chỉ với phần bạn chỉ vào. Không gì được quyết định thay bạn.
- <!--i:check--> **Nó thôi tốn kém.** Nếu AI giúp làm ra thứ gì một lần, kết quả là của bạn. Dùng lại nó là miễn phí, dù bạn cần kết quả bao nhiêu lần.
- <!--i:shieldcheck--> **Nó vẫn trung thực.** Một tác phẩm do AI làm nói vậy, và thứ bạn làm mang tên bạn thay vì giả làm ai khác. Ngay cả trợ giúp tích hợp cũng hoạt động theo cách này: [Ask Lolly](/info/ask.html) trả lời bằng chính câu của sổ tay và một liên kết, không bao giờ là câu trả lời bịa.

## Đây không phải là

- <!--i:check--> **Không phải một lệnh cấm.** Các công cụ có thể sử dụng AI khi nó phục vụ cho công việc, và các tác nhân là một nhóm người dùng được hỗ trợ - xem [Tác nhân AI](/info/ai-agents.html).
- <!--i:seal--> **Không phải một tuyên bố về sự thuần khiết.** Lolly đọc nguồn gốc xuất xứ một cách rộng rãi và ghi lại nó một cách trung thực; nó không giả vờ có thể phát hiện mọi pixel được tạo ra trên internet.
- <!--i:sunburst--> **Không phải một cơn hoảng loạn đạo đức.** Trận lũ không phải là kẻ thù. Dòng nước không rõ nguồn gốc mới là kẻ thù.

## Tự mình kiểm tra các cam kết này

Mọi cam kết ở trên đều được thực thi trong mã nguồn mở, không phải trong một PDF chính sách: đường nguồn gốc, nhãn GEN AI và đảm bảo không theo dõi đều đi kèm kiểm thử, và trang [Verify It Yourself](/info/verify-yourself.html) dẫn bạn qua việc kiểm tra các khẳng định với một bản xuất thật.
