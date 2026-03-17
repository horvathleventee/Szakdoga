export const fixedMarketAbi = [
  { "inputs":[{ "internalType":"address","name":"cac","type":"address"}], "stateMutability":"nonpayable","type":"constructor" },
  { "inputs":[], "name":"nextId", "outputs":[{ "internalType":"uint256","name":"","type":"uint256"}], "stateMutability":"view","type":"function" },
  { "inputs":[{ "internalType":"uint256","name":"id","type":"uint256"}], "name":"listings",
    "outputs":[
      { "internalType":"uint256","name":"id","type":"uint256"},
      { "internalType":"address","name":"seller","type":"address"},
      { "internalType":"uint256","name":"amountCAC","type":"uint256"},
      { "internalType":"uint256","name":"priceWei","type":"uint256"},
      { "internalType":"uint8","name":"status","type":"uint8"}
    ], "stateMutability":"view","type":"function"
  },
  { "inputs":[{ "internalType":"uint256","name":"amountCAC","type":"uint256"},{ "internalType":"uint256","name":"priceWei","type":"uint256"}],
    "name":"listFixed","outputs":[{ "internalType":"uint256","name":"id","type":"uint256"}], "stateMutability":"nonpayable","type":"function" },
  { "inputs":[{ "internalType":"uint256","name":"id","type":"uint256"}], "name":"buy","outputs":[], "stateMutability":"payable","type":"function" },
  { "inputs":[{ "internalType":"uint256","name":"id","type":"uint256"}], "name":"cancel","outputs":[], "stateMutability":"nonpayable","type":"function" },

  { "inputs":[{ "internalType":"address","name":"","type":"address"}], "name":"pendingRefund","outputs":[{ "internalType":"uint256","name":"","type":"uint256"}], "stateMutability":"view","type":"function" },
  { "inputs":[], "name":"withdrawRefund","outputs":[], "stateMutability":"nonpayable","type":"function" },

  { "anonymous":false,"inputs":[{ "indexed":true,"internalType":"uint256","name":"id","type":"uint256"},{ "indexed":true,"internalType":"address","name":"seller","type":"address"},{ "indexed":false,"internalType":"uint256","name":"amountCAC","type":"uint256"},{ "indexed":false,"internalType":"uint256","name":"priceWei","type":"uint256"}],"name":"Listed","type":"event" },
  { "anonymous":false,"inputs":[{ "indexed":true,"internalType":"uint256","name":"id","type":"uint256"},{ "indexed":true,"internalType":"address","name":"buyer","type":"address"},{ "indexed":false,"internalType":"uint256","name":"priceWei","type":"uint256"}],"name":"Bought","type":"event" },
  { "anonymous":false,"inputs":[{ "indexed":true,"internalType":"uint256","name":"id","type":"uint256"}],"name":"Cancelled","type":"event" },
  { "anonymous":false,"inputs":[{ "indexed":true,"internalType":"address","name":"user","type":"address"},{ "indexed":false,"internalType":"uint256","name":"amountWei","type":"uint256"}],"name":"Refunded","type":"event" },
];
