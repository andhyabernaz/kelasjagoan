
/* =========================
   AFFILIATE PIXEL SETTINGS
========================= */
function saveAffiliatePixel(d) {
  try {
    const s = mustSheet_("Affiliate_Pixels");
    const email = String(d.email).trim().toLowerCase();
    const productId = String(d.product_id).trim();
    
    // 1. Get User ID from Email
    const u = mustSheet_("Users").getDataRange().getValues();
    let userId = "";
    for (let i = 1; i < u.length; i++) {
      if (String(u[i][1]).toLowerCase() === email) { userId = String(u[i][0]); break; }
    }
    if (!userId) return { status: "error", message: "User tidak ditemukan" };

    const r = s.getDataRange().getValues();
    let found = false;

    // Check existing row
    for (let i = 1; i < r.length; i++) {
      if (String(r[i][0]) === userId && String(r[i][1]) === productId) {
        // Update: UserID, ProdID, PixelID, Token, TestCode
        s.getRange(i + 1, 3, 1, 3).setValues([[d.pixel_id || "", d.pixel_token || "", d.pixel_test_code || ""]]);
        found = true;
        break;
      }
    }

    if (!found) {
      s.appendRow([userId, productId, d.pixel_id || "", d.pixel_token || "", d.pixel_test_code || ""]);
    }
    
    return { status: "success", message: "Pixel berhasil disimpan" };
  } catch (e) {
    // If sheet doesn't exist, create it
    if (e.message.includes('tidak ditemukan')) {
        const newSheet = ss.insertSheet("Affiliate_Pixels");
        newSheet.appendRow(["user_id", "product_id", "pixel_id", "pixel_token", "pixel_test_code"]);
        return saveAffiliatePixel(d); // Retry
    }
    return { status: "error", message: e.toString() };
  }
}
