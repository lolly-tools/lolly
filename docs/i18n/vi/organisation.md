# Dùng Lolly tại tổ chức của bạn

Tổ chức của bạn có thể chạy Lolly riêng: cùng ứng dụng, với các công cụ và hệ thống thiết kế do tổ chức chọn. Trang này cho thấy cách truy cập, đăng nhập và những gì thay đổi sau đó.

::: note Những gì bạn cần từ tổ chức của mình
Địa chỉ web của Lolly thuộc tổ chức đó, hoặc một tệp thiết lập `.lolly` mà tổ chức của bạn đã tạo. Bản thân lolly.tools không kết nối với một tổ chức nào.
:::

## Trên trình duyệt

Mở địa chỉ mà tổ chức đã đưa cho bạn. Nếu trang yêu cầu đăng nhập, nhấn **Sign in** và làm theo trang đăng nhập mà nó mở. Sau đó nó hoạt động như bất kỳ Lolly nào, với các công cụ và hệ thống thiết kế của tổ chức bạn.

Bạn cũng có thể bắt đầu từ lolly.tools: mở **Settings**, và trên thẻ **Lolly instance** nhấn **Open a workspace**, nhập địa chỉ rồi nhấn **Open this instance**. Trình duyệt chuyển tới địa chỉ riêng của tổ chức bạn, vì trình duyệt không thể tải công cụ của một Lolly khác từ lolly.tools.

