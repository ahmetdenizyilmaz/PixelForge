"""Unified Palette Catalog, File Parsers (GPL/JASC/HEX/JSON/Lospec), and Hybrid OKLab-BGM Extraction.

Combines:
- All 24 built-in Lospec palettes from PixelForge
- All 31 classic retro hardware & CRT phosphor palettes from PixelForge (`Pal` Enum compatible)
- 4 new signature Reel palettes (`kurzgesagt-24`, `pc98-cyber-16`, `aloboi-dream-16`, `oscilloscope-p31`)
- Universal `.gpl` (GIMP/Aseprite), `.pal` (JASC-PAL), `.hex`, `.txt` (Paint.NET), `.json`, and live Lospec slug fetcher
- 3 Palette Discovery Engines:
    1. `oklab_median_cut`  - Deterministic chroma-salient Median-Cut + OKLab K-Means
    2. `bgm`               - Unsupervised Bayesian Gaussian Mixture Model (Dirichlet prior)
    3. `hybrid_bgm_oklab`  - NEW: Deterministic OKLab chroma-salient Median-Cut seeding + Bayesian
                             Gaussian Mixture covariance refinement (zero random flicker + preserves vivid accents!)
"""

from enum import Enum
import json
import re
import urllib.request
import warnings
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Sequence, Tuple, Union

import numpy as np
from sklearn.exceptions import ConvergenceWarning
from sklearn.mixture import BayesianGaussianMixture

from .fast_ops import oklab2rgb, oklab_palette_labels, resize_float, rgb2hsv_fast, hsv2rgb_fast, rgb2oklab


def parse_hex_color(c: Union[str, Sequence[int]]) -> Tuple[int, int, int]:
    """Parses '#rgb', '#rrggbb', '#rrggbbaa', 'rrggbb' or [r,g,b] into (r, g, b) uint8 tuple."""
    if isinstance(c, (list, tuple, np.ndarray)):
        return int(c[0]) & 255, int(c[1]) & 255, int(c[2]) & 255
    s = str(c).strip()
    if s.startswith("#"):
        s = s[1:]
    elif s.lower().startswith("0x"):
        s = s[2:]
    if len(s) in (3, 4):
        s = "".join(ch * 2 for ch in s[:3])
    if not re.fullmatch(r"[0-9a-fA-F]{6}([0-9a-fA-F]{2})?", s):
        raise ValueError(f"Invalid color '{c}'")
    return int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16)


def rgb_to_hex(rgb: Sequence[Union[int, float]]) -> str:
    r = max(0, min(255, int(round(float(rgb[0])))))
    g = max(0, min(255, int(round(float(rgb[1])))))
    b = max(0, min(255, int(round(float(rgb[2])))))
    return f"#{r:02x}{g:02x}{b:02x}"


def norm_hex(c: Union[str, Sequence[int]]) -> str:
    return rgb_to_hex(parse_hex_color(c))


