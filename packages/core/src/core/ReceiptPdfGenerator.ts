import * as path from "path";
import { forEach, defaults } from "lodash";
import { ReceiptData } from "../domain/ReceiptData";
import { TemplateProvider, PdfRenderer } from "../ports";
import { FileTemplateProvider, PuppeteerPdfRenderer } from "../adapters";

export class ReceiptPdfGenerator {
  private static readonly DEFAULT_QR_CODE = `<svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="80" fill="white"/>
    <rect x="8" y="8" width="20" height="20" stroke="#000" stroke-width="2" fill="none"/>
    <rect x="12" y="12" width="12" height="12" fill="#000"/>
    <rect x="52" y="8" width="20" height="20" stroke="#000" stroke-width="2" fill="none"/>
    <rect x="56" y="12" width="12" height="12" fill="#000"/>
    <rect x="8" y="52" width="20" height="20" stroke="#000" stroke-width="2" fill="none"/>
    <rect x="12" y="56" width="12" height="12" fill="#000"/>
  </svg>`;

  private static readonly DEFAULT_LOGO = `<svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="30" cy="30" r="28" stroke="#10b981" stroke-width="3" fill="#ecfdf5"/>
    <path d="M32 18L22 32H28L26 42L38 28H31L32 18Z" fill="#10b981" stroke="#10b981" stroke-width="1" stroke-linejoin="round"/>
  </svg>`;

  constructor(
    private templateProvider: TemplateProvider,
    private pdfRenderer: PdfRenderer
  ) {}

  async generate(data: ReceiptData, outputPath: string): Promise<void> {
    const html = this.buildHtml(data);
    await this.pdfRenderer.render(html, outputPath);
    console.log(`PDF generated: ${outputPath}`);
  }

  async generateBase64(data: ReceiptData): Promise<string> {
    const html = this.buildHtml(data);
    const base64 = await this.pdfRenderer.renderToBase64(html);
    console.log(`PDF generated as base64 (${base64.length} chars)`);
    return base64;
  }

  private buildHtml(data: ReceiptData): string {
    const htmlTemplate = this.templateProvider.getHtmlTemplate();
    const css = this.templateProvider.getCss();

    let html = this.populateTemplate(htmlTemplate, data);
    html = this.inlineCss(html, css);
    return html;
  }

  private populateTemplate(template: string, data: ReceiptData): string {
    let result = template;

    if (!data.discount_amount || data.discount_amount === "$0.00" || data.discount_amount === "0") {
      result = result.replace(/<div class="cost-row discount">[\s\S]*?<\/div>/, "");
    }

    const dataWithDefaults = defaults({}, data, {
      qr_code_svg: ReceiptPdfGenerator.DEFAULT_QR_CODE,
      company_logo_svg: ReceiptPdfGenerator.DEFAULT_LOGO,
      discount_label: "",
      discount_percent: "",
      discount_amount: "",
    });

    forEach(dataWithDefaults, (value, key) => {
      const placeholder = new RegExp(`{{${key}}}`, "g");
      result = result.replace(placeholder, value);
    });

    return result;
  }

  private inlineCss(html: string, css: string): string {
    return html.replace(
      '<link rel="stylesheet" href="../css/styles.css">',
      `<style>${css}</style>`
    );
  }

  static create(templateDir?: string): ReceiptPdfGenerator {
    const dir = templateDir || path.join(__dirname, "..", "..", "template");
    return new ReceiptPdfGenerator(
      new FileTemplateProvider(dir),
      new PuppeteerPdfRenderer()
    );
  }
}
