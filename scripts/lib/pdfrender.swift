// Render page 1 of a PDF to a PNG using Quartz - the renderer Preview and every
// macOS app use. poppler is a fine independent check but implements a subset;
// transparency groups, soft masks and blend modes are exactly where it diverges,
// and those are what shadow work touches.
//
// usage: pdfrender <in.pdf> <out.png> <widthPx> <heightPx>
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let a = CommandLine.arguments
guard a.count >= 5,
      let doc = CGPDFDocument(URL(fileURLWithPath: a[1]) as CFURL),
      let page = doc.page(at: 1),
      let w = Int(a[3]), let h = Int(a[4]), w > 0, h > 0 else {
  FileHandle.standardError.write("usage: pdfrender in.pdf out.png w h\n".data(using: .utf8)!)
  exit(2)
}

guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8,
                          bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
                          bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { exit(3) }
// White page, so the diff compares composited colour rather than premultiplied alpha.
ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))

let box = page.getBoxRect(.mediaBox)
ctx.scaleBy(x: CGFloat(w) / box.width, y: CGFloat(h) / box.height)
ctx.translateBy(x: -box.origin.x, y: -box.origin.y)
ctx.interpolationQuality = .high
ctx.setAllowsAntialiasing(true)
ctx.drawPDFPage(page)

guard let img = ctx.makeImage(),
      let dst = CGImageDestinationCreateWithURL(URL(fileURLWithPath: a[2]) as CFURL,
                                                UTType.png.identifier as CFString, 1, nil) else { exit(4) }
CGImageDestinationAddImage(dst, img, nil)
CGImageDestinationFinalize(dst)
