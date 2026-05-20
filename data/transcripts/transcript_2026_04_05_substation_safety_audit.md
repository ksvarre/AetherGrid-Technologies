---
date: 2026-04-05
attendees: Marcus Vance, Amira Patel, David Kross
facilitator: Marcus Vance
domain: Safety & Compliance
priority: Medium
---
# Compliance Review: Substation Physical Access Safety SOP

**Marcus Vance**: Safety audit is next week, everyone. We need to formalize the Standard Operating Procedure (SOP) for when technicians enter a physical high-voltage substation to upgrade our Project Helium edge nodes.

**Amira Patel**: This is highly regulated. Technicians must wear Category 4 Arc Flash protection gear before entering any enclosure. And we have a strict rule: never work on active high-voltage cabinets alone. A secondary compliance safety officer must be present outside the safety perimeter.

**David Kross**: From a systems perspective, we need a digital lock out protocol. Before a technician opens a Helium edge enclosure door, they must trigger "Maintenance Mode" in the central control app. This safely stops active container operations, flushes telemetry queues, and disables remote firmware pushes.

**Marcus Vance**: Good point, David. That prevents a random remote firmware update from bricking the node mid-service.
- **Decision**: Incorporating the Maintenance Mode trigger into the official technician mobile application.
- **Action Item**: Amira to update the physical safety checklist PDF and submit it to the regulator by April 12th.
