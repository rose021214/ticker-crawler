const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

app.get('/api/ticker', async (req, res) => {
  try {
    // 코스피, 코스닥 (네이버 금융)
    const { data } = await axios.get('https://finance.naver.com/sise/');
    const $ = cheerio.load(data);
    const kospi = $('#KOSPI_now').text();
    const kospiChange = $('#KOSPI_change').text();
    const kospiUp = $('#KOSPI_change').hasClass('up') || $('#KOSPI_change').hasClass('plus');
    const kosdaq = $('#KOSDAQ_now').text();
    const kosdaqChange = $('#KOSDAQ_change').text();
    const kosdaqUp = $('#KOSDAQ_change').hasClass('up') || $('#KOSDAQ_change').hasClass('plus');

    // 환율 (달러/원, 엔/원, 유로/원, 위안/원 순서)
    const { data: fxData } = await axios.get('https://finance.naver.com/marketindex/?tabSel=exchange#tab_section');
    const $$ = cheerio.load(fxData);
    const currencies = [];
    $$('#exchangeList .head_info').each((i, el) => {
      const value = $$(el).find('.value').text();
      const change = $$(el).find('.change').text();
      const up = $$(el).find('.change').hasClass('up') || $$(el).find('.change').hasClass('plus');
      currencies.push({ value, change, up });
    });

    // S&P500, NASDAQ(야후 파이낸스)
    let sp500 = '', sp500Change = '', sp500Up = false;
    let nasdaq = '', nasdaqChange = '', nasdaqUp = false;
    try {
      const yResp = await axios.get('https://query1.finance.yahoo.com/v7/finance/quote?symbols=^GSPC,^IXIC');
      const resArr = yResp.data.quoteResponse.result;
      sp500 = resArr[0].regularMarketPrice;
      sp500Change = resArr[0].regularMarketChange.toFixed(2);
      sp500Up = resArr[0].regularMarketChange >= 0;
      nasdaq = resArr[1].regularMarketPrice;
      nasdaqChange = resArr[1].regularMarketChange.toFixed(2);
      nasdaqUp = resArr[1].regularMarketChange >= 0;
    } catch (e) { /* 해외지수 실패시 무시 */ }

    res.json({
      kospi: { value: kospi, change: kospiChange, up: kospiUp },
      kosdaq: { value: kosdaq, change: kosdaqChange, up: kosdaqUp },
      usdkrw: currencies[0], // 0: 달러/원
      jpykrw: currencies[1], // 1: 엔/원
      eurkrw: currencies[2], // 2: 유로/원
      cnykrw: currencies[3], // 3: 위안/원
      sp500: { value: sp500, change: sp500Change, up: sp500Up },
      nasdaq: { value: nasdaq, change: nasdaqChange, up: nasdaqUp }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '크롤링 실패' });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('서버 실행중:', PORT));
