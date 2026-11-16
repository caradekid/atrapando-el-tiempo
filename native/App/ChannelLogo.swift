import AppKit

/// The "Atrapando el tiempo" mark as vectors, matching web/engine.js (EMBLEM).
/// Coordinates are in the original 620 px artwork space, y pointing down.
enum ChannelLogo {
    private static let base: CGFloat = 452
    private static let half: CGFloat = 24
    private static let corner: CGFloat = 11
    private static let strokes: [(CGFloat, CGFloat, CGFloat)] = [(122, 252, 212), (258, 375.7, 234.6), (490, 305, 100)]
    private static let dot = (x: CGFloat(377), y: CGFloat(433), r: CGFloat(19.5))

    static func path() -> CGPath {
        let path = CGMutablePath()
        for (xb, xt, yt) in strokes {
            let len = hypot(xt - xb, yt - base)
            let d = CGPoint(x: (xt - xb) / len, y: (yt - base) / len)
            let n = CGPoint(x: -d.y, y: d.x)
            func atBase(_ s: CGFloat) -> CGPoint {
                let p = CGPoint(x: xb + n.x * half * s, y: base + n.y * half * s)
                let t = (base - p.y) / d.y
                return CGPoint(x: p.x + d.x * t, y: base)
            }
            let br = atBase(1), bl = atBase(-1)
            let tr = CGPoint(x: xt + n.x * half, y: yt + n.y * half)
            let a1 = atan2(n.y, n.x)
            path.move(to: CGPoint(x: (bl.x + br.x) / 2, y: base))
            path.addArc(tangent1End: br, tangent2End: tr, radius: corner)
            path.addLine(to: tr)
            path.addArc(center: CGPoint(x: xt, y: yt), radius: half, startAngle: a1, endAngle: a1 + .pi, clockwise: true)
            path.addArc(tangent1End: bl, tangent2End: CGPoint(x: (bl.x + br.x) / 2, y: base), radius: corner)
            path.closeSubpath()
        }
        path.addEllipse(in: CGRect(x: dot.x - dot.r, y: dot.y - dot.r, width: dot.r * 2, height: dot.r * 2))
        return path
    }

    /// Monochrome template image for the menu bar.
    static func menuBarImage(size: CGFloat = 18) -> NSImage {
        let image = NSImage(size: NSSize(width: size, height: size), flipped: true) { _ in
            guard let ctx = NSGraphicsContext.current?.cgContext else { return false }
            // artwork bounds ≈ x 95…525, y 78…455 → fit into the square with a small margin
            let k = size / 450
            ctx.scaleBy(x: k, y: k)
            ctx.translateBy(x: -85, y: -45)
            ctx.addPath(path())
            ctx.setFillColor(NSColor.black.cgColor)
            ctx.fillPath(using: .winding)
            return true
        }
        image.isTemplate = true
        image.accessibilityDescription = "Atrapando el tiempo"
        return image
    }
}
