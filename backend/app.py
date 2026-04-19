"""
Flask REST API for Patient Disease Analysis & Prediction
"""

import os
import json
import joblib
import numpy as np
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder="../frontend", static_url_path="")
CORS(app)

# ─── Load Models ─────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models", "disease_model.pkl")
ENCODER_PATH = os.path.join(BASE_DIR, "models", "encoders.pkl")
STATS_PATH = os.path.join(BASE_DIR, "models", "precomputed_stats.pkl")

model = None
encoders = None
stats_cache = None

def load_artifacts():
    global model, encoders, stats_cache
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError("Model not found. Run model_trainer.py first!")
    model = joblib.load(MODEL_PATH)
    encoders = joblib.load(ENCODER_PATH)
    stats_cache = joblib.load(STATS_PATH)
    print("✅ Model, encoders, and stats loaded successfully.")


# ─── Serve Frontend ───────────────────────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


# ─── Health Check ─────────────────────────────────────────────────────────────
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "model_loaded": model is not None,
        "total_records": stats_cache.get("total_records", 0) if stats_cache else 0
    })


# ─── PREDICT Endpoint ─────────────────────────────────────────────────────────
@app.route("/api/predict", methods=["POST"])
def predict():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON data provided"}), 400

    try:
        age = int(data.get("age", 0))
        gender = str(data.get("gender", "Male"))

        if age < 1 or age > 120:
            return jsonify({"error": "Age must be between 1 and 120"}), 400
        if gender not in ["Male", "Female"]:
            return jsonify({"error": "Gender must be Male or Female"}), 400

    except (ValueError, TypeError) as e:
        return jsonify({"error": f"Invalid input: {str(e)}"}), 400

    le_gender = encoders["gender"]
    le_disease = encoders["disease"]

    gender_encoded = le_gender.transform([gender])[0]
    X = np.array([[age, gender_encoded]])

    # Probabilities for all classes
    proba = model.predict_proba(X)[0]
    class_indices = np.argsort(proba)[::-1]  # Sort descending

    # Top 5 predictions
    top5 = []
    for idx in class_indices[:5]:
        disease_name = le_disease.inverse_transform([idx])[0]
        confidence = round(float(proba[idx]) * 100, 1)
        top5.append({
            "disease": disease_name,
            "confidence": confidence,
            "risk_level": get_risk_level(confidence),
            "advice": get_advice(disease_name, age, gender)
        })

    # Age group
    age_group = get_age_group(age)

    # Future risk projection (next 10, 20, 30 years)
    future_risks = compute_future_risks(age, gender, le_gender, le_disease)

    return jsonify({
        "age": age,
        "gender": gender,
        "age_group": age_group,
        "predictions": top5,
        "future_risks": future_risks
    })


# ─── ANALYTICS: Prevalence ────────────────────────────────────────────────────
@app.route("/api/analysis/prevalence", methods=["GET"])
def prevalence():
    if stats_cache is None:
        return jsonify({"error": "Stats not loaded"}), 500
    return jsonify({
        "disease_prevalence": stats_cache["disease_prevalence"],
        "disease_by_gender": stats_cache["disease_by_gender"],
        "disease_by_age_group": stats_cache["disease_by_age_group"],
    })


# ─── ANALYTICS: Risk Trends ───────────────────────────────────────────────────
@app.route("/api/analysis/trends", methods=["GET"])
def trends():
    if stats_cache is None:
        return jsonify({"error": "Stats not loaded"}), 500
    return jsonify(stats_cache["risk_trends"])


# ─── ANALYTICS: Heatmap ───────────────────────────────────────────────────────
@app.route("/api/analysis/heatmap", methods=["GET"])
def heatmap():
    if stats_cache is None:
        return jsonify({"error": "Stats not loaded"}), 500
    return jsonify(stats_cache["heatmap"])


# ─── ANALYTICS: Stats ─────────────────────────────────────────────────────────
@app.route("/api/stats", methods=["GET"])
def stats():
    if stats_cache is None:
        return jsonify({"error": "Stats not loaded"}), 500
    return jsonify({
        "total_records": stats_cache["total_records"],
        "total_diseases": stats_cache["total_diseases"],
        "age_min": stats_cache["age_min"],
        "age_max": stats_cache["age_max"],
        "age_mean": stats_cache["age_mean"],
        "male_pct": stats_cache["male_pct"],
        "female_pct": stats_cache["female_pct"],
    })


