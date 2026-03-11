// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./GuaraniToken.sol";

contract Receiver {
    GuaraniToken public immutable token;
    address public immutable relayer;
    mapping(uint256 => bool) public processed;

    event Minted(
        uint256 indexed id,
        address indexed to,
        uint256 amount
    );

    modifier onlyRelayer() {
        require(msg.sender == relayer, "Receiver: not relayer");
        _;
    }

    constructor(GuaraniToken _token, address _relayer) {
        token = _token;
        relayer = _relayer;
    }

    function mintRemote(
        uint256 id,
        address to,
        uint256 amount
    ) external onlyRelayer {
        require(!processed[id], "Receiver: replay");
        processed[id] = true;
        token.mint(to, amount);
        emit Minted(id, to, amount);
    }
}
