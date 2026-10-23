/**
 * 就活ダッシュボード用：Gmail から就活サービスの通知メールを取り出して返す Google Apps Script
 *
 * 使い方は docs/gmail-import.md を見てください。
 * このスクリプトはあなたの Google アカウントの中で動き、あなたの Gmail を読みます。
 * 合言葉（KEY）を知っている人だけが結果を受け取れるようにしてあるので、KEY は他人に教えないでください。
 */

// ① アプリの「設定 → データ → Gmailから自動取り込み」で作った合言葉を、' ' の間に貼り付ける
const KEY = 'ここにアプリで作った合言葉を貼り付け';

// ② 探すメールの条件（Gmail の検索窓と同じ書き方）。使っていないサービスは消してもかまいません
const QUERY = 'from:(offerbox.jp OR mynavi.jp OR re-katsu.jp OR paiza.jp OR rikunabi.com OR wantedly.com) newer_than:30d';

// 一度に調べるスレッド（メールのまとまり）の数の上限
const MAX_THREADS = 50;

// 本文は長すぎると重くなるので、先頭からこの文字数だけ渡す
const MAX_BODY_LENGTH = 4000;

/**
 * アプリから呼ばれる入り口。合言葉が合っていれば、条件に合うメールの一覧を JSON で返す
 */
function doGet(e) {
  const params = (e && e.parameter) || {};
  if (!KEY || KEY.indexOf('ここに') === 0 || params.key !== KEY) {
    return jsonResponse({ ok: false, error: 'unauthorized' });
  }

  const messages = [];
  GmailApp.search(QUERY, 0, MAX_THREADS).forEach(thread => {
    const threadUrl = thread.getPermalink();
    thread.getMessages().forEach(message => {
      messages.push({
        id: message.getId(),
        threadUrl: threadUrl,
        date: message.getDate().toISOString(),
        from: message.getFrom(),
        subject: message.getSubject(),
        body: message.getPlainBody().slice(0, MAX_BODY_LENGTH)
      });
    });
  });

  return jsonResponse({ ok: true, messages: messages });
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 設定の途中で一度だけ実行する関数。
 * Gmail を読む許可（承認）を出すためと、条件に合うメールが見つかるかを確かめるために使う。
 * 実行すると、見つかったメールの件名が「実行ログ」に表示される。
 */
function testSearch() {
  const threads = GmailApp.search(QUERY, 0, 5);
  Logger.log('見つかったスレッド：' + threads.length + '件');
  threads.forEach(thread => Logger.log(thread.getFirstMessageSubject()));
}
