# 常見問題

顯示於 `/info` 首頁摺疊面板中的常見問題。

**維護方式：** 底下每個 `##` 標題都是一個問題；它下方（直到下一個 `##` 為止）的內容就是答案。答案使用與網站其他部分相同的輕量 markdown，段落之間以空行分隔。在這裡新增、移除或重新排序問題後，再重新執行 `npm run build:info`（或 `npm run dev:web`）。第一個 `##` 之前的所有內容（本標題與這些說明）都會被建置流程忽略。

## 我在 /profile 頁面選擇加入之後會發生什麼事？

初次使用 Lolly 時，你在任何地方輸入的一切都是完全私密的，直到你刻意要讓那些資訊透過媒體或分享連結（在有網路的情況下）傳出去為止。

選擇加入之後，你所挑選的個人檔案細節會被封進你做出來的成品裡，標示你是來源。沒有經你挑選的東西一律不會被納入。

Lolly 會產出大量內容。我們採取嚴格的資料最小化做法來預防風險。

## Lolly是用「氛圍程式設計」做出來的嗎?

Lolly的開發運用了AI輔助程式設計、AI輔助探索,許多地方還使用了AI輔助生成的內容,所使用的模型與供應商多種多樣,包括來自公有雲前沿企業的模型。

截至本文撰寫時,Lolly的供應鏈中不存在已知的資安漏洞,並承諾在CVE出現時採取快速的資安應變措施。

架構由人類設計,程式碼經過有意識地審慎篩選,體驗則由人類進行藝術指導。

最重要的是,Lolly站在世界各地真正專家們數十年開源創新成果的肩膀之上。

Lolly的程式碼庫中有一個確定性建置關卡,用以讓程式碼和文件對一般讀者保持連貫,並為體驗「去水」。這可能會讓專有的合成式溯源枚舉變得困難。這並非刻意為之。

**生成式AI揭露:**

- **LLM撰寫的程式碼:** Opus 4.8、Gemini 3.1、Qwen3-Coder-Next(此清單可能會擴充)
- **LLM探索:** Gemini 3.1、Fable
- **文件:** Sonnet 5
- **開源函式庫:** 各自的作者,詳見SBOM、註解與檔案標頭

此清單不包括內嵌於Lolly中的模型。

**人類貢獻:**

- **架構:** Andy Fitzsimon
- **藝術指導:** Andy Fitzsimon
- **人工撰寫的程式碼:** Andy Fitzsimon
- **構想發想、審閱與意見回饋:** Ravan Naidoo、Matthias Eckermann、Kelly Andrews、Ryan Kleeman、Peter Chamalian、Penpot社群(清單並不詳盡)

## 功能旗標是什麼？

功能旗標可以開啟或關閉 Lolly 的各個部分。這類開關通常由管理員掌控；在 Lolly，掌控權在你手上。

