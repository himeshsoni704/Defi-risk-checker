// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DecisionProof v2.0
 * @dev On-chain cryptographic proof-of-decision for DeFi Risk Scoring.
 *
 * Records a Keccak256 hash of a canonical JSON record containing:
 *   wallet_id · model_id · model_version · dataset_version ·
 *   feature_schema_version · risk_score · decision · features ·
 *   SHAP explanation · XAI audit results (faithfulness · stability · sensitivity)
 *
 * This means the blockchain proves:
 *   "This exact prediction, explanation, model version, and audit result
 *    were the record associated with this decision."
 * Not merely: "The wallet was denied."
 *
 * Model versioning is stored alongside each record so that historical
 * decisions remain independently verifiable after model retraining.
 */
contract DecisionProof {

    // ── Events ─────────────────────────────────────────────────────────────

    /**
     * @dev Emitted when a canonical decision record is anchored on-chain.
     * @param wallet           The evaluated wallet address.
     * @param decisionHash     Keccak256 of the full canonical decision JSON.
     * @param modelId          Identifier string for the model used (e.g. "QSVC-ZZFeatureMap").
     * @param modelVersion     Semantic version of the model (e.g. "2.0").
     * @param schemaVersion    Version of the canonical record schema (e.g. "2.0").
     * @param timestamp        Block timestamp when the record was anchored.
     */
    event DecisionRecorded(
        address indexed wallet,
        bytes32 indexed decisionHash,
        string  modelId,
        string  modelVersion,
        string  schemaVersion,
        uint256 timestamp
    );

    // ── Storage ────────────────────────────────────────────────────────────

    struct DecisionRecord {
        bytes32 decisionHash;         // Keccak256 of full canonical JSON
        uint256 timestamp;            // Block timestamp
        string  modelId;              // e.g. "QSVC-ZZFeatureMap"
        string  modelVersion;         // e.g. "2.0"
        string  datasetVersion;       // e.g. "2.0"
        string  featureSchemaVersion; // e.g. "2.0"
        string  schemaVersion;        // canonical record schema version
    }

    mapping(address => DecisionRecord) private _records;
    mapping(bytes32 => address)        private _hashToWallet;

    // ── Write functions ────────────────────────────────────────────────────

    /**
     * @dev Record a canonical decision hash for msg.sender.
     * @param decisionHash Keccak256 of the canonical decision JSON.
     */
    function recordDecision(bytes32 decisionHash) external {
        _record(
            msg.sender,
            decisionHash,
            "QSVC-ZZFeatureMap", "2.0", "2.0", "2.0", "2.0"
        );
    }

    /**
     * @dev Record a canonical decision hash for a specific wallet (oracle pattern).
     * @param wallet           The evaluated wallet address.
     * @param decisionHash     Keccak256 of the canonical decision JSON.
     */
    function recordDecisionForWallet(address wallet, bytes32 decisionHash) external {
        _record(
            wallet,
            decisionHash,
            "QSVC-ZZFeatureMap", "2.0", "2.0", "2.0", "2.0"
        );
    }

    /**
     * @dev Record a canonical decision hash with full model version provenance.
     * @param wallet                Evaluated wallet address.
     * @param decisionHash          Keccak256 of the canonical JSON record.
     * @param modelId               Model identifier string.
     * @param modelVersion          Semantic model version.
     * @param datasetVersion        Dataset version used during training.
     * @param featureSchemaVersion  Feature schema version.
     * @param schemaVersion         Canonical record schema version.
     */
    function recordDecisionWithVersion(
        address wallet,
        bytes32 decisionHash,
        string  calldata modelId,
        string  calldata modelVersion,
        string  calldata datasetVersion,
        string  calldata featureSchemaVersion,
        string  calldata schemaVersion
    ) external {
        _record(
            wallet,
            decisionHash,
            modelId,
            modelVersion,
            datasetVersion,
            featureSchemaVersion,
            schemaVersion
        );
    }

    // ── Read functions ─────────────────────────────────────────────────────

    /**
     * @dev Read the full decision record for a wallet.
     * @return decisionHash          Stored hash.
     * @return timestamp             When it was recorded.
     * @return modelId               Model identifier.
     * @return modelVersion          Model version.
     * @return datasetVersion        Dataset version.
     * @return featureSchemaVersion  Feature schema version.
     * @return schemaVersion         Canonical record schema version.
     */
    function getDecision(address wallet)
        external
        view
        returns (
            bytes32 decisionHash,
            uint256 timestamp,
            string memory modelId,
            string memory modelVersion,
            string memory datasetVersion,
            string memory featureSchemaVersion,
            string memory schemaVersion
        )
    {
        DecisionRecord storage rec = _records[wallet];
        return (
            rec.decisionHash,
            rec.timestamp,
            rec.modelId,
            rec.modelVersion,
            rec.datasetVersion,
            rec.featureSchemaVersion,
            rec.schemaVersion
        );
    }

    /**
     * @dev Verify that a given hash matches the on-chain record for a wallet.
     * @param wallet       Wallet address to check.
     * @param decisionHash Expected hash to compare against.
     * @return verified    True if on-chain hash equals decisionHash and is non-zero.
     */
    function verifyDecision(address wallet, bytes32 decisionHash)
        external
        view
        returns (bool verified)
    {
        return _records[wallet].decisionHash == decisionHash
            && decisionHash != bytes32(0);
    }

    /**
     * @dev Lookup which wallet a given hash was recorded for (reverse index).
     * @param decisionHash The hash to look up.
     * @return wallet      The wallet address, or address(0) if not found.
     */
    function getWalletForHash(bytes32 decisionHash)
        external
        view
        returns (address wallet)
    {
        return _hashToWallet[decisionHash];
    }

    // ── Internal ───────────────────────────────────────────────────────────

    function _record(
        address wallet,
        bytes32 decisionHash,
        string memory modelId,
        string memory modelVersion,
        string memory datasetVersion,
        string memory featureSchemaVersion,
        string memory schemaVersion
    ) internal {
        require(wallet != address(0),     "DecisionProof: invalid wallet");
        require(decisionHash != bytes32(0), "DecisionProof: invalid hash");

        _records[wallet] = DecisionRecord({
            decisionHash:          decisionHash,
            timestamp:             block.timestamp,
            modelId:               modelId,
            modelVersion:          modelVersion,
            datasetVersion:        datasetVersion,
            featureSchemaVersion:  featureSchemaVersion,
            schemaVersion:         schemaVersion
        });

        _hashToWallet[decisionHash] = wallet;

        emit DecisionRecorded(
            wallet,
            decisionHash,
            modelId,
            modelVersion,
            schemaVersion,
            block.timestamp
        );
    }
}
