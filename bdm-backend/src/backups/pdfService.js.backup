// bdm-backend/src/services/pdfService.js
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

class PDFService {

  // ✨ MAIN: Generate PDF from document content (HTML-aware)
  async generatePDF(document, options = {}) {
    let browser = null;
    let tempFilePath = null;

    console.log("--- PDF Service: Input Document Data ---");
    if (!document || !document.content_json) {
        console.error("❌ PDF generation failed: Document or content_json missing.");
        throw new Error("PDF generation failed: Document or content_json missing.");
    }

    try {
      console.log('🔧 Launching browser (Headless)...');
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();

      // Error listeners
      page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
      page.on('pageerror', error => console.error('BROWSER PAGE ERROR:', error.message));
      page.on('requestfailed', request => console.error(`BROWSER REQUEST FAILED: ${request.url()}`));

      // ✨ BUILD HTML from clauses (now HTML-aware)
      const html = this.buildHTMLTemplate(document, options);

      console.log("Setting page content...");
      await page.setContent(html, { waitUntil: 'networkidle0' });
      console.log("Page content set.");

      tempFilePath = path.join(os.tmpdir(), `bdm_temp_pdf_${Date.now()}.pdf`);
      console.log(`Generating PDF to temporary file: ${tempFilePath}`);
      
      await page.pdf({
        path: tempFilePath,
        format: 'A4',
        printBackground: true,
        margin: { top: '25mm', right: '20mm', bottom: '25mm', left: '20mm' },
        displayHeaderFooter: true,
        headerTemplate: this.getHeaderTemplate(document, options),
        footerTemplate: this.getFooterTemplate()
      });
      console.log(`✅ PDF written to temp file.`);

      console.log(`Reading buffer from temp file...`);
      const pdfBuffer = await fs.readFile(tempFilePath);
      console.log(`✅ Buffer read (Length: ${pdfBuffer.length})`);

      if (pdfBuffer.length === 0) { 
        throw new Error("Empty PDF buffer."); 
      }
      return pdfBuffer;

    } catch (error) {
       console.error('❌ PDF generation failed:', error);
       throw new Error(`PDF generation failed: ${error.message || error}`);
    } finally {
      if (browser) {
        try { 
          await browser.close(); 
          console.log("Browser closed."); 
        } catch (closeError) { 
          console.error("Error closing browser:", closeError); 
        }
      }
      if (tempFilePath) {
        try { 
          await fs.unlink(tempFilePath); 
          console.log(`Temp file deleted: ${tempFilePath}`); 
        } catch (unlinkError) { 
          if (unlinkError.code !== 'ENOENT') { 
            console.error(`⚠️ Failed to delete temp file: ${tempFilePath}`, unlinkError); 
          } 
        }
      }
    }
  }

