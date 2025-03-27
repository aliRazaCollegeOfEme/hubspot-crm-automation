# hubspot-crm-automation
HubSpot CRM Contact & Deal Automation
🚀 Overview
This project automates the process of:

Fetching contacts added in January 2025 from HubSpot CRM.

Checking if a contact has a deal:

If a deal exists → update follow_up_status to "pending_review".

If no deal exists → create a new deal with an amount of $1000.

Sending an email report with the processing summary.

<!-- npm i -g @hubspot/cli -->

# setup instructions:
git clone https://github.com/aliRazaCollegeOfEme/hubspot-crm-automation.git
cd hubspot-crm-automation
yarn
yarn start

# assumptions made
you have created a private app in hubspot CRM and got access token (not available with developer account)
and placed it in .env file as key (HUBSPORT_ACCESS_TOKEN).
Or for public app you've created a test account and installed app.
Paste this URL:
https://app-na2.hubspot.com/oauth/authorize?client_id=75088096-13bb-4d72-b6fb-3392d4d9ee14&redirect_uri=http://localhost:3000&scope=oauth%20crm.objects.deals.read%20crm.objects.deals.write%20crm.objects.contacts.read

and you'll get Access token that you'll have to place in env's against key: HUBSPORT_ACCESS_TOKEN
# example output

# further to done:
# docker application (move above commands to docker file)
# use some queue e.g. bullMQ or some DB table to fetch contacts into queue then process.
# delete from queue/table after processing