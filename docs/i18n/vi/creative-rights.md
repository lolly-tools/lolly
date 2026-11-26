# Quyền sáng tạo và ghi công

Bạn cần có thể dùng tác phẩm hay của người khác mà không phải trở thành chuyên gia về giấy phép, cũng không âm thầm bỏ quên người đã tạo ra tác phẩm. Vì vậy, Lolly giữ nguồn của mọi tác phẩm nó vẽ, đọc giấy phép được ghi lại cho tác phẩm, xác định giấy phép đó yêu cầu gì đối với cách bạn thực sự sử dụng, làm phần mà chương trình có thể làm và cho bạn biết phần chỉ bạn mới làm được.

::: note Không điều nào ở đây là tư vấn pháp lý
Cũng không điều nào là phán quyết về dự án của bạn. Lolly ghi lại các dữ kiện, áp dụng một tập quy tắc nhỏ đọc từ chính văn bản pháp lý của các giấy phép và cho thấy cách nó đi đến kết quả. Giấy phép có điều kiện là một lựa chọn bình thường, được phép. Nó không bao giờ bị trình bày như một tài nguyên bị lỗi.
:::

<!--i:eti-smile-->
## Bạn gặp điều này ở đâu

Các bộ emoji là trường hợp thường gặp. Twemoji dùng CC BY 4.0, nên một tiêu đề có emoji được xuất kèm ghi công nguồn cho hình vẽ. Cả hai bộ OpenMoji dùng CC BY-SA 4.0, nên đổi màu một ký tự của chúng theo phong cách thương hiệu là một bản phái sinh, và chia sẻ bản phái sinh đó yêu cầu bạn chọn một giấy phép tương thích một lần. Fluent (MIT), Noto và Blobmoji (cả hai dùng Apache 2.0) cũng được đăng ký, và mỗi bộ được xử lý theo giấy phép riêng đã được rà soát.

Việc chọn bộ không bao giờ bị chặn, và điều khiển chọn bộ hiển thị giấy phép ngay tại nơi bạn chọn. Các quy tắc tương tự cũng áp dụng cho một hình minh họa trong danh mục, một LUT, một phông chữ và mọi tác phẩm khác đã được ghi lại.

<!--i:eti-layers-->
## Ba dữ kiện được giữ riêng

"CC BY 4.0", "cách dùng này cần ghi công" và "ghi công có trong tệp bạn vừa tải xuống" là ba tuyên bố khác nhau, và Lolly giữ chúng riêng biệt:

- **Bằng chứng** là những gì một nguồn đã khai báo, được ghi lại đúng như khi tìm thấy, cùng người đã nói và nơi đã đọc. Lần nhập sau không bao giờ ghi đè bản ghi trước.
- **Nghĩa vụ** là kết luận mà các quy tắc đã được rà soát rút ra từ bằng chứng đó cho một cách dùng, một đường bàn giao và một nhóm người nhận.
- **Bàn giao** là những gì các byte hoàn chỉnh thực sự chứa, được đo bằng cách đọc lại chúng. Lolly chỉ nói đã kèm ghi công sau khi trình đọc tìm thấy chúng trong tệp đã bàn giao.

![Bằng chứng nguồn đã ghi lại và cách dùng đã chọn được đưa vào các quy tắc đã rà soát. Khi xuất, ghi công được chuẩn bị, rồi một bước kiểm tra bàn giao đọc các byte hoàn chỉnh để báo cáo những ghi công đã tìm thấy hoặc vẫn còn cần.](/info/diagrams/concepts/rights-evidence-to-delivery.svg)

<!--i:eti-eye-->
## Bạn thấy gì và cần làm gì

Cùng những cách diễn đạt xuất hiện trong bảng xuất, Lolly Verify, dòng lệnh và kết quả cho máy, theo thứ tự gần đúng về tần suất bạn sẽ gặp chúng.

