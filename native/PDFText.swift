import Foundation
import PDFKit

// Receives a user-selected PDF through stdin. No files written, no network,
// rendering, scripting, attachments or embedded actions executed by Clair.
func respond(_ result: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: result) {
        FileHandle.standardOutput.write(data)
    }
}
let bytes = FileHandle.standardInput.readDataToEndOfFile()
if bytes.count > 10 * 1024 * 1024 { respond(["error": "PDF trop volumineux (10 Mo max)."]); exit(0) }
guard let pdf = PDFDocument(data: bytes) else { respond(["error": "PDF illisible."]); exit(0) }
if pdf.isLocked { respond(["error": "PDF protégé par un mot de passe."]); exit(0) }
if pdf.pageCount < 1 || pdf.pageCount > 80 { respond(["error": "PDF limité à 80 pages."]); exit(0) }
var pages: [String] = []
var count = 0
var emptyPages = 0
for index in 0..<pdf.pageCount {
    let text = (pdf.page(at: index)?.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    if text.isEmpty { emptyPages += 1 }
    count += text.utf16.count
    if count > 60000 { respond(["error": "PDF trop long (60 000 caractères max)."]); exit(0) }
    if !text.isEmpty { pages.append("[Page \(index + 1)]\n\(text)") }
}
if pages.isEmpty { respond(["error": "PDF sans texte lisible. Les scans ne sont pas pris en charge."]); exit(0) }
respond(["text": pages.joined(separator: "\n\n"), "pages": pdf.pageCount, "emptyPages": emptyPages])