![每個功能旗標都是屬於你的開關，放在你自己的個人檔案裡，而不是管理員的主控台](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## 我要怎麼取得行動版或桌面版應用程式？

任何人都可以發佈自己的應用程式，而這些程式的工具與設定會依目標對象不同而有很大差異。所以並沒有單一的一款應用程式，除非是你自己做的，或是由相關的人交給你。

## 為什麼取名叫「Lolly Tools」？

用 **Lolly** 是因為自由是甜的，也因為在澳洲、紐西蘭和英國，lolly 就是糖果。

用 **Tools** 是因為工具在你拿起它之前都靜靜待著。你不用它的時候它不會運作，你在用它的時候它也不會盯著你看。

## 導入 Lolly 可能會遇到哪些阻礙？

你原本在哪裡產生檔案，Lolly 就能接進哪裡；CLI 和 App 用的是同一套引擎，所以凌晨兩點跑的流水線，不可能和有人在瀏覽器裡預覽到的結果產生落差。導入的阻力很少出在技術，而是出在組織。可以預期以下這幾點：

**必須有人編寫一套精選的品牌目錄。** Lolly 是一個平台，不是一包做好的範本。若要進行*受治理的推行*，得有人定義共用的素材目錄（標誌、色盤、字型，都以永久 ID 表示），並為每一種輸出類型撰寫 manifest + 範本。不過個人不必等這一步：在開放的應用程式裡，任何人第一天就能把自己的檔案匯入目錄，並在 Design 裡建立工具。

**要貢獻不需要用 git。** 設計師在應用程式裡做出自己的工具與範本，然後分享給同事，或是提交給部署的擁有者納入預設。

**它刻意做得很窄，請照這個定位來介紹它。** Lolly 不是用來做客製化或主視覺內容的。它*就是*你的個人 DAM，由你的設計系統、工具與目錄灌注並強化；它*確實*有一塊開放畫布（Design），但即使在那裡，顏色、字體與素材也都遵循目前生效的設計全域設定，所以自由排版仍然待在系統之內。拿它跟 Figma 或 Canva 相比，它會顯得很有限。但就它本來的樣子來看，也就是流程化、重複性、超大規模的素材生成，沒有東西比得上。定位錯誤是最常見的挫折來源。

**產出端的變革管理。** 既有流程今天就能動，即使產出的東西不符品牌規範。把它們改接到這套引擎，代表要重新測試、重新學習，而「我們本來就做得出檔案」就會成為不遷移的藉口。可以先從一個能見度高、達到正式品質的產出開始轉換，再把前後結果並排展示出來。

Lolly 把整體水準一起拉上來。


## 工具程式和工具差在哪裡？

**基本答案 →** 工具程式不一定需要算圖，因此可以有不一樣的使用體驗。 

**真正的答案 →** 之所以讓工具程式能託管在 Lolly Tools 裡，是為了再加上一層「便利性」防線，降低資料外流的誘因。 

為什麼？因為大家都知道，每天都有人把**手上原本就機密的內容**交給某個隨便找到的網站，只為了完成一個很小的機械性操作：

- 「**壓縮這個 PDF**」→ 把合約／薪資單／董事會簡報上傳給不明的對象。
- 「**把 HEIC 轉成 JPG**」→ 把個人照片（連同 GPS EXIF）上傳到靠廣告營利的主機
- 「**裁切／縮放這張圖**」→ 上傳產品截圖或尚未發布的素材
- 「**格式化這段 JSON**」／「解碼這個 JWT」→ 把 API 回應、權杖、密鑰貼進某個格式化工具
- 「**合併這幾個 PDF**」→ 上傳**兩份永遠不該放在同一台伺服器上的文件**

這些網站以及它們龐大的複製長尾**預設就不值得信任**：保存期限不明、司法管轄不明、次要處理者不明，再加上廣告／聯盟行銷的商業模式，讓它們有十足的動機留下你交出去的東西。操作本身微不足道，**代價是內容本身。** 

我們靠出色的便利性與服務，打贏這場治理之戰。 

![工具程式檢視把大家平常交給隨便某個網站處理的機械性工作集中起來，全部改在 Lolly 裡執行](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Lolly 能編輯並算圖我的 Figma、Penpot、Illustrator 或 InDesign 檔案嗎？

可以。開啟 **Design**，點 **匯入設計**：它接受原生的 Figma **.fig**（Save local copy）、Penpot 的 **.penpot** 匯出檔、Illustrator 的 **.ai** 或 **.pdf**、InDesign 的 **.idml**（File → Export → InDesign Markup），或是**任何 SVG**（這是最寬的一道門，幾乎每個設計軟體都匯得出來）。不需要帳號、不需要外掛，也不需要設計軟體的授權。

![Design 的開放畫布 - 匯入設計位於工具列的 Lolly 選單中](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

圖層會以可編輯的方塊出現在開放畫布上：文字仍然可以重打，形狀仍然是形狀，圖片會加進你自己的圖庫，字體與顏色則遵循品牌全域設定。存檔之後，這份版面就成為可重複使用、可用網址取用的範本，任何有 Lolly 的人都能重新填入內容；你還可以混入會在載入時重新算圖的即時工具（QR code、圖表）。從那裡開始，它就跟 Lolly 裡的其他東西一樣算圖：SVG、PDF、PNG 等等，都能從網址重現。請見[匯入設計](/info/design-import.html)。

## 我可以用檔案而不是連結來分享作品嗎？

可以。當連結裝不下全部內容（你自己的照片、很長的文字）時，分享對話框會明確說出哪些東西會不見，並改為提供 **.lolly** 檔案：一個檔案裝著這份設計、它用到的圖片，以及（如果你選擇的話）工具本身。要帶走多少由你決定：只有在你的個人檔案選擇加入時，姓名與細節才會寫進去；有授權的美術素材除非你主動包含，否則會被留下不帶走；而打開含有工具的檔案的人，在工具能執行之前會先被問是否信任它。請見[分享你的作品](/info/using.html#sharing-your-work)。

## 兩個人可以在沒有網際網路的情況下一起做同一份設計嗎？

可以。一個人分享邀請（一個連結、一個 QR code 或一組短代碼），另一個人接受，兩台裝置就會即時共用同一個工作階段，包括在線狀態、焦點框，全都有。只要在同一個網路上就能運作，地下室裡用手機開的熱點也行，因為中間沒有伺服器。請見[一起協作](/info/collaborate.html)。

## SUSE 品牌的工具跑到哪裡去了？

它們已經放在另一個私有的儲存庫裡。公開的複製版本根本不會抓取 SUSE 品牌包，所以公開建置跑的是中性的 `lolly-start` 設定檔：與品牌無關的社群工具，加上一個空白品牌讓你填入自己的內容。SUSE 為了保護自家商標，營運自己的實例。

## 為什麼免費？有什麼陷阱嗎？

**我們是為了自己才做出 Lolly 的。** SUSE 需要數千個符合品牌規範的檔案，每一個都要把名稱封在裡面，而且製作過程不能把任何東西交給外部服務。所以我們做了一個全部在裝置上完成的工具，並且像我們做的其他東西一樣以開源釋出。我們持續維護它，是因為我們每天都在用。**這不附帶任何義務：**這裡的一切，有沒有我們都照樣能用。

那條界線畫在授權條款裡，不是畫在承諾裡：任何在本機執行的東西都永遠免費。已經釋出的版本，其授權方式讓它無法被收回，也沒有任何貢獻者協議能把別人的成果重新授權。完整說明請見[定位](/info/positioning.html)。

## SUSE 到底保留了多少不公開？（也就是：什麼時候會過河拆橋）

引擎、外殼、結構描述以及與品牌無關的工具都是開源的；保持私有的是 SUSE 的商標與品牌工具，而且它們已經被分離出來了。公開實例 [lolly.tools](https://lolly.tools) 執行於空白品牌之上。

這條界線是結構性的，不是靠承諾的。每一個釋出的版本都是開源的，而且無法被收回；沒有任何貢獻者協議能把別人的成果重新授權；唯一保留下來的只有商標。2023 年另一家公司把自己的企業版 Linux 原始碼關閉時，SUSE 共同創立了 [OpenELA](https://openela.org) 來維持那些程式碼開放，本專案承襲的正是同樣的立場。

完整揭露：SUSE *確實*正在建置內部工具，把 Lolly 整合進自家的 IT 系統，但那講的是 SUSE 的內部配置，不是公開開發與私有開發之分。Lolly 也打算透過 [Open Build Service](https://openbuildservice.org/) 來建置，並由 [SUSE Application Collection](https://apps.rancher.io/applications) 提供安全供應鏈的產出物。

## 那個 Lolly 標誌是什麼口味的？

有人說是萊姆，有人說是薄荷，有時候還有人說是蘋果；Lolly 負責帶來甜味，口味由你來決定！
