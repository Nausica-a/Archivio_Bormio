import os
import torch
import clip
import umap
import numpy as np
import pandas as pd
from PIL import Image
from tqdm import tqdm

# === CONFIG ===
IMAGE_FOLDER = "immagini_insta_siamoalpi"  # cartella immagini
OUTPUT_CSV = "coordinates.csv"

device = "cuda" if torch.cuda.is_available() else "cpu"

# Carica CLIP
model, preprocess = clip.load("ViT-B/32", device=device)

embeddings = []
paths = []

print("Calcolo embeddings...")

for filename in tqdm(os.listdir(IMAGE_FOLDER)):
    if filename.lower().endswith((".jpg", ".jpeg", ".png")):
        path = os.path.join(IMAGE_FOLDER, filename)
        image = preprocess(Image.open(path)).unsqueeze(0).to(device)

        with torch.no_grad():
            emb = model.encode_image(image)
            emb /= emb.norm(dim=-1, keepdim=True)

        embeddings.append(emb.cpu().numpy()[0])
        paths.append(filename)

embeddings = np.array(embeddings)

print("Riduzione dimensionale con UMAP...")
reducer = umap.UMAP(
    n_neighbors=100,
    min_dist=0.55,
    spread=2.8,
    metric="cosine",
    random_state=42
)

coords = reducer.fit_transform(embeddings)

# Normalizzazione centrata
coords = coords - coords.mean(axis=0)
coords = coords / np.abs(coords).max()

# Espansione controllata
coords *= 3.5

# Micro dispersione
coords += np.random.normal(0, 0.01, coords.shape)




coords = reducer.fit_transform(embeddings)

df = pd.DataFrame({
    "filename": paths,
    "x": coords[:, 0],
    "y": coords[:, 1]
})

df.to_csv(OUTPUT_CSV, index=False)

print("Fatto! Coordinate salvate in coordinates.csv")