/**
 * SPOTMEMBER MASTER BACKEND v12.1 (SaaS White-Label Edition) - 2026
 * Hardened Edition (Crash-proof + Settings Cache + Safer Parsing)
 * - Fix: doPost null-safety (e.postData)
 * - Fix: Settings cache per request (lebih cepat & stabil)
 * - Fix: Sheet guard (biar gak crash kalau sheet hilang)
 * - Fix: Harga sanitizer (anti "10.000" jadi NaN)
 * - Fix: Webhook in-memory status update (anti double-match)
 * - Improve: Cloudflare error message lebih informatif
 * - New: get_pages action for dashboard HTML download
 * - New: Non-Aktifkan action (Lunas -> Pending status switch)
 */

const ss = SpreadsheetApp.getActiveSpreadsheet();

/* =========================
   UTIL / HARDENING HELPERS
========================= */
function jsonRes(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
function doGet() {
  return ContentService.createTextOutput("System API Ready!")
    .setMimeType(ContentService.MimeType.TEXT);
}

function getSettingsMap_() {
  const s = ss.getSheetByName("Settings");
  if (!s) return {};
  const d = s.getDataRange().getValues();
  const map = {};
  for (let i = 1; i < d.length; i++) {
    const k = String(d[i][0] || "").trim();
    if (k) map[k] = d[i][1];
  }
  return map;
}
function getCfgFrom_(cfg, name) {
  return (cfg && cfg[name] !== undefined && cfg[name] !== null) ? cfg[name] : "";
}
function mustSheet_(name) {
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error(`Sheet "${name}" tidak ditemukan`);
  return sh;
}
function toNumberSafe_(v) {
  const n = Number(String(v ?? "").replace(/[^\d]/g, ""));
  return isFinite(n) ? n : 0;
}
function toISODate_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
}

/* =========================
   LEGACY getCfg (kept)
   (masih bisa dipakai, tapi lebih lambat)
========================= */
function getCfg(name) {
  try {
    const s = ss.getSheetByName("Settings");
    const d = s.getDataRange().getValues();
    for (let i = 1; i < d.length; i++) {
      if (String(d[i][0]).trim() === name) return d[i][1];
    }
  } catch (e) { return ""; }
  return "";
}

/* =========================
   WEBHOOK ENTRYPOINT
========================= */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonRes({ status: "error", message: "No data" });
    }

    const cfg = getSettingsMap_();

    // ====================================================================
    // 🚀 RADAR DUITKU: REMOVED
    // ====================================================================


    const payloadString = e.postData.contents;
    let data = null;
    try {
       data = JSON.parse(payloadString);
    } catch(err) {
       // Ignore JSON parse error, maybe it was not JSON but handled above or invalid
       return jsonRes({ status: "error", message: "Invalid JSON format" });
    }

    // ====================================================================
    // 🚀 SYSTEM ACTIONS: SYNC URL, CONFIG, ETC
    // ====================================================================
    if (data.action === 'sync_frontend_url') {
       return syncUrlToRepo(cfg);
    }
    if (data.action === 'init_master_db') {
       return jsonRes(initMasterDB());
    }
    if (data.action === 'sync_products') {
       return jsonRes(syncProductDB());
    }
    if (data.action === 'save_github_config') {
       return saveGithubConfig(data);
    }
    if (data.action === 'get_github_config') {
       return getGithubConfig();
    }
    if (data.action === 'toggle_auto_sync') {
       return toggleAutoSync(data);
    }
    if (data.action === 'get_auto_sync_status') {
       return getAutoSyncStatus();
    }

    // ====================================================================
    // 🚀 RADAR MOOTA: DETEKSI WEBHOOK MASUK + URL SECURITY TOKEN
    // ====================================================================
    if (Array.isArray(data) && data.length > 0 && data[0].amount !== undefined) {
      const mootaToken = String(getCfgFrom_(cfg, "moota_token") || "").trim();

      if (mootaToken) {
        const urlToken = (e.parameter && e.parameter.token) ? String(e.parameter.token).trim() : "";
        if (!urlToken || urlToken !== mootaToken) {
          return ContentService.createTextOutput("ERROR: Akses Ditolak! Token tidak valid.")
            .setMimeType(ContentService.MimeType.TEXT);
        }
      }

      // Validasi Signature (jika moota_secret diset di Settings)
      const mootaSecret = String(getCfgFrom_(cfg, "moota_secret") || "").trim();
      if (mootaSecret) {
        const signature = (e.parameter && e.parameter.moota_signature) ? String(e.parameter.moota_signature).trim() : "";
        if (signature) {
          const computed = Utilities.computeHmacSha256Signature(payloadString, mootaSecret);
          const computedHex = computed.map(function(chr){return (chr+256).toString(16).slice(-2)}).join("");
          if (computedHex !== signature) {
            return ContentService.createTextOutput("ERROR: Invalid Signature")
              .setMimeType(ContentService.MimeType.TEXT);
          }
        }
      }

      return handleMootaWebhook(data, cfg);
    }

    // ====================================================================
    // JIKA BUKAN DARI MOOTA, JALANKAN PERINTAH DARI WEBSITE (FRONTEND)
    // ====================================================================
    const action = data.action;
    switch (action) {
      case "get_global_settings": return jsonRes(getGlobalSettings(cfg));
      case "get_product": return jsonRes(getProductDetail(data, cfg));
      case "get_products": return jsonRes(getProducts(data, cfg));
      case "create_order": return jsonRes(createOrder(data, cfg));
      case "update_order_status": return jsonRes(updateOrderStatus(data, cfg));
      case "login": return jsonRes(loginUser(data));
      case "get_page_content": return jsonRes(getPageContent(data));
      case "get_pages": return jsonRes(getAllPages(data));
      case "admin_login": return jsonRes(adminLogin(data));
      case "get_admin_data": return jsonRes(getAdminData(cfg));
      case "validate_access_rules": return jsonRes(validateAccessRules());
      case "save_product": return jsonRes(saveProduct(data));
      case "save_page": return jsonRes(savePage(data));
      case "update_settings": return jsonRes(updateSettings(data));
      case "get_ik_auth": return jsonRes(getImageKitAuth(cfg));
      case "get_media_files": return jsonRes(getIkFiles(cfg));
      case "purge_cf_cache": return jsonRes(purgeCFCache(cfg));
      case "change_password": return jsonRes(changeUserPassword(data));
      case "update_profile": return jsonRes(updateUserProfile(data));
      case "forgot_password": return jsonRes(forgotPassword(data));
      case "get_dashboard_data": return jsonRes(getDashboardData(data));
      case "normalize_users": return jsonRes(normalizeUsersSheet());
      case "delete_product": return jsonRes(deleteProduct(data));
      case "delete_page": return jsonRes(deletePage(data));
      case "check_slug": return jsonRes(checkSlug(data));
      case "save_affiliate_pixel": return jsonRes(saveAffiliatePixel(data));
      case "save_bio_link": return jsonRes(saveBioLink(data));
      case "get_bio_link": return jsonRes(getBioLink(data));
      case "log_event": return jsonRes(logAnalyticsEvent(data));
      default: return jsonRes({ status: "error", message: "Aksi tidak terdaftar: " + (action || "unknown") });
    }
  } catch (err) {
    return jsonRes({ status: "error", message: err.toString() });
  }
}

/* =========================
   WHITE-LABEL GLOBAL SETTINGS
========================= */
function getGlobalSettings(cfg) {
  cfg = cfg || getSettingsMap_();
  return {
    status: "success",
    data: {
      site_name: getCfgFrom_(cfg, "site_name") || "Sistem Premium",
      site_tagline: getCfgFrom_(cfg, "site_tagline") || "Platform Produk Digital Terbaik",
      site_favicon: getCfgFrom_(cfg, "site_favicon") || "",
      site_logo: getCfgFrom_(cfg, "site_logo") || "",
      contact_email: getCfgFrom_(cfg, "contact_email") || "",
      wa_admin: getCfgFrom_(cfg, "wa_admin") || ""
    }
  };
}

