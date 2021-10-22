//////////////////////
// realPlantNursery //
// by Sam March     //
//////////////////////

///////////////
// Libraries //
///////////////
#include "Arduino.h"
#include <Wire.h>
#include "BH1721FVC.h"
#include <FastLED.h>                  //Credit: https://github.com/FastLED/FastLED
#include <DNSServer.h>
#include <WiFi.h>
#include "AsyncTCP.h"
#include "ESPAsyncWebServer.h"        //Credit: https://github.com/me-no-dev/ESPAsyncWebServer
#include "FS.h"
#include "SD.h"
#include "Audio.h"                    //Credit: https://github.com/schreibfaul1/ESP32-audioI2S

/////////////
// Defines //
/////////////
/********************
   Moisture Sensing
 ********************/
#define MOISTURE_SENSOR_PIN           36
#define MOISTURE_SENSOR_POWER_PIN     3
#define CALIBRATION_SAMPLE_SIZE       64
/*************************
   Ambient Light Sensing
 *************************/
#define AMBIENT_LIGHT_RST_PIN         14
#define AMBIENT_LIGHT_MAX             15000//65528
/***********
   Battery
 ***********/
#define BATTERY_MEASURE_EN_PIN        4
#define BATTERY_MEASURE_PIN           39
#define BATTERY_CHARGE_PIN            34
#define BAT_CHECK_TIME_INTERVAL       1000
#define BAT_ADC_MAX                   2450
#define BAT_ADC_MIN                   1680
/*******
   LED
 *******/
#define LED_DATA_PIN                 13
#define LED_LEVEL_SHIFTER_EN_PIN     32
/***********
   SD Card
 ***********/
#define SD_CARD_CS_PIN                5
#define SD_CARD_DI_PIN                23
#define SD_CARD_DO_PIN                19
#define SD_CARD_CLK_PIN               18
/*******************
   Audio Amplifier
 *******************/
#define I2S_SD_PIN                    25
#define I2S_BCLK_PIN                  27
#define I2S_WS_PIN                    26
#define I2S_EN_PIN                    33
/**********
   Timing
 **********/
#define MOISTURE_CHECK_TIME_INTERVAL  1000
#define AL_CHECK_TIME_INTERVAL        1000
#define SLEEP_TIMEOUT_INTERVAL        1000
#define SLEEP_TIME_IN_SECONDS         60
#define SLEEP_TIME_IN_MINUTES         3600000000//60*60*1000*1000
#define BUTTON_DEBOUNCE_TIME          1000
#define WIFI_ON_TIME_MINUTES          10
#define WIFI_ON_TIMEOUT               WIFI_ON_TIME_MINUTES*60*1000
/*********
   Button
 *********/
#define USER_BUTTON_PIN               0
/*********
   Debug
 *********/
#define DEBUG_MODE                    1

///////////////////////////
// Function Declarations //
///////////////////////////
int moistureSensorCalibration(int CURRENT_STEP);
int moistureSensorReadAverage(int NUMBER_OF_SAMPLES_TO_AVERAGE);
void moistureSensorHandler(void);
void ambientLightSensorHandler(void);
void batteryMonitorHandler(void);
int batteryMonitorReadAverage(int NUMBER_OF_SAMPLES_TO_AVERAGE);
void setLedRGB(uint8_t RED, uint8_t GREEN, uint8_t BLUE);
void audioHandler(void);
void playAudioFile(String FILENAME, uint8_t RED, uint8_t GREEN, uint8_t BLUE);
void sleepHandler(void);
void wifiTaskHandler(void);
void buttonHandler(void);
void deleteFile(fs::FS &fs, const char * path);
void appendFile(fs::FS &fs, const char * path, const char * message);
void readFile(fs::FS &fs, const char * path);
bool readSettingsData(fs::FS &fs, const char * path);
void writeDefaultSettingsData(fs::FS &fs, const char * path);
bool readCalibrationData(fs::FS &fs, const char * path);
void onEvent(AsyncWebSocket * server, AsyncWebSocketClient * client, AwsEventType type, void * arg, uint8_t *data, size_t len);
void parseWebsocketsData(String MESSAGE);

///////////////
// Variables //
///////////////
/**********************
   Moisture Variables
 **********************/
int currentMoisture;
int moistureCalibrationStep;
RTC_DATA_ATTR int moistureThreshold;
bool updateCalibration;
bool firstMoistureMeasurement;
/***************************
   Ambient Light Variables
 ***************************/
