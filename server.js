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

    // 텍스트 헬퍼
    function safeText(sel) {
      const t = $(sel).text().replace(/\s+/g, ' ').replace(/[^\w\s\.,\-\+%]/g, '').trim();
      return t || "-";
    }

    // 등락폭/퍼센트 같이 파싱 (예외대응)
    function parseChgAndRate(sel) {
      const raw = safeText(sel);
      const m = raw.match(/([+-]?[0-9\.,]+)\s*\(?([+-]?[0-9\.,]+)%?\)?/);
      if (m) return { change: m[1], rate: m[2] };
      const n = raw.match(/([+-]?[0-9\.,]+)/g) || [];
      return { change: n[0] || '-', rate: n[1] || '-' };
    }

    // KOSPI
    const kospi = safeText('#KOSPI_now');
    const kospiChgRate = parseChgAndRate('#KOSPI_change');
    const kospiUp = $('#KOSPI_change').hasClass('up') || $('#KOSPI_change').hasClass('plus');

    // KOSDAQ
    const kosdaq = safeText('#KOSDAQ_now');
    const kosdaqChgRate = parseChgAndRate('#KOSDAQ_change');
    const kosdaqUp = $('#KOSDAQ_change').hasClass('up') || $('#KOSDAQ_change').hasClass('plus');

    // 달러 인덱스 (네이버: 없으면 "-")
    let dollarIdx = "-", dollarIdxChange = "-", dollarIdxRate = "-", dollarIdxUp = false;
    const dxyBox = $('.lst_major li:contains("달러인덱스")');
    if (dxyBox.length > 0) {
      dollarIdx = dxyBox.find('.head_info .value').text().trim() || "-";
      dollarIdxChange = dxyBox.find('.head_info .change').text().trim() || "-";
      dollarIdxRate = (dxyBox.find('.head_info .change').next('.blind').text().replace('%','').trim()) || "-";
      dollarIdxUp = dxyBox.find('.head_info .change').hasClass('up') || dxyBox.find('.head_info .change').hasClass('plus');
    }

    // VIX (네이버: 없으면 "-")
    let vix = "-", vixChange = "-", vixRate = "-", vixUp = false;
    const vixBox = $('.lst_major li:contains("VIX")');
    if (vixBox.length > 0) {
      vix = vixBox.find('.head_info .value').text().trim() || "-";
      vixChange = vixBox.find('.head_info .change').text().trim() || "-";
      vixRate = (vixBox.find('.head_info .change').next('.blind').text().replace('%','').trim()) || "-";
      vixUp = vixBox.find('.head_info .change').hasClass('up') || vixBox.find('.head_info .change').hasClass('plus');
    }

    // 2. 환율 (USD/KRW) - 퍼센트 안정 추출
    const { data: fxData } = await axios.get('https://finance.naver.com/marketindex/?tabSel=exchange#tab_section');
    const $$ = cheerio.load(fxData);

    // 퍼센트값(등락률) 필터링
    function extractRateBlind($root) {
      // 가장 첫 번째 %포함된 blind 텍스트
      const blindList = $root.find('.blind').toArray();
      for (let b of blindList) {
        const txt = $$(b).text();
        if (txt.includes('%')) {
          return txt.replace('%','').trim();
        }
      }
      return '-';
    }
    const usdkrwRoot = $$('#exchangeList .head_info').eq(0);
    const usdkrw = {
      value: usdkrwRoot.find('.value').text().trim() || "-",
      change: usdkrwRoot.find('.change').text().trim() || "-",
      rate: extractRateBlind(usdkrwRoot),
      up: usdkrwRoot.find('.change').hasClass('up') || usdkrwRoot.find('.change').hasClass('plus')
    };

    // 3. 미국지수 (야후)
    let sp500 = { value: "-", change: "-", rate: "-", up: false }, nasdaq = { value: "-", change: "-", rate: "-", up: false };
    try {
      const yResp = await axios.get('https://query1.finance.yahoo.com/v7/finance/quote?symbols=%5EGSPC,%5EIXIC');
      const resArr = yResp.data.quoteResponse.result;
      if (resArr[0]) sp500 = {
        value: resArr[0].regularMarketPrice ?? "-",
        change: (resArr[0].regularMarketChange ?? 0).toFixed(2),
        rate: (resArr[0].regularMarketChangePercent ?? 0).toFixed(2),
        up: resArr[0].regularMarketChange >= 0
      };
      if (resArr[1]) nasdaq = {
        value: resArr[1].regularMarketPrice ?? "-",
        change: (resArr[1].regularMarketChange ?? 0).toFixed(2),
        rate: (resArr[1].regularMarketChangePercent ?? 0).toFixed(2),
        up: resArr[1].regularMarketChange >= 0
      };
    } catch(e){
      // 야후 api 실패시 "-"
    }

    // 최종 json 반환
    res.json({
      kospi: { value: kospi, change: kospiChgRate.change, rate: kospiChgRate.rate, up: kospiUp },
      kosdaq: { value: kosdaq, change: kosdaqChgRate.change, rate: kosdaqChgRate.rate, up: kosdaqUp },
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
