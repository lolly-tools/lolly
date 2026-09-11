# Chính sách quyền riêng tư

*Cập nhật lần cuối: 11 tháng 8 năm 2026*

> **Phiên bản ngắn gọn.** Các tài liệu, hình ảnh, video và tệp bạn tạo trong Lolly luôn
> ở lại trên thiết bị của bạn. Không có tài khoản cho việc sử dụng thông thường, không có cookie từ
> chính ứng dụng và không có bất kỳ phân tích hay trình theo dõi nào trong mã nguồn - không phải kiểu "chúng tôi
> không dùng dữ liệu đó," mà thực sự không tồn tại trong mã nguồn. Có một danh sách ngắn gọn, đầy đủ về
> các trường hợp ngoại lệ khi phần mềm có giao tiếp với mạng, và mỗi
> trường hợp đều được mô tả chi tiết bên dưới: những gì rời đi, đến ai và khi nào. Ngoại lệ
> duy nhất liên quan đến bất kỳ điều gì mang tính cá nhân là việc đăng nhập mà bạn phải chủ động
> bắt đầu. Nếu điều đó không có trong tài liệu này, nó sẽ không xảy ra.

## Chính sách này bao gồm những gì

Lolly là phần mềm mã nguồn mở - một engine, nhiều lớp vỏ ứng dụng (web, desktop,
mobile, CLI) và một tiện ích mở rộng trình duyệt - mà bất kỳ ai cũng có thể chạy. Chính sách này có hai
phần:

- <!--i:code--> **Bản thân phần mềm**: nó làm gì và không làm gì với dữ liệu của bạn, dù chạy ở
  đâu. Đây là một đặc tính của mã nguồn, nên đúng với mọi bản triển khai Lolly,
  của chúng tôi hay của bất kỳ ai khác.
- <!--i:server--> **lolly.tools**, bản triển khai tham chiếu do SUSE vận hành: các lựa chọn cụ thể
  khi chạy các thành phần phía máy chủ tùy chọn của nó (ghi log những gì, trong bao lâu, bởi
  ai).

Nếu bạn đang dùng một thực thể Lolly tự lưu trữ hoặc dành cho doanh nghiệp, hành vi phần mềm
bên dưới vẫn áp dụng, nhưng *bên vận hành* thực thể đó - không phải SUSE - chịu
trách nhiệm về bất kỳ phần nào phía máy chủ: điểm cuối render của họ, máy chủ MCP của họ,
cơ quan cấp chứng chỉ Content Credentials của họ, nếu họ vận hành một cơ quan như vậy. Hãy hỏi họ về
chính sách riêng của họ. Xem [Áp dụng & Quản trị](/info/adoption-governance.html) để biết
việc vận hành Lolly liên quan đến những gì.

## Ứng dụng: những gì ở lại trên thiết bị của bạn

Các lớp vỏ web, desktop và mobile của Lolly chạy toàn bộ engine render phía
khách. Mở một công cụ, điền dữ liệu đầu vào, xem trước và xuất tệp đều diễn ra trên
thiết bị của bạn - không có máy chủ nào tham gia, và ứng dụng hoạt động ngoại tuyến sau khi đã tải xong.

**Ứng dụng không đặt bất kỳ cookie nào.** Để hoạt động, nó giữ một lượng nhỏ dữ liệu **chỉ
trên thiết bị của bạn**, không bao giờ được truyền đi:

- <!--i:sliders--> **Tùy chọn giao diện** - chủ đề, ngôn ngữ, cài đặt âm thanh, kích cỡ thanh
  bên/thu phóng, lựa chọn sắp xếp và chế độ xem, các mẹo hướng dẫn bạn đã xem - trong
  `localStorage`, để có sẵn trước khi ứng dụng khởi động xong.
- <!--i:download--> **Bộ nhớ đệm ngoại tuyến của danh mục công cụ và ảnh xem trước tài sản**, để thư viện
  hoạt động mà không cần kết nối.
- <!--i:hash--> **Bộ đếm sử dụng cục bộ** cho số liệu thống kê trên thẻ hồ sơ của bạn (bao nhiêu lượt xuất, công cụ
  nào) - một khối dữ liệu nhỏ có giới hạn trong `localStorage`, không bao giờ được chúng tôi đọc, không bao giờ được gửi
  đi đâu cả.
- <!--i:folder--> **Tài liệu của riêng bạn, các phiên đã lưu, tài sản và phông chữ đã tải lên** - được lưu trong
  IndexedDB trên thiết bị của bạn, không bao giờ được tải lên, không bao giờ được ai đọc ngoài bạn.

Không cái nào trong số này được chia sẻ, bán hay dùng để nhận dạng hoặc theo dõi bạn. Không có gì
cần đồng ý, vì không có việc thu thập nào diễn ra - chỉ có thông báo này, để bạn
biết những gì được giữ lại và ở đâu. Xóa toàn bộ bất cứ lúc nào bằng **Hồ sơ → Xóa toàn bộ
dữ liệu của tôi**, hoặc bằng cách xóa bộ nhớ của trang trong trình duyệt của bạn. (Theo Chỉ thị
ePrivacy Điều 5(3), việc lưu trữ thực sự cần thiết cho dịch vụ bạn yêu cầu
không cần sự đồng ý - chỉ cần minh bạch, và đó chính là điều tài liệu này và
thông báo trong ứng dụng cùng thể hiện.)

