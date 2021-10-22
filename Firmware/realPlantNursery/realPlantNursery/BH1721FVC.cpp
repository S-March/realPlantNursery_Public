#include <Arduino.h>
#include <Wire.h>
#include "BH1721FVC.h"

void al_rst(int RESET_PIN)
{
  digitalWrite(RESET_PIN, LOW);
  delay(10);
  digitalWrite(RESET_PIN, HIGH);
}

void al_off(void)
{ 
  Wire.beginTransmission(BH1721FVC_ADDRESS);
  Wire.write(BH1721FVC_OFF);
  if(Wire.endTransmission() != 0)
  {
    Serial.println("Error reading from device");
  }
}

void al_on()
{
  Wire.beginTransmission(BH1721FVC_ADDRESS);
  Wire.write(BH1721FVC_ON);
  if(Wire.endTransmission() != 0)
  {
    Serial.println("Error reading from device");
  }
}

void al_setAutoResolution(void)
{
  Wire.beginTransmission(BH1721FVC_ADDRESS);
  Wire.write(BH1721FVC_AUTO_RESOLUTION);
  if(Wire.endTransmission() != 0)
  {
    Serial.println("Error reading from device");
  }
}

void al_setHighResolution(void)
{
  Wire.beginTransmission(BH1721FVC_ADDRESS);
  Wire.write(BH1721FVC_H_RESOLUTION);
  if(Wire.endTransmission() != 0)
  {
    Serial.println("Error reading from device");
  }
}

void al_setLowResolution(void)
{
  Wire.beginTransmission(BH1721FVC_ADDRESS);
  Wire.write(BH1721FVC_L_RESOLUTION);
  if(Wire.endTransmission() != 0)
  {
    Serial.println("Error reading from device");
  }
}

void al_initializeSensor(int RESET_PIN)
{
  al_rst(RESET_PIN);
  al_off();
  al_on();
  al_setAutoResolution();
}

uint16_t al_readSensor(void)
{
  uint8_t msb = 0;
  uint8_t lsb = 0;

  Wire.beginTransmission(BH1721FVC_ADDRESS);
  Wire.requestFrom(BH1721FVC_ADDRESS, (uint8_t)2);
  
  msb = Wire.read(); 
  lsb = Wire.read(); 

  return (((((uint16_t)msb) << 8) | lsb)/1.2);
}
