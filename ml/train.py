import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score
import joblib
import os

# Load dataset
csv_path = r"e:\machine learning\project 4\ml\fever_dataset.csv"
if not os.path.exists(csv_path):
    raise FileNotFoundError(f"Dataset not found at {csv_path}. Please run generate_data.py first.")

df = pd.read_csv(csv_path)

# Split features and target
X = df[['max_temp', 'avg_temp', 'fever_hours', 'spike_count', 
        'medicine_given', 'temp_drop_after_medicine', 'symptoms_count', 'age']]
y = df['risk_level']

# Split train/test
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Train Random Forest Classifier
print("Training Random Forest Classifier...")
clf = RandomForestClassifier(n_estimators=100, random_state=42, max_depth=8)
clf.fit(X_train, y_train)

# Predict and Evaluate
y_pred = clf.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
print(f"Model Accuracy: {accuracy:.4f}")
print("\nClassification Report:")
print(classification_report(y_test, y_pred, target_names=['Low Risk', 'Moderate Risk', 'High Risk']))

# Export model
model_dir = r"e:\machine learning\project 4\backend\models"
os.makedirs(model_dir, exist_ok=True)
model_path = os.path.join(model_dir, "fever_risk_model.pkl")
joblib.dump(clf, model_path)
print(f"\nSaved trained model successfully to {model_path}")
