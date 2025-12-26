/** Port for PDF rendering (infrastructure agnostic) */
export interface IPdfRenderer {
  /** Render HTML to PDF file */
  render(html: string, outputPath: string): Promise<void>;

  /** Render HTML to base64-encoded PDF */
  renderToBase64(html: string): Promise<string>;
}
