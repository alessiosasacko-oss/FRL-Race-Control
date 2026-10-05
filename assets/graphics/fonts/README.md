# Graphics Studio fonts

Unmodified Barlow Regular (400), Bold (700) and Black (900), distributed under
the SIL Open Font License 1.1 in `OFL.txt`.

Source: https://github.com/google/fonts/tree/6cdf01867df0813c2390f90dff7dc66c87f14cf7/ofl/barlow

Unmodified Noto Sans Regular and Bold provide a whole-run fallback for glyphs
absent in Barlow (for example capital sharp S, `ẞ`). Their SIL Open Font License
1.1 is included in `OFL-Noto.txt`.

Source: https://github.com/notofonts/noto-fonts/tree/c971829a87e7920f960e7277c3dafd9bedd3c601/hinted/ttf/NotoSans

The server reads these files from disk and converts all lettering to SVG paths
using OpenType.js before Sharp rasterization. No CSS/webfont, network request,
fontconfig or installed system font is needed. Next output tracing explicitly
includes this directory for preview and background rendering entry points.
