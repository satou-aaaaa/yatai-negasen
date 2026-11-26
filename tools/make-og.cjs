// SNS で貼られたときの絵（og.png 1200×630）を作る。今日の相手（答え）は入れず、遊び方の例だけ（そのままか、値下げか）。
// 使い方: node tools/make-og.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const cell = (t, c) => `<div style="width:62px;height:62px;border-radius:10px;display:grid;place-items:center;font-size:30px;font-weight:900;${c === "k" ? "background:#e4eef8;color:#123554;border:3px solid #1d2a3f33" : "background:#fbe3dc;color:#83261a;border:3px dashed #b23a24"}">${t}</div>`;
  const row = (l, a) => `<div style="display:flex;gap:8px;align-items:center"><div style="width:110px;font-size:26px;color:#4c5568">${l}</div>${a.map((x) => cell(x === "K" ? "そ" : "値", x === "K" ? "k" : "c")).join("")}</div>`;
  await p.setContent(`<body style="margin:0;font-family:'Noto Sans CJK JP','IPAPGothic',sans-serif">
  <div style="width:1200px;height:630px;box-sizing:border-box;padding:48px 64px;background:#f3efe4;color:#1d2a3f;display:flex;gap:40px;align-items:center">
    <div style="flex:0 0 460px">
      <div style="font-size:30px;color:#83261a;letter-spacing:.06em">囚人のジレンマで遊ぶ</div>
      <div style="font-size:84px;font-weight:900;margin-top:8px;line-height:1.15;color:#123554">屋台の<br><span style="color:#b23a24">値下げ合戦</span></div>
      <div style="font-size:34px;margin-top:14px">となりの屋台は、<br>どんな性格？</div>
    </div>
    <div style="flex:1;background:#fffdf7;border:4px solid #1d2a3f;border-radius:8px;padding:26px 22px;display:flex;flex-direction:column;gap:16px">
      <div style="font-size:30px;font-weight:700">🏮 10日間のかけひき</div>
      ${row("あなた", ["K", "K", "C", "K", "K"])}
      ${row("相手", ["K", "K", "K", "C", "K"])}
      <div style="font-size:28px;color:#4c5568">そのままか、値下げか。</div>
    </div>
  </div></body>`);
  await p.screenshot({ path: path.join(__dirname, "..", "og.png") });
  await b.close();
})();
