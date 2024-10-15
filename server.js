require('dotenv').config();
const express = require('express');
const { WebClient } = require('@slack/web-api');
const axios = require('axios');

const app = express();
const slackToken = process.env.SLACK_BOT_TOKEN;
const openAiApiKey = process.env.OPENAI_API_KEY;
const slackClient = new WebClient(slackToken);

app.use(express.json());

app.post('/slack/events', async (req, res) => {
    const { text, channel } = req.body.event;

    // Predefine the instructions for OpenAI
    const preprompt = `
        You are an IT Support Agent. Respond only to messages related to our website or app.
        Ask probing questions if the task is unclear. Keep responses under 50 words.
    `;

    try {
        // Combine the preprompt with the user's message
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: preprompt },
                { role: 'user', content: text },
            ],
            max_tokens: 50,
        }, {
            headers: {
                'Authorization': `Bearer ${openAiApiKey}`,
                'Content-Type': 'application/json',
            },
        });

        // Extract the AI's response
        const reply = response.data.choices[0].message.content;

        // Send the reply back to Slack
        await slackClient.chat.postMessage({ channel, text: reply });
    } catch (error) {
        console.error(error);
        await slackClient.chat.postMessage({
            channel,
            text: 'There was an error processing your request. Please try again later.'
        });
    }

    res.sendStatus(200);
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
