"""
Medical Dataset Generator + Model Trainer
Generates 15,000+ synthetic patient records based on real-world
epidemiological patterns from WHO/CDC age-gender-disease distributions,
then trains a RandomForestClassifier to predict disease from age + gender.
"""

import os
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, accuracy_score
from collections import Counter

np.random.seed(42)

# ─────────────────────────────────────────────────────────────────────────────
# DISEASE DEFINITIONS with realistic age/gender distributions
# Based on: CDC WONDER, WHO Global Health Observatory, Framingham Heart Study
# ─────────────────────────────────────────────────────────────────────────────
DISEASE_PROFILES = {
    "Hypertension": {
        "age_mean": 58, "age_std": 14, "age_min": 25, "age_max": 90,
        "male_weight": 0.55, "female_weight": 0.45, "base_count": 1800
    },
    "Type 2 Diabetes": {
        "age_mean": 55, "age_std": 13, "age_min": 30, "age_max": 85,
        "male_weight": 0.52, "female_weight": 0.48, "base_count": 1600
    },
    "Coronary Artery Disease": {
        "age_mean": 62, "age_std": 11, "age_min": 35, "age_max": 90,
        "male_weight": 0.65, "female_weight": 0.35, "base_count": 1100
    },
    "Asthma": {
        "age_mean": 28, "age_std": 16, "age_min": 2, "age_max": 70,
        "male_weight": 0.48, "female_weight": 0.52, "base_count": 1000
    },
    "COPD": {
        "age_mean": 65, "age_std": 10, "age_min": 40, "age_max": 90,
        "male_weight": 0.58, "female_weight": 0.42, "base_count": 900
    },
    "Migraine": {
        "age_mean": 35, "age_std": 12, "age_min": 10, "age_max": 65,
        "male_weight": 0.30, "female_weight": 0.70, "base_count": 1000
    },
    "Osteoporosis": {
        "age_mean": 68, "age_std": 10, "age_min": 45, "age_max": 95,
        "male_weight": 0.20, "female_weight": 0.80, "base_count": 700
    },
    "Anxiety Disorder": {
        "age_mean": 33, "age_std": 12, "age_min": 15, "age_max": 70,
        "male_weight": 0.38, "female_weight": 0.62, "base_count": 1100
    },
    "Thyroid Disorders": {
        "age_mean": 45, "age_std": 13, "age_min": 20, "age_max": 80,
        "male_weight": 0.20, "female_weight": 0.80, "base_count": 800
    },
    "Anemia": {
        "age_mean": 38, "age_std": 16, "age_min": 10, "age_max": 80,
        "male_weight": 0.35, "female_weight": 0.65, "base_count": 900
    },
    "Obesity": {
        "age_mean": 42, "age_std": 14, "age_min": 15, "age_max": 80,
        "male_weight": 0.50, "female_weight": 0.50, "base_count": 1000
    },
    "Arthritis": {
        "age_mean": 60, "age_std": 12, "age_min": 30, "age_max": 90,
        "male_weight": 0.42, "female_weight": 0.58, "base_count": 900
    },
    "Depression": {
        "age_mean": 38, "age_std": 14, "age_min": 15, "age_max": 80,
        "male_weight": 0.36, "female_weight": 0.64, "base_count": 1100
    },
    "Kidney Disease": {
        "age_mean": 60, "age_std": 13, "age_min": 35, "age_max": 90,
        "male_weight": 0.60, "female_weight": 0.40, "base_count": 700
    },
    "Liver Disease": {
        "age_mean": 50, "age_std": 13, "age_min": 25, "age_max": 85,
        "male_weight": 0.62, "female_weight": 0.38, "base_count": 700
    },
    "Healthy (No Disease)": {
        "age_mean": 32, "age_std": 15, "age_min": 1, "age_max": 50,
        "male_weight": 0.50, "female_weight": 0.50, "base_count": 1000
    }
}

AGE_GROUPS = [
    (0, 17, "Child/Teen"),
    (18, 29, "Young Adult (18-29)"),
    (30, 44, "Adult (30-44)"),
    (45, 59, "Middle-Aged (45-59)"),
    (60, 74, "Senior (60-74)"),
    (75, 100, "Elderly (75+)")
]


def generate_dataset():
    records = []
    for disease, profile in DISEASE_PROFILES.items():
        n = profile["base_count"]
        male_n = int(n * profile["male_weight"])
        female_n = n - male_n

        # --- Male records ---
        male_ages = np.random.normal(profile["age_mean"], profile["age_std"], male_n)
        male_ages = np.clip(male_ages, profile["age_min"], profile["age_max"]).astype(int)
        for age in male_ages:
            records.append({"age": age, "gender": "Male", "disease": disease})

        # --- Female records ---
        female_ages = np.random.normal(profile["age_mean"], profile["age_std"], female_n)
        female_ages = np.clip(female_ages, profile["age_min"], profile["age_max"]).astype(int)
        for age in female_ages:
            records.append({"age": age, "gender": "Female", "disease": disease})

    df = pd.DataFrame(records)
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)  # Shuffle

    # Add age group column
    def get_age_group(age):
        for lo, hi, label in AGE_GROUPS:
            if lo <= age <= hi:
                return label
        return "Unknown"

    df["age_group"] = df["age"].apply(get_age_group)
    return df


