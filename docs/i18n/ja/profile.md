# プロフィール — 作成するときのあなた自身

**プロフィール**とは、Lollyがそれとして作成を行う作業上のアイデンティティです。ツールが毎回入力し直さずに済むように参照できる、氏名、連絡先、任意のヘッドショット、いくつかの設定といった小さな詳細情報の集まりであり、さらに作業中に蓄積されるもの - 保存されたセッション、アップロードした画像、ローカルのアクティビティ集計 - も含みます。

プロフィール内のすべては**デバイス上**、つまりブラウザのローカルデータベース（Web PWAではIndexedDB、Tauriアプリではファイルシステム）に保存されます。アカウントは存在せず、何もアップロードされることはありません。管理はギャラリー右上の**プロフィール**から行います。ツールはプロフィールを*読み取る*だけであり、しかもあらかじめ事前入力するよう作られた特定のフィールドに限られます。

> プロフィールは*あなた*(あるいはここで作成する人)についてのものです。ブランドの色、フォント、グローバル設定である**Platform**とは異なり、アプリができることのカタログである**Capabilities**とも異なります。末尾の[Profile vs Platform vs Capabilities](#profile-vs-platform-vs-capabilities)を参照してください。

## プロフィールに含まれるもの

| 項目 | 内容 |
|---|---|
| **Name** | 姓と名。 |
| **Contact** | メールアドレスと電話番号。 |
| **Location** | 市区町村と国。 |
| **Headshot** | 任意の写真。正方形にクロップされ、ローカル画像として保持されます。メール署名、見積もりカード、組織図、動的レイアウトなどのツールで使用されます。 |
| **Use my details to create** | 単一のオプトインスイッチです(オンになると**Using my details**と表示されます)。個人の詳細情報が、エクスポートしたファイルに埋め込まれる著者/クレジット行である**provenance(来歴)**として、また**/pro**バッチ実行の作成者として付随するかどうかを制御します。(事前入力自体はこれによって制御されません。[How tools use your profile](#how-tools-use-your-profile)を参照してください。) |
| **Preferences** | テーマ(Light、Dark、またはBrand - ブランドテーマはアプリを自分のパレットで彩ります)と、**Feature flags**で有効にしたアプリの部分。 |
| **Accessibility** | 4つの快適設定 - *Reduce motion*、*Hide colourful previews*、*High contrast*、*Large text* - はプロフィールレコードに保持されるため、プロフィールのエクスポートにも付随します。[Accessibility](#accessibility)を参照してください。 |
| **Your work** | 保存されたセッション(サムネイル付き) - **[Projects](/info/using.html)**内のネストされたフォルダに整理されます - および**My images**ライブラリとローカルのアクティビティ統計。すべてこのプロフィールに紐づきます。 |

![Three theme cards, each previewing its own type and colour, with the active one flagged](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

![Profile画面 - 氏名、連絡先、任意のヘッドショット、各種設定](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

これらはすべて任意です。空欄のプロフィールもそれはそれで問題なく機能します。入力の手間が省ける項目だけを埋めれば十分です。

このページは長いため、側面に独自の**設定レール**を備えています - Your details、Appearance、Accessibility、Lolly instance、Your activity、Storage、Available offline、Feature flags、Content Credentials - その上部には入力するそばからリストを絞り込む**Search settings**フィールドがあります。各セクションは`#/profile?focus=<section-id>`としてディープリンク可能で、これを開くとそのセクションが表示位置までスクロールされます(`#/profile?focus=storage-section`、`?focus=feature-flags-section`など)。そのため、リンクはページの先頭ではなく1つの設定を直接指し示すことができます。

![3つのテーマカード。それぞれ独自のタイプと色をプレビューし、有効なものにはフラグが付いている](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

## プロフィールは単なる「人」ではなく「文脈」

「プロフィール」という言葉は一人の固定された人物を連想させますが、Lollyにおいてそれは実際には**制作の文脈**——*何かを作っている間のあなたが誰であるか*——を意味します。この文脈には3つの異なる形があり、Lollyはそのすべてを同じ方法で扱います。

### 個人として

![The headshot control, empty until you upload a photo that then stays on this device](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

![ヘッドショットのコントロール。写真をアップロードするまでは空で、アップロード後はこの端末に保存される](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

### チームとして

プロフィールは必ずしも一人の個人である必要はありません。組織内の**チームや機能**を代表することもできます。チームの共有名、グループの受信アドレス(`events@…`)、部門名、チームのヘッドショットやユニットマークなどです。一人が設定してエクスポートし(下記参照)、チームの残りのメンバーが同じプロフィールを読み込みます - そうすることで、誰も再入力することなく、チームが生み出すすべてのものに一貫した詳細情報が付随します。共有キオスクや貸し出し用のデモノートPCでは、その裏で作業する全員が同じ1つのチームプロフィールとして作成できます。

### 機能として——時々身にまとう役割

これは「一人につき一プロフィール」という硬直的なモデルでは捉えきれないケースです。あなたは年に3日だけ**イベントマネージャー**であり、それ以外の日はまったく別の何かかもしれません。その3日間はイベントの詳細、イベント用の受信アドレス、場合によってはバッジやサイネージに反映するイベントのサブブランドが欲しくなりますが、残りの362日は普段のアイデンティティに戻りたいはずです。

Lollyでは、その役割は単に**手元に置いておく別のプロフィール**——イベントのために読み込み、終わったら片付けておく保存済みバンドル（次のセクション参照）——にすぎません。役割は帽子であって、新しいアカウントではありません。必要なときにかぶり、終わったら脱げばよいのです。

## インストール1つにつきアクティブなプロフィールは1つ——保持できる数に制限はありません

どの瞬間でも、あるインストールには**1つのアクティブなプロフィール**しかありません - それが今この瞬間にツールから見えている詳細情報です。アプリ内にプロフィール切り替え機能はありません。その代わり、各プロフィールは**持ち運び可能なバンドル**(単一の`.zip`、[下記](#moving-a-profile-to-a-new-device)を参照)です。これは新しい端末への移行と意図的に同じ仕組みです - プロフィールは保存、コピー、読み込みができる1つのファイルです。

![The storage meter, breaking down saved sessions, images and cache against what the browser actually reports](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

- <!--i:trash--> **最もクリーンな切り替え方:** **Profile → Storage → Clear all my data**を実行し、その後、移行先のコンテキスト用のバンドルを**Import**します。これで、そのプロフィールとして純粋に作成する状態になります。
- <!--i:layers--> **レイヤー化:** 先にクリアせずにインポートすると**マージ**されます - インポートされたプロフィール、セッション、画像は既存のものの上に重なり、同名のものは置き換えられ、それ以外は残ります。あるチームの保存済みセッションを自分の環境に取り込むのに便利ですが、明確な役割の境界が必要な場合には向きません。
- <!--i:monitor--> **並行運用:** すべてが端末スコープであるため、別のブラウザプロフィール、別のユーザーアカウント、あるいは2つ目にインストールしたPWAは、それぞれ独立したLollyプロフィールを保持します。個人用のインストールとイベントキオスク用のインストールを、切り替えることなく同時に実行できます。

そのため、複数の文脈（あなた自身、チーム、イベントマネージャーという役割）を実際に使い分けている場合は、複数のバンドルを保持しておき、必要なものを読み込みます。

![ストレージメーター。保存されたセッション、画像、キャッシュの内訳を、ブラウザが実際に報告する値と比較して表示する](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

> 文脈ごとにバンドルを保管し、内容がわかるようファイル名を変更しておきましょう（`LollyTools-events-2026.zip`、`LollyTools-me.zip`）。ファイルそのものが、プロフィール*なのです*。

## アクセシビリティ

**Profile → Accessibility**には、作業の*周り*にあるアプリのための4つの快適設定があります。それぞれオンにするまではオフのままであり、いずれもツールのキャンバスやエクスポートの内部には影響しません - 落ち着いたアプリであっても、あなたが出荷するファイルの1ピクセルたりとも動かしてはならないからです。

- <!--i:film--> **Reduce motion** - アプリ内のトランジション、スライド、装飾的なアニメーションをオフにします。ツールのキャンバスやアニメーション付きのエクスポートは、設計どおりに動き続けます。
- <!--i:image--> **Hide colourful previews** - ギャラリーのプレビュー画像を落ち着いたアイコンとテキストのカードに置き換え、プロジェクトのサムネイルの色とコントラストを下げて、うるさくならずに識別できるようにします。ツールの内部ではすべてフルカラーで表示されます。
- <!--i:sliders--> **High contrast** - アプリの境界線、テキスト、フォーカスリングを強化します。ブランドカラーやキャンバス上のすべては、設定したとおりに保たれます。
- <!--i:font--> **Large text** - アプリの文字を大きくします: ラベル、メニュー、ボタンのテキストです。コントロール自体のサイズは変わらず、中の文字だけが大きくなります。デザイン内の文字は影響を受けないため、エクスポートしたものが再フローすることはありません。

これらはプロフィールレコード自体に保持されるため、プロフィールのエクスポートに付随して、次のインストール先でも氏名やセッションと一緒に反映されます。(端末は、最初の描画より前に設定が適用されるように小さなローカルミラーも保持していますが、このミラーは端末限定であり、持ち運ばれません。)

## あなたのLollyインスタンス

**Profile → Lolly instance**は、このインストールがツールとカタログをどこから取得しているかを示します - インスタンスのアドレス、またはすべてがビルドに同梱されている場合は*Bundled with this app*です。デプロイがそれを提供している場合、**Instance console**リンクからその管理画面を開くことができ、**Change**/**Disconnect**でインストール先の再指定や接続の解除ができます。

別のインスタンスへの再指定には**デスクトップアプリ**が必要です。ブラウザはページがオリジンをまたいでツールやアセットを読み込むことをブロックするため、Web版ではこのセクションは現在の状態を報告するだけにとどまります。

## オフラインで利用可能

Lollyは利用しながらキャッシュを蓄積していきますが、この「使いながらキャッシュ」方式がカバーするのは、すでに訪れた場所だけです。**Profile → Available offline**は、あらかじめ見えている旅のためのものです - 接続のないフライトの前、空港Wi-Fiでの1時間などです。必要な部分をダウンロードし、1本の進捗バーを見守れば、持ち出したものはすべて接続が切れても動き続けます。

7つの構成要素があり、それぞれ実行前にサイズが表示されます:

- <!--i:layout--> **The app** - まだ開いたことのないものも含め、すべてのビュー、エディタ、フォントです。これがなければ、オンラインで一度も訪れたことのない画面はオフラインで読み込めません。
- <!--i:image--> **Catalogue** - 必須のもの以外のブランドアセットです。すべて取得することも、*Choose by tag*を開いて使用するタグだけを取得することもできます。
- <!--i:book--> **Guides & docs** - あなたの言語による、このドキュメントサイトです。スクリーンショットも含みます。
- <!--i:cpu--> **Speech voices** - Scriptの音声やナレーションを支える音声モデルです。一度ダウンロードすれば、その後はオンデバイスで動作します。
- <!--i:zap--> **Upscaling models** - AI画像アップスケーラーです: 写真、イラスト/アニメ、顔。
- <!--i:layers--> **Background removal** - *Remove background*を支えるオンデバイスの切り抜きモデルです。
- <!--i:shield--> **Verify deep scan** - 接続から離れた場所でContent Credentialsを確認するための、オンデバイスの透かしスキャナーです。

最後の4つには**大容量ダウンロード**の印が付いており、意図的に個別のオプトインになっています。一番上の**すべてをダウンロード**は、アプリ、選択したカタログの範囲、ドキュメント、すべてのツールを一度に取得するだけで、それ以外は含みません。音声合成、アップスケーラー、背景除去、ディープスキャンはそれぞれ、その行を名指しでリクエストしたときにのみダウンロードされます - 数百メガバイトが1つのボタンの中に隠れているのは誠実ではないからです。

各部分の下にはツールごとのリストがあります。各ツールは個別にダウンロードできます(チェックマークはオフラインで使用可能を意味します)。または**すべてダウンロード**でまとめて取得できます。ダウンロードは再開可能です - キャンセルしたり接続が切れたりしても、次回の実行では中断した箇所から再開し、不足分だけを取得します - また、オンラインに戻ると自動的に更新され、新しいリリースで変更された部分だけを取得します。

ブラウザが永続ストレージを許可していない場合、このセクションはその旨を表示し、それを要求する**ダウンロードを保護**を提示します - 「ダウンロード済み」と「ブラウザが容量を必要とするまでダウンロード済み」の違いです。

## プロフィールを新しいデバイスへ移行する

![The two buttons that move a whole install: Export my data writes one zip, Import data reads it back](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

プロフィールは完全にローカルなものであるため、まっさらなインストール——新しいノートPC、リセットしたばかりのブラウザ、同僚のマシン、オフラインの端末——にそれを持ち込む唯一の方法は、**ファイルを運ぶこと**です。ログインによって復元されることはありません。それこそが重要な点であり、そもそもあなたのデバイスから何かが外に出たことは一度もないのです。

- <!--i:download--> **Export my data**は`LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`という1つのファイルをダウンロードします - 属するプロファイルにちなんで命名され、繰り返しエクスポートが衝突しないよう1日ごとの連番が付きます(プロファイルに該当する名前部分がない場合は省略されます)。これにはプロファイル、保存済みのすべてのセッション(サムネイル付き)、アップロードした画像が含まれます - ブランドトークンとインストール済みフォントはユーザーアセットとして一緒に含まれます - そして設定(テーマ、レイアウト、ローカルの利用統計)も含まれます。
- <!--i:upload--> 別のインストール先の**Import data…**でそのファイルを読み込むと、中断した箇所からそのまま再開できます。
- <!--i:box--> **Export my data & render everything**は同じバックアップに*加えて*、保存済みのすべてのセッションを完成した出力ファイルにレンダリングした2つ目のzipを、Projectsの構成を反映したフォルダー内に書き出します。ソースと結果の両方を含む完全なオフラインアーカイブです - セッション数が多いと大きく、時間がかかることがあります。

![インストール全体を移動する2つのボタン: Export my dataは1つのzipを書き出し、Import dataはそれを読み込みます](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

バンドルはそれ自体で完結した通常のzipファイルなので、USB、AirDrop、ネットワーク共有、自分宛のメールなど**あらゆる**手段で運ぶことができ、移行先は完全にオフラインでも構いません。各パートにはチェックサムが付いているため、転送中に破損したファイルは、中途半端に壊れた状態で復元されるのではなく、インポート時に検出されます。インポートは**マージ**方式（同名のプロフィール／セッション／画像は上書きされ、それ以外はそのまま保持）なので、すでに使用中の移行先を消去してしまうことはありません。

移行されないもの：カタログのキャッシュ（新しいデバイス上で自動的に再ダウンロードされます）と、ツール本体（すでに存在している前提です）。

正確なバンドル構成、バージョンポリシー、整合性ルールについては**[Data Transfer](/info/data-transfer.html)**を、エンドツーエンドの手順については**[Using Lolly → Moving to another device](/info/using.html#moving-to-another-device)**を参照してください。

## ツールがプロフィールをどう使うか

![The single Use my details switch, sitting beside Save Profile and off until you turn it on](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

ツールは、明示的に紐づけるよう作られたプロフィールのフィールドを*事前入力*するだけです。

**オプトイン(来歴情報)。** アセットをエクスポートすると、あなたの詳細情報は任意で**来歴情報(provenance)**として一緒に含まれます - ファイルのメタデータ(PNG、PDF、SVGなど)に埋め込まれる作者/クレジット行です - これにより、完成したアセットは誰が作ったかを示せます。*これ*こそが**Use my details to create**が制御する対象です。オフにしたままでも、エクスポートには「Made with Lolly」というツール/プラットフォームの帰属表示は引き続き含まれますが、個人の作者/連絡先情報は埋め込まれません。(同じオプトインが**/pro**の一括処理での作者も設定します。)(ツール作者向け: [Authoring Tools → `bindToProfile`](/info/authoring-tools.html#bindtoprofile)および[Host API → `host.profile`](/info/host-api.html#host-profile)を参照してください。)

![Save Profileの横にある単一のUse my details to createスイッチ。オンにするまではオフのままです](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## プロフィール・プラットフォーム・機能の違い

この3つはUI上で近くに配置されており、混同しやすいものです。

- <!--i:people--> **Profile** - *あなた*(またはあなたのチーム、あるいはあなたの役割): 名前、連絡先、顔写真、保存した作業内容。個人的で、デバイスローカルで、バンドルとして持ち運べます。
- <!--i:palette--> **Platform** - *ブランド*: すべてのツールがレンダリングの基準とする色、フォント、グローバル設定。共有され一貫していて、個人的なものではありません。
- <!--i:sliders--> **Capabilities** - *アプリができること*: 利用可能な機能一式とツール。

プロフィールはアセットが*誰から*のものかを変え、プラットフォームはそれが*どう見えるか*を変え、機能は*何を作れるか*を決めます。

### 「プロフィール」という言葉には他に2つの意味があります——このページのものとは別

このプロジェクト全体で、この言葉は意味が重なり合って使われています。以下のどちらも、このページで扱っている個人のプロフィールとは異なります。

- <!--i:box--> **Content profile** - `profiles.json`内のビルド時設定で、一連のツールパックをブランドカタログ(`suse`、`lolly-start`など)に結び付けます。これは運用者がデプロイ時に選択するもので、`profile` **URL/CLIパラメータ**もエクスポート時に選択する*色*バリアント(ICC/CMYKの印刷条件 - [URL Mode](/info/url-mode.html)を参照)を指すものでもあります。どちらも*ビルド/出力*に関するものであり、*あなた*に関するものではありません。[Configuration](/info/configuration.html)を参照してください。
- <!--i:seal--> **Identity profile** - 登録できる任意の**検証済みContent Credentials ID**(あなたのメールアドレスと署名済みエクスポートを結び付ける短命の証明書)です。これは署名用のIDであり、個人プロファイルの名前/連絡先フィールドとは別のものですが、どちらが埋め込まれるかは**Use my details to create**が制御します。[Content Credentials Identity](/info/content-credentials-identity.html)を参照してください。

![電話幅のVerified identityカード: 証明書の有効期間を選ぶピッカーとその下の登録ステップ - 個人情報とは別のidentity profile](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## プライバシー

上記の任意の身元登録(登録に使ったメールアドレスを証明書サービスに送信します - [Server Surface](/info/server-surface.html)を参照)を除けば、プロファイルが送信、アップロード、またはあなたを識別・追跡する目的で使用されることは一切ありません - 同意すべきことは何もなく、何が保持されているかを知らせるこの通知があるだけです。**Profile → Clear all my data**でいつでもすべてを消去できます。[Privacy Policy](/info/privacy.html)を参照してください。