int currentLight;
RTC_DATA_ATTR int lightThreshold;
bool firstLightMeasurement;
/*****************
   LED Variables
 *****************/
CRGB leds[1];
/*********************
   Battery Variables
 *********************/
int batteryMonitorCheckTime;
int currentBattery;
RTC_DATA_ATTR int batteryThreshold;
bool firstBatteryMeasurement;
/*******************
   Audio Variables
 *******************/
Audio audioAmp;
bool needWaterAlert;
RTC_DATA_ATTR int silentMode;
/********************
   Timing Variables
 ********************/
int currentTime;
int moistureCheckTime;
int ambientLightCheckTime;
int buttonPressTime;
int wifiTimeoutTime;
/*******************
   Sleep Variables
 *******************/
RTC_DATA_ATTR bool isCalibrated         = false;
RTC_DATA_ATTR bool loadSettingsData     = true;
RTC_DATA_ATTR int lowerCalibrationBound;
RTC_DATA_ATTR int upperCalibrationBound;
RTC_DATA_ATTR int calibrationRange;
bool readyToSleep;
esp_sleep_wakeup_cause_t wakeupSource;
/*******************
   WiFi Variables
 *******************/
bool wifiRequired;
bool wifiInitialized;
DNSServer dnsServer;
AsyncWebServer server(80);
AsyncWebSocket ws("/ws");
String webSocketData;
class captivePageHandler : public AsyncWebHandler
{
  public:
    captivePageHandler()
    {
      server.on("/", HTTP_GET, [](AsyncWebServerRequest * request)
      {
        request->send(SD, "/webPage/index.html", "text/html");
      });
      server.onNotFound([](AsyncWebServerRequest * request)
      {
        request->send(SD, "/webPage/index.html", "text/html");
      });
      server.serveStatic("/", SD, "/webPage/");
    }
    bool canHandle(AsyncWebServerRequest *request)
    {
      return true;
    }
    void handleRequest(AsyncWebServerRequest *request)
    {
      request->send(SD, "/webPage/index.html", "text/html");
      server.serveStatic("/", SD, "/webPage/");
    }
};
/********************
   Button Variables
 ********************/
bool buttonDebouncing;
struct buttonStruct
{
  const uint8_t PIN;
  bool buttonPressed;
};
buttonStruct userButtonSwitch = {USER_BUTTON_PIN, false};
void IRAM_ATTR userButtonSwitchISR()
{
  userButtonSwitch.buttonPressed = true;
}

////////////////////
// Initialization //
////////////////////
void setup()
{
  /***********************
     UART Initialization
   ***********************/
  Serial.begin(115200);
  Serial.println("Booting");
  /**************************
     SD Card Initialization
   **************************/
  pinMode(SD_CARD_CS_PIN, OUTPUT);
  digitalWrite(SD_CARD_CS_PIN, HIGH);
  SPI.begin(SD_CARD_CLK_PIN, SD_CARD_DO_PIN, SD_CARD_DI_PIN);
  SD.begin(SD_CARD_CS_PIN);
  /************************
     Audio Initialization
   ************************/
  pinMode(I2S_EN_PIN, OUTPUT);
  audioAmp.setPinout(I2S_BCLK_PIN, I2S_WS_PIN, I2S_SD_PIN);
  audioAmp.setVolume(21);
  silentMode = 0;
  /***********************
     WiFi Initialization
   ***********************/
  wifiRequired              = false;
  wifiInitialized           = false;
  webSocketData             = "";
  /***************************
     Moisture Initialization
   ***************************/
  currentMoisture           = 0;
  moistureCalibrationStep   = 0;
  updateCalibration         = false;
  firstMoistureMeasurement  = true;
  needWaterAlert            = false;
  /********************************
     Ambient Light Initialization
   ********************************/
  Wire.begin();
  al_initializeSensor(AMBIENT_LIGHT_RST_PIN);
  currentLight              = 0;
  firstLightMeasurement     = true;
  /*************************
     Timing Initialization
   *************************/
  currentTime               = 0;
  moistureCheckTime         = 0;
  ambientLightCheckTime     = 0;
  buttonPressTime           = 0;
  /*************************
     Button Initialization
   *************************/
  pinMode(USER_BUTTON_PIN, INPUT_PULLUP);
  attachInterrupt(USER_BUTTON_PIN, userButtonSwitchISR, FALLING);
  buttonDebouncing          = false;
  /**************************
     Battery Initialization
   **************************/
  pinMode(BATTERY_MEASURE_EN_PIN, OUTPUT);
  digitalWrite(BATTERY_MEASURE_EN_PIN, LOW);
  batteryMonitorCheckTime   = 0;
  currentBattery            = 0;
  firstBatteryMeasurement   = true;
  /**********************
     LED Initialization
   **********************/
  LEDS.addLeds<WS2812, LED_DATA_PIN, GRB>(leds, 1);
  LEDS.setBrightness(250);
  pinMode(LED_LEVEL_SHIFTER_EN_PIN, OUTPUT);
  digitalWrite(LED_LEVEL_SHIFTER_EN_PIN, LOW);
  /************************
     Sleep Initialization
   ************************/
  readyToSleep              = false;
  esp_sleep_enable_timer_wakeup(SLEEP_TIME_IN_MINUTES);
  esp_sleep_enable_ext0_wakeup(GPIO_NUM_0, 0);
  wakeupSource = esp_sleep_get_wakeup_cause();
  if (wakeupSource == ESP_SLEEP_WAKEUP_EXT0)
  {
    wifiRequired = true;
  }
  /***************************
     Settings Initialization
   ***************************/
  if (loadSettingsData)
  {
    moistureThreshold         = 25;
    lightThreshold            = 25;
    batteryThreshold          = 25;
    if (!readSettingsData(SD, "/webPage/savedSettings.txt"))
    {
      writeDefaultSettingsData(SD, "/webPage/savedSettings.txt");
    }
    loadSettingsData = false;
  }
}

