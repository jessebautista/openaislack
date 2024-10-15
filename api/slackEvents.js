require('dotenv').config();
const axios = require('axios');
const { WebClient } = require('@slack/web-api');

const slackToken = process.env.SLACK_BOT_TOKEN;
const openAiApiKey = process.env.OPENAI_API_KEY;
const slackClient = new WebClient(slackToken);

let lastRequestTime = 0; // Track the last request time

// Delay function to wait for a specified duration
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to get OpenAI response with rate limiting
async function getOpenAIResponse(prompt) {
    // Wait if the last request was less than 10 seconds ago
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < 10000) { // 10 seconds in milliseconds
        await delay(10000 - timeSinceLastRequest); // Wait the remaining time
    }

    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo',
            messages: prompt,
            max_tokens: 50,
        }, {
            headers: {
                'Authorization': `Bearer ${openAiApiKey}`,
                'Content-Type': 'application/json',
            },
        });

        // Update the last request time
        lastRequestTime = Date.now();
        return response.data.choices[0].message.content;
    } catch (error) {
        if (error.response && error.response.status === 429) {
            // Rate limit hit, wait and retry
            console.log('Rate limit hit. Retrying after a short wait...');
            await delay(1000); // Wait 1 second
            return getOpenAIResponse(prompt); // Retry
        }
        console.error('Error fetching response from OpenAI:', error);
        throw error; // Re-throw the error if it's not a rate limit issue
    }
}

// In your main handler
module.exports = async (req, res) => {
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
            const preprompt = [
                { role: 'system', content: "You are an IT Support Agent. Respond only to messages related to our website or app. Ask probing questions if the task is unclear. Keep responses under 50 words." },
                { role: 'user', content: text },
            ];

            try {
                const reply = await getOpenAIResponse(preprompt);
                await slackClient.chat.postMessage({ channel, text: reply });
            } catch (error) {
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
