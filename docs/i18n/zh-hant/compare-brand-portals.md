# Lolly 與品牌入口網站

_定位更新：2026 年 10 月 31 日。供應商功能範例查核：2026 年 9 月 28 日。_

如果你的組織將已核准素材存放在 Bynder、Frontify、Marq 或 Brandfolder，本頁會將該入口網站與 Lolly 加上 Lolly Work 比較。內容涵蓋人們如何尋找品牌素材，以及如何用這些素材製作新檔案。

<!--i:eti-folder-shared-->
## 保留現有入口網站

現有 DAM 可以繼續作為權威資料來源。Lolly Work 的目錄連接器可將其中選定的資料庫內容提供給 Lolly，讓人們依照組織規則製作新檔案。存取由 DAM 支援的來源限制與 Lolly Work 的開放規則共同管轄。最終輸出的審閱則是另一項獨立決定。

[搭配現有 DAM 使用 Lolly](/info/use-with-dam.html)說明了責任與限制。[SUSE 的 Brandfolder 經驗](/info/suse-brandfolder.html)記錄了一次成功整合，在計畫遷移之前支援管理員進行變更管理。

Lolly 的目標是[內容主權](/info/content-sovereignty.html)，包括掌控製作流程與自由選擇系統。它自己的資料庫與核准功能，服務的是選擇自行運作這些功能的組織。[適用於 DAM 供應商與導入合作夥伴的 Lolly](/info/dam-partners.html)說明連接後的工作流程如何為現有權威記錄系統增加價值。

<!--i:eti-award-->
## 成熟入口網站做得更好的地方

成熟的入口網站提供主機代管、支援與完整的素材管理工作流程。[Frontify 的企業 DAM](https://www.frontify.com/en/solution/enterprise-digital-asset-management) 整合素材探索、存取控制、核准工作流程與分發。Lolly 的整套系統較新。它的核准鏈依序進行，無法任意分支。[Lolly Work 現況與路線圖](/info/work-status.html)記錄了部署限制。

<!--i:eti-blend-->
## 功能重疊之處

兩者都涵蓋已核准的素材、鎖定的範本、存取控制、審閱與分發。Lolly 負責製作檔案。範本、設計 token 與允許的輸入決定使用者能更改什麼，渲染也可以留在其裝置上。Lolly Work 則在組織掌控的基礎設施上加入身分、共用儲存、政策、核准與報表。

![Settings 中目前使用的設計系統，以封面與頁面呈現：每個工具用來繪製的色彩、字型與標誌](/info/shots/dashboard-brand.svg)

<!--i:eti-lolly-->
## Lolly 與 Lolly Work 提供什麼

| 需求 | Lolly + Lolly Work |
|---|---|
| 登入與佈建 | OIDC 單一登入、多個身分提供者、SCIM 2.0 使用者佈建與群組成員資格，以及會撤銷既有工作階段的帳號停用。僅支援 SAML 的身分提供者可透過 Keycloak 等 OIDC 橋接器連接。 |
| 已核准的範本 | Lolly 定義範本可編輯的輸入；Lolly Work 套用群組可見性與輸入政策，以鎖定值、限制選項或隱藏控制項。 |
| 共用素材資料庫 | 實例擁有的上傳內容、集合、自訂中繼資料與受存取控制的目錄，以及可讀取現有 DAM 與儲存資料庫的連接器。 |
| 審閱 | 有順序的核准步驟、合資格的核准者群組、核准人數門檻規則與職責分離；審閱可管轄目錄提交，以及交付至組織目標的作業。 |
| 素材歷史與可用性 | 實例擁有素材的版本與回復、保留與暫緩刪除、排程開放、到期與撤銷。已連接的供應商保留自己的來源歷史。 |
| 授權與署名 | Lolly 記錄檔案使用的每個來源的授權，並準備必要的署名；[創作權利與署名](/info/creative-rights.html)說明它記錄什麼，以及署名寫入何處。它不會代為取得權利許可。 |
| 報表 | 素材使用與下載次數、工具與匯出活動、儀表板與稽核軌跡。使用歸屬判定遵循部署的遙測政策；預設歸屬設定需要同意。 |
| 分發 | 可到期、可撤銷的連結、共用集合、訪客存取，以及交付至已設定的組織目的地。 |
| 公開品牌頁面 | Lolly 可透過 Lolly Design System Setup 或命令列寫出靜態[品牌頁面](/info/brand-page.html)：供人閱讀的標誌、色彩、字型、規則與範例，以及供代理使用的 token、`DESIGN.md` 與技能。你可以自行託管資料夾，或由管理員在 Lolly Work 中開啟預設關閉的[品牌頁面託管](/info/work-design-system-administration.html#host-a-brand-page)。 |

[目錄與內容](/info/work-catalog.html)、[核准](/info/work-approvals.html)以及[政策與治理](/info/work-governance.html)說明這些功能及其設定。

<!--i:eti-checklist-->
## 評估整合後的工作流程

使用[活動卡片製作流程](/info/dam-production.html)，以自己的資料庫測試來源存取、允許的編輯、輸出審閱與交付。[各部分在哪裡執行](/info/compare.html#what-runs-where)列出每份比較共通的限制。僅有來源連接，不代表已建立供應商合作關係，也不代表已通過每個租戶的資格認定。

[Lolly 功能比較](/info/positioning.html)提供功能比較。供應商名稱用於識別比較的產品。Lolly 與它們無關聯。
