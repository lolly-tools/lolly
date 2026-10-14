# Lolly 與 Canva

_最後核查：2026 年 9 月 28 日。_

Lolly 在瀏覽器中製作符合品牌規範的圖形、社交媒體帖子、簡報和版面。與 [lolly.work](https://lolly.work) 配合，它還支援共享專案、實時工作協作、已批准的資產和組織策略。

## 重疊之處

兩者都能讓人從模板起步，不必是設計師也能做出成品圖形。兩者都支援團隊工作流和品牌控制：[Canva 將這些功能打包在其商業方案中](https://www.canva.com/canva-business/)；Lolly 則把創意應用與組織服務分開。

Lolly 在你的裝置上獨立執行，無需賬號。當組織需要時，lolly.work 提供 SSO、SCIM 預配、角色、共享目錄、審批和使用情況報告。它屬於 Lolly 專案，獨立部署，與 Lolly 本身一樣以 MPL-2.0 開源。

## 模板與團隊協作

Canva 將大型模板與相簿、應用和託管的團隊工作流整合在一個服務中。在挑選起點時，這些現成內容和託管體驗可能很有用。參見 [Canva 的模板](https://www.canva.com/templates/)和[應用市場](https://www.canva.com/apps/)。

Lolly 的工具將允許的修改編碼在內，可在瀏覽器、桌面應用或 CLI 中重複使用。一個設計可以成為[帶規則的工具](/info/create-a-tool.html)，同一個工具可以根據一張數值表生成多個輸出。lolly.work 圍繞這些工具管理訪問、共享工作和策略。

實時編輯有兩種方式：直接連線兩臺裝置的[私有協作](/info/collaborate.html)，以及透過組織的 lolly.work 例項進行的工作協作。工作協作包括共享編輯、游標和已儲存的團隊會話。當前的伺服器部署使用單個協作節點；其規模和執行歷史與 Canva 成熟的服務不同。

## 工作存放在哪裡

獨立使用的 Lolly 將創作和匯出保留在裝置上，資源就緒後可離線工作。工作協作、團隊儲存和伺服器端渲染使用組織已配置的服務。這種部署選擇正是區別所在：組織可以自行運營 Lolly 的兩個部分，沒有按席位計算的軟體許可費用，但需要為自己的託管和管理付費。

Content Credentials 對受支援的匯出檔案是可選的。lolly.work 可以使用已配置的組織身份對伺服器輸出簽名；驗證方必須信任該身份，才會將簽名者顯示為可信。參見 [Content Credentials 身份](/info/content-credentials-identity.html)和[組合方案概覽](/info/compare.html)。

Canva 是其所有者的商標。本頁說明兩種方案的重疊之處，與 Canva 無關聯。