![Phần lưu trữ của trang hồ sơ trên màn hình rộng bằng điện thoại: mọi hạng mục dữ liệu trên thiết bị được nêu tên, cùng nút Xóa toàn bộ dữ liệu của tôi ngay bên cạnh](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Bản sao lưu dữ liệu của riêng bạn - gói `lolly-backup` được tạo bởi **Xuất dữ liệu
của tôi & render mọi thứ** - là một tệp bạn giữ và kiểm soát. Nó không bao giờ chạm vào máy
chủ của chúng tôi trừ khi bạn tự chọn gửi nó đi đâu đó. Xem [Chuyển dữ liệu](/info/data-transfer.html).

## Tiện ích trên thiết bị

Một số công cụ - **Strip Hidden Data**, **Compress PDF** và những công cụ khác mang
huy hiệu **"Chạy trên thiết bị của bạn"** - hoạt động trên một tệp do bạn cung cấp. Tệp được đọc
vào bộ nhớ trong trình duyệt của bạn, biến đổi cục bộ và cung cấp lại dưới dạng tệp tải xuống.
Nó không bao giờ được tải lên, vì không có máy chủ nào trong luồng xử lý để tải lên. Các
tiện ích này hoạt động ngoại tuyến, và kết quả của chúng không mang bất kỳ hình mờ hay siêu dữ liệu nào
của chúng tôi - mục đích của phần lớn các công cụ này là loại bỏ & bảo vệ dữ liệu, chứ không phải thêm rủi ro.

![Huy hiệu mà các công cụ này mang: Chạy trên thiết bị của bạn - không có gì được tải lên](/t/url-shot?url=%2F%23%2Ftool%2Fstrip-data&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=.on-device-badge&dark=1&filename=pv-ondevice-badge)

## Khi ứng dụng giao tiếp với mạng, đầy đủ

Bảng dưới đây là danh sách đầy đủ mọi thứ ứng dụng lấy về hoặc gửi đi qua
mạng. Nếu không có ở đây, ứng dụng không làm điều đó.

| Gì | Điều gì thực sự rời khỏi thiết bị của bạn | Khi nào (hành động kích hoạt điều đó) | Nếu quản trị viên chặn nó |
|---|---|---|---|
| Đồng bộ danh mục công cụ | Không có gì mang tính cá nhân - một yêu cầu lấy chỉ mục công cụ và tài sản công khai của chính Lolly, gửi đến chính máy chủ gốc của ứng dụng | Khi khởi động, sau đó được lưu đệm để dùng ngoại tuyến | Ứng dụng chạy trên bộ công cụ đã lưu đệm. Nó chỉ ngừng phát hiện công cụ mới |
| Một công cụ cần dữ liệu trực tiếp | Bất kỳ điều gì công cụ cụ thể đó yêu cầu, gửi đến máy chủ được nêu tên ngay trong mô tả của nó. Hiện tại đó chỉ là tra cứu thành phố trong công cụ Meeting Planner, gọi đến `geocoding-api.open-meteo.com` để chuyển tên thành phố thành tọa độ và múi giờ - không tài khoản, không khóa và không định danh nào ngoài chính yêu cầu đó. Trường nhập liệu ghi rõ điều này ngay tại nơi bạn gõ, và mỗi câu trả lời được lưu trên thiết bị của bạn để một thành phố chỉ được tra cứu một lần | Chỉ khi đang dùng công cụ đó, và chỉ khi bạn nhập một địa điểm | Riêng lượt tra cứu đó thất bại. Bạn vẫn có thể gõ tọa độ bằng tay, và không gì khác bị ảnh hưởng |
| Google Fonts | Tên họ phông chữ đã chọn và địa chỉ IP của bạn, gửi đến máy chủ phông chữ của Google (`fonts.googleapis.com` cho stylesheet, `fonts.gstatic.com` cho tệp phông chữ) | Chỉ khi bạn thêm một Google Font trong trình chỉnh sửa thương hiệu, **và chỉ sau khi bạn đồng ý trong một hộp thoại ghi đúng nội dung này** - tải về một lần cho mỗi họ phông, sau đó nó nằm trên thiết bị của bạn và được dùng ngoại tuyến | Bộ chọn Google Fonts sẽ tắt hẳn (fail closed). Hãy tải lên một tệp phông chữ thay thế |
| Gửi đến Google Drive | Chỉ một tệp bạn chọn để gửi, đến Google Drive API (`www.googleapis.com`), sau khi bạn đăng nhập Google hoàn tất trong cửa sổ popup riêng của Google. Quyền truy cập của Lolly giới hạn ở các tệp do nó tạo ra (phạm vi `drive.file` - nó không bao giờ đọc được phần còn lại trong Drive của bạn), và mã đăng nhập chỉ được giữ trong bộ nhớ cho phiên làm việc, không bao giờ được lưu trữ | Chỉ khi bạn nhấn "Send to Google Drive" trên một tệp xuất EMF, và chỉ trên các bản dựng mà quản trị viên đã cấu hình một client id của Google - nếu không có, nút này không tồn tại | Nút này không bao giờ xuất hiện. Hãy tự tải tệp về và tải lên Drive |
| Gửi đến Dropbox | Chỉ một tệp bạn chọn để gửi, đến API của Dropbox (`api.dropboxapi.com` cho đăng nhập và metadata, `content.dropboxapi.com` cho chính tệp), sau khi bạn đăng nhập Dropbox hoàn tất trong cửa sổ riêng của Dropbox. Quyền truy cập của Lolly chỉ giới hạn trong thư mục ứng dụng (nó chỉ có thể thấy `Apps/` và thư mục riêng của nó trong đó - không bao giờ thấy phần còn lại trong Dropbox của bạn), liên kết "Open" mà nó hiển thị cho bạn là một liên kết riêng tư có thời hạn ngắn (không tạo chia sẻ công khai nào), và mã làm mới chỉ được lưu trữ nếu bạn tick chọn "stay connected" | Chỉ khi bạn nhấn "Send to Dropbox" trên một tệp, và chỉ trên các bản dựng mà quản trị viên đã cấu hình một client id của Dropbox - nếu không có, nút này không tồn tại | Nút này không bao giờ xuất hiện. Hãy tự tải tệp về và tải lên Dropbox |
| Gửi đến OneDrive | Chỉ một tệp bạn chọn để gửi, đến các dịch vụ định danh và Graph của Microsoft (`login.microsoftonline.com` cho đăng nhập, `graph.microsoft.com` cho việc tải lên; một tệp lớn được tải lên theo từng phần đến một địa chỉ tải lên do Microsoft sở hữu trên `api.onedrive.com`, `*.up.1drv.com` hoặc `*.sharepoint.com`), sau khi bạn đăng nhập Microsoft hoàn tất trong cửa sổ riêng của Microsoft. Quyền truy cập của Lolly giới hạn trong thư mục riêng của nó dưới `Apps/` (nó không bao giờ đọc được phần còn lại trong OneDrive của bạn) cộng với tên hiển thị của bạn dùng cho nhãn tài khoản, và mã làm mới chỉ được lưu trữ nếu bạn tick chọn "stay connected" | Chỉ khi bạn nhấn "Send to OneDrive" trên một tệp, và chỉ trên các bản dựng mà quản trị viên đã cấu hình một client id của Microsoft - nếu không có, nút này không tồn tại | Nút này không bao giờ xuất hiện. Hãy tự tải tệp về và tải lên OneDrive |
| Gửi đến LinkedIn | Chỉ một tệp bạn chọn để gửi, cùng tên của nó làm nội dung bài đăng, đến LinkedIn (`www.linkedin.com` cho đăng nhập, `api.linkedin.com` cho việc tải lên và đăng bài), sau khi bạn đăng nhập LinkedIn hoàn tất ngay trong trình duyệt của bạn. Bài đăng xuất hiện trên chính dòng thời gian của bạn dưới dạng bài đăng công khai mang tên bạn. Lolly có thể đăng bài dưới tên bạn và đọc tên bạn để dùng làm nhãn tài khoản, không gì khác trên LinkedIn của bạn, và thông tin đăng nhập chỉ được giữ lại trên thiết bị này nếu bạn tick chọn "stay connected" - mã của LinkedIn có hạn 60 ngày và không thể tự động gia hạn ngầm, nên nó tự hết hạn | Chỉ khi bạn nhấn "Send to LinkedIn" trên một tệp, chỉ trong các ứng dụng desktop, và chỉ trên các bản dựng có cấu hình một ứng dụng LinkedIn - nếu không có, nút này không tồn tại | Không có gì cần chặn trong ứng dụng web: tính năng này chỉ tồn tại trong **các ứng dụng desktop**, nên hai máy chủ đó cố tình KHÔNG có mặt trong Content-Security-Policy của ứng dụng web bên dưới. Trong các ứng dụng desktop, hãy gỡ bỏ ứng dụng LinkedIn đã cấu hình và nút này sẽ không bao giờ xuất hiện |
| Hồ sơ in ICC | Không có gì mang tính cá nhân - một yêu cầu lấy hồ sơ điều kiện in chuẩn, gửi đến sổ đăng ký công khai của ICC (`registry.color.org`, `www.color.org`) | Chỉ khi bạn nhấp vào một cài đặt sẵn ICC trong trình quản lý hồ sơ in - tải về một lần cho mỗi hồ sơ, sau đó nó nằm trên thiết bị của bạn | Các cài đặt sẵn ICC sẽ không hoạt động. Hãy cung cấp hồ sơ `.icc` của riêng bạn thay thế |
| Radio Internet | Không có gì mang tính cá nhân - một yêu cầu danh sách phát và một luồng âm thanh, gửi đến đài (`api.somafm.com` và máy chủ icecast mà nó nêu tên, `*.somafm.com`) | Chỉ khi bạn phát radio tích hợp tùy chọn trong trình phát âm thanh | Radio sẽ không hoạt động. Mọi tính năng âm thanh khác vẫn hoạt động bình thường |
| Một URL bạn yêu cầu công cụ chụp lại | Một yêu cầu gửi đến chính địa chỉ web bạn gõ vào, từ công cụ chụp ảnh màn hình URL. Dù địa chỉ đó là gì. Máy chủ này không có trong chính sách bên dưới, vì bạn chọn nó ngay tại thời điểm sử dụng | Chỉ khi bạn nhập một URL vào công cụ đó và bắt đầu chụp | Quản trị viên không thể đưa vào danh sách cho phép theo máy chủ. Để loại bỏ nó, hãy gỡ bỏ công cụ |
| Kiểm tra chữ ký SEAL | **Không có gì.** Ứng dụng web hoàn toàn không có bộ phân giải DNS - xem bên dưới | Không bao giờ | Không có gì cần chặn |
| Mô hình AI trên thiết bị | Không có gì mang tính cá nhân - một lượt tải tệp mô hình một lần từ máy chủ mô hình của Lolly (`lolli.li`), sau đó được lưu đệm trên thiết bị của bạn; không tài khoản, không định danh, chỉ có yêu cầu và IP của bạn | Chỉ khi bạn dùng một tính năng cần đến mô hình (quét sâu Verify, phóng to ảnh, giọng nói, và tương tự) | Tính năng đó chờ tải xong; mọi thứ khác vẫn hoạt động bình thường |
| Instance từ xa | Bất kỳ điều gì instance bạn nêu tên trả về, qua cùng cơ chế đồng bộ danh mục đã mô tả ở trên - cộng với một nhãn phiên bản trên các yêu cầu gửi đến nó (loại shell và phiên bản engine, cùng loại thông tin mà một user agent mang theo), để quản trị viên của nó có thể thấy những phiên bản Lolly nào đang được dùng thực tế. Trên một instance được quản lý, khi bạn đã đăng nhập, nhãn đó còn mang theo một id cài đặt riêng cho từng thiết bị để danh sách thiết bị của quản trị viên có thể phân biệt lượt cài đặt này. Nó chỉ đi kèm các yêu cầu mà việc sử dụng của chính bạn vốn đã tạo ra - không có bộ đếm giờ và không có gì tự động gọi về - và rời khỏi instance sẽ xóa id đó, nên một thiết bị kết nối lại sau này sẽ xuất trình một id mới. Bạn chọn máy chủ ngay tại thời điểm sử dụng, nên nó không có trong chính sách bên dưới | Chỉ khi bạn chủ động trỏ shell đến một triển khai Lolly khác | Việc chuyển instance sẽ thất bại. Instance cục bộ của bạn không bị ảnh hưởng |

Mọi máy chủ cố định trong bảng đó cũng là toàn bộ danh sách cho phép trong Content-Security-Policy của ứng dụng, thứ mà trình duyệt thực thi. Vì vậy danh sách này không chỉ là một mô tả về những gì mã nguồn làm hôm nay, nó là ranh giới mà trình duyệt buộc ứng dụng phải tuân theo: một thay đổi trong tương lai cố liên hệ với một máy chủ khác sẽ bị chặn, chứ không được âm thầm cho qua. Một hàng là ngoại lệ có chủ đích, và chính ô của nó đã nói rõ điều đó: Send to LinkedIn chỉ tồn tại trong các ứng dụng desktop, nên chính sách của ứng dụng web không nêu tên bất kỳ máy chủ nào trong hai máy chủ đó - ứng dụng web sẽ không thể liên hệ được chúng dù mã nguồn của nó có cố thử. Hai hàng khác không có máy chủ cố định, vì bạn chọn địa chỉ ngay tại thời điểm sử dụng: một URL bạn yêu cầu công cụ chụp lại, và một instance từ xa bạn trỏ shell đến. Cả hai đều không có trong chính sách, và mỗi trường hợp chỉ xảy ra khi bạn gõ một địa chỉ và thực hiện hành động với nó. Một triển khai không muốn dùng bất kỳ tùy chọn nào trong số đó (chẳng hạn một instance doanh nghiệp với phông chữ riêng) sẽ loại các máy chủ đó khỏi chính sách của mình, và các tính năng tương ứng sẽ ngừng hoạt động thay vì cố liên hệ ra ngoài.

Không cái nào trong số này gửi tài liệu, dự án, phiên làm việc hay tệp đã tải lên của bạn đi đâu cả.
Chúng tồn tại để mang mọi thứ *đến* thiết bị của bạn (công cụ, phông chữ, mô hình), không bao giờ để gửi
mọi thứ *đi từ* thiết bị, ngoại trừ các trường hợp được nêu rõ ràng trong các phần bên dưới.

**Một lưu ý về những gì chúng tôi đã loại bỏ.** Verify có thể kiểm tra chữ ký SEAL, một cơ chế mà
khóa ký của tệp được công bố trong DNS. Trình duyệt không thể thực hiện truy vấn DNS, nên bất kỳ
triển khai web nào cũng phải định tuyến việc tra cứu qua một trình phân giải DNS-over-HTTPS của
bên thứ ba - điều này sẽ cho bên vận hành đó thấy tên miền đang được kiểm tra cộng với địa chỉ IP
của bạn. Trước đây chúng tôi từng dùng của Cloudflare. **Chúng tôi không dùng nữa, và không có
sự thay thế nào**: giờ đây ứng dụng web không truyền bất kỳ trình phân giải nào cả, nên xác minh SEAL
ở đây không tạo ra bất kỳ yêu cầu mạng nào. Các tệp có bản ghi SEAL mang khóa nội tuyến
vẫn xác minh hoàn toàn ngoại tuyến. Các tệp có khóa nằm trong DNS sẽ báo "no key
resolver" thay vào đó, và bạn có thể kiểm tra các tệp đó trong ứng dụng desktop hoặc dòng lệnh,
nơi phân giải DNS trực tiếp qua chính máy của bạn mà không có bên thứ ba nào
tham gia.

![Màn hình Verify: một vùng thả tệp và không gì khác - tệp được kiểm tra ngay tại nơi nó đang có, không tải lên và không tài khoản](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop) Bạn có thể tự xác nhận điều này: các kiểm tra có thể grep được cho tuyên bố này và
mọi tuyên bố khác trên trang này, cùng các lệnh chính xác và kết quả mong đợi, có tại
[Tự Xác Minh](/info/verify-yourself.html).

## URL render liên kết trực tiếp

> **Đang hoạt động trên lolly.tools.** Mọi
> URL `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>` đều render thật sự,
> và các dữ liệu đầu vào đi cùng ngay trong URL đó. Phần bên dưới nói rõ điều đó
> có ý nghĩa gì với bạn, và một bên vận hành có thể tắt tính năng này trên instance riêng của họ.

Bản thân ứng dụng ở lại hoàn toàn trên thiết bị của bạn. Riêng biệt, một bên vận hành có thể bật
**URL render liên kết trực tiếp** - `/tool/<tool-id>.<ext>?<inputs>` - để một liên kết Lolly được
chia sẻ có thể xuất hiện như một hình ảnh sống trong README, wiki hay bảng điều khiển. Việc lấy về
một liên kết như vậy yêu cầu máy chủ render **dữ liệu công cụ và danh mục công khai** với các dữ liệu đầu vào được
ghi trong URL.

- <!--i:usercheck--> **Không tài khoản, không cookie, không trạng thái.** Endpoint này ẩn danh, và không có gì
  trên thiết bị của bạn bị đọc. Tài liệu, phiên làm việc và tệp tải lên của bạn không bao giờ rời khỏi
  trình duyệt của bạn - chúng hoàn toàn không thể xuất hiện trong các liên kết này.
- <!--i:document--> **Nhưng chính URL lại được ghi lại.** Chuỗi truy vấn của một URL là một phần của dòng
  yêu cầu, nên nó xuất hiện trong nhật ký truy cập thông thường của nền tảng lưu trữ, giống như
  mọi đường dẫn được yêu cầu khác. Nếu đầu vào của một liên kết chứa tên hoặc email của ai đó -
  một thẻ tên, một chữ ký email - **văn bản đó sẽ nằm trong những nhật ký đó**, và không
  câu chữ chính sách nào có thể thay đổi điều đó. Vì vậy một URL liên kết trực tiếp
  không phải là nơi để đặt thông tin cá nhân: chỉ nên đưa vào đó những gì bạn sẵn sàng đặt trên một trang công khai.
- <!--i:globe--> **Các đầu vào vốn đã công khai theo bản chất** dù sao đi nữa - chúng là bất cứ điều gì tác giả
  của liên kết đã nhập vào URL, ai nhận được liên kết cũng đọc được. Đừng đặt
  bí mật vào một liên kết được chia sẻ. Lolly cung cấp mã hóa liên kết cho nội dung nhạy cảm.
- <!--i:eyeoff--> Các phản hồi được **lưu vào bộ nhớ đệm và giới hạn tốc độ** giống như bất kỳ hình ảnh công khai nào, và được đánh dấu
  `noindex` để công cụ tìm kiếm không lập chỉ mục các bản kết xuất của bạn.

Tự lưu trữ Lolly và không muốn một bề mặt render công khai? Đặt
`LOLLY_DISABLE_RENDER_GET=1` và mọi
URL trong số này sẽ trả về 404.

## Máy chủ MCP (tùy chọn, dành cho các tác nhân AI)

Lolly cũng có thể được một tác nhân AI truy cập qua Model Context Protocol - một
điểm cuối do bên vận hành chạy (lolly.tools chạy một điểm cuối như vậy; bất kỳ ai cũng có thể tự lưu trữ riêng,
kể cả hoàn toàn cách ly mạng). Nó chia sẻ lập trường không tài khoản của luồng render, cộng thêm
ba công cụ tất yếu phải xử lý byte tệp:

- <!--i:cpu--> **`lolly_transform`** (chạy một tiện ích trên thiết bị ở phía máy chủ, thay mặt cho
  tác nhân gọi), **`lolly_verify`** (kiểm tra Content Credentials) và **`lolly_redact`**
  (che các vùng của một hình ảnh hoặc PDF) đều nhận
  byte của một tệp từ bên gọi. Chúng được xử lý **trong tiến trình, trong bộ nhớ**,
  và kết quả được trả về ngay trong cùng lệnh gọi đó - tệp không bao giờ được ghi vào
  đĩa và không bao giờ được lưu trữ sau khi yêu cầu hoàn tất.
- <!--i:checklist--> Mọi công cụ khác - `lolly_render`, `lolly_build_url`, `lolly_list_tools`,
  `lolly_describe_tool` - chỉ hoạt động từ các tham số (văn bản, số, màu sắc,
  URL, id tài sản danh mục), cùng các dữ liệu đầu vào mà một URL render liên kết trực tiếp nhận.
- <!--i:lock--> Quyền truy cập là hoặc một token dùng chung mà bên vận hành cấp cho các ứng dụng khách họ tin
  tưởng, hoặc OAuth 2.1 không trạng thái: các token đã ký có thời hạn ngắn được xác minh dựa trên
  một bí mật dùng chung, không có gì được lưu trữ phía máy chủ và chính token không bao giờ được ghi vào
  nhật ký hay một URL render.

## Danh tính Content Credentials (một lượt đăng nhập bạn phải tự khởi tạo)

Lolly có thể niêm phong một **Content Credential** mã hóa vào các tệp xuất của bạn để bất kỳ ai
cũng có thể xác minh, ngoại tuyến, rằng một tệp không bị thay đổi kể từ khi rời khỏi Lolly. Điều đó
**bật theo mặc định và hoàn toàn cục bộ** - khóa ký được tạo ra trên thiết bị của bạn
và việc ký diễn ra ngoại tuyến. Nếu không đăng ký, khóa đó chỉ dùng một lần:
một cặp khóa mới được đúc cho mỗi lần xuất và bị loại bỏ cùng với tệp đó. Khi bạn đăng ký,
khóa trở thành một khóa lâu dài và được tạo ra ở dạng **không thể trích xuất** - ngay cả mã nguồn
của chính Lolly cũng không thể đọc nó, chỉ có thể yêu cầu nó ký. Dù thế nào, nó cũng không bao giờ rời khỏi
thiết bị của bạn. Phần này đề cập đến bước duy nhất *tùy chọn* thêm vào đó:
đăng ký một danh tính đã xác minh, để các tệp xuất của bạn ghi "Verified - signed by
\<your email\>" thay vì một khóa ẩn danh. **Nếu bạn bỏ qua việc đăng ký, không gì trong
phần này áp dụng cho bạn, và không có dữ liệu cá nhân nào rời khỏi thiết bị của bạn.**

![Thẻ danh tính Verified trên trang hồ sơ, độ rộng điện thoại: bộ chọn thời hạn chứng chỉ và bước đăng ký bên dưới, không hoạt động cho đến khi bạn tự khởi động nó](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Nếu bạn đăng ký, đây là chính xác những gì xảy ra:

1. **Bạn chọn một phương thức đăng nhập** - GitHub, Google, SUSE (id.suse.com) hoặc một
   liên kết gửi qua email. Với ba nhà cung cấp OIDC, bạn được chuyển hướng đến trang đăng nhập
   riêng của nhà cung cấp đó, chịu sự chi phối của chính sách quyền riêng tư của họ, không phải của chúng tôi.
   Dịch vụ chứng chỉ của Lolly chỉ nhận lại một địa chỉ email đã xác minh và
   tên của nhà cung cấp. Với liên kết email, địa chỉ bạn nhập được chuyển tới
   **Resend**, một API email giao dịch, chỉ nhằm gửi đúng liên kết đó.
2. **Một cookie có thời hạn ngắn bảo vệ việc chuyển hướng.** Đây là cookie duy nhất mà
   toàn bộ hệ thống Lolly đặt: `lolly_ca_state`, `HttpOnly`, giới hạn phạm vi ở `/api/ca`,
   hết hạn trong vòng mười phút. Nó mang một giá trị ngẫu nhiên, không phải một định danh
   theo dõi, và chỉ tồn tại để ngăn việc chuyển hướng OAuth bị giả mạo. Nó được xóa
   ngay khi việc đăng nhập hoàn tất.
3. **Địa chỉ IP của bạn được sử dụng, trong thời gian ngắn, để ngăn chặn lạm dụng** các
   điểm cuối đăng nhập (để một tập lệnh không thể spam một hộp thư hay làm cạn hạn ngạch email) - được giữ
   chỉ trong bộ nhớ máy chủ, trong một cửa sổ trượt khoảng một phút, không bao giờ được ghi
   vào nhật ký hay lưu trữ ở bất cứ đâu.
4. **Dịch vụ chứng chỉ cấp một chứng chỉ có thời hạn ngắn** (7, 30, 90 hoặc 365
   ngày, tùy bạn chọn, giới hạn bởi chính sách của bên vận hành) gắn email đã xác minh của bạn
   với nửa công khai của cặp khóa được tạo trên thiết bị của bạn. Nửa riêng tư không bao giờ
   rời khỏi trình duyệt của bạn.
5. **Không có gì về việc cấp phát được ghi lại.** Dịch vụ chứng chỉ không giữ nhật ký cấp
   phát nào: không email của bạn, không nhà cung cấp, không số sê-ri, không dấu
   thời gian. Không cơ sở dữ liệu, không dòng nhật ký, không webhook. Địa chỉ email của bạn chỉ tồn tại trong
   yêu cầu đủ lâu để được ghi vào chứng chỉ mà chính thiết bị của bạn nhận, và sau đó
   nó biến mất hoàn toàn khỏi phía chúng tôi.
6. **Sau đó, việc ký lại trở nên ngoại tuyến** trong suốt thời hạn của chứng chỉ.
   Xuất một tệp không bao giờ liên hệ với dịch vụ chứng chỉ - chỉ việc đăng ký mới làm vậy.

**Sự đánh đổi, nói thẳng ra.** Một phiên bản trước của dịch vụ này từng ghi nhật ký mỗi
lần cấp phát, để một chứng chỉ bị cấp sai hoặc bị xâm phạm có thể được truy vết. Chúng tôi
đã loại bỏ nó, vì nhật ký đó là nơi duy nhất trong toàn bộ Lolly mà dữ liệu cá nhân
được lưu lại trên một máy chủ, và chúng tôi thà không giữ nó còn hơn giữ nó một cách
cẩn thận. Điều chúng tôi từ bỏ là khả năng truy vết phía máy chủ: nếu một chứng chỉ bị
lạm dụng, chúng tôi không thể tra ra ai đã lấy nó. Các chứng chỉ có thời hạn ngắn theo
thiết kế - 7 đến 365 ngày, tùy bạn chọn, giới hạn bởi bên vận hành - và tự hết hạn theo
thời gian của chúng, đó là biện pháp giảm thiểu mà chúng tôi dựa vào thay thế. Những người tự lưu trữ mà
nghĩa vụ riêng của họ đòi hỏi một nhật ký kiểm toán có thể thêm một nhật ký như vậy, và trở thành bên kiểm soát
dữ liệu đó khi làm vậy.

## Tiện ích mở rộng trình duyệt

Tiện ích mở rộng trình duyệt **Lolly URL Screenshot** không thu thập, lưu trữ hay
truyền bất kỳ dữ liệu cá nhân nào. Không phân tích, không theo dõi, không máy chủ từ xa.

**Nó làm gì.** Khi bạn yêu cầu ứng dụng web Lolly chụp ảnh màn hình một URL, tiện ích
mở rộng mở trang đó trong một thẻ nền tạm thời, chụp nó trong trình duyệt của bạn bằng DevTools
Protocol, trả hình ảnh lại cho ứng dụng và đóng thẻ. Mọi thứ diễn ra cục bộ, trên
thiết bị và mạng của chính bạn.

**Dữ liệu.**

- <!--i:shieldcheck--> **Chúng tôi không thu thập gì cả.** Tiện ích mở rộng không có máy chủ nào và không tạo
  bất kỳ yêu cầu mạng nào của riêng nó.
- <!--i:photos--> **Hình ảnh đã chụp** đi thẳng tới ứng dụng Lolly trong cùng trình duyệt - không bao giờ
  được tiện ích mở rộng tải lên.
- <!--i:link--> **Các URL bạn chụp** chỉ được dùng để tải đúng trang đó cho đúng lần chụp đó. Chúng
  không được ghi nhật ký hay chia sẻ.

**Quyền.**

- <!--i:wrench--> **`debugger`** - để chụp trang đã render qua DevTools Protocol (cùng
  cơ chế mà ứng dụng desktop của Lolly sử dụng).
- <!--i:monitor--> **`tabs`** - để mở và đóng thẻ tạm thời mà trang được tải trong đó.
- <!--i:globe--> **Quyền truy cập máy chủ (`<all_urls>`)** - vì trang bạn chọn để chụp có thể
  ở bất kỳ trang web nào. Chrome hiển thị điều này lúc cài đặt như một cảnh báo quyền
  rộng. Tiện ích mở rộng chỉ bao giờ truy cập đúng URL bạn cung cấp cho nó.

Không quyền nào trong số này được dùng để đọc, giám sát hay truyền hoạt động duyệt web của bạn
vượt ra ngoài lần chụp được yêu cầu đó.

## Nhật ký hạ tầng

Giống như bất kỳ trang web nào, các máy chủ đứng sau lolly.tools - và đứng sau bất kỳ
bản triển khai Lolly nào - đều tạo ra nhật ký truy cập máy chủ web tiêu chuẩn bất cứ khi nào một yêu cầu
đến được chúng: địa chỉ IP, đường dẫn được yêu cầu, dấu thời gian, user agent. Đó là hành vi lưu trữ
cơ bản, không phải điều Lolly thêm vào, và nó không bao giờ chứa
nội dung tài liệu của bạn, vì những tài liệu đó vốn không bao giờ chạm tới một máy chủ ngay từ đầu. Ngoại
lệ chủ ý duy nhất là một tệp bạn chủ động đưa cho một lệnh gọi MCP
`lolly_transform`, `lolly_verify` hoặc `lolly_redact`, được xử lý trong bộ nhớ và không bao giờ
ghi vào đĩa hay nhật ký, như đã mô tả ở trên.

**Mã nguồn của chính Lolly không ghi bất cứ điều gì vào các nhật ký đó.** Máy chủ MCP hoàn toàn không
chứa câu lệnh ghi nhật ký nào. Dịch vụ chứng chỉ chỉ phát ra đúng hai dòng, cả hai đều
khi thất bại và cả hai đều được cố ý loại bỏ thông tin: một mã trạng thái lỗi gửi không kèm
địa chỉ người nhận, và một thông báo lỗi không có stack trace hay URL (một stack có
thể mang theo token đăng ký). Mọi thứ khác trong nhật ký là của nền tảng lưu trữ,
không phải của chúng tôi.

Đối với lolly.tools, việc lưu trữ là Vercel và thời gian giữ nhật ký truy cập theo
các mặc định nền tảng riêng của Vercel cho gói của chúng tôi. Chúng tôi không cấu hình bất kỳ log drain nào,
không xuất nhật ký dài hạn và không có sản phẩm phân tích hay giám sát nào thêm vào. Chúng tôi không giữ bản
sao của các nhật ký này, điều đó cũng có nghĩa là chúng tôi không có cách nào tìm kiếm chúng giúp bạn - xem
[Quyền của bạn](#your-rights).

## Căn cứ pháp lý, thời gian lưu trữ và bên nhận dữ liệu

Hầu như không có gì ở đây cần căn cứ pháp lý, vì hầu như không có gì được xử lý. Để
đầy đủ, đây là toàn bộ danh sách:

| Xử lý | Căn cứ pháp lý (GDPR Art. 6) | Thời gian lưu trữ |
|---|---|---|
| Mọi thứ trên thiết bị của bạn (tài liệu, tùy chọn, bộ nhớ đệm, bộ đếm) | **Hoàn toàn không phải xử lý của chúng tôi** - dữ liệu không bao giờ đến với chúng tôi. Việc lưu trữ trên thiết bị của bạn là cần thiết một cách nghiêm ngặt cho dịch vụ bạn yêu cầu (ePrivacy Art. 5(3)), nên không cần sự đồng ý | Cho đến khi bạn xóa nó |
| Địa chỉ email của bạn trong quá trình đăng ký Content Credentials | **Art. 6(1)(b)**, thực hiện một dịch vụ mà bạn đã yêu cầu rõ ràng | Không lưu trữ. Chỉ tồn tại trong bộ nhớ trong thời gian xử lý yêu cầu |
| Địa chỉ IP của bạn trên các điểm cuối đăng nhập, để giới hạn tốc độ | **Art. 6(1)(f)**, lợi ích hợp pháp của chúng tôi trong việc ngăn chặn lạm dụng một dịch vụ miễn phí và hạn ngạch email của bên thứ ba. Chúng tôi cho rằng điều này vượt qua bài kiểm tra cân bằng vì nó chỉ tồn tại trong bộ nhớ, không bao giờ được ghi lại và bị loại bỏ trong khoảng một phút | ~1 phút, trong bộ nhớ máy chủ, không bao giờ được lưu lại |
| Nhật ký truy cập lưu trữ (IP, đường dẫn, dấu thời gian, user agent) | **Art. 6(1)(f)**, lợi ích hợp pháp của chúng tôi trong bảo mật dịch vụ, ngăn chặn lạm dụng và chẩn đoán lỗi | Mặc định của nền tảng Vercel cho gói của chúng tôi. Chúng tôi không thêm bất kỳ luồng trích xuất hay xuất dữ liệu nào |

**Bên nhận dữ liệu.** Các nhóm bên nhận là: nhà cung cấp lưu trữ của chúng tôi (Vercel
Inc.), và - chỉ khi bạn dùng tùy chọn đăng nhập bằng email - một nhà cung cấp
email giao dịch (Resend). Nếu bạn đăng nhập bằng GitHub, Google hoặc SUSE (id.suse.com), bạn
tương tác trực tiếp với nhà cung cấp đó theo chính sách quyền riêng tư của họ. Họ cho
chúng tôi biết một địa chỉ email đã xác minh và không gì khác. Chúng tôi không chia sẻ dữ liệu cá nhân với bất kỳ ai
khác, và chúng tôi không bán dữ liệu, không chạy quảng cáo hay lập hồ sơ người dùng.

**Chuyển giao ngoài EEA.** Vercel và Resend là các công ty Mỹ. Năng lực tính toán
cho lolly.tools được cố định tại khu vực Frankfurt (`fra1`) của Vercel nên
việc xử lý diễn ra tại EU, nhưng vì là các nhà cung cấp có trụ sở tại Mỹ, họ vẫn có thể
truy cập dữ liệu với tư cách bên xử lý từ Mỹ. Những lần chuyển giao đó dựa trên Các điều khoản hợp đồng
tiêu chuẩn của Ủy ban Châu Âu và/hoặc Khung quyền riêng tư dữ liệu EU-US, như quy định trong thỏa thuận
xử lý dữ liệu của mỗi nhà cung cấp. Vì dữ liệu cá nhân đến được với một trong hai
nhà cung cấp là rất hạn chế - một địa chỉ email được chuyển tiếp để gửi một tin nhắn,
và nhật ký truy cập thông thường - mức độ phơi nhiễm tương ứng là nhỏ.

**Ra quyết định tự động.** Không có. Không có việc lập hồ sơ và không có quyết định
tự động nào tạo ra hiệu lực pháp lý hoặc tương tự đáng kể (Art. 22).

## Quyền riêng tư của trẻ em

Lolly không cố ý thu thập thông tin cá nhân từ bất kỳ ai, ở bất kỳ độ tuổi nào, trong
quá trình sử dụng ứng dụng thông thường - vì không có gì để thu thập. Nơi duy nhất mà
thông tin cá nhân (một địa chỉ email) từng được thu thập là quá trình đăng ký Content Credentials,
được mô tả ở trên, vốn không nhắm đến hay dành cho trẻ em.

## Quyền của bạn

Vì hầu hết mọi thứ Lolly chạm vào chỉ được lưu trên chính thiết bị của bạn, hầu hết những gì
luật bảo vệ dữ liệu gọi là "quyền của bạn" - truy cập, chỉnh sửa, xóa,
khả năng di chuyển dữ liệu - là những việc bạn đã có thể tự làm ngay lập tức, mà không cần hỏi
ai: dữ liệu của bạn nằm trong bộ nhớ trình duyệt, ở dạng bạn có thể kiểm tra, xuất
(**Xuất dữ liệu của tôi & render mọi thứ**, ở trên) hoặc xóa (**Hồ sơ → Xóa toàn bộ
dữ liệu của tôi**).

Về mặt chính thức, theo Điều 15-22 GDPR bạn có quyền **truy cập** dữ liệu cá nhân của mình,
**chỉnh sửa** nó, **xóa** nó, **hạn chế** hoặc **phản đối**
việc xử lý dữ liệu đó (bao gồm phản đối bất cứ điều gì chúng tôi dựa trên lợi ích hợp
pháp), quyền **di chuyển dữ liệu** và - khi việc xử lý dựa trên sự đồng ý - quyền
**rút lại sự đồng ý đó bất cứ lúc nào**, mà không ảnh hưởng đến tính hợp pháp của những gì
đã diễn ra trước khi bạn rút lại.

Đây là lập trường trung thực về việc thực thi các quyền đó với chúng tôi. Vì chúng tôi không còn
lưu nhật ký cấp phát, **chúng tôi không giữ bất kỳ dữ liệu cá nhân nào về bạn mà chúng tôi có thể tra cứu,
chỉnh sửa, xuất hoặc xóa.** Nếu bạn viết thư hỏi chúng tôi có gì về bạn, câu trả lời
trung thực là không có gì, và chúng tôi sẽ nói như vậy. Loại duy nhất tồn tại là nhật ký truy cập
lưu trữ gắn với địa chỉ IP, do nhà cung cấp lưu trữ của chúng tôi giữ theo mặc định lưu trữ của họ.
Chúng tôi không có cơ chế để tìm kiếm hoặc xóa chọn lọc những dữ liệu đó, và chúng tôi sẽ nói với bạn điều đó
thay vì giả vờ khác đi. Mọi thứ thực sự là *của bạn* nằm trên thiết bị của bạn, nơi bạn đã có thể đọc, xuất
và xóa nó mà không cần xin phép ai.

**Bạn có quyền khiếu nại.** Nếu bạn cho rằng chúng tôi đã xử lý dữ liệu của bạn
không đúng cách, bạn có thể nộp đơn khiếu nại với một cơ quan giám sát bảo vệ
dữ liệu - tại EU, cơ quan tại quốc gia bạn cư trú, nơi làm việc
hoặc nơi bạn cho rằng vi phạm đã xảy ra (Art. 77). Cơ quan giám sát chính của chúng tôi là *Bayerisches
Landesamt für Datenschutzaufsicht* (BayLDA) tại Ansbach, Đức. Bạn không cần liên hệ với chúng tôi
trước, dù chúng tôi muốn có cơ hội khắc phục vấn đề.

Chúng tôi không bán dữ liệu. Chúng tôi không có gì để bán.

## Thay đổi đối với chính sách này

Ngày ghi ở đầu trang thay đổi mỗi khi tài liệu này thay đổi. Một thay đổi làm biến đổi
những gì rời khỏi thiết bị của bạn hoặc những gì được lưu trữ sẽ có dòng riêng ở đây, không phải chỉnh sửa
âm thầm - nếu bạn muốn xem điều gì đã thay đổi, hãy hỏi (bên dưới) hoặc so sánh với
[nguồn công khai](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

## Ai chịu trách nhiệm, và cách liên hệ với chúng tôi

**Bên kiểm soát dữ liệu** cho lolly.tools là:

> SUSE Software Solutions Germany GmbH
> Frankenstraße 146
> 90461 Nürnberg
> Germany

SUSE đã chỉ định một **Nhân viên bảo vệ dữ liệu**, có thể liên hệ tại
[privacy@suse.com](mailto:privacy@suse.com). Dùng địa chỉ đó cho bất kỳ yêu cầu chính thức nào
theo mục "Quyền của bạn" ở trên.

Về bất cứ điều gì liên quan đến Lolly - cách nó hoạt động, tại sao một thứ lại như vậy hoặc
một chỉnh sửa cho tài liệu này - hãy liên hệ **Andy Fitzsimon**,
[fitzy@suse.com](mailto:fitzy@suse.com).

Đối với một thực thể Lolly tự lưu trữ hoặc dùng cho doanh nghiệp, hãy liên hệ với người vận hành
thay thế: bên vận hành là bên kiểm soát cho việc triển khai của riêng họ. SUSE và dự án
Lolly mã nguồn mở không giữ bất kỳ dữ liệu nào cho các triển khai mà họ không vận hành.
