# 在你的組織中使用 Lolly

你的組織可以運行自己的 Lolly：同一個應用程式，搭配它所選擇的工具與設計系統。本頁說明如何連到它、登入，以及登入後有什麼不同。

::: note 你需要向組織取得的東西
它的 Lolly 網址，或是你的組織製作的 `.lolly` 設定檔。lolly.tools 本身不會連線到任何組織。
:::

## 在瀏覽器中

開啟你的組織給你的位址。如果頁面要求登入，請按下 **Sign in**，並依它開啟的登入頁面操作。之後它就像任何 Lolly 一樣運作，搭配你組織的工具與設計系統。

你也可以從 lolly.tools 開始：開啟 **Settings**，在 **Lolly instance** 卡片上按下 **Open a workspace**，輸入位址後按下 **Open this instance**。瀏覽器會前往你組織自己的位址，因為瀏覽器無法從 lolly.tools 載入另一個 Lolly 的工具。

![Settings 中的 Lolly instance 卡片，在此開啟你組織的工作區，或更改應用程式取得工具的來源](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

## 在桌面版或行動版應用程式中

應用程式一開始使用其內建的工具。若要連線，請開啟 **Settings**，在 **Lolly instance** 卡片上按下 **Change**。該面板會問 **Where should Lolly get its tools?**

1. 選擇**連線至 Lolly 執行個體**。
2. 輸入你的組織的網址，然後按**檢查並連線**。
3. 按**使用此執行個體**。接下來的畫面**匯入你的資料（選填）**會把已儲存的作品從 Lolly 備份中帶過來；如果沒有，按**略過**。
4. 如果應用程式要求，請登入。

來自已連線執行個體的工具，執行時享有和應用程式自帶工具相同的信任層級，因此只連線到你信任的執行個體。你的組織也可能改為傳給你一個 `.lolly` 設定檔，替你完成應用程式的連線。

之後若要切換，再次使用 **Change**，或使用同一張卡片上的 **Leave**。

### 以代碼登入

在桌面與行動應用程式中，當你組織的 Lolly 支援代碼登入時，登入畫面也會提供一組短代碼。按下 **Open sign-in in browser**，在那裡登入並核准該代碼。或者在你已登入的手機或電腦上開啟它顯示的位址，輸入代碼。代碼約有十分鐘的有效期。

## 那裡有什麼不同

- **有些控制項已為你設定。** 由你的組織管轄的控制項會顯示 **Managed by** 與組織名稱，或 **Managed by your organisation**。固定的控制項無法更改，選單可能只提供部分選項，而以 **Set by** 開頭的一行可以說明適用哪條規則及原因。有些控制項則完全不顯示。
- **有些設計系統已鎖定。** 由你的組織提供的設計系統會顯示鎖頭並保持唯讀。若要嘗試變更，請在 **Settings → Preferences → Design systems** 建立一份可編輯的副本。
- **只列出它的工具。** 你的組織未提供的工具完全不會顯示。
- **共用專案。** 如果你的組織與你共用專案，**Projects** 會顯示 **Team projects** 方塊。這些工作階段存放在組織的伺服器上。開啟其中一個即可進行工作，或在可用時從 **Share** 開始[工作協作](/info/collaborate.html#work-collabs-with-lolly-work-optional)。
- **有些匯出可能需要核准。** 在你的組織要求核准之處，**Request approval** 會取代 **Download**，工具提供的格式也可能較少。

### 什麼存在哪裡

::: cols
## 在這部裝置上

- 你自己的儲存內容，除非你開啟[同步](/info/sync.html)
- 你自己建立的設計系統
- 你製作並下載的一切

## 在你組織的伺服器上

- 你的登入身分與裝置資訊
- 團隊專案、共用工作階段，以及工作協作中的即時編輯
- 你上傳到共用資料庫的素材
- 核准請求與已核准的交付
- 使用事件，在你的組織開啟它們時
:::

[隱私](/info/privacy.html#organisation-services-with-lolly-work)列出伺服器儲存什麼，以及誰控制這些資料。

## Lolly Work 增加什麼

你組織的伺服器運行 **Lolly Work**，這是同一個開源專案的組織版軟體。你自己使用時，應用程式既不需要工作帳號，也不需要 Lolly Work。

::: details Lolly Work 可以增加什麼
你的組織會在 Lolly 旁邊託管 [Lolly Work](https://github.com/lolly-tools/lolly-work)，並選擇開啟哪些功能：

- **登入與存取。** 組織單一登入、以群組為基礎的權限，以及受管理的個人資料欄位。管理員可以透過 SCIM 佈建與停用帳號。
- **共用工作。** 團隊專案、共用工作階段與[工作協作](/info/collaborate.html#work-collabs-with-lolly-work-optional)，經由組織的伺服器即時編輯。
- **共用素材庫。** 上傳的素材、集合與已連接的資料庫，附有存取規則、版本與審閱。
- **審閱與交付。** 核准步驟、可設定到期或撤銷的受管理連結，以及交付到組織允許的目的地。
- **管理。** 依實例遙測政策的使用情況回報，以及受管轄動作的稽核記錄。

如果你正在設定此服務，請從[部署](/info/deployment.html#organisation-services-with-lolly-work)開始。[lolly.work](https://lolly.work) 上的公開示範是沙箱；對於需要保存的工作，請使用你組織自己的位址。
:::

## 離開

**Settings** 中 **Lolly instance** 卡片上的 **Leave** 會移除你組織的設計系統、工具與目錄。你自己的作品會保留。你用其工具製作的任何內容，在你重新連線之前都無法再開啟。

你儲存到組織的任何內容都會留在組織，適用其存取與保留政策。離開或清除這部裝置不會刪除伺服器上的那份副本。在你組織自己位址的瀏覽器中沒有什麼可以離開的：請改為開啟不同的位址。

## 該問誰

什麼內容會送到你組織的伺服器、誰能看到其共享專案、哪些設定是固定的，這些都由你的組織決定。請詢問負責執行你組織的 Lolly 的人。[隱私](/info/privacy.html)說明了 Lolly 本身如何處理你的資料。
