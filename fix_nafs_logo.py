import os
import re

def fix_nafs():
    path = r"G:\New folder\control\control\omr_engine\generator_nafs.py"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update global logo definitions if they exist
    content = re.sub(r'LOGO_MIN\s*=\s*r?".*?"', 'LOGO_MIN = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "شعار الوزارة.png")', content)
    content = re.sub(r'LOGO_SCH\s*=\s*r?".*?"', 'LOGO_SCH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "شعار المدرسة.jpeg")', content)

    # 2. Update Image.open paths inside draw_header for NAFS
    # Replace r_path construction
    content = re.sub(r'r_path\s*=\s*".*?"\s*\+\s*".*?"\s*\+\s*".*?"', 'r_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "شعار المدرسة.jpeg")', content)
    # Replace l_path construction
    content = re.sub(r'l_path\s*=\s*".*?"\s*\+\s*".*?"\s*\+\s*".*?"', 'l_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "شعار المدرسة.jpeg")', content)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

fix_nafs()
