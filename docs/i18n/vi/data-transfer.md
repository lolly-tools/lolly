# Chuyển dữ liệu: gói `lolly-backup`

Gói sao lưu chuyển thư viện cá nhân mà Lolly giữ trên thiết bị: xuất ở một bản cài đặt, chuyển tệp (USB, AirDrop, email cho chính mình hoặc thư mục chia sẻ qua mạng) và nhập vào bản cài đặt khác. Xuất và nhập không cần máy chủ, và đích có thể ngoại tuyến.

Đây là đặc tả định dạng dành cho người xây dựng ứng dụng vỏ, công cụ hoặc tập lệnh làm việc với bản sao lưu. Để chuyển công việc của bạn, đọc [Chuyển công việc sang thiết bị khác](/info/find-your-work.html#move-your-work-to-another-device).

![Hai nút chuyển toàn bộ bản cài đặt: Export my data ghi một tệp zip, Import data đọc lại tệp đó](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note Phạm vi
Gói mang *dữ liệu người dùng*, không mang công cụ trong danh mục. Công cụ và tài nguyên trong danh mục đồng bộ riêng và được giả định đã có ở đích, cùng lắm là ở phiên bản cao hơn. Công cụ do người dùng tạo đi trong `profile.json`. Việc nhập không bao giờ cài đặt hay nâng cấp công cụ trong danh mục.
:::

<!--i:eti-badge-check-->
## Mục tiêu

- <!--i:box--> **Một định dạng, mọi ứng dụng vỏ.** Ứng dụng web, ứng dụng máy tính và di động cùng các ứng dụng vỏ tương lai dùng chung cấu trúc bao gói và lược đồ các phần. Các phần tùy chọn phụ thuộc vào khả năng của từng ứng dụng vỏ, và các phần không được hỗ trợ được báo lại. Mỗi cầu nối khả năng cung cấp bộ chuyển tiếp lưu trữ của mình.
- <!--i:shieldcheck--> **An toàn khi chuyển.** Gói hỏng hoặc bị cắt cụt trong lúc chuyển sẽ nhập thất bại với lỗi và không bao giờ khôi phục dở dang.
- <!--i:clock--> **Dùng được qua nhiều phiên bản.** Ứng dụng cũ hơn nhập những phần mà nó nhận ra trong gói mới hơn. Định dạng phá vỡ tương thích bị từ chối hoàn toàn.
- <!--i:check--> **An toàn khi hợp nhất.** Nhập vào bản cài đặt đang được dùng không bao giờ xóa bất cứ thứ gì không có trong gói.

<!--i:eti-package-->
## Cấu trúc bao gói

Gói là một `.zip` thông thường. Nó giữ nguyên qua mọi cách truyền, và bất kỳ công cụ giải nén nào cũng kiểm tra được nội dung.

Bản tải xuống được đặt tên theo chủ sở hữu: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, ví dụ `LollyTools-Ada-Lovelace-2026-06-26-1.zip`. Tên và họ lấy từ hồ sơ và được bỏ qua khi chưa đặt: không có hồ sơ sẽ cho `LollyTools-2026-06-26-1.zip`, còn chỉ có tên sẽ cho `LollyTools-Ada-2026-06-26-1.zip`. Mỗi tên trở thành token an toàn cho tên tệp (giữ chữ cái và chữ số Unicode, bỏ khoảng trắng và dấu câu, tối đa 32 ký tự). `<n>` là số thứ tự riêng theo ngày và thiết bị, nên các lần xuất lặp lại trong một ngày không trùng tên và giữ đúng thứ tự. `backupFilename()` trong `data-transfer.ts` tạo tên. Tên không thay đổi nội dung zip.

| Đường dẫn | Bắt buộc | Nội dung |
|---|---|---|
| `manifest.json` | có | Id định dạng, phiên bản, số lượng và tính toàn vẹn của từng phần. Trình đọc đọc tệp này trước. |
| `profile.json` | khi đã đặt | Bản ghi `me` của người dùng: tên, liên hệ, tham chiếu ảnh chân dung và các cờ, cùng thư mục, Trash, bản thiết kế dự án, mẫu người dùng và công cụ do người dùng tạo, mục yêu thích, công cụ ẩn, ngôn ngữ và lựa chọn emoji. Đọc qua `host.profile`. |
| `sessions.json` | có | Mọi phiên đã lưu: ô lưu, id và phiên bản công cụ, nhãn, ảnh thu nhỏ (URL dữ liệu) và toàn bộ dữ liệu đầu vào. Đọc qua `host.state`. |
| `assets.json` | có | Siêu dữ liệu cho từng tài nguyên đã tải lên (ảnh, phông chữ, token thương hiệu, logo, bản lưu của các tệp tải xuống), mỗi mục trỏ đến các byte của nó trong `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | theo tài nguyên | Các byte thô của tài nguyên, lưu không nén vì hầu hết đã ở định dạng nén. Phần mở rộng chỉ để hiển thị; loại MIME trong `assets.json` mới là căn cứ chính thức. |
| `assets/blobs/<n>.c2pa` | khi có | Content Credentials được trích xuất dưới dạng byte nhị phân chính xác, được tham chiếu bằng `_credentialFile` trong bản ghi tài nguyên. Đây không phải khóa ký của thiết bị. |
| `design-systems.json` | khi có | Các hệ thống thiết kế được tạo hoặc thêm trên bản cài đặt này, dưới dạng `{ active, records }`. Xem [Quy tắc nhập](#import-rules). |
| `file-history.json` | tùy chọn | Ảnh chụp trạng thái tài nguyên có phiên bản, báo cáo thao tác tệp đã hoàn tất và bản kê lô đầy đủ, với phiên bản riêng. Do bộ chuyển tiếp sao lưu `fileHistory` nội bộ của ứng dụng vỏ cung cấp. |
| `revision-history.json` | tùy chọn, sao lưu thủ công | ID tác phẩm ổn định, điểm lưu được giữ lại, ảnh thu nhỏ và bản nháp khôi phục luân phiên. Do `host.state.history.backup` cung cấp khi được hỗ trợ. |
| `file-history/versions/` | theo ảnh chụp trạng thái | Các byte tài nguyên trước đây và chứng thực được trích xuất, dù tài nguyên hiện tại còn tồn tại hay không. |
| `file-history/results/` | theo thao tác đã hoàn tất | Các byte đầu ra chính xác. Không giữ hay đưa vào bất kỳ tệp gốc nào được chọn để chuyển đổi. |
| `prefs.json` | có | Tùy chọn cục bộ thuộc người dùng: `theme`, `sidebarWidth` và số liệu hoạt động `ct-metrics`. |
| `lolly.txt` | có | Bản tóm tắt gói dễ đọc (số lượng, hồ sơ, tên tệp) cho bất kỳ ai mở zip mà không có Lolly. Được tạo lại mỗi lần xuất và được nhận diện khi nhập, nên không bao giờ bị tính là phần bị bỏ qua. Nó được ghi sau bảng toàn vẹn, nên bảng không bao gồm tệp này. |

::: details Cách quá trình xuất ghi zip
Quá trình xuất ghi zip từng phần một (`shells/web/src/lib/zip-stream.ts`). Tệp tải lên, kết quả đã lưu và phiên bản tài nguyên đã lưu được đọc theo lát 4 MiB, không bao giờ đọc toàn bộ. Kết quả và phiên bản đã lưu trước tiên được kiểm tra theo SHA-256 đã ghi. Sau đó từng tệp được đọc để lấy tổng kiểm tra và mã băm toàn vẹn, và zip tham chiếu đến tệp tại chỗ.

Không có gì được mã hóa lại. Mỗi phần giữ nguyên các byte và mã băm, nên tệp mang Content Credentials giữ các byte mà chữ ký của nó bao phủ. Với cùng các phần và thời điểm, zip giống hệt zip của bộ ghi trong bộ nhớ trước đây, ngoại trừ tệp lịch sử lớn hơn 16 MiB được nén theo từng phần. `tests/backup-streaming.test.ts` kiểm tra điều này theo các mã băm tham chiếu đã ghi.

Với thư viện tổng hợp 192 MiB, đo trong Node, việc hoàn tất sao lưu cần thêm khoảng 125 đến 150 MiB ngoài thư viện, so với khoảng 850 MiB cho bộ ghi trong bộ nhớ (`node scripts/bench-backup-finalise.ts`). Quá trình nhập vẫn đọc toàn bộ zip vào bộ nhớ.
:::

<!--i:eti-file-->
## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 3,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3, "assetVersions": 1, "fileOperations": 1 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.bin": "sha256-…",
    "file-history.json": "sha256-…",
    "file-history/versions/0.bin": "sha256-…",
    "file-history/results/0.bin": "sha256-…",
    "prefs.json": "sha256-…"
  }
}
```

| Trường | Ý nghĩa |
|---|---|
| `format` | Luôn là `lolly-backup`. Tệp thiếu giá trị này bị từ chối là "không phải bản sao lưu Lolly". |
| `formatVersion` | Bố cục được dùng để **ghi** gói này. Tăng mỗi khi tập hợp hoặc cấu trúc các phần thay đổi. Trình đọc **không** dựa vào trường này để quyết định có nhập hay không. |
| `minReader` | Phiên bản trình đọc tối thiểu có thể nhập gói này **an toàn**. Đây là trường mà trình đọc dựa vào để quyết định có nhập hay không. |
| `app` | Id ứng dụng tạo gói, dùng để chẩn đoán. |
| `exportedAt` | Dấu thời gian ISO khi gói được tạo. |
| `counts` | Những gì bộ ghi đã đưa vào, để hiển thị và kiểm tra tính hợp lý. |
| `integrity` | Tùy chọn. Ánh xạ mọi phần trừ `manifest.json` đến mã băm `sha256-<base64>` kiểu SRI của các byte **chưa nén** của phần đó. |

<!--i:eti-tag-->
## Chính sách phiên bản

Hai số phiên bản cho phép định dạng phát triển mà không bỏ lại các bản cài đặt cũ.

![Thay đổi định dạng gói có thể là bổ sung, mà trình đọc cũ có thể bỏ qua, hoặc phá vỡ tương thích, khi nhập sai sẽ gây hỏng dữ liệu. Bổ sung tăng formatVersion và giữ minReader; phá vỡ tương thích tăng formatVersion và tăng minReader. Trình đọc nhập khi minReader không lớn hơn phiên bản của chính nó.](/info/diagrams/concepts/backup-version-gate.svg)

- Trình đọc nhập gói khi `manifest.minReader` không lớn hơn phiên bản của chính trình đọc. Nó chỉ từ chối với thông báo "cần phiên bản ứng dụng mới hơn" khi gói yêu cầu trình đọc mới hơn.
- Thay đổi **bổ sung**, như phần tùy chọn mới hoặc trường bản kê tùy chọn mới, tăng `formatVersion` và giữ nguyên `minReader`. Ứng dụng cũ vẫn nhập mọi phần nó nhận ra, và các phần không nhận ra được báo là đã bỏ qua, không bị bỏ âm thầm.
- Thay đổi **phá vỡ tương thích**, khi nhập sai một phần gây hỏng dữ liệu hoặc phần tùy chọn trở thành bắt buộc, tăng `minReader`. Ứng dụng cũ khi đó từ chối hoàn toàn thay vì nhập thứ nó không thể xử lý. Ứng dụng cũ khi đó từ chối gói hoàn toàn.
- Nếu gói tương lai đặt `formatVersion` nhưng bỏ `minReader`, trình đọc chuyển sang dùng `formatVersion` để quyết định có nhập hay không và coi thay đổi là phá vỡ tương thích.

::: note Quy tắc thực hành cho tác giả
Nếu mọi trình đọc hiện có vẫn xử lý đúng khi bỏ qua phần bạn thêm, thay đổi là bổ sung: tăng `formatVersion` và giữ `minReader`. Nếu không, tăng `minReader`.
:::

<!--i:eti-shield-check-->
## Tính toàn vẹn

Khi có `manifest.integrity`, trình đọc kiểm tra SHA-256 của từng phần được liệt kê **trước khi ghi bất cứ thứ gì**. Không khớp ("không vượt qua kiểm tra tính toàn vẹn") hoặc thiếu phần ("không đầy đủ") sẽ dừng việc nhập, nên không có khôi phục một phần. Việc này phát hiện hư hỏng khi truyền: AirDrop bị cắt cụt, cổng email mã hóa lại tệp đính kèm, sector USB bị lỗi.

Tính toàn vẹn được bảo đảm trong khả năng có thể. Nó chỉ được ghi khi có Web Crypto (mọi ngữ cảnh trình duyệt an toàn và Node hiện đại), và chỉ được kiểm tra khi có cả bảng lẫn Web Crypto. Gói không có bảng, như gói từ trước khi có tính toàn vẹn, vẫn được nhập như cũ: "không thể xác minh" không bao giờ được coi là "hỏng".

Bản kê không liệt kê chính nó hay `lolly.txt` được tạo lại.

<!--i:eti-download-->
## Quy tắc nhập

Lần nhập chạy theo một trong hai chế độ.

- **Merge** là thao tác mà **Import data…** và lần tham gia đồng bộ đầu tiên, **Bring it to this device**, thực hiện. Dữ liệu ở đích được giữ lại, và không có gì ngoài gói bị tác động.
- **Replace** là chế độ đồng bộ thiết bị dùng để giữ các thiết bị đồng nhất. Nó lấy bản ghi hồ sơ, tùy chọn, phiên, ảnh và lựa chọn hệ thống thiết kế đang hoạt động từ bản sao đã đồng bộ. Nó chỉ xóa các mục mà thiết bị khác đã xóa kể từ lần đồng bộ gần nhất. Khôi phục bản sao trước đó trước tiên lưu thiết bị, rồi làm cho thiết bị khớp với bản sao đó và xóa mọi thứ mà bản sao không chứa. [Đồng bộ các thiết bị của bạn](/info/sync.html) mô tả những gì người dùng thấy.

Lần hợp nhất xử lý từng loại dữ liệu như sau:

| Dữ liệu | Đã có ở đích | Chỉ có trong gói |
|---|---|---|
| Phiên (theo ô lưu) và ảnh đã tải lên (theo id) | Bản sao được lưu gần đây hơn được giữ lại, nên bản sao lưu cũ không bao giờ ghi đè công việc mới hơn. Thời điểm bằng nhau hoặc không rõ thì giữ bản sao ở đích. | Được thêm |
| Thư mục | Tên và thư mục cha ở đích được giữ lại, và thư mục nhận thêm các mục trong gói mà nó còn thiếu. Phiên được xếp vào thư mục ở đích vẫn nằm ở đó. | Được thêm |
| Mục yêu thích (công cụ, tài nguyên danh mục và mục Projects) | Được kết hợp | Được thêm |
| Mẫu, mẫu Projects và công cụ người dùng (theo id) | Bản ghi ở đích được giữ lại. | Được thêm |
| Mục Trash | Mục ở đích được giữ lại. | Được thêm, để mục có thể khôi phục trên một trong hai bản cài đặt vẫn khôi phục được. Mục có thư mục đang được dùng lại ở đích, hoặc có ô Trash mà đích đã dùng, được bỏ qua. |
| Các trường hồ sơ khác (tên, thông tin liên hệ, ngôn ngữ, cờ tính năng, công cụ ẩn và các cài đặt khác) | Giá trị ở đích được giữ lại. | Được lấy khi trường ở đích trống |
| Tùy chọn (`prefs.json`) | Giá trị ở đích được giữ lại. | Được ghi khi đích chưa có |
| Hệ thống thiết kế (theo id) | Bản ghi trong gói thay thế bản ghi ở đích. | Được thêm. Lựa chọn đang hoạt động của gói chỉ áp dụng khi đích không có hệ thống thiết kế riêng. |
| Lịch sử tác phẩm | Bản sao được lưu gần đây hơn vẫn là bản hiện tại, còn bản kia được giữ làm bản nháp được bảo vệ. | Được thêm |

**Phiên đã lưu tự động liên kết lại với ảnh của chúng.** Tham chiếu tài nguyên được giữ theo id. Cầu nối phân giải lại chúng sau khi ảnh được khôi phục, vì URL `blob:` không tồn tại qua lần tải lại.

**Bản ghi lịch sử không bao giờ thay đổi sau khi được ghi.** Nhập lại các phiên bản tài nguyên và ID thao tác không thêm gì, và ID đã chỉ đến các byte hoặc lịch sử khác bị từ chối, không bị ghi đè. Nhập lại tài nguyên hiện tại giống hệt giữ phiên bản của nó, còn tài nguyên hiện tại đã thay đổi phải mang phiên bản khác.

**Lịch sử tác phẩm có thêm vài quy tắc.** Tác phẩm có ô lưu mà đích dùng cho tác phẩm khác được thêm thành tác phẩm riêng, còn tác phẩm trong Trash của đích vẫn ở đó. Id điểm lưu chỉ đến nội dung khác ở đích thì giữ nội dung của đích. Tệp lưu trữ không vượt qua các phép kiểm tra riêng sẽ dừng việc nhập trước mọi thay đổi hồ sơ, phiên, tài nguyên hoặc tùy chọn, và nhập lại bản giống hệt không tốn thêm dung lượng.

**Bản tóm tắt báo những gì đã xảy ra.** Mọi lần nhập đều trả về `profile`, `sessions`, `userAssets`, `prefs`, `skipped` và `failedAssets`.

- `failedAssets` đếm tài nguyên đã tải lên không thể khôi phục, chẳng hạn do bộ nhớ thiết bị đã đầy.
- `skipped` đếm các phần từ bộ ghi mới hơn mà bản dựng này không nhận ra. Ứng dụng hiện số lượng ("… · Đã bỏ qua N mục mới hơn").
- Với lịch sử tệp, bản tóm tắt thêm `assetVersions`, `fileOperations`, `fileBatches` và `failedHistory`. Hết dung lượng lưu trữ hoặc xung đột ID bất biến có thể gây khôi phục một phần, và khi đó ứng dụng yêu cầu người dùng giữ bản sao lưu nguồn.
- Với lịch sử tác phẩm, nó thêm `revisions` và `recoveryDrafts`, chỉ đếm những gì lần nhập này thêm, cùng `added`, `kept`, `replaced`, `copies` và `hidden` cho cách mỗi tác phẩm được hợp nhất. `skippedCheckpoints` đếm các điểm lưu có id chỉ đến nội dung khác ở đích, còn `historyLeftOut` đếm các điểm lưu và bản nháp cũ không vừa dung lượng lịch sử của thiết bị.
- Lần nhập thay thế thêm `removed` và `failedRemovals`.

Việc khôi phục không phải là một giao dịch duy nhất trên các kho hồ sơ, phiên, tài nguyên và lịch sử. Đồng bộ đám mây **không** cập nhật mốc bản sửa đổi đã áp dụng sau khi khôi phục một phần hoặc khôi phục không được hỗ trợ, nên bản sao vẫn sẵn có để thử lại.

<!--i:eti-unlink-->
## Những gì không được chuyển theo

- **Bộ nhớ đệm danh mục** (siêu dữ liệu và blob tài nguyên đã tải xuống, chỉ mục công cụ), được thiết bị đích đồng bộ lại.
- **Công cụ và tài nguyên trong danh mục**, được giả định là đã có ở thiết bị đích. Token thương hiệu, phông chữ và logo do người dùng thêm là tài nguyên người dùng và được chuyển theo.
- **`blob:` và URL đối tượng**, được cầu nối tạo lại khi tải.
- **Bản gốc dùng để chuyển đổi, quyền thực thi có thời hạn đang hiệu lực và bí mật truy cập hoặc ký chỉ có trên máy.** Chúng không phải là lịch sử có thể chuyển theo. Kết quả đã lưu là một bản sao. Điều đó không có nghĩa là nguồn ban đầu đã được sao lưu.
- **Bộ đếm thứ tự xuất**, bộ đếm đặt tên tệp tải xuống theo ngày trong `localStorage` (`lolly-export-seq`). Nó không nằm trong `PREF_KEYS`, nên không bao giờ được chuyển theo trong gói.

Đồng hồ dung lượng cũng hiển thị cách phân chia này. Saved sessions, My images và File results & versions được đưa vào gói. Bộ nhớ đệm tài nguyên, bản xem trước công cụ và các mục ghim ngoại tuyến có thể tạo lại và được giữ ở thiết bị cũ.

![Đồng hồ dung lượng chia dữ liệu của thiết bị này thành các danh mục có tên, với Saved sessions và My images được theo dõi riêng với Asset cache, ở đây là một bản cài đặt mới mà mọi danh mục vẫn trống](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

<!--i:eti-building-->
## Dữ liệu tổ chức với Lolly Work

Gói này sao lưu thư viện cá nhân trên thiết bị. Một gói không phải là bản sao lưu của một hệ thống **Lolly Work**. Tài khoản tổ chức, chính sách truy cập, dự án dùng chung, phiên bản danh mục, phê duyệt, tác vụ kết xuất và bản ghi kiểm toán do dịch vụ đó lưu giữ. Kết nối lại và đăng nhập để truy cập lại công việc dùng chung. Nhập một gói cá nhân không cấp quyền truy cập đó.

Đơn vị vận hành sao lưu, lưu giữ và xóa dữ liệu máy chủ theo hướng dẫn riêng của Lolly Work: [Sao lưu và khôi phục](/info/work-operations.html#backup-and-restore) và [Lưu trữ và vòng đời dữ liệu của Lolly Work](/info/work-data-lifecycle.html). Xóa hoặc xuất dữ liệu thiết bị không thực hiện bất kỳ thao tác máy chủ nào trong số đó.

<!--i:eti-monitor-->
## Giữa các lớp vỏ ứng dụng

`data-transfer.ts` chỉ đọc và ghi qua cầu nối khả năng (`host.profile`, `host.state`, `host.assets`) và các tùy chọn `localStorage` dùng chung. Cùng một mô-đun đọc và ghi cấu trúc bao chung trên web và trong ứng dụng máy tính, di động, trên IndexedDB hoặc bộ lưu trữ hệ thống tệp. Các phần lịch sử tùy chọn chỉ xuất hiện ở nơi có bộ tiếp hợp tương ứng. Khi nhập, phần không được hỗ trợ được báo là đã bỏ qua. Bộ kiểm thử không giao diện kiểm tra các phần chung qua cầu nối trong bộ nhớ, và các giao dịch lịch sử cũng có kiểm thử trên trình duyệt thật.

Hai lớp vỏ nằm ngoài phạm vi bảo đảm đó:

- **CLI chạy một lần** không có gì để chuyển: trạng thái của nó nằm trong bộ nhớ và chỉ tồn tại trong một lần gọi.
- **TUI** giữ trạng thái trong `~/.lolly` (phiên, thư mục, hồ sơ). Chế độ xem Profile của nó ghi một tệp sao lưu riêng đơn giản hơn: `saved-state/<slot>.json` cho mỗi phiên cùng với `profile.json` và `folders.json`, không có bản kê, không có `formatVersion` hay `minReader` và không có bản đồ kiểm tra tính toàn vẹn. Trình đọc định dạng này từ chối tệp lưu trữ đó vì "không phải bản sao lưu Lolly", dù tên tương tự nhau (`lolly-backup-<stamp>.zip`). Việc thống nhất hai định dạng là một thiếu sót đã biết.

<!--i:eti-clock-->
## Chưa thể chuyển theo

Những loại dữ liệu có thể chuyển theo mới có thể được thêm sau dưới dạng các phần bổ sung (`formatVersion` mới, cùng `minReader`). Hệ thống thiết kế đã được chuyển theo cách này, dưới dạng `design-systems.json` cùng các tài nguyên người dùng của chúng.

Hai tên được dành riêng cho dữ liệu chưa được chuyển theo:

- **`tokens.json`** sẽ chứa một tài liệu token thiết kế [W3C DTCG](https://tr.designtokens.org/format/) với các nhóm, bộ và chủ đề, là định dạng [Penpot nhập và xuất](https://help.penpot.app/user-guide/design-systems/design-tokens/). Token thương hiệu riêng của người dùng đã được chuyển theo dưới dạng tài nguyên `user/tokens/brand` trong `assets.json`, và token của hệ thống thiết kế được chuyển cùng bản ghi của nó.
- **`penpot/`** được dành riêng cho một tệp Penpot đã được nạp, hoặc phần con liên quan đến Lolly của nó, được cung cấp dưới dạng một công cụ.

<!--i:eti-history-->
## Các phần lịch sử

Hai phần lịch sử là tùy chọn và có phiên bản riêng.

::: details Lịch sử sáng tạo (v3)
Bản sao lưu thủ công từ bản cài đặt web có lịch sử sáng tạo bao gồm `revision-history.json`, với lược đồ riêng `{ version: 1, documents, revisions, recoveries }`. Nó chứa các ID được giữ lại, ảnh chụp trạng thái đầu vào ở dạng chuẩn, dấu phiên bản, bản xem trước dạng ảnh điểm và bản nháp riêng của từng bên ghi. Bộ tiếp hợp lịch sử chụp các phiên hiện tại cùng phiên bản mới nhất của chúng trong một giao dịch đọc, và `sessions.json` dùng cùng các ảnh chụp trạng thái hiện tại cho trình đọc cũ hơn.

Quá trình khôi phục kiểm tra SHA-256 và số byte của dữ liệu, tính duy nhất của định danh, quan hệ giữa tài liệu và phiên bản mới nhất, quan hệ tổ tiên, dấu thời gian, loại bản xem trước và giới hạn trước khi ghi nhận tệp lưu trữ trong một giao dịch. Các tham chiếu đến phiên bản cha đã rút gọn có thể bị thiếu. Công việc hiện tại có sẵn không bao giờ bị thay thế âm thầm: khi một tác phẩm có ở cả hai phía, phía không được giữ làm bản hiện tại sẽ thành bản nháp được bảo vệ.

Tệp lưu trữ có giới hạn truyền 384 MiB. Giới hạn lưu trữ được thực thi mà không cắt bớt các điểm kiểm tra được giữ lại. Khi xuất, `revision-history.json` và `sessions.json` được ghi theo từng khối, với các byte giống như một lần gọi `JSON.stringify`, nên toàn bộ văn bản tệp không bao giờ được giữ cùng lúc. Một tệp lịch sử vượt giới hạn sẽ bị loại ngay khi vượt và từ đó chỉ được đếm dung lượng. Sau đó tệp lưu trữ được tạo lại mà không có các điểm kiểm tra tự động cũ nhất, và bản tóm tắt xuất đếm chúng trong `checkpointsLeftOut`, hoặc tệp lưu trữ bị từ chối.

Lớp vỏ không có khả năng này khôi phục các phiên thông thường và báo phần lịch sử là đã bỏ qua. Lịch sử trên hệ thống tệp gốc vẫn chưa được hỗ trợ cho đến khi bộ tiếp hợp của nó cung cấp giao dịch lịch sử bền vững. Khách trong cộng tác riêng tư không có lịch sử bền vững hay tệp lưu trữ khôi phục.

Đồng bộ ảnh chụp trạng thái cá nhân không bao gồm lịch sử sáng tạo. Áp dụng ảnh chụp trạng thái cho tài liệu cục bộ có lịch sử sẽ giữ trạng thái làm việc trước đó dưới dạng bản nháp khôi phục riêng và vô hiệu hóa token ghi của mọi trình soạn thảo đang mở. Các điểm kiểm tra bất biến của nó vẫn ở trên thiết bị. Điều này bảo vệ lịch sử cục bộ khi thay thế bằng ảnh chụp trạng thái. Nó không hợp nhất các lịch sử đồng thời giữa thiết bị.

Tham chiếu tài nguyên trong lịch sử được giữ lại, còn quá trình kết xuất vẫn phân giải tài nguyên qua thư viện hiện có ở đích. Tệp lưu trữ này chưa bảo đảm giữ chính xác các byte tài nguyên cũ hoặc bản kết xuất trước đây của công cụ. Các byte của phiên bản tài nguyên và kết quả tệp được chuyển theo trong phần sao lưu riêng.
:::

::: details Phiên bản đã lưu và kết quả tệp (v2)
Phần lịch sử tùy chọn chứa `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`, và trình đọc cũng chấp nhận cấu trúc history-v1 trước đó không có lô. Mỗi ảnh chụp trạng thái cung cấp ID tài nguyên ổn định và phiên bản chính xác, thời gian lưu, độ dài byte và SHA-256 dạng thập lục phân, cùng một bản ghi tài nguyên có `_file` và `_credentialFile` tùy chọn trỏ đến các phần nhị phân. Thao tác chứa thông tin về tệp gốc, yêu cầu, báo cáo, dấu thời gian và `_file` kết quả tùy chọn. Tên hệ thống lưu trữ nền, handle OPFS và quyền thực thi có thời hạn không được chuyển theo. Trình đọc chỉ biết lịch sử v1 từ chối phiên bản lịch sử mới trước khi nhập, nên quan hệ thành viên lô không bao giờ bị âm thầm loại bỏ.

Bản kê lô ghi lại mọi nguồn đã chọn trước khi xử lý, bao gồm tệp chưa từng được đọc, thành viên đã hủy, trường hợp không giữ được chỗ cho kết quả và công việc bị gián đoạn. Mỗi thành viên có ID thao tác ổn định, tham chiếu nguồn và thông tin về nguồn, tên đầu ra được yêu cầu và báo cáo cuối cùng. Nguồn chưa đọc có thông tin đã khai báo, không có giá trị băm tự bịa. Quá trình nhập kiểm tra định danh thành viên và tính nhất quán với mọi báo cáo thao tác được chuyển theo. Báo cáo Lolly Batch vẫn sẵn có khi kết quả riêng lẻ đã bị xóa, nhưng biên nhận không có nghĩa là các byte đầu ra vẫn được lưu.

- **Kiểm tra trước.** Mọi bản ghi lịch sử đã biết, báo cáo và tệp được tham chiếu đều được kiểm tra trước khi việc nhập ghi bất kỳ hồ sơ hay tài nguyên nào. Thiếu byte và SHA-256 không khớp đều gây lỗi ngay cả khi cấu trúc bao không có bản đồ kiểm tra tính toàn vẹn. Chứng thực được trích xuất vẫn là mảng byte, kể cả khi nhập từ trình ghi cũ đã tuần tự hóa chúng thành đối tượng có khóa số.
- **Công việc đang chạy.** Thao tác đang chạy trở thành bản ghi bị gián đoạn trong bản sao lưu, với báo cáo lỗi và không có kết quả. Khôi phục không bao giờ khởi động lại công việc nền hay nhập quyền thực thi có thời hạn đang hiệu lực. Thử lại nghĩa là chọn lại tệp gốc, được kiểm tra với SHA-256 đã ghi nếu có.
- **Lưu trữ.** Kết quả được khôi phục ghi nhận các byte và siêu dữ liệu cùng nhau trong IndexedDB. Kết quả mới thông thường dùng OPFS ở nơi có hỗ trợ, với IndexedDB làm phương án dự phòng. Thao tác đang hoạt động có sẵn không bao giờ bị thay thế khi nhập.
- **Giới hạn sao lưu.** Quá trình xuất truyền các byte này theo luồng vào tệp lưu trữ, nhưng khôi phục vẫn giải nén toàn bộ bản sao lưu trong bộ nhớ, nên các giới hạn vẫn là: **256 MiB dữ liệu lịch sử**, **4 MiB siêu dữ liệu lịch sử**, tối đa **100 thao tác**, **100 lô** và **2.000 ảnh chụp trạng thái**. Quá trình xuất từ chối rõ ràng lịch sử quá lớn hoặc không đầy đủ và không bao giờ âm thầm bỏ qua. Tải xuống từng phiên bản và kết quả quan trọng trước khi xóa các bản sao cục bộ cũ hơn. Các giới hạn này không phải là bảo đảm về mức dùng bộ nhớ cao nhất đã đo trên điện thoại.
- **Hạn mức cục bộ.** Lịch sử kết quả cục bộ có hạn mức 512 MiB và tối đa 100 bản ghi. Ảnh chụp trạng thái tài nguyên có hạn mức riêng 512 MiB và tối đa 20 phiên bản lịch sử cho mỗi tài nguyên, và các byte chứng thực được trích xuất được tính vào hạn mức đó. Khôi phục tuân thủ các giới hạn này và không bao giờ âm thầm loại bỏ dữ liệu người dùng hiện có.
- **Siêu dữ liệu lô.** Siêu dữ liệu lô cục bộ có hạn mức riêng 4 MiB, tối đa 100 bản kê và 20 thành viên mỗi lô. Thành viên đang chờ giữ chỗ trong dung lượng siêu dữ liệu, với trần báo cáo 32 KiB cho mỗi thành viên. Đây là hạn mức logic, không phải bảo đảm về dung lượng đĩa của trình duyệt: lỗi hạn ngạch thực tế được hiển thị, và báo cáo trong bộ nhớ vẫn có thể tải xuống. Thử lại một thành viên lô tạo ra lô mới mà không ghi đè báo cáo cũ. Xóa bản ghi lô không xóa các byte kết quả riêng lẻ hay tài nguyên thư viện.
- **Kết quả trong thư viện.** Kết quả chuyển đổi có thể được thêm vào thư viện mà không chuẩn hóa hay mã hóa lại, kèm giá trị băm nguồn, đầu ra và quan hệ với thao tác. Thêm nhiều lần sẽ dùng lại bản sao chưa thay đổi, và bản sao đã chỉnh sửa không bao giờ bị ghi đè. Ảnh điểm có thể bắt đầu tài liệu Lolly Design mới, dùng ID tài nguyên thư viện hiện tại. Việc bắt buộc ghim phiên bản chính xác xuyên suốt môi trường chạy và đường dẫn URL của Lolly Design là công việc riêng. Kết quả SVG, HTML, PDF và ZIP được giữ dưới dạng tài nguyên tệp không được diễn giải, không được nâng thành nội dung tương tác hay vector đáng tin cậy.
- **Nơi mọi người thấy thông tin này.** **Convert → Recent file operations** hiển thị dung lượng lịch sử, báo cáo, bản tải xuống và trình quản lý phiên bản, cũng tìm được các phiên bản trước của tài nguyên thư viện đã xóa. Khôi phục ảnh chụp trạng thái tạo phiên bản hiện tại mới và giữ lại ảnh chụp trạng thái đã chọn. **Settings → Preferences → Storage** đếm kết quả và phiên bản riêng với bộ nhớ đệm có thể xóa.
- **Dọn dẹp.** Thao tác dọn tệp tạm được chủ động thực hiện chỉ xóa các byte thuộc thao tác mà không còn được tham chiếu. Bản ghi hiện tại bảo vệ tệp của chúng, và tệp OPFS gần đây có thời gian ân hạn một giờ. Kết quả đã lưu và ảnh chụp trạng thái tài nguyên không tự động bị xóa.

Trình đọc cũ hơn vẫn chấp nhận cấu trúc bao v2 (`minReader: 1`) và khôi phục các phần chúng biết, tính các phần lịch sử không được hỗ trợ là đã bỏ qua. Khôi phục toàn bộ lịch sử cần một lớp vỏ có bộ tiếp hợp `fileHistory`, một điểm nối bên trong lớp vỏ, không phải khả năng `HostV1` dành cho công cụ. Khôi phục thật trên hai thiết bị được kiểm thử qua bước kiểm tra bắt buộc bằng Chromium cục bộ. Khôi phục trên ứng dụng máy tính, iOS và Android đã cài đặt vẫn cần được nghiệm thu riêng.
:::

<!--i:eti-code-->
## Tham khảo

- Mô-đun: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; hàm đặt tên `backupFilename()` là nội bộ).
- Kiểm thử hợp đồng: `tests/data-transfer.test.ts`, bao quát xuất rồi nhập lại, hợp nhất, tính toàn vẹn, tương thích về sau và chốt kiểm tra trình đọc.
- Kiểm thử hợp đồng lịch sử: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` và `tests/file-result-library.test.ts`. Nghiệm thu trên trình duyệt: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` và `tests/file-result-reuse.browser.test.ts`.
- Giao diện cầu nối được dùng: `host.profile`, `host.state` và `host.assets`; xem [Host API](/info/host-api.html).
