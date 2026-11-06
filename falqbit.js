// Shared code for the FALQBIT pages (unlock + launch).
import algosdk from "https://esm.sh/algosdk@3.8.0";
import { PeraWalletConnect } from "https://esm.sh/@perawallet/connect@1.8.0?deps=algosdk@3.8.0";
import { sha512_256 } from "https://esm.sh/js-sha512@0.9.0";

export { algosdk };

export const NETWORKS = {
  mainnet: {
    label: "MainNet",
    chainId: 416001,
    algod: "https://mainnet-api.algonode.cloud",
    indexer: "https://mainnet-idx.algonode.cloud",
    lora: "https://lora.algokit.io/mainnet",
    tinyman: 1002541853,
  },
  testnet: {
    label: "TestNet",
    chainId: 416002,
    algod: "https://testnet-api.algonode.cloud",
    indexer: "https://testnet-idx.algonode.cloud",
    lora: "https://lora.algokit.io/testnet",
    tinyman: 148607000,
  },
};

export const FEE_PQ = 6000;       // a Falcon signature costs about three minimum fees
export const FEE_CALL = 12000;    // app calls also pay for their inner transactions
export const HOLDER_DEPOSIT = 28500;
export const APP_DEPOSIT = 6500;
export const PK_LEN = 1793;
export const POOL_TEMPLATE = "BoAYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgQBbNQA0ADEYEkQxGYEBEkSBAUM=";
export const POOL_BOOTSTRAP_ALGO = 300000 + 100000 + (25000 + 3500) * 12 + (25000 + 25000) * 2 + 6000 + 100000;

export function pickNetwork() {
  const q = new URLSearchParams(location.search).get("net");
  return q === "mainnet" || q === "testnet" ? q : null;
}

export async function loadConfig() {
  try {
    const r = await fetch("./falqbit-config.json", { cache: "no-store" });
    return r.ok ? await r.json() : {};
  } catch { return {}; }
}

export function client(net) {
  const n = NETWORKS[net];
  const pera = new PeraWalletConnect({ chainId: n.chainId });

  // Try the primary host first; if it returns 403/429/5xx and a fallback exists, try the fallback. Remembers a bad host for 10 min.
  const _badHost = {};
  function _hostOf(u) { try { return new URL(u).host; } catch { return u; } }
  function _hostBad(h) { return _badHost[h] && (Date.now() - _badHost[h]) < 10 * 60 * 1000; }
  function _markBad(h) { _badHost[h] = Date.now(); }
  function _fallbackFor(url) {
    // map primary host → fallback URL (same path, different host)
    if (url.startsWith(n.indexer) && n.indexerFallback) return n.indexerFallback + url.slice(n.indexer.length);
    if (url.startsWith(n.algod) && n.algodFallback) return n.algodFallback + url.slice(n.algod.length);
    return null;
  }
  async function getJSON(url) {
    const fb = _fallbackFor(url);
    const target = (fb && _hostBad(_hostOf(url))) ? fb : url;
    let r;
    try { r = await fetch(target); }
    catch (e) { if (fb && target !== fb) { r = await fetch(fb); } else { throw e; } }
    if (r.status === 404) return null;
    if (!r.ok) {
      if ((r.status === 403 || r.status === 429 || r.status >= 500) && fb && target !== fb) {
        _markBad(_hostOf(target));
        const r2 = await fetch(fb);
        if (r2.status === 404) return null;
        if (!r2.ok) throw new Error(`${r2.status} ${await r2.text()}`);
        return r2.json();
      }
      throw new Error(`${r.status} ${await r.text()}`);
    }
    return r.json();
  }
  const algodGet = (path) => getJSON(n.algod + path);

  async function params(fee) {
    const sp = await new algosdk.Algodv2("", n.algod, "").getTransactionParams().do();
    return { ...sp, flatFee: true, fee: BigInt(fee) };
  }

  async function waitFor(txid) {
    for (let i = 0; i < 25; i++) {
      await new Promise((res) => setTimeout(res, 1000));
      const p = await getJSON(`${n.algod}/v2/transactions/pending/${txid}`);
      if (p && p["confirmed-round"]) return p;
      if (p && p["pool-error"]) throw new Error(p["pool-error"]);
    }
    throw new Error("Not confirmed after 25 seconds. Check the transaction on Lora.");
  }

  // Sign a group with Pera. `extra` maps a txn index to pre-signed bytes
  // (e.g. a LogicSig txn), which Pera is told not to sign.
  async function signAndSend(txns, extra = {}, watch = 0) {
    if (txns.length > 1) algosdk.assignGroupID(txns);
    const req = txns.map((txn, i) => (i in extra ? { txn, signers: [] } : { txn }));
    const peraSigned = await pera.signTransaction([req]);
    const blobs = []; let k = 0;
    txns.forEach((_, i) => blobs.push(i in extra ? extra[i] : peraSigned[k++]));
    const blob = new Uint8Array(blobs.reduce((s, b) => s + b.length, 0));
    let o = 0; for (const b of blobs) { blob.set(b, o); o += b.length; }
    const r = await fetch(`${n.algod}/v2/transactions`, {
      method: "POST", headers: { "Content-Type": "application/x-binary" }, body: blob,
    });
    const body = await r.json();
    if (!r.ok) throw new Error(body.message || JSON.stringify(body));
    const id = txns[watch].txID();
    return { id, info: await waitFor(id) };
  }

  // Send transactions that are already signed (e.g. a LogicSig txn) without Pera.
  async function sendRaw(blob, id) {
    const r = await fetch(`${n.algod}/v2/transactions`, {
      method: "POST", headers: { "Content-Type": "application/x-binary" }, body: blob,
    });
    const body = await r.json();
    if (!r.ok) throw new Error(body.message || JSON.stringify(body));
    return { id, info: await waitFor(id) };
  }

  // Pera keeps one session per site. A session opened on the other network
  // must be closed first, or Pera answers "Session currently connected".
  const NET_KEY = "falqbit-pera-net";
  const getNet = () => { try { return localStorage.getItem(NET_KEY); } catch { return null; } };
  const setNet = () => { try { localStorage.setItem(NET_KEY, net); } catch {} };
  async function connect() {
    try { await pera.disconnect(); } catch {}
    const accounts = await pera.connect();
    setNet();
    return accounts;
  }
  async function reconnect() {
    const accounts = await pera.reconnectSession();
    if (accounts.length && getNet() !== net) {
      try { await pera.disconnect(); } catch {}
      return [];
    }
    return accounts;
  }

  return { net, n, pera, getJSON, algodGet, params, signAndSend, sendRaw, connect, reconnect };
}

