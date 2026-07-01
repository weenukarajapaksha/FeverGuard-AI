from flask import Flask, request, jsonify
from flask_cors import CORS
from database import db
from models import Patient, TemperatureReading, SymptomLog, MedicationLog, SyncRequest, Staff
from ml_engine import ml_engine
import threading
import json
import random
import time
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
CORS(app)

# SQLite Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///fever_guard.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

# Initialize database tables on start
with app.app_context():
    db.create_all()
    print("Database tables initialized successfully.")
    
    # Seed default staff if they don't exist
    if not Staff.query.filter_by(username='nurse').first():
        nurse_staff = Staff(
            name="Staff Nurse",
            username="nurse",
            password_hash=generate_password_hash("password"),
            role="nurse",
            department="Ward Station A"
        )
        db.session.add(nurse_staff)
        
    if not Staff.query.filter_by(username='doctor').first():
        doctor_staff = Staff(
            name="Clinical Doctor",
            username="doctor",
            password_hash=generate_password_hash("password"),
            role="doctor",
            department="General Medicine"
        )
        db.session.add(doctor_staff)
        
    try:
        db.session.commit()
        print("Default staff accounts seeded successfully.")
    except Exception as e:
        db.session.rollback()
        print(f"Error seeding staff accounts: {e}")


# Helper to generate random 6-digit OTP
def generate_otp():
    return str(random.randint(100000, 999999))

# ==========================================
# REST API ROUTES
# ==========================================

# 1. Patients CRUD
@app.route('/api/patients', methods=['POST'])
def create_patient():
    data = request.get_json()
    if not data or not data.get('name') or not data.get('device_id') or not data.get('password'):
        return jsonify({'error': 'Name, Device ID, and Password are required.'}), 400
        
    # Check if device_id is already registered
    existing = Patient.query.filter_by(device_id=data['device_id']).first()
    if existing:
        return jsonify({'error': f'Device ID {data["device_id"]} is already registered.'}), 400
        
    patient = Patient(
        name=data['name'],
        age=int(data['age']),
        gender=data['gender'],
        device_id=data['device_id'],
        password_hash=generate_password_hash(data['password']),
        travel_history=data.get('travel_history', ''),
        past_medical_history=data.get('past_medical_history', ''),
        is_hospitalized=data.get('is_hospitalized', False),
        bed_number=data.get('bed_number', '')
    )
    
    try:
        db.session.add(patient)
        db.session.commit()
        return jsonify(patient.to_dict()), 210
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/patients/login', methods=['POST'])
def login_patient():
    data = request.get_json()
    if not data or not data.get('device_id') or not data.get('password'):
        return jsonify({'error': 'Device ID and Password are required.'}), 400
        
    device_id = data['device_id'].strip()
    password = data['password']
    
    patient = Patient.query.filter_by(device_id=device_id).first()
    if not patient:
        return jsonify({'error': 'No patient profile found with this Device ID.'}), 404
        
    if patient.password_hash and not check_password_hash(patient.password_hash, password):
        return jsonify({'error': 'Invalid password.'}), 401
        
    return jsonify({
        'success': True,
        'patient': patient.to_dict()
    })

@app.route('/api/patients', methods=['GET'])
def get_patients():
    patients = Patient.query.all()
    return jsonify([p.to_dict() for p in patients])

@app.route('/api/patients/<id>', methods=['GET'])
def get_patient(id):
    patient = Patient.query.get(id)
    if not patient:
        return jsonify({'error': 'Patient not found.'}), 404
    return jsonify(patient.to_dict())

