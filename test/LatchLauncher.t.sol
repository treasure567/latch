// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {Constants} from "@uniswap/v4-core/test/utils/Constants.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";

import {BaseTest} from "./utils/BaseTest.sol";
import {LatchHook} from "../src/LatchHook.sol";
import {LatchRegistry} from "../src/LatchRegistry.sol";
import {LatchLauncher} from "../src/LatchLauncher.sol";

contract LatchLauncherTest is BaseTest {
    using PoolIdLibrary for PoolKey;

    LatchHook hook;
    LatchRegistry registry;
    LatchLauncher launcher;
    MockERC20 quote;

    function setUp() public {
        deployArtifactsAndLabel();

        address flags = address(uint160(Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG) ^ (0x5551 << 144));
        deployCodeTo("LatchHook.sol:LatchHook", abi.encode(poolManager), flags);
        hook = LatchHook(flags);

        registry = new LatchRegistry();
        launcher = new LatchLauncher(poolManager, hook, registry);

        quote = new MockERC20("Quote", "Q", 18);
        quote.mint(address(this), 1_000_000 ether);
        quote.approve(address(launcher), type(uint256).max);
    }

    function _params() internal view returns (LatchLauncher.LaunchParams memory) {
        return LatchLauncher.LaunchParams({
            name: "Latch Demo",
            symbol: "LATCH",
            tokenSupply: 1_000_000 ether,
            quoteCurrency: Currency.wrap(address(quote)),
            quoteFunding: 500_000 ether,
            fee: 3000,
            tickSpacing: 60,
            sqrtPriceX96: Constants.SQRT_PRICE_1_1,
            liquidity: 50e18,
            cliffTime: uint64(block.timestamp + 1000),
            periodLength: 1000,
            periodsCount: 4
        });
    }

    function test_launch_endToEnd() public {
        (PoolId id, address token) = launcher.launch(_params());

        // Registry shows the pool verified.
        assertTrue(registry.isVerified(id));

        // Hook holds the immutable schedule for the seeded liquidity.
        (,,, address creator, uint256 total) = hook.schedules(id);
        assertEq(total, 50e18);
        assertEq(creator, address(launcher));

        // Token deployed with the requested fixed supply.
        assertEq(IERC20(token).totalSupply(), 1_000_000 ether);

        // Registry entry carries the release terms and hook.
        LatchRegistry.Entry memory e = registry.getEntry(id);
        assertEq(e.hook, address(hook));
        assertEq(e.schedule.totalLocked, 50e18);
    }

    function test_launch_quotePulledFromCreator() public {
        uint256 balBefore = quote.balanceOf(address(this));
        launcher.launch(_params());
        // Some quote was pulled to seed the pool (full-range 1:1 position).
        assertLt(quote.balanceOf(address(this)), balBefore);
    }

    function test_launchedPool_isLockedBeforeCliff() public {
        (PoolId id,) = launcher.launch(_params());
        // The full seed is locked before the cliff: nothing is released, and any
        // removal would exceed the lock — the hook would revert it (proven against a
        // live removal in LatchHookIntegrationTest).
        assertEq(hook.releasedAmount(id, block.timestamp), 0);
        assertTrue(hook.wouldExceedLock(id, 1, block.timestamp));
    }
}
