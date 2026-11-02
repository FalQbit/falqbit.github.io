# FALQBIT

The first Algorand token that only post-quantum (Falcon-1024) accounts can hold.

Site: https://falqbit.github.io · X: https://x.com/FalQbit

## How it works

- FALQBIT is created **frozen by default**, with **no manager** and **no clawback**.
- Its freeze role belongs to an **immutable gate contract** (`contract/falqbit_gate.py`).
- The gate unfreezes an account only if it proves a Falcon-1024 key signs for it:
  `address = SHA512-256("PQA" || "f1" || salt || public_key)`.
- Pools and contracts can hold FALQBIT only if their controlling app is on the approved list (Tinyman v2 first). The approver role will be renounced.
- If an unlocked account goes back to a classic key, anyone can call `relock` and earns its box deposit.

## Pages

- `index.html` – homepage
- `unlock.html` – unlock your Pera Quantum Account (`?net=testnet` for TestNet)
- `launch.html` – the launch steps, all signed in Pera
- `falqbit-config.json` – app, asset and pool IDs per network

## Contract

`contract/` has the Algorand Python source, compiled TEAL and ARC-56 spec.
Compiled approval program SHA-256: `f14801163a468bc7e990531cd866dd21fe69a6f5d0b7bf0bd71cd8109e4f95a9`

## Limits

Algorand consensus is not post-quantum yet (roadmap 2027). Relocking is after the fact. Until renounced, the approver can add apps to the list (never freeze, unfreeze or take tokens). No professional audit yet.
