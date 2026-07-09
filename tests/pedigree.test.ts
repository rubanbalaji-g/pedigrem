import { describe, it } from "node:test";
import assert from "node:assert";
import { parseDSL, renderPedigree } from "../src/index.js";

describe("Pedigree DSL Parser", () => {
  it("should parse individuals with different sexes and statuses", () => {
    const dsl = `
      Alice F Af 45 index [label:Alan|Dengue]
      Bob M UAf dead 48
      Charlie M UAf 12
      Diana F UAf preg
      Emma F XCa 30
      Frank U Unk sb
      George A UAf
    `;
    const diagram = parseDSL(dsl);

    assert.strictEqual(diagram.individuals.size, 7);

    const alice = diagram.individuals.get("Alice");
    assert.ok(alice);
    assert.strictEqual(alice.sex, "F");
    assert.strictEqual(alice.status, "Af");
    assert.strictEqual(alice.age, "45");
    assert.strictEqual(alice.isIndex, true);
    assert.strictEqual(alice.label, "Alan|Dengue");

    const bob = diagram.individuals.get("Bob");
    assert.ok(bob);
    assert.strictEqual(bob.sex, "M");
    assert.strictEqual(bob.status, "UAf");
    assert.strictEqual(bob.isDeceased, true);

    const emma = diagram.individuals.get("Emma");
    assert.ok(emma);
    assert.strictEqual(emma.status, "XCa");

    const frank = diagram.individuals.get("Frank");
    assert.ok(frank);
    assert.strictEqual(frank.status, "Unk");
    assert.strictEqual(frank.isSb, true);

    const george = diagram.individuals.get("George");
    assert.ok(george);
    assert.strictEqual(george.sex, "A");
  });

  it("should ignore comments starting with % or #", () => {
    const dsl = `
      % This is a comment
      # Another comment
      Alice F Af
    `;
    const diagram = parseDSL(dsl);
    assert.strictEqual(diagram.individuals.size, 1);
    assert.ok(diagram.individuals.has("Alice"));
  });

  it("should parse relationships and twin groups", () => {
    const dsl = `
      Alice F Af
      Bob M UAf
      Charlie M UAf
      Diana F UAf
      April F UAf
      ~ Alice - Bob > Charlie, [Diana, April]
    `;
    const diagram = parseDSL(dsl);
    assert.strictEqual(diagram.relationships.length, 1);

    const rel = diagram.relationships[0];
    assert.strictEqual(rel.parent1, "Alice");
    assert.strictEqual(rel.parent2, "Bob");
    assert.strictEqual(rel.op, "-");
    assert.strictEqual(rel.children.length, 2);

    const firstChild = rel.children[0];
    assert.strictEqual(firstChild.type, "single");
    assert.strictEqual(firstChild.name, "Charlie");

    const secondChild = rel.children[1];
    assert.strictEqual(secondChild.type, "monozygotic");
    assert.deepStrictEqual(secondChild.children, ["Diana", "April"]);
  });

  it("should parse childless and infertility operators", () => {
    const dslChoice = `
      Alice F Af
      Bob M UAf
      ~ Alice - Bob >
    `;
    const diagramChoice = parseDSL(dslChoice);
    assert.strictEqual(diagramChoice.relationships[0].isChildless, true);
    assert.strictEqual(diagramChoice.relationships[0].isInfertile, false);

    const dslInfertility = `
      Alice F Af
      Bob M UAf
      ~ Alice - Bob > *
    `;
    const diagramInfertility = parseDSL(dslInfertility);
    assert.strictEqual(diagramInfertility.relationships[0].isChildless, true);
    assert.strictEqual(diagramInfertility.relationships[0].isInfertile, true);
  });

  it("should parse legends with ! prefix", () => {
    const dsl = `
      ! Af Breast Cancer
      ! Ca BRCA1 Mutation
    `;
    const diagram = parseDSL(dsl);
    assert.strictEqual(diagram.legends.length, 2);
    assert.strictEqual(diagram.legends[0].status, "Af");
    assert.strictEqual(diagram.legends[0].description, "Breast Cancer");
  });
});

describe("SVG Generation End-to-End", () => {
  it("should render a full valid SVG for a pedigree diagram", () => {
    const dsl = `
      ! Af Breast Cancer
      Alice F Af 45 index [label:Alan]
      Bob M UAf dead 48 [label:Bobby]
      Charlie M UAf 12 [label:Charlie|Dengue]
      ~ Alice = Bob > Charlie
    `;
    const svg = renderPedigree(dsl);
    assert.ok(svg.startsWith("<svg"));
    assert.ok(svg.includes("Breast Cancer"));
    assert.ok(svg.includes("Alan"));
    assert.ok(svg.includes("Bobby"));
    assert.ok(svg.includes("Dengue"));
    assert.ok(!svg.includes("Alice")); // Reference ID should not be drawn
  });
});