# ---------------------------------------------------------------------------
# Merged Built-In Catalog: 24 Lospec + Retro Hardware + 4 Signature Reel Palettes
# ---------------------------------------------------------------------------
BUILTIN_PALETTES: List[Dict[str, Any]] = [
    # --- 24 Lospec Palettes from PixelForge ---
    {"id": "1-bit-monitor", "name": "1-Bit Monitor", "group": "lospec", "author": "", "colors": ["222323", "f0f6f0"]},
    {"id": "apollo", "name": "Apollo", "group": "lospec", "author": "AdamCYounis", "colors": ["172038","253a5e","3c5e8b","4f8fba","73bed3","a4dddb","19332d","25562e","468232","75a743","a8ca58","d0da91","4d2b32","7a4841","ad7757","c09473","d7b594","e7d5b3","341c27","602c2c","884b2b","be772b","de9e41","e8c170","241527","411d31","752438","a53030","cf573c","da863e","1e1d39","402751","7a367b","a23e8c","c65197","df84a5","090a14","10141f","151d28","202e37","394a50","577277","819796","a8b5b2","c7cfcc","ebede9"]},
    {"id": "batpalette", "name": "Batpalette", "group": "lospec", "author": "el Rojaz", "colors": ["000000","7f7f7f","ffffff","681e99","3f48cc","88ff82","bfa621","cc3d18"]},
    {"id": "beached-boogaloo", "name": "Beached Boogaloo", "group": "lospec", "author": ".tomais", "colors": ["ff0b20","8f0434","500037","a0ff00","57e71e","0ea717","057833","2cdeef","2483e7","153ab7","0d0a87","ff0b88","a60fff","6409cf","eaef30","ff880b","b75308","802202","000000","231940","514378","ffffff","73a3a7","366770","f7b771","c77650","974c38","873939","601e2c","300c1f"]},
    {"id": "cc-29", "name": "CC-29", "group": "lospec", "author": "Alpha6", "colors": ["f2f0e5","b8b5b9","868188","646365","45444f","3a3858","212123","352b42","43436a","4b80ca","68c2d3","a2dcc7","ede19e","d3a068","b45252","6a536e","4b4158","80493a","a77b5b","e5ceb4","c2d368","8ab060","567b79","4e584a","7b7243","b2b47e","edc8c4","cf8acb","5f556a"]},
    {"id": "cga-16", "name": "CGA 16", "group": "hardware", "author": "IBM", "colors": ["000000","0000aa","00aa00","00aaaa","aa0000","aa00aa","aa5500","aaaaaa","555555","5555ff","55ff55","55ffff","ff5555","ff55ff","ffff55","ffffff"]},
    {"id": "chaotic-neutral", "name": "Chaotic Neutral", "group": "lospec", "author": "Dodecahedron", "colors": ["e1d4cb","c19f90","a56457","6d504d","484044","392b29","31312f","d8eef0","97999f","81a4c0","6a7f92","415973","43425a","45334b","4b1f40","671087","955ab9"]},
    {"id": "endesga-32", "name": "Endesga 32", "group": "lospec", "author": "ENDESGA", "colors": ["be4a2f","d77643","ead4aa","e4a672","b86f50","733e39","3e2731","a22633","e43b44","f77622","feae34","fee761","63c74d","3e8948","265c42","193c3e","124e89","0099db","2ce8f5","ffffff","c0cbdc","8b9bb4","5a6988","3a4466","262b44","181425","ff0044","68386c","b55088","f6757a","e8b796","c28569"]},
    {"id": "fantasy-24", "name": "Fantasy 24", "group": "lospec", "author": "Gabriel C.", "colors": ["1f240a","39571c","a58c27","efac28","efd8a1","ab5c1c","183f39","ef692f","efb775","a56243","773421","724113","2a1d0d","392a1c","684c3c","927e6a","276468","ef3a0c","45230d","3c9f9c","9b1a0a","36170c","550f0a","300f0a"]},
    {"id": "game-boy-dmg", "name": "Game Boy (DMG)", "group": "hardware", "author": "Nintendo", "colors": ["0f380f","306230","8bac0f","9bbc0f"]},
    {"id": "grayscale-4", "name": "Grayscale 4", "group": "hardware", "author": "", "colors": ["000000","555555","aaaaaa","ffffff"]},
    {"id": "hidden-library", "name": "Hidden Library", "group": "lospec", "author": "Pixel Hoo", "colors": ["100b2a","2a213a","314743","65856d","adca9a","ecfeca","582d27","974133","d67654","5d3441","a3685b","ffb379","ffe6a9","ffffff"]},
    {"id": "intacto14", "name": "Intacto14", "group": "lospec", "author": "Anubi", "colors": ["221529","4b5561","879ba3","cbf5ef","62b4de","5660d6","5b29a6","d64562","f2735c","edbb8e","ab6375","522152","37ada2","8cde8c"]},
    {"id": "journey", "name": "Journey 64", "group": "lospec", "author": "PineappleOnPizza", "colors": ["050914","110524","3b063a","691749","9c3247","d46453","f5a15d","ffcf8e","ff7a7d","ff417d","d61a88","94007a","42004e","220029","100726","25082c","3d1132","73263d","bd4035","ed7b39","ffb84a","fff540","c6d831","77b02a","429058","2c645e","153c4a","052137","0e0421","0c0b42","032769","144491","488bd4","78d7ff","b0fff1","faffff","c7d4e1","928fb8","5b537d","392946","24142c","0e0f2c","132243","1a466b","10908e","28c074","3dff6e","f8ffb8","f0c297","cf968c","8f5765","52294b","0f022e","35003b","64004c","9b0e3e","d41e3c","ed4c40","ff9757","d4662f","9c341a","691b22","450c28","2d002e"]},
    {"id": "lospec500", "name": "Lospec500", "group": "lospec", "author": "Lospec", "colors": ["10121c","2c1e31","6b2643","ac2847","ec273f","94493a","de5d3a","e98537","f3a833","4d3533","6e4c30","a26d3f","ce9248","dab163","e8d282","f7f3b7","1e4044","006554","26854c","5ab552","9de64e","008b8b","62a477","a6cb96","d3eed3","3e3b65","3859b3","3388de","36c5f4","6dead6","5e5b8c","8c78a5","b0a7b8","deceed","9a4d76","c878af","cc99ff","fa6e79","ffa2ac","ffd1d5","f6e8e0","ffffff"]},
    {"id": "nyx8", "name": "Nyx8", "group": "lospec", "author": "Javier Guerrero", "colors": ["08141e","0f2a3f","20394f","4e495f","816271","997577","c3a38a","f6d6bd"]},
    {"id": "oil-6", "name": "Oil 6", "group": "lospec", "author": "GrafxKid", "colors": ["fbf5ef","f2d3ab","c69fa5","8b6d9c","494d7e","272744"]},
    {"id": "pico-8", "name": "PICO-8", "group": "hardware", "author": "Lexaloffle", "colors": ["000000","1d2b53","7e2553","008751","ab5236","5f574f","c2c3c7","fff1e8","ff004d","ffa300","ffec27","00e436","29adff","83769c","ff77a8","ffccaa"]},
    {"id": "resurrect-64", "name": "Resurrect 64", "group": "lospec", "author": "Kerrie Lake", "colors": ["2e222f","3e3546","625565","966c6c","ab947a","694f62","7f708a","9babb2","c7dcd0","ffffff","6e2727","b33831","ea4f36","f57d4a","ae2334","e83b3b","fb6b1d","f79617","f9c22b","7a3045","9e4539","cd683d","e6904e","fbb954","4c3e24","676633","a2a947","d5e04b","fbff86","165a4c","239063","1ebc73","91db69","cddf6c","313638","374e4a","547e64","92a984","b2ba90","0b5e65","0b8a8f","0eaf9b","30e1b9","8ff8e2","323353","484a77","4d65b4","4d9be6","8fd3ff","45293f","6b3e75","905ea9","a884f3","eaaded","753c54","a24b6f","cf657f","ed8099","831c5d","c32454","f04f78","f68181","fca790","fdcbb0"]},
    {"id": "slso8", "name": "SLSO8", "group": "lospec", "author": "Luis Miguel Maldonado", "colors": ["0d2b45","203c56","544e68","8d697a","d08159","ffaa5e","ffd4a3","ffecd6"]},
    {"id": "sweet-canyon-extended-64", "name": "Sweet Canyon Extended 64", "group": "lospec", "author": "Mr Slime", "colors": ["0f0e11","2d2c33","40404a","51545c","6b7179","7c8389","a8b2b6","d5d5d5","eeebe0","f1dbb1","eec99f","e1a17e","cc9562","ab7b49","9a643a","86482f","783a29","6a3328","541d29","42192c","512240","782349","8b2e5d","a93e89","d062c8","ec94ea","f2bdfc","eaebff","a2fafa","64e7e7","54cfd8","2fb6c3","2c89af","25739d","2a5684","214574","1f2966","101445","3c0d3b","66164c","901f3d","bb3030","dc473c","ec6a45","fb9b41","f0c04c","f4d66e","fffb76","ccf17a","97d948","6fba3b","229443","1d7e45","116548","0c4f3f","0a3639","251746","48246d","69189c","9f20c0","e527d2","ff51cf","ff7ada","ff9edb"]},
    {"id": "sweetie-16", "name": "Sweetie 16", "group": "lospec", "author": "GrafxKid", "colors": ["1a1c2c","5d275d","b13e53","ef7d57","ffcd75","a7f070","38b764","257179","29366f","3b5dc9","41a6f6","73eff7","f4f4f4","94b0c2","566c86","333c57"]},
    {"id": "toxic-haze", "name": "Toxic Haze", "group": "lospec", "author": "sillyTheJester", "colors": ["e5ff00","b8d14a","9ab06e","708763","4c5c52","393e40","242424"]},
    {"id": "vinik24", "name": "Vinik24", "group": "lospec", "author": "Vinik", "colors": ["000000","6f6776","9a9a97","c5ccb8","8b5580","c38890","a593a5","666092","9a4f50","c28d75","7ca1c0","416aa3","8d6268","be955c","68aca9","387080","6e6962","93a167","6eaa78","557064","9d9f7f","7e9e99","5d6872","433455"]},

    # --- Classic Retro Hardware & CRT Phosphor Palettes from PixelForge ---
    {"id": "commodore-64", "name": "Commodore 64 (VIC-II)", "group": "hardware", "author": "Commodore", "colors": ["000000","ffffff","a14d43","6ac1c8","a257a5","5cad5f","4f449c","cbd689","a3683a","6e540b","cc7f76","636363","8b8b8b","9be39d","8a7fcd","afafaf"]},
    {"id": "zx-spectrum", "name": "ZX Spectrum", "group": "hardware", "author": "Sinclair", "colors": ["000000","0027fb","ff3016","ff3ffc","00f92c","00fcfe","fffd33","ffffff"]},
    {"id": "apple-ii-lo", "name": "Apple II Lo-Res", "group": "hardware", "author": "Apple", "colors": ["000000","853b51","504789","ea5df0","006852","929292","00a8f1","caC3f8","515c0f","eb7f23","f6b9ca","00ca29","cbd39b","9adccb","ffffff"]},
    {"id": "apple-ii-hi", "name": "Apple II Hi-Res", "group": "hardware", "author": "Apple", "colors": ["000000","ff00ff","00ff00","ffffff","00afff","ff5000"]},
    {"id": "msx", "name": "MSX TMS9918", "group": "hardware", "author": "ASCII/Microsoft", "colors": ["000000","3eb849","74d07d","5955e0","8076f1","b95e51","65dbef","db6559","ff897d","ccc35e","ded087","3aa241","b766b5","cccccc","ffffff"]},
    {"id": "teletext", "name": "Teletext / BBC Micro", "group": "hardware", "author": "BBC", "colors": ["000000","ff0000","008000","ffff00","0000ff","ff00ff","00ffff","ffffff"]},
    {"id": "cga-mode4-pal1", "name": "CGA Mode 4 Cyan/Magenta", "group": "hardware", "author": "IBM", "colors": ["000000","ffffff","00ffff","ff00ff"]},
    {"id": "cga-mode5-pal1", "name": "CGA Mode 5 Cyan/Red", "group": "hardware", "author": "IBM", "colors": ["000000","55ffff","ff5555","ffffff"]},
    {"id": "windows-16", "name": "Windows 3.1 VGA 16", "group": "hardware", "author": "Microsoft", "colors": ["000000","800000","008000","808000","000080","800080","008080","c0c0c0","808080","ff0000","00ff00","ffff00","0000ff","ff00ff","00ffff","ffffff"]},
    {"id": "windows-paint", "name": "MS Paint Classic 24", "group": "hardware", "author": "Microsoft", "colors": ["000000","ffffff","7b7b7b","bdbdbd","7b0c02","ff2500","7b7b01","fffb01","007b02","02f901","007b7a","02fdfe","01137a","0432ff","7b197a","ff40fe","7a3901","ff7a39","7b7b38","fffc7a","023939","03fa7b","007bff","ff2c7b"]},
    {"id": "virtualboy", "name": "Nintendo Virtual Boy", "group": "hardware", "author": "Nintendo", "colors": ["000000","550000","a40000","ef0000"]},
    {"id": "obradinn-ibm", "name": "Obra Dinn (IBM 8503)", "group": "hardware", "author": "Lucas Pope", "colors": ["2e3037","ebe5ce"]},
    {"id": "obradinn-mac", "name": "Obra Dinn (Macintosh)", "group": "hardware", "author": "Lucas Pope", "colors": ["333319","e5ffff"]},
    {"id": "phosphor-amber", "name": "CRT Phosphor Amber", "group": "hardware", "author": "", "colors": ["282828","ffb000"]},
    {"id": "phosphor-green", "name": "CRT Phosphor P1 Green", "group": "hardware", "author": "", "colors": ["282828","33ff00"]},

    # --- 4 Signature PixelForge Reel / Stylization Palettes ---
    {"id": "kurzgesagt-24", "name": "Kurzgesagt Cosmic 24", "group": "reel", "author": "PixelForge", "colors": ["050516","0d0d38","18165c","291d89","4527b7","7028e4","a629f5","e629d6","ff2a85","ff5c33","ff9e1b","ffe135","ffffff","b5fff6","3dffdf","00d2ff","0084ff","0044cc","163832","0d8a5e","1ee881","7dff4d","c8ff80","3c1642"]},
    {"id": "pc98-cyber-16", "name": "NEC PC-9801 Cyber 16", "group": "reel", "author": "PixelForge", "colors": ["080614","161233","291f59","462e8c","6b3ec2","9e52e8","d674ff","ff4da6","ff85c2","003859","006e99","00b8d9","4df7ff","e0ffff","ffd166","fff8eb"]},
    {"id": "aloboi-dream-16", "name": "Aloboi Dreamcore 16", "group": "reel", "author": "PixelForge", "colors": ["12091c","241338","3d1e59","612c7d","8f3e9e","c457b5","f279c4","ffa6c9","ff8c69","ffb563","ffd97d","fff3b0","4a6fa5","6fa3d2","a3d5ff","eaf6ff"]},
    {"id": "oscilloscope-p31", "name": "Oscilloscope Tektronix P31", "group": "reel", "author": "PixelForge", "colors": ["030a06","071c10","0c3820","136339","1ba35c","28e07f","5effa8","c8ffe0"]},
]

