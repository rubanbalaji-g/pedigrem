import { Plugin } from "obsidian";
import { renderPedigree } from "../src/index.js";

export default class PedigremPlugin extends Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor("pedigrem", (source, el, ctx) => {
      try {
        const svg = renderPedigree(source);
        
        const container = el.createDiv({ cls: "pedigrem-svg-container" });
        container.innerHTML = svg;
        
        const svgEl = container.querySelector("svg");
        if (svgEl) {
          svgEl.style.display = "block";
          svgEl.style.margin = "0 auto";
          svgEl.style.maxWidth = "100%";
        }
      } catch (e: any) {
        const errorDiv = el.createDiv({ cls: "pedigrem-error-container" });
        errorDiv.setText("Pedigrem render error: " + e.message);
        errorDiv.style.color = "var(--text-error, #f43f5e)";
        errorDiv.style.fontFamily = "monospace";
        errorDiv.style.padding = "8px";
        errorDiv.style.backgroundColor = "var(--background-secondary)";
        errorDiv.style.borderLeft = "4px solid var(--text-error, #f43f5e)";
        errorDiv.style.borderRadius = "4px";
      }
    });
  }
}
