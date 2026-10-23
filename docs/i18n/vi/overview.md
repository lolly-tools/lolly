# Kiến trúc Lolly

![Biểu tượng Lolly - kẹo mút lớn màu xanh lá và trắng](/info/icon.svg)

Trang này dành cho những người thay đổi mã của Lolly: engine, các shell và các gói công cụ khớp với nhau thế nào, mỗi thứ nằm ở đâu trong kho và những cam kết ràng buộc mọi thay đổi. Nếu bạn muốn biết Lolly làm gì và ai dùng nó, hãy đọc [How Lolly works](/info/how-lolly-works.html) trước.

Hai tài liệu đi kèm đi sâu hơn. [`engine/README.md`](../engine/README.md) là bản đồ từng module của engine, sinh từ mã. [Threat Model & Trust Boundaries](/info/threat-model.html) đọc cùng kiến trúc đó như các ranh giới tin cậy, và là trang cho mọi câu hỏi về việc engine coi gì là không đáng tin.

## Bức tranh tổng thể

Công cụ là dữ liệu ở trên cùng. Engine ở giữa không biết gì về bất kỳ nền tảng nào. Các shell ở dưới cùng hiện thực một hợp đồng, và các danh mục cung cấp nội dung.

![Công cụ cung cấp manifest, mẫu và hook cho engine dùng chung. Các shell web, Tauri và terminal hiện thực cầu khả năng HostV1 và đọc công cụ cùng tài nguyên từ các danh mục.](/info/diagrams/concepts/platform-layers.svg)

Nếu bạn mô tả được nó bằng dữ liệu thuần và Handlebars, nó thuộc về **engine**. Nếu nó chạm vào DOM, hệ thống tệp, mạng hoặc bất kỳ API trình duyệt hay hệ điều hành nào, nó thuộc về **host**, phía của shell trong cầu nối. Engine là mã nguồn mở, và không thứ gì biết về một thương hiệu hay nền tảng cụ thể được đưa vào engine.

## Bố cục kho mã

Lolly là một kho. Mọi thư mục dưới đây là thư mục thường trong đó, trừ `brands/suse`, một git submodule **riêng tư** chứa gói công cụ và danh mục SUSE, mà bản clone công khai không tải. Bản dựng đọc những gói nào là một hồ sơ nội dung (`profiles.json`), được phân giải theo từng tiến trình thay vì chuyển đổi toàn cục. [Build Guide](/info/build-guide.html) có lệnh clone và cách commit một thay đổi bên trong gói riêng tư.

| Thư mục | Nó chứa gì |
|---|---|
| `engine/` | Lõi độc lập nền tảng: loader, runtime, đầu vào, mẫu, chế độ URL, đơn vị và các module định dạng |
| `shells/` | Ứng dụng web, ứng dụng máy tính và di động Tauri, CLI, TUI và tiện ích mở rộng trình duyệt |
| `packages/` | SDK cho tác giả công cụ (`@lolly-tools/core`), các phần shell Node dùng chung và trình kết xuất tài liệu, cùng những thứ khác |
| `community/` | Các công cụ không gắn thương hiệu, cùng các gói emoji dùng chung |
| `brands/` | Gói thương hiệu: `lolly-demo` (Lolly Demo, hệ thống thiết kế mà lolly.tools chạy), `lolly-start` (bản khởi đầu trống) và `suse` riêng tư |
| `services/` | Các dịch vụ MCP, chứng chỉ và Penpot tùy chọn, và mã máy chủ chúng dùng chung |
| `schemas/` | JSON Schema cho manifest công cụ, mục tài nguyên và tham chiếu tài nguyên |
| `scripts/`, `tests/`, `docs/`, `api/` | Tập lệnh dựng và danh mục, bộ kiểm thử engine, các tài liệu này và các gói serverless được sinh ra |

::: details Các tệp engine và shell bạn gặp đầu tiên
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

Không có thư mục `tools/` hay `catalog/` ở gốc kho. `packages/node-shell/src/content-roots.ts` trả lời "công cụ `<id>` nằm ở đâu" và "danh mục nằm ở đâu" từ `profiles.json` khi được hỏi. Một cặp `tools/` và `catalog/` thật chỉ được ghi vào đầu ra bản dựng, như `dist/`, payload RPM hoặc ảnh container, vì trình duyệt tải hai đường dẫn đó qua HTTP.

