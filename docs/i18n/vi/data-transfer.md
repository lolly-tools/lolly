# Chuyển dữ liệu - gói `lolly-backup`

Mọi thứ mà một người dùng Lolly tích lũy đều nằm **trên thiết bị của họ** - không tài khoản, không đám mây. Gói chuyển dữ liệu là cách giá trị đó di chuyển: xuất nó trên một bản cài đặt, mang file đi bằng bất kỳ phương tiện nào (USB, AirDrop, gửi email cho chính mình, chia sẻ mạng) rồi nhập nó vào một bản cài đặt khác. File *chính là* phương tiện vận chuyển. Đích đến có thể offline hoặc online. Điều đó không quan trọng, vì không có gì từng liên lạc với máy chủ.

![Hai nút di chuyển toàn bộ bản cài đặt: Export my data ghi ra một tệp zip, Import data đọc lại tệp đó](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=%23storage-section%20.storage-subsection&dark=1&filename=pd-transfer-controls)

Trang này là đặc tả định dạng. Để xem hướng dẫn dành cho người dùng cuối, xem [Tìm và khôi phục công việc của bạn → Chuyển công việc của bạn sang thiết bị khác](/info/find-your-work.html#move-your-work-to-another-device). Việc triển khai nằm ở [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), và [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) chốt hợp đồng khứ hồi.

> **Phạm vi.** Một gói mang *dữ liệu người dùng*, không phải công cụ danh mục. Công cụ danh mục và tài sản danh mục được đồng bộ riêng và được giả định là đã có sẵn trên máy đích (trường hợp xấu nhất là ở phiên bản cao hơn); các công cụ người dùng tự tạo di chuyển bên trong `profile.json`. Việc nhập không bao giờ cài đặt hay nâng cấp một công cụ danh mục.

## Mục tiêu

- <!--i:box--> **Một định dạng, mọi shell.** Web PWA, các ứng dụng desktop/mobile Tauri và các shell tương lai đều dùng chung một envelope và các schema phần được hỗ trợ. Các phần tùy chọn phụ thuộc vào năng lực của từng shell; các phần không được hỗ trợ sẽ được báo cáo. Mỗi cầu nối năng lực (capability bridge) cung cấp bộ chuyển đổi lưu trữ riêng của nó.
- <!--i:shieldcheck--> **Sống sót qua chuyến đi.** Một gói bị hỏng hoặc bị cắt xén trong quá trình truyền sẽ báo lỗi rõ ràng khi nhập, không bao giờ khôi phục nửa vời.
- <!--i:clock--> **Tồn tại lâu hơn phiên bản này.** Một ứng dụng cũ hơn vẫn có thể nhập các phần mà nó nhận ra trong một gói mới hơn. Một định dạng thực sự phá vỡ tương thích sẽ bị từ chối một cách sạch sẽ.
- <!--i:check--> **An toàn khi hợp nhất.** Việc nhập vào một bản cài đặt đang được sử dụng không bao giờ xóa bất cứ thứ gì không có trong gói.

## Phong bì

Một gói chỉ là một `.zip` thông thường. File tải xuống được đặt tên theo người sở hữu nó - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (ví dụ `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - để một thư mục Downloads chứa các bản sao lưu vẫn dễ đọc. Phần tên và họ lấy từ hồ sơ và bị bỏ qua khi chưa thiết lập. Không có hồ sơ sẽ cho `LollyTools-2026-06-26-1.zip`, và chỉ có tên riêng sẽ cho `LollyTools-Ada-2026-06-26-1.zip`. Mỗi phần được làm sạch thành một token an toàn cho tên file (giữ lại chữ cái/chữ số Unicode, loại bỏ khoảng trắng/dấu câu, giới hạn 32 ký tự). `<n>` là một chuỗi số theo từng ngày, từng thiết bị, để các lần xuất lặp lại trong cùng một ngày không trùng nhau và vẫn theo thứ tự. `backupFilename()` trong [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) xây dựng tên này. Nội dung của zip giống hệt nhau bất kể tên gọi. Bên trong:

| Đường dẫn | Bắt buộc | Nội dung |
|---|---|---|
| `manifest.json` | có | Id định dạng, các phiên bản, số lượng và tính toàn vẹn theo từng phần. Điều đầu tiên trình đọc xem xét. |
| `profile.json` | khi đã thiết lập | Toàn bộ bản ghi `me` của người dùng: tên, liên hệ, tham chiếu ảnh đại diện và cờ, cùng các thư mục, Thùng rác, bản thiết kế dự án, mẫu người dùng và các công cụ do người dùng tạo, mục yêu thích, công cụ đã ẩn, ngôn ngữ và lựa chọn emoji. Đọc qua `host.profile`. |
| `sessions.json` | có | Mọi phiên đã lưu: slot, id/phiên bản công cụ, nhãn, ảnh thu nhỏ (data-URL) và toàn bộ dữ liệu đầu vào. Đọc qua `host.state`. |
| `assets.json` | có | Siêu dữ liệu cho mỗi tài sản đã tải lên (hình ảnh, font, token thương hiệu, logo, bản sao các tệp đã tải xuống), mỗi cái trỏ tới các byte của nó dưới `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | theo từng tài sản | Các byte thô của tài sản (file hình ảnh và font). Được lưu không nén (các định dạng đã nén sẵn). Phần mở rộng chỉ mang tính hình thức. MIME trong `assets.json` mới là căn cứ chính thức. |
| `assets/blobs/<n>.c2pa` | khi có | Content Credentials đã trích xuất dưới dạng byte nhị phân chính xác, được tham chiếu bởi `_credentialFile` trong bản ghi tài sản. Đây không phải là khóa ký của thiết bị. |
| `design-systems.json` | khi có | Các hệ thống thiết kế được tạo hoặc thêm vào trên bản cài đặt này, dưới dạng `{ active, records }`. Được hợp nhất theo id khi nhập; lựa chọn active của gói chỉ áp dụng khi máy đích chưa có hệ thống thiết kế riêng. |
| `file-history.json` | tùy chọn | Các bản chụp tài sản theo phiên bản, báo cáo thao tác tệp cuối cùng và các bản kê khai batch hoàn chỉnh. Phần lịch sử có phiên bản riêng; do bộ chuyển đổi sao lưu `fileHistory` nội bộ của shell cung cấp. |
| `revision-history.json` | tùy chọn, sao lưu thủ công | Các ID tạo tác ổn định, các checkpoint được giữ lại, ảnh thu nhỏ và các bản nháp phục hồi luân phiên. Do `host.state.history.backup` cung cấp khi được hỗ trợ. |
| `file-history/versions/` | theo từng bản chụp | Byte tài sản trước đó và các credentials đã trích xuất, không phụ thuộc vào việc tài sản hiện tại có còn tồn tại hay không. |
| `file-history/results/` | theo từng thao tác hoàn tất | Byte đầu ra chính xác. Không giữ lại hay bao gồm tệp gốc đã chọn để chuyển đổi. |
| `prefs.json` | có | Tùy chọn cục bộ thuộc sở hữu người dùng: `theme`, `sidebarWidth` và số liệu hoạt động `ct-metrics`. |
| `lolly.txt` | có | Một bản tóm tắt gói dễ đọc với con người (số lượng, hồ sơ, tên file) dành cho bất kỳ ai mở zip mà không có Lolly. Được tạo lại ở mỗi lần xuất và được nhận diện khi nhập, nên nó không bao giờ tính là một phần bị bỏ qua. Nó được ghi *sau* bản đồ toàn vẹn, nên nằm ngoài bản đồ đó. |

Gói này cố tình chỉ là một zip thông thường: nó sống sót nguyên vẹn qua bất kỳ phương thức vận chuyển nào, và bất kỳ công cụ giải nén nào cũng có thể kiểm tra nó.

`profile.json` là phần nhỏ nhất và là phần mà trình đọc thấy đầu tiên trong ứng dụng: các thông tin mà người tạo điền một lần, cộng với tùy chọn cho phép các công cụ sử dụng chúng.

![Biểu mẫu chi tiết Profile trở thành profile.json - tên, liên hệ, ảnh đại diện và tùy chọn cho phép bên cạnh chúng](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

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
- Hồ sơ là một bản ghi duy nhất, nên nó được thay thế toàn bộ: các thư mục, Thùng rác, mẫu, mục yêu thích và công cụ đã ẩn của máy đích trở thành của gói. Một phiên mà máy đích có nhưng gói không có sẽ được giữ lại, chưa xếp vào đâu, ở cấp cao nhất của Dự án.
- Các phiên bản tài sản lịch sử và ID thao tác là ngoại lệ bất biến: nhập lặp lại có tính idempotent, và một ID đã đặt tên cho byte/lịch sử khác thì bị từ chối, không bị ghi đè. Nhập lại một tài sản hiện tại giống hệt sẽ giữ nguyên phiên bản của nó. Một tài sản hiện tại đã thay đổi phải mang một phiên bản khác.
- Lịch sử tạo tác cũng là một ngoại lệ: một tài liệu hiện tại hoặc danh tính phiên bản xung đột sẽ hủy việc khôi phục của nó trước khi có các thay đổi về hồ sơ, tài sản hoặc tùy chọn. Nhập lặp lại giống hệt không thêm dung lượng lưu trữ nào. Khôi phục một kho lưu trữ xung đột trên một bản cài đặt riêng để kiểm tra và sao chép các tạo tác của nó.
- Không có gì không nằm trong gói bị đụng tới. Một phiên mà máy đích có nhưng gói không có sẽ vẫn tồn tại sau khi nhập.

Các phiên đã lưu tự động liên kết lại với hình ảnh của chúng: tham chiếu tài sản được giữ theo id, và cầu nối sẽ phân giải lại chúng sau khi các hình ảnh đã tải lên được khôi phục (dù sao thì nó cũng phải làm vậy, vì URL `blob:` không tồn tại được qua một lần tải lại trang).

Bản tóm tắt nhập báo cáo `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` đếm số tài sản đã tải lên nhưng không thể khôi phục (chẳng hạn bộ nhớ thiết bị đầy). Nó khác với `skipped`, vốn đếm các phần từ một trình ghi mới hơn tương thích ngược mà bản build này không nhận ra. Giao diện hiển thị `skipped` ("… · N newer items skipped"), để việc khôi phục trung thực về những gì nó đã bỏ lại.

Khi có file history, bản tóm tắt cũng mang theo `assetVersions`, `fileOperations` và `failedHistory`. Việc cạn dung lượng lưu trữ hoặc xung đột ID bất biến có thể gây ra một lượt khôi phục một phần; giao diện báo cho người dùng biết để giữ lại bản sao lưu gốc. Đồng bộ đám mây **không** tiến revision đã áp dụng của nó sau một lượt khôi phục một phần hoặc không được hỗ trợ, nên bản chụp vẫn khả dụng để thử lại. Khôi phục không phải là một giao dịch duy nhất trên toàn bộ các kho hồ sơ/phiên/tài sản/lịch sử.

## Lịch sử tạo tác (v3)

Các bản sao lưu thủ công từ một máy chủ web có khả năng lưu lịch sử bao gồm `revision-history.json` với schema `{ version: 1, documents, revisions, recoveries }` riêng của nó. Nó mang theo các ID được giữ lại, các bản chụp đầu vào chính tắc, dấu phiên bản, ảnh xem trước raster và các bản nháp writer riêng biệt. Bộ chuyển đổi lịch sử ghi lại các phiên hiện tại và đầu (head) của chúng trong một giao dịch đọc; `sessions.json` dùng chính các bản chụp hiện tại đó cho các trình đọc cũ hơn.

Khôi phục kiểm tra SHA-256 và số byte của payload, danh tính duy nhất, quan hệ tài liệu/đầu, dòng dõi, dấu thời gian, loại xem trước và các giới hạn trước khi commit kho lưu trữ trong một giao dịch. Các tham chiếu cha đã được nén gọn có thể vắng mặt. Công việc hiện tại đang có phải khớp với tài liệu đã nhập; xung đột bị từ chối thay vì âm thầm thay thế nó. Giới hạn truyền 384 MiB của kho lưu trữ được kiểm tra rõ ràng, và các giới hạn lưu trữ được thực thi mà không cắt bớt các checkpoint đã giữ lại. Toàn bộ bản sao lưu vẫn dùng cách triển khai ZIP trong bộ nhớ và không phải là một kho lưu trữ dạng streaming.

Bản tóm tắt bổ sung thêm `revisions` và `recoveryDrafts`. Một shell không có khả năng này sẽ khôi phục các phiên thông thường và báo cáo phần lịch sử là bị bỏ qua. Lịch sử hệ thống tệp gốc vẫn chưa được hỗ trợ cho đến khi bộ chuyển đổi của nó cung cấp các giao dịch lịch sử bền vững. Trạng thái khách P2P không có lịch sử hay kho lưu trữ phục hồi bền vững nào.

Đồng bộ bản chụp cá nhân cố tình loại trừ lịch sử tạo tác. Áp dụng một bản chụp vào một tài liệu cục bộ có lịch sử sẽ giữ lại trạng thái làm việc trước đó của nó dưới dạng một bản nháp phục hồi riêng biệt và làm mất hiệu lực token ghi của bất kỳ trình chỉnh sửa đang mở nào. Các checkpoint bất biến của nó vẫn ở lại trên thiết bị. Điều này bảo vệ lịch sử cục bộ trong khi thay thế bản chụp; nó không hợp nhất các lịch sử thiết bị đồng thời.

Các tham chiếu tài sản lịch sử được giữ lại, trong khi việc kết xuất vẫn phân giải tài sản qua thư viện hiện có của đích đến. Kho lưu trữ này chưa đảm bảo byte tài sản cũ hay bản kết xuất công cụ cũ chính xác. Byte của phiên bản tài sản và kết quả tệp tiếp tục di chuyển qua phần sao lưu riêng hiện có của chúng.

## Các phiên bản đã lưu và kết quả tệp (v2)

Phần lịch sử tùy chọn chứa `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`; các trình đọc cũng chấp nhận dạng history-v1 trước đó không có batches. Mỗi bản chụp xác định ID tài sản ổn định và phiên bản chính xác, thời điểm lưu, độ dài byte và SHA-256 dạng hex, cùng một bản ghi tài sản mà `_file` và `_credentialFile` tùy chọn của nó trỏ đến các phần nhị phân. Các thao tác mang theo dữ kiện tệp gốc, yêu cầu, báo cáo, dấu thời gian và `_file` kết quả tùy chọn; tên backend lưu trữ, các handle OPFS và các lease thực thi không di chuyển theo. Các trình đọc chỉ hỗ trợ history-v1 cũ hơn sẽ từ chối phiên bản lịch sử mới trước khi nhập, thay vì âm thầm bỏ qua tư cách thành viên batch.

Các bản kê khai batch ghi lại mọi nguồn đã chọn trước khi xử lý, kể cả các tệp chưa từng được đọc, các thành viên đã hủy, các lần không đặt trước được không gian kết quả và công việc bị gián đoạn. Mỗi thành viên có một ID thao tác ổn định, tham chiếu/dữ kiện nguồn, tên đầu ra được yêu cầu và báo cáo cuối cùng. Một nguồn chưa được đọc có các dữ kiện đã khai báo, không phải một digest bịa ra. Việc nhập xác thực danh tính thành viên và tính nhất quán với bất kỳ báo cáo thao tác nào đi kèm. Các báo cáo batch vẫn khả dụng khi các kết quả riêng lẻ đã bị xóa rõ ràng, nhưng một biên nhận không có nghĩa là byte đầu ra của nó vẫn còn được lưu trữ.

- Mọi bản ghi lịch sử, báo cáo và tệp được tham chiếu đã biết đều được xác thực trước khi có bất kỳ lượt ghi nhập profile hay tài sản nào. Byte bị thiếu và SHA-256 không khớp sẽ thất bại ngay cả khi envelope không có bản đồ toàn vẹn. Các credentials đã trích xuất vẫn là mảng byte, kể cả các lượt nhập từ các writer cũ hơn từng serialize chúng dưới dạng JSON thành các đối tượng có khóa số.
- Các thao tác đang chạy trở thành các bản ghi bị gián đoạn trong bản sao lưu, kèm một báo cáo lỗi giải thích và không có kết quả. Khôi phục không bao giờ khởi động lại công việc nền hay nhập một lease đang hoạt động. Thử lại đòi hỏi phải chọn lại tệp gốc, được kiểm tra đối chiếu với SHA-256 đã ghi lại của nó khi có sẵn.
- Các kết quả đã khôi phục commit byte và metadata của chúng cùng nhau trong IndexedDB. Các kết quả mới thông thường dùng OPFS khi có sẵn, với phương án dự phòng là IndexedDB. Một thao tác đang chạy hiện có không bao giờ bị một lượt nhập thay thế.
- Việc lắp ráp ZIP lịch sử vẫn nằm trong bộ nhớ: giới hạn hiện tại là **256 MiB payload lịch sử**, **4 MiB metadata lịch sử**, tối đa **100 thao tác**, **100 batch** và **2.000 bản chụp**. Việc xuất từ chối rõ ràng lịch sử quá khổ hoặc không đầy đủ; nó không bao giờ âm thầm bỏ qua. Hãy tải xuống riêng từng phiên bản/kết quả quan trọng trước khi xóa các bản sao cục bộ cũ hơn. Các giới hạn này không phải là một đảm bảo về đỉnh bộ nhớ đã đo cho điện thoại.
- Lịch sử kết quả cục bộ có ngân sách 512 MiB và giới hạn 100 bản ghi. Các bản chụp tài sản có ngân sách riêng 512 MiB và tối đa 20 phiên bản lịch sử cho mỗi tài sản; byte credential đã trích xuất được tính vào ngân sách bản chụp đó. Khôi phục tôn trọng các giới hạn này và không bao giờ âm thầm loại bỏ dữ liệu người dùng hiện có.
- Metadata batch cục bộ có ngân sách riêng 4 MiB, tối đa 100 bản kê khai và 20 thành viên mỗi batch. Các thành viên đang chờ giữ trước dung lượng metadata, với trần báo cáo 32 KiB mỗi thành viên. Đây là một ngân sách logic, không phải một đảm bảo về dung lượng đĩa trình duyệt; một lỗi hạn mức thực sự sẽ được hiển thị và báo cáo trong bộ nhớ vẫn tải xuống được. Thử lại một thành viên batch tạo ra một batch mới mà không ghi đè báo cáo cũ. Xóa một bản ghi batch không xóa byte kết quả riêng lẻ hay tài sản thư viện.
- Các kết quả đã chuyển đổi có thể được thêm rõ ràng vào thư viện mà không cần chuẩn hóa hay mã hóa lại. Hash nguồn/đầu ra và quan hệ thao tác đi kèm tài sản đó. Việc thêm lặp lại tái sử dụng một bản sao không đổi; một bản sao đã chỉnh sửa không bao giờ bị ghi đè. Ảnh raster có thể khởi tạo một tài liệu Design mới. Tài liệu đó dùng ID tài sản thư viện hiện tại: việc thực thi các mốc phiên bản chính xác xuyên suốt runtime và đường dẫn URL của Design vẫn là công việc riêng. Các kết quả SVG/HTML/PDF/ZIP được giữ như tài sản tệp mờ (opaque) qua lượt bàn giao này, không được nâng cấp thành nội dung tương tác/vector đáng tin cậy.
- **Convert → Recent file operations** hiển thị mức sử dụng lịch sử, các báo cáo, tải xuống và trình quản lý phiên bản. Trình quản lý cũng tìm ra các phiên bản trước đó của các tài sản thư viện đã xóa. Khôi phục một bản chụp tạo ra một phiên bản hiện tại mới trong khi vẫn giữ nguyên bản chụp đã chọn. **Cài đặt → Bộ nhớ** tính riêng kết quả và phiên bản khỏi các bộ nhớ đệm dùng-rồi-bỏ.
- Việc dọn dẹp tệp tạm rõ ràng chỉ xóa các byte thuộc sở hữu thao tác và không còn được tham chiếu. Các bản ghi hiện tại bảo vệ tệp của chúng; các tệp OPFS gần đây có thời gian ân hạn một giờ. Các kết quả đã lưu và bản chụp tài sản không được tự động xóa.

Các trình đọc cũ hơn vẫn chấp nhận envelope v2 (`minReader: 1`) và khôi phục các phần quen thuộc, tính các phần lịch sử không được hỗ trợ là bị bỏ qua. Khôi phục lịch sử đầy đủ đòi hỏi một shell có bộ chuyển đổi `fileHistory`; đây là một điểm nối nội bộ của shell, không phải một khả năng `HostV1` mới hướng tới công cụ. Khôi phục thật giữa hai thiết bị được bao phủ bởi cổng kiểm tra Chromium cục bộ; việc chấp nhận khôi phục trên Tauri/iOS/Android đã cài đặt vẫn là việc riêng.

## Những gì không được mang theo

- **Bộ nhớ đệm danh mục** (siêu dữ liệu và blob tài sản đã tải xuống, chỉ mục công cụ) - được đồng bộ lại miễn phí trên máy đích.
- **Công cụ danh mục và tài sản danh mục** - nằm ngoài phạm vi, và được giả định là đã có sẵn trên máy đích. Token thương hiệu, font và logo mà người dùng thêm vào là tài sản người dùng, nên chúng vẫn di chuyển theo.
- **URL `blob:` / object URL** - được cầu nối tạo lại khi tải.
- **Bản gốc chuyển đổi, lease thực thi trực tiếp và bí mật truy cập/ký cục bộ trên máy** - không phải payload lịch sử có thể mang theo. Một kết quả đã lưu là một bản sao, không phải một lời hứa rằng nguồn gốc đã được sao lưu.
- **Bộ đếm chuỗi số xuất** - bộ đếm đặt tên tải xuống theo từng ngày (khóa `localStorage` `lolly-export-seq`) chỉ là một tiện ích đặt tên cục bộ. Nó được giữ ngoài `PREF_KEYS`, nên không bao giờ đi kèm trong một gói.

Đồng hồ đo dung lượng lưu trữ liệt kê chi tiết theo cùng cách phân chia đó. Saved sessions, My images và File results & versions được mang theo trong một gói. Asset cache, tool previews và offline pins bên dưới chúng đều có thể tạo lại được, nên chúng ở lại.

![Đồng hồ đo dung lượng lưu trữ chia dữ liệu của thiết bị này thành các danh mục có tên, với Saved sessions và My images được theo dõi riêng biệt so với Asset cache, ở đây trên một bản cài đặt mới nơi mọi danh mục vẫn còn trống](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## Cam kết xuyên shell

`data-transfer.ts` chỉ đọc và ghi thông qua cầu nối năng lực (capability bridge) (`host.profile`, `host.state`, `host.assets`) và các tùy chọn `localStorage` dùng chung. Cùng một module đọc và ghi envelope chung trên web và Tauri, qua IndexedDB hoặc bộ nhớ hệ thống tệp. Các phần lịch sử tùy chọn chỉ xuất hiện ở nơi có bộ chuyển đổi tương ứng; một phần không được hỗ trợ sẽ được báo cáo là bị bỏ qua khi nhập. Bộ test headless kiểm chứng các phần chung với một cầu nối trong bộ nhớ, trong khi các giao dịch lịch sử cũng có các bài test trình duyệt thật.

Hai shell nằm ngoài đảm bảo đó, vì những lý do khác nhau:

- **CLI dùng một lần** không có gì để mang theo - trạng thái của nó nằm trong bộ nhớ và chỉ tồn tại tạm thời trong mỗi lần gọi.
- **TUI** có lưu trạng thái (`~/.lolly`: các phiên, thư mục, hồ sơ) và khung Profile của nó có thể sao lưu, nhưng nó ghi ra một kho lưu trữ *đơn giản hơn* của riêng nó: `saved-state/<slot>.json` cho mỗi phiên cộng với `profile.json` và `folders.json`, không có manifest, không có `formatVersion`/`minReader` và không có bản đồ toàn vẹn. Định dạng này **không** thể nhập lại bằng định dạng ở đây - trình đọc sẽ từ chối nó vì "not a Lolly backup" - và gây nhầm lẫn vì nó dùng tên tương tự (`lolly-backup-<stamp>.zip`). Hợp nhất hai định dạng này là một khoảng trống đã biết.

## Các điểm mở rộng dự phòng

Phong bì dữ liệu được thiết kế là một manifest cộng với một tập các phần được đặt tên, để các loại dữ liệu di động mới có thể đi kèm sau này **mà không gây thay đổi phá vỡ tương thích**. Chúng được thêm vào như các phần bổ sung (`formatVersion` mới, `minReader` không đổi), và trình đọc hiện tại bỏ qua những gì nó không nhận ra. Những phần này chưa được xây dựng. Tên gọi được dự phòng ở đây để định dạng vẫn nhất quán khi chúng ra mắt.

- **`tokens.json` - design token.** Một tài liệu design token theo chuẩn [W3C DTCG](https://tr.designtokens.org/format/) (định dạng mà [Penpot nhập và xuất](https://help.penpot.app/user-guide/design-systems/design-tokens/) - các token có `$value`/`$type`/`$description`, được tổ chức thành nhóm, tập hợp và chủ đề). Một tập token trong gói cho phép người dùng chuyển các thành phần thương hiệu gốc giữa các lần cài đặt cùng với các phiên làm việc của họ. (Token thương hiệu của riêng người dùng đã di chuyển ngay hôm nay dưới dạng tài sản `user/tokens/brand` trong `assets.json`; phần này sẽ mang theo cả một tài liệu DTCG với các tập hợp và chủ đề của nó.) Về lâu dài, một tập token đã nhập trở thành một nguồn hạng nhất mà các công cụ và tài sản bảng màu phân giải dựa vào.
- **`penpot/` - các tệp Penpot đã nhập.** Một thư mục dự phòng cho một tệp Penpot (hoặc tập con liên quan đến Lolly được trích xuất từ đó) được nhập vào và hiển thị *như một công cụ*. Gói dữ liệu sẽ mang theo định nghĩa đã nhập, để nó đi cùng với phần còn lại của dữ liệu người dùng.

Bất cứ thứ gì nằm ngoài các tên dự phòng này và các phần nêu trên, đối với trình đọc, đều là một phần không xác định: được giữ nguyên và tính vào `skipped`.

## Tham khảo

- Module: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - hàm đặt tên `backupFilename()` là nội bộ).
- Test hợp đồng: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - các trường hợp khứ hồi, hợp nhất, toàn vẹn, tương thích ngược và cổng kiểm tra trình đọc.
- Test hợp đồng lịch sử: [`tests/file-history-backup.test.ts`](../tests/file-history-backup.test.ts), [`tests/file-batch-history.test.ts`](../tests/file-batch-history.test.ts) và [`tests/file-result-library.test.ts`](../tests/file-result-library.test.ts). Chấp nhận trên trình duyệt: [`tests/file-history.browser.test.ts`](../tests/file-history.browser.test.ts), [`tests/file-batch-history.browser.test.ts`](../tests/file-batch-history.browser.test.ts) và [`tests/file-result-reuse.browser.test.ts`](../tests/file-result-reuse.browser.test.ts).
- Bề mặt cầu nối được dùng: `host.profile`, `host.state`, `host.assets` - xem [Host API](/info/host-api.html).
