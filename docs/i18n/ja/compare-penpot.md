# LollyとPenpot

_最終確認日: 2026年9月28日。_

チームがPenpotでデザインしている場合、LollyはPenpotと併用できます。どちらもオープンソースで、同じデザイントークンを読み取ります。このページでは、それぞれがどの作業に向いているかを説明します。

<!--i:eti-award-->
## Penpotが優れている点

[Penpot](https://penpot.app/)は、インターフェースのデザイン、コンポーネント、柔軟なレイアウト、操作可能なプロトタイプ、開発者向けの検査機能に加え、リアルタイム編集とライブカーソルを提供します。ホスティング型とセルフホストの両方で利用でき、[DockerとKubernetesによるインストール方法](https://help.penpot.app/technical-guide/getting-started/)があります。アプリケーションを設計するなら、Penpotが適したツールです。

<!--i:eti-blend-->
## 共通する範囲

[Penpotのデザイントークン](https://help.penpot.app/user-guide/design-systems/design-tokens/)は、Lollyも読み取るDTCG形式を使っているため、色、書体、その他のトークン値を両者の間で移せます。Lollyの[デザインのインポート](/info/design-import.html)は、書き出された`.penpot`を編集可能なレイアウトとして開き、Lollyの**Send to Penpot**は、デザインを`.penpot`アーカイブとして送り返します。Lollyは[Penpot向けのLolly Exportプラグイン](https://github.com/lolly-tools/lolly-plugins-penpot-export)も保守しています。このプラグインは、Lollyのエンジンを使い、選択した場合にデバイス上でContent Credentialsを追加します。

<!--i:eti-lolly-->
## 共通する作業をLollyで行う方法

Lolly Designのキャンバスは、編集可能なアセットを作り、レイアウトを[ルール付きツール](/info/create-a-tool.html)に変えられます。同じツールが、ブラウザ、デスクトップアプリ、CLIでレンダリングし、データからバリエーションを作ります。単独で使うLollyは、アカウントやサーバーなしで、デバイス上でレンダリングと署名を行います。[プライベートコラボ](/info/collaborate.html)は、2台のデバイスを直接つなぎます。

<!--i:eti-building-->
## 組織で使う場合

Lolly Workは、シングルサインオン、SCIMプロビジョニング、共有カタログとプロジェクト、ロール、承認、監査記録、Workのコラボ、サーバーレンダリングを追加します。両方のリポジトリはMPL-2.0で、組織は両方を運用できます。[何がどこで動くか](/info/compare.html#what-runs-where)では、この2つの部分を並べて示しています。

両方を使えます。インターフェースのデザインとプロトタイプ作成にはPenpot、繰り返し作るファイルにはLollyです。

Penpotはその所有者の商標です。このページは両製品で共通する範囲を説明するものであり、Penpotとは提携していません。
