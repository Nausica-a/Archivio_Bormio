import os
from PIL import Image

INPUT_FOLDER = "immagini_insta_siamoalpi"
OUTPUT_FOLDER = "thumbs"
SIZE = (180, 180)  # puoi scendere a 80x80 per effetto più denso

os.makedirs(OUTPUT_FOLDER, exist_ok=True)

for filename in os.listdir(INPUT_FOLDER):
    if filename.lower().endswith((".jpg", ".jpeg", ".png")):
        img_path = os.path.join(INPUT_FOLDER, filename)
        out_path = os.path.join(OUTPUT_FOLDER, filename)

        img = Image.open(img_path)
        img.thumbnail(SIZE)
        img.save(out_path, quality=75)

print("Miniature create!")