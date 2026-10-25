# 問與答

常見問題，呈現為 `/info/start/faq.html` 上的手風琴。

**維護方式：** 底下每個 `##` 標題都是一個問題；
它下方（直到下一個 `##` 為止）的內容就是答案。答案使用與
網站其他部分相同的輕量 markdown，段落之間以空行分隔。
在這裡新增、移除或重新排序問題後，再重新執行 `pnpm run build:info`（或 `pnpm run dev:web`）。
第一個 `##` 之前的所有內容（本標題與這些說明）都會被建置流程忽略。

順序是初次使用者的順序：先講代價，再講你的檔案，
接著是取得並執行 Lolly，然後是組織，最後是它如何製成。每個問題的錨點
是由相同位置的英文問題建立的，所以翻譯會維持
英文的順序。

## 為什麼免費？有什麼陷阱嗎？

**我們為了自己而打造 Lolly。** SUSE 需要數以千計符合品牌的檔案，而且製作時不能把任何東西交給外部服務。所以我們打造了一個在裝置上完成所有事情的工具，並像我們製作的其他一切一樣以開源釋出。我們持續維護它，因為我們每天都在用。**沒有任何義務：**這裡的一切，無論有沒有我們都能運作。

那條界線是畫在授權裡的，而不是承諾：任何在本機執行的東西，永遠免費。已發布的版本以無法收回的方式授權，也沒有任何能讓任何人的作品重新授權的貢獻者協議。

## SUSE 到底保留了多少不公開？（也就是：什麼時候會過河拆橋）

