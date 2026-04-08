import os

def update_logo_paths(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    new_lines = []
    for line in lines:
        if 'LOGO_MIN =' in line or 'LOGO_SCH =' in line:
            # Skip these lines
            continue
        if 'draw_header' in line or 'draw_elite_header' in line:
            # Add BASE_DIR/LOGO paths before the function
            new_lines.append("\n# Correct paths for logos (drive-independent)\n")
            new_lines.append("BASE_DIR = os.path.dirname(os.path.abspath(__file__))\n")
            new_lines.append("LOGO_MIN = os.path.join(os.path.dirname(BASE_DIR), 'public', 'شعار الوزارة.png')\n")
            new_lines.append("LOGO_SCH = os.path.join(os.path.dirname(BASE_DIR), 'public', 'شعار المدرسة.jpeg')\n\n")
        
        # Replace the hardcoded path usages
        if 'E:\\\\' in line or 'E:\\' in line:
            if 'Image.open' in line:
                if 'وزارة' in line or 'LOGO_MIN' in line:
                    line = "        llogo = Image.open(LOGO_MIN).convert(\"RGBA\")\n"
                elif 'مدرسة' in line or 'LOGO_SCH' in line or 'r_path' in line or 'l_path' in line or 'rpath' in line or 'lpath' in line:
                    line = line.replace('Image.open(r_path)', 'Image.open(LOGO_SCH)')
                    line = line.replace('Image.open(l_path)', 'Image.open(LOGO_SCH)')
                    line = line.replace('Image.open(rpath)', 'Image.open(LOGO_SCH)')
                    line = line.replace('Image.open(lpath)', 'Image.open(LOGO_SCH)')
            # Still need to handle path building lines
            if 'r_path =' in line or 'l_path =' in line or 'rpath =' in line or 'lpath =' in line or 'min_path =' in line:
                continue # Skip path construction lines entirely
            
        new_lines.append(line)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

# Run for all generators
update_logo_paths('g:/New folder/control/control/omr_engine/generator_nafs.py')
update_logo_paths('g:/New folder/control/control/omr_engine/generator.py')
update_logo_paths('g:/New folder/control/control/omr_engine/generator_elite.py')