## Lolly chạy ở đâu

Mọi bề mặt dùng cùng một engine và cùng các tệp công cụ.

- **Ứng dụng web.** Một ứng dụng web tiến bộ hoạt động ngoại tuyến khi service worker của nó đã lưu đệm công cụ và tài nguyên. Không cần tài khoản; trạng thái nằm trong IndexedDB trên từng thiết bị. Một bố cục đáp ứng phục vụ cả máy tính và điện thoại: trên điện thoại, các điều khiển thành một tấm và các điều khiển xuất mở từ một viên thuốc nổi.
- **Ứng dụng máy tính và di động.** Các gói Tauri của cùng ứng dụng web, với hộp thoại tệp gốc, trạng thái hệ thống tệp và dùng ngoại tuyến đầy đủ.
- **CLI.** `lolly <tool-id> --input=value --output=file.png` nạp cùng engine trong một DOM không giao diện và ghi tệp. Đó là chế độ URL qua một đường truyền khác, không phải hiện thực riêng. Xem [CLI](/info/cli.html).
- **TUI.** Ứng dụng terminal toàn màn hình, ưu tiên bàn phím, dùng lại cầu của CLI, giữ các phiên đã lưu trên đĩa (trong thư mục riêng của ứng dụng máy tính khi ứng dụng được cài, nếu không thì dưới `~/.lolly`) và chỉ khởi động một trình duyệt không giao diện có phạm vi khi định dạng cần. Xem [TUI](/info/tui.html).

