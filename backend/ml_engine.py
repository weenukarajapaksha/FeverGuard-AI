import os
import joblib
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from models import TemperatureReading, SymptomLog, MedicationLog

class MLEngine:
    def __init__(self):
        # Load the model
        model_path = os.path.join(os.path.dirname(__file__), "models", "fever_risk_model.pkl")
        if os.path.exists(model_path):
            self.model = joblib.load(model_path)
            print("ML model loaded successfully.")
        else:
            self.model = None
            print("WARNING: ML model not found. Running in rule-based fallback mode.")
            
    def compute_features(self, patient, time_window_hours=24):
        # Current time
        now = datetime.utcnow()
        cutoff_time = now - timedelta(hours=time_window_hours)
        
        # Get readings, symptoms, medications in the last 24 hours
        readings = [r for r in patient.readings if r.timestamp >= cutoff_time]
        sboard_readings = sorted(readings, key=lambda x: x.timestamp)
        symptoms = [s for s in patient.symptoms if s.timestamp >= cutoff_time]
        medications = [m for m in patient.medications if m.timestamp >= cutoff_time]
        
        # 1. max_temp
        max_t = max([r.temperature for r in readings]) if readings else 36.8
        
        # 2. avg_temp
        avg_t = sum([r.temperature for r in readings]) / len(readings) if readings else 36.8
        
        # 3. fever_hours (fraction of readings > 37.5 * 24)
        fever_readings = [r for r in readings if r.temperature > 37.5]
        fever_hrs = (len(fever_readings) / len(readings) * 24.0) if readings else 0.0
        
        # 4. spike_count: rises of > 0.8°C within a 2-hour window
        spikes = 0
        for i in range(len(sboard_readings)):
            for j in range(i + 1, len(sboard_readings)):
                time_diff = sboard_readings[j].timestamp - sboard_readings[i].timestamp
                if time_diff <= timedelta(hours=2):
                    temp_diff = sboard_readings[j].temperature - sboard_readings[i].temperature
                    if temp_diff >= 0.8:
                        spikes += 1
                        break  # Count once per starting reading
        
        # 5. medicine_given
        med_given = 1 if len(medications) > 0 else 0
        
        # 6. temp_drop_after_medicine
        # Calculate drop as temp just before medicine minus min temp in 2 hours after
        drops = []
        for med in medications:
            # Temp before (within 1 hour prior to med)
            temps_before = [r.temperature for r in patient.readings 
                            if r.timestamp <= med.timestamp and r.timestamp >= med.timestamp - timedelta(hours=1)]
            temp_before = temps_before[-1] if temps_before else None
            
            # Temp after (min temp in 2 hours post med)
            temps_after = [r.temperature for r in patient.readings 
                           if r.timestamp >= med.timestamp and r.timestamp <= med.timestamp + timedelta(hours=2)]
            temp_after = min(temps_after) if temps_after else None
            
            if temp_before is not None and temp_after is not None:
                drop = temp_before - temp_after
                drops.append(max(0.0, drop)) # Negative drop means temperature increased
                
        avg_drop = sum(drops) / len(drops) if drops else 0.0
        
        # 7. symptoms_count
        sym_count = len(symptoms)
        
        # 8. age
        age = patient.age
        
        features = {
            'max_temp': round(max_t, 2),
            'avg_temp': round(avg_t, 2),
            'fever_hours': round(fever_hrs, 1),
            'spike_count': spikes,
            'medicine_given': med_given,
            'temp_drop_after_medicine': round(avg_drop, 2),
            'symptoms_count': sym_count,
            'age': age
        }
        
        return features

    def predict_risk(self, features):
        if self.model is None:
            # Fallback rule-based risk assessment
            score = 0
            if features['max_temp'] > 39.0: score += 4
            elif features['max_temp'] > 37.8: score += 2
            if features['fever_hours'] > 12: score += 3
            if features['symptoms_count'] >= 4: score += 3
            if features['spike_count'] >= 3: score += 2
            if features['medicine_given'] == 1 and features['temp_drop_after_medicine'] < 0.3: score += 2
            
            if score >= 8: return 2, "High Risk"
            elif score >= 4: return 1, "Moderate Risk"
            return 0, "Low Risk"
            
        # Format features for model prediction
        df = pd.DataFrame([features])
        pred = int(self.model.predict(df)[0])
        labels = {0: "Low Risk", 1: "Moderate Risk", 2: "High Risk"}
        return pred, labels.get(pred, "Unknown")

    def analyze_fever_pattern(self, patient):
        readings = sorted(patient.readings, key=lambda x: x.timestamp)
        if not readings:
            return "No Readings", "Awaiting temperature logs to establish patterns."
            
        temps = [r.temperature for r in readings]
        max_t = max(temps)
        min_t = min(temps)
        
        # If no readings exceed normal body temperature
        if max_t <= 37.5:
            return "Apyrexial", "Temperature is within the normal clinical range."
            
        # Check fluctuations
        range_t = max_t - min_t
        all_above_normal = all([t > 37.5 for t in temps])
        any_normal = any([t <= 37.3 for t in temps])
        
        if all_above_normal and range_t <= 1.0:
            return "Continuous Fever", "Fever remains persistently high with minimal fluctuations (< 1°C) over 24h. Clinically common in Typhoid, Lobar Pneumonia, and early Dengue."
        elif all_above_normal and range_t > 1.0:
            return "Remittent Fever", "Temperature remains elevated above normal but fluctuates by more than 1°C in 24 hours. Clinically associated with Infective Endocarditis and respiratory infections."
        elif any_normal and max_t > 37.5:
            return "Intermittent Fever", "Temperature spikes but returns to normal base levels at some point during the 24h cycle. Common in Malaria, Sepsis, and localized pyogenic abscesses."
        else:
            return "Undifferentiated Fever", "Fluctuating fever pattern detected. Continued monitoring required to characterize the specific pattern."

    def generate_recommendations(self, patient, features, risk_label):
        # Basic checklists
        specialties = []
        investigations = []
        pathways = []
        
        symptoms_logged = [s.symptom_name.lower() for s in patient.symptoms]
        fever_duration_days = 0
        if patient.readings:
            first_reading = min(patient.readings, key=lambda x: x.timestamp).timestamp
            fever_duration_days = (datetime.utcnow() - first_reading).days
            
        # Clinical reasoning for specialties and tests
        # 1. Dengue Risk (Heavy focus in Sri Lanka)
        dengue_symptoms = {'joint pain', 'muscle pain', 'headache', 'rash', 'eyeball pain', 'nausea'}
        matching_dengue = dengue_symptoms.intersection(set(symptoms_logged))
        
        if len(matching_dengue) >= 2 or 'rash' in symptoms_logged:
            specialties.append("Infectious Diseases / General Medicine")
            pathways.append("Arboviral illness pathway (Dengue, Chikungunya check)")
            if fever_duration_days <= 5:
                investigations.append("Full Blood Count (FBC) with platelets (daily monitoring)")
                investigations.append("Dengue NS1 Antigen Test")
            else:
                investigations.append("Dengue IgM/IgG Serology")
                investigations.append("Full Blood Count (FBC)")
                
        # 2. Respiratory infections
        resp_symptoms = {'cough', 'shortness of breath', 'breathing difficulty', 'sore throat', 'chest pain'}
        matching_resp = resp_symptoms.intersection(set(symptoms_logged))
        if 'cough' in symptoms_logged or 'shortness of breath' in symptoms_logged:
            specialties.append("Respiratory Medicine / Pulmonology")
            pathways.append("Lower/Upper Respiratory Tract Infection diagnostic pathway")
            investigations.append("Chest X-Ray (CXR) PA View")
            investigations.append("Sputum Full Report & Culture (if productive cough)")

        # 3. Urinary Tract Infections (UTI)
        uti_symptoms = {'painful urination', 'burning urination', 'urine frequency', 'lower abdominal pain'}
        matching_uti = uti_symptoms.intersection(set(symptoms_logged))
        if len(matching_uti) >= 1:
            specialties.append("Urology / Nephrology")
            pathways.append("Urinary Tract Infection (UTI) investigative pathway")
            investigations.append("Urine Full Report (UFR)")
            investigations.append("Urine Culture & Sensitivity (Urine C/S)")

        # 4. Sepsis warnings
        sepsis_indicators = {'shivering', 'confusion', 'extreme fatigue', 'dizziness', 'rapid breathing'}
        matching_sepsis = sepsis_indicators.intersection(set(symptoms_logged))
        if len(matching_sepsis) >= 2 or risk_label == "High Risk":
            specialties.append("Emergency Medicine / Critical Care")
            pathways.append("Systemic Inflammatory Response Syndrome (SIRS) / Sepsis evaluation")
            investigations.append("Blood Culture & Sensitivity (Blood C/S) - 2 sites")
            investigations.append("Serum Lactate levels")
            investigations.append("C-Reactive Protein (CRP) & ESR")
            investigations.append("Renal Function Tests (RFTs) & Serum Electrolytes")

        # 5. Generic Pyrexia of Unknown Origin (PUO)
        if fever_duration_days >= 7 or len(specialties) == 0:
            specialties.append("Infectious Diseases / Rheumatology / Clinical Immunology")
            pathways.append("Pyrexia of Unknown Origin (PUO) standard workup (Harrison's protocol)")
            if "Full Blood Count (FBC)" not in "".join(investigations):
                investigations.append("Full Blood Count (FBC) with differential count")
            if "CRP" not in "".join(investigations):
                investigations.append("C-Reactive Protein (CRP) & Erythrocyte Sedimentation Rate (ESR)")
            investigations.append("Liver Function Tests (LFTs)")
            investigations.append("Renal Function Tests (RFTs)")
            investigations.append("Ultrasound Scan (USS) of Abdomen and Pelvis")

        # Deduplicate list elements
        specialties = list(set(specialties))
        investigations = list(set(investigations))
        pathways = list(set(pathways))
        
        # General guidance summary
        if risk_label == "High Risk":
            guidance = "⚠️ URGENT CLINICAL REVIEW REQUIRED. The patient exhibits critical telemetry indicators (such as persistent hyperpyrexia, high fever hours, or poor response to medications) combined with severe symptoms. Seek emergency care immediately."
        elif risk_label == "Moderate Risk":
            guidance = "⚠️ CLINICAL ASSESSMENT RECOMMENDED. Fever trends and symptom logs suggest active inflammatory response or poor medicine clearance. Schedule an outpatient consultation with a physician."
        else:
            guidance = "✅ CONTINUE MONITORING. Current parameters are stable. Ensure adequate hydration, record medication schedules, and update symptoms if new signs occur."

        return {
            'specialties': specialties,
            'investigations': investigations,
            'diagnostic_pathways': pathways,
            'guidance': guidance
        }

ml_engine = MLEngine()
