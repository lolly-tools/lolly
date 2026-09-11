# Tự mình xác minh

Các trang về quyền riêng tư và bảo mật của Lolly đưa ra những tuyên bố: không phân tích dữ liệu, không theo dõi, tệp không bao giờ rời khỏi thiết bị, chỉ một cookie duy nhất trong toàn hệ thống. Trang này thì khác: nó không yêu cầu bạn tin vào bất kỳ điều gì trong số đó. Đây là một danh sách các quy trình, mỗi quy trình kèm theo đúng lệnh hoặc đường dẫn thao tác và kết quả bạn sẽ thấy. Mọi tuyên bố ở đây đều có thể kiểm chứng sai trong vài phút, phần lớn không cần cài đặt gì cả.

Nếu bất kỳ mục kiểm tra nào trên trang này không cho ra kết quả như hiển thị, đó là lỗi hoặc một lời hứa bị phá vỡ. [Báo cáo lại](#if-a-check-fails) trong cả hai trường hợp, và chúng tôi sẽ xử lý với mức độ nghiêm trọng mà một lời hứa bị phá vỡ đáng nhận.

## Xem nó hoạt động, trong mười giây

Trước khi vào các quy trình, đây là kết quả cuối. Mở [`/verify`](/#/verify) và thả một tệp vào đó - không tải lên, không cần tài khoản, không chờ máy chủ. Đây là nó đang kiểm tra [cơn bão Queensland do AI tạo ra](/info/ai-stance.html) từ trang lập trường về AI của chúng tôi: một hình ảnh Gemini mà Lolly đã mở, đổi kích thước và xuất ra. Mọi huy hiệu bên dưới đều được tính toán trên thiết bị, từ chính các byte của tệp.

![Verify trên màn hình rộng bằng điện thoại - hình ảnh cơn bão, một kết luận Made with Lolly màu xanh lá và các huy hiệu credential-intact cùng bytes-unchanged xếp bên dưới](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Kết luận không phải một huy hiệu duy nhất mà là một nhóm nhỏ các huy hiệu, mỗi cái là một sự thật độc lập:

- <!--i:lock--> **Made with Lolly** - credential còn nguyên vẹn *và* ghi lại một lần xuất từ Lolly.
- <!--i:seal--> **Credential còn nguyên vẹn** - manifest C2PA đã ký được phân tích thành công và chữ ký claim của chính nó được xác minh.
- <!--i:hash--> **Các byte chưa thay đổi** - hash của tệp vẫn khớp với những gì đã được ký. Thay đổi một pixel là huy hiệu này sẽ đảo ngược.
- <!--i:sparkle--> **GEN AI** - một cỗ máy đã tạo ra các pixel này, và tệp nói vậy. Lolly đọc lại tuyên bố đó thay vì che giấu nó.

Và toàn bộ lịch sử đi cùng tệp. Chín bước còn tồn tại ở đây - năm bước do Google ghi lại khi tạo và đóng dấu bảo mật cho hình ảnh, sau đó bốn bước do Lolly ghi lại khi mở, đánh dấu và chuyển đổi bản sao trên trang này - được đọc thẳng ra từ các byte, trên thiết bị của bạn, và hiển thị dưới dạng dòng thời gian. Đây là cùng một hình ảnh, được xác minh theo cùng cách, như dòng thời gian C2PA trên [trang lập trường về AI](/info/ai-stance.html).

![Lịch sử thay đổi mà Verify đọc lại từ hình ảnh cơn bão - năm bước do Google ghi lại, sau đó bốn bước do Lolly, kết thúc ở tệp WebP trên trang này](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Tuy nhiên, tất cả những điều đó không phải là tuyên bố về độ tin cậy - đó chỉ là bản demo. Phần còn lại của trang này mới là tuyên bố về độ tin cậy: mọi huy hiệu ở trên đều có thể tái tạo được, và đây là cách bạn tái tạo các cam kết đằng sau chúng.

## Ngay trong trình duyệt của bạn, không cần công cụ nào

**1. Theo dõi mạng.** Mở [lolly.tools](https://lolly.tools), mở DevTools của trình duyệt (F12), chuyển sang tab **Network** và dùng thử một công cụ - gõ một URL vào [QR Code](/t/qr-code), đổi màu, xuất PNG. Mọi yêu cầu đều nằm trên `lolly.tools`: vỏ ứng dụng, các tệp riêng của công cụ, tài sản danh mục. Không có máy chủ phân tích, không có beacon CDN, không có dịch vụ phông chữ, không có điểm cuối "báo cáo lỗi" nào. Những gì bạn gõ vào một công cụ **không xuất hiện trong bất kỳ yêu cầu nào** - việc kết xuất diễn ra cục bộ.

Những ngoại lệ trung thực - mỗi ngoại lệ đều là tùy chọn tham gia, do người dùng khởi xướng và hiển thị trong cùng tab Network khi nó xảy ra: thêm một **Google Font** trong trình soạn thương hiệu sẽ tải riêng họ phông chữ đó từ Google, sau một hộp thoại xin đồng ý cho bạn biết chính xác điều đó, một lần, trước lần tải đầu tiên; nhấp vào một **cấu hình in ICC** sẽ tải cấu hình đó từ sổ đăng ký công khai của ICC tại color.org; phát **radio** tích hợp tùy chọn sẽ phát trực tuyến từ đài; nhập một địa điểm vào **Meeting Planner** sẽ tra cứu địa điểm đó tại dịch vụ định vị địa lý của open-meteo để lấy tọa độ và múi giờ, một lần cho mỗi thành phố (câu trả lời được lưu trên thiết bị của bạn), và ô nhập liệu mang theo lời công bố đó ngay tại nơi bạn gõ; và **URL Screenshot** tất yếu phải tải URL bạn đã gõ - đó là công việc của nó, và bạn theo dõi điều đó xảy ra. Một công cụ khai báo khả năng mạng chỉ có thể tải từ các máy chủ mà tệp manifest của nó cho phép, và cơ chế đó là fail-closed (mặc định chặn); hiện chưa có công cụ nào đã phát hành khai báo điều này, vì vậy Content-Security-Policy do trình duyệt thực thi mới là ranh giới thực sự giữ danh sách trên đúng với các máy chủ của nó. [Chính sách quyền riêng tư](/info/privacy.html) lưu giữ bảng chuẩn của tất cả những điều này; quy tắc cố định của nó là một lượt truy cập mạng không có trong bảng đó thì không xảy ra.

**2. Rút phích cắm.** Tải ứng dụng và mở một hoặc hai công cụ, sau đó ngắt kết nối mạng - chế độ máy bay, hoặc DevTools → Network → Offline. Tải lại trang. Thư viện và mọi công cụ bạn đã mở vẫn hoạt động, kể cả việc kết xuất và xuất theo các định dạng bạn đã dùng - các tệp của một công cụ và bộ mã hóa của một định dạng được lưu vào bộ nhớ đệm ngay lần đầu bạn sử dụng, vì vậy hãy chạy thử một công cụ khi còn trực tuyến trước khi kiểm tra nó ở chế độ ngoại tuyến. Đây là phép kiểm tra đơn lẻ mạnh nhất trên trang này: phần mềm gọi về nhà không thể sống sót khi dây bị cắt.

**3. Đếm cookie.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Danh sách trống - ứng dụng không đặt cookie nào. Hoặc dán `document.cookie` vào console: bạn nhận được `""`. (Cookie duy nhất trong toàn hệ thống, `lolly_ca_state`, tồn tại nhiều nhất mười phút trong lúc đăng nhập danh tính tùy chọn - bị xóa ngay khi đăng nhập hoàn tất - có phạm vi giới hạn ở `/api/ca` và là `HttpOnly`: [chính sách quyền riêng tư](/info/privacy.html) mô tả nó chính xác.)

**4. Đọc chính bộ nhớ lưu trữ của bạn.** Cùng bảng Application: mọi thứ Lolly lưu giữ đều có thể kiểm tra được ngay trước mắt bạn - vài chục khóa `localStorage` đơn giản (chủ đề, ngôn ngữ, độ rộng thanh bên, cài đặt âm thanh và chế độ xem, cùng một bản sao được lưu đệm của chỉ mục danh mục công cụ công khai), và các tài liệu của riêng bạn trong IndexedDB. Mọi giá trị đều là chuỗi hoặc JSON có thể đọc được - không có gì bị làm rối, không có gì được mã hóa để cản trở việc đọc. **Profile → Clear all my data** sẽ xóa sạch nó; việc xóa dữ liệu trang trong trình duyệt cũng vậy, vì không có bản sao phía máy chủ nào tồn tại để sống sót qua việc đó.

**5. Kiểm tra liên hệ công bố có tồn tại.** [`/.well-known/security.txt`](/.well-known/security.txt) trả về một khối liên hệ theo [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), không phải một trang HTML.

## Từ một terminal

**6. Điểm cuối kết xuất bị tắt trên lolly.tools.** Tính năng duy nhất của máy chủ có thể đưa dữ liệu người dùng gõ vào một URL - kết xuất qua liên kết trực tiếp (hot-link) - bị vô hiệu hóa ở đây cho đến khi dịch vụ chuyển sang lưu trữ do tổ chức sở hữu ([chính sách quyền riêng tư](/info/privacy.html) giải thích lý do):

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 404
```

Công tắc này áp dụng theo từng lần triển khai (`LOLLY_DISABLE_RENDER_GET=1`): trên một instance không đặt biến này, kết xuất qua liên kết trực tiếp vẫn hoạt động, nên cùng một phép thử ở đó trả về một hình ảnh - sự khác biệt này là do cờ đang hoạt động đúng, không phải là sự thiếu nhất quán.

**7. Bề mặt máy chủ có thể liệt kê được.** [Server Surface](/info/server-surface.html) liệt kê mọi tuyến phía máy chủ đang tồn tại, với quy tắc cố định là một điểm cuối không có trên trang đó thì không thuộc về Lolly. Hãy `curl` chúng; không còn gì khác để tìm thấy.

## Trong mã nguồn

Tất cả những điều trên vẫn có thể chỉ là màn kịch nếu mã đã triển khai khác với mã công khai. Vì vậy hãy kiểm tra mã nguồn - bản triển khai được xây dựng từ [kho lưu trữ công khai](https://github.com/lolly-tools/lolly):

```bash
git clone --recurse-submodules https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Không có trình theo dõi, không có SDK phân tích, ở bất cứ đâu.** Tìm kiếm trong mã được phát hành - engine, mọi shell (bao gồm tiện ích mở rộng trình duyệt, các ghi đè cầu nối Tauri và service worker), các hàm máy chủ và các gói công cụ - để tìm những nghi phạm quen thuộc:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

**9. Không có bộ phân giải DNS bên thứ ba.** Kiểm tra SEAL của Verify không bao giờ định tuyến các truy vấn qua một nhà cung cấp DNS-over-HTTPS - ứng dụng web đơn giản là không có bộ phân giải nào:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Dịch vụ chứng chỉ không lưu giữ bất cứ điều gì.** CA danh tính không có nhật ký cấp phát - không email của bạn, không dấu thời gian, không webhook. Sự vắng mặt này có thể xác minh bằng grep:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

## Được thực thi bởi các bài kiểm thử, không phải lời hứa

Ba phép kiểm tra mã nguồn ở trên không phải là một cuộc kiểm toán một lần - chúng được ghim cố định trong bộ kiểm thử, nên không thể âm thầm mục nát. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) sẽ làm bản dựng thất bại nếu:

- bất kỳ SDK phân tích hoặc theo dõi nào xuất hiện ở bất cứ đâu trong mã nguồn được phát hành mà nó quét - ứng dụng, engine, máy chủ, tiện ích mở rộng và mã gói công cụ như nhau,
- bất kỳ bộ phân giải DNS-over-HTTPS bên thứ ba nào xuất hiện trong mã nguồn đó,
- nhật ký cấp phát của CA quay trở lại - trong mã nguồn **hoặc** trong gói máy chủ đã tạo ra,
- chính sách quyền riêng tư mất đi các tuyên bố bắt buộc theo luật (bên kiểm soát được nêu tên, cơ sở pháp lý, quyền khiếu nại).

Tự bạn chạy chúng trong bản sao (Node 22.18+; không cần `npm install` cho tệp này):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Bộ kiểm thử đầy đủ (`npm install && npm test`) chạy thêm vài nghìn bài kiểm thử nữa, bao gồm các bài kiểm thử mật mã học đối kháng được mô tả trong [Security & Verification](/info/security.html).

## Những gì bạn không thể xác minh từ bên ngoài - nói thẳng

Một trang như thế này giành được lòng tin bằng cách nêu rõ chính giới hạn của nó:

- **Nhật ký truy cập lưu trữ.** Bất kỳ máy chủ nào trả lời một yêu cầu đều có thể ghi lại yêu cầu đó - IP, đường dẫn, dấu thời gian. Bạn không thể xác minh một máy chủ lưu giữ hay không lưu giữ điều gì, và chúng tôi cũng vậy, ngoài hành vi đã được nhà cung cấp của chúng tôi ghi thành văn bản. Đó chính xác là lý do kiến trúc giữ hoàn toàn nội dung của bạn ngoài đường truyền: những gì không bao giờ rời khỏi thiết bị của bạn thì không ai có thể ghi lại được.
- **Rằng bản triển khai chạy đúng mã này.** Bạn có thể xác minh mã nguồn sạch và hành vi đã triển khai khớp với nó (các phép kiểm tra ở trên làm cả hai đầu), nhưng chứng thực ở cấp độ nhị phân cho một bản triển khai web không phải là điều nền tảng web cung cấp. Các biện pháp giảm thiểu là kho công khai, các bài kiểm thử được thực thi bắt buộc và phép kiểm tra ngoại tuyến - một bản triển khai bị can thiệp mà gọi về nhà sẽ thất bại ngay ở phép kiểm tra 1 và 2.
- **Các hook của công cụ không được cách ly (sandbox) theo mặc định.** Logic tùy chọn của một công cụ chạy sau khi đã được xem xét, trong chính realm của trang; mọi công cụ trên lolly.tools đều là bên thứ nhất và được xem xét trước khi phát hành. Cách ly Worker giờ đây đã có sẵn dưới dạng tùy chọn tham gia theo từng công cụ - một công cụ có manifest đặt `isolate: true` sẽ chạy các hook của nó ngoài luồng chính thay vào đó - vì vậy những gì bạn không thể xác minh từ bên ngoài đang thu hẹp lại, nhưng đường dẫn mặc định vẫn nằm trong realm và việc xem xét vẫn là biện pháp kiểm soát. Điều này được nêu rõ, không bị che giấu - xem mục [ranh giới thiết kế](/info/security.html), vốn luôn nói như vậy.

## Nếu một phép kiểm tra thất bại

Sự khác biệt giữa trang này và hành vi quan sát được là một báo cáo bảo mật, và chúng tôi thực sự muốn nghe về điều đó hơn là không: [fitzy+security@suse.com](mailto:fitzy+security@suse.com), nút **Report a vulnerability** trên bất kỳ [kho lolly-tools](https://github.com/lolly-tools) nào hoặc liên hệ trong [`/.well-known/security.txt`](/.well-known/security.txt). Công bố phối hợp và ghi nhận công của người báo cáo là chính sách cố định - [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md) có đầy đủ chi tiết.
