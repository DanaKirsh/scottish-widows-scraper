# scottish-widows-scraper
Scrapes the pension value and date from the Scottish Widows website, and records it in a google sheet.

## Requirements:
- [Scottish Widows](https://personal.secure.scottishwidows.co.uk/login) workplace pension account
- NodeJs
- Google account

# Setting up
1. Clone this repository
2. Create a google sheet where the data will be stored, with the following headers: `time`(Time), `date`(Date), `value`(Currency), `change`(Currency), `payment`(Tick box), `total payments`(Currency), `total gain`(Currency), `rate of return`(Percent). [Example of the template I use](https://docs.google.com/spreadsheets/d/1xJKd9iZn-7UkdgAjSThVq-j_ZfiamMlNU0NAbIFkyTU/edit?usp=sharing) you can duplicate (with fake data)
3. Create a google cloud platform app with drive and sheets permissions
4. Add a `.env` file with the following fields to the project directory:
```
PENSION_URL=https://personal.secure.scottishwidows.co.uk/
PENSION_EMAIL=___
PENSION_PASSWORD=___
PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n <fill missing bit> \n-----END PRIVATE KEY-----\n"
CLIENT_EMAIL=___
GOOGLE_SHEET_ID=___
```
5. Schedule to run the `index.js` script daily

## Schedule on Windows

To schedule the script to run locally in Windows, you can use the task scheduler. Here are parts of the settings of the scheduled task I use:
```
  <Triggers>
    <CalendarTrigger>
      <ExecutionTimeLimit>PT30M</ExecutionTimeLimit>
      <Enabled>true</Enabled>
      <ScheduleByWeek>
        <DaysOfWeek>
          <Tuesday />
          <Wednesday />
          <Thursday />
          <Friday />
          <Saturday />
        </DaysOfWeek>
        <WeeksInterval>1</WeeksInterval>
      </ScheduleByWeek>
    </CalendarTrigger>
  </Triggers>
  
  <Actions Context="Author">
    <Exec>
	  <!-- path of the node executable on your machine -->
      <Command>...\node.exe</Command>

	  <!-- the index script that performs the logging (leave as is) -->
      <Arguments>".\index.js"</Arguments>

	  <!-- path of where you cloned this repo -->
      <WorkingDirectory>C:\\...\scottish-widows-scraper</WorkingDirectory>
    </Exec>
  </Actions>
```
Historically it appears Scottish Widows updates the pension values daily Tuesday to Saturday.

Some other useful settings that I enabled include:
- Allow task to be run on demand
- Run task as soon as possible after a scheduled start is missed
- Stop task if it runs longer than _
- Start the task only if the computer is on AC power (ticked off)
- Run whether user is logged on or not - will run the script in the background.

## Receive push notifications on your phone

Using IFTTT it is possible to receive a push notification to your phone alerting you when a new row was added to the spreadsheet. For example, you can be notified of the daily change to your pension balance.

1. Download the IFTTT app to your phone
2. Create an IFTTT account
3. Account -> Linked accounts -> link the Google account you created the spreadsheet with
4. Create a new applet:
  - If: if cell was updated in spreadsheet
    - File name: spreadsheet name
    - Cell to monitor: D11 (cell that contains latest change to balance)
  - Then: send a notification from the IFTTT app
    - Pension changed by `value` yesterday
5. Enable applet, and test by changing the value in cell D11 and clicking 'check now' in the applet in IFTTT - you should receive a notification like this:
<img src="https://user-images.githubusercontent.com/24760490/150650547-f5ab0ccc-9baf-47fa-93cc-3c32743b8e7b.png" width="300" height="200">

## Add rows to the top of the google sheet automatically

**Rows are added to the spreadsheet in reverse chronological order, meaning that the top filled row is the last recorded one. In order to maintain this order, you'll need to ensure there are always empty rows at the top of the spreadsheet.** I used to add some new rows to the top of the spreadsheet every week when I checked on my pension.

Until the `google-spreadsheet` library supports adding cells in the middle of a spreadsheet natively, the solution I use now is to create a trigger that invokes a google script function that adds rows to the spreadsheet whenever a change it made to it.

1. In your google sheet, go to Extensions > Apps Script.
2. Add this code (tweak as you like):
```javascript
function shiftRowsDown() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  var rowsToAdd = 0;

  for (var i = 10; i > 1 && !sheet.getRange(i, 3).isBlank(); i = i - 1) {
    rowsToAdd = rowsToAdd + 1;
  }

  if (rowsToAdd > 0) {
    var shiftRange = sheet.getRange(`A2:H${rowsToAdd + 1}`);
    shiftRange.insertCells(SpreadsheetApp.Dimension.ROWS);
    Logger.log(`${rowsToAdd} rows added`);
  }
  else {
    Logger.log(`No rows added`);
  }
}
```
This should make sure that the first 10 rows are always empty.

3. In the triggers section, click 'Add Trigger'.
    - Choose the function `shiftRowsDown` from the functions dropdown
    - Select event source: 'From Spreadsheet'
    - Select event type: 'On change'

4. Test that the trigger is working by changing the value in cell C10 and verifying that a row is added as a result.
5. The function above includes logging statements. You can verify the trigger is running, and how many rows are added each time by navigating to the executions tab in the app scripts window and expanding each execution.
