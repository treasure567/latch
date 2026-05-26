// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

import {LatchHook} from "../src/LatchHook.sol";
import {LatchRegistry} from "../src/LatchRegistry.sol";
import {LatchLauncher} from "../src/LatchLauncher.sol";

/// @notice Deploys the Latch contracts: mines a flag-encoded hook address, deploys the
///         hook via CREATE2, then the registry and launcher.
/// @dev    Run a fork simulation first (no broadcast, no funds):
///           forge script script/DeployLatch.s.sol --fork-url $XLAYER_RPC_URL
///         Then broadcast for real:
///           forge script script/DeployLatch.s.sol --rpc-url $XLAYER_RPC_URL \
///             --private-key $PRIVATE_KEY --broadcast --verify
contract DeployLatch is Script {
    /// @dev Uniswap v4 PoolManager on X Layer mainnet (chainId 196). Confirmed onchain:
    ///      ~48KB of code present and `owner()` resolves. Override with the POOL_MANAGER env
    ///      var for other chains / local forks.
    address internal constant XLAYER_POOL_MANAGER = 0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32;

    function run() external returns (LatchHook hook, LatchRegistry registry, LatchLauncher launcher) {
        IPoolManager pm = IPoolManager(_poolManager());
        require(address(pm).code.length > 0, "PoolManager has no code on this chain");

        // The hook address must encode exactly the BEFORE_REMOVE_LIQUIDITY flag.
        uint160 flags = uint160(Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG);
        bytes memory constructorArgs = abi.encode(pm);
        (address hookAddr, bytes32 salt) =
            HookMiner.find(CREATE2_FACTORY, flags, type(LatchHook).creationCode, constructorArgs);

        vm.startBroadcast();
        registry = new LatchRegistry();
        hook = new LatchHook{salt: salt}(pm);
        require(address(hook) == hookAddr, "hook address mismatch");
        launcher = new LatchLauncher(pm, hook, registry);
        vm.stopBroadcast();

        console2.log("Chain id:        ", block.chainid);
        console2.log("PoolManager:     ", address(pm));
        console2.log("LatchRegistry:   ", address(registry));
        console2.log("LatchHook:       ", address(hook));
        console2.log("LatchLauncher:   ", address(launcher));
    }

    /// @dev POOL_MANAGER env override, else the X Layer mainnet address.
    function _poolManager() internal view returns (address) {
        try vm.envAddress("POOL_MANAGER") returns (address a) {
            return a;
        } catch {
            return XLAYER_POOL_MANAGER;
        }
    }
}
