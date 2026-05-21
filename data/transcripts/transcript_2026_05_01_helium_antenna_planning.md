# Engineering Review: Substation Wireless Telemetry Antennas

**Marcus Vance**: We are designing the antenna bracket layouts for Project Helium edge nodes. We need reliable cellular backup connections because some municipal substations lack landline fiber links.

**Amira Patel**: Substations are a nightmare for electromagnetic interference (EMI). The high-voltage transformers radiate a lot of high-frequency noise. If we place the cellular antenna too close to the main transformer bank, the signal-to-noise ratio will collapse.

**Dr. Elena Rostova**: What spectrum are we using? If we use standard 2.4 GHz bands, the interference will be severe. We should stick to LTE Band 48 (CBRS) or dedicated 900 MHz industrial radio links.

**Marcus Vance**: We are standardizing on dual-band industrial modems that support CBRS and LTE Band 13 for long-distance rural coverage. We will mount the antenna on a 3-meter fiberglass extension pole to clear the metallic cages.
- **Decision**: Cellular antennas must be separated from primary transformer coils by a minimum distance of 5 meters.
- **Action Item**: Marcus to finalize the physical CAD brackets for the antenna mounts by May 10th.
