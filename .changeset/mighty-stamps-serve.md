---
"@canvas-tile-engine/react-native": patch
---

Balance native press callbacks independently of tap eligibility. Multitouch still suppresses clicks but releases an earlier one-finger press once; cancellation and unmount cancel it through onMouseLeave, including when native touch data is incomplete. Ignore duplicate terminal events and reset the gesture before a new press.
