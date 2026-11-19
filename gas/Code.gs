/**
 * もみじ台 いいな投票 集計スクリプト（Google Apps Script）
 * スプレッドシートの「拡張機能 > Apps Script」に貼り付けて使います。手順は README.md を参照。
 */
const IMAGES = [
  ["a1", "A班", "火を囲めるイベント広場"],
  ["a2", "A班", "見通しの良い多世代の図書館"],
  ["a3", "A班", "防災機能のある広場"],
  ["a4", "A班", "みんなで花を育てる沿道"],
  ["m1", "むじゃき班", "子どもを見守りながら働けるシェアオフィス"],
  ["m2", "むじゃき班", "ギャルSNSスクール"],
  ["m3", "むじゃき班", "SNS＆ギャル教室とジーバー食堂"],
  ["m4", "むじゃき班", "若い世代がシニアに教える学びの場"],
  ["m5", "むじゃき班", "推しじいばあステージ"],
  ["m6", "むじゃき班", "夜は「大人の社交場」"],
  ["m7", "むじゃき班", "趣味を共有できる場"],
  ["m8", "むじゃき班", "学びと成長のタウンセンター（むじゃき案）"],
];
const HEAD = ["受信日時", "投票ID", "端末", "端末時刻", "いいな1", "いいな2", "いいな3", "年代", "性別", "お住まい", "WS参加", "ひとこと"];
const AGES = ["10代未満", "10代", "20〜30代", "40〜50代", "60〜70代", "80代以上", ""];
const GENDERS = ["男性", "女性", "その他", "答えない", ""];
const HOMES = ["もみじ台", "もみじ台以外の厚別区", "それ以外", ""];

/** 最初に1回だけ実行：シートと見出しを作ります */
function setup() {
  const ss = SpreadsheetApp.getActive();
  const v = ss.getSheetByName("votes") || ss.insertSheet("votes");
  if (v.getLastRow() === 0) { v.appendRow(HEAD); v.setFrozenRows(1); }
  const im = ss.getSheetByName("images") || ss.insertSheet("images");
  im.clear(); im.getRange(1, 1, 1, 3).setValues([["ID", "班", "タイトル"]]);
  im.getRange(2, 1, IMAGES.length, 3).setValues(IMAGES);
  if (!ss.getSheetByName("集計")) ss.insertSheet("集計");
  updateSummary_();
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    const ids = new Set(IMAGES.map(r => r[0]));
    const choices = (d.choices || []).filter(c => ids.has(c)).slice(0, 3);
    if (!d.voteId || !choices.length) return json_({ ok: false, error: "bad request" });
    const sh = SpreadsheetApp.getActive().getSheetByName("votes");
    // 再送による二重登録を防ぐ
    if (sh.getLastRow() > 1 && sh.getRange(2, 2, sh.getLastRow() - 1, 1).createTextFinder(d.voteId).matchEntireCell(true).findNext()) {
      return json_({ ok: true, dup: true });
    }
    const clean = s => String(s || "").slice(0, 80).replace(/^[=+\-@]/, "'$&");
    sh.appendRow([new Date(), d.voteId, clean(d.deviceId), clean(d.clientTime), choices[0] || "", choices[1] || "", choices[2] || "",
      clean(d.age), clean(d.gender), clean(d.home), clean(d.ws), clean(d.comment)]);
    updateSummary_();
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally { lock.releaseLock(); }
}

function doGet(e) {
  const rows = readVotes_();
  const counts = {}, resident = {}, age = {}, home = {}, ws = {}, comments = [];
  rows.forEach(r => {
    r.choices.forEach(c => { counts[c] = (counts[c] || 0) + 1; if (r.home === "もみじ台") resident[c] = (resident[c] || 0) + 1; });
    age[r.age] = (age[r.age] || 0) + 1; home[r.home] = (home[r.home] || 0) + 1; ws[r.ws] = (ws[r.ws] || 0) + 1;
    if (r.comment) comments.unshift(r.comment);
  });
  const out = { ok: true, total: rows.length, counts };
  if (e && e.parameter && e.parameter.detail) Object.assign(out, { resident, age, home, ws, comments: comments.slice(0, 50) });
  return json_(out);
}

function readVotes_() {
  const sh = SpreadsheetApp.getActive().getSheetByName("votes");
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, HEAD.length).getValues().map(r => ({
    choices: [r[4], r[5], r[6]].filter(Boolean), age: r[7], gender: r[8], home: r[9], ws: r[10], comment: r[11],
  }));
}

/** 「集計」シートを作り直します（投票ごとに自動実行。手動実行も可） */
function updateSummary_() {
  const ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName("集計") || ss.insertSheet("集計");
  const rows = readVotes_();
  const cols = [["合計", () => true]]
    .concat(AGES.map(a => ["年代:" + (a || "無回答"), r => r.age === a]))
    .concat(GENDERS.map(g => ["性別:" + (g || "無回答"), r => r.gender === g]))
    .concat(HOMES.map(h => ["住:" + (h || "無回答"), r => r.home === h]))
    .concat([["WS参加", r => r.ws === "参加した"]]);
  const body = IMAGES.map(img => {
    const hit = rows.filter(r => r.choices.indexOf(img[0]) >= 0);
    return img.concat(cols.map(c => hit.filter(c[1]).length));
  }).sort((a, b) => b[3] - a[3]);
  const table = [["ID", "班", "タイトル"].concat(cols.map(c => c[0]))].concat(body);
  sh.clear();
  sh.getRange(1, 1, 1, 2).setValues([["投票者数", rows.length]]);
  sh.getRange(3, 1, table.length, table[0].length).setValues(table);
  sh.getRange(3, 1, 1, table[0].length).setFontWeight("bold");
  sh.setFrozenRows(3);
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
