const puppeteer = require('puppeteer');
const {GoogleSpreadsheet} = require('google-spreadsheet');

require('dotenv').config();

(async () => {
  // Navigate to the Scottish Widows website:
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(process.env.PENSION_URL);

  async function fillInputField(fieldName, input) {
    await page.click(`input[name=${fieldName}]`);
    await page.keyboard.type(input);
  }

  async function getText(dataSelector) {
    const element = await page.$(`[data-selector=${dataSelector}]`);
    return await element.evaluate((element) => element.innerText);
  }

  if (!await page.$('h1[value*=\'SITE MAINTENANCE\']')) {
    // Log into Scottish Widows:
    await fillInputField('emailAddress', process.env.PENSION_EMAIL);
    await fillInputField('password', process.env.PENSION_PASSWORD);
    await Promise.all([
      page.click('#button-login'),
      page.waitForNavigation(),
    ]);

    // Scrape values:
    await page.waitForSelector('[data-selector=manage-totalvalue]');
    const dateText = await getText('manage-valuedate');
    const newBalanceText = await getText('manage-totalvalue');
    const premiumText = await getText('policy-card-last-premium-paid');

    // Process values:
    const date = getDateStr(dateText);
    const premiumValue = parseFloat(premiumText.match(/\d+(\.\d+)?/)[0]);
    const premiumDate = getDateStr(premiumText.match(/\d+ [A-Z][a-z]+ \d{4}/));

    // Record data in Google Sheet:
    addDataToSheet(date, newBalanceText, premiumValue, premiumDate);
  }

  await browser.close();
})();

async function addDataToSheet(date, newBalance, premiumValue, premiumDate) {
  // Load Google Sheet and authenticate:
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);
  await doc.useServiceAccountAuth({
    client_email: process.env.CLIENT_EMAIL,
    private_key: process.env.PRIVATE_KEY,
  });
  await doc.loadInfo();

  // Find empty row to fill:
  const sheet = doc.sheetsByIndex[0];
  const rows = await sheet.getRows({limit: 15});

  // assuming not -1, based on my existing spreadsheet
  const lastRecordIndex = rows.findIndex((row) => row.date);
  let lastRow = rows[lastRecordIndex];

  function isRowRecorded(row, date, balance) {
    return row.date === date && row.value === balance;
  }

  if (rows.length && isRowRecorded(lastRow, date, newBalance)) {
    console.log(`row ${date}: ${newBalance} already recorded. abort.`);
  } else {
    let newRow = rows[lastRecordIndex - 1];
    const today = new Date();
    const time =
     `${today.getHours()}:${today.getMinutes()}:${today.getSeconds()}`;
    let oldBalance = getDouble(lastRow.value);
    let totalPaid = getDouble(lastRow['total payments']);
    newBalance = getDouble(newBalance);

    // Record if new premium payment was made:
    if (getDateFromStr(lastRow.date) < getDateFromStr(premiumDate)) {
      totalPaid += premiumValue;
      const totalGain = getDouble(lastRow['total gain']);
      const intermediateBalance = roundTo2dp(oldBalance + premiumValue);
      const paymentRowData = {
        time,
        'date': premiumDate,
        'value': intermediateBalance,
        'change': premiumValue,
        'payment': true,
        'total payments': roundTo2dp(totalPaid),
        'total gain': totalGain,
        'rate of return': totalGain / totalPaid,
      };
      saveSheetRow(newRow, paymentRowData);

      oldBalance += premiumValue;
      lastRow = newRow;
      newRow = rows[lastRecordIndex - 2];
    }

    // Record new balance:
    const change = roundTo2dp(newBalance - oldBalance);
    const totalGain = newBalance - totalPaid;
    const rateOfReturn = totalGain / totalPaid;

    const newRowData = {
      time,
      date,
      'value': newBalance,
      change,
      'total payments': lastRow['total payments'],
      'total gain': totalGain,
      'rate of return': rateOfReturn,
    };

    saveSheetRow(newRow, newRowData);
  }
}

async function saveSheetRow(newRow, newRowData) {
  Object.assign(newRow, newRowData);
  await newRow.save();
}

function getDouble(newBalanceText) {
  return parseFloat(newBalanceText.substring(1).replace(',', ''));
}

function getDateFromStr(dateStr) {
  const parts = dateStr.split('/');
  return new Date(parseInt(parts[2], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[0], 10));
}

function getDateStr(dateText) {
  return new Date(dateText).toLocaleDateString('en-GB');
}

function roundTo2dp(number) {
  return Math.round((number + Number.EPSILON) * 100) / 100;
}
