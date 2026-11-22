(async function () {
  "use strict";

  /* ---------- Navbar Mobile (Hamburger Menu) ---------- */
  var header = document.querySelector(".site-header");
  var hamburger = document.querySelector(".hamburger");
  var menuPanel = document.querySelector(".menu-panel");

  if (header && hamburger && menuPanel) {
    var bukaMenu = function () {
      header.classList.add("is-open");
      hamburger.setAttribute("aria-expanded", "true");
      hamburger.setAttribute("aria-label", "Tutup menu navigasi");
    };

    var tutupMenu = function () {
      header.classList.remove("is-open");
      hamburger.setAttribute("aria-expanded", "false");
      hamburger.setAttribute("aria-label", "Buka menu navigasi");
    };

    hamburger.addEventListener("click", function (e) {
      e.stopPropagation();
      if (header.classList.contains("is-open")) tutupMenu();
      else bukaMenu();
    });

    menuPanel.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", tutupMenu);
    });

    document.addEventListener("click", function (e) {
      if (header.classList.contains("is-open") && !header.contains(e.target)) {
        tutupMenu();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && header.classList.contains("is-open")) {
        tutupMenu();
        hamburger.focus();
      }
    });
  }

  var body = document.body;

  /* ---------- Efek Grid Background Mengikuti Kursor ---------- */
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    var rafGrid = null;
    var posX = -500;
    var posY = -500;

    document.addEventListener("mousemove", function (e) {
      posX = e.clientX;
      posY = e.clientY;
      if (!body.classList.contains("cursor-active")) {
        body.classList.add("cursor-active");
      }
      if (!rafGrid) {
        rafGrid = requestAnimationFrame(function () {
          body.style.setProperty("--mx", posX + "px");
          body.style.setProperty("--my", posY + "px");
          rafGrid = null;
        });
      }
    }, { passive: true });

    document.addEventListener("mouseleave", function () {
      body.classList.remove("cursor-active");
    });
  }

  var root = body.dataset.root || "";       // "" (root) atau "../" (folder catatan)
  var halaman = body.dataset.page;          // index | kategori | baca | penulis
  var PER_HALAMAN = 9;
  var EXCERPT = 210;
  var PANAH_KIRI = '<svg width="14" height="22" viewBox="0 0 14 22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="11,2 3,11 11,20"/></svg>';
  var PANAH_KANAN = '<svg width="14" height="22" viewBox="0 0 14 22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="3,2 11,11 3,20"/></svg>';
  var BULAN = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  var input = document.getElementById("cari");
  var wadah = document.getElementById("konten");
  var pager = document.getElementById("pager");
  var deckStorageKey = "deck_idx_" + location.pathname;
  var idPenulis = halaman === "penulis" ? new URLSearchParams(location.search).get("id") || "" : "";

  /* ---------- Ambil data dari Supabase ---------- */
  var D;
  if (idPenulis) {
    var hasilPenulis = await db.from("penulis").select("*").eq("id", idPenulis).maybeSingle();
    if (hasilPenulis.error) {
      wadah.innerHTML = '<p class="kosong">Gagal memuat data.</p>';
      return;
    }
    if (!hasilPenulis.data) {
      D = { tulisan: [], penulis: [] };
    } else {
      var hasilKarya = await db.from("tulisan").select("*")
        .eq("penulis", hasilPenulis.data.nama).order("dibuat", { ascending: false });
      if (hasilKarya.error) {
        wadah.innerHTML = '<p class="kosong">Gagal memuat data.</p>';
        return;
      }
      D = { tulisan: hasilKarya.data, penulis: [hasilPenulis.data] };
    }
  } else {
    var hasilDb = await Promise.all([
      db.from("tulisan").select("*").order("dibuat", { ascending: false }),
      db.from("penulis").select("*").order("nama")
    ]);
    if (hasilDb[0].error || hasilDb[1].error) {
      wadah.innerHTML = '<p class="kosong">Gagal memuat data.</p>';
      return;
    }
    D = { tulisan: hasilDb[0].data, penulis: hasilDb[1].data };
  }

  /* ---------- Util ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function formatTanggalHtml(tglStr) {
    if (!tglStr) return "";
    var p = String(tglStr).split("-");
    if (p.length !== 3) return esc(tglStr);
    var hari = parseInt(p[2], 10);
    var bulan = BULAN[parseInt(p[1], 10) - 1] || "";
    var tahun = p[0];
    return hari + " <em>" + bulan + "</em> " + tahun;
  }
  function bersihkanTag(teks) {
    return String(teks || "")
      .replace(/\[gaya:[^\]]*\]/gi, " ")
      .replace(/\[foto:[^\]]*\]/gi, " ")
      .replace(/\[fn:[^\]]*\]/gi, "")
      .replace(/\[\/?(?:font|size|leading)(?::[^\]]*)?\]/gi, "")
      .replace(/\[spasi\]/gi, " ")
      .replace(/\*{1,2}([^*]+?)\*{1,2}/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }
  function excerpt(teks) {
    var t = bersihkanTag(teks);
    if (t.length <= EXCERPT) return t;
    return t.slice(0, EXCERPT).replace(/\s+\S*$/, "") + "...";
  }
  function teksPolosDeck(isi) {
    var teks = Array.isArray(isi) ? isi.join(" ") : String(isi || "");
    return bersihkanTag(teks.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
  }
  function excerptKartu(isi) {
    var teks = teksPolosDeck(isi);
    if (teks.length <= 110) return teks;
    return teks.slice(0, 110).replace(/\s+\S*$/, "") + "...";
  }
  function url(t) { return root + "baca.html?id=" + encodeURIComponent(t.id); }
  function cocok(t, q) {
    if (!q) return true;
    var hay = (t.judul + " " + t.penulis + " " + t.label + " " + bersihkanTag(t.isi.join(" "))).toLowerCase();
    return q.toLowerCase().split(/\s+/).every(function (k) { return hay.indexOf(k) !== -1; });
  }
  function param(nama) { return new URLSearchParams(location.search).get(nama) || ""; }

  /* ---------- Render Isi Bacaan (Format Teks, Puisi, Foto Riset & Footnote) ---------- */
  function renderIsiBaca(daftarParagraf) {
    var catatanKaki = [];
    var tagAktif = [];

    function prosesFormatTeks(str) {
      var token = /(\[fn:\s*([\s\S]*?)\])|(\[(font:(?:garamond|palatino|sans)|size:\d{2}|leading:\d+(?:\.\d+)?)\])|(\[\/(font|size|leading)\])|(\*\*([^*]+?)\*\*)|(\*([^*]+?)\*)/g;
      var tokens = [];
      var lastIdx = 0;
      var m;
      while ((m = token.exec(str)) !== null) {
        if (m.index > lastIdx) tokens.push({ type: "text", value: str.slice(lastIdx, m.index) });
        if (m[1]) {
          tokens.push({ type: "footnote", raw: m[1], value: m[2] });
        } else if (m[3]) {
          tokens.push({ type: "open", raw: m[3], value: m[4] });
        } else if (m[5]) {
          tokens.push({ type: "close", raw: m[5], value: m[6] });
        } else if (m[7]) {
          tokens.push({ type: "bold", value: m[8] });
        } else if (m[9]) {
          tokens.push({ type: "italic", value: m[10] });
        }
        lastIdx = token.lastIndex;
      }
      if (lastIdx < str.length) tokens.push({ type: "text", value: str.slice(lastIdx) });

      var index = 0;
      function parse(endingTag) {
        var html = "";
        while (index < tokens.length) {
          var current = tokens[index++];
          if (current.type === "close") {
            if (current.value === endingTag) return { html: html, closed: true };
            html += esc(current.raw);
          } else if (current.type === "open") {
            var inner = parse(current.value.split(":")[0]);
            if (!inner.closed) {
              html += esc(current.raw) + inner.html;
            } else if (current.value.indexOf("font:") === 0) {
              var kelas = current.value === "font:garamond" ? "teks-garamond" :
                current.value === "font:palatino" ? "teks-palatino" : "teks-sans";
              html += '<span class="' + kelas + '">' + inner.html + "</span>";
            } else if (current.value.indexOf("size:") === 0) {
              html += '<span style="font-size:' + esc(current.value.slice(5)) + 'px">' + inner.html + "</span>";
            } else {
              var leading = parseFloat(current.value.slice(8));
              html += leading >= 0.7 && leading <= 3
                ? '<span class="teks-leading" style="line-height:' + leading + '">' + inner.html + "</span>"
                : inner.html;
            }
          } else if (current.type === "footnote") {
            var note = current.value.trim();
            if (note) {
              catatanKaki.push(note);
              var nomor = catatanKaki.length;
              html += '<sup class="fn-ref"><a href="#fn-' + nomor + '" id="ref-' + nomor + '">[' + nomor + ']</a></sup>';
            }
          } else if (current.type === "bold") {
            html += "<strong>" + prosesFormatTeks(current.value) + "</strong>";
          } else if (current.type === "italic") {
            html += "<em>" + prosesFormatTeks(current.value) + "</em>";
          } else {
            html += esc(current.value);
          }
        }
        return { html: html, closed: false };
      }

      return parse(null).html;
    }

    function normalisasiTagInline(str) {
      var pembuka = tagAktif.map(function (tag) { return tag.buka; }).join("");
      var stack = tagAktif.slice();
      var re = /\[(font:(?:garamond|palatino|sans)|size:\d{2}|leading:\d+(?:\.\d+)?)\]|\[\/(font|size|leading)\]/g;
      var m;
      while ((m = re.exec(str)) !== null) {
        if (m[1]) {
          stack.push({ nama: m[1].split(":")[0], buka: "[" + m[1] + "]" });
        } else if (stack.length && stack[stack.length - 1].nama === m[2]) {
          stack.pop();
        }
      }
      tagAktif = stack;
      var penutup = tagAktif.slice().reverse().map(function (tag) {
        return "[/" + tag.nama + "]";
      }).join("");
      return pembuka + str + penutup;
    }

    var blokHtml = daftarParagraf.map(function (p) {
      if (p.trim() === "[spasi]") {
        return '<div class="baca-jeda-bait" aria-hidden="true"></div>';
      }

      var mFoto = p.match(/^\[foto:\s*([^|\]]+?)(?:\s*\|\s*(tengah|penuh))?(?:\s*\|\s*([^\]]*))?\]$/i);
      if (mFoto) {
        var src = mFoto[1].trim();
        var tata = (mFoto[2] || "tengah").toLowerCase();
        var caption = (mFoto[3] || "").trim();
        return '<figure class="baca-foto baca-foto--' + tata + '">' +
               '<img src="' + esc(src) + '" alt="' + esc(caption || "Ilustrasi tulisan") + '" loading="lazy">' +
               (caption ? "<figcaption>" + prosesFormatTeks(caption) + "</figcaption>" : "") +
               "</figure>";
      }

      var meta = {};
      var isiBlok = p;
      var mGaya = p.match(/^\[gaya:\s*([^\]]+)\]\n([\s\S]*)$/);
      if (mGaya) {
        mGaya[1].split(";").forEach(function (bag) {
          var kv = bag.split(":");
          if (kv.length === 2) meta[kv[0].trim()] = kv[1].trim();
        });
        isiBlok = mGaya[2];
      }

      var kelasList = [];
      var styleList = [];
      if (meta.align === "tengah") kelasList.push("rata-tengah");
      else if (meta.align === "kanan") kelasList.push("rata-kanan");
      else if (meta.align === "justify") kelasList.push("rata-justify");

      if (meta.font === "garamond") kelasList.push("teks-garamond");
      else if (meta.font === "palatino") kelasList.push("teks-palatino");
      else if (meta.font === "sans") kelasList.push("teks-sans");

      if (meta.size && /^\d{2}$/.test(meta.size)) {
        styleList.push("font-size:" + meta.size + "px");
      }
      if (meta.leading && /^\d+(?:\.\d+)?$/.test(meta.leading)) {
        var leadingBlok = parseFloat(meta.leading);
        if (leadingBlok >= 0.7 && leadingBlok <= 3) styleList.push("line-height:" + leadingBlok);
      }

      var attrClass = kelasList.length ? ' class="' + kelasList.join(" ") + '"' : "";
      var attrStyle = styleList.length ? ' style="' + styleList.join(";") + '"' : "";

      var barisArr = isiBlok.split("\n");
      var semuaOl = barisArr.length > 0 && barisArr.every(function (b) { return /^\s*\d+\.\s+/.test(b); });
      var semuaUl = barisArr.length > 0 && barisArr.every(function (b) { return /^\s*-\s+/.test(b); });

      if (semuaOl) {
        return "<ol" + attrClass + attrStyle + ">" + barisArr.map(function (b) {
          return "<li>" + prosesFormatTeks(normalisasiTagInline(b.replace(/^\s*\d+\.\s+/, ""))) + "</li>";
        }).join("") + "</ol>";
      }
      if (semuaUl) {
        return "<ul" + attrClass + attrStyle + ">" + barisArr.map(function (b) {
          return "<li>" + prosesFormatTeks(normalisasiTagInline(b.replace(/^\s*-\s+/, ""))) + "</li>";
        }).join("") + "</ul>";
      }

      return "<p" + attrClass + attrStyle + ">" + prosesFormatTeks(normalisasiTagInline(isiBlok)) + "</p>";
    }).join("");

    if (catatanKaki.length) {
      blokHtml += '<section class="baca-footnote" aria-label="Catatan kaki"><ol>' +
        catatanKaki.map(function (fn, idx) {
          var n = idx + 1;
          return '<li id="fn-' + n + '">' + prosesFormatTeks(fn) + ' <a href="#ref-' + n + '" class="fn-balik" aria-label="Kembali ke teks">&#8617;</a></li>';
        }).join("") +
        "</ol></section>";
    }

    return blokHtml;
  }

  /* ---------- Beranda ---------- */
  var deckGesture = null;
  var isAnimating = false;
  var deckAnimationTimer = null;
  var deckBackgroundTimer = null;
  var suppressDeckClickCard = null;
  var deckData = [];
  var currentIndex = 0;
  var deckLoop = true;

  function resetDeckInteraction() {
    if (deckAnimationTimer !== null) window.clearTimeout(deckAnimationTimer);
    if (deckBackgroundTimer !== null) window.clearTimeout(deckBackgroundTimer);
    deckAnimationTimer = null;
    deckBackgroundTimer = null;
    deckGesture = null;
    isAnimating = false;
    suppressDeckClickCard = null;
    deckData = [];
    currentIndex = 0;
  }

  function simpanIndeksDeck(index) {
    window.sessionStorage.setItem(deckStorageKey, String(index));
  }

  function ambilIndeksDeck(total) {
    if (!window.matchMedia("(max-width: 768px)").matches || !total) return 0;
    var index = parseInt(window.sessionStorage.getItem(deckStorageKey), 10);
    return Number.isFinite(index) && index >= 0 ? index % total : 0;
  }

  function teksLatarDeck(hasil, indexAktif) {
    if (!hasil.length) return "";
    var targetPanjang = Math.max(1200, (window.innerHeight || 768) * 2);
    var teks = "";
    for (var i = 0; i < hasil.length && teks.length < targetPanjang; i++) {
      var bagian = teksPolosDeck(hasil[(indexAktif + i) % hasil.length].isi);
      if (bagian) teks += (teks ? " " : "") + bagian;
    }
    if (!teks) teks = String(hasil[indexAktif].judul || "");
    var isiLatar = teks;
    while (isiLatar.length < targetPanjang && teks) isiLatar += " " + teks;
    return isiLatar;
  }

  function perbaruiTeksLatar(list) {
    var latar = list.parentNode && list.parentNode.querySelector(".deck-bg-text");
    if (!latar) return;
    if (deckBackgroundTimer !== null) window.clearTimeout(deckBackgroundTimer);
    deckBackgroundTimer = null;
    if (latar.classList.contains("is-refracting")) {
      latar.textContent = teksLatarDeck(deckData, currentIndex);
      latar.classList.add("is-visible");
      return;
    }
    latar.classList.remove("is-visible");
    deckBackgroundTimer = window.setTimeout(function () {
      deckBackgroundTimer = null;
      if (!latar.parentNode) return;
      latar.textContent = teksLatarDeck(deckData, currentIndex);
      latar.classList.add("is-visible");
    }, 160);
  }

  function setelRefraksiLatar(list, aktif, shift) {
    var latar = list.parentNode && list.parentNode.querySelector(".deck-bg-text");
    if (!latar) return;
    if (aktif) {
      latar.style.setProperty("--bg-shift", Math.max(-8, Math.min(8, shift)) + "px");
      latar.classList.add("is-refracting");
    } else {
      latar.classList.remove("is-refracting");
      latar.style.setProperty("--bg-shift", "0px");
    }
  }

  function renderDaftarKartu(hasil) {
    deckData = hasil;
    currentIndex = ambilIndeksDeck(hasil.length);
    var urutan = hasil.slice(currentIndex).concat(hasil.slice(0, currentIndex));
    var teksLatar = esc(teksLatarDeck(hasil, currentIndex));
    var daftar = '<ul class="daftar daftar-kartu" data-current="' + (currentIndex + 1) +
      '" data-active-index="' + currentIndex + '">' + urutan.map(function (t, index) {
      var tanggal = formatTanggalHtml(t.tanggal);
      var indexTulisan = (currentIndex + index) % hasil.length;
      return '<li data-deck-index="' + indexTulisan + '"><a href="' + url(t) + '"><span class="label">' + esc(t.label) + ": " + esc(t.penulis) +
        '</span><span class="judul-garis">' + esc(t.judul) + '</span><span class="kartu-excerpt">' +
        esc(excerptKartu(t.isi)) + '</span>' +
        (tanggal ? '<time class="kartu-tanggal" datetime="' + esc(t.tanggal) + '">' + tanggal + "</time>" : "") +
        "</a></li>";
    }).join("") + "</ul>";
    var navigasiBackNonaktif = hasil.length <= 1 || (!deckLoop && currentIndex === 0) ? " disabled" : "";
    var navigasiNextNonaktif = hasil.length <= 1 || (!deckLoop && currentIndex === hasil.length - 1) ? " disabled" : "";
    var navigasi = '<div class="deck-controls">' +
      '<button class="deck-control deck-control-back" type="button" aria-label="Tulisan sebelumnya"' + navigasiBackNonaktif + '>' +
      '<svg width="14" height="22" viewBox="0 0 14 22" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><polyline points="11,2 3,11 11,20"/></svg>' +
      "</button>" +
      '<p class="deck-counter" aria-live="polite">' + (currentIndex + 1) + " / " + hasil.length + "</p>" +
      '<button class="deck-control deck-control-next" type="button" aria-label="Tulisan berikutnya"' + navigasiNextNonaktif + '>' +
      '<svg width="14" height="22" viewBox="0 0 14 22" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><polyline points="3,2 11,11 3,20"/></svg>' +
      "</button></div>";
    return '<div class="deck-bg-text is-visible" aria-hidden="true">' + teksLatar + "</div>" +
      daftar + navigasi;
  }

  function perbaruiNavigasiDeck(list) {
    var total = deckData.length;
    var counter = list.parentNode.querySelector(".deck-counter");
    if (counter) counter.textContent = (currentIndex + 1) + " / " + total;
    var back = list.parentNode.querySelector(".deck-control-back");
    var next = list.parentNode.querySelector(".deck-control-next");
    if (back) back.disabled = total <= 1 || (!deckLoop && currentIndex === 0);
    if (next) next.disabled = total <= 1 || (!deckLoop && currentIndex === total - 1);
  }

  function pindahkanKartu(list, card, langkah, refraksiAnimasi) {
    if (isAnimating || !card || !card.parentNode || deckData.length <= 1) return;
    var activeCard = list.firstElementChild;
    if (card !== activeCard) return;
    var total = deckData.length;
    var indexBerikutnya = currentIndex + langkah;
    if (deckLoop) indexBerikutnya = (indexBerikutnya + total) % total;
    else indexBerikutnya = Math.max(0, Math.min(indexBerikutnya, total - 1));
    if (indexBerikutnya === currentIndex) return;

    isAnimating = true;
    if (refraksiAnimasi) setelRefraksiLatar(list, true, langkah > 0 ? 4 : -4);
    if (activeCard.classList.contains("is-dragging")) {
      activeCard.style.transition = "transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s ease";
      activeCard.style.removeProperty("--glare-x");
      activeCard.classList.remove("is-dragging");
      if (langkah < 0) {
        activeCard.style.transform = "";
        activeCard.style.opacity = "";
      }
    }
    var incomingCard;
    if (langkah > 0) {
      incomingCard = activeCard.nextElementSibling;
      if (!incomingCard) {
        isAnimating = false;
        if (refraksiAnimasi) setelRefraksiLatar(list, false, 0);
        return;
      }
      activeCard.classList.add("is-exiting-next");
      incomingCard.classList.add("is-entering-next");
    } else {
      incomingCard = list.lastElementChild;
      if (!incomingCard || incomingCard === activeCard) {
        isAnimating = false;
        if (refraksiAnimasi) setelRefraksiLatar(list, false, 0);
        return;
      }
      list.insertBefore(incomingCard, activeCard);
      incomingCard.classList.add("is-entering-back", "is-entering-from-left");
      void incomingCard.offsetWidth;
      incomingCard.classList.remove("is-entering-from-left");
    }

    deckAnimationTimer = window.setTimeout(function () {
      deckAnimationTimer = null;
      if (activeCard.parentNode === list && list.parentNode) {
        if (langkah > 0) {
          list.appendChild(activeCard);
          activeCard.classList.remove("is-exiting-next", "is-dragging");
          activeCard.removeAttribute("style");
          incomingCard.classList.remove("is-entering-next");
        } else {
          incomingCard.classList.remove("is-entering-back", "is-entering-from-left");
          activeCard.removeAttribute("style");
        }
        currentIndex = indexBerikutnya;
        list.dataset.activeIndex = String(currentIndex);
        list.dataset.current = String(currentIndex + 1);
        perbaruiNavigasiDeck(list);
        simpanIndeksDeck(currentIndex);
        perbaruiTeksLatar(list);
      }
      if (refraksiAnimasi) setelRefraksiLatar(list, false, 0);
      isAnimating = false;
    }, 220);
  }

  wadah.addEventListener("click", function (e) {
    var tombol = e.target.closest(".deck-control");
    if (!tombol || tombol.disabled) return;
    e.preventDefault();
    e.stopPropagation();
    var list = wadah.querySelector(".daftar-kartu");
    if (!list) return;
    pindahkanKartu(list, list.firstElementChild, tombol.classList.contains("deck-control-next") ? 1 : -1, true);
  });

  function navigasikanKartuDenganGeser(list, card, deltaX) {
    pindahkanKartu(list, card, deltaX < 0 ? 1 : -1, false);
  }

  wadah.addEventListener("touchstart", function (e) {
    if (!window.matchMedia("(max-width: 768px)").matches || isAnimating || e.touches.length !== 1) return;
    suppressDeckClickCard = null;
    var list = e.target.closest(".daftar-kartu");
    var card = e.target.closest("li");
    if (!list || !card || list.firstElementChild !== card) return;
    deckGesture = {
      list: list,
      card: card,
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      deltaX: 0,
      axis: ""
    };
  }, { passive: true });

  wadah.addEventListener("touchmove", function (e) {
    if (!deckGesture || e.touches.length !== 1) return;
    var touch = e.touches[0];
    var deltaX = touch.clientX - deckGesture.startX;
    var deltaY = touch.clientY - deckGesture.startY;
    if (!deckGesture.axis && Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 6) {
      deckGesture.axis = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
    }
    if (deckGesture.axis !== "horizontal") return;
    deckGesture.deltaX = deltaX;
    setelRefraksiLatar(deckGesture.list, true, -deltaX * 0.04);
    deckGesture.card.style.setProperty("--glare-x", Math.max(0, Math.min(100, 50 + deltaX / 3)) + "%");
    deckGesture.card.style.transition = "transform 0s, opacity 0s";
    deckGesture.card.classList.add("is-dragging");
    deckGesture.card.style.transform = "translate3d(" + deltaX + "px, 0, 0) rotate(" + deltaX * 0.04 + "deg) scale(1.02)";
    deckGesture.card.style.opacity = String(Math.max(0.55, 1 - Math.abs(deltaX) / 500));
    e.preventDefault();
  }, { passive: false });

  function akhiriGeserKartu() {
    if (!deckGesture) return;
    var gesture = deckGesture;
    deckGesture = null;
    if (gesture.axis !== "horizontal") return;
    suppressDeckClickCard = gesture.card;
    window.setTimeout(function () {
      if (suppressDeckClickCard === gesture.card) suppressDeckClickCard = null;
    }, 500);
    setelRefraksiLatar(gesture.list, false, 0);
    if (Math.abs(gesture.deltaX) > 60) {
      navigasikanKartuDenganGeser(gesture.list, gesture.card, gesture.deltaX);
    } else {
      gesture.card.style.transition = "";
      gesture.card.style.transform = "";
      gesture.card.style.opacity = "";
      gesture.card.style.removeProperty("--glare-x");
      gesture.card.classList.remove("is-dragging");
    }
  }

  wadah.addEventListener("touchend", akhiriGeserKartu, { passive: true });
  wadah.addEventListener("touchcancel", function () {
    if (!deckGesture) return;
    setelRefraksiLatar(deckGesture.list, false, 0);
    deckGesture.card.style.transition = "";
    deckGesture.card.style.transform = "";
    deckGesture.card.style.opacity = "";
    deckGesture.card.style.removeProperty("--glare-x");
    deckGesture.card.classList.remove("is-dragging");
    deckGesture = null;
  }, { passive: true });
  wadah.addEventListener("click", function (e) {
    var link = e.target.closest("a");
    if (!link) return;
    var list = link.closest(".daftar-kartu");
    var card = link.closest("li");
    if (!list || !card) return;
    if (card === suppressDeckClickCard) {
      e.preventDefault();
      e.stopPropagation();
      suppressDeckClickCard = null;
      return;
    }
    if (window.matchMedia("(max-width: 768px)").matches) {
      simpanIndeksDeck(parseInt(card.dataset.deckIndex, 10));
    }
  }, true);

  function renderIndex(q) {
    resetDeckInteraction();
    var hasil = D.tulisan.filter(function (t) { return cocok(t, q); });
    if (!hasil.length) { wadah.innerHTML = '<p class="kosong">Tidak ada tulisan yang cocok.</p>'; return; }
    wadah.innerHTML = renderDaftarKartu(hasil);
  }

  /* ---------- Kategori ---------- */
  var hal = 1;
  function renderKategori(q) {
    resetDeckInteraction();
    var jenis = body.dataset.kategori;
    var hasil = D.tulisan.filter(function (t) { return t.jenis === jenis && cocok(t, q); });
    var total = Math.max(1, Math.ceil(hasil.length / PER_HALAMAN));
    if (hal > total) hal = total;
    var potong = hasil.slice((hal - 1) * PER_HALAMAN, hal * PER_HALAMAN);

    wadah.innerHTML = potong.length
      ? '<div class="grid">' + potong.map(function (t) {
          return '<article class="kartu"><a href="' + url(t) + '"><h2>' + esc(t.judul) + '</h2>' +
                 '<span class="label">' + esc(t.penulis) + '</span><hr><p>' + esc(excerpt(t.isi.join(" "))) + "</p></a></article>";
        }).join("") + "</div>" + renderDaftarKartu(hasil)
      : '<p class="kosong">Tidak ada tulisan yang cocok.</p>';

    pager.hidden = false;
    pager.innerHTML = '<button type="button" aria-label="Halaman sebelumnya"' + (hal <= 1 ? " disabled" : "") + ' data-p="-1">' + PANAH_KIRI + '</button>' +
      "<span>" + hal + "/" + total + "</span>" +
      '<button type="button" aria-label="Halaman berikutnya"' + (hal >= total ? " disabled" : "") + ' data-p="1">' + PANAH_KANAN + '</button>';
  }
  if (pager) {
    pager.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-p]");
      if (!b || b.disabled) return;
      hal += parseInt(b.dataset.p, 10);
      renderKategori(input.value.trim());
    });
  }

  /* ---------- Baca ---------- */
  function renderBaca() {
    var t = D.tulisan.filter(function (x) { return x.id === param("id"); })[0];
    if (!t) { wadah.innerHTML = '<p class="kosong">Tulisan tidak ditemukan.</p>'; return; }
    document.title = t.judul + " | Catatan Min";
    var tanggalHtml = formatTanggalHtml(t.tanggal);
    wadah.innerHTML = '<section class="book-reader" aria-label="Pembaca tulisan">' +
      '<div class="book-reader-tools"><button class="book-mode-toggle" type="button" aria-pressed="false">Mode Gulir</button></div>' +
      '<div class="book-spread" aria-label="Halaman buku">' +
        '<div class="book-viewport"></div>' +
        '<div class="book-content-source" hidden>' +
          '<div class="book-opening"><span class="label">' + esc(t.label) + ": " + esc(t.penulis) + '</span>' +
            '<h1 class="judul-garis">' + esc(t.judul) + '</h1>' +
            (tanggalHtml ? '<p class="baca-tanggal">' + tanggalHtml + '</p>' : '') +
          '</div>' +
          '<div class="baca-isi">' + renderIsiBaca(t.isi) + '</div>' +
        '</div>' +
        '<aside class="book-footnote-popover" role="dialog" aria-label="Catatan kaki" hidden>' +
          '<div class="book-footnote-content"></div>' +
          '<button class="book-footnote-close" type="button" aria-label="Tutup catatan kaki">×</button>' +
        '</aside>' +
      '</div>' +
      '<div class="book-controls">' +
        '<button class="book-page-button" type="button" data-book-page="-1" aria-label="Halaman sebelumnya"><svg width="14" height="22" viewBox="0 0 14 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 2 3 11l8 9"/></svg></button>' +
        '<span class="book-page-indicator" aria-live="polite"></span>' +
        '<button class="book-page-button" type="button" data-book-page="1" aria-label="Halaman berikutnya"><svg width="14" height="22" viewBox="0 0 14 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 2 8 9-8 9"/></svg></button>' +
      '</div>' +
      '<div class="book-progress" role="progressbar" aria-label="Kemajuan membaca" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>' +
    '</section>';
    setupBookReader();
  }

  function paginateIntoPages(source, pageWidth, pageHeight, isDesktop) {
    var rack = document.createElement("div");
    rack.style.cssText = "position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;z-index:-1;";
    document.body.appendChild(rack);

    var pages = [];
    var currentContent;

    function newPage(isBlank) {
      var page = document.createElement("div");
      page.className = isBlank ? "page page--blank" : "page";
      page.style.width = pageWidth + "px";
      page.style.height = pageHeight + "px";
      var content = document.createElement("div");
      content.className = "page-content baca-isi";
      if (isBlank) content.setAttribute("aria-hidden", "true");
      page.appendChild(content);
      rack.appendChild(page);
      pages.push(page);
      currentContent = content;
    }

    function pageHasContent() {
      return currentContent.children.length > 0;
    }

    function fitsPage() {
      return currentContent.scrollHeight <= currentContent.clientHeight + 1;
    }

    function appendIfFits(node) {
      currentContent.appendChild(node);
      if (fitsPage()) return true;
      currentContent.removeChild(node);
      return false;
    }

    function textNodesWithin(element) {
      var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      var nodes = [];
      var node;
      while ((node = walker.nextNode())) nodes.push(node);
      return nodes;
    }

    function textPoint(nodes, offset) {
      var consumed = 0;
      for (var i = 0; i < nodes.length; i++) {
        var length = nodes[i].nodeValue.length;
        if (offset <= consumed + length) {
          return { node: nodes[i], offset: offset - consumed };
        }
        consumed += length;
      }
      if (!nodes.length) return null;
      return { node: nodes[nodes.length - 1], offset: nodes[nodes.length - 1].nodeValue.length };
    }

    function paragraphFragment(block, nodes, start, end) {
      var startPoint = textPoint(nodes, start);
      var endPoint = textPoint(nodes, end);
      if (!startPoint || !endPoint || start >= end) return null;
      var range = document.createRange();
      range.setStart(startPoint.node, startPoint.offset);
      range.setEnd(endPoint.node, endPoint.offset);
      var fragment = block.cloneNode(false);
      fragment.removeAttribute("id");
      fragment.classList.add("page-paragraph-fragment");
      fragment.appendChild(range.cloneContents());
      return fragment;
    }

    function paragraphBreaks(text) {
      var breaks = [];
      var match;
      var sentence = /[.!?]+(?:["'”’)]*)?(?:\s+|$)/g;
      while ((match = sentence.exec(text)) !== null) breaks.push(sentence.lastIndex);
      if (!breaks.length) {
        var words = /\s+/g;
        while ((match = words.exec(text)) !== null) breaks.push(words.lastIndex);
      }
      if (breaks.length && breaks[breaks.length - 1] < text.length) breaks.push(text.length);
      if (!breaks.length && text.length) breaks.push(text.length);
      return breaks;
    }

    function appendParagraphRange(block, nodes, text, start, end, maySplitWords) {
      var fragment = paragraphFragment(block, nodes, start, end);
      if (!fragment) return;
      if (appendIfFits(fragment)) return;

      newPageIfNeeded();
      if (appendIfFits(fragment)) return;

      if (maySplitWords) {
        var segment = text.slice(start, end);
        var wordPattern = /\S+\s*/g;
        var match;
        while ((match = wordPattern.exec(segment)) !== null) {
          appendParagraphRange(
            block, nodes, text,
            start + match.index,
            start + match.index + match[0].length,
            false
          );
        }
      } else {
        currentContent.appendChild(fragment);
      }
    }

    function newPageIfNeeded() {
      if (pageHasContent()) newPage(false);
    }

    function splitParagraph(block) {
      var text = block.textContent || "";
      var nodes = textNodesWithin(block);
      if (!text.length || !nodes.length) {
        currentContent.appendChild(block.cloneNode(true));
        return;
      }
      var start = 0;
      paragraphBreaks(text).forEach(function (end) {
        appendParagraphRange(block, nodes, text, start, end, true);
        start = end;
      });
    }

    function continuedList(sourceList, startIndex) {
      var list = sourceList.cloneNode(false);
      if (list.tagName === "OL") {
        var startValue = parseInt(sourceList.getAttribute("start"), 10);
        list.setAttribute("start", String((isNaN(startValue) ? 1 : startValue) + startIndex));
      }
      currentContent.appendChild(list);
      return list;
    }

    function splitList(listSource) {
      var items = Array.prototype.slice.call(listSource.children);
      var list = continuedList(listSource, 0);
      items.forEach(function (item, index) {
        var clone = item.cloneNode(true);
        list.appendChild(clone);
        if (!fitsPage()) {
          list.removeChild(clone);
          if (list.children.length) {
            newPage(false);
            list = continuedList(listSource, index);
          }
          list.appendChild(clone);
        }
      });
    }

    function splitFootnotes(section) {
      var sourceList = section.querySelector("ol");
      if (!sourceList) {
        currentContent.appendChild(section.cloneNode(true));
        return;
      }
      var items = Array.prototype.slice.call(sourceList.children);
      var list;
      function newFootnoteList(startIndex) {
        var sectionPart = section.cloneNode(false);
        list = continuedList(sourceList, startIndex);
        sectionPart.appendChild(list);
        currentContent.appendChild(sectionPart);
      }
      newFootnoteList(0);
      items.forEach(function (item, index) {
        var clone = item.cloneNode(true);
        list.appendChild(clone);
        if (!fitsPage()) {
          list.removeChild(clone);
          if (list.children.length) {
            newPage(false);
            newFootnoteList(index);
          }
          list.appendChild(clone);
        }
      });
    }

    function placeBlock(block) {
      if (block.classList.contains("baca-footnote")) {
        newPageIfNeeded();
        splitFootnotes(block);
        return;
      }
      if (appendIfFits(block.cloneNode(true))) return;
      newPageIfNeeded();
      if (appendIfFits(block.cloneNode(true))) return;
      if (block.tagName === "P") {
        splitParagraph(block);
      } else if (block.tagName === "OL" || block.tagName === "UL") {
        splitList(block);
      } else {
        currentContent.appendChild(block.cloneNode(true));
      }
    }

    newPage(false);
    var opening = source.querySelector(".book-opening");
    if (opening) currentContent.appendChild(opening.cloneNode(true));
    var body = source.querySelector(".baca-isi");
    if (body) {
      Array.prototype.forEach.call(body.children, placeBlock);
    }
    if (isDesktop && pages.length % 2) newPage(true);
    rack.parentNode.removeChild(rack);
    return pages;
  }

  function setupBookReader() {
    var reader = wadah.querySelector(".book-reader");
    var spread = reader.querySelector(".book-spread");
    var bookContainer = reader.querySelector(".book-viewport");
    var source = reader.querySelector(".book-content-source");
    var controls = reader.querySelector(".book-controls");
    var indicator = reader.querySelector(".book-page-indicator");
    var progress = reader.querySelector(".book-progress");
    var progressFill = progress.querySelector("span");
    var modeToggle = reader.querySelector(".book-mode-toggle");
    var popover = reader.querySelector(".book-footnote-popover");
    var popoverContent = reader.querySelector(".book-footnote-content");
    var closePopover = reader.querySelector(".book-footnote-close");
    var previousButton = controls.querySelector('[data-book-page="-1"]');
    var nextButton = controls.querySelector('[data-book-page="1"]');
    var pageFlip = null;
    var currentPageIndex = 0;
    var footnoteTrigger = null;
    var resizeTimer = null;
    var userToggledMode = false;

    function updatePageStatus(pageIndex) {
      if (!pageFlip) return;
      var pageCount = pageFlip.getPageCount();
      var orientation = pageFlip.getOrientation ? pageFlip.getOrientation() : "";
      var portrait = orientation ? orientation === "portrait" : window.innerWidth <= 900;
      var visiblePages = portrait ? 1 : 2;
      currentPageIndex = typeof pageIndex === "number" ? pageIndex : pageFlip.getCurrentPageIndex();
      var first = currentPageIndex + 1;
      var last = Math.min(currentPageIndex + visiblePages, pageCount);
      indicator.textContent = portrait
        ? first + " / " + pageCount
        : first + "–" + last + " / " + pageCount;
      previousButton.disabled = currentPageIndex <= 0;
      nextButton.disabled = currentPageIndex + visiblePages >= pageCount;
      var progressPage = Math.min(currentPageIndex + visiblePages, pageCount);
      var percentage = Math.round((progressPage / Math.max(1, pageCount)) * 100);
      progress.setAttribute("aria-valuenow", String(percentage));
      progressFill.style.transform = "scaleX(" + percentage / 100 + ")";
    }

    function pageDimensions() {
      var desktop = window.innerWidth > 900;
      var width = desktop ? bookContainer.clientWidth / 2 : bookContainer.clientWidth;
      var height = bookContainer.clientHeight;
      return {
        width: Math.max(280, Math.min(560, Math.round(width || 280))),
        height: Math.max(420, Math.min(820, Math.round(height || 420))),
        desktop: desktop
      };
    }

    function showLibraryFallback() {
      reader.classList.add("is-scroll-mode");
      bookContainer.hidden = true;
      source.hidden = false;
      modeToggle.disabled = true;
      modeToggle.textContent = "Mode Buku";
      modeToggle.setAttribute("aria-pressed", "true");
      var message = document.createElement("p");
      message.className = "book-reader-error";
      message.setAttribute("role", "status");
      message.textContent = "Mode buku tidak tersedia; tulisan ditampilkan dalam mode gulir.";
      reader.insertBefore(message, controls);
    }

    function restoreBookContainer() {
      if (bookContainer.parentElement !== spread) {
        spread.insertBefore(bookContainer, source);
      }
    }

    function destroyPageFlip() {
      if (pageFlip) {
        pageFlip.destroy();
        pageFlip = null;
      }
      restoreBookContainer();
      bookContainer.innerHTML = "";
      bookContainer.removeAttribute("style");
    }

    function setReaderMode(scrollMode) {
      var isScrollMode = reader.classList.contains("is-scroll-mode");
      if (scrollMode && !isScrollMode) {
        currentPageIndex = pageFlip ? pageFlip.getCurrentPageIndex() : currentPageIndex;
        destroyPageFlip();
        bookContainer.hidden = true;
        source.hidden = false;
        reader.classList.add("is-scroll-mode");
      } else if (!scrollMode) {
        if (isScrollMode) {
          reader.classList.remove("is-scroll-mode");
          source.hidden = true;
          bookContainer.hidden = false;
        }
        if (!pageFlip) initializePageFlip(currentPageIndex);
      }
      var isScrollModeAfterChange = reader.classList.contains("is-scroll-mode");
      modeToggle.textContent = isScrollModeAfterChange ? "Mode Buku" : "Mode Gulir";
      modeToggle.setAttribute("aria-pressed", String(isScrollModeAfterChange));
    }

    function initializePageFlip(startPage) {
      if (!window.St || typeof window.St.PageFlip !== "function") {
        showLibraryFallback();
        return;
      }
      var dimensions = pageDimensions();
      var pages = paginateIntoPages(source, dimensions.width, dimensions.height, dimensions.desktop);
      bookContainer.innerHTML = "";
      pages.forEach(function (page) { bookContainer.appendChild(page); });
      pages.forEach(function (page) {
        page.querySelectorAll("img").forEach(function (image) {
          image.loading = "eager";
          image.addEventListener("load", scheduleRebuild, { once: true });
        });
      });
      if (!dimensions.desktop) startPage = Math.max(0, Math.min(startPage, pages.length - 1));
      else startPage = Math.max(0, Math.min(Math.floor(startPage / 2) * 2, pages.length - 2));
      pageFlip = new window.St.PageFlip(bookContainer, {
        width: dimensions.width,
        height: dimensions.height,
        size: "stretch",
        minWidth: 280,
        maxWidth: 560,
        minHeight: 420,
        maxHeight: 820,
        usePortrait: true,
        showCover: false,
        drawShadow: true,
        maxShadowOpacity: 0.35,
        flippingTime: 650,
        mobileScrollSupport: false,
        startPage: startPage
      });
      pageFlip.loadFromHTML(bookContainer.querySelectorAll(".page"));
      pageFlip.on("flip", function (event) {
        updatePageStatus(typeof event.data === "number" ? event.data : pageFlip.getCurrentPageIndex());
      });
      pageFlip.on("changeOrientation", function () {
        updatePageStatus(pageFlip.getCurrentPageIndex());
      });
      updatePageStatus(pageFlip.getCurrentPageIndex());
    }

    function rebuildPageFlip() {
      if (reader.classList.contains("is-scroll-mode")) return;
      var savedPage = pageFlip ? pageFlip.getCurrentPageIndex() : currentPageIndex;
      destroyPageFlip();
      initializePageFlip(savedPage);
    }

    function scheduleRebuild() {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        resizeTimer = null;
        rebuildPageFlip();
      }, 160);
    }

    function tutupPopover() {
      popover.hidden = true;
      popoverContent.textContent = "";
      if (footnoteTrigger && footnoteTrigger.isConnected) footnoteTrigger.focus();
      footnoteTrigger = null;
    }

    controls.addEventListener("click", function (event) {
      var button = event.target.closest("[data-book-page]");
      if (!button || button.disabled || !pageFlip) return;
      if (button.dataset.bookPage === "-1") pageFlip.flipPrev();
      else pageFlip.flipNext();
    });

    modeToggle.addEventListener("click", function () {
      var scrollMode = !reader.classList.contains("is-scroll-mode");
      userToggledMode = true;
      setReaderMode(scrollMode);
    });

    closePopover.addEventListener("click", tutupPopover);
    spread.addEventListener("click", function (event) {
      var reference = event.target.closest(".fn-ref a");
      if (reference) {
        var target = document.getElementById(reference.getAttribute("href").slice(1));
        if (!target) return;
        event.preventDefault();
        event.stopPropagation();
        var note = target.cloneNode(true);
        note.removeAttribute("id");
        note.querySelectorAll(".fn-balik").forEach(function (link) { link.remove(); });
        popoverContent.innerHTML = note.innerHTML;
        popover.hidden = false;
        footnoteTrigger = reference;
        closePopover.focus();
        return;
      }

      var backLink = event.target.closest(".fn-balik");
      if (!backLink) return;
      event.preventDefault();
      event.stopPropagation();
      var referenceTarget = document.getElementById(backLink.getAttribute("href").slice(1));
      tutupPopover();
      if (!referenceTarget) return;
      if (reader.classList.contains("is-scroll-mode")) {
        referenceTarget.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (pageFlip) {
        var page = referenceTarget.closest(".page");
        var pageNodes = bookContainer.querySelectorAll(".page");
        var pageIndex = Array.prototype.indexOf.call(pageNodes, page);
        if (pageIndex >= 0) pageFlip.turnToPage(pageIndex);
      }
    });

    source.querySelectorAll("img").forEach(function (image) {
      image.loading = "eager";
      image.addEventListener("load", scheduleRebuild, { once: true });
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !popover.hidden) {
        tutupPopover();
        return;
      }
      if (reader.classList.contains("is-scroll-mode")) return;
      if (event.target.closest && event.target.closest("input, textarea, select, [contenteditable='true']")) return;
      if (!pageFlip) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        pageFlip.flipPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        pageFlip.flipNext();
      }
    });

    window.addEventListener("resize", function () {
      var modeChanged = false;
      if (!userToggledMode) {
        var defaultScrollMode = window.innerWidth <= 900;
        modeChanged = defaultScrollMode !== reader.classList.contains("is-scroll-mode");
        if (modeChanged) setReaderMode(defaultScrollMode);
      }
      if (!modeChanged) scheduleRebuild();
    });
    if ("ResizeObserver" in window) new ResizeObserver(scheduleRebuild).observe(spread);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleRebuild);
    setReaderMode(window.innerWidth <= 900);
  }

  /* ---------- Penulis ---------- */
  function renderPenulis(q) {
    if (idPenulis) {
      var penulis = D.penulis[0];
      if (!penulis) {
        document.title = "Penulis tidak ditemukan | Catatan Min";
        wadah.innerHTML = '<p class="kosong">Penulis tidak ditemukan.</p>' +
          '<a class="tautan-kembali" href="penulis.html">← Semua Penulis</a>';
        return;
      }

      document.title = penulis.nama + " | Catatan Min";
      var fotoProfil = penulis.foto
        ? (/^https?:\/\//.test(penulis.foto) ? penulis.foto : root + penulis.foto)
        : "";
      var karya = D.tulisan.filter(function (t) { return t.penulis === penulis.nama; });
      wadah.innerHTML = '<a class="tautan-kembali" href="penulis.html">← Semua Penulis</a>' +
        '<section class="profil-penulis' + (fotoProfil ? "" : " tanpa-foto") + '">' +
          (fotoProfil ? '<img class="foto-profil" src="' + esc(fotoProfil) + '" alt="Foto ' + esc(penulis.nama) + '">' : "") +
          '<div class="profil-penulis-info">' +
            '<span class="label">' + esc(penulis.label || "Penulis") + '</span>' +
            '<h1 class="judul-garis">' + esc(penulis.nama) + '</h1>' +
            (penulis.bio ? '<p class="bio-penulis">' + esc(penulis.bio) + '</p>' : "") +
          '</div>' +
        '</section>' +
        '<h2 class="judul-karya">Karya</h2>' +
        (karya.length
          ? '<ul class="daftar">' + karya.map(function (t) {
              return '<li><a href="' + url(t) + '"><span class="label">' + esc(t.label) +
                '</span><span class="judul-garis">' + esc(t.judul) + '</span></a></li>';
            }).join("") + '</ul>'
          : '<p class="kosong">Belum ada tulisan dari penulis ini.</p>');
      return;
    }

    var hasil = D.penulis.filter(function (p) {
      return !q || (p.nama + " " + (p.bio || "")).toLowerCase().indexOf(q.toLowerCase()) !== -1;
    });
    wadah.innerHTML = hasil.length
      ? '<div class="grid">' + hasil.map(function (p) {
          var foto = p.foto ? (/^https?:\/\//.test(p.foto) ? p.foto : root + p.foto) : "";
          return '<article class="kartu kartu-penulis"><a href="penulis.html?id=' + encodeURIComponent(p.id) + '">' +
                 (foto ? '<img class="foto" src="' + esc(foto) + '" alt="Foto ' + esc(p.nama) + '">' : "") +
                 '<h2>' + esc(p.nama) + '</h2><span class="label">' + esc(p.label) + '</span><hr><p>' +
                 esc(excerpt(p.bio)) + "</p></a></article>";
        }).join("") + "</div>"
      : '<p class="kosong">Tidak ada penulis yang cocok.</p>';
  }

  /* ---------- Pencarian ---------- */
  function render() {
    var q = input ? input.value.trim() : "";
    if (halaman === "index") renderIndex(q);
    else if (halaman === "kategori") { hal = 1; renderKategori(q); }
    else if (halaman === "penulis") renderPenulis(q);
  }

  if (input) {
    var awal = param("q");
    if (awal && halaman === "index") input.value = awal;
    input.addEventListener("input", function () {
      if (halaman === "index" || halaman === "kategori") simpanIndeksDeck(0);
      render();
    });
    input.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (halaman === "baca") {
        location.href = root + "index.html?q=" + encodeURIComponent(input.value.trim());
      } else if (header && header.classList.contains("is-open")) {
        header.classList.remove("is-open");
        if (hamburger) {
          hamburger.setAttribute("aria-expanded", "false");
          hamburger.setAttribute("aria-label", "Buka menu navigasi");
        }
      }
    });
  }

  if (halaman === "baca") renderBaca();
  else render();
})();