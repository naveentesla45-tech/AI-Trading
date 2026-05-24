function getSignal({ rsi, sma, price, momentum }) {



  let score = 0;



  if (rsi < 30) score += 2;

  if (rsi > 70) score -= 2;



  if (price > sma) score += 1;

  if (price < sma) score -= 1;



  if (momentum > 0) score += 1;

  if (momentum < 0) score -= 1;



  if (score >= 3) return "BUY";

  if (score <= -3) return "SELL";



  return "HOLD";

}

async function analyzeStock(symbol) {

  try {

    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=30d`;

    const response = await axios.get(url);

    const result = response.data?.chart?.result?.[0];

    const prices = result?.indicators?.quote?.[0]?.close;

    const clean =
      prices.filter(p => p !== null);

    const price =
      clean[clean.length - 1];

    const sma =
      clean.slice(-10)
      .reduce((a,b)=>a+b,0) / 10;

    const momentum =
      price - clean[clean.length - 5];

    let gains = 0;
    let losses = 0;

    for (let i = clean.length - 14; i < clean.length; i++) {

      const diff =
        clean[i] - clean[i - 1];

      if (diff > 0) gains += diff;
      else losses -= diff;
    }

    const rs =
      gains / (losses || 1);

    const rsi =
      100 - (100 / (1 + rs));

    const signal =
      getSignal({
        rsi,
        sma,
        price,
        momentum
      });

    let score = 0;

    if (signal === "BUY") score = 5;
    if (signal === "HOLD") score = 0;
    if (signal === "SELL") score = -5;

    return {
      symbol,
      price,
      sma,
      rsi,
      momentum,
      signal,
      score
    };

  } catch (err) {

    return {
      symbol,
      error: err.message
    };

  }

}
async function getNiftyATM() {



  try {



    const url =

      "https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?interval=1m&range=1d";



    const response =

      await axios.get(url);



    const result =

      response.data?.chart?.result?.[0];



    const prices =

      result?.indicators?.quote?.[0]?.close;



    const clean =

      prices.filter(p => p !== null);



    const spot =

      clean[clean.length - 1];



    // nearest 50 strike

    const atm =

      Math.round(spot / 50) * 50;



    return {

      spot,

      atm

    };



  } catch (err) {



    return {

      error: err.message

    };



  }



}

function getNextThursday() {



  const today = new Date();



  const day = today.getDay();



  // Thursday = 4

  let diff = 4 - day;



  if (diff < 0) {

    diff += 7;

  }



  const expiry = new Date(today);



  expiry.setDate(today.getDate() + diff);



  return expiry;



}

function formatExpiry(expiryDate) {



  const day =

    expiryDate.getDate()

    .toString()

    .padStart(2, "0");



  const months = [

    "JAN", "FEB", "MAR",

    "APR", "MAY", "JUN",

    "JUL", "AUG", "SEP",

    "OCT", "NOV", "DEC"

  ];



  const month =

    months[expiryDate.getMonth()];



  return `${day}${month}`;



}

async function buildOptionSymbols() {



  const nifty =

    await getNiftyATM();



  const atm =

    nifty.atm;



  const expiry =

    getNextThursday();



  const expiryCode =

    formatExpiry(expiry);



  const ce =

    `NIFTY${expiryCode}${atm}CE`;



  const pe =

    `NIFTY${expiryCode}${atm}PE`;



  return {

    spot: nifty.spot,

    atm,

    expiry: expiryCode,

    ce,

    pe

  };



}
async function getLiveOptionSymbols() {



  const instruments =

    await kc.getInstruments("NFO");



  const nifty =

    await getNiftyATM();



  const atm =

    nifty.atm;



  const filtered =

    instruments.filter((item) => {



      return (

        item.name === "NIFTY" &&

        item.segment === "NFO-OPT" &&

        item.strike === atm

      );



    });



  // Sort nearest expiry

  filtered.sort((a, b) => {



    return new Date(a.expiry)

      - new Date(b.expiry);



  });



  const ce =

    filtered.find(

      x => x.instrument_type === "CE"

    );



  const pe =

    filtered.find(

      x => x.instrument_type === "PE"

    );



  return {



    spot: nifty.spot,



    atm,



    ce,



    pe



  };



}
async function getOptionPremiums() {



  try {



    const symbols =

      await getLiveOptionSymbols();



    const ceSymbol =

      `NFO:${symbols.ce.tradingsymbol}`;



    const peSymbol =

      `NFO:${symbols.pe.tradingsymbol}`;



    const quotes =

      await kc.getQuote([

        ceSymbol,

        peSymbol

      ]);



    console.log(quotes);



    const ceData =

      quotes[ceSymbol];



    const peData =

      quotes[peSymbol];



    const ceLtp =

      ceData.last_price;



    const peLtp =

      peData.last_price;



    const combinedPremium =

      +(ceLtp + peLtp).toFixed(2);



    // 20% SL

    const ceSL =

      +(ceLtp * 1.20).toFixed(2);



    const peSL =

      +(peLtp * 1.20).toFixed(2);



    return {



      spot: symbols.spot,



      atm: symbols.atm,



      ce: {

        symbol:

          symbols.ce.tradingsymbol,

        ltp: ceLtp,

        sl: ceSL

      },



      pe: {

        symbol:

          symbols.pe.tradingsymbol,

        ltp: peLtp,

        sl: peSL

      },



      combinedPremium



    };



  } catch (err) {



    return {

      error: err.message

    };



  }



}




import dns from "dns";
dns.setDefaultResultOrder("ipv4first");



import express from "express";

import dotenv from "dotenv";

import axios from "axios";

import { KiteConnect } from "kiteconnect";



dotenv.config();



const app = express();



app.use(express.json());



const kite = new KiteConnect({

  api_key: process.env.API_KEY

});



const kc = new KiteConnect({

  api_key: process.env.API_KEY

});



app.get("/", async (req, res) => {



  const requestToken =

    req.query.request_token;



  if (!requestToken) {



    return res.send(

      "Waiting for Zerodha login..."

    );



  }



  try {



    const session =

      await kc.generateSession(

        requestToken,

        process.env.API_SECRET

      );



    kc.setAccessToken(

      session.access_token

    );



    kite.setAccessToken(

      session.access_token

    );



    console.log(

      "Access Token:",

      session.access_token

    );



    res.send(`



      <h2>Access Token Generated Successfully</h2>



      <pre>${session.access_token}</pre>



    `);



  } catch (err) {



    console.error(err);



    res.send(

      "Error generating access token"

    );



  }



});



app.get("/health", (req, res) => {



  res.json({

    status: "success",

    message: "Server healthy"

  });



});



app.get("/holdings", async (req, res) => {



  try {



    kc.setAccessToken(process.env.ACCESS_TOKEN);



    const holdings = await kc.getHoldings();



    res.json(holdings);



  } catch (err) {



    console.error(err);



    res.json({

      error: err.message

    });



  }



});



app.get("/buy-test", async (req, res) => {



  try {



    kc.setAccessToken(process.env.ACCESS_TOKEN);



    const order = await kc.placeOrder("regular", {

  exchange: "NSE",

  tradingsymbol: "INFY",

  transaction_type: "BUY",

  quantity: 1,

  product: "CNC",

  order_type: "LIMIT",

  price: 1188

});



    res.json({

      success: true,

      order

    });



  } catch (err) {



    console.error(err);



    res.json({

      success: false,

      error: err.message

    });



  }



});


app.get("/ai-signal", async (req, res) => {



  try {



    const symbol = "TCS.NS";



    const url =

      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=30d`;



    const response = await axios.get(url);



    const result = response.data?.chart?.result?.[0];



    const prices = result?.indicators?.quote?.[0]?.close;



    const clean = prices.filter(p => p !== null);



    const price = clean[clean.length - 1];



    const sma =

      clean.slice(-10).reduce((a, b) => a + b, 0) / 10;



    const momentum =

      price - clean[clean.length - 5];



    let gains = 0;

    let losses = 0;



    for (let i = clean.length - 14; i < clean.length; i++) {



      const diff = clean[i] - clean[i - 1];



      if (diff > 0) gains += diff;

      else losses -= diff;

    }



    const rs = gains / (losses || 1);



    const rsi = 100 - (100 / (1 + rs));



    const signal =

      getSignal({ rsi, sma, price, momentum });



    res.json({

      symbol,

      price,

      sma,

      rsi,

      momentum,

      signal

    });



  } catch (err) {



    res.json({

      error: err.message

    });



  }



});


