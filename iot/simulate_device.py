import time
import requests
import random
from datetime import datetime

API_BASE = "http://127.0.0.1:5000/api"

print("="*60)
print("             FEVERSENSE AI - DEVICE TELEMETRY SIMULATOR")
print("="*60)

# Main simulation loop
base_temp = 38.2
is_cooling = False
cooling_steps = 0
last_med_count = 0

def find_active_device():
    try:
        res = requests.get(f"{API_BASE}/patients")
        if res.status_code == 200:
            patients = res.json()
            if patients:
                # Target the first registered patient for simulation
                patient = patients[0]
                print(f"[*] Found active patient: {patient['name']} (Device ID: {patient['device_id']})")
                return patient
        return None
    except Exception as e:
        print(f"[!] Error connecting to Flask backend: {e}")
        return None

# Find device
patient = None
while not patient:
    patient = find_active_device()
    if not patient:
        print("[*] Awaiting patient profile registration in the dashboard... Retrying in 5s.")
        time.sleep(5)

device_id = patient['device_id']
patient_id = patient['id']

print(f"\n[*] Starting live telemetry stream for Device: {device_id}")
print("[*] Sending temperature readings every 3 seconds. Press Ctrl+C to stop.")
print("-" * 60)

while True:
    # 1. Check if medication was logged to simulate clinical temperature drop
    try:
        med_res = requests.get(f"{API_BASE}/patients/{patient_id}/medications")
        if med_res.status_code == 200:
            meds = med_res.json()
            if len(meds) > last_med_count:
                print(f"\n[💊 CLINICAL EVENT] Medication detected: {meds[0]['medicine_name']} ({meds[0]['dosage']})")
                print(" -> Initiating clinical antipyretic temperature drop simulation...")
                is_cooling = True
                cooling_steps = 8 # Cool down over next 8 readings
                last_med_count = len(meds)
    except Exception as e:
        pass
        
    # 2. Compute simulated temperature
    if is_cooling:
        # Cool down towards normal range (36.8°C)
        base_temp -= random.uniform(0.15, 0.3)
        base_temp = max(36.7, base_temp)
        cooling_steps -= 1
        if cooling_steps <= 0 or base_temp <= 36.8:
            is_cooling = False
            print(" -> Antipyretic absorption complete. Base temperature stabilized.")
    else:
        # Generate standard hyperpyrexia walk (fluctuating rises)
        base_temp += random.uniform(-0.1, 0.25)
        # Prevent boundary overflow
        if base_temp > 40.5:
            base_temp -= 0.3
        elif base_temp < 37.3:
            base_temp += 0.2
            
    current_temp = round(base_temp, 2)
    
    # 3. Post telemetry payload to API
    payload = {
        "device_id": device_id,
        "temperature": current_temp
    }
    
    try:
        res = requests.post(f"{API_BASE}/readings", json=payload)
        if res.status_code == 210 or res.status_code == 200:
            status = "FEVER" if current_temp > 37.5 else "NORMAL"
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Published Telemetry -> Device: {device_id} | Temperature: {current_temp}°C | Status: {status}")
        else:
            print(f"[!] Server returned code: {res.status_code}")
    except Exception as e:
        print(f"[!] Network error sending telemetry: {e}")
        
    time.sleep(3)