///////////////
// Main Loop //
///////////////
void loop() {
  currentTime = millis();
  /******************
     Moisture Tasks
   ******************/
  moistureSensorHandler();
  /***********************
     Ambient Light Tasks
   ***********************/
  ambientLightSensorHandler();
  /***************
     Audio Tasks
   ***************/
  audioAmp.loop();
  /**************
     WiFi Tasks
   **************/
  wifiTaskHandler();
  /****************
     Button Tasks
   ****************/
  buttonHandler();
  /****************
     Battery Tasks
   ****************/
  batteryMonitorHandler();
  /***************
     Sleep Tasks
   ***************/
  sleepHandler();
}

//////////////////////////
// Function Definitions //
//////////////////////////
/*************************************************************
   Function: int moistureSensorCalibration(int CURRENT_STEP)
   Summary: The function walks the user through calibrating
   the sensor with audio queues
   Input: Current position in the calibration process
   Output: Next step in the calibration process
 *************************************************************/
int moistureSensorCalibration(int CURRENT_STEP)
{
  int upperReading = 0;
  int lowReading = 0;
  int nextStepToComplete = 0;
  char dataToSaveUpper[10] = {0};
  char dataToSaveLower[10] = {0};
  switch (CURRENT_STEP)
  {
    case 0:
      Serial.println("Calibration step 0:");
      Serial.println("Announcing calibration start, requesting air sample");
      //      audioAmp.connecttoFS(SD, "audioFiles/calibrationRequestAir.mp3");
      playAudioFile("audioFiles/calibrationRequestAir.mp3", 184, 211, 255);
      nextStepToComplete = 1;
      break;
    case 1:
      Serial.println("Calibration step 1:");
      Serial.println("Taking air sample");
      upperCalibrationBound = moistureSensorReadAverage(CALIBRATION_SAMPLE_SIZE);
      Serial.print("Air value: ");
      Serial.println(upperCalibrationBound);
      nextStepToComplete = 2;
      break;
    case 2:
      Serial.println("Calibration step 2:");
      Serial.println("Announcing end of air sample, requesting water sample");
      //      audioAmp.connecttoFS(SD, "audioFiles/calibrationRequestWater.mp3");
      playAudioFile("audioFiles/calibrationRequestWater.mp3", 36, 129, 255);
      nextStepToComplete = 3;
      break;
    case 3:
      Serial.println("Calibration step 3:");
      Serial.println("Taking water sample");
      lowerCalibrationBound = moistureSensorReadAverage(CALIBRATION_SAMPLE_SIZE);
      Serial.print("Water value: ");
      Serial.println(lowerCalibrationBound);
      nextStepToComplete = 4;
      break;
    case 4:
      Serial.println("Calibration step 4:");
      Serial.println("Calibration over");
      //      audioAmp.connecttoFS(SD, "audioFiles/calibrationOver.mp3");
      playAudioFile("audioFiles/calibrationOver.mp3", 51, 227, 45);
      calibrationRange = upperCalibrationBound - lowerCalibrationBound;
      nextStepToComplete = 0;
      deleteFile(SD, "/calibrationData.txt");
      appendFile(SD, "/calibrationData.txt", "C1");
      appendFile(SD, "/calibrationData.txt", "U");
      appendFile(SD, "/calibrationData.txt",  itoa(upperCalibrationBound, dataToSaveUpper, 10));
      appendFile(SD, "/calibrationData.txt", "L");
      appendFile(SD, "/calibrationData.txt", itoa(lowerCalibrationBound, dataToSaveLower, 10));
      appendFile(SD, "/calibrationData.txt", "E");
      isCalibrated = true;
      updateCalibration = false;
      break;
    default:
      break;
  }
  return nextStepToComplete;
}
/******************************************************************************
   Function: int moistureSensorReadAverage(int NUMBER_OF_SAMPLES_TO_AVERAGE)
   Summary: The function takes a number of samples and averages them together
   Input: The total number of samples to average
   Output: The averaged of the samples taken
 ******************************************************************************/