app.get("/scan", async (req, res) => {



  try {



    const stocks = [



      "TCS.NS",

      "INFY.NS",

      "RELIANCE.NS",

      "HDFCBANK.NS",

      "ICICIBANK.NS",

      "SBIN.NS",

      "LT.NS",

      "ITC.NS"



    ];



    const results = [];



    for (const stock of stocks) {



      const analysis =

        await analyzeStock(stock);



      results.push(analysis);



    }



    results.sort((a, b) =>

      b.score - a.score

    );



    res.json({

      scanned: results.length,

      results

    });



  } catch (err) {



    res.json({

      error: err.message

    });



  }



});

app.get("/atm", async (req, res) => {



  try {



    const data =

      await getNiftyATM();



    res.json({

      success: true,

      data

    });



  } catch (err) {



    res.json({

      success: false,

      error: err.message

    });



  }



});

app.get("/atm", async (req, res) => {



  try {



    const data =

      await getNiftyATM();



    res.json({

      success: true,

      data

    });



  } catch (err) {



    res.json({

      success: false,

      error: err.message

    });



  }



});

app.get("/symbols", async (req, res) => {



  try {



    const data =

      await buildOptionSymbols();



    res.json({

      success: true,

      data

    });



  } catch (err) {



    res.json({

      success: false,

      error: err.message

    });



  }



});

app.get("/premium", async (req, res) => {



  try {



    const data =

      await getOptionPremiums();



    res.json({

      success: true,

      data

    });



  } catch (err) {



    res.json({

      success: false,

      error: err.message

    });



  }



});

app.get("/login", (req, res) => {



  const loginUrl =

    kite.getLoginURL();



  res.redirect(loginUrl);



});

app.get("/live-symbols", async (req, res) => {



  try {



    const data =

      await getLiveOptionSymbols();



    res.json({

      success: true,

      data

    });



  } catch (err) {



    res.json({

      success: false,

      error: err.message

    });



  }



});
const PORT = 3000;



app.listen(PORT, () => {

  console.log(`Server running on port ${PORT}`);

});
