# Tự kiểm chứng

Mọi cam kết trên website này đều có thể kiểm tra mà không cần tài khoản. Hầu hết chỉ cần trình duyệt; phần còn lại cần terminal và bản sao mã nguồn. Nếu một kiểm tra bên dưới không cho kết quả như được mô tả, đó là lỗi hoặc cam kết không được thực hiện, và chúng tôi muốn biết: xem [Nếu một kiểm tra thất bại](#if-a-check-fails).

Các kiểm tra này bao quát Lolly độc lập. Nếu tổ chức của bạn chạy Lolly Work, nó bổ sung đăng nhập, nội dung dùng chung, thu thập dữ liệu đo lường theo cấu hình và bản ghi kiểm toán; hãy đối chiếu chúng với [Bề mặt máy chủ](/info/server-surface.html) và [phần dành cho tổ chức trong chính sách quyền riêng tư](/info/privacy.html#organisation-services-with-lolly-work).

<!--i:eti-clock-->
## Xem nó hoạt động trong mười giây

Mở [`/verify`](/#/verify) và thả một tệp lên trang. Không tải lên, không cần tài khoản và không chờ máy chủ. Ở đây, nó kiểm tra [cơn bão Queensland do AI tạo](/info/ai-stance.html) từ trang Quan điểm của chúng tôi về AI: một ảnh do Gemini tạo, được Lolly mở, đánh dấu và chuyển đổi. Mọi huy hiệu đều được xác định trên thiết bị, từ chính các byte của tệp.

![Lolly Verify trên màn hình có chiều rộng điện thoại - ảnh cơn bão, kết luận Made with Lolly màu xanh lá và các huy hiệu chứng thực nguyên vẹn, byte không thay đổi xếp bên dưới](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Kết luận là một nhóm nhỏ các huy hiệu, mỗi huy hiệu là một sự thật độc lập:

- <!--i:lock--> **Made with Lolly**: chứng thực nguyên vẹn *và* ghi nhận một lần xuất từ Lolly.
- <!--i:seal--> **The credential is intact**: bản kê C2PA đã ký phân tích được và chữ ký khai báo của chính nó được xác minh.
- <!--i:hash--> **The bytes have not changed**: giá trị băm của tệp vẫn khớp với nội dung đã ký. Đổi một điểm ảnh là huy hiệu này đổi trạng thái.
- <!--i:sparkle--> **GEN AI**: máy đã tạo ra các điểm ảnh này, và tệp nói rõ điều đó. Lolly đọc lại khai báo đó thay vì giấu đi sự thật.

Toàn bộ lịch sử đi cùng tệp. Chín bước được giữ lại ở đây: năm bước Google ghi nhận khi tạo và thêm hình mờ vào ảnh, rồi bốn bước Lolly ghi nhận khi mở, đánh dấu và chuyển đổi bản sao trên trang này. Lolly Verify đọc chúng trực tiếp từ các byte và vẽ thành dòng thời gian.

![Lịch sử thay đổi mà Lolly Verify đọc lại từ ảnh cơn bão - năm bước do Google ghi nhận, rồi bốn bước do Lolly ghi nhận, kết thúc bằng WebP trên trang này](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Các kiểm tra bên dưới là những bảo đảm làm cơ sở cho bản minh họa đó, và từng kiểm tra đều có thể lặp lại. [Content Credentials](/info/content-credentials-identity.html) giải thích mọi kết luận.

<!--i:eti-globe-->
## Trong trình duyệt, không cần công cụ

::: timeline
- <!--i:globe--> **1. Theo dõi mạng.** Mở [lolly.tools](https://lolly.tools), mở DevTools của trình duyệt (F12), chuyển sang **Network** và dùng một công cụ: nhập địa chỉ web vào [Lolly QR Code](/t/qr-code), đổi màu, xuất PNG. Mọi yêu cầu đều đến `lolly.tools`: lớp vỏ ứng dụng, tệp riêng của công cụ và tài nguyên danh mục. Không có máy chủ phân tích, beacon CDN, dịch vụ phông chữ hay điểm cuối báo lỗi. Những gì bạn nhập vào công cụ xuất hiện trong **không một yêu cầu nào**, vì việc kết xuất diễn ra cục bộ.
- <!--i:eyeoff--> **2. Ngắt kết nối.** Tải ứng dụng và mở một hoặc hai công cụ, rồi chuyển sang ngoại tuyến (chế độ máy bay hoặc DevTools → Network → Offline) và tải lại. Gallery và mọi công cụ bạn đã mở vẫn hoạt động, bao gồm kết xuất và xuất ở các định dạng bạn đã dùng. Tệp của công cụ và bộ mã hóa của định dạng được lưu vào bộ nhớ đệm lần đầu bạn dùng, nên hãy dùng công cụ một lần khi trực tuyến trước khi kiểm tra ngoại tuyến. Đây là phép kiểm tra riêng lẻ mạnh nhất trên trang này: phần mềm phải liên lạc về máy chủ không thể tiếp tục khi bị cắt kết nối.
- <!--i:check--> **3. Đếm cookie.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Danh sách trống: ứng dụng không đặt cookie. Dán `document.cookie` vào bảng điều khiển và bạn nhận được `""`. Đăng ký CA tùy chọn đặt một cookie `HttpOnly` tồn tại ngắn hạn, `lolly_ca_state`, giới hạn trong `/api/ca`, mà `document.cookie` không hiển thị được. Một hệ thống Lolly Work dùng cookie đăng nhập riêng; đối chiếu chúng với [Quyền riêng tư](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Đọc bộ lưu trữ của bạn.** Trong cùng bảng đó, mọi thứ Lolly giữ đều ở trước mắt bạn: vài chục khóa `localStorage` dạng thuần (chủ đề, ngôn ngữ, chiều rộng thanh bên, cài đặt âm thanh và chế độ xem cùng bản sao chỉ mục danh mục công cụ công khai trong bộ nhớ đệm) và tài liệu của bạn trong IndexedDB. Mỗi giá trị là chuỗi hoặc JSON đọc được, không có gì bị làm rối. Xóa dữ liệu website sẽ xóa các bản ghi cục bộ này, nhưng không xóa bản sao lưu Sync hay bản ghi do một hệ thống Lolly Work lưu. **Settings → Storage → Clear all my data** thực hiện cùng việc đó từ bên trong ứng dụng, và bạn có thể thấy các kho lưu trữ và bộ nhớ đệm được làm trống.
- <!--i:lock--> **5. Kiểm tra đầu mối tiếp nhận công bố lỗ hổng có tồn tại.** [`/.well-known/security.txt`](/.well-known/security.txt) trả về một khối thông tin liên hệ theo [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), không phải trang HTML.
:::

::: details Những gì khác bạn có thể thấy trong thẻ Network
Một số tính năng chỉ truy cập mạng khi bạn dùng chúng, và mỗi tính năng đều hiển thị trong cùng thẻ đó:

- thêm một **Google Font** trong Lolly Design System Setup sẽ tải đúng họ phông chữ đó từ Google, sau hộp thoại đồng ý nói rõ việc này, hiển thị một lần trước lần tải đầu tiên;
- nhấp vào một **cấu hình màu máy in ICC đặt sẵn** sẽ tải cấu hình đó từ kho đăng ký công khai của ICC tại color.org;
- bật **radio** tích hợp tùy chọn sẽ phát luồng từ đài;
- nhập một địa điểm trong **Meeting Planner** sẽ tra địa điểm đó qua dịch vụ mã hóa địa lý của open-meteo để lấy tọa độ và múi giờ, một lần cho mỗi thành phố (kết quả được lưu trên thiết bị của bạn), và ô nhập nói rõ điều này ngay nơi bạn gõ;
- **Lolly URL Screenshot** tải địa chỉ bạn nhập, và bạn có thể theo dõi việc đó.

Công cụ khai báo khả năng truy cập mạng chỉ được tải từ các máy chủ có trong danh sách cho phép của bản kê, và khi kiểm tra không thành công thì quyền truy cập bị chặn. Hiện không có công cụ được phát hành nào khai báo khả năng này, nên Content-Security-Policy do trình duyệt thực thi giới hạn danh sách bên trên ở các máy chủ tương ứng. [Chính sách quyền riêng tư](/info/privacy.html) có bảng chuẩn liệt kê tất cả những trường hợp này, bao gồm lưu lượng của hệ thống được quản lý như làm mới chính sách và báo cáo đã bật.
:::

<!--i:eti-code-->
## Từ terminal

**6. Điểm cuối kết xuất chỉ trả về dữ liệu công khai.** Tính năng máy chủ duy nhất đưa đầu vào đã nhập vào URL, kết xuất qua liên kết trực tiếp, đang hoạt động ở đây. [Chính sách quyền riêng tư](/info/privacy.html) nêu điều đó có nghĩa gì với đầu vào bạn đặt trong liên kết.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Mỗi bản triển khai tự chọn (`LOLLY_DISABLE_RENDER_GET=1`): trên hệ thống đặt biến này, cùng phép kiểm tra trả về `404`. Khác biệt đó cho thấy cài đặt đang có tác dụng, không phải sự thiếu nhất quán.

**7. Kiểm tra các dịch vụ mà bản triển khai của bạn bật.** [Bề mặt máy chủ](/info/server-surface.html) liệt kê các dịch vụ tùy chọn và liên kết đến tài liệu tham khảo chi tiết của chúng. Với Lolly Work, hãy bao gồm API có xác thực, kết nối cộng tác, lưu trữ và nhà cung cấp đã cấu hình. Kiểm tra lolly.tools công khai không kiểm thử hệ thống riêng của tổ chức.

Nếu bạn tự chạy một hệ thống, [Triển khai bàn giao](/info/deploy-delivery.html) có các kiểm tra phát hành: tính toàn vẹn mô hình, phép kiểm tra tại biên và danh sách mẫu, các bản kết xuất để hiển thị, cổng tải xuống riêng tư và danh mục đã ký trong trình duyệt.


<!--i:eti-search-->
## Trong mã nguồn

Tất cả những điều trên vẫn có thể chỉ là màn trình diễn nếu mã được triển khai khác với mã công khai. Vì vậy hãy kiểm tra mã. Bản triển khai được dựng từ [kho mã công khai](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Không có trình theo dõi và SDK phân tích ở bất cứ đâu.** Tìm trong mã được phát hành (bộ máy, mọi lớp vỏ bao gồm tiện ích mở rộng trình duyệt, các phần ghi đè cầu nối Tauri và service worker, các hàm máy chủ và gói công cụ) những thành phần thường gặp:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Lần quét này tìm SDK theo dõi của bên thứ ba. Nó không chứng minh rằng không có báo cáo sử dụng của bên thứ nhất: Lolly Work hỗ trợ dữ liệu đo lường của tổ chức và nhật ký kiểm toán riêng, với chính sách và kiểm thử riêng.

**9. Không có trình phân giải DNS của bên thứ ba.** Kiểm tra SEAL của Lolly Verify không bao giờ gửi truy vấn qua nhà cung cấp DNS-over-HTTPS, vì ứng dụng không có trình phân giải:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Dịch vụ chứng chỉ không giữ nhật ký cấp chứng chỉ.** CA định danh không giữ nhật ký về những gì đã cấp và không lưu danh sách định danh: không có dòng stdout, webhook hay kho chứng chỉ. Có thể tìm kiếm để kiểm tra sự vắng mặt đó:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

CA có giữ trạng thái làm việc ngắn hạn: các bộ đếm giới hạn tốc độ lưu khóa IP và email đã băm trong cửa sổ thời gian của chúng, và kho tiếp nhận của bản triển khai được quản lý giữ một định danh có khóa cùng giá trị băm của yêu cầu trong tối đa mười phút. [Kỹ thuật Content Credentials](/info/content-credentials-engineering.html#protocol) có thông tin chi tiết.

<!--i:eti-flask-->
## Được thực thi bằng kiểm thử

Các kiểm tra mã nguồn bên trên không phải kiểm toán một lần: chúng được cố định trong bộ kiểm thử, nên không thể âm thầm mất tác dụng. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) kiểm tra danh sách tên trình theo dõi dài hơn lần quét bên trên và làm quá trình dựng thất bại nếu:

- bất kỳ SDK phân tích hoặc theo dõi nào xuất hiện ở bất cứ đâu trong mã nguồn được phát hành mà nó quét, trên mã ứng dụng, bộ máy, máy chủ, tiện ích mở rộng và gói công cụ;
- bất kỳ trình phân giải DNS-over-HTTPS của bên thứ ba nào xuất hiện trong mã nguồn đó;
- nhật ký cấp chứng chỉ CA xuất hiện trở lại trong mã nguồn **hoặc** gói máy chủ được tạo;
- chính sách quyền riêng tư mất các tuyên bố pháp luật yêu cầu (bên kiểm soát được nêu tên, cơ sở pháp lý, quyền khiếu nại).

Tự chạy chúng trong bản sao kho mã (Node 22.18 trở lên; tệp này không cần `pnpm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Bộ kiểm thử đầy đủ (`pnpm install && pnpm test`) chạy thêm vài nghìn kiểm thử, bao gồm các kiểm thử mật mã đối kháng được mô tả trong [Bảo mật & Xác minh](/info/security.html).

<!--i:eti-eye-off-->
## Những gì bạn không thể xác minh từ bên ngoài

- **Nhật ký truy cập máy chủ lưu trữ.** Mọi máy chủ đều có thể ghi lại các yêu cầu nó trả lời: địa chỉ IP, đường dẫn và thời gian. Phép kiểm tra từ bên ngoài không thể xác định nhật ký được giữ trong bao lâu. Đơn vị vận hành kiểm soát việc ghi, luân chuyển và xuất nhật ký, và phải công bố các lựa chọn đó. Kết xuất cục bộ giữ các chỉnh sửa thông thường trên thiết bị của bạn; kết xuất máy chủ tùy chọn và dịch vụ không gian làm việc dùng chung có các luồng dữ liệu riêng được mô tả trong chính sách quyền riêng tư.
- **Bản triển khai chạy mã này.** Bạn có thể kiểm tra mã nguồn không có thành phần không mong muốn và hành vi đã triển khai khớp với mã nguồn, và các kiểm tra bên trên làm cả hai việc. Nền tảng web không cung cấp chứng thực ở cấp mã nhị phân cho bản triển khai web. Các biện pháp giảm thiểu là kho mã công khai, kiểm thử bắt buộc và kiểm tra ngoại tuyến: bản triển khai bị can thiệp mà liên lạc về máy chủ sẽ trượt ngay cả kiểm tra 1 lẫn 2.
- **Hook của công cụ.** Logic tùy chọn của công cụ tích hợp được rà soát thay vì chạy trong môi trường cách ly: nó chạy trong trang trừ khi công cụ chọn chạy trong Worker. Mọi công cụ trên lolly.tools đều do bên thứ nhất cung cấp và được rà soát trước khi phát hành. [Mô hình mối đe dọa](/info/threat-model.html#trust-boundaries) nêu nơi hook chạy và điều gì giới hạn chúng.

<!--i:eti-warning-->
## Nếu một kiểm tra thất bại

Khác biệt giữa trang này và những gì bạn quan sát được là nội dung cần báo cáo về bảo mật. Hãy gửi qua các kênh riêng tư trên [Bảo mật & Xác minh](/info/security.html#reporting-a-vulnerability). Chúng tôi thực hiện công bố có phối hợp và ghi nhận người báo cáo.
