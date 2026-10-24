# Design: canvas tự do

Design là công cụ cho những bố cục mà không mẫu nào bao quát được: một tấm áp phích từ đầu, một bộ trang chiếu, một tác phẩm chuyển động có nhạc nền. Thay vì một biểu mẫu các điều khiển, bạn có một canvas các hộp để kéo, đổi kích thước, xoay và gõ vào. Nó xuất qua cùng đường kết xuất như mọi công cụ khác, nên những gì bạn thấy trên canvas là tệp bạn nhận được.

Trang này dẫn qua canvas từ hộp đầu tiên đến một bộ trang hoàn chỉnh: cửa sổ, tạo hình các hộp, vẽ hình khối của riêng bạn, đặt cảnh 3D và các công cụ khác, thêm thời gian, kiểm tra kết quả và trình chiếu bộ trang hoàn chỉnh. [Using Lolly](/info/using.html) đề cập những gì Design dùng chung với mọi công cụ, như lưu và chia sẻ.

![Canvas tự do của Design - khung tranh cùng bảng dán bao quanh nó](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

## Cửa sổ Design

**Thanh trên** bắt đầu với **Home**, **File menu** và tên tài liệu (nhấp tên để đổi tên tài liệu). Giữa là **Undo**, **Redo**, **History**, các điều khiển thu phóng (với **Fit all** và **Fit artboard**) và công tắc cho **Timeline**, **Navigator** và **Inspector**. Bên phải là **Share**, **Present** và **Export**. Trên điện thoại, các nút ít dùng hơn chuyển vào **More actions**.

**Thanh công cụ** dọc bên cạnh chứa menu Lolly và các công cụ bạn vẽ: **Pointer**, **Add a box**, **Pen**, **Edit points**, **Line**, rồi các nút Timeline, Artboards và Auto-arrange.

![Thanh công cụ của canvas tự do: tay cầm kéo, menu Lolly, rồi Pointer, Add a box, Pen, Edit points, Line, Timeline, Artboards và Auto-arrange](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

Canvas hoạt động như bàn dán của nhà thiết kế quanh artboard:

- **Để hộp ngoài artboard.** Kéo một hộp qua mép khung và nó vẫn hiện và chọn được. Mọi thứ ngoài khung bị làm mờ, và khung giữ bóng của nó để đánh dấu nơi tệp bắt đầu.
- **Chỉ artboard được xuất.** Mọi thứ ngoài khung, hoặc phần hộp thò qua mép, bị cắt khỏi đầu ra ở cả định dạng điểm ảnh lẫn vector.
- **Thu nhỏ quá Fit** để thấy mọi thứ bạn đã để ngoài.
- **Đổi kích thước artboard** bằng cách đổi kích thước xuất. Các hộp giữ vị trí, nên bạn có thể dựng lại khung bố cục quanh nội dung có sẵn.

![Sân khấu chỉnh sửa: artboard ở chính giữa phía trước, thanh công cụ bên trái và HUD thu phóng ở góc](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&chrome=1&dark=1&filename=seq-studio-stage)

### Navigator và Inspector

**Navigator** liệt kê mọi artboard (có đề mục **Artboards**, hoặc **Slides** trong bộ trang) dưới dạng một nhóm gập của các **Layers** của nó. Chọn tên artboard để nhảy tới đó, mở rộng để chọn hoặc sắp xếp lại các lớp và dùng phím mũi tên để di chuyển trong danh sách; Left quay về đề mục artboard. **Pages** gom artboard thành các trang có tên, và chọn một trang chỉ đổi artboard nào trình soạn thảo hiển thị.

**Inspector** đặt các điều khiển văn bản hoặc ảnh của đối tượng đã chọn lên đầu. Các chip tùy chọn bao quát những lựa chọn nhanh, và **Advanced** chứa chi tiết tạo kiểu. Trên điện thoại, Inspector mở như một tấm từ **More actions**; Escape hoặc Back đóng tấm và giữ vùng chọn của bạn.

![Phần Document của Inspector: các thẻ Selection và Canvas, rồi Dimensions và Style & look](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

## Đổi kích thước, phóng to thu nhỏ và xoay

Chọn một đối tượng, rồi kéo một tay nắm để đổi kích thước, hoặc kéo tay nắm tròn bên dưới vùng chọn để xoay đối tượng. Một lần kéo kích thước hoạt động theo một trong hai chế độ:

- **Resize**, mặc định, chỉ đổi hộp. Văn bản ngắt dòng lại theo kích thước mới, còn cỡ chữ, độ dày nét, bán kính góc và hiệu ứng giữ nguyên.
- **Scale** phóng to hoặc thu nhỏ cả đối tượng cùng nội dung: cỡ chữ, nét, bán kính góc, đổ bóng, làm mờ, đệm và khoảng cách đều đổi cùng một mức.

Nhấn `K` để bật hoặc tắt Scale. Không có bàn phím, chọn **Scale mode** trong menu Lolly, hoặc nhấn giữ nút **Pointer** trên thanh công cụ (hoặc nhấp chuột phải vào nút) và chọn **Scale**; trên màn hình cảm ứng, thanh đối tượng cũng có công tắc Scale. Khi Scale bật, nút Pointer hiện biểu tượng Scale và mỗi tay nắm có một chấm ở giữa. `V` hoặc **Escape** quay về Resize và giữ vùng chọn. Mọi tài liệu mở ra với Scale tắt, nên không ai vô tình phóng to nét.

**Phóng to bằng một con số.** Với Scale bật, hoặc khi chọn nhiều đối tượng, nhấp vào số hiển thị trên thanh đối tượng để mở popover **Scale**. Gõ phần trăm, chiều rộng hoặc chiều cao, chọn điểm đứng yên trên lưới 3 x 3 và chọn **Apply**. Mỗi lần phóng to là một bước hoàn tác.

**Nhiều đối tượng.** Vùng chọn nhiều đối tượng có tay nắm trên các cạnh cũng như các góc. Khi mọi đối tượng đều thẳng hoặc xoay theo bội của một phần tư vòng, và vùng chọn không chứa nhóm hay hình tròn, kéo góc đổi chiều rộng và chiều cao tự do. Nếu không, vùng chọn giữ tỷ lệ và số hiển thị thêm **Proportional**. Khi bạn kéo, một nhãn nhỏ hiện kích thước, hoặc phần trăm ở chế độ Scale.

**Lật một vùng chọn.** Nhấp chuột phải và chọn **Flip horizontal** hoặc **Flip vertical**, hoặc nhấn `Shift+H` hay `Shift+V` (Shift, vì `V` trơn là Pointer). Phép lật là một biến đổi thật, nên SVG, PDF và PNG xuất ra giữ phép lật.

**Các phím bạn giữ khi kéo** có hiệu lực ngay lúc bạn nhấn hoặc thả; bảng phím tắt (`?`) cũng liệt kê chúng.

| Giữ | Đổi kích thước hoặc phóng to | Xoay | Di chuyển |
|---|---|---|---|
| **Shift** | Giữ tỷ lệ (Scale luôn như vậy) | Xoay theo bước 15 độ | Không đổi |
| **Alt** (Option) | Làm việc từ tâm | Xoay tự do | Tắt bắt dính và lưới |
| **Cmd/Ctrl** | Tắt bắt dính và lưới | Xoay tự do | Tắt bắt dính và lưới |

Khi không giữ phím nào, một lần xoay được kéo về mức 15 độ gần nhất khi nằm trong vòng 4 độ so với mức đó. Artboard không xoay, nên không có tay nắm xoay.

::: details Tay nắm, vùng chộp và cảm ứng
**Chộp bất kỳ đâu dọc theo cạnh.** Mỗi cạnh của vùng chọn là một dải đổi kích thước dọc suốt chiều dài của nó, và với chuột hoặc bút có một vùng xoay ngay ngoài mỗi góc. Con trỏ cho thấy một lần kéo sẽ làm gì. Một lần nhấn trong dải hoặc vùng chỉ thành đổi kích thước hay xoay khi bạn bắt đầu kéo, nên một cú nhấp thường vẫn chọn như trước. Đối tượng bị khóa không có tay nắm, dải hay vùng.

**Đối tượng nhỏ vẫn di chuyển được.** Với đối tượng rộng từ 25 điểm ảnh màn hình trở xuống, các tay nắm giữa ẩn đi và các tay nắm khác dịch ra một chút khỏi đường viền, nên một lần nhấn lên đối tượng sẽ di chuyển đối tượng. Từ 10 điểm ảnh trở xuống, các tay nắm góc cũng biến mất, và một đường mảnh giữ một tay nắm ở mỗi đầu. Một lần nhấn ngay cạnh đường mảnh hoặc đối tượng nhỏ xíu, cách xa tay nắm, sẽ di chuyển đối tượng.

**Vùng chộp lớn.** Trên màn hình cảm ứng, mỗi vùng góc bằng một phần tư chiều rộng và chiều cao của vùng chọn trên màn hình, giữa 24 và 44 điểm ảnh, và mỗi vùng cạnh phủ đoạn giữa hai góc. Khi vùng chọn quá nhỏ cho điều đó, các vùng dịch ra ngoài đường viền. Vùng dưới con trỏ hoặc ngón tay của bạn được tô bóng. Để có cùng các vùng đó với chuột hoặc bút, bật **Large grab areas** trong menu Lolly; cài đặt ở lại trên thiết bị này.

**Hai ngón tay trên vùng chọn.** Trên màn hình cảm ứng, đặt hai ngón lên một đối tượng đã chọn: chụm để phóng to, xoắn để xoay hoặc di chuyển cả hai ngón để mang vùng chọn đi, tất cả là một bước hoàn tác. Khi Scale bật, chụm cũng phóng to nội dung; khi Scale tắt, nó đổi kích thước theo tỷ lệ. Một cú xoắn bắt vào mức 15 độ gần nhất khi đủ gần, và di chuyển hai ngón không bao giờ bắt dính. Ngón đầu tiên phải đặt lên vùng chọn và ngón thứ hai phải theo sau nhanh, trên vùng chọn hoặc ngay ngoài mép. Hai ngón ở bất kỳ chỗ nào khác sẽ thu phóng và kéo khung nhìn, và cũng vậy với hai ngón trên vùng chọn chứa artboard hoặc đối tượng bị khóa, phủ phần lớn khung nhìn hoặc vượt khỏi mép.
:::

## Vẽ hình khối của riêng bạn

Hộp, hình tròn và khung bo góc bao quát hầu hết bố cục. Với bất kỳ hình nào khác, hãy vẽ: nút **Pen** của thanh công cụ (hoặc `P`) đưa bạn vào chế độ vẽ. Ba phím đơn chuyển giữa các chế độ: `V` cho Pointer, `P` cho Pen và `N` cho **Edit points**. Pointer luôn là lối thoát.

- **Nhấp** để đặt một điểm. Với kiểu đường cong mặc định, **nhấp và kéo** kéo tay nắm của điểm ra để tạo đường cong; giữ **Alt** khi nhấp để có góc nhọn. (Với các kiểu đường cong khác, mọi điểm là góc và kéo không làm gì.)
- Các điểm bắt dính vào artboard và các hộp khác khi bạn đặt. Alt tắt lưới khi bạn vẽ, và tắt cả lưới lẫn các cạnh khi bạn kéo một điểm sau đó.
- **Nhấp điểm đầu tiên** để đóng hình. Nếu không, nhấn **Enter**, nhấp đúp hoặc đổi công cụ, và nét vẽ được giữ.
- **Escape** hoạt động từng bước: lần nhấn đầu bỏ nét vẽ, lần thứ hai rời bút.
- **Delete** khi đang vẽ bỏ điểm cuối.

Kết quả là một hộp bình thường. Di chuyển, đổi kích thước, xoay, nhóm, căn chỉnh, sắp xếp lại lớp, tô, đổ bóng hoặc làm mờ đường dẫn như bất kỳ hộp nào khác. Đường dẫn đầu tiên nhận màu tô và nét mà thương hiệu của bạn dành cho đường dẫn, và mỗi đường dẫn mới sau đó nhận những gì bạn dùng gần nhất. Trong một công cụ mà thương hiệu không đặt gì cho đường dẫn, đường dẫn mới được vẽ nét bằng màu bạn vẽ, nên hình không bao giờ vô hình.

**Chỉnh lại các điểm.** Nhấp đúp hình, hoặc dùng **Edit points** trên thanh đối tượng. Kéo một điểm để di chuyển, kéo tay nắm để chỉnh lại hướng đường cong, nhấp lên đường cong để chèn điểm hoặc kéo một khung quanh nhiều điểm và nhấn Delete. Một đường dẫn luôn giữ ít nhất hai điểm.

**Spline type** quyết định loại đường cong chạy qua các điểm của bạn:

| Loại | Tác dụng |
|---|---|
| **Smooth (auto)** | Mặc định. Tự tính độ dài tay nắm, nên các cú nhấp thường cho đường cong mượt. Một tay nắm bạn đặt ghim hướng, và đường cong vẫn tự quyết độ dài. |
| **Bezier handles** | Bút cổ điển: bạn điều khiển mọi tay nắm, và chèn một điểm không bao giờ làm đường cong di chuyển. |
| **Through the points** | Đi chính xác qua mọi điểm, không có tay nắm. |
| **B-spline** | Chảy gần các điểm thay vì đi qua chúng, cho nét mềm hơn. |
| **Straight lines** | Một đa tuyến. |

Chuyển một đường dẫn sẵn có sang loại tự tính tay nắm sẽ hỏi trước, vì độ dài tay nắm bạn đặt không thể khôi phục; chuyển sang **Bezier handles** luôn không mất gì. Giữa lúc đang vẽ, việc chuyển áp dụng ngay, và các tay nắm bạn đã kéo bị bỏ.

Mỗi điểm cũng mang một quy tắc liên tục, thể hiện bằng hình của nó: vuông cho **Corner** (tay nắm di chuyển độc lập), tròn cho **Smooth** (tay nắm thẳng hàng) và tròn có vòng cho **Symmetric** (thẳng hàng và bằng độ dài). Đặt quy tắc cho các điểm đã chọn và đường cong theo ngay.

![Hai path vẽ bằng pen render thẳng từ một liên kết: một đường cong chữ S có nét và một khối tròn khép kín được tô đầy](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

Một đường dẫn đã vẽ đi cùng trong liên kết chia sẻ như bất kỳ hộp nào khác và kết xuất giống nhau từ dòng lệnh.

## Kết hợp hình khối

Chọn hai hoặc nhiều hình, nhấp chuột phải canvas (chạm hai ngón trên cảm ứng) và chọn:

- **Union** gộp chúng thành một hình với lớp tô của hình trên cùng.
- **Subtract** cắt mọi thứ phía trên khỏi hình dưới cùng.
- **Intersect** chỉ giữ phần chồng lên nhau.
- **Exclude** giữ mọi thứ trừ phần chồng.

Ba thao tác khác dùng cho một hình đơn. **Outline stroke…** biến nét thành đường viền được tô cùng độ dày. **Offset path…** nở đường viền ra ngoài hoặc, với số âm, thu vào trong. **Simplify** dựng lại đường dẫn với ít đoạn hơn mà giữ nguyên đường viền.

![Một hình lưỡi liềm và một chiếc nhẫn có lỗ thật, cả hai đều tạo bằng Subtract](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D%26w%3D1080%26h%3D1080&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&filename=path-ops-boolean-result)

Kết quả là một đường dẫn mới bạn có thể tiếp tục chỉnh bằng bút, lưu dưới dạng đường cong Bezier thường, nên kiểu spline ban đầu không được giữ lại. Lỗ là lỗ thật: điều khiển **Fill rule** trên bảng nét quyết định các đường viền chồng nhau sẽ tô (*non-zero*) hay đục thủng (*even-odd*). Các thao tác từ chối thay vì phá hủy: yêu cầu giao hai hình không chồng nhau và không có gì thay đổi. Hộp văn bản và hộp ảnh không có đường viền, nên được bỏ qua.

## Cảnh 3D và công cụ trong một thiết kế

Một hộp có thể chứa nhiều hơn một bức ảnh. Cả hai loại dưới đây giữ một công thức thay vì ảnh đã kết xuất, nên chúng vẽ lại ở bất kỳ kích thước và thời điểm nào tài liệu yêu cầu, và cập nhật ở nguồn đến mọi thiết kế dùng nguồn đó.

### Các cảnh 3D

Chọn **3D scene** từ menu thêm của thanh công cụ và kéo một khung: 3D Studio mở trên hộp mới, và những gì bạn đặt ở đó quay về canvas. Sau đó, **Edit in 3D Studio** trong phần **3D scene** của Inspector mở lại studio. [Place a scene in Design](/info/3d-studio.html#place-a-scene-in-design) đề cập áp phích, dòng thời gian, xuất và chia sẻ.

### Công cụ trong một thiết kế

Chọn **Image** từ menu thêm của thanh công cụ, kéo một khung và chọn một công cụ trên thẻ **Tools** của bộ chọn. Công cụ lấp đầy khung bằng mặc định của nó, và Inspector mở phần **Tool** chứa các điều khiển riêng của công cụ đó. Đổi một trường và hộp cập nhật ngay sau đó, như một bước hoàn tác. **Image fit** và **Image position** hoạt động như với mọi bức ảnh, và **Replace with another tool or image** thay nội dung của hộp.

**Công cụ chuyển động** phát trong hộp: một minh họa lặp tiếp tục lặp trên canvas, theo đầu phát khi dòng thời gian mở và xuất từng khung hình sang GIF, MP4 hoặc WebM. Khi công cụ cho biết một vòng lặp dài bao lâu, hộp nhận một clip đúng độ dài đó, nên video chứa trọn các vòng lặp. Clip bạn đã chỉnh thời gian giữ nguyên thời gian của bạn, và tắt chuyển động của công cụ biến hộp thành ảnh tĩnh trở lại.

## Dòng thời gian (Sequence)

**Sequence** là dòng thời gian của Design: nó thêm thời gian vào canvas. Mọi hộp có thể bắt đầu ở một thời điểm, chạy trong một độ dài và có hoạt ảnh vào và ra, và dòng thời gian gắn dưới artboard là nơi bạn sắp xếp chúng. Bắt đầu từ mẫu **Video** của Design và một chuỗi ngắn đã có sẵn: hai thẻ chữ có thời gian trên hàng chuỗi và một lớp nhạc nền thủ tục bên dưới, để bạn thấy dòng thời gian hoạt động ra sao trước khi đổi gì.

![Dòng thời gian Sequence: thanh điều khiển vận chuyển, thước đo, một lane overlay, hàng chuỗi có nam châm với các clip và các chip nối liền, cùng dải Always on](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

Có hai loại hàng:

- **Hàng chuỗi** có tính từ tính. Các clip nối đuôi nhau, kéo một clip sắp xếp lại dãy và xóa một clip thì khoảng trống khép lại. Đây là trục chính.
- **Overlay lanes** là tự do. Một lower-third, logo hay phụ đề nổi trên trục chính vào thời điểm riêng, mỗi cái trong làn riêng.
- Bên dưới chúng, **Always on** chứa các hộp không có thời gian, hiện diện suốt chiều dài. Dấu `+` trên một chip chuyển nó vào một làn; **Make always on** đưa nó về.

Mở dòng thời gian trao bàn phím cho nó, nên Space và phím mũi tên điều khiển đầu phát. Một bố cục đã có thời gian sẽ tự mở dòng thời gian.

**Chỉnh sửa.** Kéo giữa clip để di chuyển, kéo gần một trong hai đầu để cắt tỉa và nhấn **Split at playhead** (hoặc `S`) để cắt đôi. Split cần một clip có **Length** thật và đầu phát nằm trong clip một đoạn, nên clip không xác định độ dài như lớp nhạc nền không thể tách. **Snap to edges** bật theo mặc định, bắt dính vào mép clip, đầu phát và giây tròn; giữ Alt để kéo không bắt dính. Mỗi lần kéo là một bước hoàn tác, và bản xem trước khi bạn kéo dùng cùng phép tính với kết quả.

Chọn một clip và trình kiểm tra cho các chỉnh sửa tương tự dưới dạng số: **Length**, **Trim in** (clip bắt đầu sâu bao nhiêu vào nguồn), **Speed** từ ×0.25 đến ×4, **Animate in** và **Animate out** với độ dài của chúng và **Mute clip**. Clip trên hàng từ tính không có trường **Start**, vì hàng sở hữu thứ tự.

**Chuyển cảnh** là các cài đặt sẵn: Fade, Pop, Grow, Rise, Drop, bốn Slides, Zoom in và out, Tilt, Swoop, Spin, Drift hoặc **Cut (no animation)**. Khoảng cách co giãn theo đối tượng, nên một cài đặt đọc đúng trên thẻ toàn khung lẫn huy hiệu nhỏ. Giữa hai clip trên hàng chuỗi, một **seam chip** chọn **Cut** hoặc **Crossfade**; mở lại để đặt **Length (ms)** và nhấn **Done**. Trong crossfade, clip đầu tiếp tục phát qua điểm cắt và mờ dần trong khi clip sau hiện lên, giống nhau trong bản xem trước và tệp.

**Âm thanh.** Một clip **Audio** nằm trên dòng thời gian như mọi clip khác, với dạng sóng, cắt tỉa và tắt tiếng. Lớp nhạc nền do mẫu Video tạo ra được tổng hợp lúc xuất, nên thanh của nó trơn và im lặng cho đến khi bạn kết xuất. Nhấn micro để **ghi lời thuyết minh** thẳng lên dòng thời gian, với đếm ngược và đồng hồ đo mức; bản ghi được lưu làm tài nguyên của riêng bạn tại đầu phát. Nút camera cạnh micro **ghi video** theo cùng cách, được cắt theo artboard khi ghi, để đồng nghiệp thêm clip từ một liên kết chung. Chọn bất kỳ clip có âm thanh và dải của nó mở dưới dòng thời gian cho âm lượng, pan, EQ, cao độ, chuẩn hóa và hiệu ứng như **Voice cleanup**; [Sound](/info/sequence-editor.html#sound) trong hướng dẫn trình biên tập chuỗi đề cập dải này. **Audio track** của bảng xuất là riêng: một lớp nền dưới cả clip, có fade và ducking.

![Dòng thời gian với clip nhạc đang được chọn: dải của nó chạy dọc phía dưới với Speed, Fades, Volume, Pan, EQ, Pitch, Normalize volume và ô Effect](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fbx%3Dt1%252Ctext%252C200%252C140%252C1500%252C220%252C0%252Crect%252C16%252C%252C100%252C%252Ccontain%252Cnormal%252CVoiceover%252520session%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252Cseq%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1%252C%252Cfalse%252C%252C60%252C%252C%252C1%257Ea1%252Caudio%252C200%252C500%252C400%252C80%252C0%252Crect%252C16%252C%252C100%252Clolly%25252Floops%25252F3-am-echoes%252Ccontain%252Cnormal%252C%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252C%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1.3%252C%252Cfalse%252C%252C60%252C%252C%252C1%26_sel%3Da1&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip&drive=click%3Abutton%3Ahas-text%28%22Inspector%22%29)

**Kết xuất.** Một bản xuất chuyển động vẽ, giải mã và mã hóa từng khung hình tại một thời điểm chính xác, nên tệp không phụ thuộc vào việc máy bạn theo kịp hay không, và MP4 cùng WebM không có trần khung hình thực tế. Độ dài dòng thời gian đặt thời lượng trừ khi bạn gõ một giá trị, và Content Credentials được đóng dấu như mọi bản xuất khác. Bản xuất tĩnh cho khung hình tại đầu phát, hoặc một bảng liên hệ từ trường **Frames**; xem [Stills from a timed composition](/info/exporting.html#stills-from-a-timed-composition). Một chuỗi bị giới hạn một giờ. GIF và PNG động giữ mọi khung hình trong bộ nhớ, nên phù hợp với clip ngắn. **Record live** bị ẩn ở đây vì kết xuất từng khung hình là đường tốt hơn.

**Khung khóa, chiều sâu và camera.** Một chuyển cảnh tạo hoạt ảnh cho clip khi nó đến và đi. Để tạo dáng cho một hộp trong clip (trôi, mờ dần, làm mờ, nhấc nó khỏi trang rồi đặt xuống), chọn clip và nhấn **+Keyframe**: hình thoi trong công cụ dòng thời gian, hình thoi trên thanh đối tượng của canvas hoặc **Shift+K** khi dòng thời gian có tiêu điểm. Vị trí đầu phát quyết định tư thế mà chỉnh sửa tiếp theo ghi. Cùng các khung khóa đó cho một bố cục có thời gian một camera tiến vào, lia và kéo nét. [Animating](/info/animating.html) là hướng dẫn đầy đủ, và [The sequence editor](/info/sequence-editor.html) đề cập chọn, onion skin, tách, cắt tỉa và đánh dấu.

## Trước khi xuất

Design kiểm tra tài liệu của bạn trước khi bạn gửi tệp. Thẻ **Before you export**, trong phần **Document** của Inspector và lần nữa trong bảng xuất, đọc cấu trúc lớp đã lưu, rồi xem canvas đã ổn định để tìm chữ bị cắt và độ tương phản màu phẳng. Nó hỏi cùng sổ đăng ký phông chữ mà việc chuyển SVG và PDF thành đường viền dùng, xem mỗi đoạn chữ có byte phông chữ để nhúng được không. Nền ảnh và nền chuyển sắc được liệt kê như kiểm tra bằng mắt thay vì cho một điểm tương phản bịa ra.

### Kiểm tra một bố cục với hệ thống thiết kế

Thẻ của bảng xuất cũng so sánh bố cục với hệ thống thiết kế của bạn, ở cùng phiên bản hệ thống thiết kế mà bản kết xuất dùng. Nó xem màu đã soạn, bí danh token, lựa chọn phông chữ và id tài nguyên ảnh. Một giá trị tùy chỉnh có thể là cố ý, và ảnh ngoài các tài nguyên thương hiệu đã khai báo là mục cần xem lại, không phải ảnh bị cấm.

Nơi có gợi ý màu hoặc phông chữ cụ thể, nút của nó đổi đúng lớp đó, và **Undo** khôi phục bản gốc. Lớp bị khóa hoặc đã đổi từ đó không bao giờ bị gợi ý cũ ghi đè. Chuyển sắc, hiệu ứng, nội dung công cụ lồng nhau, quyền và chất lượng chủ quan nằm ngoài phép so sánh này, và không kiểm tra nào chặn Download.

### Quy tắc nội bộ và tín hiệu văn phong

Thẻ của bảng xuất cũng kiểm tra các quy tắc nội bộ (house rules) mà hệ thống thiết kế của bạn mang theo, như độ đậm và căn lề văn bản, cặp màu được duyệt hoặc logo cho từng bề mặt, theo từng lớp. Mỗi phát hiện là một cảnh báo với tên lớp phía trên quy tắc. Một quy tắc mà bản dựng này không có bộ kiểm tra được liệt kê là chưa kiểm tra, không bao giờ là đã tuân theo. [Usage & rules](/info/brand-studio.html#usage-rules) liệt kê các quy tắc, và `lolly check` áp dụng chính các quy tắc đó cho một tài liệu đã lưu.

Cùng thẻ hiện tín hiệu văn phong cho văn bản mà tài liệu vẽ: dải của nó (none, weak, notable hoặc strong), rồi câu riêng của Verify với điểm trên 100 và tối đa ba cụm từ bị đánh dấu, mỗi cụm kèm lớp chứa chúng. **Open the text in Verify** đưa văn bản đó tới [Verify](/#/verify) để đọc đầy đủ; [AI evidence in Verify](/info/verify-ai-evidence.html) giải thích điểm cân nhắc những gì. Điểm là một tín hiệu, không phải phán quyết: nó đếm các mẫu thường gặp trong văn bản do máy sinh và không thể biết ai viết các từ. Lớp ẩn bị loại khỏi cả hai kiểm tra, và thẻ cho biết có bao nhiêu.

Các phát hiện quy tắc nội bộ và tín hiệu văn phong mạnh được tính vào tổng "to fix" của thẻ để dễ tìm. Chúng thông báo và không bao giờ chặn: Download vẫn dùng được, và không có gì để bỏ qua hay ghi nhận như ngoại lệ. Một tác tử làm việc trong tài liệu đang mở nhận cùng báo cáo qua công cụ site của nó ([Agents in an open document](/info/open-document-agents.html)).

Các kiểm tra in (vùng tràn lề, độ phân giải, độ phủ mực và số bản in) gia nhập cùng thẻ khi bạn bật **Settings → Feature flags → Print preflight**. Trong các công cụ khác, cờ đó là thứ làm thẻ hiện ra; [Export a file](/info/exporting.html) mô tả các kiểm tra in.

## Trình chiếu

Một tài liệu Design gồm các artboard đã là một bộ trang. Nhấn **Present** trên thanh trên và mỗi artboard trở thành một trang chiếu toàn màn hình, theo thứ tự các artboard nằm trên canvas. Nút đọc **Preview** cho đến khi **Design outcome** của tài liệu là **Slides**. Bộ trang chạy trên bản sao các artboard đã kết xuất, nên thoát ra đưa bạn về đúng chỗ cũ.

Mũi tên cạnh **Present** mở **Present from this slide**, **Speaker view**, **Present with camera**, **Narrate**, **Auto-advance slides**, **Loop the deck (kiosk)** và **Export slides as video**.

| Phím | Tác dụng |
|---|---|
| **Space**, `→`, **Page Down** | Bước hoặc trang chiếu tiếp theo (hoặc nhấp dải ở mép phải) |
| `←`, **Page Up** | Quay lại (hoặc nhấp dải ở mép trái) |
| **Home**, **End** | Trang chiếu đầu hoặc cuối |
| `O` | Tổng quan: mọi artboard theo cách sắp xếp trên canvas; nhấp một cái để mở |
| `S` | Speaker view: trang hiện tại, trang kế, ghi chú và đồng hồ trong cửa sổ thứ hai |
| `B` | Màn hình đen; phím bất kỳ đưa trang chiếu trở lại |
| `F` | Quay lại toàn màn hình |
| `K` | Tạm dừng hoặc khởi động lại bộ trang kiosk |
| **Escape** | Bóc một lớp: tổng quan về bộ trang, bộ trang về trình soạn thảo |

Một thanh điều khiển nhỏ hiện dần khi bạn di chuyển con trỏ và ẩn lại khi bạn dừng. Nếu trình duyệt chặn cửa sổ bật lên của speaker view, speaker view mở như một bảng phủ lên bộ trang. Ghi chú thuộc về từng artboard và không bao giờ hiện trên trang chiếu.

- **Reveal steps.** Nhấp chuột phải một hộp và chọn **Reveal at step 1**, **2** hoặc **3** thay cho **Always visible**, và hộp chờ đến khi bạn tiến tới bước của nó. Các hộp chung số xuất hiện cùng nhau.
- **Kiosk.** Cho một artboard một **Length** và bộ trang dừng ở đó từng ấy thời gian, rồi tiến tiếp sau một thanh tiến trình mảnh. Thêm `kiosk` vào liên kết và bộ trang quay vòng ở cuối, cho bảng hiệu.
- **Sub-slide stacks.** Nhấp chuột phải một artboard và chọn **Stack under the previous slide** để biến nó thành một bước của trang chiếu đó. Tổng quan hiện một thẻ, và hàng **Stack** của trình kiểm tra cho biết artboard thuộc trang nào.
- **Morph.** Khi hai trang chiếu liên tiếp đều có một hộp cùng tên **Morph match** (chẳng hạn `hero`), chuyển cảnh di chuyển, đổi kích thước và đổi màu hộp đó thay vì cắt. Chuyển cảnh **Morph** toàn bộ trang làm điều tương tự cho mọi cặp khớp.
- **Narration.** **Speaker notes** của mỗi artboard có thể được đọc to. Trong phần **Document** của Inspector chọn một **Voice**, tùy chọn giọng thứ hai để **Blend with**, **Speed** và **Lead-in** cùng **Tail** tính bằng mili giây; **Show captions when presenting** hiện các từ khi chúng được nói. Giọng chạy trên thiết bị của bạn, và cùng ghi chú đó trở thành nhạc nền của bản xuất video, âm thanh trang chiếu trong bản xuất PowerPoint và phim thuyết minh trong một [gói SCORM](/info/create/exporting.html#scorm-course-packages).

Bộ trang cũng là một liên kết. `?present` mở thẳng vào nó và `s=` chọn trang chiếu (một vị trí, id artboard hoặc `id.step` cho một bước dựng), và địa chỉ đi theo bạn, nên thứ bạn gửi là trang chiếu bạn đang ở. [Reserved URL parameters](/info/url-parameters.html#what-happens-on-open) ghi lại chúng.

**Present with camera** đặt camera, logo và chú thích tên của bạn lên các trang chiếu, với điều khiển riêng tư và cảnh đã lưu; xem [Presenting with camera](/info/presenting.html). Một hộp **Web page** có thể nhận bộ bấm chuyển trang trong buổi nói chuyện khi bạn bật **Make interactive** trong trình kiểm tra của nó: ở bước **Focus on click**, Up và Down điều khiển trang còn Next tiếp tục bộ trang. [Live pages that take the clicker](/info/interactive-pages.html) đề cập kiểu tiêu điểm, điểm dừng cuộn và phê duyệt trang.

## Đi tiếp từ đâu

- **[Text in Design](/info/text-composition.html)**: chỉnh sửa văn bản trên canvas, dẫn bài viết chảy qua các khung và kiểu chữ.
- **[Animating](/info/animating.html)**: khung khóa, chiều sâu, camera cảnh và các lớp Lift.
- **[Import a design](/info/design-import.html)**: mở tệp Figma, Penpot, Illustrator hoặc InDesign thành các hộp chỉnh sửa được.
- **[Share a design with rules](/info/create-a-tool.html)**: biến tài liệu Design thành công cụ chỉ với các đầu vào bạn chọn.
- **[Export a file](/info/exporting.html)**: định dạng, kích thước, đơn vị in và video.
