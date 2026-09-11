# Lolly を使う

アプリを実際に*使う*ための実践ガイドです。ツールを開き、キャンバスで作業し、書き出し、保存し、共有するまでを扱います。ここで扱う処理はすべて**お使いのデバイス上**で動きます。アカウントもアップロードも不要で、最初の読み込み以降はインターネット接続も要りません。

> はじめてですか。[クイックスタート](/info/quickstart.html)なら数分で制作を始められます。アプリの導入や配備については[運用者向け Lolly](/info/operators.html)をご覧ください。このページは、開いたあとの操作を扱います。

## ツールを開く

ホーム画面は**ギャラリー**で、すべてのツールがカテゴリー別に並びます。カードをクリックするとツールが開きます。以前に作業したことがあれば、**Continue** ボタンで直近のセッションを再開できます。検索ボックスで名前を絞り込めます。一覧系の 6 画面（ギャラリー、Utilities、Projects、カタログ、ダッシュボード、プロフィール）の下部にあるバーからは[検索](/info/search.html)が使え、ツールだけでなく保存した作業、カタログ、設定にも届きます。ツールの中では、このバーはツール自身の操作領域に場所を譲ります。

![ツールギャラリー。すべてのツールがカードとしてカテゴリー別に並ぶ](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&filename=gallery&try=1)

どのツールも分割ビューです。一方に**コントロール**、もう一方にライブの**プレビュー**（キャンバス）があります。コントロールを変えると、プレビューは即座に更新されます。

