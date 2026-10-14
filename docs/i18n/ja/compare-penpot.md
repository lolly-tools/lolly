# Lolly と Penpot

_最終確認日: 2026年9月28日。_

Lolly と Penpot はどちらも、オープンソースのデザインツール、共有デザイントークン、リアルタイムコラボレーションを提供します。Lolly は、デバイス上での制作と、別個にデプロイされる組織向けサービスである [lolly.work](https://lolly.work) を組み合わせています。

## 共通のデザイン基盤

[Penpot のデザイントークン](https://help.penpot.app/user-guide/design-systems/design-tokens/)は DTCG フォーマットを使用しており、Lolly もこれを読み取ります。カラー、タイプ、その他のトークン値は、2つのワークフロー間で共有できます。Lolly の[デザインのインポート](/info/design-import.html)は、`.penpot` エクスポートを編集可能なレイアウトとして開きます。

Penpot 用の Lolly Export プラグインは Lolly が保守しています。Lolly のエンジンを使用して、デバイス上でオプトイン方式の C2PA Content Credentials を提供します。署名の完全性と署名者への信頼は別のものです。[Content Credentials の ID](/info/content-credentials-identity.html)で説明しているとおり、検証者は自らが信頼する ID を必要とします。

## デザインとチームのワークフロー

[Penpot](https://penpot.app/) は、インターフェースデザイン、コンポーネント、柔軟なレイアウト、インタラクティブなプロトタイプ、開発者向けインスペクトを提供します。ホスト型とセルフホスト型のデプロイがあり、[Docker と Kubernetes によるインストールオプション](https://help.penpot.app/technical-guide/getting-started/)が用意されています。

Lolly のデザインキャンバスは編集可能なアセットを作成し、レイアウトを[ルール付きのツール](/info/create-a-tool.html)に変えることができます。同じツールがブラウザ、デスクトップアプリ、CLI でレンダリングされ、データからバリエーションを生成できます。チームワークについては、Lolly には、2台のデバイスを直接接続する[プライベート collab](/info/collaborate.html)と、lolly.work を介した work collab があり、共有編集、カーソル、保存されたチームセッションを備えています。

## デプロイの違い

単体の Lolly は、アカウントもサーバーもなしに、デバイス上でレンダリングと署名を行います。lolly.work は、SSO、SCIM プロビジョニング、共有カタログとプロジェクト、ロール、承認、監査記録、サーバーレンダリングを追加します。どちらのリポジトリも MPL-2.0 のオープンソースであり、組織が運用できます。共有された作業は設定済みのインスタンスを使用し、ローカルでの制作は独立して引き続き利用できます。

選択は作業内容によって決まります。Penpot のインターフェースデザインとプロトタイピングのワークフロー、Lolly の繰り返し可能なアセット制作、または共有トークンとインポートしたデザインを使った組み合わせです。Lolly の work コラボレーションは現在、単一のサーバーノードで動作しており、その[デプロイステータス](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md)は、組織の評価に含めるべきです。

Penpot はその所有者の商標です。上記のプラグインは Lolly のものです。より広い比較については、[Lolly の比較](/info/positioning.html)と[統合ソリューションの概要](/info/compare.html)を参照してください。
