# Dibuja cada subtítulo de una toma como una imagen PNG transparente: texto
# blanco sobre una franja oscura redondeada, para 1920 px de ancho.
#
#   python3 lib/subtitulos.py <carpeta>     # lee <carpeta>/cues.json, deja c00.png, c01.png…
#
# Existe porque el ffmpeg de Homebrew viene sin libass ni drawtext: no puede
# escribir texto sobre el video, pero sí superponer una imagen (overlay).
# Usa Pillow y la Helvetica Neue del sistema.
import json
import sys

from PIL import Image, ImageDraw, ImageFont

carpeta = sys.argv[1]
cues = json.load(open(f"{carpeta}/cues.json"))
fuente = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 44, index=1)
ANCHO_MAX, ALTO_LINEA, PAD = 1500, 58, 22

for i, c in enumerate(cues):
    medir = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    lineas, linea = [], ""
    for palabra in c["texto"].split():
        prueba = f"{linea} {palabra}".strip()
        if medir.textlength(prueba, font=fuente) > ANCHO_MAX and linea:
            lineas.append(linea)
            linea = palabra
        else:
            linea = prueba
    lineas.append(linea)

    ancho = int(max(medir.textlength(x, font=fuente) for x in lineas)) + 4 * PAD
    alto = ALTO_LINEA * len(lineas) + 2 * PAD
    img = Image.new("RGBA", (ancho, alto), (0, 0, 0, 0))
    dibujo = ImageDraw.Draw(img)
    dibujo.rounded_rectangle([0, 0, ancho - 1, alto - 1], radius=16, fill=(17, 17, 24, 200))
    for j, x in enumerate(lineas):
        dibujo.text(((ancho - dibujo.textlength(x, font=fuente)) / 2, PAD + j * ALTO_LINEA), x, font=fuente, fill=(255, 255, 255, 255))
    img.save(f"{carpeta}/c{i:02d}.png")
