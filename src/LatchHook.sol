// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "@openzeppelin/uniswap-hooks/src/base/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Schedule} from "./libraries/LatchTypes.sol";
import {LatchMath} from "./libraries/LatchMath.sol";

/// @title LatchHook
/// @notice Uniswap v4 hook that reverts any liquidity removal exceeding the cumulative
///         amount released by a public, immutable vesting schedule. The pool you can't rug.
/// @dev Enforcement is pure pool state: no oracle, no identity check, no admin key. The
///      gate fires regardless of who owns or transfers the LP position.
contract LatchHook is BaseHook {
    using PoolIdLibrary for PoolKey;
    using LatchMath for Schedule;

    /// @notice Release schedule per pool. A non-zero `totalLocked` marks a pool as governed.
    mapping(PoolId => Schedule) public schedules;
    /// @notice Cumulative liquidity (L) already removed from each pool.
    mapping(PoolId => uint256) public removedSoFar;

    /// @notice Emitted when a pool's immutable schedule is written.
    event ScheduleSet(
        PoolId indexed poolId,
        address indexed creator,
        uint256 totalLocked,
        uint64 cliffTime,
        uint64 periodLength,
        uint32 periodsCount
    );
    /// @notice Emitted when a permitted (vested) removal passes the gate.
    event LiquidityReleased(PoolId indexed poolId, uint256 amount, uint256 cumulativeRemoved, uint256 released);

    /// @notice A schedule already exists for this pool (write-once).
    error ScheduleExists();
    /// @notice Schedule parameters are invalid (zero period, zero count, or zero locked).
    error InvalidSchedule();
    /// @notice A removal exceeded the released amount — the rug is blocked.
    /// @dev Surfaced as the revert reason on the failed transaction (v4 re-wraps it in WrappedError).
    error RugBlocked(uint256 requested, uint256 alreadyRemoved, uint256 released);

    /// @param _poolManager The v4 PoolManager singleton.
    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {}

    /// @inheritdoc BaseHook
    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: true,
            afterRemoveLiquidity: false,
            beforeSwap: false,
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    /// @notice Write the immutable release schedule for a pool. Callable exactly once.
    /// @dev `creator` is recorded as `msg.sender`; the launcher calls this right after seeding.
    /// @param key The pool key.
    /// @param cliffTime Unix timestamp before which nothing is releasable.
    /// @param periodLength Seconds per vesting step.
    /// @param periodsCount Number of equal steps to reach 100%.
    /// @param totalLocked Liquidity units (L) the schedule governs.
    function setSchedule(
        PoolKey calldata key,
        uint64 cliffTime,
        uint64 periodLength,
        uint32 periodsCount,
        uint256 totalLocked
    ) external {
        PoolId id = key.toId();
        if (schedules[id].totalLocked != 0) revert ScheduleExists();
        if (periodLength == 0 || periodsCount == 0 || totalLocked == 0) revert InvalidSchedule();
        schedules[id] = Schedule(cliffTime, periodLength, periodsCount, msg.sender, totalLocked);
        emit ScheduleSet(id, msg.sender, totalLocked, cliffTime, periodLength, periodsCount);
    }

    /// @notice Cumulative liquidity released for a pool at `timestamp`.
    function releasedAmount(PoolId id, uint256 timestamp) public view returns (uint256) {
        return schedules[id].releasedAmount(timestamp);
    }

    /// @notice Whether removing `amount` at `timestamp` would exceed the lock for `id`.
    function wouldExceedLock(PoolId id, uint256 amount, uint256 timestamp) public view returns (bool) {
        return removedSoFar[id] + amount > releasedAmount(id, timestamp);
    }

    /// @inheritdoc BaseHook
    /// @dev Reverts `RugBlocked` if the cumulative removal would exceed the released amount.
    ///      Pools without a schedule pass through (not Latch-governed).
    function _beforeRemoveLiquidity(
        address,
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        bytes calldata
    ) internal override returns (bytes4) {
        PoolId id = key.toId();
        Schedule memory s = schedules[id];
        if (s.totalLocked == 0) return BaseHook.beforeRemoveLiquidity.selector; // not Latch-governed
        if (params.liquidityDelta >= 0) return BaseHook.beforeRemoveLiquidity.selector; // not a removal

        uint256 removeAmount = uint256(-params.liquidityDelta);
        uint256 released = s.releasedAmount(block.timestamp);
        uint256 already = removedSoFar[id];
        if (already + removeAmount > released) revert RugBlocked(removeAmount, already, released);

        removedSoFar[id] = already + removeAmount;
        emit LiquidityReleased(id, removeAmount, already + removeAmount, released);
        return BaseHook.beforeRemoveLiquidity.selector;
    }
}
