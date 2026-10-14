# Lolly 與渲染 API

_最後核查：2026 年 9 月 28 日。_

Lolly 可在你的裝置上、CI 中或透過 [lolly.work](https://lolly.work) 的伺服器 API，根據模板和資料生成資產。該組合方案既涵蓋自動化渲染，也涵蓋圍繞組織製作任務的身份、策略和交付。

## 重疊之處

[Bannerbear](https://www.bannerbear.com/) 和 [Placid](https://placid.app/) 透過 API 和整合，根據模板生成影象和其他媒體。Lolly 採用同樣的“模板加輸入”方式，並提供 [URL 模式](/info/url-mode.html)、[CLI](/info/cli.html)、批次網格和伺服器端點作為提交任務的途徑。

## lolly.work 提供什麼

lolly.work 是 Lolly 專案中獨立部署的組織服務。它在 API 之後執行 Lolly 引擎，應用工具可見性和輸入策略，並提供渲染後的檔案和簽名的分享連結。其[可恢復渲染服務](https://github.com/lolly-tools/lolly-work/blob/main/docs/renders.md)支援單個任務和批次任務、冪等提交、狀態、有限次重試、取消以及保留輸出。配置了持久化儲存時，中斷的任務可在伺服器重啟後繼續。

伺服器使用快速的 SVG/PNG 渲染路徑，以及供需要瀏覽器的工具使用的可選 Chromium 工作程序。自動化透過服務令牌認證，完成的輸出可經[受治理的交付](https://github.com/lolly-tools/lolly-work/blob/main/docs/delivery.md)傳送到組織的目的地。配置簽名身份後，即可對受支援的伺服器輸出進行 C2PA 簽名。

## 誰來執行服務

Bannerbear 和 Placid 將渲染打包為託管服務，使用各自的基礎設施和整合。使用 Lolly 時，個人可以在本地渲染，團隊也可以在自己的基礎設施上執行 lolly.work。Lolly 的兩個倉庫均以 MPL-2.0 開源；自託管沒有按渲染次數計算的軟體許可費用，但計算、儲存和運維仍是需要規劃的成本。

公共 lolly.work 站點是評估用的沙盒環境，並非生產託管承諾。長期執行的服務需要持久化的資料庫和輸出儲存；依賴瀏覽器的工具需要 Chromium 工作程序。[安裝指南](https://github.com/lolly-tools/lolly-work/blob/main/docs/install.md)和[狀態頁](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md)說明了這些要求和當前的限制。

本地渲染和 CI 渲染無需組織服務即可使用。提交伺服器任務會將其輸入和所需資產傳送到該例項；這與裝置端路徑不同。參見[組合方案概覽](/info/compare.html)。

Bannerbear 和 Placid 是其各自所有者的商標。本頁說明各方案的重疊之處，與兩者均無關聯。
