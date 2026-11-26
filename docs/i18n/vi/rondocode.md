# Bài nhạc Lolly Rondocode

<a id="rondocode-songs"></a>

Bài nhạc rondocode là nhạc được viết bằng mã: bộ tổng hợp âm, mẫu nhạc và bản phối, phát khi bạn nhập. Lolly có thể phát bài nhạc làm nền cho video, còn tiện ích **Rondocode** viết bài nhạc và xuất dưới dạng âm thanh; cả hai ghi bài nhạc trong Content Credentials của tệp.

<!--i:eti-music-->
## Phát bài nhạc trong Lolly

Bộ chọn tài nguyên nhận bài nhạc dưới dạng tệp `.rondo` hoặc `.rondo.json`, hoặc liên kết chia sẻ `rondocode.com` được dán vào. Bài nhạc phát theo bất kỳ thời lượng nào clip của nó yêu cầu. Nó có thể làm **nhạc nền** cho bản xuất video hoặc phát trong trình phát âm thanh nền của chế độ Neurospicy.

Mã của bài nhạc chạy trong môi trường cô lập của Lolly, không có mạng và không truy cập tệp của bạn. Mọi phần mà bản kết xuất không phát được, như micro trực tiếp, hoặc giọng hát khi không có mô hình giọng nói, đều được liệt kê trong chi tiết tài nguyên.

Từ terminal, `lolly mix` nhận một bài nhạc làm toàn bộ nhạc nền; xem [Kết xuất bằng CLI](/info/cli-rendering.html).

<!--i:eti-code-->
## Viết và xuất bài nhạc

Mở công cụ **Rondocode** từ **Utilities** để viết bài nhạc trong trình soạn thảo trực tiếp của rondocode và nghe khi bạn nhập. Xuất dưới dạng **WAV**, **MP3**, **M4A**, **Opus** hoặc **FLAC**, ZIP chứa các phần âm thanh riêng, **MIDI** hoặc bản ghi âm những gì đang phát. Từ terminal, `lolly rondocode --export=mid` ghi cùng tệp MIDI. **Export length** đặt số giây của bản xuất âm thanh. Tệp bài nhạc (`.rondo.json`) là mã bạn đã viết, không thêm gì.

Bài nhạc có thể hát lời bằng `sing()`. Các mô hình giọng nói đã tải xuống tạo giọng hát trên thiết bị của bạn. Tệp chứa giọng hát tổng hợp luôn khai báo giọng hát là do AI tạo (xem [Tính năng AI](/info/ai-features.html)).

<!--i:eti-badge-check-->
## Bài nhạc trong chứng thực

Bản xuất video hoặc âm thanh phát bài nhạc rondocode ghi từng bài nhạc trong Content Credentials dưới dạng nguồn:

- tên bài nhạc;
- SHA-256 của tệp `.rondo.json`;
- cách nó được kết xuất: trong môi trường cô lập của Lolly, lớp thực thi `vm`, với phiên bản và giá trị khởi tạo của trình kết xuất, cùng mọi phần mà bản kết xuất không phát được.

Nhạc được tính toán từ mã bài nhạc được đánh dấu là phương tiện tạo bằng thuật toán, nên Lolly Verify không đánh dấu nó là AI. Trước khi xuất, một dòng dưới **Download** liệt kê các bài nhạc mà chứng thực sẽ ghi lại. Sau khi xuất, cùng dòng đó báo những gì tìm thấy khi đọc tệp đã bàn giao. Bỏ đánh dấu **C2PA Credentials** để không đưa bản ghi vào. Ảnh tĩnh không ghi bài nhạc nào, vì không có âm thanh. Ảnh tĩnh không ghi bài nhạc nào. `lolly mix` và [máy chủ MCP](/info/mcp.html) ghi cùng bản ghi.

<!--i:eti-file-->
## Tệp từ tiện ích Rondocode

Hầu hết tiện ích trên thiết bị không ghi chứng thực, vì chúng biến đổi tệp mà bạn đã sở hữu. Lolly Rondocode tạo âm thanh mới, nên mọi tệp âm thanh nó ghi đều mang Content Credentials ghi bài nhạc làm nguồn: WAV, MP3, M4A, Opus, FLAC, từng phần âm thanh riêng trong ZIP chứa các phần đó và bản ghi âm những gì đang phát.

- Các bản kết xuất riêng của trình soạn thảo chạy trong khung riêng của nó (lớp thực thi `frame`) và ghi phiên bản trình soạn thảo.
- Bản kết xuất tạo bằng CLI hoặc liên kết chia sẻ chạy trong lớp `vm` và ghi phiên bản cùng giá trị khởi tạo của trình kết xuất.
- WAV cũng nêu cùng thông tin trong chú thích RIFF.

Khi bài nhạc có giọng hát, khai báo AI ở dạng máy đọc được. Loại nguồn kỹ thuật số của chứng thực là phương tiện tổng hợp được tạo bằng mô hình đã huấn luyện, bản ghi liệt kê các phần được hát, và một khai báo AI C2PA cho mỗi mô hình xác định từng mô hình mà giọng hát đi qua: Supertonic-3 chuyển văn bản thành giọng nói, bộ căn chỉnh âm vị wav2vec 2.0, bộ mã hóa ContentVec và giọng RVC, cùng kho mã và commit mà Lolly dùng để lưu trữ mô hình.

### Tệp MIDI chứa những gì

Tệp MIDI là Standard MIDI File, định dạng 1. Track đầu chứa nhịp độ và số chỉ nhịp 4/4, tiếp theo là một track cho mỗi bộ tổng hợp âm, đặt tên theo bộ tổng hợp âm đó. Mỗi nốt giữ thời điểm bắt đầu, độ dài và lực đánh. Bộ tổng hợp âm có tên chỉ một nhạc cụ, như bass, bộ dây, pad hoặc piano, nhận nhạc cụ General MIDI tương ứng, còn tên giống trống được đưa lên kênh 10. Cách lên dây không theo hệ mười hai âm được làm tròn đến nửa cung gần nhất với độ uốn cao độ.

Tệp MIDI không thể chứa cài đặt bộ tổng hợp âm, bộ lọc, hiệu ứng, bus, mẫu âm hay giọng hát, nên DAW phát các nốt bằng nhạc cụ riêng của nó. Nhịp độ được đọc từ số chu kỳ mỗi giây của bài nhạc, với một chu kỳ là một ô nhịp bốn phách, vì số chỉ nhịp riêng của bài nhạc không nằm trong những gì trình kết xuất trả về.

Tệp MIDI không có chỗ cho chứng thực, nên một sự kiện văn bản trong tệp chứa tuyên bố, và bảng xuất cho bạn biết điều đó. Bảng mô tả tất cả những điều này trước khi bạn xuất. Sau mỗi lần xuất, trình soạn thảo đọc lại tệp đã lưu và chỉ báo những gì lần đọc đó tìm thấy.

Để biết Content Credentials ghi lại những gì nói chung, xem [Xuất một tệp](/info/exporting.html#content-credentials-c2pa).
