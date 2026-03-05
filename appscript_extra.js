
/* =========================
   MASTER DATABASE & SYNC
========================= */
function initMasterDB() {
  try {
    const sName = "Master_Products";
    let s = ss.getSheetByName(sName);
    if (!s) {
      s = ss.insertSheet(sName);
      // Header: SKU, Name, Sell Price, Buy Price, Stock, Category, Supplier, Updated, Status, Access Link, Desc, Image, LP, Commission, Pixel ID, Pixel Token, Test Code, Is Bump
      const headers = [
        "sku", "name", "price_sell", "price_buy", "stock", "category", "supplier", "updated_at", "status", 
        "access_link", "description", "image_url", "lp_url", "commission", "pixel_id", "pixel_token", "pixel_test", "is_bump"
      ];
      s.appendRow(headers);
      
      // Migrate existing data from Access_Rules
      const ar = ss.getSheetByName("Access_Rules");
      if (ar) {
        const data = ar.getDataRange().getValues();
        // Skip header
        for (let i = 1; i < data.length; i++) {
          const r = data[i];
          // Map Access_Rules to Master_Products
          // AR: ID(0), Title(1), Desc(2), URL(3), Harga(4), Status(5), LP(6), Img(7), Pix(8-10), Com(11), Bump(12)
          const row = [
            r[0], // SKU
            r[1], // Name
            r[4], // Sell Price
            0,    // Buy Price (Default)
            100,  // Stock (Default)
            "General", // Category
            "-",  // Supplier
            toISODate_(), // Updated
            r[5], // Status
            r[3], // Access Link
            r[2], // Desc
            r[7], // Image
            r[6], // LP
            r[11], // Commission
            r[8], // Pixel ID
            r[9], // Pixel Token
            r[10], // Pixel Test
            r[12] // Is Bump
          ];
          s.appendRow(row);
        }
      }
    }
    return { status: "success", message: "Master Database initialized & migrated!" };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function syncProductDB() {
  try {
    const mS = mustSheet_("Master_Products");
    const aS = mustSheet_("Access_Rules");
    
    const mData = mS.getDataRange().getValues();
    
    // Clear Access_Rules (keep header)
    if (aS.getLastRow() > 1) {
      aS.deleteRows(2, aS.getLastRow() - 1);
    }
    
    // Header Access_Rules: 
    // ID, Title, Desc, URL, Harga, Status, LP_URL, Image_URL, Pixel_ID, Pixel_Token, Pixel_Test, Commission, Is_Bump
    
    const newRows = [];
    // Skip header (i=1)
    for (let i = 1; i < mData.length; i++) {
      const r = mData[i];
      // Map Master -> Access_Rules
      // Master: SKU(0), Name(1), Sell(2), Buy(3), Stock(4), Cat(5), Sup(6), Upd(7), Stat(8), Link(9), Desc(10), Img(11), LP(12), Com(13), Pix(14-16), Bump(17)
      
      newRows.push([
        r[0], // ID
        r[1], // Title
        r[10], // Desc
        r[9], // URL
        r[2], // Harga (Sell Price)
        r[8], // Status
        r[12], // LP URL
        r[11], // Image URL
        r[14], // Pixel ID
        r[15], // Pixel Token
        r[16], // Pixel Test
        r[13], // Commission
        r[17]  // Is Bump
      ]);
    }
    
    if (newRows.length > 0) {
      aS.getRange(2, 1, newRows.length, newRows[0].length).setValues(newRows);
    }
    
    // Invalidate Cache
    CacheService.getScriptCache().remove("products_public_all");
    CacheService.getScriptCache().remove("products_public_ex");
    
    return { status: "success", message: "Sync complete! Access_Rules updated from Master." };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}
