# Lolly dành cho Nhà phát triển

Tài liệu kỹ thuật - dành cho bất kỳ ai viết tool, tích hợp Lolly vào một pipeline, tự host nó, hoặc mở rộng nền tảng.

**Lợi ích dành cho bạn.** Xây dựng một tool một lần và yêu cầu đó sẽ không còn quay lại tìm bạn nữa. Câu nói lặp đi lặp lại "làm giúp mình cái này được không…" vốn ngốn hết cả buổi chiều của bạn giờ trở thành một template để người khác tự điền - đúng cách, mà không cần bạn can thiệp. Công việc của bạn chỉ là HTML/CSS/JS thuần: có kiểm soát phiên bản, có thể diff, có thể review, và chạy trên một engine mở, không vendor lock-in, nên nó vẫn thuộc về bạn. Tự động hóa quy trình sản xuất và thời gian của bạn sẽ dành cho vấn đề thú vị, chứ không phải lần export thứ mười nghìn.

Lolly là một **engine** không phụ thuộc nền tảng, chạy cùng một render path trên nhiều **shell** khác nhau (web PWA, Tauri desktop/mobile, CLI, TUI). Tool là **dữ liệu, không phải code đóng gói sẵn** - một manifest cộng với một template cộng với các hook tùy chọn - nên tool mới được phát hành mà không cần cập nhật ứng dụng. Bắt đầu với [Tổng quan](/info/overview.html) để hiểu kiến trúc, sau đó theo lộ trình phù hợp với thứ bạn đang xây dựng.

Mới làm quen với nền tảng? **[Quickstart](/info/quickstart.html)** sẽ giúp bạn thiết lập một brand và bản render đầu tiên trước khi đi sâu hơn.

## Tìm hiểu kiến trúc



- **[Tổng quan](/info/overview.html)** - vì sao Lolly tồn tại, sự tách biệt engine/shell/tools, capability bridge, và các cam kết kiến trúc đã chốt.
- **[Token Thiết kế](/info/design-tokens.html)** - mô hình token DTCG mà các brand được biểu diễn qua đó, và cách tool sử dụng chúng.

## Viết tool

Mọi điều khiển bên dưới đều được sinh ra từ một input đã khai báo trong `tool.json`. Bạn viết dòng manifest, host vẽ ra widget, và cùng một model đó điều khiển cả CLI lẫn URL.

![One declared input, one generated control: a url, a colour, a select, a number, a boolean](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code&width=1440&height=900&dpi=192&waitMs=2000&cropSelector=.tool-inputs&walker=1&format=svg&dark=1&filename=aud-manifest-controls)

Cách này còn mở rộng xa hơn năm điều khiển. Gán cho một input một `section` và host sẽ gấp nó lại, nên một công cụ có năm mươi input như D3 Chart Studio vẫn mở ra dưới dạng một danh sách ngắn, phần còn lại được xếp sau các nhóm có tên.

![The D3 sidebar - a handful of primary controls, then Data, Columns, Chart, Axes and the other sections collapsed into one line each](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=1600&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-d3-sections)

- **[Viết Tool](/info/authoring-tools.html)** - hướng dẫn đầy đủ: manifest, template, styles, hook, composition, và publishing.
- **[Viết Asset](/info/authoring-assets.html)** - asset trong catalog, tier, locale, palette, icon có thể theo theme (themable), và font.
- **[Host API](/info/host-api.html)** - capability bridge `HostV1` mà mọi tool được viết dựa trên (API duy nhất mà tool nhìn thấy).
- **[Chế độ URL](/info/url-mode.html)** - mọi input đều là một tham số URL; tham số dành riêng (reserved param), mã hóa gọn (compact encoding), liên kết đã đóng gói (packed link).

## Chạy & tích hợp

- **[CLI](/info/cli.html)** - render không giao diện (headless); cùng render path như GUI, được điều khiển bởi đối số dòng lệnh (argv) `--foo=bar`.
- **[TUI](/info/tui.html)** - shell terminal tương tác.
- **[MCP Server](/info/mcp.html)** - endpoint gốc (native) cho phép một AI agent khám phá và chạy tool.
- **[AI Agent](/info/ai-agents.html)** - điều khiển Lolly từ một model: một URL chính là API.
- **[Tiện ích mở rộng Chrome](/info/extension.html)** - chụp lại một URL trực tiếp (live) thành một asset có thể tái sử dụng.

## Triển khai & vận hành

- **[Hướng dẫn Build](/info/build-guide.html)** - build mọi target: CLI, TUI, desktop, mobile.
- **[Triển khai](/info/deployment.html)** - web app, các app, và các backend service; mỗi phần chạy ở đâu.
- **[Cấu hình](/info/configuration.html)** - profile, brand pack, capability gating, feature flag, và catalog validation.

## Tin cậy & dữ liệu

Quyền và quyền tác giả cũng là input như mọi input khác. Embed & Track Image khai báo các trường người tạo, bản quyền, giấy phép và liên hệ, còn bản xuất sẽ ghi chúng vào chính metadata của tệp và vào manifest C2PA của nó.

![The Embed and Track Image controls - creator, copyright, a licence dropdown, contact and title, filled from the link](/t/url-shot?url=%2F%23%2Ftool%2Fclaim%3Fcreator%3DAda%2520Lovelace%26title%3DEngine%2520Notes&width=1440&height=1200&dpi=192&waitMs=2200&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-rights-fields)

- **[Danh tính Content Credentials](/info/content-credentials-identity.html)** - chữ ký do CA cấp cho C2PA on-device; các hợp đồng (contract) của engine và runbook dành cho operator.
- **[Truyền dữ liệu](/info/data-transfer.html)** - bundle `lolly-backup`: envelope, tính toàn vẹn (integrity), và đảm bảo cross-shell.
- **[Giới thiệu](/info/about.html)** - dự án, ranh giới giấy phép (licence), và repository.