// ---- Falcon-1024 key discovery ------------------------------------------
// address = SHA512-256("PQA" || "f1" || salt || public_key)
export function pqAddressBytes(pk, salt) {
  const pre = new Uint8Array(6 + pk.length);
  pre.set(new TextEncoder().encode("PQAf1"), 0);
  pre[5] = salt;
  pre.set(pk, 6);
  return new Uint8Array(sha512_256.arrayBuffer(pre));
}
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const b64ToBytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function findFalconKey(c, addr, signer) {
  const target = algosdk.decodeAddress(signer).publicKey;
  let next = "";
  for (let page = 0; page < 5; page++) {
    const res = await c.getJSON(`${c.n.indexer}/v2/accounts/${addr}/transactions?limit=100${next ? "&next=" + next : ""}`);
    if (!res) return null;
    for (const t of res.transactions || []) {
      const pq = t.signature && t.signature.pqsig;
      if (!pq || t.sender !== addr) continue;
      const pk = b64ToBytes(pq["public-key"]);
      if (pk.length !== PK_LEN) continue;
      for (let salt = 0; salt < 256; salt++) {
        if (same(pqAddressBytes(pk, salt), target)) return { pk, salt };
      }
    }
    if (!res["next-token"]) break;
    next = res["next-token"];
  }
  return null;
}

export async function signerOf(c, addr) {
  const info = await c.algodGet(`/v2/accounts/${addr}?exclude=all`);
  return { info, signer: (info && info["auth-addr"]) || addr };
}

// ---- ABI helpers ----------------------------------------------------------
export const selector = (sig) => algosdk.ABIMethod.fromSignature(sig).getSelector();
export const enc = (type, v) => algosdk.ABIType.from(type).encode(v);
export const holderBox = (addr) => new Uint8Array([97, ...algosdk.decodeAddress(addr).publicKey]);
export const appBox = (id) => new Uint8Array([112, ...algosdk.encodeUint64(id)]);

export function poolLogicSig(net, assetId) {
  const program = b64ToBytes(POOL_TEMPLATE);
  program.set(algosdk.encodeUint64(NETWORKS[net].tinyman), 3);
  program.set(algosdk.encodeUint64(assetId), 11);
  program.set(algosdk.encodeUint64(0), 19);
  return new algosdk.LogicSigAccount(program);
}

export const short = (a) => a.slice(0, 6) + "…" + a.slice(-6);
