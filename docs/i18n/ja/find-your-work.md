# 作品を探して復元する

保存しなかったデザイン、ダウンロードしたファイル、先週のバージョン、ブラウザのデータ消去後の作品を探します。まずは表をご覧ください。

個人の作品は、[同期](/info/sync.html)をオンにしないかぎり、作成に使ったデバイスのブラウザまたはアプリにとどまります。任意のLolly Workを使う組織では、**Team projects**もサーバーに保存します。

| 行ったこと | 探す場所 |
|---|---|
| **Save as**または**Save**を押した | **Projects** |
| **Download**を押した | ブラウザのダウンロードと、**Assets**内のコピー |
| [作業中に保存するツール](#which-tools-save-as-you-work)で、どちらも押していない | **Projects**と**History** |
| 作業中に保存しないツールで、どちらも押していない | 作業していたタブだけ。タブを閉じるまで |
| アプリ内で削除した | **Projects**、**Assets**、**Settings → Storage**内の**Trash**。30日間 |

::: figure find-your-work-places
作品の保存場所: ブラウザ独自のストレージにProjects、History、Trashが保存され、ダウンロードはデバイスのフォルダに入ります。Syncとバックアップファイルは、ブラウザの外にあるコピーです。
:::

::: details Lolly Workで共有された作品を探す(任意)
組織のLollyを開き、サインインして**Projects → Team projects**を確認します。そのインスタンスには共有セッションがあり、アクセス権のあるものが表示されます。別のデバイスでサインインすると、それらのセッションに再びアクセスできます。サインインしても、個人のライブラリやデバイスのバックアップは復元されません。

Lolly Workの[共同作業](/info/collaborate.html#collabs-through-lolly-work-optional)では、**Saved to work**が表示されるまで待ってから離れてください。共有プロジェクトが見つからない場合は、正しいインスタンスに接続しているかを確認し、アクセス権や保持期間について運用者に問い合わせてください。ブラウザのデータを消去するとローカルのコピーは削除されますが、組織のサーバー上のコピーは削除されません。[組織でLollyを使う](/info/organisation.html)をご覧ください。
:::

<!--i:eti-search-->
## 保存したものを探す

1. ツールの左上にある**Home**を押します。
2. ホーム画面の上部にある**Projects**タブ(スマートフォンではフォルダアイコン)を開きます。
3. **My library**に保存したものはすべて最初の画面にあります。各プロジェクトはフォルダです。すべてのフォルダを検索するには、画面下部の**Search all projects…**に入力します。

項目名は、書き出しパネルに入力したファイル名になります。ファイル名がない場合は、**QR Code**などのツール名になります。項目を開くと、すべての設定が復元されます。新しい作品の保存については、[保存と再開](/info/using.html#saving-continuing)をご覧ください。

::: note Projectsにありませんか？
- **Trash**にあるかもしれません。[削除したものを取り戻す](#get-back-something-you-deleted)をご覧ください。
- 別のブラウザ、プライベートウィンドウ、別のデバイスは、[同期](/info/sync.html)を使うか[作品を移動](#move-your-work-to-another-device)しないかぎり空の状態で始まります。
- **Download**だけを押した場合は、[ダウンロードしたファイルを探す](#find-a-file-you-downloaded)をご覧ください。
:::

::: details Projectsを使う
**Projects**ビューは、**Settings → Storage → Saved sessions → Organise in Projects**からも開けます。ファイルマネージャーのように使えます。

![何も保存されていないProjects: New folder、New asset、Templatesのタイル、右上のHistoryの時計、下部のSearch all projectsバー](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **フォルダを入れ子にする。** 保存済みセッションをフォルダに入れ、さらにフォルダの中にフォルダを、何階層でも置けます。フォルダを作成、改名したり、タイルをフォルダにドラッグして移動したりできます。パンくずリストで上の階層に戻れます。フォルダを指定せずに保存したセッションは、**Projects**のルートにあります。
- <!--i:clock--> **好きな順に並べ替える。** 右上のスライダーボタンの**View options**では、**Grid**または**List**を選び、**Name**、**Date added**、**Last modified**(既定)、**Size**、フォルダ内では**By tool**で並べ替えられます。フォルダは常に先に表示されます。セッションとフォルダは、それぞれのグループ内で並べ替えられます。
- <!--i:document--> **新しい作品をそのまま保存する。** **New asset**は共通のピッカーを開きます。保存済みテンプレートから始めるには**Templates**を選びます。テンプレートを開いて編集するか、**+ Add**を押して新しい作品をすぐに保存します。
- <!--i:checklist--> **複数選択(デスクトップ)。** タイルのチェックボックスにチェックを入れるか、空いている場所で選択ボックスをドラッグするか、**Shift/Cmdを押しながらクリック**します。タイルのコンテキストメニューは、タイルを**右クリック**して開きます。選択バーには**Render selection**、**Move to…**、**New folder**、**Delete**(Trashに移動)があります。**Edit together**は、単一ツールのセッションを2〜8個、1つのサイドバーの下に並べて開きます。**Edit as sheet**は、数や組み合わせを問わず、選んだものをバッチグリッドの行として開きます。
- <!--i:download--> **フォルダ全体や選択範囲をレンダリングする。** **Render folder**は、フォルダとそのサブフォルダ内のすべての保存済みセッションを、入れ子になった1つの`.zip`に書き出します。**Render selection**は、複数選択に対して同じことを行います。単一のセッションは、それ自身のファイルにレンダリングされます。
- <!--i:link--> **ツールの保存済み作品に直接移動する。** Toolsギャラリーで1つ以上のツールにチェックを入れ、選択バーの**View sessions**を選びます。するとProjectsには、そのツールで作ったセッションだけが表示されます。**Clear**で全体の表示に戻ります。
- <!--i:link--> **保存済みセッションを共有する。** セッションを右クリックし(スマートフォンではタイルの**•••**を押し)、**Share link**を選びます。リンクはセッションを同じ設定で開き直します。デバイス上の画像はリンクに含まれません。Shareダイアログの全容については、[作ったものを共有する](/info/using.html#sharing-your-work)をご覧ください。
- <!--i:pentool--> **名前を変える、コピーする。** 同じメニューに**Rename**、**Duplicate**(同じフォルダ内にコピー)、**Move to…**があります。

![ProjectsのView optionsポップオーバー: GridとListを備えたLayout、Last modifiedに設定されたSort by、その隣に並び順を反転するボタン](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
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
The popover (views/projects-view-options.ts, checked 2026-09-26) holds a
Layout pair (Grid / List) and a Sort by menu with a reverse button; the
options inside the menu (Name, Date added, Last modified, Size, By tool) are
not visible in the closed menu, so the alt does not list them.
-->

:::

<!--i:eti-refresh-->
## タブを閉じたりツールを離れたりした場合

復元されるものは、離れ方とツールによって異なります。

- **タブを閉じた、または後で戻ってきた場合。** [作業中に保存するツール](#which-tools-save-as-you-work)を除き、未保存の作品は失われます。保存されている作品は**Projects**から開きます。
- **同じタブでページを再読み込みした場合。** 設定はページのアドレスから復元されます。作業中に保存しないツールでは、アドレスにデバイス上の画像やファイル、150文字を超える1行のテキストは含まれないため、それらは復元されません。
- **Homeまたは左上の戻るボタンを押した場合。** 最後に保存、ダウンロード、コピーしてから何かを変更していると、**Unsaved edits**ダイアログが先に保存するかを尋ねます。**Save & leave**は作品を保存して**Projects**へ移動するか、その作品を開いたプロジェクトフォルダへ戻ります。**Leave anyway**は変更を破棄します。保存済みの項目は最後に保存した状態に戻り、一度も保存していない作品は**Projects**から消えます。**Cancel**はツールにとどまります。

::: warning タブを閉じる際に確認はありません
タブを閉じる、再読み込みする、ブラウザ自身の戻るボタンを使う場合、確認は一切ありません。確実に残すには、ツールを離れる前に**Save as**、または書き出しパネルの**Save**を押してください。
:::

自動復元を利用できない場合は、編集コントロールの横に、何を残す必要があるかを示す注記が表示されます。

- 持ち込んだファイルを扱うツールでは、設定を保存し、元のファイルも保管してください。
- 録画や録音のツール、またはSaveアクションがないユーティリティでは、離れる前に結果を保存またはダウンロードしてください。
- デスクトップアプリとモバイルアプリでは、手動で保存する必要がある場合にその旨を表示します。
- 非公開の共同作業では、招待した人が、相手の変更も含めてドキュメントとその履歴を保持します。参加した人は一時的なコピーで作業するため、セッションが終わる前に別のコピーを保存してください。

::: note 誤って保存せずに離れましたか？
作業中に保存するツールでは、Historyが破棄した編集のコピーを30日間保持します。**History**ページを開き、**Changes**で見つけて、**Open as a copy**を押します。それ以外のツールでは、変更は失われます。
:::

::: details 作業中に保存するツール
Webアプリでは、Lolly Design、Lolly Chart、QR Code、Text、Lolly Sandboxなど、ドキュメントを作るすべてのツールが作業中に保存します。次のツールは保存しません。

- Redact、Sign、Convert Imageなど、持ち込んだファイルを扱うツール。Lollyはそのファイルのコピーを保持しないためです。
- Record、Lolly Screen Capture、Lolly Voice Recorderなど、カメラ、マイク、画面から録画や録音を行うツール。
- Countdownなど、変更するものがないツール。

それ以外のツールでは、最初の変更で、保存した場合と同じように作品が**Projects**に入ります。その後の変更は、ツールが描画を終えると保持されます。未保存の作品はタブを閉じた後もProjectsに残り、開き直すと変更が未保存として表示されます。

**Leave anyway**は、これまでどおり変更を破棄します。ホーム画面からツールを開き直すと、新しい作品が始まります。前の作品はProjectsから開いてください。

3DとLolly Darkroomは作業中に保存しますが、3DモデルやLUTなど、読み込んだファイルは保持しません。Historyと**Save**はファイルの名前、種類、サイズを保持し、ファイルそのものは保持しません。作品を開き直すと、どのファイルかを示す注記が表示され、そのファイルを再び読み込むまでは、ファイルなしでツールが動作します。元のファイルを保管してください。

この方法で保存された作品は、[同期](/info/sync.html)がオンなら他のデバイスにも届きます。各バージョンは、それを作ったデバイスにとどまります。

作品を2つのタブで開き、両方で保存すると、最後の保存内容が保持されます。置き換えられた作品は、その作品のHistoryの**Protected drafts**にあり、**Open draft as a copy**で開けます。

これはWebアプリでのみ動作し、デスクトップアプリやモバイルアプリでは動作しません。他の人とライブで作業している間も動作しません。
:::

<!--i:eti-download-->
## ダウンロードしたファイルを探す

ブラウザでは、**Download**がファイルをブラウザに渡します。ブラウザはダウンロード用のフォルダ(通常は**Downloads**)にファイルを保存するか、保存先を尋ねます。Lollyにはファイルの保存先が通知されないため、ブラウザのダウンロード一覧を確認してください。

ファイルが見当たらない場合は、ツールを開いている間に書き出しパネルを確認してください。**Download**の下の行に、ファイル名と時刻、**Retry download**が表示されます。Chrome、Edge、その他のChromiumブラウザでは、その行にフォルダを選べる**Save file…**もあります。この行とファイルは、ツールを離れる、再読み込みする、再び書き出すまで残ります。

Lollyは、ダウンロードのたびに次の2つも保持します。

- **ファイルのコピー**。**Settings → Your renders**の**Save my renders to my library**がオンの間、**Assets**の**Your uploads**に保存します(**Settings**はホーム画面の下部にあります)。この設定は最初からオンです。動画や50 MBを超えるファイルは事前に確認し、zipはコピーしません。
- 直近24回のダウンロードで**使った設定**。**Projects**の保存済み作品の下にある**Recent exports**は、その設定でツールを開き直します。デバイスから追加した画像やファイルは含まれません。同じ一覧は、**Settings → Activity & stats → Latest exports**と、**History**の**Changes**タブにもあります。

::: details デスクトップアプリとモバイルアプリの場合
- **デスクトップアプリ:** **Download**は、ダイアログを表示せず、**Downloads**フォルダ内の**Lolly**フォルダに保存します。**Download**の下の行に「Saved to Downloads/Lolly」などの保存先と、**Show in folder**が表示されます。**Window**または**Exports**メニューの**Open Exports Folder**で、いつでもフォルダを開けます。以前のファイルと同じ名前のファイルは「name (1)」として保存されます。
- **iPhoneとiPad:** ファイルは**Files**アプリの**Lolly**内に保存され、共有シートが開きます。**Download**の下の行には「Saved to Files → Lolly」と表示されます。
- **Android:** 共有メニューが開きます。ファイルの保存先を選びます。

iPhone、iPad、Androidでは、新しいファイルが同じ名前の以前のファイルを置き換えます。
:::

<!--i:eti-history-->
## 以前のバージョンに戻す

- **今回開いている間:** **Undo**で直近100回の変更をさかのぼれます。ツールを離れるか、再読み込みするまで有効です。[元に戻す／やり直す](/info/using.html#undo-and-redo)をご覧ください。
- **[作業中に保存するツール](#which-tools-save-as-you-work)の場合:** 各作品の以前のバージョンが保持されます。
- **デバイス上のすべて:** [同期](/info/sync.html)がオンの場合、**Settings → Connected services**の**Restore an earlier copy**で、直近7日分の日次コピーのいずれか、または最後に適用する前のコピーを復元できます。その後、このデバイス上のすべてが、そのコピーと同じ状態になります。

以前のバージョンを開くには、次のようにします。

1. **Undo**と**Redo**の横にある時計ボタンの**History**を押します。Lolly Designでは、**History**はトップバーにあります。スマートフォンでは、**•••**、**History**の順に押します。TextやLolly Sandboxなど、**Undo**がないツールでは、**History**は左上の**Home**の横にあります。
2. 日時でバージョンを探します。**Automatic checkpoint**の行は作業中に記録されたもので、**Saved version**の行は保存した時点のものです。
3. **Open as a copy**を押します。そのバージョンは新しい作品として開き、開いていた作品は元のままです。コピーは、名前の後に「(copy)」を付けて**Projects**に入ります。

バージョンに名前を付けて残すには、**Name version**を押し、名前を入力して**Keep milestone**を押します。名前付きバージョンは、**History**ページの**Milestones**に一覧表示されます。

::: details HistoryパネルとHistoryページ
**History**パネルには**Recovered work**の行も並び、**Protected drafts**はチェックポイント間の最新の編集を保持します。**Open draft as a copy**で開けます。**Lolly Compare**と**Check assets**は、コピーを開く前に選ぶ際に役立ちます。**This creation**を**All history on this device**に切り替えると、すべての作品が表示されます。

自動チェックポイントは、古くなるにつれて間引かれます。直近1時間は1分に1つ、直近1日は1時間に1つ、30日までは1日に1つ、それ以降は1週間に1つです。保存したバージョンと名前付きバージョンはすべて保持されます。作品を削除すると、そのバージョンも**Trash**に移り、**Delete forever**で削除されます。

Historyの保存領域がいっぱいになると、30日間開いていない作品の古い自動チェックポイントから削除されます。その場合も、保存内容は必ず保持されます。現在の作品として書き込まれ、Historyには、この保存内容はバージョンとして保持されていないと表示されます。**Settings → Storage**でHistoryの使用容量を確認できます。

このブラウザ内のすべての作品を対象にするのが、**History**ページ(`#/history`)です。ページを開くには、ホーム画面または**Projects**の右上にある時計ボタンを押すか、プロフィールメニュー(スマートフォンでは右上の丸いロゴボタン)で**Saved sessions**を選ぶか、ツールのHistoryパネルで**Open app history**を押します。デスクトップアプリとモバイルアプリにはHistoryページがありません。その場合、ホーム画面の時計ボタンと**Saved sessions**は**Your recent work**を開きます。直近の保存済みセッションと書き出し、Projectsへのリンクが表示されます。

- **Recent**は、作品を新しい順に**Resume**とともに一覧表示します。
- **Changes**は、チェックポイント、ダウンロード、Convertの結果を1つのタイムラインに並べます。ダウンロードには**Reopen settings**があります。
- **Milestones**は、名前付きバージョンを一覧表示します。

各作品は、画像付きのタイルです。**Grid**または**List**でレイアウトを切り替えます。プロジェクト、ツール、日付で絞り込めます(スマートフォンでは**Filters**の中にあります)。タイルのメニュー(右クリックまたは長押し)には、**Resume**、**Versions**、**Show in Projects**、**Move to Trash**があります。複数を削除するには、選択して**Move to Trash**を選びます。Undoで元に戻せます。
:::

<!--i:eti-folder-move-->
## 別のデバイスに作品を移動する

| 目的 | 使うもの |
|---|---|
| デバイス間で同じ状態を保つ | **Settings → Connected services**の**Sync across devices**。[デバイスを同期する](/info/sync.html)をご覧ください |
| すべてを一度だけ移動する | 下記の**Export my data**と**Import data…** |
| 1つのデザインやプロジェクトを渡す | `.lolly`ファイル。**Export**、**Share**、**Download .lolly**の順に選びます。プロジェクト全体の場合は、フォルダのメニューで**Download project (.lolly)**を選びます。別のデバイスで**Open**を押します。[.lollyファイル](/info/using.html#the-lolly-file)をご覧ください |

共有リンクは設定を含みますが、デバイスから追加した画像やファイルは含みません。

::: note 読み込みは追加だけを行い、削除はしません
ファイル内のフォルダ、お気に入り、テンプレートは、移行先のデバイスにすでにあるものに追加されます。保存済みの項目が両方にある場合は、より新しく保存されたコピーを保持します。そのデバイス上の自分の詳細と設定は、そのままです。空のものはファイルから補われます。Syncの**Bring it to this device**も同じように動作します。
:::

すべてを一度だけ移動するには、次のようにします。

1. 元のデバイスで**Settings → Storage**を開き、**Move to another device**の下の**Export my data**を押します。Lollyは1つの`.zip`ファイルをダウンロードします。名前は`LollyTools-`で始まります。
2. USB、自分宛てのメール、AirDrop、共有フォルダでファイルを移します。
3. 新しいデバイスで**Settings → Storage**を開き、**Import data…**を押し、ファイルを選んで**Import**を押します。

::: note 移動しないもの
サインイン状態、キー、同期のパスフレーズは、各デバイスにとどまります。最近のダウンロード一覧、オフライン用のダウンロード、AIモデルは、どの方法でも移動しません。バージョン履歴は**Export my data**のファイルでのみ移動し、Syncや`.lolly`では移動しません。履歴が大きすぎて1つのファイルに収まらない場合は、最も古い自動チェックポイントから除外され、書き出しの行に件数が表示されます。Syncが自分のストレージに保持しているコピーを、バックアップファイルと同じようにダウンロードして開いたり、**Import data…**で選んだりできます。暗号化されたコピーは、パスフレーズを求めます。
:::

::: details バックアップファイルに含まれるもの
ファイル名は`LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`です。名前の部分はプロフィールから取得し、未設定なら省略されます。`<n>`は、同じ日に行った書き出しの回数です。ファイルには、フォルダ、Trash、テンプレート、お気に入りを含むプロフィール、サムネイル付きのすべての保存済みセッション、アップロードした画像、フォント、ロゴ、ダウンロードのコピー、デザインシステム、環境設定(テーマ、サイドバーの幅、ローカルのアクティビティ統計)、Convertの保存済みバージョンと結果、Webアプリからは作品のバージョン履歴が含まれます。

カタログのキャッシュは含まれません。新しいデバイスがキャッシュを再びダウンロードします。各部分にチェックサムがあるため、転送中に破損したファイルは読み込み時に検出されます。保存済みセッションは、読み込んだ画像に再びリンクします。Web、デスクトップ、モバイルのアプリは、同じファイルを読み取ります。ターミナルアプリは独自の簡易バックアップを書き出しますが、この形式では読み取れません。**Export my data & render everything**は、同じファイルに加え、すべての保存済みセッションを出力にレンダリングした2つ目のzipを作ります。完全な形式は[データの移行](/info/data-transfer.html)で説明しています。
:::

<!--i:eti-globe-->
## ブラウザのデータを消去した場合

Webアプリでは、Lollyはすべてを、このサイト用のブラウザストレージに保持します。保存した作品、画像、フォント、デザインシステム、バージョン履歴、オフライン用のダウンロードです。ブラウザでこのサイトのデータを消去すると、すべて削除され、Lollyは何も復元できません。残るのは、すでにブラウザの外に出たものです。ダウンロードしたファイル、**Export my data**のファイル、[同期](/info/sync.html)のコピー、共有したリンクです。

::: warning ブラウザのデータを消去する前に
**Settings → Storage**の**Export my data**を押し、ファイルを別の場所に保管してください。
:::

アプリの起動時に、Lollyはデバイスの空き容量が少なくなってもストレージを消去しないようブラウザに求め、ブラウザが判断します。**Settings → Available offline**で、**Protected**から始まる行は、ブラウザが同意したことを示します。「The browser may clear downloads if the device runs low on space」は同意しなかったことを示し、**Protect downloads**で再び求めます。

ブラウザが同意しなかった場合、空き容量が少なくなると、ダウンロードだけでなく保存済みの作品も消去されることがあるため、最近の**Export my data**ファイルを保管してください。

**Settings → Storage**は、データの種類ごとの使用容量を表示します。**History**の行は、自動チェックポイント、そのプレビュー、復元用の下書きを数えます。**Remove automatic checkpoints older than 30 days**は、その領域を解放し、保存したバージョンと名前付きバージョンは保持します。**Clear cache**はダウンロード済みのカタログファイルを削除し、必要になれば再びダウンロードします。**Clear all my data**は確認用の単語の入力を求め、Syncをオフにしてから、Lollyがこのブラウザに保持するすべてを削除します。プロフィールと設定、履歴を含む保存済みセッションとTrash、アップロード、フォントとデザインシステム、ダウンロードログ、Convertの結果、ダウンロード済みのAIモデル、オフラインのコピーです。ダウンロードしたファイルは、保存した場所に残ります。その後、アプリは初めて開いたときと同じ状態で起動します。

![スマートフォン幅の画面のストレージカード: デバイス上のデータの全カテゴリ名と、下部のClear all my dataボタン](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

デスクトップアプリとモバイルアプリでは、保存済みセッションはアプリ独自のデータフォルダ内のファイルで、それ以外はすべてアプリ独自のストレージにあります。Webブラウザのデータを消去しても、これらには影響しません。

::: details デスクトップアプリとモバイルアプリの保存済みセッションの場所
保存済みセッション1つにつき1つのファイルが、`saved-state`フォルダにあります。

- macOS: `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows: `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux: `~/.local/share/tools.lolly.Desktop/saved-state/`、または`$XDG_DATA_HOME`の下の同じパス
- iPhone、iPad、Android: アプリ独自のストレージ内にあり、Filesアプリには表示されません

画像、デザインシステム、最近のダウンロード一覧は、これらのフォルダではなく、アプリの内部ストレージにとどまります。ターミナルアプリとコマンドラインは、同じ`saved-state`フォルダを読み取ります。[保存済みセッションの場所](/info/cli-reference.html#where-saved-sessions-live)をご覧ください。
:::

<!--i:eti-trash-->
## 削除したものを取り戻す

アプリ内で保存済みセッション、フォルダ、自分のアップロードやフォントを削除すると、30日間**Trash**に移ります。**Projects**、**Assets**、**Settings → Storage**、ツールの保存済みセッション一覧のどこで削除しても同じです。フォルダとその中身はすべて、1つの項目としてTrashに移ります。セッションはTrash内でもバージョン履歴を保持します。削除直後は、メッセージに**Undo**が表示されます。後から戻すには、次のようにします。

1. **Trash**を開きます。**Projects**の**Trash**タイル、**Assets → Your uploads**の**Trash**ボタン、**Settings → Storage**の**Trash**行のいずれかを使います。3つとも同じ一覧を開きます。
2. 項目の横の**Restore**を押します。項目は元のフォルダに戻り、フォントはデザインシステム内で担っていた役割も戻ります。

**Delete forever**は、1つの項目を完全に削除します。**Empty Trash**は事前に確認し、Trash内のすべての項目を削除します。30日を過ぎた項目は、完全に削除されます。

::: warning すぐに削除されるものもあります
デザインシステム、ロゴ、プロフィール写真の削除は、Trashに移りません。コマンドラインとターミナルアプリも、即座に削除します。
:::

デバイス全体は、[同期](/info/sync.html)がオンなら、**Restore an earlier copy**で以前の日の状態に戻せます。**Export my data**のファイルは、そのファイルに含まれるものを復元します。
