"""Use CHROME_PATH, the existing Linux image, or Playwright's installed Chromium."""
import os
from pathlib import Path
from urllib.parse import urlsplit


def chrome_path():
    supplied = os.environ.get('CHROME_PATH')
    if supplied:
        if not Path(supplied).is_file():
            raise ValueError('CHROME_PATH must point to an existing browser executable')
        return supplied
    linux = Path('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
    return str(linux) if linux.is_file() else None


def local_url(url):
    u = urlsplit(url)
    if u.scheme != 'http' or u.hostname not in ('localhost', '127.0.0.1') or u.port != 8797:
        raise ValueError('This tool only permits the isolated HTTP QA server on loopback:8797')
    return f'{u.scheme}://{u.netloc}'
