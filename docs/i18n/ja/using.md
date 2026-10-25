# Lolly を使う

Lollyを開いて、何かを作り、残して、送りたいとします。このページでは、その流れを順に説明します。ツールを開き、変更できる部分を変更し、結果を保存して、リンクまたはファイルとして共有します。

ここにあるものはすべて、アカウントなしでお使いのデバイス上で動作し、必要なツールとアセットをダウンロードした後はオフラインでも動作し続けます。アプリを起動するには、WebGPUに対応したブラウザまたはアプリが必要です。テスト済みの環境は[対応環境](/info/supported-environments.html)に一覧があります。

## 画面の見方

::: figure using-app-map
ホーム画面: 上部に4つのタブ、下部にバーがあります。ツールを開くと、コントロールがライブプレビューの横に表示されます。
:::

ホーム画面の上部には4つのタブ**Tools**、**Utilities**、**Assets**、**Projects**が並びます。Toolsは作るためのもの、Utilitiesはファイルの変換、確認、整理などの作業台、Assetsはライブラリ、Projectsは保存したものを収めます。

下部のバーには、**Open**、**Settings**、検索欄、**Verify**、**What?**があります。Tools、Utilities、Assets、Projects、Settings、アプリ内で読むガイドで表示され、ツールを開くと脇によけます。[検索](/info/search.html)は、その欄からツール、保存した作品、アセット、設定に届きます。[Ask Lolly](/info/ask.html)は、入力した質問に、これらのガイドの該当する節で答えます。

カードをクリックすると、そのツールで新しく始まります。保存した作品は、代わりに**Projects**から開き直します。

