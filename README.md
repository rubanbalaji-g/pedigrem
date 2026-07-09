# Pedigrem 📊

A lightweight, standalone JavaScript/TypeScript parser and SVG renderer for clinical pedigree charts. 

**Pedigrem** converts a highly simplified, symbolic, and human-readable DSL (domain-specific language) directly into publication-quality SVG diagrams. It is designed for clinical geneticists, medical researchers, and software integrations (like Obsidian, electronic health records, or web apps).

---

## Live Playground

Try out the live interactive sandbox directly in your browser:
👉 **[https://rubanbalaji-g.github.io/pedigrem/](https://rubanbalaji-g.github.io/pedigrem/)**

Or open it locally from the repository:
👉 [examples/index.html](file:///c:/PlayGround/gene-code/examples/index.html)

---

## DSL Syntax Specification

Pedigrem parses your text file line by line. Empty lines and lines starting with `%` or `#` are ignored as comments.

### 1. Individuals (No prefix)
Define nodes and their characteristics using this format:
`[id] [sex] [status] [attributes...]`

- **Sex**:
  - `M`: Male (drawn as a square)
  - `F`: Female (drawn as a circle)
  - `U`: Unknown sex (drawn as a diamond)
  - `A`: Ambiguous sex (drawn as a diamond with a `?` inside)
- **Status (Genotype/Phenotype Shading)**:
  - `Af`: Affected (fully filled/shaded symbol)
  - `UAf`: Unaffected (unshaded outline)
  - `Ca`: Carrier (left-half shaded for autosomal carriers)
  - `XCa`: X-linked carrier (symbol containing a central solid dot)
  - `Unk`: Unknown status (drawn as a normal sex shape with a `?` inside)
- **Label Attribute**:
  - `[label:Line1|Line2]`: Displays text labels below the symbol. Use `|` for multi-line text (e.g. `[label:Arthur|Prostate Cancer]`). Node IDs (e.g., `Arthur`) are internal references and **not** printed unless included in this label.
- **Attributes** (space-separated, optional):
  - Any number/unit (e.g., `45`, `12`, `3m`) is automatically parsed as **age** and displayed at the very bottom (below labels).
  - `index`: Index case / Proband (draws an arrow pointing to the node).
  - `dead`: Deceased status (draws a diagonal slash `/` through the node).
  - `adopted-in`: Adopted into the family (draws brackets `[ ]` around the symbol).
  - `adopted-out`: Adopted out of the family (draws brackets `[ ]` and connects with a dashed parents line).
  - `preg`: Ongoing pregnancy (draws a diamond with a `P` inside).
  - `misc`: Miscarriage / Spontaneous abortion (draws a small triangle).
  - `induced`: Induced abortion / Terminated pregnancy (draws a small triangle with a diagonal slash).
  - `sb`: Stillbirth (draws normal symbol with a diagonal slash and "SB" text below it).

*Example:*
```text
I1 M UAf 72 [label:Arthur]
I2 F UAf 70 [label:Beatrice]
II1 M Af 45 index [label:Charles|Dengue]
II2 F UAf 43 [label:Diana]
III1 F UAf 12 [label:Emily]
```

### 2. Relationships & Children (Prefix `~`)
Define relationships and offspring using this format:
`~ [parent1][operator][parent2] > [children_expression]`

- **Operators**:
  - `-`: Normal relationship
  - `=`: Consanguineous relationship (renders as double parallel marriage lines)
  - `/`: Divorced (renders as a double slash `//` across the marriage line)
  - `|`: Separated (renders as a single slash `/` across the marriage line)
- **Children Expression** (after `>`):
  - Children are comma-separated.
  - **Twins/Triplets**:
    - `[child1,child2]`: Monozygotic twins (diagonal lines split from a single point on the sibship bar, linked by a horizontal crossline).
    - `[[child1,child2]]`: Dizygotic twins (diagonal lines split from a single point on the sibship bar).
  - **Childless Couples**:
    - Empty: Childless by choice (draws a vertical drop ending in a single horizontal `T` bar).
    - `*`: Childless due to infertility (draws a double crossbar `T` bar).

*Examples:*
```text
~ Arthur-Beatrice > Charles,Diana          # Normal marriage, children Charles and Diana
~ Father = Mother > Son,[TwinA,TwinB]      # Consanguineous, child Son and monozygotic twins TwinA & TwinB
~ Alice/Bob > Charlie,[[Diana,April]]      # Divorced, child Charlie and dizygotic twins Diana & April
~ Alice|Bob >                              # Separated, childless by choice
~ Sarah-Bob > *                            # Infertility childless marker
```

### 3. Legends (Prefix `!`)
Define legend items displayed at the bottom of the canvas:
`! [status] [description]`

*Example:*
```text
! Af Breast Cancer
! Ca BRCA1 Mutation
! XCa BRCA2 Carrier
```

---

## Technical Features

- **Dynamic Row Spacing**: Layout engine dynamically analyzes the text height (labels + age) for each generation level and expands rows to prevent text from overlapping with lines or children nodes.
- **Auto-Positioning**: Automatically centers parents over their children's midpoint.
- **Standardized Graphics**: Output SVG complies with clinical pedigree chart guidelines.

---

## Development

### Install Dependencies
```bash
npm install
```

### Build the Project
```bash
npm run build
```

### Run Tests
```bash
npm test
```

---

## License

This project is licensed under the [MIT License](LICENSE). Anyone is free to copy, modify, and distribute the code, provided that the original copyright notice and license are included.
