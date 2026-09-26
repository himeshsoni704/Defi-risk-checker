// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DecisionProof
 * @dev On-chain cryptographic proof-of-decision for DeFi Risk Scoring.
 * Records off-chain QML risk scores and XAI attributions verified by keccak256 hash.
 */
contract DecisionProof {
    // Event emitted when a decision hash is anchored on-chain
    event DecisionRecorded(
        address indexed wallet,
        bytes32 indexed decisionHash,
        uint256 timestamp
    );

    // Mapping from wallet address to recorded decision hash
    mapping(address => bytes32) private _decisions;
    // Mapping from wallet address to recorded timestamp
    mapping(address => uint256) private _decisionTimestamps;
    // Global registry of all recorded hashes to wallet
    mapping(bytes32 => address) private _hashToWallet;

    /**
     * @dev Record decision hash for msg.sender (single parameter per spec).
     * @param decisionHash keccak256 hash of wallet + score + explanation
     */
    function recordDecision(bytes32 decisionHash) external {
        _recordDecision(msg.sender, decisionHash);
    }

    /**
     * @dev Record decision hash explicitly for a specific wallet address (oracle pattern).
     * @param wallet The evaluated wallet address
     * @param decisionHash keccak256 hash of wallet + score + explanation
     */
    function recordDecisionForWallet(address wallet, bytes32 decisionHash) external {
        _recordDecision(wallet, decisionHash);
    }

    /**
     * @dev Internal recorder logic.
     */
    function _recordDecision(address wallet, bytes32 decisionHash) internal {
        require(wallet != address(0), "Invalid wallet address");
        require(decisionHash != bytes32(0), "Invalid decision hash");

        _decisions[wallet] = decisionHash;
        _decisionTimestamps[wallet] = block.timestamp;
        _hashToWallet[decisionHash] = wallet;

        emit DecisionRecorded(wallet, decisionHash, block.timestamp);
    }

    /**
     * @dev Read recorded decision for a wallet.
     * @param wallet The wallet address to query
     * @return decisionHash The 32-byte decision hash
     * @return timestamp Block timestamp when recorded
     */
    function getDecision(address wallet) external view returns (bytes32 decisionHash, uint256 timestamp) {
        return (_decisions[wallet], _decisionTimestamps[wallet]);
    }

    /**
     * @dev Verify if a given decision hash matches the on-chain stored decision for a wallet.
     * @param wallet The wallet address
     * @param decisionHash Expected decision hash
     * @return verified True if on-chain hash matches decisionHash
     */
    function verifyDecision(address wallet, bytes32 decisionHash) external view returns (bool verified) {
        return _decisions[wallet] == decisionHash && decisionHash != bytes32(0);
    }
}
