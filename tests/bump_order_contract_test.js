const assert = require("assert");

function extractBump(r) {
  if (!r || r.status !== "success") return null;
  return r.bump_product || (r.data ? r.data.bump_product : null) || null;
}

function extractPayment(r) {
  if (!r || r.status !== "success") return null;
  return r.payment || null;
}

try {
  const main = { id: "P-1", title: "Main" };
  const bump = { id: "P-2", title: "Bump", harga: 50000 };

  const respNew = { status: "success", data: main, bump_product: bump, payment: { bank_norek: "123" } };
  assert.strictEqual(extractBump(respNew).id, "P-2");
  assert.ok(extractPayment(respNew) && extractPayment(respNew).bank_norek === "123");

  const respLegacy = { status: "success", data: { ...main, bump_product: bump }, payment: { bank_norek: "123" } };
  assert.strictEqual(extractBump(respLegacy).id, "P-2");

  const respBad = { status: "success", data: { ...main, bump_product: { id: "P-1" } }, payment: { bank_norek: "123" } };
  assert.strictEqual(extractBump(respBad).id, "P-1");

  console.log("BUMP ORDER CONTRACT TEST PASSED");
} catch (e) {
  console.error("BUMP ORDER CONTRACT TEST FAILED:", e.message);
  process.exit(1);
}

