export default function PDFViewer({ pdfUrl }) {
  if (!pdfUrl) return <p>No PDF selected</p>;

  return (
    <iframe
      src={pdfUrl}
      width="100%"
      height="600px"
      style={{ border: '1px solid #ccc' }}
      title="PDF Preview"
    ></iframe>
  );
}
