(() => {
  const C = window.VOTE_CONFIG, IMGS = window.IMAGES, TEAMS = window.TEAMS;
  const byId = Object.fromEntries(IMGS.map(i => [i.id, i]));
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const TEST = !C.GAS_URL;
  const LS = { q: "momiji_queue", log: "momiji_log", dev: "momiji_device" };
  const load = k => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  // 端末名：URLに ?device=iPad1 を付けて一度開くと記憶します
  const qp = new URLSearchParams(location.search).get("device");
  if (qp) try { localStorage.setItem(LS.dev, qp); } catch {}
  let deviceId; try { deviceId = localStorage.getItem(LS.dev); } catch {}
  if (!deviceId) { deviceId = "dev-" + Math.random().toString(36).slice(2, 7); try { localStorage.setItem(LS.dev, deviceId); } catch {} }

  const st = { order: [], filter: "all", sel: [], attrs: {}, modalIdx: 0 };
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const thumb = i => `img/${i.id}_s.webp`, large = i => `img/${i.id}_l.webp`;

  /* ---------- 画面切替 ---------- */
  let current = "attract";
  const preview = new URLSearchParams(location.search).get("preview");
  const ended = () => preview === "end" || (C.END_AT && Date.now() >= Date.parse(C.END_AT));
  function show(v) {
    if (v === "attract" && ended()) v = "end";
    if (v === "end") renderEnd();
    current = v;
    $$(".view").forEach(el => el.classList.toggle("active", el.id === "v-" + v));
    closeModal(); $("#toast").classList.remove("on");
    if (v === "attract") startAttract(); else stopAttract();
    if (v === "attr") renderPicked();
    if (v === "about") renderAbout();
    resetIdle();
  }
  document.addEventListener("click", e => {
    const g = e.target.closest("[data-go]"); if (!g) return;
    if (g.dataset.go === "attract") resetSession();
    show(g.dataset.go);
  });

  /* ---------- 待受 ---------- */
  let slideT, slideI = 0;
  function startAttract() {
    const box = $("#slides");
    if (!box.children.length) shuffle(IMGS).forEach(i => { const im = new Image(); im.src = large(i); im.alt = ""; box.appendChild(im); });
    const ims = box.children; [...ims].forEach(x => x.classList.remove("on")); ims[slideI % ims.length].classList.add("on");
    clearInterval(slideT);
    slideT = setInterval(() => { ims[slideI % ims.length].classList.remove("on"); slideI++; ims[slideI % ims.length].classList.add("on"); }, 5000);
    clearInterval(doneT);
  }
  function stopAttract() { clearInterval(slideT); }
  $("#v-attract").addEventListener("click", () => { if (ended()) { show("end"); return; } resetSession(); show("vote"); });

  /* ---------- 終了画面 ---------- */
  function renderEnd() {
    $("#end-title").textContent = C.END_TITLE || "";
    $("#end-lines").innerHTML = (C.END_LINES || []).map(t => `<p></p>`).join("");
    [...$("#end-lines").children].forEach((p, k) => p.textContent = C.END_LINES[k]);
    const bg = $("#end-bg");
    if (!bg.children.length) shuffle(IMGS).concat(shuffle(IMGS)).slice(0, 12).forEach(i => { const im = new Image(); im.src = thumb(i); im.alt = ""; bg.appendChild(im); });
  }
  // 待受画面の表示中に終了時刻になったら切り替え（投票中の人はそのまま最後まで投票できる）
  setInterval(() => { if (current === "attract" && ended()) show("end"); }, 15000);
  $("#img-count").textContent = IMGS.length;

  function resetSession() {
    st.sel = []; st.attrs = {}; st.order = shuffle(IMGS.map(i => i.id)); st.filter = "all";
    $$(".filters .chip").forEach(c => c.classList.toggle("on", c.dataset.filter === "all"));
    $$(".opts button").forEach(b => b.classList.remove("on")); $("#comment").value = "";
    renderGrid(); renderTray();
  }

  /* ---------- 投票グリッド ---------- */
  function visible() { return st.order.map(id => byId[id]).filter(i => st.filter === "all" || i.team === st.filter); }
  function renderGrid() {
    const pager = $("#pager"), list = visible(); pager.innerHTML = "";
    for (let p = 0; p < list.length; p += 9) {
      const page = document.createElement("div"); page.className = "page";
      list.slice(p, p + 9).forEach(i => {
        const c = document.createElement("div"); c.className = "card"; c.dataset.id = i.id;
        c.innerHTML = `<div class="ph"><img src="${thumb(i)}" alt="" loading="lazy">
          <span class="when-tag">${i.when}</span>${i.has3d ? '<span class="badge3d">3Dあり</span>' : ""}
          <span class="order"></span><button class="heart" aria-label="いいな">♥</button></div>
          <div class="cap"><span class="team ${i.team}">${TEAMS[i.team].name}</span>${i.title}</div>`;
        page.appendChild(c);
      });
      pager.appendChild(page);
    }
    pager.scrollLeft = 0; renderDots(); markSel();
  }
  function renderDots() {
    const n = $("#pager").children.length, cur = Math.round($("#pager").scrollLeft / ($("#pager").clientWidth || 1));
    $("#dots").innerHTML = n > 1 ? [...Array(n)].map((_, k) => `<i class="${k === cur ? "on" : ""}"></i>`).join("") + (cur < n - 1 ? '<span class="more">→ 横にスワイプするとまだあります</span>' : "") : "";
    $("#pg-prev").hidden = !(n > 1 && cur > 0); $("#pg-next").hidden = !(n > 1 && cur < n - 1);
  }
  // PC向け：矢印ボタン・ドット・マウスホイール・ドラッグでもページ送り
  const pg = $("#pager");
  const goPage = d => { const w = pg.clientWidth, n = pg.children.length, cur = Math.round(pg.scrollLeft / w); pg.scrollTo({ left: Math.max(0, Math.min(n - 1, cur + d)) * w, behavior: "smooth" }); };
  $("#pg-prev").addEventListener("click", () => goPage(-1));
  $("#pg-next").addEventListener("click", () => goPage(1));
  $("#dots").addEventListener("click", e => { const k = [...$("#dots").querySelectorAll("i")].indexOf(e.target); if (k >= 0) pg.scrollTo({ left: k * pg.clientWidth, behavior: "smooth" }); else if (e.target.closest(".more")) goPage(1); });
  let wheelLock = 0;
  pg.addEventListener("wheel", e => { if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; e.preventDefault(); const now = Date.now(); if (now - wheelLock < 500) return; wheelLock = now; goPage(e.deltaY > 0 ? 1 : -1); }, { passive: false });
  let drag = null, dragged = false;
  pg.addEventListener("pointerdown", e => { if (e.pointerType !== "mouse") return; drag = { x: e.clientX, left: pg.scrollLeft }; dragged = false; });
  window.addEventListener("pointermove", e => { if (!drag) return; const dx = e.clientX - drag.x; if (Math.abs(dx) > 6) { dragged = true; pg.style.scrollSnapType = "none"; pg.scrollLeft = drag.left - dx; } });
  window.addEventListener("pointerup", e => { if (!drag) return; const dx = e.clientX - drag.x; pg.style.scrollSnapType = ""; if (dragged) { pg.scrollLeft = drag.left; goPage(dx < -60 ? 1 : dx > 60 ? -1 : 0); } drag = null; });
  pg.addEventListener("click", e => { if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; } }, true);
  pg.addEventListener("dragstart", e => e.preventDefault());

  $("#pager").addEventListener("scroll", () => { clearTimeout(renderDots.t); renderDots.t = setTimeout(renderDots, 80); resetIdle(); });
  $("#pager").addEventListener("click", e => {
    const card = e.target.closest(".card"); if (!card) return;
    if (e.target.closest(".heart")) toggle(card.dataset.id); else openModal(card.dataset.id);
  });
  $$(".filters .chip").forEach(b => b.addEventListener("click", () => {
    st.filter = b.dataset.filter; $$(".filters .chip").forEach(c => c.classList.toggle("on", c === b)); renderGrid();
  }));

  function toggle(id) {
    const k = st.sel.indexOf(id);
    if (k >= 0) st.sel.splice(k, 1);
    else if (st.sel.length >= C.MAX_VOTES) { toast(`${C.MAX_VOTES}枚までです。入れかえるときは ♥ をはずしてね`); return; }
    else st.sel.push(id);
    markSel(); renderTray();
  }
  function markSel() {
    $$(".card").forEach(c => { const k = st.sel.indexOf(c.dataset.id); c.classList.toggle("sel", k >= 0); c.querySelector(".order").textContent = k >= 0 ? `いいな ${k + 1}` : ""; });
  }
  function renderTray() {
    $("#slots").innerHTML = [...Array(C.MAX_VOTES)].map((_, k) => {
      const id = st.sel[k]; if (!id) return `<div class="slot">${k + 1}枚目</div>`;
      return `<div class="slot filled"><img src="${thumb(byId[id])}" alt=""><span class="x" data-rm="${id}">×</span></div>`;
    }).join("");
    const left = C.MAX_VOTES - st.sel.length;
    $("#tray-msg").textContent = st.sel.length === 0 ? "♥ をタップしてえらぶ" : left ? `あと ${left} 枚えらべます` : "えらび終わりました！";
    $("#to-attr").disabled = !st.sel.length;
  }
  $("#slots").addEventListener("click", e => { const x = e.target.closest("[data-rm]"); if (x) toggle(x.dataset.rm); });
  $("#to-attr").addEventListener("click", () => show("attr"));

  /* ---------- 詳細モーダル ---------- */
  let mlist = [];
  function openModal(id, all) { mlist = all ? IMGS.slice() : visible(); st.modalIdx = mlist.findIndex(i => i.id === id); fillModal(); $("#modal").classList.add("on"); }
  function closeModal() { $("#modal").classList.remove("on"); }
  function fillModal() {
    const list = mlist, i = list[(st.modalIdx + list.length) % list.length]; st.modalIdx = list.indexOf(i);
    $("#m-img").src = large(i);
    $("#m-badges").innerHTML = `<span class="team ${i.team}">${TEAMS[i.team].name}</span><span class="when">${i.when}</span>${i.has3d ? '<span class="when">3Dモデルあり</span>' : ""}`;
    $("#m-title").textContent = i.title; $("#m-who").textContent = i.who; $("#m-when").textContent = i.when; $("#m-where").textContent = i.where; $("#m-scene").textContent = i.scene;
    const on = st.sel.includes(i.id); $("#m-vote").innerHTML = on ? "♥ いいな に入っています<small>（タップではずす）</small>" : "♥ いいな に入れる"; $("#m-vote").dataset.id = i.id;
    $("#m-vote").style.background = on ? "#8c8178" : "";
  }
  $("#m-vote").addEventListener("click", e => { toggle(e.currentTarget.dataset.id); fillModal(); });
  $("#m-close").addEventListener("click", closeModal);
  $("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });
  $("#m-prev").addEventListener("click", () => { st.modalIdx--; fillModal(); });
  $("#m-next").addEventListener("click", () => { st.modalIdx++; fillModal(); });
  let sx = null;
  $(".modal-img").addEventListener("touchstart", e => { sx = e.touches[0].clientX; }, { passive: true });
  $(".modal-img").addEventListener("touchend", e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 60) { st.modalIdx += dx < 0 ? 1 : -1; fillModal(); } sx = null; });

  /* ---------- 属性 ---------- */
  function renderPicked() {
    $("#attr-picked").innerHTML = '<b>えらんだ「いいな」</b>' + st.sel.map(id => `<img src="${thumb(byId[id])}" alt=""><div>${byId[id].title}</div>`).join("");
  }
  $$(".opts").forEach(g => g.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    const k = g.dataset.key, on = b.classList.contains("on");
    g.querySelectorAll("button").forEach(x => x.classList.remove("on"));
    if (!on) { b.classList.add("on"); st.attrs[k] = b.textContent; } else delete st.attrs[k];
  }));
  $("#submit").addEventListener("click", () => {
    if (!st.sel.length) { show("vote"); return; }
    const v = {
      voteId: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      deviceId, clientTime: new Date().toISOString(),
      choices: st.sel.slice(), meta: st.sel.map(id => [id, TEAMS[byId[id].team].name, byId[id].title]), age: st.attrs.age || "", gender: st.attrs.gender || "",
      home: st.attrs.home || "", ws: st.attrs.ws || "", comment: $("#comment").value.trim().slice(0, 80),
    };
    const log = load(LS.log); log.push(v); save(LS.log, log);
    const q = load(LS.q); q.push(v); save(LS.q, q);
    flush();
    showDone(v);
  });

  /* ---------- 送信キュー ---------- */
  let flushing = false;
  async function flush() {
    if (TEST || flushing) return; flushing = true;
    try {
      let q = load(LS.q);
      for (const v of q.slice()) {
        const r = await fetch(C.GAS_URL, { method: "POST", body: JSON.stringify(v) });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || "ng");
        q = load(LS.q).filter(x => x.voteId !== v.voteId); save(LS.q, q);
      }
    } catch (e) { /* 通信できないときは次回に再送 */ }
    flushing = false;
  }
  setInterval(flush, 20000); window.addEventListener("online", flush); flush();

  async function fetchResults() {
    if (TEST) {
      const counts = {}; const log = load(LS.log);
      log.forEach(v => v.choices.forEach(id => counts[id] = (counts[id] || 0) + 1));
      return { total: log.length, counts };
    }
    const r = await fetch(C.GAS_URL + "?action=results&t=" + Date.now());
    return r.json();
  }

  /* ---------- 完了 ---------- */
  let doneT;
  async function showDone(v) {
    $("#done-mine").innerHTML = v.choices.map(id => `<div class="mini"><img src="${thumb(byId[id])}" alt="">${byId[id].title}</div>`).join("");
    $("#done-rank").innerHTML = '<div class="mini">集計中…</div>';
    show("done");
    let left = C.DONE_SECONDS; $("#done-count").textContent = left;
    clearInterval(doneT);
    doneT = setInterval(() => { left--; $("#done-count").textContent = left; if (left <= 0) { clearInterval(doneT); resetSession(); show("attract"); } }, 1000);
    try {
      await flush();
      const res = await fetchResults();
      // 送信待ちの自分の票が集計に入っていなければ足して表示
      if (load(LS.q).some(x => x.voteId === v.voteId) && !TEST) v.choices.forEach(id => res.counts[id] = (res.counts[id] || 0) + 1);
      const top = IMGS.map(i => ({ i, n: res.counts[i.id] || 0 })).filter(t => t.n > 0).sort((a, b) => b.n - a.n).slice(0, 3);
      $("#done-rank").innerHTML = top.map((t, k) => `<div class="mini"><span class="rk">${k + 1}</span><img src="${thumb(t.i)}" alt="">${t.i.title}<span class="n">${t.n}票</span></div>`).join("");
    } catch { $("#done-rank").innerHTML = '<div class="mini">いまは集計を表示できません（投票は記録されています）</div>'; }
  }

  /* ---------- WSについて ---------- */
  function renderAbout() {
    ["A", "M"].forEach(t => {
      const T = TEAMS[t], pane = $(`.about-pane[data-pane="${t}"]`); if (pane.innerHTML) return;
      const col = t === "A" ? "var(--a)" : "var(--m)";
      pane.innerHTML = `<div class="team-pane"><div>
        <p>${T.summary}</p>
        ${T.personas.map((p, k) => `<div class="persona"><span class="num" style="background:${col}">${k + 1}</span><div><b>${p.who}</b><span>${p.note}</span></div></div>`).join("")}
        <div class="sheet-cap">この班が描いた絵</div>
        <div class="team-thumbs">${IMGS.filter(i => i.team === t).map(i => `<img src="${thumb(i)}" alt="${i.title}" data-open="${i.id}">`).join("")}</div>
      </div><div><img class="sheet" src="${T.sheet}" alt="${T.name}のコンセプトシート"><div class="sheet-cap">${T.name}のコンセプトシート：「だれが・いつ・どこで・どんなことが出来るといい」を付箋で出し合いました</div></div></div>`;
    });
  }
  $$(".about-tabs .chip").forEach(b => b.addEventListener("click", () => {
    $$(".about-tabs .chip").forEach(c => c.classList.toggle("on", c === b));
    $$(".about-pane").forEach(p => p.classList.toggle("on", p.dataset.pane === b.dataset.tab));
  }));
  $("#v-about").addEventListener("click", e => { const o = e.target.closest("[data-open]"); if (o) openModal(o.dataset.open, true); });

  /* ---------- 無操作リセット ---------- */
  let idleT;
  function resetIdle() {
    clearTimeout(idleT);
    if (current === "attract" || current === "done") return;
    idleT = setTimeout(() => { resetSession(); show("attract"); }, C.IDLE_SECONDS * 1000);
  }
  ["touchstart", "click", "keydown"].forEach(ev => document.addEventListener(ev, resetIdle, { passive: true }));

  /* ---------- スタッフメニュー（タイトル3秒長押し） ---------- */
  let pressT;
  ["#staff-trigger", ".end-foot"].forEach(sel => {
    const el = $(sel);
    el.addEventListener("touchstart", () => { pressT = setTimeout(openStaff, 3000); }, { passive: true });
    el.addEventListener("touchend", () => clearTimeout(pressT));
    el.addEventListener("mousedown", () => { pressT = setTimeout(openStaff, 3000); });
    el.addEventListener("mouseup", () => clearTimeout(pressT));
  });
  const trig = { addEventListener() {} };
  trig.addEventListener("touchstart", () => { pressT = setTimeout(openStaff, 3000); }, { passive: true });
  trig.addEventListener("touchend", () => clearTimeout(pressT));
  trig.addEventListener("mousedown", () => { pressT = setTimeout(openStaff, 3000); });
  trig.addEventListener("mouseup", () => clearTimeout(pressT));
  function openStaff() {
    $("#s-device").textContent = deviceId; $("#s-mode").textContent = TEST ? "テストモード（端末内のみ）" : "スプレッドシートへ送信";
    $("#s-queue").textContent = load(LS.q).length; $("#s-local").textContent = load(LS.log).length;
    $("#staff").classList.add("on");
  }
  $("#s-close").addEventListener("click", () => $("#staff").classList.remove("on"));
  $("#s-retry").addEventListener("click", async () => { await flush(); openStaff(); toast(load(LS.q).length ? "まだ送れていない投票があります" : "すべて送信済みです"); });
  $("#s-csv").addEventListener("click", () => {
    const rows = [["voteId", "deviceId", "clientTime", "choice1", "choice2", "choice3", "age", "gender", "home", "ws", "comment", "unsent"]];
    const q = new Set(load(LS.q).map(v => v.voteId));
    load(LS.log).forEach(v => rows.push([v.voteId, v.deviceId, v.clientTime, v.choices[0] || "", v.choices[1] || "", v.choices[2] || "", v.age, v.gender, v.home, v.ws, v.comment, q.has(v.voteId) ? 1 : 0]));
    const csv = "﻿" + rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `votes_${deviceId}.csv`; a.click();
  });

  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2600); }

  // 2本指以上のピンチ拡大・ダブルタップ拡大を抑止
  document.addEventListener("gesturestart", e => e.preventDefault());
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

  resetSession(); show("attract");
})();
