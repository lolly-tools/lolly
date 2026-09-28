# 品牌工作室

位於 `#/start` 的**品牌工作室**是你形塑品牌的唯一地方 - 它的標誌、色彩、字體、其餘的權杖以及它保存的檔案。在這裡設定一次,每個工具、頁面與匯出結果就會*依此建構*自動跟隨,而不必逐一檢查。

變更會**在整個應用程式中即時預覽**,所以你能在確定套用之前,先看到某個色彩或字型套用到各處的樣子。這一切都在裝置端進行:你的品牌檔案與權杖絕不會離開你的機器(選擇 Google 字型時,會在同意對話框確認後,向 Google 一次性擷取該字型家族),而品牌本身則以單一[品牌包](#move-a-brand-between-devices)檔案的形式攜帶。

> **這裡是編輯器,儀表板只是鏡子。** 儀表板(`#/d`)上的**設計系統**分頁只是*唯讀顯示*你的品牌;你要*編輯*品牌則要在這裡的 `#/start`。如果之後想改色彩,回到品牌工作室即可。

## 各個房間

這間工作室是側邊列出的一組**房間** - 不是步驟。沒有編號,彼此之間也沒有前後依賴,從任何一間進入都算合理:

- **Overview** - 中樞。一眼看清目前有什麼，並有通往每個房間的入口。
- **Colours** - 逐一加入色彩、指派角色，或從一個色彩產生整套調色盤。
- **Type** - 應用程式、你的工具與每次匯出所讀取的四款字體。
- **Logos** - 你的標誌，涵蓋各種方向與處理方式。
- **Tokens** - 圓角、間距、陰影以及系統其餘部分。
- **Files** - 你的品牌所保存的圖像、音訊與動態檔案。

在手機上,同一份清單會變成釘在頁首下方的橫向卡片列。切換房間絕不會重新載入任何內容 - 編輯器會讓所有面板保持掛載狀態,只是顯示你要求的那一個。

用 `#/start?area=<key>` 可**深層連結到某個房間**。可用的鍵值有 `overview`、`color`(*注意 URL 中是美式拼法*)、`type`、`logos`、`tokens`、`catalogue`(檔案房間 - 面板鍵值是永久性的約定,因此 URL 沿用舊名稱)以及 `versions`。`?tab=` 是同一功能長期沿用的別名,依然可以解析,所以舊連結與書籤仍可正常運作;無法辨識的值一律開啟總覽,而不會出現死路。

釘在**側邊列底部**的是屬於整個設計系統、而非單一房間的動作:

- **Add from…** - 來源選擇器，用於從檔案、PDF、圖片、字型或網站匯入品牌。詳見下方[帶入既有品牌](#bring-a-brand-in)。
- **Tray** - 掃描找出但尚未確定採用的候選項目。除非某次掃描真的保留了內容，否則會保持隱藏，一旦有內容則會顯示數量；裡面的任何項目在你按下該列的 Add 之前都不會影響你的品牌。
- **Export** - 將整個設計系統寫成一個 `LollyBrand-….lolly`。
- **Tokens (.json)** - 單獨匯出純文字設計權杖文件，供儲存庫、建置流程或其他權杖工具使用。
- **Restore brand settings** - 回到匯入或取代品牌設定之前保存的檢查點。
- **Versions** - 發布、啟用並還原設計系統的具名副本。除非你已有可發布的內容(或有 `?area=versions` 連結指名要求)，否則會保持隱藏。

![工作室房間側邊列 - Overview、Colours、Type、Logos、Tokens 與 Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## 總覽

總覽是你進入時停留的房間，有兩種面貌。

當**尚未設定任何內容**時，它會寫著 **Make it yours**。**Start from a reference** 會開啟來源選擇器，可選標誌、截圖、網頁或設計檔案。**Pick a colour**、**Choose a face** 和 **Add a logo** 會直接開啟各自既有的控制項。每條路徑都以一次選擇開始；開啟它並不會寫入任何內容。**Explore the tools** 則隨時可用。

一旦你已經擁有屬於自己的內容，同一個房間就會顯示**你目前擁有的內容**，並以你做出的數量領頭。Colours 讀出設計系統所帶色彩的數量，只有在存在繼承色彩時才會加上一行淡淡的 `· N starter`；旁邊的色帶把你自己選的色彩排在前面，接一條細線，再是淡化的 starter 色彩。Type 依角色讀出(*Inter for headings*，下面接著 *Starter for the rest · SUSE, SUSE Mono*)。Logos 讀出已填入多少個欄位，或是 **Not set**。Tokens 帶出圓角值，在你調整它之前標為 *starter*。資料庫為空時，Files 顯示 **Nothing yet**。每個區塊都是通往該房間的入口。這裡只有數量，絕不會有進度條，也絕不會有「完成」卡片 - 這間工作室不欠你任何東西。

## 標誌

從把你資料夾裡的商標全部倒進最上方的拖放區開始:「**把標誌拖到這裡,或一次選取多個**」可一次接受你手上所有的檔案。每個檔案會先被讀取其形狀與用色,然後排入**等待欄位**佇列,以卡片顯示系統的判斷 - 例如「*看起來像是橫式主標誌*」,附上判斷依據的量測值,以及一個**放置**按鈕(若該欄位已有內容,則顯示**取代**)。如果系統沒有把握,卡片會坦白說明,並改為提供列出全部八個欄位的**變更欄位**選項。在你按下任何動作之前,不會有任何內容被放置。

這個佇列周圍會發生兩件事。留白過多的商標會先收到**裁切建議**——回應它,或按下 Escape 讓原始檔案原樣放入。而當某個商標可以填補另一個空的相鄰欄位時,該房間會提供衍生的**單色**或**反白**版本作為獨立卡片,標記為*自動產生*,若你之後用其他方式填了那個欄位,這張卡片就會自動消失。

下方是每個商標最終落腳的網格 - **方向 × 處理方式**的欄位:

- **方向:**橫式(文字商標與圖形符號並排)與直式(堆疊排列,適合方形與縱長空間)。
- **處理方式:**主要版、主要反白版(用於深色背景)、單色版與單色反白版。

共有八個可選欄位。點一下空欄位可加入 PNG、SVG、JPEG 或 WebP;點一下已填入的欄位可取代它。每個欄位都是選填的,而且一切都保留在這台裝置上。

![標誌矩陣 - 上方是各種方向,每種處理方式各自是一個虛線欄位,全部皆為選填](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** - 在 **Custom marks** 底下加入你品牌以自訂方式命名的標誌(圖示、徽章、favicon)；為它命名並選擇檔案即可。
- **More identities** - 子品牌、產品或活動可以擁有自己完整的一整套標誌。使用 **+ Add another logo** 並命名；你的主要標誌集就是簡單的「Your logo」。
- **Upload an SVG and Lolly reads its colours.** 在全新安裝的環境中，系統會靜靜地依標誌設定你的主要色彩，並告知此情況。在已有品牌的環境中，則會改為以建議形式提供該色彩 - *「Found in the logo: #…」* 並附上一個 **Use as primary** 按鈕 - 位於 Colours 房間中，你可以採用或略過。

## 色彩

房間會隨設計系統一起成長。尚未用到的內容不會出現在頁面上，因此第一次造訪只是一次決定，其餘的會隨調色盤一起到來。

### 第一個色彩

沒有自己色彩的設計系統會開啟在單一置中欄位上：**Start with one colour**，一個很大的即時色塊、一個欄位，以及一行安靜的說明，告訴你角色、色階和印刷設定會隨系統成長而到來。

- **色塊就是選色器。** 按下它，工作室自己的 OKLCH 卡片就會在色塊上開啟，並以欄位目前的內容為起點：一個名稱、色輪、四個轉盤、透明度與 **Stored as**，卡片底部是 **Cancel** 與 **Add colour**。拖曳轉盤會為色塊上色，並隨之改寫欄位內容，在你按下 **Add colour** 之前，不會有任何東西進入設計系統。
- **欄位接受任何標記方式** - `#e0452b`、`rgb(224 69 43)`、`oklch(58% .19 32)` 或一個普通的色彩名稱 - 貼上一整份色彩*清單*，每個色彩都會變成一個可單獨加入的色塊。
- **旁邊還有兩扇門。** 滴管工具(在支援它的瀏覽器上)從畫面上取一個色彩，**From an image** 會讀取這台裝置上的一張截圖或相片，並提供它找到的色彩。
- **Add 永遠不會被停用。** 欄位裡沒有可讀取的內容時，它會開啟選色器，這通常就是一次空按所代表的意思；它無法解析的文字會在欄位下方顯示一行說明，而不是一個死按鈕。

第一個色彩會成為 **primary**，回應這次加入的色塊會這樣說明 - *「Primary is now Vivid Violet」* - 旁邊帶著 **Fine-tune**。

![尚未選擇任何內容的 Colours 房間 - 一個很大的即時色塊、一個欄位，以及一行關於後續內容的說明](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Starter

**Starter** 是對隨應用程式一起送來、而非由你選擇的一切內容的稱呼。全新安裝完全不帶任何色彩：它只有一條中性色階，從墨色到紙色，好讓表面、文字與細線在任何人做出任何決定之前就能算繪出來。這些中性色只是鷹架，所以它們不計入色彩數量，也不會畫在調色盤面板裡。它們存在於 [Tokens](#tokens) 房間中，標為 **Neutrals · starter · 9**，旁邊的 **Open** 會把它們在 Colours 面板中顯示為一個折疊的、帶標籤的群組(`#/start?area=color&group=neutral`)。

同一個詞貫穿每個房間：一個落在 starter 色彩上的角色會讀作 *「Starter Paper stands in」*，它的選色器提供 **Choose…**；一個 starter 字體帶著 **Starter** 標籤且沒有色調；一個 starter 圓角會在 Overview 上被標出。繼承而來的素材從不用虛線邊框繪製，因為在這裡虛線邊框代表一個放置目標。

### 隨調色盤成長

你的色彩在寬螢幕上會和一個 **In context** 預覽並排，在較窄的螢幕上則堆疊在它上方。預覽可以用你的調色盤展示海報、圖表或介面卡片。Starter 色彩留在自己可折疊的群組裡，與你加入的色彩分開。

逐一加入色彩或一整組色階，指派它們的角色，並在需要時展開進階區塊。色彩圖表、漸層與下載控制項都留在調色盤旁邊。

![加入一個色彩後的 Colours 房間，帶有它的調色盤和一個即時的構圖預覽](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Roles - 工具讀取的是什麼

**Roles** 是疊加在色塊之上的一層：哪個色彩在每個工具與每次匯出中扮演哪個部分。角色是選填的(一個設計系統只有三個鬆散的色彩、沒有任何角色，也完全是合理的)，任何色票都可以指定角色，而對比讀數是以 APCA 為優先，針對所在表面測量而得。

一列會以三種語域之一呈現，因此這條色帶絕不會宣稱一個沒人做過的決定：

- 一個自有色彩擔任該角色，處於全強度；
- **Starter *Paper* stands in** - 淡化顯示，其選色器上帶有 **Choose…**；
- **↳ follows Primary** - 該角色透過主要色彩解析，而不是解析到屬於自己的色彩。

一旦調色盤有了色階，色帶就會擴展到工具能讀取的全部七個欄位：Primary、Secondary、Surface、Text、Muted、Edge 與 On primary。On primary 是由 primary 衍生而來，讀作 **Derived**，且沒有選色器。

**應用程式自身的強調色是一項偏好設定，而不是一個權杖。** 預設情況下，介面沿用設計系統，外框強調色採用主要色彩。這是[你的 profile](/info/profile.html) 上的一個 Appearance 設定 - **Interface follows the design system** - 關閉它會讓外框保持中性。無論開關與否，工具、畫布與匯出都不受影響，字體與圓角則一律沿用設計系統。

### 進階區塊

構圖預覽與色彩角色下方是四個折疊區塊。展開你需要的那一個；每個都可用 `#/start?area=color&focus=<wing>` 深層連結，無論房間目前顯示的是什麼，都會開啟它：

- **Explore shades & harmonies**(`focus=generate`) - 由一個色彩產生一整套色階。詳見下文說明。
- **Shade curves**(`focus=curves`) - 逐點重塑色階。明度、彩度與色相各有自己的曲線，可用 L / C / H 切換，拖曳時下方的色階會即時重新計算。
- **Contrast**(`focus=contrast`) - **Contrast-lock** 會針對你選擇的背景重新調整色階以達到 APCA 目標，每個階層保留自己的色相與彩度；**Rotate hue** 會將整個色階沿色輪整體旋轉，每個色調保留自己的明度與彩度。
- **Print**(`focus=print`) - 主要色彩在印刷上的呈現：自動螢幕色值，或改用固定的 CMYK 組合或指定的專色油墨。

### 一個色彩,一整套調色盤

在 **Explore shades & harmonies** 裡，選一個 **Starting colour**。Lolly 會運用引擎在其他地方通用的同一套感知色彩數學(OKLCH)來建議相配的色階。可調整建議的選項：

- **Scheme** - Mono、Complement、Analogous 或 Triad - 決定次要色彩與主要色彩之間的關係。
- **Shades** - 一個從 3 到 20 的滑桿(預設 5)，控制每個色階產生多少階層。
- **Fine-tune**(折疊) - **UI intensity**(Muted / Deep)、**Contrast**(Comfort / High)與 **Text on brand**(Auto / Light / Dark)。

變更起始色彩與控制項只會改變建議內容。點一下某個色階即可加入該色彩，或按 **Add 5 shades** 加入一整組(數量依你的 Shades 設定而定)。既有的色彩與角色維持原位。Undo 會移除這次新增。

**Primary**、**Neutral** 與 **Secondary** 列顯示建議的色階。開啟 **Theme preview** 可查看淺色與深色範例及其對比讀數。在那裡選擇一個 Neutral 或 Secondary 的階層，可以調整建議的主題錨點。重建整套調色盤仍是下方一個獨立、需要確認的動作。

![三組建議的色階，各自附有獨立的加入控制項，以及一個獨立的 Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### 建立調色盤(調和產生器)

在 **Find matching colours** 中，調和產生器會依主要色彩建議相配的強調色。挑一種 **Harmony** - **Complementary**、**Adjacent**、**Triad**、**Tetrad** 或 **Analogous**(此選項會另外帶出 2 到 5 個的 **Accents** 數量，以及 10° 到 45° 的色相 **Angle**) - 每個候選色都會附上自動產生的易讀名稱與一個 **+ Add** 按鈕。按下加入就會立即把該色彩放進調色盤，一按對應一個權杖。**In context** 會在範例構圖上預覽你加入的色彩。

![產生的強調色，每個都有色塊、自動產生的名稱、十六進位色碼與一個 Add 按鈕](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### 套用已產生的調色盤

加入一個建議的色彩或色階組會保留你調色盤的其餘部分。若要完全取代，請開啟 **Rebuild the whole palette…** 並按下 **Preview full rebuild**。審視畫面會說明這些變化：多少角色會維持你指定的樣子、多少你自行加入的色彩會被保留、多少色階曲線會重新錨定、多少印刷鎖定會重新固定、多少隱藏色階會維持隱藏、多少漸層停駐點會保留其色彩。

卡片上的 **Apply rebuilt palette** 會提交這項變更；**Cancel** 則會離開並且不做任何更動。執行完成後，卡片會提供 **Undo**，且焦點已經落在它上面 - 而且在替換*之前*，整個設計系統就已建立一次檢查點，所以「還原成原本的樣子」只是一次還原，而不是白費一個下午。

### 調色盤、色表與每個色塊

調色盤以可折疊的群組列出設計系統的色彩，每個群組都有自己的 **+ Add** 控制項。建立並重新命名群組來整理你的工作。一個角色絕不會產生第二個色塊：一個權杖就是一個色塊，一個角色所指向的色塊只會多戴上一個小小的角標(**P**、**S**、**Su**、**T**)。色塊下方，**Colour chart** 可展開為同一批色塊的兩種檢視：**Wheel**(OKLCH 色輪 - 拖曳一個點可為其重新上色，點按一個點可編輯它，或點按空白處加入一個新色塊)與 **Gamut** 圖，顯示可顯示範圍實際的邊界所在。`#/start?area=color&focus=chart` 會直接開啟該卡片，`?wheel` 一直以來也是如此。

![調色盤面板，每組都可折疊，下載小圓鈕停靠在其底部邊緣](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![OKLCH 色輪 - 角度代表色相，離中心的距離代表彩度，灰階則沿側邊的明度軌道排列](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

點按任一色塊即可開啟其編輯器:

- **重新命名**。
- **設定顏色** - 選色器會以感知式的 **OKLCH** 滑桿開啟,並提供 **Hex**、**HSL**、**RGB** 與 **CMYK** 模式;數值欄位會依目前使用的色彩空間進行讀取*與*寫入,因此你可以貼上十六進位色碼或輸入油墨百分比。請注意,輸入 CMYK 會透過換算設定*螢幕*顏色 - 若要固定精確油墨值,請使用下方的印刷鎖定。
- **儲存為** - 選擇色塊的儲存方式:**LCH**(預設 - 感知式、廣色域,編輯時的最佳選擇)、Hex、RGB 或 HSL。當你需要固定精確的舊版十六進位色碼或比對 sRGB 值時可覆寫此設定。
- **用作** - 直接把這個色塊指定為某個品牌角色,不必回到角色面板。(角色本身的圖磚不提供此選項 - 角色不能取代角色。)
- **印刷替代色**(可摺疊) - 鎖定顏色的印刷行為:
  - **CMYK** - 從**自動**切換為**已鎖定**,以精確油墨值(C/M/Y/K,0–100)覆寫自動的 sRGB→CMYK 換算。
  - **特別色** - 從**無**切換為**已設定**,將色塊鎖定為特別色;為它指定**名稱**(例如 `PANTONE 186 C`)、選填的**色卡**與選填的**加工方式**(預設為一般油墨),用於油墨其實不是油墨的情況 - 燙金、凸/凹壓、局部上光、觸感加工或模切、壓線、打孔。
- **在其他色彩空間中**(可摺疊) - 同樣的概念再擴大:每一列都是這個色塊可以表示的一種色彩空間,可以從標準值換算而來,也可以由你自行指定,自行指定的值在匯出時優先採用。

這些印刷鎖定就是印刷廠在你匯出 CMYK PDF 或 TIFF 時所使用的依據 - 參見[匯出](/info/exporting.html#colour-profiles)。

**刪除色塊**是安全的:衍生的色階步驟與主題角色會被*隱藏*(底層權杖仍會持續解析,因此不會造成下游任何損壞),而你自行新增的顏色則會直接移除。

### 操作大量色票

每個色票都有一個獨立的拖曳把手。拖曳它可以在群組內重新排列色彩，或是聚焦它、按空白鍵、用方向鍵移動，再按一次空白鍵放下。Escape 取消。順序會在重新開啟工作室後保留，也可以復原。要在群組之間移動色彩，使用色票編輯器的 **Group** 控制項，或選取多個色彩後使用 **Move**。權杖名稱與角色參照維持不變。

調色盤面板中的選取是一個手勢，而不是一種模式。沒有需要先按下的按鈕，選取列會隨第一個選取的圖磚出現，隨最後一個消失。

- **在面板的空白處拖曳**畫出一個矩形：它觸及的每個圖磚都會加入選取，跨越群組邊界。折疊的區塊不會貢獻任何內容，一次沒有移動的拖曳會清空選取。
- **Shift 點按**依閱讀順序選取一段範圍；**Cmd/Ctrl 點按**切換單一圖磚；一般點按仍會開啟該圖磚的編輯器。
- 每個群組標題都帶有 **Select all**，聚焦某個圖磚後按 **Cmd-A** 會選取設計系統擁有的每一個色彩 - 但絕不包括 starter 色彩。
- 格線只有一個 Tab 停駐點。方向鍵在其中移動，Shift + 方向鍵延伸選取，空白鍵切換一個圖磚，Delete 移除選取，Escape 清空選取。(方向鍵只會移動焦點：要微調一個色版，請先按 `l`、`c` 或 `h`，如讀數所示。)
- 在觸控螢幕上沒有矩形選取。按住一個圖磚開始選取，然後點按以加入；各群組的 **Select all** 負責其餘部分。

選取列本身會讀作 **{n} selected**，接著是 **Move to**(一個既有群組，或在選單內命名一個新群組)、**Give a role**(每個選取的色彩依序擔任下一個角色，因此四個圖磚一次按下就能填滿全部四個角色)、**Download**(以六種調色盤格式之一下載所選內容)、**Copy values**(每個色彩一列，採用其儲存時的標記方式)與 **Delete**。Move to 與 Give a role 只有在調色盤已有色階可供移動時才會出現。一次 Ctrl/Cmd-Z 即可復原整個批次動作 - 移動四十個、走一輪角色、一次刪除 - 而刪除會說明它實際保留了什麼，因為一次選取可能觸及這個房間不會移除的圖磚。

### 漸層

選用的 **Gradients** 面板會依調色盤為背景與強調色建立混色權杖。如果設計系統不使用漸層，可以完全略過它。每個漸層都有一個預覽、具名的停駐點(2-8 個)以及一個角度。關鍵行為在於：**一個停駐點會參照某個色塊**，因此重新為該色塊上色，漸層也會跟著改變。內插運算以 OKLCH 進行，以獲得乾淨的混色效果。刪除一個停駐點即可縮減漸層的長度。

### 把調色盤帶到別處使用

停靠在調色盤面板底部邊緣的浮動小圓鈕，可將整個調色盤下載為 **Design tokens (JSON)**、**CSS variables**、**CSS classes**、**SCSS variables**、一個 **GIMP palette (.gpl)** 或一個 **Adobe Swatch Exchange (.ase)** - 讓設計系統可以直接匯入 Illustrator、Figma、GIMP 或一份樣式表。它位於面板捲動範圍之外，因此無論調色盤捲到多遠，它都會保持在原位，並且在調色盤已有色階後才會出現。(你也可以從[素材](/info/using.html#assets-your-library)下載調色盤。)

## 字體

這個房間以同樣的方式成長。在沒有自己字體時，它只是一張卡片、一個決定：**Primary**，以今天服務它的那個字體按閱讀大小顯示，名稱旁邊是一個 **Starter** 標籤，一個已填色的 **Choose a face**，以及一行*「Nothing installs until you choose one.」* 卡片下方是*「Headings, code and italic follow the primary until you choose them」*，**Choose them separately** 會在本次造訪剩餘的時間裡展開另外三張卡片。

![尚未選擇字體的 Type 房間 - 一張閱讀大小的卡片，帶有一個 Starter 標籤，以及一個已填色的 Choose a face](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

選擇一款字體後，房間會展開為 **four role cards**、Fonts 清單與即時樣本。這四款字體正是應用程式、你的工具與每一次匯出實際會讀取的字體：

- **主要字體** - 內文、按鈕與每個工具皆使用。
- **標題** - 用於 `h1`/`h2` 的展示字體。
- **程式碼** - 用於程式碼與資料的等寬字體。
- **斜體** - 用於強調、引用與旁述的真正斜體字。

標題、程式碼與斜體在你指定之前都會退回使用主要字體，因此單一字體的設計系統在這裡完全不需要做任何決定。

**一個色調代表你選擇過它。** 只有你安裝了那個字體的卡片才會帶色調。一個 starter 字體帶著與調色盤中繼承群組相同的 **Starter** 標籤，處於淡化的語域中且沒有色調；一個沒人選擇過的角色會讀作 **↳ follows Primary**，而不是像被選過一樣重複主要字體的名稱。按鈕在你自己的字體上寫著 **Change**，其他地方則寫著 **Choose a face**。卡片上沒有任何東西會直接提交變更：按鈕開啟的是限定於該角色的 **compare stage**。

![四張角色卡揭曉 - 每張都以服務它的字體呈現，沒人選擇的一張帶著 Starter 標籤，Italic 沿用主要字體](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### 比較舞台

![compare stage 在其卡片下方開啟，帶有搜尋列、已釘選的字體家族，以及折疊成一行的卡片](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

這個舞台會**直接在房間內開啟**，而非以對話框呈現，並且就在你按下的那張卡片正下方。它開啟期間，卡片會折疊成一行角色與字體的條帶，因此即使在手機上，舞台也會出現在第一畫面內。Escape 可取消，並將鍵盤焦點交還給你用來開啟它的那張卡片。

選擇一款字體只需三次按下：

1. 在卡片上按 **Choose a face**。
2. 輸入一個字體家族名稱並按 **Preview** - 或按欄位下方六個 **Pinned** 家族之一，按一下即可。卡片會顯示為已在載入中，以一根骨架列占據樣本的位置，而不是用介面字體代替一款你還沒看過的字體。
3. **Use this face**。

**同意只會在你按下的那一刻被詢問一次。** 預覽第一次要連上 Google Fonts 時，一個對話框會說明將發生什麼事：*Google 會得知字體家族名稱與你的 IP 位址。此後該檔案會保存在這台裝置上並離線使用。這是工作室中唯一會連上第三方的一步。* **Fetch from Google** 會繼續進行並被記住。**Cancel** 會讓卡片顯示 *「Not fetched. Nothing was sent to Google.」*，並附上它自己即時可用的 **Fetch from Google**，所以改變主意只需在卡片本身按一下。沒有任何卡片會顯示死按鈕：無論處於什麼狀態，它唯一的主要按鈕都會說明下一步是什麼。

**把字體檔案拖到舞台上**，它會立即預覽 - 來自你自己電腦的 **TTF**、**OTF** 或 **WOFF**，這正是匯入一款你已擁有授權的企業自有字體的路徑。那個拖放區是這個房間裡唯一的檔案入口。

不論哪種方式，字體都會留在這台裝置上，並在應用程式、你的工具與每一次匯出中呈現，永久離線可用，並隨設計系統檔案一起攜帶 - 算繪時不會擷取任何外部資源。Google Fonts 上的所有字體皆以開放授權(OFL/Apache/UFL)提供。

### 此裝置上的字體

**Fonts** 面板列出這台裝置持有的每一款字體，以及它所服務的角色。你加入的字體排在 **In the design system** 之下，各自帶有自己的角色與一個刪除按鈕，服務 Primary 的那款帶有徽章。starter 字體跟在後面，折疊為一列 - *Starter · SUSE, SUSE Mono · serving Primary and Code until you choose* - 以淡化方式顯示，沒有刪除選項，也沒有可以升級的地方，因為這兩者都不是任何人做出的決定。**Add a face** 會開啟同一個未限定角色的 compare stage。

底部的 **Type roles** 面板會顯示每個角色的即時樣本 - 以主要字體呈現的內文與介面文字、供頂部標題使用的選用展示字體、用於強調的斜體、用於程式碼與資料的等寬字體 - 每個旁邊都標示字體家族及其狀態(*Inter*、*SUSE · starter*、*SUSE · follows Primary*)，讓整組字體可以一次看清。

## 權杖

設計系統的其餘部分,不需碰程式碼即可編輯:

![Tokens 房間 - 圓角滑桿，加上間距、尺寸、陰影與系統其餘部分](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Rounded corners** - 單一半徑滑桿(0–1.5rem)，應用程式中的卡片、按鈕與面板皆會依此設定。
- **Neutrals** - 全新安裝隨附的、從墨色到紙色的色階，列為 **Neutrals · starter · 9**，帶有它的九個階層與一個通往 Colours 面板的 **Open**。這是管理 starter 中性色的唯一場所，*starter* 標籤只有在色階被產生、而非繼承而來時才會消失。
- **More tokens** - 新增與編輯 **spacing**、**sizing**、**stroke width**、**opacity**、**rotation**、一般的 **numbers** 與 **shadows**。選擇一種類型，為它命名(*Gutter, Card shadow…*)，再設定其值。這些會以標準[設計權杖](/info/design-tokens.html)(DTCG)格式儲存，並隨設計系統一起攜帶。

## 檔案

把你品牌保存的檔案放到這裡 - 標誌除外：**vector**、**image**、**audio** 與 **motion**(影片、Lottie、動畫)素材。它們會進入[素材](/info/using.html#assets-your-library)，依區段分類，並可在每個工具的素材選取器中隨時取用。所有內容皆保留在這台裝置上。(側邊列將此房間標示為 **Files**；URL 鍵仍為 `catalogue`，因為面板鍵是永久性的約定。)

## 匯入品牌

側邊列底部的**從……加入**會開啟兩階段的選取器。第一階段詢問的是你*擁有*什麼,而非它是什麼格式:

- **Design tokens or a design file** - DTCG 或 Tokens Studio 的 JSON、一個 Penpot 專案、一個 **zip of token sets**、一個 Lolly 設計系統包或一個 SVG。
- **PDF** - 簡報或風格指南檔案，會在這台裝置上讀取其色彩、印刷標記與內嵌字體。
- **Logo or screenshot** - 一張圖片會變成一份建議的調色盤，在這台裝置上讀取。不會上傳任何內容。這只會讀取色彩，不會讀取圖片中的字體或版面。
- **Saved web page** - 選擇一個 HTML 檔案及其 CSS 檔案，或貼上 HTML 或 CSS。最多 20 個檔案，總計 2 MB。只會讀取提供的文字；不會擷取連結的資源，指令碼也不會執行。這條路徑在沒有擴充功能或桌面應用程式時同樣可用。
- **Font file** - TTF、OTF 或 WOFF。會開啟 Type 房間，在那裡安裝字體。
- **Website** - 單一頁面，讀取其色彩與字體。這個圖磚只會在確實能讀取頁面的裝置上出現，因為顯示一個沒人能按的停用圖磚，比根本不顯示還糟。若圖磚出現，它會清楚說明讀取方式：由這台裝置上的應用程式擷取，或透過瀏覽器擴充功能在背景分頁中以你的登入身分讀取。輸入網址只會*預先填入*欄位 - 擷取按鈕才是同意的動作，因此別人傳給你的連結永遠無法自行啟動讀取。

選擇設計檔案來源後,第二階段就是下方這張卡片:接受的格式以圖示圖磚依優先順序排列,整張卡片本身就是一個放置區 - 點按卡片任何位置或將檔案拖放到卡片上皆可。你也可以直接把檔案拖放到工作室上。

![匯入卡片 - 接受的格式以圖示圖磚排列,整張卡片是同一個放置區](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

每種設計檔案能為你帶來什麼:

- 一個 **Lolly design-system pack**(`.lolly`；仍接受舊版的 `.zip`) - 一步安裝完成；
- 一個 **Penpot** 匯出檔(`.penpot`) - 匯入其設計權杖；
- 一個 **Design Tokens** 檔案(`.json`) - W3C DTCG；
- 一個 **Tokens Studio** 檔案(`.json`) - Tokens Studio；
- 一個**純 SVG**(`.svg`) - Lolly 會掃描其中的色彩，讓你選擇要保留哪些，第一個會成為你的主色。

一個標誌/截圖、網站或已保存的頁面會開啟 **Your suggested design system**。用建議的色彩查看一個範例，如有需要可選擇不同的 **Main colour**，並為此系統命名。**Use this design system** 會套用產生出的淺色與深色調色盤，並回到 Overview。既有字體維持不變。這會取代目前系統的色彩與其他權杖設定。檢查點必須先成功建立；**Restore brand settings** 可恢復先前的設定。

**Source details and individual choices** 會顯示讀取到的內容、偵測到的字體名稱，以及預覽的文字/動作對比度。它還提供 **Choose individual items in the tray** 與 **Download design context**。JSON 報告帶有觀察結果、建議的權杖與來源資訊；保存的 HTML/CSS 包含所提供文字的 SHA-256。它不包含原始頁面文字，也不是一份已簽署的 Content Credential。字體名稱僅供建議：選擇與安裝字體的地方仍是 Type。

PDF 及其他設計檔案的匯入保留其既有的審視控制項。留在 **Tray** 中的項目不會改變任何內容，直到經由負責該類素材的房間各自加入為止。

`#/start?source=<kind>` 會以指定來源開啟選取器(`file`、`pdf`、`image`、`font`、`url`、`page`)，`?import` 則會開啟一般清單。

## 在裝置間搬移品牌

側邊列底部的 **Export** 會寫出單一個 **`LollyBrand-….lolly`** - 你的權杖、字體、標誌與主題偏好，並附有完整性清單，會在匯入回來時進行驗證。1.0.7 之前的網頁版把同一份內容命名為 `.zip`；這個舊版寫法仍可接受。旁邊的 **Tokens (.json)** 則會單獨寫出純粹的設計權杖文件：不含字體，不含標誌，只有權杖 - 這正是儲存庫、CI 流程或其他權杖工具實際會讀取的內容。

把品牌帶回來的方式是**從……加入 → 設計權杖或設計檔案**(如上所述),或直接拖放到工作室上。這是同事把品牌交給你,或是你把品牌帶到第二台裝置安裝的方式 - 不需帳號,不需雲端。若要改從命令列匯入品牌,請參閱 [`ingest:brand`](/info/configuration.html#brand-packs)。

## 還原較早的設定

在側邊列底部選擇 **Restore brand settings**，選取一個帶日期的檢查點，然後按 **Restore**。它會為目前的品牌還原色彩、字體設定與其他品牌權杖。字體與圖片檔案維持不變。

Lolly 會在套用檢查點之前，先把你目前的設定保存為 **Before restore**。選擇那個檢查點即可還原這次回復，即便在關閉並重新開啟瀏覽器之後也一樣。這台裝置上會保留最近 20 個檢查點。如果無法讀取儲存空間，或無法保存目前的設定，對話框會回報問題，讓你可以重試。

## 版本

側欄底部的**版本**功能,正是設計系統不再是「移動目標」的地方。發布一個版本,你就會得到保存在這台裝置上的**永久具名複本**:之後它永遠不會改變,因此釘選該版本的工具會持續繪製出相同的內容。此面板在你尚未有任何內容可發布之前會保持隱藏,因此從未發布過的工作室也永遠不會看到這些控制項。

在你按下任何按鈕之前，有三件事要先知道，而面板會在按下之前就說明這三件事，而非之後：

- **版本是永久的。** 目前尚未提供刪除功能,因此面板只會如實說明哪些內容已被保存、且會持續保存,而不會提供一個會說謊的按鈕。
- **移除項目會列在相容性卡片的最前面。** 新增與變更的權杖是好消息;而*移除*的權杖才是會破壞工具的關鍵所在,因此會優先列出,並直接稱之為移除。
- **發布無法復原;還原則可以。** *從此版本還原至最新狀態*屬於對主幹的一般編輯,因此會進入工作室的復原堆疊,面板也會立即提供**復原**選項。

你可以選擇 **Publish only**（僅發布），或 **Publish and make active**（發布並設為使用中）- 差別在於工具與應用程式從此是否會跟隨該版本，還是繼續跟隨你的最新編輯。**Follow the latest again**（再次跟隨最新版本）會讓每次編輯一做出就立即生效。`#/start?area=versions` 可直接開啟該面板。

## 品牌固定時

有些版本會附帶**鎖定的設計系統**，例如 SUSE Brand。開啟它會看到一段唯讀說明，附有**製作可編輯的副本**與**轉換**兩個按鈕。它原本的色彩、字體與權杖都會保持不變。你自己的本機系統仍然可以編輯，即便鎖定的系統是這台裝置上的第一個。在 Profile 中，**開啟**用來選擇一個系統並開啟它的工作室；**請打造新的**會建立一個本機系統，並在 `#/start` 開啟它，游標已定位在名稱欄位上。

## 接下來往哪裡走

- **[Using Lolly](/info/using.html)** - 畫布、儲存、專案與素材。
- **[Design Tokens](/info/design-tokens.html)** - 你的品牌所表達的權杖模型。
- **[Exporting & formats](/info/exporting.html)** - 列印單位、CMYK 以及你的品牌會匯出成的格式。


## 尋找並比較外觀

從 Overview 或 Profile 上的設計系統清單開啟 **Find a look**。瀏覽保存在這台裝置上的系統，以及少量可重複使用的 Lolly 範例。依名稱、色彩標籤或宣告的字體搜尋。**Closest to my current palette** 依測得的色彩相似度排序，字體家族相符時用來打破平手；這不是一個品質分數。

選取一個外觀即可檢視，選取兩個即可比較。檢視按鈕在小螢幕上依然可用。選取一個外觀不會改變任何內容。**Use this saved system** 會在既有的設計系統清單中切換。**Use these colours** 會透過一般的檢查點與安裝流程套用一個範例，並保留目前的字體。**Restore brand settings** 可以還原先前的外觀。

在 **Details and design context** 底下，已保存的系統帶有可編輯的 **Search tags** 與一個內容下載。範例採用 Lolly 原創的配色方案；沒有遠端抓取的靈感收藏，也不需要帳號。

![並排比較 Sunroom 與 Orchard，然後再決定套用哪一套色彩系統。](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

比較畫面會讓兩套調色盤同時保持可見。檢視一個外觀不會改變任何內容，直到你選擇 **Use these colours** 或 **Use this saved system**。

## 查看來源證據

來源檢視的選用詳細資料會顯示觀察到的字體排印、間隙、留白與圓角值。保存的 HTML/CSS 以及原生網站讀取回報的是宣告值，頁面實際算繪時未必會用到它們。瀏覽器擴充功能可以從一個有限的可見元素樣本中回報實測樣式，並附上其視窗大小與瀏覽器色彩偏好。較舊的擴充功能仍只能提供宣告值。缺少的欄位會顯示 **Not observed**。

這些只是觀察結果，不是自動的樣式設定。參考掃描不會擷取或安裝字體檔案，來源的間距也不會悄悄取代你自己的設定。數量描述的是樣本中出現的次數，而不是信心程度或品質。

## 對照設計系統檢查一份作品

在 Design 中，開啟 **Export**，然後開啟 **Before you export**。這項檢查使用與算繪相同的有效設計系統版本。它會比較作者設定的色彩、權杖別名、字體選擇與圖片素材 ID。自訂值可能是刻意為之；一張不在宣告品牌素材之內的圖片是一個待複核項目，而不是一張被禁止的圖片。

當有具體的色彩或字體建議可用時，其按鈕只會更改那一個圖層。一般的 **Undo** 會還原原始值。已鎖定或已變更的圖層不會被一個舊的建議覆寫。缺少的來源證據會與相符結果分開呈現。算繪後的對比度與文字排版由既有的常駐檢查負責。漸層、效果、巢狀的工具內容、權利與主觀品質不在品牌比較的評估範圍內。檢查不會阻擋 Download。

## 在本機使用設計內容

**Download design context** 包含權杖文件、已解析的色彩、宣告的字體家族、素材 ID、有記錄的來源證據、涵蓋範圍與明確規則。它不包含字體檔案或所有權證明。參考檢視也會包含其建議的權杖與觀察結果。

CLI 可以在不連接伺服器的情況下讀取這兩種下載內容：

```bash
lolly system import ./lolly-design-context.json
lolly system context --output=design-context.json
lolly system check ./design-inputs.json --file=design-context.json
```

`system check` 接受帶有 `boxes` 陣列的 Design 輸入，或一份已編譯的 Design 文件。它會回報建議的修正方案，而不會修改這份作品。它無法測量瀏覽器版面配置或算繪後的對比度。既有的 MCP 資源 **lolly://design-context** 會透過已設定的本機 MCP 處理程序公開目前有效系統的內容；不需要新的代管服務或 API 金鑰。
