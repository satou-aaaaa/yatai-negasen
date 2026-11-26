// アプリのアイコン（icon-192.png・icon-512.png）を作る。紺の地に、屋台ののれんと団子。
// 使い方: node tools/make-icons.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const s of [192, 512]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#123554"/>
      <rect x="14" y="18" width="72" height="14" fill="#b23a24"/><g fill="#123554"><rect x="30" y="18" width="3" height="14"/><rect x="48.5" y="18" width="3" height="14"/><rect x="67" y="18" width="3" height="14"/></g>
      <path d="M50 38 V88" stroke="#c9a46a" stroke-width="4"/><circle cx="50" cy="44" r="10" fill="#f6b6c8"/><circle cx="50" cy="63" r="10" fill="#fffdf7"/><circle cx="50" cy="82" r="10" fill="#8cc56f"/></svg></body>`);
    await p.screenshot({ path: path.join(__dirname, "..", `icon-${s}.png`), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await b.close();
})();
