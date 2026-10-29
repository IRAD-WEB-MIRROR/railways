/* railways.iradgov.org: site script. Header, footer, language and the data-driven parts (timetable, live running, freight). */
(function () {
  "use strict";
  var SITE = {"store": "tj_lang", "nav": [["home", "/"], ["timetable", "/timetable.html"], ["passengers", "/passengers.html"], ["freight", "/freight.html"], ["network", "/network.html"], ["about", "/about.html"]], "navAlias": {}, "links": [["gov", "https://iradgov.org/"], ["eirad", "https://e-irad.org/"], ["bank", "https://bank.iradgov.org/"], ["arch", "https://archives.iradgov.org/"], ["post", "https://post.iradgov.org/"], ["elections", "https://elections.iradgov.org/"], ["court", "https://court.iradgov.org/"], ["stats", "https://stats.iradgov.org/"], ["mejlis", "https://mejlis.iradgov.org/"], ["gidromet", "https://gidromet.iradgov.org/"], ["jandarm", "https://jandarm.iradgov.org/"], ["customs", "https://customs.iradgov.org/"], ["avia", "https://avia.iradgov.org/"]], "mastBtn": "/timetable.html"};
  var EXTRA = function () {
    var ids = ["board", "search", "ttLong", "ttSub", "fares", "yard", "track", "wxLine"];
    if (!ids.some(function (i) { return document.getElementById(i); })) return;
    var wxP = todayData().catch(function () { return null; });
    getJSON("/data/timetable.json").then(function (T) {
      var S = {}; T.stations.forEach(function (s) { S[s.id] = s; });
      function sn(id) { return S[id] ? tri(S[id].name) : id; }
      function m(hm) { var p = hm.split(":"); return +p[0] * 60 + +p[1]; }
      function hm(x) { x = ((x % 1440) + 1440) % 1440; return pad(Math.floor(x / 60)) + ":" + pad(x % 60); }
      function dur(x) { return t("dur", { h: Math.floor(x / 60), m: pad(x % 60) }); }
      function money(x) { var s = (Math.round(x * 100) / 100).toFixed(x % 1 ? 2 : 0); return LANG === "en" ? s : s.replace(".", ","); }
      function addDays(d, n) { var p = d.split("-"), x = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)); return x.getUTCFullYear() + "-" + pad(x.getUTCMonth() + 1) + "-" + pad(x.getUTCDate()); }
      function dow(d) { var p = d.split("-"); var w = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay(); return w === 0 ? 7 : w; }
      function runs(tr, d) {
        if (tr.valid_from && d < tr.valid_from) return false;
        if (tr.valid_to && d > tr.valid_to) return false;
        if (tr.days === "1-6" && dow(d) === 7) return false;
        return true;
      }
      function trainsOn(d) { return T.trains.filter(function (tr) { return runs(tr, d); }); }
      function label(tr) { return (tr.kind === "long" ? t("trNo", { n: tr.no }) : tr.no) + " " + sn(tr.from) + " – " + sn(tr.to); }
      function kindName(tr) { return t("kind_" + tr.kind); }
      function stopTime(st) { return st[2] || st[1]; }
      /* fares: long trains by distance on the 18/31 som through fares; suburban by zone */
      function fare(tr, a, b) {
        var km = Math.abs(S[b].km - S[a].km), F = T.fares;
        if (tr.kind === "long") {
          var f = function (full) { return Math.max(F.long.min, Math.round(full * km / F.long.km * 2) / 2); };
          return { p: f(F.long.platskart), k: f(F.long.kupe) };
        }
        if (tr.kind === "work") return { s: F.work };
        for (var i = 0; i < F.sub.length; i++) if (km <= F.sub[i][0]) return { s: F.sub[i][1] };
      }
      /* delays: a fixed figure for each train and day, made worse by the weather on the line */
      function h01(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100000) / 100000; }
      function code(W, place, d) {
        if (!W) return null;
        var p = (W.weather || []).filter(function (x) { return x.id === place; })[0];
        if (!p) return null;
        if (W.date === d) return p.code;
        var f = (p.forecast || []).filter(function (x) { return x.date === d; })[0];
        return f ? f.code : null;
      }
      function wxEffect(c, r) {
        if (c == null) return null;
        if (c === 45 || c === 48) return { min: 10 + Math.round(r * 15), why: "rFog" };
        if (c === 56 || c === 57 || c === 66 || c === 67) return { min: 20 + Math.round(r * 25), why: "rIce" };
        if (c === 73 || c === 75 || c === 86) return { min: 30 + Math.round(r * 40), why: "rSnow", heavy: true };
        if ((c >= 71 && c <= 77) || c === 85) return { min: 10 + Math.round(r * 15), why: "rSnow" };
        if (c >= 95) return { min: 10 + Math.round(r * 10), why: "rStorm" };
        if (c === 65 || c === 82) return { min: 5 + Math.round(r * 8), why: "rRain" };
        return null;
      }
      var ROUT = { long: ["rLoop", "rTrack", "rLoco", "rLoop", "rBorder"], sub: ["rLate", "rTrack", "rLoop"], work: ["rLate"] };
      function delay(tr, d, W) {
        var r = h01(d + "|" + tr.no), r2 = h01(tr.no + "/" + d), D = 0, why = null, cancelled = false;
        if (tr.kind === "long") {
          if (r < 0.55) D = 0; else if (r < 0.8) D = 5 + Math.round(r2 * 10); else if (r < 0.95) D = 15 + Math.round(r2 * 20); else D = 40 + Math.round(r2 * 40);
          if (D) why = r >= 0.95 ? "rLocoFail" : ROUT.long[Math.floor(r2 * 5)];
        } else {
          if (r < 0.75) D = 0; else if (r < 0.95) D = 3 + Math.round(r2 * 7); else D = 15 + Math.round(r2 * 15);
          if (D) why = ROUT[tr.kind][Math.floor(r2 * ROUT[tr.kind].length)];
        }
        var places = tr.kind === "long" ? ["talas", "nurzhan"] : ["nurzhan"], wx = null;
        places.forEach(function (p) { var e = wxEffect(code(W, p, d), r2); if (e && (!wx || e.min > wx.min)) wx = e; });
        if (wx) { D += wx.min; why = wx.why; if (wx.heavy && tr.kind !== "long" && r < 0.3) cancelled = true; }
        return { min: D, why: why, cancelled: cancelled, known: !!W && (W.date === d || addDays(W.date, 1) === d) };
      }
      /* expected time at each stop: the delay builds up along the way */
      function expected(tr, dl) {
        var n = tr.stops.length;
        return tr.stops.map(function (st, i) {
          var share = dl.min ? Math.round(dl.min * (0.2 + 0.8 * i / (n - 1))) : 0;
          return { id: st[0], arr: st[1] ? m(st[1]) + share : null, dep: st[2] ? m(st[2]) + share : null, sched: m(stopTime(st)), late: share };
        });
      }
      function overnight(tr) { return m(tr.stops[tr.stops.length - 1][1]) < m(tr.stops[0][2]); }
      function liveState(tr, dl, nowMin) {
        if (dl.cancelled) return { cls: "no", txt: t("stCancel") };
        var ex = expected(tr, dl), first = ex[0], last = ex[ex.length - 1];
        if (nowMin < first.dep) return dl.min ? { cls: "warn", txt: t("stExp", { t: hm(first.dep), n: first.late }) } : { cls: "ok", txt: t("stOnTime") };
        if (nowMin >= last.arr) return { cls: dl.min > 5 ? "warn" : "ok", txt: dl.min ? t("stArrLate", { t: hm(last.arr), n: last.late }) : t("stArr", { t: hm(last.arr) }) };
        var next = ex.filter(function (e) { return e.arr != null && e.arr > nowMin; })[0];
        return { cls: dl.min > 5 ? "warn" : "ok", txt: t("stRun", { s: sn(next.id), t: hm(next.arr) }) + (dl.min ? " · " + t("stLate", { n: next.late }) : "") };
      }
      function irMin() { var d = iradNow(); return d.getHours() * 60 + d.getMinutes(); }

      wxP.then(function (W) {
        var today = iradToday(), el;
        /* weather line */
        if ((el = $("#wxLine"))) {
          if (!W) el.innerHTML = "";
          else el.innerHTML = '<span class="live">' + esc(t("lnLive")) + "</span> " + esc(t("wxOn")) + " " + (W.weather || []).filter(function (p) { return p.id === "talas" || p.id === "nurzhan"; }).map(function (p) {
            return "<b>" + esc(tri(p.name)) + "</b> " + esc(tri(p.label)) + ", " + p.high + "°";
          }).join(" · ") + ' <a class="small" href="https://gidromet.iradgov.org/">' + esc(t("wxMore")) + "</a>";
        }
        /* today's trains */
        if ((el = $("#board"))) {
          var now = irMin(), list = trainsOn(today).slice().sort(function (a, b) { return m(a.stops[0][2]) - m(b.stops[0][2]); });
          el.innerHTML = '<div class="tbl-wrap"><table class="facts board"><thead><tr><th>' + esc(t("bTrain")) + "</th><th>" + esc(t("bDep")) + " / " + esc(t("bArr")) + "</th><th>" + esc(t("bStatus")) + "</th></tr></thead><tbody>" +
            list.map(function (tr) {
              var dl = delay(tr, today, W), st = W ? liveState(tr, dl, now) : { cls: "", txt: "" };
              var o = tr.stops[0], z = tr.stops[tr.stops.length - 1];
              return '<tr><td class="nw"><b>' + esc(tr.kind === "long" ? t("trNo", { n: tr.no }) : tr.no) + '</b><br><span class="small muted">' + esc(kindName(tr)) + '</span></td><td class="nw">' + o[2] + " " + esc(sn(o[0])) + "<br>" + z[1] + " " + esc(sn(z[0])) + "</td><td>" +
                (st.txt ? '<span class="st ' + st.cls + '">' + esc(st.txt) + "</span>" + (dl.why && dl.min ? '<br><span class="small muted">' + esc(t(dl.why)) + "</span>" : "") : "") + "</td></tr>";
            }).join("") + "</tbody></table></div>" + (W ? "" : '<p class="small muted">' + esc(t("noLive")) + "</p>");
        }
        /* route search */
        if ((el = $("#search"))) {
          var pass = T.stations.filter(function (s) { return s.line !== "tech"; });
          var opt = function (sel) { return pass.map(function (s) { return '<option value="' + s.id + '"' + (s.id === sel ? " selected" : "") + ">" + esc(tri(s.name)) + "</option>"; }).join(""); };
          var q = function (k) { var x = (location.search.match(new RegExp("[?&]" + k + "=([\\w-]+)")) || [])[1]; return S[x] ? x : null; };
          var f0 = q("from") || "talas", t0 = q("to") || "nurzhan";
          el.innerHTML = '<form class="calc"><div class="row2"><div><label for="sF">' + esc(t("sFrom")) + '</label><select id="sF">' + opt(f0) + "</select></div>" +
            '<div class="swapc"><button type="button" class="swap" id="sX" aria-label="' + esc(t("sSwap")) + '">⇄</button></div>' +
            '<div><label for="sT">' + esc(t("sTo")) + '</label><select id="sT">' + opt(t0) + "</select></div>" +
            '<div><label for="sD">' + esc(t("sDate")) + '</label><input id="sD" type="date" value="' + today + '" min="' + today + '" max="' + addDays(today, 60) + '"></div></div>' +
            '<div class="out" id="sOut" aria-live="polite"></div></form>';
          var go = function () {
            var a = $("#sF").value, b = $("#sT").value, d = $("#sD").value || today, o = $("#sOut");
            if (a === b) { o.innerHTML = '<p class="muted">' + esc(t("sSame")) + "</p>"; return; }
            var res = trainsOn(d).map(function (tr) {
              var ia = -1, ib = -1;
              tr.stops.forEach(function (st, i) { if (st[0] === a) ia = i; if (st[0] === b) ib = i; });
              return ia >= 0 && ib > ia ? { tr: tr, a: tr.stops[ia], b: tr.stops[ib], ia: ia, ib: ib } : null;
            }).filter(Boolean).sort(function (x, y) { return m(x.a[2]) - m(y.a[2]); });
            if (!res.length) {
              o.innerHTML = '<p class="muted">' + esc(t("sNone")) + "</p>" + ((S[a].line === "north" || S[b].line === "north") ? "" : '<p class="small">' + esc(t("sNoneHint")) + "</p>");
              return;
            }
            var now = irMin();
            o.innerHTML = '<p class="small muted">' + esc(t("sFor", { a: sn(a), b: sn(b), d: fmtDate(d) })) + "</p>" + res.map(function (x) {
              var tr = x.tr, f = fare(tr, a, b), dl = delay(tr, d, W), ex = expected(tr, dl);
              var len = m(x.b[1]) - m(x.a[2]); if (len < 0) len += 1440;
              var stat = "";
              if (W && dl.known) {
                if (dl.cancelled) stat = '<span class="st no">' + esc(t("stCancel")) + "</span>";
                else if (d === today && ex[x.ia].dep <= now) stat = ex[x.ib].arr <= now ? '<span class="st ok">' + esc(t("stGone")) + "</span>" : '<span class="st ' + (dl.min > 5 ? "warn" : "ok") + '">' + esc(t("stOnWay", { t: hm(ex[x.ib].arr) })) + "</span>";
                else stat = dl.min ? '<span class="st warn">' + esc(t("stExpA", { t: hm(ex[x.ia].dep), n: ex[x.ia].late })) + "</span>" : '<span class="st ok">' + esc(t("stOnTime")) + "</span>";
                if (dl.min && dl.why) stat += ' <span class="small muted">' + esc(t(dl.why)) + "</span>";
              }
              return '<div class="res"><div class="rt"><span class="tm">' + x.a[2] + '</span><span class="ar">→</span><span class="tm">' + x.b[1] + '</span><span class="small muted">' + esc(dur(len)) + "</span></div>" +
                '<div><b>' + esc(label(tr)) + '</b> · <span class="small">' + esc(kindName(tr)) + "</span></div>" +
                '<div class="small">' + (f.p != null ? esc(t("fLong", { p: money(f.p), k: money(f.k) })) : esc(t("fSub", { s: money(f.s) }))) + " · " + esc(t("sStops", { n: x.ib - x.ia - 1 })) + "</div>" +
                (stat ? '<div style="margin-top:4px">' + stat + "</div>" : "") + "</div>";
            }).join("") + '<p class="small muted">' + esc(t("sCash")) + "</p>";
          };
          $("#sX").addEventListener("click", function () { var a = $("#sF").value; $("#sF").value = $("#sT").value; $("#sT").value = a; go(); });
          var fm = el.querySelector("form");
          fm.addEventListener("change", go); fm.addEventListener("input", go); fm.addEventListener("submit", function (e) { e.preventDefault(); go(); });
          go();
        }
      });

      /* full timetables (no live data needed) */
      var el2, today = iradToday();
      function cur(no) { return T.trains.filter(function (tr) { return tr.no === no && runs(tr, today); })[0] || T.trains.filter(function (tr) { return tr.no === no; })[0]; }
      if ((el2 = $("#ttLong"))) {
        var t1 = cur("1"), t2 = cur("2"), at = function (tr, id) { var s = tr.stops.filter(function (x) { return x[0] === id; })[0]; return s ? s : null; };
        var cell = function (s) { if (!s) return "—"; return s[1] && s[2] && s[1] !== s[2] ? s[1] + "<br>" + s[2] : (s[2] || s[1]); };
        var order = t1.stops.map(function (s) { return s[0]; });
        el2.innerHTML = '<div class="tbl-wrap"><table class="facts tt"><thead><tr><th class="num">' + esc(t("tKm")) + "</th><th>" + esc(t("tStation")) + '</th><th class="nw">' + esc(t("trNo", { n: 1 })) + "<br><span class=\"small\">" + esc(t("tDown")) + '</span></th><th class="nw">' + esc(t("trNo", { n: 2 })) + "<br><span class=\"small\">" + esc(t("tUp")) + "</span></th></tr></thead><tbody>" +
          order.map(function (id) {
            var s = S[id];
            return "<tr" + (s.line === "tech" ? ' class="tech"' : "") + '><td class="num">' + s.km + "</td><td>" + esc(sn(id)) + (s.line === "tech" ? ' <span class="small muted">' + esc(t("tTech")) + "</span>" : "") + '</td><td class="nw">' + cell(at(t1, id)) + '</td><td class="nw">' + cell(at(t2, id)) + "</td></tr>";
          }).join("") + "</tbody></table></div>";
      }
      if ((el2 = $("#ttSub"))) {
        var groups = [["akjol", t("gAkjol")], ["karasu", t("gKarasu")], ["depot", t("gDepot")]];
        el2.innerHTML = groups.map(function (g) {
          var list = T.trains.filter(function (tr) { return tr.kind !== "long" && (tr.to === g[0] || tr.from === g[0]) && runs(tr, today); });
          var out = list.filter(function (tr) { return tr.from === "nurzhan"; }), back = list.filter(function (tr) { return tr.to === "nurzhan"; });
          var tbl = function (arr) {
            if (!arr.length) return "";
            var ids = arr[0].stops.map(function (s) { return s[0]; });
            return '<div class="tbl-wrap"><table class="facts tt"><thead><tr><th>' + esc(t("tStation")) + "</th>" + arr.map(function (tr) { return '<th class="nw">' + tr.no + "</th>"; }).join("") + "</tr></thead><tbody>" +
              ids.map(function (id) { return "<tr><td>" + esc(sn(id)) + "</td>" + arr.map(function (tr) { var s = tr.stops.filter(function (x) { return x[0] === id; })[0]; return '<td class="nw">' + (s ? stopTime(s) : "—") + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
          };
          return "<h3>" + esc(g[1]) + "</h3>" + (g[0] === "depot" ? '<p class="small">' + esc(t("gDepotN")) + "</p>" : "") + tbl(out) + tbl(back);
        }).join("") + (T.trains.some(function (tr) { return tr.valid_from && tr.valid_from > today; }) ? '<p class="small"><b>' + esc(t("gWinter")) + "</b></p>" : "");
      }
      if ((el2 = $("#fares"))) {
        var F = T.fares, rows = [["talas", "kara-bulak"], ["talas", "kyzyl-adyr"], ["talas", "aulie-ata"], ["talas", "lugovoy"], ["talas", "nurzhan"], ["kyzyl-adyr", "nurzhan"], ["aulie-ata", "nurzhan"]];
        el2.innerHTML = '<div class="tbl-wrap"><table class="facts"><thead><tr><th>' + esc(t("fJourney")) + '</th><th class="num">' + esc(t("tKm")) + '</th><th class="num">' + esc(t("fPlats")) + '</th><th class="num">' + esc(t("fKupe")) + "</th></tr></thead><tbody>" +
          rows.map(function (r) { var f = fare(T.trains[0], r[0], r[1]); return "<tr><td>" + esc(sn(r[0])) + " – " + esc(sn(r[1])) + '</td><td class="num">' + Math.abs(S[r[1]].km - S[r[0]].km) + '</td><td class="num">' + money(f.p) + '</td><td class="num">' + money(f.k) + "</td></tr>"; }).join("") +
          '</tbody></table></div><div class="tbl-wrap"><table class="facts"><thead><tr><th>' + esc(t("fSubH")) + '</th><th class="num">' + esc(t("fSom")) + "</th></tr></thead><tbody>" +
          F.sub.map(function (z, i) { return "<tr><td>" + esc(i === F.sub.length - 1 ? t("fZoneLast", { a: F.sub[i - 1][0] }) : t("fZone", { a: z[0] })) + '</td><td class="num">' + money(z[1]) + "</td></tr>"; }).join("") +
          "<tr><td>" + esc(t("fWork")) + '</td><td class="num">' + money(F.work) + "</td></tr></tbody></table></div>";
      }
      /* freight: yard and border status from the weather */
      if ((el2 = $("#yard"))) {
        wxP.then(function (W) {
          if (!W) { failBox(el2); return; }
          var d = W.date, rows = [];
          var c = function (p) { return code(W, p, d); };
          var wet = function (x) { return x != null && ((x >= 51 && x <= 67) || (x >= 80 && x <= 82) || x >= 95 || (x >= 71 && x <= 77) || x === 85 || x === 86); };
          var snow = function (x) { return x != null && ((x >= 71 && x <= 77) || x === 85 || x === 86); };
          var it = function (name, ok, txt) { rows.push("<tr><td>" + esc(name) + '</td><td><span class="st ' + ok + '">' + esc(txt) + "</span></td></tr>"); };
          it(t("yDepot"), snow(c("nurzhan")) ? "warn" : "ok", snow(c("nurzhan")) ? t("ySnow") : t("yNormal"));
          it(t("yGrainKB"), wet(c("talas")) ? "warn" : "ok", wet(c("talas")) ? t("yGrainWet") : t("yGrainOk"));
          it(t("yGrainNz"), wet(c("nurzhan")) ? "warn" : "ok", wet(c("nurzhan")) ? t("yGrainWet") : t("yGrainOk"));
          it(t("yTNT"), "ok", t("yTNTx"));
          var bx = delay({ no: "BX", kind: "long" }, d, W);
          it(t("yNBS"), bx.min > 20 ? "warn" : "ok", bx.min > 20 ? t("yNBSlate") : t("yNBSx"));
          it(t("ySB"), "warn", t("ySBx"));
          el2.innerHTML = '<p class="small"><span class="live">' + esc(t("lnLive")) + "</span> " + esc(t("yFor", { d: fmtDate(d) })) + '</p><div class="tbl-wrap"><table class="facts">' + rows.join("") + "</table></div>";
        });
      }
    }).catch(function () { ids.forEach(function (i) { var e = document.getElementById(i); if (e && i !== "track") failBox(e); }); });

    /* freight: consignment lookup */
    var tk = $("#track");
    if (tk) {
      tk.innerHTML = '<form class="calc"><label for="tkN">' + esc(t("tkLbl")) + '</label><div class="row2"><div><input id="tkN" type="text" placeholder="TJ 26-000000" autocomplete="off" spellcheck="false"></div><div><button type="submit" class="btn">' + esc(t("tkGo")) + '</button></div></div><div class="out" id="tkOut" aria-live="polite"></div></form>';
      tk.querySelector("form").addEventListener("submit", function (e) {
        e.preventDefault();
        var raw = $("#tkN").value.toUpperCase().replace(/[^0-9A-Z]/g, ""), o = $("#tkOut");
        var mm = raw.match(/^(?:TJ)?(\d{2})(\d{6})$/);
        if (!mm) { o.innerHTML = '<p class="muted">' + esc(t("tkFmt")) + "</p>"; return; }
        var key = "TJ " + mm[1] + "-" + mm[2];
        getJSON("/data/consignments.json").then(function (C) {
          var x = (C.consignments || []).filter(function (c) { return c.no === key; })[0];
          if (!x) { o.innerHTML = '<p class="muted">' + esc(t("tkNone", { n: key })) + "</p>"; return; }
          o.innerHTML = '<table class="facts"><tbody>' +
            "<tr><td>" + esc(t("tkNo")) + "</td><td><b>" + esc(x.no) + "</b></td></tr>" +
            "<tr><td>" + esc(t("tkGoods")) + "</td><td>" + esc(tri(x.goods)) + "</td></tr>" +
            "<tr><td>" + esc(t("tkWag")) + "</td><td>" + esc(tri(x.wagons)) + "</td></tr>" +
            "<tr><td>" + esc(t("tkRoute")) + "</td><td>" + esc(tri(x.from)) + " → " + esc(tri(x.to)) + "</td></tr>" +
            (x.consignee ? "<tr><td>" + esc(t("tkCons")) + "</td><td>" + esc(tri(x.consignee)) + "</td></tr>" : "") +
            "</tbody></table>" + '<ul class="tl" style="margin-top:14px">' + x.events.map(function (ev) {
              return '<li><span class="y">' + esc(fmtDate(ev.date)) + (ev.time ? ", " + esc(ev.time) : "") + "</span>" + esc(tri(ev.text)) + "</li>";
            }).join("") + "</ul>";
        }).catch(function () { failBox(o); });
      });
    }
  };
  var I = window.SITE_I18N;
  var LANGS = ["en", "ir", "ru"];
  var PAGE = document.body.getAttribute("data-page") || "";
  var LANG = (function () {
    var q = (location.search.match(/[?&]lang=(en|ir|ru)\b/) || [])[1];
    if (q) { try { localStorage.setItem(SITE.store, q); } catch (e) {} return q; }
    try { var s = localStorage.getItem(SITE.store); if (LANGS.indexOf(s) >= 0) return s; } catch (e) {}
    return "en";
  })();
  var cache = {};

  /* ---------- helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fill(s, v) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return v && v[k] != null ? v[k] : m; }); }
  function t(k, v) { var d = I.ui[LANG] || {}; var s = d[k] != null ? d[k] : I.ui.en[k]; return s == null ? k : (v ? fill(s, v) : s); }
  function tri(o) { if (o == null) return ""; if (typeof o === "string") return o; return o[LANG] || o.en || ""; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function iradNow() { var n = new Date(); return new Date(n.getTime() + n.getTimezoneOffset() * 60000 + 6 * 3600000); }
  function iradToday() { var d = iradNow(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function fmtDate(s) {
    var p = String(s).split("-"), M = t("months");
    if (p.length < 3) return t("monthsNom")[+p[1] - 1] + " " + p[0];
    if (LANG === "ir") return (+p[2]) + "-" + M[+p[1] - 1] + " " + p[0];
    return (+p[2]) + " " + M[+p[1] - 1] + " " + p[0];
  }
  function getJSON(url) {
    if (!cache[url]) cache[url] = fetch(url, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
    return cache[url];
  }
  function sortByDate(a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }
  /* today's numbers: the public file (iradone.com/data/today.json) nests its lists; flatten them once */
  function todayData() {
    return getJSON("https://iradone.com/data/today.json").then(function (d) {
      if (d.weather && d.weather.places) d.weather = d.weather.places;
      if (d.air && d.air.places) d.air = d.air.places;
      if (d.water && d.water.toktogul && !d.toktogul) d.toktogul = d.water.toktogul;
      if (d.rates && d.rates.official && d.rates.official.rows) d.rates.official = d.rates.official.rows;
      if (d.prices && !Array.isArray(d.prices)) {
        var a = [];
        ["food", "fuel", "transport", "rent"].forEach(function (g) {
          (d.prices[g] || []).forEach(function (p) { if (!p.group) p.group = p.id === "hay" ? "farm" : g; a.push(p); });
        });
        d.prices = a;
      }
      if (!d.computed) d.computed = d.updated;
      return d;
    });
  }
  function failBox(el) { if (el) el.innerHTML = '<p class="muted">' + esc(t("loadFail")) + "</p>"; }

  /* ---------- chrome ---------- */
  function navHTML() {
    return SITE.nav.map(function (n) {
      var cur = n[0] === PAGE || (SITE.navAlias[PAGE] === n[0]);
      return '<li><a href="' + n[1] + '"' + (cur ? ' aria-current="page"' : "") + ">" + esc(t("nav_" + n[0])) + "</a></li>";
    }).join("");
  }
  function hash01(x) { var h = 2166136261; for (var i = 0; i < x.length; i++) { h ^= x.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100000) / 100000; }
  function sideLinks(list) {
    return "<ul>" + list.map(function (l) { return '<li><a href="' + l[0] + '">' + esc(t(l[1])) + (l[2] ? ' <span class="new">' + esc(t("sNew")) + "</span>" : "") + "</a></li>"; }).join("") + "</ul>";
  }
  function counter() {
    var d = iradNow(), day = iradToday(), mins = d.getHours() * 60 + d.getMinutes();
    var full = 180 + Math.floor(hash01(day) * 140), n = Math.max(3, Math.round(full * Math.pow(mins / 1440, 1.25)));
    var days = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2009, 2, 16)) / 86400000);
    var all = String(days * 137 + 4210 + n).replace(/\B(?=(\d{3})+(?!\d))/g, LANG === "en" ? "," : " ");
    return '<div class="sbox"><div class="in ctr">' + esc(t("ctrH")) + '<br><span class="digits">' + ("00000" + n).slice(-5) + "</span><br>" + esc(t("ctrAll", { n: all })) +
      '<span class="upd" id="upd"></span></div></div>';
  }
  function chrome() {
    var top = $("#top"), side = $("#side"), bottom = $("#bottom");
    if (top) {
      top.innerHTML =
        '<a class="skip" href="#main">' + esc(t("skip")) + "</a>" +
        '<div class="strip"><div><span class="lnk"><a href="/">' + esc(t("nav_home")) + '</a><a href="/about.html">' + esc(t("stripCont")) + '</a><a href="mailto:info@railways.iradgov.org">' + esc(t("stripMail")) + '</a></span><span class="clock" id="clock"></span></div>' +
        '<div class="langs" role="group" aria-label="' + esc(t("langLabel")) + '">' +
        ["ru", "ir", "en"].map(function (l) { return '<button type="button" data-lang="' + l + '" aria-pressed="' + (l === LANG) + '" lang="' + I.htmlLang[l] + '">' + esc(I.langs[l]) + "</button>"; }).join("") +
        "</div></div>" +
        '<div class="mast"><div class="photo-strip" aria-hidden="true"></div><a class="home-link" href="/"><img class="mark" src="/assets/brand/temirjolu-mark-white.svg" alt="' + esc(t("markAlt")) + '" width="74" height="74">' +
        '<div class="ttl"><div class="k">' + esc(t("mastK")) + '</div><div class="n">' + esc(t("mastN")) + '</div><div class="s">' + esc(t("mastS")) + "</div></div></a>" +
        '<div class="help">' + esc(t("helpK")) + "<b>" + esc(t("helpN")) + "</b>" + esc(t("helpH")) + "</div></div>" +
        '<nav class="nav" aria-label="' + esc(t("navLabel")) + '"><button class="burger" type="button" aria-expanded="false"><span class="bars"></span>' + esc(t("menu")) + '</button><ul class="menu">' + navHTML() + "</ul></nav>" +
        '<div class="ticker" id="ticker" hidden><span class="lbl">' + esc(t("tickLbl")) + '</span><div class="run"><span id="tickRun"></span></div></div>';
      $(".burger", top).addEventListener("click", function () {
        var nav = $(".nav", top), open = !nav.classList.contains("open");
        nav.classList.toggle("open", open); this.setAttribute("aria-expanded", open);
      });
      $$("[data-lang]", top).forEach(function (b) { b.addEventListener("click", function () { setLang(b.getAttribute("data-lang")); }); });
      tick();
      getJSON("/data/notices.json").then(function (d) {
        var items = (d.notices || []).slice().sort(sortByDate).slice(0, 5);
        if (!items.length) return;
        $("#tickRun").innerHTML = items.map(function (x) {
          return '<a href="' + (x.kind === "freight" ? "/freight.html" : "/") + '">' + esc(fmtDate(x.date)) + " – " + esc(tri(x.title)) + "</a>";
        }).join("<i>***</i>");
        $("#ticker").hidden = false;
        var u = $("#upd"); if (u) u.textContent = t("upd", { d: fmtDate(d.updated || items[0].date) });
      }).catch(function () {});
    }
    if (side) {
      side.innerHTML =
        '<div class="sbox"><h4>' + esc(t("sideP")) + "</h4>" + sideLinks([["/timetable.html", "sSearch"], ["/timetable.html#ttLong", "nav_timetable"], ["/timetable.html#ttSub", "sSub"], ["/passengers.html", "sTickets"], ["/timetable.html#ttSub", "sChange", true]]) + "</div>" +
        '<div class="sbox"><h4>' + esc(t("sideF")) + "</h4>" + sideLinks([["/freight.html#yard", "sYard"], ["/freight.html#track", "sTrack"], ["/freight.html#notices", "sFrN"]]) + "</div>" +
        '<div class="sbox"><h4>' + esc(t("sideR")) + "</h4>" + sideLinks([["/about.html", "nav_about"], ["/network.html", "nav_network"]]) + "</div>" +
        '<div class="sbox"><h4 class="y">' + esc(t("helpK")) + '</h4><div class="in"><span class="ph">' + esc(t("helpN")) + '</span><br><span class="small muted">' + esc(t("helpH")) + "</span></div></div>" +
        '<div class="sbox links"><h4>' + esc(t("linksH")) + "</h4><ul>" + SITE.links.map(function (l) { return '<li><a href="' + l[1] + '">' + esc(t("link_" + l[0])) + "</a></li>"; }).join("") + "</ul></div>" +
        counter();
    }
    if (bottom) {
      bottom.innerHTML =
        '<footer class="foot"><div class="fl">' + SITE.nav.map(function (n) { return '<a href="' + n[1] + '">' + esc(t("nav_" + n[0])) + "</a>"; }).join("") + "</div>" +
        '<div class="row"><div><img class="fmark" src="/assets/brand/temirjolu-mark-white.svg" alt="" width="30" height="30">' + esc(t("footCopy", { y: iradNow().getFullYear() })) + "<br>" + esc(t("footCite")) + "</div>" +
        '<address style="font-style:normal">' + t("footAddr") + "</address></div>" +
        '<div class="best">' + esc(t("footBest")) + " " + esc(t("footTime")) + "</div></footer>";
    }
  }
  var tickTimer;
  function tick() {
    var el = $("#clock"); if (!el) return;
    var d = iradNow();
    el.textContent = t("clock", { d: fmtDate(iradToday()), t: pad(d.getHours()) + ":" + pad(d.getMinutes()) });
    clearTimeout(tickTimer); tickTimer = setTimeout(tick, 30000);
  }

  /* ---------- static text ---------- */
  function staticText() {
    var P = (I.pages || {})[LANG] || {};
    $$("[data-i18n]").forEach(function (el) {
      if (!el.hasAttribute("data-en")) el.setAttribute("data-en", el.innerHTML);
      var k = el.getAttribute("data-i18n");
      el.innerHTML = LANG === "en" ? el.getAttribute("data-en") : (P[k] != null ? P[k] : el.getAttribute("data-en"));
    });
    var tk = document.body.getAttribute("data-title");
    var dt = (tk && P["title_" + tk] && LANG !== "en" ? P["title_" + tk] : (document.body.getAttribute("data-title-en") || document.title.split(" | ")[0]));
    document.title = dt === t("mastN") ? dt : dt + " | " + t("mastN");
    document.documentElement.lang = I.htmlLang[LANG];
  }
  function setLang(l) {
    LANG = l;
    try { localStorage.setItem(SITE.store, l); } catch (e) {}
    render();
  }

  /* ---------- data-driven parts ---------- */
  function countdowns() {
    $$("[data-countdown]").forEach(function (el) {
      var to = el.getAttribute("data-countdown").split("-"), now = iradNow();
      var days = Math.ceil((Date.UTC(+to[0], +to[1] - 1, +to[2]) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
      el.innerHTML = days > 0 ? '<b class="cd-n">' + days + "</b> " + esc(t("cdDays")) : esc(t("cdToday"));
    });
  }
  function dates() {
    $$("[data-date]").forEach(function (el) { el.textContent = fmtDate(el.getAttribute("data-date")); });
  }
  function notices() {
    var el = $("#notices"); if (!el) return;
    var n = +(el.getAttribute("data-n") || 99);
    getJSON("/data/notices.json").then(function (d) {
      var kind = el.getAttribute("data-kind");
      var items = (d.notices || []).filter(function (x) { return !kind || x.kind === kind; }).slice().sort(sortByDate).slice(0, n);
      el.innerHTML = items.map(function (x) {
        return '<div class="notice"><div class="meta">' + esc(fmtDate(x.date)) + (x.number ? " · " + esc(tri(x.number)) : "") + (x.kind ? " · " + esc(t("nk_" + x.kind)) : "") + '</div><div class="t">' + esc(tri(x.title)) + "</div>" +
          (x.text ? "<p>" + tri(x.text) + "</p>" : "") + (x.signed ? '<p class="small muted">' + esc(tri(x.signed)) + "</p>" : "") + "</div>";
      }).join("");
    }).catch(function () { failBox(el); });
  }
  function render() {
    chrome();
    staticText();
    dates();
    countdowns();
    notices();
    if (EXTRA) EXTRA();
  }
  render();
  setInterval(function () { if (document.getElementById("board") && !document.getElementById("search")) EXTRA(); }, 60000);
})();
