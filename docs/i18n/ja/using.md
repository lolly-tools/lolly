# Lollyを使う

ツールを開き、変更可能な部分を変えたら、結果を保存してリンクやファイルで共有します。

すべての処理はアカウントなしでデバイス上で動作し、必要なツールとアセットをダウンロードすれば、オフラインでも使えます。起動には、WebGPUに対応したブラウザまたはアプリが必要です。検証済みのものは[対応環境](/info/supported-environments.html)に記載しています。

**一連の流れ**は、次の4ステップです。

::: steps
- <!--i:eti-home--> **[ツールを開く](#find-your-way-around)** ホーム画面のカードをクリックします。ライブプレビューの横にコントロールが表示されます。
- <!--i:eti-sliders--> **[入力を変更する](#change-what-the-tool-lets-you-change)** 変更できるのは、作者が入力可能にした項目だけです。デザインをクリックすると、そのコントロールが見つかります。
- <!--i:eti-folder-plus--> **[作品を保存する](#saving-continuing)** **Save**でMy libraryに保存し、Projectsから開き直します。
- <!--i:eti-link--> **[デザインを共有する](#sharing-your-work)** すべての入力を含むリンク、または1つの`.lolly`ファイルを使います。
:::

<!--i:eti-home-->
## 画面の見方

::: figure using-app-map
ホーム画面には、上部に4つのタブ、下部にバーがあります。開いたツールのコントロールは、ライブプレビューの横に並びます。
:::

ホーム画面の上には、**Tools**、**Utilities**、**Assets**、**Projects**の4つのタブがあります。Toolsは制作に使います。Utilitiesはファイルを変換、確認、整理します。Assetsはライブラリです。Projectsには保存した作品が入ります。

下部のバーには、**Open**、**Settings**、検索欄、Lolly Verifyへのショートカットの**Verify**、このガイドを開く**Docs**があります。バーはTools、Utilities、Assets、Projects、Settings、アプリ内のガイドで表示され、ツールを開くと非表示になります。[Lolly Search](/info/search.html)では、その検索欄からツール、保存した作品、アセット、設定を探せます。[Ask Lolly](/info/ask.html)は、入力した質問に対し、このガイドの該当する節を示して答えます。

カードをクリックすると、そのツールで新しい作品を作り始められます。保存済みの作品を開き直すには、**Projects**を使います。初回は、ギャラリー上部の案内帯に、始めるためのアクションが1つ表示されます。Lolly Demoを使う場合は**Start making**、独自のデザインシステムを設定する場合は**Make it yours**です。

![例を切り替えるナビゲーションとNewアクションがあるギャラリーカード](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

各ツールの画面は2つに分かれ、片側に**コントロール**、反対側にライブの**プレビュー**が表示されます。コントロールの変更に合わせてプレビューが更新され、その見た目のまま書き出されます。

![ツールの分割ビュー。左にコントロールが並び、右にライブ描画されるグループ棒グラフが表示されている](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Lolly Design**だけは例外で、ボックスをドラッグ、リサイズしたり、文字を入力したりできる自由なキャンバスです。独自のトップバー、タイムライン、デッキのコントロールを備えています。使い方は[Lolly Design: 自由なキャンバス](/info/design.html)をご覧ください。

<!--i:eti-sliders-->
## ツールで変更できる部分を変える

ツールには、変更を想定した入力項目だけが現れます。色、レイアウト、書体、ロジックは作者が固定しているため、作品はそのルールを保ちます。入力にはテキスト、スライダー、カラーピッカー、ドロップダウン、日付、画像ピッカー、繰り返しの行グループがあります。一部は折りたたみ可能なセクションに配置されます。

![ツールに並ぶコントロール。テキスト欄、色の呼び出し、スライダーがあり、作者が固定した項目は表示されていない](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**デザインをクリックしてコントロールを探す。** プレビューの要素をクリックすると、対応するコントロールまでスクロールしてフォーカスが移ります。繰り返しの行グループでは、クリックした行が展開されます。

**Clear changes**はコントロールの上にあり、すべての入力を既定値にリセットします。

**デザインシステムの選択肢。** デザインシステムに複数のカラーウェイ、ライトとダークの外観、その他のテーマの選択肢がある場合は、コントロールの下の**Design system**セクションに並びます。このツールに変化を与える選択肢だけが表示されるため、ファイルユーティリティにはセクションがありません。各カラーウェイはその配色の点、ライトとダークは2つのボタン、その他の選択肢は一覧で示されます。

選択内容は、この作品ごとに保持されます。リンクにも保存済みのセッションにも含まれます。デザインシステムにリンクされた色はすべてその選択に従い、アプリ自体の色は維持されます。Lolly Designでは、インスペクターの**Canvas**タブに同じ選択肢があります。色そのものを内容とするツールは、正規のカラーウェイに固定でき、その場合はカラーウェイの点が出ません。[Lolly Demoを使う](/info/lolly-demo-in-use.html#colourways-on-real-work)では、実際の作品でカラーウェイを紹介しています。アプリと新しく作る各作品に1つのカラーウェイを使うには、**Settings → Appearance**で選びます([カラーウェイを自分用に設定する](/info/colourways.html#make-a-colourway-your-own))。

### プレビューのズームとパン

- **ズーム:** Cmd/Ctrlを押しながらスクロールするか、トラックパッドでピンチすると、ポインターを中心に拡大縮小します。キーボードでは、`0`または`Shift+1`で全体表示、`1`または`Shift+0`で100%、`Shift+2`で選択範囲に合わせます。`+` / `−`は、ポインターがステージ上ならその位置を中心に、それ以外では中央を中心にズームします。
- **パン:** **Space**を押しながらドラッグするか、マウスの中ボタンでドラッグします。通常のクリックでは、引き続きデザインの各部分をクリックできます。
- **タッチ:** ピンチでズームし、ドラッグでパンします。ダブルタップすると全体が収まります。
- **ズームHUD:** 隅のLollyのうずまきを押し続けると、`−`、**Fit**、`+`が開きます。短くタップした場合は、引き続きプロフィールメニューが開きます。

Lolly Designでは、**Fit all**の対象にアートボードと独立したレイヤーも含まれます。手動のズームでは、ページが表示領域の半分を占めるまで、20%より小さくできます。下限は、通常のFit倍率の5%か絶対倍率の2%のうち、低い方です。

出力サイズを変えると、ビューは必ず全体が収まる倍率に戻ります。

![キャンバスの隅のうずまきから開いたズームHUD。マイナス、Fit、プラス、テーマと音の切り替え、位置を変えるグリップが並ぶ](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### 元に戻す／やり直す

**Cmd/Ctrl-Z**は1ステップ戻し、**Cmd/Ctrl-Shift-Z**(または**Cmd/Ctrl-Y**)は1ステップ進めます。**Undo**と**Redo**のボタンはコントロールの上にあり、Lolly Designではトップバーにあります。対象のステップがなくなると、それぞれグレーアウトします。元に戻した入力はメッセージに表示され、**Redo**ボタンも付きます。

- **ドラッグ1回が1ステップになります。** 同じコントロールに対する0.5秒以内の繰り返しの変更は、1ステップにまとまります。
- **直近の100ステップを保持します。** 元に戻してから新しく編集すると、やり直し用のスタックが消えます。
- **テキストボックス内**のCmd/Ctrl-Zは、そのフィールドで1文字ずつ戻す操作になります。スライダー、ドロップダウン、色、スイッチではLollyが処理します。
- ファイル入力での**ファイルの選択**はステップに数えません。ファイルのバイト列は、このセッション中だけ保持されるためです。

ライブの[共同作業](/info/collaborate.html)で、別のデバイスの変更が自分の元に戻すスタックに入ることはありません。元に戻せる期間は、ツールを離れるか再読み込みするまでです。それ以前の変更については、作業中に保存するツールが、過去のバージョンを**History**に保持します([以前のバージョンに戻す](/info/find-your-work.html#go-back-to-an-earlier-version))。

### ライブカメラ

カメラを使える場合、**Filter**ツールのエフェクト(Halftone、Scanline、Posterize、Voronoi、Duotone、Stretch、Misprint、Dither、ASCII art、Glitch)に**Go live**ボタンが表示されます。オンにすると、ウェブカメラの各フレームにエフェクトが適用されます。モーションを書き出すと、結果をGIF、WebM、MP4として記録します。フレームの処理はお使いのデバイス上で行われます。停止するかツールを離れると、カメラはすぐに解放されます。どの画像ピッカーにも、1フレームを撮影する**Take a photo**があります。

<!--i:eti-folder-plus-->
## 保存と再開

作品を保存するには、レンダリングピルの**Export**の隣にあるチェックマークの**Save**を押します。新しい作品は**My library**に保存され、保存済みの作品は同じ場所で更新されます。ファイルはダウンロードされません。書き出しパネルにも、同じ**Save**ボタンが用意されています。

保存先を指定するには、書き出しパネルで**Download**の隣の**Save as**を押します。**Save to a project**で**My library**を選択したままにするか、プロジェクトを選び(**＋ New project…**で作成できます)、**Save**を押します。**Save as a template**では、新しいドキュメントの出発点にする[テンプレート](/info/templates.html)としてデザインを保存します。Lolly Designの**Save as**は、Lollyメニュー内にあります。スマートフォンでは、**•••** → **File menu** → **Save as**の順に押します。

![2つに分かれたレンダリングピル: 上向き矢印で書き出しパネルを開くExportと、チェックマークでその場に保存するSave](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> レンダリングピルで**Save**を押します。プロジェクトを指定する場合は**Save as**を押します。
- <!--i:folder--> 項目は**My library**か、指定したプロジェクトに保存されます。
- <!--i:home--> 再開するときは左上の**Home**を押し、**Projects**タブを開きます。
- <!--i:document--> 項目を開くと、すべての設定が復元されます。そのまま変更し、再び書き出せます。
:::

項目には、書き出しパネルで入力したファイル名が付きます。入力しなかった場合は、**QR Code**などのツール名が付きます。**Download**で取得するファイルは、完成したコピーです。後で変更するときは、Projectsから保存済みの項目を開きます。

::: note 保存内容はこのデバイスに残ります
[同期](/info/sync.html)をオンにしないかぎり、個人の保存内容はこのデバイスの、保存に使ったブラウザまたはアプリ内に残ります。
:::

作品が想定した場所に見つからないときは、[作品を探して復元する](/info/find-your-work.html)をご覧ください。タブを閉じた場合からブラウザデータを消去した場合まで、すべてのケースを説明しています。

::: details Lolly Workのチームプロジェクト(任意)
[組織でLolly Workを使っている](/info/organisation.html)場合は、そのインスタンスにサインインして**Projects → Team projects**を開くと、自分と共有されているセッションにアクセスできます。アクセスと保持の設定は組織が行い、セッションは組織のLolly Workサービスに保存されます。組織がライブ編集を許可していれば、共有セッションを開くと同時に、そのライブコラボに参加します。[一緒に作業する](/info/collaborate.html#collabs-through-lolly-work-optional)で手順を説明しています。

個人のライブラリは引き続き独立しています。別のデバイスにサインインすると、チームの作業にアクセスできます。個人の保存内容を移すには、同期またはバックアップが引き続き必要です。
:::

<!--i:eti-link-->
## 作品を共有する

デザインはリンクやファイルとして共有できます。書き出しコントロールの**Share**を押すと、両方を選べるダイアログが開きます。Projectsの保存済みセッションで**Share link**を押すと、そのセッションの同じダイアログが開きます。Google Drive、Nextcloud、S3バケット、Dropbox、OneDriveにファイルを送った後は、そのサービスを使ったリンクもダイアログで作成できます([ファイルを書き出す](/info/exporting.html#how-export-works))。

::: cols
## リンク

- すべての入力をアドレスに含めるので、リンクからデザインを再現できます。
- このデバイスから追加した画像やファイル、非常に長いテキスト、非常に大きなリストは除外されます。
- どのブラウザでも開けるので、ブックマーク、貼り付け、コミットができます。

## .lollyファイル

- 保存済みセッションに加え、このデバイス上の画像やファイルが含まれます。ツールとデザインシステムも含めることができます。
- ライセンス付きのカタログ作品は、ファイルを含めるよう指定しなければ除外されます。
- ダブルクリック、**Open**、アプリへのドロップのいずれかでLollyに開きます。
:::

### リンク

ダイアログの上部にリンクが表示され、**Copy**と、そのリンクをQR Codeツールで開く**QR**ボタンが並びます。リンクの下にある**Link options**には、次の項目があります。

- **Open in the installed app**は、リンクをShortcuts、ランチャー、自動化に使う`lolly://`アドレスに切り替えます。すべてのパラメーターは変わりません。
- **Shortest link**は、長いデザインをコンパクトなトークンにまとめ、短くなった文字数を表示します。読みやすい形式も引き続き利用できます。
- **Password-protect this link**は、お使いのデバイス上でAES-256を使ってリンクを暗号化します。パスワードがリンクの一部になることはありません。
- **Pin this tool version**は、`_v`フラグを追加します。これにより、後からツールが更新されてもリンクのレンダリング結果は変わりません。
- **When the recipient opens the link…**では、全画面表示、書き出しパネルを展開した状態、開いたときのダウンロード(`&export`)、クリップボードへのコピー(`&copy`)を選べます。
- **Copy credit**は、投稿やスライドで使える「Made with Lolly」のキャプションをリンクと一緒にコピーします。

ツールに名前などの個人用フィールドがある場合、**Review personal fields**は、各フィールドにチェックを入れるまでリンクから除外します。リンクに含められる内容は、すべて[URLモード](/info/url-mode.html)で説明しています。

**リンクに含められないものは、ダイアログで確認できます。** Lollyはリンクを作成するとき、アドレスに収まらないものの数を数えます。除外されたものがあれば、ダイアログに一覧表示し、ファイルのオプションを案内します。単に長いだけのリンクには、文字数を添えた控えめな注記が表示されます。

**リンクそのものが成果物になるツールもあります。** Jump Pageは、配布するリンクを1つのページにまとめます。プロフィール用のリンク、講演、ショップの入口などに使えます。ページ自体がリンクになっているので、ホスティングも、その背後にあるアカウントもありません。訪問者にはページが全幅で表示され、スクロールするたびに各シーンで1つのリンクが現れます。

![エディターで開いたJump Page: ページ最上部の見出しシーンと、その下に並ぶリンクシーン](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Lolly Workで組織が管理するリンク
有効期限、取り消し、パスワードが必要な共有のために、Lolly Workでは共有セッション、ツール、カタログアセットへの管理リンクを提供します。これらは組織のサービスを通じて開かれ、組織のアクセスルールに従います。上記の自己完結型リンクとは別のものです。リンクを取り消しても、すでにダウンロードされたファイルは回収できません。[レンダリングと共有](/info/manage/sharing.html)に、リンクの種類と権限を一覧にしています。
:::

### .lollyファイル

**Download .lolly**は共有ダイアログの**Editable file**セクションにあり、現在のデザインを1つのファイルに書き込みます。通常のカタログ作品は、このデバイス上の画像やファイルとともに含まれます。古くなったファイルや利用できないファイルは、外部参照として残ります。保存前に、ダイアログでファイルサイズ、埋め込むファイル数、参照するファイル数、ツールを含むかどうかを確認できます。デバイスに共有シートがある場合、**Send to…**はその共有シート(AirDrop、Androidの共有)にファイルを渡します。

**Projects**のフォルダメニューにある**Download project (.lolly)**は、フォルダ全体を書き込みます。受け取った人は、その中のすべてのセッションで作業を続けられます。バッチセッションは除外され、通知にその数が表示されます。同じメニューの**Download originals**は、各項目を個別のファイルとして通常のzipにまとめます。

ファイルを送る前に、次の3点を決めます。

- **自分の名前を含めるかどうか。** 名前、メールアドレス、組織は、[プロフィール](/info/profile.html)で**Use my details to create**がオンの場合にだけ書き込まれます。オフの場合は、Lollyで作成されたことと、その日時だけがファイルに記録されます。
- **除外対象の作品を含めるかどうか。** ライセンス付きの作品とブランドでロックされた作品は、既定では除外されます。記録されたライセンスをLollyがまだ読み取れないカタログ作品も同様です。デザインに使われている場合、ダイアログにその数が表示され、*Download without them*か*Include and download*を選べます。含めると、`.lolly`を開くすべての人にそのファイルが渡ります。権利の記録がないカタログ作品は含まれ、送る前に確認できるようダイアログに1つずつ表示されます。ファイル内の`CREDITS.txt`には、含めたものと除外したものが理由とともに記載されます。ルールは[創作物の権利とクレジット](/info/creative-rights.html)で説明しています。
- **ツールを含めるかどうか。** **Include the tool**はツール自体のファイルをまとめ、そのツールがないデバイスでもデザインを開けるようにします。フォークなどのカスタムツールでは、最初からチェックが入っています。署名付きカタログに掲載されたツールではチェックが外れています。署名付きカタログのないビルドでは、すべてのツールがカスタムとして扱われます。

**ファイルを開く。** デスクトップアプリとモバイルアプリでは、`.lolly`をダブルクリックまたはタップするか、**Open with Lolly**を選ぶか、共有シートからLollyへ送ります。Webアプリでは、**Open**を押すか、Lollyにファイルをドロップします。いずれの方法でも、最初にファイルのマニフェストを読み取り、何かを書き込む前にサイズ、内容、実行される処理を表示します。

::: warning ツールをインストールすると、そのコードが実行されます
ファイルに未導入のツールが含まれる場合、**Trust this tool?**にツールと作者が表示されます。また、開くとツール独自のコードがお使いのデバイス上で実行されることも表示されます。**Trust & install**で続行します。
:::

拒否した場合も作品はProjectsに保存され、ツールが追加されるまで待機します。コードがモジュールとして提供されるツールは、まだこの方法ではインストールできず、同じように拒否されます。

::: details .lollyの内容と、開くときの動作
`.lolly`はLollyのバンドル用拡張子です。内容は`manifest.json`の`format`で示されます。

- **共有デザイン**(`lolly-share`)には、1つの保存済みセッション、埋め込みファイル、参照で取得するものの受領記録が含まれます。ツールとデザインシステムを含むこともあります。開くと新しいプロジェクトが追加され、セッションを上書きすることはありません。
- **共有プロジェクト**(`lolly-share`、kindは`project`)には、Projectsのフォルダが含まれます。サブフォルダ、その中の全セッションとそれぞれのタイル、保存されている画像が入ります。開くとフォルダのコピーが追加されます。各セッションは`sessions/<key>.json`として含まれ、タイルは`thumbs/`に入ります。プロジェクトファイルに対応する前のLollyでは、更新を求められます。
- **デザインシステムパック**(`lolly-brand`)にはトークンが含まれ、フォント、ロゴ、公開済みバージョン、保持されたリソースを含むこともあります。開くと名前付きの独立したデザインシステムが追加され、そのシステムがアクティブになります。
- **ワークスペースまたはインスタンスのパック**は、ツール、カタログアセット、任意でインスタンスのアドレスを宣言した`lolly-brand`です。読み込むと、それまでに読み込まれた唯一のワークスペースオーバーレイを置き換えます。プレビューには、こうしたデバイス全体への影響が一覧表示されます。

デバイス全体のバックアップは`.lolly`ではありません。形式は引き続き`LollyTools-….zip`(フォーマット`lolly-backup`)で、**Settings → Storage → Import data…**から復元します。zipに圧縮したツールフォルダも、引き続き`.zip`です。形式のリファレンスは[データの転送](/info/data-transfer.html)をご覧ください。

`.lolly`は通常のzipです。`.zip`に名前を変更すると、中身を確認できます。自分の画像は`assets/uploads/`に、カタログ作品は`assets/catalog/`に入っています。`manifest.json`にはすべてのファイルが一覧にされ、READMEにそのファイルの説明があります。

macOS、Windows、Linux、iOS、Androidのすべてで、この形式が登録されます。デスクトップのファイルマネージャーではLollyドキュメントとして表示され、GNOME Filesでは保存済みセッション自体のサムネイルも表示できます。共有デザインにデザインシステムが含まれている場合、Lolly Design System Setupから開くとデザインシステムの操作が推奨されますが、**Open shared design**が隠れることはありません。

iOSやAndroidで別のアプリから受け取るドキュメントには48 MBの上限があり、アプリにもその旨が表示されます。受け渡しでは、アプリの境界を越えてバイト列をコピーします。Lolly内の**Open**にはこの上限がないので、より大きなバンドルにはこちらを使います。

確認すると、Lollyはバンドルを1回だけ展開し、検証します。アセットはライブラリに保存されます。チェックサムで照合するため、デバイス上にあるファイルは再利用されます。セッションは新しいIDでProjectsに保存されるので、同じファイルを2回開くこともできます。ツールがないセッションはそこで待機します。100 MBを超えるファイルは大きなファイルとして明示されます。また、ブラウザストレージから報告される空き容量が必要容量より少ない場合は、プレビューに警告が表示されます。書き込みを確定する前に、整合性検証の対象となるすべての部分を確認します。破損したコピーは拒否され、何も残りません。
:::

リンクもファイルも、渡すのはスナップショットです。ライブ編集については、[一緒に作業する](/info/collaborate.html)で、2台のデバイス間での非公開コラボと、Lolly Workを通じた任意の業務用コラボを説明しています。

<!--i:eti-images-->
## Assets - 自分のライブラリ

**Lolly Assets**(`#/a`)には、ツールで使えるブランドロゴ、画像、音声、モーションが種類別に並び、自分のファイルもあります。アップロードしたものはお使いのデバイスに保存されます。Lolly Workを使う組織は、独自のアクセスルールに従う共有カタログも提供できます([組織でLollyを使う](/info/organisation.html))。

![Assetsに並ぶブランドのスウォッチとフォント、自分のアップロード](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **自分のファイルを取り込む。** アップロード領域に画像、SVG、音声クリップ、動画、Lottie、PDF、PowerPointデッキをドロップするか、クリックして選びます。ファイルはすぐにAssetsとすべてのツールのアセットピッカーに表示されます。複数ページのPDFや`.pptx`では、残すページやスライドを選ぶよう求められ、それぞれがSVGアセットになります。ツール内で追加した画像は、変更されずに**My images**に保持されるため、付いているContent Credentialを引き続き検証できます。リサイズするか尋ねられるのは、非常に大きなファイルだけです。**Settings → Storage**には**My images**の使用量が表示されます。デバイスのストレージ容量以外に上限はありません。アップロード時にEXIFとGPSデータを削除するには、**Settings → Feature flags**の**Strip metadata from uploads**をオンにします。どちらの場合もContent Credentialsは保持されます。
- <!--i:star--> **よく使うものをお気に入りにする。** アセットやブランドのスウォッチに星を付けると、すべてのピッカーの先頭に固定されます。
- <!--i:folder--> **整理する。** アセットを別のグループへ移動する、使わない共有ブランドアセットを非表示にする(**Show hidden**で再表示できます)、自分のアップロードを削除する、といった操作ができます。Projectsと同じ選択バーで、選択したものすべてを操作できます。
- <!--i:layers--> **動画の背景を取り除く。** 動画の詳細を開くか、アセットピッカーでカードを右クリックし、**Remove background…**を選びます。**On-device model**は、複雑なシーンから被写体を切り抜きます。**Colour key**は、グリーンスクリーンなど均一に照明された背景を取り除き、ダウンロードは不要です。**Tolerance**、**Softness**、**Spill removal**で縁を調整します。**Resolution**(360、480、720、1080pで、元の解像度以下)で、細部の精度と処理速度を調整します。切り抜いたものは透明度付きのアニメーションWebPまたはPNGになり、元のファイルの隣に保存されます。元のContent Credentialは、素材として切り抜きにも引き継がれます。これが通常の編集の範囲に収まる理由は、[一度生成し、同じようにレンダリングする](/info/ai-features.html)で説明しています。

### パレットとフォントをどこでも使う

Assetsの**Swatches**パネルには、ブランドの色が表示されます。ブランドカラー、追加した色、ランプ、スペクトラムです。Lollyがインターフェース用に保持する役割別の色(テキスト、背景面、境界、カラーウェイの主色、別名で保持したブランドカラーのコピー)は、パネルの一番下にあるグレーの**Show colour roles**カードの中にあります。

各色は、他のアセットと同様にカードで表示されます。1つクリックして詳細を開くか、いくつか選んでダウンロードするか、他のツールが読み込める形式でパレット全体をダウンロードできます。

- <!--i:code--> **Design tokens (JSON)**、**CSS variables**、**CSS classes**は、スタイルシートやビルド向けです。sRGBより広い色域の色は、その広色域の値を保ちます。CSSでは16進数の後にその値を設定し、JSONでは16進数に加えて広色域の色、CMYKの配合、特色インクを保持します。
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**は、IllustratorやPhotoshop向けです。CMYKの配合が固定された色はそのCMYKスウォッチとして、特色インクは名前付きの特色スウォッチとして、sRGBより広い色域の色はLabとして渡されます。
- <!--i:pentool--> GIMPやInkscape向けの**GIMP palette (.gpl)**と**SCSS variables**は、どちらもsRGBです。

![Swatchesパネル: 上部に5つのパレット用ダウンロードボタンが並び、その下に各ブランドカラーが詳細を開けるチップとして表示される](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

::: details 複数の色を選ぶ、または1色の詳細を開く
各カードの点で色を選択します。2つ目の点をShiftを押しながらクリックすると間の色をすべて選べます。隙間でボックスをドラッグするか、カードにフォーカスした状態でCmd/Ctrl+Aを押す方法もあります。バーには、同じ6形式の**Download as…**、**Copy hex**、**Favourite**があります。形式を選ぶ前に、メニューで、どの形式にも含められない色(Transparentには色がありません)、広色域の色をsRGBのフォールバックで保存する形式(SCSSとGIMP)、CMYKと特色の値を保持する形式(JSONと.ase)を確認できます。カードを右クリックすると、1色に対して同じ操作ができます。

色の詳細では、その色でプレビュー全体を満たし、**Linked values**(CMYKの配合や特色インク、特定の色空間や印刷機向けに設定された値、デザイントークン)、**Every notation**(16進数、OKLCH、Display-P3など、それぞれにコピーボタン付き)、**Plotted on a colour space**、**Tones**、**Readability**を展開できます。矢印キーでパレットの色を順に移動でき、**Copy link**で色を共有し、**Open in Colour Lab**で開いてさらに作業できます。
:::

ブランドの書体は**Fonts**パネルに並び、それぞれに**download**があります。ダウンロードしてデバイスにインストールしたり、印刷会社に渡したりできます。

<!--i:eti-grid-->
## グリッドを使いやすくする

- <!--i:star--> **使うものをお気に入りにする。** カードを右クリックし、**Add to favourites**を選びます。ツールが大きなタイルになり、グリッド上のストリップに表示されます。ストリップについては[お気に入り](/info/favourites.html)をご覧ください。
- <!--i:eyeoff--> **使わないツールを隠す。** カードを右クリックするか複数選択し、**Hide tool**を選びます。ツールはグリッドから消え、グリッドで入力しても見つからなくなります。ツールがグリッドからなくなり、グリッドで入力した内容にも一致しなくなります。末尾のグレーの**Show hidden tools (N)**タイルを使うと、隠したツールが薄く再表示され、各メニューに**Unhide tool**が現れます。非表示にしても変わるのは自分のグリッドだけで、リンクやブックマークからは引き続き開けます。
- <!--i:clock--> **自分のツールを先頭に。** 3種類のツールで作品を保存すると、グリッドの上に**Yours**のチップ行が表示され、お気に入りと最近のツールが先頭に並びます。
- <!--i:sliders--> **好みの配置にする。** **View options**で、レイアウト(**Grid**、**Card**、**List**)、カードのサイズと密度、並べ替え順、カテゴリーフィルターを設定します。

![隠したツールを再表示したToolsグリッドの末尾: 薄く表示されたWordmarkカードと、再表示に使った隣のグレーのタイル。タイルの表示はHide hidden toolsに変わっている](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
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

**複数のカードをまとめて操作する。** 各カードのチェックボックスをオンにするか、空いている場所で選択ボックスをドラッグするか、Shift/Cmdを押しながらクリックすると、そのビューでできる操作がバーに表示されます。

- **ToolsとUtilities:** Favourite、Hide、Available offline、**View sessions**(Projectsで、そのツールで作成したセッションだけを表示)と、カードが1つの場合のCopy linkです。
- **Assets:** どの選択でもFavouriteとHideを使えます。Duplicate、Download、Deleteは、選択したすべての項目が自分のアップロードである場合にだけ表示されます。共有デザインシステムのアセットは、永続的な取り決めだからです。
- **Projects:** [作品を探して復元する](/info/find-your-work.html#find-something-you-saved)をご覧ください。

![2つのツールを選択したギャラリーの選択バー。Available offline、View sessions、Favourite、Hideが並ぶ](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
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

**View sessions**は、何かを選択しているときだけ表示されます。未選択のカードを1つ右クリックすると、**N saved sessions**から、そのツールの保存済みセッションの一覧を開けます。この一覧で削除すると、セッションはゴミ箱に移動します。

<!--i:eti-layers-->
## スマートフォンで使う

画面が狭い場合、レイアウトは1列になります。

- **コントロールはシートになり**、上部に表示されます。下端にはドラッグ用のグリップがあります。グリップをドラッグして**peek**、**half**、**full**の位置に合わせるか、タップして折りたたみと展開を切り替えます。プレビューはその下の領域を埋め、編集中も表示され続けます。
- フローティングの**Export**ボタンで、形式、サイズ、コピー、保存、ダウンロードを選べる書き出しシートが開きます。背景をタップすると閉じます。

![スマートフォン幅の画面で開いたツール: 上部のシートにコントロールが並び、その下のプレビューを生成したパレットが埋め、下部中央にレンダリングピルが浮かぶ](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

<!--i:eti-copy-->
## 折りたたみデバイスとiPhone Duo

折りたたみデバイス、iPhone Duo、正方形に近いタッチ画面では、Lollyはツールを2つのペインに配置します。

- **片側にコントロール、もう片側にキャンバス。** コントロールは描画する手と反対側に配置されます。**Settings → Accessibility**の**Dominant hand**で選ぶか、コントロール上部の**Swap sides**を押します。右から左へ書く言語では、左右が反転します。
- **仕切りはヒンジの位置に。** デバイスから折り目の位置が通知されると、そこでペインが分かれるため、コントロールも作品も折り目に重なりません。1枚の連続した画面では、仕切りを幅の3分の1、半分、3分の2の位置にドラッグできます。Lollyは、このデバイスのビューごとに選択を記憶します。
- **テーブルに置いたとき。** デバイスを半分開き、折り目を画面の横方向にすると、上半分にキャンバス、折り目の下にコントロールが配置されます。プレゼンテーションでは、上にスライド、下にノート、次のスライド、**Back**、**Next**が表示されます。Sequenceでは、上にプレビュー、下にタイムラインが表示されます。
- **Lolly Design、Design System Setup、Assets。** Lolly Designでは、インスペクター、レイヤー、書き出しパネルがキャンバスの隣にタブとして並びます。ツールはキャンバスの外側の縁に、描画する手の側に並びます。収まらない場合は列がスクロールし、端のフェードと矢印が残りのツールの方向を示します。テーブルに置いたときは、ツールがキャンバス下端に並びます。Lolly Design System Setupでは、片側にBoard、反対側に開いたルームが表示されます。Assetsでは、アセットの詳細がライブラリの隣に開くため、次にタップしたアセットも同じ場所に表示されます。
- **折り目には何も置かない。** 折り目が通知されると、ダイアログはコントロールがある側のページに開きます。ホーム画面下部の検索欄と検索結果も同様です。平らな画面では中央に表示されます。
- **折りたたんでも失われない。** デバイスを折りたたむ、開く、回転するといった操作をしても、ドキュメント、選択、ズーム、入力中のフィールドは保持され、カーソルも同じ位置に残ります。

折りたたみデバイスの外側の画面では、上記のスマートフォン用レイアウトが使われます。分割画面の片側にあるLollyウィンドウも同様です。

<!--i:eti-smile-->
## 設定、サウンド、使い心地

**Settings**はホーム画面の一番下にあり、個人情報、デザインシステム、アクセシビリティ、ストレージ、オフライン用ダウンロードを設定できます。[Lolly Settings](/info/dashboard.html)で各タブを案内しています。

- **個人情報と顔写真**は、メール署名やバッジなど、それらを使うよう作られたツールに自動で入力されます。[プロフィール](/info/profile.html)で説明しています。
- **Accessibility**には、使い心地を調整する4つのスイッチ、**Reduce motion**、**Hide colourful previews**、**High contrast**、**Large text**があります。変わるのは作品の周囲にあるアプリの表示だけで、ツールのキャンバスや書き出し結果は変わりません。その隣の**Dominant hand**では、2ペイン表示でコントロールを置く側を選びます。
- **Sound**は操作を補助する穏やかな音を鳴らし、**Neurospicy Mode**は集中のための静かなトラックを再生します。どちらも、**Settings → Accessibility**またはプロフィールメニューでオンにするまでオフです。Soundスイッチの下にある**Sound shape**スライダーで、柔らかく丸みのある水滴の音(Bouba)から乾いた刻み音やこすれる音(Kiki)まで変えられ、中央ではLollyのチャイムになります。Neurospicyのトラックには、Lollyが生成するステーション、**Lolly Sings**とそのジャンル、3つの**Lofi stations**があります。ステーションは再生しながら無限に音楽を生成します。各ステーションには、ドラムと質感(Lofiではムードも)のコントロール、聴いている曲を共有するリンク、曲をアセットに保存するボタンがあります。[生成音楽](/info/generated-music.html)では、曲を作る仕組みを説明しています。Utilitiesの**Music generator**(`#/music`)で、曲を調整できます。
- **Available offline**は、接続が切れる前に、アプリの残りの部分、ツール、カタログ、ガイドをダウンロードします。LollyをWebアプリとしてインストールするには、ブラウザのインストールボタンか、スマートフォンの*Add to Home Screen*を使います。インストールしたアプリは全画面で動作し、オンラインに戻ると自動で更新されます。
- **Settings → Feature flags**の**Performance UI**は、アプリの見た目をシンプルにし、描画の負荷を下げます。ツールのキャンバスと書き出し結果は同じです。動作の遅いデバイスでは、Lollyが自動でこの表示をオンにし、理由とともに**Undo**と**Keep**を表示します([Performance UI](/info/configuration.html#curating-what-people-see))。
- **Storage**は、このデバイスにLollyが保持しているものを表示します。[ブラウザデータを消去した場合](/info/find-your-work.html#if-you-clear-your-browser-data)では消去されるものを説明し、[プライバシーポリシー](/info/privacy.html)ではアプリが取得または送信するものをすべて一覧にしています。

::: note 更新後にビューが読み込まれない場合
更新直後にパネルが空になったり「failed to fetch」と表示されたりする場合、通常は1回再読み込みすれば解消します。保存した作品、セッション、デザインシステムはデバイス上に保存されているため、影響を受けません。追加後に一度も保存していない画像だけは、追加し直す必要がある場合があります。
:::

<!--i:eti-map-pin-->
## 次に進むページ

- **[Lolly Design: 自由なキャンバス](/info/design.html)**: キャンバス、図形、タイムライン、デッキのプレゼンテーション。
- **[BatchとLolly Multi-edit](/info/batch.html)**: 1つのデザインから多数のバージョンを作る、または複数の保存済みデザインをまとめて編集する方法。
- **[ファイルを書き出す](/info/exporting.html)**: 形式、サイズ、印刷の単位、透明度、動画の選択。
- **[デザインをインポートする](/info/design-import.html)**: Figma、Penpot、Illustrator、InDesign、Affinity、DXFのファイルをLolly Designに取り込み、編集を続ける方法。
- **[テンプレート](/info/templates.html)**: ツールの出発点として保存したもの。
- **[広色域とHDR](/info/hdr-editing.html)**: Lolly DesignとLolly Darkroomで元の画像の精度を保つ方法。
- **[作品を探して復元する](/info/find-your-work.html)**: 作品の保存場所と、別のデバイスへの移し方。
