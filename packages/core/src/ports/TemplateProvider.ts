export interface TemplateProvider {
  getHtmlTemplate(): string;
  getCss(): string;
}
