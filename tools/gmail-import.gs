/**
 * 就活ダッシュボード用：Gmail の就活メールと、Google カレンダーのこれからの予定を取り出して返す Google Apps Script
 *
 * 使い方は docs/gmail-import.md を見てください。
 * このスクリプトはあなたの Google アカウントの中で動き、あなたの Gmail と Google カレンダーを読みます。
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

// Google カレンダー：一度に返す予定の数の上限と、予定のメモ（説明）を渡す最大の文字数
const MAX_CALENDAR_EVENTS = 300;
const MAX_DESCRIPTION_LENGTH = 600;

/**
 * アプリから呼ばれる入り口。合言葉が合っていれば、結果を JSON で返す
 *   ふつう：条件に合うメールの一覧
 *   type=calendar：Google カレンダーの、きょうから days 日先までの予定の一覧
 */
function doGet(e) {
  const params = (e && e.parameter) || {};
  if (!KEY || KEY.indexOf('ここに') === 0 || params.key !== KEY) {
    return jsonResponse({ ok: false, error: 'unauthorized' });
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
