// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";

import {LatchHook} from "../src/LatchHook.sol";
import {LatchRegistry} from "../src/LatchRegistry.sol";
import {RugDemo} from "../src/RugDemo.sol";

contract DeployRugDemo is Script {
    address internal constant XLAYER_POOL_MANAGER = 0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32;
    address internal constant XLAYER_LATCH_HOOK = 0xf856b2992612d55874cE2f8fB2cAb1B3a5Bf8200;
    address internal constant XLAYER_LATCH_REGISTRY = 0x5Af8F4928A776A7d656B873CF91B9614C8c23f86;

    function run() external returns (RugDemo demo) {
        IPoolManager pm = IPoolManager(_env("POOL_MANAGER", XLAYER_POOL_MANAGER));
        LatchHook hook = LatchHook(_env("LATCH_HOOK", XLAYER_LATCH_HOOK));
        LatchRegistry registry = LatchRegistry(_env("LATCH_REGISTRY", XLAYER_LATCH_REGISTRY));

        require(address(pm).code.length > 0, "PoolManager has no code");
        require(address(hook).code.length > 0, "LatchHook has no code");
        require(address(registry).code.length > 0, "LatchRegistry has no code");

        vm.startBroadcast();
        demo = new RugDemo(pm, hook, registry);
        demo.setup();
        vm.stopBroadcast();

        console2.log("Chain id:     ", block.chainid);
        console2.log("RugDemo:      ", address(demo));
        console2.log("token0:       ", address(demo.token0()));
        console2.log("token1:       ", address(demo.token1()));
        console2.log("poolId:       ", vm.toString(PoolId.unwrap(demo.poolId())));
        console2.log("locked L:     ", uint256(demo.LOCKED_LIQUIDITY()));
        console2.log("released now: ", demo.releasedNow());
        console2.log("verified:     ", registry.isVerified(demo.poolId()));
    }

    function _env(string memory name, address fallbackAddr) internal view returns (address) {
        try vm.envAddress(name) returns (address a) {
            return a;
        } catch {
            return fallbackAddr;
        }
    }
}
