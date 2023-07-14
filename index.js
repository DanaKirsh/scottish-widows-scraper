const puppeteer = require("puppeteer");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const currency = require("currency.js");

require("dotenv").config();

(async () => {
  // Navigate to the Scottish Widows website:
  const browser = await puppeteer.launch({headless: true});
  const page = await browser.newPage();
  await page.goto(process.env.PENSION_URL);

  async function fillInputField(fieldName, input) {
    await page.type(`input[name=${fieldName}]`, input);
  }

  async function getText(selector) {
    const element = await page.$(selector);
    return await element.evaluate((element) => element.innerText);
  }

  async function getTextFromDataSelector(dataSelector) {
    return getText(`[data-selector=${dataSelector}]`);
  }

  await page.waitForSelector('h1');
  await page.waitForSelector('#lbganalyticsCookies');
  const title = await page.$('h1').then(e => e.evaluate((t) => t.innerText));

  if (!title.includes('MAINTENANCE') && !title.includes("something went wrong")) {
    // Log into Scottish Widows:
    await page.click("#accept");
    await fillInputField('email', process.env.PENSION_EMAIL);
    await fillInputField('password', process.env.PENSION_PASSWORD);
    await Promise.all([
      page.click('#button-submit'),
      page.waitForNavigation(),
    ]);

    // Scrape values:
    await page.waitForSelector('[data-selector=sub-policy-select-link]');
    await page.click("[data-selector=sub-policy-select-link]");
    await page.waitForSelector('[data-selector=policy-valuation-date]');
    const dateText = await getTextFromDataSelector('policy-valuation-date');
    const newBalanceText = await getTextFromDataSelector('policy-total');
    const premiumText = await getText("[data-selector=payment-history-table] tbody tr");

    // Process values:
    const date = getDateStr(dateText);
    const newBalance = currency(newBalanceText);
    const premium = getPremium(premiumText)

    // Record data in Google Sheet:
    addDataToSheet(date, newBalance, premium);
  }
  else {
    console.log('site is unavailable. try again later.')
  }

  await browser.close();
})();

async function addDataToSheet(date, newBalance, premium) {
  // Load Google Sheet and authenticate:
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID);
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
  let oldBalance = currency(lastRow.value);

  function isRowRecorded(oldDate, date, balance) {
    return oldDate === date && oldBalance.value === balance.value;
  }

  if (rows.length && isRowRecorded(lastRow.date, date, newBalance)) {
    // Todo: uncomment when testing
    // console.log(`row ${date}: ${newBalance} already recorded. abort.`);
  } else {
    let newRow = rows[lastRecordIndex - 1];
    const today = new Date();
    const time =
     `${today.getHours()}:${today.getMinutes()}:${today.getSeconds()}`;
    let totalPaid = currency(lastRow['total payments']);

    // Record if new premium payment was made:
    if (getDateFromStr(lastRow.date) < getDateFromStr(premium.date)) {
      totalPaid = totalPaid.add(premium.value);
      const totalGain = currency(lastRow['total gain']);
      const intermediateBalance = oldBalance.add(premium.value);
      const paymentRowData = {
        time,
        'date': premium.date,
        'value': intermediateBalance,
        'change': premium.value,
        'payment': true,
        'total payments': totalPaid,
        'total gain': totalGain,
        'rate of return': totalGain.value / totalPaid.value
      };
      saveSheetRow(newRow, paymentRowData);

      oldBalance = intermediateBalance;
      lastRow = newRow;
      newRow = rows[lastRecordIndex - 2];
    }

    // Record new balance:
    const change = newBalance.subtract(oldBalance);
    const totalGain = newBalance.subtract(totalPaid);

    const newRowData = {
      time,
      date,
      'value': newBalance,
      change,
      'total payments': lastRow['total payments'],
      'total gain': totalGain,
      'rate of return': totalGain.value / totalPaid.value,
    };

    saveSheetRow(newRow, newRowData);
  }
}

async function saveSheetRow(newRow, newRowData) {
  Object.assign(newRow, newRowData);
  await newRow.save();
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

function getPremium(text) {
  const comps = text.split("\t");
  const value = currency(comps[2]);
  const date = getDateStr(comps[0]);

  return {value, date};
}