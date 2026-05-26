// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title DemoToken
/// @notice Fixed-supply ERC-20 launched by Latch. No mint, no blacklist, no pause,
///         no owner privileges — a malicious token would defeat any LP lock, so the
///         launched asset is deliberately inert. This is what makes a lock meaningful.
contract DemoToken is ERC20 {
    /// @param name_ Token name.
    /// @param symbol_ Token symbol.
    /// @param supply Total fixed supply, minted once at construction.
    /// @param recipient Receiver of the entire supply.
    constructor(string memory name_, string memory symbol_, uint256 supply, address recipient) ERC20(name_, symbol_) {
        _mint(recipient, supply);
    }
}
