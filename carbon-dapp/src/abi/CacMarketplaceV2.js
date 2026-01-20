// src/abi/CacMarketplaceV2.js
export const marketV2Abi = [
  { "inputs":[{ "internalType":"address","name":"cac","type":"address"}],
    "stateMutability":"nonpayable","type":"constructor" },

  // ===== Sell listings (fixed/open auction) =====
  { "inputs":[], "name":"nextId","outputs":[{ "internalType":"uint256","name":"","type":"uint256"}],
    "stateMutability":"view","type":"function" },

  { "inputs":[
      { "internalType":"uint256","name":"amountCAC","type":"uint256" },
      { "internalType":"uint256","name":"priceWei","type":"uint256" }
    ],
    "name":"listFixed","outputs":[{ "internalType":"uint256","name":"id","type":"uint256"}],
    "stateMutability":"nonpayable","type":"function" },

  { "inputs":[
      { "internalType":"uint256","name":"amountCAC","type":"uint256" },
      { "internalType":"uint256","name":"reserveWei","type":"uint256" },
      { "internalType":"uint256","name":"buyoutWei","type":"uint256" },
      { "internalType":"uint64","name":"endTime","type":"uint64" }
    ],
    "name":"listAuction","outputs":[{ "internalType":"uint256","name":"id","type":"uint256"}],
    "stateMutability":"nonpayable","type":"function" },

  { "inputs":[ { "internalType":"uint256","name":"id","type":"uint256" } ],
    "name":"getListing",
    "outputs":[ { "components":[
        { "internalType":"uint256","name":"id","type":"uint256" },
        { "internalType":"address","name":"seller","type":"address" },
        { "internalType":"uint256","name":"amountCAC","type":"uint256" },
        { "internalType":"uint8","name":"saleType","type":"uint8" },
        { "internalType":"uint8","name":"status","type":"uint8" },
        { "internalType":"uint256","name":"priceWei","type":"uint256" },
        { "internalType":"uint256","name":"reserveWei","type":"uint256" },
        { "internalType":"uint256","name":"buyoutWei","type":"uint256" },
        { "internalType":"uint64","name":"endTime","type":"uint64" },
        { "internalType":"address","name":"highestBidder","type":"address" },
        { "internalType":"uint256","name":"highestBid","type":"uint256" }
      ],
      "internalType":"struct CacMarketplaceV2.Listing","name":"","type":"tuple"} ],
    "stateMutability":"view","type":"function" },

  { "inputs":[ { "internalType":"uint256","name":"id","type":"uint256" } ],
    "name":"buy","outputs":[], "stateMutability":"payable","type":"function" },

  { "inputs":[ { "internalType":"uint256","name":"id","type":"uint256" } ],
    "name":"bid","outputs":[], "stateMutability":"payable","type":"function" },

  { "inputs":[ { "internalType":"uint256","name":"id","type":"uint256" } ],
    "name":"finalize","outputs":[], "stateMutability":"nonpayable","type":"function" },

  { "inputs":[ { "internalType":"uint256","name":"id","type":"uint256" } ],
    "name":"cancel","outputs":[], "stateMutability":"nonpayable","type":"function" },

  // ===== Refunds =====
  { "inputs":[{ "internalType":"address","name":"","type":"address"}],
    "name":"pendingRefund","outputs":[{ "internalType":"uint256","name":"","type":"uint256"}],
    "stateMutability":"view","type":"function" },

  { "inputs":[], "name":"withdrawRefund","outputs":[],
    "stateMutability":"nonpayable","type":"function" },

  // ===== Buy orders =====
  { "inputs":[], "name":"nextBuyId","outputs":[{ "internalType":"uint256","name":"","type":"uint256"}],
    "stateMutability":"view","type":"function" },

  { "inputs":[{ "internalType":"uint256","name":"amountCAC","type":"uint256"}],
    "name":"createBuyOrder","outputs":[{ "internalType":"uint256","name":"id","type":"uint256"}],
    "stateMutability":"payable","type":"function" },

  { "inputs":[{ "internalType":"uint256","name":"id","type":"uint256"}],
    "name":"fillBuyOrder","outputs":[],
    "stateMutability":"nonpayable","type":"function" },

  { "inputs":[{ "internalType":"uint256","name":"id","type":"uint256"}],
    "name":"cancelBuyOrder","outputs":[],
    "stateMutability":"nonpayable","type":"function" },

  { "inputs":[{ "internalType":"uint256","name":"id","type":"uint256"}],
    "name":"getBuyOrder",
    "outputs":[{ "components":[
      { "internalType":"uint256","name":"id","type":"uint256" },
      { "internalType":"address","name":"buyer","type":"address" },
      { "internalType":"uint256","name":"amountCAC","type":"uint256" },
      { "internalType":"uint256","name":"offerWei","type":"uint256" },
      { "internalType":"uint8","name":"status","type":"uint8" }
    ], "internalType":"struct CacMarketplaceV2.BuyOrder","name":"","type":"tuple"}],
    "stateMutability":"view","type":"function" },

  // ===== Blind auctions =====
  { "inputs":[], "name":"nextBlindId","outputs":[{ "internalType":"uint256","name":"","type":"uint256"}],
    "stateMutability":"view","type":"function" },

  { "inputs":[
      { "internalType":"uint256","name":"amountCAC","type":"uint256" },
      { "internalType":"uint256","name":"reserveWei","type":"uint256" },
      { "internalType":"uint256","name":"buyoutWei","type":"uint256" },
      { "internalType":"uint64","name":"commitEndTime","type":"uint64" },
      { "internalType":"uint64","name":"revealEndTime","type":"uint64" }
    ],
    "name":"listBlindAuction","outputs":[{ "internalType":"uint256","name":"id","type":"uint256"}],
    "stateMutability":"nonpayable","type":"function" },

  { "inputs":[
      { "internalType":"uint256","name":"id","type":"uint256" },
      { "internalType":"bytes32","name":"commitment","type":"bytes32" }
    ],
    "name":"commitBlindBid","outputs":[],
    "stateMutability":"payable","type":"function" },

  { "inputs":[
      { "internalType":"uint256","name":"id","type":"uint256" },
      { "internalType":"uint256","name":"bidWei","type":"uint256" },
      { "internalType":"bytes32","name":"salt","type":"bytes32" }
    ],
    "name":"revealBlindBid","outputs":[],
    "stateMutability":"nonpayable","type":"function" },

  { "inputs":[{ "internalType":"uint256","name":"id","type":"uint256"}],
    "name":"finalizeBlind","outputs":[],
    "stateMutability":"nonpayable","type":"function" },

  { "inputs":[{ "internalType":"uint256","name":"id","type":"uint256"}],
    "name":"cancelBlind","outputs":[],
    "stateMutability":"nonpayable","type":"function" },

  { "inputs":[{ "internalType":"uint256","name":"id","type":"uint256"}],
    "name":"prepareUnrevealedRefund","outputs":[],
    "stateMutability":"nonpayable","type":"function" },

  { "inputs":[{ "internalType":"uint256","name":"id","type":"uint256"}],
    "name":"getBlindAuction",
    "outputs":[{ "components":[
      { "internalType":"uint256","name":"id","type":"uint256" },
      { "internalType":"address","name":"seller","type":"address" },
      { "internalType":"uint256","name":"amountCAC","type":"uint256" },
      { "internalType":"uint256","name":"reserveWei","type":"uint256" },
      { "internalType":"uint256","name":"buyoutWei","type":"uint256" },
      { "internalType":"uint64","name":"commitEndTime","type":"uint64" },
      { "internalType":"uint64","name":"revealEndTime","type":"uint64" },
      { "internalType":"uint8","name":"status","type":"uint8" },
      { "internalType":"address","name":"highestBidder","type":"address" },
      { "internalType":"uint256","name":"highestBid","type":"uint256" },
      { "internalType":"uint256","name":"commitCount","type":"uint256" }
    ], "internalType":"struct CacMarketplaceV2.BlindAuction","name":"","type":"tuple"}],
    "stateMutability":"view","type":"function" },

  // ===== Events (régi + újak) =====
  { "anonymous":false,"inputs":[
      { "indexed":true,"internalType":"uint256","name":"id","type":"uint256" },
      { "indexed":true,"internalType":"address","name":"seller","type":"address" },
      { "indexed":false,"internalType":"uint256","name":"amountCAC","type":"uint256" },
      { "indexed":false,"internalType":"uint256","name":"priceWei","type":"uint256" }
    ],"name":"ListedFixed","type":"event" },

  { "anonymous":false,"inputs":[
      { "indexed":true,"internalType":"uint256","name":"id","type":"uint256" },
      { "indexed":true,"internalType":"address","name":"seller","type":"address" },
      { "indexed":false,"internalType":"uint256","name":"amountCAC","type":"uint256" },
      { "indexed":false,"internalType":"uint256","name":"reserveWei","type":"uint256" },
      { "indexed":false,"internalType":"uint256","name":"buyoutWei","type":"uint256" },
      { "indexed":false,"internalType":"uint64","name":"endTime","type":"uint64" }
    ],"name":"ListedAuction","type":"event" },

  { "anonymous":false,"inputs":[
      { "indexed":true,"internalType":"uint256","name":"id","type":"uint256" },
      { "indexed":true,"internalType":"address","name":"buyer","type":"address" },
      { "indexed":false,"internalType":"uint256","name":"priceWei","type":"uint256" }
    ],"name":"BuyNow","type":"event" },

  { "anonymous":false,"inputs":[
      { "indexed":true,"internalType":"uint256","name":"id","type":"uint256" },
      { "indexed":true,"internalType":"address","name":"bidder","type":"address" },
      { "indexed":false,"internalType":"uint256","name":"amountWei","type":"uint256" }
    ],"name":"Bid","type":"event" },

  { "anonymous":false,"inputs":[
      { "indexed":true,"internalType":"uint256","name":"id","type":"uint256" },
      { "indexed":true,"internalType":"address","name":"winner","type":"address" },
      { "indexed":false,"internalType":"uint256","name":"priceWei","type":"uint256" }
    ],"name":"Finalized","type":"event" },

  { "anonymous":false,"inputs":[
      { "indexed":true,"internalType":"uint256","name":"id","type":"uint256" }
    ],"name":"Cancelled","type":"event" },

  { "anonymous":false,"inputs":[
      { "indexed":true,"internalType":"uint256","name":"id","type":"uint256" },
      { "indexed":true,"internalType":"address","name":"buyer","type":"address" },
      { "indexed":false,"internalType":"uint256","name":"amountCAC","type":"uint256" },
      { "indexed":false,"internalType":"uint256","name":"offerWei","type":"uint256" }
    ],"name":"BuyOrderCreated","type":"event" },

  { "anonymous":false,"inputs":[
      { "indexed":true,"internalType":"uint256","name":"id","type":"uint256" },
      { "indexed":true,"internalType":"address","name":"seller","type":"address" },
      { "indexed":true,"internalType":"address","name":"buyer","type":"address" },
      { "indexed":false,"internalType":"uint256","name":"amountCAC","type":"uint256" },
      { "indexed":false,"internalType":"uint256","name":"offerWei","type":"uint256" }
    ],"name":"BuyOrderFilled","type":"event" },

  { "anonymous":false,"inputs":[
      { "indexed":true,"internalType":"uint256","name":"id","type":"uint256" }
    ],"name":"BuyOrderCancelled","type":"event" },

  { "anonymous":false,"inputs":[
      { "indexed":true,"internalType":"uint256","name":"id","type":"uint256" },
      { "indexed":true,"internalType":"address","name":"seller","type":"address" },
      { "indexed":false,"internalType":"uint256","name":"amountCAC","type":"uint256" },
      { "indexed":false,"internalType":"uint256","name":"reserveWei","type":"uint256" },
      { "indexed":false,"internalType":"uint256","name":"buyoutWei","type":"uint256" },
      { "indexed":false,"internalType":"uint64","name":"commitEndTime","type":"uint64" },
      { "indexed":false,"internalType":"uint64","name":"revealEndTime","type":"uint64" }
    ],"name":"ListedBlind","type":"event" },

  { "anonymous":false,"inputs":[
      { "indexed":true,"internalType":"uint256","name":"id","type":"uint256" },
      { "indexed":true,"internalType":"address","name":"bidder","type":"address" },
      { "indexed":false,"internalType":"bytes32","name":"commitment","type":"bytes32" },
      { "indexed":false,"internalType":"uint256","name":"depositWei","type":"uint256" }
    ],"name":"BlindCommitted","type":"event" },

  { "anonymous":false,"inputs":[
      { "indexed":true,"internalType":"uint256","name":"id","type":"uint256" },
      { "indexed":true,"internalType":"address","name":"bidder","type":"address" },
      { "indexed":false,"internalType":"uint256","name":"bidWei","type":"uint256" }
    ],"name":"BlindRevealed","type":"event" },

  { "anonymous":false,"inputs":[
      { "indexed":true,"internalType":"uint256","name":"id","type":"uint256" },
      { "indexed":true,"internalType":"address","name":"winner","type":"address" },
      { "indexed":false,"internalType":"uint256","name":"priceWei","type":"uint256" }
    ],"name":"BlindFinalized","type":"event" },

  { "anonymous":false,"inputs":[
      { "indexed":true,"internalType":"uint256","name":"id","type":"uint256" }
    ],"name":"BlindCancelled","type":"event" },

  { "anonymous":false,"inputs":[
      { "indexed":true,"internalType":"uint256","name":"id","type":"uint256" },
      { "indexed":true,"internalType":"address","name":"bidder","type":"address" },
      { "indexed":false,"internalType":"uint256","name":"amountWei","type":"uint256" }
    ],"name":"UnrevealedRefundPrepared","type":"event" },

  { "anonymous":false,"inputs":[
      { "indexed":true,"internalType":"address","name":"bidder","type":"address" },
      { "indexed":false,"internalType":"uint256","name":"amountWei","type":"uint256" }
    ],"name":"Refunded","type":"event" },
]
