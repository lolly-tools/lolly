# Lolly Design System Setup

<a id="design-system-setup"></a>

**Lolly Design System Setup** 位於 `#/start`，包含你的標誌、色彩與字型。每個工具、頁面與匯出都會使用它們繪製。

拖入標誌，Lolly 就會讀取其色彩。選擇字型，或拖入公司取得授權的字型檔案。每次變更都會立即反映在整個應用程式中。你的標誌、字型與 token 會留在這部裝置上。只有選擇 Google Font 時會對外連線：Lolly 會先詢問，然後下載該字型家族一次。

為設計系統命名，並按下 **Export**，即可取得一個 `.lolly` 檔案。保留檔案、在另一部裝置開啟，或交給同事。[Lolly Settings](/info/dashboard.html#design-system) 以唯讀方式顯示目前啟用的系統；其封面會連回此處供你編輯。

<!--i:eti-clock-->
## 五分鐘內打造你自己的設計系統

::: timeline
- <!--i:upload--> **將你的標誌拖入** **Logos** 的拖放區。Lolly 會讀取其形狀與色彩。
- <!--i:palette--> **使用這些色彩。** 標誌的主色會成為你的主要色彩，標誌中的深色中性色則會成為文字色彩。
- <!--i:font--> **選擇字型**，在 **Type** 中選用 Google Font 或你擁有的字型檔案。
- <!--i:pentool--> **為系統命名。** 第一次編輯會建立你自己的設計系統，Lolly 會詢問一次名稱。
- <!--i:download--> **Export** 會將整個系統寫成一個 `LollyBrand-….lolly` 檔案。
:::

工作室頂端列會以可編輯欄位顯示設計系統名稱。**Enter** 保留新名稱，**Escape** 還原舊名稱。第一次編輯時若出現 **What is this design system called?**，Lolly 會填入標誌中的文字（若標誌有顯示文字）。**Save name** 會保留名稱；**Not now** 則保留預留名稱，直到你在頂端列輸入名稱。名稱會用於 Settings 與切換時的系統標示，也會作為 **Export** 寫出的檔名。

<!--i:eti-grid-->
## 各個工作區

工作室由多個工作區組成，沒有固定順序。工作區之間不必互相等待。在桌面上，工作區排列在頂端列下方的同一條導覽列中。在手機上，它們會移至底部邊緣的列中，並捲動到顯示目前開啟的工作區。調色盤面板與托盤會從該列上方展開，輸入時該列會移開。使用鍵盤時，Tab 只會停在這條列一次，方向鍵、Home 與 End 則用來在工作區之間移動。

![工作室的頂端列與各個工作區：Board、Colours、Type、Logos、Tokens、Files、Sound、Rules 與 Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| 工作區 | 你可以在這裡做什麼 | 連結鍵 |
|---|---|---|
| **Board** | 查看系統包含的內容，並進入各個工作區 | `overview` |
| **Colours** | 加入色彩、指定角色、建立色階與調色盤 | `color` |
| **Type** | 選擇應用程式、工具與每次匯出讀取的四種字型 | `type` |
| **Logos** | 放置各種方向與處理方式的標誌 | `logos` |
| **Tokens** | 圓角、間距、陰影與其他所有命名數值 | `tokens` |
| **Files** | 品牌保存的圖片、音訊與動態檔案 | `catalogue` |
| **Sound** | 塑造聲音識別、不同用途的音樂，以及語音與品牌的關係 | `sound` |
| **Rules** | 品牌採用的規則，並以實際範例檢查 | `usage` |
| **Skills** | 供人員與代理程式閱讀、下載的品牌書面標準 | `skills` |

使用 `#/start?area=<key>` 連到工作區。工作區的鍵是固定的，因此 Files 保留 `catalogue`，Board 保留 `overview`，Rules 保留 `usage`。`?tab=` 仍可作為舊版別名使用。未知的鍵會開啟 Board。

整個系統的動作都在**頂端列**。**Add from…** 會匯入品牌（[匯入品牌](#bring-a-brand-in)）。**Tray** 保存掃描找到、但你尚未加入的內容。**Export** 將系統寫成一個檔案。**More** 包含 **Tokens (.json)**、**Fonts for Linux (.rpm)**、**Versions & publishing**、**Restore brand settings** 與 **Design systems**；最後一項會開啟 Settings 中供你切換的清單（[保存與搬移你的設計系統](#keep-and-move-your-design-system)）。每個動作都會在有可處理的內容時出現。在手機上，**Add from…** 會移至 **More**，而 **Export** 會以圖示顯示。

當設計系統仍是應用程式隨附的系統時，頂端列以 **Make it yours** 開頭，這個選單包含 **Find a look**、**Add from…** 與 **Pick a colour**。系統成為你自己的之後，**Export** 就會回到該位置。

<!--i:eti-clipboard-->
## Board

尚未選擇任何內容時，Board 提供四種開始方式。**Start from a reference** 會開啟來源選擇器，可選擇標誌、螢幕截圖、網頁或設計檔案。**Pick a colour**、**Choose a face** 與 **Add a logo** 會開啟對應的控制項。開啟控制項不會寫入任何內容。在它們下方，**Find a look** 提供現成的色彩與字型供你試用，而 **Explore the tools** 從一開始就可使用。

只要有任何內容成為你自己的，Board 就會顯示你擁有的內容，先列出你自己的數量。Colours 顯示色彩數量，繼承的色彩則以淡化的 `· N starter` 表示。色彩列先顯示你的色彩，接著是細線，然後是淡化的起始色彩。Colourways 將每種配色方案顯示為使用其主導色彩的小方塊。Type 列出每個角色，並以各字型家族自己的字型呈現（*Inter for headings*，下方一行為 *Starter for the rest*）。Logos 顯示已填入多少個欄位（或 **Not set**），Tokens 顯示圓角半徑，Files 則在資料庫為空時顯示 **Nothing yet**。每個區塊都能開啟對應的工作區。

應用程式隨附且可編輯的設計系統，例如 Lolly Demo，從一開始就會在 Board 顯示色彩、配色方案、字型與標誌，標題旁附有 **Came with this app** 標籤。它們上方的 **Start here** 提供 **Find a look**、**Add from…** 與 **Pick a colour**。

### 起始內容與你的內容

在每個工作區中，**Starter** 標示應用程式隨附、且無人選擇過的內容。全新安裝不帶任何色彩，只有一組從墨色到紙色的中性色階，因此在任何人做出選擇之前，表面、文字與細線就能渲染。

::: cols
## 起始內容

- 應用程式隨附：從墨色到紙色的中性色、起始字型與預設圓角半徑。
- 淡化顯示，附有 **Starter** 標籤，不帶色調。
- 不計入你的色彩。中性色在 **Tokens** 中以 **Neutrals · starter · 9** 顯示，**Open** 會在 Colours 中將它們顯示為一個摺疊群組（`#/start?area=color&group=neutral`）。
- 使用起始色彩的角色會顯示 *"Starter Paper stands in"*，其選擇器上則顯示 **Choose…**。

## 你的內容

- 由你選擇或安裝。
- 完整顯示色彩，已安裝字型的卡片帶有色調。
- 計入 Board 與 Tokens 的數量。
- 跟隨另一角色的角色會顯示 **↳ follows Primary**。
:::

繼承的素材絕不會有虛線邊框。虛線邊框表示可拖放的目標。

<!--i:eti-shapes-->
## Logos

頂端的拖放區 **"Drop marks here, or choose several at once"** 可接受你所有的檔案。Lolly 會讀取每個檔案的形狀與著色。接著，檔案會在 **Waiting for a slot** 下等待，以標籤說明它看起來像什麼，例如 *"Looks like the Horizontal primary"*，並附上判斷時使用的測量值與 **Place** 按鈕（欄位已有內容時為 **Replace**）。Lolly 不確定時，標籤會明確說明，並提供 **Change slot**，列出全部八個欄位。按下按鈕之前，不會放置任何內容。

標誌若有多餘的空白邊界，會先提出裁切建議。回應建議，或按 Escape 原樣放置原始檔案。若標誌可填入同組的另一個空欄位，工作區會提供衍生的**單色**或**反白**版本，以標示 *Generated* 的標籤呈現。

每個標誌都放入由八個選用欄位組成的格線，每種**方向**與**處理方式**的組合各佔一個欄位：

- **方向：** Horizontal（字標與符號橫向排列）與 Vertical（垂直堆疊，適合正方形與狹長空間）。
- **處理方式：** Primary、Primary reverse（適用於深色背景）、Mono（單色）與 Mono reverse。

沒有標誌的群組會摺疊為一行；展開群組即可看到其欄位。點擊欄位可加入 PNG、SVG、JPEG 或 WebP，或點擊已有內容的欄位來取代標誌。空欄位也接受拖入的檔案。橫向標誌放在寬方塊中，縱向標誌則放在正方形中，各自使用原先設計搭配的表面，並留出標誌高度四分之一的淨空。所有內容都留在這部裝置上。

![展開 Horizontal 與 Vertical 的標誌欄位：每種處理方式都有自己的欄位，所有欄位都可選填](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** 是品牌自行命名的標誌，例如圖示、徽章或網站圖示。
- **更多識別。** 子品牌、產品或活動可以各有完整的一組：按下 **+ Add another logo**，並為該組命名。主要的一組稱為「Your logo」。[品牌架構](/info/brand-architectures.html)說明何時該使用標誌識別。
- **Lolly 會讀取標誌的色彩。** 拖放區下方與 Colours 頂端的卡片會列出標誌的色彩，並詢問 **Which is the main colour?**。預先選取的是最鮮明的色彩，絕不會選標誌匯出時的白色底色。**Use these colours** 會將它們加入調色盤，並將主色設為你的主要色彩。當標誌中有在紙色上清晰可見的深色中性色時，該中性色會成為文字色彩。**Not now** 會將它們留在 Tray。全新安裝時，Lolly 會立即套用最可能的答案，卡片則提供 **Undo** 或選擇另一個主色。SVG 提供精確的色彩；PNG、JPEG 或 WebP 則提供在標誌中佔有相當比例的色彩。

<!--i:eti-palette-->
## Colours

工作區會隨設計系統成長。第一次使用只需做一個決定；調色盤擴充後，更多控制項就會出現。

### 第一個色彩

尚無自有色彩的系統會將起始中性色顯示在獨立展開的群組中。工作區頂端是虛線框的貼上與拖放欄位：一個大色塊與一個欄位。將圖片或色彩清單拖到欄位的任何位置，Lolly 就會讀取色彩。

- **色塊就是選擇器。** **Pick a colour** 會開啟工作室的 OKLCH 卡片，以欄位內容作為初始值。卡片先顯示色彩名稱與十六進位值。色彩空間、色輪、四個旋鈕與 alpha 位於 **Fine-tune** 下，**Cancel** 與 **Add colour** 則在底部。按下 **Add colour** 前，不會將任何內容加入系統。
- **欄位接受任何表示法**：`#e0452b`、`rgb(224 69 43)`、`oklch(58% .19 32)` 或色彩名稱。貼上的清單會變成一排色塊，可逐一加入或使用 **Add all**。
- **另外兩種加入方式。** **Pick a colour from the screen** 會使用瀏覽器提供的滴管（若有提供），**Take colours from an image** 則會讀取這部裝置上的螢幕截圖或照片。
- **Add 絕不會停用。** 欄位為空時會開啟選擇器；遇到無法讀取的文字，則會在欄位下方用一行文字說明。

你的第一個色彩會成為**主要色彩**。標籤會確認變更，例如 *"Primary is now Vivid Violet"*，並提供 **Fine-tune** 來調整色彩。


### 隨著調色盤擴充

在寬螢幕上，你的色彩位於 **In context** 預覽旁，在較小螢幕上則位於預覽上方。預覽會使用你的調色盤顯示海報、圖表或介面卡片。起始色彩有自己的群組，系統一旦有了自有色彩，該群組就會摺疊。貼上與拖放欄位會縮成精簡的一列。工作區頂端沒有匯出功能；請使用頂端列的 **Export** 或 Tokens 工作區。

![Lolly Demo 的 Colours 工作區：頂端是角色標籤與貼上及拖放欄位，下方是分成可摺疊群組的調色盤，每個色彩都附有名稱與十六進位值](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Lolly Demo 加入一個色彩後的 Colours 工作區：Colour roles 表格，下方是新色彩的色塊，提供 Use as Lead? 與 Fine-tune，旁邊有即時構圖預覽](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### 色彩角色：色彩的名稱

設計系統會為色彩命名，並說明各自的用途，Lolly 會讀取這兩者。**Colour roles** 位於 Colours 工作區頂端。**In context** 會立即顯示每次變更。

![虛構紡織品牌 Wefthouse 的 Colour roles 表格，使用品牌自己的用語：配色方案色塊 Indigo、Madder 與 Weld，接著是 Main、Accent、Supporting 與 Tertiary，各自包含淺色與深色色彩，分別解讀為主導色彩、搭配色彩或僅依名稱使用；表格下方列出 Background、Text、Quiet text 與 Hairlines，表示目前沒有角色對應的解讀用途](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

表格有四欄。在手機上，每列都會變成一張卡片，將淺色與深色並排顯示：

| 欄位 | 包含的內容 |
|---|---|
| **Role** | 設計系統自己的用語，可直接編輯，並有一行說明色彩的用途 |
| **Light** 與 **Dark** | 所選配色方案在該外觀中的色彩，附有名稱或數值，以及對比度 |
| **Lolly reads this as** | 以 Lolly 自己的用語說明工具如何使用該角色 |

**Lolly 如何解讀角色。** 每種解讀方式對應一個角色。選擇其他角色已有的解讀方式，會將該解讀方式移到這個角色。Lolly 絕不從名稱推斷含義。

| 解讀方式 | 對應用途 |
|---|---|
| **Lead colour** | 大型圖形、按鈕，以及工具優先使用的色彩 |
| **Partner colour** | 工具其次使用的色彩 |
| **Background** | 位於其他一切內容的後方 |
| **Text** | 標題與內文 |
| **Quiet text** | 圖說與小字 |
| **Hairlines** | 橫線、邊框與分隔線 |
| **By name only** | 沒有工具會自行選用此角色。每個色彩欄位與 Design 都會提供此角色，選取後會保持連結，因此會隨配色方案變化 |

沒有角色對應的解讀方式會保留設計系統的定義，工作區會在表格下方列出這些解讀方式。與某種解讀方式使用相同 id 的角色，例如名為 Primary 的角色，本身就是該解讀方式，無法移動。

**在圖表中。** Lolly Chart 的 **Design system - colour roles first** 色盤會依設計系統自己的順序，將其色彩角色指派給數列，接著使用色盤中的其餘色彩。解讀為背景、文字、次要文字或細線的角色會被排除，因為圖表會用這些色彩繪製背景與文字。選擇該色盤之前，不會有任何變化。沒有色彩角色的設計系統會以 **Design system - ordered** 繪製色盤。

**數值。** 按下數值，即可為該角色選擇目前外觀與所選配色方案的色彩。**Same as light** 會讓深色數值跟隨淺色數值，直到你選擇深色色彩為止。**Aa** 晶片顯示 Lolly 選來放在該色彩上的文字。數值下方的一行說明文字在各種外觀中的可讀性：**Text reads well**、**Large text only** 或 **Hard to read as text**。評等只針對放在該色彩上的文字；該色彩仍可用於圖形與大面積區域。僅按名稱解讀的角色會顯示相同的文字，但不使用警告色，因為沒有工具會自行在該角色上放置文字。工具提示與選擇器會顯示數據，先列 APCA，再列 WCAG。**Own text colour** 標示檔案已指定文字色彩的數值；該文字色彩會保留。**Copied** 標示來自其他配色方案或搭配色、尚未經任何人選定的數值；選擇器中的 **Keep this colour** 可確定該數值。

**起點。** 沒有自訂角色的設計系統會顯示目前的名稱：Primary、Secondary、Surface 與 Text。在你更改其中一項之前，不會寫入任何內容。**+ Add a role** 會建議 **Primary, Secondary** 或 **Main, Accent, Supporting, Tertiary**，也接受你輸入的任何名稱，並顯示各名稱會對應的解讀方式。前兩個名稱會成為主導色與搭配色。工具會繼續繪製相同的色彩。在只有一個主導色的系統中，第一個配色方案會採用該色彩的名稱。

**重新命名、重新排序與移除。** 重新命名只會更改名稱；所有使用該角色的內容都會繼續運作。拖曳角色的把手，或在把手上按 Space、使用方向鍵，再按 Space 放下。**Remove** 會說明哪些內容仍在使用該角色。當工具會解讀該角色時，**Remove and keep those colours** 會讓各解讀方式保留目前的色彩。使用該角色的組織規則、指南群組、工具欄位或其他 token 會讓角色無法移除，直到該用途改變。已儲存的 Design 文件也可能按名稱使用角色，Lolly 無法從 token 檔案得知這件事。這類文件會將該色彩回報為無法解析。

::: details 手寫 token 檔案中的角色
**手寫檔案。** token 檔案中未由任何角色宣告的色彩，會列在 **In this file, with no role yet** 下，每個色彩都有名稱欄位與 **Make a role**。無論是否建立角色，它們都會繼續按名稱運作。名稱中含有數字的 token 無法成為角色；它會留在檔案中，繼續透過其路徑運作。如果檔案中的記錄未通過驗證，表格會顯示但沒有控制項，並說明原因。
:::

**工作區的其他部分使用相同的名稱。** 晶片、色票的 **Use as** 列，以及色盤的 **Colour roles** 群組，都使用設計系統的名稱。色彩角色的方塊會開啟其數值。匯出的檔案不會新增任何角色記錄；渲染結果的色彩會改變，是因為 token 改變了。

**名稱會送到哪裡。** 名稱與描述會隨設計系統一起傳遞。代理程式會在設計摘要、`lolly://tokens` 與品牌頁面的 `AGENTS.md` 中讀取它們。終端機會在 `lolly system status` 中顯示它們。品牌頁面會將它們列在 `brand.json` 中，並為每個角色測量一組色彩的對比。DTCG 與 Tokens Studio 檔案會保留所有內容，`DESIGN.md` 會保留名稱與解讀方式，而 PowerPoint 佈景主題只保留品牌的順序。[其他格式中的色彩角色](/info/design-tokens.html#colour-roles-in-other-formats)有完整清單。名稱一律作為設計系統的資料引用，絕不會被當作指令解讀。

**選擇色彩的地方。** 工具與 Lolly Design 中的每個色彩欄位，都會先依設計系統自己的順序列出其角色，附上各名稱與用途。角色旁的 **Aa** 可選擇放在該角色上的色彩。其他色彩接著列在 **Other colours** 下，不包含配色方案自己的副本、前景色，以及已有角色對應的解讀方式。選取的色彩會保持與角色連結，並隨配色方案變化。欄位在每個配色方案中都會顯示名稱，Settings 與 Tokens 也使用該名稱。沒有角色的設計系統會保留其色票格線。

### 工具讀取的每個色彩

收合 **Colour roles** 時，工作區會先顯示供初步選擇的晶片。每個晶片顯示角色的色彩與名稱。沒有自訂名稱的系統會使用 **Primary**、**Secondary**、**Surface** 與 **Text**。按下晶片，即可從色盤的色票中選擇其色彩。**Colour roles** 底部的 **Every colour a tool reads** 包含完整色彩列。

色彩列顯示工具可以讀取的七個色彩：Primary、Secondary、Surface、Text、Muted、Edge 與 On primary，設計系統有自訂名稱時則使用自訂名稱。各色彩在每個工具與匯出中的用途都相同。沒有任何一項必須設定，也可以用任何色彩填入。三個獨立的色彩就能構成良好的系統。讀數會說明文字相對於底色的可讀性，先列 APCA。每一列會以完整強度顯示你自己的色彩、暫代的起始色彩，或 **↳ follows Primary**。

On primary 由主色衍生，顯示 **Derived**，且沒有選擇器。On primary 旁的 **Light** 與 **Dark** 切換，以及 **In context** 旁的切換，可選擇色彩列、色盤與預覽所顯示的外觀。

應用程式自己的強調色預設會透過 **Settings → Appearance** 中的 **Interface follows the design system** 設定跟隨設計系統。關閉此設定時，應用程式的介面維持中性色。無論此設定為何，工具、畫布與匯出都會跟隨設計系統。

**配色方案。** 設計系統可包含多個主導色，供每件作品各自選擇。**Colour roles** 頂端的 **Colourways** 列會為每個配色方案顯示一個晶片，並在標準配色方案上標示 **Default**。**+ Add** 會從色盤中的色彩建立新的配色方案。選擇晶片後，表格、色彩列、色盤與預覽都會顯示該配色方案。你可以重新命名、複製、移除所選配色方案，或將其設為預設值。在有配色方案的系統中，每個配色方案都需要自己的主色與次色；當配色方案會為背景上色時，也需要自己的底色。這些角色在色票編輯器中會保持設定。[為設計系統新增配色方案](/info/colourways.html#add-colourways-to-a-design-system)包含步驟與 token 格式，[實際使用 Lolly Demo](/info/lolly-demo-in-use.html#colourways-on-real-work)則展示了在真實工作上的配色方案。每個人都可以在 **Settings → Appearance** 中選用自己的配色方案（[選用自己的配色方案](/info/colourways.html#make-a-colourway-your-own)）。

### 尋找更多色彩

三個工具以你的主色為基礎。前兩個只提供建議；第三個會取代色盤。

::: cols
## 探索色階與和諧配色

選擇 **Starting colour**、**Scheme**（Mono、Complement、Analogous 或 Triad），以及 **Shades** 的數量（3 到 20，預設為 5）。**Fine-tune** 可設定 UI 強度、對比與品牌色上的文字。點擊色階即可加入，或按 **Add 5 shades** 加入一組。你的色彩與角色會保留。

## 尋找搭配色彩

選擇 **Harmony**：Complementary、Adjacent、Triad、Tetrad 或 Analogous（**Accents** 為 2 到 5，**Angle** 為 10° 到 45°）。每個候選色彩都有產生的名稱與 **+ Add**，每按一次加入一個色彩。

## 重建整個色盤

檢閱會更改與保留的內容後，從一個起始色彩重建並取代色盤。
:::

三者都使用與引擎相同的感知色彩數學（OKLCH）。在 **Explore shades & harmonies** 中，**Primary**、**Neutral** 與 **Secondary** 列會顯示建議的色階，**Theme preview** 則顯示淺色與深色範例及其對比讀數。

![三組建議色階，各有新增控制項，另有獨立的 Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![產生的強調色，每個都有色票、自動產生的名稱、十六進位色碼與 Add 按鈕](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### 套用產生的色盤

開啟 **Rebuild the whole palette…** 並按下 **Preview full rebuild**。檢閱畫面會統計有多少角色保留你指派的用途、多少自訂色彩被保留，以及多少色階曲線、印刷鎖定、隱藏色階與漸層色標會重新設定錨點或保留。**Apply rebuilt palette** 會套用；**Cancel** 不會更改任何內容。之後卡片會提供已取得焦點的 **Undo**，而替換前建立的檢查點可還原整個系統。

有配色方案的系統會在重建時保留每個配色方案。標準配色方案會跟隨新的起始色彩，其他每個配色方案則保留自己的色彩、名稱、順序與設定。檢閱畫面會列出哪個配色方案會跟隨，以及哪些會保留自己的色彩。如果無法編輯系統的配色方案編碼，Lolly 就不會重建該系統；卡片會說明原因，且不會更改任何內容。

### 專家區段

預覽與角色下方有四個收合的區段。每個區段都能透過 `#/start?area=color&focus=<name>` 開啟：

- **Explore shades & harmonies**（`focus=generate`）。
- **Shade curves**（`focus=curves`）可逐點調整色階序列的形狀，明度、彩度與色相各有獨立曲線（L / C / H），拖曳時色階會跟著重繪。
- **Contrast**（`focus=contrast`）：**Contrast-lock** 會調整色階序列的色調，讓它相對於你選擇的背景達到 APCA 目標，**Rotate hue** 則讓整個色階序列沿色輪旋轉。
- **Print**（`focus=print`）可設定主色在印刷機上使用的色彩：自動數值、固定的 CMYK 配比，或具名的特別色油墨。

### 色盤與各個色票

色盤以可摺疊群組列出你的色彩，每組都有自己的 **+ Add**。你可以建立與重新命名群組。角色不會建立第二個方塊；角色指向的方塊會顯示角色名稱，例如 **Primary**。方塊下方的 **Colour chart** 會在 OKLCH **Wheel** 上顯示相同色彩（拖曳圓點以更改色彩，點擊空白處以新增色票），以及顯示可顯示範圍邊界的 **Gamut** 圖。`#/start?area=color&focus=chart` 可開啟該圖。

![色盤面板，每個群組都可摺疊](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![OKLCH 色輪：角度是色相，向外的距離是彩度，灰色則排列在側邊的明度軌道上](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

點擊色票即可開啟其編輯器：

- **Rename** 可重新命名色票。
- **Set the colour** 可使用 OKLCH 滑桿，或以 **Hex**、**HSL**、**RGB** 或 **CMYK** 設定色彩。數值欄位會以目前的色彩空間讀寫。這裡的 CMYK 會透過轉換設定螢幕色彩；若要固定精確的油墨值，請使用 **Print substitutes**。
- **Stored as** 可選擇色票的儲存方式：**LCH**（預設，符合感知且具廣色域）、Hex、RGB 或 HSL。
- **Use as** 會賦予色票一個角色，設計系統有自訂名稱時則使用自訂名稱。再次按下醒目標示的角色即可清除該角色。
- **Print substitutes**（收合）：將 **CMYK** 從 **Auto** 鎖定為精確的油墨值，或設定 **Spot colour**，包含 **Name**（例如 `PANTONE 186 C`）、選用的 **Book**，以及 **Finish**，可用於燙箔、壓凸、壓凹、局部上光、柔觸處理，或模切、壓線、打孔。匯出 CMYK PDF 或 TIFF 時，印刷機會使用這些鎖定值；請見[色彩描述檔](/info/exporting.html#colour-profiles)。在 Print PDF 中，特別色油墨會以自己的色版印刷；若要在單次匯出中將所有特別色油墨以四色印刷呈現，請見[將特別色油墨轉為四色印刷](/info/exporting.html#spot-inks-as-process)。
- **In other spaces**（收合）：每個色彩空間各有一個數值，可為衍生值或由你設定，匯出時以你設定的數值為優先。

**刪除色票**是安全的。衍生色階與主題角色會被隱藏，因此讀取它們的內容不會失效。你新增的色彩則會被移除。

::: details 處理大量色票
一般狀態下，色票會顯示其色彩、名稱與十六進位色碼。Select 會在任何螢幕上顯示各色票的核取方塊與拖曳把手，取得鍵盤焦點的方塊也會顯示把手。拖曳把手即可在群組內重新排序，或讓把手取得焦點、按 Space、使用方向鍵，再按 Space 放下；Escape 會取消。在手機上，色盤每列顯示四個色彩。若要在群組間移動色彩，請使用編輯器的 **Group** 控制項，或選取多個色彩並使用 **Move to**。

選取不需要獨立的開關：選取第一個方塊時，操作列與核取方塊便會出現，最後一個方塊取消選取時便會消失。

- **在空白處拖曳**以畫出矩形；矩形碰到的每個方塊都會加入選取範圍，可跨越群組。收合的區段不會加入任何內容。
- **Shift 加點擊**會依閱讀順序選取一個範圍，**Cmd/Ctrl 加點擊**會切換單一方塊的選取狀態，一般點擊則會開啟編輯器。
- 每個群組標題都有 **Select all**，方塊取得焦點時按 **Cmd-A** 會選取你擁有的每個色彩，絕不會選取起始色彩。
- 格線只有一個 Tab 停駐點：方向鍵移動，Shift 加方向鍵延伸選取範圍，Space 切換選取狀態，Delete 移除，Escape 清除選取。若要微調通道，請先按 `l`、`c` 或 `h`。
- 在觸控螢幕上，按住方塊即可開始選取，接著點按以加入。

操作列會顯示 **{n} selected**，接著是 **Move to**、**Give a role**（各色彩依序取得下一個角色）、**Download**（以六種色盤格式中的任一種下載選取範圍）、**Duplicate**（各複製一份，放在原項目之後）、**Copy values** 與 **Delete**。單一副本會在編輯器中開啟；多個副本則保持選取。按一次 Cmd/Ctrl-Z 即可復原批次動作。
:::

### 漸層

選用的 **Gradients** 面板會從色盤建立混色 token。每個漸層都有預覽、2 到 8 個具名色標與角度。色標指向色票，因此更改色票的色彩時，漸層也會跟著變化。混色在 OKLCH 中進行。

色盤的下載選項（設計 token、CSS、SCSS、GIMP 與 Adobe Swatch Exchange）位於色盤頂端。[隨處使用你的色盤與字型](/info/using.html#take-your-palette-and-fonts-anywhere)說明了各種格式。

<!--i:eti-type-->
## 字體排印

尚未選擇自訂字型時，工作區會顯示一張卡片：**Primary**，以目前字型與適合閱讀的大小顯示，附有 **Starter** 標籤、**Choose for Primary** 按鈕，以及一行 *「選擇字型之前，不會安裝任何內容。」*。在你為標題、程式碼與斜體選擇字型之前，它們都會跟隨主字型；**Choose them separately** 會顯示各自的卡片。

![尚未選擇字型的 Type 工作區：一張以適合閱讀的大小顯示的卡片，帶有 Starter 標籤，以及一個實心的 Choose for Primary 按鈕](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

選擇一個字型後，工作區會展開為四張角色卡片、Fonts 清單與即時字樣：

- **Primary**：內文、按鈕與每個工具。
- **Headings**：用於 `h1` 與 `h2` 的標題字型。
- **Code**：用於程式碼與資料的等寬字型。
- **Italic**：真正的斜體，用於強調、引文與附註。

只有你安裝了該字型的卡片才會著色。按鈕會顯示角色：使用自訂字型時顯示 **Change Headings**，其他情況則顯示 **Choose for Headings**。範例文字會換行。卡片上的任何內容都不會直接套用變更；按鈕會開啟該角色的比較區。

![展開的四張角色卡片：各自使用對應的字型，未選擇字型的卡片帶有 Starter 標籤，Italic 則跟隨主字型](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### 比較區

比較區會在你按下的卡片下方開啟。卡片會收合為單行列，讓比較區能顯示在手機的第一個畫面中。Escape 會取消並讓焦點回到卡片。

1. 按下卡片上帶有角色名稱的 **Choose for**。
2. 輸入字型家族名稱並按下 **Preview**，或按下欄位下方六個 **Pinned** 字型家族中的一個。
3. 按下 **Use this face**。

![在卡片下方開啟的比較區，包含搜尋列、釘選的字型家族，以及收合為單行列的卡片](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**只會詢問一次同意。** 預覽首次連線至 Google Fonts 時，對話框會說明：*Google 會得知字型家族名稱與你的 IP 位址。檔案隨後會保存在這部裝置上，並供離線使用。這是工作室中唯一會連線至第三方的步驟。* **Fetch from Google** 會繼續，並記住你的選擇。**Cancel** 會讓卡片顯示 *「尚未擷取。未傳送任何內容至 Google。」*，並附上自己的 **Fetch from Google**。

**將字型檔案拖放到比較區**（TTF、OTF 或 WOFF），即可預覽你擁有授權的字型。無論透過哪種方式，字型都會留在這部裝置上，在應用程式、工具與每次匯出中離線渲染，並隨設計系統檔案一起傳遞。Google Fonts 上的所有字型都以開放授權提供（OFL、Apache 或 UFL）。

### 這部裝置上的字型

**Fonts** 面板列出這部裝置上的每個字型及其用途角色。你新增的字型會先列在 **In the design system** 下，各自附上角色與刪除選項。起始字型接著放在一個淡化、收合的列中。**Add a face** 可為任何角色開啟比較區。**Type roles** 面板會顯示每個角色的即時字樣，以及字型家族與狀態，例如 *Inter* 或 *Inter · follows Primary*。

<!--i:eti-tag-->
## Token

Token 是設計系統背後的具名數值：色彩、字型、標誌、圓角與間距。工具會按名稱讀取它們，因此這裡的更改會立即影響每個工具。

![Tokens 工作區：頂端顯示系統中的範例與檔案動作，接著是統計各類 token 的方塊，再來是色彩配對及其對比讀數](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **頂端**提供你自己系統中的範例（*Primary 是 Spearmint，#033633*），以及檔案動作：**Download**（將系統下載為設計 token，或以其他五種格式下載色盤）、**Copy CSS** 與 **Add from…**，可將 JSON 檔案讀回。
- **方塊**統計各類 token，並跳至對應區段：Colours、Type、Logos、Shape and spacing、More 與 All tokens。只含空白起始系統隨附內容的區段會帶有 **Starter** 標籤；隨應用程式提供的系統則會計算自己的素材，不加此標籤。在手機上，方塊會換行排成兩列，每列三個。
- **Colours** 先列出工具搭配使用的色彩組合（底色上的文字、主色上的色彩、底色上的次要文字），附上淺色與深色外觀的 APCA 讀數，未達標準的配對則標示 **Weak contrast**。接著是每個色彩群組：色階序列以一列晶片顯示，其他色彩則附上數值與工具使用的參照，例如 `{color.brand.spearmint}`。按下參照即可複製該參照。**Edit in Colours** 可在 Colours 工作區中開啟群組。對於有[色彩角色](#colour-roles-what-the-colours-are-called)的設計系統，**Colour roles** 會排在最前面，依系統自己的名稱與順序，每個角色只列一次。每個角色會為各配色方案與外觀保留一個色彩。這些色彩會隨角色列出，不會列為獨立色彩；請在 Colour roles 表格中更改。
- **Type** 與 **Logos** 列出每個角色的字型與每個標誌欄位；有了自己的內容後，便會提供 **Edit in Type** 與 **Edit in Logos**。
- **Shape and spacing** 包含 **Rounded corners**（`shape.radius`）與 **Spacing rhythm**（`space.base`）。在你移動滑桿之前，各項都顯示 *Lolly default*，移動後則顯示 *Yours*，會立即儲存且可復原。
- **More tokens** 可新增間距、尺寸、筆畫寬度、不透明度、旋轉、單純數字與陰影，並儲存為標準的[設計 token](/info/design-tokens.html)。
- **App appearance (advanced)** 列出 Lolly 自身畫面使用的色彩、尺寸與陰影，**Inspect every token (advanced)** 則可搜尋與編輯任何已儲存數值，並先顯示每項變更供檢閱。在這裡，色彩角色在各配色方案中的數值會隨角色列出：選擇角色的 token，即可看到每個配色方案各佔一列，淺色與深色並排。計數列會說明角色共有多少個數值。唯讀設計系統也會顯示相同清單。

空白區段會提供 **Pick a colour**、**Choose a face** 或 **Add a logo**。

<!--i:eti-images-->
## 檔案

拖放品牌保存的標誌以外檔案：**向量**、**圖片**、**音訊**與**動態**檔案（影片、Lottie 與動畫）。它們會分類顯示於 [Assets](/info/using.html#assets-your-library) 的各區段，也會出現在每個工具的素材選擇器中。它們會留在這部裝置上。

## 聲音

**Sound** 要透過聆聽來選擇。工作區一開啟會提供三種起始聲音：**Calm**、**Steady** 與 **Bright**，各有一張使用該曲風色彩的卡片，並附播放按鈕。播放其中一種即可聽到短片段；開始播放另一種時，前一種就會停止。**Choose** 會讓每種使用情境都採用該聲音。第四張卡片 **Mixed** 會讓每種使用情境各有自己的聲音：Explain 使用 Calm，Demonstrate 使用 Steady，Play 使用 Bright。它的播放按鈕會依序播放這三種聲音。選擇 **Save sound** 之前，不會儲存任何內容。儲存後，聲音會成為此設計系統的一部分，並在其他工作區共用的歷史中建立檢查點。沒有聲音的設計系統會照常運作。

使用情境是聲音播放的場合：起初有 **Explain**、**Demonstrate** 與 **Play**。每種使用情境都是一個帶有播放按鈕的晶片。晶片上方的 **Music** 或 **With narration** 可設定晶片播放純音樂，還是搭配人聲播放。你選擇的使用情境會以簡單文字顯示其用途與音樂，例如「溫暖 · 84 bpm · Rhodes、流動的貝斯、復古鼓組」。每種使用情境都會採用所選聲音的曲風、速度與樂器（使用 Mixed 時則各自不同）。各使用情境會保留自己的曲調與平衡：Explain 會讓旋律避開人聲，Play 則讓旋律主導。在 Mixed 與單一聲音之間切換時，兩者都會保留。你自行新增的使用情境會在 Mixed 下保留原有聲音。設計系統會記錄你的選擇。**Add a use** 可新增一種使用情境，並讓你直接輸入名稱。**Make main** 可選擇未指定其他情境時要播放的使用情境。**Another tune** 會以相同設定播放新的樂曲。

**Edit in the music generator** 會以該使用情境的設定開啟[音樂產生器](/info/generated-music.html#the-music-generator)，頂端有一行說明你正在編輯哪個情境的聲音。**Save to this use** 會將設定帶回工作區；**Cancel** 則返回且不更改任何內容。你離開期間，工作區中尚未儲存的選擇會保留。如果這段期間有人在另一個分頁儲存聲音，會以較新的儲存為準，你的編輯則不會套用。

**Voice** 可為使用情境選擇人聲、語速，以及人聲下方音樂的音量；**Hear the voice with the music** 會同時播放兩者。**More** 下包含人聲說話時的音量降低幅度、試聽文字（只留在工作區中）、發音註記（每行一項，格式為書寫形式 = 發音形式），以及人聲註記。預覽使用本機語音模型，混音方式與序列匯出相同。預覽會淡出；這不是編寫好的結尾。

**Notes and signature** 包含使用情境中應留意的聆聽重點，以及聲音標誌：以獨立音訊檔案保存的固定開場或結尾。請將聲音標誌放入你的序列；產生的音樂絕不包含聲音標誌。如果某項要求是這個版本的 Lolly 無法檢查的，就會停止為該使用情境產生新音樂。

**Details** 包含品牌個性（聲音應給人的感覺、哪些要保持一致，以及哪些要避免）與聆聽檢閱。**Record a listening review** 會針對已儲存的聲音版本保留檢閱者姓名、日期與註記。任何變更都會讓聲音重新成為草稿。檢閱只涵蓋該版本，不涵蓋之後以該聲音製作的每首曲子：每件新作品送出前都要聆聽。

**Make a music project** 會在音樂產生器中將使用情境開啟為專案，並保留使用情境、聲音版本與精確設定。其中的 **New tune** 會產生新樂曲並保留聲音設定。如果你更改設定，**Put the sound back** 會還原聲音設定，**Keep as my own** 則會以獨立曲子繼續。在你選擇之前，專案無法以使用該聲音製作的形式儲存或下載。分享連結只包含音樂設定。專案與已儲存的曲子也會保留聲音的註記，這些註記不會放入分享連結，也不會放入音訊檔案的公開憑證。如果需要在產生器未來的版本中保留完全相同的音訊，請保存渲染後的錄音。

<!--i:eti-checklist-->
## 規則

**Rules** 可設定人們能更改什麼、哪些保持固定，以及 Lolly 能檢查什麼。

![Lolly Demo 的 Rules：四項組織規則，各自標示 Checked in Design 與 Required 或 Advisory，接著是 Try your design system in use，其範例已準備好可供渲染](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** 列出你的規則。**Add rule**（或 **Add your first rule**）會開啟簡短表單：

- 以你自己的文字填寫 **Rule name**，例如 *Beacon 強調色*；
- **Check**：**Colour choices**、**Font choices**、**Fixed artwork** 或 **Text length**，以及它使用的品牌角色，以你為角色自訂的名稱顯示；
- 適用的 **Example**（Poster、Title slide、Content slide 或 Lolly Chart）、**Mode**，以及屬於 **Required** 還是 **Advisory**；
- **Reviewed by**，接著是 **Save draft** 或 **Approve & save**。

核准會在這部裝置上記錄你自己的決定。已核准的必要規則會限制可重複使用的海報，檢查只涵蓋範例 PNG；它們不會更改其他任何工具。

設計系統 token 檔案中的規則，例如已核准的色彩配對、文字粗細與對齊，或各底色對應的標誌，會在這裡列為 **Checked in Design**。Lolly Design 會在匯出面板的 **Before you export** 卡片中逐層檢查它們，`lolly check` 則會對已儲存的 Lolly Design 文件執行相同檢查（[匯出之前](/info/design.html#before-you-export)）。這個建置版本沒有對應檢查器的規則，會依原樣保留並標示為 **Unchecked**。

Lolly Demo 提供四項已核准的組織規則。標題絕不使用全大寫：這項規則是必要規則，因此 `lolly check` 會將全大寫標題回報為錯誤。其他三項是建議規則。內文靠左對齊。主要標誌放在淺色底色上，反白標誌放在深色底色上。虛線表示在這裡放下。

**Try your design system in use** 會透過 **Render & check examples**，以目前修訂版本渲染四個範例。選擇 **Mode**，並使用 **Try your own text** 輸入標題、輔助文字與投影片文字。每個範例都會回報測量的內容，並提供 **See checks & sources** 與 **Download check report**。**Make reusable poster** 會下載一個 `.lolly`，其中包含固定版面與已核准的輸入選項。範例在本機執行：執行檢查不會發佈或核准任何內容。

隨附固定品牌的建置版本，會在 *This brand is set* 下以唯讀方式顯示相同的規則與範例。

<!--i:eti-graduation-cap-->
## 技能

**Skills** 列出目前設計系統的[品牌技能](/info/brand-skills.html)：品牌的書面規範，每個專業領域一份，供人員與 AI 代理程式使用。每列會顯示專業領域、品牌自己的狀態（**Draft** 或 **Approved**）、技能是公開還是內部使用，以及修訂版本。選擇一列即可閱讀技能及其涵蓋範圍，後者會逐行比較技能與你的 token：Lolly 檢查什麼、哪些衝突、哪些一致，以及哪些僅供指引。

**Download skill (.zip)** 會將技能寫成供代理程式工具使用的 Agent Skills 資料夾，目錄連結會指向這個 Lolly。**Copy as one file** 會將相同文字放到剪貼簿，供貼入聊天視窗。沒有自訂技能的設計系統會列出基準技能，每次讀取時，Lolly 都會根據其 token 與組織規則產生。工作區只讀取技能，絕不編輯。

<!--i:eti-upload-->
## 匯入品牌

操作列中的 **Add from…** 會開啟選擇器，詢問你有哪些內容，而不是內容的格式：

- **Design tokens or a design file**：DTCG 或 Tokens Studio JSON、Penpot 專案、token 集合的 zip、Lolly 設計系統套件、SVG、`DESIGN.md` 或品牌頁面資料夾。
- **PDF**：簡報或規範檔案，在這部裝置上讀取其色彩、標誌與內嵌字型。
- **Logo or screenshot**：在這部裝置上讀取圖片，轉成建議色盤。它只讀取色彩，不讀取字型或版面。
- **Saved web page**：一個 HTML 檔案及其 CSS 檔案，或貼上的 HTML 或 CSS，最多 20 個檔案、2 MB。只讀取你提供的文字：不會擷取連結的資源，也不會執行指令碼。
- **Font file**：TTF、OTF 或 WOFF。開啟 Type 工作區，在那裡安裝字型。
- **Website**：讀取一個頁面的色彩與字體排印。這個方塊只會出現在能讀取頁面的裝置上，並說明使用哪個讀取器：這部裝置上的應用程式，或背景分頁中以你的身分登入的瀏覽器擴充功能。輸入 URL 只會填入欄位；按下擷取才表示同意。

選擇設計檔案來源後，下一張卡片會以圖示方塊列出接受的格式。整張卡片都是放置區。你也可以將檔案拖放到工作室。

![匯入卡片：接受的格式先以圖示方塊列出，整張卡片都是放置區](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- **Lolly 設計系統套件**（`.lolly` 或舊版 `.zip`）可一步完成安裝。
- **Penpot** 匯出檔（`.penpot`）會帶入其設計 token。
- **Design Tokens**（W3C DTCG）或 **Tokens Studio** 檔案（`.json`）會帶入其 token。要求讀取者忽略指令、聲稱具有權限，或要求執行程式碼的描述會被排除，匯入時會說明它原本的位置。
- **一般 SVG** 會被掃描以列出可供選擇的色彩，第一個會成為你的主色。
- **`DESIGN.md`**（`.md`）會帶著其原樣的 token 進入 **Try these colours**。其中的文字可保留為品牌技能草稿，卡片會標示要求讀取者忽略指令、聲稱具有權限或執行程式碼的行。在你於 Skills 工作區按下 **Keep this skill** 之前，代理程式與品牌頁面都看不到草稿，而保留的技能仍限內部使用。
- **品牌頁面資料夾**，無論以資料夾選取、拖放或壓縮成 zip，都會進入相同的檢閱畫面。每個檔案都會對照資料夾的 `brand.json` 檢查；只要一個檔案不符，整個資料夾都會被拒絕。匯入會新增 token。標誌與字型會留在資料夾中。

::: warning 指令檢查會逐行讀取
用來排除 token 檔案描述中指令的檢查會逐行讀取，因此會漏掉其他措辭。套用 token 之前，請先閱讀來自陌生人的檔案。
:::

Lolly 會從你提供的檔案讀取品牌頁面。它不會透過其他網站的位址擷取內容。

### 有自訂色彩名稱的檔案

token 檔案或 `DESIGN.md` 可使用自己的色彩名稱，例如 main、accent、supporting 與 tertiary。Lolly 找到這類名稱時，檢閱畫面會在套用任何內容前逐一列出：名稱、各種外觀中的色彩、來源 token，以及 Lolly 建議的解讀方式。Lolly 只根據名稱比對一份簡短清單來建議解讀方式，不使用模型。清單以外的名稱會視為品牌自訂名稱，以 **By name only** 處理。你可以重新命名任何名稱、說明用途、指定另一種解讀方式，或取消勾選以保留為具名色彩。

**Install with these roles** 會寫入角色；**Install without roles** 則依檔案原樣安裝。沒有這類名稱的檔案會略過此步驟。已宣告自身角色的檔案，例如由 Lolly 寫出的檔案，會依原樣顯示並安裝角色，不做更改；之後你可以在 Colours 工作區編輯。終端機沒有檢閱步驟：`lolly system import` 會保留已宣告的記錄，並將其他檔案的名稱保留為具名色彩。

### 檢閱參考素材

標誌、螢幕截圖、網站或已儲存的頁面會開啟 **Try these colours**：以建議色彩呈現的範例、可更改的 **Main colour**，以及新系統的名稱。方框會說明套用的作用：以產生的色盤與預設樣式**取代**目前的 token 設定，**保留**你的字型與資料庫檔案，而且先前的系統可以**復原**。**Apply suggested settings** 會先建立檢查點，再套用淺色與深色色盤。**Restore brand settings** 可還原舊設定。**Change reference** 可選擇其他來源。

::: details 從參考素材讀取的內容，以及設計脈絡報告
**Palette, source details and individual choices** 會顯示讀取的內容、找到的字型名稱，以及預覽的對比。字型名稱僅供建議；你要在 Type 中安裝字型。來源詳情可包含觀察到的字體排印、間隙、內距與圓角數值，未觀察到的則標示 **Not observed**。讀取已儲存的頁面或透過原生應用程式讀取網站，會回報宣告的樣式，而頁面不一定有使用這些樣式。瀏覽器擴充功能可從可見元素的樣本回報測量到的樣式。這些都是觀察結果：不會安裝任何內容，來源的間距也絕不會取代你自己的間距。**Choose individual items in the tray** 可保留個別項目。**Download design context** 會儲存 JSON 報告，包含觀察結果、建議的 token 與來源資訊（附上所提供 HTML 或 CSS 的 SHA-256）。報告不含原始頁面文字，也不是已簽署的 Content Credential。
:::

PDF 與設計檔案匯入會保留各自的檢閱控制項。**Tray** 中的項目，在你於負責該類素材的工作區加入它們之前，不會更改任何內容。`#/start?source=<kind>` 會開啟指定來源的選擇器（`file`、`pdf`、`image`、`font`、`url`、`page`），`?import` 則會開啟一般清單。

### 尋找與比較外觀

從 Board 或 Settings 中的設計系統清單開啟 **Find a look**。瀏覽儲存在這部裝置上的系統，以及幾個可重複使用的 Lolly 範例，並依名稱、色彩標籤或宣告的字型搜尋。**Closest to my current palette** 會依測量的色彩相似度排序，相同時以字型是否相符決定順序；這不是品質評分。

點擊外觀即可在使用情境中預覽；預覽不會更改任何內容。卡片上的 **Use this look** 會套用該外觀。已儲存的系統會成為目前使用的系統，不會編輯任何內容。範例的色彩會在照常建立檢查點後加入已開啟的設計系統。系統的標誌、字型，以及範例未定義的其他內容都會維持原樣。**Compare looks** 會在每張卡片新增核取方塊：選擇兩個即可並排比較。**Restore brand settings** 可還原先前的外觀。已儲存的系統在 **Details and design context** 下有可編輯的 **Search tags**。這些範例都是 Lolly 原創的配色，沒有爬取的集合，也不需要帳號。

![Lolly 在套用任一色彩系統前，並排比較 Sunroom 與 Orchard。](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

<!--i:eti-package-->
## 保存與移動你的設計系統

### 在裝置之間移動品牌

**Export** 會寫出一個 **`LollyBrand-….lolly`** 檔案：包含你的 token、字型、標誌與主題偏好設定，以及在匯入時檢查的完整性 manifest。1.0.7 之前的網頁版本將檔案命名為 `.zip`，Lolly 仍接受這個副檔名。**Tokens (.json)** 會寫出純設計 token 文件，不含字型或標誌，可供儲存庫、建置步驟或其他 token 工具使用。

若要重新匯入，請使用 **Add from… → Design tokens or a design file**，或將檔案拖放到工作室。同事可以用這種方式交給你一個品牌，你也可以將品牌帶到第二個安裝環境，不需要帳號或雲端。[與合作夥伴協作](/info/partners.html)說明接收品牌的人任職於其他組織時，還需要傳送哪些內容。若要從命令列匯入品牌，請見 [`ingest:brand`](/info/configuration.html#brand-packs)。

**Fonts for Linux (.rpm)** 會將你新增的字型打包成可安裝的 RPM。如果其中有你自行上傳的字型，Lolly 會先要求你確認可以再次散布這些字型。

### 還原較早的設定

開啟操作列中的 **More**，選擇 **Restore brand settings**，選取帶有日期的檢查點，然後按下 **Restore**。這會還原目前品牌的色彩、字體排印設定與其他 token；字型與圖片檔案維持原樣。Lolly 會先將你目前的設定儲存為 **Before restore**，因此即使關閉瀏覽器後，你也能撤回還原。最近 20 個檢查點會保留在這部裝置上。工作室顯示 **Saving…** 時所做的編輯，重新載入後仍會保留，並有卡片提供還原尚未完成儲存的變更。

### 版本

已發佈的版本是保存在這部裝置上的**永久具名副本**。它絕不會改變，因此固定使用該版本（透過 `designv`）的工具或連結會持續繪製相同的內容。含有自訂內容的系統，會在操作列的 **More** 選單中列出 **Versions & publishing**；首次發佈後，**Versions** 會加入工作區。`#/start?area=versions` 可開啟 Versions。

::: warning 已發佈的版本是永久的
目前還無法刪除，面板會說明這一點。發佈無法復原；還原則可以。*Restore latest from this version* 是一般編輯，會立即提供 **Undo**。
:::

**移除項目會列在相容性卡片最前面**，因為移除 token 會讓工具失效。

**Publish only** 會保留版本，但不更改工具跟隨的內容；**Publish and make active** 會讓工具與應用程式跟隨該版本。**Follow the latest again** 會讓每次編輯立即生效。

### 發佈品牌頁面

[品牌頁面](/info/brand-page.html)讓人員與代理程式共用一個位址：頁面包含標誌、色彩、字體排印與範例，旁邊的檔案也包含相同資訊。Versions & publishing 下的 **Publish a brand page** 會顯示即時頁面，並在頁面旁顯示：

- **Goes public**：每個檔案，依群組列出並附上大小。
- **Held back**：哪些內容未納入，以及原因。未記錄授權的標誌會保持排除，直到你勾選該標誌名稱。字型檔案需要有記錄的授權，且允許轉交；未納入檔案時，頁面會顯示轉外框的字樣。內部品牌技能絕不會出現。
- **What was checked**：各配色方案與模式的色彩配對，以及組織規則。這些是測量結果，不是判定。
- **In your words**：使用聲明與聯絡資訊。頁面會顯示你寫的內容，Lolly 不會新增任何授權或法律聲明。開關可關閉頁尾的「Made with Lolly」一行。
- **On exports**：一個會[在此設計系統的匯出中記錄頁面位址](/info/brand-page.html#lead-back-from-your-files)的開關。在你開啟之前，它會保持關閉，需要 `https` 位址，且不會隨套件或副本傳遞。鎖定的設計系統不會顯示此開關，因為這由其管理者決定。

**Download folder** 會將資料夾儲存為 ZIP，讓你在選擇的位置託管。在你託管資料夾之前，不會公開任何內容。在終端機中，`lolly system publish --out=<dir>` 會寫出相同的資料夾。提供品牌頁面的實例也會提供 **Publish to**，讓你發佈至其位址：需明確按下一次，實例有核准流程時會依流程進行。受管理的設計系統只有在其管理者允許時才能發佈。

### 連接代理程式

同一位置的 **Connect an agent** 會提供可貼上的文字，並說明各選項的功能：

- 專案中的 **`AGENTS.md`**：代理程式會讀取系統的名稱與規則。它不會繪製任何內容，也不需要伺服器。
- **Lolly 的公開伺服器**：無論你在這裡開啟哪個系統，都使用 Lolly Demo 繪製。不需要金鑰。
- **你的實例**：使用實例持有的系統繪製，並從環境變數讀取服務 token。面板會提供變數名稱，絕不顯示 token。

沒有託管伺服器能使用你的系統繪製時，面板會說明這一點。

<!--i:eti-layers-->
## 管理你的設計系統

開啟 **Settings → Preferences → Design systems** 即可切換、新增或移除系統。**Open** 會選取系統並在這裡開啟；**Make a new one** 會建立本機系統並開啟，名稱欄位已準備好供你輸入。同一時間整部裝置只會使用一個系統。[品牌架構](/info/brand-architectures.html)可協助判斷品牌何時需要自己的設計系統。

**系統的來源。** 部署環境的目錄所提供的系統會顯示 **Came with this app**；在連接到實例的應用程式中則顯示 **From this instance**。展開 **Catalogue source** 即可查看提供者、token 素材與命名空間，以及已知版本或校驗碼；如果重新整理失敗，快取素材會加上標示。

**受管理的系統是唯讀的。** 目錄鎖定系統時，系統會顯示 **Managed by this instance**（沒有實例的桌面應用程式則顯示 **Managed by this app**）。你可以使用與下載受管理的系統。在這裡開啟時，會顯示唯讀說明及 **Make an editable copy** 與 **Switch**，接著是其色彩角色與 token，不會有編輯控制項。你自己的本機系統仍可編輯，即使受管理的系統先存在也是如此。只有一個固定品牌的建置版本，會在開啟 Lolly Design System Setup 時顯示 *This brand is set*，並提供品牌的 token 與使用規則供閱讀。

**其他所有隨附系統都由你掌控**，可隱藏、編輯與重設，包括 lolly.tools 上的 Lolly Demo 與 Lolly Starter。編輯系統會保留其名稱，並在該列標示 **Edited here**。其選單中的 **Reset to original** 會捨棄在這部裝置上所做的變更。空白起始系統是例外：首次更改時會建立你自己的設計系統，Lolly 會詢問一次名稱。[實際使用 Lolly Demo](/info/lolly-demo-in-use.html#switch-to-your-own)展示了你自己的系統會取代什麼。

### 移除設計系統

從系統的選單選擇 **Remove**；確認訊息會說明之後將使用哪個系統。已儲存的工作階段、上傳內容，以及與其他系統共用的素材都會保留。

移除隨附系統只會隱藏系統：其目錄素材會保留，**Bring back** 可讓它重新顯示；如果你移除其他所有系統，它會自行恢復。移除匯入或編輯過的副本，不會移除隨附系統、其標誌或字型。如果原本使用的是該副本，就會重新使用隨附系統。移除目前使用的託管副本，只會清除該副本的連線；另行選擇的實例會保持選取。

::: details 更改伺服器提供的設計系統
更改伺服器提供的內容是管理員的工作：由營運者更改來源目錄並重新部署，或由 Lolly Work 管理員檢閱並套用伺服器變更。這裡的編輯會留在本機，但有一個例外。在授予你 `brand.edit` 的 Lolly Work 實例上，受管理的系統也會提供針對該實例的 **Edit for**，開啟可編輯副本。**Versions** 中針對該實例的 **Send to** 會將其色彩、配色方案、色彩角色與品牌頁面位址傳回。[從工作室編輯此實例](/info/work-design-system-administration.html#edit-this-instance-from-the-studio)說明編輯能更改哪些內容，以及實例如何提供變更後的內容。請見[移除目錄設計系統](/info/configuration.html#removing-a-catalogue-design-system)與[設定](/info/configuration.html#supplied-and-local-design-systems)。
:::

<!--i:eti-code-->
## 在應用程式外使用設計脈絡

**Download design context** 會儲存 token 文件、解析後的色彩、宣告的字型家族、素材 id、已記錄的來源證據、涵蓋範圍與明確規則，不包含字型檔案或所有權證明。命令列不需要伺服器就能讀取此檔案：`lolly system import` 會將它設為終端機的設計系統，`lolly system check` 則會對照已儲存的脈絡檢查 Lolly Design 輸入。[帶入你的設計系統](/info/cli.html#bring-your-design-system)說明匯入，[命令使用哪個設計系統](/info/cli-decks.html#which-design-system-a-command-uses)則說明檢查。MCP 用戶端會從 `lolly://design-context` 讀取相同摘要（[MCP 伺服器](/info/mcp.html)）。

<!--i:eti-map-pin-->
## 接下來看什麼

- **[使用 Lolly](/info/using.html)**：工具、儲存、分享與 Assets。
- **[品牌架構](/info/brand-architectures.html)**：部門、產品、背書品牌、客戶與季節如何對應到設計系統、配色方案與標誌識別。
- **[與合作夥伴協作](/info/partners.html)**：與合作夥伴分享你的品牌，以及使用交給你的品牌進行工作。
- **[品牌頁面](/info/brand-page.html)**：在一個位址發佈你的設計系統，作為媒體資料包與代理程式資料包。
- **[設計 Token](/info/design-tokens.html)**：用來編寫品牌的 token 模型。
- **[匯出檔案](/info/exporting.html)**：列印單位、CMYK，以及品牌渲染的輸出格式。
