
/**********
* DEFINES *
**********/
#define BH1721FVC_ADDRESS                 0x23

#define BH1721FVC_OFF                     0x00
#define BH1721FVC_ON                      0x01
#define BH1721FVC_AUTO_RESOLUTION         0x10
#define BH1721FVC_H_RESOLUTION            0x12
#define BH1721FVC_L_RESOLUTION            0x13

void al_rst(int RESET_PIN);
void al_off(void);
void al_on(void);
void al_setAutoResolution(void);
void al_setHighResolution(void);
void al_setLowResolution(void);
void al_initializeSensor(int RESET_PIN);
uint16_t al_readSensor(void);