int moistureSensorReadAverage(int NUMBER_OF_SAMPLES_TO_AVERAGE)
{
  int avgMoistureReading = 0;
  for (int i = 0; i < NUMBER_OF_SAMPLES_TO_AVERAGE; i++)
  {
    avgMoistureReading += analogRead(MOISTURE_SENSOR_PIN);
  }
  avgMoistureReading /= NUMBER_OF_SAMPLES_TO_AVERAGE;
  return avgMoistureReading;
}
/**********************************************
   Function: void moistureSensorHandler(void)
   Summary: The function handles the moisture
   sensor related tasks
   Input: None
   Output: None
 **********************************************/
void moistureSensorHandler(void)
{
  //Check to see if the sensor is calibrated
  if (isCalibrated)
  {
    if ((currentTime - moistureCheckTime) > MOISTURE_CHECK_TIME_INTERVAL)
    {
      currentMoisture = 0;
      //Collect samples
      currentMoisture = moistureSensorReadAverage(CALIBRATION_SAMPLE_SIZE);
      //Map the samples to percent based on calibrated data
      currentMoisture = map(currentMoisture, lowerCalibrationBound, upperCalibrationBound, 0, 100);
      //Subtract the percent from 100 in order to indicate 0 = dry, 100 = water
      currentMoisture = 100 - currentMoisture;
      //Make sure the percent is within 0 to 100 percent
      if (currentMoisture < 0)
      {
        currentMoisture = 0;
      }
      if (currentMoisture > 100)
      {
        currentMoisture = 100;
      }
      Serial.print("Moisture: ");
      Serial.println(currentMoisture);
      if (firstMoistureMeasurement)
      {
        char moistureDataToSave[10] = {0};
        appendFile(SD, "/webPage/measuredData/moistureData.txt",  itoa(currentMoisture, moistureDataToSave, 10));
        appendFile(SD, "/webPage/measuredData/moistureData.txt", "\n");
        firstMoistureMeasurement = false;
      }
      //Only alert if wifi isn't on
      if(!wifiRequired)
      {        
        //If the moisture is below the threshold, start crying for water
        if (currentMoisture < moistureThreshold)
        {
          if (!audioAmp.isRunning())
          {
            playAudioFile("audioFiles/needWater.mp3", 100, 100, 100);
            needWaterAlert = true;
          }
        }
        else
        {
          //If crying is ongoing but moisture is now at good levels, burp
          if (needWaterAlert && !audioAmp.isRunning())
          {
            playAudioFile("audioFiles/waterGood.mp3", 100, 100, 100);
            needWaterAlert = false;
          }
          //If crying has stopped and moisture is at a good level, go to sleep
          if (!needWaterAlert && !audioAmp.isRunning())
          {
            readyToSleep = true;
          }
        }
      }
      moistureCheckTime = currentTime;
    }
  }
  //If the sensor is not calibrated, calibrate first
  else
  {
    if (!updateCalibration)
    {
      if (readCalibrationData(SD, "/calibrationData.txt"))
      {
        isCalibrated = true;
      }
    }
    else
    {
      if (!audioAmp.isRunning())
      {
        moistureCalibrationStep = moistureSensorCalibration(moistureCalibrationStep);
      }
    }
  }
}

/***************************************************
   Function: void ambientLightSensorHandler(void)
   Summary: The function handles the ambient light
   sensor related tasks
   Input: None
   Output: None
 ***************************************************/
