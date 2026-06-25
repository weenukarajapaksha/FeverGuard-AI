#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// Define Device Parameters
#define DEVICE_ID "FS-2026-0012"
#define MQTT_TOPIC "feverguard/FS-2026-0012/telemetry"

// Sensor and Pins Definitions
#define DHTPIN 4
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

// OLED Display Configuration
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// WiFi & MQTT Broker Configuration (HiveMQ Public Broker)
const char* ssid = "Wokwi-GUEST";
const char* password = "";
const char* mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;

WiFiClient espClient;
PubSubClient client(espClient);
unsigned long lastMsg = 0;

void setup_wifi() {
  delay(10);
  Serial.println("Connecting to WiFi...");
  
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("Connecting WiFi...");
  display.display();
  
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("\nWiFi connected.");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("Connecting MQTT...");
    display.display();
    
    if (client.connect(DEVICE_ID)) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void updateOLED(float temp, bool mqttOk) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  
  // Brand Header
  display.setCursor(0, 0);
  display.println("--- FEVERSENSE AI ---");
  
  // Live Vitals
  display.setCursor(0, 16);
  display.print("Temp: ");
  display.setTextSize(2);
  display.print(temp, 1);
  display.println(" C");
  
  display.setTextSize(1);
  // Status evaluation
  display.setCursor(0, 36);
  if (temp > 37.5) {
    display.println("ALERT: Active Fever!");
  } else {
    display.println("Status: Normal");
  }
  
  // WiFi & Broker Status
  display.setCursor(0, 52);
  display.print("WiFi: OK | ");
  display.println(mqttOk ? "MQTT: OK" : "MQTT: ERR");
  
  display.display();
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  
  // OLED Initialization
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { 
    Serial.println(F("SSD1306 allocation failed"));
    for(;;);
  }
  
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("FeverSense AI Booting...");
  display.display();
  delay(1000);
  
  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  unsigned long now = millis();
  if (now - lastMsg > 3000) {
    lastMsg = now;
    
    // Read temperature
    float temp = dht.readTemperature();
    
    // Check if reading is valid
    if (isnan(temp)) {
      Serial.println("Failed to read from DHT sensor!");
      return;
    }
    
    Serial.print("Publishing telemetry: ");
    Serial.print(temp);
    Serial.println(" C");
    
    // Build JSON Payload
    String payload = "{\"temperature\":" + String(temp, 2) + "}";
    
    // Publish to broker
    bool ok = client.publish(MQTT_TOPIC, payload.c_str());
    if (ok) {
      Serial.println("MQTT Publish Success!");
    } else {
      Serial.println("MQTT Publish Failed!");
    }
    
    // Update local display status
    updateOLED(temp, client.connected());
  }
}
