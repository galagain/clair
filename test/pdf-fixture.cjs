// Small real PDF fixture, generated locally, no personal data.
module.exports=function pdfFixture(text='EXPERIENCE TEST: Python, 3 ans.'){
 const escaped=text.replace(/([\\()])/g,'\\$1');
 const stream=`BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;
 const objects=[
 '<< /Type /Catalog /Pages 2 0 R >>',
 '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
 '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
 '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
 `<< /Length ${Buffer.byteLength(stream,'latin1')} >>\nstream\n${stream}\nendstream`
 ];
 let data='%PDF-1.4\n';const offsets=[0];
 objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(data,'latin1'));data+=`${i+1} 0 obj\n${o}\nendobj\n`;});
 const xref=Buffer.byteLength(data,'latin1');data+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
 for(const offset of offsets.slice(1))data+=`${String(offset).padStart(10,'0')} 00000 n \n`;
 data+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return Buffer.from(data,'latin1');
};