void ambientLightSensorHandler(void)
{

  if ((currentTime - ambientLightCheckTime) > AL_CHECK_TIME_INTERVAL)
  {
    currentLight = 0;
    //Collect samples
    currentLight = al_readSensor();
    //Map the samples to percent based on calibrated data
    //currentLight = map(currentLight, 0, AMBIENT_LIGHT_MAX, 0, 100);
    currentLight = 100 * (log(currentLight + 1) / log(AMBIENT_LIGHT_MAX));
    //Make sure the percent is within 0 to 100 percent
    if (currentLight < 0)
    {
      currentLight = 0;
    }
    if (currentLight > 100)
    {
      currentLight = 100;
    }
    Serial.print("Light: ");
    Serial.println(currentLight);
    if (firstLightMeasurement)
    {
      char lightDataToSave[10] = {0};
      appendFile(SD, "/webPage/measuredData/lightData.txt",  itoa(currentLight, lightDataToSave, 10));
      appendFile(SD, "/webPage/measuredData/lightData.txt", "\n");
      firstLightMeasurement = false;
    }
    ambientLightCheckTime = currentTime;
  }
}

/***********************************************
   Function: void batteryMonitorHandler(void)
   Summary: The function handles the battery
   monitoring related tasks
   Input: None
   Output: None
 ***********************************************/
void batteryMonitorHandler(void)
{

  if ((currentTime - batteryMonitorCheckTime) > BAT_CHECK_TIME_INTERVAL)
  {
    currentBattery = 0;
    //Collect samples
    currentBattery = batteryMonitorReadAverage(CALIBRATION_SAMPLE_SIZE);
    //Map the samples to percent based on calibrated data
    currentBattery = map(currentBattery, BAT_ADC_MIN, BAT_ADC_MAX, 0, 100);
    //Make sure the percent is within 0 to 100 percent
    if (currentBattery < 0)
    {
      currentBattery = 0;
    }
    if (currentBattery > 100)
    {
      currentBattery = 100;
    }
    Serial.print("Battery: ");
    Serial.println(currentBattery);
    if (firstBatteryMeasurement)
    {
      char batteryDataToSave[10] = {0};
      appendFile(SD, "/webPage/measuredData/batteryData.txt",  itoa(currentBattery, batteryDataToSave, 10));
      appendFile(SD, "/webPage/measuredData/batteryData.txt", "\n");
      firstBatteryMeasurement = false;
    }
    if (currentBattery < batteryThreshold)
    {
      setLedRGB(100, 0, 0);
    }
    batteryMonitorCheckTime = currentTime;
  }
}
/**********************************************************************************
   Function: int batteryMonitorReadAverage(int NUMBER_OF_SAMPLES_TO_AVERAGE)
   Summary: The function takes a number of samples and averages them together
   Input: The total number of samples to average
   Output: The averaged of the samples taken
 **********************************************************************************/
int batteryMonitorReadAverage(int NUMBER_OF_SAMPLES_TO_AVERAGE)
{
  digitalWrite(BATTERY_MEASURE_EN_PIN, HIGH);
  int avgBatteryReading = 0;
  for (int i = 0; i < NUMBER_OF_SAMPLES_TO_AVERAGE; i++)
  {
    avgBatteryReading += analogRead(BATTERY_MEASURE_PIN);
  }
  avgBatteryReading /= NUMBER_OF_SAMPLES_TO_AVERAGE;
  digitalWrite(BATTERY_MEASURE_EN_PIN, LOW);
  return avgBatteryReading;
}

void setLedRGB(uint8_t RED, uint8_t GREEN, uint8_t BLUE)
{
  digitalWrite(LED_LEVEL_SHIFTER_EN_PIN, HIGH);
  leds[0] = CRGB(RED, GREEN, BLUE);
  FastLED.show();
  digitalWrite(LED_LEVEL_SHIFTER_EN_PIN, LOW);
}
/*******************************************
   Function: void sleepHandler(void)
   Summary: The function handles the sleep
   related tasks
   Input: None
   Output: None
 *******************************************/
void sleepHandler(void)
{
  if (readyToSleep && !audioAmp.isRunning() && !wifiRequired && !buttonDebouncing)
  {
    Serial.println("Going to sleep");
    readyToSleep = false;
    al_off();
    digitalWrite(I2S_EN_PIN, LOW);
    setLedRGB(0, 0, 0);
    delay(250);
    esp_deep_sleep_start();
  }
}
/******************************************
   Function: void wifiTaskHandler(void)
   Summary: The function handles the WiFi
   related tasks, like initializing the
   radio and running the captive portal
   Input: None
   Output: None
 ******************************************/