_PALETTE_INDEX: Dict[str, Dict[str, Any]] = {}
for _p in BUILTIN_PALETTES:
    _PALETTE_INDEX[_p["id"].lower()] = _p
    _PALETTE_INDEX[_p["name"].lower()] = _p
    _PALETTE_INDEX[_p["id"].lower().replace("-", "_")] = _p


def get_builtin_palette(id_or_name: str) -> Optional[Dict[str, Any]]:
    """Case-insensitive lookup of any built-in Lospec, hardware, or Reel palette."""
    if not id_or_name:
        return None
    k = str(id_or_name).strip().lower()
    return _PALETTE_INDEX.get(k) or _PALETTE_INDEX.get(k.replace("_", "-"))


def list_builtin_palettes() -> List[Dict[str, Any]]:
    return [
        {
            "id": p["id"],
            "name": p["name"],
            "group": p["group"],
            "author": p["author"],
            "count": len(p["colors"]),
            "colors": ["#" + c.lstrip("#") for c in p["colors"]],
        }
        for p in BUILTIN_PALETTES
    ]


# ---------------------------------------------------------------------------
# Backward-Compatible PixelForge `BasePalette` & `Pal` Enum
# ---------------------------------------------------------------------------
class BasePalette(Enum):
    def __len__(self) -> int:
        return len(self.value)

    def __iter__(self) -> Iterator[np.ndarray]:
        self._iter_n = 0
        return self

    def __next__(self):
        if self._iter_n < len(self):
            res = self.value[self._iter_n]
            self._iter_n += 1
            return res
        raise StopIteration

    @classmethod
    def list(cls) -> List[str]:
        return [x.name for x in cls]

    @staticmethod
    def from_hex(hex_list: Sequence[str]) -> np.ndarray:
        return np.array([[parse_hex_color(h)] for h in hex_list], dtype=np.float64) / 255.0

    @staticmethod
    def from_rgb(rgb_list: Sequence[Sequence[int]]) -> np.ndarray:
        return np.array([[rgb[:3]] for rgb in rgb_list], dtype=np.float64) / 255.0


