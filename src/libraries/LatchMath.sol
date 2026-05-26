// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Schedule} from "./LatchTypes.sol";

/// @title LatchMath
/// @notice Stepwise vesting math for a Latch release schedule.
library LatchMath {
    /// @notice Cumulative liquidity released by `timestamp` under schedule `s`.
    /// @dev Returns 0 before the cliff; a full step unlocks at each `periodLength`
    ///      past the cliff; the result caps at `totalLocked` after `periodsCount` steps.
    /// @param s The release schedule.
    /// @param timestamp The time at which to evaluate the released amount.
    /// @return The cumulative released liquidity (L).
    function releasedAmount(Schedule memory s, uint256 timestamp) internal pure returns (uint256) {
        if (timestamp < s.cliffTime) return 0;
        uint256 elapsed = (timestamp - s.cliffTime) / s.periodLength;
        if (elapsed >= s.periodsCount) return s.totalLocked;
        return (s.totalLocked * elapsed) / s.periodsCount;
    }
}
