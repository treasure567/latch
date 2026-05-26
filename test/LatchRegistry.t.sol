// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Schedule} from "../src/libraries/LatchTypes.sol";
import {LatchRegistry} from "../src/LatchRegistry.sol";

contract LatchRegistryTest is Test {
    LatchRegistry reg;
    PoolId id = PoolId.wrap(bytes32(uint256(1)));

    address constant HOOK = address(0xC0DE);
    address constant CREATOR = address(0xABCD);
    address constant TOKEN0 = address(0x10);
    address constant TOKEN1 = address(0x20);

    function setUp() public {
        reg = new LatchRegistry();
    }

    function _sched() internal pure returns (Schedule memory) {
        return Schedule(1000, 100, 4, CREATOR, 1000);
    }

    function test_registerThenVerified() public {
        reg.register(id, HOOK, CREATOR, _sched(), TOKEN0, TOKEN1);
        assertTrue(reg.isVerified(id));
        LatchRegistry.Entry memory e = reg.getEntry(id);
        assertEq(e.hook, HOOK);
        assertEq(e.creator, CREATOR);
        assertEq(e.token0, TOKEN0);
        assertEq(e.token1, TOKEN1);
        assertEq(e.schedule.totalLocked, 1000);
    }

    function test_unregisteredNotVerified() public view {
        assertFalse(reg.isVerified(id));
    }

    function test_duplicateRegisterReverts() public {
        reg.register(id, HOOK, CREATOR, _sched(), TOKEN0, TOKEN1);
        vm.expectRevert(LatchRegistry.AlreadyRegistered.selector);
        reg.register(id, HOOK, CREATOR, _sched(), TOKEN0, TOKEN1);
    }
}
