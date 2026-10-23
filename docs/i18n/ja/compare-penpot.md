# Lolly と Penpot

_最終確認日: 2026年9月28日。_

チームがPenpotでデザインしている場合、LollyはPenpotと並んで動作します。どちらもオープンソースで、同じデザイントークンを読みます。このページは、それぞれがどの作業向けかを示します。

## Penpotがより優れている点

[Penpot](https://penpot.app/)は、インターフェースデザイン、コンポーネント、柔軟なレイアウト、インタラクティブなプロトタイプ、開発者向けのインスペクションを、リアルタイム編集とライブカーソル付きで提供します。ホスト型とセルフホスト型の両方の配備があり、[DockerとKubernetesのインストールオプション](https://help.penpot.app/technical-guide/getting-started/)があります。アプリケーションをデザインするなら、Penpotがそのためのツールです。

## 重なる部分

[Penpotのデザイントークン](https://help.penpot.app/user-guide/design-systems/design-tokens/)はDTCG形式を使い、Lollyもこれを読むため、色、書体、その他のトークン値は両者の間を行き来できます。Lollyの[デザインを取り込む](/info/design-import.html)は`.penpot`のエクスポートを編集可能なレイアウトとして開き、Lollyの**Send to Penpot**は、デザインを`.penpot`アーカイブとして送り返します。Lollyは[Penpot向けのLolly Exportプラグイン](https://github.com/lolly-tools/lolly-plugins-penpot-export)も保守しており、これはLollyのエンジンを使って、デバイス上でオプトインのContent Credentialsを追加します。

## 重なる作業をLollyがどう行うか

LollyのDesignキャンバスは編集可能なアセットを作り、レイアウトを[ルール付きのツール](/info/create-a-tool.html)に変えることができます。同じツールが、ブラウザ、デスクトップアプリ、CLIでレンダリングし、データからバリエーションを作ります。単独のLollyは、アカウントもサーバーもなしで、デバイス上でレンダリングと署名を行います。[プライベートコラボ](/info/collaborate.html)は、2台のデバイスを直接つなぎます。

## 組織で使う場合

Lolly Workは、シングルサインオン、SCIMプロビジョニング、共有カタログとプロジェクト、ロール、承認、監査記録、ワークコラボ、サーバーレンダリングを加えます。どちらのリポジトリもMPL-2.0で、組織は両方を運用できます。この2つの部分の対比は、[どこで何が動くか](/info/compare.html#what-runs-where)にあります。

両方を使えます。インターフェースのデザインとプロトタイプにはPenpot、繰り返し作るファイルにはLollyを使い、共有トークンと取り込んだデザインでつなぎます。

Penpotは、その所有者の商標です。このページは2つの製品が重なる部分を説明するもので、Penpotとは提携していません。
