# 問題與解答

常見問題，會在 `/info/start/faq.html` 渲染為手風琴式摺疊清單。

**維護方式：** 下方每個 `##` 標題都是一個問題。標題下的所有內容，
直到下一個 `##` 為止，就是答案。答案使用網站的輕量 Markdown：
以空白行分隔段落。在這裡新增、移除或重新排列問題，然後
重新執行 `pnpm run build:info`（或 `pnpm run dev:web`）。
建置會忽略第一個 `##` 之前的所有內容（此標題與這些備註）。

順序依初次使用者的需要安排：先談有沒有附帶條件，再談你的檔案，接著是取得
與執行 Lolly，再來是組織，最後是如何製作。每個問題的錨點
都由相同位置的英文問題建立，因此翻譯必須保留
英文的順序。

## 為什麼免費？有什麼附帶條件？

**我們為自己打造了 Lolly。** SUSE 需要數千個符合品牌的檔案，而且不能把任何內容交給外部服務。因此我們打造了在裝置上完成所有工作的工具，並像我們製作的其他一切一樣，以開放原始碼發布。我們持續維護，因為每天都在使用它。**沒有任何義務：** 有沒有我們，這裡的一切都能運作。

這條界線寫在授權條款中，而非只是一句承諾：任何在本機執行的內容，都永遠免費。已發布版本的授權讓它無法被收回。任何貢獻者協議都不能改變任何人作品的授權。

## SUSE 有多少內容不公開？（也就是，什麼時候會突然收回承諾）

