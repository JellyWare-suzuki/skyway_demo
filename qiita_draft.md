# SkyWay SDKがCDNから読み込めない問題をローカル配置で解決した話

## はじめに

SkyWayを使ったビデオ通話Webアプリを開発中に、SDKが読み込まれず動作しない問題に遭遇しました。
本記事ではその原因調査から解決までの流れを記録します。

---

## 発生した問題

ブラウザのコンソールに以下のようなエラーが表示され、映像の取得・ルーム参加が一切できない状態になりました。

```
Uncaught TypeError: Cannot read properties of undefined (reading 'SkyWayRoom')
```

あるいは、`globalThis.skyway_room` が `undefined` のまま処理が進んでいました。

---

## 原因

当初の `index.html` では、SkyWay SDKをCDNから読み込んでいました。

```html
<!-- 問題のあった記述 -->
<script src="https://cdn.skyway.ntt.com/skyway-core@latest/dist/skyway_core.js"></script>
<script src="https://cdn.skyway.ntt.com/skyway-room@latest/dist/skyway_room.js"></script>
```

このCDNのURLが**存在しない**、または**ネットワーク的にアクセスできない**状態でした。

`<script src="...">` タグはスクリプトの読み込みに失敗しても、後続の処理がそのまま走ります。
そのため `globalThis.skyway_room` は `undefined` のまま、SDKを使おうとした箇所でエラーが発生していました。

---

## 対応手順

### 1. npm pack でSDKの配布物を取得する

npmのパッケージには `dist/` 以下にビルド済みのJSファイルが含まれています。
`npm pack` を使うと、インストールせずにパッケージの中身をtgz形式で取り出せます。

```bash
# 作業ディレクトリで実行
npm pack @skyway-sdk/core
npm pack @skyway-sdk/room
```

実行後、以下のようなファイルが生成されます。

```
skyway-sdk-core-1.15.2.tgz
skyway-sdk-room-1.15.2.tgz
```

### 2. tgzを展開してdistファイルを取り出す

```bash
tar -xzf skyway-sdk-core-1.15.2.tgz
tar -xzf skyway-sdk-room-1.15.2.tgz
```

展開すると `package/dist/` 以下に以下のようなファイルが現れます。

```
package/dist/skyway_core.js   (UMD形式)
package/dist/skyway_room.js   (UMD形式)
```

### 3. libsディレクトリに配置する

プロジェクトの静的ファイル置き場に `libs/` フォルダを作り、コピーします。

```
skyway-prototype/
  libs/
    skyway_core-1.15.2.js   ← コピーしたファイル
    skyway_room-1.15.2.js   ← コピーしたファイル
  index.html
  script.js
  style.css
```

バージョンを明示したファイル名にしておくと、後からバージョンを上げた際に対応しやすくなります。

### 4. index.htmlの読み込み先をローカルに変更する

```html
<!-- 変更前（CDN） -->
<script src="https://cdn.skyway.ntt.com/skyway-core@latest/dist/skyway_core.js"></script>
<script src="https://cdn.skyway.ntt.com/skyway-room@latest/dist/skyway_room.js"></script>

<!-- 変更後（ローカル） -->
<script src="./libs/skyway_core-1.15.2.js"></script>
<script src="./libs/skyway_room-1.15.2.js"></script>
```

---

## 結果

ローカル配置に切り替えたところ、`globalThis.skyway_room` が正しく参照できるようになり、
ルーム参加・映像表示が正常に動作しました。

---

## まとめ

| 項目 | 内容 |
|------|------|
| 問題 | CDNのURLが無効でSDKが読み込まれなかった |
| 症状 | `globalThis.skyway_room` が `undefined` |
| 対処 | `npm pack` でSDKを取得しローカルに配置 |
| 効果 | CDNへの依存を排除し安定して動作 |

CDNを使う場合はURLの有効性・アクセス可否を事前に確認することが重要です。
開発・ハンズオン環境ではローカル配置の方が環境差異が出にくく安定します。

---

## 参考

- [SkyWay公式ドキュメント](https://skyway.ntt.com/ja/docs/)
- [@skyway-sdk/core - npm](https://www.npmjs.com/package/@skyway-sdk/core)
- [@skyway-sdk/room - npm](https://www.npmjs.com/package/@skyway-sdk/room)
