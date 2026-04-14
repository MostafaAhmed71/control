import sys, os
import cv2
import base64
sys.path.insert(0, r'G:\New folder\control\control\omr_engine')
import scanner

img_path = r'G:\New folder\control\control\omr_engine\dataset\هزاع.jpeg'

# We will run a single scan and check if review_rois is in the output
# To force a review, we can use a very high strictness or just check if the field exists
result = scanner.scan_omr_with_mode(
    img_path, is_bytes=False, style='nafs',
    from_scanner=True, num_questions=30, scan_mode='strict'
)

print(f"Status: {result.get('status')}")
print(f"Needs Review Count: {len(result.get('needs_review_questions', []))}")
print(f"Review ROIs keys: {list(result.get('review_rois', {}).keys())}")

if result.get('review_rois'):
    first_q = list(result.get('review_rois').keys())[0]
    b64_data = result['review_rois'][first_q]
    print(f"ROI for Q{first_q} exists. Length: {len(b64_data)}")
    
    # Save the first ROI to a file for manual verification if needed
    with open("debug_roi_test.jpg", "wb") as f:
        f.write(base64.b64decode(b64_data))
    print("Saved debug_roi_test.jpg")
else:
    print("No review ROIs generated (as expected for high-confidence scan).")
    # Let's force one to test the function itself
    print("Testing extract_question_bubble_roi directly...")
    # I need to mock the arguments from a real scan, but I can't easily without running half of _scan_omr_single
