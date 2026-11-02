"""FALQBIT gatekeeper (v3).

The FALQBIT asset is created with default_frozen=True, no clawback, no
manager, and its freeze role set to this application's address. Nobody holds
a key that can freeze or unfreeze holders: only the rules below can.

A holder is unlocked when the key that authorises it is a Falcon-1024 key, or
when it is authorised by an approved application whose code controls it (for
example the Tinyman v2 validator, which controls every Tinyman pool).

The authoriser that was approved is recorded in a box. If it later changes
(for example a rekey back to an Ed25519 key), or the account closes, anyone
may call `relock` and the holding is frozen again; the caller receives the
box deposit. Any unfrozen holding without an approval record (for example the
creator's, which the protocol creates unfrozen) can also be relocked by
anyone. Frozen tokens still belong to their holder: there is no clawback.

The approver may only add existing applications to the approved list. It
cannot freeze, unfreeze or remove anything, and it can be renounced for good.
"""

from algopy import (
    Account,
    Application,
    ARC4Contract,
    Asset,
    BoxMap,
    Bytes,
    Global,
    GlobalState,
    Txn,
    UInt64,
    arc4,
    gtxn,
    itxn,
    op,
    subroutine,
    urange,
)

# Holder box: 1-byte prefix + 32-byte key + 32-byte value
APPROVAL_MBR = 2_500 + 400 * (1 + 32 + 32)
# App box: 1-byte prefix + 8-byte key + 1-byte value
APP_MBR = 2_500 + 400 * (1 + 8 + 1)
FALCON1024_PK_LEN = 1793


@subroutine
def current_signer(acct: Account) -> tuple[Account, bool]:
    """(address whose signature authorises `acct` today, account exists)."""
    auth, funded = op.AcctParamsGet.acct_auth_addr(acct)
    if auth == Global.zero_address:
        return acct, funded
    return auth, funded


class FalqbitGate(ARC4Contract):
    def __init__(self) -> None:
        self.asset_id = GlobalState(UInt64(0))
        self.approver = GlobalState(Global.creator_address)
        self.approved = BoxMap(Account, arc4.Address, key_prefix=b"a")
        self.code_apps = BoxMap(UInt64, arc4.Bool, key_prefix=b"p")

    # ---------------------------------------------------------------- setup
    @arc4.abimethod
    def bind_asset(self, asset: Asset) -> None:
        """One-time: link the FALQBIT asset. Checks it is built to the rules."""
        assert Txn.sender == Global.creator_address, "creator only"
        assert self.asset_id.value == 0, "already bound"
        assert asset.freeze == Global.current_application_address, "freeze must be this app"
        assert asset.clawback == Global.zero_address, "clawback must be empty"
        assert asset.manager == Global.zero_address, "asset must be immutable"
        assert asset.default_frozen, "asset must start frozen"
        self.asset_id.value = asset.id

    @arc4.abimethod
    def approve_app(self, pay: gtxn.PaymentTransaction, app: Application) -> None:
        """Add an existing application whose code may hold FALQBIT (e.g. an AMM)."""
        assert Txn.sender == self.approver.value, "approver only"
        assert app.creator != Global.zero_address, "application does not exist"
        assert pay.receiver == Global.current_application_address, "pay the app"
        assert pay.amount >= APP_MBR, "deposit too small"
        self.code_apps[app.id] = arc4.Bool(True)  # noqa: FBT003

    @arc4.abimethod
    def renounce_approver(self) -> None:
        """Give up the approver role forever."""
        assert Txn.sender == self.approver.value, "approver only"
        self.approver.value = Global.zero_address

    # --------------------------------------------------------------- unlock
    @arc4.abimethod
    def unlock_falcon(
        self,
        pay: gtxn.PaymentTransaction,
        account: Account,
        salt: arc4.Byte,
        public_key: arc4.DynamicBytes,
    ) -> None:
        """Unlock `account` if it is authorised by a Falcon-1024 key.

        address = SHA512-256("PQA" || "f1" || salt || public_key)
        """
        pk = public_key.native
        assert pk.length == FALCON1024_PK_LEN, "not a Falcon-1024 public key"
        derived = op.sha512_256(Bytes(b"PQAf1") + salt.bytes + pk)
        signer, funded = current_signer(account)
        assert funded, "account does not exist"
        assert derived == signer.bytes, "account is not authorised by this Falcon key"
        self._approve(pay, account, signer)

    @arc4.abimethod
    def unlock_code(
        self, pay: gtxn.PaymentTransaction, account: Account, app: Application
    ) -> None:
        """Unlock an account controlled by an approved application.

        Covers the application's own account and accounts rekeyed to it,
        such as Tinyman v2 pools (rekeyed to the validator application).
        """
        assert app.id in self.code_apps, "application not approved"
        signer, funded = current_signer(account)
        assert funded, "account does not exist"
        assert signer == app.address, "account is not controlled by this application"
        self._approve(pay, account, signer)

    # ---------------------------------------------------------------- relock
    @arc4.abimethod
    def relock(self, account: Account) -> None:
        """Anyone may freeze a holding that no longer meets the rules.

        - approved holder whose authoriser changed, or whose account closed:
          the approval is removed and the caller gets the box deposit;
        - unfrozen holding that was never approved: it is frozen.
        """
        asset = Asset(self.asset_id.value)
        _balance, opted = op.AssetHoldingGet.asset_balance(account, asset)
        signer, funded = current_signer(account)

        if account in self.approved:
            assert (not funded) or signer != self.approved[account].native, (
                "authoriser unchanged"
            )
            del self.approved[account]
            itxn.Payment(receiver=Txn.sender, amount=APPROVAL_MBR, fee=0).submit()
        else:
            assert opted, "nothing to relock"
            frozen, _x = op.AssetHoldingGet.asset_frozen(account, asset)
            assert not frozen, "already frozen"

        if opted:
            itxn.AssetFreeze(
                freeze_asset=asset, freeze_account=account, frozen=True, fee=0
            ).submit()

    # ------------------------------------------------------------- read-only
    @arc4.abimethod(readonly=True)
    def is_approved(self, account: Account) -> bool:
        if account not in self.approved:
            return False
        signer, funded = current_signer(account)
        return funded and signer == self.approved[account].native

    # -------------------------------------------------------------- internal
    @subroutine
    def _approve(self, pay: gtxn.PaymentTransaction, account: Account, signer: Account) -> None:
        assert self.asset_id.value != 0, "asset not bound yet"
        assert pay.receiver == Global.current_application_address, "pay the app"
        if account not in self.approved:
            assert pay.amount >= APPROVAL_MBR, "deposit too small"
        # No later transaction in this group may rekey the account away.
        for i in urange(Txn.group_index + 1, Global.group_size):
            t = gtxn.Transaction(i)
            assert not (t.sender == account and t.rekey_to != Global.zero_address), (
                "account is rekeyed later in this group"
            )
        self.approved[account] = arc4.Address(signer)
        itxn.AssetFreeze(
            freeze_asset=Asset(self.asset_id.value),
            freeze_account=account,
            frozen=False,
            fee=0,
        ).submit()