| Bạn thấy gì | Ý nghĩa |
|---|---|
| Ghi công nguồn sẽ được kèm theo. | Ghi công đã được chuẩn bị và đường bàn giao có thể mang ghi công. Chưa có gì được ghi, nên đây không phải thông báo thành công. |
| Ghi công đã được kèm trong siêu dữ liệu của tệp này. | Các byte đã bàn giao được đọc lại, chứng thực được xác minh và mọi nguồn bắt buộc đều được tìm thấy trong chứng thực. |
| Ghi công và chứng thực có trong gói tải xuống. | Ghi công đi cùng sản phẩm dưới dạng tệp đi kèm. Giữ chúng cùng nhau khi chuyển tiếp. |
| Nếu bạn chia sẻ bản phái sinh này, nó cần một giấy phép tương thích. | Một nguồn ShareAlike đã bị thay đổi và kết quả sắp được dùng ngoài phạm vi riêng tư. Việc chọn chỉ là một thao tác, không phải một hộp thoại cho mỗi lần đặt. |
| Thêm ghi công này vào phần mô tả bài đăng. | Đường đã chọn không mang được chứng thực hay ghi công đọc được, nên bạn cần dán văn bản ghi công. |
| Không bắt buộc ghi công theo tuyên bố hiến tặng CC0 đã ghi lại. | Tuyên bố hiến tặng không yêu cầu gì. Dù vậy, vẫn có ghi công tự nguyện. |
| Giấy phép nguồn chưa được ghi lại. | Chưa có gì được ghi lại cho nguồn này. Đó là một khoảng trống cần bổ sung, không phải kết luận bất lợi cho tác phẩm. Nó không bao giờ là bằng chứng rằng tác phẩm được tự do chuyển tiếp. |
| Điều kiện đã được ghi lại, chưa được diễn giải. | Mã định danh được nhận diện và các điều kiện được liệt kê, nhưng không quy tắc nào ở đây đọc chúng. Không tự động cho phép, không tự động cấm. |
| Hai khai báo giấy phép không thống nhất. | Hai bản ghi nêu các giấy phép khác nhau và chưa có gì chọn quyền cấp phép nào áp dụng. |
| Ghi công không có trong tệp đã bàn giao. | Ghi công đã được hứa hẹn, lần đọc lại không tìm thấy nó và tệp vẫn là của bạn. Xuất lại, hoặc dùng văn bản ghi công bằng tay. |

Lolly không bao giờ nói với bạn rằng một tác phẩm không có tranh chấp quyền hoặc an toàn để dùng về mặt pháp lý, và không có lấy một huy hiệu giấy phép màu xanh nào ở bất cứ đâu trong sản phẩm. Không chương trình nào có thể kiểm tra một trong hai điều đó.

<!--i:eti-user-check-->
## Những gì vẫn thuộc về bạn

- **Lựa chọn giấy phép là của bạn.** Việc nhận quyền sở hữu tệp tách ba trạng thái từng được gộp làm một: chưa khai báo giấy phép công khai, thông báo bảo lưu mọi quyền rõ ràng và việc thực sự cấp giấy phép công khai. Lolly chỉ ghi dòng quyền cho hai trạng thái sau, không bao giờ lấy từ hồ sơ của bạn.
- **Tác phẩm của bạn không bị đổi giấy phép thay bạn.** Điều khoản của nguồn và khai báo đầu ra của bạn là các bản ghi riêng. Điều kiện ShareAlike áp dụng cho bản phái sinh mà nó điều chỉnh, không tự động áp dụng cho mọi thứ khác bạn đã tạo.
- **Tác phẩm riêng tư vẫn dùng được.** Các điều kiện áp dụng khi chia sẻ được nêu ra khi bạn định chia sẻ. Không điều gì ở đây trở thành lệnh cấm nhập, và không bảng câu hỏi về giấy phép nào đứng giữa bạn và tệp của chính bạn.
- **Một quyết định được ghi nhớ cùng các dữ kiện của chính nó.** Mọi lựa chọn bạn ghi lại đều được đóng dấu bằng dấu vân tay của các tác phẩm, cách dùng, đường bàn giao và nhóm người nhận liên quan. Thay đổi bộ, cách xử lý, định dạng hoặc nhóm người nhận thì câu hỏi sẽ được đặt lại. Không có công tắc chung để "bỏ qua giấy phép", vì bấm bỏ một cảnh báo không thể bàn giao ghi công hay cấp quyền.
- **Thông tin của bạn được giữ riêng với ghi công của bên thứ ba.** Xóa siêu dữ liệu cá nhân của bạn không xóa tên nghệ sĩ được ghi công, và ghi công bắt buộc không bao giờ là lý do để xuất thông tin liên hệ của bạn.

<!--i:eti-map-pin-->
## Lolly làm gì ở từng nơi

