# Embedded Systems — originals catalog

**Course:** ENGS 85 (Dartmouth, WI21). Lab-heavy course on microcontroller
programming + interfacing: GPIO + interrupts → ADC + temperature sensing →
PWM + servo control → I²C + accelerometer → DC motor PWM with H-bridge →
MQTT-over-WiFi IoT capstone. The hero artefact is the IoT final project, a
3-page write-up describing a smart traffic-light crossing controlled over
MQTT.

**Source artefacts:** 14 PDFs in `archive/originals/embedded-systems/`,
gitignored per CONTENT-LICENSE.md §7.10. Three of the files
(`ADC_voltage_temperature_data1.pdf` and siblings) are binary data dumps from
the ADC sampling lab — PDFium rejects them as "data format error"; they were
never real PDFs. The lab reports are short typed write-ups + scans; the IoT
final project is the most documented single artefact. This catalog paraphrases
in my own voice; instructor-prepared problem statements are not reproduced
verbatim.

## Themes

- **Lab 1 — GPIO + button-driven LED.** First-lab "hello world":
  configure pins, debounce a push-button, toggle an LED on press.
- **Lab 2 — ADC sampling.** Sample an analogue input at a target rate,
  observe aliasing when input frequency exceeds Nyquist (sample rate
  / 2); recover the original by oversampling or anti-alias filtering.
- **Lab 3 — Temperature sensing with TMP36.** TMP36 outputs
  $V_{\mathrm{out}} = (T_{\mathrm{°C}} + 50) \cdot 10\,\mathrm{mV}$
  with 750 mV at 25 °C. Convert from raw ADC counts back to
  temperature via $T_{\mathrm{°C}} = (V_{\mathrm{out}} - 0.5) /
  0.01$, then verify against a known reference.
- **Lab 4 — PWM + servo (SG92R).** Drive a hobby servo with 50 Hz
  PWM (20 ms period); pulse width 1 ms → 0°, 1.5 ms → 90°, 2 ms →
  180°. Pulse-width-to-angle linear map. Prelab worked out the
  timer prescaler + duty cycle arithmetic.
- **Lab 5 — I²C + LSM303 accelerometer.** I²C bus initialisation,
  device-address selection, register read; raw acceleration counts
  → m/s² via the full-scale-range conversion. Tilt-to-acceleration
  relation $A_x = g \sin\theta$ for small tilts; verified by static
  tilt readings.
- **Lab 6 — Combined sensor / actuator integration.**
- **Lab 7 — DC motor PWM with H-bridge.** Three-mode driving:
  CW (one IN pin high, other low), CCW (reverse), BRAKE (both
  high). Deadband near zero duty cycle because of brush friction;
  PWM frequency picked above the audible 20 kHz to avoid motor
  whine.
- **Final Project — Internet-of-Things traffic crossing.** 6-state
  FSM: RED, YELLOW_1, GREEN, YELLOW_2, MAINTENANCE, TRAIN_ARRIVAL.
  TMP36 reads ambient temperature; SG92R servo physically rotates
  a crossing-arm; RGB LED displays the current light; Adafruit IO
  MQTT feeds publish state + receive maintenance commands. The
  TRAIN_ARRIVAL state is triggered by a separate MQTT feed (the
  "train" is just another connected client publishing an event).

## PDFs

