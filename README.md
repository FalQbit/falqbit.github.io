# FALQBIT

The first Algorand token that only post-quantum (Falcon-1024) accounts can hold.

Site: https://falqbit.com · X: https://x.com/FalQbit

## Live on Algorand MainNet

- Token (ASA): **3760920399**
- Gate contract: **3760919863**
- Tinyman v2 pool: `CEQH5WNK3VFUVGZ6WET7GO2JLZVYY7BDPCN74LGWEUWC5WCMPYU7M7VCIA`
- Creator: `OCAF6EHCGLZ3SJDE54SL2TBKNDLIQAUQDM6CAFQAFZ7LNLERA4SBY73YIU`

## How it works

- FALQBIT is created **frozen by default**, with **no manager** and **no clawback**.
- Its freeze role belongs to an **immutable gate contract** (`falqbit_gate.py`).
- The gate unfreezes an account only if it proves a Falcon-1024 key signs for it:
  `address = SHA512-256("PQA" || "f1" || salt || public_key)`.
- Pools and contracts can hold FALQBIT only if their controlling app is on the approved list (Tinyman v2 only). The approver role has been renounced, so the list is final.
- If an unlocked account goes back to a classic key, anyone can call `relock` and earns its box deposit.

## Pages

- `index.html` – homepage
- `unlock.html` – unlock your Pera Quantum Account (`?net=testnet` for TestNet)
- `launch.html` – the launch steps, all signed in Pera
- `falqbit-config.json` – app, asset and pool IDs per network

## Contract

`falqbit_gate.py` is the Algorand Python source; `FalqbitGate.approval.teal`, `FalqbitGate.clear.teal` and `FalqbitGate.arc56.json` are the compiled program and spec.
Compiled approval program SHA-256: `f14801163a468bc7e990531cd866dd21fe69a6f5d0b7bf0bd71cd8109e4f95a9`

## Limits

Algorand consensus is not post-quantum yet (roadmap 2027). Relocking is after the fact. No professional audit yet.
