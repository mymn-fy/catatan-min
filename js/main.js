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

  /* ---------- Ambil data dari Supabase ---------- */
  var hasilDb = await Promise.all([
    db.from("tulisan").select("*").order("dibuat", { ascending: false }),
    db.from("penulis").select("*").order("nama")
  ]);
  if (hasilDb[0].error || hasilDb[1].error) {
    wadah.innerHTML = '<p class="kosong">Gagal memuat data.</p>';
    return;
  }
  var D = { tulisan: hasilDb[0].data, penulis: hasilDb[1].data };

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
  function renderIndex(q) {
    var hasil = D.tulisan.filter(function (t) { return cocok(t, q); });
    if (!hasil.length) { wadah.innerHTML = '<p class="kosong">Tidak ada tulisan yang cocok.</p>'; return; }
    wadah.innerHTML = '<ul class="daftar">' + hasil.map(function (t) {
      return '<li><a href="' + url(t) + '"><span class="label">' + esc(t.label) + ": " + esc(t.penulis) +
             '</span><span class="judul-garis">' + esc(t.judul) + "</span></a></li>";
    }).join("") + "</ul>";
  }

  /* ---------- Kategori ---------- */
  var hal = 1;
  function renderKategori(q) {
    var jenis = body.dataset.kategori;
    var hasil = D.tulisan.filter(function (t) { return t.jenis === jenis && cocok(t, q); });
    var total = Math.max(1, Math.ceil(hasil.length / PER_HALAMAN));
    if (hal > total) hal = total;
    var potong = hasil.slice((hal - 1) * PER_HALAMAN, hal * PER_HALAMAN);

    wadah.innerHTML = potong.length
      ? '<div class="grid">' + potong.map(function (t) {
          return '<article class="kartu"><a href="' + url(t) + '"><h2>' + esc(t.judul) + '</h2>' +
                 '<span class="label">' + esc(t.penulis) + '</span><hr><p>' + esc(excerpt(t.isi.join(" "))) + "</p></a></article>";
        }).join("") + "</div>"
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
    wadah.innerHTML = '<span class="label">' + esc(t.label) + ": " + esc(t.penulis) + '</span><br>' +
      '<h1 class="judul-garis">' + esc(t.judul) + '</h1>' +
      (tanggalHtml ? '<p class="baca-tanggal">' + tanggalHtml + '</p>' : '') +
      '<div class="baca-isi">' + renderIsiBaca(t.isi) + "</div>";
  }

  /* ---------- Penulis ---------- */
  function renderPenulis(q) {
    var hasil = D.penulis.filter(function (p) {
      return !q || (p.nama + " " + (p.bio || "")).toLowerCase().indexOf(q.toLowerCase()) !== -1;
    });
    wadah.innerHTML = hasil.length
      ? '<div class="grid">' + hasil.map(function (p) {
          var foto = p.foto ? (/^https?:\/\//.test(p.foto) ? p.foto : root + p.foto) : "";
          return '<article class="kartu">' +
                 (foto ? '<img class="foto" src="' + esc(foto) + '" alt="Foto ' + esc(p.nama) + '">' : "") +
                 '<h2>' + esc(p.nama) + '</h2><span class="label">' + esc(p.label) + '</span><hr><p>' + esc(excerpt(p.bio)) + "</p></article>";
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
    input.addEventListener("input", render);
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