- **Trong danh mục.** Trang thông tin của tác phẩm hiển thị nguồn và người tạo, tên giấy phép chuẩn cùng nhãn gốc giữ ở bên dưới, ghi công có thể sao chép nếu đã được ghi lại và một dòng nói việc sử dụng yêu cầu gì. Một ô nêu yêu cầu; nó không bao giờ tuyên bố đã xuất xong.
- **Trong bảng xuất.** Thẻ Source credits xuất hiện trong Content protection khi một bản kết xuất dùng tác phẩm đã được ghi lại, bên cạnh Licence bạn chọn cho bản xuất của mình. Nó hiện trạng thái, văn bản ghi công trong Details, nút Copy credit và một thẻ ngay tại chỗ khi cần quyết định. Quyết định không bao giờ là hộp thoại chặn: quá trình tải xuống vẫn tiếp tục dù còn thao tác cần làm.
- **Trong tệp.** Bản xuất có đặt tác phẩm đã được ghi lại sẽ ghi một thành phần nguồn Content Credentials cho mỗi tác phẩm riêng biệt, gắn với các byte gốc tại địa chỉ công khai của chúng và chứa người tạo, giấy phép cùng liên kết, nguồn, bản sửa đổi và những thay đổi. Lolly ký những gì nó quan sát được. Nó không bao giờ ký một tuyên bố thay cho nghệ sĩ của nguồn gốc, và Lolly Verify cho biết trường hợp nào trong hai trường hợp đã xảy ra.
- **Trong gói.** Bản tải xuống không chứa được chứng thực, như hoạt ảnh `.lottie`, mang ghi công trong `CREDITS.txt` và `credits.json` bên trong gói. Các tệp đó được đọc lại sau khi ghi, và không có tuyên bố rằng chúng có chứng thực đã ký.
- **Sau khi ghi.** Các byte đã bàn giao được đọc lại trước khi bất cứ đâu nói rằng đã kèm ghi công. Chứng thực không xác minh được không được tính là ghi công đã bàn giao.
- **Trong tệp `.lolly` chỉnh sửa được.** Các byte được chuyển đi khi giấy phép đã rà soát ghi nhận quyền chuyển tiếp nguồn, khi hàng đó chứa các điều khoản của chính chủ sở hữu hoặc khi không có gì về quyền đối với tác phẩm được ghi lại: không giấy phép, không bản ghi quyền và không ghi công. Trong trường hợp cuối, người gửi thấy những tác phẩm nào đang được chuyển đi mà không có giấy phép được ghi lại, và `CREDITS.txt` yêu cầu người mở tệp kiểm tra điều khoản trước khi dùng lại chúng. Giấy phép đã ghi lại nhưng chưa được diễn giải khiến tác phẩm bị giữ lại, tương tự với tác phẩm đã ghi nhận chủ thể quyền nhưng không có giấy phép, hoặc không đọc được bản ghi trong danh mục. Bạn vẫn có thể chủ động đưa nội dung bị giữ lại vào, và tệp ghi công ghi nhận đó là lựa chọn của bạn. `CREDITS.txt` của gói liệt kê những gì đã được chuyển đi, theo giấy phép nào và những gì bị giữ lại cùng lý do.
- **Trong Lolly Verify.** Bảng Sources liệt kê mọi nguồn mà tệp ghi lại, với phần tóm tắt được tính toán, ghi công, nút Copy credit, liên kết Open source chỉ mở khi bạn yêu cầu và các giới hạn được nêu rõ của việc kiểm tra. Câu hỏi Check for this use chỉ xuất hiện khi bạn chọn cách dùng, và không có gì được tải về để trả lời câu hỏi.
- **Khi bạn xóa siêu dữ liệu.** Việc xóa cho biết tệp không còn mang bao nhiêu ghi công nguồn, cung cấp văn bản ghi công và một tệp sạch với ghi công trong tệp riêng. Các byte đã được xóa siêu dữ liệu không bao giờ bị đóng dấu lại.

