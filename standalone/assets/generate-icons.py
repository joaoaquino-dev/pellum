"""Generate raster variants of the code-native Pellum mark (development only)."""
from pathlib import Path
from PIL import Image, ImageDraw
root = Path(__file__).parent
scale = 12
image = Image.new('RGBA', (64 * scale, 64 * scale))
draw = ImageDraw.Draw(image)
def box(values):
    return tuple(v * scale for v in values)
draw.rounded_rectangle(box((0, 0, 64, 64)), radius=16 * scale, fill='#345e4d')
draw.rounded_rectangle(box((19, 13, 50, 40)), radius=13 * scale, fill='#f4f4e9')
draw.rectangle(box((19, 13, 32, 51)), fill='#f4f4e9')
draw.rounded_rectangle(box((27, 20, 42, 33)), radius=6 * scale, fill='#345e4d')
draw.rectangle(box((27, 40, 32, 51)), fill='#345e4d')
draw.ellipse(box((46, 10, 52, 16)), fill='#c39960')
for size, name in [(32, 'favicon-32.png'), (180, 'apple-touch-icon.png')]:
    image.resize((size, size), Image.Resampling.LANCZOS).save(root / name)
