(async function () {
  "use strict";

  var body = document.body;
  var root = body.dataset.root || "";       // "" (root) atau "../" (folder catatan)
  var halaman = body.dataset.page;          // index | kategori | baca | penulis
  var PER_HALAMAN = 9;
  var EXCERPT = 210;
  var PANAH_KIRI = '<svg width="14" height="22" viewBox="0 0 14 22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="11,2 3,11 11,20"/></svg>';
  var PANAH_KANAN = '<svg width="14" height="22" viewBox="0 0 14 22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="3,2 11,11 3,20"/></svg>';

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
  function excerpt(teks) {
    var t = String(teks || "").replace(/\s+/g, " ").trim();
    if (t.length <= EXCERPT) return t;
    return t.slice(0, EXCERPT).replace(/\s+\S*$/, "") + "...";
  }
  function url(t) { return root + "baca.html?id=" + encodeURIComponent(t.id); }
  function cocok(t, q) {
    if (!q) return true;
    var hay = (t.judul + " " + t.penulis + " " + t.label + " " + t.isi.join(" ")).toLowerCase();
    return q.toLowerCase().split(/\s+/).every(function (k) { return hay.indexOf(k) !== -1; });
  }
  function param(nama) { return new URLSearchParams(location.search).get(nama) || ""; }

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
    wadah.innerHTML = '<span class="label">' + esc(t.label) + ": " + esc(t.penulis) + '</span><br>' +
      '<h1 class="judul-garis">' + esc(t.judul) + '</h1>' +
      '<div class="baca-isi">' + t.isi.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + "</div>";
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
      // Halaman tanpa daftar tulisan -> arahkan ke beranda dengan kata kunci
      if (halaman === "baca") {
        location.href = root + "index.html?q=" + encodeURIComponent(input.value.trim());
      }
    });
  }

  if (halaman === "baca") renderBaca();
  else render();
})();