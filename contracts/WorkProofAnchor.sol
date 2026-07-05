// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract WorkProofAnchor {
    event Anchored(bytes32 indexed hash, address indexed worker, uint256 timestamp);

    function anchor(bytes32 hash) external {
        emit Anchored(hash, msg.sender, block.timestamp);
    }
}