def _hexes_to_pal_val(hexes: Sequence[str]) -> List[List[List[float]]]:
    return [[[c / 255.0 for c in parse_hex_color(h)]] for h in hexes]


class Pal(BasePalette):
    """Unified Enum exposing both classic PixelForge names and top Lospec/Reel palettes."""

    ENDESGA_32 = _hexes_to_pal_val(get_builtin_palette("endesga-32")["colors"])
    APOLLO = _hexes_to_pal_val(get_builtin_palette("apollo")["colors"])
    RESURRECT_64 = _hexes_to_pal_val(get_builtin_palette("resurrect-64")["colors"])
    SWEETIE_16 = _hexes_to_pal_val(get_builtin_palette("sweetie-16")["colors"])
    PICO_8 = _hexes_to_pal_val(get_builtin_palette("pico-8")["colors"])
    GAMEBOY_ORIGINAL = _hexes_to_pal_val(get_builtin_palette("game-boy-dmg")["colors"])
    GAMEBOY_POCKET = _hexes_to_pal_val(get_builtin_palette("grayscale-4")["colors"])
    GAMEBOY_VIRTUALBOY = _hexes_to_pal_val(get_builtin_palette("virtualboy")["colors"])
    COMMODORE_64 = _hexes_to_pal_val(get_builtin_palette("commodore-64")["colors"])
    ZX_SPECTRUM = _hexes_to_pal_val(get_builtin_palette("zx-spectrum")["colors"])
    APPLE_II_LO = _hexes_to_pal_val(get_builtin_palette("apple-ii-lo")["colors"])
    APPLE_II_HI = _hexes_to_pal_val(get_builtin_palette("apple-ii-hi")["colors"])
    MSX = _hexes_to_pal_val(get_builtin_palette("msx")["colors"])
    TELETEXT = _hexes_to_pal_val(get_builtin_palette("teletext")["colors"])
    BBC_MICRO = TELETEXT
    CGA_16 = _hexes_to_pal_val(get_builtin_palette("cga-16")["colors"])
    CGA_MODE4_PAL1 = _hexes_to_pal_val(get_builtin_palette("cga-mode4-pal1")["colors"])
    CGA_MODE5_PAL1 = _hexes_to_pal_val(get_builtin_palette("cga-mode5-pal1")["colors"])
    MICROSOFT_WINDOWS_16 = _hexes_to_pal_val(get_builtin_palette("windows-16")["colors"])
    MICROSOFT_WINDOWS_PAINT = _hexes_to_pal_val(get_builtin_palette("windows-paint")["colors"])
    MONO_OBRADINN_IBM = _hexes_to_pal_val(get_builtin_palette("obradinn-ibm")["colors"])
    MONO_OBRADINN_MAC = _hexes_to_pal_val(get_builtin_palette("obradinn-mac")["colors"])
    MONO_BW = _hexes_to_pal_val(get_builtin_palette("1-bit-monitor")["colors"])
    MONO_PHOSPHOR_AMBER = _hexes_to_pal_val(get_builtin_palette("phosphor-amber")["colors"])
    MONO_PHOSPHOR_GREEN1 = _hexes_to_pal_val(get_builtin_palette("phosphor-green")["colors"])
    KURZGESAGT_24 = _hexes_to_pal_val(get_builtin_palette("kurzgesagt-24")["colors"])
    PC98_CYBER_16 = _hexes_to_pal_val(get_builtin_palette("pc98-cyber-16")["colors"])
    ALOBOI_DREAM_16 = _hexes_to_pal_val(get_builtin_palette("aloboi-dream-16")["colors"])
    OSCILLOSCOPE_P31 = _hexes_to_pal_val(get_builtin_palette("oscilloscope-p31")["colors"])


