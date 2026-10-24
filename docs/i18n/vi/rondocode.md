# Bài hát Rondocode

Một bài hát rondocode là âm nhạc viết bằng mã: bộ tổng hợp, mẫu và bản phối, phát khi bạn gõ. Lolly có thể phát một bài hát dưới video, và tiện ích **Rondocode** cho phép bạn viết một bài và xuất thành âm thanh. Cả hai ghi bài hát vào Content Credentials của tệp, để âm nhạc nói được nó đến từ đâu.

## Phát một bài hát trong Lolly

Bộ chọn tài nguyên nhận một bài hát dưới dạng tệp `.rondo` hoặc `.rondo.json`, hoặc liên kết chia sẻ `rondocode.com` được dán. Một bài hát là mã tự tạo ra âm thanh của nó, nên nó phát ở bất kỳ độ dài nào mà clip của nó yêu cầu. Nó có thể là **music bed** dưới bản xuất video hoặc phát trong trình phát môi trường của Neurospicy Mode.

Mã của bài hát chạy trong sandbox của Lolly, không có mạng và không truy cập tệp của bạn. Mọi phần mà bản kết xuất không phát được, như micro trực tiếp, hoặc giọng hát khi thiếu mô hình giọng, được liệt kê trong chi tiết của tài nguyên.

Từ terminal, `lolly mix` nhận một bài hát làm toàn bộ nhạc nền; xem [CLI rendering](/info/cli-rendering.html).

## Viết và xuất một bài hát

Mở **Rondocode** từ **Utilities** để viết bài hát trong trình soạn thảo trực tiếp của rondocode và nghe khi bạn gõ. Xuất nó dưới dạng **WAV**, **MP3**, **M4A**, **Opus** hoặc **FLAC**, một ZIP các stem, **MIDI**, hoặc bản ghi những gì đang phát. **Export length** đặt số giây mà một bản xuất âm thanh kéo dài. Chính tệp bài hát (`.rondo.json`) là mã của bạn như đã viết và không mang thêm gì.

Một bài hát có thể hát lời của nó bằng `sing()`. Giọng hát được tạo trên thiết bị của bạn bằng các mô hình giọng đã tải, và tệp chứa giọng hát tổng hợp luôn khai báo giọng hát đó là do AI tạo (xem [AI features](/info/ai-features.html)).

## Bài hát trong credential

Một bản xuất video hoặc âm thanh phát bài hát rondocode ghi từng bài trong Content Credentials của nó làm một nguồn:

- tên bài hát;
- SHA-256 của tệp `.rondo.json` của nó;
- cách nó được kết xuất: trong sandbox của Lolly, lớp thực thi `vm`, kèm phiên bản và seed của bộ kết xuất, và mọi phần mà bản kết xuất không phát được.

Âm nhạc được tính từ mã của bài hát được đánh dấu là phương tiện thuật toán, nên Verify không đánh dấu nó là AI. Trước khi xuất, một dòng dưới **Download** liệt kê các bài hát mà credential sẽ ghi; sau khi xuất, cùng dòng báo cáo điều mà việc đọc tệp đã giao tìm thấy. Bỏ chọn **C2PA Credentials** để bỏ bản ghi. Ảnh tĩnh không ghi bài hát nào, vì nó không có âm thanh. `lolly mix` và [máy chủ MCP](/info/mcp.html) ghi cùng bản ghi.

## Tệp từ tiện ích Rondocode

Hầu hết tiện ích trên thiết bị không ghi credential, vì chúng biến đổi một tệp bạn đã sở hữu. Rondocode tạo âm thanh mới, nên mọi tệp âm thanh nó ghi đều mang Content Credentials ghi bài hát làm nguồn: tên của nó, SHA-256 của tệp `.rondo.json` và nơi mã của nó chạy. Điều đó bao gồm WAV, MP3, M4A, Opus, FLAC, từng stem trong ZIP stem và bản ghi những gì đang phát.

- Các bản kết xuất của chính trình soạn thảo chạy trong khung riêng của nó (lớp thực thi `frame`) và ghi phiên bản của trình soạn thảo.
- Một bản kết xuất tạo bằng CLI hoặc liên kết chia sẻ chạy trong lớp `vm` và ghi phiên bản và seed của bộ kết xuất.
- Một WAV cũng nêu điều tương tự trong chú thích RIFF của nó.
- Âm nhạc được tính từ mã của bài hát là phương tiện thuật toán và không được đánh dấu là AI.

Khi một bài hát hát, tệp khai báo giọng hát đó là do AI tạo ở dạng máy đọc được. Loại nguồn số của credential là phương tiện tổng hợp tạo bằng mô hình đã huấn luyện, bản ghi liệt kê các phần được hát, và một khai báo AI C2PA cho mỗi mô hình xác định từng mô hình mà giọng hát đi qua: chuyển văn bản thành giọng Supertonic-3, bộ căn âm vị wav2vec 2.0, bộ mã hóa ContentVec và giọng RVC, với kho và commit mà Lolly lưu trữ nó. Tệp chứa giọng hát tổng hợp không bao giờ được lưu mà không có khai báo đó.

Tệp MIDI không có chỗ cho credential, nên một sự kiện văn bản trong tệp mang lời tuyên bố thay thế, và bảng xuất cho bạn biết điều đó. Bảng mô tả tất cả điều này trước khi bạn xuất, và sau mỗi lần xuất trình soạn thảo đọc lại tệp đã lưu và chỉ báo cáo điều mà việc đọc đó tìm thấy.

Về những gì Content Credentials ghi nói chung, xem [Export a file](/info/exporting.html#content-credentials-c2pa).
