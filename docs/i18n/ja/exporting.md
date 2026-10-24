# ファイルを書き出す

何かを作り、それをLollyの外に出す必要があります。チャット用のPNG、印刷会社向けのPDF、同僚が編集を続けるデッキなど。**Export | Save**ピルの左半分の**Export**を押し、ファイル名の横で形式を選んで、**Download**を押します。ファイルはお使いのデバイス上で作られます。

キャンバスで見ているものが、そのままファイルの内容です。形式メニューには、このブラウザでこのツールが作れるものだけが並びます。

ほとんどの作業では、次の3つの形式のいずれかが適切です。

| 用途 | 選ぶもの | 理由 |
|---|---|---|
| 画面、メッセージ、スライド | **PNG** | どのアプリでも開け、ツールが対応していれば透明な背景を保てます |
| 完成したページや、印刷するもの全般 | **PDF** | 見た目どおりに印刷される正確なページサイズです。ツールが対応していれば、**Print PDF**は印刷所向けのCMYK版です |
| どんなサイズでも鮮明さを保つ必要があるアートワーク | **SVG** | ベクター形状で、バッジからバナーまでくっきりしています |

::: check 実際に使うサイズでファイルを確認する
送る前に、そのために作られた画面で開くか、実物大で印刷してください。
:::

::: details Lolly Workでの承認と配信(任意)
[Lolly Workを運用する組織](/info/organisation.html)は、メンバーに表示される形式と書き出し設定を管理できます。承認が必要な場合は、**Download**の代わりに**Request approval**が表示されます。お使いのインスタンスが示すポリシーに従ってください。

Lolly Workは、承認ステップ、配信の受領記録、監査記録とともに、設定されたS3、WebDAV、HTTPの送信先にファイルを配信することもできます。そのワークフローのためにファイルを提出すると、組織のサービスに送られます。通常のダウンロードはデバイス上にとどまります。個人のSend先と組織の配信は、別々に設定されます。

