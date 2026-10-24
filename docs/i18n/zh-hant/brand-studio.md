# Design System Setup

你的標誌、色彩與字型屬於同一個地方，讓每個工具、頁面與匯出都以它們繪製。那個地方就是位於 `#/start` 的 **Design System Setup**，它的標語說明了用途：*Make it yours*。

從你手上有的東西開始。放入標誌，Lolly 會讀取它的色彩。選擇字型，或放入你公司授權的字型檔案。每項更改都會立即顯示在整個應用程式中。你的標誌、字型與 token 留在這部裝置上。挑選 Google Font 是唯一會對外連絡的步驟：Lolly 會先詢問，然後只擷取該字型家族一次。

看起來對了之後，為設計系統命名並按下 **Export**。你會得到一個 `.lolly` 檔案，可供保存、在另一部裝置上開啟，或交給同事。[Settings](/info/dashboard.html#design-system) 以唯讀方式顯示使用中的系統，其封面有連結回到這裡進行編輯。

## 五分鐘讓它屬於你

::: timeline
- <!--i:upload--> 把**標誌拖放**到 **Logos** 中的放置區。Lolly 會讀取它的形狀與色彩。
- <!--i:palette--> **使用這些色彩。** 標誌的主色成為你的主色，標誌中的深色中性色成為你的文字色。
- <!--i:font--> 在 **Type** 中**選擇字型**：Google Font，或你擁有的字型檔案。
- <!--i:pentool--> **為系統命名。** 你的第一次編輯會建立屬於你自己的設計系統，而 Lolly 會詢問一次它的名稱。
- <!--i:download--> **Export** 會把整個系統寫成一個 `LollyBrand-….lolly` 檔案。
:::

標頭顯示你正在 **Editing** 哪個設計系統，其名稱是你隨時可以更改的欄位。當你的第一次編輯詢問 **What is this design system called?** 時，如果標誌上有拼出文字，其文字會被填入。**Save name** 保留名稱；**Not now** 會保留一個預留名稱，直到你在標頭中輸入。名稱會在 Settings 中以及你切換時標示該系統，也會成為 **Export** 寫出的檔案的名稱。

## 各個房間

工作室是側邊列中的一組房間，沒有固定順序：沒有任何編號，也沒有任何東西需要等待其他東西。在手機上，這個列會變成標頭下方的一排晶片。

![工作室的房間列：Overview、Colours、Type、Logos、Tokens、Files 與 Usage & rules](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| 房間 | 你在那裡做什麼 | 連結鍵 |
|---|---|---|
| **Overview** | 查看系統保存了什麼，並附有進入每個房間的門 | `overview` |
| **Colours** | 新增色彩、賦予角色、建立色階與調色盤 | `color` |
| **Type** | 選擇應用程式、工具與每個匯出所讀取的四種字型 | `type` |
| **Logos** | 以各種方向與處理方式放置你的標記 | `logos` |
| **Tokens** | 圓角、間距、陰影與其他每個具名的值 | `tokens` |
| **Files** | 你的品牌保存的圖片、音訊與動態檔案 | `catalogue` |
| **Usage & rules** | 你的品牌套用的規則，在實際範例上檢查 | `usage` |

以 `#/start?area=<key>` 連結到某個房間。Files 房間保留鍵 `catalogue`，因為房間鍵是永久的契約，而 `?tab=` 仍作為較舊的別名繼續有效。未知的鍵會開啟 Overview。

**側邊列的底部**放的是針對整個系統而非單一房間的動作。**Add from…** 帶入品牌（[帶入品牌](#bring-a-brand-in)），**Tray** 則保存掃描找到但你尚未加入的東西。**Export**、**Tokens (.json)**、**Fonts for Linux (.rpm)**、**Versions** 與 **Restore brand settings** 負責保存與搬移系統（[保存並搬移你的設計系統](#keep-and-move-your-design-system)）。每一項只有在有東西可以作用時才會出現。

## 總覽

在尚未選擇任何東西時，Overview 提供四種開始的方式。**Start from a reference** 開啟標誌、螢幕截圖、網頁或設計檔案的來源選擇器，而 **Pick a colour**、**Choose a face** 與 **Add a logo** 則直接開啟那些控制項。開啟任何一個都不會寫入內容，而 **Explore the tools** 從一開始就在。

一旦有任何東西屬於你自己，Overview 就會顯示你擁有什麼，以你自己的計數為先。Colours 給出色彩的數量，在顯示繼承色彩時附上淡化的 `· N starter`；它的色帶先放你的色彩，然後是一條細線，再來是淡化的起始色彩。Type 依角色顯示（*Inter for headings*，下一行是 *Starter for the rest*）。Logos 說明填了多少個欄位（或 **Not set**），Tokens 顯示圓角半徑，而在資料庫仍為空時，Files 顯示 **Nothing yet**。每個區塊都會開啟其房間。

### Starter 與 Yours

**Starter** 是隨應用程式而來、而非被選擇的任何東西的稱呼。全新安裝完全不帶任何色彩，只有一條從墨色到紙色的中性色階，讓表面、文字與細線在沒有人做決定之前就能渲染。同一個詞在每個房間中標示繼承而來的素材。

::: cols
## Starter

- 隨應用程式而來：墨色到紙色的中性色、起始字型、預設圓角半徑。
- 色調淡化，帶有 **Starter** 標籤，沒有色調。
- 不計入你的色彩。中性色存在於 **Tokens** 中的 **Neutrals · starter · 9**，而 **Open** 會在 Colours 中以一個摺疊的群組顯示它們（`#/start?area=color&group=neutral`）。
- 站在起始色彩上的角色顯示為 *"Starter Paper stands in"*，其選擇器上有 **Choose…**。

## Yours

- 由你選擇或安裝。
- 完整強度，而在你安裝了字型之處是帶色調的卡片。
- 計入 Overview 與 Tokens。
- 跟隨另一個角色的角色顯示為 **↳ follows Primary**，而不重複主色的名稱。
:::

繼承而來的素材絕不以虛線邊框繪製，因為在這裡虛線邊框代表放置目標。

## 標誌

把你放標誌的資料夾倒進最上方的放置區：**"Drop marks here, or choose several at once"** 接受你有多少檔案就收多少。每個檔案都會讀取其形狀與墨色，然後在 **Waiting for a slot** 下等候，成為一個說明它看起來像什麼的晶片，例如 *"Looks like the Horizontal primary"*，附上它使用的測量值與 **Place** 按鈕（欄位已填入時為 **Replace**）。在不確定之處，晶片會直說並提供 **Change slot**，列出全部八個。在你按下任何東西之前，不會放置任何內容。

邊緣多餘空白過多的標記會先得到修剪的提議；回答它或按 Escape，原檔就會原封不動放入。在標記可以填入空著的同層欄位之處，房間會提供衍生的 **mono** 或 **reverse** 版本，以標示為 *Generated* 的晶片呈現。

每個標記最後都會進入八個選用欄位的格線，每個 **orientation** 與 **treatment** 一個：

- **Orientations：** Horizontal（字標與符號排成一列）和 Vertical（堆疊，供方形與高的空間使用）。
- **Treatments：** Primary、Primary reverse（供深色背景）、Mono（單色）與 Mono reverse。

還沒有標記的群組會摺疊成一行；開啟它即可看到它的欄位。點擊欄位可新增 PNG、SVG、JPEG 或 WebP，或點擊已填入的欄位來取代標記。一切都留在這部裝置上。

![展開 Horizontal 與 Vertical 的標誌欄位：每種處理方式都是自己的欄位，且每個欄位都是選用的](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails%3Anth-of-type%281%29%3Esummary%3Bclick%3A.be-logo-identity%3Edetails%3Anth-of-type%282%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** 是你的品牌以自己的名稱稱呼的標記，例如圖示、徽章或 favicon。
- **More identities。** 子品牌、產品或活動可以有自己的完整一組：**+ Add another logo** 並為該組命名。你的主要一組是 "Your logo"。[品牌架構](/info/brand-architectures.html)說明何時標誌身分是正確的區塊。
- **Lolly 讀取標誌的色彩。** 放置區下方的卡片（以及 Colours 頂端再次出現的卡片）列出標誌的色彩並詢問 **Which is the main colour?**，並已選取最強的色彩（絕不是它匯出時所用的白色）。**Use these colours** 會把它們加入你的調色盤、將主色設為你的主要色彩，而當標誌有一個在紙上讀得清楚的深色中性色時，也會把它設為文字色。**Not now** 會把它們留在 Tray。在全新安裝上，最可能的答案會立即套用，卡片則提供 **Undo** 或另一個主色。SVG 能給出精確的色彩；PNG、JPEG 或 WebP 則給出覆蓋標記相當比例的色彩。

## 色彩

房間隨設計系統成長：第一次造訪只有一個決定，其餘的隨調色盤一起出現。

### 第一個色彩

沒有自己色彩的系統會以一個大色塊與一個欄位開啟，並附上一行說明角色、色階與列印設定會隨系統成長而出現。

- **色塊就是選擇器。** 按下 **Pick a colour**，工作室的 OKLCH 卡片就會開啟，以欄位中的任何內容為種子：名稱、色輪、四個轉盤、alpha 與 **Stored as**，底部有 **Cancel** 與 **Add colour**。在你按下 **Add colour** 之前，沒有任何內容會進入系統。
- **欄位接受任何記法：**`#e0452b`、`rgb(224 69 43)`、`oklch(58% .19 32)` 或色彩名稱。貼上一份清單，它會變成一排色塊，可逐個新增，或用 **Add all**。
- **另外兩種進入方式。** **Pick a colour from the screen** 在瀏覽器有滴管時使用滴管，**Take colours from an image** 則讀取這部裝置上的螢幕截圖或照片。
- **Add 永遠不會被停用。** 欄位中沒有內容時它會開啟選擇器；它無法讀取的文字會在欄位下方得到一行說明。

你的第一個色彩成為**主色**，並有一個晶片確認，例如 *"Primary is now Vivid Violet"*，附有 **Fine-tune** 可調整該色彩。


### 隨調色盤成長

你的色彩在寬螢幕上位於 **In context** 預覽旁邊，在較小的螢幕上則位於其上方。預覽以你的調色盤顯示海報、圖表或介面卡片。起始色彩留在它們自己的摺疊群組中。

![Lolly Demo 上的 Colours 房間：摺疊群組中的調色盤，每個色彩附有名稱與十六進位值，以及底部的下載膠囊](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![加入一個色彩後的 Colours 房間，帶有它的調色盤和一個即時的構圖預覽](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### 角色：工具讀取什麼

**Roles** 說明哪個色彩在每個工具與匯出中扮演哪個部分。它們是選用的（三個零散的色彩而沒有角色，是完全合格的系統），任何色彩都可以承擔一個，而對比讀數是對照表面測量的，以 APCA 為先。每個角色列顯示完整強度的自有色彩、頂替的起始色彩，或 **↳ follows Primary**。

一旦調色盤有了色階，色帶會顯示工具可讀取的全部七個角色：Primary、Secondary、Surface、Text、Muted、Edge 與 On primary。On primary 由主色衍生，顯示為 **Derived**，沒有選擇器。

應用程式自己的強調色預設跟隨設計系統。這就是 **Settings → Appearance** 中的 **Interface follows the design system** 設定；關閉該設定會讓應用程式的外框保持中性，而工具、畫布與匯出無論如何都跟隨設計系統。

**Colourways。** 設計系統可以保存多個主色，每件作品各自選擇。Lolly 保留每一種配色方案，但這個房間目前還無法建立配色方案：配色方案是寫在 token 檔案中的。在有配色方案的系統上，每種配色方案都需要自己的主色與次要色，而在配色方案為背景著色時還需要自己的表面色，所以這些角色仍在色票編輯器中設定。[實際使用 Lolly Demo](/info/lolly-demo-in-use.html#colourways-on-real-work)展示了在真實工作上的配色方案，[為設計系統加入配色方案](/info/colourways.html#add-colourways-to-a-design-system)則有格式說明。

### 找到更多色彩

有三個工具以你的主色為基礎。前兩個只提供建議，第三個在你審閱變更之後取代調色盤。

::: cols
## Explore shades & harmonies

選擇 **Starting colour**、**Scheme**（Mono、Complement、Analogous 或 Triad）以及 **Shades** 的數量（3 到 20，預設 5）。**Fine-tune** 設定介面強度、對比與品牌上的文字。點擊色階即可新增，或用 **Add 5 shades** 新增一組。你的色彩與角色會保留。

## Find matching colours

挑選 **Harmony**：Complementary、Adjacent、Triad、Tetrad 或 Analogous（**Accents** 從 2 到 5，**Angle** 從 10° 到 45°）。每個候選色都有產生的名稱與 **+ Add**，每個色彩按一次。

## Rebuild the whole palette

在審閱什麼會改變、什麼會保留之後，以一個起始色彩取代調色盤。會先建立檢查點，之後提供 **Undo**。
:::

三者都使用與引擎相同的感知色彩數學（OKLCH）。在 **Explore shades & harmonies** 中，**Primary**、**Neutral** 與 **Secondary** 列顯示建議的色階，而 **Theme preview** 顯示淺色與深色範例及其對比讀數。

![三組建議的色階，各自附有獨立的加入控制項，以及一個獨立的 Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![產生的強調色，每個都有色塊、自動產生的名稱、十六進位色碼與一個 Add 按鈕](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### 套用已產生的調色盤

開啟 **Rebuild the whole palette…** 並按下 **Preview full rebuild**。審閱會計算有多少角色維持你所指派的設定、保留了多少你自己的色彩，以及有多少色階曲線、列印鎖定、隱藏的色階與漸層停點被重新錨定或保留。**Apply rebuilt palette** 會提交；**Cancel** 不會改變任何東西。之後卡片會提供 **Undo** 並將焦點放在上面，而替換之前建立的檢查點可以還原整個系統。

具有配色方案的系統在重建過程中會保留每一種配色方案。標準配色方案跟隨新的起始色彩，而其他每種配色方案保留自己的色彩、名稱、順序與設定。審閱會列出哪一種配色方案跟隨，哪些保留其色彩。Lolly 不會重建以它無法編輯的方式編碼配色方案的系統；卡片會說明原因，而且不會改變任何東西。

### 進階區段

預覽與角色下方有四個摺疊的區段。每個都可用 `#/start?area=color&focus=<name>` 直接開啟：

- **Explore shades & harmonies**（`focus=generate`），如上所述。
- **Shade curves**（`focus=curves`）逐點重塑色階，具有獨立的明度、彩度與色相曲線（L / C / H），而色階會隨你拖曳重繪。
- **Contrast**（`focus=contrast`）：**Contrast-lock** 會重新調整色階，以達到對照你所選背景的 APCA 目標，**Rotate hue** 則繞著色輪旋轉整個色階。
- **Print**（`focus=print`）設定主色在印刷機上會變成什麼：其自動值、固定的 CMYK 組成，或具名特別色油墨。

### 調色盤與每個色票

調色盤將你的色彩列在摺疊群組中，每個群組有自己的 **+ Add**。可隨意建立並重新命名群組。角色絕不會產生第二個圖塊：角色所指的圖塊會改為戴上一個小標記（**P**、**S**、**Su**、**T**）。圖塊下方的 **Colour chart** 在 OKLCH 的 **Wheel**（拖曳圓點即可重新著色，點擊空白處可新增色票）以及顯示可顯示範圍終點的 **Gamut** 圖上呈現相同的色彩。`#/start?area=color&focus=chart` 會直接開啟圖表。

![調色盤面板，每組都可折疊，下載小圓鈕停靠在其底部邊緣](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![OKLCH 色輪 - 角度代表色相，離中心的距離代表彩度，灰階則沿側邊的明度軌道排列](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

點擊色票即可開啟其編輯器：

- **Rename** 色票。
- 在 OKLCH 滑桿上，或以 **Hex**、**HSL**、**RGB** 或 **CMYK** **設定色彩**。值欄位以使用中的色彩空間讀寫。這裡的 CMYK 是以轉換設定螢幕色彩；若要固定確切的油墨，請使用 **Print substitutes**。
- **Stored as** 選擇色票的儲存方式：**LCH**（預設，感知式且廣色域）、Hex、RGB 或 HSL。
- **Use as** 直接賦予色票一個角色。再次按下標示出的角色即可清除角色。
- **Print substitutes**（摺疊）：將 **CMYK** 從 **Auto** 鎖定為確切的油墨值，或設定 **Spot colour**，附上 **Name**（例如 `PANTONE 186 C`）、選用的 **Book**，以及用於燙金、壓凸、壓凹、局部上光、霧面觸感，或模切、壓線或穿孔的 **Finish**。印刷機在你匯出 CMYK PDF 或 TIFF 時會使用這些鎖定；請見[色彩描述檔](/info/exporting.html#colour-profiles)。
- **In other spaces**（摺疊）：每個色彩空間一個值，由衍生或你自己撰寫，匯出時以撰寫的值為準。

**刪除色票**是安全的。衍生的色階與主題角色會被隱藏，因此任何讀取它們的東西都不會壞掉，而你新增的色彩則會被移除。

::: details 處理許多色票
每個色票都有拖曳把手。拖曳即可在群組內重新排序，或讓把手取得焦點，按 Space、使用方向鍵，再按 Space 放下；Escape 取消。若要在群組之間移動色彩，請使用編輯器的 **Group** 控制項，或選取數個後使用 **Move to**。

選取不需要模式。選取列隨第一個被選取的圖塊出現，隨最後一個離開。

- **在空白處拖曳**可畫出矩形；它碰到的每個圖塊都會加入選取，跨越群組。摺疊的區段不會加入任何東西。
- **Shift 點擊**依閱讀順序選取範圍，**Cmd/Ctrl 點擊**切換單一圖塊，單純點擊則開啟編輯器。
- 每個群組標頭都有 **Select all**，而圖塊取得焦點時按 **Cmd-A** 會選取你擁有的每個色彩，絕不包含起始色彩。
- 格線只有一個 Tab 停駐點：方向鍵移動，Shift 加方向鍵延伸，Space 切換，Delete 移除，Escape 清除。若要微調通道，請先按 `l`、`c` 或 `h`。
- 在觸控螢幕上，按住圖塊以開始選取，然後點擊以新增。

選取列顯示 **{n} selected**，接著是 **Move to**、**Give a role**（每個色彩依序取得下一個角色）、**Download**（以六種調色盤格式中任一種下載選取範圍）、**Duplicate**（每個色彩的副本，放在原件之後）、**Copy values** 與 **Delete**。單一副本會直接在編輯器中開啟；多個副本則維持選取。一次 Cmd/Ctrl-Z 會復原整個批次動作。
:::

### 漸層

選用的 **Gradients** 面板由調色盤建立混色 token。每個漸層有預覽、2 到 8 個具名停點與角度。停點指向色票，所以為色票重新著色，漸層就會跟隨。混色在 OKLCH 中進行。

一旦有了色階，調色盤的下載（設計 token、CSS、SCSS、GIMP 與 Adobe Swatch Exchange）會放在調色盤底部的膠囊中。[隨處攜帶你的調色盤與字型](/info/using.html#take-your-palette-and-fonts-anywhere)說明了每種格式。

## 字體

在沒有自己字型時，房間只是一張卡片：**Primary**，以目前提供服務的字型用閱讀大小排版，帶有 **Starter** 標籤、**Choose a face** 按鈕，以及 *"Nothing installs until you choose one."* 這一行。Headings、code 與 italic 在你選擇它們之前都跟隨主色；**Choose them separately** 會顯示它們的卡片。

![尚未選擇字體的 Type 房間 - 一張閱讀大小的卡片，帶有一個 Starter 標籤，以及一個已填色的 Choose a face](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

選擇一種字型，房間就會展開成四張角色卡片、Fonts 清單與即時樣張：

- **Primary**：內文、按鈕與每個工具。
- **Headings**：`h1` 與 `h2` 的展示字型。
- **Code**：用於程式碼與資料的等寬字型。
- **Italic**：用於強調、引言與旁白的真正斜體。

只有在你安裝了該字型之處，卡片才會有色調，而它的按鈕在你自己的字型上顯示 **Change**，其他地方顯示 **Choose a face**。卡片上的任何東西都不會提交任何內容：按鈕會開啟該角色的比較舞台。

![四張角色卡揭曉 - 每張都以服務它的字體呈現，沒人選擇的一張帶著 Starter 標籤，Italic 沿用主要字體](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### 比較舞台

舞台在房間內、你所按的卡片下方開啟，卡片會摺疊成一行的條列，讓舞台顯示在手機的第一個畫面上。Escape 取消並將焦點還給卡片。

1. 在卡片上按下 **Choose a face**。
2. 輸入字型家族名稱並按下 **Preview**，或按下欄位下方六個 **Pinned** 字型家族之一。
3. 按下 **Use this face**。

![compare stage 在其卡片下方開啟，帶有搜尋列、已釘選的字體家族，以及折疊成一行的卡片](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**同意只詢問一次。** 預覽第一次連到 Google Fonts 時，會有對話框說明：*Google learns the family name and your IP address. The file is then kept on this device and used offline. This is the one step in the studio that reaches a third party.* **Fetch from Google** 會繼續並被記住。**Cancel** 會讓卡片顯示 *"Not fetched. Nothing was sent to Google."*，並附有它自己的 **Fetch from Google**。

**把字型檔案拖到舞台上**（TTF、OTF 或 WOFF），即可預覽你已擁有授權的字型。無論哪種方式，字型都留在這部裝置上，在應用程式、工具與每個匯出中離線渲染，並隨設計系統檔案一起傳遞。Google Fonts 上的一切都採用開放授權（OFL、Apache 或 UFL）。

### 此裝置上的字體

**Fonts** 面板列出這部裝置上的每個字型及其服務的角色。你新增的字型在 **In the design system** 下領頭，每個都附有其角色與刪除。起始字型接在後面，位於一個淡化的摺疊列中。**Add a face** 為任何角色開啟比較舞台。**Type roles** 面板顯示每個角色的即時樣張，附有其字型家族與狀態，例如 *Inter* 或 *Inter · follows Primary*。

## 權杖

Token 是設計系統背後的具名值：色彩、字型、標誌、圓角與間距。工具以名稱讀取它們，所以在這裡的更改會一次到達每個工具。

![Tokens 房間：頂部有取自系統的範例與檔案動作，圖塊計算每種 token，接著是附有對比讀數的色彩配對](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **頂部**給出取自你自己系統的範例（*Primary is Spearmint, #033633*）和檔案動作：**Download**（整個系統作為設計 token，或以其他五種格式下載調色盤）、**Copy CSS**，以及讀回 JSON 檔案的 **Add from…**。
- **圖塊**計算每種 token 並跳到其區段：Colours、Type、Logos、Shape and spacing、More 與 All tokens。它們計算屬於你自己的部分，與 Overview 相同。在手機上，圖塊可橫向捲動。
- **Colours** 先列出工具搭配使用的配對（表面上的文字、主色上的文字、表面上的淡化文字），附有淺色與深色的 APCA 讀數，並在配對不足之處標示 **Weak contrast**。接著是每個色彩群組：色階為一排色塊，其他色彩附有其值與工具使用的參照，例如 `{color.brand.spearmint}`。按下參照即可複製該參照。**Edit in Colours** 在 Colours 房間中開啟群組。
- **Type** 與 **Logos** 列出每個角色與每個標誌欄位的字型，一旦有自己的，就有 **Edit in Type** 與 **Edit in Logos**。
- **Shape and spacing** 包含 **Rounded corners**（`shape.radius`）與 **Spacing rhythm**（`space.base`）。在你移動滑桿之前，各顯示 *Lolly default*，之後顯示 *Yours*，會立即儲存並可復原。
- **More tokens** 加入間距、尺寸、筆畫寬度、不透明度、旋轉、純數字與陰影，以標準的[設計 token](/info/design-tokens.html) 儲存。
- **App appearance (advanced)** 列出 Lolly 自己的畫面使用的色彩、尺寸與陰影，而 **Inspect every token (advanced)** 可搜尋並編輯任何儲存的值，每項更改都會先顯示供審閱。

沒有任何內容的區段會提供填補空缺的方式：**Pick a colour**、**Choose a face** 或 **Add a logo**。

## 檔案

放入你的品牌保存的檔案（標誌除外）：**vector**、**image**、**audio** 與 **motion** 檔案（影片、Lottie 與動畫）。它們會出現在 [Assets](/info/using.html#assets-your-library) 中，分區整理，並在每個工具的素材選擇器中就緒，且留在這部裝置上。

## Usage & rules

**Usage & rules** 讓你的品牌選擇發揮作用：人們可以更改什麼、什麼保持固定，以及 Lolly 能檢查什麼。

![Lolly Demo 上的 Usage & rules：空的 Brand rules 卡片附有 Add your first rule，接著是 Try your brand in use，其範例已準備好渲染](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** 列出你的規則。**Add rule**（或 **Add your first rule**）開啟一個簡短的表單：

- 以你自己的話寫成的 **Rule name**，例如 *Beacon accents*；
- **Check**：**Colour choices**、**Font choices**、**Fixed artwork** 或 **Text length**，附上它使用的品牌角色，以你自己為角色取的名稱；
- 它套用的 **Example**（Poster、Title slide、Content slide 或 Chart）、**Mode**，以及它是 **Required** 還是 **Advisory**；
- **Reviewed by**，然後是 **Save draft** 或 **Approve & save**。

核准記錄的是你在這部裝置上自己的決定。已核准的必要規則會約束可重複使用的海報，而檢查只涵蓋範例 PNG；它們不會更改任何其他工具。

設計系統隨其 token 檔案帶來的規則（例如核准的色彩搭配、文字粗細與對齊，或每個介面的標誌）會在此列為 **Checked in Design**。Design 在匯出面板的 **Before you export** 卡片中逐層檢查它們，而 `lolly check` 對已儲存的 Design 文件做同樣的事（[匯出之前](/info/design.html#before-you-export)）。這個建置版本沒有檢查器的規則會依原樣保留並標示為 **Unchecked**。

**Try your brand in use** 以 **Render & check examples** 從目前的修訂版渲染四個範例。為標題、輔助文字與投影片文字選擇 **Brand mode** 與 **Try your own text**。每個範例都會回報測量到的內容，附有 **See checks & sources** 與 **Download check report**，而 **Make reusable poster** 會下載一個 `.lolly`，其固定版面與已核准的輸入選擇隨檔案一起傳遞。範例是本機的：執行檢查不會發布或核准任何東西。

帶有固定品牌的建置版本會在 *This brand is set* 之下，以唯讀方式顯示相同的規則與範例。

## 匯入品牌

側邊列底部的 **Add from…** 會開啟一個選擇器，詢問你有什麼，而不是它是什麼格式：

- **設計 token 或設計檔案**：DTCG 或 Tokens Studio JSON、Penpot 專案、token 集合的 zip、Lolly 設計系統套件或 SVG。
- **PDF**：簡報或指南檔案，在這部裝置上讀取其色彩、標記與內嵌字型。
- **標誌或螢幕截圖**：圖片會在這部裝置上讀取，成為建議的調色盤。它讀取的是色彩，而不是字型或版面。
- **已儲存的網頁**：一個 HTML 檔案及其 CSS 檔案，或貼上的 HTML 或 CSS，最多 20 個檔案與 2 MB。只會讀取你提供的文字：不會擷取連結的資源，也不會執行指令碼。
- **字型檔案**：TTF、OTF 或 WOFF。開啟 Type 房間，字型在那裡安裝。
- **網站**：一個頁面，讀取其色彩與字型。這個圖塊只出現在能讀取頁面的裝置上，並說明它使用哪個讀取器：這部裝置上的應用程式，或以你的身分登入、在背景分頁中運作的瀏覽器擴充功能。指定 URL 只會填入欄位；按下擷取才算同意。

選擇設計檔案來源後，下一張卡片會以圖示圖塊列出可接受的格式，整張卡片是一個放置目標。你也可以直接把檔案拖放到工作室上。

![匯入卡片 - 接受的格式以圖示圖磚排列,整張卡片是同一個放置區](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- **Lolly 設計系統套件**（`.lolly`，或舊式 `.zip`）一個步驟就能安裝。
- **Penpot** 匯出（`.penpot`）會帶入其設計 token。
- **Design Tokens**（W3C DTCG）或 **Tokens Studio** 檔案（`.json`）會帶入其 token。
- **純 SVG** 會被掃描出可供你挑選的色彩，第一個成為你的主色。

### 審閱參考

標誌、螢幕截圖、網站或已儲存的頁面會開啟 **Try these colours**：以建議色彩呈現的範例、你可以更改的 **Main colour**，以及新系統的名稱。一個方框會說明套用會做什麼：它會以產生的調色盤與預設樣式**取代**使用中的 token 設定、**保留**你的字型與資料庫檔案，且先前的系統可以**復原**。**Apply suggested settings** 會在建立檢查點之後套用淺色與深色調色盤，而 **Restore brand settings** 可以把舊設定帶回來。**Change reference** 選擇另一個來源。

**Palette, source details and individual choices** 顯示讀取到的內容、找到的任何字型名稱，以及預覽的對比。字型名稱只是建議；Type 仍是你安裝字型的地方。來源詳細資料可以包含觀察到的字體排印、間隙、內距與圓角值，否則標示為 **Not observed**。已儲存的頁面或原生網站讀取會回報宣告的樣式，頁面可能並未使用它們，而瀏覽器擴充功能可以從可見元素的樣本回報測量到的樣式。這些都是觀察結果：不會安裝任何東西，來源的間距也絕不會取代你自己的。**Choose individual items in the tray** 保留單一項目，而 **Download design context** 儲存一份 JSON 報告，內含觀察結果、建議的 token 與來源資訊（附上任何所提供 HTML 或 CSS 的 SHA-256）。報告不含原始頁面文字，也不是簽署的 Content Credential。

PDF 與設計檔案匯入保留自己的審閱控制項。**Tray** 中的項目在你把它們加入擁有該類素材的房間之前，不會改變任何東西。`#/start?source=<kind>` 在某個來源（`file`、`pdf`、`image`、`font`、`url`、`page`）上開啟選擇器，而 `?import` 開啟純清單。

### 尋找並比較外觀

從 Overview 或 Settings 中的設計系統清單開啟 **Find a look**。瀏覽儲存在這部裝置上的系統以及幾個可重複使用的 Lolly 範例，並依名稱、色彩標籤或宣告的字型搜尋。**Closest to my current palette** 依測量到的色彩相似度排序，字型相符者用於打破平手；這不是品質分數。

選擇一個外觀來審閱，或選擇兩個並排比較。選取不會改變任何東西。**Use this saved system** 會切換到它，**Use these colours** 則透過通常的檢查點套用範例的色彩，並保留你的字型。**Restore brand settings** 可復原先前的外觀。已儲存的系統在 **Details and design context** 下有可編輯的 **Search tags**。這些範例是 Lolly 原創的色彩配方，沒有爬取的收藏，也不需要帳號。

![並排比較 Sunroom 與 Orchard，然後再決定套用哪一套色彩系統。](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

## 保存並搬移你的設計系統

### 在裝置之間搬移品牌

**Export** 會寫出一個 **`LollyBrand-….lolly`** 檔案：你的 token、字型、標誌與主題偏好，附有在匯入時檢查的完整性 manifest。1.0.7 之前的網頁版本把同一個檔案命名為 `.zip`，而那種寫法仍被接受。**Tokens (.json)** 單獨寫出純設計 token 文件，不含字型或標誌，供儲存庫、建置步驟或另一個 token 工具使用。

若要帶回一個，請使用 **Add from… → Design tokens or a design file**，或把檔案拖放到工作室上。這就是同事把品牌交給你，或你把品牌帶到第二個安裝的方式，不需要帳號，也不需要雲端。若要從命令列帶入品牌，請見 [`ingest:brand`](/info/configuration.html#brand-packs)。

**Fonts for Linux (.rpm)** 會把你新增的字型打包成可安裝的 RPM。如果其中有任何字型是你自己上傳的，Lolly 會先要求你確認你可以重新散布它們。

### 還原較早的設定

選擇 **Restore brand settings**，選取有日期的檢查點並按下 **Restore**。它會還原使用中品牌的色彩、字型設定與其他 token；字型與圖片檔案維持原樣。Lolly 會先將你目前的設定儲存為 **Before restore**，所以即使關閉了瀏覽器，你也能復原一次還原。最近的 20 個檢查點保存在這部裝置上。

### 版本

已發布的版本是保存在這部裝置上的**永久、具名副本**。它絕不改變，所以固定它的工具或連結（以 `designv`）會持續繪製相同的東西。有你自己內容的系統，會在側邊列底部顯示低調的 **Versions & publishing** 連結；第一次發布之後，它會成為 **Versions** 項目。`#/start?area=versions` 會直接開啟它。

- **版本是永久的。** 目前沒有刪除功能，面板也會這樣說明。
- **相容性卡片以移除項目領頭**，因為被移除的 token 會讓工具壞掉。
- **發布無法復原；還原可以。** *Restore latest from this version* 是一般的編輯，並會立即提供 **Undo**。

**Publish only** 保留一個版本，而不改變工具所跟隨的內容；**Publish and make active** 讓工具和應用程式跟隨該版本。**Follow the latest again** 讓你每次的編輯在做出的當下就生效。

## 管理你的設計系統

開啟 **Settings → Preferences → Design systems** 來切換、新增或移除系統。**Open** 選取系統並在這裡開啟它；**Make a new one** 建立本機系統並開啟它，名稱欄位已就緒。一次只有一個系統處於使用中，適用於整部裝置。[品牌架構](/info/brand-architectures.html)有助於判斷品牌何時需要自己的設計系統。

**系統來自何處。** 部署的目錄所提供的系統顯示為 **Came with this app**，在連接到實例的應用程式中則為 **From this instance**。展開 **Catalogue source** 可看到是誰提供的、它的 token 素材與命名空間，以及已知的版本或校驗碼；如果更新失敗，快取的素材會有標示。

**受管理的系統為唯讀。** 當目錄鎖定系統時，系統顯示為 **Managed by this instance**（或在沒有實例的桌面應用程式中為 **Managed by this app**）。你可以使用並下載它，在這裡開啟它會顯示唯讀備註，附有 **Make an editable copy** 與 **Switch**。你自己的本機系統保持可編輯，即使受管理的系統先出現也一樣。帶有固定品牌的建置版本會在 *This brand is set* 上開啟 Design System Setup，並附有可閱讀的品牌 token 與使用規則。

**其他每個提供的系統都歸你**隱藏、編輯與重設，包括 lolly.tools 上的 Lolly Demo 與 Lolly Starter。編輯其中一個會保留它的名稱，並將該列標示為 **Edited here**，其選單中的 **Reset to original** 會捨棄在這部裝置上做的更改。空白的起始系統是例外：在那裡的第一次更改會開始你自己的設計系統，所以 Lolly 會問一次新系統要叫什麼。[實際使用 Lolly Demo](/info/lolly-demo-in-use.html#switch-to-your-own)展示了你自己的系統取代的是什麼。

### 移除設計系統

從系統的選單選擇 **Remove**；確認視窗會說明之後哪個系統會成為使用中。已儲存的工作階段、上傳內容以及與另一個系統共用的素材會保留。

移除提供的系統只會隱藏它：它的目錄素材會保留，**Bring back** 會再次顯示它，而如果你移除了其他所有系統，它會自行回來。移除匯入的或編輯過的副本不會移除提供的系統、其標誌或其字型，而如果該副本是使用中的，提供的系統會再次成為使用中。移除使用中的託管副本只會清除該副本的連線；另行選擇的實例仍保持選取。

更改伺服器所提供的內容是管理員的工作：其營運者更改來源目錄並重新部署，或由 Lolly Work 管理員審閱並套用伺服器變更。這裡的編輯只留在本機。請見[移除目錄設計系統](/info/configuration.html#removing-a-catalogue-design-system)與[設定](/info/configuration.html#supplied-and-local-design-systems)。

## 在應用程式之外使用設計脈絡

**Download design context** 會儲存 token 文件、解析後的色彩、宣告的字型家族、素材 ID、有記錄時的來源證據、涵蓋範圍與明確的規則，不含字型檔案，也不證明擁有權。命令列不需伺服器即可讀取該檔案：`lolly system import` 將它設為終端機的設計系統，`lolly system check` 則對照儲存的脈絡檢查 Design 輸入。[帶入你的設計系統](/info/cli.html#bring-your-design-system)涵蓋匯入，[指令使用哪個設計系統](/info/cli-decks.html#which-design-system-a-command-uses)涵蓋檢查，而 MCP 用戶端可從 `lolly://design-context` 讀取相同的簡介（[MCP Server](/info/mcp.html)）。

## 接下來往哪裡走

- **[使用 Lolly](/info/using.html)**：工具、儲存、分享與 Assets。
- **[品牌架構](/info/brand-architectures.html)**：事業部、產品、背書品牌、客戶與季節如何對應到設計系統、配色方案與標誌身分。
- **[設計 Token](/info/design-tokens.html)**：你的品牌所撰寫的 token 模型。
- **[匯出檔案](/info/exporting.html)**：列印單位、CMYK，以及你的品牌渲染成的格式。
