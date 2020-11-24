# scottish-widows-scraper
Scrapes the pension value and date from the Scottish Widows website, and records it in a google sheet.

## Requirements:
- [Scottish Widows](https://www.scottishwidows.co.uk/workplace/log-in/) workplace pension account
- NodeJs
- Google account

# Instructions
1. Clone this repository
2. Create a google sheet where the data will be stored, with the following headers: 'time', 'date', 'value', 'change', 'contribution values', 'contribution'
3. Create a google cloud platform app with drive and sheets permissions
4. Add to the project directory a `config.json` file with the following fields:
```
{
  "private_key": "_",
  "client_email": "_",
  "google_sheet_id": "_",
  "pension_email": "_",
  "pension_password": "_",
  "pension_url": "https://personal.secure.scottishwidows.co.uk/"
}
```
5. Schedule a task to run the `index.js` script daily

Rows are added to the spreadsheet in reverse chronological order, meaning that the top filled row is the last recorded one. In order to maintain this order, you'll need to ensure there are always empty rows at the top of the spreadsheet. 
