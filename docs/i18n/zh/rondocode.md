# Lolly Rondocode 歌曲

<a id="rondocode-songs"></a>

rondocode 歌曲是以程式碼寫成的音樂：合成器、樂句模式與混音，隨你輸入即時播放。Lolly 可以在影片下播放歌曲，**Rondocode** 工具程式則可撰寫歌曲並匯出為音訊；兩者都會在檔案的 Content Credentials 中記錄歌曲。

<!--i:eti-music-->
## 在 Lolly 中播放歌曲

素材選擇器接受 `.rondo` 或 `.rondo.json` 歌曲檔案，也接受貼上的 `rondocode.com` 分享連結。歌曲會依片段要求的任意長度播放。它可以作為影片匯出下的**背景配樂**，也可以在 Neurospicy Mode 的環境播放器中播放。

歌曲程式碼在 Lolly 的沙箱中執行，沒有網路，也無法存取你的檔案。渲染無法播放的任何部分，例如即時麥克風，或缺少語音模型的歌聲，都會列在素材的詳細資料中。

在終端機中，`lolly mix` 可將歌曲作為整段配樂；請見 [CLI 渲染](/info/cli-rendering.html)。

<!--i:eti-code-->
## 撰寫與匯出歌曲

從 **Utilities** 開啟 **Rondocode** 工具，即可在 rondocode 的即時編輯器中撰寫歌曲，邊輸入邊聆聽。可匯出為 **WAV**、**MP3**、**M4A**、**Opus** 或 **FLAC**，也可匯出為分軌 ZIP、**MIDI**，或目前播放內容的錄音。在終端機中，`lolly rondocode --export=mid` 會寫出相同的 MIDI 檔案。**Export length** 設定音訊匯出的秒數。歌曲檔案（`.rondo.json`）就是你原樣寫下的程式碼，不會加入任何內容。

歌曲可以用 `sing()` 唱出歌詞。下載的語音模型會在你的裝置上產生歌聲。含有合成歌聲的檔案一律會宣告歌聲由 AI 產生（請見 [AI 功能](/info/ai-features.html)）。

<!--i:eti-badge-check-->
## 憑證中的歌曲

播放 rondocode 歌曲的影片或音訊匯出，會在 Content Credentials 中將每首歌曲記錄為來源：

- 歌曲名稱；
- 其 `.rondo.json` 檔案的 SHA-256；
- 渲染方式：在 Lolly 的沙箱中，使用 `vm` 執行類別，並記錄渲染器版本與種子，以及渲染無法播放的任何部分。

從歌曲程式碼計算出的音樂會標記為演算法媒體，因此 Lolly Verify 不會將它標記為 AI。匯出前，**Download** 下方的一行文字會列出憑證將記錄的歌曲。匯出後，同一行會回報讀取已交付檔案時找到的內容。取消勾選 **C2PA Credentials** 即可省略記錄。靜態圖片不會記錄歌曲，因為它沒有聲音。靜態圖片不會記錄歌曲。`lolly mix` 與 [MCP 伺服器](/info/mcp.html)會寫入相同的記錄。

<!--i:eti-file-->
## Rondocode 工具程式產生的檔案

大多數裝置上的工具程式不會寫入憑證，因為它們轉換的是你已擁有的檔案。Lolly Rondocode 會製作新音訊，因此它寫出的每個音訊檔案都帶有 Content Credentials，將歌曲記錄為來源：WAV、MP3、M4A、Opus、FLAC、分軌 ZIP 中的每個分軌，以及目前播放內容的錄音。

- 編輯器自己的渲染在其私有框架中執行（`frame` 執行類別），並記錄編輯器版本。
- 由 CLI 或分享連結產生的渲染，使用 `vm` 類別執行，並記錄渲染器版本與種子。
- WAV 也會在 RIFF 註解中聲明相同內容。

歌曲有歌聲時，AI 聲明可由機器讀取。憑證的數位來源類型是使用受訓模型製作的複合媒體，記錄會列出有歌聲的部分，並為每個模型加入一項 C2PA AI 揭露，識別歌聲經過的每個模型：Supertonic-3 文字轉語音、wav2vec 2.0 音素對齊器、ContentVec 編碼器與 RVC 聲音，以及 Lolly 託管該模型所依據的儲存庫與提交版本。

### MIDI 檔案包含的內容

MIDI 檔案是格式 1 的 Standard MIDI File。第一條軌道包含速度與 4/4 拍號，之後每個合成器各有一條以該合成器命名的軌道。每個音符都保留起點、長度與力度。名稱可辨識為樂器的合成器，例如貝斯、弦樂、鋪底音色或鋼琴，會取得對應的 General MIDI 樂器，名稱像鼓的則放在第 10 頻道。非十二音的調律會四捨五入到最接近的半音，並加上音高彎曲。

MIDI 檔案無法容納合成器設定、濾波器、效果、匯流排、取樣或歌聲，因此 DAW 會用自己的樂器播放音符。速度取自歌曲的每秒循環次數，以一個循環代表四拍的一個小節，因為渲染器回傳的內容不包含歌曲本身的拍號。

MIDI 檔案沒有可放入憑證的位置，因此檔案中的文字事件會攜帶聲明，匯出面板也會告知你。面板會在匯出前說明這一切。每次匯出後，編輯器會讀回已儲存的檔案，只回報該次讀取找到的內容。

關於 Content Credentials 一般會記錄什麼，請見[匯出檔案](/info/exporting.html#content-credentials-c2pa)。