# ---------------------------------------------------------------------------
# Universal Palette File Format Parsers & Exporters (.gpl, .pal, .hex, .txt, .json, Lospec)
# ---------------------------------------------------------------------------
def parse_gpl(text: str) -> Dict[str, Any]:
    lines = text.splitlines()
    if not lines or not lines[0].strip().lower().startswith("gimp palette"):
        raise ValueError("Not a GIMP palette (missing 'GIMP Palette' header)")
    name = ""
    colors: List[str] = []
    for raw in lines[1:]:
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        m_name = re.match(r"^Name:\s*(.*)$", line, re.IGNORECASE)
        if m_name:
            name = m_name.group(1).strip()
            continue
        if re.match(r"^Columns:", line, re.IGNORECASE):
            continue
        m_rgb = re.match(r"^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})", line)
        if m_rgb:
            colors.append(norm_hex([int(m_rgb.group(1)), int(m_rgb.group(2)), int(m_rgb.group(3))]))
    return {"name": name, "colors": list(dict.fromkeys(colors))[:256]}


def parse_jasc_pal(text: str) -> Dict[str, Any]:
    lines = [l.strip() for l in text.splitlines()]
    if not lines or lines[0] != "JASC-PAL":
        raise ValueError("Not a JASC-PAL file")
    n = int(lines[2]) if len(lines) > 2 and lines[2].isdigit() else 256
    colors: List[str] = []
    for line in lines[3 : 3 + n]:
        m = re.match(r"^(\d+)\s+(\d+)\s+(\d+)", line)
        if m:
            colors.append(norm_hex([int(m.group(1)), int(m.group(2)), int(m.group(3))]))
    return {"name": "", "colors": list(dict.fromkeys(colors))[:256]}


