# Settings

Settingsは、Lollyの動作を自分向けに変える場所です。詳細、使用するデザインシステム、アクセシビリティ、このデバイスに保存されているもの、オフラインで利用できるもの。ホーム画面下部のバーの**Settings**、またはアバターメニューから開きます。**Preferences**で開き、その横にさらに4つのタブがあります。

| タブ | アドレス | 内容 |
|---|---|---|
| **Preferences** | `#/settings` | 詳細、デザインシステム、外観、絵文字、アクセシビリティ、接続、ストレージ、オフラインダウンロード |
| **This device** | `#/settings?tab=device` | このブラウザとマシンのライブ表示、サウンド、読み取り専用のストレージ表示 |
| **Design system** | `#/settings?tab=brand` | 現在のデザインシステムを表紙とページで表示し、システムを切り替える表紙のストリップ付き |
| **Capabilities** | `#/settings?tab=caps` | Lollyにできるすべてのことを、検索できるカードで |
| **Activity & stats** | `#/settings?tab=activity` | カタログ、ローカルのカウンター、最近の作業 |

各タブには専用のアドレスがあり、古い`#/profile`と`#/d`のリンクも、個々の設定まで含め、正しい場所を開きます。

## Preferences

Preferencesは、横に**設定レール**が並ぶ1本の長いページで、レールの上の**Search settings**欄が入力に合わせて絞り込みます。すべてのセクションは、`#/settings?focus=<section-id>`という形式のリンク、たとえば`#/settings?focus=storage-section`から直接開きます。