# ─── Helper Functions ─────────────────────────────────────────────────────────
def get_age_group(age):
    groups = [
        (0, 17, "Child/Teen"),
        (18, 29, "Young Adult (18-29)"),
        (30, 44, "Adult (30-44)"),
        (45, 59, "Middle-Aged (45-59)"),
        (60, 74, "Senior (60-74)"),
        (75, 120, "Elderly (75+)")
    ]
    for lo, hi, label in groups:
        if lo <= age <= hi:
            return label
    return "Unknown"


def get_risk_level(confidence):
    if confidence >= 25:
        return "High"
    elif confidence >= 12:
        return "Medium"
    else:
        return "Low"


ADVICE_MAP = {
    "Hypertension": "Monitor blood pressure regularly, reduce sodium intake, exercise daily, limit alcohol.",
    "Type 2 Diabetes": "Monitor blood glucose, maintain healthy weight, eat low-glycemic foods, exercise regularly.",
    "Coronary Artery Disease": "Regular cardiac check-ups, heart-healthy diet, quit smoking, manage stress.",
    "Asthma": "Avoid triggers, use prescribed inhalers, monitor peak flow, avoid smoking environments.",
    "COPD": "Quit smoking immediately, use bronchodilators, pulmonary rehabilitation, regular lung function tests.",
    "Migraine": "Track triggers (food, stress, sleep), stay hydrated, avoid bright lights, consult neurologist.",
    "Osteoporosis": "Calcium & Vitamin D supplements, weight-bearing exercises, DEXA scan regularly, avoid falls.",
    "Anxiety Disorder": "Practice mindfulness, cognitive-behavioral therapy, regular sleep schedule, limit caffeine.",
    "Thyroid Disorders": "Regular TSH blood tests, take prescribed thyroid medication consistently, monitor symptoms.",
    "Anemia": "Iron-rich diet or supplements, Vitamin B12 and folate intake, treat underlying causes.",
    "Obesity": "Balanced caloric deficit diet, at least 150 min aerobic exercise/week, behavioral therapy.",
    "Arthritis": "Anti-inflammatory diet, joint-friendly exercises, physical therapy, NSAIDs as advised.",
    "Depression": "Psychotherapy (CBT), medication if needed, regular exercise, maintain social connections.",
    "Kidney Disease": "Low-protein diet, control blood pressure and diabetes, stay hydrated, regular kidney function tests.",
    "Liver Disease": "Avoid alcohol, hepatitis vaccinations, healthy diet, regular liver function tests.",
    "Healthy (No Disease)": "Maintain current lifestyle, annual health check-ups, balanced diet, regular exercise."
}


def get_advice(disease, age, gender):
    base = ADVICE_MAP.get(disease, "Consult your physician regularly and maintain a healthy lifestyle.")
    if age < 18:
        base = "Pediatric consult recommended. " + base
    elif age > 65:
        base = "Senior care: " + base
    return base


def compute_future_risks(current_age, gender, le_gender, le_disease):
    """Project disease risk probabilities at future ages."""
    gender_enc = le_gender.transform([gender])[0]
    future_ages = [current_age + 10, current_age + 20, current_age + 30]
    future_ages = [min(a, 100) for a in future_ages]

    results = {}
    for fa in future_ages:
        X = np.array([[fa, gender_enc]])
        proba = model.predict_proba(X)[0]
        top3_idx = np.argsort(proba)[::-1][:3]
        results[str(fa)] = [
            {
                "disease": le_disease.inverse_transform([i])[0],
                "confidence": round(float(proba[i]) * 100, 1)
            }
            for i in top3_idx
        ]
    return results


# ─── Main ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    load_artifacts()
    print("\n🌐 Starting Patient Analysis API...")
    print("   Frontend: http://localhost:5000")
    print("   API Docs: http://localhost:5000/api/health\n")
    app.run(debug=True, port=5000, host="0.0.0.0")
