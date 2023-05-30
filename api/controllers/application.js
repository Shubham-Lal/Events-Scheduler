const { google } = require("googleapis");
const axios = require("axios");
const User = require("../models/User.js");
const { v4 } = require("uuid");

const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URL
);

exports.apiCall = async (req, res, next) => {
    res.send({ message: 'Ok api is working 🚀' });
};

exports.auth = async (req, res, next) => {
    try {
        const scopes = [
            'profile',
            'email',
            'https://www.googleapis.com/auth/calendar'
        ];

        const url = oauth2Client.generateAuthUrl({
            access_type: "offline",
            prompt: "consent",
            scope: scopes
        });

        res.status(200).redirect(url);
    }
    catch (error) {
        next(error);
    }
};

exports.createToken = async (req, res, next) => {
    try {
        const code = req.query.code;
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials({
            refresh_token: tokens.refresh_token
        });

        const googleUser = await axios
            .get(
                `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${tokens.access_token}`,
                {
                    headers: {
                        Authorization: `Bearer ${tokens.id_token}`,
                    },
                },
            )
            .then(res => {
                return { data: res.data, refresh_token: tokens.refresh_token };
            })
            .catch(error => {
                throw new Error(error.message);
            });
        const { id, email, name } = googleUser.data;
        let user = await User.findOneAndUpdate({ email }, {
            googleId: id,
            refresh_token: googleUser.refresh_token,
            name,
            email,
        },
            { upsert: true, new: true }
        );

        // res.redirect(process.env.FRONTEND_URL);
        const userJson = JSON.stringify(user);
        const encodedUser = encodeURIComponent(userJson);
        res.redirect(`${process.env.FRONTEND_URL}?user=${encodedUser}`);
    }
    catch (error) {
        next(error);
    }
};

exports.createEvent = async (req, res, next) => {
    try {
        const {
            summary,
            description,
            timezone,
            startTime,
            endTime,
            guests
        } = req.body;

        const calendar = google.calendar({
            version: "v3",
            auth: process.env.API_KEY
        });

        const response = await calendar.events.insert({
            auth: oauth2Client,
            calendarId: "primary",
            conferenceDataVersion: 1,
            requestBody: {
                summary: summary,
                description: description,
                start: {
                    dateTime: startTime,
                    timeZone: timezone,
                },
                end: {
                    dateTime: endTime,
                    timeZone: timezone,
                },
                conferenceData: {
                    createRequest: {
                        requestId: v4(),
                    },
                },
                attendees: guests,
            }
        });

        res.status(200).send({ response });
    }
    catch (error) {
        next(error);
    }
}