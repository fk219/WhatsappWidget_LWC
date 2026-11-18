Twilio Webhook Configuration
Webhook URLs:
Incoming Messages: http://localhost:3001/webhook/incoming (POST)
Status Updates: http://localhost:3001/webhook/status (POST)
Setup in Twilio:
Go to the Twilio Sandbox settings (as shown in your image).
Update the "When a message comes in" URL to http://localhost:3001/webhook/incoming with POST.
Update the "Status callback URL" to http://localhost:3001/webhook/status with POST.
Use a tool like ngrok (ngrok http 3001) to expose your localhost to the internet for Twilio webhook testing, as Twilio cannot reach localhost directly.