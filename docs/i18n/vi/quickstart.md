# Bắt đầu

Đến cuối trang này, các công cụ của bạn sẽ mang màu sắc và phông chữ riêng của bạn, và công việc bạn đã có sẽ sẵn sàng để dùng lại. Bạn không cần tài khoản, và việc tạo và xuất chạy trên thiết bị của bạn.

::: timeline
- <!--i:sparkle--> **Tạo một tệp.** [Make your first file](/info/make-something.html) hướng dẫn bạn làm một mã QR trong vài phút.
- <!--i:palette--> **Đưa thương hiệu của bạn vào.** Bắt đầu từ một màu, một tệp token hoặc một thiết kế hoàn chỉnh.
- <!--i:layers--> **Tạo thêm nhiều bản giống vậy.** Chia sẻ một liên kết, điền một bảng tính hoặc chạy công cụ từ một tập lệnh.
:::

Mới làm quen với ý tưởng này? [What is Lolly?](/info/what-is-lolly.html) là phần giới thiệu năm phút, và [How Lolly works](/info/how-lolly-works.html) cho thấy ai làm gì.

## Đưa thương hiệu của bạn vào

lolly.tools mở ra với **Lolly Demo**, hệ thống thiết kế mẫu của chính Lolly; [Meet Lolly Demo](/info/lolly-demo.html) cho thấy bạn đang nhìn vào gì. Hệ thống thiết kế của bạn thay thế nó: một bộ nhỏ các design token, tức màu sắc, phông chữ và vài quy tắc, mà mọi công cụ đều dùng để vẽ. Thiết lập một lần, và mọi thứ bạn tạo ra đều bắt đầu đúng thương hiệu.

Hãy chọn lộ trình phù hợp với những gì bạn có:

