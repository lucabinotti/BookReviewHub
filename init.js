'use strict';

const path = require('path');
const express = require('express');
const morgan = require('morgan');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const session = require('express-session');
const {insertUser, getUser} = require('./models/dao');


const app = express();
const port = 3000;

const clientId = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const clientSecret = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const secretSession = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXX';

// Configura l'uso di Passport con la strategia di autenticazione GitHub
passport.use(
    new GitHubStrategy(
        {
            clientID: clientId,
            clientSecret: clientSecret,
            callbackURL: `http://localhost:${port}/auth/github/callback`,
        },
        // Eseguita dopo l'autenticazione
        async (accessToken, refreshToken, profile, done) => {
            if(await getUser(profile.id) === undefined)
            {
                insertUser(profile.id, profile.username, profile.photos[0].value);
            }
            return done(null, profile.id);
        }
    )
);

// Inizializza Passport per l'autenticazione
app.use(passport.initialize());

// Per gestire le sessioni degli utenti autenticati
app.use(session({
    secret: secretSession,
    resave: false,
    saveUninitialized: false
}));

// Abilita passport per gestire la persistenza delle sessioni
app.use(passport.session());

passport.serializeUser((id, done) => {
    done(null, id);
});

passport.deserializeUser(async (id, done) => {
    let userInfo = await getUser(id);
    userInfo.auth = true;
    done(null, userInfo);
});

// Loggare richieste HTTP
app.use(morgan('tiny'));

app.use(express.json());

// Per analizzare i dati URL-encoded inviati tramite le richieste HTTP POST
app.use(express.urlencoded({extended: true}));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/javascripts', express.static(path.join(__dirname, 'public/javascripts')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));

module.exports = {app, port, passport};