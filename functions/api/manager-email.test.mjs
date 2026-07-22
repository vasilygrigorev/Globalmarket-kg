import assert from "node:assert/strict";
import test from "node:test";
import { maskPhone } from "./manager-email.js";

test("maskPhone keeps only a safe phone hint", () => {
  assert.equal(maskPhone("+996 700 123456"), "+996 *** ** 56");
  assert.equal(maskPhone("12"), "***");
});
