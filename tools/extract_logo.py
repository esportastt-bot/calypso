"""Extrait le logo Calypso du visuel source : supprime le fond bleu et le texte.

Méthode :
 1. On modélise le fond (dégradé bleu) par un polynôme 2D ajusté sur les pixels
    situés hors de la zone du logo.
 2. On mesure l'écart de chaque pixel au fond -> masque grossier.
 3. On bouche les trous (intérieur du globe, sombre) pour garder un logo opaque.
 4. Bords adoucis + "dé-mélange" des couleurs pour éviter le halo bleu.
Sortie : assets/logo.png (RGBA, recadré) + assets/logo.js (data URI embarqué).
"""
import base64
import io
import os

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "logo_source.jpg")

img = np.asarray(Image.open(SRC).convert("RGB")).astype(np.float32) / 255.0
H, W, _ = img.shape

# Zone du logo (au-dessus du texte "CALYPSO")
X0, X1, Y0, Y1 = 320, 710, 70, 352

# ---------- 1. modèle de fond ----------
yy, xx = np.mgrid[0:H, 0:W]
xn, yn = xx / W, yy / H
bg_sample = np.ones((H, W), bool)
bg_sample[Y0 - 30:Y1 + 30, X0 - 40:X1 + 40] = False
bg_sample[355:500, 250:780] = False  # texte


def basis(x, y):
    return np.stack([np.ones_like(x), x, y, x * x, y * y, x * y,
                     x ** 3, y ** 3, x * x * y, x * y * y], -1)


A = basis(xn[bg_sample], yn[bg_sample])
bg = np.zeros_like(img)
for c in range(3):
    coef, *_ = np.linalg.lstsq(A, img[..., c][bg_sample], rcond=None)
    bg[..., c] = basis(xn, yn) @ coef

# ---------- 2. écart au fond ----------
diff = img - bg
dist = np.sqrt((diff ** 2).sum(-1))
# le halo lumineux autour du logo est bleuté : on pénalise les écarts "bleus purs"
lum = img.mean(-1) - bg.mean(-1)

crop = (slice(Y0, Y1), slice(X0, X1))
d = dist[crop]
hard = d > 0.10
hard = ndi.binary_closing(hard, iterations=2)
hard = ndi.binary_fill_holes(hard)
hard = ndi.binary_opening(hard, iterations=1)

# garder les grosses composantes connexes uniquement
lab, n = ndi.label(hard)
sizes = ndi.sum(hard, lab, range(1, n + 1))
keep = np.zeros(n + 1, bool)
keep[1:] = sizes > 60
hard = keep[lab]

# ---------- 3. alpha doux ----------
inner = ndi.binary_erosion(hard, iterations=2)
soft = np.clip((d - 0.03) / 0.12, 0, 1)
alpha = np.where(inner, 1.0, np.where(hard, np.maximum(soft, 0.6), soft * 0.85))
# coupe ce qui est loin de la forme (halo de fond)
near = ndi.binary_dilation(hard, iterations=3)
alpha = np.where(near, alpha, 0.0)
alpha = ndi.gaussian_filter(alpha, 0.6)
alpha = np.clip(alpha, 0, 1)

# ---------- 4. dé-mélange des couleurs aux bords ----------
C = img[crop]
B = bg[crop]
a3 = np.maximum(alpha, 0.05)[..., None]
F = np.clip(B + (C - B) / a3, 0, 1)
F = np.where(alpha[..., None] > 0.95, C, F)

rgba = np.dstack([F, alpha]) * 255
out = Image.fromarray(rgba.astype(np.uint8), "RGBA")
bbox = out.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
out = out.crop((bbox[0] - 6, bbox[1] - 6, bbox[2] + 6, bbox[3] + 6))

# upscale x2 (Lanczos + léger sharpen) pour un rendu net en 1080p
out = out.resize((out.width * 2, out.height * 2), Image.LANCZOS)
rgb = out.convert("RGB").filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
out = Image.merge("RGBA", (*rgb.split(), out.getchannel("A")))

png_path = os.path.join(ROOT, "assets", "logo.png")
out.save(png_path, optimize=True)

buf = io.BytesIO()
out.save(buf, "PNG", optimize=True)
b64 = base64.b64encode(buf.getvalue()).decode()
with open(os.path.join(ROOT, "assets", "logo.js"), "w", encoding="utf-8") as f:
    f.write("window.CALYPSO_LOGO='data:image/png;base64," + b64 + "';\n")

# aperçu sur fond noir et fond blanc pour contrôle
prev = Image.new("RGB", (out.width * 2, out.height), (0, 0, 0))
prev.paste(out, (0, 0), out)
white = Image.new("RGB", out.size, (255, 255, 255))
white.paste(out, (0, 0), out)
prev.paste(white, (out.width, 0))
prev.save(os.path.join(ROOT, "assets", "logo_preview.png"))
print("logo:", out.size, "bytes:", len(buf.getvalue()))
