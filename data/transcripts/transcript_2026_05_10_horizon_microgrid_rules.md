# Policy Design: Community Battery Discharge Regulations

**Amira Patel**: We need to set the software rules for Project Horizon community battery discharging. If a local residential battery system is enrolled, how much capacity can the public utility draw during a grid alert?

**Sarah Chen**: Our customer agreement says we can draw up to 40% of their battery capacity during an official ERCOT grid alert, but we must guarantee their battery is never depleted below a 20% state of charge (SoC) buffer.

**Marcus Vance**: Yes, and we must check battery health before drawing. If the battery cell temperature is above 45°C or showing a high internal resistance spike, the microgrid controller must bypass that node to avoid damaging client hardware.

**Amira Patel**: Agreed. I will write these boundary constraints into the Horizon firmware rules. The controller will query local temperature and SoC registers before accepting a discharge command.
- **Decision**: Minimum customer SoC buffer locked at 20%. Bypass node if temperature exceeds 45°C.
- **Action Item**: Amira to implement these constraints in the battery discharge state machine by May 15th.