引擎、外殼、結構描述與不特定品牌的工具是開源的。SUSE 的商標與品牌工具是保持私有的部分，且已經分開。[lolly.tools](https://lolly.tools) 上的公開實例運行 [Lolly Demo](/info/lolly-demo.html)，也就是 Lolly 自己的設計系統。

這裡沒有任何東西靠承諾支撐：每個已發布的版本都維持開源，唯一保留的只有商標。2023 年另一家公司關閉其企業版 Linux 原始碼時，SUSE 共同創立了 [OpenELA](https://openela.org) 以保持該程式碼開放，這個專案承襲的也是同樣的立場。

完整揭露：SUSE *確實*正在建置內部工具，把 Lolly 連接到自己的 IT 系統。那是 SUSE 的內部設置，不是公開與私有開發之間的分裂。Lolly 也以透過 [Open Build Service](https://openbuildservice.org/) 建置為目標，並由 [SUSE Application Collection](https://apps.rancher.io/applications) 提供安全的供應鏈產物。

## 為什麼取名叫「Lolly Tools」？

用 **Lolly** 是因為自由是甜的，也因為在澳洲、紐西蘭和英國，lolly 就是糖果。

用 **Tools** 是因為工具在你拿起它之前都靜靜待著。你不用它的時候它不會運作，你在用它的時候它也不會盯著你看。

## 為什麼到處都是綠色？

lolly.tools 在 [Lolly Demo](/info/lolly-demo.html) 中開啟，這是 Lolly 自己的範例設計系統，它的主色是綠色。這只是範例，不是規定。你可以切換到空白的設計系統 **Lolly Starter**，或到[設定 → 設計系統](/#/settings?focus=design-systems-section)切換到你自己的。

## 我可以使用自己的品牌嗎？

可以。**Design System Setup**（`#/start`）可由一種顏色、一個設計 token 檔案或一份完成的設計建立設計系統，之後每個工具都以你的設計系統繪製。[開始](/info/quickstart.html#put-your-brand-in)帶你走過這三條路線。

由你的組織或你的建置版本提供的設計系統是受管理的：它會顯示鎖頭並保持唯讀，你可以建立可編輯的副本來更改。

## 我昨天做的東西在哪裡？

如果你按了 **Save as** 或 **Save**，它就在首頁的 **Projects** 中，位於你儲存時所用的瀏覽器或應用程式裡。如果你只按了 **Download**，檔案就在你的瀏覽器或系統儲存下載內容的地方，通常 **Assets** 中也有一份副本。[隨工作自動儲存](/info/find-your-work.html#which-tools-save-as-you-work)的工具也會把未儲存的作品保存在 **Projects** 中。[尋找並復原你的作品](/info/find-your-work.html)涵蓋每一種情況。

## 我關掉了分頁。我的作品還在嗎？

已儲存的作品仍在**專案**裡。未儲存的作品會消失，除了那些會隨手儲存的工具，它們同樣會把作品保留在**專案**裡。下次離開前，先按**另存為**。見[如果你關閉了分頁或離開了工具](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool)。

## 我可以用檔案而不是連結來分享作品嗎？

可以。當連結無法攜帶一切時（例如你自己的照片或長篇文字），Share 對話框會說明什麼會遺失，並改為提供 **.lolly** 檔案：一個檔案裝著設計、它使用的圖片，以及（如果你選擇）工具本身。

你決定帶走多少。只有在你的個人資料選擇加入時，才會放入你的姓名與詳細資料；授權圖稿除非你選擇納入，否則會被保留。任何人開啟帶有工具的檔案時，在工具能執行之前，都會被問是否信任該工具。請見[分享你的作品](/info/using.html#sharing-your-work)。

## 我的個人資料詳細資料有什麼用？

你在 **Settings** 中的詳細資料會預先填入要求它們的工具，例如名牌上的姓名。它們留在這部裝置上。如果你還開啟了選擇加入，你挑選的詳細資料會被封入你製作的內容中，標示你為來源。除非你選擇納入你的詳細資料，否則不會包含任何內容。

分享與同步只傳送你選擇的內容。在組織的 Lolly Work 實例上，共用的工作階段與受管轄的工作也會傳到該伺服器。請見[隱私](/info/privacy.html)。

## 我要怎麼取得行動版或桌面版應用程式？

請從[安裝 Lolly](/info/install.html) 下載。該頁面列出 macOS、Windows、Linux 與 Android 的每個建置版本，並說明如何檢查你下載的檔案。iPhone 與 iPad 從 App Store 取得 **Lolly Tools**；[iPhone 與 iPad 一節](/info/install.html#iphone-and-ipad)有連結。

任何人也都可以建置並分發自己的應用程式副本，搭配他們的受眾所需的工具與設定。[建置指南](/info/build-guide.html)說明如何做到。

## Lolly 說它需要 WebGPU。我該怎麼辦？

網頁應用程式以 WebGPU 繪製，這是目前瀏覽器的圖形功能，並且在開啟工具之前會檢查它。請依序嘗試：

1. 將你的瀏覽器更新到目前的版本。
2. 在瀏覽器的設定中開啟圖形或硬體加速，然後重新啟動瀏覽器。
3. 試試已測試過的瀏覽器：[支援的環境](/info/supported-environments.html)列出了它們。
4. 在 Mac、iPhone 或 iPad 上，請改為[安裝應用程式](/info/install.html)。

## Lolly 能編輯並算圖我的 Figma、Penpot、Illustrator 或 InDesign 檔案嗎？

可以。開啟 **Design** 並點擊 **Import a design**：它接受原生的 Figma **.fig**（Save local copy）、Penpot **.penpot** 匯出、Illustrator **.ai** 或 **.pdf**、InDesign **.idml**（File → Export → InDesign Markup）或**任何 SVG**。你不需要帳號、外掛程式或設計應用程式的授權。

![Design 的開放畫布 - 匯入設計位於工具列的 Lolly 選單中](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

圖層會以可編輯的方塊進來：文字仍可重新輸入，圖形仍是圖形，圖片會加入你自己的資料庫。儲存後，**Share with rules** 可以把版面變成任何有 Lolly 的人都能重新填寫的工具。請見[匯入設計](/info/design-import.html)。

## 兩個人可以在沒有網際網路的情況下一起做同一份設計嗎？

可以。一個人以連結、QR 碼或短代碼分享邀請，另一個人接受。兩部裝置就會即時持有同一個工作階段，包括在線狀態與焦點框。它在任何共用網路上都能運作，包括地下室的手機熱點，因為中間沒有伺服器。請見[一起協作](/info/collaborate.html)。對於身處不同網路的同事，組織的 Lolly Work 實例提供經過驗證的工作協作。

## 功能旗標是什麼？

功能旗標可開啟或關閉 Lolly 的各個部分。在單機使用時，由你選擇個人設定。使用 Lolly Work 的組織可以依其政策設定預設值或隱藏選定的開關，而受管理的控制項會有標示。請見[在你的組織使用 Lolly](/info/organisation.html)。

![單機應用程式中的個人功能旗標；組織政策可以管轄選定的開關](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## 工具程式和工具差在哪裡？

Utility 對你已有的檔案做一件快速的工作，例如壓縮 PDF、轉換照片或移除隱藏資料，其中許多在你的裝置上執行，不會上傳任何內容。它們的存在，是為了讓人們通常交給隨便某個網站的工作留在 Lolly 之內。壓縮合約、轉換仍帶有位置資訊的度假照片，或把權杖貼進線上格式化工具，都不該意味著把檔案交給一個保留期限、司法管轄與商業模式都不明的網站。[Utilities](/info/utilities.html) 列出它們，[我們從未同意的交易](/info/status-quo.html)則講述它們背後的故事。

![Utilities 檢視：Strip Hidden Data、Compress PDF、Convert Image 與其他裝置端工作，全都集中在一處](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## 我們的組織可以使用 SSO、共用專案與核准嗎？

可以，使用 **Lolly Work**，也就是同一個開源專案的組織伺服器。它獨立運行，並增加透過你的身分提供者的單一登入、SCIM 佈建、群組權限、共用專案與素材、即時工作協作、核准與稽核記錄。日常使用的應用程式仍可獨立運作。

[在你的組織使用 Lolly](/info/organisation.html)涵蓋登入與尋找共用的工作，[部署](/info/deployment.html#organisation-services-with-lolly-work)則涵蓋設定。共用內容與組織記錄遵循該實例的隱私與保留政策。

## 導入 Lolly 可能會遇到哪些阻礙？

大多是生產端的改變，而非技術。想要一組受管轄工具的團隊，需要有人撰寫其設計系統與第一批範本，不過任何人從第一天起就可以在 Design 中開始製作自己的工具，不需要 git。而現有的流程即使輸出不符合品牌也仍會繼續運作，所以把一項看得見的輸出轉換好，並排呈現前後對照，比一份計畫更快說服人。

[採用與治理](/info/adoption-governance.html)涵蓋依角色的上手、如何衡量試行，以及治理流程可以是什麼樣子。

## Lolly是用「氛圍程式設計」做出來的嗎?

Lolly 是以 AI 輔助編碼、AI 輔助探索，以及在許多地方以 AI 輔助內容開發的，使用了多種模型與供應商的組合，包括來自公有雲前沿公司的模型。架構由人建立，程式碼由人有意識地策展，體驗則由人擔任藝術指導。

Lolly 相依套件中的高嚴重度或嚴重等級公告會阻擋 CI。尚無法修復的公告，只有在附上書面理由作為核准的例外時才會保留。[SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) 列出目前保留的每個例外，[發行說明](https://github.com/lolly-tools/lolly/releases)則列出每個版本帶有的例外。SECURITY.md 也說明如何回報漏洞。

建置中的檢查也會拒絕程式碼註解、應用程式與這些文件中讀起來像機器產出的措辭，讓文字對每位讀者都保持平實。一個副作用是，偵測器可能更難判斷哪些文字出自模型。我們並非有意造成這樣的結果。

最重要的是，Lolly 站在世界各地專家數十年開源工作的肩膀上。

**生成式AI揭露:**

- **LLM 撰寫的程式碼：** Opus 4.8、Gemini 3.1、Qwen3-Coder-Next、Codex Sol（此清單可能擴充）
- **LLM 探索：** Gemini 3.1、Fable、Codex Astra
- **文件：** Sonnet 5
- **開源函式庫：** 其各自的作者，表達於 SBOM、註解與檔案標頭

此清單不包括內嵌於Lolly中的模型。

**人的貢獻：**
- **構想、審閱與回饋：** Ravan Naidoo、Matthias Eckermann、Kelly Andrews、Ryan Kleeman、Peter Chamalian、Penpot 社群、Tim Hildred（名單並不完整）
- **架構、藝術指導與雜訊清道夫：** Andy Fitzsimon

## SUSE 品牌的工具跑到哪裡去了？

它們存放在獨立的私有儲存庫中。公開的 clone 完全不會擷取 SUSE 品牌套件，所以由它建置的版本，除非你選擇其他設定檔，否則使用中性的 `lolly-start` 設定檔：不特定品牌的社群工具，加上一個讓你以自己的內容填入的空白品牌。[lolly.tools](https://lolly.tools) 是以 `lolly-demo` 設定檔建置的，並在 [Lolly Demo](/info/lolly-demo.html)（Lolly 自己的設計系統）中開啟。SUSE 運行自己的實例以保護其商標。

## 那個 Lolly 標誌是什麼口味的？

有人說是萊姆，有人說是薄荷，有時候還有人說是蘋果；Lolly 負責帶來甜味，口味由你來決定！
