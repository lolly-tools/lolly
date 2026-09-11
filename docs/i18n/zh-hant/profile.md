# 個人資料——你創作時的身分

**設定檔（profile）**是 Lolly 用來進行創作的工作身分。它是一小組工具可以取用的細節，讓你不必每次都重新輸入 - 你的姓名、聯絡方式、可選的大頭照、幾項偏好設定 - 再加上你在使用過程中累積的一切：已儲存的工作階段、上傳的圖片，以及本機活動統計。

個人資料裡的一切都**存在裝置本機**，存放在瀏覽器的本機資料庫中（在 web PWA 上是 IndexedDB，在 Tauri 應用程式上是檔案系統）。沒有帳號，也不會上傳任何東西。你可以在畫廊右上角的**個人資料**中管理它；工具只會*讀取*它，而且只會讀取它們原本就設計要預先填入的特定欄位。

> 設定檔談的是*你*（或任何在這裡進行創作的人）。它與**Platform（平台）** - 品牌的顏色、字型與全域設定 - 不同，也與**Capabilities（能力）**，也就是應用程式能做什麼的目錄，不同。詳見文末的 [設定檔 vs 平台 vs 能力](#profile-vs-platform-vs-capabilities)。

## 個人資料裡有什麼

| 部分 | 內容 |
|---|---|
| **姓名** | 名字與姓氏。 |
| **聯絡方式** | 電子郵件與電話。 |
| **所在地** | 城市與國家。 |
| **大頭照** | 選用的照片，會裁切成正方形並儲存為本機圖片。供電子郵件簽名檔、報價卡、組織圖與動態版面配置等工具使用。 |
| **Use my details to create** | 一個單一的選擇加入開關（開啟後會顯示為 **Using my details**）。它控制你的個人資料是否隨附為**來源（provenance）** - 也就是內嵌在匯出檔案中的作者/credit 行 - 以及作為 **/pro** 批次執行的作者。（它不影響預先填入：詳見[工具如何使用你的設定檔](#how-tools-use-your-profile)。） |
| **偏好設定** | 你的主題（淺色、深色或品牌主題 - 品牌主題會以你自己的色票為應用程式上色），以及你透過**Feature flags（功能旗標）**啟用了哪些應用程式部分。 |
| **無障礙** | 四個舒適度開關 - *減少動態效果*、*隱藏彩色預覽*、*高對比*、*大字體* - 都儲存在設定檔紀錄中，因此會隨設定檔匯出一併攜帶。詳見[無障礙](#accessibility)。 |
| **你的作品** | 已儲存的工作階段（附縮圖） - 在**[Projects](/info/using.html)** 中以巢狀資料夾整理 - 你的**My images** 圖庫，以及本機活動統計，全部都以此設定檔為索引。 |

![Three theme cards, each previewing its own type and colour, with the active one flagged](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

![設定檔畫面 - 姓名、聯絡方式、選用的大頭照與你的偏好設定](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

這些都不是必填的。空白的個人資料本身就相當合用；你只需要填寫能省下打字功夫的部分。

這個頁面很長，因此側邊自帶一條**設定導覽列**（settings rail）- Your details（你的詳細資料）、Appearance（外觀）、Accessibility（無障礙）、Lolly instance（Lolly 執行個體）、Your activity（你的活動）、Storage（儲存空間）、Available offline（離線可用）、Feature flags（功能旗標）、Content Credentials - 上方還有一個 **Search settings（搜尋設定）** 欄位，會隨你輸入即時篩選清單。每個區塊都可以用 `#/profile?focus=<section-id>` 深層連結，開啟該區塊並捲動至該處（例如 `#/profile?focus=storage-section`、`?focus=feature-flags-section` 等），因此連結可以直接指向單一設定項目，而不只是頁面最上方。

![三張主題卡片，各自預覽自己的字型與顏色，目前使用中的那張會被標示出來](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

## 個人資料是一種情境，而不只是一個人

「個人資料」這個詞聽起來像是指一個固定不變的人，但在 Lolly 裡，它其實是一種**創作情境**——也就是*你在製作這個東西時的身分*。這個情境可以有三種不同的樣貌，而 Lolly 對待它們的方式完全相同。

### 作為個人

![The headshot control, empty until you upload a photo that then stays on this device](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

![大頭照控制項，在你上傳照片之前是空的，上傳後照片會留在這台裝置上](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

### 作為團隊

設定檔不一定要對應單一個人，也可以代表組織內的**團隊或職能**：團隊的共用名稱、群組收件信箱（`events@…`）、部門、團隊大頭照或單位標記。由一個人設定好、匯出（見下文），其餘團隊成員載入同一份設定檔 - 這樣團隊產出的一切就會攜帶一致的資訊，不必每個人重複輸入。共用的資訊站或借出的展示筆電，也可以統一使用同一份團隊設定檔，讓每個使用它的人都以該身分創作。

### 作為一種職能——偶爾才擔任的角色

這是「一人一份個人資料」這種僵化模式會漏掉的情況。你可能一年只有**三天是活動經理**，其餘時間則完全是另一個角色。那三天，你想要的是活動資料、活動信箱，或許還有活動子品牌，來填入識別證與指標；其餘 362 天，你想拿回平常的身分。

在 Lolly 裡，這個角色就只是**你隨手備著的另一份個人資料**——一個儲存起來的包裹（見下一節），活動時載入，結束後放到一邊。這個角色是一頂帽子，不是一個新帳號。需要時戴上，用完就摘下。

## 一次安裝，一份使用中的個人資料——但你可以保留很多份

在任何時刻，一次安裝只會有**一個使用中的設定檔** - 也就是工具目前看到的細節。應用程式內沒有設定檔切換器；取而代之的是，每個設定檔都是一個**可攜式套件**（單一 `.zip` 檔，見[下文](#moving-a-profile-to-a-new-device)）。這刻意設計成與換到新裝置時相同的機制 - 設定檔就是一個你可以儲存、複製與載入的檔案。

![The storage meter, breaking down saved sessions, images and cache against what the browser actually reports](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

- <!--i:trash--> **最乾淨的切換方式：** 依序點選 **Profile → Storage → Clear all my data**，然後 **Import（匯入）**你要切換進去的情境所對應的套件。此後你就純粹以那個設定檔進行創作。
- <!--i:layers--> **疊加：** 若*不先*清除就匯入，會**合併** - 匯入的設定檔、工作階段與圖片會疊加在既有內容之上，同名項目會被取代，其餘保留。適合把某個團隊已儲存的工作階段拉進你自己的環境；若你需要乾淨的角色邊界，就不適合這麼做。
- <!--i:monitor--> **並存：** 因為一切都是裝置範圍的，不同的瀏覽器設定檔、不同的使用者帳號或另外安裝的第二個 PWA，各自都會攜帶獨立的 Lolly 設定檔。可以同時執行你的個人安裝與活動資訊站安裝，無需切換。

所以如果你真的要同時應付好幾種情境（你自己、你的團隊、活動經理這頂帽子），就保留好幾個包裹，需要哪個就載入哪個：

![儲存空間量表，將已儲存的工作階段、圖片與快取，對照瀏覽器實際回報的數字加以拆解](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

> 每個情境都保留一個包裹，並依內容重新命名檔案（`LollyTools-events-2026.zip`、`LollyTools-me.zip`）。這個檔案*就是*個人資料本身。

## 無障礙

**Profile → Accessibility** 中有四項舒適度設定，作用於你工作*周圍*的應用程式介面。每一項在你開啟前都是關閉的，而且都不會影響工具畫布或匯出結果內部 - 更沉靜的應用程式介面，絕不能移動你交付檔案中的任何一個像素。

- <!--i:film--> **Reduce motion（減少動態效果）** - 關閉應用程式中的轉場、滑動與動畫裝飾效果。你的工具畫布與任何動態匯出，仍會完全依照設計持續動作。
- <!--i:image--> **Hide colourful previews（隱藏彩色預覽）** - 將圖庫預覽圖換成沉靜的圖示加文字卡片，並降低專案縮圖的色彩與對比，讓它們在不搶眼的情況下依然可辨識。在工具內部，一切仍會以完整色彩顯示。
- <!--i:sliders--> **High contrast（高對比）** - 加強應用程式的邊框、文字與焦點外框。你的品牌顏色與畫布上的一切，都會完全維持你設定的樣子。
- <!--i:font--> **Large text（大字體）** - 放大應用程式的文字：標籤、選單與按鈕文字。控制項本身大小不變，只有其中的文字會變大；你設計中的文字則完全不受影響，因此匯出結果不會重新排版。

這些設定儲存在設定檔紀錄本身，因此會隨設定檔匯出一起攜帶，並在下一次安裝時與你的姓名、工作階段一同就位。（裝置端也會保留一份小型本機鏡像，讓設定能在第一次繪製畫面前就生效；這份鏡像僅限本機，不會隨設定檔攜帶。）

## 你的 Lolly 執行個體

**Profile → Lolly instance** 顯示這次安裝的工具與目錄來源 - 執行個體的位址，或者在一切都內建於建置版本中時顯示 *Bundled with this app（隨此應用程式內建）*。若部署有提供的話，**Instance console（執行個體控制台）**連結會開啟其管理介面，而 **Change（變更）** / **Disconnect（中斷連線）**則可以重新指向或解除這次安裝的連結。

要重新指向另一個執行個體，需要使用**桌面應用程式**：瀏覽器會封鎖頁面跨來源載入工具與資產，因此在網頁版中，這個區塊只會顯示你目前所在的位置，僅此而已。

## 離線可用

Lolly 會隨著你的使用逐步快取內容，但這種邊用邊快取的方式，只涵蓋你已經去過的地方。**Profile → Available offline** 是為你能預見的旅程準備的：例如登機前在機場 wifi 下的一小時，之後就完全沒有網路。事先下載你需要的部分，看著一條進度條跑完，你下載過的內容在失去連線後依然能正常運作。

共有七個部分，每一項在你確認下載前都會先標示大小：

- <!--i:layout--> **應用程式本體** - 每個檢視畫面、編輯器與字型，包括你還沒開啟過的。少了這一項，你在線上從未造訪過的畫面就無法離線載入。
- <!--i:image--> **目錄** - 必要項目以外的品牌資產。可以全部下載，或開啟 *Choose by tag（依標籤選擇）*，只下載你會用到的標籤。
- <!--i:book--> **指南與文件** - 這個文件網站，以你的語言呈現，包含所有截圖。
- <!--i:cpu--> **語音音色** - Script 音訊與旁白背後的語音模型。只需下載一次，之後就在裝置端執行。
- <!--i:zap--> **放大模型** - AI 影像放大器：相片、插畫/動漫與人臉。
- <!--i:layers--> **背景移除** - *Remove background（移除背景）*背後的裝置端去背模型。
- <!--i:shield--> **Verify deep scan（Verify 深度掃描）** - 裝置端浮水印掃描器，用於在沒有網路連線的情況下檢查 Content Credentials。

最後四項標記為**大型下載**,而且刻意設計成各自獨立的選擇加入項目:最上方的**下載全部**會取得應用程式、你選擇的目錄範圍、文件以及所有工具,一次完成,不多不少。語音、放大工具、去背和深度掃描則只在你指名要那一列時才會下載 - 把幾百 MB 藏在一個按鈕裡並不誠實。

這些部分下方是逐工具清單:每個工具可個別下載(打勾表示已可離線使用),或按**全部下載**一次全拿。下載可以續傳 - 取消或斷線後,下次執行會從中斷處接續,只抓缺少的部分 - 而且回到連線狀態時會自動更新,只拉取新版本異動的內容。

如果瀏覽器尚未授予持久性儲存空間,該區段會說明此情況,並提供**保護下載內容**選項,用來要求授予 - 這是「已下載」與「下載後可能被瀏覽器收回空間」之間的差別。

## 把個人資料搬到新裝置

![The two buttons that move a whole install: Export my data writes one zip, Import data reads it back](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

由於個人資料完全存放在本機，要把它帶到一個全新的安裝環境——新筆電、剛重設的瀏覽器、同事的電腦、離線的機器——唯一的方法就是**帶著檔案走**。沒有任何登入程序能幫你還原它，而這正是重點所在：一開始就沒有任何東西離開過你的裝置。

- <!--i:download--> **匯出我的資料**會下載一個 `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` - 以所屬設定檔命名,並附上每日序號,避免重複匯出時檔名衝突(設定檔缺少的名稱部分會省略)。內容包含你的設定檔、每個已儲存的工作階段(含縮圖)、你上傳的圖片 - 你的品牌權杖與已安裝字型會一併作為使用者素材附帶 - 以及你的偏好設定(主題、版面配置、本機活動統計)。
- <!--i:upload--> 在另一個安裝環境上使用**匯入資料…**讀回該檔案,即可從你離開的地方原樣接續。
- <!--i:box--> **匯出我的資料並算圖全部項目**會寫入同一份備份,*外加*第二個 zip,將每個已儲存的工作階段算圖為最終輸出檔,並依照與你的「專案」相同的資料夾結構存放。這是來源與成果兩者的完整離線封存 - 若工作階段很多,檔案可能會很大且較慢。

![搬移整個安裝環境的兩個按鈕:匯出我的資料寫入一個 zip,匯入資料再讀回](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

這個包裹是單純、自含的 zip 檔，所以可以透過**任何**方式傳遞——USB、AirDrop、網路共用資料夾、寄給自己的電子郵件——而且目標裝置可以完全離線。每個部分都有做校驗碼，所以傳輸過程中損壞的檔案會在匯入時被抓出來，而不會半殘地被還原。匯入會**合併**（同名的個人資料／工作階段／圖片會被覆蓋；其餘的都會保留），所以絕不會清空一個原本就在使用中的目標裝置。

不會一併搬過去的：目錄快取（會在新裝置上自行重新下載）以及工具本身（假設新裝置上已經存在）。

確切的封裝結構、版本政策與完整性規則,請見**[資料傳輸](/info/data-transfer.html)**;完整的端對端操作步驟,請見**[使用 Lolly → 搬移到另一台裝置](/info/using.html#moving-to-another-device)**。

## 工具如何使用你的個人資料

![The single Use my details switch, sitting beside Save Profile and off until you turn it on](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

工具只會*預先填入*它明確設計要綁定的個人資料欄位：

**選擇加入(來源證明)。** 當你匯出資產時,你的個人資料可以選擇性地一併附上,成為**來源證明**(provenance) - 也就是嵌入檔案中繼資料(PNG、PDF、SVG 等)的作者/掛名資訊 - 讓完成的資產能表明是誰製作的。**用我的資料建立**所控管的正是*這一項*:關閉它,匯出檔案仍會帶有「Made with Lolly」的工具/平台署名,但不會嵌入個人作者/聯絡資訊。(同一個選擇加入設定也會決定 **/pro** 批次執行的作者。)(工具作者請參閱[撰寫工具指南 → `bindToProfile`](/info/authoring-tools.html#bindtoprofile)與[主應用程式 API → `host.profile`](/info/host-api.html#host-profile)。)

![單一的用我的資料建立開關,位於儲存設定檔旁,在你開啟之前預設關閉](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## 個人資料、平台與功能的差異

這三樣東西在介面中的位置相近，很容易搞混：

- <!--i:people--> **設定檔** - *你*(或你的團隊,或你所擔任的角色):姓名、聯絡方式、大頭照、你已儲存的作品。個人化、僅存於裝置上,可以整包搬移。
- <!--i:palette--> **平台** - *品牌*本身:每個工具算圖所依據的色彩、字型與全域設定。共用且一致,並非個人專屬。
- <!--i:sliders--> **功能** - *應用程式能做什麼*:你可用的完整功能集與工具。

個人資料改變的是一項資產*來自誰*；平台改變的是它*看起來像什麼*；功能則是*你能做出什麼*。

### 「Profile」在別處還有另外兩種意思——都不是這一個

這個詞在整個專案裡疊用了好幾種意思。以下兩者都不是本頁所談的個人資料：

- <!--i:box--> **內容設定檔(content profile)** - `profiles.json` 中的建置時期設定,將一組工具包綁定到某個品牌目錄(例如 `suse`、`lolly-start`)。這是操作人員在部署時的選擇,匯出時的 `profile` **URL/CLI 參數**也是用它來選擇*色彩*版本(印刷用的 ICC/CMYK 條件 - 見[URL 模式](/info/url-mode.html))。兩者談的都是*建置/輸出*,與*你本人*無關。見[設定](/info/configuration.html)。
- <!--i:seal--> **身分設定檔(identity profile)** - 你可以選擇加入的**已驗證 Content Credentials 身分**(一張效期有限的憑證,將你的電子郵件與你簽署的匯出檔綁定)。這是一種簽署身分,與個人設定檔的姓名/聯絡欄位是分開的,不過**用我的資料建立**會決定兩者是否會被嵌入。見[Content Credentials 身分](/info/content-credentials-identity.html)。

![已驗證身分卡片,手機寬度版面:憑證有效期選擇器與下方的註冊步驟 - 身分設定檔,與你的個人資料分開](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## 隱私

除了上述選擇加入的身分註冊(這會將你註冊時使用的電子郵件傳送給憑證服務 - 見[伺服器介面](/info/server-surface.html))之外,設定檔絕不會被傳送、上傳或用來識別或追蹤你 - 沒有任何需要同意的事項,這裡只是讓你知道保留了哪些內容的說明。隨時可用**設定檔 → 清除我的所有資料**清除全部內容。詳見[隱私權政策](/info/privacy.html)。
