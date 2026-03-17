export const dutchAuctionMarketAbi = [
  { "inputs":[{ "internalType":"address","name":"cac","type":"address"}], "stateMutability":"nonpayable","type":"constructor" },

  { "inputs":[], "name":"nextId", "outputs":[{ "internalType":"uint256","name":"","type":"uint256"}], "stateMutability":"view","type":"function" },

  { "inputs":[{ "internalType":"uint256","name":"id","type":"uint256"}], "name":"auctions",
    "outputs":[
      { "internalType":"uint256","name":"id","type":"uint256"},
      { "internalType":"address","name":"seller","type":"address"},
      { "internalType":"uint256","name":"amountCAC","type":"uint256"},
      { "internalType":"uint256","name":"startPriceWei","type":"uint256"},
      { "internalType":"uint256","name":"endPriceWei","type":"uint256"},
      { "internalType":"uint64","name":"startTime","type":"uint64"},
      { "internalType":"uint64","name":"endTime","type":"uint64"},
      { "internalType":"uint64","name":"stepSec","type":"uint64"},
      { "internalType":"uint8","name":"status","type":"uint8"}
    ],
    "stateMutability":"view","type":"function"
  },

  {
    "inputs":[
      { "internalType":"uint256","name":"amountCAC","type":"uint256"},
      { "internalType":"uint256","name":"startPriceWei","type":"uint256"},
      { "internalType":"uint256","name":"endPriceWei","type":"uint256"},
      { "internalType":"uint64","name":"durationSec","type":"uint64"},
      { "internalType":"uint64","name":"stepSec","type":"uint64"}
    ],
    "name":"listDutch",
    "outputs":[{ "internalType":"uint256","name":"id","type":"uint256"}],
    "stateMutability":"nonpayable",
    "type":"function"
  },

  { "inputs":[{ "internalType":"uint256","name":"id","type":"uint256"}], "name":"currentPrice","outputs":[{ "internalType":"uint256","name":"","type":"uint256"}], "stateMutability":"view","type":"function" },
  { "inputs":[{ "internalType":"uint256","name":"id","type":"uint256"}], "name":"buy","outputs":[], "stateMutability":"payable","type":"function" },
  { "inputs":[{ "internalType":"uint256","name":"id","type":"uint256"}], "name":"cancel","outputs":[], "stateMutability":"nonpayable","type":"function" },

  { "anonymous":false, "inputs":[
      { "indexed":true,  "internalType":"uint256","name":"id","type":"uint256"},
      { "indexed":true,  "internalType":"address","name":"seller","type":"address"},
      { "indexed":false, "internalType":"uint256","name":"amountCAC","type":"uint256"},
      { "indexed":false, "internalType":"uint256","name":"startPriceWei","type":"uint256"},
      { "indexed":false, "internalType":"uint256","name":"endPriceWei","type":"uint256"},
      { "indexed":false, "internalType":"uint64","name":"startTime","type":"uint64"},
      { "indexed":false, "internalType":"uint64","name":"endTime","type":"uint64"},
      { "indexed":false, "internalType":"uint64","name":"stepSec","type":"uint64"}
    ],
    "name":"Listed","type":"event"
  },

  { "anonymous":false, "inputs":[
      { "indexed":true,  "internalType":"uint256","name":"id","type":"uint256"},
      { "indexed":true,  "internalType":"address","name":"buyer","type":"address"},
      { "indexed":false, "internalType":"uint256","name":"priceWei","type":"uint256"}
    ],
    "name":"Bought","type":"event"
  },

  { "anonymous":false, "inputs":[{ "indexed":true,"internalType":"uint256","name":"id","type":"uint256"}], "name":"Cancelled","type":"event" },
];
