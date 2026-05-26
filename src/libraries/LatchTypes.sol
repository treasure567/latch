// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Public release schedule governing a Latch-locked pool's liquidity.
/// @dev `totalLocked` and all removal accounting are denominated in v4 liquidity units (L).
struct Schedule {
    uint64 cliffTime; // unix timestamp; nothing is releasable strictly before this
    uint64 periodLength; // seconds per vesting step
    uint32 periodsCount; // number of equal steps required to reach 100%
    address creator; // who locked the liquidity (transparency only; confers no privilege)
    uint256 totalLocked; // liquidity units (L) the schedule governs
}