void wifiTaskHandler(void)
{
  if (wifiRequired)
  {
    dnsServer.processNextRequest();
    if (!wifiInitialized)
    {
      Serial.println("Initializing WiFi");
      setLedRGB(0,0,100);
      WiFi.softAP("realPlantNursery");
      dnsServer.start(53, "*", WiFi.softAPIP());
      ws.onEvent(onEvent);
      server.addHandler(&ws);
      server.addHandler(new captivePageHandler());
      server.begin();
      wifiInitialized = true;
      wifiTimeoutTime = currentTime;
    }
  }
  else
  {
    if (wifiInitialized)
    {
      dnsServer.stop();
      server.end();
      WiFi.disconnect(true);
      WiFi.mode(WIFI_OFF);
      wifiInitialized = false;
      setLedRGB(0,0,0);
    }
  }
  if ((currentTime - wifiTimeoutTime) > WIFI_ON_TIMEOUT)
  {
    wifiRequired = false;
  }
}

/****************************************
   Function: void buttonHandler(void)
   Summary: The function handles the
   button related tasks
   radio and running the captive portal
   Input: None
   Output: None
 ****************************************/
void buttonHandler(void)
{
  if (userButtonSwitch.buttonPressed)
  {
    detachInterrupt(userButtonSwitch.PIN);
    userButtonSwitch.buttonPressed = false;
    buttonDebouncing = true;
    buttonPressTime = currentTime;
    Serial.println("Button Pressed");
    Serial.print("WiFi Required: ");
    if (wifiRequired)
    {
      wifiRequired = false;
      Serial.println("No");
    }
    else
    {
      wifiRequired = true;
      Serial.println("Yes");
    }
  }
  if (buttonDebouncing && (currentTime - buttonPressTime > BUTTON_DEBOUNCE_TIME))
  {
    buttonDebouncing = false;
    attachInterrupt(userButtonSwitch.PIN, userButtonSwitchISR, FALLING);
  }
}
/*******************************************************
   Function: deleteFile(fs::FS &fs, const char * path)
   Summary: Deletes SD file
   Input: Filesystem, path to file
   Output: None
 *******************************************************/
void deleteFile(fs::FS &fs, const char * path)
{
  if (fs.exists(path))
  {
    if (fs.remove(path)) {
      Serial.println("File deleted");
    } else {
      Serial.println("Delete failed");
    }
  }
}
/**********************************************************************************
   Function: void appendFile(fs::FS &fs, const char * path, const char * message)
   Summary: Opens SD file (creates if none exists) and appends message to end
   Input: Filesystem, path to file, message to write
   Output: None
 **********************************************************************************/
void appendFile(fs::FS &fs, const char * path, const char * message)
{
  File file = fs.open(path, FILE_APPEND);
  if (!file) {
    Serial.println("Failed to open file for appending");
    return;
  }
  file.print(message);
  file.close();
}
/**********************************************************************************
   Function: void readFile(fs::FS &fs, const char * path)
   Summary: Opens SD file reads data out to serial
   Input: Filesystem, path to file
   Output: None
 **********************************************************************************/
void readFile(fs::FS &fs, const char * path)
{
  File file = fs.open(path);
  if (!file) {
    Serial.println("Failed to open file for reading");
    return;
  }
  Serial.println("Read from file: ");
  while (file.available()) {
    Serial.write(file.read());
  }
  file.close();
}
/**********************************************************************************
   Function: void readCalibrationData(fs::FS &fs, const char * path)
   Summary: Opens SD file, reads calibraation data and stores them in globals
   Input: Filesystem, path to file
   Output: True if there was data available, false if none
 **********************************************************************************/
