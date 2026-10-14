# Lolly 與 Penpot

_最後核查：2026 年 9 月 28 日。_

Lolly 與 Penpot 都提供開源設計工具、共享設計令牌和實時協作。Lolly 將裝置端創作與獨立部署的組織服務 [lolly.work](https://lolly.work) 結合在一起。

## 共同的設計基礎

[Penpot 的設計令牌](https://help.penpot.app/user-guide/design-systems/design-tokens/)使用 DTCG 格式，Lolly 同樣可以讀取。顏色、字型和其他令牌值可以在兩種工作流之間共享。Lolly 的[匯入設計](/info/design-import.html)可將 `.penpot` 匯出檔案開啟為可編輯的版面。

適用於 Penpot 的 Lolly Export 外掛由 Lolly 維護。它使用 Lolly 的引擎在裝置上提供需主動啟用的 C2PA Content Credentials。簽名完整性與對簽名者的信任是兩回事：驗證方需要一個自己信任的身份，詳見 [Content Credentials 身份](/info/content-credentials-identity.html)。

## 設計與團隊工作流

[Penpot](https://penpot.app/) 提供介面設計、元件、靈活的佈局、互動原型和開發者檢查。它提供託管和自託管兩種部署，並有 [Docker 和 Kubernetes 安裝選項](https://help.penpot.app/technical-guide/getting-started/)。

Lolly 的設計畫布可建立可編輯的資產，並能將版面變成[帶規則的工具](/info/create-a-tool.html)。同一個工具可在瀏覽器、桌面應用或 CLI 中渲染，並能根據資料生成變體。在團隊協作方面，Lolly 既有直接連線兩臺裝置的[私有協作](/info/collaborate.html)，也有透過 lolly.work 進行的工作協作，支援共享編輯、游標和已儲存的團隊會話。

## 部署方式有何不同

獨立使用的 Lolly 在裝置上渲染和簽名，無需賬號或伺服器。lolly.work 增加了 SSO、SCIM 預配、共享目錄與專案、角色、審批、審計記錄和伺服器端渲染。兩個倉庫均以 MPL-2.0 開源，均可由組織自行運營。共享工作使用已配置的例項；本地創作仍可獨立使用。

如何選擇取決於工作內容：Penpot 的介面設計與原型工作流、Lolly 的可重複資產製作，或是利用共享令牌和匯入設計的組合方式。Lolly 的工作協作目前執行在單個伺服器節點上，其[部署狀態](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md)應納入組織的評估。

Penpot 是其所有者的商標。上文的外掛屬於 Lolly。更廣泛的對比請參閱[Lolly 如何對比](/info/positioning.html)和[組合方案概覽](/info/compare.html)。
