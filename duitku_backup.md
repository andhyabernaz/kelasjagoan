# Duitku Integration Backup
Date: 2026-03-04
Purpose: Backup before full removal of Duitku payment gateway.

## 1. appscript.js

### Helper Function: md5_
```javascript
function md5_(str) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, str)
    .map(b => ("0" + (b & 0xFF).toString(16)).slice(-2)).join("");
}
```

### Main Functions: createDuitkuPayment & handleDuitkuCallback
```javascript
function createDuitkuPayment(d, cfg) {
  try {
    cfg = cfg || getSettingsMap_();
    const mCode = getCfgFrom_(cfg, "duitku_merchant_code");
    const mKey = getCfgFrom_(cfg, "duitku_merchant_key");
    const isSandbox = String(getCfgFrom_(cfg, "duitku_sandbox_mode")) === "true";
    
    if (!mCode || !mKey) return { status: "error", message: "Duitku belum dikonfigurasi di Admin Area" };

    const url = isSandbox 
      ? "https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry" 
      : "https://passport.duitku.com/webapi/api/merchant/v2/inquiry";

    const amount = parseInt(d.amount);
    const orderId = String(d.invoice);
    const product = String(d.product_name).substring(0, 250); // Limit chars
    const email = String(d.email);
    const phone = String(d.phone || "");
    const name = String(d.name || "Customer");

    // Signature: merchantCode + merchantOrderId + paymentAmount + apiKey
    const signature = md5_(mCode + orderId + amount + mKey);

    const payload = {
      merchantCode: mCode,
      paymentAmount: amount,
      merchantOrderId: orderId,
      productDetails: product,
      email: email,
      phoneNumber: phone,
      customerVaName: name,
      callbackUrl: getCfgFrom_(cfg, "site_url") + "/exec", // Assuming generic webhook URL
      returnUrl: getCfgFrom_(cfg, "site_url") + "/thank-you.html", // or dashboard
      signature: signature,
      expiryPeriod: 1440 // 24 hours
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const res = UrlFetchApp.fetch(url, options);
    const content = res.getContentText();
    let resData;
    
    try {
      resData = JSON.parse(content);
    } catch (err) {
      return { status: "error", message: "Invalid response from Duitku: " + content.substring(0, 50) };
    }

    if (resData.paymentUrl) {
      return { status: "success", paymentUrl: resData.paymentUrl, raw: resData };
    } else {
      return { status: "error", message: resData.statusMessage || "Gagal membuat payment URL" };
    }
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function handleDuitkuCallback(params, cfg) {
  try {
    cfg = cfg || getSettingsMap_();
    const mCode = params.merchantCode;
    const amount = params.amount;
    const orderId = params.merchantOrderId;
    const signature = params.signature;
    const resultCode = params.resultCode;
    const refId = params.reference;

    // 1. Validasi Signature
    const mKey = getCfgFrom_(cfg, "duitku_merchant_key");
    // Callback Sig: merchantCode + amount + merchantOrderId + apiKey
    const calcSig = md5_(mCode + amount + orderId + mKey);

    if (signature !== calcSig) {
      return ContentService.createTextOutput("Bad Signature").setMimeType(ContentService.MimeType.TEXT);
    }

    // 2. Cek Status (00 = Success)
    if (resultCode !== "00") {
      return ContentService.createTextOutput("Payment Failed/Pending").setMimeType(ContentService.MimeType.TEXT);
    }

    // 3. Update Order ke Lunas
    const s = mustSheet_("Orders");
    const orders = s.getDataRange().getValues();
    let orderFound = false;

    for (let i = 1; i < orders.length; i++) {
      if (String(orders[i][0]) === String(orderId)) { // Match Invoice
        if (String(orders[i][7]) === "Lunas") {
            return ContentService.createTextOutput("Already Paid").setMimeType(ContentService.MimeType.TEXT);
        }
        
        s.getRange(i + 1, 8).setValue("Lunas"); // Status
        
        // Trigger Notifikasi (Reuse logic updateOrderStatus / handleMootaWebhook)
        // ... (Notification logic omitted for brevity in backup, but exists in original file)
        
        return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
      }
    }
    return ContentService.createTextOutput("Order Not Found").setMimeType(ContentService.MimeType.TEXT);
  } catch (e) {
    return ContentService.createTextOutput("Error: " + e.toString()).setMimeType(ContentService.MimeType.TEXT);
  }
}
```

## 2. checkout.html

