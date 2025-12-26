/** Port for template providers (infrastructure agnostic) */
export interface ITemplateProvider {
  /** Get HTML template content */
  getHtmlTemplate(): string;

  /** Get CSS content */
  getCss(): string;
}
