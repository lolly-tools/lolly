# Design System Setup

ロゴ、色、書体は1か所にあるべきもので、そうすればすべてのツール、ページ、書き出しがそれらで描画されます。その場所が`#/start`の**Design System Setup**で、そのタグラインがその目的を表しています。*Make it yours*(自分らしくする)。

お持ちのものから始めてください。ロゴをドロップすると、Lollyがその色を読み取ります。書体を選ぶか、会社がライセンスを持つフォントファイルをドロップします。変更は、アプリ全体にすぐ反映されます。ロゴ、フォント、トークンは、このデバイスにとどまります。外部に接続する唯一の手順がGoogleフォントの選択で、Lollyは先に確認を求めてから、そのファミリーを一度だけ取得します。

見た目が整ったら、デザインシステムに名前を付けて**Export**を押します。保管用、別のデバイスで開く用、同僚に渡す用の、1つの`.lolly`ファイルが得られます。[Settings](/info/dashboard.html#design-system)には、現在のシステムが読み取り専用で表示され、その表紙からここへ編集のリンクが戻ります。

## 5分で自分らしく

::: timeline
- <!--i:upload--> **ロゴをドロップする。** **Logos**のドロップゾーンにドロップします。Lollyがその形と色を読み取ります。
- <!--i:palette--> **これらの色を使う。** ロゴの主要な色がプライマリになり、ロゴの濃いニュートラルがテキストの色になります。
- <!--i:font--> **書体を選ぶ。** **Type**で、Googleフォントか、お持ちのフォントファイルを選びます。
- <!--i:pentool--> **システムに名前を付ける。** 最初の編集でご自身のデザインシステムが作られ、Lollyが名前を一度だけ尋ねます。
- <!--i:download--> **Export**は、システム全体を1つの`LollyBrand-….lolly`ファイルとして書き出します。
:::

ヘッダーには、どのデザインシステムを**Editing**しているかが表示され、その名前は、いつでも変更できるフィールドです。最初の編集で**What is this design system called?**と尋ねられたとき、ロゴが言葉を綴っている場合は、そこから取った言葉が入力されています。**Save name**は名前を保持し、**Not now**は、ヘッダーに入力するまで仮の名前を保持します。名前は、Settingsとシステムを切り替えるときのシステムのラベルになり、**Export**が書き出すファイルの名前にもなります。

## ルーム

スタジオは、側面のレールに並ぶルームの集まりで、順序は決まっていません。番号は付かず、他の何かを待つこともありません。スマートフォンでは、レールはヘッダーの下のチップの帯になります。

![スタジオのルームレール: Overview、Colours、Type、Logos、Tokens、Files、Usage & rules](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| ルーム | そこですること | リンクキー |
|---|---|---|
| **Overview** | システムが持つものを確認し、各ルームへの入口がある | `overview` |
| **Colours** | 色を追加し、役割を与え、シェードとパレットを作る | `color` |
| **Type** | アプリ、ツール、すべての書き出しが読む4つの書体を選ぶ | `type` |
| **Logos** | あらゆる向きと処理でマークを配置する | `logos` |
| **Tokens** | 角丸、余白、影、その他すべての名前付きの値 | `tokens` |
| **Files** | ブランドが保持する画像、音声、モーションのファイル | `catalogue` |
| **Usage & rules** | ブランドが適用するルールを、実際の例で確認する | `usage` |

ルームへは`#/start?area=<key>`でリンクします。Filesルームは、ルームのキーが恒久的な契約であるため`catalogue`というキーを保持し、`?tab=`も古い別名としてまだ動作します。不明なキーはOverviewを開きます。

**レールの下部**には、1つのルームではなくシステム全体に対する操作があります。**Add from…**はブランドを取り込み([ブランドを取り込む](#bring-a-brand-in))、**Tray**は、スキャンで見つかったもののまだ追加していないものを保持します。**Export**、**Tokens (.json)**、**Fonts for Linux (.rpm)**、**Versions**、**Restore brand settings**は、システムを保存、移動します([デザインシステムを保管して移す](#keep-and-move-your-design-system))。それぞれ、操作の対象があるときに表示されます。

## Overview

まだ何も選んでいない場合、Overviewは始め方を4つ提示します。**Start from a reference**は、ロゴ、スクリーンショット、Webページ、デザインファイルのソース選択画面を開き、**Pick a colour**、**Choose a face**、**Add a logo**は、それぞれのコントロールを直接開きます。開いても何も書き込まれず、**Explore the tools**は最初から表示されています。

何かがご自身のものになると、Overviewは、持っているものを、ご自身のものの数を先頭にして表示します。Coloursは色の数を示し、継承された色が表示される場合は、控えめに`· N starter`が付きます。そのストリップでは、ご自身の色が先に、続いて細い線、その後に薄く表示されたスターターの色が並びます。Typeは役割別に読み取れます(*Inter for headings*、その下の行に*Starter for the rest*)。Logosは埋まったスロットの数(または**Not set**)を示し、Tokensは角丸を示し、Filesはライブラリが空のあいだ**Nothing yet**と表示します。どのブロックも、そのルームを開きます。

### スターターとご自身のもの

**Starter**は、選んだものではなく、アプリに付属していたものすべてを指す言葉です。新規インストールには色がまったくなく、インクから紙までの1本のニュートラルなランプだけがあり、誰かが何かを決める前でも、サーフェス、テキスト、ヘアラインが描画できます。同じ言葉が、すべてのルームで継承された素材を示します。

::: cols
## Starter

- アプリに付属していたもの: インクから紙までのニュートラル、スターターの書体、既定の角丸。
- 控えめに、**Starter**タグが付き、色味はありません。
- ご自身の色としては数えられません。ニュートラルは**Tokens**に**Neutrals · starter · 9**として存在し、**Open**はそれをColoursに、折りたたまれた1つのグループとして表示します(`#/start?area=color&group=neutral`)。
- スターターの色の上にある役割は*"Starter Paper stands in"*と表示され、ピッカーに**Choose…**があります。

## Yours

- ご自身で選んだ、またはインストールしたもの。
- 通常の強さで、書体をインストールした場合は色味付きのカードで表示されます。
- OverviewとTokensで数えられます。
- 別の役割に従う役割は、プライマリの名前を繰り返さず、**↳ follows Primary**と表示されます。
:::

継承された素材が破線の枠で描かれることはありません。ここでは破線の枠がドロップ先を意味するためです。

## Logos

マークのフォルダを、上部のドロップゾーンにまとめて入れてください。**"Drop marks here, or choose several at once"**は、いくつでもファイルを受け付けます。各ファイルは形とインクを読み取られ、**Waiting for a slot**の下で、外観を示すチップとして待機します。たとえば*"Looks like the Horizontal primary"*のように、使った計測値と**Place**ボタン(スロットが埋まっている場合は**Replace**)が付きます。判断に自信がない場合、チップはその旨を示して**Change slot**を提案し、8つすべてを一覧にします。何かを押すまでは、何も配置されません。

余白が余分にあるマークには、先にトリミングの提案が出ます。答えるかEscapeを押すと、元のまま入ります。マークが空いている兄弟スロットを埋められる場合、ルームは、派生した**mono**または**reverse**版を、*Generated*と記されたチップとして提案します。

すべてのマークは、**向き**と**処理**ごとに1つずつの、8つの任意のスロットのグリッドに収まります。

- **向き:** Horizontal(ワードマークとシンボルを横に並べる)、Vertical(正方形や縦長のスペース向けに縦に積む)。
- **処理:** Primary、Primary reverse(暗い背景用)、Mono(1色)、Mono reverse。

まだマークのないグループは1行に折りたたまれ、開くとそのスロットが表示されます。スロットをクリックするとPNG、SVG、JPEG、WebPを追加でき、埋まっているスロットをクリックするとマークを置き換えます。すべてはこのデバイスにとどまります。

![HorizontalとVerticalを開いたロゴスロット: 各処理がそれぞれ独立したスロットで、すべてのスロットは任意](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails%3Anth-of-type%281%29%3Esummary%3Bclick%3A.be-logo-identity%3Edetails%3Anth-of-type%282%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks**は、アイコン、紋章、ファビコンなど、ブランドが独自の名前で呼ぶマークです。
- **More identities。** サブブランド、製品、イベントは、それぞれ独自の完全なセットを持てます。**+ Add another logo**を押して、セットに名前を付けます。メインのセットは「Your logo」です。ロゴのアイデンティティが適切な構成要素となるのはいつかは、[ブランドアーキテクチャ](/info/brand-architectures.html)で示しています。
- **Lollyはロゴの色を読み取ります。** ドロップゾーンの下、およびColoursの上部にも、ロゴの色を一覧にしたカードがあり、**Which is the main colour?**と尋ね、最も強い色(書き出された背景の白ではなく)がすでに選択されています。**Use these colours**は、それらをパレットに追加し、主要な色をプライマリにし、ロゴに紙の上で読める濃いニュートラルがある場合は、それをテキストの色にします。**Not now**は、それらをTrayに残します。新規インストールでは、最も可能性の高い答えがすぐに適用され、カードは**Undo**または別の主要な色を提案します。SVGは正確な色を与え、PNG、JPEG、WebPは、マークの実質的な割合を占める色を与えます。

## Colours

ルームはデザインシステムとともに成長します。最初の訪問では決定は1つで、残りはパレットが育つにつれて現れます。

### 最初の色

自分の色がまだないシステムは、大きなチップ1つと入力欄1つで開き、役割、シェード、印刷設定はシステムの成長とともに現れるという一文が添えられます。

- **チップがピッカーです。** **Pick a colour**を押すと、スタジオのOKLCHカードが開き、入力欄にあるものが初期値になります。名前、ホイール、4つのダイヤル、アルファ、**Stored as**があり、下部に**Cancel**と**Add colour**があります。**Add colour**を押すまでは、システムには何も反映されません。
- **入力欄はどんな表記でも受け付けます。** `#e0452b`、`rgb(224 69 43)`、`oklch(58% .19 32)`、色名のいずれかです。リストを貼り付けるとチップの行になり、1つずつ、または**Add all**で追加します。
- **ほかの入り口が2つ。** **Pick a colour from the screen**は、ブラウザに対応があればスポイトを使い、**Take colours from an image**は、このデバイス上のスクリーンショットや写真を読み取ります。
- **Addは無効にならない。** 入力欄が空の場合はピッカーが開き、読み取れないテキストには、その旨が入力欄の下に表示されます。

最初の色が**プライマリ**になり、チップが*"Primary is now Vivid Violet"*のようにそのことを確認し、色を調整する**Fine-tune**が付きます。


### パレットが育つにつれて

色は、広い画面では**In context**プレビューの横に、小さい画面ではその上に並びます。プレビューには、ポスター、グラフ、インターフェースカードがパレットで表示されます。スターターの色は、独自の折りたたみグループにとどまります。

![Lolly DemoのColoursルーム: 折りたたみグループに入ったパレット、名前と16進値付きの各色、下部のダウンロードピル](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![色を1つ追加した後のColoursルーム。パレットとライブの構成プレビューが表示されている](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### 役割: ツールが読むもの

**Roles**は、すべてのツールと書き出しで、どの色がどの役割を担うかを示します。任意であり(3つのばらばらの色で役割がなくても、まったく問題のないシステムです)、どの色にも役割を与えられ、コントラストの表示はサーフェスに対して測定され、APCAが先に表示されます。各役割の行には、通常の強さで表示されるご自身の色、代わりに使われているスターターの色、または**↳ follows Primary**が表示されます。

パレットにシェードができると、ストリップには、ツールが読める7つの役割がすべて表示されます。Primary、Secondary、Surface、Text、Muted、Edge、On primaryです。On primaryはプライマリから導かれ、**Derived**と表示され、ピッカーはありません。

アプリ自身のアクセントは、既定でデザインシステムに従います。これが**Settings → Appearance**の**Interface follows the design system**設定です。この設定をオフにすると、アプリのクロームはニュートラルのままになりますが、ツール、キャンバス、書き出しは、どちらの場合もデザインシステムに従います。

**カラーウェイ。** デザインシステムは複数のリードカラーを持てて、作品ごとに選ばれます。Lollyはすべてのカラーウェイを保持しますが、このルームでは、まだカラーウェイを作成できません。カラーウェイはトークンファイルに記述されます。カラーウェイを持つシステムでは、すべてのカラーウェイに独自のプライマリとセカンダリが必要で、カラーウェイが背景を色づける場合は独自のサーフェスも必要なため、それらの役割はスウォッチエディターで設定したままにします。実際の作業でのカラーウェイは[Lolly Demoを使う](/info/lolly-demo-in-use.html#colourways-on-real-work)で、形式は[デザインシステムにカラーウェイを追加する](/info/colourways.html#add-colourways-to-a-design-system)で確認できます。

### 他の色を探す

プライマリを土台にする3つのツールがあります。最初の2つは提案するだけで、3つ目は、変更を確認した後にパレットを置き換えます。

::: cols
## Explore shades & harmonies

**Starting colour**、**Scheme**(Mono、Complement、Analogous、Triad)、**Shades**の数(3〜20、既定は5)を選びます。**Fine-tune**で、UIの強さ、コントラスト、ブランド上のテキストを設定します。シェードをクリックすると追加され、**Add 5 shades**でグループとして追加します。ご自身の色と役割はそのまま残ります。

## Find matching colours

**Harmony**を選びます。Complementary、Adjacent、Triad、Tetrad、Analogous(**Accents**は2〜5、**Angle**は10°〜45°)です。各候補には生成された名前と**+ Add**があり、1回の操作で1色ずつ追加します。

## Rebuild the whole palette

1つの開始色からパレットを置き換えます。何が変わり、何が残るかを確認した後に行われます。最初にチェックポイントが作られ、その後に**Undo**が提示されます。
:::

3つとも、エンジンと同じ知覚的な色の計算(OKLCH)を使います。**Explore shades & harmonies**では、**Primary**、**Neutral**、**Secondary**の行に提案されたシェードが表示され、**Theme preview**にはコントラストの読み取り値付きでライトとダークの例が示されます。

![3つの提案されたシェードグループ。個別の追加コントロールと、独立したTheme previewが表示されている](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![生成されたアクセント。それぞれにスウォッチ、自動生成された名前、16進値、追加ボタンが付いている](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### 生成したパレットを確定する

**Rebuild the whole palette…**を開き、**Preview full rebuild**を押します。確認画面には、割り当てたとおりに残る役割の数、残るご自身の色の数、再アンカーされるか維持されるシェードカーブ、印刷ロック、非表示のシェード、グラデーションのストップの数が示されます。**Apply rebuilt palette**で確定し、**Cancel**では何も変わりません。その後カードにはフォーカス付きの**Undo**が表示され、入れ替え前に作られたチェックポイントでシステム全体を復元できます。

カラーウェイを持つシステムは、再構築しても、すべてのカラーウェイを保持します。正規のカラーウェイは新しい開始色に従い、他のすべてのカラーウェイは、独自の色、名前、順序、設定を保ちます。確認画面には、どのカラーウェイが従い、どれが色を保つかが一覧になります。編集できない方法でカラーウェイを符号化しているシステムは、Lollyは再構築せず、カードがその理由を示して、何も変わりません。

### エキスパート向けセクション

プレビューと役割の下に、折りたたまれた4つのセクションがあります。それぞれ`#/start?area=color&focus=<name>`で直接開きます。

- **Explore shades & harmonies**(`focus=generate`)。上で説明したとおりです。
- **Shade curves**(`focus=curves`)は、ランプを点ごとに調整し、明度、彩度、色相のカーブ(L / C / H)が別々にあり、ドラッグするとシェードが再描画されます。
- **Contrast**(`focus=contrast`): **Contrast-lock**は、選んだ背景に対するAPCAの目標に達するように、ランプのトーンを調整し、**Rotate hue**はランプ全体を色相環に沿って回転させます。
- **Print**(`focus=print`)は、プライマリが印刷でどうなるかを設定します。自動の値、固定したCMYKの組成、名前付きのスポットインクです。

### パレットと各スウォッチ

パレットには、ご自身の色が折りたたみグループで一覧になり、それぞれに専用の**+ Add**があります。グループは自由に作成、名前変更できます。役割が2つ目のタイルを作ることはなく、役割が指すタイルには、代わりに小さな印(**P**、**S**、**Su**、**T**)が付きます。タイルの下の**Colour chart**は、同じ色をOKLCHの**Wheel**(点をドラッグして再着色し、空いている場所をクリックしてスウォッチを追加)と、表示可能な範囲の限界を示す**Gamut**チャートで表示します。`#/start?area=color&focus=chart`でチャートを直接開きます。

![パレットペイン。すべてのグループが折りたたみ可能で、ダウンロードピルが下端に配置されている](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![OKLCHホイール - 角度が色相、外側への距離が彩度、グレーは側面のライトネスレールに沿って並ぶ](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

スウォッチをクリックして、そのエディターを開きます。

- スウォッチの**名前を変更**します。
- OKLCHスライダーか、**Hex**、**HSL**、**RGB**、**CMYK**で**色を設定**します。値の欄は、有効な色空間で読み書きします。ここでのCMYKは、変換によって画面上の色を設定するものです。正確なインクを固定するには、**Print substitutes**を使います。
- **Stored as**は、スウォッチの保存方法を選びます。**LCH**(既定。知覚的で広色域)、Hex、RGB、HSLです。
- **Use as**は、スウォッチに直接役割を与えます。強調表示された役割をもう一度押すと、役割が解除されます。
- **Print substitutes**(折りたたみ): **CMYK**を**Auto**から正確なインク値にロックするか、**Name**(`PANTONE 186 C`など)、任意の**Book**、箔押し、エンボス、デボス、スポットニス、ソフトタッチ、型抜き、筋入れ、ミシン目の**Finish**を持つ**Spot colour**を設定します。印刷機は、CMYKのPDFまたはTIFFを書き出すときに、これらのロックを使います。[カラープロファイル](/info/exporting.html#colour-profiles)をご覧ください。
- **In other spaces**(折りたたみ): 色空間ごとの値で、導出されたものか、ご自身で指定したものです。指定した値が書き出しで優先されます。

**スウォッチの削除**は安全です。導出されたシェードとテーマの役割は非表示になるだけなので、それらを読むものが壊れることはなく、追加した色は削除されます。

::: details 多数のスウォッチを扱う
各スウォッチにはドラッグ用のハンドルがあります。ドラッグしてグループ内で並べ替えるか、ハンドルにフォーカスを当ててSpaceを押し、矢印キーで移動して、もう一度Spaceで置きます。Escapeでキャンセルします。グループ間で色を移動するには、エディターの**Group**コントロールを使うか、複数を選択して**Move to**を使います。

選択にモードは不要です。バーは、最初のタイルが選択されると現れ、最後のタイルが解除されると消えます。

- **空いている場所をドラッグ**して長方形を描くと、触れたすべてのタイルが、グループをまたいで選択に加わります。折りたたまれたセクションは何も追加しません。
- **Shiftクリック**は読み順での範囲を選び、**Cmd/Ctrlクリック**は1つのタイルを切り替え、通常のクリックはエディターを開きます。
- 各グループのヘッダーには**Select all**があり、タイルにフォーカスがある状態での**Cmd-A**は、スターターの色を除く、ご自身のすべての色を選びます。
- グリッドのタブストップは1つです。矢印で移動し、Shift+矢印で拡張し、Spaceで切り替え、Deleteで削除し、Escapeで解除します。チャンネルを微調整するには、先に`l`、`c`、`h`を押します。
- タッチ画面では、タイルを長押しして選択を始め、その後タップして追加します。

バーには**{n} selected**、続いて**Move to**、**Give a role**(各色が順に次の役割を受け取る)、**Download**(選択範囲を6つのパレット形式のいずれかで)、**Duplicate**(各色のコピーを元の後ろに配置)、**Copy values**、**Delete**が表示されます。コピーが1つの場合はそのままエディターで開き、複数の場合は選択されたままです。Cmd/Ctrl-Zを1回押すと、一括操作全体が元に戻ります。
:::

### グラデーション

任意の**Gradients**パネルは、パレットからブレンドトークンを作ります。各グラデーションには、プレビュー、2〜8個の名前付きストップ、角度があります。ストップはスウォッチを指すため、スウォッチを再着色するとグラデーションが追従します。ブレンドはOKLCHで行われます。

パレットのダウンロード(デザイントークン、CSS、SCSS、GIMP、Adobe Swatch Exchange)は、シェードができると、パレットの下部のピルに表示されます。各形式は[パレットとフォントをどこへでも持ち出す](/info/using.html#take-your-palette-and-fonts-anywhere)で説明しています。

## タイプ

独自の書体がない場合、ルームは1枚のカードだけです。**Primary**が、現在使われている書体で読みやすいサイズで表示され、**Starter**タグ、**Choose a face**ボタン、*"Nothing installs until you choose one."*という一文があります。Headings、Code、Italicは、選ぶまではプライマリに従い、**Choose them separately**でそれらのカードが表示されます。

![まだ書体が選ばれていないTypeルーム - 読みやすいサイズの1枚のカード、その上のStarterタグ、そして塗りつぶされたChoose a face](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

書体を1つ選ぶと、ルームは、4つの役割カード、Fontsの一覧、ライブの見本に開きます。

- **Primary**: 本文、ボタン、すべてのツール。
- **Headings**: `h1`と`h2`用のディスプレイ書体。
- **Code**: コードとデータ用の等幅書体。
- **Italic**: 強調、引用、補足のための本物のイタリック。

カードに色味が付くのは、その書体をインストールした場合だけで、ボタンは、ご自身の書体では**Change**、それ以外では**Choose a face**と表示されます。カード上の操作は何も確定せず、ボタンは、その役割の比較ステージを開きます。

![明らかになった4つのロールカード - それぞれが担当するフェイスで設定され、誰も選んでいない場合はStarterタグが付き、Italicはプライマリに従う](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### 比較ステージ

ステージは、押したカードの下のルーム内で開き、スマートフォンの最初の画面にステージが収まるように、カードは1行のストリップに折りたたまれます。Escapeでキャンセルし、フォーカスはカードに戻ります。

1. カードの**Choose a face**を押します。
2. ファミリー名を入力して**Preview**を押すか、欄の下にある6つの**Pinned**ファミリーのいずれかを押します。
3. **Use this face**を押します。

![そのカードの下に開いた比較ステージ - 検索欄、ピン留めされたファミリー、そして1行のストリップに折りたたまれたカード群](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**同意が求められるのは一度だけです。** プレビューが初めてGoogleフォントに到達するとき、ダイアログが次のように説明します。*Google learns the family name and your IP address. The file is then kept on this device and used offline. This is the one step in the studio that reaches a third party.* **Fetch from Google**で進み、その選択は記憶されます。**Cancel**では、カードに*"Not fetched. Nothing was sent to Google."*と表示され、専用の**Fetch from Google**が付きます。

**ステージにフォントファイルをドロップ**(TTF、OTF、WOFF)すると、すでにお持ちのライセンス済みの書体をプレビューできます。どちらの場合も、書体はこのデバイスにとどまり、アプリ、ツール、すべての書き出しでオフラインでも描画され、デザインシステムのファイルに含まれて持ち運ばれます。Googleフォントのすべては、オープンなライセンス(OFL、Apache、UFL)で提供されています。

### このデバイスのフォント

**Fonts**パネルは、このデバイス上のすべての書体と、それが担う役割を一覧にします。追加した書体は**In the design system**の下に先頭で表示され、それぞれの役割と削除があります。スターターの書体は、控えめな折りたたまれた1行として続きます。**Add a face**は、任意の役割の比較ステージを開きます。**Type roles**パネルは、各役割のライブの見本を、そのファミリーと状態(*Inter*や*Inter · follows Primary*など)とともに表示します。

## トークン

トークンは、デザインシステムの背後にある名前付きの値です。色、書体、ロゴ、角丸、余白など。ツールはそれらを名前で読むため、ここでの変更はすべてのツールに一度に届きます。

![Tokensルーム: システムの例とファイル操作のあるヘッダー、各種類のトークンを数えるタイル、続いてコントラスト表示付きの色のペア](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **ヘッダー**には、ご自身のシステムからの例(*Primary is Spearmint, #033633*)と、ファイル操作があります。**Download**(システム全体をデザイントークンとして、またはパレットを他の5つの形式で)、**Copy CSS**、JSONファイルを読み戻す**Add from…**です。
- **タイル**は各種類のトークンを数え、そのセクションにジャンプします。Colours、Type、Logos、Shape and spacing、More、All tokensです。Overviewと同様に、ご自身のものを数えます。スマートフォンでは、タイルは横にスクロールします。
- **Colours**は、ツールが組み合わせるペア(サーフェス上のテキスト、プライマリ上、サーフェス上のミュート)から始まり、ライトとダークのAPCA値が表示され、足りないペアには**Weak contrast**の印が付きます。その後にすべての色グループが続きます。ランプは1行のチップとして、その他の色は値と、`{color.brand.spearmint}`のようにツールが使う参照とともに表示されます。参照を押すと、その参照がコピーされます。**Edit in Colours**はグループをColoursルームで開きます。
- **Type**と**Logos**は、各役割の書体と各ロゴスロットを一覧にし、ご自身のものがあれば**Edit in Type**と**Edit in Logos**が付きます。
- **Shape and spacing**には、**Rounded corners**(`shape.radius`)と**Spacing rhythm**(`space.base`)があります。それぞれ、スライダーを動かすまでは*Lolly default*、動かした後は*Yours*と表示され、すぐに保存され、元に戻せます。
- **More tokens**は、余白、サイズ、線の太さ、不透明度、回転、単なる数値、影を追加し、標準の[デザイントークン](/info/design-tokens.html)として保存されます。
- **App appearance (advanced)**は、Lolly自身の画面が使う色、サイズ、影を一覧にし、**Inspect every token (advanced)**は、保存されている任意の値を検索、編集し、変更ごとに先にレビュー用に表示します。

何も入っていないセクションには、空白を埋める方法が提示されます。**Pick a colour**、**Choose a face**、**Add a logo**です。

## ファイル

ロゴ以外の、ブランドが保持するファイルをドロップします。**vector**、**image**、**audio**、**motion**のファイル(動画、Lottie、アニメーション)です。これらは[Assets](/info/using.html#assets-your-library)にセクション別に並び、すべてのツールのアセットピッカーですぐに使え、このデバイスにとどまります。

## Usage & rules

**Usage & rules**は、ブランドの選択を実際に機能させます。人が変更できること、固定されたまま変わらないこと、Lollyが確認できること。

![Lolly DemoのUsage & rules: 空のBrand rulesカードとAdd your first rule、続いて、レンダリングの準備ができた例のあるTry your brand in use](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules**は、ルールを一覧にします。**Add rule**(または**Add your first rule**)で短いフォームが開きます。

- ご自身の言葉による**Rule name**。たとえば*Beacon accents*。
- **Check**: **Colour choices**、**Font choices**、**Fixed artwork**、**Text length**のいずれかで、使うブランドの役割を、役割についてのご自身の名前で指定します。
- 適用対象の**Example**(Poster、Title slide、Content slide、Chart)、**Mode**、**Required**か**Advisory**か。
- **Reviewed by**、続いて**Save draft**または**Approve & save**。

承認は、このデバイス上でのご自身の判断を記録します。承認済みの必須ルールは再利用可能なポスターを制約し、チェックの対象は例のPNGのみです。他のツールには影響しません。

デザインシステムがトークンファイルとともに持ち込むルール、たとえば承認済みの色の組み合わせ、テキストの太さと配置、表示面ごとのロゴは、ここに**Checked in Design**として一覧になります。Designは、書き出しパネルの**Before you export**カードでレイヤー単位でそれらを確認し、`lolly check`は保存したDesignドキュメントに同じことを行います([書き出す前に](/info/design.html#before-you-export))。このビルドにチェッカーがないルールは、与えられたまま保持され、**Unchecked**と表示されます。

**Try your brand in use**は、**Render & check examples**で、現在のリビジョンから4つの例をレンダリングします。**Brand mode**を選び、見出し、補足テキスト、スライドのテキスト用に**Try your own text**を入力します。各例は、測定した内容を**See checks & sources**と**Download check report**とともに報告し、**Make reusable poster**は、固定のレイアウトと承認済みの入力の選択がファイルとともに運ばれる`.lolly`をダウンロードします。例はローカルのもので、チェックを実行しても、何も公開も承認もされません。

固定されたブランドとともに出荷されるビルドは、同じルールと例を、*This brand is set*の下に読み取り専用で表示します。

## ブランドを取り込む

レールの下部にある**Add from…**は、形式ではなく、何を持っているかを尋ねるピッカーを開きます。

- **Design tokens or a design file**: DTCGまたはTokens StudioのJSON、Penpotプロジェクト、トークンセットのzip、Lollyデザインシステムのパック、SVG。
- **PDF**: デッキまたはガイドラインのファイル。色、マーク、埋め込まれた書体を、このデバイス上で読み取ります。
- **Logo or screenshot**: 画像から、このデバイス上で読み取って提案されるパレットになります。読み取るのは色であり、書体やレイアウトではありません。
- **Saved web page**: 1つのHTMLファイルとそのCSSファイル、または貼り付けたHTMLやCSS。最大20ファイル、2 MBです。読み取られるのは、与えたテキストだけで、リンクされたリソースは取得されず、スクリプトも実行されません。
- **Font file**: TTF、OTF、WOFF。書体をインストールするTypeルームを開きます。
- **Website**: 1ページで、色と書体を読み取ります。このタイルが表示されるのは、ページを読み取れるデバイスに限られ、使うリーダーも示されます。このデバイス上のアプリか、バックグラウンドタブでお客様としてサインインしたブラウザ拡張機能です。URLを指定しても欄が入力されるだけで、取得を押すことが同意になります。

デザインファイルのソースを選ぶと、次のカードが、対応する形式をアイコンタイルとして一覧にし、カード全体が1つのドロップ先になります。ファイルをスタジオに直接ドロップすることもできます。

![インポートカード - 受け付けるフォーマットが優先順にアイコンタイルとして並び、カード全体が1つのドロップターゲットになっている](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- **Lollyデザインシステムのパック**(`.lolly`、または従来の`.zip`)は、1ステップでインストールされます。
- **Penpot**のエクスポート(`.penpot`)は、そのデザイントークンを取り込みます。
- **Design Tokens**(W3C DTCG)または**Tokens Studio**のファイル(`.json`)は、そのトークンを取り込みます。
- **通常のSVG**は、選べる色が走査され、最初の色がプライマリになります。

### 参照をレビューする

ロゴ、スクリーンショット、Webサイト、保存したページは**Try these colours**を開きます。提案された色による例、変更できる**Main colour**、新しいシステムの名前です。ボックスには、適用で何が起こるかが明記されます。有効なトークン設定を、生成されたパレットと既定のスタイルで**置き換え**、フォントとライブラリのファイルは**保持**し、以前のシステムは**復元**できます。**Apply suggested settings**はチェックポイントを作った後にライトとダークのパレットを適用し、**Restore brand settings**で以前の設定を戻せます。**Change reference**は別のソースを選びます。

**Palette, source details and individual choices**には、読み取った内容、見つかったフォント名、プレビューのコントラストが表示されます。フォント名はあくまで提案で、書体をインストールするのは引き続きTypeです。ソースの詳細には、観測された範囲で、タイポグラフィ、間隔、パディング、角の値が含まれることがあり、観測されなかったものは**Not observed**と表示されます。保存したページやネイティブのWebサイトの読み取りは、宣言されたスタイル(ページが使っていないこともある)を報告し、ブラウザ拡張機能は、表示されている要素のサンプルから測定したスタイルを報告できます。これらは観測であり、何もインストールされず、ソースの間隔がご自身の設定を置き換えることもありません。**Choose individual items in the tray**は個々の項目を保持し、**Download design context**は、観測、提案されたトークン、ソース情報(提供されたHTMLやCSSのSHA-256付き)のJSONレポートを保存します。レポートには生のページテキストは含まれず、署名付きのContent Credentialではありません。

PDFとデザインファイルのインポートには、独自のレビューコントロールがあります。**Tray**内の項目は、その種類の素材を担当するルームで追加するまで、何も変更しません。`#/start?source=<kind>`は、ソース(`file`、`pdf`、`image`、`font`、`url`、`page`)でピッカーを開き、`?import`は通常の一覧を開きます。

### 外観を探して比較する

OverviewまたはSettingsのデザインシステム一覧から**Find a look**を開きます。このデバイスに保存されたシステムと、再利用できるいくつかのLollyの例を閲覧し、名前、色のタグ、宣言されたフォントで検索できます。**Closest to my current palette**は、測定した色の類似度で並べ、同点の場合は一致するフォントで決まります。品質のスコアではありません。

1つの外観を選ぶとレビューでき、2つ選ぶと並べて比較できます。選択しても何も変わりません。**Use this saved system**はそれに切り替え、**Use these colours**は、通常のチェックポイントを経て例の色を適用し、フォントは保持します。**Restore brand settings**は、以前の外観を復元します。保存済みシステムには、**Details and design context**の下に編集可能な**Search tags**があります。例はLolly独自の配色レシピで、収集された素材も、アカウントもありません。

![どちらのカラーシステムを適用する前に、SunroomとOrchardを並べて比較する。](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

## デザインシステムを保管して移す

### ブランドをデバイス間で移す

**Export**は、**`LollyBrand-….lolly`**ファイルを1つ書き出します。トークン、フォント、ロゴ、テーマ設定と、読み戻すときに検査される整合性マニフェストです。1.0.7より前のWebリリースは、同じファイルを`.zip`と呼んでいましたが、その表記も引き続き受け付けられます。**Tokens (.json)**は、フォントもロゴも含まない、通常のデザイントークンのドキュメントだけを書き出します。リポジトリ、ビルドステップ、別のトークンツール向けです。

読み戻すには、**Add from… → Design tokens or a design file**を使うか、ファイルをスタジオにドロップします。これが、同僚からブランドを受け取る方法であり、2つ目のインストールにブランドを持ち込む方法で、アカウントもクラウドも不要です。コマンドラインからブランドを取り込むには、[`ingest:brand`](/info/configuration.html#brand-packs)をご覧ください。

**Fonts for Linux (.rpm)**は、追加したフォントをインストール可能なRPMにパッケージします。ご自身でアップロードしたフォントが含まれる場合、Lollyは先に、再配布してよいことの確認を求めます。

### 以前の設定を復元する

**Restore brand settings**を選び、日付付きのチェックポイントを選択して、**Restore**を押します。現在のブランドの色、書体設定、その他のトークンが復元され、フォントと画像のファイルはそのままです。Lollyは、先に現在の設定を**Before restore**として保存するため、ブラウザを閉じた後でも復元を取り消せます。このデバイスには、直近20個のチェックポイントが保持されます。

### バージョン

公開されたバージョンは、このデバイスに保持される**恒久的な名前付きのコピー**です。変更されないため、それを固定する(`designv`で)ツールやリンクは、いつも同じものを描画し続けます。ご自身のものがあるシステムでは、レール下部に控えめな**Versions & publishing**リンクが表示され、最初の公開後は**Versions**の項目になります。`#/start?area=versions`で直接開きます。

- **バージョンは恒久的です。** まだ削除はなく、パネルにもその旨が書かれています。
- **削除は互換性カードの先頭に表示されます。** ツールを壊すのは、削除されたトークンだからです。
- **公開は取り消せませんが、復元はできます。** *Restore latest from this version*は通常の編集で、すぐに**Undo**が提示されます。

**Publish only**は、ツールが従うものを変えずにバージョンを保持し、**Publish and make active**は、ツールとアプリがそのバージョンに従うようにします。**Follow the latest again**は、編集するたびにすぐすべてを反映します。

## デザインシステムを管理する

**Settings → Preferences → Design systems**を開いて、システムを切り替え、追加、削除します。**Open**はシステムを選択してここで開き、**Make a new one**はローカルのシステムを作成し、名前の欄を準備した状態で開きます。有効なシステムは、デバイス全体で一度に1つです。ブランドに独自のデザインシステムが必要になる場面の判断は、[ブランドアーキテクチャ](/info/brand-architectures.html)が助けになります。

**システムの出どころ。** 配備のカタログが提供するシステムは**Came with this app**、またはインスタンスに接続したアプリでは**From this instance**と表示されます。**Catalogue source**を展開すると、提供元、そのトークンアセットと名前空間、わかっているバージョンまたはチェックサムが表示されます。更新に失敗した場合、キャッシュされた素材にはその旨が示されます。

**管理対象のシステムは読み取り専用です。** カタログがシステムをロックしている場合、システムには**Managed by this instance**(インスタンスのないデスクトップアプリでは**Managed by this app**)と表示されます。使用とダウンロードはでき、ここで開くと、**Make an editable copy**と**Switch**を含む読み取り専用の注記が表示されます。ご自身のローカルのシステムは、管理対象のシステムのほうが先にあっても、編集可能なままです。固定された1つのブランドを持つビルドは、Design System Setupを*This brand is set*で開き、ブランドのトークンと使用ルールを読めます。

**提供されるそれ以外のシステムはすべてご自身のもの**で、非表示、編集、リセットができます。lolly.toolsのLolly DemoとLolly Starterも含みます。編集してもその名前は保たれ、行に**Edited here**と表示され、メニューの**Reset to original**は、このデバイスで行った変更を破棄します。空のスターターは例外で、そこでの最初の変更は、ご自身のデザインシステムを始めることになるため、Lollyは新しいシステムの名前を一度だけ尋ねます。ご自身のシステムが何を置き換えるかは、[Lolly Demoを使う](/info/lolly-demo-in-use.html#switch-to-your-own)で確認できます。

### デザインシステムを削除する

システムのメニューから**Remove**を選びます。確認画面には、その後どのシステムが有効になるかが示されます。保存済みセッション、アップロード、他のシステムと共有している素材は残ります。

提供されたシステムを削除すると、非表示になるだけです。そのカタログアセットは残り、**Bring back**で再び表示され、他のすべてを削除した場合は自動的に戻ります。インポートまたは編集したコピーを削除しても、提供されたシステム、そのロゴ、フォントは削除されず、コピーが有効だった場合は、提供されたシステムが再び有効になります。有効なホスト型コピーを削除すると、そのコピーの接続だけが解除され、別に選んだインスタンスは選択されたままです。

サーバーが提供するものの変更は管理者の仕事です。運用者がソースカタログを変更して再デプロイするか、Lolly Workの管理者がサーバーの変更をレビューして適用します。ここでの編集はローカルにとどまります。[カタログのデザインシステムを削除する](/info/configuration.html#removing-a-catalogue-design-system)と[設定](/info/configuration.html#supplied-and-local-design-systems)をご覧ください。

## アプリの外でデザインコンテキストを使う

**Download design context**は、トークンドキュメント、解決された色、宣言されたフォントファミリー、アセットID、記録されている場合はソースの証拠、カバレッジ、明示的なルールを保存し、フォントファイルや所有権の証明は含みません。コマンドラインは、サーバーなしでこのファイルを読み取ります。`lolly system import`でターミナルのデザインシステムになり、`lolly system check`で、保存したコンテキストに対してDesignの入力を確認します。インポートは[デザインシステムを取り込む](/info/cli.html#bring-your-design-system)で、確認は[コマンドが使うデザインシステム](/info/cli-decks.html#which-design-system-a-command-uses)で扱っており、MCPクライアントは同じブリーフを`lolly://design-context`から読み取ります([MCPサーバー](/info/mcp.html))。

## 次に進む先

- **[Lollyを使う](/info/using.html)**: ツール、保存、共有、Assets。
- **[ブランドアーキテクチャ](/info/brand-architectures.html)**: 部門、製品、エンドース付きブランド、クライアント、シーズンが、デザインシステム、カラーウェイ、ロゴのアイデンティティにどう対応するか。
- **[デザイントークン](/info/design-tokens.html)**: ブランドが記述されるトークンモデル。
- **[ファイルを書き出す](/info/exporting.html)**: 印刷の単位、CMYK、ブランドが出力される形式。
