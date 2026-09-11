# Tổng quan

![Biểu tượng Lolly - kẹo mút lớn màu xanh lá và trắng](/info/icon.svg)

Tài liệu này ghi lại mục đích, cấu trúc và các quyết định kiến trúc cho nền tảng Lolly. Nó phản ánh cả tầm nhìn sản phẩm lẫn hiện trạng của codebase.

> **Trạng thái:** Lolly là một nguyên mẫu nội bộ trong một **giai đoạn thử nghiệm khép kín chưa hoàn tất**. Engine có tính tất định và nhất quán nội tại, nhưng sản phẩm còn ở giai đoạn sớm - SUSE là khách hàng số một - và các engine mã hóa cùng phân tích file của nó hiện đang trải qua quá trình siết chặt hạ tầng nghiêm ngặt của SUSE, chuẩn bị cho quy mô doanh nghiệp (chúng tôi thực sự giỏi khoản này). Hãy đọc kiến trúc dưới đây như ý đồ thiết kế đang được kiểm chứng, không phải một sản phẩm hoàn thiện, đã được chứng nhận. Xem [Áp dụng & Quản trị](/info/adoption-governance.html#status) để biết giai đoạn thử nghiệm được vận hành và đo lường ra sao.

> **Cách đọc trang này.** Trang này chứa hai loại nội dung, theo thứ tự. Nửa đầu là
> **vì sao điều này tồn tại**: vấn đề, định vị và vòng đời mà một tài sản đơn lẻ trải
> qua. Từ [Bức tranh toàn cảnh](#the-big-picture-how-the-layers-fit) trở đi là
> **các lớp khớp với nhau ra sao**: tài liệu kiến trúc dành cho người đóng góp, bao gồm sự phân
> tách engine/shell/pack, bố cục kho mã, các đích triển khai và các cam kết ràng buộc mọi
> thay đổi lên nền tảng. Nếu bạn ở đây để thay đổi codebase thay vì tìm hiểu
> sản phẩm, hãy bắt đầu từ bức tranh toàn cảnh.
>
> Có hai tài liệu đồng hành đi sâu hơn trang này. [`engine/README.md`](../engine/README.md) trong
> kho mã là bản đồ engine theo từng module, với một bảng được tạo tự động liệt kê mọi module và
> những gì nó phân tích hay ghi ra. [Mô hình đe dọa & Ranh giới tin cậy](/info/threat-model.html)
> là cùng một kiến trúc được đọc dưới góc độ ranh giới tin cậy, và là trang đúng cho bất kỳ câu hỏi nào về
> những gì engine coi là không đáng tin cậy.

---

## Vì sao điều này tồn tại

Các đội nhóm gặp phải một vấn đề lặp lại: công việc sáng tạo và nội dung lặp đi lặp lại quá dễ đoán để cần bàn tay chuyên nghiệp mỗi lần, nhưng lại quá nhạy về chất lượng để giao phó mà không có rào chắn. Kết quả là hoặc thông lượng chậm (nút thắt chuyên gia), thiếu nhất quán (mỗi người dùng công cụ mình có sẵn), hoặc lệ thuộc nhà cung cấp (một DAM SaaS kiểm soát template của bạn).

Nền tảng này là câu trả lời trực tiếp:

> **Sáng tạo và nội dung theo chương trình ở quy mô lớn** - tạo tài sản không tốn nhân lực, với các quy tắc được kiểm soát tập trung, dành cho nhân viên, nhà cung cấp và đối tác.

Lolly không phải nơi một hệ thống thiết kế được phát minh ra - đó là nơi nó được sản xuất ra. Hãy hình dung nó như một máy bán hàng tự động cho thiết kế: chọn một lựa chọn, nhận về một kết quả. Mọi lần đều vậy. Engine luôn hướng tới chất lượng cao nhất mà mỗi định dạng có thể tạo ra trên phần cứng trước mặt bạn, và cùng một engine đó tạo ra cùng một tệp trên mọi nền tảng nó chạy trên.

Kết quả là **sự dồi dào**: mọi sự kiện có bảng hiệu đúng chuẩn, mọi cảnh báo CVE khớp phong cách công ty, mọi nhãn in sạch, mọi chữ ký email luôn cập nhật - tất cả không cần một phiếu yêu cầu thiết kế. Nền tảng xử lý công việc sáng tạo mang tính vận hành lặp lại. Nó cố tình không phải là một công cụ sáng tạo tùy biến - các nhà thiết kế vẫn giữ quyền sở hữu các công việc chủ lực.

### Đổi mới theo xác suất, mở rộng theo tất định

Mọi cuộc tranh luận về AI trong một pipeline sáng tạo đều mắc kẹt ở cùng một câu hỏi: phần nào trong việc này là việc của máy móc? Đây là một câu hỏi cũ đã có đáp án ổn định. Các thầy chép sách và họa sĩ minh họa từ xưa đã làm việc giữa hai công cụ - bản phác thảo tự do, nơi không gì cố định và mọi thứ đều có thể thử, và máy in, đáng gờm chính vì nó cam kết. Các bản phác thảo là nơi nghệ thuật diễn ra. Máy in là cách nó đến được với mọi người. Không ai nhầm lẫn hai thứ đó, và cả hai đều tiếp tục tiến bộ - mực mới, kiểu chữ mới, máy in mới - mỗi thứ cải tiến hài hòa với tay nghề và mục đích nó phục vụ.

Lolly kẻ cùng một ranh giới đó. Khám phá theo xác suất: một mô hình, một nhà thiết kế, một ý tưởng thô, một câu lệnh dẫn tới nơi không ai định trước. Rồi mở rộng theo tất định - thứ chạm tới mười nghìn kết quả là một *công cụ*, và một công cụ kết xuất giống hệt nhau mỗi lần từ các đầu vào mà bạn có thể đọc được. Việc khám phá vẫn tự do vì không có gì ở phía sau phụ thuộc vào việc nó ra kết quả giống nhau hai lần. Đầu ra giành được lòng tin vì nó không phải một phỏng đoán. Đưa việc thử nghiệm AI vào những kết quả có thể dự đoán, tái lập được không phải một ngành mới; đó chính là sự phân công lao động đã từng khiến bản in đáng tin cậy ngay từ đầu.

> Tin tưởng quá trình sáng tạo, mở rộng bằng sự nghiêm ngặt.

### So với các lựa chọn khác

::: figure positioning-comparison
Mức độ hoàn thiện năng lực trên các công cụ sáng tạo hiện nay, khảo sát tháng 8/2026. Thang điểm: 0 không có, 25 mức giải pháp tạm, 50 có thật nhưng bị giới hạn hoặc một phần, 75 mạnh nhưng có lưu ý, 100 năng lực cốt lõi.
:::

Khoảng trống rất rõ: không có công cụ nào hiện đang bán ra cho chúng ta đầu ra ưu tiên ràng buộc, chạy offline, kỹ năng thấp, truy cập nội bộ được. Lolly thậm chí còn có một canvas mở - **Design** - nơi màu sắc, kiểu chữ và tài sản tuân theo các biến toàn cục của thương hiệu, để việc sắp xếp tự do vẫn ưu tiên ràng buộc. Điều nó **không** phải là một bộ công cụ thiết kế không giới hạn: các nhà thiết kế vẫn dùng Illustrator và Figma cho công việc chủ lực tùy biến. Các hoán vị có thể được lắp ráp bằng công cụ này.

![Mọi công cụ trong thư viện dưới dạng thẻ, nhóm theo danh mục, để một nhà sản xuất chọn một cái và bắt đầu](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=aud-gallery-landscape)

**Dùng cho:** Tạo nhanh các tài sản sáng tạo mang tính vận hành - ô sự kiện, thẻ tên, chữ ký, cảnh báo CVE, mã QR, thẻ mạng xã hội, nhãn lô hàng, báo cáo có cấu trúc.

**Không dùng cho:** Nội dung chủ lực tùy biến.

---

## Vòng đời của một chiến dịch

Cách rõ ràng nhất để thấy Lolly là gì không phải là một danh sách tính năng - mà là theo dõi một tài sản duy nhất khi nó chuyển từ tay người này sang tay người khác. Hãy quan sát một thẻ chiến dịch đã bản địa hóa di chuyển qua tổ chức:

1. **Người sáng tạo đặt ra quy tắc.** Một nhà thiết kế soạn template gốc trong công cụ Design, cố định sẵn các biến kiểu chữ và màu sắc của thương hiệu. Họ không làm một thẻ duy nhất - họ đang làm công việc nền tảng *một lần* để không bao giờ phải bản địa hóa thủ công lại nữa.
2. **Nhà phát triển mở rộng nó.** Cùng template đó được nối vào một pipeline chạy hàng đêm qua CLI, để một biểu đồ mới hay một biến thể ngôn ngữ mới được tạo tự động - không nhà thiết kế nào phải mở lại file.
3. **Nhà sản xuất chỉ việc dùng nó.** Một đại diện bán hàng, offline trên máy bay, mở cùng công cụ đó và tạo ra một bản trình chiếu hoàn toàn đúng thương hiệu cho một cuộc gặp khách hàng. Không cần kỹ năng thiết kế, không cần mạng, không chờ đợi.

"Biểu đồ mới" ở bước hai là một bản kết xuất như thế này, được tạo ra từ một chuỗi dữ liệu và vài tham số mà không ai mở file thiết kế:

![Một biểu đồ vùng xếp chồng có tiêu đề, ba chuỗi dữ liệu của nó được tô theo dải màu lạnh, với trục, chú giải và tiêu đề đều được đặt bởi mẫu (template) chứ không phải thủ công](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Điểm mấu chốt không phải là Lolly tốt cho nhà thiết kế *và* tốt cho nhà phát triển *và* tốt cho bán hàng, mỗi thứ trong khoảng chân không riêng. Đó là một **cuộc chạy tiếp sức**: công việc ban đầu của người sáng tạo được nhà phát triển mở rộng, từ đó trao quyền cho nhà sản xuất. Trải nghiệm không tốn công cho đại diện phi kỹ thuật trên máy bay chỉ *khả thi* nhờ vào sự nghiêm ngặt mà nhà thiết kế đặt ra và nhà phát triển triển khai.

Đó là bộ khuếch đại lực. Lolly không phải một ngăn kéo các công cụ riêng lẻ cho từng vai trò riêng lẻ - mà là một vòng đời tài sản tất định duy nhất mà mọi vai trò đều chạm vào, và mỗi bàn tay nó đi qua nhân lên giá trị của bàn tay trước đó.

---

## Một lần phê duyệt, mười nghìn tài sản

Vì sự phê duyệt nằm trong công cụ chứ không phải trong file (xem [Lolly so sánh thế nào](/info/positioning.html)), quy mô không còn là một vấn đề rà soát. Phê duyệt một công cụ thẻ mạng xã hội đã bản địa hóa một lần, rồi tạo ra **10.000 tài sản trên 12 ngôn ngữ** từ một bảng tính - và không tài sản nào trong số đó cần kiểm tra tuân thủ mới từ pháp lý hay thương hiệu, vì template mà tất cả chúng bắt nguồn đã được phê duyệt sẵn.

Cùng một công cụ tất định đạt tới quy mô đó theo ba cách, tất cả đều cho ra đầu ra giống hệt nhau, đã được phê duyệt trước:

- <!--i:people--> **Một người, trong ứng dụng.** Lưới hàng loạt `/pro`: dán hoặc nhập các hàng, nhận một tài sản hoàn thiện cho mỗi hàng, tải xuống file zip. Không cần kỹ năng thiết kế, không phiếu yêu cầu, không chờ đợi.
- <!--i:code--> **Một nhà phát triển, từ dòng lệnh.** CLI chạy *cùng* engine và *cùng* đường kết xuất không giao diện, nên công cụ có thể được xếp chuỗi chạy qua toàn bộ 10.000 hàng trong một script hay một pipeline chạy đêm. Một lệnh gọi `lolly <tool> --field=…` trong một vòng lặp là toàn bộ tích hợp.
- <!--i:cpu--> **Một hệ thống hoặc một tác nhân AI, qua MCP.** Cùng công cụ được vận hành theo chương trình, với cùng độ trung thực và ở quy mô còn lớn hơn - vì một cỗ máy sẽ không thấy chán khi hàng nghìn file lần lượt đổ về.

![Chế độ Batch trên một bản cài đặt mới: một hàng trống đang chờ một công cụ, với toàn bộ bề mặt bảng tính và nút Render đã sẵn sàng trước khi có bất kỳ dữ liệu nào](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

Một bộ ràng buộc thương hiệu duy nhất, được một nhà thiết kế ấn định một lần; ba con đường dẫn tới cùng một đầu ra đã được phê duyệt trước - và con đường máy móc mở rộng xa nhất trong tất cả, vì nó không bao giờ mệt mỏi khi các file lần lượt đổ về.

---

## Bức tranh toàn cảnh: các lớp khớp với nhau ra sao

Mọi thứ từ đây trở xuống là kiến trúc. Sơ đồ là toàn bộ hệ thống trong một cái nhìn: các công cụ là
dữ liệu ở trên cùng, engine ở giữa không biết gì về bất kỳ nền tảng nào, các shell bên dưới nó
triển khai một hợp đồng duy nhất, và các catalog cung cấp nội dung.

```
                ┌─────────────────────────────────────────────┐
                │              Tools (data, not code)         │
                │   tool.json + template.html + hooks.js?     │
                └─────────────────────────────────────────────┘
                                    ▲
                                    │ talks to via Capability Bridge v1
                                    ▼
                ┌─────────────────────────────────────────────┐
                │                  Engine                     │
                │   loader · validator · runtime · template   │
                │   inputs · url-mode                         │
                │   PLATFORM AGNOSTIC. Knows nothing of DOM,  │
                │   filesystem, or You.                       │
                └─────────────────────────────────────────────┘
                                    ▲
                                    │ implements HostV1
                                    ▼
        ┌──────────────┬──────────────┬──────────────┬──────────────┐
        │  Web Shell   │ Tauri Desktop│ Tauri Mobile │  CLI Shell   │
        │   (PWA)      │              │              │              │
        └──────────────┴──────────────┴──────────────┴──────────────┘
                                    ▲
                                    │ fetches from
                                    ▼
                ┌─────────────────────────────────────────────┐
                │              Catalogs                       │
                │   catalog/tools/index.json + tool dirs      │
                │   catalog/assets/index.json + asset files   │
                └─────────────────────────────────────────────┘
```

### Bố cục kho mã

Nội dung được gắn vào dưới dạng các gói: `community/`, `docs/`, mọi `shells/*`, cả hai `services/*` và `brands/suse` mỗi cái là một kho mã riêng, được checkout như các git submodule của kho này. Kho mẹ sở hữu `engine/`, `schemas/`, `scripts/`, `tests/`, `api/`, `brands/lolly-start/` và `profiles.json`. Xem [Hướng dẫn Build » Lấy mã nguồn](/info/build-guide.html) để biết lệnh checkout và quy trình làm việc đa kho.

```
lolly/
├── engine/           # Platform-agnostic core. Open source (MPL-2.0).
│   └── src/
│       ├── index.ts          # public surface - loader, runtime, template, inputs, url-mode
│       ├── loader.ts         # fetches and validates tool files
│       ├── runtime.ts        # orchestrates the 5-step lifecycle
│       ├── template.ts       # Handlebars hydration + annotateTemplate
│       ├── inputs.ts         # manifest → runtime input model
│       ├── url-mode.ts       # URL ↔ input state round-trip
│       ├── validate.ts       # JSON Schema validation of manifests
│       ├── compose.ts        # resolve nested tool renders (composes)
│       ├── embed.ts          # parse portable lolly.tools embed URLs
│       └── bridge/
│           └── host-v1.ts    # type re-export of the @lolly-tools/core contract
│
├── shells/
│   ├── web/          # PWA - hosted online; primary distribution
│   │   └── src/
│   │       ├── main.ts           # boot, routing
│   │       ├── theme.ts          # theme apply/persist (FOUC prevention)
│   │       ├── bridge/           # web implementations of HostV1 APIs
│   │       │   ├── index.ts      # compose all bridge pieces
│   │       │   ├── db.ts         # IndexedDB setup
│   │       │   ├── state.ts      # host.state - saved edits
│   │       │   ├── profile.ts    # host.profile - user details
│   │       │   ├── assets.ts     # host.assets - catalog + user uploads
│   │       │   ├── clipboard.ts  # host.clipboard
│   │       │   ├── export.ts     # host.export - rasterise/serialize
│   │       │   ├── net.ts        # host.net - allowlisted fetch
│   │       │   └── media.ts      # host.media - live camera frames (onFrame)
│   │       ├── catalog/
│   │       │   └── sync.ts       # boot-time catalog sync + offline cache
│   │       ├── styles/           # app-wide CSS (app.css, picker.css, tokens.css)
│   │       └── views/
│   │           ├── gallery.ts    # tool library listing + saved-state cards
│   │           ├── tool.ts       # mounts one tool (inputs + canvas + actions)
│   │           ├── picker.ts     # asset picker UI (invoked by host.assets)
│   │           ├── profile.ts    # user details editor
│   │           ├── projects.ts   # /p - folders of saved sessions (nested; folder/selection export)
│   │           └── free-canvas.ts # free-canvas editor overlay for render.layout:"editor" tools
│   │
│   ├── cli/          # Node.js CLI - same engine, headless jsdom
│   │   ├── bin/lolly.ts
│   │   └── src/
│   │       ├── run.ts    # loadTool → createRuntime → export → write file
│   │       └── bridge.ts # CLI implementation of HostV1
│   │
│   ├── tui/          # Interactive terminal shell (Ink) - reuses the CLI bridge
│   │   └── src/
│   │       ├── main.tsx  # full-screen app: Gallery / Projects / Profile / ToolView
│   │       └── bridge.ts # CLI bridge + on-disk state under ~/.lolly
│   │
│   ├── tauri-desktop/ # downloadable desktop app
│   └── tauri-mobile/  # iOS/Android app
│
├── tools/            # profile VIEW (gitignored) - data, not code. Merged from packs:
│                     #   community/ (public, brand-agnostic, MPL) + brands/<active>/tools (brand-owned).
│                     #   A SELECTION follows - the mounted set depends on the profile.
│   ├── qr-code/
│   ├── quotes/
│   ├── email-signature/
│   ├── snippet/
│   ├── countdown-timer/
│   ├── color-palette/
│   ├── color-block/           # typed/heterogeneous blocks (addMenu discriminator)
│   ├── dynamic-layout/
│   ├── tool-logo/         # "Logo" - auto-switching brand logo
│   ├── street-map/        # offline vector city-block maps
│   ├── url-shot/          # "URL Screenshot" (capture capability)
│   ├── strip-data/        # on-device metadata strip - JPEG/PNG/SVG/PDF (file in → clean file out)
│   ├── compress-pdf/      # on-device PDF compressor - recompresses images (file in → smaller file out)
│   ├── brand-lockup/      # "Brand Lockup" - SUSE logo lockups; HarfBuzz text-to-path (wasm)
│   ├── chart-creator/     # SVG charts from structured data
│   ├── filter/            # photo effects in one tool - halftone/scanline/posterize/voronoi (vector), duotone/pixel-stretch/imperfections (raster)
│   ├── meeting-planner/   # global timezone meeting scheduler
│   ├── calendar-ics/      # event → .ics calendar file plus a card
│   ├── digi-ad/           # "Animated Ad" - looping banner from scenes
│   ├── event-name-badge/  # conference badges - composes qr-code as an SVG
│   ├── wayfinding-signage/ # event signage; directions blocks auto-fit label text
│   ├── text-helper/       # on-device text workbench (format/decode/hash/de-identify)
│   ├── design/     # "Design" - freeform WYSIWYG editor canvas (render.layout: editor)
│   ├── multi-page-pdf/    # multi-page PDF document - cover, flowing content blocks, back page
│   ├── diagram-builder/   # org / layercake / process / cycle / pyramid diagrams
│   ├── logo-wall/         # many logos → auto-packed grid
│   ├── logo-lockup-partner/ # SUSE + partner co-brand lockup
│   ├── icon/          # favicon .ico / png / svg from text + colours
│   ├── lottie-digi-ad/    # animated Lottie ad banners
│   └── pose-geeko/        # pose the SUSE Geeko mascot - print-ready stills
│
├── catalog/
│   ├── tools/index.json        # tool registry
│   └── assets/
│       ├── index.json          # asset registry
│       └── suse/...            # logo, palette, etc.
│
├── schemas/          # JSON Schema for tool.json, asset entries, AssetRef
├── scripts/          # build-catalog-index.ts, checksum-assets.ts, validate-catalog.ts
├── tests/            # engine tests
└── docs/             # this file + authoring guides + positioning
```

---

## Mô hình triển khai nền tảng

Nền tảng chạy trên nhiều bề mặt - PWA web, Tauri desktop/mobile, CLI có thể viết script và TUI tương tác. Tất cả đều dùng cùng một engine và cùng các file công cụ.

### Web (PWA) - phân phối chính
Được lưu trữ tại một URL do SUSE kiểm soát. Hoạt động offline khi service worker đã cache công cụ và tài sản. Đây là nơi phần lớn nhân viên, nhà cung cấp và đối tác sẽ dùng nền tảng. Không cần tài khoản - trạng thái được lưu trong IndexedDB theo từng thiết bị.

Shell web đáp ứng đa thiết bị từ một bố cục duy nhất. Trên desktop, một công cụ là một thanh bên điều khiển có thể đổi cỡ bên cạnh một sân khấu xem trước với điều hướng canvas gốc trackpad (Cmd/Ctrl-cuộn hoặc chụm để thu phóng quanh con trỏ, Space- hoặc kéo bằng nút giữa để lia, các phím `0`/`1`/`+`/`−` và một HUD Fit/%). Trên di động (≤640px), các điều khiển trở thành một tấm neo trên cùng với một tay cầm kéo tự khớp vào peek/half/full (chạm để chuyển đổi) phủ trên một bản xem trước toàn màn hình tĩnh, và một nút **Render** nổi mở các điều khiển **Export** trong một popup dạng tấm dưới. Chạm nhận chụm-thu phóng và kéo-lia trên bản xem trước. Đường kết xuất và các điều khiển xuất giống hệt nhau trên cả hai - chỉ phần khung giao diện là bố trí lại.

![Chế độ chia đôi trên desktop - các control được tạo từ manifest ở bên trái, canvas trực tiếp ở bên phải](/t/url-shot?url=%2F%23%2Ftool%2Fchart-creator&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=aud-web-split)

Cùng một công cụ ở độ rộng điện thoại, không cần duy trì layout thứ hai: các control trở thành một sheet ở phía trên, bản xem trước chiếm toàn màn hình và nút render nổi trên đó.

![Một audiogram trên màn hình rộng 430px - bảng điều khiển ở trên, tác phẩm vuông hoàn chỉnh ở dưới và viên (pill) kết xuất nổi](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

**Chế độ hàng loạt (`/pro`).** Web shell cũng đi kèm một lưới hàng loạt kiểu bảng tính (`shells/web/src/pro/`) render nhiều hàng cùng lúc trên một hoặc nhiều công cụ. Nó hỗ trợ chuyển đổi qua lại CSV/TSV cộng với dán từ bảng tính, template/format/kích thước/đơn vị/dpi theo từng hàng, một side panel blocks-editor với bản xem trước trực tiếp, các cột export có thể thu gọn, một thanh nhãn "mức độ liên quan" theo từng hàng, sắp xếp lại hàng bằng tay kéo bên trái, xác nhận xóa hai bước, các phiên hàng loạt đã lưu và tải xuống dạng `.zip`. Đây là bề mặt một-đến-nhiều đứng sau định vị "tạo nội dung hàng loạt".

### Tauri desktop / mobile
Ứng dụng native đóng gói (dung lượng nhỏ nhờ Tauri). Cung cấp khả năng hoạt động offline đầy đủ, quyền truy cập hệ thống tệp cho các công cụ phụ thuộc CLI (PDF Smasher, Font Outliner) và quyền truy cập camera. Dự kiến nâng cấp công cụ vào giữa 2026.

### CLI
`lolly <tool-id> [--input=value ...] --output=file.png`

Người dùng desktop có thể gọi nhiều công cụ từ terminal. CLI shell tải cùng một engine, tạo một DOM jsdom, chạy cùng render path và ghi tệp. URL mode chính là lớp vận chuyển - CLI không phải là một cài đặt riêng biệt. Điều này đảm bảo đầu ra của CLI và GUI giống hệt nhau.

```bash
lolly qr-code --url=https://suse.com --output=qr.svg
lolly quotes --quote="Ship it." --output=quote.png
lolly                        # lists available tools
lolly qr-code                # lists inputs for that tool
```

### TUI
`npm run tui`

Phiên bản tương tác song hành với CLI: một ứng dụng terminal toàn màn hình, ưu tiên bàn phím (xây trên Ink) để duyệt công cụ, điền input, lưu dự án và export - tất cả không cần GUI. Host bridge của nó **tái sử dụng cài đặt của CLI** cho các định dạng không cần DOM (SVG/EMF/EPS/HTML + text/data), và bổ sung state trên đĩa dưới `~/.lolly` cùng bản xem trước nội tuyến tùy chọn. Ngoài ra nó còn có một **lớp render trình duyệt**: một Chromium headless phạm vi hẹp (cùng bản mà MCP server cài đặt) tạo ra raster/PDF/video và chụp URL trực tiếp theo yêu cầu - vận hành một bản build của web shell nên đầu ra giống hệt nhau, và chỉ khởi chạy khi bạn export định dạng đó lần đầu. Vì vậy `url-shot` (kèm crop + đổi màu + PDF/SVG vector) và mọi công cụ raster/pdf đều chạy được trong terminal. Xem [hướng dẫn TUI](/info/tui.html).

Dù đang ở bề mặt nào, tab Capabilities của dashboard là bản đồ đầy đủ những gì nền tảng khai báo có thể làm, được nhóm lại và dễ đọc mà không cần mở bất kỳ công cụ nào.

---

## Danh mục công cụ

Các công cụ được gắn thẻ `category` trong manifest để nhóm trong gallery.

Các hàng được liệt kê theo thứ tự phần trong gallery. Phần `utility` luôn hiển thị **cuối cùng** trong gallery (sau mọi danh mục khác, kể cả những danh mục tương lai) - đây là ngăn kéo "Offline Utilities" chạy trên thiết bị.

| Danh mục | Ví dụ | Dự kiến |
|---|---|---|
| `everyone` | QR Code Generator, Quote Card, Email Signature, Logo, Wordmark, Audiogram, Battlecards, Sequence Studio, Record | Employee Image Stationery |
| `designer` | Brand Lockup, Design, Chart, Darkroom, Filter, Pose Geeko, Multi-Page PDF | Font Outliner |
| `event` | Meeting Planner, Event Name Badge, Wayfinding Signage, Calendar ICS, Booth Studio | Event Stationery, Bulk Name Badges, Room Agenda Cards |
| `product` | - | CVE Alert, Product Release Announcement, Blog OG Image |
| `utility` | Strip Hidden Data, Text Helper, Compress PDF, Convert Image, Convert Font, Redact, Run Web Code, Screen Capture, URL Screenshot | Unit/format converters, more on-device privacy utilities |

Các ô đó là **ví dụ, không phải danh mục đầy đủ**. Những công cụ nào tồn tại là thuộc tính của profile bạn đã mount, không phải của trang này: một brand pack thêm công cụ riêng của nó, và có thể loại trừ một công cụ cộng đồng mà nó không muốn phân phối. `catalog/tools/index.json` - được tạo ra từ các manifest, và là registry mà gallery thực sự đọc - là danh sách chính thức; để đếm những gì một profile mount, hãy đếm các manifest (`ls community/*/tool.json brands/*/tools/*/tool.json`) thay vì tin vào một con số ghi ở đây. (Một tool id xuất hiện trong hai pack chỉ mount một lần, từ pack thắng.)

Các công cụ cũng được phân loại theo status: `official` (được brand phê duyệt, không watermark), `community` (đóng góp bên ngoài), `experimental` (export có watermark). Phần lớn thư viện là `official`; các studio mới hơn và các công cụ chụp thường ở mức `community` hoặc `experimental` trong khi ổn định dần. Mọi bề mặt đều hiển thị badge, để người đọc biết mình đang lấy gì trước khi mở nó - và, giống như các ô danh mục ở trên, số lượng thành viên theo status thay đổi quá nhanh để liệt kê ở đây. Hãy đọc trực tiếp từ gallery hoặc index được tạo ra.

**Design** là công cụ đầu tiên xây trên chế độ canvas tự do `render.layout: "editor"` - một bề mặt thao tác trực tiếp, không khung viền, nơi bạn kéo, thay đổi kích thước, xoay và snap các hộp văn bản, hình dạng và hình ảnh, rồi export qua cùng render path như mọi công cụ khác.

**Strip Hidden Data** là **tiện ích chạy trên thiết bị** đầu tiên (`privacy: "on-device"`): một công cụ chuyển đổi nội dung nhận một tệp *bạn* cung cấp, xử lý hoàn toàn trong trình duyệt và trả lại một bản sạch - không bao giờ được tải lên, không bao giờ có watermark, không đóng dấu nguồn gốc. **Text Helper** là công cụ thứ hai - một không gian làm việc trên thiết bị cho các tác vụ dán-vào-website hàng ngày (định dạng JSON, giải mã JWT, Base64, mã hóa/giải mã URL, băm SHA). **Compress PDF** là công cụ thứ ba - nó thu nhỏ một PDF bằng cách nén lại hình ảnh bên trong, cũng hoàn toàn trên thiết bị. Dấu hiệu này và văn bản badge của nó "Chạy trên thiết bị của bạn - không có gì được tải lên" giờ đây bao phủ toàn bộ tập hợp công cụ chuyển đổi: Strip Hidden Data, Text Helper, Compress PDF, **Convert Image** (HEIC/TIFF/AVIF → WebP/JPG/PNG), **Convert Font**, **Redact** (xóa bỏ các vùng của một hình ảnh, SVG hoặc PDF), **Prompt to Image** và **Rebrand a Deck** (đổi theme cho một `.pptx` tại chỗ) ở những profile có mount nó. Đây là một danh mục tiện ích riêng tư thay thế việc giao tệp mật cho các website đơn chức năng.

![Ngăn kéo Utilities, nơi mỗi thẻ là một công cụ chuyển đổi một tệp bạn đã có sẵn](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=aud-utilities)

> Lưu ý: `category` và `status` được phi chuẩn hóa (denormalised) vào `catalog/tools/index.json` (registry mà gallery đọc) từ mỗi `tool.json`. Manifest là nguồn sự thật - index được **tạo ra** bởi `npm run build:catalog` và `npm run validate:catalog` sẽ khiến CI thất bại nếu index đã commit lệch khỏi các manifest.

---

## Cam kết kiến trúc

Những quyết định này đã được chốt. Thay đổi bất kỳ cái nào cũng là một việc lớn - chúng định hình mọi quyết định khác trong codebase.

### 1. Công cụ khai báo, kèm lối thoát mệnh lệnh

Một công cụ là một manifest (`tool.json`) + một template (`template.html`) + `hooks.js` tùy chọn.

**Manifest khai báo các input.** Không phải template. Các input không được suy ra từ token Handlebars. Manifest là hợp đồng; template tiêu thụ các biến được đặt tên qua `{{id}}`.

![Chồng control của Street Map - một dropdown thành phố, một select theme, các slider độ dày và các trigger màu, mỗi cái đều được vẽ từ một dòng manifest](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

**Hooks là tùy chọn.** Phần lớn công cụ hoàn toàn khai báo - manifest + template là đủ. Các công cụ cần giá trị tính toán (mã hóa QR, tạo hình dữ liệu biểu đồ) cung cấp `hooks.js` để lộ ra các hàm vòng đời được đặt tên (`onInit`, `onInput`, `onFrame` - hook camera trực tiếp theo từng khung hình cho các công cụ phản ứng chuyển động - `onLevel`, `beforeExport`, `afterExport`, `exportFile` - đường chuyển đổi file-vào/file-ra dùng bởi các tiện ích trên thiết bị như Strip Hidden Data - và `exportStill`, cho một công cụ tự sở hữu bản raster độ sâu riêng). Host tải hooks qua `new Function('host', …)` với capability bridge được tiêm vào làm closure scope. Đây là một **hợp đồng khả chuyển, không phải một sandbox bảo mật**: hooks vẫn chạy trong realm của trang và *có thể* truy cập `window`/`fetch`/`document` trong một web shell - `host.*` là bề mặt được hỗ trợ, khả chuyển, chứ không phải một ranh giới được thực thi. Kết quả hook bất đồng bộ có giới hạn thời gian (`onInit` 5s, `onInput` 2s, `beforeExport`/`afterExport` 5s, `exportFile`/`exportStill` 10s) và kết quả đến trễ bị loại bỏ; một hook *đồng bộ* chạy vượt thời gian không thể bị ngắt trước. Do đó mã hook bên thứ ba chưa tin cậy không an toàn để chạy cho đến khi cách ly Worker được triển khai.

Điều này quan trọng vì: công cụ khai báo có thể được người không lập trình tạo ra. Nếu mỗi công cụ đều là một ứng dụng web, ghi chú rủi ro "kỹ năng hạn chế để tạo/duy trì các template chủ lực" sẽ trở thành một nút thắt cổ chai vĩnh viễn.

### 2. Công cụ và asset là dữ liệu, không phải mã đóng gói

Ứng dụng web và Tauri lấy các catalog công cụ và asset từ một URL đã biết khi khởi động, cache chúng cục bộ và vận hành trên bất cứ thứ gì có ở đó. **Thêm một ô sự kiện mới hoặc asset theo mùa không cần một bản phát hành ứng dụng.**

Byte của asset được kiểm tra checksum SHA-256 để ngăn chặn đầu độc CDN. `id` + `version` của asset điều khiển việc vô hiệu hóa cache.

### 3. Capability Bridge là API duy nhất mà công cụ thấy được

Công cụ không bao giờ chạm vào DOM ngoài khu vực template của nó, không bao giờ gọi `fetch` trực tiếp, không bao giờ đọc hệ thống tệp. Chúng gọi các phương thức `host.*` đã được đánh version. Định nghĩa chính thức của hợp đồng là `packages/core/src/host-v1.ts` - SDK dành cho tác giả công cụ `@lolly-tools/core`, để bên thứ ba có thể xây dựng dựa trên nó mà không cần phụ thuộc vào engine; `engine/src/bridge/host-v1.ts` là một bản re-export kiểu (type) của nó, và mã engine/shell vẫn import từ đường dẫn đó không đổi:

| API Bridge | Chức năng |
|---|---|
| `host.profile` | Tên riêng, email, ảnh chân dung, thành phố của người dùng, v.v. Điền sẵn input qua `bindToProfile`. |
| `host.assets` | Truy vấn catalog, phân giải asset, giao diện chọn asset do host cung cấp. |
| `host.state` | Lưu / tải các slot input. IndexedDB trên web, hệ thống tệp trên Tauri, bộ nhớ trên CLI. |
| `host.clipboard` | Ghi văn bản hoặc hình ảnh vào clipboard (kèm dự phòng theo nền tảng). |
| `host.export` | Chuyển đổi thành raster hoặc tuần tự hóa mục tiêu render. Áp dụng watermark cho các công cụ experimental. |
| `host.net` | Fetch có danh sách cho phép - chỉ khả dụng nếu công cụ khai báo capability `"network"`. (Hiện chưa có công cụ nào đang phân phối sử dụng nó.) |

Các bề mặt tùy chọn, bổ sung chỉ xuất hiện khi một shell cung cấp chúng. Một số được **khóa theo capability** - chỉ lộ ra khi công cụ khai báo cờ tương ứng: `host.compose` (nhúng render của công cụ khác - `compose`), `host.capture` (chụp trang cho URL Screenshot - `capture`) và `host.recorder` (chụp mic/camera/màn hình cho các công cụ ghi âm/ghi hình - `microphone` / `camera` / `screen`). Phần còn lại được **phát hiện theo tính năng** - có mặt bất cứ khi nào shell có thể cung cấp chúng, với công cụ giữ một phương án dự phòng cho các shell không thể.

Một vài bề mặt tiêu biểu, để cho thấy phạm vi bao phủ - [Host API](/info/host-api.html) ghi lại từng cái một, và `packages/core/src/host-v1.ts` chính là hợp đồng:

| Surface | Từ phiên bản | Nó thêm gì |
|---|---|---|
| `host.tokens` | 1.0 | Design token DTCG - các nguyên tố (primitives) riêng của thương hiệu |
| `host.text` | 1.0 | Chuyển văn bản thành path qua HarfBuzz WASM (cờ khả năng `wasm` đánh dấu các công cụ phụ thuộc vào nó) |
| `host.media` | 1.4 | Khung hình camera trực tiếp điều khiển hook `onFrame`. Tăng cường tiệm tiến, cố tình *không* bị chặn bởi cờ `camera` - một công cụ như vậy vẫn hoạt động như một công cụ ảnh tĩnh thông thường |
| `host.color` | 1.40 | Toán học màu theo tri giác: ΔEOK, độ tương phản WCAG + APCA, dải màu OKLab, class-break, bảng màu phân loại, sơ đồ hài hòa (1.60), pha trộn CSS Color 4 và bake gradient (1.68). Thuần túy và đồng bộ - các shell gắn `makeColorApi()` của engine thay vì tự triển khai bất cứ điều gì, nên nó không thể trôi lệch |
| `host.images` | 1.60 | Giải mã / thay đổi kích thước / mã hóa lại byte ngay trên thiết bị - đường chuyển đổi (HEIC → JPEG, nén sang WebP, giảm kích thước). Được cung cấp trong web shell dưới dạng một lazy facade, nên bộ giải mã HEIC không bao giờ vào chunk khởi động |
| `host.geom` | 1.64 | Hình học vector chính xác: phép toán boolean trên path, offset, chuyển nét thành fill, hạ cấp spline, đơn giản hóa, kiểm tra va chạm (hit testing). Cũng thuần túy, đồng bộ và được gắn từ engine (`makeGeomApi()`); lỗi được *trả về*, không bao giờ ném ra (throw) |

Phần còn lại tuân theo cùng quy tắc và được ghi lại cùng với chúng: `pdf` (1.8) và `pptx` (1.58) cho phẫu thuật tài liệu trên thiết bị, `audio` (1.71) và `speech` (1.96) cho phân tích clip và TTS/phiên âm trên thiết bị, `viz` (1.72) cho hợp đồng placeholder MilkDrop, `codec` (1.100) và `layers` (1.102) cho đầu ra bit sâu và bitmap phân lớp, `upscale` (1.101) và `matte` (1.103) cho các model trên thiết bị, `raster` (1.105) cho các hook tự xử lý pixel riêng, `connectors` (1.106) cho mũi tên an toàn khi export và `c2pa` (1.85) để ký byte đã hoàn tất. Số lượng tăng lên; quy tắc thì không.

Các capability có thể khai báo là: `network`, `filesystem`, `clipboard`, `camera`, `microphone`, `screen`, `ffmpeg`, `wasm`, `capture`, `compose`. (`screen`, được thêm ở 1.54, là chụp màn hình qua `host.recorder` - người dùng chọn một màn hình/cửa sổ/tab trong giao diện gốc của trình duyệt; khác với `capture`, vốn render một URL do chính công cụ đặt tên.)

Cùng một công cụ chạy trên trình duyệt, Tauri và CLI headless vì mỗi shell cài đặt giao diện này - công cụ không bao giờ biết nó đang ở đâu.

Bridge được đánh version. Thêm phương thức là một minor version. Xóa hoặc thay đổi chữ ký là một bước nhảy major version. Khi v2 ra mắt, v1 phải tiếp tục hoạt động.

### 4. Asset ID là vĩnh viễn

`suse/logo/primary` là một hợp đồng. Khi đã xuất bản:
- ID không bao giờ thay đổi, không bao giờ được tái sử dụng.
- Thay đổi byte → tăng `version` trong manifest.
- Được thay thế bởi asset mới → đặt `deprecated: true` và tùy chọn `replacedBy`.
- Các tham chiếu hiện có luôn phân giải được.

Điều này khiến các trạng thái công cụ đã lưu và các liên kết chia sẻ qua URL bền vững qua nhiều năm.

### 5. URL mode là hạng nhất

Mọi input phải có thể biểu diễn được dưới dạng tham số URL:

```
lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H
```

![Riêng liên kết đó, không kèm gì khác, chính là tác phẩm hoàn chỉnh](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fsuse.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Chế độ CLI chính là URL mode dưới một lớp vận chuyển khác - CLI shell dựng một đối tượng trạng thái URL từ argv và chạy **cùng** pipeline engine. Chỉ có một render path. CLI không thể lệch khỏi GUI vì nó không phải là một cài đặt riêng biệt.

`url-mode.ts` xử lý việc chuyển đổi qua lại (parse và serialize). Một tập các **tham số dành riêng** không bao giờ được chuyển tới công cụ dưới dạng input: các control đầu ra (`format`, `export`, `copy`, `filename`, `width`/`w`, `height`/`h`, `unit`, `dpi`), các nút xoay in ấn và nguồn gốc (`bleed`, `marks`, `profile`, `password`, `c2pa`, `imprint`, `durable`, `meta`, `hdr`, `depth`, `cuts`) và các thành phần mang trạng thái (`template`, `z` - token đóng gói "Liên kết ngắn nhất" - và `zx`, cùng loại đó nhưng được mã hóa dưới một mật khẩu). Tập `RESERVED` trong `engine/src/url-mode.ts` là nguồn thẩm quyền và được một bài test ghim chặt; [URL Mode](/info/url-mode.html) ghi lại từng tham số một, kể cả một vài cái không liệt kê ở đây. Các input asset trong URL mode được tuần tự hóa theo `id` của chúng; runtime phân giải chúng qua `host.assets.get()` trước khi hydrate. `width`/`height` là các giá trị theo `unit` (mặc định `px`, cũng có `mm`/`cm`/`in`/`pt`/`pc`); với đơn vị vật lý, `dpi` đặt độ phân giải raster. Chúng đặt kích thước tài liệu của canvas và điền sẵn bảng kích thước export.

Vì mọi input đều đi theo trong liên kết, một thay đổi tham số là một tác phẩm hoàn chỉnh khác. Toàn bộ bảng màu này chỉ là một màu gốc, một sơ đồ hài hòa và một số bước:

![Chín bước qua bốn tông màu, tất cả đều lớn lên từ một màu hạt giống duy nhất mang trong liên kết](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

### 6. Lưu trữ đi qua cầu nối, không truy cập trực tiếp

Web shell: IndexedDB. Tauri: hệ thống tệp. CLI: trong bộ nhớ. Các công cụ chỉ thấy `host.state.save(slot, data)` và `host.state.load(slot)`. `localStorage` không được dùng - nó quá nhỏ và không thể chứa blob.

Người dùng có thể lưu nhiều slot chỉnh sửa có tên cho mỗi công cụ và quay lại từng phiên sau đó. Không cần tạo tài khoản; trạng thái là theo từng thiết bị. Vì cầu nối là mối nối duy nhất, trạng thái theo thiết bị đó cũng có thể *di chuyển được*: `shells/web/src/data-transfer.ts` đọc lại mọi thứ qua `host.profile`/`host.state`/`host.assets` thành một tệp zip `lolly-backup` duy nhất có thể nhập vào bất kỳ bản cài đặt nào khác - câu trả lời ngoại tuyến cho việc "chuyển sang thiết bị mới" mà không cần máy chủ (đặc tả đầy đủ: `docs/data-transfer.md`). Tích hợp SUSE ID (đồng bộ đa thiết bị) là một cột mốc tương lai xây trên nền này.

### 7. Nhãn độ trưởng thành trả lời rủi ro "được thương hiệu phê duyệt" ngay từ thiết kế

Mỗi công cụ khai báo `status: official | community | experimental` trong manifest của nó. Gallery sắp xếp theo status. Các công cụ thử nghiệm tự động đóng dấu bản quyền (watermark) khi xuất - watermark được áp dụng bởi `host.export.render`, không phải bởi công cụ, nên tác giả của một công cụ không chính thức không thể tắt nó.

Đây là câu trả lời mang tính cấu trúc cho rủi ro nhận thức rằng việc dùng bất kỳ công cụ nào cũng đồng nghĩa với việc thương hiệu phê duyệt. Các câu trả lời về quy trình (hàng đợi duyệt, giới hạn qua SUSE ID) được xếp chồng lên trên.

### 8. Đầu vào của công cụ được định kiểu qua manifest, kể cả tài sản

Các đầu vào khai báo một `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` và `file`. Host hiển thị một control chung cho mỗi loại từ manifest - các công cụ không viết bất kỳ mã control nào. (Tự điền sẵn từ hồ sơ người dùng không phải là một loại - bất kỳ đầu vào nào cũng có thể mang `bindToProfile`.) Ba loại mang trọng lượng hơn các loại còn lại:

- **`asset`** (với `filter` và `allowUpload`) là cầu nối tới hệ thống tài sản toàn cục; `allowUpload: false` là đòn bẩy thực thi thương hiệu cho những thứ như logo ô tài trợ, nơi chỉ cho phép dùng tài sản trong thư viện. Tệp người dùng tải lên dùng cùng hình dạng `AssetRef` như tài sản thư viện, nên các công cụ xử lý chúng như nhau.
- **`blocks`** là một nhóm trường lặp lại - một bảng thu nhỏ bên trong một đầu vào, được chỉnh sửa trong một bảng bên, với menu thêm có phân loại/định kiểu và các trường tài sản theo từng block. Nhấp vào một block đã hiển thị trên canvas sẽ tập trung vào hàng của block đó. Được dùng bởi `meeting-planner`, `chart-creator`, `event-name-badge`, `wayfinding-signage`, `color-block` và `digi-ad`.
- **`vector`** nhóm một tập số cố định (ví dụ một phép biến đổi) thành một control kết hợp; **`file`** giữ tệp của chính người dùng dưới dạng byte trong bộ nhớ cho các tiện ích biến đổi trên thiết bị (ví dụ `strip-data` và `compress-pdf`).

### 9. Template không chứa logic (Handlebars, không phải EJS)

Handlebars được chọn thay cho EJS một cách có chủ đích:
- Không chứa logic. Template có thể được soạn bởi người không phải lập trình viên.
- An toàn theo mặc định. `{{x}}` thoát HTML; `{{{x}}}` là tùy chọn thô (opt-in raw).
- Không có JS tùy ý trong template nghĩa là không có bề mặt kiểm toán XSS cho từng template.

Logic nằm trong `hooks.js`, nơi nó rõ ràng và có thể xem xét được. Các helper Handlebars có sẵn: `{{default}}`, `{{upper}}`, `{{lower}}`, `{{eq}}`, `{{markdown}}`, `{{asset ref}}`, `{{asset ref "property"}}` (cùng các helper định dạng dữ liệu `icsStamp`/`rfcText`/`csvCell` dùng bởi các template `.ics`/`.vcf`/`.csv` song hành).

### 10. Công cụ ghép công cụ

Một công cụ có thể nhúng bản kết xuất của một công cụ **khác** mà không cần import công cụ-tới-công cụ - việc ghép được engine giải quyết, không bao giờ do mã của công cụ. Có hai bề mặt:

- **Manifest khai báo** - `composes: [{ id, tool, inputs, format?, width?, height? }]`. Engine kết xuất công cụ con được nêu tên và đặt kết quả vào template không chứa logic dưới dạng `{{asset <id>}}`. `event-name-badge` ghép `qr-code` dưới dạng SVG ngay hôm nay.
- **URL nhúng có thể di chuyển** - `<img src="https://lolly.tools/tool/<id>.<ext>?<inputs>">`. Shell kết xuất công cụ con đó **cục bộ** (một pixel giữ chỗ hiển thị cho tới khi bản kết xuất cục bộ hoàn tất); không có gì bao giờ được lấy từ `lolly.tools`.

Ghép bản kết xuất của bất kỳ công cụ nào: một công cụ con **SVG** vẫn giữ nguyên là vector thật khi công cụ cha xuất sang SVG hoặc PDF và rasterize sắc nét cho PNG; công cụ con **PNG/JPG/WEBP** nhúng dưới dạng hình ảnh. Yêu cầu khả năng `compose`. Các công cụ con được ghép là trung gian - không bao giờ bị đóng watermark hay đóng dấu nguồn gốc - và việc ghép suy giảm một cách nhẹ nhàng: một shell không thể kết xuất một công cụ con chỉ đơn giản bỏ qua slot đó và công cụ cha vẫn kết xuất.

---

## Những gì chúng tôi cố tình chọn không làm

- **Không có EJS / không có JS tùy ý trong template.** Bề mặt tấn công XSS bằng không. Logic nằm trong `hooks.js`.
- **Không bắt buộc dùng CMS tài sản.** Từng cá nhân đưa thẳng các tệp sáng tạo của riêng mình vào danh mục ngay trong ứng dụng (khung nhìn [Danh mục](/info/using.html) và Brand Studio) - không máy chủ, không bảng điều khiển quản trị. Công việc được bàn giao dưới dạng một **phiên**: một liên kết chia sẻ mang theo toàn bộ trạng thái, và cùng phiên đó di chuyển theo trong một bản sao lưu hoặc qua một phiên cộng tác. Bất kỳ ai quản lý việc triển khai sau đó có thể khóa một phiên đã chia sẻ lại thành một **mẫu** - mở liên kết, ghi lại các giá trị của nó thành một mục mẫu trong thư mục của công cụ đó trong gói thương hiệu rồi commit - sau đó nó xuất hiện trong bộ chọn "New from template" của công cụ và có thể liên kết trực tiếp dưới dạng `?template=<id>`. Git là bước khóa lại thuộc về chủ sở hữu việc triển khai, không bao giờ thuộc về người tạo. Với một danh mục *được chia sẻ, có quản trị*, một tổ chức **có thể** quản lý thư mục tài sản theo cách tương tự và chặn các cập nhật qua việc xét duyệt PR - đây là một mô hình quản trị khả dụng, không phải một yêu cầu bắt buộc của ứng dụng.
- **Không ép buộc RBAC.** Ứng dụng mở này mặc định truy cập công khai; rủi ro thương hiệu được quản lý bằng nhãn độ trưởng thành + watermark. Một tổ chức muốn kiểm soát chặt hơn có thể lớp thêm hệ thống xác thực của riêng mình và danh mục được xét duyệt qua git ở trên.
- **Không có cơ sở dữ liệu trung tâm.** Mọi trạng thái người dùng đều theo từng thiết bị. Tích hợp SUSE ID nằm trong lộ trình nhưng không phải điều kiện chặn ra mắt.
- **Không có đường dẫn mã công cụ/engine dùng chung.** Engine là mã nguồn mở và các công cụ trung lập về thương hiệu trong `community/` cũng vậy; một gói thương hiệu như `brands/suse/` riêng tư mang theo công cụ và danh mục riêng của nó theo các điều khoản riêng. Dù theo cách nào, sự tách biệt này đều được thực thi (không import chéo từ `engine/` vào nội dung công cụ) để việc chia tách luôn gọn gàng.

---

## Vòng đời, từ đầu đến cuối

Một người dùng mở `lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H`:

1. **Khởi động.** Web shell mở IndexedDB, xây dựng cầu nối khả năng, đồng bộ catalog công cụ và tài sản (hoặc tải từ bộ nhớ đệm khi ngoại tuyến).
2. **Định tuyến.** URL hash → khung nhìn `tool`, với `qr-code` và các tham số URL được trích xuất.
3. **Tải.** `loadTool('qr-code', fetchFile)` lấy `tool.json`, xác thực theo JSON Schema, lấy mã nguồn `template.html`, `styles.css` và `hooks.js`.
4. **Phân tích trạng thái URL.** `parseUrlState` dịch các tham số URL thành giá trị đầu vào ban đầu. Tham chiếu tài sản (`?logo=suse/logo/primary`) được phân tích thành các đối tượng nhẹ `{ id, _unresolved: true }`.
5. **Runtime.** `createRuntime(tool, host, initialValues)` xây dựng mô hình đầu vào (gộp dữ liệu hồ sơ, giá trị mặc định và giá trị ban đầu), giải quyết tham chiếu tài sản qua `host.assets.get()`, tải hooks (`host` trong phạm vi closure, không sandbox), gọi `hooks.onInit`.
6. **Kết xuất.** Shell đăng ký nhận runtime; ở mỗi thay đổi trạng thái nó nhận `{ model, hydrated }`. Nó kết xuất các control đầu vào từ mô hình và ghi HTML template đã hydrate vào `#tool-canvas`.
7. **Tương tác.** Người dùng gõ vào một đầu vào → `runtime.setInput(id, value)` → áp dụng ràng buộc → gọi `hooks.onInput` → hydrate lại → kết xuất lại. Canvas cập nhật trực tiếp.
8. **Xuất.** Người dùng nhấp Tải xuống (PNG) → `runtime.export(canvasNode, 'png')` → `host.export.render` (rasterize qua dom-to-image-more; SVG/PDF đi qua các bộ vector hóa duyệt DOM chuyên biệt) → blob → `host.export.download`. Phạm vi định dạng mà một công cụ có thể chọn dùng khá rộng, và enum `render.formats` trong `schemas/tool.schema.json` là nguồn thẩm quyền cho việc đó - raster và float raster, vector và tệp cắt, in/CMYK, chuyển động, tài liệu có thể chỉnh sửa (`pptx`, `docx`, `odt`), bảng màu và đầu ra dữ liệu/văn bản, tệp âm thanh và font. [URL Mode](/info/url-mode.html) nêu tên từng id và nó tạo ra gì. Âm thanh nằm trong enum đó như bất kỳ thứ gì khác (`wav`, `mp3`, `m4a`, `opus`, được khai báo bởi audiogram và các công cụ ghi âm); riêng biệt, chế độ `render.capture` của một công cụ ghi âm điều khiển `host.recorder`, mà bản ghi đến dưới dạng một Blob hoàn chỉnh trong bất kỳ container nào mà trình duyệt đã ghi. (Các công cụ đặt `render.export: false` - ví dụ Color Palette, Countdown Timer, Strip Hidden Data, Text Helper, Compress PDF - ẩn các control tải xuống/định dạng/kích thước.) Các đơn vị vật lý được chuyển đổi theo từng định dạng ở đây (PDF → điểm trang thật, raster → pixel theo DPI với chunk `pHYs`). Metadata tác giả/nguồn gốc (tác giả, công cụ, nguồn - được xây dựng bởi `engine/src/metadata.ts`) được nhúng theo từng định dạng: PNG iTXt, JPEG EXIF, PDF info dict, SVG `<metadata>`, GIF comment. Các công cụ thử nghiệm được host chèn watermark, không phải công cụ.

![Bảng xuất mà `?options` mở ra: cặp tên tệp và định dạng, kích thước đầu ra và các control ghi tệp](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Cùng vòng đời trong Tauri. Cùng vòng đời trong CLI - jsdom cung cấp DOM không giao diện; đầu ra đi vào một tệp hoặc stdout.

---

## Trạng thái mã nguồn mở

**Mã nguồn theo giấy phép MPL-2.0.** `engine/`, `shells/*`, `services/*`, `schemas/` và `docs/` là mã nguồn mở theo **MPL-2.0** - một nền tảng khung dựng trung lập về nhà cung cấp dành cho công cụ thương hiệu, với mỗi đơn vị có thể phát hành nằm trong repository riêng của nó dưới [github.com/lolly-tools](https://github.com/lolly-tools).

**Nội dung công cụ được phát hành dưới dạng các gói thương hiệu**, mỗi gói có điều khoản riêng (xem `NOTICE.md` của gói đó). `community/` là repository công khai [`lolly-tools`](https://github.com/lolly-tools/lolly-tools) và các công cụ trung lập về thương hiệu của nó cũng theo MPL-2.0. `brands/suse/` là gói riêng tư `suse-lolly`: các công cụ SUSE và danh mục SUSE, **thuộc sở hữu độc quyền của SUSE**, bao gồm cả nhạc PremiumBeat được cấp phép của nó. `brands/lolly-start/` là thương hiệu khởi đầu trống mà repository này sở hữu. Phông chữ được phát hành bên trong một gói theo **SIL Open Font License 1.1** - gói SUSE mang theo các kiểu chữ SUSE và SUSE Mono.

`tools/` và `catalog/` ở gốc repo là các *view* bị gitignore: một profile lắp ráp chúng từ `community/` cộng với gói thương hiệu đang hoạt động, đó là lý do mọi script và shell đều đọc hai đường dẫn đó chứ không bao giờ đọc trực tiếp một gói.

Sự tách biệt này được thực thi - không có import chéo nào từ `engine/` vào nội dung công cụ - nên ranh giới giữa nền tảng và nội dung luôn gọn gàng.

---

## Nơi engine kết thúc và host bắt đầu

Nếu bạn có thể mô tả nó bằng dữ liệu thuần túy + Handlebars → **engine**.
Nếu nó chạm vào DOM, hệ thống tệp, mạng hoặc bất kỳ API trình duyệt/hệ điều hành nào → **host**.

Ranh giới này rõ ràng một cách có chủ đích. Engine là phần mã nguồn mở. Mọi thứ biết về SUSE, các nền tảng cụ thể hay môi trường runtime đều nằm ngoài nó.

Để biết thêm chi tiết, [`engine/README.md`](../engine/README.md) liệt kê mọi module của engine và chức năng của nó, và [Threat Model & Trust Boundaries](/info/threat-model.html) ghi lại nơi cùng ranh giới đó cũng đóng vai trò là ranh giới tin cậy.
