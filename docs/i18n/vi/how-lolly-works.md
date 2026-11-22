# Cách Lolly hoạt động

Một công cụ Lolly chứa các quy tắc cho một loại tệp: bố cục, kiểu chữ, màu sắc và những phần người khác được phép thay đổi. Bạn, đồng nghiệp, tập lệnh hoặc tác nhân AI điền các trường và mọi tệp đều tuân theo những quy tắc đó.

<!--i:eti-repeat-->
## Một công cụ, quy tắc của bạn, nhiều tệp

Các quy tắc thương hiệu nằm trong công cụ. Thiết lập công cụ một lần và mọi đầu ra đều có cùng kiểu chữ, màu sắc và khoảng cách, từ một thẻ đến cả bảng tính gồm nhiều hàng bằng hàng chục ngôn ngữ.

![Công cụ wordmark với một trường đã điền: kiểu chữ, màu sắc và khoảng cách được ấn định khi tạo công cụ](/info/shots/aud-rules-in-the-tool.svg)

Người tạo tệp thứ một trăm chỉ cần gõ nội dung. Bạn quyết định cách kiểm tra tác phẩm và ai sẽ kiểm tra. Lolly giảm những gì cần kiểm tra và giúp tạo tệp tiếp theo nhanh hơn.

<!--i:eti-users-->
## Ai sử dụng công cụ

Ba vai trò trong một tổ chức cùng làm việc trên một thẻ chiến dịch.

![Nhà thiết kế đặt quy tắc một lần trong công cụ; nhà phát triển chạy công cụ từ tập lệnh và bất kỳ ai cũng có thể điền các trường; cả hai cách đều tạo ra tệp hoàn chỉnh](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Nhà thiết kế đặt quy tắc.** Họ dàn thẻ trong Lolly Design với kiểu chữ và màu sắc của thương hiệu, rồi chọn những trường được phép thay đổi. Họ làm việc này một lần để không ai phải bản địa hóa thẻ theo cách thủ công nữa.
- <!--i:code--> **Nhà phát triển mở rộng quy mô sử dụng công cụ.** Cùng công cụ đó chạy trong tập lệnh hằng đêm qua dòng lệnh. Một biểu đồ mới hoặc phiên bản ngôn ngữ mới xuất hiện mà không ai phải mở lại thiết kế.
- <!--i:people--> **Bất kỳ ai cũng có thể điền.** Một nhân viên bán hàng trên máy bay, không có mạng và chưa được đào tạo về thiết kế, mở công cụ và tạo thẻ cho cuộc họp ngày mai.
:::

Biểu đồ mới của nhà phát triển là một bản kết xuất như hình này, được tạo từ chuỗi dữ liệu và một vài cài đặt:

![Biểu đồ miền xếp chồng có tiêu đề, ba chuỗi dữ liệu thành các dải màu lạnh, với trục, chú giải và tiêu đề đều được mẫu bố trí thay vì đặt thủ công](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Một phút làm nhanh của nhân viên bán hàng dựa vào quy tắc của nhà thiết kế và tập lệnh của nhà phát triển. Mọi vai trò đều dùng cùng một công cụ.

<!--i:eti-train-->
## Bốn cách tạo một tệp

Mọi cách đều chạy cùng một bộ máy trên cùng một công cụ, nên tệp do tập lệnh tạo khớp với bản bạn xem trước trong ứng dụng.

![Tham số URL và đối số dòng lệnh trở thành cùng một mô hình đầu vào, chạy qua cùng một môi trường thực thi và cầu nối xuất](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **Trong ứng dụng, mỗi lần một tệp.** Mở công cụ, điền các trường và nhấn **Export**. [Tạo tệp đầu tiên](/info/make-something.html) hướng dẫn bạn tạo một tệp.
- <!--i:layers--> **Trong ứng dụng, nhiều tệp cùng lúc.** [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) nhận bảng được dán hoặc nhập vào và kết xuất một tệp hoàn chỉnh cho mỗi hàng.
- <!--i:cpu--> **Từ tập lệnh hoặc tác nhân AI.** [CLI](/info/cli.html) chạy công cụ không cần giao diện, còn [máy chủ MCP](/info/mcp.html) cho phép tác nhân tìm và chạy công cụ. Liên kết đến công cụ cũng mang theo các đầu vào, nên một liên kết là một yêu cầu hoàn chỉnh.
- <!--i:server--> **Qua máy chủ của tổ chức.** [Lolly Work](/info/organisation.html) kết xuất trên máy chủ theo chính sách đăng nhập và công cụ của tổ chức, giữ các tác vụ có thể tiếp tục và lưu đầu ra để tải xuống hoặc bàn giao theo phê duyệt.

Cách mà một tác vụ có thể dùng phụ thuộc vào các định dạng của công cụ và khả năng của môi trường chạy. Một số định dạng cần trình duyệt, nên dòng lệnh chuyển chúng sang tầng trình duyệt. [Kết xuất bằng CLI](/info/cli-rendering.html) liệt kê nơi kết xuất từng định dạng.

<!--i:eti-monitor-->
## Chức năng nào chạy ở đâu

Việc tạo, chỉnh sửa và xuất chạy trên thiết bị của bạn, không cần tài khoản. Tính năng cần máy chủ, như Sync hoặc gửi tệp tới dịch vụ đã kết nối, chỉ kết nối khi bạn dùng tính năng đó. Với Lolly Work, các dự án dùng chung, chỉnh sửa trực tiếp theo nhóm, phê duyệt và tác vụ máy chủ sử dụng máy chủ của tổ chức. [Chức năng nào chạy ở đâu](/info/compare.html#what-runs-where) đặt hai phần cạnh nhau để đối chiếu.

<!--i:eti-graduation-cap-->
## Đọc tiếp

- [Tạo tệp đầu tiên](/info/make-something.html), để thử ngay.
- [Bắt đầu](/info/quickstart.html), để đưa hệ thống thiết kế của bạn vào.
- [Tự động hóa](/info/builders.html), về dòng lệnh, liên kết và tác nhân.
- [Kiến trúc Lolly](/info/overview.html), dành cho người đóng góp: bộ máy, các lớp vỏ ứng dụng và quy tắc gắn kết chúng.
