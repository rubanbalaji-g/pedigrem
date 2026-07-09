export type SexType = "M" | "F" | "U" | "A";
export type StatusType = "Af" | "UAf" | "Ca" | "XCa" | "Unk";
export type RelationOperator = "-" | "=" | "/" | "|";

export interface Individual {
  id: string;
  sex: SexType;
  status: StatusType;
  age?: string;
  isIndex?: boolean;
  isDeceased?: boolean;
  adopted?: "in" | "out";
  isPreg?: boolean;
  isMisc?: boolean;
  isInduced?: boolean;
  isSb?: boolean;
  label?: string;
}

export type ChildGroup = 
  | { type: "single"; name: string }
  | { type: "monozygotic"; children: string[] }
  | { type: "dizygotic"; children: string[] };

export interface Relationship {
  parent1: string;
  parent2: string;
  op: RelationOperator;
  children: ChildGroup[];
  isChildless?: boolean;
  isInfertile?: boolean;
}

export interface LegendItem {
  status: string;
  description: string;
}

export interface PedigreeDiagram {
  individuals: Map<string, Individual>;
  relationships: Relationship[];
  legends: LegendItem[];
}
