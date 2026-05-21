# Product Alignment: GridPulse Tiered Pricing Redesign

**Sarah Chen**: We need to update the commercial model for GridPulse. Our municipal clients are pushing back on the flat monthly fee. They want a value-based model tied to active smart-meters.

**Marcus Vance**: A meter-based licensing fee makes sense. But we have to account for edge node hardware costs. For Project Helium edge controllers installed at their physical substations, we incur a hard hardware manufacturing cost of $2,400 per node. We cannot bundle that into a pure software subscription.

**Dr. Elena Rostova**: Correct. Additionally, running the high-frequency neural forecasting models for large cities utilizes substantial cloud computing GPU power. A small utility with 10,000 meters shouldn't pay the same infrastructure overhead as a metro area with 500,000 meters.

**Sarah Chen**: I agree. Let's create three tiers:
1. **Utility Tier (Starter)**: Up to 50,000 meters. Local offline TF-IDF forecasting, 2 Helium edge nodes included.
2. **Municipal Tier (Standard)**: Up to 200,000 meters. Full Quantum neural forecasting, up to 10 Helium edge nodes, standard SLAs.
3. **Metropolitan Tier (Premium)**: Unlimited meters. Multi-region redundancy, high-frequency active balancing, 15ms battery discharge handshakes.

- **Decision**: Adopt a hybrid meter-based software model combined with a flat hardware setup fee.
- **Action Item**: Sarah to draft the formal GridPulse Pricing matrix Excel sheet by March 25th.
