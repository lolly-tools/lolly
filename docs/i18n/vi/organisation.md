# Sử dụng Lolly tại tổ chức của bạn

Tổ chức của bạn có thể vận hành Lolly riêng: cùng ứng dụng với những công cụ và hệ thống thiết kế mà tổ chức đã chọn. Tìm hiểu cách truy cập, đăng nhập và những gì thay đổi.

Để lên kế hoạch thiết lập cho tổ chức, [Dùng Lolly với DAM hiện có](/info/use-with-dam.html) giải thích cách giữ nguyên thư viện đã được phê duyệt trong khi mọi người tạo nội dung trong Lolly. [Chủ quyền nội dung](/info/content-sovereignty.html) mô tả quyền kiểm soát rộng hơn đối với việc tạo, quản trị, lưu trữ và khả năng di chuyển nội dung.

::: note Những gì bạn cần từ tổ chức
Địa chỉ web của Lolly do tổ chức vận hành hoặc một tệp thiết lập `.lolly` do tổ chức tạo. Bản thân lolly.tools không kết nối với tổ chức nào.
:::

<!--i:eti-globe-->
## Trong trình duyệt

Mở địa chỉ tổ chức đã cung cấp. Nếu trang yêu cầu đăng nhập, nhấn **Sign in** và làm theo trang đăng nhập được mở ra. Sau đó, Lolly hoạt động như bình thường với các công cụ và hệ thống thiết kế của tổ chức.

Bạn cũng có thể bắt đầu từ lolly.tools: mở chế độ xem **Settings**, rồi trên thẻ **Lolly instance** nhấn **Open a workspace**, nhập địa chỉ và nhấn **Open this instance**. Trình duyệt chuyển đến địa chỉ riêng của tổ chức vì trình duyệt không thể tải công cụ của một Lolly khác từ lolly.tools.

