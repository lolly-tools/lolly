# Sử dụng Lolly

Một hướng dẫn thực tế về việc *dùng* ứng dụng - mở một công cụ, làm việc trên canvas, xuất file, lưu và chia sẻ. Mọi thứ ở đây đều chạy **trên thiết bị của bạn**: không tài khoản, không tải lên, không cần internet sau lần tải đầu tiên.

> Mới dùng? [Bắt đầu nhanh](/info/quickstart.html) giúp bạn tạo được sản phẩm chỉ trong vài phút, còn [Lolly cho nhà vận hành](/info/operators.html) hướng dẫn cài đặt/triển khai ứng dụng; trang này nói về cách điều khiển nó khi đã mở.

## Mở một công cụ

Màn hình chính là **gallery** - mọi công cụ, nhóm theo danh mục. Nhấp vào một thẻ để mở công cụ; nếu bạn đã từng làm việc với nó, nút **Continue** sẽ khôi phục phiên gần nhất của bạn. Dùng ô tìm kiếm để lọc theo tên - hoặc [Tìm kiếm](/info/search.html) từ thanh ở chân sáu màn hình danh sách (gallery, Utilities, Projects, Catalogue, Dashboard và Profile), nơi với tới cả công việc đã lưu, catalogue và các thiết lập của bạn chứ không riêng các công cụ. Bên trong một công cụ, thanh này nhường chỗ cho giao diện riêng của công cụ.

![Gallery công cụ - mỗi công cụ là một thẻ, nhóm theo danh mục](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&filename=gallery&try=1)

Mỗi công cụ là một khung chia đôi: **các điều khiển** ở một bên, **bản xem trước** (canvas) trực tiếp ở bên kia. Thay đổi bất kỳ điều khiển nào và bản xem trước cập nhật ngay lập tức.

