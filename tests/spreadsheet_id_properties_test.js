const assert = require("assert");
const fs = require("fs");
const path = require("path");

function readUtf8(p) {
  return fs.readFileSync(p, { encoding: "utf8" });
}

try {
  const root = path.resolve(__dirname, "..");
  const appscriptPath = path.join(root, "appscript.js");
  const src = readUtf8(appscriptPath);

  assert.ok(src.includes("SpreadsheetApp.openById"), "appscript.js harus memakai SpreadsheetApp.openById()");
  assert.ok(!src.includes("getActiveSpreadsheet"), "appscript.js tidak boleh memakai SpreadsheetApp.getActiveSpreadsheet()");
  assert.ok(src.includes("SPREADSHEET_ID"), "appscript.js harus punya key SPREADSHEET_ID di PropertiesService");
  assert.ok(src.includes("set_spreadsheet_id"), "doPost harus mendukung action set_spreadsheet_id");
  assert.ok(src.includes("get_spreadsheet_id_status"), "doPost harus mendukung action get_spreadsheet_id_status");

  console.log("SPREADSHEET_ID PROPERTIES TEST PASSED");
} catch (e) {
  console.error("SPREADSHEET_ID PROPERTIES TEST FAILED:", e.message);
  process.exit(1);
}

