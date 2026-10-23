# Lolly 與 Penpot

_最後核查：2026 年 9 月 28 日。_

如果你的團隊在 Penpot 中設計，Lolly 與 Penpot 並肩運作：兩者都是開源的，也都讀取相同的設計 token。本頁說明各自適合哪項工作。

## Penpot 做得更好的地方

[Penpot](https://penpot.app/) 提供介面設計、元件、彈性版面、互動原型與開發者檢視，並具備即時編輯與即時游標。它提供託管與自行託管的部署，附有 [Docker 與 Kubernetes 安裝選項](https://help.penpot.app/technical-guide/getting-started/)。設計應用程式時，Penpot 就是那個工具。

## 重疊之處

[Penpot 的設計 token](https://help.penpot.app/user-guide/design-systems/design-tokens/) 使用 DTCG 格式，Lolly 也能讀取，所以色彩、字型與其他 token 值可以在兩者之間移動。Lolly 的[匯入設計](/info/design-import.html)會將 `.penpot` 匯出開啟為可編輯的版面，而 Lolly 中的 **Send to Penpot** 會把設計以 `.penpot` 封存檔送回。Lolly 也維護 [Penpot 的 Lolly Export 外掛程式](https://github.com/lolly-tools/lolly-plugins-penpot-export)，它使用 Lolly 的引擎在裝置上加入選擇加入的 Content Credentials。

## Lolly 如何完成重疊的工作

Lolly 的 Design 畫布製作可編輯的素材，並可以把版面變成[附規則的工具](/info/create-a-tool.html)。同一個工具在瀏覽器、桌面應用程式或 CLI 中渲染，並根據資料製作變體。單機版 Lolly 在裝置上渲染並簽署，不需要帳號或伺服器。[私人協作](/info/collaborate.html)直接配對兩部裝置。

## 搭配組織

Lolly Work 加入單一登入、SCIM 佈建、共用目錄與專案、角色、核准、稽核記錄、工作協作與伺服器渲染。兩個儲存庫都採用 MPL-2.0，組織可以同時運行兩者。[什麼在哪裡執行](/info/compare.html#what-runs-where)把這兩部分並排比較。

你可以兩者並用：Penpot 用於介面設計與原型，Lolly 用於可重複的檔案，並由共用的 token 與匯入的設計串接。

Penpot 是其擁有者的商標。本頁描述這兩項產品重疊之處，與 Penpot 無關聯。