@app.route('/api/patients/<id>', methods=['DELETE'])
def delete_patient(id):
    patient = Patient.query.get(id)
    if not patient:
        return jsonify({'error': 'Patient not found.'}), 404
    try:
        db.session.delete(patient)
        db.session.commit()
        return jsonify({'message': 'Patient profile deleted.'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# 2. Telemetry / Temperature Readings
@app.route('/api/readings', methods=['POST'])
def add_reading():
    data = request.get_json()
    if not data or not data.get('device_id') or data.get('temperature') is None:
        return jsonify({'error': 'Device ID and Temperature are required.'}), 400
        
    device_id = data['device_id']
    temperature = float(data['temperature'])
    
    # Resolve patient by device_id
    patient = Patient.query.filter_by(device_id=device_id).first()
    patient_id = patient.id if patient else None
    
    reading = TemperatureReading(
        patient_id=patient_id,
        device_id=device_id,
        temperature=temperature
    )
    
    try:
        db.session.add(reading)
        db.session.commit()
        return jsonify(reading.to_dict()), 210
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/patients/<id>/readings', methods=['GET'])
def get_patient_readings(id):
    patient = Patient.query.get(id)
    if not patient:
        return jsonify({'error': 'Patient not found.'}), 404
    readings = TemperatureReading.query.filter_by(patient_id=id).order_by(TemperatureReading.timestamp.asc()).all()
    return jsonify([r.to_dict() for r in readings])

# 3. Clinical Symptoms Logging
@app.route('/api/patients/<id>/symptoms', methods=['POST'])
def add_symptom(id):
    patient = Patient.query.get(id)
    if not patient:
        return jsonify({'error': 'Patient not found.'}), 404
        
    data = request.get_json()
    if not data or not data.get('symptom_name') or not data.get('severity'):
        return jsonify({'error': 'Symptom name and Severity are required.'}), 400
        
    symptom = SymptomLog(
        patient_id=id,
        symptom_name=data['symptom_name'],
        severity=data['severity']
    )
    
    try:
        db.session.add(symptom)
        db.session.commit()
        return jsonify(symptom.to_dict()), 210
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/patients/<id>/symptoms', methods=['GET'])
def get_patient_symptoms(id):
    patient = Patient.query.get(id)
    if not patient:
        return jsonify({'error': 'Patient not found.'}), 404
    symptoms = SymptomLog.query.filter_by(patient_id=id).order_by(SymptomLog.timestamp.desc()).all()
    return jsonify([s.to_dict() for s in symptoms])

# 4. Medication Charting
@app.route('/api/patients/<id>/medications', methods=['POST'])
def add_medication(id):
    patient = Patient.query.get(id)
    if not patient:
        return jsonify({'error': 'Patient not found.'}), 404
        
    data = request.get_json()
    if not data or not data.get('medicine_name') or not data.get('dosage'):
        return jsonify({'error': 'Medicine name and Dosage are required.'}), 400
        
    medication = MedicationLog(
        patient_id=id,
        medicine_name=data['medicine_name'],
        dosage=data['dosage']
    )
    
    try:
        db.session.add(medication)
        db.session.commit()
        return jsonify(medication.to_dict()), 210
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/patients/<id>/medications', methods=['GET'])
def get_patient_medications(id):
    patient = Patient.query.get(id)
    if not patient:
        return jsonify({'error': 'Patient not found.'}), 404
    meds = MedicationLog.query.filter_by(patient_id=id).order_by(MedicationLog.timestamp.desc()).all()
    return jsonify([m.to_dict() for m in meds])

# 5. Care Continuity Sync Requests (OTP Linkage)
@app.route('/api/sync/request', methods=['POST'])
def create_sync_request():
    data = request.get_json()
    if not data or not data.get('device_id'):
        return jsonify({'error': 'Device ID is required.'}), 400
        
    device_id = data['device_id']
    otp = generate_otp()
    
    # Clear any old requests for this device to prevent clutter
    SyncRequest.query.filter_by(device_id=device_id).delete()
    
    req = SyncRequest(device_id=device_id, otp=otp)
    try:
        db.session.add(req)
        db.session.commit()
        return jsonify({'device_id': device_id, 'otp': otp})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/sync/approve', methods=['POST'])
def approve_sync_request():
    data = request.get_json()
    if not data or not data.get('device_id') or not data.get('otp') or not data.get('bed_number'):
        return jsonify({'error': 'Device ID, OTP, and Bed Number are required.'}), 400
        
    device_id = data['device_id']
    otp = data['otp']
    bed_number = data['bed_number']
    
    # Query matching active sync request in the last 15 minutes
    now = datetime.utcnow()
    cutoff = now - timedelta(minutes=15) if 'timedelta' in globals() else now - timedelta(minutes=15)
    
    # Resolve if timedelta not imported locally
    from datetime import timedelta
    cutoff = now - timedelta(minutes=15)
    
    req = SyncRequest.query.filter(
        SyncRequest.device_id == device_id,
        SyncRequest.otp == otp,
        SyncRequest.is_approved == False,
        SyncRequest.timestamp >= cutoff
    ).first()
    
    if not req:
        return jsonify({'error': 'Invalid, expired, or already used OTP.'}), 400
        
    # Find the patient associated with this device
    patient = Patient.query.filter_by(device_id=device_id).first()
    if not patient:
        return jsonify({'error': 'No patient record matches this device. Register patient first.'}), 404
        
    try:
        patient.is_hospitalized = True
        patient.bed_number = bed_number
        req.is_approved = True
        
        db.session.commit()
        return jsonify({
            'message': 'Care continuity linked successfully.',
            'patient': patient.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# 6. AI Engine Insights
@app.route('/api/patients/<id>/insights', methods=['GET'])
def get_insights(id):
    patient = Patient.query.get(id)
    if not patient:
        return jsonify({'error': 'Patient not found.'}), 404
        
    # 1. Compute features
    features = ml_engine.compute_features(patient)
    
    # 2. Run risk level prediction model
    risk_code, risk_label = ml_engine.predict_risk(features)
    
    # 3. Analyze time-series fever pattern
    pattern_name, pattern_desc = ml_engine.analyze_fever_pattern(patient)
    
    # 4. Generate clinical guidance recommendations
    recs = ml_engine.generate_recommendations(patient, features, risk_label)
    
    # 5. Medication response evaluation
    meds_count = len(patient.medications)
    
    return jsonify({
        'features': features,
        'risk_code': risk_code,
        'risk_label': risk_label,
        'fever_pattern': {
            'name': pattern_name,
            'description': pattern_desc
        },
        'recommendations': recs,
        'medication_summary': {
            'count': meds_count,
            'average_temp_drop': features['temp_drop_after_medicine']
        }
    })

# 7. Staff Authentication (Register & Login)
@app.route('/api/staff/register', methods=['POST'])
def register_staff():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password') or not data.get('role') or not data.get('name'):
        return jsonify({'error': 'Name, Username, Password, and Role are required.'}), 400
        
    role = data['role'].lower()
    if role not in ['nurse', 'doctor']:
        return jsonify({'error': 'Invalid role. Must be nurse or doctor.'}), 400
        
    # Check if username is already registered
    existing = Staff.query.filter_by(username=data['username'].strip().lower()).first()
    if existing:
        return jsonify({'error': f"Username '{data['username']}' is already registered."}), 400
        
    staff = Staff(
        name=data['name'].strip(),
        username=data['username'].strip().lower(),
        password_hash=generate_password_hash(data['password']),
        role=role,
        department=data.get('department', '').strip()
    )
    
    try:
        db.session.add(staff)
        db.session.commit()
        return jsonify({'success': True, 'staff': staff.to_dict()}), 210
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/staff/login', methods=['POST'])
def login_staff():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password') or not data.get('role'):
        return jsonify({'error': 'Username, Password, and Role are required.'}), 400
        
    username = data['username'].strip().lower()
    password = data['password']
    role = data['role'].lower()
    
    staff = Staff.query.filter_by(username=username, role=role).first()
    if not staff or not check_password_hash(staff.password_hash, password):
        return jsonify({'error': 'Invalid username or password.'}), 401
        
    return jsonify({
        'success': True,
        'staff': staff.to_dict()
    })

# ==========================================
# BACKGROUND MQTT SUBSCRIBER
# ==========================================
def start_mqtt_client():
    try:
        import paho.mqtt.client as mqtt
    except ImportError:
        print("paho-mqtt not installed. Real-time MQTT listening disabled.")
        return
        
    def on_connect(client, userdata, flags, rc):
        print(f"Connected to HiveMQ Broker with code: {rc}")
        # Subscribe to telemetry channel for all devices
        client.subscribe("feverguard/+/telemetry")
        
    def on_message(client, userdata, msg):
        topic = msg.topic # feverguard/DEVICE_ID/telemetry
        parts = topic.split('/')
        if len(parts) >= 2:
            device_id = parts[1]
            try:
                payload = json.loads(msg.payload.decode('utf-8'))
                temperature = float(payload.get('temperature'))
                
                # We need app context to interact with SQLAlchemy in thread
                with app.app_context():
                    # Check if patient exists
                    patient = Patient.query.filter_by(device_id=device_id).first()
                    patient_id = patient.id if patient else None
                    
                    reading = TemperatureReading(
                        patient_id=patient_id,
                        device_id=device_id,
                        temperature=temperature
                    )
                    db.session.add(reading)
                    db.session.commit()
                    print(f"MQTT: Logged reading {temperature}°C for device {device_id}")
            except Exception as e:
                print(f"Error parsing MQTT message payload: {e}")

    # Start public HiveMQ client
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message
    
    try:
        client.connect("broker.hivemq.com", 1883, 60)
        client.loop_start()
    except Exception as e:
        print(f"Could not connect to MQTT Broker: {e}")

# Run MQTT listener in a separate background thread
mqtt_thread = threading.Thread(target=start_mqtt_client)
mqtt_thread.daemon = True
mqtt_thread.start()

if __name__ == '__main__':
    # Start REST server
    app.run(host='0.0.0.0', port=5000, debug=False)
