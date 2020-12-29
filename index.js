const puppeteer = require('puppeteer');
const { GoogleSpreadsheet } = require('google-spreadsheet');

require('dotenv').config();

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

		const newBalance = await page.$("[data-selector=manage-totalvalue]");
		const newBalanceText = await newBalance.evaluate(element => element.innerText);

		const premiumPaid = await page.$("[data-selector=policy-card-last-premium-paid]");
		const premiumPaidText = await premiumPaid.evaluate(element => element.innerText);
		const premiumValue = premiumPaidText.match(/\d+(\.\d+)?/)[0];
		const premiumDate = premiumPaidText.split(" received on ")[1];

		addRowToSheet(getFormattedDate(dateText), newBalanceText, premiumValue, getFormattedDate(premiumDate));
	}

	await browser.close();
})();

async function addRowToSheet(date, newBalance, premiumValue, premiumDate) {

	const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);

	await doc.useServiceAccountAuth({
		client_email: process.env.CLIENT_EMAIL,
		private_key: process.env.PRIVATE_KEY,
	});

	await doc.loadInfo();
	const sheet = doc.sheetsByIndex[0];

	const rows = await sheet.getRows({ limit: 15 });
	const lastRecordIndex = rows.findIndex(row => row.date); // assuming not -1, based on my existing spreadsheet
	var lastRow = rows[lastRecordIndex];
	var newRow = rows[lastRecordIndex - 1];

	if (rows.length > 0 && lastRow.date === date && lastRow.value === newBalance) {
		console.log(`row ${date}: ${newBalance} already exists. abort.`);
	}
	else {
		const time = new Date().toISOString().substr(11, 8);
		const oldBalance = getDouble(lastRow.value);
		var totalPaid = getDouble(lastRow["total payments"]);
		newBalance = getDouble(newBalance);
		premiumValue = parseFloat(premiumValue);

		if (getDateFromStr(lastRow.date) < getDateFromStr(premiumDate)) {
			totalPaid += premiumValue;
			const intermediateBalance = roundTo2DecimalPlaces(oldBalance + premiumValue);
			const paymentRowData = {
				time,
				date: premiumDate,
				value: intermediateBalance,
				change: premiumValue,
				payment: true,
				"total payments": roundTo2DecimalPlaces(totalPaid),
				"total gain": getDouble(lastRow["total gain"]),
				"rate of return": parseFloat(lastRow["rate of return"]) / 100
			};

			Object.assign(newRow, paymentRowData);
			await newRow.save();
			lastRow = newRow;
			newRow = rows[lastRecordIndex - 2];
		}

		const change = Math.round((newBalance - oldBalance + Number.EPSILON) * 100) / 100;
		const totalGain = newBalance - totalPaid;
		const rateOfReturn = totalGain / totalPaid;

		const newRowData = {
			time,
			date,
			value: newBalance,
			change,
			"total payments": lastRow["total payments"],
			"total gain": totalGain,
			"rate of return": rateOfReturn
		};

		Object.assign(newRow, newRowData);
		await newRow.save();
	}
}

function getDouble(newBalanceText) {
	return parseFloat(newBalanceText.substring(1).replace(',', ""));
}

function getDateFromStr(dateStr) {
	const parts = dateStr.split("/");
	return new Date(parseInt(parts[2], 10),
		parseInt(parts[1], 10) - 1,
		parseInt(parts[0], 10));
}

function getFormattedDate(dateText) {
	return new Date(dateText).toLocaleDateString('en-GB');
}

function roundTo2DecimalPlaces(number) {
	return Math.round((number + Number.EPSILON) * 100) / 100;
}