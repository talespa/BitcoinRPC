const express = require("express")
const app = express()
const bitcoin = require("bitcoin")
const bodyParser = require("body-parser")

var client = new bitcoin.Client({
  host: "localhost",
  port: 18443,
  user: "bitcoinrpc",
  pass: "459d13ac17bea9f3965165f38d7449bd"
})

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

app.all("*", function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Credentials", true)
  res.header("Access-Control-Allow-Methods", "PUT, GET, POST, DELETE, OPTIONS")
  res.header("Access-Control-Allow-Headers", "Content-Type")
  next()
})

/* Blockchain */
app.get("/blockchain/info", (req, res) => {
  client.cmd("getblockchaininfo", function(err, info) {
    if (err) {
      console.log(err)
      res.status(500)
      res.json({ result: false, message: err })
    } else {
      res.json({ result: true, data: { info: info } })
    }
  })

  // client.getBlockchainInfo(function(err, info) {
  //   if (err) {
  //     console.log(err)
  //     res.status(500)
  //     res.json({ result: false, message: err })
  //   } else {
  //     res.json({ result: true, data: { info: info } })
  //   }
  // })
})

app.get("/blockchain/mempool/info", (req, res) => {
  client.getMempoolInfo(function(err, info) {
    if (err) {
      res.status(500)
      res.json({ result: false, message: err })
    } else {
      res.json({ result: true, data: { info: info } })
    }
  })
})

/* Wallet */
app.get("/wallet/newadd", (req, res) => {
  client.getNewAddress(function(err, newAdd) {
    if (err) {
      res.status(500)
      res.json({ result: false, message: err })
    } else {
      client.dumpPrivKey(newAdd, function(err, privkey) {
        if (err) {
          console.log(err)
          res.status(500)
          res.json({ result: false, message: err })
        } else {
          res.json({ result: true, data: { address: newAdd, privkey: privkey } })
        }
      })
    }
  })
})

app.get("/wallet/:address/balance", (req, res) => {
  client.getReceivedByAddress(req.params.address, function(err, info) {
    if (err) {
      console.log(err)
      res.status(500)
      res.json({ result: false, message: err })
    } else {
      res.json({ result: true, data: { address: req.params.address, balance: info } })
    }
  })
})

app.get("/wallet/:address/unspent", (req, res) => {
  client.listUnspent(1, 99999999, [req.params.address], function(err, info) {
    if (err) {
      console.log(err)
      res.status(500)
      res.json({ result: false, message: err })
    } else {
      res.json({ result: true, data: info })
    }
  })
})

app.post("/rawtx/create", (req, res) => {
  var totalBalance = 0
  var sendBalance = 0
  var unspent = []

  client.listUnspent(1, 99999999, [req.body.fromAdd], function(err, fromAddUTXO) {
    if (err) {
      res.json({ result: false, error: err })
      return console.log(err)
    } else {
      for (var i = 0; i < fromAddUTXO.length; i++) {
        // console.log("totalBalance: " + totalBalance)
        // console.log("amount+fee: " + (req.body.amount + req.body.fee))
        var txid_vout = {
          txid: fromAddUTXO[i].txid,
          vout: fromAddUTXO[i].vout
        }

        unspent.push(txid_vout)
        totalBalance += fromAddUTXO[i].amount
        sendBalance += fromAddUTXO[i].amount
        if (sendBalance >= req.body.amount + req.body.fee) break
      }

      totalBalance *= 1
      req.body.amount *= 1
      req.body.fee *= 1

      if (totalBalance < req.body.amount + req.body.fee) {
        console.log("totalBalance: " + totalBalance)
        console.log("req.body.amount: " + req.body.amount)
        console.log("req.body.fee: " + req.body.fee)
        res.json({ result: false, error: "insufficient amount" })
        return console.log("[ERROR] Insufficient amount(Total balance is lower than amount+fee)")
      }

      var temp = (sendBalance - (req.body.amount + req.body.fee)).toString().substring(0, 9)
      var rawtx =
        '{"' + req.body.toAdd + '":' + req.body.amount + ',"' + req.body.fromAdd + '":' + temp + "}"

      rawtx = JSON.parse(rawtx)

      client.cmd("createrawtransaction", unspent, rawtx, function(err, info) {
        if (err) {
          console.log(err)
          res.status(500)
          res.json({ result: false, message: err })
        } else {
          res.json({ result: true, hexString: info })
        }
      })
    }
  })
})

app.post("/rawtx/sign", (req, res) => {
  client.cmd("signrawtransactionwithkey", req.body.hex, [req.body.privkey], function(err, info) {
    if (err) console.log(err)
    else res.send(info)
  })
})

app.listen(3000, () => {
  console.log("Example app listening on port 3000!")
})
