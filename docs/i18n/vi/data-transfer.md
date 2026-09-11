# Chuyển dữ liệu - gói `lolly-backup`

Mọi thứ mà một người dùng Lolly tích lũy đều nằm **trên thiết bị của họ** - không tài khoản, không đám mây. Gói chuyển dữ liệu là cách giá trị đó di chuyển: xuất nó trên một bản cài đặt, mang file đi bằng bất kỳ phương tiện nào (USB, AirDrop, gửi email cho chính mình, chia sẻ mạng) rồi nhập nó vào một bản cài đặt khác. File *chính là* phương tiện vận chuyển. Đích đến có thể offline hoặc online. Điều đó không quan trọng, vì không có gì từng liên lạc với máy chủ.

![Hai nút di chuyển toàn bộ bản cài đặt: Export my data ghi ra một tệp zip, Import data đọc lại tệp đó](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Trang này là đặc tả định dạng. Để xem hướng dẫn dành cho người dùng cuối, xem [Using Lolly → Moving to another device](/info/using.html). Việc triển khai nằm ở [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), và [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) chốt hợp đồng khứ hồi.

> **Phạm vi.** Một gói mang *dữ liệu người dùng*, không phải công cụ. Công cụ và tài sản danh mục được đồng bộ riêng và được giả định là đã có sẵn trên máy đích (trường hợp xấu nhất là ở phiên bản cao hơn). Việc nhập không bao giờ cài đặt hay nâng cấp một công cụ.

## Mục tiêu

- <!--i:box--> **Một định dạng, mọi shell.** Cùng một chuỗi byte được tạo ra và đọc bởi web PWA, các ứng dụng desktop/mobile Tauri và bất kỳ shell nào trong tương lai. Gói chính là hợp đồng. Cầu nối năng lực (capability bridge) của mỗi shell là bộ chuyển đổi theo từng nền tảng đứng sau nó.
- <!--i:shieldcheck--> **Sống sót qua chuyến đi.** Một gói bị hỏng hoặc bị cắt xén trong quá trình truyền sẽ báo lỗi rõ ràng khi nhập, không bao giờ khôi phục nửa vời.
- <!--i:clock--> **Tồn tại lâu hơn phiên bản này.** Một ứng dụng cũ hơn vẫn có thể nhập các phần mà nó nhận ra trong một gói mới hơn. Một định dạng thực sự phá vỡ tương thích sẽ bị từ chối một cách sạch sẽ.
- <!--i:check--> **An toàn khi hợp nhất.** Việc nhập vào một bản cài đặt đang được sử dụng không bao giờ xóa bất cứ thứ gì không có trong gói.

## Phong bì

Một gói chỉ là một `.zip` thông thường. File tải xuống được đặt tên theo người sở hữu nó - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (ví dụ `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - để một thư mục Downloads chứa các bản sao lưu vẫn dễ đọc. Phần tên và họ lấy từ hồ sơ và bị bỏ qua khi chưa thiết lập. Không có hồ sơ sẽ cho `LollyTools-2026-06-26-1.zip`, và chỉ có tên riêng sẽ cho `LollyTools-Ada-2026-06-26-1.zip`. Mỗi phần được làm sạch thành một token an toàn cho tên file (giữ lại chữ cái/chữ số Unicode, loại bỏ khoảng trắng/dấu câu, giới hạn 32 ký tự). `<n>` là một chuỗi số theo từng ngày, từng thiết bị, để các lần xuất lặp lại trong cùng một ngày không trùng nhau và vẫn theo thứ tự. `backupFilename()` trong [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) xây dựng tên này. Nội dung của zip giống hệt nhau bất kể tên gọi. Bên trong:

| Đường dẫn | Bắt buộc | Nội dung |
|---|---|---|
| `manifest.json` | có | Id định dạng, các phiên bản, số lượng và tính toàn vẹn theo từng phần. Điều đầu tiên trình đọc xem xét. |
| `profile.json` | khi đã thiết lập | Bản ghi `me` của người dùng (tên, liên hệ, tham chiếu ảnh đại diện, cờ). Đọc qua `host.profile`. |
| `sessions.json` | có | Mọi phiên đã lưu: slot, id/phiên bản công cụ, nhãn, ảnh thu nhỏ (data-URL) và toàn bộ dữ liệu đầu vào. Đọc qua `host.state`. |
| `assets.json` | có | Siêu dữ liệu cho mỗi tài sản đã tải lên (hình ảnh, font, token thương hiệu), mỗi cái trỏ tới các byte của nó dưới `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | theo từng tài sản | Các byte thô của tài sản (file hình ảnh và font). Được lưu không nén (các định dạng đã nén sẵn). Phần mở rộng chỉ mang tính hình thức. MIME trong `assets.json` mới là căn cứ chính thức. |
| `prefs.json` | có | Tùy chọn cục bộ thuộc sở hữu người dùng: `theme`, `sidebarWidth` và số liệu hoạt động `ct-metrics`. |
| `lolly.txt` | có | Một bản tóm tắt gói dễ đọc với con người (số lượng, hồ sơ, tên file) dành cho bất kỳ ai mở zip mà không có Lolly. Được tạo lại ở mỗi lần xuất và được nhận diện khi nhập, nên nó không bao giờ tính là một phần bị bỏ qua. Nó được ghi *sau* bản đồ toàn vẹn, nên nằm ngoài bản đồ đó. |

Gói này cố tình chỉ là một zip thông thường: nó sống sót nguyên vẹn qua bất kỳ phương thức vận chuyển nào, và bất kỳ công cụ giải nén nào cũng có thể kiểm tra nó.

`profile.json` là phần nhỏ nhất và là phần mà trình đọc thấy đầu tiên trong ứng dụng: các thông tin mà người tạo điền một lần, cộng với tùy chọn cho phép các công cụ sử dụng chúng.

![Biểu mẫu chi tiết Profile trở thành profile.json - tên, liên hệ, ảnh đại diện và tùy chọn cho phép bên cạnh chúng](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 1,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.webp": "sha256-…",
    "prefs.json": "sha256-…"
  }
}
```

| Trường | Ý nghĩa |
|---|---|
| `format` | Luôn là `lolly-backup`. Một file không có trường này bị từ chối với thông báo "not a Lolly backup". |
| `formatVersion` | Bố cục mà gói này được **ghi** ra. Tăng lên mỗi khi tập hợp phần hoặc cấu trúc thay đổi. Trình đọc **không** dựa vào trường này để quyết định. |
| `minReader` | Phiên bản trình đọc tối thiểu cần có để nhập gói này **một cách an toàn**. Đây là trường mà trình đọc dựa vào để quyết định. |
| `app` | Id ứng dụng đã tạo ra gói, phục vụ chẩn đoán. |
| `exportedAt` | Dấu thời gian ISO khi gói được tạo. |
| `counts` | Những gì trình ghi đã đưa vào, phục vụ hiển thị và kiểm tra tính hợp lý. |
| `integrity` | Tùy chọn. Ánh xạ mọi phần trừ `manifest.json` tới một digest kiểu SRI `sha256-<base64>` của các byte **chưa nén** của nó. |

## Chính sách phiên bản (tương thích xuôi)

Sự tách biệt giữa `formatVersion` và `minReader` là điều cho phép định dạng phát triển mà không bỏ rơi các bản cài đặt cũ:

- Một trình đọc sẽ nhập một gói khi `manifest.minReader ≤` phiên bản trình đọc của chính nó. Nó chỉ từ chối (với thông báo "needs a newer version of the app") khi gói yêu cầu rõ ràng một trình đọc mới hơn.
- Một thay đổi **bổ sung** - một phần *tùy chọn* mới, hoặc một trường manifest tùy chọn mới - làm tăng `formatVersion` nhưng để `minReader` không đổi. Các ứng dụng cũ hơn vẫn nhập mọi phần mà chúng nhận ra. Các phần chúng không nhận ra sẽ bị bỏ qua (xem bên dưới), chứ không bị âm thầm loại bỏ.
- Một thay đổi **phá vỡ tương thích** - khi việc nhập sai một phần làm hỏng dữ liệu, hoặc khi một phần trước đây tùy chọn trở thành bắt buộc - sẽ làm tăng `minReader`. Các ứng dụng cũ hơn khi đó sẽ từ chối một cách sạch sẽ thay vì nhập thứ mà chúng không thể xử lý.
- Nếu một gói trong tương lai đặt `formatVersion` nhưng bỏ qua `minReader`, trình đọc sẽ thận trọng quay về dựa vào `formatVersion` (coi thay đổi đó là phá vỡ tương thích).

> **Quy tắc ngón tay cái cho tác giả:** nếu mọi trình đọc hiện có vẫn hành xử đúng khi bỏ qua phần bổ sung của bạn, thì đó là thay đổi bổ sung - tăng `formatVersion`, giữ nguyên `minReader`. Ngược lại, hãy tăng `minReader`.

## Tính toàn vẹn

Khi `manifest.integrity` có mặt, trình đọc xác minh SHA-256 của từng phần được liệt kê **trước khi ghi bất cứ thứ gì**. Một sự không khớp ("failed its integrity check") hoặc một phần bị thiếu ("incomplete") sẽ hủy toàn bộ quá trình nhập - không có chuyện khôi phục một phần. Điều này bắt được sự hỏng hóc mà một phương thức truyền file có thể gây ra (một lượt AirDrop bị cắt xén, một cổng email mã hóa lại tệp đính kèm, một sector USB bị lỗi).

Tính toàn vẹn được thiết kế theo kiểu nỗ lực tối đa: nó chỉ được ghi ở nơi có Web Crypto (mọi ngữ cảnh trình duyệt an toàn và Node hiện đại), và chỉ được xác minh khi cả bản đồ lẫn Web Crypto đều có mặt. Một gói không có bản đồ - ví dụ một gói từ trước khi tính toàn vẹn tồn tại - vẫn được nhập không thay đổi. "Không thể xác minh" không bao giờ bị coi là "hỏng".

Manifest không liệt kê chính nó lẫn README `lolly.txt` được tạo lại. Các digest bao phủ những phần mà manifest bảo chứng.

## Ngữ nghĩa của việc nhập

Nhập là **hợp nhất-ghi đè**, không bao giờ là thay thế toàn bộ:

- Dữ liệu hiện có trên máy đích được giữ nguyên tại chỗ.
- Bất kỳ khóa nào trùng nhau - hồ sơ, một slot phiên, một id hình ảnh đã tải lên - đều bị thay thế bởi bản sao được nhập.
- Không có gì không nằm trong gói bị đụng tới. Một phiên mà máy đích có nhưng gói không có sẽ vẫn tồn tại sau khi nhập.

Các phiên đã lưu tự động liên kết lại với hình ảnh của chúng: tham chiếu tài sản được giữ theo id, và cầu nối sẽ phân giải lại chúng sau khi các hình ảnh đã tải lên được khôi phục (dù sao thì nó cũng phải làm vậy, vì URL `blob:` không tồn tại được qua một lần tải lại trang).

Bản tóm tắt nhập báo cáo `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` đếm số tài sản đã tải lên nhưng không thể khôi phục (chẳng hạn bộ nhớ thiết bị đầy). Nó khác với `skipped`, vốn đếm các phần từ một trình ghi mới hơn tương thích ngược mà bản build này không nhận ra. Giao diện hiển thị `skipped` ("… · N newer items skipped"), để việc khôi phục trung thực về những gì nó đã bỏ lại.

## Những gì không được mang theo

- **Bộ nhớ đệm danh mục** (siêu dữ liệu và blob tài sản đã tải xuống, chỉ mục công cụ) - được đồng bộ lại miễn phí trên máy đích.
- **Công cụ và tài sản thương hiệu** - nằm ngoài phạm vi, và được giả định là đã có sẵn trên máy đích.
- **URL `blob:` / object URL** - được cầu nối tạo lại khi tải.
- **Bộ đếm chuỗi số xuất** - bộ đếm đặt tên tải xuống theo từng ngày (khóa `localStorage` `lolly-export-seq`) chỉ là một tiện ích đặt tên cục bộ. Nó được giữ ngoài `PREF_KEYS`, nên không bao giờ đi kèm trong một gói.

Đồng hồ đo dung lượng lưu trữ liệt kê chi tiết theo cùng cách phân chia đó. Saved sessions và My images được mang theo trong một gói. Asset cache, tool previews và offline pins bên dưới chúng đều có thể tạo lại được, nên chúng ở lại.

![Đồng hồ đo dung lượng lưu trữ chia dữ liệu của thiết bị này thành các danh mục có tên, với Saved sessions và My images được theo dõi riêng biệt so với Asset cache, ở đây trên một bản cài đặt mới nơi mọi danh mục vẫn còn trống](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## Cam kết xuyên shell

`data-transfer.ts` chỉ đọc và ghi thông qua cầu nối năng lực (capability bridge) (`host.profile`, `host.state`, `host.assets`) và các tùy chọn `localStorage` dùng chung. Vì cầu nối là điểm giao duy nhất, *cùng một* module tạo ra gói dữ liệu giống hệt về byte trên mọi shell dù lớp lưu trữ bên dưới khác nhau - IndexedDB trên web, hệ thống tệp trên Tauri. Các shell Tauri dùng lại module này không đổi. Chỉ phần triển khai `host.state` của chúng là khác. Bài test headless thực hiện toàn bộ chu trình khứ hồi với một cầu nối trong bộ nhớ, đó là lý do nó đại diện cho tất cả.

Hai shell nằm ngoài đảm bảo đó, vì những lý do khác nhau:

- **CLI dùng một lần** không có gì để mang theo - trạng thái của nó nằm trong bộ nhớ và chỉ tồn tại tạm thời trong mỗi lần gọi.
- **TUI** có lưu trạng thái (`~/.lolly`: các phiên, thư mục, hồ sơ) và khung Profile của nó có thể sao lưu, nhưng nó ghi ra một kho lưu trữ *đơn giản hơn* của riêng nó: `sessions/<slot>.json` cho mỗi phiên cộng với `profile.json` và `folders.json`, không có manifest, không có `formatVersion`/`minReader` và không có bản đồ toàn vẹn. Định dạng này **không** thể nhập lại bằng định dạng ở đây - trình đọc sẽ từ chối nó vì "not a Lolly backup" - và gây nhầm lẫn vì nó dùng tên tương tự (`lolly-backup-<stamp>.zip`). Hợp nhất hai định dạng này là một khoảng trống đã biết.

## Các điểm mở rộng dự phòng

Phong bì dữ liệu được thiết kế là một manifest cộng với một tập các phần được đặt tên, để các loại dữ liệu di động mới có thể đi kèm sau này **mà không gây thay đổi phá vỡ tương thích**. Chúng được thêm vào như các phần bổ sung (`formatVersion` mới, `minReader` không đổi), và trình đọc hiện tại bỏ qua những gì nó không nhận ra. Đây là các mục nằm trong [lộ trình](/info/overview.html#roadmap), chưa được triển khai. Tên gọi được dự phòng ở đây để định dạng vẫn nhất quán khi chúng ra mắt.

- **`tokens.json` - design token.** Một tài liệu design token theo chuẩn [W3C DTCG](https://tr.designtokens.org/format/) (định dạng mà [Penpot nhập và xuất](https://help.penpot.app/user-guide/design-systems/design-tokens/) - các token có `$value`/`$type`/`$description`, được tổ chức thành nhóm, tập hợp và chủ đề). Một tập token trong gói cho phép người dùng chuyển các thành phần thương hiệu gốc giữa các lần cài đặt cùng với các phiên làm việc của họ. Về lâu dài, một tập token đã nhập trở thành một nguồn hạng nhất mà các công cụ và tài sản bảng màu phân giải dựa vào.
- **`penpot/` - các tệp Penpot đã nhập.** Một thư mục dự phòng cho một tệp Penpot (hoặc tập con liên quan đến Lolly được trích xuất từ đó) được nhập vào và hiển thị *như một công cụ*. Gói dữ liệu sẽ mang theo định nghĩa đã nhập, để nó đi cùng với phần còn lại của dữ liệu người dùng.

Bất cứ thứ gì nằm ngoài các tên dự phòng này và các phần nêu trên, đối với trình đọc, đều là một phần không xác định: được giữ nguyên và tính vào `skipped`.

## Tham khảo

- Module: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - hàm đặt tên `backupFilename()` là nội bộ).
- Test hợp đồng: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - các trường hợp khứ hồi, hợp nhất, toàn vẹn, tương thích ngược và cổng kiểm tra trình đọc.
- Bề mặt cầu nối được dùng: `host.profile`, `host.state`, `host.assets` - xem [Host API](/info/host-api.html).
