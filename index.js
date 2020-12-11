const puppeteer = require('puppeteer');
const { GoogleSpreadsheet } = require('google-spreadsheet');

require('dotenv').config()

(async () => {

	const browser = await puppeteer.launch();
	const page = await browser.newPage();

	await page.goto(process.env.PENSION_URL);

	if (!await page.$("h1[value*='SITE MAINTENANCE']")) {
		await page.click("input[name=emailAddress]");
		await page.keyboard.type(process.env.PENSION_EMAIL);

		await page.click("input[name=password]");
		await page.keyboard.type(process.env.PENSION_PASSWORD);


		await Promise.all([
			page.click("#button-login"),
			page.waitForNavigation(),
		]);

		await page.waitForSelector('[data-selector=manage-totalvalue]');

		const date = await page.$("[data-selector=manage-valuedate]");
		const dateText = await date.evaluate(element => element.innerText);

		const value = await page.$("[data-selector=manage-totalvalue]");
		const valueText = await value.evaluate(element => element.innerText);

		addRowToSheet(getFormattedDate(dateText), valueText);
	}

	await browser.close();
})();

async function addRowToSheet(date, value) {
	const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);

	await doc.useServiceAccountAuth({
		client_email: process.env.CLIENT_EMAIL,
		private_key: process.env.PRIVATE_KEY,
	});

	await doc.loadInfo();
	const sheet = doc.sheetsByIndex[0];

	const rows = await sheet.getRows({ limit: 15 });
	const lastRecordIndex = rows.findIndex(row => row.date);
	const lastRow = rows[lastRecordIndex];

	if (rows.length > 0 && lastRow.date === date && lastRow.value === value) {
		console.log(`row ${date}: ${value} already exists. abort.`);
	}
	else {
		updateNewRow(lastRow, rows[lastRecordIndex - 1], date, value);
	}
}

async function updateNewRow(lastRow, newRow, date, value) {
	const time = new Date().toISOString().substr(11, 8);
	const change = getChange(lastRow.value, value);
	Object.assign(newRow, { time, date, value, change });
	await newRow.save();

	console.log(`Added row: ${time}, ${date}: ${value}, ${change}`);
}

function getChange(previousVal, currentVal) {
	const previousFloat = getDoubleValue(previousVal);
	const currentFloat = getDoubleValue(currentVal);
	const diff = currentFloat - previousFloat;
	return Math.round((diff + Number.EPSILON) * 100) / 100;
}

function getDoubleValue(valueText) {
	return parseFloat(valueText.substring(1).replace(',', ""));
}

function getFormattedDate(dateText) {
	return new Date(dateText).toLocaleDateString('en-GB');
}