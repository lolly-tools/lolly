# Kiến trúc Lolly

![Biểu tượng Lolly - chiếc kẹo mút lớn màu xanh lá và trắng](/info/icon.svg)

Trang này dành cho người thay đổi mã của Lolly: cách bộ máy, các lớp vỏ và các gói công cụ phối hợp với nhau, vị trí của từng phần trong kho mã và các cam kết ràng buộc mọi thay đổi. Để tìm hiểu Lolly làm gì và ai dùng Lolly, hãy đọc [Cách Lolly hoạt động](/info/how-lolly-works.html) trước.

[`engine/README.md`](https://github.com/lolly-tools/lolly/blob/main/engine/README.md) mô tả bộ máy theo từng mô-đun và được tạo từ mã. [Mô hình mối đe dọa & ranh giới tin cậy](/info/threat-model.html) nhìn cùng kiến trúc đó dưới góc độ ranh giới tin cậy và nêu những gì bộ máy coi là không đáng tin cậy.

<!--i:eti-layers-->
## Bức tranh tổng thể

Công cụ là dữ liệu ở tầng trên cùng. Bộ máy ở giữa không biết gì về bất kỳ nền tảng nào. Các lớp vỏ ở dưới cùng triển khai một hợp đồng và các danh mục cung cấp nội dung.

![Công cụ cung cấp manifest, mẫu và hook cho bộ máy dùng chung. Các lớp vỏ Web, Tauri và terminal triển khai cầu nối năng lực HostV1 và đọc công cụ cùng tài nguyên từ danh mục.](/info/diagrams/concepts/platform-layers.svg)

Bất cứ thứ gì bạn có thể mô tả bằng dữ liệu thuần và Handlebars đều thuộc về **bộ máy**. Bất cứ thứ gì chạm đến DOM, hệ thống tệp, mạng hoặc bất kỳ API nào của trình duyệt hay hệ điều hành đều thuộc về **host**, phần của lớp vỏ ở phía cầu nối. Bộ máy có mã nguồn mở. Không có gì biết về một thương hiệu cụ thể được đưa vào bộ máy.

<!--i:eti-folder-shared-->
## Bố cục kho mã

Lolly là một kho mã duy nhất. Mỗi thư mục bên dưới đều là thư mục thông thường, trừ `brands/suse`: một git submodule **riêng tư** chứa gói công cụ và danh mục SUSE mà bản sao công khai không tải về. Một hồ sơ nội dung (`profiles.json`) quy định bản dựng đọc những gói nào. Mỗi tiến trình tự xác định hồ sơ của mình và không có công tắc toàn cục. [Hướng dẫn dựng](/info/build-guide.html) có lệnh sao chép kho mã và cách commit một thay đổi trong gói riêng tư.

| Thư mục | Nội dung |
|---|---|
| `engine/` | Lõi độc lập với nền tảng: bộ nạp, môi trường chạy, đầu vào, mẫu, chế độ URL, đơn vị và các mô-đun định dạng |
| `shells/` | Ứng dụng web, ứng dụng máy tính và di động Tauri, CLI, TUI và tiện ích mở rộng trình duyệt |
| `packages/` | SDK cho tác giả công cụ (`@lolly-tools/core`), các phần dùng chung của lớp vỏ Node và trình kết xuất tài liệu, cùng các thành phần khác |
| `community/` | Các công cụ không gắn với thương hiệu, cùng các gói emoji dùng chung |
| `brands/` | Các gói thương hiệu: `lolly-demo` (Lolly Demo, hệ thống thiết kế mà lolly.tools dùng), `lolly-start` (bộ khởi đầu trống) và `suse` riêng tư |
| `services/` | Các dịch vụ MCP, chứng chỉ và Penpot tùy chọn, cùng mã máy chủ dùng chung của chúng |
| `schemas/` | JSON Schema cho các manifest công cụ, mục tài nguyên và tham chiếu tài nguyên |
| `scripts/`, `tests/`, `docs/`, `api/` | Các script dựng và tạo danh mục, bộ kiểm thử bộ máy, tài liệu này và các gói serverless được tạo ra |

::: details Các tệp của bộ máy và lớp vỏ bạn gặp đầu tiên
```
engine/src/
  index.ts          public surface: loader, runtime, template, inputs, url-mode
  loader.ts         fetches and validates tool files
  runtime.ts        orchestrates one mounted tool, from load to export
  template.ts       Handlebars hydration and annotateTemplate
  inputs.ts         manifest to runtime input model
  url-mode.ts       URL to input state and back
  validate.ts       JSON Schema validation of manifests
  compose.ts        nested tool renders (composes)
  embed.ts          portable lolly.tools embed URLs
  bridge/host-v1.ts type re-export of the @lolly-tools/core contract

shells/web/src/
  main.ts           boot and routing
  bridge/           the web implementations of the host APIs
  catalog/sync.ts   boot-time catalog sync and offline cache
  views/            the gallery, tool, projects, free canvas and the other views
  pro/              Batch (#/batch)

shells/cli/         bin/lolly.ts (entry), src/run.ts (headless render), src/bridge.ts
shells/tui/         src/main.tsx (the full-screen app), src/bridge.ts
```
:::

::: note Không có thư mục `tools/` hay `catalog/` ở gốc kho mã
`packages/node-shell/src/content-roots.ts` trả lời "công cụ `<id>` nằm ở đâu" và "danh mục ở đâu" dựa trên `profiles.json`. Cặp `tools/` và `catalog/` thực chỉ được ghi vào đầu ra của bản dựng, như `dist/`, nội dung gói RPM hoặc ảnh container, vì trình duyệt tải hai đường dẫn đó qua HTTP.
:::

<!--i:eti-monitor-->
## Lolly chạy ở đâu

Mọi giao diện đều dùng cùng bộ máy và cùng các tệp công cụ.

- **Ứng dụng web.** Một ứng dụng web tiến bộ. Nó hoạt động ngoại tuyến sau khi service worker đã lưu công cụ và tài nguyên vào bộ nhớ đệm. Không cần tài khoản và trạng thái nằm trong IndexedDB trên từng thiết bị. Một bố cục đáp ứng dùng cho cả máy tính và điện thoại. Trên điện thoại, các điều khiển chuyển thành một bảng và các điều khiển xuất mở từ một viên thuốc nổi.
- **Ứng dụng máy tính và di động.** Các gói Tauri của cùng ứng dụng web, với hộp thoại tệp gốc, trạng thái lưu trên hệ thống tệp và khả năng sử dụng hoàn toàn ngoại tuyến.
- **CLI.** `lolly <tool-id> --input=value --output=file.png` nạp cùng bộ máy trong một DOM không giao diện và ghi tệp. Đó là chế độ URL qua một kênh truyền khác. Xem [CLI](/info/cli.html).
- **TUI.** Một ứng dụng terminal toàn màn hình, ưu tiên bàn phím. Nó dùng lại cầu nối của CLI và giữ các phiên đã lưu trên đĩa: trong thư mục của ứng dụng máy tính khi ứng dụng đã được cài, nếu không thì dưới `~/.lolly`. Nó chỉ khởi chạy một trình duyệt không giao diện với phạm vi giới hạn khi định dạng cần đến. Xem [TUI](/info/tui.html).

![Chế độ xem chia đôi trên máy tính: các điều khiển được tạo từ manifest bên trái, canvas trực tiếp bên phải](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

Ở chiều rộng màn hình điện thoại, bảng điều khiển nằm phía trên và bản xem trước lấp đầy màn hình.

![Một audiogram trên màn hình rộng 430px: bảng điều khiển phía trên, tác phẩm vuông hoàn chỉnh phía dưới và viên thuốc xuất nổi](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dzzfxm%3A7%3Alofi%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

Ứng dụng web cũng có **Batch** (`#/batch`, `shells/web/src/pro/`), một lưới kiểu bảng tính kết xuất nhiều hàng cùng lúc qua một hoặc nhiều công cụ. Xem [Batch và Lolly Multi-edit](/info/batch.html#make-many-versions-of-one-design). **Settings → Capabilities** liệt kê mọi thứ nền tảng khai báo có thể làm.

![Batch trên bản cài đặt mới: một hàng trống chờ công cụ, với giao diện bảng tính và nút Render có sẵn trước khi có dữ liệu](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

<!--i:eti-lock-->
## Các cam kết về kiến trúc

Những quyết định này đã được chốt. Mọi quyết định khác trong cơ sở mã đều phụ thuộc vào chúng, nên thay đổi một quyết định là việc lớn.

### 1. Công cụ khai báo, với lối mở cho mã mệnh lệnh

Một công cụ gồm manifest (`tool.json`), mẫu (`template.html`) và `hooks.js` tùy chọn. **Manifest khai báo các đầu vào**. Đầu vào không bao giờ được suy ra từ các token Handlebars của mẫu. Hầu hết công cụ chỉ gồm manifest và mẫu, nên người không phải lập trình viên cũng có thể tạo chúng.

![Ngăn xếp điều khiển của Street Map: danh sách thành phố thả xuống, bộ chọn chủ đề, thanh trượt độ dày và nút mở bảng màu, mỗi điều khiển đều được tạo từ một dòng manifest](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Các công cụ tính toán giá trị, như mã hóa QR hoặc tạo hình biểu đồ, bổ sung hook: các hàm vòng đời có tên mà môi trường chạy gọi với cầu nối năng lực được truyền vào. Hook là hợp đồng về khả năng chuyển đổi giữa các nền tảng, không phải sandbox bảo mật. Chúng chạy trong một hạn mức thời gian. Các công cụ có hook đã được chứng minh không dùng biến toàn cục của trang mang `isolate: true` và chạy trong Worker. [Hook của công cụ](/info/tool-hooks.html) nêu vòng đời và hạn mức. [Mô hình mối đe dọa](/info/threat-model.html) nêu những gì bộ thực thi trong trang ngăn chặn và không ngăn chặn.

### 2. Công cụ và tài nguyên là dữ liệu, không phải mã đóng gói

Ứng dụng web và Tauri tải danh mục công cụ và tài nguyên lúc khởi động, lưu vào bộ nhớ đệm và làm việc với những gì đã lưu. Một công cụ hay tài nguyên mới không cần phát hành ứng dụng. Các byte tài nguyên được kiểm tra bằng tổng kiểm SHA-256. `id` và `version` của tài nguyên quyết định việc vô hiệu hóa bộ nhớ đệm.

### 3. Cầu nối năng lực là API duy nhất công cụ thấy

Công cụ không bao giờ chạm đến DOM bên ngoài mẫu của mình, không bao giờ gọi trực tiếp `fetch` và không bao giờ đọc hệ thống tệp. Chúng gọi các phương thức `host.*` có phiên bản. Hợp đồng được định nghĩa trong `packages/core/src/host-v1.ts`, thuộc SDK cho tác giả công cụ `@lolly-tools/core`. Bên thứ ba có thể xây dựng dựa trên SDK mà không phụ thuộc vào bộ máy. `engine/src/bridge/host-v1.ts` tái xuất các kiểu của nó.

| API bắt buộc | Chức năng |
|---|---|
| `host.profile` | Thông tin người dùng; điền sẵn đầu vào qua `bindToProfile` |
| `host.assets` | Truy vấn danh mục, phân giải tài nguyên và bộ chọn của host |
| `host.state` | Lưu và nạp các ô đầu vào: IndexedDB trên web, hệ thống tệp trong Tauri, bộ nhớ trong CLI |
| `host.clipboard` | Ghi văn bản hoặc ảnh vào clipboard, với phương án dự phòng theo nền tảng |
| `host.export` | Điểm ảnh hóa hoặc tuần tự hóa đối tượng kết xuất và đường biến đổi tệp trên thiết bị |
| `host.log` | Ghi nhật ký theo cấp độ vào host |

Mọi API khác đều là tùy chọn và được bổ sung thêm: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` và nhiều API khác. `requires` của manifest liệt kê các API tùy chọn mà hook của nó gọi mà không kiểm tra trước. Host thiếu một trong số đó sẽ từ chối gắn công cụ. Hook kiểm tra sự hiện diện của các tính năng còn lại. Một số, như `recorder`, còn cần một khả năng của thiết bị mà công cụ khai báo. `packages/core/src/host-v1/apis.ts` liệt kê tất cả và [Host API](/info/host-api.html) mô tả từng API. Thêm một phương thức là phiên bản phụ. Xóa hoặc thay đổi một phương thức là phiên bản chính và v1 vẫn hoạt động khi v2 ra mắt.

### 4. Id tài nguyên là vĩnh viễn

`lolly/logo/primary` là một hợp đồng. Khi đã công bố, id không bao giờ thay đổi và không bao giờ được dùng lại. Thay đổi byte sẽ tăng `version` trong mục tài nguyên. Tài nguyên bị thay thế được đặt `deprecated: true` và có thể thêm `replacedBy`. Các tham chiếu hiện có luôn phân giải được, nên các phiên đã lưu và liên kết đã chia sẻ tiếp tục hoạt động trong nhiều năm.

### 5. Chế độ URL được hỗ trợ đầy đủ

Mọi đầu vào đều biểu diễn được bằng tham số URL, nên một liên kết là một tệp hoàn chỉnh:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Chỉ riêng liên kết đó, không có gì khác, là tệp hoàn chỉnh](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Đổi một tham số và bạn có một tệp khác. Bảng màu này gồm một màu gốc, một cách phối màu và một số bước:

![Chín bước qua bốn sắc màu, tất cả đều được tạo từ một màu gốc duy nhất trong liên kết](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

CLI dựng cùng trạng thái URL từ các đối số của nó và chạy cùng quy trình, nên CLI không thể lệch khỏi ứng dụng. `engine/src/url-mode.ts` phân tích và tuần tự hóa trạng thái URL. Các tên dành riêng (`format`, `width`, `dpi`, `c2pa`, `z` và những tên khác) không bao giờ được truyền cho công cụ. [Các tham số URL dành riêng](/info/url-parameters.html) liệt kê tất cả. Đầu vào tài nguyên được chuyển bằng `id` và phân giải qua `host.assets.get()` trước khi mẫu được điền.

### 6. Lưu trữ đi qua cầu nối

Ứng dụng web dùng IndexedDB, Tauri dùng hệ thống tệp và CLI dùng bộ nhớ. Công cụ chỉ thấy `host.state.save(slot, data)` và `host.state.load(slot)`, không bao giờ thấy `localStorage`. Người dùng có thể giữ nhiều phiên có tên cho mỗi công cụ mà không cần tài khoản. Vì cầu nối là điểm tiếp giáp duy nhất, trạng thái đó cũng có thể chuyển đi. `shells/web/src/data-transfer.ts` xuất trạng thái thành một tệp `lolly-backup` có thể nhập vào bất kỳ bản cài đặt nào khác ([Chuyển dữ liệu](/info/data-transfer.html)). [Sync](/info/sync.html) gửi cùng gói đó đến nơi lưu trữ do người dùng chọn.

### 7. Nhãn mức độ hoàn thiện cho biết công cụ thuộc loại nào

Mọi công cụ đều khai báo `status: official | community | experimental`. Gallery sắp xếp theo trạng thái. Công cụ thử nghiệm mặc định thêm hình mờ vào bản xuất: môi trường chạy bật hình mờ trừ khi bên gọi truyền `watermark: false`. Công cụ xử lý trên thiết bị được miễn. Quy trình danh mục riêng của nhóm được xây dựng dựa trên các nhãn này.

### 8. Đầu vào được định kiểu trong manifest

Một đầu vào khai báo `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` hoặc `file`. Host kết xuất một điều khiển cho mỗi kiểu, nên công cụ không phải viết mã điều khiển. Bất kỳ đầu vào nào cũng có thể mang `bindToProfile`. Ba kiểu quan trọng nhất:

- **`asset`**, với `filter` và `allowUpload`, là cầu nối đến hệ thống tài nguyên. `allowUpload: false` giới hạn một ô ở các tài nguyên thư viện. Tệp người dùng tải lên dùng cùng cấu trúc `AssetRef` của thư viện.
- **`blocks`** là một nhóm trường lặp được chỉnh sửa trong bảng bên, được Meeting Planner, Wayfinding, Diagrams và các công cụ khác dùng. Nhấp vào một khối đã kết xuất sẽ lấy tiêu điểm hàng của nó.
- **`file`** giữ tệp riêng của người dùng trong bộ nhớ cho các tiện ích xử lý trên thiết bị như Lolly Strip Hidden Data và Compress, còn **`vector`** gom một tập hợp số cố định vào một điều khiển.

### 9. Mẫu không chứa logic

Mẫu dùng Handlebars, nên người không phải lập trình viên cũng có thể viết chúng. `{{x}}` thoát ký tự và `{{{x}}}` là lựa chọn phải bật rõ ràng. Logic nằm trong `hooks.js`, nơi có thể rà soát nó. Nhiều mẫu dùng `{{{` cho mã đánh dấu do hook tính ra, nên mỗi hook phải thoát ký tự trong nội dung nó chuyển sang. Các hàm trợ giúp gồm `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` và `media`, cùng `icsStamp`, `rfcText`, `csvCell` và `arrow` cho các mẫu `.ics`, `.vcf` và `.csv` đi kèm. [Mẫu và kết xuất](/info/tool-rendering.html) trình bày về chúng.

### 10. Công cụ kết hợp các công cụ

Một công cụ có thể nhúng bản kết xuất của công cụ khác mà không cần nhập mã giữa các công cụ. Bộ máy phân giải việc kết hợp. Manifest có thể khai báo `composes: [{ id, tool, inputs }]` và đặt phần con bằng `{{asset <id>}}`. URL nhúng có thể chuyển đi (`https://lolly.tools/tool/<id>.svg?…`) kết xuất phần con cục bộ; Lolly Design đặt mã QR hoặc biểu đồ trực tiếp theo cách này. Phần con SVG vẫn là vector trong phần cha SVG hoặc PDF. Các phần con là kết quả trung gian và không bao giờ có hình mờ hay dấu đóng. Lớp vỏ không kết xuất được phần con sẽ để trống ô đó và phần cha vẫn kết xuất. [Kết hợp và lớp phủ thương hiệu](/info/tool-composition.html) có chi tiết.

<!--i:eti-scissors-->
## Những gì chúng tôi chọn không làm

- **Không có JavaScript tùy ý trong mẫu.** Logic nằm trong `hooks.js`.
- **Không bắt buộc có máy chủ tài nguyên.** Người dùng thêm tệp riêng vào Assets trong ứng dụng và bàn giao công việc dưới dạng phiên: liên kết chia sẻ cho đầu vào và cài đặt, tệp `.lolly` khi cần chuyển cả tệp đã tải lên. Phiên được chia sẻ có thể trở thành mẫu trong bộ chọn của công cụ. Tổ chức muốn có danh mục được quản trị có thể dùng danh mục, phê duyệt và chính sách của Lolly Work hoặc quản lý gói thương hiệu trong git và rà soát thay đổi ở đó.
- **Không bắt buộc kiểm soát truy cập.** Ứng dụng mở mặc định là công khai. Nhãn mức độ hoàn thiện và hình mờ thể hiện rủi ro thương hiệu. Đăng nhập tổ chức, vai trò và chính sách do Lolly Work cung cấp khi nhóm muốn dùng.
- **Không có cơ sở dữ liệu trung tâm.** Trạng thái người dùng nằm trên từng thiết bị và Sync tùy chọn sao chép nó đến nơi lưu trữ người dùng chọn, không bao giờ đến cơ sở dữ liệu Lolly.
- **Không có đường thực thi mã dùng chung giữa công cụ và bộ máy.** Bộ máy và các công cụ cộng đồng có mã nguồn mở. Gói thương hiệu như `brands/suse/` riêng tư chứa công cụ và danh mục riêng theo điều khoản riêng. Không công cụ nào nhập mã từ `engine/`, nên hai phần luôn tách biệt rõ ràng.

<!--i:eti-refresh-->
## Vòng đời của một lần kết xuất

Một người mở `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Khởi động.** Ứng dụng web mở IndexedDB, dựng cầu nối năng lực và đồng bộ danh mục công cụ cùng tài nguyên hoặc nạp chúng từ bộ nhớ đệm khi ngoại tuyến.
2. **Định tuyến.** Đường dẫn chọn chế độ xem công cụ cho `qr-code`, với truy vấn làm các giá trị ban đầu.
3. **Nạp.** `loadTool` tải `tool.json`, kiểm tra tính hợp lệ theo lược đồ và tải mẫu, kiểu và hook.
4. **Phân tích liên kết.** `parseUrlState` chuyển các tham số thành giá trị đầu vào. Tham chiếu tài nguyên như `?logo=lolly/logo/primary` trở thành một `{ id }` chưa được phân giải.
5. **Khởi động môi trường chạy.** `createRuntime(tool, host, initialValues)` dựng mô hình đầu vào từ dữ liệu hồ sơ, giá trị mặc định và liên kết, phân giải tham chiếu tài nguyên, nạp hook và gọi `onInit`.
6. **Kết xuất.** Lớp vỏ đăng ký nhận cập nhật từ môi trường chạy, vẽ các điều khiển từ mô hình và ghi mẫu đã điền vào `#tool-canvas`.
7. **Tương tác.** Việc gõ gọi `runtime.setInput`, áp dụng các ràng buộc, gọi `onInput`, điền lại mẫu và vẽ lại.
8. **Xuất.** **Download** gọi `runtime.export(node, format)` và `host.export` của lớp vỏ tạo tệp: ảnh điểm, vector từ trình duyệt cây DOM, PDF, tài liệu hoặc một trong các định dạng khác trong `schemas/tool.schema.json`. Các đơn vị vật lý được chuyển đổi theo định dạng. Siêu dữ liệu và Content Credentials được nhúng khi định dạng chứa được chúng. Công cụ thử nghiệm nhận hình mờ từ host, không phải từ công cụ. [Mẫu và kết xuất](/info/tool-rendering.html) và [Xuất một tệp](/info/exporting.html) trình bày bước xuất.

![Bảng xuất mà ?options mở: cặp tên tệp và định dạng, kích thước đầu ra và các điều khiển ghi tệp](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Cùng vòng đời đó chạy trong Tauri và trong CLI với DOM không giao diện, nơi đầu ra được ghi vào tệp hoặc stdout.

<!--i:eti-stamp-->
## Giấy phép

Mã, bao gồm `engine/`, `shells/`, `services/`, `schemas/` và trình tạo tài liệu, dùng MPL-2.0, trong một kho mã công khai duy nhất, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). Phần văn bản tài liệu dùng CC BY-SA 4.0. Các gói thương hiệu có điều khoản riêng trong `NOTICE.md` của từng gói: công cụ cộng đồng dùng MPL-2.0 và gói SUSE riêng tư thuộc sở hữu độc quyền của SUSE. [Giới thiệu](/info/about.html) có ghi chú đầy đủ về giấy phép.
