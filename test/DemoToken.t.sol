// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {DemoToken} from "../src/DemoToken.sol";

contract DemoTokenTest is Test {
    function test_fixedSupplyMintedToRecipient() public {
        DemoToken t = new DemoToken("Latch Demo", "LATCH", 1_000_000 ether, address(this));
        assertEq(t.totalSupply(), 1_000_000 ether);
        assertEq(t.balanceOf(address(this)), 1_000_000 ether);
        assertEq(t.name(), "Latch Demo");
        assertEq(t.symbol(), "LATCH");
    }

    function test_transfers() public {
        DemoToken t = new DemoToken("Latch Demo", "LATCH", 1000, address(this));
        t.transfer(address(0xBEEF), 400);
        assertEq(t.balanceOf(address(0xBEEF)), 400);
        assertEq(t.balanceOf(address(this)), 600);
    }

    function test_supplyFixedAtConstruction() public {
        // DemoToken exposes no external mint; supply is immutable after deploy.
        DemoToken t = new DemoToken("Latch Demo", "LATCH", 1000, address(this));
        assertEq(t.totalSupply(), 1000);
    }
}
