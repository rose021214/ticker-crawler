const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

const targets = [
  { key: 'kospi',   url: 'https://www.investing.com/indices/kospi' },
  { key: 'kosdaq',  url: 'https://www.investing.com/indices/kosdaq' },
  { key: 'sp500',   url: 'https://www.investing.com/indices/us-spx-500' },
  { key: 'nasdaq',  url: 'https://www.investing.com/indices/nq-100-futures' },
  { key: 'dxy',     url: 'https://www.investing.com/indices/usdollar?cid=1224074' },
  { key: 'vix',     url: 'https://www.investing.com/indices/volatility-s-p-500' }
];

async function fetchAllIndices() {
  const result = {};

  // 1. 주요 지수 (Investing.com)
  for (const { key, url } of targets) {
    try {
      const resp = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const $ = cheerio.load(resp.data);

      const price = $('[data-test="instrument-price-last"]').first().text().replace(/,/g, '').trim();
      const change = $('[data-test="instrument-price-change"]').first().text().replace(/,/g, '').trim();
      const rate = $('[data-test="instrument-price-change-percent"]').first().text().replace(/[(),%]/g, '').trim();
      const up = (change.startsWith('+') || change.startsWith('▲'));

      result[key] = {
        value: price || '-',
        change: change || '-',
        rate: rate || '-',
        up
      };
    } catch (e) {
      result[key] = { value: '-', change: '-', rate: '-', up: false };
    }
  }

  // 2. USD/KRW (Naver + 퍼센트 직접 계산)
  try {
    const resp = await axios.get('https://finance.naver.com/marketindex/', {
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const decodedData = iconv.decode(resp.data, 'euc-kr');
    const $ = cheerio.load(decodedData);

    const usdkrwRoot = $('#exchangeList > li').filter((i, el) => {
      const href = $(el).find('a').attr('href');
      return href && href.includes('FX_USDKRW');
    }).first();

    const priceText = usdkrwRoot.find('.value').text().replace(/,/g, '').trim();
    const changeText = usdkrwRoot.find('.change').text().replace(/,/g, '').trim();

    const price = parseFloat(priceText);
    const change = parseFloat(changeText);
    let rate = '-';

    if (!isNaN(price) && !isNaN(change)) {
      const yesterday = price - change;
      if (yesterday !== 0) {
        rate = ((change / yesterday) * 100).toFixed(2);
      }
    }

    const up = usdkrwRoot.find('.change').hasClass('up') || usdkrwRoot.find('.change').hasClass('plus');

    result['usdkrw'] = {
      value: priceText || '-',
      change: changeText || '-',
      rate: rate,
      up
    };
  } catch (e) {
    console.error('usdkrw error:', e.message);
    result['usdkrw'] = { value: '-', change: '-', rate: '-', up: false };
  }

  return result;
}

// API 엔드포인트
app.get('/api/ticker', async (req, res) => {
  try {
    const data = await fetchAllIndices();
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '크롤링 실패' });
  }
});

// 서버 실행
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`서버 실행중: ${PORT}`));



