- <!--i:palette--> **Một màu.** Mở **Design System Setup** (`#/start`), đặt tên cho hệ thống thiết kế và chọn một màu chính. Lolly suy ra từ đó một bảng màu hoàn chỉnh, dễ tiếp cận, với các bề mặt sáng và tối, văn bản và màu nhấn. Chọn một phông chữ là bạn có một thương hiệu dùng được.
- <!--i:upload--> **Một tệp token.** **Add from…**, ở chân thanh phòng trong Design System Setup, nhận tệp token DTCG, Tokens Studio hoặc Penpot, một SVG hay một gói `LollyBrand`. Thả vào và bảng màu tự điền. Khi hệ thống thiết kế còn trống, **Start from a reference** trong phòng Overview mở cùng bộ chọn đó.
- <!--i:pentool--> **Một thiết kế hoàn chỉnh.** Trong Design, chọn **Import a design** và thả tệp `.fig`, `.penpot`, `.ai`, `.idml` hoặc SVG. Xem [Đưa vào những gì bạn đã có](#bring-in-what-you-already-have) bên dưới.

Lần đầu bạn mở thư viện, một lời chào ngắn đưa ra cùng các lựa chọn đó: **Make it yours** mở Design System Setup, **Bring your design** mở bộ chọn tệp cho một thiết kế và **Explore the community tools** đóng lời chào.

![Phòng Colours của Design System Setup trên bản cài mới: một chip trực tiếp, một ô nhập và toàn bộ quyết định đầu tiên](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

Từ đó, bảy phòng đưa nó đi xa tùy ý bạn, theo thứ tự nào cũng được: **Overview**, **Colours**, **Type**, **Logos**, **Tokens**, **Files** và **Usage & rules**. Mọi bản xem trước trong ứng dụng cập nhật khi bạn gõ. [Design System Setup](/info/brand-studio.html) giới thiệu từng phòng.

Phông chữ được giữ trên thiết bị của bạn. Chọn một Google Font và Lolly lưu tệp như một tài nguyên thương hiệu, nên kiểu chữ của bạn đi cùng ngoại tuyến và không có gì được tải khi một công cụ vẽ.

### Xem, chuyển đổi và chia sẻ một hệ thống thiết kế

- **Xem hệ thống đang dùng.** **Settings → Design system** hiển thị hệ thống thiết kế đang dùng dưới dạng một bìa và các trang, chỉ đọc.
- **Chuyển giữa các hệ thống.** **Settings → Preferences → Design systems** liệt kê mọi hệ thống thiết kế trên thiết bị này. Một tổ chức có thể chạy nhiều hệ thống thiết kế, hoặc một hệ thống với nhiều colourway; [Brand architectures](/info/brand-architectures.html) vẽ ra các cách sắp xếp.
- **Chia sẻ một hệ thống.** Xuất hệ thống thiết kế thành một gói `LollyBrand`: một tệp mà đồng nghiệp nhập vào để có cùng bảng màu, phông chữ và quy tắc.

Một hệ thống thiết kế do bản dựng hoặc tổ chức của bạn cung cấp là **được quản lý**: nó hiện một khóa và chỉ đọc. Để thay đổi, hãy tạo một bản sao có thể chỉnh sửa từ **Settings → Preferences → Design systems**.

![Thẻ Design system trong Settings: hệ thống thiết kế đang dùng dưới dạng một bìa và các trang](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Hệ thống thiết kế của bạn là các token DTCG, định dạng mà Penpot đọc và ghi và Tokens Studio mang vào Figma, nên bảng màu bạn thiết kế và bảng màu Lolly áp dụng là cùng một tài liệu. [Design Tokens](/info/design-tokens.html) có chi tiết.

::: details Dành cho nhà phát triển: dựng gói thương hiệu từ dòng lệnh
Để dựng một gói thương hiệu dùng lại được trong một checkout, `ingest:brand` nhận ba dạng chứa mà Penpot và Tokens Studio xuất: một tệp `tokens.json` đơn, một thư mục chứa các tệp theo từng bộ với `$metadata.json`, hoặc một kho lưu trữ `project.penpot`.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` đăng ký thương hiệu như một hồ sơ (profile) và dựng cùng kiểm tra danh mục của nó. Nó không bao giờ đổi hồ sơ mặc định: chạy với `LOLLY_PROFILE=acme` để dùng gói mới. [Configuration](/info/configuration.html) giải thích cách các gói thương hiệu và hồ sơ khớp với nhau.
:::

## Đưa vào những gì bạn đã có

Bạn không phải bắt đầu từ trang trống.

**Tệp thiết kế.** Tác phẩm hoàn chỉnh từ Figma, Penpot, Illustrator, InDesign hoặc bất kỳ ứng dụng SVG nào mở trong Design như một bố cục sống: văn bản vẫn gõ lại được, hình khối vẫn là hình khối và ảnh vào thư viện của bạn. Tệp được đọc trong trình duyệt và không có gì được tải lên. [Import a design](/info/design-import.html) liệt kê từng định dạng và những gì được mang sang.

**Bộ trình chiếu.** Thả một tệp PowerPoint `.pptx` vào Lolly để lưu các trang chiếu của nó thành tài nguyên, viết bộ trình chiếu mới từ Markdown trong **Markdown Slides**, hoặc dùng [Rebrand a deck](/info/rebrand.html) để chuyển cả bộ trình chiếu sang hệ thống thiết kế của bạn.

**Dữ liệu.** Dán hoặc thả một bảng CSV hay JSON và các trường lặp của công cụ sẽ điền từ đó, hoặc [Batch](/info/batch.html#make-many-versions-of-one-design) tạo một tệp hoàn chỉnh cho mỗi hàng.

### Từ một bản làm một lần thành một mẫu

Một bố cục đã nhập là một phiên Design bình thường. **Share with rules** biến nó thành một công cụ: bạn chọn những phần nào người khác được đổi, và họ chỉ điền vào những phần đó.

![Giữ bản gốc Design, chọn đầu vào và giới hạn trong một bản soạn, rồi chia sẻ một công cụ .lolly dùng lại được để người nhận điền vào](/info/diagrams/concepts/share-with-rules.svg)

[Share a design with rules](/info/create-a-tool.html) hướng dẫn từng bước.

## Tạo nhiều bản, chia sẻ và tự động hóa

- <!--i:download--> **Xuất.** Các công cụ tạo SVG, PDF, PNG, JPG, WebP, video và nhiều hơn nữa, theo các định dạng mỗi công cụ cung cấp, ở kích thước in thật khi bạn cần. Xem [Export a file](/info/exporting.html).
- <!--i:link--> **Chia sẻ một liên kết.** Cài đặt của công cụ đi cùng trong liên kết, nên liên kết mở lại đúng tệp đó ở bất cứ đâu.
- <!--i:layers--> **Tạo một bản cho mỗi hàng.** Điều khiển công cụ từ bảng tính trong [Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Tự động hóa.** Cùng một lần kết xuất chạy được từ [CLI](/info/cli.html) và từ một [tác tử AI](/info/ai-agents.html).

Một liên kết là một yêu cầu hoàn chỉnh. Không ai vẽ biểu đồ bên dưới: loại, tiêu đề và toàn bộ bảng dữ liệu của nó được gõ vào thanh địa chỉ, và cùng liên kết đó vẽ cùng biểu đồ trên mọi thiết bị.

![Biểu đồ vùng thể hiện lượt đăng ký hàng tháng, mỗi giá trị trong đó đến từ một tham số truy vấn thay vì một cú nhấp chuột](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Đi tiếp từ đâu

- <!--i:people--> **[Create](/info/creators.html)**: tạo, tạo chuyển động, ghi, chia sẻ và xuất.
- <!--i:code--> **[Automate](/info/builders.html)**: hệ thống thiết kế, viết công cụ, dòng lệnh, liên kết và tác tử.
- <!--i:usercheck--> **[Manage](/info/operators.html)**: vận hành Lolly cho một nhóm với Lolly Work.
- <!--i:server--> **[Deploy](/info/operate.html)**: lưu trữ Lolly và Lolly Work.
- <!--i:shieldcheck--> **[Trust](/info/trust.html)**: quyền riêng tư, bảo mật và tự kiểm tra một tệp.
