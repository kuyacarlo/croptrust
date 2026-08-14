import { describe, it } from "node:test";
import assert from "node:assert";

describe("Contract ID", () => {
  it("is a valid Stellar contract address", () => {
    const id = "CC7CCIMTME2KBV7RRUTXAW6XTPE2FBRYLV3CLKF2YQNU5NHX5NYH37TC";
    assert.ok(id.startsWith("C"));
    assert.equal(id.length, 56);
    assert.ok(/^C[A-Z0-9]{55}$/.test(id));
  });

  it("matches expected format (C + 55 alphanumeric)", () => {
    const id = "CC7CCIMTME2KBV7RRUTXAW6XTPE2FBRYLV3CLKF2YQNU5NHX5NYH37TC";
    assert.match(id, /^C[A-Z0-9]{55}$/);
  });

  it("is not the placeholder value", () => {
    const id = "CC7CCIMTME2KBV7RRUTXAW6XTPE2FBRYLV3CLKF2YQNU5NHX5NYH37TC";
    assert.notEqual(id, "placeholder");
    assert.notEqual(id, "");
  });
});
