# プロフィール

名前、連絡先、顔写真を一度設定すると、それらを使うように作られたすべてのツールに自動入力されます。メール署名、名札、登壇者カードなどです。この記録があなたの**プロフィール**で、お使いのデバイス上に保存されます。

プロフィールには、保存したセッション、アップロードした画像、ローカルのアクティビティ集計も含まれます。**Settings → Preferences**で管理します。ツールが読み取るのは、事前入力に使うように作られたフィールドだけです。単独での利用にアカウントは不要です。任意の同期、共有、組織のサービスには、それぞれ独自のデータの流れがあります。

<!--i:eti-user-check-->
## プロフィールに含まれるもの

| 項目 | 内容 |
|---|---|
| **Name** | 名と姓です。 |
| **Contact** | メールアドレスと電話番号です。 |
| **Location** | 都市と国です。 |
| **Headshot** | 任意の写真です。正方形に切り抜いてローカルの画像として保持し、メール署名、引用カード、組織図などのツールで使います。 |
| **Use my details to create** | 明示的にオンにするスイッチで、オンにすると**Using my details**と表示されます。書き出したファイルやLolly Batchの実行に、作者クレジットとして自分の情報を含めるかどうかを決めます。[ツールによるプロフィールの使い方](#how-tools-use-your-profile)をご覧ください。 |
| **Preferences** | テーマ、デザインシステムごとのカラーウェイ、アクセシビリティ設定、**Feature flags**でオンにしたアプリの機能です。 |
| **Your work** | [Lolly Projects](/info/find-your-work.html)で整理された、サムネイル付きの保存済みセッション、アップロードした画像、ローカルのアクティビティ統計です。 |

どれも必須ではなく、空のプロフィールでも動作します。

![SettingsのPreferencesタブ: 設定レールと、Use my details to createスイッチ、名前、連絡先、所在地のフィールドを備えたYour details](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

[Lollyの設定](/info/dashboard.html)では、外観や絵文字からストレージやオフライン用のダウンロードまで、Preferencesのその他の項目を扱っています。

<!--i:eti-users-->
## 自分、チーム、役割

Lollyのプロフィールは、何かを作るときの立場を表します。自分自身、チーム、または役割です。Lollyは、3つとも同じ方法で扱います。

::: cols
## 自分として

既定の使い方です。自分の名前、メールアドレス、顔写真を設定します。署名、名札、カンファレンスのロックアップに、それらが自動入力されます。

## チームとして

チーム共通の名前、`events@…`などの共有メールアドレス、部署、チームのマークを設定します。1人がプロフィールを設定し、ファイルを書き出します。ほかの全員が同じプロフィールを読み込むことで、チームのファイルに同じ情報が入ります。共用のキオスク端末やデモ用のノートパソコンで、1つのチームプロフィールを使えます。

## 役割として

イベント担当者は、年に3日間だけ、名札や案内表示にイベント用のメールアドレスとサブブランドを使い、その後は通常の情報に戻したい場合があります。その役割をプロフィールファイルとして保存しておき、イベントの際に読み込んで、終わったら使わずに保管します。
:::

![顔写真のコントロール。写真をアップロードするまでは空で、アップロードした写真はこのデバイス上に保存されます](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

::: details Lolly Workを使う組織のプロフィール
ユーザーが[組織のLolly](/info/organisation.html)にサインインすると、Lolly WorkはIDプロバイダーから検証済みのプロフィールフィールドを提供し、組織のポリシーに従ってフィールドや設定を固定できます。管理されているフィールドには、アプリ内でラベルが表示されます。

そのサインインは、共有プロジェクトやアセットへのアクセスも管理します。チームのプロフィールファイルは、ローカルのファイルです。組織のメンバー資格を付与するものでも、仕事用のアカウントに代わるものでもありません。**Use my details to create**は、書き出しのクレジットを管理するもので、組織のサインインや監査記録には関係しません。[プライバシー](/info/privacy.html#organisation-services-with-lolly-work)をご覧ください。
:::

<!--i:eti-copy-->
## 複数を保持し、1つを使う

1つのインストール環境で同時に有効にできるプロフィールは1つで、アプリ内に切り替え機能はありません。各プロフィールは持ち運べるファイルで、作品を新しいデバイスに移すバックアップファイルと同じものです。用途を切り替えるには、次の手順を行います。

::: timeline
- <!--i:download--> **Settings → Storage → Move to another device**の**Export my data**で、現在のプロフィールを1つの`.zip`として保存します。
- <!--i:trash--> **Clear all my data**で、このインストール環境を空にします。
- <!--i:upload--> **Import data…**で、切り替え先の用途に対応するプロフィールファイルを読み込みます。
:::

::: note 先に消去せずインポートするとマージされます
インポートしたセッションと画像は追加されます。両方に同じものがある場合は、より新しく保存された方が残ります。フォルダ、お気に入り、テンプレートは、既存のものと並べて追加されます。自分の情報はそのまま残り、空のフィールドだけにファイルの値が入ります。マージは、チームのセッションを自分の環境に取り込む用途に適していますが、役割を完全に切り替える用途には適していません。
:::

2つの用途を同時に使うには、別のブラウザプロファイル、ユーザーアカウント、または別にインストールしたWebアプリを使います。それぞれに独自のLollyプロフィールがあります。

![インストール環境全体を移す2つのボタン: Export my dataが1つのzipを書き出し、Import dataが読み戻します](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note 用途ごとに1つのファイルを保持する
`LollyTools-events-2026.zip`や`LollyTools-me.zip`など、内容が分かる名前を各ファイルに付けます。そのファイルがプロフィールです。
:::

[作品を別のデバイスに移す](/info/find-your-work.html#move-your-work-to-another-device)では、ファイルに含まれるもの、元の場所に残るもの、同期を含むその他の移行方法を扱っています。

<!--i:eti-pen-->
## ツールによるプロフィールの使い方

**事前入力。** ツールの作者は、プロフィールから値を取得する入力に指定を付けます(`bindToProfile: "firstname"`、`"email"`、`"headshot"`など)。ツールを開くと、その入力がプロフィールから埋められます。組織のポリシーで入力がロックされていなければ、プロフィールを変えずに、そのセッションだけ値を変更できます。事前入力はローカルで行われ、**Use my details**がオンかどうかに関係なく動作します。

**クレジット。** 書き出す際、ファイルのメタデータ(PNG、PDF、SVGなど)に、作者クレジットとして自分の情報を含められます。**Use my details to create**は、このクレジットとLolly Batchの実行時の作者を管理します。スイッチがオフでも、書き出したファイルにはLollyで作成したことが記載されますが、個人の作者名や連絡先の行は含まれません。

ツールの作者は、[`bindToProfile`](/info/tool-inputs.html#bindtoprofile)と[`host.profile`](/info/host-api.html#host-profile)をご覧ください。

![Use my details to createの単独のスイッチ。明示的に有効にする設定と表示され、自分でオンにするまではオフです](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

<!--i:eti-layers-->
## プロフィール、デザインシステム、機能

Settingsには、近くに並んでいて混同しやすい3つの項目があります。

- <!--i:people--> **Profile** - 自分、チーム、または今の役割です。名前、連絡先、顔写真、保存した作品を含みます。個人用で、デバイス上に保存され、ファイルとして持ち運べます。
- <!--i:palette--> **Design system** - ブランドです。すべてのツールがレンダリングに使う色、フォント、設定を含みます。個人用ではなく共有するものです。[Lolly Design System Setup](/info/brand-studio.html)をご覧ください。
- <!--i:sliders--> **Capabilities** - アプリでできることです。利用できる機能とツールを示します。

Lollyでは、この語にほかにも3つの意味があります。**コンテンツプロファイル**は、デプロイに含めるツールとカタログを選ぶビルド設定です。[用語集](/info/glossary.html)に定義があります。リンクの`profile`パラメーターは、CMYKの印刷条件など、書き出し用のカラープロファイルを選びます。[予約済みURLパラメーター](/info/url-parameters.html#print)をご覧ください。**検証済みID**は、メールアドレスと署名付きの書き出しを結び付ける、任意の署名証明書です。ここでの個人情報とは別のものですが、どちらについても、埋め込むかどうかは**Use my details to create**で決まります。[Content Credentials](/info/content-credentials-identity.html)をご覧ください。

![スマートフォン幅のVerified identityカード: 証明書の有効期間ピッカーと、その下の登録手順。個人情報とは別のIDプロフィールです](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

<!--i:eti-lock-->
## プライバシー

個人のプロフィールはローカルに保存されます。個人情報は、バックアップや同期のコピー、共有または書き出したコンテンツ、任意のContent Credentials登録の際に送られることがあります。Lolly Workインスタンスでは、サインイン、共有作業、テレメトリーのポリシー、監査記録は、このローカルのプロフィールとは別のものです。**Settings → Preferences → Clear all my data**は、このデバイスのデータを消去します。ストレージプロバイダーや組織が保持するコピーは消去しません。[プライバシーポリシー](/info/privacy.html)をご覧ください。
