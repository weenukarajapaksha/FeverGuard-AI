import React, { useState, useEffect } from 'react';
import { 
  Activity, Users, Heart, ShieldAlert, LogIn, RefreshCw, PlusCircle, 
  Thermometer, Plus, Calendar, AlertTriangle, Pill, ClipboardList, CheckCircle, FileText 
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register ChartJS elements
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const API_BASE = 'http://127.0.0.1:5000/api';

function App() {
  const [role, setRole] = useState(null); // null | 'patient' | 'nurse' | 'doctor'
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [currentPatient, setCurrentPatient] = useState(null);
  
  // Patient state
  const [readings, setReadings] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [medications, setMedications] = useState([]);
  const [insights, setInsights] = useState(null);
  const [otpInfo, setOtpInfo] = useState(null);

  // Forms states
  const [patientForm, setPatientForm] = useState({
    name: '', age: '', gender: 'Male', device_id: '', password: '', travel_history: '', past_medical_history: ''
  });
  const [manualTemp, setManualTemp] = useState('38.2');
  const [symptomForm, setSymptomForm] = useState({ symptom_name: 'Fever', severity: 'Moderate' });
  const [medForm, setMedForm] = useState({ medicine_name: 'Paracetamol', dosage: '500mg' });
  const [syncForm, setSyncForm] = useState({ device_id: '', otp: '', bed_number: '' });

  // Status/feedback
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });

  // Login and authentication states
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginMode, setLoginMode] = useState('login'); // 'login' | 'register'
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  
  // Nurse & Doctor registration states
  const [nurseRegisterForm, setNurseRegisterForm] = useState({ name: '', username: '', password: '', department: 'Ward Station A' });
  const [doctorRegisterForm, setDoctorRegisterForm] = useState({ name: '', username: '', password: '', department: 'General Medicine' });

  const handleLogin = async (e) => {
    e.preventDefault();
    if (role === 'patient') {
      try {
        const res = await fetch(`${API_BASE}/patients/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            device_id: loginForm.username.trim(),
            password: loginForm.password
          })
        });
        const data = await res.json();
        if (res.ok) {
          setSelectedPatientId(data.patient.id);
          setIsLoggedIn(true);
          showStatus(`Welcome back, ${data.patient.name}!`);
          setLoginForm({ username: '', password: '' });
        } else {
          showStatus(data.error || "Login failed.", "error");
        }
      } catch (err) {
        showStatus("Network error during patient login.", "error");
      }
    } else {
      try {
        const res = await fetch(`${API_BASE}/staff/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: loginForm.username,
            password: loginForm.password,
            role: role
          })
        });
        const data = await res.json();
        if (res.ok) {
          setIsLoggedIn(true);
          showStatus(`Welcome back, ${data.staff.name}!`);
          setLoginForm({ username: '', password: '' });
        } else {
          showStatus(data.error || "Invalid credentials.", "error");
        }
      } catch (err) {
        showStatus("Network error during staff login.", "error");
      }
    }
  };

  const handleRegisterStaff = async (e) => {
    e.preventDefault();
    const form = role === 'nurse' ? nurseRegisterForm : doctorRegisterForm;
    try {
      const res = await fetch(`${API_BASE}/staff/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          username: form.username,
          password: form.password,
          role: role,
          department: form.department
        })
      });
      const data = await res.json();
      if (res.ok) {
        showStatus(`Staff profile registered successfully! You can now log in.`);
        setLoginMode('login');
        setLoginForm({ username: form.username, password: '' });
        setNurseRegisterForm({ name: '', username: '', password: '', department: 'Ward Station A' });
        setDoctorRegisterForm({ name: '', username: '', password: '', department: 'General Medicine' });
      } else {
        showStatus(data.error || "Staff registration failed.", "error");
      }
    } catch (err) {
      showStatus("Network error during staff registration.", "error");
    }
  };


  // Fetch all patients list
  const fetchPatients = async () => {
    try {
      const res = await fetch(`${API_BASE}/patients`);
      const data = await res.json();
      setPatients(data);
      if (data.length > 0 && !selectedPatientId) {
        setSelectedPatientId(data[0].id);
      }
    } catch (err) {
      console.error("Error fetching patients list:", err);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  // Fetch active patient records when selection changes (with 5-second polling for real-time updates)
  useEffect(() => {
    if (selectedPatientId) {
      // Initial fetch
      fetchPatientData(selectedPatientId);

      // Set up polling interval
      const interval = setInterval(() => {
        fetchPatientData(selectedPatientId);
      }, 5000);

      // Cleanup on unmount or selection change
      return () => clearInterval(interval);
    } else {
      setCurrentPatient(null);
      setReadings([]);
      setSymptoms([]);
      setMedications([]);
      setInsights(null);
      setOtpInfo(null);
    }
  }, [selectedPatientId]);

  const fetchPatientData = async (id) => {
    try {
      // Patient profile
      const resProfile = await fetch(`${API_BASE}/patients/${id}`);
      const profile = await resProfile.json();
      setCurrentPatient(profile);

      // Readings
      const resReadings = await fetch(`${API_BASE}/patients/${id}/readings`);
      const readingsData = await resReadings.json();
      setReadings(readingsData);

      // Symptoms
      const resSymptoms = await fetch(`${API_BASE}/patients/${id}/symptoms`);
      const symptomsData = await resSymptoms.json();
      setSymptoms(symptomsData);

      // Medications
      const resMeds = await fetch(`${API_BASE}/patients/${id}/medications`);
      const medsData = await resMeds.json();
      setMedications(medsData);

      // Insights (AI prediction + clinical pathways)
      const resInsights = await fetch(`${API_BASE}/patients/${id}/insights`);
      const insightsData = await resInsights.json();
      setInsights(insightsData);
    } catch (err) {
      console.error("Error fetching patient details:", err);
    }
  };

  const showStatus = (text, type = 'success') => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg({ text: '', type: '' }), 5000);
  };

  // Submit new patient registration
  const handleRegisterPatient = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patientForm)
      });
      const data = await res.json();
      if (res.ok) {
        showStatus('Patient profile created and logged in successfully!');
        setPatientForm({ name: '', age: '', gender: 'Male', device_id: '', password: '', travel_history: '', past_medical_history: '' });
        await fetchPatients();
        setSelectedPatientId(data.id);
        setIsLoggedIn(true);
      } else {
        showStatus(data.error || 'Registration failed.', 'error');
      }
    } catch (err) {
      showStatus('Network error creating patient profile.', 'error');
    }
  };

  // Log temperature manually
  const handleAddReading = async (e) => {
    e.preventDefault();
    if (!currentPatient) return;
    try {
      const res = await fetch(`${API_BASE}/readings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: currentPatient.device_id,
          temperature: parseFloat(manualTemp)
        })
      });
      if (res.ok) {
        showStatus(`Logged temperature reading of ${manualTemp}°C`);
        setManualTemp('37.5');
        fetchPatientData(currentPatient.id);
      }
    } catch (err) {
      showStatus('Error logging temperature reading.', 'error');
    }
  };

  // Log symptom
  const handleAddSymptom = async (e) => {
    e.preventDefault();
    if (!currentPatient) return;
    try {
      const res = await fetch(`${API_BASE}/patients/${currentPatient.id}/symptoms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(symptomForm)
      });
      if (res.ok) {
        showStatus(`Logged symptom: ${symptomForm.symptom_name}`);
        fetchPatientData(currentPatient.id);
      }
    } catch (err) {
      showStatus('Error logging symptom.', 'error');
    }
  };

  // Log medication
  const handleAddMedication = async (e) => {
    e.preventDefault();
    if (!currentPatient) return;
    try {
      const res = await fetch(`${API_BASE}/patients/${currentPatient.id}/medications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(medForm)
      });
      if (res.ok) {
        showStatus(`Logged medication: ${medForm.medicine_name}`);
        fetchPatientData(currentPatient.id);
      }
    } catch (err) {
      showStatus('Error logging medication.', 'error');
    }
  };

  // Request Sync OTP
  const handleRequestSync = async () => {
    if (!currentPatient) return;
    try {
      const res = await fetch(`${API_BASE}/sync/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: currentPatient.device_id })
      });
      const data = await res.json();
      if (res.ok) {
        setOtpInfo(data);
        showStatus('Generated Sync OTP Code.');
      }
    } catch (err) {
      showStatus('Error requesting sync code.', 'error');
    }
  };

  // Approve sync (Nurse ward link)
  const handleApproveSync = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/sync/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(syncForm)
      });
      const data = await res.json();
      if (res.ok) {
        showStatus(`Linked device ${syncForm.device_id} to Bed ${syncForm.bed_number} successfully!`);
        setSyncForm({ device_id: '', otp: '', bed_number: '' });
        await fetchPatients();
        if (currentPatient && currentPatient.device_id === syncForm.device_id) {
          fetchPatientData(currentPatient.id);
        }
      } else {
        showStatus(data.error || 'OTP sync failed.', 'error');
      }
    } catch (err) {
      showStatus('Error executing sync approval.', 'error');
    }
  };

  // Chart rendering parameters
  const getChartData = () => {
    const labels = readings.map(r => {
      const d = new Date(r.timestamp);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });
    
    // Core temperature line dataset
    const tempDataset = {
      label: 'Body Temperature (°C)',
      data: readings.map(r => r.temperature),
      borderColor: '#00f2fe',
      backgroundColor: 'rgba(0, 242, 254, 0.1)',
      borderWidth: 3,
      tension: 0.3,
      pointRadius: 4,
      pointBackgroundColor: '#00f2fe',
      fill: true
    };

    // Map each medication to its single closest temperature reading index to avoid duplicate dots
    const medDots = new Array(readings.length).fill(null);
    medications.forEach(m => {
      const mTime = new Date(m.timestamp).getTime();
      let closestIdx = -1;
      let minDiff = Infinity;
      
      readings.forEach((r, idx) => {
        const rTime = new Date(r.timestamp).getTime();
        const diff = Math.abs(rTime - mTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });
      
      // Overlay the indicator if the closest reading is within a 15-minute window
      if (closestIdx !== -1 && minDiff <= 15 * 60 * 1000) {
        medDots[closestIdx] = readings[closestIdx].temperature;
      }
    });

    const medDataset = {
      label: 'Medication Given',
      data: medDots,
      borderColor: '#ef4444',
      backgroundColor: '#ef4444',
      borderWidth: 0,
      pointRadius: 8,
      pointStyle: 'rectRot',
      showLine: false
    };

    return {
      labels,
      datasets: [tempDataset, medDataset]
    };
  };

  const getMinY = () => {
    if (readings.length === 0) return 35.5;
    const temps = readings.map(r => r.temperature);
    const minTemp = Math.min(...temps);
    return minTemp < 35.5 ? Math.floor(minTemp) - 1 : 35.5;
  };

  const getMaxY = () => {
    if (readings.length === 0) return 42.0;
    const temps = readings.map(r => r.temperature);
    const maxTemp = Math.max(...temps);
    return maxTemp > 42.0 ? Math.ceil(maxTemp) + 1 : 42.0;
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#94a3b8', font: { family: 'Outfit' } }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            if (context.dataset.label === 'Medication Given') {
              return '💊 Medication administered here';
            }
            return `${context.parsed.y}°C`;
          }
        }
      }
    },
    scales: {
      y: {
        min: getMinY(),
        max: getMaxY(),
        ticks: { color: '#94a3b8', font: { family: 'Outfit' } },
        grid: { color: 'rgba(255,255,255,0.05)' }
      },
      x: {
        ticks: { color: '#94a3b8', font: { family: 'Outfit' } },
        grid: { color: 'rgba(255,255,255,0.05)' }
      }
    }
  };

  if (!isLoggedIn) {
    if (role === null) {
      return (
        <div className="login-wrapper">
          <div className="gateway-container">
            <div className="gateway-header">
              <div className="gateway-badge">System Portal Gateway</div>
              <h1 className="gateway-title">FeverGuard</h1>
              <p className="gateway-subtitle">Intelligent Clinical Decision-Support & IoT Telemetry for Pyrexia of Unknown Origin</p>
            </div>
            
            <div className="gateway-grid">
              <div className="gateway-card patient-card-select" onClick={() => { setRole('patient'); setLoginMode('login'); setLoginForm({ username: '', password: '' }); }}>
                <div className="icon-container">
                  <Heart size={36} />
                </div>
                <h3 className="card-role-title">Customer / Patient</h3>
                <p className="card-role-desc">Access home monitoring logs, view active vitals telemetry, log medication intakes, and generate hospital sync codes.</p>
              </div>

              <div className="gateway-card nurse-card-select" onClick={() => { setRole('nurse'); setLoginMode('login'); setLoginForm({ username: '', password: '' }); }}>
                <div className="icon-container">
                  <Users size={36} />
                </div>
                <h3 className="card-role-title">Nurse Ward Station</h3>
                <p className="card-role-desc">Manage ward bed occupancy, sync continuous home telemetry records to ward files via patient OTP verification.</p>
              </div>

              <div className="gateway-card doctor-card-select" onClick={() => { setRole('doctor'); setLoginMode('login'); setLoginForm({ username: '', password: '' }); }}>
                <div className="icon-container">
                  <Activity size={36} />
                </div>
                <h3 className="card-role-title">Clinician Doctor Portal</h3>
                <p className="card-role-desc">Evaluate ML-based clinical risk assessments, analyze time-series fever patterns, and check automated recommendations.</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    const themeClass = role === 'patient' ? 'patient-theme' : role === 'nurse' ? 'nurse-theme' : 'doctor-theme';
    const logoBg = role === 'patient' ? 'patient-logo-bg' : role === 'nurse' ? 'nurse-logo-bg' : 'doctor-logo-bg';
    const roleLabel = role === 'patient' ? 'Patient Portal' : role === 'nurse' ? 'Nurse Ward Station' : 'Clinical Doctor Portal';

    return (
      <div className="login-wrapper">
        <div className={`login-card ${themeClass}`}>
          <button className="login-back-btn" onClick={() => { setRole(null); setLoginForm({ username: '', password: '' }); setLoginMode('login'); }}>
            &larr; Back to Portal Gateway
          </button>
          
          <div className="login-header">
            <div className={`login-header-logo ${logoBg}`}>
              {role === 'patient' ? 'PT' : role === 'nurse' ? 'NS' : 'MD'}
            </div>
            <h1 className="login-title">FeverGuard</h1>
            <p className="login-subtitle">{roleLabel}</p>
          </div>

          {statusMsg.text && (
            <div style={{
              background: statusMsg.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              border: `1px solid ${statusMsg.type === 'error' ? '#ef4444' : '#10b981'}`,
              borderRadius: '12px',
              padding: '0.85rem 1.25rem',
              fontSize: '0.875rem',
              color: statusMsg.type === 'error' ? '#fca5a5' : '#a7f3d0',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <ShieldAlert size={16} />
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* ================= PATIENT PORTAL FLOW ================= */}
          {role === 'patient' && loginMode === 'login' && (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">Device Registration ID</label>
                <input 
                  type="text" className="form-input theme-input" required placeholder="e.g. FS-2026-0012"
                  value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  type="password" className="form-input theme-input" placeholder="Enter password (optional for demo)"
                  value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                />
              </div>
              <button type="submit" className="btn-primary theme-btn" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}>
                <LogIn size={18} />
                <span>Access Vitals Dashboard</span>
              </button>
              <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Don't have a registered device? </span>
                <span 
                  style={{ color: 'var(--primary-color)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => setLoginMode('register')}
                >
                  Register Profile
                </span>
              </div>
              <code className="login-help-text">
                💡 Enter your device ID (e.g. <code>FS-2026-0012</code>) to access. If you haven't created a patient profile yet, click "Register Profile" above.
              </code>
            </form>
          )}

          {role === 'patient' && loginMode === 'register' && (
            <form onSubmit={handleRegisterPatient} style={{ maxHeight: '380px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input 
                  type="text" className="form-input theme-input" required placeholder="e.g. John Silva"
                  value={patientForm.name} onChange={(e) => setPatientForm({...patientForm, name: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Age</label>
                <input 
                  type="number" className="form-input theme-input" required placeholder="e.g. 29"
                  value={patientForm.age} onChange={(e) => setPatientForm({...patientForm, age: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Gender</label>
                <select 
                  className="form-select theme-input"
                  value={patientForm.gender} onChange={(e) => setPatientForm({...patientForm, gender: e.target.value})}
                >
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Device Registration ID</label>
                <input 
                  type="text" className="form-input theme-input" required placeholder="e.g. FS-2026-0012"
                  value={patientForm.device_id} onChange={(e) => setPatientForm({...patientForm, device_id: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  type="password" className="form-input theme-input" required placeholder="Choose a password"
                  value={patientForm.password} onChange={(e) => setPatientForm({...patientForm, password: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Travel History (Last 14 Days)</label>
                <textarea 
                  className="form-textarea theme-input" placeholder="e.g. Returned from domestic travel to Anuradhapura..."
                  value={patientForm.travel_history} onChange={(e) => setPatientForm({...patientForm, travel_history: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Past Medical & Surgical History</label>
                <textarea 
                  className="form-textarea theme-input" placeholder="e.g. Had dengue fever 3 years ago..."
                  value={patientForm.past_medical_history} onChange={(e) => setPatientForm({...patientForm, past_medical_history: e.target.value})}
                />
              </div>
              <button type="submit" className="btn-primary theme-btn" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}>
                <PlusCircle size={18} />
                <span>Register & Access Portal</span>
              </button>
              <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Already have a profile? </span>
                <span 
                  style={{ color: 'var(--primary-color)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => setLoginMode('login')}
                >
                  Log In
                </span>
              </div>
            </form>
          )}

          {/* ================= STAFF (NURSE / DOCTOR) FLOW ================= */}
          {role !== 'patient' && loginMode === 'login' && (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">Username / Staff ID</label>
                <input 
                  type="text" className="form-input theme-input" required placeholder={`e.g. ${role}`}
                  value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  type="password" className="form-input theme-input" required placeholder="Enter password"
                  value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                />
              </div>
              <button type="submit" className="btn-primary theme-btn" style={{ width: '100%', justifyContent: 'center', marginTop: '1.5rem' }}>
                <LogIn size={18} />
                <span>Log In</span>
              </button>
              <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>New to the ward? </span>
                <span 
                  style={{ color: role === 'nurse' ? '#10b981' : '#8b5cf6', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => setLoginMode('register')}
                >
                  Register Profile
                </span>
              </div>
              <code className="login-help-text">
                💡 Demo Credentials:<br/>
                Username: <code>{role}</code> | Password: <code>password</code>
              </code>
            </form>
          )}

          {role !== 'patient' && loginMode === 'register' && (
            <form onSubmit={handleRegisterStaff}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input 
                  type="text" className="form-input theme-input" required placeholder="e.g. Dr. Sarah Connor"
                  value={role === 'nurse' ? nurseRegisterForm.name : doctorRegisterForm.name}
                  onChange={(e) => {
                    if (role === 'nurse') setNurseRegisterForm({ ...nurseRegisterForm, name: e.target.value });
                    else setDoctorRegisterForm({ ...doctorRegisterForm, name: e.target.value });
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Username / Login ID</label>
                <input 
                  type="text" className="form-input theme-input" required placeholder="Choose a username"
                  value={role === 'nurse' ? nurseRegisterForm.username : doctorRegisterForm.username}
                  onChange={(e) => {
                    if (role === 'nurse') setNurseRegisterForm({ ...nurseRegisterForm, username: e.target.value });
                    else setDoctorRegisterForm({ ...doctorRegisterForm, username: e.target.value });
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  type="password" className="form-input theme-input" required placeholder="Choose a password"
                  value={role === 'nurse' ? nurseRegisterForm.password : doctorRegisterForm.password}
                  onChange={(e) => {
                    if (role === 'nurse') setNurseRegisterForm({ ...nurseRegisterForm, password: e.target.value });
                    else setDoctorRegisterForm({ ...doctorRegisterForm, password: e.target.value });
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{role === 'nurse' ? 'Assigned Ward Station' : 'Clinical Specialty'}</label>
                <input 
                  type="text" className="form-input theme-input" required placeholder={role === 'nurse' ? 'e.g. Ward Station A' : 'e.g. Infectious Diseases'}
                  value={role === 'nurse' ? nurseRegisterForm.department : doctorRegisterForm.department}
                  onChange={(e) => {
                    if (role === 'nurse') setNurseRegisterForm({ ...nurseRegisterForm, department: e.target.value });
                    else setDoctorRegisterForm({ ...doctorRegisterForm, department: e.target.value });
                  }}
                />
              </div>
              <button type="submit" className="btn-primary theme-btn" style={{ width: '100%', justifyContent: 'center', marginTop: '1.5rem' }}>
                <PlusCircle size={18} />
                <span>Register Staff Account</span>
              </button>
              <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Already have a profile? </span>
                <span 
                  style={{ color: role === 'nurse' ? '#10b981' : '#8b5cf6', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => setLoginMode('login')}
                >
                  Log In
                </span>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <div className="sidebar">
        <div className="brand">
          <div className="brand-icon">FG</div>
          <span className="brand-name">FeverGuard</span>
        </div>
        
        {/* User Card inside Sidebar */}
        <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--card-border)', marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>AUTHENTICATED AS</div>
          <div style={{ fontWeight: 600, color: 'var(--primary-color)', fontSize: '1rem', marginTop: '0.25rem' }}>
            {role === 'patient' && currentPatient ? currentPatient.name : role === 'nurse' ? 'Staff Nurse' : 'Clinical Doctor'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {role === 'patient' && currentPatient ? `Device: ${currentPatient.device_id}` : role === 'nurse' ? 'Ward Station' : 'ID: doc01'}
          </div>
        </div>

        <div className="nav-links">
          {role === 'patient' && (
            <div className="nav-link active">
              <Heart size={20} />
              <span>Patient Portal</span>
            </div>
          )}
          
          {role === 'nurse' && (
            <div className="nav-link active">
              <Users size={20} />
              <span>Nurse Station</span>
            </div>
          )}
          
          {role === 'doctor' && (
            <div className="nav-link active">
              <Activity size={20} />
              <span>Doctor Insights</span>
            </div>
          )}
        </div>

        {/* Sign Out Button */}
        <div 
          className="logout-button"
          onClick={() => {
            setIsLoggedIn(false);
            setCurrentPatient(null);
            setSelectedPatientId('');
            setOtpInfo(null);
            showStatus("Logged out successfully.");
          }}
        >
          <LogIn size={20} style={{ transform: 'rotate(180deg)' }} />
          <span>Sign Out</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="main-content">
        {/* Top Header */}
        <header className="top-header">
          <div className="patient-selector-wrapper">
            {role !== 'patient' && patients.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Active Case:</span>
                <select 
                  className="form-select" 
                  style={{ width: '220px', padding: '0.4rem 1rem' }}
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                >
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.is_hospitalized ? `(Bed ${p.bed_number})` : '(Home)'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="role-badge">
            <span className="role-dot"></span>
            <span>
              {role === 'patient' && 'Patient Mode'}
              {role === 'nurse' && 'Nurse Station'}
              {role === 'doctor' && 'Clinical View'}
            </span>
          </div>
        </header>

        {/* Feedback Alert banner */}
        {statusMsg.text && (
          <div style={{
            background: statusMsg.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            borderBottom: `1px solid ${statusMsg.type === 'error' ? '#ef4444' : '#10b981'}`,
            padding: '1rem 3rem',
            fontSize: '0.925rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: statusMsg.type === 'error' ? '#fca5a5' : '#a7f3d0'
          }}>
            <ShieldAlert size={18} />
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Dashboard Panels */}
        <main className="dashboard-body">
          {/* ======================================= */}
          {/* ROLE: PATIENT DASHBOARD                 */}
          {/* ======================================= */}
          {role === 'patient' && (
            <div>
              <div className="welcome-section">
                <h1 className="welcome-title">FeverGuard Home</h1>
                <p className="welcome-subtitle">Log your daily temperature readings, symptoms, and prepare details for doctor visits.</p>
              </div>

              {/* Fever Chart display */}
              <div className="glass-panel">
                <div className="panel-header">
                  <span className="panel-title">Automated Fever & Medication Response Chart</span>
                  <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>💊 indicates drug administration points</span>
                </div>
                {readings.length > 0 ? (
                  <div style={{ height: '300px', position: 'relative' }}>
                    <Line data={getChartData()} options={chartOptions} />
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    <Thermometer size={36} style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }} />
                    <div>No temperature log data available. Start logging or connect your simulator.</div>
                  </div>
                )}
              </div>

              {/* AI Health Insights Panel */}
              {insights && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2.5rem' }}>
                  {/* Fever Pattern & Guidance */}
                  <div className="glass-panel" style={{ marginBottom: 0 }}>
                    <div className="panel-header">
                      <span className="panel-title">AI Fever Pattern Analysis</span>
                    </div>
                    <div className="insight-card normal" style={{ marginBottom: '1.25rem' }}>
                      <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Detected Pattern</span>
                      <h3 style={{ fontSize: '1.35rem', fontWeight: 600, color: '#fff' }}>
                        {insights.fever_pattern.name}
                      </h3>
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                      {insights.fever_pattern.description}
                    </p>
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.25rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      <strong>Guidance:</strong> {insights.recommendations.guidance}
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className="glass-panel" style={{ marginBottom: 0 }}>
                    <div className="panel-header">
                      <span className="panel-title">Clinical Recommendations</span>
                    </div>
                    
                    <div style={{ marginBottom: '1.25rem' }}>
                      <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Suggested Specialties</span>
                      {insights.recommendations.specialties.length > 0 ? (
                        <ul className="list-styled">
                          {insights.recommendations.specialties.map((s, idx) => (
                            <li key={idx} style={{ color: '#fff', fontWeight: 500, fontSize: '0.9rem' }}>{s}</li>
                          ))}
                        </ul>
                      ) : (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No high priority specialty referral indicators.</div>
                      )}
                    </div>
                    
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.25rem' }}>
                      <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Recommended Lab Investigations</span>
                      {insights.recommendations.investigations.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {insights.recommendations.investigations.map((i, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                              <input type="checkbox" className="form-checkbox" style={{ accentColor: 'var(--primary-color)', width: '16px', height: '16px' }} readOnly checked />
                              <span>{i}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>General vital charts stable. Standard blood baseline check if fever persists.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="two-cols">
                {/* Left side actions and forms */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                  
                  {currentPatient && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                      {/* Log Temperature */}
                      <div className="glass-panel" style={{ marginBottom: 0 }}>
                        <div className="panel-header">
                          <span className="panel-title">Log Temperature</span>
                        </div>
                        <form onSubmit={handleAddReading}>
                          <div className="form-group">
                            <label className="form-label">Temperature Reading (°C)</label>
                            <input 
                              type="number" step="0.1" className="form-input" required
                              value={manualTemp} onChange={(e) => setManualTemp(e.target.value)}
                            />
                          </div>
                          <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                            <Thermometer size={18} />
                            <span>Log Reading</span>
                          </button>
                        </form>
                      </div>

                      {/* Log Symptom */}
                      <div className="glass-panel" style={{ marginBottom: 0 }}>
                        <div className="panel-header">
                          <span className="panel-title">Log Clinical Symptom</span>
                        </div>
                        <form onSubmit={handleAddSymptom}>
                          <div className="form-group">
                            <label className="form-label">Symptom Name</label>
                            <select 
                              className="form-select"
                              value={symptomForm.symptom_name} onChange={(e) => setSymptomForm({...symptomForm, symptom_name: e.target.value})}
                            >
                              <option>Fever</option>
                              <option>Joint Pain</option>
                              <option>Muscle Pain</option>
                              <option>Headache</option>
                              <option>Rash</option>
                              <option>Painful Urination</option>
                              <option>Cough</option>
                              <option>Shortness of Breath</option>
                              <option>Sore Throat</option>
                              <option>Vomiting</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Severity</label>
                            <select 
                              className="form-select"
                              value={symptomForm.severity} onChange={(e) => setSymptomForm({...symptomForm, severity: e.target.value})}
                            >
                              <option>Mild</option>
                              <option>Moderate</option>
                              <option>Severe</option>
                            </select>
                          </div>
                          <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                            <Plus size={18} />
                            <span>Log Symptom</span>
                          </button>
                        </form>
                      </div>
                    </div>
                  )}

                  {/* Log Medication */}
                  {currentPatient && (
                    <div className="glass-panel">
                      <div className="panel-header">
                        <span className="panel-title">Log Medicine Intake (Drug Chart)</span>
                      </div>
                      <form onSubmit={handleAddMedication} style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-end' }}>
                        <div className="form-group" style={{ flexGrow: 1, marginBottom: 0 }}>
                          <label className="form-label">Medicine Name</label>
                          <input 
                            type="text" className="form-input" required placeholder="e.g. Paracetamol"
                            value={medForm.medicine_name} onChange={(e) => setMedForm({...medForm, medicine_name: e.target.value})}
                          />
                        </div>
                        <div className="form-group" style={{ width: '180px', marginBottom: 0 }}>
                          <label className="form-label">Dosage</label>
                          <input 
                            type="text" className="form-input" required placeholder="e.g. 500mg"
                            value={medForm.dosage} onChange={(e) => setMedForm({...medForm, dosage: e.target.value})}
                          />
                        </div>
                        <button type="submit" className="btn-primary">
                          <Pill size={18} />
                          <span>Log Dose</span>
                        </button>
                      </form>
                    </div>
                  )}
                </div>

                {/* Right side summaries & OTP Care continuity */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                  {currentPatient ? (
                    <>
                      <div className="glass-panel" style={{ border: '1px solid rgba(0, 242, 254, 0.2)' }}>
                        <div className="panel-header">
                          <span className="panel-title" style={{ color: 'var(--primary-color)' }}>Care Continuity Link</span>
                        </div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                          If you are admitted to a hospital, show the nurse this OTP code. They will link your home data history to their records.
                        </p>
                        
                        {otpInfo ? (
                          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', marginBottom: '1rem' }}>
                            <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Your Sync OTP Code</div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 700, letterSpacing: '8px', color: 'var(--primary-color)' }}>{otpInfo.otp}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Expires in 15 minutes</div>
                          </div>
                        ) : (
                          <button onClick={handleRequestSync} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                            <RefreshCw size={18} />
                            <span>Generate Sync Code</span>
                          </button>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginTop: '1rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Device ID:</span>
                          <span style={{ fontWeight: 600 }}>{currentPatient.device_id}</span>
                        </div>
                      </div>

                      {/* Display live telemetry metrics */}
                      <div className="glass-panel">
                        <div className="panel-header">
                          <span className="panel-title">Active Health Card</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.75rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Fever Status:</span>
                            {readings.length > 0 ? (
                              readings[readings.length-1].temperature > 37.5 ? (
                                <span className="badge badge-severe">Active Fever</span>
                              ) : (
                                <span className="badge badge-normal">Apyrexial</span>
                              )
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>No Readings</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.75rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Last Temp:</span>
                            <span style={{ fontWeight: 600 }}>{readings.length > 0 ? `${readings[readings.length-1].temperature}°C` : 'N/A'}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.75rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Registered Meds:</span>
                            <span style={{ fontWeight: 600 }}>{medications.length} times</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Symptoms Active:</span>
                            <span style={{ fontWeight: 600 }}>{symptoms.length} symptoms</span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
                      <AlertTriangle size={48} style={{ color: 'var(--status-mild)', marginBottom: '1rem' }} />
                      <h3>No Patient Profile Active</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                        Error mapping credentials to patient profile. Please contact clinical administrator.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ======================================= */}
          {/* ROLE: NURSE STATION DASHBOARD           */}
          {/* ======================================= */}
          {role === 'nurse' && (
            <div>
              <div className="welcome-section">
                <h1 className="welcome-title">Nurse Station</h1>
                <p className="welcome-subtitle">Manage admitted patient ward locations and sync continuous home telemetry records to their files.</p>
              </div>

              {/* Action grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2.5rem', marginBottom: '2.5rem' }}>
                
                {/* OTP Sync linkage form */}
                <div className="glass-panel" style={{ borderLeft: '4px solid var(--primary-color)' }}>
                  <div className="panel-header">
                    <span className="panel-title">Link Home Care History (Sync)</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                    Retrieve the patient's continuous fever monitoring data, travel logs, and medication records logged prior to admission.
                  </p>
                  <form onSubmit={handleApproveSync}>
                    <div className="form-group">
                      <label className="form-label">Device Registration Number</label>
                      <input 
                        type="text" className="form-input" required placeholder="e.g. FS-2026-X"
                        value={syncForm.device_id} onChange={(e) => setSyncForm({...syncForm, device_id: e.target.value})}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Patient Approval OTP Code</label>
                      <input 
                        type="text" className="form-input" required placeholder="6-Digit OTP"
                        value={syncForm.otp} onChange={(e) => setSyncForm({...syncForm, otp: e.target.value})}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Assign Bed / Ward Number</label>
                      <input 
                        type="text" className="form-input" required placeholder="e.g. Ward 2, Bed 14"
                        value={syncForm.bed_number} onChange={(e) => setSyncForm({...syncForm, bed_number: e.target.value})}
                      />
                    </div>
                    <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                      <RefreshCw size={18} />
                      <span>Sync Patient Records</span>
                    </button>
                  </form>
                </div>

                {/* Ward List */}
                <div className="glass-panel">
                  <div className="panel-header">
                    <span className="panel-title">Ward Occupancy Dashboard</span>
                    <div className="live-indicator">
                      <span className="live-pulse"></span>
                      <span>Real-time Telemetry</span>
                    </div>
                  </div>

                  {patients.filter(p => p.is_hospitalized).length > 0 ? (
                    <div className="patient-list">
                      {patients.filter(p => p.is_hospitalized).map(p => {
                        // Find latest reading if exists
                        return (
                          <div 
                            key={p.id} className="patient-card" 
                            style={{
                              borderColor: selectedPatientId === p.id ? 'var(--primary-color)' : 'var(--card-border)',
                              background: selectedPatientId === p.id ? 'rgba(0, 242, 254, 0.03)' : 'var(--card-bg)'
                            }}
                            onClick={() => setSelectedPatientId(p.id)}
                          >
                            <div className="patient-info">
                              <div>
                                <div className="patient-name">{p.name}</div>
                                <div className="patient-meta">Age: {p.age} | {p.gender}</div>
                              </div>
                              <span className="badge badge-normal" style={{ background: 'rgba(255,255,255,0.04)', color: '#fff' }}>
                                Bed: {p.bed_number}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '0.85rem', fontSize: '0.875rem' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Device: {p.device_id}</span>
                              <span style={{ 
                                fontWeight: 700, 
                                fontSize: '1.15rem', 
                                color: selectedPatientId === p.id && readings.length > 0 ? (readings[readings.length-1].temperature > 38.5 ? '#ef4444' : '#10b981') : '#00f2fe'
                              }}>
                                {selectedPatientId === p.id && readings.length > 0 ? `${readings[readings.length-1].temperature}°C` : 'Telemetry Connected'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                      <Users size={36} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                      <div>No hospitalized patients registered in this ward yet.</div>
                      <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Use the sync form on the left to link a patient from home monitoring to the ward.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ======================================= */}
          {/* ROLE: DOCTOR CLINICAL DASHBOARD          */}
          {/* ======================================= */}
          {role === 'doctor' && (
            <div>
              <div className="welcome-section">
                <h1 className="welcome-title">Doctor Decision Support</h1>
                <p className="welcome-subtitle">Correlate time-series temperature fluctuations, symptom logs, drug charting response, and evaluate ML-based clinical recommendations.</p>
              </div>

              {currentPatient ? (
                <div className="two-cols">
                  {/* Left Column: Profile, Time-Series Graph, logs */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                    
                    {/* Patient Summary Header Card */}
                    <div className="glass-panel" style={{ marginBottom: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>{currentPatient.name}</h2>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', display: 'flex', gap: '1.5rem' }}>
                            <span>Age: <strong>{currentPatient.age} years</strong></span>
                            <span>Gender: <strong>{currentPatient.gender}</strong></span>
                            {currentPatient.is_hospitalized ? (
                              <span style={{ color: 'var(--primary-color)' }}>Location: <strong>Bed {currentPatient.bed_number}</strong></span>
                            ) : (
                              <span style={{ color: 'var(--status-mild)' }}>Status: <strong>Home Monitoring</strong></span>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)', display: 'block' }}>DEVICE REGISTRATION</span>
                          <code style={{ fontSize: '1rem', color: '#fff', background: 'rgba(255,255,255,0.03)', padding: '0.25rem 0.5rem', borderRadius: '6px' }}>
                            {currentPatient.device_id}
                          </code>
                        </div>
                      </div>

                      {/* Travel & Past medical history display */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '1.5rem', paddingTop: '1.25rem', fontSize: '0.875rem' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Travel History (14 Days)</span>
                          <p style={{ color: currentPatient.travel_history ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {currentPatient.travel_history || 'No recent domestic or international travel logged.'}
                          </p>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Past Medical / Surgical History</span>
                          <p style={{ color: currentPatient.past_medical_history ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {currentPatient.past_medical_history || 'No prior medical conditions or chronic illnesses recorded.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Time series fever chart */}
                    <div className="glass-panel" style={{ marginBottom: 0 }}>
                      <div className="panel-header">
                        <span className="panel-title">Automated time-series Fever & Medication Response Chart</span>
                        <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>💊 indicates drug administration points</span>
                      </div>
                      
                      {readings.length > 0 ? (
                        <div style={{ height: '350px', position: 'relative' }}>
                          <Line data={getChartData()} options={chartOptions} />
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                          <Thermometer size={36} style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }} />
                          <div>No temperature log data available for this case.</div>
                          <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                            Ensure device simulator is active or log readings on the patient page.
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Timeline logs */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                      
                      {/* Symptoms Log */}
                      <div className="glass-panel" style={{ marginBottom: 0 }}>
                        <div className="panel-header">
                          <span className="panel-title">Symptom Log Timeline</span>
                        </div>
                        
                        {symptoms.length > 0 ? (
                          <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                            <table className="clinical-table">
                              <thead>
                                <tr>
                                  <th>Symptom</th>
                                  <th>Severity</th>
                                  <th>Logged At</th>
                                </tr>
                              </thead>
                              <tbody>
                                {symptoms.map(s => {
                                  const d = new Date(s.timestamp);
                                  return (
                                    <tr key={s.id}>
                                      <td style={{ fontWeight: 500 }}>{s.symptom_name}</td>
                                      <td>
                                        <span className={`badge ${
                                          s.severity === 'Severe' ? 'badge-severe' : s.severity === 'Moderate' ? 'badge-mild' : 'badge-normal'
                                        }`}>{s.severity}</span>
                                      </td>
                                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem', fontSize: '0.875rem' }}>
                            No symptoms logged for this clinical profile.
                          </div>
                        )}
                      </div>

                      {/* Drug log charting */}
                      <div className="glass-panel" style={{ marginBottom: 0 }}>
                        <div className="panel-header">
                          <span className="panel-title">Drug Administration Record</span>
                        </div>
                        
                        {medications.length > 0 ? (
                          <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                            <table className="clinical-table">
                              <thead>
                                <tr>
                                  <th>Medication</th>
                                  <th>Dosage</th>
                                  <th>Given At</th>
                                </tr>
                              </thead>
                              <tbody>
                                {medications.map(m => {
                                  const d = new Date(m.timestamp);
                                  return (
                                    <tr key={m.id}>
                                      <td style={{ fontWeight: 500 }}>{m.medicine_name}</td>
                                      <td><code>{m.dosage}</code></td>
                                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem', fontSize: '0.875rem' }}>
                            No drug charting records logged.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: AI Predictions & Recommendations */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                    
                    {insights ? (
                      <>
                        {/* Risk classification panel */}
                        <div className="glass-panel" style={{ paddingBottom: '1.5rem' }}>
                          <div className="panel-header">
                            <span className="panel-title">Clinical Risk Assessment</span>
                          </div>
                          
                          <div className={`insight-card ${
                            insights.risk_label === 'High Risk' ? 'severe' : insights.risk_label === 'Moderate Risk' ? 'mild' : 'normal'
                          }`} style={{ marginBottom: '1.5rem' }}>
                            <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>AI PREDICTED RISK LEVEL</span>
                            <h3 style={{
                              fontSize: '2rem',
                              fontWeight: 700,
                              color: insights.risk_label === 'High Risk' ? 'var(--status-severe)' : insights.risk_label === 'Moderate Risk' ? 'var(--status-mild)' : 'var(--status-normal)'
                            }}>{insights.risk_label}</h3>
                          </div>
                          
                          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                            {insights.recommendations.guidance}
                          </p>

                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
                            <div>
                              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Max Temperature:</span>
                              <strong style={{ fontSize: '1rem' }}>{insights.features.max_temp}°C</strong>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Fever Duration (24h):</span>
                              <strong style={{ fontSize: '1rem' }}>{insights.features.fever_hours} hrs</strong>
                            </div>
                          </div>
                        </div>

                        {/* Fever pattern classifier results */}
                        <div className="glass-panel">
                          <div className="panel-header">
                            <span className="panel-title">Fever Pattern Analysis</span>
                          </div>
                          <div className="insight-card normal">
                            <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>DETECTED SPECIES PATTERN</span>
                            <h3 style={{ fontSize: '1.35rem', fontWeight: 600, color: '#fff' }}>
                              {insights.fever_pattern.name}
                            </h3>
                          </div>
                          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            {insights.fever_pattern.description}
                          </p>
                        </div>

                        {/* Clinical Decision support list (referrals, tests) */}
                        <div className="glass-panel">
                          <div className="panel-header">
                            <span className="panel-title">Clinical Recommendations</span>
                          </div>
                          
                          <div style={{ marginBottom: '1.5rem' }}>
                            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Suggested Specialties</span>
                            {insights.recommendations.specialties.length > 0 ? (
                              <ul className="list-styled">
                                {insights.recommendations.specialties.map((s, idx) => (
                                  <li key={idx} style={{ color: '#fff', fontWeight: 500 }}>{s}</li>
                                ))}
                              </ul>
                            ) : (
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No high priority specialty referral indicators.</div>
                            )}
                          </div>
                          
                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.25rem' }}>
                            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Recommended Lab Investigations</span>
                            {insights.recommendations.investigations.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {insights.recommendations.investigations.map((i, idx) => (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem' }}>
                                    <input type="checkbox" className="form-checkbox" style={{ accentColor: 'var(--primary-color)', width: '16px', height: '16px' }} />
                                    <span>{i}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>General vital charts stable. Standard blood baseline check if fever persists.</div>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
                        <RefreshCw size={24} style={{ color: 'var(--text-muted)', animation: 'spin 2s infinite linear' }} />
                        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Computing AI risk and clinical insights...</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem' }}>
                  <Users size={48} style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }} />
                  <h3>No Active Ward Case Selected</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.5rem', maxWidth: '450px', marginLeft: 'auto', marginRight: 'auto' }}>
                    Select an active clinical patient profile using the dropdown menu in the top left header bar to populate charts and insights.
                  </p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
