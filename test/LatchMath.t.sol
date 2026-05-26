// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Schedule} from "../src/libraries/LatchTypes.sol";
import {LatchMath} from "../src/libraries/LatchMath.sol";

contract LatchMathTest is Test {
    using LatchMath for Schedule;

    function _sched() internal pure returns (Schedule memory) {
        // cliff at t=1000, 4 periods of 100s each, 1000 locked
        return
            Schedule({cliffTime: 1000, periodLength: 100, periodsCount: 4, creator: address(0xABCD), totalLocked: 1000});
    }

    function test_beforeCliff_zero() public pure {
        assertEq(_sched().releasedAmount(999), 0);
    }

    function test_atCliff_zero() public pure {
        assertEq(_sched().releasedAmount(1000), 0);
    }

    function test_afterOnePeriod_quarter() public pure {
        assertEq(_sched().releasedAmount(1100), 250);
    }

    function test_midPeriod_stepwise_noPartial() public pure {
        // 150s past cliff = still only 1 full period elapsed
        assertEq(_sched().releasedAmount(1150), 250);
    }

    function test_afterAllPeriods_full() public pure {
        assertEq(_sched().releasedAmount(1400), 1000);
    }

    function test_farFuture_capsAtTotal() public pure {
        assertEq(_sched().releasedAmount(1_000_000), 1000);
    }

    function testFuzz_monotonicAndBounded(uint32 dt) public pure {
        Schedule memory s = _sched();
        uint256 t = uint256(s.cliffTime) + dt;
        uint256 r = s.releasedAmount(t);
        assertLe(r, s.totalLocked);
        assertGe(s.releasedAmount(t + 1), r); // non-decreasing
    }
}
