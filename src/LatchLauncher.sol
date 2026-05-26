// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {CurrencySettler} from "@openzeppelin/uniswap-hooks/src/utils/CurrencySettler.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {DemoToken} from "./DemoToken.sol";
import {LatchHook} from "./LatchHook.sol";
import {LatchRegistry} from "./LatchRegistry.sol";
import {Schedule} from "./libraries/LatchTypes.sol";

/// @title LatchLauncher
/// @notice Stands up a rug-proof pool in one transaction: deploy a fixed-supply token,
///         initialize the pool with the canonical Latch hook, seed full-range liquidity,
///         write the immutable release schedule, and list the pool as Latch-verified.
contract LatchLauncher is IUnlockCallback {
    using PoolIdLibrary for PoolKey;
    using CurrencySettler for Currency;

    /// @notice The v4 PoolManager singleton.
    IPoolManager public immutable poolManager;
    /// @notice The canonical Latch hook all launched pools use.
    LatchHook public immutable hook;
    /// @notice The verify-before-you-buy registry.
    LatchRegistry public immutable registry;

    /// @notice Parameters for a one-transaction launch.
    struct LaunchParams {
        string name;
        string symbol;
        uint256 tokenSupply;
        Currency quoteCurrency; // the paired asset the creator funds
        uint256 quoteFunding; // amount of quote pulled from the creator to seed
        uint24 fee;
        int24 tickSpacing;
        uint160 sqrtPriceX96;
        uint128 liquidity; // full-range liquidity (L) to seed and lock
        uint64 cliffTime;
        uint64 periodLength;
        uint32 periodsCount;
    }

    /// @notice Emitted when a verified, rug-proof pool is launched.
    event PoolLaunched(PoolId indexed poolId, address indexed token, address indexed creator, uint128 liquidity);

    /// @notice unlockCallback was not called by the PoolManager.
    error NotPoolManager();

    /// @param _poolManager The v4 PoolManager.
    /// @param _hook The canonical Latch hook.
    /// @param _registry The Latch registry.
    constructor(IPoolManager _poolManager, LatchHook _hook, LatchRegistry _registry) {
        poolManager = _poolManager;
        hook = _hook;
        registry = _registry;
    }

    /// @notice Launch a verified, rug-proof pool atomically.
    /// @dev Caller must have approved `quoteFunding` of `quoteCurrency` to this launcher.
    /// @param p The launch parameters.
    /// @return id The launched pool's id.
    /// @return token The deployed DemoToken address.
    function launch(LaunchParams calldata p) external returns (PoolId id, address token) {
        DemoToken demo = new DemoToken(p.name, p.symbol, p.tokenSupply, address(this));
        token = address(demo);

        // Pull the creator's quote funding so the launcher can settle the seed.
        IERC20(Currency.unwrap(p.quoteCurrency)).transferFrom(msg.sender, address(this), p.quoteFunding);

        // Sort the pair into (currency0, currency1) by address.
        (Currency c0, Currency c1) = address(demo) < Currency.unwrap(p.quoteCurrency)
            ? (Currency.wrap(address(demo)), p.quoteCurrency)
            : (p.quoteCurrency, Currency.wrap(address(demo)));

        PoolKey memory key = PoolKey(c0, c1, p.fee, p.tickSpacing, IHooks(address(hook)));
        id = key.toId();
        poolManager.initialize(key, p.sqrtPriceX96);

        int24 tickLower = TickMath.minUsableTick(p.tickSpacing);
        int24 tickUpper = TickMath.maxUsableTick(p.tickSpacing);
        poolManager.unlock(abi.encode(key, tickLower, tickUpper, int256(uint256(p.liquidity))));

        // Write the immutable lock, then list the pool as verified.
        hook.setSchedule(key, p.cliffTime, p.periodLength, p.periodsCount, uint256(p.liquidity));
        Schedule memory s = Schedule(p.cliffTime, p.periodLength, p.periodsCount, msg.sender, uint256(p.liquidity));
        registry.register(id, address(hook), msg.sender, s, Currency.unwrap(c0), Currency.unwrap(c1));

        emit PoolLaunched(id, token, msg.sender, p.liquidity);
    }

    /// @inheritdoc IUnlockCallback
    /// @dev Adds the seed liquidity and settles the owed currencies from the launcher's balance.
    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        (PoolKey memory key, int24 tickLower, int24 tickUpper, int256 liq) =
            abi.decode(data, (PoolKey, int24, int24, int256));

        (BalanceDelta delta,) =
            poolManager.modifyLiquidity(key, ModifyLiquidityParams(tickLower, tickUpper, liq, bytes32(0)), "");

        // Adding liquidity: deltas are owed by us (negative) — settle from the launcher's balance.
        if (delta.amount0() < 0) {
            key.currency0.settle(poolManager, address(this), uint256(uint128(-delta.amount0())), false);
        }
        if (delta.amount1() < 0) {
            key.currency1.settle(poolManager, address(this), uint256(uint128(-delta.amount1())), false);
        }
        return "";
    }
}
