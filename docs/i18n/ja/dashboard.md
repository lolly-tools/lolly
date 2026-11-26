# 設定

Settingsには、個人情報、デザインシステム、アクセシビリティ、このデバイス上のストレージ、オフライン用のダウンロードがあります。ホーム画面の下部にあるバーか、アバターのメニューから**Settings**を開くと、**Preferences**が表示されます。

| タブ | アドレス | 内容 |
|---|---|---|
| **Preferences** | `#/settings` | 個人情報、デザインシステム、外観、絵文字、アクセシビリティ、接続、ストレージ、オフライン用のダウンロード |
| **This device** | `#/settings?tab=device` | このブラウザとマシンのリアルタイムの情報に加え、サウンドと読み取り専用のストレージ表示 |
| **Design system** | `#/settings?tab=brand` | 有効なデザインシステムを表紙とページで表示し、表紙の列でシステムを切り替える |
| **Capabilities** | `#/settings?tab=caps` | Lollyでできることのすべてを、検索可能なカードで表示 |
| **Activity & stats** | `#/settings?tab=activity` | カタログ、ローカルのカウンター、最近の作品 |

以前の`#/profile`と`#/d`のリンクも、個々の設定を含め、今も正しい場所を開きます。

<!--i:eti-sliders-->
## 環境設定

Preferencesは1つの長いページで、側面に**設定レール**があります。レールの上にある**Search settings**フィールドは、入力に応じてレールを絞り込みます。各セクションには、`#/settings?focus=<section-id>`という形式のリンクがあります。たとえば`#/settings?focus=storage-section`です。

