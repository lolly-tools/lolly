# Tự mình xác minh

Mọi lời hứa trên site này đều kiểm tra được, không cần tài khoản. Hầu hết kiểm tra chỉ cần trình duyệt; phần còn lại cần terminal và bản sao mã nguồn. Nếu một kiểm tra dưới đây không cho kết quả như đã nêu, đó là lỗi hoặc một lời hứa bị phá vỡ, và chúng tôi muốn biết: xem [If a check fails](#if-a-check-fails).

Bắt đầu với cách nhanh nhất: thả một tệp lên Verify. Rồi đi xa hơn: theo dõi mạng khi bạn dùng công cụ, rút phích cắm mà vẫn làm việc, đếm cookie và đọc mã nguồn.

Các kiểm tra này bao gồm Lolly tự thân. Nếu tổ chức của bạn chạy Lolly Work, nó thêm đăng nhập, nội dung chung, telemetry đã cấu hình và bản ghi kiểm toán; hãy kiểm tra những thứ đó với [Server Surface](/info/server-surface.html) và [phần tổ chức của chính sách quyền riêng tư](/info/privacy.html#organisation-services-with-lolly-work).

## Xem nó hoạt động, trong mười giây

Mở [`/verify`](/#/verify) và thả một tệp lên trang. Không tải lên, không tài khoản và không chờ máy chủ. Ở đây nó kiểm tra [cơn bão Queensland được tạo](/info/ai-stance.html) từ Our AI Stance: một ảnh do Gemini tạo, mà Lolly đã mở, đánh dấu và chuyển đổi. Mọi huy hiệu được tính trên thiết bị, từ chính byte của tệp.

![Verify trên màn hình rộng bằng điện thoại - hình ảnh cơn bão, một kết luận Made with Lolly màu xanh lá và các huy hiệu credential-intact cùng bytes-unchanged xếp bên dưới](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Kết luận là một chồng huy hiệu nhỏ, mỗi cái là một sự thật độc lập:

- <!--i:lock--> **Made with Lolly**: credential còn nguyên *và* ghi một bản xuất Lolly.
- <!--i:seal--> **The credential is intact**: manifest C2PA có chữ ký phân tích được và chữ ký khẳng định của chính nó xác minh được.
- <!--i:hash--> **The bytes have not changed**: giá trị băm của tệp vẫn khớp với những gì đã ký. Đổi một điểm ảnh và huy hiệu này đảo ngược.
- <!--i:sparkle--> **GEN AI**: một cỗ máy đã tạo các điểm ảnh này, và tệp nói vậy. Lolly đọc lại khai báo đó thay vì giấu sự thật.

Toàn bộ lịch sử đi cùng tệp. Chín bước còn lại ở đây: năm bước Google ghi lại khi tạo và đóng hình mờ cho ảnh, rồi bốn bước Lolly ghi lại khi mở, đánh dấu và chuyển đổi bản sao trên trang này. Verify đọc chúng thẳng từ các byte và vẽ thành dòng thời gian.

![Lịch sử thay đổi mà Verify đọc lại từ hình ảnh cơn bão - năm bước do Google ghi lại, sau đó bốn bước do Lolly, kết thúc ở tệp WebP trên trang này](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Đó là bản demo. Các kiểm tra dưới đây là những đảm bảo nằm bên dưới nó, và mỗi cái đều tái hiện được. [Content Credentials](/info/content-credentials-identity.html) giải thích từng kết luận.

## Ngay trong trình duyệt của bạn, không cần công cụ nào

::: timeline
- <!--i:globe--> **1. Theo dõi mạng.** Mở [lolly.tools](https://lolly.tools), mở DevTools của trình duyệt (F12), chuyển sang **Network** và dùng một công cụ: gõ địa chỉ web vào [QR Code](/t/qr-code), đổi màu, xuất một PNG. Mọi yêu cầu ở lại `lolly.tools`: vỏ ứng dụng, tệp của chính công cụ và tài nguyên danh mục. Không có máy chủ phân tích, không tín hiệu CDN, không dịch vụ phông chữ và không điểm cuối báo lỗi. Những gì bạn gõ vào công cụ xuất hiện trong **không yêu cầu nào**, vì kết xuất là cục bộ.
- <!--i:eyeoff--> **2. Rút phích cắm.** Nạp ứng dụng và mở một hai công cụ, rồi chuyển ngoại tuyến (chế độ máy bay, hoặc DevTools → Network → Offline) và tải lại. Thư viện và mọi công cụ bạn đã mở tiếp tục hoạt động, kể cả kết xuất và xuất ở các định dạng bạn đã dùng. Tệp của công cụ và bộ mã hóa của một định dạng được lưu đệm lần đầu bạn dùng, nên hãy dùng một công cụ một lần khi trực tuyến trước khi thử ngoại tuyến. Đây là kiểm tra đơn lẻ mạnh nhất trên trang này: phần mềm gọi về nhà không sống sót khi bị cắt dây.
- <!--i:check--> **3. Đếm cookie.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Danh sách trống: ứng dụng không đặt cookie. Dán `document.cookie` vào console và bạn nhận `""`. Việc đăng ký CA tùy chọn đặt một cookie `HttpOnly` ngắn hạn, `lolly_ca_state`, trong phạm vi `/api/ca`, mà `document.cookie` không hiện được. Một phiên bản Lolly Work dùng cookie đăng nhập riêng của nó; hãy so với [Privacy](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Đọc bộ nhớ của chính bạn.** Trong cùng bảng, mọi thứ Lolly giữ đều ở trước mặt bạn: vài chục khóa `localStorage` thuần (chủ đề, ngôn ngữ, độ rộng thanh bên, cài đặt âm thanh và chế độ xem, và bản sao đã lưu đệm của chỉ mục danh mục công cụ công khai) và tài liệu của chính bạn trong IndexedDB. Mọi giá trị là chuỗi hoặc JSON đọc được, không có gì bị làm rối. Xóa dữ liệu site gỡ các bản ghi cục bộ này, nhưng không gỡ bản sao lưu Sync hay bản ghi do phiên bản Lolly Work giữ. **Settings → Storage → Clear all my data** làm tương tự từ bên trong ứng dụng, và bạn có thể xem các kho và bộ nhớ đệm trống đi.
- <!--i:lock--> **5. Kiểm tra liên hệ công bố lỗ hổng có tồn tại.** [`/.well-known/security.txt`](/.well-known/security.txt) trả lời bằng khối liên hệ [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), không phải trang HTML.
:::

::: details Những gì khác bạn có thể thấy trong thẻ Network
Một số tính năng chỉ với tới mạng khi bạn dùng chúng, và mỗi cái đều thấy được trong cùng thẻ:

- thêm một **Google Font** trong Design System Setup tải đúng họ phông chữ đó từ Google, sau một hộp thoại đồng ý nói rõ điều đó, một lần, trước lần tải đầu tiên;
- nhấp một **cài đặt sẵn hồ sơ in ICC** tải hồ sơ đó từ sổ đăng ký công khai của ICC tại color.org;
- phát **radio** tích hợp tùy chọn truyền phát từ đài;
- nhập một địa điểm trong **Meeting Planner** tra địa điểm đó tại dịch vụ geocoding của open-meteo để lấy tọa độ và múi giờ, một lần cho mỗi thành phố (câu trả lời được lưu trên thiết bị), và ô nhập nói rõ điều này nơi bạn gõ;
- **URL Screenshot** tải địa chỉ bạn gõ, vì đó là việc của nó, và bạn xem nó xảy ra.

Một công cụ khai báo khả năng mạng chỉ có thể tải từ các máy chủ mà manifest của nó cho phép, và kiểm tra đó thất bại theo hướng đóng. Hiện không công cụ nào đi kèm khai báo khả năng đó, nên Content-Security-Policy do trình duyệt thực thi là thứ giữ danh sách trên trong các máy chủ của nó. [Chính sách quyền riêng tư](/info/privacy.html) giữ bảng chuẩn của tất cả những thứ này, kể cả lưu lượng phiên bản được quản lý như làm mới chính sách và báo cáo đã bật.
:::

## Từ một terminal

**6. Điểm cuối kết xuất chỉ trả lời bằng dữ liệu công khai.** Tính năng máy chủ duy nhất đặt đầu vào đã gõ vào URL, kết xuất hot-link, đang hoạt động ở đây. [Chính sách quyền riêng tư](/info/privacy.html) nói điều đó nghĩa là gì với các đầu vào bạn đặt trong liên kết.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Mỗi bản triển khai tự chọn (`LOLLY_DISABLE_RENDER_GET=1`): trên phiên bản đặt nó, cùng phép thăm dò trả về `404`. Sự khác biệt đó là cài đặt đang hoạt động, không phải bất nhất.

**7. Kiểm tra các dịch vụ mà bản triển khai của bạn bật.** [Server Surface](/info/server-surface.html) liệt kê các dịch vụ tùy chọn và liên kết tới tài liệu chi tiết của chúng. Với Lolly Work, hãy gồm các API có xác thực, kết nối cộng tác, lưu trữ và nhà cung cấp đã cấu hình. Thăm dò lolly.tools công khai không kiểm thử một phiên bản tổ chức riêng tư.

Nếu bạn chạy phiên bản riêng, [Delivery deployment](/info/deploy-delivery.html) có các kiểm tra phát hành cho nó: toàn vẹn mô hình, phép thăm dò edge và danh sách mẫu của nó, bản hiển thị, cổng tải xuống riêng tư và danh mục có chữ ký trong trình duyệt.


## Trong mã nguồn

Tất cả những điều trên vẫn có thể là diễn kịch nếu mã đã triển khai khác với mã công khai. Vậy hãy kiểm tra mã. Bản triển khai dựng từ [kho công khai](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Không có trình theo dõi và không có SDK phân tích ở bất kỳ đâu.** Tìm trong mã được phát hành (engine, mọi shell kể cả tiện ích mở rộng trình duyệt, các ghi đè cầu Tauri và service worker, các hàm máy chủ và các gói công cụ) những kẻ tình nghi thông thường:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Phép quét này tìm SDK theo dõi của bên thứ ba. Nó không chứng minh sự vắng mặt của báo cáo sử dụng của chính chúng tôi: Lolly Work hỗ trợ telemetry tổ chức và nhật ký kiểm toán riêng, với chính sách và kiểm thử riêng.

**9. Không có trình phân giải DNS của bên thứ ba.** Kiểm tra SEAL của Verify không bao giờ gửi tra cứu qua nhà cung cấp DNS-over-HTTPS, vì ứng dụng không có trình phân giải:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Dịch vụ chứng chỉ không giữ nhật ký cấp phát.** CA danh tính không giữ nhật ký về những gì nó đã cấp và không có kho danh tính: không dòng stdout, không webhook, không kho chứng chỉ. Sự vắng mặt có thể tìm kiếm được:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

CA có giữ trạng thái làm việc ngắn hạn: các nhóm giới hạn tốc độ giữ khóa IP và email đã băm trong cửa sổ của chúng, và kho nhận vào của bản triển khai được quản lý giữ một định danh có khóa và giá trị băm yêu cầu tối đa mười phút. [Content Credentials engineering](/info/content-credentials-engineering.html#protocol) có chi tiết.

## Được thực thi bằng kiểm thử

Các kiểm tra mã nguồn trên không phải một lần kiểm toán duy nhất: chúng được ghim trong bộ kiểm thử, nên không thể mục nát lặng lẽ. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) kiểm tra danh sách tên trình theo dõi dài hơn phép quét trên và làm hỏng bản dựng nếu:

- bất kỳ SDK phân tích hay theo dõi nào xuất hiện ở bất cứ đâu trong mã nguồn phát hành mà nó quét, qua mã ứng dụng, engine, máy chủ, tiện ích mở rộng và gói công cụ;
- bất kỳ trình phân giải DNS-over-HTTPS của bên thứ ba nào xuất hiện trong mã nguồn đó;
- nhật ký cấp phát CA quay lại, trong mã nguồn **hoặc** gói máy chủ được tạo;
- chính sách quyền riêng tư mất các tuyên bố bắt buộc theo luật (bên kiểm soát có tên, cơ sở pháp lý, quyền khiếu nại).

Hãy tự chạy chúng trong bản clone (Node 22.18 trở lên; tệp này không cần `pnpm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Bộ kiểm thử đầy đủ (`pnpm install && pnpm test`) chạy thêm vài nghìn kiểm thử nữa, bao gồm các kiểm thử mật mã học đối kháng (adversarial) được mô tả trong [Security & Verification](/info/security.html).

## Những gì bạn không kiểm chứng được từ bên ngoài

- **Nhật ký truy cập lưu trữ.** Bất kỳ máy chủ nào trả lời yêu cầu đều có thể ghi nhật ký: địa chỉ IP, đường dẫn và thời gian. Một phép thăm dò từ ngoài không xác lập được nhật ký được giữ bao lâu. Đơn vị vận hành kiểm soát việc ghi nhật ký, xoay vòng và xuất, và phải công bố các lựa chọn đó. Kết xuất cục bộ giữ các chỉnh sửa thông thường trên thiết bị của bạn; kết xuất máy chủ tùy chọn và dịch vụ không gian làm việc chung có các luồng dữ liệu riêng mà chính sách quyền riêng tư mô tả.
- **Rằng bản triển khai chạy mã này.** Bạn có thể kiểm tra mã nguồn sạch và hành vi đã triển khai khớp với nó, và các kiểm tra trên làm cả hai. Chứng thực ở mức nhị phân cho một bản triển khai web không phải thứ nền tảng web cung cấp. Các biện pháp giảm nhẹ là kho công khai, các kiểm thử được thực thi và kiểm tra ngoại tuyến: một bản triển khai bị can thiệp mà gọi về nhà sẽ trượt kiểm tra 1 và 2 cùng lúc.
- **Hook của công cụ.** Logic tùy chọn của công cụ tích hợp được xem xét thay vì đặt trong sandbox: nó chạy trong trang trừ khi công cụ chọn dùng Worker. Mọi công cụ trên lolly.tools đều là sản phẩm của chính chúng tôi và được xem xét trước khi phát hành. [Threat Model](/info/threat-model.html#trust-boundaries) nêu hook chạy ở đâu và điều gì giới hạn chúng.

## Nếu một phép kiểm tra thất bại

Sự khác biệt giữa trang này và những gì bạn quan sát được là một báo cáo bảo mật. Hãy gửi nó qua các kênh riêng tư tại [Security & Verification](/info/security.html#reporting-a-vulnerability). Chúng tôi thực hành công bố phối hợp và ghi nhận người báo cáo.
