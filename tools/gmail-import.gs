/**
 * 就活ダッシュボード用：Gmail の就活メールと、Google カレンダーのこれからの予定を取り出して返す Google Apps Script
 *
 * 使い方は docs/gmail-import.md を見てください。
 * このスクリプトはあなたの Google アカウントの中で動き、あなたの Gmail と Google カレンダーを読みます。
 * 合言葉（KEY）を知っている人だけが結果を受け取れるようにしてあるので、KEY は他人に教えないでください。
 * 端末の引き継ぎ用に、アプリのデータを Google ドライブに1つのファイルとして保存・復元する機能もあります（バックアップ）。
 */

// ① アプリの「設定 → データ → Gmailから自動取り込み」で作った合言葉を、' ' の間に貼り付ける
const KEY = 'ここにアプリで作った合言葉を貼り付け';

// ② 探すメールの条件（Gmail の検索窓と同じ書き方）。使っていないサービスは消してもかまいません
const QUERY = 'from:(offerbox.jp OR mynavi.jp OR re-katsu.jp OR paiza.jp OR rikunabi.com OR wantedly.com) newer_than:30d';

// 一度に調べるスレッド（メールのまとまり）の数の上限
const MAX_THREADS = 50;

// 本文は長すぎると重くなるので、先頭からこの文字数だけ渡す
const MAX_BODY_LENGTH = 4000;

// Google カレンダー：一度に返す予定の数の上限と、予定のメモ（説明）を渡す最大の文字数
const MAX_CALENDAR_EVENTS = 300;
const MAX_DESCRIPTION_LENGTH = 600;

// バックアップ：Google ドライブ（マイドライブの直下）に作るファイルの名前と、保存できるデータの大きさの上限
const BACKUP_FILE_NAME = '就活ダッシュボード バックアップ.json';
const MAX_BACKUP_LENGTH = 4 * 1024 * 1024;

/**
 * アプリから呼ばれる入り口。合言葉が合っていれば、結果を JSON で返す
 *   ふつう：条件に合うメールの一覧
 *   type=calendar：Google カレンダーの、きょうから days 日先までの予定の一覧
 *   type=backup-load：Google ドライブに保存してあるバックアップ（無ければ backup が null）
 */
function doGet(e) {
  const params = (e && e.parameter) || {};
  if (!isAuthorized(params.key)) {
    return jsonResponse({ ok: false, error: 'unauthorized' });
  }

  if (params.type === 'backup-load') {
    return jsonResponse({ ok: true, backup: readBackup() });
  }

  if (params.type === 'calendar') {
    return jsonResponse({ ok: true, events: listCalendarEvents(Number(params.days) || 120) });
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

/**
 * アプリからデータを受け取る入り口（バックアップの保存）。合言葉が合っているときだけ受け付ける
 */
function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return jsonResponse({ ok: false, error: 'bad-request' });
  }
  if (!isAuthorized(body.key)) {
    return jsonResponse({ ok: false, error: 'unauthorized' });
  }
  if (body.action === 'backup-save') {
    return jsonResponse(saveBackup(body));
  }
  return jsonResponse({ ok: false, error: 'unknown-action' });
}

function isAuthorized(key) {
  return !!KEY && KEY.indexOf('ここに') !== 0 && key === KEY;
}

function findBackupFile() {
  const files = DriveApp.getFilesByName(BACKUP_FILE_NAME);
  return files.hasNext() ? files.next() : null;
}

// 保存してあるバックアップを { savedAt, data } で返す。無いときや読めないときは null
function readBackup() {
  const file = findBackupFile();
  if (!file) return null;
  try {
    return JSON.parse(file.getBlob().getDataAsString('UTF-8'));
  } catch (err) {
    return null;
  }
}

/**
 * バックアップを保存する。
 * 別の端末が先に保存していたとき（アプリが知っている日時と違うとき）は、上書きせずに conflict を返す。
 * force が true のときだけ、そのまま上書きする。
 */
function saveBackup(body) {
  const data = String(body.data || '');
  if (!data || data.length > MAX_BACKUP_LENGTH) {
    return { ok: false, error: 'invalid-data' };
  }
  const current = readBackup();
  if (current && !body.force && String(body.baseSavedAt || '') !== current.savedAt) {
    return { ok: false, error: 'conflict', savedAt: current.savedAt };
  }
  const savedAt = new Date().toISOString();
  const content = JSON.stringify({ savedAt: savedAt, data: data });
  const file = findBackupFile();
  if (file) {
    file.setContent(content);
  } else {
    DriveApp.createFile(BACKUP_FILE_NAME, content, MimeType.PLAIN_TEXT);
  }
  return { ok: true, savedAt: savedAt };
}

/**
 * Google カレンダー（ふだん使っているカレンダー）の、きょうから days 日先までの予定を返す。
 * 日付と時刻は、カレンダーに設定されているタイムゾーン（日本なら日本時間）で渡す。
 */
function listCalendarEvents(days) {
  const calendar = CalendarApp.getDefaultCalendar();
  const timeZone = calendar.getTimeZone();
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + Math.min(Math.max(days, 1), 365) * 24 * 60 * 60 * 1000);

  return calendar.getEvents(from, to).slice(0, MAX_CALENDAR_EVENTS).map(event => {
    const allDay = event.isAllDayEvent();
    const start = allDay ? event.getAllDayStartDate() : event.getStartTime();
    const end = allDay ? event.getAllDayStartDate() : event.getEndTime();
    return {
      id: event.getId(),
      title: event.getTitle(),
      date: Utilities.formatDate(start, timeZone, 'yyyy-MM-dd'),
      time: allDay ? '' : Utilities.formatDate(start, timeZone, 'HH:mm'),
      endTime: allDay ? '' : Utilities.formatDate(end, timeZone, 'HH:mm'),
      allDay: allDay,
      location: event.getLocation() || '',
      description: (event.getDescription() || '').slice(0, MAX_DESCRIPTION_LENGTH)
    };
  });
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

/**
 * カレンダーを読む許可（承認）を出すために、一度だけ実行する関数。
 * 実行すると、見つかった予定のタイトルが「実行ログ」に表示される。
 */
function testCalendar() {
  const events = listCalendarEvents(14);
  Logger.log('これから14日間の予定：' + events.length + '件');
  events.slice(0, 10).forEach(event => Logger.log(event.date + ' ' + event.time + ' ' + event.title));
}

/**
 * バックアップを使うために、一度だけ実行する関数。
 * Google ドライブに保存する許可（承認）を出すために使う。実行すると、バックアップの有無が「実行ログ」に表示される。
 */
function testBackup() {
  const file = findBackupFile();
  Logger.log(file ? 'バックアップがあります：' + file.getName() : 'バックアップはまだありません（許可の確認はできました）');
}
