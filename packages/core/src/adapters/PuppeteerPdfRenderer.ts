import puppeteer from "puppeteer";
import { PdfRenderer } from "../ports";

export class PuppeteerPdfRenderer implements PdfRenderer {
  private readonly pdfOptions = {
    format: "A4" as const,
    printBackground: true,
    margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
  };

  async render(html: string, outputPath: string): Promise<void> {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: "networkidle0" });

    await page.pdf({
      path: outputPath,
      ...this.pdfOptions,
    });

    await browser.close();
  }

  async renderToBase64(html: string): Promise<string> {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf(this.pdfOptions);

    await browser.close();

    return Buffer.from(pdfBuffer).toString("base64");
  }
}
