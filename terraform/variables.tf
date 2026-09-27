variable "kube_config" {
    type = string
    default = "~/.kube/config"
}

variable "namespace" {
    type = string
    default = "pipline"
}

variable "finnhub_stocks_tickers" {
    type = list
    default = [ "BINANCE:BTCUSDT",
              "BINANCE:ETHUSDT",
              "BINANCE:XRPUSDT",
              "BINANCE:DOGEUSDT" ]
}