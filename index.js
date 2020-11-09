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

	const rows = await sheet.getRows({ limit: 1 });

	if (rows.length > 0 && rows[0].date === date && rows[0].value === value) {
		console.log("row already exists. abort.");
	}
	else {
		const now = new Date();
		const time = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
		await sheet.addRow({ time, date, value });
		console.log(`Added row: ${time}, ${date}: ${value}`);
	}
}

function getFormattedDate(dateText) {
	var pensionDate = new Date(dateText);
	var month = pensionDate.getMonth() + 1;
	var day = pensionDate.getDate();
	var year = pensionDate.getFullYear();
	return day + "/" + month + "/" + year;
}