![Chế độ chia đôi trên máy tính: các điều khiển sinh từ manifest ở bên trái, canvas trực tiếp ở bên phải](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

Cùng công cụ đó ở chiều rộng điện thoại không cần bố cục thứ hai: các điều khiển thành một tấm ở trên cùng và bản xem trước giữ màn hình.

![Một audiogram trên màn hình rộng 430px: tấm điều khiển ở trên, tác phẩm vuông hoàn chỉnh ở dưới và viên thuốc xuất nổi](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

Ứng dụng web cũng có **Batch** (`#/batch`, `shells/web/src/pro/`), một lưới kiểu bảng tính kết xuất nhiều hàng cùng lúc qua một hoặc nhiều công cụ; [Batch and Multi-edit](/info/batch.html#make-many-versions-of-one-design) đề cập Batch. **Settings → Capabilities** vẽ ra mọi thứ nền tảng khai báo là làm được.

![Batch trên bản cài mới: một hàng trống chờ một công cụ, với bề mặt bảng tính và nút Render đã sẵn trước khi có dữ liệu](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

## Cam kết kiến trúc

Những quyết định này đã chốt. Thay đổi bất kỳ cái nào là một việc lớn, vì chúng định hình mọi quyết định khác trong mã nguồn.

### 1. Công cụ khai báo, kèm lối thoát mệnh lệnh

Một công cụ là một manifest (`tool.json`), một mẫu (`template.html`) và `hooks.js` tùy chọn. **Manifest khai báo các đầu vào**, không bao giờ là mẫu: đầu vào không được suy ra từ token Handlebars. Hầu hết công cụ chỉ gồm manifest và mẫu, đó là điều cho phép người không phải lập trình viên soạn chúng.

![Chồng điều khiển của Street Map: danh sách thả xuống thành phố, ô chọn chủ đề, thanh trượt độ đậm và bộ kích hoạt màu, mỗi cái đều vẽ từ một dòng manifest](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Các công cụ tính toán giá trị, như mã hóa QR hay định hình biểu đồ, thêm hook: các hàm vòng đời có tên mà runtime gọi với cầu khả năng được tiêm vào. Hook là hợp đồng khả chuyển, không phải sandbox bảo mật, và chúng chạy trong một ngân sách thời gian. Các công cụ có hook được chứng minh không dùng biến toàn cục của trang mang `isolate: true` và chạy trong Worker. [Tool hooks](/info/tool-hooks.html) có vòng đời và ngân sách, và [Threat Model](/info/threat-model.html) nói bộ thực thi trong trang chứa được gì và không chứa được gì.

### 2. Công cụ và asset là dữ liệu, không phải mã đóng gói

Các ứng dụng web và Tauri tải danh mục công cụ và tài nguyên khi khởi động, lưu đệm và làm việc với những gì có đó, nên một công cụ hay tài nguyên mới không cần bản phát hành ứng dụng. Byte tài nguyên được checksum SHA-256, và `id` cùng `version` của tài nguyên điều khiển việc làm mới bộ nhớ đệm.

### 3. Cầu khả năng là API duy nhất công cụ thấy

Công cụ không bao giờ chạm vào DOM ngoài mẫu của mình, không bao giờ gọi `fetch` trực tiếp và không bao giờ đọc hệ thống tệp. Chúng gọi các phương thức `host.*` có phiên bản. Định nghĩa chuẩn của hợp đồng là `packages/core/src/host-v1.ts`, SDK cho tác giả công cụ `@lolly-tools/core`, để bên thứ ba có thể dựng trên đó mà không phụ thuộc engine; `engine/src/bridge/host-v1.ts` xuất lại các kiểu của nó.

| API bắt buộc | Tác dụng |
|---|---|
| `host.profile` | Thông tin người dùng; điền sẵn đầu vào qua `bindToProfile` |
| `host.assets` | Truy vấn danh mục, phân giải tài nguyên và bộ chọn của host |
| `host.state` | Lưu và nạp các ô đầu vào: IndexedDB trên web, hệ thống tệp trong Tauri, bộ nhớ trong CLI |
| `host.clipboard` | Ghi văn bản hoặc ảnh vào clipboard, với phương án dự phòng theo nền tảng |
| `host.export` | Điểm ảnh hóa hoặc tuần tự hóa đích kết xuất, và đường biến đổi tệp trên thiết bị |
| `host.log` | Ghi nhật ký có cấp độ tới host |

Mọi API khác là tùy chọn và bổ sung: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` và nhiều hơn nữa. Manifest của công cụ liệt kê dưới `requires` các API tùy chọn mà hook gọi không kiểm tra trước, và host thiếu một API sẽ từ chối gắn công cụ; hook tự phát hiện tính năng cho phần còn lại. Một vài API, như `recorder`, còn cần khả năng thiết bị mà công cụ khai báo. `packages/core/src/host-v1/apis.ts` liệt kê tất cả và [Host API](/info/host-api.html) ghi lại từng cái. Thêm một phương thức là phiên bản phụ; gỡ hoặc đổi một phương thức là phiên bản chính, và v1 vẫn hoạt động khi v2 ra mắt.

### 4. Id tài nguyên là mãi mãi

`lolly/logo/primary` là một hợp đồng. Một khi đã xuất bản, một id không bao giờ đổi và không bao giờ được dùng lại. Thay đổi byte làm tăng `version` trong mục tài nguyên, và bản thay thế đặt `deprecated: true` và, tùy chọn, `replacedBy`, để các tham chiếu hiện có luôn phân giải được. Đó là điều giữ các phiên đã lưu và liên kết đã chia sẻ hoạt động nhiều năm.

### 5. URL mode là hạng nhất

Mọi đầu vào đều biểu đạt được bằng tham số URL, nên một liên kết là một tệp hoàn chỉnh:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Chính liên kết đó, không gì khác bên trong, là tệp hoàn chỉnh](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Đổi một tham số và bạn có một tệp khác. Toàn bộ bảng màu này là một màu gốc, một hòa sắc và một số bước:

![Chín bước qua bốn tông màu, tất cả đều lớn lên từ một màu hạt giống duy nhất mang trong liên kết](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

CLI dựng cùng trạng thái URL từ các đối số của nó và chạy cùng đường ống, nên CLI không thể lệch khỏi ứng dụng. `engine/src/url-mode.ts` phân tích và tuần tự hóa; một tập tên dành riêng (`format`, `width`, `dpi`, `c2pa`, `z` và những tên khác) không bao giờ được chuyển cho công cụ, và [Reserved URL parameters](/info/url-parameters.html) liệt kê tất cả. Đầu vào tài nguyên đi theo `id` và được phân giải qua `host.assets.get()` trước khi mẫu được điền.

### 6. Lưu trữ đi qua cầu

Ứng dụng web dùng IndexedDB, Tauri dùng hệ thống tệp và CLI dùng bộ nhớ. Công cụ chỉ thấy `host.state.save(slot, data)` và `host.state.load(slot)`, không bao giờ là `localStorage`. Mọi người có thể giữ nhiều phiên có tên cho mỗi công cụ mà không cần tài khoản. Vì cầu là đường nối duy nhất, trạng thái đó cũng khả chuyển: `shells/web/src/data-transfer.ts` đọc nó ra thành một tệp `lolly-backup` nhập được trên mọi bản cài khác ([Data transfer](/info/data-transfer.html)), và [Sync](/info/sync.html) gửi cùng gói đó tới nơi lưu trữ mà người dùng chọn.

### 7. Nhãn độ trưởng thành cho biết một công cụ là gì

Mỗi công cụ khai báo `status: official | community | experimental`. Thư viện sắp xếp theo trạng thái, và các công cụ experimental đóng hình mờ lên bản xuất theo mặc định: runtime bật hình mờ trừ khi bên gọi truyền `watermark: false`, và các công cụ chạy trên thiết bị được miễn. Bất kỳ quy trình nào một đội đặt quanh danh mục đều nằm trên nền này.

### 8. Đầu vào có kiểu trong manifest

Một đầu vào khai báo một `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` hoặc `file`. Host kết xuất một điều khiển cho mỗi kiểu, nên công cụ không viết mã điều khiển, và đầu vào nào cũng có thể mang `bindToProfile`. Ba kiểu có trọng lượng nhất:

- **`asset`**, với `filter` và `allowUpload`, là cầu tới hệ thống tài nguyên. `allowUpload: false` giới hạn một ô vào tài nguyên thư viện, và tệp người dùng tải lên dùng chung dạng `AssetRef` của thư viện.
- **`blocks`** là nhóm trường lặp được chỉnh trong bảng bên, dùng bởi Meeting Planner, Wayfinding, Diagrams và những công cụ khác. Nhấp một khối đã kết xuất sẽ đưa tiêu điểm vào hàng của nó.
- **`file`** giữ tệp của chính người dùng trong bộ nhớ cho các tiện ích trên thiết bị như Strip Hidden Data và Compress, và **`vector`** gom một bộ số cố định thành một điều khiển.

### 9. Mẫu không có logic

Mẫu là Handlebars, được chọn để người không phải lập trình viên viết được: `{{x}}` thoát ký tự, và `{{{x}}}` là lựa chọn rõ ràng. Logic nằm trong `hooks.js`, nơi nó tường minh và xem xét được. Nhiều mẫu dùng `{{{` cho markup mà hook tính ra, nên mỗi hook phải thoát những gì nó trao. Các helper là `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` và `media`, cộng `icsStamp`, `rfcText`, `csvCell` và `arrow` cho các mẫu `.ics`, `.vcf` và `.csv` anh em. [Templates and rendering](/info/tool-rendering.html) đề cập chúng.

### 10. Công cụ ghép công cụ

Một công cụ có thể nhúng bản kết xuất của công cụ khác mà không có import giữa các công cụ; engine phân giải việc ghép. Một manifest có thể khai báo `composes: [{ id, tool, inputs }]` và đặt công cụ con bằng `{{asset <id>}}`, và một URL nhúng khả chuyển (`https://lolly.tools/tool/<id>.svg?…`) kết xuất công cụ con cục bộ, đó là cách Design đặt mã QR hay biểu đồ trực tiếp. Công cụ con SVG vẫn là vector trong cha SVG hoặc PDF. Công cụ con là sản phẩm trung gian, không bao giờ bị đóng hình mờ hay đóng dấu, và shell không kết xuất được một công cụ con sẽ để ô trống trong khi cha vẫn kết xuất. [Composition and brand overlays](/info/tool-composition.html) có chi tiết.

## Những gì chúng tôi chọn không làm

- **Không có JavaScript tùy ý trong mẫu.** Logic nằm trong `hooks.js`.
- **Không có máy chủ tài nguyên bắt buộc.** Mọi người thêm tệp của riêng mình vào Assets trong ứng dụng và chuyển tiếp công việc dưới dạng phiên: liên kết chia sẻ cho đầu vào và cài đặt, tệp `.lolly` khi tệp tải lên cũng đi cùng. Một phiên chung có thể trở thành mẫu trong bộ chọn của công cụ. Một tổ chức muốn danh mục được quản trị có thể dùng danh mục, phê duyệt và chính sách của Lolly Work, hoặc quản lý gói thương hiệu trong git và xem xét thay đổi ở đó.
- **Không ép buộc kiểm soát truy cập.** Ứng dụng mở là công khai theo mặc định, và thẻ độ chín cùng hình mờ gánh rủi ro thương hiệu. Đăng nhập tổ chức, vai trò và chính sách đến từ Lolly Work khi một đội muốn.
- **Không có cơ sở dữ liệu trung tâm.** Trạng thái người dùng nằm trên từng thiết bị, và Sync tùy chọn sao chép nó tới nơi lưu trữ người dùng chọn, không bao giờ tới cơ sở dữ liệu Lolly.
- **Không có đường mã chung giữa công cụ và engine.** Engine và các công cụ cộng đồng là mã nguồn mở, và một gói thương hiệu như `brands/suse/` riêng tư mang công cụ và danh mục của riêng nó theo điều khoản riêng. Không công cụ nào import từ `engine/`, nên ranh giới vẫn sạch.

## Vòng đời của một lượt render

Ai đó mở `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Khởi động.** Ứng dụng web mở IndexedDB, dựng cầu khả năng và đồng bộ danh mục công cụ và tài nguyên, hoặc nạp từ bộ nhớ đệm khi ngoại tuyến.
2. **Định tuyến.** Đường dẫn chọn chế độ xem công cụ cho `qr-code`, với truy vấn làm giá trị ban đầu.
3. **Nạp.** `loadTool` tải `tool.json`, xác thực nó với schema và tải mẫu, kiểu dáng và hook.
4. **Phân tích liên kết.** `parseUrlState` biến các tham số thành giá trị đầu vào. Một tham chiếu tài nguyên như `?logo=lolly/logo/primary` trở thành `{ id }` chưa phân giải.
5. **Khởi động runtime.** `createRuntime(tool, host, initialValues)` dựng mô hình đầu vào từ dữ liệu hồ sơ, giá trị mặc định và liên kết, phân giải tham chiếu tài nguyên, nạp hook và gọi `onInit`.
6. **Kết xuất.** Shell đăng ký theo dõi runtime, vẽ các điều khiển từ mô hình và ghi mẫu đã điền vào `#tool-canvas`.
7. **Tương tác.** Gõ gọi `runtime.setInput`, áp dụng ràng buộc, gọi `onInput`, điền lại mẫu và vẽ lại.
8. **Xuất.** **Download** gọi `runtime.export(node, format)`, và `host.export` của shell tạo tệp: ảnh điểm, vector từ bộ duyệt DOM, PDF, tài liệu hoặc một trong các định dạng khác trong `schemas/tool.schema.json`. Đơn vị vật lý được chuyển đổi theo từng định dạng, và siêu dữ liệu cùng Content Credentials được nhúng nơi định dạng chứa được. Công cụ experimental nhận hình mờ từ host, không phải từ công cụ. [Templates and rendering](/info/tool-rendering.html) và [Export a file](/info/exporting.html) đề cập bước xuất.

![Bảng xuất mà ?options mở ra: cặp tên tệp và định dạng, kích thước đầu ra và các điều khiển ghi tệp](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Cùng vòng đời đó chạy trong Tauri, và trong CLI với DOM không giao diện, nơi đầu ra đi vào một tệp hoặc stdout.

## Giấy phép

Mã, gồm `engine/`, `shells/`, `services/`, `schemas/` và trình sinh tài liệu, theo MPL-2.0, trong một kho công khai, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). Văn bản tài liệu theo CC BY-SA 4.0. Các gói thương hiệu mang điều khoản riêng trong `NOTICE.md` của từng gói: các công cụ cộng đồng theo MPL-2.0, còn gói SUSE riêng tư là độc quyền của SUSE. [About](/info/about.html) có ghi chú cấp phép đầy đủ.
