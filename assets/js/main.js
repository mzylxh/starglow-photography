/* ============================================================
   主交互脚本：加载动画 / 双主题 / 光标 / 视差 / 进场动画 /
   分类图库渲染 / 灯箱
   ============================================================ */
(function () {
  "use strict";

  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var rootEl = document.documentElement;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* ---------- 图片加速：缩略图 srcset + jsDelivr CDN（国内更快），失败回退 GitHub 原图 ---------- */
  var HOSTED = location.hostname.indexOf("github.io") !== -1;
  var CDN = HOSTED ? "https://cdn.jsdelivr.net/gh/mzylxh/starglow-photography@master/" : "";
  var DIRECT = HOSTED ? location.origin + location.pathname : "";
  function url(rel) { return CDN + rel; }
  function directUrl(rel) { return DIRECT + rel; }
  function thumbRel(src, w) {
    return src.replace(/^assets\/photos\//, "assets/photos/thumbs/").replace(/\.jpg$/i, "-" + w + ".jpg");
  }

  /* CDN 优先；图片进入视口后 1 秒没响应就切 GitHub 直连，直连再失败用原图兜底 */
  var FALLBACK_MS = 1000;

  function imageFallback(im, sizes) {
    var rel = "", switched = 0, timer = null;

    function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }
    function setSource(fn) {
      var a = fn(thumbRel(rel, 800)), b = fn(thumbRel(rel, 1400)), c = fn(rel);
      im.sizes = sizes;
      im.src = a;
      im.srcset = a + " 800w, " + b + " 1400w, " + c + " 1920w";
    }
    function arm() {
      if (timer || switched) return;
      timer = setTimeout(function () {
        timer = null;
        if (!im.complete || !im.naturalWidth) { switched = 1; setSource(directUrl); }
      }, FALLBACK_MS);
    }

    im.onload = clearTimer;
    im.onerror = function () {
      clearTimer();
      if (switched === 0) { switched = 1; setSource(directUrl); }
      else if (switched === 1) {
        switched = 2;
        im.removeAttribute("srcset");
        im.removeAttribute("sizes");
        im.src = directUrl(rel);
      }
    };

    return function load(src) {
      rel = src;
      switched = 0;
      clearTimer();
      setSource(url);
      return arm;
    };
  }

  var armObserver = null;
  function armOnVisible(im, arm) {
    if (!window.IntersectionObserver) { arm(); return; }
    if (!armObserver) {
      armObserver = new window.IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          armObserver.unobserve(entry.target);
          if (entry.target.__arm) entry.target.__arm();
        });
      }, { rootMargin: "500px 0px" });
    }
    im.__arm = arm;
    armObserver.observe(im);
  }

  /* ---------- 随机配色（仿 Coolors：空格键 / 导航按钮） ---------- */
  function hsl(h, s, l) {
    return "hsl(" + Math.round(h) + ", " + Math.round(s) + "%, " + Math.round(l) + "%)";
  }
  function hslToRgb(h, s, l) {
    s /= 100; l /= 100;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = l - c / 2;
    var r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }
  function luminance(rgb) {
    var a = rgb.map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function contrastRatio(c1, c2) {
    var l1 = luminance(c1), l2 = luminance(c2);
    var hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }
  var nextDark = null;
  try {
    var darkFlag = localStorage.getItem("ys-palette-dark");
    if (darkFlag !== null) nextDark = darkFlag === "1";
  } catch (e) { /* ignore */ }
  function randomPalette() {
    var attempts = 0;
    while (attempts < 60) {
      attempts++;
      var h = Math.random() * 360;
      var dark = nextDark === null ? Math.random() > 0.5 : nextDark; // 深浅交替
      var sat = 10 + Math.random() * 14;                        // 背景饱和度低，避免刺眼
      var light = dark ? 7 + Math.random() * 8 : 90 + Math.random() * 5;
      var accentH = (h + (Math.random() * 60 - 30) + 360) % 360; // 与背景相近的色相
      var inkL = dark ? 90 : 16;
      var inkDimL = dark ? 66 : 28;
      var inkFaintL = dark ? 42 : 42;
      var accentL = dark ? 56 + Math.random() * 16 : 26 + Math.random() * 8;
      var satAccent = dark ? 50 + Math.random() * 12 : 55 + Math.random() * 15;
      var satMuted = dark ? 22 : 26, lightMuted = dark ? 72 : 30;

      var bg = hslToRgb(h, sat, light);
      var bgSoft = hslToRgb(h, sat, dark ? light + 3 : light - 4);
      var surface = hslToRgb(h, sat, dark ? light + 6 : light - 7);
      var ink = hslToRgb(h, 12, inkL);
      var inkDim = hslToRgb(h, 9, inkDimL);
      var inkFaint = hslToRgb(h, 6, inkFaintL);
      var accent = hslToRgb(accentH, satAccent, accentL);
      var muted = hslToRgb((h + 24) % 360, satMuted, lightMuted);

      /* 背景与文字必须保持足够对比，避免看不清 */
      var ok =
        contrastRatio(ink, bg) >= 4.5 &&
        contrastRatio(ink, bgSoft) >= 4 &&
        contrastRatio(inkDim, bg) >= 3.2 &&
        contrastRatio(inkDim, bgSoft) >= 3 &&
        contrastRatio(inkDim, surface) >= 2.8 &&
        contrastRatio(inkFaint, bg) >= 2.2 &&
        contrastRatio(accent, bg) >= 3 &&
        contrastRatio(accent, bgSoft) >= 2.8 &&
        contrastRatio(muted, bg) >= 3;
      if (!ok) continue;

      var p = {
        "--bg": hsl(h, sat, light),
        "--bg-soft": hsl(h, sat, dark ? light + 3 : light - 4),
        "--surface": hsl(h, sat, dark ? light + 6 : light - 7),
        "--ink": hsl(h, 12, inkL),
        "--ink-dim": hsl(h, 9, inkDimL),
        "--ink-faint": hsl(h, 6, inkFaintL),
        "--accent": hsl(accentH, satAccent, accentL),
        "--muted": hsl((h + 24) % 360, satMuted, lightMuted),
        "--img-bg": hsl(h, sat + 4, dark ? light + 8 : light - 7),
        "--line": dark ? "rgba(240, 240, 240, .13)" : "rgba(25, 25, 30, .16)",
        "--glass": dark ? "rgba(16, 17, 20, .66)" : "rgba(250, 250, 248, .76)"
      };
      for (var key in p) rootEl.style.setProperty(key, p[key]);
      try { localStorage.setItem("ys-palette", JSON.stringify(p)); } catch (e) { /* ignore */ }
      nextDark = !dark;
      try { localStorage.setItem("ys-palette-dark", nextDark ? "1" : "0"); } catch (e) { /* ignore */ }
      return;
    }
    /* 兜底：始终可读的深墨蓝 */
    var fallback = {
      "--bg": "#101216", "--bg-soft": "#161a20", "--surface": "#1d232b",
      "--ink": "#e9e5da", "--ink-dim": "#a9a49a", "--ink-faint": "#63676f",
      "--accent": "#f75253", "--muted": "#b3a8b3", "--img-bg": "#1e2734",
      "--line": "rgba(232, 228, 218, .13)", "--glass": "rgba(16, 18, 22, .66)"
    };
    for (var fk in fallback) rootEl.style.setProperty(fk, fallback[fk]);
    nextDark = !nextDark;
    try { localStorage.setItem("ys-palette", JSON.stringify(fallback)); } catch (e) { /* ignore */ }
    try { localStorage.setItem("ys-palette-dark", nextDark ? "1" : "0"); } catch (e) { /* ignore */ }
  }

  try {
    var savedPalette = localStorage.getItem("ys-palette");
    if (savedPalette) {
      var restored = JSON.parse(savedPalette);
      for (var rk in restored) rootEl.style.setProperty(rk, restored[rk]);
      var bgMatch = /hsl\(([\d.]+), ([\d.]+)%, ([\d.]+)%\)/.exec(restored["--bg"] || "");
      if (bgMatch) {
        nextDark = parseFloat(bgMatch[3]) < 50;
        try { localStorage.setItem("ys-palette-dark", nextDark ? "1" : "0"); } catch (e) { /* ignore */ }
      }
    } else {
      randomPalette();
    }
  } catch (e) {
    randomPalette();
  }

  var paletteBtn = $("#palette-btn");
  if (paletteBtn) paletteBtn.addEventListener("click", randomPalette);

  document.addEventListener("keydown", function (e) {
    if (e.code !== "Space" || e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "BUTTON" || t.isContentEditable)) return;
    e.preventDefault();
    randomPalette();
  });

  /* ---------- 页脚年份 ---------- */
  var yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- 加载动画 ---------- */
  var preloader = $(".preloader");
  function hidePreloader() {
    if (!preloader || preloader.classList.contains("done")) return;
    preloader.classList.add("done");
    document.body.classList.add("loaded");
    setTimeout(function () { if (preloader && preloader.parentNode) preloader.parentNode.removeChild(preloader); }, 1000);
  }
  window.addEventListener("load", function () { setTimeout(hidePreloader, 700); });
  setTimeout(hidePreloader, 3200);

  /* ---------- 头部滚动状态 ---------- */
  var head = $("#site-head");
  function onHeadScroll() {
    if (head) head.classList.toggle("scrolled", window.scrollY > 40);
  }
  window.addEventListener("scroll", onHeadScroll, { passive: true });
  onHeadScroll();

  /* ---------- 文字拆行 ---------- */
  function tokenize(text) {
    return text.split(/\s+/).reduce(function (acc, t) {
      if (/[\u4e00-\u9fff]/.test(t) && t.length > 8) {
        var chunks = t.match(/[^，。！？；：、]+[，。！？；：、]?/g);
        if (chunks) {
          chunks.forEach(function (c) { if (c) acc.push(c); });
          return acc;
        }
      }
      acc.push(t);
      return acc;
    }, []);
  }
  function splitText(el) {
    if (!el || el.dataset.done) return;
    el.dataset.done = "1";
    var words = tokenize(el.textContent.trim());
    el.textContent = "";
    var frag = document.createDocumentFragment();
    words.forEach(function (word, i) {
      var w = document.createElement("span");
      w.className = "w";
      var wi = document.createElement("span");
      wi.className = "wi";
      wi.textContent = word;
      w.appendChild(wi);
      w.style.setProperty("--i", i);
      frag.appendChild(w);
      if (i < words.length - 1) frag.appendChild(document.createTextNode(" "));
    });
    el.appendChild(frag);
  }
  function splitAll(ctx) {
    $$("[data-split]", ctx || document).forEach(splitText);
  }

  /* ---------- 进场动画观察器 ---------- */
  var io = null;
  if (!prefersReduced && "IntersectionObserver" in window) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -7% 0px" });
  }
  function observe(el) {
    if (io) io.observe(el);
    else el.classList.add("in");
  }

  function initReveals(ctx) {
    $$("[data-split], .reveal, .reveal-img, .cat-cover", ctx || document).forEach(observe);
  }

  /* ---------- 视差 ---------- */
  var pxEls = [];
  var ticking = false;
  function collectParallax(ctx) {
    $$("[data-parallax]", ctx || document).forEach(function (el) {
      if (pxEls.indexOf(el) === -1) pxEls.push(el);
    });
  }
  function applyParallax() {
    ticking = false;
    var vh = window.innerHeight;
    pxEls.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      var speed = parseFloat(el.getAttribute("data-parallax")) || 0.2;
      var centerOffset = (r.top + r.height / 2 - vh / 2) * -speed;
      el.style.transform = "translate3d(0, " + centerOffset.toFixed(1) + "px, 0)";
    });
  }
  function onParallaxScroll() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(applyParallax);
    }
  }
  if (!prefersReduced) {
    window.addEventListener("scroll", onParallaxScroll, { passive: true });
    window.addEventListener("resize", onParallaxScroll, { passive: true });
  }

  /* ---------- 自定义光标 ---------- */
  if (!prefersReduced && window.matchMedia("(pointer: fine)").matches) {
    var dot = $(".cursor-dot");
    var ring = $(".cursor-ring");
    if (dot && ring) {
      var mx = window.innerWidth / 2, my = window.innerHeight / 2;
      var rx = mx, ry = my;
      document.addEventListener("mousemove", function (e) {
        mx = e.clientX;
        my = e.clientY;
        dot.style.transform = "translate(" + mx + "px, " + my + "px) translate(-50%, -50%)";
      });
      (function loop() {
        rx += (mx - rx) * 0.16;
        ry += (my - ry) * 0.16;
        ring.style.transform = "translate(" + rx + "px, " + ry + "px) translate(-50%, -50%)";
        window.requestAnimationFrame(loop);
      })();
      document.addEventListener("mouseover", function (e) {
        var t = e.target.closest("a, button, .g-item, .lightbox");
        document.body.classList.toggle("cursor-grow", !!t);
      });
      document.addEventListener("mouseleave", function () { document.body.classList.add("cursor-hide"); });
      document.addEventListener("mouseenter", function () { document.body.classList.remove("cursor-hide"); });
    }
  }

  /* ---------- 灯箱 ---------- */
  var lb = $("#lightbox");
  var lbImg = $("#lb-img");
  var lbTitle = $("#lb-title");
  var lbMeta = $("#lb-meta");
  var lbCount = $("#lb-count");
  var lbItems = [];
  var lbIndex = 0;
  var lbLoad = lbImg ? imageFallback(lbImg, "100vw") : null;

  function lbShow() {
    if (!lb || !lbItems.length) return;
    var item = lbItems[lbIndex];
    if (lbLoad) lbLoad(item.src)();
    lbImg.alt = item.title;
    lbTitle.textContent = "";
    lbMeta.textContent = item.meta || "";
    lbCount.textContent = (lbIndex + 1) + " / " + lbItems.length;
    lb.classList.add("open");
    lb.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function lbHide() {
    if (!lb) return;
    lb.classList.remove("open");
    lb.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  function lbStep(dir) {
    if (!lbItems.length) return;
    lbIndex = (lbIndex + dir + lbItems.length) % lbItems.length;
    lbShow();
  }
  function bindLightbox(scope) {
    var galleries = $$(".gallery", scope || document);
    galleries.forEach(function (gal) {
      var items = [];
      $$(".g-item", gal).forEach(function (item) {
        var src = item.getAttribute("data-src");
        var title = item.getAttribute("data-title");
        var en = item.getAttribute("data-en");
        var meta = item.getAttribute("data-meta");
        items.push({ src: src, title: title, en: en, meta: meta });
        item.addEventListener("click", function () {
          lbItems = items;
          lbIndex = items.length - 1;
          lbStep(1);
        });
      });
    });
  }
  if (lb) {
    $(".lb-close", lb).addEventListener("click", lbHide);
    $(".lb-prev", lb).addEventListener("click", function () { lbStep(-1); });
    $(".lb-next", lb).addEventListener("click", function () { lbStep(1); });
    lb.addEventListener("click", function (e) { if (e.target === lb) lbHide(); });
    document.addEventListener("keydown", function (e) {
      if (!lb.classList.contains("open")) return;
      if (e.key === "Escape") lbHide();
      if (e.key === "ArrowLeft") lbStep(-1);
      if (e.key === "ArrowRight") lbStep(1);
    });
  }

  /* ---------- 分类图库渲染 ---------- */
  function buildGalleryItems(images) {
    var gallery = document.createElement("div");
    gallery.className = "gallery container";
    images.forEach(function (img) {
      var fig = document.createElement("figure");
      fig.className = "g-item reveal";
      fig.setAttribute("data-src", img.src);
      fig.setAttribute("data-title", img.title || "");
      fig.setAttribute("data-en", img.en || "");
      fig.setAttribute("data-meta", img.meta || "");
      fig.tabIndex = 0;
      fig.setAttribute("role", "button");
      fig.setAttribute("aria-label", "查看大图：" + (img.title || img.src));

      var wrap = document.createElement("div");
      wrap.className = "g-media reveal-img";
      wrap.style.setProperty("--ar", img.ratio || "3/2");
      var im = document.createElement("img");
      im.className = "img";
      im.alt = img.title || "";
      im.decoding = "async";
      var armGrid = imageFallback(im, "(max-width: 800px) 92vw, 50vw")(img.src);
      if (/[?&]eager=1/.test(location.search)) { im.loading = "eager"; armGrid(); }
      else { im.loading = "lazy"; armOnVisible(im, armGrid); }
      wrap.appendChild(im);

      var meta = document.createElement("span");
      meta.className = "g-meta";
      meta.textContent = img.meta || "";
      if (!img.meta) meta.style.display = "none";   // 检测不到参数就不显示

      fig.appendChild(wrap);
      fig.appendChild(meta);
      fig.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fig.click(); }
      });
      gallery.appendChild(fig);
    });
    return gallery;
  }

  function renderGallery() {
    var root = $("#gallery-root");
    if (!root || !window.GALLERY) return;

    var frag = document.createDocumentFragment();
    window.GALLERY.forEach(function (cat) {
      var section = document.createElement("section");
      section.className = "category";
      section.id = "cat-" + cat.id;

      var cover = document.createElement("div");
      cover.className = "cat-cover";

      var media = document.createElement("div");
      media.className = "cat-cover-media";
      media.setAttribute("data-parallax", "0.18");
      var coverImg = document.createElement("img");
      var coverPool = cat.images || cat.sub[Math.floor(Math.random() * cat.sub.length)].images;
      var coverSrc = coverPool[Math.floor(Math.random() * coverPool.length)].src;
      coverImg.alt = cat.title + " 分类封面";
      coverImg.decoding = "async";
      coverImg.loading = "lazy";
      armOnVisible(coverImg, imageFallback(coverImg, "100vw")(coverSrc));
      media.appendChild(coverImg);

      var scrim = document.createElement("div");
      scrim.className = "cat-scrim";

      var num = document.createElement("span");
      num.className = "cat-num";
      num.textContent = cat.num;

      var content = document.createElement("div");
      content.className = "cat-content";
      var h2 = document.createElement("h2");
      h2.className = "cat-title";
      h2.setAttribute("data-split", "");
      h2.textContent = cat.title;
      var en = document.createElement("p");
      en.className = "cat-en";
      en.textContent = cat.en;
      var desc = document.createElement("p");
      desc.className = "cat-desc";
      desc.textContent = cat.desc;
      if (!cat.desc) desc.style.display = "none";
      content.appendChild(h2);
      content.appendChild(en);
      content.appendChild(desc);

      cover.appendChild(media);
      cover.appendChild(scrim);
      cover.appendChild(num);
      cover.appendChild(content);
      section.appendChild(cover);

      if (cat.images) {
        section.appendChild(buildGalleryItems(cat.images));
      } else if (cat.sub) {
        cat.sub.forEach(function (sub, si) {
          var group = document.createElement("div");
          group.className = "sub-group";
          group.id = "cat-" + cat.id + "-" + sub.id;

          var head = document.createElement("div");
          head.className = "sub-head reveal";
          var label = document.createElement("span");
          label.className = "sub-label";
          label.textContent = String(si + 1).padStart(2, "0");
          var h3 = document.createElement("h3");
          h3.textContent = sub.title;
          head.appendChild(label);
          head.appendChild(h3);

          group.appendChild(head);
          group.appendChild(buildGalleryItems(sub.images));
          section.appendChild(group);
        });
      }
      frag.appendChild(section);
    });
    root.appendChild(frag);
  }

  /* ---------- Photographs 悬停分类子菜单 ---------- */
  function scrollToId(id) {
    var el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
  }

  function initNav() {
    var navItem = $("#nav-photographs");
    var navLink = $("#nav-photographs-link");
    var navSub = $("#nav-sub");
    if (!navItem || !navSub || !window.GALLERY) return;

    var isIndex = location.pathname === "/" || /index\.html?$/.test(location.pathname);
    var frag = document.createDocumentFragment();
    var isMobile = function () { return window.matchMedia("(max-width: 900px)").matches; };

    window.GALLERY.forEach(function (cat) {
      var base = isIndex ? "" : "index.html";
      var makeLink = function (href, label, numText, onClick) {
        var a = document.createElement("a");
        a.href = base + href;
        a.setAttribute("role", "menuitem");
        var zh = document.createElement("span");
        zh.textContent = label;
        a.appendChild(zh);
        if (numText) {
          var num = document.createElement("span");
          num.className = "sub-num";
          num.textContent = numText;
          a.appendChild(num);
        }
        a.addEventListener("click", function (e) {
          if (isIndex && onClick) {
            e.preventDefault();
            onClick();
          }
          navItem.classList.remove("open");
        });
        return a;
      };

      if (cat.sub) {
        var group = document.createElement("span");
        group.className = "nav-group";
        var ga = makeLink("#cat-" + cat.id, cat.title, cat.num, function () {
          scrollToId("cat-" + cat.id);
        });
        ga.addEventListener("click", function (e) {
          if (isMobile()) {
            e.preventDefault();
            group.classList.toggle("open");
          }
        });
        group.appendChild(ga);

        var sub2 = document.createElement("span");
        sub2.className = "nav-sub-2";
        cat.sub.forEach(function (sub) {
          sub2.appendChild(makeLink("#cat-" + cat.id + "-" + sub.id, sub.title, "", function () {
            scrollToId("cat-" + cat.id + "-" + sub.id);
          }));
        });
        group.appendChild(sub2);
        frag.appendChild(group);
      } else {
        frag.appendChild(makeLink("#cat-" + cat.id, cat.title, cat.num, function () {
          scrollToId("cat-" + cat.id);
        }));
      }
    });
    navSub.appendChild(frag);

    if (navLink) {
      navLink.addEventListener("click", function (e) {
        if (isMobile()) {
          e.preventDefault();
          navItem.classList.toggle("open");
        }
      });
    }
    document.addEventListener("click", function (e) {
      if (!navItem.contains(e.target)) navItem.classList.remove("open");
    });

    /* 滚动时高亮当前分类 */
    if (isIndex && "IntersectionObserver" in window) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var id = entry.target.id.replace("cat-", "");
          $$("a", navSub).forEach(function (a) {
            var hash = (a.getAttribute("href") || "").split("#")[1] || "";
            a.classList.toggle("is-active", hash === "cat-" + id);
          });
        });
      }, { rootMargin: "-35% 0px -55% 0px" });
      window.GALLERY.forEach(function (cat) {
        var el = document.getElementById("cat-" + cat.id);
        if (el) spy.observe(el);
        if (cat.sub) {
          cat.sub.forEach(function (sub) {
            var el2 = document.getElementById("cat-" + cat.id + "-" + sub.id);
            if (el2) spy.observe(el2);
          });
        }
      });
    }
  }

  /* ---------- 初始化 ---------- */
  function init() {
    renderGallery();
    initNav();

    splitAll();
    initReveals();
    collectParallax();
    bindLightbox();

    /* 动态内容里的拆行与观察 */
    $$(".cat-cover .cat-title").forEach(splitText);
    $$(".cat-cover").forEach(observe);
    $$("#gallery-root .g-item").forEach(observe);
    $$("#gallery-root .g-media").forEach(observe);

    if (prefersReduced) applyParallax();
    else onParallaxScroll();

    /* 开发自检：横向溢出提醒 */
    if (document.documentElement.scrollWidth > window.innerWidth + 1) {
      console.warn("[layout] horizontal overflow: " + document.documentElement.scrollWidth + " vs " + window.innerWidth);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
