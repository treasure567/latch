// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {Constants} from "@uniswap/v4-core/test/utils/Constants.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";

import {EasyPosm} from "./utils/libraries/EasyPosm.sol";
import {BaseTest} from "./utils/BaseTest.sol";
import {LatchHook} from "../src/LatchHook.sol";

/// @notice Integration tests exercising removals through a real local PoolManager.
contract LatchHookIntegrationTest is BaseTest {
    using EasyPosm for IPositionManager;
    using PoolIdLibrary for PoolKey;

    LatchHook hook;
    Currency currency0;
    Currency currency1;
    PoolKey poolKey;
    PoolId poolId;
    uint256 tokenId;
    int24 tickLower;
    int24 tickUpper;
    uint128 constant LIQ = 100e18;
    uint256 cliff;

    function setUp() public {
        deployArtifactsAndLabel();
        (currency0, currency1) = deployCurrencyPair();

        address flags = address(uint160(Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG) ^ (0x5550 << 144));
        deployCodeTo("LatchHook.sol:LatchHook", abi.encode(poolManager), flags);
        hook = LatchHook(flags);

        poolKey = PoolKey(currency0, currency1, 3000, 60, IHooks(hook));
        poolId = poolKey.toId();
        poolManager.initialize(poolKey, Constants.SQRT_PRICE_1_1);

        tickLower = TickMath.minUsableTick(poolKey.tickSpacing);
        tickUpper = TickMath.maxUsableTick(poolKey.tickSpacing);
        (uint256 a0, uint256 a1) = LiquidityAmounts.getAmountsForLiquidity(
            Constants.SQRT_PRICE_1_1,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            LIQ
        );
        (tokenId,) = positionManager.mint(
            poolKey, tickLower, tickUpper, LIQ, a0 + 1, a1 + 1, address(this), block.timestamp, Constants.ZERO_BYTES
        );

        // Lock: cliff in 1000s, 4 periods of 1000s, governing the seeded liquidity.
        cliff = block.timestamp + 1000;
        hook.setSchedule(poolKey, uint64(cliff), 1000, 4, LIQ);
    }

    function _decrease(uint256 amount) internal {
        positionManager.decreaseLiquidity(tokenId, amount, 0, 0, address(this), block.timestamp, Constants.ZERO_BYTES);
    }

    /// @dev External wrapper so a single external-call boundary exists for `vm.expectRevert`.
    ///      (`EasyPosm.decreaseLiquidity` is a library call making several external sub-calls.)
    function decreaseExternal(uint256 amount) external {
        require(msg.sender == address(this), "self only");
        _decrease(amount);
    }

    function test_removeBeforeCliff_reverts() public {
        // Lock semantics: nothing released before the cliff, so any removal is blocked.
        assertTrue(hook.wouldExceedLock(poolId, 1e18, block.timestamp));
        vm.expectRevert();
        this.decreaseExternal(1e18);
        assertEq(hook.removedSoFar(poolId), 0); // nothing was removed
    }

    function test_removeMoreThanReleased_reverts() public {
        vm.warp(cliff + 1000); // 1 period past cliff -> 25% = 25e18 released
        assertTrue(hook.wouldExceedLock(poolId, 30e18, block.timestamp));
        vm.expectRevert();
        this.decreaseExternal(30e18);
        assertEq(hook.removedSoFar(poolId), 0);
    }

    function test_removeVestedPortion_succeeds() public {
        vm.warp(cliff + 1000); // 25e18 released
        _decrease(20e18);
        assertEq(hook.removedSoFar(poolId), 20e18);
    }

    function test_cumulativeCap_secondRemovalBlocked() public {
        vm.warp(cliff + 1000); // 25e18 released
        _decrease(20e18);
        assertTrue(hook.wouldExceedLock(poolId, 10e18, block.timestamp)); // 20 + 10 > 25
        vm.expectRevert();
        this.decreaseExternal(10e18);
        assertEq(hook.removedSoFar(poolId), 20e18); // unchanged by the blocked attempt
    }

    function test_fullRemovalAfterVest_succeeds() public {
        vm.warp(cliff + 4000); // fully vested
        _decrease(LIQ);
        assertEq(hook.removedSoFar(poolId), LIQ);
    }
}
