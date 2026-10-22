import math
from PIL import Image, ImageDraw, ImageFont

def create_app_icon(size, filename):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded rectangle background with indigo/sky gradient
    corner_radius = int(size * 0.22)
    
    # Draw gradient rounded rect
    for y in range(size):
        ratio = y / size
        # From Indigo #4f46e5 (79, 70, 229) to Sky #0ea5e9 (14, 165, 233)
        r = int(79 * (1 - ratio) + 14 * ratio)
        g = int(70 * (1 - ratio) + 165 * ratio)
        b = int(229 * (1 - ratio) + 233 * ratio)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    # Mask to rounded rect
    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([(0, 0), (size, size)], radius=corner_radius, fill=255)
    img.putalpha(mask)

    draw = ImageDraw.Draw(img)

    # Draw a stylized brief-case / document & checkmark icon
    center_x = size // 2
    center_y = size // 2

    # Draw inner badge / shield
    shield_w = int(size * 0.55)
    shield_h = int(size * 0.6)
    sx0 = center_x - shield_w // 2
    sy0 = center_y - shield_h // 2
    sx1 = center_x + shield_w // 2
    sy1 = center_y + shield_h // 2

    # Shield / card background
    draw.rounded_rectangle([(sx0, sy0), (sx1, sy1)], radius=int(size * 0.1), fill=(15, 23, 42, 220), outline=(255, 255, 255, 200), width=max(2, size // 60))

    # Draw bold Checkmark in vibrant emerald
    check_color = (52, 211, 153, 255) # emerald-400
    line_w = max(4, size // 18)

    p1 = (center_x - int(shield_w * 0.28), center_y + int(shield_h * 0.02))
    p2 = (center_x - int(shield_w * 0.05), center_y + int(shield_h * 0.24))
    p3 = (center_x + int(shield_w * 0.30), center_y - int(shield_h * 0.20))

    draw.line([p1, p2], fill=check_color, width=line_w)
    draw.line([p2, p3], fill=check_color, width=line_w)
    
    # Smooth line caps with circles
    r_cap = line_w // 2
    for p in [p1, p2, p3]:
        draw.ellipse([(p[0]-r_cap, p[1]-r_cap), (p[0]+r_cap, p[1]+r_cap)], fill=check_color)

    # Small star badge at top right
    star_x = sx1 - int(size * 0.08)
    star_y = sy0 + int(size * 0.08)
    star_r = int(size * 0.07)
    draw.ellipse([(star_x - star_r, star_y - star_r), (star_x + star_r, star_y + star_r)], fill=(251, 191, 36, 255))

    img.save(filename, "PNG")
    print(f"Created {filename}")

if __name__ == '__main__':
    base_dir = r"C:\Users\student\Desktop\仮\IT企業向けの自己prや志望動機\現在の就職活動状況"
    create_app_icon(192, f"{base_dir}\\icon-192.png")
    create_app_icon(512, f"{base_dir}\\icon-512.png")
