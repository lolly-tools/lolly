# Lolly hoạt động thế nào

Một công cụ Lolly giữ các quy tắc cho một loại tệp: bố cục, kiểu chữ, màu sắc và những phần nào người khác được đổi. Bạn, một đồng nghiệp, một tập lệnh hoặc một tác tử AI điền các trường, và mọi tệp đều ra đúng. Trang này cho thấy ai làm gì, và bốn lộ trình từ một công cụ đến một tệp hoàn chỉnh.

## Một công cụ, quy tắc của bạn, nhiều tệp

Quy tắc thương hiệu nằm trong công cụ, không nằm trong từng tệp nó tạo ra. Làm đúng công cụ một lần và mọi đầu ra đều thừa hưởng cùng kiểu chữ, màu sắc và khoảng cách, dù đó là một tấm thẻ hay một bảng tính nhiều hàng bằng hàng chục ngôn ngữ.

![Một công cụ wordmark với một trường được điền: kiểu chữ, màu sắc và khoảng cách đã chốt từ khi công cụ được tạo](/info/shots/aud-rules-in-the-tool.svg)

Người làm tệp thứ một trăm chỉ gõ chữ. Cách bạn kiểm tra công việc, và ai kiểm tra, vẫn do bạn quyết định. Lolly làm cho thứ đáng kiểm tra nhỏ đi, và tệp tiếp theo nhanh hơn để làm.

## Ai chạm vào một công cụ

Theo dõi một tấm thẻ chiến dịch đi qua một tổ chức và ba đôi tay xuất hiện. Mỗi đôi dựa trên đôi trước.

![Một nhà thiết kế đặt quy tắc một lần trong công cụ; một nhà phát triển chạy nó từ tập lệnh và ai cũng điền được các trường của nó; cả hai đều tạo ra tệp hoàn chỉnh](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Nhà thiết kế đặt quy tắc.** Họ dàn tấm thẻ trong Design với kiểu chữ và màu sắc của thương hiệu, rồi chọn trường nào để mở. Họ làm một lần, nên không ai phải địa phương hóa tấm thẻ bằng tay nữa.
- <!--i:code--> **Nhà phát triển mở rộng công cụ.** Cùng công cụ đó chạy trong một tập lệnh hằng đêm qua dòng lệnh, nên một biểu đồ mới hoặc một phiên bản ngôn ngữ mới được tạo ra mà không ai phải mở lại thiết kế.
- <!--i:people--> **Ai cũng điền được.** Một nhân viên bán hàng trên máy bay, không có mạng và không được đào tạo thiết kế, mở công cụ và làm tấm thẻ cho cuộc họp ngày mai.
:::

Biểu đồ mới ở bước của nhà phát triển là một bản kết xuất như thế này, tạo từ một chuỗi dữ liệu và vài cài đặt mà không ai mở tệp thiết kế:

![Một biểu đồ vùng xếp chồng có tiêu đề, ba chuỗi của nó phân dải trong bảng màu lạnh, với trục, chú giải và tiêu đề đều do mẫu đặt thay vì làm tay](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Một phút nhẹ nhàng của nhân viên bán hàng chỉ có được nhờ sự chu đáo của nhà thiết kế và tập lệnh của nhà phát triển. Mọi vai trò đều làm việc với cùng một công cụ, thay vì mỗi người một sản phẩm riêng.

## Bốn lộ trình đến một tệp

Mọi lộ trình chạy cùng một engine trên cùng một công cụ, nên tệp mà tập lệnh tạo ra khớp với tệp bạn xem trước trong ứng dụng.

![Tham số URL và đối số dòng lệnh trở thành cùng một mô hình đầu vào, chạy qua một runtime và cầu xuất dùng chung](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **Trong ứng dụng, từng tệp một.** Mở một công cụ, điền các trường và nhấn **Export**. [Make your first file](/info/make-something.html) hướng dẫn bạn làm một tệp.
- <!--i:layers--> **Trong ứng dụng, nhiều tệp cùng lúc.** [Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) nhận một bảng dán hoặc nhập vào và kết xuất một tệp hoàn chỉnh cho mỗi hàng.
- <!--i:cpu--> **Từ một tập lệnh hoặc tác tử AI.** [CLI](/info/cli.html) chạy một công cụ không giao diện, và [máy chủ MCP](/info/mcp.html) cho phép tác tử khám phá và chạy công cụ. Liên kết tới một công cụ cũng mang đầu vào của nó, nên một liên kết là một yêu cầu hoàn chỉnh.
- <!--i:server--> **Qua máy chủ của tổ chức bạn.** [Lolly Work](/info/organisation.html) kết xuất trên máy chủ theo đăng nhập và chính sách công cụ của tổ chức, giữ các tác vụ có thể tiếp tục và giữ đầu ra để tải xuống hoặc bàn giao đã được duyệt.

Lộ trình nào một tác vụ dùng được phụ thuộc vào định dạng của công cụ và khả năng của máy chủ: một số định dạng cần trình duyệt, nên dòng lệnh chuyển chúng cho tầng trình duyệt. [Render with the CLI](/info/cli-rendering.html) liệt kê định dạng nào kết xuất ở đâu.

## Cái gì chạy ở đâu

Việc tạo, chỉnh sửa và xuất chạy trên thiết bị của bạn, không cần tài khoản. Một tính năng cần máy chủ, như Sync hoặc gửi tệp tới dịch vụ đã kết nối, chỉ kết nối khi bạn dùng tính năng đó. Với Lolly Work, dự án chung, chỉnh sửa nhóm trực tiếp, phê duyệt và tác vụ máy chủ dùng máy chủ của tổ chức bạn. [What runs where](/info/compare.html#what-runs-where) đặt hai phần cạnh nhau.

## Đọc tiếp

- [Make your first file](/info/make-something.html), để thử ngay.
- [Start](/info/quickstart.html), để đưa hệ thống thiết kế của riêng bạn vào.
- [Automate](/info/builders.html), cho dòng lệnh, liên kết và tác tử.
- [Lolly architecture](/info/overview.html), dành cho người đóng góp: engine, các shell và các quy tắc giữ chúng với nhau.