bool readCalibrationData(fs::FS &fs, const char * path)
{
  String calibrationDataFromSD = "";
  File file = fs.open(path);
  if (!file)
  {
    return false;
  }
  while (file.available())
  {
    calibrationDataFromSD += (char)file.read();
  }
  file.close();
  if (calibrationDataFromSD.indexOf("C1") >= 0)
  {
    int upperIndex = (calibrationDataFromSD.indexOf("U"));
    int lowerIndex = (calibrationDataFromSD.indexOf("L"));
    int endOfFileIndex = (calibrationDataFromSD.indexOf("E"));
    String lowerCalibrationString = calibrationDataFromSD.substring((lowerIndex + 1), (endOfFileIndex));
    String upperCalibrationString = calibrationDataFromSD.substring((upperIndex + 1), (lowerIndex));
    lowerCalibrationBound = lowerCalibrationString.toInt();
    upperCalibrationBound = upperCalibrationString.toInt();
    calibrationRange = upperCalibrationBound - lowerCalibrationBound;
    Serial.println("Calibration data found on SD Card:");
    Serial.print("Upper Bound: ");
    Serial.println(upperCalibrationBound);
    Serial.print("Lower Bound: ");
    Serial.println(lowerCalibrationBound);
    return true;
  }
  else
  {
    Serial.println("No calibration data found on SD Card");
    return false;
  }
}
/**********************************************************************************
   Function: void readSettingsData(fs::FS &fs, const char * path)
   Summary: Opens SD file reads data out, parse setting parameters and store
   them as globals
   Input: Filesystem, path to file
   Output: True if there was data available, false if none
 **********************************************************************************/
bool readSettingsData(fs::FS &fs, const char * path)
{
  String settingsDataFromSD = "";
  File file = fs.open(path);
  if (!file)
  {
    return false;
  }
  while (file.available())
  {
    settingsDataFromSD += (char)file.read();
  }
  file.close();
  //n: = name
  //w: = waterThreshold
  //s: = sunExposure
  //b: = batteryThreshold
  //m: = silentMode
  //, = end of particular setting
  //. = end of settings file
  if (settingsDataFromSD.indexOf("n:") >= 0)
  {
    int nameIndex = (settingsDataFromSD.indexOf("n:"));
    int waterThresholdIndex = (settingsDataFromSD.indexOf("w:", nameIndex));
    int lightThresholdIndex = (settingsDataFromSD.indexOf("s:", waterThresholdIndex));
    int batteryThresholdIndex = (settingsDataFromSD.indexOf("b:", lightThresholdIndex));
    int silentModeIndex = (settingsDataFromSD.indexOf("m:", batteryThresholdIndex));
    //last parameter needs to be last index used
    int endOfFileIndex = (settingsDataFromSD.indexOf(".", silentModeIndex));

    //Plant Name
    String settingsNameString = settingsDataFromSD.substring((nameIndex + 2), (waterThresholdIndex - 1));
    //Moisture Threshold
    String settingsWaterThresholdString = settingsDataFromSD.substring((waterThresholdIndex + 2), (lightThresholdIndex - 1));
    //Sun Exposure Threshold
    String settingsLightThresholdString = settingsDataFromSD.substring((lightThresholdIndex + 2), (batteryThresholdIndex - 1));
    //Battery Theshold
    String settingsBatteryThresholdString = settingsDataFromSD.substring((batteryThresholdIndex + 2), (silentModeIndex - 1));
    //Battery Theshold
    String settingsSilentModeString = settingsDataFromSD.substring((silentModeIndex + 2), (endOfFileIndex - 1));

    moistureThreshold = settingsWaterThresholdString.toInt();
    lightThreshold = settingsLightThresholdString.toInt();
    batteryThreshold = settingsBatteryThresholdString.toInt();
    silentMode = settingsSilentModeString.toInt();

    Serial.println("Settings from SD Card:");
    Serial.print("Name: ");
    Serial.println(settingsNameString);
    Serial.print("Water Threshold: ");
    Serial.println(moistureThreshold);
    Serial.print("Sun Exposure: ");
    Serial.println(lightThreshold);
    Serial.print("Battery Threshold: ");
    Serial.println(batteryThreshold);
    Serial.print("Silent Mode: ");
    Serial.println(silentMode);

    return true;
  }
  else
  {
    Serial.println("No settings data found on SD Card");
    return false;
  }
}
/**************************************************************************
   Function: void writeDefaultSettingsData(fs::FS &fs, const char * path)
   Summary: Opens SD file (creates if none exists) and adds deault
   settings parameters to file
   Input: Filesystem, path to file
   Output: None
 **************************************************************************/
