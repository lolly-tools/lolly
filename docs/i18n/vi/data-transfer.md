# Chuyển dữ liệu: gói `lolly-backup`

Lolly giữ thư viện cá nhân của bạn trên thiết bị. Gói sao lưu là cách thư viện đó di chuyển: xuất nó trên một bản cài, mang tệp bằng bất kỳ cách nào bạn thích (USB, AirDrop, email cho chính mình hoặc thư mục mạng) và nhập nó trên bản khác. Xuất và nhập không cần máy chủ, và đích có thể ngoại tuyến.

Trang này là đặc tả định dạng, cho những người dựng shell, công cụ hoặc tập lệnh quanh sao lưu: zip chứa gì, phiên bản được chặn thế nào, một lần nhập gộp ra sao và những gì được kiểm tra. Hướng dẫn cho người chuyển công việc của chính họ là [Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device).

![Hai nút chuyển cả một bản cài: Export my data ghi một zip, Import data đọc lại](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> **Phạm vi.** Một gói mang *dữ liệu người dùng*, không phải công cụ danh mục. Công cụ danh mục và tài nguyên danh mục được đồng bộ riêng và được giả định đã có trên đích, tệ nhất là ở phiên bản cao hơn. Công cụ người dùng tự làm đi bên trong `profile.json`. Nhập không bao giờ cài hay nâng cấp một công cụ danh mục.

## Mục tiêu

- <!--i:box--> **Một định dạng, mọi shell.** Ứng dụng web, ứng dụng máy tính và di động cùng các shell tương lai dùng chung phong bì và schema của các phần. Các phần tùy chọn phụ thuộc vào khả năng của từng shell, và phần không được hỗ trợ được báo cáo. Mỗi cầu khả năng cung cấp bộ điều hợp lưu trữ của nó.
- <!--i:shieldcheck--> **Sống sót qua chuyến đi.** Một gói bị hỏng hoặc cắt cụt khi truyền sẽ thất bại rõ ràng khi nhập và không bao giờ khôi phục dở dang.
- <!--i:clock--> **Sống lâu hơn phiên bản này.** Một ứng dụng cũ hơn vẫn nhập được các phần của gói mới hơn mà nó nhận ra. Một định dạng thật sự phá vỡ bị từ chối gọn gàng.
- <!--i:check--> **An toàn để gộp.** Nhập vào một bản cài đã dùng không bao giờ xóa thứ gì không có trong gói.

## Phong bì

Một gói là `.zip` thuần, nên nó sống sót qua mọi đường truyền nguyên vẹn và bất kỳ công cụ giải nén nào cũng kiểm tra được nội dung.

Bản tải xuống được đặt tên theo người sở hữu nó: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, ví dụ `LollyTools-Ada-Lovelace-2026-06-26-1.zip`, để thư mục Downloads chứa các bản sao lưu vẫn đọc được. Họ và tên lấy từ hồ sơ và bị bỏ khi chưa đặt: không hồ sơ cho `LollyTools-2026-06-26-1.zip`, và chỉ có tên cho `LollyTools-Ada-2026-06-26-1.zip`. Mỗi tên được rút gọn thành token an toàn cho tên tệp (giữ chữ cái và chữ số Unicode, bỏ dấu cách và dấu câu, tối đa 32 ký tự). `<n>` là số thứ tự theo ngày, theo thiết bị, nên các lần xuất lặp lại trong một ngày không đụng nhau và giữ đúng thứ tự. `backupFilename()` trong `data-transfer.ts` dựng tên, và nội dung zip giống nhau bất kể tên.

| Đường dẫn | Bắt buộc | Nội dung |
|---|---|---|
| `manifest.json` | có | Id định dạng, phiên bản, số đếm và tính toàn vẹn từng phần. Thứ đầu tiên trình đọc nhìn vào. |
| `profile.json` | khi đã đặt | Toàn bộ bản ghi `me` của người dùng: tên, liên hệ, tham chiếu ảnh chân dung và cờ, cùng thư mục, Trash, bản thiết kế dự án, mẫu của người dùng và công cụ do người dùng làm, mục yêu thích, công cụ ẩn, ngôn ngữ và lựa chọn emoji. Đọc qua `host.profile`. |
| `sessions.json` | có | Mọi phiên đã lưu: ô, id và phiên bản công cụ, nhãn, hình thu nhỏ (data URL) và dữ liệu đầu vào đầy đủ. Đọc qua `host.state`. |
| `assets.json` | có | Siêu dữ liệu cho từng tài nguyên đã tải lên (ảnh, phông chữ, token thương hiệu, logo, bản sao đã lưu của các bản tải xuống), mỗi cái trỏ tới byte của nó dưới `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | mỗi tài nguyên | Các byte tài nguyên thô, lưu không nén vì hầu hết đã là định dạng nén. Phần mở rộng chỉ mang tính hình thức; kiểu MIME trong `assets.json` là chuẩn. |
| `assets/blobs/<n>.c2pa` | khi có | Content Credentials đã trích xuất dưới dạng byte nhị phân chính xác, được tham chiếu bởi `_credentialFile` trong bản ghi tài nguyên. Đây không phải khóa ký của thiết bị. |
| `design-systems.json` | khi có | Các hệ thống thiết kế được tạo hoặc thêm trên bản cài này, dưới dạng `{ active, records }`. Xem [Import rules](#import-rules). |
| `file-history.json` | tùy chọn | Ảnh chụp tài nguyên có phiên bản, báo cáo thao tác tệp đã hoàn tất và manifest batch đầy đủ, có phiên bản riêng. Do bộ điều hợp sao lưu `fileHistory` nội bộ của shell cung cấp. |
| `revision-history.json` | tùy chọn, sao lưu thủ công | ID sáng tạo ổn định, điểm kiểm tra được giữ, hình thu nhỏ và bản nháp khôi phục luân phiên. Do `host.state.history.backup` cung cấp nơi được hỗ trợ. |
| `file-history/versions/` | mỗi ảnh chụp | Byte tài nguyên trước đó và credential đã trích xuất, dù tài nguyên hiện tại còn tồn tại hay không. |
| `file-history/results/` | mỗi thao tác hoàn tất | Byte đầu ra chính xác. Không tệp gốc nào được chọn để chuyển đổi được giữ hay đưa vào. |
| `prefs.json` | có | Tùy chọn cục bộ do người dùng sở hữu: `theme`, `sidebarWidth` và bộ đếm hoạt động `ct-metrics`. |
| `lolly.txt` | có | Bản tóm tắt đọc được của gói (số đếm, hồ sơ, tên tệp) cho bất kỳ ai mở zip mà không có Lolly. Được tạo lại mỗi lần xuất và được nhận ra khi nhập, nên không bao giờ tính là phần bị bỏ qua. Nó được ghi sau bản đồ toàn vẹn, nên bản đồ không bao gồm tệp này. |

::: details Cách xuất ghi zip
Xuất ghi zip từng phần một (`shells/web/src/lib/zip-stream.ts`). Tệp tải lên, kết quả đã lưu và phiên bản tài nguyên đã lưu được đọc theo lát 4 MiB, không bao giờ nguyên khối, và kết quả cùng phiên bản đã lưu trước hết được kiểm tra với SHA-256 đã ghi. Mỗi tệp sau đó được đọc để lấy checksum và giá trị băm toàn vẹn, và zip tham chiếu tới nó ở nơi nó đang có.

Không gì được mã hóa lại, nên tệp mang Content Credentials giữ đúng các byte mà chữ ký của nó bao phủ, và mỗi phần giữ byte và giá trị băm chính xác. Với cùng các phần và thời gian, zip giống hệt với bộ ghi trong bộ nhớ trước đây, trừ việc tệp lịch sử trên 16 MiB được nén theo từng mảnh. `tests/backup-streaming.test.ts` kiểm tra điều này với các giá trị băm tham chiếu đã ghi.

Trên một thư viện tổng hợp 192 MiB, đo trong Node, hoàn tất sao lưu tốn khoảng 125 đến 150 MiB ngoài thư viện, so với khoảng 850 MiB của bộ ghi trong bộ nhớ (`node scripts/bench-backup-finalise.ts`). Nhập vẫn đọc cả zip vào bộ nhớ.
:::

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
| `format` | Luôn là `lolly-backup`. Tệp thiếu nó bị từ chối là "not a Lolly backup". |
| `formatVersion` | Bố cục mà gói này được **ghi** theo. Tăng khi có bất kỳ thay đổi nào về tập hợp phần hoặc hình dạng. Trình đọc **không** chặn theo trường này. |
| `minReader` | Phiên bản trình đọc tối thiểu có thể nhập gói này **một cách an toàn**. Đây là trường mà trình đọc chặn theo. |
| `app` | Id ứng dụng tạo ra, để chẩn đoán. |
| `exportedAt` | Dấu thời gian ISO khi gói được tạo. |
| `counts` | Những gì bên ghi đã đưa vào, để hiển thị và kiểm tra nhanh. |
| `integrity` | Tùy chọn. Ánh xạ mọi phần trừ `manifest.json` tới giá trị băm kiểu SRI `sha256-<base64>` của byte **chưa nén** của nó. |

## Chính sách phiên bản

Hai số phiên bản cho phép định dạng lớn lên mà không bỏ rơi các bản cài cũ hơn.

![Thay đổi định dạng gói hoặc là bổ sung, mà trình đọc cũ có thể bỏ qua, hoặc là phá vỡ, nơi nhập sai làm hỏng dữ liệu. Bổ sung tăng formatVersion và giữ minReader; phá vỡ tăng formatVersion và nâng minReader. Một trình đọc nhập khi minReader không lớn hơn phiên bản của chính nó.](/info/diagrams/concepts/backup-version-gate.svg)

- Một trình đọc nhập gói khi `manifest.minReader` không lớn hơn phiên bản trình đọc của chính nó. Nó từ chối, với "needs a newer version of the app", chỉ khi gói đòi trình đọc mới hơn.
- Một thay đổi **bổ sung**, như phần tùy chọn mới hoặc trường manifest tùy chọn mới, tăng `formatVersion` và để `minReader` yên. Ứng dụng cũ vẫn nhập mọi phần chúng nhận ra, và phần chúng không nhận ra được báo cáo là bị bỏ qua, không bị bỏ lặng lẽ.
- Một thay đổi **phá vỡ**, nơi nhập sai một phần làm hỏng dữ liệu hoặc một phần tùy chọn trở nên bắt buộc, nâng `minReader`. Ứng dụng cũ khi đó từ chối gọn gàng thay vì nhập thứ chúng không xử lý được.
- Nếu một gói tương lai đặt `formatVersion` nhưng bỏ `minReader`, trình đọc quay về chặn theo `formatVersion` và coi thay đổi là phá vỡ.

> **Quy tắc ngón tay cái cho tác giả:** nếu mọi trình đọc hiện có vẫn làm đúng khi bỏ qua phần bổ sung của bạn, thay đổi là bổ sung: tăng `formatVersion` và để `minReader`. Nếu không, hãy nâng `minReader`.

## Tính toàn vẹn

Khi `manifest.integrity` có mặt, trình đọc kiểm tra SHA-256 của từng phần được liệt kê **trước khi ghi bất cứ gì**. Sai lệch ("failed its integrity check") hoặc thiếu một phần ("incomplete") dừng cả lần nhập, nên không có khôi phục từng phần. Điều này bắt được hư hại mà đường truyền tệp có thể gây ra: AirDrop bị cắt, cổng email mã hóa lại tệp đính kèm, một sector USB hỏng.

Tính toàn vẹn là nỗ lực tối đa. Nó chỉ được ghi nơi Web Crypto có sẵn (mọi ngữ cảnh trình duyệt an toàn và Node hiện đại), và chỉ được kiểm tra khi cả bản đồ lẫn Web Crypto cùng có mặt. Một gói không có bản đồ, như gói từ trước khi có tính toàn vẹn, nhập nguyên trạng: "cannot verify" không bao giờ được tính là "corrupt".

Manifest không liệt kê chính nó cũng không liệt kê `lolly.txt` được tạo lại. Các giá trị băm bao gồm những phần mà manifest bảo chứng.

## Quy tắc nhập

Một lần nhập chạy ở một trong hai chế độ.

- **Merge** là việc **Import data…** làm, và việc lần tham gia đầu tiên của sync, **Bring it to this device**, làm. Dữ liệu trên đích ở lại, và không gì không có trong gói bị chạm tới: một phiên mà đích có còn gói không có sống sót qua lần nhập.
- **Replace** là cách đồng bộ thiết bị giữ các thiết bị đồng bộ: nó lấy bản ghi hồ sơ, tùy chọn, các phiên, ảnh và lựa chọn hệ thống thiết kế đang dùng của bản sao đã đồng bộ, và chỉ gỡ các mục mà thiết bị khác đã xóa kể từ lần đồng bộ cuối. Khôi phục một bản sao trước đó đi xa hơn và làm thiết bị khớp với bản sao đó, gỡ mọi thứ bản sao không có, sau khi lưu thiết bị trước. [Sync your devices](/info/sync.html) đề cập những gì một người thấy.

Trong một lần gộp, mọi thứ chỉ có trên đích được giữ, và mỗi loại dữ liệu trong gói gặp đích như sau:

| Dữ liệu | Đã có trên đích | Chỉ có trong gói |
|---|---|---|
| Phiên (theo ô) và ảnh đã tải lên (theo id) | Bản lưu gần hơn được giữ, nên bản sao lưu cũ hơn không bao giờ ghi đè công việc mới hơn. Thời gian bằng nhau hoặc không rõ giữ bản của đích. | Được thêm |
| Thư mục | Tên và thư mục cha của đích được giữ, và thư mục nhận các thành viên của gói mà nó thiếu. Một phiên được xếp vào thư mục trên đích vẫn ở đó. | Được thêm |
| Mục yêu thích (công cụ, tài nguyên danh mục và mục Projects) | Được kết hợp | Được thêm |
| Mẫu, mẫu Projects và công cụ người dùng (theo id) | Bản ghi của đích được giữ. | Được thêm |
| Mục Trash | Mục của đích được giữ. | Được thêm, để một mục khôi phục được trên bản cài nào cũng vẫn khôi phục được. Một mục có thư mục đã được dùng lại trên đích, hoặc có ô Trash mà đích đã dùng, bị bỏ. |
| Các trường hồ sơ khác (tên, thông tin liên hệ, ngôn ngữ, feature flag, công cụ ẩn và cài đặt khác) | Giá trị của đích được giữ. | Được lấy nơi trường của đích trống |
| Tùy chọn (`prefs.json`) | Giá trị của đích được giữ. | Được ghi nơi đích chưa có |
| Hệ thống thiết kế (theo id) | Bản ghi của gói thay thế bản của đích. | Được thêm. Lựa chọn đang dùng của gói chỉ áp dụng khi đích không có hệ thống thiết kế nào của riêng nó. |
| Lịch sử sáng tạo | Bản lưu gần hơn vẫn là bản hiện tại, và bản kia được giữ làm bản nháp được bảo vệ. | Được thêm |

**Các phiên đã lưu tự liên kết lại với ảnh của chúng.** Tham chiếu tài nguyên được giữ theo id, và cầu phân giải lại chúng sau khi ảnh được khôi phục, việc nó vốn phải làm vì URL `blob:` không sống sót qua việc tải lại.

**Bản ghi lịch sử không bao giờ đổi sau khi được ghi.** Nhập lặp lại phiên bản tài nguyên và ID thao tác không thêm gì, và một ID đã đặt tên cho byte hoặc lịch sử khác bị từ chối, không bị ghi đè. Nhập lại một tài nguyên hiện tại giống hệt giữ phiên bản của nó, và một tài nguyên hiện tại đã đổi phải mang phiên bản khác.

**Lịch sử sáng tạo có thêm vài quy tắc.** Một sản phẩm có ô mà đích dùng cho sản phẩm khác được thêm như một sản phẩm riêng, và một sản phẩm trong Trash của đích ở lại đó. Một id điểm kiểm tra đặt tên cho nội dung khác trên đích giữ cái của đích. Một kho lưu trữ không qua được kiểm tra của chính nó dừng việc nhập trước khi bất kỳ hồ sơ, phiên, tài nguyên hay tùy chọn nào thay đổi, và một lần nhập lặp lại giống hệt không thêm dung lượng nào.

**Bản tóm tắt báo cáo điều đã xảy ra.** Mỗi lần nhập trả về `profile`, `sessions`, `userAssets`, `prefs`, `skipped` và `failedAssets`.

- `failedAssets` đếm các tài nguyên tải lên không khôi phục được, ví dụ do bộ nhớ thiết bị đầy.
- `skipped` đếm các phần từ bên ghi mới hơn mà bản dựng này không nhận ra. Ứng dụng hiện nó ("… · N newer items skipped"), nên một lần khôi phục nói rõ nó bỏ lại gì.
- Với lịch sử tệp, bản tóm tắt thêm `assetVersions`, `fileOperations`, `fileBatches` và `failedHistory`. Cạn bộ nhớ hoặc xung đột ID bất biến có thể gây khôi phục một phần, và ứng dụng khi đó bảo người dùng giữ bản sao lưu gốc.
- Với lịch sử sáng tạo, nó thêm `revisions` và `recoveryDrafts`, chỉ đếm những gì lần nhập này thêm, và `added`, `kept`, `replaced`, `copies` và `hidden` cho cách mỗi sản phẩm được gộp. `skippedCheckpoints` đếm các điểm kiểm tra có id đặt tên cho nội dung khác trên đích, và `historyLeftOut` đếm các điểm kiểm tra và bản nháp cũ hơn không vừa chỗ lịch sử của thiết bị.
- Một lần nhập replace thêm `removed` và `failedRemovals`.

Khôi phục không phải một giao dịch duy nhất qua các kho hồ sơ, phiên, tài nguyên và lịch sử. Đồng bộ đám mây **không** đẩy bản sửa đổi đã áp dụng của nó lên sau một lần khôi phục một phần hoặc không được hỗ trợ, nên bản sao vẫn sẵn để thử lại.

## Những gì không được mang theo

- **Bộ nhớ đệm danh mục** (siêu dữ liệu và blob tài nguyên đã tải, chỉ mục công cụ), mà đích tự đồng bộ lại miễn phí.
- **Công cụ danh mục và tài nguyên danh mục**, nằm ngoài phạm vi và được giả định đã có trên đích. Token thương hiệu, phông chữ và logo mà người dùng thêm là tài nguyên người dùng, nên chúng đi cùng.
- **URL `blob:` và URL đối tượng**, mà cầu tạo lại khi nạp.
- **Bản gốc chuyển đổi, lease thực thi đang chạy và bí mật truy cập hoặc ký cục bộ của máy.** Đây không phải lịch sử khả chuyển. Một kết quả đã lưu là một bản sao, không phải lời hứa rằng nguồn gốc đã được sao lưu.
- **Bộ đếm thứ tự xuất**, bộ đếm đặt tên tải xuống theo ngày trong `localStorage` (`lolly-export-seq`). Nó được giữ ngoài `PREF_KEYS`, nên không bao giờ đi trong gói.

Đồng hồ lưu trữ hiện cùng sự phân chia. Saved sessions, My images và File results & versions đi vào gói. Bộ nhớ đệm tài nguyên, bản xem trước công cụ và các ghim ngoại tuyến bên dưới đều dựng lại được, nên chúng ở lại.

![Đồng hồ lưu trữ chia dữ liệu của thiết bị này thành các loại có tên, với Saved sessions và My images được theo dõi riêng khỏi Asset cache, ở đây trên bản cài mới nơi mọi loại còn trống](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

## Dữ liệu tổ chức với Lolly Work

Gói này sao lưu thư viện cá nhân của thiết bị. Nó không phải bản sao lưu của một phiên bản **Lolly Work**: tài khoản tổ chức, chính sách truy cập, dự án chung, phiên bản danh mục, phê duyệt, tác vụ kết xuất và bản ghi kiểm toán do dịch vụ đó giữ. Hãy kết nối lại và đăng nhập để lấy lại quyền truy cập công việc chung; nhập một gói cá nhân không cấp quyền đó.

Đơn vị vận hành sao lưu, lưu giữ và xóa dữ liệu máy chủ bằng các hướng dẫn riêng của Lolly Work: [Backup and restore](/info/work-operations.html#backup-and-restore) và [Work storage and data lifecycle](/info/work-data-lifecycle.html). Xóa hoặc xuất một thiết bị không thực hiện thao tác máy chủ nào trong số đó.

## Qua các shell

`data-transfer.ts` chỉ đọc và ghi qua cầu khả năng (`host.profile`, `host.state`, `host.assets`) và tùy chọn `localStorage` dùng chung. Cùng module đọc và ghi phong bì chung trên web và trong ứng dụng máy tính và di động, trên bộ nhớ IndexedDB hoặc hệ thống tệp. Các phần lịch sử tùy chọn chỉ xuất hiện nơi bộ điều hợp của chúng có sẵn, và phần không được hỗ trợ được báo cáo là bị bỏ qua khi nhập. Bộ kiểm thử không giao diện thực hiện các phần chung trên một cầu trong bộ nhớ, và các giao dịch lịch sử cũng có kiểm thử trên trình duyệt thật.

Hai shell nằm ngoài đảm bảo đó, vì những lý do khác nhau:

- **CLI một lần** không có gì để mang: trạng thái của nó nằm trong bộ nhớ và kéo dài một lần gọi.
- **TUI** giữ trạng thái trong `~/.lolly` (phiên, thư mục, hồ sơ), và màn hình Profile của nó có thể sao lưu, nhưng nó ghi một kho lưu trữ đơn giản hơn của riêng nó: `saved-state/<slot>.json` cho mỗi phiên cộng `profile.json` và `folders.json`, không có manifest, không `formatVersion` hay `minReader` và không có bản đồ toàn vẹn. Định dạng này không nhập được nó (trình đọc từ chối là "not a Lolly backup"), và tên của nó dễ nhầm (`lolly-backup-<stamp>.zip`). Hợp nhất hai thứ là một khoảng trống đã biết.

## Chưa khả chuyển

Phong bì là một manifest cộng các phần có tên, nên các loại dữ liệu khả chuyển mới có thể gia nhập sau dưới dạng phần bổ sung (một `formatVersion` mới, cùng `minReader`), và trình đọc hiện nay bỏ qua những gì chúng không nhận ra. Hệ thống thiết kế đã đi theo cách này, dưới dạng `design-systems.json` cộng tài nguyên người dùng của chúng.

Hai tên được dành riêng cho dữ liệu chưa đi được:

- **`tokens.json`** sẽ mang cả một tài liệu design token [W3C DTCG](https://tr.designtokens.org/format/) với nhóm, bộ và chủ đề của nó, định dạng mà [Penpot nhập và xuất](https://help.penpot.app/user-guide/design-systems/design-tokens/). Token thương hiệu riêng của người dùng đã đi dưới dạng tài nguyên `user/tokens/brand` trong `assets.json`, và token của hệ thống thiết kế đi cùng bản ghi của nó.
- **`penpot/`** được dành cho một tệp Penpot đã nạp, hoặc tập con liên quan Lolly của nó, đưa lên thành một công cụ.

Trình đọc hiện nay chưa biết tên nào. Như mọi thứ khác ngoài các phần trên, mỗi tên là một phần không rõ với chúng: để nguyên và đếm trong `skipped`.

## Phần lịch sử

Hai phần lịch sử là tùy chọn và có phiên bản riêng. Hầu hết trình đọc có thể bỏ qua mục này.

::: details Lịch sử sáng tạo (v3)
Các bản sao lưu thủ công từ một bản cài web có lịch sử sáng tạo gồm `revision-history.json`, với schema `{ version: 1, documents, revisions, recoveries }` riêng. Nó mang các ID được giữ, ảnh chụp đầu vào chuẩn, dấu phiên bản, bản xem trước ảnh điểm và bản nháp riêng của bên ghi. Bộ điều hợp lịch sử chụp các phiên hiện tại và đầu của chúng trong một giao dịch đọc, và `sessions.json` dùng cùng các ảnh chụp hiện tại cho trình đọc cũ hơn.

Khôi phục kiểm tra SHA-256 của payload và số byte, định danh duy nhất, quan hệ tài liệu và đầu, tổ tiên, dấu thời gian, loại bản xem trước và giới hạn trước khi xác nhận kho lưu trữ trong một giao dịch. Tham chiếu cha đã nén có thể thiếu. Công việc hiện tại đang có không bao giờ bị thay thế lặng lẽ: khi một sản phẩm có ở cả hai phía, phía không được giữ làm hiện tại trở thành bản nháp được bảo vệ.

Giới hạn truyền 384 MiB của kho lưu trữ được kiểm tra tường minh, và giới hạn lưu trữ được thực thi mà không cắt các điểm kiểm tra được giữ. Xuất ghi `revision-history.json` và `sessions.json` theo từng khối, với cùng byte như một `JSON.stringify` đơn cho ra, nên văn bản tệp không bao giờ được giữ nguyên khối. Một tệp lịch sử sẽ vượt giới hạn bị bỏ ngay lúc nó vượt và chỉ được đếm từ đó. Kho lưu trữ sau đó được tạo lại mà không có các điểm kiểm tra tự động cũ nhất, và bản tóm tắt xuất đếm chúng là `checkpointsLeftOut`, hoặc kho bị từ chối hoàn toàn.

Một shell không có khả năng này khôi phục các phiên thông thường và báo cáo phần lịch sử là bị bỏ qua. Lịch sử hệ thống tệp gốc vẫn không được hỗ trợ cho đến khi bộ điều hợp của nó cung cấp giao dịch lịch sử bền vững. Khách trong một collab riêng tư không có lịch sử bền vững hay kho khôi phục.

Đồng bộ ảnh chụp cá nhân bỏ lịch sử sáng tạo. Áp dụng một ảnh chụp lên tài liệu cục bộ có lịch sử giữ trạng thái làm việc trước đó của nó làm bản nháp khôi phục riêng và làm vô hiệu mã ghi của mọi trình soạn thảo đang mở. Các điểm kiểm tra bất biến của nó ở lại trên thiết bị. Điều này bảo vệ lịch sử cục bộ trong lúc thay thế ảnh chụp; nó không gộp lịch sử đồng thời của các thiết bị.

Tham chiếu tài nguyên lịch sử được giữ, trong khi kết xuất vẫn phân giải tài nguyên qua thư viện hiện có của đích. Kho lưu trữ này chưa đảm bảo byte tài nguyên cũ chính xác hay bản kết xuất công cụ cũ. Byte phiên bản tài nguyên và kết quả tệp đi trong phần sao lưu riêng của chúng.
:::

::: details Phiên bản đã lưu và kết quả tệp (v2)
Phần lịch sử tùy chọn chứa `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`, và trình đọc cũng chấp nhận dạng history-v1 trước đó không có batch. Mỗi ảnh chụp cho ID tài nguyên ổn định và phiên bản chính xác, thời điểm lưu, độ dài byte và SHA-256 hex, cộng một bản ghi tài nguyên mà `_file` và `_credentialFile` tùy chọn trỏ tới các phần nhị phân. Thao tác mang dữ kiện tệp gốc, yêu cầu, báo cáo, dấu thời gian và `_file` kết quả tùy chọn. Tên backend lưu trữ, handle OPFS và lease thực thi không đi cùng. Trình đọc chỉ biết history v1 từ chối phiên bản lịch sử mới trước khi nhập, thay vì lặng lẽ bỏ tư cách thành viên batch.

Manifest batch ghi mọi nguồn được chọn trước khi xử lý, kể cả tệp chưa từng đọc, thành viên bị hủy, lỗi dành chỗ cho kết quả và công việc bị gián đoạn. Mỗi thành viên có ID thao tác ổn định, tham chiếu nguồn và dữ kiện, tên đầu ra được yêu cầu và báo cáo cuối. Nguồn chưa đọc có dữ kiện khai báo, không có giá trị băm bịa ra. Nhập xác thực danh tính thành viên và tính nhất quán với mọi báo cáo thao tác đi kèm. Báo cáo batch vẫn có khi từng kết quả đã bị gỡ, nhưng biên nhận không có nghĩa byte đầu ra của nó vẫn được lưu.

- **Xác thực trước.** Mọi bản ghi lịch sử, báo cáo và tệp tham chiếu đã biết được xác thực trước khi bất kỳ lần nhập hồ sơ hay tài nguyên nào ghi. Byte thiếu và SHA-256 không khớp đều thất bại ngay cả khi phong bì không có bản đồ toàn vẹn. Credential đã trích xuất vẫn là mảng byte, kể cả khi nhập từ bên ghi cũ hơn đã tuần tự hóa chúng thành đối tượng khóa số.
- **Công việc đang chạy.** Thao tác đang chạy trở thành bản ghi bị gián đoạn trong bản sao lưu, với báo cáo lỗi giải thích và không có kết quả. Khôi phục không bao giờ khởi động lại công việc nền hay nhập lease đang hoạt động. Thử lại nghĩa là chọn lại tệp gốc, được kiểm tra với SHA-256 đã ghi khi có.
- **Lưu trữ.** Kết quả được khôi phục xác nhận byte và siêu dữ liệu của chúng cùng nhau trong IndexedDB. Kết quả mới thông thường dùng OPFS nơi có, với IndexedDB dự phòng. Một thao tác đang chạy hiện có không bao giờ bị lần nhập thay thế.
- **Giới hạn sao lưu.** Xuất đưa các byte này vào kho lưu trữ theo luồng, nhưng khôi phục vẫn giải nén cả bản sao lưu trong bộ nhớ, nên các giới hạn vẫn còn: **256 MiB payload lịch sử**, **4 MiB siêu dữ liệu lịch sử**, tối đa **100 thao tác**, **100 batch** và **2.000 ảnh chụp**. Xuất từ chối tường minh lịch sử quá khổ hoặc không đầy đủ và không bao giờ lặng lẽ bỏ nó. Hãy tải từng phiên bản và kết quả quan trọng trước khi gỡ các bản sao cục bộ cũ hơn. Các giới hạn này không phải đảm bảo mức bộ nhớ đỉnh đã đo cho điện thoại.
- **Ngân sách cục bộ.** Lịch sử kết quả cục bộ có ngân sách 512 MiB và trần 100 bản ghi. Ảnh chụp tài nguyên có ngân sách 512 MiB riêng và tối đa 20 phiên bản lịch sử mỗi tài nguyên, và byte credential đã trích xuất tính vào ngân sách đó. Khôi phục tuân theo các giới hạn này và không bao giờ lặng lẽ đẩy dữ liệu người dùng hiện có ra.
- **Siêu dữ liệu batch.** Siêu dữ liệu batch cục bộ có ngân sách 4 MiB riêng, tối đa 100 manifest và 20 thành viên mỗi batch. Thành viên đang chờ dành chỗ siêu dữ liệu, với trần báo cáo 32 KiB mỗi thành viên. Đây là ngân sách logic, không phải đảm bảo dung lượng đĩa của trình duyệt: lỗi hạn ngạch thật được hiển thị, và báo cáo trong bộ nhớ vẫn tải xuống được. Thử lại một thành viên batch tạo một batch mới mà không ghi đè báo cáo cũ. Gỡ một bản ghi batch không gỡ byte kết quả riêng lẻ hay tài nguyên thư viện.
- **Kết quả trong thư viện.** Kết quả đã chuyển đổi có thể được thêm vào thư viện mà không chuẩn hóa hay mã hóa lại, kèm giá trị băm nguồn và đầu ra và quan hệ thao tác. Thêm lặp lại dùng lại bản không đổi, và bản đã chỉnh sửa không bao giờ bị ghi đè. Ảnh điểm có thể bắt đầu một tài liệu Design mới, dùng ID tài nguyên thư viện hiện tại; việc thực thi ghim phiên bản chính xác khắp runtime của Design và đường URL là công việc riêng. Kết quả SVG, HTML, PDF và ZIP được giữ làm tài nguyên tệp mờ, không được nâng thành nội dung tương tác hay vector đáng tin cậy.
- **Nơi mọi người thấy điều này.** **Convert → Recent file operations** hiện mức dùng lịch sử, báo cáo, bản tải xuống và trình quản lý phiên bản, cũng tìm các phiên bản trước của tài nguyên thư viện đã xóa. Khôi phục một ảnh chụp tạo phiên bản hiện tại mới và giữ ảnh chụp đã chọn. **Settings → Preferences → Storage** đếm kết quả và phiên bản riêng khỏi bộ nhớ đệm dùng một lần.
- **Dọn dẹp.** Dọn tệp tạm tường minh chỉ gỡ byte thuộc thao tác và không được tham chiếu. Bản ghi hiện tại bảo vệ tệp của chúng, và tệp OPFS gần đây có thời gian ân hạn một giờ. Kết quả đã lưu và ảnh chụp tài nguyên không bị xóa tự động.

Trình đọc cũ hơn vẫn chấp nhận phong bì v2 (`minReader: 1`) và khôi phục những phần chúng biết, đếm các phần lịch sử không được hỗ trợ là bị bỏ qua. Khôi phục lịch sử đầy đủ cần shell có bộ điều hợp `fileHistory`, một đường nối bên trong shell thay vì một khả năng `HostV1` hướng công cụ mới. Khôi phục hai thiết bị thật được bao phủ bởi cổng Chromium cục bộ; khôi phục trên ứng dụng máy tính, iOS và Android đã cài vẫn cần được chấp nhận riêng.
:::

## Tham khảo

- Module: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; hàm đặt tên `backupFilename()` là nội bộ).
- Kiểm thử hợp đồng: `tests/data-transfer.test.ts`, bao gồm khứ hồi, gộp, toàn vẹn, tương thích về sau và chốt chặn trình đọc.
- Kiểm thử hợp đồng lịch sử: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` và `tests/file-result-library.test.ts`. Nghiệm thu trên trình duyệt: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` và `tests/file-result-reuse.browser.test.ts`.
- Bề mặt cầu được dùng: `host.profile`, `host.state` và `host.assets`; xem [Host API](/info/host-api.html).