- <!--i:usercheck--> **Your details** - 名前、連絡先、顔写真、そして**Use my details to create**スイッチ。ツールがそれらをどう使うかは[プロフィール](/info/profile.html)で説明しています。
- <!--i:seal--> **Content Credentials** - 書き出しに署名する任意の認証済みID。[Content Credentials](/info/content-credentials-identity.html)をご覧ください。
- <!--i:palette--> **Design systems** - デザインシステムを切り替える、追加する、非表示にする、削除する。各操作は[Design System Setup](/info/brand-studio.html#manage-your-design-systems)で扱っています。
- <!--i:moon--> **Appearance** - テーマ(Light、Dark、またはアプリをお使いのパレットで塗るBrand)と**Interface follows the design system**。
- <!--i:sparkle--> **Emoji** - 新しく始めるときに絵文字を描くセットと、そのアートワークのライセンス、パレットが絵文字を再着色する強さ(**Off**、**Subtle**、**Strong**、**Full**、**Mono**、**Duotone**)。**Keep skin tones and flags**は、それらを元の色のままにします。すでに作った作品は、作ったときのセットを保ちます。
- <!--i:eyeoff--> **Accessibility** - 4つの快適さスイッチと、SoundとNeurospicy Mode。[アクセシビリティ](#accessibility)をご覧ください。
- <!--i:link--> **Connected services** - Dropbox、Google Drive、OneDrive、Nextcloud、S3など、接続するストレージと、**Sync across devices**。[デバイスを同期する](/info/sync.html)をご覧ください。
- <!--i:globe--> **Trusted sites** - Designのウェブページボックス、またはSandboxのデモが、確認なしに接続できるサイトと、サーバーが提供している場合は**Allow pages from any site**。各リクエストが送る内容は[プライバシーポリシー](/info/privacy.html)に一覧があります。
- <!--i:download--> **Your renders** - **Save my renders to my library**は、ダウンロードした画像、音声クリップ、動画のコピーを、Rendersタグを付けてAssetsに保持します。
- <!--i:database--> **Storage** - Lollyがこのデバイスに保持しているものと、データを消去したり持ち出したりするボタン。[ストレージ](#storage)をご覧ください。
- <!--i:cpu--> **Available offline** - 接続が切れる前に必要なものをダウンロードします。[オフラインで使う](#available-offline)をご覧ください。
- <!--i:folder--> **Hot folder** - デスクトップアプリで、1つのフォルダを監視し、そこに置かれたものを、ドラッグ&ドロップと同じ選択画面を通してLollyに取り込みます。
- <!--i:clock--> **Your activity** - このデバイスで作ったものを、ローカルで集計したもの。
- <!--i:sliders--> **Feature flags** - **Print preflight**や**Strip metadata from uploads**など、アプリの一部をオンまたはオフにします。
- <!--i:server--> **Lolly instance** - このインストールがツールとカタログを取得する場所。[Lollyインスタンス](#lolly-instance)をご覧ください。

テーマカードはライブプレビューで、選んだ瞬間に、このデバイスにだけ適用されます。

![Three theme cards, each previewing its own type and colour, with the active one flagged](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### アクセシビリティ

**Settings → Preferences → Accessibility**には、作業の周りのアプリのための4つの快適さ設定があります。どれもオンにするまではオフで、ツールのキャンバスや書き出しの中までは届かないため、落ち着いたアプリが、出荷するファイルのピクセルを動かすことはありません。

- <!--i:pause--> **Reduce motion**は、アプリのトランジション、スライド、装飾をオフにします。キャンバスとアニメーションの書き出しは、デザインどおりに動き続けます。
- <!--i:photos--> **Hide colourful previews**は、ギャラリーのプレビューのアートワークを、落ち着いたアイコンとテキストのカードに置き換え、プロジェクトのサムネイルを、主張しすぎずに見分けがつく程度に抑えます。
- <!--i:sliders--> **High contrast**は、アプリの境界線、テキスト、フォーカスリングを強めます。ブランドカラーとキャンバスは、設定したままです。
- <!--i:font--> **Large text**は、アプリのラベル、メニュー、ボタンのテキストを大きくします。デザイン内の文字は変わらないため、書き出すものが再配置されることはありません。

これらの設定はプロフィールにあるため、プロフィールのエクスポートに含まれ、名前やセッションとともに次のインストールに引き継がれます。デバイス専用の小さなコピーが、最初の描画の前にこれらを適用します。

同じカードには、行動に対するやさしい補助音のレイヤーである**Sound**(ギャラリーへの到着、Content Credentialsの結果、パネルを閉じるときなど)と、落ち着いた集中用のトラックである**Neurospicy Mode**もあります。Neurospicyをオンにすると、アプリ全体で付いてくる小さなプレーヤーが隅に開きます。そこでトラックの選択、スキップ、音量の設定、プレーヤーの最小化や終了ができます。トラックには、手続き的に生成される*Lolly Sings*の曲、アンビエントループとビート、ご自身の音声、そして接続が必要なインターネットラジオ局があります。どちらも既定ではオフで、記憶され、Soundをオフにすると集中用トラックもミュートされます。プロフィールメニューと**This device**にも同じスイッチがあります。

インターフェースはキーボードで操作でき、カスタムコントロールにはスクリーンリーダー用のラベルがあり、各ツールのライブプレビューは、表示内容を説明するラベル付きの1枚の画像として公開されます。

### ストレージ

ストレージメーターは、このインストールが保持するすべてのバイトを、カテゴリ別に、ブラウザが報告する容量と照らして集計します。

![ストレージメーター: 保存済みセッション、画像、キャッシュの内訳を、ブラウザが実際に報告する容量と対比して表示する](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

メーターの下には次のものがあります。

- **Move to another device**には、**Export my data**、**Import data…**、**Export my data & render everything**があります。手順は[作品を別のデバイスに移す](/info/find-your-work.html#move-your-work-to-another-device)で説明しています。
- **Clear cache**は、ダウンロード済みのカタログファイルを削除します。必要になったときに再度ダウンロードされます。
- **Remove automatic checkpoints older than 30 days**は、Historyの容量を空け、保存済みと名前付きのバージョンは残します。
- **Clear all my data**は、確認のために単語を入力した後、Lollyがこのブラウザに保持しているすべてを削除します。何が消えるかは[ブラウザデータを消去した場合](/info/find-your-work.html#if-you-clear-your-browser-data)に一覧があります。

### オフラインで使う

Lollyは、訪れた画面をキャッシュしますが、それは訪れた場所しかカバーしません。**Available offline**は、先が見えている外出のためのものです。必要な部分をダウンロードして、1本の進行バーを見守れば、取り込んだものはすべて、接続がなくても動作し続けます。

- <!--i:monitor--> **アプリ、カタログ、ガイド** - **The app**(一度も開いていない画面を含む、すべてのビュー、エディター、フォント)、**Catalogue**(すべて、または**Choose by tag**)、**Guides & docs**(スクリーンショットを含む、お使いの言語のこのドキュメント)。
- <!--i:cpu--> **AIモデル** - デバイス上の各モデルが、サイズとともに1行ずつ並びます。Speech voices、Upscaling models、Background removal、Text recognition、Verify deep scan、Durable credential、Rewriter model、Ask matching model、AI text detector、Singing voices。50 MBを超えるモデルには**large download**と表示されます。
- <!--i:wrench--> **ツール** - 各ツールは個別にダウンロードされ、**Download all**はすべてのツールを取り込みます。チェックマークはオフラインで使えることを意味します。

最上部の**Download everything**は、アプリ、選択したカタログの範囲、ガイド、すべてのツールを取り込みます。**Include all the AI models**にチェックを入れるとモデルも加わります。個別の行からモデルを1つだけダウンロードすることもできます。歌声は、その行からしかダウンロードされません。組織のポリシーでAIのダウンロードをオフにでき、その場合は各行にその旨が表示されます。

ダウンロードは、キャンセルしたり接続が切れたりした場所から再開し、オンラインに戻ると、リリースで変更された分だけを取得して自動的に更新されます。ブラウザが永続ストレージを許可していない場合、**Protect downloads**がそれを求めます。これは「ダウンロード済み」と「ブラウザが容量を取り戻したがるまではダウンロード済み」との違いです。

### Lollyインスタンス

**Lolly instance**は、このインストールがツールとカタログを取得する場所を示します。インスタンスのアドレス、またはすべてがビルドに含まれている場合は*Bundled with this app*です。

- **Design-system source**は、提供されたデザインシステムの出どころを示します。
- **Instance console**は、配備が提供している場合に、その管理ページを開きます。
- **Change**は、デスクトップアプリを別のインスタンスに向けます。ブラウザはオリジンをまたいでツールとアセットを読み込めないため、Webではこのセクションに代わりに**Open a workspace**が表示されます。
- **Leave**は、インスタンスのデザインシステム、ツール、カタログを削除しますが、ご自身の作品は残ります。[組織でLollyを使う](/info/organisation.html#leaving)をご覧ください。
- 組織にサインインしている場合、**Sign out**はこのセッションを終了し、**Sign out everywhere**は、このデバイスを含む、すべてのデバイスでのセッションを終了します。

## This device

- <!--i:monitor--> **This Machine** - 画面、入力、グラフィックス、メモリ、コーデック、ストレージバックエンドなどを、このセッションからライブで読み取ります。何も保存されず、何も送信されません。広い画面では、タブが2列に配置され、自動的に開きます。
- <!--i:neurobeat--> **Sound** - インターフェースのサウンドとNeurospicyの集中用ループ。このタブで何かを書き込む唯一のスイッチです。
- <!--i:database--> **Storage** - [Preferences](#storage)のメーターの読み取り専用ビューです。データを消去したり持ち出したりするのはそちらです。

## Design system

現在のデザインシステムを、読みやすく整理したものです。このブラウザに2つ以上のデザインシステムがある場合、上部の小さな表紙のストリップにそれらが一覧になります。1つ選ぶとそれが有効になり、その後に表示される通知の**Undo**で前のものに戻せます。

![Lolly DemoのDesign systemタブ: システムを切り替える表紙のストリップ、続いてロゴ、名前、メモ、各ページを開くカウントのある表紙](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

このタブは、システム自身の色で塗られた表紙で開き、ロゴ、表示用書体で表示された名前、作者が書いたメモが載っています。表紙のカウントの行から、各ページにリンクされています。

- <!--i:palette--> **Colour** - ライトとダークの外観のサーフェス、テキスト、プライマリ、セカンダリ、名前と16進値付きのチップで表したすべての名前付きの色、各ティントランプとチャートスペクトラムの帯、折りたたみ内の色の役割。値を選択すると16進値がコピーされます。
- <!--i:font--> **Type** - Headings、Text、Emphasis、Code。それぞれ専用の書体で表示します。
- <!--i:photos--> **Logos** - 各ロゴファイルを、それが想定された背景の上に表示します。
- <!--i:layers--> **Colourways** - システムに複数ある場合の、各カラーウェイのライトとダークの組。
- <!--i:sliders--> **Tokens** - 角丸、余白、エフェクト、グラデーション。
- <!--i:document--> **Print & CMYK** - 特定のインクに固定された色と、CMYKのPDFが宣言できる印刷条件。

このタブが行う変更は、切り替えだけです。デザインシステムの編集は`#/start`の[Design System Setup](/info/brand-studio.html)で行い、表紙にそのリンクがあります。読み取り専用のシステムは、表紙にその旨が表示され、ご自身で作成したローカルのシステムは編集可能なままです。`/b`と`/brand`は、このタブへの短縮リンクです。

## Capabilities

プラットフォームのすべての部分が、カードとして12のグループにまとめられています。Experiences、Platforms & runtimes、Accessibility & languages、Export formats、Import formats、Print production、Automation & AI、Determinism & reproducibility、Brand & design system、Privacy & data ownership、Security & access control、Architecture (for builders)です。各グループは折りたたみ式で、カードの数が表示されます。カードを開くとダイアログが表示され、そのケイパビリティの機能と、約半数についてはこのドキュメントが使うスクリーンショットが示されます。

グループの上の検索欄は、入力に合わせてカードを絞り込み、一致が残っているグループを開きます。検索対象のケイパビリティの数が表示され、一致しない検索にはその旨が言葉で示されます。

このタブは、Lollyにできることを書いたドキュメントで、これらのガイドと同期して保たれています。お使いのマシンを調べることはありません。それは**This device**が行います。

## Activity & stats

まずビルドについてです。読み込まれたツールの数、書き出し形式の数、プラットフォームが動作する環境の数、カタログが持つブランドアセットの数が示され、**Catalogue**パネルでこのビルドに含まれるものが内訳表示されます。

次に、ご自身の側です。**Your activity**はこのデバイスで作ったものを集計し、**Recent creations**と**Latest exports**はスワイプで見られるスタックで、見せるものができた時点でそれぞれ現れます。どちらも、項目を作ったときの状態のまま開きます。これらのカウンターはデバイスにとどまり、任意のLolly Workインスタンスは、独自の[組織のテレメトリと監査記録](/info/privacy.html#organisation-services-with-lolly-work)を保持します。

## ディープリンク

Settingsのすべてのタブとセクションには、ブックマークや貼り付けができる独自のリンクがあります。[検索](/info/search.html)は、**Settings**の結果を、Settingsが描画に使うのと同じレジストリに向けているため、セクションの名前を変えて検索結果が参照できなくなることはありません。

::: details リンクのあらゆる形式

- **タブ:** `#/settings?tab=brand`、`#/settings?tab=caps`、`#/settings?tab=device`、`#/settings?tab=activity`。
- **Preferencesのセクション:** `#/settings?focus=<section-id>`。たとえば`#/settings?focus=offline-section`です。
- **セクションを正確に指定:** そのIDを単独のフラグとして指定します。たとえば`#/settings?dash-storage`、`#/settings?dash-logos`、`#/settings?dash-colourways`、`#/settings?cap-formats`です。古い`#/settings?dash-lock`と`#/settings?dash-palette-wheel`のリンクは、表紙とColourのページを開きます。
- **キーワードによるセクション:** `#/settings?print`、`#/settings?formats`、`#/settings?palette`(Colourのページ)、`#/settings?tokens`。キーワードは重複することがあります。`print`は、ブランドタブの印刷リファレンスとPrint productionグループの両方に属し、ページ順で先にあるほうが優先されます。どちらかが重要な場合はIDを使ってください。

ディープリンクは、対象を持つタブに切り替わり、その中で折りたたまれているグループを開き、その後スクロールします。その上のセクションのレイアウトが終わるまで、少しのあいだ落ち着かせます。廃止された`#/platform`と`#/capabilities`のアドレスは、ディープリンクのフラグを保ったまま、Settingsに統合されています。
:::

---

**関連:** お客様の詳細と作成時の文脈については[プロフィール](/info/profile.html)。Design systemタブが示す内容の編集については[Design System Setup](/info/brand-studio.html)。ストレージ、バックアップ、デバイスの移行については[作品を探して復元する](/info/find-your-work.html)。