![Thẻ Lolly instance trong Settings, nơi bạn mở không gian làm việc của tổ chức hoặc thay đổi nơi ứng dụng lấy công cụ](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

<!--i:eti-monitor-->
## Trong ứng dụng máy tính hoặc di động

Ứng dụng bắt đầu với các công cụ đi kèm. Để kết nối, mở chế độ xem **Settings** và nhấn **Change** trên thẻ **Lolly instance**. Bảng hiện câu hỏi **Where should Lolly get its tools?**

1. Chọn **Connect to a Lolly instance**.
2. Nhập địa chỉ web của tổ chức và nhấn **Check & connect**.
3. Nhấn **Use this instance**. Màn hình tiếp theo, **Import your data (optional)**, chuyển công việc đã lưu từ bản sao lưu Lolly sang. Nhấn **Skip** nếu bạn không có bản sao lưu.
4. Đăng nhập nếu ứng dụng yêu cầu.

Công cụ từ một phiên bản đã kết nối chạy với cùng mức tin cậy như công cụ của ứng dụng, nên chỉ kết nối với phiên bản bạn tin tưởng. Thay vào đó, tổ chức có thể gửi tệp thiết lập `.lolly` để kết nối ứng dụng giúp bạn.

Để chuyển sau này, dùng lại **Change** hoặc **Leave** trên cùng thẻ.

### Đăng nhập bằng mã

Trong ứng dụng máy tính và di động, màn hình đăng nhập cũng cung cấp mã ngắn khi Lolly của tổ chức hỗ trợ đăng nhập bằng mã. Nhấn **Open sign-in in browser**, đăng nhập và phê duyệt mã tại đó. Hoặc mở địa chỉ trên màn hình bằng điện thoại hay máy tính mà bạn đã đăng nhập rồi nhập mã. Mã có hiệu lực khoảng mười phút.

<!--i:eti-sliders-->
## Những gì khác ở đó

- **Một số điều khiển được đặt sẵn cho bạn.** Điều khiển do tổ chức quản trị hiển thị **Managed by** và tên tổ chức hoặc **Managed by your organisation**. Điều khiển đã cố định không thể thay đổi và menu có thể chỉ cung cấp một số lựa chọn. Một số điều khiển bị ẩn. Bảng quản trị của tổ chức ghi lại quy tắc nào đã cố định điều khiển và lý do. Hãy hỏi người vận hành Lolly của tổ chức.
- **Một số hệ thống thiết kế bị khóa.** Hệ thống thiết kế do tổ chức cung cấp có biểu tượng khóa và chỉ cho phép đọc. Để thử thay đổi, tạo bản sao có thể chỉnh sửa trong **Settings → Preferences → Design systems**.
- **Chỉ các công cụ của tổ chức được liệt kê.** Công cụ mà tổ chức không cung cấp sẽ không xuất hiện.
- **Dự án dùng chung.** Nếu tổ chức chia sẻ dự án với bạn, **Projects** hiển thị ô **Team projects**. Các phiên này nằm trên máy chủ của tổ chức. Mở một phiên để làm việc hoặc bắt đầu [phiên cộng tác công việc](/info/collaborate.html#collabs-through-lolly-work-optional) từ **Share** khi có tùy chọn này.
- **Một số bản xuất có thể cần phê duyệt.** Khi tổ chức yêu cầu phê duyệt, **Request approval** thay cho **Download** và công cụ có thể cung cấp ít định dạng hơn.
- **Màn hình chính có thể mở vào các mẫu.** Nếu tổ chức phát hành mẫu cho bạn, chẳng hạn cho một công ty đối tác, màn hình chính sẽ mở vào các mẫu thay vì lời chào lần đầu truy cập. Mỗi mẫu là một thẻ, với **Your copy** để tiếp tục và **New version** khi mẫu thay đổi. Xem [Mẫu cho đối tác](/info/work-partner-templates.html).

### Những gì được giữ ở đâu

::: cols
## Trên thiết bị này

- Những gì bạn tự lưu, trừ khi bạn bật [Sync](/info/sync.html)
- Hệ thống thiết kế bạn tự tạo
- Bất kỳ thứ gì bạn tạo và tải xuống

## Trên máy chủ của tổ chức

- Danh tính đăng nhập và thông tin thiết bị của bạn
- Dự án nhóm, phiên dùng chung và chỉnh sửa trực tiếp trong phiên cộng tác công việc
- Tài nguyên bạn tải lên thư viện dùng chung
- Yêu cầu phê duyệt và các lượt bàn giao đã được phê duyệt
- Nhật ký đăng nhập và hoạt động của bạn tại đó
:::

Khi đã kết nối không gian làm việc, dòng về quyền riêng tư trên màn hình đầu tiên của ứng dụng cũng nêu như vậy. Các ứng dụng của Lolly không gửi sự kiện sử dụng nào đến không gian làm việc. [Quyền riêng tư](/info/privacy.html#organisation-services-with-lolly-work) liệt kê những gì máy chủ lưu và ai kiểm soát dữ liệu đó.

<!--i:eti-building-->
## Lolly Work bổ sung những gì

Máy chủ của tổ chức chạy **Lolly Work**, phần mềm dành cho tổ chức thuộc cùng dự án mã nguồn mở. Ứng dụng không cần tài khoản công việc hay Lolly Work khi bạn dùng riêng.

::: details Những gì Lolly Work có thể bổ sung
Tổ chức của bạn lưu trữ và vận hành [Lolly Work](https://github.com/lolly-tools/lolly-work) cùng với Lolly và chọn những tính năng cần bật:

- **Đăng nhập và truy cập.** Đăng nhập một lần của tổ chức, quyền theo nhóm và các trường hồ sơ được quản lý. Quản trị viên có thể cấp và vô hiệu hóa tài khoản qua SCIM.
- **Công việc dùng chung.** Dự án nhóm, phiên dùng chung và [phiên cộng tác công việc](/info/collaborate.html#collabs-through-lolly-work-optional), với chỉnh sửa trực tiếp qua máy chủ của tổ chức.
- **Thư viện tài nguyên dùng chung.** Tài nguyên đã tải lên, bộ sưu tập và thư viện đã kết nối, với quy tắc truy cập, phiên bản và khâu xét duyệt.
- **Xét duyệt và bàn giao.** Các bước phê duyệt, liên kết được quản lý có thời hạn hoặc có thể thu hồi và bàn giao tới những đích mà tổ chức cho phép.
- **Quản trị.** Bản ghi kiểm toán các hành động được quản trị và báo cáo sử dụng theo chính sách đo lường từ xa của phiên bản dành cho các ứng dụng khách gửi sự kiện sử dụng. Hiện các ứng dụng của Lolly không gửi sự kiện nào.
:::

Để thiết lập dịch vụ, bắt đầu với [Triển khai](/info/deployment.html#organisation-services-with-lolly-work). Bản demo công khai tại [lolly.work](https://lolly.work) là môi trường thử nghiệm. Dùng địa chỉ riêng của tổ chức cho công việc bạn cần giữ lại.

<!--i:eti-palette-->
## Thương hiệu của tổ chức khác

Đối tác, khách hàng hoặc nhà tài trợ có thể gửi thương hiệu của họ dưới dạng tệp hệ thống thiết kế (`.lolly`) thay vì một địa chỉ. Mở tệp đó không kết nối ứng dụng với bất kỳ nơi nào. Tệp thêm hệ thống thiết kế của họ bên cạnh hệ thống của bạn trên thiết bị này. Tệp thiết lập từ chính tổ chức của bạn kết nối ứng dụng với Lolly của tổ chức. Trước khi có thay đổi, bản xem trước cho biết việc mở tệp sẽ làm gì. [Làm việc với đối tác](/info/partners.html) đề cập cả hai phía khi làm việc với thương hiệu của tổ chức khác.

<!--i:eti-unlink-->
## Rời khỏi

**Leave**, trên thẻ **Lolly instance** trong **Settings**, xóa hệ thống thiết kế, công cụ và danh mục của tổ chức. Công việc riêng của bạn vẫn còn. Những gì bạn tạo bằng công cụ của tổ chức sẽ không mở lại được cho đến khi bạn kết nối lại. Nếu Lolly của tổ chức có tùy chọn này, **Sign out everywhere** trên cùng thẻ kết thúc các phiên của bạn trên mọi thiết bị, kể cả thiết bị này.

Những gì bạn đã lưu vào tổ chức vẫn ở lại với tổ chức, theo chính sách truy cập và lưu giữ của tổ chức. Rời khỏi hoặc xóa dữ liệu trên thiết bị này không xóa bản sao trên máy chủ. Trong trình duyệt tại địa chỉ riêng của tổ chức, không có kết nối nào để rời khỏi: hãy mở một địa chỉ khác.

<!--i:eti-help-->
## Hỏi ai

Những gì được gửi đến máy chủ của tổ chức, ai có thể xem dự án dùng chung và cài đặt nào bị cố định đều do tổ chức quyết định. Hãy hỏi người vận hành Lolly của tổ chức. [Quyền riêng tư](/info/privacy.html) trình bày những gì bản thân Lolly làm với dữ liệu của bạn.
