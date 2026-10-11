"""Common WebP encoder for the diet tool and all cut_* asset generators."""
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageChops, features


def difference(original, decoded):
    """All RGBA channels, including hidden RGB; alpha must be preserved exactly."""
    a, b = original.convert('RGBA'), decoded.convert('RGBA')
    if a.size != b.size:
        raise ValueError('WebP dimensions changed')
    delta = ImageChops.difference(a, b)
    hist = delta.histogram()
    pixels = a.width * a.height
    return {'maxChannelDelta': max(v[1] for v in delta.getextrema()),
            'meanChannelDelta': sum(i * hist[c*256+i] for c in range(4) for i in range(256)) / (pixels*4),
            'changedPixelRatio': sum(any(px) for px in delta.get_flattened_data()) / pixels,
            'alphaExact': a.getchannel('A').tobytes() == b.getchannel('A').tobytes()}


def encode_webp(image, lossy=False):
    if not features.check('webp'):
        raise RuntimeError('Pillow WebP support required')
    im = image.convert('RGBA')
    attempts = []
    for lossless, quality in ([(False,90),(False,95),(True,100)] if lossy else [(True,100)]):
        stream = BytesIO()
        im.save(stream, format='WEBP', lossless=lossless, quality=quality, method=6, exact=True)
        data = stream.getvalue()
        with Image.open(BytesIO(data)) as decoded:
            diff = difference(im, decoded)
        attempts.append({'lossless':lossless,'quality':quality,'bytes':len(data), **diff})
        if diff['alphaExact'] and diff['maxChannelDelta'] <= (0 if lossless else 24):
            return data, {**attempts[-1], 'attempts':attempts}
    raise ValueError('Encoder did not preserve alpha / lossless pixels')


def save_webp(image, path):
    """Generators always emit lossless assets, preserving replay pixels and shared path families."""
    dest = Path(path).with_suffix('.webp')
    data, _ = encode_webp(image)
    dest.write_bytes(data)
    # Some runtime paths deliberately retain PNG/JPG for compositing or size. Recutting
    # must refresh those existing companions too, rather than leave stale art in the game.
    png = dest.with_suffix('.png')
    jpg = dest.with_suffix('.jpg')
    if png.exists(): image.save(png, format='PNG', optimize=True)
    if jpg.exists(): image.convert('RGB').save(jpg, format='JPEG', quality=100, optimize=True)
    return dest
