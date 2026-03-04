// Unit Test for Bump Order Logic (Simulating Checkout & Backend Validation)
// Run with Node.js: node tests/bump_logic_test.js

const assert = require('assert');

console.log("=== BUMP ORDER LOGIC TEST SUITE ===\n");

// --- MOCK DATA ---
const products = [
    { id: "P-001", name: "Main Product", price: 100000 },
    { id: "P-002", name: "Bump Product", price: 25000 },
    { id: "P-003", name: "Another Product", price: 50000 }
];

// --- FRONTEND LOGIC TEST (Checkout Price Calculation) ---
console.log("[TEST 1] Frontend Price Calculation");

function calculateTotal(baseProduct, bumpProduct, isBumpChecked) {
    let total = baseProduct.price;
    if (isBumpChecked && bumpProduct) {
        total += bumpProduct.price;
    }
    return total;
}

try {
    // Scenario 1: Bump Checked
    const total1 = calculateTotal(products[0], products[1], true);
    assert.strictEqual(total1, 125000, "Total should be 125000 (100k + 25k)");
    console.log("  [PASS] Bump Checked: Correct Total");

    // Scenario 2: Bump Unchecked
    const total2 = calculateTotal(products[0], products[1], false);
    assert.strictEqual(total2, 100000, "Total should be 100000 (Main only)");
    console.log("  [PASS] Bump Unchecked: Correct Total");

    // Scenario 3: Bump Checked but No Bump Data (Edge Case)
    const total3 = calculateTotal(products[0], null, true);
    assert.strictEqual(total3, 100000, "Total should remain base price if bump data missing");
    console.log("  [PASS] Bump Missing: Correct Total");

} catch (e) {
    console.error("  [FAIL] " + e.message);
    process.exit(1);
}

console.log("");

// --- BACKEND VALIDATION TEST (Anti-Fraud Logic) ---
console.log("[TEST 2] Backend Price Validation (Anti-Fraud)");

function validateOrder(payload, dbProducts) {
    const mainProd = dbProducts.find(p => p.id === payload.id_produk);
    if (!mainProd) return { status: "error", message: "Product not found" };

    let expectedTotal = mainProd.price;
    
    if (payload.bump_id) {
        const bumpProd = dbProducts.find(p => p.id === payload.bump_id);
        if (bumpProd) {
            expectedTotal += bumpProd.price;
        }
    }

    // Allow small tolerance (e.g. unique code)
    const diff = Math.abs(payload.harga - expectedTotal);
    if (diff > 999) { // Tolerance for unique code (100-999)
        return { status: "error", message: "Price mismatch" };
    }
    return { status: "success" };
}

try {
    // Scenario 1: Valid Order with Bump
    const order1 = { id_produk: "P-001", bump_id: "P-002", harga: 125123 }; // 125000 + 123 unique code
    const res1 = validateOrder(order1, products);
    assert.strictEqual(res1.status, "success", "Valid order should pass");
    console.log("  [PASS] Valid Order with Bump");

    // Scenario 2: Invalid Price (Too Low)
    const order2 = { id_produk: "P-001", bump_id: "P-002", harga: 100123 }; // Only paid for main
    const res2 = validateOrder(order2, products);
    assert.strictEqual(res2.status, "error", "Invalid price should fail");
    console.log("  [PASS] Invalid Price Detected");

    // Scenario 3: Invalid Price (Too High - Suspicious)
    const order3 = { id_produk: "P-001", bump_id: null, harga: 200000 }; 
    const res3 = validateOrder(order3, products);
    assert.strictEqual(res3.status, "error", "Suspicious high price should fail");
    console.log("  [PASS] Suspicious Price Detected");

} catch (e) {
    console.error("  [FAIL] " + e.message);
    process.exit(1);
}

console.log("");

// --- ADMIN VALIDATION TEST (Self-Selection Prevention) ---
console.log("[TEST 3] Admin Self-Selection Prevention");

function getAvailableBumpOptions(currentProductId, allProducts) {
    return allProducts.filter(p => p.id !== currentProductId);
}

try {
    const options = getAvailableBumpOptions("P-001", products);
    const selfFound = options.find(p => p.id === "P-001");
    
    assert.strictEqual(selfFound, undefined, "Current product should not be in bump options");
    assert.ok(options.length > 0, "Other products should be available");
    console.log("  [PASS] Self-selection prevented");

} catch (e) {
    console.error("  [FAIL] " + e.message);
    process.exit(1);
}

console.log("\nALL TESTS PASSED SUCCESSFULLY! ✅");