| Filename | Pages | Notes |
|---|---:|---|
| `E85_Lab1_Akosah.pdf` | 3 | Lab 1 (scan): GPIO + debounced button + LED. |
| `ENGS 085_LAB2_Akosah_A.pdf` | 5 | Lab 2 (scan): ADC sampling + aliasing observations. |
| `E85_Akosah_A_Lab3.pdf` | 5 | Lab 3 (scan): TMP36 temperature sensing. |
| `E85_PRELAB4_AKOSAH.pdf` | 2 | Lab 4 prelab (scan): PWM timer prescaler arithmetic for SG92R servo. |
| `E85.08_Akwasi_Alab5.pdf` | 3 | Lab 5: I²C + LSM303 — raw ADC counts table + tilt observations. |
| `E85.08_Akwasi_Alab5-1.pdf` | 3 | Lab 5 alternate save (revision after first submission). |
| `E85_Lab6_Report.pdf` | 5 | Lab 6 (scan only): combined sensor + actuator integration. |
| `E85_Lab7_Akosah_A.pdf` | 3 | Lab 7: DC motor PWM with H-bridge — BRAKE / CW / CCW modes + duty-cycle deadband. |
| `E85_Lab7_Akosah_A-1.pdf` | 3 | Lab 7 alternate save. |
| `E85_IoT_Akosah_A.pdf` | 3 | Final Project: IoT traffic crossing with 6-state FSM, TMP36, SG92R servo, RGB LED, Adafruit IO MQTT feeds. |
| `E85_IoT_Akosah_A-1.pdf` | 3 | Final Project alternate save (revision). |
| `ADC_voltage_temperature_data1.pdf` | – | **Corrupted PDF** (PDFium data-format error). Was likely an exported binary data table from Lab 3, not a real PDF. |
| `ADC_voltage_temperature_data2.pdf` | – | Corrupted (same root cause). |
| `ADC_voltage_temperature_data3.pdf` | – | Corrupted (same root cause). |

## Featured-problem candidates (already in `embedded-systems.mdx`)

1. **Gamma-corrected PWM for perceptual LED brightness.** Human
   eye perceives brightness on roughly $L \propto V^{2.2}$ scale,
   so a linear PWM sweep looks heavily front-loaded. Apply
   $\text{duty}(n) = (n/N_{\max})^{2.2}$ to get a perceptually
   linear ramp. Ties to the `PwmVisualizer` demo.
2. **Nyquist limit + aliasing example (Lab 2).** A 60 Hz signal
   sampled at 50 Hz aliases to $50 - 60 = -10\,\mathrm{Hz}$ (i.e.
   10 Hz with phase-flipped sign). Anti-alias filter must roll off
   below $f_s / 2$. Ties to the `AdcSamplingVisualizer` demo.

## Additional candidates worth surfacing in interview

- **ISR budget calculation.** Interrupt routine must complete in
  less than the inter-interrupt period; e.g. 8 kHz sample rate
  → ISR has $1/8000 = 125\,\mu\mathrm s$ to execute or it falls
  behind. On a 16 MHz AVR that's 2000 cycles — generous unless
  you're doing FFTs.
- **TMP36 voltage → temperature conversion (Lab 3).** $V_{\rm out}
  = 0.01 \cdot T_{\mathrm{°C}} + 0.5$ so
  $T_{\mathrm{°C}} = (V_{\rm out} - 0.5) / 0.01$. ADC counts $\to$
  voltage via $V = (\text{count} / 1023) \cdot V_{\rm ref}$.
- **I²C address arbitration (Lab 5).** Each device has a 7-bit
  address + R/W bit; master sends start condition → address byte →
  ACK polling → register pointer → read or write. Multi-master
  arbitration via wired-AND on SDA, but ENGS 85 stayed
  single-master.
- **H-bridge BRAKE vs COAST (Lab 7).** Both IN pins high =
  active braking (motor terminals shorted through high-side
  transistors → back-EMF dissipates fast); both IN pins low =
  coast (motor terminals floating → motor spins down on
  friction alone). Lab 7 used BRAKE for fast stops.
- **MQTT QoS levels + feed semantics (Final Project).** QoS 0
  fire-and-forget vs QoS 1 at-least-once vs QoS 2 exactly-once;
  the traffic-crossing state-publish feed was QoS 1 because losing
  a state update is bad but seeing one twice is fine. The
  maintenance-command feed needed QoS 2 because re-applying a
  "switch to maintenance mode" would cycle the FSM.
- **6-state FSM design (Final Project).** RED → YELLOW_1 → GREEN
  → YELLOW_2 → RED is the normal cycle; MAINTENANCE is an
  out-of-band state entered from any state on a maintenance MQTT
  command; TRAIN_ARRIVAL preempts to RED + servo-down on a
  train-feed message. Drew the state diagram before writing any
  code — saved the integration phase.
