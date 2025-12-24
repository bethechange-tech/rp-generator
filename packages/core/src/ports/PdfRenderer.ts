export interface PdfRenderer {
  render(html: string, outputPath: string): Promise<void>;
  renderToBase64(html: string): Promise<string>;
}
