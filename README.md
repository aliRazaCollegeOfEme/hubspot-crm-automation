# hubspot-crm-automation
HubSpot CRM Contact & Deal Automation
🚀 Overview
This project automates the process of:

Fetching contacts added in January 2025 from HubSpot CRM.

Checking if a contact has a deal:

If a deal exists → update follow_up_status to "pending_review".

If no deal exists → create a new deal with an amount of $1000.

Sending an email report with the processing summary.

# to run this project follow as:
git clone https://github.com/aliRazaCollegeOfEme/hubspot-crm-automation.git
cd hubspot-crm-automation
yarn
node index.js

# further to done:
# docker application (move above commands to docker file)
# use some queue e.g. bullMQ or some DB table to fetch contacts into queue then process.
# delete from queue/table after processing