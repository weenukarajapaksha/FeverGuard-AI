#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "OneWireESP32.h"
#include <WiFi.h>
#include <HTTPClient.h>


const char* ssid = "Galaxy A036ef5";
const char* password = "texj8692";

const char* serverURL =
"http://192.168.249.143:5000/api/readings";

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 32

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// ---------------- DS18B20 ----------------
#define ONE_WIRE_PIN 4
#define MAX_DEVS 1

OneWire32 ds(ONE_WIRE_PIN);

uint64_t addr[MAX_DEVS];
float temperature = 0;

void setup() {

  Serial.begin(115200);

  WiFi.begin(ssid, password);

    Serial.print("Connecting");

    while (WiFi.status() != WL_CONNECTED) {

        delay(500);
        Serial.print(".");
    }

    Serial.println();
    Serial.println("WiFi Connected");
    Serial.println(WiFi.localIP());

  Wire.begin(21, 22);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED not found");
    while (1);
  }

  display.clearDisplay();
  display.setTextColor(WHITE);
  display.setTextSize(1);

  display.setCursor(15,10);
  display.println("FeverGuard AI");
  display.display();

  delay(2000);

  uint8_t devices = ds.search(addr, MAX_DEVS);

  Serial.print("Devices Found: ");
  Serial.println(devices);

  if (devices == 0) {
    Serial.println("No DS18B20 detected!");
    while (1);
  }

  Serial.print("Sensor Address: 0x");
  Serial.println((unsigned long long)addr[0], HEX);
}

void loop() {


  ds.request();
  delay(750);

  uint8_t err = ds.getTemp(addr[0], temperature);

  display.clearDisplay();

  display.setTextSize(1);
  display.setCursor(0,0);
  display.println("FeverGuard AI");

  display.setCursor(0,12);

  if(err){
    display.println("Sensor Error");
    Serial.println("Sensor Error");
  }
  else{

    Serial.print("Temperature: ");
    Serial.println(temperature);

    sendTemperature(temperature);

    display.print("Temp: ");
    display.print(temperature,1);
    display.println(" C");

    display.setCursor(0,24);

    if(temperature < 37.5)
      display.print("Status: NORMAL");
    else if(temperature < 38.5)
      display.print("Status: FEVER");
    else
      display.print("Status: HIGH");
  }

  display.display();

  delay(5000);
}

void sendTemperature(float temp)
  {
      if(WiFi.status() == WL_CONNECTED)
      {
          HTTPClient http;

          http.begin(serverURL);

          http.addHeader("Content-Type", "application/json");

          String json =
          "{\"device_id\":\"FG001\","
          "\"temperature\":" + String(temp,1) + "}";

          int code = http.POST(json);

          Serial.print("HTTP Code : ");
          Serial.println(code);

          Serial.println(json);

          http.end();
      }
  }