**Dấu hiệu nhận diện của chính chủ sở hữu.** Chủ sở hữu hiếm khi đặt logo dưới giấy phép mở. Một hàng có bản ghi quyền là `own-work`, kèm chủ sở hữu và điều khoản, có thể được chuyển trong tệp `.lolly` và trên [trang thương hiệu](/info/brand-page.html#publish-your-own-marks). Nó được chuyển với nhãn "Do chủ sở hữu công bố, không phải giấy phép mở", kèm điều khoản bên cạnh tệp. Cách này đọc những gì danh mục khai báo. Lolly không kiểm tra ai sở hữu dấu hiệu nhận diện. Bản ghi không có chủ sở hữu, điều khoản để trống hoặc không có khai báo vẫn bị giữ lại, tương tự với dấu hiệu nhận diện của người khác không có bản ghi như vậy.

::: details Các giấy phép Lolly đã rà soát
Phiên bản quy tắc `rights-rules-2026-11-05.1`. Mỗi quy tắc được đọc từ chính văn bản pháp lý của giấy phép, và mục làm nguồn được trích dẫn ở đây cùng bên cạnh quy tắc trong `engine/src/rights-profiles.ts`. Phiên bản và bản điều chỉnh theo khu vực pháp lý được giữ đúng như đã ghi lại: khai báo CC BY 3.0 giữ nguyên phiên bản của nó thay vì được báo thành 4.0 chỉ vì bộ chọn của ứng dụng ưu tiên 4.0.

| Giấy phép | Yêu cầu đối với cách dùng mà Lolly có thể thực hiện | Đọc từ |
|---|---|---|
| CC BY 4.0 | Người tạo, tiêu đề, thông báo bản quyền, tên và liên kết giấy phép, liên kết nguồn và thông tin về các thay đổi, từng mục khi nguồn có cung cấp. Không cách dùng nào bị loại trừ, kể cả sử dụng thương mại. | [Văn bản pháp lý](https://creativecommons.org/licenses/by/4.0/legalcode.en), mục 2(a)(1) và 3(a) |
| CC BY-SA 4.0 | Ghi công tương tự. Ngoài ra, nếu bạn chia sẻ một bản phái sinh, nó phải được phát hành theo giấy phép tương thích: CC BY-SA 4.0, Free Art License 1.3 hoặc GPL-3.0-or-later với tính tương thích chỉ theo một chiều. Ba giấy phép đó được lưu dưới dạng dữ liệu từ danh sách Creative Commons, không bao giờ đối sánh theo tên. | [Văn bản pháp lý](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en), mục 3(a) và 3(b); [danh sách giấy phép tương thích](https://creativecommons.org/compatible-licenses/) |
| CC0 1.0 | Không yêu cầu gì. Tuyên bố hiến tặng không kèm điều kiện, nên Lolly cung cấp ghi công tự nguyện và không bao giờ trình bày nó là bắt buộc. | [Tuyên bố hiến tặng](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en), mục 2 và 3; [CC FAQ](https://creativecommons.org/faq/) về ghi công |
| CC-PDDC | Không yêu cầu gì. Những gì được ghi lại là chính khẳng định đó và người đưa ra, vì chứng nhận là tuyên bố của một bên chứ không phải bằng chứng. | Các đoạn trong [Tuyên bố hiến tặng và chứng nhận](https://creativecommons.org/licenses/publicdomain/) |
| Apache License 2.0 | Các thông báo từ nguồn và văn bản ghi công trong tệp NOTICE đi cùng tác phẩm được phân phối. Việc dùng khi chạy không yêu cầu gì. Giấy phép yêu cầu văn bản thông báo nhưng tác phẩm không có văn bản đó được báo là một khoảng trống. | [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0), mục 4, điều kiện 1 đến 4 |
| MIT | Dòng bản quyền và thông báo cấp phép đi cùng các bản sao và những phần đáng kể. Việc dùng khi chạy và dùng để tham chiếu không yêu cầu gì. | [MIT](https://opensource.org/license/mit), điều kiện về thông báo cấp phép |
| ISC | Tương tự MIT, với cách diễn đạt ngắn hơn: dòng bản quyền và thông báo cấp phép đi cùng các bản sao. Việc dùng khi chạy và dùng để tham chiếu không yêu cầu gì. | [ISC](https://opensource.org/license/isc-license-txt), điều kiện về thông báo cấp phép |
| SIL OFL 1.1 | Kết xuất văn bản bằng phông chữ không đặt ra yêu cầu nào với văn bản. Chuyển tiếp tệp phông chữ phải kèm giấy phép, thông báo bản quyền và quy tắc về tên được bảo lưu. | [OFL 1.1](https://openfontlicense.org/open-font-license-official-text/), điều kiện 2, 3 và 5; [OFL FAQ](https://openfontlicense.org/ofl-faq/) về tài liệu |

**Được ghi lại, chưa được diễn giải.** CC BY-NC, CC BY-ND cùng các tổ hợp NC-SA và NC-ND được nhận diện, các điều kiện được liệt kê và không quy tắc nào ở đây đọc chúng. Chúng báo `licence.unknown` cùng một dòng nêu tên các điều kiện. Không thể suy ra bối cảnh thương mại từ giá hoặc tài khoản, và mỗi văn bản kết hợp cần được rà soát riêng trước khi một quy tắc đọc văn bản đó.

Ba câu trả lời trung thực khác, không câu nào là sự cho phép:

- Mã định danh `LicenseRef-` được trả về nguyên dạng. Nó trỏ tới một định nghĩa đã lưu và không bao giờ bị coi là độc quyền chỉ vì cách viết.
- Khai báo không được nhận diện được trả về mà không phân tích, và văn bản gốc được giữ lại.
- `A OR B` là lựa chọn mà chủ thể quyền đưa ra, nên mọi phương án đều được trả về và không phương án nào được chọn. `A AND B` có tính cộng dồn, và các quy tắc này ghi nhận điều đó thay vì đọc hai hồ sơ cùng nhau.
:::

::: details Trên dòng lệnh và qua MCP
Một lần kết xuất in khối `Rights:` ra luồng lỗi chuẩn khi đánh giá có ghi công bắt buộc hoặc vấn đề. Khối này chứa trạng thái, một dòng cho mỗi vấn đề dưới dạng `code - summary`, kết quả đọc lại tệp đã bàn giao và văn bản ghi công để dán.

```
Rights: actions-required
  licence.adaptation-choice - If you share this adaptation, it needs a compatible licence.
  Credential intact. It records 1 source. The exporter recorded it; the source did not sign a credential of its own.
  Credits included in this file's metadata.
  "water wave (OpenMoji Color 17.0.0)" by Vanessa Boutzikoudi (OpenMoji), CC BY-SA 4.0 https://creativecommons.org/licenses/by-sa/4.0/, source https://raw.githubusercontent.com/hfg-gmuend/openmoji/f9fc506a3f913be9897ab0181d611d4c910a4104/color/svg/1F30A.svg, changes: recoloured.
```

Ở đây, ghi công có trong tệp, và vẫn cần quyết định về giấy phép trước khi chia sẻ tệp.

| Trạng thái | Ý nghĩa | Mã thoát |
|---|---|---|
| `ready` | Không có gì đang chờ một người xử lý. | 0 |
| `actions-required` | Còn một quyết định cần đưa ra trước khi chia sẻ tệp. Tệp vẫn được ghi. | 4 |
| `use-not-covered` | Quy tắc đã rà soát cho biết giấy phép không bao gồm cách dùng này. | 4 |
| `unknown` | Các vấn đề duy nhất là những khoảng trống: giấy phép chưa được ghi lại hoặc điều kiện chưa được diễn giải. | 0 |
| `delivery-failed` | Do biên nhận đặt, không bao giờ do đánh giá: ghi công đã hứa không được tìm thấy trong các byte đã bàn giao. Bảng xuất hiển thị trạng thái này; CLI báo cùng dữ kiện trong dòng đọc lại của nó. | không in |

Mã thoát 4 là mã CLI này vốn trả về khi một bước kiểm tra bảo vệ từ chối. Đó không phải 3, nghĩa là "thử lại trên trình chạy khác", vì quyết định về giấy phép sẽ vẫn chờ trên bất kỳ trình chạy nào.

`--rights=private` nêu rằng bản kết xuất này không được bàn giao cho ai. Khối vẫn được in và ghi công vẫn ở đó để sao chép; điều được tạm bỏ là điều kiện áp dụng khi chia sẻ, và không tuyên bố bàn giao nào được ghi lại. Không có cờ để bỏ qua điều kiện: `--rights=ignore` là lỗi sử dụng.

Các mã vấn đề ổn định và máy đọc được, độc lập với văn bản đã dịch: `attribution.source-missing`, `attribution.delivery-missing`, `licence.adaptation-choice`, `licence.use-not-covered`, `licence.grant-conflict`, `licence.unknown`, `source.redistribution-unknown`, `credential.ingredient-missing`.

Qua MCP, `lolly_verify` trả về dữ liệu `rights` với phần tóm tắt, một hàng cho mỗi nguồn đã ghi lại và các giới hạn được nêu rõ. `lolly_render` không dùng trình duyệt trả về `status`, `issues`, `credits`, `fingerprint` và cờ `creditsInFile` được đo bằng cách đọc lại các byte.
:::

::: details Nơi chứa các quy tắc
Năm mô-đun của bộ máy, tất cả đều là mô-đun thuần: không mạng, không đồng hồ, không hệ thống tệp. Dữ liệu quy tắc có phiên bản và nằm trong kho mã, không bao giờ được tải về.

| Mô-đun | Nội dung |
|---|---|
| `engine/src/rights-profiles.ts` | Bảng mã định danh, trình đọc biểu thức SPDX tối giản, các hồ sơ đã rà soát cùng trích dẫn và quy tắc duy nhất cho liên kết mà ghi công có thể in. |
| `engine/src/rights-evaluate.ts` | Phân loại, các vấn đề, kế hoạch ghi công và dấu vân tay. Có tính xác định: cùng dữ kiện theo thứ tự khác vẫn cho cùng câu trả lời. |
| `engine/src/rights-attribution.ts` | Ghi công đọc được, các tệp đi kèm, các thành phần nguồn và biên nhận được đo sau khi ghi. |
| `engine/src/rights-companion.ts` | Việc đọc lại ghi công trong gói (`CREDITS.txt` và `credits.json` bên trong bản tải xuống dạng ZIP), xác nhận ghi công mà không tuyên bố có chứng thực đã ký. |
| `engine/src/rights-report.ts` | Chứng thực đã xác minh được đọc lại dưới dạng ba câu hỏi mà Lolly Verify đặt ra. |

Các tệp kết quả kỳ vọng trong `tests/fixtures/rights/` được viết từ văn bản giấy phép thay vì đầu ra của bộ đánh giá, và README của chúng trích dẫn mục làm cơ sở cho mỗi kết quả kỳ vọng.
:::

<!--i:eti-hammer-->
## Những gì phần này chưa làm được

- **Chưa có đích đến nào được xác nhận.** Lolly chuẩn bị chú thích. Trình kết nối chấp nhận yêu cầu không phải bằng chứng rằng ghi công đã đến tay người đọc, và không điều gì ở đây hứa rằng lần tải lên, chụp màn hình hoặc chuyển mã sau đó giữ được siêu dữ liệu ẩn.
- **Các trường ghi công gốc trong siêu dữ liệu chưa được ghi từ kế hoạch.** Ghi công đi trong Content Credentials và văn bản đọc được. Các trường ghi công theo nguồn của IPTC và XMP chưa được điền từ kế hoạch ghi công.
- **Chưa xây dựng chức năng sửa và rút lại.** Chưa có giao diện để thêm người tạo bị thiếu hoặc bản sửa cục bộ cho một tác phẩm đã ghi lại, cũng như rút lại bản ghi.
- **Chưa xây dựng kết nối với nhà cung cấp.** Tài nguyên mua sẵn, quyền được cấp riêng và tài khoản nhà cung cấp chưa có đường nhập, nên quyền họ cấp chỉ có thể được ghi lại dưới dạng tuyên bố của bạn.
- **Chính sách tổ chức chưa được kết hợp với các kết quả này.** Hiện tại, chính sách xuất và điều kiện giấy phép tách biệt, và phê duyệt của tổ chức không phải sự cho phép từ chủ thể quyền.
- **Một số đường bàn giao chưa đi theo quy trình này.** Tải bản gốc từ danh mục, ZIP hàng loạt, Send và Copy image chưa đánh giá hoặc mang những ghi công này. Cắt ảnh, chỉnh màu, bản sao có khung, chuyển đổi bằng Download as và chỉnh sửa video thì có: nguồn có giấy phép đã ghi lại và không có Content Credentials riêng được chuyển dưới dạng thành phần nguồn chưa ký kèm ghi công, LUT được ghi công theo giấy phép riêng và không bao giờ theo giấy phép của ảnh, và tệp không chứa được ghi công mà nguồn yêu cầu sẽ không được lưu. Chưa có gì đọc lại các tệp đó, nên ghi công của chúng đã được ghi, chưa được xác nhận. Retouch, xóa nền và tăng độ phân giải cho từng ảnh, cùng trích xuất âm thanh chỉ giữ chứng thực riêng của nguồn.
