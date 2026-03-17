export const bundleSaleMarketAbi = [
  { "inputs":[{ "internalType":"address","name":"cac","type":"address"}], "stateMutability":"nonpayable","type":"constructor" },

  { "inputs":[], "name":"nextId", "outputs":[{ "internalType":"uint256","name":"","type":"uint256"}], "stateMutability":"view","type":"function" },

  {
    "inputs":[{ "internalType":"uint256","name":"id","type":"uint256"}],
    "name":"getBundle",
    "outputs":[
      { "internalType":"uint256","name":"_id","type":"uint256"},
      { "internalType":"address","name":"seller","type":"address"},
      { "internalType":"uint256","name":"totalCAC","type":"uint256"},
      { "internalType":"uint256","name":"remainingCAC","type":"uint256"},
      { "internalType":"uint256","name":"tierCount","type":"uint256"},
      { "internalType":"uint8","name":"status","type":"uint8"}
    ],
    "stateMutability":"view",
    "type":"function"
  },

  {
    "inputs":[{ "internalType":"uint256","name":"id","type":"uint256"}],
    "name":"getTiers",
    "outputs":[
      { "internalType":"uint256[]","name":"amountsCAC","type":"uint256[]"},
      { "internalType":"uint256[]","name":"pricesWei","type":"uint256[]"}
    ],
    "stateMutability":"view",
    "type":"function"
  },

  {
    "inputs":[
      { "internalType":"uint256","name":"totalCAC","type":"uint256"},
      { "internalType":"uint256[]","name":"tierAmountsCAC","type":"uint256[]"},
      { "internalType":"uint256[]","name":"tierPricesWei","type":"uint256[]"}
    ],
    "name":"listBundle",
    "outputs":[{ "internalType":"uint256","name":"id","type":"uint256"}],
    "stateMutability":"nonpayable",
    "type":"function"
  },

  {
    "inputs":[
      { "internalType":"uint256","name":"id","type":"uint256"},
      { "internalType":"uint256","name":"tierIndex","type":"uint256"}
    ],
    "name":"buyTier",
    "outputs":[],
    "stateMutability":"payable",
    "type":"function"
  },

  { "inputs":[{ "internalType":"uint256","name":"id","type":"uint256"}], "name":"cancel","outputs":[], "stateMutability":"nonpayable","type":"function" },

  { "anonymous":false,"inputs":[
    { "indexed":true,"internalType":"uint256","name":"id","type":"uint256"},
    { "indexed":true,"internalType":"address","name":"seller","type":"address"},
    { "indexed":false,"internalType":"uint256","name":"totalCAC","type":"uint256"}
  ],"name":"Listed","type":"event" },

  { "anonymous":false,"inputs":[
    { "indexed":true,"internalType":"uint256","name":"id","type":"uint256"},
    { "indexed":true,"internalType":"address","name":"buyer","type":"address"},
    { "indexed":true,"internalType":"uint256","name":"tierIndex","type":"uint256"},
    { "indexed":false,"internalType":"uint256","name":"amountCAC","type":"uint256"},
    { "indexed":false,"internalType":"uint256","name":"priceWei","type":"uint256"},
    { "indexed":false,"internalType":"uint256","name":"remainingCAC","type":"uint256"}
  ],"name":"Bought","type":"event" },

  { "anonymous":false,"inputs":[{ "indexed":true,"internalType":"uint256","name":"id","type":"uint256"}],"name":"Cancelled","type":"event" },
];

// Backwards-compatible alias (old imports)
export const bundleMarketAbi = bundleSaleMarketAbi;