引擎、外殼程式、結構描述與不綁定品牌的工具都是開放原始碼。SUSE 的商標與品牌專屬工具維持不公開，並已分開存放。[lolly.tools](https://lolly.tools) 上的公開實例使用 [Lolly Demo](/info/lolly-demo.html)，也就是 Lolly 自己的設計系統。

這裡沒有任何事只靠承諾：每個已發布版本都維持開放原始碼。2023 年，另一家公司關閉其企業版 Linux 原始碼時，SUSE 共同創立了 [OpenELA](https://openela.org)，讓那些程式碼維持開放。本專案承襲這個立場。

SUSE *確實*正在打造內部工具，將 Lolly 連接到自己的 IT 系統。那是 SUSE 的內部配置，不是將開發分成公開與不公開兩部分。Lolly 也計畫透過 [Open Build Service](https://openbuildservice.org/) 建置，並由 [SUSE Application Collection](https://apps.rancher.io/applications) 提供安全的供應鏈產物。

## 為什麼取名「Lolly Tools」？

**Lolly** 是因為自由很甜美，而且在澳洲、紐西蘭與英國，lolly 就是糖果。

**Tools** 是因為工具會安靜等待，直到你拿起它。不使用時，它不會執行；使用時，它也不會監視你。

## 為什麼到處都是綠色？

lolly.tools 開啟時使用 [Lolly Demo](/info/lolly-demo.html)，這是 Lolly 自己的範例設計系統，主色為綠色。可在 [Settings → Design systems](/#/settings?focus=design-systems-section) 切換為空白設計系統 **Lolly Starter**，或你自己的設計系統。

## 可以使用自己的品牌嗎？

可以。**Lolly Design System Setup**（`#/start`）可從一個色彩、設計 token 檔案或完成的設計建立設計系統。之後，每個工具都會使用你的設計系統繪製。[開始使用](/info/quickstart.html#put-your-brand-in)會帶你走過這三種方式。

由組織或建置版本提供的設計系統是受管理的。它會顯示鎖頭，並維持唯讀。若要變更，請建立可編輯的副本。

## 昨天做的東西在哪裡？

如果你按了 **Save as** 或 **Save**，作品就在首頁的 **Projects** 中，位於你儲存時使用的瀏覽器或應用程式。如果只按了 **Download**，檔案會在瀏覽器或系統的下載資料夾中，通常也會在 **Assets** 中保留一份副本。[隨工作自動儲存](/info/find-your-work.html#which-tools-save-as-you-work)的工具也會將未儲存的作品保留在 **Projects** 中。[尋找並復原你的作品](/info/find-your-work.html)涵蓋每一種情況。

## 關閉分頁後，作品會不見嗎？

已儲存的作品仍在 **Projects** 中。未儲存的作品會遺失，但隨工作自動儲存的工具例外，它們也會將作品保留在 **Projects** 中。下次離開前，請按下 **Save as**。請見[如果關閉了分頁或離開了工具](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool)。

## 可以用檔案分享作品，而不是連結嗎？

可以。當連結無法攜帶所有內容，例如自己的照片或長文字時，Share 對話框會說明哪些內容會遺漏，並提供 **.lolly** 檔案。這一個檔案就包含設計、使用的圖片，以及你選擇納入的工具。

攜帶多少內容由你決定。只有在個人資料中選擇同意，才會加入你的姓名與詳細資料。除非你選擇納入，否則不會攜帶授權圖稿。任何人開啟帶有工具的檔案時，都會先被詢問是否信任該工具，之後工具才能執行。請見[分享你的作品](/info/using.html#sharing-your-work)。

## 個人資料有什麼用途？

你在 **Settings** 中的個人資料會預先填入需要它們的工具，例如徽章上的姓名。這些資料留在這部裝置上。除非你開啟選用設定，否則不會有任何資料加入你製作的內容。開啟後，你選擇的資料會封存其中，並註明你是來源。

分享與同步只會傳送你選擇的內容。在組織的 Lolly Work 實例上，共用工作階段與受管理的作品也會傳送到該伺服器。請見[隱私](/info/privacy.html)。

## 如何取得行動版或桌面版應用程式？

從[安裝 Lolly](/info/install.html)下載。該頁列出 macOS、Windows、Linux 與 Android 的所有建置版本，並說明如何檢查下載的檔案。iPhone 與 iPad 可從 App Store 取得 **Lolly Tools**。[iPhone 與 iPad 區段](/info/install.html#iphone-and-ipad)提供了連結。

任何人也都可以自行建置並分發應用程式副本，加入使用對象所需的工具與設定。[建置指南](/info/build-guide.html)說明了做法。

## Lolly 說需要 WebGPU，該怎麼辦？

網頁應用程式以 WebGPU 繪製，這是目前瀏覽器提供的圖形功能，並會在開啟工具之前檢查 WebGPU。請依序嘗試：

1. 將瀏覽器更新至目前版本。
2. 在瀏覽器設定中開啟圖形或硬體加速，然後重新啟動瀏覽器。
3. 試用已測試的瀏覽器：[支援的環境](/info/supported-environments.html)列出了這些瀏覽器。
4. 在 Mac、iPhone 或 iPad 上，改為[安裝應用程式](/info/install.html)。

## Lolly 可以編輯並渲染我的 Figma、Penpot、Illustrator 或 InDesign 檔案嗎？

可以。開啟 **Design** 工具並點擊 **Import a design**：它接受原生 Figma **.fig**（Save local copy）、Penpot **.penpot** 匯出、Illustrator **.ai** 或 **.pdf**、InDesign **.idml** 或 **.indd**、Affinity 文件、Photoshop **.psd**、PowerPoint **.pptx**、CAD **.dxf** 或**任何 SVG**（[它能讀取的每種格式](/info/design-import.html#what-comes-in-from-each-app)）。不需要帳號、外掛或設計應用程式授權。

![Lolly Design 的開放畫布 - Import a design 位於工具列的 Lolly 選單中](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

圖層會以可編輯的方塊匯入。文字仍可重新輸入，圖形仍是圖形，圖片則加入你的資料庫。儲存版面後，**Share with rules** 可將它轉為任何有 Lolly 的人都能重新填入內容的工具。請見[匯入設計](/info/design-import.html)。

## 兩個人可以在沒有網際網路的情況下編輯同一份設計嗎？

可以。一人分享邀請（連結、QR code 或短代碼），另一人接受。之後兩部裝置會即時共用同一個工作階段，並顯示在線狀態與焦點環。這可在任何共用網路上運作，包含手機熱點，因為中間沒有伺服器。請見[一起協作](/info/collaborate.html)。對於不同網路上的同事，組織的 Lolly Work 實例可提供經過驗證的工作協作。

## 什麼是功能旗標？

功能旗標會開啟或關閉 Lolly 的部分功能。獨立使用時，你可選擇自己的設定。使用 Lolly Work 的組織可依政策設定預設值或隱藏特定開關，受管理的控制項也會標示出來。請見[在組織中使用 Lolly](/info/organisation.html)。

![獨立應用程式中的個人功能旗標；組織政策可管理特定開關](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Utility 與工具有什麼不同？

Utility 會對你已有的檔案完成一項快速工作，例如壓縮 PDF、轉換照片或移除隱藏資料。許多 Utility 在你的裝置上執行，不會上傳任何內容。Utilities 將人們通常交給任意網站處理的工作留在 Lolly 內。壓縮合約、轉換仍含有位置資訊的度假照片，或將 token 貼入線上格式化工具，都不該代表要將檔案交給資料保留方式、司法管轄區與商業模式不明的網站。[Lolly Utilities](/info/utilities.html)列出這些 Utility，而[我們從未同意的交易](/info/status-quo.html)說明它們背後的故事。

![Utilities 檢視：Lolly Strip Hidden Data、Compress PDF、Convert Image 與其他裝置上的工作，全部集中在同一處](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## 我們的組織可以使用 SSO、共用專案與核准功能嗎？

可以，透過 **Lolly Work**，也就是同一開放原始碼專案的組織伺服器。它獨立執行，提供經由身分識別提供者的單一登入、SCIM 佈建、群組權限、共用專案與素材、即時工作協作、核准與稽核記錄。日常使用的應用程式仍可獨立運作。

[在組織中使用 Lolly](/info/organisation.html)涵蓋登入與尋找共用作品。[部署](/info/deployment.html#organisation-services-with-lolly-work)涵蓋 Lolly Work 的設定。共用內容與組織記錄遵循該實例的隱私與保留政策。

## 導入 Lolly 可能遇到什麼阻礙？

主要是團隊製作作品的方式需要改變，而非技術問題。想要一組受管理工具的團隊，需要有人編寫設計系統與最初的範本。任何人仍可在第一天就在 Lolly Design 製作自己的工具，不需要 git。即使產出不符合品牌，既有流程仍會繼續運作。把一項看得見的產出轉換好，並排展示前後成果，比計畫更快展現價值。

[導入與治理](/info/adoption-governance.html)涵蓋各角色的入門方式、如何衡量試行成果，以及治理流程的樣貌。

## Lolly 是用「vibe coding」寫出來的嗎？

Lolly 的開發使用了 AI 輔助程式設計、AI 輔助探索，以及許多部分的 AI 輔助內容製作，採用多種模型與供應商，其中包括公有雲前沿 AI 公司的模型。由人類建立架構、有意識地審選程式碼，並為使用體驗提供美術指導。

Lolly 的相依套件出現高或嚴重等級的安全公告時，CI 會被阻擋。尚無法修正的公告，只有在附上書面理由並獲准列為例外時，才能暫緩處理。[SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) 列出目前保留的每項例外，而[版本資訊](https://github.com/lolly-tools/lolly/releases)列出各版本包含的例外。SECURITY.md 也說明如何通報漏洞。

建置中的檢查也會拒絕程式碼註解、應用程式與這些文件中讀起來像機器撰寫的措辭，讓每位讀者都能讀到清楚易懂的文字。副作用是，偵測器可能更難分辨哪些文字出自模型。我們並非刻意造成這個結果。

最重要的是，Lolly 建立在世界各地專家數十年開放原始碼工作的基礎上。

**生成式 AI 揭露：**

- **LLM 撰寫的程式碼：** Opus 4.8、Gemini 3.1、Qwen3-Coder-Next、Codex Sol（此清單可能擴充）
- **LLM 探索：** Gemini 3.1、Fable、Codex Astra
- **文件：** Sonnet 5
- **開放原始碼函式庫：** 各自的作者，記載於 SBOM、註解與檔案標頭中

此清單不包含隨 Lolly 一同納入的模型。

**人類貢獻：**
- **構思、審閱與回饋：** Ravan Naidoo、Matthias Eckermann、Kelly Andrews、Ryan Kleeman、Peter Chamalian、Penpot 社群、Tim Hildred（清單未盡列）
- **架構、美術指導 & 劣質產出清理：** Andy Fitzsimon

## SUSE 品牌的工具去哪裡了？

它們存放在獨立的私人儲存庫中。複製公開儲存庫不會取得 SUSE 品牌套件，因此從中建置時，除非你另作選擇，否則會使用中性的 `lolly-start` 設定檔。該設定檔包含與品牌無關的社群工具，以及可填入你自己品牌內容的空白品牌。[lolly.tools](https://lolly.tools) 使用 `lolly-demo` 設定檔建置，開啟時採用 [Lolly Demo](/info/lolly-demo.html)，也就是 Lolly 自己的設計系統。SUSE 運行自己的實例以保護其商標。

## Lolly 標誌是什麼口味？

有人說是萊姆，有人說是薄荷，有時也有人說是蘋果。Lolly 帶來甜味，口味由你決定。

## Lolly 所說的內容主權是什麼意思？

掌控你的內容如何建立、管理、儲存，以及如何在你選擇的系統之間移動。Lolly 支援在本機製作、可編輯的作品與可攜式工具。Lolly Work 加入由組織掌控的共用服務。來源授權、可用的相依項目與工作流程中的資料流向仍然重要。[什麼是內容主權？](/info/content-sovereignty.html)說明每項控制及其限制。

## 我們能保留現有的 DAM 嗎？

可以。受支援的 DAM 可以繼續作為權威資料來源，由 Lolly Work 將選定的素材連接到 Lolly 工具。來源存取、允許的編輯、使用權與成品核准是分開的決策。[搭配現有的 DAM 使用 Lolly](/info/use-with-dam.html)說明這項安排，而 [SUSE 的 Brandfolder 經驗](/info/suse-brandfolder.html)記錄了導入期間的成功使用情況。
