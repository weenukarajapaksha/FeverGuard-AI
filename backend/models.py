from datetime import datetime
from database import db
import uuid

def generate_uuid():
    return str(uuid.uuid4())

class Patient(db.Model):
    __tablename__ = 'patients'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    name = db.Column(db.String(100), nullable=False)
    age = db.Column(db.Integer, nullable=False)
    gender = db.Column(db.String(10), nullable=False)
    device_id = db.Column(db.String(50), unique=True, nullable=False) # The hardware device key
    travel_history = db.Column(db.Text, nullable=True)
    past_medical_history = db.Column(db.Text, nullable=True)
    
    # Hospital ward details
    is_hospitalized = db.Column(db.Boolean, default=False)
    bed_number = db.Column(db.String(20), nullable=True)
    password_hash = db.Column(db.String(200), nullable=True)
    
    # Relationships
    readings = db.relationship('TemperatureReading', backref='patient', lazy=True, cascade="all, delete-orphan")
    symptoms = db.relationship('SymptomLog', backref='patient', lazy=True, cascade="all, delete-orphan")
    medications = db.relationship('MedicationLog', backref='patient', lazy=True, cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'age': self.age,
            'gender': self.gender,
            'device_id': self.device_id,
            'travel_history': self.travel_history,
            'past_medical_history': self.past_medical_history,
            'is_hospitalized': self.is_hospitalized,
            'bed_number': self.bed_number
        }

class TemperatureReading(db.Model):
    __tablename__ = 'temperature_readings'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    patient_id = db.Column(db.String(36), db.ForeignKey('patients.id'), nullable=True)
    device_id = db.Column(db.String(50), nullable=False)
    temperature = db.Column(db.Float, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'device_id': self.device_id,
            'temperature': self.temperature,
            'timestamp': self.timestamp.isoformat() + 'Z'
        }

class SymptomLog(db.Model):
    __tablename__ = 'symptom_logs'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    patient_id = db.Column(db.String(36), db.ForeignKey('patients.id'), nullable=False)
    symptom_name = db.Column(db.String(100), nullable=False)
    severity = db.Column(db.String(20), nullable=False) # 'Mild', 'Moderate', 'Severe'
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'symptom_name': self.symptom_name,
            'severity': self.severity,
            'timestamp': self.timestamp.isoformat() + 'Z'
        }

class MedicationLog(db.Model):
    __tablename__ = 'medication_logs'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    patient_id = db.Column(db.String(36), db.ForeignKey('patients.id'), nullable=False)
    medicine_name = db.Column(db.String(100), nullable=False)
    dosage = db.Column(db.String(50), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'medicine_name': self.medicine_name,
            'dosage': self.dosage,
            'timestamp': self.timestamp.isoformat() + 'Z'
        }

class SyncRequest(db.Model):
    __tablename__ = 'sync_requests'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    device_id = db.Column(db.String(50), nullable=False)
    otp = db.Column(db.String(6), nullable=False)
    is_approved = db.Column(db.Boolean, default=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'otp': self.otp,
            'is_approved': self.is_approved,
            'timestamp': self.timestamp.isoformat() + 'Z'
        }

class Staff(db.Model):
    __tablename__ = 'staff'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    name = db.Column(db.String(100), nullable=False)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), nullable=False) # 'nurse' | 'doctor'
    department = db.Column(db.String(100), nullable=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'username': self.username,
            'role': self.role,
            'department': self.department
        }

