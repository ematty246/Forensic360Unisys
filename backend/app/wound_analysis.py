import os
import base64
import requests
import cv2
import numpy as np
import imutils
from skimage.measure import label, regionprops

API_KEY = "YOUR-API-KEY"
API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent"

def encode_image(image_path):
    with open(image_path, "rb") as img_file:
        return base64.b64encode(img_file.read()).decode("utf-8")

def analyze_wound(test_image_path, dataset_folder):
    test_image_base64 = encode_image(test_image_path)
    
    prompt_text = """
    """
    
    request_data = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"inline_data": {"mime_type": "image/jpeg", "data": test_image_base64}},
                    {"text": prompt_text}
                ]
            }
        ]
    }

    response = requests.post(f"{API_URL}?key={API_KEY}", json=request_data)
    
    if response.status_code == 200:
        api_result = response.json()
        wound_info = api_result['candidates'][0]['content']['parts'][0]['text']
        print(f"Identified Wound Info: {wound_info}")
        
        best_match = match_wound_in_dataset(wound_info.split("\n")[0], dataset_folder)
        return wound_info, best_match
    else:
        print(f"Error: {response.text}")
        return None, None

def match_wound_in_dataset(wound_type, dataset_folder):
    wound_type_lower = wound_type.lower()
    best_match = None

    for img_name in os.listdir(dataset_folder):
        if wound_type_lower in img_name.lower():
            best_match = img_name
            break

    return best_match if best_match else "No match found"

def estimate_wound_dimensions(image_path, reference_length_mm=10):
    image = cv2.imread(image_path)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    contours = cv2.findContours(edges.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = imutils.grab_contours(contours)

    if not contours:
        return "No wound detected"

    wound_contour = max(contours, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(wound_contour)

    reference_object = None
    for cnt in contours:
        if cnt is not wound_contour:
            if reference_object is None or cv2.contourArea(cnt) > cv2.contourArea(reference_object):
                reference_object = cnt

    if reference_object is None:
        return "Reference object not found!"

    ref_x, ref_y, ref_w, ref_h = cv2.boundingRect(reference_object)
    pixel_per_mm = ref_w / reference_length_mm 
    wound_width_mm = w / pixel_per_mm
    wound_depth_mm = h / pixel_per_mm

    return round(wound_width_mm, 2), round(wound_depth_mm, 2)
