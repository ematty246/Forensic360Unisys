import os
import warnings
import cv2
import numpy as np
import torch
import imutils
import torch.nn as nn
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.responses import JSONResponse
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import mysql.connector
from typing import List
from pydantic import BaseModel
from torchvision import transforms
from PIL import Image
import google.generativeai as genai
from wound_analysis import estimate_wound_dimensions, analyze_wound
from fastapi.middleware.cors import CORSMiddleware


# Suppress warnings
warnings.simplefilter("ignore", category=FutureWarning)
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

# Initialize FastAPI
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow requests from any frontend
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)
# Initialize Gemini AI
API_KEY = "YOUR-API-KEY"
genai.configure(api_key=API_KEY)
model_gemini = genai.GenerativeModel("gemini-1.5-pro")

# Load trained CNN model
class BloodSpatterModel(nn.Module):
    def __init__(self):
        super(BloodSpatterModel, self).__init__()
        self.conv1 = nn.Conv2d(3, 16, kernel_size=3, stride=1, padding=1)
        self.pool = nn.MaxPool2d(kernel_size=2, stride=2, padding=0)
        self.conv2 = nn.Conv2d(16, 32, kernel_size=3, stride=1, padding=1)
        self.fc1 = nn.Linear(32 * 32 * 32, 128)
        self.fc2 = nn.Linear(128, 3)

    def forward(self, x):
        x = self.pool(torch.relu(self.conv1(x)))
        x = self.pool(torch.relu(self.conv2(x)))
        x = x.view(-1, 32 * 32 * 32)
        x = torch.relu(self.fc1(x))
        x = self.fc2(x)
        return x

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(BASE_DIR, "blood_spatter_model.pt")
wound_dataset_path = os.path.join(BASE_DIR, "WoundDataset")
model = BloodSpatterModel()
model.load_state_dict(torch.load(model_path, map_location=torch.device('cpu')))
model.eval()

transform = transforms.Compose([
    transforms.Resize((128, 128)),
    transforms.ToTensor()
])

# Database Connection Function
def get_db_connection():
    return mysql.connector.connect(
        host="localhost",
        user="your-sql-username",
        password="your-sql-password",
        database="your-sql-database"
    )

class CaseCreate(BaseModel):
    case_description: str

