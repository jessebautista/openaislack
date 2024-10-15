require('dotenv').config();
const axios = require('axios'); // Import axios
const { WebClient } = require('@slack/web-api'); // Import WebClient from Slack

module.exports = async (req, res) => {
    // Initialize Slack client inside the function to ensure it has access to environment variables
    const slackToken = process.env.SLACK_BOT_TOKEN;
    const slackClient = new WebClient(slackToken);

    if (req.method === 'POST') {
        const { type, challenge, event } = req.body;

        // Respond to URL verification challenge
        if (type === 'url_verification') {
            return res.status(200).send(challenge);
        }

        // Process incoming messages
        if (event && event.type === 'message' && !event.subtype) {
            const { text, channel } = event;

            // Define instructions for OpenAI
            const preprompt = `
                You are an IT Support Agent. Respond only to messages related to our website or app.
                Ask probing questions if the task is unclear. Keep responses under 50 words.
            `;

            try {
                // Send request to OpenAI
                const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                    model: 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: preprompt },
                        { role: 'user', content: text },
                    ],
                    max_tokens: 50,
                }, {
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                });

                // Send response back to Slack
                const reply = response.data.choices[0].message.content;
                await slackClient.chat.postMessage({ channel, text: reply });
            } catch (error) {
                console.error(error);
                await slackClient.chat.postMessage({
                    channel,
                    text: 'There was an error processing your request. Please try again later.'
                });
            }
        }

        // Respond with a 200 OK for all other requests
        res.status(200).send('OK');
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).send(`Method ${req.method} Not Allowed`);
    }
};