運用者は[組織の配信ガイド](/info/work-delivery.html)で設定します。キューに入るサーバーレンダリングとバッチについては、[CLIのバッチと自動化](/info/cli-automation.html#organisation-jobs-with-lolly-work)をご覧ください。
:::

## 書き出しの仕組み

書き出すと、ツールのキャンバスが選んだ形式にレンダリングされ、ダウンロードとして渡されるか、クリップボードに置かれます。

ファイルを作る経路は3つあります。ほとんどのツールは**キャンバスをレンダリング**します。テキストとデータの形式(HTML、Markdown、TXT、JSON、CSV、ICS、VCF)は、画像から描画されるのではなく、**ツールの内容から生成**されます。*Strip Hidden Data*のようなプライバシーユーティリティは、**選んだファイルを**お使いのデバイス上で**変換**し、キャンバス、透かし、追加のメタデータなしで返します。すでにご自身のファイルだからです。

![3つの書き出し経路が完成したファイルに合流する: キャンバスをレンダリングする、内容からテキストやデータを生成する、選んだファイルをデバイス上で変換する](/info/diagrams/concepts/three-export-paths.svg)

書き出しパネルには、これらのアクションがあります。どれを表示するかはツールの作者が選び、既定のセットはCopy、Download、Saveです。

- <!--i:download--> **Download**はファイルを保存します。後で見つからない場合は、[ダウンロードしたファイルを探す](/info/find-your-work.html#find-a-file-you-downloaded)をご覧ください。
- <!--i:photos--> **Copy**は画像をクリップボードに置き、チャット、メール、ドキュメントに貼り付けられるようにします。ブラウザが画像をコピーできない場合は、代わりにダウンロードして、その旨を伝えます。
- <!--i:folder--> **Save**は、現在のデザインをワンクリックでProjectsに保持し、ファイルはダウンロードしません。**Download**の横の**Save as**は、保存先を尋ねます([保存と続き](/info/using.html#saving-continuing)をご覧ください)。
- <!--i:link--> **Share**は共有ダイアログを開きます。デザインを再現するリンク、訪問時のトグル(全画面、書き出しパネル、開いたときのダウンロードまたはコピー)、状態全体をコンパクトなトークンにまとめる任意の**Shortest link**があります([URLモード](/info/url-mode.html)をご覧ください)。

![The export panel - format, size and the Copy / Download / Save / Share actions](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

デザインが別のツールのレンダリング、たとえばQR CodeのリンクをもつDesignの画像ボックスを埋め込んでいる場合、入れ子になったレンダリングは親の書き出しに描き込まれます。SVGとPDFでは真のベクターのままで、PNG、JPG、WebPではくっきりとラスタライズされます。埋め込まれたレンダリングには透かしも独自の来歴も付かず、付くのは完成したファイルだけです。HTML、Markdown、TXTの書き出しには、合成されたレンダリングを含められません。

## 形式を選ぶ

ファイル名とフォーマットメニューは、**ダウンロード**の下に1つの`name.format`のペアとして並んでいます。

![The filename field fused to the format picker, so the export reads as one name.format pair](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

ファイルの行き先から始めてください。各カードには、その行き先に合う形式が一覧になっており、ツールは、作れるものだけを表示します。

::: figure exporting-format-chooser
6つの行き先と、それぞれに合う形式。
:::

デザインシステムの書体で組んだワードマークは、すべての文字がアウトライン化されたパスとして、SVGで書き出されるため、1つのファイルが名刺サイズでもビルのラッピングサイズでもくっきりしたままです。

![Auroraと読める、極細で字間の広いワードマーク。表のSVGの行が扱う純粋なベクターアートワークの一例](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details すべての形式とその用途
| 目的 | 使うもの | 理由 |
|---|---|---|
| 拡大してもくっきりしたロゴやアートワーク | **SVG** | ベクター: 拡大縮小でき、小さく、編集可能。ベクター書き出しで描けないエフェクトは画像として埋め込まれる |
| OfficeやWindowsアプリ向けのベクター | **EMF** | PowerPointやWordに、ライブテキスト付きの編集可能なベクターとして貼り付けられる。Google DriveではGoogle Drawingsで開く |
| 印刷やデザインアプリ向けのベクター | **EPS**または**EPS (CMYK)** | IllustratorとプレスのワークフローのためのPostScriptベクター |
| カッティングマシン向けのベクター | **DXF** | レーザーカッター、ビニールプロッター、CNC: ミリメートル単位のアウトラインパス |
| 編集可能なスライドデッキ | **PowerPoint** (PPTX) | ネイティブで編集可能なテキストと図形。画像とベクターは取り出し可能なまま保たれる |
| 編集可能なテキストドキュメント | **Word** (DOCX)または**OpenDocument** (ODT) | ワードプロセッサーで編集を続けられる実際の段落と見出し (Doc Studio) |
| InDesign向けのレイアウト | **InDesign IDML (static subset)** | テキスト、長方形、楕円、画像。アートボード1つにつき見開き1つ (Design) |
| 編集可能なPenpotドキュメント | **Penpot** | ボード、図形、テキスト、リンクされたトークン |
| 写真または汎用の画像 | **PNG** (可逆)または**JPG** (小さい) | 汎用のラスター |
| より小さな最新の画像 | **WebP**または**AVIF** | より高い圧縮率で、透明度に対応 |
| 印刷 | **PDF**または**Print PDF** (CMYK) | 実際のページサイズ。印刷機向けにはCMYK |
| 印刷機向けのラスター | **Print TIFF** (CMYK) | RIP向けのDeviceCMYKピクセル |
| Web向けのアニメーション | **GIF** | どこでも再生できる。ファイルは大きめ |
| フルカラーで本物の透明度のあるアニメーション | **APNG** | アニメーションPNG: パレットの制限なし |
| アニメーションで最小のファイル | **Animated WebP** | フルカラーと透明度に対応し、GIFやAPNGより小さい |
| 拡大縮小できるアニメーションのベクター | **Animated SVG** | 自己完結型。ブラウザや`<img>`でループし、どのサイズでも使える (Lottie Ad) |
| 編集可能なまま残るアニメーション | **dotLottie** | Designのタイムラインからの図形、パス、外側の変形キー |
| Premiereへの受け渡し | **Premiere XML + media** | Premiere向けの、時間指定されたクリップと元のメディア (Design) |
| SNSや共有向けの動画 | **MP4**または**WebM** | ファイルサイズに対して最良の品質([動画](#video)をご覧ください) |
| キャプション | **SRT**または**VTT** | 動画プレーヤー向けの時間指定テキスト (Captions、Audiogram、Record) |
| 研修コース | **SCORM (LMS)** | バージョン付きのウェブサイト、SCORM、またはxAPIパッケージ([SCORM](#scorm-course-packages)をご覧ください) |
| リッチテキストまたはメール署名 | **HTML** | 書式付きでメールクライアントに貼り付けられる |
| プレーンな内容 | **MD**または**TXT** | テキストのみ |
| カレンダーの予定 | **ICS** | どのカレンダーアプリにもインポートできる |
| 連絡先カード | **VCF** | アドレス帳にインポートできる |
| 再インポートするための構造化データ | **JSON**または**CSV** | ツールの内容を往復できる |
| ファビコン | **ICO** | 複数サイズのサイトアイコン。**ZIP**は複数の形式をまとめる |
:::

### 透明度

対応するツールには、**No BG**などの透明な背景のトグルがあります。PNG、WebP、AVIF、SVG、APNG、Animated WebPは透明度を保ち、GIFは硬い縁を保ちます。JPGとPDFは常に不透明です。TIFFは白に、または[HDR](#hdr-bright-colours)で説明するHDR経路では黒に平坦化されます。

## サイズと印刷の単位

ツールが**dimensions**を提供しないかぎり、書き出しはツール固有のピクセルサイズを使います。提供する場合は、幅、高さ、**単位**を設定します。

- **px**(既定)は正確なピクセルです。
- **mm、cm、in、pt**、**pc**は物理的なサイズです。物理単位では**DPI**(既定は300)も設定します。**PDF**はそのサイズの実際のページになり、**ラスター**はそのDPIに対するピクセル数になって解像度を記録し、**SVG**は物理単位をピクセルのviewBoxとともに保ちます。

より高解像度のラスターには、より大きな幅と高さを入力するか、物理単位を選んでDPIを上げます(ピクセル = サイズ × DPI)。幅`210`、高さ`297`、単位`mm`でA4ページになります。

![The dimensions row set to 210 by 297 mm, with the DPI field revealed because the unit is physical](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## タイムド・コンポジションからの静止画

Designの[Sequence](/info/sequence-editor.html)タイムラインのような時間指定のあるコンポジションは動くため、静止画の書き出しでは瞬間を1つ選ぶ必要があります。それは**プレイヘッド位置のフレーム**です。プレイヘッドを目的の絵の位置に置いて書き出します。

複数の瞬間が必要な場合は、出力サイズの横に**Frames**欄が現れます。これは、時間指定のあるコンポジションと静止画形式(PNG、JPG、WebP、SVG、PDF)でのみ表示されます。プレイヘッドのフレームには`1`のままにします。値を上げると、シーケンス全体に均等に分散した、その枚数の静止画が得られます。

- PNG、JPG、WebP、SVGは、1つのZIPで返ります。`<name>-01.png`、`-02.png`と続きます。
- PDFは、その枚数のページを持つ1つのドキュメントで返ります。

各静止画はタイムラインの各区間の中央から取られるため、最初のフレームが半分フェードした登場の途中になることも、最後のフレームがすべてのクリップが終わった後の空白の瞬間になることもありません。

::: figure exporting-contact-sheet
Frames: 4は、シーケンスを4つの等しい区間に切り、それぞれの中央を取ります。
:::

ストーリーボード、レビュー用のコンタクトシート、動画編集から切り出すSNSのカルーセルに使います。枚数の上限は64で、欄にそれ以外を入力すると`1`に戻ります。各フレームは通常の静止画なので、クレデンシャル、Imprint、物理単位、DPIは、1回の書き出しと同じように動作します。書き出しリンク、CLI、MCPは、`cuts=`で同じシートを求めます([コンタクトシート](/info/url-export.html#contact-sheets)をご覧ください)。

## 一度にたくさんのファイル

Lollyには、量をこなす方法が3つあり、それぞれ別の作業向けです。

::: cols
## 表が1つのドキュメントになる
**Battlecards**のように表の入力を持つツールは、すべての行を1ページにします。スプレッドシートから表を貼り付けると、1つのPDFが得られます。行はスプレッドシートで直して、もう一度貼り付けます。
## CSVが1行につき1ファイルになる
**Batch**(`#/batch`)はCSVを受け取り、行ごとに1つの書き出しをレンダリングします。名札や証明書を1枚ずつのファイルで、ZIPにまとめて受け取れます。[Batch](/info/batch.html#make-many-versions-of-one-design)をご覧ください。
## 複数のデザインに1つの編集
**Multi-edit**は、複数の保存済みセッションを並べて開き、異なるデザインにわたって同じ微修正を行います。[Multi-edit](/info/batch.html#edit-several-saved-designs-together)をご覧ください。
:::

**Projects**の**Render folder**は、フォルダとそのサブフォルダ内のすべての保存済みセッションを、入れ子になった1つのZIPに書き出し、**Render selection**は、任意の複数選択に対して同じことを行います。保存済みセッション1つは、そのままそれ自身のファイルにレンダリングされます。保存済みセッションは、Projectsからツールのリンクとして再び共有することもでき、同じ設定で開き直されます。

## 他のアプリでも編集できるファイル

一部の形式は、画像ではなく編集可能なコンテンツとして、作業を他のアプリケーションに渡します。

### PowerPoint (PPTX)

Design、Markdown Slides、Booklet、Doc Studio、Chart、Diagrams、Flow Chart、Agendaは、1ページにつき1スライドのPowerPointデッキを書き出します。各ページはネイティブのオブジェクトに分解されるため、同僚はデッキを編集でき、そこからアセットを取り出せます。

- <!--i:font--> **テキスト**は、レイアウトのフォントサイズ、色、太さ、イタリック、配置を備えた、編集可能なPowerPointのテキストボックスになります。
- <!--i:pentool--> ロゴやアイコンなどの**ベクター**は、SVG画像として埋め込まれます。くっきりしたままで、PowerPointで*Convert to Shape*もできます。
- <!--i:photos--> **画像**は、ネイティブの解像度で、それぞれ独立した画像として渡されます。切り抜かれたヒーロー画像は、切り抜きの背後に完全な画像を保持し、そこに適用されたフィルターやブレンドは焼き込まれます。
- <!--i:layers--> **背景、境界線、罫線**は、長方形と線の図形になります。

![PowerPointを選択したエクスポートパネル：1ページにつき1スライド、テキストと図形は編集可能なまま保持される](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

レイアウトは近似であり、目的は再利用できるコンテンツです。複雑なフィルター付きやマスクされた領域など、ウォーカーがネイティブに表現できないものは、何も失われないように画像として埋め込まれます。デッキのスライドサイズは1つで、最初のページから取られます。

PowerPointは入口でもあります。[デッキをリブランドする](/info/rebrand.html)はデッキをデザインシステムに移し、[デザインを取り込む](/info/design-import.html)はDesignでデッキを開きます。

### Penpot

SVGを書き出すほとんどのツールは、Penpotで編集を続けられる**Penpotファイル**(`.penpot`)も書き出します。

| 作ったもの | Penpotでは |
|---|---|
| テキスト | 編集可能なテキストオブジェクト: タイプミスの修正やスタイル変更ができる |
| 図形、パス、グラデーション、画像 | それぞれ編集可能なベクター図形 |
| デザインシステムのトークンからの色やフォント | ライブのトークンリンク: トークンを編集すると、それを継承するすべての図形が追従する |
| デザイン全体 | Assetsパネルの再利用可能なコンポーネント |
| 複雑なイラストやライブキャンバス | 単独で画像として埋め込まれ、その周りの編集可能な内容には手を付けない |

Designからは、各フレームがPenpotのボードになります。デザインシステムの色とタイポグラフィはAssetsパネルに、完全なトークンセットはTokensパネルに入ります。そこからはPenpotが独自のコピーを保持し、Penpotで編集したトークンは、[Design System Setup](/info/brand-studio.html)のインポートを通して戻ってきます。

![Penpotを選択したエクスポートパネル：.penpotファイルと、ダウンロードの隣にあるSend to Penpot](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

ファイルを開くには、Penpotを起動し、プロジェクトを選んで**Import**を選びます。書き出しパネルからPenpotにサインインしていれば、**Send to Penpot**がその手順を代行します。

### Word、OpenDocument、InDesign

**Doc Studio**は、実際の段落と見出しを持つ**Word**(DOCX)と**OpenDocument**(ODT)を書き出します。

**Design**は、**InDesign IDML (static subset)**を書き出します。テキスト、長方形、楕円、PNGまたはJPEGの画像で、アートボード1つにつき見開き1つです。対応するインライン書式は編集可能なままで、画像は`Links`に入り、座標はInDesignのポイントになります。リンクのつなぎ直し、フォントの代替、折り返しの変化には、対応が必要な場合があります。エフェクト、アニメーション、合成されたストーリー、非対応のジオメトリがあると、書き出しはそれらを一覧にしたレポートとともに停止します。IDMLは元のドキュメントを保持しないため、完成したアートワークにはPDFを送ってください。

### タイムライン: dotLottieとPremiere

Designのタイムラインから、**dotLottie**は、Lottieツールで編集可能なままのアニメーションを書き出します。保持される内容は[Lottieアニメーション](/info/sequence-editor.html#lottie-animations)に一覧があります。**Premiere XML + media**は、時間指定されたクリップと元のメディアをPremiere向けにパッケージします。[Premiere XML交換](/info/sequence-editor.html#premiere-xml-exchange)をご覧ください。

### SCORM(コースパッケージ)

コースの書き出しは、Settings → Preferences → Feature flagsの**Training and courses**をオンにするまでオフです。

その後、対応するツール、プロジェクトフォルダ、選択範囲から**Export course**を選びます。Designでは、**SCORM (LMS)**を選んで**Download**を押すと、同じコースのワークフローが開きます。Lollyは作業を保存し、コースの内容と順序を確認させた後、モジュールとその書き出しダイアログを開きます。

- <!--i:layers--> 各ソースのレンディションを選びます。静止したページ、動画としてのモーション、音声、ダウンロード可能なリソースです。モジュール内でレッスンのテキストと代替の読み物を追加します。
- <!--i:clock--> 受講者向けプレーヤーをプレビューし、説明とキャプションを確認します。無音のアニメーションを含め、モーションは動画として含まれます。
- <!--i:document--> Website、SCORM 1.2、SCORM 2004 4th Edition、または実験的なxAPIターゲットを選びます。内容とZIPのサイズを確認し、確認したバージョンを保存してダウンロードします。
- <!--i:check--> 完了には、必須のすべてのレッスンを確認済みにして、Finishを選ぶ必要があります。

![The export panel on a Design deck with SCORM (LMS) chosen](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

パッケージには完成した内容が含まれ、Lollyのアカウントは不要です。Website ZIPはHTTP(S)ホストに置き、LMS ZIPはそのままインポートします。コースを共有する前に、行き先をテストしてください。複数の保存済みの作品から作るコースについては、[研修コースを作る](/info/training-creators.html)をご覧ください。

### DXF(カット用ファイル)

Asset Export、Diagrams、Growth、Logo Wall、QR Code、Street Map、Wayfinding、Wordmarkは、レーザーカッター、ビニールプロッター、CNCソフトウェアが読むAutoCAD R12の交換形式である**DXF**を書き出します。ジオメトリはミリメートル単位のアウトラインパスとして書かれ、テキストはアウトライン化され、色は最も近いAutoCADカラーインデックスに対応付けられ、これが通常、カッターの動作を決めます。DXFは線画だけです。写真やフィルター付きの領域にはカットパスがなく、警告とともに除外されます。ラスターの内容を保つには、SVGまたはPDFを使ってください。

Street Mapは最も分かりやすい例です。デザイン全体がすでに線なので、すべての道路と運河がカットパスになります。

::: showcase
![クリーム色にインクで描かれたパリのStreet Mapレンダー - 純粋なライン画なので、すべてのストロークがカッターへの持ち込みで残ります](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

スクロールすると、カメラは実際のジオメトリを通り抜けるように引いていきます。7本のパスのみで、どこにもピクセルはなく、どんなズームでもすべてのストロークがヘアラインのように鮮明です。これはカッターが読み取るのと同じファイルです。
:::

## 印刷

**Print PDF**は、指定された印刷条件(既定は**Coated FOGRA39**)に基づいてCMYKを書き出します。測定されたインク値を持つブランドのスウォッチは正確に変換され、それ以外の色は標準的なデバイス変換を使います。**Print TIFF**は、RIP向けのDeviceCMYKピクセルを書き出し、同じ印刷条件をTIFFのメタデータに記録します。どちらも、Colour profileコントロールが制御します。詳細は[カラープロファイル](#colour-profiles)をご覧ください。

**Print marks & bleed**は、印刷形式に専用のカードがあります。ミリメートル単位の裁ち落としと、Crop、Registration、Bleed、Colour bars、Stamp detailsです。

*Booklet*ツールのように、**複数ページのPDF**を作るツールもあります。表紙、必要なだけのページに流れるコンテンツ、裏表紙で構成され、各ページはA4、USレター、A5の縦向きの本物のPDFページで、どのブロックでも強制的に新しいページに送れます。これらはトンボや裁ち落としのないRGBドキュメントで、トンボや裁ち落としは、単一ページのPrint PDFのものです。DesignのPDFは、各スライドの下にスピーカーノートを置いた縦向きのページである**Notes handout**にもできます。

**書き出す前に。** パネル下部の**Before you export**カードは、印刷会社がこれから見るものを伝えます。形式、サイズ、裁ち落とし、トリムと裁ち落としの領域、インク使用量、版数、ページ数と、見出しの横の判定です。書き出しをブロックすることはありません。Designは、デザインシステムの運用ルールをレイヤー単位で確認するものや、ドキュメントのテキストの文章シグナルなど、独自のチェックを含むカードを常に表示し([書き出す前に](/info/design.html#before-you-export))、**Print preflight**がオンのときは、これらの印刷チェックも加えます。他のツールでは、Settings → Preferences → Feature flagsで**Print preflight**をオンにします。既定ではオフで、Lolly Workの配備は、メンバー向けにオンにできます。

**書き出した後に。** ファイルができると、Lollyはそれを読み戻し、選んだ設定と比較します。形式、ピクセルまたはページのサイズ、クリップの長さ、透明な背景、CMYKの色、HDR、Content Credentials、PDFまたはZIPのパスワードです。違いがあれば、書き出しカードに記されます。各測定値は設定ではなくファイルから取得し、ファイルが答えられない性質は、一致としては数えられません。コマンドラインは`--export-report`で完全な比較を書き出します([CLIでレンダリングする](/info/cli-rendering.html)をご覧ください)。

Designのインスペクターによるチェックと、Design System Setupでのブランド比較は別のチェックです。それらはデザインを見るもので、この2つのカードはファイルを見るものです。

::: details レートカードからの費用
プリフライトの下に、費用カードがあり、同じ数量を、誰かが提供した価格だけを使って金額に変えます。プリフライトのカード自体がオフでも、それらの数量を読み取ります。必要なのは2つです。価格表で値付けできるジョブ(版、枚数、面積、ページ、バリエーションの行、出力ファイルなどで、単純なロゴのPNGでは表示されません)と、印刷会社から入手した価格表のJSONである**レートカード**です。既定のビルドにはレートカードがなく、アプリ内で読み込む方法もありません。レートカードは、配備が出荷するカタログアセットとして、またはセルフホスト環境やコントロールプレーンがオンにする任意のレートカード拡張を通して届きます。レートカードがなければ、何も表示されません。

すべての数字は、提供されたレートにLollyが数えた数量を掛けたもの、たとえば`4 plate × €35.00`であり、合計にはその出典が付きます。カードの発行者と、そのレートの日付です。既定の通貨も、仮の価格もありません。ファイルが自身について語ることは、伝聞のままです。*"The file says: … Lolly has not verified this."*

数字を算出できない場合、表は埋められるのではなく、取り下げられます。

- カードが値付けしない行がある場合、**合計はまったく**表示されず、値付けされていない行数を示す見出しだけが出ます。
- 上限である数量は、小計に**"up to"**を付けます。
- 有効期限を過ぎたレートは、*Use these rates anyway*を押すまで**数量のみ**を表示し、その後は、有効期限が数字とともに示されます。
- **リンク**から開いた場合、このデバイスで求めるまで金額は非表示のままです。CLIは`--rate-card=<file.json>`をローカルファイルとして受け取り、リンクパラメーターとしては受け取りません。

このカードはすべての書き出しステージから取り除かれるため、ファイルが変わることはありません。これは計算であって見積もりではなく、見積もりを出せるのは印刷会社だけです。
:::

## モーションとサウンド

### 動画

アニメーションするツールは**MP4**と**WebM**を書き出します。ピッカーにはこのブラウザが作れるコンテナだけが表示され、作れない形式を求める共有`?format=`リンクは、もう一方にフォールバックし、ファイル名もそれに合わせます。アニメーションするツールには、録画の前にキャンバスをしばらく静止させてアニメーションとフォントが落ち着くようにする**Start after**と、完成したクリップの長さを示す**Duration**もあります。**Motion blur**(Off、Draft quality、Standard、High。**Shutter angle**付き)は、レンダリング時間と引き換えに速い動きをぼかします。ブラウザが対応している場合、**Record live**は、画面共有を通して画面上のプレビューをリアルタイムで録画します。

![アニメーション書き出しのタイミング設定: Start after、Duration、Shutter angle付きのMotion blur、Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality**では、Smaller file、Balanced、Best qualityを選びます。**Advanced**は、**Codec**、**Frame rate**、**Rate mode**、**Hardware acceleration**を開きます。ツールにキャプションがある場合、**Captions**は、**Embedded track**か、動画の横の**Sidecar .vtt + .srt**を選びます。リンクは、品質、コーデック、フレームレート、継続時間、開始の遅延を`vq`、`codec`、`fps`、`seconds`、`wait`として運びます([URLパラメーター](/info/url-parameters.html))。

動画の書き出しは音を保ちます。ツールは、クリップの下に**ミュージックベッド**を敷くことができます。クリップの長さに合わせてループまたはトリムされた音声アセットで、フェード、音量、映像自身の音の下でのダッキングを備えます。録音ツールは、ライブの音声をファイルまで運びます。

クリックで進めるデッキのままのDesignデッキも、動画として出力できます。Presentメニューの**Export slides as video**は、MP4で書き出しシートを開きます。各スライドは、それぞれの滞在時間、またはそれがない場合は書き出しシートのDurationだけ再生され、スライド間にはデッキのスライドトランジションがディゾルブとして再生されます。ドキュメント自体は変わりません。

### アニメーション画像

**GIF**はどこでも再生でき、チャットやメールに向きますが、動画よりサイズが大きく、色数が少なくなります。**APNG**と**Animated WebP**は、フルカラーと透明度を保ちます。**Lottie Ad**は、**Animated SVG**も書き出します。CSSのキーフレームが埋め込まれたベクターフレームで、どのサイズにも拡大縮小でき、ブラウザのタブや`<img>`でコーデックなしにループします。テキストはアウトライン化され、各フレームがビットマップより重いため、既定のフレームレートは低めです。これらはすべて無音です。

### 音声

音だけを書き出すツールもあります。**Voice Recorder**は、ライブのレベルメーター付きでマイクのテイクを録音し、お使いのデバイス上でエンコードして、**MP3**、**WAV**、**M4A (AAC)**、**Opus (WebM)**として保存します。`wav`、`mp3`、`m4a`、`opus`は通常の形式IDなので、音声の書き出しはPNGと同じように共有、スクリプト化できます。

アセットピッカーは、ミュージックベッドとして、MP3やFLACからMIDIやトラッカーモジュールまで、幅広い音声を受け付けます。一覧は[形式](/info/formats.html)にあります。[Rondocodeの曲](/info/rondocode.html)は、クリップが求める長さで再生されます。

## 色とHDR

Lollyは、現代のCSSの色をすべて読み取り、色の計算を知覚的に行い、各ファイルを読み手が開ける色空間で書き出します。画面向けのsRGB、印刷向けのCMYK、HDR向けのRec.2100 PQです。その仕組みは[エンジンの色](/info/colour-engine.html)で説明しています。**Wide colour / HDR**に設定したDesignドキュメントは独自のルールに従い、[広色域とHDR編集](/info/hdr-editing.html)に書かれています。

### カラープロファイル

書き出しにはカラープロファイルが付くため、印刷会社、Photoshop、ブラウザなどのカラーマネジメント対応アプリが、見たとおりに色を読み取ります。これは自動で行われ、サムネイルとプレビューは、小さく保つためにタグを省きます。

- **PNGとJPG**は、プレビューが描かれる色空間である**sRGB**のICCプロファイルを埋め込みます。ピクセルはタグ付けされ、再エンコードはされません。
- **Print PDF (CMYK)**は、*OutputIntent*に印刷条件を宣言し、そのCMYKインクをどう読むべきかを印刷会社に伝えます。
- **Print TIFF (CMYK)**はタグなしのDeviceCMYKピクセルを書き出し、印刷条件をTIFFのメタデータに記録します。TIFFは印刷プロファイルを埋め込めないため、**Embed**行が記録するのはそのプロファイルの名前だけです。
- **TIFF (RGB)**は、アーカイブやエディターでの往復用の、非圧縮のsRGBの兄弟形式です。透明度は白に平坦化されます。どちらのTIFFもデスクトップ専用です。ブラウザはTIFFをプレビューできないためです。
- **SVG**、**EMF**、**EPS**、**DXF**は、プロファイルを埋め込まないベクターです。SVGの色はsRGB、EMFとEPSはデバイスRGBを使い、**EPS (CMYK)**はDeviceCMYKを書き出し、DXFはAutoCADカラーインデックスを使います。SVG、EPS、DXFはテキストをパスにアウトライン化します。EMFは、OfficeとGoogleスライドでテキストをライブで編集可能なまま保ち、形式で表現できないランのみアウトラインにフォールバックします。書き出しパネルの**Outline fonts**オプションは、すべてをパスにします。SVGは、CSSのボックスシャドウも内側と外側の両方で再現します。

::: details PDF/X-4と独自の印刷プロファイル
LollyにはCMYKプロファイルが同梱されていません。名前付きの印刷条件は、PDF/X-4はプロファイルの埋め込みを求めるため、PDF/X-4への適合を主張せずに出力インテントを書き出します。

ご自身のCMYKプロファイルを読み込み、Colour profileコントロールの**Embed**行を選びます。それはファイルの*DestOutputProfile*として埋め込まれ、ファイルの他の部分が許すかぎり、PDFはPDF/X-4を主張します。宣言される印刷条件は、そのプロファイルから読み取られます。プロファイルが証明できる場合は登録名、そうでなければプロファイル自身の名前での`Custom`です。

出力インテントを保ったまま、主張を保留するものが3つあります。CMYKへの変換パスが変換できなかったRGBのアートワーク、`prov`の校正マージンのクレジットテキスト(埋め込まれていない標準フォントで描画される)、**Strong**パスワードです。PDF/X-4は暗号化を禁止しているためです。すべてのPDFには、ページボックス、XMP、ドキュメントID、プロファイル付きのsRGB出力インテントというPDF/X-4のメタデータも付きます。
:::

### HDR(明るい色)

これは、通常のアートワークをHDR画面向けに明るくする、書き出しパネルの**HDR**カードです。編集を通じてHDRの原本を保つのは別の機能で、[広色域とHDR編集](/info/hdr-editing.html)にあります。

通常の書き出しはsRGBです。彩度の高いブランドカラーは、画面の通常の白と同じ明るさです。HDRディスプレイには、それを超える余裕があります。**HDR**カードは、ブランドカラーと白いテキストをピークの明るさに向けて持ち上げ、暗い部分は暗いままにして、輝きにコントラストを与えます。

![エクスポートパネルのHDRカード(オンの状態)。White / Reach / Dark lift / Focusのダイヤルが下に展開されている](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **形式。** PNG、JPG、AVIF、TIFF。WebPは8ビットでHDRのデコード経路がなく、ベクターとPDFにはHDRのモデルがありません。
- **既定ではオフ**です。ピクセルが変わるためです。カードにチェックを入れるか、共有リンクで`hdr=1`を渡します。
- **ダイヤル。** **White**(ピーク輝度の上限、400〜2000ニト)、**Reach**(輝きがトーンのどこまで下に広がるか)、**Dark lift**(暗部をどれだけ明るくするか。`0`は暗いまま)、**Focus**(持ち上げが保つ色の豊かさ)。これらは1つの値として運ばれます。`hdr=1600-60-0-50`は、White 1600、Reach 60、Dark lift 0、Focus 50です。
- **書き込まれるもの。** PNGは、`cICP`チャンクを持つ16ビットのRec.2100 PQになります。JPGは、ISO 21496-1のゲインマップJPEGで、通常のSDR画像に、ゲインマップが追加されます。AVIFは、書き換えられた`colr`ボックスを持ちます。TIFFは、`cicp`タグを持つ生成されたICC v4プロファイル付きのPQピクセルになり、黒に平坦化されます。PQでは白が10,000ニトのコードであり、すべての縁にハローが出るためです。持ち上げは、知覚的な(OKLab)明度に従い、色相を保つため、ブランドの緑はミントっぽくならず、明るくなります。
- **輝きが見える場所。** HDRディスプレイ上の、カラーマネジメント対応のビューアー。Apple端末のプレビュー、Quick Look、Safari、またはHDRモニター上のChromeです。SDR画面では通常の画像が表示されます。
- **出荷する前に。** 多くのプラットフォームはアップロードを再エンコードしてHDR信号を取り除き、画像が暗くなったり色あせたりすることがあります。自分のサイト、ビデオウォール、明るいパネル上のデッキなど、行き先を管理できる場所でHDRを使ってください。
- **ターミナルから。** `--export=png`または`--export=jpg`と組み合わせた`--hdr=1`は、同じエンジンのエンコーダーを使い、ブラウザなしで、[CLI](/info/cli.html)で同じPNGとゲインマップJPEGを書き出します。AVIFとTIFFは当面、Web書き出しのままです。

## ファイルに付いて回るもの

完成したファイルは、画像の横に複数の記録を持てます。ピクセルの横に付くものは、ファイルを保存し直したり取り除いたりすると消えます。ピクセルの中に直接ある印が2つあります。

::: figure exporting-what-travels
それぞれの記録がどこにあるか、既定でオンかどうか、どのリンクパラメーターで制御されるか。
:::

書き出しパネルは、**Licence**、**Source credits**、*Password protect*、**C2PA Credentials**、**Lolly Imprint**、**Durable credential**を、選んだ形式で使えるカードだけを表示する1つの**Content protection**グループにまとめます。リンクやドキュメントがすでにライセンスを宣言している場合、またはソースにあなたの判断が必要な場合は、自動的に開きます。**Design system**カードはグループの外にあり、すべての書き出しで見えます。

![PNGエクスポートで開かれたContent protectionグループ。適用されるカードのみが表示されている](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### 来歴と透かし

形式にフィールドがある場合、書き出しには**来歴メタデータ**が付きます。ソフトウェア、出所、ツール名、プロフィールのクレジット行が、PNGのiTXt、JPEGのEXIF、PDFのinfo、SVGの`<metadata>`、GIFのコメントに書き込まれます。これは作者の情報だけを記録し、何もアップロードされません。**Experimental**のツールは、目に見える透かしも入れ、これはホストが適用するため、ツールを編集しても消せません。

**Lolly Imprint**は、目に見えないピクセルの透かしで、**既定でオン**です。クレデンシャルとメタデータはピクセルの横に付くため、保存し直し、スクリーンショット、メタデータの除去で失われます。Imprintはピクセルの中にあり、再圧縮にも耐えるため、コピーがLollyで作られたものだと認識できます。これは暗号的な保証ではなくヒントであり、個人データは含みません。JPEG XL、PNG、JPG、WebP、AVIF、TIFF、BMP、およびLollyがPDFやPPTXにレンダリングするラスターに含まれ、ご自身が埋め込んだ画像には含まれません。**Lolly Imprint**のチェックを外すか、`imprint=0`を渡すと、Imprintが付きません。AVIFの再エンコード後の残存は、まだ校正されていません。[Verify](/verify)はお使いのデバイス上でこれを検出します。[Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint)をご覧ください。

**Durable credential**は、TrustMark形式のデバイス上のニューラルモデルでLollyのIDをピクセルに書き込むため、「Lollyで作成」のリンクはメタデータの除去や再エンコードの後も残り、TrustMark対応のツールで読み取れます。書き出しごとにニューラルパスが必要で、モデルの一度限りのダウンロードがあるため、**既定ではオフ**です。PNG、JPG、WebP、AVIF、TIFFが対象で、パネルでチェックを入れるか`durable=1`を渡します。デスクトップアプリとモバイルアプリでは、オフラインでモデルを取得する取得元がないため、このカードは非表示です。

**Licence。** 他の人がどのようにあなたの作品を使えるかを選びます。既定は*None (all rights reserved)*、CC0 1.0、Public Domain Mark 1.0、またはクリエイティブ・コモンズ4.0ライセンス(BY、BY-SA、BY-NC、BY-NC-SA、BY-ND、BY-NC-ND)です。ライセンス名とその証書へのリンクは、ファイルのライセンスメタデータ(形式にあればEXIF、XMP、RIFF)とContent Credentialに書き込まれます。この選択はドキュメントとともに保存され、リンクでは`licence=`として運ばれます。Lollyが書くのは選んだライセンスであり、条件の確認も強制もしません。Claimのように独自のライセンス欄を持つツールは、その欄を優先します。

### デザインシステムの記録

書き出しには、ファイルを作ったデザインシステムが記録されます。その名前、描画に使われた公開バージョン(作業中のバージョンでない場合)、描画された[カラーウェイ](/info/colourways.html)です。デザインシステムが宣言する密度などの他のテーマの選択も、同じように記録されます。ライトとダークの選択は、画像を見ればどちらが使われたかわかるため、省かれます。

**何かが書き込まれる前に、その記録を確認できます。** 既定でチェックが入った**Design system**カードは、*Records: Acme · Colourway: Beach*のように、ファイルが運ぶ正確な言葉と、読み取られる説明を表示します。デザインシステムの名前は所有者が入力したものなので、カードは書かれたとおりに表示します。カードのチェックを外すと、その書き出しから記録が省かれます。Designのドキュメントパネルには、*Embedded in exports*の下に同じ言葉が表示されます。

**説明は、ツールの横にカラーウェイを示します。** カードにチェックが入っていると、*"Made with https://lolly.tools : Chart"*は*"Made with https://lolly.tools : Chart (Beach colourway)"*になります。デザインシステム自身の名前は説明ではなく記録に残ります。ツール名のない説明や、ツールが自身の入力から書く説明は、そのままです。`tokenAxes`でカラーウェイを無視するツールは何も記録せず、PDFの校正クレジット(`prov`の印刷マーク)も同じルールに従います。

**エージェントを導いたブランドスキル。** エージェントが作品を作り、読んで従った[ブランドスキル](/info/brand-skills.html)を指定した場合、記録には各スキルがリビジョン付きで、*Guided by: acme-brand 1.0*のように一覧されます。この言葉は、そのスキルが作業を導いたことを意味します。確認ではありません。Lollyは作品をスキルに照らして検証しません。一覧を加えるのはエージェント自身の申告だけで、現時点では[MCPサーバー](/info/mcp.html)の`lolly_render`の`brandSkills`引数を指すため、アプリや共有リンクで作った作品には付きません。Content Credentialは、一覧を各スキルのID、名前、リビジョン、SHA-256ハッシュを持つ1つのJSON値として`brandSkills`に保持します。XMPパケットとSVGのメタデータは、同じ値を`lolly:BrandSkills`として保持し、記録から書かれたPDFにはスキルごとに1つのキーワードが加わり、説明は変わりません。社内スキルは、そのテキストではなく、ID、名前、リビジョン、ハッシュで記録されます。同じスイッチが、記録の他の部分とともに一覧を省きます。**Design system**カード、`_madewith=0`、`--no-madewith`、`madeWith: false`です。MCPサーバーがブラウザでファイルを描画する場合(PDF、JPEG、ブラウザなしの経路では書けないその他の形式)、ファイル自身のメタデータには一覧が入らず、Content Credentialだけが保持できます。記録を残すには`c2pa`を渡してください。クレデンシャルがない場合、レンダリングはブランドスキルが記録されなかったと警告します。

**記録を読み戻す。** [Verify](/verify)は、ファイルのクレデンシャルの詳細にその記録を**Design system**として、ブランドスキルを**Guided by**として一覧表示します。*Recreate with these settings*は、記録されたバージョンとカラーウェイでツールを開き直します。このデバイスに同じIDと名前のデザインシステムがある場合、リンクは記録されたデザインシステムで開き、ない場合は現在有効なデザインシステムで開きます。

::: details 何がどこに書き込まれるか、どの実行で記録が省かれるか
| 場所 | 書き込まれるもの |
|---|---|
| Content Credential | `tools.lolly.export`アサーション内の`designSystem`(ID)、`designSystemLabel`、`designVersion`、`themes`。いずれも通常のテキスト値で、`themes`は選択のJSONリスト |
| PNG、JPEG、WebP、JXL | ファイルのXMPパケットの`lolly:`プロパティとしての同じ4つの値(名前空間`https://lolly.tools/ns/export/1.0/`) |
| SVG | `<metadata>`ブロック内の同じ`lolly:`プロパティ |
| PDF | *Design system: Acme*や*Colourway: Beach*のようなキーワード |
| 説明欄を持つすべての形式 | ツールの横にカラーウェイが付いた説明 |

このカードが表示されるのは、記録するものがあり、形式が記録を保持できる場合だけです。CSV、JSON、カレンダーファイル、その他のテキストやデータ形式にはメタデータがなく、EPS、EMF、DXF、BMPには記録用のフィールドがありません。HTML、Markdown、CSSは、記録をContent Credentialにのみ保持するため、それらではカードに説明の行が表示されず、**C2PA Credentials**がオフの間は非表示になります。デザインシステムが与えないフィールドは、ファイルには入りません。

共有リンクは`_madewith=0`で記録をオフにします([URLパラメーター](/info/url-parameters.html))。コマンドラインは`--no-madewith`、[MCPサーバー](/info/mcp.html)の`lolly_render`は`madeWith: false`を受け付け、ターミナルアプリの書き出しパネルには**Design system**行があります。コマンドラインは、ツールのレンダリングと、保存済みのDesignセッションから`lolly run`が書き出す各ファイルについて、完成したファイルが運ぶ言葉を標準エラーに出力します。MCPのレンダリングは、ファイルの横に出力し、どちらもファイルから読み戻したものです。コマンドラインがブラウザなしで描画するPNGはファイルのメタデータを持たないため、その記録はクレデンシャルだけで運ばれます。デバイス上のユーティリティは、メタデータをまったく追加しません。

**Design system**カードのない実行では、記録は省かれます。Batchの実行、Projectsから書き出したフォルダ、3Dコレクションの書き出し、そしてターミナルアプリでのCSVバッチ、Projectsのフォルダまたは選択範囲の書き出し、すべてをレンダリングするビューです。デザインシステムを記録するには、ツールから1つのファイルを書き出してください。
:::

### Content Credentials (C2PA)

書き出しには**Content Credentials**を付けられます。ファイルのバイト列のハッシュに結び付けられ、後の編集が検出可能になる、何が、いつ、どこでファイルを作ったかを記録する署名付きの[C2PA](https://c2pa.org)マニフェストです。仕様はC2PAが公開しており、Lollyは、どのC2PAリーダーでも検査できる標準のマニフェストを書き出します。

![チェックが入ったC2PA Credentialsカード。チェックボックスの横にクレデンシャルの有効期間](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **既定でオン。** **C2PA Credentials**カードは、ほぼすべてのツールで最初から選択されています。1回の書き出しでチェックを外すか、リンクで`c2pa=off`を渡します。ツールはマニフェストでオプトアウトできます。
- **形式。** PDF(RGBとPrint)、PNGとAPNG、JPG、GIF、SVG、TIFF(RGBとPrint)、WebP(静止画とアニメーション)、AVIF、MP4、WebM、音声コンテナのMP3、WAV、M4A、OGG/Opus、FLAC、HTML、Markdown、CSSです。ZIPは対応する各メンバーに署名し、Animated SVGが付与される仕組みもそれです。MP4、AVIF、M4Aは標準のBMFFバインディングを、MP3はそのID3v2マッピングを使うため、`c2patool`などのリーダーで検証できます。WebMとOGG/Opusにはまだ標準のマッピングがないため、LollyはマニフェストをMatroskaの添付ファイルとOpusTagsフィールドで運び、Lolly自身の検証機構が確認します。ICO、EPS、EMF、DXF、BMP、PPTX、Office形式、その他のテキストやデータ形式には、C2PAのコンテナがありません。
- **記録するもの。** ファイルを作ったツールとアプリ、署名時刻、書き出したシェル、**Design system**カードにチェックが入っている間は[デザインシステムとカラーウェイ](#the-design-system-record)、有効な入力のフィンガープリントです。入力テキスト、プロフィールにバインドされたフィールド、無効なコントロール、ブラウザのバージョン、オペレーティングシステムの詳細は含まれません。お名前とメールアドレスが作者として現れるのは、Settings → Preferences → Your detailsで**Use my details to create**がオンのときだけです。書き出しが配置するソースは、素材として運ばれます。絵文字などの[出典のある作品](#source-credits)と、動画または音声の書き出しにある[Rondocodeの曲](/info/rondocode.html#songs-in-the-credential)です。
- **受け取る人に見えるもの。** Adobeアプリ、`c2patool`、contentcredentials.org/verifyなどのC2PAツールは、マニフェストを読み取り、主張を表示します。Lollyは、信頼リストの証明書ではなく、お使いのデバイスで作られた鍵で署名するため、ビューアーは*未検証*のクレデンシャルと報告します。構造と改ざんの証拠は本物ですが、署名者は保証されていません。これを変えるには、Settings → Preferences → Content Credentialsで**認証済みID**を登録します。[Content Credentialsのアイデンティティ](/info/content-credentials-identity.html)をご覧ください。
- **ファイルを確認する。** 任意のファイルを[Verify](/verify)にドロップするか、`lolly validate <file>`を実行すると、Lollyがファイルを作ったか、その後変更されたかを先頭に置いた、デバイス上のレポートが得られます。Verifyはクレデンシャルの外も調べます。[Verifyが確認すること](/info/what-verify-checks.html)をご覧ください。
- **プライバシー。** 署名鍵は書き出しのために作られ、デバイスの外へ出ることはなく、主張が保持するのは、来歴メタデータがすでに運んでいるものだけです。ご自身のファイルを変換するプライバシーユーティリティは、クレデンシャルを追加せず、*Strip Hidden Data*は、他のメタデータと同じようにC2PAマニフェストを削除します。Rondocodeユーティリティは新しい音声を作るため、書き出すものに署名します([Rondocodeの曲](/info/rondocode.html#files-from-the-rondocode-utility))。
- **相互作用。** パスワード保護されたPDFは、どちらの階層でもContent Credentialsを運べません。クレデンシャルは、DPI、EXIF、カラープロファイル、PDF/Xのメタデータ、印刷マークの後に、完成したバイト列の上に最後に追加されます。

### ソースクレジット

他の人の作品を配置する書き出しは、そのソースをクレデンシャルに記録します。身近な例は、選んだ絵文字セットから描かれる絵文字です。作品、その作者、ライセンス、正確なバイト列の出どころ、何が変更されたかが、ファイルとともに運ばれます。テンプレートがSVGであるツールのテキストは、システム自身の絵文字を保つため、そこには何もクレジットされません。**Source credits**行は、ダウンロードの前にソースが配信に何を求めているかを伝え、ダウンロードの後は、クレジットがファイルに入っていると言う前に、配信したバイト列を読み戻します。共有しようとしている色変更されたCC BY-SAのグリフのように、あなたの選択を求めるライセンスには、選択肢のあるカードが表示されます。ダウンロードがブロックされることはありません。文言、確認済みのライセンス、ご自身のものとして残るものは、[クリエイティブの権利とクレジット](/info/creative-rights.html)にあります。

## パスワード保護

2種類のロックがあり、どちらもお使いのデバイス上で作られます。書き出しパネルの*Password protect*カードが、両方を操作します。

![PDFエクスポートで展開されたPassword protectカード。パスワード欄と2つのロック階層が表示されている](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**PDFの開くためのパスワード**は、パスワードを入力すると2つの階層があります。

- **Weak**: 40ビットのRC4で、保護ではなく抑止力にすぎません。そのパスワードは、共有リンクに平文で含められます。RGBの`pdf`のみです。
- **Strong**: AES-256(PDF 2.0)。書き出し時に入力し、リンクには入れられません。Print PDFと、バッチZIP内の各PDFにも適用されます。Strongでロックされたprint PDFは、CMYK、トンボ、出力インテントを保ちますが、PDF/X-4の主張は外れます。

**ロックされたZIP**は、ZIPの書き出し、Projectsからのフォルダのダウンロード、バッチを対象とし、2つの階層の1つのパスワードを使います。**Weak**(ZipCrypto。抑止力で、`?password=`リンクに含められる)または**Strong**(AES-256。書き出し時に入力し、リンクには入れられない)です。パスワードはすべてのメンバーを保護し、中のPDFも独自にAES-256でロックされるため、ZIPを展開した後もロックされたままです。プロンプトはダウンロードの開始時に表示され、空のパスワードはロックなしを意味します。

**パスワードで保護された共有リンク**は、開く前に受け取る人にパスワードを求めます。リンクの状態全体が、パスワードから導かれた鍵(PBKDF2)でAES-256により暗号化されるため、運ばれるのは暗号文だけで、復号は受け取る人のブラウザで行われます。リンクを配信するサーバーは、パスワードもデザインも見ることがありません。**Share**ダイアログでオンにします。暗号化されたリンクはLollyでのみ開き、埋め込み画像としては開きません。[URLモード](/info/url-mode.html)をご覧ください。

## スマートフォンでの表示

書き出しコントロールは、フローティングの**Export**ボタンの後ろにあり、これは**Export**シートを開きます。同じ形式、サイズ、コピー、ダウンロード、共有を、タッチ向けのサイズで提供します。

## リンクとCLI向けの形式ID

これらは、URLの`format=`パラメーターとCLIの`--export=`フラグの値です([URLパラメーター](/info/url-parameters.html)と[CLI](/info/cli.html)をご覧ください)。ツールのメニューには、そのツールが作れる形式だけが表示されるため、この一覧より常に短くなります。

| 種類 | ID |
|---|---|
| ラスター | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| ベクター | `svg` · `svgz` (gzip圧縮のSVG) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (カット用ファイル) |
| ページとドキュメント | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (Penpotのデザインファイル) · `scorm` (コースパッケージ。ZIP) |
| モーション | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| 音声 | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` |
| テキストとデータ | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `css` · `scss` · `gpl` (GIMPパレット) |
| バンドルとパッケージ | `zip` · `rpm`と`tar.gz` (レンダリング結果をLinuxパッケージに封じたもの) |

一部のIDは、ツール自身の書き出しコードに由来します。`ase`(Palette LabのAdobe Swatch Exchange)と、`exr`および`hdr`(Darkroomの高ダイナミックレンジのラスター)です。**Convert Font**は、ご自身が提供するフォントファイルから`ttf`、`otf`、`woff`を書き出すため、単なるリンクではレンダリングするものがありません。