### Payment Option HTML
```html
<label class="group relative flex items-start p-4 border-2 border-slate-100 rounded-xl cursor-pointer hover:border-indigo-200 hover:bg-indigo-50/30 transition-all duration-200 has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-50/50 has-[:checked]:shadow-indigo-500/10" id="opt-duitku">
    <div class="flex items-center h-5">
        <input type="radio" name="payment_method" value="duitku" class="peer sr-only" onchange="selectPayment('duitku')">
        <div class="w-5 h-5 border-2 border-slate-300 rounded-full peer-checked:border-indigo-600 peer-checked:bg-indigo-600 relative flex items-center justify-center transition-all">
            <div class="w-2.5 h-2.5 bg-white rounded-full opacity-0 peer-checked:opacity-100 transition-opacity"></div>
        </div>
    </div>
    <div class="ml-4 flex-1">
        <div class="flex items-center justify-between mb-1">
            <span class="font-bold text-slate-800 text-sm group-hover:text-indigo-700 transition-colors">Virtual Account / QRIS</span>
            <span class="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full">INSTANT</span>
        </div>
        <p class="text-xs text-slate-500 leading-relaxed">Bayar otomatis via VA Bank (BCA, Mandiri, BNI, BRI) atau QRIS.</p>
    </div>
</label>
```

### JS Logic (renderCheckoutUI)
```javascript
if(sysPayment.duitku_active) {
    paySection.classList.remove('hidden');
    // Ensure correct initial state
    if(selectedPayment === 'bank') {
        document.querySelector('input[value="bank"]').checked = true;
    }
} else {
    // ...
}
```

### JS Logic (submit form)
```javascript
if (selectedPayment === 'duitku') {
    btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> MENGHUBUNGKAN DUITKU...';
    
    const duitkuPayload = {
        action: 'create_duitku_payment',
        amount: r.tagihan, // Use unique amount if needed, or original price
        invoice: r.invoice,
        product_name: pData.nama_produk,
        email: pData.email,
        phone: pData.whatsapp,
        name: pData.nama
    };

    try {
        const resD = await fetchWithRetry(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(duitkuPayload)
        }, 2, 1000, 15000);
        const rD = await resD.json();

        if (rD.status === 'success' && rD.paymentUrl) {
            window.location.href = rD.paymentUrl;
            return; // Stop execution, redirecting
        } else {
            showToast('Gagal membuat link pembayaran Duitku: ' + (rD.message || 'Error'), 'error');
        }
    } catch (dErr) {
        console.error("Duitku Error:", dErr);
        showToast("Gagal menghubungi Duitku. Silakan transfer manual.", "warning");
    }
}
```

## 3. admin-area.html

### Settings UI
```html
<div class="pt-4 border-t border-slate-100 mt-4">
    <h4 class="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
        <i data-lucide="credit-card" class="w-4 h-4 text-indigo-500"></i> Payment Gateway (Duitku)
    </h4>
    <div class="space-y-4">
        <div>
            <label class="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 mb-2 block">Merchant Code</label>
            <input type="text" id="set-duitku-code" class="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-mono text-sm">
        </div>
        <div>
            <label class="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 mb-2 block">Merchant Key (API Key)</label>
            <input type="text" id="set-duitku-key" class="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-mono text-sm">
        </div>
        <div class="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <input type="checkbox" id="set-duitku-sandbox" class="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500">
            <label for="set-duitku-sandbox" class="text-xs font-bold text-slate-600 uppercase tracking-wider cursor-pointer select-none">Aktifkan Mode Sandbox (Test)</label>
        </div>
    </div>
</div>
```

### JS Logic (Settings)
```javascript
// Load
document.getElementById('set-duitku-code').value = r.settings.duitku_merchant_code || '';
document.getElementById('set-duitku-key').value = r.settings.duitku_merchant_key || '';
document.getElementById('set-duitku-sandbox').checked = (String(r.settings.duitku_sandbox_mode) === 'true'); 

// Save
duitku_merchant_code: document.getElementById('set-duitku-code').value,
duitku_merchant_key: document.getElementById('set-duitku-key').value,
duitku_sandbox_mode: document.getElementById('set-duitku-sandbox').checked.toString()
```

## 4. API_DOCS.md

### Section 3. Create Duitku Payment
```markdown
### 3. Create Duitku Payment
Initiates a payment gateway transaction.

**Request:**
{
  "action": "create_duitku_payment",
  "amount": 150123,
  "invoice": "INV-123456",
  "product_name": "Product Name + Bump",
  "email": "...",
  "phone": "...",
  "name": "..."
}

**Response:**
{
  "status": "success",
  "paymentUrl": "https://duitku.com/..."
}
```