![Thẻ Lolly instance trong Settings, nơi bạn mở không gian làm việc của tổ chức hoặc đổi nơi ứng dụng lấy công cụ](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

## Trên ứng dụng máy tính hoặc di động

Ứng dụng khởi động với các công cụ đi kèm. Để kết nối, mở **Settings** và nhấn **Change** trên thẻ **Lolly instance**. Hộp thoại hỏi **Where should Lolly get its tools?**

1. Chọn **Kết nối với một phiên bản Lolly**.
2. Nhập địa chỉ web của tổ chức bạn và nhấn **Kiểm tra & kết nối**.
3. Nhấn **Dùng phiên bản này**. Màn hình tiếp theo, **Nhập dữ liệu của bạn (tùy chọn)**, mang công việc đã lưu từ một bản sao lưu Lolly sang; nhấn **Bỏ qua** nếu bạn không có.
4. Đăng nhập nếu ứng dụng yêu cầu.

Các công cụ từ một phiên bản đã kết nối chạy với cùng mức độ tin cậy như của chính ứng dụng, nên chỉ kết nối với một phiên bản bạn tin tưởng. Thay vào đó, tổ chức của bạn có thể gửi cho bạn một tệp thiết lập `.lolly` để kết nối ứng dụng thay bạn.

Để chuyển sau này, dùng **Change** lần nữa, hoặc **Leave** trên cùng thẻ.

### Đăng nhập bằng mã

Trong ứng dụng máy tính và di động, màn hình đăng nhập còn đưa ra một mã ngắn, khi Lolly của tổ chức bạn hỗ trợ đăng nhập bằng mã. Nhấn **Open sign-in in browser**, đăng nhập và chấp thuận mã ở đó. Hoặc mở địa chỉ nó hiển thị trên điện thoại hay máy tính nơi bạn đã đăng nhập, rồi nhập mã. Mã có hiệu lực khoảng mười phút.

## Điều gì khác biệt ở đó

- **Một số điều khiển được đặt sẵn cho bạn.** Một điều khiển do tổ chức bạn quản trị hiện **Managed by** và tên tổ chức, hoặc **Managed by your organisation**. Điều khiển cố định không thể đổi, một menu có thể chỉ đưa ra một số lựa chọn, và dòng bắt đầu bằng **Set by** có thể cho biết quy tắc nào áp dụng và vì sao. Một số điều khiển không hiện ra.
- **Một số hệ thống thiết kế bị khóa.** Hệ thống thiết kế do tổ chức bạn cung cấp hiện một khóa và chỉ đọc. Để thử thay đổi, hãy tạo bản sao có thể chỉnh sửa trong **Settings → Preferences → Design systems**.
- **Chỉ các công cụ của tổ chức được liệt kê.** Công cụ mà tổ chức bạn không cung cấp hoàn toàn không hiện ra.
- **Dự án chung.** Nếu tổ chức chia sẻ dự án với bạn, **Projects** hiện một ô **Team projects**. Các phiên này nằm trên máy chủ của tổ chức. Mở một phiên để làm việc, hoặc bắt đầu một [work collab](/info/collaborate.html#work-collabs-with-lolly-work-optional) từ **Share** khi có.
- **Một số bản xuất có thể cần phê duyệt.** Nơi tổ chức yêu cầu phê duyệt, **Request approval** thay cho **Download**, và một công cụ có thể cung cấp ít định dạng hơn.

### Cái gì ở đâu

::: cols
## Trên thiết bị này

- Các bản lưu của riêng bạn, trừ khi bạn bật [Sync](/info/sync.html)
- Các hệ thống thiết kế do chính bạn tạo
- Mọi thứ bạn tạo và tải xuống

## Trên máy chủ của tổ chức bạn

- Danh tính đăng nhập và thông tin thiết bị của bạn
- Dự án nhóm, phiên chung và chỉnh sửa trực tiếp trong một work collab
- Tài nguyên bạn tải lên thư viện chung
- Yêu cầu phê duyệt và các bản bàn giao đã duyệt
- Sự kiện sử dụng, nơi tổ chức bạn bật chúng
:::

[Privacy](/info/privacy.html#organisation-services-with-lolly-work) liệt kê những gì máy chủ lưu và ai kiểm soát dữ liệu đó.

## Lolly Work bổ sung gì

Máy chủ của tổ chức bạn chạy **Lolly Work**, phần mềm tổ chức của cùng dự án mã nguồn mở. Ứng dụng không cần tài khoản công việc hay Lolly Work khi bạn dùng một mình.

::: details Lolly Work có thể bổ sung gì
Tổ chức của bạn lưu trữ [Lolly Work](https://github.com/lolly-tools/lolly-work) cùng với Lolly và chọn tính năng nào được bật:

- **Đăng nhập và truy cập.** Đăng nhập một lần của tổ chức, quyền theo nhóm và các trường hồ sơ được quản lý. Quản trị viên có thể cấp và vô hiệu hóa tài khoản qua SCIM.
- **Công việc chung.** Dự án nhóm, phiên chung và [work collab](/info/collaborate.html#work-collabs-with-lolly-work-optional), với chỉnh sửa trực tiếp qua máy chủ của tổ chức.
- **Thư viện tài nguyên chung.** Tài nguyên đã tải lên, bộ sưu tập và thư viện đã kết nối, với quy tắc truy cập, phiên bản và xem xét.
- **Xem xét và bàn giao.** Các bước phê duyệt, liên kết được quản lý có hạn hoặc thu hồi được, và bàn giao tới các đích mà tổ chức cho phép.
- **Quản trị.** Báo cáo sử dụng theo chính sách telemetry của phiên bản, cùng bản ghi kiểm toán các hành động được quản trị.

Nếu bạn đang thiết lập dịch vụ, hãy bắt đầu với [Deployment](/info/deployment.html#organisation-services-with-lolly-work). Bản demo công khai tại [lolly.work](https://lolly.work) là một sandbox; hãy dùng địa chỉ riêng của tổ chức cho công việc bạn cần giữ.
:::

## Rời đi

**Leave**, trên thẻ **Lolly instance** trong **Settings**, gỡ hệ thống thiết kế, công cụ và danh mục của tổ chức bạn. Công việc của riêng bạn vẫn còn. Mọi thứ bạn làm bằng các công cụ của nó sẽ không mở lại được cho đến khi bạn kết nối lại.

Mọi thứ bạn lưu vào tổ chức ở lại với tổ chức, theo chính sách truy cập và lưu giữ của họ. Rời đi hoặc xóa thiết bị này không xóa bản sao trên máy chủ đó. Trong trình duyệt tại địa chỉ riêng của tổ chức bạn, không có gì để rời: hãy mở một địa chỉ khác.

## Hỏi ai

Những gì đến được máy chủ của tổ chức bạn, ai có thể xem các dự án được chia sẻ của tổ chức đó và những cài đặt nào bị cố định là quyết định của tổ chức bạn. Hãy hỏi bất kỳ ai vận hành Lolly của tổ chức bạn. [Quyền riêng tư](/info/privacy.html) nói về những gì chính Lolly làm với dữ liệu của bạn.
