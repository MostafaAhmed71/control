import sys, os
import cv2
sys.path.insert(0, r'G:\New folder\control\control\omr_engine')
import scanner

img_path = r'G:\New folder\control\control\omr_engine\dataset\هزاع.jpeg'

img = cv2.imread(img_path)
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
h, w = gray.shape[:2]
if w > h:
    gray = cv2.rotate(gray, cv2.ROTATE_90_COUNTERCLOCKWISE)

report = scanner.calibrate_printer_geometry(gray)
print(f"Calibration Report: {report}")

if report.get('status') == 'success':
    print(f"Is Safe: {report['is_safe']}")
    print(f"Scale X: {report['scale_x']}")
    print(f"Scale Y: {report['scale_y']}")
else:
    print(f"Calibration Failed: {report.get('error')}")