![あるツールの分割ビュー - 左側にコントロールスタック、右側に描画されるライブのグループ棒グラフ](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

> 一部のツール（**Design** など）は代わりに**フリーキャンバス**として開きます。装飾のない直接操作の作業面で、テキスト・図形・画像のボックスをドラッグ、リサイズ、回転、スナップでき、ダブルクリックでその場でテキストを編集できます。書き出しは他のツールと同じレンダーパスを通るため、キャンバスがそのままファイルになります。下の[フリーキャンバス](#the-free-canvas-design)をご覧ください。

グリッド自体を自分好みに整える方法は 2 つあります。

- <!--i:star--> **よく使うものにスターを付ける。** カードに ★ を付けると、グリッド上部の帯に専用の大きなタイルとして並びます。[お気に入り](/info/favourites.html)をご覧ください。
- <!--i:eyeoff--> **使わないツールを隠す。** カードを右クリック（または複数選択して選択バーを使用）→ **Hide tool**。そのツールはグリッドから外れ、グリッドで入力して探しても出てこなくなります。末尾にあるグレーの **Show hidden tools (N)** タイルで、薄く表示された状態で再び現れ、それぞれのメニューに **Unhide tool** が入ります。非表示はあなたのグリッドだけの話です。保存したリンクやブックマークからは今までどおり開きますし、他の人の画面では元のままです。

![非表示ツールを表示した Tools グリッドの末尾。薄く表示された QR Code Generator のカードと、その隣で表示を切り替えたグレーのタイル（今は Hide hidden tools と表示）](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-bulk%3D%22hide%22%5D%3Bwait%3A300%3Bclick%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed it. The alt says so rather than quoting the resting
label the prose above already gives.
There is no standalone per-card "hide" button
(unlike the always-visible fav/pin corner icons) - Hide only exists inside a
tile's right-click menu or the bulk bar, both confirmed in views/gallery.ts.
The recipe goes the bulk-bar route since it needs no `|right` context-menu
step: tick the card (`[data-select="qr-code"]`, the same checkbox hook the
selection bullet under Projects uses), click the bar's Hide button
(`[data-bulk="hide"]` - the literal `data-bulk` value bulkBarHtml() writes,
confirmed in lib/bulk-bar.ts), then click the grey reveal tile
(`.gtile--hiddenbox`, confirmed in gallery.ts).
-->

### Ask Lolly

探すより尋ねたいときは、**Ask Lolly**（`#/ask`）に質問を入力すると、このドキュメントの該当箇所が**そのままの文面で**返ってきます。要約でも生成でもなく、ガイド自身の言葉です。出典ページが示され、隣に **Open in docs** リンクが付きます。回答の下には、同じ質問に一致するアプリ内の場所（ツール、設定、保存したプロジェクト）がボタンとして並び、押すとそこへ移動します。

やり取りはセッション内の記憶です。追加で質問すればスレッドが積み上がり、再読み込みすると新しく始まります。検索結果の最下部には、他のグループが見つけた具体的なヒットの下に **Ask Lolly: *入力した語句*** の行があり、その質問をそのまま引き継ぎます。バーで始めて、ここで終えられます。

## キャンバス（プレビュー）

プレビューには、書き出される内容がそのまま表示されます。

**デスクトップ**

- **ズーム:** Cmd/Ctrl キーを押しながらスクロール、またはトラックパッドでピンチします。ポインターの位置を中心にズームします。
- **パン:** **Space** を押しながらドラッグ、または**マウスの中ボタン**でドラッグします。（通常のクリックは、デザインの各部分をクリックするために空けてあります。）
- **キーボード:** `0` = ウィンドウに合わせる · `1` = 100% · `+` / `−` = ズーム。
- **ズーム HUD:** 隅にある小さな `−  NN%  +  Fit` コントロールです。パーセント表示をクリックすると Fit ↔ 100% を切り替えます。

![キャンバス隅のズーム HUD。マイナス、現在の倍率、プラス、Fit、そしてテーマと音のトグル](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

**タッチ**

- **ピンチ**でズーム、**ドラッグ**でパン、**ダブルタップ**で全体表示に戻します。

**クリックでコントロールへ移動:** デザイン内の要素をクリックすると、対応するサイドバーの入力にフォーカスが移り、画面内にスクロールします。繰り返し行のグループなら、クリックした行がそのまま開くので、見えているものをすぐに編集できます。

サイズを変更すると、表示は必ず全体が収まる状態に戻ります。

### フリーキャンバス（Design）

フリーキャンバスのツールは、アートボードの*まわり*に作業領域を足します。デザイナーの台紙のようなものです。

- **キャンバス外での仮置き。** ボックスをフレームの外へドラッグしても、**表示されたままで選択もできます**。構図を整える間は要素を脇に置いておき、あとで戻せます。フレームの外はすべて**うっすらと薄く**表示されるので、書き出し範囲がひと目で分かり、フレームの影がファイルの始まる位置を示し続けます。
- **書き出されるのはフレーム内だけ。** 書き出されるファイルはアートボードの範囲に収まります。外に置いたもの（や端からはみ出た部分）は、ラスターでもベクターでも出力から単純に切り取られます。
- フレームの遠くに要素を置いたときは、**Fit より先までズームアウト**（20% まで）すると台紙全体が見えます。
- **アートボードはサイズを変えられます。** 書き出しサイズを変えるとフレームがその場でリサイズされます。ボックスの位置は変わらないので、既存の内容に合わせてレイアウトを取り直せます。

![Design's free canvas - the artboard with its surrounding pasteboard](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

**選択範囲を反転する。** 任意のボックスを右クリックして**Flip horizontal**または**Flip vertical**を選ぶと、その場で反転できます。あるいはキーボードで`Shift+H` / `Shift+V`を押します - Shiftが必要なのは、単独の`V`がPointerツールに割り当てられているためです。選択された各ボックスはそれぞれの軸で反転し、1回のUndoステップにまとまります。反転は実際の変形なので、キャンバス上だけでなく書き出したSVG、PDF、PNGにも保持されます。

### 自分で図形を描く（ペン）

四角、円、角丸フレームでたいていのレイアウトは足ります。一覧にない形が必要なときは自分で描きます。ツールレールの **Pen** ボタン（または `P` キー）で描画モードに入ります。モードの切り替えは 3 つのキーで行います。**`V`** でポインターに戻り、**`P`** でペン、**`N`** でノードツール（**Edit points**）です。どのモードからでも、抜ける先は常にポインターです。

![フリーキャンバスのツールレール。ドラッググリップ、Lolly メニュー、続いて Pointer、Add a box、Pen、Edit points、Line、Timeline、Artboards、Auto-arrange](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

- **クリック**で点を打ちます。既定のカーブ種別では、**クリックしてドラッグ**するとその点のハンドルが引き出され、角ではなく曲線が描けます。角にしたいときは **Alt** を押しながらクリックします。（他のカーブ種別では打った点はすべて角になり、ドラッグしても何も起きません。下の **Spline type** をご覧ください。）
- 点を打つ間、アートボードや他のボックスにスナップし、通常のドラッグと同じガイドが表示されます。描画中は Alt でグリッドを、あとから点をドラッグする際は Alt でグリッドと端の両方を抑止できます。
- **最初の点をクリック**すると、ループを閉じて一度に描き終えられます。そのほか **Enter** を押す、ダブルクリックする、ツールを切り替える、のいずれでも終わります。描いたものは破棄されず残ります。
- **Escape** は一段ずつ働きます。1 回目で描画を中止して何も書き込まず、2 回目でペンを抜けます。
- 描画中の **Delete** は、最後に打った点を取り消します。

できあがるのはキャンバス上のふつうのボックスです。移動、リサイズ、回転、グループ化、整列、重ね順の変更ができ、塗り、グラデーション、影、不透明度も設定できます。パスは他のボックスとまったく同じように振る舞い、どのコントロールも特別扱いはしません。

色も付いた状態で現れます。最初に描くパスにはブランドがパスに与える塗りと線が適用され、以降の新しいパスは**直前に使った設定**を引き継ぎます。塗りを一度決めればそのまま描き続けられ、図形ごとに色を付け直す必要はありません。（ブランドがパスについて何も定めていないツールでは、描いている最中に見えていた色で線が引かれるので、見えなくなることはありません。）

**点をもう一度編集する。** 図形をダブルクリック（またはオブジェクトバーの **Edit points**）すると点が戻ります。点をドラッグして移動、ハンドルをドラッグして向きを変え、曲線上のどこかをクリックして点を追加し、範囲選択して Delete で選択した点を削除します。パスは常に最低 2 点を保つので、誤って消し去ってしまうことはありません。

**Spline type** は打った点をどんな曲線でつなぐかを決めるもので、理解しておく価値のある選択です。

| 種別 | 動作 |
|---|---|
| **Smooth (auto)** | 既定です。ハンドルの長さを自分で求めるので、クリックを重ねるだけでハンドル操作なしに本当に滑らかな曲線になります。ハンドルを設定した場合は*向き*だけが固定され、長さは曲線側が持ち続けます。 |
| **Bezier handles** | 昔ながらのペンです。ハンドルが制御点になり、点を追加しても曲線は動きません。 |
| **Through the points** | 打った点をすべて正確に通ります。ハンドルはありません。 |
| **B-spline** | 点を通らず近くを流れ、より柔らかな形になります。 |
| **Straight lines** | 折れ線です。 |

既存のパスを、ハンドルを自分で求める種別へ切り替えるときは確認が入ります。設定したハンドルの長さは復元できないためです。**Bezier handles** への切り替えは常に無損失です。描画中は確認が出ません。切り替えは下書きにそのまま適用され、すでに引き出したハンドルもそれに従います。ハンドルを曲線側が持つ種別では、点を追加すると曲線がごくわずかに変化します。**Bezier handles** では変化しません。

各点は連続性の規則も持ち、キャンバス上の形で示されます。四角は **Corner**（ハンドルが独立して動く）、丸は **Smooth**（ハンドルが一直線を保つ）、輪付きの丸は **Symmetric**（一直線かつ同じ長さ）です。選択した点に設定すると、曲線はただちにその規則を満たし直します。

![リンクからそのまま描画された 2 つのペンパス。線だけの S 字カーブと、閉じて塗られた不定形](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

描いたパスも他と同じようにリンクに載るので、共有リンクから同じ図形が開き、CLI からも同一に描画されます。エディターに依存する部分はありません。

### 図形を組み合わせる（パス操作）

図形を 2 つ以上選び、キャンバスを**右クリック**（タッチでは 2 本指タップ）すると、ドローアプリでおなじみの操作がメニューに並びます。

- **Union** は 1 つの図形に統合し、最前面の塗りを残します。
- **Subtract** は最背面の図形から、その上のすべてを削り取ります。
- **Intersect** は重なった部分だけを残します。
- **Exclude** は重なった部分以外をすべて残します。

単一の図形に対する操作も 3 つあります。**Outline stroke…** は線を同じ輪郭の塗り図形に変換します（描いたとおりの太さを保ちたいときに便利です）。**Offset path…** はシルエットを外側に広げ、負の値なら内側に縮めます。**Simplify** は同じ形のまま、より少ないセグメントでパスを作り直します。

![Subtract で作った三日月と、実際に穴の空いたリング](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=path-ops-boolean-result)

結果はペンで編集し続けられる新しいパスです。穴は本物の穴で、線パネルの **Fill rule** が、重なった輪郭を塗る（*non-zero*）か、くり抜く（*even-odd*）かを決めます。

これらの操作があえて行わないことが 2 つあります。まず、**壊すのではなく拒否します**。重なっていない 2 つの図形を Intersect しようとすると、残すものがない旨が示され、何も変わりません。次に、テキストと画像のボックスは対象となる輪郭を持たないため、フレームで近似せずそのまま残します。組み合わせた結果は単純なベジェ曲線として保存されます。これはドローアプリでも同じで、元のスプライン種別は操作後には残りません。

## タイムライン（Sequence Studio）

![The timeline with the music clip selected: its strip runs along the bottom with Speed, Fades, Volume, Pan, EQ, Pitch, Normalize volume and the Effect slot](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dvideo%26_sel%3Dbed&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px!important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip)

**Sequence Studio** はフリーキャンバスに*時間*を加えます。どのボックスも開始時点を持ち、一定の長さだけ再生され、出入りのアニメーションを付けられます。並べる場所はアートボードの下に固定されたタイムラインです。開くとすでにシーケンスが再生されています。タイトルカード、クリップ、エンドカード、ローワーサード、音楽ベッドがあり、何も変えないうちから仕組みが目に見えます。

![Sequence Studioのタイムライン:トランスポート、ルーラー、オーバーレイレーン、クリップとシームチップを備えたマグネットのようなシーケンス行、Always onストリップ](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

行には 2 種類あり、その違いこそが要点です。

- **シーケンス行**は*マグネティック*です。クリップは隙間なく次々に並び、ドラッグすると穴を残さず並び順が変わります。クリップを削除すると残りが詰まります。これが作品の背骨です。
- **オーバーレイレーン**は自由です。ローワーサード、ロゴ、キャプションなど、背骨の上に独自のタイミングで重なるものは、それぞれ専用のレーンと開始時点を持ちます。
- その下の **Always on** には、タイミングをまったく持たないボックスがまとまります。最初から最後まで置かれているだけの背景要素です。チップの `+` でレーンに引き上げ、**Make always on** で戻します。

![編集ステージ:中央に配置されたアートボード、左側のツールレール、隅にあるズームHUD](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-stage)

タイムラインを開くとキーボードの操作対象がタイムラインになり、Space と矢印キーはページではなく再生ヘッドを動かします。すでにタイミングを持つコンポジションでは自動的に開くため、Sequence Studio を読み込んだ時点からそうなります。

> **[シーケンスエディター](/info/sequence-editor.html)**では、時間軸の編集が予測どおりに感じられるかを左右する 4 点をさらに詳しく扱います。キャンバスのクリックがどのクリップを編集するか、隣接クリップのオニオンスキン、分割の適用範囲とカットを取り消す Join、そしてトリミング（キーボード操作を含む）です。タイムラインにフォーカスした状態で `?` を押すとショートカット一覧が開きます。

**編集。** クリップの中央をドラッグすると移動や並べ替え、端から数ピクセル以内をドラッグするとトリミングになります。**Split at playhead**（または `S`）で 1 つのクリップを 2 つに切ります。分割には実際の **Length** を持つクリップと、その内側に少し入った再生ヘッドが必要なので、終端の定まらないクリップ（たとえば音楽ベッド）は分割できません。**Snap to edges** は既定で有効で、クリップの端、再生ヘッド、秒の区切りにスナップします。Alt で一時的に外せます。ドラッグは 1 回で 1 つの取り消し単位になり、ドラッグ中のプレビューは確定時と同じ計算を行うため、見えているとおりの結果になります。

クリップを選ぶと、インスペクターで同じ編集を数値で行えます。**Length**、**Trim in**（素材のどこから始めるか）、×0.25 から ×4 までの固定倍率で選ぶ **Speed**、長さを伴う **Animate in** / **Animate out**、そして **Mute clip** です。マグネティック行のクリップに **Start** 欄がないのは意図的です。順序は行が持つため、移動はドラッグで行います。

**トランジション**はキーフレームではなくプリセットです。Fade、Pop、Grow、Rise、Drop、4 種類の Slide、Zoom in と Zoom out、Tilt、Swoop、Spin、Drift、そして **Cut (no animation)** があります。移動量はオブジェクトに応じて拡大縮小するので、画面いっぱいのカードでも小さなバッジでも同じプリセットが正しく見えます。シーケンス行で隣り合う 2 つのクリップの間には**継ぎ目チップ**があります。クリックして **Cut** か **Crossfade** を選ぶと即座に適用され、閉じます。同じチップをもう一度開くと **Length (ms)** を変更でき、**Done** を押します。クロスフェードは一方のフェードアウトと次のフェードインの組として保存され、書き出しではその組から実際のディゾルブを導きます。そのため、プレビューでは 2 つのフェードに見え、ファイルでは本当の受け渡しになります。

**音。** **Audio** クリップを追加すると、他のクリップと同じようにタイムライン上に置かれます。波形、トリミング、ミュートが使えます。（既定のセッションに入っている生成音のベッドだけは例外で、書き出し時に合成されるため、レンダリングするまでバーは無地のまま無音です。）マイクを押すと、カウントインとレベルメーター付きで**ナレーションをそのままタイムラインに録音**でき、録ったテイクは開始した位置に自分のアセットとして保存されます。その隣にあるカメラを押すと、同じ要領で**動画を録画**できます。録画中、テイクはアートボードの書き出しサイズに合わせて随時トリミングされるため、小さなセルフビューには再生ヘッド位置のシーケンスに入る内容がフルフレームでそのまま映ります - 共有リンクから同僚のクリップを取り込む方法でもあります。音楽、会話、クリップ自身のサウンドはすべて書き出し時のミックスに入ります。（書き出しパネルの **Audio track** は別物で、クリップ全体の下に敷く 1 本のベッドをフェードとダッキング付きで扱います。両者は併存します。）

**書き出し。** モーションの書き出しは画面録画ではなく**決定論的な合成**です。各フレームは正確な時刻で復号、描画、符号化されるため、ファイルの内容はマシンの処理速度に左右されず、MP4 や WebM では実用上のフレーム数の上限もありません。長さを入力しない限り、尺はタイムライン自身の長さになります。Content Credentials は他の書き出しと同様に付与されます。静止画で書き出すと再生ヘッド位置のフレームが得られ、出力サイズの隣の **Frames** 欄からはコンタクトシート全体も作れます。[書き出し](/info/exporting.html#stills-from-a-timed-composition)をご覧ください。

覚えておきたい制限がいくつかあります。シーケンスの上限は 1 時間です。GIF とアニメーション PNG はフレームをバッファーするため短時間向きです。速度が ×1 でないクリップの音声は無音になります（タイムストレッチはまだありません）。また、ここでは合成による書き出しのほうが適しているため **Record live** は表示されません。

**プリセットの先へ:キーフレーム、奥行き、そしてカメラ。** トランジションはクリップが現れて消えるまでの間をアニメーションさせます。クリップの*内部で*ボックスをポーズさせる - 漂わせる、フェードさせる、ぼかす、ページから浮かせてまた落ち着かせる - にはキーフレームを追加します。クリップを選択し、**+Keyframe**(タイムラインのツールクラスターにあるひし形、キャンバスのオブジェクトバーにあるひし形、または`K`)を押すと、再生ヘッドの位置によって次の編集がどのポーズを書き込むかが決まります。同じキーフレームシステムは、あらゆる時間指定コンポジションに**カメラ**を与え、ズームイン、パン、フォーカス送りを行い、1枚のフラットなSVGを、その間を飛び回れるレイヤーのスタックへと変えます。**[アニメーション](/info/animating.html)**が完全なガイドです。

Design ツールにも同じタイムラインがあるので、別のツールに移らずにレイアウトへ時間を与えられ、モーションの書き出しもできます。

## プレゼンテーション

![The inspector's Document section: Voice, Blend with, Speed, Lead-in, Tail and Show captions when presenting](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

**アートボード**で構成された Design のドキュメントは、それだけでスライドです。ツールレールの **Lolly メニュー**を開いて最下段の **Present** を選ぶと、各アートボードがキャンバス上の並び順どおりに全画面のスライドになります。スライドはレンダリング済みアートボードの複製で動くため、下にあるエディターには一切触れず、終了すると元の状態にそのまま戻ります。

- **Advance**(進む)は **Space**、`→`、**Page Down**、または画面右端のストリップのクリックで行います。戻るには `←`、**Page Up**、または左端のストリップを使います。**Home** と **End** で最初と最後のスライドへジャンプします。ポインターを動かすと小さなコントロールバーがフェードインし、止まると再び隠れます。
- **Overview**(概観)(`O` またはグリッドボタン)は、すべてのアートボードをキャンバス上で指定した配置のまま一度に並べます。クリックすると開きます。
- **Reveal steps**(ステップごとの表示)。ボックスを右クリックし、既定の **Always visible**(常に表示)の代わりに **Reveal at step 1**、**2**、**3** のいずれかを選びます。そのボックスは対応するステップまで進むまで表示を待つため、スライドを段階的に見せられます。同じ番号を共有するボックスは同時に現れます。
- **Speaker view**(発表者ビュー)(`S`)は、現在のスライド、次に来るスライド、そのスライドのメモ、経過時間を表示する第2ウィンドウを開きます。ブラウザがポップアップをブロックした場合は、デッキ上のパネルにフォールバックします。メモはアートボードごとに設定され、スライド自体には表示されません。
- `B` で画面を黒くします(何かキーを押すとスライドに戻ります)。`F` はフルスクリーンに戻り、**Escape** は一段階ずつ戻ります: 概観からデッキへ、デッキからエディタへ。
- **Kiosk**(キオスク)。アートボードに **Length**(表示時間)を設定すると、デッキはその時間だけそこに留まり、細い進行バーの後ろで自動的に次へ進みます。`K`(または、何かに表示時間が設定されて初めて現れる一時停止ボタン)でこれを停止・再開できます。リンクに `kiosk` を追加すると、デッキは終端で最初に戻るようになり、これによってサイネージとして機能します。

スライドはリンクでもあります。`?present` で直接開き、`s=` でスライドを指定します（位置、アートボードの id、段階表示なら `id.step`）。移動に合わせてアドレスも更新されるので、送るのは今見ているスライドになります。ツール作者の方へ。これらのパラメーターは [URL Mode](/info/url-mode.html#reserved-parameters) のページに記載しています。

## スマートフォンでの表示

画面が狭い場合、レイアウトは 1 列に組み替わります。

- **コントロールは上部のシート**になり、下端に**ドラッググリップ**が付きます。グリップをドラッグすると高さが変わり、**peek / half / full** にスナップします。グリップを**タップ**すると折りたたみ ↔ 展開を切り替えます。プレビューは下の領域を埋め、編集中も表示され続けます。
- フローティングの **Export** ボタンで書き出しシートが開きます。形式、サイズ、コピー、保存、ダウンロードの操作が 1 か所にまとまっています。背景をタップすると閉じます。

![スマートフォン幅の画面でのツール。上部にシート状のコントロール、下のプレビューを埋める生成されたパレット、下部中央に浮かぶレンダーピル](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## コントロール（入力）

ツールが公開するのは、変えてよい入力だけです。それ以外（色、レイアウト、タイポグラフィ、ロジック）はツール作者が固定しているため、作ったものは必ず作者の定めた規則に沿います。入力にはテキスト、スライダー、カラーピッカー、ドロップダウン、日付、画像ピッカー、繰り返し行のグループがあります。折りたためるセクションにまとめられているものもあります。

![ツールのコントロールの列。テキスト欄、色の呼び出し、スライダーだけで、作者が固定した項目は表示されない](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**リセット:** *Clear changes* ですべての入力が既定値に戻ります。

### 元に戻す／やり直す

**Cmd/Ctrl-Z** で 1 つ戻り、**Cmd/Ctrl-Shift-Z**（または **Cmd/Ctrl-Y**）で 1 つ進みます。同じ操作は、コントロール上部の行にある **Undo** と **Redo** のボタンにもあります（フリーキャンバスではツールレールに置かれます）。戻す対象がないときは、それぞれグレー表示になります。各操作は内容を伝えます。色を元に戻すと、復元した入力名を示す小さなメッセージが出て、その中の **Redo** ボタンで元に戻せます。

- **ドラッグは 1 ステップです。** 同じコントロールへの変更は 0.5 秒以内なら 1 つにまとまるので、スライダーを端から端まで動かしても取り消しは 200 回ではなく 1 回です。
- **直近 100 ステップが保持されます。** それより古いものは順に破棄されます。元に戻したあとで新たに編集すると、他と同じくやり直し分は消えます。
- **テキスト欄にカーソルがある間**は、Cmd/Ctrl-Z は入力欄自身のもので、1 文字ずつ戻ります。Lolly が引き受けるのは、独自の取り消しを持たないコントロール、つまりスライダー、ドロップダウン、色、スイッチです。
- **file** 入力での**ファイル選択**はステップになりません。そのデータはセッション中だけ保持されるため、戻す対象がないからです。

ライブ[コラボレーション](/info/collaborate.html)では、履歴はあなた自身のものだけにとどまります。他のデバイスから届いた変更があなたの操作履歴に加わることは決してないため、取り消し(undo)は常にあなた自身が行った操作だけを取り消せます。

## あなたの情報と顔写真

**Profile**（ギャラリー右上）には、氏名、連絡先、任意の**顔写真**を保存します。これらの項目を求めるツールでは自動的に事前入力されます。一度設定すれば、メール署名、ロックアップ、バッジが自動で埋まります。セッションごとに個別に上書きすることもできます。**Use my details to create** を有効にすると、書き出したものに作成者としてあなたの情報が付きます。

顔写真と情報は**このデバイスだけ**に保存されます。プロフィールは本人だけのものとは限りません。チームや、ときどき担う役割としても設定できます。複数持つ方法を含め、詳しくは**[プロフィール](/info/profile.html)**をご覧ください。

## 保存と再開

**Save** をクリックすると、現在の入力がそのツールのセッションとして保存されます。ツールごとに名前を付けたセッションを複数保持できます。各ツールの **Continue** ボタンは直近のセッションを開き直し、**履歴ボタン**（右上、プロフィールの隣）にはすべてのツールの保存済みセッションが並びます。セッションはデバイス内に保存されます。整理するには **Projects**（下記）を開きます。

![2 つに分かれたレンダーピル。書き出しパネルを開く上向き矢印と、その場でセッションを保存するチェック](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

## Projects

**Projects**（**Tools** の隣の **Projects** タブ、または **Profile → Storage → Organise in Projects** から開きます）は、保存したものすべての置き場で、ファイルマネージャーのように使えます。

![Projects。保存したセッションを入れ子にできるフォルダーで整理する](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)

- <!--i:folder--> **入れ子にできるフォルダー。** 保存したセッションをフォルダーにまとめ、フォルダーの中にフォルダーを、好きな深さまで作れます。フォルダーを作成し、名前を変更し、タイルを別のフォルダーにドラッグして移動できます。パンくずで上の階層に戻れます。常に用意されている **Uncategorised** フォルダーには、まだ整理していないものが入ります。
- <!--i:clock--> **並べ替えは自由に。** **View & sort** には **Name**、**Date added**、**Last modified**（既定）があり、フォルダーの中ではさらに **By tool** が加わります。どの並べ替えでもフォルダーが先に来ます。並べ替えはそれぞれのグループ内でセッションとフォルダーを整えるだけです。
- <!--i:document--> **新しい作業をそのまま入れる。** **New asset**（ルートでは「Start a fresh creation」、フォルダーの中では「Add to *folder*」）はツールを開き、最初の保存を自動的にそのフォルダーへ入れます。
- <!--i:checklist--> **複数選択（デスクトップ）。** タイルのチェックボックスをオンにする、空白部分をドラッグして範囲選択する、**Shift/Cmd キーを押しながらクリック**する、のいずれかで選べます。タイルを**右クリック**するとコンテキストメニューが開きます。選んだもの全体にまとめて操作でき、同じ操作とフローティングのアクションバーは、ここだけでなく Tools ギャラリー、Utilities、カタログ、Projects でも使えます。
- <!--i:download--> **フォルダーや選択範囲をまとめてレンダリング。** **Render folder** は、サブフォルダーも含めてフォルダー内の保存済みセッションをすべて、入れ子構造の 1 つの `.zip` に書き出します。**Render selection** は任意の複数選択に対して同じことを行い、セッションが 1 つならそのままファイルとして書き出されます。Batch/Pro は不要です。
- <!--i:link--> **ツールの保存済み作業へ直行。** Tools ギャラリーでツールを 1 つ以上選び、選択バーから **View sessions** を選ぶと、そのツールで作ったセッションだけを表示した Projects が開きます。**Clear** で全体表示に戻れます。
- <!--i:link--> **保存したセッションを共有。** セッションを右クリック → **Share link** で、まったく同じ入力で開き直せるリンクをコピーします（共有ダイアログそのものです。下記参照）。

![Projects の View and sort ポップオーバーを開いた状態。テーマの行、Preview か List を選ぶ View、そして Sort の下に Name、Date added、Last modified が並ぶ](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
<!--
SHOT NOTE (misc-projects-sort): trigger button confirmed as
`.filter-fab.projects-viewopts` in views/projects.ts (openViewOpts() is bound
to `.projects-viewopts` specifically) - `.projects-viewopts` alone is the
more specific hook, so that's what drives the click. The popover it opens
(`.projects-viewmenu`, also confirmed directly in openViewOpts()) is body-
appended, not nested under the Projects root, so cropSelector finds it
regardless. "By tool" only appears inside a folder - this recipe captures at
the Projects ROOT (`url=/#/p`), so if the capture pass wants "By tool"
visible too, point url= at a real folder instead: the route is a path
segment, `/#/p/<folderId>` (confirmed in main.ts's hash router - `parts[0]
=== 'p'` reads `folderId` from `parts[1]`), not a query param. Caveat: a
folder has to already EXIST in the capture profile, which a per-shot fresh
context has none of.
Also: the popover is not sort-only. openViewOpts() writes a theme segment, a
"View" pair (Preview / List) and a sound segment around the Sort rows, so the
alt text names them - do not re-caption this as "the sort menu".
-->

**選択バーに並ぶ操作**はビューによって少し異なります。すべての操作がどこでも意味を持つわけではないからです。

- **Tools / Utilities:** Favourite（または Unfavourite）、Hide（または Unhide）、Available offline（または Remove from offline）、**View sessions**（上で説明した移動）、そしてカードをちょうど 1 枚選んでいるときの Copy link。
- **カタログ:** Favourite と Hide はどの選択にも使えます。Duplicate、Download、Delete は、選んだものがすべて自分のアップロードである場合にのみ表示されます。共有のデザインシステム素材は恒久的な取り決めなので、一括操作でもこの 3 つは対象外です。
- **Projects:** **Render selection**、**Move to…**、**New folder**、**Delete**、選択が同一ツールのセッション 2 〜 8 件のときの **Edit together**（1 つにまとめたサイドバーの下に横並びで開きます）、そして選択全体をバッチグリッドの行として開く **Edit as sheet** です。後者は**件数の上限がなく**、同じツールかどうかも問わないため、Edit together の 2 〜 8 件を超える、あるいはより混ざった選択に対する逃げ道になります。

> 名称の紛らわしい点が 1 つあります。**View sessions** は何かが*選択されている*ときにだけ現れます。選択していないカードを右クリックすると代わりに **N saved sessions** が表示され、これは Projects に移動するのではなく、そのツール自身の履歴ダイアログを開きます。

![Toolsギャラリーでツールカードが2枚チェックされている状態。フローティング選択バーには「2 selected」と表示され、Available offline、View sessions、Favourite、Hideが提供されている](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery)
<!--
SHOT NOTE (misc-bulkbar-gallery): drive targets `[data-select="qr-code"]` /
`[data-select="gradient"]` - `.tile-check[data-select="<ref>"]`チェックボックスボタンであることをviews/gallery.tsのカードマークアップ(cardMarkupがすべてのタイルに与える同じ属性)で直接確認済み。そのためこの2回のクリックはどちらのツールも開くことなく両方のカードをチェックする。

SHOT NOTE (misc-sessions-by-tool, NOT PUBLISHED): the "View sessions" result
had a recipe of its own (`/#/p?tools=qr-code,d3`, views/projects.ts's
toolsBodyHtml()), dropped here because it has no `drive=` that can
manufacture its own content - a saved session isn't a click away, it has to
already exist, and build-docs-shots.ts gives every shot a fresh
`browser.newContext()`. It would publish an empty list. Same dependency the
`projects` shot above already carries; revisit if the pipeline gains a
storage-seeding hook.
-->


## 作ったものを共有する

デザインの受け渡しには 2 つの方法があります。リンクとして送るか、ファイルとして送るかです。共有ダイアログはその両方を用意しています。書き出しコントロールの **Share** で開きます。Projects の保存済みセッションの **Share link** からも、そのセッションについて同じダイアログが開きます。

### リンク

すべての入力はページの URL に収められるため、リンクがそのままデザインです。ダイアログの上部にはコピーできる状態のリンクがあり、その下に折りたたまれたセクションが 2 つあります。

- **Link options** には **Shortest link**（大きなデザインは URL が長くなるため、状態全体を小さなトークンにまとめ、削減できた文字数を表示します。読める形式も常に併記されます）、**Password-protect this link**（リンク全体を AES-256 で保護し、パスワードはリンクに含まれません）、**Pin this tool version**（`_v` フラグ。今見ているツールのバージョンにリンクを固定し、以降の更新で描画内容が変わらないようにします）があります。
- **Link behaviour** は、受け取った人が開いたときの挙動です。全画面表示、書き出しパネルを開いた状態、`&export` による開いた瞬間のダウンロード、`&copy` によるクリップボードへのコピーが選べます。

リンクは同僚に貼って送っても、ブックマークしても、コミットしても構いません。（詳細は [URL Mode](/info/url-mode.html) をご覧ください。）

**リンクそのものが製品全体になるツールもあります。** Jump Pageは、あなたのリンクを1枚のページにまとめて配布します - プロフィールリンク、カンファレンストーク、ショップフロントなど。ホスティングするものは何もなく、背後にアカウントも存在しません。ページそのものがリンクなので、URLが届く速さでそのまま開きます。エディターでは完成したページを入力項目の隣に確認でき、リンクを開いた訪問者にはフル幅で表示され、スクロールするごとに1シーンにつき1リンクが現れます。

![エディター内のJump Page - 見出し、それぞれ独自の背景色を持つ3つのリンクシーン、Made with Lollyフッターが、キャンバス内で1枚のページとして配置されている](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

**リンクに載せられないものはダイアログが伝えます。** URL に収まらないものが 3 つあります。このデバイスから追加した画像やファイル、非常に長いテキスト、そして非常に大きなリストです。リンクを組み立てる際に、それぞれの数が数えられます。落とさざるを得ないものがあった場合、画像が欠けた状態で開くリンクを渡す代わりに、ダイアログがその内容を示し、下のファイルでの共有を案内します。単に*長い*だけのリンクには、文字数を添えた控えめな注意が出ます。長さは圧縮でまだ救えるからです。

### .lolly ファイル

作業中のツールの共有ダイアログにある **Download .lolly** は、同じデザインをファイルとして書き出します。保存済みセッションに加え、デバイスから追加した画像やファイルも含まれます。デザインが参照しているカタログの素材も同梱されるため、あなたのブランドを一度も見たことのないマシンでも完全な状態で開けます。デバイスに共有シートがある場合は、**Send to…** でディスクに保存せずそのまま渡せます（AirDrop や Android の共有）。

`.lolly` はふつうの zip です。拡張子を `.zip` に変えて開くと、自分の画像は `assets/uploads/` に、カタログの素材は `assets/catalog/` に、それぞれ本来の名前と拡張子で入っています。`manifest.json` にすべてが一覧され、先頭の README にファイルの説明があります。

送り出す前に決められることが 3 つあります。

- **氏名を含めるかどうか。** 氏名、メールアドレス、組織名がファイルに書き込まれるのは、プロフィールで**Use my details to create**がオンになっている場合のみです。オフの場合、ファイルにはLollyで作成されたことといつ作成されたかだけが記録され、あなたについての情報は含まれません。
- **ライセンス素材を含めるかどうか。** ライセンス済みおよびブランドロックされたアセットは、デフォルトでは除外されます。デザインがそれらを使用している場合、ダイアログにその数が表示され、*Download without them*と*Include and download*の2つのボタンが提示されます - 含めると、`.lolly`を開いた相手に実際のファイルが渡ってしまうためです。
- **ツールを含めるかどうか。** **Include the tool**をオンにすると、ツール自体のファイルがデザインと一緒にパックされ、そのツールを持っていないデバイスでも開けるようになります。カスタムツール - 受け取り手が持っていそうにないフォークやプライベートなブランドツール - の場合はチェック済みで届き、署名済みカタログに載っているツールの場合はチェックなしで届きます。相手の手元にあるコピーも同じソースから来ているためです。(署名済みカタログのないビルドでは、すべてのツールがカスタム扱いとなり、チェックボックスは最初からオンになります。)

**開き方。** `.lolly`ファイルをアプリにドロップすると、アセットはライブラリへ、セッションはProjectsへ送られ、ツールがそのセッションを開いた状態で起動します。あなたのものが上書きされることはありません。セッションは新しい保存スロットとして届き、このデバイスに既にあるアセットはチェックサムで照合され、重複させずに再利用されます。すべてのパーツはファイル自身のチェックサムと照合されながら取り込まれるため、転送中に破損したコピーは中途半端に取り込まれるのではなく拒否されます。

手元にないツールがファイルに含まれている場合、Lolly はそのツールを実行する前に確認します。**Trust this tool?** にはツール名と作者が示され、開くとそのツール自身のコードがデバイス上で実行されることが明記され、**Trust & install** で先に進みます。断った場合でも、共有された作業はプロジェクトに保存され、ツールを追加する日まで残ります。（コードをモジュールとして提供するツールだけは、まだサイドロードできず、同じように拒否されます。）

リンクもファイルも、渡されるのはある時点のスナップショットです。他の人と*同時に*同じセッションを編集したい場合（2 台のデバイス、サーバー不要、同じネットワーク上ならインターネットも不要）は、[共同で作業する](/info/collaborate.html)をご覧ください。

## ライブカメラ（動きに反応するツール）

写真用の **Filter** はすべて（Halftone、Scanline、Posterize、Voronoi cells、Colour treatment、Pixel stretch、Imperfections）、カメラが使える環境では **Go live** ボタンを表示します。有効にすると、エフェクトがウェブカメラの映像をフレームごとに追い、動きに反応します。結果は GIF、WebM、MP4 に録画できます。フレームの読み取りと処理は**デバイス上**で行われ、外に出ることはありません。停止するかツールを離れた時点でカメラは解放されます。（どの画像ピッカーにも **Take a photo** があり、1 フレームをデバイス上の画像として取り込めます。）

## My images

ツールでデバイスから画像を追加すると、その画像は届いたそのままの状態で保持され（そのため付いている Content Credentials は引き続き検証できます）、個人用の **My images** ライブラリー（**Profile → Storage** の中）に保存されます。確認が出るのは本当に巨大なファイルのときだけで、そのまま保持するかリサイズするかを尋ねます。保存した画像はどのツールでも再利用できます。取り込み時に EXIF/GPS を消すには、プロフィールで **Strip metadata from uploads** を有効にします。上限はありません。ライブラリーは完全にローカルで、制限はデバイスの空き容量だけです。画像の管理や削除もそこで行えます。

## カタログ（素材ライブラリー）

**カタログ**（`#/c`、または一覧ビューの上部にある Projects · Tools · Utilities · Catalog 切り替えの **Catalog** 部分）は、ツールが使えるものすべて（ブランドロゴ、画像、音声、モーション）を種類別にまとめた場所であり、**あなた自身の制作ファイル**の置き場でもあります。サーバーも管理コンソールもプルリクエストも不要で、すべてデバイス上にあります。

![カタログ。ブランド素材、スウォッチ、フォント、そして自分でアップロードしたもの](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=catalogue)

- <!--i:upload--> **ファイルを取り込む。** 画像、SVG、音声クリップ、動画、Lottie、PDF、PowerPointデッキをアップロードエリアにドラッグする(またはクリックして選択する)と、即座にカタログに追加され、あらゆるツールのアセットピッカーで使えるようになります。複数ページのPDFや`.pptx`の場合はどのページ・スライドを残すか尋ねられ、それぞれがSVGアセットになります。好きなだけ取り込めます。デバイスの外に出ることはありません。
- <!--i:star--> **よく使うものをお気に入りに。** アセット(またはブランドスウォッチ)を★すると、すべてのピッカーの先頭にピン留めされ、よく使うロゴや色にワンクリックでアクセスできます。
- <!--i:folder--> **整理する。** アセットを別のグループに再分類したり、使わない共有ブランドアセットを非表示にしたり(**Show hidden**で元に戻せます)、自分でアップロードしたものを完全に削除したりできます。Projectsと同じ複数選択操作とフローティングアクションバーがここでも使えるため、選択したもの全体に対してまとめて操作できます。
- <!--i:layers--> **動画から背景を取り除く。** アセットピッカーで動画の詳細を開くか、カードを右クリックして**Remove background…**を選ぶと、透過版(実アルファ付きのアニメーションWebPまたはPNG)を保存できます。**Method**を選択します:**On-device model**は複雑なシーンから被写体を切り抜き、**Colour key**はグリーンスクリーンや無地の壁のような均一な背景をキーアウトします。**Tolerance**、**Softness**、**Spill removal**でエッジを調整できます。カラーキーはモデルのダウンロードもネットワークも不要なため、**Remove background**はどの動画にも提供され、整った映像ではよりきれいに仕上がることが多いです。**Resolution**コントロール(360、480、720、1080pのいずれか。元の解像度は超えません)でディテールとファイルの軽さ・速さを調整できます。デバイス上のバックグラウンドジョブとして実行されます。完成した切り抜きは元のアセットの隣に別アセットとして保存され、元動画のContent Credentialがイングリディエントとして引き継がれます。(背景の削除が単純な編集にとどまる理由については[一度生成すれば、同じものがレンダリングされる](/info/ai-features.html)を参照してください。)

### パレットとフォントをどこへでも

カタログの **Swatches** パネルは表示するだけではありません。色をクリックしてコピーしたり、他のツールが読める形式で**ブランドパレット全体をダウンロード**したりできます。

- <!--i:code--> **Design tokens (JSON)**、**CSS variables**、**CSS classes**。ブランドをそのままスタイルシートやビルドに組み込めます。
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**。Illustrator や Photoshop に読み込めます。
- <!--i:pentool--> **GIMP palette (.gpl)**。GIMP や Inkscape 向けです。

![Swatches パネル。上部に 5 つのパレットダウンロードボタンが並び、その下にコピーできるチップとしてブランドの全色が並ぶ](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

**Fonts** パネルにはブランドの書体が並び、それぞれに **download** が付いています。ローカルにインストールしたり、印刷所に渡したりできます。（[Brand Studio](/info/brand-studio.html) の Colours ルームでも同じパレットのダウンロードが行えます。）

素材は、開かれた自作の道の半分です。もう半分は**自分でツールを作ること**です。フリーキャンバス（前述の Design）を使えば、コードなしで見た目のまま作れます。

## サウンドとアクセシビリティ

Lolly は誰にとっても快適に使えることを目指しています。インターフェイスはキーボードで操作でき、独自のコントロールにはスクリーンリーダー向けの適切なラベルが付き、各ツールのライブプレビューは、何を作っているかを説明するラベル付きの 1 枚の画像として提示されます。

控えめな**補助音**が操作を確認します。ギャラリーに着いたとき、Content Credentials の検証が有効か無効か、パネルを閉じたとき、フィルターを切り替えたときなどです。**既定ではオフ**です。スイッチのある場所（各ビューのオプションポップオーバー、または **Profile**）で **Sound** をオンにすると、その選択は記憶されます。

**Profile → Accessibility** には、任意で有効にできる快適性の設定が 4 つあります。**Reduce motion**（アプリのトランジションや装飾的な動きをなくす）、**Hide colourful previews**（ギャラリーのカードをアイコンと文字だけの落ち着いた表示にし、プロジェクトのサムネイルも控えめにする）、**High contrast**（枠線、文字、フォーカスリングを強める）、**Large text**（ラベル、メニュー、ボタンなどアプリの文字を大きくする）です。4 つとも、作業の*まわり*を静めるものです。ツールのキャンバスの内側には及ばず、書き出したものを 1 ピクセルも変えません。いずれも、オンにするまでは無効です。詳しくは[プロフィール → アクセシビリティ](/info/profile.html#accessibility)をご覧ください。

Sound スイッチの隣にあるのが **Neurospicy Mode** です。作業中に静かに流れる、任意の落ち着いた集中用トラックです。オンにすると画面下隅に小さな**プレイヤードック**が現れ、アプリのどこへ移動しても付いてきます。ここから曲を検索して選び、前後に送り、音量を調整し、最小化や終了ができます。曲の一覧はいくつかの分類にまたがります。手続き的に生成される *Lolly Sings* の曲、アンビエントのループやビート、自分でアップロードした音声、そしていくつかのインターネット**ラジオ**局（ラジオには接続が必要で、それ以外はオフラインで再生できます）です。**既定ではオフ**で、Sound と同様にセッションやデバイスをまたいで記憶されます。Sound をオフにすると集中用トラックも消音されます。

## ストレージとプライバシー

すべてはブラウザーのローカルデータベース（IndexedDB）に保存されます。プロフィール、保存済みセッション、アップロードした画像、ダウンロードしたカタログ内容のキャッシュです。**Profile → Storage** では使用量が表示され、次の操作ができます。

- <!--i:box--> **Clear cache**。ダウンロードしたカタログ内容を破棄します（次回の読み込みで再同期されます）。
- <!--i:trash--> **Clear all my data**。プロフィール、セッション、画像を消去します。*元に戻せません。*

![スマートフォン幅の画面でのストレージカード。デバイス上のデータの分類がすべて示され、下部に Clear all my data ボタンがある](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

これらのローカルデータがどこかに送信されることはありません。テレメトリーもクラウドでのレンダリングもありません。アプリが取得または送信するものの完全な一覧は[プライバシーポリシー](/info/privacy.html)にあり、[サーバー面](/info/server-surface.html)では任意のサーバーコンポーネントを一覧しています。

## 別のデバイスへの移行

すべてがデバイス上にあるため、**Profile → Storage → Move to another device** を使えば、アカウントもクラウドもなしに、もう 1 つのインストール先へまとめて持ち運べます。

- <!--i:download--> **Export my data** は `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` を 1 つダウンロードします（名前の各部分はプロフィールから取られ、未設定なら省かれます。`<n>` は日ごとの連番で、同じ日の書き出しが衝突しないようにします）。中身は、プロフィール、サムネイル付きの全保存済みセッション、アップロードした画像、設定（テーマ、サイドバー幅、ローカルの利用統計）です。
- <!--i:upload--> 移行先のインストールで **Import data…** を選ぶと、そのファイルを読み込みます。動作は**マージ**です。同じ名前のもの（プロフィール、セッションの枠、画像）は取り込んだ内容で置き換えられ、それ以外はそのデバイスに残ります。保存済みセッションは、取り込んだ画像に自動で再リンクされます。

カタログのキャッシュは含まれません。新しいデバイスで自動的に再ダウンロードされます。バンドルはふつうの zip（`manifest.json` + `profile.json` + `sessions.json` + `assets.json` + `assets/blobs/…` + `prefs.json`、形式 id は `lolly-backup`）なので、メールでも USB でも AirDrop でも壊れずに届き、どのシェルでも同じ形式として読めます。各部分にはチェックサムが付いているため、転送中に壊れたファイルは中途半端に復元されず、取り込み時に検出されます。（形式の詳細は [Data Transfer](/info/data-transfer.html) をご覧ください。）

## デザインを取り込む（Figma、Penpot、Illustrator、InDesign）

既存のデザインを Lolly に取り込んで作業を続けられます。**Design** を開き、キャンバスのツールバーで **Import a design** をクリックし、Figma の **.fig** か SVG、Penpot の **.penpot**、Illustrator の **.ai** / **.pdf**、InDesign の **.idml** を選びます。レイヤーはフリーキャンバス上の編集できるボックスになり、テキストは打ち直せる状態のまま、画像は **My images** に入り、書体と色はブランドの共通設定に合わせられます。その後は他のセッションと同じように保存、共有、レンダリングできます。解析はすべてデバイス上で行われます。詳しくは**[デザインを取り込む](/info/design-import.html)**をご覧ください。

## 書き出し

形式の選択、出力サイズと印刷単位、透過、動画、コピーと共有まで、詳しくは**[書き出しと形式](/info/exporting.html)**をご覧ください。要点は、形式を選び、必要ならサイズを設定して **Download**（またはクリップボードへ **Copy**）です。

## Batch（Pro）モード

上級者向けに、**Batch**（ギャラリーからリンクされ、既定で有効な Pro 機能フラグで制御されます）は多数のバリエーションを一度にレンダリングします。各行が 1 組の入力になったグリッドを、まとめて書き出す仕組みです。カードを十数か国語にローカライズしたり、全サイズ違いを一度に生成したりするのに向いています。行は手入力、表計算ソフトからの貼り付け、CSV の読み込み（書き出しも可能）で埋められ、行ごとに形式、サイズ、出力ファイル名を設定できます。グリッド全体は名前付きの **batch session** として保存してギャラリーから開き直せ、全行を 1 つの `.zip` としてダウンロードできます。

![バッチツールバー - ZIP名、単位、DPI、すべての行が継承する形式。右側にSessionsとRenderがある](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.pro-toolbar&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

Batch は**1 つのテンプレートから多数のバリエーション**を一度に生成するための機能です。**すでに保存済み**のセッションを再レンダリングするには、上で説明した **Projects → Render folder / Render selection** を使います。Pro は不要です。

## 並べて編集する（Multi-edit）

Batchは*1つの*デザインの多数のバリエーションです。**Multi-edit**はその仕事のもう半分を担います。**異なる**複数の保存済みデザインを同時に開き、1つの変更をそのすべてに適用します。**Projects**で**2つから8つ**の保存済みセッションにチェックを入れ、選択バーから**Edit together**を選ぶと、`#/multi?s=<slot>,<slot>…`でライブカードとして横並びに開きます。各カードは保存されたサムネイルではなく、そのセッションの実際のレンダリングなので、見えているものがそのまま書き出されます。

1 つのサイドバーで全体を操作します。

- <!--i:sliders--> 先頭は **Shared** です。選んだセッションのうち 2 つ以上が*同じ形で*宣言している入力（同じ id、同じ型、同じ制約。バッチグリッドが列に用いるのと同じ統合規則）がここに集まります。共有コントロールを 1 回編集すると、その値はそれを宣言しているすべてのセッションに広がり、各カードに即座に反映されます。同じツールの 2 つのセッションはすべてを共有し、異なる 2 つのツールは、たまたま共通している分だけを共有します。
- <!--i:document--> その下には、**セッションごとに折りたたまれたカード**が 1 枚ずつ並び、そのセッション固有の入力がすべて、ツール自身のサイドバーと同じ精度で表示されます（素材ピッカー、繰り返し行のグループ、色の欄）。あわせて **Format**、**W** / **H**、**Unit**、**DPI**、そしてカード専用の **Download** からなるコンパクトな書き出しブロックが付きます。この Download はまずセッションを保存し、それから通常のセッション書き出し経路でレンダリングするため、ツールから直接書き出した場合と同じファイル名、形式、Content Credentials が付きます。
- <!--i:search--> 上部の **Filter inputs…** は*すべての*カードのコントロールを一度に絞り込みます。8 件のセッションの「見出し」に、スクロールせずにたどり着けます。

いずれかのキャンバスをクリック（またはその上で Enter）すると、そのセッションのサイドバーカードが開き、画面内にスクロールします。**Save all** はすべてのセッションをそれぞれの枠に書き戻します。**Download all** はまず保存し、そのうえで Projects の **Render selection** と同じ経路で全体をレンダリングします。出力は 1 つの zip で、途中で任意のパスワード保護を選べます。

率直に言って制限が 2 つあります。2 〜 8 件という上限は実際の制約です。カードごとにライブのランタイムが動くため、快適に動作する件数がこの範囲です。それを超える指定（または存在しないセッションの指定）を含むリンクは、中途半端に読み込まず、その旨を伝えます。もう 1 つ、リンクが指すのは*あなたの*保存枠なので、開き直せるのはこのデバイス上のその組み合わせです。共有リンクではありません。

選択が 8 件を超える、複数のツールが混ざる、セッションだけでなく画像も含む、といった場合の逃げ道が、同じ選択バーの **Edit as sheet** です。選択全体を**バッチグリッドの行**（`#/pro?s=…`）として開き、件数の上限も同一ツールの制約もありません。フォルダーはどちらの対象にもならず、独自のグリッドで開く経路を持ちます。（ここにまだ届いていないのが[検索](/info/search.html)です。Multi-edit は検索バーが把握していない唯一のビューです。）

## オフラインとインストール

Lolly は PWA です。最初の読み込み以降は**オフライン**で動作します。ブラウザーのアドレスバー（モバイルでは *Add to Home Screen*）からインストールすると、アプリのような全画面表示で使えます。オンラインに戻ると自動で更新されます。

アップデートについて:アップデート直後にビューが読み込みに失敗した場合(空白のパネル、隅に表示される「failed to fetch」など)は、ページを一度リロードしてください。アプリは新しいバージョンを問題なく読み込み、あなたの作業、セッション、ブランドはそのまま保持されます。すべてはページ内ではなくデバイス上に保存されているためです。