![Chế độ xem chia đôi của một công cụ - ngăn xếp điều khiển ở bên trái, và biểu đồ cột nhóm trực tiếp mà nó vẽ ở bên phải](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

> Một vài công cụ (như **Design**) lại mở dưới dạng **canvas tự do** - một bề mặt thao tác trực tiếp, không khung giao diện, nơi bạn kéo, đổi kích thước, xoay và gắn các khối văn bản, hình khối và hình ảnh, rồi nhấp đúp để sửa văn bản ngay tại chỗ. Nó xuất file qua cùng quy trình render như mọi công cụ khác, nên canvas *chính là* file. Xem [Canvas tự do](#the-free-canvas-design) bên dưới.

Hai cách để nắn chính cái lưới đó thành cái lưới bạn muốn:

- <!--i:star--> **Đánh dấu sao thứ bạn hay dùng.** Gắn ★ cho một thẻ và nó có một ô lớn của riêng mình trên dải phía trên lưới - xem [Mục yêu thích của bạn](/info/favourites.html).
- <!--i:eyeoff--> **Ẩn công cụ bạn không bao giờ dùng.** Nhấp chuột phải vào một thẻ (hoặc chọn vài thẻ rồi dùng thanh lựa chọn) → **Hide tool**. Nó rời khỏi lưới, và khỏi những gì việc gõ tìm trong lưới tìm được; một ô xám **Show hidden tools (N)** ở tận cuối sẽ hiện chúng trở lại, mờ đi, mỗi thẻ có **Unhide tool** trong menu riêng. Việc ẩn chỉ liên quan tới lưới của bạn - công cụ vẫn mở được từ một liên kết đã lưu hay một bookmark, và với mọi người khác nó vẫn nằm nguyên chỗ cũ.

![Cuối lưới Tools với các công cụ đã ẩn được hiện ra: thẻ QR Code Generator mờ đi, và bên cạnh là ô xám vừa đưa nó trở lại tầm nhìn, giờ hiện chữ Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-bulk%3D%22hide%22%5D%3Bwait%3A300%3Bclick%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed it. The alt says so rather than quoting the resting
label the prose above already gives.
There is no standalone per-card "hide" button
(unlike the always-visible fav/pin corner icons) - Hide only exists inside a
tile's right-click menu or the bulk bar, both confirmed in views/gallery.ts.
The recipe goes the bulk-bar route since it needs no `|right` context-menu
step: tick the card (`[data-select="qr-code"]`, the same checkbox hook the
selection bullet under Projects uses), click the bar's Hide button
(`[data-bulk="hide"]` - the literal `data-bulk` value bulkBarHtml() writes,
confirmed in lib/bulk-bar.ts), then click the grey reveal tile
(`.gtile--hiddenbox`, confirmed in gallery.ts).
-->

### Ask Lolly

Khi bạn muốn hỏi thay vì tự lần tìm, **Ask Lolly** (`#/ask`) nhận một câu hỏi bạn gõ vào và trả lại đúng phần tài liệu này **nguyên văn** - chính lời của các hướng dẫn, không phải bản tóm tắt và không phải nội dung sinh ra - kèm trích dẫn trang nguồn và một liên kết **Open in docs** bên cạnh. Dưới câu trả lời là những chỗ trong ứng dụng khớp với cùng câu hỏi đó: một công cụ, một thiết lập, một dự án đã lưu, mỗi thứ là một nút chỉ việc đưa bạn tới đó.

Bản ghi hội thoại là bộ nhớ của phiên: hỏi tiếp và mạch trò chuyện dài dần theo bạn, rồi tải lại trang thì nó bắt đầu lại từ đầu. Kết quả tìm kiếm mang một dòng **Ask Lolly: *truy vấn của bạn*** ở dưới cùng - bên dưới mọi kết quả cụ thể mà các nhóm khác tìm được - chuyển thẳng câu hỏi sang, nên bạn có thể bắt đầu ở thanh tìm kiếm và kết thúc tại đây.

## Canvas (bản xem trước)

Bản xem trước luôn hiển thị chính xác thứ sẽ được xuất ra.

**Máy tính**

- **Thu phóng:** cuộn kèm Cmd/Ctrl, hoặc chụm hai ngón trên trackpad - điểm thu phóng lấy con trỏ của bạn làm tâm.
- **Di chuyển khung nhìn:** giữ **Space** rồi kéo, hoặc kéo bằng **nút chuột giữa**. (Nhấp chuột thường vẫn để dành cho việc nhấp vào các phần của thiết kế.)
- **Bàn phím:** `0` = vừa khung cửa sổ · `1` = 100% · `+` / `−` = thu phóng.
- **HUD thu phóng:** điều khiển nhỏ `−  NN%  +  Fit` ở góc. Nhấp vào phần trăm để chuyển giữa Fit ↔ 100%.

![HUD thu phóng ở góc canvas - dấu trừ, phần trăm trực tiếp, dấu cộng, Fit, rồi tới công tắc giao diện và âm thanh](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

**Cảm ứng**

- **Chụm hai ngón** để thu phóng, **kéo** để di chuyển khung nhìn, **nhấp đúp** để đặt lại về vừa khung.

**Nhấp để nhảy tới điều khiển tương ứng:** nhấp vào phần tử bất kỳ trong thiết kế và trường nhập tương ứng ở thanh bên sẽ được focus và cuộn vào tầm nhìn - với một nhóm hàng lặp lại, nó mở ra đúng hàng bạn vừa nhấp, nên sửa thứ bạn đang nhìn chỉ cách một cú chạm.

Mỗi lần đổi kích thước, khung nhìn luôn tự chỉnh về trạng thái vừa khung gọn gàng.

### Canvas tự do (Design)

Các công cụ canvas tự do thêm một bề mặt làm việc *bao quanh* khung tranh, giống bảng dán của nhà thiết kế:

- **Dàn dựng ngoài canvas.** Kéo một khối ra quá mép khung và nó vẫn hoàn toàn **hiện rõ và chọn được** - để tạm các phần tử sang một bên trong lúc sắp xếp bố cục, rồi kéo chúng trở vào. Mọi thứ nằm ngoài khung đều được **làm mờ nhẹ** để vùng xuất file luôn dễ nhận ra ngay từ cái nhìn đầu tiên, và khung vẫn giữ bóng đổ để đánh dấu chính xác nơi file bắt đầu.
- **Chỉ phần trong khung được xuất.** File xuất ra bị giới hạn bởi khung tranh - bất cứ thứ gì còn nằm ngoài (hoặc phần của một khối tràn qua mép) đơn giản là bị cắt khỏi kết quả, ở cả định dạng raster lẫn vector.
- **Thu nhỏ quá mức Fit** (xuống tới 20%) để nhìn thấy toàn bộ bảng dán khi bạn đã dàn đồ ra xa khung.
- **Khung tranh đổi kích thước được.** Thay đổi kích thước xuất file sẽ đổi kích thước khung ngay tại chỗ; các khối giữ nguyên vị trí, nên bạn có thể đóng khung lại một bố cục quanh nội dung sẵn có.

![Design's free canvas - the artboard with its surrounding pasteboard](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

**Lật một lựa chọn.** Nhấp chuột phải vào bất kỳ khối nào và chọn **Lật ngang** hoặc **Lật dọc** để phản chiếu nó tại chỗ, hoặc nhấn `Shift+H` / `Shift+V` từ bàn phím - dùng Shift, vì `V` đơn thuần là công cụ Con trỏ. Mỗi khối được chọn phản chiếu theo trục riêng của nó trong một bước hoàn tác, và phép phản chiếu là một phép biến đổi thực sự, nên nó vẫn giữ nguyên trong SVG, PDF và PNG xuất ra chứ không chỉ trên canvas.

### Tự vẽ hình của bạn (công cụ pen)

Khối hộp, hình tròn và khung bo góc lo được phần lớn bố cục. Khi bạn cần một hình không có trong danh sách đó, hãy vẽ nó: nút **Pen** trên thanh công cụ (hoặc phím `P`) đưa bạn vào chế độ vẽ. Ba phím đơn chuyển qua lại giữa các chế độ - **`V`** quay về Pointer, **`P`** cho Pen, **`N`** cho công cụ node (**Edit points**) - và Pointer luôn là lối ra khỏi bất kỳ chế độ nào bạn đang ở.

![Thanh công cụ của canvas tự do: tay cầm kéo, menu Lolly, rồi Pointer, Add a box, Pen, Edit points, Line, Timeline, Artboards và Auto-arrange](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

- **Nhấp** để đặt một điểm. Ở kiểu đường cong mặc định, **nhấp rồi kéo** sẽ kéo tay cầm của điểm đó ra, đó là cách bạn vẽ một đường cong thay vì một góc gãy - giữ **Alt** khi nhấp để có góc gãy. (Ở các kiểu đường cong khác, mọi điểm đặt xuống đều là góc gãy và thao tác kéo không có tác dụng; xem **Spline type** bên dưới.)
- Các điểm bám vào khung tranh và vào những khối khác của bạn khi bạn đặt chúng, vẽ ra đúng các đường dẫn hướng như một lần kéo bình thường. Alt tắt lưới trong lúc bạn vẽ, và tắt cả lưới lẫn các cạnh khi sau đó bạn kéo một điểm.
- **Nhấp vào điểm đầu tiên** để khép vòng và kết thúc trong một thao tác. Nếu không, nhấn **Enter**, nhấp đúp hoặc chỉ cần đổi công cụ - bản vẽ được giữ lại, không bị vứt đi.
- **Escape** lùi từng nấc một: lần nhấn đầu bỏ bản vẽ và không ghi gì, lần thứ hai thoát khỏi pen.
- **Delete** trong lúc vẽ sẽ bỏ điểm bạn vừa đặt.

Kết quả là một khối bình thường trên canvas. Di chuyển, đổi kích thước, xoay, nhóm, canh hàng, xếp lại lớp, cho nó màu nền, một gradient, một bóng đổ hay một độ mờ - một path hành xử như mọi khối khác, và không điều khiển nào đối xử với nó khác đi.

Nó cũng có sẵn màu. Path đầu tiên bạn vẽ lấy màu nền và nét mà thương hiệu của bạn gán cho một path, sau đó mỗi path mới lấy **thứ bạn dùng gần nhất** - đặt màu nền một lần rồi vẽ tiếp, thay vì phải tô lại từng hình. (Trong một công cụ mà thương hiệu không nói gì về path, path bạn vẽ ra được kẻ nét đúng màu bạn nhìn thấy lúc đang vẽ, nên nó không bao giờ vô hình.)

**Chỉnh lại các điểm.** Nhấp đúp vào hình (hoặc dùng **Edit points** trên thanh đối tượng) và các điểm hiện lại. Kéo một điểm để dời nó, kéo một tay cầm để đổi hướng, nhấp vào bất cứ đâu trên đường cong để chèn một điểm, khoanh chọn một nhóm điểm rồi nhấn Delete để xoá những điểm đang chọn. Một path luôn giữ ít nhất hai điểm, nên bạn không thể lỡ tay xoá nó biến mất hoàn toàn.

**Spline type** quyết định loại đường cong chạy qua các điểm của bạn, và đây là lựa chọn đáng hiểu cho rõ:

| Kiểu | Nó làm gì |
|---|---|
| **Smooth (auto)** | Mặc định. Tự tính lấy độ dài tay cầm, nên chỉ nhấp - nhấp - nhấp là có một đường cong mượt thật sự mà không phải vật lộn với tay cầm. Nếu bạn có đặt một tay cầm, nó ghim *hướng* lại, còn độ dài vẫn do đường cong nắm. |
| **Bezier handles** | Cây pen cổ điển. Tay cầm chính là điểm điều khiển, và việc chèn một điểm không bao giờ làm đường cong xê dịch. |
| **Through the points** | Đi đúng qua mọi điểm bạn đặt, không tay cầm. |
| **B-spline** | Chạy gần các điểm chứ không xuyên qua chúng, cho một hình mềm hơn. |
| **Straight lines** | Một đường gấp khúc. |

Chuyển một path có sẵn sang kiểu tự tính lấy tay cầm sẽ hỏi trước, vì độ dài tay cầm bạn đã đặt không lấy lại được - chuyển sang **Bezier handles** thì luôn không mất mát gì. Đang vẽ dở thì không có hộp hỏi: việc chuyển áp thẳng vào bản nháp, và mọi tay cầm bạn đã kéo ra sẽ đi theo. Ở những kiểu tự nắm tay cầm, chèn thêm một điểm làm đường cong đổi dáng rất nhẹ; với **Bezier handles** thì không.

Mỗi điểm còn mang một quy tắc liên tục, thể hiện qua hình dạng của nó trên canvas - vuông là **Corner** (hai tay cầm di chuyển độc lập), tròn là **Smooth** (hai tay cầm luôn thẳng hàng), tròn có vòng là **Symmetric** (thẳng hàng và bằng độ dài). Đặt quy tắc cho các điểm đang chọn và đường cong lập tức tuân theo.

![Hai path vẽ bằng pen render thẳng từ một liên kết: một đường cong chữ S có nét và một khối tròn khép kín được tô đầy](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

Một path đã vẽ đi theo liên kết như mọi thứ khác, nên hình bạn vẽ mở lại được từ một liên kết chia sẻ và render y hệt từ CLI. Không có gì ở nó phụ thuộc vào trình chỉnh sửa.

### Kết hợp các hình (phép toán path)

Chọn từ hai hình trở lên, **nhấp chuột phải** lên canvas (chạm hai ngón trên màn hình cảm ứng) và menu đưa ra những phép toán bạn vẫn chờ đợi ở một ứng dụng vẽ:

- **Union** gộp chúng thành một hình, giữ màu của hình trên cùng.
- **Subtract** cắt bỏ mọi hình phía trên khỏi hình dưới cùng.
- **Intersect** chỉ giữ lại phần chồng lên nhau.
- **Exclude** giữ lại mọi thứ trừ phần chồng lên nhau.

Ba phép nữa làm việc trên một hình đơn: **Outline stroke…** biến một nét thành hình tô kín đúng theo đường bao đó (hữu ích khi bạn muốn giữ độ dày đúng như đã vẽ), **Offset path…** phình bóng hình ra ngoài hoặc, với một số âm, co nó vào trong và **Simplify** dựng lại một path với ít đoạn hơn mà vẫn giữ nguyên dáng.

![Một hình lưỡi liềm và một vòng khuyên có lỗ thật, cả hai đều do Subtract tạo ra](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=path-ops-boolean-result)

Kết quả là một path mới mà bạn có thể tiếp tục chỉnh bằng pen. Lỗ là lỗ thật - một điều khiển **Fill rule** trên bảng nét quyết định các đường bao chồng nhau sẽ tô kín (*non-zero*) hay đục thủng qua (*even-odd*).

Có hai điều các phép toán này cố tình không làm. Chúng **từ chối chứ không phá**: bảo nó giao hai hình không chồng nhau thì bạn được báo là chẳng còn gì để giữ, và không có gì thay đổi. Còn khối văn bản và khối ảnh không có đường bao để làm việc, nên chúng được để yên thay vì bị xấp xỉ bằng cái khung của mình. Một kết quả kết hợp được lưu dưới dạng đường Bezier thuần, đúng như cách một ứng dụng vẽ vẫn làm - kiểu spline ban đầu không sống sót qua phép toán.

## Dòng thời gian (Sequence Studio)

![The timeline with the music clip selected: its strip runs along the bottom with Speed, Fades, Volume, Pan, EQ, Pitch, Normalize volume and the Effect slot](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dvideo%26_sel%3Dbed&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px!important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip)

**Sequence Studio** thêm *thời gian* vào canvas tự do. Mỗi khối có thể bắt đầu ở một thời điểm, chạy trong một khoảng và có hiệu ứng vào ra, còn dòng thời gian gắn dưới khung tranh là nơi bạn sắp xếp chúng. Mở lên là đã có sẵn một chuỗi đang chạy - một thẻ tiêu đề, một clip, một thẻ kết, một dòng chữ dưới màn hình và một nền nhạc - nên mô hình hiện ra trước mắt trước khi bạn thay đổi bất cứ thứ gì.

![Dòng thời gian của Sequence Studio: thanh điều khiển vận chuyển, thước đo, một lane overlay, hàng chuỗi có nam châm với các clip và các chip nối liền, cùng dải Always on](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

Có hai loại hàng, và khác biệt giữa chúng chính là toàn bộ ý tưởng:

- **Hàng chuỗi** có tính *nam châm*. Các clip nằm sát nhau không kẽ hở, cái này nối tiếp cái kia, và kéo một clip sẽ sắp xếp lại thứ tự chứ không để lại một lỗ trống. Xoá một clip thì phần còn lại dồn khít lại. Đây là xương sống của bạn.
- **Làn phủ** thì tự do. Một dòng chữ dưới màn hình, một logo, một phụ đề - bất cứ thứ gì nổi trên xương sống theo thời điểm riêng của nó - đều có làn riêng và điểm bắt đầu riêng.
- Bên dưới những hàng đó, **Always on** gom các khối hoàn toàn không có định thời: phần nền cảnh đơn giản là có mặt suốt từ đầu tới cuối. Dấu `+` trên một chip đưa một khối lên làn; **Make always on** trả nó về lại.

![Sân khấu chỉnh sửa: bảng vẽ ở chính giữa phía trước, dải công cụ bên trái và HUD thu phóng ở góc](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-stage)

Mở dòng thời gian là giao bàn phím cho nó, nên Space và các phím mũi tên điều khiển đầu phát chứ không phải cả trang - và vì nó tự mở trên một bố cục vốn đã có định thời, điều đó đúng ngay từ lúc Sequence Studio tải xong.

> **[Trình chỉnh sửa chuỗi](/info/sequence-editor.html)** đi sâu vào bốn thứ quyết định việc dựng theo thời gian có dễ đoán hay không: một cú nhấp trên canvas sẽ sửa clip nào, bóng mờ onion-skin của các clip liền kề, phạm vi của lệnh cắt và lệnh Join hoàn lại một nhát cắt, cùng việc cắt gọt (kể cả bộ phím tắt). Nhấn `?` khi dòng thời gian đang được focus để xem bảng phím tắt.

**Chỉnh sửa.** Kéo phần giữa của một clip để dời hoặc sắp lại thứ tự, kéo trong phạm vi vài pixel quanh một trong hai đầu để cắt gọt và nhấn **Split at playhead** (hoặc `S`) để cắt một clip thành hai. Split cần một clip có **Length** thực và đầu phát nằm hẳn vào bên trong nó, nên một clip không có điểm kết (nền nhạc chẳng hạn) thì không cắt được. **Snap to edges** bật sẵn và bám vào cạnh clip, đầu phát và các mốc giây tròn, giữ Alt để bỏ qua. Mỗi lần kéo là một bước hoàn tác duy nhất, và bản xem trước lúc kéo chạy đúng phép tính như lúc chốt, nên thứ bạn thấy trong lúc kéo chính là thứ bạn nhận được.

Chọn một clip và bảng thuộc tính cho bạn đúng những chỉnh sửa đó dưới dạng con số: **Length**, **Trim in** (bắt đầu vào sâu bao nhiêu trong nguồn), **Speed** là một tập hệ số cố định từ ×0.25 đến ×4, **Animate in** / **Animate out** cùng độ dài của chúng và **Mute clip**. Một clip trên hàng nam châm cố tình không có ô **Start** - hàng đó nắm giữ thứ tự, nên bạn kéo để dời nó.

**Transitions** là các preset, không phải keyframe: Fade, Pop, Grow, Rise, Drop, bốn kiểu Slide, Zoom in và Zoom out, Tilt, Swoop, Spin, Drift hoặc **Cut (no animation)**. Khoảng cách co giãn theo đối tượng, nên cùng một preset đọc ra đúng trên cả một thẻ tràn khung lẫn một huy hiệu nhỏ. Giữa hai clip liền nhau trên hàng chuỗi có một **chip mối nối**: nhấp vào đó rồi chọn **Cut** hoặc **Crossfade**, lệnh áp dụng ngay lập tức và chip đóng lại. Mở lại chính chip đó để đổi **Length (ms)** rồi nhấn **Done**. Một crossfade được lưu thành một lần mờ đi của clip này và một lần hiện lên của clip kế, còn bản xuất suy ra phần hoà trộn thật từ cặp đó - đó là lý do một crossfade trông như hai lần fade trong bản xem trước nhưng là một cú chuyển giao thật trong file.

**Âm thanh.** Thêm một clip **Audio** và nó nằm trên dòng thời gian như mọi clip khác: dạng sóng, cắt gọt, tắt tiếng. (Nền nhạc tạo sẵn đi kèm phiên mặc định là ngoại lệ duy nhất - nó được tổng hợp ở lúc xuất file, nên thanh của nó vẫn trơn và im lặng cho tới khi bạn render.) Nhấn nút micro để **ghi lời thuyết minh** thẳng lên dòng thời gian, có đếm ngược và một đồng hồ đo mức, và bản thu được lưu thành tài sản của riêng bạn ngay tại điểm bạn bắt đầu. Nhấn nút camera cạnh đó để **quay video** theo cùng cách đó: bản quay được cắt theo đúng kích thước xuất file của artboard ngay trong lúc quay, nên khung xem nhỏ hiện đúng những gì sẽ vào chuỗi tại đầu phát, trọn khung hình - đây là cách lấy clip của một đồng nghiệp từ một liên kết chia sẻ. Nhạc, lời thoại và tiếng của riêng một clip đều đi vào bản trộn khi xuất. (Ô **Audio track** trong bảng xuất file là chuyện khác: một nền nhạc trải dưới toàn bộ clip, có fade và ducking. Hai thứ này cùng tồn tại.)

**Kết xuất.** Một bản xuất chuyển động là một **hợp thành tất định**, không phải bản quay màn hình - mỗi khung hình được giải mã, vẽ và mã hoá ở một thời điểm chính xác, nên file không phụ thuộc vào chuyện máy bạn có chạy kịp hay không, và trên thực tế MP4 hay WebM không có trần số khung hình. Chính độ dài của dòng thời gian đặt ra thời lượng, trừ khi bạn tự nhập một con số. Content Credentials được đóng dấu như với mọi bản xuất khác. Một bản xuất ảnh tĩnh cho bạn khung hình tại đầu phát, hoặc cả một bảng ảnh liên hoàn từ ô **Frames** bên cạnh kích thước đầu ra - xem [Xuất file](/info/exporting.html#stills-from-a-timed-composition).

Vài giới hạn cần nhớ: một chuỗi bị chặn ở một giờ, GIF và PNG động phải đệm các khung hình nên chúng chỉ nên ngắn, âm thanh sẽ im trên một clip có tốc độ khác ×1 (chưa có kéo giãn thời gian) và **Record live** bị ẩn ở đây vì bộ hợp thành là con đường tốt hơn.

**Vượt ra ngoài preset: keyframe, chiều sâu và camera.** Một transition làm cho một clip chuyển động khi nó xuất hiện và biến mất. Để tạo dáng cho một hộp *bên trong* một clip - làm nó trôi, mờ dần, làm mờ, nhấc nó khỏi trang và đặt nó trở lại - hãy thêm keyframe: chọn clip, nhấn **+Keyframe** (hình thoi trong cụm công cụ của timeline, hình thoi trên thanh đối tượng của canvas, hoặc phím `K`) và vị trí của playhead sẽ quyết định lần chỉnh sửa tiếp theo của bạn ghi vào tư thế nào. Cùng hệ thống keyframe đó mang lại cho mọi bố cục có thời gian một **camera** có thể đẩy vào gần, lia ngang và kéo tiêu điểm, biến một SVG phẳng thành một chồng lớp mà bạn có thể bay qua lại giữa chúng. **[Tạo hoạt ảnh](/info/animating.html)** là hướng dẫn đầy đủ.

Công cụ Design có cùng dòng thời gian đó, nên bạn định thời cho một bố cục mà không phải chuyển sang công cụ khác, và nó cũng xuất được chuyển động.

## Trình chiếu

![The inspector's Document section: Voice, Blend with, Speed, Lead-in, Tail and Show captions when presenting](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

Một tài liệu Design gồm nhiều **khung tranh** vốn đã là một bộ slide. Mở **menu Lolly** trên thanh công cụ rồi chọn **Present** - dòng cuối cùng - và mỗi khung tranh thành một slide toàn màn hình, theo đúng thứ tự các khung tranh nằm trên canvas. Bộ slide chạy trên một bản sao của các khung tranh đã render, nên trình chỉnh sửa bên dưới không hề bị đụng tới và khi thoát ra bạn quay lại đúng chỗ cũ.

- **Tiến tới** với **Space**, `→`, **Page Down** hoặc nhấp vào dải ở cạnh phải màn hình; lùi lại bằng `←`, **Page Up** hoặc dải ở cạnh trái. **Home** và **End** nhảy đến slide đầu tiên và cuối cùng. Một thanh điều khiển nhỏ mờ dần hiện ra mỗi khi bạn di chuyển con trỏ và tự ẩn đi khi bạn dừng lại.
- **Overview** (`O` hoặc nút lưới) sắp mọi artboard ra cùng lúc theo đúng cách bạn đã bố trí chúng trên canvas; nhấp vào một cái để mở nó.
- **Reveal steps.** Nhấp chuột phải vào một hộp và chọn **Reveal at step 1**, **2** hoặc **3** thay vì mặc định **Always visible**. Hộp đó sẽ chờ cho đến khi bạn tiến đến bước của nó, để một slide có thể xuất hiện theo từng phần; các hộp cùng chung một số sẽ xuất hiện cùng lúc.
- **Speaker view** (`S`) mở một cửa sổ thứ hai gồm slide hiện tại, slide kế tiếp, ghi chú của bạn cho slide đó và một đồng hồ đang chạy. Nếu trình duyệt chặn cửa sổ popup, nó sẽ chuyển về dạng một bảng phủ lên trên bộ slide. Ghi chú được đặt riêng cho từng artboard và không bao giờ xuất hiện trên chính slide.
- `B` giữ màn hình đen (nhấn phím bất kỳ để đưa slide trở lại), `F` quay về chế độ toàn màn hình và **Escape** lùi lại từng lớp một: từ overview về bộ slide, từ bộ slide về trình chỉnh sửa.
- **Kiosk.** Đặt cho một artboard một **Length** và bộ slide sẽ giữ nguyên tại đó trong khoảng thời gian đó, rồi tự tiến tới đằng sau một thanh tiến trình mỏng; `K` (hoặc nút tạm dừng, chỉ xuất hiện khi có thứ gì đó đã có độ dài) dừng và khởi động lại việc đó. Thêm `kiosk` vào liên kết và bộ slide sẽ quay vòng khi đến cuối, đó chính là điều biến nó thành bảng hiển thị (signage).

Bộ slide cũng là một liên kết. `?present` mở thẳng vào đó, `s=` chỉ định slide - một vị trí, một id khung tranh hoặc `id.step` cho một bước hiện dần - và địa chỉ cập nhật theo lúc bạn di chuyển, nên thứ bạn gửi đi đúng là slide bạn đang xem. Với tác giả công cụ: các tham số đó được mô tả ở trang [Chế độ URL](/info/url-mode.html#reserved-parameters).

## Trên điện thoại

Trên màn hình hẹp, bố cục dồn về một cột:

- **Các điều khiển trở thành một tấm trượt** ở phía trên với một **tay cầm kéo** ở mép dưới. Kéo tay cầm để đổi kích thước - nó chốt vào **peek / half / full** - hoặc **chạm** vào tay cầm để chuyển giữa thu gọn ↔ mở rộng. Bản xem trước lấp đầy phần bên dưới và luôn hiện ra trong lúc bạn chỉnh sửa.
- Nút **Export** nổi mở tấm trượt xuất file - tất cả các điều khiển về định dạng, kích thước, sao chép, lưu và tải xuống ở cùng một chỗ. Đóng nó lại bằng cách chạm vào lớp nền.

![Một công cụ trên màn hình rộng bằng điện thoại - điều khiển là một tấm trượt phía trên, bảng màu vừa tạo lấp đầy bản xem trước bên dưới và nút render nổi ở chính giữa phía dưới](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Điều khiển (đầu vào)

Các công cụ chỉ để lộ những trường đầu vào vốn được phép thay đổi - mọi thứ khác (màu sắc, bố cục, kiểu chữ, logic) đều do tác giả công cụ khoá cố định, nên bất cứ thứ gì bạn tạo ra đều tuân theo quy tắc mà tác giả đặt. Trường đầu vào gồm văn bản, thanh trượt, bộ chọn màu, danh sách thả xuống, ngày tháng, bộ chọn ảnh và các nhóm hàng lặp lại. Một số được gom trong các mục có thể thu gọn.

![Ngăn điều khiển của một công cụ - một ô văn bản, các nút mở bảng màu và một thanh trượt, không còn gì khác vì tác giả đã chọn khoá phần còn lại](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Đặt lại:** *Clear changes* đưa mọi trường đầu vào về giá trị mặc định.

### Hoàn tác và làm lại

**Cmd/Ctrl-Z** lùi một bước và **Cmd/Ctrl-Shift-Z** (hoặc **Cmd/Ctrl-Y**) tiến lại. Cũng cặp đó nằm dưới dạng nút **Undo** và **Redo** ở hàng phía trên các điều khiển - trên canvas tự do thì chúng nằm trên thanh công cụ - và mỗi nút mờ đi khi không còn gì để lấy lại. Mỗi bước đều nói rõ nó là gì: hoàn tác một màu và một thông báo nhỏ gọi tên trường vừa được khôi phục, kèm một nút **Redo** trong đó để đi ngược lại.

- **Một lần kéo là một bước.** Các thay đổi liên tiếp trên cùng một điều khiển trong vòng nửa giây được gộp lại, nên kéo một thanh trượt hết dải chỉ là một lần hoàn tác chứ không phải hai trăm.
- **100 bước gần nhất được giữ** - những bước cũ hơn rơi khỏi cuối hàng. Chỉnh sửa mới sau khi hoàn tác sẽ xoá ngăn xếp tiến lên, đúng như ở mọi nơi khác.
- **Khi con trỏ nhập của bạn đang ở trong một ô văn bản**, Cmd/Ctrl-Z thuộc về chính ô đó, từng ký tự một. Lolly chỉ tiếp quản cho những điều khiển vốn không có hoàn tác riêng hữu ích: thanh trượt, danh sách thả xuống, màu sắc và công tắc.
- **Chọn một file** trong một trường **file** không phải là một bước - số byte đó chỉ được giữ trong phiên làm việc, nên sẽ chẳng có gì để đặt lại.

Trong một [cộng tác](/info/collaborate.html) trực tiếp, lịch sử vẫn hoàn toàn thuộc về riêng bạn. Một thay đổi đến từ thiết bị khác không bao giờ được đưa vào ngăn xếp của bạn, nên undo chỉ có thể hoàn tác lại điều gì đó chính bạn đã làm.

## Thông tin & ảnh chân dung của bạn

**Profile** (góc trên bên phải của gallery) lưu tên, thông tin liên hệ và một **ảnh chân dung** tuỳ chọn của bạn. Các công cụ hỏi tới những trường đó sẽ tự điền sẵn - đặt một lần và chữ ký email, các lockup cùng huy hiệu của bạn sẽ tự điền lấy. Bạn vẫn có thể ghi đè từng trường cho mỗi phiên. Bật **Use my details to create** để thông tin của bạn đi kèm với tư cách tác giả trên thứ bạn xuất ra.

Ảnh chân dung và thông tin của bạn **chỉ nằm trên thiết bị này**. Một hồ sơ có thể không chỉ là bạn - mà là một nhóm hoặc một vai trò bạn thỉnh thoảng đảm nhận. Xem **[Hồ sơ](/info/profile.html)** để biết toàn cảnh, gồm cả việc giữ nhiều hơn một hồ sơ.

## Lưu & tiếp tục

Nhấp **Save** để lưu các trường đầu vào hiện tại thành một phiên cho công cụ đó. Bạn có thể giữ nhiều phiên có tên riêng cho mỗi công cụ; nút **Continue** của mỗi công cụ mở lại phiên gần nhất, còn **nút lịch sử** (góc trên bên phải, cạnh hồ sơ của bạn) liệt kê mọi phiên đã lưu trên tất cả các công cụ. Các phiên nằm cục bộ trên thiết bị. Để sắp xếp chúng, hãy mở **Projects** (bên dưới).

![Nút render hai nửa - một mũi tên lên mở bảng xuất file, và một dấu tích lưu phiên ngay tại chỗ](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

## Projects

**Projects** - mở từ tab **Projects** cạnh **Tools**, hoặc từ **Profile → Storage → Organise in Projects** - là nơi ở của mọi thứ bạn đã lưu, và nó hoạt động như một trình quản lý file:

![Projects - các phiên đã lưu được xếp vào những thư mục lồng nhau được](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)

- <!--i:folder--> **Thư mục lồng nhau được.** Gom các phiên đã lưu vào thư mục, và thư mục trong thư mục, sâu tuỳ ý. Tạo một thư mục, đổi tên nó hoặc kéo một ô vào thư mục khác để chuyển nó đi; một breadcrumb đưa bạn ngược lên. Một thư mục **Uncategorised** luôn có sẵn để giữ những gì chưa được xếp.
- <!--i:clock--> **Sắp xếp theo cách của bạn.** **View & sort** đưa ra **Name**, **Date added**, **Last modified** (mặc định) và, khi đang ở trong một thư mục, **By tool**. Thư mục luôn đứng trước bất kể kiểu sắp xếp nào đang bật - kiểu sắp xếp chỉ xếp thứ tự các phiên và các thư mục trong nhóm của chính chúng.
- <!--i:document--> **Lưu việc mới thẳng vào đây.** **New asset** ("Start a fresh creation" ở gốc, "Add to *folder*" khi đang ở trong một thư mục) mở một công cụ và tự động xếp bản lưu đầu tiên của nó vào thư mục đó.
- <!--i:checklist--> **Chọn nhiều mục (trên máy tính).** Tích ô chọn của một thẻ, kéo một khung chọn qua vùng trống hoặc **Shift/Cmd-nhấp**; **nhấp chuột phải** vào một thẻ để mở menu ngữ cảnh. Rồi thao tác trên cả lựa chọn cùng lúc - vẫn cử chỉ đó và vẫn thanh hành động nổi đó chạy được trên gallery Tools, Utilities, Catalogue và Projects, chứ không riêng ở đây.
- <!--i:download--> **Xuất cả một thư mục hoặc một lựa chọn.** **Render folder** xuất mọi phiên đã lưu trong một thư mục - kể cả các thư mục con - thành một file `.zip` lồng nhau. **Render selection** làm điều tương tự cho bất kỳ lựa chọn nhiều mục nào, còn một phiên đơn lẻ xuất thẳng ra file của riêng nó. Không cần Batch/Pro.
- <!--i:link--> **Nhảy thẳng tới việc đã lưu của một công cụ.** Tích một hoặc nhiều công cụ trên gallery Tools rồi chọn **View sessions** trên thanh lựa chọn - Projects mở ra chỉ hiện những phiên tạo bằng các công cụ đó, kèm một nút **Clear** để quay lại toàn cảnh.
- <!--i:link--> **Chia sẻ một phiên đã lưu.** Nhấp chuột phải vào một phiên → **Share link** để sao chép một liên kết mở lại nó với đúng các trường đầu vào ban đầu (hộp thoại Share đầy đủ - xem bên dưới).

![Popover View and sort trong Projects đang mở, với một hàng giao diện, lựa chọn View gồm Preview hoặc List và Name, Date added cùng Last modified nằm dưới Sort](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
<!--
SHOT NOTE (misc-projects-sort): trigger button confirmed as
`.filter-fab.projects-viewopts` in views/projects.ts (openViewOpts() is bound
to `.projects-viewopts` specifically) - `.projects-viewopts` alone is the
more specific hook, so that's what drives the click. The popover it opens
(`.projects-viewmenu`, also confirmed directly in openViewOpts()) is body-
appended, not nested under the Projects root, so cropSelector finds it
regardless. "By tool" only appears inside a folder - this recipe captures at
the Projects ROOT (`url=/#/p`), so if the capture pass wants "By tool"
visible too, point url= at a real folder instead: the route is a path
segment, `/#/p/<folderId>` (confirmed in main.ts's hash router - `parts[0]
=== 'p'` reads `folderId` from `parts[1]`), not a query param. Caveat: a
folder has to already EXIST in the capture profile, which a per-shot fresh
context has none of.
Also: the popover is not sort-only. openViewOpts() writes a theme segment, a
"View" pair (Preview / List) and a sound segment around the Sort rows, so the
alt text names them - do not re-caption this as "the sort menu".
-->

**Thanh lựa chọn đưa ra những gì** thì khác nhau đôi chút theo từng màn hình, vì không phải hành động nào cũng hợp lý ở mọi nơi:

- **Tools / Utilities:** Favourite (hoặc Unfavourite), Hide (hoặc Unhide), Available offline (hoặc Remove from offline), **View sessions** (cú nhảy mô tả ở trên) và Copy link khi đúng một thẻ đang được chọn.
- **Catalogue:** Favourite và Hide áp dụng cho mọi lựa chọn; Duplicate, Download và Delete chỉ hiện ra khi mọi mục đã chọn đều là file bạn tự tải lên - một tài sản dùng chung của hệ thống thiết kế là một cam kết vĩnh viễn, nên ba lệnh đó vẫn nằm ngoài nó ngay cả khi thao tác hàng loạt.
- **Projects:** **Render selection**, **Move to…**, **New folder**, **Delete**, **Edit together** khi lựa chọn có từ hai đến tám phiên của cùng một công cụ (nó mở chúng cạnh nhau dưới một thanh bên gộp chung) và **Edit as sheet**, thay vào đó mở cả lựa chọn thành các hàng trong bảng lưới batch. Lệnh sau **không giới hạn số lượng** và không quan tâm các phiên có cùng một công cụ hay không, nên đó là lối thoát khi một lựa chọn lớn hơn hoặc pha trộn hơn mức hai-đến-tám của Edit together.

> Một cái bẫy về nhãn: **View sessions** chỉ tồn tại khi đã có thứ gì đó *được chọn*. Nhấp chuột phải vào một thẻ chưa chọn thì thay vào đó bạn thấy **N saved sessions**, mở hộp thoại lịch sử của riêng công cụ đó thay vì đưa bạn sang Projects.

![Hai thẻ công cụ được tích trong thư viện Tools, với thanh chọn nổi hiển thị "2 selected" và cung cấp Available offline, View sessions, Favourite và Hide](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery)
<!--
SHOT NOTE (misc-bulkbar-gallery): drive targets `[data-select="qr-code"]` /
`[data-select="gradient"]` - the `.tile-check[data-select="<ref>"]` checkbox button
confirmed directly in views/gallery.ts's card markup (the same attribute
cardMarkup gives every tile), so these two clicks tick both cards without
opening either tool.

SHOT NOTE (misc-sessions-by-tool, NOT PUBLISHED): the "View sessions" result
had a recipe of its own (`/#/p?tools=qr-code,d3`, views/projects.ts's
toolsBodyHtml()), dropped here because it has no `drive=` that can
manufacture its own content - a saved session isn't a click away, it has to
already exist, and build-docs-shots.ts gives every shot a fresh
`browser.newContext()`. It would publish an empty list. Same dependency the
`projects` shot above already carries; revisit if the pipeline gains a
storage-seeding hook.
-->


## Chia sẻ công việc của bạn

Một thiết kế đi ra ngoài theo một trong hai cách: dưới dạng một liên kết hoặc dưới dạng một file. Hộp thoại Share cho cả hai. Mở nó bằng **Share** trong các điều khiển xuất file; **Share link** trên một phiên đã lưu trong Projects mở đúng hộp thoại đó cho phiên ấy.

### Liên kết

Mọi trường đầu vào đều được ghi lại trong URL của trang, nên một liên kết *chính là* thiết kế. Ở đầu hộp thoại là liên kết sẵn sàng để sao chép, với hai mục thu gọn bên dưới.

- **Link options** chứa **Shortest link** (một thiết kế lớn tạo ra URL dài, nên tuỳ chọn này nén toàn bộ trạng thái vào một token gọn và cho bạn thấy tiết kiệm được bao nhiêu ký tự; dạng dễ đọc thì vẫn luôn có sẵn), **Password-protect this link** (AES-256 phủ toàn bộ liên kết, mật khẩu không bao giờ nằm trong đó) và **Pin this tool version** - cờ `_v`, ghim liên kết vào đúng phiên bản công cụ bạn đang xem để một bản cập nhật sau này không đổi được thứ nó render.
- **Link behaviour** là điều xảy ra khi người nhận mở nó: toàn màn hình, bảng xuất file mở sẵn, tự tải xuống khi mở với `&export` hoặc tự sao chép vào clipboard với `&copy`.

Dán liên kết cho một đồng nghiệp, lưu vào bookmark hoặc commit nó. (Chi tiết đầy đủ: [Chế độ URL](/info/url-mode.html).)

**Một số công cụ biến chính liên kết thành toàn bộ sản phẩm.** Jump Page gom các liên kết của bạn vào một trang duy nhất để chia sẻ - một liên kết bio, một buổi nói chuyện hội nghị, một mặt tiền cửa hàng. Không có gì để host và không có tài khoản đứng sau nó: trang chính là liên kết, nên nó mở nhanh như chính URL di chuyển. Trong trình chỉnh sửa, bạn thấy trang hoàn chỉnh bên cạnh các trường nhập liệu; một khách truy cập mở liên kết sẽ thấy nó ở toàn bộ chiều rộng, mỗi cảnh một liên kết khi họ cuộn.

![Jump Page trong trình chỉnh sửa - tiêu đề, ba cảnh liên kết mỗi cảnh có lớp phủ màu riêng và một footer Made with Lolly, được bố trí thành một trang trong canvas](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

**Hộp thoại nói rõ thứ một liên kết không thể mang theo.** Ba thứ không nhét vừa vào một URL: một ảnh hoặc file bạn thêm từ thiết bị này, một giá trị văn bản rất dài hoặc một danh sách rất lớn. Từng thứ được đếm khi liên kết đang được dựng. Nếu có gì đó buộc phải bỏ lại, hộp thoại gọi tên nó và chỉ bạn sang phần file bên dưới, thay vì đưa cho bạn một liên kết mở ra mà thiếu mất hình. Một liên kết chỉ đơn thuần *dài* thì nhận một ghi chú nhẹ hơn kèm số ký tự, vì việc nén vẫn có thể cứu được độ dài.

### File .lolly

**Download .lolly**, trong hộp thoại Share của công cụ bạn đang làm, ghi cùng thiết kế đó ra thành một file. Nó mang theo phiên đã lưu cùng với những ảnh và file bạn thêm từ thiết bị của mình. Tác phẩm trong catalogue mà thiết kế dùng tới cũng đi kèm bên trong, nên file mở ra đầy đủ trên một máy chưa từng thấy thương hiệu của bạn. Nơi thiết bị của bạn có bảng chia sẻ, **Send to…** đưa thẳng file đó sang đấy (AirDrop, một lượt chia sẻ trên Android) thay vì lưu ra ổ đĩa.

Một file `.lolly` là một file zip bình thường. Đổi tên nó thành `.zip` rồi mở ra: ảnh của bạn nằm dưới `assets/uploads/` còn tác phẩm catalogue dưới `assets/catalog/`, mỗi thứ giữ tên thật và phần mở rộng của nó, `manifest.json` liệt kê từng thứ một và một file README ở trên cùng nói file này là gì.

Ba điều là của bạn để quyết định trước khi nó đi:

- **Tên bạn có được đưa vào hay không.** Tên, email và tổ chức của bạn chỉ được ghi vào file khi **Use my details to create** được bật trong hồ sơ của bạn. Khi tắt, file chỉ ghi rằng nó được tạo bằng Lolly và khi nào - không có gì về bạn.
- **Tài sản có bản quyền có được đưa vào hay không.** Các tài sản có bản quyền và khóa theo thương hiệu bị giữ lại mặc định. Nếu thiết kế dùng bất kỳ tài sản nào như vậy, hộp thoại cho biết có bao nhiêu và đưa ra hai nút - *Download without them* hoặc *Include and download* - vì việc bao gồm chúng nghĩa là trao file thực cho bất kỳ ai mở `.lolly`.
- **Công cụ có được đưa vào hay không.** **Include the tool** đóng gói các file của chính công cụ đó cùng thiết kế, để nó mở được trên thiết bị không có công cụ ấy. Mặc định được tích cho một công cụ tùy chỉnh - một bản fork hay một công cụ thương hiệu riêng mà người nhận khó có sẵn - và không tích cho một công cụ đã có trong danh mục đã ký, vì bản của họ đến từ cùng nguồn. (Trên một bản build không có danh mục đã ký, mọi công cụ đều tính là tùy chỉnh và ô này mặc định được tích.)

**Mở một tệp.** Thả một tệp `.lolly` vào ứng dụng: các tài sản sẽ vào thư viện của bạn, phiên làm việc sẽ vào Projects và công cụ sẽ mở lên với nó. Không có gì của bạn bị ghi đè: phiên làm việc đến dưới dạng một vị trí lưu mới, trong khi một tài sản đã có sẵn trên thiết bị này được đối chiếu bằng checksum và được tái sử dụng thay vì bị nhân bản. Mọi phần đều được kiểm tra đối chiếu với checksum riêng của tệp trong quá trình nhập vào, nên một bản sao bị hỏng trong quá trình truyền sẽ bị từ chối thay vì được nhập vào một nửa.

Nếu file mang theo một công cụ bạn chưa có, Lolly hỏi trước khi công cụ đó được phép chạy: **Trust this tool?** nêu tên nó và tác giả của nó, đồng thời nói thẳng rằng mở nó là chạy mã của chính công cụ đó trên thiết bị của bạn, với **Trust & install** là lối đi tiếp. Nếu bạn từ chối, phần việc được chia sẻ vẫn được lưu vào dự án của bạn, chờ ở đó tới ngày bạn thêm công cụ ấy. (Có một loại công cụ chưa nạp ngoài được - loại có mã chạy dưới dạng module - và nó bị từ chối theo cùng cách.)

Một liên kết và một file đều trao đi một ảnh chụp tại một thời điểm. Để làm việc trên cùng một phiên *cùng lúc* với người khác - hai thiết bị, không máy chủ, không cần internet nếu bạn ở chung một mạng - xem [Làm việc cùng nhau](/info/collaborate.html).

## Camera trực tiếp (các công cụ phản ứng theo chuyển động)

Mọi **Filter** ảnh - Halftone, Scanline, Posterize, Voronoi cells, Colour treatment, Pixel stretch và Imperfections - đều hiện một nút **Go live** ở nơi có camera. Bật nó lên và hiệu ứng bám theo từng khung hình webcam của bạn, nên nó phản ứng theo chuyển động; bạn có thể ghi lại kết quả thành GIF, WebM hoặc MP4. Các khung hình được đọc và xử lý **trên thiết bị của bạn** và không bao giờ rời khỏi đó, còn camera được giải phóng ngay khi bạn dừng lại hoặc rời khỏi công cụ. (Bộ chọn ảnh nào cũng có **Take a photo** để chụp một khung hình đơn thành một ảnh trên thiết bị.)

## My images

Khi một công cụ cho phép bạn thêm ảnh từ thiết bị, ảnh được giữ đúng như lúc nó đến - nên một Content Credential trên đó vẫn xác minh được - và lưu vào thư viện cá nhân **My images** của bạn (dưới **Profile → Storage**). Chỉ một file thực sự khổng lồ mới hỏi là giữ nguyên hay giảm kích thước. Dùng lại nó ở bất kỳ công cụ nào. Để xoá EXIF/GPS ngay khi ảnh đi vào, hãy bật **Strip metadata from uploads** trong hồ sơ của bạn. Không có giới hạn số lượng: thư viện hoàn toàn cục bộ và chỉ bị giới hạn bởi dung lượng thiết bị của bạn - quản lý hoặc xoá ảnh ngay tại đó.

## Catalogue - thư viện tài sản của bạn

**Catalogue** (`#/c`, hoặc phần **Catalog** trong bộ chuyển Projects · Tools · Utilities · Catalog ở đầu mọi màn hình danh sách) gom mọi thứ các công cụ của bạn có thể dùng tới - logo thương hiệu, hình ảnh, âm thanh và chuyển động, nhóm theo loại - và đây cũng là nơi **các file sáng tạo của riêng bạn** nằm. Không máy chủ, không bảng quản trị, không pull request: tất cả đều nằm trên thiết bị của bạn.

![Catalogue - tài sản thương hiệu, ô màu và font, cùng các file bạn tự tải lên](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=catalogue)

- <!--i:upload--> **Đưa tệp của bạn vào.** Kéo bất kỳ hình ảnh, SVG, đoạn âm thanh, video, Lottie, PDF hoặc bộ slide PowerPoint nào vào vùng tải lên - hoặc nhấp để chọn - và nó sẽ có ngay trong danh mục của bạn, sẵn sàng trong bộ chọn tài sản của mọi công cụ. Một PDF nhiều trang hoặc một tệp `.pptx` sẽ hỏi bạn muốn giữ những trang hoặc slide nào - mỗi trang/slide trở thành một tài sản SVG. Nhập vào bao nhiêu tùy thích; nó không bao giờ rời khỏi thiết bị của bạn.
- <!--i:star--> **Đánh dấu yêu thích những gì bạn hay dùng.** ★ một tài sản (hoặc một mẫu màu thương hiệu) và nó sẽ được ghim lên đầu mọi bộ chọn, để logo hay màu sắc quen thuộc của bạn chỉ cách một cú nhấp.
- <!--i:folder--> **Sắp xếp gọn gàng.** Phân loại lại một tài sản vào một nhóm khác, ẩn một tài sản thương hiệu dùng chung mà bạn không sử dụng (với **Show hidden** để đưa nó trở lại) hoặc xóa hẳn các tệp bạn tự tải lên. Cùng thao tác chọn nhiều và thanh hành động nổi như ở Projects cũng hoạt động ở đây, nên bất kỳ điều gì trong số đó đều có thể áp dụng cho cả một lượt chọn cùng lúc.
- <!--i:layers--> **Tách một video khỏi nền của nó.** Mở chi tiết của một video hoặc nhấp chuột phải vào thẻ của nó trong bất kỳ bộ chọn tài sản nào và chọn **Remove background…** để lưu một phiên bản trong suốt thay thế - một WebP hoặc PNG động có kênh alpha thực sự. Chọn một **Method**: một **On-device model** cắt chủ thể ra khỏi một cảnh phức tạp, hoặc một **Colour key** tách nền dựa trên một phông nền phẳng, chiếu sáng đều như phông xanh (green screen) hoặc một bức tường trơn, với **Tolerance**, **Softness** và **Spill removal** để tinh chỉnh viền. Colour key không cần tải mô hình và không cần mạng, nên **Remove background** được cung cấp cho mọi video và thường cho kết quả sạch hơn trên những đoạn phim gọn gàng. Một điều khiển **Resolution** (360, 480, 720 hoặc 1080p, không bao giờ vượt quá nguồn) đánh đổi độ chi tiết lấy một tệp nhỏ hơn, nhanh hơn. Nó chạy như một tác vụ nền trên thiết bị của bạn. Kết quả cắt nền hoàn chỉnh được lưu bên cạnh bản gốc như một tài sản riêng, và Content Credential của video nguồn đi kèm theo như một thành phần (ingredient). (Xem [Tạo một lần, kết xuất giống nhau](/info/ai-features.html) để hiểu vì sao việc xóa nền vẫn là một chỉnh sửa thông thường.)

### Mang bảng màu và font của bạn đi khắp nơi

Bảng **Swatches** của Catalogue làm được nhiều hơn là chỉ hiển thị - nhấp vào một màu để sao chép nó, hoặc **tải xuống toàn bộ bảng màu thương hiệu** ở định dạng mà công cụ kia của bạn hiểu:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** hoặc **CSS classes** - đưa thẳng thương hiệu vào một stylesheet hay một bản build;
- <!--i:palette--> **Adobe Swatch Exchange (.ase)** - nạp vào Illustrator hoặc Photoshop;
- <!--i:pentool--> **GIMP palette (.gpl)** - dành cho GIMP hoặc Inkscape.

![Bảng Swatches - năm nút tải bảng màu chạy ngang phía trên, rồi mọi màu thương hiệu dưới dạng chip sao chép được](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Bảng **Fonts** liệt kê các bộ chữ thương hiệu của bạn kèm một nút **download** bên cạnh mỗi bộ, để cài trên máy hoặc trao cho một xưởng in. (Phòng Colours của [Brand Studio](/info/brand-studio.html) cũng có cùng tính năng tải bảng màu này.)

Tài sản là một nửa của con đường mở, tự làm lấy; nửa còn lại là **tự tạo công cụ của riêng bạn** - canvas tự do (Design, đã mô tả ở trên) cho phép bạn dựng một công cụ một cách trực quan, không cần viết mã.

## Âm thanh & khả năng tiếp cận

Lolly hướng tới việc dùng thoải mái với tất cả mọi người. Giao diện điều hướng được bằng bàn phím, các điều khiển tuỳ chỉnh đều mang nhãn đúng chuẩn cho trình đọc màn hình và bản xem trước trực tiếp của mỗi công cụ được phơi ra như một hình ảnh duy nhất có nhãn mô tả thứ nó đang tạo.

Một lớp **âm thanh hỗ trợ** nhẹ nhàng xác nhận việc bạn vừa làm - khi vào gallery, khi kiểm tra Content Credentials hợp lệ hay không hợp lệ, khi đóng một bảng, khi đổi một bộ lọc. Nó **tắt theo mặc định**: bật **Sound** ở bất cứ đâu có công tắc đó (popover tuỳ chọn của mỗi màn hình, hoặc **Profile**), và lựa chọn sẽ được ghi nhớ.

Bốn thiết lập tiện nghi tuỳ chọn nằm dưới **Profile → Accessibility**: **Reduce motion** (bỏ các hiệu ứng chuyển cảnh và điểm nhấn của ứng dụng), **Hide colourful previews** (thẻ gallery chỉ còn biểu tượng và chữ, ảnh thu nhỏ của dự án dịu lại), **High contrast** (viền, chữ và vòng focus đậm hơn) và **Large text** (chữ trong ứng dụng lớn hơn - nhãn, menu, chữ trên nút). Cả bốn đều làm dịu ứng dụng *quanh* công việc của bạn: chúng không bao giờ với vào canvas của một công cụ hay đổi một pixel nào trong thứ bạn xuất ra, và mỗi thứ đều tắt cho tới khi bạn bật nó. Chi tiết đầy đủ trong [Hồ sơ của bạn → Khả năng tiếp cận](/info/profile.html#accessibility).

Cạnh công tắc Sound là **Neurospicy Mode** - một bản nhạc nền tập trung, êm dịu, tuỳ chọn, phát khe khẽ trong lúc bạn làm việc. Bật nó lên sẽ mở một **khay trình phát** nhỏ ở góc dưới, đi theo bạn khắp ứng dụng; từ đó bạn có thể tìm và chọn một bản nhạc, tua tới và lùi, chỉnh âm lượng cùng thu nhỏ hoặc đóng nó lại. Danh sách nhạc trải qua vài danh mục - các giai điệu *Lolly Sings* sinh tự động, các vòng lặp và beat nền, âm thanh bạn tự tải lên và một số ít đài **radio** internet trực tiếp (những đài này cần kết nối; mọi thứ còn lại phát được ngoại tuyến). Nó **tắt theo mặc định** và, như Sound, được ghi nhớ qua các phiên và các thiết bị. Tắt Sound cũng tắt luôn tiếng bản nhạc tập trung này.

## Lưu trữ & quyền riêng tư

Mọi thứ được lưu trong cơ sở dữ liệu cục bộ của trình duyệt (IndexedDB): hồ sơ của bạn, các phiên đã lưu, ảnh đã tải lên và một bộ nhớ đệm nội dung catalog đã tải về. **Profile → Storage** hiển thị dung lượng đang dùng và cho phép bạn:

- <!--i:box--> **Clear cache** - xoá nội dung catalog đã tải về (sẽ đồng bộ lại ở lần tải sau).
- <!--i:trash--> **Clear all my data** - xoá sạch hồ sơ, các phiên và ảnh. *Không thể hoàn tác.*

![Thẻ lưu trữ trên màn hình rộng bằng điện thoại: mọi loại dữ liệu trên thiết bị đều được gọi tên, với nút Clear all my data ở dưới cùng](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Không dữ liệu cục bộ nào trong số này được truyền đi đâu cả - không telemetry, không render trên đám mây. Danh sách đầy đủ những gì ứng dụng từng tải về hay gửi đi nằm trong [Chính sách quyền riêng tư](/info/privacy.html), còn [Bề mặt máy chủ](/info/server-surface.html) liệt kê các thành phần máy chủ tuỳ chọn.

## Chuyển sang thiết bị khác

Vì mọi thứ đều nằm trên thiết bị của bạn, **Profile → Storage → Move to another device** cho phép bạn mang tất cả sang một bản cài đặt thứ hai - không tài khoản, không đám mây:

- <!--i:download--> **Export my data** tải xuống một file `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` duy nhất (các phần trong tên lấy từ hồ sơ của bạn và bị bỏ đi nếu chưa đặt; `<n>` là bộ đếm theo ngày để các lần xuất trong cùng một ngày không trùng nhau) chứa hồ sơ của bạn, mọi phiên đã lưu (kèm ảnh thu nhỏ), ảnh bạn đã tải lên và các tuỳ chọn của bạn (giao diện, độ rộng thanh bên, số liệu hoạt động cục bộ).
- <!--i:upload--> **Import data…** trên bản cài đặt kia đọc lại file đó. Nó **hợp nhất**: bất cứ thứ gì trùng tên (hồ sơ của bạn, một ô lưu phiên, một ảnh) được thay bằng bản đã nhập; mọi thứ khác trên thiết bị đó được giữ nguyên. Các phiên đã lưu tự liên kết lại với ảnh bạn đã nhập.

Bộ nhớ đệm catalog không nằm trong gói - nó tự tải lại trên thiết bị mới. Gói này là một file zip thông thường (`manifest.json` + `profile.json` + `sessions.json` + `assets.json` + `assets/blobs/…` + `prefs.json`, id định dạng `lolly-backup`), nên nó đi qua email, USB hay AirDrop mà vẫn nguyên vẹn và là cùng một định dạng mà mọi shell đều đọc được. Mỗi phần đều có checksum, nên một file hỏng trên đường truyền bị bắt lúc nhập vào chứ không được khôi phục nửa vời. (Đặc tả định dạng đầy đủ: [Chuyển dữ liệu](/info/data-transfer.html).)

## Nhập một thiết kế (Figma, Penpot, Illustrator, InDesign)

Bạn có thể đưa một thiết kế có sẵn vào Lolly và tiếp tục làm việc trên đó: mở **Design**, nhấp **Import a design** trên thanh công cụ của canvas, rồi chọn một file Figma **.fig** hoặc SVG, một file Penpot **.penpot**, một file Illustrator **.ai** / **.pdf** hoặc một file InDesign **.idml**. Các lớp trở thành những khối chỉnh sửa được trên canvas tự do - văn bản vẫn gõ lại được, hình ảnh đáp xuống **My images** còn kiểu chữ và màu sắc tuân theo các biến thương hiệu toàn cục - rồi kết quả được lưu, chia sẻ và render như bất kỳ phiên nào khác. Việc phân tích diễn ra hoàn toàn trên thiết bị của bạn. Chi tiết đầy đủ: **[Nhập một thiết kế](/info/design-import.html)**.

## Xuất file

Xem **[Xuất file & Định dạng](/info/exporting.html)** để biết toàn bộ câu chuyện - chọn định dạng, kích thước đầu ra và đơn vị in ấn, độ trong suốt, video và sao chép/chia sẻ. Tóm gọn: chọn một định dạng, đặt kích thước nếu cần và **Download** (hoặc **Copy** vào clipboard).

## Chế độ Batch (Pro)

Dành cho người dùng chuyên sâu, **Batch** (liên kết từ gallery, nằm sau cờ tính năng Pro vốn bật theo mặc định) render nhiều biến thể cùng lúc - một bảng lưới nơi mỗi hàng là một tập trường đầu vào, được xuất cùng nhau. Lý tưởng để bản địa hoá một tấm thiệp sang hàng chục ngôn ngữ hoặc tạo mọi biến thể kích thước trong một lượt. Điền các hàng bằng cách gõ vào, dán thẳng từ một bảng tính hoặc nhập một file CSV (bạn cũng xuất ngược ra được một file), và đặt định dạng, kích thước, tên file xuất theo từng hàng. Lưu cả một bảng lưới thành một **phiên batch** có tên riêng để mở lại từ gallery, và tải mọi hàng xuống dưới dạng một file `.zip` duy nhất.

![Thanh công cụ batch - tên tệp zip, đơn vị, DPI và định dạng mà mọi hàng kế thừa, với Sessions và Render ở bên phải](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.pro-toolbar&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

Batch dùng để tạo **nhiều biến thể của cùng một mẫu** cùng lúc. Để render lại các phiên bạn **đã lưu từ trước**, hãy dùng **Projects → Render folder / Render selection** (ở trên) - không cần Pro.

## Chỉnh sửa cạnh nhau (Multi-edit)

Batch là nhiều biến thể của *một* thiết kế. **Multi-edit** là nửa còn lại của công việc: nhiều thiết kế đã lưu **khác nhau** cùng mở một lúc, để một thay đổi áp dụng cho tất cả. Tích chọn từ **hai đến tám** phiên làm việc đã lưu trong **Projects** và chọn **Edit together** từ thanh chọn; chúng sẽ mở thành các thẻ trực tiếp cạnh nhau tại `#/multi?s=<slot>,<slot>…`. Mỗi thẻ là một bản kết xuất thực của phiên làm việc đó, không phải một ảnh thu nhỏ đã lưu sẵn, nên những gì bạn thấy chính là những gì sẽ được xuất ra.

Một thanh bên điều khiển cả đám:

- <!--i:sliders--> **Shared** đứng đầu - mọi trường đầu vào mà từ hai phiên đã chọn trở lên khai báo *giống hệt nhau* (cùng id, cùng kiểu, cùng ràng buộc - đúng quy tắc gộp mà bảng lưới batch dùng cho các cột của nó). Sửa một điều khiển dùng chung một lần và giá trị toả ra mọi phiên có khai báo nó, ngay trên từng thẻ. Hai phiên của cùng một công cụ chia sẻ mọi thứ; hai công cụ khác nhau chia sẻ đúng những gì chúng tình cờ có chung, không hơn.
- <!--i:document--> Bên dưới là **một thẻ thu gọn cho mỗi phiên** với toàn bộ trường đầu vào của riêng phiên đó, đủ chi tiết như thanh bên của chính công cụ - bộ chọn tài sản, nhóm hàng lặp lại, trường màu - cộng một khối xuất file gọn: **Format**, **W** / **H**, **Unit**, **DPI** và nút **Download** của riêng nó. Nút Download đó lưu phiên trước rồi render nó qua đường xuất phiên thông thường, nên file mang đúng tên, định dạng và Content Credentials như khi xuất thẳng từ công cụ.
- <!--i:search--> **Filter inputs…** ở trên cùng lọc hẹp các điều khiển trên *mọi* thẻ cùng lúc - đó là cách bạn tới được "dòng tiêu đề" trong tám phiên mà không phải cuộn đi tìm.

Nhấp vào canvas bất kỳ (hoặc nhấn Enter trên nó) và thẻ thanh bên của phiên đó mở ra và cuộn vào tầm nhìn. **Save all** ghi mọi phiên trở lại ô lưu của riêng nó. **Download all** lưu trước, rồi render cả bộ qua đúng đường ống như **Render selection** của Projects - một file zip, kèm tuỳ chọn khoá bằng mật khẩu được đưa ra trên đường đi.

Hai giới hạn nói thẳng. Trần hai đến tám là thật: mỗi thẻ gắn một runtime sống của riêng nó, và đó là con số còn giữ được độ mượt - một liên kết đòi nhiều hơn (hoặc đòi một phiên không còn tồn tại) sẽ báo thẳng ra thay vì tải nửa vời. Và liên kết gọi tên các ô lưu của *bạn*, nên nó mở lại đúng bộ đó trên thiết bị này; đây không phải một liên kết chia sẻ.

Khi lựa chọn lớn hơn tám, trộn nhiều công cụ hoặc gồm cả ảnh lẫn phiên làm việc, lối thoát là **Edit as sheet** trên cùng thanh lựa chọn đó: nó mở cả lựa chọn thành **các hàng trong bảng lưới batch** (`#/pro?s=…`), không giới hạn số lượng và không đòi cùng một công cụ. Thư mục nằm ngoài cả hai - chúng có đường mở-trong-lưới riêng. ([Tìm kiếm](/info/search.html) là thứ duy nhất chưa với tới đây: Multi-edit là màn hình duy nhất mà thanh tìm kiếm không biết tới.)

## Ngoại tuyến & cài đặt

Lolly là một PWA. Sau lần tải đầu tiên nó chạy được **ngoại tuyến** - hãy cài nó từ thanh địa chỉ trình duyệt (hoặc *Add to Home Screen* trên di động) để có trải nghiệm giống ứng dụng, toàn màn hình. Nó tự cập nhật khi bạn online trở lại.

Về các bản cập nhật: nếu một view không tải được ngay sau khi cập nhật (một bảng trống, một dòng "failed to fetch" ở góc màn hình), hãy tải lại trang một lần - ứng dụng sẽ nhận phiên bản mới một cách gọn gàng và công việc, phiên làm việc cùng thương hiệu của bạn không hề bị ảnh hưởng. Nó lưu trữ mọi thứ trên thiết bị của bạn, không phải trong trang.
