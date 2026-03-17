export const blindAuctionMarketAbi = [
  { "inputs":[{ "internalType":"address","name":"cac","type":"address"}], "stateMutability":"nonpayable","type":"constructor" },
  { "inputs":[], "name":"nextId", "outputs":[{ "internalType":"uint256","name":"","type":"uint256"}], "stateMutability":"view","type":"function" },
  { "inputs":[{ "internalType":"uint256","name":"id","type":"uint256"}], "name":"auctions",
    "outputs":[
      { "internalType":"uint256","name":"id","type":"uint256"},
      { "internalType":"address","name":"seller","type":"address"},
      { "internalType":"uint256","name":"amountCAC","type":"uint256"},
      { "internalType":"uint256","name":"reserveWei","type":"uint256"},
      { "internalType":"uint256","name":"buyoutWei","type":"uint256"},
      { "internalType":"uint64","name":"commitEndTime","type":"uint64"},
      { "internalType":"uint64","name":"revealEndTime","type":"uint64"},
      { "internalType":"uint8","name":"status","type":"uint8"},
      { "internalType":"address","name":"highestBidder","type":"address"},
      { "internalType":"uint256","name":"highestBid","type":"uint256"},
      { "internalType":"uint256","name":"commitCount","type":"uint256"}
    ], "stateMutability":"view","type":"function"
  },
  { "inputs":[
    { "internalType":"uint256","name":"amountCAC","type":"uint256"},
    { "internalType":"uint256","name":"reserveWei","type":"uint256"},
    { "internalType":"uint256","name":"buyoutWei","type":"uint256"},
    { "internalType":"uint64","name":"commitEndTime","type":"uint64"},
    { "internalType":"uint64","name":"revealEndTime","type":"uint64"}
  ], "name":"listBlindAuction","outputs":[{ "internalType":"uint256","name":"id","type":"uint256"}], "stateMutability":"nonpayable","type":"function" },

  { "inputs":[{ "internalType":"uint256","name":"id","type":"uint256"},{ "internalType":"bytes32","name":"c","type":"bytes32"}],
    "name":"commitBid","outputs":[], "stateMutability":"payable","type":"function" },

  { "inputs":[{ "internalType":"uint256","name":"id","type":"uint256"},{ "internalType":"uint256","name":"bidWei","type":"uint256"},{ "internalType":"bytes32","name":"salt","type":"bytes32"}],
    "name":"revealBid","outputs":[], "stateMutability":"nonpayable","type":"function" },

  { "inputs":[{ "internalType":"uint256","name":"id","type":"uint256"}], "name":"finalize","outputs":[], "stateMutability":"nonpayable","type":"function" },
  { "inputs":[{ "internalType":"uint256","name":"id","type":"uint256"}], "name":"cancel","outputs":[], "stateMutability":"nonpayable","type":"function" },
  { "inputs":[{ "internalType":"uint256","name":"id","type":"uint256"}], "name":"prepareUnrevealedRefund","outputs":[], "stateMutability":"nonpayable","type":"function" },

  { "inputs":[{ "internalType":"address","name":"","type":"address"}], "name":"pendingRefund","outputs":[{ "internalType":"uint256","name":"","type":"uint256"}], "stateMutability":"view","type":"function" },
  { "inputs":[], "name":"withdrawRefund","outputs":[], "stateMutability":"nonpayable","type":"function" },

  { "anonymous":false,"inputs":[{ "indexed":true,"internalType":"uint256","name":"id","type":"uint256"},{ "indexed":true,"internalType":"address","name":"seller","type":"address"},{ "indexed":false,"internalType":"uint256","name":"amountCAC","type":"uint256"},{ "indexed":false,"internalType":"uint256","name":"reserveWei","type":"uint256"},{ "indexed":false,"internalType":"uint256","name":"buyoutWei","type":"uint256"},{ "indexed":false,"internalType":"uint64","name":"commitEndTime","type":"uint64"},{ "indexed":false,"internalType":"uint64","name":"revealEndTime","type":"uint64"}],"name":"Listed","type":"event" },
  { "anonymous":false,"inputs":[{ "indexed":true,"internalType":"uint256","name":"id","type":"uint256"},{ "indexed":true,"internalType":"address","name":"bidder","type":"address"},{ "indexed":false,"internalType":"bytes32","name":"commitment","type":"bytes32"},{ "indexed":false,"internalType":"uint256","name":"depositWei","type":"uint256"}],"name":"Committed","type":"event" },
  { "anonymous":false,"inputs":[{ "indexed":true,"internalType":"uint256","name":"id","type":"uint256"},{ "indexed":true,"internalType":"address","name":"bidder","type":"address"},{ "indexed":false,"internalType":"uint256","name":"bidWei","type":"uint256"}],"name":"Revealed","type":"event" },
  { "anonymous":false,"inputs":[{ "indexed":true,"internalType":"uint256","name":"id","type":"uint256"},{ "indexed":true,"internalType":"address","name":"winner","type":"address"},{ "indexed":false,"internalType":"uint256","name":"priceWei","type":"uint256"}],"name":"Finalized","type":"event" },
  { "anonymous":false,"inputs":[{ "indexed":true,"internalType":"uint256","name":"id","type":"uint256"}],"name":"Cancelled","type":"event" },
  { "anonymous":false,"inputs":[{ "indexed":true,"internalType":"uint256","name":"id","type":"uint256"},{ "indexed":true,"internalType":"address","name":"bidder","type":"address"},{ "indexed":false,"internalType":"uint256","name":"amountWei","type":"uint256"}],"name":"UnrevealedRefundPrepared","type":"event" },
  { "anonymous":false,"inputs":[{ "indexed":true,"internalType":"address","name":"user","type":"address"},{ "indexed":false,"internalType":"uint256","name":"amountWei","type":"uint256"}],"name":"Refunded","type":"event" },
];
