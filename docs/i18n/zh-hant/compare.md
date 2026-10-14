# Lolly 逐工具對比

Lolly 覆蓋的創意工作，小到單次裝置端格式轉換，大到受治理的組織級資產生產。這些頁面對比了各產品所支援的工作流、部署方式，以及選型時需要關注的限制。

_最後核查：2026 年 9 月 28 日。_

## 一個專案，兩個獨立部署的部分

**Lolly** 是用於建立、編輯、轉換和匯出的引擎、應用和工具。它在你的裝置上執行，所需資源就緒後可離線工作，獨立使用時無需賬號。

**[lolly.work](https://lolly.work)** 是本專案的組織服務，維護於 [lolly-work 倉庫](https://github.com/lolly-tools/lolly-work)。它提供 SSO、SCIM 預配、角色與策略、共享目錄與專案、審批、工作協作、使用情況報告、審計記錄和伺服器端渲染。兩部分均以 MPL-2.0 開源。組織將 lolly.work 與 Lolly 一同託管，並自行決定啟用哪些服務。

這些對比涵蓋 **Lolly + lolly.work**。需要組織服務的功能會明確標出。獨立使用時檔案保留在裝置上；選擇共享專案、工作協作、伺服器端渲染或交付時，相關資料會傳送到已配置的服務。公共 lolly.work 站點是沙盒環境；組織部署請參閱[部署指南](https://github.com/lolly-tools/lolly-work/blob/main/docs/install.md)和[當前狀態](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md)。

## 按工作流對比

- [Lolly 與 Canva](/info/compare-canva.html) - 模板、日常設計和共享的品牌製作。
- [Lolly 與 Adobe](/info/compare-adobe.html) - 編輯、轉換、專業輸出和 Content Credentials。
- [Lolly 與 Figma](/info/compare-figma.html) - 設計、實時協作和可複用的資產製作。
- [Lolly 與 Penpot](/info/compare-penpot.html) - 開源設計、共享令牌和組織工作流。
- [Lolly 與品牌門戶](/info/compare-brand-portals.html) - 已批准的素材庫、鎖定的模板、身份、稽核和報告。
- [Lolly 與渲染 API](/info/compare-render-apis.html) - 在你的裝置上、CI 中或透過 lolly.work 自動生成。
- [Lolly 與線上檔案轉換器](/info/compare-converters.html) - 在你自己的裝置上進行格式轉換。

如需逐項能力對比，請參閱[Lolly 如何對比](/info/positioning.html)。每項對比均標註日期；若某項說法已不再符合任一產品的現狀，則需要更正。
