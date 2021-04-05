# scottish-widows-scraper
Scrapes the pension value and date from the Scottish Widows website, and records it in a google sheet.

## Requirements:
- [Scottish Widows](https://www.scottishwidows.co.uk/workplace/log-in/) workplace pension account
- NodeJs
- Google account

# Instructions
1. Clone this repository
2. Create a google sheet where the data will be stored, with the following headers: `time`(Time), `date`(Date), `value`(Currency), `change`(Currency), `payment`(Tick box), `total payments`(Currency), `total gain`(Currency), `rate of return`(Percent).
3. Create a google cloud platform app with drive and sheets permissions
4. Add to the project directory a `config.json` file with the following content(replacen hyphens with your credentials):
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

Rows are added to the spreadsheet in reverse chronological order, meaning that the top filled row is the last recorded one. In order to maintain this order, you'll need to ensure there are always empty rows at the top of the spreadsheet. 
