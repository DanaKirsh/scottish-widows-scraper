const puppeteer = require('puppeteer');
const { GoogleSpreadsheet } = require('google-spreadsheet');

const config = require('./config.json');

(async () => {
	const browser = await puppeteer.launch();
	const page = await browser.newPage();

	await page.goto(config.pension_url);

	if (!await page.$("h1[value*='SITE MAINTENANCE']")) {
		await page.click("input[name=emailAddress]");
		await page.keyboard.type(config.pension_email);

		await page.click("input[name=password]");
		await page.keyboard.type(config.pension_password);


		await Promise.all([
			page.click("#button-login"),
			page.waitForNavigation(),
		]);

		page.waitForSelector("[data-selector=manage-totalvalue]");

		await page.screenshot({ path: 'example.png' });

		const date = await page.$("[data-selector=manage-valuedate]");
		const dateText = await date.evaluate(element => element.innerText);

		const value = await page.$("[data-selector=manage-totalvalue]");
		const valueText = await value.evaluate(element => element.innerText);

		addRowToSheet(getFormattedDate(dateText), valueText);
	}
	await browser.close();
})();

async function addRowToSheet(date, value) {
	const doc = new GoogleSpreadsheet(config.google_sheet_id);

	await doc.useServiceAccountAuth({
		client_email: config.client_email,
		private_key: config.private_key,
	});

	await doc.loadInfo();
	const sheet = doc.sheetsByIndex[0];

	const rows = await sheet.getRows({ limit: 2 });

	if (rows.length > 0 && rows[1].date === date && rows[1].value === value) {
		console.log("row already exists. abort.");
	}
	else {
		const now = new Date();
		const time = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
		const change = getDoubleValue(rows[1].value) - getDoubleValue(value);
		await sheet.addRow({ time, date, value, change });
		console.log(`Added row: ${time}, ${date}: ${value}, ${change}`);
	}
}

function getDoubleValue(valueText) {
	return parseFloat(valueText.substring(1));
}

function getFormattedDate(dateText) {
	return new Date(dateText).toLocaleDateString('en-GB');
}