def parse_hex_list(text: str) -> Dict[str, Any]:
    colors: List[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith(";") or line.startswith("//"):
            continue
        m = re.match(r"^#?([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b", line)
        if m:
            tok = m.group(1)
            if len(tok) == 8:
                tok = tok[2:]  # Paint.NET AARRGGBB -> RRGGBB
            colors.append(norm_hex(tok))
    return {"name": "", "colors": list(dict.fromkeys(colors))[:256]}


def parse_palette_json(text_or_obj: Union[str, Any]) -> Dict[str, Any]:
    obj = json.loads(text_or_obj) if isinstance(text_or_obj, str) else text_or_obj
    items = obj if isinstance(obj, list) else (obj.get("colors") or obj.get("palette") or [])
    colors = []
    for item in items:
        c = (item.get("hex") or item.get("color")) if isinstance(item, dict) else item
        if c:
            colors.append(norm_hex(c))
    name = ("" if isinstance(obj, list) else obj.get("name", "")) or ""
    return {"name": name, "colors": list(dict.fromkeys(colors))[:256]}


def parse_palette_text(text: str, filename: str = "") -> Dict[str, Any]:
    """Auto-sniffs and parses .gpl, .pal, .hex, .txt, .json, or loose hex tokens."""
    ext = Path(filename).suffix.lower().lstrip(".") if filename else ""
    trimmed = text.lstrip("\ufeff").strip()
    if ext == "gpl" or trimmed.lower().startswith("gimp palette"):
        out = parse_gpl(trimmed)
    elif ext == "pal" or trimmed.startswith("JASC-PAL"):
        out = parse_jasc_pal(trimmed)
    elif ext == "json" or trimmed.startswith("{") or trimmed.startswith("["):
        out = parse_palette_json(trimmed)
    else:
        out = parse_hex_list(trimmed)
        if not out["colors"]:
            tokens = re.findall(r"#?\b([0-9a-fA-F]{6})\b", trimmed)
            out = {"name": "", "colors": list(dict.fromkeys(norm_hex(t) for t in tokens))[:256]}
    if not out["name"] and filename:
        out["name"] = Path(filename).stem.replace("-", " ").replace("_", " ")
    if not out["colors"]:
        raise ValueError("No valid colors found in palette input.")
    return out


_LOSPEC_CACHE: Dict[str, Dict[str, Any]] = {}


def fetch_lospec_palette(slug_or_url: str, timeout: float = 8.0) -> Dict[str, Any]:
    """Fetches a palette by slug or URL from Lospec (`https://lospec.com/palette-list/<slug>.json`)."""
    s = str(slug_or_url).strip()
    if s.lower().startswith("lospec:"):
        s = s[7:].strip()
    m = re.search(r"palette-list/([a-z0-9-]+)", s, re.IGNORECASE)
    slug = (m.group(1) if m else s).lower()
    slug = re.sub(r"\.(json|hex|gpl)$", "", slug)
    if slug in _LOSPEC_CACHE:
        return _LOSPEC_CACHE[slug]
    builtin = get_builtin_palette(slug)
    if builtin is not None:
        res = {
            "name": builtin["name"],
            "author": builtin["author"],
            "colors": [norm_hex(c) for c in builtin["colors"]],
            "slug": slug,
        }
        _LOSPEC_CACHE[slug] = res
        return res
    if not re.fullmatch(r"[a-z0-9-]+", slug):
        raise ValueError(f"Invalid Lospec palette slug: '{slug_or_url}'")
    url = f"https://lospec.com/palette-list/{slug}.json"
    req = urllib.request.Request(url, headers={"User-Agent": "PixelForge/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    parsed = parse_palette_json(data)
    res = {"name": data.get("name") or slug, "author": data.get("author", ""), "colors": parsed["colors"], "slug": slug}
    _LOSPEC_CACHE[slug] = res
    return res


def export_palette_gpl(name: str, colors: Sequence[Union[str, Sequence[int]]]) -> str:
    rows = []
    for c in colors:
        r, g, b = parse_hex_color(c)
        rows.append(f"{r:3d} {g:3d} {b:3d}\t{r:02x}{g:02x}{b:02x}")
    return f"GIMP Palette\nName: {name or 'PixelForge Palette'}\nColumns: 8\n#\n" + "\n".join(rows) + "\n"


def export_palette_hex(colors: Sequence[Union[str, Sequence[int]]]) -> str:
    return "\n".join(norm_hex(c)[1:] for c in colors) + "\n"


def export_palette_json(name: str, colors: Sequence[Union[str, Sequence[int]]]) -> str:
    return json.dumps({"name": name or "PixelForge Palette", "colors": [norm_hex(c)[1:] for c in colors]}, indent=2)


# ---------------------------------------------------------------------------
# 3 Palette Discovery Engines (OKLab Median-Cut, BGM, NEW Hybrid OKLab-BGM)
# ---------------------------------------------------------------------------
def _sample_opaque_rgb01(image_u8: np.ndarray, max_samples: int = 32768, alpha_threshold: float = 0.5) -> np.ndarray:
    if image_u8.ndim == 3 and image_u8.shape[2] == 4:
        mask = image_u8[:, :, 3] >= int(alpha_threshold * 255)
        pts = image_u8[:, :, :3][mask]
    else:
        pts = image_u8[:, :, :3].reshape(-1, 3)
    if len(pts) == 0:
        return np.array([[0.0, 0.0, 0.0], [1.0, 1.0, 1.0]], dtype=np.float64)
    step = max(1, len(pts) // max_samples)
    return pts[::step].astype(np.float64) / 255.0


def extract_oklab_median_cut(
    image_u8: np.ndarray,
    count: int = 16,
    chroma_boost: float = 1.25,
    kmeans_iters: int = 8,
) -> np.ndarray:
    """Deterministic population- & chroma-weighted Median-Cut + K-Means in OKLab space.

    Returns uint8 RGB array of shape (K, 3) sorted from dark to light.
    Upgrades PixelForge's sRGB median-cut to perceptual OKLab with chroma salience so small
    vivid highlights/accents aren't swallowed by large neutral backgrounds.
    """
    count = max(2, min(256, int(count)))
    pts_rgb = _sample_opaque_rgb01(image_u8)
    pts_lab = rgb2oklab(pts_rgb)

    # Box list: indices into pts_lab
    boxes: List[np.ndarray] = [np.arange(len(pts_lab), dtype=np.int32)]
    axis_weights = np.array([1.0, 1.45 * chroma_boost, 1.45 * chroma_boost], dtype=np.float64)

    while len(boxes) < count:
        best_bi = -1
        best_score = -1.0
        best_axis = 0
        for bi, idx in enumerate(boxes):
            if len(idx) < 2:
                continue
            sub = pts_lab[idx]
            ranges = (np.max(sub, axis=0) - np.min(sub, axis=0)) * axis_weights
            # Population-root weighting balances large flat regions AND vivid small accent clusters
            pop_factor = len(idx) ** 0.42
            for ax in range(3):
                score = float(ranges[ax]) * pop_factor
                if score > best_score:
                    best_score = score
                    best_bi = bi
                    best_axis = ax
        if best_bi < 0 or best_score <= 1e-7:
            break
        idx = boxes[best_bi]
        order = np.argsort(pts_lab[idx, best_axis], kind="mergesort")
        sorted_idx = idx[order]
        mid = len(sorted_idx) // 2
        boxes.pop(best_bi)
        boxes.insert(best_bi, sorted_idx[mid:])
        boxes.insert(best_bi, sorted_idx[:mid])

    centers = np.array([np.mean(pts_lab[b], axis=0) for b in boxes if len(b) > 0], dtype=np.float64)

    # Deterministic OKLab K-Means refinement
    for _ in range(kmeans_iters):
        dl = pts_lab[:, None, 0] - centers[None, :, 0]
        da = (pts_lab[:, None, 1] - centers[None, :, 1]) * 1.2
        db = (pts_lab[:, None, 2] - centers[None, :, 2]) * 1.2
        labels = np.argmin(dl * dl + da * da + db * db, axis=1)
        for c_i in range(len(centers)):
            members = pts_lab[labels == c_i]
            if len(members) > 0:
                centers[c_i] = np.mean(members, axis=0)

    rgb01 = oklab2rgb(centers)
    if chroma_boost > 1.0:
        hsv = rgb2hsv_fast(rgb01.reshape(-1, 1, 3))
        hsv[:, :, 1] = np.clip(hsv[:, :, 1] * min(1.18, 0.9 + 0.2 * chroma_boost), 0.0, 1.0)
        rgb01 = hsv2rgb_fast(hsv).reshape(-1, 3)

    u8 = np.clip(np.round(rgb01 * 255.0), 0, 255).astype(np.uint8)
    # Deduplicate while sorting dark -> light by perceptual L
    seen = set()
    unique_rows = []
    order = np.argsort(centers[:, 0])
    for i in order:
        key = (int(u8[i, 0]), int(u8[i, 1]), int(u8[i, 2]))
        if key not in seen:
            seen.add(key)
            unique_rows.append(u8[i])
    if not unique_rows:
        return np.array([[0, 0, 0], [255, 255, 255]], dtype=np.uint8)
    return np.array(unique_rows, dtype=np.uint8)


class HybridOKLabBGM(BayesianGaussianMixture):
    """Bayesian Gaussian Mixture seeded deterministically by OKLab Median-Cut instead of random K-Means."""

    def __init__(self, n_colors: int, seed_centers_lab: Optional[np.ndarray] = None) -> None:
        self.n_colors = n_colors
        self.seed_centers_lab = seed_centers_lab
        super().__init__(
            n_components=n_colors,
            max_iter=96,
            covariance_type="tied",
            weight_concentration_prior_type="dirichlet_distribution",
            weight_concentration_prior=1.0 / max(1, n_colors),
            mean_precision_prior=1.0 / 256.0,
            warm_start=False,
            random_state=1234567,
        )

    def _initialize_parameters(self, X: np.ndarray, random_state: Any, xp: Any = None) -> None:
        n_samples = X.shape[0]
        resp = np.zeros((n_samples, self.n_components), dtype=np.float64)
        if self.seed_centers_lab is not None and len(self.seed_centers_lab) == self.n_components:
            dl = X[:, None, 0] - self.seed_centers_lab[None, :, 0]
            da = (X[:, None, 1] - self.seed_centers_lab[None, :, 1]) * 1.25
            db = (X[:, None, 2] - self.seed_centers_lab[None, :, 2]) * 1.25
            labels = np.argmin(dl * dl + da * da + db * db, axis=1)
        else:
            # Deterministic quantile fallback
            order = np.argsort(X[:, 0])
            labels = np.minimum(self.n_components - 1, (np.argsort(order) * self.n_components) // max(1, n_samples))
        resp[np.arange(n_samples), labels] = 1.0
        self._initialize(X, resp)


def extract_hybrid_bgm_oklab(
    image_u8: np.ndarray,
    count: int = 16,
    chroma_boost: float = 1.12,
) -> Tuple[np.ndarray, HybridOKLabBGM]:
    """NEW PixelForge Hybrid Palette Discovery:
    1. Runs deterministic chroma-salient OKLab Median-Cut to capture both broad tones & small bright accents.
    2. Fits a tied-covariance Bayesian Gaussian Mixture in OKLab space initialized from those exact centroids,
       yielding zero random-seed flicker, covariance-aware soft posteriors, and vivid perceptual colors.
    """
    count = max(2, min(128, int(count)))
    h, w = image_u8.shape[:2]
    small_rgb = resize_float(image_u8[:, :, :3], min(h, 192), min(w, 192), anti_aliasing=True)
    small_u8 = np.clip(np.round(small_rgb * 255.0), 0, 255).astype(np.uint8)

    seed_u8 = extract_oklab_median_cut(small_u8, count=count, chroma_boost=chroma_boost, kmeans_iters=4)
    eff_k = len(seed_u8)
    seed_lab = rgb2oklab(seed_u8.astype(np.float64) / 255.0)

    X_lab = rgb2oklab(small_rgb.reshape(-1, 3))
    bgm = HybridOKLabBGM(n_colors=eff_k, seed_centers_lab=seed_lab)
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=ConvergenceWarning)
        bgm.fit(X_lab)

    # Prune dead Dirichlet components with near-zero weight (< 0.15 / K)
    active = bgm.weights_ >= (0.08 / max(1, eff_k))
    means_lab = bgm.means_[active] if np.any(active) else bgm.means_
    rgb01 = oklab2rgb(means_lab)
    if chroma_boost > 1.0:
        hsv = rgb2hsv_fast(rgb01.reshape(-1, 1, 3))
        hsv[:, :, 1] = np.clip(hsv[:, :, 1] * chroma_boost, 0.0, 1.0)
        rgb01 = hsv2rgb_fast(hsv).reshape(-1, 3)

    pal_u8 = np.clip(np.round(rgb01 * 255.0), 0, 255).astype(np.uint8)
    # Sort dark -> light
    l_order = np.argsort(means_lab[:, 0])
    pal_u8 = pal_u8[l_order]
    return pal_u8, bgm


def resolve_palette(
    palette_spec: Union[int, str, Sequence[Any], BasePalette, np.ndarray, None],
    image_u8: Optional[np.ndarray] = None,
    extract_mode: str = "hybrid_bgm_oklab",
) -> Tuple[Optional[np.ndarray], Optional[HybridOKLabBGM], str]:
    """Resolves any palette specification into (uint8 RGB [K, 3], optional fitted BGM, palette_name).

    `palette_spec` accepts:
        - `None` or `'none'`              -> No quantization (true color)
        - `int` (e.g. `16`)               -> Extract `K` colors from `image_u8` via `extract_mode`
        - `BasePalette` / `Pal.PICO_8`    -> Built-in Enum palette
        - `str`:
            * Built-in id/name (`'endesga-32'`, `'pico-8'`, `'kurzgesagt-24'`, `'commodore-64'`)
            * `'lospec:<slug>'` or Lospec URL -> Live fetches from Lospec
            * Existing file path (`.gpl`, `.pal`, `.hex`, `.txt`, `.json`)
            * Raw multi-line palette text or comma-separated `#rrggbb` list
        - `Sequence` / `np.ndarray`       -> List of `#hex` strings or `[R, G, B]` tuples
    """
    if palette_spec is None:
        return None, None, "none"

    if isinstance(palette_spec, BasePalette):
        arr = np.array([c[0] for c in palette_spec.value], dtype=np.float64)
        u8 = np.clip(np.round(arr * 255.0), 0, 255).astype(np.uint8)
        return u8, None, palette_spec.name

    if isinstance(palette_spec, (int, np.integer)):
        if image_u8 is None:
            raise ValueError("image_u8 is required when extracting an N-color palette.")
        k = max(2, min(256, int(palette_spec)))
        if extract_mode == "oklab_median_cut":
            return extract_oklab_median_cut(image_u8, count=k), None, f"oklab_median_cut({k})"
        pal_u8, bgm = extract_hybrid_bgm_oklab(image_u8, count=k)
        return pal_u8, bgm, f"hybrid_bgm_oklab({len(pal_u8)})"

    if isinstance(palette_spec, str):
        s = palette_spec.strip()
        if not s or s.lower() == "none":
            return None, None, "none"
        if s.isdigit():
            return resolve_palette(int(s), image_u8=image_u8, extract_mode=extract_mode)
        builtin = get_builtin_palette(s)
        if builtin is not None:
            u8 = np.array([parse_hex_color(c) for c in builtin["colors"]], dtype=np.uint8)
            return u8, None, builtin["id"]
        if hasattr(Pal, s.upper()):
            return resolve_palette(getattr(Pal, s.upper()), image_u8=image_u8)
        if s.lower().startswith("lospec:") or "lospec.com/palette-list/" in s.lower():
            lp = fetch_lospec_palette(s)
            u8 = np.array([parse_hex_color(c) for c in lp["colors"]], dtype=np.uint8)
            return u8, None, f"lospec:{lp['slug']}"
        p = Path(s)
        if len(s) < 260 and p.exists() and p.is_file():
            parsed = parse_palette_text(p.read_text(encoding="utf-8", errors="replace"), filename=p.name)
            u8 = np.array([parse_hex_color(c) for c in parsed["colors"]], dtype=np.uint8)
            return u8, None, parsed["name"] or p.stem
        # Comma-separated or raw palette text
        parsed = parse_palette_text(s.replace(",", "\n"))
        u8 = np.array([parse_hex_color(c) for c in parsed["colors"]], dtype=np.uint8)
        return u8, None, parsed["name"] or "custom"

    if isinstance(palette_spec, np.ndarray):
        arr = np.asarray(palette_spec)
        if arr.dtype.kind == "f" and np.max(arr) <= 1.0:
            u8 = np.clip(np.round(arr.reshape(-1, 3) * 255.0), 0, 255).astype(np.uint8)
        else:
            u8 = np.clip(arr.reshape(-1, 3), 0, 255).astype(np.uint8)
        return u8, None, f"custom({len(u8)})"

    if isinstance(palette_spec, (list, tuple)):
        u8 = np.array([parse_hex_color(c) for c in palette_spec], dtype=np.uint8)
        return u8, None, f"custom({len(u8)})"

    raise ValueError(f"Unsupported palette specification: {type(palette_spec)}")
