// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {LatchHook} from "../src/LatchHook.sol";

contract LatchHookUnitTest is Test {
    using PoolIdLibrary for PoolKey;

    LatchHook hook;
    PoolKey key;
    PoolId id;

    function setUp() public {
        // Deploy hook to an address carrying the BEFORE_REMOVE_LIQUIDITY flag.
        address flags = address(uint160(Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG) ^ (0x5550 << 144));
        deployCodeTo("LatchHook.sol:LatchHook", abi.encode(IPoolManager(address(0x1234))), flags);
        hook = LatchHook(flags);

        key = PoolKey(Currency.wrap(address(1)), Currency.wrap(address(2)), 3000, 60, IHooks(hook));
        id = key.toId();
    }

    function test_setSchedule_storesAndEmits() public {
        hook.setSchedule(key, 1000, 100, 4, 1000);
        assertEq(hook.releasedAmount(id, 1100), 250);
        (uint64 cliff,,, address creator, uint256 total) = hook.schedules(id);
        assertEq(cliff, 1000);
        assertEq(creator, address(this));
        assertEq(total, 1000);
    }

    function test_setSchedule_writeOnce() public {
        hook.setSchedule(key, 1000, 100, 4, 1000);
        vm.expectRevert(LatchHook.ScheduleExists.selector);
        hook.setSchedule(key, 1, 1, 1, 1);
    }

    function test_setSchedule_invalidParams() public {
        vm.expectRevert(LatchHook.InvalidSchedule.selector);
        hook.setSchedule(key, 1000, 0, 4, 1000); // periodLength 0
    }

    function test_wouldExceedLock() public {
        hook.setSchedule(key, 1000, 100, 4, 1000);
        // at t=1100, released = 250
        assertTrue(hook.wouldExceedLock(id, 300, 1100));
        assertFalse(hook.wouldExceedLock(id, 250, 1100));
    }

    function test_permissions_onlyBeforeRemove() public view {
        Hooks.Permissions memory p = hook.getHookPermissions();
        assertTrue(p.beforeRemoveLiquidity);
        assertFalse(p.afterInitialize);
        assertFalse(p.beforeSwap);
        assertFalse(p.afterSwap);
        assertFalse(p.beforeAddLiquidity);
    }
}