def train_model(df):
    print(f"\n📊 Dataset shape: {df.shape}")
    print(f"📋 Diseases: {df['disease'].nunique()}")
    print(f"🔢 Records per class:\n{df['disease'].value_counts()}\n")

    # Encode gender
    le_gender = LabelEncoder()
    df["gender_encoded"] = le_gender.fit_transform(df["gender"])

    # Encode disease labels
    le_disease = LabelEncoder()
    df["disease_encoded"] = le_disease.fit_transform(df["disease"])

    X = df[["age", "gender_encoded"]].values
    y = df["disease_encoded"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print("🤖 Training RandomForestClassifier...")
    model = RandomForestClassifier(
        n_estimators=300,
        max_depth=20,
        min_samples_split=5,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"✅ Test Accuracy: {acc:.4f} ({acc*100:.1f}%)")
    print("\n📈 Classification Report:")
    print(classification_report(y_test, y_pred, target_names=le_disease.classes_))

    return model, le_gender, le_disease


def save_artifacts(model, le_gender, le_disease, df):
    os.makedirs("models", exist_ok=True)
    os.makedirs("data", exist_ok=True)

    joblib.dump(model, "models/disease_model.pkl")
    joblib.dump({"gender": le_gender, "disease": le_disease}, "models/encoders.pkl")
    df.to_csv("data/medical_dataset.csv", index=False)

    print("\n💾 Saved:")
    print(f"  models/disease_model.pkl ({os.path.getsize('models/disease_model.pkl') // 1024} KB)")
    print(f"  models/encoders.pkl")
    print(f"  data/medical_dataset.csv ({len(df)} rows)")


def compute_stats(df):
    """Pre-compute analytics for API endpoints."""
    stats = {}

    # 1. Overall stats
    stats["total_records"] = len(df)
    stats["total_diseases"] = df["disease"].nunique()
    stats["age_min"] = int(df["age"].min())
    stats["age_max"] = int(df["age"].max())
    stats["age_mean"] = round(float(df["age"].mean()), 1)
    stats["male_pct"] = round(float((df["gender"] == "Male").mean() * 100), 1)
    stats["female_pct"] = round(float((df["gender"] == "Female").mean() * 100), 1)

    # 2. Disease prevalence
    disease_counts = df["disease"].value_counts().to_dict()
    stats["disease_prevalence"] = disease_counts

    # 3. Disease by gender
    disease_gender = df.groupby(["disease", "gender"]).size().unstack(fill_value=0)
    stats["disease_by_gender"] = {
        "diseases": list(disease_gender.index),
        "male": [int(x) for x in disease_gender.get("Male", pd.Series([0]*len(disease_gender))).values],
        "female": [int(x) for x in disease_gender.get("Female", pd.Series([0]*len(disease_gender))).values],
    }

    # 4. Disease by age group
    disease_agegroup = df.groupby(["age_group", "disease"]).size().unstack(fill_value=0)
    age_group_order = [g[2] for g in AGE_GROUPS]
    disease_agegroup = disease_agegroup.reindex(
        [x for x in age_group_order if x in disease_agegroup.index]
    )
    stats["disease_by_age_group"] = {
        "age_groups": list(disease_agegroup.index),
        "diseases": list(disease_agegroup.columns),
        "data": [[int(x) for x in row] for row in disease_agegroup.values]
    }

    # 5. Risk trends (age decade → disease count per disease)
    df["decade"] = (df["age"] // 10) * 10
    top_diseases = df[df["disease"] != "Healthy (No Disease)"]["disease"].value_counts().head(8).index.tolist()
    trend_data = {}
    decades = sorted(df["decade"].unique())
    for dis in top_diseases:
        dis_df = df[df["disease"] == dis]
        trend_data[dis] = {
            str(d): int((dis_df["decade"] == d).sum()) for d in decades
        }
    stats["risk_trends"] = {"decades": [str(d) for d in decades], "diseases": trend_data}

    # 6. Heatmap: age_group x disease
    diseases_no_healthy = [d for d in df["disease"].unique() if "Healthy" not in d]
    heatmap_df = df[df["disease"].isin(diseases_no_healthy)]
    heatmap = heatmap_df.groupby(["age_group", "disease"]).size().unstack(fill_value=0)
    heatmap = heatmap.reindex([x for x in age_group_order if x in heatmap.index])
    stats["heatmap"] = {
        "age_groups": list(heatmap.index),
        "diseases": list(heatmap.columns),
        "values": [[int(x) for x in row] for row in heatmap.values]
    }

    joblib.dump(stats, "models/precomputed_stats.pkl")
    print("  models/precomputed_stats.pkl (analytics cache)")
    return stats


if __name__ == "__main__":
    print("=" * 60)
    print("  Patient Disease Prediction — Dataset Generation & Training")
    print("=" * 60)

    print("\n🔬 Generating synthetic medical dataset...")
    df = generate_dataset()

    model, le_gender, le_disease = train_model(df)

    print("\n📐 Computing analytics cache...")
    stats = compute_stats(df)

    save_artifacts(model, le_gender, le_disease, df)

    print("\n✅ All done! Run: python app.py")
    print("=" * 60)
