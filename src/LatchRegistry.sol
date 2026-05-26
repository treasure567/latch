// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Schedule} from "./libraries/LatchTypes.sol";

/// @title LatchRegistry
/// @notice Onchain directory of pools provably locked by a Latch hook, so buyers can
///         verify before they buy. Listing is a convenience index: frontends should
///         cross-check `hook` against the canonical Latch hook and read the schedule
///         from the hook directly for a fully trustless check.
contract LatchRegistry {
    /// @notice A registry record for a Latch-locked pool.
    struct Entry {
        bool verified;
        address hook;
        address creator;
        Schedule schedule;
        address token0;
        address token1;
    }

    mapping(PoolId => Entry) internal entries;

    /// @notice Emitted when a pool is listed as Latch-verified.
    event PoolVerified(
        PoolId indexed poolId, address indexed hook, address indexed creator, address token0, address token1
    );

    /// @notice The pool is already registered.
    error AlreadyRegistered();

    /// @notice List a locked pool. One-time per pool.
    /// @param id The pool id.
    /// @param hook The Latch hook governing the pool.
    /// @param creator The pool creator.
    /// @param schedule The public release schedule.
    /// @param token0 The pool's currency0 address.
    /// @param token1 The pool's currency1 address.
    function register(
        PoolId id,
        address hook,
        address creator,
        Schedule calldata schedule,
        address token0,
        address token1
    ) external {
        if (entries[id].hook != address(0)) revert AlreadyRegistered();
        entries[id] = Entry(true, hook, creator, schedule, token0, token1);
        emit PoolVerified(id, hook, creator, token0, token1);
    }

    /// @notice Whether a pool is listed as Latch-verified.
    function isVerified(PoolId id) external view returns (bool) {
        return entries[id].verified;
    }

    /// @notice Full registry entry (release terms) for a pool.
    function getEntry(PoolId id) external view returns (Entry memory) {
        return entries[id];
    }
}
