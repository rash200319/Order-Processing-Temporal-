/// <reference path="../chai.d.ts" />
import { expect } from "chai";
import { checkOrderPolicy } from "../agent/policy";

describe("Order policy", () => {
  it("allows keyboard × 1", () => {
    const result = checkOrderPolicy([
      {
        sku: "keyboard",
        quantity: 1,
      },
    ]);

    expect(result.allowed).to.equal(true);
    expect(result.violations).to.have.length(0);
    expect(result.total).to.equal(50);
  });

  it("allows mouse × 2", () => {
    const result = checkOrderPolicy([
      {
        sku: "mouse",
        quantity: 2,
      },
    ]);

    expect(result.allowed).to.equal(true);
    expect(result.total).to.equal(40);
  });

  it("rejects keyboard × 1000", () => {
    const result = checkOrderPolicy([
      {
        sku: "keyboard",
        quantity: 1000,
      },
    ]);

    expect(result.allowed).to.equal(false);
    expect(result.violations).to.contain(
      "Quantity for keyboard exceeds maximum of 10"
    );
  });

  it("rejects unknown SKU", () => {
    const result = checkOrderPolicy([
      {
        sku: "unknown-sku",
        quantity: 1,
      },
    ]);

    expect(result.allowed).to.equal(false);
    expect(result.violations).to.contain("Unknown SKU: unknown-sku");
  });
});
