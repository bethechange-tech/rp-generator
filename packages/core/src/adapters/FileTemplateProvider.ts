import * as fs from "fs";
import * as path from "path";
import { TemplateProvider } from "../ports";

export class FileTemplateProvider implements TemplateProvider {
  constructor(private templateDir: string) {}

  getHtmlTemplate(): string {
    const htmlPath = path.join(this.templateDir, "html", "index.html");
    return fs.readFileSync(htmlPath, "utf-8");
  }

  getCss(): string {
    const cssPath = path.join(this.templateDir, "css", "styles.css");
    return fs.readFileSync(cssPath, "utf-8");
  }
}