![ナビゲーションの例とNewアクションを示すギャラリーカード](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

各ツールは分割ビューです。片側に**コントロール**、もう片側にライブの**プレビュー**があります。コントロールを変えるとプレビューがすぐに追従し、見えているものがそのまま書き出されます。

![あるツールの分割ビュー - 左側にコントロールスタック、右側に描画されるライブのグループ棒グラフ](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Design**は例外です。ボックスをドラッグ、リサイズ、入力できる自由なキャンバスとして開き、専用のトップバー、タイムライン、デッキのコントロールを備えています。ガイドは[Design: 自由なキャンバス](/info/design.html)です。

## ツールが変更を許す部分を変える

ツールには、変えることを想定した入力だけが表示されます。色、レイアウト、書体、ロジックは作者がすでに固定しているため、作るものはすべてそのルールに沿います。入力には、テキスト、スライダー、カラーピッカー、ドロップダウン、日付、画像ピッカー、繰り返しの行グループがあり、折りたたみ式のセクションに入っているものもあります。

![ツールのコントロールの列。テキスト欄、色の呼び出し、スライダーだけで、作者が固定した項目は表示されない](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**デザインをクリックして、そのコントロールを見つける。** プレビュー内の任意の要素をクリックすると、対応するコントロールにフォーカスが移り、表示位置までスクロールします。繰り返しの行グループでは、クリックした行がそのまま開きます。

コントロールの上にある**Clear changes**は、すべての入力を既定値に戻します。

**デザインシステムの選択。** デザインシステムが複数のカラーウェイ、ライトとダークの表示、その他のテーマの選択肢を提供している場合、コントロールの下の**Design system**セクションに表示されます。選択肢が表示されるのは、そのツールに影響する場合だけなので、ファイルユーティリティにはこのセクションがまったく表示されません。各カラーウェイはそれぞれの色の点で表され、ライトとダークは2つのボタン、それ以外の選択肢は一覧になります。

この選択は、その作品に属します。リンクと保存したセッションに含まれ、デザインシステムにリンクされたすべての色がそれに従い、アプリ自体の色は変わりません。Designでは、インスペクターの**Canvas**タブに同じ選択肢が表示されます。色そのものが内容であるツールは、正規のカラーウェイのままにでき、その場合はカラーウェイの点が表示されません。実際の作業でのカラーウェイは、[Lolly Demoを使う](/info/lolly-demo-in-use.html#colourways-on-real-work)で確認できます。

### プレビューのズームとパン

プレビューには、書き出される内容がそのまま表示されます。

- **ズーム:** Cmd/Ctrlを押しながらスクロール、またはトラックパッドでピンチすると、ポインターを中心にズームします。キーボードでは、`0`または`Shift+1`で全体に合わせ、`1`または`Shift+0`で100%にし、`Shift+2`で選択範囲に合わせます。`+` / `−`は、ポインターがステージ上にあるときはその位置を中心に、それ以外では表示の中央を中心にズームします。
- **パン:** **Space**を押しながらドラッグするか、マウスの中ボタンでドラッグします。通常のクリックは、デザインの各部分をクリックするために空けてあります。
- **タッチ:** ピンチでズーム、ドラッグでパン、ダブルタップで全体表示にします。
- **ズームHUD:** 隅にあるLollyのうずまきを長押しすると、`−`、**Fit**、`+`が展開します。うずまきを軽くタップすると、これまでどおりプロフィールメニューが開きます。

Designの**Fit all**は、アートボードと独立したレイヤーを含めます。手動では、ページ全体が表示領域の半分を占めるまで、20%未満にズームアウトできます。下限は、通常のFit倍率の5%と絶対倍率2%のうち、小さい方です。

出力サイズを変更すると、ビューは常にきれいに全体表示へ戻ります。

![キャンバスの隅のうずまきから展開したズームHUD: マイナス、Fit、プラス、続いてテーマと音のトグル、移動用のグリップ](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### 元に戻す／やり直す

**Cmd/Ctrl-Z**で1つ戻り、**Cmd/Ctrl-Shift-Z**(または**Cmd/Ctrl-Y**)で1つ進みます。同じ操作は、コントロールの上に**Undo**と**Redo**のボタンとしても配置されており(Designではトップバーにあります)、戻すものがなくなるとそれぞれグレーアウトします。メッセージには、元に戻した入力が表示され、その中に**Redo**ボタンがあります。

- **ドラッグは1ステップです。** 1つのコントロールへの0.5秒以内の連続した変更はまとめられるため、スライダーを端から端まで動かしても、元に戻すのは1回で済みます。
- **直近100ステップが保持されます。** 元に戻した後に新しい編集を行うと、やり直しの履歴は消去されます。
- **テキストボックスの中**では、Cmd/Ctrl-Zはそのフィールドのもので、1文字ずつ戻ります。スライダー、ドロップダウン、色、スイッチではLollyが引き継ぎます。
- ファイル入力での**ファイルの選択**はステップになりません。そのバイト列は、このセッションの間だけ保持されるためです。

ライブの[共同作業](/info/collaborate.html)でも、履歴はあなた自身のものです。もう一方のデバイスからの変更が、あなたのスタックに入ることはありません。元に戻せるのは、ツールを離れるか再読み込みするまでです。それより前のものについては、作業中に保存するツールが以前のバージョンを**History**に保持しています。[以前のバージョンに戻す](/info/find-your-work.html#go-back-to-an-earlier-version)をご覧ください。

### ライブカメラ

**Filter**ツールのエフェクト(Halftone、Scanline、Posterize、Voronoi、Duotone、Stretch、Misprint、Dither、ASCII art、Glitch)には、カメラが使える環境で**Go live**ボタンが表示されます。オンにすると、エフェクトはウェブカメラに1フレームずつ追従し、モーションの書き出しでは結果をGIF、WebM、MP4として記録します。フレームはお使いのデバイス上で処理され、カメラは停止するかツールを離れた時点で解放されます。画像ピッカーにはどれも、1フレームだけを撮る**Take a photo**もあります。

## 保存と再開

作品を残すには、レンダリングピルの**Export**の横にあるチェックマークの**Save**を押します。新しい作品は**My library**に入り、以前に保存した作品はその場で更新され、ダウンロードは行われません。書き出しパネルにも同じ**Save**ボタンがあります。

保存先を選ぶには、書き出しパネルの**Download**の横にある**Save as**を押します。**Save to a project**で、**My library**を選んだままにするか、プロジェクトを選び(**＋ New project…**で新規作成)、**Save**を押します。**Save as a template**は、デザインを新しいドキュメントの出発点となる[テンプレート](/info/templates.html)として保存します。Designでは、**Save as**はLollyメニューにあります。スマートフォンでは**•••**、**File menu**、**Save as**の順に押します。

![2分割のレンダリングピル: 書き出しパネルを開く上矢印付きのExportと、その場で保存するチェックマーク付きのSave](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> レンダリングピルの**Save**を押すか、**Save as**でプロジェクトを選びます。
- <!--i:folder--> 項目は**My library**、または選んだプロジェクトに入ります。
- <!--i:home--> 後で、左上の**Home**を押して**Projects**タブを開きます。
- <!--i:document--> 項目を開きます。すべての設定が元に戻り、変更して再び書き出せる状態になっています。
:::

項目名は、書き出しパネルに入力したファイル名、またはなければ**QR Code**のようなツール名になります。**Download**で得たファイルは完成したコピーです。後で変更するには、Projectsで保存した項目を開いてください。

個人の保存内容は、[同期](/info/sync.html)をオンにしないかぎり、保存したブラウザまたはアプリのこのデバイス上にとどまります。思った場所にない場合は、閉じたタブからブラウザデータの消去まですべてのケースを[作品を探して復元する](/info/find-your-work.html)で扱っています。

::: details Lolly Workのチームプロジェクト(任意)
[組織がLolly Workを使っている](/info/organisation.html)場合は、そのインスタンスにサインインし、**Projects → Team projects**を開くと、共有されたセッションがあります。アクセスと保持は組織が設定し、それらのセッションはLolly Workサービスが保存します。組織がライブ編集を許可している場合、共有セッションは開くと同時にそのライブコラボに参加します。手順は[一緒に作業する](/info/collaborate.html#work-collabs-with-lolly-work-optional)で説明しています。

個人のライブラリは別のままです。別のデバイスでサインインするとチームの作業は手に入りますが、個人の保存内容を移すには、引き続き同期かバックアップが必要です。
:::

## 作ったものを共有する

デザインは、リンクまたはファイルとして送り出されます。書き出しコントロールの**Share**は両方を提示するダイアログを開き、Projectsの保存済みセッションの**Share link**は、そのセッション用に同じダイアログを開きます。

::: cols
## リンク

- すべての入力をアドレスに含めるため、リンクでデザインを再現できます。
- このデバイスから追加した画像やファイル、非常に長いテキスト、非常に大きなリストは含まれません。
- どのブラウザでも開けるため、リンクをブックマーク、貼り付け、コミットできます。

## .lollyファイル

- 保存したセッションを、このデバイス上の画像やファイルとともに含み、ツールとデザインシステムも含められます。
- ファイルを含めると選ばないかぎり、ライセンス付きのカタログ作品は含まれません。
- Lollyで開きます。ダブルクリックするか、**Open**を使うか、アプリにドロップします。
:::

### リンク

すぐコピーできるリンクはダイアログの上部にあり、**Copy**と、そのリンクでQR Codeツールを開く**QR**ボタンがあります。リンクの下の**Link options**には次のものがあります。

- **Open in the installed app**は、リンクをショートカット、ランチャー、自動化向けの`lolly://`アドレスに切り替えます。パラメーターはそのままです。
- **Shortest link**は、長いデザインをコンパクトなトークンにまとめ、短縮できた文字数を表示します。読みやすい形式も常に用意されています。
- **Password-protect this link**は、AES-256でリンクをお使いのデバイス上で暗号化します。パスワードがリンクに含まれることはありません。
- **Pin this tool version**は`_v`フラグを追加するため、後のツールの更新でリンクのレンダリング結果が変わることはありません。
- **When the recipient opens the link…**では、全画面表示、展開済みの書き出しパネル、開いたときのダウンロード(`&export`)、クリップボードへのコピー(`&copy`)を選びます。
- **Copy credit**は、投稿やスライド用に、リンクとともに「Made with Lolly」のキャプションをコピーします。

ツールにお名前などの個人用フィールドがある場合、**Review personal fields**は、そのフィールドにチェックを入れるまで、各項目をリンクに含めません。リンクが運べるものはすべて[URLモード](/info/url-mode.html)で説明しています。

**ダイアログは、リンクが運べないものを伝えます。** このデバイスから追加した画像やファイル、非常に長いテキスト値、非常に大きなリストは、アドレスに収まりません。リンクを作る際にそれぞれが数えられます。何かを除外せざるをえなかった場合、ダイアログはそれを一覧にし、画像が欠けたまま開くリンクを渡すのではなく、ファイルのオプションを案内します。長いだけのリンクには、文字数付きのより穏やかな注記が表示されます。

**リンクが製品のすべてになるツールもあります。** Jump Pageは、配布用に複数のリンクを1ページにまとめます。プロフィールリンク、講演、ショップの入口などです。ページ自体がリンクなので、ホスティングもアカウントもありません。訪問者は全幅で表示され、スクロールするとシーンごとに1つのリンクが現れます。

![エディター内のJump Page: ページ上部の見出しシーンと、その下のリンクシーン](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Lolly Workの組織管理リンク
有効期限、取り消し、パスワードが必要な共有には、Lolly Workが、共有セッション、ツール、カタログアセットへの管理リンクを提供します。これらは組織のサービスを通して解決され、そのアクセスルールに従います。上記の自己完結型のリンクとは別物で、リンクを取り消しても、すでに誰かがダウンロードしたファイルを回収することはできません。リンクの種類と権限は[レンダリングと共有](/info/manage/sharing.html)に一覧があります。
:::

### .lolly ファイル

共有ダイアログの**Editable file**セクションにある**Download .lolly**は、現在のデザインを1つのファイルとして書き出します。保存したセッションを、このデバイス上の画像やファイルとともに含み、通常のカタログ作品も一緒に含まれます。古いファイルや利用できないファイルは、消えるのではなく外部参照のまま残ります。保存する前に、ダイアログはファイルのサイズ、埋め込むファイルの数、参照するファイルの数、ツールが含まれるかどうかを表示します。デバイスに共有シートがある場合、**Send to…**がファイルをそのまま渡します(AirDrop、Androidの共有)。

**Projects**のフォルダのメニューにある**Download project (.lolly)**は、フォルダ全体を書き出すため、他の人がフォルダ内のすべてのセッションの続きを作業できます。バッチセッションは含まれず、通知にその件数が表示されます。同じメニューの**Download originals**は、各項目を単独のファイルにした通常のzipを書き出します。

ファイルを送り出す前に、お客様が決める点が3つあります。

- **名前を含めるかどうか。** お名前、メールアドレス、組織名が書き込まれるのは、[プロフィール](/info/profile.html)で**Use my details to create**がオンのときだけです。オフの場合、ファイルにはLollyで作られたことと、その日時だけが記録されます。
- **保留中の作品を含めるかどうか。** ライセンス付きの作品、ブランドロックされた作品、ライセンスが記録されていないカタログ作品は、既定では含まれません。デザインにそれらが使われている場合、ダイアログはその数を示し、*Download without them*か*Include and download*を提示します。含めると、`.lolly`を開く人にそのファイルを渡すことになるためです。ファイルの`CREDITS.txt`には、含まれたものと含まれなかったものが、その理由とともに一覧になっています。ルールは[クリエイティブの権利とクレジット](/info/creative-rights.html)で説明しています。
- **ツールを含めるかどうか。** **Include the tool**は、ツール自身のファイルを同梱するため、そのツールがないデバイスでもデザインを開けます。フォークなどのカスタムツールでは最初からチェックが入り、署名付きカタログに載っているツールではチェックが外れています。署名付きカタログのないビルドでは、すべてのツールがカスタム扱いになります。

**開く。** デスクトップアプリとモバイルアプリでは、`.lolly`をダブルクリックまたはタップするか、**Open with Lolly**を選ぶか、共有シートからLollyに送ります。Webアプリでは、**Open**を押すか、ファイルをLollyにドロップします。どの経路でも、まずファイルのマニフェストを読み取り、何かが書き込まれる前に、サイズ、内容、これから起こることを表示します。

ファイルに、お持ちでないツールが含まれている場合、**Trust this tool?**にそのツールと作者が表示され、開くとそのツール自身のコードがお使いのデバイス上で実行されることが示されます。**Trust & install**で進みます。辞退しても、作品はProjectsに保存され、そのツールを追加する日を待ちます。コードがモジュールとして提供されるツールは、まだこの方法ではインストールできず、同じように辞退扱いになります。

::: details .lollyに含まれるものと、開いたときの動作
`.lolly`はLollyのバンドルの拡張子で、`manifest.json`内の`format`が、中身が何かを示します。

- **共有デザイン**(`lolly-share`)には、保存済みセッション1つ、埋め込まれたファイル、参照によってまだ解決されるものの受領記録が含まれます。ツールとデザインシステムも含めることがあります。開くと新しいプロジェクトが追加され、セッションが上書きされることはありません。
- **共有プロジェクト**(`lolly-share`、種類は`project`)には、Projectsのフォルダが含まれます。サブフォルダ、その中のすべてのセッションとそのタイル、そこに置かれた画像です。開くとフォルダ全体のコピーが追加されます。各セッションは`sessions/<key>.json`として、タイルは`thumbs/`の下に格納されます。プロジェクトファイルが登場する前のLollyでは、更新を求められます。
- **デザインシステムパック**(`lolly-brand`)には、トークンが含まれ、フォント、ロゴ、公開済みバージョン、保持されたリソースが含まれることもあります。パックを開くと、名前を持つ別のデザインシステムが追加され、そのシステムが有効になります。
- **ワークスペースまたはインスタンスのパック**は、宣言されたツール、カタログアセット、場合によってはインスタンスのアドレスを持つ`lolly-brand`です。読み込むと、それ以前に読み込まれていた単一のワークスペースオーバーレイが置き換わり、プレビューにはそのデバイス全体への影響が一覧表示されます。

デバイス全体のバックアップは`.lolly`ではありません。`LollyTools-….zip`(形式は`lolly-backup`)のままで、**Settings → Storage → Import data…**から復元します。zip化したツールフォルダも`.zip`のままです。形式の仕様は[データ移行](/info/data-transfer.html)をご覧ください。

`.lolly`は通常のzipです。拡張子を`.zip`に変えれば中を確認できます。ご自身の画像は`assets/uploads/`、カタログ作品は`assets/catalog/`の下にあり、`manifest.json`がすべてのファイルを一覧にし、READMEがそのファイルが何かを説明しています。

macOS、Windows、Linux、iOS、Androidはいずれもこの形式を登録し、デスクトップのファイルマネージャーはLollyのドキュメントとして表示し、GNOME Filesは保存済みセッション固有のサムネイルを表示できます。Design System Setupから開くと、共有デザインにデザインシステムの操作が含まれている場合はそれを推奨しますが、**Open shared design**が隠れることはありません。

iOSまたはAndroidで他のアプリから渡されたドキュメントは、受け渡しでバイト列がアプリの境界を越えてコピーされるため、48 MBが上限となり、アプリがその旨を表示します。Lolly内の**Open**にはそのような上限がないため、それより大きなバンドルにはそちらを使ってください。

確認すると、Lollyはバンドルを一度だけ展開して検証します。アセットはライブラリに入り、チェックサムで照合されるため、すでにデバイスにあるファイルは再利用されます。セッションは新しいIDでProjectsに入るため、同じファイルを2回開くこともできます。ツールがないセッションは、そこで待機します。100 MBを超えるファイルは大きなものとして示され、ブラウザのストレージの空き容量がファイルに必要な量より少ないと報告された場合、プレビューが警告します。整合性の対象となるすべての部分は、何かが確定される前に検査され、壊れたコピーは何も残さずに拒否されます。
:::

リンクもファイルも、スナップショットを渡すものです。ライブ編集については、2台のデバイス間のプライベートコラボと、Lolly Workを通した任意のワークコラボを[一緒に作業する](/info/collaborate.html)で扱っています。

## アセット - 自分のライブラリー

**Assets**(`#/a`)には、ツールが使えるすべてのもの(ブランドのロゴ、画像、音声、モーション)が種類別にまとまり、ご自身のファイルも並びます。アップロードしたものは、お使いのデバイスに保存されます。Lolly Workを使う組織は、自らのアクセスルールのもとで共有カタログを提供することもできます。[組織でLollyを使う](/info/organisation.html)をご覧ください。

![アセット。ブランドのスウォッチとフォント、自分でアップロードしたもの](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **ファイルを取り込む。** 画像、SVG、音声クリップ、動画、Lottie、PDF、PowerPointのデッキをアップロード領域にドロップするか、クリックして選びます。すぐにAssetsと、すべてのツールのアセットピッカーに現れます。複数ページのPDFや`.pptx`では、残すページやスライドを尋ねられ、それぞれがSVGアセットになります。ツール内で追加した画像は、届いたままの状態で**My images**に保持されるため、それに付いたContent Credentialも引き続き検証でき、非常に大きなファイルについてだけ、サイズ変更するかどうかを尋ねられます。**My images**の保持量は**Settings → Storage**に表示されます。デバイスのストレージ以外の上限はありません。画像の取り込み時にEXIFとGPSのデータを消去するには、**Settings → Feature flags**で**Strip metadata from uploads**をオンにします。Content Credentialsは、どちらの場合も保持されます。
- <!--i:star--> **よく使うものをお気に入りに。** アセットやブランドのスウォッチにスターを付けると、すべてのピッカーの先頭に固定されます。
- <!--i:folder--> **整理する。** アセットを別のグループに移す、使わない共有ブランドアセットを非表示にする(**Show hidden**で元に戻る)、ご自身のアップロードを削除する、ができます。Projectsと同じ選択バーが、選択範囲全体に対して動作します。
- <!--i:layers--> **動画を背景から切り離す。** 動画の詳細を開くか、アセットピッカーでそのカードを右クリックして、**Remove background…**を選びます。**On-device model**は、雑多な場面から被写体を切り抜きます。**Colour key**は、グリーンバックなどの均一に照らされた背景を取り除き、端の処理に**Tolerance**、**Softness**、**Spill removal**があり、ダウンロードは不要です。**Resolution**(360、480、720、1080p。元の解像度は超えない)は、精細さと速度のトレードオフです。切り抜き結果は、実際の透明度を持つアニメーションWebPまたはPNGとして元のファイルの隣に保存され、元の素材のContent Credentialが素材として引き継がれます。これが通常の編集であり続ける理由は、[一度だけ生成し、同じように描画する](/info/ai-features.html)で説明しています。

### パレットとフォントをどこへでも

Assetsの**Swatches**パネルには、ブランドを構成する色が表示されます。ブランドカラー、追加した色、ランプ、スペクトラムです。インターフェース用にLollyが保持する役割の色(テキスト、サーフェス、境界線、カラーウェイのリード、別名で保持されたブランドカラーのコピー)は、パネルの下部にあるグレーの**Show colour roles**カードの奥にあります。

各色は、他のアセットと同じカードです。クリックして詳細を開き、いくつかを選んでそれだけをダウンロードするか、他のツールが読み込む形式でパレット全体をダウンロードできます。

- <!--i:code--> **Design tokens (JSON)**、**CSS variables**、**CSS classes**: スタイルシートやビルド向け。sRGBより広い色は広い値のまま保持されます。CSSではhexの後に設定され、JSONではhexに、広い色、CMYKビルド、スポットインクが添えられます。
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**: IllustratorやPhotoshop向け。CMYKビルドに固定された色はそのCMYKスウォッチとして、スポットインクは名前付きのスポットスウォッチとして、sRGBより広い色はLabとして渡されます。
- <!--i:pentool--> **GIMP palette (.gpl)**: GIMPやInkscape向け。**SCSS variables**もあります。どちらもsRGBです。

![Swatchesパネル: 上部に5つのパレットダウンロードボタン、その下にすべてのブランドカラーが、詳細を開くチップとして並ぶ](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

各カードのドットで色を選びます。2つ目のドットをShiftクリックすると間のすべてが選ばれ、隙間をまたいでボックスをドラッグするか、カードにフォーカスがある状態でCmd/Ctrl+Aを押すこともできます。バーには、同じ6つの形式の**Download as…**、**Copy hex**、**Favourite**が表示されます。形式を選ぶ前に、メニューには、どの形式でも扱えない色(Transparentには色がまったくありません)、広い色をsRGBの代替値として保存する形式(SCSSとGIMP)、CMYKとスポットの値を保持する形式(JSONと.ase)が一覧になります。カードを右クリックすると、1色に対して同じ操作ができます。

色の詳細はプレビューをその色で満たし、**Linked values**(CMYKビルドまたはスポットインク、特定の色空間や印刷機向けに設定された値、デザイントークン)、**Every notation**(hex、OKLCH、Display-P3などを、それぞれコピーボタン付きで)、**Plotted on a colour space**、**Tones**、**Readability**が展開できます。矢印キーでパレットを順に移動でき、**Copy link**は色そのものを共有し、**Open in Colour Lab**はさらに先へ進めます。

**Fonts**パネルには、ブランドの書体が一覧になり、それぞれに**download**があります。ローカルにインストールしたり、印刷会社に渡したりするためのものです。

## グリッドを自分好みにする

- <!--i:star--> **よく使うものをお気に入りに。** カードを右クリックして**Add to favourites**を選ぶと、グリッドの上のストリップに大きなタイルとして表示されます。ストリップについては[お気に入り](/info/favourites.html)で説明しています。
- <!--i:eyeoff--> **使わないツールを隠す。** カードを右クリックするか、複数を選択して、**Hide tool**を選びます。グリッドからも、グリッドへの入力で見つかるものからも外れます。末尾のグレーの**Show hidden tools (N)**タイルで、減光された状態で再び表示され、それぞれのメニューに**Unhide tool**があります。非表示にするとあなたのグリッドが変わるだけで、ツールはリンクやブックマークからは引き続き開きます。
- <!--i:clock--> **あなたのツールを先頭に。** 3つの異なるツールで作品を保存すると、グリッドの上に**Yours**のチップ行が現れ、お気に入りと最近のツールが先頭に並びます。
- <!--i:sliders--> **好みのレイアウトにする。** **View options**で、レイアウト(**Grid**、**Card**、**List**)、カードのサイズと密度、並び順、カテゴリのフィルターを設定します。

![非表示のツールを表示したToolsグリッドの末尾: 減光されたWordmarkカードと、その横にある、表示を切り替えたグレーのタイル(現在はHide hidden toolsと表示)](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed the tile. The alt says so rather than quoting the resting
label the prose above already gives.
The recipe hides nothing itself. The lolly-demo catalog the captures pin
ships Wordmark hidden (`defaultHiddenTools` in its assets index.json), so a
fresh profile already has one hidden tool and the recipe only clicks the grey
reveal tile (`.gtile--hiddenbox`, confirmed in gallery.ts). It used to tick
the QR Code card and press the bulk bar's Hide button first; under lolly-demo
that published Wordmark dimmed and QR Code not, under a caption naming QR
Code, so the steps were dropped rather than relied on. QR Code was hidden
in that run too: the End scroll had left the pointer over its card, and a
hovered hidden card lifts its dimming (gallery.css), so it read as a normal
tool. The closing `hover:` puts the pointer back on the reveal tile, which
keeps every revealed card dimmed.
-->

**複数のカードをまとめて操作する。** 各カードのチェックボックスにチェックを入れるか、空いている場所で選択ボックスをドラッグするか、Shift/Cmdクリックすると、そのビューで可能な操作のバーが表示されます。

- **ToolsとUtilities:** Favourite、Hide、Available offline、**View sessions**(Projectsで、それらのツールで作ったセッションだけを表示)、単一カードのCopy link。
- **Assets:** 任意の選択に対するFavouriteとHide。Duplicate、Download、Deleteは、選択した項目がすべてご自身のアップロードである場合にのみ表示されます。共有デザインシステムのアセットは恒久的な契約であるためです。
- **Projects:** [作品を探して復元する](/info/find-your-work.html#find-something-you-saved)をご覧ください。

![2つのツールに対するギャラリーの選択バー。Available offline、View sessions、Favourite、Hideが並ぶ](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
<!--
SHOT NOTE (misc-bulkbar-gallery): drive targets `[data-select="qr-code"]` /
`[data-select="gradient"]` - the `.tile-check[data-select="<ref>"]` checkbox button
confirmed directly in views/gallery.ts's card markup (the same attribute
cardMarkup gives every tile), so these two clicks tick both cards without
opening either tool.

SHOT NOTE (misc-sessions-by-tool, NOT PUBLISHED): the "View sessions" result
had a recipe of its own (`/#/p?tools=qr-code,d3`, views/projects.ts's
toolsBodyHtml()), dropped here because it has no `drive=` that can
manufacture its own content - a saved session isn't a click away, it has to
already exist, and build-docs-shots.ts gives every shot a fresh
`browser.newContext()`. It would publish an empty list. Same dependency the
`projects` shot (now on find-your-work.md) carries; revisit if the pipeline gains a
storage-seeding hook.
-->

**View sessions**は、何かを選択したときだけ表示されます。選択していないカードを1枚右クリックすると、代わりに**N saved sessions**が表示され、そのツールの保存済みセッションの一覧が出て、削除するとセッションはごみ箱に移動します。

## スマートフォンでの表示

画面が狭い場合、レイアウトは1列になります。

- **コントロールは上部のシート**になり、下端にドラッグ用のグリップがあります。グリップをドラッグして**peek**、**half**、**full**に切り替えるか、タップして折りたたみ、展開します。プレビューは下の空きスペースを満たし、編集中も表示されたままです。
- フローティングの**Export**ボタンで書き出しシートが開きます。形式、サイズ、コピー、保存、ダウンロードを1か所にまとめたものです。背景をタップするとシートが閉じます。

![スマートフォン幅の画面でのツール。上部にシート状のコントロール、下のプレビューを埋める生成されたパレット、下部中央に浮かぶレンダーピル](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## 設定、サウンド、快適さ

ホーム画面下部の**Settings**には、お客様の詳細、デザインシステム、アクセシビリティ、ストレージ、オフラインダウンロードがあります。各タブの全体像は[Settings](/info/dashboard.html)にあります。

- **お名前と顔写真**は、メール署名やバッジなど、それらを使うように作られたツールで自動入力されます。詳細は[プロフィール](/info/profile.html)をご覧ください。
- **アクセシビリティ**には、**Reduce motion**、**Hide colourful previews**、**High contrast**、**Large text**の4つの快適さスイッチがあります。これらが変えるのは作業の周りのアプリであり、ツールのキャンバスや書き出しは変わりません。
- **Sound**は、操作に対してやさしい補助音を鳴らし、**Neurospicy Mode**は落ち着いた集中用のトラックを再生します。どちらも**Settings → Accessibility**またはプロフィールメニューでオンにするまではオフです。
- **Available offline**は、接続が切れる前に、アプリの残り、ツール、カタログ、ガイドをダウンロードします。Lollyはインストールできるウェブアプリです。ブラウザのインストールボタン、またはスマートフォンでは*ホーム画面に追加*を使うと、全画面のアプリとなり、オンラインに戻ると自動的に更新されます。
- **Storage**には、Lollyがこのデバイスに保持しているものが表示されます。消去で何が削除されるかは[ブラウザデータを消去した場合](/info/find-your-work.html#if-you-clear-your-browser-data)で説明し、アプリが取得または送信するすべてのものは[プライバシーポリシー](/info/privacy.html)に一覧があります。

::: note 更新後にビューが読み込めない場合
更新の直後に空白のパネルや「failed to fetch」というメッセージが表示されても、通常は一度の再読み込みで解消します。保存した作品、セッション、デザインシステムはお使いのデバイスに保存されているため、影響を受けません。追加したものの保存していない画像だけは、もう一度追加が必要な場合があります。
:::

## 次に進む先

- **[Design: 自由なキャンバス](/info/design.html)**: キャンバス、図形、タイムライン、デッキのプレゼンテーション。
- **[BatchとMulti-edit](/info/batch.html)**: 1つのデザインの多数のバージョン、または保存した複数のデザインをまとめて編集する。
- **[ファイルを書き出す](/info/exporting.html)**: 形式、サイズ、印刷の単位、透明度、動画の選び方。
- **[デザインを取り込む](/info/design-import.html)**: Figma、Penpot、Illustrator、InDesignのファイルをDesignに取り込み、編集を続けます。
- **[テンプレート](/info/templates.html)**: ツールの保存済みの出発点。
- **[広色域とHDR](/info/hdr-editing.html)**: DesignとDarkroomで、元の画像の精度を保ちます。
- **[作品を探して復元する](/info/find-your-work.html)**: すべてがどこにあるか、別のデバイスへ移す方法。
