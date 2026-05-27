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

import {DemoToken} from "./DemoToken.sol";
import {LatchHook} from "./LatchHook.sol";
import {LatchRegistry} from "./LatchRegistry.sol";
import {Schedule} from "./libraries/LatchTypes.sol";

contract RugDemo is IUnlockCallback {
    using PoolIdLibrary for PoolKey;
    using CurrencySettler for Currency;

    IPoolManager public immutable poolManager;
    LatchHook public immutable hook;
    LatchRegistry public immutable registry;

    DemoToken public immutable token0;
    DemoToken public immutable token1;

    uint24 public constant FEE = 3000;
    int24 public constant TICK_SPACING = 60;
    uint160 internal constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    uint128 public constant LOCKED_LIQUIDITY = 1e18;
    uint64 public constant CLIFF_TIME = 4102444800;
    uint64 public constant PERIOD_LENGTH = 2592000;
    uint32 public constant PERIODS_COUNT = 12;

    PoolKey public key;
    int24 public tickLower;
    int24 public tickUpper;
    bool public ready;

    enum Op {
        Seed,
        Rug
    }

    event DemoReady(PoolId indexed poolId, address token0, address token1, uint128 lockedLiquidity);

    error AlreadyReady();
    error NotReady();
    error NotPoolManager();
    error ZeroAmount();

    constructor(IPoolManager _poolManager, LatchHook _hook, LatchRegistry _registry) {
        poolManager = _poolManager;
        hook = _hook;
        registry = _registry;

        DemoToken a = new DemoToken("Latch Demo", "LDEMO", 1e30, address(this));
        DemoToken b = new DemoToken("Latch Demo Quote", "LQUOTE", 1e30, address(this));
        (token0, token1) = address(a) < address(b) ? (a, b) : (b, a);
    }

    function setup() external {
        if (ready) revert AlreadyReady();

        PoolKey memory k = PoolKey(
            Currency.wrap(address(token0)), Currency.wrap(address(token1)), FEE, TICK_SPACING, IHooks(address(hook))
        );
        key = k;
        poolManager.initialize(k, SQRT_PRICE_1_1);

        tickLower = TickMath.minUsableTick(TICK_SPACING);
        tickUpper = TickMath.maxUsableTick(TICK_SPACING);

        poolManager.unlock(abi.encode(Op.Seed, int256(uint256(LOCKED_LIQUIDITY))));

        hook.setSchedule(k, CLIFF_TIME, PERIOD_LENGTH, PERIODS_COUNT, uint256(LOCKED_LIQUIDITY));

        Schedule memory s =
            Schedule(CLIFF_TIME, PERIOD_LENGTH, PERIODS_COUNT, address(this), uint256(LOCKED_LIQUIDITY));
        registry.register(k.toId(), address(hook), address(this), s, address(token0), address(token1));

        ready = true;
        emit DemoReady(k.toId(), address(token0), address(token1), LOCKED_LIQUIDITY);
    }

    function attempt(uint128 amount) external {
        if (!ready) revert NotReady();
        if (amount == 0) revert ZeroAmount();
        poolManager.unlock(abi.encode(Op.Rug, -int256(uint256(amount))));
    }

    function attemptFull() external {
        if (!ready) revert NotReady();
        poolManager.unlock(abi.encode(Op.Rug, -int256(uint256(LOCKED_LIQUIDITY))));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        (Op op, int256 liq) = abi.decode(data, (Op, int256));

        (BalanceDelta delta,) =
            poolManager.modifyLiquidity(key, ModifyLiquidityParams(tickLower, tickUpper, liq, bytes32(0)), "");

        if (op == Op.Seed) {
            if (delta.amount0() < 0) {
                key.currency0.settle(poolManager, address(this), uint256(uint128(-delta.amount0())), false);
            }
            if (delta.amount1() < 0) {
                key.currency1.settle(poolManager, address(this), uint256(uint128(-delta.amount1())), false);
            }
        }
        return "";
    }

    function poolId() external view returns (PoolId) {
        return key.toId();
    }

    function releasedNow() external view returns (uint256) {
        return hook.releasedAmount(key.toId(), block.timestamp);
    }

    function removedSoFar() external view returns (uint256) {
        return hook.removedSoFar(key.toId());
    }

    function schedule() external view returns (Schedule memory s) {
        (uint64 cliffTime, uint64 periodLength, uint32 periodsCount, address creator, uint256 totalLocked) =
            hook.schedules(key.toId());
        s = Schedule(cliffTime, periodLength, periodsCount, creator, totalLocked);
    }
}
