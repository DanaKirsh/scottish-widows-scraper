# scottish-widows-scraper
Scrapes the pension value and date from the Scottish Widows website, and records it in a google sheet.

## Requirements:
- [Scottish Widows](https://www.scottishwidows.co.uk/workplace/log-in/) workplace pension account
- NodeJs
- Google account

# Instructions
1. Clone this repository
2. Create a google sheet where the data will be stored, with the following headers: `time`(Time), `date`(Date), `value`(Currency), `change`(Currency), `payment`(Tick box), `total payments`(Currency), `total gain`(Currency), `rate of return`(Percent). [Example of the template I use](https://docs.google.com/spreadsheets/d/1xJKd9iZn-7UkdgAjSThVq-j_ZfiamMlNU0NAbIFkyTU/edit?usp=sharing) (with fake data)
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
5. Schedule a task to run the `index.js` script daily

### Windows

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

Some other useful settings that I ticked include:
- Allow task to be run on demand
- Run task as soon as possible after a scheduled start is missed
- Stop task if it runs longer than _
- Start the task only if the computer is on AC power (ticked off)

**Rows are added to the spreadsheet in reverse chronological order, meaning that the top filled row is the last recorded one. In order to maintain this order, you'll need to ensure there are always empty rows at the top of the spreadsheet.** I add some new rows to the top every week when I check on my pension. Planning on automating that too at some point.
