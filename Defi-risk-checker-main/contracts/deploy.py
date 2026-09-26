"""
Solidity Compiler & Sepolia Deployment Script for DecisionProof.
Compiles DecisionProof.sol via py-solc-x and deploys to Sepolia testnet or simulated provider.
"""

import os
import json
import solcx
from dotenv import load_dotenv
from web3 import Web3

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SOL_FILE = os.path.join(BASE_DIR, "DecisionProof.sol")
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")
ARTIFACT_FILE = os.path.join(ARTIFACTS_DIR, "DecisionProof.json")


def compile_contract():
    """Compile DecisionProof.sol and save ABI/bytecode."""
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    solcx.install_solc("0.8.20")
    solcx.set_solc_version("0.8.20")

    with open(SOL_FILE, "r") as f:
        source = f.read()

    compiled = solcx.compile_standard({
        "language": "Solidity",
        "sources": {"DecisionProof.sol": {"content": source}},
        "settings": {
            "optimizer": {"enabled": True, "runs": 200},
            "outputSelection": {"*": {"*": ["abi", "evm.bytecode"]}}
        }
    })

    contract_data = compiled["contracts"]["DecisionProof.sol"]["DecisionProof"]
    artifact = {
        "contractName": "DecisionProof",
        "abi": contract_data["abi"],
        "bytecode": contract_data["evm"]["bytecode"]["object"]
    }

    with open(ARTIFACT_FILE, "w") as f:
        json.dump(artifact, f, indent=2)

    print(f"Contract compiled successfully -> {ARTIFACT_FILE}")
    return artifact


def deploy_contract():
    """Deploy compiled contract to Sepolia testnet if credentials exist, else initialize local config."""
    artifact = compile_contract()
    
    rpc_url = os.getenv("SEPOLIA_RPC_URL", "").strip()
    private_key = os.getenv("PRIVATE_KEY", "").strip()

    if not rpc_url or not private_key:
        print("\n[NOTE] SEPOLIA_RPC_URL or PRIVATE_KEY not provided in .env.")
        print("Backend will automatically use the high-fidelity Local Simulated On-Chain Provider.")
        print("To deploy to live Sepolia:")
        print("  1. Add SEPOLIA_RPC_URL=https://rpc.sepolia.org (or Alchemy/Infura) to .env")
        print("  2. Add PRIVATE_KEY=0x... to .env")
        print("  3. Run: python contracts/deploy.py\n")
        return None

    print(f"Connecting to Sepolia RPC: {rpc_url[:30]}...")
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not w3.is_connected():
        print("[ERROR] Could not connect to Sepolia RPC. Please verify SEPOLIA_RPC_URL.")
        return None

    account = w3.eth.account.from_key(private_key)
    print(f"Deploying from account: {account.address}")
    
    balance = w3.eth.get_balance(account.address)
    print(f"Account Balance: {w3.from_wei(balance, 'ether')} Sepolia ETH")

    if balance == 0:
        print("[WARNING] Account balance is 0. Please fund it from a Sepolia faucet.")
        return None

    contract = w3.eth.contract(abi=artifact["abi"], bytecode=artifact["bytecode"])
    nonce = w3.eth.get_transaction_count(account.address)
    
    tx = contract.constructor().build_transaction({
        "from": account.address,
        "nonce": nonce,
        "gasPrice": int(w3.eth.gas_price * 1.2),
        "chainId": w3.eth.chain_id
    })

    signed_tx = w3.eth.account.sign_transaction(tx, private_key=private_key)
    print("Broadcasting deployment transaction to Sepolia...")
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    print(f"Transaction Hash: {tx_hash.hex()}")
    print("Waiting for block confirmation...")

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    contract_address = receipt.contractAddress
    print(f"Successfully deployed to Sepolia!")
    print(f"Contract Address: {contract_address}")
    print(f"Explorer URL: https://sepolia.etherscan.io/address/{contract_address}")

    # Update .env or save deployment metadata
    deployment_info = {
        "network": "sepolia",
        "chainId": w3.eth.chain_id,
        "contractAddress": contract_address,
        "txHash": tx_hash.hex(),
        "deployer": account.address
    }
    with open(os.path.join(ARTIFACTS_DIR, "deployment.json"), "w") as f:
        json.dump(deployment_info, f, indent=2)

    return contract_address


if __name__ == "__main__":
    deploy_contract()
