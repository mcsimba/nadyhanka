(function () {
  "use strict";

  var DATA = window.NADYHANKY || { questions: [], guests: [] };
  var Q = DATA.questions;
  var G = DATA.guests; // відсортовані від нових до старих
  var app = document.getElementById("app");
  var SITE = "#надиханка";
  var query = "";

  var MONTHS = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function date(iso) {
    if (!iso) return "";
    var p = iso.split("-");
    return +p[2] + " " + MONTHS[+p[1] - 1] + " " + p[0];
  }
  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function bySlug(slug) {
    for (var i = 0; i < G.length; i++) if (G[i].slug === slug) return i;
    return -1;
  }
  // коротке ім'я, як у вступі («Вова»), якщо воно відрізняється від повного
  function firstName(g) { return g.short || g.name.split(" ")[0]; }
  function faces(list) {
    return '<span class="faces">' + list.slice(0, 5).map(function (g) {
      return '<img src="' + esc(g.cover) + '" alt="" loading="lazy">';
    }).join("") + "</span>";
  }
  function answered(i) {
    return G.filter(function (g) { return g.answers[i]; });
  }

  // ---------- сторінки ----------

  function cards(list) {
    if (!list.length) return '<p class="empty">Нікого не знайшли. Спробуйте інше ім’я.</p>';
    return '<div class="grid">' + list.map(function (g) {
      return '<a class="card" href="#g-' + esc(g.slug) + '">' +
        '<div class="card__img"><img src="' + esc(g.cover) + '" alt="' + esc(g.name) + '" loading="lazy">' +
        (g === G[0] ? '<span class="card__new">нова</span>' : "") + "</div>" +
        '<div class="card__body"><h2 class="card__name">' + esc(g.name) + "</h2>" +
        '<p class="card__role">' + esc(g.role) + "</p>" +
        '<div class="card__date">' + date(g.date) + "</div></div></a>";
    }).join("") + "</div>";
  }

  function filtered() {
    var q = query.trim().toLowerCase();
    if (!q) return G;
    return G.filter(function (g) { return (g.name + " " + g.role).toLowerCase().indexOf(q) !== -1; });
  }

  function home() {
    document.title = SITE + " — 10 питань людям, що надихають";
    app.innerHTML =
      '<div class="wrap">' +
      '<section class="hero"><h1>10 питань людям, <span class="nowrap">що <span class="mark">надихають' +
      '<svg class="mark__crown"><use href="#crown"/></svg><svg class="mark__line"><use href="#scribble"/></svg></span></span></h1>' +
      "<p>Люди з маркетингової та креативної індустрій України розповідають про книги, звички, рішення і те, що повертає їм енергію.</p></section>" +
      '<div class="toolbar"><div class="count"><b>' + G.length + "</b>" + plural(G.length, "надиханка", "надиханки", "надиханок") + "</div>" +
      '<label class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
      '<input type="search" placeholder="Пошук за іменем або сферою" aria-label="Пошук" value="' + esc(query) + '"></label></div>' +
      '<div id="cards">' + cards(filtered()) + "</div></div>";

    var input = app.querySelector("input");
    input.addEventListener("input", function () {
      query = input.value;
      document.getElementById("cards").innerHTML = cards(filtered());
    });
  }

  function guest(slug, focus) {
    var i = bySlug(slug);
    if (i === -1) return home();
    var g = G[i];
    document.title = g.name + " — " + SITE;

    var toc = Q.map(function (q, n) {
      return '<li><a href="#g-' + esc(g.slug) + "-q" + (n + 1) + '" data-q="' + (n + 1) + '"><span>' + pad(n + 1) + "</span>" + esc(q.short) + "</a></li>";
    }).join("");

    var qa = Q.map(function (q, n) {
      if (!g.answers[n]) return "";
      var others = answered(n).filter(function (o) { return o !== g; });
      return '<article class="qa" id="q' + (n + 1) + '">' +
        '<span class="qa__n">' + pad(n + 1) + "</span>" +
        '<h2 class="qa__q">' + esc(g.asked[n] || q.text) + "</h2>" +
        '<div class="prose">' + g.answers[n] + "</div>" +
        (others.length ? '<a class="others" href="#q-' + (n + 1) + '">' + faces(others) + "Як відповіли інші →</a>" : "") +
        "</article>";
    }).join("");

    var newer = G[i - 1], older = G[i + 1];
    var pager = '<nav class="pager">' +
      (older ? '<a href="#g-' + esc(older.slug) + '"><img src="' + esc(older.cover) + '" alt=""><span><small>← Попередня</small><b>' + esc(older.name) + "</b></span></a>" : "") +
      (newer ? '<a class="next" href="#g-' + esc(newer.slug) + '"><span><small>Наступна →</small><b>' + esc(newer.name) + '</b></span><img src="' + esc(newer.cover) + '" alt=""></a>' : "") +
      "</nav>";

    app.innerHTML =
      '<div class="wrap"><a class="back" href="#guests">← Усі гості</a>' +
      '<div class="guest"><aside class="guest__side">' +
      '<div class="guest__cover"><img src="' + esc(g.cover) + '" alt="' + esc(g.name) + '"></div>' +
      '<h1 class="guest__name">' + esc(g.name) + "</h1>" +
      '<p class="guest__role">' + esc(g.role) + "</p>" +
      '<div class="guest__meta"><span>' + date(g.date) + '</span>' + (g.source ? '<a href="' + esc(g.source) + '" target="_blank" rel="noopener">Оригінал у Telegram ↗</a>' : "") + "</div>" +
      '<ol class="toc">' + toc + "</ol></aside>" +
      "<div>" + (g.intro ? '<div class="intro"><span class="intro__label">чому саме ' + esc(firstName(g)) + "</span>" + g.intro + "</div>" : "") + qa + "</div>" +
      "</div>" + pager + "</div>";

    watchToc();
    if (focus) scrollTo("q" + focus);
  }

  function questions() {
    document.title = "Питання — " + SITE;
    app.innerHTML =
      '<div class="wrap"><header class="page-head"><h1>10 питань</h1>' +
      "<p>Кожному гостю ставимо ті самі питання. Оберіть одне, і побачите відповіді всіх поруч.</p></header>" +
      '<div class="qgrid">' + Q.map(function (q, n) {
        var list = answered(n);
        return '<a class="qtile" href="#q-' + (n + 1) + '"><span class="qtile__n">' + pad(n + 1) + "</span><div>" +
          '<div class="qtile__short">' + esc(q.short) + "</div>" +
          '<div class="qtile__q">' + esc(q.text) + "</div>" +
          '<div class="qtile__foot">' + faces(list) + list.length + " " + plural(list.length, "відповідь", "відповіді", "відповідей") + "</div></div></a>";
      }).join("") + "</div></div>";
  }

  function question(num) {
    var n = num - 1;
    if (!Q[n]) return questions();
    var q = Q[n];
    document.title = q.short + " — " + SITE;

    var tabs = Q.map(function (t, k) {
      return '<a href="#q-' + (k + 1) + '"' + (k === n ? ' class="is-on"' : "") + "><span>" + pad(k + 1) + "</span>" + esc(t.short) + "</a>";
    }).join("");

    var list = answered(n).map(function (g) {
      return '<article class="answer">' +
        '<a class="answer__who" href="#g-' + esc(g.slug) + '"><img src="' + esc(g.cover) + '" alt="" loading="lazy">' +
        "<span><b>" + esc(g.name) + "</b><small>" + esc(g.role) + "</small></span></a>" +
        '<div class="prose">' + g.answers[n] + "</div>" +
        '<a class="answer__link" href="#g-' + esc(g.slug) + '">Читати всю надиханку →</a></article>';
    }).join("");

    var prev = Q[n - 1], next = Q[n + 1];
    app.innerHTML =
      '<div class="wrap"><a class="back" href="#questions">← Усі питання</a>' +
      '<nav class="qtabs" aria-label="Питання">' + tabs + "</nav>" +
      '<header class="qhead"><span class="qhead__n">' + pad(num) + "</span><h1>" + esc(q.text) + "</h1></header>" +
      '<div class="answers">' + list + "</div>" +
      '<nav class="qnav"><span>' + (prev ? '<a href="#q-' + (n) + '">← ' + esc(prev.short) + "</a>" : "") + "</span>" +
      "<span>" + (next ? '<a href="#q-' + (n + 2) + '">' + esc(next.short) + " →</a>" : "") + "</span></nav></div>";

    clampLong();
    var on = app.querySelector(".qtabs .is-on");
    if (on) on.scrollIntoView({ block: "nearest", inline: "center" });
  }

  function about() {
    document.title = "Про рубрику — " + SITE;
    app.innerHTML =
      '<div class="wrap"><header class="page-head"><h1>Про рубрику</h1></header><div class="about">' +
      '<div class="prose"><p>#надиханка — це 10 запитань людям, чиє мислення й дії надихають, про те, що допомагає їм живитися, творити й рухатися далі в українському контексті.</p>' +
      "<p>Тут нема <span class=\"strike\">кейсів і порад з продуктивності</span>. Тут є люди: книги, які їх сформували, дивні звички, рішення, після яких усе змінилося, і те, де вони беруть сили зараз.</p>" +
      "<p>Нова надиханка виходить двічі на місяць, у неділю, в Telegram-каналі <a href=\"https://t.me/creanotes\" target=\"_blank\" rel=\"noopener\">«Нотатки креадира»</a>.</p></div>" +
      "<ol>" + Q.map(function (q, n) {
        return '<li><span>' + pad(n + 1) + '</span><a href="#q-' + (n + 1) + '" style="text-decoration:none">' + esc(q.text) + "</a></li>";
      }).join("") + "</ol>" +
      '<a class="cta" href="https://t.me/creanotes" target="_blank" rel="noopener"><img src="assets/creanotes.jpg" alt="">Читати «Нотатки креадира»</a>' +
      "</div></div>";
  }

  // ---------- поведінка ----------

  function clampLong() {
    app.querySelectorAll(".answer .prose").forEach(function (el) {
      if (el.scrollHeight < 330) return;
      el.classList.add("clamp");
      var btn = document.createElement("button");
      btn.className = "more";
      btn.type = "button";
      btn.textContent = "Читати повністю";
      btn.addEventListener("click", function () {
        var open = el.classList.toggle("clamp");
        btn.textContent = open ? "Читати повністю" : "Згорнути";
      });
      el.after(btn);
    });
  }

  var observer;
  function watchToc() {
    if (observer) observer.disconnect();
    if (!("IntersectionObserver" in window)) return;
    var links = app.querySelectorAll(".toc a");
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var n = e.target.id.slice(1);
        links.forEach(function (a) { a.classList.toggle("is-on", a.getAttribute("data-q") === n); });
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    app.querySelectorAll(".qa").forEach(function (el) { observer.observe(el); });
  }

  function scrollTo(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var go = function () { el.scrollIntoView({ behavior: "instant", block: "start" }); };
    requestAnimationFrame(go);
    // шрифти довантажуються пізніше і зсувають текст — докручуємо ще раз
    if (document.fonts && document.fonts.status !== "loaded") document.fonts.ready.then(go);
  }

  // Адреси — прості #назви, щоб посилання на розділ працювали будь-де:
  // #guests, #g-maksym-lesniak, #g-maksym-lesniak-q3, #questions, #q-3, #about
  var lastPage = "";
  function route() {
    var hash = decodeURIComponent(location.hash.replace(/^#/, ""));
    var m;
    var key = hash.replace(/-q\d+$/, "");
    var samePage = key === lastPage;
    lastPage = key;

    if ((m = hash.match(/^g-(.+?)(?:-q(\d+))?$/))) {
      if (samePage && m[2]) return scrollTo("q" + m[2]);
      guest(m[1], m[2]);
      markNav("guests");
      if (m[2]) return;
    } else if ((m = hash.match(/^q-(\d+)$/))) {
      question(+m[1]);
      markNav("questions");
    } else if (hash === "questions") {
      questions();
      markNav("questions");
    } else if (hash === "about") {
      about();
      markNav("about");
    } else {
      home();
      markNav("guests");
    }
    window.scrollTo(0, 0);
  }

  function markNav(page) {
    document.querySelectorAll("[data-nav]").forEach(function (a) {
      a.classList.toggle("is-on", a.getAttribute("data-nav") === page);
    });
  }

  window.addEventListener("hashchange", route);
  route();
})();
