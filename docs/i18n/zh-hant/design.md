# Design：自由畫布

<a id="design-the-free-canvas"></a>

Design 是用於沒有範本涵蓋之版面的工具：從零開始的海報、一份投影片簡報、帶有配樂的動態作品。你得到的不是控制項表單，而是一塊方塊畫布，可以拖曳、調整大小、旋轉並輸入文字。它經由與其他每個工具相同的渲染路徑匯出，所以你在畫布上看到的就是你得到的檔案。

本頁帶你從第一個方塊走到完成的簡報：視窗、塑形方塊、繪製自己的圖形、放置 3D 場景與其他工具、加入時間、檢查結果，以及播放完成的簡報。[使用 Lolly](/info/using.html) 涵蓋 Design 與每個工具共有的部分，例如儲存與分享。

![Design 的自由畫布 - 畫板及其周圍的貼上板](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

## Design 視窗

**頂端列**以 **Home**、**File menu** 與文件名稱開頭（點擊名稱即可重新命名文件）。中間包含 **Undo**、**Redo**、**History**、縮放控制項（附 **Fit all** 與 **Fit artboard**），以及 **Timeline**、**Navigator** 與 **Inspector** 的切換。右側是 **Share**、**Present** 與 **Export**。在手機上，較少使用的按鈕會移到 **More actions**。

沿側邊的**工具列**包含 Lolly 選單與你用來繪圖的工具：**Pointer**、**Add a box**、**Pen**（與 **Pencil** 共用一個按鈕）、**Edit points**、**Line**，接著是 Timeline、Artboards 與 Auto-arrange 按鈕。

![自由畫布的工具列：拖曳握把、Lolly 選單，接著是指標、新增方塊、鋼筆、編輯節點、線條、時間軸、畫板與自動排列](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

畫布的運作像設計師圍繞畫板的暫放區：

- **把方塊暫放在畫板外。** 將方塊拖過框架邊緣後，它仍然可見且可選取。框架外的一切都會變淡，而框架保留其陰影，標出檔案從哪裡開始。
- **只有畫板會匯出。** 框架外的任何內容，或方塊超出邊緣的部分，在點陣與向量格式中都會從輸出中裁掉。
- **縮小到超過 Fit**，可看到你暫放的所有內容。
- **調整畫板大小**的方法是更改匯出尺寸。方塊保持原本的位置，因此你可以圍繞既有內容重新取景版面。

![編輯舞台：畫板在正中央，工具列在左側，縮放 HUD 在角落](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&chrome=1&dark=1&filename=seq-studio-stage)

### Navigator 與 Inspector

**Navigator** 將每個畫板（標題為 **Artboards**，在簡報中則為 **Slides**）列為其 **Layers** 的可摺疊群組。選取畫板名稱即可跳到那裡，展開它即可選取或重新排列其圖層，並用方向鍵在清單中移動；Left 會回到畫板標題。**Pages** 將畫板分組為具名頁面，而選擇某個頁面只會改變編輯器顯示哪些畫板。

**Inspector** 把所選物件的文字或圖片控制項放在最前面。選項晶片涵蓋快速選擇，**Advanced** 則包含樣式細節。在手機上，Inspector 與圖層清單共用一個面板，從頂端列下方向下拉出，這與其他每個工具存放控制項的面板相同。底部列中的 **Inspect** 與 **Layer/Page** 會在對應的分頁開啟該面板。拖曳其下緣的把手，或點按把手，即可在三種狀態之間切換：只有兩個分頁的窄條、半個螢幕，以及接近整個螢幕。在半螢幕時，面板下方的畫布會顯示你的選取內容。Escape 會把面板收回窄條，並保留你的選取。

![Inspector 的 Document 區段：Selection 與 Canvas 分頁，接著是 Dimensions 與 Style & look](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

## 調整大小、縮放與旋轉

選取物件，然後拖曳把手來更改其大小，或拖曳選取範圍下方的圓形把手來旋轉物件。大小的拖曳有兩種模式：

- **Resize**（預設）只改變方塊。文字依新的大小重新換行，字型大小、筆畫寬度、圓角半徑與效果維持原樣。
- **Scale** 連同內容一起放大或縮小整個物件：字型大小、筆畫、圓角半徑、陰影、模糊、內距與間距都以相同的比例改變。

按下 `K` 可開啟或關閉 Scale。沒有鍵盤時，可在 Lolly 選單中選擇 **Scale mode**，或在工具列上按住 **Pointer** 按鈕（或在該按鈕上按右鍵）並選擇 **Scale**；在觸控螢幕上，物件列也有 Scale 切換。Scale 開啟時，Pointer 按鈕顯示 Scale 圖示，每個把手中間都有一個圓點。`V` 或 **Escape** 會回到 Resize 並保留你的選取。每份文件開啟時 Scale 都是關閉的，所以沒有人會不小心縮放筆畫。

**以數字縮放。** 開啟 Scale 時，或選取了多個物件時，點擊物件列上的讀數即可開啟 **Scale** 彈出視窗。輸入百分比、寬度或高度，在 3 x 3 格線上挑選保持不動的點，然後選擇 **Apply**。每次縮放是一步復原。

**多個物件。** 選取多個物件時，其邊緣與角落都有把手。當每個物件都是正立或旋轉整數個四分之一圈，且選取範圍中沒有群組或圓形時，拖曳角落可自由改變寬度與高度。否則選取範圍會保持比例，讀數會加上 **Proportional**。拖曳時，小標籤會顯示大小，在 Scale 模式下則顯示百分比。

**翻轉選取範圍。** 按右鍵並選擇 **Flip horizontal** 或 **Flip vertical**，或按 `Shift+H` 或 `Shift+V`（要用 Shift，因為單獨的 `V` 是 Pointer）。鏡像是真正的變形，因此匯出的 SVG、PDF 與 PNG 都會保留翻轉。

**拖曳期間按住的按鍵**在你按下或放開的瞬間就會生效；快捷鍵表（`?`）也列出了它們。

| 按住 | 調整大小或縮放 | 旋轉 | 移動 |
|---|---|---|---|
| **Shift** | 保持比例（Scale 一律如此） | 以 15 度為單位旋轉 | 無變化 |
| **Alt**（Option） | 從中心運作 | 自由旋轉 | 關閉貼齊與格線 |
| **Cmd/Ctrl** | 關閉貼齊與格線 | 自由旋轉 | 關閉貼齊與格線 |

沒有按住任何按鍵時，旋轉一旦進入某個 15 度倍數的 4 度範圍內，就會被拉到最接近的 15 度。畫板不會旋轉，因此沒有旋轉把手。

::: details 把手、抓取區與觸控
**沿著邊緣任何地方都能抓取。** 選取範圍的每一邊都是沿其全長的調整大小條，使用滑鼠或手寫筆時，每個角落外側還有一個旋轉區。指標會顯示拖曳將執行的動作。在條或區內按下，只有在你開始拖曳時才會變成調整大小或旋轉，所以單純點擊仍和以前一樣選取。鎖定的物件沒有把手、條或區。

**小物件仍可移動。** 在寬度為 25 個螢幕像素以下的物件上，中間的把手會隱藏，其他把手則從輪廓向外移一小段，因此在物件上按下會移動物件。在 10 像素以下時，角落的把手也會消失，細線則在每一端保留一個把手。在細線或微小物件旁邊、避開其把手的地方按下，也會移動該物件。

**大型抓取區。** 在觸控螢幕上，每個角落區是選取範圍在螢幕上寬度與高度的四分之一，介於 24 到 44 像素之間，每個邊區涵蓋兩個角落之間的範圍。當選取範圍小到放不下時，這些區會移到其輪廓之外。你的指標或手指下的區會被加上陰影。若要在滑鼠或手寫筆上得到相同的區，請在 Lolly 選單中開啟 **Large grab areas**；此設定保留在這部裝置上。

**兩指操作選取範圍。** 在觸控螢幕上，將兩根手指放在選取的物件上：雙指縮放以縮放、扭轉以旋轉，或同時移動兩指來搬動選取範圍，全都算作一步復原。Scale 開啟時，雙指縮放也會縮放內容；Scale 關閉時，則依比例調整大小。扭轉在接近時會貼齊最近的 15 度，兩指移動則絕不貼齊。第一根手指必須落在選取範圍上，第二根必須迅速跟上，落在選取範圍上或剛好在其邊緣外。兩指在其他任何地方都會縮放與平移檢視，若選取範圍包含畫板或鎖定的物件、涵蓋大部分檢視範圍或超出其邊緣，兩指操作選取範圍時也一樣。
:::

## 繪製你自己的圖形

方塊、圓形與圓角框架涵蓋大多數版面。至於其他任何形狀，請自己畫：工具列的 **Pen** 按鈕（或 `P`）會讓你進入繪圖模式。四個按鍵可在模式之間切換：`V` 為 Pointer，`P` 為 Pen，`Shift C` 為 **Pencil**，`N` 為 **Edit points**。Pointer 永遠是離開的方式。

- **點擊**以放置一個點。在預設的曲線類型上，**點擊並拖曳**會拉出該點的把手以製作曲線；點擊時按住 **Alt** 可得到硬轉角。（在其他曲線類型上，每個點都是轉角，拖曳不起作用。）
- 點擊時按住 **Shift**，新的線段會與前一個點保持 15 度的倍數，所以水平、垂直與 45 度的線條都很精確。拖出把手時按 Shift，把手也以同樣方式分段。
- 點在你放置時會貼齊畫板、你其他的方塊與同一路徑的其他點，所以點能與你先前放置的點對齊。繪製時 Alt 會暫停格線，之後拖曳點時則同時暫停格線與邊緣。
- **點擊你的第一個點**即可封閉形狀。否則按 **Enter**、按兩下或切換工具，繪圖就會被保留。
- **Escape** 一次作用一步：第一次按下放棄繪圖，第二次離開鋼筆。
- 繪製時按 **Delete** 或復原（`⌘ Z` 或 `Ctrl Z`）會刪掉最後一個點。

**接續開放路徑。** 開啟 Pen 後，按住開放路徑的任一端，你就是在重新繪製該路徑：每次點擊都會在該端之後加上一個點，若你從起點開始，則加在第一個點之前。Enter 保留結果，Escape 則讓路徑完全維持原樣。路徑仍是同一個方塊，保有它的填色、筆畫與箭頭，一次復原就能還原。Delete 只會取回你新增的點。封閉的形狀、連接到方塊的線，以及有多個部分的路徑沒有可接續的自由端。

**用 Pencil 徒手繪製。** 按下 `Shift C`，或在工具列上按住 **Pen** 按鈕（或在該按鈕上按右鍵）並選擇 **Pencil**；之後按鈕會一直顯示 Pencil，直到你再次選擇 Pen。Pencil 會在你拖曳時記錄筆跡。放開後，Lolly 會把筆跡平滑成少數幾個帶貝茲把手的點，保留急轉彎為轉角，並讓曲線與你的手實際走過的位置相差不超過幾個螢幕像素。終點靠近起點的筆跡會封閉。結果是一般的路徑，與 Pen 路徑有相同的上色方式，之後你可以編輯它的點。

結果是一般的方塊。可以像任何其他方塊一樣移動、調整大小、旋轉、群組、對齊、重新排序、填色、加陰影或淡化該路徑。第一個路徑會採用你的品牌為路徑設定的填色與筆畫，之後每個新路徑則採用你上次使用的設定。在品牌沒有為路徑設定任何內容的工具中，新路徑會以你繪製時使用的顏色描邊，所以形狀永遠不會看不見。

**再次編輯點。** 在圖形上按兩下，或使用物件列上的 **Edit points**。拖曳點即可移動它，拖曳把手即可重新調整曲線方向，在曲線上點擊即可插入點，或拖出方框圈選多個點後按 Delete。路徑至少會保留兩個點。

- 拖曳點時按住 **Shift**，它與路徑上下一個不動的點之間的角度會以 15 度分段。拖曳把手時按 Shift，把手會繞著自己的點分段。點擊時按 Shift 仍是把點或把手加入選取範圍；分段在你開始拖曳後才生效。
- 拖曳的點會貼齊畫板、其他方塊與路徑的其他點。按住 Alt 可自由放置。
- 點擊把手即可選取它，再按 **Delete** 把它收回到它的點上。該點的這一側會變成轉角，沒有把手拉動曲線。選取了點時，Delete 仍照常移除這些點。

**Spline type** 決定穿過你的點的曲線種類：

| 類型 | 作用 |
|---|---|
| **Smooth (auto)** | 預設。自行計算把手長度，所以單純點擊就能得到平滑曲線。你設定的把手會固定方向，而曲線仍自行決定長度。 |
| **Bezier handles** | 經典鋼筆：你控制每個把手，插入點絕不會移動曲線。 |
| **Through the points** | 精確穿過每個點，沒有把手。 |
| **B-spline** | 流過點的附近而非穿過它們，線條更柔和。 |
| **Straight lines** | 折線。 |

將現有路徑切換到自行計算把手的類型時會先詢問，因為你設定的把手長度無法復原；切換到 **Bezier handles** 則永遠不會有損失。繪製途中切換會立即生效，你拉出的任何把手都會被丟棄。

每個點也帶有連續性規則，以其形狀顯示：方形代表 **Corner**（把手各自獨立移動），圓形代表 **Smooth**（把手保持成一直線），帶圓環的圓形代表 **Symmetric**（成一直線且長度相等）。為選取的點設定規則，曲線就會立即跟隨。

![兩條直接從連結算圖出來的鋼筆路徑：一條描邊的 S 形曲線，以及一個閉合填色的團塊](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

繪製的路徑和任何其他方塊一樣會隨分享連結傳遞，並在命令列中以相同方式渲染。

## 組合圖形

選取兩個或更多圖形，在畫布上按右鍵（觸控時為雙指輕點）並選擇：

- **Union** 將它們合併成一個圖形，採用最上層圖形的顏色。
- **Subtract** 從底部的圖形中切掉其上方的所有內容。
- **Intersect** 只保留重疊的部分。
- **Exclude** 保留除重疊部分以外的所有內容。

另有三項作用於單一圖形。**Outline stroke…** 將筆畫轉成相同粗細的填色輪廓。**Offset path…** 將輪廓向外擴張，若為負數則向內縮小。**Simplify** 以較少的線段重建路徑，輪廓保持不變。

![一個新月形與一個帶有真正孔洞的環，兩者都由 Subtract 產生](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D%26w%3D1080%26h%3D1080&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&filename=path-ops-boolean-result)

結果是可以繼續用鋼筆編輯的新路徑，以一般的貝茲曲線儲存，所以原本的曲線類型不會保留。孔洞是真正的孔洞：筆畫面板上的 **Fill rule** 控制項決定重疊的輪廓是填滿（*non-zero*）還是穿透（*even-odd*）。這些操作寧可拒絕也不破壞：要求將兩個不重疊的圖形取交集，什麼都不會改變。文字與圖片方塊沒有輪廓，因此不受影響。

## 描繪圖片

選取一張圖片，按右鍵並選擇**描繪圖片…**，即可把圖片變成可編輯的形狀。選擇一個預設，然後按下**描繪**：

- **標誌**會找出少量純色，並保持銳利的邊緣以及正圓和直線。含有漸層或照片色調的圖片會被拒絕，並給出提示。
- **插圖**把多種顏色描繪為填色形狀，適用於平面圖稿或色調分離的圖片。
- **線稿**把淺色頁面上的深色線條描繪為黑色形狀。
- **中心線**把深色線條描繪為單一筆畫，之後可以修改它們的粗細。

形狀會以群組形式新增在圖片正上方，圖片維持原位。隱藏或刪除圖片即可只檢視路徑。描繪在你的裝置上以背景工作執行，附有「取消」按鈕，不會上傳任何內容。1500 像素的圖片通常需要一到幾秒，複雜的照片需要更久。

描繪依據框內顯示的內容，所以被裁切（Cover）的圖片只會描繪可見部分。以下限制適用：

- 描繪前圖片會縮小到長邊最多 1500 像素，所以邊緣的位置精度是這個尺寸的幾分之一，而不是原圖的。
- 一次描繪最多產生 1,500 個形狀和 60,000 個點。照片通常會超過，Design 會告知這一點，且不做任何更改。請試試標誌或線稿，或換一張較簡單的圖片。
- 漸層會變成純色色帶，柔和的陰影會變成硬邊形狀。
- 圓角半徑、形狀遮色片以及圖片框上的效果不會套用到路徑上。
- 同一張圖片和同一個預設總是得到相同的形狀。

## 筆畫

方塊、圖片、畫板與 Pen 路徑都可以帶有筆畫：一個顏色、一個寬度與一種樣式（實線、虛線或點線）。筆畫的列位於 Inspector 中 **Fill** 之下，物件列上的 **Stroke** 按鈕也會開啟它們。

**Position** 決定筆畫放在輪廓的哪一側：**Inside**、**Centre** 或 **Outside**。除非你另行選擇，方塊的筆畫在內側，所以它的外緣維持在你畫的位置，而 Pen 路徑的筆畫則置中於曲線上。使用置中或外側筆畫時，填色、圖片與文字都留在筆畫的內緣之內，選取外框則留在方塊自己的邊緣上。開放路徑沒有內側，所以一律置中描邊。畫板的筆畫永遠留在頁面內，因為頁面邊緣就是匯出邊緣。

**按邊設定筆畫。** 在矩形、圓角方塊、膠囊形或畫板上，寬度旁的切換會顯示四個寬度：**Top**、**Right**、**Bottom** 與 **Left**。把某一邊設為 0 即可隱藏該邊，不需要第二個形狀就能做出分隔線或底線。這個切換只顯示或隱藏四個欄位，從不更改任何值。各邊不同時，寬度會顯示 **Mixed**；在那裡輸入寬度即可一次設定四邊。顏色、位置與樣式仍由各邊共用，圓角會隨旁邊的寬度彎曲，就像 CSS 邊框一樣。橢圓、圓形與 Pen 路徑四周只畫一種寬度。

各格式如何承載筆畫：

| 格式 | Position | 按邊設定 |
|---|---|---|
| SVG、PDF、PNG 與其他圖片 | 精確。Pen 路徑的內側或外側筆畫會畫成兩倍寬，並裁切到輪廓的一側。 | 實線筆畫是精確的，以筆畫外緣與內緣之間的一個形狀呈現。虛線或點線在 SVG 中沿每一邊畫成虛線段，在 PDF 中則為實線。 |
| Penpot | 內側、置中與外側以 Penpot 的筆畫對齊方式傳遞。畫板一律為 `inner`。 | Penpot 2.19 或更新版本可直接讀取四個寬度。Penpot 2.18 四周都畫上方的寬度，Penpot 2.17 或更早版本會拒絕帶有各邊寬度的檔案。 |
| PowerPoint | PowerPoint 的線置中於形狀的邊緣。Centre 是精確的；outside 會把形狀向外移動寬度的一半，使 PowerPoint 的線落在方塊外；inside 則保留較舊匯出所寫的置中線。 | 筆畫會變成獨立的形狀（外緣與內緣之間的環），疊在沒有線的形狀上。 |
| dotLottie | Lottie 的筆畫是置中的，所以外側的方塊筆畫，或內側或外側的 Pen 路徑筆畫，都會被拒絕並附上訊息。 | 被拒絕並附上訊息。 |

半透明的置中筆畫，其內側一半會透出頁面而非填色，畫布上與每一種匯出都是如此。匯入 Penpot 檔案時，每個筆畫都保留它的對齊方式與各邊寬度，Figma 檔案的 `strokeAlign` 與個別筆畫粗細也以同樣方式匯入。

## 設計中的 3D 場景與工具

方塊能容納的不只是圖片。下面兩種都保存的是配方而非渲染好的圖片，所以它們會以文件要求的任何大小與時刻重新繪製，而來源的更新會到達每個使用該來源的設計。

### 3D 場景

從工具列的新增選單中選擇 **3D scene** 並拖出一個框架：3D Studio 會在新的方塊上開啟，你在那裡設定的內容會回到畫布。之後，Inspector 的 **3D scene** 區段中的 **Edit in 3D Studio** 會重新開啟工作室。[在 Design 中放置場景](/info/3d-studio.html#place-a-scene-in-lolly-design)涵蓋海報、時間軸、匯出與分享。

### 設計中的工具

從工具列的新增選單中選擇 **Image**，拖出一個框架，並在選擇器的 **Tools** 分頁挑選一個工具。工具會以其預設值填滿框架，Inspector 會開啟一個 **Tool** 區段，包含該工具自己的控制項。更改欄位後，方塊稍後就會更新，算作一步復原。**Image fit** 與 **Image position** 的作用與任何圖片相同，**Replace with another tool or image** 則會替換方塊的內容。

**會動的工具**在方塊內播放：循環的插圖在畫布上持續循環，時間軸開啟後會跟隨播放頭，並逐格匯出為 GIF、MP4 或 WebM。當工具說明一次循環持續多久時，方塊會得到恰好那麼長的片段，因此影片包含完整的循環。你重新調整過時間的片段會保留你的時間設定，而關閉工具的動態則會讓方塊再次變成靜態圖片。

## 時間軸（Sequence）

**Sequence** 是 Design 的時間軸：它為畫布加入時間。每個方塊都可以在某個時刻開始、持續一段長度，並淡入淡出，而停靠在畫板下方的時間軸就是安排它們的地方。從 Design 的 **Video** 範本開始時，一段簡短的序列已經就位：序列列上有兩張定時的文字卡，下方有一段程序式生成的背景音樂，所以在你更改任何東西之前，就能看到時間軸如何運作。

![Sequence 的時間軸：播放控制列、尺標、一條疊加軌道、含片段與接縫標籤的磁性序列列，以及常駐的 Always on 條帶](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

有兩種列：

- **序列列**具有磁性。片段首尾相接，拖曳其中一個會重新排序，刪除一個會合上空隙。這是主幹。
- **覆疊軌道**是自由的。下三分之一標題、標誌或字幕以各自的時間浮在主幹上，每個都在自己的軌道。
- 它們下方，**Always on** 容納沒有時間設定、全程都存在的方塊。晶片上的 `+` 可將其移到軌道上；**Make always on** 則將它送回。

開啟時間軸會把鍵盤交給它，所以 Space 與方向鍵會控制播放頭。已經有時間設定的作品會自動開啟時間軸。

**編輯。** 拖曳片段的中間即可移動它，拖曳靠近任一端即可修剪它，按 **Split at playhead**（或 `S`）可將它切成兩段。Split 需要有實際 **Length** 的片段，且播放頭位於其內部稍微往裡一點的位置，所以沒有終點的片段（例如背景音樂）無法分割。**Snap to edges** 預設開啟，會貼齊片段邊緣、播放頭與整數秒；按住 Alt 可不貼齊地拖曳。每次拖曳是一步復原，拖曳時的預覽使用與結果相同的算法。

選取片段後，inspector 以數字提供相同的編輯：**Length**、**Trim in**（片段從來源的多深處開始）、從 ×0.25 到 ×4 的 **Speed**、帶有各自長度的 **Animate in** 與 **Animate out**，以及 **Mute clip**。磁性列上的片段沒有 **Start** 欄位，因為順序由該列決定。

**轉場**是預設組合：Fade、Pop、Grow、Rise、Drop、四種 Slide、Zoom in 與 out、Tilt、Swoop、Spin、Drift，或 **Cut (no animation)**。距離隨物件縮放，所以同一個預設在滿版卡片與小徽章上看起來都恰當。在序列列上兩個片段之間，**接縫晶片**可選擇 **Cut** 或 **Crossfade**；再次開啟它可設定 **Length (ms)**，並按下 **Done**。在交叉淡化中，第一個片段會在切點之後繼續播放並淡出，同時下一個淡入，預覽與檔案中都一樣。

**聲音。** **Audio** 片段與任何其他片段一樣存在於時間軸上，有波形、修剪與靜音。Video 範本生成的背景音樂在匯出時合成，所以它的列在你渲染之前保持單純且無聲。按下麥克風即可直接在時間軸上**錄製旁白**，附有倒數計時與音量表；錄音會以你自己的素材儲存在播放頭的位置。麥克風旁邊的攝影機按鈕以相同方式**錄製影片**，錄製時裁切到畫板，所以同事可以從分享連結加入一段片段。選取任何有聲音的片段，其條列會在時間軸下方開啟，供調整音量、聲像、EQ、音高、正規化，以及 **Voice cleanup** 等效果；序列編輯器指南中的[聲音](/info/sequence-editor.html#sound)涵蓋這個條列。匯出面板的 **Audio track** 是獨立的：整個片段下方的一段背景音，附有淡出和閃避。

![選取音樂片段的時間軸：底部控制條依序是速度、淡化、音量、平移、EQ、音高、正規化音量與效果插槽](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fbx%3Dt1%252Ctext%252C200%252C140%252C1500%252C220%252C0%252Crect%252C16%252C%252C100%252C%252Ccontain%252Cnormal%252CVoiceover%252520session%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252Cseq%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1%252C%252Cfalse%252C%252C60%252C%252C%252C1%257Ea1%252Caudio%252C200%252C500%252C400%252C80%252C0%252Crect%252C16%252C%252C100%252Czzfxm%25253A7%25253Alofi%252Ccontain%252Cnormal%252C%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252C%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1.3%252C%252Cfalse%252C%252C60%252C%252C%252C1%26_sel%3Da1&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip&drive=click%3Abutton%3Ahas-text%28%22Inspector%22%29)

**渲染。** 動態匯出會在精確的時間點繪製、解碼並編碼每一格影格，因此檔案不取決於你的機器能否跟得上，而 MP4 與 WebM 沒有實際的影格上限。除非你輸入長度，否則時間軸的長度決定時長，Content Credentials 的蓋印方式與任何其他匯出相同。靜態匯出會給出播放頭位置的影格，或依 **Frames** 欄位產生的接觸印樣；請見[定時作品的靜態影像](/info/exporting.html#stills-from-a-timed-composition)。序列的上限為一小時。GIF 與動態 PNG 會將每一格影格保存在記憶體中，所以適合短片段。**Record live** 在此隱藏，因為逐格渲染是更好的路徑。

**關鍵影格、景深與攝影機。** 轉場會在片段進入和離開時為其製作動畫。若要在片段內為方塊擺姿勢（漂移、淡化、模糊、將它從頁面抬起再放回），請選取片段並按 **+Keyframe**：時間軸工具中的菱形、畫布物件列上的菱形，或在時間軸取得焦點時按 **Shift+K**。播放頭的位置決定你的下一次編輯寫入哪個姿勢。同樣的關鍵影格讓定時作品得到推進、平移與拉焦的攝影機。[動畫製作](/info/animating.html)是完整指南，[序列編輯器](/info/sequence-editor.html)則涵蓋選取、洋蔥皮、分割、修剪與標記。

## 匯出之前

Design 會在你送出檔案之前檢查你的文件。Inspector 的 **Document** 區段中以及匯出面板裡的 **Before you export** 卡片，會讀取儲存的圖層結構，然後查看穩定下來的畫布，檢查被裁切的文字與純色對比。它會詢問與 SVG 和 PDF 轉外框所用相同的字型註冊處，每個文字區段是否有可以嵌入的字型位元組。匯出中由[備用字型](/info/fallback-fonts.html)畫出的文字視為已涵蓋。沒有備用字型的文字系統，或是超出這些字型所含字元集的中文、日文或韓文字元，仍然會被回報。圖片與漸層背景會列為目視檢查，而不是給出捏造的對比分數。

### 對照設計系統檢查作品

匯出面板的卡片也會以渲染所用的相同設計系統版本，將作品與你的設計系統比較。它檢視自行設定的色彩、token 別名、字型選擇與圖片素材 ID。自訂值可能是刻意的，而宣告的品牌素材之外的圖片屬於審閱項目，並非被禁止的圖片。

在有具體色彩或字型建議之處，其按鈕會更改那一個圖層，**Undo** 則還原原樣。鎖定或之後已更改的圖層絕不會被舊的建議覆寫。漸層、效果、巢狀工具內容、權利與主觀品質不在這項比較範圍內，也沒有任何檢查會阻止 Download。

### 內部規範與寫作訊號

匯出面板的卡片也會逐層檢查你的設計系統所帶來的內部規範，例如文字粗細與對齊、核准的色彩搭配，或每個介面的標誌。每個發現都是一則警告，規則上方有圖層名稱。這個建置版本沒有檢查器的規則會列為未檢查，絕不會標示為已遵守。[Rules](/info/brand-studio.html#rules) 列出這些規則，`lolly check` 則對已儲存的文件套用相同的規則。

同一張卡片還會顯示文件所繪文字的寫作訊號：它的等級（無、弱、明顯或強），接著是 Verify 自己的句子，附上滿分 100 的分數以及最多三個被標記的片語，每個都附有包含它們的圖層。**Open the text in Verify** 會將該文字帶到 [Lolly Verify](/#/verify) 進行完整解讀；[Verify 中的 AI 證據](/info/verify-ai-evidence.html)說明分數衡量什麼。分數是訊號而非定論：它計算生成式寫作中常見的模式，無法分辨是誰寫了這些文字。隱藏的圖層不在兩項檢查之內，卡片會說明有多少個。

內部規範的發現與強烈的寫作訊號會計入卡片的「待修正」總數，方便找到。它們只提供資訊，絕不阻擋：Download 仍可使用，也沒有任何東西需要忽略或記錄為例外。在開啟的文件中工作的代理，會透過其網站工具取得相同的報告（[開啟文件中的代理](/info/open-document-agents.html)）。

當你開啟 **Settings → Feature flags → Print preflight** 時，列印檢查（出血、解析度、油墨覆蓋量與色版數量）會加入同一張卡片。在其他工具中，這個旗標決定卡片是否顯示；[匯出檔案](/info/exporting.html)說明了列印檢查。

## 簡報播放

由畫板組成的 Design 文件本身就是一份簡報。按下頂端列的 **Present**，每個畫板都會依其在畫布上的排列順序，成為一張全螢幕投影片。在文件的 **Design outcome** 設為 **Slides** 之前，按鈕顯示為 **Preview**。簡報在已渲染畫板的副本上執行，所以離開時會把你放回原本的位置。

**Present** 旁的箭頭會開啟 **Present from this slide**、**Speaker view**、**Present with camera**、**Narrate**、**Auto-advance slides**、**Loop the deck (kiosk)** 與 **Export slides as video**。

| 按鍵 | 作用 |
|---|---|
| **Space**、`→`、**Page Down** | 下一步或下一張投影片（或點擊右緣的條） |
| `←`、**Page Up** | 返回（或點擊左緣的條） |
| **Home**、**End** | 第一張或最後一張投影片 |
| `O` | 總覽：依你畫布排列方式呈現的每個畫板；點擊一個即可開啟 |
| `S` | 講者檢視：在第二個視窗中顯示目前投影片、下一張投影片、備忘稿與時鐘 |
| `B` | 黑畫面；按任何鍵即可讓投影片回來 |
| `F` | 回到全螢幕 |
| `K` | 暫停或重新啟動資訊亭簡報 |
| **Escape** | 剝開一層：總覽回到簡報，簡報回到編輯器 |

移動指標時，會淡入一個小型控制列，停止時又會隱藏。如果瀏覽器封鎖講者彈出視窗，講者檢視會以面板形式開在簡報上方。備忘稿屬於每個畫板，絕不會出現在投影片上。

在觸控螢幕上，向左滑動進入下一步或下一張投影片，向右滑動則返回。**Slide** 或 **Fade** 轉場會跟著你的手指，並在你放開時完成；**Cut**、**Morph** 或 **Fly between artboards** 轉場則在你放開後完整播放，而短而慢的滑動不會造成任何改變。網頁方塊、影片控制項、可捲動的方塊與選取的文字會保留自己的手勢，因此滑動絕不會從它們上面開始，垂直捲動與雙指縮放也照常運作。在減少動態的情況下，投影片仍會切換，只是不會跟著你的手指。

- **逐步顯示。** 在方塊上按右鍵並選擇 **Reveal at step 1**、**2** 或 **3**，而非 **Always visible**，方塊就會等到你前進到它的步驟才出現。共用同一個數字的方塊會一起出現。
- **資訊亭。** 為畫板設定 **Length**，簡報就會在那裡停留那麼久，然後在細細的進度條後方前進。在連結中加入 `kiosk`，簡報就會在結尾處繞回開頭，適合數位看板。
- **子投影片堆疊。** 在畫板上按右鍵並選擇 **Stack under the previous slide**，讓它成為上一張投影片的一個步驟。總覽顯示一張卡片，而 inspector 的 **Stack** 列會說明該畫板屬於哪張投影片。
- **Morph。** 當連續的投影片都有名稱相同的 **Morph match** 方塊（例如 `hero`）時，轉場會移動、調整大小並重新著色該方塊，而不是直接切換。簡報範圍的 **Morph** 轉場會對每一對相符的方塊做同樣的事。
- **旁白。** 每個畫板的 **Speaker notes** 都可以朗讀。在 Inspector 的 **Document** 區段中選擇 **Voice**，可選擇第二個聲音來 **Blend with**，以及 **Speed**、以毫秒計的 **Lead-in** 與 **Tail**；**Show captions when presenting** 會在說出文字時顯示字幕。聲音在你的裝置上執行，同樣的備忘稿會成為影片匯出的配樂、PowerPoint 匯出中的投影片音訊，以及 [SCORM 套件](/info/create/exporting.html#scorm-course-packages)中的旁白影片。

簡報也是一個連結。`?present` 會直接開啟簡報，`s=` 選擇投影片（位置、畫板 ID，或表示建置步驟的 `id.step`），而位址會跟著你，所以你送出的就是你所在的那張投影片。[保留的 URL 參數](/info/url-parameters.html#what-happens-on-open)有詳細文件。

**Present with camera** 會把你的攝影機、標誌與姓名字幕疊在投影片上，並附有私人控制項與儲存的場景；請見[用攝影機簡報](/info/presenting.html)。在演講期間，當你在 **Web page** 方塊的 inspector 中開啟 **Make interactive** 時，它可以接管遙控器：在其 **Focus on click** 步驟，Up 和 Down 控制頁面，Next 則繼續簡報。[由遙控器操作的即時頁面](/info/interactive-pages.html)涵蓋焦點樣式、捲動停點與網站核准。

## 接下來往哪裡走

- **[Design 中的文字](/info/text-composition.html)**：在畫布上編輯文字、讓文章流經框架，以及字體排印。
- **[動畫製作](/info/animating.html)**：關鍵影格、景深、場景攝影機與 Lift 圖層。
- **[匯入設計](/info/design-import.html)**：將 Figma、Penpot、Illustrator 或 InDesign 檔案開啟為可編輯的方塊。
- **[分享附規則的設計](/info/create-a-tool.html)**：將 Design 文件變成只含你所選輸入的工具。
- **[匯出檔案](/info/exporting.html)**：格式、大小、列印單位與影片。