/* =========================
   CLOUDFLARE PURGE
========================= */
function purgeCFCache(cfg) {
  try {
    cfg = cfg || getSettingsMap_();
    const zoneId = String(getCfgFrom_(cfg, "cf_zone_id") || "").trim();
    const token = String(getCfgFrom_(cfg, "cf_api_token") || "").trim();
    if (!zoneId || !token) return { status: "error", message: "Konfigurasi Cloudflare belum disetting!" };

    const options = {
      method: "post",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      payload: JSON.stringify({ purge_everything: true }),
      muteHttpExceptions: true
    };

    const res = UrlFetchApp.fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, options);
    const body = JSON.parse(res.getContentText());

    if (body && body.success) {
      return { status: "success", message: "🚀 Cache Berhasil Dibersihkan!" };
    }
    const msg = (body && body.errors && body.errors.length) ? JSON.stringify(body.errors) : "Cloudflare Error";
    return { status: "error", message: msg };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function getIkFiles(cfg) {
  cfg = cfg || getSettingsMap_();
  const privateKey = getCfgFrom_(cfg, "ik_private_key");
  if (!privateKey) return { status: "error", message: "Private Key belum disetting" };

  try {
    const url = "https://api.imagekit.io/v1/files?sort=DESC_CREATED&limit=20"; // Limit 20 terbaru
    const authHeader = "Basic " + Utilities.base64Encode(privateKey + ":");
    
    const options = {
      method: "get",
      headers: {
        "Authorization": authHeader
      },
      muteHttpExceptions: true
    };

    const res = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(res.getContentText());

    if (Array.isArray(data)) {
        // Map data to simpler format
        const files = data.map(f => ({
            name: f.name,
            url: f.url,
            thumbnail: f.thumbnailUrl || f.url,
            fileId: f.fileId,
            type: f.fileType
        }));
        return { status: "success", files: files };
    } else {
        return { status: "error", message: data.message || "Gagal mengambil data file" };
    }
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

/* =========================
   NOTIFICATIONS
========================= */
function sendWA(target, message, cfg) {
  if (!target) return;
  cfg = cfg || getSettingsMap_();
  const token = getCfgFrom_(cfg, "fonnte_token") || getCfg("fonnte_token");
  if (!token) return;
  try {
    UrlFetchApp.fetch("https://api.fonnte.com/send", {
      method: "post",
      headers: { "Authorization": token },
      payload: { target: target, message: message },
      muteHttpExceptions: true
    });
  } catch (e) {
    Logger.log(e);
  }
}

function sendEmail(target, subject, body, cfg) {
  if (!target) return;
  cfg = cfg || getSettingsMap_();
  try {
    const senderName = getCfgFrom_(cfg, "site_name") || "Admin Sistem";
    MailApp.sendEmail({ to: target, subject: subject, htmlBody: body, name: senderName });
  } catch (e) {
    Logger.log(e);
  }
}

/* =========================
   CREATE ORDER (ANGKA UNIK + WHITE-LABEL + AFFILIATE)
========================= */
function createOrder(d, cfg) {
  try {
    cfg = cfg || getSettingsMap_();

    const oS = mustSheet_("Orders");
    const uS = mustSheet_("Users");

    const inv = "INV-" + Math.floor(10000 + Math.random() * 90000);
    const email = String(d.email || "").trim().toLowerCase();
    if (!email) return { status: "error", message: "Email wajib diisi" };

    const siteName = getCfgFrom_(cfg, "site_name") || "Sistem Premium";
    const siteUrl = String(getCfgFrom_(cfg, "site_url") || "").trim();
    const loginUrl = siteUrl ? (siteUrl + "/login.html") : "Link Login Belum Disetting";

    const bankName = getCfgFrom_(cfg, "bank_name") || "-";
    const bankNorek = getCfgFrom_(cfg, "bank_norek") || "-";
    const bankOwner = getCfgFrom_(cfg, "bank_owner") || "-";

    const aff = (d.affiliate && String(d.affiliate).trim() !== "") ? String(d.affiliate).trim() : "-";

    const hargaDasar = toNumberSafe_(d.harga);
    
    // --> ANTI-FRAUD & BUMP LOGIC START
    const initialPid = String(d.id_produk || "").trim();
    const rules = mustSheet_("Access_Rules").getDataRange().getValues();
    let dbPrice = 0;
    let dbName = "";
    
    for (let i = 1; i < rules.length; i++) {
        if (String(rules[i][0]) === initialPid) {
            dbPrice = toNumberSafe_(rules[i][4]);
            dbName = rules[i][1];
            break;
        }
    }
    
    let expectedTotal = dbPrice;
    let finalProductName = dbName || d.nama_produk; 
    
    if (d.bump_id) {
        let bumpPrice = 0;
        let bumpName = "";
         for (let i = 1; i < rules.length; i++) {
            if (String(rules[i][0]) === String(d.bump_id)) {
                bumpPrice = toNumberSafe_(rules[i][4]);
                bumpName = rules[i][1];
                break;
            }
        }
        expectedTotal += bumpPrice;
        finalProductName += " + " + bumpName;
    }

    if (Math.abs(hargaDasar - expectedTotal) > 500) {
        return { status: "error", message: "Validasi Harga Gagal. Harga tidak sesuai dengan sistem." };
    }
    d.nama_produk = finalProductName;
    if (d.bump_id) {
        d.id_produk = d.id_produk + "," + d.bump_id;
    }
    // --> ANTI-FRAUD END

    // MODIFIED: Allow 0 price (Free Product)
    const isZeroPrice = hargaDasar === 0;
    if (!isZeroPrice && hargaDasar <= 0) return { status: "error", message: "Harga tidak valid" };

    let komisiNominal = 0;
    
    // Lookup Product Commission (Multi-product support)
    const allPids = String(d.id_produk || "").split(",");
    if (aff !== "-") {
        for (let k = 0; k < allPids.length; k++) {
             const cPid = allPids[k].trim();
             for (let i = 1; i < rules.length; i++) {
                if (String(rules[i][0]) === cPid) {
                    komisiNominal += Number(rules[i][11] || 0);
                    break;
                }
            }
        }
    }

    const kodeUnik = isZeroPrice ? 0 : (Math.floor(Math.random() * 900) + 100);
    const hargaTotalUnik = hargaDasar + kodeUnik;

    // Cek atau Buat User Baru
    let isNew = true;
    let pass = Math.random().toString(36).slice(-6);

    const uData = uS.getDataRange().getValues();
    for (let j = 1; j < uData.length; j++) {
      if (String(uData[j][1]).toLowerCase() === email) {
        isNew = false;
        pass = String(uData[j][2]);
        break;
      }
    }
    if (isNew) {
      // Generate Friendly Unique ID (u-XXXXXX)
      let newUserId = "u-" + Math.floor(100000 + Math.random() * 900000);
      let unique = false;
      while(!unique) {
          unique = true;
          for(let k=1; k<uData.length; k++) {
              if(String(uData[k][0]) === newUserId) {
                  unique = false;
                  newUserId = "u-" + Math.floor(100000 + Math.random() * 900000);
                  break;
              }
          }
      }
      uS.appendRow([newUserId, email, pass, d.nama, "member", "Active", toISODate_(), "-"]);
    }

    const orderStatus = isZeroPrice ? "Lunas" : "Pending";

    // Simpan order (struktur kolom sama dengan script lu)
    oS.appendRow([
      inv,
      email,
      d.nama,
      d.whatsapp,
      d.id_produk,
      d.nama_produk,
      hargaTotalUnik,
      orderStatus,
      toISODate_(),
      aff,
      komisiNominal
    ]);

    // ==========================================
    // NOTIFIKASI (LOGIC CABANG: GRATIS vs BAYAR)
    // ==========================================
    
    const adminWA = getCfgFrom_(cfg, "wa_admin");

    if (isZeroPrice) {
       // --- SKENARIO PRODUK GRATIS (AUTO LUNAS) ---
       
       // 1. Ambil Link Akses (Multi-product)
       let accessUrls = [];
       const pS = mustSheet_("Access_Rules");
       const pData = pS.getDataRange().getValues();
       const allPids = String(d.id_produk).split(",");
       
       for (let x = 0; x < allPids.length; x++) {
           const cPid = allPids[x].trim();
           for (let k = 1; k < pData.length; k++) {
             if (String(pData[k][0]) === cPid) { 
                 accessUrls.push(pData[k][1] + ": " + pData[k][3]); 
                 break; 
             }
           }
       }
       const accessUrl = accessUrls.join("\n");
       
       // 2. WA ke User
       const waText = `Halo *${d.nama}*, selamat datang di ${siteName}! 🎉\n\nSukses! Akses Anda untuk produk *${d.nama_produk}* telah aktif (GRATIS).\n\n🚀 *Klik link berikut untuk akses materi:*\n${accessUrl}\n\n🔐 *AKUN MEMBER AREA*\n🌐 Link: ${loginUrl}\n✉️ Email: ${email}\n🔑 Password: ${pass}\n\nTerima kasih!\n*Tim ${siteName}*`;
       sendWA(d.whatsapp, waText, cfg);

       // 3. Email ke User
       const emailHtml = `
       <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #334155; border: 1px solid #e2e8f0; border-radius: 10px;">
          <h2 style="color: #10b981;">Akses Produk Gratis Dibuka! 🎁</h2>
          <p>Halo <b>${d.nama}</b>,</p>
          <p>Selamat! Anda telah berhasil mendapatkan akses ke produk <b>${d.nama_produk}</b> secara GRATIS.</p>
          
          <div style="text-align: center; margin: 30px 0;">
              <a href="${accessUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Akses Materi Sekarang</a>
          </div>

          <h3 style="color: #0f172a;">🔐 Akun Member Area</h3>
          <p><b>Link:</b> <a href="${loginUrl}">${loginUrl}</a><br>
          <b>Email:</b> ${email}<br>
          <b>Password:</b> <code>${pass}</code></p>
          
          <p>Salam hangat,<br><b>Tim ${siteName}</b></p>
       </div>`;
       sendEmail(email, `Akses Gratis! Produk ${d.nama_produk}`, emailHtml, cfg);

       // 4. Notif Admin
       sendWA(adminWA, `🎁 *ORDER GRATIS BARU!* 🎁\n\n📌 *Invoice:* #${inv}\n📦 *Produk:* ${d.nama_produk}\n👤 *User:* ${d.nama}\n\nStatus: Lunas (Auto)`, cfg);

    } else {
       // --- SKENARIO BERBAYAR (PENDING) ---

       // --> NOTIFIKASI PEMBELI (WHATSAPP)
    const waBuyerText =
`Halo *${d.nama}*, salam hangat dari ${siteName}! 👋

Terima kasih telah melakukan pemesanan. Berikut rincian pesanan Anda:

📦 *Produk:* ${d.nama_produk}
🔖 *Invoice:* #${inv}
💰 *Total:* Rp ${hargaTotalUnik.toLocaleString('id-ID')}

⚠️ *PENTING!*
Harap transfer *SESUAI ANGKA DIATAS* (sampai 3 digit terakhir) agar sistem dapat memproses otomatis.

🏦 *Rekening Tujuan:*
${bankName} - ${bankNorek}
a.n ${bankOwner}

Setelah transfer, mohon tunggu 1-5 menit. Akses produk akan dikirim otomatis ke WhatsApp ini.

Terima kasih! 🙏`;

    sendWA(d.whatsapp, waBuyerText, cfg);

    // --> NOTIFIKASI ADMIN (WHATSAPP)
    const waAdminText =
`🔔 *ORDER MASUK BARU!*

📌 *Invoice:* #${inv}
📦 *Produk:* ${d.nama_produk}
👤 *User:* ${d.nama}
📞 *WA:* ${d.whatsapp}
💰 *Nilai:* Rp ${hargaTotalUnik.toLocaleString('id-ID')}
🔄 *Status:* Pending

Segera cek mutasi jika pembayaran masuk!`;

    sendWA(adminWA, waAdminText, cfg);
    }

    return { status: "success", invoice: inv, amount: hargaTotalUnik };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

/* =========================
   MOOTA WEBHOOK HANDLER
========================= */
function handleMootaWebhook(data, cfg) {
  try {
    cfg = cfg || getSettingsMap_();
    
    // Cache processed IDs to prevent double processing in same execution
    const processedIds = [];

    const oS = mustSheet_("Orders");
    const orders = oS.getDataRange().getValues();
    
    const pS = mustSheet_("Access_Rules");
    const pData = pS.getDataRange().getValues();

    const notifications = [];

    // Loop setiap mutasi yang masuk dari Moota
    for (let i = 0; i < data.length; i++) {
      const mutasi = data[i];
      const amount = parseInt(mutasi.amount); // Nominal transfer
      
      // Cari order dengan nominal yg sama DAN status Pending
      for (let j = 1; j < orders.length; j++) {
        const orderAmount = parseInt(orders[j][6]);
        const status = String(orders[j][7]);
        const inv = orders[j][0];

        if (orderAmount === amount && status === "Pending" && !processedIds.includes(inv)) {
          // MATCH FOUND!
          oS.getRange(j + 1, 8).setValue("Lunas"); // Update Status
          processedIds.push(inv); // Mark processed

          // Siapkan data notifikasi
          const buyerName = orders[j][2];
          const buyerWA = orders[j][3];
          const buyerEmail = orders[j][1];
          const prodId = orders[j][4];
          const prodName = orders[j][5];

          // Cari Link Akses (Multi-product support)
          let accessUrls = [];
          const allPids = String(prodId).split(",");
          for (let x = 0; x < allPids.length; x++) {
             const cPid = allPids[x].trim();
             for (let k = 1; k < pData.length; k++) {
                if (String(pData[k][0]) === cPid) {
                    accessUrls.push(pData[k][1] + ": " + pData[k][3]);
                    break;
                }
             }
          }
          const accessUrl = accessUrls.join("\n");
          
          // Cari Password User
          let pass = "????";
          const uS = mustSheet_("Users");
          const uData = uS.getDataRange().getValues();
          for(let u=1; u<uData.length; u++) {
              if(String(uData[u][1]).toLowerCase() === String(buyerEmail).toLowerCase()) {
                  pass = uData[u][2];
                  break;
              }
          }
          
          const siteName = getCfgFrom_(cfg, "site_name") || "Sistem Premium";
          const siteUrl = String(getCfgFrom_(cfg, "site_url") || "").trim();
          const loginUrl = siteUrl ? (siteUrl + "/login.html") : "-";

          notifications.push({
            wa: buyerWA,
            msg: `Halo *${buyerName}*! Pembayaran Anda sebesar Rp ${amount.toLocaleString('id-ID')} telah DITERIMA. ✅\n\nOrder: *${prodName}*\n\n🚀 *Link Akses Produk:*\n${accessUrl}\n\n🔐 *AKUN MEMBER AREA*\n🌐 Link: ${loginUrl}\n✉️ Email: ${buyerEmail}\n🔑 Password: ${pass}\n\nTerima kasih telah berbelanja!`,
            email: buyerEmail,
            subj: `Pembayaran Diterima! Order #${inv}`,
            body: `
              <h3>Pembayaran Sukses! ✅</h3>
              <p>Halo ${buyerName}, terima kasih atas pembayaran Anda.</p>
              <p><b>Produk:</b> ${prodName}<br><b>Nominal:</b> Rp ${amount.toLocaleString('id-ID')}</p>
              <hr>
              <p><b>AKSES MATERI:</b><br><a href="${accessUrl}">${accessUrl}</a></p>
              <p><b>AKUN MEMBER:</b><br>Email: ${buyerEmail}<br>Password: ${pass}<br>Login: <a href="${loginUrl}">${loginUrl}</a></p>
            `
          });
          
          // Notif Admin
          const adminWA = getCfgFrom_(cfg, "wa_admin");
          notifications.push({
              wa: adminWA,
              msg: `💰 *PEMBAYARAN DITERIMA!* (Moota)\n\nInv: #${inv}\nUser: ${buyerName}\nNominal: Rp ${amount.toLocaleString('id-ID')}\nStatus: LUNAS`
          });

          break; // Pindah ke mutasi berikutnya setelah match
        }
      }
    }

    // Kirim Notifikasi (Diluar loop sheet agar lebih cepat)
    for (let n of notifications) {
      if (n.wa) sendWA(n.wa, n.msg, cfg);
      if (n.email) sendEmail(n.email, n.subj, n.body, cfg);
    }

    return ContentService.createTextOutput("OK: " + notifications.length + " processed").setMimeType(ContentService.MimeType.TEXT);

  } catch (e) {
    return ContentService.createTextOutput("ERROR: " + e.toString()).setMimeType(ContentService.MimeType.TEXT);
  }
}

/* =========================
   HELPER: GET PRODUCT DETAIL
========================= */
function getProductDetail(d, cfg) {
  try {
    const s = mustSheet_("Access_Rules");
    const schema = getAccessRulesSchema_(s, { ensureBumpHeaders: true });
    const r = s.getDataRange().getValues();
    const id = String(d.id).trim();
    
    // Get ref for user-specific pixel
    const ref = String(d.ref || "").trim();
    let userPixelData = null;

    if (ref) {
       // If ref exists (e.g. u-123456), look for affiliate pixel override
       const apS = ss.getSheetByName("Affiliate_Pixels");
       if (apS) {
           const apR = apS.getDataRange().getValues();
           for(let i=1; i<apR.length; i++) {
               if (String(apR[i][0]) === ref && String(apR[i][1]) === id) {
                   userPixelData = {
                       id: apR[i][2],
                       token: apR[i][3],
                       test_code: apR[i][4]
                   };
                   break;
               }
           }
       }
    }

    for (let i = 1; i < r.length; i++) {
      if (String(r[i][schema.id - 1]).trim() === id) {
        let bumpData = null;
        const bumpId = String(r[i][schema.bump_product_id - 1] || "").trim();
        if (bumpId) {
          for (let k = 1; k < r.length; k++) {
            if (String(r[k][schema.id - 1]).trim() === bumpId) {
              bumpData = {
                id: r[k][schema.id - 1],
                title: r[k][schema.title - 1],
                desc: r[k][schema.desc - 1],
                harga: toNumberSafe_(r[k][schema.harga - 1]),
                image: r[k][schema.image_url - 1] || ""
              };
              break;
            }
          }
        }

        const rowIsBump = r[i][schema.is_bump - 1];
        const isBump = String(rowIsBump || "").toLowerCase() === "true" || rowIsBump === true || String(rowIsBump || "").toUpperCase() === "TRUE";

        return {
          status: "success",
          data: {
            id: r[i][schema.id - 1],
            title: r[i][schema.title - 1],
            desc: r[i][schema.desc - 1],
            url: r[i][schema.url - 1],
            harga: toNumberSafe_(r[i][schema.harga - 1]),
            image: r[i][schema.image_url - 1] || "",
            pixel_id: (userPixelData && userPixelData.id) ? userPixelData.id : (r[i][schema.pixel_id - 1] || ""),
            pixel_token: (userPixelData && userPixelData.token) ? userPixelData.token : (r[i][schema.pixel_token - 1] || ""),
            pixel_test_code: (userPixelData && userPixelData.test_code) ? userPixelData.test_code : (r[i][schema.pixel_test_code - 1] || ""),
            is_bump: isBump,
            bump_product_id: bumpId,
            bump_product: bumpData
          }
        };
      }
    }
    return { status: "error", message: "Produk tidak ditemukan" };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function getProducts(d, cfg) {
  try {
    // 1. Try Cache First (Performance Optimization)
    const cache = CacheService.getScriptCache();
    const cacheKey = "products_public_all_v2";
    let list = [];
    const cached = cache.get(cacheKey);

    if (cached) {
      list = JSON.parse(cached);
    } else {
      // 2. Fetch from Sheet if no cache
      const s = mustSheet_("Access_Rules");
      const schema = getAccessRulesSchema_(s, { ensureBumpHeaders: true });
      const r = s.getDataRange().getValues();
      
      for (let i = 1; i < r.length; i++) {
        if (String(r[i][schema.status - 1]) === "Active") {
           list.push({
               id: r[i][schema.id - 1],
               title: r[i][schema.title - 1],
               harga: toNumberSafe_(r[i][schema.harga - 1]),
               image: r[i][schema.image_url - 1] || "",
               is_bump: (String(r[i][schema.is_bump - 1] || "").toLowerCase() === "true" || r[i][schema.is_bump - 1] === true || String(r[i][schema.is_bump - 1] || "").toUpperCase() === "TRUE"),
               bump_product_id: String(r[i][schema.bump_product_id - 1] || "").trim()
           });
        }
      }
      // Store in cache for 10 minutes (600s)
      if (list.length > 0) {
        cache.put(cacheKey, JSON.stringify(list), 600);
      }
    }

    // 3. Apply User-Specific Filters (Exclude Owned)
    // Note: Owned check is dynamic per user, so we do it AFTER cache retrieval
    const email = String(d.email || "").trim().toLowerCase();
    if (d.exclude_owned && email) {
        const oS = mustSheet_("Orders");
        const oR = oS.getDataRange().getValues();
        const owned = [];
        for(let j=1; j<oR.length; j++) {
            if(String(oR[j][1]).toLowerCase() === email && String(oR[j][7]) === "Lunas") {
                const pids = String(oR[j][4]).split(",");
                pids.forEach(p => owned.push(p.trim()));
            }
        }
        // Filter list
        list = list.filter(p => !owned.includes(String(p.id)));
    }

    return { status: "success", data: list };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

/* =========================
   MEMBER LOGIN
========================= */
function loginUser(d) {
  try {
    const s = mustSheet_("Users");
    const r = s.getDataRange().getValues();
    const email = String(d.email).trim().toLowerCase();
    const pass = String(d.password);

    for (let i = 1; i < r.length; i++) {
      if (String(r[i][1]).toLowerCase() === email && String(r[i][2]) === pass) {
        return { 
            status: "success", 
            data: {
                id: r[i][0],
                nama: r[i][3],
                email: r[i][1],
                role: r[i][4]
            }
        };
      }
    }
    return { status: "error", message: "Email atau Password salah" };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function forgotPassword(d) {
    // Simplified: Just send WA to Admin to reset manually or implement auto-reset
    // For now, return message
    return { status: "success", message: "Silakan hubungi Admin via WhatsApp untuk reset password." };
}

/* =========================
   DASHBOARD DATA
========================= */
function getDashboardData(d) {
  try {
    const email = String(d.email).trim().toLowerCase();
    const oS = mustSheet_("Orders");
    const oR = oS.getDataRange().getValues();
    
    const myOrders = [];
    let uplineId = "";
    let uplineName = "Admin"; // Default upline name
    
    // 1. Get User's Orders & Find Upline from first order (affiliate column)
    for (let i = 1; i < oR.length; i++) {
      if (String(oR[i][1]).toLowerCase() === email) {
        // If status Lunas, add to list
        if (String(oR[i][7]) === "Lunas") {
             myOrders.push({
                 invoice: oR[i][0],
                 product: oR[i][5],
                 date: oR[i][8],
                 access_url: "#" // Url handled dynamically by frontend or separate call
             });
        }
        
        // Find Upline from the FIRST order that has an affiliate code
        if (!uplineId && oR[i][9] && oR[i][9] !== "-") {
            uplineId = oR[i][9];
        }
      }
    }

    // 2. Resolve Upline Name
    if (uplineId) {
        const uS = mustSheet_("Users");
        const uR = uS.getDataRange().getValues();
        for (let k = 1; k < uR.length; k++) {
            if (String(uR[k][0]) === uplineId) {
                uplineName = uR[k][3]; // Nama user
                break;
            }
        }
    }
    
    // 3. Get User ID for Referral Link
    const uS = mustSheet_("Users");
    const uR = uS.getDataRange().getValues();
    let myId = "";
    for(let k=1; k<uR.length; k++) {
        if(String(uR[k][1]).toLowerCase() === email) {
            myId = uR[k][0];
            break;
        }
    }

    // 4. Get Affiliate Stats (My Referrals)
    let affCount = 0;
    let affCom = 0;
    if (myId) {
        for(let i=1; i<oR.length; i++) {
            if(String(oR[i][9]) === myId && String(oR[i][7]) === "Lunas") {
                affCount++;
                affCom += Number(oR[i][10] || 0); // Komisi
            }
        }
    }

    return {
        status: "success",
        data: {
            orders: myOrders,
            upline: { id: uplineId, name: uplineName },
            stats: { sales: affCount, commission: affCom },
            user_id: myId
        }
    };

  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

/* =========================
   UPDATE ORDER STATUS
========================= */
function updateOrderStatus(d, cfg) {
  try {
    const oS = mustSheet_("Orders");
    const r = oS.getDataRange().getValues();
    const id = String(d.id).trim();
    const newStatus = d.status || "Lunas"; // Default Lunas if not specified

    for (let i = 1; i < r.length; i++) {
      if (String(r[i][0]) === id) {
        oS.getRange(i + 1, 8).setValue(newStatus);
        
        // If changing to Lunas, trigger notification (optional, simplified here)
        // In real app, we might want to resend access info.
        
        return { status: "success", message: "Status order diperbarui menjadi " + newStatus };
      }
    }
    return { status: "error", message: "Order tidak ditemukan" };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

/* =========================
   PAGE CMS (GET CONTENT)
========================= */
function getPageContent(d) {
  try {
    const s = mustSheet_("Pages");
    const r = s.getDataRange().getValues();
    const slug = String(d.slug).trim();

    for (let i = 1; i < r.length; i++) {
      if (String(r[i][1]) === slug && String(r[i][4]) === "Active") {
        return { 
          status: "success", 
          title: r[i][2], 
          content: r[i][3],
          pixel_id: r[i][7] || "",
          pixel_token: r[i][8] || "",
          pixel_test_code: r[i][9] || "",
          theme_mode: r[i][10] || "light"
        };
      }
    }
    return { status: "error" };
  } catch (e) {
    return { status: "error" };
  }
}

function getAllPages(d) {
  try {
    const r = mustSheet_("Pages").getDataRange().getValues();
    const data = [];
    const filterOwner = String(d.owner_id || "").trim();
    const onlyMine = d.only_mine === true;

    for (let i = 1; i < r.length; i++) {
      if (String(r[i][4]) === "Active") {
        // Kolom 7 (index 6) adalah Owner ID. Jika kosong, anggap milik ADMIN (Global)
        const pageOwner = String(r[i][6] || "ADMIN").trim(); 

        if (onlyMine) {
            // Mode "Halaman Saya": Hanya tampilkan milik user ini
            if (pageOwner === filterOwner) data.push(r[i]);
        } else {
            // Mode Default (Global): Tampilkan halaman ADMIN (untuk affiliate link)
            if (pageOwner === "ADMIN") data.push(r[i]);
        }
      }
    }
    return { status: "success", data: data };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function adminLogin(d) {
  const u = mustSheet_("Users").getDataRange().getValues();
  const e = String(d.email).trim().toLowerCase();
  for (let i = 1; i < u.length; i++) {
    if (
      String(u[i][1]).toLowerCase() === e &&
      String(u[i][2]) === String(d.password) &&
      String(u[i][4]).toLowerCase() === "admin"
    ) return { status: "success", data: { nama: u[i][3] } };
  }
  return { status: "error" };
}

function getAdminData(cfg) {
  try {
    cfg = cfg || getSettingsMap_();
    const o = mustSheet_("Orders").getDataRange().getValues();
    const u = mustSheet_("Users").getDataRange().getValues();
    const s = mustSheet_("Settings").getDataRange().getValues();
    const accessSheet = mustSheet_("Access_Rules");
    const p = accessSheet.getDataRange().getValues();
    const pg = mustSheet_("Pages").getDataRange().getValues();

    let rev = 0;
    for (let i = 1; i < o.length; i++) {
      if (String(o[i][7]) === "Lunas") rev += Number(o[i][6] || 0);
    }

    let t = {};
    for (let i = 1; i < s.length; i++) {
      if (s[i][0]) t[s[i][0]] = s[i][1];
    }

    const schema = getAccessRulesSchema_(accessSheet, { ensureBumpHeaders: true });
    const products = [];
    for (let i = 1; i < p.length; i++) {
      const row = p[i];
      products.push([
        row[schema.id - 1] || "",
        row[schema.title - 1] || "",
        row[schema.desc - 1] || "",
        row[schema.url - 1] || "",
        row[schema.harga - 1] || "",
        row[schema.status - 1] || "",
        row[schema.lp_url - 1] || "",
        row[schema.image_url - 1] || "",
        row[schema.pixel_id - 1] || "",
        row[schema.pixel_token - 1] || "",
        row[schema.pixel_test_code - 1] || "",
        row[schema.commission - 1] || "",
        row[schema.is_bump - 1] || false,
        row[schema.bump_product_id - 1] || ""
      ]);
    }

    return {
      status: "success",
      stats: { users: u.length - 1, orders: o.length - 1, rev: rev },
      orders: o.slice(1).reverse(),
      products: products,
      pages: pg.slice(1),
      settings: t,
      users: u.slice(1).reverse()
    };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function normalizeHeaderKey_(v) {
  const s = String(v || "").trim().toLowerCase();
  return s.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function getHeaderRow_(sheet, width) {
  const w = Math.max(1, Number(width || sheet.getLastColumn() || sheet.getMaxColumns() || 1));
  return sheet.getRange(1, 1, 1, w).getValues()[0];
}

function resolveFieldCol_(headerIndexMap, aliases) {
  for (let i = 0; i < aliases.length; i++) {
    const k = normalizeHeaderKey_(aliases[i]);
    if (headerIndexMap[k]) return headerIndexMap[k];
  }
  return 0;
}

function getAccessRulesSchema_(sheet, opts) {
  const options = opts || {};
  const fields = {
    id: ["id", "product_id"],
    title: ["title", "nama", "name"],
    desc: ["desc", "description", "deskripsi"],
    url: ["post_url", "url", "post url", "checkout_url"],
    harga: ["harga", "price"],
    status: ["status"],
    lp_url: ["lp_url", "lp url", "landing_page", "landingpage", "lp"],
    image_url: ["image_url", "link_co", "link co", "image", "img_url", "img", "link"],
    pixel_id: ["pixel_id", "meta_pixel_id", "pixel"],
    pixel_token: ["pixel_token", "meta_pixel_token"],
    pixel_test_code: ["pixel_test_code", "pixel_test", "meta_pixel_test_event", "pixel_test_event"],
    commission: ["commission", "komisi"],
    is_bump: ["is_bump", "bump", "bump_flag"],
    bump_product_id: ["bump_product_id", "bump_id", "bump_product"]
  };

  const expected = [
    "id",
    "title",
    "desc",
    "post_url",
    "harga",
    "status",
    "lp_url",
    "image_url",
    "pixel_id",
    "pixel_token",
    "pixel_test_code",
    "commission",
    "is_bump",
    "bump_product_id"
  ];

  const minCols = expected.length;
  const sheetCols = Math.max(1, sheet.getLastColumn() || 1);
  if (sheetCols < minCols) {
    sheet.insertColumnsAfter(sheetCols, minCols - sheetCols);
  }

  const lastCol = Math.max(minCols, sheet.getLastColumn() || minCols);
  const header = getHeaderRow_(sheet, lastCol);
  const headerIndexMap = {};
  for (let c = 0; c < header.length; c++) {
    const key = normalizeHeaderKey_(header[c]);
    if (key && !headerIndexMap[key]) headerIndexMap[key] = c + 1;
  }

  let schema = {};
  Object.keys(fields).forEach((k) => {
    schema[k] = resolveFieldCol_(headerIndexMap, fields[k]);
  });

  const needFill = [];
  if (!schema.id && normalizeHeaderKey_(header[0] || "") === "") needFill.push({ col: 1, header: "id" });
  if (!schema.title && normalizeHeaderKey_(header[1] || "") === "") needFill.push({ col: 2, header: "title" });
  if (!schema.desc && normalizeHeaderKey_(header[2] || "") === "") needFill.push({ col: 3, header: "desc" });
  if (!schema.url && normalizeHeaderKey_(header[3] || "") === "") needFill.push({ col: 4, header: "post_url" });
  if (!schema.harga && normalizeHeaderKey_(header[4] || "") === "") needFill.push({ col: 5, header: "harga" });
  if (!schema.status && normalizeHeaderKey_(header[5] || "") === "") needFill.push({ col: 6, header: "status" });
  if (!schema.lp_url && normalizeHeaderKey_(header[6] || "") === "") needFill.push({ col: 7, header: "lp_url" });
  if (!schema.image_url && normalizeHeaderKey_(header[7] || "") === "") needFill.push({ col: 8, header: "image_url" });
  if (!schema.pixel_id && normalizeHeaderKey_(header[8] || "") === "") needFill.push({ col: 9, header: "pixel_id" });
  if (!schema.pixel_token && normalizeHeaderKey_(header[9] || "") === "") needFill.push({ col: 10, header: "pixel_token" });
  if (!schema.pixel_test_code && normalizeHeaderKey_(header[10] || "") === "") needFill.push({ col: 11, header: "pixel_test_code" });
  if (!schema.commission && normalizeHeaderKey_(header[11] || "") === "") needFill.push({ col: 12, header: "commission" });
  if (!schema.is_bump && normalizeHeaderKey_(header[12] || "") === "") needFill.push({ col: 13, header: "is_bump" });
  if (!schema.bump_product_id && normalizeHeaderKey_(header[13] || "") === "") needFill.push({ col: 14, header: "bump_product_id" });

  if (needFill.length) {
    for (let i = 0; i < needFill.length; i++) {
      sheet.getRange(1, needFill[i].col).setValue(needFill[i].header);
    }
    return getAccessRulesSchema_(sheet, { ensureBumpHeaders: false });
  }

  const required = ["id", "title", "desc", "url", "harga", "status", "lp_url", "is_bump", "bump_product_id"];
  const missing = required.filter((k) => !schema[k]);
  if (missing.length) throw new Error("Header Access_Rules tidak lengkap: " + missing.join(", "));

  if (options.ensureBumpHeaders) {
    const stillMissingBump = [];
    if (!schema.is_bump) stillMissingBump.push("is_bump");
    if (!schema.bump_product_id) stillMissingBump.push("bump_product_id");
    if (stillMissingBump.length) throw new Error("Header Access_Rules tidak lengkap: " + stillMissingBump.join(", "));
  }

  return schema;
}

function validateAccessRules() {
  try {
    const s = mustSheet_("Access_Rules");
    const lastCol = Math.max(1, s.getLastColumn() || 1);
    const header = getHeaderRow_(s, Math.max(14, lastCol));
    const schema = getAccessRulesSchema_(s, { ensureBumpHeaders: true });
    const normalized = header.map((h) => normalizeHeaderKey_(h));
    return {
      status: "success",
      sheet: "Access_Rules",
      last_row: s.getLastRow(),
      last_col: s.getLastColumn(),
      header: header,
      header_normalized: normalized,
      schema: schema
    };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

/* =========================
   SAVE PRODUCT / PAGE / SETTINGS
========================= */
function saveProduct(d) {
  try {
    const s = mustSheet_("Access_Rules");
    const schema = getAccessRulesSchema_(s, { ensureBumpHeaders: true });

    const id = String(d.id || "").trim();
    if (!id) return { status: "error", message: "ID produk wajib diisi" };

    const bumpIdRaw = String(d.bump_product_id || "").trim();
    if (bumpIdRaw && bumpIdRaw === id) {
      return { status: "error", message: "Bump Order tidak boleh memilih produk yang sama" };
    }

    if (bumpIdRaw) {
      const rCheck = s.getDataRange().getValues();
      let found = false;
      for (let i = 1; i < rCheck.length; i++) {
        if (String(rCheck[i][schema.id - 1] || "").trim() === bumpIdRaw) {
          found = true;
          break;
        }
      }
      if (!found) {
        return { status: "error", message: "Produk Bump tidak ditemukan di Access_Rules: " + bumpIdRaw };
      }
    }

    const isBump = String(d.is_bump || "").toLowerCase() === "true" || d.is_bump === true || String(d.is_bump || "").toUpperCase() === "TRUE";
    const fieldsToWrite = {
      id: id,
      title: d.title || "",
      desc: d.desc || "",
      url: d.url || "",
      harga: d.harga || "",
      status: d.status || "Active",
      lp_url: d.lp_url || "",
      image_url: d.image_url || "",
      pixel_id: d.pixel_id || "",
      pixel_token: d.pixel_token || "",
      pixel_test_code: d.pixel_test_code || "",
      commission: d.commission || "",
      is_bump: isBump,
      bump_product_id: bumpIdRaw
    };
    const isEdit = String(d.is_edit) === "true";

    if (isEdit) {
      const r = s.getDataRange().getValues();
      for (let i = 1; i < r.length; i++) {
        if (String(r[i][schema.id - 1]).trim() === id) {
          const lastCol = Math.max(1, s.getLastColumn() || 1);
          const rowNow = s.getRange(i + 1, 1, 1, lastCol).getValues()[0];
          Object.keys(fieldsToWrite).forEach((k) => {
            const col = schema[k];
            if (col) rowNow[col - 1] = fieldsToWrite[k];
          });
          s.getRange(i + 1, 1, 1, lastCol).setValues([rowNow]);
          return { status: "success" };
        }
      }
      return { status: "error", message: "ID Produk tidak ditemukan untuk diedit" };
    } else {
      const lastCol = Math.max(1, s.getLastColumn() || 1);
      const newRow = new Array(lastCol).fill("");
      Object.keys(fieldsToWrite).forEach((k) => {
        const col = schema[k];
        if (col) newRow[col - 1] = fieldsToWrite[k];
      });
      s.appendRow(newRow);
      return { status: "success" };
    }
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function deleteProduct(d) {
  try {
    const s = mustSheet_("Access_Rules");
    const r = s.getDataRange().getValues();
    const id = String(d.id).trim();

    for (let i = 1; i < r.length; i++) {
      if (String(r[i][0]).trim() === id) {
        s.deleteRow(i + 1);
        return { status: "success", message: "Produk berhasil dihapus" };
      }
    }
    return { status: "error", message: "ID Produk tidak ditemukan" };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function savePage(d) {
  try {
    const s = mustSheet_("Pages");
    const isEdit = String(d.is_edit) === "true";
    const ownerId = String(d.owner_id || "ADMIN").trim(); // Default ke ADMIN
    const slug = String(d.slug).trim();
    const id = String(d.id).trim();

    const r = s.getDataRange().getValues();

    // 1. Cek Unik Slug (Global Check)
    for (let i = 1; i < r.length; i++) {
        const rowSlug = String(r[i][1]).trim();
        const rowId = String(r[i][0]).trim();
        
        if (rowSlug === slug) {
            // Jika slug sama, pastikan ini adalah halaman yang sama (sedang diedit)
            // Jika ID beda, berarti slug sudah dipakai orang lain
            if (isEdit && rowId === id) {
                // Ini halaman kita sendiri, lanjut
            } else {
                return { status: "error", message: "Slug URL sudah digunakan. Pilih slug lain." };
            }
        }
    }

    // Check if columns exist
    const maxCols = s.getMaxColumns();
    if (maxCols < 11) s.insertColumnsAfter(maxCols, 11 - maxCols);

    if (isEdit) {
      for (let i = 1; i < r.length; i++) {
        if (String(r[i][0]).trim() === id) {
          // Hanya izinkan edit jika owner cocok (atau admin bisa edit semua)
          const existingOwner = String(r[i][6] || "ADMIN").trim();
          
           if (existingOwner !== ownerId && ownerId !== "ADMIN") { 
              return { status: "error", message: "Anda tidak memiliki izin mengedit halaman ini." };
           }

          s.getRange(i + 1, 1, 1, 4).setValues([[d.id, slug, d.title, d.content]]);
          // Update Meta Pixel Columns (Col 8, 9, 10) + Theme Mode (Col 11)
          s.getRange(i + 1, 8, 1, 4).setValues([[d.meta_pixel_id || "", d.meta_pixel_token || "", d.meta_pixel_test_event || "", d.theme_mode || "light"]]);
          return { status: "success" };
        }
      }
      return { status: "error", message: "ID Halaman tidak ditemukan" };
    } else {
      const newId = "PG-" + Date.now();
      // Tambahkan Owner ID di kolom ke-7 (index 6) + Meta Pixel (7,8,9) + Theme Mode (10)
      s.appendRow([newId, slug, d.title, d.content, "Active", toISODate_(), ownerId, d.meta_pixel_id || "", d.meta_pixel_token || "", d.meta_pixel_test_event || "", d.theme_mode || "light"]);
      return { status: "success" };
    }
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function deletePage(d) {
  try {
    const s = mustSheet_("Pages");
    const id = String(d.id).trim();
    const ownerId = String(d.owner_id || "ADMIN").trim();

    const r = s.getDataRange().getValues();
    for (let i = 1; i < r.length; i++) {
      if (String(r[i][0]).trim() === id) {
        // Security Check: Only Owner or Admin can delete
        const pageOwner = String(r[i][6] || "ADMIN").trim();
        if (pageOwner !== ownerId && ownerId !== "ADMIN") {
            return { status: "error", message: "Anda tidak memiliki izin menghapus halaman ini." };
        }
        
        s.deleteRow(i + 1);
        return { status: "success", message: "Halaman berhasil dihapus" };
      }
    }
    return { status: "error", message: "ID Halaman tidak ditemukan" };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function checkSlug(d) {
  try {
    const s = mustSheet_("Pages");
    const slug = String(d.slug).trim();
    const excludeId = String(d.exclude_id || "").trim(); // For edit mode
    
    const r = s.getDataRange().getValues();
    for (let i = 1; i < r.length; i++) {
      const rowSlug = String(r[i][1]).trim();
      const rowId = String(r[i][0]).trim();
      
      if (rowSlug === slug) {
          if (excludeId && rowId === excludeId) {
              // Same page, it's fine
          } else {
              return { status: "success", available: false, message: "Slug URL sudah digunakan" };
          }
      }
    }
    return { status: "success", available: true, message: "Slug URL tersedia" };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function updateSettings(d) {
  const s = mustSheet_("Settings");
  const r = s.getDataRange().getValues();
  for (let k in d.payload) {
    let f = false;
    for (let i = 1; i < r.length; i++) {
      if (r[i][0] === k) {
        s.getRange(i + 1, 2).setValue(d.payload[k]);
        f = true;
        break;
      }
    }
    if (!f) s.appendRow([k, d.payload[k]]);
  }
  return { status: "success" };
}

/* =========================
   IMAGEKIT AUTH
========================= */
function getImageKitAuth(cfg) {
  cfg = cfg || getSettingsMap_();
  const p = getCfgFrom_(cfg, "ik_private_key");
  if (!p) return { status: "error" };

  const t = Utilities.getUuid();
  const exp = Math.floor(Date.now() / 1000) + 2400;
  const toSign = t + exp;

  const sig = Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, toSign, p)
    .map(b => ("0" + (b & 255).toString(16)).slice(-2))
    .join("");

  return { status: "success", token: t, expire: exp, signature: sig };
}

/* =========================
   CHANGE PASSWORD
========================= */
function changeUserPassword(d) {
  try {
    const s = mustSheet_("Users");
    const r = s.getDataRange().getValues();
    const email = String(d.email).trim().toLowerCase();
    const oldPass = String(d.old_password);
    const newPass = String(d.new_password);

    for (let i = 1; i < r.length; i++) {
      if (String(r[i][1]).trim().toLowerCase() === email) {
        if (String(r[i][2]) === oldPass) {
          s.getRange(i + 1, 3).setValue(newPass);
          return { status: "success", message: "Password berhasil diubah" };
        } else {
          return { status: "error", message: "Password lama salah!" };
        }
      }
    }
    return { status: "error", message: "Email pengguna tidak ditemukan." };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

/* =========================
   UPDATE PROFILE (NAMA & EMAIL)
========================= */
function updateUserProfile(d) {
  try {
    const s = mustSheet_("Users");
    const r = s.getDataRange().getValues();
    const currentEmail = String(d.email).trim().toLowerCase();
    const newName = String(d.new_name).trim();
    const newEmail = String(d.new_email).trim().toLowerCase();
    const password = String(d.password); // Verify password before updating sensitive info

    if (!newName || !newEmail) return { status: "error", message: "Nama dan Email baru wajib diisi." };

    let userRowIndex = -1;
    let currentData = null;

    // 1. Verify User & Check duplicate email if changed
    for (let i = 1; i < r.length; i++) {
      const rowEmail = String(r[i][1]).trim().toLowerCase();
      
      // Find current user
      if (rowEmail === currentEmail) {
        if (String(r[i][2]) !== password) return { status: "error", message: "Password salah!" };
        userRowIndex = i + 1;
        currentData = r[i];
      } 
      
      // Check if new email is already taken by SOMEONE ELSE
      if (rowEmail === newEmail && rowEmail !== currentEmail) {
        return { status: "error", message: "Email baru sudah digunakan oleh pengguna lain." };
      }
    }

    if (userRowIndex === -1) return { status: "error", message: "Pengguna tidak ditemukan." };

    // 2. Update Users Sheet
    // Col 2: Email (index 1), Col 4: Nama (index 3)
    // Note: getRange(row, col) is 1-based.
    s.getRange(userRowIndex, 2).setValue(newEmail);
    s.getRange(userRowIndex, 4).setValue(newName);

    // 3. Update Orders Sheet if email changed (Consistency)
    if (newEmail !== currentEmail) {
      const oS = mustSheet_("Orders");
      const oR = oS.getDataRange().getValues();
      for (let j = 1; j < oR.length; j++) {
        if (String(oR[j][1]).toLowerCase() === currentEmail) {
          oS.getRange(j + 1, 2).setValue(newEmail);
          oS.getRange(j + 1, 3).setValue(newName); // Update name as well
        }
      }
    } else {
       // Just update name in Orders if email same
      const oS = mustSheet_("Orders");
      const oR = oS.getDataRange().getValues();
      for (let j = 1; j < oR.length; j++) {
        if (String(oR[j][1]).toLowerCase() === currentEmail) {
          oS.getRange(j + 1, 3).setValue(newName);
        }
      }
    }

    return { status: "success", message: "Profil berhasil diperbarui", new_email: newEmail, new_name: newName };

  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

/* =========================
   AFFILIATE PIXEL SETTINGS
========================= */
function saveAffiliatePixel(d) {
  try {
    const sName = "Affiliate_Pixels";
    let s = ss.getSheetByName(sName);
    if (!s) {
      s = ss.insertSheet(sName);
      s.appendRow(["user_id", "product_id", "pixel_id", "pixel_token", "pixel_test_code"]);
    }
    
    // 1. Get User ID from Email (Secure way: use login token if available, but here we trust email for now as it's backend call from trusted client logic)
    // Ideally we should use session token, but current system uses email.
    const email = String(d.email || "").trim().toLowerCase();
    if (!email) return { status: "error", message: "Email wajib diisi" };

    const uS = mustSheet_("Users");
    const uR = uS.getDataRange().getValues();
    let userId = "";
    
    for (let i = 1; i < uR.length; i++) {
      if (String(uR[i][1]).toLowerCase() === email) { 
        userId = String(uR[i][0]); 
        break; 
      }
    }
    
    if (!userId) return { status: "error", message: "User tidak ditemukan" };
    
    const productId = String(d.product_id).trim();
    const pixelId = String(d.pixel_id || "").trim();
    const pixelToken = String(d.pixel_token || "").trim();
    const pixelTest = String(d.pixel_test_code || "").trim();

    const r = s.getDataRange().getValues();
    let found = false;

    for (let i = 1; i < r.length; i++) {
      if (String(r[i][0]) === userId && String(r[i][1]) === productId) {
        // Update existing row (Col 3, 4, 5 -> index 2, 3, 4)
        s.getRange(i + 1, 3, 1, 3).setValues([[pixelId, pixelToken, pixelTest]]);
        found = true;
        break;
      }
    }

    if (!found) {
      s.appendRow([userId, productId, pixelId, pixelToken, pixelTest]);
    }
    
    return { status: "success", message: "Pixel berhasil disimpan" };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

/* =========================
   PERMISSION WARMUP
========================= */
function pancinganIzin() {
  SpreadsheetApp.getActiveSpreadsheet().getName();
  MailApp.getRemainingDailyQuota();
  UrlFetchApp.fetch("https://google.com");
  Logger.log("Pancingan sukses! Izin berhasil di-refresh.");
}

function normalizeUsersSheet() {
  try {
    const s = mustSheet_("Users");
    const r = s.getDataRange().getValues();
    let fixed = 0;
    for (let i = 1; i < r.length; i++) {
      const role = String(r[i][4] || "").trim();
      const status = String(r[i][5] || "").trim();
      const joinDate = String(r[i][6] || "").trim();
      const expired = String(r[i][7] || "").trim();
      let needWrite = false;
      let newRole = role || "member";
      let newStatus = status || "Active";
      let newJoin = joinDate;
      let newExpired = expired || "-";
      const isDateLike = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) || /\d{1,2}\/\d{1,2}\/\d{4}/.test(String(v));
      if (!isDateLike(joinDate) && isDateLike(status)) {
        newJoin = status;
        newStatus = "Active";
        needWrite = true;
      }
      if (role !== newRole || status !== newStatus || joinDate !== newJoin || expired !== newExpired) {
        needWrite = true;
      }
      if (needWrite) {
        s.getRange(i + 1, 5, 1, 4).setValues([[newRole, newStatus, newJoin || toISODate_(), newExpired]]);
        fixed++;
      }
    }
    return { status: "success", fixed };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}
/* =========================
   DUITKU PAYMENT GATEWAY
========================= */
/* =========================
   BIO LINK
========================= */
function saveBioLink(d) {
  try {
    const sName = "Bio_Links";
    let s = ss.getSheetByName(sName);
    if (!s) {
      s = ss.insertSheet(sName);
      s.appendRow(["user_id", "photo_url", "display_name", "tagline", "social_wa", "social_email", "custom_slug"]);
    }

    const email = String(d.email || "").trim().toLowerCase();
    if (!email) return { status: "error", message: "Email wajib diisi" };

    const uS = mustSheet_("Users");
    const uR = uS.getDataRange().getValues();
    let userId = "";
    
    for (let i = 1; i < uR.length; i++) {
      if (String(uR[i][1]).toLowerCase() === email) { 
        userId = String(uR[i][0]); 
        break; 
      }
    }
    
    if (!userId) return { status: "error", message: "User tidak ditemukan" };

    const photo = d.photo_url || "";
    const name = d.display_name || "";
    const tagline = d.tagline || "";
    const wa = d.social_wa || "";
    const mail = d.social_email || "";
    const slug = d.custom_slug || "";

    const r = s.getDataRange().getValues();
    let found = false;

    for (let i = 1; i < r.length; i++) {
      if (String(r[i][0]) === userId) {
        s.getRange(i + 1, 2, 1, 6).setValues([[photo, name, tagline, wa, mail, slug]]);
        found = true;
        break;
      }
    }

    if (!found) {
      s.appendRow([userId, photo, name, tagline, wa, mail, slug]);
    }

    return { status: "success", message: "Bio berhasil disimpan" };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function getBioLink(d) {
  try {
    const slug = String(d.slug || "").trim();
    if (!slug) return { status: "error", message: "Slug required" };

    // 1. Search by Custom Slug or User ID in Bio_Links
    const s = mustSheet_("Bio_Links");
    const r = s.getDataRange().getValues();
    let bioData = null;
    let userId = "";

    // Check Bio_Links first
    for (let i = 1; i < r.length; i++) {
      // Check Custom Slug (Col 7 / Index 6) OR User ID (Col 1 / Index 0)
      if (String(r[i][6]) === slug || String(r[i][0]) === slug) {
        bioData = {
          photo_url: r[i][1],
          display_name: r[i][2],
          tagline: r[i][3],
          social_wa: r[i][4],
          social_email: r[i][5],
          user_id: r[i][0]
        };
        userId = r[i][0];
        break;
      }
    }

    // 2. Fallback: If not in Bio_Links, check Users sheet (Basic Profile)
    if (!bioData) {
        const uS = mustSheet_("Users");
        const uR = uS.getDataRange().getValues();
        for (let k = 1; k < uR.length; k++) {
            if (String(uR[k][0]) === slug) {
                // Found in Users! Use basic info
                userId = uR[k][0];
                bioData = {
                    photo_url: "https://ui-avatars.com/api/?name=" + encodeURIComponent(uR[k][3]) + "&background=random",
                    display_name: uR[k][3],
                    tagline: "Member",
                    social_wa: "",
                    social_email: uR[k][1],
                    user_id: userId
                };
                break;
            }
        }
    }

    if (!bioData) return { status: "error", message: "Bio tidak ditemukan" };

    // 3. Get Products for this User (Affiliate Links)
    // Logic: Get ALL active products, and append ?ref=USER_ID
    const pS = mustSheet_("Access_Rules");
    const pR = pS.getDataRange().getValues();
    const products = [];

    for (let i = 1; i < pR.length; i++) {
      if (String(pR[i][5]) === "Active") {
         products.push({
             title: pR[i][1],
             url: pR[i][3] + "?ref=" + userId, // Affiliate Link
             image: pR[i][7] || "",
             price: pR[i][4]
         });
      }
    }

    return { 
      status: "success", 
      data: {
        profile: bioData,
        products: products
      }
    };

  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

/* =========================
   ANALYTICS (LOG EVENT)
========================= */
function logAnalyticsEvent(d) {
    try {
        const sName = "Analytics";
        let s = ss.getSheetByName(sName);
        if (!s) {
            s = ss.insertSheet(sName);
            s.appendRow(["Timestamp", "Event", "Label", "Value", "Ref", "User_Agent"]);
        }
        
        s.appendRow([
            new Date(),
            d.event || "unknown",
            d.label || "",
            d.value || "",
            d.ref || "",
            d.ua || ""
        ]);
        
        return { status: "success" };
    } catch(e) {
        return { status: "error" };
    }
}

/* =========================
   GITHUB SYNC
========================= */
function saveGithubConfig(d) {
  try {
    const p = PropertiesService.getScriptProperties();
    const payload = d.payload;
    
    if (payload.token) p.setProperty("GH_TOKEN", payload.token);
    if (payload.owner) p.setProperty("GH_OWNER", payload.owner);
    if (payload.repo) p.setProperty("GH_REPO", payload.repo);
    if (payload.path) p.setProperty("GH_PATH", payload.path);
    
    return jsonRes({ status: "success", message: "Konfigurasi GitHub tersimpan." });
  } catch (e) {
    return jsonRes({ status: "error", message: e.toString() });
  }
}

function getGithubConfig() {
  try {
    const p = PropertiesService.getScriptProperties();
    return jsonRes({
      status: "success",
      config: {
        owner: p.getProperty("GH_OWNER"),
        repo: p.getProperty("GH_REPO"),
        path: p.getProperty("GH_PATH"),
        has_token: !!p.getProperty("GH_TOKEN")
      }
    });
  } catch (e) {
    return jsonRes({ status: "error", message: e.toString() });
  }
}

function syncUrlToRepo(cfg) {
  const log = [];
  try {
    const p = PropertiesService.getScriptProperties();
    const token = p.getProperty("GH_TOKEN");
    const owner = p.getProperty("GH_OWNER");
    const repo = p.getProperty("GH_REPO");
    const path = p.getProperty("GH_PATH") || "config.js";

    if (!token || !owner || !repo) {
      return jsonRes({ status: "error", message: "Konfigurasi GitHub belum lengkap." });
    }

    const currentUrl = ScriptApp.getService().getUrl();
    log.push("Current Web App URL: " + currentUrl);

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const opts = {
      headers: {
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github.v3+json"
      },
      muteHttpExceptions: true
    };

    const res = UrlFetchApp.fetch(url, opts);
    if (res.getResponseCode() !== 200) {
      throw new Error("Gagal mengambil file config.js: " + res.getContentText());
    }

    const fileData = JSON.parse(res.getContentText());
    const sha = fileData.sha;
    const content = Utilities.newBlob(Utilities.base64Decode(fileData.content)).getDataAsString();
    
    const regex = /window\.SCRIPT_URL\s*=\s*[\"'].*?[\"'];/;
    const newLine = `window.SCRIPT_URL = "${currentUrl}";`;
    
    if (content.includes(newLine)) {
       log.push("URL sudah sinkron. Tidak ada perubahan.");
       logSyncActivity_(currentUrl, "Skipped", "URL already synced");
       return jsonRes({ status: "success", message: "URL sudah up-to-date.", logs: log });
    }

    let newContent = content;
    if (regex.test(content)) {
        newContent = content.replace(regex, newLine);
    } else {
        log.push("Format config.js tidak dikenali, menambahkan baris baru.");
        newContent += "\n" + newLine;
    }

    const putBody = {
      message: "chore: update script url [skip ci]",
      content: Utilities.base64Encode(newContent),
      sha: sha
    };
    
    const putOpts = {
      method: "put",
      headers: {
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(putBody),
      muteHttpExceptions: true
    };

    const putRes = UrlFetchApp.fetch(url, putOpts);
    if (putRes.getResponseCode() !== 200 && putRes.getResponseCode() !== 201) {
       throw new Error("Gagal update config.js: " + putRes.getContentText());
    }

    log.push("Sukses update config.js ke URL baru.");
    
    // Log to Sheet
    logSyncActivity_(currentUrl, "Success", log.join("\n"));

    return jsonRes({ status: "success", message: "Sinkronisasi Berhasil!", logs: log });

  } catch (e) {
    // Fallback: Send Email to Admin
    const adminEmail = Session.getEffectiveUser().getEmail();
    try {
      MailApp.sendEmail({
        to: adminEmail,
        subject: "[ALERT] Gagal Sinkronisasi URL Script ke GitHub",
        body: `Sistem gagal memperbarui URL config.js secara otomatis.\n\nError:\n${e.toString()}\n\nLogs:\n${log.join("\n")}\n\nSilakan perbarui manual atau cek konfigurasi.`
      });
      log.push("Fallback: Email notifikasi dikirim ke admin (" + adminEmail + ")");
    } catch (mailErr) {
      log.push("Fallback Error: Gagal mengirim email notifikasi (" + mailErr.toString() + ")");
    }

    logSyncActivity_("Unknown", "Error", e.toString());
    return jsonRes({ status: "error", message: e.toString(), logs: log });
  }
}

function logSyncActivity_(url, status, details) {
  try {
    let s = ss.getSheetByName("System_Logs");
    if (!s) {
      s = ss.insertSheet("System_Logs");
      s.appendRow(["Timestamp", "Type", "URL", "Status", "Details"]);
    }
    s.appendRow([new Date(), "URL_SYNC", url, status, details]);
  } catch (e) {}
}

function getAutoSyncStatus() {
  const triggers = ScriptApp.getProjectTriggers();
  let enabled = false;
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "syncUrlToRepo") {
      enabled = true;
      break;
    }
  }
  return jsonRes({ status: "success", enabled: enabled });
}

function toggleAutoSync(d) {
  try {
    const enable = String(d.enabled) === "true";
    const triggers = ScriptApp.getProjectTriggers();
    let existing = null;
    
    for (let i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === "syncUrlToRepo") {
        existing = triggers[i];
        break;
      }
    }

    if (enable) {
      if (!existing) {
        ScriptApp.newTrigger("syncUrlToRepo")
          .timeBased()
          .everyHours(1)
          .create();
      }
      return jsonRes({ status: "success", message: "Auto-Sync diaktifkan (Setiap 1 Jam)." });
    } else {
      if (existing) {
        ScriptApp.deleteTrigger(existing);
      }
      return jsonRes({ status: "success", message: "Auto-Sync dinonaktifkan." });
    }
  } catch (e) {
    return jsonRes({ status: "error", message: "Gagal mengatur trigger: " + e.toString() });
  }
}
 
 / *   = = = = = = = = = = = = = = = = = = = = = = = = = 
 
       M A S T E R   D A T A B A S E   &   S Y N C 
 
 = = = = = = = = = = = = = = = = = = = = = = = = =   * / 
 
 f u n c t i o n   i n i t M a s t e r D B ( )   { 
 
     t r y   { 
 
         c o n s t   s N a m e   =   " M a s t e r _ P r o d u c t s " ; 
 
         l e t   s   =   s s . g e t S h e e t B y N a m e ( s N a m e ) ; 
 
         i f   ( ! s )   { 
 
             s   =   s s . i n s e r t S h e e t ( s N a m e ) ; 
 
             / /   H e a d e r :   S K U ,   N a m e ,   S e l l   P r i c e ,   B u y   P r i c e ,   S t o c k ,   C a t e g o r y ,   S u p p l i e r ,   U p d a t e d ,   S t a t u s ,   A c c e s s   L i n k ,   D e s c ,   I m a g e ,   L P ,   C o m m i s s i o n ,   P i x e l   I D ,   P i x e l   T o k e n ,   T e s t   C o d e ,   I s   B u m p 
 
             c o n s t   h e a d e r s   =   [ 
 
                 " s k u " ,   " n a m e " ,   " p r i c e _ s e l l " ,   " p r i c e _ b u y " ,   " s t o c k " ,   " c a t e g o r y " ,   " s u p p l i e r " ,   " u p d a t e d _ a t " ,   " s t a t u s " ,   
 
                 " a c c e s s _ l i n k " ,   " d e s c r i p t i o n " ,   " i m a g e _ u r l " ,   " l p _ u r l " ,   " c o m m i s s i o n " ,   " p i x e l _ i d " ,   " p i x e l _ t o k e n " ,   " p i x e l _ t e s t " ,   " i s _ b u m p " 
 
             ] ; 
 
             s . a p p e n d R o w ( h e a d e r s ) ; 
 
             
 
             / /   M i g r a t e   e x i s t i n g   d a t a   f r o m   A c c e s s _ R u l e s 
 
             c o n s t   a r   =   s s . g e t S h e e t B y N a m e ( " A c c e s s _ R u l e s " ) ; 
 
             i f   ( a r )   { 
 
                 c o n s t   d a t a   =   a r . g e t D a t a R a n g e ( ) . g e t V a l u e s ( ) ; 
 
                 / /   S k i p   h e a d e r 
 
                 f o r   ( l e t   i   =   1 ;   i   <   d a t a . l e n g t h ;   i + + )   { 
 
                     c o n s t   r   =   d a t a [ i ] ; 
 
                     / /   M a p   A c c e s s _ R u l e s   t o   M a s t e r _ P r o d u c t s 
 
                     / /   A R :   I D ( 0 ) ,   T i t l e ( 1 ) ,   D e s c ( 2 ) ,   U R L ( 3 ) ,   H a r g a ( 4 ) ,   S t a t u s ( 5 ) ,   L P ( 6 ) ,   I m g ( 7 ) ,   P i x ( 8 - 1 0 ) ,   C o m ( 1 1 ) ,   B u m p ( 1 2 ) 
 
                     c o n s t   r o w   =   [ 
 
                         r [ 0 ] ,   / /   S K U 
 
                         r [ 1 ] ,   / /   N a m e 
 
                         r [ 4 ] ,   / /   S e l l   P r i c e 
 
                         0 ,         / /   B u y   P r i c e   ( D e f a u l t ) 
 
                         1 0 0 ,     / /   S t o c k   ( D e f a u l t ) 
 
                         " G e n e r a l " ,   / /   C a t e g o r y 
 
                         " - " ,     / /   S u p p l i e r 
 
                         t o I S O D a t e _ ( ) ,   / /   U p d a t e d 
 
                         r [ 5 ] ,   / /   S t a t u s 
 
                         r [ 3 ] ,   / /   A c c e s s   L i n k 
 
                         r [ 2 ] ,   / /   D e s c 
 
                         r [ 7 ] ,   / /   I m a g e 
 
                         r [ 6 ] ,   / /   L P 
 
                         r [ 1 1 ] ,   / /   C o m m i s s i o n 
 
                         r [ 8 ] ,   / /   P i x e l   I D 
 
                         r [ 9 ] ,   / /   P i x e l   T o k e n 
 
                         r [ 1 0 ] ,   / /   P i x e l   T e s t 
 
                         r [ 1 2 ]   / /   I s   B u m p 
 
                     ] ; 
 
                     s . a p p e n d R o w ( r o w ) ; 
 
                 } 
 
             } 
 
         } 
 
         r e t u r n   {   s t a t u s :   " s u c c e s s " ,   m e s s a g e :   " M a s t e r   D a t a b a s e   i n i t i a l i z e d   &   m i g r a t e d ! "   } ; 
 
     }   c a t c h   ( e )   { 
 
         r e t u r n   {   s t a t u s :   " e r r o r " ,   m e s s a g e :   e . t o S t r i n g ( )   } ; 
 
     } 
 
 } 
 
 
 
 f u n c t i o n   s y n c P r o d u c t D B ( )   { 
 
     t r y   { 
 
         c o n s t   m S   =   m u s t S h e e t _ ( " M a s t e r _ P r o d u c t s " ) ; 
 
         c o n s t   a S   =   m u s t S h e e t _ ( " A c c e s s _ R u l e s " ) ; 
 
         
 
         c o n s t   m D a t a   =   m S . g e t D a t a R a n g e ( ) . g e t V a l u e s ( ) ; 
 
         
 
         / /   C l e a r   A c c e s s _ R u l e s   ( k e e p   h e a d e r ) 
 
         i f   ( a S . g e t L a s t R o w ( )   >   1 )   { 
 
             a S . d e l e t e R o w s ( 2 ,   a S . g e t L a s t R o w ( )   -   1 ) ; 
 
         } 
 
         
 
         / /   H e a d e r   A c c e s s _ R u l e s :   
 
         / /   I D ,   T i t l e ,   D e s c ,   U R L ,   H a r g a ,   S t a t u s ,   L P _ U R L ,   I m a g e _ U R L ,   P i x e l _ I D ,   P i x e l _ T o k e n ,   P i x e l _ T e s t ,   C o m m i s s i o n ,   I s _ B u m p 
 
         
 
         c o n s t   n e w R o w s   =   [ ] ; 
 
         / /   S k i p   h e a d e r   ( i = 1 ) 
 
         f o r   ( l e t   i   =   1 ;   i   <   m D a t a . l e n g t h ;   i + + )   { 
 
             c o n s t   r   =   m D a t a [ i ] ; 
 
             / /   M a p   M a s t e r   - >   A c c e s s _ R u l e s 
 
             / /   M a s t e r :   S K U ( 0 ) ,   N a m e ( 1 ) ,   S e l l ( 2 ) ,   B u y ( 3 ) ,   S t o c k ( 4 ) ,   C a t ( 5 ) ,   S u p ( 6 ) ,   U p d ( 7 ) ,   S t a t ( 8 ) ,   L i n k ( 9 ) ,   D e s c ( 1 0 ) ,   I m g ( 1 1 ) ,   L P ( 1 2 ) ,   C o m ( 1 3 ) ,   P i x ( 1 4 - 1 6 ) ,   B u m p ( 1 7 ) 
 
             
 
             n e w R o w s . p u s h ( [ 
 
                 r [ 0 ] ,   / /   I D 
 
                 r [ 1 ] ,   / /   T i t l e 
 
                 r [ 1 0 ] ,   / /   D e s c 
 
                 r [ 9 ] ,   / /   U R L 
 
                 r [ 2 ] ,   / /   H a r g a   ( S e l l   P r i c e ) 
 
                 r [ 8 ] ,   / /   S t a t u s 
 
                 r [ 1 2 ] ,   / /   L P   U R L 
 
                 r [ 1 1 ] ,   / /   I m a g e   U R L 
 
                 r [ 1 4 ] ,   / /   P i x e l   I D 
 
                 r [ 1 5 ] ,   / /   P i x e l   T o k e n 
 
                 r [ 1 6 ] ,   / /   P i x e l   T e s t 
 
                 r [ 1 3 ] ,   / /   C o m m i s s i o n 
 
                 r [ 1 7 ]     / /   I s   B u m p 
 
             ] ) ; 
 
         } 
 
         
 
         i f   ( n e w R o w s . l e n g t h   >   0 )   { 
 
             a S . g e t R a n g e ( 2 ,   1 ,   n e w R o w s . l e n g t h ,   n e w R o w s [ 0 ] . l e n g t h ) . s e t V a l u e s ( n e w R o w s ) ; 
 
         } 
 
         
 
         / /   I n v a l i d a t e   C a c h e 
 
         C a c h e S e r v i c e . g e t S c r i p t C a c h e ( ) . r e m o v e ( " p r o d u c t s _ p u b l i c _ a l l " ) ; 
 
         C a c h e S e r v i c e . g e t S c r i p t C a c h e ( ) . r e m o v e ( " p r o d u c t s _ p u b l i c _ e x " ) ; 
 
         
 
         r e t u r n   {   s t a t u s :   " s u c c e s s " ,   m e s s a g e :   " S y n c   c o m p l e t e !   A c c e s s _ R u l e s   u p d a t e d   f r o m   M a s t e r . "   } ; 
 
     }   c a t c h   ( e )   { 
 
         r e t u r n   {   s t a t u s :   " e r r o r " ,   m e s s a g e :   e . t o S t r i n g ( )   } ; 
 
     } 
 
 } 
 
 
