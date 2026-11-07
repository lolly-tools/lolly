# Lolly 與品牌門戶

_定位更新：2026 年 10 月 31 日。供應商能力範例核查：2026 年 9 月 28 日。_

如果你的組織把核准的素材放在 Bynder、Frontify、Marq 或 Brandfolder，本頁將它與 Lolly 加 Lolly Work 比較：人們如何找到品牌素材，以及如何用它們製作新檔案。

## 保留你現有的入口網站

現有的 DAM 可以繼續作為記錄的來源。Lolly Work 的目錄連接器讓其資料庫中選定的部分在 Lolly 中可用，人們在那裡依組織的規則製作新檔案。存取由 DAM 所支援的來源限制與 Lolly Work 的公開規則管轄；最終輸出的審閱則是另一項獨立的決定。

[將 Lolly 與你現有的 DAM 搭配使用](/info/use-with-dam.html)說明了各方的責任與限制。[SUSE 的 Brandfolder 經驗](/info/suse-brandfolder.html)記錄了一次成功的整合，它在規劃中的遷移之前支援了管理員的變更管理。讓來源保持連接，仍是受支援的選擇。

Lolly 的宗旨是[內容主權](/info/content-sovereignty.html)，包括對製作的掌控與選擇系統的自由。它自己的資料庫與核准，支援選擇自行運作這些能力的組織。[給 DAM 供應商與實作夥伴的 Lolly](/info/dam-partners.html) 說明了連接起來的工作流程如何為現有的記錄系統增加價值。

## 成熟的入口網站做得更好的地方

成熟的入口網站提供託管、支援與廣泛的素材管理工作流程。例如，[Frontify 的企業 DAM](https://www.frontify.com/en/solution/enterprise-digital-asset-management) 結合了素材探索、存取控制、核准工作流程與發布。Lolly 這套堆疊較年輕，其核准鏈是循序的，而非任意分支的工作流程。[Lolly Work 狀態與路線圖](/info/work-status.html)記錄了其部署限制。

## 重疊之處

兩者都涵蓋核准的素材、鎖定的範本、存取控制、審閱與發布。Lolly 負責製作檔案：範本、設計 token 與允許的輸入定義了人們可以更改什麼，而渲染可以留在他們的裝置上。Lolly Work 在組織控制的基礎架構上加入身分、共用儲存、政策、核准與報告。

![Settings 中使用中的設計系統，以封面與頁面呈現：每個工具繪製所用的色彩、字型與標誌](/info/shots/dashboard-brand.svg)

## Lolly 與 Lolly Work 提供什麼

| 需求 | Lolly + Lolly Work |
|---|---|
| 登入與佈建 | OIDC 單一登入、多個身分提供者、SCIM 2.0 使用者佈建與群組成員資格，以及會撤銷現有工作階段的帳號停用。僅支援 SAML 的身分提供者可以透過 Keycloak 等 OIDC 橋接器連接。 |
| 核准的範本 | Lolly 定義範本可編輯的輸入；Lolly Work 套用群組可見度與輸入政策，鎖定值、限制選項或隱藏控制項。 |
| 共用素材庫 | 實例擁有的上傳、集合、自訂中繼資料與有存取控制的目錄，以及讀取現有 DAM 與儲存資料庫的連接器。 |
| 審閱 | 有順序的核准步驟、符合資格的核准者群組、法定人數規則與職責分離；審閱可以管轄目錄提交與對組織目標的交付。 |
| 素材歷史與可用性 | 實例擁有之素材的版本與回復、保留與保全、排程的可用性、到期與撤銷。連接的提供者保有自己的來源歷史。 |
| 授權與署名 | Lolly 記錄檔案所用每個來源的授權，並準備它所欠的署名；[創作權利與署名](/info/creative-rights.html)說明它記錄什麼，以及署名寫在哪裡。它不會釐清權利。 |
| 報告 | 素材使用與下載計數、工具與匯出活動、儀表板與稽核軌跡。使用歸屬遵循部署的遙測政策；預設的歸屬設定需要同意。 |
| 發布 | 會到期、可撤銷的連結、共用集合、訪客存取，以及交付到已設定的組織目的地。 |
| 公開的品牌頁面 | Lolly 會從 Lolly Design System Setup 或命令列寫出靜態的[品牌頁面](/info/brand-page.html)：給人看的標誌、色彩、字型、規則與範例，以及給代理程式用的 token、`DESIGN.md` 與技能。你自己代管該資料夾，或由管理員在 Lolly Work 中開啟[品牌頁面代管](/info/work-design-system-administration.html#host-a-brand-page)，此功能預設為關閉。 |

[目錄與內容](/info/work-catalog.html)、[核准](/info/work-approvals.html)與[政策與治理](/info/work-governance.html)說明了這些功能及其設定。

## 評估合併的工作流程

使用[活動卡片製作流程](/info/dam-production.html)，以你自己的資料庫測試來源存取、允許的編輯、輸出審閱與交付。[什麼在哪裡執行](/info/compare.html#what-runs-where)列出每項比較共有的限制。來源連接本身並不會建立與供應商的夥伴關係，也不代表每個租戶都具備資格。

能力比較請見 [Lolly 與其他方案比較](/info/positioning.html)。廠商名稱用於標示被比較的產品；Lolly 與它們沒有關聯。
