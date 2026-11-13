"""Generate manifest icons for the Chrome Web Store upload.

Run only in a clean Actions checkout. The source extension remains unchanged;
the published package receives generated icons and a manifest with icon paths.
"""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "computo-192.png"
EXT = ROOT / "experiments" / "sap-windows-extension"

with Image.open(SOURCE) as source:
    icon = source.convert("RGBA")
    for size in (16, 48, 128):
        # Store guidance: 96 px illustration inside a 128 px transparent canvas.
        inner = round(size * 0.75)
        drawing = icon.resize((inner, inner), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        canvas.alpha_composite(drawing, ((size-inner)//2, (size-inner)//2))
        canvas.save(EXT / f"icon-{size}.png", optimize=True)

manifest_path = EXT / "manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["icons"] = {str(size): f"icon-{size}.png" for size in (16, 48, 128)}
manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("Chrome Store manifest and 16/48/128 px icons ready")
