(function () {
  "use strict";

  var DATA = window.NADYHANKY || { questions: [], guests: [] };
  // На сервері сторінка гостя живе за адресою /g/<slug>/ (див. route), тож відносні
  // шляхи до картинок треба рахувати від кореня сайту. Локально (file://) лишаємо як є.
  var WEB = /^https?:$/.test(location.protocol);
  if (WEB) (DATA.guests || []).forEach(function (g) {
    if (g.cover && !/^(\/|https?:)/.test(g.cover)) g.cover = "/" + g.cover;
  });
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

  var ME_COMPANIES = [
    { name: "Arriba!", url: "https://arriba.com.ua/", link: "Сайт агенції",
      text: "ТОП-10 найтитулованіших агенцій за версією Forbes Ukraine. Друга за визнанням креативна агенція України за результатами міжнародних фестивалів. Проєкти, відзначені Cannes Lions, Clio Awards, Eurobest, New York Festivals, One Show, Epica, Effie, KIAF, ADC*E та іншими." },
    { name: "Hotspot School of English", url: "https://www.hotspot.school/", link: "Сайт школи",
      text: "Школа для амбітних спеціалістів, які використовують англійську як інструмент для кар'єрних і бізнесових цілей." },
    { name: "Волонтерська", url: "https://volonterska.com.ua/", link: "Сайт фонду",
      text: "Міжнародно визнаний благодійний фонд із Харкова, який допомагає мешканцям Харківщини та військовим, що захищають Україну." },
    { name: "Багаж", url: "https://baggage.school/", link: "Сайт школи",
      text: "Перша в Україні школа маркетингу й комунікацій, що випустила понад 2500 студентів. Офіційний партнер Києво-Могилянської бізнес-школи." },
    { name: "Лавка деокупації", url: "https://www.instagram.com/lavka_deokupatsii", link: "Instagram проєкту",
      text: "Проєкт підтримки фермерів із деокупованих територій Харківщини. Ми надаємо їм насіння, інвентар, теплиці та організовуємо логістику й збут. Вони вирощують — ми продаємо. Головна мета — економічна незалежність і відновлення маленьких сільських господарств. Двічі потрапляли в довгий список Премії відповідальності імені Богдана Гаврилишина." },
    { name: "Благовіщенський курінь", url: "https://www.instagram.com/blagokurin/", link: "Instagram кафе",
      text: "Перше благодійне кафе польової козацької кухні в Харкові, створене засновниками стихійного ресторану «Трипіччя», благодійного фонду «Волонтерська» та харківського Літературного музею. Фіналісти премії «Сіль» 2026." }
  ];
  // Іконки: Font Awesome Free (CC BY 4.0), https://fontawesome.com/license/free
  var ME_SOCIALS = [
    ["Telegram-канал «Нотатки креадира»", "https://t.me/creanotes", "0 0 448 512", "M446.7 98.6l-67.6 318.8c-5.1 22.5-18.4 28.1-37.3 17.5l-103-75.9-49.7 47.8c-5.5 5.5-10.1 10.1-20.7 10.1l7.4-104.9 190.9-172.5c8.3-7.4-1.8-11.5-12.9-4.1L117.8 284 16.2 252.2c-22.1-6.9-22.5-22.1 4.6-32.7L418.2 66.4c18.4-6.9 34.5 4.1 28.5 32.2z"],
    ["LinkedIn", "https://www.linkedin.com/in/mcsimba/", "0 0 448 512", "M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z"],
    ["Facebook", "https://www.facebook.com/mburtsev", "0 0 320 512", "M80 299.3V512H196V299.3h86.5l18-97.8H196V166.9c0-51.7 20.3-71.5 72.7-71.5c16.3 0 29.4 .4 37 1.2V7.9C291.4 4 256.4 0 236.2 0C129.3 0 80 50.5 80 159.4v42.1H14v97.8H80z"],
    ["Instagram", "https://instagram.com/mcsimba", "0 0 448 512", "M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z"]
  ];

  function me() {
    document.title = "Про мене — " + SITE;
    app.innerHTML =
      '<div class="wrap"><div class="me">' +
      '<div class="me__top"><div>' +
      '<header class="me__head"><span class="me__hi">Привіт!</span><h1>Мене звати Макс Бурцев</h1></header>' +
      '<div class="prose me__intro">' +
      '<p>Ніколи не любив розповідати про себе. Але якось без цього розділу сайт виглядає дивно. Тому стисло: молодий батько, серійний підприємець, стратег, креативний директор, волонтер, автор каналу <a href="https://t.me/creanotes" target="_blank" rel="noopener">«Нотатки креадира»</a>.</p>' +
      "<p>Понад 20 років працюю на перетині бізнесу, стратегії та креативності. Створюю компанії, бренди, продукти та ініціативи. Найбільше люблю ставити під сумнів усталені підходи й знаходити неочевидні рішення складних питань.</p>" +
      "<p>Моя основна діяльність — розвиток власних компаній, де ви отримаєте більше користі, адже в кожній працюють команди спеціалістів, які дадуть мені фору в багатьох питаннях. Якщо ж вас цікавить співпраця саме зі мною — напишіть мені в <a href=\"https://t.me/mcsimba\" target=\"_blank\" rel=\"noopener\">Telegram</a>.</p></div></div>" +
      '<figure class="me__photo"><img src="assets/max-burtsev-photo.jpg" alt="Макс Бурцев" width="720" height="900"></figure></div>' +
      '<h2 class="me__h2">Компанії та проєкти</h2>' +
      '<div class="me__grid">' + ME_COMPANIES.map(function (c) {
        return '<a class="co" href="' + c.url + '" target="_blank" rel="noopener"><h3>' + esc(c.name) + "</h3><p>" + esc(c.text) + '</p><span class="co__link">' + esc(c.link) + " →</span></a>";
      }).join("") + "</div>" +
      '<section class="me__contact"><h2 class="me__h2">Контакти</h2>' +
      "<p>Через поїздки й зустрічі можу відповідати не надто оперативно, але відповідаю завжди.</p>" +
      '<a class="cta" href="https://t.me/mcsimba" target="_blank" rel="noopener"><img src="assets/max-burtsev.jpg" alt="">Написати в Telegram</a>' +
      '<nav class="me__social" aria-label="Соцмережі">' + ME_SOCIALS.map(function (s) {
        return '<a href="' + s[1] + '" target="_blank" rel="noopener" aria-label="' + esc(s[0]) + '" title="' + esc(s[0]) + '"><svg viewBox="' + s[2] + '" aria-hidden="true"><path d="' + s[3] + '"/></svg></a>';
      }).join("") + "</nav></section>" +
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
  // #guests, #g-maksym-lesniak, #g-maksym-lesniak-q3, #questions, #q-3, #about, #me
  var lastPage = "";
  // Сторінка гостя має «справжню» адресу /g/<slug>/ — саме її копіюють і шерять.
  // За цією адресою лежить згенерована сторінка з прев'ю (обкладинка, ім'я) для
  // Telegram і соцмереж, яка одразу відкриває сайт на #g-<slug>.
  function route() {
    var hash = decodeURIComponent(location.hash.replace(/^#/, ""));
    var pm = location.pathname.match(/^\/g\/([^\/]+)\/?$/);
    if (pm && (!hash || /^q\d+$/.test(hash))) hash = "g-" + pm[1] + (hash ? "-" + hash : "");
    var m;
    if (WEB) {
      var gm = hash.match(/^g-(.+?)(?:-q(\d+))?$/);
      var want = gm ? "/g/" + gm[1] + "/" + (gm[2] ? "#q" + gm[2] : "") : "/" + (hash ? "#" + hash : "");
      want = want.replace(/(#|$)/, location.search + "$1"); // зберігаємо ?utm_… тощо
      if (location.pathname + location.search + location.hash !== want) history.replaceState(null, "", want);
    }
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
    } else if (hash === "me") {
      me();
      markNav("me");
    } else {
      home();
      markNav("guests");
    }
    window.scrollTo(0, 0);
  }

  function markNav(page) {
    // футер про рубрику не потрібен на особистій сторінці
    document.body.classList.toggle("page-me", page === "me");
    document.querySelectorAll("[data-nav]").forEach(function (a) {
      a.classList.toggle("is-on", a.getAttribute("data-nav") === page);
    });
  }

  // popstate спрацьовує і на зміну #, і на «Назад» між /g/<slug>/ та головною
  window.addEventListener("popstate", route);
  route();
})();
