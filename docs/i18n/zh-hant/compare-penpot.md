# Lolly 與 Penpot

_最後查核：2026 年 9 月 28 日。_

如果你的團隊用 Penpot 設計，Lolly 可與 Penpot 搭配使用。兩者都是開源軟體，並讀取相同的設計 token。本頁說明兩者各自適合的工作。

<!--i:eti-award-->
## Penpot 做得更好的地方

[Penpot](https://penpot.app/) 提供介面設計、元件、彈性版面、互動原型與開發者檢查功能，並支援即時編輯與即時游標。它提供託管與自行託管的部署方式，包含 [Docker 與 Kubernetes 安裝選項](https://help.penpot.app/technical-guide/getting-started/)。若要設計應用程式，Penpot 就是適合的工具。

<!--i:eti-blend-->
## 功能重疊之處

[Penpot 的設計 token](https://help.penpot.app/user-guide/design-systems/design-tokens/) 採用 DTCG 格式，Lolly 也能讀取，因此色彩、字型與其他 token 值可在兩者之間移轉。Lolly 的[匯入設計](/info/design-import.html)會將匯出的 `.penpot` 檔案開啟為可編輯的版面，而 Lolly 中的 **Send to Penpot** 可將設計以 `.penpot` 封存檔傳回。Lolly 也維護 [Lolly Export plugin for Penpot](https://github.com/lolly-tools/lolly-plugins-penpot-export)，使用 Lolly 引擎在裝置上加入由使用者選擇啟用的 Content Credentials。

<!--i:eti-lolly-->
## Lolly 如何完成重疊的工作

Lolly Design 畫布可製作可編輯的素材，並將版面轉成[帶有規則的工具](/info/create-a-tool.html)。同一個工具可在瀏覽器、桌面應用程式或 CLI 中渲染，並根據資料製作不同版本。獨立使用 Lolly 時，渲染與簽署都在裝置上完成，不需要帳號或伺服器。[私人協作](/info/collaborate.html)會直接配對兩部裝置。

<!--i:eti-building-->
## 在組織中使用

Lolly Work 加入單一登入、SCIM 佈建、共用目錄與專案、角色、核准、稽核記錄、工作協作與伺服器渲染。兩個儲存庫皆採用 MPL-2.0，組織可以同時執行兩者。[各部分在哪裡執行](/info/compare.html#what-runs-where)並列說明這兩個部分。

你可以同時使用兩者：Penpot 負責介面設計與原型製作，Lolly 負責可重複製作的檔案。

Penpot 是其擁有者的商標。本頁說明這兩項產品功能重疊之處，與 Penpot 無關聯。
