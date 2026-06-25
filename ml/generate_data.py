import pandas as pd
import numpy as np
import os

# Set seed for reproducibility
np.random.seed(42)

num_samples = 1500

# Generate random features
max_temp = np.random.uniform(36.5, 41.0, num_samples)
avg_temp = max_temp - np.random.uniform(0.2, 1.2, num_samples)
fever_hours = np.random.uniform(0, 24, num_samples)
spike_count = np.random.randint(0, 8, num_samples)
medicine_given = np.random.choice([0, 1], num_samples, p=[0.3, 0.7])
temp_drop_after_medicine = np.zeros(num_samples)
for i in range(num_samples):
    if medicine_given[i] == 1:
        temp_drop_after_medicine[i] = np.random.uniform(-0.2, 1.5)
    else:
        temp_drop_after_medicine[i] = 0.0

symptoms_count = np.random.randint(0, 8, num_samples)
age = np.random.randint(1, 90, num_samples)

# Rule-based labelling for realistic clinical data
risk_level = []
for i in range(num_samples):
    # Calculate a score that determines risk
    score = 0
    
    # Temperature risk contribution
    if max_temp[i] > 39.0:
        score += 4
    elif max_temp[i] > 37.8:
        score += 2
        
    # Fever duration contribution
    if fever_hours[i] > 12:
        score += 3
    elif fever_hours[i] > 4:
        score += 1
        
    # Spikes contribution
    if spike_count[i] >= 4:
        score += 2
    elif spike_count[i] >= 2:
        score += 1
        
    # Symptoms contribution
    if symptoms_count[i] >= 4:
        score += 3
    elif symptoms_count[i] >= 2:
        score += 1
        
    # Medicine response contribution (if medicine given and temp didn't drop, it's risky)
    if medicine_given[i] == 1 and temp_drop_after_medicine[i] < 0.3:
        score += 2
        
    # Classify based on score
    if score >= 8:
        risk_level.append(2)  # High Risk (Urgent Medical Review)
    elif score >= 4:
        risk_level.append(1)  # Moderate Risk (GP Consult Needed)
    else:
        risk_level.append(0)  # Low Risk (Self-monitoring)

# Create DataFrame
df = pd.DataFrame({
    'max_temp': np.round(max_temp, 2),
    'avg_temp': np.round(avg_temp, 2),
    'fever_hours': np.round(fever_hours, 1),
    'spike_count': spike_count,
    'medicine_given': medicine_given,
    'temp_drop_after_medicine': np.round(temp_drop_after_medicine, 2),
    'symptoms_count': symptoms_count,
    'age': age,
    'risk_level': risk_level
})

# Create directory if it doesn't exist
os.makedirs(r"e:\machine learning\project 4\ml", exist_ok=True)
csv_path = r"e:\machine learning\project 4\ml\fever_dataset.csv"
df.to_csv(csv_path, index=False)
print(f"Generated {num_samples} simulated clinical fever records at {csv_path}")
print("Risk Level Counts:")
print(df['risk_level'].value_counts())
