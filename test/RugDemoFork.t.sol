// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

import {LatchHook} from "../src/LatchHook.sol";
import {LatchRegistry} from "../src/LatchRegistry.sol";
import {RugDemo} from "../src/RugDemo.sol";

contract RugDemoForkTest is Test {
    address constant POOL_MANAGER = 0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32;
    address constant HOOK = 0xf856b2992612d55874cE2f8fB2cAb1B3a5Bf8200;
    address constant REGISTRY = 0x5Af8F4928A776A7d656B873CF91B9614C8c23f86;

    RugDemo demo;

    function setUp() public {
        vm.createSelectFork(vm.envOr("XLAYER_RPC_URL", string("https://rpc.xlayer.tech")));
        demo = new RugDemo(IPoolManager(POOL_MANAGER), LatchHook(HOOK), LatchRegistry(REGISTRY));
        demo.setup();
    }

    function test_setup_locksLiquidity() public view {
        assertTrue(demo.ready());
        assertEq(demo.releasedNow(), 0);
        assertEq(demo.removedSoFar(), 0);
        assertEq(demo.schedule().totalLocked, uint256(demo.LOCKED_LIQUIDITY()));
        assertTrue(LatchRegistry(REGISTRY).isVerified(demo.poolId()));
    }

    function test_attempt_isBlocked() public {
        vm.expectRevert();
        demo.attempt(1e6);
        assertEq(demo.removedSoFar(), 0);
    }

    function test_attemptFull_isBlocked() public {
        vm.expectRevert();
        demo.attemptFull();
        assertEq(demo.removedSoFar(), 0);
    }

    function test_attempt_fromStranger_isBlocked() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert();
        demo.attempt(5e17);
        assertEq(demo.removedSoFar(), 0);
    }

    function test_revertData_carriesRugBlocked() public {
        (bool ok, bytes memory ret) = address(demo).call(abi.encodeWithSelector(RugDemo.attemptFull.selector));
        assertFalse(ok);
        assertEq(bytes4(ret), bytes4(keccak256("WrappedError(address,bytes4,bytes,bytes)")));
        assertTrue(_containsSelector(ret, bytes4(keccak256("RugBlocked(uint256,uint256,uint256)"))));
    }

    function _containsSelector(bytes memory hay, bytes4 sel) internal pure returns (bool) {
        if (hay.length < 4) return false;
        for (uint256 i = 0; i + 4 <= hay.length; i++) {
            if (hay[i] == sel[0] && hay[i + 1] == sel[1] && hay[i + 2] == sel[2] && hay[i + 3] == sel[3]) {
                return true;
            }
        }
        return false;
    }
}