  // ✨ Generate PDF directly from HTML string (for bilingual PDFs)
  async generateFromHtml(html, options = {}) {
    let browser = null;
    let tempFilePath = null;

    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();

      page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
      page.on('pageerror', error => console.error('BROWSER PAGE ERROR:', error.message));

      await page.setContent(html, { waitUntil: 'networkidle0' });

      tempFilePath = path.join(os.tmpdir(), `bdm_temp_pdf_${Date.now()}.pdf`);
      await page.pdf({
        path: tempFilePath,
        format: 'A4',
        printBackground: true,
        margin: { top: '25mm', right: '20mm', bottom: '25mm', left: '20mm' },
        displayHeaderFooter: !!options.displayHeaderFooter,
        headerTemplate: options.headerTemplate || '',
        footerTemplate: options.footerTemplate || ''
      });

      const buf = await fs.readFile(tempFilePath);
      if (!buf || buf.length === 0) throw new Error('Empty PDF from HTML');
      return buf;
    } catch (err) {
      console.error('generateFromHtml error:', err);
      throw err;
    } finally {
      if (browser) {
        try { await browser.close(); } catch (e) { console.warn('Error closing browser', e); }
      }
      if (tempFilePath) {
        try { await fs.unlink(tempFilePath); } catch (e) { /* ignore */ }
      }
    }
  }

  // ✨ NEW: Build HTML template (HTML-aware - renders stored HTML directly)
  buildHTMLTemplate(document, options = {}) {
    const content = document.content_json;
    const clauses = (content && Array.isArray(content.clauses)) ? content.clauses :
                    (content && Array.isArray(content.filled_clauses)) ? content.filled_clauses :
                    [];

    if (clauses.length === 0) {
        console.warn("⚠️ No clauses found. Generating empty document.");
        return `<html><head><meta charset="UTF-8"><style>${this.getStyles()}</style></head><body><div class="document"><p style="color: red;">Error: Document has no clauses.</p></div></body></html>`;
    }

    // ✨ KEY CHANGE: Render HTML directly instead of converting to text
    const clausesHTML = clauses.map((clause, index) => {
        if (!clause || typeof clause !== 'object') return '';
        
        const clauseContent = typeof clause.content === 'string' ? clause.content : '';
        const clauseType = typeof clause.clause_type === 'string' ? clause.clause_type : 'unknown';
        
        // Check if content is HTML or plain text
        const isHTML = /<[a-z][\s\S]*>/i.test(clauseContent);
        
        if (isHTML) {
          // Content is already HTML - render it directly
          return `<div class="clause clause-${clauseType.toLowerCase().replace(/[^a-z0-9]/g, '-')}">
            ${clauseContent}
          </div>`;
        } else {
          // Content is plain text - convert to HTML (backward compatibility)
          return `<div class="clause clause-${clauseType.toLowerCase().replace(/[^a-z0-9]/g, '-')}">
            ${this.convertPlainTextToHTML(clauseContent, clauseType)}
          </div>`;
        }
      }).join('\n');

     return `
       <!DOCTYPE html>
       <html>
         <head>
           <meta charset="UTF-8">
           <title>${this.escapeHtml(document.document_name || 'Document')}</title>
           <style>${this.getStyles(options)}</style>
         </head>
         <body>
           <div class="document">
             ${clausesHTML}
           </div>
         </body>
       </html>
     `;
   }

  // ✨ NEW: Convert plain text to HTML (backward compatibility)
  convertPlainTextToHTML(content, clauseType) {
    const escapedContent = this.escapeHtml(content);
    const lowerClauseType = clauseType.toLowerCase();

    // Signature blocks need <pre>
    if (lowerClauseType.includes('signature')) {
      return `<pre>${escapedContent}</pre>`;
    }
    
    // Headers
    if (lowerClauseType === 'header') {
        return `<h1>${escapedContent.replace(/\n/g, '<br>')}</h1>`;
    }
    
    // Sub-headers
    if (lowerClauseType.startsWith('header-') || lowerClauseType === 'date') {
         return `<h3>${escapedContent.replace(/\n/g, '<br>')}</h3>`;
    }

    // Subject lines
    if (lowerClauseType.includes('subject') || lowerClauseType.includes('re:')) {
         return `<h4>${escapedContent.replace(/\n/g, '<br>')}</h4>`;
    }

    // Default: paragraph
    return `<p>${escapedContent.replace(/\n/g, '<br>')}</p>`;
  }

  // ✨ Helper: Escape HTML (used only for plain text conversion)
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }

  // ✨ UPDATED: CSS styles (enhanced for HTML content, including tables)
  getStyles(options = {}) {
    return `
      * { box-sizing: border-box; }
      body {
        font-family: 'Times New Roman', Times, serif;
        font-size: 11pt;
        line-height: 1.5;
        color: #000;
      }
      .document {
        max-width: 100%;
        padding: 0;
      }
      .clause {
        margin-bottom: 1.15em;
        page-break-inside: avoid;
      }
      
      /* Paragraphs */
      .clause p {
        margin: 0 0 0.5em 0;
        padding: 0;
        text-align: justify;
      }
      
      /* Headings */
      .clause h1, .clause h2, .clause h3, .clause h4 {
        margin: 0 0 0.5em 0;
        padding: 0;
        text-align: left;
      }
      .clause h1 { font-size: 1.6em; font-weight: bold; }
      .clause h2 { font-size: 1.3em; font-weight: bold; }
      .clause h3 { font-size: 1.1em; font-weight: normal; }
      .clause h4 { font-size: 1em; font-weight: bold; }
      
      /* Lists */
      .clause ul, .clause ol {
        margin: 0.5em 0 0.5em 2em;
        padding: 0;
      }
      .clause li {
        margin-bottom: 0.25em;
      }
      
      /* ✨ NEW: Table styling */
      .clause table {
        width: 100%;
        border-collapse: collapse;
        margin: 1em 0;
        font-size: 10pt;
      }
      .clause table th {
        background-color: #f0f0f0;
        border: 1px solid #666;
        padding: 8px;
        text-align: left;
        font-weight: bold;
      }
      .clause table td {
        border: 1px solid #999;
        padding: 8px;
        text-align: left;
      }
      .clause table tbody tr:nth-child(even) {
        background-color: #f9f9f9;
      }
      
      /* Emphasis */
      strong { font-weight: bold; }
      em { font-style: italic; }
      
      /* Signatures */
      pre {
        font-family: inherit;
        font-size: inherit;
        line-height: 1.6;
        white-space: pre-wrap;
        margin: 0;
        padding: 0;
        text-align: left;
      }

      /* Specific clause types */
      .clause-header {
        text-align: center;
        margin-bottom: 1.2em;
        border-bottom: 1px solid #666;
        padding-bottom: 8px;
      }
      .clause-header h1 {
        font-size: 1.6em; 
        line-height: 1.3;
        text-align: center;
      }
      .clause-header-1, .clause-header-2 {
         text-align: center; 
         font-size: 1em;
         font-weight: normal;
         line-height: 1.4;
         margin-bottom: 0.5em; 
         margin-top: 1.5em; 
      }
      .clause-greeting {
        margin-top: 2em;
        margin-bottom: 1em;
      }
      .clause-subject, .clause[class*="clause-re-"] {
         margin-bottom: 1.5em;
         font-weight: bold;
         text-decoration: underline;
      }
      .clause-closing {
        margin-top: 2em;
        margin-bottom: 0.25em;
      }
      .clause-signature, .clause[class*="clause-signature-"] {
        margin-top: 0.5em;
      }
      .clause-signature pre, .clause[class*="clause-signature-"] pre {
         line-height: 2.0; 
      }
      
      /* ✨ Compensation tables (offer letters) */
      .clause-compensation table {
        margin-top: 1em;
        border: 2px solid #333;
      }
      .clause-compensation table th {
        background-color: #e0e0e0;
        border: 1px solid #333;
      }
    `;
   }

  // Header template
  getHeaderTemplate(document, options = {}) {
     const companyName = options.companyName || 'Company';
     const safeDocName = this.escapeHtml(document.document_name || '');
     return `
       <div style="
         width: 100%; 
         font-size: 9pt; 
         color: #666; 
         border-bottom: 1px solid #ddd; 
         box-sizing: border-box; 
         padding-bottom: 5px; 
         margin: 0 10mm;
         display: flex; 
         justify-content: space-between;
       ">
         <span>${companyName}</span>
         <span>${safeDocName}</span>
       </div>`;
   }

  // Footer template
  getFooterTemplate() {
     return `
       <div style="
         width: 100%; 
         font-size: 9pt; 
         color: #666; 
         border-top: 1px solid #ddd; 
         box-sizing: border-box; 
         padding-top: 5px; 
         margin: 0 10mm; 
         display: flex; 
         justify-content: space-between;
       ">
         <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
         <span>Generated on ${new Date().toLocaleDateString()}</span>
       </div>`;
   }

  // Save PDF to file system
  async savePDF(document, pdfBuffer) {
    if (!pdfBuffer || pdfBuffer.length === 0) {
        console.error('❌ Attempted to save empty PDF buffer.');
        throw new Error('Cannot save empty PDF buffer.');
    }
    try {
      const pdfDir = path.join(__dirname, '../../generated_pdfs');
      try { 
        await fs.access(pdfDir); 
      } catch { 
        await fs.mkdir(pdfDir, { recursive: true }); 
      }
      
      const safeBaseName = String(document.document_name || 'document')
        .replace(/[^a-z0-9_\-\.]/gi, '_');
      const filename = `${safeBaseName}_${Date.now()}.pdf`;
      const filepath = path.join(pdfDir, filename);
      
      await fs.writeFile(filepath, pdfBuffer);
      console.log(`✅ PDF saved to: ${filepath}`);
      return filepath;
    } catch (error) {
      console.error('❌ Failed to save PDF:', error);
      throw error;
    }
  }

  // Get saved PDF path
  async getPDFPath(documentId) {
    const pdfDir = path.join(__dirname, '../../generated_pdfs');
    try {
      const files = await fs.readdir(pdfDir);
      const pdfFiles = files.filter(file => 
        file.startsWith(`${documentId}_`) && file.endsWith('.pdf')
      );
      
      if (pdfFiles.length > 0) {
          pdfFiles.sort((a, b) => {
              const timeA = parseInt(a.split('_').pop().replace('.pdf', ''), 10) || 0;
              const timeB = parseInt(b.split('_').pop().replace('.pdf', ''), 10) || 0;
              return timeB - timeA;
          });
          return path.join(pdfDir, pdfFiles[0]);
      }
      return null;
    } catch (err) {
      if (err.code !== 'ENOENT') { 
        console.error("Error reading PDF directory:", err); 
      }
      return null;
    }
   }
}

module.exports = new PDFService();