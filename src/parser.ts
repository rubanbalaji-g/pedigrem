import type {
  Individual,
  Relationship,
  LegendItem,
  PedigreeDiagram,
  SexType,
  StatusType,
  RelationOperator,
  ChildGroup
} from "./types.js";

function parseChildrenExpression(expr: string): ChildGroup[] {
  const result: ChildGroup[] = [];
  let currentToken = "";
  let bracketDepth = 0;

  for (let i = 0; i < expr.length; i++) {
    const char = expr[i];
    if (char === "[") {
      bracketDepth++;
      currentToken += char;
    } else if (char === "]") {
      bracketDepth--;
      currentToken += char;
    } else if (char === "," && bracketDepth === 0) {
      if (currentToken.trim()) {
        result.push(parseChildToken(currentToken.trim()));
      }
      currentToken = "";
    } else {
      currentToken += char;
    }
  }
  if (currentToken.trim()) {
    result.push(parseChildToken(currentToken.trim()));
  }
  return result;
}

function parseChildToken(token: string): ChildGroup {
  if (token.startsWith("[[") && token.endsWith("]]")) {
    const names = token.slice(2, -2).split(",").map(n => n.trim()).filter(Boolean);
    return { type: "dizygotic", children: names };
  } else if (token.startsWith("[") && token.endsWith("]")) {
    const names = token.slice(1, -1).split(",").map(n => n.trim()).filter(Boolean);
    return { type: "monozygotic", children: names };
  } else {
    return { type: "single", name: token };
  }
}

export function parseDSL(dsl: string): PedigreeDiagram {
  const individuals = new Map<string, Individual>();
  const relationships: Relationship[] = [];
  const legends: LegendItem[] = [];

  const lines = dsl.split(/\r?\n/).map(l => l.trim());

  for (let lineNum = 1; lineNum <= lines.length; lineNum++) {
    const line = lines[lineNum - 1];
    if (!line || line.startsWith("%") || line.startsWith("#")) {
      continue;
    }

    if (line.startsWith("!")) {
      // Legend definition
      const parts = line.slice(1).trim().split(/\s+/);
      const status = parts[0];
      const description = parts.slice(1).join(" ");
      if (!status || !description) {
        throw new Error(`Invalid legend on line ${lineNum}: ${line}`);
      }
      legends.push({ status, description });
      continue;
    }

    if (line.startsWith("~")) {
      // Relationship definition
      const content = line.slice(1).trim();
      const parts = content.split(">");
      const left = parts[0].trim();
      const right = parts[1] ? parts[1].trim() : "";

      const opMatch = left.match(/([-=\/|])/);
      if (!opMatch) {
        throw new Error(`Invalid relationship format on line ${lineNum}: ${line}`);
      }
      const op = opMatch[1] as RelationOperator;
      const opIndex = left.indexOf(op);
      const parent1 = left.slice(0, opIndex).trim();
      const parent2 = left.slice(opIndex + 1).trim();

      if (!parent1 || !parent2) {
        throw new Error(`Missing parents in relationship on line ${lineNum}: ${line}`);
      }

      let isChildless = false;
      let isInfertile = false;
      let children: ChildGroup[] = [];

      if (parts.length > 1) {
        if (right === "" || right === "choice") {
          isChildless = true;
        } else if (right === "*") {
          isChildless = true;
          isInfertile = true;
        } else {
          children = parseChildrenExpression(right);
        }
      }

      relationships.push({
        parent1,
        parent2,
        op,
        children,
        isChildless,
        isInfertile
      });
      continue;
    }

    // Individual characteristic definition
    let parsedLine = line;
    let label: string | undefined = undefined;
    const labelMatch = line.match(/\[label:([^\]]+)\]/);
    if (labelMatch) {
      label = labelMatch[1];
      parsedLine = line.replace(labelMatch[0], "").trim();
    }

    const tokens = parsedLine.split(/\s+/);
    const id = tokens[0];
    const sex = tokens[1] as SexType;
    const status = tokens[2] as StatusType;

    if (!id || !["M", "F", "U", "A"].includes(sex) || !["Af", "UAf", "Ca", "XCa", "Unk"].includes(status)) {
      throw new Error(`Invalid individual definition on line ${lineNum}: ${line}`);
    }

    const ind: Individual = { id, sex, status };
    if (label) {
      ind.label = label;
    }

    for (let i = 3; i < tokens.length; i++) {
      const attr = tokens[i];
      if (/^\d/.test(attr)) {
        ind.age = attr;
      } else if (attr === "index" || attr === "proband") {
        ind.isIndex = true;
      } else if (attr === "dead") {
        ind.isDeceased = true;
      } else if (attr === "adopted-in") {
        ind.adopted = "in";
      } else if (attr === "adopted-out") {
        ind.adopted = "out";
      } else if (attr === "preg") {
        ind.isPreg = true;
      } else if (attr === "misc") {
        ind.isMisc = true;
      } else if (attr === "induced") {
        ind.isInduced = true;
      } else if (attr === "sb") {
        ind.isSb = true;
      }
    }

    individuals.set(id, ind);
  }

  return { individuals, relationships, legends };
}
