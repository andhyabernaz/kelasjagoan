# API Documentation - Kelas Jagoan System

## Base URL
All requests should be sent to the deployed Google Apps Script Web App URL (`SCRIPT_URL`).

## Headers
- `Content-Type`: `text/plain;charset=utf-8` (to avoid CORS preflight issues with GAS)

## Endpoints (Actions)

### 1. Get Product Detail
Retrieves product information, including Bump Order candidates.

**Request:**
```json
{
  "action": "get_product",
  "id": "prod-123",
  "aff_id": "u-123456" // Optional
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "prod-123",
    "title": "Product Name",
    "harga": 100000,
    "pixel_id": "...",
    "commission": 50000
  },
  "bump_product": {
    "id": "prod-456",
    "title": "Bump Offer",
    "harga": 50000,
    "image_url": "..."
  },
  "sales_count": 42, // Real order count for social proof
  "payment": { ... }
}
```

### 2. Create Order
Creates a new order, optionally including a Bump Order.

**Request:**
```json
{
  "action": "create_order",
  "nama": "Customer Name",
  "email": "customer@email.com",
  "whatsapp": "08123456789",
  "id_produk": "prod-123",
  "nama_produk": "Product Name",
  "harga": 150000, // Total price (Main + Bump)
  "affiliate": "u-123456",
  "bump_id": "prod-456" // Optional
}
```

**Response:**
```json
{
  "status": "success",
  "invoice": "INV-123456",
  "tagihan": 150123, // Unique amount
  "is_new_user": true,
  "password": "random_password"
}
```



### 4. Log Analytics Event
Records tracking events for A/B testing and funnel analysis.

**Request:**
```json
{
  "action": "log_event",
  "event_name": "Bump_Checked", // Bump_Impression, Upsell_Accept, Upsell_Reject, PageView
  "product_id": "prod-123",
  "bump_id": "prod-456",
  "variant": "A", // A or B
  "value": 50000,
  "ref": "u-123456"
}
```

**Response:**
```json
{
  "status": "success"
}
```

## Inventory & Integration
- **Products**: Managed in `Access_Rules` sheet.
- **Orders**: Stored in `Orders` sheet.