@app.post("/cases/", summary="Create a new crime case", tags=["Cases"])
def create_case(case: CaseCreate):
    """Create a new crime case with a description."""
    try:
        db = get_db_connection()
        cursor = db.cursor()
        sql = "INSERT INTO crime_cases (case_description) VALUES (%s)"
        cursor.execute(sql, (case.case_description,))
        case_id = cursor.lastrowid
        db.commit()
        return {"case_id": case_id, "message": "Case created successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()
def classify_blood_stain(image: Image.Image):
    image = transform(image).unsqueeze(0)
    with torch.no_grad():
        output = model(image)
        _, predicted = torch.max(output, 1)
    label_map = {0: "Low", 1: "Moderate", 2: "High"}
    return label_map[predicted.item()]

def calculate_blood_loss_dynamic(image_path):
    image = cv2.imread(image_path)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    lower_red = np.array([0, 50, 50])
    upper_red = np.array([10, 255, 255])
    mask = cv2.inRange(hsv, lower_red, upper_red)
    blood_stain_area = np.sum(mask > 0)
    return round(blood_stain_area / 100000, 3)

os.makedirs("static", exist_ok=True)

# Mount the static directory for serving processed images
app.mount("/static", StaticFiles(directory="static"), name="static")
def detect_blood_stains(image_path, blood_loss_value, reference_length_mm=10):
    image = cv2.imread(image_path)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    hsv = cv2.medianBlur(hsv, 5)

    lower_red1 = np.array([0, 50, 50])
    upper_red1 = np.array([10, 255, 255])
    lower_red2 = np.array([170, 50, 50])
    upper_red2 = np.array([180, 255, 255])
    
    mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
    mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
    mask = cv2.add(mask1, mask2)
    
    kernel = np.ones((5, 5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = [cnt for cnt in contours if cv2.contourArea(cnt) > 500]
    
    if not contours:
        return "No blood detected"
    
    largest_contour = max(contours, key=cv2.contourArea)
    M = cv2.moments(largest_contour)
    
    if M["m00"] != 0:
        best_x = int(M["m10"] / M["m00"])
        best_y = int(M["m01"] / M["m00"])
    else:
        best_x, best_y = 50, 50  
    
    arrow_length = 200  
    tip_length = 0.2  
    text_x = best_x
    text_y = best_y - arrow_length  
    cv2.arrowedLine(image, (best_x, best_y), (text_x, text_y), (0, 0, 255), 6, tipLength=tip_length)
    cv2.putText(image, f"Blood Loss: {blood_loss_value:.2f} L", (text_x + 10, text_y - 10),  
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2, cv2.LINE_AA)

    image = cv2.flip(image, 0)  
    output_path = "static/processed_image.jpg"
    cv2.imwrite(output_path, image)
    return output_path


@app.post("/analyze/{case_id}", summary="Analyze an image and store results", tags=["Analysis"])
async def analyze_bloodstain(case_id: int, image: UploadFile = File(...)):
    try:
        db = get_db_connection()
        cursor = db.cursor()

        # Check if case exists
        cursor.execute("SELECT case_id FROM crime_cases WHERE case_id = %s", (case_id,))
        case = cursor.fetchone()
        if not case:
            raise HTTPException(status_code=400, detail="Error: Case ID does not exist.")

        # Read the image content
        image_content = await image.read()

        # Save image temporarily for processing
        image_path = f"temp_{image.filename}"
        with open(image_path, "wb") as buffer:
            buffer.write(image_content)

        # Open image for processing
        pil_image = Image.open(image_path).convert("RGB")

        # Classify blood stain intensity using Gemini AI and CNN
        gemini_response = model_gemini.generate_content([
            "Analyze this crime scene image and classify blood stain intensity as 'Low', 'Moderate', or 'High'.", 
            pil_image
        ])
        gemini_classification = gemini_response.text.strip()
        cnn_classification = classify_blood_stain(pil_image)
        final_classification = gemini_classification if cnn_classification == gemini_classification else cnn_classification
        
        # Calculate blood loss
        blood_volume_lost = float(calculate_blood_loss_dynamic(image_path))
        wound_info, best_match = analyze_wound(image_path, wound_dataset_path)
        wound_dimensions = estimate_wound_dimensions(image_path, reference_length_mm=10)
        
        if isinstance(wound_dimensions, tuple) and len(wound_dimensions) == 2:
            wound_width, wound_depth = map(float, wound_dimensions)
        else:
            raise HTTPException(status_code=500, detail="Error: estimate_wound_dimensions did not return expected values.")

        # Send image to detect_blood_stains with estimated blood loss value
        processed_image_path = detect_blood_stains(image_path, blood_volume_lost)


        # Remove the temp image after processing
        os.remove(image_path)

        # Store results in the database
        sql = """INSERT INTO crime_analysis 
                 (case_id, blood_stain_intensity, blood_loss, wound_info, wound_width, wound_depth, best_match_image, image_data) 
                 VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"""
        cursor.execute(sql, (case_id, final_classification, blood_volume_lost, wound_info, wound_width, wound_depth, best_match, image_content))
        db.commit()

        return {
            "case_id": case_id,
            "Blood Stain Intensity": final_classification,
            "Estimated Blood Loss (L)": blood_volume_lost,
            "Wound Info": wound_info,
            "Estimated Wound Width (mm)": wound_width,
            "Estimated Wound Depth (mm)": wound_depth,
            "Best Matching Wound Image": best_match,
            "Processed Image URL": f"/static/processed_image.jpg",
            "message": "Analysis stored successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()



@app.get("/cases/", summary="Get all cases", tags=["Cases"])
def get_cases():
    """Retrieve all existing cases from the database."""
    try:
        db = get_db_connection()
        cursor = db.cursor(dictionary=True)  # Return results as dict
        cursor.execute("SELECT case_id, case_description FROM crime_cases")
        cases = cursor.fetchall()
        return cases
    except Exception as e:
        return {"error": str(e)}
    finally:
        cursor.close()
        db.close()


@app.delete("/cases/{case_id}", summary="Delete a case and associated analysis", tags=["Cases"])
def delete_case(case_id: int):
    try:
        db = get_db_connection()
        cursor = db.cursor()
        cursor.execute("DELETE FROM crime_analysis WHERE case_id = %s", (case_id,))
        cursor.execute("DELETE FROM crime_cases WHERE case_id = %s", (case_id,))
        db.commit()
        return {"message": "Case and associated analysis deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()