void writeDefaultSettingsData(fs::FS &fs, const char * path)
{
  String defaultPlantSettings = "";
  defaultPlantSettings += "n:Planty McPlantface,";
  defaultPlantSettings += "w:" + String(moistureThreshold) + ",";
  defaultPlantSettings += "s:" + String(lightThreshold) + ",";
  defaultPlantSettings += "b:" + String(batteryThreshold) + ",";
  defaultPlantSettings += "m:" + String(silentMode) + ",";
  defaultPlantSettings += ".";
  Serial.print("Creating new settings file, default parameters: ");
  Serial.println(defaultPlantSettings);
  File file = fs.open(path, FILE_APPEND);
  if (!file) {
    Serial.println("Failed to open file for appending");
    return;
  }
  file.print(defaultPlantSettings.c_str());
  file.close();
}
void onEvent(AsyncWebSocket * server, AsyncWebSocketClient * client, AwsEventType type, void * arg, uint8_t *data, size_t len) {
  if (type == WS_EVT_CONNECT)
  {
  }
  else if (type == WS_EVT_DISCONNECT)
  {
  }
  else if (type == WS_EVT_ERROR)
  {
    Serial.println("WS error");
  }
  else if (type == WS_EVT_DATA)
  {
    webSocketData = String((const char *)data);
    parseWebsocketsData(webSocketData);
  }
}

void parseWebsocketsData(String MESSAGE)
{
  String websocketData = MESSAGE;
  if (websocketData.indexOf("calibrate") >= 0)
  {
    updateCalibration = true;
    isCalibrated = false;
  }
  //n: = name
  //w: = waterThreshold
  //s: = sunExposure
  //b: = batteryThreshold
  //m: = silentMode
  //, = end of particular setting
  //. = end of settings file
  if (websocketData.indexOf("n:") >= 0)
  {
    int nameIndex = (websocketData.indexOf("n:"));
    int waterThresholdIndex = (websocketData.indexOf("w:", nameIndex));
    int lightThresholdIndex = (websocketData.indexOf("s:", waterThresholdIndex));
    int batteryThresholdIndex = (websocketData.indexOf("b:", lightThresholdIndex));
    int silentModeIndex = (websocketData.indexOf("m:", batteryThresholdIndex));
    //last parameter needs to be last index used
    int endOfFileIndex = (websocketData.indexOf(".", silentModeIndex));

    //Plant Name
    String settingsNameString = websocketData.substring((nameIndex + 2), (waterThresholdIndex - 1));
    //Moisture Threshold
    String settingsWaterThresholdString = websocketData.substring((waterThresholdIndex + 2), (lightThresholdIndex - 1));
    //Sun Exposure Threshold
    String settingsLightThresholdString = websocketData.substring((lightThresholdIndex + 2), (batteryThresholdIndex - 1));
    //Battery Theshold
    String settingsBatteryThresholdString = websocketData.substring((batteryThresholdIndex + 2), (silentModeIndex - 1));
    //Silent Mode
    String settingsSilentModeString = websocketData.substring((silentModeIndex + 2), (endOfFileIndex - 1));

    moistureThreshold = settingsWaterThresholdString.toInt();
    lightThreshold = settingsLightThresholdString.toInt();
    batteryThreshold = settingsBatteryThresholdString.toInt();
    silentMode = settingsSilentModeString.toInt();

    Serial.println("New settings for SD Card:");
    Serial.print("Name: ");
    Serial.println(settingsNameString);
    Serial.print("Water Threshold: ");
    Serial.println(moistureThreshold);
    Serial.print("Sun Exposure: ");
    Serial.println(lightThreshold);
    Serial.print("Battery Threshold: ");
    Serial.println(batteryThreshold);
    Serial.print("Silent Mode: ");
    Serial.println(silentMode);

    deleteFile(SD, "/webPage/savedSettings.txt");
    String newPlantSettings = "";
    newPlantSettings += "n:" + settingsNameString + ",";
    newPlantSettings += "w:" + String(moistureThreshold) + ",";
    newPlantSettings += "s:" + String(lightThreshold) + ",";
    newPlantSettings += "b:" + String(batteryThreshold) + ",";
    newPlantSettings += "m:" + String(silentMode) + ",";
    newPlantSettings += ".";
    appendFile(SD, "/webPage/savedSettings.txt", newPlantSettings.c_str());
  }
}

void audioHandler(void)
{
  if (!audioAmp.isRunning())
  {
    digitalWrite(I2S_EN_PIN, LOW);
    setLedRGB(0, 0, 0);
  }

}
void playAudioFile(String FILENAME, uint8_t RED, uint8_t GREEN, uint8_t BLUE)
{
  setLedRGB(RED, GREEN, BLUE);
  if (!silentMode)
  {
    digitalWrite(I2S_EN_PIN, HIGH);
    audioAmp.connecttoFS(SD, FILENAME.c_str());
  }
}
