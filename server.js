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
    // 1. 코스피/코스닥/달러인덱스/VIX (네이버 금융)
    const { data } = await axios.get('https://finance.naver.com/sise/');
    const $ = cheerio.load(data);

    function getVal(id) { return $(`#${id}_now`).text().trim(); }
    function getChg(id) { return $(`#${id}_change`).text().replace(/[\n\t]/g,'').trim(); }
    function getRate(id) { return $(`#${id}_rate`).text().replace(/[\n\t%]/g,'').trim(); }

    // KOSPI
    const kospi = getVal('KOSPI');
    const kospiChange = getChg('KOSPI');
    const kospiRate = getRate('KOSPI');
    const kospiUp = $('#KOSPI_change').hasClass('up') || $('#KOSPI_change').hasClass('plus');

    // KOSDAQ
    const kosdaq = getVal('KOSDAQ');
    const kosdaqChange = getChg('KOSDAQ');
    const kosdaqRate = getRate('KOSDAQ');
    const kosdaqUp = $('#KOSDAQ_change').hasClass('up') || $('#KOSDAQ_change').hasClass('plus');

    // 달러 인덱스 (네이버 금융에서 DXY 아이디)
    const dollarIdx = getVal('USDINDEX');
    const dollarIdxChange = getChg('USDINDEX');
    const dollarIdxRate = getRate('USDINDEX');
    const dollarIdxUp = $('#USDINDEX_change').hasClass('up') || $('#USDINDEX_change').hasClass('plus');

    // VIX
    const vix = getVal('VIX');
    const vixChange = getChg('VIX');
    const vixRate = getRate('VIX');
    const vixUp = $('#VIX_change').hasClass('up') || $('#VIX_change').hasClass('plus');

    // 2. 환율 (USD/KRW)
    const { data: fxData } = await axios.get('https://finance.naver.com/marketindex/?tabSel=exchange#tab_section');
    const $$ = cheerio.load(fxData);
    const usdkrw = {
      value: $$('#exchangeList .head_info').eq(0).find('.value').text().trim(),
      change: $$('#exchangeList .head_info').eq(0).find('.change').text().trim(),
      rate: $$('#exchangeList .head_info').eq(0).find('.change').next('.blind').text().replace('%','').trim(),
      up: $$('#exchangeList .head_info').eq(0).find('.change').hasClass('up') || $$('#exchangeList .head_info').eq(0).find('.change').hasClass('plus')
    };

    // 3. 미국 지수 (야후 파이낸스)
    let sp500 = {}, nasdaq = {};
    try {
      const yResp = await axios.get('https://query1.finance.yahoo.com/v7/finance/quote?symbols=^GSPC,^IXIC');
      const resArr = yResp.data.quoteResponse.result;
      sp500 = {
        value: resArr[0].regularMarketPrice,
        change: resArr[0].regularMarketChange.toFixed(2),
        rate: resArr[0].regularMarketChangePercent.toFixed(2),
        up: resArr[0].regularMarketChange >= 0
      };
      nasdaq = {
        value: resArr[1].regularMarketPrice,
        change: resArr[1].regularMarketChange.toFixed(2),
        rate: resArr[1].regularMarketChangePercent.toFixed(2),
        up: resArr[1].regularMarketChange >= 0
      };
    } catch(e){}

    // 최종 반환
    res.json({
      kospi: { value: kospi, change: kospiChange, rate: kospiRate, up: kospiUp },
      kosdaq: { value: kosdaq, change: kosdaqChange, rate: kosdaqRate, up: kosdaqUp },
      usdkrw,
      dollarIdx: { value: dollarIdx, change: dollarIdxChange, rate: dollarIdxRate, up: dollarIdxUp },
      sp500,
      nasdaq,
      vix: { value: vix, change: vixChange, rate: vixRate, up: vixUp }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '크롤링 실패' });
  }
});


const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('서버 실행중:', PORT));