- <!--i:usercheck--> **Your details** - 名前、連絡先、顔写真と、**Use my details to create**スイッチです。[プロフィール](/info/profile.html)では、ツールがこれらをどう使うかを説明しています。
- <!--i:seal--> **Content Credentials** - 書き出しに署名する、任意の検証済みIDです。[Content Credentials](/info/content-credentials-identity.html)をご覧ください。
- <!--i:palette--> **Design systems** - デザインシステムの切り替え、追加、非表示、削除を行います。[Lolly Design System Setup](/info/brand-studio.html#manage-your-design-systems)で各操作を説明しています。
- <!--i:moon--> **Appearance** - テーマ(Light、Dark、または自分のパレットでアプリを彩るBrand)、デザインシステムが複数のカラーウェイを提供する場合の**Your colourway**([自分のカラーウェイを選ぶ](/info/colourways.html#make-a-colourway-your-own))、**Interface follows the design system**です。
- <!--i:sparkle--> **Emoji** - 新しい作品に使う絵文字セットとそのアートワークのライセンス、パレットで絵文字をどの程度配色し直すか(**Off**、**Subtle**、**Strong**、**Full**、**Mono**、**Duotone**)です。**Keep skin tones and flags**は、肌の色と旗を元の色のままにします。作成済みの作品は、それまでのセットを保持します。
- <!--i:eyeoff--> **Accessibility** - 快適に使うための4つのスイッチに加え、SoundとNeurospicy Modeがあります。[アクセシビリティ](#accessibility)をご覧ください。
- <!--i:link--> **Connected services** - Dropbox、Google Drive、OneDrive、Nextcloud、S3など、接続するストレージと、**Sync across devices**です。[デバイスを同期する](/info/sync.html)をご覧ください。
- <!--i:globe--> **Trusted sites** - Lolly DesignのWebページボックスやLolly Sandboxのデモが確認なしで接続できるサイトと、サーバーが提供する場合は**Allow pages from any site**です。[プライバシーポリシー](/info/privacy.html)には、各リクエストで送られるものの一覧があります。
- <!--i:download--> **Your renders** - **Save my renders to my library**は、ダウンロードする各画像、音声クリップ、動画のコピーを、AssetsのRendersタグの下に保存します。
- <!--i:database--> **Storage** - Lollyがこのデバイスに保持するものと、データを消去または移行するボタンです。[ストレージ](#storage)をご覧ください。
- <!--i:cpu--> **Available offline** - 接続がなくなる前に、必要なものをダウンロードします。[オフラインで利用する](#available-offline)をご覧ください。
- <!--i:folder--> **Hot folder** - デスクトップアプリで、Lollyが1つのフォルダを監視し、そこに置かれたものを、ドラッグ＆ドロップと同じ選択画面を通して取り込みます。
- <!--i:clock--> **Your activity** - このデバイスで作ったものを、ローカルで集計します。
- <!--i:sliders--> **Feature flags** - **Print preflight**や**Strip metadata from uploads**など、アプリの機能をオンまたはオフにします。**Performance UI**は、描画の負荷が低い、シンプルな見た目にします。処理の遅いデバイスでは、Lollyが自動でPerformance UIをオンにすることがあります。その場合、スイッチの下の行に日時と理由、**Allow again**が表示されます([判断の仕組み](/info/configuration.html#curating-what-people-see))。
- <!--i:server--> **Lolly instance** - このインストール環境がツールとカタログを取得する場所です。[Lollyインスタンス](#lolly-instance)をご覧ください。

テーマカードはライブプレビューです。テーマは選ぶとすぐに、このデバイスだけに適用されます。

![それぞれの書体と色をプレビューする3枚のテーマカード。有効なカードには印が付いています](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### アクセシビリティ

**Settings → Preferences → Accessibility**には、アプリを快適に使うための4つの設定があります。どれも自分でオンにするまではオフで、ツールのキャンバスや書き出しには影響しないため、アプリの表示を落ち着かせても、送り出すファイルのピクセルは一切変わりません。どれも既定ではオフです。ツールのキャンバスや書き出しを変更するものはありません。

- <!--i:pause--> **Reduce motion**は、アプリの画面遷移、スライド、装飾的な動きをオフにします。
- <!--i:photos--> **Hide colourful previews**は、ギャラリーのプレビュー画像をアイコンとテキストのカードに置き換え、プロジェクトのサムネイルを、内容が分かるまま落ち着いた表示にします。
- <!--i:sliders--> **High contrast**は、アプリの境界線、テキスト、フォーカスリングを目立たせます。ブランドの色とキャンバスは、設定したままです。
- <!--i:font--> **Large text**は、アプリのラベル、メニュー、ボタンの文字を大きくします。

**Dominant hand**(RightまたはLeft)は、折りたたみ端末や正方形に近いタブレットでLollyが2つのペインを表示するときに、コントロールをどちら側に置くかを設定します。ペインのヘッダーにある**Swap sides**でも変更できます。

これらの設定はプロフィールに保存されるため、プロフィールの書き出しでは、名前やセッションと一緒に移動します。デバイス内だけにあるコピーによって、最初の描画前に適用されます。

同じカードには**Sound**もあります。ギャラリーへの移動、Content Credentialsの結果表示、パネルを閉じる操作などを、やわらかな音で知らせます。落ち着いて集中するための音楽を流す**Neurospicy Mode**もあります。Neurospicyをオンにすると、隅に小さなプレーヤーが開き、アプリ内を移動しても表示され続けます。プレーヤーでは、曲の選択、スキップ、音量の設定、プレーヤーの最小化や終了ができます。音楽には、Lollyの生成ステーション、アンビエントのループやビート、自分の音声、接続が必要なインターネットラジオ局があります。どちらも既定ではオフで、設定は記憶されます。Soundをオフにすると、集中用の音楽もミュートされます。プロフィールメニューと**This device**にも、同じスイッチがあります。

Soundスイッチの下にあるスライダーで、音の質感を設定します。丸い**Bouba**の塊に近づけると、やわらかい水滴や泡の音に、少し低音が加わります。とがった**Kiki**の星に近づけると、乾いたカチカチ音、引っかく音、金属音になります。中央では、Lollyのチャイムや音色が保たれます。一方の端の音がつらい場合は、もう一方の端に近づけてください。Soundがオフでもスライダーは使え、スライダーを離すと短いサンプルが再生されます。

::: details 生成ステーション
生成ステーションは、サンプル音源や録音された声を使わず、再生しながら音楽を作曲します。曲ごとに、楽器、グルーヴ、展開の順序が異なります。

- **Lolly Sings**は、一連のステーションです。オリジナルのLolly Singsは、明るく旋律的です。長調で、どの曲にもリードがあり、ボサノバ、シャッフル、チップチューンの色合いがあります。SugarやK-popからCountry、Jazz、Metal、D&Bまで、各ジャンルにも独自のステーションがあります。
- **Lofi stations**(Warm、Late night、Rainy)は、終わりなく続くローファイのビートです。

生成ステーションでは、次へと前へで曲を移動します。各曲はシードから作られるため、どこで共有、保存しても同じ曲が再生されます([生成音楽](/info/generated-music.html)をご覧ください)。再生コントロールの下にある**Mood**はLofiステーションを切り替え、**Drums**はドラムキットを外し、**Texture**はクリアな音からほこりをかぶったレコードのような音まで調整します。その下にアイコンボタンが並びます。ボタンにポインターを重ねるか長押しすると、名前が表示されます。

- 音符の**Open in the music generator**は、`#/music`で曲を開き、セクションごとに楽器を変更できます。
- リンクの**Share this tune or moment**は、同じ曲を再生するリンクか、現在の再生位置から始め、今のプリセットと色でビジュアライザーも表示するリンクを提供します。
- フォルダの**Save to library**は、曲をアセットに保存します。
- 稲妻の**Light visualiser**はスイッチで、以下で説明します。

保存した曲は、そのステーションのグループの下に、調とテンポで一覧表示されます。保存した曲を選ぶと同じ曲が再び再生され、通常の曲と同じようにリピートするか、順送りモードでは次に進みます。保存するのはステーションと曲の番号だけで、数バイトです。音楽は再生時に再び作曲されます。保存した曲は、アセットで名前の変更や削除ができ、動画のBGMにも使えます。Lolly DemoとLolly Startには、それぞれ6曲の保存済みの曲が付属します。

ビジュアライザーは、すべての曲を一定のレベルで受け取るため、どの音量でも、静かな曲が大きな音の曲と同じくらい映像を動かします。Lolly Singsの各ジャンルと、そこから保存した曲には、**Light visualiser**があります。シンプルなレベルバーを表示し、音楽に必要な処理時間を確保します。タッチ画面や、4コア以下またはメモリ4 GB以下のデバイスでは、Light visualiserは最初からオンです。
:::

インターフェースはキーボードで操作できます。独自のコントロールには、スクリーンリーダー用のラベルがあります。各ツールのライブプレビューは1つの画像として扱われ、表示内容を説明するラベルが付きます。

### ストレージ

ストレージメーターは、このインストール環境が保持するすべてのバイトをカテゴリ別に示し、ブラウザが報告する容量と対比します。

![ストレージメーター。保存したセッション、画像、キャッシュの内訳を、ブラウザが実際に報告する容量と対比して表示します](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

メーターの下には、次の項目があります。

- **Move to another device**には、**Export my data**、**Import data…**、**Export my data & render everything**があります。[作品を別のデバイスに移す](/info/find-your-work.html#move-your-work-to-another-device)で順に説明しています。
- **Clear cache**は、ダウンロード済みのカタログファイルを削除します。必要になれば再びダウンロードされます。
- **Remove automatic checkpoints older than 30 days**は、保存済みのバージョンと名前付きのバージョンを残し、Historyの容量を空けます。
- **Clear all my data**は、確認のための単語を入力した後、このブラウザでLollyが保持するすべてを削除します。[ブラウザのデータを消去した場合](/info/find-your-work.html#if-you-clear-your-browser-data)に、削除されるものの一覧があります。

### オフラインで利用する

Lollyがキャッシュするのは、訪れた画面だけです。**Available offline**は、必要になる部分を1つの進行状況バーでまとめてダウンロードし、それらは接続がなくても動作し続けます。

- <!--i:monitor--> **App, catalogue and guides** - **The app**(まだ開いたことのない画面も含む、すべてのビュー、エディター、フォント)、**Catalogue**(すべて、または**Choose by tag**)、**Guides & docs**(スクリーンショットを含む、お使いの言語のこのドキュメント)。
- <!--i:cpu--> **AI models** - デバイス上で動くモデルを、それぞれサイズとともに1行ずつ表示します。音声合成の声、アップスケーリングモデル、背景の除去、文字認識、Lolly Verifyの詳細スキャン、永続クレデンシャル、Rewriterモデル、Askの照合モデル、AIテキスト検出器、歌声です。50 MBを超えるモデルには**large download**と表示されます。
- <!--i:wrench--> **Tools** - 各ツールを個別にダウンロードするか、**Download all**ですべてのツールを取得します。チェックマークは、オフラインで使えることを示します。

**Download everything**は上部にあり、アプリ、選んだ範囲のカタログ、ガイド、すべてのツールを取得します。**Include all the AI models**にチェックを入れるとモデルも追加されます。モデルの行から個別にダウンロードすることもできます。歌声は、その行からのみダウンロードできます。組織のポリシーでAIのダウンロードを無効にでき、その場合は各行にその旨が表示されます。

キャンセルしたり接続が切れたりしても、ダウンロードは中断した位置から再開します。オンラインに戻ると更新を確認し、リリースで変わった部分だけを取得します。ブラウザが永続ストレージを許可していない場合、**Protect downloads**でその許可を求めます。許可がないと、ブラウザが容量を必要としたときにダウンロードを削除することがあります。

### Lollyインスタンス

**Lolly instance**には、このインストールがツールとカタログをどこから取得するかが表示されます。インスタンスのアドレス、またはすべてがビルドに含まれている場合は*Bundled with this app*と表示されます。

- **Design-system source**は、付属のデザインシステムの取得元を表示します。
- **Instance console**は、デプロイ先に管理ページが用意されている場合に、それを開きます。
- **Change**は、デスクトップアプリの接続先を別のインスタンスに切り替えます。ブラウザは異なるオリジンからツールやアセットを読み込めないため、Webでは代わりに**Open a workspace**が表示されます。
- **Leave**は、インスタンスのデザインシステム、ツール、カタログを削除します。自分の作品は残ります。[組織でLollyを使う](/info/organisation.html#leaving)をご覧ください。
- 組織にサインインしている場合、**Sign out**はこのセッションを終了し、**Sign out everywhere**はこのデバイスを含むすべてのデバイスのセッションを終了します。

<!--i:eti-monitor-->
## このデバイス

- <!--i:monitor--> **This Machine** - 画面、入力、グラフィックス、メモリ、コーデック、ストレージバックエンドなどを、このセッションからリアルタイムで読み取ります。保存も送信も行いません。幅の広い画面では、このパネルは自動で開き、タブは2列になります。
- <!--i:neurobeat--> **Sound** - インターフェースの音とNeurospicyの集中用ループです。このタブで何かを書き込むスイッチはSoundだけです。
- <!--i:database--> **Storage** - メーターの読み取り専用ビューです。データの消去や移動は[環境設定](#storage)で行います。

<!--i:eti-palette-->
## デザインシステム

使用中のデザインシステムを、閲覧できるように表示します。このブラウザに2つ以上のデザインシステムがある場合は、上部に表紙が並びます。1つ選ぶと使用中になります。その後に表示される通知の**Undo**で、前のものに戻せます。

![Lolly DemoのDesign systemタブ: システムを切り替える表紙の列、その下にロゴ、名前、メモ、各ページを開く件数を載せた表紙](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

タブを開くと、デザインシステム独自の色を使った表紙が表示されます。ロゴ、ディスプレイ用の書体で組まれた名前、作者が書いたメモが載っています。表紙に並ぶ件数は、それぞれのページへのリンクです。

- <!--i:palette--> **Colour** - ライトとダークの表示の背景、テキスト、プライマリー、セカンダリー、名前と16進数値を添えた各色のチップ、各濃淡の段階とチャート用スペクトルの帯、折りたたまれた色の役割です。値を選択すると16進数値をコピーできます。
- <!--i:font--> **Type** - Headings、Text、Emphasis、Codeを、それぞれの書体で表示します。
- <!--i:photos--> **Logos** - 各ロゴファイルを、そのロゴに合わせた背景に表示します。
- <!--i:layers--> **Colourways** - カラーウェイが複数ある場合、それぞれのライトとダークの組です。
- <!--i:sliders--> **Tokens** - 角の半径、間隔、エフェクト、グラデーションです。
- <!--i:document--> **Print & CMYK** - 特定のインクに固定された色と、CMYK PDFで指定できる印刷条件です。

このタブで行う変更は、切り替えだけです。デザインシステムの編集は、表紙からリンクされている`#/start`の[Lolly Design System Setup](/info/brand-studio.html)で行います。読み取り専用のシステムは、表紙にそう表示されます。自分で作成したローカルのシステムは、編集可能なままです。`/b`と`/brand`は、このタブへの短縮リンクです。

<!--i:eti-grid-->
## 機能

プラットフォームのすべての部分にカードがあり、12のグループに分かれています。体験、プラットフォームとランタイム、アクセシビリティと言語、書き出し形式、読み込み形式、印刷制作、自動化とAI、決定性と再現性、ブランドとデザインシステム、プライバシーとデータの所有権、セキュリティとアクセス制御、アーキテクチャ(開発者向け)です。各グループは折りたため、カード数を表示します。カードを開くと、その機能の詳細を示すダイアログが表示されます。約半数のカードには、このドキュメントで使われているスクリーンショットもあります。

グループの上にある検索欄は、入力に合わせてカードを絞り込み、一致するカードがあるグループを開きます。検索欄には、検索対象の機能数が表示されます。一致するものがない場合は、その旨を言葉で表示します。

このタブは、これらのガイドと歩調を合わせ、Lollyでできることを説明します。使用中のマシンを調べるものではありません。その役割は**This device**が担います。

<!--i:eti-gauge-->
## アクティビティと統計

最初はビルドの情報です。読み込まれたツール数、書き出し形式数、プラットフォームが動く環境数、カタログ内のブランドアセット数を示します。**Catalogue**パネルで、このビルドに含まれるものの内訳を確認できます。

次は自分の作業です。**Your activity**は、このデバイスで作ったものを数えます。**Recent creations**と**Latest exports**は、スワイプして見られるカードの束で、項目ができると表示されます。どちらも、その項目を当時の状態で開きます。これらのカウンターはデバイス上にとどまります。任意のLolly Workインスタンスは、独自の[組織のテレメトリと監査記録](/info/privacy.html#organisation-services-with-lolly-work)を保持します。

<!--i:eti-link-->
## ディープリンク

Settingsのすべてのタブとセクションには、ブックマークや貼り付けに使える専用のリンクがあります。[Lolly Search](/info/search.html)は、Settingsと同じレジストリから**Settings**の検索結果を作るため、セクション名が変わっても検索結果のリンクは切れません。

::: details リンクのすべての形式

- **タブ:** `#/settings?tab=brand`、`#/settings?tab=caps`、`#/settings?tab=device`、`#/settings?tab=activity`。
- **Preferencesのセクション:** `#/settings?focus=<section-id>`。たとえば`#/settings?focus=offline-section`です。
- **特定のセクション:** そのIDを値のないフラグにします。たとえば`#/settings?dash-storage`、`#/settings?dash-logos`、`#/settings?dash-colourways`、`#/settings?cap-formats`です。以前の`#/settings?dash-lock`と`#/settings?dash-palette-wheel`のリンクは、表紙とColourページを開きます。
- **キーワードで指定するセクション:** `#/settings?print`、`#/settings?formats`、`#/settings?palette`(Colourページ)、`#/settings?tokens`です。2つのセクションが同じキーワードを使うことがあります。`print`はブランドタブの印刷リファレンスとPrint productionグループの両方に属し、ページ順で先にある方が優先されます。特定の方を選ぶにはIDを使います。

ディープリンクは、対象があるタブに切り替え、対象を内側に折りたたんでいるグループをすべて開きます。その後、上にあるセクションのレイアウトが終わると、対象までスクロールします。廃止された`#/platform`と`#/capabilities`のアドレスは、ディープリンクのフラグを保ったままSettingsで開きます。
:::

---

**関連:** [プロフィール](/info/profile.html)は、自分の詳細と制作する状況について説明します。[Lolly Design System Setup](/info/brand-studio.html)は、Design systemタブに表示されるものを編集するためのものです。[作品を探して復元する](/info/find-your-work.html)は、ストレージ、バックアップ、デバイスの移行を扱います。
